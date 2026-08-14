Unable to create [phase-2c-5-4b-confirmation-4.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-5-4b-confirmation-4.md): the workspace is mounted read-only. Full review follows.

# Phase 2c-5-4b fourth confirmation review

## High

None.

## Medium

None.

## Low

### 1. `withNothingPending` documents a precondition and caller inventory that the code does not satisfy

**File:** [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1013)

The new JSDoc says to call `withNothingPending` “only after `revokeConfirmation`,” describes `unchangedByInspection` as its third caller, and describes its parameter as a session whose question has already been revoked.

That is not true of `carryTheQuestion`, which calls it at line 968 after `takeTheQuestion` returns `undefined`.

Concrete synchronous counterexample:

1. An outer `candidateRead(asked, …)` replaces the permit under `asked` with suspension `C`.
2. A getter reached during that inspection calls `batchesLoaded(asked, answer)`.
3. `batchesLoaded` constructs a fresh successor and calls `carryTheQuestion`.
4. `takeTheQuestion(asked)` sees `C`, refuses to take it, and returns `undefined`.
5. `carryTheQuestion` calls `withNothingPending(to)`.
6. No `revokeConfirmation` occurred; `C` remains under `asked` and the outer `finally` can restore its permit.

The runtime behavior is safe because `to` is fresh and has no authorization under its key. The defect is the stated helper contract: a maintainer following it could incorrectly assume every call follows revocation. Several revoke-first frozen branches also call the helper, so the “two transitions”/“third caller” inventory is incomplete.

Minimal fix: describe the actual precondition and the three call families without numbering them: revoke-first paths have removed the entry; `unchangedByInspection` has established that the argument must not present the inspected question; and `carryTheQuestion` passes a fresh successor after finding nothing transferable.

## Confirmation of the previous Low

The Low is closed.

[unchangedByInspection](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:877) now asks the correct question on both branches:

- When `suspension === undefined`, it uses bare `PENDING_AUTHORIZATIONS.has(session)`.
- When this call owns a suspension, it requires `PENDING_AUTHORIZATIONS.get(session) === suspension`.

In the specified nested sequence, `cancelRestore` deletes the outer cell. The nested call’s `has` therefore returns false and `withNothingPending` returns a cleared copy. The outer call likewise finds that its cell is gone and returns a cleared result. No retained result presents the dead confirmation.

The regression at [restore.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.test.ts:1784) drives the requested sequence. Both traps are asserted, every retained result receives the biconditional assertion, the original asked session is confirmed dead, and all retained sessions are driven through the send path with zero replacements. No assertion was weakened.

## Independent sweep of the fix

`WeakMap.prototype.has` on the object key runs no caller code and reads no property. It is not separated from a spend or producer operation: both answers leave the map unchanged and only select between the original session and a cleared copy.

The enumeration of what can make `has === true` is complete. No write path was missed:

- `suspendTheQuestion` can only replace an existing permit; that would have made the current call own a cell.
- `restoreTheQuestion` can restore under the same key, but an outer `finally` cannot execute while its nested call is still running.
- `prepareRestore` registers only its newly constructed `asked` object.
- All six `carryTheQuestion` callers pass a fresh object literal as `to`.
- The remaining map operations only delete or transfer existing entries and cannot newly make this branch’s `has` true.

The source contains exactly 14 `PENDING_AUTHORIZATIONS` calls across the eight functions listed in §10.3.

## Behavior-change risk

The `RestorePane.svelte` convergence claim is correct.

At [RestorePane.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/RestorePane.svelte:387), a dead presented question produces one cleared copy. After that assignment, the next effect run has `pending === null`; `withNothingPending` returns that session by reference, so the identity guard at line 392 performs no further assignment. There is no fresh-object loop.

The frozen-state identity claim is also correct for reachable states:

- `phase: 'saving'` is produced by `confirmRestore` together with `pending: null`.
- `restored: true` is produced by `applyRestore` from its `answered` state, which sets `pending: null` first.

Thus reachable frozen states already satisfy `withNothingPending` by reference.

## Decision record

The reviewed decision-record changes match the implementation:

- §10.1’s correction accurately distinguishes the nested `undefined` branch and qualifies the temporarily held outer suspension.
- §10.3’s table accounts for all 14 calls across eight functions and correctly describes their narrowing or deliberate indifference.
- §11 accurately records the defect, the two branch questions, the synchronous `has` argument, the same-key write-path enumeration, the behavior change, the regression, and the pane/frozen-state reasoning.

No decision-record guarantee overclaim remains in the reviewed sections.

## Test execution

The targeted Vitest file could not start because Vite attempted to create `node_modules/.vite-temp/...` and the read-only mount returned `EPERM`. The review above is therefore inspection-based.

## Verdict

**The previous Low is closed, and the implementation is sound. The phase is not ready to commit solely because the new `withNothingPending` JSDoc states a false precondition and incomplete caller inventory.** Correct that comment, then this scoped change is ready.

Codex session ID: 01a0026c-6b45-7950-970d-0b4cac278888
Resume in Codex: codex resume 01a0026c-6b45-7950-970d-0b4cac278888
