Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-K — round 11 of the `reconciliationCoordinator.ts` tail

Scope: commit `3428cde`'s changes to `src/lib/browser/reconciliationCoordinator.ts` and
`docs/decisions/2d-5-3-J-notes.md` in full. No build/test/package command was run, by instruction.

## BLOCKERS

None.

## SHOULD-FIX (Medium) 1 — `reconciliationCoordinator.ts:792`: the conclusion holds, the stated reason is false

> `// drain at all: it never calls `start()`, so no coordinator runs in it.`

Derivation, from the code and not from the notes. `workspace.test.ts:1229` builds a `BrowserState`,
which constructs the coordinator unconditionally (`workspace.svelte.ts:1896`). `open()` then calls
`reconciliation.workspaceOpened()` (`workspace.svelte.ts:2569`) on entry — twice in that test — and
the second, successful open reaches `reconciliation.workspaceReady()` (`:2687`), whose body is
`requestDrain('workspaceOpened')` (`reconciliationCoordinator.ts:1164`). So coordinator code does run
in that test, and a drain **is** requested. What stops a physical drain is not the absence of a
coordinator but `drainMayStart()` at `:621` — `started && !disposed && !awaitingReady()` — returning
`false`, so `requestDrain` records the reason and returns at `:1057` without `ensurePumping()`; `:1034`
says in as many words that such a request is *remembered rather than dropped*.

`docs/decisions/2d-5-3-J-notes.md:45` states the same claim in its strongest and plainly false form:
*"`start()` is the only route to the coordinator"*. `workspace.svelte.ts:2569` and `:2687` are two
further routes, and one of them requests a drain.

Fix: replace the causal clause with the gate. E.g. *"…and issues no drain: `start()` is never called,
so `drainMayStart()` refuses every request `workspaceReady()` makes and the pump never runs."* Correct
`notes:45` the same way.

## SHOULD-FIX (Medium) 2 — `2d-5-3-J-notes.md` §5 and §7.8: three line anchors that do not resolve, one of them stale inside its own commit

Measured with `grep -n` on the committed file:

- §5 cites `:798` for *"the paragraphs above"* — it is on **797**.
- §5 cites `:819` for the quoted mention *"the paragraph above"* — it is on **818**.
- §7 item 8 cites `:800-801` for *"no scripted-command suite … drives Rust at all — its failed-open
  case"* — that is the **pre-fix** location (`git show eec0b70:…` → 800); post-fix it is **812-813**.

§7 item 3 of the same file invokes 2d-5-3-C's Medium — *"a line anchor that went stale inside its own
commit"* — as the reason the fix quotes rather than anchors. The record then shipped three of them.
Fix: re-anchor to 797, 818 and 812-813, or drop the numbers and cite by quoted text as §7.3 argues.

## SHOULD-FIX (Medium) 3 — `2d-5-3-J-notes.md` §5: "Three positional phrases stay" is an uncounted count, and the fix added one it does not record

§5 claims the block was swept for *above / below / here / … / later* "across the whole block" and that
exactly three positional phrases survive, none a citation of a prose site. Running that pattern over
lines 730-860 returns more, including two the sweep's own words match:

- `:820` — **"The case-2 sentence above is not a second site for it."** A citation of a *prose site by
  position*, one line below the phrase §5 enumerates as its third survivor, in the block whose whole
  convention is naming sites by opening words. Neither converted nor recorded.
- `:765-766` — **"reached only inside the swap block below it"**, introduced by *this* fix. Matched by
  the sweep pattern, absent from §5's list of three. Its `it` is also unresolved: the nearest
  antecedent is *"any sentence"*; the intended one is the early return at `commands.rs:683`.

Fix: either convert `:820` to *"the sentence opening 'In case 2 the batch already is'"* and reword
`:766` to *"inside the swap block that follows `Workspace::discover(root)?`"*, or widen §5's list and
say why each stays. Do not leave the count at three.

## What I re-derived and found sound

- Both `commands.rs` quotations. `:625-627` reads *"On a **failed** discovery this method returns
  before touching the session, so the previous workspace *and its watcher* both stay exactly as they
  were."* and `:679-681` *"**A failure leaves the previously open workspace in place**…"*; both anchors
  resolve; the comment drops only markdown emphasis markers.
- The absence claim *"neither names the queue"*. Reading the whole doc comment (`:593-681`), the only
  queue sentence is `:650` (success path); `:631` names a "queue consumer" in the deadlock paragraph
  and states nothing about the failure path. `reconciliation.begin_epoch` has exactly one production
  call site, `:707-708`, inside the swap block.
- `reconciliationCoordinator.test.ts:749-767` does `control.generation += 1` and asserts
  `'staleOpen'`, so it reaches this arm; `:941` moves no generation and reaches the `awaitingReady()`
  arm, so the disambiguation is right.
- `workspace.test.ts:1229` never calls `state.start()` (no `beforeEach` in the file; the only
  `start()` calls are `:7558`+).
- All four opening-word anchors resolve to exactly one paragraph each, and the two re-anchors name the
  same paragraphs the positional phrases did.

## NOT-VERIFIED

- The repository-wide absence claim *"no test in this repository drives that overlap against Rust"*.
  I checked `watch_check.rs`'s test list and every `drain_external_changes` call site and found no
  concurrent open+drain, but an absence claim over a whole repository is not something a grep closes.
- §7 item 1's 123 / 55 / 80 archive ranges: the arithmetic is exact, the content of the ranges is not
  checked.
- All four gates: no build, test or package command was run, by instruction. A green gate is evidence
  about nothing above.
