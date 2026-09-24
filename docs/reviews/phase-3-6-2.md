Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 2 finding(s): 0 blocker(s), 2 should-fix.

Do not ship yet: list controls can display edits that saves silently omit, and recovery gives contradictory trigger instructions.

- [SHOULD-FIX] medium · confidence 1 — src/lib/components/MatchEditor.svelte:1417 — Removed lists retain writable inputs that silently discard edits
    Mounted reproduction: remove search_terms, type into an item, add the list back, then edit another field and save. The typed term remains visible, but the submitted draft contains…
    Fix: Expose item editability from the model, requiring list presence. Render removed items read-only or through SourceText. Add a mounted regress…
- [SHOULD-FIX] medium · confidence 1 — src/lib/components/RecoveryPanel.svelte:847 — Carried trigger lists still receive a missing-value instruction
    Mounted recovery for Multiple shows “not carried over: type it below, because a snippet cannot be written without it”, while this branch removes the input and displays the complete…
    Fix: Derive the transfer-table status from the carried trigger form. A literal omitted because regex or triggers is carried must not receive need…

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: src/lib/components/MatchEditor.svelte:1417 — Removed lists retain writable inputs that silently discard edits — Expose item editability from the model, requiring list presence. Render removed items read-only or through SourceText. Add a mounted regress…
SHOULD-FIX: src/lib/components/RecoveryPanel.svelte:847 — Carried trigger lists still receive a missing-value instruction — Derive the transfer-table status from the carried trigger form. A literal omitted because regex or triggers is carried must not receive need…
NOT-VERIFIED: Fix both model/view mismatches and add mounted regressions for the reproduced paths.
