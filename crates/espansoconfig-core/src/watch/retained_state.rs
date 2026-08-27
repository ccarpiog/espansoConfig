//! The scoped-lifetime contract of the observation pipeline's retained state —
//! the one place it is stated.
//!
//! This module declares no type, no function and no constant, exactly as
//! [`crate::watch::liveness`] does. It exists because one family of claims —
//! **how long does a piece of retained pipeline state survive, and under what
//! scope** — was paraphrased at some fifty positions across this crate and the
//! application shell, and **three consecutive audits of Phase 2d-4a each found
//! one of those paraphrases claiming something the code refuses**. Round 5 of
//! its review found the retention boundary counting two ways an entry leaves a
//! queue that has three; round 6 found the same shape one level up, on the
//! watermark a consumer stores; and the implementation step that wrote this
//! module found a third instance in the ledger, one subsystem over. Two of the
//! three were review rounds and the third was not, which is why *audits* rather
//! than *review rounds* — this sentence said the latter until Phase 2d-4a-C's
//! round 1, counting an implementation step as a round that had not run.
//! **Every paraphrase is a surface on which the claim can be false**, and this
//! module reduces that count to one. Round 1 of this phase's own review then
//! found a fourth instance, in clause 9 below.
//!
//! # What the family is, and where its boundary is drawn
//!
//! **Retained pipeline state**: the values this application keeps *between* one
//! observation and the next, so that a later observation, a later drain or a
//! later save decision can be taken against them. There are exactly three
//! holders of it, and the family spans two crates because they do:
//!
//! - this crate's **process-wide identity register** (the private table behind
//!   [`crate::workspace::identity_of`]);
//! - the application shell's **write ledger** — `src-tauri/src/ledger.rs`'s
//!   app-write records, their path index, the announced-state map, the per-path
//!   commit anchors, the sequence allocator and the decision tally;
//! - the application shell's **reconciliation queue** —
//!   `src-tauri/src/reconciliation.rs`'s pending set, acknowledged watermark and
//!   loss count.
//!
//! The clauses below cover those, and the numbers derived from them that a
//! consumer stores: a batch's `newest_sequence` and `discarded`, a wake's
//! `newest_sequence`, and an admitted observation's sequence.
//!
//! **The boundary is drawn around the claims and never around the vocabulary of
//! the mechanism**, which is [`crate::watch::liveness`]'s own principle applied
//! to a second family. `crate::persist::backup` holds some forty occurrences of
//! retention vocabulary and is about **backup-file rotation** — a different
//! subsystem, about files on disk — so it is outside this contract, and a
//! pattern widened to every occurrence of *retained* would buy that noise and
//! not one claim. So are the scopes the language already keeps: a mutex guard,
//! a borrow, a [`crate::watch::native::NativeWatch`] handle, a worker thread's
//! inbox. What is inside is a claim a **consumer's correctness depends on**:
//! whether the thing it is holding a number or a projection against is still
//! there, and for how long.
//!
//! # How to consume this, and it is the whole point of the module
//!
//! **Point, do not restate.** A passage that needs the general guarantee links
//! here — an intra-doc link to `crate::watch::retained_state` from this crate,
//! or to `espansoconfig_core::watch::retained_state` from the application shell
//! — and says no more about it. A passage that states a fact about **its own**
//! item keeps that fact and links here for the rest. **A pointer that restates
//! the claim beside itself has bought nothing**, because the restatement is
//! exactly the surface the pointer was supposed to remove.
//!
//! Both crates deny `rustdoc::broken_intra_doc_links`, so renaming or deleting
//! this module **breaks the build** rather than silently orphaning the pointers.
//!
//! Every clause below is derived from the item named beside it and from nothing
//! else. Where that item lives in the application shell it is named as **plain
//! text** rather than linked: this crate never depends on `tauri` (CLAUDE.md
//! section 3), so an intra-doc link to it could not resolve. **Two of the three
//! holders are that shell's**, and the tension is stated rather than smoothed
//! over: this crate does not own the queue or the ledger, and states their
//! lifetime rules anyway, for [`crate::watch::liveness`]'s reason — the halves
//! are one contract, and keeping them apart is what let a paraphrase of one be
//! written as a claim about the other.
//!
//! # What is guaranteed
//!
//! 1. **A path's identity outlives every other scope in this application.**
//!    [`crate::workspace::identity_of`] mints on first sight into a
//!    process-wide, path-keyed table, and **nothing removes an entry from it**,
//!    so one path answers one number for as long as the process runs — a
//!    workspace replacement, a new epoch and a recreation at that path all
//!    included. [`crate::workspace::identity_already_issued`] is the read-only
//!    half and says so in its own words. **An identity is not an address**: only
//!    [`crate::workspace::Workspace::document_id`] answers whether the *open*
//!    workspace holds a path, and the two answers legitimately differ.
//! 2. **Everything else the pipeline retains is scoped to one workspace epoch,
//!    and a replacement discards it whole.** `WorkspaceSession::open` calls two
//!    `begin_epoch`s in one session-lock block: the ledger's clears the
//!    app-write records, their path index, the announced states, the commit
//!    anchors and the sequence allocator; the queue's assigns a fresh state, so
//!    the pending set, the acknowledged watermark and the loss count go
//!    together. Clause 8 below is the one exception, and it is deliberate.
//! 3. **A sequence is unique and strictly increasing within its epoch, and
//!    means nothing across two.** The ledger's allocator starts each epoch at
//!    its first sequence and is reset by that same `begin_epoch`, and the
//!    admitted decision is the only one that spends a number. So there is no
//!    order between a predecessor epoch's sequence and a successor's for
//!    anything to be compared along.
//! 4. **A stored queue entry leaves in exactly three ways, and only the first
//!    two depend on the entry**: a later drain acknowledges it, an overflow
//!    evicts it, or the queue adopts a replacement epoch and discards
//!    everything the previous one held. The first is the consumer saying it
//!    holds the observation; the second is a loss the batch counts; **the third
//!    is counted nowhere**, because the successful open that causes it has
//!    already replaced the workspace a reload would fetch. *Exactly three* rests
//!    on a reading and not on a test: the pending map is mutated in exactly four
//!    places — the insert and the eviction inside the enqueue, the retain inside
//!    the drain, and the whole-state assignment inside `begin_epoch` — which was
//!    established by reading every mutation of that field, not by anything that
//!    fails when a fifth appears.
//! 5. **The pending set is bounded, and the bound counts entries.** Its
//!    capacity is a fixed number of undrained observations per epoch, and the
//!    victim an overflow takes is the lowest pending sequence of the path
//!    holding the most pending entries, ties between equally busy paths broken
//!    by the lower of their lowest sequences. What that buys is one invariant:
//!    **a path with one pending entry is never the victim while another path
//!    has two.**
//! 6. **Within the epoch a batch names, its `newest_sequence` never falls.** So
//!    a caller showing that epoch stores it unconditionally, out-of-order drains
//!    included: the drain answers the highest of its own batch and the watermark
//!    this queue has been acknowledged with **since the epoch in that state was
//!    adopted**, which is the only watermark that state holds. **Across a
//!    replacement epoch it falls, and that is not a walk-back** — clause 3 is
//!    why there is no order between the two numbers, and the batch's own epoch
//!    is what separates them.
//! 7. **A batch's loss count is cumulative and monotonic within the epoch, and
//!    reads zero again in the successor.** It counts the two arrivals a queue
//!    refuses or evicts, so a non-zero value does not say the loss happened
//!    since the previous drain; what it says is that **this epoch's** history
//!    has a hole in it.
//! 8. **The ledger's decision tally is the one retained value whose life is the
//!    session.** Cumulative and never reset, unlike every map beside it,
//!    because four of the decisions it counts are otherwise indistinguishable
//!    from a watcher that noticed nothing (`PROGRESS.md` R24).
//! 9. **An app-write record lives as long as its suppression licence; a path's
//!    latest-commit anchor is maintained until the epoch is replaced, and a
//!    later commit to that path supersedes its value.** Four things end the
//!    record — supersession by a later committed write to the same document,
//!    **a reading that survives both of the ledger's retaining checks**, a
//!    reload onto other bytes, and a workspace replacement. The anchor half is
//!    a claim about the **per-path slot and the chronology fact it answers** —
//!    *when did this session last commit to this path* — and **exactly one
//!    thing removes that: the workspace replacement.** It is **not** a claim
//!    about the concrete `CommitAnchor` value: `record_app_write` inserts a
//!    fresh one on every committed write, so a later commit to the same path
//!    drops the one before it, the slot is never left empty, and the fact stays
//!    true precisely *because* the value was replaced — the replacement is what
//!    *latest* means. Saying *a commit anchor lives as long as the epoch*
//!    asserted one lifetime for all three, and it is Phase 2d-4a-C's round-1
//!    High: this family is defined as retained **values** above, which is what
//!    makes the difference a defect and not a quibble. **What a consumer
//!    depends on is unchanged, and it rests on three distinct facts rather
//!    than on one universal.** *Within* the retained epoch, a reading or a
//!    reload that clears a record does not touch the anchor:
//!    `clear_the_record_at` removes the record and its path index and
//!    expressly leaves `latest_commit_at` alone. **Supersession preserves the
//!    per-path slot**, replacing its value with the *newer* anchor, so the
//!    committed write that ends a record by superseding it leaves the path
//!    anchored. **A workspace replacement does clear the anchor**, and it
//!    costs nothing: a predecessor epoch's observation is refused by the epoch
//!    fence *before* chronology is consulted, and clause 3 is why its numbers
//!    have nothing to be compared along. So a stamped reading older than this
//!    epoch's latest commit to a path is refused even where the record it
//!    would have been matched against is gone. **Saying instead that *none of
//!    the record's four ends touches the anchor* is false of two of them** —
//!    supersession replaces the value, and the workspace replacement clears
//!    the slot — and that sentence is Phase 2d-4a-C's **round-2 High**,
//!    written by the round-1 fix round into the same clause where it had just
//!    separated the three.
//!    The two were one value until Phase 2d-3's round 9, and pairing them is
//!    what let a clearing of the first destroy the second.
//!
//! # What is expressly NOT guaranteed
//!
//! 1. **That the identity register is bounded.** It grows by one entry — a path
//!    and a number — per distinct path this process has ever named, fed by
//!    [`crate::workspace::Workspace::from_tree`] at discovery and by
//!    [`crate::watch::engine`] at every projection, and **nothing evicts from
//!    it, nothing caps it and nothing measures it.** Create, stabilize and
//!    remove arbitrarily many distinct watched paths while draining regularly:
//!    every queue downstream stays capped and this table retains all of them.
//!    Eviction is refused rather than unconsidered — a forgotten path gets a
//!    *different* number on its next mention, which strands whatever a consumer
//!    holds under the old one. This is `docs/decisions/2d-4a-notes.md` R9, open
//!    by three review rounds' verdicts, and it is stated here as the unbounded
//!    retention it is rather than closed by a sentence.
//! 2. **That the ledger's per-epoch maps are bounded within their epoch.** The
//!    announced-state map holds one entry per distinct path announced under the
//!    epoch and the commit-anchor map one per distinct path this session has
//!    committed to under it. **A path's slot** leaves them one at a time only
//!    where that path's fact stops being true — clause 9's distinction read
//!    here too, since an anchor's *value* is dropped by every later commit to
//!    that path while its slot stays; nothing prunes either map as a whole
//!    before the epoch ends (`docs/decisions/2d-3-notes.md` §5 item 27). The
//!    queue's capacity bounds the queue and nothing else.
//! 3. **That the queue's bound is a bound on memory.** It counts entries, and
//!    a changed-file observation carries a whole file's text and its projection,
//!    so the number says how many such values one epoch may hold and nothing
//!    about how large any of them is.
//! 4. **That an eviction preserves any document's state.** The victim rule buys
//!    a *fairer* victim, never a survivor: when every path holds one entry the
//!    victim is simply the lowest sequence in the queue, which may be the only —
//!    and therefore newest — state its document has, and at a tie between two
//!    equally busy paths the victim is drawn from whichever of them holds the
//!    lower sequence rather than from the one that caused the overflow.
//! 5. **That a stored entry reaches a consumer.** An overflow and a replacement
//!    both take entries no drain ever returned. The first is reported in the
//!    batch's loss count and obliges a **whole-workspace reload** rather than a
//!    repeated drain; **nothing in this application enforces that reading**
//!    (`docs/decisions/2d-4a-notes.md` R4). The second is reported by the
//!    batch's epoch and counted nowhere.
//! 6. **That a value describing one moment says anything over time.** A wake's
//!    `newest_sequence` is the highest sequence pending at the instant of one
//!    enqueue: not a count, not a promise of a batch size, and not a number two
//!    wakes may be compared on.
//! 7. **That two numbers from two epochs are comparable at all.** A sequence, a
//!    watermark and a loss count are each meaningless across a replacement, and
//!    a consumer separates them by the epoch a batch names rather than by their
//!    order.
//! 8. **That any of this is measured.** Nothing in this repository counts the
//!    identity register's entries or bytes, the ledger's maps, or the per-drain
//!    clone cost of the queue's pending set
//!    (`docs/decisions/2d-4a-notes.md` R7). Every bound above is a bound on a
//!    count that is asserted by construction, and every *absence* of one is
//!    recorded here rather than left to be discovered.
//!
//! # What this module is not
//!
//! **It is not a statement about whether anything will ever be observed
//! again.** That is [`crate::watch::liveness`], the other contract this
//! workspace states once — a debt, a rollback, a coalesced hint, an owed
//! observation. This one answers *how long does what has already been observed
//! survive*, and the two meet only where a clause of one is the premise of a
//! clause of the other, which is nowhere today.
//!
//! **It is not a statement about backup-file retention.**
//! [`crate::persist::backup`] rotates entries on disk under a policy of its
//! own, and that policy is neither derived from nor constrained by anything
//! here.
//!
//! **It is documentation, and nothing in the type system makes a consumer point
//! here rather than restate.** Phase 2d-4a-C step 2 owes the check that keeps
//! the positions pointing — the analogue of `src-tauri/src/liveness_contract.rs`
//! for this family — and until it exists, what keeps them pointing is a reader.
//! Even with it, a check of that shape catches an **unmarked** claim and a
//! **new** claim and **cannot judge whether a passage's claim is true**.
