# Phase 2c-5-4a code review

## Findings

### High — Q8: the permit check and spend are not atomic under synchronous re-entry

**File and line:** `src/lib/browser/restore.ts:1654-1665`; the contrary guarantee is repeated in `src/lib/browser/restore.ts:1356-1365`, `src/lib/browser/restore.ts:1597-1618`, `src/lib/browser/workspace.svelte.ts:1345-1353`, and `docs/decisions/2c-5-4a-notes.md:185-196`.

**What is wrong:** `sendRestore` reads the permit, calls `permitHolds`, and only afterwards calls `PERMITS.delete(started)`. The result of that deletion is ignored (`restore.ts:1654-1660`). `permitHolds` performs many reads from caller-supplied `session` and `context` values (`restore.ts:1563-1595`). Any of those reads can invoke a getter or proxy trap. Such a trap can synchronously re-enter `sendRestore` with the same `StartedRestore`; the inner call can validate, delete the permit, and enter its sender before the outer `permitHolds` returns. The outer call then ignores its failed deletion and invokes its sender as well. One permit can therefore issue two writes.

The ordinary sequential-twice case does not exercise this: it waits for the first `restoreDocument` call to finish before making the second (`workspace.test.ts:6833-6852`). The decision record's statement that the permit deletion is one of the already-atomic spends (`2c-5-4a-notes.md:185-196`) is consequently a guarantee the code does not give.

**Why it is wrong:** Q8 requires one unspent confirmation to authorize the exact bound submission (`phase-2c-5-design.md:76-80`). The implementation and decision record explicitly identify synchronous re-entry—not merely `await` interleaving—as the check/spend threat (`restore.ts:1410-1421`; `2c-5-4a-notes.md:185-190`). Deleting before the sender is insufficient if validation and deletion can be separated by re-entrant property access.

**Narrowest fix:** after all potentially re-entrant validation, make the deletion a checked spend:

```ts
if (permit === undefined || !permitHolds(permit, session, context)) {
  return { kind: 'notAttempted' };
}
if (!PERMITS.delete(started)) {
  return { kind: 'notAttempted' };
}
```

Then add a test whose getter/proxy re-enters `restoreDocument`/`sendRestore` during `permitHolds` and assert that the raw-save sender is called exactly once. Update the JSDoc and decision record only after that test passes.

### Medium — a rejected permit leaves the returned restore permanently in `saving`, so the documented “ask again” recovery does not exist

**File and line:** `src/lib/browser/workspace.svelte.ts:2948-2954`; `src/lib/browser/restore.ts:1654-1657`; `src/lib/browser/restore.ts:600-611` and `835-854`; `docs/decisions/2c-5-4a-notes.md:298-309`.

**What is wrong:** on every `sendRestore` mismatch, `restoreDocument` returns its input `session` unchanged (`workspace.svelte.ts:2948-2954`). On the intended call path that input is `started.session`, whose phase was set to `saving` by confirmation (`restore.ts:1475-1483`). The restore model deliberately makes its editing transitions no-ops while that phase is `saving` (`restore.ts:600-611`, `835-854`). Thus the self-reported “lied about observed” case does not merely burn a question and let “the panel ask again,” as the record says (`2c-5-4a-notes.md:298-304`): the coordinator returns a session still claiming a send is in flight even though no sender ran, and the normal transitions cannot take it back to an askable state. The mismatch also leaves the permit in `PERMITS`, because the early return precedes deletion (`restore.ts:1654-1657`).

The second footgun is also avoidable: `restoreDocument` accepts both `started` and an independently selectable `session` (`workspace.svelte.ts:1403-1408`), even though `StartedRestore` already carries the session that confirmation produced (`restore.ts:1317-1326`). The test at `workspace.test.ts:6817-6831` pins the silent no-write behavior, but pinning an API misuse does not prevent 4b from shipping a dead or misleading panel.

**Why it is wrong:** writing nothing on mismatch satisfies the destructive safety half, but the state returned to the future screen falsely says a write is still running. It also contradicts the record's claimed recovery. These are preventable coordinator/API states, not limitations that TypeScript inherently cannot express.

**Narrowest fix:** remove the redundant `session` parameter from `BrowserState.restoreDocument` and derive it from `started.session` when `started` is non-null. Give `sendRestore` a distinct consumed/withdrawn answer for a validation mismatch, consume the permit with a checked deletion, and return a model transition that clears `phase` and `inFlight` while retaining the candidate and exposing the applicable refusal. Preferably make the BrowserState coordinator perform confirmation from its own projection observation as well, so a caller cannot manufacture the first footgun. Add tests asserting both no write and a non-`saving`, re-askable returned session for projection mismatch and wrong-session attempts.

### Low — the decision record says object identity is tested, but the assertion checks only structural equality

**File and line:** `src/lib/browser/workspace.test.ts:6607-6619`; `docs/decisions/2c-5-4a-notes.md:215-217`.

**What is wrong:** the record says the batch identity is asserted to reach the command “as the very object it was given” (`2c-5-4a-notes.md:215-217`), while the test uses `toEqual([RESTORE_BATCH])` (`workspace.test.ts:6618`). A rebuilt but structurally equal object would pass. The implementation currently forwards the argument directly (`workspace.svelte.ts:2899-2903`), but the stated evidence does not hold that behavior.

**Why it is wrong:** this project's governing rule treats an evidence or guarantee claim as a defect when the code/test does not provide it. An opaque identity may presently serialize by value, but the record specifically claims reference identity evidence.

**Narrowest fix:** assert the actual captured argument with `toBe(RESTORE_BATCH)`, or narrow the decision record to say that the opaque identity's value is forwarded unchanged rather than claiming object-identity coverage.

## Verified points and severity coverage

- `restoreDocument` does build `observed` from BrowserState's projections before its first `await` (`workspace.svelte.ts:2917-2947`). The write still uses `permit.submission.baseRevision` and `permit.submission.candidate`, not that observation or caller-supplied text (`restore.ts:1661-1665`). Subject to the High atomicity finding, this does not refresh the frozen base revision and does preserve the candidate-text binding.
- `InvalidateEverySurface` is required with no default (`workspace.svelte.ts:1403-1408`) and is passed to `applyRestore` (`workspace.svelte.ts:2961-2965`). `applyRestore` opens the seal before describing the result and carries invalidation failure beside the outcome (`restore.ts:1742-1764`); `openWholeDocumentSave` catches a throwing invalidator without replacing the committed outcome (`invalidation.ts:339-369`).
- The separate `BackupCommands` interface keeps all three backup reads required (`workspace.svelte.ts:322-351`) and the production default contains all three real functions (`workspace.svelte.ts:354-359`). It does create the admitted testing seam whereby omitting the third `createBrowserState` argument selects real IPC (`workspace.svelte.ts:1444-1448`; `2c-5-4a-notes.md:70-75`), but the record states that limitation accurately. I do not consider that alone a release defect for this coordinator-only half; 4b's mounted tests must inject it explicitly, and folding the interfaces later would remove the seam.
- The three read wrappers are genuinely unmemoised and re-callable (`workspace.svelte.ts:2895-2914`), and the tests issue repeated calls (`workspace.test.ts:6667-6696`). That is the coordinator affordance needed for a re-ask, not the user-visible discharge: the record correctly leaves offering the control to 4b (`2c-5-4a-notes.md:120-127`, `324-325`).
- I found no additional Q6 forbidden-claim finding in the changed comments, test names, or decision record. The conflict test says that nothing was *written* and nothing was installed (`workspace.test.ts:6924-6940`), which is the required narrow predicate rather than the forbidden bare “Nothing was changed.” The committed-invalidation test continues to report the committed outcome with a separate message (`workspace.test.ts:7028-7052`).

There are no additional High, Medium, or Low findings beyond the three above.

## Verdict

**Not ready for 2c-5-4b.** The unchecked permit deletion is a High Q8 violation and must be fixed before a screen can call this path. The `notAttempted` state handling should also be repaired before mounting the coordinator, because the current API can leave the future panel permanently claiming an in-flight send after a write-safe mismatch. Once those are fixed and covered by re-entrant and recovery tests, the backup wrappers, frozen-base forwarding, and invalidation composition are suitable foundations for 4b.
