# Phase 2d-5-3-B — the round §7.1 commissioned for 2d-5-3-A's fix

**Status: complete, and it closes the 2d-5-3 tail.** Risk class **high**; worker model **opus** (the
round ran as the phase's single review invocation; the fix was applied by the orchestrator).
Review: [`docs/reviews/phase-2d-5-3-B.md`](../reviews/phase-2d-5-3-B.md).

The adversarial round `CLAUDE.md` §7.1 commissioned for **Phase 2d-5-3-A's fix**, scoped to that fix:
the two rewritten comments in `src/lib/browser/reconciliationCoordinator.ts`, the renamed case and the
new failing-open case in `src/lib/browser/workspace.test.ts`, and `docs/decisions/2d-5-3-A-notes.md`
in full.

---

## 1. Verdict

**`ship-with-fixes`, 0 blockers, two should-fix items.** Both were re-derived by the orchestrator
against the code before any fix was commissioned — this chain's standing rule, and the reason 2d-5-3-A
caught what it did.

The round also confirmed the half of 2d-5-3-A that was right and is worth keeping: the *independence*
half of the `staleOpen` comment — that nothing on that line observes `workspaceOpened()`, and that a
host may move `openGeneration()` without ever calling it — is true, and it survives this phase's
rewrite intact.

---

## 2. Finding 1 (Medium) — the rewritten comment replaced one unstated ordering with another

`src/lib/browser/reconciliationCoordinator.ts`, `runOneDrain()`'s
`openedAt !== host.openGeneration()` arm. 2d-5-3-A rewrote it to say:

> *…so every identity in the batch belongs to a workspace lifecycle on its way out… What makes the
> refusal right on its own is the batch: its `newest_sequence` indexes a queue this session is no
> longer reading…*

**Re-derived: both sentences hold only under one of two reachable orderings.** The reviewer raised
this as a claim about the frontend being unable to *know* the ordering and explicitly recorded, under
`NOT-VERIFIED`, that it had not traced the Rust side to show the losing order is reachable. That trace
is the orchestrator's, and it is what turns the finding from an argument into a measurement:

- `src-tauri/src/commands.rs:3491` — `drain_external_changes` calls
  `WorkspaceSession::drain_external_changes`, which runs under `with_workspace_read`, i.e. **the
  session mutex**.
- `src-tauri/src/commands.rs:682` — `WorkspaceSession::open` runs `Workspace::discover` *outside* the
  lock, then takes **the same mutex** for one block that calls `self.reconciliation.begin_epoch(...)`
  and `guard.replace(Open { … })` **together**.

So the two are serialized against each other in an order **neither side chooses**. If the drain
reaches the mutex first, its batch is the outgoing queue and 2d-5-3-A's sentence is true. If
`open`'s swap block reaches it first, the queue has already adopted the new epoch and the batch
describes the **incoming** lifecycle — and *"every identity in the batch belongs to a workspace
lifecycle on its way out"* is then false as written.

**The arm cannot tell which happened**, and that is the sharp part: the number that separates two
epochs is the batch's own `epoch` — `WorkspaceSession::drain_external_changes`'s own doc says so, *"a
caller separates two epochs' numbers by the batch's own `epoch`"* — and this arm fires **above** the
`staleEpoch` check that reads it.

**The action was right either way**, which is why this is a Medium and not a blocker: refusing and
moving neither sequence state is correct under both orders. What was wrong was the sentence the
comment nominated as *"what makes the refusal right on its own"* — it rested on a call order, which is
**the very shape 2d-5-3-A's finding 1 was raised to remove**. That round deleted an unstated *host*
call order (`AppShell` calls `start()` and `open(null)` in the same block) and put an unstated
*cross-process* one in its place.

**The fix.** The arm now rests on the generation alone — this drain was issued under a generation the
session has left, so its `newest_sequence` is not a watermark for the lifecycle now installed — and it
states in as many words that which lifecycle the batch describes is not knowable there, names both
orders, names the mutex that serializes them, and says that the number which could tell them apart is
read below.

### 2.1 The sweep — three more instances of the same shape, none of them in 2d-5-3-A's diff

`CLAUDE.md` says to **sweep for the shape, never for the words of the finding just closed**, and names
leaving a narrower instance standing as this project's repeated failure — 2c-4a-2 took four review
passes because each fix round left one. The sweep
(`rg -n 'way out|answers for that one|holds the workspace'`) found **four** instances of the assertion
that a drain in flight across an open necessarily describes the **outgoing** workspace. One was the
finding above. The other three were written by 2d-5-3, not by 2d-5-3-A, so they sit **outside this
round's §7.1 scope**:

| Site | The claim | Why it is not guaranteed |
|---|---|---|
| `runOneDrain()`'s `awaitingReady()` arm | *"this drain answered for a lifecycle on its way out"* | same race, same arm position above the epoch check |
| `requestDrain()`'s JSDoc | *"Rust still holds the workspace being replaced until that open succeeds, so a drain issued here would come back describing it"* | true only until the swap block runs, which is not tied to when this window learns the open succeeded |
| `workspaceOpened()`'s gate comment | *"a drain issued between here and `ready` answers for that one"* | same |

**All three were fixed, and the scope extension is deliberate rather than accidental.** The
justification, recorded so a later round can disagree with it knowingly: the fixes are **comment-only**
and behaviourally inert; the severity standard this project applies makes *a claim in a source comment
that is false as written* its worst defect class; and §7.3 makes an actionable item naming a
correctness defect in source a **blocker** rather than something a step may close over. Having
identified three, leaving them for a later round would have been the failure mode `CLAUDE.md` names,
not scope discipline.

**Two of the three keep a justification that never depended on the ordering, and the rewrites say so
rather than deleting it.** `workspaceOpened()`'s real objection is to accepting **any** batch in that
window — `adopted` has just been cleared, so `accept()` would take that batch's epoch as the session's
shown epoch — and `requestDrain()`'s is that recording without issuing answers both consult orders.
Those halves are load-bearing and are kept; only the ordering clause each rested on is replaced.

---

## 3. Finding 2 (Low, two parts) — the record

### 3.1 A self-invalidating citation, and the fix is what invalidated it

`2d-5-3-A-notes.md` §3.1 justified its finding with
`rg '\.start\(\)' src --glob '!*.test.ts'` **matching exactly one line**. It now matches **two**: the
fix's own second paragraph writes `` `BrowserState.start()` `` into a comment at
`reconciliationCoordinator.ts:979`. **Re-derived, and confirmed** — the recipe no longer reproduces as
written.

This is the shape `PROGRESS.md` names at its own line 21 — *a derived figure outlives the thing it was
derived from unless something re-derives it* — and the chain has now produced it twice (2d-4b-D found
it in a notes section's line citations).

**The claim is unaffected; only the recipe is.** Both matches were checked: one *is* the new comment,
and the other is `workspace.svelte.ts:3506`, which is `reconciliation.start()` **inside**
`BrowserState.start()`'s own body (defined at `:3502`) — the wrapper passing the call through, not a
caller of it. `workspace.svelte.ts:1891` says the same thing independently and in as many words:
*"Created here, started by nobody."* **There is still no production caller.**

A correction block was added at the point of the wrong sentence — this chain's convention since
2d-5-2b-C — giving a recipe that survives its own fix by excluding the prose:

```sh
rg -n '\.start\(\)' src --glob '!*.test.ts' | rg -v '^\S+:[0-9]+: *(//|\*)'
```

**Run at 2d-5-3-B: one line, `workspace.svelte.ts:3506`.** The correction was verified rather than
asserted, which is the whole point of a phase that exists to check a record.

### 3.2 An able-to-fail claim that stopped one assertion short

§3.3 called the new failing-open case *"proven able to fail"* on one mutation — `workspaceReady()`
added to `open()`'s refused arm — which fails at `workspace.test.ts:7616`. That line is the assertion
**after the failed open**. The case stops there, so the **third** assertion at `:7624` — the
wake-after-gate one, which §3.3 itself calls *"what makes the case about the gate rather than about
the mere absence of a trigger"* — was never shown able to fail. Claiming a case discriminates what its
name says, on evidence one assertion short, is the same overclaim §3.4 was raised about.

**Measured at 2d-5-3-B rather than taken from the reviewer.** Mutation: `drainMayStart()` reduced to
`started && !disposed`, deleting the `!awaitingReady()` conjunct so the gate holds nothing.

```
AssertionError: expected [ +0, +0 ] to deeply equal [ +0 ]
 ❯ src/lib/browser/workspace.test.ts:7624:28
AssertionError: expected 2 to be 1
Tests  1 failed | 195 skipped (196)
```

**`:7624`, not `:7616`** — a different line from the mutation above, which is exactly the point: it is
the third assertion, and the gate is what holds the later wake. Restored from a copy taken before the
mutation, and `drainMayStart()` re-read afterwards to confirm the conjunct is back. Recorded into
`2d-5-3-A-notes.md` §3.3 as a completion block.

---

## 4. What was deliberately not done

- **The Low carried from 2d-5-3 stands.** `pump()` checks `drainMayStart()` and then `runOneDrain()`
  calls `host.openGeneration()` before `host.drain()` — the check-and-spend **shape**, inert with
  today's accessor. Restructuring control flow that has just had two concurrency blockers fixed, to
  answer an inert shape, remains the riskier move. `2d-5-3-notes.md` §7 item 11, *recorded only*.
- **The `staleEpoch` arm's comment was left alone**, and that is a decision rather than an oversight:
  it is guarded by `answer.value.epoch !== expectedEpoch`, so *"the batch describes a queue for a
  workspace lifecycle this session is not showing"* is true there. It is the one arm that has read the
  discriminating number.
- **No window reading is owed.** The coordinator still has no production `start()` caller, so nothing
  changed here is on a screen. Unchanged from 2d-5-3-A §203.

---

## 5. Verification

Every command run by the orchestrator, each on its own, on the tree this phase commits.
**`1320 / 441 / 2307 / 188` — every figure unmoved from 2d-5-3-A**, which is what a comment-only
source change plus two record files must produce.

| Gate | Result |
|---|---|
| `cargo test --workspace -- --test-threads=1` | **1320**, summed over **26** `test result` lines, exit 0 |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm run check` | **441 files, 0 errors, 0 warnings** |
| `npm test` | **60 files, 2307 passed**, exit 0 |
| `npm run build` | **188 modules** |

The host scar's three consequences were followed: the **serial** form is what produced 1320; the run
was **redirected to a file, never read through a pipe**; and the complementary question was asked of
every one of the 26 lines — **no `test result` line lacking `0 failed`**.

**Both bundle oracles were read and both lines are reported**, the second because it proves the search
can match at all: server-only markers (`$$payload|head_payload|push_element`) **absent**; client-only
markers (`window.__svelte|svelte-trusted-html`) **present (2)**.

**The source diff is comment-only, proven mechanically rather than by eye.** `git diff -U0` over
`reconciliationCoordinator.ts`, filtered to changed lines that are neither comment lines nor blank,
returns nothing. `git diff --numstat` is `42 23`. No other file under `src/`, `src-tauri/` or
`crates/` changed, so no file entered or left the program, no new reachable module and no new
component — which is what the four unmoved figures say independently.

**The instrument stayed pinned throughout** at `5 insertions(+), 1 deletion(-)` across
`src-tauri/src/main.rs` and `src/main.ts`, re-checked after the fix and after every gate.

---

## 6. §7.1 — what this fix commissions

**This phase's fix changed one source file**, `src/lib/browser/reconciliationCoordinator.ts`. The unit
is the file and not the line, and a comment-only change to a source file **is** a source change here —
for exactly the reason this phase and 2d-5-3-A both demonstrate.

So §7.1 commissions a round, and under `/autoclaude-opus`'s one-review-invocation cap that round is a
**new corrective phase**: **2d-5-3-C**. This phase is `SUPERSEDED BY 2d-5-3-C`, **never complete**.

**Nothing is `BLOCKED`.** The one `actionable` item still standing — 2d-5-3-A's two `open()`
early-return arms with no workspace-level case — remains a **coverage gap and not a correctness defect
in source**, so §7.3's blocker clause does not apply.

---

## 7. Where it is thin

Marked per §7.3. An unmarked item would count as *recorded only*; none is left unmarked.

1. **actionable** — *the record.* The four rewritten comments state, between them, that two orderings
   are both reachable at a Rust mutex. **Nothing in this repository tests that**, and nothing can from
   the frontend: it is a claim about `src-tauri/src/commands.rs`'s locking read by a `src/lib/browser/`
   comment. It was derived by reading `WorkspaceSession::open` and `with_workspace_read`, and a change
   to either — for instance one that ordered the two commands deliberately — would falsify four
   comments at once with every gate still green. Not a correctness defect in source, so not a blocker.
2. **actionable** — *the record.* This phase extended its own scope beyond §7.1's boundary to fix three
   instances 2d-5-3 wrote. §2.1 argues why; a later round is entitled to judge that the sweep rule and
   the scope rule were traded the wrong way. What it may **not** do is assume the three were reviewed
   as thoroughly as the one in scope: they were re-derived against `commands.rs`, and not against the
   consult.
3. **recorded only** — 2d-5-3's able-to-fail claims for **seven of its eight** cases, and its §8.3
   five-failure transcript, are **still unreproduced**. 2d-5-3-A reproduced three mutations, the
   reviewer of this round four, and this phase one more (§3.2). The bound narrows and has never been
   discharged.
4. **recorded only** — the `requestDrain()` and `workspaceOpened()` rewrites keep a load-bearing
   justification and replace only the ordering clause. Whether the kept halves are *sufficient* on
   their own was argued here, not tested; both sit in code no production caller reaches until 2d-5-7.
5. **recorded only** — `npm run check`, `npm run build` and the two bundle oracles were re-run by the
   orchestrator but not by the reviewer, which its `NOT-VERIFIED` line states. On a comment-only diff
   that is a small bound, but it is a bound.
