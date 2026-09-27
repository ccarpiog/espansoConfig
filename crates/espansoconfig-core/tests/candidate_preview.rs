//! Phase 4-19-1: an unsaved drafted operation previewed over its candidate
//! (`authoring::preview_candidate`; `docs/decisions/4-19-1-notes.md`).
//!
//! What this file pins:
//!
//! - the preview is the one a saved candidate would get: the same planner, the
//!   same patch, the same projection, then `preview::preview_match`;
//! - sample positions belong to the candidate, not to the saved revision;
//! - the answer carries the candidate's analysis beside its preview;
//! - a read-only document is refused exactly as the save preflight refuses it.
//!
//! The function takes `&str` and returns a value, so "writes nothing" is a
//! property of its signature here; the command layer's no-lock, no-write
//! evidence is `src-tauri/src/commands/preview_check.rs`.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::authoring::{preview_candidate, CandidateOperation};
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::{DraftField, ListPlacement, MatchDraft, NewVariable, VarsIntent};
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::persist::{preflight_candidate, Acknowledgement, SaveError};
use espansoconfig_core::preview::{
    preview_match, PreviewSamples, PreviewSegment, PreviewSource, SelectionSample,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// A neutral context of `kind`.
fn context(kind: FileKind) -> DocumentContext {
    DocumentContext {
        id: DocumentId(1),
        path: std::path::PathBuf::from("/nowhere/base.yml"),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind,
        disabled: false,
    }
}

/// One snippet with one echo variable.
const SOURCE: &str = "\
matches:
  - trigger: ':p'
    replace: 'saved {{a}}'
    vars:
      - name: a
        type: echo
        params:
          echo: first
";

/// A draft replacing the content and inserting a second echo at the front.
fn draft() -> MatchDraft {
    MatchDraft {
        replace: DraftField::Set("<b>{{a}}</b> {{b}}".to_owned()),
        var_intents: vec![VarsIntent::insert(
            ListPlacement::Front {},
            NewVariable::echo("b", "second"),
        )],
        ..MatchDraft::default()
    }
} // End of function draft()

/// A sample text segment.
fn sample(text: &str, index: usize) -> PreviewSegment {
    PreviewSegment::Sample {
        text: text.to_owned(),
        source: PreviewSource::Local { index },
    }
}

#[test]
fn a_draft_is_previewed_as_its_candidate_would_be() {
    let context = context(FileKind::MatchFile);
    let document = project_source(&context, SOURCE);
    let found = &document.view.matches[0];
    let edits = CandidateOperation::Draft {
        draft: Box::new(draft()),
    }
    .plan(found)
    .expect("the draft plans");
    let answer = preview_candidate(&context, SOURCE, found, &edits, &PreviewSamples::default())
        .expect("the candidate previews");
    let preview = answer
        .preview
        .as_ref()
        .expect("the candidate holds the match");
    // The inserted `b` is at position 0 of the candidate; `a` moved to 1.
    assert_eq!(
        preview.bodies[0].segments,
        vec![
            PreviewSegment::Literal {
                text: "<b>".to_owned()
            },
            sample("first", 1),
            PreviewSegment::Literal {
                text: "</b> ".to_owned()
            },
            sample("second", 0),
        ]
    );
    // The same candidate a save's preflight would judge, previewed the same way
    // a saved match is.
    let judged = preflight_candidate(&context, SOURCE, &edits, &Acknowledgement::none())
        .expect("the preflight runs");
    assert_eq!(answer.candidate, judged.preflight.candidate);
    let reparsed = project_source(&context, &judged.text);
    assert_eq!(
        preview,
        &preview_match(
            &reparsed.view,
            &reparsed.view.matches[0],
            &PreviewSamples::default()
        )
    );
    let analysis = answer.analysis.as_ref().expect("analysed with the preview");
    let names: Vec<Option<&str>> = analysis
        .declarations
        .iter()
        .map(|declaration| declaration.name.as_deref())
        .collect();
    assert_eq!(
        names,
        vec![Some("b"), Some("a")],
        "the candidate's positions"
    );
} // End of function a_draft_is_previewed_as_its_candidate_would_be()

#[test]
fn sample_positions_belong_to_the_candidate() {
    let source = "\
matches:
  - trigger: ':p'
    replace: '{{c}}'
    vars:
      - name: c
        type: choice
        params:
          values:
            - one
            - two
";
    let context = context(FileKind::MatchFile);
    let document = project_source(&context, source);
    let found = &document.view.matches[0];
    let moved = MatchDraft {
        var_intents: vec![VarsIntent::insert(
            ListPlacement::Front {},
            NewVariable::echo("x", "unused"),
        )],
        ..MatchDraft::default()
    };
    let edits = CandidateOperation::Draft {
        draft: Box::new(moved),
    }
    .plan(found)
    .expect("the draft plans");
    let at = |index: usize| PreviewSamples {
        selections: vec![SelectionSample {
            variable: PreviewSource::Local { index },
            index: 1,
        }],
        ..PreviewSamples::default()
    };
    // Addressed by the saved position 0, the sample names the inserted echo,
    // which is not a choice: the choice has no sample.
    let saved_position = preview_candidate(&context, source, found, &edits, &at(0))
        .expect("previews")
        .preview
        .expect("held");
    assert_ne!(saved_position.bodies[0].segments, vec![sample("two", 1)]);
    // Addressed by its candidate position 1, it is the choice's second entry.
    let candidate_position = preview_candidate(&context, source, found, &edits, &at(1))
        .expect("previews")
        .preview
        .expect("held");
    assert_eq!(
        candidate_position.bodies[0].segments,
        vec![sample("two", 1)]
    );
} // End of function sample_positions_belong_to_the_candidate()

#[test]
fn a_read_only_document_is_refused_as_the_save_preflight_refuses_it() {
    let context = context(FileKind::Package);
    let document = project_source(&context, SOURCE);
    let found = &document.view.matches[0];
    let edits = CandidateOperation::Draft {
        draft: Box::new(draft()),
    }
    .plan(found)
    .expect("the draft plans");
    let refused = preview_candidate(&context, SOURCE, found, &edits, &PreviewSamples::default())
        .expect_err("a package is read-only");
    assert!(
        matches!(refused, SaveError::DocumentIsReadOnly { .. }),
        "{refused:?}"
    );
} // End of function a_read_only_document_is_refused_as_the_save_preflight_refuses_it()
