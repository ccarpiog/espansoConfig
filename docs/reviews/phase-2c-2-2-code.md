1. **High — [DetailPane.svelte:397](/Users/ccarpio/Developer/espansoConfig/src/lib/components/DetailPane.svelte:397) — the displayed filename can move while the editor’s save target does not.**  
   `editingMatch` captures match A, but `file={browser.selectedDocument}` remains reactive. Open A’s editor → select a snippet/file B while it remains open → the header shows B → type and save → `session.match` still targets A, so A’s bytes are changed while the screen identifies B. Capture the document together with the match, e.g. `{ match, file }`, and pass the captured file as the raw editor already does. Add a DetailPane-level mounted test that changes the selection while editing.

2. **Medium — [MatchEditor.svelte:548](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchEditor.svelte:548) — reprojection is optional despite the model and record saying the caller re-seeds.**  
   After a committed save, both “Read this snippet again” and “Dismiss” are offered. Choosing Dismiss clears the outcome through `keepEditing` and restores the controls without calling `reproject`, permanently hiding `needsReprojection`. The session then continues with carried-over eligibility even though [matchEditor.ts:1363](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchEditor.ts:1363) says only a fresh projection can establish it. This does not presently expose a CR write—the input and save-time gates remain intact—but it violates the recorded refresh protocol and can make later eligibility changes unsafe. Require reprojection before continued editing; alternatively make Dismiss close the editor rather than resume it.

3. **Medium — [workspace.svelte.ts:285](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:285) — the documented `failure === null` invariant is not represented by the widened type.**  
   The comment claims `null` occurs only when no command ran, but the single failed arm allows every combination of `mayHaveWritten` and `IpcFailure | null`. Any alternate `BrowserState` implementation or component test double can return `{ kind: 'failed', mayHaveWritten: true, failure: null }` after running a command and still type-check. The production implementation currently constructs the intended combinations, but the published shape merely asserts the guarantee. Split this into discriminated local-refusal and command-failure arms, with `failure: IpcFailure` required on the latter.

4. **Low — [MatchEditor.test.ts:432](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchEditor.test.ts:432) — the mounted test claims all other twenty-one fields are unchanged but samples only five.**  
   A regression that sets `label`, `word`, `left_word`, `right_word`, or another omitted field could pass while the test still claims complete preservation. Compare the captured draft with one complete expected `MatchDraft`, or iterate every key except `replace`.

I found no component path that bypasses the three carriage-return gates: refused CR values never enter controls, `oninput` delegates through `editField`, and `beginSave` remains the final derived-draft gate. The component also uses `BrowserState.saveMatch`, renders typed i18n accessors, keeps word-boundary fields textual, and reports failed adoption beside the successful outcome.

READINESS: NOT READY

Codex session ID: 019fc684-b512-71e1-b175-eb1fe5bc9f1d
Resume in Codex: codex resume 019fc684-b512-71e1-b175-eb1fe5bc9f1d
