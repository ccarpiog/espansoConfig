Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-11b — adversarial review

Scope: uncommitted tree against `def3564`, excluding the instrument paths and `PROGRESS.json`.

## Blockers

None found.

## Should-fix

1. **The new comment conflicts with five older comments that name a caller.** `src/lib/i18n/index.ts:1591-1593` now says "Nothing in production calls {@link describeSupersededEvidence} or {@link tSupersededEvidence}". `rg` agrees: there is no call site. But five older sentences still say the obstacle is "rendered through `tSupersededEvidence`": `matchCreation.ts:2260`, `matchDeletion.ts:1555`, `matchDuplication.ts:1822`, `matchMove.ts:2443` and `recovery.ts:2885`. Each of those arms actually returns `SUPERSEDED_EVIDENCE_KEY`, for example `matchCreation.ts:2333`. So each sentence names a production caller that does not exist, and the codebase now says two opposite things. The sweep's notes do not list these lines, not even under §6 item 1.

## Checked and holding

- **Comments only.** Every changed line in the production `.ts`, `.svelte` and `.rs` files is a comment. The one line that looked like code, `RestorePane.svelte:1393`, is inside a CSS `/* */` comment.
- **Caller claims.**
  - `drainExternalChanges` is called once in `workspace.svelte.ts`, at `:3541`.
  - `rememberExternalConflict` has no production caller, and `arbitrateHere` calls `rememberTheConflict` at `:4315`.
  - Five t* accessors are called from components: `tSaveVerdict`, `tFindingCode`, `tEditError`, `tSaveError` and `tPresentationNote`. `RawEditor.svelte` calls neither `tEditError` nor `tSaveError`. The other thirteen accessors in that section have no caller.
  - `tBackupReadStep` has no caller. The other five backup accessors are called from `RestorePane.svelte`.
  - Each of the six obstacle wrappers is drawn by its panel.
  - `transitionOf` in `DetailPane.svelte:766` behaves as the comment says.
  - The four coordinator readers are forwarded at `workspace.svelte.ts:7220-7239` and read in `reconciliationStatus.ts:1037-1041`.
  - `AppShell.svelte` passes `reportIpcFailure`.
- **Counts.** `RestoreRefusal` has nine arms. `CompetingWriteSurfaceKind` has seven members, recovery included. `busy` (`DetailPane.svelte:1148-1156`) covers seven surfaces and leaves out recovery.
- **ES strings.**
  - The three corrections match the English.
  - `bilingualFixtures.test.ts` pins them through `describe*` functions or through typed `TranslationKey` literals. No key is concatenated.
  - The bound counts in the fixtures (3/1/2/2/6/14/2) match the notes.
  - `npx vitest run src/lib/i18n/` passed 243 tests.
- **Baseline arithmetic.** The deltas are +1/+9/+0 against the live rung, +18/+1061/+10 against entry 42's normalized figures and +3/+23/+1280/+14 against the pre-instrument figures. The file ladder sums to 18 and the module ladder to 10. The suite has 8 cases. All consistent.
- **Consolidated record.** It says it is not the 2d-7 matrix, that no launch was run and that it makes no new claim. It lists the owed readings under §5.1 with their owners.

## Questions (not findings)

- **Close label vs keep choice.** In Spanish, *Dejarlo estar* (close) and *Dejarlo como está* (keep) still mean nearly the same thing, and so do the English "Leave this alone" and "Leave this as it is". The test at `bilingualFixtures.test.ts:483-487` only checks that the two strings are different. It cannot tell whether a person can tell the two opposite actions apart. The defect in 7b §4 item 1 was about the effect, not the spelling.

## Not verified

- I did not rerun the full Rust suite, the full `npm test` or `npm run build`. The cost figures for the pristine copy were not reproduced.
- The ES wording was checked for meaning against EN. That is one reviewer's reading, not a native speaker's.
