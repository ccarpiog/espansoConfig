# Review brief — Phase 2d-5-4, the observation state transitions

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. The change under review is the
**uncommitted working tree**. Read `CLAUDE.md` at the root first — it is binding, and its §5
(conventions), §7 (review rounds and their marks) and its paragraphs on decision records that
overclaim are the standards this review applies.

## What the phase is

**Phase 2d-5-4 — the observation state transitions**, step 4 of the seven-step 2d-5 split. Its
definition is `docs/decisions/2d-5-split-notes.md` §2 (`### 2d-5-4`); the consult that binds it is
`docs/reviews/phase-2d-5-design.md`; the rulings nearest it are §3 entries 5, 6, 7, 8, 13, 18 and 28.

It **delivers**: the per-document accepted-sequence map, the guarded reread, the `Added` / `Removed` /
`Unreadable` arms, the selected-document removal transition, `Addressable`-only command routing, and
the discarded-history recovery that re-runs the coordinator's retained original open request.

## Changed files

New:

- `src/lib/browser/observationTransitions.ts` (1084 lines) — the new module: the routing boundary,
  the eleven transition arms, `acceptedSequenceByDocument` as an atomic admit-and-record, and the
  `ReconciliationWorkspace` surface the module is handed.
- `src/lib/browser/observationTransitions.test.ts` (862 lines)
- `docs/decisions/2d-5-4-notes.md` (471 lines) — the phase's record, **in scope for this review**.

Modified:

- `src/lib/browser/reconciliationCoordinator.ts` (+347/-) — the retained open request
  (`workspaceOpened(request)`), the `discarded` recovery's two arms, the typed blocked state.
- `src/lib/browser/workspace.svelte.ts` (+512/-) — `rereadUnderGuard`, the synchronous
  `removeDocumentFromWindow`, `addDocument`, two `$state` records, four read-only `BrowserState`
  members.
- `src/lib/browser/reconciliationCoordinator.test.ts` (+626/-), `src/lib/browser/workspace.test.ts`
  (+619/-)
- `src/lib/browser/conflictSource.ts`, `src/lib/browser/writeSurfaceRegistry.ts` — comment-only.
- `src/lib/components/DetailPane.svelte` — **comment-only, by the orchestrator, not the worker**. Its
  `tellNobodyYet` JSDoc claimed *"Nothing invokes a stored transition anywhere in this repository"*,
  which this phase falsified: `tellTheSurfaceAbout()` in `observationTransitions.ts` now calls
  `transitionFor(kind)` and invokes the result. Verified comment-only mechanically: `git diff -U0` on
  that file, filtered to changed lines that are not JSDoc lines, returns nothing.

## Verification already run (do not re-run — see below)

Every gate green, twice for the three frontend ones (before and after the `DetailPane.svelte` fix):

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines and
  checked by the complementary question (no line lacking `0 failed`). No Rust changed this phase.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings** (was 441; +2 for the two new `.ts` files).
- `npm test` → **2373 tests in 61 files**, exit 0 (was 2307 in 60).
- `npm run build` → **189 modules** (was 188; +1 for the one new reachable `.ts` module). Both bundle
  oracles read: server-only markers absent, client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before; the figures above are measured and are the
ones to reason from. Read the code.

## What to review, hardest first

1. **Concurrency and ordering.** The guarded reread (`rereadUnderGuard`) captures registry generation
   **and** accepted sequence and rechecks after the await (§3 entry 18). Is the recheck in the same
   synchronous block as the write it guards? This project has shipped check-and-spend defects **twice
   in one phase** before — a check and a spend separated by any property read are not atomic, because
   a property read runs arbitrary code through a getter or a proxy trap. Look for a consuming
   operation whose result is discarded. Sweep for the **shape**, never for the words of a past finding.
2. **Two sequence states that may legitimately disagree** (§3 entry 6). The session cursor
   `{ epoch, watermark, lastDiscarded }` is the drain acknowledgement; `acceptedSequenceByDocument` is
   the arbitration key. Nothing in the types enforces that a transition consults the right one. Does
   any arm consult the wrong one?
3. **`Addressable`-only command routing** (§3 entry 28). Only an explicitly narrowed `Addressable` arm
   may reach an open-workspace document command. The module claims three narrowings written out three
   times with `never` termini and no common identity accessor. Does a path escape the narrowing?
4. **Ruling 27 — watcher arbitration initiates no save command.** The module is handed a
   `ReconciliationWorkspace` with no writing command on it. Is that actually exhaustive, and does the
   promised explicit zero-save-command assertion exist and bite?
5. **The record against the code, never the code against the record.** `docs/decisions/2d-5-4-notes.md`
   is in scope. **A decision record claiming a guarantee the code does not give is this project's worst
   defect class**, and no test can fail it. Check every claim in it — including its four answered
   rulings and its §7 marks — against the source. Check its `file:line` citations resolve; four stale
   cross-file citations under `src/` are a known open class here.
6. **Comments as contracts.** The fourteen-round 2d-5-3 tail was entirely about whether comments tell
   the truth. A comment asserting a proposition and its negation, a claim true only at an instant
   written as true now, a coverage citation naming a test that does not drive what the sentence says —
   all three have shipped here past every gate and two reviewers.
7. **The evidence the phase owes**, per the split: model **and** workspace tests across every
   observation-by-document-arm combination, **two documents** (a single-document test has repeatedly
   hidden per-document defects here), surface-open races, lost additions and lost removals. Is any
   combination claimed but not driven?

## Known and declared, not findings

- The four uncommitted instrument paths (`src-tauri/src/probe.rs`, `src/probe.ts`, and hook lines in
  `src-tauri/src/main.rs` and `src/main.ts`) are deliberate and are never committed. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)` and still is.
- Two items the phase hands forward on purpose: Q8's removed-target state ships as state and not as
  telling (`WriteSurfaceTransition` takes the narrowed `Changed`/`Projected` snapshot, so a removal
  reaches no surface — 2d-5-5's), and the unbounded blocked-drop is restated rather than fixed.
  Say if either is wrong to hand forward, not merely that it is handed forward.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived before being accepted, and reviewers' arithmetic has been wrong in
three of the last five rounds.

Time budget: 25 minutes.
