Reviewer: autoclaude adversarial reviewer

Scope: the source half of `92fe0f4` — `src/lib/browser/workspace.svelte.ts`,
`src/lib/components/DetailPane.test.ts`, `src/lib/components/MatchCreator.svelte`.
Verdict: **ship-with-fixes**. 0 High. 3 Medium/Low, all in prose that ships in source.

## Not a finding (checked, held)

- No fourth unmirrored path exists today. The registry moves its generation at exactly three
  places — `writeSurfaceRegistry.ts:528` (register), `:546` (unregister), `:602` (replaceTarget)
  — and all three are reached only through `registerWriteSurface` (`workspace.svelte.ts:3374`)
  and `mirroringLease` (`:1857`, `:1870`). The check that shows the two the `rg` in notes §11
  item 9 misses is `rg -n 'generation \+= 1' src/lib/browser/writeSurfaceRegistry.ts` read
  against their enclosing functions.
- Finding 1's fix does not reintroduce 2d-5-2b's finding 1: `openWriteSurfaces()` is untouched,
  and `void surfaceGeneration` still precedes the return.
- Five `writeSurfaceGeneration()` call sites (`DetailPane.test.ts:934,955,968,1203,1213`), three
  cases, none in production — the corrected comment pins no number and is accurate.
- `targetingSurfaceFor` has no production caller. Confirmed.

## Findings

**M1 — `MatchCreator.svelte:388-390` is a new instance of the class it closes.** Two ways.
(a) *"read in production, by `RestorePane.svelte`'s `current` on every open restore"* — inside
`restoreRefusal`, `competingSurfaceFor` is reached only past six early returns
(`restore.ts:1975-1992`: `alreadyRestored`, `readOnly`, `inFlight`, `conflictShowing`,
`noCandidate`, `targetMoved`). An open restore with no candidate never reads it, so *every* is
wider than the code. (b) It names one of **two** production readers: `permitHolds`
(`restore.ts:2581`, called at `:2663` on the spend path) is not reached through `current`, and
it is the read that decides whether the write goes out — which is the direction the paragraph
is about. The commit message names both sites; the shipped comment names one.

**M2 — `workspace.svelte.ts:1605-1608` / `:3403-3406`: "Reading the registry cannot fail that
way" is scoped to a non-reactive caller and is not written that way.** A `$derived` that reads
`writeSurfaceGeneration()` memoizes; if a future unmirrored path loses the invalidation, that
derived keeps answering the pre-mutation number, so for a reactive caller the lost invalidation
*is* a lost value. "What the mirror owns is the invalidation and not the value" is true only of
a caller that calls. No such reactive caller exists today, which is exactly why the sentence
should say so.

**L3 — `DetailPane.test.ts:1141-1148`: the first half is not discriminating.** After registering
the `{kind:'unknown'}` creator, `not.toContain(creatorOpen)` passes identically whether the
mirror moved and the derived answered "no competitor", or the mirror never moved and the derived
never re-ran. The comment presents the unknown-competes-with-nothing rule as "what makes the two
halves of this case different"; only the second half is an oracle for anything. The case's named
claim (the third `noticeWriteSurfaces()` site) is carried by the `replaceTarget` half alone.
Minor: the manual lease is never released before `pane.stop()`, unlike the sibling case at
`:1110`.

## NOT-VERIFIED

- All four gates and both bundle oracles: not run, per the brief. `1320 / 438 / 2254 / 186` is
  accepted, not measured here.
- The three mutation runs proving the new case fails alone: accepted from the brief. I checked
  what the case *claims*, not that it fails when broken.
- That the Svelte compiler emits a reactive read for `void surfaceGeneration` in a `.svelte.ts`
  module: inherited from `openWriteSurfaces()`, which already shipped that shape and whose
  reactivity a mounted case measures. Not independently measured.
