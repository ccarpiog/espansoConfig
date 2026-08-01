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
//! | 6 | uniquely named temp file in the same directory, `0o600` | [`temp_file_name`] |
//! | 8 | the bytes, then flush and fsync | `write_through_temp_file` |
//! | 7a | copy the original file's **ACL and extended attributes** | `copy_metadata` |
//! | 7b | apply the original file's **mode bits**, then fsync again | `write_through_temp_file` |
//! | 9 | atomic rename, **preceded by two re-checks** | [`replace_locked_file`] |
//! | 10 | sync the containing directory | [`replace_locked_file`] |
//! | 11 | re-read and hash the result | [`replace_locked_file`] |
//! | 12–13 | snapshot update, backup rotation | **not here** — 2a-2, 2a-3 |
//!
//! **Step 8 runs before step 7, and that is deliberate.** The plan numbers the
//! metadata copy 7 and the write 8; this module executes them the other way
//! round, because the temp file is only widened from `0o600` to the target's
//! mode **after** its final bytes are on disk. There is then no instant in which
//! a legitimate reader of the target's mode — someone the mode bits admit — can
//! open the named temp file and observe an empty, partial or unvalidated
//! candidate. `docs/decisions/2a-3a-notes.md` section 3.3 records the ordering
//! and what each hop of it buys.
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
//!   [`WriteError::TargetChangedDuringWrite`], and it is a refusal after which
//!   **the target keeps its bytes and its protection**. The candidate is a temp
//!   file whose deletion is *attempted* on the way out; see "What a failure
//!   leaves behind" below;
//! - the expensive part of the window — building, writing and fsyncing a whole
//!   candidate file, which is milliseconds — is therefore **outside** the
//!   remaining race. What is left is the gap between the second check and the
//!   `rename()`: a handful of syscalls, one rename wide.
//!
//! **This narrows the window. It does not close it, and it cannot be closed at
//! this layer.** A caller that needs recoverability from the residual race needs
//! backups (step 13) and a conflict-handling path, not a stronger primitive.
//!
//! # What a failure leaves behind, stated exactly
//!
//! Every failure before the rename has **one** guarantee, and it is about the
//! target:
//!
//! > the target keeps its bytes **and** its protection.
//!
//! It is deliberately **not** "the temp file is deleted" and **not** "nothing was
//! written". A candidate inode may have received the whole of the new bytes, the
//! target's ACL and the target's extended attributes before the step that failed,
//! and [`TempFile`]'s deletion is *attempted* rather than guaranteed: a failing
//! `remove_file` is swallowed, and a copied denying ACL can make both the
//! `rename()` and that `remove_file` fail (`docs/decisions/2a-3a-notes.md`
//! section 6, measurement 5). **A temp file can therefore survive a failure.**
//!
//! What makes a leftover harmless is the **name**, not the guard —
//! [`temp_file_name`] and [`TempFile`] say it in full. [`WriteError::may_have_written`]
//! answers the question about the *target*, which is the one that changes what a
//! caller does next, and its own documentation says so.
//!
//! # Preconditions: the containing directory
//!
//! **A directory writable by an untrusted principal is out of scope.** This is a
//! precondition, not a solved problem.
//!
//! The temp file is created with `O_CREAT | O_EXCL` and everything that follows
//! is done to the **open descriptor** — the bytes, the `fsync`, the metadata
//! copy, the `fchmod` — never to the name. Immediately before the commit,
//! `verify_temp_identity` confirms that the temp *pathname* still resolves to
//! the very inode that descriptor holds, and refuses with
//! [`WriteError::TempFileChangedDuringWrite`] when it does not, so a directory
//! entry swapped under the write is not renamed over the target.
//!
//! **A final race remains and cannot be removed here.** `rename()` takes two
//! pathnames; there is no descriptor-based form of it, so between the identity
//! check and the rename the entry can be replaced once more. An attacker who can
//! create entries in the target's own directory therefore remains out of scope,
//! and for an espanso configuration under the user's own home directory that is
//! an assumption the whole application already rests on.
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
//!   ([`WriteError::TargetNotRegularFile`]). The open that establishes this is
//!   **non-blocking**, because `open(O_RDONLY)` on a fifo waits for a writer and
//!   would do so with the path lock already held;
//! - a target whose current bytes hash to something other than the caller's
//!   `expected` revision ([`WriteError::RevisionMismatch`], carrying both);
//! - a target that changed **while the call was running**
//!   ([`WriteError::TargetChangedDuringWrite`]).
//!
//! # Plan section 7 row 11, all four of it
//!
//! Row 11 of the plan's corruption register reads *"changing permissions /
//! ownership / line endings / BOM → capture and restore all four"*. Here is
//! where each of the four actually stands, and by what mechanism — stated in one
//! place because the answer is not the same mechanism for any two of them.
//!
//! | Row 11 names | Status | By what |
//! |---|---|---|
//! | **line endings** | preserved **by construction** | every edit is a byte-span replacement and everything outside the span comes out byte-identical. Nothing here reformats, so there is nothing to capture |
//! | **BOM** | preserved **by construction** | the same span layer. `bom-utf8.yml` goes through the whole transaction and commits |
//! | **permissions** | restored — mode bits **and ACL** | mode bits by `fstat` on the same descriptor whose bytes were hashed, then [`File::set_permissions`] on the candidate's own descriptor; the ACL by `copy_metadata` (macOS) |
//! | **ownership** | **not restored**, and cannot be from an unprivileged process | see below |
//!
//! The mode bits are taken by `fstat` on the **same open file descriptor** whose
//! bytes are hashed, so they cannot come from a different inode than the one the
//! revision describes. The ACL and the extended attributes are copied through
//! **that same descriptor**, for the same reason: `fcopyfile` takes two open
//! files and resolves no path at all.
//!
//! **Every one of the three is applied to a descriptor, never to a name.** The
//! mode goes on with [`File::set_permissions`], which is `fchmod` on the temp
//! file this call opened; the ACL and the attributes go on with `fcopyfile`,
//! which takes that same descriptor. Nothing between the temp file's creation
//! and the rename resolves the temp *pathname* except the identity check that
//! exists to prove the pathname has not been swapped.
//!
//! ## Ownership, honestly
//!
//! `chown` to another user needs privilege this application does not have, and
//! `COPYFILE_STAT` — which would attempt owner and group — is deliberately
//! **not** in the flag set (`copy_metadata` says why). So:
//!
//! - **uid**: when the user owns the file, which is the ordinary case for an
//!   espanso configuration under their own home directory, the temp file is
//!   created by that same user and the uid matches **by construction**. When
//!   they do *not* own it, this write makes them the owner, and no flag set
//!   available to an unprivileged process could have prevented that;
//! - **gid**: a new file on macOS inherits the **containing directory's** group,
//!   not the creating process's — measured, `docs/decisions/2a-3a-notes.md`
//!   section 6. The temp file is created in the target's own directory, so the
//!   group matches whenever the target's group matches its directory's, which is
//!   the ordinary case and is again by construction rather than by capture. A
//!   target whose group was changed away from its directory's **loses that
//!   group**.
//!
//! ## What a new inode still drops
//!
//! Even with `copy_metadata`, a temp file and a rename install a *new inode*,
//! so these do not survive: **owner and group** (above), **creation time**
//! (`st_birthtime` resets), **the inode number itself**, **BSD flags** such as
//! `uchg`, and **hard-link relationships** — other links keep the old inode, so
//! they no longer see the edit. `docs/decisions/2a-1-notes.md` section 4
//! enumerates all eight classes; this module now answers three of them (ACLs,
//! extended attributes and, with them, resource forks) and continues to drop the
//! rest. The resource fork travels **where the filesystem exposes it as an
//! extended attribute**, which is what modern macOS filesystems do with
//! `com.apple.ResourceFork`; it is not a promise about every destination volume.
//!
//! **BSD flags are dropped on purpose, not by omission.** Copying them is what
//! `COPYFILE_STAT` would do, and a copied `uchg` makes the very next `rename()`
//! fail with `EPERM` *and* leaves a temp file the cleanup guard cannot delete —
//! measured, notes section 6.
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
//! # Metadata that cannot be carried is a **refusal**, not a footnote
//!
//! If `copy_metadata` fails, the write stops: the target is left byte-identical
//! **and keeps its protection**, deletion of the candidate is attempted, and the
//! caller gets `WriteError::Io { step: WriteStep::CopyMetadata }`, for which
//! [`WriteStep::after_rename`] and [`WriteError::may_have_written`] both answer
//! `false`. As everywhere else in this module, that is a statement about the
//! target and not a promise that no temp file survives.
//!
//! The alternative — commit the bytes and report the lost metadata on the
//! success value — is rejected because it converts a metadata failure into a
//! **silent access-control change**: a caller that does not read the extra field
//! writes a file that is more accessible than the one it replaced, and there is
//! nothing to undo it with. A refusal cannot be ignored, costs the user nothing
//! but the attempt, and leaves the file with both its old bytes and its old
//! protection. `docs/decisions/2a-3a-notes.md` section 4 argues it in full.
//!
//! # This module is unix-only, on purpose, and its metadata copy is macOS-only
//!
//! It uses [`std::os::unix::fs::OpenOptionsExt`] so the temp file is created
//! `0o600` and *then* widened to the target's mode, rather than created at
//! `0o666 & !umask` and narrowed afterwards. A private file must never be
//! world-readable for even the instant between the two calls, and the widening
//! happens only once the candidate's final bytes are on disk. It also uses
//! [`std::os::unix::fs::MetadataExt`] for the device and inode numbers the
//! pre-commit check compares. The application is macOS-only (plan section 1), so
//! committing the core to unix here costs nothing that is not already spent.
//!
//! `copy_metadata` goes one step further and is **macOS-only**: `copyfile(3)`
//! is an Apple interface with no portable equivalent, and `libc` is declared for
//! `cfg(target_os = "macos")` alone. On every other target the function is a
//! documented no-op that answers `Ok(())`, so the crate still builds and its
//! tests still run — and this module's ACL and extended-attribute guarantee
//! **does not hold there**, which is said rather than implied.
//!
//! # On the wire since Phase 2b-1
//!
//! [`WriteError`], [`WriteStep`] and [`TargetDifference`] are serializable, and
//! each of their variants has a `code.` entry in **both**
//! `src/lib/i18n/en.json` and `es.json` — `src-tauri/src/dictionary_contract.rs`
//! fails the build otherwise, which is why the derives and the strings landed in
//! one change rather than in two.
//!
//! Two things about that wire form are decisions rather than defaults, and both
//! are argued on the impls below: every path crosses through
//! [`crate::wire::WirePathRef`], because `serde`'s own `PathBuf` serializer
//! *fails* on a path that is not valid UTF-8 and a failure there has no typed
//! refusal left to fall back on; and [`WriteError::Io`] writes a **`kind`** field
//! holding the [`io::ErrorKind`] variant name — plus a nullable **`raw_os_error`**
//! number, because that name is coarse — never the operating system's own
//! sentence (plan section 9).

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

use serde::ser::{SerializeStructVariant, Serializer};
use serde::Serialize;

use crate::wire::{io_kind_name, io_raw_os_error, WirePathRef};
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

/// `O_NONBLOCK` on Apple and BSD targets: **open, do not wait**.
///
/// Without it, `open(O_RDONLY)` on a fifo blocks until some other process opens
/// the same fifo for writing — and the type check that would refuse the fifo is
/// downstream of the open, so it never runs. [`inspect_target`] is called with
/// the per-path write lock held, so that block is a lock held for as long as
/// nobody writes: every later save of the same resolved path waits behind it,
/// indefinitely. The flag turns that into an immediate open followed by
/// [`WriteError::TargetNotRegularFile`].
///
/// It changes nothing for a regular file — reads from one are never `EAGAIN` —
/// and the read only happens after the type check has passed, so no code here
/// can observe a short non-blocking read.
///
/// Spelled out rather than taken from `libc`, exactly as [`OPEN_NO_FOLLOW`] is,
/// and `the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer` pins
/// its *meaning* rather than its number.
#[cfg(any(target_vendor = "apple", target_os = "freebsd", target_os = "openbsd"))]
const OPEN_NON_BLOCKING: i32 = 0x4;

/// `O_NONBLOCK` on Linux and Android.
#[cfg(any(target_os = "linux", target_os = "android"))]
const OPEN_NON_BLOCKING: i32 = 0o4000;

/// No `O_NONBLOCK` value is known for this target, so the flag is not
/// requested.
///
/// The open then blocks on a fifo planted at the resolved path, with the write
/// lock held. Written down rather than assumed: the guarantee is weaker here.
#[cfg(not(any(
    target_vendor = "apple",
    target_os = "freebsd",
    target_os = "openbsd",
    target_os = "linux",
    target_os = "android"
)))]
const OPEN_NON_BLOCKING: i32 = 0;

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
/// carries, what bytes it holds — and the descriptor all three came from.
///
/// All of them come from **one file description**, so they cannot describe
/// different inodes.
///
/// Visible to [`crate::persist::save`] because the save transaction's own step-2
/// read goes through [`inspect_target`] rather than through a second, unchecked
/// [`fs::read`]: two ways into the same file are two places to forget the
/// `O_NOFOLLOW`, the non-blocking open and the regular-file check.
#[derive(Debug)]
pub(super) struct InspectedTarget {
    /// The open file, kept so that step 7a's metadata copy reads the ACL and the
    /// extended attributes from **the same file description** the mode bits and
    /// the bytes came from.
    ///
    /// Re-opening the target by path instead would reintroduce exactly the
    /// TOCTOU that `docs/decisions/2a-1-notes.md` section 4 records as fixed: a
    /// second `open` can land on a different inode and copy its protection onto
    /// this candidate. Holding the descriptor costs one file descriptor for the
    /// life of the transaction and removes the question.
    pub(super) handle: File,
    /// Device and inode number, for the pre-commit identity comparison.
    pub(super) identity: (u64, u64),
    /// The mode bits step 7b copies.
    pub(super) mode: Permissions,
    /// The bytes the revision is computed from.
    pub(super) bytes: Vec<u8>,
}

/// Opens the target once and reads everything the transaction needs from it.
///
/// `O_NOFOLLOW` means the final component is opened as itself: a symlink planted
/// at the resolved path is `ELOOP`, not a second dereference. `O_NONBLOCK` means
/// a fifo planted there is an *open that returns*, so the type check below can
/// reject it instead of the caller waiting for a writer with the path lock held.
/// The type check then rejects a directory, a fifo, a socket or a device.
///
/// **This is the only read of a save target in the crate**, deliberately: the
/// transaction ([`crate::persist::save_document`]) calls it for its step-2 read
/// as well, so the three checks above happen once, in one place, for every path
/// that reads a file this application may write.
pub(super) fn inspect_target(target: &Path) -> Result<InspectedTarget, WriteError> {
    let mut handle = OpenOptions::new()
        .read(true)
        .custom_flags(OPEN_NO_FOLLOW | OPEN_NON_BLOCKING)
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
        handle,
        identity: (metadata.dev(), metadata.ino()),
        mode: metadata.permissions(),
        bytes,
    })
} // End of function inspect_target()

/// Copies the target's **access control list and extended attributes** onto the
/// candidate, through two already-open descriptors (step 7a).
///
/// This is the unpaid half of plan section 7 row 11. A temp file plus a
/// `rename()` installs a new inode, and a new inode is born with no ACL and no
/// extended attributes — so on macOS every save used to drop Finder tags, Finder
/// comments, `com.apple.quarantine`, every `com.apple.metadata:*` attribute, the
/// resource fork and, worst of all, the ACL. A **denying** ACL is access
/// control, so dropping it left the replacement *more* accessible than the file
/// it replaced while the mode bits looked identical.
///
/// Two of those deserve a sentence each, because carrying them is a decision and
/// not an accident:
///
/// - **the resource fork travels because the filesystem exposes it as an
///   extended attribute** (`com.apple.ResourceFork`), which is what modern macOS
///   filesystems do. It is preserved *where that holds*, and this is not a
///   promise about every volume a configuration might live on;
/// - **`com.apple.quarantine` is carried forward on purpose.** This call
///   replaces the contents of one logical file; the quarantine attribute is a
///   property of that file, and dropping it merely because a new inode is
///   installed would silently un-quarantine a file the system had marked. That
///   is an accidental security change in the permissive direction, which is
///   exactly the class of change this whole step exists to stop.
///
/// # Why `fcopyfile` and not `copyfile`
///
/// The descriptor form **resolves no path**. Both files are already open — the
/// source is the descriptor [`inspect_target`] opened `O_NOFOLLOW` and hashed
/// from, the destination is the temp file this call already owns — so there is
/// no second name lookup to race, no symlink question and no way for either end
/// to be a different inode than the one the caller means. The path form would
/// have to re-resolve the target and would reintroduce the TOCTOU 2a-1 removed.
///
/// # Why `COPYFILE_ACL | COPYFILE_XATTR` and not `COPYFILE_STAT`
///
/// `COPYFILE_STAT` would additionally carry mode, owner, group, timestamps and
/// BSD flags. Each of those three additions is a reason not to use it, and all
/// three were measured (`docs/decisions/2a-3a-notes.md` section 6):
///
/// - **timestamps.** It restores the source's `mtime` onto a file whose contents
///   just changed. Every mtime-driven tool — a backup, a sync agent, `make`,
///   anything watching for modification — would then be told the file did not
///   change. Restoring a stale mtime is not preservation, it is a lie about the
///   edit that just happened;
/// - **BSD flags.** A `uchg` target would put `uchg` on the temp file, and the
///   very next `rename()` fails with `EPERM` — measured — leaving a temp file
///   the cleanup guard then cannot delete either;
/// - **mode bits.** Step 7b already sets them, from an `fstat` on the same
///   descriptor. Two mechanisms writing one property is how they come to
///   disagree. Measured: `COPYFILE_ACL | COPYFILE_XATTR` alone leaves the
///   destination's mode untouched, and step 7b runs **after** this call anyway,
///   so the mode has exactly one owner whatever `copyfile` does.
///
/// Owner and group are the other thing `COPYFILE_STAT` would attempt, and they
/// need privilege this process does not have; the module documentation states
/// what actually happens to each instead of implying they are handled. What this
/// call preserves is therefore **the ACL, the extended attributes and — through
/// step 7b beside it — the mode bits**, not "the security metadata".
///
/// # What a zero return proves, and what it does not
///
/// A `0` is **the copying facility reporting success for the operations that
/// were requested**. It is not an independently verified, byte-for-byte
/// inventory match between the two files' attributes, and this function must
/// never be documented or relied on as one:
///
/// - `fcopyfile` is **not transactional.** A failure can leave some extended
///   attributes, or some ACL state, already installed on the destination; it
///   rolls nothing back. That is harmless to the target, which is untouched, but
///   it means a partially protected candidate can exist — and a partially
///   installed denying ACL is one of the ways the cleanup of that candidate can
///   itself fail;
/// - the filesystem may treat particular attributes specially, and whether a
///   given ACL entry could be silently filtered while the call still returns `0`
///   is **not known here** and was not measured;
/// - an invalid *destination* descriptor is not detected at all — measured, it
///   answers `0` (`docs/decisions/2a-3a-notes.md` section 8, hole 3).
///
/// So the guarantee this function carries upward is *the OS copying facility was
/// used and reported success*, and the tests that assert particular attributes
/// arrived are what turn that into evidence for those attributes.
///
/// # The state argument is `NULL`, deliberately
///
/// `copyfile(3)` documents a `NULL` state as *"both functions will work
/// normally, but less control will be available to the caller"*. Nothing here
/// wants that control — no progress callback, no per-attribute filter — and a
/// `copyfile_state_t` would be an allocation to free on every early return.
///
/// # Failure is the caller's to refuse on
///
/// This returns the OS error and decides nothing. [`write_through_temp_file`]
/// turns it into `WriteError::Io { step: WriteStep::CopyMetadata }` **before the
/// rename**, so the target is untouched; the module documentation argues why
/// that is the policy.
#[cfg(target_os = "macos")]
fn copy_metadata(source: &File, destination: &File) -> io::Result<()> {
    copy_through_copyfile(
        source,
        destination,
        libc::COPYFILE_ACL | libc::COPYFILE_XATTR,
    )
}

/// The **extended attributes alone**, for a copy that must stay deletable
/// (Phase 2a-3b's backups).
///
/// The same call as [`copy_metadata`] with **`COPYFILE_ACL` removed**, and the
/// removal is the decision. A backup is rotated — that is, deleted — and 2a-3a
/// measured that an `everyone deny delete` entry copied onto a new inode makes
/// `remove_file` on it fail (`docs/decisions/2a-3a-notes.md` section 6,
/// measurement 5). Carrying the list onto a backup would therefore turn *retain
/// the last ten batches* into unbounded growth of directories this application
/// can never clean up, and would do it silently.
///
/// What replaces the ACL for the backup's own protection is stated where the
/// backup is written ([`crate::persist::backup`]): the copy keeps the target's
/// **mode bits**, and the whole backup tree is created `0o700`.
///
/// Everything else about the call is [`copy_metadata`]'s, unchanged — the
/// descriptor form that resolves no path, the `NULL` state, the absence of
/// `COPYFILE_STAT` and of `COPYFILE_DATA`, and what a zero return does and does
/// not prove.
#[cfg(target_os = "macos")]
pub(super) fn copy_extended_attributes(source: &File, destination: &File) -> io::Result<()> {
    copy_through_copyfile(source, destination, libc::COPYFILE_XATTR)
}

/// The one `fcopyfile` call site, with the flag set as its argument.
///
/// Two named policies sit on it — [`copy_metadata`] for the atomic write and
/// [`copy_extended_attributes`] for a backup — so that the difference between
/// them is **one visible constant** rather than two independently maintained
/// `unsafe` blocks that can drift.
#[cfg(target_os = "macos")]
fn copy_through_copyfile(
    source: &File,
    destination: &File,
    flags: libc::copyfile_flags_t,
) -> io::Result<()> {
    use std::os::unix::io::AsRawFd as _;

    // SAFETY: both descriptors are borrowed from live `File` values, so they are
    // open for the whole call; the state argument is documented to accept NULL;
    // and the flags are constants `copyfile(3)` defines, supplied by the two
    // callers above and by nothing else. `fcopyfile` touches only **the file
    // objects the two descriptors refer to** — a descriptor names no path, so no
    // third file can be reached from here — and it returns 0 or -1. It does
    // write: an ACL onto the destination where `COPYFILE_ACL` is requested, and
    // extended-attribute storage, which on modern macOS includes the resource
    // fork. What it does not do with either flag set used here is copy or
    // truncate the destination's main data fork.
    let outcome = unsafe {
        libc::fcopyfile(
            source.as_raw_fd(),
            destination.as_raw_fd(),
            std::ptr::null_mut(),
            flags,
        )
    };
    if outcome == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
} // End of function copy_through_copyfile()

/// The no-op this step becomes off macOS, where `copyfile(3)` does not exist.
///
/// **The ACL and extended-attribute guarantee does not hold on this target**,
/// and answering `Ok(())` is what makes that a documented limitation rather than
/// a build failure: `espansoconfig-core` is meant to build, test and fuzz
/// anywhere (plan section 6.1) even though the application ships on macOS alone.
/// The step marker [`WriteStep::CopyMetadata`] exists on every target so that the
/// enum, its codes and every exhaustive match over it are platform-independent.
#[cfg(not(target_os = "macos"))]
fn copy_metadata(source: &File, destination: &File) -> io::Result<()> {
    let _ = (source, destination);
    Ok(())
}

/// The no-op [`copy_extended_attributes`] becomes off macOS.
///
/// A backup taken on this target carries its bytes and its mode bits and **no
/// extended attributes**, for the same reason and with the same consequence as
/// [`copy_metadata`]'s twin above.
#[cfg(not(target_os = "macos"))]
pub(super) fn copy_extended_attributes(source: &File, destination: &File) -> io::Result<()> {
    let _ = (source, destination);
    Ok(())
}

/// Steps 6 to 10: temp file, the bytes, fsync, the ACL and extended attributes,
/// mode bits, fsync again, the two pre-commit checks, rename, directory sync.
///
/// Split out of [`replace_locked_file`] so that the [`TempFile`] guard's scope
/// is exactly the window in which a temp file exists. Every `?` below returns
/// through that scope, so a normal return and an unwind both *attempt* to delete
/// it — an attempt, not a guarantee; the module documentation's "What a failure
/// leaves behind" says exactly what is promised instead.
///
/// **The plan's step 7 runs after its step 8 here**, and the ordering is the
/// point rather than an accident:
///
/// 1. the candidate is created `0o600`, written and fsynced while still `0o600`,
///    so a legitimate reader of the target's mode can never open the named temp
///    file and find an empty or partial candidate;
/// 2. only then are the ACL and the extended attributes copied on, and only then
///    is the mode widened — **after** the metadata copy, so the mode bits keep
///    exactly one owner;
/// 3. a second `sync_all` persists what steps 7a and 7b just wrote, which the
///    first one could not have covered;
/// 4. the temp pathname is proved to still name the inode all of that went into,
///    and only then does the name reach `rename()`.
///
/// Two consequences worth naming. Because no data write follows `fcopyfile`,
/// **no question about file offsets can arise** — the metadata copy is the last
/// thing that touches the candidate's contents in any sense, and nothing after
/// it depends on where a descriptor's offset was left. And because the copy
/// happens as late as it can, the window in which another process can change the
/// *target's* protection after it was copied and before the rename is **as short
/// as this design can make it** — it is not closed, and
/// `docs/decisions/2a-3a-notes.md` section 8 records that as a hole.
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
    // because `rename()` is only atomic within one filesystem. It is created
    // 0o600 and stays 0o600 until its last byte is on disk.
    let (mut handle, guard) = create_temp_file(directory, file_name)?;

    // Step 8, and it runs **before** step 7 deliberately: while the candidate is
    // still 0o600, nobody the target's mode admits can open the named temp file
    // and observe an empty or partial candidate. Without the fsync a crash
    // between the rename and the flush leaves the target naming an empty or
    // half-written inode — hazard 2 in its subtler form.
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

    // Step 7a: hazard 11's other half. The new inode is born with no ACL and no
    // extended attributes, so both are copied from the target's own descriptor
    // before the rename. A failure here **refuses the write**: the target keeps
    // its bytes *and* its protection, and deletion of the candidate is
    // attempted. No data write follows this call, so no question about either
    // descriptor's file offset can arise.
    copy_metadata(&inspected.handle, &handle).map_err(|error| WriteError::Io {
        step: WriteStep::CopyMetadata,
        path: guard.path().to_path_buf(),
        source: error,
    })?;

    // Step 7b: the temp file was created 0o600 and is widened here, never
    // narrowed, so a private file is never briefly readable by anyone else.
    // **After** the metadata copy, so the mode bits have exactly one owner even
    // if a future flag set made `copyfile` touch them — and on the open
    // descriptor rather than on `guard.path()`, so the inode chmod-ed is
    // provably the inode this call wrote.
    handle
        .set_permissions(inspected.mode.clone())
        .map_err(|error| WriteError::Io {
            step: WriteStep::ApplyModeBits,
            path: guard.path().to_path_buf(),
            source: error,
        })?;

    // Step 8 again: the ACL, the extended attributes and the mode bits were all
    // written after the first fsync, so they need their own.
    handle.sync_all().map_err(|error| WriteError::Io {
        step: WriteStep::SyncTempFile,
        path: guard.path().to_path_buf(),
        source: error,
    })?;

    // Everything above was done to the descriptor. The rename below is the one
    // step that must use the *name*, so the name is proved to still refer to the
    // inode the descriptor holds before it is handed to `rename()`.
    verify_temp_identity(&handle, guard.path())?;
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

/// Proves that the temp **pathname** still names the inode `handle` holds.
///
/// Everything this module does to the candidate — the bytes, the fsyncs, the
/// metadata copy, the `fchmod` — is done to an open descriptor, which resolves
/// no path and cannot be redirected. `rename()` is the exception: it takes two
/// *names*, and there is no descriptor-based form of it. So between the temp
/// file's creation and the commit there is a name that a process able to write
/// the containing directory could replace, and renaming that replacement over
/// the target would install a file this call never wrote.
///
/// This is the check that refuses it. Both ends of the comparison are device and
/// inode numbers: `fstat` on the descriptor, and `lstat` — not `stat` — on the
/// name, so an entry swapped for a *symlink* is a mismatch rather than a
/// dereference. A difference is [`WriteError::TempFileChangedDuringWrite`], and
/// it is a refusal before the rename, so the target keeps its bytes and its
/// protection.
///
/// **It narrows the window; it does not close it.** The rename that follows is
/// still by pathname, and the entry can be replaced once more in the few
/// instructions between the two. The module documentation states the
/// hostile-directory precondition that this leaves standing.
fn verify_temp_identity(handle: &File, path: &Path) -> Result<(), WriteError> {
    let same = names_the_same_inode(handle, path).map_err(|error| WriteError::Io {
        step: WriteStep::VerifyTempIdentity,
        path: path.to_path_buf(),
        source: error,
    })?;
    if !same {
        return Err(WriteError::TempFileChangedDuringWrite {
            path: path.to_path_buf(),
        });
    }
    Ok(())
} // End of function verify_temp_identity()

/// Whether `path` still names the inode `handle` holds.
///
/// The comparison [`verify_temp_identity`] is made of, without its error type, so
/// that [`crate::persist::backup`] can ask the same question about **its** own
/// temporary file and answer it with a `BackupError` instead. The reasoning is
/// entirely [`verify_temp_identity`]'s — one shared question, two callers, one
/// implementation that cannot drift.
///
/// Both ends are `(device, inode)` pairs: `fstat` on the descriptor, and `lstat`
/// — not `stat` — on the name, so an entry swapped for a **symlink** answers
/// `false` rather than being dereferenced.
pub(super) fn names_the_same_inode(handle: &File, path: &Path) -> io::Result<bool> {
    let open = handle.metadata()?;
    let named = fs::symlink_metadata(path)?;
    Ok((named.dev(), named.ino()) == (open.dev(), open.ino()))
} // End of function names_the_same_inode()

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
/// written to the target**, which keeps both its bytes and its protection: the
/// candidate is still a temp file under its own name, and deleting it is
/// attempted on the way out.
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
/// Since step 7a copies the target's ACL onto the candidate, there is now a
/// **known, reachable** way for that `remove_file` to fail rather than only a
/// theoretical one: a target carrying `everyone deny delete` puts the same entry
/// on the candidate, and macOS then refuses both the `rename()` and the unlink
/// (`docs/decisions/2a-3a-notes.md` section 6, measurement 5, and its hole 6).
/// **No sentence anywhere in this crate may therefore say that a failure deletes
/// the temp file.** What a failure guarantees is about the target: it keeps its
/// bytes and its protection.
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
    /// A failure to delete is swallowed rather than escalated — a destructor is
    /// not a place to panic from, and there is nothing left to try. The file may
    /// already be gone, the directory may have become unwritable, or a denying
    /// ACL copied from the target at step 7a may forbid the unlink. **The
    /// leftover is then permanent**, and harmless because of its name rather
    /// than because it was cleaned up.
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum WriteStep {
    /// Step 1: canonicalising the caller's path.
    ResolveTarget,
    /// Step 2: opening the target and reading its metadata.
    InspectTarget,
    /// Step 2: reading the target's bytes for the revision check.
    ReadTarget,
    /// Step 6: creating the temp file.
    CreateTempFile,
    /// Step 8: writing the bytes into the temp file.
    ///
    /// It runs **before** step 7, so the candidate is still `0o600` while it is
    /// incomplete. The variants are declared in the order they execute.
    WriteTempFile,
    /// Step 8: `fsync` on the temp file — once after the bytes, once after the
    /// ACL, the extended attributes and the mode bits.
    SyncTempFile,
    /// Step 7a: copying the target's **ACL and extended attributes** onto the
    /// temp file.
    ///
    /// A failure here is a **refusal after which the target keeps both its bytes
    /// and its protection**: it happens before the rename. The alternative —
    /// committing and reporting the loss — would make an unread field the only
    /// thing standing between a user and a file that is more accessible than the
    /// one it replaced.
    ///
    /// On a target that is not macOS the step exists but never fails, because
    /// there is no `copyfile(3)` to call.
    CopyMetadata,
    /// Step 7b: copying the target's mode bits onto the temp file, with
    /// `fchmod` on the descriptor the candidate was written through.
    ApplyModeBits,
    /// Step 9, immediately before the commit: confirming that the temp
    /// **pathname** still names the inode this call wrote.
    ///
    /// The step itself only fails as `Io` when the descriptor or the name cannot
    /// be stat-ed. A name that resolves to a *different* inode is not an I/O
    /// failure at all — it is [`WriteError::TempFileChangedDuringWrite`].
    VerifyTempIdentity,
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
            WriteStep::WriteTempFile => "writeTempFile",
            WriteStep::SyncTempFile => "syncTempFile",
            WriteStep::CopyMetadata => "copyMetadata",
            WriteStep::ApplyModeBits => "applyModeBits",
            WriteStep::VerifyTempIdentity => "verifyTempIdentity",
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

impl Serialize for TargetDifference {
    /// Externally tagged, exactly as a `#[derive(Serialize)]` would write it —
    /// and hand-written for one reason: [`TargetDifference::Retargeted`] carries
    /// a [`PathBuf`], and `serde`'s own `PathBuf` serializer **fails** on a path
    /// that is not valid UTF-8. A failure there arrives after the command has
    /// already answered, so the refusal that was supposed to carry the news is
    /// the value that cannot be written. [`WirePathRef`] renders lossily and
    /// therefore always succeeds.
    ///
    /// Writing the `match` by hand also makes a **new variant a compile error
    /// here**, which is the prompt to add its two dictionary entries; a derive
    /// would have serialized it silently with no string on the other side.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            TargetDifference::Retargeted { now } => {
                let mut out =
                    serializer.serialize_struct_variant("TargetDifference", 0, "Retargeted", 1)?;
                out.serialize_field("now", &WirePathRef(now))?;
                out.end()
            }
            TargetDifference::Vanished => {
                serializer.serialize_unit_variant("TargetDifference", 1, "Vanished")
            }
            TargetDifference::Identity => {
                serializer.serialize_unit_variant("TargetDifference", 2, "Identity")
            }
            TargetDifference::Contents { expected, found } => {
                let mut out =
                    serializer.serialize_struct_variant("TargetDifference", 3, "Contents", 2)?;
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
                out.end()
            }
        }
    } // End of function serialize() for TargetDifference
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
    /// The **temp file's own name** stopped referring to the inode this call
    /// wrote, so the commit was refused. The target keeps its bytes and its
    /// protection.
    ///
    /// Every step between the temp file's creation and the commit is performed
    /// on an open descriptor, which resolves no path; `rename()` is the one that
    /// cannot be, and this is the check that refuses to hand it a name some
    /// other process has repointed. Renaming that entry over the target would
    /// install a file this call never wrote — different bytes, different
    /// protection, and a success reported for both.
    ///
    /// It is a **different fact from [`WriteError::TargetChangedDuringWrite`]**
    /// and deliberately not folded into it: nothing about the target changed.
    /// What changed is the candidate's directory entry, which means the
    /// containing directory is being written by something else. See the module
    /// documentation's precondition on that directory: this narrows the window
    /// and does not close it.
    TempFileChangedDuringWrite {
        /// The temp file's path — **not** the target's.
        path: PathBuf,
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
    ///
    /// Usually the target. For [`WriteError::TempFileChangedDuringWrite`] and
    /// for an [`WriteError::Io`] whose step names the temp file or the
    /// containing directory it is that path instead, which is why the variant
    /// and the step are carried rather than flattened away.
    pub fn path(&self) -> &Path {
        match self {
            WriteError::TargetMissing { path }
            | WriteError::TargetNotRegularFile { path }
            | WriteError::RevisionMismatch { path, .. }
            | WriteError::TargetChangedDuringWrite { path, .. }
            | WriteError::TempFileChangedDuringWrite { path }
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
    /// **It is a statement about the target, and about this call's rename over
    /// it.** A `false` says this call did not replace the target; it does **not**
    /// say that no inode anywhere received bytes. A candidate temp file may hold
    /// the whole of the new content, the target's ACL and the target's extended
    /// attributes, and it may **survive** — deleting it is attempted and a
    /// failure to delete is swallowed (see [`TempFile`] and the module
    /// documentation's "What a failure leaves behind"). What a `false` promises
    /// is that the target kept its bytes and its protection at the moment this
    /// call gave up.
    ///
    /// **Nor is it a statement about what the target holds now.** `false` does
    /// not mean the target still holds `expected`, and `true` does not mean it
    /// currently holds the new bytes: another process can have written it either
    /// way. The target must be re-read whenever external writers are possible,
    /// which for an espanso configuration is always.
    pub fn may_have_written(&self) -> bool {
        match self {
            WriteError::TargetMissing { .. }
            | WriteError::TargetNotRegularFile { .. }
            | WriteError::RevisionMismatch { .. }
            | WriteError::TargetChangedDuringWrite { .. }
            | WriteError::TempFileChangedDuringWrite { .. } => false,
            WriteError::VerificationFailed { .. } => true,
            WriteError::Io { step, .. } => step.after_rename(),
        }
    } // End of function may_have_written()
}

impl Serialize for WriteError {
    /// Externally tagged, with two departures from what a derive would write —
    /// and neither is cosmetic.
    ///
    /// - **Every path goes through [`WirePathRef`].** A path is a bag of bytes on
    ///   Unix, `serde`'s own `PathBuf` serializer *fails* on one that is not
    ///   valid UTF-8, and a failure at that point turns a typed refusal into the
    ///   serializer's English prose. Every variant of this enum carries a path.
    /// - **[`WriteError::Io`] writes `kind` and `raw_os_error`, never `source`.**
    ///   An [`io::Error`]'s `Display` is the operating system's own message in the
    ///   operating system's own language; the `ErrorKind` name is a code (plan
    ///   section 9). The field is therefore renamed on the wire, deliberately, so
    ///   nothing downstream can mistake it for the message. `kind` is coarse — a
    ///   whole family of distinct failures arrives as `Other` — so the system's
    ///   own error number rides alongside it as a **number**, nullable because an
    ///   error this crate built itself has none. It is diagnostic data with no
    ///   dictionary entry, never a code to branch on and never interpolated into
    ///   a sentence.
    ///
    /// Hand-written rather than derived so that a variant added to this enum is a
    /// compile error here, which is the prompt to add its two dictionary entries.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            WriteError::TargetMissing { path } => {
                let mut out =
                    serializer.serialize_struct_variant("WriteError", 0, "TargetMissing", 1)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            WriteError::TargetNotRegularFile { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "WriteError",
                    1,
                    "TargetNotRegularFile",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            WriteError::RevisionMismatch {
                path,
                expected,
                found,
            } => {
                let mut out =
                    serializer.serialize_struct_variant("WriteError", 2, "RevisionMismatch", 3)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
                out.end()
            }
            WriteError::TargetChangedDuringWrite { path, difference } => {
                let mut out = serializer.serialize_struct_variant(
                    "WriteError",
                    3,
                    "TargetChangedDuringWrite",
                    2,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("difference", difference)?;
                out.end()
            }
            WriteError::TempFileChangedDuringWrite { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "WriteError",
                    4,
                    "TempFileChangedDuringWrite",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            WriteError::VerificationFailed {
                path,
                expected,
                found,
            } => {
                let mut out = serializer.serialize_struct_variant(
                    "WriteError",
                    5,
                    "VerificationFailed",
                    3,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
                out.end()
            }
            WriteError::Io { step, path, source } => {
                let mut out = serializer.serialize_struct_variant("WriteError", 6, "Io", 4)?;
                out.serialize_field("step", step)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("kind", &io_kind_name(source))?;
                out.serialize_field("raw_os_error", &io_raw_os_error(source))?;
                out.end()
            }
        }
    } // End of function serialize() for WriteError
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
            WriteError::TempFileChangedDuringWrite { path } => write!(
                formatter,
                "the temp file {} is no longer the file this call wrote",
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
    use std::time::Duration;

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
            WriteStep::WriteTempFile,
            WriteStep::SyncTempFile,
            WriteStep::CopyMetadata,
            WriteStep::ApplyModeBits,
            WriteStep::VerifyTempIdentity,
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

    /// Creates a fifo at `path` with `mkfifo(1)`, or answers `false`.
    ///
    /// Shelling out rather than adding a dependency: `libc` and `nix` are not in
    /// this crate's tree and would not be worth adding for one test. A platform
    /// without `mkfifo` makes the caller skip rather than fail.
    fn make_fifo(path: &Path) -> bool {
        std::process::Command::new("mkfifo")
            .arg(path)
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    /// Runs `work` on another thread and gives it `limit` to finish.
    ///
    /// The thread is **abandoned** on a timeout rather than joined: the whole
    /// point of these two tests is that the work may never return, and a test
    /// that hangs is a suite that hangs. The abandoned thread is blocked on a
    /// fifo inside a temp directory of its own, so it holds nothing another test
    /// wants.
    fn within<T: Send + 'static>(
        limit: Duration,
        work: impl FnOnce() -> T + Send + 'static,
    ) -> Option<T> {
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let _ = sender.send(work());
        });
        receiver.recv_timeout(limit).ok()
    } // End of function within()

    #[test]
    fn the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer() {
        // `OPEN_NON_BLOCKING` is a hand-written syscall constant, so its
        // *meaning* is pinned rather than its number: without it the first open
        // below never returns, and `inspect_target` would hold the path lock for
        // as long as nobody writes to the fifo.
        let directory = tempfile::tempdir().expect("a temp directory");
        let fifo = directory.path().join("base.yml");
        if !make_fifo(&fifo) {
            println!(
                "SKIP the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer: \
                 mkfifo(1) is not available here"
            );
            return;
        }

        let flagged = fifo.clone();
        let opened = within(Duration::from_secs(5), move || {
            OpenOptions::new()
                .read(true)
                .custom_flags(OPEN_NO_FOLLOW | OPEN_NON_BLOCKING)
                .open(&flagged)
                .is_ok()
        });
        assert_eq!(
            opened,
            Some(true),
            "O_NONBLOCK must open a fifo immediately; without it this open waits for a writer"
        );

        let refused = within(Duration::from_secs(5), move || {
            match inspect_target(&fifo) {
                Err(WriteError::TargetNotRegularFile { .. }) => "refused".to_owned(),
                Err(other) => format!("{other}"),
                Ok(_) => "inspected a fifo as if it were a file".to_owned(),
            }
        });
        assert_eq!(
            refused.as_deref(),
            Some("refused"),
            "inspect_target must refuse a fifo, and must do so without waiting for a writer"
        );
    } // End of function the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer()

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

    /// Reads one extended attribute by path, or answers `None` if it is absent.
    ///
    /// The tests below need to *observe* an attribute rather than only set one,
    /// and `getxattr` is the syscall that does it without a second binary.
    #[cfg(target_os = "macos")]
    fn read_xattr(path: &Path, name: &str) -> Option<Vec<u8>> {
        use std::ffi::CString;
        let path = CString::new(path.as_os_str().as_encoded_bytes()).expect("no interior NUL");
        let name = CString::new(name).expect("no interior NUL");
        let mut buffer = vec![0u8; 1024];
        // SAFETY: both C strings outlive the call, the buffer is `buffer.len()`
        // bytes long, and `getxattr` writes at most that many.
        let read = unsafe {
            libc::getxattr(
                path.as_ptr(),
                name.as_ptr(),
                buffer.as_mut_ptr().cast(),
                buffer.len(),
                0,
                0,
            )
        };
        if read < 0 {
            return None;
        }
        buffer.truncate(read as usize);
        Some(buffer)
    } // End of function read_xattr()

    /// Sets one extended attribute by path. Answers whether it worked.
    #[cfg(target_os = "macos")]
    fn write_xattr(path: &Path, name: &str, value: &[u8]) -> bool {
        use std::ffi::CString;
        let path = CString::new(path.as_os_str().as_encoded_bytes()).expect("no interior NUL");
        let name = CString::new(name).expect("no interior NUL");
        // SAFETY: both C strings and `value` outlive the call, and the length
        // passed is `value`'s own.
        let written = unsafe {
            libc::setxattr(
                path.as_ptr(),
                name.as_ptr(),
                value.as_ptr().cast(),
                value.len(),
                0,
                0,
            )
        };
        written == 0
    } // End of function write_xattr()

    #[cfg(target_os = "macos")]
    #[test]
    fn the_metadata_copy_moves_an_extended_attribute_between_two_open_files() {
        // The unit-level pin on step 7a: two descriptors, one call, and an
        // attribute that was on one file and is now on both. The acceptance
        // binary pins the same property through the whole primitive; this one
        // pins the syscall wrapper itself, so a wrong flag constant fails here
        // rather than only in an integration test.
        let directory = tempfile::tempdir().expect("a temp directory");
        let source_path = directory.path().join("source.yml");
        fs::write(&source_path, b"matches: []\n").expect("write");
        assert!(
            write_xattr(&source_path, "com.espansoconfig.probe", b"carried"),
            "setxattr failed, so nothing could be measured"
        );

        let destination_path = directory.path().join("_destination.tmp");
        let destination = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&destination_path)
            .expect("create");
        let source = File::open(&source_path).expect("open");

        copy_metadata(&source, &destination).expect("the copy succeeds");
        assert_eq!(
            read_xattr(&destination_path, "com.espansoconfig.probe").as_deref(),
            Some(b"carried".as_slice()),
            "the extended attribute did not reach the candidate"
        );
    } // End of function the_metadata_copy_moves_an_extended_attribute_between_two_open_files()

    #[cfg(target_os = "macos")]
    #[test]
    fn the_metadata_copy_reports_a_failure_instead_of_succeeding_silently() {
        // The failure policy has to have something to refuse on, and a source
        // descriptor that was never open is the one way to reach
        // `copy_metadata`'s error arm deterministically. `i32::MAX` is used
        // rather than a descriptor this test closes, because a closed number can
        // be handed straight back to another test thread's `open` and would make
        // this flaky.
        //
        // Measured on this machine: an invalid **source** answers -1 with
        // `errno` EBADF (9), while an invalid **destination** answers 0 — which
        // is why the source is the end sabotaged here, and is recorded as a hole
        // in `docs/decisions/2a-3a-notes.md`.
        use std::os::unix::io::FromRawFd as _;

        let directory = tempfile::tempdir().expect("a temp directory");
        let destination_path = directory.path().join("_destination.tmp");
        let destination = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&destination_path)
            .expect("create");

        // SAFETY: `i32::MAX` is above every descriptor this process can hold, so
        // it names nothing, and `ManuallyDrop` keeps this value from closing it.
        let unopened = std::mem::ManuallyDrop::new(unsafe { File::from_raw_fd(i32::MAX) });
        let error =
            copy_metadata(&unopened, &destination).expect_err("an unopened source must fail");
        assert_eq!(
            error.raw_os_error(),
            Some(9),
            "expected EBADF (9 on Darwin), got {error:?}"
        );
    } // End of function the_metadata_copy_reports_a_failure_instead_of_succeeding_silently()

    /// A directory, an open `0o600` temp file in it, and that file's path.
    ///
    /// The temp-identity tests all need the same three: a descriptor that is the
    /// trusted end of the comparison, and a name that the test then attacks.
    fn open_temp_fixture() -> (tempfile::TempDir, PathBuf, File) {
        let directory = tempfile::tempdir().expect("a temp directory");
        let path = directory.path().join("_candidate.tmp");
        let handle = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&path)
            .expect("create");
        (directory, path, handle)
    } // End of function open_temp_fixture()

    #[test]
    fn the_temp_identity_check_accepts_a_name_nobody_touched() {
        let (_directory, path, handle) = open_temp_fixture();
        verify_temp_identity(&handle, &path).expect("an untouched temp name passes");
    }

    #[test]
    fn the_temp_identity_check_refuses_a_name_repointed_at_another_inode() {
        // The review's `BLOCKING when the directory is attacker-writable`
        // finding, reproduced deterministically: the directory entry is replaced
        // while the descriptor stays open, exactly as a process able to write
        // the directory could do. Renaming that entry over the target would
        // install a file this call never wrote.
        let (directory, path, handle) = open_temp_fixture();
        let intruder = directory.path().join("_intruder.tmp");
        fs::write(&intruder, b"bytes this call never wrote\n").expect("write");
        fs::rename(&intruder, &path).expect("the entry is repointed");

        let error = verify_temp_identity(&handle, &path).expect_err("must refuse");
        match error {
            WriteError::TempFileChangedDuringWrite { path: ref reported } => {
                assert_eq!(reported, &path, "the temp file's path, not the target's")
            }
            other => panic!("expected a temp-file identity refusal, got {other}"),
        }
        assert!(
            !error.may_have_written(),
            "the refusal happens before the rename, so the target is untouched"
        );
    } // End of function the_temp_identity_check_refuses_a_name_repointed_at_another_inode()

    #[test]
    fn the_temp_identity_check_refuses_a_name_replaced_by_a_symlink() {
        // `lstat`, not `stat`, is what makes this a refusal: a symlink pointing
        // back at the very inode the descriptor holds would pass a `stat`
        // comparison, and the name would still not be the file.
        let (directory, path, handle) = open_temp_fixture();
        fs::remove_file(&path).expect("unlink");
        std::os::unix::fs::symlink(directory.path().join("_candidate.tmp.real"), &path)
            .expect("the entry becomes a symlink");

        let error = verify_temp_identity(&handle, &path).expect_err("must refuse");
        assert!(
            matches!(error, WriteError::TempFileChangedDuringWrite { .. }),
            "expected a temp-file identity refusal, got {error}"
        );
    } // End of function the_temp_identity_check_refuses_a_name_replaced_by_a_symlink()

    #[test]
    fn the_temp_identity_check_reports_a_vanished_name_as_an_io_failure() {
        // A name that is simply gone is not the same fact as a name pointing
        // somewhere else, and the step marker is what tells them apart.
        let (_directory, path, handle) = open_temp_fixture();
        fs::remove_file(&path).expect("unlink");

        let error = verify_temp_identity(&handle, &path).expect_err("must refuse");
        match error {
            WriteError::Io { step, .. } => {
                assert_eq!(step, WriteStep::VerifyTempIdentity);
                assert!(!step.after_rename(), "the check runs before the commit");
            }
            other => panic!("expected an I/O failure at the identity check, got {other}"),
        }
        assert!(!error.may_have_written());
    } // End of function the_temp_identity_check_reports_a_vanished_name_as_an_io_failure()

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
