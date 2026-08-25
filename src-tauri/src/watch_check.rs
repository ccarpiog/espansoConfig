//! Real-filesystem integration checks for the watcher lifecycle — Phase 2d-2 —
//! and for the app-write ledger on the production save path — Phase 2d-3.
//!
//! The 2d design consult's Q7 item 2 puts **this crate's one integration
//! test** here on purpose: a `notify` callback plus workspace replacement is
//! not a pure core question, because open/replace/drop lifetime and native
//! delivery meet only in this layer. Everything below drives the real
//! [`crate::commands::WorkspaceSession`] over real temp trees with real
//! creates, atomic renames, edits and removals under **both** watched roots,
//! and reads the results through the same seam Phase 2d-4's queue will use —
//! an injected [`AdmittedSink`]. The operation matrix is **one test per
//! cell** — four operation shapes times two roots — so an early timeout in
//! one cell cannot hide what the rest of the matrix would have shown.
//!
//! Since Phase 2d-3 that seam sits **behind** `crate::ledger`'s admission gate,
//! which `WorkspaceSession::observing` installs for every session a production
//! constructor builds as well as for every one built here. The two checks at
//! the end of this file are what make that a measured fact rather than a
//! reading of the constructor: a real `save_document` transaction, with its
//! real rename and its real pre-save copy, is suppressed rather than reported,
//! while an external write of different bytes to the same file is admitted and
//! numbered.
//!
//! # Flakiness policy
//!
//! Native delivery has no promised latency, so every positive expectation is a
//! **bounded wait** ([`PATIENCE`]) that returns the moment the observation
//! arrives, and the one negative expectation — nothing from a replaced
//! watcher — is asserted **behind a positive fence**: an edit to the live tree
//! must arrive first, and only then is a short drain window read, because a
//! leaked watcher runs the same debounce cadence the live one just
//! demonstrated. No bare unsynchronized sleep decides a verdict. The three
//! callback-initiated teardown tests go one step further: their trees hold
//! only `match/`, so the polling fallback is engaged from the start and the
//! rescan cadence delivers their triggering edits whether or not FSEvents
//! does — and the reaper-starvation test's one parked callback is released
//! before that test ends, so the suite still exits cleanly.
//!
//! # Privacy
//!
//! Synthetic trees only, hand-authored and neutral. No test here reads or
//! writes the owner's real configuration (CLAUDE.md section 1), and the real
//! corpus is not mirrored into any writer harness (the consult's Q7 closing
//! ruling).

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex, OnceLock, Weak};
use std::time::{Duration, Instant};

use tempfile::TempDir;

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::persist::{Acknowledgement, BACKUP_DIRECTORY_NAME, BATCH_MARKER_NAME};
use espansoconfig_core::watch::engine::{EngineConfig, Observation, StableContent};
use espansoconfig_core::{ContentRevision, DocumentId};

use crate::commands::WorkspaceSession;
use crate::ledger::{AdmittedObservation, AdmittedSink, AppWrite};
use crate::save::SaveResult;
use crate::watch::{LifecycleConfig, WorkspaceEpochs, NO_EPOCH};

/// How long a positive expectation may take before the test fails.
///
/// Generous because native delivery promises nothing about latency — measured
/// on this machine, one active FSEvents stream takes seconds to establish and
/// tear down, serialized process-wide, and a parallel run of this suite plus
/// `dispatch_check`'s production-built sessions multiplies that contention —
/// and cheap because every wait returns the moment its observation arrives.
const PATIENCE: Duration = Duration::from_secs(120);

/// A neutral match file for the synthetic trees.
const BASE_YML: &str = concat!(
    "# A synthetic match file.\n",
    "matches:\n",
    "  - trigger: ':one'\n",
    "    replace: first\n",
);

/// A neutral config profile for the synthetic trees.
const CONFIG_YML: &str = "backend: auto\ntoggle_key: ALT\n";

/// Builds a synthetic espanso tree with both watched roots populated.
fn synthetic_tree() -> TempDir {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("config")).expect("the config root");
    fs::create_dir_all(dir.path().join("match")).expect("the match root");
    fs::write(dir.path().join("config/default.yml"), CONFIG_YML).expect("the profile");
    fs::write(dir.path().join("match/base.yml"), BASE_YML).expect("the match file");
    dir
} // End of function synthetic_tree()

/// Builds a synthetic tree holding only the `match/` root.
///
/// The missing `config/` root makes the watcher engage the polling fallback
/// at start, so a write under `match/` is delivered by the rescan cadence
/// whether or not native delivery works. That is the fresh-install shape the
/// unavailable-root test is about, and the shape the three teardown tests
/// ride so that no FSEvents delivery decides their verdicts.
fn match_only_tree() -> TempDir {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).expect("the match root");
    fs::write(dir.path().join("match/base.yml"), BASE_YML).expect("the match file");
    dir
} // End of function match_only_tree()

/// Timing tight enough to keep these tests quick and legal enough to exist:
/// the debounce cannot go under the plan's 150 ms floor, and the poll cadence
/// stays above [`LifecycleConfig`]'s starvation floor for it.
fn fast_config() -> LifecycleConfig {
    let engine = EngineConfig::new(150, 10).expect("150/10 is inside the plan's band");
    LifecycleConfig::new(engine, 400).expect("400 ms is above the starvation floor for 150/10")
}

/// An observation sink that forwards into an in-process channel.
///
/// Exactly the shape 2d-4's queue will take the observations through; here the
/// receiver is the test's, so what the watcher observed is what the test can
/// assert about.
fn channel_sink() -> (AdmittedSink, Receiver<AdmittedObservation>) {
    let (sender, receiver) = std::sync::mpsc::channel();
    let sink: AdmittedSink = Arc::new(move |observation| {
        // The send fails only when the test dropped its receiver first, at
        // which point what the watcher still observes is not under test.
        let _ = sender.send(observation);
    });
    (sink, receiver)
} // End of function channel_sink()

/// Polls `condition` until it holds or [`PATIENCE`] runs out.
fn wait_for(what: &str, mut condition: impl FnMut() -> bool) {
    let deadline = Instant::now() + PATIENCE;
    while Instant::now() < deadline {
        if condition() {
            return;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    panic!("timed out waiting for {what}");
} // End of function wait_for()

/// Waits until the open workspace's watcher has finished its baseline scan.
fn wait_until_ready(session: &WorkspaceSession) {
    wait_for("the watcher's baseline scan", || {
        session.watch_status().is_some_and(|status| status.ready)
    });
}

/// Receives observations until one satisfies `matches`, within [`PATIENCE`].
///
/// Unrelated observations are collected rather than dropped, so a timeout
/// panic says what actually arrived instead of only what did not.
fn await_observation(
    observations: &Receiver<AdmittedObservation>,
    what: &str,
    mut matches: impl FnMut(&AdmittedObservation) -> bool,
) -> AdmittedObservation {
    let deadline = Instant::now() + PATIENCE;
    let mut unrelated = Vec::new();
    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
        match observations.recv_timeout(remaining) {
            Ok(observation) if matches(&observation) => return observation,
            Ok(observation) => unrelated.push(observation),
            Err(_) => break,
        }
    }
    panic!("timed out waiting for {what}; unrelated observations seen: {unrelated:?}");
} // End of function await_observation()

/// Collects everything the sink receives inside `window`.
fn drain_for(
    observations: &Receiver<AdmittedObservation>,
    window: Duration,
) -> Vec<AdmittedObservation> {
    let deadline = Instant::now() + window;
    let mut seen = Vec::new();
    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
        match observations.recv_timeout(remaining) {
            Ok(observation) => seen.push(observation),
            Err(_) => break,
        }
    }
    seen
} // End of function drain_for()

/// Whether an observation is a `Changed` at exactly `path`.
fn is_changed_at(observation: &AdmittedObservation, path: &Path) -> bool {
    matches!(&observation.observation, Observation::Changed { path: at, .. } if at.as_path() == path)
}

/// Whether an observation is an `Added` at exactly `path`.
fn is_added_at(observation: &AdmittedObservation, path: &Path) -> bool {
    matches!(&observation.observation, Observation::Added { file, .. } if file.path.as_path() == path)
}

/// Whether an observation is a `Removed` at exactly `path`.
fn is_removed_at(observation: &AdmittedObservation, path: &Path) -> bool {
    matches!(&observation.observation, Observation::Removed { path: at, .. } if at.as_path() == path)
}

/// The payload assertion behind every "exact bytes" claim in this module: a
/// content-bearing observation must carry the written bytes **as bytes**, not
/// merely a hash of them.
///
/// Destructures the [`StableContent::Projected`] snapshot and compares its
/// unchanged `source` byte for byte against what the test wrote, then checks
/// that the revision hashes those same bytes. The revision comparison alone
/// was round 2's remaining evidence gap: a hash equality claims identity only
/// through the hash, and the source comparison is what makes the exact-bytes
/// sentence a measured fact.
fn assert_exact_source_bytes(content: &StableContent, expected: &str, what: &str) {
    let StableContent::Projected { snapshot, .. } = content else {
        panic!("{what}: expected projected content, got {content:?}");
    };
    assert_eq!(
        snapshot.source.as_bytes(),
        expected.as_bytes(),
        "{what}: the snapshot's source must be exactly the written bytes"
    );
    assert_eq!(
        content.revision(),
        ContentRevision::of_bytes(expected.as_bytes()),
        "{what}: the revision must hash those same bytes"
    );
} // End of function assert_exact_source_bytes()

/// The path an observation is about, whatever its kind.
fn observed_path(observation: &AdmittedObservation) -> &Path {
    crate::ledger::observed_path(&observation.observation)
}

/// The file [`synthetic_tree`] seeds under a watched root, with its bytes and
/// the membership classification the walk gives a file there.
fn seeded_file_of(subdir: &str) -> (&'static str, &'static str, FileKind) {
    match subdir {
        "config" => ("default.yml", CONFIG_YML, FileKind::ConfigProfile),
        "match" => ("base.yml", BASE_YML, FileKind::MatchFile),
        other => panic!("no seeded file under {other}"),
    }
}

/// Opens a watching session over a fresh synthetic tree, waits for its
/// baseline, and asserts the healthy-native framing every matrix cell
/// shares: the first epoch, and no polling.
fn watched_tree() -> (TempDir, WorkspaceSession, Receiver<AdmittedObservation>) {
    let dir = synthetic_tree();
    let (sink, observations) = channel_sink();
    let session = WorkspaceSession::observing(sink, fast_config());
    session
        .open(Some(dir.path()))
        .expect("the synthetic tree opens");
    wait_until_ready(&session);
    let status = session.watch_status().expect("a workspace is open");
    assert_eq!(status.epoch, 1, "the first open is the first epoch");
    assert!(!status.polling, "a healthy native watch must not poll");
    (dir, session, observations)
} // End of function watched_tree()

/// A matrix cell's closing assertion: the operation arrived natively, so the
/// polling fallback never engaged.
fn assert_never_polled(session: &WorkspaceSession) {
    assert!(
        !session.watch_status().expect("still open").polling,
        "a healthy native watch must never engage the polling fallback"
    );
}

/// One matrix cell: a real CREATE under `subdir` is one `Added`, classified
/// as the walk would classify it and carrying exactly the created bytes.
fn a_real_create_under(subdir: &str) {
    let (dir, session, observations) = watched_tree();
    let (_, _, expected_kind) = seeded_file_of(subdir);
    let created = dir.path().join(subdir).join("created.yml");
    const CREATED: &str = "created: by the matrix\n";
    fs::write(&created, CREATED).expect("the created file");
    let got = await_observation(&observations, "the created file", |o| {
        is_added_at(o, &created)
    });
    assert_eq!(got.epoch, 1);
    let Observation::Added { file, content } = &got.observation else {
        unreachable!("the predicate admitted only Added");
    };
    assert_eq!(
        file.kind, expected_kind,
        "membership classification is the walk's"
    );
    assert_exact_source_bytes(content, CREATED, "the created file");
    assert_never_polled(&session);
} // End of function a_real_create_under()

/// One matrix cell: a real EDIT of `subdir`'s seeded file is one `Changed`,
/// carrying exactly the final bytes over the baseline's revision.
fn a_real_edit_under(subdir: &str) {
    let (dir, session, observations) = watched_tree();
    let (name, seeded_bytes, _) = seeded_file_of(subdir);
    let target = dir.path().join(subdir).join(name);
    const EDITED: &str = "edited: by the matrix\n";
    fs::write(&target, EDITED).expect("the edit");
    let got = await_observation(&observations, "the edit", |o| is_changed_at(o, &target));
    assert_eq!(got.epoch, 1);
    let Observation::Changed {
        content,
        previous_revision,
        ..
    } = &got.observation
    else {
        unreachable!("the predicate admitted only Changed");
    };
    assert_exact_source_bytes(content, EDITED, "the edit");
    assert_eq!(
        *previous_revision,
        Some(ContentRevision::of_bytes(seeded_bytes.as_bytes())),
        "the previous revision is the baseline's"
    );
    assert_never_polled(&session);
} // End of function a_real_edit_under()

/// One matrix cell: a real ATOMIC RENAME onto `subdir`'s seeded file — the
/// staging name is deliberately not YAML-shaped, the same shape a save's
/// temp file takes — is one `Changed` carrying only the final bytes.
fn a_real_atomic_rename_under(subdir: &str) {
    let (dir, session, observations) = watched_tree();
    let (name, seeded_bytes, _) = seeded_file_of(subdir);
    let target = dir.path().join(subdir).join(name);
    const REPLACED: &str = "replaced: atomically, by the matrix\n";
    let staging = dir
        .path()
        .join(subdir)
        .join(format!("{name}.espansoconfig-staging"));
    fs::write(&staging, REPLACED).expect("the staging file");
    fs::rename(&staging, &target).expect("the atomic replacement");
    let got = await_observation(&observations, "the atomic replacement", |o| {
        is_changed_at(o, &target)
    });
    assert_eq!(got.epoch, 1);
    let Observation::Changed {
        content,
        previous_revision,
        ..
    } = &got.observation
    else {
        unreachable!("the predicate admitted only Changed");
    };
    assert_exact_source_bytes(
        content,
        REPLACED,
        "an atomic replacement is one change carrying only the final bytes",
    );
    assert_eq!(
        *previous_revision,
        Some(ContentRevision::of_bytes(seeded_bytes.as_bytes())),
        "the previous revision is the baseline's"
    );
    assert_never_polled(&session);
} // End of function a_real_atomic_rename_under()

/// One matrix cell: a real REMOVAL of `subdir`'s seeded file is one
/// `Removed`, remembering the removed content's revision.
fn a_real_removal_under(subdir: &str) {
    let (dir, session, observations) = watched_tree();
    let (name, seeded_bytes, _) = seeded_file_of(subdir);
    let target = dir.path().join(subdir).join(name);
    fs::remove_file(&target).expect("the removal");
    let got = await_observation(&observations, "the removal", |o| is_removed_at(o, &target));
    assert_eq!(got.epoch, 1);
    let Observation::Removed {
        previous_revision, ..
    } = &got.observation
    else {
        unreachable!("the predicate admitted only Removed");
    };
    assert_eq!(
        *previous_revision,
        Some(ContentRevision::of_bytes(seeded_bytes.as_bytes())),
        "the removal remembers what was there"
    );
    assert_never_polled(&session);
} // End of function a_real_removal_under()

#[test]
fn a_real_create_under_config_reaches_the_sink() {
    a_real_create_under("config");
}

#[test]
fn a_real_create_under_match_reaches_the_sink() {
    a_real_create_under("match");
}

#[test]
fn a_real_edit_under_config_reaches_the_sink() {
    a_real_edit_under("config");
}

#[test]
fn a_real_edit_under_match_reaches_the_sink() {
    a_real_edit_under("match");
}

#[test]
fn a_real_atomic_rename_under_config_reaches_the_sink() {
    a_real_atomic_rename_under("config");
}

#[test]
fn a_real_atomic_rename_under_match_reaches_the_sink() {
    a_real_atomic_rename_under("match");
}

#[test]
fn a_real_removal_under_config_reaches_the_sink() {
    a_real_removal_under("config");
}

#[test]
fn a_real_removal_under_match_reaches_the_sink() {
    a_real_removal_under("match");
}

/// A successful **ordinary** reopen — one called from any thread but the
/// replaced watcher's own worker, here the test's — replaces the watcher: the
/// old one is cancelled and joined before `open` returns, so once the reopen
/// has answered, nothing of the replaced tree can ever reach the sink again.
/// (A reopen initiated from inside the replaced worker's own sink callback
/// deliberately does not get join-before-return; that case is the two
/// teardown tests below.)
///
/// **The join probe is what carries the leak verdict, and since Phase 2d-3 it
/// is the only thing that can.** This test's original verdict was the drain
/// window at the end: a leaked epoch-1 worker would have observed the write
/// into the replaced tree and reached the sink. The 2d-3 admission gate now
/// discards a replaced epoch's observation *before* the sink, so that window
/// would stay clean over exactly the regression it exists to catch — round 1's
/// Medium. The probe replaces it with the direct fact: `open` on a thread that
/// is not the replaced worker cancels **and joins** that worker before it
/// returns, and the probe's flag is stored only after that join returned. The
/// drain window is kept for what it still says — that the successor's epoch is
/// the only one delivering, and that nothing of the replaced *tree's* paths
/// arrives — never as the leak detector.
#[test]
fn a_successful_reopen_cancels_and_joins_the_old_watcher_and_bumps_the_epoch() {
    let first = synthetic_tree();
    let second = synthetic_tree();
    let (sink, observations) = channel_sink();
    let session = WorkspaceSession::observing(sink, fast_config());
    session
        .open(Some(first.path()))
        .expect("the first tree opens");
    wait_until_ready(&session);
    assert_eq!(session.watch_status().expect("open").epoch, 1);
    // Captured before the reopen, because the reopen consumes that lifecycle.
    let replaced_worker = session
        .watcher_join_probe()
        .expect("the first watcher is running");
    assert!(
        !replaced_worker.completed(),
        "the premise: the watcher about to be replaced is still running"
    );

    session
        .open(Some(second.path()))
        .expect("the second tree opens");
    // The leak verdict, and it needs no wait: an ordinary `open` joins the
    // replaced worker in place, and the probe is stored only after that join
    // returned. A regression that forgot to cancel and join fails here.
    assert!(
        replaced_worker.completed(),
        "an ordinary open must have joined the replaced worker before returning"
    );
    // `open` returned, so the previous watcher was joined before this line;
    // the status now reads the successor.
    assert_eq!(
        session.watch_status().expect("open").epoch,
        2,
        "a successful replacement increments the epoch"
    );
    wait_until_ready(&session);

    // A write into the replaced tree. Its watcher was joined before the
    // reopen returned, so this can reach nothing — ever.
    fs::write(
        first.path().join("match/base.yml"),
        "matches:\n  - trigger: ':old'\n    replace: unwatched\n",
    )
    .expect("the write into the replaced tree");

    // The fence: a write into the live tree still arrives, tagged epoch 2.
    let live = second.path().join("match/base.yml");
    const LIVE_EDIT: &str = "matches:\n  - trigger: ':live'\n    replace: watched\n";
    fs::write(&live, LIVE_EDIT).expect("the live edit");
    let got = await_observation(&observations, "the live tree's edit", |o| {
        is_changed_at(o, &live)
    });
    assert_eq!(got.epoch, 2);

    // A short window behind the fence. It is no longer the leak detector —
    // the probe above is, since the admission gate discards a replaced epoch's
    // observation before the sink — but it still pins that the successor's
    // epoch is the only one delivering and that no path of the replaced tree
    // arrives.
    let late = drain_for(&observations, Duration::from_millis(600));
    assert!(
        late.iter()
            .all(|o| o.epoch == 2 && !observed_path(o).starts_with(first.path())),
        "the replaced watcher leaked observations: {late:?}"
    );
} // End of function a_successful_reopen_cancels_and_joins_the_old_watcher_and_bumps_the_epoch()

/// A failed reopen keeps the previous workspace **and its watcher**: same
/// epoch, still ready, still delivering.
#[test]
fn a_failed_reopen_keeps_the_previous_watcher_watching() {
    let dir = synthetic_tree();
    let (sink, observations) = channel_sink();
    let session = WorkspaceSession::observing(sink, fast_config());
    session.open(Some(dir.path())).expect("the tree opens");
    wait_until_ready(&session);

    let missing = dir.path().join("does-not-exist");
    assert!(
        session.open(Some(&missing)).is_err(),
        "a path that is not a directory must refuse to open"
    );
    let status = session.watch_status().expect("the workspace stayed open");
    assert_eq!(
        status.epoch, 1,
        "a failed open must not replace the watcher"
    );
    assert!(status.ready, "the kept watcher is the one that was running");

    // …and it is still watching: a real edit still reaches the sink.
    let target = dir.path().join("match/base.yml");
    const EDIT: &str = "matches:\n  - trigger: ':kept'\n    replace: still watched\n";
    fs::write(&target, EDIT).expect("the edit after the refused open");
    let got = await_observation(&observations, "the kept watcher's delivery", |o| {
        is_changed_at(o, &target)
    });
    assert_eq!(got.epoch, 1);
} // End of function a_failed_reopen_keeps_the_previous_watcher_watching()

/// Dropping the session drops the watcher: the worker is joined and the sink
/// closes, which is shutdown's whole contract.
#[test]
fn dropping_the_session_joins_the_worker_and_closes_the_sink() {
    let dir = synthetic_tree();
    let (sink, observations) = channel_sink();
    let session = WorkspaceSession::observing(sink, fast_config());
    session.open(Some(dir.path())).expect("the tree opens");
    wait_until_ready(&session);

    drop(session);
    // The proof of the join is the channel. The only senders live inside the
    // sink, whose only holders were the session and the worker it joined on
    // drop — so `Disconnected` here means the worker exited and nothing can
    // reach the sink again. Nothing was written, so a pending observation
    // arriving as `Ok` is a failure, not noise.
    match observations.recv_timeout(PATIENCE) {
        Err(RecvTimeoutError::Disconnected) => {}
        other => panic!("expected the sink to close when the session dropped, got {other:?}"),
    }
} // End of function dropping_the_session_joins_the_worker_and_closes_the_sink()

/// The test-only economy keeps the lifecycle's bookkeeping: an unwatched
/// session's opens still mint epochs and still consume the replaced
/// lifecycle, while observably watching nothing (`ready: false`, no stream).
///
/// This is what makes the ~65 command tests' sessions well-defined rather
/// than merely fast; the real lifecycle's evidence is everything above.
#[test]
fn an_unwatched_session_keeps_epoch_semantics_while_watching_nothing() {
    let dir = synthetic_tree();
    let session = WorkspaceSession::unwatched();
    session.open(Some(dir.path())).expect("the tree opens");
    let status = session.watch_status().expect("a workspace is open");
    assert_eq!(status.epoch, 1);
    assert!(!status.ready, "an inert lifecycle never becomes ready");
    assert!(!status.polling, "an inert lifecycle engages nothing");

    session.open(Some(dir.path())).expect("the reopen succeeds");
    assert_eq!(
        session.watch_status().expect("still open").epoch,
        2,
        "replacement still increments the epoch with an inert lifecycle"
    );
} // End of function an_unwatched_session_keeps_epoch_semantics_while_watching_nothing()

/// A root the native backend cannot watch — the fresh-install shape, where
/// only one of the two directories exists — engages the polling fallback, and
/// the rescan cadence delivers what no native watch covers.
#[test]
fn an_unavailable_root_engages_the_polling_fallback_and_a_rescan_delivers() {
    let dir = match_only_tree();
    let (sink, observations) = channel_sink();
    let session = WorkspaceSession::observing(sink, fast_config());
    session
        .open(Some(dir.path()))
        .expect("a tree with only match/ opens");
    wait_until_ready(&session);
    assert!(
        session.watch_status().expect("open").polling,
        "an unwatchable root must engage the polling fallback"
    );

    // The unavailable root gains a file. No native watch was ever established
    // over config/, so only the rescan can deliver this — and it must.
    fs::create_dir_all(dir.path().join("config")).expect("the late config root");
    let arrived = dir.path().join("config/default.yml");
    fs::write(&arrived, CONFIG_YML).expect("the late profile");
    let got = await_observation(&observations, "the rescan-delivered addition", |o| {
        is_added_at(o, &arrived)
    });
    assert_eq!(got.epoch, 1);
    let Observation::Added { content, .. } = &got.observation else {
        unreachable!("the predicate admitted only Added");
    };
    assert_exact_source_bytes(content, CONFIG_YML, "the rescan-delivered addition");
} // End of function an_unavailable_root_engages_the_polling_fallback_and_a_rescan_delivers()

/// Replacement must never join the old worker while holding a mutex a sink
/// callback can acquire. The sink here **re-enters the session** — it calls
/// `watch_status`, which takes the session lock — while a reopen is
/// replacing the workspace, exactly the interleaving a 2d-4 queue consumer
/// could produce. Before the round-1 fix, `open` held the session lock
/// across the join, so this choreography deadlocked: the worker waited for
/// the lock inside its callback while `open` waited for the worker inside
/// the join. Now the re-entry must complete and the reopen must return.
#[test]
fn a_sink_that_reenters_the_session_during_replacement_does_not_deadlock() {
    let first = synthetic_tree();
    let second = synthetic_tree();

    // The sink needs the session and the session is built with the sink, so
    // the reference arrives through a slot filled after construction.
    let session_slot: Arc<OnceLock<Weak<WorkspaceSession>>> = Arc::new(OnceLock::new());
    let (entered_tx, entered) = std::sync::mpsc::channel::<()>();
    let (proceed_tx, proceed) = std::sync::mpsc::channel::<()>();
    let (reentered_tx, reentered) = std::sync::mpsc::channel::<bool>();

    let target = first.path().join("match/base.yml");
    let sink: AdmittedSink = {
        let slot = Arc::clone(&session_slot);
        let target = target.clone();
        // A `Receiver` is not `Sync` and the sink must be, so the sink's
        // waiting end travels behind a mutex only the worker thread locks.
        let proceed = Mutex::new(proceed);
        Arc::new(move |observation: AdmittedObservation| {
            if !is_changed_at(&observation, &target) {
                return;
            }
            // Announce that the worker is parked inside the callback, wait
            // (bounded) for the test to start the replacement, then re-enter
            // the session while that replacement is joining this worker.
            let _ = entered_tx.send(());
            let _ = proceed
                .lock()
                .expect("only this worker locks the receiver")
                .recv_timeout(PATIENCE);
            let observed = slot
                .get()
                .and_then(Weak::upgrade)
                .is_some_and(|session| session.watch_status().is_some());
            let _ = reentered_tx.send(observed);
        })
    }; // End of the block building the re-entering sink

    let session = Arc::new(WorkspaceSession::observing(sink, fast_config()));
    session_slot
        .set(Arc::downgrade(&session))
        .expect("the slot is set exactly once");
    session
        .open(Some(first.path()))
        .expect("the first tree opens");
    wait_until_ready(&session);

    // Park the worker inside the sink callback.
    fs::write(
        &target,
        "matches:\n  - trigger: ':parked'\n    replace: in the sink\n",
    )
    .expect("the edit that parks the worker in the sink");
    entered
        .recv_timeout(PATIENCE)
        .expect("the worker reached the sink");

    // Start the replacement from another thread while the worker is parked.
    // `open` sends Stop and must join that very worker before returning.
    let opener = {
        let session = Arc::clone(&session);
        let root = second.path().to_path_buf();
        std::thread::spawn(move || session.open(Some(&root)).map(|_| ()))
    };
    // Let the reopen reach its join. The sleep decides no verdict — the
    // bounded waits below do — it only widens the overlap this test exists
    // to create (the module's flakiness policy).
    std::thread::sleep(Duration::from_millis(300));
    proceed_tx
        .send(())
        .expect("the sink is waiting for permission");

    // The deadlock detector: were the join still under the session lock,
    // the sink's `watch_status` could never return and nothing would arrive
    // here inside PATIENCE.
    let observed = reentered
        .recv_timeout(PATIENCE)
        .expect("the sink's re-entry into the session must complete");
    assert!(observed, "the re-entry observed an open session");

    opener
        .join()
        .expect("the opening thread must not panic")
        .expect("the second tree opens");
    assert_eq!(
        session.watch_status().expect("open").epoch,
        2,
        "the replacement completed, joined the old worker, and installed the successor"
    );
} // End of function a_sink_that_reenters_the_session_during_replacement_does_not_deadlock()

/// A sink callback may itself call `open`, replacing the very watcher whose
/// worker is running the callback — and a thread cannot join itself, so the
/// teardown must route that join off the worker. Three bounded verdicts: the
/// callback-initiated reopen **returns** (a self-join would hang exactly
/// there), the replaced worker is **actually joined** — the join probe is the
/// reaper's completion handshake, stored only after its join of that worker
/// returned — and the successor **watches**. Both trees hold only `match/`,
/// so delivery rides the rescan cadence and no FSEvents delivery decides a
/// verdict.
#[test]
fn a_sink_that_reopens_the_workspace_does_not_join_its_own_worker() {
    let first = match_only_tree();
    let second = match_only_tree();

    let session_slot: Arc<OnceLock<Weak<WorkspaceSession>>> = Arc::new(OnceLock::new());
    let (forward, observations) = std::sync::mpsc::channel::<AdmittedObservation>();
    let (reopened_tx, reopened) = std::sync::mpsc::channel::<Result<(), String>>();
    let reopen_once = Arc::new(AtomicBool::new(false));

    let target = first.path().join("match/base.yml");
    let second_root = second.path().to_path_buf();
    let sink: AdmittedSink = {
        let slot = Arc::clone(&session_slot);
        let reopen_once = Arc::clone(&reopen_once);
        let target = target.clone();
        Arc::new(move |observation: AdmittedObservation| {
            let reopens =
                is_changed_at(&observation, &target) && !reopen_once.swap(true, Ordering::SeqCst);
            let _ = forward.send(observation);
            if !reopens {
                return;
            }
            // On the worker thread: replace the workspace this very worker
            // watches. `open` consumes this worker's own lifecycle, and it
            // must return rather than wait for a join that only this
            // thread's own exit could ever satisfy.
            let outcome = match slot.get().and_then(Weak::upgrade) {
                Some(session) => session
                    .open(Some(&second_root))
                    .map(|_| ())
                    .map_err(|error| format!("{error:?}")),
                None => Err("the session was already gone".to_string()),
            };
            let _ = reopened_tx.send(outcome);
        })
    }; // End of the block building the reopening sink

    let session = Arc::new(WorkspaceSession::observing(sink, fast_config()));
    session_slot
        .set(Arc::downgrade(&session))
        .expect("the slot is set exactly once");
    session
        .open(Some(first.path()))
        .expect("the first tree opens");
    wait_until_ready(&session);
    let replaced_worker = session
        .watcher_join_probe()
        .expect("the first watcher is running");

    fs::write(
        &target,
        "matches:\n  - trigger: ':reopen'\n    replace: from the sink\n",
    )
    .expect("the edit that makes the sink reopen");

    // First verdict: the reopen performed inside the callback returned at
    // all — a self-join would hang it forever, and PATIENCE bounds this.
    reopened
        .recv_timeout(PATIENCE)
        .expect("the callback-initiated reopen must return")
        .expect("the second tree opens");
    assert_eq!(
        session.watch_status().expect("open").epoch,
        2,
        "the callback-initiated replacement installed the successor"
    );

    // Second verdict: the replaced worker fully terminated — the probe is
    // stored by the reaper only after its join of that worker returned.
    wait_for("the reaper's join of the replaced worker", || {
        replaced_worker.completed()
    });

    // Third verdict: the successor watches — a real addition under the
    // second tree arrives, tagged with its own epoch.
    wait_until_ready(&session);
    let arrived = second.path().join("match/added.yml");
    fs::write(&arrived, BASE_YML).expect("the successor tree's addition");
    let got = await_observation(&observations, "the successor's delivery", |o| {
        is_added_at(o, &arrived)
    });
    assert_eq!(got.epoch, 2, "the successor tags with its own epoch");
} // End of function a_sink_that_reopens_the_workspace_does_not_join_its_own_worker()

/// The narrower self-join shape from round 2: a sink callback upgrades a
/// `Weak`, becomes the **last strong owner**, and drops the whole session —
/// so the session teardown, current watcher included, runs on the worker
/// thread itself. The teardown must complete inside the callback (a bounded
/// signal sent after the drop returns), the worker must be actually joined
/// off itself (the probe), and the sink must close (`Disconnected` — every
/// holder of it is gone, the exited worker included). The tree holds only
/// `match/`, so delivery rides the rescan cadence and no FSEvents delivery
/// decides a verdict.
#[test]
fn a_sink_that_becomes_the_last_owner_drops_the_session_without_joining_itself() {
    let dir = match_only_tree();

    // The test surrenders its own strong reference into this slot, so the
    // callback's take makes the callback the last owner.
    let last_owner: Arc<Mutex<Option<Arc<WorkspaceSession>>>> = Arc::new(Mutex::new(None));
    let (forward, observations) = std::sync::mpsc::channel::<AdmittedObservation>();
    let (dropped_tx, dropped) = std::sync::mpsc::channel::<()>();
    let drop_once = Arc::new(AtomicBool::new(false));

    let target = dir.path().join("match/base.yml");
    let sink: AdmittedSink = {
        let last_owner = Arc::clone(&last_owner);
        let drop_once = Arc::clone(&drop_once);
        let target = target.clone();
        Arc::new(move |observation: AdmittedObservation| {
            let drops =
                is_changed_at(&observation, &target) && !drop_once.swap(true, Ordering::SeqCst);
            let _ = forward.send(observation);
            if !drops {
                return;
            }
            // On the worker thread: take the last strong reference and drop
            // it. The session drop tears down this very watcher, and it must
            // complete here rather than wait to join the thread it runs on.
            let session = last_owner
                .lock()
                .expect("only this worker takes the last owner")
                .take();
            drop(session);
            let _ = dropped_tx.send(());
        })
    }; // End of the block building the last-owner-dropping sink

    let session = Arc::new(WorkspaceSession::observing(sink, fast_config()));
    session.open(Some(dir.path())).expect("the tree opens");
    wait_until_ready(&session);
    let worker = session
        .watcher_join_probe()
        .expect("the watcher is running");
    *last_owner.lock().expect("nothing else holds the slot yet") = Some(session);

    fs::write(
        &target,
        "matches:\n  - trigger: ':drop'\n    replace: from the sink\n",
    )
    .expect("the edit that makes the sink drop the session");

    // The teardown performed inside the callback must complete — a self-join
    // in the session drop would hang before this signal is ever sent.
    dropped
        .recv_timeout(PATIENCE)
        .expect("the session teardown inside the callback must complete");

    // The worker actually terminated and was joined, off its own thread.
    wait_for("the reaper's join of the dropped worker", || {
        worker.completed()
    });

    // And the sink is closed: its only holders were the session, dropped in
    // the callback, and the worker, gone at exit — so after any deliveries
    // already in flight, the channel disconnects rather than idling open.
    let deadline = Instant::now() + PATIENCE;
    loop {
        let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
            panic!("the sink never closed after the session dropped");
        };
        match observations.recv_timeout(remaining) {
            // Deliveries of the torn-down epoch may still land until the
            // worker exits; epoch-tagged, and here simply drained.
            Ok(_) => {}
            Err(RecvTimeoutError::Disconnected) => break,
            Err(RecvTimeoutError::Timeout) => {
                panic!("the sink never closed after the session dropped")
            }
        }
    } // End of the loop draining the closing sink
} // End of function a_sink_that_becomes_the_last_owner_drops_the_session_without_joining_itself()

/// A still-unfinished earlier handoff cannot block a finished later handoff:
/// each reaper sweep joins every handle it observes finished, without
/// blocking on unfinished handles and irrespective of earlier handoffs —
/// round 3's finding, against the first reaper, which joined serially in
/// hand-over order and let one worker parked forever in its sink callback
/// block every join handed over behind it. Here the FIRST teardown's worker
/// parks inside its callback — strictly after its own reap
/// is handed to the reaper, released only at cleanup — then a SECOND session
/// tears itself down the same way and its worker exits, and the decisive
/// bounded wait is the second worker's join handshake completing while the
/// first is still parked: no hand-over-order release can produce that, since
/// the stuck reap is queued first. The parked worker's probe must still read
/// incomplete then (it has not exited, so no honest join can have returned),
/// and after the release its own reap must complete too, which is both the
/// held-handle policy observed and the suite exiting cleanly. Both trees
/// hold only `match/`, so delivery rides the rescan cadence and no FSEvents
/// delivery decides a verdict; every wait is bounded.
#[test]
fn a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it() {
    // The stuck teardown: its worker hands its own reap over, then parks.
    let stuck_tree = match_only_tree();
    let stuck_owner: Arc<Mutex<Option<Arc<WorkspaceSession>>>> = Arc::new(Mutex::new(None));
    let (handed_tx, handed) = std::sync::mpsc::channel::<()>();
    let (release_tx, release) = std::sync::mpsc::channel::<()>();
    let stuck_once = Arc::new(AtomicBool::new(false));

    let stuck_target = stuck_tree.path().join("match/base.yml");
    let stuck_sink: AdmittedSink = {
        let stuck_owner = Arc::clone(&stuck_owner);
        let stuck_once = Arc::clone(&stuck_once);
        let target = stuck_target.clone();
        // A `Receiver` is not `Sync` and the sink must be, so the parked
        // callback's waiting end travels behind a mutex only the worker locks.
        let release = Mutex::new(release);
        Arc::new(move |observation: AdmittedObservation| {
            if !is_changed_at(&observation, &target) || stuck_once.swap(true, Ordering::SeqCst) {
                return;
            }
            // On the worker thread: drop the last strong reference, so this
            // worker's own reap is handed to the reaper — and then park, so
            // this worker cannot exit until the test releases it. The reap
            // is queued FIRST: the test waits for `handed` before building
            // the second session, so everything later queues behind it.
            let session = stuck_owner
                .lock()
                .expect("only this worker takes the stuck owner")
                .take();
            drop(session);
            let _ = handed_tx.send(());
            let _ = release
                .lock()
                .expect("only this worker locks the release end")
                .recv_timeout(PATIENCE);
        })
    }; // End of the block building the parking sink

    let stuck_session = Arc::new(WorkspaceSession::observing(stuck_sink, fast_config()));
    stuck_session
        .open(Some(stuck_tree.path()))
        .expect("the stuck teardown's tree opens");
    wait_until_ready(&stuck_session);
    let stuck_worker = stuck_session
        .watcher_join_probe()
        .expect("the stuck teardown's watcher is running");
    *stuck_owner.lock().expect("nothing else holds the slot yet") = Some(stuck_session);

    fs::write(
        &stuck_target,
        "matches:\n  - trigger: ':park'\n    replace: until released\n",
    )
    .expect("the edit that parks the first worker");
    handed
        .recv_timeout(PATIENCE)
        .expect("the first worker must hand its reap over before parking");

    // The finished teardown, handed over strictly behind the stuck one.
    let finished_tree = match_only_tree();
    let finished_owner: Arc<Mutex<Option<Arc<WorkspaceSession>>>> = Arc::new(Mutex::new(None));
    let (dropped_tx, dropped) = std::sync::mpsc::channel::<()>();
    let finished_once = Arc::new(AtomicBool::new(false));

    let finished_target = finished_tree.path().join("match/base.yml");
    let finished_sink: AdmittedSink = {
        let finished_owner = Arc::clone(&finished_owner);
        let finished_once = Arc::clone(&finished_once);
        let target = finished_target.clone();
        Arc::new(move |observation: AdmittedObservation| {
            if !is_changed_at(&observation, &target) || finished_once.swap(true, Ordering::SeqCst) {
                return;
            }
            // The same last-owner teardown — but this callback returns, so
            // this worker exits, and only a reaper that never blocks on the
            // parked handle can complete its handshake behind it.
            let session = finished_owner
                .lock()
                .expect("only this worker takes the finished owner")
                .take();
            drop(session);
            let _ = dropped_tx.send(());
        })
    }; // End of the block building the exiting sink

    let finished_session = Arc::new(WorkspaceSession::observing(finished_sink, fast_config()));
    finished_session
        .open(Some(finished_tree.path()))
        .expect("the finished teardown's tree opens");
    wait_until_ready(&finished_session);
    let finished_worker = finished_session
        .watcher_join_probe()
        .expect("the finished teardown's watcher is running");
    *finished_owner
        .lock()
        .expect("nothing else holds the slot yet") = Some(finished_session);

    fs::write(
        &finished_target,
        "matches:\n  - trigger: ':exit'\n    replace: cleanly\n",
    )
    .expect("the edit that tears the second worker down");
    dropped
        .recv_timeout(PATIENCE)
        .expect("the second teardown inside its callback must complete");

    // The decisive verdict: the second worker's join handshake completes
    // while the first worker is still parked in its callback. A reaper
    // joining in hand-over order sits in the first join forever and this
    // bounded wait times out.
    wait_for(
        "the reap of the worker that exited behind the parked one",
        || finished_worker.completed(),
    );
    assert!(
        !stuck_worker.completed(),
        "the parked worker cannot have been joined — it has not exited"
    );

    // Cleanup: release the parked callback. The stuck worker's handle stayed
    // held all along — blocking nothing — and its own reap now completes,
    // which also lets the suite exit with no thread parked.
    release_tx
        .send(())
        .expect("the parked callback is waiting for the release");
    wait_for("the parked worker's own reap after its release", || {
        stuck_worker.completed()
    });
} // End of function a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it()

/// An exhausted epoch space can never reuse an epoch. The open still
/// succeeds — a missing watcher degrades reconciliation, not the session —
/// and the workspace watches nothing, reporting the unset zero rather than
/// any previously minted epoch. The session is `unwatched()` because the
/// arm under test — `allocate()`'s `Err` — precedes the economy's branch,
/// so it is the production arm either way and no stream cost is owed.
#[test]
fn an_exhausted_epoch_space_opens_unwatched_rather_than_reusing_an_epoch() {
    let dir = synthetic_tree();
    let session = WorkspaceSession::unwatched();
    session.seed_epochs(WorkspaceEpochs::starting_at(u64::MAX));
    session.open(Some(dir.path())).expect("the tree opens");
    assert_eq!(
        session.watch_status().expect("open").epoch,
        u64::MAX,
        "the last representable epoch is minted exactly once"
    );

    session
        .open(Some(dir.path()))
        .expect("the reopen succeeds at exhaustion");
    let status = session.watch_status().expect("still open");
    assert_eq!(
        status.epoch, NO_EPOCH,
        "an exhausted space reports the unset zero, never a reused epoch"
    );
    assert!(
        !status.ready,
        "a workspace without an epoch watches nothing"
    );

    session
        .open(Some(dir.path()))
        .expect("exhaustion is terminal, not transient");
    assert_eq!(
        session.watch_status().expect("still open").epoch,
        NO_EPOCH,
        "exhaustion stays exhausted across further replacements"
    );
} // End of function an_exhausted_epoch_space_opens_unwatched_rather_than_reusing_an_epoch()

// ---------------------------------------------------------------------------
// Phase 2d-3 — the app-write ledger, on the production path
// ---------------------------------------------------------------------------

/// Opens a watching session over a tree holding only `match/`, waits for its
/// baseline, and asserts the framing the two 2d-3 checks ride.
///
/// The missing `config/` root engages the polling fallback at start, so the
/// rescan cadence delivers whatever happens under `match/` **whether or not
/// FSEvents does** — the same technique the three teardown tests use, and the
/// reason no verdict below depends on native delivery. What is under test here
/// is the admission gate, which is indifferent to how a hint arrived.
fn polled_tree() -> (TempDir, WorkspaceSession, Receiver<AdmittedObservation>) {
    let dir = match_only_tree();
    let (sink, observations) = channel_sink();
    let session = WorkspaceSession::observing(sink, fast_config());
    session
        .open(Some(dir.path()))
        .expect("a tree with only match/ opens");
    wait_until_ready(&session);
    let status = session.watch_status().expect("a workspace is open");
    assert_eq!(status.epoch, 1, "the first open is the first epoch");
    assert!(
        status.polling,
        "the missing config/ root must engage the rescan cadence"
    );
    (dir, session, observations)
} // End of function polled_tree()

/// The identity of `<root>/<relative>` in an open session.
fn document_id(session: &WorkspaceSession, relative: &str) -> DocumentId {
    session
        .documents()
        .expect("the workspace is open")
        .iter()
        .find(|summary| summary.relative_path == Path::new(relative))
        .unwrap_or_else(|| panic!("no document at {relative}"))
        .id
}

/// Commits one whole-document replacement through the open session and answers
/// the revision it committed.
fn commit_raw_save(session: &WorkspaceSession, id: DocumentId, text: &str) -> ContentRevision {
    let before = session.document(id).expect("the file reads");
    let result = session
        .save_raw_document(id, before.revision, text, &Acknowledgement::none())
        .expect("the raw save runs");
    match result {
        SaveResult::Saved {
            revision,
            committed,
            backup_taken,
            ..
        } => {
            assert!(committed, "the premise: this save rewrote the file");
            assert!(backup_taken, "the premise: this save copied the file first");
            assert_eq!(
                revision,
                ContentRevision::of_bytes(text.as_bytes()),
                "the premise: the committed revision hashes the submitted bytes"
            );
            revision
        }
        other => panic!("expected a committed save, got {other:?}"),
    } // End of the match over the save's outcome
} // End of function commit_raw_save()

/// **The gate is installed on the production path, and it suppresses a real
/// committed save.**
///
/// Everything here is real: a real session, a real watcher over a real
/// directory, a real `save_document` transaction with its real rename, and the
/// gate `WorkspaceSession::observing` installs — the same one
/// `WorkspaceSession::new` installs, since both go through that constructor.
/// The positive verdict is the tally: without it, "no observation arrived" is
/// indistinguishable from a watcher that never noticed the write, which is the
/// mistake a negative-only test would make. Then the negative behind it — the
/// sink saw nothing for that file — and finally the discrimination that makes
/// the suppression a predicate rather than a blindfold: an external write of
/// **different** bytes to the same file is admitted, and is this epoch's first
/// numbered observation.
#[test]
fn a_committed_save_is_suppressed_while_a_later_external_write_is_not() {
    const SAVED: &str = "matches:\n  - trigger: ':saved'\n    replace: by this application\n";
    const EXTERNAL: &str = "matches:\n  - trigger: ':theirs'\n    replace: written elsewhere\n";

    let (dir, session, observations) = polled_tree();
    let target = dir.path().join("match/base.yml");
    let id = document_id(&session, "match/base.yml");
    let committed = commit_raw_save(&session, id, SAVED);
    assert_eq!(
        session.ledger().recorded_write(id),
        Some(AppWrite {
            epoch: 1,
            revision: committed
        }),
        "the committed revision is recorded, tagged with this workspace epoch"
    );

    // The watcher really did see the rename, stabilize on it and meet the
    // record — a bounded positive wait, not an inference from silence.
    wait_for("the save's own bytes to be suppressed", || {
        session.ledger().tally().suppressed >= 1
    });
    let seen = drain_for(&observations, Duration::from_millis(600));
    assert!(
        seen.iter().all(|o| observed_path(o) != target),
        "this application's own committed write reached the sink: {seen:?}"
    );
    assert_eq!(
        session.ledger().tally().admitted,
        0,
        "nothing at all was admitted while only this application had written"
    );
    // **And it was suppressed rather than merely refused as old.** The
    // chronology check the round-2 fix round added sits above the suppression
    // predicate, so a worker whose stamp were taken too early — at its start
    // rather than immediately before each engine pass — would refuse this hint
    // as `PrecedesACommit`, the positive wait above would time out, and this
    // line names why. It is the one production-path claim about the stamp that
    // a test can make; a stamp taken too *late* is invisible to every test and
    // is stated as a hole instead.
    //
    // **Zero is asserted because of this test's construction, not because zero
    // is a general health invariant** — round 10's Low, read here. Since the
    // round-9 fix round a path's commit anchor lives as long as the epoch, so a
    // settlement completed *before* a commit and delivered after it increments
    // that counter with nothing wrong (`crate::ledger::LedgerTally::preceded_a_commit`).
    // None can exist here: `wait_until_ready` has already absorbed the tree into
    // the engine's tracked state, the save below is the first write after it,
    // and a settlement needs two equal reads, so the earliest stamp that could
    // see the saved bytes twice is one probe after the rename while the anchor
    // follows the rename by one function return. **That is an ordering of two
    // durations and nothing enforces it**: a host slow enough between the rename
    // and `record_app_write` could fail this line without a defect.
    assert_eq!(
        session.ledger().tally().preceded_a_commit,
        0,
        "the save's own hint was read after its record, so no reading was refused as older"
    );

    // Different bytes, written by something else: admitted, numbered, and the
    // record it superseded is gone.
    fs::write(&target, EXTERNAL).expect("the external write");
    let got = await_observation(&observations, "the external write", |o| {
        is_changed_at(o, &target)
    });
    assert_eq!(got.epoch, 1);
    assert_eq!(
        got.sequence, 1,
        "the external change is this epoch's first admitted observation"
    );
    let Observation::Changed { content, .. } = &got.observation else {
        unreachable!("the predicate admitted only Changed");
    };
    assert_exact_source_bytes(content, EXTERNAL, "the external write");
    assert_eq!(
        session.ledger().recorded_write(id),
        None,
        "an accepted different revision supersedes the record"
    );
} // End of function a_committed_save_is_suppressed_while_a_later_external_write_is_not()

/// **Neither a real backup-producing save nor writes under the backup root
/// itself are ever observed**, because that root is a *sibling* of the watched
/// roots rather than a filtered subtree of them (the 2d design consult's Q2).
///
/// Three things are driven rather than argued. The save's premise is checked —
/// it reports `backup_taken` and the backup root really holds files afterwards,
/// so a version of this that silently stopped taking backups would fail rather
/// than pass vacuously. Then the shapes a backup batch and its **rotation**
/// perform are written and removed under that root by hand: a batch directory
/// appearing, a `.yml` entry copy inside it — deliberately named exactly like a
/// watched file, so it would pass the engine's own extension filter if the
/// scope were wrong — a batch marker, and the whole batch going away again.
/// Finally the fence that makes the negative mean something: in the same window
/// and on the same cadence, one real external write **under a watched root** is
/// admitted, and it is this epoch's only numbered observation.
#[test]
fn neither_a_backup_producing_save_nor_the_backup_root_is_ever_observed() {
    const SAVED: &str = "matches:\n  - trigger: ':backed-up'\n    replace: with a copy\n";
    const EXTERNAL: &str = "matches:\n  - trigger: ':theirs'\n    replace: written elsewhere\n";

    let (dir, session, observations) = polled_tree();
    let target = dir.path().join("match/base.yml");
    let id = document_id(&session, "match/base.yml");
    commit_raw_save(&session, id, SAVED);

    let backups = dir.path().join(BACKUP_DIRECTORY_NAME);
    assert!(
        backups.is_dir(),
        "the premise: a backup-producing save really wrote under {backups:?}"
    );
    assert!(
        !walk_files(&backups).is_empty(),
        "the premise: the backup root holds the batch marker and the entry copy"
    );
    wait_for("the save's own bytes to be suppressed", || {
        session.ledger().tally().suppressed >= 1
    });

    // The shapes a batch and its rotation perform, under that root, by hand.
    let batch = backups.join("1970-01-01T00-00-00Z-synthetic");
    fs::create_dir_all(batch.join("match")).expect("the synthetic batch");
    fs::write(batch.join("match/base.yml"), SAVED).expect("the entry copy");
    fs::write(batch.join(BATCH_MARKER_NAME), "synthetic\n").expect("the batch marker");
    fs::remove_dir_all(&batch).expect("the rotation of that batch");

    // The fence: a real write under a watched root, in the same window.
    fs::write(&target, EXTERNAL).expect("the external write");
    let got = await_observation(&observations, "the external write", |o| {
        is_changed_at(o, &target)
    });
    assert_eq!(got.epoch, 1);
    assert_eq!(
        got.sequence, 1,
        "the external change is this epoch's first admitted observation"
    );

    let seen = drain_for(&observations, Duration::from_millis(600));
    assert!(
        seen.iter().all(|o| !observed_path(o).starts_with(&backups)),
        "a backup path reached the sink: {seen:?}"
    );
    assert_eq!(
        session.ledger().tally().admitted,
        1,
        "only the external write under a watched root was ever admitted"
    );
} // End of function neither_a_backup_producing_save_nor_the_backup_root_is_ever_observed()

/// Every regular file under `root`, recursively — the backup tree, listed by
/// this test rather than by discovery, which cannot see it at all.
fn walk_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut found = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return found;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            found.extend(walk_files(&path));
        } else {
            found.push(path);
        }
    } // End of the loop over one backup directory's entries
    found
} // End of function walk_files()
