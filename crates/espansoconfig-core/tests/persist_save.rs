//! Phase 2a-2b acceptance: the save transaction around the two gates.
//!
//! Steps 3, 4 and 12 of `IMPLEMENTATION_PLAN.md` section 6.6, plus the blocking
//! policy, plus the order everything happens in and the lock it happens under.
//! Every test in this file works inside a `tempfile::TempDir`; nothing here
//! writes inside `tests/corpus/`, and the byte-exactness sweep copies each
//! fixture out first, because a fixture's whitespace *is* the test data
//! (`CLAUDE.md` section 4).
//!
//! What is pinned, in the order the steps run:
//!
//! - a scalar edit commits, every byte outside the replaced span is identical,
//!   and the returned revision is the revision of the bytes **on disk**;
//! - a stale base revision refuses **and the file is byte-identical afterwards**
//!   — asserted as a hash taken before and after, for every refusal below;
//! - a target that is not valid YAML, an edit that names nothing, and a
//!   candidate that would not parse all refuse at the patch gate;
//! - a candidate carrying an `EditorModelError` refuses at the semantic gate,
//!   with **no acknowledgement that gets past it**, while a save that *removes*
//!   the same finding is accepted;
//! - a `SuspiciousButPermitted` finding refuses until it is acknowledged **by
//!   content**, an acknowledgement from a different candidate does not carry,
//!   and the findings come back on the success path;
//! - the lock is taken once and held: a save blocks while another holder has
//!   it, two saves in a row do not deadlock, and exactly one of several savers
//!   from one base revision commits;
//! - all fifteen byte-exact fixtures go through the transaction, with a
//!   per-fixture outcome table so a fixture that changes side is a failure;
//! - the owner's real configuration passes both gates, counted rather than
//!   assumed, and skipped cleanly when the corpus is absent.
//!
//! # What this binary does **not** pin
//!
//! Stated here rather than left to be discovered.
//!
//! - **Backups (step 13) do not exist.** Nothing here is evidence about them.
//! - **The residual race is untouched.** Nothing in this file involves a second
//!   *process*, which is the case that matters for vim and espanso; the
//!   concurrency tests use threads, which is what the lock actually excludes.
//! - **Nothing here has been checked against a running espanso.** Every claim
//!   about what espanso does is inherited from `crate::validate`, whose own
//!   notes record that it comes from reading espanso's sources.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md`
//! section 1). The one test that reads it prints **counts and file names only**
//! and skips cleanly when it is absent.

mod common;

use common::corpus_root;
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::NewMatch;
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::patch::{
    apply_scalar_edit, path_to, DocumentEdit, DocumentPath, DuplicateItem, EditError, InsertItem,
    ItemPlacement, RemoveItem, ScalarEdit,
};
use espansoconfig_core::persist::{
    lock_path, save_document, Acknowledgement, SaveContent, SaveError, SaveRequest, SaveVerdict,
    WriteError,
};
use espansoconfig_core::validate::{Finding, FindingClass, FindingCode};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId, SyntaxIndex};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Barrier};
use std::time::{Duration, Instant};

// ---------------------------------------------------------------------------
// Fixtures — hand-authored, neutral, and declared here so every sweep can see
// them (`CLAUDE.md` section 1)
// ---------------------------------------------------------------------------

/// Two matches both gates approve of.
const CLEAN: &str = "matches:\n  - trigger: ':one'\n    replace: 'first'\n  - trigger: ':two'\n    replace: 'second'\n";

/// A match whose `regex` compiles. Editing that scalar is how the semantic
/// gate's error side is reached.
const COMPILING_REGEX: &str =
    "matches:\n  - regex: 'hello'\n    replace: 'world'\n  - trigger: ':two'\n    replace: 'second'\n";

/// A match whose `regex` does **not** compile, so the document arrives at the
/// gate already carrying an `EditorModelError`.
const BROKEN_REGEX: &str =
    "matches:\n  - regex: '[unclosed'\n    replace: 'world'\n  - trigger: ':two'\n    replace: 'second'\n";

/// A block body at column **five** followed by a comment at column five — the
/// shape `tests/corpus/synthetic/move-block-scalar-seams.yml` exists to pin,
/// reproduced here so this file does not depend on that fixture's exact bytes.
///
/// Rewriting `matches[1].replace` as a block scalar puts its body at column
/// six, and the comment below is then wrongly indented inside it. That is the
/// one route this project has found from a public edit to a candidate that does
/// not parse.
const BLOCK_BODY_AT_COLUMN_FIVE: &str = "matches:\n  - trigger: ':one'\n    replace: |\n     a body at column five\n  - trigger: ':two'\n    replace: 'plain'\n     # a comment at column five\n  - trigger: ':three'\n    replace: 'third'\n";

/// Not YAML at all: the target-side half of the syntax gate.
const NOT_YAML: &str = "matches:\n  - trigger: ':one'\n    replace: \"unclosed\n";

/// The value the sweeps write. Plain-safe, so the emitter keeps the scalar's
/// presentation wherever it can.
const NEW_VALUE: &str = "edited by the save transaction";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// A temp directory holding one file named `base.yml` with the given text.
fn fixture(source: &str) -> (tempfile::TempDir, PathBuf) {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    std::fs::write(&target, source.as_bytes()).expect("the fixture file is written");
    (directory, target)
}

/// A match-file context for `path`, which is what a save that is allowed to
/// proceed needs.
fn context_for(path: &Path) -> DocumentContext {
    DocumentContext {
        id: DocumentId(1),
        path: path.to_path_buf(),
        relative_path: PathBuf::from(path.file_name().unwrap_or_default()),
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

/// Runs one save against `target`, with the given edits and acknowledgement.
fn save(
    target: &Path,
    base: ContentRevision,
    edits: &[DocumentEdit],
    acknowledgement: &Acknowledgement,
) -> Result<espansoconfig_core::persist::SavedDocument, SaveError> {
    let context = context_for(target);
    save_document(SaveRequest {
        context: &context,
        base_revision: base,
        content: SaveContent::Edits(edits),
        acknowledgement,
        // Backups are 2a-3b's, and every test in *this* binary is about the
        // transaction without them. `tests/persist_backup.rs` is where they are
        // pinned; `None` here is what makes "no backup was taken" a statement
        // this file is entitled to make.
        backups: None,
    })
} // End of function save()

/// Asserts that a refused save left `target` byte-identical and says so.
///
/// The comparison is a hash taken **before** the call and again after, so it
/// covers the whole file rather than the bytes the test happened to think about.
/// It also asserts the two questions a caller asks of a refusal, because a
/// refusal that claimed it might have written would send a caller reloading for
/// nothing.
fn assert_refused_without_writing(
    target: &Path,
    before: ContentRevision,
    error: &SaveError,
    what: &str,
) {
    assert_eq!(
        revision_on_disk(target),
        before,
        "{what}: a refused save must leave the target byte-identical"
    );
    assert!(
        error.is_refusal(),
        "{what}: this is a check declining to write, not the environment failing: {error}"
    );
    assert!(
        !error.may_have_written(),
        "{what}: a refusal renames nothing: {error}"
    );
    assert!(
        std::fs::read_dir(target.parent().expect("a parent directory"))
            .expect("the directory is readable")
            .count()
            == 1,
        "{what}: a refusal leaves no temp file behind"
    );
} // End of function assert_refused_without_writing()

// ---------------------------------------------------------------------------
// 1. The happy path — step 12's answer
// ---------------------------------------------------------------------------

/// A scalar edit is committed, nothing outside its span moves, and the revision
/// handed back is the revision of the bytes on disk.
#[test]
fn a_scalar_edit_is_committed_and_every_byte_outside_its_span_survives() {
    let (directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());

    let saved = save(
        &target,
        base,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect("the save commits");

    assert!(saved.committed, "the candidate differs, so it is written");
    let on_disk = std::fs::read_to_string(&target).expect("the file is readable");
    assert_eq!(on_disk, saved.text, "the file holds exactly the candidate");
    assert_eq!(
        saved.revision,
        ContentRevision::of_bytes(on_disk.as_bytes()),
        "the returned revision is the revision of the bytes on disk"
    );
    assert!(
        saved.findings.is_empty(),
        "a clean candidate has no findings"
    );

    // Byte-exactness, re-derived from the replacement list rather than from the
    // candidate: everything outside the replaced spans must be the source's own
    // bytes.
    assert_eq!(saved.replacements.len(), 1);
    let span = saved.replacements[0].span;
    assert_eq!(&on_disk[..span.start], &CLEAN[..span.start]);
    assert_eq!(
        &on_disk[span.start + saved.replacements[0].text.len()..],
        &CLEAN[span.end..]
    );
    assert_eq!(
        std::fs::read_dir(directory.path())
            .expect("the directory is readable")
            .count(),
        1,
        "no temp file survives a success"
    );
} // End of function a_scalar_edit_is_committed_and_every_byte_outside_its_span_survives()

/// An empty batch produces a candidate identical to the source, and the
/// transaction does not rewrite the file for it.
///
/// This is the decision recorded in `SavedDocument::committed`: every rename
/// installs a new inode and drops eight classes of metadata (2a-1 notes
/// section 4), and paying that for a document that did not change buys nothing.
/// Both gates still ran.
#[test]
fn a_candidate_identical_to_the_target_is_not_rewritten() {
    let (_directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let inode_before = inode_of(&target);

    let saved = save(&target, base, &[], &Acknowledgement::none()).expect("the save proceeds");

    assert!(!saved.committed, "an unchanged candidate is not written");
    assert_eq!(saved.revision, base, "the revision is the one on disk");
    assert_eq!(saved.text, CLEAN);
    assert_eq!(revision_on_disk(&target), base);
    assert_eq!(
        inode_of(&target),
        inode_before,
        "the file was not replaced, so it is still the same inode"
    );
} // End of function a_candidate_identical_to_the_target_is_not_rewritten()

/// A scalar edit that writes a scalar's **existing** value is the same case as
/// an empty batch, and is what makes the check a byte comparison rather than a
/// count of edits.
#[test]
fn an_edit_that_writes_the_value_already_there_is_not_rewritten_either() {
    let (_directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());

    let saved = save(
        &target,
        base,
        &[scalar_edit("matches[0].replace", "first")],
        &Acknowledgement::none(),
    )
    .expect("the save proceeds");

    assert!(!saved.committed);
    assert_eq!(saved.text, CLEAN);
    assert_eq!(revision_on_disk(&target), base);
}

/// Sets one extended attribute on `path`, through the syscall rather than
/// `xattr(1)` so the test depends on the platform and not on a binary.
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

/// Reads one extended attribute from `path`, or `None` if it is absent.
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

/// The access control entries `ls -lde` reports for `path`, mode line dropped.
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
} // End of function access_control_entries()

/// A save carries the target's protection onto the new inode.
///
/// `tests/persist_write.rs` pins the same property on the primitive; this pins
/// it on **the entry point a user's edit actually travels through**, because the
/// transaction is what decides whether the primitive is called at all and with
/// which lock. Plan section 7 row 11, measured end to end.
#[cfg(target_os = "macos")]
#[test]
fn a_committed_save_carries_the_targets_attributes_and_access_control_list() {
    let (directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    assert!(
        set_extended_attribute(&target, "com.espansoconfig.test.probe", b"through the save"),
        "setxattr failed, so this test would measure nothing"
    );
    let acl_set = std::process::Command::new("/bin/chmod")
        .arg("+a")
        .arg("everyone deny write")
        .arg(&target)
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    let before = access_control_entries(&target);

    let saved = save(
        &target,
        base,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect("the save commits");
    assert!(saved.committed, "the candidate differs, so it is written");

    assert_eq!(
        extended_attribute(&target, "com.espansoconfig.test.probe").as_deref(),
        Some(b"through the save".as_slice()),
        "the extended attribute did not survive the save"
    );
    if acl_set && !before.is_empty() {
        assert_eq!(
            access_control_entries(&target),
            before,
            "the access control list did not survive the save, so it broadened access"
        );
    } else {
        println!(
            "NOTE a_committed_save_carries_the_targets_attributes_and_access_control_list: \
             no ACL could be set here, so only the extended attribute was measured"
        );
    }
    assert_eq!(
        std::fs::read_to_string(&target).expect("readable"),
        saved.text,
        "the metadata copy must not touch the data"
    );
    let _ = std::process::Command::new("/bin/chmod")
        .arg("-R")
        .arg("-N")
        .arg(directory.path())
        .status();
} // End of function a_committed_save_carries_the_targets_attributes_and_access_control_list()

/// A document of `matches` matches, for a test that needs the transaction to
/// take a measurable amount of time.
fn many_matches(matches: usize) -> String {
    let mut source = String::from("matches:\n");
    for index in 0..matches {
        source.push_str("  - trigger: ':t");
        source.push_str(&index.to_string());
        source.push_str("'\n    replace: 'value ");
        source.push_str(&index.to_string());
        source.push_str("'\n");
    } // End of the loop that builds one match per line pair
    source
} // End of function many_matches()

/// **A skipped commit re-reads the target before it reports a revision.**
///
/// The committed path ends with the primitive's own read-back, so its revision
/// describes bytes that were on disk moments earlier. The skipped path used to
/// return [`SaveRequest::base_revision`] unchecked — a claim about bytes last
/// seen before a patch, two parses, a projection and a validation, which is
/// where a non-cooperating writer fits.
///
/// **The shape, and its timing assumption, stated.** The document is large
/// enough that an empty-batch save takes on the order of 200 ms in a debug
/// build; the other thread waits 25 ms — long after the save's step-2 read, and
/// long before its re-read — and then replaces the file **without taking the
/// lock**, which is exactly what vim, espanso or a sync agent is. The elapsed
/// time is then what says *which* read refused: a step-2 refusal returns in
/// milliseconds, and only a refusal from the re-read can arrive after the whole
/// gate cycle has run. A machine that returns sooner has not reproduced the
/// case, so the test **skips** rather than asserting on a run that measured
/// nothing.
///
/// It does not close the race and cannot: the window is now one read wide
/// instead of one validation wide, and 2a-1's D4 residual race stands.
#[test]
fn a_skipped_commit_re_reads_the_target_and_refuses_a_replacement() {
    let source = many_matches(3200);
    let (_directory, target) = fixture(&source);
    let base = ContentRevision::of_bytes(source.as_bytes());
    let replacement = "matches:\n  - trigger: ':other'\n    replace: 'from another program'\n";
    let barrier = Arc::new(Barrier::new(2));

    let writer = {
        let target = target.clone();
        let barrier = Arc::clone(&barrier);
        std::thread::spawn(move || {
            barrier.wait();
            std::thread::sleep(Duration::from_millis(25));
            std::fs::write(&target, replacement.as_bytes()).expect("the other program writes");
        })
    };

    barrier.wait();
    let started = Instant::now();
    let outcome = save(&target, base, &[], &Acknowledgement::none());
    let elapsed = started.elapsed();
    writer.join().expect("the other program finishes");

    if elapsed < Duration::from_millis(60) {
        println!(
            "SKIP a_skipped_commit_re_reads_the_target_and_refuses_a_replacement: \
             the save returned after {elapsed:?}, so the replacement did not land inside it"
        );
        return;
    }
    match outcome {
        Err(SaveError::RevisionMismatch {
            expected, found, ..
        }) => {
            assert_eq!(expected, base);
            assert_eq!(
                found,
                ContentRevision::of_bytes(replacement.as_bytes()),
                "the refusal names the bytes the other program left"
            );
        }
        Ok(saved) => panic!(
            "the save reported revision {} for a file that now holds {}",
            saved.revision,
            revision_on_disk(&target)
        ),
        Err(other) => panic!("expected a revision mismatch from the second read, got {other}"),
    }
    assert_eq!(
        std::fs::read_to_string(&target).expect("readable"),
        replacement,
        "the transaction wrote nothing, so the other program's bytes stand"
    );
} // End of function a_skipped_commit_re_reads_the_target_and_refuses_a_replacement()

/// The inode number of `path`, used to show that a skipped commit really did
/// not replace the file.
fn inode_of(path: &Path) -> u64 {
    use std::os::unix::fs::MetadataExt;
    std::fs::metadata(path).expect("the file exists").ino()
}

// ---------------------------------------------------------------------------
// 2. Step 2 — the revision check
// ---------------------------------------------------------------------------

/// A base revision the file does not hold refuses before an edit is planned,
/// and writes nothing.
#[test]
fn a_stale_base_revision_refuses_and_writes_nothing() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let stale = ContentRevision::of_bytes(b"something else entirely");

    let error = save(
        &target,
        stale,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("a stale revision refuses");

    match &error {
        SaveError::RevisionMismatch {
            expected, found, ..
        } => {
            assert_eq!(*expected, stale);
            assert_eq!(*found, before, "the refusal says what the file holds");
        }
        other => panic!("expected a revision mismatch, got {other}"),
    }
    assert_refused_without_writing(&target, before, &error, "a stale base revision");
} // End of function a_stale_base_revision_refuses_and_writes_nothing()

// ---------------------------------------------------------------------------
// 3. Steps 3 and 4 — the patch gate
// ---------------------------------------------------------------------------

/// A candidate that would not be valid YAML refuses at step 4, and writes
/// nothing.
///
/// **This is the only route from a public edit to a candidate that does not
/// parse that has been found.** A sweep of 16,081 adversarial edits over the
/// synthetic corpus — twelve hostile scalar values, eight hostile insertion
/// keys, a removal and four moves at every addressable node — produced exactly
/// two, both of them this shape: a block scalar re-emitted at the indentation
/// this crate writes, with a comment below it at the *fixture's* shallower
/// column. `docs/decisions/2a-2b-notes.md` section 7 records that as a hole,
/// because a gate reachable by one shape is a gate this file can only test with
/// that shape.
#[test]
fn a_candidate_that_would_not_parse_refuses_at_the_syntax_gate_and_writes_nothing() {
    let (_directory, target) = fixture(BLOCK_BODY_AT_COLUMN_FIVE);
    let before = revision_on_disk(&target);

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[1].replace", "\n\n\n")],
        &Acknowledgement::none(),
    )
    .expect_err("a candidate that does not parse refuses");

    let failure = error
        .syntax_gate_failure()
        .unwrap_or_else(|| panic!("expected the syntax gate's own answer, got {error}"));
    assert!(
        matches!(
            failure,
            espansoconfig_core::patch::VerificationFailure::DoesNotParse(_)
        ),
        "the syntax gate refused because the candidate did not parse: {failure}"
    );
    assert_refused_without_writing(&target, before, &error, "a candidate that does not parse");
} // End of function a_candidate_that_would_not_parse_refuses_at_the_syntax_gate_and_writes_nothing()

/// A target that is not valid YAML refuses before any edit is planned.
///
/// The same parser, asked at the other end: `apply_edits` parses the source
/// first, so a file the substrate rejects can never be patched. The file is
/// left exactly as it is, which is what lets the raw viewer keep showing it.
#[test]
fn a_target_that_is_not_valid_yaml_refuses_before_any_edit_is_planned() {
    let (_directory, target) = fixture(NOT_YAML);
    let before = revision_on_disk(&target);

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("an unparsable target refuses");

    assert!(
        matches!(&error, SaveError::Patch(EditError::SourceDoesNotParse(_))),
        "expected the source-side parse failure, got {error}"
    );
    assert!(
        error.syntax_gate_failure().is_none(),
        "the candidate's gate is a different question from the source's"
    );
    assert_refused_without_writing(&target, before, &error, "a target that is not valid YAML");
} // End of function a_target_that_is_not_valid_yaml_refuses_before_any_edit_is_planned()

/// An edit whose path names nothing refuses at step 3, and writes nothing.
#[test]
fn an_edit_that_names_nothing_refuses_and_writes_nothing() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[9].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("an unresolvable path refuses");

    assert!(
        matches!(&error, SaveError::Patch(EditError::Unresolvable { .. })),
        "expected a planning failure, got {error}"
    );
    assert_refused_without_writing(&target, before, &error, "an edit that names nothing");
}

// ---------------------------------------------------------------------------
// 4. Step 5 — the semantic gate and the blocking policy
// ---------------------------------------------------------------------------

/// A candidate carrying an `EditorModelError` refuses, and writes nothing.
#[test]
fn an_editor_model_error_in_the_candidate_refuses_and_writes_nothing() {
    let (_directory, target) = fixture(COMPILING_REGEX);
    let before = revision_on_disk(&target);

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[0].regex", "[unclosed")],
        &Acknowledgement::none(),
    )
    .expect_err("an editor-model error refuses");

    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);
    assert_eq!(
        refusal
            .findings
            .iter()
            .filter(|finding| finding.class() == FindingClass::EditorModelError)
            .count(),
        1,
        "the refusal carries the finding it is about"
    );
    assert_eq!(error.findings().len(), refusal.findings.len());
    assert_refused_without_writing(&target, before, &error, "an editor-model error");
} // End of function an_editor_model_error_in_the_candidate_refuses_and_writes_nothing()

/// Acknowledging an editor-model error is not a way past it.
///
/// The refusal's own findings are handed straight back as the acknowledgement,
/// which is the strongest form a caller could construct, and the verdict does
/// not move. This is the half of the policy that has no override.
#[test]
fn an_editor_model_error_cannot_be_acknowledged_past() {
    let (_directory, target) = fixture(COMPILING_REGEX);
    let before = revision_on_disk(&target);
    let edits = [scalar_edit("matches[0].regex", "[unclosed")];

    let first = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("the first attempt refuses");
    let acknowledgement = Acknowledgement::of(first.findings());
    assert!(
        acknowledgement.is_empty(),
        "an editor-model error is dropped at construction, so nothing is acknowledged"
    );

    let second =
        save(&target, before, &edits, &acknowledgement).expect_err("the second attempt refuses");
    assert!(matches!(
        &second,
        SaveError::Refused(refusal) if refusal.verdict == SaveVerdict::RefusedForEditorModelErrors
    ));
    assert_refused_without_writing(
        &target,
        before,
        &second,
        "an acknowledged editor-model error",
    );
} // End of function an_editor_model_error_cannot_be_acknowledged_past()

/// A refusal is a refusal of **this save**, never of the file.
///
/// The document arrives already carrying the finding, and a save that *removes*
/// it is accepted. Without this the policy would lock a user out of repairing a
/// document the visual editor can repair.
#[test]
fn a_save_that_removes_the_editor_model_error_is_accepted() {
    let (_directory, target) = fixture(BROKEN_REGEX);
    let before = revision_on_disk(&target);

    // It really is broken to begin with: an unrelated edit is refused.
    let error = save(
        &target,
        before,
        &[scalar_edit("matches[1].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("an unrelated edit leaves the finding standing");
    assert_refused_without_writing(&target, before, &error, "a pre-existing editor-model error");

    // The edit that removes it is accepted.
    let saved = save(
        &target,
        before,
        &[scalar_edit("matches[0].regex", "hello")],
        &Acknowledgement::none(),
    )
    .expect("repairing the document is accepted");
    assert!(saved.committed);
    assert!(saved.findings.is_empty());
} // End of function a_save_that_removes_the_editor_model_error_is_accepted()

/// A suspicion refuses without an acknowledgement, and writes nothing.
#[test]
fn an_unacknowledged_suspicion_refuses_and_writes_nothing() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[0].replace", "hello {{nobody}}")],
        &Acknowledgement::none(),
    )
    .expect_err("an unacknowledged suspicion refuses");

    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert!(refusal
        .findings
        .iter()
        .all(|finding| finding.class() == FindingClass::SuspiciousButPermitted));
    assert_refused_without_writing(&target, before, &error, "an unacknowledged suspicion");
} // End of function an_unacknowledged_suspicion_refuses_and_writes_nothing()

/// Acknowledged, the same save proceeds — **and hands the findings back**, so a
/// save that proceeded past something can say what it proceeded past.
#[test]
fn an_acknowledged_suspicion_is_committed_and_the_findings_come_back() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [scalar_edit("matches[0].replace", "hello {{nobody}}")];

    let refused =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the first attempt");
    let acknowledgement = Acknowledgement::of(refused.findings());
    assert_eq!(acknowledgement.len(), 1);

    let saved =
        save(&target, before, &edits, &acknowledgement).expect("the second attempt commits");
    assert!(saved.committed);
    assert_eq!(
        saved.findings,
        refused.findings(),
        "the save reports what it proceeded past"
    );
    assert!(saved
        .findings
        .iter()
        .all(|finding| finding.class() == FindingClass::SuspiciousButPermitted));
    assert_eq!(
        std::fs::read_to_string(&target).expect("readable"),
        saved.text
    );
} // End of function an_acknowledged_suspicion_is_committed_and_the_findings_come_back()

/// **Two equal suspicions need two acknowledgements**, or the second one is
/// never shown to anyone.
///
/// `validate` reports an unresolved reference once per occurrence, and each
/// finding records the whole scalar's span, node and path rather than the
/// occurrence's — so a scalar holding `{{who}}` twice produces two findings that
/// are equal in every field. A set-style membership test cannot tell them apart,
/// and an acknowledgement of one occurrence would silently cover both.
#[test]
fn two_equal_suspicions_are_not_covered_by_one_acknowledgement() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [scalar_edit(
        "matches[0].replace",
        "hi {{who}} and again {{who}}",
    )];

    let refused =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the first attempt");
    let findings = refused.findings().to_vec();
    assert_eq!(findings.len(), 2, "one finding per occurrence");
    assert_eq!(
        findings[0], findings[1],
        "the two findings really are equal, which is what makes this about multiplicity"
    );

    let one = Acknowledgement::of(&findings[..1]);
    assert_eq!(one.len(), 1);
    let error = save(&target, before, &edits, &one)
        .expect_err("one acknowledgement cannot cover two suspicions");
    assert!(matches!(
        &error,
        SaveError::Refused(refusal)
            if refusal.verdict == SaveVerdict::RefusedForUnacknowledgedSuspicions
    ));
    assert_refused_without_writing(&target, before, &error, "a half acknowledgement");

    let both = Acknowledgement::of(&findings);
    assert_eq!(both.len(), 2);
    let saved = save(&target, before, &edits, &both).expect("both acknowledged commits");
    assert!(saved.committed);
    assert_eq!(saved.findings.len(), 2);
} // End of function two_equal_suspicions_are_not_covered_by_one_acknowledgement()

/// An acknowledgement taken against one candidate does not cover another.
///
/// The user agreed to save past `{{nobody}}`; the batch that is actually
/// submitted references `{{somebody}}`. Nothing was silently ignored.
#[test]
fn an_acknowledgement_from_a_different_candidate_does_not_carry() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);

    let shown = save(
        &target,
        before,
        &[scalar_edit("matches[0].replace", "hello {{nobody}}")],
        &Acknowledgement::none(),
    )
    .expect_err("the first attempt");
    let acknowledgement = Acknowledgement::of(shown.findings());

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[0].replace", "hello {{somebody}}")],
        &acknowledgement,
    )
    .expect_err("a different candidate is not covered");
    assert!(matches!(
        &error,
        SaveError::Refused(refusal)
            if refusal.verdict == SaveVerdict::RefusedForUnacknowledgedSuspicions
    ));
    assert_refused_without_writing(&target, before, &error, "a stale acknowledgement");
} // End of function an_acknowledgement_from_a_different_candidate_does_not_carry()

/// A duplicate's first attempt is refused with the operation-specific
/// suspicion, and the acknowledged retry commits — Phase 2c-3c-1's finding,
/// proved reachable here because `validate` cannot reach it.
///
/// The finding is attached to the **clone's** candidate address: the path is
/// the slot after the source, and the span and node are the clone's own in the
/// candidate's fresh parse. The second attempt recomputes an identical finding
/// from the identical candidate, so `Acknowledgement::covers_all`'s exact
/// multiset match is the whole round trip — no new machinery.
#[test]
fn a_duplicate_refuses_with_its_trigger_finding_until_it_is_acknowledged() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let source_path = DocumentPath::parse("matches[0]").expect("the test's own path parses");
    let edits = [DocumentEdit::DuplicateItem(DuplicateItem::new(source_path))];

    let refused =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the first attempt");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_eq!(
        refusal.findings.len(),
        1,
        "one finding, the duplicate's own"
    );
    let finding = &refusal.findings[0];
    assert!(
        matches!(
            finding.code,
            FindingCode::DuplicateKeepsTriggerDefinition { .. }
        ),
        "{:?}",
        finding.code
    );
    assert_eq!(
        finding.path,
        Some(DocumentPath::parse("matches[1]").expect("the clone's path parses")),
        "the finding is attached to the clone, in the slot after the source"
    );
    assert!(finding.span.is_some(), "the clone's bytes are named");
    assert!(finding.node.is_some(), "the clone's node is named");
    assert_refused_without_writing(&target, before, &refused, "an unacknowledged duplicate");

    let acknowledgement = Acknowledgement::of(&refusal.findings);
    assert_eq!(acknowledgement.len(), 1);
    let saved = save(&target, before, &edits, &acknowledgement).expect("the retry commits");
    assert!(saved.committed);
    assert_eq!(
        saved.text,
        "matches:\n  - trigger: ':one'\n    replace: 'first'\n  - trigger: ':one'\n    \
         replace: 'first'\n  - trigger: ':two'\n    replace: 'second'\n",
        "the clone is byte-exact and lands immediately after its source"
    );
    assert_eq!(
        saved.findings, refusal.findings,
        "the save reports what it proceeded past"
    );
    assert_eq!(
        std::fs::read_to_string(&target).expect("readable"),
        saved.text
    );
} // End of function a_duplicate_refuses_with_its_trigger_finding_until_it_is_acknowledged()

/// Consent for one candidate must not commit a byte-different clone on a later
/// revision — the Phase 2c-3c-1 review's finding 1, closed by the finding's
/// `revision` operand.
///
/// The construction is the review's own: the source trigger is rewritten to a
/// different value of the **same byte length**, so the new candidate's clone has
/// the same path, the same span and the same freshly minted parser node number.
/// Path, span and node therefore bind consent to a *shape*, and only the
/// candidate's own `ContentRevision` in the code tells the two texts apart.
#[test]
fn a_duplicate_acknowledgement_does_not_transfer_across_a_same_length_rewrite() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let source_path = DocumentPath::parse("matches[0]").expect("the test's own path parses");
    let edits = [DocumentEdit::DuplicateItem(DuplicateItem::new(source_path))];

    let shown =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the first attempt");
    let acknowledgement = Acknowledgement::of(shown.findings());
    assert_eq!(acknowledgement.len(), 1);

    // The file moves on: same position, same byte length, different trigger.
    let rewritten = CLEAN.replace("':one'", "':uno'");
    assert_eq!(
        rewritten.len(),
        CLEAN.len(),
        "the rewrite must preserve every offset, or the span would differ anyway"
    );
    std::fs::write(&target, rewritten.as_bytes()).expect("the rewrite lands");
    let moved_on = revision_on_disk(&target);
    assert_ne!(moved_on, before);

    let error = save(&target, moved_on, &edits, &acknowledgement)
        .expect_err("consent collected for the ':one' clone must not commit the ':uno' clone");
    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_refused_without_writing(&target, moved_on, &error, "a transferred acknowledgement");

    // The review's premise, asserted rather than assumed: the two findings
    // agree in path, span and node, and differ — so the operand is the one
    // thing doing the binding.
    let first = &shown.findings()[0];
    let second = &refusal.findings[0];
    assert_eq!(first.path, second.path);
    assert_eq!(first.span, second.span);
    assert_eq!(first.node, second.node);
    assert_ne!(
        first, second,
        "the candidate revision operand is what tells the two candidates apart"
    );
} // End of function a_duplicate_acknowledgement_does_not_transfer_across_a_same_length_rewrite()

/// A duplicated item that is not a match owes no trigger warning at all.
///
/// The clone's path names an item of `triggers`, which no `MatchView` occupies,
/// so the save commits on the first attempt with no finding — the suspicion is
/// about a match keeping a trigger definition, and nothing here is a match.
#[test]
fn a_duplicate_of_a_non_match_item_commits_without_a_finding() {
    let source = "matches:\n  - triggers:\n      - ':a'\n      - ':b'\n    replace: 'x'\n";
    let (_directory, target) = fixture(source);
    let before = revision_on_disk(&target);
    let path = DocumentPath::parse("matches[0].triggers[0]").expect("the path parses");
    let edits = [DocumentEdit::DuplicateItem(DuplicateItem::new(path))];

    let saved = save(&target, before, &edits, &Acknowledgement::none())
        .expect("no match, no trigger warning, no refusal");
    assert!(saved.committed);
    assert!(saved.findings.is_empty());
    assert_eq!(
        saved.text,
        "matches:\n  - triggers:\n      - ':a'\n      - ':a'\n      - ':b'\n    replace: 'x'\n"
    );
} // End of function a_duplicate_of_a_non_match_item_commits_without_a_finding()

/// When the source has no trigger form, the editor-model finding wins and the
/// duplicate suspicion deliberately stays silent.
///
/// The candidate holds the missing-trigger finding twice — once for the source
/// and once for the clone — and `verdict` refuses for the error class, which no
/// acknowledgement can pass. Producing the suspicion beside it would weaken
/// nothing and claim nothing; it is simply not produced.
#[test]
fn a_duplicate_of_a_triggerless_match_is_refused_for_the_model_error_alone() {
    let source = "matches:\n  - replace: 'x'\n  - trigger: ':two'\n    replace: 'second'\n";
    let (_directory, target) = fixture(source);
    let before = revision_on_disk(&target);
    let path = DocumentPath::parse("matches[0]").expect("the path parses");
    let edits = [DocumentEdit::DuplicateItem(DuplicateItem::new(path))];

    let error =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the model error wins");
    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);
    assert_eq!(
        refusal
            .findings
            .iter()
            .filter(|finding| matches!(finding.code, FindingCode::MatchHasNoTriggerField))
            .count(),
        2,
        "the missing trigger is reported for the source and for the clone"
    );
    assert!(
        !refusal.findings.iter().any(|finding| matches!(
            finding.code,
            FindingCode::DuplicateKeepsTriggerDefinition { .. }
        )),
        "the suspicion must not appear beside the error it defers to"
    );
    assert_refused_without_writing(&target, before, &error, "a triggerless duplicate");
} // End of function a_duplicate_of_a_triggerless_match_is_refused_for_the_model_error_alone()

// ---------------------------------------------------------------------------
// 5b. The creation's own suspicion — Phase 2c-4c-1
// ---------------------------------------------------------------------------

/// One insertion of `new_match`'s fields into `matches` at `placement`.
///
/// It **reconstructs** the lowering `create_one_match` performs in
/// `src-tauri/src/commands.rs` — exactly one `InsertItem` carrying
/// `NewMatch::fields()` and nothing else — and reconstructing is not crossing.
/// What every test below measures is what the save transaction does with such a
/// batch, which is this file's subject; **it is not evidence about
/// `create_match`**, because a change to that command's own lowering could not
/// fail any of them. That claim needs a test that starts at the command, and it
/// is `an_ordinary_creation_carries_six_fields_and_reports_a_repeated_trigger` in
/// `src-tauri/src/commands.rs` (the 2c-4c-1 review's finding 2).
fn creation(new_match: &NewMatch, placement: ItemPlacement) -> DocumentEdit {
    DocumentEdit::InsertItem(InsertItem::at(
        DocumentPath::parse("matches").expect("the test's own path parses"),
        placement,
        new_match.fields(),
    ))
} // End of function creation()

/// A `NewMatch` holding only the two mandatory fields.
fn new_match(trigger: &str, replace: &str) -> NewMatch {
    NewMatch {
        trigger: trigger.to_owned(),
        replace: replace.to_owned(),
        label: None,
        word: None,
        left_word: None,
        right_word: None,
    }
} // End of function new_match()

/// An ordinary creation whose trigger repeats one already in the list is
/// refused with the creation's own suspicion, and the acknowledged retry
/// commits — Phase 2c-4c-1's finding, proved reachable here because `validate`
/// cannot reach it.
///
/// **The batch is the shape an ordinary `create_match` lowers to** — one
/// `InsertItem`, two fields — rather than a recovery-shaped one. Exact repetition
/// is a property of the candidate rather than of the caller that built it, so the
/// finding reaching ordinary creation is the design and not a side effect. That
/// the *command* really lowers to this shape is not asserted here and cannot be
/// (see `creation`'s own note); it is asserted in `src-tauri/src/commands.rs`.
#[test]
fn a_creation_that_repeats_a_literal_trigger_refuses_until_it_is_acknowledged() {
    let (directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [creation(
        &new_match(":one", "another body"),
        ItemPlacement::End,
    )];

    let refused =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the first attempt");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_eq!(
        refusal.findings.len(),
        1,
        "one finding, the creation's own: {:?}",
        refusal.findings
    );
    let finding = &refusal.findings[0];
    assert!(
        matches!(
            finding.code,
            FindingCode::NewMatchRepeatsLiteralTrigger { .. }
        ),
        "{:?}",
        finding.code
    );
    assert_eq!(
        finding.path,
        Some(DocumentPath::parse("matches[2]").expect("the new item's path parses")),
        "the finding is attached to the item the insertion landed"
    );
    assert!(finding.span.is_some(), "the new item's bytes are named");
    assert!(finding.node.is_some(), "the new item's node is named");
    assert_refused_without_writing(&target, before, &refused, "an unacknowledged creation");

    // The round trip: the findings go back exactly as they arrived, and the
    // same creation proceeds. No force flag exists, and none is needed.
    let acknowledgement = Acknowledgement::of(&refusal.findings);
    assert_eq!(acknowledgement.len(), 1);
    let saved = save(&target, before, &edits, &acknowledgement).expect("the retry commits");
    assert!(saved.committed);
    assert_eq!(
        saved.findings, refusal.findings,
        "the save reports what it proceeded past"
    );

    // Byte identity outside the insertion span, re-derived from the replacement
    // list rather than from the candidate.
    let on_disk = std::fs::read_to_string(&target).expect("the file is readable");
    assert_eq!(on_disk, saved.text, "the file holds exactly the candidate");
    assert_eq!(saved.replacements.len(), 1);
    let span = saved.replacements[0].span;
    assert_eq!(
        &on_disk[..span.start],
        &CLEAN[..span.start],
        "every byte before the insertion is the source's own"
    );
    assert_eq!(
        &on_disk[span.start + saved.replacements[0].text.len()..],
        &CLEAN[span.end..],
        "every byte after the insertion is the source's own"
    );
    assert!(
        on_disk.starts_with(CLEAN),
        "an insertion at the end leaves the whole original in front of it"
    );
    assert_eq!(
        std::fs::read_dir(directory.path())
            .expect("the directory is readable")
            .count(),
        1,
        "no temp file survives a success"
    );
} // End of function a_creation_that_repeats_a_literal_trigger_refuses_until_it_is_acknowledged()

/// A creation whose trigger is not already in the list commits on the first
/// attempt, with no finding at all.
///
/// The other half of the pair: without it, a suspicion produced for *every*
/// creation would pass the test above.
#[test]
fn a_creation_with_a_trigger_nobody_else_uses_commits_without_a_finding() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [creation(
        &new_match(":three", "a third body"),
        ItemPlacement::End,
    )];

    let saved = save(&target, before, &edits, &Acknowledgement::none())
        .expect("a fresh trigger is not a suspicion");
    assert!(saved.committed);
    assert!(
        saved.findings.is_empty(),
        "no finding: {:?}",
        saved.findings
    );
    assert!(saved.text.starts_with(CLEAN));
} // End of function a_creation_with_a_trigger_nobody_else_uses_commits_without_a_finding()

/// A trigger that merely *overlaps* another is not a repetition, and this
/// application makes no claim about it.
///
/// The comparison is exact string equality of decoded text and nothing else.
/// Reporting `:one` and `:oneself` would be a claim about how espanso matches
/// overlapping abbreviations, which D2u forbids — and staying silent is **not**
/// a claim that the pair is safe, which is why the dictionary sentence never
/// says so.
#[test]
fn a_trigger_that_only_overlaps_another_produces_no_finding() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [creation(
        &new_match(":oneself", "a longer trigger"),
        ItemPlacement::End,
    )];

    let saved = save(&target, before, &edits, &Acknowledgement::none())
        .expect("an overlap is not an exact repetition");
    assert!(saved.committed);
    assert!(saved.findings.is_empty(), "{:?}", saved.findings);
} // End of function a_trigger_that_only_overlaps_another_produces_no_finding()

/// The finding names the slot the insertion actually landed, for each of the
/// three placements.
///
/// This is what pins the index derivation for the batch every caller in
/// `src-tauri/` actually builds: one insertion and nothing else. The new item is
/// found through `espansoconfig_core::patch::insertion_landings`, so a
/// derivation that answered *end* for a *front* insertion would inspect a
/// pre-existing item and attach the finding to the wrong address — which is
/// exactly what this asserts cannot happen. The **mixed** batches, where the
/// placement alone stops being enough, are the four cases above.
#[test]
fn the_finding_names_the_slot_the_insertion_landed_for_every_placement() {
    let cases = [
        (ItemPlacement::Front, ":two", "matches[0]"),
        (ItemPlacement::After(0), ":one", "matches[1]"),
        (ItemPlacement::End, ":one", "matches[2]"),
    ];
    for (placement, trigger, expected) in cases {
        let (_directory, target) = fixture(CLEAN);
        let before = revision_on_disk(&target);
        let edits = [creation(&new_match(trigger, "a body"), placement)];

        let refused = save(&target, before, &edits, &Acknowledgement::none())
            .expect_err("a repeated trigger is refused wherever it lands");
        let refusal = match &refused {
            SaveError::Refused(refusal) => refusal,
            other => panic!("expected the semantic gate, got {other}"),
        };
        assert_eq!(refusal.findings.len(), 1, "{:?}", refusal.findings);
        assert!(matches!(
            refusal.findings[0].code,
            FindingCode::NewMatchRepeatsLiteralTrigger { .. }
        ));
        assert_eq!(
            refusal.findings[0].path,
            Some(DocumentPath::parse(expected).expect("the test's own path parses")),
            "a {placement:?} insertion lands at {expected}"
        );
    } // End of the loop over the three placements
} // End of function the_finding_names_the_slot_the_insertion_landed_for_every_placement()

/// Four matches, the last of which repeats no trigger — the fixture the mixed
/// insert/remove batches below shift around.
///
/// Hand-authored and neutral (`CLAUDE.md` section 1).
const FOUR_ITEMS: &str = concat!(
    "matches:\n",
    "  - trigger: ':a'\n",
    "    replace: 'first'\n",
    "  - trigger: ':b'\n",
    "    replace: 'second'\n",
    "  - trigger: ':c'\n",
    "    replace: 'third'\n",
    "  - trigger: ':d'\n",
    "    replace: 'fourth'\n",
);

/// One removal of `matches[index]`.
fn removal(index: usize) -> DocumentEdit {
    DocumentEdit::RemoveItem(RemoveItem::new(
        DocumentPath::parse(&format!("matches[{index}]")).expect("the test's own path parses"),
    ))
} // End of function removal()

/// Every `NewMatchRepeatsLiteralTrigger` in a list of findings, in order.
fn repetitions(findings: &[Finding]) -> Vec<&Finding> {
    findings
        .iter()
        .filter(|finding| {
            matches!(
                finding.code,
                FindingCode::NewMatchRepeatsLiteralTrigger { .. }
            )
        })
        .collect()
} // End of function repetitions()

/// The path a finding names, as this file spells one.
fn at(path: &str) -> Option<DocumentPath> {
    Some(DocumentPath::parse(path).expect("the test's own path parses"))
} // End of function at()

/// A removal **above** the anchor must not make the finding fire against an
/// existing item — the 2c-4c-1 review's finding 1, as its own scenario.
///
/// `apply_edits` accepts mixed batches and folds every claim about one sequence
/// into one ordered expectation, so a removal above the insertion shifts the
/// arrival left. The address derived from the placement and the candidate's
/// length alone would look one slot too high — at an item that was there all
/// along — and here that item repeats *another* pre-existing item's trigger
/// while the new one repeats nothing. The old derivation reported the repetition
/// of two items the caller never touched, against a new snippet whose trigger is
/// unique.
///
/// The premise is asserted rather than assumed: the committed text really is
/// `[:same, :fresh, :same]`, so the new item really did land at index 1 while
/// the sequence holds three.
#[test]
fn a_removal_above_the_insertion_does_not_report_an_existing_item() {
    let source = concat!(
        "matches:\n",
        "  - trigger: ':gone'\n",
        "    replace: 'first'\n",
        "  - trigger: ':same'\n",
        "    replace: 'second'\n",
        "  - trigger: ':same'\n",
        "    replace: 'third'\n",
    );
    let (_directory, target) = fixture(source);
    let before = revision_on_disk(&target);
    let edits = [
        creation(&new_match(":fresh", "a body"), ItemPlacement::After(1)),
        removal(0),
    ];

    let saved = save(&target, before, &edits, &Acknowledgement::none())
        .expect("a unique new trigger is not a repetition, whatever else the batch does");
    assert!(saved.committed);
    assert!(
        repetitions(&saved.findings).is_empty(),
        "the finding may fire only when the **new** item repeats: {:?}",
        saved.findings
    );
    assert_eq!(
        saved.text,
        concat!(
            "matches:\n",
            "  - trigger: ':same'\n",
            "    replace: 'second'\n",
            "  - trigger: ':fresh'\n",
            "    replace: a body\n",
            "  - trigger: ':same'\n",
            "    replace: 'third'\n",
        ),
        "the premise: the new item lands at index 1 of a three-item list, and the two \
         items that repeat each other are the ones that were there already"
    );
} // End of function a_removal_above_the_insertion_does_not_report_an_existing_item()

/// A removal above the anchor shifts the address the finding reports, and the
/// finding follows it.
///
/// The other direction of the case above: here the new trigger really does
/// repeat one already present, so the finding must be produced — at the slot the
/// item took **after** the removal, not at the one the placement names.
#[test]
fn a_removal_above_the_anchor_shifts_the_address_the_finding_names() {
    let (_directory, target) = fixture(FOUR_ITEMS);
    let before = revision_on_disk(&target);
    let edits = [
        creation(&new_match(":d", "a body"), ItemPlacement::After(2)),
        removal(0),
    ];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("the new trigger repeats `:d`, which survives the removal");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    let reported = repetitions(&refusal.findings);
    assert_eq!(reported.len(), 1, "{:?}", refusal.findings);
    assert_eq!(
        reported[0].path,
        at("matches[2]"),
        "one item was removed above the anchor, so the arrival is at 2 rather than 3"
    );
    assert_refused_without_writing(&target, before, &refused, "a mixed insert/remove batch");
} // End of function a_removal_above_the_anchor_shifts_the_address_the_finding_names()

/// A removal **below** the anchor leaves the address alone.
///
/// The second side the review asked for. Nothing above the arrival changes, so
/// the index is the one the placement's own arithmetic gives — and the candidate
/// is one item shorter than the original, which is exactly the length the old
/// derivation would have read as "one fewer item above me".
#[test]
fn a_removal_below_the_anchor_leaves_the_address_alone() {
    let (_directory, target) = fixture(FOUR_ITEMS);
    let before = revision_on_disk(&target);
    let edits = [
        creation(&new_match(":c", "a body"), ItemPlacement::After(0)),
        removal(3),
    ];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("the new trigger repeats `:c`, which is below the arrival and survives");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    let reported = repetitions(&refusal.findings);
    assert_eq!(reported.len(), 1, "{:?}", refusal.findings);
    assert_eq!(
        reported[0].path,
        at("matches[1]"),
        "the removal is below the arrival, so it moves nothing above it"
    );
    assert_refused_without_writing(&target, before, &refused, "a mixed insert/remove batch");
} // End of function a_removal_below_the_anchor_leaves_the_address_alone()

/// Two insertions in one batch are each located and each reported.
///
/// **This was an under-report by construction until the 2c-4c-1 review**: the
/// inspection ran only for a batch holding exactly one insertion, because the
/// address was derived from the candidate's own length. It is now derived from
/// the whole batch, so every insertion is located — the front one at 0, the end
/// one at 3 — and each is judged against the list the person would be left with.
#[test]
fn two_insertions_in_one_batch_are_each_located_and_each_reported() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [
        creation(&new_match(":one", "a body"), ItemPlacement::Front),
        creation(&new_match(":two", "another body"), ItemPlacement::End),
    ];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("both new triggers repeat one already in the list");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    let reported = repetitions(&refusal.findings);
    assert_eq!(reported.len(), 2, "{:?}", refusal.findings);
    assert_eq!(
        reported
            .iter()
            .map(|finding| &finding.path)
            .collect::<Vec<_>>(),
        vec![&at("matches[0]"), &at("matches[3]")],
        "in batch order: the front insertion landed at 0 and the end one at 3"
    );
    assert_refused_without_writing(&target, before, &refused, "a two-insertion batch");

    // The exact-multiset round trip holds for two findings as it does for one.
    let saved = save(
        &target,
        before,
        &edits,
        &Acknowledgement::of(&refusal.findings),
    )
    .expect("the acknowledged retry commits");
    assert!(saved.committed);
    assert_eq!(saved.findings, refusal.findings);
} // End of function two_insertions_in_one_batch_are_each_located_and_each_reported()

/// An edit that changes no sequence's cardinality moves no address.
///
/// The complement of the two mixed cases above, and the reason the landing is
/// derived from the batch rather than refused for it: a scalar edit beside an
/// insertion is a batch `apply_edits` accepts and one this finding must still be
/// correct for. Only [`espansoconfig_core::patch::InsertItem`] and
/// `RemoveItem` change how many items a sequence holds — a move and a duplicate
/// are each refused unless they are alone in their batch.
#[test]
fn a_scalar_edit_beside_the_insertion_moves_no_address() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [
        scalar_edit("matches[0].replace", NEW_VALUE),
        creation(&new_match(":one", "a body"), ItemPlacement::End),
    ];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("the new trigger repeats `:one`");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    let reported = repetitions(&refusal.findings);
    assert_eq!(reported.len(), 1, "{:?}", refusal.findings);
    assert_eq!(reported[0].path, at("matches[2]"));
} // End of function a_scalar_edit_beside_the_insertion_moves_no_address()

/// A `matches` entry that is not a mapping still occupies its slot, so the
/// index derivation is unaffected by it.
///
/// This is the precedent `create_one_match` records, asserted here rather than
/// inherited: the projection gives such an entry one `MatchView`, recorded by
/// span and not descended into, so counting the projection's matches for a
/// sequence is counting the sequence's own items. If it did not, the count
/// before this insertion would be one too low, the new item would be looked for
/// one slot too high, and this creation would report nothing.
#[test]
fn a_matches_entry_that_is_not_a_mapping_still_occupies_its_slot() {
    let source = "matches:\n  - trigger: ':one'\n    replace: 'first'\n  - 'not a mapping'\n";
    let (_directory, target) = fixture(source);
    let before = revision_on_disk(&target);
    let edits = [creation(&new_match(":one", "a body"), ItemPlacement::End)];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("the repeated trigger is found at the slot the insertion landed");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    let repetition: Vec<&_> = refusal
        .findings
        .iter()
        .filter(|finding| {
            matches!(
                finding.code,
                FindingCode::NewMatchRepeatsLiteralTrigger { .. }
            )
        })
        .collect();
    assert_eq!(repetition.len(), 1, "{:?}", refusal.findings);
    assert_eq!(
        repetition[0].path,
        Some(DocumentPath::parse("matches[2]").expect("the test's own path parses")),
        "the non-mapping entry occupies slot 1, so the new item lands at 2"
    );
} // End of function a_matches_entry_that_is_not_a_mapping_still_occupies_its_slot()

/// A `regex` trigger makes no semantic claim, in either direction.
///
/// Two halves, because the silence has to hold on both sides of the comparison:
/// a new item written as a `regex` exposes no literal trigger text, and an
/// existing `regex` whose pattern happens to read like a new item's literal
/// trigger is not literal trigger text either. Deciding that a pattern and an
/// abbreviation are "the same trigger" would be a claim about espanso's matcher.
#[test]
fn a_regex_trigger_produces_no_finding_on_either_side() {
    // The new item is the regex, and its pattern is spelled exactly like the
    // existing literal trigger.
    let existing_literal = "matches:\n  - trigger: 'hello'\n    replace: 'first'\n";
    let (_directory, target) = fixture(existing_literal);
    let before = revision_on_disk(&target);
    let regex_item = DocumentEdit::InsertItem(InsertItem::at(
        DocumentPath::parse("matches").expect("the path parses"),
        ItemPlacement::End,
        vec![
            ("regex".to_owned(), "hello".to_owned()),
            ("replace".to_owned(), "second".to_owned()),
        ],
    ));
    let saved = save(&target, before, &[regex_item], &Acknowledgement::none())
        .expect("a regex trigger is not modelled literal text");
    assert!(saved.committed);
    assert!(saved.findings.is_empty(), "{:?}", saved.findings);

    // The existing item is the regex, and the new literal trigger is spelled
    // exactly like its pattern.
    let existing_regex = "matches:\n  - regex: 'hello'\n    replace: 'first'\n";
    let (_second_directory, second) = fixture(existing_regex);
    let second_before = revision_on_disk(&second);
    let literal_item = [creation(&new_match("hello", "second"), ItemPlacement::End)];
    let saved = save(
        &second,
        second_before,
        &literal_item,
        &Acknowledgement::none(),
    )
    .expect("an existing regex exposes no literal trigger text either");
    assert!(saved.committed);
    assert!(saved.findings.is_empty(), "{:?}", saved.findings);
} // End of function a_regex_trigger_produces_no_finding_on_either_side()

/// A `triggers:` list **is** modelled literal text, so an entry of one is
/// compared like a `trigger:`.
///
/// Excluding it would under-report: a file writing `triggers: [':one', ':alt']`
/// really does already use `:one` as literal trigger text, and a creation
/// repeating it carries exactly the risk this finding is about.
#[test]
fn an_entry_of_a_triggers_list_counts_as_literal_trigger_text() {
    let source = "matches:\n  - triggers:\n      - ':one'\n      - ':alt'\n    replace: 'first'\n";
    let (_directory, target) = fixture(source);
    let before = revision_on_disk(&target);
    let edits = [creation(&new_match(":alt", "a body"), ItemPlacement::End)];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("an entry of a triggers list is trigger text already present");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(refusal.findings.len(), 1, "{:?}", refusal.findings);
    assert!(matches!(
        refusal.findings[0].code,
        FindingCode::NewMatchRepeatsLiteralTrigger { .. }
    ));
    assert_refused_without_writing(&target, before, &refused, "a repeated triggers entry");
} // End of function an_entry_of_a_triggers_list_counts_as_literal_trigger_text()

/// When the new item has no trigger form at all, the editor-model finding wins
/// and the creation suspicion deliberately stays silent.
///
/// The duplicate's own precedence rule, restated for an insertion: a
/// `MatchHasNoTriggerField` is an `EditorModelError`, no acknowledgement gets
/// past it, and producing a suspicion beside it would claim nothing and weaken
/// that precedence.
#[test]
fn a_created_item_with_no_trigger_is_refused_for_the_model_error_alone() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let bodyless = DocumentEdit::InsertItem(InsertItem::at(
        DocumentPath::parse("matches").expect("the path parses"),
        ItemPlacement::End,
        vec![("replace".to_owned(), "a body with no trigger".to_owned())],
    ));

    let error =
        save(&target, before, &[bodyless], &Acknowledgement::none()).expect_err("the model error");
    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);
    assert!(
        refusal
            .findings
            .iter()
            .any(|finding| matches!(finding.code, FindingCode::MatchHasNoTriggerField)),
        "the missing trigger is what refuses this"
    );
    assert!(
        !refusal.findings.iter().any(|finding| matches!(
            finding.code,
            FindingCode::NewMatchRepeatsLiteralTrigger { .. }
        )),
        "the suspicion must not appear beside the error it defers to"
    );
    assert_refused_without_writing(&target, before, &error, "a triggerless creation");
} // End of function a_created_item_with_no_trigger_is_refused_for_the_model_error_alone()

/// When the new item carries **several** trigger forms, the same precedence
/// holds: the model error refuses and the suspicion stays silent.
///
/// The `trigger` here repeats one already in the list, so the only thing keeping
/// the suspicion away is the `Several` arm — which is the point of the case.
#[test]
fn a_created_item_with_several_trigger_forms_is_refused_for_the_model_error_alone() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let ambiguous = DocumentEdit::InsertItem(InsertItem::at(
        DocumentPath::parse("matches").expect("the path parses"),
        ItemPlacement::End,
        vec![
            ("trigger".to_owned(), ":one".to_owned()),
            ("regex".to_owned(), "one".to_owned()),
            ("replace".to_owned(), "a body".to_owned()),
        ],
    ));

    let error =
        save(&target, before, &[ambiguous], &Acknowledgement::none()).expect_err("the model error");
    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);
    assert!(
        refusal
            .findings
            .iter()
            .any(|finding| matches!(finding.code, FindingCode::MatchHasSeveralTriggerForms)),
        "the several forms are what refuses this"
    );
    assert!(
        !refusal.findings.iter().any(|finding| matches!(
            finding.code,
            FindingCode::NewMatchRepeatsLiteralTrigger { .. }
        )),
        "an unmodelled trigger shape produces no semantic claim"
    );
    assert_refused_without_writing(&target, before, &error, "an ambiguous creation");
} // End of function a_created_item_with_several_trigger_forms_is_refused_for_the_model_error_alone()

/// Consent for one candidate must not commit a byte-different one — the
/// duplicate's `revision` operand, transferred at the level of the pattern.
///
/// The construction is the 2c-3c-1 review's own: the file moves on by a rewrite
/// of the **same byte length** above the insertion point, so the new item's
/// path, span and node are all unchanged and only the candidate's own
/// `ContentRevision` tells the two texts apart.
#[test]
fn a_creation_acknowledgement_does_not_transfer_across_a_same_length_rewrite() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let edits = [creation(&new_match(":one", "a body"), ItemPlacement::End)];

    let shown =
        save(&target, before, &edits, &Acknowledgement::none()).expect_err("the first attempt");
    let acknowledgement = Acknowledgement::of(shown.findings());
    assert_eq!(acknowledgement.len(), 1);

    // The file moves on: same length, same offsets, different bytes — and the
    // repeated trigger is still there, so the same suspicion is recomputed.
    let rewritten = CLEAN.replace("'first'", "'firsx'");
    assert_eq!(
        rewritten.len(),
        CLEAN.len(),
        "the rewrite must preserve every offset, or the span would differ anyway"
    );
    assert_ne!(rewritten, CLEAN);
    std::fs::write(&target, rewritten.as_bytes()).expect("the rewrite lands");
    let moved_on = revision_on_disk(&target);
    assert_ne!(moved_on, before);

    let error = save(&target, moved_on, &edits, &acknowledgement)
        .expect_err("consent collected for one candidate must not commit another");
    let refusal = match &error {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_refused_without_writing(&target, moved_on, &error, "a transferred acknowledgement");

    // The premise, asserted rather than assumed: the two findings agree in
    // path, span and node, and differ — so the operand is what binds consent.
    let first = &shown.findings()[0];
    let second = &refusal.findings[0];
    assert_eq!(first.path, second.path);
    assert_eq!(first.span, second.span);
    assert_eq!(first.node, second.node);
    assert_ne!(
        first, second,
        "the candidate revision operand is what tells the two candidates apart"
    );
} // End of function a_creation_acknowledgement_does_not_transfer_across_a_same_length_rewrite()

/// The four optional fields reach the file, in the documented order, and the
/// suspicion is unaffected by their presence.
///
/// **The recovery-shaped creation**, in the only form the core can see one: a
/// six-field `NewMatch` lowered through the same single `InsertItem` an ordinary
/// creation uses. Nothing in the transaction knows which caller built it, which
/// is exactly why the finding reaches both.
#[test]
fn a_six_field_creation_writes_all_six_keys_and_still_reports_the_repetition() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let recovered = NewMatch {
        trigger: ":one".to_owned(),
        replace: "a recovered body".to_owned(),
        label: Some("a recovered label".to_owned()),
        word: Some("true".to_owned()),
        left_word: Some("false".to_owned()),
        right_word: None,
    };
    let edits = [creation(&recovered, ItemPlacement::End)];

    let refused = save(&target, before, &edits, &Acknowledgement::none())
        .expect_err("the repetition is reported whatever else the item holds");
    let refusal = match &refused {
        SaveError::Refused(refusal) => refusal,
        other => panic!("expected the semantic gate, got {other}"),
    };
    assert_eq!(refusal.findings.len(), 1, "{:?}", refusal.findings);
    assert!(matches!(
        refusal.findings[0].code,
        FindingCode::NewMatchRepeatsLiteralTrigger { .. }
    ));

    let saved = save(
        &target,
        before,
        &edits,
        &Acknowledgement::of(&refusal.findings),
    )
    .expect("the retry commits");
    assert!(saved.committed);
    let written = saved
        .text
        .strip_prefix(CLEAN)
        .expect("the whole original is in front of the new item");
    assert_eq!(
        written,
        "  - trigger: ':one'\n    replace: a recovered body\n    label: a recovered label\n    \
         word: 'true'\n    left_word: 'false'\n",
        "the four optional keys are written in order, and the absent one is not written at all; \
         each value's spelling is `choose_scalar`'s decision, which is why `true` is quoted and \
         a sentence is not"
    );
} // End of function a_six_field_creation_writes_all_six_keys_and_still_reports_the_repetition()

/// The semantic gate is run over the **candidate**, not over the original.
///
/// The original is clean and the candidate is not; a gate that validated the
/// original would let this through. Its twin above — a broken original that an
/// edit repairs — is the other direction, and together they fix which document
/// step 5 is about.
#[test]
fn the_semantic_gate_reads_the_candidate_and_not_the_original() {
    let (_directory, target) = fixture(COMPILING_REGEX);
    let before = revision_on_disk(&target);
    let clean_findings = project_source(&context_for(&target), COMPILING_REGEX);
    assert!(
        espansoconfig_core::validate::validate(&clean_findings.view).is_empty(),
        "the original is clean, so only the candidate can produce a finding"
    );

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[0].regex", "[unclosed")],
        &Acknowledgement::none(),
    )
    .expect_err("the candidate is what is validated");
    assert!(matches!(&error, SaveError::Refused(_)));
} // End of function the_semantic_gate_reads_the_candidate_and_not_the_original()

// ---------------------------------------------------------------------------
// 5. Refusals that never reach a gate
// ---------------------------------------------------------------------------

/// A file under `match/packages/` is refused **before the lock is taken**.
///
/// `FileKind::is_read_only`'s doc comment says the editor must refuse to write
/// such a file, and this is the only code in the crate that writes on the
/// editor's behalf, so this is where the sentence becomes true.
#[test]
fn a_package_file_is_refused_before_anything_is_read() {
    let (_directory, target) = fixture(CLEAN);
    let before = revision_on_disk(&target);
    let context = DocumentContext {
        kind: FileKind::Package,
        ..context_for(&target)
    };

    let error = save_document(SaveRequest {
        context: &context,
        base_revision: before,
        content: SaveContent::Edits(&[scalar_edit("matches[0].replace", NEW_VALUE)]),
        acknowledgement: &Acknowledgement::none(),
        backups: None,
    })
    .expect_err("a package file is refused");

    assert!(matches!(&error, SaveError::DocumentIsReadOnly { .. }));
    assert_refused_without_writing(&target, before, &error, "a package file");
} // End of function a_package_file_is_refused_before_anything_is_read()

/// A target whose bytes are not valid UTF-8 is refused with the offset of the
/// first invalid sequence, exactly as reading one is.
#[test]
fn a_target_that_is_not_valid_utf8_refuses_and_writes_nothing() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    let bytes: Vec<u8> = b"matches: \xff\xfe\n".to_vec();
    std::fs::write(&target, &bytes).expect("written");
    let before = ContentRevision::of_bytes(&bytes);

    let error = save(
        &target,
        before,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("invalid UTF-8 refuses");

    match &error {
        SaveError::TargetNotUtf8 { offset, .. } => assert_eq!(*offset, 9),
        other => panic!("expected a UTF-8 refusal, got {other}"),
    }
    assert_refused_without_writing(&target, before, &error, "a target that is not UTF-8");
} // End of function a_target_that_is_not_valid_utf8_refuses_and_writes_nothing()

/// Creates a fifo at `path` with `mkfifo(1)`, or answers `false`.
///
/// Shelling out rather than adding `libc` or `nix` for one test; a platform
/// without `mkfifo` makes the caller skip cleanly.
fn make_fifo(path: &Path) -> bool {
    std::process::Command::new("mkfifo")
        .arg(path)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Runs `work` on another thread and gives it `limit` to finish.
///
/// A timeout rather than a join, because the defect under test is a call that
/// **never returns**: without the fix the save opens the fifo and waits for a
/// writer, and a test that waited with it would hang the suite instead of
/// failing it. The abandoned thread is blocked inside a temp directory of its
/// own and holds nothing another test wants.
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

/// A fifo at the resolved path is refused, **and refused without waiting**.
///
/// The transaction's step-2 read happens with the per-path write lock held. A
/// plain `fs::read` of a fifo blocks until some other process opens it for
/// writing, so a fifo — supplied by a caller's context, or swapped in by another
/// process after the path was resolved — would park the transaction inside the
/// lock indefinitely, and every later save of that path behind it. The read goes
/// through the primitive's own checked open instead, which is `O_NOFOLLOW`,
/// non-blocking, and refuses anything that is not a regular file.
///
/// **The hang itself is not what is asserted here.** What is asserted is the
/// refusal, and that it arrives inside five seconds; the deadlock is what the
/// timeout exists to avoid reproducing.
#[test]
fn a_fifo_at_the_target_is_refused_and_does_not_block_the_lock() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    if !make_fifo(&target) {
        println!("SKIP a_fifo_at_the_target_is_refused_and_does_not_block_the_lock: mkfifo(1) is not available here");
        return;
    }

    let attempted = target.clone();
    let outcome = within(Duration::from_secs(5), move || {
        save(
            &attempted,
            ContentRevision::of_bytes(CLEAN.as_bytes()),
            &[scalar_edit("matches[0].replace", NEW_VALUE)],
            &Acknowledgement::none(),
        )
        .map(|_| "committed to a fifo".to_owned())
        .map_err(|error| format!("{error}"))
    });

    let Some(result) = outcome else {
        panic!(
            "the save is still running after 5 s: it opened the fifo and is waiting for a writer, \
             holding the path lock that every later save of this path needs"
        );
    };
    assert!(
        result.is_err(),
        "a fifo is not a document: {}",
        result.unwrap_or_default()
    );

    // The variant, checked on a second call now that the first is known to
    // return. The lock is free, which is itself the property under test.
    let error = save(
        &target,
        ContentRevision::of_bytes(CLEAN.as_bytes()),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("a fifo is refused");
    assert!(
        matches!(
            &error,
            SaveError::Target(WriteError::TargetNotRegularFile { .. })
        ),
        "expected the primitive's own refusal, got {error}"
    );
    assert!(error.is_refusal() && !error.may_have_written());
} // End of function a_fifo_at_the_target_is_refused_and_does_not_block_the_lock()

/// A directory at the resolved path is the same refusal, with no platform tool
/// involved.
///
/// The fifo test above needs `mkfifo(1)` and skips without it; this one is the
/// part of the same property that always runs. Both are the regular-file check
/// the transaction gained by reading through the primitive's open: without it a
/// directory is an unclassified `Io` failure at `readTarget`.
#[test]
fn a_directory_at_the_target_is_refused_as_a_non_regular_file() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    std::fs::create_dir(&target).expect("the directory is created");

    let error = save(
        &target,
        ContentRevision::of_bytes(CLEAN.as_bytes()),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("a directory is not a document");

    assert!(
        matches!(
            &error,
            SaveError::Target(WriteError::TargetNotRegularFile { .. })
        ),
        "expected the regular-file refusal, got {error}"
    );
    assert!(error.is_refusal() && !error.may_have_written());
} // End of function a_directory_at_the_target_is_refused_as_a_non_regular_file()

/// A missing target refuses at step 1 and creates nothing. The transaction
/// replaces files and creates none, exactly as the primitive does.
#[test]
fn a_missing_target_refuses_and_creates_nothing() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("absent.yml");

    let error = save(
        &target,
        ContentRevision::of_bytes(CLEAN.as_bytes()),
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect_err("a missing target refuses");

    assert!(matches!(
        &error,
        SaveError::Target(WriteError::TargetMissing { .. })
    ));
    assert!(error.is_refusal() && !error.may_have_written());
    assert!(!target.exists(), "nothing was created");
    assert_eq!(
        std::fs::read_dir(directory.path())
            .expect("readable")
            .count(),
        0
    );
} // End of function a_missing_target_refuses_and_creates_nothing()

// ---------------------------------------------------------------------------
// 6. The lock
// ---------------------------------------------------------------------------

/// A save waits for a lock another thread holds.
///
/// **This rests on a timing assumption**, stated here rather than hidden: the
/// holder keeps the lock for 300 ms, and a save that took the lock immediately
/// would finish in well under that. A machine so loaded that a two-line write
/// takes longer than 250 ms would make this pass vacuously; there is no way to
/// tell "blocked" from "very slow" without a hook inside the lock, which is the
/// same limitation `tests/persist_write.rs` records.
#[test]
fn a_save_waits_for_a_lock_another_thread_already_holds() {
    let (_directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let barrier = Arc::new(Barrier::new(2));

    let held = {
        let target = target.clone();
        let barrier = Arc::clone(&barrier);
        std::thread::spawn(move || {
            let lock = lock_path(&target).expect("the lock is taken");
            barrier.wait();
            std::thread::sleep(Duration::from_millis(300));
            drop(lock);
        })
    };

    barrier.wait();
    let started = Instant::now();
    let saved = save(
        &target,
        base,
        &[scalar_edit("matches[0].replace", NEW_VALUE)],
        &Acknowledgement::none(),
    )
    .expect("the save commits once the lock is free");
    let waited = started.elapsed();
    held.join().expect("the holder finishes");

    assert!(saved.committed);
    assert!(
        waited >= Duration::from_millis(250),
        "the save must have waited for the lock, but returned after {waited:?}"
    );
} // End of function a_save_waits_for_a_lock_another_thread_already_holds()

/// The source is read **inside** the lock, not before it.
///
/// A save that read the file first and only then queued for the lock would be
/// patching bytes that another cooperating writer has since replaced — the very
/// thing the lock exists to prevent — and it would report a revision mismatch
/// for a revision the file *does* hold by the time it looks.
///
/// The shape is deterministic rather than racy in the direction that matters.
/// The main thread holds the lock and commits `intermediate` while the second
/// thread's save is queued behind it; that save's `base_revision` is
/// `intermediate`'s, which the file does **not** hold when the save is called
/// and **does** hold by the time the lock is free. A transaction that reads
/// inside the lock commits. One that read first sees the pre-commit bytes and
/// refuses.
///
/// **The timing assumption, stated:** the 200 ms sleep is what gives the second
/// thread time to reach its read. It only matters to the *sabotaged* direction —
/// a correct implementation passes whatever the scheduler does — so an unlucky
/// machine weakens the experiment rather than failing the build.
#[test]
fn the_source_is_read_inside_the_lock_and_not_before_it() {
    let (_directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());

    // What the main thread is about to commit, computed here so the queued save
    // can name its revision before it exists on disk.
    let intermediate = espansoconfig_core::patch::apply_scalar_edit(
        CLEAN,
        &DocumentPath::parse("matches[0].replace").expect("the path parses"),
        "written while the lock was held",
    )
    .expect("the intermediate candidate is built")
    .into_text();
    let intermediate_revision = ContentRevision::of_bytes(intermediate.as_bytes());

    let lock = lock_path(&target).expect("the main thread takes the lock");
    let barrier = Arc::new(Barrier::new(2));
    let queued = {
        let target = target.clone();
        let barrier = Arc::clone(&barrier);
        std::thread::spawn(move || {
            barrier.wait();
            save(
                &target,
                intermediate_revision,
                &[scalar_edit("matches[1].replace", "written afterwards")],
                &Acknowledgement::none(),
            )
            .map(|saved| saved.revision)
            .map_err(|error| format!("{error}"))
        })
    };

    barrier.wait();
    std::thread::sleep(Duration::from_millis(200));
    espansoconfig_core::persist::replace_locked_file(&lock, base, intermediate.as_bytes())
        .expect("the main thread commits while holding the lock");
    drop(lock);

    let revision = queued
        .join()
        .expect("the queued save finishes")
        .expect("the queued save must read the bytes the lock protects");
    assert_eq!(revision_on_disk(&target), revision);
    assert_ne!(revision, intermediate_revision, "it wrote its own edit too");
} // End of function the_source_is_read_inside_the_lock_and_not_before_it()

/// Two saves in a row do not deadlock.
///
/// The transaction takes the lock with `lock_path` and commits with
/// `replace_locked_file`. Calling `replace_file_atomically` instead would take
/// the same non-reentrant lock a second time and hang forever, so a second save
/// completing at all is evidence the first one released.
#[test]
fn two_saves_in_a_row_do_not_deadlock() {
    let (_directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());

    let first = save(
        &target,
        base,
        &[scalar_edit("matches[0].replace", "one")],
        &Acknowledgement::none(),
    )
    .expect("the first save commits");
    let second = save(
        &target,
        first.revision,
        &[scalar_edit("matches[1].replace", "two")],
        &Acknowledgement::none(),
    )
    .expect("the second save commits");

    assert_ne!(first.revision, second.revision);
    assert_eq!(revision_on_disk(&target), second.revision);
} // End of function two_saves_in_a_row_do_not_deadlock()

/// Exactly one of eight savers starting from one base revision commits.
///
/// The lock is what makes this deterministic: the read, the hash, the patch and
/// the rename are one operation, so the seven losers see the winner's bytes at
/// step 2 and refuse. Nothing here says anything about a **non-cooperating**
/// writer, which the lock does not exclude at all.
#[test]
fn exactly_one_of_several_savers_from_one_base_revision_commits() {
    let (_directory, target) = fixture(CLEAN);
    let base = ContentRevision::of_bytes(CLEAN.as_bytes());
    let barrier = Arc::new(Barrier::new(8));

    let workers: Vec<_> = (0..8)
        .map(|index| {
            let target = target.clone();
            let barrier = Arc::clone(&barrier);
            std::thread::spawn(move || {
                barrier.wait();
                save(
                    &target,
                    base,
                    &[scalar_edit(
                        "matches[0].replace",
                        &format!("writer {index}"),
                    )],
                    &Acknowledgement::none(),
                )
                .is_ok()
            })
        })
        .collect();

    let winners = workers
        .into_iter()
        .map(|worker| worker.join().expect("the worker finishes"))
        .filter(|committed| *committed)
        .count();

    assert_eq!(winners, 1, "exactly one saver from one base revision wins");
    let final_text = std::fs::read_to_string(&target).expect("readable");
    assert!(
        final_text.contains("writer "),
        "the file holds one writer's bytes and no mixture"
    );
    assert_eq!(final_text.matches("writer ").count(), 1);
} // End of function exactly_one_of_several_savers_from_one_base_revision_commits()

// ---------------------------------------------------------------------------
// 7. The byte-exact fixtures
// ---------------------------------------------------------------------------

/// What the transaction does with one of the fifteen byte-exact fixtures.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    /// The edit went through and the file was rewritten.
    Committed,
    /// The semantic gate refused, because the fixture is not espanso-shaped.
    RefusedForEditorModelErrors,
}

/// Every fixture `CLAUDE.md` section 4 lists, with what a save of it does.
///
/// A table rather than a count, so a fixture that changes side is a failure
/// with a name on it rather than a number that quietly moved. Fourteen of them
/// carry an editable scalar and pass both gates; `move-kept-comment-joins-a-block.yml`
/// holds two matches with no content field, which is an `EditorModelError`, and
/// it is refused. That refusal is the fixture being what it is for, not a
/// defect: it exists to pin comment columns, not to be a valid snippet file.
const BYTE_EXACT_OUTCOMES: [(&str, Outcome); 15] = [
    ("crlf-line-endings.yml", Outcome::Committed),
    ("bom-utf8.yml", Outcome::Committed),
    ("no-trailing-newline.yml", Outcome::Committed),
    ("unicode-offsets.yml", Outcome::Committed),
    ("block-scalars.yml", Outcome::Committed),
    ("block-scalar-terminal-spaces.yml", Outcome::Committed),
    ("block-scalar-leading-blank-lines.yml", Outcome::Committed),
    ("folded-more-indented.yml", Outcome::Committed),
    ("block-scalar-header-tails.yml", Outcome::Committed),
    ("file-comments-and-mixed-endings.yml", Outcome::Committed),
    ("single-line-no-line-ending.yml", Outcome::Committed),
    ("run-based-removal-boundaries.yml", Outcome::Committed),
    ("move-block-scalar-seams.yml", Outcome::Committed),
    ("move-run-joins.yml", Outcome::Committed),
    (
        "move-kept-comment-joins-a-block.yml",
        Outcome::RefusedForEditorModelErrors,
    ),
];

/// The first scalar in `source` a scalar edit will accept, with the value to
/// write. `None` when the document has none, which is a fixture this sweep
/// cannot exercise and says so.
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
    } // End of the loop over every addressable node of the fixture
    None
} // End of function first_editable_scalar()

/// Every byte-exact fixture goes through the transaction, and every byte
/// outside the replaced span comes back identical.
///
/// The fixtures are **copied into a temp directory first**; nothing under
/// `tests/corpus/` is written, moved or reformatted. The property asserted is
/// the one the whole project rests on: the file on disk afterwards is the
/// source with the declared replacements applied and nothing else.
#[test]
fn every_byte_exact_fixture_survives_the_transaction() {
    let mut committed = 0usize;
    let mut refused = 0usize;
    for (name, expected) in BYTE_EXACT_OUTCOMES {
        let source = std::fs::read_to_string(corpus_root().join("synthetic").join(name))
            .unwrap_or_else(|error| panic!("{name} is readable: {error}"));
        let path = first_editable_scalar(&source)
            .unwrap_or_else(|| panic!("{name} must hold at least one editable scalar"));

        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join(name);
        std::fs::write(&target, source.as_bytes()).expect("the copy is written");
        let base = ContentRevision::of_bytes(source.as_bytes());

        let outcome = save(
            &target,
            base,
            &[DocumentEdit::Scalar(ScalarEdit::new(
                path.clone(),
                NEW_VALUE.to_owned(),
            ))],
            &Acknowledgement::none(),
        );
        match (outcome, expected) {
            (Ok(saved), Outcome::Committed) => {
                committed += 1;
                assert!(
                    saved.committed,
                    "{name}: the candidate differs from the file"
                );
                let on_disk = std::fs::read_to_string(&target).expect("readable");
                assert_eq!(on_disk, saved.text, "{name}: the file holds the candidate");
                assert_ne!(on_disk, source, "{name}: the edit changed something");
                assert_eq!(
                    rebuild(&source, &saved.replacements),
                    on_disk,
                    "{name}: the file is the source with the declared replacements applied"
                );
            }
            (Err(SaveError::Refused(refusal)), Outcome::RefusedForEditorModelErrors) => {
                refused += 1;
                assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);
                assert_eq!(
                    revision_on_disk(&target),
                    base,
                    "{name}: a refused save leaves the copy byte-identical"
                );
            }
            (other, expected) => panic!("{name}: expected {expected:?}, got {other:?}"),
        }
    } // End of the loop over the fifteen byte-exact fixtures

    assert_eq!(committed, 14);
    assert_eq!(refused, 1);
} // End of function every_byte_exact_fixture_survives_the_transaction()

/// Rebuilds a candidate from the source and a replacement list, independently
/// of the code that produced it.
fn rebuild(source: &str, replacements: &[espansoconfig_core::patch::Replacement]) -> String {
    let mut out = String::with_capacity(source.len());
    let mut cursor = 0usize;
    for replacement in replacements {
        out.push_str(&source[cursor..replacement.span.start]);
        out.push_str(&replacement.text);
        cursor = replacement.span.end;
    }
    out.push_str(&source[cursor..]);
    out
} // End of function rebuild()

// ---------------------------------------------------------------------------
// 8. The real corpus — counts only
// ---------------------------------------------------------------------------

/// The environment variable that turns the real-corpus skip into a failure.
///
/// The skip has to stay: a fresh clone and CI both have to pass without the
/// gitignored corpus. What must not stay is a skip that is indistinguishable
/// from a pass.
const REQUIRE_REAL_CORPUS: &str = "ESPANSOCONFIG_REQUIRE_REAL_CORPUS";

/// Whether an absent real corpus should fail rather than skip.
///
/// A separate function taking both inputs, so the decision can be checked on
/// all four of its combinations without a machine that has no corpus.
fn a_missing_corpus_is_fatal(corpus_is_absent: bool, switch_is_set: bool) -> bool {
    corpus_is_absent && switch_is_set
}

/// The skip is a decision with two inputs, and it is right on all four
/// combinations.
#[test]
fn a_missing_corpus_is_fatal_only_when_the_switch_asks_for_it() {
    assert!(a_missing_corpus_is_fatal(true, true));
    assert!(!a_missing_corpus_is_fatal(true, false));
    assert!(!a_missing_corpus_is_fatal(false, true));
    assert!(!a_missing_corpus_is_fatal(false, false));
}

/// **A gate that refuses a working configuration is a gate that is wrong.**
///
/// The owner's live espanso configuration is loaded by espanso every day, so a
/// save of any of its files that this transaction refuses is a defect until
/// proven otherwise. Each file is copied into a temp directory and saved twice:
/// once with an **empty batch**, which exercises the lock, the read, the hash,
/// the reparse-verify, the projection, the semantic gate and the policy without
/// changing a byte; and once with a real scalar edit, which additionally
/// exercises the commit and the byte-exactness of what lands on disk.
///
/// A zero is only worth something if the sweep had something to look at, so it
/// counts what it walked and asserts that too (`PROGRESS.md` R24).
///
/// **It is a no-op without the corpus.** Set [`REQUIRE_REAL_CORPUS`] to turn
/// that silence into a failure.
///
/// Prints **counts and file names only** (`CLAUDE.md` section 1).
#[test]
fn saving_the_real_configuration_is_refused_by_neither_gate() {
    let files = common::real_corpus();
    assert!(
        !a_missing_corpus_is_fatal(
            files.is_empty(),
            std::env::var_os(REQUIRE_REAL_CORPUS).is_some()
        ),
        "{REQUIRE_REAL_CORPUS} is set and the real corpus is absent: \
         run ./scripts/sync-real-corpus.sh to populate it locally"
    );
    if common::skip_without_real_corpus(
        "saving_the_real_configuration_is_refused_by_neither_gate",
        &files,
    ) {
        return;
    }

    let mut walked = 0usize;
    let mut matches = 0usize;
    let mut edited = 0usize;
    let mut refusals: Vec<String> = Vec::new();
    for file in &files {
        walked += 1;
        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join("copy.yml");
        std::fs::write(&target, file.source.as_bytes()).expect("the copy is written");
        let base = ContentRevision::of_bytes(file.source.as_bytes());
        matches += project_source(&context_for(&target), &file.source)
            .view
            .matches
            .len();

        match save(&target, base, &[], &Acknowledgement::none()) {
            Ok(saved) => assert!(
                !saved.committed && saved.findings.is_empty(),
                "{}: an unchanged candidate must not be written and must be clean",
                file.name
            ),
            Err(error) => refusals.push(format!("{} [unchanged]: {error}", file.name)),
        }

        let Some(path) = first_editable_scalar(&file.source) else {
            continue;
        };
        let edit = DocumentEdit::Scalar(ScalarEdit::new(path, NEW_VALUE.to_owned()));
        match save(
            &target,
            base,
            std::slice::from_ref(&edit),
            &Acknowledgement::none(),
        ) {
            Ok(saved) => {
                edited += 1;
                assert!(saved.committed, "{}: the edit changed something", file.name);
                assert_eq!(
                    std::fs::read_to_string(&target).expect("readable"),
                    saved.text,
                    "{}: the file holds the candidate",
                    file.name
                );
                assert_eq!(
                    rebuild(&file.source, &saved.replacements),
                    saved.text,
                    "{}: the candidate is the source with the declared replacements applied",
                    file.name
                );
            }
            Err(error) => refusals.push(format!("{} [edited]: {error}", file.name)),
        }
    } // End of the loop over the real corpus

    println!("real corpus: {walked} files, {matches} matches, {edited} edited and committed");
    println!("  refusals: {}", refusals.len());
    assert!(
        walked > 0 && matches > 0 && edited > 0,
        "the sweep must have walked something: {walked} files, {matches} matches, {edited} edited"
    );
    assert!(
        refusals.is_empty(),
        "saving the owner's working configuration must be refused by neither gate: {refusals:?}"
    );
} // End of function saving_the_real_configuration_is_refused_by_neither_gate()

/// The real-corpus test really consults the switch.
///
/// `a_missing_corpus_is_fatal_only_when_the_switch_asks_for_it` proves the
/// decision is right; this proves it is *taken*. The scan is bounded by the
/// function's own closing comment, so the guard cannot match its own text.
#[test]
fn the_real_corpus_test_reads_the_switch_that_makes_it_mandatory() {
    let source = include_str!("persist_save.rs");
    let body = source
        .split_once("fn saving_the_real_configuration_is_refused_by_neither_gate() {")
        .expect("the real-corpus test must be declared")
        .1
        .split_once(
            "} // End of function saving_the_real_configuration_is_refused_by_neither_gate()",
        )
        .expect("the real-corpus test must have its closing comment")
        .0;
    assert!(
        body.contains("a_missing_corpus_is_fatal(")
            && body.contains("std::env::var_os(REQUIRE_REAL_CORPUS)"),
        "the real-corpus test must decide with a_missing_corpus_is_fatal on {REQUIRE_REAL_CORPUS}"
    );
} // End of function the_real_corpus_test_reads_the_switch_that_makes_it_mandatory()
