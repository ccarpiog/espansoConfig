//! The sidecar's disk I/O: confinement, the cross-process lock, read,
//! quarantine, atomic replacement.
//!
//! **The application-metadata writer** (ruling 25). It writes only inside
//! `<storage root>/workspaces/`, the storage root being fixed when the
//! [`SidecarStore`] is built, and none of its writing methods takes a path: a
//! file is named by a [`WorkspaceKey`], whose one constructor hashes. It shares
//! no code with `espansoconfig_core::persist`, which writes the user's espanso
//! files and nothing else.
//!
//! # Confinement: no symlink below the storage root is followed
//!
//! Every app-owned component below the storage root — the `workspaces`
//! directory, its lock file, a sidecar file and a temporary file — is refused
//! when it is a symbolic link (Phase 3-12 review, finding 1):
//!
//! - [`SidecarStore::open`] creates `workspaces` with `create_dir` (which never
//!   follows a symlink at that name: an existing link, dangling or not, is
//!   `AlreadyExists`) and then refuses it unless `symlink_metadata` says it is
//!   a directory. It records the directory's device and inode.
//! - The lock file is refused unless `symlink_metadata` says it is a regular
//!   file and the file actually opened has that same device and inode. A
//!   missing one is created with `create_new`, which never follows a symlink.
//! - A sidecar file is read the same way: refused unless it is a regular file,
//!   and read through the descriptor whose device and inode were compared, so
//!   the bytes judged are the bytes of that file.
//! - A temporary file is created with `create_new`, so an existing symlink at
//!   its name is an error, never followed.
//! - Before creating the temporary file, before the replacing rename and
//!   before a quarantine rename, the directory is checked again: still a
//!   directory, not a symlink, same device and inode as when it was opened.
//!   Immediately before the replacing rename the target is re-read with the
//!   same checks, so a sidecar path that has become a symlink refuses the
//!   replacement.
//!
//! **What this does not close**: `std` has no directory-relative operations
//! (`openat`, `renameat`), so every step still resolves
//! `<storage root>/workspaces/<name>` by path. A process that swaps
//! `workspaces` for a symlink *after* one of the checks above and back *before*
//! the next could redirect the one operation in between. The checks narrow
//! that window to the span between a check and the call that follows it; they
//! do not remove it. The storage root itself, and its ancestors, are the
//! application data directory the platform names, and are not checked: a
//! storage root that is a symlink is followed.
//!
//! # The cross-process lock
//!
//! [`SidecarStore::open`] takes an **exclusive advisory lock**
//! (`flock(2)` with `LOCK_EX`, called through `libc` because `File::lock` is
//! newer than the workspace's `rust-version`) on
//! `<storage root>/workspaces/sidecar.lock`
//! and answers a [`LockedDirectory`], the only type with reading or writing
//! methods. The lock is released when that value is dropped, or when the
//! process ends. So every read, quarantine and replacement of one application
//! instance happens under the lock, and the orchestration in `crate::sidecar`
//! holds one `LockedDirectory` from its reload to its last write. The lock is
//! advisory: a writer that does not take it is not stopped by it, which is why
//! the schema check before a rename is repeated under it (see below). Taking it
//! blocks, without a timeout: an instance that stops while holding it (a
//! debugger, `SIGSTOP`) stalls every other instance's sidecar load and update
//! until it resumes or exits.
//!
//! # Atomic replacement
//!
//! [`LockedDirectory::replace`] writes a temporary file **in the same
//! directory** (`<digest>.json.tmp-<pid>-<n>`, created exclusively, mode
//! `0600`), writes the whole content, `sync_all`s it (on Apple targets `std`
//! issues `F_FULLFSYNC`), re-reads the target and **refuses** if it now
//! declares a newer schema ([`ReplaceError::FutureSchema`]), and `rename`s the
//! temporary file over `<digest>.json`. `rename` within one directory replaces
//! the name atomically, so a reader finds the old file or the new one and never
//! a partial one. An interruption before the rename leaves the old file (or no
//! file) and, at most, a stray temporary file, which nothing reads; a failure
//! the writer sees removes that temporary file, and a crash does not. The
//! directory is `sync_all`ed afterwards, **best effort**: a failure there is not
//! reported, because the rename has already happened, and no durability across
//! power loss is claimed for it. The re-read and the rename are two calls: a
//! writer that ignores the lock and lands between them is not detected.
//!
//! # Quarantine
//!
//! [`LockedDirectory::quarantine`] re-reads the file first and renames it only
//! if it still holds the bytes the caller judged corrupt; otherwise it answers
//! [`QuarantineError::Changed`] and renames nothing. It renames the file aside
//! to `<digest>.corrupt-<unix seconds>-<pid>-<n>.json` in the same directory,
//! and answers the new name **only after the rename returned success**. A name
//! that already exists is skipped rather than replaced. Nothing is deleted.
//!
//! # Failure injection
//!
//! Every step that touches the disk first calls a [`Probe`] with its
//! [`Step`]. Production passes [`no_probe`]; the tests pass a closure that fails
//! a chosen step, or writes another instance's bytes, or starts another
//! instance, inside the first's, which is how an interrupted replacement and a
//! two-instance race are exercised without real crashes or real timing.

use std::fs::{self, File, Metadata, OpenOptions};
use std::io::{self, Read as _, Write as _};
use std::os::unix::fs::{MetadataExt as _, OpenOptionsExt as _};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use super::format::{parse, Parsed, WorkspaceKey};

/// The sub-directory of the storage root that holds every sidecar file.
pub const SIDECAR_DIRECTORY: &str = "workspaces";

/// The lock file inside [`SIDECAR_DIRECTORY`]. Its name can never be a
/// sidecar's (`<hex>.json`), a temporary file's or an aside's.
pub const LOCK_FILE: &str = "sidecar.lock";

/// How many times [`open_lock_file`] looks again after another instance
/// created the lock file between this one's look and its create.
const LOCK_FILE_ATTEMPTS: usize = 3;

/// A process-wide counter that makes temporary and quarantine names distinct
/// within one process; the process id makes them distinct across processes.
static NEXT_NAME: AtomicU64 = AtomicU64::new(0);

/// One disk step of a quarantine or a replacement, as a [`Probe`] sees it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// About to re-read a corrupt file and rename it aside.
    Quarantine,
    /// About to create the temporary file.
    CreateTemp,
    /// About to write the content into it.
    WriteTemp,
    /// About to `sync_all` it.
    SyncTemp,
    /// About to re-check the target and rename the temporary file over it.
    Rename,
    /// About to `sync_all` the directory, after the rename.
    SyncDirectory,
}

/// Called before every disk step; an error fails that step as the disk would.
pub type Probe<'a> = &'a mut dyn FnMut(Step) -> io::Result<()>;

/// The production probe: every step proceeds.
pub fn no_probe(_: Step) -> io::Result<()> {
    Ok(())
}

/// Why a replacement did not happen. In every case the sidecar file holds
/// what it held.
#[derive(Debug)]
pub enum ReplaceError {
    /// Re-read under the lock immediately before the rename, the target
    /// declares a newer schema; it was not replaced.
    FutureSchema {
        /// The declared version, in decimal.
        version: String,
    },
    /// A disk step failed, or a component was refused as a symlink. The
    /// error itself is not kept: no caller reports more than the outcome.
    Failed,
}

impl From<io::Error> for ReplaceError {
    /// A disk failure.
    fn from(_: io::Error) -> ReplaceError {
        ReplaceError::Failed
    }
}

/// Why a quarantine did not happen. In every case nothing was renamed.
#[derive(Debug)]
pub enum QuarantineError {
    /// The file is gone, or no longer holds the bytes judged corrupt: read it
    /// again.
    Changed,
    /// The re-read or the rename failed, or a component was refused as a
    /// symlink; the bytes are where they were. The error itself is not kept.
    Failed,
}

/// The sidecar files of one application storage root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SidecarStore {
    /// The application's own storage root: Tauri's app data directory in
    /// production, a temporary directory in tests.
    root: PathBuf,
}

impl SidecarStore {
    /// The store under `root`. Creates nothing until the first write.
    pub fn new(root: PathBuf) -> SidecarStore {
        SidecarStore { root }
    }

    /// Verifies the sidecar directory, takes the cross-process lock and
    /// answers the directory under it; `None` when there is no directory and
    /// `create` is false. Blocks while another instance holds the lock.
    ///
    /// # Errors
    ///
    /// A failure to create, inspect or lock, or a refusal (`InvalidData`)
    /// because the directory or the lock file is not what it must be — a
    /// symlink, most importantly. Nothing is read or written on that path.
    pub fn open(&self, create: bool) -> io::Result<Option<LockedDirectory>> {
        let directory = self.root.join(SIDECAR_DIRECTORY);
        if create {
            fs::create_dir_all(&self.root)?;
            match fs::create_dir(&directory) {
                Ok(()) => {}
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(error),
            }
        }
        let checked = match fs::symlink_metadata(&directory) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound && !create => return Ok(None),
            Err(error) => return Err(error),
        };
        if !checked.file_type().is_dir() {
            return Err(unconfined("the sidecar directory is not a plain directory"));
        }
        let lock = open_lock_file(&directory)?;
        lock_exclusively(&lock)?;
        let locked = LockedDirectory {
            identity: identity(&checked),
            directory,
            _lock: lock,
        };
        // The directory the lock file was opened in is still the one checked.
        locked.verify()?;
        Ok(Some(locked))
    } // End of function open()
} // End of impl SidecarStore

/// The sidecar directory, verified and exclusively locked for as long as this
/// value lives. The only way to read, quarantine or replace a sidecar file.
#[derive(Debug)]
pub struct LockedDirectory {
    /// `<storage root>/workspaces`.
    directory: PathBuf,
    /// Its device and inode when it was verified.
    identity: (u64, u64),
    /// The locked lock file; dropping it releases the lock.
    _lock: File,
}

impl LockedDirectory {
    /// Reads the sidecar file of `key`, whole; `None` when there is none.
    ///
    /// # Errors
    ///
    /// The read's own error, or a refusal (`InvalidData`) when the name is a
    /// symlink or anything but a regular file, or changed identity between
    /// the check and the open.
    pub fn read(&self, key: &WorkspaceKey) -> io::Result<Option<Vec<u8>>> {
        let path = self.directory.join(key.file_name());
        let checked = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        if !checked.file_type().is_file() {
            return Err(unconfined("the sidecar file is not a regular file"));
        }
        let mut file = match File::open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        if identity(&file.metadata()?) != identity(&checked) {
            return Err(unconfined("the sidecar file changed while it was opened"));
        }
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        Ok(Some(bytes))
    } // End of function read()

    /// Renames the sidecar file of `key` aside, if it still holds `judged`,
    /// and answers the name it now has.
    ///
    /// # Errors
    ///
    /// [`QuarantineError::Changed`] when the file is gone or holds other bytes
    /// now; [`QuarantineError::Failed`] when the re-read or the rename failed.
    /// In both cases **nothing was renamed** and the file's bytes are where
    /// they were.
    pub fn quarantine(
        &self,
        key: &WorkspaceKey,
        judged: &[u8],
        now: u64,
        probe: Probe<'_>,
    ) -> Result<String, QuarantineError> {
        let aside = loop {
            let candidate = format!(
                "{}.corrupt-{now}-{}-{}.json",
                key.digest(),
                std::process::id(),
                NEXT_NAME.fetch_add(1, Ordering::Relaxed)
            );
            // Skip, never replace, a name that is already taken. A name taken
            // between this check and the rename would be replaced; the pid and
            // the counter make that a second process with this pid.
            if fs::symlink_metadata(self.directory.join(&candidate)).is_err() {
                break candidate;
            }
        };
        probe(Step::Quarantine).map_err(|_| QuarantineError::Failed)?;
        self.verify().map_err(|_| QuarantineError::Failed)?;
        match self.read(key) {
            Ok(Some(bytes)) if bytes == judged => {}
            Ok(_) => return Err(QuarantineError::Changed),
            Err(_) => return Err(QuarantineError::Failed),
        }
        match fs::rename(
            self.directory.join(key.file_name()),
            self.directory.join(&aside),
        ) {
            Ok(()) => Ok(aside),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Err(QuarantineError::Changed),
            Err(_) => Err(QuarantineError::Failed),
        }
    } // End of function quarantine()

    /// Replaces the sidecar file of `key` with `bytes`, atomically.
    ///
    /// # Errors
    ///
    /// [`ReplaceError::FutureSchema`] when the target, re-read immediately
    /// before the rename, declares a newer schema; [`ReplaceError::Failed`]
    /// for any other failure up to and including the rename. In both cases
    /// **the sidecar file was not replaced**: whatever it held before, it
    /// still holds. The temporary file is removed on that path, best effort. A
    /// failure to sync the directory after the rename is not an error (see the
    /// module documentation).
    pub fn replace(
        &self,
        key: &WorkspaceKey,
        bytes: &[u8],
        probe: Probe<'_>,
    ) -> Result<(), ReplaceError> {
        let temporary = self.directory.join(format!(
            "{}.tmp-{}-{}",
            key.file_name(),
            std::process::id(),
            NEXT_NAME.fetch_add(1, Ordering::Relaxed)
        ));
        let written = write_temporary(self, &temporary, bytes, probe).and_then(|()| {
            probe(Step::Rename)?;
            self.verify()?;
            if let Some(current) = self.read(key)? {
                if let Parsed::Future { version } = parse(&current, key) {
                    return Err(ReplaceError::FutureSchema { version });
                }
            }
            Ok(fs::rename(
                &temporary,
                self.directory.join(key.file_name()),
            )?)
        });
        if let Err(error) = written {
            // Best effort: a temporary file left behind is never read.
            let _ = fs::remove_file(&temporary);
            return Err(error);
        }
        // Best effort, after the fact: the rename has happened.
        let _ = probe(Step::SyncDirectory).and_then(|()| File::open(&self.directory)?.sync_all());
        Ok(())
    } // End of function replace()

    /// Checks that the sidecar directory is still the plain directory that was
    /// verified when it was opened.
    ///
    /// # Errors
    ///
    /// The inspection's own error, or a refusal (`InvalidData`).
    fn verify(&self) -> io::Result<()> {
        let now = fs::symlink_metadata(&self.directory)?;
        if !now.file_type().is_dir() || identity(&now) != self.identity {
            return Err(unconfined("the sidecar directory was replaced"));
        }
        Ok(())
    }
} // End of impl LockedDirectory

/// Creates `path`, a temporary name inside `directory`, exclusively (never
/// following a symlink at it) after re-verifying the directory, writes `bytes`
/// into it and syncs it.
fn write_temporary(
    directory: &LockedDirectory,
    path: &Path,
    bytes: &[u8],
    probe: Probe<'_>,
) -> Result<(), ReplaceError> {
    probe(Step::CreateTemp)?;
    directory.verify()?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)?;
    probe(Step::WriteTemp)?;
    file.write_all(bytes)?;
    probe(Step::SyncTemp)?;
    Ok(file.sync_all()?)
}

/// Opens, creating it if missing, the lock file inside `directory`, refusing
/// anything but a regular file there.
fn open_lock_file(directory: &Path) -> io::Result<File> {
    let path = directory.join(LOCK_FILE);
    for _ in 0..LOCK_FILE_ATTEMPTS {
        match fs::symlink_metadata(&path) {
            Ok(checked) if checked.file_type().is_file() => {
                let file = File::open(&path)?;
                if identity(&file.metadata()?) != identity(&checked) {
                    return Err(unconfined("the lock file changed while it was opened"));
                }
                return Ok(file);
            }
            Ok(_) => return Err(unconfined("the lock file is not a regular file")),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                match OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .mode(0o600)
                    .open(&path)
                {
                    Ok(file) => return Ok(file),
                    // Created by another instance meanwhile: look again.
                    Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                    Err(error) => return Err(error),
                }
            }
            Err(error) => return Err(error),
        }
    } // End of the loop over the lock file attempts
    Err(unconfined("the lock file kept changing"))
} // End of function open_lock_file()

/// Takes an exclusive `flock(2)` lock on `file`, waiting for it, retrying a
/// wait an interrupting signal cut short.
fn lock_exclusively(file: &File) -> io::Result<()> {
    use std::os::fd::AsRawFd as _;
    loop {
        // SAFETY: `flock` takes a descriptor and an integer and touches no
        // memory of ours; `file` keeps the descriptor open for the whole call.
        let result = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) };
        if result == 0 {
            return Ok(());
        }
        let error = io::Error::last_os_error();
        if error.kind() != io::ErrorKind::Interrupted {
            return Err(error);
        }
    } // End of the loop over interrupted waits
}

/// Whether some open file description holds the lock of the sidecar directory
/// under `storage_root`, tested by trying it without waiting (and releasing it
/// at once if the try succeeded). For the tests' assertions only.
#[cfg(test)]
pub(crate) fn lock_is_held(storage_root: &Path) -> bool {
    use std::os::fd::AsRawFd as _;
    let file = File::open(storage_root.join(SIDECAR_DIRECTORY).join(LOCK_FILE))
        .expect("the lock file exists");
    // SAFETY: as in `lock_exclusively`.
    let result = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    if result == 0 {
        return false; // Dropping `file` releases the lock it just took.
    }
    let error = io::Error::last_os_error();
    assert_eq!(error.raw_os_error(), Some(libc::EWOULDBLOCK), "{error}");
    true
}

/// A file's device and inode.
fn identity(metadata: &Metadata) -> (u64, u64) {
    (metadata.dev(), metadata.ino())
}

/// The refusal of an app-owned component that is not what it must be.
fn unconfined(what: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, what)
}
