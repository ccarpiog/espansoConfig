//! The observation engine — hints in, typed observations out, deterministic
//! in shape (kinds, revisions, order) while identity values come from the
//! process-wide session identity table.
//!
//! **Phase 2d-1 scope: the engine, with no caller.** This is plan section
//! 6.5's steps 1, 2, 3 and 5 as one injected-clock, injected-reader state
//! machine (the 2d design consult's Q1): coalesce hints per path for the
//! debounce window, require two equal consecutive reads separated by a probe
//! interval, hash the exact stabilized bytes, and project and validate them
//! through the same source-to-document path a workspace read uses. Step 4 —
//! self-write suppression — is deliberately **not** here: it compares against
//! a ledger only the open application session can hold, so the command layer
//! applies [`crate::watch::self_write_suppresses`] to what this engine emits
//! (2d-3). Sequence numbers and workspace epochs are not here either, for the
//! same reason: they are facts about an application session, and this engine
//! is a fact about a directory.
//!
//! # A hint is not truth
//!
//! [`ObservationEngine::hint`] records that a path *may* have changed and
//! reads nothing. Every hint-driven read happens inside
//! [`ObservationEngine::tick`], at most one read per path per tick, so two
//! stability reads are always two ticks — the separation between them is real
//! wall-clock time under a real caller and two injected instants under a test,
//! never a loop the engine ran by itself. The engine never reads a clock of
//! its own: `now` is an argument everywhere, which is what makes every
//! scenario in the test suite a pure function of its inputs **in shape** —
//! observation kinds, revisions, order, texts and findings are fixed by the
//! schedule alone — while the `DocumentId` and `MatchId` *values* inside a
//! projection come from the process-wide session identity table
//! (`workspace::identity_of`, deliberately shared so the engine and a
//! `Workspace` of the same process agree on every path's identity) and
//! therefore also depend on which paths anything else in the process
//! identified first.
//!
//! # What stabilizes, and to what
//!
//! A pending path stabilizes when two consecutive reads agree exactly — same
//! bytes, same absence, or same failure kind. The stabilized state is compared
//! against the engine's tracked state for the path, and only a *difference*
//! becomes an [`Observation`]: repeated hints that stabilize to the tracked
//! revision coalesce to nothing (a byte-identical rewrite is not a content
//! observation), while a path that stabilizes present-but-different, absent,
//! or unreadable becomes `Changed`, `Added`, `Removed` or `Unreadable`. A
//! parse failure is **not** an absent observation: the stabilized text is
//! projected either way, and a snapshot that failed to parse carries its
//! diagnostics exactly as a workspace read of the same bytes would.
//!
//! # What TypeScript-style discipline cannot do here, stated plainly
//!
//! Rust forces the clock and the reader to be arguments, so no code path in
//! this module can reach a real timer or a real file behind a test's back.
//! What it does **not** force is that a caller's `now` values are monotonic —
//! the engine trusts them, and a clock that runs backwards simply finds
//! nothing due — nor that the caller keeps ticking until
//! [`ObservationEngine::next_deadline`] is `None`; a caller that stops ticking
//! has pending paths and no observations, not wrong ones.

use std::collections::BTreeMap;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::discovery::{classify_path, has_yaml_extension, DiscoveredFile, DiscoveryError};
use crate::model::context_of;
use crate::validate::{validate, Finding};
use crate::watch::correspond::{correspondences_between, CorrespondenceTable};
use crate::watch::watched_roots;
use crate::workspace::{identity_of, project_source};
use crate::{ContentRevision, SourceDocument};

/// An instant on the caller's monotonic clock, in milliseconds.
///
/// The engine never reads a clock: every deadline is computed from instants
/// the caller passes in, so a test owns time completely. The zero point means
/// nothing — only differences do — and the real caller (2d-2) maps its
/// `std::time::Instant` onto this by subtraction from any fixed origin.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Millis(pub u64);

impl Millis {
    /// This instant plus `ms` milliseconds, saturating at the top of `u64`.
    ///
    /// Saturating rather than wrapping: a wrapped deadline would land in the
    /// past and fire immediately, which turns an arithmetic edge into a
    /// skipped debounce.
    pub fn plus(self, ms: u64) -> Millis {
        Millis(self.0.saturating_add(ms))
    }
}

/// The engine's two timing parameters, validated at construction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EngineConfig {
    debounce_ms: u64,
    probe_ms: u64,
}

/// Why an [`EngineConfig`] was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineConfigError {
    /// The debounce window is outside plan section 6.5's 150–300 ms band. The
    /// band is the plan's, and making it a constructor refusal turns a comment
    /// into a check.
    DebounceOutOfBand {
        /// The window that was asked for.
        requested_ms: u64,
    },
    /// A zero probe interval would make the two stability reads the same
    /// instant, and two reads that nothing separates are one read.
    ProbeIntervalZero,
}

impl EngineConfig {
    /// The plan's lower debounce bound, inclusive.
    pub const DEBOUNCE_MIN_MS: u64 = 150;
    /// The plan's upper debounce bound, inclusive.
    pub const DEBOUNCE_MAX_MS: u64 = 300;

    /// Validates and builds a configuration.
    ///
    /// # Errors
    ///
    /// [`EngineConfigError::DebounceOutOfBand`] outside 150–300 ms, and
    /// [`EngineConfigError::ProbeIntervalZero`] for a probe interval of zero.
    pub fn new(debounce_ms: u64, probe_ms: u64) -> Result<EngineConfig, EngineConfigError> {
        if !(EngineConfig::DEBOUNCE_MIN_MS..=EngineConfig::DEBOUNCE_MAX_MS).contains(&debounce_ms) {
            return Err(EngineConfigError::DebounceOutOfBand {
                requested_ms: debounce_ms,
            });
        }
        if probe_ms == 0 {
            return Err(EngineConfigError::ProbeIntervalZero);
        }
        Ok(EngineConfig {
            debounce_ms,
            probe_ms,
        })
    } // End of function new()

    /// The per-path debounce window, in milliseconds.
    pub fn debounce_ms(&self) -> u64 {
        self.debounce_ms
    }

    /// The interval between the two stability reads, in milliseconds.
    pub fn probe_ms(&self) -> u64 {
        self.probe_ms
    }
}

impl Default for EngineConfig {
    /// 200 ms debounce — the middle of the plan's band — and a 40 ms probe.
    fn default() -> EngineConfig {
        EngineConfig::new(200, 40).expect("the default configuration is inside the plan's band")
    }
}

/// What one injected read of one path yielded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadOutcome {
    /// The file exists and these are its exact bytes.
    Present(Vec<u8>),
    /// No file exists at the path.
    Missing,
    /// The read failed for a reason other than absence.
    Failed(io::ErrorKind),
}

/// The engine's whole view of the filesystem, injected so a test owns it.
///
/// Two methods because the engine asks two questions: what is at one path, and
/// what does the tree hold. The production implementation is
/// [`FsWatchSource`]; a test implementation is any value that answers.
pub trait WatchSource {
    /// Reads the exact bytes at `path` as reachable under `root`, or says why
    /// it could not.
    ///
    /// The contract the engine's discovery alignment rests on — and one Rust
    /// cannot enforce on an injected implementation, so it is stated here: a
    /// path [`crate::discovery`]'s walk under `root` could not reach answers
    /// [`ReadOutcome::Missing`] — a final component that is not a regular
    /// file (a symlink, a directory, a fifo), an intermediate entry below a
    /// watched root that is not a real directory, or a path outside both
    /// watched roots — because an engine that read what the walk excludes
    /// would observe content discovery cannot see.
    fn read(&mut self, root: &Path, path: &Path) -> ReadOutcome;

    /// Enumerates every YAML file under `root`'s `config/` and `match/`.
    ///
    /// # Errors
    ///
    /// Whatever the walk itself failed with; the engine passes it through
    /// untouched.
    fn enumerate(&mut self, root: &Path) -> Result<Vec<DiscoveredFile>, DiscoveryError>;
}

/// The production source: `std::fs` reads and `crate::discovery` walks.
#[derive(Debug, Clone, Copy, Default)]
pub struct FsWatchSource;

impl WatchSource for FsWatchSource {
    /// Reads the exact bytes of a **regular file the walk could reach**,
    /// applying discovery's whole acceptance the walk's own way. The walk in
    /// [`crate::discovery`] enters a watched root, descends only into entries
    /// `symlink_metadata` says are real directories, and admits only entries
    /// it says are regular files — never following a symlink at any step — so
    /// this read answers [`ReadOutcome::Missing`] for a path outside both
    /// watched roots, for one whose part below the root is anything but plain
    /// names, for one behind an intermediate entry that is not a real
    /// directory, and for a final component that is not a regular file,
    /// wherever any of them points. A `.yml` symlink inside a watched root
    /// must not read and emit content from outside it; a directory named
    /// `*.yml` is not a file that failed to read; and a tracked path whose
    /// ancestor was replaced by a symlink — the route a rescan re-hints — is
    /// no longer a path the walk can reach, so it stabilizes as absent
    /// instead of emitting whatever the symlink points at. `NotFound`
    /// anywhere on the way is [`ReadOutcome::Missing`], and every other
    /// failure keeps its kind. One limit, stated because no test can fail a
    /// comment: each check and the read are separate calls, so a swap between
    /// them can still be read through — two stable reads narrow that window,
    /// nothing closes it.
    fn read(&mut self, root: &Path, path: &Path) -> ReadOutcome {
        let Some((watched, relative)) = watched_roots(root).into_iter().find_map(|watched| {
            path.strip_prefix(&watched)
                .ok()
                .map(|relative| (watched, relative.to_path_buf()))
        }) else {
            // Outside both watched roots: the walk never visits it.
            return ReadOutcome::Missing;
        };
        let components: Vec<_> = relative.components().collect();
        if components
            .iter()
            .any(|component| !matches!(component, Component::Normal(_)))
        {
            // The walk builds paths by pushing directory entries, so `.` and
            // `..` never appear below a watched root in one.
            return ReadOutcome::Missing;
        }
        let Some((_, ancestors)) = components.split_last() else {
            // The watched root itself is not a file the walk admits.
            return ReadOutcome::Missing;
        };
        let mut ancestor = watched;
        for component in ancestors {
            ancestor.push(component);
            match std::fs::symlink_metadata(&ancestor) {
                // The walk's own per-entry check: it descends only into what
                // `symlink_metadata` says is a real directory.
                Ok(metadata) if metadata.is_dir() => {}
                Ok(_) => return ReadOutcome::Missing,
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    return ReadOutcome::Missing
                }
                Err(error) => return ReadOutcome::Failed(error.kind()),
            }
        } // End of the loop over the intermediate ancestors
        let file_shaped = match std::fs::symlink_metadata(path) {
            Ok(metadata) => metadata.is_file(),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return ReadOutcome::Missing,
            Err(error) => return ReadOutcome::Failed(error.kind()),
        };
        if !file_shaped {
            return ReadOutcome::Missing;
        }
        match std::fs::read(path) {
            Ok(bytes) => ReadOutcome::Present(bytes),
            Err(error) if error.kind() == io::ErrorKind::NotFound => ReadOutcome::Missing,
            Err(error) => ReadOutcome::Failed(error.kind()),
        }
    } // End of function read()

    fn enumerate(&mut self, root: &Path) -> Result<Vec<DiscoveredFile>, DiscoveryError> {
        crate::discovery::enumerate(root).map(|tree| tree.files)
    }
}

/// What a stabilized read of a **present** file yielded.
#[derive(Debug, Clone)]
pub enum StableContent {
    /// Valid UTF-8, projected through [`crate::workspace::project_source`] —
    /// the same source-to-document path a workspace read uses — and validated.
    /// A parse failure is still this variant: the snapshot carries the
    /// diagnostics, exactly as a workspace read of the same bytes would.
    Projected {
        /// The stabilized snapshot. Its `revision` is the hash of the exact
        /// stabilized bytes, and its `source` is those bytes unchanged.
        snapshot: Box<SourceDocument>,
        /// The pure semantic report over the snapshot's view
        /// ([`crate::validate::validate`]). Risk under this crate's model,
        /// never a prophecy about espanso.
        findings: Vec<Finding>,
    },
    /// Present bytes that are not valid UTF-8 — hashed exactly, never decoded
    /// lossily. The workspace refuses such a file as an error; the engine
    /// reports it as a state, because a watcher that went silent about a file
    /// would be claiming the file did not change.
    NotUtf8 {
        /// Hash of the exact bytes on disk.
        revision: ContentRevision,
        /// Byte offset of the first invalid sequence.
        offset: usize,
    },
}

impl StableContent {
    /// The revision of the exact stabilized bytes, whatever they decode to.
    pub fn revision(&self) -> ContentRevision {
        match self {
            StableContent::Projected { snapshot, .. } => snapshot.revision,
            StableContent::NotUtf8 { revision, .. } => *revision,
        }
    }
}

/// One deterministic conclusion about one watched path — deterministic in the
/// module docs' qualified sense: shape, revisions and order come from the
/// input schedule alone, while the identity values inside a projection come
/// from the process-wide session table.
///
/// Every variant is a claim about a **stabilized** state — two consecutive
/// equal reads — never about a single read or a native event. None of them
/// claims who wrote, when, or in what order relative to another path: hashes
/// have no temporal order, and the engine does not infer one.
#[derive(Debug)]
pub enum Observation {
    /// A path this engine had announced now stably holds different content.
    ///
    /// "Announced" covers the baseline scan, a previous `Added` or `Changed`,
    /// and a previous `Unreadable`: a file that recovers from a stable read
    /// error is `Changed` **even when its bytes equal the pre-error content**,
    /// because the observation it supersedes is the `Unreadable`, not that
    /// content. That is the one case where `previous_revision` can equal the
    /// new content's revision, and it means *readable again, bytes as before*.
    Changed {
        /// The path that changed.
        path: PathBuf,
        /// The last stable content revision this engine held for the path —
        /// retained across an unreadable interlude — or `None` when no content
        /// was ever stably read.
        previous_revision: Option<ContentRevision>,
        /// The stabilized state now on disk.
        content: StableContent,
        /// Snapshot-bound correspondence evidence from the last projected
        /// content into this one. `None` when either side has no projection:
        /// no previous snapshot, or a new state that is not UTF-8.
        correspondences: Option<CorrespondenceTable>,
    },
    /// A YAML file the engine was not tracking stably exists.
    ///
    /// Also the shape a **recreation** takes: once `Removed` has been emitted
    /// for a path, file membership changed, so recreation is `Added` even when
    /// the new bytes hash like the old ones (the 2d design consult's Q3). A
    /// deletion and recreation that both happen inside one debounce window
    /// never stabilize as absent and therefore produce neither observation.
    Added {
        /// The file, classified by the same rules a directory walk applies.
        file: DiscoveredFile,
        /// The stabilized state on disk.
        content: StableContent,
    },
    /// A tracked path is stably gone. The engine forgets it; its
    /// [`crate::DocumentId`] is never re-pointed, and a recreation at the same
    /// path receives the same identity from the session table.
    Removed {
        /// The path that is gone.
        path: PathBuf,
        /// The last stable content revision, when one was ever read.
        previous_revision: Option<ContentRevision>,
    },
    /// A path stably fails to read, with the same failure kind twice.
    ///
    /// A claim about what could be read, never about what the file contains
    /// or whether it exists: absence has its own outcome, so this is an
    /// existing-but-unreadable state as far as two reads can tell. The last
    /// projected content, if any, is retained for the correspondence table of
    /// a later recovery.
    Unreadable {
        /// The path that could not be read.
        path: PathBuf,
        /// The stable failure kind. Diagnostic data for the caller's typed
        /// error channel — the engine renders no sentence from it.
        kind: io::ErrorKind,
    },
}

/// The last stably read content of a path, kept through an unreadable
/// interlude so a recovery can still say what it recovered *from*.
#[derive(Debug)]
struct LastContent {
    revision: ContentRevision,
    /// `None` when the content was present but not UTF-8.
    snapshot: Option<Box<SourceDocument>>,
}

/// The engine's held state for one tracked path.
#[derive(Debug)]
enum Tracked {
    /// The last stable state was projected UTF-8 content.
    Projected { snapshot: Box<SourceDocument> },
    /// The last stable state was present bytes that are not UTF-8.
    NotUtf8 { revision: ContentRevision },
    /// The last emission was `Unreadable`; `before` is the content that stood
    /// before the error, when any did.
    Unreadable {
        kind: io::ErrorKind,
        before: Option<LastContent>,
    },
}

impl Tracked {
    /// The last stable content revision, seen through an unreadable interlude.
    fn revision(&self) -> Option<ContentRevision> {
        match self {
            Tracked::Projected { snapshot } => Some(snapshot.revision),
            Tracked::NotUtf8 { revision } => Some(*revision),
            Tracked::Unreadable { before, .. } => before.as_ref().map(|last| last.revision),
        }
    }

    /// The last projected snapshot, seen through an unreadable interlude.
    fn snapshot(&self) -> Option<&SourceDocument> {
        match self {
            Tracked::Projected { snapshot } => Some(snapshot),
            Tracked::NotUtf8 { .. } => None,
            Tracked::Unreadable { before, .. } => {
                before.as_ref().and_then(|last| last.snapshot.as_deref())
            }
        }
    }
}

/// Where one pending path is in the debounce-then-stabilize pipeline.
#[derive(Debug)]
enum Pending {
    /// Hints are coalescing; the first stability read happens at `deadline`.
    /// A further hint pushes the deadline out (trailing-edge debounce), so a
    /// path written continuously never stabilizes — and no observation about
    /// it would be honest while it is still being written.
    Debouncing { deadline: Millis },
    /// The first stability read is in hand; an equal read at or after
    /// `probe_at` makes the state stable, and an unequal one becomes the new
    /// first read.
    Probing {
        probe_at: Millis,
        first: ReadOutcome,
    },
}

impl Pending {
    /// The instant at which this state wants its next read.
    fn due_at(&self) -> Millis {
        match self {
            Pending::Debouncing { deadline } => *deadline,
            Pending::Probing { probe_at, .. } => *probe_at,
        }
    }
}

/// The observation engine over one configuration root — deterministic in
/// observation shapes, revisions and order, while the identity values inside
/// its projections come from the process-wide session table (the module docs
/// state the qualification).
///
/// Holds a tracked state per YAML file under the two watched roots and a
/// pending pipeline per hinted path. Everything it emits is an
/// [`Observation`]; everything it consumes is a hint, an instant, or an
/// injected read.
#[derive(Debug)]
pub struct ObservationEngine {
    root: PathBuf,
    config: EngineConfig,
    tracked: BTreeMap<PathBuf, Tracked>,
    pending: BTreeMap<PathBuf, Pending>,
}

impl ObservationEngine {
    /// Opens the engine over `root`, seeding the tracked table with a baseline
    /// scan and emitting nothing.
    ///
    /// The baseline is the caller's opening state, not an observation: an
    /// observation describes a change from what was known, and at `start`
    /// nothing was. A file enters that opening state **only through
    /// consecutive-read stability** — two equal consecutive reads, the same
    /// criterion the tick pipeline applies — because a truncate/write race
    /// against a single read would seed bytes that never stably existed. A
    /// file whose two reads disagree is never installed: it is deferred into
    /// the ordinary pending pipeline, due at the caller's first tick, and
    /// earns its observation (`Added`, `Unreadable`, or nothing) once it
    /// stabilizes there. A file that stably reads as missing is skipped; one
    /// that stably fails is tracked as unreadable so its recovery is
    /// observable. What two adjacent reads cannot rule out — `start` has no
    /// clock, so nothing separates them — is a writer suspended mid-write for
    /// both, whose torn state reads equal twice; a later hint or rescan for
    /// the path re-runs the pipeline over it and corrects the baseline, and
    /// native delivery is expressly not guaranteed ([`crate::watch::native`]),
    /// so such a baseline can persist until one actually occurs.
    ///
    /// # Errors
    ///
    /// The enumeration's own [`DiscoveryError`], untouched.
    pub fn start(
        root: &Path,
        config: EngineConfig,
        source: &mut dyn WatchSource,
    ) -> Result<ObservationEngine, DiscoveryError> {
        let mut engine = ObservationEngine {
            root: root.to_path_buf(),
            config,
            tracked: BTreeMap::new(),
            pending: BTreeMap::new(),
        };
        for file in source.enumerate(root)? {
            if !engine.watches(&file.path) {
                continue;
            }
            let first = source.read(root, &file.path);
            let second = source.read(root, &file.path);
            if first != second {
                // A writer is racing the baseline: neither read is a state
                // that stably existed, so neither may become one. The later
                // read seeds an ordinary probe, due at the caller's first
                // tick (every caller instant is >= 0), and the path earns
                // its observation when it stabilizes.
                engine.pending.insert(
                    file.path,
                    Pending::Probing {
                        probe_at: Millis(0),
                        first: second,
                    },
                );
                continue;
            }
            match second {
                ReadOutcome::Present(bytes) => {
                    let content = engine.project_bytes(&file.path, bytes);
                    engine.tracked.insert(file.path, tracked_from(content));
                }
                ReadOutcome::Missing => {}
                ReadOutcome::Failed(kind) => {
                    engine
                        .tracked
                        .insert(file.path, Tracked::Unreadable { kind, before: None });
                }
            } // End of the match over the stable baseline outcome
        } // End of the loop over the baseline enumeration
        Ok(engine)
    } // End of function start()

    /// The configuration root this engine observes.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// The timing this engine runs under.
    pub fn config(&self) -> EngineConfig {
        self.config
    }

    /// Records that `path` may have changed. Reads nothing.
    ///
    /// A hint outside the two watched roots, or for a path without a YAML
    /// extension, is dropped: the backup root is a sibling of both roots and a
    /// save's temp file is deliberately not named `.yml`, so neither can enter
    /// the pipeline here. A hint for a path already pending restarts its
    /// debounce — a fresh hint means fresh writes, and a stability attempt
    /// over moving bytes proves nothing worth keeping.
    pub fn hint(&mut self, path: &Path, now: Millis) {
        if !self.watches(path) {
            return;
        }
        self.pending.insert(
            path.to_path_buf(),
            Pending::Debouncing {
                deadline: now.plus(self.config.debounce_ms),
            },
        );
    } // End of function hint()

    /// Advances every pending path whose deadline has passed, by exactly one
    /// read each, and returns the observations that stabilized.
    ///
    /// At most one read per path per tick keeps the two stability reads in
    /// two ticks, so their separation is real under a real caller and two
    /// injected instants under a test. Observations come out in path order —
    /// the pending table is a `BTreeMap` — so one input schedule produces one
    /// output sequence of observation shapes, revisions and order; the
    /// identity *values* inside their projections come from the process-wide
    /// session table (module docs), the one input no argument here carries.
    pub fn tick(&mut self, now: Millis, source: &mut dyn WatchSource) -> Vec<Observation> {
        let due: Vec<PathBuf> = self
            .pending
            .iter()
            .filter(|(_, pending)| pending.due_at() <= now)
            .map(|(path, _)| path.clone())
            .collect();
        let mut observations = Vec::new();
        for path in due {
            let Some(state) = self.pending.remove(&path) else {
                continue;
            };
            match state {
                Pending::Debouncing { .. } => {
                    let first = source.read(&self.root, &path);
                    self.pending.insert(
                        path,
                        Pending::Probing {
                            probe_at: now.plus(self.config.probe_ms),
                            first,
                        },
                    );
                }
                Pending::Probing { first, .. } => {
                    let second = source.read(&self.root, &path);
                    if first == second {
                        if let Some(observation) = self.settle(&path, second) {
                            observations.push(observation);
                        }
                    } else {
                        self.pending.insert(
                            path,
                            Pending::Probing {
                                probe_at: now.plus(self.config.probe_ms),
                                first: second,
                            },
                        );
                    }
                }
            } // End of the match over the pending path's pipeline stage
        } // End of the loop over the paths whose deadlines have passed
        observations
    } // End of function tick()

    /// Feeds every listed and every tracked path back through the ordinary
    /// pipeline, as hints at `now`. Emits nothing itself.
    ///
    /// The membership sweep for what per-file hints cannot carry — a native
    /// backend that degraded, or a directory-level operation whose per-file
    /// events never arrived. A path the enumeration lists and the table does
    /// not hold stabilizes as `Added`; one the table holds and the enumeration
    /// no longer lists stabilizes as `Removed`; everything unchanged
    /// stabilizes to its tracked revision and coalesces to nothing. Existing
    /// path-based identities are preserved by construction, because a rescan
    /// mints nothing — it only asks.
    ///
    /// # Errors
    ///
    /// The enumeration's own [`DiscoveryError`]; nothing is hinted when the
    /// walk itself failed.
    pub fn rescan(
        &mut self,
        now: Millis,
        source: &mut dyn WatchSource,
    ) -> Result<(), DiscoveryError> {
        let listed = source.enumerate(&self.root)?;
        let mut paths: Vec<PathBuf> = listed.into_iter().map(|file| file.path).collect();
        paths.extend(self.tracked.keys().cloned());
        for path in paths {
            self.hint(&path, now);
        }
        Ok(())
    } // End of function rescan()

    /// The next instant at which [`ObservationEngine::tick`] has work, or
    /// `None` when nothing is pending. A caller sleeps until this rather than
    /// polling; a test asserts quiescence with it.
    pub fn next_deadline(&self) -> Option<Millis> {
        self.pending.values().map(Pending::due_at).min()
    }

    /// Every path the engine currently tracks, in path order.
    pub fn tracked_paths(&self) -> impl Iterator<Item = &Path> {
        self.tracked.keys().map(PathBuf::as_path)
    }

    /// Every path currently in the debounce-then-stabilize pipeline.
    pub fn pending_paths(&self) -> impl Iterator<Item = &Path> {
        self.pending.keys().map(PathBuf::as_path)
    }

    /// The last stable content revision of a tracked path, retained across an
    /// unreadable interlude; `None` for an untracked path or one whose content
    /// was never stably read.
    pub fn revision_of(&self, path: &Path) -> Option<ContentRevision> {
        self.tracked.get(path).and_then(Tracked::revision)
    }

    /// The last projected snapshot of a tracked path, retained across an
    /// unreadable interlude. This is what makes the tracked state observable
    /// rather than merely asserted (`PROGRESS.md` R24), and what a lifecycle
    /// (2d-2) reads when it installs a stabilized snapshot into its own cache.
    pub fn snapshot_of(&self, path: &Path) -> Option<&SourceDocument> {
        self.tracked.get(path).and_then(Tracked::snapshot)
    }

    /// Whether a path is under a watched root and names a YAML file — the
    /// **lexical** half of admission, sharing `has_yaml_extension` with the
    /// walk. It reads nothing, so it cannot tell a file from a directory, a
    /// symlink that happens to be named `*.yml`, or a path the walk can no
    /// longer reach; that half is the read contract's ([`WatchSource::read`]
    /// answers `Missing` for a non-regular entry and for any path not
    /// reachable through real directories under a watched root — discovery's
    /// own acceptance), so such a hint schedules reads and then stabilizes as
    /// absent, observing nothing.
    fn watches(&self, path: &Path) -> bool {
        has_yaml_extension(path)
            && watched_roots(&self.root)
                .iter()
                .any(|root| path.starts_with(root))
    }

    /// Projects stabilized present bytes: UTF-8 through the same
    /// source-to-document path a workspace read uses, anything else hashed
    /// and refused as text.
    fn project_bytes(&self, path: &Path, bytes: Vec<u8>) -> StableContent {
        match String::from_utf8(bytes) {
            Ok(text) => {
                let file = classify_path(&self.root, path);
                let context = context_of(identity_of(path), &file);
                let snapshot = project_source(&context, &text);
                let findings = validate(&snapshot.view);
                StableContent::Projected {
                    snapshot: Box::new(snapshot),
                    findings,
                }
            }
            Err(error) => StableContent::NotUtf8 {
                revision: ContentRevision::of_bytes(error.as_bytes()),
                offset: error.utf8_error().valid_up_to(),
            },
        }
    } // End of function project_bytes()

    /// Turns one stabilized outcome into at most one observation, updating the
    /// tracked table in the same call.
    fn settle(&mut self, path: &Path, outcome: ReadOutcome) -> Option<Observation> {
        match outcome {
            ReadOutcome::Present(bytes) => self.settle_present(path, bytes),
            ReadOutcome::Missing => self.settle_missing(path),
            ReadOutcome::Failed(kind) => self.settle_failed(path, kind),
        }
    }

    /// A path stably holds `bytes`.
    fn settle_present(&mut self, path: &Path, bytes: Vec<u8>) -> Option<Observation> {
        let revision = ContentRevision::of_bytes(&bytes);
        // Coalesce against the tracked *content* state: a byte-identical
        // rewrite is not a content observation. An unreadable state never
        // coalesces here — recovering is a difference even at equal bytes.
        match self.tracked.get(path) {
            Some(Tracked::Projected { snapshot }) if snapshot.revision == revision => return None,
            Some(Tracked::NotUtf8 { revision: held }) if *held == revision => return None,
            _ => {}
        }
        let content = self.project_bytes(path, bytes);
        let prior = self.tracked.remove(path);
        let observation = match prior {
            None => Observation::Added {
                file: classify_path(&self.root, path),
                content: content.clone(),
            },
            Some(prior) => {
                let correspondences = match (&content, prior.snapshot()) {
                    (StableContent::Projected { snapshot, .. }, Some(base)) => {
                        Some(correspondences_between(base, snapshot))
                    }
                    _ => None,
                };
                Observation::Changed {
                    path: path.to_path_buf(),
                    previous_revision: prior.revision(),
                    content: content.clone(),
                    correspondences,
                }
            }
        };
        self.tracked
            .insert(path.to_path_buf(), tracked_from(content));
        Some(observation)
    } // End of function settle_present()

    /// A path is stably absent.
    fn settle_missing(&mut self, path: &Path) -> Option<Observation> {
        let prior = self.tracked.remove(path)?;
        Some(Observation::Removed {
            path: path.to_path_buf(),
            previous_revision: prior.revision(),
        })
    }

    /// A path stably fails to read with `kind`.
    fn settle_failed(&mut self, path: &Path, kind: io::ErrorKind) -> Option<Observation> {
        let (before, coalesce) = match self.tracked.remove(path) {
            Some(Tracked::Unreadable { kind: held, before }) => (before, held == kind),
            Some(Tracked::Projected { snapshot }) => (
                Some(LastContent {
                    revision: snapshot.revision,
                    snapshot: Some(snapshot),
                }),
                false,
            ),
            Some(Tracked::NotUtf8 { revision }) => (
                Some(LastContent {
                    revision,
                    snapshot: None,
                }),
                false,
            ),
            None => (None, false),
        };
        self.tracked
            .insert(path.to_path_buf(), Tracked::Unreadable { kind, before });
        if coalesce {
            return None;
        }
        Some(Observation::Unreadable {
            path: path.to_path_buf(),
            kind,
        })
    } // End of function settle_failed()
} // End of impl ObservationEngine

/// The tracked state a stabilized content becomes.
fn tracked_from(content: StableContent) -> Tracked {
    match content {
        StableContent::Projected { snapshot, .. } => Tracked::Projected { snapshot },
        StableContent::NotUtf8 { revision, .. } => Tracked::NotUtf8 { revision },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_debounce_outside_the_plans_band_is_refused() {
        assert_eq!(
            EngineConfig::new(149, 40),
            Err(EngineConfigError::DebounceOutOfBand { requested_ms: 149 })
        );
        assert_eq!(
            EngineConfig::new(301, 40),
            Err(EngineConfigError::DebounceOutOfBand { requested_ms: 301 })
        );
        assert!(EngineConfig::new(150, 40).is_ok());
        assert!(EngineConfig::new(300, 40).is_ok());
        assert_eq!(
            EngineConfig::new(200, 0),
            Err(EngineConfigError::ProbeIntervalZero)
        );
        let default = EngineConfig::default();
        assert_eq!(default.debounce_ms(), 200);
        assert_eq!(default.probe_ms(), 40);
    } // End of function a_debounce_outside_the_plans_band_is_refused()

    #[test]
    fn a_deadline_near_the_top_of_the_clock_saturates_instead_of_wrapping() {
        let close_to_the_top = Millis(u64::MAX - 10);
        assert_eq!(close_to_the_top.plus(200), Millis(u64::MAX));
    }

    /// Ticks at every deadline until quiescence, bounded so a wedged pipeline
    /// fails instead of hanging.
    fn drain_real(engine: &mut ObservationEngine, source: &mut FsWatchSource) -> Vec<Observation> {
        let mut out = Vec::new();
        for _ in 0..100 {
            let Some(deadline) = engine.next_deadline() else {
                return out;
            };
            out.extend(engine.tick(deadline, source));
        }
        panic!("the engine did not become quiescent within 100 ticks");
    } // End of function drain_real()

    #[test]
    fn a_directory_named_like_a_yaml_file_is_absent_not_unreadable() {
        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let real = root.join("match/base.yml");
        std::fs::write(&real, "matches: []\n").expect("a real file");
        let shaped = root.join("match/dir.yml");
        std::fs::create_dir_all(&shaped).expect("a directory named like a file");

        let mut source = FsWatchSource;
        // The read applies discovery's acceptance: a directory is not a file
        // that failed to read, and a regular file still answers its bytes.
        assert_eq!(source.read(&root, &shaped), ReadOutcome::Missing);
        assert_eq!(
            source.read(&root, &real),
            ReadOutcome::Present(b"matches: []\n".to_vec())
        );

        // Engine-level: the hint survives the lexical filter, stabilizes as
        // absent, and observes nothing — never an `Unreadable`.
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");
        assert_eq!(engine.tracked_paths().count(), 1);
        engine.hint(&shaped, Millis(0));
        let observations = drain_real(&mut engine, &mut source);
        assert!(
            observations.is_empty(),
            "a directory-shaped hint observes nothing: {observations:?}"
        );
        assert_eq!(engine.tracked_paths().count(), 1);
    } // End of function a_directory_named_like_a_yaml_file_is_absent_not_unreadable()

    #[cfg(unix)]
    #[test]
    fn a_yaml_symlink_inside_a_watched_root_never_reads_outside_content() {
        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        std::fs::write(root.join("match/base.yml"), "matches: []\n").expect("a real file");
        // The target lives outside both watched roots; the symlink's name is
        // admissible lexically.
        let outside = dir.path().join("outside.yml");
        std::fs::write(&outside, "matches:\n  - trigger: ':x'\n    replace: y\n")
            .expect("the outside file");
        let link = root.join("match/link.yml");
        std::os::unix::fs::symlink(&outside, &link).expect("the symlink");

        let mut source = FsWatchSource;
        assert_eq!(
            source.read(&root, &link),
            ReadOutcome::Missing,
            "a symlink is not a file discovery accepts, wherever it points"
        );

        // Engine-level: the baseline never enumerates it (the walk skips
        // symlinks), and a hint for it stabilizes as absent — no observation
        // ever carries the outside bytes.
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");
        assert_eq!(engine.tracked_paths().count(), 1);
        engine.hint(&link, Millis(0));
        let observations = drain_real(&mut engine, &mut source);
        assert!(
            observations.is_empty(),
            "a symlink hint observes nothing: {observations:?}"
        );
        assert!(engine.revision_of(&link).is_none());
    } // End of function a_yaml_symlink_inside_a_watched_root_never_reads_outside_content()

    #[cfg(unix)]
    #[test]
    fn a_rescan_never_reads_through_a_newly_symlinked_ancestor() {
        // The round-2 High's production route: a tracked file's ancestor
        // directory is replaced by a symlink, and `rescan` re-hints every
        // tracked path — so the read must refuse to reach the file the walk
        // no longer can, and the path stabilizes as absent (`Removed`),
        // never as the outside content behind the symlink.
        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match/sub")).expect("the watched subtree");
        let inner = root.join("match/sub/inner.yml");
        std::fs::write(&inner, "matches: []\n").expect("the tracked file");
        let outside_dir = dir.path().join("outside");
        std::fs::create_dir_all(&outside_dir).expect("the outside directory");
        let outside = "matches:\n  - trigger: ':x'\n    replace: y\n";
        std::fs::write(outside_dir.join("inner.yml"), outside).expect("the outside file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");
        assert_eq!(
            engine.revision_of(&inner),
            Some(ContentRevision::of_bytes(b"matches: []\n"))
        );

        // The ancestor swap: `match/sub` becomes a symlink to a directory
        // holding a different `inner.yml` — the tracked path still resolves,
        // but the walk can no longer reach it.
        std::fs::remove_dir_all(root.join("match/sub")).expect("the real directory removed");
        std::os::unix::fs::symlink(&outside_dir, root.join("match/sub")).expect("the symlink");

        engine
            .rescan(Millis(0), &mut source)
            .expect("a healthy enumeration");
        let observations = drain_real(&mut engine, &mut source);
        assert_eq!(
            observations.len(),
            1,
            "one removal and nothing else: {observations:?}"
        );
        assert!(
            matches!(&observations[0], Observation::Removed { path, .. } if path == &inner),
            "the re-hinted path is removed, never read through the symlink: {observations:?}"
        );
        assert!(engine.revision_of(&inner).is_none());
    } // End of function a_rescan_never_reads_through_a_newly_symlinked_ancestor()
}
