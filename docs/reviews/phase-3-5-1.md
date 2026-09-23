Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 1 finding(s): 0 blocker(s), 1 should-fix.

The switch preview can promise to retain a companion that the submitted draft deletes.

- [SHOULD-FIX] medium · confidence 0.99 — src/lib/browser/matchEditor.ts:4479 — Make the confirmed companion preview agree with the save candidate
    Reproduced with an existing paragraph field: choose and confirm replace→markdown, then removeField(session, 'paragraph'). beginSave accepts paragraph: 'Remove', but the preview sti…
    Fix: Enforce the companion-removal restriction against the captured save candidate, including removals drafted before choosing the switch. Derive…

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: src/lib/browser/matchEditor.ts:4479 — Make the confirmed companion preview agree with the save candidate — Enforce the companion-removal restriction against the captured save candidate, including removals drafted before choosing the switch. Derive…
NOT-VERIFIED: Add regression tests for companion removal before and after switch confirmation, covering both the model and core planner.
