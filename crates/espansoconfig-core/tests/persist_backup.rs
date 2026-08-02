//! Phase 2a-3b acceptance: **step 13 — backups, and the rotation that bounds
//! them.**
//!
//! Everything here goes through `save_document`, because that is the only entry
//! point a user's edit travels and the placement of the backup inside it —
//! between the verdict and the commit — is half of what this sub-phase is. The
//! grammar rotation trusts, the batch-name ordering, the date arithmetic and the
//! `_outside` path rule are unit-tested beside the code they belong to, in
//! `src/persist/backup.rs`; this file pins the properties only a whole
//! transaction can show.
//!
//! What is pinned, in the order it matters:
//!
//! - a committed save copies the target **before** it is replaced, and the copy
//!   is byte-identical to what the target held;
//! - a **refused** save copies nothing — a backup of a file nobody changed is
//!   exactly what putting step 13 after the verdict prevents;
//! - a save whose candidate is byte-identical copies nothing, because there is
//!   no pristine version of a file that is not being replaced;
//! - the **second** modification of one file in one session copies nothing, which
//!   is plan section 6.6's *"before the first modification of each file per
//!   session"*;
//! - the backup path is **not under an auto-loaded glob**, asserted both
//!   structurally and by asking `discovery::enumerate` what it can see;
//! - **the tension between the two rules is resolved rather than described**: a
//!   session that saves far more than ten files keeps every one of their copies,
//!   because a batch is a session and rotation, which runs once, cannot consider
//!   the batch this session is writing into;
//! - eleven sessions leave ten batches, and the one that goes is the oldest;
//! - the copy carries the target's **mode bits** and its **extended attributes**
//!   and deliberately **not** its access control list;
//! - a backup that cannot be written **fails the save before the commit**, so the
//!   call does not rewrite the target — and it removes no older batch on the way
//!   out, because rotation runs after a copy rather than before one;
//! - a save whose **commit** then fails leaves the file free to be copied again,
//!   so a retry never rewrites a target without a copy of what it replaced;
//! - a backup root that is a **symlink**, a backup root anybody else can reach,
//!   and a session root espanso loads from are each refused before anything is
//!   written;
//! - the owner's whole real configuration goes through one session, which is the
//!   shape a real editing session has and the shape no synthetic fixture proves.
//!
//! # What this binary does **not** pin
//!
//! - **Nothing here says a file is recoverable.** Retention is ten batches, and
//!   a batch is a session; no test name and no assertion message may claim
//!   otherwise.
//! - **No second process is involved**, so the residual race is untouched here
//!   exactly as it is everywhere else in this repository.
//! - **The ACL assertions can skip.** `chmod +a` is an instrument, and a volume
//!   that will not keep an entry makes the test print a reason and return.
//! - **Nothing here survives a crash on purpose.** The copy is fsynced before the
//!   rename, and the directory entries that name it are not; no test can tell.
//!
//! # Privacy
//!
//! Every byte a synthetic test writes is hand-authored neutral YAML declared as a
//! `const`. The one real-corpus sweep copies each file into a `TempDir` first,
//! never writes inside `tests/corpus/`, and prints **counts and file names only**
//! (`CLAUDE.md` section 1). It skips cleanly when the corpus is absent.

mod common;

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::patch::{
    apply_scalar_edit, path_to, DocumentEdit, DocumentPath, ScalarEdit,
};
use espansoconfig_core::persist::{
    save_document, Acknowledgement, BackupSession, RotationOutcome, SaveContent, SaveError,
    SaveRequest, SavedDocument, BACKUP_DIRECTORY_NAME, BATCHES_RETAINED, BATCH_MARKER_FORMAT,
    BATCH_MARKER_NAME,
};
use espansoconfig_core::{ContentRevision, DocumentId, SyntaxIndex};
use std::path::{Component, Path, PathBuf};

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

/// Two matches both gates approve of.
const CLEAN: &str = "matches:\n  - trigger: ':one'\n    replace: 'first'\n  - trigger: ':two'\n    replace: 'second'\n";

/// A match whose `regex` does not compile, so the candidate carries an
/// unoverrideable `EditorModelError` and the save is refused at the verdict.
const BROKEN_REGEX: &str =
    "matches:\n  - regex: '[unclosed'\n    replace: 'world'\n  - trigger: ':two'\n    replace: 'second'\n";

/// The value the saves write.
const NEW_VALUE: &str = "edited by the save transaction";

/// A configuration root shaped like espanso's own: `match/` with one file in it.
///
/// The root is a `TempDir` rather than the real configuration directory, because
/// a test that wrote into the owner's espanso tree would be a test that edits a
/// user's snippets.
fn config_root_with(files: &[(&str, &str)]) -> (tempfile::TempDir, PathBuf) {
    let directory = tempfile::tempdir().expect("a temp directory");
    let root = directory.path().canonicalize().expect("a real path");
    for (relative, source) in files {
        let path = root.join(relative);
        std::fs::create_dir_all(path.parent().expect("a parent")).expect("the directory is made");
        std::fs::write(&path, source.as_bytes()).expect("the fixture file is written");
    } // End of the loop that lays the fixture files out
    (directory, root)
}

/// A match-file context for `path`, relative to `root`.
fn context_for(root: &Path, path: &Path) -> DocumentContext {
    DocumentContext {
        id: DocumentId(1),
        path: path.to_path_buf(),
        relative_path: path
            .strip_prefix(root)
            .expect("the fixture lives under the root")
            .to_path_buf(),
        kind: FileKind::MatchFile,
        disabled: false,
    }
}

/// One scalar edit, addressed by a path this file spells out.
fn scalar_edit(path: &str, value: &str) -> DocumentEdit {
    DocumentEdit::Scalar(ScalarEdit::new(
        DocumentPath::parse(path).expect("the test's own path parses"),
        value.to_owned(),
    ))
}

/// The revision of whatever is on disk at `path` right now.
fn revision_on_disk(path: &Path) -> ContentRevision {
    ContentRevision::of_bytes(&std::fs::read(path).expect("the file is readable"))
}

/// One save of `target`, with `session`'s backups.
fn save_with(
    root: &Path,
    target: &Path,
    session: Option<&BackupSession>,
    edits: &[DocumentEdit],
) -> Result<SavedDocument, SaveError> {
    let context = context_for(root, target);
    save_document(SaveRequest {
        context: &context,
        base_revision: revision_on_disk(target),
        content: SaveContent::Edits(edits),
        acknowledgement: &Acknowledgement::none(),
        backups: session,
    })
} // End of function save_with()

/// Every **copy** inside a batch, as paths relative to it, sorted.
///
/// The batch's own ownership marker is not a copy: it is the file that tells
/// rotation this application minted the directory, and every batch carries one.
/// It is asserted for separately rather than filtered silently.
fn copies_under(batch: &Path) -> Vec<PathBuf> {
    assert!(
        batch.join(BATCH_MARKER_NAME).is_file(),
        "{} must carry its ownership marker",
        batch.display()
    );
    files_under(batch)
        .into_iter()
        .filter(|relative| relative != Path::new(BATCH_MARKER_NAME))
        .collect()
} // End of function copies_under()

/// Every regular file under `directory`, as paths relative to it, sorted.
fn files_under(directory: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut pending = vec![directory.to_path_buf()];
    while let Some(next) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&next) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(metadata) = std::fs::symlink_metadata(&path) else {
                continue;
            };
            if metadata.is_dir() {
                pending.push(path);
            } else {
                found.push(
                    path.strip_prefix(directory)
                        .expect("a descendant")
                        .to_path_buf(),
                );
            }
        } // End of the loop over one directory's entries
    } // End of the walk over the tree
    found.sort();
    found
} // End of function files_under()

/// Creates `directory` and every parent, `0o700`, which is what this application
/// creates every directory of a backup tree with.
fn private_directory(directory: &Path) {
    use std::os::unix::fs::DirBuilderExt as _;
    std::fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(directory)
        .expect("the private directory is created");
}

/// The batch directories a backup root holds, sorted.
fn batches(root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut found: Vec<PathBuf> = entries
        .flatten()
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.path())
        .collect();
    found.sort();
    found
}

// ---------------------------------------------------------------------------
// 1. A committed save copies the target before it replaces it
// ---------------------------------------------------------------------------

/// The property the whole sub-phase exists for: after a committed save, the
/// backup holds **exactly** the bytes the target held before it.
#[test]
fn a_committed_save_copies_the_targets_pre_save_bytes() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let session = BackupSession::rooted_at(&root);

    let saved = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");

    assert!(saved.committed);
    let record = saved.backup.expect("a committed save takes a backup");
    assert_eq!(
        std::fs::read(&record.path).expect("the backup is readable"),
        CLEAN.as_bytes(),
        "the backup is the pre-save target, byte for byte"
    );
    assert_ne!(
        std::fs::read_to_string(&target).expect("the target is readable"),
        CLEAN,
        "the fixture is only a test of a backup if the target really changed"
    );
    assert_eq!(session.captured_count(), 1);
    assert!(session.has_captured(&target));
} // End of function a_committed_save_copies_the_targets_pre_save_bytes()

/// The backup's path is the plan's shape: the backup root, a batch, then the
/// target's **own relative path**, so `config/x.yml` and `match/x.yml` cannot
/// collide.
#[test]
fn the_backup_keeps_the_targets_path_relative_to_the_config_root() {
    let (_directory, root) =
        config_root_with(&[("match/base.yml", CLEAN), ("config/base.yml", CLEAN)]);
    let session = BackupSession::rooted_at(&root);

    for relative in ["match/base.yml", "config/base.yml"] {
        let target = root.join(relative);
        let saved = save_with(
            &root,
            &target,
            Some(&session),
            &[scalar_edit("matches[0].replace", NEW_VALUE)],
        )
        .expect("the save commits");
        let record = saved.backup.expect("a committed save takes a backup");
        let batch = session.batch().expect("a batch exists once one is used");
        assert_eq!(
            record.path,
            batch.join(relative),
            "the backup path is <root>/<batch>/<the file's own relative path>"
        );
    } // End of the loop over the two same-named files

    // Two files called `base.yml` are two backups, which flattening to a bare
    // file name would have made one.
    let batch = session.batch().expect("a batch");
    assert_eq!(
        copies_under(&batch),
        vec![
            PathBuf::from("config/base.yml"),
            PathBuf::from("match/base.yml")
        ]
    );
} // End of function the_backup_keeps_the_targets_path_relative_to_the_config_root()

/// A caller that asks for no backups gets none, and nothing is created.
#[test]
fn a_save_with_no_session_writes_no_backup_at_all() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");

    let saved = save_with(
        &root,
        &target,
        None,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");

    assert!(saved.committed);
    assert!(saved.backup.is_none(), "the caller said it wanted none");
    assert!(
        !root.join(BACKUP_DIRECTORY_NAME).exists(),
        "nothing may be created for a save that asked for no backup"
    );
} // End of function a_save_with_no_session_writes_no_backup_at_all()

// ---------------------------------------------------------------------------
// 2. The three cases that must copy nothing
// ---------------------------------------------------------------------------

/// A refused save leaves no backup. This is the whole reason step 13 sits
/// **after** the verdict: a backup of a file nobody changed is litter with a
/// misleading name.
#[test]
fn a_refused_save_leaves_no_backup_of_a_file_nobody_changed() {
    let (_directory, root) = config_root_with(&[("match/base.yml", BROKEN_REGEX)]);
    let target = root.join("match/base.yml");
    let before = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let error = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[1].replace", NEW_VALUE)],
    )
    .expect_err("an editor-model error refuses");

    assert!(matches!(error, SaveError::Refused(_)));
    assert_eq!(revision_on_disk(&target), before);
    assert!(session.batch().is_none(), "no batch directory was minted");
    assert_eq!(session.captured_count(), 0);
    assert!(
        !root.join(BACKUP_DIRECTORY_NAME).exists(),
        "this refusal created no backup root"
    );
} // End of function a_refused_save_leaves_no_backup_of_a_file_nobody_changed()

/// A save whose candidate is byte-identical rewrites nothing, so there is
/// nothing to hold a pristine copy of.
#[test]
fn a_save_that_rewrites_nothing_takes_no_backup() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let session = BackupSession::rooted_at(&root);

    let saved = save_with(&root, &target, Some(&session), &[]).expect("an empty batch succeeds");

    assert!(!saved.committed, "an empty batch changes nothing");
    assert!(saved.backup.is_none());
    assert_eq!(session.captured_count(), 0);
    assert!(!root.join(BACKUP_DIRECTORY_NAME).exists());
} // End of function a_save_that_rewrites_nothing_takes_no_backup()

/// *Before the **first** modification of each file per session.* The second save
/// of one file copies nothing, and the copy that exists is still the **first**
/// version — not the one the second save replaced.
#[test]
fn the_second_save_of_one_file_in_one_session_takes_no_second_backup() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let session = BackupSession::rooted_at(&root);

    let first = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", "one")],
    )
    .expect("the first save commits");
    let record = first.backup.expect("the first save takes a backup");

    let second = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", "two")],
    )
    .expect("the second save commits");

    assert!(second.committed, "the second save really did rewrite");
    assert!(
        second.backup.is_none(),
        "the file was already copied this session"
    );
    assert_eq!(session.captured_count(), 1);
    assert_eq!(
        std::fs::read(&record.path).expect("readable"),
        CLEAN.as_bytes(),
        "the one copy is the pristine one, not the intermediate one"
    );
    let batch = session.batch().expect("one batch");
    assert_eq!(
        copies_under(&batch).len(),
        1,
        "one file, copied once, is one copy in the batch"
    );
} // End of function the_second_save_of_one_file_in_one_session_takes_no_second_backup()

/// A **new session** over the same file copies again, into its own batch. This
/// is the other half of "per session", and without it the rule would mean "per
/// file, once, ever".
#[test]
fn a_new_session_over_the_same_file_takes_its_own_backup() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");

    let first = BackupSession::rooted_at(&root);
    save_with(
        &root,
        &target,
        Some(&first),
        &[scalar_edit("matches[0].replace", "one")],
    )
    .expect("the first session's save commits");

    let second = BackupSession::rooted_at(&root);
    let saved = save_with(
        &root,
        &target,
        Some(&second),
        &[scalar_edit("matches[0].replace", "two")],
    )
    .expect("the second session's save commits");

    assert!(saved.backup.is_some(), "a new session copies again");
    assert_ne!(
        first.batch().expect("a batch"),
        second.batch().expect("a batch"),
        "two sessions are two batches"
    );
    assert_eq!(batches(&root.join(BACKUP_DIRECTORY_NAME)).len(), 2);
} // End of function a_new_session_over_the_same_file_takes_its_own_backup()

// ---------------------------------------------------------------------------
// 3. Where a backup must not be
// ---------------------------------------------------------------------------

/// A backup under an auto-loaded glob is a bug that creates snippets. Two
/// independent checks: the shape of the path, and what this application's own
/// enumeration can see.
#[test]
fn the_backup_is_not_anywhere_espansos_include_glob_can_reach() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let session = BackupSession::rooted_at(&root);

    let saved = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");
    let record = saved.backup.expect("a backup");

    // The backup root is a *sibling* of `match/`, which is the load-bearing
    // half: no glob rooted at `match/` reaches a sibling of `match/`.
    let inside = record
        .path
        .strip_prefix(&root)
        .expect("the backup lives under the configuration root");
    let first = inside
        .components()
        .next()
        .expect("at least one component")
        .as_os_str();
    assert_eq!(first, std::ffi::OsStr::new(BACKUP_DIRECTORY_NAME));
    assert_ne!(first, std::ffi::OsStr::new("match"));
    assert_ne!(first, std::ffi::OsStr::new("config"));
    assert!(
        BACKUP_DIRECTORY_NAME.starts_with('.'),
        "the leading dot is belt-and-braces and is still asserted"
    );
    assert!(
        !record.path.starts_with(root.join("match")),
        "espanso's include glob is rooted at match/, so nothing under it may be a backup"
    );
    assert!(!record.path.starts_with(root.join("config")));
    // The `match/` component further down the path is the target's **own**
    // relative path and is a directory *inside* the backup root, which no glob
    // rooted at the configuration root's `match/` can reach.
    assert_eq!(
        inside.components().nth(2).map(Component::as_os_str),
        Some(std::ffi::OsStr::new("match")),
        "the relative path is preserved inside the batch, which is the point of it"
    );

    // And this application's own enumeration — which walks `config/` and
    // `match/` and nothing else — cannot see it either.
    let tree = espansoconfig_core::discovery::enumerate(&root).expect("the tree enumerates");
    for file in &tree.files {
        assert!(
            !file.path.starts_with(root.join(BACKUP_DIRECTORY_NAME)),
            "{} is a backup and must not be listed as a configuration file",
            file.path.display()
        );
    } // End of the loop over the enumerated configuration files
} // End of function the_backup_is_not_anywhere_espansos_include_glob_can_reach()

// ---------------------------------------------------------------------------
// 4. The tension between "once per file per session" and "keep ten batches"
// ---------------------------------------------------------------------------

/// **The tension, resolved rather than described.**
///
/// A file is copied only on its first modification per session, and rotation
/// keeps only ten batches — so a long session could in principle rotate away a
/// file's only pristine copy. It cannot here, because a batch is a **session**:
/// this session mints one directory, rotation runs once before anything is put
/// in it, and the directory it would have to remove to lose a copy is its own
/// newest one.
///
/// Twenty files in one session, which is twice the retention window.
#[test]
fn a_session_that_saves_more_files_than_the_retention_window_keeps_every_copy() {
    let files: Vec<(String, &str)> = (0..20)
        .map(|index| (format!("match/file{index:02}.yml"), CLEAN))
        .collect();
    let borrowed: Vec<(&str, &str)> = files
        .iter()
        .map(|(name, source)| (name.as_str(), *source))
        .collect();
    let (_directory, root) = config_root_with(&borrowed);
    let session = BackupSession::rooted_at(&root);

    let mut recorded = Vec::new();
    for (relative, _) in &borrowed {
        let saved = save_with(
            &root,
            &root.join(relative),
            Some(&session),
            &[scalar_edit("matches[0].replace", NEW_VALUE)],
        )
        .expect("every save commits");
        recorded.push(saved.backup.expect("every first modification is copied"));
    } // End of the loop that saves twenty files in one session

    assert!(
        borrowed.len() > BATCHES_RETAINED,
        "the fixture is only a test of the tension if it exceeds the window"
    );
    assert_eq!(session.captured_count(), borrowed.len());

    // The consequence first, because it is the thing that would actually hurt a
    // user: every copy this session took is still there.
    for record in &recorded {
        assert_eq!(
            std::fs::read(&record.path)
                .unwrap_or_else(|_| panic!("{} was rotated away", record.path.display())),
            CLEAN.as_bytes()
        );
    } // End of the loop that checks every copy is still there

    // And the reason it is still there.
    assert_eq!(
        batches(&root.join(BACKUP_DIRECTORY_NAME)).len(),
        1,
        "one session mints one batch, however many files it saves"
    );

    // Rotation ran once, on the save that minted the batch, and did nothing
    // else on the nineteen after it.
    assert_eq!(
        recorded
            .iter()
            .filter(|record| record.rotation.ran())
            .count(),
        0,
        "with one batch there is nothing to rotate, so no save reports any"
    );
} // End of function a_session_that_saves_more_files_than_the_retention_window_keeps_every_copy()

/// Eleven sessions leave ten batches, and the one removed is the oldest.
///
/// The sessions run inside one wall-clock second, so this is also the test that
/// eleven batches minted in the same second are eleven directories.
#[test]
fn the_eleventh_session_rotates_the_oldest_batch_away() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let backup_root = root.join(BACKUP_DIRECTORY_NAME);

    let mut minted = Vec::new();
    for index in 0..BATCHES_RETAINED + 1 {
        let session = BackupSession::rooted_at(&root);
        let saved = save_with(
            &root,
            &target,
            Some(&session),
            &[scalar_edit("matches[0].replace", &format!("value {index}"))],
        )
        .expect("every save commits");
        let record = saved.backup.expect("every session copies once");
        if index + 1 == BATCHES_RETAINED + 1 {
            assert_eq!(
                record.rotation.removed, 1,
                "the eleventh session is the one that has something to remove"
            );
            assert_eq!(record.rotation.failed, 0);
            assert_eq!(record.rotation.unrecognised, 0);
        } else {
            assert!(
                !record.rotation.ran(),
                "session {index} had fewer than eleven batches to look at"
            );
        }
        minted.push(record.batch);
    } // End of the loop over eleven sessions

    assert_eq!(
        batches(&backup_root).len(),
        BATCHES_RETAINED,
        "ten batches are what retention means"
    );
    assert!(!minted[0].exists(), "the oldest batch is the one removed");
    for kept in &minted[1..] {
        assert!(kept.exists(), "{} must survive", kept.display());
    }
} // End of function the_eleventh_session_rotates_the_oldest_batch_away()

/// A directory rotation does not recognise is left alone, and does not consume
/// one of the ten slots.
#[test]
fn rotation_through_a_save_leaves_a_foreign_directory_alone() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let backup_root = root.join(BACKUP_DIRECTORY_NAME);
    // Two of them, one on each side of every batch name in every ordering this
    // module could use — `!` sorts before a digit and `z` after one. A single
    // foreign directory that happened to sort last would survive a rotation that
    // recognised nothing, and the test would pass while measuring nothing.
    let foreign = ["!somebody-elses-directory", "zsomebody-elses-directory"];
    // The root is made **private**, because an existing backup root that anybody
    // else can reach is refused before rotation is ever reached — a different
    // property, with its own test, and not the one this file is measuring here.
    private_directory(&backup_root);
    for name in foreign {
        std::fs::create_dir_all(backup_root.join(name)).expect("created");
        std::fs::write(
            backup_root.join(name).join("precious"),
            b"not this application's",
        )
        .expect("written");
    } // End of the loop that plants the foreign directories

    for index in 0..BATCHES_RETAINED + 1 {
        let session = BackupSession::rooted_at(&root);
        save_with(
            &root,
            &target,
            Some(&session),
            &[scalar_edit("matches[0].replace", &format!("value {index}"))],
        )
        .expect("every save commits");
    } // End of the loop over eleven sessions beside the foreign directory

    for name in foreign {
        assert!(
            backup_root.join(name).join("precious").exists(),
            "this rotation removed nothing without the ownership marker, and {name} has none"
        );
    } // End of the loop that checks both foreign directories survived
    assert_eq!(
        batches(&backup_root).len(),
        BATCHES_RETAINED + foreign.len(),
        "a foreign directory never consumes one of the ten retention slots"
    );
} // End of function rotation_through_a_save_leaves_a_foreign_directory_alone()

// ---------------------------------------------------------------------------
// 5. What the copy carries, and the one thing it deliberately does not
// ---------------------------------------------------------------------------

/// The backup wears the target's own mode bits, and every directory of the
/// backup tree is private.
#[test]
fn the_backup_wears_the_targets_mode_bits_inside_a_private_tree() {
    use std::os::unix::fs::PermissionsExt as _;

    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o640)).expect("chmod");
    let session = BackupSession::rooted_at(&root);

    let saved = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");
    let record = saved.backup.expect("a backup");

    assert_eq!(
        std::fs::metadata(&record.path)
            .expect("stat")
            .permissions()
            .mode()
            & 0o777,
        0o640,
        "a copy is as accessible as the file it copies, and no more"
    );
    for directory in [root.join(BACKUP_DIRECTORY_NAME), record.batch.clone()] {
        assert_eq!(
            std::fs::metadata(&directory)
                .expect("stat")
                .permissions()
                .mode()
                & 0o777,
            0o700,
            "{} must be private",
            directory.display()
        );
    } // End of the loop over the backup tree's directories
} // End of function the_backup_wears_the_targets_mode_bits_inside_a_private_tree()

/// Sets one extended attribute on `path`. Answers whether it worked.
#[cfg(target_os = "macos")]
fn set_extended_attribute(path: &Path, name: &str, value: &[u8]) -> bool {
    let path = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).expect("no NUL");
    let name = std::ffi::CString::new(name).expect("no NUL");
    // SAFETY: both C strings and `value` outlive the call, and the length passed
    // is `value`'s own.
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
} // End of function set_extended_attribute()

/// Reads one extended attribute from `path`, or answers `None` if it is absent.
#[cfg(target_os = "macos")]
fn extended_attribute(path: &Path, name: &str) -> Option<Vec<u8>> {
    let path = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).expect("no NUL");
    let name = std::ffi::CString::new(name).expect("no NUL");
    let mut buffer = vec![0u8; 4096];
    // SAFETY: both C strings outlive the call and `buffer` is `buffer.len()`
    // bytes long, which is the limit passed.
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
} // End of function extended_attribute()

/// Adds one access control entry to `path` with `chmod +a`.
#[cfg(target_os = "macos")]
fn add_access_control_entry(path: &Path, entry: &str) -> bool {
    std::process::Command::new("/bin/chmod")
        .arg("+a")
        .arg(entry)
        .arg(path)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// The access control entries `ls -lde` reports for `path`, one per element.
#[cfg(target_os = "macos")]
fn access_control_entries(path: &Path) -> Vec<String> {
    let output = std::process::Command::new("/bin/ls")
        .arg("-lde")
        .arg(path)
        .output()
        .expect("ls runs");
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .skip(1)
        .map(|line| line.trim().to_owned())
        .collect()
}

/// Removes every ACL under `directory`, so a `TempDir` can delete itself.
#[cfg(target_os = "macos")]
fn strip_access_control_lists(directory: &Path) {
    let _ = std::process::Command::new("/bin/chmod")
        .arg("-R")
        .arg("-N")
        .arg(directory)
        .status();
}

/// A backup carries the target's extended attributes, so it is a copy of the
/// whole file rather than only of its data fork.
#[cfg(target_os = "macos")]
#[test]
fn the_backup_carries_the_targets_extended_attributes() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let attributes: [(&str, &[u8]); 2] = [
        ("com.apple.metadata:_kMDItemUserTags", b"espansoconfig-test"),
        ("com.espansoconfig.test.probe", b"carried into the backup"),
    ];
    for (name, value) in attributes {
        assert!(
            set_extended_attribute(&target, name, value),
            "setxattr failed for {name}, so this test would measure nothing"
        );
    } // End of the loop that seeds the target's attributes

    let session = BackupSession::rooted_at(&root);
    let saved = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");
    let record = saved.backup.expect("a backup");

    for (name, value) in attributes {
        assert_eq!(
            extended_attribute(&record.path, name).as_deref(),
            Some(value),
            "{name} must have travelled onto the backup"
        );
    } // End of the loop that checks the attributes arrived
} // End of function the_backup_carries_the_targets_extended_attributes()

/// **The decision, asserted.** A backup does *not* carry the target's access
/// control list, because rotation deletes directories and a copied denying entry
/// makes a copy undeletable. The target keeps its own entry; the copy has none.
#[cfg(target_os = "macos")]
#[test]
fn the_backup_does_not_carry_the_targets_access_control_list() {
    let (directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    if !add_access_control_entry(&target, "everyone deny write") {
        println!("SKIP: chmod +a could not set an ACL here");
        return;
    }
    if access_control_entries(&target).is_empty() {
        println!("SKIP: this volume does not keep an access control entry");
        strip_access_control_lists(directory.path());
        return;
    }

    let session = BackupSession::rooted_at(&root);
    let saved = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");
    let record = saved.backup.expect("a backup");

    assert!(
        access_control_entries(&record.path).is_empty(),
        "an access control list on a backup is a backup that may not be rotatable"
    );
    assert!(
        !access_control_entries(&target).is_empty(),
        "the target keeps its own entry: 2a-3a's guarantee is untouched by this decision"
    );

    // A backup with no denying entry is a backup rotation can remove, which is
    // the property the decision exists for.
    assert!(
        std::fs::remove_file(&record.path).is_ok(),
        "the copy must be deletable"
    );
    strip_access_control_lists(directory.path());
} // End of function the_backup_does_not_carry_the_targets_access_control_list()

// ---------------------------------------------------------------------------
// 6. A backup that cannot be written
// ---------------------------------------------------------------------------

/// A save whose safety net cannot be put in place does not proceed, so this call
/// does not rewrite the target.
///
/// The obstruction is a **regular file** where the backup root belongs, which
/// makes the batch directory impossible to create. It is a failure rather than a
/// refusal — the environment stopped an operation, and there is nothing here for
/// a user to decide.
#[test]
fn a_backup_that_cannot_be_written_stops_the_save_before_the_commit() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let before = revision_on_disk(&target);
    std::fs::write(root.join(BACKUP_DIRECTORY_NAME), b"not a directory").expect("the obstruction");
    let session = BackupSession::rooted_at(&root);

    let error = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect_err("the backup cannot be written, so the save does not proceed");

    assert!(matches!(error, SaveError::Backup(_)), "got {error}");
    assert!(!error.is_refusal(), "the environment refused, not a check");
    assert!(!error.may_have_written(), "this is before the commit");
    assert_eq!(
        revision_on_disk(&target),
        before,
        "this call did not rewrite the target"
    );
    assert_eq!(session.captured_count(), 0);
} // End of function a_backup_that_cannot_be_written_stops_the_save_before_the_commit()

/// Seeds a batch directory carrying the ownership marker rotation looks for, so
/// that a test's fixture is a directory this application would recognise as its
/// own.
fn seed_marked_batch(backup_root: &Path, name: &str) -> PathBuf {
    let batch = backup_root.join(name);
    private_directory(&batch);
    std::fs::write(
        batch.join(BATCH_MARKER_NAME),
        format!("{BATCH_MARKER_FORMAT} 1\n"),
    )
    .expect("the ownership marker is written");
    std::fs::write(batch.join("payload"), b"an older session's copy").expect("written");
    batch
} // End of function seed_marked_batch()

/// **A backup that fails removes no older batch.**
///
/// Rotation is the one destructive operation here, and it runs **after** a copy
/// has been written rather than when the batch directory is minted. Eleven older
/// batches are waiting, and a save whose copy cannot be written must leave all
/// eleven where they are: spending a retention slot on an attempt that produced
/// nothing is how a failed backup costs a user an older one.
///
/// The obstruction is a configuration directory named exactly like a batch's own
/// ownership marker, so the copy's parent cannot be created inside the batch —
/// which is a failure **after** the batch exists, and the only kind that can tell
/// the two orderings apart.
#[test]
fn a_backup_that_fails_after_its_batch_exists_removes_no_older_batch() {
    let relative = format!("{BATCH_MARKER_NAME}/base.yml");
    let (_directory, root) = config_root_with(&[(relative.as_str(), CLEAN)]);
    let target = root.join(&relative);
    let backup_root = root.join(BACKUP_DIRECTORY_NAME);
    private_directory(&backup_root);
    let mut seeded = Vec::new();
    for minute in 0..BATCHES_RETAINED + 1 {
        seeded.push(seed_marked_batch(
            &backup_root,
            &format!("2026-07-29T14{minute:02}00Z"),
        ));
    } // End of the loop that seeds eleven older batches

    let session = BackupSession::rooted_at(&root);
    let error = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect_err("the copy's own parent cannot be created");

    assert!(matches!(error, SaveError::Backup(_)), "got {error}");
    for batch in &seeded {
        assert!(
            batch.join("payload").exists(),
            "{} was removed for a backup that never happened",
            batch.display()
        );
    } // End of the loop that checks every older batch survived
    assert_eq!(session.captured_count(), 0);
} // End of function a_backup_that_fails_after_its_batch_exists_removes_no_older_batch()

/// **A save whose commit fails does not leave the file recorded as copied.**
///
/// The backup is taken before the write primitive's own pre-commit checks, and
/// those can still stop the commit. If the session went on believing the file had
/// been copied, the retry would rewrite it with no copy of the bytes it replaced
/// — which is the one thing step 13 exists to prevent.
///
/// The commit is stopped by making the target's own directory unwritable, so the
/// temp file the atomic write needs cannot be created. The backup root is a
/// sibling of that directory and is untouched, so the copy itself succeeds.
#[test]
fn a_save_whose_commit_fails_leaves_the_file_free_to_be_copied_again() {
    use std::os::unix::fs::PermissionsExt as _;

    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let session = BackupSession::rooted_at(&root);

    std::fs::set_permissions(root.join("match"), std::fs::Permissions::from_mode(0o500))
        .expect("the target's directory is made unwritable");
    let error = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect_err("the commit cannot create its temp file");
    std::fs::set_permissions(root.join("match"), std::fs::Permissions::from_mode(0o700))
        .expect("and is made writable again");

    assert!(matches!(error, SaveError::Write(_)), "got {error}");
    assert!(
        !error.may_have_written(),
        "this failure is before the rename, which is what makes the copy discardable"
    );
    assert!(
        !session.has_captured(&target),
        "a copy whose save did not commit is not a copy of what a retry replaces"
    );
    assert_eq!(session.captured_count(), 0);
    let batch = session
        .batch()
        .expect("the batch was minted before the failure");
    assert_eq!(
        copies_under(&batch),
        Vec::<PathBuf>::new(),
        "the copy is removed with the record of it, so a retry can take its place"
    );

    // And the retry — in the same session — copies again, into the same batch.
    let saved = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the retry commits");
    let record = saved.backup.expect("the retry takes its own copy");
    assert_eq!(record.batch, batch, "one session is still one batch");
    assert_eq!(
        std::fs::read(&record.path).expect("readable"),
        CLEAN.as_bytes(),
        "and the copy is the bytes the retry replaced"
    );
} // End of function a_save_whose_commit_fails_leaves_the_file_free_to_be_copied_again()

/// **A backup root that is a symlink stops the save**, and nothing in the tree it
/// points at is read, listed or removed.
///
/// Adopting one would put rotation's `read_dir` — and then its recursive delete —
/// in a tree this application does not own, where a timestamp-shaped directory is
/// somebody else's.
#[test]
fn a_symlinked_backup_root_stops_the_save_and_touches_nothing_behind_it() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let target = root.join("match/base.yml");
    let before = revision_on_disk(&target);

    let elsewhere = root.join("elsewhere");
    private_directory(&elsewhere);
    let mut planted = Vec::new();
    for minute in 0..BATCHES_RETAINED + 1 {
        planted.push(seed_marked_batch(
            &elsewhere,
            &format!("2026-07-29T14{minute:02}00Z"),
        ));
    } // End of the loop that plants eleven batch-shaped directories elsewhere
    std::os::unix::fs::symlink(&elsewhere, root.join(BACKUP_DIRECTORY_NAME))
        .expect("the link is created");

    let session = BackupSession::rooted_at(&root);
    let error = save_with(
        &root,
        &target,
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect_err("a symlinked backup root is refused");

    assert!(matches!(error, SaveError::Backup(_)), "got {error}");
    for batch in &planted {
        assert!(
            batch.join("payload").exists(),
            "{} is behind a link and must never be reached",
            batch.display()
        );
    } // End of the loop that checks the linked tree is intact
    assert_eq!(
        revision_on_disk(&target),
        before,
        "this call did not rewrite the target"
    );
    assert!(session.batch().is_none());
} // End of function a_symlinked_backup_root_stops_the_save_and_touches_nothing_behind_it()

/// **A session rooted at a directory espanso loads from writes nothing at all.**
///
/// `BackupSession::rooted_at(root.join("match"))` would put every copy under
/// `match/.espansoconfig-backups/…`, and a leading dot is explicitly not a
/// defence — so ten batches of a user's snippets would come back as live
/// snippets. Refusing before anything is created is the only direction that
/// cannot create one.
#[test]
fn a_session_rooted_at_an_auto_loaded_directory_writes_nothing() {
    for loaded in ["match", "config"] {
        let (_directory, root) = config_root_with(&[
            (&format!("{loaded}/base.yml"), CLEAN),
            ("match/other.yml", CLEAN),
        ]);
        let target = root.join(loaded).join("base.yml");
        let before = revision_on_disk(&target);
        let session = BackupSession::rooted_at(&root.join(loaded));

        let error = save_with(
            &root,
            &target,
            Some(&session),
            &[scalar_edit("matches[0].replace", NEW_VALUE)],
        )
        .expect_err("a root espanso loads from is refused");

        assert!(matches!(error, SaveError::Backup(_)), "got {error}");
        assert!(
            !root.join(loaded).join(BACKUP_DIRECTORY_NAME).exists(),
            "no directory may be created under a directory espanso loads from"
        );
        assert_eq!(
            revision_on_disk(&target),
            before,
            "this call did not rewrite the target"
        );

        // And this application's own enumeration still sees exactly the two
        // configuration files, which is what a copy under the glob would change.
        let tree = espansoconfig_core::discovery::enumerate(&root).expect("the tree enumerates");
        assert_eq!(
            tree.files.len(),
            2,
            "no copy was written under an include glob"
        );
    } // End of the loop over the two directories espanso's globs are rooted at
} // End of function a_session_rooted_at_an_auto_loaded_directory_writes_nothing()

/// A rotation that ran and found nothing to do is not a rotation that could not
/// look, and [`RotationOutcome`] is the difference.
#[test]
fn a_rotation_that_ran_says_so_even_when_it_removed_nothing() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let session = BackupSession::rooted_at(&root);

    let saved = save_with(
        &root,
        &root.join("match/base.yml"),
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");
    let record = saved.backup.expect("a backup");

    assert_eq!(
        record.rotation.outcome,
        RotationOutcome::Scanned,
        "the root was listed, which is a different fact from having removed nothing"
    );
    assert!(!record.rotation.ran(), "there was nothing to remove");
    assert!(record.rotation.bounded());

    // Every later save of the same session does not rotate at all, and says that
    // rather than reporting an empty scan.
    let second = save_with(
        &root,
        &root.join("match/base.yml"),
        Some(&session),
        &[scalar_edit("matches[1].replace", NEW_VALUE)],
    )
    .expect("the second save commits");
    assert!(second.backup.is_none(), "the file was already copied");
} // End of function a_rotation_that_ran_says_so_even_when_it_removed_nothing()

// ---------------------------------------------------------------------------
// 7. The path Phase 2c is owed
// ---------------------------------------------------------------------------

/// What 2a-3b owes the *Reveal backups in Finder* affordance is a path, and this
/// is it. It is derived rather than configurable, so a caller cannot point it at
/// a directory espanso loads.
#[test]
fn the_session_hands_out_the_backup_root_as_a_path() {
    let (_directory, root) = config_root_with(&[("match/base.yml", CLEAN)]);
    let session = BackupSession::rooted_at(&root);

    assert_eq!(session.config_root(), root);
    assert_eq!(session.root(), root.join(BACKUP_DIRECTORY_NAME));
    assert!(
        !session.root().exists(),
        "the path exists before the directory does, which an affordance has to handle"
    );

    save_with(
        &root,
        &root.join("match/base.yml"),
        Some(&session),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
    )
    .expect("the save commits");
    assert!(
        session.root().is_dir(),
        "and the directory exists after one"
    );
} // End of function the_session_hands_out_the_backup_root_as_a_path()

// ---------------------------------------------------------------------------
// 8. The owner's real configuration, as one session
// ---------------------------------------------------------------------------

/// The first scalar of `source` that a scalar edit can rewrite, if any.
fn first_editable_scalar(source: &str) -> Option<DocumentPath> {
    let index = SyntaxIndex::parse(source).ok()?;
    let identifiers: Vec<_> = index.nodes().iter().map(|node| node.id).collect();
    for id in identifiers {
        if index
            .node(id)
            .and_then(|node| node.scalar.as_ref())
            .is_none()
        {
            continue;
        }
        let Ok(path) = path_to(&index, id) else {
            continue;
        };
        if apply_scalar_edit(source, &path, NEW_VALUE).is_ok() {
            return Some(path);
        }
    } // End of the loop over every addressable node of the file
    None
} // End of function first_editable_scalar()

/// Whether an absent real corpus should fail rather than skip.
const REQUIRE_REAL_CORPUS: &str = "ESPANSOCONFIG_REQUIRE_REAL_CORPUS";

/// **One session over the owner's whole configuration**, which is the shape a
/// real editing session has and the shape no synthetic fixture proves.
///
/// Every file is copied into a temp configuration root first, so nothing under
/// `tests/corpus/` is written; the tree's own `config/` and `match/` layout is
/// preserved, because the relative path is what the backup path is made of. Each
/// file is then saved once, in **one** session, and the sweep asserts that every
/// one of them has a copy, that they are all in **one** batch, and that this
/// application's own enumeration cannot see any of them.
///
/// A zero is only worth something if the sweep had something to look at, so it
/// counts what it walked and asserts that too.
///
/// Prints **counts and file names only** (`CLAUDE.md` section 1).
#[test]
fn backing_up_the_real_configuration_copies_every_file_once_into_one_batch() {
    let files = common::real_corpus();
    assert!(
        !(files.is_empty() && std::env::var_os(REQUIRE_REAL_CORPUS).is_some()),
        "{REQUIRE_REAL_CORPUS} is set and the real corpus is absent: \
         run ./scripts/sync-real-corpus.sh to populate it locally"
    );
    if common::skip_without_real_corpus(
        "backing_up_the_real_configuration_copies_every_file_once_into_one_batch",
        &files,
    ) {
        return;
    }

    let directory = tempfile::tempdir().expect("a temp directory");
    let root = directory.path().canonicalize().expect("a real path");
    let mut relatives = Vec::new();
    for file in &files {
        // `name` is "real/<config|match>/…"; the leading segment is the corpus
        // tier and is not part of the configuration layout.
        let relative = file.name.strip_prefix("real/").unwrap_or(&file.name);
        let path = root.join(relative);
        std::fs::create_dir_all(path.parent().expect("a parent")).expect("made");
        std::fs::write(&path, file.source.as_bytes()).expect("copied out of the corpus");
        relatives.push(relative.to_owned());
    } // End of the loop that copies the corpus into a temp configuration root

    let session = BackupSession::rooted_at(&root);
    let (mut copied, mut unchanged) = (0usize, 0usize);
    for (file, relative) in files.iter().zip(&relatives) {
        let Some(path) = first_editable_scalar(&file.source) else {
            unchanged += 1;
            continue;
        };
        let saved = save_with(
            &root,
            &root.join(relative),
            Some(&session),
            &[DocumentEdit::Scalar(ScalarEdit::new(
                path,
                NEW_VALUE.to_owned(),
            ))],
        )
        .unwrap_or_else(|error| panic!("{}: {error}", file.name));
        let record = saved
            .backup
            .unwrap_or_else(|| panic!("{}: a committed save takes a backup", file.name));
        assert_eq!(
            std::fs::read(&record.path).expect("the copy is readable"),
            file.source.as_bytes(),
            "{}: the copy is the file as it was, byte for byte",
            file.name
        );
        assert_eq!(
            record.path,
            record.batch.join(relative),
            "{}: the copy keeps the file's own relative path",
            file.name
        );
        copied += 1;
    } // End of the loop that saves every real file once

    println!("real corpus backups: {copied} files copied, {unchanged} with no editable scalar");
    assert!(copied > 0, "the sweep must have looked at something");
    assert_eq!(session.captured_count(), copied);
    assert_eq!(
        batches(&root.join(BACKUP_DIRECTORY_NAME)).len(),
        1,
        "one session over a whole configuration is one batch"
    );

    let tree = espansoconfig_core::discovery::enumerate(&root).expect("the tree enumerates");
    for file in &tree.files {
        assert!(
            !file.path.starts_with(root.join(BACKUP_DIRECTORY_NAME)),
            "a backup must never be listed as a configuration file"
        );
    } // End of the loop over the enumerated configuration files
} // End of function backing_up_the_real_configuration_copies_every_file_once_into_one_batch()

// ---------------------------------------------------------------------------
// 9. Two threads, one session
// ---------------------------------------------------------------------------

/// Two documents of one session, saved from two threads at once, produce two
/// copies in **one** batch and do not deadlock.
///
/// The lock order is total — a save takes the path write lock first and the
/// session's mutex second, and nothing takes a path lock while holding the
/// session's — so this is a test of a claim rather than of a schedule. A
/// deadlock would hang the binary rather than fail it, which is why the work
/// each thread does is one save and no more.
#[test]
fn two_threads_of_one_session_produce_two_copies_in_one_batch() {
    let (_directory, root) = config_root_with(&[("match/a.yml", CLEAN), ("match/b.yml", CLEAN)]);
    let session = std::sync::Arc::new(BackupSession::rooted_at(&root));
    let start = std::sync::Arc::new(std::sync::Barrier::new(2));

    let handles: Vec<_> = ["match/a.yml", "match/b.yml"]
        .into_iter()
        .map(|relative| {
            let (root, session, start) = (root.clone(), session.clone(), start.clone());
            std::thread::spawn(move || {
                start.wait();
                save_with(
                    &root,
                    &root.join(relative),
                    Some(&session),
                    &[scalar_edit("matches[0].replace", NEW_VALUE)],
                )
                .expect("both saves commit")
            })
        })
        .collect();

    let records: Vec<_> = handles
        .into_iter()
        .map(|handle| {
            handle
                .join()
                .expect("neither thread panicked")
                .backup
                .expect("both are first modifications")
        })
        .collect();

    assert_eq!(records[0].batch, records[1].batch, "one session, one batch");
    assert_ne!(records[0].path, records[1].path, "two files, two copies");
    assert_eq!(session.captured_count(), 2);
    assert_eq!(batches(&root.join(BACKUP_DIRECTORY_NAME)).len(), 1);
} // End of function two_threads_of_one_session_produce_two_copies_in_one_batch()
