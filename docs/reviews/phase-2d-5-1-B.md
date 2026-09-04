Reviewer: autoclaude adversarial reviewer

Scope: the three comment corrections in commit `1ff4f34` (`src/lib/browser/restore.ts`,
`src/lib/browser/restore.test.ts`). Each was re-derived from source, not from the notes.

## Blockers

None.

## Should-fix

None.

## Low

**`restore.ts:609-610`** — *"It is read only after the whole list has failed to produce an exact
match"*. `unnamedCreator` is read inside the loop, at `restore.ts:616`
(`unnamedCreator === null`), once per `unknown` surface. The intended sense ("read *as the answer*
only after…") is recoverable, and behaviour is unaffected. This comment arrived with 2d-5-1-A's
source fix rather than with the three corrections. **Cost of fixing:** it is a source file, so
§7.1 commissions another round. Leaving it is defensible.

## Checked and found true

1. **`invalidateEverySurface` unreached by `DetailPane.test.ts`.** Its only call site is the
   `invalidate` prop at `DetailPane.svelte:972`, consumed once by `RestorePane.svelte:515` inside
   the send path. `DetailPane.test.ts`'s two restore cases (`:490`, `:516`) stop at
   `browser.restore.listBatches`; no case sends a restore. Confirmed empirically outside the repo:
   a scratch copy of `src/` with `DetailPane.svelte:562` (`creating = false;`) deleted ran the full
   vitest suite to **1875 passed, 2 files failed**; the unmodified control produced byte-identical
   results (the two failures are `bootstrap.test.ts` and `sourceText.test.ts`, which read repo
   paths the scratch copy lacks). Delta zero — "breaks nothing" holds repo-wide, not just for that
   suite.
2. **Seven and six.** `OpenWriteSurfaceKind` (`restore.ts:340-354`) lists `matchEditor`,
   `matchCreator`, `matchDeleter`, `matchMover`, `matchDuplicator`, `rawEditor`, `restore` = 7.
   `CompetingWriteSurfaceKind` = `Exclude<…, 'restore'>` (`:363`) = 6.
3. **The fallback sentence.** Loop returns on the first exact `document` match, so any exact match
   wins; `unnamedCreator` is set only under `eligibility === 'creatorEligible'` and only once
   (`:616`), and is returned at `:631`. Ineligible unknown creators, any number, → `null`. Matches
   the docblock.
4. **Dragged-in claims.** Array order among exact matches: true (`:625` returns first; pinned at
   `restore.test.ts:999-1000`). No yes/no change: old and new are both non-null iff an exact match
   exists or (eligible ∧ some unknown); the `never` arm is identical. Null-set unchanged.
5. **Citations.** `DetailPane.svelte:525-527` is exactly the restore paragraph. `:529-535` covers
   the creator paragraph (529-534) plus one blank comment line. "Five identity comparisons" is
   exact: `:547, :550, :553, :556, :559`. `busy` (`:680-687`) includes `creating` and `restoring`.

No i18n, architecture-rule or corpus-privacy concern arises in this diff.

## Not verified

`cargo test --workspace` and `npm run check` / `npm run build` were not run — nothing under
`crates/`, `src-tauri/` or the build config is in this diff, and the concurrency warning applies.
`npm test` was run for `restore.test.ts` + `DetailPane.test.ts` only (229 passed) plus the scratch
full-suite runs described above.
