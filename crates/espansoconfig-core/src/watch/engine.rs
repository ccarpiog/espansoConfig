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
//! # A settlement is provisional until the next tick
//!
//! Stabilizing updates the tracked table in the same call that returns the
//! observation, so a caller that **cannot use** a conclusion would otherwise
//! lose it for good: the engine now believes it has announced that state, and a
//! later hint stabilizing to the same state coalesces to nothing. That is not a
//! hypothetical — 2d-3's round-3 review found it as a live defect one layer out,
//! where an application-session rule can refuse an observation the engine had
//! already settled.
//!
//! [`ObservationEngine::revert_settlement`] is the answer, and it is the whole
//! of what this engine knows about the matter: *the caller could not use that
//! conclusion; put the state that stood before it back and observe the path
//! again*. It knows nothing about why — no save, no ledger, no application
//! session enters this module. What it forces is that the state the settlement
//! replaced is kept until the next [`ObservationEngine::tick`]; **what it cannot
//! force** is that a caller reverts before ticking again, because the undo of a
//! pass is discarded when the next pass begins. A caller that ticks first has an
//! observation it cannot take back, and nothing in the type system says so.
//!
//! # An observation can be *owed*, and coalescing does not discharge a debt
//!
//! **This section says what this engine does; what the pipeline as a whole
//! guarantees and expressly does not guarantee is [`crate::watch::liveness`],
//! and every consumer points there rather than paraphrasing either.**
//!
//! Ordinary coalescing answers one question: *has anything changed since I last
//! told you about this path?* A caller that was **never told** cannot use that
//! answer, and a caller that read the path itself and could not use its own
//! reading needs a different one: *what does this path hold now, whatever it
//! held before?*
//!
//! [`ObservationEngine::observe_owed`] records that debt beside the hint. The
//! next settlement of that path discharges it by emitting the stabilized state
//! **even when that state is the one this engine already tracks, and even when
//! it tracks nothing at all** — so an absence emits
//! [`Observation::Removed`] with `previous_revision: None`, and unchanged
//! content emits an [`Observation::Changed`] whose `previous_revision` equals
//! the new revision. Both shapes carry the equality on their face, so a consumer
//! can see that nothing changed rather than being told that something did.
//!
//! Why a debt rather than a hint: a hint asks a question this engine answers
//! against its own tracked state, and that state is not always something the
//! caller has heard. [`ObservationEngine::start`] **establishes** the tracked
//! table without emitting anything — a baseline is a starting point, not an
//! observation — so a path established there and then hinted coalesces to
//! silence for a caller that has been told nothing about it. That is 2d-3's
//! round-6 first High one layer out.
//!
//! A debt survives a [`ObservationEngine::revert_settlement`] of the settlement
//! that discharged it, because a conclusion the caller could not use is a
//! conclusion the caller was not told. **What the types do not force**, beside
//! what they do: a debt is per *path* and carries no identity of who asked, so
//! two requests before one settlement are one debt and one settlement discharges
//! both; and a request for a path this engine does not watch is dropped exactly
//! as a hint is, recording no debt, so a caller whose spelling of a path differs
//! from this engine's root spelling is answered by silence.
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

use std::collections::{BTreeMap, BTreeSet};
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
    /// content. That is one of the **two** cases where `previous_revision` can
    /// equal the new content's revision, and it means *readable again, bytes as
    /// before*.
    ///
    /// The second is an **owed** observation
    /// ([`ObservationEngine::observe_owed`]): a caller that could not use a
    /// reading of its own is answered with what the path stably holds, and when
    /// that is exactly what this engine already tracked the equality is on the
    /// value's face rather than hidden by silence. *Nothing changed* and *I have
    /// never told you anything about this path* are different answers, and only
    /// the first is a reason to say nothing.
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
    ///
    /// **Also what an *owed* observation of a path this engine tracks nothing
    /// for answers** ([`ObservationEngine::observe_owed`]): the caller asked
    /// what the path holds and the stable answer is *nothing*.
    /// `previous_revision` is then `None`, which is the same field saying the
    /// same thing it always says — no content was ever stably read here — and
    /// the value claims no membership change this engine ever announced.
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

impl Observation {
    /// The path this observation is about, whatever its kind.
    ///
    /// One accessor rather than a match at every consumer, because *which path
    /// an observation names* is one rule: a caller that has to take the path
    /// out in order to hand the observation on — to revert its settlement, say
    /// ([`ObservationEngine::revert_settlement`]) — must not be spelling a
    /// second copy of it.
    pub fn path(&self) -> &Path {
        match self {
            Observation::Changed { path, .. }
            | Observation::Removed { path, .. }
            | Observation::Unreadable { path, .. } => path,
            Observation::Added { file, .. } => &file.path,
        }
    } // End of function path()
}

/// The last stably read content of a path, kept through an unreadable
/// interlude so a recovery can still say what it recovered *from*.
///
/// `Clone` for exactly one caller: [`ObservationEngine::settle_failed`] is the
/// one settlement that carries part of the state it replaces *into* the state it
/// installs, so the undo copy cannot be the replaced value itself.
#[derive(Debug, Clone)]
struct LastContent {
    revision: ContentRevision,
    /// `None` when the content was present but not UTF-8.
    snapshot: Option<Box<SourceDocument>>,
}

/// The engine's held state for one tracked path.
///
/// `Clone` for [`LastContent`]'s one reason, and it is used on that one arm
/// only: the other two settlements hand their replaced value to the undo store
/// by **move**, so a rescan that re-hints every tracked path and coalesces
/// clones no snapshot at all.
#[derive(Debug, Clone)]
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
    /// For each path the **most recent** [`ObservationEngine::tick`] emitted an
    /// observation for, the tracked state that settlement replaced — `None`
    /// where nothing was tracked before it.
    ///
    /// The whole of [`ObservationEngine::revert_settlement`]'s memory, and it is
    /// deliberately one pass deep: it is cleared at the top of every tick, so a
    /// settlement becomes final the moment the caller asks for the next pass.
    /// Nothing in the type system enforces that ordering; the module docs' own
    /// *provisional* section states it, and the caller that relies on it calls
    /// its sink for every observation of a pass before it ticks again.
    ///
    /// Only a path that actually produced an observation has an entry: a
    /// coalescing settlement — the same revision again, the same failure kind
    /// again — changes nothing a caller could refuse.
    undo: BTreeMap<PathBuf, Undone>,
    /// Every path an observation is **owed** for — see
    /// [`ObservationEngine::observe_owed`] and the module docs' *owed* section.
    ///
    /// Deliberately **not** cleared by [`ObservationEngine::tick`], unlike
    /// [`ObservationEngine::undo`]: a debt is discharged by the settlement that
    /// answers it and by nothing else, so a path that never stabilizes — one
    /// being written continuously — stays owed rather than quietly losing its
    /// request.
    owed: BTreeSet<PathBuf>,
}

/// One settlement: the observation it produced, and the tracked state it
/// replaced so that [`ObservationEngine::revert_settlement`] can put it back.
///
/// A struct rather than a tuple because the two halves travel to different
/// places — one to the caller, one to [`ObservationEngine::undo`] — and a tuple
/// would make which is which a matter of position.
struct Settled {
    /// What the caller is told.
    observation: Observation,
    /// What the settlement replaced; `None` where nothing was tracked.
    replaced: Option<Tracked>,
}

/// What one pass's settlement of one path can be taken back to.
///
/// The tracked state it replaced **and whether that settlement discharged an
/// owed observation**. The second half is not bookkeeping: a caller that
/// refuses a conclusion has not been told it, so a debt the refused settlement
/// discharged is still owed — and without this field the retry would coalesce
/// against the tracked state and answer the debt with silence, which is the
/// exact shape [`ObservationEngine::observe_owed`] exists to close.
#[derive(Debug)]
struct Undone {
    /// What the settlement replaced; `None` where nothing was tracked.
    replaced: Option<Tracked>,
    /// Whether the settlement discharged a debt.
    owed: bool,
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
    /// **Establishing is not announcing, and that difference has a cost a
    /// caller can pay off.** Nothing here is emitted, so a caller that needs an
    /// answer about one particular path — because it read that path itself and
    /// could not use the reading — cannot get one from a plain
    /// [`ObservationEngine::hint`]: the hint would stabilize to the state this
    /// scan established and coalesce to silence. [`ObservationEngine::observe_owed`]
    /// is the request that says so, and the module docs' *owed* section is why.
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
            undo: BTreeMap::new(),
            owed: BTreeSet::new(),
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

    /// Hints `path` **and records that an observation is owed for it**: the next
    /// settlement of that path emits the stabilized state even when it equals
    /// the state this engine already tracks, and even when it tracks nothing.
    ///
    /// The request a caller makes when it has read the path itself and cannot
    /// use its own reading — the read raised, or it was one read where two are
    /// needed. Such a caller does not want *has anything changed since I last
    /// told you*, which is what a plain [`ObservationEngine::hint`] asks; it
    /// wants *what does this path hold now*. The module docs' *owed* section
    /// carries the argument, and [`ObservationEngine::start`]'s establishing
    /// baseline is the case that makes the two questions come apart.
    ///
    /// **A debt is per path.** Two requests before one settlement are one debt,
    /// and the settlement that answers it discharges it for every caller that
    /// asked. A path this engine does not watch is dropped exactly as
    /// [`ObservationEngine::hint`] drops it, and records no debt — otherwise a
    /// caller spelling a path this engine's roots do not match would leave a
    /// debt no settlement could ever reach.
    ///
    /// **What this does not do**, said beside what it does: it emits nothing
    /// itself, it schedules a read like any hint, it says nothing about *what*
    /// will be observed, and it restarts the debounce of a path already probing
    /// exactly as a hint does. It also promises no answer at all for a path that
    /// never stabilizes: a file written continuously stays pending, and the debt
    /// waits with it.
    ///
    /// This paragraph and the one above it are two of the clauses
    /// [`crate::watch::liveness`] collects, and that module is where a consumer
    /// points instead of paraphrasing them.
    pub fn observe_owed(&mut self, path: &Path, now: Millis) {
        if !self.watches(path) {
            return;
        }
        self.owed.insert(path.to_path_buf());
        self.hint(path, now);
    } // End of function observe_owed()

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
    ///
    /// **Every settlement the previous pass produced becomes final here**, on
    /// the first line: the undo this pass fills is only this pass's, so
    /// [`ObservationEngine::revert_settlement`] can take back a conclusion a
    /// caller has just been handed and nothing older. Nothing in the type system
    /// makes a caller finish with one pass's observations before asking for the
    /// next; the module docs' *provisional* section is where that obligation is
    /// written down.
    pub fn tick(&mut self, now: Millis, source: &mut dyn WatchSource) -> Vec<Observation> {
        self.undo.clear();
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

    /// Takes back the settlement the **most recent** tick made for `path`:
    /// restores the tracked state that settlement replaced, and puts `path` back
    /// into the pipeline as a fresh hint at `now`.
    ///
    /// *The caller could not use that conclusion.* That is all this engine knows
    /// and all it is told — no reason travels with the call, because the reasons
    /// are facts about an application session and this is a fact about a
    /// directory (module docs). The state the caller could not act on is
    /// therefore un-announced as far as the engine is concerned, so the path is
    /// observed **again** rather than coalescing to nothing against a tracked
    /// state that was never really reported.
    ///
    /// **What comes back is a fresh observation of whatever stabilizes during the
    /// retry, and only *if the disk is unchanged* is it the same observation
    /// again.** The retry re-reads: if another process replaced the file with `Q`
    /// in the meantime, the base `B` this call restored is compared against `Q`,
    /// and `Changed { B → Q }` is the correct answer rather than a replay of the
    /// refused `Changed { B → P }`. Round 4 of the 2d-3 review found the earlier
    /// wording of this paragraph promising the replay unconditionally, which the
    /// third bullet below already contradicted.
    ///
    /// # What it does not do, said beside what it does
    ///
    /// - It reverts **one pass**. A path this engine did not settle in the last
    ///   tick — or one whose settlement a later tick has already made final —
    ///   has nothing to restore, and this call is then a plain hint. That is
    ///   deliberate rather than an error case, because the hint is the half that
    ///   is right in both readings; **nothing in the type system distinguishes
    ///   them**, and a caller that ticks before reverting silently gets the
    ///   weaker one;
    /// - it does not undo the *observation*. The value was handed to the caller
    ///   and this engine has no way to recall it; what is undone is the engine's
    ///   own memory of having concluded it;
    /// - it schedules a read, so it emits nothing itself. The observation comes
    ///   back out of a later [`ObservationEngine::tick`], with whatever the file
    ///   holds **then** — which may no longer be the state that was refused, and
    ///   that is the honest answer rather than a replay of a stale reading.
    ///
    /// **A debt is restored with the state.** If the settlement being taken back
    /// discharged an [`ObservationEngine::observe_owed`] request, the path is
    /// owed again: a conclusion the caller could not use is a conclusion the
    /// caller was not told, so the retry must be able to answer the debt rather
    /// than coalescing against a tracked state nobody heard about. Where it
    /// discharged none — an ordinary [`ObservationEngine::hint`]'s settlement —
    /// the `else` arm below re-hints the path and owes nothing.
    ///
    /// That conditional, and the fact that this call schedules rather than
    /// emits, are two of the clauses [`crate::watch::liveness`] collects; a
    /// consumer points there rather than paraphrasing this doc.
    pub fn revert_settlement(&mut self, path: &Path, now: Millis) {
        let owed = match self.undo.remove(path) {
            Some(Undone { replaced, owed }) => {
                match replaced {
                    Some(replaced) => {
                        self.tracked.insert(path.to_path_buf(), replaced);
                    }
                    None => {
                        // Nothing was tracked before the settlement, so
                        // restoring it means removing what the settlement
                        // installed — an `Added` taken back leaves the path
                        // untracked, exactly as it was.
                        self.tracked.remove(path);
                    }
                } // End of the match over what the settlement replaced
                owed
            }
            None => false,
        }; // End of the match over what there was to take back
        if owed {
            self.observe_owed(path, now);
        } else {
            self.hint(path, now);
        }
    } // End of function revert_settlement()

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
    /// tracked table in the same call — and remembering, for exactly one pass,
    /// the state that update replaced.
    ///
    /// The remembering happens **here** rather than in each settlement, so that
    /// *every* emitted observation is revertible by construction: a fourth
    /// settlement kind added below would have to answer [`Settled`] to compile,
    /// and answering it is what files the undo.
    ///
    /// **The debt is taken here too, and for the same reason.** Each settlement
    /// is told whether one is owed rather than asking the engine itself, so a
    /// fourth kind cannot silently ignore one; and the debt is removed before
    /// the settlement runs, so an owed observation that is then refused is
    /// re-owed by [`ObservationEngine::revert_settlement`] rather than by being
    /// left in place here — a debt that outlived its own answer would re-observe
    /// the path forever.
    ///
    /// **A debt is spent only by a settlement that emitted**, and that is
    /// enforced here rather than by the three settlements agreeing to it: one
    /// that answers `None` while a debt was owed puts the debt back. All three
    /// below emit whenever one is owed, so the arm is unreachable today — but
    /// *removed above, honoured below* is a check and a spend in two places, and
    /// this crate has shipped that shape before.
    fn settle(&mut self, path: &Path, outcome: ReadOutcome) -> Option<Observation> {
        let owed = self.owed.remove(path);
        let settled = match outcome {
            ReadOutcome::Present(bytes) => self.settle_present(path, bytes, owed),
            ReadOutcome::Missing => self.settle_missing(path, owed),
            ReadOutcome::Failed(kind) => self.settle_failed(path, kind, owed),
        };
        let Some(settled) = settled else {
            if owed {
                // **A debt is spent only by the settlement that answers it.**
                // Unreachable with the three settlements below — each of them
                // emits whenever one is owed — and written rather than hoped
                // away, because *removed above, honoured below* is a check and a
                // spend in two places: a fourth settlement kind that coalesced
                // despite a debt would consume the request and answer it with
                // silence, which is the whole defect this mechanism exists to
                // close.
                self.owed.insert(path.to_path_buf());
            }
            return None;
        };
        self.undo.insert(
            path.to_path_buf(),
            Undone {
                replaced: settled.replaced,
                owed,
            },
        );
        Some(settled.observation)
    } // End of function settle()

    /// A path stably holds `bytes`.
    fn settle_present(&mut self, path: &Path, bytes: Vec<u8>, owed: bool) -> Option<Settled> {
        let revision = ContentRevision::of_bytes(&bytes);
        // Coalesce against the tracked *content* state: a byte-identical
        // rewrite is not a content observation. An unreadable state never
        // coalesces here — recovering is a difference even at equal bytes — and
        // an **owed** observation never coalesces either, because the caller
        // that asked for it has not been told what this engine tracks.
        if !owed {
            match self.tracked.get(path) {
                Some(Tracked::Projected { snapshot }) if snapshot.revision == revision => {
                    return None
                }
                Some(Tracked::NotUtf8 { revision: held }) if *held == revision => return None,
                _ => {}
            }
        }
        let content = self.project_bytes(path, bytes);
        // Removed, read by reference, and then handed to the undo store by
        // **move**: everything the observation needs from the replaced state is
        // borrowed, so this settlement clones nothing.
        let replaced = self.tracked.remove(path);
        let observation = match replaced.as_ref() {
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
        Some(Settled {
            observation,
            replaced,
        })
    } // End of function settle_present()

    /// A path is stably absent.
    ///
    /// **An owed observation of a path nothing was tracked for still emits**,
    /// with `previous_revision: None`: the caller asked what the path holds and
    /// the stable answer is *nothing*. Without a debt this settlement is silent
    /// there, which is correct — a path this engine never announced and that
    /// holds nothing is not a removal anybody was told about.
    fn settle_missing(&mut self, path: &Path, owed: bool) -> Option<Settled> {
        let replaced = self.tracked.remove(path);
        if replaced.is_none() && !owed {
            return None;
        }
        Some(Settled {
            observation: Observation::Removed {
                path: path.to_path_buf(),
                previous_revision: replaced.as_ref().and_then(Tracked::revision),
            },
            replaced,
        })
    } // End of function settle_missing()

    /// A path stably fails to read with `kind`.
    fn settle_failed(&mut self, path: &Path, kind: io::ErrorKind, owed: bool) -> Option<Settled> {
        let prior = self.tracked.remove(path);
        let coalesce = !owed
            && matches!(&prior, Some(Tracked::Unreadable { kind: held, .. }) if *held == kind);
        // **The one settlement that clones**, and only on the arm that emits.
        // It carries part of the state it replaces (`before`) into the state it
        // installs, so unlike the other two it cannot hand the replaced value
        // itself to the undo store. A repeat of the same failure kind coalesces
        // and clones nothing.
        let replaced = if coalesce { None } else { prior.clone() };
        let before = match prior {
            Some(Tracked::Unreadable { before, .. }) => before,
            Some(Tracked::Projected { snapshot }) => Some(LastContent {
                revision: snapshot.revision,
                snapshot: Some(snapshot),
            }),
            Some(Tracked::NotUtf8 { revision }) => Some(LastContent {
                revision,
                snapshot: None,
            }),
            None => None,
        };
        self.tracked
            .insert(path.to_path_buf(), Tracked::Unreadable { kind, before });
        if coalesce {
            return None;
        }
        Some(Settled {
            observation: Observation::Unreadable {
                path: path.to_path_buf(),
                kind,
            },
            replaced,
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

    #[test]
    fn a_reverted_settlement_is_observed_again_instead_of_coalescing_away() {
        // 2d-3's round-3 High, as the engine-side half of it. A settlement
        // updates the tracked table in the same call that returns the
        // observation, so a caller that cannot use the conclusion would lose
        // the state for good: the identical bytes re-read a moment later
        // coalesce against the tracked state the refused settlement installed.
        // `revert_settlement` is what makes that recoverable, and the second
        // drain below is the whole assertion — without the revert it is empty.
        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let path = root.join("match/base.yml");
        let before = "matches: []\n";
        let after = "matches:\n  - trigger: ':x'\n    replace: y\n";
        std::fs::write(&path, before).expect("the tracked file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(before.as_bytes()))
        );

        std::fs::write(&path, after).expect("an external replacement");
        engine.hint(&path, Millis(0));
        let first = drain_real(&mut engine, &mut source);
        assert_eq!(first.len(), 1, "one observation: {first:?}");
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(after.as_bytes())),
            "the settlement installed the new state, which is what makes it losable"
        );

        // The caller could not use it. The engine forgets having concluded it
        // and puts the path back in the pipeline.
        engine.revert_settlement(&path, Millis(1000));
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(before.as_bytes())),
            "the state the settlement replaced is back"
        );
        assert!(
            engine.next_deadline().is_some(),
            "and the path is pending again rather than merely rolled back"
        );

        // The file still holds the same bytes, and they are observed again
        // rather than coalescing into the tracked state of a refused reading.
        let second = drain_real(&mut engine, &mut source);
        assert_eq!(
            second.len(),
            1,
            "the refused state is observed again: {second:?}"
        );
        match &second[0] {
            Observation::Changed {
                previous_revision,
                content,
                ..
            } => {
                assert_eq!(
                    *previous_revision,
                    Some(ContentRevision::of_bytes(before.as_bytes())),
                    "and it is the same observation, from the same base"
                );
                assert_eq!(
                    content.revision(),
                    ContentRevision::of_bytes(after.as_bytes())
                );
            }
            other => panic!("expected the same `Changed` again, got {other:?}"),
        } // End of the match over the re-observed conclusion
          // One more pass — nothing is due, so it observes nothing — makes that
          // second settlement final. A revert then has nothing left to take back
          // and is a plain hint, which stabilizes to what the engine already
          // tracks and observes nothing. **This is the half no type enforces**:
          // the same call means two different things either side of a tick.
        assert!(engine.tick(Millis(1500), &mut source).is_empty());
        engine.revert_settlement(&path, Millis(2000));
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(after.as_bytes())),
            "nothing was restored, because that settlement is final"
        );
        assert!(drain_real(&mut engine, &mut source).is_empty());
    } // End of function a_reverted_settlement_is_observed_again_instead_of_coalescing_away()

    #[test]
    fn an_owed_observation_is_answered_where_a_hint_coalesces_to_silence() {
        // 2d-3's **round-6 first High**, as the engine-side half of it. A
        // baseline *establishes* the tracked table without emitting anything, so
        // a caller that has been told nothing about a path gets silence from an
        // ordinary hint — whether the path holds what the baseline established
        // or holds nothing at all. Each half below drives the hint first, to
        // show the silence, and then the debt.
        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let established = root.join("match/base.yml");
        let gone = root.join("match/gone.yml");
        let bytes = "matches: []\n";
        std::fs::write(&established, bytes).expect("the file the baseline sees");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");
        assert_eq!(
            engine.revision_of(&established),
            Some(ContentRevision::of_bytes(bytes.as_bytes())),
            "the premise: the baseline established this state and announced nothing"
        );

        // 1. A path that holds what the baseline established. The hint
        //    coalesces; the debt is answered, and the answer carries the
        //    equality on its face.
        engine.hint(&established, Millis(0));
        assert!(
            drain_real(&mut engine, &mut source).is_empty(),
            "an ordinary hint at an unchanged established state observes nothing"
        );
        engine.observe_owed(&established, Millis(1000));
        let owed = drain_real(&mut engine, &mut source);
        assert_eq!(owed.len(), 1, "the debt is answered: {owed:?}");
        match &owed[0] {
            Observation::Changed {
                path,
                previous_revision,
                content,
                ..
            } => {
                assert_eq!(path, &established);
                assert_eq!(
                    *previous_revision,
                    Some(ContentRevision::of_bytes(bytes.as_bytes()))
                );
                assert_eq!(
                    content.revision(),
                    ContentRevision::of_bytes(bytes.as_bytes()),
                    "and `previous_revision == content.revision()` says nothing changed"
                );
            }
            other => panic!("expected a `Changed` carrying the equality, got {other:?}"),
        } // End of the match over the answered debt

        // 2. A path nothing was ever tracked for, holding nothing. The hint is
        //    silent because there is no removal anybody was told about; the debt
        //    is answered with `Removed { previous_revision: None }`.
        engine.hint(&gone, Millis(2000));
        assert!(
            drain_real(&mut engine, &mut source).is_empty(),
            "an ordinary hint at an untracked absence observes nothing"
        );
        engine.observe_owed(&gone, Millis(3000));
        let owed = drain_real(&mut engine, &mut source);
        assert_eq!(owed.len(), 1, "the debt is answered: {owed:?}");
        assert!(
            matches!(
                &owed[0],
                Observation::Removed {
                    path,
                    previous_revision: None
                } if path == &gone
            ),
            "an owed absence is a removal with no previous revision: {owed:?}"
        );

        // 3. A debt is discharged once. The same path asked nothing further
        //    answers nothing further.
        engine.hint(&gone, Millis(4000));
        assert!(drain_real(&mut engine, &mut source).is_empty());

        // 4. A refused settlement leaves the debt owed, because a conclusion the
        //    caller could not use is a conclusion it was not told. Without the
        //    restore, the retry coalesces and the debt is answered by silence —
        //    which is the defect this whole mechanism exists to close, reached
        //    one layer down.
        engine.observe_owed(&established, Millis(5000));
        let refused = drain_real(&mut engine, &mut source);
        assert_eq!(refused.len(), 1, "the debt is answered: {refused:?}");
        engine.revert_settlement(&established, Millis(6000));
        let again = drain_real(&mut engine, &mut source);
        assert_eq!(
            again.len(),
            1,
            "and a refused owed observation is still owed: {again:?}"
        );
        assert!(matches!(&again[0], Observation::Changed { path, .. } if path == &established));

        // 5. A path this engine does not watch records no debt, so nothing is
        //    left owed for a settlement that can never come.
        let outside = dir.path().join("outside.yml");
        engine.observe_owed(&outside, Millis(7000));
        assert!(
            engine.next_deadline().is_none(),
            "an unwatched path is dropped exactly as a hint is"
        );
    } // End of function an_owed_observation_is_answered_where_a_hint_coalesces_to_silence()

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
