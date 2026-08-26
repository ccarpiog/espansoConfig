//! The liveness contract of the observation pipeline — the one place it is
//! stated.
//!
//! This module declares no type, no function and no constant. It exists because
//! the same guarantee was **paraphrased** in roughly twenty doc comments, module
//! headers, comments and assertion messages across this crate and the
//! application shell, and fourteen consecutive review rounds of Phase 2d-3 each
//! found at least one of those paraphrases claiming something the code refuses:
//! that the engine *must answer* an owed observation, that a rollback *observes
//! the path again*, that a refusal *re-owes* the path. **Every paraphrase is a
//! surface on which the claim can be false.** This module reduces that count to
//! one.
//!
//! # How to consume this, and it is the whole point of the module
//!
//! **Point, do not restate.** A passage that needs the general guarantee links
//! here — an intra-doc link to `crate::watch::liveness` from this crate, or to
//! `espansoconfig_core::watch::liveness` from the application shell — and says
//! no more about it. A passage that states a fact about **its own** call site
//! keeps that fact and links here for the rest. **A pointer that restates the
//! claim beside itself has bought nothing**, because the restatement is exactly
//! the surface the pointer was supposed to remove.
//!
//! Both crates deny `rustdoc::broken_intra_doc_links`, so renaming or deleting
//! this module **breaks the build** rather than silently orphaning the pointers.
//!
//! Every clause below is derived from the item named beside it and from nothing
//! else. Where that item lives in the application shell it is named as **plain
//! text** rather than linked: this crate never depends on `tauri` (CLAUDE.md
//! section 3), so an intra-doc link to it could not resolve.
//!
//! # What is guaranteed
//!
//! 1. **An owed observation may not be discharged by coalescing it into
//!    silence.** [`ObservationEngine::observe_owed`] records the path in the
//!    engine's debt set beside the hint it schedules, and the settlement then
//!    ignores its own coalescing rule: `settle_present` skips the comparison
//!    against the tracked state entirely while a debt stands, `settle_missing`
//!    emits `Observation::Removed { previous_revision: None }` for a path
//!    nothing was ever tracked for, and `settle_failed` emits likewise. A
//!    settlement that runs while a debt stands therefore **emits**.
//! 2. **A debt stands until a settlement of that path emits.** The engine's
//!    `settle` removes the debt before running those three settlement kinds and
//!    **puts it back** when none of them produced an observation, so a debt is
//!    spent by the settlement that answers it and by nothing else **within one
//!    engine's life** — the fourth *not guaranteed* clause below is the other
//!    side of that qualification. Two requests before one settlement are one
//!    debt: the debt set is keyed by path and carries no identity of who asked.
//! 3. **A rollback restores the prior tracked state, unconditionally.**
//!    [`ObservationEngine::revert_settlement`] takes the most recent
//!    [`ObservationEngine::tick`]'s record for that path and reinstalls the
//!    tracked state that settlement replaced — or removes the entry where
//!    nothing was tracked before it. **The restore is unconditional and the
//!    re-entry into the pipeline is not**: both of the arms it ends in drop a
//!    path outside the two [`crate::watch::watched_roots`], so an unwatched path
//!    is restored and then waits for a rescan rather than being scheduled. Every
//!    path this engine can settle entered through that same check, so the two
//!    halves cannot come apart today; that they could is stated rather than
//!    assumed (`docs/decisions/2d-3-notes.md` §5 item 17).
//! 4. **A rollback restores a debt only where the settlement being taken back
//!    had discharged one.** What `settle` stored beside the replaced state is
//!    *whether that settlement discharged a debt*, and
//!    [`ObservationEngine::revert_settlement`] ends by asking exactly that: an
//!    owed settlement goes back through [`ObservationEngine::observe_owed`] and
//!    every other settlement goes back through [`ObservationEngine::hint`]. An
//!    ordinary native-hint settlement discharged no debt, so taking it back
//!    **re-hints** the path and never re-owes it — and a hint is precisely what
//!    the sixth *not guaranteed* clause below says may be coalesced away.
//! 5. **A refusal at the admission gate publishes nothing and clears no
//!    record.** This is the application shell's half — the `decide` function of
//!    `src-tauri/src/ledger.rs` and its `Admission::PrecedesACommit` arm, which
//!    mutates the tally and nothing else — and it is stated here rather than
//!    only there
//!    because the two halves are one contract, and keeping them apart is what
//!    let a paraphrase of one be written as a claim about the other. It stands
//!    on the rollback and the retained record alone, so **no clause above or
//!    below is a premise of it**.
//!
//! # What is expressly NOT guaranteed
//!
//! 1. **That any settlement will ever emit.** [`ObservationEngine::tick`]
//!    advances only paths whose deadline has passed, and settles only where two
//!    consecutive reads are equal; where they disagree it re-arms the probe with
//!    the newer read. **A path written continuously never reaches that equality,
//!    so it is never answered at all**, and the debt waits with it —
//!    [`ObservationEngine::observe_owed`]'s own *what this does not do*
//!    paragraph says so.
//! 2. **That the caller keeps ticking.** `now` is an argument everywhere and
//!    this engine never reads a clock of its own, so a caller that stops calling
//!    [`ObservationEngine::tick`] has pending paths and no observations. Nothing
//!    in the type system requires the loop.
//! 3. **That a request reaches a pipeline at all.**
//!    [`ObservationEngine::observe_owed`] drops a path outside the two
//!    [`crate::watch::watched_roots`] exactly as [`ObservationEngine::hint`]
//!    drops it, and **records no debt** for it, so a caller whose spelling of a
//!    path differs from this engine's root spelling is answered by silence.
//! 4. **That a worker outlives the request.** In the application shell a
//!    re-observation is a message on the watcher worker's inbox —
//!    `src-tauri/src/watch.rs`'s `WorkerMessage::ReObserve`, declared beside
//!    `WorkerMessage::Stop`. A worker may absorb the first and consume the
//!    second before its next tick, and an engine is dropped with its worker.
//! 5. **That an `Asked` is an observation.** `src-tauri/src/watch.rs`'s
//!    `ReObserveOutcome::Asked` is produced by a successful channel send and by
//!    nothing else: it promises that the request reached the inbox of a worker
//!    that had not yet exited, never that anything will be observed.
//!    `ReObserveOutcome::NoWatcher` says nothing was asked.
//! 6. **That a plain hint survives.** [`ObservationEngine::hint`] asks *has
//!    anything changed since I last told you*, and `settle_present` answers it
//!    against the tracked state — returning nothing where the stabilized
//!    revision equals the one already tracked. **A hint is therefore coalesced
//!    into silence whenever the disk holds what the engine already tracks**,
//!    which is the ordinary and correct outcome, and the reason the fourth
//!    *guaranteed* clause is conditional.
//!
//! # What this module is not
//!
//! **It is documentation, and nothing in the type system makes a consumer point
//! here rather than restate.** What keeps the positions pointing is
//! `src-tauri/src/liveness_contract.rs`, a test that sweeps both source trees
//! for the shape family of these claims and fails on any hit its recorded
//! inventory does not carry. That catches an **unmarked** claim and a **new**
//! claim, and it **cannot judge whether a passage's claim is true**: a passage
//! that carries a pointer and still says something false passes it.
//!
//! **It is not a statement about native delivery.** Whether the operating
//! system reports a change, and with what latency, is [`crate::watch::native`]'s
//! subject and `docs/decisions/2d-2-notes.md` §2.3's — which expressly declines
//! to cover a backend that stops delivering without reporting anything. Every
//! clause above is about what this engine does with a hint it is given.
//!
//! [`ObservationEngine::hint`]: crate::watch::engine::ObservationEngine::hint
//! [`ObservationEngine::observe_owed`]: crate::watch::engine::ObservationEngine::observe_owed
//! [`ObservationEngine::revert_settlement`]: crate::watch::engine::ObservationEngine::revert_settlement
//! [`ObservationEngine::tick`]: crate::watch::engine::ObservationEngine::tick
