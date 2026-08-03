READINESS: NOT READY

### 1. [High] Creation consent survives changes to the transaction it authorized

**Where:** `src/lib/browser/matchCreation.ts:608`
**What:** `chooseDestination` and `choosePlacement` change the destination/position without clearing acknowledgement consent, the submitted refusal, or the outcome. Destination changes also leave `draft.baseRevision` unchanged despite lines 512–516 claiming it moves.
**Why it matters:** A create refused in file A at `End` can have its findings accepted, then be redirected to file B or `Front`; `beginCreate` reuses the old acknowledgement because the drafted buffers are unchanged. Identical finding values can therefore authorize a transaction the person was never shown.
**Fix:** Treat destination and placement as part of the submission identity. At minimum, both transitions must invalidate submitted findings and consent; destination changes must also rebase the draft to that destination’s revision. Add tests that acknowledge a refusal, retarget, and assert an empty acknowledgement.

### 2. [High] The wrapper silently rebases a stale creation form

**Where:** `src/lib/browser/workspace.svelte.ts:1594`
**What:** `BrowserState.createMatch` has no `baseRevision` parameter and always sends the workspace’s current `view.revision`, ignoring the revision stored by the creation value.
**Why it matters:** Open a form at R0 with `End`, let another operation reproject the document to R1, then submit the old form. The wrapper sends R1, so the core sees no conflict and may commit against a file the form was never based on. The decision record’s claim that “the command’s own conflict check” decides is false because the original base never reaches that check. Deletion similarly sends a stale R0 identity with an unrelated R1 base, producing an identity failure rather than the promised revision conflict.
**Fix:** Carry the submission’s base revision through both `BrowserState` APIs and send it unchanged. Test a form/session opened at R0 after the workspace adopts R1.

### 3. [High] A returned identity is resolved in a different revision by node alone

**Where:** `src/lib/browser/workspace.svelte.ts:1913`
**What:** After re-reading, creation adoption passes `moved` to `positionOf`, which deliberately compares only `node`; it never verifies that `fresh.value.revision === moved.revision`.
**Why it matters:** If another process changes the file between the save result and `getDocument`, fresh projection R2 can reuse the R1 arena node. The window then selects an unrelated R2 snippet as the one just created. The same defect exists in `adoptTheDocumentOnDisk` at line 1865.
**Fix:** Resolve `moved` only by all three identity fields. If the fresh revision differs, perform ordinary repair and do not expose the old `moved` as a currently usable created identity. Test R1 `moved` against an R2 projection reusing its node.

### 4. [Medium] Save adoption does not cancel an in-flight selection lookup

**Where:** `src/lib/browser/workspace.svelte.ts:956`
**What:** Installing a post-save projection does not increment `selectGeneration`.
**Why it matters:** Start `select(deletedSnippet)`, commit its deletion while `getMatch` is pending, and let adoption select the neighbour with `deleted`. When the stale lookup finishes, its repair can land afterwards, clear that neighbour, and replace the mandated notice with `differentMatch`. Creation can likewise be dragged away from the newly created snippet.
**Fix:** Invalidate pending selection requests whenever a save installs or forgets a document projection, before awaiting adoption. Add deferred-`getMatch` tests for create and delete.

### 5. [Medium] A reload does not actually invalidate pending deletion consent

**Where:** `src/lib/browser/matchDeletion.ts:428`
**What:** `confirmDelete` compares the pending identity only with the immutable identity in the same session. If the workspace reprojects while that value is retained, both remain stale and equal, so confirmation still succeeds. The wrapper is also directly callable without `StartedDeletion`.
**Why it matters:** The header and decision record claim a reload cannot carry stale consent, but no transition observes a reload or current identity. The test at `matchDeletion.test.ts:219` manufactures a changed `session.match`; it does not exercise the real retained-session path and therefore passes for a different reason than claimed.
**Fix:** Add an explicit reprojection/invalidation transition that clears pending consent, or require the current projected identity/revision at confirmation and compare it with pending, session, and draft. Narrow the documentation and test claims if wrapper-level enforcement remains intentionally impossible.

### 6. [Low] Not every open file is offered as required by Q5

**Where:** `src/lib/browser/matchCreation.ts:307`
**What:** `destinationsOf` accepts only successful projections and omits documents in `BrowserState.loadFailures`.
**Why it matters:** An open but unreadable file disappears from the destination list instead of appearing ineligible with a typed reason. The decision record acknowledges the departure but defers it to step 2 despite declaring the consult authoritative.
**Fix:** Build destinations from document summaries plus projection/load-failure state and add a typed, localized unreadable reason.

### Not findings

- The committed-delete ordinal fallback itself is correct and adopts only identities from the fresh projection.
- The Q7 fixture genuinely changes every surviving target-file identity, and its scoped-list and selected-identity assertions would catch retained pre-commit identities.
- `committed: false`, `mayHaveWritten`, conflict adoption, failed re-read beside a committed outcome, and text-cache invalidation are handled correctly.
- The typing extraction and localization key/accessor coverage appear faithful.

Codex session ID: 019fc76e-cd9c-74e2-929d-4c43cadb1ec6
Resume in Codex: codex resume 019fc76e-cd9c-74e2-929d-4c43cadb1ec6
