//! The reconciliation queue and the wire it puts external changes on —
//! Phase 2d-4a.
//!
//! Phase 2d-3 built the admission gate and stopped there: everything it
//! admitted went to a downstream sink that dropped it, so a sequence and a
//! publication were spent on a value no code could recover. This module is that
//! consumer. It holds admitted observations beside the open workspace session,
//! numbers nothing itself, and turns each one into a typed wire value when the
//! frontend asks for it.
//!
//! # The protocol, and which half of it is authoritative
//!
//! Two halves, exactly as the 2d design consult's Q3 rules:
//!
//! - **A push that is a hint.** [`ReconciliationWake`] goes out on
//!   [`crate::events::RECONCILIATION_READY`] after an enqueue. It carries a
//!   workspace epoch and a sequence and nothing else; it is expendable, and it
//!   is deliberately **not** a `CommandResult`, because it reports no requested
//!   operation. A listener that attaches late, a webview that was suspended, or
//!   a delivery order Tauri chose for its own reasons cannot make the window
//!   wrong, because nothing installs anything from a wake.
//! - **A poll that is the truth.** `crate::commands::drain_external_changes`
//!   hands back a [`ReconciliationBatch`], and that value — never the wake — is
//!   what a caller acts on.
//!
//! # What this queue guarantees
//!
//! Exactly the four things Q3 lists, and they are worth reading as four
//! separate claims rather than one:
//!
//! 1. **Sequences increase within one workspace epoch.** The numbers are
//!    `crate::ledger`'s, minted under its own mutex, and this module never
//!    invents one. [`ReconciliationQueue::begin_epoch`] empties the queue when
//!    the session adopts a new epoch, so a sequence never has to be compared
//!    across two of them.
//! 2. **A drained batch is sequence-ordered**, by construction rather than by
//!    arrival: the pending set is a `BTreeMap` keyed by the sequence, so the
//!    order a batch comes out in is the order of the keys and not the order two
//!    threads happened to reach [`ReconciliationQueue::enqueue`].
//! 3. **Repeated hints that stabilize to the same document and revision
//!    coalesce, whichever order the two arrive in.** Take one path's undrained
//!    entries in sequence order: a **maximal run of them asserting one
//!    `crate::ledger::ObservedState`** contributes exactly one observation to a
//!    batch, the one at the **highest** sequence of the run. That is
//!    [`coalesced_sequences`], a pure function of the pending set, so the order
//!    two threads happened to reach [`ReconciliationQueue::enqueue`] in cannot
//!    change its answer — which is what makes this guarantee unconditional.
//!
//!    Two consequences worth reading separately. **Adjacency is in sequence
//!    order, never in arrival order**, so a state that returns after a
//!    different one — `A`, then `B`, then `A` — is two `A` observations: the
//!    file genuinely held `B` in between and neither `A` is adjacent to the
//!    other. And the fold happens at **drain**, over the complete set, rather
//!    than at enqueue over the history so far; the price is that a folded entry
//!    keeps its slot against [`QUEUE_CAPACITY`] until a drain acknowledges it,
//!    since it is folded out of the batch and not out of the queue.
//!
//!    **One thing can still make two arrival orders answer differently, and it
//!    is not this rule:** an overflow evicts by sequence, so which entries a
//!    full queue is holding when a drain arrives depends on what arrived and
//!    when. That is a **loss**, reported in [`ReconciliationBatch::discarded`]
//!    and obliging a whole-workspace reload — not a coalescing failure, and
//!    not something a fold could repair.
//! 4. **Per document the consumer acts on the highest sequence it has
//!    accepted** — which is the *consumer's* rule, not this queue's, and this
//!    queue's part of it is the `after_sequence` watermark: a drain removes
//!    every entry at or below the sequence the caller says it already holds,
//!    keeps everything above it, and returns the coalesced form of what it
//!    kept. So an entry stays until a later drain acknowledges it **unless the
//!    queue reaches [`QUEUE_CAPACITY`] first** — an overflow evicts the oldest
//!    undrained entries unacknowledged and counts them in
//!    [`ReconciliationBatch::discarded`], and what that costs is the
//!    whole-workspace reload a non-zero `discarded` obliges, never a repeated
//!    drain. Short of an eviction, an answer lost on the way to the window
//!    costs no more than the drain that repeats it, **when nothing is enqueued
//!    between the two drains**. **What nothing in this step makes happen is
//!    that later drain** — see [`ReconciliationQueue::wake`].
//!
//! # What it does not do, stated because each one is a way to be wrong
//!
//! - **It infers no filesystem chronology from hashes.** Nothing here compares
//!   two [`ContentRevision`]s for order; *later* always means a larger
//!   sequence.
//! - **It assumes no relation between native events and writes.** One write may
//!   produce many hints and many writes may produce one, and this queue counts
//!   neither: it counts admitted observations.
//! - **It assumes no global order between two documents.** Two files' sequences
//!   are comparable as admission order in this session and as nothing about
//!   disk.
//! - **It assumes no one-to-one relation between a wake and a queued value.** A
//!   wake may be dropped by the event system; a refused enqueue emits none; and
//!   an enqueue whose entry the fold above will not carry emits one like any
//!   other, so a wake is no promise that the next batch grew.
//! - **A `Removed` followed by an `Added` at the same path is two entries**,
//!   even when the new bytes hash like the old ones, because file membership
//!   changed. The coalescing rule above compares
//!   `crate::ledger::ObservedState`, and `Absent` never equals `Content(_)`.
//!
//! What the whole observation pipeline does and does not promise about a path
//! ever being looked at again is [`espansoconfig_core::watch::liveness`], which
//! this module points at rather than restating.
//!
//! # Where the identities come from
//!
//! A [`ContentRevision`] and a projection ride the observation itself, so a
//! [`ExternalObservation::Changed`] needs nothing but the value the gate
//! admitted. An address does not: `espansoconfig_core::watch::engine`'s
//! `Removed` and `Unreadable` carry a path and no identity, and this crate
//! cannot mint one — the core keeps identity minting private on purpose. So the
//! projection into wire form happens at **drain** time, under the session lock,
//! where the open `Workspace` can be asked.
//!
//! The workspace answers for the paths it **discovered**, and a file created
//! after it was opened is not among them. So a drain also *records*: every
//! identity this queue puts on the wire is remembered against the path it was
//! put on, for the life of the epoch. Without that memory an
//! [`ExternalObservation::Added`] would hand the consumer a [`DocumentId`] and
//! the same file's later removal or unreadability would cross as a display
//! path, leaving the consumer holding a projection under an identity nothing
//! could tell it to invalidate. [`ObservedDocument`] is what a path **neither**
//! of those two can address crosses as.
//!
//! # Locks
//!
//! One mutex over the pending set and one over the wake emitter, both **leaf**
//! locks in the same sense `crate::ledger`'s are: nothing caller-supplied runs
//! under either. The emitter is cloned out and called with no lock held. The
//! only order that exists is session → queue: a drain holds the session lock
//! and takes this one below it, and the watcher's worker thread takes this one
//! with no session lock at all.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};

use serde::Serialize;

use espansoconfig_core::discovery::DiscoveredFile;
use espansoconfig_core::model::DocumentView;
use espansoconfig_core::validate::Finding;
use espansoconfig_core::watch::correspond::CorrespondenceTable;
use espansoconfig_core::watch::engine::{Observation, StableContent};
use espansoconfig_core::workspace::{DocumentSummary, Workspace};
use espansoconfig_core::{ContentRevision, DocumentId, WirePath};

use crate::ledger::{observed_state, AdmittedObservation, AdmittedSink, ObservedState};
use crate::watch::NO_EPOCH;

/// How many undrained observations one workspace epoch's queue holds.
///
/// **A bound on the count, never on the bytes.** A
/// [`ExternalObservation::Changed`] carries a whole file's text and its
/// projection, so what this number bounds is how many such values one epoch may
/// hold at once and not how large any of them is.
///
/// It exists because the consumer is a webview that can be suspended while an
/// external process keeps writing. Without a bound a suspended window and a
/// busy writer grow this queue until the process dies; with one, the oldest
/// entries are dropped and [`ReconciliationBatch::discarded`] counts them, so a
/// caller that sees a non-zero count knows its batch is not a complete history
/// of the epoch and must reload rather than reconcile.
///
/// **Dropping the oldest entry preserves no document.** The entry dropped is
/// the globally oldest one, and it may be the only entry its document has — in
/// which case that document's newest observed state is exactly what overflow
/// lost. What the policy does buy is that the entries kept are the ones nearest
/// the present state of the tree; what it does **not** buy is a per-document
/// survivor, and an earlier draft of this comment claimed one. Overflow is
/// therefore **observable rather than harmless**: a cumulative
/// [`ReconciliationBatch::discarded`] and the whole-workspace reload it obliges
/// are the whole of the safety here. Nothing in Phase 2d-4a enforces that
/// obligation — `docs/decisions/2d-4a-notes.md` R4 assigns it to the consumer.
pub const QUEUE_CAPACITY: usize = 256;

/// The payload of [`crate::events::RECONCILIATION_READY`] — a hint, and the
/// whole of it.
///
/// **Not a `CommandResult`**, because it reports no requested operation (the
/// consult's Q3). It carries no observation and no document: everything a
/// caller acts on comes back from the drain command, and the only thing this
/// value is good for is deciding to call it.
///
/// `workspace_epoch` is what makes a wake from a replaced workspace visibly
/// stale. A caller whose epoch differs installs nothing — and it need not even
/// drain, because the drain would answer the current epoch anyway.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ReconciliationWake {
    /// The workspace epoch the enqueued observation was produced under.
    pub workspace_epoch: u64,
    /// The highest sequence this queue held undrained at that moment.
    ///
    /// **Not a count and not a promise of a batch size.** A later drain may
    /// return more than this (another observation arrived) or fewer (the caller
    /// had already acknowledged some of them).
    pub newest_sequence: u64,
}

/// Which document an observation is about.
///
/// Two arms because this application cannot always answer the first one.
/// `espansoconfig_core::watch::engine`'s `Removed` and `Unreadable` carry a
/// path and no identity, and this crate cannot mint one. **Two** things can
/// nevertheless address such a path: the open `Workspace`, which maps every
/// path it *discovered* to an identity, and this queue's own record of every
/// identity it has already put on the wire in this epoch
/// ([`ReconciliationQueue::drain`]). A path in neither is a path this session
/// has handed no identity out for, and inventing one here would put a number on
/// the wire that names nothing.
///
/// Both variants are struct variants, including the one-field arms, so the enum
/// crosses `serde`'s externally tagged representation as a uniform object —
/// `{"Known":{"document":3}}` — which is the rule every wire enum in this
/// application follows (`docs/decisions/2b-2b-3-notes.md` D5).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ObservedDocument {
    /// The open workspace holds this path, or this queue has already put an
    /// identity for it on the wire in this epoch — under this identity.
    ///
    /// Both are `espansoconfig_core::workspace`'s `identity_of` over one
    /// process-wide, path-keyed table — a `Workspace`'s at discovery, the
    /// engine's at projection — so **where the two hold the same path key they
    /// hold the same number**. Nothing in this crate forces that: a
    /// [`DocumentId`] is a plain number and `identity_of` is crate-private to
    /// the core, so this is that table's property restated here rather than a
    /// guarantee of these types.
    Known {
        /// The session-local identity of the file.
        document: DocumentId,
    },
    /// Neither the open workspace nor any identity this queue has issued in
    /// this epoch addresses this path.
    ///
    /// **So the consumer holds nothing under an identity for this file** — this
    /// queue put none on the wire for it — and a display path strands no
    /// projection. The qualification *in this epoch* is the whole of it: a
    /// replacement empties the record with everything else, and an epoch
    /// mismatch is what makes the batch stale rather than this field.
    ///
    /// The path is rendered relative to the configuration root where it lies
    /// beneath it, and whole where it does not. It is display data and never an
    /// address a command accepts back — a [`WirePath`] renders lossily, and
    /// identity is what a caller hands back (`crate::wire_contract`).
    Unknown {
        /// The path, for display only.
        relative_path: WirePath,
    },
}

/// Why this application cannot show a file's text.
///
/// A code plus operands, never a rendered sentence and never a raw
/// `std::io::ErrorKind` (the consult's Q3). It covers **two** engine states
/// deliberately: a path that stably fails to read, and present bytes that are
/// not valid UTF-8. Both mean the same thing to a person — *this file's text is
/// not available* — and this application already refuses to show non-UTF-8
/// bytes anywhere else, since `document_text` answers valid UTF-8 or refuses
/// and never decodes lossily.
///
/// The io arms are a **closed** set over an open one: `std::io::ErrorKind` is
/// `#[non_exhaustive]`, so everything this list does not name arrives as
/// [`UnreadableReason::Other`]. That arm carries no operand on purpose — the
/// kind's own `Debug` spelling is untranslated developer prose, and plan
/// section 9 forbids prose on this wire.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum UnreadableReason {
    /// The bytes on disk are not valid UTF-8.
    NotUtf8 {
        /// Byte offset of the first invalid sequence, as the engine hashed the
        /// exact bytes it found.
        offset: usize,
    },
    /// The operating system refused to read the file.
    PermissionDenied {},
    /// The read failed with invalid data — a symbolic link cycle, say.
    InvalidData {},
    /// The read timed out.
    TimedOut {},
    /// The read was interrupted, twice in a row.
    Interrupted {},
    /// The read failed for a reason this application does not name.
    Other {},
}

impl UnreadableReason {
    /// The reason one stable read failure crosses as.
    ///
    /// Total over an open enum: the wildcard is required rather than lazy,
    /// because `std::io::ErrorKind` is `#[non_exhaustive]` and a match without
    /// one would not compile.
    fn of_io_kind(kind: io::ErrorKind) -> UnreadableReason {
        match kind {
            io::ErrorKind::PermissionDenied => UnreadableReason::PermissionDenied {},
            io::ErrorKind::InvalidData => UnreadableReason::InvalidData {},
            io::ErrorKind::TimedOut => UnreadableReason::TimedOut {},
            io::ErrorKind::Interrupted => UnreadableReason::Interrupted {},
            _ => UnreadableReason::Other {},
        }
    } // End of function of_io_kind()
}

/// One external change, as the frontend meets it.
///
/// A discriminated value, never rendered prose and never a raw
/// `notify::EventKind` (the consult's Q3). Every variant carries the sequence
/// it was admitted under, because *which of these is newest for this document*
/// is the consumer's whole arbitration rule and it may not be recovered from a
/// hash.
///
/// # Why a non-UTF-8 state is not a `Changed`
///
/// The engine reports present-but-not-UTF-8 bytes as content, so a `Changed` or
/// an `Added` can arrive with no text and no projection. Rather than give
/// [`ExternalObservation::Changed`] four optional fields whose absence all mean
/// one thing, such a state crosses as [`ExternalObservation::Unreadable`] with
/// [`UnreadableReason::NotUtf8`]. That keeps `Changed` total — its text and its
/// projection are always present — and it says the true sentence, which is that
/// this application cannot show the file. **It is a deviation from the
/// consult's literal field list**, which gives `Added` an optional projection;
/// `docs/decisions/2d-4a-notes.md` §3 records it and what it costs, which is
/// that a file whose **first** stable observation is non-UTF-8 reaches the
/// window as an unreadable path rather than as a new row: no identity has ever
/// been issued for it, so nothing can address it. A file this queue has already
/// addressed keeps that identity when it later becomes unreadable — see
/// [`ObservedDocument`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ExternalObservation {
    /// A document this application already knew about now stably holds
    /// different bytes.
    Changed {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// The document, as the snapshot itself minted it.
        document: DocumentId,
        /// The last stable revision the engine held, or `None` when it had none.
        ///
        /// **Not a claim that the caller ever saw that revision**, and not an
        /// order: it is what the engine tracked before this reading.
        previous_revision: Option<ContentRevision>,
        /// The revision of the exact bytes now on disk.
        disk_revision: ContentRevision,
        /// Those exact bytes, unchanged. The comparison side of a conflict.
        disk_text: String,
        /// The projection of those same bytes — paired with
        /// [`ExternalObservation::Changed::disk_text`] by construction, since
        /// both come out of one snapshot.
        disk: DocumentView,
        /// The pure semantic report over that projection.
        findings: Vec<Finding>,
        /// Snapshot-bound correspondence evidence from the previously projected
        /// content into this one, or `None` where either side had no
        /// projection.
        ///
        /// The table carries its own two revisions, so a consumer holding a
        /// different base can refuse it. **No `ReapplyAnchor` crosses** — the
        /// anchor is the question, is captured and dropped inside the core, and
        /// is forbidden from crossing IPC; a table holds answers only.
        correspondences: Option<CorrespondenceTable>,
    },
    /// A YAML file the watcher was not tracking stably exists.
    Added {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// The row a sidebar draws, built from the discovered file and the
        /// identity its own projection minted.
        ///
        /// `loaded` is `false`, and truthfully: the backend workspace does not
        /// hold this file at all, so it holds no parse of it either.
        document_summary: DocumentSummary,
        /// The projection of the stabilized bytes.
        disk: DocumentView,
        /// The pure semantic report over that projection.
        findings: Vec<Finding>,
    },
    /// A tracked path is stably gone.
    Removed {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// The document, when the open workspace holds this path.
        document: ObservedDocument,
        /// The last stable revision the engine held, or `None` when it had none.
        previous_revision: Option<ContentRevision>,
    },
    /// A path exists as far as two reads can tell and its text is not available.
    Unreadable {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// The document, when the open workspace holds this path.
        document: ObservedDocument,
        /// Why the text is not available.
        reason: UnreadableReason,
    },
}

impl ExternalObservation {
    /// The sequence this observation was admitted under, whatever its kind.
    ///
    /// One accessor rather than a match at every consumer, for
    /// `Observation::path`'s reason: *which sequence an observation carries* is
    /// one rule.
    pub fn sequence(&self) -> u64 {
        match self {
            ExternalObservation::Changed { sequence, .. }
            | ExternalObservation::Added { sequence, .. }
            | ExternalObservation::Removed { sequence, .. }
            | ExternalObservation::Unreadable { sequence, .. } => *sequence,
        }
    } // End of function sequence()
}

/// What `crate::commands::drain_external_changes` hands back.
///
/// **The authoritative half of the protocol.** A caller compares
/// [`ReconciliationBatch::epoch`] against the workspace it is showing; an epoch
/// mismatch makes the whole batch stale and installs nothing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReconciliationBatch {
    /// The workspace epoch this queue is holding observations for.
    ///
    /// `crate::watch::NO_EPOCH` — zero, never a real epoch — when the session
    /// has adopted none.
    ///
    /// **A drain can see that value**, and it means one specific thing: the open
    /// that installed this workspace found the epoch space exhausted, so it
    /// started `crate::watch::WatcherLifecycle::without_epoch`, which has no
    /// worker and tags nothing. Such a workspace is watched by nothing and its
    /// batch is always empty — that is the open's own policy (a missing watcher
    /// degrades reconciliation, it does not fail the session), and this field is
    /// how it is visible rather than silent. It is unreachable in any physical
    /// execution, as `crate::watch::WorkspaceEpochs` says, and typed rather than
    /// hoped away.
    pub epoch: u64,
    /// The highest sequence in [`ReconciliationBatch::observations`], or — when
    /// the batch is empty — the highest watermark this queue has ever been
    /// drained with, which is **not** necessarily the `after_sequence` of this
    /// call.
    ///
    /// So a caller may store it as its new watermark unconditionally, and no
    /// batch moves that watermark backwards. **The distinction is the
    /// out-of-order drain**, which the 2d design consult's Q7 item 5 requires
    /// Phase 2d-5 to handle: a caller that acknowledged 10 and then drains with
    /// 5 gets 10 back, because answering its own lower argument would walk its
    /// watermark backwards — which is what an earlier draft of this field did.
    pub newest_sequence: u64,
    /// The observations above the caller's watermark, ordered by sequence.
    pub observations: Vec<ExternalObservation>,
    /// How many admitted observations this epoch's queue dropped rather than
    /// held — for **either** of two reasons.
    ///
    /// The queue was at [`QUEUE_CAPACITY`] and its oldest entry made room for a
    /// newer one, or the observation's sequence was at or below the
    /// acknowledged watermark and no later drain could ever have returned it
    /// ([`ReconciliationQueue::enqueue`]). The two are counted together because
    /// they mean the same thing to a consumer and oblige the same response;
    /// naming only the first, which an earlier draft of this field did, was
    /// false about the second.
    ///
    /// **Cumulative within the epoch and monotonic**, so a non-zero value does
    /// not say the loss happened since the previous drain. What it does say is
    /// that this epoch's observation history has a hole in it, so a consumer
    /// must reload the workspace rather than reconcile from these values. Zero
    /// on every ordinary run — and nothing in Phase 2d-4a makes a consumer read
    /// it (`docs/decisions/2d-4a-notes.md` R4).
    pub discarded: u64,
}

/// Where the wake goes.
///
/// An `Arc` so one session's emitter outlives every watcher it starts;
/// `Send + Sync` because the enqueue happens on a watcher's worker thread. It
/// is injected rather than built here so that this module never mentions
/// `tauri` — `crate::events` owns that — and so a test can watch the wakes
/// without a webview.
pub type WakeEmitter = Arc<dyn Fn(ReconciliationWake) + Send + Sync>;

/// The queue's own state, behind one leaf mutex.
struct QueueState {
    /// The workspace epoch these entries belong to.
    epoch: u64,
    /// Undrained observations, keyed by sequence — which is what makes a
    /// drained batch ordered by construction.
    ///
    /// **Every admitted observation this epoch stored, and not the coalesced
    /// form of them.** The coalescing rule is [`coalesced_sequences`], applied
    /// at drain over this whole set; storing the coalesced form here would mean
    /// deciding it over part of the history — see this module's guarantee 3.
    pending: BTreeMap<u64, AdmittedObservation>,
    /// The highest sequence a drain has been told the caller already holds.
    acknowledged: u64,
    /// Every identity this queue has put on the wire in this epoch, against the
    /// path it put it on.
    ///
    /// Written by [`external_observation`] at drain time and read by
    /// [`address_of`] when the open `Workspace` cannot address a path — which
    /// is every path discovered after the workspace was opened.
    ///
    /// **Not the pending set, and it does not shrink with it.** An entry
    /// outlives the acknowledgement of the observation that created it on
    /// purpose: the removal of a file added mid-epoch arrives after that
    /// addition has been acknowledged and dropped, and must still name it.
    /// [`QueueState::empty`] is what empties this, so an identity never crosses
    /// an epoch.
    ///
    /// **Unbounded within one epoch.** It holds one `PathBuf` and one
    /// [`DocumentId`] per distinct path this epoch has put an identity on the
    /// wire for, and nothing caps that number: not [`QUEUE_CAPACITY`], which
    /// bounds only the pending set, and not any other rule here. A long-lived
    /// epoch that keeps drawing observations for newly created paths keeps
    /// growing this map while `pending` stays at 256. Only
    /// [`QueueState::empty`] — a workspace replacement — clears it.
    ///
    /// Evicting from it would restore exactly the stranding it exists to close,
    /// so it is not evicted from. What it duplicates is real and worth naming
    /// rather than reassuring about: `espansoconfig_core::workspace`'s
    /// process-wide, path-keyed identity table already retains every path it
    /// has minted an identity for, for the life of the process, so this adds no
    /// new class of retained address — it adds a **second** copy of the same
    /// path on a path that runs at every drain. **Measured by nothing**;
    /// `docs/decisions/2d-4a-notes.md` R9 carries it as a residue.
    issued_identities: BTreeMap<PathBuf, DocumentId>,
    /// How many entries this epoch dropped rather than held, for capacity or
    /// for arriving at or below the acknowledged watermark — the two causes
    /// [`ReconciliationBatch::discarded`] states.
    discarded: u64,
}

impl QueueState {
    /// An empty state for `epoch`.
    fn empty(epoch: u64) -> QueueState {
        QueueState {
            epoch,
            pending: BTreeMap::new(),
            acknowledged: 0,
            issued_identities: BTreeMap::new(),
            discarded: 0,
        }
    }

    /// The wake an enqueue owes: this epoch, and the highest sequence this
    /// queue now holds undrained.
    ///
    /// Its one call site — [`ReconciliationQueue::enqueue`] — reaches it having
    /// just inserted, so the pending set is never empty here and the fallback
    /// is unreachable. It is [`QueueState::acknowledged`] rather than a zero
    /// that would name a sequence nobody minted.
    ///
    /// **The highest sequence pending and never the sequence that arrived.**
    /// An arrival that is older than something already here is a real case (see
    /// [`ReconciliationQueue::enqueue`]), and a wake naming it would tell the
    /// window less than the queue holds.
    fn owed_wake(&self) -> ReconciliationWake {
        ReconciliationWake {
            workspace_epoch: self.epoch,
            newest_sequence: self
                .pending
                .keys()
                .next_back()
                .copied()
                .unwrap_or(self.acknowledged),
        }
    } // End of function owed_wake()
} // End of impl QueueState

/// Which of `pending`'s entries a batch carries — **the whole coalescing rule,
/// in one place**.
///
/// Take one path's entries in sequence order. A **maximal run of them asserting
/// one `crate::ledger::ObservedState`** contributes exactly one sequence to the
/// answer: the **highest** in the run. So an entry that is the only member of
/// its run is always in the answer, and an entry below the top of a longer run
/// never is.
///
/// Three properties, each chosen against an alternative that this phase's
/// review found shipped:
///
/// - **Adjacency is in sequence order and never in arrival order.** A state that
///   returns after a different one — `A`, then `B`, then `A` — is two `A`
///   observations, because neither `A` is adjacent to the other: the file
///   genuinely held `B` in between. Comparing an arrival against the single
///   *highest* pending entry for its path cannot see that, and round 2 of this
///   phase's review showed it both dropping an `A` that was no repeat and
///   leaving a real repeat uncoalesced.
/// - **It is a pure function of the pending set**, so the order two threads
///   reached [`ReconciliationQueue::enqueue`] in cannot change its answer. That
///   is why it runs at drain and not at enqueue: an enqueue decides over the
///   history *so far*, and an arrival that later lands between two entries an
///   enqueue folded together cannot un-fold them.
/// - **It compares `crate::ledger::ObservedState`**, so `Absent` never equals
///   `Content(_)` and a removal followed by a recreation at identical bytes is
///   two observations — the consult's Q3, true by construction rather than by a
///   special case.
///
/// The highest pending sequence is always in the answer: it is the last entry of
/// its own path's last run. [`ReconciliationQueue::drain`] relies on that for
/// [`ReconciliationBatch::newest_sequence`].
fn coalesced_sequences(pending: &BTreeMap<u64, AdmittedObservation>) -> BTreeSet<u64> {
    let mut carried: BTreeSet<u64> = pending.keys().copied().collect();
    // The last entry seen for each path, which is the only one a new entry for
    // that path can be sequence-adjacent to, because this walk is in sequence
    // order.
    let mut previous: BTreeMap<&Path, (u64, ObservedState)> = BTreeMap::new();
    for (sequence, entry) in pending {
        let path = entry.observation.path();
        let state = observed_state(&entry.observation);
        if let Some((earlier, earlier_state)) = previous.get(path) {
            if *earlier_state == state {
                carried.remove(earlier);
            }
        }
        previous.insert(path, (*sequence, state));
    } // End of the walk that folds each path's runs onto their highest sequence
    carried
} // End of function coalesced_sequences()

/// The typed, ordered, coalescing queue that sits behind the open workspace
/// session.
///
/// One per session, shared with the sink the watcher's worker calls. See this
/// module's documentation for the four things it guarantees and the five it
/// does not.
pub struct ReconciliationQueue {
    state: Mutex<QueueState>,
    wake: Mutex<Option<WakeEmitter>>,
}

impl std::fmt::Debug for ReconciliationQueue {
    /// Hand-written because an emitter is a closure with no `Debug` of its own.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let guard = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        formatter
            .debug_struct("ReconciliationQueue")
            .field("epoch", &guard.epoch)
            .field("pending", &guard.pending.len())
            .field("discarded", &guard.discarded)
            .finish_non_exhaustive()
    } // End of function fmt()
}

impl Default for ReconciliationQueue {
    /// [`ReconciliationQueue::new`], as a trait for whoever asks through one.
    fn default() -> ReconciliationQueue {
        ReconciliationQueue::new()
    }
}

impl ReconciliationQueue {
    /// An empty queue holding no epoch.
    ///
    /// [`crate::watch::NO_EPOCH`] is zero and is never a real epoch, so every
    /// enqueue is refused until the session adopts one through
    /// [`ReconciliationQueue::begin_epoch`].
    pub fn new() -> ReconciliationQueue {
        ReconciliationQueue {
            state: Mutex::new(QueueState::empty(NO_EPOCH)),
            wake: Mutex::new(None),
        }
    }

    /// Installs the emitter every later enqueue wakes the window through.
    ///
    /// Separate from construction because the session is built before the Tauri
    /// application handle exists — `crate::main`'s `register` manages the
    /// session and then installs this in `setup`. Until it is installed an
    /// enqueue still happens and simply wakes nobody, which is the same
    /// position a dropped event leaves the window in: the observation is in the
    /// queue, and a drain would return it. **What no code in Phase 2d-4a does
    /// is call that drain** — see [`ReconciliationQueue::wake`].
    pub fn install_wake_emitter(&self, emitter: WakeEmitter) {
        *self.wake.lock().unwrap_or_else(PoisonError::into_inner) = Some(emitter);
    }

    /// Adopts `epoch` and discards everything the previous one held.
    ///
    /// Called from `crate::commands::WorkspaceSession::open`, beside
    /// `crate::ledger::WriteLedger::begin_epoch` and under the same session
    /// lock, so the successor watcher's first observation cannot meet an epoch
    /// this queue has not yet adopted. Discarding is not tidiness: a sequence
    /// means nothing across epochs, and a document identity survives a
    /// replacement, so an entry kept across one could describe a different
    /// directory's file.
    ///
    /// **Everything** means the pending set, the acknowledged watermark, the
    /// loss count *and* the record of identities already put on the wire, for
    /// that same reason: one path in two epochs is two files, so an address
    /// carried across a replacement would name the wrong one. It is one
    /// assignment of a fresh [`QueueState`] rather than four clears, which is
    /// what keeps a field added later from being the one nobody remembered to
    /// reset.
    pub fn begin_epoch(&self, epoch: u64) {
        *self.state.lock().unwrap_or_else(PoisonError::into_inner) = QueueState::empty(epoch);
    }

    /// Takes one admitted observation, and says whether a wake is owed.
    ///
    /// Returns `None` — and stores nothing — in exactly the two cases that
    /// could not reach a consumer:
    ///
    /// - the observation carries an epoch this queue is not holding, which
    ///   makes it stale by the consult's Q3 whatever it says. It is **not**
    ///   counted as a loss: a replaced workspace's observation is not this
    ///   workspace's history. **This arm is a fence in its own right and not a
    ///   second copy of the ledger's**: the two epoch resets are separate leaf
    ///   mutexes taken one after the other inside one session-lock block, so an
    ///   observation admitted just before the ledger's reset can reach this
    ///   function after the queue's — having already passed the ledger's check,
    ///   and finding a queue that has moved on. Nothing else stops that one.
    ///   `docs/decisions/2d-4a-notes.md` §4 enumerates the interleavings;
    /// - its sequence is at or below the caller's acknowledged watermark, so no
    ///   later drain could ever return it. It **is** counted in
    ///   [`ReconciliationBatch::discarded`], because it is a loss rather than a
    ///   duplicate. **Nothing in the present pipeline produces one**: within one
    ///   epoch exactly one thread — the watcher's worker — reaches the gate's
    ///   downstream sink, so sequences arrive in order. Nothing in the types
    ///   forces that, which is why the case is handled rather than asserted
    ///   away.
    ///
    /// One case more owes a wake like any other and is not a refusal:
    ///
    /// - **a full queue**: the **oldest** entry is dropped and counted in
    ///   [`ReconciliationBatch::discarded`]. That entry may be its document's
    ///   only state, so this is a real loss and never a tidying — see
    ///   [`QUEUE_CAPACITY`].
    ///
    /// **Coalescing is not decided here**, and that is this function's one
    /// deliberate omission. An arrival that repeats what a pending entry
    /// asserts is stored beside it and folded out of a *batch* by
    /// [`coalesced_sequences`], because the fold is a decision over a whole
    /// history and an enqueue holds only the history so far: an observation
    /// that arrives later between two entries an enqueue had folded together
    /// cannot un-fold them, and that is how the previous rewrite dropped an
    /// observation that was no repeat in sequence order. An arrival **older**
    /// than entries already pending is therefore stored like any other; nothing
    /// in the present pipeline produces one, since one worker thread per epoch
    /// reaches the gate's downstream sink, and it is handled rather than
    /// asserted away because the guarantee Q3 states is unconditional.
    ///
    /// **Two observations at one sequence cannot arise**, so the pending map's
    /// key collision has no case: `crate::ledger`'s allocator mints each
    /// sequence once within an epoch. Were one ever to, the later arrival would
    /// replace the earlier and no `discarded` would count it — the position
    /// before the coalescing rule moved, and forced by nothing in the types.
    pub fn enqueue(&self, admitted: AdmittedObservation) -> Option<ReconciliationWake> {
        let mut guard = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        if admitted.epoch != guard.epoch {
            return None;
        }
        if admitted.sequence <= guard.acknowledged {
            guard.discarded += 1;
            return None;
        }
        while guard.pending.len() >= QUEUE_CAPACITY {
            let Some(oldest) = guard.pending.keys().next().copied() else {
                break;
            };
            guard.pending.remove(&oldest);
            guard.discarded += 1;
        } // End of the loop that makes room for one more entry
        guard.pending.insert(admitted.sequence, admitted);
        Some(guard.owed_wake())
    } // End of function enqueue()

    /// Emits `wake`, with no lock of this queue held.
    ///
    /// The emitter is caller-supplied code — it reaches `tauri`'s event system
    /// — so it may not run under the state mutex.
    ///
    /// **A failure to emit is deliberately dropped**, because the event is a
    /// hint and the drain command is the authority: the protocol's whole
    /// recovery from a lost wake is that the consumer drains again, and the 2d
    /// design consult's Q3 puts that obligation — a drain after listener
    /// registration, after an open completes, and on foreground or resume — on
    /// the frontend coordinator.
    ///
    /// **No such drain exists in Phase 2d-4a.** No frontend code can call the
    /// command until 2d-4b declares it, and 2d-5 is what orchestrates the three
    /// drains, so a wake dropped today is recovered by nobody. The paragraph
    /// above says what a consumer *will be obliged* to do; an earlier draft of
    /// it said what one does, in the present tense, and that was false.
    pub fn wake(&self, wake: ReconciliationWake) {
        let emitter = self
            .wake
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone();
        if let Some(emitter) = emitter {
            emitter(wake);
        }
    } // End of function wake()

    /// Everything above `after_sequence`, coalesced, in sequence order, as wire
    /// values.
    ///
    /// `after_sequence` is an **acknowledgement watermark, not a cursor**:
    /// every pending entry at or below it is removed, everything above it is
    /// kept, and what is returned is [`coalesced_sequences`]'s answer over what
    /// was kept. **This is where the coalescing rule is applied**, over the
    /// complete pending set rather than over one arrival's view of it — see
    /// that function for why the choice of place is the rule's correctness and
    /// not an implementation detail. An entry the fold does not carry stays
    /// pending and holds its slot against [`QUEUE_CAPACITY`]: it is folded out
    /// of the batch, never out of the queue, and never counted in
    /// [`ReconciliationBatch::discarded`], because what it asserts crosses under
    /// a higher sequence.
    ///
    /// A caller that drains twice with the same watermark therefore receives
    /// the same batch twice **when nothing was enqueued between the two
    /// calls** — the answer is a function of the pending set and this call
    /// consumes nothing from it — so an answer lost between Rust and the window
    /// costs no more than the drain that repeats it. An enqueue in between adds
    /// to the second batch, which is what a queue is for and not an exception
    /// to the rule.
    ///
    /// [`ReconciliationBatch::newest_sequence`] is never below the highest
    /// watermark this queue has been drained with, so a drain that arrives out
    /// of order cannot walk a caller's watermark backwards.
    ///
    /// `workspace` is what turns a watched path into an address — and this is
    /// also where an address is **recorded**: every identity that crosses here
    /// is remembered against its path, so a file added after the workspace was
    /// opened can still be addressed when it is later removed or becomes
    /// unreadable. It is the open workspace, so this runs under the session lock
    /// and takes this queue's mutex below it — the one order that exists here.
    pub fn drain(&self, after_sequence: u64, workspace: &Workspace) -> ReconciliationBatch {
        let mut guard = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        guard.acknowledged = guard.acknowledged.max(after_sequence);
        guard
            .pending
            .retain(|sequence, _| *sequence > after_sequence);
        // Split into disjoint borrows so the projection can read the pending set
        // and write the identity record in one pass: an addition and the
        // removal of the same path can share a batch, and the removal is
        // addressed by what the addition just recorded.
        let QueueState {
            epoch,
            pending,
            acknowledged,
            issued_identities,
            discarded,
        } = &mut *guard;
        let carried = coalesced_sequences(pending);
        let observations: Vec<ExternalObservation> = pending
            .iter()
            .filter(|(sequence, _)| carried.contains(sequence))
            .map(|(_, admitted)| external_observation(admitted, workspace, issued_identities))
            .collect();
        // The batch's own highest — which is also the highest *pending*
        // sequence, since `coalesced_sequences` always carries that entry — and
        // never below the highest watermark this queue has been acknowledged
        // with. The `max` is what makes `newest_sequence`'s claim a property of
        // this function rather than of an invariant elsewhere: every pending
        // entry is above `acknowledged` today, because `enqueue` refuses at or
        // below it and a drain only removes — but nothing in the types forces
        // that, and an empty batch has no entry to be above anything at all.
        let newest_sequence = observations
            .last()
            .map(ExternalObservation::sequence)
            .unwrap_or(*acknowledged)
            .max(*acknowledged);
        ReconciliationBatch {
            epoch: *epoch,
            newest_sequence,
            observations,
            discarded: *discarded,
        }
    } // End of function drain()

    /// The epoch this queue is holding observations for — an observability
    /// accessor, never a control surface (`PROGRESS.md` R24).
    #[cfg(test)]
    pub(crate) fn epoch(&self) -> u64 {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .epoch
    }

    /// How many undrained entries this queue holds — an observability
    /// accessor.
    #[cfg(test)]
    pub(crate) fn pending(&self) -> usize {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .pending
            .len()
    }
} // End of impl ReconciliationQueue

/// The downstream sink that puts admitted observations in `queue` and wakes the
/// window.
///
/// **The production sink**, installed by every ordinary
/// `crate::commands::WorkspaceSession`. Until Phase 2d-4a this position held a
/// sink that dropped its argument, so a sequence and a publication were spent
/// on a value nothing could recover; this is what recovers it.
///
/// The wake happens **after** the enqueue and outside the queue's mutex, so a
/// window that drains the instant it hears one finds the observation already
/// there. What the types do not force is that a caller of the drain acts on
/// what it gets, nor that the emitter installed reaches a live webview.
pub fn queueing_sink(queue: Arc<ReconciliationQueue>) -> AdmittedSink {
    Arc::new(move |admitted: AdmittedObservation| {
        if let Some(wake) = queue.enqueue(admitted) {
            queue.wake(wake);
        }
    })
}

/// One admitted observation, as the wire meets it.
///
/// The whole projection into wire form, in one place, so no consumer builds a
/// second one. It clones out of the queued value rather than consuming it,
/// because a drain consumes nothing: an entry survives its own drain, and
/// leaves the queue only when a later drain acknowledges it or an overflow
/// evicts it ([`QUEUE_CAPACITY`]).
///
/// `issued` is this epoch's record of what has been addressed, and this function
/// is its **only** writer: every arm that puts a [`DocumentId`] on the wire
/// records it against the path it belongs to first, so that a later observation
/// of that same path — which carries a path and no identity — can be addressed
/// by [`address_of`]. Writing it here rather than at the call site is what makes
/// *every identity that crosses is remembered* true by construction: a variant
/// added later cannot cross without passing through this match.
fn external_observation(
    admitted: &AdmittedObservation,
    workspace: &Workspace,
    issued: &mut BTreeMap<PathBuf, DocumentId>,
) -> ExternalObservation {
    let sequence = admitted.sequence;
    match &admitted.observation {
        Observation::Changed {
            path,
            previous_revision,
            content,
            correspondences,
        } => match content {
            StableContent::Projected { snapshot, findings } => {
                issued.insert(path.clone(), snapshot.id);
                ExternalObservation::Changed {
                    sequence,
                    document: snapshot.id,
                    previous_revision: *previous_revision,
                    disk_revision: snapshot.revision,
                    disk_text: snapshot.source.clone(),
                    disk: snapshot.view.clone(),
                    findings: findings.clone(),
                    correspondences: correspondences.clone(),
                }
            }
            StableContent::NotUtf8 { offset, .. } => ExternalObservation::Unreadable {
                sequence,
                document: address_of(path, workspace, issued),
                reason: UnreadableReason::NotUtf8 { offset: *offset },
            },
        },
        Observation::Added { file, content } => match content {
            StableContent::Projected { snapshot, findings } => {
                issued.insert(file.path.clone(), snapshot.id);
                ExternalObservation::Added {
                    sequence,
                    document_summary: summary_of(snapshot.id, file),
                    disk: snapshot.view.clone(),
                    findings: findings.clone(),
                }
            }
            StableContent::NotUtf8 { offset, .. } => ExternalObservation::Unreadable {
                sequence,
                document: address_of(&file.path, workspace, issued),
                reason: UnreadableReason::NotUtf8 { offset: *offset },
            },
        },
        Observation::Removed {
            path,
            previous_revision,
        } => ExternalObservation::Removed {
            sequence,
            document: address_of(path, workspace, issued),
            previous_revision: *previous_revision,
        },
        Observation::Unreadable { path, kind } => ExternalObservation::Unreadable {
            sequence,
            document: address_of(path, workspace, issued),
            reason: UnreadableReason::of_io_kind(*kind),
        },
    } // End of the match over every observation kind the engine can produce
} // End of function external_observation()

/// The address one watched path crosses as.
///
/// The open workspace first, then `issued` — this epoch's record of every
/// identity already put on the wire, which is the only thing that can address a
/// file created after the workspace was opened. **The order changes no answer**:
/// both are `espansoconfig_core::workspace`'s one process-wide, path-keyed
/// identity table, so where both hold the same path key they hold the same
/// number, and where they do not, one of them simply has none. The workspace is
/// asked first only because it is the authority on what this session
/// discovered. Nothing here forces the agreement — see [`ObservedDocument`].
///
/// `Unknown` is therefore exactly *this session handed no identity out for this
/// path in this epoch*, which is what makes a display path here strand no
/// projection. What it is not is a promise across epochs: a replacement empties
/// the record, and an epoch mismatch is what makes such a batch stale.
fn address_of(
    path: &Path,
    workspace: &Workspace,
    issued: &BTreeMap<PathBuf, DocumentId>,
) -> ObservedDocument {
    match workspace
        .document_id(path)
        .or_else(|| issued.get(path).copied())
    {
        Some(document) => ObservedDocument::Known { document },
        None => ObservedDocument::Unknown {
            relative_path: WirePath::from(
                path.strip_prefix(workspace.root())
                    .unwrap_or(path)
                    .to_path_buf(),
            ),
        },
    }
} // End of function address_of()

/// The sidebar row one newly discovered file crosses as.
///
/// A local copy of the shape `espansoconfig_core::workspace` builds for a
/// discovered file, because that function is private there and this file is not
/// in the workspace's entry list at all — which is also why `loaded` is `false`
/// and truthfully so.
fn summary_of(id: DocumentId, file: &DiscoveredFile) -> DocumentSummary {
    DocumentSummary {
        id,
        path: WirePath::from(file.path.clone()),
        relative_path: WirePath::from(file.relative_path.clone()),
        kind: file.kind,
        disabled: file.disabled,
        read_only: file.kind.is_read_only(),
        loaded: false,
    }
} // End of function summary_of()

#[cfg(test)]
mod tests {
    use super::*;

    use std::sync::mpsc::channel;

    use espansoconfig_core::discovery::FileKind;
    use espansoconfig_core::model::DocumentContext;
    use espansoconfig_core::watch::engine::{
        EngineConfig, FsWatchSource, Millis, ObservationEngine,
    };
    use espansoconfig_core::workspace::project_source;
    use espansoconfig_core::SourceDocument;

    use crate::ledger::{admitting_sink, WriteLedger};
    use crate::watch::{EpochObservation, ObservationOutcome};

    /// A neutral, hand-authored document (CLAUDE.md section 1).
    const ONE: &str = "matches:\n  - trigger: ':one'\n    replace: alpha\n";

    /// A second one, differing from [`ONE`] in one scalar.
    const TWO: &str = "matches:\n  - trigger: ':one'\n    replace: beta\n";

    /// Projects a source string as a detached snapshot at `path`.
    fn snapshot(path: &str, source: &str) -> SourceDocument {
        project_source(&DocumentContext::detached(DocumentId(7), path), source)
    }

    /// One admitted `Changed` observation, with no correspondence evidence.
    fn changed(sequence: u64, epoch: u64, path: &str, source: &str) -> AdmittedObservation {
        AdmittedObservation {
            sequence,
            epoch,
            observation: Observation::Changed {
                path: PathBuf::from(path),
                previous_revision: None,
                content: StableContent::Projected {
                    snapshot: Box::new(snapshot(path, source)),
                    findings: Vec::new(),
                },
                correspondences: None,
            },
        }
    } // End of function changed()

    /// One admitted `Removed` observation.
    fn removed(sequence: u64, epoch: u64, path: &str) -> AdmittedObservation {
        AdmittedObservation {
            sequence,
            epoch,
            observation: Observation::Removed {
                path: PathBuf::from(path),
                previous_revision: None,
            },
        }
    }

    /// One admitted `Added` observation.
    fn added(sequence: u64, epoch: u64, path: &str, source: &str) -> AdmittedObservation {
        AdmittedObservation {
            sequence,
            epoch,
            observation: Observation::Added {
                file: DiscoveredFile {
                    path: PathBuf::from(path),
                    kind: FileKind::MatchFile,
                    relative_path: PathBuf::from(path),
                    disabled: false,
                },
                content: StableContent::Projected {
                    snapshot: Box::new(snapshot(path, source)),
                    findings: Vec::new(),
                },
            },
        }
    } // End of function added()

    /// The sequence and the exact text of every observation in a batch.
    ///
    /// What an assertion about coalescing has to compare, because a length
    /// alone cannot tell `A, B, A` from `B, A` — round 2 of this phase's review
    /// found a rewrite that dropped the first `A` while keeping the count
    /// plausible. Every observation a coalescing test enqueues is a `Changed`,
    /// so the panic arm is a wrong-test guard rather than a case.
    fn sequences_and_text(batch: &ReconciliationBatch) -> Vec<(u64, String)> {
        batch
            .observations
            .iter()
            .map(|observation| match observation {
                ExternalObservation::Changed {
                    sequence,
                    disk_text,
                    ..
                } => (*sequence, disk_text.clone()),
                other => panic!("this batch holds only Changed observations: {other:?}"),
            })
            .collect()
    } // End of function sequences_and_text()

    /// A workspace over a directory that holds nothing, for the drains whose
    /// subject is order rather than address.
    fn empty_workspace() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::TempDir::new().expect("a temporary directory");
        std::fs::create_dir_all(dir.path().join("match")).expect("the match directory");
        let workspace = Workspace::discover(Some(dir.path())).expect("an empty workspace opens");
        (dir, workspace)
    }

    /// A queue already holding epoch 1 — every test's starting point, because a
    /// queue with no epoch stores nothing.
    fn queue_at_epoch(epoch: u64) -> ReconciliationQueue {
        let queue = ReconciliationQueue::new();
        queue.begin_epoch(epoch);
        queue
    }

    #[test]
    fn a_drained_batch_is_ordered_by_sequence_whatever_order_it_arrived_in() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        // Deliberately out of arrival order: the pending set is keyed by the
        // sequence, so the order below is the keys' and not the arrivals'.
        queue.enqueue(changed(9, 1, "match/c.yml", ONE));
        queue.enqueue(changed(3, 1, "match/a.yml", ONE));
        queue.enqueue(changed(5, 1, "match/b.yml", ONE));
        let batch = queue.drain(0, &workspace);
        let sequences: Vec<u64> = batch
            .observations
            .iter()
            .map(ExternalObservation::sequence)
            .collect();
        assert_eq!(sequences, vec![3, 5, 9]);
        assert_eq!(batch.newest_sequence, 9);
        assert_eq!(batch.epoch, 1);
        assert_eq!(batch.discarded, 0);
    } // End of function a_drained_batch_is_ordered_by_sequence_whatever_order_it_arrived_in()

    #[test]
    fn a_repeat_of_one_paths_state_coalesces_onto_the_newer_sequence() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        queue.enqueue(changed(2, 1, "match/a.yml", ONE));
        // Both are stored: the fold is a property of the batch and not of the
        // queue, so a repeat holds its slot until a drain acknowledges it.
        assert_eq!(queue.pending(), 2);
        let batch = queue.drain(0, &workspace);
        assert_eq!(
            batch.observations.len(),
            1,
            "one path at one state is one \
             observation: {batch:?}"
        );
        assert_eq!(batch.observations[0].sequence(), 2, "the newer number wins");
        assert_eq!(batch.discarded, 0, "a fold is never a loss");
    } // End of function a_repeat_of_one_paths_state_coalesces_onto_the_newer_sequence()

    #[test]
    fn two_revisions_of_one_path_are_two_entries() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        queue.enqueue(changed(2, 1, "match/a.yml", TWO));
        let batch = queue.drain(0, &workspace);
        assert_eq!(
            batch.observations.len(),
            2,
            "differing bytes are not a repeat: {batch:?}"
        );
    }

    #[test]
    fn a_removal_and_a_recreation_at_identical_bytes_are_two_observations() {
        // The consult's Q3, and the one coalescing case that would be wrong:
        // file membership changed, so the equal hashes decide nothing.
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        queue.enqueue(removed(2, 1, "match/a.yml"));
        queue.enqueue(added(3, 1, "match/a.yml", ONE));
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.observations.len(), 3, "{batch:?}");
        assert!(matches!(
            batch.observations[1],
            ExternalObservation::Removed { .. }
        ));
        assert!(matches!(
            batch.observations[2],
            ExternalObservation::Added { .. }
        ));
    } // End of function a_removal_and_a_recreation_at_identical_bytes_are_two_observations()

    #[test]
    fn an_observation_from_another_epoch_is_stored_and_woken_for_by_nothing() {
        let queue = queue_at_epoch(2);
        assert!(queue.enqueue(changed(1, 1, "match/a.yml", ONE)).is_none());
        assert_eq!(queue.pending(), 0);
        // And a queue that has adopted no epoch at all stores nothing either.
        let fresh = ReconciliationQueue::new();
        assert_eq!(fresh.epoch(), NO_EPOCH);
        assert!(fresh.enqueue(changed(1, 1, "match/a.yml", ONE)).is_none());
        assert_eq!(fresh.pending(), 0);
    } // End of function an_observation_from_another_epoch_is_stored_and_woken_for_by_nothing()

    #[test]
    fn adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        queue.begin_epoch(2);
        assert_eq!(queue.pending(), 0);
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.epoch, 2);
        assert!(batch.observations.is_empty());
        assert_eq!(batch.discarded, 0);
    } // End of function adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses()

    #[test]
    fn a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        queue.enqueue(changed(2, 1, "match/b.yml", ONE));
        // Nothing acknowledged: both come back, and both stay.
        let first = queue.drain(0, &workspace);
        assert_eq!(first.observations.len(), 2);
        // The same watermark twice answers the same batch — the answer is not a
        // one-shot cursor, so an answer lost on the way to the window costs no
        // more than the drain that repeats it. Nothing is enqueued between the
        // two calls, which is the qualification the guarantee carries: an
        // enqueue in between belongs in the second batch.
        let again = queue.drain(0, &workspace);
        assert_eq!(again, first);
        // Acknowledging the first drops it and keeps the second.
        let third = queue.drain(1, &workspace);
        assert_eq!(third.observations.len(), 1);
        assert_eq!(third.observations[0].sequence(), 2);
        assert_eq!(queue.pending(), 1);
    } // End of function a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not()

    #[test]
    fn a_repeat_that_arrives_after_a_higher_sequence_coalesces_onto_it_rather_than_beside_it() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        // The out-of-arrival-order half of the coalescing rule: sequence 9
        // reaches the queue before sequence 3 for the same path and the same
        // state. The guarantee is unconditional, so this is one entry.
        queue.enqueue(changed(9, 1, "match/a.yml", ONE));
        let wake = queue
            .enqueue(changed(3, 1, "match/a.yml", ONE))
            .expect("a coalesced repeat owes a wake like any other");
        assert_eq!(
            wake.newest_sequence, 9,
            "the wake names what the queue holds, never what arrived"
        );
        assert_eq!(
            queue.pending(),
            2,
            "an older arrival is stored like any other — the fold is the batch's"
        );
        let batch = queue.drain(0, &workspace);
        assert_eq!(
            batch.observations.len(),
            1,
            "one path at one state is one observation, whichever order the two arrived in: {batch:?}"
        );
        assert_eq!(
            batch.observations[0].sequence(),
            9,
            "the higher of the two sequences survives"
        );
        assert_eq!(
            batch.discarded, 0,
            "an older repeat is coalesced, never counted as a loss"
        );
    } // End of function a_repeat_that_arrives_after_a_higher_sequence_coalesces_onto_it_rather_than_beside_it()

    #[test]
    fn a_state_that_returns_after_another_one_is_two_entries_whatever_order_they_arrive_in() {
        // Round 2's first counterexample, and the one that made the previous
        // rewrite a correctness defect rather than a wording one. The
        // sequence-order history is A(3), B(5), A(9): the two A observations
        // are not adjacent among this path's entries, so neither is a repeat of
        // the other and **both** cross. Comparing an arrival against the single
        // highest pending entry dropped A(3) as a repeat of A(9) before B(5)
        // had arrived to separate them, and nothing could put it back.
        let expected = vec![
            (3, ONE.to_string()),
            (5, TWO.to_string()),
            (9, ONE.to_string()),
        ];
        for arrival in [[9u64, 3, 5], [3, 5, 9], [5, 9, 3]] {
            let queue = queue_at_epoch(1);
            let (_dir, workspace) = empty_workspace();
            for sequence in arrival {
                let source = if sequence == 5 { TWO } else { ONE };
                queue.enqueue(changed(sequence, 1, "match/a.yml", source));
            } // End of the loop that feeds one arrival order to the queue
            let batch = queue.drain(0, &workspace);
            assert_eq!(
                sequences_and_text(&batch),
                expected,
                "arrival order {arrival:?} answered {batch:?}"
            );
            assert_eq!(
                batch.discarded, 0,
                "nothing here is a loss: arrival order {arrival:?}"
            );
        } // End of the loop over the three arrival orders of A(3), B(5), A(9)
    } // End of function a_state_that_returns_after_another_one_is_two_entries_whatever_order_they_arrive_in()

    #[test]
    fn a_sequence_adjacent_repeat_coalesces_whatever_order_it_arrives_in() {
        // Round 2's second counterexample. The sequence-order history is B(3),
        // B(5), A(9): 3 and 5 are adjacent among this path's entries and assert
        // one state, so they fold onto the higher of the two, and A(9) stands
        // alone. Comparing an arrival against the single highest pending entry
        // saw A(9) when B(3) arrived, found no repeat, and left the batch
        // ordered and **not** coalesced.
        let expected = vec![(5, TWO.to_string()), (9, ONE.to_string())];
        for arrival in [[9u64, 5, 3], [3, 5, 9], [5, 3, 9]] {
            let queue = queue_at_epoch(1);
            let (_dir, workspace) = empty_workspace();
            for sequence in arrival {
                let source = if sequence == 9 { ONE } else { TWO };
                queue.enqueue(changed(sequence, 1, "match/a.yml", source));
            } // End of the loop that feeds one arrival order to the queue
            let batch = queue.drain(0, &workspace);
            assert_eq!(
                sequences_and_text(&batch),
                expected,
                "arrival order {arrival:?} answered {batch:?}"
            );
            assert_eq!(
                batch.discarded, 0,
                "a coalesced repeat is never a loss: arrival order {arrival:?}"
            );
        } // End of the loop over the three arrival orders of B(3), B(5), A(9)
    } // End of function a_sequence_adjacent_repeat_coalesces_whatever_order_it_arrives_in()

    #[test]
    fn an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(10, 1, "match/a.yml", ONE));
        let acknowledged = queue.drain(10, &workspace);
        assert!(acknowledged.observations.is_empty());
        assert_eq!(acknowledged.newest_sequence, 10);
        // The 2d design consult's Q7 item 5 requires 2d-5 to handle out-of-order
        // drains, so this is a path that will be exercised. A caller that stores
        // `newest_sequence` unconditionally — which the field's own
        // documentation tells it to — must not be walked back to 5.
        let late = queue.drain(5, &workspace);
        assert!(late.observations.is_empty());
        assert_eq!(
            late.newest_sequence, 10,
            "an empty batch answers the highest watermark, never the caller's lower argument"
        );
    } // End of function an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument()

    #[test]
    fn an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        // A file created after the workspace was opened: the workspace does not
        // hold it, so the addition is the only place its identity ever crossed.
        queue.enqueue(added(1, 1, "match/new.yml", ONE));
        let first = queue.drain(0, &workspace);
        let ExternalObservation::Added {
            document_summary, ..
        } = &first.observations[0]
        else {
            panic!("a new file is Added: {first:?}");
        };
        let issued = document_summary.id;
        // That addition acknowledged, the same file becomes unreadable and then
        // goes away. Both carry a path and no identity, and both must name what
        // the addition named — otherwise the consumer holds a projection under
        // an identity nothing can tell it to invalidate.
        queue.enqueue(AdmittedObservation {
            sequence: 2,
            epoch: 1,
            observation: Observation::Changed {
                path: PathBuf::from("match/new.yml"),
                previous_revision: None,
                content: StableContent::NotUtf8 {
                    revision: ContentRevision::of_bytes(&[0xff, 0xfe]),
                    offset: 0,
                },
                correspondences: None,
            },
        });
        queue.enqueue(removed(3, 1, "match/new.yml"));
        let second = queue.drain(1, &workspace);
        let addresses: Vec<&ObservedDocument> = second
            .observations
            .iter()
            .map(|observation| match observation {
                ExternalObservation::Unreadable { document, .. }
                | ExternalObservation::Removed { document, .. } => document,
                other => panic!("a path-only observation is Unreadable or Removed: {other:?}"),
            })
            .collect();
        assert_eq!(
            addresses,
            vec![
                &ObservedDocument::Known { document: issued },
                &ObservedDocument::Known { document: issued },
            ],
            "an identity this queue has issued addresses its path afterwards: {second:?}"
        );
    } // End of function an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot()

    #[test]
    fn an_identity_issued_in_one_epoch_addresses_nothing_in_the_next() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(added(1, 1, "match/new.yml", ONE));
        let first = queue.drain(0, &workspace);
        assert!(matches!(
            first.observations[0],
            ExternalObservation::Added { .. }
        ));
        // A replacement empties the record with everything else: an epoch is a
        // different workspace, and one path in two of them is two files.
        queue.begin_epoch(2);
        queue.enqueue(removed(1, 2, "match/new.yml"));
        let second = queue.drain(0, &workspace);
        assert_eq!(second.epoch, 2);
        assert!(
            matches!(
                second.observations[0],
                ExternalObservation::Removed {
                    document: ObservedDocument::Unknown { .. },
                    ..
                }
            ),
            "{second:?}"
        );
    } // End of function an_identity_issued_in_one_epoch_addresses_nothing_in_the_next()

    #[test]
    fn an_empty_batch_answers_the_watermark_it_was_asked_with() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(4, 1, "match/a.yml", ONE));
        let batch = queue.drain(4, &workspace);
        assert!(batch.observations.is_empty());
        assert_eq!(
            batch.newest_sequence, 4,
            "an empty batch never moves a watermark backwards"
        );
    } // End of function an_empty_batch_answers_the_watermark_it_was_asked_with()

    #[test]
    fn a_sequence_at_or_below_the_acknowledged_watermark_is_counted_as_a_loss() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(5, 1, "match/a.yml", ONE));
        let _ = queue.drain(5, &workspace);
        // Unreachable through the present pipeline — one worker thread per
        // epoch reaches the sink — and handled rather than asserted away.
        assert!(queue.enqueue(changed(4, 1, "match/b.yml", ONE)).is_none());
        assert_eq!(queue.pending(), 0);
        assert_eq!(queue.drain(5, &workspace).discarded, 1);
    } // End of function a_sequence_at_or_below_the_acknowledged_watermark_is_counted_as_a_loss()

    #[test]
    fn a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        // One observation per document, so every entry is its document's only
        // state and nothing can survive on another entry's behalf.
        for index in 0..QUEUE_CAPACITY as u64 + 3 {
            let path = format!("match/{index}.yml");
            queue.enqueue(added(index + 1, 1, &path, ONE));
        } // End of the loop that overfills the queue
        assert_eq!(queue.pending(), QUEUE_CAPACITY);
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.discarded, 3, "three oldest entries were dropped");
        assert_eq!(
            batch
                .observations
                .first()
                .map(ExternalObservation::sequence),
            Some(4),
            "the three lowest sequences are what overflow dropped"
        );
        let addressed: Vec<String> = batch
            .observations
            .iter()
            .map(|observation| match observation {
                ExternalObservation::Added {
                    document_summary, ..
                } => document_summary.relative_path.to_string_lossy().to_string(),
                other => panic!("a new file is Added: {other:?}"),
            })
            .collect();
        assert_eq!(addressed.len(), QUEUE_CAPACITY);
        // The claim this replaces said the newest state of every document
        // survives. It does not: the globally oldest entry may be the only —
        // and therefore newest — state its document has, and here three of them
        // are, so three documents are absent from the batch altogether.
        // `discarded` is what makes that observable; nothing preserves it.
        for dropped in ["match/0.yml", "match/1.yml", "match/2.yml"] {
            assert!(
                !addressed.iter().any(|present| present == dropped),
                "{dropped} was its document's only state and overflow dropped the document with it"
            );
        } // End of the loop over the three documents overflow dropped whole
    } // End of function a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of()

    #[test]
    fn a_wake_carries_the_epoch_and_the_newest_pending_sequence() {
        let queue = queue_at_epoch(3);
        let wake = queue
            .enqueue(changed(11, 3, "match/a.yml", ONE))
            .expect("an admitted observation owes a wake");
        assert_eq!(
            wake,
            ReconciliationWake {
                workspace_epoch: 3,
                newest_sequence: 11,
            }
        );
    } // End of function a_wake_carries_the_epoch_and_the_newest_pending_sequence()

    #[test]
    fn an_installed_emitter_hears_every_enqueue_the_production_sink_makes() {
        let queue = Arc::new(queue_at_epoch(1));
        let (sender, heard) = channel::<ReconciliationWake>();
        queue.install_wake_emitter(Arc::new(move |wake| {
            let _ = sender.send(wake);
        }));
        let sink = queueing_sink(Arc::clone(&queue));
        sink(changed(1, 1, "match/a.yml", ONE));
        sink(changed(2, 1, "match/a.yml", TWO));
        let wakes: Vec<ReconciliationWake> = heard.try_iter().collect();
        assert_eq!(
            wakes
                .iter()
                .map(|wake| wake.newest_sequence)
                .collect::<Vec<_>>(),
            vec![1, 2]
        );
        assert_eq!(queue.pending(), 2);
    } // End of function an_installed_emitter_hears_every_enqueue_the_production_sink_makes()

    #[test]
    fn the_production_pair_puts_an_external_change_in_the_queue_and_a_self_write_nowhere() {
        // The real gate over the real queue — the composition
        // `WorkspaceSession::new` installs, driven by hand rather than by a
        // filesystem.
        let ledger = Arc::new(WriteLedger::new());
        ledger.begin_epoch(1);
        let queue = Arc::new(queue_at_epoch(1));
        let gate = admitting_sink(Arc::clone(&ledger), queueing_sink(Arc::clone(&queue)));
        let (_dir, workspace) = empty_workspace();

        let path = PathBuf::from("match/a.yml");
        let external = snapshot("match/a.yml", ONE);
        let outcome = gate(EpochObservation {
            epoch: 1,
            read_after: std::time::Instant::now() + std::time::Duration::from_nanos(1),
            observation: Observation::Changed {
                path: path.clone(),
                previous_revision: None,
                content: StableContent::Projected {
                    snapshot: Box::new(external),
                    findings: Vec::new(),
                },
                correspondences: None,
            },
        });
        assert_eq!(outcome, ObservationOutcome::Decided);
        assert_eq!(queue.pending(), 1, "an admitted observation is recoverable");

        // The same bytes recorded as this application's own committed write are
        // suppressed at the gate, so nothing reaches the queue at all.
        let own = snapshot("match/a.yml", TWO);
        let revision = own.revision;
        {
            let gate_window = ledger.begin_commit();
            ledger.record_app_write(&gate_window, DocumentId(7), &path, revision);
        }
        let outcome = gate(EpochObservation {
            epoch: 1,
            read_after: std::time::Instant::now() + std::time::Duration::from_nanos(1),
            observation: Observation::Changed {
                path: path.clone(),
                previous_revision: None,
                content: StableContent::Projected {
                    snapshot: Box::new(own),
                    findings: Vec::new(),
                },
                correspondences: None,
            },
        });
        assert_eq!(outcome, ObservationOutcome::Decided);
        assert_eq!(
            queue.pending(),
            1,
            "a suppressed self-write spends no sequence and reaches no consumer"
        );
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.observations.len(), 1);
    } // End of function the_production_pair_puts_an_external_change_in_the_queue_and_a_self_write_nowhere()

    #[test]
    fn a_changed_carries_its_exact_text_beside_the_projection_of_the_same_bytes() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        let batch = queue.drain(0, &workspace);
        let ExternalObservation::Changed {
            disk_text,
            disk_revision,
            disk,
            ..
        } = &batch.observations[0]
        else {
            panic!("a projected content is a Changed: {batch:?}");
        };
        assert_eq!(disk_text, ONE);
        assert_eq!(*disk_revision, ContentRevision::of_bytes(ONE.as_bytes()));
        assert_eq!(disk.matches.len(), 1);
    } // End of function a_changed_carries_its_exact_text_beside_the_projection_of_the_same_bytes()

    #[test]
    fn present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(AdmittedObservation {
            sequence: 1,
            epoch: 1,
            observation: Observation::Changed {
                path: PathBuf::from("match/a.yml"),
                previous_revision: None,
                content: StableContent::NotUtf8 {
                    revision: ContentRevision::of_bytes(&[0xff, 0xfe]),
                    offset: 0,
                },
                correspondences: None,
            },
        });
        let batch = queue.drain(0, &workspace);
        assert!(matches!(
            batch.observations[0],
            ExternalObservation::Unreadable {
                reason: UnreadableReason::NotUtf8 { offset: 0 },
                ..
            }
        ));
    } // End of function present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content()

    #[test]
    fn a_stable_read_failure_crosses_as_a_code_and_never_as_a_kind() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(AdmittedObservation {
            sequence: 1,
            epoch: 1,
            observation: Observation::Unreadable {
                path: PathBuf::from("match/a.yml"),
                kind: io::ErrorKind::PermissionDenied,
            },
        });
        queue.enqueue(AdmittedObservation {
            sequence: 2,
            epoch: 1,
            observation: Observation::Unreadable {
                path: PathBuf::from("match/b.yml"),
                kind: io::ErrorKind::WouldBlock,
            },
        });
        let batch = queue.drain(0, &workspace);
        let reasons: Vec<&UnreadableReason> = batch
            .observations
            .iter()
            .map(|observation| match observation {
                ExternalObservation::Unreadable { reason, .. } => reason,
                other => panic!("a read failure is Unreadable: {other:?}"),
            })
            .collect();
        assert_eq!(
            reasons,
            vec![
                &UnreadableReason::PermissionDenied {},
                // Everything the closed list does not name lands here, and it
                // carries no operand: the kind's own spelling is untranslated
                // developer prose.
                &UnreadableReason::Other {},
            ]
        );
    } // End of function a_stable_read_failure_crosses_as_a_code_and_never_as_a_kind()

    #[test]
    fn a_path_the_workspace_never_discovered_crosses_as_a_display_path() {
        let dir = tempfile::TempDir::new().expect("a temporary directory");
        std::fs::create_dir_all(dir.path().join("match")).expect("the match directory");
        let known = dir.path().join("match").join("known.yml");
        std::fs::write(&known, ONE).expect("the known file is written");
        let workspace = Workspace::discover(Some(dir.path())).expect("the workspace opens");
        let queue = queue_at_epoch(1);

        queue.enqueue(removed(1, 1, known.to_str().expect("a UTF-8 temp path")));
        let stranger = dir.path().join("match").join("stranger.yml");
        queue.enqueue(removed(2, 1, stranger.to_str().expect("a UTF-8 temp path")));
        let batch = queue.drain(0, &workspace);
        let ExternalObservation::Removed {
            document: ObservedDocument::Known { .. },
            ..
        } = &batch.observations[0]
        else {
            panic!("a discovered path has an identity: {batch:?}");
        };
        let ExternalObservation::Removed {
            document: ObservedDocument::Unknown { relative_path },
            ..
        } = &batch.observations[1]
        else {
            panic!("an undiscovered path has none: {batch:?}");
        };
        assert_eq!(
            relative_path.to_string_lossy(),
            "match/stranger.yml",
            "the path is rendered against the configuration root"
        );
    } // End of function a_path_the_workspace_never_discovered_crosses_as_a_display_path()

    #[test]
    fn an_added_file_carries_a_row_whose_parse_this_session_does_not_hold() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(added(1, 1, "match/new.yml", ONE));
        let batch = queue.drain(0, &workspace);
        let ExternalObservation::Added {
            document_summary,
            disk,
            ..
        } = &batch.observations[0]
        else {
            panic!("a new file is Added: {batch:?}");
        };
        assert!(
            !document_summary.loaded,
            "the backend workspace holds no parse of a file it never discovered"
        );
        assert!(!document_summary.read_only);
        assert_eq!(disk.matches.len(), 1);
    } // End of function an_added_file_carries_a_row_whose_parse_this_session_does_not_hold()

    #[test]
    fn every_observation_crosses_as_a_uniform_object_and_carries_no_anchor() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        queue.enqueue(added(2, 1, "match/b.yml", ONE));
        queue.enqueue(removed(3, 1, "match/c.yml"));
        queue.enqueue(AdmittedObservation {
            sequence: 4,
            epoch: 1,
            observation: Observation::Unreadable {
                path: PathBuf::from("match/d.yml"),
                kind: io::ErrorKind::PermissionDenied,
            },
        });
        let batch = queue.drain(0, &workspace);
        let json = serde_json::to_value(&batch).expect("a batch serializes");
        let observations = json["observations"]
            .as_array()
            .expect("observations is an array");
        assert_eq!(observations.len(), 4);
        for (index, name) in ["Changed", "Added", "Removed", "Unreadable"]
            .into_iter()
            .enumerate()
        {
            let tagged = observations[index]
                .as_object()
                .unwrap_or_else(|| panic!("{name} crosses as an object"));
            assert_eq!(tagged.len(), 1, "one tag per value: {tagged:?}");
            assert!(
                tagged[name].is_object(),
                "{name} carries an object, never a bare string"
            );
        } // End of the loop over the four observation kinds
          // The answer crosses; the question never does.
        assert!(!json.to_string().contains("owned_runs_digest"));
    } // End of function every_observation_crosses_as_a_uniform_object_and_carries_no_anchor()

    #[test]
    fn a_real_engines_conclusion_reaches_the_queue_and_names_the_workspaces_document() {
        // Not a timing test: the engine's clock is an argument and its reader is
        // injected, so this drives the real `ObservationEngine` over a real
        // temporary tree with no thread and no sleep — the shape
        // `crate::ledger`'s own engine tests use.
        let dir = tempfile::TempDir::new().expect("a temporary directory");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let file = root.join("match/a.yml");
        std::fs::write(&file, ONE).expect("the tracked file");
        let workspace = Workspace::discover(Some(&root)).expect("the workspace opens");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");
        std::fs::write(&file, TWO).expect("an external replacement");
        engine.hint(&file, Millis(0));
        assert!(engine.tick(Millis(200), &mut source).is_empty());
        let settled = engine.tick(Millis(240), &mut source);
        assert_eq!(settled.len(), 1, "one stabilized observation: {settled:?}");

        let queue = queue_at_epoch(1);
        for (index, observation) in settled.into_iter().enumerate() {
            queue.enqueue(AdmittedObservation {
                sequence: index as u64 + 1,
                epoch: 1,
                observation,
            });
        } // End of the loop that admits what the engine concluded
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.observations.len(), 1, "{batch:?}");
        let ExternalObservation::Changed {
            document,
            disk_text,
            previous_revision,
            ..
        } = &batch.observations[0]
        else {
            panic!("a rewritten tracked file is Changed: {batch:?}");
        };
        assert_eq!(disk_text, TWO);
        assert_eq!(
            *previous_revision,
            Some(ContentRevision::of_bytes(ONE.as_bytes()))
        );
        assert_eq!(
            *document,
            workspace
                .document_id(&file)
                .expect("the workspace discovered this file"),
            "the engine and the workspace agree on one path's identity"
        );
    } // End of function a_real_engines_conclusion_reaches_the_queue_and_names_the_workspaces_document()
}
