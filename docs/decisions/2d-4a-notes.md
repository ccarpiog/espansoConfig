# Phase 2d-4a — the Rust half of the reconciliation wire

**An observation this application admits is *stored* beside the open workspace session — unless it
carries a replaced epoch or a sequence a drain has already acknowledged, which are the two arrivals
no later drain could ever return — and once stored it is held, in sequence order, until a later
drain acknowledges it or an overflow evicts it, and a window can ask for it.**
`src-tauri/src/reconciliation.rs`
is the new module. `ReconciliationQueue` is the typed, ordered, coalescing queue; `queueing_sink` is
the **production downstream sink** that replaced the sink which dropped its argument;
`ReconciliationWake` goes out on `workspace://reconciliation-ready` after every enqueue that stores;
and
`drain_external_changes` — the sixteenth workspace command, the seventeenth registered command, and
a reader — hands back a `ReconciliationBatch` of `ExternalObservation` values. **The event is a hint
and the command answer is the authority** (the 2d design consult's Q3): nothing is installed from a
wake, an epoch mismatch makes a wake or a batch stale, and a queue entry survives until a later
drain acknowledges it. This step **draws nothing** and **decides nothing about whether a write
surface is open** — Q7 item 4's two prohibitions, inherited verbatim by
`docs/decisions/2d-4-split-notes.md` §4.

> **Correction, round 2 (finding 2).** *"a queue entry survives until a later drain acknowledges
> it"* is unqualified above and is false under overflow: at `QUEUE_CAPACITY` an enqueue evicts the
> oldest undrained entries **before** anything acknowledges them, and counts them in
> `ReconciliationBatch::discarded`. The true sentence is *a queue entry survives until a later
> drain acknowledges it or an overflow evicts it*, and the cost of the second is not a repeated
> drain but the whole-workspace reload a non-zero `discarded` obliges. §2's guarantee 4 carries the
> same correction at the place the module states it.

> **Correction, round 3 (finding 4).** The opening sentence — *"An observation this application
> admits is no longer dropped: it is held…"* — is still false, and round 2's correction above fixed
> the neighbouring sentence while leaving the **headline** claiming more than the code does. An
> admitted observation is dropped for **three** reasons: it carries a replaced epoch, its sequence is
> at or below the acknowledged watermark, or the queue is over `QUEUE_CAPACITY` and the eviction
> policy names it. The true headline is the one now above: *an observation this application admits is
> **held until a later drain acknowledges it or an overflow evicts it**, and an eviction is a counted
> loss obliging a whole-workspace reload*. This is a false claim corrected to a true one, not a
> guarantee narrowed to dodge a finding — nothing about what the code does changed for it, and every
> position that states retention now states the same boundary (§12.1, finding 4).

> **Correction, round 4 (finding 3). Round 3's replacement headline is *also* false, and it is false
> in the way round 3's own correction block predicted three lines further down.** *"held until a
> later drain acknowledges it or an overflow evicts it"* is the boundary of a **stored** entry, and
> the block above states in as many words that an admitted observation is dropped for **three**
> reasons — the third being the only one the headline named. An observation admitted under epoch 1
> that pauses before the synchronous downstream call and resumes after the queue has adopted epoch 2
> is refused by `enqueue` and never stored; so is a same-epoch sequence 5 arriving after `drain(10)`,
> which is counted in `discarded` and dropped without acknowledgement or overflow. Both are
> implemented by returning **before** the insertion.
>
> The headline now above states the boundary in two halves, which is what makes it true: **an
> admitted observation is stored unless it is one of those two arrivals, and a stored entry leaves
> the queue in exactly two ways — acknowledgement or eviction.** That is the identical wording every
> other position now carries, and this round found **four** more positions of the same shape that
> round 3's sweep did not reach because it was written from the wording of round 3's own finding:
> two in `src-tauri/src/main.rs`'s module header (*"where what the gate admits stops being dropped"*
> and *"puts every admitted observation in it"*), `WorkspaceSession::new`'s doc and
> `queueing_sink`'s. §13.2 names all of them. **No code changed for any of it**, and nothing was
> weakened: the two-way boundary of a stored entry is unchanged and is still exactly what the code
> keeps.
>
> One neighbouring sentence of the same shape in this very paragraph went with it: *"`Reconciliation
> Wake` goes out … after every enqueue"* — a refused enqueue emits none, which the module has said
> since round 1 and which this sentence did not. It now says *after every enqueue that stores*.

> **Correction, round 5 (Medium). The two-way boundary is false, and it is the third consecutive
> round in which the retention sentence was restated and was still wrong.** *"Held until a later
> drain acknowledges it or an overflow evicts it"* omits a **third** way a stored entry leaves the
> queue: `ReconciliationQueue::begin_epoch` replaces the whole `QueueState` — pending set, watermark
> and loss count — when the session adopts a replacement workspace, and every entry the previous
> epoch held is discarded there, acknowledged by nobody and evicted by nothing. The exact sequence
> is round 5's: epoch 1 stores sequence 1; no drain acknowledges it and capacity is not exceeded; a
> successful open allocates epoch 2 and calls `begin_epoch(2)`; the entry is gone.
>
> **The true boundary has three clauses**, and it is the wording every position now carries: an
> admitted observation is **stored** unless it is one of the two arrivals no later drain could
> return — a replaced epoch, or a sequence at or below the acknowledged watermark — and a **stored**
> entry then leaves this queue in exactly three ways: **a later drain acknowledges it, an overflow
> evicts it, or the queue adopts a replacement epoch and discards everything the previous one
> held.** **The third is not counted in `discarded`**, and that is deliberate rather than an
> omission: the successful open that causes it has already replaced the authoritative workspace, so
> the discarded entries describe a directory nothing is showing, and every batch of their epoch is
> already stale by `ReconciliationBatch::epoch`. Counting them would oblige a reload of a workspace
> the open has just performed.
>
> The idempotence sentences carry a second condition with it: *draining twice with the same
> watermark answers the same batch twice* now holds **when nothing was enqueued between the two
> calls and no replacement epoch was adopted between them**. Rounds 1 and 2 added the first half of
> that qualification and nobody added the second.
>
> Every earlier correction block in this file that states the boundary in two ways — round 2's and
> round 3's above, §2.1's, §2's round-3 note, R10's — is **left as it was written**, per this file's
> convention, and is corrected by this block. **No code changed for it and no guarantee was
> weakened**: the third clause was always what `begin_epoch` did, and
> `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` has asserted it since the
> original round. §14 is the record, including what the sweep covered.

---

## 1. What this step built

- **`src-tauri/src/reconciliation.rs`** — the whole of it:
  - `ReconciliationQueue`, one per session, holding `AdmittedObservation` values in a
    `BTreeMap` keyed by the sequence `crate::ledger` minted, plus a per-path index for the
    coalescing rule, an acknowledged watermark and a discarded counter. Two leaf mutexes: the
    pending state and the wake emitter.
    > **Correction, round 2 (finding 1).** *"a per-path index for the coalescing rule"* names
    > `QueueState::newest_for_path`, which is **deleted**: the coalescing rule moved out of `enqueue`
    > and into `coalesced_sequences` at drain, where it needs no index because it walks the pending
    > set in sequence order. `QueueState::reindex` went with it. What the queue holds beside the
    > pending map is the acknowledged watermark, the discarded counter and — since round 1 —
    > `issued_identities`. §2's round-2 correction is why.
    > **Correction, round 3 (findings 3 and 5).** `QueueState::issued_identities` is **deleted** too.
    > What the queue holds is the pending map, the acknowledged watermark and the discarded counter,
    > and nothing else: addressing a path is now one read of the core's own process-wide identity
    > register through the new `espansoconfig_core::workspace::identity_already_issued`. §3.3's
    > round-3 correction is why.
  - `queueing_sink(queue)` — the `AdmittedSink` the production session installs behind
    `admitting_sink`. It enqueues, then emits, with no lock held.
  - `ReconciliationWake { workspace_epoch, newest_sequence }` — the event payload, and the whole
    of it.
  - `ReconciliationBatch { epoch, newest_sequence, observations, discarded }`.
  - `ExternalObservation` — `Changed | Added | Removed | Unreadable`, all struct variants.
    > **Correction, round 3 (finding 3).** `ExternalObservation::Added` now carries
    > `content: AddedContent` — `Projected { disk, findings } | Unreadable { reason }` — in place of
    > its `disk` and `findings` fields, which is the consult's `disk?` written as a discriminated
    > value. `AddedContent` is a fifth wire type and a new dictionary namespace with two sentences in
    > each language. §3.2's round-3 correction is why.
  - `ObservedDocument` — `Known { document } | Unknown { relative_path }`.
  - `UnreadableReason` — `NotUtf8 { offset } | PermissionDenied | InvalidData | TimedOut |
    Interrupted | Other`, all struct variants.
  - `external_observation`, `address_of`, `summary_of` — the one projection into wire form.
- **`src-tauri/src/events.rs`** — was empty; now declares `RECONCILIATION_READY` and
  `wake_emitter(handle)`, which is the only place in this step that mentions `tauri` on the wake
  path. The queue never does.
- **`src-tauri/src/commands.rs`** — `WorkspaceSession` gains a `reconciliation` field, a private
  `assembled` constructor (the one site a session is built), `drain_external_changes` as a method
  and as the `#[tauri::command]`, `install_wake_emitter`, a `#[cfg(test)]` `reconciliation()`
  accessor, and the queue's epoch adoption beside the ledger's in `open`.
- **`src-tauri/src/ledger.rs`** — `discarding_sink` is **deleted**, and the
  `#[cfg_attr(not(test), allow(dead_code))]` on `AdmittedObservation` is gone with it: every field
  now has a production reader.
- **`src-tauri/src/main.rs`** — the module, the registration, and a `setup` that installs the wake
  emitter on the managed session.
- **`src-tauri/src/wire_contract.rs`** — the command-count test is renamed and re-counted, and
  `AWAITING_FRONTEND_DECLARATION` records the one deliberate Rust-ahead-of-TypeScript gap.
- **`src-tauri/src/dispatch_check.rs`** — the remote-origin sweep attempts seventeen commands, and
  `drain_external_changes_is_reachable_and_its_watermark_deserializes` is the new positive test.
- **`src-tauri/src/dictionary_contract.rs`** — `ExternalObservation` and `UnreadableReason` are
  namespaces; `ObservedDocument` is a named `NOT_A_CODE` address.
- **`src/lib/i18n/{en,es}.json`** — ten new keys each, EN and ES.

> **Correction, round 3 (finding 3).** Two files this step did not touch are now part of it, and one
> count above moved:
>
> - **`crates/espansoconfig-core/src/workspace/mod.rs`** — `identity_of` is **public** and
>   `identity_already_issued` is **new**. The core gains no dependency and no behaviour; what changed
>   is who may ask it a question it could already answer. `cargo tree -p espansoconfig-core | rg
>   tauri` is still empty.
> - **`src/lib/i18n/{en,es}.json`** — **twelve** new keys each, not ten: `code.addedContent.projected`
>   and `code.addedContent.unreadable` are round 3's.
> - **`src-tauri/src/dictionary_contract.rs`** — `AddedContent` is a third namespace from this
>   module, with its variant count.

> **Correction, round 4 (findings 1 and 2).** Three of the bullets above changed shape and two counts
> moved again:
>
> - **`ExternalObservation::Changed`** now carries `document: ObservedDocument`, `previous_revision`,
>   `disk_revision` and `content: ChangedContent` — `Projected { disk_text, disk, findings,
>   correspondences } | Unreadable { reason }`. Its `disk_text`, `disk`, `findings` and
>   `correspondences` fields moved inside the projected arm; the two revisions stayed outside it,
>   which is the point. §3.2's round-4 correction is why.
> - **`ObservedDocument`** is `Addressable { document, relative_path } | Named { document,
>   relative_path } | Unnamed { relative_path }` — three arms where there were two, and **every arm
>   carries the display path**. §3.3's round-4 correction is why.
> - **`ChangedContent`** is a sixth wire type and a fourth dictionary namespace from this module,
>   with two sentences in each language.
> - **`src/lib/i18n/{en,es}.json`** — **fourteen** new keys each, not twelve:
>   `code.changedContent.projected` and `code.changedContent.unreadable` are round 4's.
> - **`address_of`** asks the open `Workspace` before it asks the identity register, and
>   `address_of_minted` and `display_path` are new beside it.

---

## 2. What the queue guarantees, and what it does not

**Guaranteed, and these are Q3's four read as four separate claims:**

1. **Sequences increase within one workspace epoch.** The numbers are the ledger's; this module
   mints none. `begin_epoch` empties the queue when the session adopts a new epoch, so a sequence
   never has to be compared across two of them.
2. **A drained batch is sequence-ordered, by construction rather than by arrival.** The pending set
   is a `BTreeMap` keyed by the sequence. This is deliberate and not incidental: the ledger mints a
   sequence under its state mutex and then **drops both guards** before calling downstream, so two
   producers could in principle reach `enqueue` in the opposite order to the one they were numbered
   in. A `Vec` in arrival order would have been right today and silently wrong the day a second
   producer exists.
3. **Repeated hints that stabilize to the same document and revision coalesce.** An enqueue whose
   path already has an undrained entry asserting the same `ObservedState` replaces that entry and
   takes the newer sequence. This is **additive to** the ledger's own duplicate rule rather than a
   restatement of it: the ledger's `announced` map is cleared by `reload_document`
   (`adopt_reloaded_revision_under_the_session_lock`), so a state equal to one still sitting
   undrained here can legitimately be admitted a second time.
4. **Per document the consumer acts on the highest sequence it has accepted.** That is the
   *consumer's* rule; this queue's part of it is the `after_sequence` watermark.

> **Correction, round 1 (finding 3).** Guarantee 3 was stated unconditionally above and the code
> kept it only in arrival order. `enqueue` compared `previous < admitted.sequence`, which is false
> when a **higher** sequence for the same path and state reached the queue first — so the older
> repeat was inserted as well, and the batch came out ordered but not coalesced. The guarantee is
> Q3's and it is unconditional, so the code was changed rather than the sentence weakened: the pair
> now coalesces onto the **higher** of the two sequences whichever order they arrive in, and the
> older arrival stores nothing. It is **not** counted in `discarded` — nothing is lost, because what
> it asserts is already on its way to the consumer under a higher sequence — and it owes a wake like
> any other enqueue.
> `a_repeat_that_arrives_after_a_higher_sequence_coalesces_onto_it_rather_than_beside_it` fails
> without the fix, at two pending entries against one.
>
> Note what the rule still is, exactly: an enqueue is compared against **its path's newest undrained
> entry** and against nothing else. A state that returns after a different one — A, then B, then A —
> is therefore two entries for A, deliberately, because the file genuinely held B in between. That
> was the rule before this round and it is unchanged; what changed is that it no longer depends on
> the order two threads reached `enqueue` in.

> **Correction, round 2 (finding 1) — the round-1 fix above was still wrong, and it was wrong in a
> worse way than what it replaced.** The final sentence of that correction block is false: comparing
> an arrival against **its path's newest undrained entry** cannot normalize arbitrary arrival order,
> because that entry is not necessarily the one the arrival is sequence-adjacent to. Two
> counterexamples, both driven as tests now:
>
> - **A(9), then A(3), then B(5).** A(3) was discarded as a repeat of A(9) — correct against the
>   *newest* entry, and wrong against the history, because B(5) had not arrived yet to separate
>   them. The true sequence-order history is A(3), B(5), A(9), which the block above says in as many
>   words must keep **both** A observations, and the queue kept only B(5) and A(9). **An observation
>   that was no repeat in sequence order was dropped**, and nothing could put it back. That is a
>   correctness defect, not a wording one.
> - **A(9), then B(5), then B(3).** The newest entry for the path was A(9), so B(3) matched nothing
>   and was inserted beside B(5): the batch came out ordered and **not** coalesced — round 1's own
>   finding, surviving round 1's own fix in the other arrival order.
>
> **The fix is in the code, and it moves where the rule is applied.** Coalescing is now
> `coalesced_sequences` in `reconciliation.rs`: over one path's pending entries taken in **sequence**
> order, a maximal run asserting one `ObservedState` contributes exactly one observation to a batch,
> the one at the highest sequence of the run. Three things follow, and the third is the one that
> makes the guarantee unconditional rather than nearly so:
>
> - **Adjacency is in sequence order, never in arrival order**, so A, B, A is two A observations by
>   construction: neither A is adjacent to the other.
> - **It compares `ObservedState`**, so `Absent` never equals `Content(_)` — Q3's `Removed` then
>   `Added` rule is untouched and still true by construction rather than by a special case.
> - **It runs at drain, over the complete pending set, and not at enqueue.** This is the whole
>   correction. A fold decided at enqueue is decided over the history *so far*; an observation that
>   arrives later between two entries an enqueue folded together cannot un-fold them, and that is
>   exactly how A(3) was lost. A fold that is a **pure function of the pending set** cannot depend on
>   arrival order at all, which is what *whichever order the two arrive in* has to mean.
>
> `enqueue` therefore stores every admitted observation, older-than-pending ones included, subject
> only to the epoch check, the watermark check and capacity. `QueueState::newest_for_path` and
> `QueueState::reindex` are **deleted**: they existed only for the rule that moved.
>
> **What it costs, said rather than smoothed over.** A folded entry keeps its slot against
> `QUEUE_CAPACITY` until a drain acknowledges it — it is folded out of the *batch*, never out of the
> *queue* — so a repeated hint stream now consumes capacity where the previous rule kept the pending
> count flat. It is never counted in `discarded`, because nothing is lost: what it asserts crosses
> under a higher sequence. `pending()` is an observability accessor and two tests that asserted `1`
> over a coalesced pair now assert `2` and check the **batch** instead, which is where the guarantee
> lives.
>
> `a_state_that_returns_after_another_one_is_two_entries_whatever_order_they_arrive_in` and
> `a_sequence_adjacent_repeat_coalesces_whatever_order_it_arrives_in` are the two counterexamples,
> each driven in three arrival orders and each asserting the resulting **(sequence, text) list** and
> not its length — a length alone cannot tell A, B, A from B, A, which is how the round-1 fix looked
> plausible. Both were watched failing before the fix, on exactly the orders round 2 named: `[9, 3,
> 5]` answered `[(5, B), (9, A)]` against an expected `[(3, A), (5, B), (9, A)]`, and `[9, 5, 3]`
> answered `[(3, B), (5, B), (9, A)]` against an expected `[(5, B), (9, A)]`.

> **Correction, round 3 (finding 1) — the fold was arrival-order independent and the *capacity bound*
> was not, so the guarantee above was still conditional on something its own sentence called "not a
> coalescing failure".** `enqueue` ran `while pending.len() >= QUEUE_CAPACITY { evict the lowest }`
> **before** storing the arrival, which makes the retained set depend on arrival order: a full queue
> made room by dropping a *resident* entry even for an arrival lower than everything it held. Round
> 3's counterexample is one path at `A(1), B(2), A(257)` with sequences 3–256 belonging to other
> paths. Arriving `1..257` evicted `A(1)` and returned `B(2), A(257)`; arriving `2..257, 1` evicted
> `B(2)` and stored `A(1)` — and with the separator gone the drain **folded** the two `A` entries and
> returned only `A(257)`. One admitted history, two batches. Calling that a `discarded` loss rather
> than a coalescing failure was a relabelling: the loss is real, and it is also what made the fold
> answer differently.
>
> **The fix is in the code, and it is the order of two statements.** The arrival is stored **first**
> and the bound restored **after** — `while pending.len() > QUEUE_CAPACITY`. What the queue retains
> is then its best `QUEUE_CAPACITY` entries out of everything admitted, a function of the admitted
> set; and an arrival that is itself the right victim simply leaves again rather than displacing a
> resident entry. `a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in` drives that
> exact history in three arrival orders, and
> `an_arrival_below_everything_a_full_queue_holds_is_the_entry_that_leaves` pins the boundary the
> `>=` was wrong about. Both were watched failing first (§12.4).
>
> With this, guarantee 3 above is unconditional in the reading round 3 asked for: **no part of what a
> drain answers depends on the order two threads reached `enqueue` in.** What is still conditional is
> *how much history a batch is*, which is the retention boundary — acknowledgement or eviction — and
> not the fold.

**Not guaranteed, each stated because it is a way to be wrong:**

- **No filesystem chronology is inferred from hashes.** Nothing here compares two
  `ContentRevision`s for order; *later* always means a larger sequence.
- **No relation between native events and writes is assumed.** This queue counts admitted
  observations and nothing else.
- **No global order between two documents is assumed.** Two files' sequences are admission order in
  this session and nothing about disk.
- **No one-to-one relation between a wake and a queued value.** A wake may be dropped by the event
  system; a coalescing enqueue emits a wake while leaving the pending count unchanged; and an
  enqueue that is refused (see §4) emits none.
- **A `Removed` followed by an `Added` at the same path is two entries**, even at identical bytes,
  because file membership changed. The coalescing rule compares `ObservedState`, and `Absent` never
  equals `Content(_)` — which is what makes this true by construction rather than by a special case.

> **Correction, round 2 (finding 1, second order).** *"a coalescing enqueue emits a wake while
> leaving the pending count unchanged"* described the rule finding 1 removed. No enqueue coalesces
> now: a stored arrival always raises the pending count by one, and the fold happens at drain. The
> bullet's **claim** survives its reason — a wake is still no promise about a batch, because the
> enqueue that emitted it may be one a later drain folds into a higher sequence for the same path,
> and because a refused enqueue emits none at all. The module doc says it that way at
> `reconciliation.rs`'s *what it does not do* list.

**What TypeScript and Rust do not force here, said in the same breath as what they do:** nothing
makes a caller of the drain act on what it gets; nothing makes the installed emitter reach a live
webview, because no API reports that; and nothing ties a queue to the session whose workspace is
passed to `drain` — the session owns both and hands them over together, and that is a property of
one call site rather than of a type.

### 2.1 The watermark is an acknowledgement, not a cursor

`drain(after_sequence)` removes every pending entry at or below `after_sequence` and returns —
**and keeps** — everything above it. Two consequences worth naming:

- Draining twice with the same watermark answers the same batch twice, so an answer lost between
  Rust and the window costs nothing and the protocol needs no retry channel.
- A window that never acknowledges fills the queue, which is what makes the capacity bound below
  meaningful rather than decorative.

`newest_sequence` is the highest sequence in the batch, or the `after_sequence` the caller sent when
the batch is empty, so a caller may store it unconditionally and an empty batch never moves a
watermark backwards.

> **Correction, round 1 (findings 2 and 3).** Both paragraphs above were wrong, in two different
> ways, and the code has changed rather than the sentence.
>
> - **The empty-batch rule did not hold.** `drain` answered the caller's own `after_sequence` for an
>   empty batch, so a caller that had acknowledged 10 and then drained with 5 — an out-of-order
>   drain, which Q7 item 5 requires 2d-5 to handle — got `newest_sequence == 5` back and, following
>   the instruction to store it unconditionally, walked its own watermark backwards. `drain` now
>   answers the highest watermark this queue has ever been drained with, and the `max` that does it
>   is written into `drain` rather than left as a consequence of `enqueue`'s refusal, so the field's
>   claim is a property of the function that fills it.
>   `an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument` fails without
>   the fix, at 5 against 10.
> - **The idempotence claim was unqualified and is not unconditional.** Draining twice with the same
>   watermark answers the same batch twice **only if nothing was enqueued between the two calls**.
>   An enqueue in between belongs in the second batch — that is what a queue is for — and the
>   sentence now says so wherever it appears: `ReconciliationQueue::drain`,
>   `WorkspaceSession::drain_external_changes`, the `drain_external_changes` command, and the test
>   comment in `a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not`.

> **Correction, round 2 (findings 1 and 2).** Two more things in §2.1 above are wrong, one from the
> original round and one the round-1 fix left standing beside the four sentences it did qualify.
>
> - **Retention is not unconditional, and *"costs nothing"* is false under overflow.** *"Draining
>   twice with the same watermark answers the same batch twice, so an answer lost between Rust and
>   the window costs nothing"* holds only while the entry is still there. `enqueue` evicts the oldest
>   undrained entries at `QUEUE_CAPACITY`, **before** any acknowledgement, and counts them in
>   `discarded`; what an eviction costs is a whole-workspace reload, not a repeated drain. Round 1
>   qualified the four idempotence sentences with *when nothing was enqueued between the two calls*
>   — which is true, and is why they survived round 2 — and touched this neighbouring retention
>   sentence without qualifying it. It now carries the eviction condition at four positions: the
>   module doc's guarantee 4, `ReconciliationQueue::drain`, `external_observation`'s reason for
>   cloning rather than consuming, and both `drain_external_changes` docs. **No code changed for
>   this**; the eviction was always there.
> - **"Everything above it is returned and kept" is now two claims, and only one of them is
>   *everything*.** Since finding 1's fix a drain **keeps** every entry above the watermark and
>   **returns** the coalesced form of them, so an entry the fold does not carry is kept and not
>   returned. Both `drain_external_changes` docs and `ReconciliationQueue::drain` say it that way.

> **Correction, round 3 (finding 4).** Round 2's own list of positions is now out of date in two
> ways, both of which round 3 found as one finding.
>
> - **The four positions were not all of them.** `ReconciliationQueue::drain` said a folded entry
>   *"stays pending and holds its slot against `QUEUE_CAPACITY`"* without saying that an eviction can
>   take it, and `external_observation` named eviction without naming what it costs. Every position
>   that states retention now states the identical boundary — **acknowledgement or eviction, and an
>   eviction is a loss obliging a whole-workspace reload** — and the record's own header is one of
>   them (§12.1, finding 4). No code changed for any of it.
> - **"The oldest undrained entries" is no longer what an overflow evicts.** Round 3's findings 1 and
>   2 changed the policy: an overflow now evicts `evictable_sequence`'s answer, which is the lowest
>   pending sequence of the **busiest path**. Every sentence naming *oldest* was rewritten, including
>   the two in `commands.rs`. §2.2's round-3 correction is the policy.

> **Correction, round 4 (finding 3). *"Every position that states retention now states the identical
> boundary"* was itself false when it was written, and one of the positions it had just rewritten
> stated the boundary backwards.** Round 3 rewrote both `commands.rs` docs for the *oldest* wording
> and left them saying an entry is **"kept only until an overflow evicts it"** — which omits removal
> by acknowledgement, the ordinary case and the other half of the two-way boundary the same round
> claimed to have unified. That is the round-3 correction above closing a false claim in one
> direction and opening one in the other, at a position it had its hands on.
>
> Both `commands.rs` docs now say a **stored** entry leaves the queue in exactly two ways — a later
> drain acknowledges it, or an overflow evicts it — and the module doc's guarantee 4 carries the
> boundary in one paragraph, in the wording every other position quotes. The four further positions
> this round found are named in the header's round-4 correction and in §13.2. **No code changed**,
> and no guarantee was weakened.

> **Correction, round 5 (Medium). The unified two-way boundary was unified and still false**, in a
> direction none of rounds 2, 3 or 4 looked in: it counts the ways an entry leaves *by its own
> properties* — being acknowledged, being the eviction policy's victim — and misses the one that
> depends on nothing about the entry at all. A workspace replacement calls
> `ReconciliationQueue::begin_epoch`, which assigns a fresh `QueueState` and discards every pending
> entry, the watermark and the loss count with it. The header's round-5 correction is the three-clause
> boundary and why the third clause is counted in no `discarded`; the positions this round rewrote
> are in §14.2. Everything above in this subsection is left as it was written.

> **Correction, round 6 (Medium). The watermark itself is described the same way the retention
> boundary was, and one level above it.** Round 5 taught that a rule written from a thing's own
> properties misses the event that ignores them; it then rewrote twelve retention positions and left
> the **watermark** claiming a property of the *process*. Four public positions and this subsection
> said `newest_sequence` never falls below the highest watermark this queue — or this *session* — has
> **ever** been drained with, and may therefore be stored **unconditionally**. `begin_epoch` resets
> `acknowledged` to zero with everything else, so the sequence is: epoch 1 drains with watermark 9;
> `begin_epoch(2)`; `drain(0)` on the empty successor answers `newest_sequence == 0`.
>
> **The code is right and the words were wrong**, which is why this changed no behaviour. Sequences
> and watermarks are epoch-scoped by construction — `crate::ledger`'s allocator restarts with the
> epoch and `QueueState::acknowledged` goes with the pending set — and a sequence means nothing
> across two epochs, so there is no order between the two numbers for anything to walk backwards
> along. The corrected claim, in the wording every position now carries: **within the epoch the batch
> names**, `newest_sequence` never falls below the highest watermark this queue has been drained with
> under that epoch, so a caller showing that epoch may store it unconditionally, out-of-order drains
> included; **across a replacement epoch it falls**, and what separates the two numbers is
> `ReconciliationBatch::epoch`, from which a caller installs nothing when the epoch is not the one it
> is showing (the consult's Q3).
>
> Two sentences of this subsection are the record's own instance: *"a caller may store it
> unconditionally and an empty batch never moves a watermark backwards"* above, and the round-1 block's
> *"`drain` now answers the highest watermark this queue has **ever** been drained with"*. **§10.2's
> summary of that round — *"both now also state that `newest_sequence` never falls below an
> acknowledged watermark"* — carries the same omission** and is corrected here rather than edited
> there. All of it is left as written, per this file's convention.
>
> **This one *is* asserted**, unlike the retention wording:
> `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` gained two assertions — epoch
> 2's watermark of 9, and the successor's `newest_sequence` of 3 beside `epoch == 3` — so the
> corrected sentence rests on a test in the direction a test can reach. §15.2 lists the positions.

### 2.2 The capacity bound, and what `discarded` claims

`QUEUE_CAPACITY` is 256. It **bounds the count of entries, never the bytes**: a `Changed` carries a
whole file's text and its projection, so this number says how many such values one epoch may hold
and nothing about how large any of them is. It exists because the consumer is a webview that can be
suspended (one of the three reasons Q3 gives for why a push-only protocol is unsafe) while an
external process keeps writing.

On overflow the **oldest** entry is dropped and `discarded` counts it. Oldest rather than newest,
because the newest state of every document is what a consumer can still act on. `discarded` is
**cumulative within the epoch and monotonic**, so a non-zero value does not say the loss happened
since the previous drain; what it does say is that this epoch's observation history has a hole, and
a consumer that sees one must reload the workspace rather than reconcile from these values.

This field is **not in Q3's field list**. It is added because the bound is, and a bound with no
observable overflow would be a silent loss — this project's named worst defect class applied to a
queue. It is inert on every ordinary run.

> **Correction, round 1 (findings 4 and 6).** Two sentences above are false and the doc comments
> that carried them have been rewritten; no code changed for either.
>
> - **"Oldest rather than newest, because the newest state of every document is what a consumer can
>   still act on" is false.** The entry dropped is the *globally* oldest, and it may be the only —
>   and therefore newest — state its document has, in which case that document's state is exactly
>   what overflow lost. The existing overflow test demonstrated it while asserting the opposite: it
>   enqueues one observation per document and drops three of them, so three documents vanish
>   entirely from the batch. The true, weaker sentence is that **overflow is observable rather than
>   silent**: `discarded` is cumulative and the documentation requires a complete workspace reload
>   rather than partial reconciliation. **Nothing in 2d-4a enforces that**, and R4 assigns the
>   enforcement to the consumer. What the policy does buy is that the entries kept are the ones
>   nearest the present state of the tree; what it does not buy is a per-document survivor.
>   `a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of` now
>   asserts the absence of those three documents by name instead of asserting the false sentence.
> - **`discarded` was documented as counting capacity drops only, and it never did.** `enqueue` also
>   increments it for a sequence at or below the acknowledged watermark, which is a loss for the same
>   reason and obliges the same reload. The field now names both causes.
>   `a_sequence_at_or_below_the_acknowledged_watermark_is_counted_as_a_loss` is the second cause's
>   existing test.

> **Correction, round 3 (findings 1 and 2). The eviction policy is not "the oldest entry" any more,
> and both halves of the change were review findings before they were a design.** `enqueue` now
> stores the arrival and *then* restores the bound, and the entry it drops is `evictable_sequence`'s:
> **the lowest pending sequence of the path holding the most pending entries**, ties between equally
> busy paths broken by the lower of their lowest sequences.
>
> - **Storing before evicting** is finding 1: see §2's round-3 correction. Without it a full queue's
>   contents depended on arrival order, and through the fold so did the batch.
> - **The busiest path** is finding 2. With capacity counted over raw entries — which is what round
>   2's move of the fold to drain made it — `QUEUE_CAPACITY` identical states for one document evict
>   another document's **only** state, and the pre-round-2 queue would have kept both. A repeat
>   stream for one file therefore cost the consumer a second file entirely and a whole-workspace
>   reload, where the fold alone costs nothing. The new rule makes one invariant true: **a document
>   with one pending entry is never the victim while another document has two.** When every path
>   holds one entry it degenerates to the lowest sequence, which is the case the original overflow
>   test drives, and that test is unchanged.
>
> **What was refused, and why it is worth recording.** The obvious policy was *prefer to evict an
> entry the fold currently makes redundant*. It is **not arrival-order independent**, so it would
> have reopened finding 1 while closing finding 2. Redundancy is a property of the set at the moment
> of the eviction, and an arrival that later lands between two folded entries un-folds them — the
> same reason the fold itself had to move to drain. An exhaustive search over every assignment of two
> paths and two states to five sequences at a capacity of three found counterexamples immediately:
> one path at states `S, T, S, S, S` on sequences 1–5 retains `{1, 2, 5}` in one arrival order and
> `{2, 4, 5}` in another. The busiest-path rule does not look at state at all, which is what keeps it
> out of that trap.
>
> **What the order-independence of the new rule rests on, stated exactly.** For the *lowest sequence*
> it is a proof: keeping the largest `K` of a set under a fixed key cannot depend on insertion order.
> For *busiest path* it is an argument plus a measurement, and not a proof. The argument is that each
> path retains a suffix of its own entries — evictions always take that path's current lowest — and
> that the surviving count per path is the max-min fair share of `QUEUE_CAPACITY`, which is a
> function of the path sizes. The measurement is an exhaustive search over **every** assignment of
> paths and states to sequences and **every** arrival order of them, for two and three paths, two
> states, up to six sequences and capacities two to four: no configuration answered two different
> batches. That is a bounded check of an unbounded claim, and §12.4 carries it as thin.

---

## 3. Why each wire type is shaped as it is

### 3.1 `ExternalObservation` — four struct variants, every one carrying its sequence

Every variant carries `sequence` because *which of these is newest for this document* is the
consumer's whole arbitration rule (Q5) and it may not be recovered from a hash. All four are struct
variants, including the ones that would fit a tuple, so the enum crosses `serde`'s externally tagged
representation as a uniform object — the D5 rule every wire enum in this application follows.

### 3.2 Non-UTF-8 content crosses as `Unreadable`, and this is a deviation from Q3

The engine reports present-but-not-UTF-8 bytes as **content**, so a `Changed` or an `Added` can
arrive with no text and no projection. Q3's field list answers that by giving `Added` an optional
projection (`disk?`). This step routes such a state to `ExternalObservation::Unreadable` with
`UnreadableReason::NotUtf8 { offset }` instead, so that:

- `Changed` stays **total** — its `disk_text` and its `disk` are always present and always come out
  of one snapshot, which is the pairing a conflict's comparison side depends on. The alternative was
  four optional fields whose absence all meant one thing;
- the sentence on screen is the true one. This application already refuses to show non-UTF-8 bytes
  anywhere else: `document_text` answers valid UTF-8 or refuses and never decodes lossily
  (CLAUDE.md). *This file's text is not available* is what both engine states mean to a person.

**What it costs, and it is a real cost:** a newly added file whose bytes are not valid UTF-8 reaches
the window as an unreadable **path** rather than as a new sidebar row, because there is no
`DocumentId` to build a `DocumentSummary` around (§3.3). A `Changed` that becomes unreadable also
loses its `previous_revision` and its `disk_revision`, because Q3's `Unreadable` carries neither.
Residue R3 below.

With that routing, `Added.disk` is never absent, so it is **not** an `Option`: a shape with exactly
one inhabitant claims a state that cannot occur.

> **Correction, round 3 (finding 3). Half of this deviation is withdrawn, and it is the half that
> cost something.** The argument above is sound about `Changed` and was never an argument about
> `Added`: keeping `Changed` total is what pairs `disk_text` with `disk` out of one snapshot, and an
> `Added` has no such pairing to protect. Routing an addition to `Unreadable` bought nothing and left
> the **first sighting of a file whose bytes are not UTF-8 reaching the window as a bare display
> path** — no row for a sidebar to draw and no address by which anything could later be told to
> invalidate one. R3 recorded that as a cost; round 3 called it a wire defect 2d-5 cannot repair from
> the value supplied, and it is right.
>
> **What changed.** `ExternalObservation::Added` carries `content: AddedContent` —
> `Projected { disk, findings } | Unreadable { reason }` — which is the consult's `disk?` written as
> a **discriminated value** rather than as an optional field, because an absence carries no reason
> and the reason is the sentence a person reads. It also keeps the operand sets together: a
> projection always comes with its findings and an unreadable state never has any, where two
> `Option`s would let one be present without the other. `Changed` is untouched and still total.
>
> **The identity a row needs is minted for it.** `summary_of` is built around `snapshot.id` on the
> projected arm and around `espansoconfig_core::workspace::identity_of(&file.path)` on the unreadable
> one — the same register, so the two arms cannot disagree about one file, and a later removal of
> that path resolves to the number the row was drawn under. §3.3's round-3 correction is the register.
>
> **What is still not closed**, said here rather than left to be discovered: a `Changed` that becomes
> non-UTF-8 still loses its `previous_revision` and its `disk_revision`, because Q3's `Unreadable`
> carries neither. That half of R3 stands, narrowed to exactly it.
>
> `AddedContent` is registered as a dictionary namespace rather than excluded as `NOT_A_CODE`. The
> exclusion would have been arguable — both arms render through operands that already have their own
> sentences — but the two mistakes are not symmetric: a namespace nothing renders is an unused key,
> and a wrong exclusion is a code with no string, which this project has ruled is the worse of the
> two.
>
> `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` fails without the
> fix, and its failure message is the finding: `Unreadable { document: Unknown { relative_path } }`.

> **Correction, round 4 (finding 2). The other half of the deviation is withdrawn too, and round 3's
> own brief had asked whether it should move with the first.** *"What is still not closed"* above
> hands the lost revisions on as a residue; round 4 says that is not a residue but a wire defect —
> **`previous_revision` and `disk_revision` are both operands the consult's Q3 puts on `Changed`, and
> the routing discarded both.** A known UTF-8 document at `R1` whose bytes stabilize to non-UTF-8 at
> `R2` crossed as `Unreadable { sequence, document, reason }`, which carries no revision at all, so
> nothing downstream could recover either number from the value it was handed. Assigning that
> decision to the future consumer cannot close missing Rust wire data.
>
> **What changed, and it is round 3's own precedent applied symmetrically.**
> `ExternalObservation::Changed` carries `content: ChangedContent` — `Projected { disk_text, disk,
> findings, correspondences } | Unreadable { reason }` — with `previous_revision` and `disk_revision`
> **outside** the content arm, where the arm cannot destroy them. `StableContent::revision()` answers
> for both arms because the engine hashes the exact stabilized bytes whatever they decode to, so
> `disk_revision` is total by construction rather than by a case. The symmetry with `AddedContent`
> was preferred over putting the two revisions on `Unreadable`, and reading the code gave a second
> reason to prefer it beyond symmetry: `ExternalObservation::Unreadable` also carries
> `Observation::Unreadable`, a **stable read failure**, for which no bytes were obtained and there is
> no revision to report — so revisions there would have been two `Option`s whose absence meant one
> thing, which is the shape §3.2 refused in the first place.
>
> **What `Changed` being "total" now means, said exactly**, because the paragraph above this
> correction uses the word for something narrower. It is total in its **two revisions** and
> discriminated in its content; `disk_text` and `disk` are still paired out of one snapshot, and they
> are paired *inside* `ChangedContent::Projected` rather than at the top level. The pairing argument
> is untouched — an absent `disk_text` beside a present `disk` is still unrepresentable.
>
> `a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text` fails without the
> fix, on *"a change stays a Changed whether or not its bytes are text"*. It replaces
> `present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content`, whose name asserted
> the routing this closes.

### 3.3 `ObservedDocument`, and why `Removed` does not simply carry a `DocumentId`

Q3 writes `Removed { sequence, document, previous_revision }` and
`Unreadable { sequence, document_or_relative_path, reason }`. The second already concedes that an
address may not be an identity; the first does not, and it has to.

`Observation::Removed` and `Observation::Unreadable` carry a path and no identity. This crate cannot
mint one: `espansoconfig_core::workspace::identity_of` is deliberately `pub(crate)` — *"handing
identities out is this module's job, not part of the public surface"* — and widening it would have
been reversing a recorded decision for the convenience of one field. The open `Workspace` maps the
paths it **discovered** to identities, and a file created after the workspace was opened is in
neither. So both variants take `ObservedDocument`, and a path the workspace never discovered crosses
as a display path rendered against the configuration root.

A `Changed` needs none of this: its identity rides its own snapshot, which the engine projected
through the same process-wide table a `Workspace` uses.

> **Correction, round 1 (finding 1 — the High).** The paragraph above was true about the workspace
> and wrong about the consequence, and this is the Q8 failure class: **a stale projection surviving
> over live state**.
>
> `ExternalObservation::Added` hands the consumer the `DocumentId` its own snapshot minted, for a
> file the backend `Workspace` never adopted (`loaded: false`). When that same file later became
> non-UTF-8, was removed, or stopped being readable, the observation went through `address_of`,
> which asked only the workspace — so it answered `ObservedDocument::Unknown`, whose `relative_path`
> is expressly display data and **not** an address. The consumer was left holding a projection under
> an identity nothing could tell it to invalidate. The record named the two costs of §3.2 and did
> not name this one, so the deviation was not fully defensible as written.
>
> **The fix is in the code.** The queue now remembers, for the life of one epoch, every identity it
> has put on the wire, against the path it put it on — `QueueState::issued_identities`, written by
> `external_observation` and read by `address_of` after the workspace answers `None`. Three
> properties of the shape, each chosen against an alternative:
>
> - **The record is written where the identity crosses, not at the call site.** `external_observation`
>   is the one projection into wire form, so *every identity that crosses is remembered* is true by
>   construction: a variant added later cannot cross without passing through that match. Recording
>   in `drain` around it would have been one more place to forget.
> - **It is written at drain time and not at enqueue.** *Issued* means *put in front of the
>   consumer*. An entry the queue dropped for capacity before any drain issued nothing, so the
>   consumer holds nothing under it — and that case is already a `discarded > 0` reload.
> - **It is not evicted from, and it is not bounded by `QUEUE_CAPACITY`.** Evicting would restore
>   exactly the silent stranding this closes. Its growth is one path and one identity per distinct
>   path this epoch addressed; R9 below carries that, stated rather than hoped about.
>
> Asking the workspace first changes no answer, and the reason is worth stating without rounding it
> up. Both values are `espansoconfig_core::workspace::identity_of` over the same process-wide,
> path-keyed table — the workspace's `by_path` at discovery, and the engine's `snapshot.id` at
> projection — so **where the two hold the same path key they hold the same number**, and where they
> do not, one of them simply has no answer. What no type forces is that: a `DocumentId` is a plain
> number, this crate cannot call `identity_of` to check, and the agreement is a property of the
> core's table, restated here. `identity_of`'s own doc is where it is stated. `Unknown` now means
> exactly *this session handed no identity out for this path in this epoch* — so a display path
> strands no projection — and the qualification *in this epoch* is real: `begin_epoch` empties the
> record with everything else, and an epoch mismatch is what makes such a batch stale.
>
> `an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot` fails without the
> fix, `Unknown` against `Known`, over exactly the review's sequence — an addition, then non-UTF-8
> bytes, then a removal. `an_identity_issued_in_one_epoch_addresses_nothing_in_the_next` pins the
> epoch boundary.
>
> **What this does not close.** R3 is narrowed and not discharged: a file whose *first* stable
> observation is non-UTF-8 still crosses as a path, because no identity was ever issued for it, and
> a `Changed` that becomes unreadable still loses its revisions. And **nothing in Rust makes a
> consumer invalidate what it holds** — this step makes the identity available, which is the half a
> type can carry; acting on it is 2d-5's.

> **Correction, round 3 (findings 3 and 5). `QueueState::issued_identities` is deleted, and what
> replaces it is the table it was a copy of.** The round-1 fix above is right about the defect and
> wrong about the remedy in two ways it names itself: it said this crate *cannot* mint an identity
> and that widening `identity_of` would be *"reversing a recorded decision for the convenience of one
> field"* — and then built a second, epoch-scoped copy of the core's own path-keyed register on the
> drain path. Round 2's finding 5 and round 3's finding 5 are that copy.
>
> **The core now answers the question directly.** `espansoconfig_core::workspace` gains
> `identity_already_issued(path) -> Option<DocumentId>`, a **read that mints nothing**, and
> `identity_of` — which mints — becomes public. Both are documented as what they are, because asking
> the minting one is not a question but an allocation, and a caller that used it as a lookup could
> never answer `None`. `address_of` is now one read of `identity_already_issued` and nothing else;
> `external_observation` no longer threads a map; `drain` no longer needs its disjoint borrow. The
> core gains no dependency and no behaviour — `cargo tree -p espansoconfig-core | rg tauri` is still
> empty — and what changed is who may ask.
>
> **Widening `identity_of` is a reversal, and it is recorded as one.** It was `pub(crate)` because
> handing identities out is that module's job. It still is; the one case that forced this is a file
> created after the workspace was opened whose bytes are never valid UTF-8, which reaches no
> projection and so has no identity for a sidebar row to be drawn around (§3.2's round-3 correction).
> The alternative was for this crate to invent a number, which would name nothing and could collide
> with one the core later mints for a different path.
>
> **Two answers changed, and both are corrections rather than relaxations.**
>
> - **`Unknown` got narrower and its promise got stronger.** It used to mean *this session handed no
>   identity out for this path in this epoch*; it now means *nothing in this process has ever named
>   this path*. The claim that rests on it — a display path strands no projection — was true before
>   and is true by a wider margin now. It stays reachable: a file created after the workspace was
>   opened whose *read* fails emits `Observation::Unreadable` and never an `Added`, so it is never
>   discovered, never projected and never minted for.
> - **An address now survives a workspace replacement**, where `begin_epoch` used to empty the copy.
>   The reason that was written down — *"one path in two epochs is two files, so an address carried
>   across a replacement would name the wrong one"* — **contradicts the core's identity model**,
>   which deliberately gives a path one number for the life of the process, a recreation at that path
>   included. What a replacement makes stale is the batch, through `ReconciliationBatch::epoch`, and
>   never an address. `an_identity_issued_in_one_epoch_addresses_nothing_in_the_next` asserted the
>   false sentence and is replaced by
>   `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale`.
>
> **What no type forces, in the same breath.** `address_of`'s answer is the identity the consumer
> holds only because every identity in this application comes out of that one register — a
> `Workspace`'s at discovery, the engine's at projection, this module's at a non-UTF-8 addition.
> That is now a **single source** rather than two structures documented as agreeing, which is
> strictly better than what round 1 shipped, and it is still the register's property and not these
> types'. The tests were changed to mint through it rather than through a literal `DocumentId(7)`,
> because a helper that invents a number turns every identity assertion into a test of the helper.
>
> All three identity tests fail without the fix; §12.4 has the watched failures.

> **Correction, round 4 (finding 1). Deleting the workspace question was one deletion too many: a
> process-lifetime identity is not an address in the current workspace.** The correction above is
> right that the register is the single source of a path's number and right that `begin_epoch` had no
> business emptying a copy of it. What it also did was make `address_of` ask the register **and
> nothing else** — and that register's own doc says, in the same words, that a `Some` "says nothing
> about whether the file exists now, whether the caller ever saw the number, or which workspace
> generation was open when it was minted".
>
> Round 4's interleaving: epoch 1 opens root `R` holding `match/a.yml` and mints `D`; the file is
> removed and epoch 2 reopens `R` without it, so neither the epoch-2 workspace nor the frontend
> summary contains `D`; an external process recreates the path but stable reads fail, so the
> observation is `Unreadable`. `identity_already_issued` answers `D`, and the epoch-2 wire sent
> `Known { document: D }` **and omitted the display path** — while `Workspace::document_context(D)`
> answers `UnknownDocument`. The consumer was handed a number the open workspace rejects, and nothing
> else.
>
> `an_identity_issued_in_one_epoch_addresses_nothing_in_the_next` was deleted for asserting a false
> sentence, which it was; but it was carrying a **true distinction underneath the false one** —
> *stable path identity may survive an epoch, current addressability does not* — and
> `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` did not replace that
> protection: it built an empty workspace that cannot resolve the identity and then declared the
> resulting `Known` correct without asking the workspace anything.
>
> **What changed: `ObservedDocument` has three arms and every one of them carries the display path.**
>
> - `Addressable { document, relative_path }` — the **open workspace** resolves this path to this
>   identity, so the number is an address every workspace command accepts today;
> - `Named { document, relative_path }` — this process named the path and the open workspace does not
>   hold it. Two ways here and this arm does not distinguish them, because this queue cannot: a file
>   created after the workspace was opened, whose identity the consumer received from an `Added` of
>   this epoch — **round 1's finding, and the identity is exactly what un-strands it** — or a path a
>   replaced workspace discovered, under which the consumer may hold nothing at all;
> - `Unnamed { relative_path }` — nothing in this process has ever named the path.
>
> **Round 1's finding 1 is not reopened**, and that was the constraint: the identity still crosses for
> an added-then-changed file, because refusing to send it is what stranded the consumer. What changed
> is that it is no longer *called* an address the current workspace resolves, and that a consumer
> which cannot use it now has a name to act on instead of nothing.
>
> **`address_of` asks two questions in the order that makes the strongest true answer win** — the
> open workspace first, the register second. `address_of_minted` is new beside it for the arms that
> already hold an identity (a projected `Changed`): it asks the workspace whether it resolves the
> path to the **same** number, and answers `Named` if not, so those arms never depend on the two
> identity sources agreeing.
>
> **No accessor over the three arms is declared**, deliberately: one answering *the identity, where
> there is one* would let a consumer collapse `Addressable` and `Named` with a `?`, which is the
> distinction the type exists to force.
>
> `an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address` is round 4's exact
> interleaving over two real workspaces, and it fails against the register-alone rule with
> `Addressable` where `Named` belongs.

> **Correction, round 6 (Low 1). *"Answers `Named` if not, so those arms never depend on the two
> identity sources agreeing"* has been false since round 5**, which deleted that branch and did not
> correct this sentence — the block above is one of the narrower instances round 5's own §14.4
> predicted. `address_of_minted` has not answered `Named` for a disagreement since round 5: it
> answers `Addressable` with the number the **workspace** gave and required the two to agree.
>
> **Round 6 is why the dependence has to be stated rather than denied.** A projected `Changed`
> carries the snapshot's identity twice more inside itself — `DocumentView::id`, and every `MatchId`
> beneath it — so an address built from the workspace's number would put **two identities for one
> file in one object**. There is no arm that is true in that case: `Named` claims the workspace does
> not hold a path it holds, and `Addressable` with either number is false about one half of the
> object. So the agreement is now an `assert_eq!` that holds in **every build profile**, and a
> disagreement is a failure rather than a wire value. §15.1's L1 row is the reasoning and what the
> trade costs.

> **Correction, round 7 (Low 1). *"There is no arm that is true in that case"* is false**, and the
> block above is one of three positions in this file that say it. `Addressable` carrying the number
> the **workspace** answered is true of the number it carries; what is false is the observation built
> around it, whose projection is addressed by the **snapshot's**. The accurate general form is **no
> arm makes the object honest**. Nothing about the policy changes — a locally true arm inside a
> dishonest object is still not a wire value — and the round-7 correction block after §15.1's table
> is the full derivation and the list of positions.

### 3.4 The projection happens at drain time, not at enqueue

Because §3.3 needs the open `Workspace`, and the sink runs on the watcher's worker thread with no
session lock. Enqueuing the engine's own value and projecting later also keeps the worker thread
cheap: no document is cloned until somebody asks. The cost is that a drain clones what it returns —
entries survive their own drain (§2.1), so they cannot be consumed — and that is one clone per
pending document per drain, on a path that runs when a window asks.

### 3.5 `correspondences` carries answers and never the question

`ExternalObservation::Changed::correspondences` is the core's `CorrespondenceTable`, forwarded
unchanged. It already carries the editor's flexible tier, the exact-item tier that delete, move and
duplicate require, and — by the core's own ruling — exact **placement** correspondence, because a
placement resolves at the exact-item tier and no other, so a separate column would be a second copy
of one value. **No `ReapplyAnchor` crosses**: the anchor is captured and dropped inside
`correspondences_between`, and `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor`
asserts the serialized batch contains no `owned_runs_digest`. Both sides of the table come from one
fresh snapshot, because the core builds both there.

`None` where either side had no projection — no previous snapshot, or a new state that is not UTF-8.
A document not loaded in the backend therefore needs no table, exactly as Q3 says.

### 3.6 `UnreadableReason` is a closed set over an open one

`std::io::ErrorKind` is `#[non_exhaustive]`, so the mapping needs a wildcard and `Other` is where
everything unnamed lands. `Other` carries **no operand**: the kind's own `Debug` spelling is
untranslated developer prose, and plan section 9 forbids prose on this wire. That means a reader of
an `Other` cannot tell two unnamed failures apart — stated, not smoothed over.

### 3.7 Which codes this step owed, and which it found already answered

Q3 names four kinds of enum that must cross as a code plus operands: *unreadable reason, removal
state, conflict origin, watcher failure/degraded mode*. This step introduces the first two and
answers the other two by checking rather than by assuming:

- **Unreadable reason** — `UnreadableReason`, a new namespace, six sentences in each language.
- **Removal state** — the discriminant of `ExternalObservation` itself, a new namespace, four
  sentences in each language. Registering the whole enum rather than only its `Removed` arm is
  deliberate: *added*, *changed* and *unreadable* each produce their own sentence too, and *a code
  with no string is worse than a code with no caller* is the rule `dictionary_contract.rs` has
  applied since Phase 1b-2b.
- **Conflict origin** — nothing new, and nothing exists yet. Q5 rules that the origin becomes a
  discriminant inside the **frontend's** one shared conflict model, over a wire value Rust already
  answers (`SaveResult::Conflict`) and the `ExternalObservation::Changed` this step adds. No Rust
  enum is owed, and the discriminant itself is 2d-5's to declare.
- **Watcher failure / degraded mode** — nothing exists to name. `crate::watch::WatchStatusView` is a
  struct of two booleans, is not serialized, is not on the wire, and nothing renders it; it is an
  observability accessor `watch_check` reads. There is no enum to register, and inventing one before
  a surface shows it would be inventing a protocol for a producer nobody has written. **That is a
  hole in the phase and not in this step**: while the fallback is engaged the window is told
  nothing, and 2d-6 is what draws it.

`ObservedDocument` is the one new serializable enum that is **not** a code. It is an address, the
same class `PathSegment` and `DraftTarget` are in: both arms are rendered literally — a `DocumentId`
is a number the caller hands back, and the other arm is a display path — and what a screen *says*
about a removed or unreadable file comes from `ExternalObservation`'s namespace, not from this one.
`NOT_A_CODE` carries it with that reason, and that table is asserted in both directions, so the
exclusion cannot rot into a suppression.

### 3.8 The event is not a `CommandResult`, and the drain refuses without a workspace

`ReconciliationWake` reports no requested operation, so it is not a `CommandResult` — Q3's own
reasoning. `drain_external_changes` answers `Result<ReconciliationBatch, CommandError>` on the Rust
side and leaves the conversion into `CommandResult<T>` to the TypeScript wrapper, which is the seam
`docs/decisions/2d-4-split-notes.md` cuts this step on.

It refuses with `CommandError::NoWorkspaceOpen` rather than answering an empty batch, for two
reasons: every other workspace command does, and with no workspace there is no root to render a
path against. The alternative — a batch at `NO_EPOCH` — was considered and rejected as a second
convention on a surface that already has one.

**`NO_EPOCH` is still reachable on a batch, and the doc comment on the field says so** rather than
claiming otherwise, which is where an earlier draft of this record was wrong. An open whose epoch
allocator is exhausted installs `WatcherLifecycle::without_epoch` — no worker, nothing tagged — and
the ledger and the queue both adopt zero. Such a workspace is watched by nothing and its batch is
always empty; the field is how that is visible instead of silent. Unreachable in any physical
execution, and typed rather than hoped away, exactly as the allocator itself is.

---

## 4. What the epoch check does and does not prove

There are **two** epoch checks on this path and they answer different questions.

- **The ledger's**, in `admit`: an observation carrying an epoch the session has replaced is
  discarded before anything about it can name a document. That is 2d-2's fence, given a reader at
  2d-3.
- **The queue's**, in `enqueue`: an observation whose epoch is not the one this queue is holding is
  stored by nothing and wakes nobody.

The second is **not redundant**, and it is also **not a second proof of the same thing**. The ledger
adopts an epoch and the queue adopts it in the same block of `WorkspaceSession::open`, under the
same session lock, before the successor watcher starts — so today they cannot disagree. The queue's
check is what makes that agreement a property of the queue rather than a property of one call site
in `commands.rs`: nothing in the type system passes the ledger's answer to the queue, and a future
producer that reached `enqueue` without passing `admit` would otherwise put a replaced workspace's
observation in front of a person.

> **Correction, round 1 (finding 7).** *"So today they cannot disagree"* claims an atomicity the code
> does not give. They are **two separate leaf mutexes, reset sequentially** inside one session-lock
> block, so between `WriteLedger::begin_epoch` and `ReconciliationQueue::begin_epoch` there is a real
> window in which the ledger holds the new epoch and the queue still holds the old one.
>
> **What actually prevents cross-epoch leakage** — the true mechanism, which the review confirms —
> is three facts rather than one:
>
> - An old observation admitted immediately before the ledger reset enqueues into the **still-old**
>   queue, where it matches the old epoch and is stored. The queue reset that follows, a few
>   statements later and under the same session lock, **removes it** — `begin_epoch` replaces the
>   whole state rather than filtering it.
> - The successor watcher is started **after both resets**, still under that session lock
>   (`WorkspaceSession::open`), so no successor observation can arrive while either half is still
>   old.
> - Any old observation arriving **after** both resets fails the ledger's epoch check, and would fail
>   the queue's too.
>
> So the outcome the original sentence wanted is real and its stated reason was not. Nothing in the
> types makes the two resets one operation, and a future reordering that started the successor
> watcher between them would break this without failing any test here.

> **Correction, round 2 (finding 3).** *"Three facts"* is an **incomplete** mechanism recorded as the
> complete one, which is this record's second wrong version of this passage. It omits an
> interleaving, and in that interleaving both the first bullet and the third are false of the
> observation: an old observation can pass `WriteLedger::admit`, pause **before** the synchronous
> `downstream(...)` call in `admitting_sink` — the guards are dropped by then, deliberately — and
> resume only after **both** resets have run. It never entered the still-old queue, so the first
> bullet does not describe it; and it does not fail the ledger's check, because it passed that check
> before the reset. What refuses it is the **queue's** epoch check.
>
> **What actually prevents cross-epoch leakage**, written against the code rather than against the
> previous wording. Split on where the observation's `enqueue` falls relative to
> `ReconciliationQueue::begin_epoch`. **The two cases are exhaustive because both take the queue's
> one state mutex**, which serializes them: one strictly precedes the other, and there is no third
> order.
>
> - **`enqueue` acquires the mutex before `begin_epoch` does.** The observation had already passed
>   the ledger's check — necessarily *before* `WriteLedger::begin_epoch`, since an `admit` after that
>   answers `StaleEpoch` and never calls downstream at all. The queue is still holding the old epoch,
>   so the entry is stored — and `begin_epoch`, a few statements later under the same session lock,
>   **replaces the whole `QueueState`** and takes it with it. The fence here is the wholesale
>   replacement, not either epoch check.
> - **`enqueue` acquires the mutex after `begin_epoch` did.** The queue holds the new epoch and the
>   observation carries the old one, so `enqueue` returns `None` and stores nothing — **whether or
>   not it had already passed the ledger's check**. This is the interleaving the three-fact version
>   omitted, and the queue's own epoch check is the only thing that closes it. That is what makes
>   that check independent evidence rather than a second copy of the ledger's, which §4's main text
>   claims one paragraph above and had no complete argument for.
>
> The successor watcher's start is a **separate** claim about a different direction and it stands:
> it happens after both resets, still under the session lock, so no *successor* observation can
> arrive while either half is still old. Were a future change to start it between the two resets,
> the damage would be a successor observation refused by the still-old queue and dropped without
> being counted — not cross-epoch leakage, and not a failure of any test here.
>
> `ReconciliationQueue::enqueue`'s stale-epoch arm now carries this reasoning at the code, so the
> record can be checked against the source rather than the other way round. **No test can fail a
> false record**, and none of this is a behaviour change: the code was already right in both cases.

**What the epoch check proves:** that a value carrying epoch *n* is not stored by, drained from or
woken for a queue holding epoch *m ≠ n*.

**What it does not prove:**

- **Not that the sequence is fresh.** Sequences and epochs are two counters; the epoch says which
  workspace, and only the sequence says which observation.
- **Not that the frontend's epoch matches.** The batch carries `epoch` so the consumer can compare;
  nothing in Rust knows what the window is showing, and Q3's *"an epoch mismatch makes the whole
  wake or drained batch stale and installs nothing"* is a rule for **2d-5** to obey. This step
  supplies the field and no enforcement.
- **Not that a replaced watcher has stopped.** A replacement's join happens outside the session lock
  and, in one case, on the reaper's thread; the old watcher may still reach the sink. That is
  exactly why the tag exists, and both checks above are what act on it.
- **Nothing about time.** An epoch is a workspace generation, not a clock.

---

## 5. The liveness contract: no inventory entry was added, and why

`crates/espansoconfig-core/src/watch/liveness.rs` states the observation pipeline's liveness
contract once, and `src-tauri/src/liveness_contract.rs` sweeps both source trees and fails on any
liveness-shaped position its 82-entry inventory does not carry. **This step added no entry**, and
that is a fact about what it wrote rather than about the sweep:

- `reconciliation.rs` needs the general guarantee in exactly one place — *what the whole observation
  pipeline does and does not promise about a path ever being looked at again* — and it **points** at
  `espansoconfig_core::watch::liveness` over an intra-doc link and says no more. `cargo doc
  --workspace --no-deps` exits 0, and both crates deny `rustdoc::broken_intra_doc_links`, so that
  pointer is compile-checked.
- Every other sentence in the new module is a local fact about the **queue** — what it stores, what
  it drops, what order it returns — and none of them uses a wording in `LIVENESS_SHAPES`. A queue
  makes no promise about whether a path is looked at; it makes promises about values it was handed.
- The three files whose liveness-shaped positions were touched at all (`main.rs`, `watch.rs`,
  `ledger.rs`) kept every such sentence intact: the edits were to the *"what this module is not,
  yet"* paragraphs, which carry none.

`every_liveness_claim_is_judged` is green, which is what says the inventory still matches the tree.
**It catches an unmarked claim and a new claim, and it cannot judge whether a claim is true** — the
limit `docs/decisions/2d-3-C-notes.md` §5 states, unchanged by this step.

> **Correction, round 1 (finding 5).** The second bullet above — *none of them uses a wording in
> `LIVENESS_SHAPES`* — was true, and it was true for the wrong reason. The step shipped a liveness
> claim in a wording the sweep did not carry, in **two** places: `src-tauri/src/events.rs`'s
> `wake_emitter` said a window that never hears a wake *still reconciles* after listener
> registration, after an open and on resume, and
> `ReconciliationQueue::wake` said it *still drains* the same three times. Neither is a wording in
> `LIVENESS_SHAPES`, which is why the green sweep missed both — and the claim was **false in the
> present tense**, because those three frontend drains do not exist: §6 of this record says in as
> many words that no frontend code can call the command.
>
> Two things were done, in this order.
>
> 1. **The sentences were made true.** Both now state the drains as an obligation the 2d design
>    consult's Q3 puts on a **future** consumer, name where it lands (2d-4b declares the command;
>    2d-5 orchestrates the drains), and say in the next breath that a wake dropped today is recovered
>    by nobody. Each also records what the earlier draft claimed, so the correction is visible at the
>    site and not only here. Two neighbouring positions carrying the same shape were fixed with them:
>    `install_wake_emitter`'s *the drain command is what makes it recoverable*, and the module doc's
>    *a lost answer costs nothing*.
> 2. **`LIVENESS_SHAPES` was widened** to carry the wording family: `still drain`, `still reconcile`,
>    `drain again`, `drains again`, `reconcile again`, `reconciles again`. That module's own doc says
>    a paraphrase built from none of the phrases is invisible and that narrowing a phrase to fit
>    today's tree is what makes a pattern miss tomorrow's claim, so this is in its spirit. **The
>    widening produced exactly two new unmarked hits across both source trees** — `events.rs` and
>    `reconciliation.rs`, both this round's own rewritten sentences — and both are now in `INVENTORY`
>    as *local fact*, because the claim is about the wire's recovery from a dropped hint and not
>    about the observation pipeline's re-observation of a path. No pre-existing position in either
>    tree matched any of the six.
>
> Worth stating plainly, because it is the reason the widening was worth doing: the six phrases would
> have caught **both** original sentences — `still reconciles` matches `still reconcile`, and
> `still drains` matches `still drain`.

> **Correction, round 2 (finding 4).** Item 2 above is wrong twice, and both are the same mistake:
> it was written from the two sentences it had just fixed rather than from the family and the
> taxonomy.
>
> - **The classification is wrong.** Both hits were filed as *local fact*, on the ground that the
>   claim is about the wire's recovery from a dropped hint rather than about the pipeline's
>   re-observation of a path. That is a true statement about the subject and the wrong answer to the
>   question. Both passages **expressly restate the 2d design consult's Q3 obligation on a future
>   consumer** — a drain after listener registration, after an open completes, and on foreground or
>   resume — and both say in the next breath that nothing here performs it. A *local fact* is a
>   claim this code keeps; these keep nothing. The inventory's own taxonomy already has the
>   category — **a pointer**, whose one prior entry reads *"the topic list of the sentence that hands
>   the claim to the contract"* — so no taxonomy change was needed, only the right label. Both
>   entries now read `a pointer:` and name Q3 and where the obligation lands. `Judged::reason`'s doc
>   gained one paragraph saying that a passage which restates an obligation and hands it on is a
>   pointer **whichever contract it hands it to**, because these two hand theirs to Q3 and not to
>   `liveness.rs`. Filing them as local fact recorded incorrectly the one distinction the whole check
>   exists to force a reviewer to make.
> - **The widening was drawn around the wording of the finding.** *"drains again"* and
>   *"reconciles again"* were in; the passive *"drained again"*, the prefixed *"re-drain"* and both
>   word orders of reconciliation resuming were not, and each is an obvious way to make the identical
>   claim. Five phrases were added — `drained again`, `re-drain` (which covers `re-drains`,
>   `re-drained` and `re-draining`), `reconciled again`, `reconciliation resumes` and
>   `resumes reconciliation` — bringing the family to eleven and `LIVENESS_SHAPES` to 61 phrases.
>   **They surface zero new unmarked hits across both source trees**, so the stop rule this round
>   carried (more than five new hits ⇒ stop, fix none, report) was not reached and nothing was
>   deferred. `every_liveness_claim_is_judged` is green with the inventory unchanged in count.
>
> The limit §5 already states is unchanged and is worth restating against this very finding: the
> check caught neither of these. It cannot judge a classification any more than it can judge a
> truth — a hit filed under the wrong one of its four kinds is as green as a hit filed under the
> right one.

---

## 6. The one deliberate asymmetry: Rust registers a command TypeScript does not declare

`wire_contract::the_registered_commands_are_the_workspace_sixteen_and_the_menu_command` compares the
names parsed out of `generate_handler!` against `COMMAND_NAMES` in `src/lib/ipc/commands.ts`, in
both directions. 2d-4a registers `drain_external_changes` and 2d-4b declares it, because the split
falls on the Rust/TypeScript seam.

Rather than weaken the test, `AWAITING_FRONTEND_DECLARATION` names the gap and is itself checked in
**both** directions: an entry that Rust does not register fails, and an entry the frontend **does**
declare fails, so 2d-4b cannot add the name without deleting the entry in the same change. An empty
list is the ordinary state.

**What this costs between the two steps, said plainly:** the command is dispatchable and no frontend
code can call it, so nothing in the window reconciles anything. That is the split's intended shape
and not an oversight.

---

## 7. Evidence

25 new Rust tests: 20 in `reconciliation.rs`, 4 in `commands.rs`, 1 in `dispatch_check.rs`.

| Claim | Test |
|---|---|
| A batch is ordered by sequence, not by arrival | `a_drained_batch_is_ordered_by_sequence_whatever_order_it_arrived_in` (enqueues 9, 3, 5) |
| A repeat of one path's state coalesces onto the newer sequence | `a_repeat_of_one_paths_state_coalesces_onto_the_newer_sequence` |
| Two revisions of one path are two entries | `two_revisions_of_one_path_are_two_entries` |
| A removal and a recreation at identical bytes are two observations (Q3) | `a_removal_and_a_recreation_at_identical_bytes_are_two_observations` |
| Another epoch's observation is stored by nothing; so is one for a queue with no epoch | `an_observation_from_another_epoch_is_stored_and_woken_for_by_nothing` |
| Adopting an epoch discards the previous one's entries and its losses | `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` |
| The watermark is an acknowledgement: the same call answers the same batch twice | `a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not` |
| An empty batch answers the watermark it was asked with | `an_empty_batch_answers_the_watermark_it_was_asked_with` |
| A sequence at or below the watermark is counted as a loss, never silently reordered | `a_sequence_at_or_below_the_acknowledged_watermark_is_counted_as_a_loss` |
| A full queue drops its oldest and counts it | `a_full_queue_drops_its_oldest_entry_and_counts_it` |
| The wake carries the epoch and the newest pending sequence | `a_wake_carries_the_epoch_and_the_newest_pending_sequence` |
| The installed emitter hears every enqueue the production sink makes | `an_installed_emitter_hears_every_enqueue_the_production_sink_makes` |
| The **production pair** — the real gate over the real queue — recovers an external change and suppresses a self-write | `the_production_pair_puts_an_external_change_in_the_queue_and_a_self_write_nowhere` |
| A `Changed` carries its exact text beside the projection of the same bytes | `a_changed_carries_its_exact_text_beside_the_projection_of_the_same_bytes` |
| Non-UTF-8 present bytes cross as `Unreadable`, not as content | `present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content` |
| A read failure crosses as a code, never as an `io::ErrorKind` | `a_stable_read_failure_crosses_as_a_code_and_never_as_a_kind` |
| A path the workspace never discovered crosses as a display path | `a_path_the_workspace_never_discovered_crosses_as_a_display_path` |
| An added file's row says the backend holds no parse of it | `an_added_file_carries_a_row_whose_parse_this_session_does_not_hold` |
| Every variant crosses as a uniform object and no anchor crosses | `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` |
| A **real engine's** conclusion reaches the queue and names the workspace's document | `a_real_engines_conclusion_reaches_the_queue_and_names_the_workspaces_document` |
| The command refuses with no workspace open | `a_drain_before_the_first_open_is_refused_rather_than_answered_empty` |
| An open workspace answers its own epoch with nothing pending | `an_open_workspace_answers_its_epoch_with_nothing_pending` |
| The command hands back what the queue holds above the watermark | `the_drain_hands_back_what_the_queue_holds_above_the_watermark` |
| A replacement empties the queue and moves its epoch | `a_replacement_empties_the_queue_and_moves_its_epoch` |
| The command is registered, reachable with `"permissions": []`, and its argument deserializes | `dispatch_check::drain_external_changes_is_reachable_and_its_watermark_deserializes` |
| A remote origin cannot reach it either | `dispatch_check::a_remote_origin_is_refused` (17 attempts, compared against the registered set) |

**What none of this shows.** No test here writes to a watched tree behind the application's back and
waits: real-filesystem observation is `crate::watch_check`'s subject and stays there. No test here
renders anything, because this step draws nothing. And the ten new dictionary entries are checked
for existence, parity, non-blankness, placeholder agreement and non-identity between EN and ES —
never for whether a sentence is true or in the language its file claims, which is the limit
`dictionary_contract.rs` states about itself.

## 7.1 The gates, all measured on this tree

| Gate | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1297** passed, 0 failed, 26 result lines all `ok`, exit 0 (baseline 1272, +25 — exactly the new tests) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0 (its ~73 `private_intra_doc_links` warnings are pre-existing and are a different lint) |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 252 filtered out (was 227; +25), 73.44 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; the server-build oracle is absent and the client-build oracle matches twice |

The three frontend numbers are **unchanged rather than re-measured against a new baseline**: this
step's only frontend change is data in two JSON files, which adds no module, no `svelte-check` file
and no test. `docs/decisions/2d-4-split-notes.md` §5 assigns the re-measurement to 2d-4b, which is
the step that adds source.

The workspace suite was run on a quiet host after `pkill -f 'target/debug/deps/espansoconfig-'`, per
the host scar `PROGRESS.md` records.

> **Correction, round 1.** The table above is the measurement of the tree the review was
> commissioned against, and it is left as it was written. §10 carries the re-measurement after the
> fix round, and the two Rust numbers moved: `cargo test --workspace` is **1301** (+4 tests), and
> `watch_check::` filters out **256** rather than 252 for the same reason.

---

## 8. What this step deliberately does not build

- **Nothing is drawn.** No Svelte component changed. No open-write-surface registry exists. No
  conflict UI, no automatic reload, no watcher-origin conflict source. Q7 item 4's prohibition,
  and 2d-5's and 2d-6's work.
- **No TypeScript.** No mirrored types, no `BrowserCommands` wrapper, no injectable event listener,
  no `describe*`/`t*` accessors. 2d-4b's, by the split.
- **No writer.** `drain_external_changes` reads; `espansoconfig_core::persist::save_document`
  remains the one entry point that may write a user's file, and the count of writing commands is
  still asserted to be six.
- **No policy about what an observation means.** The queue holds and orders; whether a `Changed`
  becomes a conflict, an automatic reload or nothing at all is 2d-5's arbitration.

---

## 9. Holes and residues, stated rather than hoped about

**Handed to 2d-4b:**

- **R1. A key with no accessor is a key nothing can render.** The ten new EN/ES entries exist and
  are checked for parity; **no suite asserts that a key has an accessor**, so this step's green
  frontend gate is not evidence that these codes are reachable. `docs/decisions/2d-4-split-notes.md`
  §3 says so in advance; 2d-4b's `describe*` builders in `src/lib/i18n/codes.ts` are what discharge
  it, and they are what make a missing key a compile error.
- **R2. The command is registered and no frontend code can call it.** §6. `AWAITING_FRONTEND_
  DECLARATION` fails when 2d-4b declares the name without deleting the entry, which is the only
  enforcement there is.
- **R6. The new wire types have no `wire_contract` mirror check.** `ExternalObservation`,
  `ObservedDocument`, `UnreadableReason`, `ReconciliationBatch` and `ReconciliationWake` are not in
  any of `wire_contract.rs`'s interface/union/operand tables, because those tables compare against
  `src/lib/ipc/types.ts` and this step declares nothing there. Adding the TypeScript mirrors without
  adding the table entries would leave the two free to drift.

**Handed to 2d-5:**

- **R3. A non-UTF-8 `Added` reaches the window as a path, not as a row**, and a non-UTF-8 `Changed`
  loses its revisions. §3.2. Closing it means either a public identity accessor in the core — a
  recorded decision to reverse, not a convenience — or revisions on `Unreadable`, which is a wire
  change. **Narrowed in round 1, not closed**: only a file whose *first* stable observation is
  non-UTF-8 still crosses as a path, because no identity has been issued for it. A file this queue
  has already addressed keeps its identity when it later becomes unreadable (§3.3's correction), and
  the lost revisions are untouched either way.

  > **Correction, round 3 (finding 3). The first half is closed and the second is all that is left.**
  > A non-UTF-8 `Added` is now an `Added`: it carries its `DocumentSummary` and
  > `AddedContent::Unreadable { reason }`, and its identity is minted through the core's register, so
  > it is a row a sidebar can draw and an address a later removal resolves to (§3.2 and §3.3, round
  > 3). Both closures the residue offered were taken — the public identity accessor **and** the wire
  > shape — and the accessor is recorded as the reversal it is rather than as a convenience. **What
  > remains, and R3 now means only this:** a `Changed` whose new bytes are not UTF-8 crosses as
  > `Unreadable` and loses its `previous_revision` and `disk_revision`, because Q3's `Unreadable`
  > carries neither. Closing that is a wire change on `Unreadable`, and 2d-5 is where the consumer
  > that would read those two fields is written.

  > **Correction, round 4 (finding 2). R3 is closed, and the sentence above is why it should not have
  > been left open.** *"2d-5 is where the consumer that would read those two fields is written"*
  > assigns a **missing wire field** to the layer that would have consumed it, which is not an
  > assignment a consumer can act on: there was nothing to read. The wire change the residue itself
  > named was made — as `ChangedContent` rather than as revisions on `Unreadable`, for the reason in
  > §3.2's round-4 correction — so a non-UTF-8 `Changed` now carries `previous_revision`,
  > `disk_revision` and the reason there is no projection. **R3 has nothing left**, and what remains
  > for 2d-5 is what was always its own: deciding what a change to unreadable bytes *means* on screen.
  > This is the second time in this phase that a residue recorded under R3 was a defect; the first was
  > round 3's finding 3.
- **R4. `discarded` has no consumer.** A non-zero value means *reload the workspace, do not
  reconcile*, and nothing enforces that reading. It is inert on every ordinary run, which is exactly
  what makes it easy to leave unread. **Round 1 sharpened what it is carrying**: overflow is
  observable rather than harmless, and the *only* safety in it is this obligation, because dropping
  the globally oldest entry preserves no document (§2.2's correction). A consumer that reconciles
  from a batch with `discarded > 0` is reconciling from a history with a hole in it.
- **R9. `QueueState::issued_identities` is unbounded within an epoch and is never evicted from.**
  §3.3's correction. One `PathBuf` and one `DocumentId` per distinct path this epoch has put an
  identity on the wire for. **There is no bound within an epoch**: not `QUEUE_CAPACITY`, which
  bounds only the pending set, and no other rule here — a long-lived epoch that keeps drawing
  observations for newly created paths keeps growing this map while `pending` stays at 256.
  `begin_epoch` — a workspace replacement — is the only thing that empties it. Eviction is refused
  rather than unconsidered: an evicted path is a path a later removal cannot address, which is
  exactly the stranding the record exists to close, and it would be silent.

  **What it duplicates.** `espansoconfig_core::workspace`'s process-wide, path-keyed identity table
  already retains every path it has minted an identity for, for the life of the process, so this
  introduces **no new class of retained address** — it is a *second* copy of the same path, written
  and read on the drain path. **It is unmeasured**: nothing in this repository counts its entries or
  its bytes, and no workload bound is recorded for it.

  > **Correction, round 2 (finding 5).** R9 previously ended *"Measured by nothing, and small beside
  > a pending `Changed`, which carries a whole file's text."* The reassurance is false of the
  > aggregate: one entry is small beside one `Changed`, but the map has no bound within an epoch
  > while the pending set has one, so *the map* is not small beside *the queue* — that is a
  > comparison of a single entry against a single entry, presented as a comparison of totals. It is
  > removed rather than qualified, because the honest form of it is the two paragraphs above: no
  > bound, a duplicate of storage the core already keeps, and no measurement. `QueueState::
  > issued_identities`'s own doc carried the same understatement — *"bounded by how many files the
  > watched tree produces in one epoch"* — and now says unbounded, names the duplication and says
  > it is measured by nothing.

  > **Correction, round 3 (finding 5). R9 is closed by deletion, which is the closure it was asking
  > for.** Round 2 answered *"it is a duplicate, and it is unmeasured"* by removing the false
  > reassurance; round 3 pointed out that an avoidable second unbounded path-retention structure is
  > not a documentation residue. `QueueState::issued_identities` no longer exists.
  > `espansoconfig_core::workspace::identity_already_issued` reads the register this map was a copy
  > of, so there is now **one** path-keyed structure instead of two, and this crate adds nothing to
  > it that was not already there — the one place it mints, a non-UTF-8 addition, is a path the core
  > would have minted for the moment those bytes became valid UTF-8. §3.3's round-3 correction is the
  > change and what its two behavioural consequences are. What is **not** closed is the core's own
  > retention: that register keeps every path it has ever named for the life of the process, by
  > design and with its own reasoning at `SessionIdentities`, and nothing here measures it either.

  > **Correction, round 3.** R9's title above says `QueueState::issued_identities` *"is unbounded
  > within an epoch and is never evicted from"*, in the present tense, of a field that no longer
  > exists. The paragraphs are left as they were written — they are the record of what round 2
  > decided — and the correction block directly above is the state.

  > **Correction, round 4 (finding 2, Low). R9 is now a claim about the core register alone, and the
  > code's own reassurance about it is deleted.** Round 3 closed the *duplication* and said so
  > honestly — *"what is **not** closed is the core's own retention"* — but left
  > `crates/espansoconfig-core/src/workspace/mod.rs` asserting, as a fact, that "a config tree is tens
  > of files, so it never becomes a consideration". Nothing enforces that and nothing measures it, and
  > since Phase 2d-1 the table is fed by the **watcher** as well as by a directory walk: one entry per
  > distinct path stabilized under the two watched roots for as long as the process runs, which is a
  > stream and not a tree. Create, stabilize and remove `N` distinct watched paths while draining
  > regularly and the queue stays at or below 256 while `by_path` retains all `N`.
  >
  > **Closed by recording it honestly, and the comment now says what is true today**: the table is
  > unbounded, nothing evicts from it, nothing caps it and nothing measures it; the tens-of-files
  > sentence is named as a working assumption that was never enforced or measured; and the assumption
  > it has to cover is stated in its wider form. **Eviction is refused rather than unconsidered** — a
  > forgotten path gets a different number on its next mention, which is exactly the stranding round 1
  > found and closed — and a cap that refused to mint would be worse, since `mint` already treats an
  > ambiguous identity as unacceptable at any cost.
  >
  > **Which phase would bound it, and why not this one.** No step of the 2d split owns it. A
  > *measurement* first becomes meaningful in **2d-7**, the first step that runs this process against a
  > real filesystem long enough for a count to mean anything; an actual **bound** needs a rule for when
  > an identity may be forgotten, and that rule needs to know no consumer still holds it — knowledge
  > the frontend coordinator (**2d-5**) has and the core does not. Until one of those exists this is an
  > unbounded structure with a workload assumption behind it. That is a downgrade of a reassurance to
  > an assumption, not a plan; §13.4 carries it as thin, and this project's own precedent — seven
  > items recorded as bounded residues in Phase 2d-3 later found to be real defects — is why it is
  > written this way rather than reassuringly.

  > **Correction, round 5 (Low 2). R9 is OPEN. It is not closed, not bounded and not discharged, and
  > the round-4 block above opens with the word "Closed", which is the sentence this block
  > corrects.** What round 4 closed is the **reassurance** — the core's comment no longer asserts as
  > fact something nothing checks. It did not close the **bound**, because there is none:
  > `espansoconfig_core::workspace`'s register still retains every distinct `PathBuf` this process
  > has ever named, for the life of the process, fed by `Workspace::from_tree` at discovery and by
  > `watch::engine` at every projection, while the queue downstream of it is capped at 256. Round 5's
  > sequence: over one long process lifetime, create and stabilize distinct paths `P1…PN`, remove
  > each, and drain regularly — the queue stays at or below `QUEUE_CAPACITY` and `by_path` retains
  > all `N`.
  >
  > **Documentation and an assignment to 2d-5 or 2d-7 are not a bound.** They are the honest record
  > of who could build one, which is a different thing, and this project's own precedent is the
  > reason the distinction is worth a correction block: seven Phase 2d-3 items recorded as bounded
  > residues were later found to be real defects, and two of this phase's five rounds found a defect
  > in something recorded under R3 as a residue. R9 therefore stays an **open Low** until it is
  > measured and then either bounded safely or accepted with evidence — neither of which any round of
  > this phase has done. **No code changed for this**; what changed is that nothing in this file now
  > reads as a closure. Round 4's own §13.4 already said it plainly — *"a residue, restated more
  > accurately, not a fix"* — and the word "Closed" three paragraphs above it is what a reader finds
  > first.

  > **Round 6 (Low 4). R9 is still OPEN, and this round changed nothing about it — deliberately.**
  > Round 6 re-derived it rather than accepting round 5's verdict: `SessionIdentities::by_path` is a
  > process-lifetime map (`crates/espansoconfig-core/src/workspace/mod.rs`), every first `identity_of`
  > inserts into it, and **no path removes from it**. Create, stabilize and remove distinct watched
  > paths while draining regularly: the queue stays at or below `QUEUE_CAPACITY` and the register
  > retains all of them.
  >
  > **No code changed, and the verdict is recorded rather than the residue re-narrated.** A bound
  > needs a rule for when an identity may be forgotten, and that rule needs to know no consumer still
  > holds it — knowledge 2d-5's coordinator has and the core does not; a measurement first means
  > something in 2d-7. Neither is 2d-4a's, and **writing that down is not a closure**: this block
  > exists so that the third consecutive round to look at R9 leaves it counted as an open Low rather
  > than as a residue everyone has now agreed about. It is the same open Low round 5 recorded, with
  > one more round of evidence that it is real.
- **R5. The epoch field is supplied and nothing enforces it.** §4. Q3's *installs nothing* is a rule
  2d-5 obeys; this step can only make the mismatch visible.
- **R7. A drain clones what it returns, once per pending document per drain.** §3.4. Bounded by
  `QUEUE_CAPACITY` entries and by how often a window asks, and measured by nothing.
- **R10. A coalesced repeat holds a pending slot until a drain acknowledges it.** Round 2's finding
  1 moved the fold from `enqueue` to `drain`, which is what makes it independent of arrival order —
  §2's round-2 correction. The price is that the pending set now holds every admitted observation
  and not the coalesced form of them, so a repeated hint stream consumes capacity where the previous
  rule kept the pending count flat, and an overflow it causes is a real `discarded` and a real
  reload obligation (R4). Repeats are rare through the present pipeline — the engine emits a
  stabilized observation only when it differs from the revision it tracks, and the ledger's
  `announced` map suppresses the rest — but §2's guarantee 3 says the queue is additive to that rule
  rather than a restatement of it, so *rare* is not *never*. **Measured by nothing**: no test drives
  a repeat stream against `QUEUE_CAPACITY`, and the fold's cost is stated rather than bounded.

  > **Correction, round 3 (finding 2). The cost is now bounded where it mattered, and a test does
  > drive that stream.** *"Repeats are rare"* was the whole of the argument and it justified nothing:
  > round 3's counterexample is one unique observation for document B followed by `QUEUE_CAPACITY`
  > identical ones for document A, which evicted B's **only** state and obliged a whole-workspace
  > reload where the fold alone would have cost nothing. `evictable_sequence` closes exactly that: a
  > document with one pending entry is never the victim while another has two, so a repeat stream can
  > only displace its own document's older entries. §2.2's round-3 correction is the policy and the
  > alternative it refused.
  >
  > `a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state` is the test —
  > `QUEUE_CAPACITY + 1` entries, 256 of them one path's repeats — and it is the one round 2 said did
  > not exist. **What R10 still carries** is the plain fact that a folded repeat holds a pending slot
  > until a drain acknowledges it or an eviction removes it, so a repeat stream *does* consume
  > capacity; what it no longer carries is that the capacity it consumes is another document's.

  > **Correction, round 5 (Medium).** The sentence directly above is one of the positions the
  > retention finding covers: a folded repeat holds its pending slot until a drain acknowledges it,
  > **an eviction removes it, or a replacement epoch discards it**. The third clause changes nothing
  > about what R10 carries — a repeat stream still consumes capacity — and the header's round-5
  > correction is the boundary.

  > **Correction, round 6 (Low 3). R10's round-3 closure claims more than `evictable_sequence` gives,
  > and this is the record claiming a guarantee the code does not — this project's worst defect
  > class.** Two sentences of that block are false: *"a repeat stream can only displace its own
  > document's older entries"*, and *"what it no longer carries is that the capacity it consumes is
  > another document's"*.
  >
  > The policy picks the **busiest path's lowest sequence**, and it breaks a tie between equally busy
  > paths by **the lower of their lowest sequences** — so the victim is drawn from a most-populous
  > path, which need not be the repeating one. Round 6's sequence at capacity 256: path B holds
  > sequences 1 and 2; 253 singleton paths hold 3–255; path A holds 256; an identical repeat for A
  > arrives at 257. A and B now hold two each, the tie goes to B's lowest sequence 1, and **A's repeat
  > evicts B's entry** and increments `discarded`.
  >
  > **The implemented guarantee is the narrower one, and it is exactly what the code's own doc says:
  > a path with one pending entry is never the victim while another path has two.** So a repeat stream
  > can never take a document's *only* pending state while the repeating path holds more than that
  > document does — which is what round 3's counterexample was about and what
  > `a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state` pins. It can take
  > an *older* entry of an equally busy document, and that is a counted loss like any other. `QUEUE_
  > CAPACITY`'s doc and `evictable_sequence`'s doc both state the narrow rule and needed no change;
  > only this entry over-claimed. **R10 stays a bounded residue — bounded by the narrow rule, not by
  > the false one — and no code changed.**

**Inherited from 2d-3 and still open:**

- **`latest_commit_at` is never pruned within an epoch** (2d-3 item 27) — untouched here.
- **A stamp taken too late has no test that can fail** (item 32) — untouched, and the queue adds no
  new clock.
- **Items 39 and 42** — a `PrecedesACommit` refusal's safety is argued over an engine no test can
  hold permanently unstable, and the negative arm of the conditional debt has no discriminating
  oracle. Neither is about the queue.
- **2d-3 item 1 is closed by this step**: *"admitted observations are still discarded in
  production"* is no longer true, and `discarding_sink` no longer exists. Item 2's second half —
  *"when 2d-4's queue exists, the save-origin value it must carry is the conflict"* — is **not**
  closed: the two save-path doors still cannot mint a sequence, and Q5's arbitration between a
  save-origin conflict and a native duplicate is 2d-5's.

**About this record itself:**

- **R8. Every claim above about what the code does is prose over code.** Nothing checks that §2's
  four guarantees are the four the module implements, or that §4's negative list is complete. The
  tests in §7 are the discriminating half; this section is the part a reader has to check against
  the source. That is this project's declared worst defect class and it is not closed by writing it
  down — only by reading the two together.

---

## 10. Round 1 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 1 verbatim: **NOT READY — 1 High, 4 Medium, 2 Low**,
against green gates. Nine targeted questions found seven things behind them. Every finding is closed
below; the correction blocks in §2, §2.1, §2.2, §3.3, §4 and §5 are where each one is corrected at
the sentence it was wrong in, and this section is the index and the evidence.

> **Correction, round 2.** *"Every finding is closed below"* was false of finding 3 and of half of
> finding 7. Round 2 reviewed this fix round and returned **NOT READY — 0 High, 4 Medium, 1 Low**,
> of which **three findings are sentences this round's fix wrote**. Read §11 with this section: the
> table below is left exactly as it was written, and rows 3, 5 and 7 are superseded there. Round 2
> confirms findings 1, 2, 4 and 6 closed.

**Two of the seven were code defects and five were claims the code did not support** — findings 4,
5, 6 and 7 are this project's declared worst defect class, and finding 3 was a *conditional* code
answering an *unconditional* documented guarantee. Nothing here was closed by weakening a sentence:
findings 1, 2 and 3 changed the code, and 4, 5, 6 and 7 changed the words to what is true.

### 10.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| 1 | High | An `Added` issued a `DocumentId` the backend workspace never holds; the same path's later non-UTF-8, removal or read failure went through `address_of`, which asked only the workspace and answered `Unknown` — a display path, not an address — stranding the consumer's projection under an identity nothing could invalidate | **Code.** `QueueState::issued_identities`: every identity `external_observation` puts on the wire is recorded against its path for the epoch, and `address_of` reads it after the workspace answers `None`. §3.3's correction has the three shape decisions and their alternatives | `an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot` (`Unknown` vs `Known`), plus `an_identity_issued_in_one_epoch_addresses_nothing_in_the_next` for the epoch boundary |
| 2 | Medium | An empty batch answered the caller's own `after_sequence`, so an out-of-order drain walked a caller's watermark backwards — against the field's own instruction to store it unconditionally | **Code.** `drain` answers `max(batch's highest, acknowledged)`, with the `max` written into `drain` so the claim is that function's property. The idempotence wording is qualified in all four places it appears | `an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument` (5 vs 10) |
| 3 | Medium | `previous < admitted.sequence` made coalescing conditional on arrival order: a higher sequence arriving first left the older repeat inserted beside it, so the batch was ordered and not coalesced | **Code.** The pair coalesces onto the **higher** of the two sequences whichever order they arrive in; the older arrival stores nothing, is not counted in `discarded`, and owes a wake | `a_repeat_that_arrives_after_a_higher_sequence_coalesces_onto_it_rather_than_beside_it` (2 pending vs 1) |
| 4 | Medium | *"the newest state of every document survives"* is false — the globally oldest entry may be its document's only state — and the overflow test asserted the false sentence while dropping three such documents | **Words.** `QUEUE_CAPACITY`, `enqueue` and §2.2 now say overflow is **observable rather than harmless**, that nothing here enforces the reload, and that R4 assigns it to the consumer | `a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of` asserts the three documents' absence by name — the true property, in place of the false message |
| 5 | Medium | `events.rs` and `ReconciliationQueue::wake` claimed in the present tense that a lost wake *still reconciles* / *still drains* after listener registration, after an open and on resume. Those frontend drains do not exist, and `LIVENESS_SHAPES` matched neither wording | **Words, then the sweep.** Both state the drains as Q3's obligation on a future consumer and deny the present tense in the next breath; `LIVENESS_SHAPES` gains six phrases and `INVENTORY` two entries. §5's correction | `every_liveness_claim_is_judged` (it failed on both positions the moment the phrases were added, and the six would have caught the original wording) |
| 6 | Low | `ReconciliationBatch::discarded` was documented as capacity drops only; `enqueue` also increments it below the watermark | **Words.** The field names both causes and why they are counted together | `a_sequence_at_or_below_the_acknowledged_watermark_is_counted_as_a_loss` — the second cause's existing test |
| 7 | Low | §4 claimed the ledger and queue *"cannot disagree"* about their epochs. Two separate leaf mutexes reset sequentially can disagree transiently | **Words.** §4's correction states the true mechanism in three facts: the still-old queue takes the observation, the queue reset removes it, and the successor watcher starts only after both resets | None — the mechanism was already correct; it is the record that was wrong, and no test can fail a false record |

### 10.2 What the fix round changed, by file

- **`src-tauri/src/reconciliation.rs`** — `QueueState::issued_identities` and `QueueState::owed_wake`
  are new; `enqueue`, `drain`, `external_observation` and `address_of` changed behaviour; the module
  doc's guarantees 3 and 4, `QUEUE_CAPACITY`, `ObservedDocument` and both its arms,
  `ExternalObservation`'s non-UTF-8 section, `ReconciliationBatch::newest_sequence` and
  `::discarded`, `install_wake_emitter`, `enqueue` and `wake` changed wording. Four new tests, one
  rewritten test, one corrected test comment.
- **`src-tauri/src/events.rs`** — `wake_emitter`'s liveness paragraph.
- **`src-tauri/src/commands.rs`** — the unqualified idempotence sentence in
  `WorkspaceSession::drain_external_changes` and in the command's own doc; both now also state that
  `newest_sequence` never falls below an acknowledged watermark.
- **`src-tauri/src/liveness_contract.rs`** — six phrases and two inventory entries.
- **`docs/decisions/2d-4a-notes.md`** — six correction blocks, R3 and R4 amended, R9 added, this
  section.

§7's evidence table is left exactly as written, and **two things in it are now out of date**, said
here rather than by editing it:

- The row labelled *A full queue drops its oldest and counts it* names
  `a_full_queue_drops_its_oldest_entry_and_counts_it`, which **no longer exists**: finding 4 renamed
  it to
  `a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of`, because the
  old name described a tidying and the test is about a loss. Its row's label, *a full queue drops its
  oldest and counts it*, is still true.
- Its row reading *the same call answers the same batch twice* labels what
  `a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not` does, and that test enqueues
  nothing between its two drains — so the row is true as a description of the test. The **guarantee**
  it could be read as is the one finding 2 qualified, and the qualification lives at the four code
  sites §2.1's correction lists.

Four tests that table does not name are new; §10.1 is where they are.

No Svelte component changed, no TypeScript changed, and `src/lib/i18n/{en,es}.json` were **not**
touched by this round: none of the seven findings is about a rendered sentence. Q7 item 4's two
prohibitions hold — this step still draws nothing and still decides nothing about whether a write
surface is open.

### 10.3 The gates after the fix round

| Gate | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1301** passed, 0 failed, 26 result lines all `ok`, exit 0 (1297 before the round, +4 — exactly the new tests) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; its `private_intra_doc_links` warnings are pre-existing and none names an item this round touched |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 256 filtered out (was 252; +4), 69.30 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; the server oracle is absent and the client oracle matches twice |

The workspace suite was run once on a quiet host after `pkill -f 'target/debug/deps/espansoconfig-'`,
with nothing else running concurrently.

### 10.4 What this round did not do, and where it is thin

- **Three of the four new tests were watched failing before their fix**, by reverting each change
  in turn and restoring it: the coalescing branch, the `max` on `newest_sequence`, and the
  `issued_identities` lookup. Finding 4's test is not of that kind and cannot be — it replaces a
  false assertion message with a true assertion over unchanged behaviour — and finding 7's has no
  test at all, because a false decision record is not a state any test can reach.
- **The identity record is proved for the queue and not for a window.** Nothing renders it, nothing
  invalidates from it, and 2d-5 is what makes the identity act. R9 carries its growth.
- **Nothing here observes a real filesystem.** The High's sequence — an addition, then non-UTF-8
  bytes, then a removal — is driven by hand through the queue. `crate::watch_check` remains where
  real-filesystem evidence lives, and it gained nothing this round.
- **The widened `LIVENESS_SHAPES` still cannot judge truth.** It caught both of this round's
  positions because the phrases were added; a claim in a seventh wording is invisible to it, exactly
  as that module's own doc says. R8 is unchanged: this record is prose over code, and the only thing
  that checks it is reading the two together.

---

## 11. Round 2 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 2 verbatim: **NOT READY — 0 High, 4 Medium, 1 Low**,
against gates that were green again. Its scope was **the round-1 fix**, not the original
implementation, and that is why it was commissioned: a fix is a change, and the round that reviews it
is not optional.

**Three of the five findings are sentences round 1's fix round wrote**, and one of those three —
finding 1 — is round 1's own finding 3 surviving its own fix in the other arrival order. That is this
project's most reliable pattern (Phase 2d-3's rounds 12, 13 and 14 each found a High a previous fix
round had written), and it is the reason there is a round 3 against this one.

**One of the five was a correctness defect and four were claims the code did not support.** Finding 1
changed the code; 2, 3, 4 and 5 changed words to what is true. Nothing here was closed by weakening a
sentence: the coalescing guarantee round 1 wrote is the one Q3 states, it was **not** weakened, and
the code now keeps it.

> **Correction, round 3.** *"The code now keeps it"* was true of the fold and false of the queue.
> Round 3 reviewed this fix round and returned **NOT READY — 0 High, 4 Medium, 1 Low**, and its
> finding 1 is that the **capacity bound** was still arrival-order dependent, so a full queue could
> erase the separator that made two states two observations — round 1's finding 3 and round 2's
> finding 1 surviving into a third shape. Read §12 with this section: the table below is left exactly
> as it was written, and rows 1, 2 and 5 are superseded there.

### 11.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| 1 | Medium | Coalescing was decided against the path's **single highest** pending entry, which cannot normalize arbitrary arrival order. `A(9), A(3), B(5)` **dropped A(3)** — an observation that was no repeat in sequence order — and `A(9), B(5), B(3)` left a real repeat uncoalesced. Round 1's finding 3 was not closed | **Code.** `coalesced_sequences` folds each path's **sequence-adjacent** runs of one `ObservedState` onto the run's highest sequence, at **drain**, as a pure function of the pending set. `newest_for_path` and `reindex` are deleted; `enqueue` stores every admitted observation. §2's round-2 correction has the reasoning and the cost | `a_state_that_returns_after_another_one_is_two_entries_whatever_order_they_arrive_in` and `a_sequence_adjacent_repeat_coalesces_whatever_order_it_arrives_in` — both counterexamples, each in three arrival orders, asserting the (sequence, text) list rather than its length |
| 2 | Medium | *"an entry stays until a later drain acknowledges it"* and *"a lost answer costs nothing"* are false under overflow: `enqueue` evicts the oldest undrained entries at `QUEUE_CAPACITY`, before any acknowledgement | **Words.** The eviction condition is now on the retention sentence at five positions — the record's header, the module doc's guarantee 4, `ReconciliationQueue::drain`, `external_observation`, and both `drain_external_changes` docs — each saying that an eviction's cost is a whole-workspace reload and not a repeated drain. §2.1's round-2 correction | None. No code changed and no test can fail a false comment; `a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of` is the behaviour it now describes truthfully |
| 3 | Medium | §4's round-1 correction asserted *"three facts"* as the complete mechanism and omitted an interleaving: an observation that passes `admit`, pauses before the synchronous downstream call and resumes after **both** resets neither enters the still-old queue nor fails the ledger's check | **Words.** §4's round-2 correction splits on where the `enqueue` falls relative to the queue's reset — two exhaustive cases — and names the fence in each: the wholesale `QueueState` replacement for the first, the queue's **own** epoch check for the second. `ReconciliationQueue::enqueue`'s stale-epoch arm carries the same reasoning at the code | None — a false decision record is not a state any test can reach. The code was already right in both cases |
| 4 | Medium | The two new inventory entries were filed as **local fact**; both restate Q3's obligation on a future consumer and describe nothing implemented locally. The widening also omitted obvious forms | **Words and the sweep.** Both entries are now `a pointer:`, the taxonomy's own category for a passage that hands its claim on; `Judged::reason`'s doc says that this holds whichever contract it hands it to. Five phrases added: `drained again`, `re-drain`, `reconciled again`, `reconciliation resumes`, `resumes reconciliation`. §5's round-2 correction | `every_liveness_claim_is_judged` — green, with **zero** new unmarked hits from the five phrases, so the round's stop rule was never reached |
| 5 | Low | R9's *"small beside a pending `Changed`"* is false of the aggregate: `issued_identities` has no bound within an epoch while `pending` is bounded at 256 | **Words.** R9 now states no bound within an epoch, names what it duplicates (`espansoconfig_core::workspace`'s process-wide path-keyed table, which already retains every path for the process lifetime, so there is no new stale-address class), and says plainly that it is **unmeasured**. The field's own doc says the same | None. Nothing counts the map, which is exactly what the residue now says |

### 11.2 What this round changed, by file

- **`src-tauri/src/reconciliation.rs`** — `coalesced_sequences` is new; `QueueState::newest_for_path`
  and `QueueState::reindex` are **deleted**; `enqueue` and `drain` changed behaviour. Reworded: the
  module doc's guarantees 3 and 4 and its *no one-to-one relation between a wake and a queued value*
  bullet, `QueueState::pending`, `QueueState::issued_identities`, `QueueState::owed_wake`, `enqueue`,
  `drain` and `external_observation`. Two new tests and one new test helper; two existing tests
  updated where they asserted `pending()` over a coalesced pair.
- **`src-tauri/src/commands.rs`** — both `drain_external_changes` docs: the coalescing qualification
  on *returned and kept*, and the overflow qualification on retention.
- **`src-tauri/src/liveness_contract.rs`** — five phrases, two entries reclassified, one paragraph on
  `Judged::reason`.
- **`docs/decisions/2d-4a-notes.md`** — six round-2 correction blocks (the header, §2's guarantee 3,
  §2's *not guaranteed* list, §2.1, §4, §5), R9 rewritten, R10 added, §10's opening corrected, this
  section.

No Svelte component changed, no TypeScript changed, and `src/lib/i18n/{en,es}.json` were not touched:
none of the five findings is about a rendered sentence. Q7 item 4's two prohibitions hold — this step
still draws nothing and still decides nothing about whether a write surface is open.

### 11.3 The gates after this round

| Gate | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1303** passed, 0 failed, 26 result lines all `ok`, exit 0 (1301 before the round, +2 — exactly the two new tests) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; its `private_intra_doc_links` warnings are pre-existing and none names an item this round touched |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 258 filtered out (was 256; +2) |
| `npm test` | **2125** passed — unchanged |
| `npm run check` | **431** files, 0 errors — unchanged |
| `npm run build` | **184** modules — unchanged; the server oracle is absent and the client oracle matches twice |

The workspace suite was run once on a quiet host after `pkill -f 'target/debug/deps/espansoconfig-'`,
with nothing else running concurrently. The three frontend numbers are unchanged rather than
re-measured for the reason §7.1 gives: this round touched no frontend file at all, not even the two
JSON dictionaries.

### 11.4 What this round did not do, and where it is thin

- **Both new tests were watched failing before the fix**, on exactly the arrival orders round 2
  named. `[9, 3, 5]` answered `[(5, B), (9, A)]` where `[(3, A), (5, B), (9, A)]` is right, and
  `[9, 5, 3]` answered `[(3, B), (5, B), (9, A)]` where `[(5, B), (9, A)]` is right. Findings 2, 3, 4
  and 5 have no test that can fail: three are false sentences over correct code, and the fourth is a
  classification, which `every_liveness_claim_is_judged` is explicitly unable to judge.
- **The sweep fired on this round's own new prose, and it was reworded rather than judged.** The
  module doc's new sentence about overflow said an eviction is *"answered by a whole-workspace
  reload"*, and `answered by` is in `LIVENESS_SHAPES`; `every_liveness_claim_is_judged` failed on it.
  It is a genuine false positive — the sentence is about what `discarded` obliges a consumer to do,
  not about a path being observed again — so the two honest closes were an `INVENTORY` entry reading
  *false positive* or a rewording. It now reads *"obliging a whole-workspace reload"*. Recorded here
  because a rewording leaves no trace anywhere else, and because the sweep firing on prose written in
  the same round that widened it is the check doing exactly what it is for.
- **Nothing measures `issued_identities`**, which finding 5 asked for as an alternative to removing
  the reassurance. The reassurance was removed instead, and R9 says so.
- **The fold's cost is stated and not measured either.** A repeated hint now holds a pending slot
  until a drain acknowledges it (R10). Nothing in this repository exercises a repeat stream against
  `QUEUE_CAPACITY`.
- **Nothing here observes a real filesystem**, unchanged from round 1: `crate::watch_check` remains
  where real-filesystem evidence lives, and it gained nothing this round either.
- **R8 is unchanged, and this section is an instance of it.** Every claim above about what the code
  does is prose over code. Round 2 found three sentences round 1's fix wrote; there is no reason to
  think this round wrote none.

---

## 12. Round 3 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 3 verbatim: **NOT READY — 0 High, 4 Medium, 1 Low**,
against gates that were green again. Its scope was **the round-2 fix**, not the original
implementation and not round 1's fix, and it was commissioned under the rule that commissioned round
2: a fix is a change, and the round that reviews it is not optional. It was asked one question in
particular — whether calling the surviving arrival-order dependence a `discarded` **loss** rather
than a coalescing failure is a true distinction or a relabelling — and the answer is that it was a
relabelling.

**Round 3's finding 1 is round 1's finding 3 and round 2's finding 1 in a third shape.** The rule
moved out of `enqueue` and the *bound* stayed there: `enqueue` evicted before it stored, so a full
queue's contents depended on which thread arrived first, and through the fold so did the batch. Each
round's fix produced the next round's finding, three times, in the same place. That is this project's
most reliable pattern and it is the reason this section exists at all.

**Three of the five were code defects and two were claims the code did not support.** Findings 1, 2
and 3 changed the code; 5 was closed by deleting the structure it named; 4 changed words to what is
true. **Nothing here was closed by weakening a sentence.** Two sentences were corrected downwards —
the record's header, which claimed no admitted observation is dropped, and §3.3's *one path in two
epochs is two files* — and both are false claims corrected to true ones rather than guarantees
narrowed to fit a defect: the first is stated in §12.1's finding 4 with the three drop causes it
omitted, and the second contradicted the core's own identity model, which the corrected sentence now
follows.

### 12.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| 1 | Medium | Capacity eviction was arrival-order dependent, so the unconditional coalescing guarantee was conditional on it. `enqueue` ran `while pending.len() >= QUEUE_CAPACITY { evict the lowest }` **before** storing the arrival, so a full queue dropped a *resident* entry even for an arrival lower than everything it held. One path at `A(1), B(2), A(257)` retained `B(2), A(257)` in one arrival order and, having lost the separator to the eviction, folded to `A(257)` alone in the other | **Code.** The arrival is stored **first** and the bound restored after — `while pending.len() > QUEUE_CAPACITY`. What the queue retains is then its best `QUEUE_CAPACITY` entries out of everything admitted, a function of the admitted set; an arrival that is itself the right victim leaves again rather than displacing a resident entry. §2's round-3 correction | `a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in` — round 3's own history in three arrival orders, asserting the (sequence, text) list — and `an_arrival_below_everything_a_full_queue_holds_is_the_entry_that_leaves` for the boundary the `>=` was wrong about |
| 2 | Medium | Capacity counted over raw entries, so `QUEUE_CAPACITY` folded repeats for one document evicted another document's **only** state and obliged a whole-workspace reload — where the pre-round-2 queue would have kept both. *"Repeats are rare"* was unmeasured and justified nothing | **Code.** `evictable_sequence`: the lowest pending sequence of the **busiest path**, ties broken by the lower of their lowest sequences. **A document with one pending entry is never the victim while another has two.** With every path at one entry it degenerates to the lowest sequence, which is the original overflow test's case. §2.2's round-3 correction has the refused alternative and the order-independence evidence | `a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state` — and it fails against finding 1's fix alone, which is what separates the two |
| 3 | Medium | A first stable non-UTF-8 **addition** reached the window as a bare display path: no `Added` row and no address, so 2d-5 could neither install a projection nor invalidate one. Neither the workspace nor `issued_identities` knew the path, and nothing had ever minted an identity for it | **Code, in the core and on the wire.** `ExternalObservation::Added` carries `content: AddedContent` — `Projected { disk, findings } \| Unreadable { reason }` — which is Q3's `disk?` as a discriminated value; the row's identity comes from `snapshot.id` where there is a projection and from the now-public `espansoconfig_core::workspace::identity_of` where there is not. `Changed` is untouched and still total. §3.2's round-3 correction | `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` — its failure message against the old routing is the finding itself |
| 4 | Medium | The retention correction claimed more than it changed: the record's **header** still said every admitted observation *"is no longer dropped"* despite three drop causes, `external_observation` named eviction without its cost, and `drain` said a folded entry stays pending without saying an eviction can take it | **Words.** Every position that states retention now states the identical boundary — **acknowledgement or eviction, and an eviction is a loss obliging a whole-workspace reload** — the header included. Every sentence naming the *oldest* entry was rewritten for findings 1 and 2, in `reconciliation.rs` and in both `commands.rs` docs | None. No code changed for it and no test can fail a false comment; `a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state` and `a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of` are the behaviour it now describes truthfully |
| 5 | Low | `issued_identities` was an avoidable **second** unbounded path-retention structure, not a documentation residue: it duplicated the core's process-wide path-keyed register on the drain path, and `QUEUE_CAPACITY` bounded neither | **Code, by deletion.** The field is gone. `espansoconfig_core::workspace::identity_already_issued` — a new public read that **mints nothing** — is what `address_of` asks, so there is one path-keyed structure instead of two. §3.3's round-3 correction has the two behavioural consequences and why each is a correction | `an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot`, `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` and `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` all fail when `address_of` asks only the workspace |

### 12.2 What this round changed, by file

- **`crates/espansoconfig-core/src/workspace/mod.rs`** — `identity_of` is **public**, with its doc
  saying which one case forced the reversal and that it mints; `identity_already_issued` is **new**,
  a read that mints nothing. No behaviour changed and no dependency was added.
- **`src-tauri/src/reconciliation.rs`** — `evictable_sequence` and `AddedContent` are new;
  `QueueState::issued_identities` is **deleted**; `enqueue`, `drain`, `external_observation` and
  `address_of` changed behaviour; `ExternalObservation::Added` changed shape and both its `disk`
  fields are boxed. Reworded: the module doc's guarantees 3 and 4, its *no one-to-one relation
  between a wake and a queued value* bullet and its *where the identities come from* section,
  `QUEUE_CAPACITY`, `ObservedDocument` and both arms, `ExternalObservation`'s non-UTF-8 section,
  `ReconciliationBatch::discarded`, `QueueState`, `begin_epoch`, `enqueue`, `drain` and
  `external_observation`. Four new tests, one new test helper, one test rewritten, the `snapshot`
  helper now mints through the core, and three test comments corrected.
- **`src-tauri/src/commands.rs`** — both `drain_external_changes` docs: the *oldest undrained
  entries* wording, which the new policy makes false.
- **`src-tauri/src/dictionary_contract.rs`** — `AddedContent` as a namespace, with its variant count.
- **`src/lib/i18n/{en,es}.json`** — two new keys each, `code.addedContent.projected` and
  `code.addedContent.unreadable`, EN and ES.
- **`docs/decisions/2d-4a-notes.md`** — the header sentence and **fourteen** round-3 correction
  blocks (the header, §1 three times, §2, §2.1, §2.2, §3.2, §3.3, R3, R9 twice, R10 and §11's
  opening), and this section.

No Svelte component changed and no TypeScript changed. The two dictionary files are data, and
`npm run check`, `npm test` and `npm run build` are unmoved by them. Q7 item 4's two prohibitions
hold — this step still draws nothing and still decides nothing about whether a write surface is open.

**Three rows of §7's evidence table are now out of date**, said here rather than by editing it:
`an_added_file_carries_a_row_whose_parse_this_session_does_not_hold` now reads its projection through
`AddedContent::Projected`; the row naming `a_full_queue_drops_its_oldest_entry_and_counts_it` was
already corrected in §10.2 and its subject is now one case of a wider policy; and
`an_identity_issued_in_one_epoch_addresses_nothing_in_the_next`, which §10.1 names, **no longer
exists** — `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` replaced it
because the sentence it asserted was false.

### 12.3 The gates after this round

| Gate | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1307** passed, 0 failed, 26 result lines all `ok`, exit 0 (1303 before the round, +4 — exactly the four new tests) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; **73** `private_intra_doc_links` warnings, the pre-existing count — the new public core function first added a seventy-fourth by linking a private type, and its doc names that type in words instead |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 262 filtered out (was 258; +4), 75.90 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; the server oracle is absent and the client oracle matches twice |

The workspace suite was run once on a quiet host after `pkill -f 'target/debug/deps/espansoconfig-'`,
with nothing else running concurrently. The three frontend numbers are unchanged rather than
re-measured, for §7.1's reason: this round's only frontend change is two keys in two JSON files,
which adds no module, no `svelte-check` file and no test.

### 12.4 What this round did not do, and where it is thin

- **All four new tests were watched failing before their fix**, by applying the inverse edit and
  restoring it. Against the pre-fix `>=`-before-insert eviction,
  `a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in`,
  `an_arrival_below_everything_a_full_queue_holds_is_the_entry_that_leaves` and
  `a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state` all failed. With
  insert-before-evict restored but the victim still the globally lowest sequence, **only** the repeat
  test failed — which is what separates finding 1's fix from finding 2's rather than letting one
  cover for the other. With the non-UTF-8 addition routed back to `Unreadable`,
  `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` failed on
  `Unreadable { document: Unknown { relative_path } }`, which is the finding verbatim. With
  `address_of` asking only the workspace, the two identity tests and the addition test failed on
  `Unknown` against `Known`. Finding 4 has no test that can fail: it is false sentences over correct
  code.
- **The busiest-path policy's order-independence is argued and measured, not proved.** §2.2's
  round-3 correction states both halves. The measurement is exhaustive over every assignment and
  every arrival order for two and three paths, two states, up to six sequences and capacities two to
  four — which is a bounded check of an unbounded claim, and it lives in this record rather than in
  the repository: **no test enumerates arrival orders.** The three orders in
  `a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in` are a sample, chosen because
  round 3 named two of them.
- **The refused alternative is recorded because refusing it was the substance of finding 2's fix.**
  Preferring an entry the fold currently makes redundant is not arrival-order independent and would
  have reopened finding 1; the counterexample is in §2.2. A capacity rule that is a function of the
  set at the moment of the eviction can be safe, and one that is a function of *state equality* at
  that moment cannot, because a later arrival can un-fold what it folded.

  > **Correction, round 4 (finding 1, Low). The refusal is right and the rule generalized from it is
  > false.** Round 4 independently reproduced the counterexample and confirmed it: under the recorded
  > preference — the lowest currently-folded entry, otherwise the lowest — one path at states
  > `S, T, S, S, S` on sequences 1–5 with capacity 3 retains `{1, 2, 5}` for arrival `1,2,3,4,5` and
  > `{2, 4, 5}` for `1,3,4,5,2`. **That policy is correctly refused, and nothing about the shipped
  > `evictable_sequence` rests on the sentence above.**
  >
  > What is false is the last clause read as a universal: a capacity rule that *is a function of state
  > equality* **can** be arrival-order independent. Retaining the top `K` under any fixed total key
  > containing `(state discriminant, sequence)` is state-dependent and order-independent, because
  > "keep the largest `K` of a set under a fixed key" cannot depend on insertion order at all — which
  > is the same proof §2.2 already gives for the *lowest sequence* half of the shipped rule. What the
  > refused policy actually depends on is not state equality but **redundancy at the moment of the
  > eviction**, which is a property of the *set* and which a later arrival can change; that is the
  > true and narrower sentence, and it is the one `evictable_sequence`'s own doc has always carried.
  > **Words only, and no code changed**: the shipped policy does not look at `ObservedState` at all,
  > so no test can fail this sentence.
- **`identity_of` being public is a reversal of a recorded decision, and nothing enforces its one
  intended use.** Any code in `src-tauri` can now mint an identity for any path. What forced it is
  §3.2's addition; what would catch a misuse is a review, not a type.
- **The core register's own retention is untouched and still unmeasured.** R9 is closed as a
  *duplicate*, not as a bound: `espansoconfig_core::workspace` still keeps every path it has ever
  named for the life of the process. This round removed the second copy and measures neither.

  > **Correction, round 4 (finding 2, Low).** This bullet is accurate and it stopped one sentence
  > short: the code at the other end of it was still asserting, as a fact, that the table "never
  > becomes a consideration". A residue recorded honestly in the notes and reassured away in the
  > source is the same defect with two audiences. R9's round-4 correction is the state; the comment on
  > `session_identities` now says unbounded, unevicted, uncapped and unmeasured, and names which phase
  > could measure it and which could bound it.
- **The sweep fired on this round's own prose again, exactly as it did in round 2.** A new test
  comment read *"so a full queue answered by what arrived last"*, and `answered by` is in
  `LIVENESS_SHAPES`; `every_liveness_claim_is_judged` failed on it. It is a genuine false positive —
  the sentence is about which entries survived a bound, not about a path being observed again — so it
  was reworded to *"what a full queue held depended on what arrived last"* rather than filed. Recorded
  because a rewording leaves no trace anywhere else.
- **Two `disk` fields are boxed for a lint, and the wire is unchanged.** Extracting `AddedContent`
  left `clippy::large_enum_variant` firing on it and then on `ExternalObservation`, so
  `AddedContent::Projected::disk` and `ExternalObservation::Changed::disk` are `Box<DocumentView>`.
  `serde` writes a `Box<T>` as its `T`, and
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` is the test that would have
  seen a change in the serialized shape.
- **`AddedContent`'s two dictionary sentences are checked for existence, parity, non-blankness and
  non-identity between EN and ES — never for truth**, and R1 still stands: no suite asserts that a
  key has an accessor, so nothing here shows these two are reachable. 2d-4b's `describe*` builders
  are what discharge that.
- **Nothing here observes a real filesystem**, unchanged from rounds 1 and 2. `crate::watch_check`
  remains where real-filesystem evidence lives and gained nothing this round either — including for
  the non-UTF-8 addition, which is driven by hand through the queue.
- **R8 is unchanged, and this section is an instance of it.** Round 1's fix wrote three of round 2's
  findings and round 2's fix wrote at least one of round 3's; there is no reason to think this round
  wrote none.

---

## 13. Round 4 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 4 verbatim: **NOT READY — 0 High, 3 Medium, 2 Low**,
against gates that were green again. Its scope was **the round-3 fix**, not the original
implementation and not round 1's or round 2's fixes, and it was commissioned under the rule that
commissioned rounds 2 and 3: a fix is a change, and the round that reviews it is not optional. Round
3's own lesson was carried into the brief — *moving a rule does not move the bound it depended on* —
so round 4 was pointed at what the round-3 fix's own new code and new sentences rest on, the round-3
fix having changed the eviction victim, the wire shape and the identity source in one round.

**Four of the five findings are the round-3 fix's own code or its own sentences, and the honest way
to say it is that round 3 traded one defect for another three times.**

- **Finding 1** is round 3's deletion of the *workspace* question from `address_of`. It closed a real
  duplicate-storage finding and, in the same edit, made a process-lifetime identity be offered as a
  current address with no path beside it — and deleted the one test that was protecting the
  distinction, replacing it with one that could not fail on it.
- **Finding 3** is round 3's own retention correction, which claimed *every* position now states one
  identical boundary. It did not: the headline it had just rewritten states the boundary of a
  **stored** entry as though it were the boundary of an admitted observation, and the two
  `commands.rs` docs it had just rewritten state the boundary backwards, omitting acknowledgement.
- **Low 1** is a sentence round 3's §12.4 wrote: a valid counterexample generalized into a false
  universal.
- **Low 2** is a sentence round 3 *left standing* in the core while recording the same fact honestly
  in these notes — a residue admitted to one audience and reassured away to the other.

Only **finding 2** is not round 3's: it is R3, a residue this record has now carried for four rounds,
and round 4 is the second time in this phase that something recorded under R3 turned out to be a wire
defect. That is this project's stated precedent about bounded residues, and it applied again.

**Two of the five were code defects, two were false claims and one was a false claim with its
reassurance in the code.** Findings 1 and 2 changed the code; finding 3 and Low 1 changed words to
what is true; Low 2 changed a code comment to what is true and named which phase could do better.
**Nothing here was closed by weakening a guarantee the code keeps.** Two sentences were corrected
downwards — the record's headline and the core's tens-of-files assertion — and both are false claims
corrected to true ones: the two-way boundary of a *stored* entry is exactly what the code still
keeps, and the identity table was never bounded by anything.

### 13.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| 1 | Medium | `address_of` asked only the process-wide identity register, whose own doc says a `Some` claims nothing about the current workspace. Epoch 1 mints `D` for `match/a.yml`; epoch 2 reopens the root without it; the path is recreated and stably fails to read. The wire sent `Known { document: D }` **with no display path**, while the epoch-2 workspace answers `UnknownDocument` for `D`. The replacement test built an empty workspace and declared the resulting `Known` correct without testing current addressability, so the deleted `an_identity_issued_in_one_epoch_addresses_nothing_in_the_next`'s real protection — *stable path identity may survive an epoch, current addressability does not* — was carried by nothing | **Code.** `ObservedDocument` has three arms and **every one carries the display path**: `Addressable { document, relative_path }` (the open workspace resolves it), `Named { document, relative_path }` (this process named it and the open workspace does not hold it), `Unnamed { relative_path }`. `address_of` asks the workspace first and the register second; `address_of_minted` is new for the arms that already hold a snapshot's identity and asks the workspace whether it resolves the **same** number. Round 1's finding 1 is not reopened — the identity still crosses for an added-then-changed file, which is what un-strands it; what changed is that it is no longer called an address the current workspace resolves. §3.3's round-4 correction | `an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address` — round 4's interleaving over two real workspaces; it fails against the register-alone rule with `Addressable { document: DocumentId(0), … }` where `Named { … }` belongs. `an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot`, `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` and `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` fail with it |
| 2 | Medium | A known UTF-8 document at `R1` whose bytes stabilize to non-UTF-8 at `R2` crossed as `ExternalObservation::Unreadable { sequence, document, reason }`, which carries no revision — so **both** `previous_revision = R1` and `disk_revision = R2`, the two operands Q3 puts on `Changed`, were discarded by the routing and 2d-5 could recover neither from the value supplied. R3 recorded it as a bounded residue for two rounds | **Code, on the wire.** `ExternalObservation::Changed` carries `content: ChangedContent` — `Projected { disk_text, disk, findings, correspondences } \| Unreadable { reason }` — with both revisions **outside** the content arm, where the arm cannot destroy them; `StableContent::revision()` answers for both arms, so `disk_revision` is total by construction. This is round 3's `AddedContent` precedent applied symmetrically, and reading the code gave a second reason to prefer it over revisions on `Unreadable`: that variant also carries a **stable read failure**, for which no bytes were obtained and no revision exists, so revisions there would have been two `Option`s whose absence meant one thing. `ChangedContent` is a new dictionary namespace with two sentences in each language. §3.2's round-4 correction | `a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text`, which fails against the old routing on *"a change stays a Changed whether or not its bytes are text"*. It replaces `present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content`, whose name asserted the routing this closes |
| 3 | Medium | The round-3 retention correction stated a false universal: the headline said every admitted observation is held until acknowledgement or overflow, while its own correction two lines down admits two further rejection causes — a replaced epoch and a sequence at or below the watermark, both implemented by returning **before** the insertion. And `commands.rs` said an entry is *"kept only until an overflow evicts it"*, which is false in the other direction: it omits removal by acknowledgement. The claimed identical boundary was not achieved | **Words.** The boundary is now stated in two halves everywhere: an admitted observation is **stored** unless it is one of those two arrivals, and a **stored** entry leaves the queue in exactly two ways — a later drain acknowledges it, or an overflow evicts it. The header, the module doc's guarantee 4 and both `commands.rs` docs say it; the sweep for the *shape* found four more positions round 3 did not reach — two in `main.rs`'s module header, `WorkspaceSession::new`'s doc and `queueing_sink`'s. **No guarantee was weakened**: the two-way boundary of a stored entry is unchanged | None. No code changed for it and no test can fail a false comment. `a_sequence_at_or_below_the_acknowledged_watermark_is_counted_as_a_loss`, `an_observation_from_another_epoch_is_stored_and_woken_for_by_nothing` and `a_full_queue_drops_its_oldest_entries_and_the_documents_they_were_the_only_state_of` are the four behaviours it now describes truthfully |
| 4 | Low | §12.4 generalized a valid counterexample into a false rule: *a capacity rule that is a function of state equality **cannot** be arrival-order independent*. Retaining the top `K` under any fixed total key containing `(state discriminant, sequence)` is state-dependent and arrival-order independent, so the universal is false | **Words only.** The refusal of the specific policy stands — round 4 independently reproduced the `S,T,S,S,S` / capacity-3 counterexample retaining `{1,2,5}` versus `{2,4,5}` — and the true, narrower sentence is that the refused policy depends on **redundancy at the moment of the eviction**, a property of the set that a later arrival can change. §12.4's round-4 correction | None, and none is possible: the shipped `evictable_sequence` does not read `ObservedState` at all, so no behaviour turns on the sentence |
| 5 | Low | The core keeps every distinct `PathBuf` it has ever named for the life of the process, and its own comment asserted as fact that "a config tree is tens of files, so it never becomes a consideration" — enforced by nothing and measured by nothing. Since 2d-1 the table is also fed by the watcher, one entry per distinct stabilized path, which is a stream and not a tree. Round 3 closed R9's *duplication* and recorded this honestly in the notes while leaving the reassurance in the source | **Words, in the code.** `session_identities`'s comment now says the table is unbounded, unevicted, uncapped and unmeasured; names the tens-of-files sentence as a working assumption rather than a fact; states the wider workload the assumption has to cover; records that **eviction is refused rather than unconsidered**, because a forgotten path gets a different number on its next mention — round 1's stranding; and names which phase could do better and why. R9's round-4 correction | None. Nothing here can be measured deterministically from a test: the register is a process-wide static shared by every test in the binary, so a count is not a function of the test that reads it |

### 13.2 What this round changed, by file

- **`src-tauri/src/reconciliation.rs`** — `ChangedContent` is new; `ObservedDocument` has three arms
  where it had two, and every arm carries the display path; `ExternalObservation::Changed` changed
  shape; `address_of` changed behaviour; `address_of_minted` and `display_path` are new;
  `external_observation`'s `Changed` arm takes both revisions before choosing a content arm.
  Reworded: the module doc's *where the identities come from* section and its guarantee 4 (the
  retention boundary in its canonical two-half wording), `ObservedDocument` and all three arms,
  `UnreadableReason` (now one type across three wire positions), `ExternalObservation`'s non-UTF-8
  section, its `Added`, `Removed` and `Unreadable` variants, `ReconciliationQueue::drain`'s
  `workspace` paragraph, `queueing_sink`, `external_observation`, and the `snapshot` test helper.
  **One new test**, one test renamed and rewritten, six tests and one test helper updated for the new
  shapes, and one test strengthened — `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor`
  now asserts that the two nested content enums cross as one-key objects like every other wire enum
  (D5 is about *every* wire enum, not the outer one) and that **every** arm of an address carries a
  display path, whichever arm it is. Which arm each observation lands in is deliberately not that
  test's subject: the identity register is process-wide, so another test in the same binary may
  already have named one of its paths.

  > **Correction, round 5 (Low 3). The sentence above overstates its own test.** The strengthened
  > `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` had two fixtures — a
  > **projected** `Changed` and a **projected** `Added` — so its loop verified
  > `ChangedContent::Projected` and `AddedContent::Projected` and **neither `Unreadable` arm**,
  > while the test that builds a `ChangedContent::Unreadable` asserts the Rust value and never
  > serializes it. *"The two nested content enums cross as one-key objects"* was therefore true of
  > half of each of them, and a unit-variant or Serde-shape regression on either `Unreadable` arm
  > would have kept this test green. **Round 5 closed it in code**: the test now enqueues a
  > non-UTF-8 `Changed` and a non-UTF-8 `Added` beside the four it had, and walks **both arms of
  > both** nested enums. D5 is about *every* wire enum, which is the reason the projected-only walk
  > was not enough rather than a preference for a longer list. §14.1's row 3 has the probe that was
  > watched failing.

  **Two round-3 test names are renamed for the same reason the type changed**, because a name is a
  sentence and both were claiming exactly what finding 1 refused:
  `an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot` →
  `…_names_that_path_where_the_workspace_cannot`, and
  `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` →
  `…_and_an_identity`. §12.1's rows and §12.4 name the old spellings and are left as written. The
  same word was corrected in three doc positions of the same shape: `ExternalObservation::Added`'s
  `document_summary`, which said the identity is what makes that arm *addressable* when the open
  workspace holds no addition by definition, and — in the core — `identity_of`'s *"hand its sidebar
  row an address"* and `identity_already_issued`'s *"does anything in this process address this
  file"*. Both core positions now say **identity** and **name**, and `identity_of` states in its own
  paragraph that an identity it mints is not an address in any particular `Workspace`.
- **`src-tauri/src/commands.rs`** — three reworded positions: both `drain_external_changes` docs
  (the *kept only until an overflow evicts it* wording, false in the other direction) and
  `WorkspaceSession::new`'s doc; plus the `observing` non-test comment.
- **`src-tauri/src/main.rs`** — two reworded positions in the module header: *"where what the gate
  admits stops being dropped"* and *"puts every admitted observation in it"*.
- **`crates/espansoconfig-core/src/workspace/mod.rs`** — `session_identities`'s comment, rewritten
  around the unbounded table it documents. **No code and no behaviour changed**, and
  `cargo tree -p espansoconfig-core | rg tauri` is still empty.
- **`src-tauri/src/dictionary_contract.rs`** — `ChangedContent` as a fourth namespace from
  `reconciliation.rs`, with its variant count; and `ObservedDocument`'s `NOT_A_CODE` reason, which
  said *both arms*.
- **`src-tauri/src/liveness_contract.rs`** — one new inventory entry, judged a **false positive**;
  §13.4 has the judgement and why it was filed rather than reworded.
- **`src/lib/i18n/{en,es}.json`** — two new keys each, `code.changedContent.projected` and
  `code.changedContent.unreadable`, EN and ES.
- **`docs/decisions/2d-4a-notes.md`** — two header sentences (the retention headline and the wake
  sentence beside it) and **nine** round-4 correction blocks (the header, §1, §2.1, §3.2, §3.3, R3,
  R9, and §12.4 twice), and this section.

No Svelte component changed and no TypeScript changed. The two dictionary files are data, and
`npm run check`, `npm test` and `npm run build` are unmoved by them. Q7 item 4's two prohibitions
hold — this step still draws nothing and still decides nothing about whether a write surface is open.

**Two more rows of §7's evidence table are now out of date**, said here rather than by editing it:
`present_bytes_that_are_not_utf8_cross_as_unreadable_rather_than_as_content` **no longer exists** and
`a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text` replaced it, because
the sentence its name asserted is the defect finding 2 closed; and
`a_changed_carries_its_exact_text_beside_the_projection_of_the_same_bytes` now reads its text and its
projection through `ChangedContent::Projected`. §12.2's three out-of-date rows are unchanged.

**What 2d-4b inherits from this round.** `ChangedContent` is two more dictionary keys with **no
accessor**, exactly as `AddedContent` is: `src/lib/i18n/codes.ts`'s `describe*` builders and the
variant counts in `src/lib/i18n/codes.test.ts:379` are 2d-4b's, and R1 covers both namespaces
identically. `ObservedDocument`'s third arm and `ExternalObservation::Changed`'s new shape are
2d-4b's TypeScript mirrors to declare, under R6's still-open note that no `wire_contract` table
compares them. `AWAITING_FRONTEND_DECLARATION` in `src-tauri/src/wire_contract.rs` is untouched and
is still 2d-4b's to delete.

### 13.3 The gates after this round

| Gate | Result |
|---|---|
| `pkill -f 'target/debug/deps/espansoconfig-'` | exit 0, run before the workspace suite |
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1308** passed, 0 failed, 26 result lines all `ok`, exit 0 (1307 before the round, **+1** — the one new test; the second new assertion set is a rename, so it moves no count) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; **73** `private_intra_doc_links` warnings, the pre-existing count |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 263 filtered out (was 262; +1), 68.74 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; the server oracle is absent and the client oracle matches twice |

The workspace suite was run once on a quiet host after the `pkill`, with nothing else running
concurrently. The three frontend numbers are unchanged rather than re-measured, for §7.1's reason:
this round's only frontend change is two keys in two JSON files, which adds no module, no
`svelte-check` file and no test.

### 13.4 What this round did not do, and where it is thin

- **Both new tests were watched failing before their fix**, by applying the inverse edit and
  restoring it, and the restored file was compared byte-for-byte against a copy taken before the
  probe. With `address_of` asking the register alone and offering its answer as the current address —
  round 3's rule, in the new arm names — `an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address`
  failed with `Addressable { document: DocumentId(0), relative_path: WirePath("match/a.yml") }`
  against an expected `Named { … }`, and
  `an_identity_this_queue_issued_addresses_that_path_where_the_workspace_cannot`,
  `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` and
  `a_first_sighting_of_a_file_that_is_not_text_still_carries_a_row_and_an_address` failed with it —
  four failures for one reverted rule. With the non-UTF-8 `Changed` routed back to
  `ExternalObservation::Unreadable`,
  `a_change_to_bytes_that_are_not_utf8_keeps_both_revisions_and_carries_no_text` failed on *"a change
  stays a Changed whether or not its bytes are text"*, printing the revision-less `Unreadable` value
  that is the finding itself. Findings 3, 4 and 5 have no test that can fail: two are false sentences
  over correct code, and the third is a code comment about an unmeasurable process-wide static.
- **`Addressable` versus `Named` is a claim about the *backend* workspace, and nothing here checks
  what the consumer actually holds.** `Named` covers two situations the queue cannot tell apart — a
  file added after the open, whose identity the consumer received from an `Added` of this epoch, and
  a path only a replaced workspace ever discovered, under which the consumer probably holds nothing.
  A consumer that treats the two alike will be wrong about one of them, and **this step cannot help
  it**: what the window holds is 2d-5's knowledge. The type says which arm; it does not say what to
  do about it, and no test in this repository can.
- **Nothing forces a consumer to read the arm at all.** `Named` and `Addressable` carry the same two
  operands, so 2d-4b's TypeScript can mirror them as one shape with a tag nobody matches on, and the
  round-4 defect would return in the frontend with every Rust gate green. The deliberate absence of a
  Rust accessor over the three arms is an argument, not an enforcement, and it stops at the boundary.
- **`address_of_minted`'s conservative arm is unreachable today and untested.** It answers `Named`
  when the open workspace resolves the path to a *different* number than the snapshot minted. One
  register makes that impossible, which is why the branch exists at all — the alternative was to
  assume the agreement — but no test drives it, because no test can produce the disagreement without
  a second register.

  > **Correction, round 5 (Low 1). That arm is gone, because calling it *conservative* was the
  > mistake.** It answered `ObservedDocument::Named`, whose own doc says **the open workspace does
  > not hold the path** — and in that branch the workspace had just resolved it, so the arm was false
  > of the value it carried. A branch is not conservative when the answer it gives is untrue; it is a
  > second defect wearing the first one's clothes. `address_of_minted` now matches `Some(resolved)`
  > and answers `Addressable { document: resolved, … }`, which is exactly that arm's claim and is
  > true whatever number `resolved` is, with the agreement carried by a `debug_assert_eq!`; `Named`
  > is reserved for `None`. The rest of this bullet still holds: **nothing in this repository can
  > reach the disagreement**, so this is still untested and the assertion still cannot fire in any
  > test. §14.1's row 2 has the reasoning and the panic decision.

  > **Correction, round 6 (Low 1). *"Carried by a `debug_assert_eq!`"* is no longer the policy**, and
  > the reason is that a debug-only assertion is not one: in a release build it disappears and the
  > function answers `Addressable` with the **workspace's** number while the same object's projection
  > carries the **snapshot's** in `DocumentView::id` and in every `MatchId` beneath it. The agreement
  > is now an `assert_eq!` that holds on every profile. §15.1's L1 row is the record, including why no
  > arm of `ObservedDocument` is true in that case and what a panic inside a command costs.
- **The `ChangedContent` split is a wire change with no consumer**, exactly as `AddedContent` was one
  round ago. Nothing in this repository reads `previous_revision` or `disk_revision` off an
  unreadable change; what the round closed is that the two numbers now *exist* on the wire. Whether
  they are the two a consumer needs is 2d-5's to find out, and if they are not, this is the third
  round in which R3 was declared closed.
- **Finding 3 was closed by a sweep for the shape, and the sweep is still a human reading.** The four
  positions this round found beyond the two the review cited were found by searching for what the
  claim now *is* rather than for the words of the finding — but nothing mechanical checks that the
  retention boundary is stated identically everywhere, the way `liveness_contract.rs` checks the
  liveness family. A seventh position written tomorrow would be invisible.
- **The liveness sweep fired on this round's prose too, for the third round running.**
  `address_of_minted`'s *"The workspace **must answer** with the same number"* matched `must answer`.
  It was judged a **false positive** — it is an assertion about two identity sources agreeing about a
  number, not about whether a path is ever looked at again — and, unlike round 3's, it was **filed in
  the inventory rather than reworded**, precisely because a rewording leaves no trace anywhere else
  and this is the sentence that says what the function refuses to assume. The inventory entry names
  the function and the reason.
- **The core register is still unbounded**, and this round only stopped the code from saying
  otherwise. No count exists, no cap exists, no eviction rule exists, and no step of the 2d split
  owns building one: 2d-7 could measure it and 2d-5 holds the knowledge a bound would need. Judged
  against this project's precedent — seven Phase 2d-3 items recorded as bounded residues and later
  found to be real defects — an honest downgrade is the least this could have been, and it is exactly
  what it is: **a residue, restated more accurately, not a fix.**
- **Nothing here observes a real filesystem**, unchanged from rounds 1, 2 and 3, except that
  `an_identity_minted_under_a_replaced_workspace_is_named_and_is_not_an_address` builds two real
  `Workspace` values over a temporary tree and removes a file between them. `crate::watch_check`
  remains where real-filesystem evidence lives and gained nothing this round.
- **R8 is unchanged, and this section is an instance of it.** Round 1's fix wrote three of round 2's
  findings, round 2's fix wrote at least one of round 3's, and round 3's fix wrote **four of round
  4's five**. There is no reason to think this round wrote none.

## 14. Round 5 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 5 verbatim: **NOT READY — 0 High, 1 Medium, 3 Low**,
against gates that were green again. Its scope was **the round-4 fix**, not the original
implementation and not rounds 1–3's, and it was commissioned under the rule that commissioned rounds
2, 3 and 4: a fix is a change, and the round that reviews it is not optional. Round 4's own lesson
was carried into the brief — *a replacement test can assert the shape of an answer instead of the
property the test it replaced was holding* — so round 5 was asked whether the round-4 fix's own two
tests assert properties or shapes, and what its own new code and its own new sentences rest on.

**Three of the four findings are the round-4 fix's own code or its own sentences.**

- **The Medium is the third consecutive round in which the retention boundary was restated and was
  still false**, and this time it is false in a direction none of rounds 2, 3 or 4 looked in. Each of
  those rounds counted the ways a stored entry leaves the queue *by its own properties* — being
  acknowledged, being the eviction policy's victim — and none of them counted the one that depends on
  nothing about the entry at all: a workspace replacement calls `ReconciliationQueue::begin_epoch`,
  which assigns a fresh `QueueState` and discards the pending set, the watermark and the loss count
  together. Round 4's sweep found four positions round 3 had missed and was, in this direction, no
  more complete than round 3's.
- **Low 3 is §13.2 overstating its own test.** Round 4 strengthened
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` to walk the two nested
  content enums, wrote that it now covers them, and gave it two **projected** fixtures — so it
  covered `ChangedContent::Projected` and `AddedContent::Projected` and neither `Unreadable` arm.
- **Low 1 is round 4's own new helper modelling an invariant violation as a value whose documented
  meaning is false.** `address_of_minted` branched on the open workspace resolving a path to a
  *different* number than the snapshot minted and answered `ObservedDocument::Named` for it — an arm
  whose own doc says the open workspace does not hold the path, in a branch reached only when it
  demonstrably does. §13.4 called that arm *conservative*; a branch is not conservative when the
  answer it gives is untrue.

Only **Low 2** is not round 4's: it is R9, the core identity register's unbounded retention, which
round 4 corrected the **reassurance** of without correcting the **bound**, because there is none.

**One code defect, one no-change verdict and two false claims — and the code defect's fix found a
second defect the review did not.** The `debug_assert_eq!` Low 1 asked for fired on its first full
run of the workspace suite, on a `crate::commands` test fixture that built a projection through
`DocumentContext::detached(DocumentId(1), "x.yml")` — a snapshot claiming an identity the register
never issued for the path the observation named. So the branch round 5 said *"cannot be reproduced on
this tree"* **was reproduced**, by a test, and the shipped code's answer for it was exactly the false
`Named` the finding describes: `Named { document: 1 }` for a path the open workspace resolved to 157.
The fixture now mints through `espansoconfig_core::workspace::identity_of`, which is what
`crate::reconciliation`'s own `snapshot` helper had already been doing, and for the reason its doc
comment already gave.

**Nothing here was closed by weakening a guarantee.** The retention boundary gained a clause it
always kept; `Named`'s doc is untouched and is the reason the branch that contradicted it was
deleted; the wire test gained coverage; and R9 was neither narrowed nor declared closed.

### 14.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| M1 | Medium | *"A stored entry leaves this queue in exactly two ways"* omits a third: `ReconciliationQueue::begin_epoch` replaces the whole `QueueState` when the session adopts a replacement workspace, discarding every pending entry, the watermark and the loss count. Epoch 1 stores sequence 1; no drain acknowledges it and capacity is not exceeded; a successful open allocates epoch 2 and the entry is gone. Every position stated the two-way boundary — the module doc's guarantee 4, `external_observation`, both `commands.rs` docs and this record's header — and §13.1 claimed every position now carried the true one | **Words.** The boundary now has three clauses everywhere: an admitted observation is **stored** unless it is one of the two arrivals no later drain could return, and a **stored** entry leaves in exactly three ways — a later drain acknowledges it, an overflow evicts it, or the queue adopts a replacement epoch and discards everything the previous one held. **The third is counted in no `discarded`**, because the open that causes it has already replaced the authoritative workspace and the batch's own epoch is what makes the discarded history stale. The idempotence sentences gained the matching second condition — *and no replacement epoch was adopted between them*. The header's, §2.1's and R10's round-5 corrections; §14.2 lists the positions | **None for the words, and no code changed.** No test can fail a false comment. `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` is the behaviour the third clause describes and it already asserted the pending set and the loss count; this round **strengthened** it — every assertion gained the sentence it is making, and the **watermark** half is new, which nothing had asserted. That half was watched failing: with `begin_epoch` carrying the acknowledged watermark across the replacement it failed on *"a replacement resets the watermark with everything else"*, `left: []` against a one-entry list holding the successor epoch's sequence 3 and its text, the batch printing `discarded: 1` |
| L1 | Low | `address_of_minted` contemplated `workspace.document_id(path) == Some(other)` and answered `ObservedDocument::Named { document }`, whose doc claims **the open workspace does not hold the path** — false in exactly that branch. Modelling an invariant violation as a well-formed wire value converts a broken invariant into misleading data rather than into a failure | **Code.** It now matches `Some(resolved)` separately and answers `Addressable { document: resolved, … }`, which is that arm's own claim — *the open workspace resolves this path to this identity* — and is therefore true of `resolved` whatever number it is; `Named` is reserved for `None`, where it is equally true. The agreement of the two identity sources is a **`debug_assert_eq!`** rather than a branch, so a second register introduced later breaks a debug build at the site instead of putting an unstatable number on the wire. `Named`'s doc was **not** weakened to make the old branch true | **None, and none is possible on the shipped tree.** With the fixture below repaired, one register makes `resolved == document` for every reachable pair, so both the old and the new code answer `Addressable`; and a test driving the disagreement could only assert a `debug_assert_eq!`, which a release build compiles out, so it would pass and fail by profile. What *did* fail is the workspace suite itself: `the_drain_hands_back_what_the_queue_holds_above_the_watermark` panicked with `left: DocumentId(157)`, `right: DocumentId(1)` on the fabricating fixture, which is the branch reproduced |
| L2 | Low | R9 is an actual unbounded-retention residue and round 4 corrected the reassurance, not the bound. The core retains every distinct `PathBuf` it has ever named for the process lifetime, fed by `Workspace::from_tree` and by `watch::engine`, while the queue is capped at 256; documentation and an assignment to 2d-5 or 2d-7 are not a bound | **No code change, and the verdict recorded.** R9 **remains an open Low** until it is measured and then either bounded safely or accepted with evidence. R9's round-5 correction says so in its own entry, and says that the round-4 block's opening word — *"Closed"* — is what a reader finds first and is what the correction corrects. Judged against this project's precedent: seven Phase 2d-3 items recorded as bounded residues were later found to be real defects, and two of this phase's five rounds found a defect in something recorded under R3 as one | **None, and none is possible.** The register is a process-wide static shared by every test in the binary, so a count read from a test is not a function of that test. That is also why no round has measured it |
| L3 | Low | The uniform-wire test's two fixtures were a **projected** `Changed` and a **projected** `Added`, so its loop verified `ChangedContent::Projected` and `AddedContent::Projected` and neither `Unreadable` arm; the non-UTF-8 change test asserts the Rust `ChangedContent::Unreadable` value and never serializes it. A unit-variant or Serde-shape regression on either unreadable arm kept the test green, and §13.2 described it as covering the nested enums | **Code, and words.** The test now enqueues a non-UTF-8 `Changed` and a non-UTF-8 `Added` beside the four it had — six observations — and walks **both arms of both** nested content enums, by explicit index rather than by position. Both walks this round wrote look the tag up with `get` rather than with an index, so a missing tag fails with the test's own sentence instead of inside `serde_json`; the pre-existing walk over the six observation kinds is left as it was. §13.2's round-5 correction is the sentence. **Swept one level down as well**: `UnreadableReason` is a wire enum too, and nothing walked it — the three reasons this batch puts on the wire are now checked for the same one-key-object rule | `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor`, watched failing three ways. `#[serde(untagged)]` on `ChangedContent::Unreadable`: *"Changed's Unreadable content is tagged by its variant name and carries an object, never a bare string"*, the printed batch showing `"content":{"reason":{"NotUtf8":{"offset":0}}}` with the tag gone. The same on `AddedContent::Unreadable` alone: the identical sentence for `Added's Unreadable`. And `#[serde(rename = "NotText")]` on `UnreadableReason::NotUtf8`: *"the NotUtf8 reason is tagged by its variant name and carries an object, never a bare string"* |

### 14.2 What this round changed, by file

- **`src-tauri/src/reconciliation.rs`** — `address_of_minted` changed behaviour and its doc with it
  (L1). Everything else is words and tests. The **retention boundary** is restated in three clauses
  at every position the sweep found: the module doc's guarantee 3 (a folded entry's slot) and
  guarantee 4 (the canonical paragraph, which also now says why the case that would be a *fourth* way
  cannot arise), `ReconciliationBatch::discarded`, `QueueState::discarded`,
  `ReconciliationQueue::begin_epoch` — which is the third clause and now names itself as such —
  `ReconciliationQueue::drain`, `external_observation`, and one test comment in
  `a_repeat_of_one_paths_state_coalesces_onto_the_newer_sequence`.
  `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` is **strengthened**, and the
  comment in `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` now says
  that test exercises the emptying rather than asserting it, and where the assertion lives.
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` gained two fixtures and two
  walks (L3). **No test was added or renamed**, so the suite's count is unmoved.
- **`src-tauri/src/commands.rs`** — both `drain_external_changes` docs and the
  `WorkspaceSession::reconciliation` field doc carry the three-clause boundary; the comment in
  `WorkspaceSession::open` beside the `begin_epoch` call names it as the third way. **One test
  fixture changed**: `the_drain_hands_back_what_the_queue_holds_above_the_watermark` mints its
  projection's identity through `espansoconfig_core::workspace::identity_of` instead of a literal
  `DocumentId(1)`, with a comment saying why and what found it.
- **`src-tauri/src/liveness_contract.rs`** — one inventory entry's `reason`, which described
  `address_of_minted`'s *must answer* sentence as an assertion the types do not force; it now says
  the round turned it into a `debug_assert_eq!`. The phrase count is unchanged at 1.
- **`docs/decisions/2d-4a-notes.md`** — **six** round-5 correction blocks (the header, §2.1, R9, R10,
  §13.2 and §13.4's `address_of_minted` bullet) and this section.

> **Correction, round 6 (Low 5). This list is not file-by-file: the round-5 commit touched *five*
> files and this section names four.** The one it omits is
> **`docs/reviews/phase-2d-4a-queue.md`**, where round 5's 65-line verbatim record was added — the
> file that is the review's own work list, and the one a later round reads first. Nothing else about
> the list is wrong.
>
> **It is the same habit Phase 2d-3's round 12 found**, and §14.2 inherited it: a *what changed by
> file* section written from the code the round was thinking about, with the record files it also
> wrote left off. It matters exactly because this section is what a later round diffs against — L5
> was found by comparing this list to `git show --stat`, which is the check the section exists to
> make unnecessary. §15.2 lists every file this round touched, the review queue and this record
> included.
>
> **Two sentences of this section also describe a shipped state that has changed**, and are corrected
> rather than edited: the `liveness_contract.rs` bullet above says the round *"turned it into a
> `debug_assert_eq!`"*, and §14.1's L1 row says *"the agreement of the two identity sources is a
> **`debug_assert_eq!`**"*. Round 6 made it an `assert_eq!` on every profile; §15.1's L1 row is why.
> The phrase count in the inventory is still 1 and the phrase is still `must answer`.

**`crates/espansoconfig-core` is untouched**, which is L2's whole content: `cargo tree -p
espansoconfig-core | rg tauri` is still empty and no core file changed. **No Svelte component, no
TypeScript and no i18n key changed** — this step still draws nothing and still decides nothing about
whether a write surface is open (Q7 item 4). The three frontend gates were measured all the same.

**One position was reworded rather than filed**, and it is recorded here because a rewording leaves
no trace anywhere else: `address_of_minted`'s new doc first read *"Each arm **is answered** because
it is true of the value it carries"*, and `is answered` is in `LIVENESS_SHAPES`, so
`every_liveness_claim_is_judged` failed on it. It is a plain false positive — the sentence is about
which arm a function returns, not about whether a path is ever observed again — and *chosen* says the
same thing, so it was reworded. Round 4's own liveness hit at the same function is still filed rather
than reworded, for the reason §13.4 gives.

### 14.3 The gates after this round

| Gate | Result |
|---|---|
| `pkill -f 'target/debug/deps/espansoconfig-'` | run before the workspace suite |
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1308** passed, 0 failed, **26** result lines all `ok`, exit 0 — unchanged, since this round added and renamed no test |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; **73** `private_intra_doc_links` warnings, the pre-existing count |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, 263 filtered out, 77.89 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; the server oracle absent, the client oracle present with 2 matches |

The workspace suite was run once on a quiet host after the `pkill`, with nothing else running
concurrently. The frontend numbers were re-measured rather than carried forward, and no frontend file
changed.

### 14.4 What this round did not do, and where it is thin

- **The retention sweep is still a human reading, and this is the second round in a row to say so
  after the previous one's sweep proved incomplete.** Nothing mechanical checks that the boundary is
  stated identically everywhere, the way `liveness_contract.rs` checks the liveness family. What this
  round searched was the *shape* — any sentence stating how or how long an admitted or stored
  observation is retained — over `src-tauri/src/`, `crates/espansoconfig-core/src/` and this file,
  including test names, test comments and assertion messages, and each hit was read for falsity in
  **both** directions. A ninth position written tomorrow is still invisible, and **claiming the sweep
  is now complete is exactly what rounds 3 and 4 claimed and were wrong about**, so it is not claimed
  here.
- **"Exactly three ways" rests on a reading, not on a test.** It is true because `QueueState::pending`
  is mutated in exactly four places — `insert` and `remove` in `enqueue`, `retain` in `drain`, and the
  whole-state assignment in `begin_epoch` — which was established by reading every mutation of that
  field, not by anything that fails when a fifth appears. The one case the types allow and the
  allocator forbids, two observations at one sequence, is named at `enqueue` and pointed at from
  guarantee 4.
- **L1 introduces a `debug_assert_eq!` on a path a Tauri command reaches**, and that is a deliberate
  trade rather than an oversight. In a release build it is compiled out and the answer is
  `Addressable { document: resolved, … }`, which is true of what it carries. In a **debug** build a
  disagreement between the open workspace and a snapshot's identity panics inside a command. That is
  wanted: through the production pipeline the two cannot disagree, because `watch::engine` mints
  through `identity_of` and so does `Workspace::from_tree`, so a disagreement means a caller
  fabricated an identity — which is precisely what the assertion caught within one run. The
  alternative, answering something and continuing, is what the finding is about.
- **The release-build behaviour of that branch is asserted by nothing.** If a second identity source
  ever exists, a release build will cross `Addressable` carrying the **workspace's** number while the
  consumer's projection arrived under the snapshot's, and no test in this repository says what a
  consumer should do about that. The arm is true of the value it carries; that is all it is.
- **A test fixture was changed to make an assertion pass, which is the shape of fixing the test
  instead of the code**, and it is said plainly here rather than left to be noticed. The reason it is
  not that: the fixture fabricated a `DocumentId` the register never issued for the path its own
  observation named, so the wire value it produced was false about the workspace whichever way
  `address_of_minted` answered — the old code called that path *not held by the open workspace* while
  the workspace held it. `crate::reconciliation`'s `snapshot` helper carries a doc comment saying a
  helper that invents a number turns identity assertions into tests of the helper; this fixture was
  the counterexample to that comment, one crate module away, and nothing had noticed.
- **R9 is open, unmeasured and unbounded.** No count exists, no cap exists, no eviction rule exists,
  and no step of the 2d split owns building one. This round changed nothing about it and recorded the
  verdict; that is the least a round can do with a residue, and this project's precedent says
  residues recorded and left are where defects are later found.
- **`UnreadableReason` is now walked for three of its six variants.** `NotUtf8` and `PermissionDenied`
  cross in the uniform-wire test's fixtures and `Other` is asserted as a Rust value elsewhere;
  `InvalidData`, `TimedOut` and `Interrupted` are serialized by nothing. A seventh variant added
  tomorrow is covered by nothing here either. The rule the walk checks is uniform across the enum,
  which is the argument for not enumerating all six — and it is an argument, not a check.
- **Nothing in the boundary is enforced against `crate::commands`.** Both `drain_external_changes`
  docs now state the three clauses, and nothing fails if a future edit puts them back to two: the
  wording lives in two source files and this record, and is kept identical by a reader.
- **Nothing here observes a real filesystem**, unchanged from rounds 1 through 4. `crate::watch_check`
  gained nothing this round and is still where real-filesystem evidence lives.
- **The TypeScript half is still 2d-4b's**, and R6's note stands: no `wire_contract` table compares
  `ObservedDocument` or either content enum against a frontend declaration, so a mirror that flattens
  the three address arms or the two content arms would compile with every Rust gate green. This round
  strengthened the **Rust** wire assertions, which is the half that can be strengthened here.
- **R8 is unchanged, and this section is an instance of it.** Round 1's fix wrote three of round 2's
  findings, round 2's wrote at least one of round 3's, round 3's wrote four of round 4's five, and
  round 4's wrote three of round 5's four. There is no reason to think this round wrote none — and
  the most likely place is the sentence directly above the one a future round quotes: this round
  rewrote twelve retention positions and one helper, and every previous round that rewrote a
  retention position left a narrower instance of the same claim standing somewhere else.

> **Correction, round 6. Four of round 6's six findings are in gaps this section named, and naming a
> gap is not covering it.** Three bullets above are superseded and the last one predicted the fourth
> finding:
>
> - ***"`UnreadableReason` is now walked for three of its six variants"*** — round 6 (Low 2) refused
>   the uniformity argument that stood in its place, in the same words round 5 used to refuse the
>   arguments rounds 3 and 4 made about sweeps. The walk covers **all six** arms now, driven through
>   the queue as four more read failures, and `wire_tag`'s exhaustive `match` makes a seventh variant
>   a compile error in that test. §15.1's L2 row says exactly what that guard does and does not force.
> - ***"The release-build behaviour of that branch is asserted by nothing"*** — round 6 (Low 1) is
>   that bullet read as a finding rather than as a residue. The behaviour it describes is worse than
>   *unasserted*: `Addressable` carrying the workspace's number crosses **beside** a projection
>   addressed by the snapshot's, which is one object with two identities for one file. It is now an
>   `assert_eq!` on every profile.
> - ***"L1 introduces a `debug_assert_eq!` on a path a Tauri command reaches … that is a deliberate
>   trade"*** — the trade is unchanged in kind and is now taken in release too. What §15.1's L1 row
>   adds is why no wire value was available instead, and why this is not a panic on input.
> - ***"The most likely place is the sentence directly above the one a future round quotes"*** — the
>   Medium is exactly that: round 5 rewrote the retention boundary and left the **watermark**, one
>   level above it, claiming a process-lifetime property. §2.1's round-6 correction is the fix.

---

## 15. Round 6 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 6 verbatim: **NOT READY — 0 High, 1 Medium, 5 Low**,
against gates that were green again. Its scope was **the round-5 fix**, and it was commissioned under
the rule that commissioned rounds 2, 3, 4 and 5: a fix is a change, and the round that reviews it is
not optional. Round 5's own lesson was carried into the brief — *every round so far counted the ways
a stored entry leaves the queue by the entry's own properties, and none counted the one that depends
on nothing about the entry at all* — so round 6 was asked what **else** in this step is described by a
rule written from the thing's own properties and made false by a whole-state replacement.

**It cleared the twelve retention positions and found the same shape one level above, on the
watermark.** That is the Medium, and it is the single most useful thing this round did: round 5
rewrote the retention boundary and left `newest_sequence` — the number a consumer *stores* — claiming
a property of the **process** rather than of the epoch. Four public positions and this record said it
never falls below the highest watermark this queue or session has *ever* been drained with, and may
be stored *unconditionally*. `begin_epoch` resets `acknowledged` to zero with everything else.

**Four of the six findings live in gaps §14.4 named itself.** §14.4 conceded that the
`UnreadableReason` walk covered three of six variants and substituted a uniformity argument for
coverage (L2); that the release behaviour of `address_of_minted`'s asserted branch was asserted by
nothing (L1); that R9 was open, unmeasured and unbounded (L4); and that *the most likely place is the
sentence directly above the one a future round quotes* (the Medium). **Naming a gap is not covering
it**, and this round closed three of the four with code and recorded the fourth as the open Low it is.

**Two findings are the record claiming what the code does not give** — this project's declared worst
defect class. R10's round-3 closure said a repeat stream *can only displace its own document's older
entries*; the tie rule says otherwise (L3). And §14.2's *what changed by file* listed four files where
the commit touched five, omitting the review queue itself (L5) — the same habit Phase 2d-3's round 12
found.

**Nothing here was closed by weakening a guarantee.** The watermark claim is unchanged in strength
within an epoch and now says which scope it holds in; the identity invariant was made **stronger**,
not weaker, by holding in every build profile; the wire walk gained coverage; R9 was neither narrowed
nor declared closed; and R10's implemented guarantee — *a path with one pending entry is never the
victim while another path has two* — is exactly what it was, with the record corrected down to it.

### 15.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| M1 | Medium | `ReconciliationBatch::newest_sequence` was documented as never falling below the highest watermark this **queue** — or, in `commands.rs`, this **session** — had *ever* been drained with, and therefore storable *unconditionally*. `begin_epoch` assigns a fresh `QueueState` with `acknowledged == 0`, so: epoch 1 drains with watermark 9; `begin_epoch(2)`; `drain(0)` on the empty successor answers `newest_sequence == 0`. Four public positions said it and §2.1 said it twice more. The **code is right** — sequences and watermarks are epoch-scoped, and a sequence means nothing across two epochs — so this is the retention finding's shape one level up, on the number a consumer actually stores | **Words, and one test strengthened.** Every position now carries the same scoped claim: **within the epoch the batch names**, `newest_sequence` never falls below the highest watermark this queue has been drained with under that epoch, so a caller showing that epoch stores it unconditionally, out-of-order drains included; **across a replacement epoch it falls**, which is not a walk-back, and `ReconciliationBatch::epoch` is what separates the two numbers. §2.1's round-6 correction is the record's own instance, and it also corrects §10.2's summary of round 1. §15.2 lists nine source positions — the review named four | **None for the words**, as always: no test can fail a false comment. **The behaviour the corrected sentence describes is now asserted**, which the false one never was: `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` gained epoch 2's watermark of 9 and the successor's `newest_sequence == 3` beside `epoch == 3`. Watched failing with a process-lifetime high-water mark spliced into `drain` — the false sentence implemented — at `left: 9`, `right: 3` |
| L1 | Low | A `debug_assert_eq!` is not an invariant-failure policy: in a release build it disappears and `address_of_minted` answers `Addressable` with the **workspace's** identity while the same observation's `ChangedContent::Projected` carries the **snapshot's** in `DocumentView::id` and in every `MatchId` beneath it — **one `Changed` object with two document identities for one file**, not merely an arm that is locally true. The accompanying prose was self-contradictory too: it said there was *"no second source to depend on agreeing"* and then required agreement, and claimed a path *"has one number in both or is in neither"*, which is false for a file created after the open — in the register, not in the workspace | **Code, and words.** The agreement is an `assert_eq!` and holds on **every profile**: a disagreement is a failure, never a wire value. That is forced rather than chosen, because **no arm is true** in that case — `Named` claims the workspace does not hold a path it holds (round 5's finding), and `Addressable` with either number is false about one half of the object. The doc now says the two sources differ in **membership** and may not differ in **number where both hold the path**, and states what the trade costs: a panic inside a command on any profile, **not a panic on input** — no file's bytes, no filesystem state and no user action reaches it, only a second identity source added to this process's code. `crate::commands`'s poison policy is why the two mutexes it holds are not a second failure. §3.3's and §13.4's round-6 corrections; `ExternalObservation::Changed::document` and `external_observation` carried the same denial and were corrected with it | **`a_snapshot_identity_the_open_workspace_contradicts_is_a_failure_and_never_a_wire_value`** — new, and the one round 5 correctly said was impossible against a `debug_assert_eq!`, since that test would have measured the **profile**. Watched failing in a **release** test run with the assertion put back to `debug_assert_eq!`: *"test did not panic as expected"*. It passes in both profiles with the fix, which is the whole claim |
| L2 | Low | `UnreadableReason` has six variants; the serialization walk exercised `PermissionDenied` and `NotUtf8` — **with `NotUtf8` duplicated** — while `Other` was checked only as a Rust value and `InvalidData`, `TimedOut` and `Interrupted` were serialized by nothing. A coherent change of `InvalidData {}` to a unit variant would cross as a bare string with the test green. §14.4 conceded the gap and substituted *the rule is uniform across the enum* for coverage — the same shape of argument round 5 refused one level above | **Code: coverage, not a better argument.** `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` admits four more read failures — `InvalidData`, `TimedOut`, `Interrupted` and, through the wildcard, `Other` — each on a path of its own so the fold cannot coalesce them, and the reason walk now covers **all six arms**. A `wire_tag` helper matches the enum **exhaustively**, so a seventh variant is a compile error in that test; the comment says plainly that this forces a *decision* and not a fixture, and that keeping `EVERY_REASON` in step is still a reader's job | The same test, watched failing with `InvalidData {}` turned into a unit variant: *"a reason crosses as an object"*, the printed batch showing `"reason":"InvalidData"` as a bare string beside `{"TimedOut":{}}` and `{"Interrupted":{}}`. That is exactly the regression the finding names, and it was green before this round |
| L3 | Low | R10's round-3 correction claims a repeat stream *"can only displace its own document's older entries"* and that *"what it no longer carries is that the capacity it consumes is another document's"*. `evictable_sequence` breaks a tie between equally busy paths by **the lower of their lowest sequences**, so at capacity 256: B holds 1 and 2; 253 singletons hold 3–255; A holds 256; A's identical repeat arrives at 257 — A and B hold two each, the tie picks B's sequence 1, and A's repeat evicts **another document's** entry | **Words, and the claim narrowed to what the code gives.** R10's round-6 correction states the implemented guarantee — **a path with one pending entry is never the victim while another path has two** — and says the tie case plainly. `QUEUE_CAPACITY`'s doc and `evictable_sequence`'s doc already stated only the narrow rule and needed no change; **only the record over-claimed**, which is why this is a record correction and not a policy change. R10 stays a bounded residue, bounded by the narrow rule | **None, and none is wanted.** No test can fail a false sentence in a decision record, and the behaviour is already pinned: `a_stream_of_repeats_for_one_document_never_evicts_another_documents_only_state` holds the narrow guarantee and `a_full_queue_retains_the_same_entries_whatever_order_they_arrive_in` holds the order-independence. A test for the tie case would pin a consequence of the tie-break rule that the rule's own doc already states, and this round did not add one — §15.4 carries that as thin |
| L4 | Low | R9 is a real, known-open defect and not a bounded residue. `SessionIdentities::by_path` retains every path for the process lifetime; every first `identity_of` inserts and nothing removes. Create, stabilize and remove distinct watched paths while draining: the queue stays capped at 256 while the register retains all of them | **No code change, and the verdict recorded** — which is what the finding asked for. R9's round-6 block re-derives the retention from the code rather than accepting round 5's verdict, and says why writing it down is not a closure: a bound needs a rule for when an identity may be forgotten, which needs to know no consumer still holds it — 2d-5's knowledge — and a measurement first means something in 2d-7. **R9 is an open Low with one more round of evidence that it is real** | **None, and none is possible.** The register is a process-wide static shared by every test in the binary, so a count read from a test is not a function of that test. That is unchanged from round 5 and is why no round has measured it |
| L5 | Low | §14.2 is not file-by-file: it lists four files where commit `eced554` touched five, omitting `docs/reviews/phase-2d-4a-queue.md`, where round 5's 65-line verbatim record was added | **Words.** §14.2 carries a round-6 correction naming the omitted file and naming the habit — the same one Phase 2d-3's round 12 found — and saying why it matters: this section is what a later round diffs against, and L5 was found by comparing it to `git show --stat`, which is the check the section exists to make unnecessary. §15.2 below lists **every** file this round touches, the review queue and this record included | **None.** No test reads a decision record's file list. The only check is a reader comparing it against the commit, which is what round 6 did |

> **Correction, round 7 (Low 1). The L1 row's *"because **no arm is true** in that case"* is the
> wrong half of the pair, and it is the half three positions of this file repeat.** The arm
> `address_of_minted` would answer without the assertion is `Addressable { document: resolved }`,
> and `Addressable`'s claim is *the open workspace resolves this path to this identity* — which is
> true of `resolved`, since `resolved` is what `workspace.document_id(path)` just answered. **What is
> false is the observation built around it**, whose `ChangedContent::Projected` carries the
> snapshot's identity in `DocumentView::id` and in every `MatchId` beneath it. So the accurate
> sentence is the one `address_of_minted`'s own doc has carried since round 6 — *the arm was locally
> true and the object held two identities for one file* — and the accurate general form is **no arm
> makes the object honest**, not *no arm is true*.
>
> Nothing about the policy changes: the assertion is still forced rather than chosen, because a
> locally true arm inside a dishonest object is not a wire value anybody can act on. §14.4's third
> bullet already said the true thing — *"the arm is true of the value it carries; that is all it
> is"* — so this file held its own refutation while three positions said the opposite.
>
> **The three positions, derived by grepping this file and both source trees for the shape rather
> than for the round-7 review's wording:** the L1 row above; §3.3's round-6 correction block
> (*"There is no arm that is true in that case"*); and §15.4's second bullet (*"there is no true arm
> of `ObservedDocument` for the disagreement"*). **The review named one of the three** — it named the
> source position, `reconciliation.rs`'s new `#[should_panic]` test comment, which the fix round
> corrected — **and of the record positions it named only the L1 row.** All four are corrected: the
> source one in place, the three here by this block.

### 15.2 What this round changed, by file

**Six files, and the last one is the one §14.2 forgot to count.**

- **`src-tauri/src/reconciliation.rs`** — `address_of_minted`'s assertion changed from
  `debug_assert_eq!` to `assert_eq!` and its whole doc with it (L1); `ExternalObservation::Changed`'s
  `document` field doc and `external_observation`'s *three ways to an address* paragraph carried the
  same *never depends on the two identity sources agreeing* denial and were corrected with it. **M1's
  wording** at five positions: `ReconciliationBatch::newest_sequence` (the canonical statement),
  `ReconciliationQueue::drain`'s doc, the comment over the `max` inside `drain`, the test comment in
  `an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument`, and the assertion
  message in `an_empty_batch_answers_the_watermark_it_was_asked_with`.
  `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` gained two assertions (M1);
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor` gained four fixtures, the
  three-loop walk grew to ten observations and six reasons, and `wire_tag`/`EVERY_REASON` are new
  inside it (L2). **One test is new**:
  `a_snapshot_identity_the_open_workspace_contradicts_is_a_failure_and_never_a_wire_value` (L1), which
  is the whole of the suite's `+1`.
- **`src-tauri/src/commands.rs`** — M1's wording at two positions:
  `WorkspaceSession::drain_external_changes` and the `drain_external_changes` command's own doc. The
  fixture comment in `the_drain_hands_back_what_the_queue_holds_above_the_watermark` names the
  assertion by what it now is rather than as a `debug_assert_eq!`. **No behaviour changed here.**
- **`src-tauri/src/dispatch_check.rs`** — M1's wording at two positions the review did not name: the
  doc of `drain_external_changes_is_reachable_and_its_watermark_deserializes`, which told a caller to
  store `newest_sequence` unconditionally with no scope, and its own assertion message. **No
  behaviour changed here.**
- **`src-tauri/src/liveness_contract.rs`** — one inventory entry's `reason`, which described the
  `address_of_minted` agreement as a `debug_assert_eq!`. The phrase count is unchanged at 1, and the
  phrase is still `must answer`.
- **`docs/decisions/2d-4a-notes.md`** — **six** round-6 correction blocks (§2.1, §3.3's round-4
  block, R9, R10, §13.4's round-5 block and §14.2) plus one at the end of §14.4 covering the three
  bullets round 6 turned into findings, and this section.
- **`docs/reviews/phase-2d-4a-queue.md`** — round 6's verbatim record, which is what L5 is about:
  the review queue is a file the round changes and §14.2 left it off the list.

**`PROGRESS.md` is the orchestrator's** and is written in its own commit, as every round of this step
has been. **`crates/espansoconfig-core` is untouched**: `cargo tree -p espansoconfig-core | rg tauri`
is still empty and no core file changed. **No Svelte component, no TypeScript and no i18n key
changed** — this step still draws nothing and still decides nothing about whether a write surface is
open (Q7 item 4). The three frontend gates were measured all the same, and none of them moved.

> **Correction, round 7 (Low 2). *"§15.2 lists nine source positions"* — and the M1 bullet's
> *"a words fix over nine source positions"* in §15.4 — undercounts the epoch-scoped watermark claim,
> and §15.4 sends the next round to that list, so the undercount propagates.**
>
> **Fourteen positions of the claim stood in `src-tauri/src/` when this section was written**,
> counted by this section's own convention, in which a doc paragraph, an inline comment block and an
> assertion message each count as one. The nine listed above, plus **five** in
> `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` that the paragraph above
> files under *gained two assertions* instead:
>
> - the comment beginning *"The same clause from the other side"* — the watermark going with the
>   pending set (`eced554`, round 5's fix, not round 6's);
> - the assertion message *"epoch 2's watermark, which the replacement below is about to discard"*
>   (`6be7231`, round 6);
> - the assertion message *"a replacement resets the watermark with everything else"* (`eced554`,
>   round 5);
> - the comment beginning *"**`newest_sequence` falls across a replacement**"* (`6be7231`, round 6);
> - the assertion message *"the successor epoch answers its own sequences, below the epoch before
>   it"* (`6be7231`, round 6).
>
> **Where this correction disagrees with the round-7 review**, which raised the finding: it said *"at
> least eleven"* and named two of the five, both as prose blocks the round-6 fix *gained*. Derived
> from `git log -S` on each string: the omissions are **five**, not two; **three** of the five are
> round 6's and **two are round 5's**, so one of the two the review named was already in the tree
> when §15.2 was written. Every one of the five is **correct prose** — the defect is the count, in a
> section a later round is sent to read.
>
> **The list is also stale in a second way, which no round could have foreseen and a reader of §15.4
> must not walk into.** Phase 2d-4a-C step 1 (`34cd5af`) stated the contract once in
> `crates/espansoconfig-core/src/watch/retained_state.rs` and turned several of these positions into
> pointers at it. On today's tree: clause 6 there is a new position and the canonical one;
> `ReconciliationQueue::drain`'s `max` paragraph and **both** `commands.rs` positions now point at it
> rather than restating it; `ReconciliationBatch::newest_sequence`'s doc and both `dispatch_check.rs`
> positions still state it. **Calling clause 6 a "fifteenth" — as this block did until round 8 found
> it — adds one to fourteen while the same sentence says three of the fourteen stopped being
> statements**, so it is a count of *positions touching the claim* and never of statements of it.
> Counted as statements of the claim, today's tree holds **twelve**; counted as positions, fifteen. **So "§15.2's list of nine" is not a work list any later round can
> execute** — re-derive the positions from the tree in front of you.

### 15.3 The gates after this round

| Gate | Result |
|---|---|
| `pkill -f 'target/debug/deps/espansoconfig-'` | run before the workspace suite |
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1309** passed, 0 failed, **26** result lines all `ok`, exit 0 — **+1** on 1308, and the one is L1's new `#[should_panic]` test |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, clean |
| `cargo fmt --check` | exit 0, clean |
| `cargo doc --workspace --no-deps` | exit 0; **73** `private_intra_doc_links` warnings, the pre-existing count |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20/20**, **264** filtered out (263 + this round's one test), 78.69 s, no timeout |
| `npm test` | **2125** passed, 56 files — unchanged |
| `npm run check` | **431** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **184** modules — unchanged; the server oracle absent, the client oracle present with 2 matches |

The workspace suite was run once on a quiet host after the `pkill`, with nothing else running
concurrently. **A first attempt was not**: ten `watch_check::` real-filesystem tests timed out waiting
for the watcher's baseline scan on a host that had just finished a build, which is the scar
`PROGRESS.md` records and not a regression — the same binary passed 20/20 single-threaded minutes
later and the whole suite passed on the re-run. The frontend numbers were re-measured rather than
carried forward, and no frontend file changed.

**Two probes were run and reverted with the inverse edit**, never with `git checkout`: a
process-lifetime high-water mark spliced into `drain` (M1's assertion, `left: 9` against `right: 3`)
and `UnreadableReason::InvalidData {}` turned into a unit variant (L2's walk, `"reason":"InvalidData"`
as a bare string). L1's release probe put `debug_assert_eq!` back and ran the new test under
`--release`, where it failed with *"test did not panic as expected"*.

### 15.4 What this round did not do, and where it is thin

- **M1 is a words fix over nine source positions and the sweep is still a human reading.** What was
  searched was the *shape* — any sentence anywhere in `src-tauri/src/`,
  `crates/espansoconfig-core/src/` and this file describing how a watermark, a sequence or
  `newest_sequence` behaves over time, test names, test comments and assertion messages included —
  and each hit was read for falsity in **both** directions. Five positions beyond the review's four
  were found that way, three of them in test prose. **Claiming the sweep is complete is what rounds
  3, 4 and 5 each claimed and were wrong about**, so it is not claimed here. What was swept and
  **cleared**: `ReconciliationWake::newest_sequence` and `QueueState::owed_wake`, which describe one
  moment and promise nothing over time; `ReconciliationBatch::discarded` and `QueueState::discarded`,
  already *cumulative within the epoch*; the module doc's guarantee 1, already *within one workspace
  epoch*; and `crate::ledger`'s `sequences_increase_monotonically_within_one_epoch`.
- **The panic policy is a real behaviour change on a path a Tauri command reaches, and it is the
  round's largest risk.** It is argued rather than measured: nothing in this repository says what
  happens to the process or the webview when a command panics, and the new test proves the *function*
  fails rather than that the *application* survives. `crate::commands`'s module header already
  anticipates a command panicking while holding the session lock — that is what its poison policy is
  for — but *anticipates* is not *measured*. The alternatives were weighed and both refused in the
  record: there is no true arm of `ObservedDocument` for the disagreement, and adding a fourth arm
  would put an unreachable state on a wire 2d-4b must mirror and 2d-5 must render, which is a wire
  decision a fix round may not take.
- **The invariant is still unreachable through the production pipeline**, and that is unchanged from
  round 5: one register means `Workspace::from_tree` and `watch::engine` mint the same number for a
  path. The new test fabricates the disagreement, exactly as the `crate::commands` fixture round 5
  repaired fabricated it by accident. **So what this round bought is a policy, not a defence against
  a bug anything can currently produce.**
- **`wire_tag`'s exhaustive match forces a decision and not coverage.** A seventh `UnreadableReason`
  variant is a compile error in the test; adding an arm to `wire_tag` and no fixture leaves the new
  variant unserialized with everything green. Nothing in this repository can force a fixture per
  variant without a derive this project does not have, and the test's own comment says so rather than
  letting the guard look stronger than it is.
- **L3 changed no code and added no test.** The tie case is a consequence of a rule stated in
  `evictable_sequence`'s own doc, and no test drives two equally busy paths to an overflow. That is a
  gap of the same kind round 3 closed for the singleton case, and it is left open deliberately: R10
  is a residue about capacity cost, and the finding was that the **record** over-claimed.
- **R9 is open, unmeasured and unbounded.** No count exists, no cap exists, no eviction rule exists,
  and no step of the 2d split owns building one. Three consecutive rounds have now looked at it and
  none has measured it.
- **Nothing in the boundary or the watermark wording is enforced mechanically.** The three-clause
  retention boundary and the epoch-scoped watermark claim live in three source files and this record,
  kept identical by a reader; nothing fails if a future edit drops a qualification, the way
  `liveness_contract.rs` fails on an unmarked liveness claim.
- **Nothing here observes a real filesystem**, unchanged from rounds 1 through 5. `crate::watch_check`
  gained nothing this round and is still where real-filesystem evidence lives.
- **The TypeScript half is still 2d-4b's**, and R6's note stands: no `wire_contract` table compares
  `ObservedDocument`, either content enum or `UnreadableReason` against a frontend declaration, so a
  mirror that flattens the three address arms, the two content arms or the six reasons would compile
  with every Rust gate green. This round strengthened the **Rust** wire assertions, which is the half
  that can be strengthened here.
- **R8 is unchanged, and this section is an instance of it.** Round 1's fix wrote three of round 2's
  findings, round 2's wrote at least one of round 3's, round 3's wrote four of round 4's five, round
  4's wrote three of round 5's four, and round 5's wrote four of round 6's six. There is no reason to
  think this round wrote none. The likeliest places, named so a seventh round can start there rather
  than rediscover them: the **panic policy's** own prose, which claims a trade over a runtime nothing
  here measures; the **epoch-scoped watermark** wording, which is a new claim at nine positions and is
  therefore exactly the shape every previous round's fix left a narrower instance of; and the new
  test's comment, which asserts what a `debug_assert_eq!` would have measured — a claim about a
  counterfactual build.

> **Correction, round 7. Three sentences of this section are now false or stale, and round 7 found
> each of them by reading the sentence beside the one it had been sent to — which is what this
> section's last bullet predicted.**
>
> - The M1 bullet's *"a words fix over nine source positions"*, and §15.2's *"nine source
>   positions"*, undercount. **Fourteen stood in `src-tauri/src/` when §15.2 was written**, and
>   today's tree adds a canonical one in `crates/espansoconfig-core/src/watch/retained_state.rs`
>   while three of the original nine have become pointers at it — **fifteen positions touching the
>   claim, twelve still stating it**, a distinction round 8 found this bullet collapsing into a
>   "fifteenth". §15.2's round-7 correction block is the
>   derivation, position by position, with the commit that introduced each. **So this section's
>   instruction to start from that list is withdrawn**: re-derive the positions from the tree.
> - The panic-policy bullet is right that the trade is argued rather than measured, and its
>   *"there is no true arm of `ObservedDocument` for the disagreement"* is the false half of the L1
>   pair — see §15.1's round-7 correction. The alternatives are still both refused, on the accurate
>   ground: **no arm makes the object honest.**
> - The panic-policy bullet also under-states what it named. Round 7's Medium is not that the trade
>   is unmeasured; it is that `address_of_minted`'s doc **cited `crate::commands`'s module header as
>   the justification for absorbing two poisoned mutexes, and none of that header's three grounds is
>   true of `QueueState`**. §16.1 is the finding and the derivation that replaced it.

## 16. Round 7 of the review, and the fix round that answered it

`docs/reviews/phase-2d-4a-queue.md` holds round 7 verbatim, and — unlike rounds 1 to 6 — it also has
a file of its own, `docs/reviews/phase-2d-4a-round-7.md`, because of how it was produced.
**Round 7 was written by the adversarial Opus fallback, not by Codex.** Codex hit its usage limit
mid-job, 221 s in, and the workflow's rule of one bounded attempt per invocation meant it was not
relaunched. The review's own first line records that, and the queue keeps that line for the same
reason: nothing in this record may imply Codex reviewed this round. **The round also ran under
`/goahead-opus`**, whose cap of two review invocations and forty-five minutes per phase binds tighter
than this project's own §7 (`CLAUDE.md` §7.4) — so §7.1 could commission a round this workflow has no
invocation left to run, and what that costs is recorded in §16.4 rather than spent.

Its verdict: **NOT READY — 0 High, 1 Medium, 4 Low**, against gates that were green
(1313 / 26 / clean / clean / 73 / empty / 20-20 / 2125 / 431 / 184). Its scope was **the round-6 fix
plus the mechanism Phase 2d-4a-C built** — `prose_sweep.rs` and `retained_state_contract.rs`, which
did not exist when rounds 1 to 6 ran.

**Every one of the five findings is a sentence in a source-file comment, and not one is a behaviour
defect.** The review said as much about itself: four of its five sit in sites §15.4 or the brief had
already nominated. The fix round changed no executable line — ten comment hunks across five source
files, and this record.

**The single most useful thing this round did is the Medium**, and it is this project's declared
worst defect class rather than a wording nit: `address_of_minted`'s doc cited another module's
header as the **justification** for absorbing two poisoned mutexes, and **none of that header's
three grounds is true of the mutex the sentence was about**. The conclusion survives; the argument
for it did not exist anywhere. §16.1 has what replaced it and how it was derived.

**All five findings came back with a count, an attribution or a piece of reasoning this fix round
disagrees with, and wherever the disagreement is a number the fix round's is the larger one.** That
is not a complaint about the reviewer — every one of the five findings is real, and none was refused
— it is the standing rule doing its work: rounds 5, 6 and 7 each supplied an instance of a
reviewer's count being wrong, and this round supplies five more. Each disagreement is derived in
§16.1 beside the finding it belongs to, with the `git log -S` or the grep that produced it.

### 16.1 Finding by finding

| # | Severity | What was wrong | What closes it | The test that fails without it |
|---|---|---|---|---|
| M1 | Medium | `address_of_minted`'s doc said *"`crate::commands`'s module header is why the two poisoned mutexes are not a second failure"*. That header grounds absorption in three properties of the **session** mutex — a cache over the disk behind it, one infallible assignment per mutation, and `reload_document` as the recovery — and **not one of the three is true of `QueueState`**: nothing re-reads a lost observation, `drain` mutates the state with two statements (`reconciliation.rs:1186` and `:1187-1189`), and no command recovers a queue. So the conclusion stood on a citation that did not reach it, which is a decision-record-style overclaim living in source | **Words.** The paragraph now separates the **mechanism** from the **justification**: both mutexes absorb poisoning through `PoisonError::into_inner`, that is all the header supplies, and the three grounds are named as false of `QueueState` in the same sentence. What holds instead is derived from `drain` and stated there: **both mutations run before the projection loop that can panic, and an unwind undoes neither**, so the state behind the poisoned lock is the state a *completed* `drain(after_sequence)` would have left — watermark raised, everything at or below it gone, nothing above it touched, the loss count unmoved, the undelivered batch still stored. The paragraph then says what that does **not** buy, and ends by saying that none of it is asserted by anything | **None, and none is possible without poisoning a lock in a test.** No test in this repository panics a command and then drains again; the `#[should_panic]` test proves the function fails and nothing about what a later caller finds. That is stated in the paragraph itself rather than left to be inferred, and §16.4 carries it |
| L1 | Low | Two positions of one file contradicted each other about the same arm. `address_of_minted`'s doc says *"the arm was locally true and the object held two identities for one file"*; the new `#[should_panic]` test's comment said *"There is no arm of `ObservedDocument` that is true in that case"*. The doc is right: without the assertion the function answers `Addressable { document: resolved }`, and `Addressable`'s claim — *the open workspace resolves this path to this identity* — is true of `resolved`, because `resolved` is what `workspace.document_id(path)` just answered. What is false is the **observation** around it, whose `ChangedContent::Projected` carries the snapshot's identity in `DocumentView::id` and in every `MatchId` beneath | **Words, at four positions.** The accurate general form is **no arm makes the object honest**, which is not *no arm is true*; the policy is unchanged, because a locally true arm inside a dishonest object is still not a wire value anybody can act on. The test comment is corrected in place. The three record positions are corrected by the round-7 blocks after §15.1's table, in §3.3, and at the end of §15.4 | **None.** No test can fail a false comment, and the behaviour is pinned by `a_snapshot_identity_the_open_workspace_contradicts_is_a_failure_and_never_a_wire_value` either way |
| L2 | Low | §15.2's *"nine source positions"* of the epoch-scoped watermark claim — repeated by §15.4's M1 bullet as *"a words fix over nine source positions"* — undercounts, and §15.4 sends the next round to that list, so the undercount propagates into whatever round reads it | **Words, in the record only.** §15.2 carries a round-7 correction naming **five** further positions with the commit that introduced each, and §15.4 carries one withdrawing its instruction to start from the list. No source position is wrong; every one of the five is correct prose. The correction also records the second way the list is stale: Phase 2d-4a-C step 1 turned three of the nine into **pointers** at `retained_state`'s clause 6, which is itself a position and did not exist when §15.2 was written | **None.** No test reads a decision record's count. The only check is a reader re-deriving the positions from the tree, which is what this round did and what §15.2's correction now tells the next one to do |
| L3 | Low | `prose_sweep::prose_units` joins wrapped **comment** runs and leaves every other line a unit of its own — framed in its doc as a benefit, with no mention that the same repository hand-wraps long assertion messages with backslash continuations, so a claim split across one of those breaks matches nothing. `retained_state_contract.rs` claims the check *"catches an unmarked claim and a new claim"* and its four stated limits omitted this one | **Words, at three positions rather than the one named.** `prose_units`'s doc now states the cost beside the benefit; `retained_state_contract.rs` has a **fifth** limit and `liveness_contract.rs` a **fourth**, because the hole is in the shared mechanism and both families inherit it. Each says the measurement and its weakness in the same sentence: **zero** positions today are visible only in the joined form, that measurement is a hand-run replica taken once, and **no test re-takes it** | **None, and this is the finding's own point.** A test would have to join continuations and then assert the join found nothing, which is a test of the replica. What exists is the capability statement; the count is evidence for one tree at one moment and is written down as such |
| L4 | Low | `commands.rs:8838`'s comment — *"the same call answers the same batch until the caller says it has one of them"* — carried neither of the two qualifications the guarantee is stated with elsewhere: *when nothing was enqueued between the two calls* and *no replacement epoch was adopted between them* | **Words, at two positions.** The `commands.rs` comment now carries both, names where the qualified form lives, and says why neither applies in that test. The sweep found a **second** deficient position the review did not name — `reconciliation.rs`'s comment in `a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not`, which carried the first qualification and called it *"the qualification the guarantee carries"*, singular — and it now carries both and points at the test that drives the other side | **None.** Both positions are comments beside tests whose behaviour is already asserted: `the_drain_hands_back_what_the_queue_holds_above_the_watermark` and `a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not` both re-drain and compare, and `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` drives the replacement half |

**Where this fix round's derivation disagrees with the review's.** Each was derived on the tree the
round was commissioned on, `93fb76b`, by `git log -S`, by `grep`, or by re-implementing the sweep;
the review's own numbers are kept above where they were right.

- **M1's reasoning was adopted in half and refused in half.** The review argued the conclusion holds
  *"because both mutations are pure functions of `after_sequence`, so the surviving state is
  consistent and a retry with the same watermark reproduces the batch"*. The first half understates
  what is true: both mutations complete **before** the projection loop that panics, so there is no
  partially applied state to reason about at all — the surviving state is what a completed drain
  leaves, which is stronger than *consistent*. The second half is refused. A retry re-projects the
  same entries against the same workspace and reaches the same assertion, so the batch is
  reproducible in principle and not obtainable in fact **by a caller that keeps acknowledging what
  it was handed**. Round 8 found the first draft of this bullet, and of the doc paragraph it
  records, stating that bound as an enforcement: it is not one. `after_sequence` crosses the wire as
  an unvalidated `u64`, so a caller passing a watermark at or above the offending entry's sequence
  prunes it at the retain before the projection runs, and `begin_epoch` assigns an empty state over
  the whole of it — two escapes, neither prevented here and neither repairing the disagreement. **Writing *a retry reproduces the batch* into
  the doc would have been a new false sentence in the paragraph that exists to stop one**, which is
  why the fix says what the state is and then says what it does not buy.
- **L1 stands at four positions, not two.** The review named the source comment and one record
  position (§15.1's L1 row). Grepping this file and both source trees for the *shape* — `no arm`,
  `true arm`, `arm is true` — found two more, both in this file: §3.3's round-6 correction block and
  §15.4's second bullet. All four are corrected.
- **L2's omissions are five, not two, and their provenance is not what the review said.** The review
  named `reconciliation.rs:1770-1774` and `:1794-1801` and filed both as prose blocks round 6's fix
  *gained*. Derived: the omitted positions in that test are **five** — one comment and one assertion
  message from `eced554` (round 5's fix), and one comment and two assertion messages from `6be7231`
  (round 6's) — so one of the two the review named was already in the tree when §15.2 was written.
  The spans are `:1771-1774` and `:1794-1802`. Each differs from the review's by one line at one
  end — **in opposite directions**, which round 8 found this sentence flattening into one: against
  the review's `:1770-1774` the first is a line **narrower** at the start, and against its
  `:1794-1801` the second is a line **wider** at the end. And
  the true figure for the tree §15.2 described is **fourteen**, against the review's *"at least
  eleven"*.
- **L3's example line is wrong and its measurement is narrower than the hole.** The review cites
  `reconciliation.rs:1786` as a backslash-wrapped assertion message; on that tree, 1786 is
  `queue.enqueue(changed(3, 3, "match/a.yml", TWO));`, a plain statement. The nearest wrapped
  assertion message is `:1768-1769`. The measurement was re-taken here independently — a Python
  replica of `prose_units`, `sweep` and `complaints_against`, run over both trees — and it reproduces
  the review's **zero** for the retained-state family's 88 phrases. It also measures what the review
  did not: the **liveness** family's 61 phrases, also zero, and that is why the fix touches
  `liveness_contract.rs` as well as the module the review named.
- **L4's claim is at six positions, not five.** The review named one deficient position and four
  sound ones. A sixth exists — `reconciliation.rs:1842`'s test comment — and it carried one
  qualification of two while calling it *the* qualification. It is fixed with the one the review
  named.
- **One line cite is off by one, recorded only so the next round does not re-derive it as a
  disagreement**: the review's `:1480` for the `assert_eq!` is the macro's second line
  (`resolved, document,`), the call opening at `:1479`. Its `commands.rs:220-228` for the poison
  policy was checked and is **exact** — `:220` is the heading and `:222-228` the body. Beyond those,
  the cites that were opened on `93fb76b` and found right are `reconciliation.rs:2677` (L1's test
  comment), `:1186` and `:1187-1189` (M1's two mutations), `:1207-1211`, `:102`, `:1157`,
  `commands.rs:1324`, `:3474`, `:8838`, `prose_sweep.rs:125` and
  `retained_state_contract.rs:58`; `reconciliation.rs:920-935`, `:1459`,
  `commands.rs:1446-1455`, `prose_sweep.rs:326-403` and both `workspace/mod.rs` spans land on the
  right item within a line or two. **The three cites that point at the wrong text are all named
  above**: two of L2's spans, each off by one line at one end — the first a line wide at the start,
  the second a line short at the end, and round 8 found an earlier draft of this clause calling them
  both short — and L3's `:1786`.

**The review's second Question — *"the cheapest honest close is to fix none and carry all five as
recorded items"* — was considered and refused.** It is available under `CLAUDE.md` §7.3: none of the
five is a *correctness* defect in source, so all five could have been carried and the step would have
closed. It was refused because **a false sentence in a source comment is this project's declared worst
defect class**, and the M1 one in particular is a justification that does not reach its conclusion,
sitting three lines above the assertion it justifies. Carrying it would have left the next reader the
same citation to follow. The consequence is taken deliberately: §7.1 commissions round 8 against this
fix round, scoped to five source files of comments. §16.4's last item is what happens if the
`/goahead-opus` cap has no invocation left for it.

### 16.2 What this round changed, by file

**Seven files, and two of them are the record's own — the habit §14.2 was corrected for.**

- **`src-tauri/src/reconciliation.rs`** — three comment blocks and **no executable line**.
  `address_of_minted`'s *what the trade costs* paragraph is rewritten (M1): the poison sentence is
  replaced by the mechanism/justification split, the three grounds are named as false of
  `QueueState`, the property of `drain` that does hold is derived, and the paragraph ends by saying
  none of it is asserted. The `#[should_panic]` test's comment says **no arm makes the object
  honest** instead of *no arm is true* (L1). The comment in
  `a_watermark_removes_what_it_acknowledges_and_keeps_what_it_does_not` carries both qualifications
  of the repeat-drain guarantee instead of one (L4). **No test was added or renamed and no
  executable line inside one changed** — only comments — so the suite's count should not move and
  nothing it asserts should change.
- **`src-tauri/src/commands.rs`** — one comment in
  `the_drain_hands_back_what_the_queue_holds_above_the_watermark`, which is L4's named position.
  **No behaviour changed here**, and no fixture.
- **`src-tauri/src/prose_sweep.rs`** — `prose_units`'s doc gains the paragraph stating the
  backslash-continuation cost beside the comment-joining benefit, the measurement, and that no test
  re-takes it (L3). **No code changed**: the function still joins comment runs and only comment runs.
- **`src-tauri/src/retained_state_contract.rs`** — a **fifth** stated limit, for the same hole
  (L3); and a clause added to the *two source trees and no document* limit saying that `src/` is a
  third case the bullet used to read past, that no TypeScript stores a `newest_sequence` yet, that
  whether this family follows 2d-4b into the frontend tree is that phase's decision, and that until
  it is taken a retained-state claim written in `src/` is invisible to this check. That clause
  answers the review's first Question; it is **not** a finding and takes no decision.
- **`src-tauri/src/liveness_contract.rs`** — a **fourth** stated limit, the same hole in the shared
  mechanism, and the *Three further limits* line becomes *Four* (L3). The phrase table and the
  inventory are untouched.
- **`docs/decisions/2d-4a-notes.md`** — four round-7 correction blocks (§3.3, after §15.1's table,
  after §15.2's list, and at the end of §15.4) and this section.
- **`docs/reviews/phase-2d-4a-queue.md`** — round 7's verbatim record, reproduced from
  `docs/reviews/phase-2d-4a-round-7.md` with exactly two edits: its `###` headings demoted to `##`
  to match this file's convention for round bodies, and its `Reviewer:` first line kept. The
  reproduction was checked line by line against the source file rather than read over.

An eighth path is new in this round's commit and is **not** a file this fix round wrote:
`docs/reviews/phase-2d-4a-round-7.md`, the review itself. It is named here because §14.2's defect
was a by-file list that omitted the review's own artefact.

**`PROGRESS.md` is the orchestrator's** and is written in its own commit, as every round of this
step has been. **`crates/espansoconfig-core` is untouched** — no core file changed, so
`cargo tree -p espansoconfig-core | rg tauri` cannot have moved. **No Svelte component, no TypeScript
and no i18n key changed**: this step still draws nothing and still decides nothing about whether a
write surface is open (Q7 item 4).

### 16.3 The gates after this round

**This fix round ran no gate, and every cell below says so.** The orchestrator measures them once,
alone, after this round — a fix worker running `cargo` concurrently with the orchestrator is what
produced ten phantom `watch_check::` timeouts on a busy host, which is the scar `PROGRESS.md`
records. **A round that cannot run a gate does not report one**, and writing a plausible number here
would be indistinguishable from having measured it.

| Gate | Result |
|---|---|
| `pkill -f 'target/debug/deps/espansoconfig-'` | pending — the orchestrator measures these once, alone, after this round |
| `cargo build --workspace` | pending — the orchestrator measures these once, alone, after this round |
| `cargo test --workspace` | pending — the orchestrator measures these once, alone, after this round |
| `cargo clippy --workspace --all-targets -- -D warnings` | pending — the orchestrator measures these once, alone, after this round |
| `cargo fmt --check` | pending — the orchestrator measures these once, alone, after this round |
| `cargo doc --workspace --no-deps` | pending — the orchestrator measures these once, alone, after this round |
| `cargo tree -p espansoconfig-core \| rg tauri` | pending — the orchestrator measures these once, alone, after this round |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | pending — the orchestrator measures these once, alone, after this round |
| `npm test` | pending — the orchestrator measures these once, alone, after this round |
| `npm run check` | pending — the orchestrator measures these once, alone, after this round |
| `npm run build` | pending — the orchestrator measures these once, alone, after this round |

**What was measured instead, and what it is worth.** Both prose-sweep guards were re-run as a
**Python replica** of `prose_units`, `sweep` and `complaints_against`, parsing `RETAINED_STATE_SHAPES`,
`LIVENESS_SHAPES` and both `INVENTORY` tables out of the source: 88 phrases / 140 entries / 224 hits
/ **0 complaints**, and 61 phrases / 86 entries / 129 hits / **0 complaints**, before any edit and
after every one of them. The replica was controlled in both directions before being trusted — a
phrase deliberately split across a `\` continuation is invisible to it line-based and visible joined,
and the live families match 224 and 129 times, so a zero from it is not a zero from a search that
cannot match. **It is a replica and not the test**: it re-implements the two guards rather than
calling them, so it can agree with a wrong implementation of itself, and `every_retained_state_claim_is_judged`
and `every_liveness_claim_is_judged` are what actually decide. What it buys is that ten comment hunks
in swept files were made without adding or removing a single inventoried phrase occurrence, which is
the one way a comment-only round can turn a green suite red.

**No probe was run and none was reverted**, because nothing here changes behaviour to probe. No
`git` command that changes state was run.

### 16.4 What this round did not do, and where it is thin

Every item carries one of `CLAUDE.md` §7.3's two marks. **An *actionable* item naming a correctness
defect in a source file is a blocker under that rule — the step does not close until it is fixed.
This round records none**: nothing below names a correctness defect in a source file, so nothing
below holds the step open.

- **The Medium's replacement paragraph is a derivation and nothing asserts it.** *"Both mutations run
  before the projection loop and an unwind undoes neither"* was established by reading `drain` —
  `guard.acknowledged = …` at `:1186`, `retain` at `:1187-1189`, the `.map(…).collect()` at
  `:1195-1196`, and no mutation after it — and by confirming that neither manifest sets
  `panic = "abort"`, so unwinding and therefore poisoning are real. **No test poisons either lock**,
  no test drains after a panic, and nothing fails if a future edit adds a third mutation to `drain`
  *after* the collect, which would falsify the paragraph silently. That last one is the sharpest
  shape here and it is the same shape §14.4 recorded about the fifth mutation of
  `QueueState::pending`. *(recorded only — it names a risk and a shape to watch, not a defect that
  exists in the file today.)*
- **The paragraph's *"a later drain reaches this assertion again"* half is reasoned, not run.** It
  follows from `retain` removing only what is at or below the caller's watermark and from the caller
  never being handed the offending sequence, but nothing exercises it, and what a panicking Tauri
  command does to the process or the webview is still asserted by nothing in this repository —
  unchanged from §15.4 and from round 7's own *Not verified*. *(recorded only.)*
- **The L3 measurement is a replica of the sweep, taken once, by the round that wrote the sentence
  claiming it.** Both new limits say so in the same sentence as the number, which is the honest form,
  but it remains a measurement whose tool was written by the party it exonerates. A round that wants
  it independently would re-implement the join differently — the replica joins a `\`-terminated run
  by stripping the backslash and concatenating, which is not exactly what `rustc` does to a string
  continuation (it also eats leading whitespace on the next line), so a phrase whose split falls on
  a run of spaces could behave differently under the two. **On today's tree the answer is zero either
  way, because zero positions matched at all.** *(actionable — a check that can be re-run over files
  that exist, though the replica itself is **not** in this repository and a later round would have to
  write its own; it names no defect in source, so a later phase may adopt it and this step closes
  without it.)*
- **Nothing mechanically enforces any of the wording this round fixed**, unchanged from §15.4 and
  now with two more instances: the six-position *same batch twice* family and the epoch-scoped
  watermark family — **fifteen positions touching it, of which twelve state it and three point at
  the canonical clause**, a distinction round 8 found an earlier draft of this bullet collapsing
  into "fifteen-position" — are both kept identical by a reader. The two prose guards check that
  a claim of *their* families is inventoried, not that any of these is true, and neither family is
  in either phrase table. *(recorded only — adding them is a phase decision about what those tables
  are for, not a defect.)*
- **One position of the watermark family was found and deliberately left alone.**
  `reconciliation.rs`'s assertion message in
  `an_out_of_order_drain_answers_the_acknowledgement_and_never_the_lower_argument` —
  *"an empty batch answers the highest watermark, never the caller's lower argument"* — carries no
  epoch scope, where its sibling in `an_empty_batch_answers_the_watermark_it_was_asked_with` says
  *within one epoch*. It is **not false**: it makes no cross-epoch claim, and the comment above it
  carries the scope. It was left because adding scope to a message that is not wrong is a source
  change for symmetry alone, and every source change this round makes widens what round 8 must
  review. *(actionable — a named position in a file that exists; it names no correctness defect, so
  the step closes without it.)*
- **The same capability sentence L3 bounds still stands unbounded in six `docs/` positions** that
  this round did not touch. Derived by grepping `docs/` for the shape rather than for L3's wording:
  `docs/progress-archive/2d-4a-c-closure.md:258`, `docs/progress-archive/status-table.md:112`,
  `docs/progress-archive/phase-2d.md:2152`, `docs/progress-archive/next-action-history.md:134`,
  `docs/decisions/2d-3-C-notes.md:296` and **this file's own §5**, at the line reading *"It catches an
  unmarked claim and a new claim, and it cannot judge whether a claim is true"*. Each is a summary of
  a limits list rather than a limits list, so none of them is false in the way the module doc was —
  what they omit, they omit by summarising. Four sit in `docs/progress-archive/`, one in a closed
  phase's decision record, and one here. *(actionable — named positions in files that exist; every
  one of them is in **the record**, not in source, so a later phase may adopt them and this step
  closes without them.)*
- **R9 is open, unmeasured and unbounded**, for a fourth consecutive round. No count, no cap, no
  eviction rule, and no step of the 2d split owns building one. *(recorded only — the reason it
  cannot be measured from a test in this binary is §15.1's L4 row and has not changed.)*
- **R10's tie case still has no test**, unchanged from §15.4. *(recorded only.)*
- **Nothing here observes a real filesystem**, unchanged from rounds 1 through 6. *(recorded only.)*
- **The TypeScript half is still 2d-4b's.** No `wire_contract` table compares `ObservedDocument`,
  either content enum or `UnreadableReason` against a frontend declaration. This round added a
  sentence saying `src/` is outside the retained-state sweep, which makes the gap *stated* and no
  smaller. *(recorded only.)*
- **R8, and the shape this round is most likely to have written.** Round 1's fix wrote three of round
  2's findings, round 2's at least one of round 3's, round 3's four of round 4's five, round 4's
  three of round 5's four, round 5's four of round 6's six, and round 6's — by round 7's own count —
  four of round 7's five. There is no reason to think this round wrote none. The likeliest places,
  named so round 8 can start there rather than rediscover them: **the M1 paragraph**, which is long,
  new, entirely unasserted, and makes a claim about what an unwind leaves behind; **the two new
  limits**, which state a measurement and its weakness in the same breath and could easily have got
  the balance wrong in either direction; and **§16.1's disagreement list**, which asserts five
  provenance claims derived from `git log -S` on single strings — a search that finds the commit
  where a string first appeared in a file and not necessarily where the *claim* did. *(recorded only
  — a nomination, and per §7.3 no item here commissions a round.)*
- **Under `/goahead-opus` the workflow's cap can outrank §7.1 on this step.** §7.1 commissions round 8
  against this fix round, because it changed five source files. If the cap has no invocation left for
  it, `CLAUDE.md` §7.4 is what applies: the unreviewed source change becomes a corrective phase with
  its own acceptance criteria and its own mandatory review, and this step is recorded as superseded
  rather than complete. **That is a workflow outcome, not a finding**, and it is written here so the
  choice is made deliberately rather than by running out of budget quietly. *(recorded only.)*

---

## 17. Round 8 of the review, and the fix round that answered it

Round 8 is **the phase's second and last review invocation**. It was commissioned by `CLAUDE.md`
§7.1 — the round-7 fix changed five source files, and a fix that changes source is owed a round,
a comment-only change included, because *the unit is the file, not the line* and this project keeps
several of its contracts in comments. Its scope was that fix round's diff and nothing else.

**It was the adversarial Opus fallback, not Codex, and so was round 7.** The Codex job dispatched for
round 7 (`task-mtem01j9-fnltn3`, high effort) ran 221 s and failed on *"You've hit your usage limit
... try again at 7:07 PM"*. Under `~/.claude/scripts/goahead-base.md` that is one bounded attempt
spent — Codex is never relaunched inside a phase — and a Codex limit is explicitly **not** a `QUOTA`
outcome, because it is another provider's window closing and stops no work here. Both rounds
therefore ran as fresh cold `general-purpose` Opus agents with no share in the code, each writing its
full report to a file of its own: `docs/reviews/phase-2d-4a-round-7.md` and
`docs/reviews/phase-2d-4a-round-8.md`, both reproduced verbatim into
`docs/reviews/phase-2d-4a-queue.md`. **A fallback review is a real review and carries the same
weight**; what it is not is a Codex review, and the first line of each report says so, so no later
reader can mistake the provenance.

**Round 8's verdict: ship-with-fixes — 0 High, 1 Medium, 2 Low.** It also cleared, by its own
derivation rather than by accepting the fix round's report, the three claims the brief named as the
ones most worth disbelieving:

- **No executable line changed.** Verified with `git diff -U0` over `src-tauri/src` with added and
  removed lines stripped of leading whitespace, leaving no non-comment residue: no test, fixture,
  phrase-table or inventory entry moved.
- **The round-7 reproduction is verbatim** — 97 lines against 97, zero diff hunks after the `###`→`##`
  demotion, with the `Reviewer:` line kept.
- **M1's substituted claim is true.** This was the highest-risk sentence in the round-7 fix, because
  that fix had *refused* the round-7 reviewer's own proposed reasoning and put a different one in its
  place. Round 8 traced `drain` and confirmed it: both mutations — `acknowledged` at
  `reconciliation.rs:1186` and the retain at `:1187-1189` — complete before `coalesced_sequences` and
  before the `.map(external_observation)` inside the `.collect()` at `:1191-1197` that reaches
  `address_of_minted`, and `drain` touches neither `discarded` nor `epoch`, so the state behind a
  poisoned lock is exactly a completed drain's.

### 17.0 The bounded wait that collected round 7's Codex job, reproduced

`~/.claude/scripts/codex-wait.sh` false-stalls on healthy jobs, because the `updatedAt` it polls never
advances. The wait used today polls `.job.status` and takes the **log file's mtime** as the stall
signal, with a hard deadline as well. It is reproduced here because it is the third round running that
this project has had to rediscover it, and it worked first time: it returned `TERMINAL=failed after
221s`, which is how the usage limit was seen at once rather than waited through.

```zsh
#!/bin/zsh
# $1 hard deadline (s), $2 stall threshold (s) on the LOG's mtime, $3 job id.
JOB="$3"
CC=$(ls "$HOME"/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)
LOG="$HOME/.claude/plugins/data/codex-openai-codex/state/<workspace-key>/jobs/$JOB.log"
deadline=$(( $(date +%s) + $1 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  st=$(node "$CC" status "$JOB" --json 2>/dev/null | python3 -c 'import sys,json
try:
    print(json.load(sys.stdin).get("job",{}).get("status",""))
except Exception:
    print("")' 2>/dev/null)
  case "$st" in
    completed|failed|cancelled|canceled|error) echo "TERMINAL=$st"; exit 0;;
  esac
  now=$(date +%s); mt=$(stat -f %m "$LOG" 2>/dev/null || echo "$now")
  [ $(( now - mt )) -ge "$2" ] && { echo "STALLED status=$st"; exit 3; }
  sleep 20
done
echo "DEADLINE status=$st"; exit 2
# End of the bounded wait loop
```

Two things it does **not** do, said here rather than assumed: it never re-dispatches, and it reports a
`failed` terminal status as terminal rather than as an absence — the caller reads the job's log to find
out *why*, which is where the usage-limit notice was.

### 17.1 Finding by finding

- **M1 (Medium) — the panic paragraph claimed an enforcement the code does not perform.**
  `reconciliation.rs:1489-1493` said the caller *"cannot acknowledge past a sequence it was never
  handed"*, and that the surviving state does not buy *"a queue this caller can drain"*. Neither is
  enforced. `after_sequence` reaches `drain` as an unvalidated `u64` off the wire
  (`commands.rs:3491` → `:1353` → `reconciliation.rs:1184`), so a caller passing a watermark at or
  above the offending entry's sequence prunes that entry at the `:1187` retain *before* the
  projection runs; and `begin_epoch` assigns an empty state over the whole of it, so reopening the
  workspace discards it too. **Agreed and fixed at three positions** — the doc paragraph and, in
  this file, §16.1's M1 row and its first disagreement bullet. The rewritten sentence names both
  escapes, says neither is prevented here and neither repairs the disagreement, and says in the same
  sentence that this is not an enforcement. **This is the round's only source change**, and it errs
  pessimistic in the direction that matters: the sentence it replaces promised *more* safety than the
  code gives, which is this project's named worst defect class, and nothing unsafe followed from it.
  > **Correction, round 9 (H1 and M1).** Two sentences above are wrong, and the second is this
  > project's worst defect class arriving in the sentence that closed an instance of it.
  >
  > *"**This is the round's only source change**"* is false — the fix also added an `INVENTORY` entry
  > to `src-tauri/src/retained_state_contract.rs`, which §17.2's by-file list and §17.3's
  > *"That entry is a second source change"* both record. **The round-8 fix changed two source
  > files**, and that is the sentence that stands.
  >
  > *"names both escapes"* is a closed enumeration wrong by one. There is a **third**:
  > `ReconciliationQueue::enqueue` evicts while `guard.pending.len() > QUEUE_CAPACITY`
  > (`reconciliation.rs:1098-1104`, the constant at `:255`), taking the victim `evictable_sequence`
  > (`:921-935`) selects — the lowest pending sequence of the path holding the most pending entries.
  > `enqueue` takes the lock through `PoisonError::into_inner` (`:1089`), so eviction stays live
  > after the panic the paragraph is about. The enumeration was written out correctly one file away
  > the whole time: `crates/espansoconfig-core/src/watch/retained_state.rs` clause 4 (`:100`) says a
  > stored entry leaves in **exactly three** ways and names the overflow as the second — and so does
  > this file's own preamble, in round 5's correction block. §18.1's H1 is the fix.
- **L1 (Low) — one span description was backwards.** §15.2's round-7 correction block and §16.1's L2
  bullet said the two derived spans are *"each a line wider at one end than the review's"*. Measured
  on `93fb76b` that is true of one and inverted for the other: `:1771-1774` is a line **narrower** at
  the start than the review's `:1770-1774`, and `:1794-1802` a line **wider** at the end than its
  `:1794-1801`. **The spans themselves were correct**; only the sentence describing them was wrong.
  Fixed at both positions, plus the third instance in §16.1's own cite audit, which had called both
  of them short.
- **L2 (Low) — "fifteenth" counted pointers as statements.** §15.2's correction block called clause 6
  of `crates/espansoconfig-core/src/watch/retained_state.rs` a *"fifteenth"* position of the
  epoch-scoped watermark claim, and §16.4 called the family *"fifteen-position"* — while the same
  block says three of the fourteen *"now point at it rather than restating it"*. 14 + 1 = 15 only
  holds if a pointer is a statement. Fixed at three positions by separating the two counts wherever
  the figure appears: **fifteen positions touch the claim; twelve state it and three point at the
  canonical clause.**

### 17.2 What this round changed, by file

Listed in full, this record and the review files included, because §15.2 exists precisely because an
earlier round's by-file list was not:

- `src-tauri/src/reconciliation.rs` — one comment hunk, the M1 fix.
- `src-tauri/src/retained_state_contract.rs` — **one `INVENTORY` entry, and it was not planned.**
  See below: 2d-4a-C's own guard rejected the M1 fix and forced this judgement.
- `docs/decisions/2d-4a-notes.md` — this section, plus five corrections inside §15.2, §16.1 and
  §16.4 (M1 at two positions, L1 at three, L2 at three; two of those overlap).
- `docs/reviews/phase-2d-4a-round-8.md` — new, written by the reviewer itself.
- `docs/reviews/phase-2d-4a-queue.md` — the `## Round 8 — verbatim` section.
- `docs/reviews/phase-2d-4a-round-7.md` — new at round 7, written by that reviewer, unmodified here.

### 17.3 The gates after this round, and the one that failed first

Measured by the orchestrator, alone, on the tree this round produced — no worker ran a gate.
`cargo test --workspace` **1313** passed / 0 failed over **26** result lines all `ok`, exit 0;
`cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc
--workspace --no-deps` **73** `private_intra_doc_links`, 0 unresolved; `cargo tree -p
espansoconfig-core | rg tauri` empty; `watch_check::` **20/20**, 268 filtered out, 77.63 s; `npm
test` **2125** in 56 files; `npm run check` **431** files / 0 errors; `npm run build` **184**
modules, server-build oracle absent, client-build oracle present with 2 matches. No frontend file
changed this round, and the three frontend figures were re-measured anyway rather than inferred.

**The first run of that suite failed, and it is the most useful thing this round produced.**
`retained_state_contract::tests::every_retained_state_claim_is_judged` rejected the M1 fix —
`cargo test --workspace` exited 101 with 287 passed and 1 failed — naming
`src-tauri/src/reconciliation.rs` line 1425, phrase `"things end"`, *found 1, inventory says 0*, and
asking the question the check exists to ask: **is it the contract, a pointer, a local fact, or a
false positive?** So the mechanism 2d-4a-C built, whose nine-round tail cleared the code outright
from round 4 onward and which had never once fired on new prose in anger, caught a new claim written
into a source comment by a fix round, within an hour of that tail closing. It is judged in
`INVENTORY` as a **local fact** — the two escapes from `address_of_minted`'s repeating assertion —
with the note that its `begin_epoch` half cites clause 6's consequence on one path rather than
restating the scope, which is the same judgement this file's `discards everything` entry already
carries. **That entry is a second source change**, made after round 8 reviewed the fix, and it falls
under the same unreviewed-source debt §17.4 records rather than adding a new one.

> **Correction, round 9 (H1 and H2).** The judgement recorded above is right in its cell and wrong in
> both of its details. *"the two escapes"* inherits the miscount corrected in §17.1 — there are
> **three**, the third being the overflow eviction inside `ReconciliationQueue::enqueue`. And
> *"clause 6's consequence on one path"* names the wrong clause: clause 6
> (`crates/espansoconfig-core/src/watch/retained_state.rs:119`) is *"Within the epoch a batch names,
> its `newest_sequence` never falls"*, and nothing in the M1 paragraph is about `newest_sequence`.
> What the `begin_epoch` half states is **clause 4's third way** (`:100`) — which the precedent the
> entry appeals to says in as many words, since `retained_state_contract.rs`'s own
> `discards everything` entry **for `reconciliation.rs`** reads *"the third way a stored entry
> leaves"* and its twin for `retained_state.rs` reads *"the contract itself: clause 4's third way"*. So the recorded coupling pointed at a clause the comment does not depend on, and a
> change to the clause it does depend on traced to nothing. **`count: 1` and the `local fact` cell
> are both right** and are unchanged; §18.1's H2 is the rewritten `reason`.

### 17.4 What this round did not do, and where it is thin

Per `CLAUDE.md` §7.3 every item carries a mark. An **actionable** item naming a correctness defect in
a source file is a blocker that stops this step closing; none below is one.

- **Round 9 is commissioned by §7.1 and cannot run here.** This fix round changed
  `src-tauri/src/reconciliation.rs`, so §7.1 owes it a round — and the workflow's cap of **two review
  invocations and 45 minutes per phase** is exhausted and outranks §7 by §7.4's own words. The debt is
  **carried, not written off**: it becomes a corrective phase with its own acceptance criteria, its
  own commit and its own mandatory review, and this step is recorded as superseded rather than
  complete. *(actionable — it names work in files that exist, but no defect in source; it is a
  workflow outcome, and `PROGRESS.md` carries it as the next action.)*
- **Part of the unreviewed change was written after round 8 read the diff.** The `INVENTORY` entry in
  `src-tauri/src/retained_state_contract.rs` did not exist when round 8 reviewed, because the guard
  that demanded it had not yet been run against the M1 fix. Round 8 therefore reviewed the M1 comment
  and **not** the judgement recorded for it — which is precisely the shape §7.1 commissions a round
  for, and the corrective phase's reviewer should start there. *(actionable — it names a specific
  unreviewed source change in a file that exists; it is not a correctness defect, because the guard it
  answers passes and the judgement is argued in the entry itself, so it does not block this step.)*
- **The unreviewed change is one comment hunk that removes a claim rather than adding one.** That is
  the cheapest shape of unreviewed source change this tail could have ended on, and it is said here
  so the corrective phase's reviewer starts from the right size of thing. It is **not** an argument
  that the round is unnecessary — every prior round of this tail found a real defect in what the round
  before built, and three of them found the defect *in a fix*. *(recorded only.)*
  > **Correction, round 9 (M2).** This bullet understates its own subject twice. The unreviewed change
  > is a comment hunk **and** a `const` array item — the `INVENTORY` entry the bullet above it
  > describes — so it is **two source files**, not one hunk. And the hunk **adds** claims rather than
  > removing one: where it took out a single enforcement claim it put in two factual ones, that an
  > unvalidated `after_sequence` prunes the entry at the retain and that `begin_epoch` discards it,
  > plus the closed count that carried both. Round 9's report measures that hunk at net **+30 lines**;
  > this fix round cannot re-derive that figure from `git`, because rounds 7 and 8 share commit
  > `125dfa8` and round 8's share of it cannot be isolated — what `git show --numstat` gives for the
  > two rounds together is **+51 / −12** in `src-tauri/src/reconciliation.rs` and **+26 / −2** in
  > `src-tauri/src/retained_state_contract.rs`. Either way the direction is the opposite of the
  > bullet's. Sizing the corrective phase from *"the cheapest shape"* was therefore sizing it from the
  > smallest reading available, and round 9 found two Highs inside exactly that change. The bullet's
  > last sentence stands, and is now measured a fourth time.
- **Both reviews were Opus fallbacks, so no round of this phase has had a second provider's eyes.**
  Rounds 1–6 were Codex; rounds 7 and 8 were not. The two reviewers are cold agents with no stake, and
  round 8 re-derived rather than accepted, but a systematic blind spot shared by both would be
  invisible here in a way it would not have been under Codex. *(recorded only — the substitution is
  the workflow's prescribed behaviour when Codex is unavailable, not a shortcut taken here.)*
- **M1's fix rests on round 8's trace of `drain`, and nothing asserts it.** No test poisons either
  lock, no test drives a watermark at or above an offending entry's sequence, and what a panic does to
  the process around a Tauri command is still measured by nothing in this repository — unchanged from
  §15.4 and §16.4. The fix made the paragraph *say less*, which is why it is safe without a test; it
  did not make it checkable. *(recorded only.)*
  > **Correction, round 9 (M3).** *"The fix made the paragraph say less"* is false of the diff it
  > describes, and the inference drawn from it does not hold. The fix traded **one** enforcement claim
  > for **two** assertions nothing checks — that an unvalidated `after_sequence` prunes the entry at
  > the retain, and that `begin_epoch` discards it — inside a closed count that was itself wrong by
  > one. That is more claims, not fewer. What is true, and is the sentence that stands, is the
  > narrower one: **the fix stopped promising safety the code does not give**, which is the direction
  > that matters and is not the same as saying less. The unasserted half is unchanged — no test
  > poisons either lock, and after round 9 the paragraph names three unasserted escapes instead of
  > two.
- **The two count corrections are arithmetic over a hand-derived inventory.** Twelve-stating and
  three-pointing were derived by reading, exactly as fourteen and fifteen were, and nothing
  mechanically enforces any of them — the prose guards check that a claim of *their* families is
  inventoried, not that a count in this file is right. A later round re-deriving from the tree in
  front of it, as §15.2 now instructs, is the only thing that would catch a drift.
  *(recorded only.)*
- **R9 remains open, unmeasured and unbounded**, for the fourth round running. *(recorded only —
  no step of the 2d split owns building a bound for it, which is itself the residue.)*

## 18. Round 9 of the review, and the fix round that answered it

Round 9 ran on 2026-08-29 under **`/autoclaude-opus`**, as the corrective phase **2d-4a-D** that
§17.4's first item said the round-8 debt would become. Its reviewer was **the workflow's own
`autoclaude-reviewer` agent on `model: "opus"`, and not Codex** —
`docs/decisions/2d-4a-D-round-9-brief.md` records why in its own opening. `PROGRESS.md` had planned a
Codex round on the ground that Codex's usage window reopened at 19:07, but that plan belonged to
`/goahead-opus`; the workflow that actually ran this round is `/autoclaude-opus`, whose review step
names exactly one mechanism — one fresh `autoclaude-reviewer` on `model: "opus"` that did not write
the code — and using it was preferred over waiting fourteen minutes for another provider's window.
**Rounds 7, 8 and 9 are therefore three consecutive rounds with no second provider**, and that is a
coverage bound worth stating rather than a defect: no round of 2d-4a since round 6 has had a second
model's eyes on it, so a blind spot the adversarial-Opus reviewer shares with itself is invisible
across all three.

**Its verdict: `do-not-ship` — 2 High and 3 Medium**, every finding against the round-8 fix and
nothing else. The report is `docs/reviews/phase-2d-4a-round-9.md`, written by the reviewer itself.
**It is not reproduced into `docs/reviews/phase-2d-4a-queue.md`**, and that absence is a decision
rather than a skipped step: the queue exists to preserve replies that lived only in a transcript,
which is what rounds 1 to 6 were, and round 9's reply was a file from the moment it was written. A
short section at the end of the queue file says exactly that, so a later reader does not read the gap
as a round nobody filed.

**The sharpest fact about this round, said plainly.** Round 9's first High is that **the fix for
round 8's Medium replaced a false enforcement claim with a closed enumeration wrong by one** — and
the enumeration it got wrong is written out correctly **one file away**, in
`crates/espansoconfig-core/src/watch/retained_state.rs` clause 4 (`:100`), which says a stored queue
entry leaves in *exactly three* ways and names the overflow eviction as the second of them. It is
also written out correctly **in this record**, in round 5's correction block in this file's preamble,
which enumerates the same three clauses. The fix round wrote *two*. **Round 5 of this tail found the
same shape in this same file** — an enumeration
of the ways a stored entry leaves the queue that counted two where the code has three — and it is the
first instance `src-tauri/src/retained_state_contract.rs`'s own module header names when it says why
that module exists. So the tail's ninth round found its fifth round's defect, in the file that defect was
found in, written by the fix that answered its eighth.

**What round 9 confirmed rather than found is evidence too, and it is the larger part of the report.**
Its *Verified, not findings* section traces both of the escapes the round-8 fix had named and reports
both as holding: `after_sequence` is an unvalidated `u64` from the wire (`commands.rs:3491` →
`:1355` → `reconciliation.rs:1184`) and the retain at `:1187-1189` precedes the projection at
`:1191-1197`, so a caller's watermark really can prune the offending entry before this function is
reached; and `begin_epoch` at `:1029-1031` really does assign a whole fresh state. It also confirmed
the two cells of the `INVENTORY` entry the round-8 fix was most likely to have got wrong —
`count: 1` is right (`"things end"` occurs once in that file) and **local fact** is the right cell —
so the entry's defect was its `reason` alone. And it took *"no executable line changed"* apart
correctly rather than refusing it: true of the `reconciliation.rs` hunk, **false** of the `INVENTORY`
entry, and not a defect either way because §17 scopes the claim to round 7's fix. **Two Highs and
three Mediums are what survived a round that agreed with everything else it checked.**

### 18.1 Finding by finding

**The labels below are this record's, not the report's.** Round 9's report carries its three Mediums
as three bullets under one *"§17's record of its own scope"* heading rather than numbering them; they
are M1, M2 and M3 here so the correction blocks in §17 can name which finding each answers.

- **H1 (High) — the closed enumeration is wrong by one.** `reconciliation.rs:1491` read *"**Two
  things end that loop and neither is an enforcement this code performs**"* and then named the
  unvalidated watermark and `begin_epoch`. There is a third: `ReconciliationQueue::enqueue` evicts
  while `guard.pending.len() > QUEUE_CAPACITY` (`:1098-1104`, the constant at `:255`), taking the
  victim `evictable_sequence` (`:921-935`) selects — the lowest pending sequence of the path holding
  the most pending entries. `enqueue` takes this queue's lock through `PoisonError::into_inner`
  (`:1089`), exactly as `drain` (`:1185`) and `begin_epoch` (`:1030`) do, so eviction stays live after
  the panic the paragraph is about. **Agreed and fixed at four positions** — the doc paragraph; the
  `INVENTORY` `reason` that had inherited the count, which H2 rewrites for its own reason as well;
  and in this file §17.1's M1 bullet and §17.3's account of the guard firing. **What replaced it does
  not re-derive the count.** The paragraph names three escapes,
  states each one's condition — a caller's watermark, an overflow that selects *this* entry, a reopen
  — and then hands the closure of the list to clause 4, which is where *exactly three* is argued,
  where a fourth would have to be added, and which says in its own words that the figure rests on a
  reading of every mutation of the pending map rather than on anything that fails when a fifth
  mutation site appears. **The test that fails without it: none, and none is possible.** No test
  poisons either lock; the guard cannot see a miscount inside a sentence (see §18.4).
- **H2 (High) — the `INVENTORY` reason cited the wrong clause, and its own precedent said so.** The
  `("src-tauri/src/reconciliation.rs", "things end")` entry in
  `src-tauri/src/retained_state_contract.rs` recorded *"the **two** escapes"* — H1's miscount — and
  said the `begin_epoch` half *"cites **clause 6**'s consequence on one path"*. Clause 6
  (`retained_state.rs:119`) is *"Within the epoch a batch names, its `newest_sequence` never falls"*,
  and nothing in the M1 paragraph is about `newest_sequence`. What that half states is **clause 4's
  third way** — which the precedent the entry appeals to says outright, since that same `INVENTORY`'s
  `discards everything` entry **for `reconciliation.rs`** reads *"the third way a stored entry
  leaves"* and its twin for `retained_state.rs` reads *"the contract itself: clause 4's third way"*.
  The consequence is the
  one that matters for a check whose whole purpose is coupling: **a change to the clause the comment
  actually depends on traced to nothing.** Fixed by rewriting the `reason` — three escapes, each
  attributed to the code in `reconciliation.rs` that performs it, clause 4 named as the clause the
  `begin_epoch` half restates on one entry, and the closed count recorded as handed to clause 4 rather
  than derived beside the assertion. **`count: 1` and the `local fact` cell are unchanged**, both
  having been checked by round 9 and found right.
- **M1 (Medium) — §17.1 claimed the round-8 fix had one source change.** *"This is the round's only
  source change"* is contradicted by §17.2's two-file list and by §17.3's *"That entry is a second
  source change"*. The round-8 fix changed **two** source files, and that is the sentence that
  stands. Fixed by a round-9 correction block under §17.1's M1 bullet, which also carries H1.
- **M2 (Medium) — §17.4 understated the unreviewed change twice.** *"The unreviewed change is one
  comment hunk that removes a claim rather than adding one"* was written to size the corrective
  phase. It is two source files, not one hunk — the comment hunk **and** the `const` array item the
  bullet above it describes — and the hunk **adds** claims where it removed one, putting two factual
  assertions and a closed count in place of a single enforcement claim. Fixed by a correction block
  on that bullet. The block cites round 9's *net +30 lines* as the reviewer's figure and **does not
  adopt it as this file's own**, because rounds 7 and 8 share commit `125dfa8` and round 8's share of
  it cannot be isolated by `git`; what this fix round could derive — `git show --numstat` for the two
  rounds together, **+51 / −12** in `reconciliation.rs` and **+26 / −2** in
  `retained_state_contract.rs` — is recorded beside it.
- **M3 (Medium) — *"the fix made the paragraph say less"* is false of the diff it describes.** §17.4
  used it to conclude the fix was *"safe without a test"*. It traded one enforcement claim for two
  assertions nothing checks, inside a closed count that was itself wrong. Fixed by a correction block
  that keeps the narrower true sentence — **the fix stopped promising safety the code does not give**
  — and drops the inference from *less* to *safe*.

### 18.2 What this round changed, by file

Listed in full, this record and the review files included, for the reason §15.2 exists:

- `src-tauri/src/reconciliation.rs` — one comment hunk inside `address_of_minted`'s doc comment, H1.
- `src-tauri/src/retained_state_contract.rs` — one `INVENTORY` `reason` string, H2. The entry's
  `file`, `phrase` and `count` are untouched.
- `docs/decisions/2d-4a-notes.md` — this section, plus **four** round-9 correction blocks: one under
  §17.1's M1 bullet (H1 and M1), one under §17.3 (H1 and H2), and two in §17.4 (M2 and M3).
- `docs/reviews/phase-2d-4a-round-9.md` — new, written by the reviewer itself, **unmodified here**.
- `docs/reviews/phase-2d-4a-queue.md` — one short closing section recording that round 9 is filed and
  deliberately not reproduced.
- `docs/decisions/2d-4a-D-round-9-brief.md` — new at the dispatch, unmodified here.

**No frontend file changed**, so no `npm` gate was re-run by this fix round.

### 18.3 The gates after this round

Measured by this fix round on the tree it produced, each Cargo command run alone — a second Cargo
process on this machine makes the `watch_check::` gate false-fail on timeouts, which is why the
suite was run once, at the end, with nothing beside it.

- `cargo test --workspace` — **1313** passed / 0 failed over **26** result lines, exit 0. Unchanged
  from §17.3, as it must be: this fix round added no test and removed none, and the two source
  changes are a doc comment and one `&'static str` inside an existing `INVENTORY` entry.
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `cargo doc --workspace --no-deps` — exit 0, **73** `private_intra_doc_links` warnings and 0
  unresolved, unchanged. Run because H1's paragraph added three intra-doc links
  (`ReconciliationQueue::enqueue`, `QUEUE_CAPACITY`, `evictable_sequence`); none is unresolved and
  none moved the count, `address_of_minted` being private and therefore undocumented by this
  invocation.

  > **Correction, round 10 (L1).** *"three intra-doc links"* is **four**. The hunk's added lines
  > carry `ReconciliationQueue::enqueue`, `QUEUE_CAPACITY`, `evictable_sequence` **and**
  > `espansoconfig_core::watch::retained_state`, the last being the only one that has to resolve
  > across the crate boundary and therefore the one the `cargo doc` run was most worth doing for.
  > `ReconciliationQueue::begin_epoch` is not among the four: it was already a link in the text the
  > hunk replaced. **Round 10's own fix moves the figure again**, so it is stated here of the
  > paragraph as it now stands: the four newly linked targets are unchanged, and
  > `espansoconfig_core::watch::retained_state` appears **twice** — once in the eviction sentence's
  > pointer to clause 5, once in the hand-off of the closed count to clause 4 — so the paragraph
  > holds **five link occurrences over those four targets**.

  > **Correction, round 11 (L1).** The sentence above says it states the figure *"of the paragraph
  > as it now stands"* and then gives the figure of the **four targets the round-9 hunk added**,
  > which is a subset. The paragraph as it stands holds **six link occurrences over five distinct
  > targets** — `ReconciliationQueue::enqueue`, `QUEUE_CAPACITY`, `evictable_sequence`,
  > `ReconciliationQueue::begin_epoch` and `espansoconfig_core::watch::retained_state` twice —
  > because `begin_epoch` is a link *in the paragraph* even though the hunk did not add it. §19.3
  > says six over five and is right; the two figures were never in conflict about the arithmetic,
  > only about what *"the paragraph"* names. Both numbers are re-derived here by listing every
  > `` [`…`] `` in the doc comment rather than by re-reading either claim.

  > **Correction, round 12 (a Medium).** *"in the doc comment"* is wrong, and it is **the same
  > defect this block exists to correct** — a figure derived over one span and labelled with
  > another. What was listed is the **paragraph**, `reconciliation.rs:1481-1522`, which gives the
  > six-over-five above. `address_of_minted`'s **doc comment** runs from `:1425` and gives **13
  > occurrences over 10 targets**: the five above plus [`address_of`], [`ObservedDocument`],
  > [`ObservedDocument::Named`] twice, [`ObservedDocument::Addressable`],
  > [`ReconciliationQueue::drain`] and a **third** [`espansoconfig_core::watch::retained_state`].
  > Six-over-five stands for the paragraph and is what §19.3 and the block above both mean; only the
  > span's name was wrong. Both figures here are round 12's own count, re-derived by this fix round
  > over both spans.

**No inventoried count moved.** Both prose guards were re-derived by hand before the suite ran, with
a Python replica of `prose_sweep::prose_units` and `prose_sweep::sweep` over both swept trees: 88
retained-state phrases against 141 inventory entries and 61 liveness phrases against 86, every
`(file, phrase)` count in agreement. That replica is evidence about the tree and **not** a
substitute for the guard — `cargo test --workspace` is what proves it, and the replica exists so that
a fix round writing into a swept file finds out what it moved before the suite tells it. It matters
here because `retained_state_contract.rs` is skipped by its own sweep but **is** swept by the liveness
guard, so H2's rewritten `reason` is prose a check reads.

### 18.4 What this round did not do, and where it is thin

Per `CLAUDE.md` §7.3 every item carries a mark. An **actionable** item naming a correctness defect in
a source file is a blocker that stops this step closing; none below is one.

- **Round 10 is commissioned by §7.1 and cannot run here, so 2d-4a-D is superseded by 2d-4a-E and is
  never complete.** This fix round changed two source files — `reconciliation.rs` and
  `retained_state_contract.rs` — so §7.1 owes it a round, scoped to that fix.
  `~/.claude/scripts/autoclaude-base.md` allows **exactly one adversarial review per phase** and
  states there is *no re-review in the same phase*; 2d-4a-D spent its one invocation on round 9. Under
  `CLAUDE.md` §7.4 that debt is **carried, not written off**: it becomes the corrective phase
  **2d-4a-E**, with its own acceptance criteria, its own commit and its own mandatory review, exactly
  as 2d-4a-D itself was recorded — and the workflow's own words are that the original phase is marked
  *superseded, never as complete*. *(actionable — it names work in files that exist and no defect in
  source; it is a workflow outcome, and `PROGRESS.md` carries it as the next action.)*
- **Neither High could have been caught by the guard that demanded the entry, and that is a property
  of the guard rather than a gap in it.** Its key is `(file, phrase)`: the round-8 comment held
  `"things end"` once, this fix round's rewrite holds it once, and a count that is wrong *inside* the
  sentence moves nothing. The module header already says as much — it catches an unmarked or a new
  claim and *cannot judge whether a passage's claim is true*. What the guard did was force a
  **judgement**, and the judgement then inherited the comment's error, which is the failure mode a
  human round exists for. *(recorded only.)*
- **Three consecutive rounds with no second provider.** Rounds 1–6 were Codex; 7, 8 and 9 were
  adversarial Opus agents. Each was cold and each re-derived rather than accepted — round 9 traced
  `enqueue`, `evictable_sequence` and both clauses itself — but a systematic blind spot shared by all
  three is invisible from inside them. 2d-4a-E is the first opportunity to break the run.
  *(recorded only — the substitution is the workflow's prescribed behaviour, not a shortcut taken
  here.)*
- **The rewritten paragraph is still asserted by nothing, and now names three unasserted escapes
  instead of two.** No test poisons either lock; no test drives a watermark at or above an offending
  entry's sequence; and no test connects an overflow eviction to this assertion, although the
  capacity bound itself is exercised. The paragraph says so about itself, as it did before.
  *(recorded only.)*
- **A round's fix cannot be measured after the fact when it shares a commit.** Rounds 7 and 8 both
  landed in `125dfa8`, which is why round 9 could not isolate round 8's hunk with `git diff`, why it
  had to take the pre-fix wording from this record, and why §17.4's M2 correction records the two
  rounds' combined `--numstat` instead of adopting a figure it cannot re-derive. Nothing is wrong in
  the tree; what is thin is the record's ability to answer *how large was that round's fix*.
  *(recorded only.)*
- **R9 remains open, unmeasured and unbounded**, and nothing in this round touched it. **The
  consecutive-round ordinal is deliberately not carried forward**: §16.4 calls round 7 *"a fourth
  consecutive round"* and §17.4 calls round 8 *"the fourth round running"*, so the two disagree by one
  and this round declines to add a third figure to a sequence it would have to guess at. The
  substance is unchanged — no count, no cap, no eviction rule. *(recorded only — no step of the 2d
  split owns building a bound for it, which is itself the residue.)*

## 19. Round 10 of the review, and the fix round that answered it

Round 10 ran on 2026-08-29 under **`/autoclaude-opus`**, as the corrective phase **2d-4a-E** that
§18.4's first item said the round-9 debt would become. Its reviewer was a fresh **`autoclaude-reviewer`
on `model: "opus"`** that did not write the code, dispatched with
`docs/decisions/2d-4a-E-round-10-brief.md`, which is kept so the round can be audited against what it
was actually asked. **It is the fourth consecutive Opus round**: rounds 1 to 6 went to Codex, and 7, 8
and 9 were adversarial Opus agents. That is a **coverage bound and not a defect**, and the brief said
so in its own opening rather than leaving it implicit, because the bound cannot be discharged from
inside the round it describes — a prior the last four share is invisible to all four. What the brief
could do about it, it did: it told this round that **rounds 8 and 9 each found a defect in the fix
that answered the round before them**, both times in prose the previous round had just read, and
asked it to look hardest exactly where an Opus reviewer would nod. §19.4 restates the bound rather
than closing it.

**Its verdict: `ship-with-fixes` — 0 High, 2 Medium and 2 Low**, every finding against the round-9 fix
and nothing else. The report is `docs/reviews/phase-2d-4a-round-10.md`, written by the reviewer
itself. **It is not reproduced into `docs/reviews/phase-2d-4a-queue.md`**, for the reason §18 gives
and that file's own closing section states: the queue exists to preserve replies that lived only in a
transcript, which is what rounds 1 to 6 were, and this reply was a file from the moment it was
written.

**The substantive result of round 10 is what it cleared, and that is larger than what it found.**
Round 9's two Highs were both about the same paragraph, and a fix round is the worst possible judge of
its own replacement. Round 10 re-derived all three of the claims that fix rests on, from the code and
not from the record:

- **The three-escape enumeration is right at three**, established the only way it can be — by
  enumerating every mutation of `QueueState::pending` rather than by reading the paragraph. There are
  **four** mutation sites in `src-tauri/src/reconciliation.rs`: the insert at `:1097`, the eviction
  loop at `:1098-1104`, `drain`'s retain at `:1187-1189` and `begin_epoch`'s whole-state assignment at
  `:1030`. The insert is not an exit, and each of the other three removes the offending entry and
  either precedes or avoids the projection loop at `:1191-1197` that reaches `address_of_minted`.
  **No fourth way was found, and no member of the three fails to be an escape** — which was the other
  way a three-item list could have been wrong, and the brief asked for both directions.
- **"as every lock in this module does" is true of every lock in this module.** All eight `.lock()`
  calls in the file — `:951`, `:991`, `:1030`, `:1089`, `:1128`, `:1185`, `:1225`, `:1235` — go
  through `PoisonError::into_inner`, and so does the session lock at `src-tauri/src/commands.rs:1459`.
- **"No `INVENTORY` count moved" holds by an independent count.** Round 10 counted all **88**
  `RETAINED_STATE_SHAPES` phrases and all **61** `LIVENESS_SHAPES` phrases over both changed files at
  `6572a29^` and at `6572a29`, raw and again with comment markers stripped and whitespace collapsed.
  **Zero counts moved**, in either direction.

It also took §18.4's argument that neither High could have been caught by the guard — the key is
`(file, phrase)`, so a count wrong *inside* a sentence moves nothing — and confirmed it holds for
**both** Highs, H2 included: a wrong clause cited *inside* a `reason` is not part of that key either.
**So round 9's two Highs are closed by an independent round rather than by their own fix**, which is
the thing a fix round cannot do for itself and the reason §7.1 commissions rounds at all.

**What that re-derivation does not cover, in the reviewer's own terms.** Its replica is substring
counting and **not** `prose_sweep::prose_units`, so it cannot see unit segmentation, doc-attribute
prose or the sweeping of non-comment strings; it shows no count moved in the two changed files, and it
is not the guard. No `cargo` or `npm` gate was run by the round at all — the brief forbade it, so
every figure in §18.3 is the fix round's and none is the reviewer's.

**The trajectory of this tail, plainly, since the counts are the only thing that says whether it is
converging.** Round 7: 0 High, 1 Medium, 4 Low. Round 8: 0 High, 1 Medium, 2 Low. Round 9:
**2 High**, 3 Medium. Round 10: 0 High, 2 Medium, 2 Low. Round 9 is the spike, and its two Highs were
both **created by round 8's fix** — the enumeration wrong by one, and the `INVENTORY` `reason` written
to satisfy the guard that demanded it. Round 10 finds no High in the fix that answered them, and
**both of its Mediums are about citation discipline in a comment rather than about what the code
does**: neither says the paragraph is false, both say it paraphrases a contract it should be pointing
at. *(A framing offered to this fix round — that round 10 is the first round since round 4 of the
2d-4a-C tail to return no High — is **not** recorded, because it does not survive checking: rounds 7
and 8 of this same tail each returned 0 High, and 2d-4a-C's own round 3 returned 0 High before its
round 4 returned no findings at all. What is true is the narrower sentence above.)*

### 19.1 Finding by finding

Round 10's report numbers nothing; the labels below are this record's, in the report's own order.

- **M1 (Medium) — the eviction sentence paraphrased clause 5 and cited no clause.** The paragraph read
  *"the victim is the lowest pending sequence of the path holding the most, so it is that path's
  oldest pending entry that goes and not whichever one this assertion trips over."* That is right
  about the untied case and **silent about the tie-break**: `evictable_sequence` (`:933`) is
  `min_by_key(|(count, lowest)| (std::cmp::Reverse(*count), *lowest))`, so among paths tied for *most*
  pending entries the one with the **lower lowest sequence** wins.
  `crates/espansoconfig-core/src/watch/retained_state.rs` clause 5 already states the whole rule,
  tie-break included (`:112-118`). **Agreed, and fixed as `retained_state.rs:55-61` prescribes rather
  than by bolting the tie-break on as a third clause of the same paraphrase**, which would have left the
  paraphrase surface one sentence longer: the sentence now points at
  `espansoconfig_core::watch::retained_state`'s clause 5 for the selection rule and keeps beside it
  only the fact this passage needs — that the victim is named by a rule about paths and their pending
  counts, and so is *never whichever entry this assertion trips over*. `evictable_sequence`'s own doc
  comment states the same whole rule in the same words (`:886-888`) and is still linked from the
  sentence, so a reader has both the contract and the implementation one hop away.
- **M2 (Medium) — the hand-off to clause 4 restated the clause it handed the count to.** *"That the
  list is closed at three is clause 4's claim rather than this paragraph's"* is exactly the
  discipline; the sentence then **restated clause 4's methodological caveat beside it** — that
  *exactly three* rests on a reading of every mutation of the pending map rather than on anything that
  fails when a fifth mutation site appears. That is a fact about the clause and not about this
  passage, so it is precisely what `retained_state.rs:59-61` says a pointer must not carry: a change
  to clause 4's wording would leave a stale copy here that no guard sees, *mutation site* being in
  neither phrase family. **Agreed, and the restatement is removed.** What is kept is the pointer and
  the shape of what is at the other end — clause 4 is where a stored entry's exits are enumerated,
  where what that count rests on is stated, and where a fourth would have to be added. **Nothing local
  was judged to need saving**: the paragraph's own honesty about not being asserted by anything is the
  sentence immediately after, and it was already there.
- **L1 (Low) — "added three intra-doc links" is four.** §18.3's `cargo doc` bullet. Fixed by a
  round-10 correction block under that bullet, and the count was **re-derived from `git show 6572a29
  -- src-tauri/src/reconciliation.rs`** rather than taken on trust: the hunk's added lines carry
  `ReconciliationQueue::enqueue`, `QUEUE_CAPACITY`, `evictable_sequence` **and**
  `espansoconfig_core::watch::retained_state`, the last being the only one that must resolve across
  the crate boundary; `ReconciliationQueue::begin_epoch` was already a link in the text the hunk
  replaced and is not one of the four. The block also states the figure **of the paragraph as it now
  stands**, because M1 moved it again: four targets still, five occurrences, the cross-crate link
  appearing twice. Record only.
- **L2 (Low) — the precedent claim in the `INVENTORY` `reason` is overstated. Considered and
  declined.** The entry at `src-tauri/src/retained_state_contract.rs:1089` says its three escapes each
  name clause 4's corresponding way *"exactly as this file's `discards everything` entry does for the
  third"*, and that precedent entry (`:1005`) reads *"local fact: `ReconciliationQueue::begin_epoch`'s
  own summary — the third way a stored entry leaves"* — which never spells *clause 4*. The reviewer
  raised it and judged it not worth a source edit, the form being the same; this fix round agrees, and
  the reason is stated rather than inherited. **The claim is about the form, and the form matches
  exactly**: name the corresponding way as it lands on one entry, do not restate the clause. *"The
  third way a stored entry leaves"* names clause 4's third way by its ordinal, in clause 4's own
  words: that clause opens *"A stored queue entry leaves in exactly three ways"*
  (`retained_state.rs:100`), and this same `INVENTORY`'s twin entry for `retained_state.rs` reads
  *"the contract itself: clause 4's third way"* (`:525`). So a reader who follows the precedent finds
  the discipline the claim describes and nothing that contradicts it. **The test the
  brief set is what a later reader would get wrong, and there is no answer to it**: the worst
  available misreading is expecting the literal string *clause 4* at `:1005` and not finding it, from
  which nothing follows and no edit is licensed. Against that, the edit has a cost this phase is
  specifically trying to avoid — it would add explanatory prose to a `reason` cell that is one line by
  convention, in the file whose whole subject this round is, to disclaim a difference that changes no
  judgement. **Note that declining bought nothing procedurally**: M1 and M2 are already in source, so
  round 11 is commissioned either way, and neither *it would commission a round* nor *it would not add
  one* was an input to this decision. The finding stays in the tree, in round 10's report and here, so
  a later round is free to raise it again.

**One check the fix round owed itself, since M2 removes prose from a swept file.** The `reason` at
`:1089` claims the passage names clause 4's ways *"rather than restating the clause"*. It was re-read
against the edited comment and is **still true, and more nearly true than before** — M2 removed the
one restatement it could have been read against. `retained_state_contract.rs` is therefore
**unchanged by this fix round**.

> **Correction, round 11 (the Medium).** That check was run against **M2 and not against M1**, and
> the paragraph above does not say so. The `reason` at `:1089` makes a second claim the check never
> reached: that the second escape is *"an overflow evicting **it** inside the enqueue"* — **it**
> being the offending entry. M1's rewritten sentence then said the victim is *"never whichever entry
> this assertion trips over"*, which denies exactly that. So the fix round left the comment and the
> `INVENTORY` `reason` **contradicting each other**, and reported the `reason` as *more nearly true
> than before* on the strength of a reading that only covered the restatement clause. Round 11 found
> it as a High; §20.1 is the finding and the repair. What survives of the paragraph above is
> narrower and is stated as such: the *"rather than restating the clause"* half was true of the
> edited comment and still is, and `retained_state_contract.rs` was indeed left unchanged — but
> *unchanged* was the wrong outcome to be reassured by, because the file the `reason` describes had
> moved out from under it.

### 19.2 What this round changed, by file

Listed in full, this record and the review files included, for the reason §15.2 exists:

- `src-tauri/src/reconciliation.rs` — two edits inside `address_of_minted`'s doc comment, M1 and M2,
  plus the re-wrap of the sentence M2 shortened. **+9 / −9 by `git diff --numstat`, and every added
  and removed line begins `///`** — checked by filtering the `-U0` diff for lines that do not, which
  found none. No executable line changed.
- `src-tauri/src/retained_state_contract.rs` — **unchanged**, deliberately: L2 was declined and the
  `("src-tauri/src/reconciliation.rs", "things end")` `reason` stays true of the edited comment.
- `docs/decisions/2d-4a-notes.md` — this section, plus **one** round-10 correction block under §18.3
  (L1).
- `docs/reviews/phase-2d-4a-round-10.md` — new, written by the reviewer itself, **unmodified here**.
- `docs/decisions/2d-4a-E-round-10-brief.md` — new at the dispatch, unmodified here.

**No frontend file changed**, so no `npm` gate was re-run by this fix round.

### 19.3 The gates after this round

Measured by this fix round on the tree it produced, each Cargo command issued separately with nothing
else running — a second Cargo process on this machine makes the `watch_check::` gate false-fail on
timeouts.

- `cargo test --workspace` — **1313** passed / 0 failed over **26** `test result: ok` lines, exit 0.
  Unchanged from §18.3, as it must be: this fix round added no test and removed none, and its only
  source change is a doc comment.
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `cargo doc --workspace --no-deps` — exit 0, **73** `private_intra_doc_links` warnings and **0**
  unresolved, unchanged. Run because M1 adds a **second** occurrence of the cross-crate link
  `espansoconfig_core::watch::retained_state`, taking the paragraph to six link occurrences over five
  distinct targets; `src-tauri/src/reconciliation.rs` was `touch`ed first so the link was re-resolved
  rather than served from the previous build's cache, and the `espansoconfig` crate's own doc build
  emitted no warning of any kind — all 73 come from `espansoconfig-core`.

**No inventoried count moved, in either direction.** M2 **removes** prose from a swept file as well
as adding it, so the count could have fallen as easily as risen. Both phrase families were extracted
from their own contract modules — **88** retained-state phrases and **61** liveness phrases, which is
the arithmetic that says the extraction is right — and counted over both files this round could
change, `reconciliation.rs` and `retained_state_contract.rs`, before and after the edits, through a
replica of `prose_sweep::prose_units` and of `sweep`'s non-overlapping lowercased substring walk.
**Every one of the 298 `(file, phrase)` pairs — two files by 149 phrases — has the identical count
before and after.** In `reconciliation.rs` the phrases that actually occur are 27 retained-state ones
at 49 occurrences and 2 liveness ones at 2; `retained_state_contract.rs` was not edited and its
liveness hits are zero either way. That replica is evidence about the tree and **not** the guard;
`cargo test --workspace` above is what proves it, and
the replica exists so a fix round writing into a swept file learns what it moved before the suite
tells it.

### 19.4 What this round did not do, and where it is thin

Per `CLAUDE.md` §7.3 every item carries a mark. An **actionable** item naming a correctness defect in
a source file is a blocker that stops this step closing; none below is one.

- **Round 11 is commissioned by §7.1 and cannot run here, so 2d-4a-E is superseded by 2d-4a-F and is
  never complete.** M1 and M2 both changed `src-tauri/src/reconciliation.rs`, and under §7.1 the unit
  is the file and a comment-only change counts, so that fix is owed a round scoped to it.
  `~/.claude/scripts/autoclaude-base.md` states in as many words that there is **no re-review in the
  same phase**, and 2d-4a-E spent its one invocation on round 10, so under `CLAUDE.md` §7.4 the debt
  is **carried, not written off**: it becomes the corrective phase **2d-4a-F**, with its own
  acceptance criteria, its own commit and its own mandatory review — and that same rule is where
  *superseded, never as complete* is written. **Round 11's scope is two comment edits in one file** —
  narrower than round 10's, which was two source hunks plus §18's four subsections and the four
  correction blocks the round-9 fix wrote into §17 — so the likely
  shape is a round that finds record defects or nothing, whose fix changes no source file, and **the
  tail then ends there under §7.2**. That is the ending §7 predicts rather than a hope: a tail stops
  at the first fix round that stops touching source. *(actionable — it names work in files that exist
  and no defect in source; it is a workflow outcome, and `PROGRESS.md` carries it as the next
  action.)*
- **Four consecutive rounds with no second provider.** Rounds 1–6 were Codex; 7, 8, 9 and 10 were
  adversarial Opus agents. Round 10 was cold and re-derived rather than accepted — the mutation
  sites, the eight locks and both phrase families are its own counts — but a systematic blind spot
  shared by all four is invisible from inside them, and round 10 was *told* about the run without that
  making it able to see past it. 2d-4a-F is the next opportunity to break it. *(recorded only — the
  substitution is `/autoclaude-opus`'s prescribed behaviour, which names exactly one review mechanism,
  and not a shortcut taken here.)*
- **Neither replica of the prose sweep is the guard, and this fix round's is narrower than it looks.**
  It reimplements `prose_units` and `sweep`'s counting, but it walks **two files** rather than the two
  trees `SWEPT_TREES` names, and it compares counts to each other rather than to `INVENTORY` through
  `complaints_against`. That is sound only because this fix round changed exactly those two files —
  one of them not at all — and it would be worthless for a round that touched anything else. The
  guards themselves are what `cargo test --workspace` runs. *(recorded only.)*
- **A pointer's target is checked for existence and not for content, and this round leans on that
  harder.** `rustdoc::broken_intra_doc_links` is denied in both crates, so deleting or renaming
  `retained_state` breaks the build — but *clause 4* and *clause 5* are ordinals in a hand-numbered
  list, and inserting a clause renumbers every citation of it in this workspace with nothing failing.
  M1 turns a paraphrase of clause 5 into a citation of it, and M2 deletes the copy of clause 4's
  caveat that a rewording of that clause would otherwise have left standing here. Both are strictly
  better than what they replace — a stale paraphrase can *contradict* its source, where a stale
  ordinal only misdirects — and neither is free. *(recorded only — no test can hold an ordinal, and
  the alternative is the restatement M2 just removed.)*
- **The rewritten paragraph is still asserted by nothing.** No test poisons either lock, no test
  drives a watermark at or above an offending entry's sequence, and no test connects an overflow
  eviction to this assertion, though the capacity bound itself is exercised. The paragraph says so
  about itself, as it did before this round and before round 9's. *(recorded only.)*
- **L2 was declined, and a declined finding is not a closed one.** The precedent claim at
  `retained_state_contract.rs:1089` stands as written; the argument for leaving it is §19.1's and it
  is recorded there in full precisely so a later round can disagree with it rather than rediscover it.
  *(actionable — it names a wording in a source file, so it is not *recorded only* under §7.3's
  reading. It is **not a blocker**: the wording is an overstated precedent and not a correctness
  defect, the judgement the entry records being unaffected either way, so a later phase may adopt it
  and this step closes without it.)*
- **`docs/reviews/phase-2d-4a-queue.md` carries no round-10 section**, where it carries one for round
  9. This fix round's file scope was fixed at three files by its brief, and the queue is not one of
  them. The policy the round-9 section states covers this round identically — a reviewer-written
  report is not copied into a file that exists to rescue transcript-only replies — so what is missing
  is a signpost and not a record. *(actionable — it names an absence in a file that exists and a fix
  of one paragraph; not a blocker, because the file it names is the record and not source.)*
- **R9 remains open, unmeasured and unbounded**, and nothing in this round touched it: no count, no
  cap, no eviction rule for the identity register. *(recorded only — no step of the 2d split owns
  building a bound for it, which is itself the residue.)*

## 20. Round 11 of the review, and the fix round that answered it

Round 11 ran on 2026-08-29 under **`/autoclaude-opus`**, as the corrective phase **2d-4a-F** that
§19.4's first item said the round-10 debt would become. Its reviewer was a fresh
**`autoclaude-reviewer` on `model: "opus"`** that did not write the code, dispatched with
`docs/decisions/2d-4a-F-round-11-brief.md`, which is kept so the round can be audited against what it
was actually asked. **It is the fifth consecutive Opus round**: rounds 1 to 6 went to Codex, and 7 to
10 were adversarial Opus agents. That remains a **coverage bound and not a defect**, and this brief
said so in its own opening as round 10's did, sharpened by one fact the previous brief could not yet
carry — **rounds 8, 9 and 10 had each found a defect in the fix that answered the round before them**,
every time in prose the previous round had just read. §20.4 restates the bound rather than closing it.

**Its verdict: `do-not-ship` — 1 High, 1 Medium and 1 Low**, every finding against the round-10 fix
and nothing else. The report is `docs/reviews/phase-2d-4a-round-11.md`, written by the reviewer
itself, and it is **not reproduced into `docs/reviews/phase-2d-4a-queue.md`** for the reason §18 and
§19 both give.

**§19.4 predicted this tail would end here, and it did not.** That prediction was stated as a
prediction and not as a permission — *"if round 11 finds a real defect in source, its fix commissions
round 12 and the tail is doing its job"* — and that is what happened. **The prediction being wrong is
the mechanism working**, not a failure of it: §7.1 reads a diff and nothing else, and a round that
finds a real source defect is exactly the case §7.2 says the rule is deliberately not changed to stop.

**What round 11 cleared is again larger than what it found, and it cleared the two things round 10's
fix rests on.** Every item below is the reviewer's own derivation from the code, not a reading of the
record:

- **M1's pointer is accurate.** `retained_state.rs` clause 5 (`:112-118`) states the victim rule
  **whole, tie-break included**, and matches `evictable_sequence` exactly. So *"stated whole as …
  clause 5"* is true, and the paraphrase M1 removed lost nothing by being removed.
- **M2's deletion kept nothing local.** Clause 4 (`:100-107`) satisfies all three surviving claims
  made about it — that it enumerates a stored entry's exits, that it states **what that count rests
  on**, and that it is where a fourth would have to be added. The middle one is the residue of the
  caveat M2 deleted, and it is true of clause 4.
- **The header quotes are correct** at `retained_state.rs:55-61` and `:59-61`, including the *"has
  bought nothing"* reasoning both edits were justified by.
- **L2's declined argument holds.** `retained_state_contract.rs:1005` names clause 4's third way by
  its ordinal in clause 4's own words, and the twin entry at `:525` is the precedent §19.1 cited. The
  round that was invited to disagree with §19.1 read it and agreed; **it stays declined, now on two
  rounds' reading rather than one.**
- **`+9 / −9`, every changed line beginning `///`, and `retained_state_contract.rs` unchanged** —
  all three verified from `22d1afb` itself.
- **No phrase of either family** appears in the added prose or vanishes from the removed prose.

### 20.1 Finding by finding

Round 11's report numbers nothing; the labels below are this record's, in the report's own order.

- **H1 (High) — `src-tauri/src/reconciliation.rs:1503`: M1's surviving clause contradicted the rest
  of its own paragraph.** The sentence read *"the victim is whatever that rule names and **never**
  whichever entry this assertion trips over"*. Three things in the same file say otherwise. The
  sentence's **own condition**, four lines above, is *"costs the offending entry its place **when**
  [`evictable_sequence`] **picks it**"*. The paragraph's **own summary**, four lines below, names what
  this escape waits on as *"an overflow that **selects this entry**"*. And the `INVENTORY` `reason` at
  `retained_state_contract.rs:1089` describes the second escape as *"an overflow evicting **it**
  inside the enqueue"*. `evictable_sequence` (`:921-935`,
  `min_by_key(|(count, lowest)| (Reverse(*count), *lowest))`) is **blind to which entry tripped the
  assertion**, and the offending entry is an ordinary pending entry: when its path holds the most
  pending entries and it is that path's lowest sequence, **the rule names it** — and that is the only
  state in which escape 2 is an escape at all. So on the literal reading of *never* the escape can
  never fire, the list closed at three has two members, and this is **round 9's defect reached from
  the other side**: an enumeration wrong by one, arrived at by disabling a member rather than by
  omitting one. **Agreed, and fixed in source.** The intended reading — *the rule never selects an
  entry **because** it tripped the assertion* — is the true claim, and the sentence now makes it in
  those terms: clause 5 *"does not know this assertion exists"*, the offending entry *"goes when the
  rule happens to name it, never because it is the entry that trips here, so this escape waits on a
  state it cannot bring about."* **The word *never* is kept and moved onto the reason**, which is what
  it was always true of; the summary four lines below and the `reason` at `:1089` are now both
  consistent with it. **The pre-M1 text carried the same shape with *not*** — so this defect is older
  than M1 — but M1 deliberately kept and strengthened that clause while rewriting everything around
  it, and §19.1 says in as many words that it *"keeps beside it only the fact this passage needs"*, so
  it is this fix's and in this round's scope.
- **The Medium — `docs/decisions/2d-4a-notes.md` §19.1's closing paragraph checked M2 and not M1.**
  That paragraph says the `reason` at `:1089` was re-read against the edited comment and is *"still
  true, and more nearly true than before"*. It is right about the *"rather than restating the clause"*
  half, which is M2's; it never reached the `reason`'s **other** claim, that the second escape is *"an
  overflow evicting **it** inside the enqueue"* — which is precisely what M1's *never* denied. **So
  the fix round left the comment and the `INVENTORY` `reason` contradicting each other and reported
  the `reason` as more nearly true than before.** Fixed by a round-11 correction block under that
  paragraph, which states what survives of the check and names *unchanged* as the wrong outcome to
  have been reassured by. **Record only.**
- **The Low — §18.3's round-10 correction block counts a subset and labels it the paragraph.** It
  says it states the figure *"of the paragraph as it now stands"* and gives **five occurrences over
  four targets**, which is the figure of the four targets the round-9 hunk **added**;
  `ReconciliationQueue::begin_epoch` is a link *in the paragraph* that the hunk did not add. The
  paragraph holds **six occurrences over five targets**, which is what §19.3 says. Fixed by a
  round-11 correction block under the round-10 one, with both figures re-derived by listing every
  `` [`…`] `` in the doc comment. **Record only.** *(This orchestrator had derived the same six-over-
  five independently before the round was dispatched, from `sed | rg -o | sort | uniq -c` over the
  paragraph; the brief therefore asked which figure was wrong without saying which, and the round
  answered it from its own count.)*

### 20.2 What this round changed, by file

Listed in full, this record and the review files included, for the reason §15.2 exists:

- `src-tauri/src/reconciliation.rs` — one edit inside `address_of_minted`'s doc comment, H1. **+4 /
  −3 by `git diff --numstat`, and every added and removed line begins `///`.** No executable line
  changed. The link set is untouched: the sentence carried one
  `` [`espansoconfig_core::watch::retained_state`] `` before and carries one after, so the paragraph
  is still **six occurrences over five targets**.
- `src-tauri/src/retained_state_contract.rs` — **unchanged**. H1's repair moves the comment *onto*
  the `reason`'s claim rather than the other way round, so the entry at `:1089` needed nothing; L2
  stays declined.
- `docs/decisions/2d-4a-notes.md` — this section, plus **two** round-11 correction blocks: one under
  §19.1's closing paragraph (the Medium) and one under §18.3's round-10 block (the Low).
- `docs/reviews/phase-2d-4a-round-11.md` — new, written by the reviewer itself, **unmodified here**.
- `docs/decisions/2d-4a-F-round-11-brief.md` — new at the dispatch, unmodified here.
- `PROGRESS.md` — the checkpoint, plus one repair unrelated to this round: an **orphaned fragment**
  (`verbatim** at [docs/progress-archive/phase-2d.md]…`) left mid-file by an earlier archive edit,
  sitting between the round-9 paragraph and the Phase M2 heading and swallowing the blank line that
  heading needed. Removed. It is named here because it is the mechanical scar `CLAUDE.md` warns about
  — an edit script that asserted through several replacements and left a partial write behind.

**No frontend file changed**, so no `npm` gate was re-run by this fix round; the three frontend
figures in §20.3 are this iteration's own measurement, taken before the round was dispatched.

### 20.3 The gates after this round

Measured by this fix round on the tree it produced, each Cargo command issued separately with nothing
else running — a second Cargo process on this machine makes the `watch_check::` gate false-fail on
timeouts. **Every Cargo gate was redirected to a file and never piped**, so the status reported is
Cargo's own and not `tail`'s; `PROGRESS.md`'s verification baseline records why that distinction once
hid ten failures.

- `cargo test --workspace` — **1313** passed / 0 failed over **26** `test result: ok` lines, exit 0. Unchanged from §19.3, as it must be: this fix round added no test and removed none, and its only source change is one sentence of a doc comment. **This is what proves no inventoried count moved**, both prose guards running inside it.
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `cargo doc --workspace --no-deps` — exit 0, **73** warnings and **0** unresolved, unchanged — all 73 are `private_intra_doc_links` from `espansoconfig-core`, counted as *links to private item* lines rather than read off the summary alone. `src-tauri/src/reconciliation.rs` was `touch`ed first so the paragraph's links were re-resolved rather than served from the previous build's cache. The link set did not change: the edited sentence carried one `` [`espansoconfig_core::watch::retained_state`] `` before and carries one after, so the paragraph is still six occurrences over five targets.
- `cargo tree -p espansoconfig-core | rg tauri` — empty — the core crate still pulls in no `tauri` (D2x).

**No inventoried count moved.** Checked **before** the edit was applied rather than after, by
extracting both phrase families from their own contract modules — **88** retained-state phrases and
**61** liveness phrases, the arithmetic that says the extraction is right — and counting every one of
the 149 against the exact prose this edit removes and the exact prose it adds, lowercased and with
whitespace collapsed. **No phrase occurs in either**, so no `(file, phrase)` count can have moved in
either direction. That is a narrower replica than §19.3's and it is stated as narrower: it walks two
strings rather than the two trees `SWEPT_TREES` names, and it is sound only because this edit touches
nothing else. `cargo test --workspace` above is what proves it.

### 20.4 What this round did not do, and where it is thin

Per `CLAUDE.md` §7.3 every item carries a mark. An **actionable** item naming a correctness defect in
a source file is a blocker that stops this step closing; none below is one.

- **Round 12 is commissioned by §7.1 and cannot run here, so 2d-4a-F is superseded by 2d-4a-G and is
  never complete.** H1's fix changed `src-tauri/src/reconciliation.rs`, and under §7.1 the unit is the
  file and a comment-only change counts. `~/.claude/scripts/autoclaude-base.md` states in as many
  words that there is **no re-review in the same phase**, and 2d-4a-F spent its one invocation on
  round 11, so under §7.4 the debt is **carried, not written off**: it becomes the corrective phase
  **2d-4a-G**, with its own acceptance criteria, its own commit and its own mandatory review.
  **Round 12's scope is one comment edit in one file**, plus §20 and the two round-11 correction
  blocks. *(actionable — it names work in files that exist and no defect in source; it is a workflow
  outcome, and `PROGRESS.md` carries it as the next action.)*
- **§19.4's prediction that the tail would end at round 11 was wrong, and no prediction of that shape
  is made here.** What §7.2 guarantees is the shape and not the stopping point: the tail ends at the
  first fix round that stops touching source, and no round can know in advance whether it is that
  round. The honest statement is the conditional one — **if round 12 finds only record defects or
  nothing, its fix touches no source file and the tail ends there** — and the record should stop
  reading that conditional as a forecast. *(recorded only.)*
- **H1 is older than the fix that was under review, and that is the sharpest thing this round says
  about the previous four.** The clause carried the same defect with *not* before M1 rewrote the
  sentence around it, so rounds 9 and 10 both read it and let it stand, and round 10 rewrote its
  neighbours while keeping it. **A rewrite is not a review of what it preserves**, and the surviving
  clause of an edited sentence is exactly where an Opus reviewer nods. *(recorded only — the brief
  did point the round at this sentence, and it is fair to say the finding was scoped for; what it
  derived rather than accepted is why the *never* is wrong, which the brief did not state.)*

  > **Correction, round 12 (a Medium).** *"H1 is older than the fix that was under review"* is true
  > of the **words** and misleading about the **defect**, and this item and §20.1's closing sentences
  > both lean on it too hard. At `6572a29` the clause read *"the victim is the lowest pending
  > sequence of the path holding the most, so it is that path's oldest pending entry that goes **and
  > not** whichever one this assertion trips over"* — with a **concrete criterion stated beside it**,
  > *and not* reads as a contrast between two selection criteria (*the rule is this, not that*),
  > which is true. M1 then **deleted that criterion**, replaced it with the opaque *"whatever that
  > rule names"*, and strengthened *not* into *never* — and it is that combination, not the surviving
  > word, that turns a criterion contrast into a false identity claim about the victim. **So M1 is a
  > contributing cause and not merely a preserver**, and rounds 9 and 10 read a sentence that did not
  > yet say what round 11 found. What survives of the item is the narrower and still useful half:
  > **a rewrite is not a review of what it preserves**, and a clause carried through an edit is where
  > a reviewer nods. What does not survive is the implication that four rounds had already read the
  > defect. Round 12 derived this from `6572a29` itself.
- **Five consecutive rounds with no second provider.** Rounds 1–6 were Codex; 7 through 11 were
  adversarial Opus agents. **This round is the first of the five to find a High**, and it found one
  the four before it had read past — which is evidence that a cold Opus round is not worthless here,
  and **not** evidence that the bound is discharged. 2d-4a-G is the next opportunity to break it, and
  `docs/decisions/codex-dispatch-procedure.md` is the route. *(recorded only — the substitution is
  `/autoclaude-opus`'s prescribed behaviour, which names exactly one review mechanism.)*
- **The ordinal-fragility surface is wider than §19.4 measured, and this round did not size it
  either.** §19.4 says *clause 4* and *clause 5* are ordinals a renumbering would silently break, and
  discusses the two citations in `address_of_minted`. A `rg -c 'clause [0-9]'` over the workspace's
  Rust files at this commit answers **nine files and 83 citations** —
  `retained_state_contract.rs` 39, `reconciliation.rs` 18, `ledger.rs` 15, `commands.rs` 3,
  `retained_state.rs` 4, and one each in `dispatch_check.rs`, `main.rs`, `watch_check.rs` and
  `lib.rs`. That count is this orchestrator's, taken while the round was in flight; **round 11 did not
  verify it**, and its report says only that §19.4's marks otherwise stand. Nothing here proposes a
  guard for it. *(recorded only — it names no defect, and no clause has in fact been renumbered.)*

  > **Correction, round 12 (a Low).** **83 is a count of matching lines, not of citations.** `rg -c`
  > answers lines, and a line carrying two citations is counted once; `rg -o 'clause [0-9]' | wc -l`
  > over the same nine files answers **85**. The per-file breakdown above — 39, 18, 15, 4, 3, and one
  > each in four more — is round 12's, and it is exact. **The nine files are right and the
  > renumbering conclusion beside them is sound**; only the total was off by the difference between
  > lines and occurrences, which is the same class of error as measuring one span and labelling
  > another.

  > **Correction, round 13 (a Medium) — the correction above committed the shape it was written to
  > correct.** It raised the total from 83 to **85**, which is right, and in the same breath called
  > the per-file breakdown *"39, 18, 15, 4, 3, and one each in four more"* **exact**, which is not:
  > that breakdown sums to **83**, because it is the `rg -c` **line** count — the very figure the
  > block had just ruled superseded. A total measured in occurrences was left standing beside a
  > breakdown measured in lines. **The occurrence breakdown**, re-derived by round 13's fix round with
  > `rg -o 'clause [0-9]' -g '*.rs' . | sed 's/:clause [0-9]//' | sort | uniq -c`:
  >
  > | File | Occurrences | Lines |
  > |---|---|---|
  > | `src-tauri/src/retained_state_contract.rs` | **41** | 39 |
  > | `src-tauri/src/reconciliation.rs` | 18 | 18 |
  > | `src-tauri/src/ledger.rs` | 15 | 15 |
  > | `crates/espansoconfig-core/src/watch/retained_state.rs` | 4 | 4 |
  > | `src-tauri/src/commands.rs` | 3 | 3 |
  > | `dispatch_check.rs`, `main.rs`, `watch_check.rs`, `lib.rs` | 1 each | 1 each |
  > | **Total** | **85** | **83** |
  >
  > **Exactly one file moves**: `retained_state_contract.rs`, where two lines carry two citations
  > each. Every other file's two counts coincide, which is why the error survived — eight of the nine
  > rows are true under either reading.
  >
  > **The attribution is wrong too.** The breakdown is not *"round 12's"*: it is the bullet above,
  > which says in its own words that the count *"is this orchestrator's, taken while the round was in
  > flight"* — round 11's. Round 12 quoted it forward without re-deriving it, which is how a line
  > count arrived inside a block about line counts.
  >
  > **What still stands, unchanged:** the nine files, and the renumbering conclusion — clause ordinals
  > are hand-numbered prose, `rustdoc` checks the link and not the number, and inserting a clause
  > renumbers all 85 with nothing failing.
- **The rewritten paragraph is still asserted by nothing.** No test poisons either lock, no test
  drives a watermark at or above an offending entry's sequence, and no test connects an overflow
  eviction to this assertion, though the capacity bound itself is exercised. The paragraph says so
  about itself, as it did before this round and the two before it. *(recorded only.)*
- **`docs/reviews/phase-2d-4a-queue.md` still carries no section for rounds 10 or 11**, where it
  carries one for round 9. §19.4 raised this for round 10 and it is unfixed; the policy the round-9
  section states covers both rounds identically, so what is missing is a signpost and not a record.
  *(actionable — it names an absence in a file that exists and a fix of one paragraph; not a blocker,
  because the file it names is the record and not source.)*
- **R9 remains open, unmeasured and unbounded**, and nothing in this round touched it: no count, no
  cap, no eviction rule for the identity register. *(recorded only — no step of the 2d split owns
  building a bound for it, which is itself the residue.)*

## 21. Round 12 of the review, and the fix round that answered it

Round 12 ran on 2026-08-29 under **`/autoclaude-opus`**, as the corrective phase **2d-4a-G** that
§20.4's first item said the round-11 debt would become. Its reviewer was a fresh
**`autoclaude-reviewer` on `model: "opus"`** that did not write the code, dispatched with
`docs/decisions/2d-4a-G-round-12-brief.md`, which is kept so the round can be audited against what it
was actually asked. **It is the sixth consecutive Opus round.** The brief said so in its own opening,
and put round 11 on the record as evidence **for** the value of a cold Opus round rather than as a
discharge of the bound: round 11 found a High that four rounds had read past, and that says nothing
about what all six share. §21.4 restates the bound rather than closing it.

**Its verdict: `ship-with-fixes` — 0 High, 2 Medium and 3 Low**, every finding against the round-11
fix and nothing else. **Two Mediums live in the record, two Lows in source and one Low in the
record.** The report is `docs/reviews/phase-2d-4a-round-12.md`, written by the reviewer itself, and it
is **not reproduced into `docs/reviews/phase-2d-4a-queue.md`** for the reason §18, §19 and §20 all
give.

**What round 12 cleared is the repair itself, and it cleared it at the level round 11 attacked.**
`evictable_sequence` (`:921-935`) is a pure function of `pending` over paths, counts and sequences —
`min_by_key(|(count, lowest)| (Reverse(*count), *lowest))` — reading no `DocumentId` and no assertion
state, **with no coupling direct or indirect** to which entry tripped the assertion. So *"never
because it is the entry that trips here"*, *"when [`evictable_sequence`] picks it"*, *"an overflow
that selects this entry"* and `retained_state_contract.rs:1089`'s *"an overflow evicting **it** inside
the enqueue"* are **now all true together**, which is exactly the four-way consistency round 11 found
broken. It also cleared four more things by its own derivation:

- ***Point, do not restate* is honoured.** The added prose makes a negative claim about **this**
  escape and reinstates none of M1's deleted paraphrase of clause 5 — the failure mode a fix written
  to answer a *correctness* finding would most easily have walked into.
- **The preserved clauses were checked rather than assumed**, which is what §20.4 asked for and the
  reason round 11's High survived four rounds: `drain` (`:1185-1189`) raises `acknowledged`, retains
  `*sequence > after_sequence` and then projects, so the watermark escape and the poisoning claim
  both hold; `enqueue` evicts on `while guard.pending.len() > QUEUE_CAPACITY` (`:1098`); and `drain`,
  `enqueue` and `begin_epoch` each take the lock through `PoisonError::into_inner` (`:1185`, `:1089`,
  `:1030`).
- **§20.2 verified in full** — `+4 / −3` by `--numstat`, every added and removed line beginning `///`,
  the link set unchanged, the paragraph six over five.
- **L2 stays declined on a third round's reading.** Round 10 raised it and declined it, round 11
  agreed, and round 12 agrees: `:1005`'s *"the third way a stored entry leaves"* is clause 4's own
  words, which is what the precedent claim at `:1089` asserts.

### 21.1 Finding by finding

Round 12's report numbers nothing; the labels below are this record's, in the report's own order.
**All five are fixed.** Nothing was declined.

- **M1 (Medium, record) — the round-11 L1 correction block names the wrong span for its own
  derivation.** It closes *"Both numbers are re-derived here by listing every `` [`…`] `` in the **doc
  comment**"*, and what was listed is the **paragraph**. `address_of_minted`'s doc comment runs from
  `:1425` and holds **13 occurrences over 10 targets**; the paragraph, `:1481-1522`, holds the
  six-over-five the block reports. **This is the same defect the block exists to correct** — a figure
  measured over one span and labelled with another — one block below where it corrects it. **Agreed
  and fixed** by a round-12 correction block giving both figures with their spans named, both
  re-derived by this fix round over both spans rather than copied from the report. **Record only.**
- **M2 (Medium, record) — *"H1 is older than the fix under review"* is true of the words and
  misleading about the defect.** Textually the claim holds: at `6572a29` the clause read *"…and
  **not** whichever one this assertion trips over."* But pre-M1 that *not* sat beside a **concrete
  criterion** — *"the victim is the lowest pending sequence of the path holding the most, so it is
  that path's oldest pending entry that goes"* — under which it reads as a contrast between two
  **selection criteria**, and is true. M1 deleted that criterion, replaced it with the opaque
  *"whatever that rule names"*, and strengthened *not* into *never*. **It is that combination and not
  the surviving word that makes the claim false**, so M1 is a contributing cause rather than merely a
  preserver, and §20.4's flat sentence over-distributes the blame to rounds 9 and 10. **Agreed and
  fixed** by a round-12 correction block that keeps the half which survives — *a rewrite is not a
  review of what it preserves* — and withdraws the implication that four rounds had already read this
  defect. **Record only.**
- **L1 (Low, source) — *"so this escape waits on a state it cannot bring about"* has three candidate
  antecedents for *it***, is near-tautologous under the likeliest one, and partly duplicates the
  paragraph's own summary four lines below (*"each waits on something outside this function"*,
  `:1509-1510`). **Agreed, and the clause is deleted rather than disambiguated**: what it was reaching
  for is already said, better, by the summary it duplicates.
- **L2 (Low, source) — the new full stop broke a three-item list.** The paragraph enumerates the three
  escapes as one sentence, *A; B; and C*. Round 11's repair put a full stop after *clause 5*, ending
  item 2, so item 3's *"; and [`ReconciliationQueue::begin_epoch`]"* hung off a sentence whose subject
  was item 2's rule. **Agreed and fixed**: the full stop becomes a comma and the appositive *"a rule
  that does not know this assertion exists"* replaces the new sentence, so item 2 is one clause again
  and the list reads *A; B; and C*. **Both Highs of this tail were enumeration miscounts in this
  paragraph**, and the reviewer said so; that is why a punctuation finding is worth a source edit
  here and would not be somewhere else.
- **L3 (Low, record) — *"83 citations"* counts lines, not citations.** `rg -c` answers matching lines,
  so a line carrying two citations counts once; `rg -o 'clause [0-9]' | wc -l` answers **85** over the
  same nine files. **Agreed and fixed** by a round-12 correction block, which also records the exact
  per-file breakdown (39/18/15/4/3/1/1/1/1) the reviewer confirmed. **The nine files and the
  renumbering conclusion stand.** **Record only.**

  > **Correction, round 13 (a Medium).** The breakdown quoted here is the **line** count and sums to
  > **83**, not to the 85 the same bullet gives as the total; the occurrence breakdown is
  > **41**/18/15/4/3/1/1/1/1, and it was round 11's orchestrator figure rather than round 12's. The
  > full re-derivation, with both columns side by side, is the round-13 correction block under §18.3's
  > ordinal-fragility item.

**Why the two source Lows were fixed rather than carried, since that decision is what commissions
round 13.** §7.3 permits carrying an item that is not a correctness defect in source, and both of
these qualify — neither makes the comment false. They were fixed anyway, on the merits and stated
here so a later round can disagree. **L2 damages the structure of the very enumeration both Highs of
this tail were about**, in the paragraph that has now produced two of them; a list that reads *A; B.
X; and C* is the shape a later reader miscounts, and this file's history is that such shapes are
found as Highs two rounds later, not never. **L1's clause was one round old, written by the previous
fix round, ambiguous and duplicative** — the cheapest possible moment to remove it is before anything
cites it. Both live in one sentence, so both are one edit. **Neither *it would end the tail* nor *it
would commission a round* was an input**, exactly as §19.1 recorded for its own declined finding; §7.1
reads the diff afterwards and this fix round does not get a vote.

### 21.2 What this round changed, by file

Listed in full, this record and the review files included, for the reason §15.2 exists:

- `src-tauri/src/reconciliation.rs` — one edit inside `address_of_minted`'s doc comment, answering
  **both** source Lows at once. **+3 / −4 by `git diff --numstat`, and every added and removed line
  begins `///`.** No executable line changed. The link set is untouched, so the paragraph is still
  **six occurrences over five targets** and the doc comment still **13 over 10**.
- `src-tauri/src/retained_state_contract.rs` — **unchanged**; L2 of round 10 stays declined on a third
  round's reading.
- `docs/decisions/2d-4a-notes.md` — this section, plus **three** round-12 correction blocks: one under
  the round-11 L1 block inside §18.3 (M1), one under §20.4's third item (M2) and one under §20.4's
  ordinal-fragility item (L3).
- `docs/reviews/phase-2d-4a-round-12.md` — new, written by the reviewer itself, **unmodified here**.
- `docs/decisions/2d-4a-G-round-12-brief.md` — new at the dispatch, unmodified here.

> **Correction, round 13 (a Medium) — this list said "in full" and was not.** `git show e334d5b
> --numstat` gives **seven** files; the list above names four changed ones and one it records as
> unchanged. The three it omits are all checkpoint mechanics, and naming them is the point of a list
> that claims to be complete:
>
> - `PROGRESS.md` — **+150 / −134**, the round's checkpoint: the status row, the next action, the
>   verification block and the git-state row.
> - `docs/progress-archive/next-action-history.md` — **+110 / −0**, the spent round-11 next-action
>   block moved out of `PROGRESS.md` verbatim.
> - `docs/progress-archive/phase-2d.md` — **+54 / −0**, the spent round-11 verification block moved
>   out of `PROGRESS.md` verbatim.
>
> **Neither omission changes a claim about the source change**, which remains the one comment edit
> the first bullet describes. What it changes is what §15.2 exists for: a by-file list is the thing a
> later round diffs against, and one that silently drops the archive moves makes an iteration's own
> record maintenance invisible to it.

**No frontend file changed**, so no `npm` gate was re-run by this fix round; the three frontend
figures in §21.3 are this iteration's own measurement.

### 21.3 The gates after this round

Measured by this fix round on the tree it produced, each Cargo command issued separately with nothing
else running, and **redirected to a file rather than piped**, so every status is the tool's own.

- `cargo test --workspace` — **1313** passed / 0 failed over **26** `test result: ok` lines, exit 0. Unchanged from §20.3, as it must be: this fix round added no test and removed none, and its only source change is punctuation and one deleted clause inside a doc comment. **This is what proves no inventoried count moved**, both prose guards running inside it.
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `cargo doc --workspace --no-deps` — exit 0, **73** warnings and **0** unresolved, unchanged — all 73 are `private_intra_doc_links` from `espansoconfig-core`, counted as *links to private item* lines rather than read off the summary alone. `src-tauri/src/reconciliation.rs` was `touch`ed first so the paragraph's links were re-resolved rather than served from the previous build's cache. The link set did not change, so the paragraph is still **six occurrences over five targets** and the doc comment still **13 over 10**.
- `cargo tree -p espansoconfig-core | rg tauri` — empty — the core crate still pulls in no `tauri` (D2x).

**No inventoried count moved.** Checked **before** the edit was applied, the same way §20.3 describes
and with the same stated narrowness: both phrase families extracted from their own contract modules —
**88** retained-state and **61** liveness — and all 149 counted against the exact prose this edit
removes and the exact prose it adds, lowercased with whitespace collapsed. **No phrase occurs in
either**, so no `(file, phrase)` count can have moved. **Round 12 did not do this check** — it says so
under `NOT-VERIFIED`, that its reading of the diff against the entries it read is weaker than the
check the record describes — so this is the fix round's own evidence and `cargo test --workspace`
above is what proves it.

> **Correction, round 13 — the figures are right and the word for them was wrong, which is why no
> round could reproduce them.** Round 13 listed 88 / 61 / 149 under `NOT-VERIFIED`, saying no recipe
> in the record reproduces them and none it tried did: counting `phrase:` fields gives **141** and
> **86**, and distinct phrase literals give **68** and **35**. None of those is the figure. **What 88
> and 61 count is the sweep's patterns, not the inventory's phrases** — `RETAINED_STATE_SHAPES`
> (`src-tauri/src/retained_state_contract.rs:159-273`) holds **88** string literals and
> `LIVENESS_SHAPES` (`src-tauri/src/liveness_contract.rs:98-181`) holds **61**, totalling **149**.
> Both re-derived by round 13's fix round:
>
> ```sh
> awk 'NR>159 && NR<273 && /^    "/{c++} END{print c}' src-tauri/src/retained_state_contract.rs  # 88
> awk 'NR>98  && NR<181 && /^    "/{c++} END{print c}' src-tauri/src/liveness_contract.rs        # 61
> ```
>
> **The check the figures describe is the right check**, and this correction does not disturb it: the
> sweep matches a `SHAPE` against prose, so prose containing none of the 149 can move no
> `(file, phrase)` count. **The defect is the label.** Both modules use `phrase` as the name of an
> `INVENTORY` field holding something else, so *"88 retained-state and 61 liveness phrases"* names the
> patterns with the word the code reserves for the judgements — a **name** collision rather than a
> span one, and the nearest neighbour yet of the shape §21.4 names. Read it as *shapes* wherever this
> record says *phrases* of a family, here and in §20.3.

### 21.4 What this round did not do, and where it is thin

Per `CLAUDE.md` §7.3 every item carries a mark. An **actionable** item naming a correctness defect in
a source file is a blocker that stops this step closing; none below is one.

- **Round 13 is commissioned by §7.1 and cannot run here, so 2d-4a-G is superseded by 2d-4a-H and is
  never complete.** L1 and L2 were fixed in `src-tauri/src/reconciliation.rs`, and under §7.1 the unit
  is the file and a comment-only change counts. 2d-4a-G spent its one invocation on round 12, so under
  §7.4 the debt is **carried, not written off**. **Round 13's scope is one comment edit in one file**,
  plus §21 and the three round-12 correction blocks. *(actionable — it names work in files that exist
  and no defect in source; it is a workflow outcome, and `PROGRESS.md` carries it as the next
  action.)*
- **Measuring one span and labelling it another is now a named shape in this file, and round 12 found
  it twice in one round.** M1 is a link count taken over the paragraph and labelled *doc comment*; L3
  is a citation count taken over lines and labelled *citations*. The round-10 L1 it descends from was
  a link count taken over a hunk and labelled *the paragraph*. **Three instances, three rounds, one
  shape** — and each was found by re-deriving the figure rather than by re-reading the sentence.
  Nothing enforces it; the only defence on file is that every figure a round cites is derived by that
  round. *(recorded only — it names no defect now standing, all three being corrected.)*
- **Six consecutive rounds with no second provider.** Rounds 1–6 were Codex; 7 through 12 were
  adversarial Opus agents. Round 11 found a High four Opus rounds had read past, which is evidence
  that a cold Opus round is not worthless here and **not** evidence that the bound is discharged — a
  prior all six share is invisible to all six, and the run is now longer than the Codex one it
  replaced. 2d-4a-H is the next opportunity to break it, and
  `docs/decisions/codex-dispatch-procedure.md` is the route. *(recorded only — the substitution is
  `/autoclaude-opus`'s prescribed behaviour, which names exactly one review mechanism.)*
- **Round 12 did not walk the phrase families against the diff**, and says so plainly under
  `NOT-VERIFIED`: what it offers is that the reviewed prose held no phrase it recognised from the
  entries it read, which it calls weaker than the check the record describes. **So §21.3's phrase
  check has one pair of eyes on it, not two**, as §20.3's did. *(recorded only — `cargo test
  --workspace` is the check that binds, and it is green.)*
- **The rewritten paragraph is still asserted by nothing.** No test poisons either lock, no test
  drives a watermark at or above an offending entry's sequence, and no test connects an overflow
  eviction to this assertion, though the capacity bound itself is exercised. The paragraph says so
  about itself, as it has through every round of this tail. *(recorded only.)*
- **`docs/reviews/phase-2d-4a-queue.md` still carries no section for rounds 10, 11 or 12.** §19.4 and
  §20.4 both raised it and it is still unfixed; round 12 lists it under `NOT-VERIFIED`. The policy the
  round-9 section states covers all three identically, so what is missing is a signpost and not a
  record — but it has now been carried three times, which is worth noticing about the carrying rather
  than about the file. *(actionable — it names an absence in a file that exists and a fix of one
  paragraph; not a blocker, because the file it names is the record and not source.)*
- **R9 remains open, unmeasured and unbounded**, and nothing in this round touched it: no count, no
  cap, no eviction rule for the identity register. *(recorded only — no step of the 2d split owns
  building a bound for it, which is itself the residue.)*

---

## 22. Round 13 of the review, and the fix round that answered it — **the round that ends the tail**

Round 13 ran as **Phase 2d-4a-H**, the fifth corrective phase, on 2026-08-30 under `/autoclaude-opus`
in driven mode. `CLAUDE.md` §7.1 commissioned it for one reason: round 12's fix changed one source
file, `src-tauri/src/reconciliation.rs`, comment-only, **+3 / −4**. Reviewer: a fresh
`autoclaude-reviewer` on `model: "opus"` that did not write the code, briefed from
[`2d-4a-H-round-13-brief.md`](2d-4a-H-round-13-brief.md), writing its own report to
[`../reviews/phase-2d-4a-round-13.md`](../reviews/phase-2d-4a-round-13.md). **The seventh consecutive
Opus round**, now longer than the six-round Codex run it replaced.

**Verdict `ship-with-fixes`: 0 High, 2 Medium, 0 Low — and both Mediums live in the record.** All
findings fixed; both fixes are in `docs/decisions/2d-4a-notes.md` alone.

**This is the verdict that closes Phase 2d-4a's tail, by rule and not by a ruling.** §7.1 commissions
a round for exactly one thing — a fix round that changed at least one source file. Round 13's fix
round changed **no source file**: three correction blocks in this file, which is under `docs/` and so
on §7's closed list of *the record*. So **round 14 is not commissioned, and under §7.2 the step
closes**. Nothing was softened to reach that: both Mediums were confirmed by re-derivation before
being accepted, and the one thing round 13 could not verify was chased down rather than carried.
2d-4a's tail is **thirteen rounds**, and it ended the way §7.2 says a tail ends — at the first fix
that stops touching source.

### 22.1 Finding by finding

- **What it cleared is the substantive result, and it is the source change.** The reviewer counted the
  enumeration this paragraph has twice been wrong about and found it **right**: three items separated
  as *A; B; and C*, the colon at `:1503` opening a clause **inside** item 2 and the semicolon at
  `:1505` closing it, so the appositive does not swallow item 3. The summary at `:1507-1510` matches
  the three **in order**. The appositive's claim is true of `evictable_sequence` (`:921-935`), a pure
  function of `pending` over paths, counts and sequences. **Round 12's repair holds at the level round
  12 attacked it**, and the two questions the fix round left open — whether the appositive's antecedent
  beats the pronoun it replaced, and whether deleting *"so this escape waits on a state it cannot
  bring about"* lost anything the summary does not carry — were both answered against the fix's
  favour being needed: neither produced a finding.
- **M1 (Medium, record) — the correction block committed the shape it was written to correct.** §18.3's
  round-12 block raised the citation total from 83 to **85** — right — and in the same breath called
  the per-file breakdown *"39, 18, 15, 4, 3, and one each in four more"* **exact**. That breakdown sums
  to **83**: it is the `rg -c` **line** count, the very figure the block had just ruled superseded. A
  total in occurrences was left standing beside a breakdown in lines. **Exactly one file moves** —
  `retained_state_contract.rs`, 41 occurrences over 39 lines — which is why it survived: eight of the
  nine rows are true under either reading. Its attribution was wrong too: the breakdown is round 11's
  orchestrator figure, quoted forward, not round 12's. **Agreed and fixed** by a round-13 correction
  block under §18.3 carrying both columns, with a pointer from §21.1. **Record only.**
- **M2 (Medium, record) — §21.2 said "listed in full" and was not.** `git show e334d5b --numstat`
  gives **seven** files; §21.2 named four changed ones. The three omitted are `PROGRESS.md`
  (+150 / −134), `docs/progress-archive/next-action-history.md` (+110 / −0) and
  `docs/progress-archive/phase-2d.md` (+54 / −0) — all checkpoint mechanics, and all invisible to a
  later round diffing against that list. **Agreed and fixed** by a round-13 correction block naming
  the three with their numstats. **Record only.**
- **The `NOT-VERIFIED` item was chased down rather than carried, and it was the sharpest thing in the
  round.** Round 13 could not reproduce **88 / 61 / 149** and said so plainly, having tried the
  obvious recipes: `phrase:` fields give 141 and 86, distinct phrase literals 68 and 35. **The figures
  are right; the word for them is wrong.** They count `RETAINED_STATE_SHAPES` (88) and
  `LIVENESS_SHAPES` (61), the sweep's **patterns** — while both modules use `phrase` as the name of an
  `INVENTORY` field holding something else. So the record named the patterns with the word the code
  reserves for the judgements. A **name** collision rather than a span one, and the nearest neighbour
  yet of the shape §21.4 names. §21.3 now carries the derivation as two `awk` lines that reproduce 88
  and 61 exactly. **The check itself was never in doubt** and is undisturbed: prose containing none of
  the 149 shapes can move no `(file, phrase)` count.

### 22.2 What this round changed, by file

Listed in full — **seven changed files**, plus one recorded as unchanged because its absence is the
point. This record, the review file and the checkpoint's archive moves are all included, which is the
completeness M2 was raised about. Verified against `git status --short` and
`git diff --stat` **after** the last edit rather than from memory, which is the only order that makes
a claim of completeness worth anything.

- `src-tauri/src/reconciliation.rs` — **unchanged.** No source file changed in this round, which is
  the fact that closes the tail.
- `CLAUDE.md` — §7's opening, which said in as many words that both tails on record were stopped by a
  human *"because nothing in these conventions could say stop"*. That is now false, and a rule whose
  own statement misreports its record is the defect class this project ranks worst. It gains a
  paragraph naming this tail as the first to end by the rule, and naming the two things the closure
  does **not** mean. **Record, not source** — it is on §7's own closed list.
- `docs/decisions/2d-4a-notes.md` — this section (§22), plus **four** round-13 correction blocks: one
  under §18.3's ordinal-fragility item (M1, with the two-column table), one under §21.1's L3 bullet
  (M1's pointer), one under §21.2's file list (M2) and one under §21.3 (the phrase/shape derivation).
- `docs/decisions/2d-4a-H-round-13-brief.md` — new at the dispatch, unmodified here.
- `docs/reviews/phase-2d-4a-round-13.md` — new, written by the reviewer itself, **unmodified here**.
- `PROGRESS.md` — the checkpoint: the status rows, the next action, the verification block and the
  git-state row.
- `docs/progress-archive/phase-2d.md` — the spent round-12 verification block, moved out of
  `PROGRESS.md` verbatim at the head of the iteration.
- `docs/progress-archive/next-action-history.md` — the spent round-12 next-action block, moved out of
  `PROGRESS.md` verbatim.

**No frontend file changed**, so no `npm` gate was re-run by this fix round.

### 22.3 The gates after this round

Measured by this iteration's orchestrator on the tree it produced, each Cargo command issued
separately with nothing else running, and **redirected to a file rather than piped**, so every status
is the tool's own. Orphaned bin targets were killed first, per the host scar.

- `cargo test --workspace` — **1313** passed / 0 failed over **26** `test result: ok` lines, exit 0.
  Unchanged, as it must be: this round changed no `.rs` file at all.
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `cargo doc --workspace --no-deps` — exit 0, **73** warnings, all `private_intra_doc_links`, **0**
  unresolved.
- `cargo tree -p espansoconfig-core | rg tauri` — empty (D2x).
- The three frontend figures are carried unchanged from §21.3 — **431** `npm run check` files,
  **2125** `npm test`, **184** `npm run build` modules — and the ground is stronger than usual: **no
  file outside `docs/` and `PROGRESS.md` changed in this iteration**, so no input to any of them moved.

**No inventoried count moved, and this round needs no phrase check to say so**: the check exists to
catch prose in a **Rust** file arriving into or leaving a swept tree, and no Rust file was touched.
This is the first round of the tail able to say that from the diff alone rather than from a phrase
sweep.

### 22.4 What this round did not do, and where it is thin

Per `CLAUDE.md` §7.3 every item carries a mark. An **actionable** item naming a correctness defect in
a source file is a blocker that stops this step closing; **none below is one**, which is a condition
of the closure recorded above and not an afterthought to it.

- **The tail closes here and nothing carries it further.** Round 13's fix touched only this file, so
  §7.1 commissions nothing and §7.2 closes the step. **2d-4a-H is complete, not superseded** — the
  first phase of this chain that is. The five corrective phases D, E, F, G and H are each recorded as
  superseded by their successor except this one. *(recorded only — it is the rule's output, not work.)*
- **Seven consecutive rounds with no second provider, and the tail ended inside that run.** Rounds
  1–6 were Codex; 7–13 were adversarial Opus agents. The bound is now **worse** than when §21.4
  recorded it and it was never discharged — a prior all seven share is invisible to all seven, and the
  tail closing is not evidence against it, because the closure is a fact about round 13's *diff* and
  not about round 13's *thoroughness*. **Round 13 is the last opportunity this tail had, and it went
  unspent.** `docs/decisions/codex-dispatch-procedure.md` remains the route if a later phase wants it.
  *(recorded only — `/autoclaude-opus` names exactly one review mechanism, and choosing another is an
  owner decision, not a rule these files evaluate.)*
- **The rewritten paragraph is still asserted by nothing.** No test poisons either lock, no test drives
  a watermark at or above an offending entry's sequence, and no test connects an overflow eviction to
  this assertion. Thirteen rounds have improved the prose and moved this not at all; the paragraph
  says so about itself. *(recorded only.)*
- **"Measure one span, label another" now has a fourth instance and a variant.** M1 is the third span
  instance — and it occurred **inside the correction block written to fix the second**, which is the
  strongest available evidence that re-reading a sentence does not catch this shape and only
  re-deriving the figure does. The phrase/shape collision is the **name** variant: same failure, a
  label taken from the wrong vocabulary rather than the wrong span. *(recorded only — no instance now
  stands uncorrected.)*
- **`docs/reviews/phase-2d-4a-queue.md` still carries no section for rounds 10–13.** §19.4, §20.4 and
  §21.4 each raised it and it is still unfixed, now for a fourth time. The round-9 policy covers all
  four identically, so what is missing is a signpost and not a record. **Carried four times is worth
  noticing about the carrying**, and the tail closing means no later round of this tail will pick it
  up. *(actionable — it names an absence in a file that exists and a fix of one paragraph; **not a
  blocker**, because the file it names is the record and not source, so §7.3 permits a later phase to
  adopt it.)*
- **R9 remains open, unmeasured and unbounded**, untouched by this round as by every round before it:
  no count, no cap, no eviction rule for the identity register. *(recorded only — no step of the 2d
  split owns building a bound for it, which is itself the residue.)*
