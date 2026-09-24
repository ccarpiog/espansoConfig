Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 2 finding(s): 1 blocker(s), 1 should-fix.

Do not ship yet: form changes can silently discard drafted aliases, and ordinary combined flow-list edits produce unsaveable batches.

- [BLOCKER] high · confidence 1 — src/lib/browser/matchEditor.ts:2437 — Repointing a drafted list silently drops aliases
    Reproduced through public transitions: start with trigger ':a', choose triggers, add ':alias', then choose regex and confirm. The choice remains offered because eligibility checks…
    Fix: Check the currently drafted list before offering or applying a scalar destination. Refuse multiple-item conversion without clearing its buff…
- [SHOULD-FIX] medium · confidence 0.99 — src/lib/browser/matchLists.ts:426 — Generated flow-list insertions overlap item removals
    For search_terms: [a, b, c], removing b and adding 'new' at its position passes beginSave and produces RemoveItem(1) plus InsertItems After(1). Static tracing through Rust shows th…
    Fix: Coordinate flow insertion placement with the batch's removals so generated edits have disjoint spans and preserve order. Add byte-exact Rust…

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: src/lib/browser/matchEditor.ts:2437 — Repointing a drafted list silently drops aliases — Check the currently drafted list before offering or applying a scalar destination. Refuse multiple-item conversion without clearing its buff…
SHOULD-FIX: src/lib/browser/matchLists.ts:426 — Generated flow-list insertions overlap item removals — Coordinate flow insertion placement with the batch's removals so generated edits have disjoint spans and preserve order. Add byte-exact Rust…
NOT-VERIFIED: Fix both paths and add focused regression tests before closing phase 3-6-1.
