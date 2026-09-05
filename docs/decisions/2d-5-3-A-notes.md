# Phase 2d-5-3-A — the round `CLAUDE.md` §7.1 commissioned for 2d-5-3's fix

**Status: complete.** Risk class: **low**. Components: **none** — no `.svelte` file was modified,
and **no production behaviour changed at all**. Three of the four fixes are comment or prose only;
the fourth adds one test case.

This phase exists because of one sentence in `CLAUDE.md` §7.1: *a fix round that changes at least
one source file is owed a review round, scoped to that change*. Phase 2d-5-3's review returned
`do-not-ship` with two concurrency blockers; the fix that answered them changed three source files,
so a round was commissioned. That round is
[`docs/reviews/phase-2d-5-3-A.md`](../reviews/phase-2d-5-3-A.md), and this file is what it produced.

---

## 1. What the round reviewed, and its verdict

**Scope**: the 2d-5-3 fix diff — the single-flight release re-entry in
`src/lib/browser/reconciliationCoordinator.ts`, the open gate that holds drains between an `open()`'s
entry and its `ready`, and the two suites' cases for both.

**Verdict: `ship-with-fixes`, 0 blockers.** Both fixed defects hold, and the reviewer says so from a
hand-trace rather than from the record:

- **The release re-entry.** The reviewer hand-traced the microtask queue of *"does not strand a
  request made while the pump gives its slot back"* and reports the order
  `R1 → A → F1 → R2 → B → F2 → release`, with the second `requestDrain` landing **strictly between**
  the pump loop's exit and `release`. So the case pins the re-entry rather than passing through the
  loop, and `asked` would stay `[0]` without the fix. The no-spin argument, the throw-freedom of
  `release` and the `.then(release, release)` choice were each checked and each hold. The
  `inFlight !== running` identity check is called unreachable-defensive, which the round accepts.
- **The open gate.** `drainMayStart()` is the only predicate and all three `ensurePumping()` call
  sites read it; `workspaceReady()` opens the gate before it requests; the post-await
  `awaitingReady()` arm is genuinely independent of the generation arm, and the case that isolates it
  moves no generation.

Four should-fix findings and one Low. **All five are answered here**, and every one of them was
re-derived against the code by the orchestrator before this phase was commissioned — none was taken
on the reviewer's word.

---

## 2. What changed

| File | What changed |
|---|---|
| `src/lib/browser/reconciliationCoordinator.ts` | **two comments rewritten**, no statement touched — the `start()` flush arm and the stale-generation arm of `runOneDrain()` |
| `src/lib/browser/workspace.test.ts` | one `it` name narrowed, **one new case added** — *"drains for no failed open, and holds later triggers behind the gate it left closed"* |
| `docs/decisions/2d-5-3-notes.md` | §2.1 item 2 and §7 item 10 corrected; §7 gains item 11 for the round's Low |
| `docs/decisions/2d-5-3-A-notes.md` | **new** — this file |

`src/lib/browser/workspace.svelte.ts` is **byte-identical to `HEAD`**. It was mutated three times
during this phase to prove tests able to fail, and restored from a copy each time;
`git status --short` shows it unmodified.

**No Rust file changed**, so no `cargo` gate could move and none was run — which is a statement about
what was *not* measured, not a claim that they pass. The last recorded Rust figure is 2d-5-3's
`cargo test --workspace` → 1320.

---

## 3. The four findings, and what each fix was

### 3.1 Finding 1 — a source comment asserting wiring that does not exist

`src/lib/browser/reconciliationCoordinator.ts`, the flush arm at the end of `start()`. The comment
justifying it said:

> *Not, however, an `open()` still loading: **`AppShell` calls `start()` and `open(null)` in the same
> block**, so this is reached with the gate already closed whenever the host opens first…*

**Re-derived: it does not.** `rg '\.start\(\)' src --glob '!*.test.ts'` matches exactly one line,
`src/lib/browser/workspace.svelte.ts:3506` — which is the `reconciliation.start()` call **inside**
`BrowserState.start()`'s own body (the member is defined at :3502), so it is the wrapper passing the
call through and not a caller of it. Nothing calls that wrapper. `src/lib/components/AppShell.svelte`'s `onMount` calls
`void browser.open(null)` alone. **Nothing in production calls `start()` at all**, which is what
`PROGRESS.md` and `2d-5-3-notes.md` §3.1 both say in as many words elsewhere — the coordinator is
unreachable in the shipped window until 2d-5-7.

This is `CLAUDE.md`'s named worst defect class: a record — here, a source comment, which is the
record a later author is most likely to trust — claiming something the code does not give. And the
author most likely to read it is 2d-5-7's, whose whole job is to wire `start()`.

**The fix.** The comment now rests on the predicate rather than on a call order. What the arm relies
on is that `drainMayStart()` is the question being asked, so a host that announced an open through
`workspaceOpened()` and has not reported `ready` reaches the line with the gate already closed —
true of any host, with no call order assumed. A second paragraph states plainly that no production
code calls `start()` today, that `BrowserState.start()` is its only wrapper and that nothing invokes
that wrapper either, and hands the wiring to 2d-5-7 as that step's business.

### 3.2 Finding 3 — a comment asserting a coupling the module denies twice

`runOneDrain()`'s `openedAt !== host.openGeneration()` arm said:

> *…and **the cursor has already been cleared by `workspaceOpened()`**; moving it here would ask the
> next drain with a watermark from a queue this session is no longer reading.*

**Re-derived: that asserts a coupling this module denies in two places.** `awaitingReady()`'s doc
comment says the gate *"is what this coordinator was **told**, deliberately, and not a comparison
with `host.openGeneration()`"*, and the very next arm's own comment says *"the generation is read
through `ReconciliationHost` and the gate is set through a call on this interface, and **nothing ties
the two**"*. A host that moves `openGeneration()` without calling `workspaceOpened()` reaches this arm
with the cursor intact, so the stated reason is false for exactly the host the module refuses to
assume anything about. The **action** was right either way, which is why no test could fail.

**The fix.** The comment now states what is true and sufficient on its own: the batch belongs to a
lifecycle on its way out, so neither sequence state moves, **whether or not the cursor has been
cleared**; nothing on that line observes `workspaceOpened()`; and what makes the refusal right is the
batch itself — its `newest_sequence` indexes a queue this session is no longer reading. The
independence is now named rather than contradicted, with a pointer to the two places that state it.

**The distinction between the two arms is deliberately kept.** The arm above compares *the number the
host reports*; the arm below asks whether the coordinator was *told* an open started and not told it
finished. The two comments do not now say the same thing, and making them say the same thing would
have deleted the reason the second check exists.

### 3.3 Finding 4 — a test name claiming a case its body did not cover

`src/lib/browser/workspace.test.ts` had
`it('drains again once a workspace reaches ready, and never for a failed one', …)` with **no failing
open anywhere in its body**. The name was narrowed to *"drains again once a workspace reaches ready"*,
and the missing half was added as its own case rather than dropped — the review's finding 2 points at
exactly that gap, so covering it shrinks two findings at once.

The new case is `src/lib/browser/workspace.test.ts:7591`,
**"drains for no failed open, and holds later triggers behind the gate it left closed"**. It scripts a
refused `open_workspace`, starts the coordinator with an injected wake source, and asserts three
things: the registration drain happens (`[0]`); the failed `open()` adds none and leaves
`state.status === 'failed'`; and a wake arriving **afterwards** adds none either, because the gate
`workspaceOpened()` closed was never opened. The third assertion is what makes the case about the
*gate* rather than about the mere absence of a trigger.

**It is proven able to fail.** The production behaviour it pins is that `open()`'s refused-open arm
returns *before* `reconciliation.workspaceReady()`. Putting `workspaceReady()` on that failure arm
makes it fail:

```
AssertionError: expected [ +0, +0 ] to deeply equal [ +0 ]
 ❯ src/lib/browser/workspace.test.ts:7616:28
```

and the `afterEach` budget fails beside it with `expected 2 to be 1`. Restored, it passes:
`Tests  1 passed | 195 skipped (196)`.

### 3.4 Finding 2 — a residual in the record stated wider than it was

`2d-5-3-notes.md` §7 item 10 said *nothing tests the gate against a real `open()`*, and that the
wiring is something *"§2.1 item 2 asserts by reading the source"*.

**Re-derived: both halves were wrong.** `src/lib/browser/workspace.test.ts:7566` already drove a real
`state.open(null)` on a started coordinator and already discriminated on **both** calls. Measured
here, by mutating `open()` in `workspace.svelte.ts` and running that one case:

| Mutation | What the case reports |
|---|---|
| delete `reconciliation.workspaceReady()` | `expected [ +0 ] to deeply equal [ +0, +0 ]` — the open triggers no second drain at all |
| delete `reconciliation.workspaceOpened()` | `expected [ +0, 6 ] to deeply equal [ +0, +0 ]` — the second drain asks `6`, because the registration's answer set `newest_sequence: 6` and nothing cleared the cursor |

So the success path is executable coverage, not a reading of source. **What genuinely remained was the
failing open** — which the same item stated correctly one sentence later, and which §3.3 above has now
closed.

**The fix.** Item 10 is rewritten: it opens by saying it was wrong and pointing here, cites both tests
by path and line, carries the two mutations with their exact assertion messages, and narrows the
residual to what actually remains. §2.1 item 2 gained the same two citations, so the paragraph that
described the wiring no longer reads as the thing asserting it.

**What the narrowed residual is now.** No case drives a *superseded* `open()` (two opens overlapping,
the first returning stale) or a refused `list_documents` across a started coordinator. Both leave
`workspaceReady()` unreached through the same early-return shape as the two covered arms, and neither
is asserted — checked by reading every `it` in the *"the reconciliation lifecycle"* suite: none scripts
`list:` and none starts a second `open()` before the first has been awaited.

### 3.5 The Low — a check-and-spend shape, recorded and not restructured

`pump()` evaluates `drainMayStart()` in its loop condition, and the first thing `runOneDrain()` does
is call `host.openGeneration()` — a **caller-supplied** function — before `host.drain()`. A host whose
accessor re-entered `workspaceOpened()` would have the gate closed and the drain issued anyway. That
is the check-and-spend *shape* `CLAUDE.md` names, and this project has shipped real instances of it.

**It is inert as shipped**, and that was checked rather than assumed: the only production accessor is
`() => openGeneration` in `workspace.svelte.ts`, a plain read of a module-local number that calls
nothing.

**It is deliberately not restructured.** Re-asking the gate between the generation capture and the
drain, or hoisting the capture above the loop condition, changes the ordering of a pump that had two
real concurrency blockers fixed **one round ago**, and the risk of that change is larger than the risk
of the shape. It is recorded as `2d-5-3-notes.md` §7 item 11, *recorded only*, with the note that a
later step giving `ReconciliationHost` an accessor with behaviour behind it is where it stops being
inert.

---

## 4. What the round did **not** verify, carried honestly

The review's own *Not verified* list, reproduced rather than summarised away:

1. **The gates were not re-run by the reviewer** — the brief said the orchestrator does that. They
   were run here; §5 is the result.
2. **Only the release-window case was hand-traced to failure-on-revert.** The other seven cases'
   *"proven able to fail"* claims in `2d-5-3-notes.md`, and §8.3's five-failure transcript, were
   **read, not reproduced**. This phase did not reproduce them either. So 2d-5-3's own
   able-to-fail claims for those eight cases remain on that round's word.
3. **No window reading**, and none is owed: the coordinator has no production `start()` caller, so
   there is nothing a window could be made to show. 2d-5-7 owns the lifecycle reading.

Two more bounds this phase adds to that list:

4. **`npx vitest run … -t '<name>'` was the harness for every able-to-fail proof here.** It reports
   the named case and skips the rest, so a mutation's effect on *other* cases was not observed. Both
   mutations in §3.4 certainly break more than the one case shown; what is claimed is only the exact
   message that case produced.
5. **No `cargo` gate was run**, because no Rust file changed. §2 says so; it is not a pass.

---

## 5. The gates

Run after every change in §2, on the working tree with the uncommitted window instrument in it,
which is the tree `PROGRESS.md`'s baseline `1320 / 441 / 2306 / 188` was measured on.

| Command | Result | Against the baseline |
|---|---|---|
| `npm run check` | **441 files, 0 errors, 0 warnings** | unchanged — no file added or removed |
| `npm test` | **2307 passed**, 60 files | **+1**, exactly the one case §3.3 adds |
| `npm run build` | **188 modules transformed** | unchanged — no new source module, no new component |
| `npx vitest run src/lib/browser/workspace.test.ts src/lib/browser/reconciliationCoordinator.test.ts` | **236 passed**, 2 files | 196 + 40 |

All four exited `0`.

**The module count was checked both ways**, per `CLAUDE.md`: the arithmetic (188, unchanged, because
this phase adds no source module and no styled component) **and** the discriminating bundle search —
`rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` matches **nothing**
(server-only, must be absent) and `rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js`
matches **2** (client-only, must be present, and proves the search can match at all).

**The instrument is untouched.** `git diff --stat src-tauri/src/main.rs src/main.ts` is
`5 insertions(+), 1 deletion(-)`, exactly as `PROGRESS.md` requires; `src-tauri/src/probe.rs` and
`src/probe.ts` remain untracked. Nothing was committed by this phase.

---

## 6. What this round does under `CLAUDE.md` §7

§7.1 reads the **fix round's diff**, and this phase's diff touches two source files:
`src/lib/browser/reconciliationCoordinator.ts` (comments only) and
`src/lib/browser/workspace.test.ts` (a name and a new case). The unit is the file and not the line,
and a comment-only change to a source file **is** a source change here — the rule says so explicitly,
and it says so because a comment is where this project keeps several of its contracts, which is
precisely what findings 1 and 3 are about.

**So §7.1 commissions a round on this fix**, scoped to these two files. Whether that round runs is
the orchestrator's to decide under §7.4 — the `goahead` cap of two review invocations per phase
outranks §7 and can only subtract rounds from it. This file states what §7 asks for and claims no
authority over the cap.

Nothing here is `BLOCKED`. No item in §7 below names a correctness defect in a source file.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round**; §7.1 is the only mechanism
and it reads a diff.

1. **Nothing in this repository checks a comment against the code it describes — *recorded only*.**
   Findings 1 and 3 were both false sentences in source comments, both survived every gate, both
   survived 2d-5-3's own review, and both were found only by a human-style read. The two rewritten
   comments are as checkable as the old ones were, which is not at all. The only structural defence
   is the one this project already uses — write the comment against what the *predicate* gives rather
   than against what a caller is believed to do — and §3.1's rewrite is an instance of it, not an
   enforcement of it.

2. **The two rewritten comments are longer than the ones they replace, and length is not truth —
   *recorded only*.** Each now states a negative (*no production caller*, *nothing ties the two*)
   that a later step will falsify **by doing its job**: 2d-5-7 wiring `start()` makes §3.1's second
   paragraph stale the day it lands. That is written into the comment as a pointer to 2d-5-7 rather
   than left implicit, but nothing forces that author to update it.

3. **The new case asserts through `drainSequences` and `state.status`, and observes the gate only
   indirectly — *recorded only*.** `BrowserState` exposes no `awaitingWorkspaceReady()` of its own,
   so the case infers a closed gate from a wake producing no drain. That inference is sound here
   because the coordinator suite pins the gate directly, but a future change that stopped the wake
   reaching the coordinator at all would satisfy this case for the wrong reason.

4. **Two `open()` early-return arms remain unasserted across a started coordinator — *actionable*,
   and not a correctness defect in source.** A superseded generation and a refused `list_documents`
   both leave `workspaceReady()` unreached, and neither has a workspace-level case. They are the same
   early-return shape as the two arms that *are* covered, and `open()` is correct for them today —
   this is a coverage gap, not a defect, so §7.3's blocker clause does not apply. A later step in the
   2d-5 chain may adopt it; `2d-5-3-notes.md` §7 item 10 now names both.

5. **2d-5-3's able-to-fail claims for seven of its cases, and its §8.3 transcript, are still
   unreproduced — *recorded only*.** Carried from §4 item 2, in the review's own count. This phase
   reproduced three mutations (one for the new case, two for the correction in §3.4) and no others.
   Nothing suggests the seven are wrong; nothing here checks them.

6. **No window reading, and none is owed — *recorded only*.** No `.svelte` file changed, nothing is
   drawn, and the coordinator still cannot run in the shipped window. 2d-5-7 owns the narrow
   lifecycle reading, and `2d-5-split-notes.md` §6 item 7 says the readings 2d-5-2 and 2d-5-7 owe
   are narrow regression readings, neither of which may be cited as evidence that a wake was
   delivered.

7. **The check-and-spend shape in `pump()`/`runOneDrain()` is recorded and left standing — *recorded
   only*.** §3.5 is the argument. It names a shape rather than a defect: the accessor that would make
   it reachable does not exist, and the item says which future change would create one.
