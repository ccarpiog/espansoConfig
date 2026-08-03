High — `src/lib/browser/workspace.svelte.ts:1238` — `saveMatch` collapses every command failure to `null`, discarding the `mayHaveWritten` bit required by `saveCouldNotBeSent`. Scenario: `SyncDirectory` fails after rename with `may_have_written: true` → the wrapper returns only `null` → the editor cannot distinguish it from `noWorkspaceOpen` and may falsely report that nothing was written.

Medium — `src/lib/browser/workspace.svelte.ts:1384` — failed reprojection leaves stale projections and identities installed while the committed result is still returned, contradicting the adoption guarantee claimed at `docs/decisions/2c-2-1-notes.md:209`. Scenario: field save commits → `getDocument` fails → `adoptTheDocumentOnDisk` reports and returns → the caller receives `saved` while the workspace continues displaying the pre-save match model.

Medium — `src/lib/browser/matchEditor.ts:982` — the final save gate does not recheck carriage returns despite `MatchBuffers` being an unbranded structural type, so the “never carries a carriage return” claim at line 305 is not enforced. Scenario: a well-typed caller applies `editDraft` directly with `replace.text = "a\rb"` → `beginSave` succeeds → `{ Set: "a\rb" }` reaches the wire, unlike the raw editor’s mandatory save-time refusal.

Low — `src/lib/browser/workspace.svelte.ts:1390` — identity adoption repoints any current selection in the document to the saved match, even when that selection changed while the save was in flight. Scenario: save match A → select match B in the same file before the response → A’s committed response arrives → selection unexpectedly jumps from B back to A.

Low — `src/lib/browser/matchEditor.ts:770` — coalescing retains a past entry when a typing burst returns to its starting value, producing an undo operation that changes nothing. Scenario: baseline `replace = "b"` → type `"b1"` → within 700 ms erase back to `"b"` → `canUndo` remains true, but undo still displays `"b"` and merely consumes a ghost history step.

READINESS: NOT READY — preserve failure classification, make failed adoption invalidate or explicitly accompany the committed result, add a save-time CR gate, and correct the history and selection transitions.

Codex session ID: 019fc4f7-4af8-72c2-9d3d-9f016084a3c3
Resume in Codex: codex resume 019fc4f7-4af8-72c2-9d3d-9f016084a3c3
