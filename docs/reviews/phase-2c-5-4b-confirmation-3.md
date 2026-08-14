Unable to create [phase-2c-5-4b-confirmation-3.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-5-4b-confirmation-3.md): the workspace is mounted read-only. Full review follows.

# Phase 2c-5-4b third confirmation review

## High

None.

## Medium

None.

## Low

### 1. A nested inspection can return a session that still presents a question after a re-entrant withdrawal removed its authorization

**Confirmed defect:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:863); the corresponding decision-record claims at [2c-5-4b-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-4b-notes.md:985) and line 1023 are too broad.

`unchangedByInspection` treats `suspension === undefined` as sufficient reason to return `session` without consulting `PENDING_AUTHORIZATIONS`:

```ts
return suspension === undefined || PENDING_AUTHORIZATIONS.get(session) === suspension
  ? session
  : withNothingPending(session);
```

That is sound for the ordinary no-question case and while an outer suspension is still present. It is not sound when this is a nested inspection and another getter withdraws the outer suspension before the nested inspection returns.

Concrete synchronous failure:

1. `S` presents a live question and holds permit `P`.
2. An outer `candidateRead(S, staleResponse)` replaces `P` with suspension cell `C`.
3. Its first read of `S.entry` invokes a getter which calls and retains the result of `targetRevisionObserved(S, null)`.
4. The nested `suspendTheQuestion(S)` sees `C` and returns `undefined`, correctly leaving ownership with the outer call.
5. The nested call’s read of `S.phase` invokes another getter which calls `cancelRestore(S)`. That revocation deletes `C` and returns its own cleared copy.
6. The nested call reaches `unchangedByInspection(S, undefined)`. Because the first disjunct is true, it returns the original `S` by reference even though the map is now empty.
7. The getter retains that returned `S`. The outer call detects that `C` is gone and returns a cleared copy, and its `finally` does not resurrect `P`; nevertheless, the retained nested result still has `pending !== null` and `confirmRestore` on it returns `null`.

This cannot issue an unauthorized write: the withdrawal wins and the authorization stays gone. It does violate the stated presentation/authorization biconditional by leaving a caller with a confirmation control that can do nothing. The current tests cover a withdrawal inside an inspection that owns the suspension, but not a withdrawal inside a nested inspection whose `suspendTheQuestion` returned `undefined`.

Minimal fix: do not make `undefined` bypass the authority check. On that branch, test bare map presence before deciding to return the session:

```ts
if (suspension === undefined) {
  return PENDING_AUTHORIZATIONS.has(session)
    ? session
    : withNothingPending(session);
}
return PENDING_AUTHORIZATIONS.get(session) === suspension
  ? session
  : withNothingPending(session);
```

Add a regression with an outer inspection, a nested inspection, and a withdrawal from a property getter reached by the nested call; assert that every retained transition result with `pending !== null` still confirms.

Section 10.1 should qualify its biconditional claim, and §10.3 should record this nested-owner case. Its statement that there are “exactly eight operations” reading the map should also be replaced by an explicit access-site list; the source has more than eight map call sites, depending on whether a checked get/delete pair is counted as one logical operation.

## Suspension-marker audit

Every access to `PENDING_AUTHORIZATIONS` was checked against the union value:

- `suspendTheQuestion` (`restore.ts:807–813`) gets the union, rejects `undefined` and narrows with `isSuspended`, then stores a private suspension. Sound.
- `restoreTheQuestion` (`restore.ts:837–838`) compares the current value with the exact owned cell and reads `permit` only from that typed private cell. Sound.
- `unchangedByInspection` (`restore.ts:867–869`) does not return the union, but its `suspension === undefined` shortcut is the Low above.
- `revokeConfirmation` (`restore.ts:906`) is genuinely indifferent: deleting either a permit or a suspension is the intended withdrawal.
- `takeTheQuestion` (`restore.ts:970–974`) explicitly rejects a suspension before its checked delete, so `carryTheQuestion` receives only `RestorePermit | undefined`. Sound.
- `carryTheQuestion` (`restore.ts:936–938`) stores only the already-narrowed result of `takeTheQuestion`; a suspension cannot escape through it. Sound.
- `prepareRestore` (`restore.ts:1829, 1883`) is deliberately indifferent at `has`: a suspension must count as an existing question. Its `set` stores a newly built permit under the newly built asked session. Sound.
- `confirmRestore` (`restore.ts:2130–2184`) rejects `undefined` and narrows with `isSuspended` before reading permit fields or passing the value to `PERMITS`; its later delete is checked. Sound.

`SuspendedQuestion`, `SUSPENSIONS`, and all helpers which accept or return a suspension are module-private. No cell is attached to a returned session, returned from an exported function, or passed to caller code.

`isSuspended` is exactly `SUSPENSIONS.has(held)`, not a field or prototype check. A caller-supplied `{ permit }` object cannot spoof it, and callers have no operation that can place such an object in the private map.

## Suspension and restoration ordering

The replacement sequence in `suspendTheQuestion` is:

```text
WeakMap.get → private WeakSet.has → object literal → private WeakSet.add → WeakMap.set
```

None invokes caller code. There is no `await` in `candidateRead`, `targetRevisionObserved`, or the suspension/restoration helpers. Re-entry can therefore occur only through synchronous caller-controlled property access—a getter or proxy `get` trap—not through another event-loop turn.

Both inspection functions enter `try` immediately after suspension and restore in `finally`. A throw during inspection either:

- leaves the owned cell present, in which case the original permit is restored; or
- follows a re-entrant deletion, in which case the identity check prevents resurrection.

A deliberate withdrawal that deletes the cell before a later getter throws also remains a withdrawal, which is internally consistent. The restoration identity check and the lack of caller code between its `get`, equality test, `suspension.permit` data-property read, and `set` are sound.

## Previously closed findings

### H1 — base-revision disagreement: closed

`prepareRestore` reads `session.baseRevision` once at `restore.ts:1838`, refuses disagreement with `submission.baseRevision` at line 1840, and fills both permit representations from that local.

`sendRestore` sends `permit.baseRevision` at line 2424, the same field `permitHolds` checks. No regression found.

### H2 — re-entrant withdrawal producing a usable authorization: closed

The suspension eliminates the temporary-absence producer hole. It remains under the same key, `prepareRestore.has` sees it, `confirmRestore` cannot spend it, `takeTheQuestion` cannot carry it, and an identity-checked `finally` cannot restore over a withdrawal.

The Low above is a presentation-only nested-return defect; it does not preserve, duplicate, or resurrect an authorization. On the security property H2 names, **H2 is now closed**.

The eleven revoke-first calls still put the bare `PENDING_AUTHORIZATIONS.delete(session)` operation before caller-controlled reads. The six carrying transitions still construct their successors before entering `carryTheQuestion`; `takeTheQuestion` still performs a checked delete with no caller code between lookup and consumption. `confirmRestore` and both `sendRestore` consumption paths still check their deletion results.

### H3 — one reload confirmation installing twice: closed

[workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:2065) snapshots both caller-controlled properties before the contiguous `spentConfirmations.has` / `spentConfirmations.add`.

Only the reserving call can reach the three release arms at lines 2103, 2109, and 2127. A losing re-entrant call returns above the reservation and cannot release the winner’s entry. No regression found.

## Round-3 Low

The stale/mismatched `candidateRead` regression is closed.

The document, entry, and batch refusal arms suspend before validation and, in an ordinary call, restore the same permit and return the same session by reference. They withdraw nothing. Only the candidate-replacement arm calls `withdrawn`, deletes the suspension, and installs the new preview.

The transition documentation at `restore.ts:1539–1545` matches that ordinary behavior. The newly found nested-inspection defect does not reinstate the old stale-response over-revocation.

Therefore **the round-3 Low is closed**.

## Independent shape sweep

### `restore.ts`

- `confirmRestore`: property reads remain before a checked deletion; no authorizing result is discarded.
- `sendRestore`: both mismatch consumption and successful authorization use the result of `PERMITS.delete`.
- `takeTheQuestion`: lookup, suspension narrowing, and checked deletion contain no caller-controlled operation.
- `carryTheQuestion`: its successor is built before entry; the value stored is narrowed by `takeTheQuestion`.
- `suspendTheQuestion` / `restoreTheQuestion`: private collection operations are contiguous, and restoration is identity-checked.
- `revokeConfirmation`: its discarded deletion is a release and authorizes nothing.
- `prepareRestore`: `has` is a refusal guard, and a present suspension correctly refuses a duplicate producer.
- `unchangedByInspection`: no check/spend or discarded-consumption defect, but the independent state/result sweep found the Low above.

### `workspace.svelte.ts`

`adoptDiskVersion` has no property read between `spentConfirmations.has` and `add`. Its discarded deletes are owned releases and authorize nothing. No new instance of either requested shape was found.

### `invalidation.ts`

`openWholeDocumentSave` still has only an `undefined` comparison and return branch between `SEALS.get` and `SEALS.delete`. Its discarded deletion is safe under this ordering because it precedes every callback and authorizes nothing based on the deletion result. No new instance was found.

## Decision record

The §9.2 corrections now accurately supersede temporary removal with suspension, and §9.4 explicitly identifies the missed producer interaction.

The `preview.revision` / `preview.draft.value` gap is correctly scoped as **not closable from the current interface**, not flatly unclosable, and names both binding constructions:

1. Frontend recomputation and refusal.
2. An opaque branded IPC-adapter snapshot retained in a private registry.

Section 10 accurately describes the marker, its unforgeable `WeakSet` discrimination, identity-checked restoration, ordinary `candidateRead` refusal behavior, and five counterexample builds. It overclaims the presentation/authorization result because §10.1 and §10.3 omit the nested-inspection sequence in Low 1. Those claims must be corrected with the code.

## Readiness

**H2 is closed. The prior Low is closed. The phase is not ready to commit.**

The new suspension mechanism protects authorization correctly, but the beyond-minimal `unchangedByInspection` helper can return a retained session that draws a dead confirmation control during nested synchronous re-entry. Fix its `undefined` branch, add the nested regression, correct §10’s biconditional claim, and run the required confirmation review of that change.

Codex session ID: 01a0025f-24f9-75e0-8967-e65f4974d87b
Resume in Codex: codex resume 01a0025f-24f9-75e0-8967-e65f4974d87b
