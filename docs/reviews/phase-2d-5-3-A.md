Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-A — adversarial round on 2d-5-3's fix

Scope: the fix delimited in the brief. Read-only; nothing changed but this file.
`npx vitest run src/lib/browser/reconciliationCoordinator.test.ts` → 40 passed.

## Blockers

None. Both fixed defects hold.

**Blocker 1 (release re-entry) — re-derived, not accepted.** I hand-traced the microtask
queue of `it('does not strand a request made while the pump gives its slot back')`:
`answer()` queues `runOneDrain`'s resumption R1, `.then(A)` queues A; order runs
R1 → A → F1 → R2 (pump loop exits, `running` resolves, `release` queued) → **B
(`requestDrain`, sees `inFlight !== null`)** → F2 → `release`. B lands strictly between
loop exit and `release`. The case therefore pins the re-entry rather than passing through
the loop, and `asked` would stay `[0]` without it. No-spin holds: every restart is guarded
by `requested`, which the loop clears before each drain, and a gate that closed under the
loop fails the same predicate in `release`. `release` is throw-free (three local reads plus
`ensurePumping`, whose only throwing statement is a call to an `async` function). The
`.then(release, release)` reasoning is correct. The `inFlight !== running` identity check is
unreachable-defensive, which is fine.

**Blocker 2 (open gate).** `drainMayStart()` is the only predicate and all three
`ensurePumping()` call sites read it. `workspaceReady()` opens before it requests. The
post-await `awaitingReady()` arm is genuinely independent of the generation arm and the
test that isolates it moves no generation.

## Should-fix

1. `src/lib/browser/reconciliationCoordinator.ts:966` — the comment justifying `start()`'s
   flush arm states *"`AppShell` calls `start()` and `open(null)` in the same block"*.
   It does not. `rg '\.start\(\)' src` returns only `workspace.svelte.ts:3506` (the wrapper)
   and test files; `AppShell.svelte:26-31` calls `browser.open(null)` alone. §8's own opening
   paragraph says nothing calls `start()` until 2d-5-7. A source comment asserting wiring that
   does not exist is this project's named worst defect class, and 2d-5-7 is exactly the author
   who will read it as settled.
2. `docs/decisions/2d-5-3-notes.md:342-350` (§7 item 10) — *"What that leaves unpinned is the
   wiring … which §2.1 item 2 asserts by reading the source."* `src/lib/browser/workspace.test.ts:7565`
   already pins both calls through a real `open()`: delete `workspaceReady()` and there is no
   second drain (`[0]` ≠ `[0, 0]`); delete `workspaceOpened()` and the second drain asks `6`,
   not `0`. The genuine residual is only the *failing* open, which the same item states
   correctly one sentence later.
3. `src/lib/browser/reconciliationCoordinator.ts:737` — *"the cursor has already been cleared
   by `workspaceOpened()`"* asserts a coupling that §8.3 and `awaitingReady()`'s own doc
   comment (line 596) explicitly deny: a host may move `openGeneration()` without ever calling
   `workspaceOpened()`, and then this arm is reached with the cursor intact. The action is right
   either way; the stated reason is not.
4. `src/lib/browser/workspace.test.ts:7565` — the name claims *"and never for a failed one"*
   and the body has no failing open. Outside the fix diff (pre-existing), but it is the case
   §7 item 10 points at.
5. Low, shape only: `pump()` evaluates `drainMayStart()`, then `runOneDrain()` calls
   `host.openGeneration()` — a caller-supplied function — before `host.drain()`. A host whose
   accessor re-entered `workspaceOpened()` would have the gate closed and the drain issued
   anyway. Today's accessor is `() => openGeneration`; `CLAUDE.md` nonetheless names this
   check-and-spend shape.

## The two carried classifications

- *No type pairs `workspaceOpened()` with `workspaceReady()`* (§7 item 9): **agree, recorded
  only.** The single host omits the second call deliberately on both failure arms and the
  window shows a failure there, so it names no defect in source.
- *No test drives the gate through a real `open()`* (§7 item 10): **agree with the mark,
  disagree with the sentence** — see should-fix 2. Both calls have executable coverage on the
  success path; the uncovered path is the failing open.

## Not verified

- Gates not re-run (brief says the orchestrator does).
- Only the release-window case was hand-traced to failure-on-revert; the other seven tests'
  "proven able to fail" claims and §8.3's five-failure transcript were read, not reproduced.
- No window reading; the coordinator has no production `start()` caller.
