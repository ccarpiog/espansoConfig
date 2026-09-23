Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-9b-3 review

Scope: the uncommitted diff against `HEAD` in the files the brief names, with the four instrument paths and `PROGRESS.json` left out. I re-ran the three touched suites: `npx vitest run workspace.test.ts ReconciliationStatus.test.ts reconciliationStatusCodes.test.ts`. Result: 435 passed.

## Blockers

None found.

## Should-fix

1. **A comment and the notes claim the installation-time recheck cannot be reached. It can.** The claim is in `workspace.svelte.ts`, in the host member's doc (~3644-3648): "Through this state's own writers a hold established while the read is out also replaces the file's projection first ... so `rereadUnderGuard`'s own projection capture refuses before this question is reached". Notes §6 items 1 and 4 repeat it.
   - That holds only when the re-adoption succeeds. In the `mayHaveWritten` arm (e.g. ~6311-6321), the code calls `write.expect(uncertain)` and then `await adoptTheDocumentOnDisk(...)`.
   - `adoptTheDocumentOnDisk` (~7375-7380) returns on `!fresh.ok` before `installView`. The projection generation therefore does not move.
   - The `finally`'s `close()` then adds the hold (`uncertainWrites.add`, ~4600).
   - An automatic read that answers after that passes `stillCurrent()` (line 5173) and the caller's guard, and reaches `guardAndHold`'s hold branch. There it registers and delivers inside the helper.
   - The behaviour is correct: `arrival` equals the current generation because `stillCurrent` passed. But the sentence claims more than the code guarantees, which CLAUDE.md §5 names as the worst defect class. The branch it wrongly calls unreachable has no test.
   - Fix: correct the comment and notes §6 items 1 and 4. Add the case "hold established while the read is out, re-adoption `get_document` fails" and assert that the origin is registered.

## Checked, no finding

- **Request-time refusal.** It runs after the `owns()`-fenced `stale` mark, sends no command, and returns before the helper, so nothing is cleared. Registration re-asks `owns()` (`stillOurs` = `isNewest`), so an observation that has been overtaken is not made the standing one.
- **`takeInObservation`.** It is a verbatim extraction of `observeExternalChange`'s barrier-or-arbitrate body. `arbitrateHere`'s four-operand re-check, the `rememberTheConflict` first-registration rule and the `conflictStatusWrites` ordering (mark before registration) are unchanged. No `selectGeneration` or projection-generation write was added.
- **Argument order.** `externalConflictObservationOf(route)` is evaluated as an argument before the host runs `owns()`, as the `observationTransitions.ts` comment says.
- **Manual paths.** The bodies of `requestFileReread` and `rereadDocument` are untouched in the diff. They call the private helper and never reach the new member.
- **Wording.** The EN and ES sentences match what the code does. No placeholders were added in either locale. "Until" is used, never "when".
- **The §6 item 1 dead end.** It is real on the success path of re-adoption, and the race test pins it honestly.

## Not verified

- I did not run the full `npm test`, `check` or `build`; I relied on the brief's evidence.
- I did not trace whether an observation retained behind the barrier under the hold is ever reread after a later `ended` settlement.
- I did not check the pre-existing window in which an automatic read answers while the adoption is awaited, before `close()` adds the hold.
- There was no window reading.
