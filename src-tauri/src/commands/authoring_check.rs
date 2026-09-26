//! Phase 4-8's command-level evidence: revision-bound authoring snapshots,
//! candidate analysis, the widened `save_match` and the variable-reorder
//! writer (`docs/decisions/4-split-notes.md` §2, step 4-8).
//!
//! Every clause of the step's acceptance is driven through the session on
//! real temporary files:
//!
//! - stale identities and stale revisions refuse, before anything is planned,
//!   on all three new commands (D2v);
//! - no submitted span is trusted: nothing inbound carries one except an
//!   acknowledgement's findings, which are compared as a multiset and never
//!   applied, and an inverted one is refused while the arguments are read
//!   (R28);
//! - every writer reaches the one save tail and takes no path lock of its own,
//!   and the analysis takes none at all;
//! - an atomic content-plus-variable save, an acknowledgement round trip, a
//!   no-op and an uncertain outcome.
//!
//! The uncertain outcome goes through the writers' own seam (`SaveTail`): the
//! closure lets the real tail commit and then answers with a fabricated
//! may-have-written failure, which is the one shape of that outcome a
//! filesystem cannot be made to produce on demand. Every fixture is synthetic
//! and neutral (`CLAUDE.md` section 1).

use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use espansoconfig_core::authoring::{CandidateOperation, ContainerBaseline};
use espansoconfig_core::draft::{DraftField, ListPlacement, MatchDraft, NewVariable, VarsIntent};
use espansoconfig_core::model::MatchId;
use espansoconfig_core::persist::{lock_path, Acknowledgement, SaveError, SaveVerdict, WriteError};
use espansoconfig_core::validate::FindingCode;
use espansoconfig_core::workspace::Workspace;
use espansoconfig_core::{ByteSpan, ContentRevision, DocumentId};
use tempfile::TempDir;

use super::{
    move_one_variable, run_one_save, save_one_match, OneSave, SessionSideOfASave, WorkspaceSession,
};
use crate::error::CommandError;
use crate::save::SaveResult;

/// One snippet with a block `vars`: `b` depends on `a`, and a comment directly
/// above `b` — which the ownership rules give to `b`, so it travels with it.
const CHAIN: &str = "\
matches:
  - trigger: ':v1'
    replace: '{{a}} {{b}}'
    vars:
      - name: a
        type: echo
        params:
          echo: 'x'
      # shared between the two
      - name: b
        type: echo
        depends_on:
          - a
        params:
          echo: 'y'
  - trigger: ':v2'
    replace: plain
";

/// [`CHAIN`] with `b` moved to the front, carrying its own lines and the
/// comment it owns.
const CHAIN_B_FIRST: &str = "\
matches:
  - trigger: ':v1'
    replace: '{{a}} {{b}}'
    vars:
      # shared between the two
      - name: b
        type: echo
        depends_on:
          - a
        params:
          echo: 'y'
      - name: a
        type: echo
        params:
          echo: 'x'
  - trigger: ':v2'
    replace: plain
";

/// A tree holding one match file, `match/base.yml`, with `source`.
fn tree(source: &str) -> TempDir {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).expect("the match directory");
    fs::write(dir.path().join("match").join("base.yml"), source).expect("the fixture");
    dir
}

/// An unwatched session with `dir` open.
fn open(dir: &TempDir) -> WorkspaceSession {
    let session = WorkspaceSession::unwatched();
    session.open(Some(dir.path())).expect("the tree opens");
    session
}

/// The identity of `match/base.yml`.
fn base_id(session: &WorkspaceSession) -> DocumentId {
    session
        .documents()
        .expect("the workspace is open")
        .iter()
        .find(|summary| summary.relative_path == std::path::Path::new("match/base.yml"))
        .expect("the file is listed")
        .id
}

/// The bytes of `match/base.yml`.
fn bytes(dir: &TempDir) -> String {
    fs::read_to_string(dir.path().join("match").join("base.yml")).expect("the file reads")
}

/// The absolute path of `match/base.yml`.
fn target(dir: &TempDir) -> PathBuf {
    dir.path().join("match").join("base.yml")
}

/// The first match's identity and the document's revision.
fn first(session: &WorkspaceSession) -> (MatchId, ContentRevision) {
    let view = session.document(base_id(session)).expect("the file reads");
    (view.matches[0].id, view.revision)
}

/// A draft adding a self-dependent `c` beside a content edit that references it.
fn cyclic_draft() -> MatchDraft {
    MatchDraft {
        replace: DraftField::Set("{{a}} {{b}} {{c}}".to_owned()),
        var_intents: vec![VarsIntent::insert(
            ListPlacement::End {},
            NewVariable::echo("c", "z").with_depends_on(vec!["c".to_owned()]),
        )],
        ..MatchDraft::default()
    }
} // End of function cyclic_draft()

/// The committed revision and the answered identity of a saved result.
fn committed(result: SaveResult) -> (ContentRevision, Option<MatchId>) {
    match result {
        SaveResult::Saved {
            committed: true,
            revision,
            moved,
            ..
        } => (revision, moved),
        other => panic!("expected a commit, got {other:?}"),
    }
} // End of function committed()

/// The failure an uncertain write answers with: the rename may have happened.
fn failure_after_the_rename(path: PathBuf) -> CommandError {
    CommandError::SaveFailed {
        error: SaveError::Write(WriteError::VerificationFailed {
            path,
            expected: ContentRevision::of_bytes(b"intended"),
            found: ContentRevision::of_bytes(b"found"),
        }),
    }
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

#[test]
fn a_snapshot_is_cut_in_rust_and_refused_for_a_stale_identity() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, _) = first(&session);
    let snapshot = session
        .match_authoring_snapshot(held)
        .expect("the snapshot is cut");
    let ContainerBaseline::Present { text, fingerprint } = &snapshot.vars else {
        panic!("the first match writes `vars`: {:?}", snapshot.vars);
    };
    assert!(
        CHAIN.contains(text.as_str()),
        "a byte-exact slice of the file"
    );
    assert!(text.contains("# shared between the two"), "{text:?}");
    assert_eq!(*fingerprint, ContentRevision::of_bytes(text.as_bytes()));
    assert_eq!(snapshot.form_fields, ContainerBaseline::Absent {});
    assert_eq!(snapshot.analysis.edges.len(), 1);

    // After a committed save every identity held for the file is stale, and a
    // snapshot cut from the new parse would be another revision's.
    let (_, base) = first(&session);
    session
        .move_variable(
            held,
            1,
            ListPlacement::Front {},
            base,
            &Acknowledgement::none(),
        )
        .expect("the move runs");
    let stale = session
        .match_authoring_snapshot(held)
        .expect_err("the identity was minted from the old revision");
    assert_eq!(stale.code(), "identityStaleRevision");
} // End of function a_snapshot_is_cut_in_rust_and_refused_for_a_stale_identity()

// ---------------------------------------------------------------------------
// The variable-reorder writer
// ---------------------------------------------------------------------------

#[test]
fn a_variable_reorder_commits_alone_and_answers_the_matchs_new_identity() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let result = session
        .move_variable(
            held,
            1,
            ListPlacement::Front {},
            base,
            &Acknowledgement::none(),
        )
        .expect("the move runs");
    let SaveResult::Saved { notes, .. } = &result else {
        panic!("expected a commit, got {result:?}");
    };
    assert!(notes.is_empty(), "a move re-encodes nothing");
    let (revision, moved) = committed(result);
    assert_eq!(bytes(&dir), CHAIN_B_FIRST, "the item's own bytes travel");
    assert_eq!(
        revision,
        ContentRevision::of_bytes(CHAIN_B_FIRST.as_bytes())
    );
    let found = session
        .match_view(moved.expect("the match is named in the new revision"))
        .expect("the answered identity resolves");
    assert_eq!(
        found.vars[0].name.as_ref().map(|name| name.text.as_str()),
        Some("b")
    );
} // End of function a_variable_reorder_commits_alone_and_answers_the_matchs_new_identity()

#[test]
fn a_stale_revision_or_identity_is_refused_before_a_reorder_is_planned() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let stale_revision = ContentRevision::of_bytes(b"a file this session never read");
    // Variable 9 does not exist: had anything been planned, the answer would
    // be `draftRefused`. It is the stale-revision code, so nothing was.
    let error = session
        .move_variable(
            held,
            9,
            ListPlacement::Front {},
            stale_revision,
            &Acknowledgement::none(),
        )
        .expect_err("a position in another parse must not be moved");
    assert_eq!(error.code(), "identityStaleRevision");
    let foreign = MatchId {
        revision: stale_revision,
        ..held
    };
    let error = session
        .move_variable(
            foreign,
            1,
            ListPlacement::Front {},
            base,
            &Acknowledgement::none(),
        )
        .expect_err("an identity minted from another revision");
    assert_eq!(error.code(), "identityStaleRevision");
    assert_eq!(bytes(&dir), CHAIN, "nothing was written");
} // End of function a_stale_revision_or_identity_is_refused_before_a_reorder_is_planned()

#[test]
fn a_reorder_the_planner_refuses_writes_nothing() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let view = session.document(base_id(&session)).expect("the file reads");
    let cases = [
        (held, 5, ListPlacement::Front {}, "TargetDoesNotExist"),
        (
            held,
            0,
            ListPlacement::Front {},
            "VariableMoveChangesNothing",
        ),
        (
            held,
            0,
            ListPlacement::After { index: 7 },
            "TargetDoesNotExist",
        ),
        (
            view.matches[1].id,
            0,
            ListPlacement::End {},
            "TargetDoesNotExist",
        ),
    ];
    for (id, variable, to, expected) in cases {
        let error = session
            .move_variable(id, variable, to, base, &Acknowledgement::none())
            .expect_err("the planner refuses");
        assert_eq!(error.code(), "draftRefused");
        let json = serde_json::to_value(&error).expect("serializes");
        assert!(
            json["error"].get(expected).is_some(),
            "expected {expected}, got {json}"
        );
    } // End of the loop over the refused moves
    assert_eq!(bytes(&dir), CHAIN);
    assert!(
        !dir.path().join(".espansoconfig-backups").exists(),
        "no transaction ran, so nothing was copied"
    );
} // End of function a_reorder_the_planner_refuses_writes_nothing()

#[test]
fn a_reorder_of_a_flow_vars_is_refused_by_name() {
    let source = "matches:\n  - trigger: ':f'\n    replace: '{{a}}'\n    vars: [{name: a, type: echo, params: {echo: x}}, {name: b, type: echo, params: {echo: y}}]\n";
    let dir = tree(source);
    let session = open(&dir);
    let (held, base) = first(&session);
    let error = session
        .move_variable(
            held,
            1,
            ListPlacement::Front {},
            base,
            &Acknowledgement::none(),
        )
        .expect_err("a flow list is never converted");
    let json = serde_json::to_value(&error).expect("serializes");
    assert!(json["error"].get("VarsIsAFlowList").is_some(), "{json}");
    assert_eq!(bytes(&dir), source);
} // End of function a_reorder_of_a_flow_vars_is_refused_by_name()

// ---------------------------------------------------------------------------
// The widened save_match
// ---------------------------------------------------------------------------

#[test]
fn a_content_edit_and_a_new_variable_commit_together_or_not_at_all() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let together = MatchDraft {
        replace: DraftField::Set("{{a}} {{b}} {{c}}".to_owned()),
        var_intents: vec![VarsIntent::insert(
            ListPlacement::End {},
            NewVariable::echo("c", "z"),
        )],
        ..MatchDraft::default()
    };
    let (_, moved) = committed(
        session
            .save_match(held, &together, base, &Acknowledgement::none())
            .expect("one batch, one save"),
    );
    let found = session.match_view(moved.expect("named")).expect("resolves");
    assert_eq!(found.vars.len(), 3);
    assert_eq!(
        found
            .content
            .replace
            .as_ref()
            .map(|value| value.text.as_str()),
        Some("{{a}} {{b}} {{c}}")
    );
    assert!(bytes(&dir).ends_with("  - trigger: ':v2'\n    replace: plain\n"));

    // The same content edit beside a variable the planner refuses: nothing at
    // all is written, the content edit included.
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let refused = MatchDraft {
        replace: DraftField::Set("{{a}} {{b}} {{c}}".to_owned()),
        var_intents: vec![VarsIntent::insert(
            ListPlacement::End {},
            NewVariable::echo("a", "duplicate"),
        )],
        ..MatchDraft::default()
    };
    let error = session
        .save_match(held, &refused, base, &Acknowledgement::none())
        .expect_err("a duplicate name refuses the whole draft");
    assert_eq!(error.code(), "draftRefused");
    assert_eq!(bytes(&dir), CHAIN, "the content edit was not written alone");
} // End of function a_content_edit_and_a_new_variable_commit_together_or_not_at_all()

#[test]
fn the_acknowledgement_round_trip_runs_from_the_analysis_to_the_save() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let operation = CandidateOperation::Draft {
        draft: Box::new(cyclic_draft()),
    };
    let judged = session
        .analyze_match_candidate(held, &operation, base, &Acknowledgement::none())
        .expect("the candidate is judged");
    assert_eq!(
        judged.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert!(judged.findings.iter().any(|finding| matches!(
        &finding.code,
        FindingCode::VariableDependencyCycle { revision, .. } if *revision == judged.candidate
    )));
    assert_eq!(bytes(&dir), CHAIN, "an analysis writes nothing");

    // Without consent the save is refused with the very same findings.
    let refused = session
        .save_match(held, &cyclic_draft(), base, &Acknowledgement::none())
        .expect("a refusal is an outcome");
    let SaveResult::Refused { findings, .. } = refused else {
        panic!("expected a refusal, got {refused:?}");
    };
    assert_eq!(
        Acknowledgement::of(&findings),
        Acknowledgement::of(&judged.findings),
        "the analysis and the save judge one candidate identically"
    );
    assert_eq!(bytes(&dir), CHAIN);

    // Consent taken from the analysis commits exactly that candidate.
    let (revision, _) = committed(
        session
            .save_match(
                held,
                &cyclic_draft(),
                base,
                &Acknowledgement::of(&judged.findings),
            )
            .expect("the acknowledged save proceeds"),
    );
    assert_eq!(
        revision, judged.candidate,
        "the analysed text is the committed text"
    );
} // End of function the_acknowledgement_round_trip_runs_from_the_analysis_to_the_save()

/// **Consent for a finding that carries no revision transfers between
/// candidates** — the 4-8 review's finding, pinned as the current, documented
/// behaviour rather than fixed.
///
/// `ReferenceHasNoDeclaration` names the missing reference and nothing about
/// the candidate, and an `Acknowledgement` is matched by finding equality
/// alone. So consent taken from candidate A's analysis commits a **different**
/// draft B that produces an equal finding. Only the five revision-carrying codes
/// are bound to one candidate; a caller must discard consent whenever the draft
/// changes, and nothing in Rust or TypeScript forces it to (`MatchCandidate`'s
/// documentation in `crates/espansoconfig-core/src/authoring.rs`).
#[test]
fn consent_for_an_unbound_finding_transfers_between_candidates() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    // Two different drafts of equal length, so the finding's span, node and
    // path are equal in both candidates.
    let draft = |text: &str| MatchDraft {
        replace: DraftField::Set(text.to_owned()),
        ..MatchDraft::default()
    };
    let (a, b) = (draft("{{ghost}} one"), draft("{{ghost}} two"));
    let judged = session
        .analyze_match_candidate(
            held,
            &CandidateOperation::Draft { draft: Box::new(a) },
            base,
            &Acknowledgement::none(),
        )
        .expect("candidate A is judged");
    assert_eq!(
        judged.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert!(
        !judged.findings.is_empty()
            && judged.findings.iter().all(|finding| matches!(
                finding.code,
                FindingCode::ReferenceHasNoDeclaration { .. }
            )),
        "candidate A's only suspicion is the unbound reference: {:?}",
        judged.findings
    );
    let candidate_b = session
        .analyze_match_candidate(
            held,
            &CandidateOperation::Draft {
                draft: Box::new(b.clone()),
            },
            base,
            &Acknowledgement::none(),
        )
        .expect("candidate B is judged");
    assert_ne!(
        candidate_b.candidate, judged.candidate,
        "two different candidates"
    );

    let (revision, _) = committed(
        session
            .save_match(held, &b, base, &Acknowledgement::of(&judged.findings))
            .expect("the save runs"),
    );
    assert_eq!(
        revision, candidate_b.candidate,
        "consent collected for candidate A was accepted for candidate B"
    );
    assert!(bytes(&dir).contains("replace: '{{ghost}} two'"));
} // End of function consent_for_an_unbound_finding_transfers_between_candidates()

#[test]
fn an_acknowledgements_span_is_compared_and_never_trusted() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let judged = session
        .analyze_match_candidate(
            held,
            &CandidateOperation::Draft {
                draft: Box::new(cyclic_draft()),
            },
            base,
            &Acknowledgement::none(),
        )
        .expect("judged");
    // A well-ordered span that is not the finding's: the multiset no longer
    // matches, so the save is refused rather than steered by it.
    let mut tampered = judged.findings.clone();
    for finding in &mut tampered {
        finding.span = Some(ByteSpan::new(0, 1));
    }
    let result = session
        .save_match(held, &cyclic_draft(), base, &Acknowledgement::of(&tampered))
        .expect("a refusal is an outcome");
    assert!(
        matches!(result, SaveResult::Refused { .. }),
        "a changed span is a different finding: {result:?}"
    );
    assert_eq!(bytes(&dir), CHAIN);

    // An inverted span cannot even be read: `ByteSpan`'s `Deserialize` routes
    // through `ByteSpan::new`'s check (R28).
    let mut json = serde_json::to_value(Acknowledgement::of(&judged.findings)).expect("serializes");
    json["accepted"][0]["span"] = serde_json::json!({ "start": 9, "end": 2 });
    assert!(
        serde_json::from_value::<Acknowledgement>(json).is_err(),
        "an inverted span is refused while the arguments are read"
    );
} // End of function an_acknowledgements_span_is_compared_and_never_trusted()

#[test]
fn a_no_op_is_no_change_in_the_analysis_and_no_commit_in_the_save() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let judged = session
        .analyze_match_candidate(
            held,
            &CandidateOperation::Draft {
                draft: Box::new(MatchDraft::default()),
            },
            base,
            &Acknowledgement::none(),
        )
        .expect("judged");
    assert!(!judged.changes);
    assert_eq!(judged.candidate, base);
    match session
        .save_match(held, &MatchDraft::default(), base, &Acknowledgement::none())
        .expect("a no-op is a success")
    {
        SaveResult::Saved {
            committed,
            revision,
            backup_taken,
            ..
        } => {
            assert!(!committed);
            assert!(!backup_taken);
            assert_eq!(revision, base);
        }
        other => panic!("expected a saved result, got {other:?}"),
    }
    assert_eq!(bytes(&dir), CHAIN);
    session
        .match_authoring_snapshot(held)
        .expect("nothing became stale");
} // End of function a_no_op_is_no_change_in_the_analysis_and_no_commit_in_the_save()

// ---------------------------------------------------------------------------
// Candidate analysis refusals
// ---------------------------------------------------------------------------

#[test]
fn the_analysis_refuses_stale_input_and_names_what_it_could_not_judge() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let stale = ContentRevision::of_bytes(b"another revision");
    let operation = CandidateOperation::VariableMove {
        variable: 9,
        to: ListPlacement::Front {},
    };
    let error = session
        .analyze_match_candidate(held, &operation, stale, &Acknowledgement::none())
        .expect_err("a stale base revision is refused before planning");
    assert_eq!(error.code(), "identityStaleRevision");
    let error = session
        .analyze_match_candidate(
            MatchId {
                revision: stale,
                ..held
            },
            &operation,
            base,
            &Acknowledgement::none(),
        )
        .expect_err("a stale identity is refused");
    assert_eq!(error.code(), "identityStaleRevision");
    let error = session
        .analyze_match_candidate(held, &operation, base, &Acknowledgement::none())
        .expect_err("variable 9 does not exist");
    assert_eq!(error.code(), "draftRefused");

    // A package file is read-only: the preflight refuses it, as a candidate
    // refusal rather than as a failed save — no save was attempted.
    let dir = TempDir::new().expect("temp dir");
    let package = dir.path().join("match").join("packages").join("one");
    fs::create_dir_all(&package).expect("the package directory");
    fs::write(package.join("package.yml"), CHAIN).expect("the package file");
    let session = open(&dir);
    let document = session
        .documents()
        .expect("open")
        .iter()
        .find(|summary| summary.read_only)
        .expect("the package is listed read-only")
        .id;
    let view = session.document(document).expect("the package reads");
    let error = session
        .analyze_match_candidate(
            view.matches[0].id,
            &CandidateOperation::Draft {
                draft: Box::new(cyclic_draft()),
            },
            view.revision,
            &Acknowledgement::none(),
        )
        .expect_err("a package cannot be written, so its candidate is not judged");
    assert_eq!(error.code(), "candidateRefused");
    let json = serde_json::to_value(&error).expect("serializes");
    assert!(json["error"].get("DocumentIsReadOnly").is_some(), "{json}");
    assert!(
        json.get("may_have_written").is_none(),
        "nothing could have been written"
    );
} // End of function the_analysis_refuses_stale_input_and_names_what_it_could_not_judge()

// ---------------------------------------------------------------------------
// The one save tail, and no second lock
// ---------------------------------------------------------------------------

/// Runs `writer` against the open workspace with a tail that first proves no
/// path lock on `path` is held — by taking it from another thread under a
/// bounded wait — and then runs the real [`run_one_save`].
fn through_a_probing_tail(
    session: &WorkspaceSession,
    path: PathBuf,
    writer: impl FnOnce(
        &mut Workspace,
        SessionSideOfASave<'_>,
        &mut super::SaveTail<'_>,
    ) -> Result<SaveResult, CommandError>,
) -> (Result<SaveResult, CommandError>, usize) {
    let mut reached = 0usize;
    let mut probing =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            reached += 1;
            let probe = path.clone();
            let (sender, receiver) = mpsc::channel();
            std::thread::spawn(move || {
                drop(lock_path(&probe).expect("the lock resolves"));
                let _ = sender.send(());
            });
            receiver
                .recv_timeout(Duration::from_secs(10))
                .expect("no path lock is held around run_one_save");
            run_one_save(workspace, side, save)
        }; // End of the probing closure
    let result = session.with_open(|workspace, side| writer(workspace, side, &mut probing));
    (result, reached)
} // End of function through_a_probing_tail()

#[test]
fn both_writers_reach_the_one_tail_holding_no_path_lock() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let (result, reached) =
        through_a_probing_tail(&session, target(&dir), |workspace, side, save| {
            move_one_variable(
                workspace,
                side,
                held,
                (1, ListPlacement::Front {}),
                base,
                &Acknowledgement::none(),
                save,
            )
        });
    assert_eq!(reached, 1, "the reorder reached the tail exactly once");
    let (revision, moved) = committed(result.expect("the move runs"));
    assert_eq!(bytes(&dir), CHAIN_B_FIRST);

    let moved = moved.expect("named");
    let draft = MatchDraft {
        replace: DraftField::Set("{{b}} {{a}}".to_owned()),
        ..MatchDraft::default()
    };
    let (result, reached) =
        through_a_probing_tail(&session, target(&dir), |workspace, side, save| {
            save_one_match(
                workspace,
                side,
                moved,
                &draft,
                revision,
                &Acknowledgement::none(),
                save,
            )
        });
    assert_eq!(reached, 1, "the drafted save reached the tail exactly once");
    committed(result.expect("the save runs"));
} // End of function both_writers_reach_the_one_tail_holding_no_path_lock()

#[test]
fn the_analysis_takes_no_path_lock() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    // Held for the whole analysis: an analysis that tried to take it would
    // wait forever, and the bounded wait turns that into a failure.
    let _lock = lock_path(&target(&dir)).expect("the lock is taken");
    std::thread::scope(|scope| {
        let (sender, receiver) = mpsc::channel();
        let session = &session;
        scope.spawn(move || {
            let judged = session.analyze_match_candidate(
                held,
                &CandidateOperation::VariableMove {
                    variable: 1,
                    to: ListPlacement::Front {},
                },
                base,
                &Acknowledgement::none(),
            );
            let _ = sender.send(judged.map(|candidate| candidate.changes));
        });
        let changes = receiver
            .recv_timeout(Duration::from_secs(10))
            .expect("the analysis returns while the path lock is held elsewhere")
            .expect("judged");
        assert!(changes);
    });
    assert_eq!(bytes(&dir), CHAIN);
} // End of function the_analysis_takes_no_path_lock()

// ---------------------------------------------------------------------------
// An uncertain outcome
// ---------------------------------------------------------------------------

#[test]
fn an_uncertain_outcome_is_an_error_that_says_it_may_have_written() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let path = target(&dir);
    // The real tail commits; the answer is then the one a rename that could not
    // be verified gives. The writer must hand it on as it is: an error, never a
    // success, never a refusal, and saying the file may have changed.
    let mut uncertain =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            run_one_save(workspace, side, save)?;
            Err(failure_after_the_rename(path.clone()))
        };
    let error = session
        .with_open(|workspace, side| {
            move_one_variable(
                workspace,
                side,
                held,
                (1, ListPlacement::Front {}),
                base,
                &Acknowledgement::none(),
                &mut uncertain,
            )
        })
        .expect_err("an uncertain write is never reported as a success");
    assert_eq!(error.code(), "saveFailed");
    let json = serde_json::to_value(&error).expect("serializes");
    assert_eq!(json["may_have_written"], true, "{json}");
    assert_eq!(
        bytes(&dir),
        CHAIN_B_FIRST,
        "the file may indeed have changed"
    );
    let stale = session
        .match_authoring_snapshot(held)
        .expect_err("the session does not keep describing the bytes it had");
    assert_eq!(stale.code(), "identityStaleRevision");

    // The same answer through the widened save_match's own seam.
    let (held, base) = first(&session);
    let mut uncertain = |_: &mut Workspace,
                         _: SessionSideOfASave<'_>,
                         _: OneSave<'_>|
     -> Result<SaveResult, CommandError> {
        Err(failure_after_the_rename(target(&dir)))
    };
    let error = session
        .with_open(|workspace, side| {
            save_one_match(
                workspace,
                side,
                held,
                &cyclic_draft(),
                base,
                &Acknowledgement::none(),
                &mut uncertain,
            )
        })
        .expect_err("handed on as an error");
    let json = serde_json::to_value(&error).expect("serializes");
    assert_eq!(json["may_have_written"], true, "{json}");
} // End of function an_uncertain_outcome_is_an_error_that_says_it_may_have_written()

#[test]
fn a_committed_reorder_records_only_the_revision_it_committed() {
    let dir = tree(CHAIN);
    let session = open(&dir);
    let (held, base) = first(&session);
    let (revision, _) = committed(
        session
            .move_variable(
                held,
                1,
                ListPlacement::Front {},
                base,
                &Acknowledgement::none(),
            )
            .expect("the move runs"),
    );
    let recorded = session.ledger().recorded_write(base_id(&session));
    assert_eq!(
        recorded.map(|write| write.revision),
        Some(revision),
        "the one app-write record is the committed revision"
    );
} // End of function a_committed_reorder_records_only_the_revision_it_committed()
