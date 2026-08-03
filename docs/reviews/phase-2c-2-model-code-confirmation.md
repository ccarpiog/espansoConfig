MEDIUM — [src/lib/browser/workspace.svelte.ts:1023](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:1023) — `saveMatch` invalidates `fileTextAnswer` but never the separate `conflictText` cache, so the decision record’s claim that all raw text is dropped is false.  
Scenario: a raw save conflict captures version A, a later field save commits version B, and `rawTextOf(document)` still returns A—even when adoption reports `done`.

LOW — [src/lib/browser/draft.ts:548](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/draft.ts:548) — collapsing a net-zero typing group cannot restore an oldest undo entry already evicted by the group’s initial bounded push.  
Scenario: fill all 100 history slots, type one character after closing the previous group, then erase it within 700 ms; the value returns to its start but history falls to 99 entries and the oldest state is no longer reachable by undo.

READINESS: NOT READY — invalidate document-scoped conflict text on field-save state changes and make net-zero coalescing history-neutral at the history bound.

Codex session ID: 019fc50c-1b39-7513-bc99-b2651967bbb0
Resume in Codex: codex resume 019fc50c-1b39-7513-bc99-b2651967bbb0
