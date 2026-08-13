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
//! **What retention still means is a bound, not forever.** Rotation attempts to
//! retain at most ten recognised batch directories, chosen by their sortable
//! names. A later session may remove this batch, and no retention duration or
//! recoverability is promised. Nothing in this crate, and no string built on it,
//! may say *your file is recoverable*.
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
//! reason: every path the **write** side touches is resolved by pathname, so a
//! principal able to race it is already able to write the bytes it protects.
//!
//! That reason does **not** extend to the read side, and the difference is
//! deliberate rather than an inconsistency. [`BackupCatalog`] resolves a batch
//! descriptor-relative on macOS, so a raced substitution below the opened root
//! cannot be followed there; off macOS it resolves by pathname and one can be.
//! What the marker is worth is unchanged on either: recognition, never
//! provenance.
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
//! # On the wire since Phase 2b-1
//!
//! [`BackupError`], [`BackupStep`], [`RotationOutcome`], [`Rotation`] and
//! [`BackupRecord`] serialize, and every variant of the three enums has a `code.`
//! entry in **both** `src/lib/i18n/en.json` and `es.json` —
//! `src-tauri/src/dictionary_contract.rs` fails the build without them.
//!
//! **A serialized [`BackupRecord`] is display data and counts, and it is not a
//! promise.** Rotation attempts to retain at most [`BATCHES_RETAINED`] recognised
//! batch directories chosen by sortable name; it promises neither successful
//! cleanup nor any retention duration, so no string built on it may say a file is
//! recoverable; and a
//! [`Rotation::bounded`] that answers `false` is a claim about *tidiness* — the
//! root may now hold more than ten batches — never about safety. What this
//! sub-phase still owes Phase 2c is a **path**, [`BackupSession::root`], and that
//! directory may not exist.
//!
//! # The read side, since Phase 2c-5-1
//!
//! Everything above is the **write** side. [`BackupCatalog`] is the other half:
//! a stateless, non-mutating view of the same tree, which **creates nothing,
//! removes nothing and rotates nothing.** It lists recognised batches
//! ([`BackupCatalog::scan_batches`]), walks one batch's entries
//! ([`BackupCatalog::scan_entries`]), maps a live target to the entry its copy
//! would be at ([`BackupCatalog::entry_for_target`]) and reads one entry's exact
//! bytes ([`BackupCatalog::read_entry`]).
//!
//! Four rules bind it, and each is a check rather than an intention:
//!
//! - **it shares this module's ordering and its path mapping rather than
//!   copying them.** [`compare_batches_newest_first`] is the one place the
//!   `(stamp, counter)` tuple becomes an order — [`rotate`] reverses *that*
//!   comparison to reach the lowest-sorting name — and [`BackupTarget`] is the
//!   backward direction of [`backup_relative_path`], so the two directions of one
//!   mapping cannot come to disagree. **The mapping is not total, and the
//!   exception is named rather than assumed**: a target equal to the
//!   configuration root goes forwards onto a sentinel that comes back as
//!   something else, which is unreachable from the write side and refused by
//!   [`BackupCatalog::entry_for_target`];
//! - **an identity is a question, not a handle.** [`BackupBatchId`] and
//!   [`BackupEntryId`] are opaque, carry no absolute path, and are re-resolved
//!   against the tree on **every** use, because rotation or another process may
//!   change it between two calls. A batch or an entry that has gone is a typed
//!   [`BackupReadError::StaleBatch`] or [`BackupReadError::StaleEntry`], never an
//!   empty listing and never an empty file;
//! - **the same boundary [`rotate`] enforces is what it reads.** Foreign names,
//!   unmarked batch-shaped directories, regular files and symlinked batch names
//!   are skipped, reported through [`BatchSkipped`]/[`EntrySkipped`], and never
//!   counted as eligible; only real regular files are offered; and a root that
//!   is a symlink, is not a directory or is not private is refused exactly as
//!   [`create_backup_root`] refuses it. A **missing** root is an outcome
//!   ([`BackupRootState::Missing`]) rather than a failure, because that is the
//!   ordinary state of a configuration nothing has been saved from.
//!
//!   **How far *no symlink is followed* goes depends on the target, and both
//!   answers are written out rather than averaged into one that is true of
//!   neither.** On **macOS** the walk is anchored in open directory
//!   descriptors: the root is opened `O_DIRECTORY | O_NOFOLLOW`, every child is
//!   opened relative to its already-open parent with `openat(…, O_NOFOLLOW)`,
//!   what was opened is confirmed by `fstat` on the descriptor, and a read uses
//!   that same descriptor — so nothing **inside** the backup tree is resolved by
//!   pathname and a component swapped for a symlink *after* it was checked
//!   cannot be followed, because there is no second name lookup to race. The one
//!   pathname resolution left is the backup root's own, whose final component
//!   `O_NOFOLLOW` protects and whose ancestors are the caller's configuration
//!   root. On **every other target** the components are checked with
//!   [`fs::symlink_metadata`] and the listing or open that follows is a
//!   pathname operation, so a link
//!   **already present** is refused and a component swapped between the check
//!   and the use **can still be followed**. That is a documented limitation of
//!   those builds — the crate is meant to build, test and fuzz anywhere while
//!   the application ships on macOS alone — and it is stated here because a
//!   guarantee that quietly becomes a no-op off its own platform is worse than
//!   one that was never claimed;
//! - **everything it hands back is untrusted input.** The marker means
//!   *recognised as this application's batch format* and is deliberately
//!   forgeable by anything able to write inside the backup root, so nothing here
//!   is evidence that this application wrote a file or preserved its bytes.
//!   [`BackupBytes`] is exactly what was read, and [`BackupBytes::utf8`] refuses
//!   at the first invalid byte rather than decoding lossily.

use std::cmp::Ordering;
use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::fmt;
use std::fs::{self, DirBuilder, File, OpenOptions, Permissions};
use std::io::{self, Read, Write};
use std::os::unix::fs::{DirBuilderExt, MetadataExt as _, OpenOptionsExt, PermissionsExt as _};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::ser::{SerializeStruct, SerializeStructVariant, Serializer};
use serde::Serialize;

use crate::wire::{io_kind_name, io_raw_os_error, WirePath, WirePathRef};
use crate::ContentRevision;

use super::write::{copy_extended_attributes, names_the_same_inode, temp_file_name};

/// The directory backups live in, directly under the configuration root.
///
/// Both halves of the name matter. The **placement** — a sibling of `match/`,
/// never a child of it — is what keeps a backup out of espanso's include glob;
/// the **leading dot** keeps it out of Finder and out of shell globs, and is
/// belt-and-braces rather than the defence.
pub const BACKUP_DIRECTORY_NAME: &str = ".espansoconfig-backups";

/// How many recognised batches rotation **attempts** to leave in place (plan
/// section 6.6: *"retain the last 10 save batches"*).
///
/// A batch is a **session**, so this is a bound on sessions rather than on saves,
/// and it is neither forever nor a duration: [`rotate`] chooses by sortable name,
/// can fail, and can meet entries it cannot read.
pub const BATCHES_RETAINED: usize = 10;

/// The batch subdirectory a target that is **not under the configuration root**
/// is copied into.
///
/// Its leading `_` puts it out of espanso's include glob a second time, which
/// costs nothing and means the answer does not depend on the backup root's
/// placement alone.
pub const OUTSIDE_CONFIG_ROOT: &str = "_outside";

/// The file every batch carries so that this application can **recognise** the
/// batch as its own format.
///
/// [`rotate`] removes a directory only when this file is inside it, so a
/// timestamp-shaped directory somebody else created is never a candidate. The
/// leading dot keeps it out of an ordinary listing of a batch, exactly as
/// [`BACKUP_DIRECTORY_NAME`]'s does.
///
/// **Recognition is not proof of authorship.** Anything able to write inside
/// the backup root can write these bytes; what the marker buys is a defence
/// against accidental ownership confusion, and nothing more (see this module's
/// header).
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
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
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
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize)]
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
    /// these too: the name is a shape, and the marker is what makes a directory
    /// eligible — a claim about **recognition**, never about who created it.
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

impl Serialize for BackupRecord {
    /// Both paths go through [`WirePathRef`], which is the whole reason this is
    /// hand-written: `serde`'s own `PathBuf` serializer **fails** on a path that
    /// is not valid UTF-8, and a backup record travels on the *success* path,
    /// where a serializer failure has no typed refusal to fall back to.
    ///
    /// A serialized record is **display data plus counts**. It is not a promise
    /// that the file is recoverable: rotation attempts to retain at most
    /// [`BATCHES_RETAINED`] recognised batch directories chosen by sortable name
    /// and promises neither successful cleanup nor any retention duration, so
    /// nothing built on this may say otherwise.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("BackupRecord", 3)?;
        out.serialize_field("path", &WirePathRef(&self.path))?;
        out.serialize_field("batch", &WirePathRef(&self.batch))?;
        out.serialize_field("rotation", &self.rotation)?;
        out.end()
    } // End of function serialize() for BackupRecord
}

// ---------------------------------------------------------------------------
// The failures
// ---------------------------------------------------------------------------

/// Which part of taking a backup failed.
///
/// Carried by [`BackupError::Io`] so a caller can tell them apart **without
/// parsing a sentence**, exactly as [`crate::persist::WriteStep`] is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
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
/// Serializes as an externally tagged variant whose paths are lossy renderings
/// and whose I/O failure carries a `kind` code and a nullable `raw_os_error`
/// number — see the `Serialize` impl below.
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

impl Serialize for BackupError {
    /// Externally tagged, with the same two departures [`crate::persist::WriteError`]
    /// makes and for the same reasons: **every** path goes through
    /// [`WirePathRef`] because a path that is not valid UTF-8 would otherwise fail
    /// the serializer at the one moment there is no second error to send, and
    /// [`BackupError::Io`] writes **`kind`** — the [`io::ErrorKind`] variant name,
    /// a code — never the operating system's own sentence. Beside it rides
    /// **`raw_os_error`**, the system's own error number as a nullable number:
    /// `kind` collapses whole families of failures into `Other`, and the number is
    /// diagnostic data with no dictionary entry rather than a second code.
    ///
    /// Hand-written so a variant added here is a compile error rather than a
    /// silent wire addition with no string behind it.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            BackupError::Io { step, path, source } => {
                let mut out = serializer.serialize_struct_variant("BackupError", 0, "Io", 4)?;
                out.serialize_field("step", step)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("kind", &io_kind_name(source))?;
                out.serialize_field("raw_os_error", &io_raw_os_error(source))?;
                out.end()
            }
            BackupError::BatchNameExhausted { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupError",
                    1,
                    "BatchNameExhausted",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            BackupError::NotADirectory { path } => {
                let mut out =
                    serializer.serialize_struct_variant("BackupError", 2, "NotADirectory", 1)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            BackupError::BackupRootNotPrivate { path, mode } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupError",
                    3,
                    "BackupRootNotPrivate",
                    2,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("mode", mode)?;
                out.end()
            }
            BackupError::ConfigRootIsAutoLoaded { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupError",
                    4,
                    "ConfigRootIsAutoLoaded",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            BackupError::TempFileChangedDuringWrite { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupError",
                    5,
                    "TempFileChangedDuringWrite",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            BackupError::DestinationExists { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupError",
                    6,
                    "DestinationExists",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            BackupError::BackupNameExhausted { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupError",
                    7,
                    "BackupNameExhausted",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
        }
    } // End of function serialize() for BackupError
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
        // must not be able to make the directory holding this copy the
        // lowest-sorting candidate.
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
/// followed by its absolute path with the root component dropped. This keeps the
/// path visible (so a user can tell which file it was), keeps equal basenames
/// distinct, and introduces no lexical `.` or `..` escape, because every component
/// that is not a plain name — the root, a prefix, `.`, `..` — is dropped rather
/// than joined; filesystem containment retains the target-specific guarantees
/// documented by `ResolvedDirectory`. The alternative of flattening to a bare file
/// name was rejected: two files called `base.yml` would then be one backup.
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
///
/// # One answer is a sentinel and does not invert
///
/// A `target` equal to `config_root` answers `_outside_`, which reverses through
/// [`BackupTarget`] to the in-root file `_outside` rather than to the root. That
/// is deliberate and is unreachable from the write side — the transaction copies
/// regular files, and a configuration root is a directory — but it is a real
/// hole in the round trip, so [`BackupCatalog::entry_for_target`] refuses that
/// target instead of pretending the mapping is total.
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
///
/// **The remainder is pushed only when there is one.** `PathBuf::push` of an
/// empty path appends a separator, so a one-component path would otherwise come
/// back spelled `_outside_/` — equal to `_outside_` under `Path`'s
/// component-wise comparison, and *not* a spelling
/// [`validated_relative_path`] admits, which is where that difference stops
/// being cosmetic.
fn escape_in_root_path(relative: &Path) -> PathBuf {
    let mut components = relative.components();
    let Some(Component::Normal(first)) = components.next() else {
        return relative.to_path_buf();
    };
    if !is_marker_shaped(first) {
        return relative.to_path_buf();
    }
    let mut escaped = PathBuf::from(escaped_marker_name(first));
    let rest = components.as_path();
    if !rest.as_os_str().is_empty() {
        escaped.push(rest);
    }
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

/// One `_` fewer, which is the whole un-escape, or `None` for a name that was
/// never escaped.
///
/// The inverse of [`escaped_marker_name`] on exactly the names
/// [`is_marker_shaped`] admits: `_outside_` becomes `_outside`, `_outside__`
/// becomes `_outside_`, and a bare `_outside` — which the escape can never
/// produce — is refused, because that name belongs to the **external**
/// namespace and is not an escaped in-root one.
/// It is rebuilt rather than truncated, which is what keeps it free of `unsafe`:
/// every name [`is_marker_shaped`] admits is `_outside` followed by ASCII
/// underscores, so the answer can be spelled out from the count.
fn unescaped_marker_name(name: &OsStr) -> Option<OsString> {
    if !is_marker_shaped(name) {
        return None;
    }
    let underscores = name.as_encoded_bytes().len() - OUTSIDE_CONFIG_ROOT.len();
    if underscores == 0 {
        return None;
    }
    let mut unescaped = String::from(OUTSIDE_CONFIG_ROOT);
    for _ in 0..underscores - 1 {
        unescaped.push('_');
    }
    Some(OsString::from(unescaped))
} // End of function unescaped_marker_name()

/// Which **namespace** a path inside a batch occupies, read syntactically.
///
/// [`backup_relative_path`] is the forward direction of one mapping and this is
/// the backward direction of the same one — kept as a single value with two
/// directions rather than two functions that happen to agree today.
/// [`BackupCatalog::entry_for_target`] runs it forwards to ask which entry name
/// a live target would map to; [`BackupCatalog::scan_entries`] runs it backwards
/// to say **which live target path would map to this entry name**, when the name
/// is an ordinary, undisambiguated one.
///
/// # It is a statement about a name, and about nothing else
///
/// It is emphatically **not** a claim about history. It does not say a file
/// exists at the named place now, that one ever did, that this application
/// copied anything, or that these bytes came from anywhere in particular. Every
/// path in a batch is untrusted input, and anything able to write inside the
/// backup root can put a file at any name it likes — a forged `_outside/…` entry
/// need never have been copied from anything.
///
/// Two consequences are worth spelling out because they are easy to read past:
///
/// - **a disambiguated name is classified literally.** A copy published as
///   `base.yml-1` because `base.yml` was taken is, to this mapping, the in-root
///   name `base.yml-1` — a path that names no source file and quite possibly no
///   file at all. The mapping is not told about disambiguation and cannot be:
///   `base.yml-1` is also a perfectly ordinary file name;
/// - **the mapping is not total, by decision.** A target equal to the
///   configuration root maps forwards onto the sentinel `_outside_`
///   ([`backup_relative_path`]), which reverses to the in-root path `_outside`
///   and not to the root. That forward case is unreachable on the write side —
///   the transaction saves regular files, never a directory — and
///   [`BackupCatalog::entry_for_target`] answers `None` for it rather than
///   offering the copy of a file genuinely called `_outside`.
///
/// # On the wire
///
/// Externally tagged, and **mixed in shape** exactly as
/// [`crate::model::UnknownReason`] is: `InConfigRoot` carries one operand and
/// crosses as a one-key object, while `OutsideConfigRoot` carries none and
/// crosses as the bare string a unit variant produces. Its operand is a
/// [`WirePath`], so a name no encoding can spell renders lossily rather than
/// failing the serializer — the display half of the rule
/// [`crate::wire`] states, with identity carried by [`BackupEntryId`] instead.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub enum BackupTarget {
    /// The path maps back into the configuration root, at `relative_path`.
    InConfigRoot {
        /// The path relative to the configuration root, un-escaped.
        ///
        /// **Relative, never absolute.** A caller that needs a file needs a
        /// [`crate::model::DocumentContext`], which is the authoritative tuple;
        /// this is a display value and a key to compare against one.
        relative_path: WirePath,
    },
    /// The path's first component is [`OUTSIDE_CONFIG_ROOT`], so the name sits
    /// in the namespace this module gives targets that are not under the
    /// configuration root.
    ///
    /// **A namespace, not a provenance.** It says where the name lives, never
    /// that a file outside the root was copied here.
    ///
    /// The external path is **deliberately not reconstructed**. It is visible in
    /// the entry's own display path, and re-assembling an absolute path from it
    /// would hand a caller a write target this application never resolved.
    OutsideConfigRoot,
}

impl BackupTarget {
    /// Reads a batch-relative path back into the target namespace it belongs to.
    ///
    /// Only the first component can be in the external namespace, because that
    /// namespace is exactly one directory deep at the top of a batch — the same
    /// fact [`escape_in_root_path`] relies on going the other way.
    fn of_backup_path(relative: &Path) -> BackupTarget {
        let mut components = relative.components();
        let Some(Component::Normal(first)) = components.next() else {
            return BackupTarget::InConfigRoot {
                relative_path: WirePath::from(relative),
            };
        };
        if first == OsStr::new(OUTSIDE_CONFIG_ROOT) {
            return BackupTarget::OutsideConfigRoot;
        }
        let Some(unescaped) = unescaped_marker_name(first) else {
            return BackupTarget::InConfigRoot {
                relative_path: WirePath::from(relative),
            };
        };
        let mut in_root = PathBuf::from(unescaped);
        // Only when there is a remainder: an empty push appends a separator,
        // and `_outside/` is not the spelling this answers about.
        let rest = components.as_path();
        if !rest.as_os_str().is_empty() {
            in_root.push(rest);
        }
        BackupTarget::InConfigRoot {
            relative_path: WirePath::from(in_root),
        }
    } // End of function of_backup_path()

    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(&self) -> &'static str {
        match self {
            BackupTarget::InConfigRoot { .. } => "inConfigRoot",
            BackupTarget::OutsideConfigRoot => "outsideConfigRoot",
        }
    } // End of function code()
}

impl fmt::Display for BackupTarget {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
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
/// counter **numerically** second — `…Z-2` sorts below `…Z-10`, which a
/// lexicographic comparison of the whole name would reverse.
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

/// The one order two recognised batch names are ever compared in: **newest name
/// first**, by stamp as a string and then by counter as a number.
///
/// Both operands come from [`parse_batch_name`], and this function is the only
/// place the pair is turned into an ordering. It exists because the tuple used to
/// be written out twice — once in the grammar and once inside [`rotate`], sorted
/// the other way round — and two copies of an ordering are two chances to sort a
/// destructive operation backwards. [`rotate`] now reverses **this** comparison
/// to reach the lowest-sorting name, and [`BackupCatalog::scan_batches`] uses it
/// as it stands.
///
/// The stamp compares as a **string** because [`batch_stamp`]'s format sorts in
/// the same order the clock that produced it advanced; the counter compares as a
/// **number** because `…Z-2` and `…Z-10` sort the other way as text. Neither
/// comparison parses a time, and neither is evidence about when anything
/// happened: the stamp is a directory name.
fn compare_batches_newest_first(left: (&str, u32), right: (&str, u32)) -> Ordering {
    right.0.cmp(left.0).then_with(|| right.1.cmp(&left.1))
} // End of function compare_batches_newest_first()

// ---------------------------------------------------------------------------
// Walking the tree — descriptors on macOS, pathnames elsewhere
// ---------------------------------------------------------------------------

/// What one component of the backup tree was found to be.
///
/// The four answers this module distinguishes, and no more: it walks
/// directories, offers regular files, refuses symbolic links without following
/// them, and reports everything else as neither.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ChildKind {
    /// A real directory.
    Directory,
    /// A real regular file, and the byte length **that one observation** saw.
    RegularFile {
        /// The length `fstat`/`fstatat` reported at that moment. Not a promise
        /// about the next read.
        length: u64,
    },
    /// A symbolic link. Never followed, and never opened.
    Symlink,
    /// A fifo, a socket, a device — a real object that is neither of the two
    /// kinds this module handles.
    Other,
}

/// Why a child of a [`ResolvedDirectory`] could not be resolved as asked.
///
/// Four answers, spelled the same way by both implementations below, which is
/// what lets one walk sit on two very different primitives.
#[derive(Debug)]
enum ChildRefusal {
    /// Nothing is there under that name.
    Gone,
    /// The name is a symbolic link.
    Symlink,
    /// Something is there and it is not the kind that was asked for.
    WrongKind,
    /// The attempt itself failed.
    Io(io::Error),
}

impl ChildRefusal {
    /// Reads an operating-system failure into the vocabulary above.
    ///
    /// The macOS arm is what turns an `open`/`openat` refusal into a *type*
    /// answer: with `O_NOFOLLOW` the kernel reports `ELOOP` for a final
    /// component that is a symbolic link, and with `O_DIRECTORY` it reports
    /// `ENOTDIR` for one that is not a directory. Off macOS those two answers
    /// are produced by inspecting metadata instead, so nothing here has to
    /// classify them.
    fn of(error: io::Error) -> ChildRefusal {
        #[cfg(target_os = "macos")]
        {
            match error.raw_os_error() {
                Some(libc::ELOOP) => return ChildRefusal::Symlink,
                Some(libc::ENOTDIR) => return ChildRefusal::WrongKind,
                _ => {}
            }
        }
        if error.kind() == io::ErrorKind::NotFound {
            ChildRefusal::Gone
        } else {
            ChildRefusal::Io(error)
        }
    } // End of function of()

    /// The failure to report when a caller has decided this refusal is one it
    /// cannot answer for.
    ///
    /// Only [`ChildRefusal::Io`] carries a real one; the other three are this
    /// module's own decisions, and each is spelled out rather than flattened
    /// into a bare "other".
    fn into_io_error(self) -> io::Error {
        match self {
            ChildRefusal::Gone => io::Error::from(io::ErrorKind::NotFound),
            ChildRefusal::Symlink => {
                io::Error::other("a symbolic link observed by this operation and refused")
            }
            ChildRefusal::WrongKind => {
                io::Error::other("not the kind of object this module expected")
            }
            ChildRefusal::Io(error) => error,
        }
    } // End of function into_io_error()
} // End of impl ChildRefusal

/// One directory of the backup tree, as this module resolved it.
///
/// # What *never follows a symlink* is worth, per target
///
/// This type is the whole of the difference, and the two answers are written
/// out rather than averaged into one that is true of neither:
///
/// - on **macOS** it owns an **open directory descriptor**. The root is opened
///   with `O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC`, every child is opened
///   relative to its already-open parent with `openat(…, O_NOFOLLOW)`, and what
///   was actually opened is confirmed by `fstat` **on the descriptor**. Nothing
///   inside the backup tree is ever resolved by pathname, so there is no second
///   name lookup for anything to race: a component replaced by a symbolic link
///   after it was checked cannot be followed, because the descriptor already
///   names the object that was checked. This is the same argument
///   `crate::persist::write` makes for using `fcopyfile` rather than `copyfile`
///   — a descriptor resolves no path.
///
///   **The one pathname resolution left is the backup root's own**, and it is
///   named rather than glossed over: `open_root` hands the kernel the whole
///   path, so the configuration root and everything above it are resolved as
///   names, and only the root's **final component** is protected by
///   `O_NOFOLLOW`. That is the boundary this module owns — above it lies the
///   caller's configuration root, which `crate::persist::write` resolves and
///   argues about separately;
/// - on **every other target** it owns only the pathname. Each component is
///   inspected with [`fs::symlink_metadata`] and the listing or open that
///   follows is a pathname operation, so a symbolic link **already there** is
///   refused and a component **swapped between the check and the use can still
///   be followed**. That is a documented limitation of those builds. The crate
///   is meant to build, test and fuzz anywhere (plan section 6.1) while the
///   application ships on macOS alone, and `libc` is declared for
///   `cfg(target_os = "macos")` only — but a security guarantee may not quietly
///   become a no-op, so the weaker sentence is stated wherever the stronger one
///   is claimed.
///
/// Everything above the descriptor is shared: one walk, one set of refusals,
/// one set of skip codes.
struct ResolvedDirectory {
    /// The pathname this directory was reached by, **component by component**.
    ///
    /// On macOS it is an operand for error values and nothing else — no child
    /// is ever resolved through it. Off macOS it is what every operation
    /// resolves against.
    path: PathBuf,
    /// The open descriptor every child is resolved relative to.
    #[cfg(target_os = "macos")]
    handle: File,
}

impl ResolvedDirectory {
    /// The pathname this directory was reached by.
    fn path(&self) -> &Path {
        &self.path
    }

    /// The pathname `name` inside it would be reached by, for error operands.
    fn child_path(&self, name: &OsStr) -> PathBuf {
        self.path.join(name)
    }
} // End of impl ResolvedDirectory

/// The macOS implementation: a descriptor, `openat`, `fstatat` and `fstat`.
///
/// Every `unsafe` block below is one `libc` call whose arguments are a live
/// borrowed descriptor, a NUL-terminated name this function owns, and flag
/// constants `open(2)` defines — the same shape, and the same discipline, as
/// the single `fcopyfile` call site in `crate::persist::write`.
#[cfg(target_os = "macos")]
impl ResolvedDirectory {
    /// Opens `path` as a directory, following nothing at its final component.
    ///
    /// This is the **only** pathname resolution on this target, and it is a
    /// whole path: the kernel resolves every ancestor as a name, and
    /// `O_NOFOLLOW` protects the final component alone. Everything below it is
    /// reached with [`ResolvedDirectory::child_directory`], relative to the
    /// descriptor this returns.
    fn open_root(path: &Path) -> Result<ResolvedDirectory, ChildRefusal> {
        let name = nul_terminated(path.as_os_str())?;
        // SAFETY: `name` is a NUL-terminated buffer this call owns and keeps
        // alive across the call; the flags are constants `open(2)` defines.
        // `open` returns a new descriptor or -1 and touches nothing else.
        let descriptor = unsafe {
            libc::open(
                name.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            )
        };
        let handle = owned_descriptor(descriptor)?;
        Ok(ResolvedDirectory {
            path: path.to_owned(),
            handle,
        })
    } // End of function open_root()

    /// This directory's own permission bits, from an `fstat` on the descriptor.
    fn mode(&self) -> Result<u32, ChildRefusal> {
        Ok(u32::from(stat_of(&self.handle)?.st_mode) & 0o777)
    }

    /// What `name` inside this directory is, following nothing.
    ///
    /// `fstatat` with `AT_SYMLINK_NOFOLLOW`, **relative to the descriptor**, so
    /// the answer is about the object that name holds inside *this* directory
    /// and no component above it is resolved again.
    fn child(&self, name: &OsStr) -> Result<ChildKind, ChildRefusal> {
        use std::os::unix::io::AsRawFd as _;

        let raw = nul_terminated(name)?;
        let mut found = std::mem::MaybeUninit::<libc::stat>::uninit();
        // SAFETY: the descriptor is borrowed from a live `File` and is open for
        // the whole call; `raw` is a NUL-terminated buffer this call owns; the
        // output pointer is a correctly aligned, sufficiently sized allocation
        // this call owns; and `AT_SYMLINK_NOFOLLOW` is a constant `fstatat(2)`
        // defines. The call writes only through that pointer and returns 0 or
        // -1.
        let outcome = unsafe {
            libc::fstatat(
                self.handle.as_raw_fd(),
                raw.as_ptr(),
                found.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        if outcome != 0 {
            return Err(ChildRefusal::of(io::Error::last_os_error()));
        }
        // SAFETY: `fstatat` answered 0, which is the contract that it filled
        // the structure.
        let found = unsafe { found.assume_init() };
        Ok(kind_of(&found))
    } // End of function child()

    /// Opens `name` inside this directory as a directory, following nothing.
    fn child_directory(&self, name: &OsStr) -> Result<ResolvedDirectory, ChildRefusal> {
        use std::os::unix::io::AsRawFd as _;

        let raw = nul_terminated(name)?;
        // SAFETY: as for `child()` above — a live borrowed descriptor, a
        // NUL-terminated name this call owns, and flag constants `openat(2)`
        // defines. It returns a new descriptor or -1.
        let descriptor = unsafe {
            libc::openat(
                self.handle.as_raw_fd(),
                raw.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            )
        };
        let handle = owned_descriptor(descriptor)?;
        // The descriptor's own type, not the name's. `O_DIRECTORY` already
        // refuses anything else, and this asks the object that was opened
        // rather than trusting the flag.
        match kind_of(&stat_of(&handle)?) {
            ChildKind::Directory => Ok(ResolvedDirectory {
                path: self.child_path(name),
                handle,
            }),
            ChildKind::Symlink => Err(ChildRefusal::Symlink),
            _ => Err(ChildRefusal::WrongKind),
        }
    } // End of function child_directory()

    /// Opens `name` inside this directory as a regular file, following nothing.
    ///
    /// `O_NONBLOCK` is set so that a fifo left in a backup tree cannot make this
    /// call wait for a writer; it has no effect on the regular files this is
    /// for, and the descriptor is refused unless `fstat` says it is one.
    fn child_regular_file(&self, name: &OsStr) -> Result<(File, u64), ChildRefusal> {
        use std::os::unix::io::AsRawFd as _;

        let raw = nul_terminated(name)?;
        // SAFETY: as for `child_directory()` above.
        let descriptor = unsafe {
            libc::openat(
                self.handle.as_raw_fd(),
                raw.as_ptr(),
                libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK,
            )
        };
        let handle = owned_descriptor(descriptor)?;
        match kind_of(&stat_of(&handle)?) {
            ChildKind::RegularFile { length } => Ok((handle, length)),
            ChildKind::Symlink => Err(ChildRefusal::Symlink),
            _ => Err(ChildRefusal::WrongKind),
        }
    } // End of function child_regular_file()

    /// The names this directory holds, without `.` and `..`.
    ///
    /// The descriptor is **duplicated** first because `closedir(3)` closes the
    /// one it was given, and this directory keeps its own for the children that
    /// are resolved against it. A duplicate shares the original's file offset,
    /// and `fdopendir(3)` is not specified to reset it, so the stream is
    /// rewound before it is read — otherwise a second call on one directory
    /// would answer an empty listing rather than the same names again.
    fn names(&self) -> Result<Vec<OsString>, ChildRefusal> {
        use std::os::unix::ffi::OsStrExt as _;
        use std::os::unix::io::AsRawFd as _;

        // SAFETY: the descriptor is borrowed from a live `File`. `dup` reads it
        // and returns a new one or -1; it writes nothing.
        let duplicated = unsafe { libc::dup(self.handle.as_raw_fd()) };
        if duplicated < 0 {
            return Err(ChildRefusal::of(io::Error::last_os_error()));
        }
        // SAFETY: `duplicated` is a fresh open descriptor this call owns and has
        // given to nothing else. `fdopendir` takes it over on success, and the
        // `closedir` below is the one release of it; on failure this call closes
        // it itself.
        let stream = unsafe { libc::fdopendir(duplicated) };
        if stream.is_null() {
            let failure = io::Error::last_os_error();
            // SAFETY: `fdopendir` failed, so it did not take the descriptor
            // over, and nothing else holds it.
            unsafe { libc::close(duplicated) };
            return Err(ChildRefusal::of(failure));
        }
        // SAFETY: `stream` is a live `DIR*` this call owns. `rewinddir` only
        // repositions it and cannot fail.
        unsafe { libc::rewinddir(stream) };

        let mut names = Vec::new();
        let mut failure = None;
        loop {
            // `readdir` answers NULL both at the end of the directory and on a
            // failure, so errno is cleared first and read back to tell them
            // apart — the documented way to use it.
            // SAFETY: `__error()` answers this thread's own errno location.
            unsafe { *libc::__error() = 0 };
            // SAFETY: `stream` is a live `DIR*` this call owns and uses from
            // this thread alone; `readdir` returns a pointer into storage owned
            // by that stream, valid until the next call on it.
            let found = unsafe { libc::readdir(stream) };
            if found.is_null() {
                // SAFETY: as above.
                let errno = unsafe { *libc::__error() };
                if errno != 0 {
                    failure = Some(io::Error::from_raw_os_error(errno));
                }
                break;
            }
            // SAFETY: `found` is non-null and points at a `dirent` the stream
            // owns; `d_name` is the NUL-terminated name field `readdir(3)`
            // documents, and the bytes are copied out before the next call.
            let name = unsafe { std::ffi::CStr::from_ptr((*found).d_name.as_ptr()) };
            let name = OsStr::from_bytes(name.to_bytes()).to_os_string();
            if name == OsStr::new(".") || name == OsStr::new("..") {
                continue;
            }
            names.push(name);
        } // End of the loop over one directory's entries

        // SAFETY: `stream` is live and is used by nothing after this; this is
        // the one release of it and of the descriptor it took over.
        unsafe { libc::closedir(stream) };
        match failure {
            Some(error) => Err(ChildRefusal::of(error)),
            None => Ok(names),
        }
    } // End of function names()
} // End of the macOS impl of ResolvedDirectory

/// Wraps a fresh `open`/`openat` result, or reads its failure.
#[cfg(target_os = "macos")]
fn owned_descriptor(descriptor: libc::c_int) -> Result<File, ChildRefusal> {
    use std::os::unix::io::FromRawFd as _;

    if descriptor < 0 {
        return Err(ChildRefusal::of(io::Error::last_os_error()));
    }
    // SAFETY: `descriptor` is a fresh, open descriptor the call above returned
    // and that nothing else holds, so `File` becomes its sole owner and closes
    // it exactly once.
    Ok(unsafe { File::from_raw_fd(descriptor) })
} // End of function owned_descriptor()

/// `fstat` on an open descriptor: what was **actually** opened.
#[cfg(target_os = "macos")]
fn stat_of(handle: &File) -> Result<libc::stat, ChildRefusal> {
    use std::os::unix::io::AsRawFd as _;

    let mut found = std::mem::MaybeUninit::<libc::stat>::uninit();
    // SAFETY: the descriptor is borrowed from a live `File` and is open for the
    // whole call; the output pointer is a correctly aligned, sufficiently sized
    // allocation this call owns. `fstat` writes only through it and answers 0
    // or -1.
    let outcome = unsafe { libc::fstat(handle.as_raw_fd(), found.as_mut_ptr()) };
    if outcome != 0 {
        return Err(ChildRefusal::of(io::Error::last_os_error()));
    }
    // SAFETY: `fstat` answered 0, which is the contract that it filled the
    // structure.
    Ok(unsafe { found.assume_init() })
} // End of function stat_of()

/// Reads a `stat` structure's type bits into [`ChildKind`].
#[cfg(target_os = "macos")]
fn kind_of(found: &libc::stat) -> ChildKind {
    match found.st_mode & libc::S_IFMT {
        libc::S_IFDIR => ChildKind::Directory,
        libc::S_IFREG => ChildKind::RegularFile {
            length: found.st_size.max(0) as u64,
        },
        libc::S_IFLNK => ChildKind::Symlink,
        _ => ChildKind::Other,
    }
} // End of function kind_of()

/// Copies a name into the NUL-terminated buffer a `libc` call needs.
///
/// A name holding an interior NUL cannot address anything and is refused rather
/// than truncated: truncation would send a *different* name to the kernel.
#[cfg(target_os = "macos")]
fn nul_terminated(name: &OsStr) -> Result<std::ffi::CString, ChildRefusal> {
    use std::os::unix::ffi::OsStrExt as _;

    std::ffi::CString::new(name.as_bytes())
        .map_err(|_| ChildRefusal::Io(io::Error::from(io::ErrorKind::InvalidInput)))
} // End of function nul_terminated()

/// The implementation off macOS: the same questions, asked of pathnames.
///
/// Every symbolic link **already present** is refused, exactly as on macOS. What
/// is not closed here is the window between the check and the operation that
/// follows it, because `libc` is not available on this target and the standard
/// library offers no descriptor-relative open. [`ResolvedDirectory`]'s own
/// documentation states that limitation in full; nothing in this module may
/// claim the stronger guarantee unconditionally.
#[cfg(not(target_os = "macos"))]
impl ResolvedDirectory {
    /// Resolves `path` as a directory, refusing a symbolic link at its final
    /// component.
    fn open_root(path: &Path) -> Result<ResolvedDirectory, ChildRefusal> {
        let metadata = fs::symlink_metadata(path).map_err(ChildRefusal::of)?;
        if metadata.file_type().is_symlink() {
            return Err(ChildRefusal::Symlink);
        }
        if !metadata.is_dir() {
            return Err(ChildRefusal::WrongKind);
        }
        Ok(ResolvedDirectory {
            path: path.to_owned(),
        })
    } // End of function open_root()

    /// This directory's own permission bits.
    fn mode(&self) -> Result<u32, ChildRefusal> {
        Ok(fs::symlink_metadata(&self.path)
            .map_err(ChildRefusal::of)?
            .permissions()
            .mode()
            & 0o777)
    }

    /// What `name` inside this directory is, following nothing **at that
    /// name**.
    ///
    /// The whole pathname is re-resolved, so a component *above* `name` that
    /// has become a symbolic link since it was checked is followed here. Every
    /// such component was refused if it was a link when the walk passed it;
    /// that is the limit of what this target gives.
    fn child(&self, name: &OsStr) -> Result<ChildKind, ChildRefusal> {
        let metadata = fs::symlink_metadata(self.child_path(name)).map_err(ChildRefusal::of)?;
        let kind = metadata.file_type();
        Ok(if kind.is_symlink() {
            ChildKind::Symlink
        } else if kind.is_dir() {
            ChildKind::Directory
        } else if kind.is_file() {
            ChildKind::RegularFile {
                length: metadata.len(),
            }
        } else {
            ChildKind::Other
        })
    } // End of function child()

    /// Resolves `name` inside this directory as a directory.
    ///
    /// What it answers is a **longer pathname**, not a handle on the object it
    /// checked, so the check does not carry forward to the next operation on
    /// it.
    fn child_directory(&self, name: &OsStr) -> Result<ResolvedDirectory, ChildRefusal> {
        match self.child(name)? {
            ChildKind::Directory => Ok(ResolvedDirectory {
                path: self.child_path(name),
            }),
            ChildKind::Symlink => Err(ChildRefusal::Symlink),
            _ => Err(ChildRefusal::WrongKind),
        }
    } // End of function child_directory()

    /// Opens `name` inside this directory as a regular file.
    ///
    /// The type is checked before the open **and** on the descriptor after it,
    /// which narrows the window between them and, on this target, does not close
    /// it.
    fn child_regular_file(&self, name: &OsStr) -> Result<(File, u64), ChildRefusal> {
        match self.child(name)? {
            ChildKind::RegularFile { .. } => {}
            ChildKind::Symlink => return Err(ChildRefusal::Symlink),
            _ => return Err(ChildRefusal::WrongKind),
        }
        let handle = File::open(self.child_path(name)).map_err(ChildRefusal::of)?;
        let metadata = handle.metadata().map_err(ChildRefusal::of)?;
        if !metadata.is_file() {
            return Err(ChildRefusal::WrongKind);
        }
        let length = metadata.len();
        Ok((handle, length))
    } // End of function child_regular_file()

    /// The names this directory holds.
    fn names(&self) -> Result<Vec<OsString>, ChildRefusal> {
        let mut names = Vec::new();
        for entry in fs::read_dir(&self.path).map_err(ChildRefusal::of)? {
            names.push(entry.map_err(ChildRefusal::of)?.file_name());
        }
        Ok(names)
    } // End of function names()
} // End of the non-macOS impl of ResolvedDirectory

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

/// Whether `batch` carries a marker whose contents this module **recognises**.
///
/// Read as bytes and matched on [`BATCH_MARKER_FORMAT`] as a **prefix**, so a
/// version this build does not know is still recognised as this application's
/// format. Anything else — no file, a directory, a symlink, other content —
/// answers `false`, and rotation then leaves the directory alone.
///
/// **Recognition is not provenance.** Anything able to write inside the backup
/// root can write these bytes, so a `true` here says *this file begins the way
/// this module's marker begins* and never *this module created this batch*. The
/// module header states the same boundary, and no sentence built on this answer
/// may widen it.
///
/// Only the prefix is read, from the descriptor
/// [`ResolvedDirectory::child_regular_file`] opened, so a forged marker of any
/// size costs a fixed read.
fn carries_batch_marker(batch: &ResolvedDirectory) -> bool {
    let Ok((mut handle, _)) = batch.child_regular_file(OsStr::new(BATCH_MARKER_NAME)) else {
        return false;
    };
    let mut opening = vec![0u8; BATCH_MARKER_FORMAT.len()];
    handle.read_exact(&mut opening).is_ok() && opening == BATCH_MARKER_FORMAT.as_bytes()
} // End of function carries_batch_marker()

/// The same question, asked of a directory named by a pathname.
///
/// [`rotate`] holds a path rather than a resolved directory, so it resolves one
/// here and then asks [`carries_batch_marker`] — one implementation of the
/// recognition, reached two ways, rather than two that can drift. A path that
/// is not a real directory, or is a symbolic link, answers `false` without
/// being followed.
fn path_carries_batch_marker(batch: &Path) -> bool {
    ResolvedDirectory::open_root(batch).is_ok_and(|directory| carries_batch_marker(&directory))
} // End of function path_carries_batch_marker()

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
/// here instead: every candidate is checked to be free before the rename. An
/// existing destination may hold bytes available nowhere else, so it is
/// **skipped, never truncated**; this code attributes neither provenance nor age
/// to those bytes. Losing them is the data loss this whole module exists to
/// prevent.
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

/// Removes all but the highest-sorting `keep` recognised batch names from `root`,
/// lowest-sorting first, never touching `current`.
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
///    batch's marker.** [`path_carries_batch_marker`] must find
///    [`BATCH_MARKER_NAME`] inside the directory. A timestamp-shaped directory
///    somebody else created is [`Rotation::unrecognised`] however well its name
///    parses. The marker is forgeable by anything that can write inside the
///    backup root; that principal is out of scope here exactly as it is for the
///    rename (`docs/decisions/2a-3a-notes.md` hole 14);
/// 3. **it only ever considers real directories.** The type comes from
///    [`fs::symlink_metadata`], so a symlink present when that call runs is not
///    a directory and is skipped, and [`fs::remove_dir_all`] does not traverse a
///    symlink it encounters, so a link planted *inside* a batch is removed
///    rather than traversed. The write side resolves by pathname on every
///    target, so the same-user substitution race between that check and a later
///    pathname operation remains outside the stated write-side threat model;
/// 4. **it never considers `current`.** The batch this session is writing into is
///    excluded by **identity** — its `(device, inode)` pair, with its path as a
///    fallback — rather than by where its name sorts. *Newly created* does not
///    imply *newest by name*: a clock adjusted backwards, or ten future-dated
///    directories, would otherwise make the directory holding this session's own
///    copies the lowest-sorting candidate;
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
/// The highest-sorting batches are kept, and *highest* is **by name and by
/// nothing else**: the stamp compares as a string because [`batch_stamp`]'s
/// format sorts lexicographically in the order it was written, and the
/// disambiguating counter compares as a number. A name is a label, not a
/// measurement — an adjusted clock or a future-dated directory sorts where its
/// characters put it — so this ordering establishes **no chronology of any file**
/// and licenses no sentence about age. It decides **which** batch goes; it decides
/// nothing about the current one, which property 4 removes from the question
/// entirely.
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
        if !metadata.is_dir() || !path_carries_batch_marker(&path) {
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
    // **The same comparison the catalogue displays with, reversed: rotation puts
    // the lowest-sorting name first.** It takes `compare_batches_newest_first` and
    // turns it round rather than writing the tuple out a second time: an ordering
    // spelled twice is an ordering that can come to disagree with itself, and this
    // is the copy that deletes directories.
    batches.sort_by(|left, right| {
        compare_batches_newest_first((&left.0, left.1), (&right.0, right.1)).reverse()
    });
    for (_, _, path) in &batches[..batches.len() - kept_elsewhere] {
        match fs::remove_dir_all(path) {
            Ok(()) => rotation.removed += 1,
            Err(_) => rotation.failed += 1,
        }
    } // End of the loop that removes the batches outside the retention window
    rotation
} // End of function rotate()

// ---------------------------------------------------------------------------
// The read side — the catalogue, which creates, removes and rotates nothing
// ---------------------------------------------------------------------------

/// Whether the backup root was there to be listed.
///
/// **A missing root is an outcome and not a failure.** Nothing creates the
/// backup root until a session first has something to put in it
/// ([`BackupSession::rooted_at`]), so a configuration this application has never
/// saved from legitimately has no root at all, and a caller that received an
/// error for it would have to decide whether to show a failure — for the
/// ordinary state of a fresh install.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum BackupRootState {
    /// Nothing exists at `<config root>/.espansoconfig-backups`.
    Missing,
    /// A real, private directory is there, and it was listed.
    Present,
}

impl BackupRootState {
    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(self) -> &'static str {
        match self {
            BackupRootState::Missing => "missing",
            BackupRootState::Present => "present",
        }
    } // End of function code()
}

impl fmt::Display for BackupRootState {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// Why one entry of the backup root is not an eligible batch.
///
/// **This is the ownership boundary [`rotate`] already applies, read rather than
/// enforced.** Every reason here means *left exactly as found and never counted
/// as a batch*; none of them is an error, and a scan that collects several of
/// them is still a scan, which is what stops a caller turning an incomplete
/// listing into *"there are no backups"*.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum BatchSkipped {
    /// The name is not one [`parse_batch_name`]'s grammar admits.
    ///
    /// A name that is not valid UTF-8 is this too: nothing this module mints can
    /// be one.
    ForeignName,
    /// The name parses and the entry is **not a real directory**.
    ///
    /// A symlink is the case that matters: it is refused rather than resolved,
    /// so the listing never walks a tree this application does not own. How far
    /// that holds against a name changed *after* the scan read it depends on
    /// the target — this module's header states both answers.
    NotADirectory,
    /// A real directory whose name parses, carrying no [`BATCH_MARKER_NAME`].
    ///
    /// A timestamp-shaped name is a shape, and only the marker is a claim of
    /// ownership — which is a claim about **recognition**, never about
    /// authenticity: anything able to write inside the backup root can write a
    /// marker too.
    NoMarker,
    /// Nothing could be read about the entry at all.
    ///
    /// Distinct from every reason above, which are entries that *were* read and
    /// were rejected. This one may have been a batch, so the scan is incomplete.
    Unreadable,
}

impl BatchSkipped {
    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(self) -> &'static str {
        match self {
            BatchSkipped::ForeignName => "foreignName",
            BatchSkipped::NotADirectory => "notADirectory",
            BatchSkipped::NoMarker => "noMarker",
            BatchSkipped::Unreadable => "unreadable",
        }
    } // End of function code()

    /// Whether this reason means the scan learned nothing about the entry.
    ///
    /// The one distinction that changes what a caller may say: an unreadable
    /// entry may have been a batch, so a listing holding one is **not** a
    /// complete picture of the root.
    pub fn is_unreadable(self) -> bool {
        matches!(self, BatchSkipped::Unreadable)
    }
}

impl fmt::Display for BatchSkipped {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// Why one thing inside a batch is not an entry this catalogue offers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum EntrySkipped {
    /// The batch's own ownership marker, which is not a copied file.
    ///
    /// Excluded at the **top of the batch**, which is the one place
    /// [`write_batch_marker`] puts it.
    Marker,
    /// A symlink, at whatever depth it was found.
    ///
    /// **Refused rather than resolved, and never offered.** Following one at
    /// any level would read a file outside the batch while calling it a backup
    /// of something inside it. What that is worth against a component changed
    /// after the walk read it depends on the target; this module's header
    /// states both answers.
    Symlink,
    /// A real thing that is neither a directory to walk nor a regular file to
    /// offer — a fifo, a socket, a device.
    NotARegularFile,
    /// A name that cannot be a path component this catalogue addresses.
    ///
    /// Nothing a directory listing produces should be one, and it is checked
    /// rather than assumed, because the answer is a path this module later
    /// joins.
    UnusableName,
    /// Nothing could be read about it, or a directory inside the batch could not
    /// be listed.
    Unreadable,
}

impl EntrySkipped {
    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(self) -> &'static str {
        match self {
            EntrySkipped::Marker => "marker",
            EntrySkipped::Symlink => "symlink",
            EntrySkipped::NotARegularFile => "notARegularFile",
            EntrySkipped::UnusableName => "unusableName",
            EntrySkipped::Unreadable => "unreadable",
        }
    } // End of function code()

    /// Whether this reason means the walk learned nothing about the thing.
    ///
    /// The marker, a symlink and a device were all read and rejected; an
    /// unreadable one was not, so a listing holding one is **not** a complete
    /// picture of the batch.
    pub fn is_unreadable(self) -> bool {
        matches!(self, EntrySkipped::Unreadable)
    }
}

impl fmt::Display for EntrySkipped {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// Which part of reading the backup tree failed.
///
/// Carried by [`BackupReadError::Io`] so a caller can tell them apart **without
/// parsing a sentence**, exactly as [`BackupStep`] is for the write side.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum BackupReadStep {
    /// Reading the backup root's own metadata, to check what it is.
    InspectBackupRoot,
    /// Listing the backup root.
    ListBackupRoot,
    /// Reading a batch directory's own metadata.
    InspectBatch,
    /// Listing a batch directory.
    ListBatch,
    /// Reading one entry's own metadata.
    InspectEntry,
    /// Opening or reading one entry's bytes.
    ReadEntry,
}

impl BackupReadStep {
    /// A stable lowercase identifier, for logs and test output. **Not a
    /// user-facing string** (plan section 9).
    pub fn code(self) -> &'static str {
        match self {
            BackupReadStep::InspectBackupRoot => "inspectBackupRoot",
            BackupReadStep::ListBackupRoot => "listBackupRoot",
            BackupReadStep::InspectBatch => "inspectBatch",
            BackupReadStep::ListBatch => "listBatch",
            BackupReadStep::InspectEntry => "inspectEntry",
            BackupReadStep::ReadEntry => "readEntry",
        }
    } // End of function code()
}

impl fmt::Display for BackupReadStep {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

/// Why a backup-catalogue request could not return its requested result.
///
/// **Not always a failed read**: [`BackupReadError::NotUtf8`] is the arm where
/// the entry opened and every byte arrived, and only turning those bytes into a
/// `String` did not succeed. A sentence built on this type must therefore stay
/// at *the request did not produce its result, and the reason is beside it*.
///
/// **A missing backup root is not in here**, and that is the point: it is the
/// ordinary state of a configuration nothing has been saved from, and it is
/// [`BackupRootState::Missing`] on a successful scan instead.
#[derive(Debug)]
pub enum BackupReadError {
    /// Something is at the backup root's path and it is not a real directory.
    ///
    /// **A symlink is the case that matters**, and the check is
    /// [`fs::symlink_metadata`]-based for the reason [`create_backup_root`]'s is:
    /// listing through one would walk a tree this application does not own. The
    /// two functions refuse the same roots, so a root that cannot be written to
    /// cannot be read from either.
    RootNotADirectory {
        /// The backup root that was refused.
        path: PathBuf,
    },
    /// The backup root is readable, writable or traversable by somebody other
    /// than its owner.
    ///
    /// The same mode-bit boundary [`create_backup_root`] requires before writing,
    /// and no stronger: an inherited *granting* access control entry defeats it
    /// and this check cannot see one.
    RootNotPrivate {
        /// The offending root.
        path: PathBuf,
        /// Its permission bits, masked to the low nine.
        mode: u32,
    },
    /// A batch identity does not name a recognised batch **now**.
    ///
    /// Rotation, another process or a person may change the tree between any two
    /// calls, so every identity is rechecked where it is used rather than
    /// trusted from when it was minted. An absent batch, a batch-shaped
    /// directory carrying no marker, and a name a symlink now holds are all this
    /// — and none of them is an empty listing. **This arm does not imply that
    /// the identity resolved previously**: a grammatically admissible name that
    /// never named a batch at all reaches it too.
    StaleBatch {
        /// The identity that does not resolve now.
        batch: BackupBatchId,
    },
    /// An entry identity does not name a file this catalogue offers **now**.
    ///
    /// Absent, a directory or a symlink, or not a real regular file now. The
    /// batch's own ownership marker cannot reach this variant, because
    /// [`BackupEntryId::in_batch`] refuses to build an identity for it at all.
    /// **This arm does not imply that the identity resolved previously** either:
    /// an admissible relative path that never named a file reaches it too.
    StaleEntry {
        /// The identity that does not resolve now.
        entry: BackupEntryId,
    },
    /// The filesystem refused a read.
    Io {
        /// Which step failed.
        step: BackupReadStep,
        /// The path the failing operation was addressing.
        path: PathBuf,
        /// The underlying error.
        source: io::Error,
    },
    /// An entry's bytes are not valid UTF-8, so there is no text to hand back.
    ///
    /// The same answer `crate::workspace`'s own reader gives a file it cannot
    /// accept: the **offset of the first invalid byte**, and no text at all.
    /// Nothing here decodes lossily, replaces a byte or normalises anything —
    /// the bytes are still available through [`BackupBytes`], and they are simply
    /// not a `String`.
    NotUtf8 {
        /// The entry whose bytes were read.
        entry: BackupEntryId,
        /// The byte offset of the first invalid sequence.
        offset: usize,
    },
}

impl fmt::Display for BackupReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BackupReadError::RootNotADirectory { path } => {
                write!(formatter, "{} is not a directory", path.display())
            }
            BackupReadError::RootNotPrivate { path, mode } => write!(
                formatter,
                "{} is {mode:04o} and a backup root must be private to its owner",
                path.display()
            ),
            BackupReadError::StaleBatch { batch } => write!(
                formatter,
                "{} is not a recognised batch directory now",
                batch.display_name()
            ),
            BackupReadError::StaleEntry { entry } => write!(
                formatter,
                "{} is not an entry of {} now",
                entry.relative_path().display(),
                entry.batch().display_name()
            ),
            BackupReadError::Io { step, path, source } => {
                write!(formatter, "{step} failed on {}: {source}", path.display())
            }
            BackupReadError::NotUtf8 { entry, offset } => write!(
                formatter,
                "{} holds a byte at offset {offset} that is not valid UTF-8",
                entry.relative_path().display()
            ),
        }
    } // End of function fmt() for BackupReadError
}

impl Serialize for BackupReadError {
    /// Externally tagged, with the two departures [`BackupError`]'s impl makes
    /// and for the same reasons: **every** path goes through [`WirePathRef`]
    /// because a path that is not valid UTF-8 would otherwise fail the
    /// serializer at the one moment there is no second error to send, and
    /// [`BackupReadError::Io`] writes **`kind`** — the [`io::ErrorKind`] variant
    /// name, a code — never the operating system's own sentence, with
    /// **`raw_os_error`** beside it as diagnostic data rather than a second
    /// code.
    ///
    /// Hand-written so a variant added here is a compile error rather than a
    /// silent wire addition with no string behind it.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            BackupReadError::RootNotADirectory { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupReadError",
                    0,
                    "RootNotADirectory",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            BackupReadError::RootNotPrivate { path, mode } => {
                let mut out = serializer.serialize_struct_variant(
                    "BackupReadError",
                    1,
                    "RootNotPrivate",
                    2,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("mode", mode)?;
                out.end()
            }
            BackupReadError::StaleBatch { batch } => {
                let mut out =
                    serializer.serialize_struct_variant("BackupReadError", 2, "StaleBatch", 1)?;
                out.serialize_field("batch", batch)?;
                out.end()
            }
            BackupReadError::StaleEntry { entry } => {
                let mut out =
                    serializer.serialize_struct_variant("BackupReadError", 3, "StaleEntry", 1)?;
                out.serialize_field("entry", entry)?;
                out.end()
            }
            BackupReadError::Io { step, path, source } => {
                let mut out = serializer.serialize_struct_variant("BackupReadError", 4, "Io", 4)?;
                out.serialize_field("step", step)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("kind", &io_kind_name(source))?;
                out.serialize_field("raw_os_error", &io_raw_os_error(source))?;
                out.end()
            }
            BackupReadError::NotUtf8 { entry, offset } => {
                let mut out =
                    serializer.serialize_struct_variant("BackupReadError", 5, "NotUtf8", 2)?;
                out.serialize_field("entry", entry)?;
                out.serialize_field("offset", offset)?;
                out.end()
            }
        }
    } // End of function serialize() for BackupReadError
}

impl std::error::Error for BackupReadError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            BackupReadError::Io { source, .. } => Some(source),
            BackupReadError::RootNotADirectory { .. }
            | BackupReadError::RootNotPrivate { .. }
            | BackupReadError::StaleBatch { .. }
            | BackupReadError::StaleEntry { .. }
            | BackupReadError::NotUtf8 { .. } => None,
        }
    } // End of function source() for BackupReadError
}

/// A recognised batch directory, as an identity that is **opaque by contract**.
///
/// It holds the **exact directory name** plus the two operands
/// [`parse_batch_name`] read out of it, and nothing else: no root, no absolute
/// path, no claim about what is inside. Every call that uses one re-resolves it
/// against the tree, because the directory it names can stop being a recognised
/// batch between any two calls.
///
/// **Opaque is a contract, not an impossibility.** The name is a `String` and
/// the backup root is reachable, so a pathname *can* be composed from what an
/// identity exposes; what makes the identity safe is that every use validates it
/// and re-resolves it beneath the root this module owns, never that composing a
/// path is out of reach.
///
/// **The stamp is a directory name and not a time.** [`batch_stamp`] formats the
/// process clock to obtain a sortable name; nothing here parses it back into a
/// measurement, and no string built on it may say when anything happened.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct BackupBatchId {
    /// The directory name, exactly as it is spelled inside the backup root.
    name: String,
    /// The stamp half of the name, which is the first ordering operand.
    stamp: String,
    /// The disambiguating counter, which is the second ordering operand and is
    /// a **number**.
    counter: u32,
}

impl BackupBatchId {
    /// Reads a directory name into an identity, or refuses it.
    ///
    /// The grammar is [`parse_batch_name`]'s and no other, so an identity can
    /// only ever name a **single directory component** of the backup root: every
    /// character it admits is an ASCII digit or one of `-`, `T`, `Z`, so no
    /// identity can carry a separator, a `.`, a `..` or an absolute path.
    /// **Lexical** containment is therefore a property of this constructor
    /// rather than a check somewhere else: joining the identity introduces no
    /// `.` or `..` escape. Filesystem containment retains the target-specific
    /// guarantees documented by `ResolvedDirectory`.
    ///
    /// **A name that parses is not a batch.** It is a shape; whether a directory
    /// of that name exists, is a real directory and carries the ownership marker
    /// is asked again by every call that uses the identity.
    pub fn parse(name: &str) -> Option<BackupBatchId> {
        let (stamp, counter) = parse_batch_name(name)?;
        Some(BackupBatchId {
            name: name.to_owned(),
            stamp: stamp.to_owned(),
            counter,
        })
    } // End of function parse()

    /// The exact directory name, which is also the label a screen may show.
    ///
    /// **It is a name.** The truthful sentence around it is *recognised backup
    /// batch named `…`*; it is not a time, not a version and not evidence that
    /// this application wrote the directory.
    pub fn display_name(&self) -> &str {
        &self.name
    }

    /// The stamp half of the name — the first ordering operand, as text.
    pub fn stamp(&self) -> &str {
        &self.stamp
    }

    /// The disambiguating counter — the second ordering operand, as a number.
    ///
    /// It separates sessions that minted their first backup inside one
    /// wall-clock second. It is **not** an edit sequence and counts nothing a
    /// person did.
    pub fn counter(&self) -> u32 {
        self.counter
    }

    /// The order two identities are displayed in: **newest name first**.
    ///
    /// One comparison, shared with [`rotate`] — see
    /// [`compare_batches_newest_first`].
    pub fn newest_first(&self, other: &BackupBatchId) -> Ordering {
        compare_batches_newest_first((&self.stamp, self.counter), (&other.stamp, other.counter))
    }
} // End of impl BackupBatchId

impl Serialize for BackupBatchId {
    /// Writes **the directory name and nothing else**.
    ///
    /// Hand-written rather than derived because the other two fields are
    /// [`parse_batch_name`]'s reading of that same name: putting them on the
    /// wire would be three spellings of one value, and a caller could hand back
    /// a `stamp` and a `counter` that disagree with the `name` beside them.
    /// Every operand the grammar produces is recovered by
    /// [`BackupBatchId::parse`] on the way in, so nothing is lost.
    ///
    /// The name is a `String` and therefore always spellable: every character
    /// [`parse_batch_name`] admits is an ASCII digit or one of `-`, `T`, `Z`.
    /// **This identity round-trips exactly**, and it is the only reason a caller
    /// may hand one back.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("BackupBatchId", 1)?;
        out.serialize_field("name", &self.name)?;
        out.end()
    } // End of function serialize() for BackupBatchId
}

/// One recognised batch, as a scan found it.
///
/// The opaque identity and a display name, deliberately **not** a path: a caller
/// reads a batch through [`BackupCatalog`], which revalidates, and never by
/// joining strings.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BackupBatch {
    /// The identity every later call is made with.
    id: BackupBatchId,
}

impl BackupBatch {
    /// The opaque identity.
    pub fn id(&self) -> &BackupBatchId {
        &self.id
    }

    /// The directory name, which is the only label there is.
    pub fn display_name(&self) -> &str {
        self.id.display_name()
    }
} // End of impl BackupBatch

impl Serialize for BackupBatch {
    /// Writes the opaque identity and the label, which are the two things a
    /// caller does two different things with.
    ///
    /// They carry the same characters, and that is stated rather than hidden:
    /// `id` is what a later call is made with and `display_name` is what a
    /// screen may show. Neither is authority: every use re-resolves the identity
    /// beneath the backup root — see [`BackupBatchId`], which argues why an
    /// identity is a question and not a handle.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("BackupBatch", 2)?;
        out.serialize_field("id", &self.id)?;
        out.serialize_field("display_name", self.display_name())?;
        out.end()
    } // End of function serialize() for BackupBatch
}

/// One entry of one batch, as an identity that is **opaque by contract**.
///
/// It holds the batch identity plus a **validated relative component path** —
/// every component a plain name, so joining it onto the batch it names
/// introduces no lexical `.` or `..` escape; filesystem containment retains the
/// target-specific guarantees documented by `ResolvedDirectory`. As with
/// [`BackupBatchId`], holding one proves nothing about the tree: every use
/// re-resolves it.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct BackupEntryId {
    /// The batch the entry is inside.
    batch: BackupBatchId,
    /// The path relative to that batch directory. Plain-name components only.
    relative: PathBuf,
}

impl BackupEntryId {
    /// Builds an entry identity, or refuses a path this catalogue cannot address.
    ///
    /// A path is admitted only when it has at least one component and **every**
    /// component, *as it is spelled*, is a plain name: `.`, `..`, a leading `/`,
    /// a trailing separator and the empty component a repeated separator makes
    /// are all **refused** rather than normalised away, so joining the identity
    /// onto its batch introduces no lexical `.` or `..` escape, by construction
    /// rather than by a later check; filesystem containment retains the
    /// target-specific guarantees documented by `ResolvedDirectory`.
    /// `match/./base.yml` and `match//base.yml` are therefore `None`, not
    /// `match/base.yml`; [`validated_relative_path`] argues why that has to be
    /// read from the spelling. The batch's own ownership marker is refused too —
    /// it is not a copied file, and offering it would present this module's own
    /// bookkeeping as a restorable document.
    pub fn in_batch(batch: BackupBatchId, relative: &Path) -> Option<BackupEntryId> {
        let relative = validated_relative_path(relative)?;
        if relative == Path::new(BATCH_MARKER_NAME) {
            return None;
        }
        Some(BackupEntryId { batch, relative })
    } // End of function in_batch()

    /// The batch this entry is inside.
    pub fn batch(&self) -> &BackupBatchId {
        &self.batch
    }

    /// The path relative to that batch directory.
    ///
    /// **Relative, and it stays relative.** It is the display path and the key
    /// the target mapping is read from; the absolute path of the copy is the
    /// catalogue's business, and [`BackupCatalog::read_entry`] is how bytes are
    /// obtained.
    pub fn relative_path(&self) -> &Path {
        &self.relative
    }
} // End of impl BackupEntryId

impl Serialize for BackupEntryId {
    /// Writes the batch identity and the relative path, the second through
    /// [`WirePathRef`].
    ///
    /// **The rendering is lossy and the identity is not**, which is the whole of
    /// what this impl claims. A component this filesystem admits and no encoding
    /// can spell renders with `U+FFFD` and therefore does **not** come back as
    /// the path it was written from — so an identity that went out lossily is
    /// one a caller cannot hand back, and every call re-resolves what it is
    /// given anyway ([`BackupCatalog`]). The lossy rendering is chosen over a
    /// failing serializer for [`crate::wire`]'s reason: a response that fails to
    /// serialize reaches a webview as `serde`'s own English prose, and there is
    /// no second error to send instead.
    ///
    /// The boundary that turns *"lossy, therefore unusable"* into *"never
    /// offered"* is `src-tauri/src/backup.rs`, which lists only entries whose
    /// identity survives this rendering byte for byte and counts the rest.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("BackupEntryId", 2)?;
        out.serialize_field("batch", &self.batch)?;
        out.serialize_field("relative_path", &WirePathRef(&self.relative))?;
        out.end()
    } // End of function serialize() for BackupEntryId
}

/// One entry a batch offers, as a scan found it.
///
/// On the wire it is its four fields exactly: the opaque identity, the lossy
/// display path, the observed byte length and the target classification. **A
/// filesystem length is a `u64` and is not inherently bounded by JavaScript's
/// exact-integer range, so it must cross in a lossless representation** — see
/// [`serialize_byte_length`]. Nothing here is a path a caller may write to.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub struct BackupEntry {
    /// The identity every later call is made with.
    id: BackupEntryId,
    /// The path relative to the batch, for display.
    display_path: WirePath,
    /// The byte length the scan observed. Decimal digits on the wire.
    #[serde(serialize_with = "serialize_byte_length")]
    length: u64,
    /// Which target namespace the entry's own **name** occupies, and — for an
    /// ordinary, undisambiguated in-root name — the live path that would map to
    /// it. Never a claim about where any bytes came from.
    target: BackupTarget,
}

impl BackupEntry {
    /// The opaque identity.
    pub fn id(&self) -> &BackupEntryId {
        &self.id
    }

    /// The path relative to the batch directory, for display.
    ///
    /// Never absolute, and never a path a caller may write to.
    pub fn display_path(&self) -> &WirePath {
        &self.display_path
    }

    /// The byte length **observed when the entry was listed**.
    ///
    /// A fact about that moment and not a promise about the next read: the file
    /// can change between the two, which is why
    /// [`BackupCatalog::read_entry`] hashes what it actually read rather than
    /// trusting this.
    ///
    /// The full `u64` in Rust; [`serialize_byte_length`] is what carries it
    /// across without rounding.
    pub fn length(&self) -> u64 {
        self.length
    }

    /// Which target namespace this entry's **name** occupies.
    ///
    /// A syntactic classification of the path, never a statement about a file
    /// or about where any bytes came from — a disambiguated or forged name
    /// identifies no source. See [`BackupTarget`], which argues both.
    pub fn target(&self) -> &BackupTarget {
        &self.target
    }
} // End of impl BackupEntry

/// What one listing of the backup root found.
///
/// **The eligible batches and the entries that were skipped, never one without
/// the other.** A scan that met an unreadable entry has seen an incomplete root,
/// and a caller holding only a list of batches would have no way to tell that
/// from a complete one — so *"there are no backups"* is a sentence
/// [`BackupBatchScan::complete`] licenses and a bare `batches.is_empty()` does
/// not.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupBatchScan {
    /// Whether the backup root existed at all.
    pub root: BackupRootState,
    /// The recognised batches, **newest name first**.
    pub batches: Vec<BackupBatch>,
    /// One code per entry of the root that is not an eligible batch.
    ///
    /// The length is the count and each element is the reason, so a caller can
    /// report either without a second field coming to disagree with the first.
    pub skipped: Vec<BatchSkipped>,
}

impl BackupBatchScan {
    /// How many entries of the root were read and were not batches.
    pub fn unrecognised(&self) -> usize {
        self.skipped
            .iter()
            .filter(|reason| !reason.is_unreadable())
            .count()
    }

    /// How many entries of the root nothing could be learned about.
    pub fn unreadable(&self) -> usize {
        self.skipped
            .iter()
            .filter(|reason| reason.is_unreadable())
            .count()
    }

    /// Whether every entry of the root was read.
    ///
    /// `true` for a missing root as well, which is a complete answer about a
    /// root that is not there. **`false` means the list of batches may be
    /// short**, so a caller may not say the root holds only what it lists.
    pub fn complete(&self) -> bool {
        self.unreadable() == 0
    }
} // End of impl BackupBatchScan

/// What one walk of one batch found.
///
/// The same shape, and the same reason for it, as [`BackupBatchScan`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupEntryScan {
    /// The batch that was walked.
    pub batch: BackupBatchId,
    /// The entries it offers, ordered by their relative path.
    ///
    /// The order is for a stable display and says nothing about anything else.
    pub entries: Vec<BackupEntry>,
    /// One code per thing inside the batch that is not an entry.
    pub skipped: Vec<EntrySkipped>,
}

impl BackupEntryScan {
    /// How many things inside the batch were read and are not entries.
    pub fn unrecognised(&self) -> usize {
        self.skipped
            .iter()
            .filter(|reason| !reason.is_unreadable())
            .count()
    }

    /// How many things inside the batch nothing could be learned about.
    pub fn unreadable(&self) -> usize {
        self.skipped
            .iter()
            .filter(|reason| reason.is_unreadable())
            .count()
    }

    /// Whether the whole batch was walked.
    ///
    /// **`false` means the list of entries may be short**, most often because a
    /// directory inside the batch could not be listed.
    pub fn complete(&self) -> bool {
        self.unreadable() == 0
    }
} // End of impl BackupEntryScan

/// The exact bytes one entry held when it was read, and their revision.
///
/// **Bytes, unchanged.** Nothing here decoded, normalised, converted a line
/// ending or stripped a byte-order mark, and the revision is
/// [`ContentRevision::of_bytes`] over exactly what was read — so a caller can
/// prove that what it previews and what it later submits are the same bytes.
///
/// It is **untrusted input**. It came out of a directory anything able to write
/// there could have put a file in, and holding one is no evidence that this
/// application wrote it, that it is a copy of any particular file, or that its
/// contents are anything in particular.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupBytes {
    /// The entry the bytes were read from.
    entry: BackupEntryId,
    /// The bytes, exactly as they were read.
    bytes: Vec<u8>,
    /// Their content revision.
    revision: ContentRevision,
}

impl BackupBytes {
    /// The entry these bytes were read from.
    pub fn entry(&self) -> &BackupEntryId {
        &self.entry
    }

    /// The bytes, exactly as they were read.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// The revision of exactly those bytes.
    pub fn revision(&self) -> ContentRevision {
        self.revision
    }

    /// Reads the bytes as UTF-8, or refuses at the first invalid sequence.
    ///
    /// The same answer `crate::workspace`'s own reader gives, and for the same
    /// reason: a lossy decode would hand back a `String` that is **not** the
    /// file, and every later sentence about "the text of this backup" would be
    /// false. There is no replacement character, no normalisation and no
    /// fallback — a file this refuses simply has no text.
    ///
    /// The revision travels through unchanged, because the string holds the very
    /// bytes it was computed over.
    pub fn utf8(self) -> Result<BackupText, BackupReadError> {
        let BackupBytes {
            entry,
            bytes,
            revision,
        } = self;
        match String::from_utf8(bytes) {
            Ok(text) => Ok(BackupText {
                entry,
                text,
                revision,
            }),
            Err(error) => Err(BackupReadError::NotUtf8 {
                entry,
                offset: error.utf8_error().valid_up_to(),
            }),
        }
    } // End of function utf8()
} // End of impl BackupBytes

/// The exact text one entry held, and the revision of the bytes it is.
///
/// Everything [`BackupBytes`] says applies here: it is untrusted input that
/// happened to be valid UTF-8, unchanged in every byte.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupText {
    /// The entry the text was read from.
    entry: BackupEntryId,
    /// The text, exactly as the bytes spelled it.
    text: String,
    /// The revision of those bytes.
    revision: ContentRevision,
}

impl BackupText {
    /// The entry this text was read from.
    pub fn entry(&self) -> &BackupEntryId {
        &self.entry
    }

    /// The text, exactly as the bytes spelled it.
    pub fn text(&self) -> &str {
        &self.text
    }

    /// The revision of the bytes this text is.
    pub fn revision(&self) -> ContentRevision {
        self.revision
    }

    /// Unwraps to the owned string.
    pub fn into_text(self) -> String {
        self.text
    }
} // End of impl BackupText

/// A read-only view of the backup tree under one configuration root.
///
/// # What it is for, and what it deliberately is not
///
/// [`BackupSession`] is the write side and is **stateful**: it mints one batch,
/// records which files it has copied, and runs the one destructive operation in
/// this crate. This is the other half — an ordinary value with no state, which
/// **creates nothing, removes nothing and rotates nothing**. Rotation is
/// deliberately coupled to a successfully written capture ([`BackupSession::capture`]);
/// nothing on this side calls it, and enumerating a root that holds more than
/// [`BATCHES_RETAINED`] batches leaves every one of them exactly where it was.
///
/// # Every identity is rechecked, every time
///
/// A [`BackupBatchId`] or a [`BackupEntryId`] is a **question**, not a handle.
/// Between any two calls the tree can change — another session's rotation, an
/// archiver, a person in Finder — so each call re-asks the whole chain: the root
/// is a real private directory, the batch name parses, the batch is a real
/// directory carrying its marker, the entry's components are plain names, no
/// component is a symlink, and the leaf is a real regular file. A batch or an
/// entry that has gone is a typed [`BackupReadError::StaleBatch`] or
/// [`BackupReadError::StaleEntry`] — **never an empty listing and never an empty
/// file**.
///
/// **The chain is re-asked from the root on every call, and on macOS it is
/// walked in descriptors.** The root is opened `O_DIRECTORY | O_NOFOLLOW`, each
/// child is opened relative to its already-open parent with
/// `openat(…, O_NOFOLLOW)` and confirmed by `fstat` on the descriptor, and a
/// read uses that same leaf descriptor — so no component **inside the backup
/// tree** is resolved by pathname twice and nothing checked can be swapped for a
/// symlink before it is used. The root's own path is resolved once, and
/// `O_NOFOLLOW` protects its final component alone. Off
/// macOS the same components are checked with [`fs::symlink_metadata`] and the
/// listing or open that follows is a pathname operation, so a link already there
/// is refused while a component swapped between the check and the use can still
/// be followed. This module's header argues the split; no sentence here claims
/// the macOS answer for every target.
///
/// # Everything it hands back is untrusted input
///
/// The ownership marker means *recognised as this application's batch format*.
/// It is deliberately forgeable by anything able to write inside the backup root
/// (see this module's own header), so recognition is protection against
/// **accident** and is not authentication. Nothing this type answers is evidence
/// that this application wrote a file, that a copy preserved anything, or that a
/// batch corresponds to any moment in a file's history.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupCatalog {
    /// The configuration root the target mapping is taken relative to,
    /// canonicalised where that was possible.
    config_root: PathBuf,
    /// `<config_root>/.espansoconfig-backups`.
    root: PathBuf,
}

impl BackupCatalog {
    /// Opens a read-only view of the backups under `config_root`.
    ///
    /// `config_root` is **canonicalised where that succeeds**, for exactly the
    /// reason [`BackupSession::rooted_at`] canonicalises it: the paths a target
    /// mapping is compared against are resolved ones, and a root reached through
    /// `/var` or a symlinked home directory would otherwise map every in-root
    /// file into the external namespace. A root that cannot be canonicalised is
    /// kept as spelled.
    ///
    /// **Construction creates nothing, and reads no backup catalogue and no
    /// backup content.** It is not, however, free of the filesystem: the
    /// canonicalisation above consults it and resolves links along the
    /// configuration-root path. What it never does is create the backup root,
    /// list it, or read a byte of anything inside it — constructing a catalogue
    /// for a configuration that has never been saved from is legal and leaves no
    /// trace, and the missing root shows up as [`BackupRootState::Missing`] on
    /// the first scan.
    pub fn rooted_at(config_root: &Path) -> BackupCatalog {
        let config_root = fs::canonicalize(config_root).unwrap_or_else(|_| config_root.to_owned());
        let root = config_root.join(BACKUP_DIRECTORY_NAME);
        BackupCatalog { config_root, root }
    } // End of function rooted_at()

    /// The configuration root this catalogue maps targets relative to, as it
    /// resolved it.
    pub fn config_root(&self) -> &Path {
        &self.config_root
    }

    /// Lists the recognised batches, newest name first.
    ///
    /// A missing root answers a scan saying so; an existing root that is not a
    /// real private directory is refused, on the same two checks
    /// [`create_backup_root`] requires before writing, so a root this
    /// application would refuse to write into is a root it refuses to read from.
    /// Everything else in the root — a foreign name, a batch-shaped directory
    /// with no marker, a regular file, a symlink named like a batch — is
    /// **skipped, reported and never counted as a batch**, which is
    /// [`rotate`]'s ownership boundary read rather than enforced.
    pub fn scan_batches(&self) -> Result<BackupBatchScan, BackupReadError> {
        let Some(root) = self.open_root()? else {
            return Ok(BackupBatchScan {
                root: BackupRootState::Missing,
                batches: Vec::new(),
                skipped: Vec::new(),
            });
        };
        let mut scan = BackupBatchScan {
            root: BackupRootState::Present,
            batches: Vec::new(),
            skipped: Vec::new(),
        };
        let names = root.names().map_err(|refusal| BackupReadError::Io {
            step: BackupReadStep::ListBackupRoot,
            path: self.root.clone(),
            source: refusal.into_io_error(),
        })?;

        for name in names {
            let Some(id) = name.to_str().and_then(BackupBatchId::parse) else {
                scan.skipped.push(BatchSkipped::ForeignName);
                continue;
            };
            // Resolved **against the root this call opened**, refusing a
            // symbolic link, so a name that is one is not mistaken for the
            // directory it points at — exactly the boundary `rotate` applies.
            let batch = match root.child_directory(&name) {
                Ok(batch) => batch,
                Err(ChildRefusal::Symlink) | Err(ChildRefusal::WrongKind) => {
                    scan.skipped.push(BatchSkipped::NotADirectory);
                    continue;
                }
                Err(_) => {
                    scan.skipped.push(BatchSkipped::Unreadable);
                    continue;
                }
            };
            if !carries_batch_marker(&batch) {
                scan.skipped.push(BatchSkipped::NoMarker);
                continue;
            }
            scan.batches.push(BackupBatch { id });
        } // End of the loop over the backup root's entries

        scan.batches
            .sort_by(|left, right| left.id.newest_first(&right.id));
        Ok(scan)
    } // End of function scan_batches()

    /// Walks one batch and lists the entries it offers.
    ///
    /// The batch identity is re-resolved first, so a batch rotation removed
    /// between two calls is [`BackupReadError::StaleBatch`] rather than a batch
    /// with no entries. **Every symbolic link the walk observes is refused, at
    /// any depth** — and how far that goes beyond *already there* depends on the
    /// target. On macOS each directory is opened relative to the one above it
    /// with `openat(…, O_NOFOLLOW)`, so a substitution below the opened root
    /// made after a component was checked cannot be followed either; off macOS
    /// the components are checked with [`fs::symlink_metadata`] and the listing
    /// that follows is a pathname operation, so such a substitution between the
    /// check and that pathname's use **can** still be followed (this module's
    /// header argues the split). It skips the batch's own ownership marker and
    /// offers only real regular files; a directory
    /// inside the batch that cannot be listed is counted as
    /// [`EntrySkipped::Unreadable`] rather than failing the whole walk, because
    /// a caller must be able to tell a short list from a complete one.
    pub fn scan_entries(&self, batch: &BackupBatchId) -> Result<BackupEntryScan, BackupReadError> {
        let directory = self.recognised_batch(batch)?;
        let mut scan = BackupEntryScan {
            batch: batch.clone(),
            entries: Vec::new(),
            skipped: Vec::new(),
        };
        let names = directory.names().map_err(|refusal| BackupReadError::Io {
            step: BackupReadStep::ListBatch,
            path: directory.path().to_path_buf(),
            source: refusal.into_io_error(),
        })?;
        walk_batch_directory(batch, &directory, names, Path::new(""), &mut scan);
        scan.entries
            .sort_by(|left, right| left.id.relative.cmp(&right.id.relative));
        Ok(scan)
    } // End of function scan_entries()

    /// The entry of `batch` that `target`'s own copy would have been written to,
    /// if one is there.
    ///
    /// The **forward** direction of the mapping [`backup_relative_path`] and
    /// [`BackupTarget`] are the two halves of, run against the same
    /// configuration root the write side resolves against. `target` is
    /// canonicalised where that succeeds, because the path a capture was taken
    /// under is a resolved one.
    ///
    /// `Ok(None)` means *this batch offers nothing at the name that target maps
    /// to* — the file was never copied into this batch, what is at that name is
    /// a directory, a symlink or something else this catalogue does not offer,
    /// or the mapping produced a name no identity may be built for. It is
    /// deliberately not an error: the ordinary answer for most files and most
    /// batches is *no*.
    ///
    /// **A copy published under a disambiguated sibling name is not this
    /// target's entry**, because that name is not the name the mapping produces.
    /// It is still listed by [`BackupCatalog::scan_entries`], where its own path
    /// is what it says it is — classified literally, and saying nothing about
    /// the file it may or may not have been copied from.
    ///
    /// **A `target` equal to the configuration root is `Ok(None)`**, which is
    /// this side of the one place the mapping is deliberately not total.
    /// [`backup_relative_path`] answers the sentinel `_outside_` there so that
    /// no copy is ever given an empty path; reversed, that name is the escaped
    /// spelling of an in-root file genuinely called `_outside`. The write side
    /// cannot reach the forward case — the transaction saves regular files, and
    /// a configuration root is a directory — so rather than round-trip the
    /// sentinel this refuses it, because the alternative is offering one file's
    /// copy as another's.
    pub fn entry_for_target(
        &self,
        batch: &BackupBatchId,
        target: &Path,
    ) -> Result<Option<BackupEntry>, BackupReadError> {
        let directory = self.recognised_batch(batch)?;
        let target = fs::canonicalize(target).unwrap_or_else(|_| target.to_owned());
        // The one target the forward mapping answers with a sentinel rather than
        // with the target's own path. See `BackupTarget`: `_outside_` is the
        // escaped in-root name of a *file* called `_outside`, so mapping the
        // configuration root onto it would offer that file's copy as this
        // target's. A directory is never a copied regular file, so the honest
        // answer is *no entry*.
        if target == self.config_root {
            return Ok(None);
        }
        let relative = backup_relative_path(&self.config_root, &target);
        let Some(id) = BackupEntryId::in_batch(batch.clone(), &relative) else {
            return Ok(None);
        };
        match observe_entry(&directory, &id.relative)? {
            Some(length) => Ok(Some(entry_of(id, length))),
            None => Ok(None),
        }
    } // End of function entry_for_target()

    /// Reads one entry's exact bytes.
    ///
    /// The whole chain is rechecked before a byte is read — root, batch grammar,
    /// batch directory, marker, component containment, no symlink at any
    /// component it resolves, and a real regular file at the leaf — and an
    /// identity that does not resolve now is [`BackupReadError::StaleEntry`],
    /// **never an empty file**.
    ///
    /// **The bytes are read from the descriptor the leaf check was made on.**
    /// On macOS that closes the window entirely: the leaf is opened relative to
    /// its already-open parent with `openat(…, O_NOFOLLOW)`, `fstat` on that
    /// descriptor is what proves it a regular file, and the read that follows
    /// resolves no name, so nothing can be substituted between the two. Off
    /// macOS the leaf is still opened by pathname after a
    /// [`fs::symlink_metadata`] check and confirmed on the descriptor
    /// afterwards, which narrows the window rather than closing it; that
    /// limitation belongs to those builds and this module's header states it.
    ///
    /// The bytes come back exactly as they were on disk, with their revision. It
    /// is [`BackupBytes::utf8`] that decides whether there is any text.
    pub fn read_entry(&self, entry: &BackupEntryId) -> Result<BackupBytes, BackupReadError> {
        let directory = self.recognised_batch(entry.batch())?;
        let Some((mut handle, _)) = open_entry(&directory, &entry.relative)? else {
            return Err(BackupReadError::StaleEntry {
                entry: entry.clone(),
            });
        };
        let mut bytes = Vec::new();
        handle
            .read_to_end(&mut bytes)
            .map_err(|error| BackupReadError::Io {
                step: BackupReadStep::ReadEntry,
                path: directory.path().join(&entry.relative),
                source: error,
            })?;
        Ok(BackupBytes {
            entry: entry.clone(),
            revision: ContentRevision::of_bytes(&bytes),
            bytes,
        })
    } // End of function read_entry()

    /// Resolves the backup root as it is right now, without creating it.
    ///
    /// `Ok(None)` is [`BackupRootState::Missing`] — an outcome and not a
    /// failure. The two refusals are the read-side twin of
    /// [`create_backup_root`]'s adoption branch, deliberately the same two: a
    /// root this application would not write into is a root it will not read
    /// from, so the two sides cannot come to disagree about which directory is a
    /// backup root.
    ///
    /// What it answers on success is a resolved directory. **On macOS, every
    /// later component is resolved relative to the opened root descriptor. Off
    /// macOS, later operations re-resolve the stored pathname and retain the
    /// substitution race documented by `ResolvedDirectory`.**
    fn open_root(&self) -> Result<Option<ResolvedDirectory>, BackupReadError> {
        let root = match ResolvedDirectory::open_root(&self.root) {
            Ok(root) => root,
            Err(ChildRefusal::Gone) => return Ok(None),
            Err(ChildRefusal::Symlink) | Err(ChildRefusal::WrongKind) => {
                return Err(BackupReadError::RootNotADirectory {
                    path: self.root.clone(),
                })
            }
            Err(refusal) => {
                return Err(BackupReadError::Io {
                    step: BackupReadStep::InspectBackupRoot,
                    path: self.root.clone(),
                    source: refusal.into_io_error(),
                })
            }
        };
        let mode = root.mode().map_err(|refusal| BackupReadError::Io {
            step: BackupReadStep::InspectBackupRoot,
            path: self.root.clone(),
            source: refusal.into_io_error(),
        })?;
        if mode & BACKUP_DIRECTORY_FORBIDDEN_MODE != 0 {
            return Err(BackupReadError::RootNotPrivate {
                path: self.root.clone(),
                mode,
            });
        }
        Ok(Some(root))
    } // End of function open_root()

    /// Re-resolves a batch identity to a directory this module recognises now.
    ///
    /// Four questions, asked again on every call because the answer to any of
    /// them can change between two of them: is there a private backup root, does
    /// the name still parse, is a real directory there, and does it carry the
    /// ownership marker. Anything else is [`BackupReadError::StaleBatch`].
    ///
    /// The batch is resolved **against the root this call just resolved**, and
    /// no lexical escape can leave it: [`BackupBatchId::parse`] admits only
    /// names made of ASCII digits and `-`, `T`, `Z`, so an identity is always
    /// exactly one plain component. On macOS that resolution is relative to the
    /// root's open descriptor; off macOS it lengthens the root's pathname and
    /// retains the substitution race documented by `ResolvedDirectory`.
    fn recognised_batch(
        &self,
        batch: &BackupBatchId,
    ) -> Result<ResolvedDirectory, BackupReadError> {
        let stale = || BackupReadError::StaleBatch {
            batch: batch.clone(),
        };
        let Some(root) = self.open_root()? else {
            return Err(stale());
        };
        if BackupBatchId::parse(&batch.name).as_ref() != Some(batch) {
            return Err(stale());
        }
        let directory = match root.child_directory(OsStr::new(&batch.name)) {
            Ok(directory) => directory,
            Err(ChildRefusal::Gone) | Err(ChildRefusal::Symlink) | Err(ChildRefusal::WrongKind) => {
                return Err(stale())
            }
            Err(refusal) => {
                return Err(BackupReadError::Io {
                    step: BackupReadStep::InspectBatch,
                    path: self.root.join(&batch.name),
                    source: refusal.into_io_error(),
                })
            }
        };
        if !carries_batch_marker(&directory) {
            return Err(stale());
        }
        Ok(directory)
    } // End of function recognised_batch()
} // End of impl BackupCatalog

/// Admits a relative path made entirely of plain-name components.
///
/// `.`, `..`, an empty component, a leading `/` and the empty path are all
/// **refused**, so joining a path this returns onto a batch directory
/// introduces no lexical `.` or `..` escape. It is the one place that **lexical**
/// containment is decided, and it is decided by construction rather than by
/// comparing prefixes afterwards; filesystem containment retains the
/// target-specific guarantees documented by `ResolvedDirectory`.
///
/// # It reads the spelling, not the components
///
/// [`Path::components`] is a **normalising** iterator: it drops an interior `.`
/// and collapses repeated separators before any loop can see them, so a
/// validator written over it accepts `match/./base.yml` and `match//base.yml`
/// and answers `match/base.yml`. That is normalisation, and this function is
/// specified to refuse. The bytes are therefore split on `/` directly, which is
/// the whole of the grammar on this platform, and every part is judged as it was
/// written.
fn validated_relative_path(relative: &Path) -> Option<PathBuf> {
    use std::os::unix::ffi::OsStrExt as _;

    let spelling = relative.as_os_str().as_bytes();
    if spelling.is_empty() {
        return None;
    }
    let mut validated = PathBuf::new();
    for part in spelling.split(|byte| *byte == b'/') {
        let name = OsStr::from_bytes(part);
        if name.is_empty() || name == OsStr::new(".") || name == OsStr::new("..") {
            return None;
        }
        validated.push(name);
    } // End of the loop over the candidate path's spelled components
    Some(validated)
} // End of function validated_relative_path()

/// Writes an observed filesystem byte length as its exact decimal digits.
///
/// **A filesystem length can exceed JavaScript's safe-integer range**, where not
/// every `u64` is exactly representable as a JSON number — for example, `2^53 + 1`
/// is rounded. A batch is untrusted input — anything able to write inside the
/// backup root can put a sparse regular file there — so a length above
/// [`crate::MAX_EXACT_WIRE_INTEGER`] is reachable. Decimal digits therefore carry
/// every value losslessly. The alternatives were refusing to offer such an entry,
/// which would drop it from a listing that claims to be complete, and capping the
/// value, which would report a length the scan never observed. The digits cross
/// instead, so the number on the wire is the number `stat` answered whatever the
/// filesystem holds.
fn serialize_byte_length<S: Serializer>(length: &u64, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(&length.to_string())
} // End of function serialize_byte_length()

/// Builds the entry value one identity and one observed length make.
///
/// One function so the display path and the target classification cannot be
/// derived two different ways in the two places entries are produced.
fn entry_of(id: BackupEntryId, length: u64) -> BackupEntry {
    let target = BackupTarget::of_backup_path(&id.relative);
    BackupEntry {
        display_path: WirePath::from(id.relative.clone()),
        id,
        length,
        target,
    }
} // End of function entry_of()

/// Either the batch directory a walk started from or one it resolved below it.
///
/// The walk borrows the batch it was handed and owns every directory it
/// resolves beneath it, and this is what lets one loop hold both without
/// duplicating what a `ResolvedDirectory` carries.
enum WalkedDirectory<'a> {
    /// The batch directory the walk was given.
    Batch(&'a ResolvedDirectory),
    /// A directory the walk resolved inside it.
    Opened(ResolvedDirectory),
}

impl WalkedDirectory<'_> {
    /// The directory itself, whichever of the two it is.
    fn directory(&self) -> &ResolvedDirectory {
        match self {
            WalkedDirectory::Batch(directory) => directory,
            WalkedDirectory::Opened(directory) => directory,
        }
    }
} // End of impl WalkedDirectory

/// Resolves the directory that holds `relative`'s last component, and answers it
/// together with that component's name.
///
/// **Every component above the leaf is resolved inside the one above it** —
/// `ResolvedDirectory::child_directory`, which refuses a symbolic link. A single
/// [`fs::symlink_metadata`] on the whole path would check the leaf and silently
/// traverse every link above it, which is the mistake this shape exists to make
/// impossible on every target.
///
/// **What that resolution *is* differs by target, and the shared loop does not
/// hide it.** On macOS each step is an `openat(…, O_NOFOLLOW)` against the
/// descriptor above it, so the walk descends the tree the batch descriptor
/// names and a component changed after its check cannot be reached at all. Off
/// macOS each step lengthens a pathname the filesystem re-resolves, so a link
/// already present is refused while that change can still be followed;
/// `ResolvedDirectory` argues the split.
///
/// `Ok(None)` is *there is nothing addressable at that path*: a non-plain
/// component, an absent component, a symbolic link at any depth, or a
/// component that is not a directory. An I/O failure that is none of those is
/// reported, because a caller must not read a refusal as an absence.
fn walk_to_parent<'a>(
    batch: &'a ResolvedDirectory,
    relative: &Path,
) -> Result<Option<(WalkedDirectory<'a>, OsString)>, BackupReadError> {
    let mut walked = WalkedDirectory::Batch(batch);
    let mut reached = batch.path().to_path_buf();
    let mut components = relative.components().peekable();
    while let Some(component) = components.next() {
        let Component::Normal(name) = component else {
            return Ok(None);
        };
        if components.peek().is_none() {
            return Ok(Some((walked, name.to_os_string())));
        }
        reached.push(name);
        let opened = match walked.directory().child_directory(name) {
            Ok(directory) => directory,
            Err(ChildRefusal::Gone) | Err(ChildRefusal::Symlink) | Err(ChildRefusal::WrongKind) => {
                return Ok(None)
            }
            Err(refusal) => {
                return Err(BackupReadError::Io {
                    step: BackupReadStep::InspectEntry,
                    path: reached,
                    source: refusal.into_io_error(),
                })
            }
        };
        walked = WalkedDirectory::Opened(opened);
    } // End of the walk down one entry's components
    Ok(None)
} // End of function walk_to_parent()

/// Looks at what is at `relative` inside `batch`, refusing every symbolic link
/// it observes.
///
/// Answers the leaf's byte length when — and only when — every component along
/// the way resolved as a real directory, no component was a symbolic link, and
/// the leaf is a real regular file. Anything else is `None`.
///
/// It **looks and does not open**, which is right for a mapping: nothing here
/// reads the file, and the length is documented as an observation rather than a
/// promise. [`open_entry`] is what a read uses — and what makes the leaf check
/// and the read one operation, which a length never can be.
///
/// How much *no component was a symbolic link* is worth depends on the target.
/// On macOS every step is taken relative to the directory already open, so a
/// substitution below the opened root made after a component was checked cannot
/// be followed; off macOS each step is a pathname the filesystem resolves
/// again, so such a substitution between the check and that use **can** be
/// followed. `ResolvedDirectory` and this module's header state both answers in
/// full.
fn observe_entry(
    batch: &ResolvedDirectory,
    relative: &Path,
) -> Result<Option<u64>, BackupReadError> {
    let Some((parent, name)) = walk_to_parent(batch, relative)? else {
        return Ok(None);
    };
    match parent.directory().child(&name) {
        Ok(ChildKind::RegularFile { length }) => Ok(Some(length)),
        Ok(_) => Ok(None),
        Err(ChildRefusal::Gone) | Err(ChildRefusal::Symlink) | Err(ChildRefusal::WrongKind) => {
            Ok(None)
        }
        Err(refusal) => Err(BackupReadError::Io {
            step: BackupReadStep::InspectEntry,
            path: parent.directory().child_path(&name),
            source: refusal.into_io_error(),
        }),
    }
} // End of function observe_entry()

/// Opens the leaf at `relative` inside `batch`, refusing every symbolic link it
/// observes, and answers the descriptor together with the length that descriptor
/// reports.
///
/// **The descriptor is the answer**, and the reason is the whole of the High
/// finding this replaced: a caller that received *"a regular file is there"* and
/// then opened the name itself would open whatever holds the name at that later
/// moment. Here the object was confirmed by `fstat` on the very descriptor the
/// caller reads from, so there is nothing left between the check and the use —
/// on macOS, where the components above it are descriptors too. Off macOS the
/// leaf and every component above it are reached by pathname, so a substitution
/// made between a check and its use can be followed and the window narrows
/// rather than closing; `ResolvedDirectory` states that split in full.
fn open_entry(
    batch: &ResolvedDirectory,
    relative: &Path,
) -> Result<Option<(File, u64)>, BackupReadError> {
    let Some((parent, name)) = walk_to_parent(batch, relative)? else {
        return Ok(None);
    };
    match parent.directory().child_regular_file(&name) {
        Ok(opened) => Ok(Some(opened)),
        Err(ChildRefusal::Gone) | Err(ChildRefusal::Symlink) | Err(ChildRefusal::WrongKind) => {
            Ok(None)
        }
        Err(refusal) => Err(BackupReadError::Io {
            step: BackupReadStep::ReadEntry,
            path: parent.directory().child_path(&name),
            source: refusal.into_io_error(),
        }),
    }
} // End of function open_entry()

/// Adds one directory of a batch to the scan, recursing into the real
/// directories it holds.
///
/// Recursion is bounded by the tree itself, because every symbolic link it
/// observes is refused rather than recursed into, and a filesystem's own path
/// limit bounds how deep a real tree can be. Each subdirectory is **resolved
/// inside the directory above it**, and what that resolution *is* differs by
/// target: only the macOS body makes it a descriptor, where `openat(…,
/// O_NOFOLLOW)` against the directory already open means a descended pathname
/// is never resolved a second time. Off macOS each step lengthens a pathname
/// the filesystem resolves again — `ResolvedDirectory::names` hands it to
/// [`fs::read_dir`] — so a component swapped between its check and that use
/// **can** be followed. A directory that cannot be listed becomes one
/// [`EntrySkipped::Unreadable`] rather than failing the walk, so a partial
/// listing is reported as partial.
///
/// A listed entry is classified without being opened, which is right for a
/// listing: nothing here reads a file, and the length it records is an
/// observation of that moment.
fn walk_batch_directory(
    batch: &BackupBatchId,
    directory: &ResolvedDirectory,
    names: Vec<OsString>,
    prefix: &Path,
    scan: &mut BackupEntryScan,
) {
    for name in names {
        if prefix.as_os_str().is_empty() && name == OsStr::new(BATCH_MARKER_NAME) {
            scan.skipped.push(EntrySkipped::Marker);
            continue;
        }
        let relative = prefix.join(&name);
        let Some(relative) = validated_relative_path(&relative) else {
            scan.skipped.push(EntrySkipped::UnusableName);
            continue;
        };
        match directory.child(&name) {
            Ok(ChildKind::Symlink) => scan.skipped.push(EntrySkipped::Symlink),
            Ok(ChildKind::Other) => scan.skipped.push(EntrySkipped::NotARegularFile),
            Ok(ChildKind::RegularFile { length }) => {
                match BackupEntryId::in_batch(batch.clone(), &relative) {
                    Some(id) => scan.entries.push(entry_of(id, length)),
                    None => scan.skipped.push(EntrySkipped::UnusableName),
                }
            }
            Ok(ChildKind::Directory) => match directory.child_directory(&name) {
                Ok(inner) => match inner.names() {
                    Ok(names) => walk_batch_directory(batch, &inner, names, &relative, scan),
                    Err(_) => scan.skipped.push(EntrySkipped::Unreadable),
                },
                Err(ChildRefusal::Symlink) => scan.skipped.push(EntrySkipped::Symlink),
                Err(_) => scan.skipped.push(EntrySkipped::Unreadable),
            },
            Err(ChildRefusal::Symlink) => scan.skipped.push(EntrySkipped::Symlink),
            Err(_) => scan.skipped.push(EntrySkipped::Unreadable),
        }
    } // End of the loop over one directory of a batch
} // End of function walk_batch_directory()

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

    /// Eleven recognised batch names, ten kept, and the lowest-sorting name
    /// removed.
    #[test]
    fn rotation_keeps_ten_batches_and_removes_the_lowest_sorting_name_first() {
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
        assert!(
            !seeded[0].exists(),
            "the lowest-sorting batch name is the one removed"
        );
        for kept in &seeded[1..] {
            assert!(kept.exists(), "{} must survive", kept.display());
        }
    } // End of function rotation_keeps_ten_batches_and_removes_the_lowest_sorting_name_first()

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

    /// The disambiguating counter orders numerically, so `-2` sorts below `-10`;
    /// a lexicographic comparison of the whole name would reverse them.
    #[test]
    fn the_disambiguating_counter_orders_as_a_number_and_not_as_text() {
        let (_directory, root) = backup_root();
        let lowest_sorting = seed_batch(&root, "2026-07-29T143012Z");
        let second = seed_batch(&root, "2026-07-29T143012Z-2");
        let highest_sorting = seed_batch(&root, "2026-07-29T143012Z-10");

        let rotation = rotate(&root, 2, None);
        assert_eq!(rotation.removed, 1);
        assert!(
            !lowest_sorting.exists(),
            "the bare stamp has the lowest-sorting name of the three"
        );
        assert!(second.exists());
        assert!(highest_sorting.exists(), "-10 sorts above -2");
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
        assert_eq!(
            rotation.removed, 1,
            "only the lowest-sorting recognised batch name goes"
        );
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
    /// whole component path, and introduces no lexical `.` or `..` escape.
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

    /// **A timestamp-shaped name is not evidence that this module minted a
    /// directory.**
    ///
    /// A recognised ownership marker makes the directory eligible for rotation,
    /// but remains forgeable and proves neither creation nor provenance; a
    /// batch-shaped directory without one is left alone and is not counted
    /// against retention.
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
            "the lowest-sorting marked batch name is the one removed"
        );
    } // End of function rotation_leaves_a_batch_shaped_directory_that_carries_no_marker()

    /// A marker file with somebody else's content is not this module's marker.
    #[test]
    fn a_marker_of_another_format_is_not_recognised() {
        let (_directory, root) = backup_root();
        let batch = seed_foreign_batch(&root, "2026-07-29T140000Z");
        fs::write(batch.join(BATCH_MARKER_NAME), b"somebody else's file\n").expect("written");
        assert!(!path_carries_batch_marker(&batch));

        // A directory, and a symlink to a real marker, are both refused too:
        // the marker is opened without following anything, for the reason the
        // root is.
        let second = seed_foreign_batch(&root, "2026-07-29T140100Z");
        fs::create_dir(second.join(BATCH_MARKER_NAME)).expect("a directory in its place");
        assert!(!path_carries_batch_marker(&second));

        let third = seed_batch(&root, "2026-07-29T140200Z");
        assert!(
            path_carries_batch_marker(&third),
            "the format this module recognises"
        );
        let fourth = seed_foreign_batch(&root, "2026-07-29T140300Z");
        std::os::unix::fs::symlink(
            third.join(BATCH_MARKER_NAME),
            fourth.join(BATCH_MARKER_NAME),
        )
        .expect("the link is created");
        assert!(!path_carries_batch_marker(&fourth));

        // And a later version of the marker still is one, so an older build does
        // not orphan a newer build's batches.
        let fifth = seed_foreign_batch(&root, "2026-07-29T140400Z");
        fs::write(
            fifth.join(BATCH_MARKER_NAME),
            format!("{BATCH_MARKER_FORMAT} 99\n"),
        )
        .expect("written");
        assert!(path_carries_batch_marker(&fifth));
    } // End of function a_marker_of_another_format_is_not_recognised()

    /// **The batch being written is never a candidate, whatever the clock did.**
    ///
    /// Ten future-dated batches make the current one the *lowest-sorting* by
    /// name, which is exactly the state a wall clock adjusted backwards
    /// produces. Ordering decides which other batch goes; it decides nothing
    /// about this one.
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
            "the lowest-sorting of the others is the one that goes"
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
        assert!(path_carries_batch_marker(&batch));
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

    // -----------------------------------------------------------------------
    // The read side: the catalogue
    // -----------------------------------------------------------------------

    /// A configuration root holding a **private** backup root, and a catalogue
    /// over it.
    ///
    /// The privacy is not incidental: [`BackupCatalog`] refuses exactly the
    /// roots [`create_backup_root`] refuses, and `backup_root()` above creates
    /// one with the process umask, which is ordinarily `0o755`.
    fn seeded_catalog() -> (tempfile::TempDir, PathBuf, BackupCatalog) {
        let directory = tempfile::tempdir().expect("a temp directory");
        let root = directory.path().join(BACKUP_DIRECTORY_NAME);
        DirBuilder::new()
            .mode(BACKUP_DIRECTORY_MODE)
            .create(&root)
            .expect("a private backup root");
        let catalog = BackupCatalog::rooted_at(directory.path());
        (directory, root, catalog)
    } // End of function seeded_catalog()

    /// Writes one file inside a batch, creating the directories above it.
    fn seed_entry(batch: &Path, relative: &str, bytes: &[u8]) -> PathBuf {
        let path = batch.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("the directories above the entry");
        }
        fs::write(&path, bytes).expect("the entry is written");
        path
    } // End of function seed_entry()

    /// Every path under `root`, with what it is and — for a regular file — its
    /// bytes.
    ///
    /// The oracle for *"reading changed nothing"*: a whole tree reduced to a
    /// sorted list, so a removal, a creation, a truncation or a retargeted link
    /// all show up as an inequality.
    fn tree_snapshot(root: &Path) -> Vec<(PathBuf, String)> {
        let mut found = Vec::new();
        let mut pending = vec![root.to_path_buf()];
        while let Some(directory) = pending.pop() {
            for entry in fs::read_dir(&directory).expect("a readable directory") {
                let path = entry.expect("a readable entry").path();
                let metadata = fs::symlink_metadata(&path).expect("stat");
                let relative = path
                    .strip_prefix(root)
                    .expect("every path is under the root")
                    .to_path_buf();
                if metadata.file_type().is_symlink() {
                    let target = fs::read_link(&path).expect("a link target");
                    found.push((relative, format!("symlink {}", target.display())));
                } else if metadata.is_dir() {
                    pending.push(path);
                    found.push((relative, "directory".to_owned()));
                } else {
                    let bytes = fs::read(&path).expect("a readable file");
                    found.push((relative, format!("file {bytes:?}")));
                }
            } // End of the loop over one directory of the snapshot
        } // End of the walk over the whole tree
        found.sort();
        found
    } // End of function tree_snapshot()

    /// **A missing backup root is an outcome, not an error**, and asking about
    /// it creates nothing.
    ///
    /// It is the ordinary state of a configuration this application has never
    /// saved from, because nothing mints the root until a session first has
    /// something to put in it.
    #[test]
    fn a_missing_backup_root_is_an_outcome_and_reading_it_creates_nothing() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let catalog = BackupCatalog::rooted_at(directory.path());

        let scan = catalog
            .scan_batches()
            .expect("a missing root is not an error");
        assert_eq!(scan.root, BackupRootState::Missing);
        assert!(scan.batches.is_empty());
        assert!(scan.skipped.is_empty());
        assert!(
            scan.complete(),
            "a root that is not there is completely known"
        );
        assert!(
            !directory.path().join(BACKUP_DIRECTORY_NAME).exists(),
            "asking about backups must never create the directory they would live in"
        );

        // And an identity handed in against a missing root is stale rather than
        // an empty listing.
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        assert!(matches!(
            catalog.scan_entries(&id),
            Err(BackupReadError::StaleBatch { .. })
        ));
        assert!(matches!(
            catalog.read_entry(
                &BackupEntryId::in_batch(id, Path::new("match/base.yml")).expect("a valid path")
            ),
            Err(BackupReadError::StaleBatch { .. })
        ));
    } // End of function a_missing_backup_root_is_an_outcome_and_reading_it_creates_nothing()

    /// **A root this application would refuse to write into is one it refuses
    /// to read from**, on the same two checks and with the same operands.
    #[test]
    fn a_backup_root_that_is_a_symlink_a_file_or_not_private_is_refused() {
        // A symlink, which is the case that matters: listing through one would
        // walk a tree this application does not own.
        let directory = tempfile::tempdir().expect("a temp directory");
        let elsewhere = directory.path().join("elsewhere");
        fs::create_dir(&elsewhere).expect("the tree the catalogue must not reach");
        let precious = seed_batch(&elsewhere, "2026-07-29T140000Z");
        let linked = directory.path().join(BACKUP_DIRECTORY_NAME);
        std::os::unix::fs::symlink(&elsewhere, &linked).expect("the link is created");
        let catalog = BackupCatalog::rooted_at(directory.path());
        assert!(
            matches!(
                catalog.scan_batches(),
                Err(BackupReadError::RootNotADirectory { .. })
            ),
            "a symlinked root is refused rather than followed"
        );
        assert!(precious.join("payload").exists());

        // A regular file where the root belongs.
        let second = tempfile::tempdir().expect("a temp directory");
        fs::write(
            second.path().join(BACKUP_DIRECTORY_NAME),
            b"not a directory",
        )
        .expect("the obstruction");
        assert!(matches!(
            BackupCatalog::rooted_at(second.path()).scan_batches(),
            Err(BackupReadError::RootNotADirectory { .. })
        ));

        // And a root somebody widened, on exactly the modes the write side
        // refuses.
        let (_third, root, catalog) = seeded_catalog();
        seed_batch(&root, "2026-07-29T143012Z");
        for mode in [0o755u32, 0o750, 0o707, 0o701] {
            fs::set_permissions(&root, Permissions::from_mode(mode)).expect("chmod");
            let refused = catalog
                .scan_batches()
                .expect_err("a root another principal can reach is refused");
            assert!(
                matches!(&refused, BackupReadError::RootNotPrivate { mode: found, .. } if *found == mode),
                "{mode:04o} got {refused}"
            );
            assert!(
                create_backup_root(&root).is_err(),
                "and the write side refuses the same root, so the two cannot disagree"
            );
        } // End of the loop over the modes a backup root may not have
        fs::set_permissions(&root, Permissions::from_mode(0o700)).expect("chmod back");
        assert_eq!(
            catalog
                .scan_batches()
                .expect("a private root reads")
                .batches
                .len(),
            1
        );
    } // End of function a_backup_root_that_is_a_symlink_a_file_or_not_private_is_refused()

    /// **The stamp orders as text and the counter as a number**, and the
    /// catalogue displays that order newest name first.
    ///
    /// `…Z-2` before `…Z-10` is the mistake a lexicographic comparison of whole
    /// directory names makes, and it is the one rotation would make in the
    /// destructive direction.
    #[test]
    fn the_catalogue_lists_batches_newest_name_first_with_the_counter_as_a_number() {
        let (_directory, root, catalog) = seeded_catalog();
        for name in [
            "2026-07-29T143012Z",
            "2026-07-29T143012Z-2",
            "2026-07-29T143012Z-10",
            "2026-07-30T000000Z",
            "2025-01-01T000000Z",
        ] {
            seed_batch(&root, name);
        } // End of the loop that seeds five batches

        let scan = catalog.scan_batches().expect("the root reads");
        let order: Vec<&str> = scan
            .batches
            .iter()
            .map(|batch| batch.display_name())
            .collect();
        assert_eq!(
            order,
            [
                "2026-07-30T000000Z",
                "2026-07-29T143012Z-10",
                "2026-07-29T143012Z-2",
                "2026-07-29T143012Z",
                "2025-01-01T000000Z",
            ],
            "newest name first, and -10 sorts above -2"
        );
        assert!(scan.complete());
        assert_eq!(scan.unrecognised(), 0);
        assert_eq!(scan.unreadable(), 0);

        // The identity carries the two operands the order is made of, and the
        // stamp is a name rather than a parsed time.
        let highest_sorting = scan.batches[0].id();
        assert_eq!(highest_sorting.stamp(), "2026-07-30T000000Z");
        assert_eq!(highest_sorting.counter(), 0);
        assert_eq!(scan.batches[1].id().counter(), 10);
    } // End of function the_catalogue_lists_batches_newest_name_first_with_the_counter_as_a_number()

    /// **The catalogue and rotation share one ordering**, so the batch the
    /// catalogue shows last is the batch rotation removes first.
    ///
    /// This is the property that made the comparison one function: the display
    /// order and the destructive order used to be two copies of one tuple,
    /// sorted opposite ways in two places.
    #[test]
    fn the_order_the_catalogue_displays_is_the_order_rotation_removes_from() {
        let (_directory, root, catalog) = seeded_catalog();
        for name in [
            "2026-07-29T143012Z-3",
            "2026-07-29T143012Z-20",
            "2026-07-29T143012Z",
            "2026-07-28T235959Z-9",
        ] {
            seed_batch(&root, name);
        } // End of the loop that seeds four batches with awkward counters

        let listed: Vec<String> = catalog
            .scan_batches()
            .expect("the root reads")
            .batches
            .iter()
            .map(|batch| batch.display_name().to_owned())
            .collect();
        let lowest_sorting = listed.last().expect("four batches").clone();

        let rotation = rotate(&root, 3, None);
        assert_eq!(rotation.removed, 1);
        assert!(
            !root.join(&lowest_sorting).exists(),
            "rotation removes the one the catalogue lists last"
        );
        for kept in &listed[..listed.len() - 1] {
            assert!(root.join(kept).exists(), "{kept} must survive");
        }
    } // End of function the_order_the_catalogue_displays_is_the_order_rotation_removes_from()

    /// **Foreign names, unmarked batch-shaped directories, regular files and
    /// symlinked batch names are skipped, reported, and never eligible** — the
    /// ownership boundary rotation applies, read rather than enforced.
    #[test]
    fn the_catalogue_reports_what_it_skipped_instead_of_hiding_it() {
        let (directory, root, catalog) = seeded_catalog();
        let mine = seed_batch(&root, "2026-07-29T143012Z");
        let unmarked = seed_foreign_batch(&root, "2026-07-29T140000Z");
        let foreign = seed_batch(&root, "somebody-elses-directory");
        fs::write(root.join("README"), b"not a batch").expect("a foreign file");
        let outside = directory.path().join("outside");
        fs::create_dir(&outside).expect("the directory the catalogue must not reach");
        fs::write(outside.join("precious"), b"x").expect("write");
        let link = root.join("2026-07-29T141500Z");
        std::os::unix::fs::symlink(&outside, &link).expect("the symlink is created");

        let scan = catalog.scan_batches().expect("the root reads");
        assert_eq!(
            scan.batches.len(),
            1,
            "only the marked, real, well-named directory is a batch"
        );
        assert_eq!(scan.batches[0].display_name(), "2026-07-29T143012Z");
        assert_eq!(scan.unrecognised(), 4);
        assert_eq!(scan.unreadable(), 0);
        assert!(scan.complete(), "every entry was read, four were rejected");
        let mut reasons: Vec<BatchSkipped> = scan.skipped.clone();
        reasons.sort();
        assert_eq!(
            reasons,
            [
                BatchSkipped::ForeignName,
                BatchSkipped::ForeignName,
                BatchSkipped::NotADirectory,
                BatchSkipped::NoMarker,
            ],
            "two foreign names, one symlink, one unmarked directory"
        );

        // Nothing was touched, and nothing behind the link was reached.
        assert!(mine.join("payload").exists());
        assert!(unmarked.join("payload").exists());
        assert!(foreign.join("payload").exists());
        assert!(outside.join("precious").exists());
        assert!(link.symlink_metadata().is_ok());
    } // End of function the_catalogue_reports_what_it_skipped_instead_of_hiding_it()

    /// **A symlink that is already there is skipped at every depth of a batch,
    /// and never followed.**
    ///
    /// A single `symlink_metadata` on a whole path checks the leaf and silently
    /// traverses every link above it, which is why the walk goes component by
    /// component.
    ///
    /// *Already there* is the honest scope of this test and the review said so:
    /// it would pass over an implementation that followed a component swapped
    /// **after** its check. `a_component_swapped_after_it_was_checked_is_not_followed`
    /// below is the one that would not.
    #[test]
    fn a_symlink_inside_a_batch_is_skipped_at_every_depth() {
        let (directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        fs::remove_file(batch.join("payload")).expect("the helper's payload is not wanted here");
        let outside = directory.path().join("outside");
        fs::create_dir_all(outside.join("tree")).expect("the tree the walk must not reach");
        let secret = outside.join("secret.yml");
        fs::write(&secret, b"not a backup\n").expect("write");
        fs::write(outside.join("tree/inner.yml"), b"nor this\n").expect("write");

        seed_entry(&batch, "match/base.yml", b"matches: []\n");
        seed_entry(&batch, "match/deep/other.yml", b"matches: []\n");
        std::os::unix::fs::symlink(&secret, batch.join("top-link.yml")).expect("depth one");
        std::os::unix::fs::symlink(&secret, batch.join("match/inner-link.yml")).expect("depth two");
        std::os::unix::fs::symlink(&secret, batch.join("match/deep/deep-link.yml"))
            .expect("depth three");
        std::os::unix::fs::symlink(outside.join("tree"), batch.join("linked-directory"))
            .expect("a linked directory");

        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        let scan = catalog.scan_entries(&id).expect("the batch walks");
        let offered: Vec<&Path> = scan
            .entries
            .iter()
            .map(|entry| entry.id().relative_path())
            .collect();
        assert_eq!(
            offered,
            [
                Path::new("match/base.yml"),
                Path::new("match/deep/other.yml")
            ],
            "only the real regular files, and nothing reached through a link"
        );
        assert_eq!(
            scan.skipped
                .iter()
                .filter(|reason| **reason == EntrySkipped::Symlink)
                .count(),
            4,
            "one link at each of three depths, plus the linked directory"
        );
        assert!(scan.complete());

        // A forged identity naming a link is stale, not a read through it.
        let forged = BackupEntryId::in_batch(id, Path::new("linked-directory/inner.yml"))
            .expect("a well-formed relative path");
        assert!(matches!(
            catalog.read_entry(&forged),
            Err(BackupReadError::StaleEntry { .. })
        ));
        assert_eq!(
            fs::read(&secret).expect("readable"),
            b"not a backup\n",
            "nothing outside the batch was read or written"
        );
    } // End of function a_symlink_inside_a_batch_is_skipped_at_every_depth()

    /// **On macOS, a component swapped for a symlink *after* it was checked is
    /// still not followed**, because there the walk never resolves that name a
    /// second time. The scope is in the first word, and the last paragraph below
    /// says why this test exists on that target alone.
    ///
    /// The test above is the one that was not enough. It seeds links that are
    /// already there, so it would pass over an implementation that checked each
    /// component with [`fs::symlink_metadata`] and then handed the whole
    /// pathname to `read_dir`/`File::open` — which is precisely the window the
    /// descriptor walk exists to close, and precisely the defect the Phase
    /// 2c-5-1 review found. This one is written so that it **cannot** pass over
    /// such an implementation.
    ///
    /// It is deterministic rather than a race, and that is the point: it does
    /// the swap the racing writer would do, and then asks the *already
    /// resolved* directory for a child. A pathname-based walk answers the
    /// swapped-in tree — measured, not supposed: forcing that implementation on
    /// this machine makes this test read the decoy's bytes and report success.
    /// A descriptor-anchored one answers the object it checked, because a
    /// descriptor names an inode and resolves no path. The leaf assertion
    /// beside it pins a narrower thing — that the read comes from the
    /// descriptor rather than from a second open of the name — and is not the
    /// one that discriminates.
    ///
    /// **It is macOS-only, and that is the honest scope of the guarantee.** Off
    /// macOS `libc` is not a dependency of this crate, `ResolvedDirectory` holds
    /// a pathname, and this exact sequence *would* follow the swapped component
    /// — so the assertion below is not true there and is not made there. That
    /// split is stated on `ResolvedDirectory`, in this module's header, and on
    /// every API that claims the property.
    #[cfg(target_os = "macos")]
    #[test]
    fn a_component_swapped_after_it_was_checked_is_not_followed() {
        let (directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        seed_entry(&batch, "match/base.yml", b"the batch's own bytes\n");

        // The tree a racing writer would substitute, holding a file of the same
        // name so that a followed swap is a *silent* wrong answer rather than a
        // failure.
        let decoy = directory.path().join("decoy");
        fs::create_dir(&decoy).expect("the decoy tree");
        fs::write(decoy.join("base.yml"), b"bytes from outside the batch\n").expect("write");

        // Resolve exactly what the walk resolves: the batch, then `match`
        // inside it, then the leaf inside that.
        let resolved_batch = ResolvedDirectory::open_root(&batch).expect("the batch resolves");
        let resolved_inner = resolved_batch
            .child_directory(OsStr::new("match"))
            .expect("`match` resolves inside it");
        let (mut leaf, length) = resolved_inner
            .child_regular_file(OsStr::new("base.yml"))
            .expect("the leaf opens inside that");
        assert_eq!(length, b"the batch's own bytes\n".len() as u64);

        // The swap a racing writer would perform: the checked component's
        // *name* is given to a symbolic link pointing at the decoy, while the
        // directory that was checked is still there under another name.
        fs::rename(batch.join("match"), batch.join("match-moved")).expect("the real one moves");
        std::os::unix::fs::symlink(&decoy, batch.join("match")).expect("the swap");

        // The read comes from the descriptor the leaf check was made on, never
        // from a second open of the name.
        let mut bytes = Vec::new();
        leaf.read_to_end(&mut bytes).expect("the descriptor reads");
        assert_eq!(
            bytes, b"the batch's own bytes\n",
            "a read must come from the descriptor the leaf check was made on"
        );

        // **This is the assertion the defect fails.** A pathname walk would
        // resolve `<batch>/match/base.yml` again, follow the link that now holds
        // that name, and hand back the decoy's bytes while reporting success —
        // a silent wrong answer rather than an error. A descriptor names an
        // inode, so the child is resolved inside the directory that was checked.
        let (mut again, _) = resolved_inner
            .child_regular_file(OsStr::new("base.yml"))
            .expect("the leaf is still reachable inside the directory that was opened");
        let mut more = Vec::new();
        again.read_to_end(&mut more).expect("the descriptor reads");
        assert_eq!(
            more, b"the batch's own bytes\n",
            "a child must be resolved against the parent that was opened"
        );

        // The catalogue itself, which re-resolves from the root on every call,
        // now sees the swapped-in symlink and refuses it rather than reading
        // through it.
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        let forged = BackupEntryId::in_batch(id, Path::new("match/base.yml")).expect("valid");
        assert!(
            matches!(
                catalog.read_entry(&forged),
                Err(BackupReadError::StaleEntry { .. })
            ),
            "a fresh call meets the link at its check and stops there"
        );
        assert_eq!(
            fs::read(decoy.join("base.yml")).expect("readable"),
            b"bytes from outside the batch\n",
            "and nothing outside the batch was written"
        );
    } // End of function a_component_swapped_after_it_was_checked_is_not_followed()

    /// **One resolved directory answers the same names however often it is
    /// asked.**
    ///
    /// Not a truism: on macOS a listing duplicates the directory descriptor and
    /// hands the duplicate to `fdopendir(3)`, and a duplicate **shares the
    /// original's file offset**. Without the rewind that follows, the second
    /// listing of one directory would start where the first stopped and answer
    /// nothing — a silently short scan rather than a failure. Today's walk asks
    /// each directory once, which is exactly why this needs pinning rather than
    /// noticing later.
    #[test]
    fn one_resolved_directory_lists_the_same_names_however_often_it_is_asked() {
        let (_directory, root, _catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        seed_entry(&batch, "base.yml", b"one\n");
        seed_entry(&batch, "other.yml", b"two\n");

        let resolved = ResolvedDirectory::open_root(&batch).expect("the batch resolves");
        let mut first = resolved.names().expect("a first listing");
        let mut second = resolved.names().expect("a second listing");
        first.sort();
        second.sort();
        assert_eq!(first, second, "a second listing must not come back short");
        assert_eq!(
            first,
            vec![
                OsString::from(BATCH_MARKER_NAME),
                OsString::from("base.yml"),
                OsString::from("other.yml"),
                OsString::from("payload"),
            ],
            "and `.` and `..` are never among them"
        );
    } // End of function one_resolved_directory_lists_the_same_names_however_often_it_is_asked()

    /// **The configuration root maps forwards onto a sentinel that does not
    /// reverse, and the read side refuses it rather than pretending it does.**
    ///
    /// `backup_relative_path(root, root)` cannot answer an empty path, so it
    /// answers `_outside_` — which reversed is the in-root file `_outside`, not
    /// the root. The forward case is unreachable from the write side, because
    /// the transaction copies regular files and a configuration root is a
    /// directory. This pins both halves, and that the escaped name still finds
    /// the copy of the file it genuinely belongs to.
    #[test]
    fn the_configuration_root_is_a_sentinel_the_mapping_does_not_reverse() {
        let spelled = Path::new("/tmp/espanso");
        assert_eq!(
            backup_relative_path(spelled, spelled),
            PathBuf::from("_outside_"),
            "never an empty path, and never in the external namespace"
        );
        assert_eq!(
            BackupTarget::of_backup_path(Path::new("_outside_")),
            BackupTarget::InConfigRoot {
                relative_path: WirePath::new("_outside")
            },
            "reversed it is a file named `_outside`, which is not the root"
        );

        // Byte-exact, because `Path` compares component-wise and would call
        // `_outside_/` equal to `_outside_` — while the strict entry grammar
        // refuses the first spelling and admits the second.
        assert_eq!(
            backup_relative_path(spelled, &spelled.join("_outside")).as_os_str(),
            OsStr::new("_outside_"),
            "the escape adds one underscore and never a trailing separator"
        );
        match BackupTarget::of_backup_path(Path::new("_outside_")) {
            BackupTarget::InConfigRoot { relative_path } => assert_eq!(
                relative_path.as_path().as_os_str(),
                OsStr::new("_outside"),
                "and the reverse direction does not add one either"
            ),
            other => panic!("expected an in-root classification, got {other:?}"),
        }

        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        seed_entry(&batch, "_outside_", b"an in-root file called _outside\n");

        assert_eq!(
            catalog
                .entry_for_target(&id, catalog.config_root())
                .expect("the batch is recognised"),
            None,
            "the root is refused rather than offered another file's copy"
        );
        assert_eq!(
            catalog
                .entry_for_target(&id, &catalog.config_root().join("_outside"))
                .expect("the batch is recognised")
                .map(|entry| entry.id().relative_path().to_path_buf()),
            Some(PathBuf::from("_outside_")),
            "and the file that name really belongs to still finds its own copy"
        );
    } // End of function the_configuration_root_is_a_sentinel_the_mapping_does_not_reverse()

    /// **A disambiguated sibling is classified literally, and is not the
    /// target's entry.**
    ///
    /// `base.yml-1` is what a copy is published as when `base.yml` was already
    /// taken. The mapping is not told that and cannot be — `base.yml-1` is also
    /// a perfectly ordinary file name — so it is listed as the in-root path it
    /// spells and is **not** what `base.yml` maps to. That is what
    /// [`BackupTarget`] means by a syntactic classification, and the reason no
    /// sentence on it may say what a copy is *of*.
    #[test]
    fn a_disambiguated_sibling_is_classified_literally_and_is_not_the_targets_entry() {
        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        seed_entry(&batch, "match/base.yml", b"the first copy\n");
        seed_entry(&batch, "match/base.yml-1", b"a second copy of something\n");

        let scan = catalog.scan_entries(&id).expect("the batch walks");
        let sibling = scan
            .entries
            .iter()
            .find(|entry| entry.id().relative_path() == Path::new("match/base.yml-1"))
            .expect("the sibling is listed");
        assert_eq!(
            sibling.target(),
            &BackupTarget::InConfigRoot {
                relative_path: WirePath::new("match/base.yml-1")
            },
            "the name it spells, not the name it may have been copied from"
        );

        let found = catalog
            .entry_for_target(&id, &catalog.config_root().join("match/base.yml"))
            .expect("the batch is recognised")
            .expect("the ordinary name is there");
        assert_eq!(
            found.id().relative_path(),
            Path::new("match/base.yml"),
            "the mapping seeks the undisambiguated name and nothing else"
        );
    } // End of function a_disambiguated_sibling_is_classified_literally_and_is_not_the_targets_entry()

    /// **The batch's ownership marker is not an entry**, and no identity can
    /// name it.
    ///
    /// It is this module's own bookkeeping; offering it would present a
    /// two-word file as a restorable document.
    #[test]
    fn the_batch_marker_is_excluded_from_the_entries_and_cannot_be_addressed() {
        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        assert!(batch.join(BATCH_MARKER_NAME).exists());
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");

        let scan = catalog.scan_entries(&id).expect("the batch walks");
        assert!(
            scan.entries
                .iter()
                .all(|entry| entry.id().relative_path() != Path::new(BATCH_MARKER_NAME)),
            "the marker is never offered"
        );
        assert_eq!(
            scan.skipped
                .iter()
                .filter(|reason| **reason == EntrySkipped::Marker)
                .count(),
            1
        );
        assert!(
            BackupEntryId::in_batch(id.clone(), Path::new(BATCH_MARKER_NAME)).is_none(),
            "and no identity can be built for it"
        );

        // Deeper down it is an ordinary name, because the marker lives at the
        // top of a batch and nowhere else.
        seed_entry(&batch, &format!("match/{BATCH_MARKER_NAME}"), b"a file\n");
        let second = catalog.scan_entries(&id).expect("the batch walks again");
        assert!(second
            .entries
            .iter()
            .any(|entry| entry.id().relative_path()
                == Path::new(&format!("match/{BATCH_MARKER_NAME}"))));
    } // End of function the_batch_marker_is_excluded_from_the_entries_and_cannot_be_addressed()

    /// **The bytes come back exactly, and text that is not valid UTF-8 is
    /// refused at the offset of the first invalid byte.**
    ///
    /// Never a lossy decode, never a replacement character, never a normalised
    /// line ending — a file this refuses simply has no text, and its bytes are
    /// still there.
    #[test]
    fn an_entry_reads_back_byte_for_byte_and_invalid_utf8_is_refused_at_its_offset() {
        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        let awkward = b"\xef\xbb\xbfmatches:\r\n  - trigger: ':hi'\r\n".to_vec();
        seed_entry(&batch, "match/base.yml", &awkward);
        let invalid = b"matches: []\n\xff\xfe".to_vec();
        seed_entry(&batch, "match/broken.yml", &invalid);

        let good = BackupEntryId::in_batch(id.clone(), Path::new("match/base.yml")).expect("valid");
        let bytes = catalog.read_entry(&good).expect("the entry reads");
        assert_eq!(bytes.bytes(), awkward.as_slice(), "byte for byte");
        assert_eq!(bytes.revision(), ContentRevision::of_bytes(&awkward));
        let text = bytes.clone().utf8().expect("valid UTF-8");
        assert_eq!(
            text.text().as_bytes(),
            awkward.as_slice(),
            "the byte-order mark and both carriage returns survive"
        );
        assert_eq!(
            text.revision(),
            bytes.revision(),
            "the string holds the very bytes the revision was computed over"
        );

        let bad = BackupEntryId::in_batch(id, Path::new("match/broken.yml")).expect("valid");
        let read = catalog.read_entry(&bad).expect("the bytes read");
        assert_eq!(
            read.bytes(),
            invalid.as_slice(),
            "the bytes are still there"
        );
        match read.utf8() {
            Err(BackupReadError::NotUtf8 { entry, offset }) => {
                assert_eq!(offset, 12, "the first invalid byte, not the whole file");
                assert_eq!(entry.relative_path(), Path::new("match/broken.yml"));
            }
            other => panic!("expected a typed refusal, got {other:?}"),
        }
    } // End of function an_entry_reads_back_byte_for_byte_and_invalid_utf8_is_refused_at_its_offset()

    /// **A batch or an entry that disappeared between two calls is a typed
    /// stale answer, never an empty listing and never an empty file.**
    #[test]
    fn a_batch_or_an_entry_that_disappears_between_calls_is_stale() {
        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        seed_entry(&batch, "match/base.yml", b"matches: []\n");

        let scan = catalog.scan_batches().expect("the root reads");
        let id = scan.batches[0].id().clone();
        let entries = catalog.scan_entries(&id).expect("the batch walks");
        let entry = entries
            .entries
            .iter()
            .find(|candidate| candidate.id().relative_path() == Path::new("match/base.yml"))
            .expect("the seeded entry")
            .id()
            .clone();

        // The entry goes first: the batch is still there, and the identity is
        // refused rather than answered with nothing.
        fs::remove_file(batch.join("match/base.yml")).expect("the entry is removed");
        assert!(matches!(
            catalog.read_entry(&entry),
            Err(BackupReadError::StaleEntry { .. })
        ));
        assert_eq!(
            catalog
                .entry_for_target(&id, &catalog.config_root().join("match/base.yml"))
                .expect("a batch that is still there"),
            None,
            "and the mapping answers no rather than an empty file"
        );

        // Then the batch's marker goes, which is what a directory that stopped
        // being recognised looks like.
        fs::remove_file(batch.join(BATCH_MARKER_NAME)).expect("the marker is removed");
        assert!(matches!(
            catalog.scan_entries(&id),
            Err(BackupReadError::StaleBatch { .. })
        ));

        // Then the directory itself.
        fs::remove_dir_all(&batch).expect("the batch is removed");
        assert!(matches!(
            catalog.scan_entries(&id),
            Err(BackupReadError::StaleBatch { .. })
        ));
        assert!(matches!(
            catalog.entry_for_target(&id, Path::new("/nowhere/base.yml")),
            Err(BackupReadError::StaleBatch { .. })
        ));
        assert!(matches!(
            catalog.read_entry(&entry),
            Err(BackupReadError::StaleBatch { .. })
        ));
        assert!(
            catalog
                .scan_batches()
                .expect("the root still reads")
                .batches
                .is_empty(),
            "a scan taken now says there are none, which is a different question"
        );
    } // End of function a_batch_or_an_entry_that_disappears_between_calls_is_stale()

    /// **The target mapping runs both ways, and the two namespaces stay
    /// disjoint.**
    ///
    /// Forwards, [`BackupCatalog::entry_for_target`] finds the copy a file's own
    /// path maps to; backwards, an entry says what its path maps back to. The
    /// escape that keeps an in-root `_outside/…` apart from an external path has
    /// to survive both directions or one file's backup would be another's.
    #[test]
    fn the_target_mapping_runs_forwards_and_backwards() {
        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        seed_entry(&batch, "match/base.yml", b"in root\n");
        seed_entry(&batch, "_outside/somewhere/base.yml", b"external\n");
        seed_entry(&batch, "_outside_/foo/base.yml", b"an in-root _outside\n");

        // Backwards: every entry says what its own path maps back to.
        let scan = catalog.scan_entries(&id).expect("the batch walks");
        let classify = |relative: &str| {
            scan.entries
                .iter()
                .find(|entry| entry.id().relative_path() == Path::new(relative))
                .unwrap_or_else(|| panic!("{relative} must be listed"))
                .target()
                .clone()
        };
        assert_eq!(
            classify("match/base.yml"),
            BackupTarget::InConfigRoot {
                relative_path: WirePath::new("match/base.yml")
            }
        );
        assert_eq!(
            classify("_outside/somewhere/base.yml"),
            BackupTarget::OutsideConfigRoot,
            "the external namespace is not a path in the configuration root"
        );
        assert_eq!(
            classify("_outside_/foo/base.yml"),
            BackupTarget::InConfigRoot {
                relative_path: WirePath::new("_outside/foo/base.yml")
            },
            "one `_` fewer takes an escaped in-root path back to itself"
        );

        // Forwards: a live file's own path finds the copy, including the
        // canonicalisation the write side applies to both ends.
        let live = catalog.config_root().join("match/base.yml");
        fs::create_dir_all(live.parent().expect("a parent")).expect("the live directory");
        fs::write(&live, b"whatever is there now\n").expect("the live file");
        let found = catalog
            .entry_for_target(&id, &live)
            .expect("the batch is recognised")
            .expect("the copy is at the name the mapping produces");
        assert_eq!(found.id().relative_path(), Path::new("match/base.yml"));
        assert_eq!(found.length(), b"in root\n".len() as u64);
        assert_eq!(found.display_path(), &WirePath::new("match/base.yml"));

        // An external target maps into the escaped namespace and finds its own
        // copy there.
        let external = catalog
            .entry_for_target(&id, Path::new("/somewhere/base.yml"))
            .expect("the batch is recognised");
        assert_eq!(
            external.map(|entry| entry.id().relative_path().to_path_buf()),
            Some(PathBuf::from("_outside/somewhere/base.yml"))
        );

        // A file this batch does not hold is `None`, which is the ordinary
        // answer and is not an error.
        assert!(catalog
            .entry_for_target(&id, &catalog.config_root().join("match/absent.yml"))
            .expect("the batch is recognised")
            .is_none());

        // And the round trip is exact for every in-root path, including the
        // ones the escape touches.
        for relative in [
            "match/base.yml",
            "config/default.yml",
            "_outside/x.yml",
            "_outside_/x.yml",
            "_outsiders/x.yml",
            "match/_outside/x.yml",
        ] {
            let target = catalog.config_root().join(relative);
            let mapped = backup_relative_path(catalog.config_root(), &target);
            assert_eq!(
                BackupTarget::of_backup_path(&mapped),
                BackupTarget::InConfigRoot {
                    relative_path: WirePath::new(relative)
                },
                "{relative} must survive the round trip"
            );
        } // End of the loop over the in-root paths the mapping must round-trip
    } // End of function the_target_mapping_runs_forwards_and_backwards()

    /// **Enumeration and reading create nothing, remove nothing and rotate
    /// nothing**, even over a root holding more batches than retention keeps.
    ///
    /// Rotation is the one destructive operation in this crate and is
    /// deliberately coupled to a successfully written capture. A root of fifteen
    /// batches is five past the retention window, so a read side that rotated —
    /// or that merely *looked* like the write side by creating the root, a
    /// batch or a marker — would show up as a changed tree here.
    #[test]
    fn enumerating_and_reading_never_create_remove_or_rotate_anything() {
        let (_directory, root, catalog) = seeded_catalog();
        // Five past the retention window, so a read side that rotated would be
        // caught by the counts below rather than by luck.
        const SEEDED: usize = BATCHES_RETAINED + 5;
        for minute in 0..SEEDED {
            let batch = seed_batch(&root, &format!("2026-07-29T14{minute:02}00Z"));
            seed_entry(
                &batch,
                "match/base.yml",
                format!("batch {minute}\n").as_bytes(),
            );
            seed_entry(&batch, "config/default.yml", b"config: {}\n");
        } // End of the loop that seeds five batches past the retention window

        let before = tree_snapshot(&root);
        let scan = catalog.scan_batches().expect("the root reads");
        assert_eq!(
            scan.batches.len(),
            SEEDED,
            "every batch is listed, none removed"
        );
        let mut read = 0usize;
        for batch in &scan.batches {
            let entries = catalog.scan_entries(batch.id()).expect("the batch walks");
            for entry in &entries.entries {
                let bytes = catalog.read_entry(entry.id()).expect("the entry reads");
                assert_eq!(bytes.revision(), ContentRevision::of_bytes(bytes.bytes()));
                read += 1;
            } // End of the loop over one batch's entries
            catalog
                .entry_for_target(batch.id(), &catalog.config_root().join("match/base.yml"))
                .expect("the mapping runs")
                .expect("every batch holds that copy");
        } // End of the loop over every seeded batch

        assert_eq!(
            read,
            SEEDED * 3,
            "three entries in each batch — the helper's payload and the two seeded"
        );
        assert_eq!(
            tree_snapshot(&root),
            before,
            "reading the whole tree changed no path, no type and no byte"
        );
        assert_eq!(
            fs::read_dir(&root).expect("readable").count(),
            SEEDED,
            "and nothing rotated: retention belongs to a written capture"
        );
    } // End of function enumerating_and_reading_never_create_remove_or_rotate_anything()

    /// A batch identity is a **name this module's grammar admits**, so nothing
    /// it carries can address a directory outside the backup root.
    #[test]
    fn a_batch_identity_can_only_ever_be_one_plain_component() {
        for name in [
            "",
            "..",
            "../2026-07-29T143012Z",
            "2026-07-29T143012Z/..",
            "backups",
            ".DS_Store",
            "2026-07-29T143012Z.old",
            "2026-07-29T143012Z-x",
        ] {
            assert!(
                BackupBatchId::parse(name).is_none(),
                "{name} must not become an identity"
            );
        } // End of the loop over the names no identity may be built from

        let id = BackupBatchId::parse("2026-07-29T143012Z-7").expect("a well-formed name");
        assert_eq!(id.display_name(), "2026-07-29T143012Z-7");
        assert_eq!(Path::new(id.display_name()).components().count(), 1);
    } // End of function a_batch_identity_can_only_ever_be_one_plain_component()

    /// An entry identity is a **relative path of plain names as they are
    /// spelled**, so joining one onto a batch introduces no lexical escape.
    ///
    /// The interesting half is what is **refused rather than normalised**.
    /// [`Path::components`] drops an interior `.` and collapses repeated
    /// separators before any loop over it can see them, so a validator written
    /// on top of it would silently accept `match/./base.yml` and answer
    /// `match/base.yml` — an identity whose spelling is not the spelling it was
    /// asked about. The grammar refuses; this pins that it does.
    #[test]
    fn an_entry_identity_can_only_ever_be_plain_components() {
        let batch = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        for relative in [
            "",
            ".",
            "..",
            "../escape.yml",
            "match/../../escape.yml",
            "/etc/passwd",
            // Normalisable spellings, every one of them refused rather than
            // rewritten into the path it would have collapsed to.
            "match/./base.yml",
            "./match/base.yml",
            "match/base.yml/.",
            "match//base.yml",
            "match///base.yml",
            "match/base.yml/",
            "/match/base.yml",
        ] {
            assert!(
                BackupEntryId::in_batch(batch.clone(), Path::new(relative)).is_none(),
                "{relative} must not become an identity"
            );
        } // End of the loop over the paths no identity may be built from

        let id = BackupEntryId::in_batch(batch, Path::new("match/base.yml"))
            .expect("the spelling with nothing to normalise is the one that is admitted");
        assert_eq!(id.relative_path(), Path::new("match/base.yml"));
        assert!(id
            .relative_path()
            .components()
            .all(|component| matches!(component, Component::Normal(_))));
    } // End of function an_entry_identity_can_only_ever_be_plain_components()

    /// An entry's observed length crosses as **exact decimal digits**, above
    /// JavaScript's safe-integer range as well as below it.
    ///
    /// A batch is untrusted input, so a sparse regular file longer than
    /// [`crate::MAX_EXACT_WIRE_INTEGER`] is reachable, and not every `u64` is
    /// exactly representable as a JSON number. This pins the representation
    /// rather than the fixture: the fixture holds small files, so nothing that
    /// reads a real tree can fail when the field goes back to being a number.
    #[test]
    fn an_entry_length_crosses_as_exact_digits() {
        let batch = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        let id = BackupEntryId::in_batch(batch, Path::new("match/base.yml")).expect("valid");

        // One below, one above and one at the exact-integer boundary.
        for length in [
            0,
            crate::MAX_EXACT_WIRE_INTEGER,
            crate::MAX_EXACT_WIRE_INTEGER + 1,
            u64::MAX,
        ] {
            let json = serde_json::to_value(entry_of(id.clone(), length))
                .expect("an entry must serialize");
            assert_eq!(
                json["length"],
                serde_json::Value::String(length.to_string()),
                "the length must cross as its own digits, never as a number"
            );
        } // End of the loop over the lengths that must survive the wire

        // The first integer above `2^53` demonstrates the loss a JSON number can
        // introduce.
        let rounded = crate::MAX_EXACT_WIRE_INTEGER + 2;
        assert_eq!(
            serde_json::to_value(entry_of(id, rounded)).expect("an entry must serialize")["length"],
            serde_json::Value::String("9007199254740993".to_owned())
        );
    } // End of function an_entry_length_crosses_as_exact_digits()

    /// Something inside a batch that is neither a directory nor a regular file
    /// is reported rather than offered.
    #[test]
    fn a_batch_entry_that_is_not_a_regular_file_is_reported() {
        let (_directory, root, catalog) = seeded_catalog();
        let batch = seed_batch(&root, "2026-07-29T143012Z");
        let id = BackupBatchId::parse("2026-07-29T143012Z").expect("a well-formed name");
        fs::create_dir(batch.join("empty-directory")).expect("a directory with nothing in it");

        let scan = catalog.scan_entries(&id).expect("the batch walks");
        assert!(
            scan.entries
                .iter()
                .all(|entry| entry.id().relative_path() != Path::new("empty-directory")),
            "a directory is walked, never offered"
        );
        assert!(scan.complete());

        // And a forged identity naming a directory is stale rather than an
        // empty read.
        let forged = BackupEntryId::in_batch(id, Path::new("empty-directory")).expect("valid");
        assert!(matches!(
            catalog.read_entry(&forged),
            Err(BackupReadError::StaleEntry { .. })
        ));
    } // End of function a_batch_entry_that_is_not_a_regular_file_is_reported()

    /// Every enum this side introduces spells its variants as **distinct
    /// lowerCamel codes** — the operands Phase 2c-5-2 maps to dictionary
    /// entries, in the style [`BackupStep`] and [`RotationOutcome`] already use.
    ///
    /// Distinctness is checked **within** each enum, because a code lives in its
    /// own namespace on the wire: `unreadable` means one thing under
    /// [`BatchSkipped`] and another under [`EntrySkipped`], and requiring the
    /// two to differ would be a rule about the dictionary that the dictionary
    /// does not have.
    #[test]
    fn every_code_this_side_introduces_is_a_distinct_lower_camel_identifier() {
        let namespaces: [(&str, Vec<&'static str>); 5] = [
            (
                "BackupRootState",
                vec![
                    BackupRootState::Missing.code(),
                    BackupRootState::Present.code(),
                ],
            ),
            (
                "BatchSkipped",
                vec![
                    BatchSkipped::ForeignName.code(),
                    BatchSkipped::NotADirectory.code(),
                    BatchSkipped::NoMarker.code(),
                    BatchSkipped::Unreadable.code(),
                ],
            ),
            (
                "EntrySkipped",
                vec![
                    EntrySkipped::Marker.code(),
                    EntrySkipped::Symlink.code(),
                    EntrySkipped::NotARegularFile.code(),
                    EntrySkipped::UnusableName.code(),
                    EntrySkipped::Unreadable.code(),
                ],
            ),
            (
                "BackupReadStep",
                vec![
                    BackupReadStep::InspectBackupRoot.code(),
                    BackupReadStep::ListBackupRoot.code(),
                    BackupReadStep::InspectBatch.code(),
                    BackupReadStep::ListBatch.code(),
                    BackupReadStep::InspectEntry.code(),
                    BackupReadStep::ReadEntry.code(),
                ],
            ),
            (
                "BackupTarget",
                vec![
                    BackupTarget::InConfigRoot {
                        relative_path: WirePath::new("match/base.yml"),
                    }
                    .code(),
                    BackupTarget::OutsideConfigRoot.code(),
                ],
            ),
        ];
        for (namespace, codes) in namespaces {
            let unique: HashSet<&&str> = codes.iter().collect();
            assert_eq!(
                unique.len(),
                codes.len(),
                "{namespace} spells two variants the same way"
            );
            for code in codes {
                assert!(
                    code.starts_with(|first: char| first.is_ascii_lowercase())
                        && code
                            .chars()
                            .all(|character| character.is_ascii_alphanumeric()),
                    "{namespace}'s {code} must be a lowerCamel identifier"
                );
            } // End of the loop over one namespace's codes
        } // End of the loop over the namespaces this side introduces
    } // End of function every_code_this_side_introduces_is_a_distinct_lower_camel_identifier()
}
