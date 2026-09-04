# Phase 2d-5-1-A — adversarial review

Reviewer: autoclaude adversarial reviewer

Scope: the two source fixes and their evidence. Tree at `ae15127` + `restore.ts`, `restore.test.ts`,
`docs/decisions/2d-5-1-A-notes.md`; nothing else modified, `git stash list` empty.

## Blockers

None.

## Should-fix

**1. `src/lib/browser/restore.test.ts:529-531` — a guarantee the code does not give.** The helper's
JSDoc says "the mounted `DetailPane.test.ts` suite is what holds production to its own behaviour,
and this holds only the model"; `docs/decisions/2d-5-1-A-notes.md` §2.5 repeats it. Nothing holds it.
`invalidateEverySurface` (`DetailPane.svelte:545-563`) is reached by no test: `rg 'invalidate|creating'
src/lib/components/DetailPane.test.ts` matches nothing, that file has 8 `it` blocks, and its two
restore cases (`:490`, `:516`) stop at opening the pane. Deleting `creating = false` — the exact rule
this phase copied — breaks no test. So the divergence the phase fixed is unpinned on the production
side in both directions, and "where it is thin" item 1, which rests on this sentence, understates the
gap: it is not only that the copy can go stale, it is that neither side is held. This is the project's
named worst defect class, and the fix touches source (§7.1 applies).

**2. `src/lib/browser/restore.ts:581-583` — the ordering sentence drops the eligibility gate.** "a
surface whose target is exactly this document, if the list holds any, and otherwise the first
destination-less creator the list holds" is false for `('notCreatorEligible', [UNKNOWN_CREATOR])`,
where the function answers `null` (pinned at `restore.test.ts:937`). The gate is stated correctly two
paragraphs up and in the last clause of this one, so the imprecision is local.

**3. `src/lib/browser/restore.ts:586` — "the six named kinds".** `OpenWriteSurfaceKind` has **seven**
members (`:340-354`), and "six" is this file's established count for `CompetingWriteSurfaceKind`
(`:356-363`), which excludes `restore` — the one kind `targetingSurfaceFor` deliberately counts
(`restore.test.ts:949`). Wrong set named.

## Checked and clean

- Helper's three rules match `DetailPane.svelte:545-563` (creator unconditional, restore exempt, five
  exact-match comparisons); the `:525-527` / `:529-535` citations are accurate.
- Yes/no invariant holds: old non-null ⟺ ∃exact ∨ (eligible ∧ ∃unknown); new identical. Empty list,
  several exact matches, ineligible unknown creator all preserved. No new shadowing — array order
  still decides among exact matches, pinned both ways at `:995-996`.
- Both new coordinator cases fail under the old document-only filter by derivation (case A keeps all
  three surfaces, case B empties the list), so "2 failed | 219 passed" is credible. The new targeting
  case at `:971` fails under first-match; the case at `:990` passes both ways and is documentation,
  which §3.4 does not claim otherwise.
- No pre-existing assertion weakened by the `restore` exemption: no earlier coordinator list held a
  restore surface. `:2463` now closes its `matchCreator@TARGET` by the creator rule rather than by
  exact match, but the exact-match arm stays pinned by the editors in the same and neighbouring cases.
- Scope: `competingSurfaceFor` untouched; no component, registry, coordinator, `events.ts` import or
  Rust change. Both `never` termini intact.
- Measured here: `restore.test.ts` **221**, `scripts/lint/ipc-detail.test.ts` **130**; +3 in the diff,
  so the 218 → 221 derivation is sound.

## Not verified

- The revert measurements (`2 failed | 219 passed`, `1 failed | 220 passed`) — read-only review, so
  derived rather than executed.
- The pristine `git archive HEAD` figures 218/130 — inferred from this tree's counts and the diff.
- `cargo test` 1320, `npm run check` 436, `npm test` 2205, `npm run build` 185 and both bundle
  oracles — taken from the orchestrator's run, not re-executed inside the time budget.
