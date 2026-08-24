//! The observation engine, driven deterministically — injected hints, an
//! injected clock and an injected reader, per the 2d design consult's Q7
//! item 1. No test here touches a real timer, and none reads a real file
//! except the two corpus sections at the bottom, where the real bytes are the
//! thing under test (read-only, and the real corpus skips cleanly when
//! absent).

mod common;

use std::collections::BTreeMap;
use std::io;
use std::path::{Path, PathBuf};

use espansoconfig_core::discovery::{classify_path, DiscoveredFile, DiscoveryError, FileKind};
use espansoconfig_core::validate::FindingCode;
use espansoconfig_core::watch::engine::{
    EngineConfig, Millis, Observation, ObservationEngine, ReadOutcome, StableContent, WatchSource,
};
use espansoconfig_core::ContentRevision;

/// A neutral, hand-authored snippet file (CLAUDE.md section 1).
const BASE: &str = "matches:\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha\n\n  - trigger: ':two'\n    replace: beta\n";

/// The same two snippets, in the other order.
const REORDERED: &str = "matches:\n  - trigger: ':two'\n    replace: beta\n\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha\n";

/// One entry of the fake filesystem.
enum Entry {
    /// The file exists and holds these bytes.
    Bytes(Vec<u8>),
    /// Reading the file fails with this kind.
    Erroring(io::ErrorKind),
}

/// The injected filesystem: a map the test mutates between ticks, plus a log
/// of every read the engine asked for, so "nothing was read" is an assertion
/// rather than a hope.
struct FakeTree {
    root: PathBuf,
    files: BTreeMap<PathBuf, Entry>,
    /// Outcomes consumed one per read of a path, before `files` answers
    /// again — how a test tears a single read out of a racing write.
    staged: BTreeMap<PathBuf, Vec<Entry>>,
    reads: Vec<PathBuf>,
    enumeration_fails: bool,
}

impl FakeTree {
    /// An empty tree under a synthetic absolute root. Nothing here exists on
    /// any disk.
    fn new() -> FakeTree {
        FakeTree {
            root: PathBuf::from("/watched-tree"),
            files: BTreeMap::new(),
            staged: BTreeMap::new(),
            reads: Vec::new(),
            enumeration_fails: false,
        }
    }

    /// Installs `bytes` at `relative` under the root and returns the absolute
    /// path.
    fn put(&mut self, relative: &str, bytes: &[u8]) -> PathBuf {
        let path = self.root.join(relative);
        self.files
            .insert(path.clone(), Entry::Bytes(bytes.to_vec()));
        path
    }

    /// Removes the file at `path`.
    fn remove(&mut self, path: &Path) {
        self.files.remove(path);
    }

    /// Makes every read of `path` fail with `kind`.
    fn fail(&mut self, path: &Path, kind: io::ErrorKind) {
        self.files.insert(path.to_path_buf(), Entry::Erroring(kind));
    }

    /// Queues outcomes the next reads of `path` consume one each, before
    /// `files` answers again.
    fn stage(&mut self, path: &Path, outcomes: Vec<Entry>) {
        self.staged.insert(path.to_path_buf(), outcomes);
    }
}

impl WatchSource for FakeTree {
    /// The fake tree is synthetic, so reachability is whatever the injected
    /// map says: the root goes unused, and the trait doc's contract — answer
    /// `Missing` for what the walk could not reach — is the map's to honour.
    fn read(&mut self, _root: &Path, path: &Path) -> ReadOutcome {
        self.reads.push(path.to_path_buf());
        let staged = self
            .staged
            .get_mut(path)
            .filter(|queue| !queue.is_empty())
            .map(|queue| queue.remove(0));
        if let Some(entry) = staged {
            return match entry {
                Entry::Bytes(bytes) => ReadOutcome::Present(bytes),
                Entry::Erroring(kind) => ReadOutcome::Failed(kind),
            };
        }
        match self.files.get(path) {
            Some(Entry::Bytes(bytes)) => ReadOutcome::Present(bytes.clone()),
            Some(Entry::Erroring(kind)) => ReadOutcome::Failed(*kind),
            None => ReadOutcome::Missing,
        }
    } // End of function read()

    fn enumerate(&mut self, root: &Path) -> Result<Vec<DiscoveredFile>, DiscoveryError> {
        if self.enumeration_fails {
            return Err(DiscoveryError::Io {
                path: root.to_path_buf(),
                source: io::Error::from(io::ErrorKind::PermissionDenied),
            });
        }
        Ok(self
            .files
            .keys()
            .map(|path| classify_path(root, path))
            .collect())
    } // End of function enumerate()
}

/// An engine over `tree` with the default 200/40 timing, seeded by a baseline
/// scan.
fn engine_over(tree: &mut FakeTree) -> ObservationEngine {
    let root = tree.root.clone();
    ObservationEngine::start(&root, EngineConfig::default(), tree).expect("a baseline scan")
}

/// Ticks at every deadline until the engine is quiescent, collecting the
/// observations. Bounded, so a pipeline that never stabilizes fails the test
/// instead of hanging it.
fn drain(engine: &mut ObservationEngine, tree: &mut FakeTree) -> Vec<Observation> {
    let mut out = Vec::new();
    for _ in 0..100 {
        let Some(deadline) = engine.next_deadline() else {
            return out;
        };
        out.extend(engine.tick(deadline, tree));
    }
    panic!("the engine did not become quiescent within 100 ticks");
} // End of function drain()

/// Hints one path at `at` and drains to quiescence.
fn settle(
    engine: &mut ObservationEngine,
    tree: &mut FakeTree,
    path: &Path,
    at: Millis,
) -> Vec<Observation> {
    engine.hint(path, at);
    drain(engine, tree)
}

/// The revision of a byte string, spelled short.
fn revision_of(bytes: &[u8]) -> ContentRevision {
    ContentRevision::of_bytes(bytes)
}

// ---------------------------------------------------------------------------
// The baseline
// ---------------------------------------------------------------------------

#[test]
fn the_baseline_scan_tracks_without_observing() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let profile = tree.put("config/default.yml", b"backend: auto\n");
    let mut engine = engine_over(&mut tree);

    assert_eq!(engine.tracked_paths().count(), 2);
    assert_eq!(
        engine.revision_of(&base),
        Some(revision_of(BASE.as_bytes()))
    );
    assert_eq!(
        engine.revision_of(&profile),
        Some(revision_of(b"backend: auto\n"))
    );
    // Nothing is pending and nothing was observed: the baseline is the
    // caller's opening state, not a change from it.
    assert_eq!(engine.next_deadline(), None);
    assert!(drain(&mut engine, &mut tree).is_empty());
    // A baseline is installed only through consecutive-read stability: two
    // equal consecutive reads per file, the tick pipeline's own criterion.
    assert_eq!(
        tree.reads.len(),
        4,
        "two consecutive reads per baseline file"
    );
} // End of function the_baseline_scan_tracks_without_observing()

#[test]
fn a_torn_baseline_read_is_never_installed_and_stabilizes_through_the_pipeline() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    // A truncate-then-write racer: the baseline's first read catches half a
    // file, and every read after it sees the full bytes.
    tree.stage(&base, vec![Entry::Bytes(BASE.as_bytes()[..14].to_vec())]);
    let mut engine = engine_over(&mut tree);

    assert_eq!(
        engine.revision_of(&base),
        None,
        "bytes that never stably existed must not become a baseline"
    );
    assert!(engine.snapshot_of(&base).is_none());

    // The path was deferred into the ordinary pipeline, due at the first
    // tick, and earns its observation there with only the stable bytes.
    let observations = drain(&mut engine, &mut tree);
    assert_eq!(observations.len(), 1);
    let Observation::Added { content, .. } = &observations[0] else {
        panic!("a file the baseline could not stabilize arrives as an addition: {observations:?}");
    };
    assert_eq!(content.revision(), revision_of(BASE.as_bytes()));
    assert_eq!(
        engine.revision_of(&base),
        Some(revision_of(BASE.as_bytes()))
    );
} // End of function a_torn_baseline_read_is_never_installed_and_stabilizes_through_the_pipeline()

// ---------------------------------------------------------------------------
// Debounce and bursts
// ---------------------------------------------------------------------------

#[test]
fn nothing_is_read_before_the_debounce_deadline() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);
    tree.reads.clear();

    engine.hint(&base, Millis(0));
    assert!(engine.tick(Millis(199), &mut tree).is_empty());
    assert!(
        tree.reads.is_empty(),
        "a hint reads nothing before its deadline"
    );
    engine.tick(Millis(200), &mut tree);
    assert_eq!(
        tree.reads,
        vec![base.clone()],
        "the deadline takes one read"
    );
} // End of function nothing_is_read_before_the_debounce_deadline()

#[test]
fn a_burst_of_hints_coalesces_to_one_observation_and_two_reads() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.put("match/base.yml", REORDERED.as_bytes());
    for at in [0u64, 20, 40, 60, 80] {
        engine.hint(&base, Millis(at));
    }
    tree.reads.clear();
    let observations = drain(&mut engine, &mut tree);

    assert_eq!(observations.len(), 1);
    assert!(matches!(&observations[0], Observation::Changed { .. }));
    assert_eq!(
        tree.reads.len(),
        2,
        "a whole burst costs exactly the two stability reads"
    );
    // Trailing-edge debounce: the last hint set the deadline.
    assert!(engine.next_deadline().is_none());
} // End of function a_burst_of_hints_coalesces_to_one_observation_and_two_reads()

#[test]
fn a_hint_during_probing_restarts_the_debounce() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.put("match/base.yml", REORDERED.as_bytes());
    engine.hint(&base, Millis(0));
    // The debounce expires and the first stability read is taken…
    assert!(engine.tick(Millis(200), &mut tree).is_empty());
    // …then a fresh hint arrives: fresh writes, fresh debounce.
    engine.hint(&base, Millis(210));
    assert_eq!(engine.next_deadline(), Some(Millis(410)));
    let observations = drain(&mut engine, &mut tree);
    assert_eq!(observations.len(), 1);
} // End of function a_hint_during_probing_restarts_the_debounce()

#[test]
fn two_paths_debounce_independently() {
    let mut tree = FakeTree::new();
    let a = tree.put("match/a.yml", BASE.as_bytes());
    let b = tree.put("match/b.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.put("match/a.yml", REORDERED.as_bytes());
    tree.put("match/b.yml", REORDERED.as_bytes());
    engine.hint(&a, Millis(0));
    engine.hint(&b, Millis(150));

    // `a` settles across its own two deadlines while `b` is still debouncing.
    assert!(engine.tick(Millis(200), &mut tree).is_empty());
    let settled = engine.tick(Millis(240), &mut tree);
    assert_eq!(settled.len(), 1);
    assert!(matches!(&settled[0], Observation::Changed { path, .. } if path == &a));
    assert!(engine.pending_paths().any(|pending| pending == b));

    let rest = drain(&mut engine, &mut tree);
    assert_eq!(rest.len(), 1);
    assert!(matches!(&rest[0], Observation::Changed { path, .. } if path == &b));
} // End of function two_paths_debounce_independently()

// ---------------------------------------------------------------------------
// Stability: partial writes and transient errors
// ---------------------------------------------------------------------------

#[test]
fn a_partial_write_is_never_observed() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // A truncate-then-write editor: the first stability read catches half a
    // file.
    let partial = &REORDERED.as_bytes()[..20];
    tree.put("match/base.yml", partial);
    engine.hint(&base, Millis(0));
    assert!(engine.tick(Millis(200), &mut tree).is_empty());

    // The rest of the write lands before the probe read.
    tree.put("match/base.yml", REORDERED.as_bytes());
    assert!(
        engine.tick(Millis(240), &mut tree).is_empty(),
        "two unequal reads stabilize nothing"
    );

    // Two equal reads of the final bytes settle it.
    let observations = engine.tick(Millis(280), &mut tree);
    assert_eq!(observations.len(), 1);
    let Observation::Changed { content, .. } = &observations[0] else {
        panic!("a completed write is a change: {observations:?}");
    };
    assert_eq!(content.revision(), revision_of(REORDERED.as_bytes()));
    let StableContent::Projected { snapshot, .. } = content else {
        panic!("the final bytes are UTF-8 and project");
    };
    assert_eq!(
        snapshot.source, REORDERED,
        "only the stabilized bytes are ever observed, never the partial ones"
    );
} // End of function a_partial_write_is_never_observed()

#[test]
fn a_transient_read_error_recovers_without_an_unreadable_observation() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // The first stability read fails; the file is back before the probe.
    tree.fail(&base, io::ErrorKind::PermissionDenied);
    engine.hint(&base, Millis(0));
    assert!(engine.tick(Millis(200), &mut tree).is_empty());
    tree.put("match/base.yml", REORDERED.as_bytes());
    assert!(engine.tick(Millis(240), &mut tree).is_empty());

    let observations = drain(&mut engine, &mut tree);
    assert_eq!(observations.len(), 1);
    assert!(
        matches!(&observations[0], Observation::Changed { .. }),
        "an error that never stabilized is not an observation: {observations:?}"
    );
} // End of function a_transient_read_error_recovers_without_an_unreadable_observation()

// ---------------------------------------------------------------------------
// Exact hashing and coalescing
// ---------------------------------------------------------------------------

#[test]
fn a_byte_identical_rewrite_stabilizes_to_no_observation() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // espanso and editors both touch files without changing them.
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert!(
        observations.is_empty(),
        "identical bytes are not a content observation: {observations:?}"
    );
} // End of function a_byte_identical_rewrite_stabilizes_to_no_observation()

#[test]
fn a_trailing_newline_difference_is_a_change() {
    let mut tree = FakeTree::new();
    let without_newline = BASE.trim_end_matches('\n').to_owned();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.put("match/base.yml", without_newline.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1, "the hash is over exact bytes");
    let Observation::Changed {
        previous_revision,
        content,
        ..
    } = &observations[0]
    else {
        panic!("a one-byte difference is a change");
    };
    assert_eq!(*previous_revision, Some(revision_of(BASE.as_bytes())));
    assert_eq!(content.revision(), revision_of(without_newline.as_bytes()));
} // End of function a_trailing_newline_difference_is_a_change()

// ---------------------------------------------------------------------------
// Changed: projection, validation, parse failure
// ---------------------------------------------------------------------------

#[test]
fn an_external_edit_carries_projection_findings_and_the_exact_text() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // The new content has a semantic finding: a match with no content field.
    let edited = "matches:\n  - trigger: ':bare'\n";
    tree.put("match/base.yml", edited.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Changed { content, .. } = &observations[0] else {
        panic!("an edit is a change");
    };
    let StableContent::Projected { snapshot, findings } = content else {
        panic!("UTF-8 content projects");
    };
    assert_eq!(snapshot.source, edited);
    assert!(snapshot.parse.is_parsed());
    assert!(
        findings
            .iter()
            .any(|finding| finding.code == FindingCode::MatchHasNoContentField),
        "the pure semantic report runs over the stabilized projection"
    );
} // End of function an_external_edit_carries_projection_findings_and_the_exact_text()

#[test]
fn a_parse_failure_is_a_stable_observation_with_diagnostics_not_an_absent_one() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    let broken = "matches: [\n";
    tree.put("match/base.yml", broken.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Changed { content, .. } = &observations[0] else {
        panic!("a broken file still changed");
    };
    let StableContent::Projected { snapshot, .. } = content else {
        panic!("a parse failure is still a projection");
    };
    assert!(!snapshot.parse.is_parsed());
    assert!(
        !snapshot.view.diagnostics.is_empty(),
        "the failed parse carries its diagnostics"
    );
    assert_eq!(snapshot.source, broken, "the raw text is preserved exactly");
} // End of function a_parse_failure_is_a_stable_observation_with_diagnostics_not_an_absent_one()

// ---------------------------------------------------------------------------
// Non-UTF-8
// ---------------------------------------------------------------------------

#[test]
fn stable_non_utf8_bytes_are_hashed_and_typed_never_decoded() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    let binary = b"matches:\n  - trigger: '\xff\xfe'\n";
    tree.put("match/base.yml", binary);
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Changed {
        content,
        correspondences,
        ..
    } = &observations[0]
    else {
        panic!("non-UTF-8 bytes are still a change");
    };
    let StableContent::NotUtf8 { revision, offset } = content else {
        panic!("bytes that do not decode are typed, never lossily decoded");
    };
    assert_eq!(*revision, revision_of(binary));
    assert_eq!(*offset, 23, "the offset of the first invalid sequence");
    assert!(
        correspondences.is_none(),
        "no fresh projection means no correspondence table"
    );

    // Recovery to UTF-8 is a change from the non-UTF-8 revision, with no
    // correspondences: the non-UTF-8 state kept no snapshot to anchor from.
    tree.put("match/base.yml", REORDERED.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(1000));
    assert_eq!(observations.len(), 1);
    let Observation::Changed {
        previous_revision,
        correspondences,
        ..
    } = &observations[0]
    else {
        panic!("recovery to text is a change");
    };
    assert_eq!(*previous_revision, Some(revision_of(binary)));
    assert!(correspondences.is_none());
} // End of function stable_non_utf8_bytes_are_hashed_and_typed_never_decoded()

// ---------------------------------------------------------------------------
// Added, removed, recreation
// ---------------------------------------------------------------------------

#[test]
fn a_new_file_is_an_added_observation_with_its_classification() {
    let mut tree = FakeTree::new();
    tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    let new = tree.put("match/new.yml", BASE.as_bytes());
    let observations = settle(&mut engine, &mut tree, &new, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Added { file, content } = &observations[0] else {
        panic!("an unknown path with stable content is an addition");
    };
    assert_eq!(file.kind, FileKind::MatchFile);
    assert_eq!(file.relative_path, PathBuf::from("match/new.yml"));
    assert!(!file.disabled);
    assert_eq!(content.revision(), revision_of(BASE.as_bytes()));
    assert!(engine.tracked_paths().any(|tracked| tracked == new));
} // End of function a_new_file_is_an_added_observation_with_its_classification()

#[test]
fn removal_and_recreation_are_two_observations_even_with_identical_bytes() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);
    let original_id = engine.snapshot_of(&base).expect("a baseline snapshot").id;

    tree.remove(&base);
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Removed {
        previous_revision, ..
    } = &observations[0]
    else {
        panic!("a stably absent tracked path was removed");
    };
    assert_eq!(*previous_revision, Some(revision_of(BASE.as_bytes())));
    assert!(engine.tracked_paths().all(|tracked| tracked != base));

    // Recreation with the very same bytes: membership changed, so this is an
    // addition, never a coalesced nothing (2d design consult, Q3).
    tree.put("match/base.yml", BASE.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(1000));
    assert_eq!(observations.len(), 1);
    let Observation::Added { content, .. } = &observations[0] else {
        panic!("recreation is an addition: {observations:?}");
    };
    // The recreated path keeps its session identity: the table is keyed by
    // path for the life of the process, and no other file can inherit it.
    let StableContent::Projected { snapshot, .. } = content else {
        panic!("the recreated file projects");
    };
    assert_eq!(snapshot.id, original_id);
} // End of function removal_and_recreation_are_two_observations_even_with_identical_bytes()

#[test]
fn a_transient_deletion_inside_one_debounce_window_is_no_observation() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // Deleted and recreated identically before the first stability read: the
    // stable truth is unchanged content, and no absence ever stabilized.
    tree.remove(&base);
    engine.hint(&base, Millis(0));
    tree.put("match/base.yml", BASE.as_bytes());
    let observations = drain(&mut engine, &mut tree);
    assert!(
        observations.is_empty(),
        "an absence that never stabilized is not an observation: {observations:?}"
    );
} // End of function a_transient_deletion_inside_one_debounce_window_is_no_observation()

// ---------------------------------------------------------------------------
// Unreadable and recovery
// ---------------------------------------------------------------------------

#[test]
fn a_stable_read_error_is_one_unreadable_observation_until_it_changes() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.fail(&base, io::ErrorKind::PermissionDenied);
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Unreadable { kind, .. } = &observations[0] else {
        panic!("a stable failure is typed: {observations:?}");
    };
    assert_eq!(*kind, io::ErrorKind::PermissionDenied);

    // The same stable failure again coalesces to nothing.
    let observations = settle(&mut engine, &mut tree, &base, Millis(1000));
    assert!(
        observations.is_empty(),
        "the same unreadable state is one observation"
    );

    // A different failure kind is a new observation.
    tree.fail(&base, io::ErrorKind::TimedOut);
    let observations = settle(&mut engine, &mut tree, &base, Millis(2000));
    assert_eq!(observations.len(), 1);
    assert!(matches!(
        &observations[0],
        Observation::Unreadable { kind, .. } if *kind == io::ErrorKind::TimedOut
    ));
} // End of function a_stable_read_error_is_one_unreadable_observation_until_it_changes()

#[test]
fn recovery_after_a_stable_error_is_a_change_even_with_identical_bytes() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.fail(&base, io::ErrorKind::PermissionDenied);
    settle(&mut engine, &mut tree, &base, Millis(0));

    // The bytes come back exactly as they were. The observation this
    // supersedes is the Unreadable, not that content, so it must not coalesce:
    // equal revisions here mean "readable again, bytes as before".
    tree.put("match/base.yml", BASE.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(1000));
    assert_eq!(observations.len(), 1);
    let Observation::Changed {
        previous_revision,
        content,
        correspondences,
        ..
    } = &observations[0]
    else {
        panic!("recovery is a change: {observations:?}");
    };
    assert_eq!(*previous_revision, Some(revision_of(BASE.as_bytes())));
    assert_eq!(content.revision(), revision_of(BASE.as_bytes()));
    // The pre-error snapshot was retained through the interlude, so the
    // recovery still carries correspondence evidence.
    let table = correspondences
        .as_ref()
        .expect("a table from the retained snapshot");
    assert_eq!(table.base_revision, revision_of(BASE.as_bytes()));
    assert_eq!(table.entries.len(), 2);
} // End of function recovery_after_a_stable_error_is_a_change_even_with_identical_bytes()

#[test]
fn an_error_on_a_never_seen_path_is_typed_and_its_recovery_carries_no_previous() {
    let mut tree = FakeTree::new();
    tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    let stray = tree.root.join("match/stray.yml");
    tree.fail(&stray, io::ErrorKind::PermissionDenied);
    let observations = settle(&mut engine, &mut tree, &stray, Millis(0));
    assert_eq!(observations.len(), 1);
    assert!(matches!(&observations[0], Observation::Unreadable { .. }));

    tree.put("match/stray.yml", BASE.as_bytes());
    let observations = settle(&mut engine, &mut tree, &stray, Millis(1000));
    assert_eq!(observations.len(), 1);
    let Observation::Changed {
        previous_revision,
        correspondences,
        ..
    } = &observations[0]
    else {
        panic!("a path announced as unreadable recovers as a change");
    };
    assert_eq!(*previous_revision, None, "no content was ever stably read");
    assert!(correspondences.is_none());
} // End of function an_error_on_a_never_seen_path_is_typed_and_its_recovery_carries_no_previous()

// ---------------------------------------------------------------------------
// Rescan
// ---------------------------------------------------------------------------

#[test]
fn a_rescan_finds_additions_and_removals_and_coalesces_everything_unchanged() {
    let mut tree = FakeTree::new();
    tree.put("match/keep.yml", BASE.as_bytes());
    let gone = tree.put("match/gone.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // Membership changes with no hints at all — the case a degraded native
    // backend leaves behind.
    tree.remove(&gone);
    tree.put("match/new.yml", REORDERED.as_bytes());

    engine
        .rescan(Millis(0), &mut tree)
        .expect("a healthy enumeration");
    let observations = drain(&mut engine, &mut tree);
    assert_eq!(
        observations.len(),
        2,
        "unchanged files coalesce: {observations:?}"
    );
    // Path order: gone.yml before new.yml.
    assert!(matches!(&observations[0], Observation::Removed { path, .. } if path == &gone));
    assert!(
        matches!(&observations[1], Observation::Added { file, .. } if file.path == tree.root.join("match/new.yml"))
    );
} // End of function a_rescan_finds_additions_and_removals_and_coalesces_everything_unchanged()

#[test]
fn a_failing_enumeration_is_a_typed_refusal_that_hints_nothing() {
    let mut tree = FakeTree::new();
    tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.enumeration_fails = true;
    let refused = engine.rescan(Millis(0), &mut tree);
    assert!(matches!(refused, Err(DiscoveryError::Io { .. })));
    assert_eq!(engine.pending_paths().count(), 0, "nothing was hinted");
}

// ---------------------------------------------------------------------------
// The hint filter and the atomic-rename shapes
// ---------------------------------------------------------------------------

#[test]
fn hints_outside_the_watched_roots_or_without_a_yaml_extension_are_dropped() {
    let mut tree = FakeTree::new();
    tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // The backup root is a sibling of both watched roots (consult Q2), a
    // save's temp file is deliberately not `.yml`, a `.bak` is what a
    // rename-away leaves, and a YAML file directly under the root is outside
    // both watched directories.
    for stray in [
        ".espansoconfig-backups/2026/match/base.yml",
        "match/_base.yml.espansoconfig-r4nd0m.tmp",
        "match/base.yml.bak",
        "match/notes.txt",
        "stray.yml",
    ] {
        engine.hint(&tree.root.join(stray), Millis(0));
    }
    assert_eq!(
        engine.pending_paths().count(),
        0,
        "every one of those hints is dropped unread"
    );
} // End of function hints_outside_the_watched_roots_or_without_a_yaml_extension_are_dropped()

#[test]
fn an_atomic_replacement_is_one_change_carrying_only_the_final_bytes() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // The editor writes a temp file beside the target, then renames it over.
    // The temp path's hints are dropped by extension; the target's hints
    // stabilize once, to the final bytes — rename is atomic, so no read of the
    // target ever sees half a file.
    let temp = tree.put(
        "match/_base.yml.espansoconfig-r4nd0m.tmp",
        REORDERED.as_bytes(),
    );
    engine.hint(&temp, Millis(0));
    tree.remove(&temp);
    tree.put("match/base.yml", REORDERED.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(10));
    assert_eq!(observations.len(), 1);
    let Observation::Changed { content, .. } = &observations[0] else {
        panic!("the rename target changed");
    };
    assert_eq!(content.revision(), revision_of(REORDERED.as_bytes()));
} // End of function an_atomic_replacement_is_one_change_carrying_only_the_final_bytes()

#[test]
fn a_rename_away_is_a_removal_and_the_new_name_is_not_watched() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // `mv base.yml base.yml.bak`: the native backend hints both names.
    tree.remove(&base);
    tree.put("match/base.yml.bak", BASE.as_bytes());
    engine.hint(&tree.root.join("match/base.yml.bak"), Millis(0));
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    assert!(matches!(&observations[0], Observation::Removed { path, .. } if path == &base));
} // End of function a_rename_away_is_a_removal_and_the_new_name_is_not_watched()

#[test]
fn a_rename_into_the_tree_is_an_addition() {
    let mut tree = FakeTree::new();
    tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    // A crash-safe editor writes elsewhere and renames into place: by the
    // time the hint's deadline passes, the file simply exists.
    let arrived = tree.put("match/arrived.yml", REORDERED.as_bytes());
    let observations = settle(&mut engine, &mut tree, &arrived, Millis(0));
    assert_eq!(observations.len(), 1);
    assert!(matches!(&observations[0], Observation::Added { .. }));
} // End of function a_rename_into_the_tree_is_an_addition()

// ---------------------------------------------------------------------------
// Nested, disabled, packages, profiles
// ---------------------------------------------------------------------------

#[test]
fn nested_disabled_package_and_profile_files_are_all_watched_and_classified() {
    let mut tree = FakeTree::new();
    tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    let nested = tree.put("match/scoped/deep/nested.yml", BASE.as_bytes());
    let disabled = tree.put("match/_off.yml", BASE.as_bytes());
    let package = tree.put("match/packages/pack/package.yml", BASE.as_bytes());
    let profile = tree.put("config/terminal.yml", b"filter_title: Term\n");
    for path in [&nested, &disabled, &package, &profile] {
        engine.hint(path, Millis(0));
    }
    let observations = drain(&mut engine, &mut tree);
    assert_eq!(observations.len(), 4);

    let added: Vec<&DiscoveredFile> = observations
        .iter()
        .map(|observation| match observation {
            Observation::Added { file, .. } => file,
            other => panic!("every one of these is an addition: {other:?}"),
        })
        .collect();
    let by_path = |path: &Path| {
        *added
            .iter()
            .find(|file| file.path == path)
            .unwrap_or_else(|| panic!("missing {}", path.display()))
    };
    assert_eq!(by_path(&nested).kind, FileKind::MatchFile);
    assert!(
        by_path(&disabled).disabled,
        "a `_` file is watched and flagged"
    );
    assert_eq!(by_path(&package).kind, FileKind::Package);
    assert!(by_path(&package).kind.is_read_only());
    assert_eq!(by_path(&profile).kind, FileKind::ConfigProfile);
} // End of function nested_disabled_package_and_profile_files_are_all_watched_and_classified()

// ---------------------------------------------------------------------------
// Snapshot-bound correspondences on a Changed observation
// ---------------------------------------------------------------------------

#[test]
fn a_changed_observation_carries_a_table_bound_to_both_snapshots() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", BASE.as_bytes());
    let mut engine = engine_over(&mut tree);

    tree.put("match/base.yml", REORDERED.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Changed {
        content,
        correspondences,
        ..
    } = &observations[0]
    else {
        panic!("an external edit is a change");
    };
    let table = correspondences.as_ref().expect("a correspondence table");
    assert_eq!(table.base_revision, revision_of(BASE.as_bytes()));
    assert_eq!(table.disk_revision, content.revision());
    assert_eq!(table.entries.len(), 2, "one row per base match");
    for entry in &table.entries {
        // Both answers are about this observation's own snapshot: an
        // identified target is minted from the stabilized parse, never from
        // the base one.
        let exact = match &entry.exact {
            espansoconfig_core::reconcile::ReapplyResolution::Identified { target } => target,
            other => panic!("a pure reorder keeps every item findable: {other:?}"),
        };
        assert_eq!(exact.id.revision, table.disk_revision);
        assert_eq!(entry.base.revision, table.base_revision);
    } // End of the loop over the correspondence entries
} // End of function a_changed_observation_carries_a_table_bound_to_both_snapshots()

#[test]
fn a_previous_snapshot_that_did_not_parse_yields_an_empty_table() {
    let mut tree = FakeTree::new();
    let base = tree.put("match/base.yml", b"matches: [\n");
    let mut engine = engine_over(&mut tree);

    tree.put("match/base.yml", BASE.as_bytes());
    let observations = settle(&mut engine, &mut tree, &base, Millis(0));
    assert_eq!(observations.len(), 1);
    let Observation::Changed {
        correspondences, ..
    } = &observations[0]
    else {
        panic!("repair of a broken file is a change");
    };
    let table = correspondences.as_ref().expect("a table exists");
    assert!(
        table.entries.is_empty(),
        "a failed base projection carries nothing to find again"
    );
} // End of function a_previous_snapshot_that_did_not_parse_yields_an_empty_table()

// ---------------------------------------------------------------------------
// The byte-exact fixtures, read and hashed without being edited or logged
// ---------------------------------------------------------------------------

#[test]
fn every_synthetic_fixture_survives_the_engine_byte_exactly() {
    let valid = common::synthetic_valid();
    assert!(!valid.is_empty(), "the committed corpus is always present");
    for (index, fixture) in valid.iter().enumerate() {
        let bytes = std::fs::read(&fixture.path).expect("a committed fixture reads");
        let mut tree = FakeTree::new();
        tree.put("match/seed.yml", BASE.as_bytes());
        let mut engine = engine_over(&mut tree);

        let name = fixture
            .path
            .file_name()
            .and_then(|name| name.to_str())
            .expect("fixture names are UTF-8");
        let target = tree.put(&format!("match/{index}-{name}"), &bytes);
        let observations = settle(&mut engine, &mut tree, &target, Millis(0));
        assert_eq!(observations.len(), 1, "{name}: one addition");
        let Observation::Added { content, .. } = &observations[0] else {
            panic!("{name}: a new file is an addition");
        };
        assert_eq!(
            content.revision(),
            ContentRevision::of_bytes(&bytes),
            "{name}: the revision is the hash of the exact bytes"
        );
        let StableContent::Projected { snapshot, .. } = content else {
            panic!("{name}: a committed fixture is UTF-8 and projects");
        };
        assert_eq!(
            snapshot.source.as_bytes(),
            bytes.as_slice(),
            "{name}: the observed text is byte-identical to the file"
        );
    } // End of the loop over the committed valid fixtures
} // End of function every_synthetic_fixture_survives_the_engine_byte_exactly()

#[test]
fn every_invalid_fixture_is_a_stable_projected_observation_with_a_failed_parse() {
    for (index, fixture) in common::synthetic_invalid().iter().enumerate() {
        let bytes = std::fs::read(&fixture.path).expect("a committed fixture reads");
        let mut tree = FakeTree::new();
        tree.put("match/seed.yml", BASE.as_bytes());
        let mut engine = engine_over(&mut tree);

        let target = tree.put(&format!("match/broken-{index}.yml"), &bytes);
        let observations = settle(&mut engine, &mut tree, &target, Millis(0));
        assert_eq!(observations.len(), 1, "{}: one addition", fixture.name);
        let Observation::Added { content, .. } = &observations[0] else {
            panic!("{}: a new file is an addition", fixture.name);
        };
        let StableContent::Projected { snapshot, .. } = content else {
            panic!("{}: invalid YAML is still UTF-8 text", fixture.name);
        };
        assert!(
            !snapshot.parse.is_parsed(),
            "{}: the fixture exists to fail",
            fixture.name
        );
        assert!(!snapshot.view.diagnostics.is_empty(), "{}", fixture.name);
    } // End of the loop over the committed invalid fixtures
} // End of function every_invalid_fixture_is_a_stable_projected_observation_with_a_failed_parse()

// ---------------------------------------------------------------------------
// The real corpus — names, counts and revisions only; skips cleanly
// ---------------------------------------------------------------------------

#[test]
fn the_real_corpus_baselines_and_rescans_quietly_reporting_names_and_revisions_only() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "the_real_corpus_baselines_and_rescans_quietly_reporting_names_and_revisions_only",
        &files,
    ) {
        return;
    }

    let mut tree = FakeTree::new();
    let mut placed = Vec::new();
    for file in &files {
        // `name` is relative to the corpus root: `real/match/…` or
        // `real/config/…`. Reproduce the same shape under the fake root.
        let Some(relative) = file.name.strip_prefix("real/") else {
            continue;
        };
        let bytes = std::fs::read(&file.path).expect("a synced real-corpus file reads");
        let path = tree.put(relative, &bytes);
        placed.push((relative.to_owned(), path, ContentRevision::of_bytes(&bytes)));
    } // End of the loop that mirrors the real corpus into the fake tree

    let mut engine = engine_over(&mut tree);
    println!(
        "real corpus: {} files, {} tracked at baseline",
        placed.len(),
        engine.tracked_paths().count()
    );
    for (relative, path, revision) in &placed {
        assert_eq!(
            engine.revision_of(path),
            Some(*revision),
            "{relative}: the baseline revision is the hash of the exact bytes"
        );
        println!("  {relative}: {revision}");
    } // End of the loop that checks every real-corpus revision

    // A rescan over an unchanged tree stabilizes everything back to its
    // tracked revision and observes nothing.
    engine
        .rescan(Millis(0), &mut tree)
        .expect("a healthy enumeration");
    let observations = drain(&mut engine, &mut tree);
    assert!(
        observations.is_empty(),
        "an unchanged real corpus coalesces to nothing ({} observations)",
        observations.len()
    );
} // End of function the_real_corpus_baselines_and_rescans_quietly_reporting_names_and_revisions_only()
