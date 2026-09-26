//! Phase 4-8 acceptance, core half: revision-bound authoring snapshots and
//! candidate analysis (`docs/decisions/4-split-notes.md` §2, step 4-8).
//!
//! What this file pins:
//!
//! - a snapshot cuts each whole container in Rust, byte for byte — CRLF, a
//!   comment inside the hull and non-ASCII text before the span included — and
//!   its fingerprint is the hash of exactly that text;
//! - absent, flow-empty and block containers are three different baselines;
//! - the analysis summary carries positions and Rust-cut text, never a byte
//!   span, and a layout's pieces reproduce the layout exactly;
//! - a candidate analysis runs the save gate's own findings pass: a variable
//!   operation that introduces a cycle is told, bound to the candidate
//!   revision (one of the five revision-carrying codes), and that consent
//!   commits exactly that candidate on disk;
//! - a reorder's candidate carries the order advisory ruling 11 owes it;
//! - a no-op draft is `changes: false` at the base revision;
//! - the one inbound type carries no span and refuses unknown fields.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::authoring::{
    analyze_candidate, authoring_snapshot, CandidateOperation, ContainerBaseline, LayoutPiece,
};
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::{ListPlacement, MatchDraft, NewVariable, VarsIntent};
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::persist::{
    save_document, Acknowledgement, SaveContent, SaveError, SaveRequest, SaveVerdict,
};
use espansoconfig_core::validate::FindingCode;
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId, SourceDocument};
use serde_json::Value;

/// A match with a block `vars` (a comment inside its hull) and a shorthand
/// form with `form_fields`, after a label holding non-ASCII text.
const AUTHORED: &str = "\
matches:
  - trigger: ':one'
    label: 'café 😀'
    replace: '{{a}} {{b}}'
    vars:
      - name: a
        type: echo
        params:
          echo: 'x'
      # a comment the first variable does not own
      - name: b
        type: echo
        depends_on:
          - a
        params:
          echo: 'y'
  - trigger: ':two'
    form: 'Hi [[name]], [[ bad ]] {{form1.name}} [[name]]'
    form_fields:
      name:
        type: text
      unused:
        type: text
  - trigger: ':three'
    replace: none
    vars: []
";

/// A document context for an inline fixture.
fn context(path: &std::path::Path) -> DocumentContext {
    DocumentContext {
        id: DocumentId(1),
        path: path.to_path_buf(),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    }
} // End of function context()

/// `source` projected under a context whose path is `path`.
fn projected(path: &std::path::Path, source: &str) -> SourceDocument {
    project_source(&context(path), source)
}

/// The text and fingerprint of a present baseline.
fn present(baseline: &ContainerBaseline) -> (&str, ContentRevision) {
    match baseline {
        ContainerBaseline::Present { text, fingerprint } => (text.as_str(), *fingerprint),
        other => panic!("expected a present container, got {other:?}"),
    }
}

/// Every object key anywhere inside `value`.
fn every_key(value: &Value, keys: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, inner) in map {
                keys.push(key.clone());
                every_key(inner, keys);
            }
        }
        Value::Array(items) => items.iter().for_each(|item| every_key(item, keys)),
        _ => {}
    }
} // End of function every_key()

#[test]
fn a_snapshot_cuts_each_whole_container_in_rust() {
    let document = projected(std::path::Path::new("/nowhere/base.yml"), AUTHORED);
    let first = &document.view.matches[0];
    let snapshot = authoring_snapshot(&document, first);
    assert_eq!(snapshot.id, first.id);
    let (text, fingerprint) = present(&snapshot.vars);
    assert!(text.starts_with("- name: a\n"), "{text:?}");
    assert!(
        text.contains("      # a comment the first variable does not own\n"),
        "a comment inside the hull is part of the container text: {text:?}"
    );
    assert!(text.ends_with("echo: 'y'"), "{text:?}");
    assert_eq!(fingerprint, ContentRevision::of_bytes(text.as_bytes()));
    assert!(
        AUTHORED.contains(text),
        "the cut is a byte-exact slice even after non-ASCII text"
    );
    assert_eq!(snapshot.form_fields, ContainerBaseline::Absent {});

    let second = authoring_snapshot(&document, &document.view.matches[1]);
    assert_eq!(second.vars, ContainerBaseline::Absent {});
    let (fields, _) = present(&second.form_fields);
    assert!(fields.starts_with("name:\n"), "{fields:?}");
    assert!(fields.ends_with("type: text"), "{fields:?}");

    let third = authoring_snapshot(&document, &document.view.matches[2]);
    assert_eq!(
        present(&third.vars).0,
        "[]",
        "a flow-empty list is its brackets"
    );
} // End of function a_snapshot_cuts_each_whole_container_in_rust()

#[test]
fn a_crlf_container_keeps_its_carriage_returns() {
    let source = AUTHORED.replace('\n', "\r\n");
    let document = projected(std::path::Path::new("/nowhere/base.yml"), &source);
    let snapshot = authoring_snapshot(&document, &document.view.matches[0]);
    let (text, fingerprint) = present(&snapshot.vars);
    assert!(text.contains("- name: a\r\n"), "{text:?}");
    assert_eq!(fingerprint, ContentRevision::of_bytes(text.as_bytes()));
    let lf = projected(std::path::Path::new("/nowhere/base.yml"), AUTHORED);
    assert_ne!(
        fingerprint,
        present(&authoring_snapshot(&lf, &lf.view.matches[0]).vars).1,
        "a line-ending change is a container change"
    );
} // End of function a_crlf_container_keeps_its_carriage_returns()

#[test]
fn the_summary_is_positions_and_rust_cut_text_never_a_span() {
    let document = projected(std::path::Path::new("/nowhere/base.yml"), AUTHORED);
    let first = authoring_snapshot(&document, &document.view.matches[0]);
    let analysis = &first.analysis;
    assert_eq!(analysis.declarations.len(), 2);
    assert_eq!(analysis.declarations[1].name.as_deref(), Some("b"));
    assert_eq!(analysis.edges.len(), 1);
    assert_eq!(
        (analysis.edges[0].consumer, analysis.edges[0].dependency),
        (1, 0)
    );
    assert!(analysis.cycles.is_empty());

    let second = authoring_snapshot(&document, &document.view.matches[1]);
    let layout = second
        .analysis
        .shorthand_form
        .as_ref()
        .expect("the second match has a shorthand layout");
    assert!(!layout.fully_supported, "`[[ bad ]]` is malformed");
    assert_eq!(layout.definitions_without_occurrence, vec!["unused"]);
    let rebuilt: String = layout
        .pieces
        .iter()
        .map(|piece| match piece {
            LayoutPiece::Text { text } | LayoutPiece::Malformed { text, .. } => text.clone(),
            LayoutPiece::Placeholder { name } => format!("[[{name}]]"),
            LayoutPiece::Uncut {} => panic!("nothing is uncut in a parsed layout"),
        })
        .collect();
    assert_eq!(
        rebuilt, "Hi [[name]], [[ bad ]] {{form1.name}} [[name]]",
        "the pieces reproduce the layout exactly"
    );
    assert_eq!(second.analysis.unverified_layout_references.len(), 1);
    assert_eq!(
        second.analysis.unverified_layout_references[0]
            .subname
            .as_deref(),
        Some("name")
    );

    for snapshot in [&first, &second] {
        let json = serde_json::to_value(snapshot).expect("a snapshot serializes");
        let mut keys = Vec::new();
        every_key(&json, &mut keys);
        assert!(
            !keys.iter().any(|key| key.contains("span")),
            "no byte span crosses in a snapshot: {keys:?}"
        );
    } // End of the loop over the two snapshots
} // End of function the_summary_is_positions_and_rust_cut_text_never_a_span()

#[test]
fn every_analysis_enum_crosses_as_a_uniform_shape() {
    let imported = "imports:\n  - other.yml\nmatches:\n  - regex: '(?P<x'\n    replace: y\n";
    let document = projected(std::path::Path::new("/nowhere/base.yml"), imported);
    let snapshot = authoring_snapshot(&document, &document.view.matches[0]);
    let json = serde_json::to_value(&snapshot.analysis).expect("serializes");
    let reasons = json["incomplete"].as_array().expect("a list");
    assert!(reasons.len() >= 2, "{json}");
    for reason in reasons {
        let object = reason
            .as_object()
            .expect("every reason is a one-key object");
        assert_eq!(object.len(), 1, "{reason}");
        assert!(object.values().all(Value::is_object), "{reason}");
    }
    assert!(reasons
        .iter()
        .any(|reason| reason == &serde_json::json!({ "ImportsOpenScope": {} })));
    assert!(!snapshot.analysis.scope_closed);
} // End of function every_analysis_enum_crosses_as_a_uniform_shape()

/// A draft inserting a self-dependent variable beside a content edit.
fn cyclic_draft() -> MatchDraft {
    MatchDraft {
        replace: espansoconfig_core::draft::DraftField::Set("{{a}} {{b}} {{c}}".to_owned()),
        var_intents: vec![VarsIntent::insert(
            ListPlacement::End {},
            NewVariable::echo("c", "z").with_depends_on(vec!["c".to_owned()]),
        )],
        ..MatchDraft::default()
    }
} // End of function cyclic_draft()

#[test]
fn a_candidate_is_judged_by_the_saves_own_findings_and_its_consent_commits_it() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    std::fs::write(&target, AUTHORED).expect("the fixture is written");
    let document = projected(&target, AUTHORED);
    let found = &document.view.matches[0];
    let operation = CandidateOperation::Draft {
        draft: Box::new(cyclic_draft()),
    };
    let edits = operation.plan(found).expect("the draft plans");

    let judged = analyze_candidate(
        &context(&target),
        AUTHORED,
        found,
        &edits,
        &Acknowledgement::none(),
    )
    .expect("the candidate is judged");
    assert!(judged.changes);
    assert_eq!(
        judged.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    let cycle = judged
        .findings
        .iter()
        .find_map(|finding| match &finding.code {
            FindingCode::VariableDependencyCycle { revision, size, .. } => Some((*revision, *size)),
            _ => None,
        })
        .expect("the new self-dependency is told");
    assert_eq!(
        cycle,
        (judged.candidate, 1),
        "bound to the candidate revision"
    );
    let analysis = judged
        .analysis
        .as_ref()
        .expect("the match is in the candidate");
    assert_eq!(analysis.declarations.len(), 3);
    assert_eq!(analysis.cycles.len(), 1);
    assert_eq!(analysis.cycles[0].members, vec![2]);

    // The same findings, acknowledged, proceed in the analysis and commit on
    // disk — the acknowledgement round trip, through the one writer.
    let consent = Acknowledgement::of(&judged.findings);
    let again = analyze_candidate(&context(&target), AUTHORED, found, &edits, &consent)
        .expect("judged again");
    assert_eq!(again.verdict, SaveVerdict::Proceed);
    let refused = save_document(SaveRequest {
        context: &context(&target),
        base_revision: document.revision,
        content: SaveContent::Edits(&edits),
        acknowledgement: &Acknowledgement::none(),
        backups: None,
    })
    .expect_err("no consent, no commit");
    assert!(matches!(refused, SaveError::Refused(_)), "{refused:?}");
    assert_eq!(
        std::fs::read_to_string(&target).expect("readable"),
        AUTHORED
    );
    let saved = save_document(SaveRequest {
        context: &context(&target),
        base_revision: document.revision,
        content: SaveContent::Edits(&edits),
        acknowledgement: &consent,
        backups: None,
    })
    .expect("the consent is for exactly this candidate");
    assert!(saved.committed);
    assert_eq!(
        saved.revision, judged.candidate,
        "the analysed candidate is the committed text"
    );
} // End of function a_candidate_is_judged_by_the_saves_own_findings_and_its_consent_commits_it()

#[test]
fn a_reorders_candidate_carries_the_order_advisory() {
    let document = projected(std::path::Path::new("/nowhere/base.yml"), AUTHORED);
    let found = &document.view.matches[0];
    let operation = CandidateOperation::VariableMove {
        variable: 1,
        to: ListPlacement::Front {},
    };
    let edits = operation.plan(found).expect("the move plans");
    assert_eq!(edits.len(), 1, "a reorder is alone in its batch (R25)");
    let judged = analyze_candidate(
        &context(std::path::Path::new("/nowhere/base.yml")),
        AUTHORED,
        found,
        &edits,
        &Acknowledgement::none(),
    )
    .expect("judged");
    assert!(judged.changes);
    let analysis = judged.analysis.expect("the match is in the candidate");
    assert_eq!(analysis.declarations[0].name.as_deref(), Some("b"));
    assert_eq!(analysis.order_advisories.len(), 1);
    assert_eq!(
        (
            analysis.order_advisories[0].consumer,
            analysis.order_advisories[0].dependency
        ),
        (0, 1),
        "the consumer now precedes its dependency"
    );
} // End of function a_reorders_candidate_carries_the_order_advisory()

#[test]
fn a_draft_that_changes_nothing_is_no_change_at_the_base_revision() {
    let document = projected(std::path::Path::new("/nowhere/base.yml"), AUTHORED);
    let found = &document.view.matches[0];
    let edits = CandidateOperation::Draft {
        draft: Box::new(MatchDraft::default()),
    }
    .plan(found)
    .expect("an empty draft plans");
    assert!(edits.is_empty());
    let judged = analyze_candidate(
        &context(std::path::Path::new("/nowhere/base.yml")),
        AUTHORED,
        found,
        &edits,
        &Acknowledgement::none(),
    )
    .expect("judged");
    assert!(!judged.changes);
    assert_eq!(judged.candidate, document.revision);
    assert_eq!(judged.verdict, SaveVerdict::Proceed);
    assert_eq!(
        judged.analysis.as_ref(),
        Some(&authoring_snapshot(&document, found).analysis),
        "an unchanged candidate is analysed exactly as the base"
    );
} // End of function a_draft_that_changes_nothing_is_no_change_at_the_base_revision()

#[test]
fn the_inbound_operation_carries_no_span_and_refuses_unknown_fields() {
    let moved: CandidateOperation = serde_json::from_value(serde_json::json!({
        "VariableMove": { "variable": 1, "to": { "Front": {} } }
    }))
    .expect("a move reads");
    assert_eq!(
        moved,
        CandidateOperation::VariableMove {
            variable: 1,
            to: ListPlacement::Front {},
        }
    );
    for refused in [
        serde_json::json!({ "VariableMove": { "variable": 1, "to": { "End": {} },
            "span": { "start": 0, "end": 4 } } }),
        serde_json::json!({ "Draft": { "draft": {}, "at": { "start": 0, "end": 4 } } }),
        serde_json::json!({ "Span": { "start": 0, "end": 4 } }),
    ] {
        assert!(
            serde_json::from_value::<CandidateOperation>(refused.clone()).is_err(),
            "{refused} must not be read"
        );
    } // End of the loop over the refused shapes
} // End of function the_inbound_operation_carries_no_span_and_refuses_unknown_fields()
