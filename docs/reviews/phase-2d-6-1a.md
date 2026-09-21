Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 3 finding(s): 0 blocker(s), 3 should-fix.

Ship with fixes: message-safety checks and guarantees are overstated, and one count decomposition is wrong. No current runtime regression found.

- [SHOULD-FIX] medium · confidence 1 — src/lib/i18n/externalConflictCodes.test.ts:307 — Spanish absence checks miss successful-save claims
    The Spanish forbidden list lacks an equivalent of English “saved”. In memory, prepending “El archivo se ha guardado.” to each externalEvidence refusal passed both the forbidden-wor…
    Fix: Detect affirmative Spanish saved claims without rejecting the approved negative “ningún guardado” wording. Add positive controls for each fo…
- [SHOULD-FIX] medium · confidence 1 — src/lib/browser/saveOutcome.ts:1248 — The external message position is not protected by its type
    This comment claims ExternalConflictMessage excludes save-origin codes from the first position, but the array is contextually typed as ConflictMessage[], which includes every SaveO…
    Fix: State that the producer and runtime tests enforce the exclusion. Alternatively, narrow the external message list and first element, then add…
- [SHOULD-FIX] low · confidence 1 — docs/decisions/2d-6-1a-notes.md:168 — The svelte-check decomposition omits the production module
    The recorded baseline is 444, not 445. All three new TypeScript files are included by tsconfig, accounting for 444 → 447; the existing check log confirms 447. Attributing the incre…
    Fix: Record 444 → 447 and attribute the increase to the production module plus both test files.

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: src/lib/i18n/externalConflictCodes.test.ts:307 — Spanish absence checks miss successful-save claims — Detect affirmative Spanish saved claims without rejecting the approved negative “ningún guardado” wording. Add positive controls for each fo…
SHOULD-FIX: src/lib/browser/saveOutcome.ts:1248 — The external message position is not protected by its type — State that the producer and runtime tests enforce the exclusion. Alternatively, narrow the external message list and first element, then add…
SHOULD-FIX: docs/decisions/2d-6-1a-notes.md:168 — The svelte-check decomposition omits the production module — Record 444 → 447 and attribute the increase to the production module plus both test files.
NOT-VERIFIED: Correct the message-safety checks and comments, update the count record, and run the affected i18n tests and type check.
