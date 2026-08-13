//! The read-only backup catalogue, as it crosses the IPC boundary.
//!
//! Phase 2c-5-1 built [`BackupCatalog`] in the core with no caller; this module
//! is its only one. Three operations sit here —
//! [`list_batches`], [`list_entries`] and [`read_text`] — and the three
//! `#[tauri::command]` wrappers in `crate::commands` are one line each over
//! them.
//!
//! # Nothing here writes, and two regression tripwires guard the known routes
//!
//! Every function below takes a `&Workspace` — never `&mut`, never a
//! [`espansoconfig_core::persist::BackupSession`] — and reaches the disk only
//! through [`BackupCatalog`], which creates nothing, removes nothing and
//! rotates nothing.
//!
//! Two tests stand behind that, and **what they establish is narrower than the
//! paragraph above**: `crate::wire_contract::the_known_backup_routes_name_no_writer`
//! rejects a **fixed** writer vocabulary in this module and in the six command
//! bodies that reach it, and `crate::backup::tests::no_backup_operation_changes_a_byte_of_the_tree`
//! compares every byte of **one** exercised tree. A new writer with an unlisted
//! name, a side-effecting helper, a metadata-only mutation, or a route that
//! fixture does not exercise passes both. Neither test, nor their combination,
//! proves an arbitrary callee side-effect-free.
//!
//! # An identity is a pair of strings, and only an exact one is ever offered
//!
//! A [`BackupBatchId`] crosses as its directory name and a [`BackupEntryId`] as
//! that name plus a relative path. Both identities are **opaque by contract**:
//! callers should compare them and hand them back, while every command validates
//! their exposed string fields and re-resolves them beneath the workspace-owned
//! backup root. Safety comes from that validation and re-resolution, **not** from
//! any claim that a pathname cannot be composed — both identities serialize their
//! component names, the workspace exposes its root, and a structurally typed
//! caller can concatenate arbitrary strings.
//!
//! The relative path is where the wire is narrower than the catalogue, and the
//! narrowing is deliberate. A batch may hold an entry whose name is not valid
//! UTF-8 — the core admits it, because the identity holds a real
//! [`std::path::PathBuf`] — but a JSON string cannot carry those bytes, and
//! [`BackupEntryId`]'s serializer renders lossily rather than failing (which is
//! [`espansoconfig_core::wire`]'s rule, and the alternative is `serde`'s own
//! English prose reaching a webview). A lossily rendered identity is not the
//! identity: handing it back would fail revalidation as
//! [`BackupReadError::StaleEntry`] — safe, and a sentence about the disk that is
//! not true, because nothing on the disk changed.
//!
//! So [`list_entries`] offers an entry **only when its identity survives that
//! rendering byte for byte** ([`is_exactly_spellable`]), and counts the rest as
//! [`BackupEntryListing::unaddressable`]. Every identity on this wire therefore
//! round-trips exactly, a caller is told when a batch holds something this
//! boundary cannot name, and no entry is silently missing.
//!
//! # Every string that comes back is re-validated, and the refusals are typed
//!
//! [`resolve_batch`] and [`resolve_entry`] rebuild the core identities from the
//! strings a caller sent, through
//! [`espansoconfig_core::persist::BackupBatchId::parse`] and
//! [`espansoconfig_core::persist::BackupEntryId::in_batch`] and through nothing
//! else. A forged batch name is [`CommandError::UnrecognisedBackupBatch`] and a
//! forged path — absolute, empty, holding `.` or `..`, holding a repeated or
//! trailing separator, or naming the batch's own ownership marker — is
//! [`CommandError::UnaddressableBackupEntry`]. Both are raised **before any
//! directory is opened**, so neither says anything about the disk; the codes are
//! deliberately not [`BackupReadError::StaleBatch`] and
//! [`BackupReadError::StaleEntry`], which mean the opposite.
//!
//! The commands take these as typed structs of `String` rather than
//! deserializing straight into a core identity. That is
//! `crate::menu::set_menu_labels`'s lesson: a `Deserialize` that validates fails
//! *inside Tauri's command macro*, which answers with an English sentence and no
//! `code` at all — prose crossing the boundary, which plan section 9 forbids.
//!
//! # What none of it claims
//!
//! Recognition is not authentication. The ownership marker is deliberately
//! forgeable by anything able to write inside the backup root, so a batch this
//! module lists is a **recognised** batch and nothing stronger. An entry's
//! target classification is a statement about its **name** — where a copy of
//! that target would have been written — and never that a file exists there or
//! that this entry's bytes came from it. The batch name is a sortable directory
//! name derived from the process clock, not a measurement of when anything
//! happened.
//!
//! **The symbolic-link guarantee is per target, and every sentence in this
//! module that touches it is written that way.** The catalogue refuses a link at
//! any depth on every target, so a link *already there* when a walk or a read
//! runs is never followed. What differs is a component **swapped between the
//! check and the use**: on macOS the walk is descriptor-relative
//! (`openat`/`O_NOFOLLOW`, `fstat` on the descriptor, the read taken from that
//! same descriptor), so that substitution cannot be followed either; off macOS
//! the pathname implementation stays and it **can** be. That split is the core's
//! own, argued at length in
//! `crates/espansoconfig-core/src/persist/backup.rs`'s header, and no sentence
//! here — or in `src/lib/ipc/types.ts`, or in either dictionary — may state the
//! macOS answer as though it held everywhere.

use std::ffi::OsStr;
use std::path::Path;

use serde::{Deserialize, Serialize};

use espansoconfig_core::persist::{
    BackupBatch, BackupBatchId, BackupCatalog, BackupEntry, BackupEntryId, BackupReadError,
    BackupRootState, BatchSkipped, EntrySkipped,
};
use espansoconfig_core::wire::lossy;
use espansoconfig_core::workspace::Workspace;
use espansoconfig_core::{ContentRevision, DocumentId};

use crate::error::CommandError;

/// The wire form of a batch identity, on the way **in**.
///
/// The same shape [`BackupBatchId`] serializes as, so an identity a listing
/// produced is exactly what a caller hands back. It holds a `String` and nothing
/// else, so deserializing one cannot fail for a well-formed call and the
/// grammar's refusal is a typed [`CommandError`] rather than Tauri's own prose.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct BackupBatchKey {
    /// The batch directory's name, exactly as it was received.
    pub name: String,
}

/// The wire form of an entry identity, on the way **in**.
///
/// The same shape [`BackupEntryId`] serializes as, and validated the same way:
/// see this module's header for why the two halves are strings here and core
/// identities only after [`resolve_entry`].
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct BackupEntryKey {
    /// The batch the entry is inside.
    pub batch: BackupBatchKey,
    /// The entry's path relative to that batch directory.
    pub relative_path: String,
}

/// What one listing of the backup root found.
///
/// The eligible batches **and** what was skipped, never one without the other:
/// a caller holding only a list of batches could not tell an incomplete root
/// from a complete one, so *"there are no backups"* is a sentence
/// [`BackupBatchListing::complete`] licenses and an empty `batches` does not.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BackupBatchListing {
    /// Whether the backup root existed at all.
    ///
    /// [`BackupRootState::Missing`] is the ordinary state of a configuration
    /// this application has never saved from. It is an outcome, not a failure.
    pub root: BackupRootState,
    /// The recognised batches, **newest name first**.
    pub batches: Vec<BackupBatch>,
    /// One code per entry of the root that is not an eligible batch.
    pub skipped: Vec<BatchSkipped>,
    /// How many entries of the root were read and are not batches.
    pub unrecognised: usize,
    /// How many entries of the root nothing could be learned about.
    pub unreadable: usize,
    /// Whether every entry of the root was read.
    ///
    /// The core's own predicate, evaluated in Rust rather than re-derived here
    /// from `skipped`: which reasons mean *nothing was learned* is
    /// [`BatchSkipped::is_unreadable`]'s answer, and a second copy of it in
    /// TypeScript would be a second thing to keep in step.
    pub complete: bool,
}

/// What one walk of one batch found.
///
/// [`BackupBatchListing`]'s shape, plus the one operand that belongs to this
/// boundary rather than to the catalogue — see
/// [`BackupEntryListing::unaddressable`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BackupEntryListing {
    /// The batch that was walked, as the identity later calls are made with.
    pub batch: BackupBatchId,
    /// The entries it offers **and this boundary can name**, ordered by their
    /// relative path.
    ///
    /// The order is for a stable display and says nothing about anything else.
    pub entries: Vec<BackupEntry>,
    /// One code per thing inside the batch that is not an entry.
    pub skipped: Vec<EntrySkipped>,
    /// How many things inside the batch were read and are not entries.
    pub unrecognised: usize,
    /// How many things inside the batch nothing could be learned about.
    pub unreadable: usize,
    /// How many entries the batch offers that this boundary cannot name.
    ///
    /// **A property of the wire, not of the disk.** The catalogue offers an
    /// entry whose name is not valid UTF-8; a JSON string cannot carry those
    /// bytes. Such an entry is counted here rather than listed with an identity
    /// that would not come back — see this module's header. It is normally zero,
    /// and on a filesystem that enforces UTF-8 file names it cannot be anything
    /// else.
    pub unaddressable: usize,
    /// Whether every thing inside the batch was read **and** every entry it
    /// offers is listed here.
    ///
    /// Deliberately stronger than the catalogue's own `complete()`, which asks
    /// only the first half: both halves make `entries` short, and a caller that
    /// was told *complete* while an entry had been left out would say the batch
    /// holds only what it lists. The two reasons stay separable —
    /// [`BackupEntryListing::unreadable`] and
    /// [`BackupEntryListing::unaddressable`] are counted apart.
    pub complete: bool,
}

/// One backup entry's exact text, and the live file it maps to.
///
/// Answered only after the entry has been shown to be the one this batch holds
/// for that document — see [`read_text`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BackupTextResponse {
    /// The entry, as re-observed by the mapping that verified it.
    pub entry: BackupEntry,
    /// The document the entry maps to, by its session-local identity.
    ///
    /// The identity the caller sent, answered back so a caller holding two
    /// requests can tell them apart. It is **not** a display path: a path on
    /// this wire renders lossily, and two distinct filenames can render to one
    /// string (`crate::wire_contract`).
    pub document: DocumentId,
    /// The entry's exact text.
    ///
    /// Byte for byte what the file held: no line ending converted, no
    /// byte-order mark added or removed, no final newline supplied, no Unicode
    /// normalisation. A file that is not valid UTF-8 has no text at all and is
    /// [`BackupReadError::NotUtf8`] instead.
    ///
    /// **Untrusted input.** It came out of a directory anything able to write
    /// there could have put a file in, and holding it is no evidence that this
    /// application wrote it or that it is a copy of any particular file.
    pub text: String,
    /// The revision of exactly those bytes.
    ///
    /// [`ContentRevision::of_bytes`] over what was read, so a caller can prove
    /// that what it previews and what it later submits are the same bytes. It
    /// is **not** a base revision for the live document: the file this text
    /// would replace has a revision of its own, and confusing the two is what
    /// the phase's design consult calls its sharpest failure mode.
    pub revision: ContentRevision,
}

/// Lists the recognised backup batches of the open workspace, newest name
/// first.
///
/// A missing backup root answers a listing that says so; an existing root that
/// is not a real private directory is a typed refusal, on the same two checks
/// the write side requires before creating one. Everything else in the root — a
/// foreign name, a batch-shaped directory with no marker, a regular file, a
/// symbolic link named like a batch — is skipped, counted and never listed as a
/// batch.
///
/// # Errors
///
/// [`CommandError::BackupReadFailed`], carrying the catalogue's own refusal.
///
/// @param workspace - The open workspace, borrowed immutably.
pub fn list_batches(workspace: &Workspace) -> Result<BackupBatchListing, CommandError> {
    let catalog = BackupCatalog::rooted_at(workspace.root());
    let scan = catalog.scan_batches().map_err(refused)?;
    Ok(BackupBatchListing {
        root: scan.root,
        unrecognised: scan.unrecognised(),
        unreadable: scan.unreadable(),
        complete: scan.complete(),
        batches: scan.batches,
        skipped: scan.skipped,
    })
} // End of function list_batches()

/// Lists the entries one recognised batch offers.
///
/// The batch identity is re-resolved against the tree first, so a batch another
/// session's rotation removed between two calls is
/// [`BackupReadError::StaleBatch`] rather than a batch with no entries. A
/// symbolic link the walk **meets** is refused at any depth on every target, and
/// the batch's own ownership marker is never an entry; how much that is worth
/// against a component swapped after it was checked depends on the target, and
/// this module's header states both answers.
///
/// # Errors
///
/// [`CommandError::UnrecognisedBackupBatch`] for a name the grammar does not
/// admit, before anything is opened, and [`CommandError::BackupReadFailed`] for
/// the catalogue's own refusals.
///
/// @param workspace - The open workspace, borrowed immutably.
/// @param batch - The batch identity, exactly as a listing produced it.
pub fn list_entries(
    workspace: &Workspace,
    batch: &BackupBatchKey,
) -> Result<BackupEntryListing, CommandError> {
    let batch = resolve_batch(batch)?;
    let catalog = BackupCatalog::rooted_at(workspace.root());
    let mut scan = catalog.scan_entries(&batch).map_err(refused)?;
    let unrecognised = scan.unrecognised();
    let unreadable = scan.unreadable();
    let walked_completely = scan.complete();
    let offered = scan.entries.len();
    let entries: Vec<BackupEntry> = std::mem::take(&mut scan.entries)
        .into_iter()
        .filter(|entry| is_exactly_spellable(entry.id()))
        .collect();
    let unaddressable = offered - entries.len();
    Ok(BackupEntryListing {
        batch: scan.batch,
        unrecognised,
        unreadable,
        // Both halves, because both make the list short. See the field.
        complete: walked_completely && unaddressable == 0,
        skipped: scan.skipped,
        entries,
        unaddressable,
    })
} // End of function list_entries()

/// Reads one backup entry's text, after proving it is the entry this batch
/// holds for one live document.
///
/// **The binding this command exists for.** The document is re-resolved through
/// the workspace's own [`espansoconfig_core::model::DocumentContext`] — the
/// session's authoritative absolute path — and the batch is asked which entry
/// *that* path maps to. The identity the caller sent has to be that entry, or
/// nothing is read. A display path is never the authority: two distinct
/// filenames can render to one wire string.
///
/// The whole chain is then re-checked before a byte is read — root, batch
/// grammar, batch directory, marker, component containment, no symbolic link
/// **observed** at any component resolved, and a real regular file at the leaf —
/// so an identity that does not resolve now is [`BackupReadError::StaleEntry`] and
/// **never an empty file**. Whether a component substituted between that check
/// and the read can be followed depends on the target; this module's header
/// states both answers.
///
/// # Errors
///
/// [`CommandError::UnrecognisedBackupBatch`] and
/// [`CommandError::UnaddressableBackupEntry`] before anything is opened;
/// [`CommandError::UnknownDocument`] for a document this session does not hold;
/// [`CommandError::BackupEntryIsNotThisDocument`] when the entry is not the one
/// the mapping produces for that document; and
/// [`CommandError::BackupReadFailed`] for the catalogue's own refusals,
/// [`BackupReadError::NotUtf8`] among them.
///
/// @param workspace - The open workspace, borrowed immutably.
/// @param entry - The entry identity, exactly as a listing produced it.
/// @param document - The live file the entry must map to.
pub fn read_text(
    workspace: &Workspace,
    entry: &BackupEntryKey,
    document: DocumentId,
) -> Result<BackupTextResponse, CommandError> {
    let requested = resolve_entry(entry)?;
    let context = workspace.document_context(document)?;
    let catalog = BackupCatalog::rooted_at(workspace.root());
    let mapped = catalog
        .entry_for_target(requested.batch(), &context.path)
        .map_err(refused)?;
    // `None` covers three shapes and all three are the same refusal: this batch
    // holds nothing at the name that document maps to, what is there is not
    // something the catalogue offers, or the document is the configuration root
    // itself — which the mapping refuses rather than resolving onto its
    // `_outside_` sentinel.
    let Some(mapped) = mapped.filter(|found| found.id() == &requested) else {
        return Err(CommandError::BackupEntryIsNotThisDocument {
            document: document.get(),
        });
    };
    let text = catalog
        .read_entry(&requested)
        .map_err(refused)?
        .utf8()
        .map_err(refused)?;
    Ok(BackupTextResponse {
        entry: mapped,
        document,
        revision: text.revision(),
        text: text.into_text(),
    })
} // End of function read_text()

/// Reads a batch name back into the identity the catalogue answers questions
/// about.
///
/// # Errors
///
/// [`CommandError::UnrecognisedBackupBatch`] for a name the grammar does not
/// admit. **Not** [`BackupReadError::StaleBatch`]: nothing has been asked of the
/// disk at this point, so no sentence about the disk would be true.
///
/// @param batch - The batch identity as it arrived.
fn resolve_batch(batch: &BackupBatchKey) -> Result<BackupBatchId, CommandError> {
    BackupBatchId::parse(&batch.name).ok_or_else(|| CommandError::UnrecognisedBackupBatch {
        batch: batch.name.clone(),
    })
} // End of function resolve_batch()

/// Reads an entry identity back into the one the catalogue answers questions
/// about.
///
/// # Errors
///
/// [`CommandError::UnrecognisedBackupBatch`] for the batch half, and
/// [`CommandError::UnaddressableBackupEntry`] for a relative path
/// [`BackupEntryId::in_batch`] refuses — which is every forged one, since that
/// constructor normalises nothing.
///
/// @param entry - The entry identity as it arrived.
fn resolve_entry(entry: &BackupEntryKey) -> Result<BackupEntryId, CommandError> {
    let batch = resolve_batch(&entry.batch)?;
    BackupEntryId::in_batch(batch, Path::new(&entry.relative_path)).ok_or_else(|| {
        CommandError::UnaddressableBackupEntry {
            batch: entry.batch.name.clone(),
            relative_path: entry.relative_path.clone(),
        }
    })
} // End of function resolve_entry()

/// Whether an entry identity survives this boundary's rendering byte for byte.
///
/// The **bytes** are compared, not the paths: [`Path`] equality is
/// component-wise, so two spellings a listing must tell apart can compare equal.
/// Phase 2c-5-1's own sweep found a defect that a component-wise comparison
/// would have missed, and this is that lesson applied on the way out.
///
/// The batch half needs no check: its name is a `String`, and every character
/// the grammar admits is an ASCII digit or one of `-`, `T`, `Z`.
///
/// @param entry - An identity the catalogue produced.
/// @returns Whether serializing and re-reading it yields the same identity.
fn is_exactly_spellable(entry: &BackupEntryId) -> bool {
    let relative = entry.relative_path();
    OsStr::new(&lossy(relative)) == relative.as_os_str()
} // End of function is_exactly_spellable()

/// Wraps the catalogue's own refusal in the code that carries it whole.
///
/// One function so the four call sites cannot come to disagree about which code
/// a read failure crosses as.
///
/// @param error - The catalogue's refusal.
fn refused(error: BackupReadError) -> CommandError {
    CommandError::BackupReadFailed { error }
} // End of function refused()

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use espansoconfig_core::persist::{
        BackupBatchId, BackupEntryId, BackupRootState, BATCH_MARKER_FORMAT, BATCH_MARKER_NAME,
    };
    use serde_json::Value;
    use tempfile::TempDir;

    use super::{
        is_exactly_spellable, list_batches, list_entries, read_text, resolve_batch, resolve_entry,
        BackupBatchKey, BackupEntryKey,
    };
    use crate::error::CommandError;
    use espansoconfig_core::workspace::Workspace;
    use espansoconfig_core::DocumentId;

    /// A synthetic match file. Hand-authored and neutral (CLAUDE.md section 1).
    const BASE_YML: &str = "matches:\n  - trigger: ':one'\n    replace: first\n";

    /// A batch name this grammar admits, used wherever the name itself is not
    /// what a case is about.
    const A_BATCH: &str = "2026-01-02T030405Z-0";

    /// Builds a workspace tree with one match file, and no backups at all.
    fn workspace_tree() -> (TempDir, Workspace) {
        let dir = TempDir::new().expect("temp dir");
        let root = dir.path();
        fs::create_dir_all(root.join("match")).expect("match dir");
        fs::write(root.join("match").join("base.yml"), BASE_YML).expect("base.yml");
        let workspace = Workspace::open(root).expect("the tree opens");
        (dir, workspace)
    } // End of function workspace_tree()

    /// Writes one recognised batch holding `entries`, and answers its name.
    ///
    /// Hand-built rather than taken from a save, because this module is the read
    /// side and a test that had to write a file first would be testing the
    /// writer.
    fn recognised_batch(root: &Path, name: &str, entries: &[(&str, &[u8])]) -> String {
        let batch = root.join(".espansoconfig-backups").join(name);
        fs::create_dir_all(&batch).expect("the batch directory");
        fs::write(
            batch.join(BATCH_MARKER_NAME),
            format!("{BATCH_MARKER_FORMAT}\n"),
        )
        .expect("the marker");
        for (relative, bytes) in entries {
            let path = batch.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("the entry's parents");
            }
            fs::write(&path, bytes).expect("the entry");
        } // End of the loop over the entries this batch is given
        make_private(&root.join(".espansoconfig-backups"));
        name.to_owned()
    } // End of function recognised_batch()

    /// Gives a directory the `0o700` the catalogue requires of a backup root.
    fn make_private(path: &Path) {
        use std::os::unix::fs::PermissionsExt as _;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700)).expect("the mode");
    }

    /// The identity a listing produced, as a caller would hand it back.
    fn key_of(entry: &BackupEntryId) -> BackupEntryKey {
        let json = serde_json::to_value(entry).expect("an identity must serialize");
        serde_json::from_value(json).expect("the wire form is what a caller sends back")
    }

    /// Every path and every byte of a tree, for the read-only oracle.
    ///
    /// Paths **and** contents, sorted, because a read that created an empty file
    /// or rotated a directory away would leave the byte totals of everything
    /// else untouched.
    fn tree_snapshot(root: &Path) -> Vec<(PathBuf, Vec<u8>)> {
        let mut found: Vec<(PathBuf, Vec<u8>)> = Vec::new();
        let mut pending = vec![root.to_path_buf()];
        while let Some(directory) = pending.pop() {
            let entries = fs::read_dir(&directory).expect("a readable directory");
            for entry in entries {
                let path = entry.expect("a readable entry").path();
                let kind = fs::symlink_metadata(&path).expect("the entry's own metadata");
                if kind.is_dir() {
                    found.push((path.clone(), Vec::new()));
                    pending.push(path);
                } else {
                    let bytes = fs::read(&path).unwrap_or_default();
                    found.push((path, bytes));
                }
            } // End of the loop over one directory's entries
        } // End of the walk over the tree
        found.sort();
        found
    } // End of function tree_snapshot()

    /// A missing backup root is an outcome and not a failure.
    #[test]
    fn a_missing_backup_root_lists_as_missing() {
        let (_dir, workspace) = workspace_tree();
        let listing = list_batches(&workspace).expect("a missing root is not a failure");
        assert_eq!(listing.root, BackupRootState::Missing);
        assert!(listing.batches.is_empty());
        assert!(
            listing.complete,
            "a root that is not there was read completely"
        );
    } // End of function a_missing_backup_root_lists_as_missing()

    /// A backup root that is not private is a typed refusal, never a panic.
    #[test]
    fn a_root_that_is_not_private_is_a_typed_refusal() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", BASE_YML.as_bytes())],
        );
        use std::os::unix::fs::PermissionsExt as _;
        fs::set_permissions(
            dir.path().join(".espansoconfig-backups"),
            fs::Permissions::from_mode(0o755),
        )
        .expect("the mode");
        let error = list_batches(&workspace).expect_err("a shared root is refused");
        assert_eq!(error.code(), "backupReadFailed");
    } // End of function a_root_that_is_not_private_is_a_typed_refusal()

    /// A forged batch name is refused before any directory is opened.
    #[test]
    fn a_forged_batch_name_is_unrecognised_and_not_stale() {
        for name in ["", "../..", "2026-01-02T030405Z-", "not-a-batch", "/etc"] {
            let error = resolve_batch(&BackupBatchKey {
                name: name.to_owned(),
            })
            .expect_err("the grammar admits none of these");
            assert_eq!(
                error.code(),
                "unrecognisedBackupBatch",
                "{name} must not be reported as a batch that has gone"
            );
        } // End of the loop over the forged batch names
    } // End of function a_forged_batch_name_is_unrecognised_and_not_stale()

    /// A forged relative path is refused, and nothing is normalised away.
    #[test]
    fn a_forged_entry_path_is_unaddressable() {
        for relative in [
            "",
            "..",
            "../../etc/passwd",
            "/etc/passwd",
            "match/./base.yml",
            "match//base.yml",
            "match/base.yml/",
            BATCH_MARKER_NAME,
        ] {
            let error = resolve_entry(&BackupEntryKey {
                batch: BackupBatchKey {
                    name: A_BATCH.to_owned(),
                },
                relative_path: relative.to_owned(),
            })
            .expect_err("this catalogue addresses none of these");
            assert_eq!(
                error.code(),
                "unaddressableBackupEntry",
                "{relative} must be refused rather than normalised"
            );
        } // End of the loop over the forged relative paths
    } // End of function a_forged_entry_path_is_unaddressable()

    /// An identity a listing produced is exactly what comes back.
    #[test]
    fn an_entry_identity_round_trips_through_its_wire_form() {
        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let original = BackupEntryId::in_batch(batch, Path::new("match/base.yml"))
            .expect("a path this catalogue addresses");
        let recovered = resolve_entry(&key_of(&original)).expect("the wire form resolves");
        assert_eq!(recovered, original);

        let json = serde_json::to_value(&original).expect("an identity must serialize");
        assert_eq!(json["batch"]["name"], Value::String(A_BATCH.to_owned()));
        assert_eq!(
            json["relative_path"],
            Value::String("match/base.yml".to_owned())
        );
    } // End of function an_entry_identity_round_trips_through_its_wire_form()

    /// An entry whose name is not valid UTF-8 is not offered, and is counted.
    ///
    /// Asserted about the **identity**, not about a file: APFS refuses a file
    /// name that is not valid UTF-8, so the case cannot be built on this
    /// filesystem at all. What is checked is the rule that decides it, and that
    /// the rule admits an ordinary name — a predicate that answered `false` to
    /// everything would empty every listing and pass the first half alone.
    #[test]
    fn an_entry_name_that_is_not_utf8_is_not_spellable_on_this_wire() {
        use std::os::unix::ffi::OsStrExt as _;

        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let ordinary = BackupEntryId::in_batch(batch.clone(), Path::new("match/base.yml"))
            .expect("a path this catalogue addresses");
        assert!(is_exactly_spellable(&ordinary));

        let raw = std::ffi::OsStr::from_bytes(b"match/ba\xffse.yml");
        let unspellable = BackupEntryId::in_batch(batch, Path::new(raw))
            .expect("the catalogue admits a name no encoding can spell");
        assert!(
            !is_exactly_spellable(&unspellable),
            "an identity that renders lossily must never be offered"
        );
    } // End of function an_entry_name_that_is_not_utf8_is_not_spellable_on_this_wire()

    /// A batch identity that no longer names a recognised batch is stale.
    #[test]
    fn a_batch_that_has_gone_is_a_stale_batch() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", BASE_YML.as_bytes())],
        );
        fs::remove_dir_all(dir.path().join(".espansoconfig-backups").join(A_BATCH))
            .expect("the batch is removed");
        let error = list_entries(
            &workspace,
            &BackupBatchKey {
                name: A_BATCH.to_owned(),
            },
        )
        .expect_err("a batch that has gone is not an empty listing");
        assert_eq!(error.code(), "backupReadFailed");
        let json = serde_json::to_value(&error).expect("a command error must serialize");
        assert!(
            json["error"]["StaleBatch"].is_object(),
            "the refusal must name the identity that does not resolve now: {json}"
        );
    } // End of function a_batch_that_has_gone_is_a_stale_batch()

    /// An entry that cannot be read is a typed refusal, never an empty text.
    #[test]
    fn an_unreadable_entry_is_a_typed_refusal() {
        use std::os::unix::fs::PermissionsExt as _;

        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", BASE_YML.as_bytes())],
        );
        let copy = dir
            .path()
            .join(".espansoconfig-backups")
            .join(A_BATCH)
            .join("match")
            .join("base.yml");
        fs::set_permissions(&copy, fs::Permissions::from_mode(0o000)).expect("the mode");

        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let entry = BackupEntryId::in_batch(batch, Path::new("match/base.yml"))
            .expect("a path this catalogue addresses");
        let error = read_text(&workspace, &key_of(&entry), a_document(&workspace))
            .expect_err("an unreadable entry has no text");
        assert_eq!(error.code(), "backupReadFailed");

        // Restore the mode so the temporary directory can be removed.
        fs::set_permissions(&copy, fs::Permissions::from_mode(0o600)).expect("the mode");
    } // End of function an_unreadable_entry_is_a_typed_refusal()

    /// Bytes that are not valid UTF-8 have no text, and the offset says where.
    #[test]
    fn an_entry_that_is_not_utf8_is_refused_with_its_offset() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", b"matches:\n# \xff\n")],
        );
        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let entry = BackupEntryId::in_batch(batch, Path::new("match/base.yml"))
            .expect("a path this catalogue addresses");
        let error = read_text(&workspace, &key_of(&entry), a_document(&workspace))
            .expect_err("bytes that are not valid UTF-8 have no text");
        assert_eq!(error.code(), "backupReadFailed");
        let json = serde_json::to_value(&error).expect("a command error must serialize");
        assert_eq!(
            json["error"]["NotUtf8"]["offset"], 11,
            "the offset of the first invalid byte: {json}"
        );
    } // End of function an_entry_that_is_not_utf8_is_refused_with_its_offset()

    /// An entry that maps to another file is refused for this document.
    #[test]
    fn an_entry_for_another_file_is_not_this_document() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[
                ("match/base.yml", BASE_YML.as_bytes()),
                ("match/other.yml", BASE_YML.as_bytes()),
            ],
        );
        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let other = BackupEntryId::in_batch(batch, Path::new("match/other.yml"))
            .expect("a path this catalogue addresses");
        let error = read_text(&workspace, &key_of(&other), a_document(&workspace))
            .expect_err("an entry that maps elsewhere is not this document's");
        assert_eq!(error.code(), "backupEntryIsNotThisDocument");
    } // End of function an_entry_for_another_file_is_not_this_document()

    /// The entry a batch really holds for a document comes back with its text.
    #[test]
    fn the_entry_that_maps_to_the_document_answers_its_exact_text() {
        let (dir, workspace) = workspace_tree();
        // Deliberately different bytes from the live file, so nothing can pass
        // by accidentally reading the target instead of the copy.
        let copied = "matches:\n  - trigger: ':one'\n    replace: earlier\n";
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", copied.as_bytes())],
        );
        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let entry = BackupEntryId::in_batch(batch, Path::new("match/base.yml"))
            .expect("a path this catalogue addresses");
        let answer = read_text(&workspace, &key_of(&entry), a_document(&workspace))
            .expect("the mapped entry is readable");
        assert_eq!(answer.text, copied);
        assert_eq!(
            answer.revision,
            espansoconfig_core::ContentRevision::of_bytes(copied.as_bytes())
        );
        assert_eq!(answer.entry.id(), &entry);
        assert_eq!(answer.entry.length(), copied.len() as u64);
    } // End of function the_entry_that_maps_to_the_document_answers_its_exact_text()

    /// A listing offers the entries and counts what it skipped.
    #[test]
    fn a_listing_carries_its_counts_beside_its_entries() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", BASE_YML.as_bytes())],
        );
        let listing = list_batches(&workspace).expect("the root lists");
        assert_eq!(listing.root, BackupRootState::Present);
        assert_eq!(listing.batches.len(), 1);
        assert!(listing.complete);

        let entries = list_entries(
            &workspace,
            &BackupBatchKey {
                name: A_BATCH.to_owned(),
            },
        )
        .expect("the batch walks");
        assert_eq!(entries.entries.len(), 1);
        assert_eq!(entries.unaddressable, 0);
        assert!(entries.complete);
        // The marker is excluded at the top of the batch and is not an entry.
        assert_eq!(entries.skipped, vec![super::EntrySkipped::Marker]);
    } // End of function a_listing_carries_its_counts_beside_its_entries()

    /// The three operations change no byte of **this** tree.
    ///
    /// A regression tripwire, not a proof. It covers one exercised fixture, so a
    /// route it does not drive, a write that happened to be idempotent and a
    /// metadata-only mutation the snapshot does not record all pass it. The
    /// source-scanning tripwire beside it is
    /// `crate::wire_contract::the_known_backup_routes_name_no_writer`, which
    /// rejects a fixed vocabulary and cannot see what a called function does.
    /// Neither, nor their combination, proves an arbitrary callee
    /// side-effect-free.
    #[test]
    fn no_backup_operation_changes_a_byte_of_the_tree() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", BASE_YML.as_bytes())],
        );
        let before = tree_snapshot(dir.path());
        assert!(before.len() > 4, "the oracle is reading a real tree");

        let batch = BackupBatchKey {
            name: A_BATCH.to_owned(),
        };
        list_batches(&workspace).expect("the root lists");
        let listing = list_entries(&workspace, &batch).expect("the batch walks");
        let entry = listing.entries.first().expect("one entry").id().clone();
        read_text(&workspace, &key_of(&entry), a_document(&workspace)).expect("the entry reads");

        assert_eq!(
            tree_snapshot(dir.path()),
            before,
            "a read created, removed or rewrote something"
        );
    } // End of function no_backup_operation_changes_a_byte_of_the_tree()

    /// Listing a workspace with no backup root creates no backup root.
    ///
    /// Stated apart from the case above because it is the one a `BackupSession`
    /// would fail: the write side creates the root on its first capture, and a
    /// read side that shared that code would leave a directory behind on a
    /// configuration nobody has saved from.
    #[test]
    fn listing_creates_no_backup_root() {
        let (dir, workspace) = workspace_tree();
        let before = tree_snapshot(dir.path());
        list_batches(&workspace).expect("a missing root is not a failure");
        assert_eq!(tree_snapshot(dir.path()), before);
        assert!(!dir.path().join(".espansoconfig-backups").exists());
    } // End of function listing_creates_no_backup_root()

    /// The identity of the workspace's one match file.
    fn a_document(workspace: &Workspace) -> DocumentId {
        workspace
            .list_documents()
            .iter()
            .find(|summary| summary.relative_path.as_path().ends_with("base.yml"))
            .expect("the tree holds base.yml")
            .id
    } // End of function a_document()

    /// An unknown document is the workspace's own refusal, before any read.
    #[test]
    fn an_unknown_document_is_refused_before_anything_is_read() {
        let (dir, workspace) = workspace_tree();
        recognised_batch(
            dir.path(),
            A_BATCH,
            &[("match/base.yml", BASE_YML.as_bytes())],
        );
        let batch = BackupBatchId::parse(A_BATCH).expect("a name the grammar admits");
        let entry = BackupEntryId::in_batch(batch, Path::new("match/base.yml"))
            .expect("a path this catalogue addresses");
        let error = read_text(&workspace, &key_of(&entry), DocumentId(9_999))
            .expect_err("this session holds no such document");
        assert!(matches!(error, CommandError::UnknownDocument { .. }));
    } // End of function an_unknown_document_is_refused_before_anything_is_read()
} // End of module tests
