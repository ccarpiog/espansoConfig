Unable to create `docs/reviews/phase-2c-5-4b-code.md`: the workspace is mounted read-only. Full review follows.

# Phase 2c-5-4b code review

## High

### 1. The permit’s submission is derived after the confirmation has been spent

**Confirmed defect:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1496)

After the checked `PENDING_CONFIRMATIONS.delete(pending)` succeeds, `confirmRestore` performs further caller-controlled property reads:

- `submissionOf(preview.draft)`
- `session.target`
- `session.baseRevision`
- `preview.entry.id`
- `preview.revision`
- `session.previewGeneration`

The resulting submission and permit are therefore not necessarily the values that passed the pre-spend checks.

Concrete failure scenario:

1. The preview displayed candidate A with hash A.
2. A getter is installed on `preview.draft.value`.
3. The pending confirmation’s candidate hash and generation pass validation.
4. The checked deletion spends that confirmation.
5. `submissionOf(preview.draft)` invokes the getter after the spend and returns candidate B.
6. The permit records hash A but submission B.
7. `permitHolds` reads the same getter again and sees B, so its byte comparison succeeds while the hash comparison still compares A to A.
8. `sendRestore` writes B even though the confirmation was issued for displayed candidate A.

The same shape can substitute `draft.baseRevision`; `sendRestore` sends `permit.submission.baseRevision`, while `permitHolds` checks `permit.baseRevision`, not that the submission’s base equals it.

This directly violates Q8’s requirement that one confirmation bind the exact submitted text, candidate hash, entry, document, base revision, and generation.

Minimal fix: create a private, plain, frozen authorization snapshot when preparing the confirmation, containing copied primitive entry identity fields and the exact complete submission. Store it in a private registry. After the checked spend, mint the permit solely from that private snapshot—perform no session, preview, draft, pending, or context property reads after the spend.

Add a regression test whose draft getters return different candidate/base values after the checked deletion and assert that only the originally bound candidate and base can reach the sender.

### 2. Cancellation and other withdrawals do not revoke the runtime confirmation

**Confirmed defect:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:892), [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1307)

`withdrawn()` and `cancelRestore()` clear `session.pending`, but leave the original pending object registered in `PENDING_CONFIRMATIONS`. The comments explicitly acknowledge that a retained session can put the question back and confirm it.

Concrete failure scenario:

1. Session A prepares a confirmation for entry A.
2. The UI cancels it, refreshes the catalogue, selects entry B, or observes a new target revision.
3. The returned live session correctly shows no pending question.
4. A retained reference to the pre-transition session is passed to `confirmRestore`.
5. Its pending object remains in `PENDING_CONFIRMATIONS`, so confirmation succeeds.
6. `BrowserState.restoreDocument` deliberately takes the session from `started`, not from the current pane state, and can therefore write A while the live pane is showing B or no question.

This makes “withdrawn” presentation state rather than revoked authorization. It contradicts Q5’s requirement that navigation, selection changes, catalogue refresh, candidate changes, and cancellation withdraw the confirmation.

Minimal fix: make the private authorization registry revocable by the exact session identity. For example, register a frozen authorization under the pending session returned by `prepareRestore`; every withdrawing transition deletes that session key before reading caller-controlled properties, and `confirmRestore` uses a checked deletion of the same key. Do not leave the old pending object active after cancellation or withdrawal.

Add regression cases that retain the pre-cancellation/pre-refresh/pre-selection session and prove that it can no longer mint a `StartedRestore`.

## Medium

### 3. The mounted forbidden-claim test and decision record claim coverage they do not provide

**Confirmed evidence defect:** [RestorePane.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/components/RestorePane.test.ts:1151), [2c-5-4b-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-4b-notes.md:214)

The test says its single walk “reaches every panel this pane can draw at once,” but it reaches only the catalogue, candidate, loaded observation, confirmation, and conflict/reload-warning state. It does not render:

- a committed outcome;
- `committed: false`;
- a refusal/finding outcome;
- either send-failure arm;
- open-surface refusal messages;
- committed-plus-invalidation-failure messaging.

Those states are mutually exclusive, so no single mounted walk can reach every panel at once. The decision record consequently overstates that the mounted scan covers every shared `saveOutcome` and code sentence used by the pane.

Concrete failure scenario: a forbidden historical or safety claim is introduced into a shared sentence rendered only after a committed write or send failure. `restoreCodes.test.ts` does not inspect it because it is outside `browser.restore.*`, and the mounted scan remains in the conflict state, so both suites pass.

Minimal fix: parameterize the mounted forbidden-claim scan across the mutually exclusive outcome families, including committed, no-write success, refusal, conflict, definite send failure, uncertain send failure, and each open-editor refusal. Amend the record to describe the states actually exercised.

## Low

### 4. The “exact candidate” mounted case checks only a distinctive substring

**Confirmed weak test:** [RestorePane.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/components/RestorePane.test.ts:652)

The candidate includes a BOM and CRLF, but the assertion only checks `CANDIDATE_MARKER` and the explanatory sentence. The case would still pass if the candidate renderer dropped the BOM, normalized CRLF, or replaced `SourceText` with markup showing only the distinctive line.

The later submission test does prove exact text reaches the save boundary, and the component currently uses `SourceText documentStart`, so this is not a production fidelity defect.

Minimal fix: assert the `SourceText` representation includes the expected named BOM/carriage-return segments and unchanged surrounding text, or reuse the established mounted assertions from `SourceText.test.ts`.

### 5. The decision record overstates how byte-identical conflict labels are verified

**Confirmed documentation inaccuracy:** [2c-5-4b-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-4b-notes.md:158)

The record says `saveOutcome.test.ts` “directly” asserts that all six existing surfaces’ answers are byte-identical. The added test verifies that those surfaces still receive `confirmReload` rather than `confirmReloadKeeping`; other tests pin the current translation keys. It does not compare against the pre-change bytes.

Independent inspection confirms the production claim itself is true:

- raw editor still maps `reseedsDraft` to `confirmReload`;
- the five match surfaces still map `closesSurface` to `confirmReload`;
- `conflictChoiceKey`’s existing arms and their English/Spanish dictionary values are unchanged.

Minimal fix: change the record to say the diff establishes historical byte identity while the tests pin the current key mapping, or add explicit expected label snapshots if the test is intended to prove the historical claim.

## Verified concerns with no additional finding

- Check-and-spend: all three current consuming operations use their boolean results. No discarded `Set.delete`/`Map.delete` result remains.
- Shared context: `RestorePane` builds one `RestoreContext` for `restoreView`, `prepareRestore`, and `confirmRestore`; `restoreRefusal` is reached through that same `restoreView`. `observed` comes from `revisionInProjection(...)`, never `session.baseRevision`.
- Null coordinator answer: `runRestore` installs `restoreDocument`’s answer only when it is non-null.
- Invalidation: `DetailPane.invalidateEverySurface` synchronously closes or terminates the raw editor, match editor, deleter, mover, duplicator, and creator. The creator is conservatively closed unconditionally.
- Conflict widening: the five match surfaces and raw editor retain their prior choice keys and translated bytes.
- Text fidelity: candidate, loaded observation, and conflict disk text all use `SourceText` with `documentStart`; no file text passes through a textarea or input. The exact retained string is passed to the save boundary.
- Forbidden claims: I found no confirmed forbidden English/Spanish claim in the changed strings, JSDoc, comments, tests, or decision record. The two open-editor refusals state that an editor is open and that the application cannot tell whether it was edited.
- No additional accessibility or Svelte-runes defect was confirmed statically.

Codex session ID: 01a00201-4a15-7500-869b-a1507497e263
Resume in Codex: codex resume 01a00201-4a15-7500-869b-a1507497e263
