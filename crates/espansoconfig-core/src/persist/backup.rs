//! Step 13 of plan section 6.6: **backups, and the rotation that bounds them.**
//!
//! > Before the first modification of each file **per session**, copy the file
//! > into a location that is **not** under an auto-loaded glob; retain the last
//! > **10** save batches.
//!
//! ```text
//! ~/Library/Application Support/espanso/.espansoconfig-backups/2026-07-29T143012Z/match/example.yml
//! ^ the configuration root ------------^ ^ the backup root ---^ ^ the batch --^ ^ the target's own
//!                                                                                relative path
//! ```
//!
//! # A batch is a **session**, not a save
//!
//! This is the decision everything else here follows from, and it is what makes
//! the plan's two sentences compose instead of fight.
//!
//! One [`BackupSession`] mints **one** batch directory, lazily, when it first has
//! something to put in it. Every file that session backs up goes into that one
//! directory, at most once each — so the batch is exactly *the set of files this
//! session found pristine*. Rotation then runs **once**, immediately after the
//! first copy is written into that directory, and the directory itself is
//! **excluded from removal by identity** rather than by where its name sorts. The
//! only directory holding a copy this session took is this session's own, and
//! rotation cannot consider it, however long the session runs, however many files
//! it saves and whatever the wall clock does.
//!
//! **Rotation runs after the copy, not before it.** A backup that fails must not
//! have spent one of the ten retention slots on the way, so the destructive step
//! is deferred until this session has actually written something worth retaining
//! (`docs/decisions/2a-3b-notes.md` section 4).
//!
//! Had a batch been *a save* instead, the two sentences would have collided: a
//! session that saved eleven different files would have rotated away the first
//! file's only pristine copy, and the per-session rule would have stopped it from
//! ever being taken again. That failure mode is designed out here rather than
//! documented.
//!
//! **What retention still means is ten sessions, not forever.** The eleventh
//! session after this one removes this one's batch. Nothing in this crate, and no
//! string built on it, may say *your file is recoverable*.
//!
//! # Where a backup must not go
//!
//! Espanso auto-loads `match/**/[!_]*.yml` relative to the configuration root, so
//! a backup written under `match/` **creates snippets** — the same class of bug
//! the temp file's leading `_` and `.tmp` suffix exist to prevent
//! ([`crate::persist::write::temp_file_name`]). Two things keep it out:
//!
//! - **placement.** [`BACKUP_DIRECTORY_NAME`] is a direct child of the
//!   configuration root, a *sibling* of `match/` and `config/`. No glob rooted at
//!   `match/` can reach a sibling of `match/`, whatever it is called. This is the
//!   load-bearing half;
//! - **the leading dot.** It also keeps the directory out of Finder's ordinary
//!   listing and out of shell globs. This is belt-and-braces, and it is
//!   deliberately not relied on: `glob`'s `require_literal_leading_dot` is `false`
//!   by default, so a dot is not by itself a defence.
//!
//! [`crate::discovery::enumerate`] walks `config/` and `match/` and nothing else,
//! so the backup tree is invisible to this application's own file list too.
//!
//! # What rotation is allowed to delete
//!
//! A timestamp-shaped name is **not** proof that this application minted a
//! directory: anything can create one, innocently or otherwise. So every batch
//! carries an **ownership marker** — [`BATCH_MARKER_NAME`], written when the batch
//! is created and holding [`BATCH_MARKER_FORMAT`] plus a version — and [`rotate`]
//! removes only directories that carry it. A batch-shaped directory without one is
//! [`Rotation::unrecognised`]: left exactly as found, and not counted against the
//! retention window.
//!
//! **The marker is a defence against accident, not against a hostile principal.**
//! Anything able to write inside the backup root can write a marker too. That
//! principal is the same-user attacker `docs/decisions/2a-3a-notes.md` hole 14
//! puts out of scope for the rename, and it is out of scope here for the same
//! reason: every path this module touches is resolved by pathname.
//!
//! The backup root itself is checked rather than assumed when it already exists:
//! it must be a **real directory** (never a symlink — `read_dir` through one would
//! put rotation in a tree this application does not own) and it must be private to
//! its owner. Neither check survives a concurrent attacker; both remove a whole
//! class of accident.
//!
//! # What a backup carries, and the one thing it deliberately does not
//!
//! A backup is a new inode, so it has the same metadata problem the atomic save
//! had (Phase 2a-3a). It carries:
//!
//! - **the bytes**, written from the transaction's own in-memory `source` — the
//!   exact bytes whose hash the revision check verified, never a second read;
//! - **the mode bits**, from the same `fstat` the write path uses;
//! - **the extended attributes**, through `fcopyfile(COPYFILE_XATTR)` on the
//!   descriptor `crate::persist::write::inspect_target` already holds. That
//!   includes the resource fork where the filesystem exposes it as an attribute,
//!   so the copy is the whole file rather than only its data fork.
//!
//! It does **not** carry the **access control list**, and that is a decision
//! rather than an omission. Rotation deletes directories; a copied
//! `everyone deny delete` entry makes the copy undeletable — measured, not
//! supposed (`docs/decisions/2a-3a-notes.md` section 6, measurement 5) — which
//! turns "retain the last ten" into unbounded growth of directories this
//! application can never clean up. The confidentiality argument for carrying it
//! is answered by two other mechanisms instead: the backup keeps the target's own
//! **mode bits**, and the whole backup tree is created `0o700`, so it is at most
//! as reachable as the file it copies. `docs/decisions/2a-3b-notes.md` section 5
//! argues it in full, including the residue.
//!
//! `COPYFILE_STAT` is out for the same four reasons the write path excludes it,
//! plus a fifth that is specific here: it carries BSD flags, and a `uchg` backup
//! is an unrotatable backup.
//!
//! # Not on the wire
//!
//! Nothing here derives `Serialize`, deliberately and for the reason
//! [`crate::persist::save`] states: a wire-visible enum owes `code.` namespaces in
//! **both** `src/lib/i18n/en.json` and `es.json`, and
//! `src-tauri/src/dictionary_contract.rs` fails the build without them. What this
//! sub-phase owes Phase 2c is a **path** — [`BackupSession::root`] — not a
//! command.

use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::fmt;
use std::fs::{self, DirBuilder, File, OpenOptions, Permissions};
use std::io::{self, Write};
use std::os::unix::fs::{DirBuilderExt, MetadataExt as _, OpenOptionsExt, PermissionsExt as _};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use super::write::{copy_extended_attributes, names_the_same_inode, temp_file_name};

/// The directory backups live in, directly under the configuration root.
///
/// Both halves of the name matter. The **placement** — a sibling of `match/`,
/// never a child of it — is what keeps a backup out of espanso's include glob;
/// the **leading dot** keeps it out of Finder and out of shell globs, and is
/// belt-and-braces rather than the defence.
pub const BACKUP_DIRECTORY_NAME: &str = ".espansoconfig-backups";

/// How many batches survive rotation (plan section 6.6: *"retain the last 10
/// save batches"*).
///
/// A batch is a **session**, so this is ten sessions' worth of pristine copies —
/// not ten saves, and not forever.
pub const BATCHES_RETAINED: usize = 10;

/// The batch subdirectory a target that is **not under the configuration root**
/// is copied into.
///
/// Its leading `_` puts it out of espanso's include glob a second time, which
/// costs nothing and means the answer does not depend on the backup root's
/// placement alone.
pub const OUTSIDE_CONFIG_ROOT: &str = "_outside";

/// The file every batch carries to say **this application minted it**.
///
/// [`rotate`] removes a directory only when this file is inside it, so a
/// timestamp-shaped directory somebody else created is never a candidate. The
/// leading dot keeps it out of an ordinary listing of a batch, exactly as
/// [`BACKUP_DIRECTORY_NAME`]'s does.
pub const BATCH_MARKER_NAME: &str = ".espansoconfig-batch";

/// The format identifier [`BATCH_MARKER_NAME`] begins with.
///
/// Rotation matches on **this prefix** rather than on the whole file, so a later
/// version of the marker is still recognised as this application's own and a
/// batch minted by a newer build is never orphaned by an older one.
pub const BATCH_MARKER_FORMAT: &str = "espansoconfig-backup-batch";

/// What a freshly minted batch's marker file holds: the format identifier and a
/// version.
const BATCH_MARKER_CONTENT: &str = "espansoconfig-backup-batch 1\n";

/// The mode bits an existing backup root may not have.
///
/// Group and other, in every class. A root this application created is
/// [`BACKUP_DIRECTORY_MODE`]; a root that is wider was made or widened by
/// something else, and section 5's confidentiality argument does not hold inside
/// it.
const BACKUP_DIRECTORY_FORBIDDEN_MODE: u32 = 0o077;

/// The two directory names espanso's include globs are rooted at.
///
/// A configuration root that **is** one of them would put the whole backup tree
/// under an auto-loaded glob, so [`BackupSession::capture`] refuses it rather than
/// writing loadable YAML there.
const AUTO_LOADED_DIRECTORY_NAMES: [&str; 2] = ["match", "config"];

/// How many batch names are tried before a session gives up minting one.
///
/// A collision needs two sessions to create their first backup inside the same
/// wall-clock second, which is rare in an application and routine in a test
/// suite. Sixty-four removes the argument.
const BATCH_NAME_ATTEMPTS: u32 = 64;

/// How many names **one file's copy** is offered before the publish gives up.
///
/// The same bounded-counter shape as [`BATCH_NAME_ATTEMPTS`], applied one level
/// down, and it is reached only through [`BackupSession::discard`]: each extra
/// name costs one save of one file that took a copy and then failed to commit,
/// *and* a removal of that copy that the filesystem refused. Sixty-four of those
/// in one session is not a state this application is expected to reach, and the
/// loop is bounded rather than trusting that.
const BACKUP_NAME_ATTEMPTS: u32 = 64;

/// The mode every directory in the backup tree is created with.
///
/// The tree holds copies of a user's configuration, and one of the two
/// mechanisms replacing the access control list this copy deliberately drops.
const BACKUP_DIRECTORY_MODE: u32 = 0o700;

// ---------------------------------------------------------------------------
// What one backup, and one rotation, leave the caller holding
// ---------------------------------------------------------------------------

/// How far rotation got, which is **not** the same question as what it removed.
///
/// A caller that reads only the counts cannot tell *"the root held nine batches
/// and there was nothing to do"* from *"the root could not be listed at all"* —
/// and those are opposite facts, because the second one means the tree can grow
/// without bound. This enum is the difference between them.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RotationOutcome {
    /// Rotation was not run at all.
    ///
    /// The default, and what every save of a session **after** the one that
    /// minted the batch reports: the destructive step runs once per session.
    #[default]
    NotAttempted,
    /// Rotation refused the root it was handed, because it is not a backup root.
    ///
    /// Only reachable from a programming error — see [`rotate`]'s third safety
    /// property — and deliberately distinguishable from a scan that failed.
    Refused,
    /// The root could not be listed, so nothing was examined and nothing removed.
    ///
    /// A missing root and an unreadable one are both this. The tree is **not**
    /// known to be within its retention window afterwards.
    ScanFailed,
    /// The root was listed and every entry examined.
    Scanned,
}

impl RotationOutcome {
    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(self) -> &'static str {
        match self {
            RotationOutcome::NotAttempted => "notAttempted",
            RotationOutcome::Refused => "refused",
            RotationOutcome::ScanFailed => "scanFailed",
            RotationOutcome::Scanned => "scanned",
        }
    } // End of function code()
}

impl fmt::Display for RotationOutcome {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// What rotation did, on the one call per session that runs it.
///
/// **Counts plus an outcome, never prose** (plan section 9), and never an error:
/// a rotation failure must not fail a save that has already been decided. A
/// non-zero [`Rotation::failed`], a non-zero [`Rotation::unreadable`] or an
/// outcome that is not [`RotationOutcome::Scanned`] all mean the same thing to a
/// caller — **the backup root is not known to hold at most
/// [`BATCHES_RETAINED`] batches**, which is untidy and is not dangerous.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub struct Rotation {
    /// How far rotation got.
    pub outcome: RotationOutcome,
    /// Batch directories removed.
    pub removed: usize,
    /// Batch directories rotation tried to remove and could not.
    ///
    /// The commonest reason is a permission the application does not have. The
    /// directory is left exactly as it was found.
    pub failed: usize,
    /// Entries of the backup root rotation did **not** recognise as its own, and
    /// therefore did not consider for removal or for the retention count.
    ///
    /// A foreign file or directory never consumes one of the ten slots. A
    /// timestamp-shaped directory that carries no [`BATCH_MARKER_NAME`] is one of
    /// these too: the name is a shape, and only the marker is a claim of
    /// ownership.
    pub unrecognised: usize,
    /// Entries the directory iterator itself could not produce.
    ///
    /// Distinct from [`Rotation::unrecognised`], which is an entry that *was*
    /// read and was somebody else's. This one is an entry nothing could be
    /// learned about, so it may have been a batch and was not counted as one —
    /// which is why it is counted here rather than discarded.
    pub unreadable: usize,
}

impl Rotation {
    /// Whether rotation has anything at all to report.
    ///
    /// **This is "did anything happen", not "was rotation attempted"** — use
    /// [`Rotation::outcome`] for that. It is `false` on every save of a session
    /// after the one that created the batch, because the destructive step runs
    /// **once per session**; and it is also `false` on the save that did run it
    /// when the backup root held fewer than [`BATCHES_RETAINED`] batches and
    /// nothing foreign, because there was nothing to remove and nothing to skip.
    pub fn ran(self) -> bool {
        self.removed > 0 || self.failed > 0 || self.unrecognised > 0 || self.unreadable > 0
    } // End of function ran()

    /// Whether the backup root is known to hold at most `keep` batches now.
    ///
    /// `true` only when the root was fully scanned, every entry was readable and
    /// every removal the retention window called for succeeded. **A `false` is
    /// not a failure of the save** — it is the one fact 2b may be worth a
    /// sentence for (`docs/decisions/2a-3b-notes.md` section 4.1).
    pub fn bounded(self) -> bool {
        self.outcome == RotationOutcome::Scanned && self.failed == 0 && self.unreadable == 0
    } // End of function bounded()
}

/// One file copied into one batch, plus what rotation did if this was the save
/// that created the batch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupRecord {
    /// Where the pre-save copy of the target was written.
    ///
    /// Inside [`BackupSession::root`], inside this session's batch, at the
    /// target's own path relative to the configuration root.
    pub path: PathBuf,
    /// The batch directory `path` is inside.
    pub batch: PathBuf,
    /// What rotation did. All zeroes on every save but the one that created the
    /// batch.
    pub rotation: Rotation,
}

// ---------------------------------------------------------------------------
// The failures
// ---------------------------------------------------------------------------

/// Which part of taking a backup failed.
///
/// Carried by [`BackupError::Io`] so a caller can tell them apart **without
/// parsing a sentence**, exactly as [`crate::persist::WriteStep`] is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum BackupStep {
    /// Creating `<config root>/.espansoconfig-backups`.
    ///
    /// Non-recursive: the configuration root itself is never created here.
    CreateBackupRoot,
    /// Reading an existing backup root's own metadata, to check what it is.
    InspectBackupRoot,
    /// Creating this session's batch directory inside it.
    CreateBatch,
    /// Writing the batch's ownership marker ([`BATCH_MARKER_NAME`]).
    WriteBatchMarker,
    /// Creating the directories that mirror the target's own relative path.
    CreateBackupParents,
    /// Creating the backup's **temporary** file, `0o600` and `O_EXCL`.
    CreateBackupFile,
    /// Writing the target's bytes into it.
    WriteBackupFile,
    /// Copying the target's extended attributes onto it.
    CopyExtendedAttributes,
    /// Applying the target's mode bits to it.
    ApplyModeBits,
    /// `fsync` on the finished backup, before the target is replaced.
    SyncBackupFile,
    /// Comparing the temporary file's name with the inode this call holds, before
    /// publishing it.
    VerifyBackupFile,
    /// Renaming the finished temporary file onto its final name.
    PublishBackupFile,
}

impl BackupStep {
    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(self) -> &'static str {
        match self {
            BackupStep::CreateBackupRoot => "createBackupRoot",
            BackupStep::InspectBackupRoot => "inspectBackupRoot",
            BackupStep::CreateBatch => "createBatch",
            BackupStep::WriteBatchMarker => "writeBatchMarker",
            BackupStep::CreateBackupParents => "createBackupParents",
            BackupStep::CreateBackupFile => "createBackupFile",
            BackupStep::WriteBackupFile => "writeBackupFile",
            BackupStep::CopyExtendedAttributes => "copyExtendedAttributes",
            BackupStep::ApplyModeBits => "applyModeBits",
            BackupStep::SyncBackupFile => "syncBackupFile",
            BackupStep::VerifyBackupFile => "verifyBackupFile",
            BackupStep::PublishBackupFile => "publishBackupFile",
        }
    } // End of function code()
}

impl fmt::Display for BackupStep {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// Why a backup was not taken.
///
/// **Rotation is not in here**, and that is the point: rotation cannot produce a
/// [`BackupError`] at all, because a failure to tidy old batches must never stop
/// a save. It is counted on [`Rotation`] instead.
///
/// No `Serialize`, deliberately — see the module documentation.
#[derive(Debug)]
pub enum BackupError {
    /// The filesystem refused an operation.
    Io {
        /// Which step failed.
        step: BackupStep,
        /// The path the failing operation was addressing.
        path: PathBuf,
        /// The underlying error.
        source: io::Error,
    },
    /// Every batch name this session tried already existed.
    ///
    /// It needs `BATCH_NAME_ATTEMPTS` sessions to have created their first
    /// backup inside one wall-clock second, which is not a state this
    /// application is expected to reach.
    BatchNameExhausted {
        /// The backup root the names were tried in.
        path: PathBuf,
    },
    /// Something that is not a directory already occupies a path this module
    /// creates directories at.
    ///
    /// **A symlink is the case that matters.** Adopting one would make
    /// [`rotate`]'s `read_dir` walk a tree this application does not own, and a
    /// recursive delete would follow it. The check is
    /// [`fs::symlink_metadata`]-based, so a link to a perfectly good directory is
    /// refused as loudly as a regular file is.
    NotADirectory {
        /// The path that is occupied by something else.
        path: PathBuf,
    },
    /// An existing backup root is readable, writable or traversable by somebody
    /// other than its owner.
    ///
    /// Section 5 of `docs/decisions/2a-3b-notes.md` drops the target's access
    /// control list from a backup and answers the confidentiality question with
    /// the tree's own `0o700` directories. That answer is only worth anything if
    /// it is **checked** on a root this application did not just create, which is
    /// what this refuses on.
    ///
    /// It is a mode-bit boundary and nothing more: an inherited *granting* access
    /// control entry can defeat it, and this check cannot see one.
    BackupRootNotPrivate {
        /// The offending root.
        path: PathBuf,
        /// Its permission bits, masked to the low nine.
        mode: u32,
    },
    /// The session's configuration root is itself a directory espanso's include
    /// globs are rooted at, so the whole backup tree would sit under one.
    ///
    /// `BackupSession::rooted_at(root.join("match"))` is the mistake. Nothing
    /// proves a caller's configuration root is espanso's, and a leading dot is
    /// explicitly not a defence (`glob`'s `require_literal_leading_dot` is
    /// `false`), so the copies would be loaded as configuration. Refusing before
    /// anything is created is the only direction that cannot create snippets.
    ConfigRootIsAutoLoaded {
        /// The resolved configuration root that was refused.
        path: PathBuf,
    },
    /// The backup's temporary pathname stopped naming the inode this call was
    /// writing, so it was not published.
    ///
    /// The same check, for the same reason, as
    /// `crate::persist::write`'s `verify_temp_identity`: `rename` takes two
    /// *names*, and a name can be replaced between the last write and the commit.
    /// It narrows that window and does not close it.
    TempFileChangedDuringWrite {
        /// The temporary pathname.
        path: PathBuf,
    },
    /// Something already exists at the backup's final path, and this copy was
    /// not entitled to choose another name.
    ///
    /// Inside a batch directory this session minted exclusively, that means **two
    /// different targets resolved to one backup path** — a defect, not a race —
    /// and refusing is the direction that cannot lose a backup by overwriting it
    /// silently.
    ///
    /// It is deliberately **not** what a retry of a file whose earlier copy could
    /// not be removed gets. That case is a name this session itself left occupied,
    /// [`BackupSession::discard`] records it, and the publish disambiguates rather
    /// than refusing — otherwise one failed removal would make a file unsaveable
    /// for the rest of the session.
    DestinationExists {
        /// The final path that is already occupied.
        path: PathBuf,
    },
    /// Every name this session offered one file's copy was already taken.
    ///
    /// The file-level twin of [`BackupError::BatchNameExhausted`], and it needs
    /// [`BACKUP_NAME_ATTEMPTS`] copies of one file to have been published and then
    /// left behind by a failing removal inside one session. Refusing is the
    /// direction that cannot overwrite one of them.
    BackupNameExhausted {
        /// The copy's undisambiguated final path.
        path: PathBuf,
    },
}

impl BackupError {
    /// The path the failure is about.
    pub fn path(&self) -> &Path {
        match self {
            BackupError::Io { path, .. }
            | BackupError::BatchNameExhausted { path }
            | BackupError::NotADirectory { path }
            | BackupError::BackupRootNotPrivate { path, .. }
            | BackupError::ConfigRootIsAutoLoaded { path }
            | BackupError::TempFileChangedDuringWrite { path }
            | BackupError::DestinationExists { path }
            | BackupError::BackupNameExhausted { path } => path,
        }
    } // End of function path()
}

impl fmt::Display for BackupError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BackupError::Io { step, path, source } => {
                write!(formatter, "{step} failed on {}: {source}", path.display())
            }
            BackupError::BatchNameExhausted { path } => write!(
                formatter,
                "no unused batch name was available in {}",
                path.display()
            ),
            BackupError::NotADirectory { path } => {
                write!(formatter, "{} is not a directory", path.display())
            }
            BackupError::BackupRootNotPrivate { path, mode } => write!(
                formatter,
                "{} is {mode:04o} and a backup root must be private to its owner",
                path.display()
            ),
            BackupError::ConfigRootIsAutoLoaded { path } => write!(
                formatter,
                "{} is a directory espanso loads from, so no backup may be written under it",
                path.display()
            ),
            BackupError::TempFileChangedDuringWrite { path } => write!(
                formatter,
                "{} stopped naming the backup this call wrote",
                path.display()
            ),
            BackupError::DestinationExists { path } => {
                write!(formatter, "{} already exists", path.display())
            }
            BackupError::BackupNameExhausted { path } => write!(
                formatter,
                "no unused name was available for the copy at {}",
                path.display()
            ),
        }
    } // End of function fmt() for BackupError
}

impl std::error::Error for BackupError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            BackupError::Io { source, .. } => Some(source),
            BackupError::BatchNameExhausted { .. }
            | BackupError::NotADirectory { .. }
            | BackupError::BackupRootNotPrivate { .. }
            | BackupError::ConfigRootIsAutoLoaded { .. }
            | BackupError::TempFileChangedDuringWrite { .. }
            | BackupError::DestinationExists { .. }
            | BackupError::BackupNameExhausted { .. } => None,
        }
    } // End of function source() for BackupError
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

/// The state behind [`BackupSession`]'s interior mutability.
#[derive(Debug, Default)]
struct SessionState {
    /// This session's one batch directory, once something has been put in it.
    batch: Option<PathBuf>,
    /// Whether the one destructive step this session performs has already run.
    ///
    /// Separate from `batch` because rotation happens **after** the first copy is
    /// written, not when the directory is minted: a session whose first copy
    /// failed has a batch and has not rotated, and its next copy must still
    /// rotate exactly once.
    rotated: bool,
    /// The resolved targets already copied, so the second modification of a file
    /// does not take a second backup.
    captured: HashSet<PathBuf>,
    /// The resolved targets whose discarded copy this session **failed to
    /// remove**, so the name that copy holds is taken for the rest of the session.
    ///
    /// This is what separates the two ways a backup path can already exist. Two
    /// different targets resolving to one path is a defect and is refused
    /// ([`BackupError::DestinationExists`]); a name this session itself left
    /// behind is recorded here, and the retry's publish is allowed to choose a
    /// sibling name instead of being refused for as long as the session lives.
    ///
    /// It is never cleared. A later removal that succeeds frees **that** copy's
    /// name and says nothing about the earlier one still sitting at the
    /// undisambiguated path, so forgetting the entry would refuse the next retry.
    abandoned: HashSet<PathBuf>,
}

/// One editing session's backups: where they go, and which files have already
/// had one.
///
/// # Why the session state lives here, and is injected
///
/// *"Before the first modification of each file per session"* is a statement
/// about **session** state, and `crate::persist` held none before this
/// sub-phase. Three shapes were available and two were rejected:
///
/// - **a process global** — rejected. Two configuration roots (a real one and a
///   test's) would share one set of "already backed up" paths, tests could not
///   run in parallel without interfering, and nothing could ever be reset. It
///   also makes *when a session begins* unanswerable, because a process has no
///   such event;
/// - **a second reader of [`crate::workspace::Workspace`]** — rejected. 2a-2b
///   deliberately refused to become a second owner of the session's state
///   (`docs/decisions/2a-2b-notes.md`), and a transaction that reached into the
///   caller's cache to decide whether to copy a file would be exactly that;
/// - **an explicit value the caller owns and threads through the request** —
///   chosen. The caller decides when a session starts by constructing one, the
///   transaction reads nothing it was not handed, and
///   [`crate::persist::SaveRequest::backups`] is an `Option`, so *"this save
///   takes no backup"* is something a caller **says** rather than something it
///   forgets.
///
/// It is `Sync` through one [`Mutex`], because [`crate::persist::SaveRequest`]
/// is `Copy` and holds a shared reference, and because two threads saving two
/// documents of one session must not both mint a batch directory.
///
/// # The lock order, stated because it is the shape a deadlock has
///
/// A save takes [`crate::persist::PathWriteLock`] **first** and this mutex
/// **second**, and nothing anywhere takes a path lock while holding this one.
/// The order is therefore total, and two threads saving two different documents
/// of one session cannot deadlock: the second simply waits out the first's copy.
/// The cost is that the copy — a write and one `fsync` — is serialised across a
/// session, which for the kilobytes an espanso configuration holds is not a cost
/// worth a second lock.
///
/// # What it hands Phase 2c
///
/// A **path** — [`BackupSession::root`] — and nothing else. *Reveal backups in
/// Finder* is a user interface, and it is 2c's; what 2a-3b owes it is somewhere
/// to point.
#[derive(Debug)]
pub struct BackupSession {
    /// The configuration root every backup path is taken relative to,
    /// canonicalised where that was possible.
    config_root: PathBuf,
    /// `<config_root>/.espansoconfig-backups`.
    root: PathBuf,
    /// The batch and the set of files already copied.
    state: Mutex<SessionState>,
}

impl BackupSession {
    /// Starts a session whose backups go under `config_root`.
    ///
    /// `config_root` is **canonicalised where that succeeds**, because the paths
    /// it is later compared against are
    /// [`crate::persist::PathWriteLock::path`]'s, which always are: on macOS a
    /// configuration root reached through `/var` or through a symlinked home
    /// directory would otherwise never match its own files, and every backup
    /// would land under [`OUTSIDE_CONFIG_ROOT`]. A root that cannot be
    /// canonicalised — it does not exist yet — is kept as spelled rather than
    /// refused, since nothing is written until a save actually happens.
    ///
    /// **No directory is created here.** A session that never saves anything
    /// leaves no trace on disk.
    pub fn rooted_at(config_root: &Path) -> BackupSession {
        let config_root = fs::canonicalize(config_root).unwrap_or_else(|_| config_root.to_owned());
        let root = config_root.join(BACKUP_DIRECTORY_NAME);
        BackupSession {
            config_root,
            root,
            state: Mutex::new(SessionState::default()),
        }
    } // End of function rooted_at()

    /// The backup root: `<config root>/.espansoconfig-backups`.
    ///
    /// **This is what Phase 2c reveals in Finder.** It may not exist yet — see
    /// [`BackupSession::rooted_at`] — so an affordance built on it has to say
    /// what it does about that rather than assume the directory is there.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// The configuration root backup paths are taken relative to, as this session
    /// resolved it.
    pub fn config_root(&self) -> &Path {
        &self.config_root
    }

    /// This session's batch directory, once one has been created.
    ///
    /// `None` until the first file is copied, because a session that saves
    /// nothing must not leave an empty directory behind for rotation to count.
    pub fn batch(&self) -> Option<PathBuf> {
        lock_ignoring_poison(&self.state).batch.clone()
    }

    /// Whether `target` has already been copied by this session.
    ///
    /// The question the *first modification per session* rule is made of. The
    /// path compared is the **resolved** one, so two spellings of one file are
    /// one file, exactly as they are for the write lock.
    pub fn has_captured(&self, target: &Path) -> bool {
        lock_ignoring_poison(&self.state).captured.contains(target)
    }

    /// How many files this session has copied.
    pub fn captured_count(&self) -> usize {
        lock_ignoring_poison(&self.state).captured.len()
    }

    /// Copies `target`'s pre-save bytes into this session's batch, unless it has
    /// already been copied.
    ///
    /// Answers `Ok(None)` when this session has copied `target` before, which is
    /// the *first modification per session* rule and the only reason a successful
    /// call writes nothing.
    ///
    /// `bytes` are the transaction's own in-memory `source` — the bytes whose
    /// hash the revision check verified — so **no second read of the target
    /// happens here**, which is what
    /// `docs/decisions/2a-2b-notes.md` section 8 requires of every later reader.
    /// `mode` and `handle` come from the same
    /// [`crate::persist::write::inspect_target`] call, so the mode bits and the
    /// extended attributes cannot describe a different inode than the bytes do.
    ///
    /// Rotation runs here, once per session, **after** the first copy is safely
    /// on disk — and its failures are **counted, never returned**.
    pub(super) fn capture(
        &self,
        target: &Path,
        bytes: &[u8],
        mode: &Permissions,
        handle: &File,
    ) -> Result<Option<BackupRecord>, BackupError> {
        let mut state = lock_ignoring_poison(&self.state);
        if state.captured.contains(target) {
            return Ok(None);
        }

        // Before anything is created: a configuration root that is itself an
        // auto-loaded directory would put every copy under espanso's own include
        // glob. Refusing costs the save; writing would create snippets.
        refuse_an_auto_loaded_root(&self.config_root)?;

        // The batch is minted lazily, so that a session which saves nothing
        // creates nothing.
        let batch = match &state.batch {
            Some(existing) => existing.clone(),
            None => {
                create_backup_root(&self.root)?;
                let batch = create_batch(&self.root, &batch_stamp(SystemTime::now()))?;
                state.batch = Some(batch.clone());
                batch
            }
        };

        // The publish may choose a sibling name **only** for a target whose own
        // earlier copy this session could not remove; for anything else an
        // occupied destination is still a defect and is still refused.
        let destination = batch.join(backup_relative_path(&self.config_root, target));
        let published = write_backup(
            &destination,
            bytes,
            mode,
            handle,
            state.abandoned.contains(target),
        )?;

        // **Rotation is last**, and that ordering is the decision: a backup that
        // fails must not have spent a retention slot on the way. It runs once per
        // session, and this session's own batch is excluded by identity rather
        // than by where its name happens to sort — a clock that went backwards
        // must not be able to make the directory holding this copy the oldest
        // candidate.
        let rotation = if state.rotated {
            Rotation::default()
        } else {
            state.rotated = true;
            rotate(&self.root, BATCHES_RETAINED, Some(&batch))
        };

        state.captured.insert(target.to_path_buf());
        Ok(Some(BackupRecord {
            path: published,
            batch,
            rotation,
        }))
    } // End of function capture()

    /// Undoes one [`BackupSession::capture`] whose save then did **not** commit.
    ///
    /// A backup is taken before [`crate::persist::write::replace_locked_file`]'s
    /// own pre-commit checks, which can still refuse. Without this, the file would
    /// stay recorded as copied and a retry — over a target another writer may have
    /// changed in between — would commit with **no** copy of the bytes it
    /// replaced. So the record is conditional on the commit: the target leaves
    /// `captured`, and the copy it names is removed where the filesystem allows
    /// it, so that the retry's copy can take its place.
    ///
    /// **The removal is best effort and the un-capture is unconditional.** The
    /// un-capture is what stops a retry from committing with no copy of the bytes
    /// it replaces, and that has to hold whether or not the filesystem let this
    /// copy go — so it is not made conditional on the removal.
    ///
    /// **A removal that fails is recorded rather than ignored.** The copy is still
    /// sitting at the name a retry would publish under, and the first version of
    /// this function let that stand: the retry was then refused with
    /// [`BackupError::DestinationExists`], and so was every later attempt on that
    /// file, so one refused `unlink` made the file unsaveable for the rest of the
    /// session. The target now joins [`SessionState::abandoned`], and the retry's
    /// publish takes a sibling name — nothing is overwritten, the copy left behind
    /// keeps its bytes, and no file becomes permanently unsaveable.
    ///
    /// It is **never** called when a commit may have happened: that copy is of the
    /// bytes a rename may already have replaced, and it is the only one there is.
    pub(super) fn discard(&self, target: &Path, record: &BackupRecord) {
        let mut state = lock_ignoring_poison(&self.state);
        state.captured.remove(target);
        if fs::remove_file(&record.path).is_err() {
            // Whatever the reason — a refusal, or a copy something else already
            // took away — this session can no longer claim the name is free, and
            // the conservative direction is to let the retry disambiguate. A name
            // that turns out to be free is still used first, so a spurious entry
            // costs one `symlink_metadata`.
            state.abandoned.insert(target.to_path_buf());
        }
    } // End of function discard()
}

/// Locks a mutex, treating poison as "the previous holder panicked".
///
/// The same policy [`crate::persist::write`] applies to its own locks: the state
/// behind this one is a set and an `Option`, neither of which can be left
/// half-updated by a panic, so propagating the poison would only turn one
/// panicked save into a session that can never back anything up again.
fn lock_ignoring_poison(mutex: &Mutex<SessionState>) -> std::sync::MutexGuard<'_, SessionState> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/// Where inside a batch `target`'s copy belongs.
///
/// Under the configuration root the answer is the target's own relative path, so
/// `match/example.yml` is backed up as `match/example.yml` — plan section 6.6's
/// shape, and the reason `config/default.yml` and `match/default.yml` cannot
/// collide.
///
/// **A target outside the configuration root is not a hypothetical**, and this is
/// the decision rather than an accident: it goes under [`OUTSIDE_CONFIG_ROOT`],
/// followed by its own absolute path with the root component dropped. That keeps
/// the whole path visible (so a user can tell which file it was), keeps two files
/// of the same name apart, and cannot escape the batch directory, because every
/// component that is not a plain name — the root, a prefix, `.`, `..` — is
/// dropped rather than joined. The alternative of flattening to a bare file name
/// was rejected: two files called `base.yml` would then be one backup.
///
/// # The two namespaces are disjoint, and that takes one line of work
///
/// `<config root>/_outside/foo` and the external `/foo` would otherwise both be
/// `_outside/foo` — one backup for two files, which is the data loss flattening
/// was rejected for, reached by a different road. So an **in-root** path whose
/// first component is `_outside` (or `_outside` followed by any run of `_`) gains
/// one more `_`. That escape is injective, so two in-root paths still cannot
/// collide, and it can never produce a first component of exactly `_outside`, so
/// an in-root path and an external one cannot collide either.
fn backup_relative_path(config_root: &Path, target: &Path) -> PathBuf {
    if let Ok(relative) = target.strip_prefix(config_root) {
        if relative.as_os_str().is_empty() {
            // The target *is* the configuration root, which cannot be a regular
            // file the transaction is saving. Named rather than joined, so the
            // answer is never an empty path, and escaped so that it lands in the
            // in-root namespace rather than the external one.
            return PathBuf::from(escaped_marker_name(OsStr::new(OUTSIDE_CONFIG_ROOT)));
        }
        return escape_in_root_path(relative);
    }

    let mut outside = PathBuf::from(OUTSIDE_CONFIG_ROOT);
    for component in target.components() {
        if let Component::Normal(part) = component {
            outside.push(part);
        }
    } // End of the loop over the target's path components
    outside
} // End of function backup_relative_path()

/// Moves an in-root relative path out of the external namespace, if it is in it.
///
/// Only the **first** component can collide, because the external namespace is
/// exactly one directory deep at the top of a batch. Everything else is returned
/// untouched, so the common case allocates one `PathBuf` and changes nothing.
fn escape_in_root_path(relative: &Path) -> PathBuf {
    let mut components = relative.components();
    let Some(Component::Normal(first)) = components.next() else {
        return relative.to_path_buf();
    };
    if !is_marker_shaped(first) {
        return relative.to_path_buf();
    }
    let mut escaped = PathBuf::from(escaped_marker_name(first));
    escaped.push(components.as_path());
    escaped
} // End of function escape_in_root_path()

/// Whether `name` is [`OUTSIDE_CONFIG_ROOT`] followed by a run of `_`.
///
/// The shapes the escape has to keep injective: `_outside`, `_outside_`,
/// `_outside__`, and so on. Compared as bytes, so a name that is not valid UTF-8
/// answers `false` instead of panicking.
fn is_marker_shaped(name: &OsStr) -> bool {
    let bytes = name.as_encoded_bytes();
    let Some(tail) = bytes.strip_prefix(OUTSIDE_CONFIG_ROOT.as_bytes()) else {
        return false;
    };
    tail.iter().all(|byte| *byte == b'_')
}

/// One more `_`, which is the whole escape.
fn escaped_marker_name(name: &OsStr) -> OsString {
    let mut escaped = name.to_os_string();
    escaped.push("_");
    escaped
}

/// Formats `when` as `YYYY-MM-DDTHHMMSSZ` in **UTC**, which is plan section
/// 6.6's `2026-07-29T143012Z`.
///
/// UTC rather than local time, and no separators inside the time, for three
/// reasons: the name is a directory name and `:` is a poor one; a local-time
/// stamp goes backwards an hour once a year, which would silently reorder
/// rotation; and the format sorts lexicographically in the same order it sorts
/// chronologically, which is what makes the ordering in [`rotate`] a string
/// comparison rather than a date library.
///
/// A clock before the epoch answers the epoch. This is a directory name, not a
/// measurement, and a negative duration is not worth a variant.
fn batch_stamp(when: SystemTime) -> String {
    let seconds = when
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0) as i64;
    let (year, month, day) = civil_from_days(seconds.div_euclid(86_400));
    let within_day = seconds.rem_euclid(86_400);
    let (hour, minute, second) = (
        within_day / 3_600,
        (within_day % 3_600) / 60,
        within_day % 60,
    );
    format!("{year:04}-{month:02}-{day:02}T{hour:02}{minute:02}{second:02}Z")
} // End of function batch_stamp()

/// Converts days since 1970-01-01 into a proleptic Gregorian `(year, month,
/// day)`.
///
/// Howard Hinnant's `civil_from_days`, which is the standard branch-free form of
/// this conversion and is exact for every day this program can see. It is written
/// out rather than taken from a date crate because **one directory name** is the
/// whole requirement, and a dependency whose surface is time zones, parsing and
/// localisation would be far larger than the thing it answers.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let shifted = days + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = (shifted - era * 146_097) as u64;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * shifted_month + 2) / 5 + 1) as u32;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    } as u32;
    let year = year_of_era as i64 + era * 400 + i64::from(month <= 2);
    (year, month, day)
} // End of function civil_from_days()

/// Reads a batch directory name back, or answers `None` for a name this module
/// did not mint.
///
/// **This is the shape rotation trusts**, and it is deliberately strict:
/// `YYYY-MM-DDTHHMMSSZ`, optionally followed by `-` and one to nine digits. Every
/// separator is checked in its own position and every other character must be an
/// ASCII digit, so `2026-07-29` alone, `backup`, `.DS_Store` and
/// `2026-07-29T143012Z.old` are all unrecognised and are therefore left alone.
///
/// The answer is `(stamp, counter)` so that ordering is by stamp first and by
/// counter **numerically** second — `…Z-2` is older than `…Z-10`, which a
/// lexicographic comparison of the whole name would get backwards.
fn parse_batch_name(name: &str) -> Option<(&str, u32)> {
    let bytes = name.as_bytes();
    if bytes.len() < 18 {
        return None;
    }
    let (stamp, rest) = name.split_at(18);
    let stamp_bytes = stamp.as_bytes();
    for (position, byte) in stamp_bytes.iter().enumerate() {
        let expected_separator = match position {
            4 | 7 => Some(b'-'),
            10 => Some(b'T'),
            17 => Some(b'Z'),
            _ => None,
        };
        match expected_separator {
            Some(separator) if *byte != separator => return None,
            None if !byte.is_ascii_digit() => return None,
            _ => {}
        }
    } // End of the loop over the stamp's characters

    if rest.is_empty() {
        return Some((stamp, 0));
    }
    let digits = rest.strip_prefix('-')?;
    if digits.is_empty() || digits.len() > 9 || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    Some((stamp, digits.parse().ok()?))
} // End of function parse_batch_name()

// ---------------------------------------------------------------------------
// Writing one backup
// ---------------------------------------------------------------------------

/// Refuses a configuration root espanso's include globs are rooted at.
///
/// `BackupSession::rooted_at(root.join("match"))` is the mistake this exists for,
/// and it is a plausible one: nothing proves a caller's configuration root is
/// espanso's own. The consequence is not untidiness — every backed-up file under
/// `match/.espansoconfig-backups/…` is **loadable YAML under an auto-loaded
/// glob**, so ten batches of a user's snippets would come back as live snippets.
///
/// It compares the resolved root's **final component** only. A root nested more
/// deeply inside an auto-loaded directory is not caught, and that residue is
/// stated in `docs/decisions/2a-3b-notes.md` section 9 rather than argued away:
/// widening the check to every component would refuse a legitimate root such as
/// `~/config/espanso`, which is a worse failure than the one it prevents.
fn refuse_an_auto_loaded_root(config_root: &Path) -> Result<(), BackupError> {
    let Some(name) = config_root.file_name() else {
        return Ok(());
    };
    if AUTO_LOADED_DIRECTORY_NAMES
        .iter()
        .any(|loaded| name == OsStr::new(loaded))
    {
        return Err(BackupError::ConfigRootIsAutoLoaded {
            path: config_root.to_path_buf(),
        });
    }
    Ok(())
} // End of function refuse_an_auto_loaded_root()

/// Creates the backup root, **non-recursively**, or adopts an existing one it has
/// checked.
///
/// One level only, so a mistyped configuration root produces a failure rather
/// than a new tree of empty directories somewhere the user did not mean.
///
/// **An existing root is adopted only after it has been looked at**, and the two
/// checks are the reason this function is not three lines:
///
/// - it must be a **real directory**. `AlreadyExists` covers a regular file, a
///   fifo and — the case that matters — a **symlink**, which [`rotate`]'s
///   `read_dir` would follow into a tree this application does not own, where its
///   recursive delete would then run;
/// - it must be **private to its owner**. Section 5 of
///   `docs/decisions/2a-3b-notes.md` drops the target's access control list from
///   every copy and answers the confidentiality question with this tree's `0o700`
///   directories; a root somebody widened to `0o755` makes that answer false, and
///   an unchecked assumption is exactly what the review found.
///
/// Both are checks against **accident**. Neither survives a principal who can
/// write the containing directory while this runs, and that principal is out of
/// scope for the same reason `docs/decisions/2a-3a-notes.md` hole 14 puts it out
/// of scope for the rename: every path here is resolved by pathname.
fn create_backup_root(root: &Path) -> Result<(), BackupError> {
    match DirBuilder::new().mode(BACKUP_DIRECTORY_MODE).create(root) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            let metadata = fs::symlink_metadata(root).map_err(|error| BackupError::Io {
                step: BackupStep::InspectBackupRoot,
                path: root.to_path_buf(),
                source: error,
            })?;
            if !metadata.is_dir() {
                return Err(BackupError::NotADirectory {
                    path: root.to_path_buf(),
                });
            }
            let mode = metadata.permissions().mode() & 0o777;
            if mode & BACKUP_DIRECTORY_FORBIDDEN_MODE != 0 {
                return Err(BackupError::BackupRootNotPrivate {
                    path: root.to_path_buf(),
                    mode,
                });
            }
            Ok(())
        }
        Err(error) => Err(BackupError::Io {
            step: BackupStep::CreateBackupRoot,
            path: root.to_path_buf(),
            source: error,
        }),
    }
} // End of function create_backup_root()

/// Creates this session's batch directory, disambiguating a name that is taken.
///
/// `O_EXCL` semantics through a non-recursive `mkdir`: an existing name is never
/// adopted, because two sessions sharing one batch would let the second one's
/// copies collide with the first's. The disambiguator is `-1`, `-2`, … appended
/// to the stamp, which [`parse_batch_name`] reads back and orders numerically.
///
/// **The directory is then confirmed to be one**, on the same
/// [`fs::symlink_metadata`] grounds [`create_backup_root`] adopts an existing root
/// on, and the batch's **ownership marker** is written into it before anything
/// else is: a batch without one is a batch [`rotate`] will never remove, which
/// is the safe direction but is also a directory nothing tidies.
fn create_batch(root: &Path, stamp: &str) -> Result<PathBuf, BackupError> {
    for counter in 0..BATCH_NAME_ATTEMPTS {
        let name = if counter == 0 {
            stamp.to_owned()
        } else {
            format!("{stamp}-{counter}")
        };
        let candidate = root.join(name);
        match DirBuilder::new()
            .mode(BACKUP_DIRECTORY_MODE)
            .create(&candidate)
        {
            Ok(()) => {
                let created =
                    fs::symlink_metadata(&candidate).map_err(|error| BackupError::Io {
                        step: BackupStep::CreateBatch,
                        path: candidate.clone(),
                        source: error,
                    })?;
                if !created.is_dir() {
                    return Err(BackupError::NotADirectory { path: candidate });
                }
                write_batch_marker(&candidate)?;
                return Ok(candidate);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(BackupError::Io {
                    step: BackupStep::CreateBatch,
                    path: candidate,
                    source: error,
                })
            }
        }
    } // End of the loop over batch-name attempts
    Err(BackupError::BatchNameExhausted {
        path: root.to_path_buf(),
    })
} // End of function create_batch()

/// Writes the file that says **this application minted this batch**.
///
/// A timestamp-shaped name is a shape, and a shape is not a claim of ownership: a
/// user, an archiver or another program can create one innocently, and [`rotate`]
/// would then recursively delete it. This is what rotation actually trusts.
///
/// It is created with `create_new` and `0o600`, and it holds
/// [`BATCH_MARKER_FORMAT`] and a version so that a later format can be recognised
/// by an earlier build.
fn write_batch_marker(batch: &Path) -> Result<(), BackupError> {
    let path = batch.join(BATCH_MARKER_NAME);
    let mut handle = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)
        .map_err(|error| BackupError::Io {
            step: BackupStep::WriteBatchMarker,
            path: path.clone(),
            source: error,
        })?;
    handle
        .write_all(BATCH_MARKER_CONTENT.as_bytes())
        .and_then(|()| handle.flush())
        .map_err(|error| BackupError::Io {
            step: BackupStep::WriteBatchMarker,
            path,
            source: error,
        })
} // End of function write_batch_marker()

/// Whether `batch` carries a marker this module wrote.
///
/// Read as bytes and matched on [`BATCH_MARKER_FORMAT`] as a **prefix**, so a
/// version this build does not know is still recognised as this application's.
/// Anything else — no file, a directory, a symlink, other content — answers
/// `false`, and rotation then leaves the directory alone.
fn carries_batch_marker(batch: &Path) -> bool {
    let path = batch.join(BATCH_MARKER_NAME);
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.is_file() => {}
        _ => return false,
    }
    fs::read(&path).is_ok_and(|content| content.starts_with(BATCH_MARKER_FORMAT.as_bytes()))
} // End of function carries_batch_marker()

/// Removes a backup's temporary file when the write does not reach its rename.
///
/// The same shape, and the same honesty about it, as the atomic write's own guard:
/// it *attempts* a removal on every path out of [`write_backup`], and an attempt
/// is not a guarantee. What it buys is that a failed backup leaves **nothing at
/// the destination name**, so the next attempt on that file is not refused by the
/// wreck of the last one.
struct BackupTempFile {
    /// The temporary pathname, until [`BackupTempFile::published`] forgets it.
    path: Option<PathBuf>,
}

impl BackupTempFile {
    /// Gives up ownership, because the file now has its final name.
    fn published(&mut self) {
        self.path = None;
    }
}

impl Drop for BackupTempFile {
    fn drop(&mut self) {
        if let Some(path) = &self.path {
            let _ = fs::remove_file(path);
        }
    }
}

/// Writes one backup file: the bytes, the extended attributes, the mode, one
/// `fsync`, and only then the name.
///
/// The order mirrors [`crate::persist::write`]'s: created `0o600`, filled while
/// still `0o600`, and only then widened to the target's own mode, so a copy of a
/// private file is never briefly readable by anyone the original does not admit.
/// The `fsync` is before the rename, and the rename is before the transaction's
/// own, so the backup's bytes are on disk before the file it copies is replaced.
///
/// # Why a temporary name and not `create_new` at the destination
///
/// This is 2a-1's pattern, applied to a copy for the reason 2a-1 applied it to a
/// save: **a name that exists must mean a file that is finished.** Writing
/// straight to the destination meant that a failure at any step after the create
/// left a short file under a name nothing would ever revisit — the destination
/// existed, so every later attempt in the same session failed at `create_new`,
/// and the file could not be backed up again for as long as the session lived.
/// With a temporary name, a failed attempt leaves the destination free.
///
/// The last three steps are 2a-3a's, in its order and for its reasons: the
/// pathname is proved to still name the inode this call wrote
/// (`names_the_same_inode`, the twin of `verify_temp_identity`), the destination
/// is required to be free, and only then is the file renamed onto it. The two
/// checks **narrow** the window between them and the rename and do not close it;
/// inside a batch directory one session minted exclusively there is nothing to
/// race but a defect.
///
/// `disambiguate` says whether an occupied destination may be answered with a
/// **sibling name** instead of a refusal — see [`publish_backup`]. Only
/// [`BackupSession::capture`] can say `true`, and only for a target whose own
/// earlier copy this session failed to remove.
///
/// The published path is answered rather than assumed, because it is what
/// [`BackupRecord::path`] carries and what [`BackupSession::discard`] would later
/// try to remove.
fn write_backup(
    destination: &Path,
    bytes: &[u8],
    mode: &Permissions,
    source: &File,
    disambiguate: bool,
) -> Result<PathBuf, BackupError> {
    let Some(parent) = destination.parent() else {
        return Err(BackupError::NotADirectory {
            path: destination.to_path_buf(),
        });
    };
    // The fallback is unreachable through `backup_relative_path`, which never
    // produces a path whose last component is not a plain name. It is a name
    // rather than a refusal because a temp file's name has no meaning of its own.
    let name = destination.file_name().unwrap_or(OsStr::new("backup"));
    DirBuilder::new()
        .recursive(true)
        .mode(BACKUP_DIRECTORY_MODE)
        .create(parent)
        .map_err(|error| BackupError::Io {
            step: BackupStep::CreateBackupParents,
            path: parent.to_path_buf(),
            source: error,
        })?;

    let temp_path = parent.join(temp_file_name(name));
    let mut handle = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&temp_path)
        .map_err(|error| BackupError::Io {
            step: BackupStep::CreateBackupFile,
            path: temp_path.clone(),
            source: error,
        })?;
    // Every return below this point goes through the guard, so a failure leaves
    // the destination name free for the next attempt.
    let mut guard = BackupTempFile {
        path: Some(temp_path.clone()),
    };

    handle.write_all(bytes).map_err(|error| BackupError::Io {
        step: BackupStep::WriteBackupFile,
        path: temp_path.clone(),
        source: error,
    })?;
    handle.flush().map_err(|error| BackupError::Io {
        step: BackupStep::WriteBackupFile,
        path: temp_path.clone(),
        source: error,
    })?;

    // The extended attributes, and deliberately **not** the access control list:
    // a copied `deny delete` entry would make this backup unrotatable. The module
    // documentation argues it.
    copy_extended_attributes(source, &handle).map_err(|error| BackupError::Io {
        step: BackupStep::CopyExtendedAttributes,
        path: temp_path.clone(),
        source: error,
    })?;
    handle
        .set_permissions(mode.clone())
        .map_err(|error| BackupError::Io {
            step: BackupStep::ApplyModeBits,
            path: temp_path.clone(),
            source: error,
        })?;
    handle.sync_all().map_err(|error| BackupError::Io {
        step: BackupStep::SyncBackupFile,
        path: temp_path.clone(),
        source: error,
    })?;

    if !names_the_same_inode(&handle, &temp_path).map_err(|error| BackupError::Io {
        step: BackupStep::VerifyBackupFile,
        path: temp_path.clone(),
        source: error,
    })? {
        return Err(BackupError::TempFileChangedDuringWrite { path: temp_path });
    }
    let published = publish_backup(&temp_path, destination, disambiguate)?;
    guard.published();
    Ok(published)
} // End of function write_backup()

/// Gives the finished temporary file its final name, choosing another when the
/// first is taken and `disambiguate` allows it.
///
/// # Nothing is ever overwritten
///
/// `rename` replaces silently, so the refusal `create_new` used to give is made
/// here instead: every candidate is checked to be free before the rename, and a
/// candidate that is not free is **skipped, never truncated**. A stale copy of an
/// older version of a file may be the only pristine copy there is, and losing it
/// is the data loss this whole module exists to prevent.
///
/// # Why a taken name is not always a refusal
///
/// Two different things can occupy the destination inside a batch this session
/// minted exclusively, and they want opposite answers:
///
/// - **two different targets resolving to one backup path.** A defect, not a
///   race, and one where the second copy has no business existing under that
///   name. [`BackupError::DestinationExists`], which is what this variant was
///   written for;
/// - **a copy this session took and then could not remove** when the save it was
///   for failed before its commit. Refusing that is not a safety property, it is
///   a trap: the file would be refused a backup on that retry *and on every later
///   one*, so one failed `unlink` would make it unsaveable for the rest of the
///   session. It takes the next free sibling name instead.
///
/// The caller separates them, because only the session knows which name it left
/// behind ([`SessionState::abandoned`]). The counter loop is
/// [`create_batch`]'s, one level down: `-1`, `-2`, … appended to the whole file
/// name, bounded by [`BACKUP_NAME_ATTEMPTS`], and the undisambiguated name is
/// always tried first so a copy that was removed after all is published where it
/// belongs.
fn publish_backup(
    temp_path: &Path,
    destination: &Path,
    disambiguate: bool,
) -> Result<PathBuf, BackupError> {
    // The fallback is unreachable for the same reason it is in `write_backup`:
    // `backup_relative_path` never produces a path whose last component is not a
    // plain name.
    let name = destination.file_name().unwrap_or(OsStr::new("backup"));
    for counter in 0..BACKUP_NAME_ATTEMPTS {
        let candidate = if counter == 0 {
            destination.to_path_buf()
        } else {
            let mut disambiguated = name.to_os_string();
            disambiguated.push(format!("-{counter}"));
            destination.with_file_name(disambiguated)
        };
        if fs::symlink_metadata(&candidate).is_ok() {
            if counter == 0 && !disambiguate {
                return Err(BackupError::DestinationExists {
                    path: destination.to_path_buf(),
                });
            }
            continue;
        }
        fs::rename(temp_path, &candidate).map_err(|error| BackupError::Io {
            step: BackupStep::PublishBackupFile,
            path: candidate.clone(),
            source: error,
        })?;
        return Ok(candidate);
    } // End of the loop over the names this copy may be published under
    Err(BackupError::BackupNameExhausted {
        path: destination.to_path_buf(),
    })
} // End of function publish_backup()

// ---------------------------------------------------------------------------
// Rotation — the one destructive operation in this sub-phase
// ---------------------------------------------------------------------------

/// Removes all but the newest `keep` batches from `root`, oldest first, never
/// touching `current`.
///
/// **This deletes directories, and it is the only code in this crate that
/// does.** Six properties make that safe, and each is a check rather than an
/// intention:
///
/// 1. **it only ever considers entries whose *name* is one this module mints.**
///    [`parse_batch_name`] is a strict grammar; anything else — a foreign
///    directory, a file, `.DS_Store` — is counted as
///    [`Rotation::unrecognised`], left exactly as it was, and **does not consume
///    one of the `keep` slots**;
/// 2. **a name is a shape, not a claim of ownership, so it also requires the
///    batch's marker.** [`carries_batch_marker`] must find
///    [`BATCH_MARKER_NAME`] inside the directory. A timestamp-shaped directory
///    somebody else created is [`Rotation::unrecognised`] however well its name
///    parses. The marker is forgeable by anything that can write inside the
///    backup root; that principal is out of scope here exactly as it is for the
///    rename (`docs/decisions/2a-3a-notes.md` hole 14);
/// 3. **it only ever considers real directories.** The type comes from
///    [`fs::symlink_metadata`], so a *symlink* named like a batch is not a
///    directory and is skipped; nothing here can follow a link out of the backup
///    root. [`fs::remove_dir_all`] does not follow symlinks either, so a link
///    planted *inside* a batch is removed rather than traversed;
/// 4. **it never considers `current`.** The batch this session is writing into is
///    excluded by **identity** — its `(device, inode)` pair, with its path as a
///    fallback — rather than by where its name sorts. *Newly created* does not
///    imply *newest by name*: a clock adjusted backwards, or ten future-dated
///    directories, would otherwise make the directory holding this session's own
///    copies the oldest candidate;
/// 5. **it refuses a root that is not a backup root.** The directory's own name
///    must be [`BACKUP_DIRECTORY_NAME`]. This function is private and its one
///    caller passes [`BackupSession::root`], so the check can only ever fire on a
///    programming error — which is exactly when a recursive delete most needs
///    one;
/// 6. **it cannot fail a save.** Every failure is counted on [`Rotation`] and
///    none is returned — including the two the first version of this function
///    discarded, a root that could not be listed ([`RotationOutcome::ScanFailed`])
///    and an entry the iterator could not produce ([`Rotation::unreadable`]).
///
/// The newest batches are kept, and *newest* is by name: the stamp compares as a
/// string because [`batch_stamp`]'s format sorts chronologically, and the
/// disambiguating counter compares as a number. That ordering decides **which**
/// old batch goes; it decides nothing about the current one, which property 4
/// removes from the question entirely.
fn rotate(root: &Path, keep: usize, current: Option<&Path>) -> Rotation {
    let mut rotation = Rotation::default();
    if root.file_name() != Some(OsStr::new(BACKUP_DIRECTORY_NAME)) {
        rotation.outcome = RotationOutcome::Refused;
        return rotation;
    }
    let Ok(entries) = fs::read_dir(root) else {
        rotation.outcome = RotationOutcome::ScanFailed;
        return rotation;
    };
    rotation.outcome = RotationOutcome::Scanned;
    let current_identity = current.and_then(|path| {
        fs::symlink_metadata(path)
            .ok()
            .map(|metadata| (metadata.dev(), metadata.ino()))
    });

    let mut batches: Vec<(String, u32, PathBuf)> = Vec::new();
    for entry in entries {
        let Ok(entry) = entry else {
            // An entry nothing could be read about may have been a batch, so it
            // is counted rather than dropped: the retention arithmetic below is
            // no longer complete.
            rotation.unreadable += 1;
            continue;
        };
        let path = entry.path();
        let Some(name) = path.file_name().and_then(OsStr::to_str) else {
            rotation.unrecognised += 1;
            continue;
        };
        let Some((stamp, counter)) = parse_batch_name(name) else {
            rotation.unrecognised += 1;
            continue;
        };
        // `symlink_metadata`, so a symlink that happens to be named like a batch
        // is not mistaken for the directory it points at.
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            rotation.unreadable += 1;
            continue;
        };
        if !metadata.is_dir() || !carries_batch_marker(&path) {
            rotation.unrecognised += 1;
            continue;
        }
        // The current batch is not a candidate, whatever its name says about
        // when it was made.
        if current == Some(path.as_path())
            || current_identity == Some((metadata.dev(), metadata.ino()))
        {
            continue;
        }
        batches.push((stamp.to_owned(), counter, path));
    } // End of the loop over the backup root's entries

    // `keep` counts the batches that survive, and the current one is one of them
    // even though it was never a candidate.
    let kept_elsewhere = keep.saturating_sub(usize::from(current.is_some()));
    if batches.len() <= kept_elsewhere {
        return rotation;
    }
    batches.sort_by(|left, right| (&left.0, left.1).cmp(&(&right.0, right.1)));
    for (_, _, path) in &batches[..batches.len() - kept_elsewhere] {
        match fs::remove_dir_all(path) {
            Ok(()) => rotation.removed += 1,
            Err(_) => rotation.failed += 1,
        }
    } // End of the loop that removes the batches outside the retention window
    rotation
} // End of function rotate()

#[cfg(test)]
mod tests {
    use super::*;

    /// A backup root inside a fresh temp directory, created.
    fn backup_root() -> (tempfile::TempDir, PathBuf) {
        let directory = tempfile::tempdir().expect("a temp directory");
        let root = directory.path().join(BACKUP_DIRECTORY_NAME);
        fs::create_dir(&root).expect("the backup root is created");
        (directory, root)
    }

    /// Creates a batch directory **this module owns** — the ownership marker and
    /// one payload file, so a removal is observable as more than an empty
    /// directory disappearing.
    fn seed_batch(root: &Path, name: &str) -> PathBuf {
        let batch = seed_foreign_batch(root, name);
        write_batch_marker(&batch).expect("the ownership marker is written");
        batch
    }

    /// Creates a batch-**shaped** directory that carries no ownership marker,
    /// which is what somebody else's directory looks like.
    fn seed_foreign_batch(root: &Path, name: &str) -> PathBuf {
        let batch = root.join(name);
        fs::create_dir(&batch).expect("the batch is created");
        fs::write(batch.join("payload"), b"x").expect("the payload is written");
        batch
    }

    #[test]
    fn the_batch_stamp_is_the_shape_the_plan_names() {
        assert_eq!(
            batch_stamp(UNIX_EPOCH + std::time::Duration::from_secs(1_785_335_412)),
            "2026-07-29T143012Z",
            "plan section 6.6 names this exact directory name"
        );
    }

    /// Four boundaries the hand-written civil-date conversion has to get right.
    #[test]
    fn the_batch_stamp_handles_the_epoch_a_day_boundary_and_a_leap_day() {
        let stamp =
            |seconds: u64| batch_stamp(UNIX_EPOCH + std::time::Duration::from_secs(seconds));
        assert_eq!(stamp(0), "1970-01-01T000000Z");
        assert_eq!(stamp(86_399), "1970-01-01T235959Z");
        assert_eq!(stamp(86_400), "1970-01-02T000000Z");
        assert_eq!(stamp(951_782_400), "2000-02-29T000000Z", "a leap day");
        assert_eq!(stamp(4_102_444_799), "2099-12-31T235959Z");
    } // End of function the_batch_stamp_handles_the_epoch_a_day_boundary_and_a_leap_day()

    /// The stamp a session mints is a name rotation reads back. A format and a
    /// grammar that disagreed would make every batch foreign to rotation, and
    /// nothing would ever be removed.
    #[test]
    fn every_stamp_this_module_mints_is_a_name_rotation_recognises() {
        for seconds in [0u64, 1, 86_400, 951_782_400, 1_785_335_412, 4_102_444_799] {
            let stamp = batch_stamp(UNIX_EPOCH + std::time::Duration::from_secs(seconds));
            assert_eq!(
                parse_batch_name(&stamp),
                Some((stamp.as_str(), 0)),
                "{stamp} must be recognised"
            );
            let suffixed = format!("{stamp}-7");
            assert_eq!(parse_batch_name(&suffixed), Some((stamp.as_str(), 7)));
        } // End of the loop over the sampled stamps
    } // End of function every_stamp_this_module_mints_is_a_name_rotation_recognises()

    /// The grammar is what stands between a recursive delete and a directory
    /// somebody else put here.
    #[test]
    fn a_name_this_module_did_not_mint_is_not_recognised() {
        for name in [
            "",
            "backups",
            ".DS_Store",
            "2026-07-29",
            "2026-07-29T143012",
            "2026-07-29T143012Z.old",
            "2026-07-29T143012z",
            "2026-07-29 143012Z",
            "2026-07-29T143012Z-",
            "2026-07-29T143012Z-x",
            "2026-07-29T143012Z-1234567890",
            "2026x07-29T143012Z",
            "202607-29T143012Z",
        ] {
            assert_eq!(
                parse_batch_name(name),
                None,
                "{name} must not be recognised"
            );
        } // End of the loop over the names rotation must leave alone
    } // End of function a_name_this_module_did_not_mint_is_not_recognised()

    /// Eleven batches, ten kept, and the one removed is the oldest.
    #[test]
    fn rotation_keeps_ten_batches_and_removes_the_oldest_first() {
        let (_directory, root) = backup_root();
        let mut seeded = Vec::new();
        for minute in 0..11 {
            seeded.push(seed_batch(&root, &format!("2026-07-29T14{minute:02}00Z")));
        } // End of the loop that seeds eleven batches

        let rotation = rotate(&root, BATCHES_RETAINED, None);
        assert_eq!(rotation.outcome, RotationOutcome::Scanned);
        assert_eq!(rotation.removed, 1);
        assert_eq!(rotation.failed, 0);
        assert_eq!(rotation.unrecognised, 0);
        assert_eq!(rotation.unreadable, 0);
        assert!(rotation.bounded());
        assert!(!seeded[0].exists(), "the oldest batch is the one removed");
        for kept in &seeded[1..] {
            assert!(kept.exists(), "{} must survive", kept.display());
        }
    } // End of function rotation_keeps_ten_batches_and_removes_the_oldest_first()

    /// Ten batches is the retention window, not one over it.
    #[test]
    fn rotation_removes_nothing_when_there_are_exactly_ten_batches() {
        let (_directory, root) = backup_root();
        for minute in 0..10 {
            seed_batch(&root, &format!("2026-07-29T14{minute:02}00Z"));
        }
        // A scan that found nothing to do is **not** the same fact as a scan
        // that never happened, and the outcome is what tells them apart.
        assert_eq!(
            rotate(&root, BATCHES_RETAINED, None),
            Rotation {
                outcome: RotationOutcome::Scanned,
                ..Rotation::default()
            }
        );
        assert_eq!(fs::read_dir(&root).expect("readable").count(), 10);
    }

    /// The disambiguating counter orders numerically, so `-2` is older than
    /// `-10`. A lexicographic comparison of the whole name would remove the
    /// wrong one.
    #[test]
    fn the_disambiguating_counter_orders_as_a_number_and_not_as_text() {
        let (_directory, root) = backup_root();
        let oldest = seed_batch(&root, "2026-07-29T143012Z");
        let second = seed_batch(&root, "2026-07-29T143012Z-2");
        let newest = seed_batch(&root, "2026-07-29T143012Z-10");

        let rotation = rotate(&root, 2, None);
        assert_eq!(rotation.removed, 1);
        assert!(
            !oldest.exists(),
            "the bare stamp is the oldest of the three"
        );
        assert!(second.exists());
        assert!(newest.exists(), "-10 is newer than -2");
    } // End of function the_disambiguating_counter_orders_as_a_number_and_not_as_text()

    /// A directory rotation does not recognise is left alone **and does not
    /// consume one of the ten slots**.
    #[test]
    fn rotation_leaves_a_foreign_directory_alone_and_does_not_count_it() {
        let (_directory, root) = backup_root();
        let foreign = seed_batch(&root, "somebody-elses-directory");
        let dotted = seed_batch(&root, ".hidden");
        fs::write(root.join("README"), b"not a batch").expect("a foreign file");
        let mut seeded = Vec::new();
        for minute in 0..11 {
            seeded.push(seed_batch(&root, &format!("2026-07-29T14{minute:02}00Z")));
        } // End of the loop that seeds eleven real batches beside the foreign ones

        let rotation = rotate(&root, BATCHES_RETAINED, None);
        assert_eq!(rotation.removed, 1, "only the eleventh-oldest batch goes");
        assert_eq!(rotation.unrecognised, 3, "two directories and one file");
        assert!(foreign.exists(), "a foreign directory is never removed");
        assert!(dotted.exists());
        assert!(root.join("README").exists());
        assert!(!seeded[0].exists());
    } // End of function rotation_leaves_a_foreign_directory_alone_and_does_not_count_it()

    /// A symlink named like a batch is not a batch, and is neither followed nor
    /// removed.
    #[test]
    fn rotation_does_not_follow_a_symlink_named_like_a_batch() {
        let (directory, root) = backup_root();
        let outside = directory.path().join("outside");
        fs::create_dir(&outside).expect("the directory rotation must not reach");
        fs::write(outside.join("precious"), b"x").expect("write");

        let link = root.join("2026-07-29T000000Z");
        std::os::unix::fs::symlink(&outside, &link).expect("the symlink is created");
        for minute in 1..12 {
            seed_batch(&root, &format!("2026-07-29T14{minute:02}00Z"));
        }

        let rotation = rotate(&root, BATCHES_RETAINED, None);
        assert_eq!(
            rotation.unrecognised, 1,
            "the symlink is not a directory this module created"
        );
        assert!(
            outside.join("precious").exists(),
            "nothing outside the backup root may be reached through a link"
        );
        assert!(link.symlink_metadata().is_ok(), "the link itself is left");
    } // End of function rotation_does_not_follow_a_symlink_named_like_a_batch()

    /// A directory that is not a backup root is not rotated, however its children
    /// are named. The one caller cannot reach this, which is why it is checked.
    #[test]
    fn rotation_refuses_a_root_that_is_not_the_backup_root() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let pretender = directory.path().join("not-the-backup-root");
        fs::create_dir(&pretender).expect("created");
        let mut seeded = Vec::new();
        for minute in 0..11 {
            seeded.push(seed_batch(
                &pretender,
                &format!("2026-07-29T14{minute:02}00Z"),
            ));
        }

        assert_eq!(
            rotate(&pretender, BATCHES_RETAINED, None),
            Rotation {
                outcome: RotationOutcome::Refused,
                ..Rotation::default()
            }
        );
        for batch in &seeded {
            assert!(batch.exists(), "nothing outside a backup root is removed");
        }
    } // End of function rotation_refuses_a_root_that_is_not_the_backup_root()

    /// A backup root that does not exist is not an error and is not a panic.
    #[test]
    fn rotation_over_a_missing_root_does_nothing() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let missing = directory.path().join(BACKUP_DIRECTORY_NAME);
        // A root that cannot be listed is a **scan failure**, not "nothing to
        // do": the tree is not known to be within its retention window
        // afterwards, and a caller that cannot tell the two apart cannot say so.
        let rotation = rotate(&missing, BATCHES_RETAINED, None);
        assert_eq!(rotation.outcome, RotationOutcome::ScanFailed);
        assert!(!rotation.bounded(), "nothing was examined");
        assert!(!rotation.ran(), "and nothing happened");
    }

    /// The plan's own example path, reproduced by the two functions that build
    /// it.
    #[test]
    fn a_target_under_the_config_root_keeps_its_relative_path() {
        let root = Path::new("/tmp/espanso");
        assert_eq!(
            backup_relative_path(root, Path::new("/tmp/espanso/match/example.yml")),
            PathBuf::from("match/example.yml")
        );
        assert_eq!(
            backup_relative_path(root, Path::new("/tmp/espanso/config/default.yml")),
            PathBuf::from("config/default.yml")
        );
    } // End of function a_target_under_the_config_root_keeps_its_relative_path()

    /// A target outside the configuration root goes under `_outside`, keeps its
    /// whole path, and **cannot escape the batch directory**.
    #[test]
    fn a_target_outside_the_config_root_is_named_rather_than_flattened() {
        let root = Path::new("/tmp/espanso");
        let outside = backup_relative_path(root, Path::new("/somewhere/else/base.yml"));
        assert_eq!(outside, PathBuf::from("_outside/somewhere/else/base.yml"));
        assert!(
            outside.starts_with(OUTSIDE_CONFIG_ROOT),
            "the marker directory is what tells a reader this path is not relative"
        );

        // Two files of the same name stay two backups.
        let other = backup_relative_path(root, Path::new("/elsewhere/base.yml"));
        assert_ne!(outside, other);

        // Nothing a caller can spell escapes the batch: every component that is
        // not a plain name is dropped.
        let hostile = backup_relative_path(root, Path::new("/../../../etc/passwd"));
        assert_eq!(hostile, PathBuf::from("_outside/etc/passwd"));
        assert!(hostile
            .components()
            .all(|component| !matches!(component, Component::ParentDir | Component::RootDir)));
    } // End of function a_target_outside_the_config_root_is_named_rather_than_flattened()

    /// A session creates nothing until it is asked to copy something.
    #[test]
    fn a_session_that_saves_nothing_leaves_no_directory_behind() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let session = BackupSession::rooted_at(directory.path());
        assert!(!session.root().exists());
        assert!(session.batch().is_none());
        assert_eq!(session.captured_count(), 0);
        assert!(session
            .root()
            .file_name()
            .is_some_and(|name| name == OsStr::new(BACKUP_DIRECTORY_NAME)));
    } // End of function a_session_that_saves_nothing_leaves_no_directory_behind()

    /// The backup file is created `0o600` and ends wearing the source's mode, so
    /// a copy is never briefly wider than the file it copies.
    #[test]
    fn a_backup_file_ends_with_the_modes_it_was_given() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let source_path = directory.path().join("source.yml");
        fs::write(&source_path, b"matches: []\n").expect("write");
        fs::set_permissions(&source_path, Permissions::from_mode(0o640)).expect("chmod");
        let source = File::open(&source_path).expect("open");

        let destination = directory.path().join("batch/match/source.yml");
        write_backup(
            &destination,
            b"matches: []\n",
            &Permissions::from_mode(0o640),
            &source,
            false,
        )
        .expect("the backup is written");

        assert_eq!(fs::read(&destination).expect("read"), b"matches: []\n");
        assert_eq!(
            fs::metadata(&destination)
                .expect("stat")
                .permissions()
                .mode()
                & 0o777,
            0o640
        );
        assert_eq!(
            fs::metadata(destination.parent().expect("a parent"))
                .expect("stat")
                .permissions()
                .mode()
                & 0o777,
            BACKUP_DIRECTORY_MODE,
            "every directory of the backup tree is private"
        );
    } // End of function a_backup_file_ends_with_the_modes_it_was_given()

    /// Two sessions minting a batch in the same second get two directories, not
    /// one shared one.
    #[test]
    fn two_batches_minted_in_one_second_do_not_share_a_directory() {
        let (_directory, root) = backup_root();
        let stamp = batch_stamp(SystemTime::now());
        let first = create_batch(&root, &stamp).expect("the first batch");
        let second = create_batch(&root, &stamp).expect("the second batch");
        assert_ne!(first, second);
        assert_eq!(first.file_name().expect("a name"), OsStr::new(&stamp));
        assert!(parse_batch_name(
            second
                .file_name()
                .and_then(OsStr::to_str)
                .expect("a UTF-8 name")
        )
        .is_some());
    } // End of function two_batches_minted_in_one_second_do_not_share_a_directory()

    // -----------------------------------------------------------------------
    // The review round: what rotation is allowed to delete, and what a root is
    // -----------------------------------------------------------------------

    /// **A backup root that is a symlink is refused, not adopted.**
    ///
    /// Adopting one would put `read_dir` — and then a recursive delete — in a
    /// tree this application does not own. The link and everything behind it are
    /// left exactly as they were.
    #[test]
    fn an_existing_backup_root_that_is_a_symlink_is_refused() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let elsewhere = directory.path().join("elsewhere");
        fs::create_dir(&elsewhere).expect("the tree rotation must never reach");
        let precious = seed_batch(&elsewhere, "2026-07-29T140000Z");

        let root = directory.path().join(BACKUP_DIRECTORY_NAME);
        std::os::unix::fs::symlink(&elsewhere, &root).expect("the link is created");

        let error = create_backup_root(&root).expect_err("a symlinked root is refused");
        assert!(
            matches!(&error, BackupError::NotADirectory { path } if path == &root),
            "got {error}"
        );
        assert!(
            precious.join("payload").exists(),
            "nothing behind the link may be touched"
        );
        assert!(root.symlink_metadata().is_ok(), "the link itself is left");
    } // End of function an_existing_backup_root_that_is_a_symlink_is_refused()

    /// A regular file where the backup root belongs is refused with the same
    /// answer, and the transaction's own test reaches this through a save.
    #[test]
    fn an_existing_backup_root_that_is_a_file_is_refused() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let root = directory.path().join(BACKUP_DIRECTORY_NAME);
        fs::write(&root, b"not a directory").expect("the obstruction");
        let error = create_backup_root(&root).expect_err("a file is not a root");
        assert!(
            matches!(error, BackupError::NotADirectory { .. }),
            "got {error}"
        );
    }

    /// **An existing backup root that anybody else can reach is refused.**
    ///
    /// Section 5 drops the target's access control list from every copy and
    /// answers the confidentiality question with this tree's `0o700` directories.
    /// A root somebody widened makes that answer false, and an unchecked
    /// assumption is not an answer at all.
    #[test]
    fn an_existing_backup_root_that_is_not_private_is_refused() {
        let (_directory, root) = backup_root();
        for mode in [0o755u32, 0o750, 0o707, 0o701] {
            fs::set_permissions(&root, Permissions::from_mode(mode)).expect("chmod");
            let error = create_backup_root(&root)
                .expect_err("a root reachable by another principal is refused");
            assert!(
                matches!(&error, BackupError::BackupRootNotPrivate { mode: found, .. } if *found == mode),
                "{mode:04o} got {error}"
            );
        } // End of the loop over the modes a backup root may not have

        fs::set_permissions(&root, Permissions::from_mode(0o700)).expect("chmod");
        create_backup_root(&root).expect("a private root is adopted");
        fs::set_permissions(&root, Permissions::from_mode(0o500)).expect("chmod");
        create_backup_root(&root).expect("narrower than 0o700 is still private");
        fs::set_permissions(&root, Permissions::from_mode(0o700)).expect("chmod back");
    } // End of function an_existing_backup_root_that_is_not_private_is_refused()

    /// **A timestamp-shaped name is not proof this module minted a directory.**
    ///
    /// Only the ownership marker is, so a batch-shaped directory without one is
    /// unrecognised: never removed, and never counted against the retention
    /// window.
    #[test]
    fn rotation_leaves_a_batch_shaped_directory_that_carries_no_marker() {
        let (_directory, root) = backup_root();
        let foreign = seed_foreign_batch(&root, "2026-07-29T000000Z");
        let nonsense = seed_foreign_batch(&root, "9999-99-99T999999Z");
        let mut mine = Vec::new();
        for minute in 0..11 {
            mine.push(seed_batch(&root, &format!("2026-07-29T14{minute:02}00Z")));
        } // End of the loop that seeds eleven batches this module owns

        let rotation = rotate(&root, BATCHES_RETAINED, None);
        assert_eq!(
            rotation.removed, 1,
            "only a directory carrying the marker is a candidate"
        );
        assert_eq!(rotation.unrecognised, 2, "both unmarked directories");
        assert!(
            foreign.join("payload").exists(),
            "a directory whose name merely parses is somebody else's"
        );
        assert!(
            nonsense.join("payload").exists(),
            "the grammar does not check calendar ranges, and the marker is why that is safe"
        );
        assert!(
            !mine[0].exists(),
            "the oldest marked batch is the one removed"
        );
    } // End of function rotation_leaves_a_batch_shaped_directory_that_carries_no_marker()

    /// A marker file with somebody else's content is not this module's marker.
    #[test]
    fn a_marker_of_another_format_is_not_recognised() {
        let (_directory, root) = backup_root();
        let batch = seed_foreign_batch(&root, "2026-07-29T140000Z");
        fs::write(batch.join(BATCH_MARKER_NAME), b"somebody else's file\n").expect("written");
        assert!(!carries_batch_marker(&batch));

        // A directory, and a symlink to a real marker, are both refused too: the
        // check is `symlink_metadata`-based for the reason the root's is.
        let second = seed_foreign_batch(&root, "2026-07-29T140100Z");
        fs::create_dir(second.join(BATCH_MARKER_NAME)).expect("a directory in its place");
        assert!(!carries_batch_marker(&second));

        let third = seed_batch(&root, "2026-07-29T140200Z");
        assert!(carries_batch_marker(&third), "the one this module writes");
        let fourth = seed_foreign_batch(&root, "2026-07-29T140300Z");
        std::os::unix::fs::symlink(
            third.join(BATCH_MARKER_NAME),
            fourth.join(BATCH_MARKER_NAME),
        )
        .expect("the link is created");
        assert!(!carries_batch_marker(&fourth));

        // And a later version of the marker still is one, so an older build does
        // not orphan a newer build's batches.
        let fifth = seed_foreign_batch(&root, "2026-07-29T140400Z");
        fs::write(
            fifth.join(BATCH_MARKER_NAME),
            format!("{BATCH_MARKER_FORMAT} 99\n"),
        )
        .expect("written");
        assert!(carries_batch_marker(&fifth));
    } // End of function a_marker_of_another_format_is_not_recognised()

    /// **The batch being written is never a candidate, whatever the clock did.**
    ///
    /// Ten future-dated batches make the current one the *oldest* by name, which
    /// is exactly the state a wall clock adjusted backwards produces. Ordering
    /// decides which old batch goes; it decides nothing about this one.
    #[test]
    fn rotation_never_removes_the_batch_it_was_told_is_current() {
        let (_directory, root) = backup_root();
        let current = seed_batch(&root, "2020-01-01T000000Z");
        let mut future = Vec::new();
        for minute in 0..10 {
            future.push(seed_batch(&root, &format!("2099-12-31T23{minute:02}00Z")));
        } // End of the loop that seeds ten batches dated after the current one

        let rotation = rotate(&root, BATCHES_RETAINED, Some(&current));
        assert!(
            current.join("payload").exists(),
            "the directory holding this session's copies is excluded by identity"
        );
        assert_eq!(
            rotation.removed, 1,
            "ten kept means nine besides the current one"
        );
        assert!(
            !future[0].exists(),
            "the oldest of the others is the one that goes"
        );

        // And the same exclusion holds when the current batch is named as a
        // different path that resolves to the same directory.
        let (_second_directory, second_root) = backup_root();
        let mine = seed_batch(&second_root, "2020-01-01T000000Z");
        for minute in 0..10 {
            seed_batch(&second_root, &format!("2099-12-31T23{minute:02}00Z"));
        }
        let spelled_differently = second_root.join(".").join("2020-01-01T000000Z");
        rotate(&second_root, BATCHES_RETAINED, Some(&spelled_differently));
        assert!(
            mine.join("payload").exists(),
            "the exclusion is by (device, inode), not only by spelling"
        );
    } // End of function rotation_never_removes_the_batch_it_was_told_is_current()

    /// **The two namespaces are disjoint**, so an in-root `_outside/…` and an
    /// external path cannot become one backup.
    #[test]
    fn an_in_root_outside_directory_does_not_collide_with_an_external_path() {
        let root = Path::new("/tmp/espanso");
        let external = backup_relative_path(root, Path::new("/foo/base.yml"));
        let in_root = backup_relative_path(root, Path::new("/tmp/espanso/_outside/foo/base.yml"));
        assert_eq!(external, PathBuf::from("_outside/foo/base.yml"));
        assert_eq!(in_root, PathBuf::from("_outside_/foo/base.yml"));
        assert_ne!(
            external, in_root,
            "two files must never be one backup, whatever they are called"
        );

        // The escape is injective, so it cannot make two in-root paths collide
        // either, however many times it is applied.
        assert_eq!(
            backup_relative_path(root, Path::new("/tmp/espanso/_outside_/foo/base.yml")),
            PathBuf::from("_outside__/foo/base.yml")
        );
        assert_ne!(
            backup_relative_path(root, Path::new("/tmp/espanso/_outside_/x.yml")),
            backup_relative_path(root, Path::new("/tmp/espanso/_outside/x.yml"))
        );

        // Only the first component is in the external namespace, so nothing
        // deeper is touched.
        assert_eq!(
            backup_relative_path(root, Path::new("/tmp/espanso/match/_outside/x.yml")),
            PathBuf::from("match/_outside/x.yml")
        );
        // And a name that merely begins with the marker is not the marker.
        assert_eq!(
            backup_relative_path(root, Path::new("/tmp/espanso/_outsiders/x.yml")),
            PathBuf::from("_outsiders/x.yml")
        );
    } // End of function an_in_root_outside_directory_does_not_collide_with_an_external_path()

    /// **A backup that fails to publish leaves the destination name free**, which
    /// is what stops one partial copy poisoning every later attempt on that file.
    ///
    /// The obstruction is a directory at the destination path, so the write runs
    /// all the way through — bytes, attributes, mode, `fsync` — and only the
    /// publication fails. The step in the error is the assertion that bites: a
    /// version that created the destination directly would fail at
    /// [`BackupStep::CreateBackupFile`] instead, with a short file left behind.
    #[test]
    fn a_backup_that_cannot_be_published_leaves_no_temporary_file_behind() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let source_path = directory.path().join("source.yml");
        fs::write(&source_path, b"matches: []\n").expect("write");
        let source = File::open(&source_path).expect("open");

        let batch = directory.path().join("batch");
        let destination = batch.join("base.yml");
        fs::create_dir_all(&destination).expect("a directory where the copy belongs");

        let error = write_backup(
            &destination,
            b"matches: []\n",
            &Permissions::from_mode(0o600),
            &source,
            false,
        )
        .expect_err("the copy cannot be published");
        assert!(
            matches!(&error, BackupError::DestinationExists { path } if path == &destination),
            "the whole copy is written before its name is taken, so this is a publication \
             failure and not a creation one: got {error}"
        );
        assert_eq!(
            fs::read_dir(&batch).expect("readable").count(),
            1,
            "only the obstruction is left: no half-written copy, and no temporary file"
        );

        // And with the obstruction gone, the same call succeeds — the failure
        // poisoned nothing.
        fs::remove_dir(&destination).expect("the obstruction is removed");
        write_backup(
            &destination,
            b"matches: []\n",
            &Permissions::from_mode(0o600),
            &source,
            false,
        )
        .expect("the retry writes the copy");
        assert_eq!(fs::read(&destination).expect("read"), b"matches: []\n");
        assert_eq!(
            fs::read_dir(&batch).expect("readable").count(),
            1,
            "a published copy leaves its temporary name behind it"
        );
    } // End of function a_backup_that_cannot_be_published_leaves_no_temporary_file_behind()

    /// **A copy this session could not remove does not make its file unsaveable
    /// for the rest of the session.**
    ///
    /// [`BackupSession::discard`] un-captures unconditionally and removes the copy
    /// best effort. When the removal is refused, the copy stays at the name a
    /// retry would publish under — and the first version of this module then
    /// refused that retry with [`BackupError::DestinationExists`], and every later
    /// attempt on the same file too. The retry now takes the next free sibling
    /// name, and both properties are asserted here: the retry gets its own copy,
    /// and the copy left behind still holds **its own** bytes, because it may be
    /// the only pristine version of that file there is.
    ///
    /// The removal is refused by making the copy's own parent directory
    /// unwritable for exactly the length of the `discard` call, which is a
    /// sabotage a whole transaction cannot stage: the batch is minted inside the
    /// save that then fails, so there is no moment between the copy and the
    /// removal for a test to reach.
    #[test]
    fn a_retry_publishes_beside_a_copy_that_could_not_be_removed() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let config_root = directory.path().join("espanso");
        fs::create_dir_all(config_root.join("match")).expect("a configuration root");
        fs::write(config_root.join("match/base.yml"), b"first\n").expect("write");
        // Canonicalised, because `PathWriteLock::path` is and `rooted_at` is:
        // a target spelled another way lands under `_outside`, which is a
        // different path rule than the one this test is about.
        let target = fs::canonicalize(config_root.join("match/base.yml")).expect("canonicalize");
        let handle = File::open(&target).expect("open");
        let session = BackupSession::rooted_at(&config_root);
        let mode = Permissions::from_mode(0o600);

        let first = session
            .capture(&target, b"first\n", &mode, &handle)
            .expect("the first copy is written")
            .expect("a target this session has not copied is copied");

        // The sabotage: the copy's parent is made unwritable, so `discard`'s
        // `remove_file` is refused and the copy stays where it was published.
        let parent = first
            .path
            .parent()
            .expect("the copy has a parent")
            .to_owned();
        fs::set_permissions(&parent, Permissions::from_mode(0o500)).expect("chmod");
        session.discard(&target, &first);
        fs::set_permissions(&parent, Permissions::from_mode(0o700)).expect("chmod");
        assert!(
            first.path.exists(),
            "the removal was refused, which is the state this test is about"
        );
        assert!(
            !session.has_captured(&target),
            "the un-capture is unconditional: a retry must not commit without a copy"
        );

        // The retry, in the same session, over the same file.
        let second = session
            .capture(&target, b"second\n", &mode, &handle)
            .expect("the retry is not refused by the copy it could not remove")
            .expect("and it takes its own copy");
        assert_ne!(
            second.path, first.path,
            "a retry publishes under another name rather than over the copy there"
        );
        assert_eq!(second.batch, first.batch, "one session is still one batch");
        assert_eq!(
            fs::read(&first.path).expect("readable"),
            b"first\n",
            "the copy left behind keeps its own bytes, and may be the only pristine one"
        );
        assert_eq!(
            fs::read(&second.path).expect("readable"),
            b"second\n",
            "and the retry's copy is the bytes the retry replaces"
        );
    } // End of function a_retry_publishes_beside_a_copy_that_could_not_be_removed()

    /// The disambiguated name is a **sibling**, and it is the counter loop
    /// `create_batch` already uses rather than a second scheme.
    #[test]
    fn a_disambiguated_copy_keeps_its_name_and_gains_a_counter() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let batch = directory.path().join("batch");
        fs::create_dir(&batch).expect("a batch");
        let destination = batch.join("base.yml");

        for counter in 0..3u32 {
            let temp = batch.join(format!("temp-{counter}"));
            fs::write(&temp, format!("copy {counter}\n")).expect("a finished temporary file");
            let published =
                publish_backup(&temp, &destination, true).expect("a free name is always found");
            let expected = if counter == 0 {
                destination.clone()
            } else {
                batch.join(format!("base.yml-{counter}"))
            };
            assert_eq!(published, expected);
            assert_eq!(
                fs::read(&published).expect("readable"),
                format!("copy {counter}\n").as_bytes()
            );
        } // End of the loop that publishes three copies of one file

        // And every earlier copy survived: disambiguation chooses a name, it
        // never truncates the one that is there.
        assert_eq!(fs::read(&destination).expect("readable"), b"copy 0\n");
        assert_eq!(
            fs::read(batch.join("base.yml-1")).expect("readable"),
            b"copy 1\n"
        );
    } // End of function a_disambiguated_copy_keeps_its_name_and_gains_a_counter()

    /// A batch this module mints carries its ownership marker from the moment it
    /// exists, so a crash between the `mkdir` and the first copy still leaves a
    /// directory rotation can tidy.
    #[test]
    fn a_batch_is_born_carrying_its_ownership_marker() {
        let (_directory, root) = backup_root();
        let batch = create_batch(&root, &batch_stamp(SystemTime::now())).expect("a batch");
        assert!(carries_batch_marker(&batch));
        assert_eq!(
            fs::read(batch.join(BATCH_MARKER_NAME)).expect("readable"),
            BATCH_MARKER_CONTENT.as_bytes()
        );
        assert!(
            BATCH_MARKER_CONTENT.starts_with(BATCH_MARKER_FORMAT),
            "the format identifier is the prefix rotation matches on"
        );
    } // End of function a_batch_is_born_carrying_its_ownership_marker()

    /// **A configuration root that is itself an auto-loaded directory is
    /// refused**, because every copy under it would be loadable YAML inside
    /// espanso's own include glob.
    #[test]
    fn a_configuration_root_espanso_loads_from_is_refused() {
        for name in AUTO_LOADED_DIRECTORY_NAMES {
            let root = Path::new("/tmp/espanso").join(name);
            let error = refuse_an_auto_loaded_root(&root)
                .expect_err("a root espanso loads from is refused");
            assert!(
                matches!(&error, BackupError::ConfigRootIsAutoLoaded { path } if path == &root),
                "got {error}"
            );
        } // End of the loop over the directories espanso's globs are rooted at
        refuse_an_auto_loaded_root(Path::new("/tmp/espanso")).expect("an ordinary root passes");
        refuse_an_auto_loaded_root(Path::new("/tmp/config/espanso"))
            .expect("only the final component is the mistake this catches");
    } // End of function a_configuration_root_espanso_loads_from_is_refused()
}
