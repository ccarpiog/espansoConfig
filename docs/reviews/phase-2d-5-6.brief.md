# Review brief — Phase 2d-5-6

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-5-6.md` (overwrite it).

**Time budget:** 12 minutes.

---

## The phase and its goal

Phase **2d-5-6** is step 6 of the 2d-5 design consult: **the file-wide route-guard closure.** Its
binding rulings are `docs/decisions/2d-5-split-notes.md` §3 entries **34 and 35**; the spec is step 6
of `docs/reviews/phase-2d-5-design.md` (~line 340) and the "### 2d-5-6" section of the split notes
(~line 98); the origin of the work item is `docs/decisions/2d-4b-notes.md` §14.8 item 1, re-derived
by the split notes' §7. Restated so nothing is reviewed from memory:

- **The defect being closed.** `src/lib/browser/workspace.svelte.ts` imports its command wrappers
  (`$lib/ipc/commands`) at module level, so a call made through one of those bindings rather than
  through the injected `BrowserCommands` increments the test-side `drains` counter in nothing. As of
  2026-09-05 the route was caught only by one per-case `expect(invoked)` in `DetailPane.test.ts` and
  five in `RestorePane.test.ts`, in no `afterEach`, and `workspace.test.ts` — the file whose subject
  holds the route — had no `@tauri-apps/api/core` mock at all.
- **34 — mock `@tauri-apps/api/core`, never `$lib/ipc/commands`.** The real wrapper module and the
  real `REAL_COMMANDS` assembly stay in place; that is what makes a module-level bypass reach the
  recorded `invoke`. A partial command-module mock would make the suite test a mocked composition
  module.
- **35 — the blanket `expect(drained).toBe(0)` is replaced, not deleted.** Every reconciliation test
  supplies a finite scripted drain-answer queue; each intended trigger asserts an exact call count and
  `afterSequence`; `afterEach` asserts the budget was consumed exactly with nothing pending; the
  core-level `invoked` assertion stays **zero in every test**; every coordinator created is disposed
  before its case ends.
- **What 2d-5-5b widened.** All six writing wrappers now open a per-document barrier lease
  (`beginWrite`) immediately before their command and close it in a `finally`. A call escaping through
  a module-level binding escapes the barrier as well as the counter, and a lease opened but never
  closed leaves that document's reconciliation silently dead. No case drives two overlapping writes of
  one file, so nothing would have noticed.

**Components: none** — three component *test* files change; no `.svelte` renderer, no Rust, no
production `.ts` module. `git diff --stat src/lib/browser/workspace.svelte.ts` is empty.

## The changed files

```
 M src/lib/browser/workspace.test.ts       +303 −79
 M src/lib/components/DetailPane.test.ts    +32 −11
 M src/lib/components/RestorePane.test.ts   +34 −14
?? docs/decisions/2d-5-6-notes.md           (the phase record, 158 lines)
```

**Four paths in the tree are NOT this phase's and must not be reviewed or reported on:**
`src-tauri/src/probe.rs`, `src/probe.ts`, and the hook lines in `src-tauri/src/main.rs` and
`src/main.ts`. They are a temporary window-reading instrument, never committed. Their pin is
`5 insertions(+), 1 deletion(-)` and it still holds. `PROGRESS.json` is the orchestrator's in-flight
marker and is not under review.

## What the phase claims to have built

Read `docs/decisions/2d-5-6-notes.md` — it is the phase's own account and is **itself under
review**. In outline:

- `workspace.test.ts` gained the uniform hoisted rejecting `@tauri-apps/api/core` spy (ruling 34) and a
  file-wide `afterEach` asserting `expect(invoked).not.toHaveBeenCalled()`, with a `beforeEach`
  clear; the two component files now carry the same file-wide assertion on their existing spies.
- `workspace.test.ts`'s drain budget now carries **cursors**: `expectDrains([0, 0, 5])` — all 33
  declarations rewritten from a measured run; `afterEach` asserts the asked sequences equal the budget,
  the count equals its length, and nothing is pending (ruling 35). The component files keep an
  explicit exact-zero budget since no case there reconciles.
- A same-named recording wrapper over the aliased `createBrowserState` lets `afterEach` require
  every **started** coordinator disposed and — via the public `writeInFlight(document)` — no lease
  left open on any listed document or any file a writing `vi.fn` was asked to write, enumerated
  through a hand-kept `BARRIERED_MEMBERS` list of six.
- Both component mount helpers now `dispose()` in `stop()`.
- **Guard proof recorded in the notes:** routing `saveMatch` through the module-level binding gave
  `16 failed | 313 passed` naming `"save_match"`; reverted exactly.

## Where to be adversarial

1. **Is the spy really on the boundary, and is it really reached?** Confirm `vi.mock` targets
   `@tauri-apps/api/core` and nothing mocks or partially mocks `$lib/ipc/commands` anywhere in the
   three files. Confirm that the hoisting works with the file's import order — a `vi.mock` that lands
   *after* the module under test is imported guards nothing while the assertion stays green. Then ask
   whether the proof in the notes actually demonstrates the file-wide assertion firing, or only a
   per-case one.
2. **Green and false.** The project's worst defect class is a comment or a record sentence claiming a
   guarantee the code does not give. The `afterEach` reads, clears, then asserts — check that a failure
   in one case cannot be attributed to the next, and that a case which *throws* before its end (a
   rejected `await`) still meets every `afterEach` question rather than skipping one.
3. **Ruling 35's cursors.** `expectDrains([0, 0, 5])` was "rewritten from a measured run" — 33
   declarations. A budget derived by running the code and copying what it did asserts whatever the
   code does. Pick three cases whose cursor sequence is non-trivial and check the numbers against the
   coordinator's documented cursor semantics (`reconciliationCoordinator.ts`: `{ epoch, watermark,
   lastDiscarded }`, `host.drain(watermark)`) — do they follow from the scenario, or only from the run?
4. **The barrier question is bounded.** The in-flight table is private; the test asks
   `writeInFlight(document)` over an enumerated candidate set (the listed documents plus any file a
   writing `vi.fn` was asked to write, through `BARRIERED_MEMBERS`). Is there a document a wrapper can
   open a lease on that this enumeration cannot reach? Is the six-member list complete against the six
   writing wrappers in `workspace.svelte.ts` today, and does the comment say it is hand-kept?
5. **Disposal.** The recording wrapper asks the question only of **started** coordinators. Is there a
   path where a state registers a subscription or a pump without `started()` reporting it? Do the
   component mount helpers' `stop()` disposals run on every exit, including a mount that throws?
6. **Seven per-case `invoked` assertions kept beside a file-wide one.** The notes call them strictly
   redundant in effect and kept for locality. Is any of them now asserting something *different* from
   the file-wide one — e.g. on a differently scoped spy — such that "redundant" is false?
7. **The notes' re-derived table.** Its per-file counts (spy line, counter line, `afterEach` line,
   `invoked` assertion count, case count) are claimed measured with `rg`. Spot-check two of them.

## Verification already run, by the orchestrator, each gate on its own

You do not need to re-run these; report it if you find a figure that is wrong.

| Gate | Result |
|---|---|
| `npm test` | exit 0, **2466 passed, 61 files** (unchanged from 2d-5-5b — no case added) |
| `npm run check` | exit 0, **443 files, 0 errors, 0 warnings** |
| `npm run build` | exit 0, **189 modules**; server-only bundle markers **absent**, client-only **present (2)** |
| `cargo test --workspace -- --test-threads=1` | running in the background at brief time; no Rust file changed, so its figure is expected unchanged at 1320 |

Rung: **`1320 / 443 / 2466 / 189`**, unchanged from 2d-5-5b.

## Project rules that bind this change

- `CLAUDE.md` at the repo root is authoritative. Especially §5 (JSDoc on every TypeScript function;
  closing-bracket comments over 10 lines; English throughout; where TypeScript or Vitest cannot force
  something, the comment that says what the code does force says so in the same sentence) and §6's
  "Frontend structure" invariants.
- **Corpus privacy: the repository is public and the owner's real config must never be quoted.** File
  names, counts and line numbers are fine; content is not.
- A fix answers the findings the review names, in the files it names. Anything else is an open item
  in the phase's notes, not a fix in the same phase. Rate each finding `BLOCKER` or `SHOULD-FIX` and
  end with a verdict line: `ship`, `ship-with-fixes` or `do-not-ship`.
