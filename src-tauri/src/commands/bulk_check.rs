//! The per-file bulk coordinator's command-level evidence — Phase 3-10.
//!
//! Every acceptance clause of `docs/decisions/3-split-notes.md` step 3-10 has a
//! test here, driven through the session and the one save tail on real
//! temporary files. The injected failures go through the coordinator's own
//! seam (`BulkSave`): a closure that answers one file with a fabricated
//! failure and hands every other file to `run_one_save`. Every fixture is
//! synthetic and neutral (`CLAUDE.md` section 1).

use std::cell::Cell;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;

use espansoconfig_core::draft::{BulkOption, BulkOptionChange, BulkPlanError, BulkValue};
use espansoconfig_core::model::MatchId;
use espansoconfig_core::persist::{
    lock_path, Acknowledgement, SaveError, SaveVerdict, WriteError, WriteStep,
    BACKUP_DIRECTORY_NAME,
};
use espansoconfig_core::workspace::Workspace;
use espansoconfig_core::{ContentRevision, DocumentId};
use tempfile::TempDir;

use super::{
    apply_bulk_options_with, run_one_save, BulkSave, OneSave, SessionSideOfASave, WorkspaceSession,
};
use crate::bulk::{BulkConsent, BulkFileOutcome, BulkFileRequest, BulkOptionsRequest, BulkResult};
use crate::error::CommandError;
use crate::save::SaveResult;

/// Two snippets holding no options at all.
const TWO_BARE: &str = "matches:\n  - trigger: ':a1'\n    replace: first\n  \
                        - trigger: ':a2'\n    replace: second\n";

/// One snippet holding no options.
const ONE_BARE: &str = "matches:\n  - trigger: ':b1'\n    replace: third\n";

/// One snippet already holding both options the tests set.
const ALREADY_SET: &str =
    "matches:\n  - trigger: ':c1'\n    replace: fourth\n    word: true\n    force_mode: clipboard\n";

/// One snippet whose content references a variable nobody declares — a
/// suspicion the save gate refuses until it is acknowledged.
const SUSPICIOUS: &str = "matches:\n  - trigger: ':d1'\n    replace: '{{nowhere}}'\n";

/// The full consent a refusal licenses for `file`: its document, its base
/// revision, and the intent, candidate and findings the refusal reported.
fn consent_from(refusal: &BulkFileOutcome, file: &BulkFileRequest) -> BulkConsent {
    let BulkFileOutcome::Refused {
        findings,
        candidate,
        intent,
        ..
    } = refusal
    else {
        panic!("a refusal was expected: {refusal:?}");
    };
    BulkConsent {
        document: file.document,
        base_revision: file.base_revision,
        intent: *intent,
        candidate: *candidate,
        acknowledgement: Acknowledgement::of(findings),
    }
} // End of function consent_from()

/// A tree holding one match file per `(name, source)` pair, under `match/`.
fn tree_of(files: &[(&str, &str)]) -> TempDir {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).expect("the match directory");
    for (name, source) in files {
        fs::write(dir.path().join("match").join(name), source).expect("a fixture file");
    }
    dir
} // End of function tree_of()

/// An unwatched session with `dir` open, as every command test uses.
fn open(dir: &TempDir) -> WorkspaceSession {
    let session = WorkspaceSession::unwatched();
    session.open(Some(dir.path())).expect("the tree opens");
    session
}

/// The identity of `match/<name>`.
fn id(session: &WorkspaceSession, name: &str) -> DocumentId {
    let relative = Path::new("match").join(name);
    session
        .documents()
        .expect("the workspace is open")
        .iter()
        .find(|summary| summary.relative_path == relative)
        .unwrap_or_else(|| panic!("no document at {name}"))
        .id
}

/// The bytes of `match/<name>`.
fn bytes(dir: &TempDir, name: &str) -> String {
    fs::read_to_string(dir.path().join("match").join(name)).expect("the file reads back")
}

/// The absolute path of `match/<name>`.
fn path(dir: &TempDir, name: &str) -> PathBuf {
    dir.path().join("match").join(name)
}

/// A file request selecting every snippet of `match/<name>`, with no consent.
fn every_snippet(session: &WorkspaceSession, name: &str) -> BulkFileRequest {
    let document = id(session, name);
    let view = session.document(document).expect("the file reads");
    BulkFileRequest {
        document,
        base_revision: view.revision,
        matches: view
            .matches
            .iter()
            .map(|found| found.id)
            .collect::<Vec<MatchId>>(),
        consent: None,
    }
} // End of function every_snippet()

/// `word` and `force_mode`, the pair the plan's own example leads with.
fn word_and_clipboard() -> Vec<BulkOptionChange> {
    vec![
        BulkOptionChange {
            option: BulkOption::Word,
            value: BulkValue::Set("true".to_owned()),
        },
        BulkOptionChange {
            option: BulkOption::ForceMode,
            value: BulkValue::Set("clipboard".to_owned()),
        },
    ]
} // End of function word_and_clipboard()

/// A request over `files`, excluding nothing.
fn request(changes: Vec<BulkOptionChange>, files: Vec<BulkFileRequest>) -> BulkOptionsRequest {
    BulkOptionsRequest {
        changes,
        files,
        excluded: Vec::new(),
    }
}

/// Runs the coordinator against the open session with the seam supplied.
fn run_with(
    session: &WorkspaceSession,
    request: &BulkOptionsRequest,
    save: &mut BulkSave<'_>,
) -> Result<BulkResult, CommandError> {
    session.with_open(|workspace, side| apply_bulk_options_with(workspace, side, request, save))
}

/// The outcome codes of a result, in report order.
fn outcomes(result: &BulkResult) -> Vec<&'static str> {
    result
        .files
        .iter()
        .map(|report| report.outcome.outcome())
        .collect()
}

/// Whether the workspace has a backup directory at all.
fn any_backup(dir: &TempDir) -> bool {
    dir.path().join(BACKUP_DIRECTORY_NAME).exists()
}

/// A write failure that certainly did not replace the target.
fn failure_before_the_rename(path: PathBuf) -> CommandError {
    CommandError::SaveFailed {
        error: SaveError::Write(WriteError::Io {
            step: WriteStep::CreateTempFile,
            path,
            source: std::io::Error::other("injected"),
        }),
    }
}

/// A write failure after which the target's contents are unknown.
fn failure_after_the_rename(path: PathBuf) -> CommandError {
    CommandError::SaveFailed {
        error: SaveError::Write(WriteError::VerificationFailed {
            path,
            expected: ContentRevision::of_bytes(b"intended"),
            found: ContentRevision::of_bytes(b"found"),
        }),
    }
}

#[test]
fn several_matches_and_absent_options_share_one_save_per_file() {
    let dir = tree_of(&[("a.yml", TWO_BARE), ("b.yml", ONE_BARE)]);
    let session = open(&dir);
    let wanted = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "b.yml"),
        ],
    );
    let saves = Cell::new(Vec::new());
    let mut counting =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            let mut seen = saves.take();
            seen.push(save.document);
            saves.set(seen);
            run_one_save(workspace, side, save)
        };
    let result = run_with(&session, &wanted, &mut counting).expect("the request is well formed");
    assert!(result.preflight_passed && !result.nothing_written);
    assert_eq!(outcomes(&result), ["saved", "saved"]);
    assert_eq!(
        saves.take(),
        [id(&session, "a.yml"), id(&session, "b.yml")],
        "one save transaction per file, in request order, and no more"
    );
    assert_eq!(
        bytes(&dir, "a.yml"),
        "matches:\n  - trigger: ':a1'\n    replace: first\n    word: true\n    force_mode: clipboard\n  \
         - trigger: ':a2'\n    replace: second\n    word: true\n    force_mode: clipboard\n",
        "both snippets and both absent options went into the file's one save"
    );
    assert_eq!(
        bytes(&dir, "b.yml"),
        "matches:\n  - trigger: ':b1'\n    replace: third\n    word: true\n    force_mode: clipboard\n"
    );
} // End of function several_matches_and_absent_options_share_one_save_per_file()

#[test]
fn a_preflight_blocker_writes_nothing() {
    let dir = tree_of(&[
        ("a.yml", TWO_BARE),
        ("b.yml", ONE_BARE),
        ("c.yml", ONE_BARE),
    ]);
    let session = open(&dir);
    let mut stale = every_snippet(&session, "b.yml");
    stale.base_revision = ContentRevision::of_bytes(b"a revision this file never held");
    let mut unselected = every_snippet(&session, "c.yml");
    unselected.matches.clear();
    let wanted = request(
        word_and_clipboard(),
        vec![every_snippet(&session, "a.yml"), stale, unselected],
    );
    let mut never = |_: &mut Workspace,
                     _: SessionSideOfASave<'_>,
                     _: OneSave<'_>|
     -> Result<SaveResult, CommandError> {
        panic!("no save transaction may run after a preflight blocker")
    };
    let result = run_with(&session, &wanted, &mut never).expect("the request is well formed");
    assert!(!result.preflight_passed && result.nothing_written);
    assert_eq!(outcomes(&result), ["notAttempted", "blocked", "blocked"]);
    assert!(matches!(
        result.files[1].outcome,
        BulkFileOutcome::Blocked {
            error: CommandError::IdentityStaleRevision { .. }
        }
    ));
    assert!(matches!(
        result.files[2].outcome,
        BulkFileOutcome::Blocked {
            error: CommandError::BulkRefused {
                error: BulkPlanError::NoMatches {}
            }
        }
    ));
    assert_eq!(
        bytes(&dir, "a.yml"),
        TWO_BARE,
        "the valid file was not written either"
    );
    assert_eq!(bytes(&dir, "b.yml"), ONE_BARE);
    assert_eq!(bytes(&dir, "c.yml"), ONE_BARE);
    assert!(!any_backup(&dir), "no save ran, so no backup was taken");

    // The production path answers the same, through the real tail.
    let result = session.apply_bulk_options(&wanted).expect("well formed");
    assert!(result.nothing_written);
    assert_eq!(bytes(&dir, "a.yml"), TWO_BARE);
} // End of function a_preflight_blocker_writes_nothing()

#[test]
fn a_suspicion_is_refused_per_file_until_that_candidate_is_consented_to() {
    let dir = tree_of(&[("a.yml", TWO_BARE), ("d.yml", SUSPICIOUS)]);
    let session = open(&dir);
    let first = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "d.yml"),
        ],
    );
    let result = session.apply_bulk_options(&first).expect("well formed");
    assert_eq!(outcomes(&result), ["notAttempted", "refused"]);
    let BulkFileOutcome::Refused { verdict, .. } = &result.files[1].outcome else {
        panic!("the suspicious file is refused: {result:?}");
    };
    assert_eq!(*verdict, SaveVerdict::RefusedForUnacknowledgedSuspicions);
    assert_eq!(
        bytes(&dir, "a.yml"),
        TWO_BARE,
        "a refusal in the preflight writes nothing"
    );
    let full = consent_from(&result.files[1].outcome, &first.files[1]);

    // Consent for another candidate is not spent: it is reported stale and
    // nothing is written.
    let mut misdirected = first.clone();
    misdirected.files[1].consent = Some(BulkConsent {
        candidate: ContentRevision::of_bytes(b"another candidate"),
        ..full.clone()
    });
    let result = session
        .apply_bulk_options(&misdirected)
        .expect("well formed");
    assert_eq!(outcomes(&result), ["notAttempted", "consentStale"]);
    assert_eq!(bytes(&dir, "d.yml"), SUSPICIOUS);

    // Consent for exactly this file, base, intent, candidate and findings.
    let mut consented = first.clone();
    consented.files[1].consent = Some(full);
    let result = session.apply_bulk_options(&consented).expect("well formed");
    assert_eq!(outcomes(&result), ["saved", "saved"]);
    assert!(bytes(&dir, "d.yml").contains("force_mode: clipboard"));
} // End of function a_suspicion_is_refused_per_file_until_that_candidate_is_consented_to()

#[test]
fn an_injected_second_file_failure_keeps_the_first_files_success() {
    let dir = tree_of(&[
        ("a.yml", TWO_BARE),
        ("b.yml", ONE_BARE),
        ("c.yml", ONE_BARE),
    ]);
    let session = open(&dir);
    let second = id(&session, "b.yml");
    let second_path = path(&dir, "b.yml");
    let wanted = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "b.yml"),
            every_snippet(&session, "c.yml"),
        ],
    );
    let mut failing =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            if save.document == second {
                return Err(failure_before_the_rename(second_path.clone()));
            }
            run_one_save(workspace, side, save)
        };
    let result = run_with(&session, &wanted, &mut failing).expect("well formed");
    assert!(result.preflight_passed);
    assert!(
        !result.nothing_written,
        "the first file was written and must not be denied"
    );
    assert_eq!(outcomes(&result), ["saved", "failed", "notAttempted"]);
    assert!(matches!(
        result.files[0].outcome,
        BulkFileOutcome::Saved {
            backup_taken: true,
            ..
        }
    ));
    assert!(
        bytes(&dir, "a.yml").contains("force_mode: clipboard"),
        "the success stands"
    );
    assert_eq!(bytes(&dir, "b.yml"), ONE_BARE);
    assert_eq!(
        bytes(&dir, "c.yml"),
        ONE_BARE,
        "the third file was never attempted"
    );

    let wire = serde_json::to_value(&result).expect("the result serializes");
    assert_eq!(wire["files"][0]["outcome"], "saved");
    assert_eq!(wire["files"][1]["outcome"], "failed");
    assert_eq!(wire["files"][1]["error"]["code"], "saveFailed");
    assert_eq!(wire["files"][1]["error"]["may_have_written"], false);
    assert_eq!(wire["files"][2]["outcome"], "notAttempted");
    assert_eq!(wire["nothing_written"], false);
} // End of function an_injected_second_file_failure_keeps_the_first_files_success()

#[test]
fn an_uncertain_write_stops_later_attempts() {
    let dir = tree_of(&[
        ("a.yml", TWO_BARE),
        ("b.yml", ONE_BARE),
        ("c.yml", ONE_BARE),
    ]);
    let session = open(&dir);
    let first = id(&session, "a.yml");
    let first_path = path(&dir, "a.yml");
    let wanted = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "b.yml"),
            every_snippet(&session, "c.yml"),
        ],
    );
    let attempts = Cell::new(0_usize);
    let mut uncertain =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            attempts.set(attempts.get() + 1);
            if save.document == first {
                return Err(failure_after_the_rename(first_path.clone()));
            }
            run_one_save(workspace, side, save)
        };
    let result = run_with(&session, &wanted, &mut uncertain).expect("well formed");
    assert_eq!(
        attempts.get(),
        1,
        "nothing is attempted after an uncertain write"
    );
    assert_eq!(
        outcomes(&result),
        ["writeOutcomeUnknown", "notAttempted", "notAttempted"]
    );
    assert!(
        !result.nothing_written,
        "a write whose outcome is unknown may have written, so nothing-written is not claimed"
    );
    assert_eq!(bytes(&dir, "b.yml"), ONE_BARE);
    assert_eq!(bytes(&dir, "c.yml"), ONE_BARE);
} // End of function an_uncertain_write_stops_later_attempts()

#[test]
fn a_conflict_under_the_lock_stops_the_run_and_keeps_earlier_commits() {
    let dir = tree_of(&[
        ("a.yml", TWO_BARE),
        ("b.yml", ONE_BARE),
        ("c.yml", ONE_BARE),
    ]);
    let session = open(&dir);
    let second = id(&session, "b.yml");
    let second_path = path(&dir, "b.yml");
    let wanted = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "b.yml"),
            every_snippet(&session, "c.yml"),
        ],
    );
    let external = "matches:\n  - trigger: ':b1'\n    replace: changed elsewhere\n";
    let mut racing =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            if save.document == second {
                // Another writer replaces the file after the preflight passed.
                fs::write(&second_path, external).expect("an external write");
            }
            run_one_save(workspace, side, save)
        };
    let result = run_with(&session, &wanted, &mut racing).expect("well formed");
    assert_eq!(outcomes(&result), ["saved", "conflicted", "notAttempted"]);
    assert_eq!(
        bytes(&dir, "b.yml"),
        external,
        "the other writer's bytes were not overwritten"
    );
    assert_eq!(bytes(&dir, "c.yml"), ONE_BARE);
    assert!(bytes(&dir, "a.yml").contains("word: true"));
} // End of function a_conflict_under_the_lock_stops_the_run_and_keeps_earlier_commits()

#[test]
fn each_files_actual_backup_or_no_op_result_is_visible() {
    let dir = tree_of(&[("a.yml", TWO_BARE), ("c.yml", ALREADY_SET)]);
    let session = open(&dir);
    let wanted = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "c.yml"),
        ],
    );
    let result = session.apply_bulk_options(&wanted).expect("well formed");
    assert_eq!(outcomes(&result), ["saved", "alreadyUnchanged"]);
    let wire = serde_json::to_value(&result).expect("the result serializes");
    assert_eq!(
        wire["files"][0]["backup_taken"], true,
        "the first save copied the file"
    );
    assert!(
        wire["files"][1].get("backup_taken").is_none(),
        "an unchanged file wrote nothing and copied nothing: {}",
        wire["files"][1]
    );
    assert_eq!(bytes(&dir, "c.yml"), ALREADY_SET);
    let copies = dir.path().join(BACKUP_DIRECTORY_NAME);
    let batch = fs::read_dir(&copies)
        .expect("one batch")
        .filter_map(Result::ok)
        .find(|entry| entry.path().is_dir())
        .expect("a batch directory")
        .path();
    assert!(batch.join("match").join("a.yml").exists());
    assert!(
        !batch.join("match").join("c.yml").exists(),
        "no copy of an unchanged file"
    );

    // A second bulk edit of the same file in this session writes no new copy,
    // and says so rather than claiming one.
    let again = request(
        vec![BulkOptionChange {
            option: BulkOption::ForceClipboard,
            value: BulkValue::Set("true".to_owned()),
        }],
        vec![every_snippet(&session, "a.yml")],
    );
    let result = session.apply_bulk_options(&again).expect("well formed");
    assert!(matches!(
        result.files[0].outcome,
        BulkFileOutcome::Saved {
            backup_taken: false,
            ..
        }
    ));
} // End of function each_files_actual_backup_or_no_op_result_is_visible()

#[test]
fn no_path_lock_is_held_around_a_save() {
    let dir = tree_of(&[("a.yml", TWO_BARE), ("b.yml", ONE_BARE)]);
    let session = open(&dir);
    let every_path = [path(&dir, "a.yml"), path(&dir, "b.yml")];
    let wanted = request(
        word_and_clipboard(),
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "b.yml"),
        ],
    );
    let mut probing =
        |workspace: &mut Workspace, side: SessionSideOfASave<'_>, save: OneSave<'_>| {
            // Another thread must be able to take every file's write lock at the
            // moment the coordinator hands a save over. The lock is not reentrant,
            // so a coordinator holding one would hang its own save; a bounded wait
            // turns that hang into a failure.
            let paths = every_path.to_vec();
            let (sender, receiver) = mpsc::channel();
            std::thread::spawn(move || {
                for target in &paths {
                    drop(lock_path(target).expect("the lock resolves"));
                }
                let _ = sender.send(());
            });
            receiver
                .recv_timeout(Duration::from_secs(10))
                .expect("no path lock is held around run_one_save");
            run_one_save(workspace, side, save)
        }; // End of the probing closure
    let result = run_with(&session, &wanted, &mut probing).expect("well formed");
    assert_eq!(outcomes(&result), ["saved", "saved"]);
} // End of function no_path_lock_is_held_around_a_save()

#[test]
fn there_is_no_force_flag_on_the_wire() {
    let file = serde_json::json!({
        "document": 0,
        "base_revision": "0".repeat(64),
        "matches": [],
        "consent": null,
    });
    let well_formed = serde_json::json!({
        "changes": [{ "option": "word", "value": { "Set": "true" } }],
        "files": [file.clone()],
        "excluded": [],
    });
    assert!(serde_json::from_value::<BulkOptionsRequest>(well_formed.clone()).is_ok());
    let mut forced = well_formed.clone();
    forced["force"] = serde_json::json!(true);
    assert!(
        serde_json::from_value::<BulkOptionsRequest>(forced).is_err(),
        "a batch-wide force bit is refused, not ignored"
    );
    let mut forced_file = well_formed.clone();
    forced_file["files"][0]["force"] = serde_json::json!(true);
    assert!(
        serde_json::from_value::<BulkOptionsRequest>(forced_file).is_err(),
        "a per-file force bit is refused, not ignored"
    );
    let mut paragraph = well_formed;
    paragraph["changes"][0]["option"] = serde_json::json!("paragraph");
    assert!(
        serde_json::from_value::<BulkOptionsRequest>(paragraph).is_err(),
        "only the seven options of ruling 20 can be submitted"
    );
} // End of function there_is_no_force_flag_on_the_wire()

#[test]
fn a_malformed_request_is_refused_before_any_file_is_read() {
    let dir = tree_of(&[("a.yml", TWO_BARE)]);
    let session = open(&dir);
    let file = every_snippet(&session, "a.yml");
    let no_changes = request(Vec::new(), vec![file.clone()]);
    assert!(matches!(
        session.apply_bulk_options(&no_changes),
        Err(CommandError::BulkRefused {
            error: BulkPlanError::NoOptionChanges {}
        })
    ));
    let twice = request(word_and_clipboard(), vec![file.clone(), file.clone()]);
    assert!(matches!(
        session.apply_bulk_options(&twice),
        Err(CommandError::BulkRefused {
            error: BulkPlanError::DocumentRepeated { .. }
        })
    ));
    let no_files = request(word_and_clipboard(), Vec::new());
    assert!(matches!(
        session.apply_bulk_options(&no_files),
        Err(CommandError::BulkRefused {
            error: BulkPlanError::NoFiles {}
        })
    ));
    assert_eq!(bytes(&dir, "a.yml"), TWO_BARE);
    assert!(matches!(
        WorkspaceSession::unwatched().apply_bulk_options(&no_changes),
        Err(CommandError::NoWorkspaceOpen)
    ));
} // End of function a_malformed_request_is_refused_before_any_file_is_read()

#[test]
fn an_excluded_file_is_accounted_for_and_untouched() {
    let dir = tree_of(&[("a.yml", TWO_BARE), ("b.yml", ONE_BARE)]);
    let session = open(&dir);
    let wanted = BulkOptionsRequest {
        changes: word_and_clipboard(),
        files: vec![every_snippet(&session, "a.yml")],
        excluded: vec![id(&session, "b.yml")],
    };
    let result = session.apply_bulk_options(&wanted).expect("well formed");
    assert_eq!(outcomes(&result), ["saved", "excludedBeforeApply"]);
    assert_eq!(result.files[1].document, id(&session, "b.yml"));
    assert_eq!(bytes(&dir, "b.yml"), ONE_BARE);
} // End of function an_excluded_file_is_accounted_for_and_untouched()

#[test]
fn consent_from_one_file_replayed_on_another_is_refused() {
    // Two byte-identical files derive the same candidate and the same
    // document-local findings, so the candidate alone cannot tell them apart.
    let dir = tree_of(&[("d.yml", SUSPICIOUS), ("e.yml", SUSPICIOUS)]);
    let session = open(&dir);
    let first = request(word_and_clipboard(), vec![every_snippet(&session, "d.yml")]);
    let refused = session.apply_bulk_options(&first).expect("well formed");
    let for_d = consent_from(&refused.files[0].outcome, &first.files[0]);

    let mut replayed = request(word_and_clipboard(), vec![every_snippet(&session, "e.yml")]);
    replayed.files[0].consent = Some(for_d.clone());
    let result = session.apply_bulk_options(&replayed).expect("well formed");
    assert_eq!(outcomes(&result), ["consentStale"]);

    // Relabelled with the other file's document, it still names the first
    // file's intent, and is still refused.
    replayed.files[0].consent = Some(BulkConsent {
        document: replayed.files[0].document,
        ..for_d
    });
    let result = session.apply_bulk_options(&replayed).expect("well formed");
    assert_eq!(outcomes(&result), ["consentStale"]);
    assert!(result.nothing_written);
    assert_eq!(bytes(&dir, "e.yml"), SUSPICIOUS);
    assert!(!any_backup(&dir));
} // End of function consent_from_one_file_replayed_on_another_is_refused()

#[test]
fn consent_for_an_earlier_base_revision_is_refused() {
    let dir = tree_of(&[("d.yml", SUSPICIOUS)]);
    let session = open(&dir);
    let first = request(word_and_clipboard(), vec![every_snippet(&session, "d.yml")]);
    let refused = session.apply_bulk_options(&first).expect("well formed");
    let earlier = consent_from(&refused.files[0].outcome, &first.files[0]);

    // The file moves on (still holding the same suspicion) and is re-read.
    let moved_on = "# edited elsewhere\nmatches:\n  - trigger: ':d1'\n    replace: '{{nowhere}}'\n";
    fs::write(path(&dir, "d.yml"), moved_on).expect("an external write");
    session
        .reload(id(&session, "d.yml"))
        .expect("the file is read again");
    let mut current = request(word_and_clipboard(), vec![every_snippet(&session, "d.yml")]);
    current.files[0].consent = Some(earlier);
    let result = session.apply_bulk_options(&current).expect("well formed");
    assert_eq!(outcomes(&result), ["consentStale"]);
    assert_eq!(bytes(&dir, "d.yml"), moved_on);
} // End of function consent_for_an_earlier_base_revision_is_refused()

#[test]
fn consent_for_a_different_intent_is_refused_even_for_the_same_candidate() {
    // The second snippet already holds both values, so selecting it too
    // derives the very same candidate: only the intent tells the two apart.
    let source = "matches:\n  - trigger: ':d1'\n    replace: '{{nowhere}}'\n  \
                  - trigger: ':d2'\n    replace: fifth\n    word: true\n    force_mode: clipboard\n";
    let dir = tree_of(&[("d.yml", source)]);
    let session = open(&dir);
    let mut only_first = every_snippet(&session, "d.yml");
    only_first.matches.truncate(1);
    let first = request(word_and_clipboard(), vec![only_first]);
    let refused = session.apply_bulk_options(&first).expect("well formed");
    let consent = consent_from(&refused.files[0].outcome, &first.files[0]);

    let mut both = request(word_and_clipboard(), vec![every_snippet(&session, "d.yml")]);
    both.files[0].consent = Some(consent.clone());
    let result = session.apply_bulk_options(&both).expect("well formed");
    let BulkFileOutcome::ConsentStale { candidate, .. } = &result.files[0].outcome else {
        panic!("a consent for another selection is stale: {result:?}");
    };
    assert_eq!(
        *candidate, consent.candidate,
        "the candidate alone would have passed"
    );

    let mut other_value = first.clone();
    other_value.changes = vec![BulkOptionChange {
        option: BulkOption::Word,
        value: BulkValue::Set("false".to_owned()),
    }];
    other_value.files[0].consent = Some(consent);
    let result = session
        .apply_bulk_options(&other_value)
        .expect("well formed");
    assert_eq!(outcomes(&result), ["consentStale"]);
    assert_eq!(bytes(&dir, "d.yml"), source);
} // End of function consent_for_a_different_intent_is_refused_even_for_the_same_candidate()

#[test]
fn bulk_booleans_are_written_as_plain_source_and_an_ineligible_spelling_writes_nothing() {
    // Phase 3-10's review blocker, through the command: inserted and replaced
    // options come out as the plain text entered, never quoted.
    let replaced = "matches:\n  - trigger: ':r1'\n    replace: sixth\n    word: false\n    \
                    left_word: 'true'\n";
    let dir = tree_of(&[("a.yml", ONE_BARE), ("r.yml", replaced)]);
    let session = open(&dir);
    let changes = vec![
        BulkOptionChange {
            option: BulkOption::Word,
            value: BulkValue::Set("true".to_owned()),
        },
        BulkOptionChange {
            option: BulkOption::LeftWord,
            value: BulkValue::Set("false".to_owned()),
        },
    ];
    let wanted = request(
        changes,
        vec![
            every_snippet(&session, "a.yml"),
            every_snippet(&session, "r.yml"),
        ],
    );
    let result = session.apply_bulk_options(&wanted).expect("well formed");
    assert_eq!(outcomes(&result), ["saved", "saved"]);
    assert_eq!(
        bytes(&dir, "a.yml"),
        "matches:\n  - trigger: ':b1'\n    replace: third\n    word: true\n    left_word: false\n"
    );
    assert_eq!(
        bytes(&dir, "r.yml"),
        "matches:\n  - trigger: ':r1'\n    replace: sixth\n    word: true\n    left_word: false\n"
    );

    let quoted = request(
        vec![BulkOptionChange {
            option: BulkOption::Word,
            value: BulkValue::Set("'true'".to_owned()),
        }],
        vec![every_snippet(&session, "a.yml")],
    );
    let before = bytes(&dir, "a.yml");
    assert!(matches!(
        session.apply_bulk_options(&quoted),
        Err(CommandError::BulkRefused {
            error: BulkPlanError::OptionNotPlainSource {
                option: BulkOption::Word
            }
        })
    ));
    assert_eq!(
        bytes(&dir, "a.yml"),
        before,
        "a refused spelling writes nothing"
    );
} // End of function bulk_booleans_are_written_as_plain_source_and_an_ineligible_spelling_writes_nothing()
