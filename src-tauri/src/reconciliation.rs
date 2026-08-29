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
//!    across two of them — which is
//!    [`espansoconfig_core::watch::retained_state`]'s clause 3, and the scope
//!    every number in this module inherits from it.
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
//!    is folded out of the *batch* and not out of the *queue*, so it holds its
//!    slot against [`QUEUE_CAPACITY`] and leaves on
//!    [`espansoconfig_core::watch::retained_state`]'s terms like any other
//!    stored entry.
//!
//!    **The capacity bound is arrival-order independent too, and it has to be
//!    or this guarantee would be conditional on it.** An overflow evicts
//!    [`evictable_sequence`]'s answer *after* the arrival has been stored, so
//!    the set a full queue holds is a function of what was admitted and not of
//!    the order two threads reached [`ReconciliationQueue::enqueue`] in — which
//!    an evict-before-insert bound was not. **That is a property of
//!    [`evictable_sequence`] together with that order, and its own doc says
//!    which half of it is proved and which half is argued and measured.** What
//!    an eviction still costs is a
//!    **loss**, reported in [`ReconciliationBatch::discarded`] and obliging a
//!    whole-workspace reload; see [`QUEUE_CAPACITY`] for the policy and for
//!    what it does and does not buy.
//! 4. **Per document the consumer acts on the highest sequence it has
//!    accepted** — which is the *consumer's* rule, not this queue's, and this
//!    queue's part of it is the `after_sequence` watermark: a drain removes
//!    every entry at or below the sequence the caller says it already holds,
//!    keeps everything above it, and returns the coalesced form of what it
//!    kept.
//!
//!    **The retention boundary is
//!    [`espansoconfig_core::watch::retained_state`]'s**, whose clause 4 states
//!    it once for both crates: this module is where it is *implemented*, and
//!    what belongs here is what this queue does at the two ends of it. An
//!    admitted observation is **stored** unless it is one of the two arrivals no
//!    later drain could return — a replaced epoch, or a sequence at or below the
//!    acknowledged watermark ([`ReconciliationQueue::enqueue`] refuses both
//!    before storing anything, and counts the second in
//!    [`ReconciliationBatch::discarded`]). Of the three ways a **stored** entry
//!    then leaves, the one this module decides is the overflow
//!    ([`QUEUE_CAPACITY`] and [`evictable_sequence`]); the other two are the
//!    caller's watermark ([`ReconciliationQueue::drain`]) and the session's
//!    replacement ([`ReconciliationQueue::begin_epoch`]).
//!
//!    **The case that would be a fourth cannot arise**: two observations at one
//!    sequence would make the later arrival replace the earlier in the pending
//!    map, counted by nothing, and `crate::ledger`'s allocator mints each
//!    sequence once within an epoch, so there is no such pair. Nothing in the
//!    types forces that, which is why [`ReconciliationQueue::enqueue`] says it
//!    where the insertion is rather than leaving it to be inferred here.
//!
//!    So an answer lost on the way to the window costs no more than the drain
//!    that repeats it **when nothing is enqueued between the two drains and no
//!    replacement epoch is adopted between them**; short of those, the second
//!    drain answers what the first did. **What nothing in this step makes
//!    happen is that later drain** — see [`ReconciliationQueue::wake`].
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
//!   an enqueue whose entry the fold above will not carry — or whose entry the
//!   capacity bound evicts in the same call — emits one like any other, so a
//!   wake is no promise that the next batch grew.
//! - **A `Removed` followed by an `Added` at the same path is two entries**,
//!   even when the new bytes hash like the old ones, because file membership
//!   changed. The coalescing rule above compares
//!   `crate::ledger::ObservedState`, and `Absent` never equals `Content(_)`.
//!
//! What the whole observation pipeline does and does not promise about a path
//! ever being looked at again is [`espansoconfig_core::watch::liveness`], which
//! this module points at rather than restating. **How long anything it retains
//! survives, and under what scope, is
//! [`espansoconfig_core::watch::retained_state`]**, pointed at the same way and
//! for the same reason — the queue's pending set, its watermark and its loss
//! count are three of that contract's subjects, and the identity register above
//! is a fourth.
//!
//! # Where the identities come from
//!
//! A [`ContentRevision`] rides the observation itself, so every wire value's
//! revisions come out of the value the gate admitted. An address does not:
//! `espansoconfig_core::watch::engine`'s `Removed` and `Unreadable` carry a path
//! and no identity, and so does a `Changed` whose new bytes are not UTF-8. So
//! the projection into wire form happens at **drain** time, under the session
//! lock, where the open `Workspace` is available — both to render a display path
//! against its root and to be **asked whether it holds that path**.
//!
//! **Two questions, and they have two different answers.**
//!
//! - *Has anything in this process ever named this path?*
//!   `espansoconfig_core::workspace::identity_already_issued` reads the
//!   process-wide, path-keyed table every identity in this application comes out
//!   of — a `Workspace`'s at discovery, the observation engine's at projection,
//!   this module's at a non-UTF-8 addition. What its answer is scoped to is
//!   [`espansoconfig_core::watch::retained_state`]'s clause 1, and it is not
//!   this queue's epoch.
//! - *Does the **open** workspace resolve that path today?* Only
//!   `Workspace::document_id` answers that, and the two answers genuinely
//!   differ — a file created after the workspace was opened has an identity and
//!   is not in the workspace, and so does a path a **replaced** workspace
//!   discovered.
//!
//! [`address_of`] asks both, and [`ObservedDocument`] carries which of the three
//! answers it got. **Every arm of it carries the display path**, so a consumer
//! is never handed a number as its only handle on a file: an identity the
//! current workspace rejects is still the one number this process gives that
//! path — which is what makes a projection installed under it invalidatable —
//! but it is not an address a command will accept today, and the value says so
//! rather than leaving the consumer to discover it.
//!
//! A file that reaches the window as an [`ExternalObservation::Added`] is always
//! named, its bytes valid UTF-8 or not: the projected arm carries the identity
//! its own snapshot minted, and the unreadable arm mints one through
//! `espansoconfig_core::workspace::identity_of`, because a row the consumer
//! cannot address is a row nothing can later tell it to invalidate.
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
use std::path::Path;
use std::sync::{Arc, Mutex, PoisonError};

use serde::Serialize;

use espansoconfig_core::discovery::DiscoveredFile;
use espansoconfig_core::model::DocumentView;
use espansoconfig_core::validate::Finding;
use espansoconfig_core::watch::correspond::CorrespondenceTable;
use espansoconfig_core::watch::engine::{Observation, StableContent};
use espansoconfig_core::workspace::{
    identity_already_issued, identity_of, DocumentSummary, Workspace,
};
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
/// busy writer grow this queue until the process dies; with one, entries are
/// dropped and [`ReconciliationBatch::discarded`] counts them, so a caller that
/// sees a non-zero count knows its batch is not a complete history of the epoch
/// and must reload rather than reconcile.
///
/// # What the eviction policy buys, and what it still does not
///
/// [`evictable_sequence`] is the policy: **the lowest pending sequence of the
/// path holding the most pending entries**, ties between equally busy paths
/// broken by the lower of their lowest sequences. Two properties follow, and
/// both were review findings before they were properties:
///
/// - **A document with one pending entry is never evicted while another
///   document has two.** So a stream of repeats for one file cannot displace a
///   second file's only observed state — which the previous *globally oldest*
///   rule allowed, and which the drain-time fold made reachable, since a folded
///   repeat holds a slot against this bound rather than leaving the queue.
/// - **The retained set does not depend on arrival order.** The arrival is
///   stored *first* and the bound restored afterwards, so a full queue holds a
///   function of what was admitted; evicting *before* the insert made a queue at
///   capacity drop a resident entry even for an arrival lower than everything
///   it held, which is how two orders of one history came to answer differently.
///   Read that claim with [`evictable_sequence`]'s own qualification of it: for
///   *the lowest sequence* it is a proof, and for *the busiest path* it is an
///   argument and a bounded measurement.
///
/// **It still preserves no document.** A path with one pending entry is evicted
/// as soon as every path has one, and then this is the lowest sequence in the
/// queue — which may be the only, and therefore newest, state its document has.
/// What the policy buys is a *fairer* victim, never a survivor. Overflow is
/// therefore **observable rather than harmless**: a cumulative
/// [`ReconciliationBatch::discarded`] and the whole-workspace reload it obliges
/// are the whole of the safety here. Nothing in Phase 2d-4a enforces that
/// obligation — `docs/decisions/2d-4a-notes.md` R4 assigns it to the consumer.
///
/// This constant and [`evictable_sequence`] are what
/// [`espansoconfig_core::watch::retained_state`]'s clause 5 and its third,
/// fourth and fifth *expressly not guaranteed* clauses are derived from; that
/// contract is where they are stated beside the pipeline's other scopes, and
/// this doc is where they are stated about the policy itself.
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
    /// had already acknowledged some of them). It describes one moment and
    /// promises nothing over time —
    /// [`espansoconfig_core::watch::retained_state`]'s sixth *expressly not
    /// guaranteed* clause, which this field is the source of.
    pub newest_sequence: u64,
}

/// Which document an observation is about — and whether the **open** workspace
/// resolves it.
///
/// Three arms, because there are three different things this application can
/// truthfully say about a watched path and collapsing any two of them loses
/// something a consumer needs. **Every arm carries the display path**, so no
/// consumer is ever handed a number as its only handle on a file.
///
/// *A process-lifetime identity is not an address in the current workspace*
/// ([`espansoconfig_core::watch::retained_state`], clause 1), and
/// an earlier shape of this type said `Known { document }` — with no path — for
/// both of the first two arms below. Round 4 of this phase's review is the
/// interleaving that made that false: epoch 1 mints an identity for a file,
/// epoch 2 reopens the root without it, and the path then stably fails to read.
/// The identity is real and is still this process's number for that path; the
/// **open** workspace answers `UnknownDocument` for it. `docs/decisions/
/// 2d-4a-notes.md` §13 is the record.
///
/// All three variants are struct variants, including the one-field arm, so the
/// enum crosses `serde`'s externally tagged representation as a uniform object —
/// `{"Addressable":{"document":3,"relative_path":"match/a.yml"}}` — which is the
/// rule every wire enum in this application follows
/// (`docs/decisions/2b-2b-3-notes.md` D5).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ObservedDocument {
    /// The **open workspace** resolves this path to this identity.
    ///
    /// So the number is an address every workspace command accepts *today*, and
    /// not merely a name this process once minted. It is the strongest of the
    /// three answers and the ordinary one: a file the workspace discovered, now
    /// removed or stably unreadable.
    Addressable {
        /// The session-local identity of the file, as the open workspace
        /// resolves it.
        document: DocumentId,
        /// The path, for display.
        relative_path: WirePath,
    },
    /// Something in this process has named this path, and the open workspace
    /// does not hold it.
    ///
    /// It is `espansoconfig_core::workspace`'s one process-wide, path-keyed
    /// table: a `Workspace`'s `identity_of` at discovery, the engine's at
    /// projection, and this module's at a non-UTF-8 addition. **One table means
    /// one number per path**, so this is the identity every other holder of that
    /// path already has, rather than two structures that happen to agree — and
    /// a consumer holding a projection under it can therefore still act on this
    /// value, which is the whole reason the identity crosses at all.
    ///
    /// **It is not an address the open workspace will accept.** Two ways here,
    /// and this arm does not distinguish them because this queue cannot:
    ///
    /// - a file created *after* the workspace was opened, whose identity the
    ///   consumer received from an [`ExternalObservation::Added`] of this epoch.
    ///   That is the case round 1 of this phase's review found stranded, and the
    ///   identity is exactly what un-strands it;
    /// - a path a **replaced** workspace discovered. Path identity outlives a
    ///   workspace epoch deliberately
    ///   ([`espansoconfig_core::watch::retained_state`], clause 1), so this
    ///   arm can name a path the current session never enumerated, and the
    ///   consumer may hold nothing at all under it. What makes a *batch* stale
    ///   across a replacement is [`ReconciliationBatch::epoch`]; what makes this
    ///   *identity* unusable as an address is this arm.
    Named {
        /// The session-local identity of the file, as this process minted it.
        document: DocumentId,
        /// The path, for display.
        relative_path: WirePath,
    },
    /// Nothing in this process has ever named this path.
    ///
    /// **So the consumer holds nothing under an identity for this file** — no
    /// identity for it has ever been minted, here or anywhere else — and a
    /// display path therefore strands no projection.
    Unnamed {
        /// The path, for display.
        relative_path: WirePath,
    },
}

// **No accessor over the three arms is declared here**, deliberately. One that
// answered *the identity, where there is one* would let a consumer treat
// `ObservedDocument::Addressable` and `ObservedDocument::Named` as one answer
// with a `?`, which is exactly the collapse round 4 of this phase's review
// found: the two arms differ in whether the open workspace will accept the
// number, and that difference is the value's whole subject. A consumer that
// needs the identity matches, and the match is where it meets the distinction.

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
/// One type across **three** wire positions, and the whole type at each of them:
/// [`ExternalObservation::Unreadable`], [`ChangedContent::Unreadable`] and
/// [`AddedContent::Unreadable`]. Only [`UnreadableReason::NotUtf8`] reaches the
/// second and third today and only the io arms reach the first, because those
/// are the states the engine can report through each shape. Narrowing any of the
/// three fields to the arms reachable today would be this module deciding which
/// failures the engine may report through which observation.
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
/// # Why a non-UTF-8 state stays inside its own observation
///
/// The engine reports present-but-not-UTF-8 bytes as content, so a `Changed` or
/// an `Added` can arrive with no text and no projection. **Both answer it the
/// same way: with a discriminated content field**, which is the consult's `disk?`
/// written as a value rather than as an absence — an absence carries no reason,
/// and the reason is the sentence a person reads.
///
/// - A **`Changed`** whose new bytes are not UTF-8 stays a `Changed`, carrying
///   its `previous_revision`, its `disk_revision` and
///   [`ChangedContent::Unreadable`] in place of a projection. An earlier draft
///   routed it to [`ExternalObservation::Unreadable`], which carries neither
///   revision, **so both operands Q3 puts on `Changed` were discarded** and no
///   consumer could recover them from the value it was handed. That is round 4
///   of this phase's review, and it was recorded as a bounded residue (R3) for
///   two rounds before it was called what it is.
/// - An **`Added`** whose bytes are not UTF-8 is still an `Added`, carrying its
///   sidebar row and [`AddedContent::Unreadable`] in place of a projection.
///   An earlier draft routed that to `Unreadable` too — which left the first
///   sighting of such a file reaching the window as a bare display path: no row
///   to draw and no address to invalidate one by. The identity a row needs is
///   now minted for it (see [`address_of`]).
///
/// What remains of [`ExternalObservation::Unreadable`] is the one engine state
/// that is **not** content: a path whose *read* stably fails, which has no bytes,
/// no revision to report and no projection anything could have made.
///
/// All three say the same true sentence to a person — *this file's text is not
/// available* — which this application already says everywhere else, since
/// `document_text` answers valid UTF-8 or refuses and never decodes lossily.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ExternalObservation {
    /// A document this application already knew about now stably holds
    /// different bytes.
    Changed {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// Which document, and whether the open workspace resolves it.
        ///
        /// The projected arm asks [`address_of_minted`] with the identity **its
        /// own snapshot minted** and the unreadable arm has no snapshot, so it
        /// asks [`address_of`]. Either way the display path is present.
        ///
        /// **This number and the one inside a projected [`ChangedContent`] are
        /// one identity**, and that is a property of
        /// [`address_of_minted`] rather than of this field: a `DocumentView`
        /// carries its own `id` and every `MatchId` under it carries the same
        /// number, so a value here that differed from the snapshot's would put
        /// two identities for one file in one object. An earlier draft of this
        /// paragraph said the arm *never depends on the two identity sources
        /// agreeing*, which stopped being true when round 5 of this phase's
        /// review made the workspace's answer the number that crosses; round 6
        /// found the split it left, and [`address_of_minted`] is where the
        /// agreement is now required rather than hoped for.
        document: ObservedDocument,
        /// The last stable revision the engine held, or `None` when it had none.
        ///
        /// **Not a claim that the caller ever saw that revision**, and not an
        /// order: it is what the engine tracked before this reading.
        previous_revision: Option<ContentRevision>,
        /// The revision of the exact bytes now on disk.
        ///
        /// **Present whether or not those bytes are text.** The engine hashes
        /// the exact stabilized bytes either way, so this field and the one
        /// above are the two operands the consult's Q3 puts on a `Changed`, and
        /// they no longer depend on the content arm — which is the whole of what
        /// [`ChangedContent`] fixed.
        disk_revision: ContentRevision,
        /// The projection of those same bytes, or why there is none.
        content: ChangedContent,
    },
    /// A YAML file the watcher was not tracking stably exists.
    Added {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// The row a sidebar draws, built from the discovered file and the
        /// identity for its path.
        ///
        /// **Present whether or not the bytes are text**, which is the whole of
        /// what gives this arm an identity at all: a projected addition carries
        /// the one its own snapshot minted, and an unreadable one carries the
        /// one `espansoconfig_core::workspace::identity_of` mints for the same
        /// path.
        ///
        /// **It is an identity and not an address the open workspace resolves.**
        /// An addition is by definition a file that workspace does not hold, so
        /// `document_context` refuses this number — the same position
        /// [`ObservedDocument::Named`] describes. What the identity buys is that
        /// a row drawn under it can later be told to go away, which is what a
        /// bare display path could not do.
        ///
        /// **A summary carries the path beside the identity**, so this arm needs
        /// no [`ObservedDocument`]: it already says both of the things that value
        /// exists to say, and it says the third one too — `loaded` is `false`,
        /// and truthfully, because the backend workspace does not hold this file
        /// at all, so it holds no parse of it either.
        document_summary: DocumentSummary,
        /// The projection of the stabilized bytes, or why there is none.
        content: AddedContent,
    },
    /// A tracked path is stably gone.
    Removed {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// Which document, and whether the open workspace resolves it.
        document: ObservedDocument,
        /// The last stable revision the engine held, or `None` when it had none.
        previous_revision: Option<ContentRevision>,
    },
    /// A path exists as far as two reads can tell and **the read itself stably
    /// failed**.
    ///
    /// The one engine state that is not content: no bytes were obtained, so
    /// there is no revision to report and there was never a projection to make.
    /// That is why this variant carries neither, and why present-but-not-UTF-8
    /// bytes — which *are* content, hashed exactly — belong in
    /// [`ChangedContent::Unreadable`] or [`AddedContent::Unreadable`] instead.
    Unreadable {
        /// The sequence this observation was admitted under.
        sequence: u64,
        /// Which document, and whether the open workspace resolves it.
        document: ObservedDocument,
        /// Why the text is not available.
        reason: UnreadableReason,
    },
}

/// What one change's stabilized bytes projected to, or why they did not.
///
/// [`AddedContent`]'s twin, and deliberately the same shape: the 2d design
/// consult's Q3 gives an addition an optional projection, and this step gives a
/// change one too, for the reason round 4 of this phase's review gave. Routing a
/// non-UTF-8 `Changed` to [`ExternalObservation::Unreadable`] discarded
/// `previous_revision` **and** `disk_revision`, both of which Q3 puts on a
/// `Changed` and neither of which `Unreadable` carries — so the two operands a
/// consumer needs to decide what a change means were destroyed by the routing
/// rather than by anything about the bytes.
///
/// Two variants rather than four `Option`s, for [`AddedContent`]'s reasons: an
/// absence carries no reason, and the operand sets stay together — a projection
/// always comes with its findings and its correspondence evidence, and an
/// unreadable state has none of the three. Both are struct variants, so the enum
/// crosses `serde`'s externally tagged representation as a uniform object (D5).
///
/// **The unreadable arm carries no bytes**, exactly as [`AddedContent`]'s does:
/// a change this application cannot read as text is one it will not show as
/// text. What it does carry is above it — the two revisions — because a hash of
/// bytes is not a rendering of them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ChangedContent {
    /// The bytes are valid UTF-8, and this is their projection.
    Projected {
        /// Those exact bytes, unchanged. The comparison side of a conflict.
        disk_text: String,
        /// The projection of those same bytes — paired with
        /// [`ChangedContent::Projected::disk_text`] by construction, since both
        /// come out of one snapshot.
        ///
        /// Boxed for [`AddedContent::Projected::disk`]'s reason, which is that
        /// one whole projection makes every value of this enum its size. The
        /// wire is unchanged: `serde` writes a `Box<T>` as its `T`.
        disk: Box<DocumentView>,
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
    /// The bytes are present and this application cannot show them as text.
    ///
    /// Only [`UnreadableReason::NotUtf8`] reaches this arm today: a path whose
    /// *read* fails is `espansoconfig_core::watch::engine`'s `Unreadable`
    /// observation and never its `Changed`. The field is the whole reason type
    /// rather than that one variant, for [`AddedContent::Unreadable`]'s reason.
    Unreadable {
        /// Why the text is not available.
        reason: UnreadableReason,
    },
}

/// What one addition's stabilized bytes projected to, or why they did not.
///
/// The 2d design consult's Q3 writes `Added { sequence, document_summary, disk?,
/// findings }`, and this is that `disk?` as a **discriminated value** rather
/// than as an optional field: an absence carries no reason, and the reason is
/// the sentence a person reads. It also keeps the two operand sets apart — a
/// projection always comes with its findings, and an unreadable state never has
/// any — where two `Option`s would let one be present without the other.
///
/// Both variants are struct variants, so the enum crosses `serde`'s externally
/// tagged representation as a uniform object (D5), and neither carries the
/// stabilized bytes: an addition this application cannot read as text is one it
/// will not show as text, exactly as `document_text` refuses rather than
/// decoding lossily.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum AddedContent {
    /// The bytes are valid UTF-8, and this is their projection.
    Projected {
        /// The projection of the stabilized bytes.
        ///
        /// Boxed for `espansoconfig_core::watch::engine::StableContent`'s
        /// reason and to its precedent: a whole projection beside a two-word
        /// refusal makes every value of this enum the size of the larger one.
        /// `serde` writes a `Box<T>` as its `T`, so the wire is unchanged.
        disk: Box<DocumentView>,
        /// The pure semantic report over that projection.
        findings: Vec<Finding>,
    },
    /// The bytes are present and this application cannot show them as text.
    ///
    /// Only [`UnreadableReason::NotUtf8`] reaches this arm today: a path whose
    /// *read* fails is `espansoconfig_core::watch::engine`'s `Unreadable`
    /// observation and never its `Added`, so it has no `DiscoveredFile` and no
    /// row to carry. The field is the whole reason type rather than that one
    /// variant, because narrowing it would be this module deciding which
    /// failures the engine may report through an addition.
    Unreadable {
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
    /// the batch is empty — the highest watermark **this epoch's** queue has
    /// been drained with, which is **not** necessarily the `after_sequence` of
    /// this call.
    ///
    /// **The whole claim, and it is scoped to one epoch: within the epoch
    /// [`ReconciliationBatch::epoch`] names, this never falls.** So a caller
    /// showing that epoch may store it as its new watermark unconditionally,
    /// and no later batch of that epoch moves the watermark backwards. The
    /// distinction that makes the claim worth stating is the **out-of-order
    /// drain**, which the 2d design consult's Q7 item 5 requires Phase 2d-5 to
    /// handle: a caller that acknowledged 10 and then drains with 5 gets 10
    /// back, because giving back its own lower argument would walk its
    /// watermark backwards — which is what an earlier draft of this field did.
    ///
    /// **Across a replacement epoch it does fall, and that is not a walk-back**
    /// — [`espansoconfig_core::watch::retained_state`]'s clauses 2 and 3 are
    /// why, and this field is where its clause 6 is derived from. Concretely:
    /// drain epoch 1 with watermark 9, adopt epoch 2, drain the empty successor,
    /// and this field is 0. What separates the two numbers is
    /// [`ReconciliationBatch::epoch`]: a batch whose epoch a caller is not
    /// showing installs nothing at all, whatever it holds (the consult's Q3).
    /// Round 6 of this phase's review is where *ever* and *this session* were
    /// found over-claiming here, and it is a **words** finding: the code has
    /// been epoch-scoped since the original round, and
    /// `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses`
    /// asserts the reset.
    pub newest_sequence: u64,
    /// The observations above the caller's watermark, ordered by sequence.
    pub observations: Vec<ExternalObservation>,
    /// How many admitted observations this epoch's queue dropped rather than
    /// held — for **either** of two reasons.
    ///
    /// The queue was over [`QUEUE_CAPACITY`] and [`evictable_sequence`] named an
    /// entry to make room, or the observation's sequence was at or below the
    /// acknowledged watermark and no later drain could ever have returned it
    /// ([`ReconciliationQueue::enqueue`]). The two are counted together because
    /// they mean the same thing to a consumer and oblige the same response;
    /// naming only the first, which an earlier draft of this field did, was
    /// false about the second.
    ///
    /// **What it deliberately does not count is the third way a stored entry
    /// leaves the queue** — the replacement epoch of
    /// [`espansoconfig_core::watch::retained_state`]'s clause 4. Those entries
    /// describe a directory nothing is showing any more, and every batch of the
    /// epoch they belonged to is already stale by
    /// [`ReconciliationBatch::epoch`], so counting them would oblige a reload of
    /// a workspace the open has just performed.
    ///
    /// **Cumulative within the epoch and monotonic** — that contract's clause 7,
    /// derived from this field — so a non-zero value does not say the loss
    /// happened since the previous drain. What it does say is that this epoch's
    /// observation history has a hole in it, so a consumer must reload the
    /// workspace rather than reconcile from these values. Zero on every ordinary
    /// run — and nothing in Phase 2d-4a makes a consumer read it
    /// (`docs/decisions/2d-4a-notes.md` R4).
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
    /// How many entries this epoch dropped rather than held, for capacity or
    /// for arriving at or below the acknowledged watermark — the two causes
    /// [`ReconciliationBatch::discarded`] states.
    ///
    /// Reset with the rest of this state by [`ReconciliationQueue::begin_epoch`]
    /// — see [`espansoconfig_core::watch::retained_state`] for what that scopes
    /// and why the third way a stored entry leaves is not counted here.
    discarded: u64,
}

impl QueueState {
    /// An empty state for `epoch`.
    fn empty(epoch: u64) -> QueueState {
        QueueState {
            epoch,
            pending: BTreeMap::new(),
            acknowledged: 0,
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

/// Which entry an overflow drops — **the whole capacity policy, in one place**.
///
/// The **lowest pending sequence of the path holding the most pending entries**,
/// ties between equally busy paths broken by the lower of their lowest
/// sequences. `None` only for an empty set, which [`ReconciliationQueue::enqueue`]
/// never reaches, since it has just inserted.
///
/// Three properties, each chosen against an alternative this phase's review
/// found shipped or considered:
///
/// - **A path with one pending entry is never the victim while another path has
///   two.** That is what stops a repeated hint stream for one file from
///   displacing a second file's only observed state — which *the globally
///   lowest sequence* allowed, and which the drain-time fold made reachable,
///   because a folded repeat holds its slot against this bound rather than
///   leaving the queue.
///   When every path holds one entry the rule degenerates to exactly that older
///   one, which is the case the overflow test drives.
/// - **It is a pure function of the pending set**, so the retained set cannot
///   depend on the order two threads reached
///   [`ReconciliationQueue::enqueue`] in — provided the arrival is stored before
///   the bound is restored, which is why it is. Note what this does *not*
///   claim: order-independence here is a property of this rule together with
///   insert-before-evict, and it is argued and exhaustively checked over small
///   configurations rather than proved. `docs/decisions/2d-4a-notes.md` §12 has
///   the check and its limits.
/// - **It does not look at [`ObservedState`].** Preferring an entry the fold
///   currently makes redundant was the obvious alternative and it is
///   **refused**: redundancy is a property of the set *at the moment of the
///   eviction*, and an arrival that later lands between two folded entries
///   un-folds them — so one history in two arrival orders retains two different
///   sets, which is the defect the fold moved to drain to close. §12 records the
///   counterexample.
///
/// Removing a path's **lowest** entry is also what keeps the fold's own
/// adjacency intact: it takes a prefix of that path's entries, so it can never
/// join two runs that were separated, and never turns two observations into one.
fn evictable_sequence(pending: &BTreeMap<u64, AdmittedObservation>) -> Option<u64> {
    // The walk is in ascending sequence order, so the first sighting of a path
    // already carries that path's lowest pending sequence.
    let mut by_path: BTreeMap<&Path, (usize, u64)> = BTreeMap::new();
    for (sequence, entry) in pending {
        let counted = by_path
            .entry(entry.observation.path())
            .or_insert((0, *sequence));
        counted.0 += 1;
    } // End of the walk that counts each path's pending entries
    by_path
        .into_values()
        .min_by_key(|(count, lowest)| (std::cmp::Reverse(*count), *lowest))
        .map(|(_, lowest)| lowest)
} // End of function evictable_sequence()

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
    /// **Everything** means the pending set, the acknowledged watermark and the
    /// loss count. It is one assignment of a fresh [`QueueState`] rather than
    /// three clears, which is what keeps a field added later from being the one
    /// nobody remembered to reset.
    ///
    /// **This is the third way a stored entry leaves this queue** —
    /// [`espansoconfig_core::watch::retained_state`]'s clause 4 states all
    /// three, and this is the one it names as not depending on the entry. An
    /// observation stored under the previous epoch, acknowledged by nobody and
    /// evicted by nothing, is discarded here. **It is not counted in
    /// [`ReconciliationBatch::discarded`]**, which this call resets along with
    /// the rest: what obliges a whole-workspace reload is a hole in *an epoch's*
    /// history, and a replacement is not a hole in one — it is the successful
    /// open that made the whole epoch's history irrelevant, having already
    /// replaced the workspace the window would reload.
    ///
    /// **What it does not reset is a path's identity**, and it never did in the
    /// place that matters: that is
    /// [`espansoconfig_core::watch::retained_state`]'s clause 1, and it is
    /// exactly the scope this call does *not* have. This queue briefly
    /// kept an epoch-scoped copy of the identities it had issued, on the ground
    /// that *one path in two epochs is two files* — which the core's own model
    /// contradicts, since it hands a recreation at one path the same number.
    /// What a replacement makes stale is the batch, through
    /// [`ReconciliationBatch::epoch`], and never an address.
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
    /// - **a full queue**: the arrival is stored, and [`evictable_sequence`]
    ///   then names the entry that leaves, which is counted in
    ///   [`ReconciliationBatch::discarded`]. That entry may be its document's
    ///   only state, so this is a real loss and never a tidying — see
    ///   [`QUEUE_CAPACITY`]. **Storing first and evicting after is the whole of
    ///   why the bound cannot depend on arrival order**: evicting first made a
    ///   queue at capacity drop a resident entry to make room for an arrival
    ///   lower than everything it held, so one history in two orders retained
    ///   two different sets — and the arrival that was itself the right victim
    ///   is now simply the entry that leaves again.
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
        guard.pending.insert(admitted.sequence, admitted);
        while guard.pending.len() > QUEUE_CAPACITY {
            let Some(evicted) = evictable_sequence(&guard.pending) else {
                break;
            };
            guard.pending.remove(&evicted);
            guard.discarded += 1;
        } // End of the loop that brings the queue back within its capacity
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
    /// a higher sequence. **Holding a slot is not the same as being safe**: a
    /// folded entry leaves on
    /// [`espansoconfig_core::watch::retained_state`]'s clause 4 terms like any
    /// other stored entry, and an overflow that takes it is a counted loss
    /// obliging a whole-workspace reload rather than a fold — which is why the
    /// entries it holds a slot *against* are chosen by [`evictable_sequence`]
    /// rather than by sequence alone.
    ///
    /// A caller that drains twice with the same watermark therefore receives
    /// the same batch twice **when nothing was enqueued between the two calls
    /// and no replacement epoch was adopted between them** — the answer is a
    /// function of the pending set and this call consumes nothing from it — so
    /// an answer lost between Rust and the window costs no more than the drain
    /// that repeats it. An enqueue in between adds
    /// to the second batch, which is what a queue is for and not an exception
    /// to the rule — **and an enqueue is also what can evict**, which is the one
    /// way a second batch can be *missing* something the first one carried
    /// **within one epoch**. That is a counted loss and a whole-workspace
    /// reload, not a repeated drain. A replacement between the two calls is the
    /// other way, and it is visible as a different
    /// [`ReconciliationBatch::epoch`] rather than as a `discarded` count: the
    /// second batch is the successor workspace's, and the first one is stale.
    ///
    /// The `max` this function takes is what makes
    /// [`ReconciliationBatch::newest_sequence`]'s claim a property of the
    /// function that fills the field rather than of an invariant elsewhere; the
    /// claim itself, and the epoch it is scoped to, are that field's doc and
    /// [`espansoconfig_core::watch::retained_state`]'s clause 6.
    ///
    /// `workspace` is here for two things, and [`address_of`] is where both are
    /// asked: it renders a display path against the configuration root, and it
    /// is **asked whether it holds the path**, which is what separates an
    /// identity this workspace will accept from one this process merely minted.
    /// It is the open workspace, so this runs under the session lock and takes
    /// this queue's mutex below it — the one order that exists here.
    pub fn drain(&self, after_sequence: u64, workspace: &Workspace) -> ReconciliationBatch {
        let mut guard = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        guard.acknowledged = guard.acknowledged.max(after_sequence);
        guard
            .pending
            .retain(|sequence, _| *sequence > after_sequence);
        let carried = coalesced_sequences(&guard.pending);
        let observations: Vec<ExternalObservation> = guard
            .pending
            .iter()
            .filter(|(sequence, _)| carried.contains(sequence))
            .map(|(_, admitted)| external_observation(admitted, workspace))
            .collect();
        // The batch's own highest — which is also the highest *pending*
        // sequence, since `coalesced_sequences` always carries that entry — and
        // never below `guard.acknowledged`, which `begin_epoch` replaced along
        // with the whole `QueueState` and which therefore says nothing about any
        // earlier epoch (`espansoconfig_core::watch::retained_state`, clauses 2
        // and 6). The `max` is what makes `newest_sequence`'s claim a property
        // of this function rather than of an invariant elsewhere: every pending
        // entry is above `acknowledged` today, because `enqueue` refuses at or
        // below it and a drain only removes — but nothing in the types forces
        // that, and an empty batch has no entry to be above anything at all.
        let newest_sequence = observations
            .last()
            .map(ExternalObservation::sequence)
            .unwrap_or(guard.acknowledged)
            .max(guard.acknowledged);
        ReconciliationBatch {
            epoch: guard.epoch,
            newest_sequence,
            observations,
            discarded: guard.discarded,
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
/// on a value nothing could recover; this is what gives one somewhere to be
/// recovered from. **Not every argument is stored** —
/// [`ReconciliationQueue::enqueue`] refuses a replaced epoch and a sequence at
/// or below the acknowledged watermark before storing anything, and a refusal
/// emits no wake.
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
/// because a drain consumes nothing: **an entry survives its own drain**, and
/// what does remove one is
/// [`espansoconfig_core::watch::retained_state`]'s clause 4.
///
/// **Three ways to an address, and each arm takes the strongest one available
/// to it.** An arm holding a projection has the identity already and asks
/// [`address_of_minted`], which asks the open workspace only whether it holds
/// the path — and **requires** it to hold that path under the same number,
/// because the projection this observation carries is addressed by the
/// snapshot's; an arm holding a bare path asks [`address_of`], which asks the
/// workspace and then the process-wide register; and the one arm that needs an
/// address **nothing has minted yet** — a first sighting of a file whose bytes
/// are not UTF-8 — mints one, because a sidebar row the consumer cannot name is
/// a row nothing can later tell it to invalidate. This function used to keep the
/// queue's own record of what it had addressed, which was a second copy of the
/// core's table; `docs/decisions/2d-4a-notes.md` §12 is why it does not, and §13
/// is why asking that table alone was not enough either.
fn external_observation(
    admitted: &AdmittedObservation,
    workspace: &Workspace,
) -> ExternalObservation {
    let sequence = admitted.sequence;
    match &admitted.observation {
        Observation::Changed {
            path,
            previous_revision,
            content,
            correspondences,
        } => {
            // The two operands the consult's Q3 puts on a `Changed`, taken
            // before the content arm is chosen — which is the whole of what
            // stops the arm from destroying them. `StableContent::revision`
            // answers for both arms because the engine hashes the exact
            // stabilized bytes whatever they decode to.
            let disk_revision = content.revision();
            let (document, changed) = match content {
                StableContent::Projected { snapshot, findings } => (
                    address_of_minted(path, snapshot.id, workspace),
                    ChangedContent::Projected {
                        disk_text: snapshot.source.clone(),
                        disk: Box::new(snapshot.view.clone()),
                        findings: findings.clone(),
                        correspondences: correspondences.clone(),
                    },
                ),
                StableContent::NotUtf8 { offset, .. } => (
                    address_of(path, workspace),
                    ChangedContent::Unreadable {
                        reason: UnreadableReason::NotUtf8 { offset: *offset },
                    },
                ),
            };
            ExternalObservation::Changed {
                sequence,
                document,
                previous_revision: *previous_revision,
                disk_revision,
                content: changed,
            }
        }
        Observation::Added { file, content } => {
            // The identity a row is built around: the projection's own where
            // there is one, and a freshly minted one where there is not —
            // `identity_of` answers the same number for this path forever, so
            // the two arms cannot disagree about one file.
            let (document, added) = match content {
                StableContent::Projected { snapshot, findings } => (
                    snapshot.id,
                    AddedContent::Projected {
                        disk: Box::new(snapshot.view.clone()),
                        findings: findings.clone(),
                    },
                ),
                StableContent::NotUtf8 { offset, .. } => (
                    identity_of(&file.path),
                    AddedContent::Unreadable {
                        reason: UnreadableReason::NotUtf8 { offset: *offset },
                    },
                ),
            };
            ExternalObservation::Added {
                sequence,
                document_summary: summary_of(document, file),
                content: added,
            }
        }
        Observation::Removed {
            path,
            previous_revision,
        } => ExternalObservation::Removed {
            sequence,
            document: address_of(path, workspace),
            previous_revision: *previous_revision,
        },
        Observation::Unreadable { path, kind } => ExternalObservation::Unreadable {
            sequence,
            document: address_of(path, workspace),
            reason: UnreadableReason::of_io_kind(*kind),
        },
    } // End of the match over every observation kind the engine can produce
} // End of function external_observation()

/// The address one watched path crosses as — **two questions, asked in the
/// order that makes the strongest true answer win**.
///
/// 1. *Does the **open** workspace resolve this path?* `Workspace::document_id`
///    is the only thing that answers it, and a `Some` makes the identity an
///    address every workspace command accepts today —
///    [`ObservedDocument::Addressable`].
/// 2. *Has anything in this process ever named it?*
///    `espansoconfig_core::workspace::identity_already_issued` reads the
///    process-wide, path-keyed register, and **mints nothing** — asking must not
///    create the entry it asks about. Every identity in this application comes
///    out of that register: a `Workspace`'s at discovery, the observation
///    engine's at projection, and this module's at a non-UTF-8 addition. So the
///    number is the number every other holder of that path already has, by
///    construction rather than by two structures agreeing — but the open
///    workspace has just said it does not hold it, so it is
///    [`ObservedDocument::Named`] and not an address.
///
/// Neither answer alone is enough, and round 3 of this phase's review deleted
/// the first while closing a duplicate-storage finding: the register's `Some` is
/// scoped by [`espansoconfig_core::watch::retained_state`]'s clause 1 and by
/// nothing shorter, so an identity minted under a replaced workspace came back
/// as *known* with no path, and the current workspace answered `UnknownDocument`
/// for it. Round 4 is that interleaving.
///
/// [`ObservedDocument::Unnamed`] is exactly *nothing in this process has ever
/// named this path*, which is what makes it strand no projection: no identity
/// for that file has ever been minted, so the consumer holds nothing under one.
/// It is reachable — an io-unreadable file created after the workspace was
/// opened is never discovered, never projected and never an addition.
///
/// `workspace` is used for those two things and for nothing else: it is asked
/// whether it holds the path, and its root is what a display path renders
/// against — a path beneath it renders relative to it and one that does not
/// renders whole.
fn address_of(path: &Path, workspace: &Workspace) -> ObservedDocument {
    match workspace.document_id(path) {
        Some(document) => ObservedDocument::Addressable {
            document,
            relative_path: display_path(path, workspace),
        },
        None => match identity_already_issued(path) {
            Some(document) => ObservedDocument::Named {
                document,
                relative_path: display_path(path, workspace),
            },
            None => ObservedDocument::Unnamed {
                relative_path: display_path(path, workspace),
            },
        },
    }
} // End of function address_of()

/// The address one watched path crosses as when the identity is **already in
/// hand** — a projection's own `snapshot.id`.
///
/// It asks the open workspace the same question [`address_of`] asks it, and it
/// asks the **identity register** nothing: the caller already has the number
/// that register would give, so there is nothing to look up there.
///
/// **Each arm is chosen because it is true of the value it carries**, which
/// is what decided the shape of this function rather than something that
/// followed from it. A `Some` is exactly [`ObservedDocument::Addressable`]'s
/// claim — *the open workspace resolves this path to this identity* — and a
/// `None` is exactly [`ObservedDocument::Named`]'s, whose number is then the
/// snapshot's, which is what the consumer received the projection under.
///
/// # A second source, which must answer the same number where it answers at all
///
/// The two sources have **different membership** and that is ordinary rather
/// than a fault: their two scopes are
/// [`espansoconfig_core::watch::retained_state`]'s clauses 1 and 2, so a file
/// created after the open is in the register and not in the workspace.
/// That difference is the whole subject of [`ObservedDocument`]'s three arms.
/// What may **not** differ is the number, where both hold the path at all. One
/// register makes that true today — a `Workspace` mints through `identity_of`
/// and so does the engine — but nothing in the types forces it.
///
/// **So a disagreement is a failure and not a value, in every build profile,
/// and the `assert_eq!` below is that policy.** There is no honest wire value
/// for it, which is what rules the alternatives out rather than taste:
/// [`ObservedDocument::Named`] would claim the open workspace does not hold a
/// path it demonstrably holds — round 5 of this phase's review is that finding —
/// while `Addressable` carrying the **workspace's** number would put one
/// identity on this observation and the snapshot's other identity inside the
/// same object's projection, since a `DocumentView` carries its own `id` and
/// every `MatchId` beneath it carries that. Round 6 is that finding: the arm was
/// locally true and the object held two identities for one file. A
/// `debug_assert_eq!` left exactly that split standing in a release build, which
/// is not an invariant-failure policy — it is the same value with the check
/// removed.
///
/// **What the trade costs, stated rather than implied.** A disagreement now
/// panics inside a Tauri command, holding this queue's mutex and the session
/// lock, on any profile. It is **not a panic on input**: no file's bytes, no
/// filesystem state and no action a person can take reaches it — only a second
/// identity source added to this process's own code, which is the bug the
/// assertion is for.
///
/// **Both mutexes absorb poisoning through `PoisonError::into_inner`** — the
/// session's as `crate::commands`'s module header describes, this queue's as
/// every lock in this module does. That header is the **mechanism** and not the
/// justification, and an earlier draft of this paragraph cited it as the
/// justification, which round 7 of this phase's review found: **not one of its
/// three grounds is true of `QueueState`**. Nothing re-reads a lost observation
/// the way `reload_document` re-reads a file; [`ReconciliationQueue::drain`]
/// mutates the state with two statements rather than one infallible assignment;
/// and no command recovers a queue.
///
/// **What holds instead is narrower, and it is a property of `drain` rather
/// than of a policy.** Both of that function's mutations — raising
/// `acknowledged` to `after_sequence`, then retaining only what is above it —
/// run before the projection loop that reaches this function, and an unwind
/// undoes neither. So the state behind the poisoned lock is the state a
/// *completed* `drain(after_sequence)` would have left: the watermark raised,
/// everything at or below it gone, nothing above it touched, the loss count
/// unmoved, and the batch this caller never received still stored. **What that
/// does not buy is a queue this caller can drain.** Nothing about the
/// disagreement changes, so a later drain at any watermark below the offending
/// entry's sequence reaches this assertion again. **Three things end that loop
/// and none of them is an enforcement this code performs**, which round 8 of
/// this phase's review found an earlier draft claiming — and the draft that
/// replaced it closed the list at two, which round 9 then found.
/// `after_sequence` crosses the wire as an unvalidated `u64`, so a caller
/// passing a watermark at or above the offending entry's sequence prunes that
/// entry at the retain *before* the projection runs;
/// [`ReconciliationQueue::enqueue`] evicts, so an arrival taking the pending map
/// past [`QUEUE_CAPACITY`] costs the offending entry its place **when
/// [`evictable_sequence`] picks it** — and what it picks is fixed by a rule
/// about paths and their pending counts, stated whole as
/// [`espansoconfig_core::watch::retained_state`]'s clause 5. **That rule does
/// not know this assertion exists**: the offending entry goes when the rule
/// happens to name it, never because it is the entry that trips here, so this
/// escape waits on a state it cannot bring about; and
/// [`ReconciliationQueue::begin_epoch`] assigns an empty state over the whole of
/// it, so reopening the workspace discards the entry too. All three are escapes
/// rather than repairs — none touches the disagreement, and nothing here
/// prevents any of them — and each waits on something outside this function: a
/// caller's watermark, an overflow that selects this entry, and a reopen. All
/// three stay reachable after the panic, because `drain`, `enqueue` and
/// `begin_epoch` each take this queue's lock through `PoisonError::into_inner`
/// as every lock in this module does. **That the list is closed at three is
/// clause 4's claim rather than this paragraph's**:
/// [`espansoconfig_core::watch::retained_state`]'s clause 4 is where a stored
/// entry's exits are enumerated, where what that count rests on is stated, and
/// where a fourth would have to be added. **None of this paragraph is asserted
/// by anything**: no test poisons either lock, and what happens to the process
/// around the panic is asserted by nothing in this repository either.
/// `docs/decisions/2d-4a-notes.md` §15 and §16 are the record, including why no
/// test can fail on this and why the fixture that once reached it was the
/// review's own evidence.
fn address_of_minted(path: &Path, document: DocumentId, workspace: &Workspace) -> ObservedDocument {
    let relative_path = display_path(path, workspace);
    match workspace.document_id(path) {
        Some(resolved) => {
            assert_eq!(
                resolved, document,
                "one register means one identity per path, so the open workspace resolving \
                 {path:?} must resolve it to the number a snapshot of it minted"
            );
            ObservedDocument::Addressable {
                document: resolved,
                relative_path,
            }
        }
        None => ObservedDocument::Named {
            document,
            relative_path,
        },
    }
} // End of function address_of_minted()

/// One watched path, rendered for display against the configuration root.
///
/// Relative to the root where it lies beneath it and whole where it does not.
/// **Display data and never an address a command accepts back** — a [`WirePath`]
/// renders lossily, and identity is what a caller hands back
/// (`crate::wire_contract`).
fn display_path(path: &Path, workspace: &Workspace) -> WirePath {
    WirePath::from(
        path.strip_prefix(workspace.root())
            .unwrap_or(path)
            .to_path_buf(),
    )
} // End of function display_path()

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

    use std::path::PathBuf;
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
    ///
    /// The identity is the **core's**, minted from the path through the same
    /// function `espansoconfig_core::watch::engine` calls when it projects
    /// stabilized bytes — never a literal. [`address_of`] reads that one
    /// register when the open workspace does not hold the path, so a helper that
    /// invented a number would turn every identity assertion below into a test
    /// of the helper.
    fn snapshot(path: &str, source: &str) -> SourceDocument {
        let document = identity_of(Path::new(path));
        project_source(&DocumentContext::detached(document, path), source)
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
                    content: ChangedContent::Projected { disk_text, .. },
                    ..
                } => (*sequence, disk_text.clone()),
                other => panic!("this batch holds only projected Changed observations: {other:?}"),
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
        // queue, so a repeat holds its slot and leaves it on the terms
        // `espansoconfig_core::watch::retained_state` states for every stored
        // entry.
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
        // **The third way a stored entry leaves this queue**, which every
        // position stating the retention boundary omitted until round 5 of this
        // phase's review. Nothing acknowledges this entry and nothing evicts it
        // — one entry against a capacity of 256 — and after the replacement it
        // is gone all the same, counted in no `discarded`.
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/a.yml", ONE));
        assert_eq!(queue.pending(), 1, "stored, and no drain has seen it");
        queue.begin_epoch(2);
        assert_eq!(
            queue.pending(),
            0,
            "a replacement discards what the previous epoch held, acknowledged or not"
        );
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.epoch, 2, "the batch is the successor workspace's");
        assert!(
            batch.observations.is_empty(),
            "and no later drain can return what it discarded: {batch:?}"
        );
        assert_eq!(
            batch.discarded, 0,
            "the third way is counted nowhere: the open that caused it has already replaced the \
             workspace a reload would fetch, so there is no hole in a history anyone is showing"
        );
        // The same clause from the other side, which is what "and its losses"
        // in this name is about: the watermark goes with the pending set, so a
        // sequence the *previous* epoch had already acknowledged is stored under
        // the successor rather than refused and counted as a loss.
        queue.enqueue(changed(9, 2, "match/a.yml", ONE));
        let acknowledged = queue.drain(9, &workspace);
        assert!(
            acknowledged.observations.is_empty(),
            "sequence 9 is acknowledged: {acknowledged:?}"
        );
        assert_eq!(
            acknowledged.newest_sequence, 9,
            "epoch 2's watermark, which the replacement below is about to discard: {acknowledged:?}"
        );
        queue.begin_epoch(3);
        queue.enqueue(changed(3, 3, "match/a.yml", TWO));
        let after = queue.drain(0, &workspace);
        assert_eq!(
            sequences_and_text(&after),
            vec![(3, TWO.to_string())],
            "a replacement resets the watermark with everything else: {after:?}"
        );
        assert_eq!(after.discarded, 0, "and resets the loss count with it");
        // **`newest_sequence` falls across a replacement, and the field's own
        // claim is scoped to one epoch for exactly this.** 9 was the watermark
        // under epoch 2 and 3 is the successor's answer, which is smaller — not
        // a walk-back, because a sequence means nothing across two epochs and
        // the batch names the epoch it belongs to. Round 6 of this phase's
        // review found four public positions and one record position claiming
        // this number never falls below anything this *queue* or *session* had
        // ever been drained with; asserting it here is what stops the corrected
        // wording from resting on a reading alone.
        assert_eq!(
            after.newest_sequence, 3,
            "the successor epoch answers its own sequences, below the epoch before it: {after:?}"
        );
        assert_eq!(after.epoch, 3, "and the batch says which epoch that is");
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
        // more than the drain that repeats it. The guarantee carries **two**
        // qualifications and this comment named only the first until round 7 of
        // this phase's review: nothing is enqueued between the two calls — an
        // enqueue in between belongs in the second batch — and no replacement
        // epoch is adopted between them;
        // `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses`
        // is where that second side is driven. Neither happens in this test.
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
        // documentation tells it to, *within one epoch* — must not be walked
        // back to 5. Both drains here are epoch 1's, which is the scope the
        // claim carries;
        // `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses`
        // is where the watermark legitimately falls, across a replacement.
        let late = queue.drain(5, &workspace);
        assert!(late.observations.is_empty());
        assert_eq!(
            late.newest_sequence, 10,
            "an empty batch answers the highest watermark, never the caller's lower argument"
        );
    } // End of function an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument()

    #[test]
    fn an_identity_this_queue_issued_names_that_path_where_the_workspace_cannot() {
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
        // goes away. Both carry a path and no identity of their own, and both
        // must name what the addition named — otherwise the consumer holds a
        // projection under an identity nothing can tell it to invalidate. The
        // arm is `Named` and not `Addressable`, because this workspace never
        // discovered the file: the identity is real and the open workspace will
        // still refuse it.
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
                ExternalObservation::Changed { document, .. }
                | ExternalObservation::Removed { document, .. } => document,
                other => panic!("this batch holds a Changed and a Removed: {other:?}"),
            })
            .collect();
        let expected = ObservedDocument::Named {
            document: issued,
            relative_path: WirePath::from(PathBuf::from("match/new.yml")),
        };
        assert_eq!(
            addresses,
            vec![&expected, &expected],
            "an identity this queue has issued names its path afterwards, beside the path: {second:?}"
        );
    } // End of function an_identity_this_queue_issued_names_that_path_where_the_workspace_cannot()

    #[test]
    fn a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_identity() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        // A file created after the workspace was opened whose bytes are not
        // UTF-8. Nothing has ever projected it, so nothing had ever minted an
        // identity for it — and an earlier draft sent it as an `Unreadable`
        // carrying a display path: no row for a sidebar to draw, and no address
        // by which anything could later be told to invalidate one.
        queue.enqueue(AdmittedObservation {
            sequence: 1,
            epoch: 1,
            observation: Observation::Added {
                file: DiscoveredFile {
                    path: PathBuf::from("match/binary.yml"),
                    kind: FileKind::MatchFile,
                    relative_path: PathBuf::from("match/binary.yml"),
                    disabled: false,
                },
                content: StableContent::NotUtf8 {
                    revision: ContentRevision::of_bytes(&[0xff, 0xfe]),
                    offset: 0,
                },
            },
        });
        let batch = queue.drain(0, &workspace);
        let ExternalObservation::Added {
            document_summary,
            content,
            ..
        } = &batch.observations[0]
        else {
            panic!("a new file is Added whether or not its bytes are text: {batch:?}");
        };
        assert_eq!(
            *content,
            AddedContent::Unreadable {
                reason: UnreadableReason::NotUtf8 { offset: 0 },
            },
            "the row carries why there is no projection, never a bare absence"
        );
        assert!(
            !document_summary.loaded,
            "the backend workspace holds no parse of it, and could not"
        );
        let addressed = document_summary.id;
        // The identity is the core register's, so the same file's later removal
        // names exactly what the row was drawn under.
        queue.enqueue(removed(2, 1, "match/binary.yml"));
        let second = queue.drain(1, &workspace);
        assert!(
            matches!(
                &second.observations[0],
                ExternalObservation::Removed {
                    document: ObservedDocument::Named { document, .. },
                    ..
                } if *document == addressed
            ),
            "the addition's identity names its own removal: {second:?}"
        );
    } // End of function a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_identity()

    #[test]
    fn an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(added(1, 1, "match/epochs.yml", ONE));
        let first = queue.drain(0, &workspace);
        let ExternalObservation::Added {
            document_summary, ..
        } = &first.observations[0]
        else {
            panic!("a new file is Added: {first:?}");
        };
        let issued = document_summary.id;
        // A replacement empties the pending set, the watermark and the loss
        // count — and **not** a path's identity, which is the core's register:
        // `espansoconfig_core::watch::retained_state`'s clauses 2 and 1, and
        // the whole of what this test is about. An earlier
        // draft of this queue kept an epoch-scoped copy and answered `Unknown`
        // here, on the ground that one path in two epochs is two files: the
        // core's own model says the opposite, a recreation at that path
        // included. What a replacement makes stale is the batch.
        //
        // This test *exercises* that emptying and does not assert it: the
        // successor reuses sequence 1, so an insert at the same key would hide a
        // `begin_epoch` that kept the pending set. The clause is asserted by
        // `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses`.
        queue.begin_epoch(2);
        queue.enqueue(removed(1, 2, "match/epochs.yml"));
        let second = queue.drain(0, &workspace);
        assert_eq!(second.epoch, 2, "the batch says which workspace it is for");
        assert_eq!(
            second.observations[0],
            ExternalObservation::Removed {
                sequence: 1,
                document: ObservedDocument::Named {
                    document: issued,
                    relative_path: WirePath::from(PathBuf::from("match/epochs.yml")),
                },
                previous_revision: None,
            },
            "one path is one document across a replacement — named, beside its path, and \
             never claimed as an address this workspace resolves: {second:?}"
        );
    } // End of function an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale()

    #[test]
    fn an_empty_batch_answers_the_watermark_it_was_asked_with() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(4, 1, "match/a.yml", ONE));
        let batch = queue.drain(4, &workspace);
        assert!(batch.observations.is_empty());
        assert_eq!(
            batch.newest_sequence, 4,
            "an empty batch never moves a watermark backwards within one epoch"
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

    /// The path and the source one sequence of the capacity counterexample
    /// carries.
    ///
    /// Sequences 1, 2 and 257 are **one** path at states A, B and A; every
    /// sequence between them is a path of its own. So the queue arrives at one
    /// entry over capacity holding 256 documents, exactly one of which has more
    /// than a single entry.
    fn subject_or_filler(sequence: u64) -> (String, String) {
        match sequence {
            1 | 257 => ("match/subject.yml".to_owned(), ONE.to_owned()),
            2 => ("match/subject.yml".to_owned(), TWO.to_owned()),
            other => (
                format!("match/filler{other}.yml"),
                format!("matches:\n  - trigger: ':f{other}'\n    replace: filler\n"),
            ),
        }
    } // End of function subject_or_filler()

    #[test]
    fn a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in() {
        // Round 3's first counterexample. Evicting *before* the insert dropped
        // the resident lowest entry to make room, so arriving `1..257` evicted
        // A(1) and kept B(2), while arriving `2..257, 1` evicted B(2) and stored
        // A(1) — and with B(2) gone the drain folded A(1) into A(257). One
        // admitted history, two batches, decided by which thread was first.
        let ascending: Vec<u64> = (1..=257).collect();
        let descending: Vec<u64> = (1..=257).rev().collect();
        let lowest_last: Vec<u64> = (2..=257).chain(std::iter::once(1)).collect();
        let mut answers: Vec<(Vec<(u64, String)>, u64)> = Vec::new();
        for arrival in [ascending, descending, lowest_last] {
            let queue = queue_at_epoch(1);
            let (_dir, workspace) = empty_workspace();
            for sequence in arrival {
                let (path, source) = subject_or_filler(sequence);
                queue.enqueue(changed(sequence, 1, &path, &source));
            } // End of the loop that feeds one arrival order to the queue
            let batch = queue.drain(0, &workspace);
            answers.push((sequences_and_text(&batch), batch.discarded));
        } // End of the loop over the three arrival orders of one admitted history
        assert_eq!(
            answers[0], answers[1],
            "the retained set follows what was admitted, never the arrival order"
        );
        assert_eq!(
            answers[0], answers[2],
            "and that holds for a third order too"
        );
        let (carried, discarded) = &answers[0];
        assert_eq!(*discarded, 1, "one entry over capacity is one eviction");
        assert!(
            carried.contains(&(2, TWO.to_owned())),
            "the separator that makes the two A states two observations survives"
        );
        assert!(
            carried.iter().any(|(sequence, _)| *sequence == 257),
            "so does the newest state of the busiest path"
        );
        assert!(
            !carried.iter().any(|(sequence, _)| *sequence == 1),
            "and the lowest entry of that path is what left"
        );
    } // End of function a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in()

    #[test]
    fn an_arrival_below_everything_a_full_queue_holds_is_the_entry_that_leaves() {
        // The boundary of the bound, and the reason the loop tests `>` after the
        // insert rather than `>=` before it: the queue is exactly full and the
        // arrival is lower than every entry in it. Evicting first made room by
        // dropping a *resident* entry and then stored the older arrival, so
        // what a full queue held depended on what arrived last.
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        for index in 0..QUEUE_CAPACITY as u64 {
            let path = format!("match/{index}.yml");
            queue.enqueue(changed(index + 2, 1, &path, ONE));
        } // End of the loop that fills the queue exactly
        assert_eq!(queue.pending(), QUEUE_CAPACITY);
        let wake = queue
            .enqueue(changed(1, 1, "match/late.yml", TWO))
            .expect("an arrival the bound evicts owes a wake like any other");
        assert_eq!(
            wake.newest_sequence,
            QUEUE_CAPACITY as u64 + 1,
            "the wake names what the queue holds, never what arrived"
        );
        let batch = queue.drain(0, &workspace);
        assert_eq!(batch.discarded, 1);
        assert_eq!(batch.observations.len(), QUEUE_CAPACITY);
        assert_eq!(
            batch
                .observations
                .first()
                .map(ExternalObservation::sequence),
            Some(2),
            "every path holds one entry, so the tie goes to the lowest sequence — \
             which is the arrival itself, and the queue holds what it held before"
        );
    } // End of function an_arrival_below_everything_a_full_queue_holds_is_the_entry_that_leaves()

    #[test]
    fn a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state() {
        // Round 3's second counterexample. Document B has one observation;
        // document A then produces QUEUE_CAPACITY identical ones. With the
        // globally lowest sequence as the victim, B's only state was the first
        // thing to go — so a repeat stream for one file cost the consumer a
        // second file entirely and obliged a whole-workspace reload, where the
        // fold alone would have cost nothing.
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(changed(1, 1, "match/b.yml", TWO));
        for sequence in 2..=QUEUE_CAPACITY as u64 + 1 {
            queue.enqueue(changed(sequence, 1, "match/a.yml", ONE));
        } // End of the loop that overfills the queue with one path's repeats
        assert_eq!(queue.pending(), QUEUE_CAPACITY);
        let batch = queue.drain(0, &workspace);
        assert_eq!(
            sequences_and_text(&batch),
            vec![
                (1, TWO.to_owned()),
                (QUEUE_CAPACITY as u64 + 1, ONE.to_owned()),
            ],
            "B's only state survives and A's repeats fold onto their highest: {batch:?}"
        );
        assert_eq!(
            batch.discarded, 1,
            "the entry that left belonged to the busiest path, and it is still a loss"
        );
    } // End of function a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state()

    #[test]
    fn a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        // One observation per document, so every entry is its document's only
        // state and nothing can survive on another entry's behalf. This is also
        // where the eviction policy degenerates to the lowest sequence: with
        // every path holding one entry, no path is busier than another.
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
            disk_revision,
            content: ChangedContent::Projected {
                disk_text, disk, ..
            },
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
    fn a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text() {
        // Round 4's finding 2, and the whole of what R3 had left. This state was
        // routed to `ExternalObservation::Unreadable`, which carries neither
        // revision — so `previous_revision` and `disk_revision`, the two operands
        // the consult's Q3 puts on a `Changed`, were **discarded by the
        // routing** and no consumer could recover either from the value it was
        // handed. The bytes are still not shown, and never were the question.
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        let before = ContentRevision::of_bytes(ONE.as_bytes());
        let after = ContentRevision::of_bytes(&[0xff, 0xfe]);
        queue.enqueue(AdmittedObservation {
            sequence: 1,
            epoch: 1,
            observation: Observation::Changed {
                path: PathBuf::from("match/a.yml"),
                previous_revision: Some(before),
                content: StableContent::NotUtf8 {
                    revision: after,
                    offset: 0,
                },
                correspondences: None,
            },
        });
        let batch = queue.drain(0, &workspace);
        let ExternalObservation::Changed {
            previous_revision,
            disk_revision,
            content,
            ..
        } = &batch.observations[0]
        else {
            panic!("a change stays a Changed whether or not its bytes are text: {batch:?}");
        };
        assert_eq!(
            *previous_revision,
            Some(before),
            "the revision the engine held survives the content arm"
        );
        assert_eq!(
            *disk_revision, after,
            "and so does the hash of the exact bytes now on disk"
        );
        assert_eq!(
            *content,
            ChangedContent::Unreadable {
                reason: UnreadableReason::NotUtf8 { offset: 0 },
            },
            "the change carries why there is no projection, never a bare absence"
        );
    } // End of function a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text()

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
            document:
                ObservedDocument::Addressable {
                    document,
                    relative_path,
                },
            ..
        } = &batch.observations[0]
        else {
            panic!("a path this workspace discovered is addressable: {batch:?}");
        };
        assert_eq!(
            *document,
            workspace
                .document_id(&known)
                .expect("the workspace discovered this file"),
            "the strongest arm names the identity the open workspace itself resolves"
        );
        assert_eq!(
            relative_path.to_string_lossy(),
            "match/known.yml",
            "and it carries the display path too, like every other arm"
        );
        let ExternalObservation::Removed {
            document: ObservedDocument::Unnamed { relative_path },
            ..
        } = &batch.observations[1]
        else {
            panic!("a path nothing in this process has named has no identity: {batch:?}");
        };
        assert_eq!(
            relative_path.to_string_lossy(),
            "match/stranger.yml",
            "the path is rendered against the configuration root"
        );
    } // End of function a_path_the_workspace_never_discovered_crosses_as_a_display_path()

    #[test]
    fn an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address() {
        // Round 4's finding 1, in its own words: epoch 1 opens a root holding
        // `match/a.yml` and mints an identity for it; the file goes away and
        // epoch 2 reopens the same root without it; the path is recreated but
        // stable reads fail, so the observation is `Unreadable`. The identity
        // register still answers with epoch 1's number — it is not scoped to a
        // workspace, an epoch or a moment — while the epoch-2 workspace refuses
        // that number as `UnknownDocument`. Asking the register alone therefore
        // sent `Known { document }` **and omitted the display path**, so the
        // consumer was handed a number the current workspace rejects and nothing
        // else. This is what the deleted `an_identity_issued_in_one_epoch_
        // addresses_nothing_in_the_next` was protecting: stable path identity
        // survives an epoch, and current addressability does not.
        let dir = tempfile::TempDir::new().expect("a temporary directory");
        std::fs::create_dir_all(dir.path().join("match")).expect("the match directory");
        let file = dir.path().join("match").join("a.yml");
        std::fs::write(&file, ONE).expect("the file epoch 1 discovers");
        let first = Workspace::discover(Some(dir.path())).expect("epoch 1 opens");
        let minted = first
            .document_id(&file)
            .expect("epoch 1 discovered this file");

        std::fs::remove_file(&file).expect("the file goes away");
        let second = Workspace::discover(Some(dir.path())).expect("epoch 2 opens");
        assert!(
            second.document_id(&file).is_none(),
            "epoch 2 never enumerated this path, so it resolves nothing for it"
        );
        assert!(
            second.document_context(minted).is_err(),
            "and it refuses epoch 1's identity, which is the whole finding"
        );

        let queue = queue_at_epoch(2);
        queue.enqueue(AdmittedObservation {
            sequence: 1,
            epoch: 2,
            observation: Observation::Unreadable {
                path: file.clone(),
                kind: io::ErrorKind::PermissionDenied,
            },
        });
        let batch = queue.drain(0, &second);
        assert_eq!(
            batch.observations[0],
            ExternalObservation::Unreadable {
                sequence: 1,
                document: ObservedDocument::Named {
                    document: minted,
                    relative_path: WirePath::from(PathBuf::from("match/a.yml")),
                },
                reason: UnreadableReason::PermissionDenied {},
            },
            "an identity a replaced workspace minted is named beside its path and is never \
             offered as an address this workspace resolves: {batch:?}"
        );
    } // End of function an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address()

    #[test]
    fn an_added_file_carries_a_row_whose_parse_this_session_does_not_hold() {
        let queue = queue_at_epoch(1);
        let (_dir, workspace) = empty_workspace();
        queue.enqueue(added(1, 1, "match/new.yml", ONE));
        let batch = queue.drain(0, &workspace);
        let ExternalObservation::Added {
            document_summary,
            content,
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
        let AddedContent::Projected { disk, .. } = content else {
            panic!("readable bytes project: {content:?}");
        };
        assert_eq!(disk.matches.len(), 1);
    } // End of function an_added_file_carries_a_row_whose_parse_this_session_does_not_hold()

    #[test]
    #[should_panic(expected = "one register means one identity per path")]
    fn a_snapshot_identity_the_open_workspace_contradicts_is_a_failure_and_never_a_wire_value() {
        // **Round 6's Low 1, and the release half of round 5's.** With the
        // agreement carried by a `debug_assert_eq!`, a release build compiled
        // the check out and crossed `Addressable` with the **workspace's**
        // number beside a projection addressed by the **snapshot's** — one
        // observation carrying two identities for one file, since a
        // `DocumentView` has its own `id` and every `MatchId` beneath it carries
        // that. **No arm of `ObservedDocument` makes that object honest, which
        // is not the same as no arm being true** — round 7 of this phase's
        // review corrected this comment, which said the second. `Addressable`
        // carrying the number the workspace gave is true of the number it
        // carries; what is false is the observation built around it, whose
        // projection is addressed by the snapshot's. So the policy is a failure
        // rather than a value, and `assert_eq!` is what makes it one on every
        // profile.
        //
        // **Round 5 said no test was possible and it was right about the code it
        // had**: a `debug_assert_eq!` would have made this pass in a debug build
        // and fail in a release one, which is a test that measures the profile.
        // This one does not.
        //
        // Nothing in the production pipeline reaches it — `Workspace::from_tree`
        // and `watch::engine` mint through one register, so a path has one
        // number in both — and the disagreement is fabricated here exactly as
        // the `crate::commands` fixture round 5 repaired had fabricated it by
        // accident.
        let dir = tempfile::TempDir::new().expect("a temporary directory");
        std::fs::create_dir_all(dir.path().join("match")).expect("the match directory");
        let known = dir.path().join("match").join("known.yml");
        std::fs::write(&known, ONE).expect("the known file is written");
        let workspace = Workspace::discover(Some(dir.path())).expect("the workspace opens");
        let resolved = workspace
            .document_id(&known)
            .expect("the workspace discovered the file it just walked over");
        let _ = address_of_minted(&known, DocumentId(resolved.get() + 1), &workspace);
    } // End of function a_snapshot_identity_the_open_workspace_contradicts_is_a_failure_and_never_a_wire_value()

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
        // The other arm of each nested content enum, which is the whole reason
        // these two are here: a `Changed` and an `Added` whose stabilized bytes
        // are not UTF-8 carry `ChangedContent::Unreadable` and
        // `AddedContent::Unreadable`, and those two crossed as nothing at all in
        // this test until round 5 of this phase's review.
        queue.enqueue(AdmittedObservation {
            sequence: 5,
            epoch: 1,
            observation: Observation::Changed {
                path: PathBuf::from("match/e.yml"),
                previous_revision: Some(ContentRevision::of_bytes(ONE.as_bytes())),
                content: StableContent::NotUtf8 {
                    revision: ContentRevision::of_bytes(&[0xff, 0xfe]),
                    offset: 0,
                },
                correspondences: None,
            },
        });
        queue.enqueue(AdmittedObservation {
            sequence: 6,
            epoch: 1,
            observation: Observation::Added {
                file: DiscoveredFile {
                    path: PathBuf::from("match/f.yml"),
                    kind: FileKind::MatchFile,
                    relative_path: PathBuf::from("match/f.yml"),
                    disabled: false,
                },
                content: StableContent::NotUtf8 {
                    revision: ContentRevision::of_bytes(&[0xff, 0xfe]),
                    offset: 0,
                },
            },
        });
        // **The remaining four `UnreadableReason` variants, so the walk below
        // covers all six rather than three of them.** Round 6 of this phase's
        // review is why they are here: round 5 added a walk over that enum and
        // covered `NotUtf8` and `PermissionDenied`, and argued that the rule
        // being uniform across the enum made the other four unnecessary — which
        // is a coverage argument, and this project has now had four rounds in
        // which a coverage argument stood in for coverage and was wrong. Turning
        // `InvalidData {}` into a unit variant would have crossed as a bare
        // string with the old walk green. Each takes a path of its own, because
        // the fold is per path and two reasons for one path would coalesce.
        for (sequence, name, kind) in [
            (7_u64, "match/g.yml", io::ErrorKind::InvalidData),
            (8, "match/h.yml", io::ErrorKind::TimedOut),
            (9, "match/i.yml", io::ErrorKind::Interrupted),
            // Everything the closed list does not name, which is the `Other`
            // arm — the one variant that is reachable only through the
            // wildcard.
            (10, "match/j.yml", io::ErrorKind::WouldBlock),
        ] {
            queue.enqueue(AdmittedObservation {
                sequence,
                epoch: 1,
                observation: Observation::Unreadable {
                    path: PathBuf::from(name),
                    kind,
                },
            });
        } // End of the loop that admits one read failure per remaining reason
        let batch = queue.drain(0, &workspace);
        let json = serde_json::to_value(&batch).expect("a batch serializes");
        let observations = json["observations"]
            .as_array()
            .expect("observations is an array");
        assert_eq!(observations.len(), 10);
        for (index, name) in [
            "Changed",
            "Added",
            "Removed",
            "Unreadable",
            "Changed",
            "Added",
            "Unreadable",
            "Unreadable",
            "Unreadable",
            "Unreadable",
        ]
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
        } // End of the loop over the ten observations of the four kinds
          // The two nested content enums follow the same rule, and D5 is about
          // every wire enum rather than about the outer one: a `Changed` and an
          // `Added` each carry a one-key object under `content`. **Both arms of
          // both of them**, which is the property and not a longer list: a unit
          // variant, or a Serde shape that made one of these cross as a bare
          // string, is exactly what this walk exists to catch, and a walk over
          // the projected arms alone left the two unreadable ones free to
          // regress under it.
        for (index, outer, arm) in [
            (0, "Changed", "Projected"),
            (1, "Added", "Projected"),
            (4, "Changed", "Unreadable"),
            (5, "Added", "Unreadable"),
        ] {
            let content = &observations[index][outer]["content"];
            let tagged = content
                .as_object()
                .unwrap_or_else(|| panic!("{outer}'s content crosses as an object: {json}"));
            assert_eq!(tagged.len(), 1, "one tag per value: {tagged:?}");
            // `get` rather than an index, so a tag that is missing altogether —
            // an untagged or renamed variant — fails with this sentence instead
            // of panicking inside `serde_json`'s own index.
            assert!(
                tagged.get(arm).is_some_and(serde_json::Value::is_object),
                "{outer}'s {arm} content is tagged by its variant name and carries an object, \
                 never a bare string: {json}"
            );
        } // End of the loop over both arms of the two nested content enums
          // And one level down again, because walking only the enums a finding
          // named is how a narrower instance of that finding survives it.
          // `UnreadableReason` is a wire enum as much as the two above, and its
          // five operandless variants are written as struct variants for exactly
          // this rule, so each must cross tagged and as an object rather than as
          // a bare string.
          //
          // **All six arms cross here, not three of them.** Round 5 walked
          // `NotUtf8` and `PermissionDenied` and argued that the rule is uniform
          // across the enum, so the other four needed no fixture; round 6
          // refused the argument, because a coherent change of `InvalidData {}`
          // to a unit variant is exactly what a walk over a subset cannot see.
          //
          // **What `wire_tag` forces, exactly.** It matches the enum
          // exhaustively, so a seventh variant is a **compile error here** and
          // not a silent gap — which forces a decision at this test and does
          // **not** force a fixture for the new arm: keeping `EVERY_REASON` in
          // step with the enum is still a reader's job, and this comment says so
          // rather than leaving the guard to look stronger than it is.
        fn wire_tag(reason: &UnreadableReason) -> &'static str {
            match reason {
                UnreadableReason::NotUtf8 { .. } => "NotUtf8",
                UnreadableReason::PermissionDenied {} => "PermissionDenied",
                UnreadableReason::InvalidData {} => "InvalidData",
                UnreadableReason::TimedOut {} => "TimedOut",
                UnreadableReason::Interrupted {} => "Interrupted",
                UnreadableReason::Other {} => "Other",
            }
        } // End of function wire_tag()
        const EVERY_REASON: [UnreadableReason; 6] = [
            UnreadableReason::NotUtf8 { offset: 0 },
            UnreadableReason::PermissionDenied {},
            UnreadableReason::InvalidData {},
            UnreadableReason::TimedOut {},
            UnreadableReason::Interrupted {},
            UnreadableReason::Other {},
        ];
        let reasons = [
            (&observations[3]["Unreadable"]["reason"], "PermissionDenied"),
            (
                &observations[4]["Changed"]["content"]["Unreadable"]["reason"],
                "NotUtf8",
            ),
            (
                &observations[5]["Added"]["content"]["Unreadable"]["reason"],
                "NotUtf8",
            ),
            (&observations[6]["Unreadable"]["reason"], "InvalidData"),
            (&observations[7]["Unreadable"]["reason"], "TimedOut"),
            (&observations[8]["Unreadable"]["reason"], "Interrupted"),
            (&observations[9]["Unreadable"]["reason"], "Other"),
        ];
        let walked: BTreeSet<&str> = reasons.iter().map(|(_, arm)| *arm).collect();
        let declared: BTreeSet<&str> = EVERY_REASON.iter().map(wire_tag).collect();
        assert_eq!(
            walked, declared,
            "every arm of UnreadableReason is serialized by this batch, and a fixture removed \
             later fails here rather than leaving an arm unwalked"
        );
        for (reason, arm) in reasons {
            let tagged = reason
                .as_object()
                .unwrap_or_else(|| panic!("a reason crosses as an object: {json}"));
            assert_eq!(tagged.len(), 1, "one tag per value: {tagged:?}");
            assert!(
                tagged.get(arm).is_some_and(serde_json::Value::is_object),
                "the {arm} reason is tagged by its variant name and carries an object, never a \
                 bare string: {json}"
            );
        } // End of the loop over every reason this batch puts on the wire
          // **Every** arm of an address carries the display path, whichever arm
          // it is, so no consumer is ever handed a number as its only handle on
          // a file. Which arm each of these lands in is not this test's subject
          // and is not stable across a test binary either: the identity register
          // is process-wide, so another test in this process may already have
          // named one of these paths.
        for (index, kind) in [
            (0, "Changed"),
            (2, "Removed"),
            (3, "Unreadable"),
            (4, "Changed"),
            (6, "Unreadable"),
            (7, "Unreadable"),
            (8, "Unreadable"),
            (9, "Unreadable"),
        ] {
            let document = observations[index][kind]["document"]
                .as_object()
                .unwrap_or_else(|| panic!("{kind} carries an address object: {json}"));
            let (arm, operands) = document
                .iter()
                .next()
                .unwrap_or_else(|| panic!("{kind}'s address carries one tag: {json}"));
            assert_eq!(document.len(), 1, "one tag per value: {document:?}");
            assert!(
                operands["relative_path"].is_string(),
                "{kind}'s {arm} arm carries the display path: {json}"
            );
        } // End of the loop over every observation that carries an address
          // An `Added` carries no `ObservedDocument` because its row already says
          // both things one would say — including the one whose bytes are not
          // text, which is why that arm mints an identity at all.
        assert!(observations[1]["Added"]["document_summary"]["relative_path"].is_string());
        assert!(observations[5]["Added"]["document_summary"]["relative_path"].is_string());
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
            previous_revision,
            content: ChangedContent::Projected { disk_text, .. },
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
            ObservedDocument::Addressable {
                document: workspace
                    .document_id(&file)
                    .expect("the workspace discovered this file"),
                relative_path: WirePath::from(PathBuf::from("match/a.yml")),
            },
            "the engine and the workspace agree on one path's identity, and the open \
             workspace resolving it is what makes this the addressable arm"
        );
    } // End of function a_real_engines_conclusion_reaches_the_queue_and_names_the_workspaces_document()
}
