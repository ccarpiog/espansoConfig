//! The atomic file-replacement primitive: steps 1, 2 and 6–11 of the save
//! transaction.
//!
//! One function does the whole of it — [`replace_file_atomically`] — and what it
//! is, stated as precisely as POSIX allows:
//!
//! > **atomic replacement of an existing regular file, with optimistic conflict
//! > detection.** The bytes appear at the target in one indivisible step, and
//! > the call refuses unless the target still hashed to the caller's `expected`
//! > revision **at the two moments it was checked** — once before the candidate
//! > was built and once immediately before the commit.
//!
//! It is deliberately **not** described as "replaces the bytes only if the file
//! still holds what the caller believed it held". That is a compare-and-swap on
//! file contents, and **no ordinary POSIX or macOS pathname operation provides
//! one**: `rename()` replaces whatever occupies the target name at the instant
//! it runs, with no condition attached. See the residual race below, which is a
//! property of the platform and not of this code.
//!
//! Everything else in `IMPLEMENTATION_PLAN.md` section 6.6 (building the new
//! bytes, reparsing them, validating them, backups) belongs to other sub-phases
//! and is deliberately absent: this module takes finished bytes and is the only
//! place in the crate that touches a file for writing.
//!
//! # The eleven steps, and which eight are here
//!
//! | Step | Plan 6.6 | Here |
//! |---|---|---|
//! | 1 | per-path write lock | [`lock_path`] |
//! | 2 | re-read target, verify the revision | [`replace_locked_file`] |
//! | 3–5 | patch, reparse, validate | **not here** — sub-phase 2a-2 |
//! | 6 | uniquely named temp file in the same directory | [`temp_file_name`] |
//! | 7 | apply the original file's **mode bits** | [`replace_locked_file`] |
//! | 8 | flush and fsync | [`replace_locked_file`] |
//! | 9 | atomic rename, **preceded by a re-check** | [`replace_locked_file`] |
//! | 10 | sync the containing directory | [`replace_locked_file`] |
//! | 11 | re-read and hash the result | [`replace_locked_file`] |
//! | 12–13 | snapshot update, backup rotation | **not here** — 2a-2, 2a-3 |
//!
//! # The residual race
//!
//! The per-path lock excludes **only this process's cooperating callers.** Vim,
//! espanso, a cloud-sync agent and a second copy of this application do not take
//! it. So between the last check and the `rename()` there is a window in which
//! another process can replace the target, and this call will then rename over
//! that replacement and report success — the other program's write is lost.
//!
//! What this module does about it:
//!
//! - the revision is checked **twice**, the second time immediately before the
//!   rename, together with the target's **device and inode** and its type, and
//!   together with a re-resolution of the caller's own path. Any difference is
//!   [`WriteError::TargetChangedDuringWrite`], and it is a refusal that has
//!   written nothing to the target — the candidate is discarded with the temp
//!   file;
//! - the expensive part of the window — building, writing and fsyncing a whole
//!   candidate file, which is milliseconds — is therefore **outside** the
//!   remaining race. What is left is the gap between the second check and the
//!   `rename()`: a handful of syscalls, one rename wide.
//!
//! **This narrows the window. It does not close it, and it cannot be closed at
//! this layer.** A caller that needs recoverability from the residual race needs
//! backups (step 13) and a conflict-handling path, not a stronger primitive.
//!
//! # Symlinks: the target is **resolved before anything else happens**
//!
//! Espanso configurations are routinely symlinked out of a dotfiles repository,
//! and `rename()` over a symlink replaces the *symlink itself* — the link is
//! silently destroyed and the file it pointed at keeps its old contents. That is
//! hazard 9 of the plan's corruption register, and this module answers it by
//! calling [`std::fs::canonicalize`] on the caller's path **before** locking,
//! hashing or writing. Every later step then works on the real file:
//!
//! - the lock is keyed by the real path, so two spellings of one file — a
//!   relative path, a `..` segment, a symlink — take the *same* lock;
//! - the revision is verified against the real file's bytes;
//! - the temp file is created beside the real file, so the rename stays inside
//!   one filesystem even when the symlink crosses one;
//! - the symlink survives, still pointing where it pointed.
//!
//! [`PathWriteLock`] keeps the caller's original spelling and **re-resolves it
//! before the commit**, so a symlink retargeted mid-call is a refusal rather
//! than a write to a file the caller is no longer naming.
//!
//! The cost is stated rather than hidden: a caller that genuinely wanted to
//! *replace a symlink with a regular file* cannot do it through here, and a path
//! whose final component is a dangling symlink is [`WriteError::TargetMissing`]
//! rather than a file this primitive would create.
//!
//! # What it refuses
//!
//! - a target that does not exist ([`WriteError::TargetMissing`]) — **this
//!   primitive never creates a file**, which is why it can be exposed to a
//!   caller without also handing out a way to litter the config tree;
//! - a target that is not a regular file — a directory, a socket, a fifo
//!   ([`WriteError::TargetNotRegularFile`]);
//! - a target whose current bytes hash to something other than the caller's
//!   `expected` revision ([`WriteError::RevisionMismatch`], carrying both);
//! - a target that changed **while the call was running**
//!   ([`WriteError::TargetChangedDuringWrite`]).
//!
//! # Mode bits, not "permissions"
//!
//! Step 7 copies the target's **Unix mode bits** and nothing else. A temp file
//! and a rename install a *new inode*, so owner and group, POSIX ACLs, extended
//! attributes (Finder tags and every other `com.apple.*` attribute), resource
//! forks, creation time, BSD flags such as `uchg`, and hard-link relationships
//! are all **dropped**. One of those is a security property and not a cosmetic
//! one: a **denying ACL is access control that this write removes**, so the
//! result can be *more* accessible than the file it replaced even though the
//! mode bits are identical. `docs/decisions/2a-1-notes.md` section 10 records
//! this as a decision a later phase must revisit.
//!
//! The mode bits are taken by `fstat` on the **same open file descriptor** whose
//! bytes are hashed, so they cannot come from a different inode than the one the
//! revision describes.
//!
//! # Durability, exactly
//!
//! The candidate is flushed and `sync_all()`d before the rename. On Apple
//! targets `std`'s `sync_all` issues `fcntl(fd, F_FULLFSYNC)` rather than
//! `fsync` — read out of the toolchain's own source, and corroborated by its
//! cost (`2a-1-notes.md` section 6) — which asks the device to flush its
//! volatile write cache. Two caveats keep this from being an unconditional
//! power-loss claim:
//!
//! - `F_FULLFSYNC` returns `ENOTSUP` on filesystems that do not implement it and
//!   `std` does **not** fall back. That surfaces here as an [`WriteError::Io`]
//!   at [`WriteStep::SyncTempFile`], *before* the rename, so the target is
//!   untouched — a refusal, which is the acceptable failure;
//! - **the directory sync is best effort.** It is the same `sync_all` on the
//!   containing directory, it succeeds on APFS, and it costs two orders of
//!   magnitude less than the file sync, which means it is not doing the same
//!   thing. Nothing here proves the *rename* survives a power cut. Its failure
//!   mode is a silently lost save, never a corrupt file, because the old inode
//!   is intact and complete.
//!
//! # This module is unix-only, on purpose
//!
//! It uses [`std::os::unix::fs::OpenOptionsExt`] so the temp file is created
//! `0o600` and *then* widened to the target's mode, rather than created at
//! `0o666 & !umask` and narrowed afterwards. A private file must never be
//! world-readable for even the instant between the two calls. It also uses
//! [`std::os::unix::fs::MetadataExt`] for the device and inode numbers the
//! pre-commit check compares. The application is macOS-only (plan section 1), so
//! committing the core to unix here costs nothing that is not already spent.
//!
//! # No `Serialize`
//!
//! [`WriteError`] deliberately does **not** implement `serde::Serialize`, unlike
//! `crate::workspace::WorkspaceError`. Nothing crosses the IPC boundary in this
//! sub-phase, and in this repository an enum `serde` can write owes a dictionary
//! namespace in both `src/lib/i18n/{en,es}.json` — `src-tauri/src/
//! dictionary_contract.rs` fails the build otherwise. The sub-phase that exposes
//! a save command adds the strings and the `Serialize` impl together, so that a
//! code can never reach a screen with no sentence behind it.

use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::fmt;
use std::fs::{self, File, OpenOptions, Permissions};
use std::io::{self, Read, Write};
use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ContentRevision;

/// The first character of every temp file this module creates.
///
/// Espanso's default include glob is `[!_]*.yml`, whose first term excludes any
/// name starting with `_`. This is half of hazard 17's defence; the other half
/// is [`TEMP_NAME_SUFFIX`], and either alone would be enough.
pub const TEMP_NAME_PREFIX: &str = "_";

/// The infix that marks a temp file as this application's.
///
/// Present so that a stray temp file left by a crashed process is attributable
/// rather than mysterious. It is not a uniqueness device; the digits after it
/// are.
pub const TEMP_NAME_INFIX: &str = ".espansoconfig-";

/// The last characters of every temp file this module creates.
///
/// A name ending in `.tmp` is not a `.yml` file at all, so espanso's glob cannot
/// match it however the leading `_` is treated.
pub const TEMP_NAME_SUFFIX: &str = ".tmp";

/// How many times a colliding temp name is retried before giving up.
///
/// A collision needs two processes to agree on a pid, a nanosecond and a
/// counter, so one retry would do; eight costs nothing and removes the argument.
const TEMP_NAME_ATTEMPTS: usize = 8;

/// `O_NOFOLLOW` on Apple and BSD targets: open the final component itself, and
/// fail with `ELOOP` if it is a symbolic link.
///
/// Spelled out rather than taken from `libc`, which this crate does not depend
/// on. The value is the one `libc` publishes for this family
/// (`src/unix/bsd/mod.rs`), and `the_no_follow_flag_really_refuses_a_symlink`
/// pins its *meaning* rather than its number, so a wrong constant is a test
/// failure and not a silently weaker open.
#[cfg(any(target_vendor = "apple", target_os = "freebsd", target_os = "openbsd"))]
const OPEN_NO_FOLLOW: i32 = 0x100;

/// `O_NOFOLLOW` on Linux and Android.
#[cfg(any(target_os = "linux", target_os = "android"))]
const OPEN_NO_FOLLOW: i32 = 0o400_000;

/// No `O_NOFOLLOW` value is known for this target, so the flag is not requested.
///
/// The open then follows a symlink planted at the resolved path, and the
/// device/inode comparison in [`recheck_target`] is the only thing that would
/// notice. Written down rather than assumed: the guarantee is weaker here.
#[cfg(not(any(
    target_vendor = "apple",
    target_os = "freebsd",
    target_os = "openbsd",
    target_os = "linux",
    target_os = "android"
)))]
const OPEN_NO_FOLLOW: i32 = 0;

/// Builds the name of the temp file that sits beside `target_file_name`.
///
/// The shape is `_<target name>.espansoconfig-<pid>-<nanos>-<counter>.tmp`, and
/// **both** ends of it are load-bearing (plan section 6.6, hazard 17): the
/// leading `_` takes the name out of espanso's `[!_]*.yml` include glob, and the
/// `.tmp` ending means it is not a YAML file at all. A temp file picked up by
/// the daemon mid-write is a half-written configuration loaded as if it were
/// finished.
///
/// Every call returns a different name. The name is built as an [`OsString`] so
/// that a target whose name is not valid UTF-8 still gets a temp file rather
/// than a panic.
pub fn temp_file_name(target_file_name: &OsStr) -> OsString {
    /// Distinguishes two names minted in the same nanosecond by one process.
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or(0);

    let mut name = OsString::from(TEMP_NAME_PREFIX);
    name.push(target_file_name);
    name.push(TEMP_NAME_INFIX);
    name.push(format!("{:x}-{nanos:x}-{counter:x}", std::process::id()));
    name.push(TEMP_NAME_SUFFIX);
    name
} // End of function temp_file_name()

/// The registry of per-path write locks, one entry per real path ever written.
type LockRegistry = Mutex<HashMap<PathBuf, &'static Mutex<()>>>;

/// Returns the process-wide lock registry, creating it on first use.
fn registry() -> &'static LockRegistry {
    static REGISTRY: OnceLock<LockRegistry> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Locks a mutex, treating poison as "the previous holder panicked".
///
/// Every mutex in this module guards **nothing in memory** — the registry's map
/// is rebuilt-safe and a path lock guards a byte range on disk — so a panic
/// while one is held leaves no invariant broken. Propagating the poison would
/// instead make one panicked save permanently disable saving that file for the
/// life of the process, which is a worse failure than the one it warns about.
fn lock_ignoring_poison<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

/// Returns the one mutex belonging to `resolved`, creating it on first use.
///
/// The mutex is leaked deliberately. There is one per real path the process has
/// ever written, bounded by the size of a configuration tree, and leaking it is
/// what lets [`PathWriteLock`] hold a `MutexGuard<'static, ()>` without the
/// registry's own lock being held for the whole write.
///
/// The key is [`std::fs::canonicalize`]'s answer. Whether two paths differing
/// only in case land on the same key is a property of **the volume**, not of
/// `canonicalize`, whose contract promises no such normalisation:
/// `two_case_variant_spellings_share_a_lock_on_a_case_insensitive_volume`
/// measures it on the machine the test runs on, and skips where it does not
/// hold.
fn mutex_for(resolved: &Path) -> &'static Mutex<()> {
    let mut map = lock_ignoring_poison(registry());
    if let Some(existing) = map.get(resolved) {
        return existing;
    }
    let fresh: &'static Mutex<()> = Box::leak(Box::new(Mutex::new(())));
    map.insert(resolved.to_path_buf(), fresh);
    fresh
} // End of function mutex_for()

/// An exclusive, **in-process** claim on one file, keyed by its real path.
///
/// Step 1 of the save transaction, and hazard 12's defence: two windows, or two
/// threads, saving the same document serialise instead of interleaving. Released
/// on drop.
///
/// **It excludes nothing outside this process.** No other program takes this
/// lock, so it is not a defence against vim or espanso; see the module
/// documentation's residual race.
///
/// Two spellings of one file take the same lock, because the key is
/// [`std::fs::canonicalize`]'s answer rather than the caller's string. The
/// caller's own spelling is kept too, and re-resolved before the commit.
///
/// **It is not reentrant.** Calling [`replace_file_atomically`] for the same
/// path while holding one of these deadlocks; use [`replace_locked_file`], which
/// takes the lock as evidence instead of taking it again.
pub struct PathWriteLock {
    /// The canonical path this lock is keyed by.
    resolved: PathBuf,
    /// The path the caller actually named, re-resolved before the commit.
    requested: PathBuf,
    /// The claim itself. Held for the lifetime of the value, never read.
    _guard: MutexGuard<'static, ()>,
}

impl PathWriteLock {
    /// The canonical path this lock covers — symlinks resolved, `.` and `..`
    /// removed.
    ///
    /// This, not the caller's argument, is the path that will be written.
    pub fn path(&self) -> &Path {
        &self.resolved
    }

    /// The path the caller named, before resolution.
    ///
    /// Kept so that a symlink retargeted while the call runs can be detected:
    /// [`replace_locked_file`] re-resolves this immediately before the commit
    /// and refuses if it no longer names [`PathWriteLock::path`].
    pub fn requested_path(&self) -> &Path {
        &self.requested
    }
}

impl fmt::Debug for PathWriteLock {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("PathWriteLock")
            .field("resolved", &self.resolved)
            .field("requested", &self.requested)
            .finish()
    }
}

/// Resolves `path` to the real file it names, or says why it cannot.
///
/// This is where the symlink decision is executed: [`std::fs::canonicalize`]
/// follows every link in the path, so everything downstream operates on the file
/// rather than on a pointer to it.
fn resolve_target(path: &Path) -> Result<PathBuf, WriteError> {
    match fs::canonicalize(path) {
        Ok(resolved) => Ok(resolved),
        // A dangling symlink lands here too, and is deliberately reported as a
        // missing target: this primitive replaces files and creates none.
        Err(error) if error.kind() == io::ErrorKind::NotFound => Err(WriteError::TargetMissing {
            path: path.to_path_buf(),
        }),
        Err(error) => Err(WriteError::Io {
            step: WriteStep::ResolveTarget,
            path: path.to_path_buf(),
            source: error,
        }),
    }
} // End of function resolve_target()

/// Takes the write lock for the real file `path` names (step 1).
///
/// Blocks until any other holder in **this process** releases. Fails only when
/// the path cannot be resolved — a missing target, a dangling symlink, a symlink
/// loop, an unreadable parent directory.
pub fn lock_path(path: &Path) -> Result<PathWriteLock, WriteError> {
    let resolved = resolve_target(path)?;
    let mutex = mutex_for(&resolved);
    let guard = lock_ignoring_poison(mutex);
    Ok(PathWriteLock {
        resolved,
        requested: path.to_path_buf(),
        _guard: guard,
    })
}

/// Replaces the contents of an existing file **atomically**, with optimistic
/// conflict detection.
///
/// Takes the per-path write lock, verifies that the file still hashes to
/// `expected`, writes `bytes` to a temp file, re-verifies the target immediately
/// before committing, and renames. Returns the [`ContentRevision`] of the bytes
/// verified to be on disk afterwards, which a caller keeps as its new base
/// revision and as the hash to ignore when the watcher reports the change it
/// just caused (plan section 6.5, step 4).
///
/// The replacement is atomic: no reader ever sees a partial file. The conflict
/// detection is **optimistic, not a compare-and-swap** — see the module
/// documentation's residual race for the window that remains and why it cannot
/// be removed at this layer.
///
/// `path` may be relative, may contain `.` or `..`, and may be a symlink; it is
/// canonicalised first and the **real** file is the one written.
///
/// Nothing about `bytes` is inspected. They are not parsed, not validated and
/// not compared against the previous contents — that is sub-phase 2a-2's work,
/// and calling this directly with unvalidated bytes writes them.
pub fn replace_file_atomically(
    path: &Path,
    expected: ContentRevision,
    bytes: &[u8],
) -> Result<ContentRevision, WriteError> {
    let lock = lock_path(path)?;
    replace_locked_file(&lock, expected, bytes)
}

/// [`replace_file_atomically`] for a caller that already holds the lock.
///
/// The save transaction has to hold the lock across steps 2 to 11 — the whole
/// point of step 1 is that no *cooperating* writer touches the file between the
/// revision check and the rename — so the patch-and-validate steps that will sit
/// between them need a way in that does not take the lock a second time and
/// deadlock.
///
/// Performs steps 2 and 6 to 11 against [`PathWriteLock::path`].
pub fn replace_locked_file(
    lock: &PathWriteLock,
    expected: ContentRevision,
    bytes: &[u8],
) -> Result<ContentRevision, WriteError> {
    let target = lock.path();

    // Step 2: one open, one `fstat` on that descriptor, one read from that same
    // descriptor. Taking the mode bits and the bytes from a single file
    // description is what makes them provably the same inode — a `metadata()`
    // call on the path followed by a `read()` on the path can straddle a
    // replacement and copy inode A's mode onto inode B's contents.
    let inspected = inspect_target(target)?;
    let found = ContentRevision::of_bytes(&inspected.bytes);
    if found != expected {
        return Err(WriteError::RevisionMismatch {
            path: target.to_path_buf(),
            expected,
            found,
        });
    }

    // The filesystem root has no parent and is a directory, so it was refused
    // inside `inspect_target`; this arm exists so the happy path never unwraps.
    let (Some(directory), Some(file_name)) = (target.parent(), target.file_name()) else {
        return Err(WriteError::TargetNotRegularFile {
            path: target.to_path_buf(),
        });
    };

    let intended = ContentRevision::of_bytes(bytes);
    write_through_temp_file(lock, directory, file_name, bytes, &inspected, expected)?;

    // Step 11: hazard 5's shape applied to the bytes rather than to the model.
    // The file is read back from disk and hashed, so a write that was silently
    // short, or a rename that landed somewhere else, is an error rather than a
    // success.
    let written = fs::read(target).map_err(|error| WriteError::Io {
        step: WriteStep::ReadBack,
        path: target.to_path_buf(),
        source: error,
    })?;
    let observed = ContentRevision::of_bytes(&written);
    if observed != intended {
        return Err(WriteError::VerificationFailed {
            path: target.to_path_buf(),
            expected: intended,
            found: observed,
        });
    }
    Ok(observed)
} // End of function replace_locked_file()

/// What one open of the target established: which inode it is, what mode bits it
/// carries and what bytes it holds.
///
/// All three come from **one file description**, so they cannot describe
/// different inodes.
struct InspectedTarget {
    /// Device and inode number, for the pre-commit identity comparison.
    identity: (u64, u64),
    /// The mode bits step 7 copies. Nothing else about the inode is captured;
    /// see the module documentation.
    mode: Permissions,
    /// The bytes the revision is computed from.
    bytes: Vec<u8>,
}

/// Opens the target once and reads everything the transaction needs from it.
///
/// `O_NOFOLLOW` means the final component is opened as itself: a symlink planted
/// at the resolved path is `ELOOP`, not a second dereference. The type check
/// then rejects a directory, a fifo, a socket or a device.
fn inspect_target(target: &Path) -> Result<InspectedTarget, WriteError> {
    let mut handle = OpenOptions::new()
        .read(true)
        .custom_flags(OPEN_NO_FOLLOW)
        .open(target)
        .map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => WriteError::TargetMissing {
                path: target.to_path_buf(),
            },
            _ => WriteError::Io {
                step: WriteStep::InspectTarget,
                path: target.to_path_buf(),
                source: error,
            },
        })?;
    let metadata = handle.metadata().map_err(|error| WriteError::Io {
        step: WriteStep::InspectTarget,
        path: target.to_path_buf(),
        source: error,
    })?;
    if !metadata.is_file() {
        return Err(WriteError::TargetNotRegularFile {
            path: target.to_path_buf(),
        });
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    handle
        .read_to_end(&mut bytes)
        .map_err(|error| WriteError::Io {
            step: WriteStep::ReadTarget,
            path: target.to_path_buf(),
            source: error,
        })?;
    Ok(InspectedTarget {
        identity: (metadata.dev(), metadata.ino()),
        mode: metadata.permissions(),
        bytes,
    })
} // End of function inspect_target()

/// Steps 6 to 10: temp file, mode bits, fsync, the pre-commit re-check, rename,
/// directory sync.
///
/// Split out of [`replace_locked_file`] so that the [`TempFile`] guard's scope
/// is exactly the window in which a temp file exists. Every `?` below returns
/// through that scope, so a normal return and an unwind both delete it.
fn write_through_temp_file(
    lock: &PathWriteLock,
    directory: &Path,
    file_name: &OsStr,
    bytes: &[u8],
    inspected: &InspectedTarget,
    expected: ContentRevision,
) -> Result<(), WriteError> {
    let target = lock.path();

    // Step 6: a uniquely named temp file in the same directory as the target,
    // because `rename()` is only atomic within one filesystem.
    let (mut handle, guard) = create_temp_file(directory, file_name)?;

    // Step 7: hazard 11, half of it. The temp file was created 0o600 and is
    // widened here, never narrowed, so a private file is never briefly readable
    // by anyone else. Mode bits only — the module documentation lists what a new
    // inode drops.
    fs::set_permissions(guard.path(), inspected.mode.clone()).map_err(|error| WriteError::Io {
        step: WriteStep::ApplyModeBits,
        path: guard.path().to_path_buf(),
        source: error,
    })?;

    // Step 8: the bytes, then fsync. Without the fsync a crash between the
    // rename and the flush leaves the target naming an empty or half-written
    // inode — hazard 2 in its subtler form.
    handle.write_all(bytes).map_err(|error| WriteError::Io {
        step: WriteStep::WriteTempFile,
        path: guard.path().to_path_buf(),
        source: error,
    })?;
    handle.flush().map_err(|error| WriteError::Io {
        step: WriteStep::WriteTempFile,
        path: guard.path().to_path_buf(),
        source: error,
    })?;
    handle.sync_all().map_err(|error| WriteError::Io {
        step: WriteStep::SyncTempFile,
        path: guard.path().to_path_buf(),
        source: error,
    })?;
    drop(handle);

    // The last thing before the commit: is the target still the object we
    // inspected, still holding the bytes the caller based this edit on, and
    // still what the caller's own path names? Everything expensive has already
    // happened, so what is left racing is one rename's width.
    recheck_target(lock, inspected.identity, expected)?;

    // Step 9: the commit. After this line the target holds the new bytes.
    fs::rename(guard.path(), target).map_err(|error| WriteError::Io {
        step: WriteStep::Rename,
        path: guard.path().to_path_buf(),
        source: error,
    })?;
    guard.disarm();

    // Step 10: the rename is a directory modification and needs its own sync,
    // or a crash can leave the directory entry still naming the old inode. Best
    // effort; see the module documentation.
    let opened = File::open(directory).map_err(|error| WriteError::Io {
        step: WriteStep::SyncDirectory,
        path: directory.to_path_buf(),
        source: error,
    })?;
    opened.sync_all().map_err(|error| WriteError::Io {
        step: WriteStep::SyncDirectory,
        path: directory.to_path_buf(),
        source: error,
    })?;
    Ok(())
} // End of function write_through_temp_file()

/// The check immediately before the commit, and the whole of what narrows the
/// residual race.
///
/// Three questions, in the order a difference is cheapest to detect:
///
/// 1. does the **caller's own path** still resolve to this target? A symlink
///    retargeted mid-call fails here;
/// 2. is the target still the same **inode**, and still a regular file? A
///    replacement by another process fails here even when its contents happen to
///    hash the same;
/// 3. does it still hash to `expected`? An in-place edit by another process
///    fails here.
///
/// A failure is [`WriteError::TargetChangedDuringWrite`] and **nothing has been
/// written to the target**: the candidate is still a temp file, and the guard
/// deletes it on the way out.
///
/// The cost is a second full read of the target. For an espanso configuration
/// that is kilobytes, and it buys the difference between a race the width of a
/// whole file write and a race the width of one rename.
fn recheck_target(
    lock: &PathWriteLock,
    identity: (u64, u64),
    expected: ContentRevision,
) -> Result<(), WriteError> {
    let target = lock.path();

    match fs::canonicalize(lock.requested_path()) {
        Ok(now) if now == target => {}
        Ok(now) => {
            return Err(WriteError::TargetChangedDuringWrite {
                path: target.to_path_buf(),
                difference: TargetDifference::Retargeted { now },
            })
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Err(WriteError::TargetChangedDuringWrite {
                path: target.to_path_buf(),
                difference: TargetDifference::Vanished,
            })
        }
        Err(error) => {
            return Err(WriteError::Io {
                step: WriteStep::RecheckTarget,
                path: lock.requested_path().to_path_buf(),
                source: error,
            })
        }
    }

    let now = match inspect_target(target) {
        Ok(now) => now,
        Err(WriteError::TargetMissing { .. }) => {
            return Err(WriteError::TargetChangedDuringWrite {
                path: target.to_path_buf(),
                difference: TargetDifference::Vanished,
            })
        }
        Err(WriteError::TargetNotRegularFile { .. }) => {
            return Err(WriteError::TargetChangedDuringWrite {
                path: target.to_path_buf(),
                difference: TargetDifference::Identity,
            })
        }
        Err(WriteError::Io { source, .. }) => {
            return Err(WriteError::Io {
                step: WriteStep::RecheckTarget,
                path: target.to_path_buf(),
                source,
            })
        }
        Err(other) => return Err(other),
    };
    if now.identity != identity {
        return Err(WriteError::TargetChangedDuringWrite {
            path: target.to_path_buf(),
            difference: TargetDifference::Identity,
        });
    }
    let found = ContentRevision::of_bytes(&now.bytes);
    if found != expected {
        return Err(WriteError::TargetChangedDuringWrite {
            path: target.to_path_buf(),
            difference: TargetDifference::Contents { expected, found },
        });
    }
    Ok(())
} // End of function recheck_target()

/// Creates the temp file, retrying a name collision (step 6).
///
/// Returns the open handle and the guard that will delete it. The file is opened
/// with `create_new`, so a name that already exists is never truncated: the loop
/// mints another one.
fn create_temp_file(directory: &Path, file_name: &OsStr) -> Result<(File, TempFile), WriteError> {
    let mut last: Option<io::Error> = None;
    for _ in 0..TEMP_NAME_ATTEMPTS {
        let candidate = directory.join(temp_file_name(file_name));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&candidate)
        {
            Ok(handle) => return Ok((handle, TempFile::arming(candidate))),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => last = Some(error),
            Err(error) => {
                return Err(WriteError::Io {
                    step: WriteStep::CreateTempFile,
                    path: candidate,
                    source: error,
                })
            }
        }
    } // End of the loop over temp-name attempts
    Err(WriteError::Io {
        step: WriteStep::CreateTempFile,
        path: directory.to_path_buf(),
        source: last
            .unwrap_or_else(|| io::Error::new(io::ErrorKind::AlreadyExists, "temp name collision")),
    })
} // End of function create_temp_file()

/// An RAII claim on a temp file: deleting it is **attempted** when this value is
/// dropped.
///
/// The guard rather than a cleanup call, because the paths a temp file must not
/// survive are precisely the paths a cleanup call at the end of the function is
/// not on — an early `?`, a refusal, an unwinding panic.
///
/// **What this does and does not guarantee.** Cleanup is attempted on a normal
/// return and on an unwind. It does **not** happen if the process is killed, if
/// it aborts, or under `panic = "abort"`; and a failing `remove_file` is
/// swallowed rather than escalated. So a temp file *can* be left behind. What
/// makes that harmless is the **name**, not the guard: a leftover cannot be
/// matched by espanso's include glob and is attributable to this application
/// (see [`temp_file_name`]). The guard is hygiene; the name is the safety
/// property.
///
/// [`TempFile::disarm`] is called exactly once, immediately after a successful
/// rename, at which point the name no longer refers to anything.
struct TempFile {
    /// Where the temp file is.
    path: PathBuf,
    /// Whether dropping should still try to delete it.
    armed: bool,
}

impl TempFile {
    /// Takes ownership of a temp file that exists and should not outlive the
    /// call.
    fn arming(path: PathBuf) -> TempFile {
        TempFile { path, armed: true }
    }

    /// Where the temp file is.
    fn path(&self) -> &Path {
        &self.path
    }

    /// Gives up ownership, because the rename consumed the name.
    fn disarm(mut self) {
        self.armed = false;
    }
}

impl Drop for TempFile {
    /// Attempts to delete the temp file unless it was renamed away.
    ///
    /// A failure to delete is swallowed: it can only mean the file is already
    /// gone or the directory became unwritable, and neither is worth a panic in
    /// a destructor. The leftover is harmless because of its name.
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_file(&self.path);
        }
    }
}

/// Which step of the save transaction an I/O failure happened on.
///
/// Carried by [`WriteError::Io`] so a caller can tell the steps apart **without
/// parsing a sentence** — the crate's rule is codes and structured data, never
/// prose (plan section 9). It also answers the only question that changes what a
/// caller should do next: has this call's rename already happened? See
/// [`WriteStep::after_rename`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum WriteStep {
    /// Step 1: canonicalising the caller's path.
    ResolveTarget,
    /// Step 2: opening the target and reading its metadata.
    InspectTarget,
    /// Step 2: reading the target's bytes for the revision check.
    ReadTarget,
    /// Step 6: creating the temp file.
    CreateTempFile,
    /// Step 7: copying the target's mode bits onto the temp file.
    ApplyModeBits,
    /// Step 8: writing the bytes into the temp file.
    WriteTempFile,
    /// Step 8: `fsync` on the temp file.
    SyncTempFile,
    /// Step 9, immediately before the commit: re-resolving the caller's path and
    /// re-reading the target to confirm nothing changed under the write.
    RecheckTarget,
    /// Step 9: renaming the temp file over the target.
    Rename,
    /// Step 10: `fsync` on the containing directory.
    SyncDirectory,
    /// Step 11: reading the target back for verification.
    ReadBack,
}

impl WriteStep {
    /// Whether **this call's** rename had already committed when the step
    /// failed.
    ///
    /// `false` means this call did not replace the target. `true` means this
    /// call's new bytes reached the target and only their durability or their
    /// verification is in doubt.
    ///
    /// Neither answer is a statement about what the target holds *now*: another
    /// process can have written it since. See [`WriteError::may_have_written`].
    pub fn after_rename(self) -> bool {
        matches!(self, WriteStep::SyncDirectory | WriteStep::ReadBack)
    }

    /// A stable lowercase identifier, for logs and test output.
    pub fn code(self) -> &'static str {
        match self {
            WriteStep::ResolveTarget => "resolveTarget",
            WriteStep::InspectTarget => "inspectTarget",
            WriteStep::ReadTarget => "readTarget",
            WriteStep::CreateTempFile => "createTempFile",
            WriteStep::ApplyModeBits => "applyModeBits",
            WriteStep::WriteTempFile => "writeTempFile",
            WriteStep::SyncTempFile => "syncTempFile",
            WriteStep::RecheckTarget => "recheckTarget",
            WriteStep::Rename => "rename",
            WriteStep::SyncDirectory => "syncDirectory",
            WriteStep::ReadBack => "readBack",
        }
    } // End of function code()
}

impl fmt::Display for WriteStep {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// How the target differed, at the pre-commit re-check, from the object that was
/// inspected at step 2.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TargetDifference {
    /// The caller's own path no longer resolves to the locked target — a
    /// symlink was retargeted while the call ran.
    Retargeted {
        /// What the caller's path resolves to now.
        now: PathBuf,
    },
    /// The target no longer exists.
    Vanished,
    /// The directory entry names a different inode, or is no longer a regular
    /// file. **The contents may hash the same**; this is the case a revision
    /// comparison alone cannot see.
    Identity,
    /// The same inode now holds different bytes — an in-place edit by another
    /// process.
    Contents {
        /// The revision the caller based its edit on.
        expected: ContentRevision,
        /// The revision the file holds now.
        found: ContentRevision,
    },
}

impl fmt::Display for TargetDifference {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TargetDifference::Retargeted { now } => {
                write!(formatter, "the path now resolves to {}", now.display())
            }
            TargetDifference::Vanished => formatter.write_str("the target no longer exists"),
            TargetDifference::Identity => formatter.write_str("the target is a different object"),
            TargetDifference::Contents { expected, found } => {
                write!(formatter, "the contents became {found}, not {expected}")
            }
        }
    } // End of function fmt() for TargetDifference
}

/// Everything the write primitive can refuse or fail on.
///
/// Codes plus structured data, never prose. The `Display` impl exists for logs,
/// panics and test output, exactly as in `crate::syntax::error`.
///
/// The five refusals are distinguishable by variant, and the sixth variant
/// carries a [`WriteStep`] rather than a formatted sentence, so a caller decides
/// what to do next without reading English.
#[derive(Debug)]
pub enum WriteError {
    /// The target does not exist, or is a symlink pointing at nothing.
    ///
    /// **Never** an instruction to create it: this primitive replaces files and
    /// creates none.
    TargetMissing {
        /// The path as the caller spelled it, since there is nothing to resolve.
        path: PathBuf,
    },
    /// The target exists but is a directory, a socket, a device or a fifo.
    TargetNotRegularFile {
        /// The resolved path.
        path: PathBuf,
    },
    /// The file had **already** changed when the call started. Nothing was
    /// written.
    ///
    /// Hazard 1: the defence against overwriting an edit made in another editor
    /// after this application loaded the file. It means the caller's document
    /// was stale before the save began, so the right response is to reload and
    /// re-apply the edit.
    RevisionMismatch {
        /// The resolved path.
        path: PathBuf,
        /// The revision the caller based its edit on.
        expected: ContentRevision,
        /// The revision the file actually holds now.
        found: ContentRevision,
    },
    /// The file changed **while this call was running**. Nothing was written.
    ///
    /// Deliberately not folded into [`WriteError::RevisionMismatch`], for two
    /// reasons. It is a different fact about the user's world — some other
    /// program is writing this file *right now*, which is worth saying and is
    /// not a stale-document problem — and it covers a case a revision comparison
    /// cannot express at all: the inode changed while the bytes stayed identical
    /// ([`TargetDifference::Identity`]).
    TargetChangedDuringWrite {
        /// The resolved path.
        path: PathBuf,
        /// What differed.
        difference: TargetDifference,
    },
    /// The bytes read back after the rename are not the bytes that were written.
    ///
    /// Step 11 failing means the rename committed and then something else
    /// changed the file, or the filesystem did not store what it accepted.
    /// Either way the target's contents are **unknown to the caller** and must
    /// be re-read.
    VerificationFailed {
        /// The resolved path.
        path: PathBuf,
        /// The revision of the bytes this call intended to write.
        expected: ContentRevision,
        /// The revision of the bytes found on disk afterwards.
        found: ContentRevision,
    },
    /// The filesystem refused an operation.
    Io {
        /// Which step failed. [`WriteStep::after_rename`] says whether this
        /// call's rename had already committed.
        step: WriteStep,
        /// The path the failing operation was addressing — the target, the temp
        /// file or the containing directory, depending on the step.
        path: PathBuf,
        /// The underlying error.
        source: io::Error,
    },
}

impl WriteError {
    /// The path the failure is about.
    pub fn path(&self) -> &Path {
        match self {
            WriteError::TargetMissing { path }
            | WriteError::TargetNotRegularFile { path }
            | WriteError::RevisionMismatch { path, .. }
            | WriteError::TargetChangedDuringWrite { path, .. }
            | WriteError::VerificationFailed { path, .. }
            | WriteError::Io { path, .. } => path,
        }
    }

    /// Whether **this call's** rename may have completed.
    ///
    /// `false` for every refusal — a refusal renames nothing — and for any I/O
    /// failure before the commit. `true` for [`WriteError::VerificationFailed`]
    /// and for an [`WriteError::Io`] whose step is [`WriteStep::after_rename`].
    ///
    /// **It is not a statement about what the target holds now.** `false` does
    /// not mean the target still holds `expected`, and `true` does not mean it
    /// currently holds the new bytes: another process can have written it either
    /// way. The target must be re-read whenever external writers are possible,
    /// which for an espanso configuration is always.
    pub fn may_have_written(&self) -> bool {
        match self {
            WriteError::TargetMissing { .. }
            | WriteError::TargetNotRegularFile { .. }
            | WriteError::RevisionMismatch { .. }
            | WriteError::TargetChangedDuringWrite { .. } => false,
            WriteError::VerificationFailed { .. } => true,
            WriteError::Io { step, .. } => step.after_rename(),
        }
    } // End of function may_have_written()
}

impl fmt::Display for WriteError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WriteError::TargetMissing { path } => {
                write!(formatter, "no file to replace at {}", path.display())
            }
            WriteError::TargetNotRegularFile { path } => {
                write!(formatter, "not a regular file: {}", path.display())
            }
            WriteError::RevisionMismatch {
                path,
                expected,
                found,
            } => write!(
                formatter,
                "{} changed before the write: expected {expected}, found {found}",
                path.display()
            ),
            WriteError::TargetChangedDuringWrite { path, difference } => write!(
                formatter,
                "{} changed during the write: {difference}",
                path.display()
            ),
            WriteError::VerificationFailed {
                path,
                expected,
                found,
            } => write!(
                formatter,
                "{} verified as {found} after writing {expected}",
                path.display()
            ),
            WriteError::Io { step, path, source } => {
                write!(formatter, "{step} failed on {}: {source}", path.display())
            }
        }
    } // End of function fmt() for WriteError
}

impl std::error::Error for WriteError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            WriteError::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt as _;

    #[test]
    fn a_temp_name_cannot_be_matched_by_espansos_include_glob() {
        let name = temp_file_name(OsStr::new("base.yml"));
        let text = name.to_str().expect("the name is UTF-8 here");
        assert!(
            text.starts_with('_'),
            "{text} must start with an underscore"
        );
        assert!(text.ends_with(".tmp"), "{text} must end in .tmp");
        assert!(!text.ends_with(".yml"), "{text} must not end in .yml");
        assert!(text.contains("base.yml"), "{text} must name its target");
    }

    #[test]
    fn every_temp_name_differs_from_the_last() {
        let mut seen = std::collections::BTreeSet::new();
        for _ in 0..1000 {
            assert!(seen.insert(temp_file_name(OsStr::new("base.yml"))));
        }
    }

    #[test]
    fn an_armed_guard_deletes_its_file_and_a_disarmed_one_does_not() {
        let directory = tempfile::tempdir().expect("a temp directory");

        let armed_path = directory.path().join("_armed.tmp");
        fs::write(&armed_path, b"x").expect("write");
        drop(TempFile::arming(armed_path.clone()));
        assert!(!armed_path.exists(), "an armed guard must delete its file");

        let kept_path = directory.path().join("_kept.tmp");
        fs::write(&kept_path, b"x").expect("write");
        TempFile::arming(kept_path.clone()).disarm();
        assert!(kept_path.exists(), "a disarmed guard must leave its file");
    } // End of function an_armed_guard_deletes_its_file_and_a_disarmed_one_does_not()

    #[test]
    fn a_guard_still_deletes_when_the_stack_unwinds() {
        // `TempFile`'s documentation claims "normal return *and* unwinding". The
        // second half needs a panic to be shown at all.
        let directory = tempfile::tempdir().expect("a temp directory");
        let path = directory.path().join("_unwound.tmp");
        fs::write(&path, b"x").expect("write");

        let doomed = path.clone();
        let outcome = std::panic::catch_unwind(move || {
            let _guard = TempFile::arming(doomed);
            panic!("the failure the guard has to survive");
        });

        assert!(outcome.is_err(), "the panic must actually have happened");
        assert!(!path.exists(), "an unwind must still delete the temp file");
    } // End of function a_guard_still_deletes_when_the_stack_unwinds()

    #[test]
    fn only_the_two_post_rename_steps_report_a_possible_write() {
        let after: Vec<WriteStep> = [
            WriteStep::ResolveTarget,
            WriteStep::InspectTarget,
            WriteStep::ReadTarget,
            WriteStep::CreateTempFile,
            WriteStep::ApplyModeBits,
            WriteStep::WriteTempFile,
            WriteStep::SyncTempFile,
            WriteStep::RecheckTarget,
            WriteStep::Rename,
            WriteStep::SyncDirectory,
            WriteStep::ReadBack,
        ]
        .into_iter()
        .filter(|step| step.after_rename())
        .collect();
        assert_eq!(after, vec![WriteStep::SyncDirectory, WriteStep::ReadBack]);
    } // End of function only_the_two_post_rename_steps_report_a_possible_write()

    #[test]
    fn two_spellings_of_one_path_share_a_mutex() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join("base.yml");
        fs::write(&target, b"matches: []\n").expect("write");
        fs::create_dir(directory.path().join("sub")).expect("mkdir");

        let direct = resolve_target(&target).expect("resolves");
        let indirect = resolve_target(&directory.path().join("sub").join("..").join("base.yml"))
            .expect("resolves");
        assert_eq!(direct, indirect);
        assert!(std::ptr::eq(mutex_for(&direct), mutex_for(&indirect)));
    } // End of function two_spellings_of_one_path_share_a_mutex()

    #[test]
    fn two_case_variant_spellings_share_a_lock_on_a_case_insensitive_volume() {
        // The claim is about **the volume**, not about `canonicalize`, whose
        // contract promises no case folding. So the property is measured and the
        // test skips where it does not hold, rather than being asserted.
        let directory = tempfile::tempdir().expect("a temp directory");
        let stored = directory.path().join("Base.yml");
        fs::write(&stored, b"matches: []\n").expect("write");

        let shouted = directory.path().join("BASE.YML");
        let Ok(folded) = resolve_target(&shouted) else {
            println!(
                "SKIP two_case_variant_spellings_share_a_lock_on_a_case_insensitive_volume: \
                 this volume is case-sensitive, so the two names are two files"
            );
            return;
        };
        let canonical = resolve_target(&stored).expect("resolves");
        assert_eq!(
            folded, canonical,
            "the volume folded the case, so both spellings must key one lock"
        );
        assert!(std::ptr::eq(mutex_for(&folded), mutex_for(&canonical)));
    } // End of function two_case_variant_spellings_share_a_lock_on_a_case_insensitive_volume()

    #[test]
    fn the_no_follow_flag_really_refuses_a_symlink() {
        // `OPEN_NO_FOLLOW` is a hand-written syscall constant, so its *meaning*
        // is pinned rather than its number. A wrong value makes this fail
        // instead of silently weakening `inspect_target`.
        let directory = tempfile::tempdir().expect("a temp directory");
        let real = directory.path().join("base.yml");
        fs::write(&real, b"matches: []\n").expect("write");
        let link = directory.path().join("link.yml");
        std::os::unix::fs::symlink(&real, &link).expect("symlink");

        assert!(
            OpenOptions::new().read(true).open(&link).is_ok(),
            "a plain open follows the link, so the flag is what makes the difference"
        );

        let error = OpenOptions::new()
            .read(true)
            .custom_flags(OPEN_NO_FOLLOW)
            .open(&link)
            .expect_err("O_NOFOLLOW must refuse a symlink");
        assert_eq!(
            error.raw_os_error(),
            Some(62),
            "expected ELOOP (62 on Darwin), got {error:?}"
        );
    } // End of function the_no_follow_flag_really_refuses_a_symlink()

    /// A directory, a target holding `ORIGINAL`, and a lock on it.
    ///
    /// The re-check tests all need the same three, and they need the lock alive
    /// while they mutate the file behind it.
    fn locked_fixture() -> (tempfile::TempDir, PathBuf, PathWriteLock, ContentRevision) {
        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join("base.yml");
        fs::write(&target, RECHECK_ORIGINAL).expect("write");
        let lock = lock_path(&target).expect("resolves");
        (
            directory,
            target,
            lock,
            ContentRevision::of_bytes(RECHECK_ORIGINAL),
        )
    } // End of function locked_fixture()

    /// Neutral YAML the re-check tests start from.
    const RECHECK_ORIGINAL: &[u8] = b"matches:\n  - trigger: ':one'\n";

    #[test]
    fn the_recheck_accepts_a_target_nothing_touched() {
        let (_directory, target, lock, expected) = locked_fixture();
        let identity = inspect_target(&target).expect("inspects").identity;
        recheck_target(&lock, identity, expected).expect("an untouched target passes");
    }

    #[test]
    fn the_recheck_refuses_a_target_replaced_by_another_inode_with_identical_bytes() {
        // The case a revision comparison **cannot** see, and the reason the
        // device/inode pair is compared at all: another process replaced the
        // file, and the bytes happen to be the same.
        let (directory, target, lock, expected) = locked_fixture();
        let identity = inspect_target(&target).expect("inspects").identity;

        let twin = directory.path().join("_twin.tmp");
        fs::write(&twin, RECHECK_ORIGINAL).expect("write");
        fs::rename(&twin, &target).expect("rename");

        assert_eq!(
            fs::read(&target).expect("readable"),
            RECHECK_ORIGINAL,
            "the bytes are identical, so only the identity check can notice"
        );
        let error = recheck_target(&lock, identity, expected).expect_err("must refuse");
        assert!(
            matches!(
                error,
                WriteError::TargetChangedDuringWrite {
                    difference: TargetDifference::Identity,
                    ..
                }
            ),
            "expected an identity change, got {error}"
        );
        assert!(!error.may_have_written());
    } // End of function the_recheck_refuses_a_target_replaced_by_another_inode_with_identical_bytes()

    #[test]
    fn the_recheck_refuses_a_target_edited_in_place() {
        let (_directory, target, lock, expected) = locked_fixture();
        let identity = inspect_target(&target).expect("inspects").identity;

        // `fs::write` truncates the existing inode, so the identity is unchanged
        // and only the hash differs.
        fs::write(&target, b"matches:\n  - trigger: ':vim'\n").expect("the in-place edit");
        assert_eq!(
            inspect_target(&target).expect("inspects").identity,
            identity,
            "an in-place write must keep the inode, or this test is measuring the other check"
        );

        let error = recheck_target(&lock, identity, expected).expect_err("must refuse");
        match error {
            WriteError::TargetChangedDuringWrite {
                difference: TargetDifference::Contents { expected: e, found },
                ..
            } => {
                assert_eq!(e, expected);
                assert_eq!(
                    found,
                    ContentRevision::of_bytes(b"matches:\n  - trigger: ':vim'\n")
                );
            }
            other => panic!("expected a contents change, got {other}"),
        }
    } // End of function the_recheck_refuses_a_target_edited_in_place()

    #[test]
    fn the_recheck_refuses_a_target_that_vanished() {
        let (_directory, target, lock, expected) = locked_fixture();
        let identity = inspect_target(&target).expect("inspects").identity;
        fs::remove_file(&target).expect("the deletion");

        let error = recheck_target(&lock, identity, expected).expect_err("must refuse");
        assert!(
            matches!(
                error,
                WriteError::TargetChangedDuringWrite {
                    difference: TargetDifference::Vanished,
                    ..
                }
            ),
            "expected a vanished target, got {error}"
        );
    } // End of function the_recheck_refuses_a_target_that_vanished()

    #[test]
    fn the_recheck_refuses_a_symlink_retargeted_while_the_call_ran() {
        // The reviewer's medium finding, pinned: the caller named a link, and
        // the link now points somewhere else. Writing the old referent would
        // report success for a file the caller is no longer naming.
        let directory = tempfile::tempdir().expect("a temp directory");
        let first = directory.path().join("first.yml");
        let second = directory.path().join("second.yml");
        fs::write(&first, RECHECK_ORIGINAL).expect("write");
        fs::write(&second, RECHECK_ORIGINAL).expect("write");
        let link = directory.path().join("link.yml");
        std::os::unix::fs::symlink(&first, &link).expect("symlink");

        let lock = lock_path(&link).expect("resolves");
        let expected = ContentRevision::of_bytes(RECHECK_ORIGINAL);
        let identity = inspect_target(lock.path()).expect("inspects").identity;

        fs::remove_file(&link).expect("unlink");
        std::os::unix::fs::symlink(&second, &link).expect("the retarget");

        let error = recheck_target(&lock, identity, expected).expect_err("must refuse");
        match error {
            WriteError::TargetChangedDuringWrite {
                difference: TargetDifference::Retargeted { ref now },
                ..
            } => assert_eq!(now, &fs::canonicalize(&second).expect("canonical")),
            other => panic!("expected a retarget, got {other}"),
        }
    } // End of function the_recheck_refuses_a_symlink_retargeted_while_the_call_ran()

    #[test]
    fn the_inspection_reads_mode_and_bytes_from_one_descriptor() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join("base.yml");
        fs::write(&target, b"matches: []\n").expect("write");
        let mut mode = fs::metadata(&target).expect("metadata").permissions();
        mode.set_mode(0o640);
        fs::set_permissions(&target, mode).expect("chmod");

        let inspected = inspect_target(&target).expect("inspects");
        assert_eq!(inspected.bytes, b"matches: []\n");
        assert_eq!(inspected.mode.mode() & 0o7777, 0o640);
        let metadata = fs::metadata(&target).expect("metadata");
        assert_eq!(inspected.identity, (metadata.dev(), metadata.ino()));
    } // End of function the_inspection_reads_mode_and_bytes_from_one_descriptor()
}
