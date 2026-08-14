# Phase 2c-5-4a fix-round confirmation

## Findings

### Low — the fix record calls consent one-attempt while the withdrawal transition deliberately preserves it

**File and line:** `src/lib/browser/restore.ts:35-39`, `src/lib/browser/restore.ts:1567-1570`, and `docs/decisions/2c-5-4a-notes.md:472-477`; the contrary behavior is stated and implemented at `src/lib/browser/restore.ts:1901-1912` and `src/lib/browser/restore.ts:1922-1926`, and repeated at `src/lib/browser/workspace.svelte.ts:2986-2993`.

**What is wrong:** the new prose justifies consuming a mismatched permit with the rule that “consent is for one attempt.” But `restoreConfirmationWithdrawn` intentionally keeps the preview draft, including its acknowledgement, and leaves `submitted` intact. Once a transient mismatch such as an open write surface is removed, `prepareRestore` and `confirmRestore` can therefore mint a new permit whose submission carries the same acknowledgement. The acknowledgement is not one-attempt.

This does **not** let consent collected for candidate A reach candidate B through the model's transitions. Candidate, entry, catalogue, and base-revision changes go through `withdrawn`/`measuredAgainst`, which retarget the draft and clear its acknowledgement; `boundAcknowledgement` also binds it to the exact candidate. The implementation consistently treats acknowledgement as candidate-scoped. The false part is the newly strengthened prose, which conflates the one-shot confirmation/permit with the candidate-bound acknowledgement and thereby claims a guarantee the code does not give.

**Why it is wrong:** this repository treats an unsupported JSDoc or decision-record guarantee as a defect even when runtime safety remains intact. The distinction matters for 4b: the screen may re-ask for confirmation after withdrawal while retaining an acknowledgement, so its copy and tests must not be designed around an alleged fresh-consent requirement.

**Narrowest fix:** change the affected sentences to say that **the confirmation and permit authorize one send attempt**, while acknowledgement remains bound to the same candidate and is cleared by every transition that changes the candidate or what it is measured against. If the intended policy truly is one-attempt acknowledgement, instead route `restoreConfirmationWithdrawn` through the existing consent-clearing withdrawal helper and add a surface-mismatch case proving the acknowledgement is gone; that is a broader behavioral change and is not required for candidate-binding safety.

There are no High or Medium findings.

## Status of the three original findings

- **Original High — fully closed.** Every path in `sendRestore` that can reach `send` must first succeed at `PERMITS.delete(started)` (`restore.ts:1737-1745`). The validation-mismatch path also uses the deletion's checked result (`restore.ts:1724-1730`), so a re-entrant winner owns the withdrawal and the loser answers `notAttempted`. `PERMITS` has no other consumer, and `sendRestore` is the only route in `restore.ts` to a sender. `confirmRestore` likewise uses the checked `PENDING_CONFIRMATIONS.delete` before minting a permit. `applyRestore`, `restoreCouldNotBeSent`, and `restoreConfirmationWithdrawn` classify or transition an answer; none reaches a writer or performs a check-then-act permit spend. The acknowledged direct-call holes through `BrowserState.saveRawDocument`/IPC remain general architectural holes, not escaped permit paths introduced or narrowed by this fix.

- **Original Medium — fully closed.** `restoreDocument` derives the session from `started.session`, eliminating the bad pairing. A mismatch that actually consumes the permit returns `withdrawn`, and the wrapper applies `restoreConfirmationWithdrawn`, clearing `phase`, `inFlight`, and `pending` while retaining the candidate. The resulting editing session is genuinely actionable: `restoreRefusal` can report the live obstruction, and after a target movement `targetRevisionObserved` can re-measure it. No official candidate/base-changing transition can carry acknowledgement to another candidate. The Low finding above is a new overstatement about the lifetime of candidate-bound acknowledgement, not a reopening of the stuck-`saving` defect.

- **Original Low — fully closed.** The batch-listing test now captures the command argument and uses `toBe(RESTORE_BATCH)`, matching the record's object-identity claim (`workspace.test.ts:6607-6622`; notes §3 and §6.3).

## Confirmation checks

`RestoreSend`'s consumers are complete. The production consumer distinguishes `notAttempted`, `withdrawn`, failed `answered`, and sealed `answered`; the tests either inspect the discriminant or operate only after asserting an answered arm. No discarded result of `PERMITS.delete` or `PENDING_CONFIRMATIONS.delete` remains.

`BrowserState.restoreDocument` returning `RestoreSession | null` does not reproduce the earlier multi-outcome defect shape. Here `null` has one actionable meaning across its causes: **this invocation produced no session, so do not install one**. A non-null result always means install the returned transition. Whether no confirmation existed or another invocation already spent the permit changes the history, but not what this invocation can truthfully return or what its caller should do. The underlying `RestoreSend` retains the three-way distinction where it is needed to decide whether a session transition is owed.

The re-entrancy test is honest. The `Symbol.iterator` trap runs inside `permitHolds`, re-enters the same public coordinator with the same `StartedRestore`, and reaches the real raw-save spy; with the old discarded deletion both calls send. It does not fundamentally depend on iteration being the final property read: if the trap moved earlier within validation, the inner call could still spend before the outer deletion and the old implementation would still send twice. It would cease to exercise re-entry if `competingSurfaceFor` stopped reading `Symbol.iterator` altogether, so it is one concrete regression vector rather than an exhaustive getter/trap matrix; §6.5 states that limitation accurately.

The §6.2 decision to defer a coordinator-owned confirmation helper is acceptable for this fix round, though its first rationale is overstated. Such a helper would reduce misuse on the intended component path even though exports permit bypass, just as `restoreDocument` remains useful despite direct access to `saveRawDocument`; it would not literally “close nothing.” The other grounds hold: all four context-consuming affordance gates must agree, the component owns the surface/context supplier, and 4b is where that supplier is introduced. Deferral therefore leaves no demonstrated write-safety defect in 4a, but 4b should construct one shared live `RestoreContext` for `restoreView`, `restoreRefusal`, `prepareRestore`, and `confirmRestore` rather than wrapping only confirmation.

The newly written Q6-sensitive sentences make no forbidden restore claim. Uses of terms such as “valid UTF-8,” negative assertions that a recognised batch is not authentic/recoverable/undo, and tests scanning for forbidden words are predicates or denials rather than claims that a backup is valid, authentic, historical, or recoverable. The new no-write wording uses the required narrow form: “this restore attempt sent/wrote nothing.” No new sentence substitutes “backup” for **recognised backup batch**.

## Verdict

**Ready for 2c-5-4b after the Low prose correction.** The destructive High is closed, the previously stranded session is re-askable, and the identity evidence now matches its record. The remaining change is a narrow contract/decision-record correction so 4b is not built against a false one-attempt-acknowledgement guarantee.
