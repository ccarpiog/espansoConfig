//! Phase 3-7 acceptance: the local raw-item edit through the one save
//! transaction.
//!
//! An [`ItemTextReplacement`] travels as `SaveContent::Edits` through
//! `persist::save_document` — the only entry point that may write a user's file
//! — under the same lock, revision check, semantic gate, acknowledgement and
//! backup every other edit meets. What is pinned here:
//!
//! - a committed replacement puts exactly the range's new text on disk and
//!   every other byte back where it was, and reports one replacement span;
//! - **a stale base revision writes nothing** — the transaction's half of the
//!   step's stale-identity clause (the command layer's half, a stale
//!   `MatchId`, is pinned in `src-tauri/src/commands.rs`). It runs under a
//!   bounded timeout, so a reentrant-lock hang fails instead of hanging;
//! - **a result that does not parse is refused as a patch failure, never as an
//!   acknowledgeable `DocumentDoesNotParse` finding** (ruling 12): the
//!   whole-document editor stays the repair route for broken text;
//! - a range with holes and a range holding a `\r` are refused by the save
//!   exactly as by the engine, with nothing written;
//! - the semantic gate still applies: a suspicion is refused once and commits
//!   when acknowledged, and a byte-identical text commits nothing.
//!
//! # Privacy
//!
//! Every byte written here is hand-authored neutral YAML or a copy of a
//! synthetic corpus fixture taken into a `TempDir` first (`CLAUDE.md` section 1).

mod common;

use common::corpus_root;
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::patch::{
    item_owned_text, DocumentEdit, DocumentPath, EditError, ItemTextReplacement,
    VerificationFailure,
};
use espansoconfig_core::persist::{
    save_document, Acknowledgement, BackupSession, SaveContent, SaveError, SaveRequest,
    SavedDocument,
};
use espansoconfig_core::validate::FindingClass;
use espansoconfig_core::{ContentRevision, DocumentId};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Three matches both gates approve of.
const CLEAN: &str =
    "matches:\n  - trigger: ':one'\n    replace: 'first'\n  - trigger: ':two'\n    \
                     replace: 'second'\n  - trigger: ':three'\n    replace: 'third'\n";

/// A configuration root shaped like espanso's own, holding `match/base.yml`.
fn config_root_with(source: &str) -> (tempfile::TempDir, PathBuf, PathBuf) {
    let directory = tempfile::tempdir().expect("a temp directory");
    let root = directory.path().canonicalize().expect("a real path");
    let target = root.join("match").join("base.yml");
    std::fs::create_dir_all(target.parent().expect("a parent")).expect("the directory is made");
    std::fs::write(&target, source.as_bytes()).expect("the fixture file is written");
    (directory, root, target)
} // End of function config_root_with()

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

/// The path of the `index`-th item of the root `matches` sequence.
fn item(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// One raw-item save of `target`, with a backup session rooted beside it.
fn save_item_text(
    root: &Path,
    target: &Path,
    base: ContentRevision,
    index: usize,
    text: &str,
    acknowledgement: &Acknowledgement,
) -> Result<SavedDocument, SaveError> {
    let context = context_for(root, target);
    let backups = BackupSession::rooted_at(root);
    let edits = [DocumentEdit::ReplaceItemText(ItemTextReplacement::new(
        item(index),
        text,
    ))];
    save_document(SaveRequest {
        context: &context,
        base_revision: base,
        content: SaveContent::Edits(&edits),
        acknowledgement,
        backups: Some(&backups),
    })
} // End of function save_item_text()

/// What is on disk at `path`.
fn on_disk(path: &Path) -> String {
    std::fs::read_to_string(path).expect("the file is readable")
}

#[test]
fn a_committed_raw_item_save_writes_exactly_the_range() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let read = item_owned_text(CLEAN, &item(1)).expect("item 1 is readable");
    assert_eq!(read.text, "  - trigger: ':two'\n    replace: 'second'\n");
    let text =
        "  # now with a note\n  - trigger: ':two'\n    replace: 'rewritten'\n    label: 'b'\n";

    let saved = save_item_text(&root, &target, base, 1, text, &Acknowledgement::none())
        .expect("the save commits");
    assert!(saved.committed);
    assert!(saved.backup.is_some(), "the first change is backed up");
    assert_eq!(saved.replacements.len(), 1, "one range, one replacement");
    let expected = CLEAN.replacen(&read.text, text, 1);
    assert_eq!(on_disk(&target), expected);
    assert_eq!(saved.text, expected);
    assert_eq!(
        saved.revision,
        ContentRevision::of_bytes(expected.as_bytes())
    );
}

#[test]
fn a_stale_base_revision_writes_nothing() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let stale = ContentRevision::of_bytes(CLEAN.as_bytes());
    // Another writer changes the file after the range was read.
    let external = CLEAN.replace("'first'", "'changed elsewhere'");
    std::fs::write(&target, external.as_bytes()).expect("the external write");

    let (root_moved, target_moved) = (root.clone(), target.clone());
    let outcome = within(Duration::from_secs(20), move || {
        let result = save_item_text(
            &root_moved,
            &target_moved,
            stale,
            1,
            "  - trigger: ':two'\n    replace: 'mine'\n",
            &Acknowledgement::none(),
        );
        matches!(result, Err(SaveError::RevisionMismatch { .. }))
    });
    assert_eq!(
        outcome,
        Some(true),
        "a stale base is refused with the revision mismatch, and the call returns"
    );
    assert_eq!(on_disk(&target), external, "nothing was written");
}

#[test]
fn a_result_that_does_not_parse_is_a_patch_failure_and_writes_nothing() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let outcome = save_item_text(
        &root,
        &target,
        base,
        1,
        "  - trigger: ':two\n",
        &Acknowledgement::none(),
    );
    assert!(
        matches!(
            outcome,
            Err(SaveError::Patch(EditError::Verification(
                VerificationFailure::DoesNotParse(_)
            )))
        ),
        "{outcome:?}"
    );
    assert_eq!(on_disk(&target), CLEAN);
}

#[test]
fn a_holed_range_and_a_carriage_return_are_refused_by_the_save() {
    let holed = std::fs::read_to_string(
        corpus_root()
            .join("synthetic")
            .join("run-based-removal-boundaries.yml"),
    )
    .expect("the fixture");
    let (_directory, root, target) = config_root_with(&holed);
    let base = ContentRevision::of_bytes(holed.as_bytes());
    let outcome = save_item_text(
        &root,
        &target,
        base,
        0,
        "  - trigger: ':x'\n",
        &Acknowledgement::none(),
    );
    assert!(matches!(
        outcome,
        Err(SaveError::Patch(EditError::ItemRangeNotContiguous { .. }))
    ));
    assert_eq!(on_disk(&target), holed);

    let (_directory, root, target) = config_root_with(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let outcome = save_item_text(
        &root,
        &target,
        base,
        0,
        "  - trigger: ':one'\r\n    replace: 'first'\r\n",
        &Acknowledgement::none(),
    );
    assert!(matches!(
        outcome,
        Err(SaveError::Patch(
            EditError::ItemTextHoldsCarriageReturn { .. }
        ))
    ));
    assert_eq!(on_disk(&target), CLEAN);
}

#[test]
fn the_semantic_gate_still_refuses_and_an_acknowledgement_still_commits() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    // A reference to a variable nothing declares is a suspicion.
    let text = "  - trigger: ':two'\n    replace: '{{nowhere}}'\n";
    let refusal = match save_item_text(&root, &target, base, 1, text, &Acknowledgement::none()) {
        Err(SaveError::Refused(refusal)) => refusal,
        other => panic!("expected a refusal at the semantic gate, got {other:?}"),
    };
    assert!(!refusal.findings.is_empty());
    assert!(refusal
        .findings
        .iter()
        .all(|finding| finding.code.class() == FindingClass::SuspiciousButPermitted));
    assert_eq!(on_disk(&target), CLEAN, "a refusal writes nothing");

    let saved = save_item_text(
        &root,
        &target,
        base,
        1,
        text,
        &Acknowledgement::of(&refusal.findings),
    )
    .expect("the acknowledged save commits");
    assert!(saved.committed);
    assert!(on_disk(&target).contains("'{{nowhere}}'"));

    // An editor-model error is never acknowledgeable: a match with no content.
    let current = on_disk(&target);
    let base = ContentRevision::of_bytes(current.as_bytes());
    let outcome = save_item_text(
        &root,
        &target,
        base,
        0,
        "  - trigger: ':one'\n",
        &Acknowledgement::none(),
    );
    assert!(matches!(outcome, Err(SaveError::Refused(_))));
    assert_eq!(on_disk(&target), current);
}

#[test]
fn a_byte_identical_text_commits_nothing() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let read = item_owned_text(CLEAN, &item(2)).expect("readable");
    let saved = save_item_text(
        &root,
        &target,
        base,
        2,
        &read.text,
        &Acknowledgement::none(),
    )
    .expect("an identical text is a legal save");
    assert!(!saved.committed);
    assert!(saved.backup.is_none());
    assert_eq!(saved.revision, base);
    assert_eq!(on_disk(&target), CLEAN);
}

/// Runs `work` on another thread and gives it `limit` to finish.
///
/// The lock is not reentrant, so a path that reached for it twice would park
/// forever; this makes such a defect a failure rather than a hang.
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
