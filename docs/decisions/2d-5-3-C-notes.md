# Phase 2d-5-3-C — the round §7.1 commissioned for 2d-5-3-B's fix

**Risk class high; worker model opus (no implementation worker — the phase's product is a review and
its fix, taken by the orchestrator).** Review: [`../reviews/phase-2d-5-3-C.md`](../reviews/phase-2d-5-3-C.md).
Verdict **`ship-with-fixes`, 0 blockers**, 2 Medium and 3 Low. **All five re-derived by the
orchestrator before any fix was applied**, and all five fixed.

Scope, per `PROGRESS.md`'s Next action: the four rewritten comments in
`src/lib/browser/reconciliationCoordinator.ts` and `docs/decisions/2d-5-3-B-notes.md` in full,
including the two correction blocks it added to `2d-5-3-A-notes.md` §3.1 and §3.3.

---

## 1. Medium 1 — the rewrite named two orders, and a third state falsifies its reason

> **Correction, Phase 2d-5-3-D — read before the section, not after it.** Two claims below are false
> and were fixed in `reconciliationCoordinator.ts` at 2d-5-3-D. **(1) "or a refused `list_documents`
> after it" does not reach the third state.** `./workspace.svelte.ts` returns on `!opened.ok`
> *before* it calls `listDocuments()`, so reaching a `list_documents` refusal at all means
> `open_workspace` **succeeded** — `WorkspaceSession::open`'s swap block already ran
> `reconciliation.begin_epoch` and installed the new `Open`, which is the *incoming-lifecycle* case
> with its queue reset to empty. Only a refused `open_workspace` leaves the previous workspace
> installed. **(2) `workspace.test.ts`'s failed-open case does not drive that state.** It scripts
> `open: { ok: false }` for its **only** open, so no workspace was ever installed to be left in
> place, and it asserts `drainSequences` stays `[0]` — **no batch reaches the arm at all**. It pins
> the *gate*, which is a different claim. Nothing in this repository drives the third state, and a
> scripted-command vitest drives no Rust state; the claim is reasoned from `WorkspaceSession::open`,
> and the comment now says so. **Everything else in this section stands**, including the third state
> itself and the reason the arm now rests on.
>
> **What must not be "corrected" with it**: `2d-5-3-notes.md` §"the two sequences" and
> `2d-5-3-A-notes.md`'s two occurrences say a refused `list_documents` leaves **`workspaceReady()`
> unreached**, which is true and is a claim about the *gate*, not about what Rust holds.
>
> **Correction to the correction, Phase 2d-5-3-E.** Two claims *in the block above* are themselves
> false, and 2d-5-3-E fixed both in `reconciliationCoordinator.ts`. **(1)** A refused
> `list_documents` is **not** "the *incoming-lifecycle* case"; it establishes only that
> `open_workspace` succeeded, and which of the first two states the batch is in is decided by whether
> the in-flight drain took the session lock before or after `open`'s swap block. It is **one of the
> first two, whichever the race gave**. **(2)** "Nothing in this repository drives the third state" is
> false of its **workspace** half: `src-tauri/src/watch_check.rs`'s
> `a_failed_reopen_keeps_the_previous_watcher_watching` drives and asserts it against a real tree.
> **Only the queue half is unpinned.** What the block above says about `workspace.test.ts` — that it
> pins the *gate* and that no batch reaches the arm in it — is correct and stands.

**This is the third consecutive round of this chain to find the same shape: the *action* is right and
the *justification* names an ordering that does not exhaust the cases.** 2d-5-3-A's finding 1 raised
it against an unstated host call order; 2d-5-3-B raised it against an unstated cross-process order and
replaced that with a two-order enumeration; this round finds a **third state neither order covers**.

The sentence at issue, in `runOneDrain()`'s `staleOpen` arm:

> *"What makes the refusal right in both orders is the generation alone: this drain was issued under
> one this session has left, so its `newest_sequence` is not a watermark for the lifecycle now
> installed … a queue that is either gone or not yet this session's to count from."*

**Re-derived, not accepted.** Two facts, each read in the file rather than taken from the report:

- `open()` bumps the generation in its **first statement, unconditionally** —
  `const generation = ++openGeneration;` at `workspace.svelte.ts:2554`.
- `WorkspaceSession::open` returns from `Workspace::discover(root)?` **before it takes the lock at
  all**, and its own doc comment says what follows in as many words: **"A failure leaves the
  previously open workspace in place"**.

So under a refused `open_workspace` — or a refused `list_documents` after it — the generation has
moved while **Rust's workspace has not**. The batch's queue is then **neither gone nor foreign**, and
its `newest_sequence` really *is* a watermark for the lifecycle Rust is still holding. The
disjunction is false, and the state is not exotic: it is what `workspace.test.ts`'s failed-open case
(*"drains for no failed open, and holds later triggers behind the gate it left closed"*) drives, and
the frontend's own `!opened.ok` arm already states the Rust behaviour in a comment two thousand lines
away from the one that contradicted it.

**The refusal is still right in all three states, so this is a Medium and not a blocker.**

### 1.1 What the fix rests the refusal on instead, and the trap it avoids

The obvious replacement — *"the cursor was cleared by `workspaceOpened()`"* — **would have
reintroduced the same defect one paragraph above its own contradiction.** The first paragraph of that
very comment states the independence: *"nothing on this line observes `workspaceOpened()`, and a host
may move `openGeneration()` without ever calling it."* A reason resting on the clear would be a
reason about `./workspace.svelte.ts`, not about this line, and the comment says so itself.

What the arm rests on now is true of the line and of nothing else: **nothing here can attribute the
number.** The only value separating two lifecycles' sequences is the batch's `epoch`, and this arm
fires *above* the check that reads it, so `newest_sequence` arrives unattributable **by
construction**. The trade is then named rather than asserted: refusing costs at most one repeated
drain — and **on the failed-open path not even that**, because the gate stays closed and the window is
showing a failure — while moving a sequence state on a number that may belong to another lifecycle
poisons the cursor for the session. The `workspaceOpened()` clear is kept as a *second* way the same
refusal is right **under this host**, explicitly marked as a property of the host and not of the line.

### 1.2 The sweep found a fourth site; the reviewer named three

`CLAUDE.md` says to sweep for the **shape** and never for the words. The report named
`reconciliationCoordinator.ts:750-757`, `:770` and `:940`. The sweep found the same false premise at a
**fourth** site the report did not list — `workspaceOpened()`'s own gate comment, which said Rust
holds the workspace being replaced *"only until `WorkspaceSession::open`'s swap block runs"*. On the
failed-open path it holds it **indefinitely**. All four are fixed:

| Site | What was false | What it says now |
|---|---|---|
| `runOneDrain()` `staleOpen` arm | *"either gone or not yet this session's"* | three states enumerated; the reason is unattributability, not absence |
| `runOneDrain()` `awaitingReady()` arm | *"whichever of the two"* | *"whichever of the **three** states the arm above enumerates"* |
| `requestDrain()` JSDoc | *"describing **one of two** lifecycles"* | adds *"the **previous, still-installed** one when the open is refused before that swap ever runs"* |
| `workspaceOpened()` gate comment | *"**only** until … the swap block runs"* | *"and holds it **indefinitely** when that open is refused before the swap"* |

**Two of the four keep a justification that never depended on any ordering**, and those halves were
kept rather than rewritten: `workspaceOpened()`'s real objection is to accepting **any** batch in that
window because `adopted` has just been cleared, and `requestDrain()`'s is that no batch is accepted
for a lifecycle this session is not showing. Both are true in all three states as written.

**Scope note.** Three of the four sites are the ones 2d-5-3-B extended its own scope to reach, and
§2.1 of its notes argued that extension; this round was invited to judge the trade differently and
**does not** — the fourth site it added is the argument's own vindication, since a false premise left
standing at one site is what a sweep exists to catch.

---

## 2. Medium 2 — the correction against stale citations was stale in its own commit

`2d-5-3-A-notes.md` §3.1's correction block — written **to close a self-invalidating citation** —
cited the comment it was about as `reconciliationCoordinator.ts:979`. On the tree the same commit
produced, that comment stood at **`:995`**, moved by the commit's own `+19` lines.

**Re-derived**: `git show 1a135fd:src/lib/browser/reconciliationCoordinator.ts | sed -n '979p'` returns
the comment, so `:979` was correct at the previous commit and wrong at the one that shipped the
correction. **This is the third instance of the shape in this chain, not the second**, and it is the
sharpest: the shape recurred *inside the correction block written to fix its previous occurrence* —
which is the same thing `2d-4a-notes.md` §22.1 records as this project's strongest instance, arrived
at independently.

**The instance was broader than the report said.** The report named one file; the citation stood in
**four** places — `2d-5-3-A-notes.md`, `2d-5-3-B-notes.md`, `PROGRESS.md`, and the marker block in
`docs/progress-archive/next-action-history.md`. All four are fixed.

**The fix is a form, not a number.** Re-numbering would have shipped a fourth stale citation, because
this phase's own fix moved the comment again — to **`:1014`**. Every instance is now anchored on the
comment's own opening words, `` `No production code calls `start()` at all today.` ``, which no later
edit to the file can invalidate. The same treatment was applied to `2d-5-3-B-notes.md`'s two Rust
citations (§4 below).

---

## 3. The three Lows

1. **`reconciliationCoordinator.ts:1051` was 112 characters** — the only line over 90 in the file,
   left unwrapped by 2d-5-3-B's rewrite, and nothing in this repository would have caught it. It fell
   inside site 4 of §1.2 and is wrapped by that fix. Re-derived by `awk 'length > 90'`, which now
   returns nothing for the file.
2. **The precedent was attributed to the wrong phase.** `2d-5-3-B-notes.md` §3.1 credited `2d-4b-D`
   while its own correction block credited `2d-5-2b-D`. **`2d-5-2b-D` is right**, and this was settled
   by reading rather than by preferring one of the two: `2d-5-2b-notes.md` §16.2 names the shape as
   *new and generalizing* — *"A cross-file line citation into a file that the same commit edits above
   the cited line is self-invalidating."* `2d-4b-notes.md` §10.3 and §14.5 record **relatives** of the
   class (a citation written during a fix measuring the file the fix replaced), not this shape. The
   count is corrected to **three** at the same time, per §2.
3. **`with_workspace_read`'s doc comment claimed three customers and has four.** It said *"The three
   backup-catalogue methods above are its only customers"*; `rg -n 'with_workspace_read'` returns call
   sites at `:1282`, `:1294`, `:1308` **and `:1357`**, the last inside
   `WorkspaceSession::drain_external_changes`. **The two comments were a flat contradiction**: that
   fourth caller's own doc says it *"is not on the read-only `with_workspace_read` path by accident."*
   Out of §7.1's scope and **fixed anyway**, on 2d-5-3-B §2.1's precedent and §7.3's blocker clause —
   a false source comment is this project's worst defect class, and this one sits on the exact
   citation this chain has spent three rounds tracing. The rewrite keeps the *"nothing on that path
   can write"* property and says why it survives the fourth caller: what that caller mutates is the
   session's own queue, never the workspace it is lent.

---

## 4. What this round measured that the reviewer recorded as `NOT-VERIFIED`

The report was explicit about its own coverage, which is what made these cheap to close.

- **All four gates re-run in full by the orchestrator**, each on its own — the reviewer had run only
  `npm run build`. §6.
- **The `:7624` mutation, which no round of this chain had yet reproduced.** 2d-5-3-B *claimed*
  reducing `drainMayStart()` to `started && !disposed` fails `workspace.test.ts` at `:7624`; the
  reviewer derived the mechanism from the code instead of running it. **Run here**: the mutation was
  applied, `npx vitest run src/lib/browser/workspace.test.ts` returned `1 failed | 195 passed`, and
  the failure is at **`workspace.test.ts:7624`** with `expected [ +0, +0 ] to deeply equal [ +0 ]` and
  `expected 2 to be 1` beside it — exactly the claim. The file was restored from a copy taken before
  the mutation and `git diff` over it was confirmed empty before the real fix began. **2d-5-3-B's
  able-to-fail claim holds, and is now a measurement rather than an assertion.**
- **The precedent attribution** — §3 item 2.
- **`2d-5-3-B-notes.md` sections 5+**, which the reviewer skimmed, were read for the two figures they
  assert; both agree with §6.

**One item is deliberately left open and is carried, not closed** — see §5.

---

## 5. The one thing this round found that it did not fix

**A drain that loses the race can seed a fresh queue's watermark with the previous epoch's number,
and nothing scopes it.** The reviewer recorded this as an open question against
`src-tauri/src/reconciliation.rs:1186`; the orchestrator traced it rather than carrying it verbatim.

`ReconciliationQueue::drain` begins `guard.acknowledged = guard.acknowledged.max(after_sequence);` and
then retains only entries **above** `after_sequence`. `begin_epoch` assigns `QueueState::empty(epoch)`,
so a new epoch's `acknowledged` starts at 0 — and **sequences are per-epoch**, numbered from
`FIRST_OBSERVATION_SEQUENCE = 1` (`ledger.rs`: *"The first sequence an **epoch** numbers its admitted
observations from"*). A drain issued under epoch *N* whose IPC reaches the session mutex **after**
`open`'s swap block therefore calls `drain(old_watermark)` against epoch *N+1*'s queue, raising its
watermark to a number from a different lifecycle and pruning every entry at or below it.

**Why it is recorded rather than fixed here.** Three reasons, in order of weight:

1. **The reachability is not established.**
   *(Corrected at 2d-5-3-D — the mechanism this reason named was wrong; the conclusion it reached
   was not.* The original said the losing drain's thread *"is blocked on the session mutex the swap
   block holds and acquires it on release"*. That describes two threads contending, and this crate's
   own module doc excludes it: **"Why every command is synchronous"** says Tauri runs a command
   written without `async` on the **main thread**, and `commands.rs` declares no `async fn` at all —
   `open_workspace` and `drain_external_changes` are both synchronous, so they are serialized by the
   dispatcher and never block on each other's session lock.*)*
   The order is therefore the **dispatcher's**, chosen by neither side and read by nothing in this
   repository. Harm needs the drain to be dispatched *after* the swap **and** after epoch *N+1*'s
   first observation has been enqueued — and that observation waits on a fresh watcher's baseline
   scan, which takes real time (`watch_check`'s `PATIENCE` is 120 s). Nothing forbids that order;
   nothing this round or 2d-5-3-D's ran demonstrates it, and 2d-5-3-D's reviewer recorded Tauri's
   real command scheduling as `NOT-VERIFIED` for the same reason.
2. **The design's loss counting covers the continuing case.** Once `acknowledged` is high, `enqueue`
   refuses at or below it and **counts those refusals** in `ReconciliationBatch::discarded`, which is
   a counted loss and a whole-workspace reload. The uncounted part is only the entries the `retain`
   prunes in the window before the drain lands, and only when no later observation falls at or below
   the stale watermark.
3. **A real fix is a wire change and belongs to a step that owns this territory.** `drain` has no
   caller-epoch parameter; giving it one is a decision for **2d-5-5** (*external conflicts and save
   arbitration*), not for a round scoped to four comments.

**The record half is what is actually missing.** `reconciliation.rs`'s long paragraph and
`2d-4a-notes.md` §17.1 both document `after_sequence` as *"an unvalidated `u64` off the wire"*, but
they document it as an **escape** from the poisoned-lock disagreement — the **cross-epoch** case is
named nowhere. §7.3 marks below.

---

## 6. Verification — every figure run, none inferred

**`1320 / 441 / 2307 / 188`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **Every figure unmoved from 2d-5-3-B and 2d-5-3-A**, which is what two
comment-only source diffs must produce, and **every one run rather than inferred**, including
`cargo test` after a `commands.rs` edit that no test could reach.

Both source diffs were proven comment-only **mechanically rather than by eye** — `git diff -U0`
filtered to changed lines that are neither comment lines nor blank returns nothing, for
`reconciliationCoordinator.ts` and for `commands.rs` both. `numstat` is `54 33` and `8 3`.

The three host-scar consequences were followed: `--test-threads=1`, redirected to a file rather than
read through a pipe, and the complementary question asked — **26** `test result` lines, **none**
lacking `0 failed`, summing to **1320**. `cargo clippy --workspace --all-targets -- -D warnings`
exit 0, `cargo fmt --check` exit 0, `cargo tree -p espansoconfig-core | rg tauri` finds nothing.
**Both bundle oracles were read and both lines are reported**: server-only markers **absent**,
client-only markers **present (2)**.

The gates were also run **once on the inherited tree before any fix**, and returned the same four
figures — so the quadruple is two independent full runs this phase, on top of 2d-5-3-A's and
2d-5-3-B's.

The instrument's two hook files are still at their pinned `5 insertions(+), 1 deletion(-)`.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a round** — §7.1 alone does that, by reading
this phase's fix diff.

1. **actionable (record, not source).** The cross-epoch watermark case of §5 is named in no record
   file. `reconciliation.rs` and `2d-4a-notes.md` §17.1 document the mechanism only as an escape from
   the poisoned-lock disagreement. **This names a gap in the record**, so §7.3's blocker clause does
   not apply and the step closes without it; **2d-5-5 is nominated as its owner** and this section is
   the pointer. Whether the *source* is defective is §5's item 1 and is unestablished.
2. **recorded only.** The four comments still assert a claim about Rust locking that **nothing in this
   repository tests, and nothing can from the frontend**. It is now a three-state claim rather than a
   two-state one, which makes it *more* exposed to a Rust change, not less: an edit to
   `WorkspaceSession::open`'s early return would falsify four comments at once with every gate green.
   Unchanged from 2d-5-3-B's own statement of it, and re-derived here rather than carried.
3. **recorded only.** Two of the four comments keep a justification whose sufficiency was **argued and
   not tested** — `workspaceOpened()`'s *"the objection is to accepting **any** batch"* and
   `requestDrain()`'s *"no batch is accepted for a lifecycle this session is not showing"*. The
   reviewer checked the first against `accept()` and `onWake()` and found it holds; neither is pinned
   by a case.
4. **recorded only.** **2d-5-3's able-to-fail claims for seven of its eight cases, and its §8.3
   five-failure transcript, are still unreproduced.** 2d-5-3-A reproduced three mutations, 2d-5-3-B's
   reviewer four, 2d-5-3-B one more, and **this round one more** (§4) — the `:7624` gate assertion.
   The residue shrinks by one per round and no round has yet been the one to clear it.
5. **recorded only.** Nothing pins a `file:line` citation anywhere in this repository, and this round
   is the **third** demonstration in one chain of what that costs. The mitigation applied here is a
   *form* — cite by the words a comment opens with, or by symbol — adopted at five positions. It is a
   convention with nothing enforcing it. The checker `PROGRESS.md` has nominated twice would.
