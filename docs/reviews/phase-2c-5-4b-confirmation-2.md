Unable to create `docs/reviews/phase-2c-5-4b-confirmation-2.md`: the workspace is mounted read-only. Full review follows.

# Phase 2c-5-4b second confirmation review

## High

### 1. `targetRevisionObserved` temporarily makes an existing question look absent, allowing a second authorization to be registered

**Confirmed defect:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1483), [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1635)

`targetRevisionObserved` takes the authorization out of `PENDING_AUTHORIZATIONS`, reads three caller-controlled properties, and then puts it back when the revision did not move:

```ts
const held = takeTheQuestion(session);
return frozen(session) || observed === null || observed === session.baseRevision
  ? putTheQuestionBack(session, held)
  : measuredAgainst(session, observed);
```

No re-entrant call can confirm the original authorization while it is held locally. That part is sound. The new opening is that `prepareRestore` treats absence from the map as permission to register another question.

Concrete synchronous failure:

1. Let `S` be the exact asked session, holding authorization `P1`.
2. Call `targetRevisionObserved(S, BASE)`.
3. `takeTheQuestion(S)` removes `P1`.
4. A getter on `S.phase` synchronously calls `prepareRestore(S, context)`.
5. `prepareRestore` sees `PENDING_AUTHORIZATIONS.has(S) === false`, builds successor `S2`, and registers authorization `P2` under it.
6. The getter retains `S2` and returns the ordinary phase.
7. The outer call finds that the revision did not move and puts `P1` back under `S`.
8. Both `confirmRestore(S, ...)` and `confirmRestore(S2, ...)` can now mint permits, and both permits can send.

This is exactly a take-and-put-back check/spend defect: removal protects the old authorization from being spent, but exposes a false “no question exists” state to another producer.

The `$effect` justification is valid only as an explanation for why unconditional revocation is undesirable. It does not make temporary absence safe.

Minimal fix: leave a private suspension marker under the session while inspecting it. For example:

- atomically replace the permit with a unique private `SUSPENDED` cell using only WeakMap operations;
- make `confirmRestore` reject the marker;
- make `prepareRestore` regard the marker as an existing question;
- restore the permit only if the same marker is still present;
- if a re-entrant withdrawal deleted the marker, do not resurrect the permit.

Add a regression whose `phase` getter calls and retains `prepareRestore(session, context)` during `targetRevisionObserved(session, BASE)`, then prove that the original and retained successors cannot both confirm or send.

## Medium

None.

## Low

### 2. A stale or mismatched candidate response now withdraws an unrelated pending question

**Confirmed behavior regression:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1399)

`candidateRead` now revokes before determining whether the response belongs to this session. Its documented refusal arms at lines 1401–1410 return `withNothingPending(session)`.

Concrete scenario:

1. A read for entry B remains in flight.
2. The person selects and loads entry A, then prepares its restore question.
3. The stale response for B lands.
4. `candidateRead` first revokes A’s question.
5. It then discovers that the response is for another entry or batch and otherwise ignores it.

Previously the mismatched response returned the session unchanged. The existing mismatch tests begin with no candidate or pending question, so they do not observe this change. The transition’s own documentation still says such a response returns “the same session.”

This is safe in the write direction, but it makes a valid question disappear because of a response the model rejected as irrelevant. It is also a third deliberate over-revocation, beyond the two the round records.

Minimal fix: use the same private suspension mechanism proposed above while validating the response. Restore the authorization when the response is stale, mismatched, or otherwise ignored; permanently withdraw it only when a candidate is actually replaced. Alternatively, explicitly accept and document the new behavior and add a test starting from `pending()` with a mismatched response.

## H1, H2 and H3 status

### H1 — base-revision disagreement: **closed**

[restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1644) reads `session.baseRevision` once into `baseRevision`.

That local:

- is compared with the snapshotted `submission.baseRevision`;
- fills `RestorePermit.baseRevision`;
- fills `RestorePermit.submission.baseRevision`.

A draft getter that returns equality during `submissionOf` and changes later cannot bypass this: the later value is never read into the permit. `sendRestore` now sends `permit.baseRevision` at line 2223, which is the same field `permitHolds` checks at line 2099.

### H2 — re-entrant withdrawal: **partially closed**

The ordinary revocation paths are repaired. `revokeConfirmation` is genuinely the bare reference operation:

```ts
PENDING_AUTHORIZATIONS.delete(session);
```

It reads no session property, invokes no callback, and is first in:

- `loadingBatches`;
- `chooseBatch`;
- `loadingEntries`;
- `chooseEntry`;
- `candidateRead`;
- `candidateRefused`;
- `cancelRestore`;
- `applyRestore`;
- `restoreConfirmationWithdrawn`;
- `acknowledgeRestoreFindings`;
- `reloadTheDiskVersion`.

`withdrawn` also starts with the same revocation, covering direct withdrawal and `measuredAgainst`. In particular, `reloadTheDiskVersion` now revokes before `conflictOf`, `session.reload`, the arbitrary adoption callback, either spread, or `conflict.diskRevision`.

The six question-carrying transitions are:

- `batchesLoaded`;
- `entriesLoaded`;
- `restoreCouldNotBeSent`;
- `dismissRestoreOutcome`;
- `askToReloadDiskVersion`;
- `confirmDiskReload`.

`carryTheQuestion` itself is sound. Its successor is built before entry; a confirmation during that construction leaves nothing to carry. Once entered, the checked take and subsequent set contain no caller-controlled operation.

The remaining exception is `targetRevisionObserved`, described in High 1. Therefore H2 is not closed on every path.

The unconditional revocation in `acknowledgeRestoreFindings` is an acceptable trade: any direct call that cannot record consent may require the question to be asked again, but no authorization survives caller-controlled refusal-state reads.

The same trade is acceptable in `reloadTheDiskVersion`; its control is reachable only from conflict state, where preparing a restore question is ordinarily refused. Its unconditional revocation also closes malformed or re-entrant callers safely.

### H3 — `adoptDiskVersion` double installation: **closed**

[workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:2065) snapshots `conflict.source` and `adoption.disk.id` before the membership test. There is nothing between:

```ts
spentConfirmations.has(confirmation)
spentConfirmations.add(confirmation)
```

Both operations use object identity and invoke no caller code.

The later release paths are:

1. unknown or mismatched conflict origin;
2. document no longer projected;
3. projection generation changed.

A re-entrant call made after reservation sees the confirmation reserved and returns before acquiring or releasing anything. Only the reserving call reaches `releaseReservation`, and the deletion itself invokes no caller code. Consequently, one call cannot release a reservation another call is relying on.

Reads occurring later through `viewOf`, revision comparison, or installation happen while the reservation is held. They can re-enter, but the re-entrant call cannot install or release.

## Rewritten tests

The in-place rewrites are legitimate and necessary. With authorization keyed by the exact session, the former spread-based cases would have been rejected solely for using an unregistered object; they no longer exercised the field comparisons they were named for.

The rewritten cases now establish real properties:

- destination changes are rechecked;
- base revision changes are rechecked;
- entry changes are rechecked;
- candidate revision changes are rechecked;
- preview generation changes are rechecked;
- confirmation does not re-read the retained draft after spending;
- refusal leaves the exact question repairable;
- the pre-spend re-entrant confirmation still mints at most one permit.

The separate copy test correctly pins the new identity rule for both spread and structured cloning.

Re-keying by session identity is stricter, but it transfers responsibility to every transition that returns a successor. The carry/revoke table is useful evidence for ordinary executions. It does not cover the temporary absence exposed during `targetRevisionObserved`, which is why all current rows can pass despite High 1.

A missing regression is specifically: re-entrant `prepareRestore` while `targetRevisionObserved` has taken the authorization but not yet restored it.

The mismatch tests for `candidateRead` also do not begin with a live question, so they miss Low 2.

## Independent check-and-spend sweep

### `restore.ts`

- `confirmRestore`: safe. Caller-controlled checks precede a checked deletion; a re-entrant winner makes the outer deletion fail.
- `sendRestore`: both mismatch consumption and successful authorization use checked deletion results.
- `carryTheQuestion`: safe; no caller-controlled operation occurs after the checked take.
- `takeTheQuestion`: safe; `get` and checked `delete` are separated only by primitive operations.
- `revokeConfirmation`: discarded result is a release and mints nothing.
- `targetRevisionObserved`: unsafe because the taken entry’s absence enables `prepareRestore` to register a successor before the original is restored.

### `workspace.svelte.ts`

- `adoptDiskVersion`: the `has`/`add` reservation is now contiguous and sound.
- `spentConfirmations.delete`: discarded release is safe because only the reserving call can reach it.

### `invalidation.ts`

`openWholeDocumentSave` remains sound. Between `SEALS.get(sealed)` and `SEALS.delete(sealed)` there is only an `undefined` comparison and return branch. No property read or callback can re-enter between them. The discarded deletion result is therefore safe under the current ordering.

### Candidate revision and bytes

The record’s wording “cannot be closed from here” is accurate if “here” means the current `BackupTextResponse` contract and a synchronous frontend with no revision implementation. Separate caller-controlled `revision` and `text` properties cannot be proven to correspond without deriving one from the other.

It is not fundamentally unclosable. Two constructions would bind them:

- compute the content revision from the captured text in the frontend and reject disagreement; or
- have the IPC adapter produce an opaque/branded candidate snapshot, retained in a private registry, so `candidateRead` accepts only the exact backend-produced tuple rather than independently readable structural properties.

Both require changing code or the boundary outside the present `prepareRestore` ordering fix. The record should continue saying “cannot be closed from the current interface,” not “unclosable” without qualification.

This acknowledged gap does not currently permit substituted bytes to be sent: the permit carries the captured bytes and `permitHolds` compares those bytes with the live preview. It does mean the frontend cannot independently prove that the backend-supplied hash describes them.

## Decision record

Section 9.1’s H1 account agrees with the code.

Section 9.2 is partly false:

- its bare-reference description of `revokeConfirmation` is true;
- its enumeration of the six carrying transitions is true;
- its claim that the `targetRevisionObserved` take-and-put-back has no exploitable opening is false because `prepareRestore` can observe the temporary absence;
- consequently, the assertions that all three Highs are closed and that every current transition maintains the presentation/authorization obligation are false.

Section 9.3’s `adoptDiskVersion` adjudication is true. Reservation is immediate, the three refusal releases are owned by the reserving call, and no losing call can release the winner’s reservation.

Section 9.4 correctly classifies the three discarded deletions in the requested files as non-authorizing releases. It misses the interaction between `takeTheQuestion`, `putTheQuestionBack`, and `prepareRestore`, so its sweep conclusion is incomplete.

The “unclosable” instance is recorded honestly only with its present “cannot be closed from here” scope. A wider claim that no construction can bind the pair would be false.

## Readiness

The phase is **not ready to commit**. H1 and H3 are closed, and most of H2 is repaired, but the exceptional `targetRevisionObserved` path still permits two live authorizations through synchronous re-entrant preparation. Low 2 should also be resolved or explicitly accepted and documented before the next confirmation review.

Codex session ID: 01a00248-1436-7bc1-aafa-9c8563d2fa85
Resume in Codex: codex resume 01a00248-1436-7bc1-aafa-9c8563d2fa85
