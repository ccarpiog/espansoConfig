//! The app-write ledger and the observation admission gate — Phase 2d-3.
//!
//! `espansoconfig_core::watch` owns what a filesystem observation *means* and
//! `crate::watch` owns the lifetime of the worker that produces one. This
//! module owns the third thing, and it is a fact about **this application
//! session** rather than about a directory: *which of the bytes now on disk are
//! bytes this application itself committed a moment ago* (the 2d design
//! consult's Q2, and Q7 item 3).
//!
//! # The record, and the one sentence it licenses
//!
//! [`WriteLedger`] holds one [`AppWrite`] per document — `{ workspace_epoch,
//! revision }`, keyed by [`DocumentId`] exactly as the consult specifies — and
//! [`WriteLedger::record_app_write`] is its only producer. `crate::commands`'s
//! `commit_and_record` — the one window `run_one_save` runs its transaction
//! in — calls it for `Ok(SavedDocument { committed: true, .. })` and for
//! nothing else. The predicate it feeds is the core's one definition,
//! [`espansoconfig_core::watch::self_write_suppresses`], and the truthful
//! sentence is the consult's, verbatim:
//!
//! > **This application ignores a filesystem hint when the bytes now on disk
//! > hash to the latest revision it recorded after committing that file; this
//! > proves the text is identical, not who wrote it.**
//!
//! An external process rewriting byte-identical content is indistinguishable by
//! this predicate, and ignoring it is acceptable because the file text — the
//! source of truth — did not change. **Nothing built on this module may claim
//! that the ignored event "was ours", that no external write occurred, or that
//! metadata stayed unchanged**, and hash equality proves byte identity only
//! subject to the hash's collision limit.
//!
//! # The commit gate: a commit and its record are one window
//!
//! A record taken *after* the rename it describes is a record with a hole in
//! it. `espansoconfig_core::persist::save_document` performs the rename before
//! it returns, and the watcher's worker thread enters [`WriteLedger::admit`]
//! under no session lock at all — so with the state mutex alone, a save could
//! rename to revision A, be descheduled, and have its own bytes admitted as an
//! **external** change before it ever recorded A. Suppression would already
//! have failed, and the mirror interleaving would leave a stale A record behind
//! an external admission. That was this step's round-1 High.
//!
//! [`WriteLedger`] therefore holds a second mutex, the **commit gate**, and it
//! is not the state mutex:
//!
//! - `crate::commands`'s `commit_and_record` takes it with
//!   [`WriteLedger::begin_commit`] **before** calling `save_document` and holds
//!   it until **after** [`WriteLedger::record_app_write`] — or after the
//!   exhaustive `committed_revision` decided there was nothing to record, since
//!   the guard is an RAII value dropped by the block's end and not a call some
//!   arm can miss;
//! - [`WriteLedger::admit`], [`WriteLedger::admit_at_current_epoch`] and
//!   [`WriteLedger::begin_epoch`] take it briefly before touching the state.
//!
//! The lock order is therefore always **session → gate → state**, never the
//! reverse: the worker takes gate → state with no session lock at any point,
//! and the two callers that hold the session lock (a save, and
//! `WorkspaceSession::open`) take the gate below it. It is deadlock-free
//! against all four shapes 2d-2 left live — `WorkspaceSession::open`'s
//! cancel-and-join, [`crate::watch::WatcherLifecycle`]'s same-thread `Drop`
//! routed to the reaper, a save in flight under the session lock, and a
//! downstream sink re-entering the session — and the argument is one sentence:
//! **nothing that holds a ledger lock ever waits for the session lock.** Not
//! `record_app_write`, not either `admit`, not `begin_epoch`, and not
//! `save_document`, which is the one thing that runs under the gate. So a
//! thread waiting for a ledger lock is waiting for a holder that will get there
//! on its own, whatever else the waiter is holding.
//! `record_app_write` takes a `&`[`CommitGate`], so *a record
//! is taken inside a commit window* is a property of the signature. **What the
//! type does not force**, in the same sentence as what it does: that the gate
//! belongs to *this* ledger, and that it was taken before `save_document`
//! rather than after it. Both are kept by `commit_and_record` being one
//! function with one caller, and by this paragraph.
//!
//! **No caller-supplied code runs while either lock is held.** Under the state
//! mutex there is no closure and no callback, and the only call that leaves this
//! module is [`Instant::now`], taken by [`WriteLedger::record_app_write`] on the
//! line that inserts a record — a clock read that takes no lock of this
//! process's, can block on nothing a caller controls, and is named here rather
//! than covered by an *"and no I/O at all"* that stopped being exactly true when
//! the stamp arrived. Under the gate
//! there is exactly one thing, `save_document`, whose [`SaveRequest`]
//! carries no closure and which cannot reach this module: it writes through
//! `crate::persist`'s own per-path registry, which excludes only this process's
//! cooperating callers, so the window the gate holds is one save's own I/O and
//! never an unbounded wait on another process.
//!
//! [`SaveRequest`]: espansoconfig_core::persist::SaveRequest
//!
//! # The stamp: a gate cannot reach a read that already happened
//!
//! The commit gate makes a commit and its record one window **no decision can
//! cross**. It cannot make them one window no *read* can cross, because an
//! observation's reads happen in the engine, one debounce plus one probe before
//! the gate ever sees it. That gap was this step's round-2 High: disk holds P,
//! the engine completes both stabilizing reads and constructs the observation,
//! a save then takes the gate, commits A, records A and releases — and P, which
//! has been parked at the gate all along, decides that P is not A, **clears A's
//! record** and publishes P. The save's own hints of A then find no record and
//! are admitted as **foreign**: this application reporting its own committed
//! write as somebody else's, which the consult's Q8 calls the sharpest failure
//! mode there is.
//!
//! Every observation therefore carries [`crate::watch::EpochObservation`]'s
//! `read_after`: an [`Instant`] taken **before** the reads that produced it,
//! and [`WriteLedger::record_app_write`] takes one **after** the rename
//! `save_document` performed. Comparing the two is the whole rule. **The
//! accepted condition is the strict one — `read_after > recorded_at` — and
//! equality is refused**, which was this step's round-3 second High: `Instant`
//! is documented monotonic and *not* documented strictly increasing, so two
//! ordered calls may answer the same value and equality orders nothing.
//!
//! The implication the accepted condition carries, in one direction only, and
//! in two steps because the two steps are about different things:
//!
//! > **On the values:** `read_after > recorded_at`.
//! >
//! > **On real time:** a monotonic, nondecreasing clock cannot answer a
//! > *strictly greater* value to a call made earlier, so the `Instant::now()`
//! > that produced `read_after` was made at or after the one that produced
//! > `recorded_at`. With the stamp taken before its reads and the record taken
//! > after its rename, that gives `read >= stamp >= record >= rename`: the read
//! > observed the disk at or after the commit landed, so what it read is a state
//! > that commit did not undo.
//!
//! Neither step needs a filesystem chronology or an inference from hashes: the
//! two events being ordered are **this session's own**, one read it performed
//! and one write it performed. At equality the second step collapses — the read
//! may have preceded the rename — which is why equality is on the refusing side
//! of the comparison and not on the accepting one.
//!
//! An observation that cannot make that claim is [`Admission::PrecedesACommit`]
//! and is **discarded**, mutating nothing but the tally — exactly like
//! [`Admission::StaleEpoch`], and for the same kind of reason: a reading this
//! session cannot place after its own last write to that path may not decide
//! anything about that path. It may not publish, because the bytes it describes
//! are bytes this application has since replaced; and it may not clear the
//! record, because that record describes a write made **after** this reading was
//! taken, and clearing it is what makes the save's own hints foreign. Neither
//! sentence claims the record describes what is on disk *now* — an external
//! writer may have replaced those bytes too, and the observation that says so
//! will be a later reading with a later stamp.
//!
//! **The converse is deliberately not claimed**: `read_after <= recorded_at`
//! does *not* prove the read preceded the rename, only that this session cannot
//! prove it did not. The stamp is a lower bound on the read, so the check
//! over-refuses across the window between the stamp and the read — microseconds,
//! bounded by one [`crate::watch::EpochObservation`]-producing engine pass.
//!
//! **Over-refusal is not a safe direction by itself, and saying it was is what
//! this step's round-3 first High corrected.** A refused observation is not
//! merely delayed: `espansoconfig_core::watch::engine::ObservationEngine::tick`
//! has already installed the state it describes as the engine's tracked one, so
//! the same bytes re-read afterwards stabilize to the tracked state and coalesce
//! **inside the engine**, emitting nothing. Re-hinting the path therefore does
//! not "produce a fresh observation" of a state the engine believes it has
//! already announced, and a genuine external change refused once would never be
//! reported again — with native delivery working perfectly. What makes the
//! direction safe is that the refusal is **answered**:
//! [`admitting_sink`] returns [`crate::watch::ObservationOutcome::Undecided`]
//! for this arm and `crate::watch::deliver` takes the engine's settlement back
//! (`revert_settlement`), so the path is un-concluded and re-hinted and the next
//! stabilization carries a stamp later than the record. What that recovery still
//! depends on is one *engine pass*, not native delivery — the revert schedules
//! its own hint — and what it does depend on is stated as a hole rather than
//! smoothed over (`docs/decisions/2d-3-notes.md` §5 items 13 and 14).
//!
//! The one path where a refusal is **not** answered that way is
//! [`WriteLedger::admit_at_current_epoch`], whose two callers settle nothing in
//! any engine and so have nothing to take back; see that method for what a
//! refusal costs there.
//!
//! **What the types do not force, in the same sentence as what they do.** The
//! parameter is an `Instant` and every `Instant` type-checks: nothing makes a
//! caller take it before its read rather than after, and a stamp taken after the
//! read silently restores the defect. `crate::watch::WatchWorker::observe` is
//! one function taking the stamp and running the engine pass, and the two save
//! path callers take theirs on the line above their `Workspace::refresh` — that,
//! and this paragraph, are what keep it.
//!
//! # The gate is a leaf, and that is load-bearing
//!
//! [`admitting_sink`] wraps the downstream sink: it takes one decision under
//! this module's mutexes, **drops both guards**, and only then calls the sink
//! it wraps. They therefore run no caller-supplied code, exactly as
//! `crate::watch::WorkspaceEpochs`'s does, so they cannot participate in a lock
//! cycle — and the worker thread that calls the gate never touches the session
//! mutex at all. A downstream sink is free to call back into the session *and*
//! into this ledger; `the_downstream_sink_runs_outside_the_ledger_lock` is that
//! as a bounded test rather than as a claim.
//!
//! # What this module is not, yet
//!
//! **No wire.** An [`Admission::Admitted`] carries a sequence and reaches a
//! downstream sink, and in production that sink is [`discarding_sink`]:
//! observations are admitted and dropped, because the queue, the wake event and
//! `drain_external_changes` are Phase 2d-4's (consult Q3). A value this sink
//! drops is gone, and no present code recovers it — whatever recovery 2d-4
//! offers is 2d-4's to build and to claim. The sequence a publication spends is
//! therefore not yet a number any consumer has seen; what it *does* today is
//! make the next hint at the same state a duplicate.

use std::collections::BTreeMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Instant;

use espansoconfig_core::watch::engine::Observation;
use espansoconfig_core::watch::self_write_suppresses;
use espansoconfig_core::{ContentRevision, DocumentId};

use crate::watch::{EpochObservation, ObservationOutcome, ObservationSink, NO_EPOCH};

/// The first sequence an epoch numbers its admitted observations from.
///
/// One rather than zero, so a zero read anywhere downstream can only mean
/// *unset* — the same convention [`crate::watch::FIRST_WORKSPACE_EPOCH`]
/// follows, and for the same reason.
pub const FIRST_OBSERVATION_SEQUENCE: u64 = 1;

/// The stabilized state one observation asserts about one path.
///
/// Three states rather than an `Option<ContentRevision>`, because absence and
/// unreadability are states the engine reports and coalesces on, not missing
/// content: a removal that repeats is a duplicate of the removal, and a
/// recreation after one is a **second** observation even at identical bytes
/// (consult Q3). Comparing this value is the whole of the coalescing rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObservedState {
    /// The path stably holds bytes hashing to this revision.
    Content(ContentRevision),
    /// The path is stably gone.
    Absent,
    /// The path stably fails to read, with this failure kind read twice.
    Unreadable(io::ErrorKind),
}

/// What one observation asserts about its path — see [`ObservedState`].
pub fn observed_state(observation: &Observation) -> ObservedState {
    match observation {
        Observation::Changed { content, .. } | Observation::Added { content, .. } => {
            ObservedState::Content(content.revision())
        }
        Observation::Removed { .. } => ObservedState::Absent,
        Observation::Unreadable { kind, .. } => ObservedState::Unreadable(*kind),
    }
} // End of function observed_state()

/// The path one observation is about, whatever its kind.
///
/// A delegation to [`Observation::path`] since the round-3 fix round, not a
/// second implementation: `crate::watch::deliver` needs the same answer to take
/// a refused settlement back, and *which path an observation names* is one rule
/// wherever it is asked.
pub fn observed_path(observation: &Observation) -> &Path {
    observation.path()
}

/// What the ledger decided about one observation.
///
/// Returned rather than acted on, because the ledger's mutex must never run
/// caller code: [`admitting_sink`] takes this answer, drops the guard, and only
/// then calls the sink it wraps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Admission {
    /// Discarded: the observation carries a workspace epoch this session has
    /// already replaced, so nothing about it may name a document — the fence
    /// `docs/decisions/2d-2-notes.md` §5 item 5 left without a reader.
    StaleEpoch,
    /// Discarded: this observation's reads cannot be placed at or after the
    /// latest write this application committed to that path, so it may not be
    /// taken as a statement about what the file holds now.
    ///
    /// The round-2 High, and the residue the commit gate alone could not
    /// reach — see this module's *stamp* section for the implication it turns
    /// on and for the direction it deliberately over-refuses in. Like
    /// [`Admission::StaleEpoch`] it mutates nothing but the tally: it publishes
    /// nothing, and it **retains** any app-write record for the path, because
    /// that record describes a write made after this reading was taken, and
    /// clearing it is what makes that write's own hints foreign. Neither half
    /// claims the record describes what the file holds *now* — see the *stamp*
    /// section for what is and is not claimed.
    ///
    /// **It is the one arm a producer must answer**, and the round-3 fix round
    /// is why: it says *this reading decided nothing*, so the state it described
    /// is still unreported while the engine that produced it has already
    /// recorded that state as tracked. [`admitting_sink`] therefore maps this
    /// arm — and only this arm — to
    /// [`crate::watch::ObservationOutcome::Undecided`], which takes the
    /// settlement back. **A refusal whose answer re-reading cannot change must
    /// not join it**: reverting one of those would re-observe the same path
    /// forever.
    PrecedesACommit,
    /// Suppressed: the bytes hash to the latest revision this application
    /// recorded after committing that file. **Byte identity, never
    /// authorship** — see this module's own documentation for the exact
    /// sentence this licenses and the three it forbids. The record is retained,
    /// so the several native hints one atomic replacement generates are all
    /// suppressed by the same entry. It is one of the **two** decisions that
    /// retain one — [`Admission::PrecedesACommit`] is the other, and it was
    /// added by the round-2 fix round — and the only one of those two that
    /// makes a claim about the bytes: see [`decide`].
    SelfWrite,
    /// Coalesced: this path's published state is already exactly this state, so
    /// a consumer that acted on the earlier one has nothing new to act on.
    ///
    /// Any app-write record for that path is **cleared** on the way here, like
    /// every arm below the two retaining checks — reaching this one at all
    /// means the reads are placed after this application's last commit at that
    /// path and the bytes are not the ones it committed there.
    Duplicate,
    /// Refused: this epoch has spent every sequence `u64` can carry. Terminal
    /// until the next workspace open, because an observation that cannot be
    /// given a distinct sequence must not be published — the same policy
    /// `crate::watch::EpochSpaceExhausted` takes for epochs, and unreachable in
    /// any physical execution for the same reason.
    SequenceSpaceExhausted,
    /// Admitted, and numbered.
    Admitted {
        /// This observation's sequence: unique and strictly increasing within
        /// its workspace epoch, and meaningless across epochs.
        sequence: u64,
    },
}

/// One document's latest committed app write — the consult's
/// `last_app_write[DocumentId] = { workspace_epoch, revision }`.
///
/// **Exactly the consult's two fields and no third one.** The instant at which
/// the record was taken is a fact about this session's chronology rather than
/// about the write, so it lives beside this value in [`RecordedWrite`], where
/// the state guard makes the pair impossible to observe apart.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppWrite {
    /// The workspace epoch this save committed under.
    ///
    /// Redundant with [`WriteLedger::begin_epoch`]'s discard **today**, and
    /// stored and checked anyway: the entry's own claim is *committed under
    /// this epoch*, and the two statements of that rule — the discard and the
    /// tag — are checked separately so a future path that discards late cannot
    /// silently start suppressing across a workspace replacement. Nothing in
    /// the type system ties them together.
    pub epoch: u64,
    /// The revision the transaction read back from disk after its rename.
    pub revision: ContentRevision,
}

/// One [`AppWrite`] and the instant this session took it.
///
/// Private, and one struct rather than two maps, so that a record and the
/// chronology stamp that decides which observations may act on it cannot be
/// observed apart or updated apart — the same reason `documents_by_path` is
/// written in the same two statements as `writes` (§2.2 of the record).
#[derive(Debug, Clone, Copy)]
struct RecordedWrite {
    /// The consult's record.
    write: AppWrite,
    /// When [`WriteLedger::record_app_write`] took it, which is **after** the
    /// rename `espansoconfig_core::persist::save_document` performed — the
    /// transaction had already returned. That inequality is the load-bearing
    /// half: an observation whose `read_after` is at or after this instant read
    /// the disk at or after the rename landed, so what it read is a state the
    /// rename did not undo. Taking this stamp anywhere earlier — at the gate
    /// acquisition, say — would break the implication in the direction that
    /// silently restores the round-2 High, and nothing in the type system
    /// prevents that: this field is private and has one writer.
    recorded_at: Instant,
}

/// Every decision this ledger has taken, counted for the life of the session.
///
/// **Cumulative and never reset**, unlike the maps and the sequence allocator,
/// which a workspace replacement discards. It exists because four of these
/// decisions are otherwise indistinguishable from silence: a suppressed
/// observation, a coalesced one, one discarded for a replaced epoch and one
/// discarded as older than a commit all look exactly like a watcher that noticed
/// nothing (`PROGRESS.md` R24).
///
/// **It counts five of the six decisions, and the sixth is deliberately
/// absent.** [`Admission::SequenceSpaceExhausted`] is unreachable in any
/// physical execution and is directly observable through
/// [`WriteLedger::admit`]'s own answer, which the boundary test drives, so a
/// counter for it would be surface with no reader. Anyone adding a seventh
/// decision should ask the same two questions rather than assume this struct
/// is exhaustive — the round-2 fix round added
/// [`LedgerTally::preceded_a_commit`] by asking them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct LedgerTally {
    /// Observations admitted and numbered.
    pub admitted: u64,
    /// Observations suppressed as this application's own committed bytes.
    pub suppressed: u64,
    /// Observations coalesced into the state already published for their path.
    pub coalesced: u64,
    /// Observations discarded for carrying a replaced workspace epoch.
    pub stale_epoch: u64,
    /// Observations discarded because their reads could not be placed at or
    /// after this application's latest committed write to their path — see
    /// [`Admission::PrecedesACommit`].
    ///
    /// **On a healthy production path this stays zero**, and that is worth
    /// knowing rather than assuming: the engine's debounce puts at least one
    /// debounce plus one probe (240 ms at the default timing) between a save's
    /// own hint and the pass that settles it, while the record follows the
    /// rename by one read-back. A non-zero count means an observation was
    /// genuinely in flight across a commit — or that some caller's stamp is
    /// taken in the wrong place.
    ///
    /// It counts **refusals, never losses**: every refusal of a watcher
    /// observation is answered by taking the engine's settlement back, so the
    /// path is re-observed (see [`Admission::PrecedesACommit`]). A count that
    /// climbs steadily for one path is therefore a pipeline re-running, not a
    /// change disappearing.
    pub preceded_a_commit: u64,
}

/// The per-document app-write record, the published-state map and the
/// per-epoch sequence allocator, behind two leaf mutexes.
///
/// **Beside the open session, never in core global state and never in the
/// frontend** (consult Q2). It outlives any one workspace — the sink that reads
/// it is the session's, shared across replacements — which is why the discard
/// on replacement is an explicit call ([`WriteLedger::begin_epoch`]) rather
/// than a value going out of scope.
///
/// The two mutexes are deliberately separate and are always taken **gate
/// first**; see this module's *commit gate* section for the whole order and its
/// deadlock argument.
#[derive(Debug)]
pub struct WriteLedger {
    /// The commit gate — held across one whole save transaction and its record,
    /// and taken briefly by every decision, so that no admission can observe
    /// the instant between a rename and the record that describes it.
    ///
    /// It guards **no data**: what it carries is the right to be the only
    /// thread inside a commit-or-decide window. `()` rather than a field of
    /// [`LedgerState`] because a decision needs the state guard *inside* this
    /// window, and one mutex cannot be taken twice.
    gate: Mutex<()>,
    /// How many threads are between the gate's waiter count and their
    /// acquisition of it — a **test-only** observability seam, and the whole
    /// reason the concurrency tests are deterministic rather than timed.
    ///
    /// A test that holds the gate can wait *positively* until this reads one,
    /// which proves an admission is parked at the gate and therefore has not
    /// decided; a build with the gate acquisition removed never moves it, so
    /// that wait times out instead of racing. Incremented and decremented only
    /// by [`WriteLedger::enter_gate`], so removing the acquisition removes the
    /// counter with it.
    #[cfg(test)]
    gate_waiters: std::sync::atomic::AtomicUsize,
    state: Mutex<LedgerState>,
}

/// One held commit gate: the right to run a commit and its record as one
/// window no admission can cross.
///
/// Produced only by [`WriteLedger::begin_commit`] and required by
/// [`WriteLedger::record_app_write`], so *a record is taken inside a commit
/// window* is a property of the signature. **What the type cannot force**, said
/// beside what it does: that this gate is the same ledger's, and that it was
/// taken before the transaction rather than after it.
///
/// Released by dropping — deliberately, so that an early return or a panic
/// between the transaction and the record cannot strand it.
#[derive(Debug)]
pub struct CommitGate<'a> {
    /// The guard whose lifetime *is* the window; nothing reads it.
    _held: MutexGuard<'a, ()>,
}

/// Everything [`WriteLedger`] holds, and the mutex holds all of it at once.
#[derive(Debug)]
struct LedgerState {
    /// The workspace epoch this session is currently observing under.
    /// [`NO_EPOCH`] before the first open, and after an open whose epoch space
    /// was exhausted.
    epoch: u64,
    /// The consult's `last_app_write`, keyed exactly as it specifies, each
    /// entry paired with the instant it was taken ([`RecordedWrite`]).
    writes: BTreeMap<DocumentId, RecordedWrite>,
    /// The path each recorded write is at, because an observation names a path
    /// and never an identity.
    ///
    /// Not a second source of truth: it is written and erased in the same two
    /// statements as `writes`, and the identity table a `DocumentId` comes from
    /// is itself keyed by path for the life of the process
    /// (`docs/decisions/2d-1-notes.md` D7), so the two directions cannot
    /// disagree about which document a path is. What is **not** forced is that
    /// the workspace's spelling of a path and the watcher's are the same
    /// string; that agreement is `crate::watch::HintSpelling`'s and discovery's,
    /// and 2d-1 §5 item 3's residue is inherited here unchanged.
    documents_by_path: BTreeMap<PathBuf, DocumentId>,
    /// The last state published for each path, which is the whole of the
    /// coalescing rule.
    published: BTreeMap<PathBuf, ObservedState>,
    /// The next sequence to hand out; `None` once this epoch's space is spent.
    next_sequence: Option<u64>,
    /// See [`LedgerTally`].
    tally: LedgerTally,
}

impl WriteLedger {
    /// A ledger with nothing recorded and no workspace epoch yet.
    pub fn new() -> WriteLedger {
        WriteLedger {
            gate: Mutex::new(()),
            #[cfg(test)]
            gate_waiters: std::sync::atomic::AtomicUsize::new(0),
            state: Mutex::new(LedgerState {
                epoch: NO_EPOCH,
                writes: BTreeMap::new(),
                documents_by_path: BTreeMap::new(),
                published: BTreeMap::new(),
                next_sequence: Some(FIRST_OBSERVATION_SEQUENCE),
                tally: LedgerTally::default(),
            }),
        }
    } // End of function new()

    /// Opens one commit window: the caller may run its transaction and take its
    /// record with no admission deciding in between.
    ///
    /// **The gate is held across `espansoconfig_core::persist::save_document`**
    /// — that is the whole point, because the rename happens inside it — and
    /// released by dropping the returned value. See this module's *commit gate*
    /// section for the lock order, the deadlock argument and the one thing that
    /// is allowed to run under it.
    pub fn begin_commit(&self) -> CommitGate<'_> {
        CommitGate {
            _held: self.enter_gate(),
        }
    }

    /// Adopts `epoch` and **discards everything the previous workspace
    /// recorded** — the app writes, their path index, the published states and
    /// the sequence allocator.
    ///
    /// Consult Q2's *discard the whole map on workspace replacement*, and the
    /// reason is not tidiness: a document identity survives a replacement (the
    /// process-wide table is keyed by path), so an entry kept across one could
    /// suppress an observation of a different directory's file that happens to
    /// hash the same. Called from `WorkspaceSession::open` **before** the
    /// successor watcher starts, so the first observation of a new epoch can
    /// never be discarded as stale by an epoch the ledger had not yet adopted.
    ///
    /// Takes the commit gate first, like every other mutation and every
    /// decision, so that a replacement can never land inside a commit window.
    /// It is already serialized against [`WriteLedger::record_app_write`] by
    /// the session lock both callers hold — the gate is the second statement of
    /// that rule, not a substitute for it, and it costs nothing because the one
    /// thread that could hold the gate for any length of time is a save, which
    /// holds the session lock too.
    pub fn begin_epoch(&self, epoch: u64) {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        ledger.epoch = epoch;
        ledger.writes.clear();
        ledger.documents_by_path.clear();
        ledger.published.clear();
        ledger.next_sequence = Some(FIRST_OBSERVATION_SEQUENCE);
    } // End of function begin_epoch()

    /// Records `revision` as the latest revision this application committed for
    /// `document`, at `path`, **and invalidates whatever was last published for
    /// that path**.
    ///
    /// **The one producer of an [`AppWrite`]**, and its one production caller is
    /// `crate::commands::commit_and_record`, which calls it for
    /// `Ok(SavedDocument { committed: true, .. })` and for nothing else — see
    /// `committed_revision` there, which is exhaustive over the transaction's
    /// outcome so that no error, including one that
    /// `SaveError::may_have_written`, can reach this function.
    ///
    /// `gate` is the window this record shares with its transaction; it is read
    /// for nothing, and holding it is the whole of its contribution. See
    /// [`CommitGate`] for what that forces and what it does not.
    ///
    /// **The instant is taken here**, on the line that inserts the record, and
    /// therefore after `save_document` returned and after the rename inside it.
    /// It is what lets [`decide`] refuse an observation whose reads it cannot
    /// place at or after that rename ([`Admission::PrecedesACommit`]); see
    /// [`RecordedWrite::recorded_at`] for why *after the rename* rather than
    /// before it is the half that matters.
    ///
    /// Replaces any earlier record for the same document, which is the consult's
    /// *replace it on the next committed app save*. It replaces the path index
    /// entry too, so a document whose path this session re-resolved cannot leave
    /// a second key pointing at it.
    ///
    /// # Why the published state is invalidated, and why it is done here
    ///
    /// This step's round-1 second High. The published-state map answers *what
    /// was a consumer last told about this path*, and a committed app write
    /// makes every earlier answer for it obsolete: the bytes on disk are now
    /// this application's, and the entry that still names some earlier external
    /// revision B would coalesce a genuine post-commit external replacement
    /// back to B into a `Duplicate` — reporting nothing, and retaining a record
    /// that then suppresses a later real change. Invalidating rather than
    /// publishing the committed revision is the deliberate direction: nothing
    /// was published for this write, no sequence was spent, and no consumer was
    /// told, so the map must not claim one was. It happens in **this** function,
    /// under the same state guard as the record, so the two cannot be observed
    /// apart.
    pub fn record_app_write(
        &self,
        gate: &CommitGate<'_>,
        document: DocumentId,
        path: &Path,
        revision: ContentRevision,
    ) {
        let _ = gate;
        let mut ledger = self.lock();
        let epoch = ledger.epoch;
        ledger.writes.insert(
            document,
            RecordedWrite {
                write: AppWrite { epoch, revision },
                recorded_at: Instant::now(),
            },
        );
        ledger
            .documents_by_path
            .retain(|_, recorded| *recorded != document);
        ledger
            .documents_by_path
            .insert(path.to_path_buf(), document);
        ledger.published.remove(path);
    } // End of function record_app_write()

    /// The decision for one observation of `path`, produced under `epoch`.
    ///
    /// The watcher's entry point: the epoch is the tag the observation carries,
    /// and an observation from a replaced watcher is discarded here before
    /// anything can name a document.
    ///
    /// **Takes the commit gate before the state**, so a decision can never land
    /// between a save's rename and the record that describes it; both guards are
    /// released before this returns, which is what lets [`admitting_sink`] call
    /// a downstream sink that re-enters either.
    ///
    /// `read_after` is an instant the observation's reads are known to follow —
    /// [`crate::watch::EpochObservation::read_after`], taken by the worker
    /// before the engine pass that produced this state. The gate cannot reach a
    /// read that already happened, so this is what places one; see the *stamp*
    /// section of this module for the implication, and for the fact that
    /// **nothing in the type system makes a caller take it before its read**.
    pub fn admit(
        &self,
        epoch: u64,
        path: &Path,
        state: ObservedState,
        read_after: Instant,
    ) -> Admission {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        if epoch != ledger.epoch {
            ledger.tally.stale_epoch += 1;
            return Admission::StaleEpoch;
        }
        decide(&mut ledger, path, state, read_after)
    } // End of function admit()

    /// The decision for one observation taken by this session itself, under
    /// whatever epoch is current.
    ///
    /// The save path's entry point: `conflict_after_the_lock`'s refresh and
    /// `after_a_save`'s disagreeing refresh are both observations of the disk,
    /// and they go through **the same** decision a native hint does, so
    /// "external rather than self" is one rule with two callers rather than two
    /// rules that agree today. There is no epoch to check: both callers run
    /// under the session lock, which is the lock a workspace replacement takes
    /// to change the epoch.
    ///
    /// **What is weaker here than at [`WriteLedger::admit`], said rather than
    /// smoothed over**: a save-path refresh is a *single* read, where the
    /// engine's observations are two equal consecutive ones, so the consult's
    /// word — *a different **stabilized** revision* — is met by the watcher's
    /// callers and not by these two. A torn read would therefore publish a
    /// state that never stably existed and could coalesce a later real
    /// observation of the same bytes away. That is accepted because the same
    /// single read already builds the conflict payload the person is shown, so
    /// it is a property of `Workspace::refresh` rather than a new one this
    /// function introduces.
    ///
    /// **It takes the commit gate, so it must not be called from inside a
    /// commit window**: a `std::sync::Mutex` is not reentrant, and a second
    /// acquisition on one thread would deadlock against the first. Both callers
    /// are outside one by construction — `crate::commands::commit_and_record`
    /// drops its [`CommitGate`] when it returns, and only then does
    /// `run_one_save` reach `after_a_save` or `conflict_after_the_lock`.
    /// Nothing in the type system forces that ordering; the block scope of that
    /// one function is what keeps it.
    ///
    /// **`read_after` is the caller's own single read, stamped before it.** Both
    /// callers take `Instant::now()` on the line above their
    /// `Workspace::refresh` and hand it here, so the decision is the same
    /// decision a native hint gets in this respect too. No *concurrent* commit
    /// can refuse them — both run under the session lock, which is the lock a
    /// save holds — and the parameter exists anyway, because *one rule with two
    /// callers* is the whole of §2.6 and an internally stamped `Instant::now()`
    /// would be taken **after** the read it is meant to bound, which is the
    /// shape of the defect this parameter closes.
    ///
    /// **One refusal is reachable here, and it is stated rather than denied**
    /// (round 3's second High corrected the claim that none was). `after_a_save`
    /// stamps microseconds after its *own* save recorded, on the same thread,
    /// and [`decide`] accepts only a strictly later stamp — so a clock-resolution
    /// collision between two adjacent `Instant::now()` calls refuses it. What
    /// that costs is one publication not made: nothing is written, nothing is
    /// cleared, and the external replacement that refresh saw is a filesystem
    /// change with native hints of its own, which stabilize later and are
    /// decided against the same retained record. Refusing here is the
    /// over-refusing direction, and — unlike a watcher observation — there is no
    /// settlement to take back, because these two callers run no engine.
    pub fn admit_at_current_epoch(
        &self,
        path: &Path,
        state: ObservedState,
        read_after: Instant,
    ) -> Admission {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        decide(&mut ledger, path, state, read_after)
    }

    /// The workspace epoch this ledger is observing under.
    // Read by this crate's tests today, and by 2d-4's wake payload when it
    // exists; the allow is scoped to non-test builds so the accessor stays
    // lint-armed exactly where its consumers exist.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn current_epoch(&self) -> u64 {
        self.lock().epoch
    }

    /// The app write recorded for `document`, if any. See [`AppWrite`].
    // Same scoped allow, same reason: an observability accessor, never a
    // control surface — nothing can steer suppression through it.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn recorded_write(&self, document: DocumentId) -> Option<AppWrite> {
        self.lock().writes.get(&document).map(|entry| entry.write)
    }

    /// The state last published for `path`, if any.
    // Same scoped allow, same reason.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn published_state(&self, path: &Path) -> Option<ObservedState> {
        self.lock().published.get(path).copied()
    }

    /// Every decision this ledger has taken. See [`LedgerTally`].
    // Same scoped allow, same reason.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn tally(&self) -> LedgerTally {
        self.lock().tally
    }

    /// Puts the sequence allocator at `next` — the boundary test's seam, so the
    /// exhausted arm can be reached without spending `u64` sequences first.
    #[cfg(test)]
    pub(crate) fn seed_sequence(&self, next: u64) {
        self.lock().next_sequence = Some(next);
    }

    /// The instant [`WriteLedger::record_app_write`] took for `document` — the
    /// **test-only** seam that makes the equality case drivable.
    ///
    /// [`RecordedWrite::recorded_at`] is private and its writer reads the clock
    /// itself, so no test can inject a colliding stamp; reading the recorded one
    /// back and handing it straight to [`WriteLedger::admit`] is what turns *two
    /// ordered `Instant` calls may answer the same value* from a reviewed
    /// argument into a driven one. Test-only because it is a chronology fact
    /// about this session and nothing in production may decide on it outside
    /// [`decide`].
    #[cfg(test)]
    pub(crate) fn recorded_at(&self, document: DocumentId) -> Option<Instant> {
        self.lock()
            .writes
            .get(&document)
            .map(|entry| entry.recorded_at)
    }

    /// How many threads have announced themselves at the commit gate and not
    /// yet acquired it — see [`WriteLedger::gate_waiters`].
    #[cfg(test)]
    pub(crate) fn commit_gate_waiters(&self) -> usize {
        self.gate_waiters.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Takes the commit gate, announcing the wait first so that a test holding
    /// the gate can observe — positively — that a decision is parked behind it.
    ///
    /// **The announcement and the acquisition are one function on purpose**: a
    /// build with the acquisition removed loses the announcement with it, so the
    /// concurrency tests' positive wait times out rather than quietly racing.
    ///
    /// Every caller binds the guard to `_gate` rather than to `_`. That is not
    /// style: `let _ = …` drops a guard at the semicolon, which would leave the
    /// gate open across the very window it exists to close. It is the one
    /// spelling of this mistake the compiler catches — rustc's
    /// `let_underscore_lock` is deny-by-default and rejects it, measured rather
    /// than assumed — and it is the only one, so a guard bound and then dropped
    /// early is still a defect no tool reports.
    ///
    /// Poisoning is absorbed for [`WriteLedger::lock`]'s reason, and here the
    /// argument is stronger still: the gate guards no data at all, so a panic
    /// under it cannot have left anything half-written.
    fn enter_gate(&self) -> MutexGuard<'_, ()> {
        #[cfg(test)]
        self.gate_waiters
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let held = self.gate.lock().unwrap_or_else(PoisonError::into_inner);
        #[cfg(test)]
        self.gate_waiters
            .fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
        held
    } // End of function enter_gate()

    /// Locks the ledger, absorbing poisoning for `crate::commands`'s reason: a
    /// poisoned mutex means some other call panicked, and refusing every later
    /// decision because of it would turn one panic into a session that can
    /// neither suppress nor observe.
    fn lock(&self) -> MutexGuard<'_, LedgerState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
} // End of impl WriteLedger

impl Default for WriteLedger {
    /// [`WriteLedger::new`].
    fn default() -> WriteLedger {
        WriteLedger::new()
    }
}

/// The decision itself, with the epoch already agreed.
///
/// A free function over the locked state rather than a method, so that it
/// cannot be reached without the guard and cannot take the guard twice — a
/// `std::sync::Mutex` is not reentrant, and the two public entry points differ
/// only in whether they check the tag.
///
/// The order of the checks is the contract:
///
/// 1. **chronology**, which retains its record: an observation whose reads
///    cannot be placed at or after the record was taken **may** describe bytes
///    this application has since replaced — the check proves only that the
///    session cannot rule that out — so it may neither publish nor supersede.
///    The round-2 High; see this module's *stamp* section for the implication
///    and for the direction it over-refuses in;
/// 2. **suppression**, which retains its record too — the several native hints
///    one atomic replacement generates must all meet the same entry;
/// 3. **supersession**, which clears any app-write record for this path. It
///    needs no condition of its own, in either direction: a `Content` state
///    reaching here was already proved by step 2 not to be the recorded bytes,
///    and an `Absent` or `Unreadable` state says the file holds no bytes at
///    all. Either way the record would from here on suppress a real
///    observation — a later external revert to those exact bytes — rather than
///    this application's own write;
/// 4. **coalescing**, against the state last published for this path;
/// 5. **publication**, which spends one sequence and publishes the state.
///
/// **Step 3 sits above steps 4 and 5 rather than inside step 5**, which is this
/// step's round-1 second High read as a shape rather than as a sentence: an arm
/// that returns early must not skip a mutation a later arm performs unless
/// skipping it is the point. Only steps 1 and 2 have that licence, and both say
/// so. The two arms below step 3 are `Duplicate` and `SequenceSpaceExhausted`,
/// and clearing on either is the same fact — the file no longer holds what this
/// application committed — even though `SequenceSpaceExhausted` is terminal
/// within its epoch and therefore cannot act on it.
///
/// **Step 1 sits above step 2, and the order decides only which counter moves.**
/// The two overlap on exactly one input — a reading of the recorded bytes,
/// stamped before the record — and both answers are true of it, both retain the
/// record and both publish nothing. Chronology is asked first because it is a
/// question about the *reading* rather than about the bytes, which is the same
/// class as [`WriteLedger::admit`]'s epoch check; a consequence worth stating is
/// that a self-write hint stamped before its own record is counted as
/// `preceded_a_commit` rather than as `suppressed`, which is what makes
/// `crate::watch_check`'s positive wait on the suppression tally bite against a
/// stamp taken too early on the production path.
///
/// The one early return **above** all of this is
/// [`WriteLedger::admit`]'s stale-epoch discard, which deliberately mutates
/// nothing but the tally: an observation carrying a replaced epoch may not name
/// a document, so it may not clear that document's record either.
///
/// **No public sequence can currently reach step 4 with a record standing**,
/// because [`WriteLedger::record_app_write`] invalidates the path's published
/// state, so the first decision after a record can never be a `Duplicate` — and
/// step 1, which is the only arm added since that argument was written, neither
/// publishes nor clears, so it cannot put one back either.
/// Step 3's position is therefore reviewed rather than driven — the second
/// statement of one rule, exactly as [`AppWrite::epoch`] is for the discard on
/// workspace replacement.
fn decide(
    ledger: &mut LedgerState,
    path: &Path,
    state: ObservedState,
    read_after: Instant,
) -> Admission {
    // One lookup, read by both retaining checks. Two lookups of the same entry
    // under one guard could not disagree today, but they are two statements of
    // *which entry this path has* and only one of them would be updated by a
    // future change to the key — the shape this step has already shipped twice.
    let document = ledger.documents_by_path.get(path).copied();
    let recorded = document
        .and_then(|document| ledger.writes.get(&document).copied())
        .filter(|entry| entry.write.epoch == ledger.epoch);
    if let Some(entry) = recorded {
        // **Strictly greater, and equality is a refusal.** `Instant` is
        // monotonic but expressly *not* guaranteed strictly increasing, so two
        // ordered clock reads may answer the same value — and at equality this
        // comparison proves nothing about which of the two calls came first.
        // Accepting there would let a reading taken before the rename clear the
        // record and make the save's own hints foreign, which is round 2's High
        // restored by a clock-resolution collision. See this module's *stamp*
        // section for the implication the accepted condition carries.
        if read_after <= entry.recorded_at {
            ledger.tally.preceded_a_commit += 1;
            return Admission::PrecedesACommit;
        }
    }
    if let ObservedState::Content(observed) = state {
        // Absence and unreadability are deliberately not routed through the
        // predicate: this application never removes a file and never makes one
        // unreadable, so neither state can be a self-write, and asking the
        // predicate about a revision that no longer describes the file would be
        // asking it a question it does not answer. The chronology check above
        // is **not** narrowed that way: a stale reading of an absence would
        // otherwise clear the record of a file this application has since
        // written, which is the round-2 High with a different state in it.
        if self_write_suppresses(recorded.map(|entry| entry.write.revision), observed) {
            ledger.tally.suppressed += 1;
            return Admission::SelfWrite;
        }
    }
    if let Some(document) = ledger.documents_by_path.remove(path) {
        ledger.writes.remove(&document);
    }
    if ledger.published.get(path) == Some(&state) {
        ledger.tally.coalesced += 1;
        return Admission::Duplicate;
    }
    let Some(sequence) = ledger.next_sequence else {
        return Admission::SequenceSpaceExhausted;
    };
    ledger.next_sequence = sequence.checked_add(1);
    ledger.published.insert(path.to_path_buf(), state);
    ledger.tally.admitted += 1;
    Admission::Admitted { sequence }
} // End of function decide()

/// One admitted observation: the engine's conclusion, its watcher's epoch, and
/// the sequence this session gave it.
///
/// What a downstream sink receives, and the shape 2d-4's queue will carry. A
/// value of this type has already passed the epoch check, the suppression
/// predicate and the coalescing rule — which is why it is a different type from
/// [`EpochObservation`] rather than the same one with a number added.
// Read by `crate::watch_check` today and by 2d-4's queue in production — the
// production downstream sink drops the whole value, so nothing reads a field of
// it yet. The allow is scoped to non-test builds so the fields stay lint-armed
// exactly where their consumers exist, and so that wiring the queue is what
// removes it.
#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug)]
pub struct AdmittedObservation {
    /// The sequence, unique and increasing within [`AdmittedObservation::epoch`].
    pub sequence: u64,
    /// The workspace epoch the producing watcher was started under.
    pub epoch: u64,
    /// The engine's stabilized conclusion, unchanged.
    pub observation: Observation,
}

/// Where admitted observations go.
///
/// An `Arc` so one session's sink outlives every watcher it starts;
/// `Send + Sync` because the gate calls it from the watcher's worker thread,
/// synchronously, so a callback that never returns hangs its own worker — the
/// same contract [`ObservationSink`] states. It runs **outside** the ledger's
/// mutex, so it may call back into the session and into the ledger.
pub type AdmittedSink = Arc<dyn Fn(AdmittedObservation) + Send + Sync>;

/// The production downstream sink until Phase 2d-4 wires the queue: it drops
/// every admitted observation.
///
/// Deliberate and stated rather than smoothed over, exactly as
/// `crate::watch::WatcherLifecycle`'s own sink was at 2d-2: the admission gate
/// is built and tested before its consumer exists. Until that consumer exists,
/// admitted observations are produced and deliberately unconsumed in
/// production — a value this sink drops is gone, and no present code recovers
/// it. Whatever recovery 2d-4 offers is 2d-4's to build and to claim.
pub fn discarding_sink() -> AdmittedSink {
    Arc::new(|_| {})
}

/// The gate itself: an [`ObservationSink`] that asks `ledger` about every
/// observation and forwards only the admitted ones to `downstream`.
///
/// **This is where the intake sits**, and it is installed by
/// `WorkspaceSession::observing`, which every constructor of a session goes
/// through — so a production session and a test session get the same gate, and
/// the only thing a test injects is what happens *after* it.
///
/// **Both** guards — the commit gate and the state mutex — are dropped before
/// `downstream` runs, and [`WriteLedger::admit`] is what drops them, by
/// returning a value. That is not an optimisation: the worker calls this
/// closure synchronously and a downstream sink is allowed to call back into the
/// session and into this ledger, so holding either across the call would make a
/// re-entering sink deadlock against its own gate — the shape `crate::watch`'s
/// round-1 review found between the session mutex and the replacement join.
/// It is also why a downstream sink may call `WorkspaceSession::open`, which
/// takes the session lock and then this ledger's gate: the worker is holding
/// neither by then.
///
/// **It answers the producer**, since the round-3 fix round. Every decision but
/// [`Admission::PrecedesACommit`] is a
/// [`crate::watch::ObservationOutcome::Decided`]; that one is `Undecided`, and
/// `crate::watch::deliver` responds by taking the engine's settlement back. The
/// answer is produced by the **same** exhaustive match that decides whether the
/// observation reaches `downstream`, so no arm can do both — see the match
/// itself for why that had to be structural rather than two expressions. **What
/// the types do not force**, beside what they do: nothing makes a caller of this
/// sink act on the answer at all, and a caller that drops it silently restores
/// the round-3 High. `crate::watch::deliver` is the one call site.
pub fn admitting_sink(ledger: Arc<WriteLedger>, downstream: AdmittedSink) -> ObservationSink {
    Arc::new(move |observed: EpochObservation| {
        let admission = ledger.admit(
            observed.epoch,
            observed_path(&observed.observation),
            observed_state(&observed.observation),
            // The producer's stamp, forwarded rather than re-taken: an
            // `Instant::now()` here would be taken **after** the reads it is
            // meant to bound, which is exactly the value that loses the race
            // this stamp exists to decide.
            observed.read_after,
        );
        // **One exhaustive match decides both halves**, and that is the point
        // rather than concision: *does this reach the consumer* and *may the
        // producer keep its settlement* are two answers about one decision, and
        // written as two expressions a future arm could forward a value
        // downstream while the worker un-concluded it underneath — a consumer
        // told about a state the engine has since taken back. Here the arm that
        // forwards **is** the arm that answers `Decided`.
        //
        // A seventh `Admission` is a compile error in this block, and its author
        // has to answer the question the block asks: *would re-reading the path
        // change this answer?* Only `PrecedesACommit` can say yes, and only it
        // may — a revert re-hints the path, so an arm whose answer a re-read
        // cannot change would re-observe that path forever.
        match admission {
            Admission::Admitted { sequence } => {
                downstream(AdmittedObservation {
                    sequence,
                    epoch: observed.epoch,
                    observation: observed.observation,
                });
                ObservationOutcome::Decided
            }
            // The reading decided nothing and the state it described is still
            // unreported, while the engine has already installed that state as
            // its tracked one.
            Admission::PrecedesACommit => ObservationOutcome::Undecided,
            // The other four end here, and end silently — which is exactly what
            // the tally exists to make observable — and the engine's settlement
            // stands for each:
            // - `SelfWrite` and `Duplicate` are answers about these exact
            //   bytes, and re-reading them yields the same answer;
            // - `StaleEpoch` comes from a watcher this session has already
            //   replaced, whose engine is going away and whose successor's
            //   baseline scan re-reads every file under both roots, so nothing
            //   is carried by taking a doomed engine's settlement back;
            // - `SequenceSpaceExhausted` is terminal within its epoch by policy,
            //   so a re-read reaches the same refusal.
            Admission::SelfWrite
            | Admission::Duplicate
            | Admission::StaleEpoch
            | Admission::SequenceSpaceExhausted => ObservationOutcome::Decided,
        } // End of the match over every decision this ledger can take
    })
} // End of function admitting_sink()

#[cfg(test)]
mod tests {
    use super::*;
    use espansoconfig_core::watch::engine::StableContent;
    use std::sync::mpsc::RecvTimeoutError;
    use std::time::Duration;

    /// A bound for the one test that would otherwise hang on a regression.
    const PATIENCE: Duration = Duration::from_secs(30);

    /// A ledger already observing epoch 1, which is every test's starting
    /// point: a ledger with no epoch has no observations to decide about.
    fn ledger_at_epoch(epoch: u64) -> WriteLedger {
        let ledger = WriteLedger::new();
        ledger.begin_epoch(epoch);
        ledger
    }

    /// A revision, from bytes that say what they are.
    fn revision(text: &str) -> ContentRevision {
        ContentRevision::of_bytes(text.as_bytes())
    }

    /// One observation admitted with a stamp taken **at the call**, which is
    /// what an ordinary hint carries: a reading later than everything the test
    /// has already done, records included.
    ///
    /// Every test that is not about chronology uses this, so that the parameter
    /// which decides chronology is spelled out only where it is the subject.
    /// The tests that stamp explicitly are the ones below whose whole question
    /// is *which side of a commit this reading is on*.
    fn admit_now(ledger: &WriteLedger, epoch: u64, path: &Path, state: ObservedState) -> Admission {
        ledger.admit(epoch, path, state, later_than_now())
    }

    /// An instant strictly later than every clock read taken before this call.
    ///
    /// **`Instant::now()` alone would not be**, which is round 3's second High
    /// seen from the test side: the clock is monotonic and not guaranteed
    /// strictly increasing, so a read taken microseconds after a record can
    /// answer the record's own value — and [`decide`] refuses at equality, by
    /// design. The offset makes these helpers' claim (*a reading later than
    /// everything this test has already done*) true by construction rather than
    /// by the host clock's resolution. The one test that wants the collision
    /// asks for it explicitly, through [`WriteLedger::recorded_at`].
    fn later_than_now() -> Instant {
        Instant::now() + Duration::from_nanos(1)
    }

    /// One committed app write, taken in a commit window of its own.
    ///
    /// A helper rather than four lines in every test, and the window is scoped
    /// to this call for a reason worth naming: the commit gate is a plain
    /// `std::sync::Mutex`, so a test that kept the guard alive and then called
    /// [`WriteLedger::admit`] on the same thread would deadlock against itself.
    /// The two concurrency tests below take their gate explicitly, because for
    /// them the window's width is the thing under test.
    fn record(ledger: &WriteLedger, document: DocumentId, path: &Path, revision: ContentRevision) {
        let gate = ledger.begin_commit();
        ledger.record_app_write(&gate, document, path, revision);
    }

    /// Waits — **positively** — until some thread is parked at `ledger`'s commit
    /// gate, and panics if none arrives.
    ///
    /// This is what makes the concurrency tests deterministic rather than
    /// timed. The caller holds the gate, so a non-zero waiter count proves the
    /// other thread is inside [`WriteLedger::admit`], past the announcement and
    /// unable to decide; the caller may then take its record knowing exactly
    /// what the other thread has *not* done. A build whose `admit` does not
    /// take the gate never announces, so this fails instead of racing.
    fn await_a_waiter_at_the_gate(ledger: &WriteLedger) {
        let deadline = std::time::Instant::now() + PATIENCE;
        while std::time::Instant::now() < deadline {
            if ledger.commit_gate_waiters() >= 1 {
                return;
            }
            std::thread::yield_now();
        }
        panic!("no admission ever reached the commit gate — is `admit` taking it?");
    } // End of function await_a_waiter_at_the_gate()

    /// One observation as a watcher hands it to the gate, stamped **now** —
    /// later than anything the test has already done, exactly as
    /// [`admit_now`] is for a direct admission.
    fn hinted(epoch: u64, observation: Observation) -> EpochObservation {
        EpochObservation {
            epoch,
            read_after: later_than_now(),
            observation,
        }
    }

    /// A `Changed` observation carrying `revision` and nothing that needs a
    /// projection: `StableContent::NotUtf8` hashes exact bytes and holds no
    /// snapshot, which is all the gate reads.
    fn changed_at(path: &Path, revision: ContentRevision) -> Observation {
        Observation::Changed {
            path: path.to_path_buf(),
            previous_revision: None,
            content: StableContent::NotUtf8 {
                revision,
                offset: 0,
            },
            correspondences: None,
        }
    }

    #[test]
    fn an_observation_carrying_a_stale_epoch_is_discarded() {
        let ledger = ledger_at_epoch(2);
        let path = Path::new("/tree/match/base.yml");
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("old"))),
            Admission::StaleEpoch,
            "a replaced watcher's observation must not name a document"
        );
        assert_eq!(ledger.tally().stale_epoch, 1);
        assert_eq!(
            admit_now(&ledger, 2, path, ObservedState::Content(revision("new"))),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "the live epoch's observation is admitted"
        );
        // The discarded one spent no sequence and published nothing.
        assert_eq!(ledger.tally().admitted, 1);
    } // End of function an_observation_carrying_a_stale_epoch_is_discarded()

    #[test]
    fn the_recorded_revision_is_suppressed_and_survives_duplicate_hints() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(7);
        let committed = revision("committed");
        record(&ledger, document, path, committed);

        // One atomic replacement can generate several native notifications, and
        // every one of them must meet the same retained entry.
        for hint in 0..3 {
            assert_eq!(
                admit_now(&ledger, 1, path, ObservedState::Content(committed)),
                Admission::SelfWrite,
                "hint {hint} must be suppressed by the retained record"
            );
        } // End of the loop over the duplicate hints one replacement generates
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "suppression retains the record"
        );
        assert_eq!(ledger.tally().suppressed, 3);
        assert_eq!(ledger.tally().admitted, 0);
        assert_eq!(ledger.published_state(path), None, "nothing was published");
    } // End of function the_recorded_revision_is_suppressed_and_survives_duplicate_hints()

    #[test]
    fn a_different_revision_is_admitted_and_supersedes_the_record() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(7);
        let committed = revision("committed");
        let external = revision("external");
        record(&ledger, document, path, committed);

        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(external)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "a post-commit external replacement is not suppressed"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "an accepted different revision clears the record"
        );
        // …so the previously committed bytes are no longer suppressed either:
        // a revert to them is an external change like any other.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::Admitted { sequence: 2 }
        );
    } // End of function a_different_revision_is_admitted_and_supersedes_the_record()

    #[test]
    fn an_absence_or_an_unreadable_state_is_never_a_self_write() {
        let ledger = ledger_at_epoch(1);
        let gone = Path::new("/tree/match/gone.yml");
        let unreadable = Path::new("/tree/match/unreadable.yml");
        record(&ledger, DocumentId(1), gone, revision("committed"));
        record(&ledger, DocumentId(2), unreadable, revision("committed"));

        assert_eq!(
            admit_now(&ledger, 1, gone, ObservedState::Absent),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "this application removes no file, so a removal is never its own write"
        );
        assert_eq!(
            admit_now(
                &ledger,
                1,
                unreadable,
                ObservedState::Unreadable(io::ErrorKind::PermissionDenied)
            ),
            Admission::Admitted { sequence: 2 }
        );
        assert_eq!(ledger.recorded_write(DocumentId(1)), None);
        assert_eq!(ledger.recorded_write(DocumentId(2)), None);
    } // End of function an_absence_or_an_unreadable_state_is_never_a_self_write()

    #[test]
    fn sequences_increase_monotonically_within_one_epoch() {
        let ledger = ledger_at_epoch(1);
        let first = Path::new("/tree/match/a.yml");
        let second = Path::new("/tree/match/b.yml");
        let mut seen = Vec::new();
        for step in 0..3u32 {
            for path in [first, second] {
                if let Admission::Admitted { sequence } = admit_now(
                    &ledger,
                    1,
                    path,
                    ObservedState::Content(revision(&format!("{step}"))),
                ) {
                    seen.push(sequence);
                }
            }
        } // End of the loop driving six distinct states through the gate
        assert_eq!(seen, vec![1, 2, 3, 4, 5, 6], "sequences increase by one");
    } // End of function sequences_increase_monotonically_within_one_epoch()

    #[test]
    fn a_repeat_coalesces_while_removal_and_recreation_are_two_observations() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let bytes = revision("the same bytes");

        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(bytes)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(bytes)),
            Admission::Duplicate,
            "the state already published produces no second observation"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Absent),
            Admission::Admitted { sequence: 2 },
            "a removal is a different state"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Absent),
            Admission::Duplicate,
            "a repeated removal coalesces too"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(bytes)),
            Admission::Admitted { sequence: 3 },
            "recreation at identical bytes is a second observation (consult Q3)"
        );
        assert_eq!(ledger.tally().coalesced, 2);
    } // End of function a_repeat_coalesces_while_removal_and_recreation_are_two_observations()

    #[test]
    fn workspace_replacement_discards_the_whole_map() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(7);
        let committed = revision("committed");
        record(&ledger, document, path, committed);
        assert!(matches!(
            admit_now(
                &ledger,
                1,
                Path::new("/tree/match/other.yml"),
                ObservedState::Absent
            ),
            Admission::Admitted { .. }
        ));

        ledger.begin_epoch(2);
        assert_eq!(ledger.current_epoch(), 2);
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "the map is discarded"
        );
        assert_eq!(
            ledger.published_state(Path::new("/tree/match/other.yml")),
            None,
            "the published states are discarded"
        );
        // The very bytes the previous workspace committed are now an ordinary
        // external observation, numbered from the start of the new epoch.
        assert_eq!(
            admit_now(&ledger, 2, path, ObservedState::Content(committed)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
    } // End of function workspace_replacement_discards_the_whole_map()

    #[test]
    fn an_exhausted_sequence_space_admits_nothing_further_in_its_epoch() {
        let ledger = ledger_at_epoch(1);
        ledger.seed_sequence(u64::MAX);
        let path = Path::new("/tree/match/base.yml");
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("one"))),
            Admission::Admitted { sequence: u64::MAX },
            "the last representable sequence is handed out exactly once"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("two"))),
            Admission::SequenceSpaceExhausted
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("three"))),
            Admission::SequenceSpaceExhausted,
            "exhaustion is terminal within its epoch"
        );
        // …and the next workspace open resets it, like everything else.
        ledger.begin_epoch(2);
        assert_eq!(
            admit_now(&ledger, 2, path, ObservedState::Content(revision("four"))),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
    } // End of function an_exhausted_sequence_space_admits_nothing_further_in_its_epoch()

    #[test]
    fn the_gate_forwards_only_admitted_observations_and_numbers_them() {
        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let gate = admitting_sink(Arc::clone(&ledger), downstream);

        let path = Path::new("/tree/match/base.yml");
        let committed = revision("committed");
        record(&ledger, DocumentId(3), path, committed);

        // Suppressed: this application's own committed bytes.
        gate(hinted(1, changed_at(path, committed)));
        // Discarded: a replaced watcher's epoch.
        gate(hinted(
            99,
            changed_at(path, revision("from a replaced watcher")),
        ));
        // Admitted.
        let external = revision("external");
        gate(hinted(1, changed_at(path, external)));
        // Coalesced: the same state again.
        gate(hinted(1, changed_at(path, external)));

        let admitted = received.try_recv().expect("one observation was admitted");
        assert_eq!(admitted.sequence, FIRST_OBSERVATION_SEQUENCE);
        assert_eq!(admitted.epoch, 1);
        assert_eq!(observed_path(&admitted.observation), path);
        assert!(
            received.try_recv().is_err(),
            "nothing else may reach the downstream sink"
        );
        assert_eq!(
            ledger.tally(),
            LedgerTally {
                admitted: 1,
                suppressed: 1,
                coalesced: 1,
                stale_epoch: 1,
                // Every hint here is stamped after the record, so the
                // chronology arm is not on this test's path at all — the
                // literal says so rather than leaving it to be inferred.
                preceded_a_commit: 0,
            }
        );
    } // End of function the_gate_forwards_only_admitted_observations_and_numbers_them()

    #[test]
    fn the_downstream_sink_runs_outside_the_ledger_lock() {
        // A downstream sink is allowed to call back into the ledger, exactly as
        // it is allowed to call back into the session. Were the gate to hold
        // its guard across the call, this would deadlock against a mutex that
        // is not reentrant — so the verdict is taken on another thread and
        // bounded, and a regression fails as a timeout rather than hanging the
        // suite.
        let ledger = Arc::new(ledger_at_epoch(1));
        let (answers, reentered) = std::sync::mpsc::channel::<Option<AppWrite>>();
        let downstream: AdmittedSink = {
            let ledger = Arc::clone(&ledger);
            Arc::new(move |_| {
                let _ = answers.send(ledger.recorded_write(DocumentId(5)));
            })
        };
        let gate = admitting_sink(Arc::clone(&ledger), downstream);
        let path = Path::new("/tree/match/base.yml");
        record(&ledger, DocumentId(5), path, revision("committed"));

        std::thread::spawn(move || {
            gate(hinted(
                1,
                changed_at(Path::new("/tree/match/base.yml"), revision("external")),
            ));
        });
        match reentered.recv_timeout(PATIENCE) {
            Ok(seen) => assert_eq!(
                seen, None,
                "the re-entry read the ledger after the admission cleared the record"
            ),
            Err(RecvTimeoutError::Timeout) => {
                panic!("the downstream sink could not re-enter the ledger — the guard is held")
            }
            Err(other) => panic!("the gate thread died: {other:?}"),
        } // End of the match over the bounded re-entry verdict
    } // End of function the_downstream_sink_runs_outside_the_ledger_lock()

    #[test]
    fn a_committed_record_invalidates_the_published_state_and_supersedes_itself() {
        // Round 1's second High, as its own sequence: `publish B → record A →
        // observe B → observe A`. Every step is a plain call on one thread, so
        // no interleaving is needed to reach it — which is what made it a
        // deterministic defect rather than a race.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(21);
        let ours = revision("what this application committed");
        let theirs = revision("what somebody else wrote");

        // 1. An external revision is admitted, so it becomes the published one.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(theirs)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(
            ledger.published_state(path),
            Some(ObservedState::Content(theirs))
        );

        // 2. This application commits its own bytes over them.
        record(&ledger, document, path, ours);
        assert_eq!(
            ledger.published_state(path),
            None,
            "a committed app write invalidates what was last published for its path"
        );

        // 3. Its own hints are still suppressed, and the record survives them.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(ours)),
            Admission::SelfWrite
        );

        // 4. The post-commit external replacement — back to the very bytes that
        //    were published in step 1. Without the invalidation this coalesced
        //    into a `Duplicate`, reported nothing, and left the record standing.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(theirs)),
            Admission::Admitted { sequence: 2 },
            "a post-commit external replacement is an observation, not a duplicate"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "and it supersedes the record rather than leaving a stale one behind"
        );

        // 5. …so a genuine external revert to this application's own committed
        //    bytes is admitted too, rather than suppressed by that stale record.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(ours)),
            Admission::Admitted { sequence: 3 },
            "the bytes this application once committed are external now"
        );
        assert_eq!(ledger.tally().coalesced, 0, "nothing here was a duplicate");
    } // End of function a_committed_record_invalidates_the_published_state_and_supersedes_itself()

    #[test]
    fn no_admission_can_decide_between_a_commit_and_its_record() {
        // Round 1's first High. The choreography is deterministic in both
        // directions and nothing here is timed: the watcher thread is released
        // into `admit` by a barrier, and the committing thread then waits — a
        // **positive** wait — until that admission has announced itself at the
        // commit gate. It cannot have decided, because the commit window holds
        // the gate. A build whose `admit` does not take the gate never
        // announces, so `await_a_waiter_at_the_gate` fails instead of racing.
        //
        // **The arm this ends in changed with the round-2 fix round, and the
        // claims did not.** A reading parked at the gate was necessarily taken
        // before the record the window takes, so it is now refused as older
        // (`PrecedesACommit`) rather than matched against the record
        // (`SelfWrite`). Both retain the record and publish nothing; what this
        // test exists to pin — that this application's own committed bytes are
        // never admitted as external, and that the parked thread really was
        // parked — is unchanged.
        let ledger = Arc::new(ledger_at_epoch(1));
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(31);
        let committed = revision("the bytes this application committed");
        // The worker's stamp: taken before the reads, therefore before the
        // window below. `Instant::now()` inside the thread would be the same
        // side of the record, so it is taken here to say which side it is.
        let stabilized = Instant::now();

        let (answers, decided) = std::sync::mpsc::channel::<Admission>();
        let start = Arc::new(std::sync::Barrier::new(2));
        let watcher = {
            let ledger = Arc::clone(&ledger);
            let start = Arc::clone(&start);
            std::thread::spawn(move || {
                start.wait();
                let answer = ledger.admit(
                    1,
                    Path::new("/tree/match/base.yml"),
                    ObservedState::Content(committed),
                    stabilized,
                );
                let _ = answers.send(answer);
            })
        }; // End of the block spawning the admitting thread

        let gate = ledger.begin_commit();
        // Inside the window: the transaction's rename has happened and its
        // record has not been taken. This is the instant the interleaving needs.
        start.wait();
        await_a_waiter_at_the_gate(&ledger);
        ledger.record_app_write(&gate, document, path, committed);
        drop(gate);

        let answer = decided
            .recv_timeout(PATIENCE)
            .expect("the parked admission must decide once the window closes");
        assert_eq!(
            answer,
            Admission::PrecedesACommit,
            "an admission parked at the gate decides against the record the window took"
        );
        watcher.join().expect("the admitting thread must not panic");
        assert_eq!(
            ledger.tally().admitted,
            0,
            "this application's own committed bytes were never admitted as external"
        );
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "a refusal retains the record"
        );
        assert_eq!(ledger.published_state(path), None, "nothing was published");
    } // End of function no_admission_can_decide_between_a_commit_and_its_record()

    #[test]
    fn a_reading_taken_before_a_commit_never_supersedes_its_record() {
        // **Round 2's High**, as the sequence the reviewer named:
        // `stabilize P → commit/record A → decide P → observe A`, with A
        // required to remain suppressible. Barrier-driven and deterministic:
        // the admitting thread is released into `admit` and parks at the gate,
        // and the committing thread waits — positively — until it is parked
        // before taking its record. So the decision is *after* the record while
        // the reading is *before* it, which is exactly the interleaving no gate
        // can prevent.
        //
        // This test replaces the round-1 fix round's
        // `an_external_admission_that_meets_a_commit_window_supersedes_its_record`,
        // whose scenario is this one and whose assertion was the round-2 defect
        // written down as a requirement: it demanded that the parked reading
        // clear the record, which is what makes the save's own hints foreign.
        // The half of round 1's finding that survives — a reading taken *after*
        // the commit does supersede the record — is step 5 below and
        // `a_different_revision_is_admitted_and_supersedes_the_record`.
        let ledger = Arc::new(ledger_at_epoch(1));
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(32);
        let committed = revision("the bytes this application committed");
        let before_the_save = revision("what the disk held before the save");
        let afterwards = revision("what somebody else wrote after the save");

        // 1. Stabilize P: the stamp a worker takes before the reads that settle
        //    the state the disk held before this application wrote anything.
        let stabilized = Instant::now();
        let (answers, decided) = std::sync::mpsc::channel::<Admission>();
        let start = Arc::new(std::sync::Barrier::new(2));
        let watcher = {
            let ledger = Arc::clone(&ledger);
            let start = Arc::clone(&start);
            std::thread::spawn(move || {
                start.wait();
                let answer = ledger.admit(
                    1,
                    Path::new("/tree/match/base.yml"),
                    ObservedState::Content(before_the_save),
                    stabilized,
                );
                let _ = answers.send(answer);
            })
        }; // End of the block spawning the admitting thread

        // 2. Commit and record A, with P parked at the gate for the whole
        //    window — proved by the positive wait, not assumed.
        let gate = ledger.begin_commit();
        start.wait();
        await_a_waiter_at_the_gate(&ledger);
        ledger.record_app_write(&gate, document, path, committed);
        drop(gate);

        // 3. Decide P. It read the disk before the rename, so it describes
        //    bytes this application has since replaced.
        assert_eq!(
            decided
                .recv_timeout(PATIENCE)
                .expect("the parked admission must decide once the window closes"),
            Admission::PrecedesACommit,
            "a reading this session cannot place after its own commit decides nothing"
        );
        watcher.join().expect("the admitting thread must not panic");
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "and above all it does not clear the record the window had just taken"
        );
        assert_eq!(
            ledger.published_state(path),
            None,
            "nor does it publish bytes that are no longer on disk"
        );

        // 4. Observe A — the save's own native hints, which arrive after the
        //    record. **This is the whole point**: they must still be
        //    suppressible, or this application reports its own write as
        //    somebody else's.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::SelfWrite,
            "the save's own bytes are still this application's own write"
        );

        // 5. …and a genuine external replacement afterwards is still admitted
        //    and still supersedes the record: the refusal above is about the
        //    reading's age, never about the path being exempt.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(afterwards)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "a reading taken after the commit reports and supersedes"
        );
        assert_eq!(ledger.recorded_write(document), None);
        assert_eq!(
            ledger.tally(),
            LedgerTally {
                admitted: 1,
                suppressed: 1,
                coalesced: 0,
                stale_epoch: 0,
                preceded_a_commit: 1,
            }
        );
    } // End of function a_reading_taken_before_a_commit_never_supersedes_its_record()

    #[test]
    fn a_reading_stamped_exactly_at_the_record_is_refused() {
        // **Round 3's second High**, driven rather than reviewed. `Instant` is
        // documented monotonic and *not* documented strictly increasing, so two
        // ordered calls may answer the same value — and an equal stamp orders
        // nothing at all. A test cannot make the host clock collide on demand,
        // so it asks for the collision directly: the record's own instant, read
        // back and handed straight to `admit`, is exactly what a coarse clock
        // would have produced by itself.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(51);
        let committed = revision("the bytes this application committed");
        let theirs = revision("what somebody else wrote");
        record(&ledger, document, path, committed);
        let collided = ledger.recorded_at(document).expect("the record was taken");

        assert_eq!(
            ledger.admit(1, path, ObservedState::Content(theirs), collided),
            Admission::PrecedesACommit,
            "an equal stamp does not prove the read followed the record"
        );
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "so it may not clear the record, which is what makes a save's own hints foreign"
        );
        assert_eq!(ledger.published_state(path), None, "nor publish");
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::SelfWrite,
            "and the save's own bytes are still suppressible, which is the whole consequence"
        );

        // One nanosecond later is a different question, and it is answered:
        // the refusal is about what the stamp proves, never about the path.
        assert_eq!(
            ledger.admit(
                1,
                path,
                ObservedState::Content(theirs),
                collided + Duration::from_nanos(1)
            ),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(ledger.tally().preceded_a_commit, 1);
    } // End of function a_reading_stamped_exactly_at_the_record_is_refused()

    #[test]
    fn a_refused_stabilized_state_is_re_observed_rather_than_lost() {
        // **Round 3's first High**, as the engine-plus-ledger sequence it asked
        // for, and deterministic: one real temp tree, one real engine whose
        // clock is an argument, the real `admitting_sink`, and the real
        // `crate::watch::deliver` the worker loop calls. No thread and no sleep.
        //
        // The scenario is the finding's: an external write stabilizes, `tick`
        // installs it as the engine's tracked state, this application then
        // commits and records a different revision, and the stabilized reading
        // is refused as older. Before the fix the engine kept believing it had
        // announced that state, so the second round below produced **nothing**
        // and the external change was lost with native delivery working
        // perfectly.
        use espansoconfig_core::watch::engine::{
            EngineConfig, FsWatchSource, Millis, ObservationEngine,
        };

        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let path = root.join("match/base.yml");
        let before = "matches: []\n";
        let theirs = "matches:\n  - trigger: ':theirs'\n    replace: theirs\n";
        std::fs::write(&path, before).expect("the tracked file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");

        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let sink = admitting_sink(Arc::clone(&ledger), downstream);
        let document = DocumentId(61);
        let ours = revision("the bytes this application committed");

        // 1. An external writer replaces the file, and the engine stabilizes on
        //    it: two reads in two passes, the second stamped as the worker
        //    stamps it — before the reads of that pass.
        std::fs::write(&path, theirs).expect("an external replacement");
        engine.hint(&path, Millis(0));
        assert!(engine.tick(Millis(200), &mut source).is_empty());
        let stamped_before_the_record = Instant::now();
        let settled = engine.tick(Millis(240), &mut source);
        assert_eq!(settled.len(), 1, "one stabilized observation: {settled:?}");

        // 2. This application commits and records **after** that stamp and
        //    before the observation is decided. No thread is needed: the stamp
        //    is a value, and taking the record after it is the whole scenario.
        record(&ledger, document, &path, ours);

        // 3. Deliver the pass. The reading cannot be placed after the record,
        //    so it decides nothing — and the settlement it produced is taken
        //    back rather than left standing.
        crate::watch::deliver(
            &mut engine,
            &sink,
            1,
            stamped_before_the_record,
            Millis(240),
            settled,
        );
        assert!(
            received.try_recv().is_err(),
            "a refused reading reaches no consumer"
        );
        assert_eq!(ledger.tally().preceded_a_commit, 1);
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: ours
            }),
            "and it does not clear the record"
        );
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(before.as_bytes())),
            "the engine no longer believes it announced the refused state"
        );

        // 4. The path is pending again, and the same bytes — nobody wrote the
        //    file in between — stabilize a second time, now stamped after the
        //    record. **This is the assertion the whole test exists for**:
        //    without the revert the engine coalesces here and emits nothing.
        assert!(engine.tick(Millis(440), &mut source).is_empty());
        let stamped_after_the_record = later_than_now();
        let again = engine.tick(Millis(480), &mut source);
        assert_eq!(
            again.len(),
            1,
            "the refused external state is observed again: {again:?}"
        );
        crate::watch::deliver(
            &mut engine,
            &sink,
            1,
            stamped_after_the_record,
            Millis(480),
            again,
        );
        let admitted = received
            .try_recv()
            .expect("the second stabilization is admitted");
        assert_eq!(admitted.sequence, FIRST_OBSERVATION_SEQUENCE);
        assert_eq!(observed_path(&admitted.observation), path);
        assert_eq!(
            observed_state(&admitted.observation),
            ObservedState::Content(ContentRevision::of_bytes(theirs.as_bytes())),
            "and it carries the external writer's bytes, not this application's"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "an accepted external state supersedes the record, as it always did"
        );
    } // End of function a_refused_stabilized_state_is_re_observed_rather_than_lost()

    #[test]
    fn a_reading_of_an_absence_taken_before_a_commit_is_refused_too() {
        // The chronology check is deliberately **not** narrowed to `Content`,
        // unlike the suppression predicate below it. A stale reading of an
        // absence or of an unreadable state would otherwise clear the record of
        // a file this application has since committed — round 2's High with a
        // different state in it — and then the save's own hints would be
        // admitted as foreign exactly as before. No thread is needed: the stamp
        // is a value, and taking it before the record is the whole scenario.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(41);
        let committed = revision("the bytes this application committed");

        let stabilized = Instant::now();
        record(&ledger, document, path, committed);

        for state in [
            ObservedState::Absent,
            ObservedState::Unreadable(io::ErrorKind::PermissionDenied),
        ] {
            assert_eq!(
                ledger.admit(1, path, state, stabilized),
                Admission::PrecedesACommit,
                "a reading of {state:?} taken before the commit decides nothing"
            );
        } // End of the loop over the two states the predicate never sees
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "the record stands, so the save's own hints are still suppressible"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::SelfWrite
        );
        // …while a reading of the same absence taken afterwards is an ordinary
        // observation, which is what makes the refusal above about age.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Absent),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(ledger.recorded_write(document), None);
    } // End of function a_reading_of_an_absence_taken_before_a_commit_is_refused_too()
}
