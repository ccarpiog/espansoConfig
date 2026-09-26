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
//!   authored shell command nor the script.
//!
//! Every fixture is synthetic and neutral (`CLAUDE.md` section 1).

use std::fs;
use std::sync::mpsc;
use std::time::Duration;

use espansoconfig_core::draft::ListPlacement;
use espansoconfig_core::model::MatchId;
use espansoconfig_core::persist::{lock_path, Acknowledgement};
use espansoconfig_core::preview::{
    PreviewPlaceholder, PreviewSamples, PreviewSegment, PreviewSource, SelectionSample,
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
