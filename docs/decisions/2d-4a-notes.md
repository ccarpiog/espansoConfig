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
