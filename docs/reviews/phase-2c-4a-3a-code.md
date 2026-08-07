# Phase 2c-4a step 3a — aggregate code review (Codex, round 1)

Job `task-msiol06o-zqw0fq`, dispatched read-only against the uncommitted working tree over base
commit `061e75e`. The job could not create this file itself — the workspace was mounted read-only,
so its patch was rejected and no repository file was modified by the review. The text below is the
job's reply verbatim, copied here by the orchestrator.

---

NOT READY

Findings:

1. **High — Behaviour/prose — `src/lib/i18n/en.json:160` and `es.json:160`**  
   The failed-copy message falsely says the displayed text can be copied manually. `SourceText.svelte:39` replaces `\r` with localized marker text, so manual selection cannot recover the original draft. Confirming reload afterward can lose the exact draft. Implement a CR-safe clipboard fallback, or remove the manual-copy guarantee from both locales and `2c-4a-3a-notes.md:129`.

2. **High — Behaviour/prose — `src/lib/browser/saveOutcome.ts:523`**  
   Match conflicts still display `reloadDiscardsDraft`, claiming disk text replaces the draft. These surfaces actually install the disk projection and close. The new confirmation sentence therefore contradicts the shared sentence. Produce surface-aware messages in `src/lib/browser/`; retain “replaces your text” only for the raw editor.

3. **Medium — Behaviour — `src/lib/browser/editorSave.ts:363`**  
   After adoption returns `refused`, the spent confirmation remains presented as actionable. Repeated confirmation can only be refused again, with no explanation. Add a shared refused/unavailable reload state, disclose it, and remove the spent confirm choice while preserving *Keep editing* and copy.

4. **Medium — Test falsifiability — `src/lib/components/MatchEditor.test.ts:1083` and `MatchCreator.test.ts:897`**  
   Clipboard mocks inspect the textarea’s full value, not its selection. Removing `select()` and `setSelectionRange()` would leave tests green while real copying could fail. Require a full selection, record only selected text, and compare exactly with the expected `tDraftCopy(...)`.

5. **Medium — Rule placement — `src/lib/components/MatchEditor.svelte:810` and `MatchCreator.svelte:735`**  
   Both renderers independently decide that `diskText === ''` means an empty file. Move this shared semantic decision into a browser-model union/helper and make both components walk that model.

6. **Medium — Prose — `src/lib/i18n/en.json:250` and `es.json:250`**  
   The creator warning says the form restarts empty, but the implementation closes it. Remove that claim or say a subsequently opened form starts empty.

7. **Low — Prose — `src/lib/components/clipboard.ts:145`**  
   Documentation says cleanup failure returns `false`, but cleanup failures are swallowed and the previous copy result is returned. Correct the documentation or change the behavior.

Clean categories:

- `alreadyThere` is correctly treated as success; only `refused` prevents closing.
- The origin-bound adoption protocol is not bypassed.
- No stale retry, automatic reload, YAML emission, diff, cross-revision identification, or “keep my draft” control was added.
- `conflictChoicesFor` remains the sole choice-list producer.
- Mover, deleter, and duplicator remain untouched.
- i18n keys are at parity, accessors are used, and Spanish matches English—including the identified wording defects.
- No byte-span/UTF-16 indexing issue was introduced.

Codex session ID: 019fdb54-d7af-77a3-826d-f9c24bc42a84
Resume in Codex: codex resume 019fdb54-d7af-77a3-826d-f9c24bc42a84

---

# Round 2 — confirmation pass over the fixes

Job `task-msipkqx9-mevkae`, dispatched read-only against the same working tree. Reply verbatim,
copied here by the orchestrator for the same reason as round 1.

---

NOT READY

1. **PARTIALLY CLOSED** — User-facing copy-failure wording and production comments are corrected, but narrower false fidelity claims remain in a test comment.
2. **CLOSED** — Reload warnings are surface-aware; raw editor reseeds, while all five match surfaces truthfully say they close.
3. **CLOSED** — Refused adoption becomes terminal-but-dismissible, removes the reload controls, discloses the refusal, and resets through every dismissal/new outcome.
4. **CLOSED** — The two new clipboard mocks inspect the selected range and compare it exactly with `tDraftCopy(...)`.
5. **CLOSED** — `ConflictDiskText` and `conflictDiskText()` now own the empty-file decision; all three renderers consume the union.
6. **CLOSED** — Creator wording now distinguishes the current form closing from a subsequently opened form starting empty.
7. **CLOSED** — Clipboard documentation now matches cleanup behavior.

Remaining round-1 finding:

- **Low — Prose — `src/lib/components/MatchEditor.test.ts:1214` and `src/lib/components/MatchEditor.test.ts:1238`**  
  The CR test says “the panel still shows every byte” and later calls the localized representation “the value … on screen for a manual selection.” The panel does not show the CR byte/value: `SourceText` substitutes its localized name. The assertions correctly prove that substitution, but the commentary still suggests the fidelity/manual-recovery framing that finding 1 rejected. This also makes the blanket “all seven … fixed” record at `docs/decisions/2c-4a-3a-notes.md:325` premature.  
  **Why it matters:** This is the warned-about narrower instance of the prior false-copy claim. It does not affect runtime behavior, but it leaves a false explanation beside the regression test.  
  **Concrete fix:** Say that the panel shows a readable representation with the CR named, explicitly not the original selectable value; remove “shows every byte” and “for a manual selection.”

**New findings introduced by the fixes:** None found.

Clean categories:

- All six `spendTheConfirmedReload` call sites handle `notAttempted`, `refused`, and `satisfied`. `alreadyThere` reaches the success path everywhere; only `refused` stops the caller.
- Every refused spend writes `RELOAD_REFUSED`. Every dismissal and every applied new outcome writes `NOT_RELOADING`, so the three live panels can leave the terminal state through *Keep editing*.
- The three currently unoffered surfaces declare `reloadOutcome: 'closesSurface'`, consistent with their successful reload transitions setting `closed: true`; these are truthful values, not compilation fillers.
- Raw-editor clipboard behavior remains materially unchanged: async clipboard first, selection fallback second, exact text for all drafts that the raw editor can open, cleanup failures swallowed, and success/failure disclosed.
- Origin-bound adoption remains intact through `ConflictModel.source`; nothing was rebound to `conflict.expected`.
- No stale retry, `saveAnyway` on conflicts, automatic reload, dirty-state clearing, cross-revision identity inference, YAML-from-projection, diff, or “keep my draft” control was introduced.
- `conflictChoicesFor` remains the sole choice-list producer.
- User-facing additions are enum/accessor-driven; no hand-built translation key was introduced.

Test falsifiability:

- The six model refused-spend cases fail if `refused` is treated as success, if `RELOAD_REFUSED` is not stored, if a reload label remains offered, or if a second attempt calls adoption again.
- The three mounted refused-spend cases fail if the disclosure disappears, a reload control remains, the draft is reseeded/panel closes, or *Keep editing* does not restore the surface.
- The `alreadyThere` cases fail if that successful answer is mapped onto the stop path.
- The surface-aware model test fails if any declaration or message mapping is swapped; each surface’s success test separately fails if a declared closing surface stops closing or the raw editor stops reseeding.
- The two clipboard-copy cases fail if both selection calls are removed, if the selected range is incomplete, or if field labels, order, statuses, or text diverge from `tDraftCopy(...)`.
- The disk-text model and mounted raw-editor cases fail if empty text stops becoming the `empty` arm or that arm stops rendering as an empty file.
- No executable test pins the semantic wording of `draftCopyFailed`, `reloadClosesForm`, or the clipboard JSDoc: reverting those prose fixes while retaining the same keys would leave the suites green. The current code can therefore be confirmed only by direct prose review, which found the remaining test-comment issue above.

Codex session ID: 019fdb6e-481b-7ff2-9040-892792f41116
Resume in Codex: codex resume 019fdb6e-481b-7ff2-9040-892792f41116
