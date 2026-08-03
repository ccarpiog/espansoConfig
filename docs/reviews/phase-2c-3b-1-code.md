READINESS: NOT READY

1. HIGH — [matchMove.ts:1027](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1027), [2c-3b-1-notes.md:249](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:249)  
   Concrete failure: a session opens at R0, then `moveMatch` returns `saved`, `committed:false`, revision R1. The wrapper correctly adopts R1 because its `outOfDate` condition detects the revision change, but `applyMove` sets `moved:false`, rebases only the draft to R1, and leaves the match and anchors at R0. The model consequently says the session remains usable even though its identities are stale; a live R1 identity makes `beginMove` return `null`. The record’s guarantee that “`committed:false` spends nothing” is therefore false. The existing test compounds this by pairing an R1 result with `NOT_OWED`.  
   Smallest fix: distinguish “move committed” from “session identities were invalidated.” Spend or re-seed the session whenever adoption was owed/revision changed, without falsely claiming the move committed; add the exact `committed:false`, R1, `adoption:done` test and correct the record.

2. HIGH — [matchMove.ts:207](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:207), [2c-3b-1-notes.md:121](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-3b-1-notes.md:121)  
   Concrete failure: an unsaved draft identifies snippet A at R0 as document 2/node 10; after reprojection, node 10 can identify unrelated snippet B at R1 because `MatchId` is session-local. `sameSnippet` ignores the revision and declares B to be A, so `moveEligibility` refuses B for `unsavedDraft`. Both the comment and decision record incorrectly guarantee that an older-revision document/node pair is “the same snippet”; the test at lines 347–353 enshrines that unsupported identity.  
   Smallest fix: do not infer cross-revision identity from arena node reuse. Pass a coordinator-derived fact identifying the currently edited match, or compare complete identities and require stale editor sessions to be resolved separately. Correct the record and test.

3. MEDIUM — [matchMove.ts:1215](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.ts:1215), [matchMove.test.ts:410](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.test.ts:410)  
   Concrete failure: choose an `after` placement in an R0 session, then call `movePlacementOptionsOf` with R1 projections. The selected anchor disappears from the options, but `moveSubmissionRefusal` consults only the frozen R0 anchors and returns `null`; `matchMoveView` therefore reports `canMove:true`. Pressing Move with the live R1 identity makes `beginMove` return `null` without the promised `anchorUnavailable` refusal. The comment claiming that reprojection produces `anchorUnavailable` is false. The record admits that arm has no legitimate producer, despite shipping two user-facing strings for it. The test observes only that options disappear, not the contradictory enabled state.  
   Smallest fix: derive submission availability from the same live projections used to build options, or add an explicit transition that invalidates/re-seeds the session. Otherwise remove the unreachable arm and strings until step 2 supplies a real producer.

4. LOW — [matchMove.test.ts:742](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchMove.test.ts:742)  
   Concrete failure: the test says the view preserves any future presentation note, but supplies `saved()` with `notes: []` and asserts `[]`. Replacing the implementation with `notes: []` would still pass, so the preservation guarantee in `matchMove.ts` and the decision record is untested.  
   Smallest fix: pass a non-empty `PresentationNote` and assert it is returned unchanged.

WHAT I COULD NOT CHECK

The targeted Vitest run could not start because the read-only sandbox denied Vite creation of `node_modules/.vite-temp/...mjs`. Consequently I could not independently reproduce the recorded test/check/build counts. I also did not inspect the Rust `plan_move` implementation because it was outside the permitted file/import scope. Static i18n validation did confirm 36 keys per language, exact key and placeholder parity, and no Spanish `atajo`; `git diff --check` reported no diff errors.

Codex session ID: 019fc8b6-f8b6-7391-8730-ea9425eb1252
Resume in Codex: codex resume 019fc8b6-f8b6-7391-8730-ea9425eb1252
