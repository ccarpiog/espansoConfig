Reviewer: autoclaude adversarial reviewer

Phase 2d-5-3 — the drain lifecycle coordinator. Both findings below were **reproduced against the
real module** with `node --experimental-strip-types` over a scratch file in `/tmp`; nothing in the
repository was modified.

## High 1 — the release window strands a requested drain (the orchestrator's suspicion is real)

`reconciliationCoordinator.ts:696` `void running.then(release, release)`, with the loop exit at
`:661`. The window is not "between the loop exiting and `release`" reasoned about loosely — it is
exact and FIFO-reachable. A microtask `M` pending when the last drain settles runs *before* the
pump's final continuation `B` (so `requested` is seen), but any microtask `M2` that `M` queues lands
**after** `B` and **before** the `release` `B` queued. `M2` calling `requestDrain` sets
`requested = true`, sees `inFlight !== null` (`:675`), returns; `release` then nulls the slot.

Measured, real module, host drain resolving in one tick: chain depth 2 →
`calls=1 pending=["foreground"] pumping=false`. Depths 0,1,3..10 → `calls=2`. So it is one specific
interleaving, not a hypothetical, and any async caller two microtasks deep hits it —
`open()`'s tail calling `workspaceReady()` (`workspace.svelte.ts:2665`) is exactly that shape.
Consequence: the reason stays on `pendingReasons` with no pump; the drain is deferred to the next
trigger, and if none arrives the external change is never observed. `requestDrain`'s JSDoc
(`:376-384`) — *"a boolean is set, and the pump does the rest"* — is the record claiming what the
code does not give. Fix is one line: have `release` re-enter `ensurePumping()` when
`requested && !disposed`.

## High 2 — a drain during an `open()` adopts the previous workspace's epoch, permanently

`workspace.svelte.ts:2562` bumps and clears at `open()` **entry**, so any trigger between entry and
`ready` issues a drain whose captured `openGeneration` is already current while Rust still holds the
old workspace (`commands.rs:1357` `with_workspace_read`). `accept()`'s `if (!adopted)`
(`:560-563`) then adopts the **old** epoch. `workspaceOpened()` set `adopted = false`, so `onWake`
(`:746`) also lets any wake trigger this. Reproduced:

```
mid-open adoption: {"kind":"watching","epoch":5}
after ready:       {"kind":"watching","epoch":5}
drains: [ ...accepted(epoch 5)..., {"afterSequence":3,"reasons":["workspaceOpened"],"outcome":"staleEpoch"} ]
```

The post-`ready` batch is rejected as `staleEpoch`, `adopted` is never re-cleared, every later wake
at the true epoch is dropped and every later batch is `staleEpoch`. Reconciliation is silently dead
for that workspace with `watchState()` reporting `watching` at a wrong epoch — ruling 9's "never
presented as ordinary coverage" defeated from the other side. Ruling 8 says the epoch is learned from
the *first post-open* drain; the code accepts any drain at the current generation. The coordinator
already knows whether `workspaceReady()` has run for this generation and does not consult it. No test
covers a drain resolving between `open()` entry and `ready`.

## Low

- `cursor()` (`:848-850`) returns a plain literal; its JSDoc says *"A frozen snapshot"*. Nothing is
  frozen. The second clause (numbers not exposed) is true.
- `isPumping()` (`:886-888`) claims *"`true` while the single-flight pump is running"*; in High 1's
  window it is `true` while nothing runs.

## Checked and clean

Exact unlisten counts are pinned, not "at least one" (`reconciliationCoordinator.test.ts:836,847,853`
— `toBe(1)`, `toBe(0)` then `toBe(1)`; workspace side `events.unlistens()).toBe(1)`). Ruling 16's
abandon arm (`:718-725`) calls the received unlisten rather than storing it; `dispose()` nulls before
calling (`:814-821`). Watermark advances for an empty batch (`:577`); `lastDiscarded` strictly greater
(`:564`); epoch-mismatched batch moves neither sequence state (`:634-641`). Scope: no observation
applied, no `discarded` recovery, no i18n key, no `.svelte` file, both imports of `../ipc/events` are
`import type`. `workspace.test.ts`'s `afterEach` is genuinely **extended** — `drainBudget` defaults to
0, no opt-out, plus a separate unconsumed-answer assertion. `§7` marks every item.

## NOT-VERIFIED

- I did not re-run `cargo test`, `npm test`, `npm run check` or `npm run build`; I relied on the
  orchestrator's transcript for all four counts and the two bundle oracles.
- Whether High 1 or High 2 is reachable **today in a shipped window**: it is not, because nothing
  calls `start()`. Both are latent until 2d-5-7 and both are correctness defects in source now.
- `2d-5-3-notes.md` §6.1's claim that the four harness paths are untouched — I read `git status` only,
  not the harness diff.
