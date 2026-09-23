Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-9b-1 — adversarial review (fallback reviewer; Codex returned a malformed result)

Scope: uncommitted tree against HEAD, files listed in the brief. Instrument paths and PROGRESS.* not reviewed.

## BLOCKERS

None found.

## SHOULD-FIX

1. **`src/lib/browser/workspace.test.ts`: the clear guard's negative half is untested.** The model code at `workspace.svelte.ts` (`adoptDiskVersion` installed arm, `conflictStatusWrites.get(source) === statusWriteOf(origin.document)`) is sound when I trace it. A later `rereadUnderGuard` mark, or an `unavailable`, bumps `statusWrites` through `noteDocumentStatus`, and the clear is then skipped. The new cases are only the six writers, the no-mark case and the positive clear. No case pins these:
   - that a status written after the conflict survives an `installed` adoption;
   - that `unavailable`/`removed` is not overwritten by `rememberTheSaveConflict`;
   - that nothing is marked with no projection installed.

   Risk 1 is the phase's highest risk, and its guard has no failing-first evidence.
2. **`src/lib/components/DetailPane.svelte` (`shownFile` derived): a placement decision is made in markup.** "The file the pane shows" is decided inline: whole-text target, else the selected snippet's document, else none. It should be a value in `reconciliationStatus.ts` beside `headerFilesOf`. The consequence is also untested: a `stale` file that is selected in the sidebar, with no snippet selected and no whole-text view, gets no header block. So the `staleFileReread` control can be reached only after the person opens the text or picks a snippet, and the row's `title` gives no control. That may be intended by entry 27, but no record says so.

## Checked, no finding

- **Mark condition:** `held.revision !== diskRevision` and status `null` or `stale`. The mark is written before `rememberTheConflict`, so the recorded count includes it. The early return for an already-registered origin cannot occur for a fresh wire refusal.
- **Route acknowledgement (`FileReconciliationStatus.svelte`):** `source` comes from `standingConflictFor`. `standingSnapshotOf(shown)` and `press(..., shown)` read the same derived value, and `uncertaintyAcknowledgementFor(shown)` mints from it. `acknowledgementMintRefusalOf` maps every eligibility arm.
- **Wording:** the `writeOutcomeUnknown` clause is removed in EN and ES. The `projectionReplacedExits` sentence claims only that a later known-outcome write or a reload are exits. That matches `routeControlNoteOf` and the notes' measurement.
- **Strings and JSDoc:** all new user-facing text goes through typed accessors. The row `title` uses `tReconciliationFileState(..., 'header')`, which is typed.
- **Invoke guard:** the `afterEach` reads `invoked.mock.calls` after `vi.restoreAllMocks()`. That is safe on Vitest 4.1.10, where restore affects `spyOn` only. The locale switch compares command counts, facts, selection identity and standing-origin identity.

## NOT-VERIFIED

- I did not re-run the full `npm test`, `npm run check` or `npm run build`. I ran three suites: ReconciliationStatus, reconciliationStatus and AppShell, 78 passed.
- I did not trace the retained-observation path (`beginWrite`'s `close` into `arbitrateAndDeliver`) to confirm that it writes a status before registering, which the clear rule relies on.
- No window reading; that is owed to 9c.
