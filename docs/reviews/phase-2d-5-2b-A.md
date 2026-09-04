Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2b-A — review of 2d-5-2b's fix round (commit `505caf6`)

Scope: the non-comment diff of `src/lib/browser/workspace.svelte.ts`, the comment-only diffs in
`writeSurfaceRegistry.ts`, `DetailPane.svelte`, `MatchCreator.svelte`, and `DetailPane.test.ts`.

## Blockers

None. Re-derived against the code: `rg -n 'writeSurfaces\.'` gives exactly three hits
(`workspace.svelte.ts:1818` read, `:3367` register, `:3380` read), so the registry has no fourth
mutation path today and §11 item 9 names no live correctness defect. `mirroringLease` preserves the
whole of `UnregisterWriteSurface` (call signature + `replaceTarget`, `writeSurfaceRegistry.ts:168-220`)
and no caller compares lease identity — the registry matches serials at `writeSurfaceRegistry.ts:495`.
The mirror can never lead the registry (`noticeWriteSurfaces` copies, never increments), an equal
assignment cannot loop the reconciler, and `RestorePane.svelte:511 const now = current` re-reads a
`$derived.by`, so the corrected `DetailPane.svelte` claim about `confirmRestore` is true.

## Should-fix

1. **`workspace.svelte.ts:3383-3388` — the guard became derivative for no gain.**
   `openWriteSurfaces()` reads the mirror only for the dependency and returns the registry's live
   answer; `writeSurfaceGeneration()` returns the mirror *instead of* `writeSurfaces.generation()`.
   `void surfaceGeneration; return writeSurfaces.generation();` yields the identical dependency and an
   authoritative number. As shipped, the Q5 guard 2d-5-4 will capture under-reports if any later path
   moves the registry without mirroring — "nothing changed" while `openWriteSurfaces()` simultaneously
   answers the new set. That is the unsafe direction, and it is also why the doc's "the two doors
   cannot report different numbers" (`:1595-1597`) holds by hand rather than by construction.

2. **The mirror-equals-registry invariant is untestable.** `writeSurfaces` is private and every
   generation assertion (`DetailPane.test.ts:926, 941/954, 1127/1137`) now reads the mirror against
   itself, so no test can fail if the two drift. Fixing 1 restores the oracle — but note that
   `:954` is today the *only* coverage of `replaceTarget`'s `noticeWriteSurfaces()`, so that case
   needs a screen-level or explicit-mirror assertion at the same time.

3. **`workspace.svelte.ts:1593` — "Nothing calls it yet"** stands in the doc block this fix edited,
   while §12.2 item 3 celebrates putting two cases onto that door and `DetailPane.test.ts` calls it
   four times. The production-only reading is intended and unsaid.

4. **`MatchCreator.svelte:387` — "Nothing reads either answer in production at 2d-5-2b"** is wider
   than the code: `competingSurfaceFor` is read in production by `RestorePane.svelte`'s `current`
   on every open restore (`restore.ts:477-483`). The true sentence is the clause after it (`busy`).
   Same shape as this chain's recurring defect.

## Not verified

`cargo test --workspace` (instructed not to run; no Rust touched). Mutation testing of the three
`noticeWriteSurfaces()` call sites — read-only constraint forbade temporarily deleting them; coverage
was re-derived by reading instead. That `void surfaceGeneration` survives production minification as
`void $.get(...)` is reasoned, not measured. The window reading is 2d-5-2c's.
