//! Phase 2b-2c-3a acceptance: **the whole-document-text replacement mode.**
//!
//! `SaveRequest::content` gained a second arm — `SaveContent::ReplaceText` — and
//! this binary is the evidence for what that arm promises and, just as
//! importantly, for what it does not.
//!
//! # The promise, stated once
//!
//! **The exact submitted UTF-8 bytes are committed**: no parser formatting, no
//! newline normalization, no BOM added or removed, no final newline supplied, no
//! re-indentation, no transformation of any kind this application authored.
//!
//! That is *all* it promises. It is **not** a locality-preserving edit and no
//! test name or assertion message here may suggest it is: there are no untouched
//! bytes to prove untouched, so the safety comes from the revision check under
//! the lock and from the acknowledgement protocol instead.
//!
//! What is pinned, in the order it matters:
//!
//! - **a stale replacement never overwrites newer bytes** — the highest risk this
//!   mode carries, and the first test in the file. It runs under a bounded
//!   timeout, so an accidental reentrant-lock deadlock fails the suite instead of
//!   hanging it;
//! - a candidate the YAML parser rejects is **refused on the first attempt with
//!   the finding, and committed on the second** when that exact finding is
//!   acknowledged — the owner's ruling, and the acknowledgement protocol that
//!   makes it safe;
//! - an acknowledgement taken against one broken text does **not** carry to
//!   another — including to one engineered to stop the parser at the *same* line,
//!   the *same* column, the *same* byte and with the *same* message, which is what
//!   the finding's candidate-revision operand exists for;
//! - an acknowledgement holding only findings that were never issued commits
//!   nothing;
//! - every byte-exact fixture `CLAUDE.md` section 4 lists is submitted as a
//!   replacement and arrives on disk **byte for byte**, CRLF, BOM, missing final
//!   newline and astral characters included;
//! - a byte-identical replacement commits nothing, writes nothing and copies
//!   nothing — observed through the target's **inode and modification time**, not
//!   only its content, because a hash cannot tell *not written* from *rewritten
//!   with the same bytes*;
//! - a committed replacement has a **recoverable pre-commit image**, and a backup
//!   that cannot be written fails the save **before** the target is touched;
//! - **a replacement with no backup session at all is refused before the lock**,
//!   with nothing written and without the answer depending on the target at all —
//!   the design consult's Q6, *do not commit without recoverability* — while a
//!   session that has **already copied** the file still commits, because that copy
//!   is the image Q6 asks for;
//! - `notes` is **empty**, asserted rather than assumed: this mode re-encodes no
//!   scalar and moves no item, so there is no presentation change it could have
//!   authored;
//! - `replacements` reports exactly one span covering the whole original
//!   document, which is the statement *there is no locality here* rather than a
//!   claim of any.
//!
//! # What this binary does **not** pin
//!
//! - **No command reaches this mode.** Phase 2b-2c-3a registers no
//!   `#[tauri::command]`; `save_raw_document` is 2b-2c-3b's. Nothing here is
//!   evidence about a screen, an identity or a cache.
//! - **The residual race is untouched**, exactly as everywhere else: no second
//!   *process* is involved, and the lock excludes only this process's cooperating
//!   writers.
//! - **Nothing here has been checked against a running espanso.** A text this
//!   crate's parser rejects is a fact about `saphyr-parser`, never a proof that
//!   espanso would refuse the file.
//!
//! # Privacy
//!
//! Every byte written here is hand-authored neutral YAML declared as a `const`,
//! or a copy of a synthetic corpus fixture taken into a `TempDir` first. Nothing
//! under `tests/corpus/` is written, moved or reformatted, and the real corpus is
//! not read at all (`CLAUDE.md` section 1).

mod common;

use common::corpus_root;
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::persist::{
    save_document, Acknowledgement, BackupSession, SaveContent, SaveError, SaveRequest,
    SaveVerdict, SavedDocument, BACKUP_DIRECTORY_NAME,
};
use espansoconfig_core::validate::{Finding, FindingClass, FindingCode};
use espansoconfig_core::{ContentRevision, DocumentId};
use std::path::{Path, PathBuf};
use std::time::Duration;

// ---------------------------------------------------------------------------
// Fixtures — hand-authored and neutral (`CLAUDE.md` section 1)
// ---------------------------------------------------------------------------

/// Two matches both gates approve of. The starting state of most targets here.
const CLEAN: &str = "matches:\n  - trigger: ':one'\n    replace: 'first'\n  - trigger: ':two'\n    replace: 'second'\n";

/// A different text both gates also approve of, so a replacement can be
/// distinguished from the file it replaced by more than a whitespace tweak.
const REWRITTEN: &str =
    "matches:\n  - trigger: ':three'\n    replace: 'third'\n  - trigger: ':four'\n    replace: 'fourth'\n";

/// A third approved text, used where a test needs a byte-distinct **external**
/// writer's version.
const ANOTHER_WRITERS_TEXT: &str =
    "matches:\n  - trigger: ':other'\n    replace: 'somebody else got here first'\n";

/// Not YAML at all: an unterminated double-quoted scalar. The parser rejects it
/// with a position, which is what the finding carries.
const NOT_YAML: &str = "matches:\n  - trigger: ':one'\n    replace: \"unclosed\n";

/// A second text the parser also rejects, **at a different place**, so that an
/// acknowledgement of the first cannot be mistaken for an acknowledgement of any
/// broken text at all.
const NOT_YAML_ELSEWHERE: &str =
    "matches:\n  - trigger: ':one'\n    replace: 'fine'\n  - trigger: ':two'\n    replace: \"unclosed\n";

/// The **first half of the colliding pair**: an invalid prefix — a second `:` on
/// the first line, which the parser stops at — followed by content of its own.
///
/// The two texts below share every byte up to and including the parser's stopping
/// point and differ only after it, so the parser reports the *same* line, the
/// *same* column, the *same* byte offset and the *same* message for both. They are
/// the counterexample the review named: without an operand naming the candidate,
/// their findings would be equal and an acknowledgement of one would commit the
/// other.
const COLLIDING_ONE: &str = "matches: broken: here\n  - trigger: ':one'\n    replace: 'first'\n";

/// The **second half of the colliding pair** — byte-distinct from
/// [`COLLIDING_ONE`], and different only after the parser has already stopped.
const COLLIDING_TWO: &str =
    "matches: broken: here\n  - trigger: ':two'\n    replace: 'a much longer second'\n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// A configuration root shaped like espanso's own, holding `match/base.yml`.
///
/// A `TempDir` rather than the real configuration directory: a test that wrote
/// into the owner's espanso tree would be a test that edits a user's snippets.
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

/// The revision of whatever is on disk at `path` right now.
fn revision_on_disk(path: &Path) -> ContentRevision {
    ContentRevision::of_bytes(&std::fs::read(path).expect("the file is readable"))
}

/// One whole-text replacement of `target`.
///
/// `backups` stays an `Option` rather than becoming a `&BackupSession`, because
/// the one thing this file has to be able to express is a caller passing `None`
/// — which is refused before the lock. Every *other* call here supplies a real
/// session, and that is not boilerplate: a replacement with no session never
/// reaches the behaviour those tests are named after.
fn replace(
    root: &Path,
    target: &Path,
    base: ContentRevision,
    text: &str,
    acknowledgement: &Acknowledgement,
    backups: Option<&BackupSession>,
) -> Result<SavedDocument, SaveError> {
    let context = context_for(root, target);
    save_document(SaveRequest {
        context: &context,
        base_revision: base,
        content: SaveContent::ReplaceText(text),
        acknowledgement,
        backups,
    })
} // End of function replace()

/// The inode number of `path`.
///
/// **The identity of the file, not its content.** A commit replaces the target by
/// renaming a fresh temp file over it, so a new inode is what a rewrite looks like
/// from outside and an unchanged one is what *not writing* looks like. A content
/// hash cannot tell those apart: rewriting a file with the same bytes leaves the
/// hash exactly where it was.
fn inode_of(path: &Path) -> u64 {
    use std::os::unix::fs::MetadataExt;
    std::fs::metadata(path).expect("the file exists").ino()
} // End of function inode_of()

/// The modification time of `path`, as a second observation of its identity.
fn modified_at(path: &Path) -> std::time::SystemTime {
    std::fs::metadata(path)
        .expect("the file exists")
        .modified()
        .expect("a modification time")
} // End of function modified_at()

/// What the bounded-timeout thread carries back about one attempt.
///
/// A **typed** answer rather than a formatted string: `SaveError` is not `Send`
/// across this boundary as a borrow and the thread cannot panic usefully for the
/// caller, so the interesting fields are lifted out here. Matching this is what
/// replaces a `contains("holds")` on prose that no rule keeps stable.
#[derive(Debug, PartialEq, Eq)]
enum Attempt {
    /// The save returned `Ok`, and whether it committed.
    Succeeded {
        /// [`SavedDocument::committed`].
        committed: bool,
    },
    /// The save refused with [`SaveError::RevisionMismatch`], with the two
    /// revisions it named and the two questions a caller asks of any error.
    RevisionMismatch {
        /// The revision the caller based its replacement on.
        expected: ContentRevision,
        /// The revision the file was found to hold.
        found: ContentRevision,
        /// [`SaveError::is_refusal`].
        refusal: bool,
        /// [`SaveError::may_have_written`].
        may_have_written: bool,
    },
    /// Any other error, named by its `Display` so a failure says what happened.
    Other(String),
} // End of enum Attempt

/// Lifts one save result into the `Send` summary [`Attempt`] describes.
fn summarize(result: Result<SavedDocument, SaveError>) -> Attempt {
    let error = match result {
        Ok(saved) => {
            return Attempt::Succeeded {
                committed: saved.committed,
            }
        }
        Err(error) => error,
    };
    let refusal = error.is_refusal();
    let may_have_written = error.may_have_written();
    match error {
        SaveError::RevisionMismatch {
            expected, found, ..
        } => Attempt::RevisionMismatch {
            expected,
            found,
            refusal,
            may_have_written,
        },
        other => Attempt::Other(format!("{other}")),
    }
} // End of function summarize()

/// Runs `work` on another thread and gives it `limit` to finish.
///
/// The same instrument `persist_save.rs` uses, and for the same reason: the
/// defect this file is most afraid of is a call that **never returns**. The lock
/// is not reentrant, so a replacement path that reached for it a second time
/// would park forever, and a test that waited with it would hang the suite
/// instead of failing it. The abandoned thread is blocked inside a temp directory
/// of its own and holds nothing another test wants.
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

/// The one finding a refusal carries, asserted to be the parse finding.
fn the_parse_finding(error: &SaveError) -> Finding {
    let SaveError::Refused(refusal) = error else {
        panic!("expected a refusal at the semantic gate, got {error}");
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions,
        "a text that does not parse is a suspicion, not an editor-model error"
    );
    assert_eq!(
        refusal.findings.len(),
        1,
        "a candidate that does not parse has no projection, so it has exactly one \
         finding: {:?}",
        refusal.findings
    );
    let finding = refusal.findings[0].clone();
    assert_eq!(
        finding.class(),
        FindingClass::SuspiciousButPermitted,
        "the class is what makes the finding acknowledgeable at all"
    );
    assert!(
        finding.span.is_none(),
        "a parse rejection is a position, not a range of bytes"
    );
    finding
} // End of function the_parse_finding()

/// The parser's stopping point and message, **without** the candidate's identity.
///
/// These four operands are exactly what `DocumentDoesNotParse` carried before the
/// content-addressing operand was added, so comparing two findings through this is
/// comparing them the way the acknowledgement protocol would have compared them
/// then. It is what makes the collision assertable rather than merely asserted.
fn stopping_point(finding: &Finding) -> (Option<usize>, Option<usize>, Option<usize>, String) {
    match &finding.code {
        FindingCode::DocumentDoesNotParse {
            line,
            column,
            byte_index,
            detail,
            ..
        } => (*line, *column, *byte_index, detail.clone()),
        other => panic!("expected a parse finding, got {other:?}"),
    }
} // End of function stopping_point()

/// The candidate revision a parse finding names.
fn named_candidate(finding: &Finding) -> ContentRevision {
    match &finding.code {
        FindingCode::DocumentDoesNotParse { revision, .. } => *revision,
        other => panic!("expected a parse finding, got {other:?}"),
    }
} // End of function named_candidate()

// ---------------------------------------------------------------------------
// 1. The highest risk: a stale replacement must never overwrite newer bytes
// ---------------------------------------------------------------------------

/// **The test this whole sub-phase was ordered around.**
///
/// A raw editor holds a whole text, so a save built on a stale revision does not
/// clobber one span — it clobbers the file. Revision A is loaded, another writer
/// replaces the file with byte-distinct text B, and candidate C is submitted
/// against revision A. The transaction must refuse before it plans anything, B
/// must still be on disk byte for byte, and nothing may be reported as committed.
///
/// There is **no force flag and no acknowledgement escape hatch** for this: an
/// acknowledgement is about findings, and this refusal happens before any finding
/// exists. The second attempt below proves it, so the test cannot pass by
/// refusing everything.
///
/// The bounded timeout is the second thing being asserted. `save_document` takes
/// the one path lock and holds it across steps 2 to 11; a replacement path that
/// reached for a lock-taking helper a second time would deadlock silently, and
/// this fails in five seconds instead.
#[test]
fn stale_raw_save_never_overwrites_newer_bytes() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let stale = revision_on_disk(&target);

    // The other writer. It is another program as far as this process is
    // concerned: the lock excludes only this process's cooperating writers.
    std::fs::write(&target, ANOTHER_WRITERS_TEXT.as_bytes()).expect("the other writer");
    let newer_bytes = std::fs::read(&target).expect("the file is readable");
    assert_ne!(
        newer_bytes,
        CLEAN.as_bytes(),
        "the fixture is only about staleness if the two texts really differ"
    );

    let newer = revision_on_disk(&target);
    let attempted_root = root.clone();
    let attempted = target.clone();
    let outcome = within(Duration::from_secs(5), move || {
        let session = BackupSession::rooted_at(&attempted_root);
        summarize(replace(
            &attempted_root,
            &attempted,
            stale,
            REWRITTEN,
            &Acknowledgement::none(),
            Some(&session),
        ))
    });

    let Some(attempt) = outcome else {
        panic!(
            "a stale whole-text save did not return within five seconds: the lock is not \
             reentrant, so this is what a second lock acquisition inside the transaction \
             looks like"
        );
    };
    // The **typed** refusal, matched rather than read out of prose. A `Display`
    // string is not a contract and a substring of one is not an error code.
    assert_eq!(
        attempt,
        Attempt::RevisionMismatch {
            expected: stale,
            found: newer,
            refusal: true,
            may_have_written: false,
        },
        "the refusal must be the revision mismatch, naming both revisions"
    );

    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        newer_bytes,
        "the other writer's bytes must survive a stale replacement, byte for byte"
    );

    // And the same call against the revision really on disk goes through, so the
    // assertions above are about staleness rather than about a mode that refuses
    // everything.
    let session = BackupSession::rooted_at(&root);
    let saved = replace(
        &root,
        &target,
        revision_on_disk(&target),
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("the same replacement against the current revision commits");
    assert!(saved.committed);
    assert_eq!(
        std::fs::read_to_string(&target).expect("the file is readable"),
        REWRITTEN
    );
} // End of function stale_raw_save_never_overwrites_newer_bytes()

/// The typed refusal a stale replacement produces, matched rather than
/// stringified.
///
/// The test above runs on another thread and carries back the lifted [`Attempt`]
/// summary; this one holds the [`SaveError`] itself, and additionally observes
/// that the copying session was never touched.
#[test]
fn a_stale_replacement_refuses_with_the_revision_mismatch_and_writes_nothing() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let stale = revision_on_disk(&target);
    std::fs::write(&target, ANOTHER_WRITERS_TEXT.as_bytes()).expect("the other writer");
    let newer = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let error = replace(
        &root,
        &target,
        stale,
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect_err("a stale whole-text save must not commit");

    match &error {
        SaveError::RevisionMismatch {
            expected, found, ..
        } => {
            assert_eq!(*expected, stale);
            assert_eq!(*found, newer);
        }
        other => panic!("expected a revision mismatch, got {other}"),
    }
    assert!(error.is_refusal(), "a check declined to write");
    assert!(!error.may_have_written(), "nothing was renamed");
    assert_eq!(
        revision_on_disk(&target),
        newer,
        "the other writer's bytes are untouched"
    );
    assert_eq!(
        session.captured_count(),
        0,
        "a refusal happens before the copy, so the session has nothing in it"
    );
} // End of function a_stale_replacement_refuses_with_the_revision_mismatch_and_writes_nothing()

// ---------------------------------------------------------------------------
// 2. A text the parser rejects is reported, then written
// ---------------------------------------------------------------------------

/// **The owner's ruling, and the protocol that makes it safe.**
///
/// A candidate the YAML parser rejects is not refused outright — refusing would
/// mean this application cannot repair a file that is already broken, which is
/// the most valuable thing a raw editor does. It is refused *for want of an
/// acknowledgement*, with the finding, and the second attempt carrying that exact
/// finding commits the bytes as submitted.
#[test]
fn an_unparseable_replacement_is_refused_once_and_then_committed() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let error = replace(
        &root,
        &target,
        base,
        NOT_YAML,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect_err("the first attempt is refused for want of an acknowledgement");
    let finding = the_parse_finding(&error);
    match &finding.code {
        FindingCode::DocumentDoesNotParse {
            revision,
            line,
            column,
            byte_index,
            detail,
        } => {
            assert_eq!(
                *revision,
                ContentRevision::of_bytes(NOT_YAML.as_bytes()),
                "the finding names the exact candidate it is about, not the target"
            );
            assert_ne!(
                *revision, base,
                "and it is the submitted text's revision rather than the file's"
            );
            assert!(
                line.is_some() && column.is_some(),
                "the parser reported a position and the finding must carry it"
            );
            assert!(
                byte_index.is_some(),
                "the position converts to an offset into the submitted text"
            );
            assert!(!detail.is_empty(), "the parser's own diagnostic is carried");
        }
        other => panic!("expected a parse finding, got {other:?}"),
    }
    assert_eq!(
        revision_on_disk(&target),
        base,
        "a refused save leaves the target byte-identical"
    );

    let saved = replace(
        &root,
        &target,
        base,
        NOT_YAML,
        &Acknowledgement::of(std::slice::from_ref(&finding)),
        Some(&session),
    )
    .expect("the acknowledged attempt commits");

    assert!(saved.committed);
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        NOT_YAML.as_bytes(),
        "the bytes handed in are the bytes on disk"
    );
    assert_eq!(
        saved.findings,
        vec![finding],
        "the save reports what it proceeded past"
    );
    assert!(
        saved.notes.is_empty(),
        "a replacement authors no presentation change"
    );
} // End of function an_unparseable_replacement_is_refused_once_and_then_committed()

/// An acknowledgement taken against one broken text does **not** carry to
/// another.
///
/// The finding is content-addressed — its position and the parser's diagnostic
/// are operands — so consent given for one candidate cannot become consent for
/// any unparseable candidate at all. Without this, the ruling above would degrade
/// into a checkbox.
#[test]
fn acknowledging_one_unparseable_text_does_not_acknowledge_another() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let first = the_parse_finding(
        &replace(
            &root,
            &target,
            base,
            NOT_YAML,
            &Acknowledgement::none(),
            Some(&session),
        )
        .expect_err("the first text is refused"),
    );
    let second = the_parse_finding(
        &replace(
            &root,
            &target,
            base,
            NOT_YAML_ELSEWHERE,
            &Acknowledgement::none(),
            Some(&session),
        )
        .expect_err("the second text is refused"),
    );
    assert_ne!(
        first, second,
        "the two fixtures are only a test of content-addressing if they differ"
    );

    let error = replace(
        &root,
        &target,
        base,
        NOT_YAML_ELSEWHERE,
        &Acknowledgement::of(&[first]),
        Some(&session),
    )
    .expect_err("the wrong acknowledgement covers nothing");
    let SaveError::Refused(refusal) = &error else {
        panic!("expected a refusal, got {error}");
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_eq!(
        revision_on_disk(&target),
        base,
        "nothing was written on the way"
    );
} // End of function acknowledging_one_unparseable_text_does_not_acknowledge_another()

/// **The collision the review named, and the property the fix restores.**
///
/// The test above chooses two texts whose findings already differ, so it exercises
/// the easy half. This one submits two **byte-distinct** texts engineered to stop
/// the parser in exactly the same place with exactly the same message: they share
/// every byte up to and including the stopping point and differ only after it.
///
/// The premise is asserted first — the two stopping points really are equal — so
/// this test cannot pass by accident on a pair that never collided. Everything the
/// finding carried before the fix round is therefore identical between the two,
/// and only the candidate's own [`ContentRevision`] tells them apart. Without it,
/// the acknowledgement collected for the first text would match the second's
/// finding as an exact multiset and commit bytes nobody agreed to.
///
/// The right acknowledgement is exercised at the end, so the test cannot pass by
/// refusing everything.
#[test]
fn an_acknowledgement_cannot_carry_to_a_text_that_fails_in_the_same_place() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let identity = inode_of(&target);
    let session = BackupSession::rooted_at(&root);

    assert_ne!(
        COLLIDING_ONE, COLLIDING_TWO,
        "the fixtures are only a test of content-addressing if the texts really differ"
    );

    let first = the_parse_finding(
        &replace(
            &root,
            &target,
            base,
            COLLIDING_ONE,
            &Acknowledgement::none(),
            Some(&session),
        )
        .expect_err("the first text is refused for want of an acknowledgement"),
    );
    let second = the_parse_finding(
        &replace(
            &root,
            &target,
            base,
            COLLIDING_TWO,
            &Acknowledgement::none(),
            Some(&session),
        )
        .expect_err("the second text is refused for want of an acknowledgement"),
    );

    // The premise, asserted rather than assumed: every operand the finding carried
    // before the fix round is equal between these two candidates.
    assert_eq!(
        stopping_point(&first),
        stopping_point(&second),
        "these fixtures are only the collision case if the parser stops identically for both"
    );
    assert_eq!(first.span, second.span);
    assert_eq!(first.node, second.node);
    assert_eq!(first.path, second.path);

    // And the one operand that does tell them apart.
    assert_eq!(
        named_candidate(&first),
        ContentRevision::of_bytes(COLLIDING_ONE.as_bytes())
    );
    assert_eq!(
        named_candidate(&second),
        ContentRevision::of_bytes(COLLIDING_TWO.as_bytes())
    );
    assert_ne!(
        first, second,
        "two texts that stop the parser identically must still be two findings"
    );

    // The attack: consent collected for the first text, spent on the second.
    let error = replace(
        &root,
        &target,
        base,
        COLLIDING_TWO,
        &Acknowledgement::of(std::slice::from_ref(&first)),
        Some(&session),
    )
    .expect_err("an acknowledgement of the first text must not commit the second");
    let SaveError::Refused(refusal) = &error else {
        panic!("expected a refusal at the semantic gate, got {error}");
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_eq!(
        refusal.findings,
        vec![second.clone()],
        "the refusal carries the second candidate's own finding"
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        CLEAN.as_bytes(),
        "the target is byte-identical"
    );
    assert_eq!(inode_of(&target), identity, "and it is the same file");
    assert_eq!(
        session.captured_count(),
        0,
        "a refusal happens before the copy"
    );

    // And the acknowledgement that really is about this text commits it, so the
    // assertions above are about the binding rather than about a mode that refuses
    // every acknowledged replacement.
    let saved = replace(
        &root,
        &target,
        base,
        COLLIDING_TWO,
        &Acknowledgement::of(std::slice::from_ref(&second)),
        Some(&session),
    )
    .expect("the acknowledgement of this text commits it");
    assert!(saved.committed);
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        COLLIDING_TWO.as_bytes()
    );
} // End of function an_acknowledgement_cannot_carry_to_a_text_that_fails_in_the_same_place()

/// **An acknowledgement holding only findings that were never issued commits
/// nothing.**
///
/// The other side of the binding, and the one the review could not establish from
/// the excerpt it read. `covers_all` matches every *candidate* suspicion against a
/// distinct acknowledged copy, so a payload full of well-formed findings the
/// candidate never produced covers none of them and the save is refused. A caller
/// cannot manufacture consent by sending plausible findings.
///
/// **What it deliberately does not claim** is that a *surplus* entry refuses. An
/// acknowledgement that covers every candidate finding **and** carries extras
/// proceeds — `a_surplus_acknowledgement_does_not_refuse` in
/// `crates/espansoconfig-core/src/persist/save.rs` pins that, on purpose: the rule
/// is *every suspicion was acknowledged*, not *every acknowledgement was used*.
/// The second half here exercises exactly that, so the two statements cannot be
/// confused.
#[test]
fn an_acknowledgement_of_findings_that_were_never_issued_commits_nothing() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let identity = inode_of(&target);
    let session = BackupSession::rooted_at(&root);

    let elsewhere = the_parse_finding(
        &replace(
            &root,
            &target,
            base,
            NOT_YAML_ELSEWHERE,
            &Acknowledgement::none(),
            Some(&session),
        )
        .expect_err("that text is refused"),
    );
    let colliding = the_parse_finding(
        &replace(
            &root,
            &target,
            base,
            COLLIDING_ONE,
            &Acknowledgement::none(),
            Some(&session),
        )
        .expect_err("and so is that one"),
    );

    // Two real findings, neither of them about the candidate below.
    let never_issued = vec![elsewhere, colliding];
    let surplus = Acknowledgement::of(&never_issued);
    assert_eq!(surplus.len(), 2);

    let error = replace(&root, &target, base, NOT_YAML, &surplus, Some(&session))
        .expect_err("findings that were never issued cover nothing");
    let SaveError::Refused(refusal) = &error else {
        panic!("expected a refusal at the semantic gate, got {error}");
    };
    assert_eq!(
        refusal.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        CLEAN.as_bytes(),
        "the target is byte-identical"
    );
    assert_eq!(inode_of(&target), identity, "and it is the same file");
    assert_eq!(session.captured_count(), 0);

    // The candidate's own finding, plus the two surplus ones: every suspicion the
    // candidate produced is now covered, and the extras are simply unused.
    let mut accepted = refusal.findings.clone();
    accepted.extend(never_issued.iter().cloned());
    let saved = replace(
        &root,
        &target,
        base,
        NOT_YAML,
        &Acknowledgement::of(&accepted),
        Some(&session),
    )
    .expect("an acknowledgement that does cover this candidate commits it");
    assert!(saved.committed);
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        NOT_YAML.as_bytes()
    );
} // End of function an_acknowledgement_of_findings_that_were_never_issued_commits_nothing()

/// An editor-model error in a replacement is **not** acknowledgeable, exactly as
/// it is not for an edit.
///
/// The owner's ruling widened one thing — a text the *parser* rejects — and this
/// pins that it widened nothing else. `matches` holding an entry with no content
/// field is a shape espanso cannot grow out of, and no acknowledgement gets past
/// it in either content mode.
#[test]
fn a_replacement_carrying_an_editor_model_error_is_still_refused() {
    const NO_CONTENT_FIELD: &str = "matches:\n  - trigger: ':one'\n";
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let error = replace(
        &root,
        &target,
        base,
        NO_CONTENT_FIELD,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect_err("an editor-model error refuses");
    let SaveError::Refused(refusal) = &error else {
        panic!("expected a refusal, got {error}");
    };
    assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);

    let again = replace(
        &root,
        &target,
        base,
        NO_CONTENT_FIELD,
        &Acknowledgement::of(&refusal.findings),
        Some(&session),
    )
    .expect_err("acknowledging an error must not be a way past it");
    assert!(matches!(
        &again,
        SaveError::Refused(refusal) if refusal.verdict == SaveVerdict::RefusedForEditorModelErrors
    ));
    assert_eq!(revision_on_disk(&target), base);
} // End of function a_replacement_carrying_an_editor_model_error_is_still_refused()

// ---------------------------------------------------------------------------
// 3. Byte-exactness of the submitted text
// ---------------------------------------------------------------------------

/// What a replacement by one of the byte-exact fixtures does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    /// The text was written, byte for byte.
    Committed,
    /// The semantic gate refused, because the fixture is not espanso-shaped.
    RefusedForEditorModelErrors,
}

/// Every fixture `CLAUDE.md` section 4 lists, with what submitting it as a whole
/// replacement does.
///
/// A table rather than a count, so a fixture that changes side is a failure with
/// a name on it. The verdicts are the same ones `persist_save.rs` records for an
/// *edit* of each fixture, because the semantic gate is the same pass in both
/// content modes: `move-kept-comment-joins-a-block.yml` holds two matches with no
/// content field, which is an `EditorModelError` no acknowledgement passes, and it
/// exists to pin comment columns rather than to be a valid snippet file.
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

/// **The bytes handed in are the bytes on disk**, for every fixture whose
/// whitespace is the test data.
///
/// The target starts as `CLEAN` and each fixture's text is submitted as the whole
/// replacement, so every fixture's distinguishing bytes are really *written* by
/// this mode rather than merely left alone by a byte-identical no-op: the CRLF
/// line endings, the leading `ef bb bf`, the absent final newline, the
/// precomposed and decomposed `é` and the astral `😀`, the deliberate blank runs
/// and the terminal spaces.
///
/// Each fixture gets a `BackupSession` of its own, because a replacement without
/// one never gets as far as the disk. The copy it leaves is checked here too: a
/// whole-file replacement is only reversible through it.
///
/// Nothing under `tests/corpus/` is written: each fixture is read and its bytes
/// are submitted, and the target lives in a `TempDir`.
#[test]
fn every_byte_exact_fixture_is_committed_exactly_as_submitted() {
    let mut committed = 0usize;
    let mut refused = 0usize;
    for (name, expected) in BYTE_EXACT_OUTCOMES {
        let bytes = std::fs::read(corpus_root().join("synthetic").join(name))
            .unwrap_or_else(|error| panic!("{name} is readable: {error}"));
        let text = String::from_utf8(bytes.clone())
            .unwrap_or_else(|error| panic!("{name} is valid UTF-8: {error}"));

        let (_directory, root, target) = config_root_with(CLEAN);
        let base = revision_on_disk(&target);
        let session = BackupSession::rooted_at(&root);

        match (
            replace(
                &root,
                &target,
                base,
                &text,
                &Acknowledgement::none(),
                Some(&session),
            ),
            expected,
        ) {
            (Ok(saved), Outcome::Committed) => {
                committed += 1;
                assert!(
                    saved.committed,
                    "{name}: the candidate differs from the file"
                );
                assert_eq!(
                    std::fs::read(&target).expect("the file is readable"),
                    bytes,
                    "{name}: the submitted bytes must reach the disk unaltered"
                );
                assert_eq!(
                    saved.text, text,
                    "{name}: the reported text is the submitted one"
                );
                assert!(
                    saved.notes.is_empty(),
                    "{name}: a replacement restyles nothing"
                );
                assert_eq!(
                    saved.replacements.len(),
                    1,
                    "{name}: a replacement reports one whole-document span"
                );
                assert_eq!(saved.replacements[0].span.start, 0);
                assert_eq!(saved.replacements[0].span.end, CLEAN.len());
                assert_eq!(saved.replacements[0].text, text);
                let record = saved
                    .backup
                    .as_ref()
                    .unwrap_or_else(|| panic!("{name}: a committed replacement leaves a copy"));
                assert_eq!(
                    std::fs::read(&record.path).expect("the backup is readable"),
                    CLEAN.as_bytes(),
                    "{name}: the copy holds the bytes the replacement destroyed"
                );
            }
            (Err(SaveError::Refused(refusal)), Outcome::RefusedForEditorModelErrors) => {
                refused += 1;
                assert_eq!(refusal.verdict, SaveVerdict::RefusedForEditorModelErrors);
                assert_eq!(
                    revision_on_disk(&target),
                    base,
                    "{name}: a refused save leaves the target byte-identical"
                );
            }
            (other, expected) => panic!("{name}: expected {expected:?}, got {other:?}"),
        } // End of the match over one fixture's outcome
    } // End of the loop over the byte-exact fixtures
    assert_eq!((committed, refused), (14, 1));
} // End of function every_byte_exact_fixture_is_committed_exactly_as_submitted()

// ---------------------------------------------------------------------------
// 4. A replacement that changes nothing
// ---------------------------------------------------------------------------

/// A replacement whose text equals the file's commits nothing, writes nothing
/// and copies nothing.
///
/// Every rename installs a new inode and drops eight classes of file metadata, so
/// paying that for a document that did not change is pure loss — and there is no
/// pristine version of a file that is not being replaced, so there is nothing for
/// a backup to be a copy of.
///
/// **The file's identity is observed, not only its content.** A content revision
/// cannot tell *not written* from *rewritten with the same bytes*, so on its own it
/// would pass an implementation that renamed a fresh temp file into place and then
/// reported `committed: false` — which is the exact defect this test exists to
/// exclude. A commit replaces the inode, so the inode and the modification time
/// before and after are what say the rename did not happen.
#[test]
fn a_byte_identical_replacement_commits_nothing_and_takes_no_backup() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);
    let identity = inode_of(&target);
    let modified = modified_at(&target);

    let saved = replace(
        &root,
        &target,
        base,
        CLEAN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("a byte-identical replacement is a success");

    assert!(
        !saved.committed,
        "nothing changed, so nothing was rewritten"
    );
    assert!(saved.backup.is_none(), "there is nothing to have a copy of");
    assert_eq!(saved.revision, base);
    assert!(saved.notes.is_empty());
    assert_eq!(
        revision_on_disk(&target),
        base,
        "the target is byte-identical"
    );
    assert_eq!(
        inode_of(&target),
        identity,
        "and it is the same file: a commit renames a new inode into place, so an unchanged \
         one is the observation that no rename happened"
    );
    assert_eq!(
        modified_at(&target),
        modified,
        "its modification time is untouched too"
    );
    assert_eq!(session.captured_count(), 0);
    assert!(
        !root.join(BACKUP_DIRECTORY_NAME).exists(),
        "a save that copies nothing mints no backup tree"
    );

    // The same observation on a replacement that really does change the file, so
    // the assertions above are about the skipped commit rather than about an inode
    // this filesystem happens never to change.
    let (_second_directory, second_root, second_target) = config_root_with(CLEAN);
    let second_session = BackupSession::rooted_at(&second_root);
    let before = inode_of(&second_target);
    replace(
        &second_root,
        &second_target,
        revision_on_disk(&second_target),
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&second_session),
    )
    .expect("the differing replacement commits");
    assert_ne!(
        inode_of(&second_target),
        before,
        "a commit really does install a new inode, which is what makes the check above mean \
         something"
    );
} // End of function a_byte_identical_replacement_commits_nothing_and_takes_no_backup()

// ---------------------------------------------------------------------------
// 5. Backups — the pre-commit image, and the failure that comes before the write
// ---------------------------------------------------------------------------

/// A committed replacement has a **recoverable pre-commit image**: the copy holds
/// exactly the bytes the target held before it.
///
/// This is the load-bearing half of the mode's safety. An edit can be reasoned
/// about from its span; a replacement cannot, so the copy of what it replaced is
/// what a user has left.
///
/// **A `Some` here is not a promise that the file is recoverable forever.**
/// Retention is ten batches and a batch is a session; no assertion below says
/// otherwise.
#[test]
fn a_committed_replacement_leaves_a_copy_of_what_it_replaced() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let saved = replace(
        &root,
        &target,
        base,
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("the replacement commits");

    assert!(saved.committed);
    let record = saved
        .backup
        .expect("a committed replacement takes a backup");
    assert_eq!(
        std::fs::read(&record.path).expect("the backup is readable"),
        CLEAN.as_bytes(),
        "the copy is the pre-commit target, byte for byte"
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        REWRITTEN.as_bytes(),
        "and the target holds the submitted bytes"
    );
    assert_eq!(session.captured_count(), 1);
    assert!(session.has_captured(&target));
} // End of function a_committed_replacement_leaves_a_copy_of_what_it_replaced()

/// A backup that cannot be written **fails the replacement before the target is
/// touched**.
///
/// The obstruction is a regular file where the backup root belongs, which makes
/// the batch directory impossible to create. It is a failure rather than a
/// refusal — the environment stopped an operation, and there is nothing here for
/// a user to decide — and the point is *when* it happens: before the rename, so
/// this call leaves the target exactly as it found it.
#[test]
fn a_backup_that_cannot_be_written_stops_a_replacement_before_the_commit() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    std::fs::write(root.join(BACKUP_DIRECTORY_NAME), b"not a directory").expect("the obstruction");
    let session = BackupSession::rooted_at(&root);

    let error = replace(
        &root,
        &target,
        base,
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect_err("the copy cannot be written, so the replacement does not proceed");

    assert!(matches!(error, SaveError::Backup(_)), "got {error}");
    assert!(!error.is_refusal(), "the environment refused, not a check");
    assert!(!error.may_have_written(), "this is before the commit");
    assert_eq!(
        revision_on_disk(&target),
        base,
        "this call did not rewrite the target"
    );
    assert_eq!(session.captured_count(), 0);
} // End of function a_backup_that_cannot_be_written_stops_a_replacement_before_the_commit()

/// **A replacement with no backup session at all is refused before the lock**,
/// and nothing is read and nothing is written.
///
/// The design consult's Q6: *every committed raw replacement must have a
/// recoverable pre-commit image … do not commit without recoverability.* An edit
/// can be saved with no session because the patch engine bounds what a commit
/// destroys to the planned spans, and the rest of the pre-edit file is still on
/// disk afterwards. A replacement destroys all of it, so a caller that supplied
/// nowhere to copy it to is refused rather than obliged.
///
/// The `TempDir` holds nothing but `match/base.yml`, so *no backup tree was
/// minted* is checked as an absence on disk as well as through the typed answer.
///
/// # What "without consulting the target" is, and how it is observed
///
/// Unchanged bytes and a typed error would both survive an implementation that
/// locked the target and read it first and only then noticed the missing session,
/// so neither establishes any ordering at all. The second half of this test
/// **deletes the target** and repeats the call: every step this refusal is
/// supposed to precede — `lock_path`'s canonicalisation, the checked open, the
/// read, the revision hash — fails on a path with no file at it, and would come
/// back as `SaveError::Target`. The same `ReplacementRequiresBackups` for a file
/// that is not there is what says the answer does not depend on the target.
///
/// **The name says "consulting" rather than "reading" because that is what a
/// black-box test can establish.** A read whose result is discarded changes
/// nothing an observer can see; what this excludes is every implementation whose
/// refusal comes *after* a resolve, a lock, an open, a read or a hash whose
/// outcome is respected — which is every implementation that would answer
/// differently for a file that is missing, unreadable or stale.
#[test]
fn a_replacement_with_no_backup_session_is_refused_without_consulting_the_target() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);

    let error = replace(
        &root,
        &target,
        base,
        REWRITTEN,
        &Acknowledgement::none(),
        None,
    )
    .expect_err("a whole-text replacement with nowhere to copy the file is refused");

    match &error {
        SaveError::ReplacementRequiresBackups { path } => assert_eq!(path, &target),
        other => panic!("expected the missing-session refusal, got {other}"),
    }
    assert!(
        error.is_refusal(),
        "a policy of this application declined; no filesystem said no"
    );
    assert!(!error.may_have_written(), "the lock was never even taken");
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        CLEAN.as_bytes(),
        "the target is byte-identical: nothing was read and nothing was written"
    );
    assert!(
        !root.join(BACKUP_DIRECTORY_NAME).exists(),
        "a refused replacement mints no backup tree"
    );

    // The ordering, made observable. With the file gone, any attempt to resolve,
    // lock, open, read or hash it fails — so the same pre-lock refusal coming back
    // is the evidence that none of those was attempted.
    std::fs::remove_file(&target).expect("the target is removed");
    let with_nothing_there = replace(
        &root,
        &target,
        base,
        REWRITTEN,
        &Acknowledgement::none(),
        None,
    )
    .expect_err("still refused, and for the same reason");
    match &with_nothing_there {
        SaveError::ReplacementRequiresBackups { path } => assert_eq!(path, &target),
        other => panic!(
            "a target that does not exist must not change this answer: reaching the \
             filesystem at all would have produced {other}"
        ),
    }
    assert!(
        !target.exists(),
        "and the refusal created nothing where the file used to be"
    );
} // End of function a_replacement_with_no_backup_session_is_refused_without_consulting_the_target()

/// **A missing session is refused; a backup that is merely unnecessary is not.**
///
/// The distinction the check has to draw, and the one a naive reading of Q6
/// destroys. The rule is *before the **first** modification of each file per
/// session* (plan section 6.6), so a session's second replacement of the same
/// file takes no second copy — `backup` comes back `None` — and that `None` means
/// *the image is already held*, not *there is no image*. Refusing it would make a
/// raw editor unusable after its first save, and Q6 rules the opposite: **preserve
/// that snapshot rather than overwriting it**.
///
/// The copy is read at the end to prove the point: it still holds the text the
/// session started from, not the text the first replacement left behind.
#[test]
fn a_second_replacement_in_one_session_commits_with_no_second_copy() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let session = BackupSession::rooted_at(&root);

    let first = replace(
        &root,
        &target,
        revision_on_disk(&target),
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("the first replacement commits");
    let record = first.backup.expect("the first replacement takes the copy");
    assert_eq!(session.captured_count(), 1);

    let second = replace(
        &root,
        &target,
        revision_on_disk(&target),
        ANOTHER_WRITERS_TEXT,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("a session that already holds a copy of this file commits again");

    assert!(second.committed, "the second text really differs");
    assert!(
        second.backup.is_none(),
        "the first modification per session already happened, so no second copy is taken"
    );
    assert_eq!(
        session.captured_count(),
        1,
        "and the session still knows about exactly one file"
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        ANOTHER_WRITERS_TEXT.as_bytes()
    );
    assert_eq!(
        std::fs::read(&record.path).expect("the backup is readable"),
        CLEAN.as_bytes(),
        "the session's one snapshot is preserved rather than overwritten"
    );
} // End of function a_second_replacement_in_one_session_commits_with_no_second_copy()

/// An **edit** save with no backup session is still legal, in the same file and
/// with the same context the replacement above was refused for.
///
/// The other half of the distinction, and the reason it is asserted here rather
/// than left to `persist_save.rs`: the refusal above is only correct if it is a
/// rule about `SaveContent::ReplaceText`. A check that fired for both content
/// modes would pass every assertion in the test above and break every edit-save
/// caller in the application.
#[test]
fn an_edit_save_with_no_backup_session_is_still_legal() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let context = context_for(&root, &target);

    let saved = save_document(SaveRequest {
        context: &context,
        base_revision: revision_on_disk(&target),
        content: SaveContent::Edits(&[]),
        acknowledgement: &Acknowledgement::none(),
        backups: None,
    })
    .expect("an empty edit batch with no session is a success");

    assert!(!saved.committed, "an empty batch changes nothing");
    assert!(saved.backup.is_none(), "the caller asked for no backup");
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        CLEAN.as_bytes()
    );
} // End of function an_edit_save_with_no_backup_session_is_still_legal()

// ---------------------------------------------------------------------------
// 6. What a replacement reports about itself
// ---------------------------------------------------------------------------

/// **`notes` is empty for a replacement**, asserted rather than assumed, across
/// every outcome that produces a `SavedDocument`.
///
/// The claim is not "nothing was normalised by luck": this mode re-encodes no
/// scalar and moves no item, so there is no presentation change this application
/// could have authored. A note appearing here would mean bytes were altered on
/// their way to the disk, which is the one thing the mode promises never happens.
///
/// **An empty report is only half the claim, so the bytes are asserted at every
/// stage.** "No note was reported" and "nothing was normalised" are two different
/// statements, and an implementation that silently reindented on the way to the
/// disk would satisfy the first. The second is what the mode promises, and only a
/// comparison against the submitted text establishes it.
#[test]
fn a_replacement_never_reports_a_presentation_note() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let session = BackupSession::rooted_at(&root);

    let committed = replace(
        &root,
        &target,
        revision_on_disk(&target),
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("the replacement commits");
    assert!(committed.notes.is_empty(), "a committed replacement");
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        REWRITTEN.as_bytes(),
        "a committed replacement: the submitted bytes, unaltered"
    );
    assert_eq!(committed.text, REWRITTEN);

    let unchanged = replace(
        &root,
        &target,
        revision_on_disk(&target),
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("a byte-identical replacement is a success");
    assert!(!unchanged.committed);
    assert!(
        unchanged.notes.is_empty(),
        "a replacement that changed nothing"
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        REWRITTEN.as_bytes(),
        "a replacement that changed nothing: the file is where it was"
    );

    let refused = replace(
        &root,
        &target,
        revision_on_disk(&target),
        NOT_YAML,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect_err("the unparseable text is refused first");
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        REWRITTEN.as_bytes(),
        "and the refusal wrote nothing on the way"
    );
    let acknowledged = replace(
        &root,
        &target,
        revision_on_disk(&target),
        NOT_YAML,
        &Acknowledgement::of(refused.findings()),
        Some(&session),
    )
    .expect("and then commits");
    assert!(
        acknowledged.notes.is_empty(),
        "a replacement the parser rejected"
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        NOT_YAML.as_bytes(),
        "a replacement the parser rejected: still the submitted bytes, unaltered"
    );
    assert_eq!(acknowledged.text, NOT_YAML);
} // End of function a_replacement_never_reports_a_presentation_note()

/// A replacement reports **one** span covering the whole original document, and
/// applying it to the original really does rebuild the file.
///
/// The record is the statement *there is no locality here* rather than a claim of
/// any: an empty list would read as "nothing was replaced", which is the one
/// thing it must not say.
#[test]
fn a_replacement_reports_one_whole_document_span_that_rebuilds_the_file() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let session = BackupSession::rooted_at(&root);

    let saved = replace(
        &root,
        &target,
        revision_on_disk(&target),
        REWRITTEN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("the replacement commits");

    assert_eq!(saved.replacements.len(), 1);
    let replacement = &saved.replacements[0];
    assert_eq!(replacement.span.start, 0);
    assert_eq!(replacement.span.end, CLEAN.len());
    assert_eq!(replacement.text, REWRITTEN);

    let mut rebuilt = String::from(&CLEAN[..replacement.span.start]);
    rebuilt.push_str(&replacement.text);
    rebuilt.push_str(&CLEAN[replacement.span.end..]);
    assert_eq!(
        rebuilt,
        std::fs::read_to_string(&target).expect("the file is readable"),
        "the original with the declared replacement applied is what is on disk"
    );
} // End of function a_replacement_reports_one_whole_document_span_that_rebuilds_the_file()

/// A replacement of a document that is **already broken** is how a repair
/// happens, and it is the case the owner's ruling exists for.
///
/// The target starts as text the parser rejects — which this application can
/// still display, because a broken file crosses as a view and never as an error —
/// and a well-formed replacement is committed with no finding and no
/// acknowledgement at all.
#[test]
fn an_already_broken_file_can_be_repaired_by_a_replacement() {
    let (_directory, root, target) = config_root_with(NOT_YAML);
    let base = revision_on_disk(&target);
    let session = BackupSession::rooted_at(&root);

    let saved = replace(
        &root,
        &target,
        base,
        CLEAN,
        &Acknowledgement::none(),
        Some(&session),
    )
    .expect("repairing a broken file needs no acknowledgement");

    assert!(saved.committed);
    assert!(
        saved.findings.is_empty(),
        "the repaired text is clean: {:?}",
        saved.findings
    );
    assert_eq!(
        std::fs::read(&target).expect("the file is readable"),
        CLEAN.as_bytes()
    );
} // End of function an_already_broken_file_can_be_repaired_by_a_replacement()

/// A package file is refused **before the lock is taken**, in this content mode
/// as in the other.
///
/// The read-only check is the first statement of the transaction and sits above
/// the branch, so a whole-text replacement cannot become a way around it.
///
/// **`backups: None` here is deliberate and pins the order of the two pre-lock
/// refusals.** This call qualifies for both — a package file, and a replacement
/// with no session — and the read-only answer is the one that must come back,
/// because a package file must not be written whatever the caller supplies.
///
/// # What "without consulting the target" is, and how it is observed
///
/// The same instrument the missing-session test uses, and with the same
/// qualification: an unchanged file and a typed error would both survive an
/// implementation that locked and read first. The second half **deletes the
/// target**, so every step this refusal precedes would fail on a path with no file
/// at it, and the same `DocumentIsReadOnly` coming back is what says the answer
/// does not depend on the target. A read whose result is discarded is invisible to
/// any black-box test and is deliberately not claimed.
#[test]
fn a_replacement_of_a_package_file_is_refused_without_consulting_the_target() {
    let (_directory, root, target) = config_root_with(CLEAN);
    let base = revision_on_disk(&target);
    let identity = inode_of(&target);
    let context = DocumentContext {
        kind: FileKind::Package,
        ..context_for(&root, &target)
    };
    let package_save = |context: &DocumentContext| {
        save_document(SaveRequest {
            context,
            base_revision: base,
            content: SaveContent::ReplaceText(REWRITTEN),
            acknowledgement: &Acknowledgement::none(),
            backups: None,
        })
    };

    let error = package_save(&context).expect_err("a package file is refused");

    assert!(matches!(&error, SaveError::DocumentIsReadOnly { .. }));
    assert!(error.is_refusal());
    assert!(!error.may_have_written());
    assert_eq!(revision_on_disk(&target), base);
    assert_eq!(inode_of(&target), identity, "the file was never replaced");

    // The ordering, made observable: with nothing at the path, resolving, locking,
    // opening or reading it would all fail, so the unchanged answer is the proof
    // that the read-only check came first.
    std::fs::remove_file(&target).expect("the target is removed");
    match package_save(&context).expect_err("still refused, and for the same reason") {
        SaveError::DocumentIsReadOnly { path } => assert_eq!(path, target),
        other => panic!(
            "a target that does not exist must not change this answer: reaching the \
             filesystem at all would have produced {other}"
        ),
    }
    assert!(
        !target.exists(),
        "and the refusal created nothing where the file used to be"
    );
} // End of function a_replacement_of_a_package_file_is_refused_without_consulting_the_target()
