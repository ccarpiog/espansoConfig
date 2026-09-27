//! Phase 4-17's command-level evidence: `preview_match` is a reader over the
//! cached, revision-bound parse (`docs/decisions/4-split-notes.md` §2, step
//! 4-17).
//!
//! Driven through the session on real temporary files:
//!
//! - the answer is the core's preview of the parse the session holds, and a
//!   second identical request answers identically;
//! - a stale identity is refused with `identityStaleRevision` (D2v), never
//!   unwrapped;
//! - the preview takes no path lock, writes no byte, and runs neither the
//!   authored shell command nor the script;
//! - a date variable (Phase 4-18) is shown at the instant and zone the request
//!   carries, and answers `DateInstantMissing` without one;
//! - `preview_match_candidate` (Phase 4-19-1) previews an unsaved draft over its
//!   candidate — the draft's text, not the saved text — and, like the saved
//!   preview, takes no path lock, writes no byte, runs nothing, and refuses a
//!   stale base revision and an unplannable draft by code.
//!
//! Every fixture is synthetic and neutral (`CLAUDE.md` section 1).

use std::fs;
use std::sync::mpsc;
use std::time::Duration;

use espansoconfig_core::authoring::CandidateOperation;
use espansoconfig_core::draft::{DraftField, ListPlacement, MatchDraft};
use espansoconfig_core::model::MatchId;
use espansoconfig_core::persist::{lock_path, Acknowledgement};
use espansoconfig_core::preview::{
    PreviewPlaceholder, PreviewSamples, PreviewSegment, PreviewSource, PreviewUnresolved,
    SampleInstant, SampleZone, SelectionSample,
};
use espansoconfig_core::{ContentRevision, DocumentId};
use tempfile::TempDir;

use super::WorkspaceSession;

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

/// The first match's identity and the document's revision.
fn first(session: &WorkspaceSession) -> (MatchId, ContentRevision) {
    let view = session.document(base_id(session)).expect("the file reads");
    (view.matches[0].id, view.revision)
}

/// A snippet with a choice, a shell command and a script whose running would
/// create `marker`.
fn fixture(marker: &std::path::Path) -> String {
    format!(
        "\
matches:
  - trigger: ':p'
    replace: '{{{{pick}}}} {{{{sh}}}} {{{{sc}}}}'
    vars:
      - name: pick
        type: choice
        params:
          values:
            - one
            - two
      - name: sh
        type: shell
        params:
          cmd: 'touch {marker}'
      - name: sc
        type: script
        params:
          args:
            - /usr/bin/touch
            - '{marker}'
",
        marker = marker.display()
    )
} // End of function fixture()

/// Samples selecting the second choice.
fn second_choice() -> PreviewSamples {
    PreviewSamples {
        selections: vec![SelectionSample {
            variable: PreviewSource::Local { index: 0 },
            index: 1,
        }],
        ..PreviewSamples::default()
    }
}

#[test]
fn a_preview_answers_the_cached_parse_and_refuses_a_stale_identity() {
    let scratch = TempDir::new().expect("a scratch directory");
    let marker = scratch.path().join("ran");
    let source = fixture(&marker);
    let dir = tree(&source);
    let session = open(&dir);
    let (held, base) = first(&session);
    let preview = session
        .preview_match(held, &second_choice())
        .expect("the preview answers");
    assert_eq!(preview.limit, None);
    let segments = &preview.bodies[0].segments;
    assert_eq!(
        segments[0],
        PreviewSegment::Sample {
            text: "two".to_owned(),
            source: PreviewSource::Local { index: 0 },
        }
    );
    assert!(segments.contains(&PreviewSegment::Placeholder {
        source: PreviewSource::Local { index: 1 },
        placeholder: PreviewPlaceholder::Shell {
            command: Some(format!("touch {}", marker.display())),
        },
    }));
    // The core's own answer over the same text, and the same again.
    let document = session.document(base_id(&session)).expect("the file reads");
    let core = espansoconfig_core::preview::preview_match(
        &document,
        &document.matches[0],
        &second_choice(),
    );
    assert_eq!(preview, core);
    assert_eq!(
        session
            .preview_match(held, &second_choice())
            .expect("again"),
        preview,
        "identical requests give identical output"
    );
    assert!(!marker.exists(), "no command or script was run");
    assert_eq!(
        fs::read_to_string(dir.path().join("match/base.yml")).expect("reads"),
        source
    );

    // After a committed save the held identity names another revision, and
    // positions in the samples would be that revision's: refused, by code.
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
        .preview_match(held, &second_choice())
        .expect_err("the identity was minted from the old revision");
    assert_eq!(stale.code(), "identityStaleRevision");
} // End of function a_preview_answers_the_cached_parse_and_refuses_a_stale_identity()

#[test]
fn a_preview_takes_no_path_lock_and_writes_nothing() {
    let scratch = TempDir::new().expect("a scratch directory");
    let marker = scratch.path().join("ran");
    let source = fixture(&marker);
    let dir = tree(&source);
    let session = open(&dir);
    let (held, _) = first(&session);
    // Held for the whole preview: a preview that tried to take it would wait
    // forever, and the bounded wait turns that into a failure.
    let _lock = lock_path(&dir.path().join("match").join("base.yml")).expect("the lock is taken");
    std::thread::scope(|scope| {
        let (sender, receiver) = mpsc::channel();
        let session = &session;
        scope.spawn(move || {
            let _ = sender.send(session.preview_match(held, &PreviewSamples::default()));
        });
        let preview = receiver
            .recv_timeout(Duration::from_secs(10))
            .expect("the preview returns while the path lock is held elsewhere")
            .expect("previewed");
        assert_eq!(preview.bodies.len(), 1);
    });
    assert_eq!(
        fs::read_to_string(dir.path().join("match/base.yml")).expect("reads"),
        source
    );
    assert!(!marker.exists(), "no command or script was run");
    let entries: Vec<_> = fs::read_dir(dir.path().join("match"))
        .expect("the directory reads")
        .collect();
    assert_eq!(
        entries.len(),
        1,
        "no backup, no temporary file, nothing beside the file"
    );
} // End of function a_preview_takes_no_path_lock_and_writes_nothing()

#[test]
fn a_date_is_shown_at_the_request_instant_and_zone() {
    let source = "\
matches:
  - trigger: ':d'
    replace: '{{d}}'
    vars:
      - name: d
        type: date
        params:
          format: '%Y-%m-%d %H:%M %:z'
";
    let dir = tree(source);
    let session = open(&dir);
    let (held, _) = first(&session);
    // 2024-03-31T01:00:00Z, the first instant of summer time in Madrid.
    let samples = PreviewSamples {
        instant: Some(SampleInstant {
            unix_seconds: 1_711_846_800,
            zone: SampleZone::Named {
                name: "Europe/Madrid".to_owned(),
            },
        }),
        ..PreviewSamples::default()
    };
    let preview = session
        .preview_match(held, &samples)
        .expect("the preview answers");
    assert_eq!(
        preview.bodies[0].segments,
        vec![PreviewSegment::Sample {
            text: "2024-03-31 03:00 +02:00".to_owned(),
            source: PreviewSource::Local { index: 0 },
        }]
    );
    let without = session
        .preview_match(held, &PreviewSamples::default())
        .expect("the preview answers");
    assert_eq!(
        without.bodies[0].segments,
        vec![PreviewSegment::Unresolved {
            text: "{{d}}".to_owned(),
            source: Some(PreviewSource::Local { index: 0 }),
            reason: PreviewUnresolved::DateInstantMissing,
        }]
    );
    assert_eq!(
        fs::read_to_string(dir.path().join("match/base.yml")).expect("reads"),
        source
    );
} // End of function a_date_is_shown_at_the_request_instant_and_zone()

/// A draft replacing the fixture's content with one that also uses the shell.
fn drafted() -> CandidateOperation {
    CandidateOperation::Draft {
        draft: Box::new(MatchDraft {
            replace: DraftField::Set("<i>{{pick}}</i> {{sh}}".to_owned()),
            ..MatchDraft::default()
        }),
    }
}

#[test]
fn a_candidate_preview_shows_the_draft_and_writes_nothing() {
    let scratch = TempDir::new().expect("a scratch directory");
    let marker = scratch.path().join("ran");
    let source = fixture(&marker);
    let dir = tree(&source);
    let session = open(&dir);
    let (held, base) = first(&session);
    // Held for the whole preview: a candidate preview that tried to take it
    // would wait forever, and the bounded wait turns that into a failure.
    let _lock = lock_path(&dir.path().join("match").join("base.yml")).expect("the lock is taken");
    let answer = std::thread::scope(|scope| {
        let (sender, receiver) = mpsc::channel();
        let session = &session;
        scope.spawn(move || {
            let _ = sender.send(session.preview_match_candidate(
                held,
                &drafted(),
                base,
                &second_choice(),
            ));
        });
        receiver
            .recv_timeout(Duration::from_secs(10))
            .expect("the candidate preview returns while the path lock is held elsewhere")
            .expect("previewed")
    });
    let preview = answer.preview.expect("the candidate holds the match");
    assert_eq!(
        preview.bodies[0].segments[..3],
        [
            PreviewSegment::Literal {
                text: "<i>".to_owned()
            },
            PreviewSegment::Sample {
                text: "two".to_owned(),
                source: PreviewSource::Local { index: 0 },
            },
            PreviewSegment::Literal {
                text: "</i> ".to_owned()
            },
        ],
        "the draft's text, not the saved text"
    );
    assert!(matches!(
        preview.bodies[0].segments[3],
        PreviewSegment::Placeholder {
            placeholder: PreviewPlaceholder::Shell { .. },
            ..
        }
    ));
    assert_ne!(
        answer.candidate, base,
        "a candidate, not the saved revision"
    );
    assert_eq!(
        fs::read_to_string(dir.path().join("match/base.yml")).expect("reads"),
        source,
        "the file is byte-identical"
    );
    assert!(!marker.exists(), "no command or script was run");
    let entries: Vec<_> = fs::read_dir(dir.path().join("match"))
        .expect("the directory reads")
        .collect();
    assert_eq!(entries.len(), 1, "no backup, no temporary file");
    // The session still holds the saved revision: nothing was adopted.
    assert_eq!(first(&session), (held, base));
} // End of function a_candidate_preview_shows_the_draft_and_writes_nothing()

#[test]
fn a_candidate_preview_refuses_a_stale_base_and_an_unplannable_draft() {
    let scratch = TempDir::new().expect("a scratch directory");
    let source = fixture(&scratch.path().join("ran"));
    let dir = tree(&source);
    let session = open(&dir);
    let (held, base) = first(&session);
    let unplannable = CandidateOperation::VariableMove {
        variable: 9,
        to: ListPlacement::End {},
    };
    let refused = session
        .preview_match_candidate(held, &unplannable, base, &PreviewSamples::default())
        .expect_err("no variable at position 9");
    assert_eq!(refused.code(), "draftRefused");
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
        .preview_match_candidate(held, &drafted(), base, &PreviewSamples::default())
        .expect_err("the base revision was replaced");
    assert_eq!(stale.code(), "identityStaleRevision");
} // End of function a_candidate_preview_refuses_a_stale_base_and_an_unplannable_draft()
