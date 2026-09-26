# Phase 4-2 — B1 reproduction and bounded repair

**Status:** implementation record for step 4-2 of [`4-split-notes.md`](4-split-notes.md) §2. B1 is
[`3-6-3-notes.md`](3-6-3-notes.md) §4 item 1. **All evidence here is mounted (jsdom) evidence, recorded as
mounted evidence under ruling 29; no window reading was performed or is claimed.** The visible counterpart
is owed to step 4-13.

---

## 1. What was reproduced, and at which layer

**Reproduced, at the rendering layer.** Delivery and model state were correct; the renderer threw.

The match editor's conflict comparison (`{#snippet comparison()}` in
`src/lib/components/MatchEditor.svelte`, drawn inside `.panel.external` and inside a save conflict's
outcome panel) walked `view.retainedDraft` in a keyed `{#each}` **keyed by `field.label`**. Since Phase
3-6-1 the model (`retainedDraftOf` / `structureRowsOf` in `src/lib/browser/matchEditor.ts`) emits **one row
per drafted list item, each with the list's label** (`triggers` or `searchTerms`) — pinned as intended by
`triggerLists.test.ts`, *lists the drafted items with their status*. As soon as a draft holds two or more
item rows for one list, the keys collide and Svelte throws `each_key_duplicate`. That check is not
dev-only: `node_modules/svelte/src/internal/client/dom/blocks/each.js` (Svelte 5.56.8) throws
`e.each_key_duplicate('', '', '')` in production when `length > keys.size`. The throw aborts the flush that
would have drawn the conflict, so the panel never appears and the editor's controls stay as they were
(the save button stays enabled on screen although the session refuses a save).

This matches the window observation's shape: every exploratory launch whose draft added a list item drew
no panel; the drafts with no list-item edit drew it. It also explains why *only* list-item drafts were
affected: a scalar-only draft produces the seventeen field rows plus at most one `regex` row, all distinct.

**Layer by layer (mounted suite, unchanged renderer):**

| Layer | Assertion | Unchanged tree |
|---|---|---|
| Delivery | the editor's registration was handed one envelope, verdict `raised` | passes |
| Model state (window) | `standingConflictFor(1)?.kind === 'externalChange'` | passes |
| Model state (session) | `matchEditor.test.ts` model case: `applyObservation` over an added item yields `externalConflict`, the draft retained, `canSave` false | passes |
| Rendering | save button disabled, list boxes read-only, `.panel.external` drawn, drafted item still in the boxes and in the panel | **fails** — first failing assertion is the save button's `disabled` (`expected false to be true`), plus one uncaught `Svelte error: each_key_duplicate … duplicate key \`triggers\` / \`searchTerms\` at indexes 17 and 18` per failing case |

## 2. Failing-first evidence (unchanged tree)

Cases added before the repair, in `src/lib/components/DetailPane.test.ts`, describe
*"B1: a draft holding a list-item addition, told of an external change — Phase 4-2"*. They mount the
pane over a real `BrowserState`, open the editor through its control, build the draft through the
editor's own list controls, then wake the real coordinator with one `Changed` observation — the snippet
**removed** from the file (`matches: []`) or its `replace` **changed** in place. Eight rows:

| Draft | removal | change |
|---|---|---|
| `triggersItem` — item added to an existing block `triggers` list | fail | fail |
| `searchTermsItem` — item added to an existing `search_terms` list | fail | fail |
| `triggersBySwitch` — literal switched to a list, confirmed, then an item added (L20's shape) | fail | fail |
| `searchTermsNewList` — absent `search_terms` added with one item (one row only) | pass | pass |

The first two rows are the four combinations the step names. The last row passing is consistent with the
cause: one row per label cannot collide.

Commands and kept output:

- `npx vitest run src/lib/components/DetailPane.test.ts -t "B1"` →
  `/private/tmp/4-2/failing-first-unchanged-tree.txt` (6 failed, 2 passed).
- The same command with the final test text and the renderer line put back to `(field.label)` →
  `/private/tmp/4-2/failing-first-final-tests-unrepaired.txt` (6 failed, 2 passed).
- `npx vitest run src/lib/browser/matchEditor.test.ts -t "B1|added to"` →
  `/private/tmp/4-2/model-layer-unchanged-tree.txt` (2 passed — the model layer was never broken).
- After the repair: `/private/tmp/4-2/after-repair.txt` (8 passed, no unhandled error).

## 3. The repair, and why it is bounded

One line in the one file the failing trace reached: `src/lib/components/MatchEditor.svelte`, the
comparison's `{#each view.retainedDraft as field (field.label)}` became
`{#each view.retainedDraft as field, index (index)}`, with a comment saying why and that nothing in
TypeScript forces a unique key there (the mounted B1 suite is what fails if it is not). The rows are pure
display (`SourceText` and two markers, no local state), so position keying loses nothing.

Not touched: delivery (`workspace.svelte.ts`, `DetailPane.svelte`, the coordinator), the model
(`matchEditor.ts`'s rows keep repeating the label, which is their settled shape and what the copy uses),
`reapply.ts`, the backend. No Rust file changed.

**What the repair covers beyond the reproduction, because it is the same line:** the save-conflict
outcome panel draws the same `comparison()` snippet, so a save conflict over a draft with two or more
list-item rows threw the same way and no longer does. That arm is **not** pinned by a mounted case here
(§6 item 1).

## 4. What is not proved

- **No window reading.** This is jsdom evidence. It shows the DOM holds the panel after the handlers run;
  it does not show what WKWebView draws, nor that the window-reading probe's selector would now find it.
  The visible counterpart is 4-13's (ruling 29).
- That the production throw is *the* cause of every exploratory launch in `3-6-3-window-reading.md`
  L09–L20 is inferred from the matching shape and from the Svelte production code path, not observed in a
  window. L09–L11, L13–L16 combined a list item with a regex switch; those exact combinations are not
  replayed here (their list-item rows alone collide, which is sufficient for the throw).
- File-level removal (a `Removed` observation of the whole file) is out of this step's scope: by design no
  surface is told of it (`DetailPane.svelte`, `transitionOf`), and it was not what the window reading did.

## 5. Gate and rung

Output under `/private/tmp/4-2/`, each exit 0: `npm run check` (487 files, 0 errors, 0 warnings),
`npm test` (88 files, 4086 tests), `npm run build` (214 modules), `cargo clippy --workspace --all-targets
-- -D warnings`, `cargo fmt --check`. The bundle oracle: server-only markers absent, client-only markers
present. `cargo test` was not run: no Rust file changed. **Rung `1567 / 487 / 4086 / 214`** (was
`1567 / 487 / 4076 / 214`): ten new vitest cases (eight mounted, two model), no new module.

## 6. Open items (noticed, not fixed here)

1. **The save-conflict arm of the same comparison has no mounted list-item case.** It is repaired by the
   same line; a later phase may pin it (a `MatchEditorTriggers.test.ts` case with a scripted conflict
   answer over a two-item draft).
2. **No test scans for label-keyed `{#each}` over rows a model may repeat.** `MatchCreator.svelte:1001`
   keys its own `retainedDraft` by `field.label`; its model (`retainedDraftOf` in
   `src/lib/browser/matchCreation.ts`) emits unique labels today (`CREATION_FIELDS` then options), so it
   does not throw, but nothing forces that to stay true.
3. **A throwing flush is silent on screen.** An uncaught render error leaves a stale DOM with enabled
   controls and no sentence; B1 was invisible for that reason. Whether the app should install an error
   boundary or a global handler that says something is a design question for a later phase.
