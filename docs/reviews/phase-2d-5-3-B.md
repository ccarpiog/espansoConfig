Reviewer: autoclaude adversarial reviewer

Scope: the source half of `37d2aed` — `src/lib/browser/reconciliationCoordinator.ts` (comment-only)
and `src/lib/browser/workspace.test.ts` — plus `docs/decisions/2d-5-3-A-notes.md`.

## Verified mechanically

- **Every negative in the `start()` comment (:979) holds.** `rg '\.start\(\)' src/` outside tests
  matches `workspace.svelte.ts:3506` (inside `BrowserState.start()`'s own body) and nothing else; no
  `.svelte` file contains `start(` at all; neither `src/main.ts` nor the uncommitted `src/probe.ts`
  calls it. `drainMayStart()` (:620–621) is the predicate, and a `workspaceOpened()` without `ready`
  reaches :970 with `openInProgress === true` — `workspaceOpened()` never sets `requested`, so the
  arm is only reachable with a request from another trigger, and the gate is closed there.
- **"Nothing on this line observes `workspaceOpened()`" (:739) holds**, and `awaitingReady()`'s
  JSDoc (:592–605) and the arm at :749 do state the independence attributed to them.
- **The new case can fail, both halves.** Run in a scratch copy, never in the repo:
  `reconciliation.workspaceReady()` added to `open()`'s refused arm → `expected [ +0, +0 ] to deeply
  equal [ +0 ]` at `workspace.test.ts:7616` plus `expected 2 to be 1` — exactly what the in-test
  comment claims. `drainMayStart()` reduced to `started && !disposed` → fails at **:7624**, the wake
  assertion, so the second half of the name is not vacuous: after `workspaceOpened()` clears
  `adopted`, `onWake` passes its epoch filter and would drain at `afterSequence` 0.
- Both mutations `2d-5-3-A-notes.md` §3.4 tabulates reproduce with the exact messages quoted.
- Rename orphaned nothing: the only surviving references to the old name are the two records that
  describe the rename, and `2d-5-3-notes.md:370`'s `:7566` citation still lands on the renamed case.
- `npm test` re-run here: **2307 passed, 60 files**, matching §5.

## Medium

1. `reconciliationCoordinator.ts:737` and `:743` — the rewrite trades one unstated coupling for an
   unstated **ordering** assumption. "Every identity in the batch belongs to a workspace lifecycle on
   its way out" and "its `newest_sequence` indexes a queue this session is no longer reading" are
   guaranteed only if Rust serviced this drain *before* `open_workspace` replaced the session. The two
   invokes are unordered; a drain that loses the session lock returns the **incoming** lifecycle's
   epoch-scoped queue, and this arm fires before the epoch check, so nothing here can tell. The
   refusal is right either way (`workspaceOpened()` reset `watermark` to 0 and cleared `adopted`), but
   the sentence the comment nominates as "what makes the refusal right on its own" is the one that
   rests on a call order — the defect shape finding 1 was raised to remove.

## Low

2. `2d-5-3-A-notes.md` §3.1 — "`rg '\.start\(\)' src --glob '!*.test.ts'` matches exactly one line"
   now matches **two**: the fix's own comment at `:979` contains `BrowserState.start()`. True when
   re-derived, false for a reader who re-runs it.
3. §3.3's "proven able to fail" evidence covers only the first two assertions; the third's
   discrimination is asserted, not measured. Measured here (above) and it holds.

§7 item 4 re-judged: a coverage gap, not a source correctness defect. Agreed.
