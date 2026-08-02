# Phase 2c-1a — aggregate code review

**Verdict as delivered: `READINESS: NOT READY`**, on three High findings. Held to the files of
the phase plus the specification it implements; no web search, no tree sweep. Reviewer: Codex, via
`codex:codex-rescue`.

The brief carried the protocol rules as *rules* — the three `SaveResult` arms with
`committed: false` a legal success, the exact-multiset acknowledgement, the content-addressed
`DocumentDoesNotParse`, the prohibition on reporting a committed write as an error, the permanent
`moved: null`, and the reservation of the phrase *"keep my draft"* for 2c-4b — so that a violation
of one would be reported as a defect rather than as a matter of taste. It also told the reviewer
that the tests pass and to skip "add a test for X" unless the missing test hid a real defect.

**All eight findings were fixed before the commit.** The disposition is `PROGRESS.md` § "Phase
2c-1a review disposition".

---

## The review, verbatim

1. **Severity: High** — `src/lib/browser/invalidation.ts:102`, `src/lib/browser/invalidation.ts:125`

   **Failure scenario:** `PAYLOAD` is private only at the TypeScript-name level. At runtime:

   ```ts
   const sealed = sealWholeDocumentSave(document, result);
   const symbol = Reflect.ownKeys(sealed).find((key) => typeof key === 'symbol')!;
   const leaked = (sealed as any)[symbol]; // SaveResult, no opener or invalidation
   ```

   `Object.getOwnPropertySymbols` and `Object.getOwnPropertyDescriptors` work too. Object spread also copies the enumerable symbol property; reflecting on the copy recovers it. `JSON.stringify`, `Object.keys`, and `structuredClone` do not expose the payload, but that does not save the claim.

   The seal is also reusable: it can be opened repeatedly, including later with a no-op callback. `invalidationOf` does not itself leak the seal because it already requires a `SaveResult`, but exporting it does not repair this.

   The module documentation's claim that the outcome cannot be read except through the opener is false, as are the stronger claims in `docs/decisions/2c-1a-notes.md:127` and `docs/decisions/2c-1a-notes.md:270` that sealing is unignorable.

   **Fix:** Do not store the payload on the public object. Store it in a module-private `WeakMap<SealedWholeDocumentSave, SealedBox>`, delete the entry when opened, and reject a second open. That prevents reflection, spread, cloning, and serialization from recovering the payload and makes the seal one-shot.

2. **Severity: High** — `src/lib/browser/invalidation.ts:158`

   **Failure scenario:** A committed save is sealed, but `forget` throws:

   ```ts
   openWholeDocumentSave(sealedCommittedSave, () => {
     throw new Error('state invalidation failed');
   });
   ```

   The function never returns the committed `SaveResult`; the caller sees an exception after bytes were committed. This is exactly the prohibited "committed write afterwards reported as an error" failure mode.

   **Fix:** Catch invalidation failures and return an outcome object that retains the `saved` result plus a typed `windowOutOfStep`/invalidation-failed status. Do not permit callback exceptions to replace the save outcome. Combined with the WeakMap fix, consume the seal once while retaining an honest result.

3. **Severity: High** — `src/lib/browser/draft.ts:108`, `src/lib/browser/draft.ts:197`, `src/lib/browser/draft.ts:345`

   **Failure scenario:** Structured values are stored by reference. With the forthcoming `MatchDraft`:

   1. Create candidate A and acknowledge its refusal.
   2. Mutate a nested field or array in place to candidate B.
   3. `draft.value` and `consent.candidate` are the same object, so `boundAcknowledgement` considers them equal.
   4. `submissionOf` emits candidate B with A's acknowledgement, with no edit history or consent invalidation.

   If `baseValue` is the same object, the same mutation also changes the base, so `isDirty` remains false. Thus dirty is functionally derived, but it is derived from mutable aliases rather than stable snapshots.

   TypeScript `readonly` is shallow and does not provide a runtime barrier; this makes the generic state unsafe for the structured `MatchDraft` it explicitly targets.

   **Fix:** Require snapshot semantics as part of draft construction, for example `{ same, snapshot }`, and snapshot values when recording the base, current value, history, save base, reload base, and consent candidate. Freeze snapshots in development. Clone/freeze acknowledgements as well.

4. **Severity: Medium** — `src/lib/browser/draft.ts:345`, `docs/decisions/2c-1a-notes.md:257`

   **Failure scenario:** Even without mutation, the exported API permits:

   ```ts
   const acknowledgementA = submissionOf(acknowledgedA).acknowledgement;
   const submissionB = submissionOf(acknowledgeDraft(draftB, acknowledgementA));
   ```

   `acknowledgeDraft` binds any supplied acknowledgement to B without checking where it came from. Therefore the decision record's claim that "this module never produces such a pairing" is false: the module constructs it when given A's acknowledgement.

   Nothing in the type or this module's runtime stops it. Only the server's newly-derived exact-multiset check prevents an incorrect write; `DocumentDoesNotParse.revision` provides the candidate-specific part of that protection.

   **Fix:** Accept a refusal object coupled to the submitted candidate rather than a bare `Acknowledgement`, and runtime-check its candidate revision/hash before storing consent. Prefer an opaque consent object constructed from `{ submission, refusedResult }`; `acknowledgeDraft(draft, arbitraryAcknowledgement)` is too permissive.

5. **Severity: Medium** — `src/lib/browser/draft.ts:415`

   **Failure scenario:** Submit value `2`, type value `3` while saving, then receive success for `2`. `savedDraft` correctly leaves `3` dirty against base `2`, but clears all history. The user cannot undo the post-submission edit from `3` back to the now-saved `2`.

   This is acknowledged at `docs/decisions/2c-1a-notes.md:82`, but it is still a state-shape defect for asynchronous editors, not merely presentation awkwardness.

   **Fix:** Give submissions a history generation/index. On success, discard history before the submitted boundary while retaining edits made afterward. Explicitly handle the case where undo or branching abandoned the submitted candidate.

6. **Severity: Medium** — `src/lib/browser/invalidation.ts:121`, `src/lib/browser/saveOutcome.ts:280`

   **Failure scenario:** Save scope and document identity are caller assertions:

   - `describeSaveOutcome(rawRefusal, 'edit')` suppresses the required whole-document replacement disclosure.
   - `describeSaveOutcome(editResult, 'wholeDocument')` adds a false raw-save model.
   - `sealWholeDocumentSave(documentB, resultFromDocumentA)` invalidates the wrong document.
   - A whole-document saved result with a non-null `moved` remains representable and is passed through, despite the protocol requiring it to be permanently `null`.

   **Fix:** Introduce command-specific, opaque results produced by the adapters that actually know scope and document, such as `WholeDocumentSaveResult` carrying its `DocumentId` and a saved arm with `moved: null`. Use separate whole-document/edit describers instead of an independently supplied scope string.

7. **Severity: Medium** — `src/lib/browser/saveOutcome.ts:217`, `src/lib/browser/saveOutcome.ts:320`, `docs/decisions/2c-1a-notes.md:179`

   **Failure scenario:** A caller can discard the draft and then call `describeSaveOutcome(conflict, scope)`. The returned model still says `draftKept: true` and emits `draftKeptInMemory`. Likewise, nothing in this type requires confirmation before a caller reloads.

   Literal `true` makes dishonest presentation-model values harder to construct, but it does not make the promised behavior "not expressible," as the decision record claims.

   **Fix:** Model conflict as a state transition that accepts and returns the actual `Draft<T>`, with the conflict state carrying the retained draft. Expose reload through a separate confirmed transition rather than a descriptive boolean.

8. **Severity: Low** — `src/lib/browser/draft.ts:273`, `src/lib/browser/draft.ts:324`

   **Failure scenario:** Every raw-editor keystroke appends a whole-document string indefinitely. A long session on a large configuration creates unbounded retained text and array-copy work.

   **Fix:** Make history policy explicit—coalescing, maximum entries/bytes, or reversible edits—before 2c-1b connects keystrokes to `editDraft`.

The `rawSave.ts` refactor is behavior-preserving in the available diff: the former `acknowledgeable` condition and returned arrays were extracted unchanged into `refusalAcknowledgement` and `refusalChoices`; no behavioral defect is visible there.

The state shape is not yet adequate for `MatchDraft` or later conflict rebase: structured draft snapshots are not protected from aliasing, post-submission history is lost, and conflict state does not carry the retained draft or the target/base projection needed for a controlled reapplication.

READINESS: NOT READY — the seal is runtime-readable and a throwing invalidation can hide a committed save, while structured-value aliasing defeats both dirty tracking and candidate-bound consent.
