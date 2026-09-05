Reviewer: autoclaude adversarial reviewer

Scope: `eb1134a`, source half only — `src/lib/browser/workspace.svelte.ts`,
`src/lib/components/MatchCreator.svelte`, `src/lib/components/DetailPane.test.ts`.

## BLOCKERS

None.

## SHOULD-FIX

**1. `MatchCreator.svelte:408` — `workspace.svelte.ts:3320-3322` points at a comment, not
at the rebuild.** `const context: RestoreContext = {` is at **`:3328`**, spanning `3328-3331`
(`grep -n 'const context: RestoreContext' src/lib/browser/workspace.svelte.ts`). Lines
`3320-3322` today are the middle of the "revision half is this state's own answer" comment.
Pre-commit the construction was at `3321` (`git show eb1134a^:… | grep -n`), and **this same
commit's first hunk added 7 lines above it** (`@@ -3412,12 +3419,22 @@`). The fix therefore
invalidated its own citation, in the file it was editing.

**2. `MatchCreator.svelte:407-408` — "`now.context.surfaces` onward (`:511`)" is wrong.**
`RestorePane.svelte:511` is `if (started === null) {`. `now.context.surfaces` is passed at
**`:515`** — `const answered = await restore(started, now.context.surfaces, invalidate);`
(`grep -n 'now.context' src/lib/components/RestorePane.svelte` → 510, 515 only). The figure was
carried verbatim from `phase-2d-5-2b-C.md` finding 1, which also said `:511`.

**3. `DetailPane.test.ts:1193-1194` — "a `flushSync()` and four assertions after it" is three.**
The sibling's `lease()` is `:1110`, `flushSync()` `:1111`, then `expect` at `:1113`, `:1114`,
`:1115`, then `pane.stop()` `:1116`. Also carried from the C review verbatim.

All three contradict the commit message's "Every figure the review reported was re-derived off
the files before it was accepted, and every one held."

## NIT

**4. `MatchCreator.svelte:401`** — "`RestorePane.svelte`'s own comment above `current`". The
docblock immediately above `current` (`:322-331`) says nothing about `restoreRefusal` gating the
write; the comment that does is the component header at **`:106-111`**. The C review cited that
line range; the fix replaced a precise locator with an ambiguous one.

## Re-derived and holding

`restore.ts` `:1993` in `restoreRefusal`, `:2581` in `permitHolds`, `:2009` in
`canPrepareRestore`, `:2095`/`:2397` the `canPrepareRestore` gates, `:2663` the `permitHolds`
call, `:3228` in `restoreView`; `RestorePane.svelte:340`, `:509`, `:510`. Six early returns
precede `:1993`. `prepareRestore` (`:470`, `:542`) and `confirmRestore` (`:510`) are all handed
`current.context`, so "both consult `current`'s list" holds. No production caller of
`targetingSurfaceFor` or of `writeSurfaceGeneration` (tests only, all imperative). "`$derived`
or `$effect`" already correct at `:3407`, `:1570`, `:1816`. "The paragraph directly above" is
`:1586-1597` and does say the coordinator does not exist yet. `mountPane.stop()` (`:424-427`)
unmounts without disposing state; the added `lease()` is after the last assertion. No untouched
twin of the display/spend or imperative/`$derived` wording survives in `src/`.

## The BLOCKED hatch

**Not reached.** The named condition was the *same* mis-attribution surviving — `:1993` vs
`:2581` reachability, or the reactive-context split. Both are correct in substance at every
rewritten site. Findings 1-3 are stale figures, a different defect.

## NOT-VERIFIED

- `npm test` and `npm run build` — not run; the diff is comment-only and the orchestrator is
  measuring them. `npm run check` was run here: **438 files, 0 errors, 0 warnings, exit 0**.
- Rust gates — excluded by the brief.

## Where it is thin

1. **Every cross-file line citation in these three comments is unpinned by any test**, and two
   of four checked were stale after one commit. — *actionable* (comment defects in source;
   findings 1, 2).
2. **A citation into a file the same commit edits above the cited line is the mechanical cause
   of finding 1.** Nothing re-derives it. — *recorded only*.
3. **Assertion counts in prose about a neighbouring test block** drift on any edit to that
   block. — *recorded only*.
