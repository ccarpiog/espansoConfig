# Review: Phase 2c-3b-2 selection-notice attribution fix

Reviewed the six-file uncommitted diff from HEAD
`f3566ba1350898e8d8aa8d8dded0066bf63a41e3`. The untracked
`docs/decisions/2c-3b-2-window-reading.md` was used as context and was not reviewed
as part of the change.

## Findings

No findings.

## Verification

1. **Prose and attribution:** The new move-attributed sentences are reachable only
   through `BrowserState.moveMatch`'s saved/out-of-date adoption. That caller passes
   `requestedMove` only for `committed: true`; the `mayHaveWritten`,
   `committed: false`, conflict, recovery, and all non-move paths retain the external
   attribution. `adoptTheDocumentOnDisk` additionally downgrades the attribution
   unless the fetched projection matches both `moved.document` and
   `moved.revision`. The command contract mints `moved` only when the post-write
   refresh agrees with the revision established by the transaction, so the guard
   is evidence that the adopted parse is the one the move produced. The English
   and Spanish sentences claim only the consequences of that committed,
   same-sequence move: the file was reordered; an unchanged positional selection
   was found again, or a shifted selection was cleared while its snippet remains
   in the move-produced file.

2. **Default-path identity:** `RepairAttribution` defaults to `externalChange` at
   both `adoptTheDocumentOnDisk` and `repairAfter`. Every adoption call other than
   the committed `moveMatch` arm omits the argument, and every direct `repairAfter`
   call omits it. The repair itself is unchanged: `sameMatch` still re-points,
   every other outcome still clears, and only the notice code differs under the
   guarded requested-move attribution.

3. **Selection generations:** The diff adds no direct assignment to `selected`.
   Both changed repair branches continue to call `replaceSelection`, which bumps
   `selectGeneration` synchronously before assigning `selected`. The per-document
   `projectionGenerations` mechanism remains separate and unchanged; adoption
   still calls `installView` before selection repair.

4. **Invalidation kinds:** The diff does not change `MatchMoveSession.invalidated`,
   `applyMove`, or `moveRecoveryFailed`. A replacement-based invalidation and a
   recovery-read failure without replacement remain distinct producers with their
   prior semantics.

5. **Tests:** The existing mid-flight move case still checks both original repair
   outcomes: the unaffected selection is re-pointed and the shifted selection is
   cleared, including the assertion that the cleared snippet remains in the
   projected file. Only the expected notice codes change. The new race case pins
   the attribution guard by returning a committed move at `rev-b` and re-reading
   `rev-elsewhere`, then asserting the ordinary external `differentMatch` notice.
   No existing assertion was deleted or weakened.

6. **i18n:** Both new keys exist in English and Spanish, neither has placeholders,
   and the locale values are faithful counterparts. `selectionNoticeKey` maps the
   new typed notice arms to literal `TranslationKey` values, and the component
   continues to render them through `tSelectionNotice`; no key is assembled at
   runtime.

Commands run:

- `npm test`: 44 files, 1,244 tests passed.
- `npm run check`: 407 files, 0 errors, 0 warnings.
- `npm run build`: 168 modules transformed.
- `git diff --check`: clean.

READINESS: READY

Codex session ID: 019fcbaf-5ba1-7f13-9edc-3d197f974603
Resume in Codex: codex resume 019fcbaf-5ba1-7f13-9edc-3d197f974603
