# Phase 3-5-2-1 — Scalar content and options: the components and the i18n

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-5", its addenda of 2026-09-23 (3-5-1 / 3-5-2) and
2026-09-24 (3-5-2-1 / 3-5-2-2), §3 rulings 8, 9, 10, 18, 23, 24, 29, 30 and 31;
`docs/decisions/3-5-1-notes.md`, whose model values this phase draws.
**Risk:** high. **Components, i18n, mounted tests.** The window half is 3-5-2-2's.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 The small editor (`src/lib/components/MatchEditor.svelte`)

- **Sections, not a flat list.** The field loop walks `view.sections` (new, below): the trigger and
  the five content keys; the change of content kind directly under them; the label and the comment;
  then the four option groups, each a `role="group"` element labelled and headed by `tOptionGroup`.
  The per-field markup moved, unchanged apart from the additions below, into one `fieldBlock`
  snippet, so a field draws the same way under every heading.
- **Textual option groups.** Every option stays an `<input type="text">`; no checkbox exists anywhere.
  The *Insertion* group (`injection`, "Insertion method" / "Método de inserción") holds `force_mode`
  and `force_clipboard` as two boxes, each with its own label, with nothing relating one to the other.
- **Suggestions.** A field with suggestions (`uppercase_style`, `force_mode`) draws one button per
  exact string, labelled with the string itself in every language; pressing one calls
  `applySuggestion`. A non-empty value that matches none by `===` is kept and gets the sentence
  *"not one of the suggested spellings; kept exactly as written"*, never a verdict.
- **Content roles.** A dormant, switched-away or switch-target content key draws its role sentence
  (`tContentRoleNote`) *instead of* the *absent* sentence, whose *"typing in it adds the key"* is false
  for a dormant key (3-5-1 open item 3).
- **The change of content kind** (`contentKind` snippet): one *Change to: {kind}* button per
  `view.switchChoices` entry (the drafted target's disabled, since pressing it does nothing); the
  preview when a switch is drafted — the rename sentence, *text kept* or *text edited*, the kept
  companion keys drawn as the file spells them (or the *no companions* sentence), any removed
  companion keys, *confirmed* — and the *Confirm* / *Cancel* buttons. The save stays disabled until
  the confirmation (`canSave`, 3-5-1), and `view.saveWithheld` is drawn beside *Save* through
  `tSaveWithheld`, so a disabled save says why.
- **The cursor action** (ruling 18): drawn in the one block whose `field.cursorAction` is `true`
  (`replace`, while `cursorActionOffered`). It hands the text area's selection to
  `insertCursorPosition`, installs the answered session, and after a `tick` selects the answered
  range. The several-markers advisory is held with the session it was answered for and drawn through
  `tCursorAdvisory` with its count; any later transition hides it. Undo is the model's history step.
- The two header paragraphs the change invalidated were rewritten in place.

### 1.2 The model additions (`src/lib/browser/matchEditor.ts`)

Values a component needs so the component does not decide them:

- `EditableFieldModel` gains `unfamiliar`, `roleNote` (`ContentRoleNote`, from `contentRoleNoteOf`),
  `saysAbsent` and `cursorAction`.
- `OPTION_GROUPS` (the detail pane's four groups and names), `EditorSection`, and
  `MatchEditorView.sections` (built by `sectionsOf`; the switch section is included only when a switch
  is drafted or a target is offered).
- `MatchEditorView.switchChoices` (`SwitchChoice`: `to`, `label`, `drafted`).
- Key functions `contentRoleNoteKey` and `saveWithheldKey`, wrapped in `src/lib/i18n/index.ts` as
  `tContentRoleNote` and `tSaveWithheld` — the same arrangement as `tFieldRefusal` and
  `tCursorAdvisory`: the model names the key through a function whose return type is
  `TranslationKey`, so a code with no dictionary entry is a compile error, and no component builds a
  key. Static labels go through `t()` with a literal key, which `TranslationKey` type-checks.

### 1.3 Recovery (`src/lib/browser/recovery.ts`, `src/lib/components/RecoveryPanel.svelte`)

`RecoveryView.bodyLabel` (new) is the label of `bodyField`; the panel's body control was labelled
`tDetailField('replace')` even when 3-5-1 writes the body under `markdown`. A stale comment
(*"four of the six"*) now says fifteen of the seventeen.

### 1.4 The detail integration

Nothing changed in `DetailPane.svelte`: it mounts the editor, which draws everything above, and R36's
withheld move is already drawn through the existing `tMoveRefusal` path (3-5-1 §1.3).

## 2. The creation-form decision

**`MatchCreator.svelte` keeps authoring `trigger` + `replace` only; the new fields are left to 3-13.**
Ruling 23 lets no newly editable field ship without draft retention, conflict compare, reapply and a
recovery disposition in the same step, and the creator's drafted value (`CreationBuffers` in
`matchCreation.ts`) holds two strings: authoring a content kind or the options there is model and
reapply work, not component work, and it would overlap 3-13, which already touches
`MatchCreator.svelte` and the creation model to seed the seven textual defaults visibly. 3-13 should
take the creator's content kind and optional fields together with those defaults. No file changed
for this decision.

## 3. Deviations

- The task names `codes.ts` accessors. The new codes are **browser-model** codes, and this codebase
  renders those through a key function in the model plus a `t*` wrapper in `index.ts`
  (`tFieldRefusal`, `tCursorAdvisory`, `tMoveRefusal`); `codes.ts` holds the wire codes. The new
  accessors follow the established arrangement, with the same compile-time guarantee.
- `scripts/lint/composition-guards.test.ts` gained the inventory entry the new mounted suite needs.
- 3-5-1's open item 4 (`cannotCreate.replaceEmpty` naming replacement text): the sentence reads
  *"A snippet needs something to expand to."*, which names no content key, so nothing was changed.

## 4. Acceptance, criterion by criterion (mounted evidence, never a screen)

| Criterion | Evidence (`src/lib/components/MatchEditorScalar.test.ts` unless stated) |
|---|---|
| All 17 fields in the model's control; no checkbox | `draws every field in the model’s control, and no checkbox anywhere` |
| One *Insertion* group, two labelled textual controls | `draws the four option groups, with force_mode and force_clipboard as two labelled boxes under Insertion` (EN and ES); `puts every option in exactly one group…` (`scalarFields.test.ts`) |
| Exact-string suggestions; unfamiliar kept | `offers exact-string suggestions, keeps an unfamiliar value as written, and sends the text`; `calls a value unfamiliar only when…` (`scalarFields.test.ts`) |
| Switch preview drawn; save disabled until confirmed; undo | `draws the preview, withholds the save until confirmed, and undo takes the confirmation back` (also pins the sent `content_switch`); `says the text was edited, and cancelling…`; `offers no change of kind for a snippet holding two content keys` |
| Cursor action, `replace` only, undoable; advisory with count | `inserts one marker at the selection, selects it, and undo takes it back`; `selects the one marker already there…`; `draws the several-markers advisory with its count…` (EN and ES); `is drawn for replace only, and not once a switch renames replace away` |
| New sentences in EN and ES | `draws the role notes, the preview and the withheld save in the chosen language` (EN and ES); `has a sentence, in both languages, for both save-withheld codes and the three role notes` (`scalarFields.test.ts`); the existing key-parity and placeholder-parity suites |
| Recovery body label | `bodyLabel` assertions in two `recovery.test.ts` cases |

No textarea or input was added: the suggestions, the switch and the cursor action are buttons, and
the existing boxes keep the `\r` rule (a value holding one is refused at eligibility and drawn
through `SourceText`).

## 5. Gates and the rung

Every gate exited 0 on 2026-09-24: `cargo test --workspace -- --test-threads=1 >
/private/tmp/3-5-2-1-cargo.log 2>&1` (30 `test result` lines, 1419 passed, 0 failed, no `FAILED`);
`cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`; `npm run check` (463
files, 0 errors, 0 warnings); `npm test` (3615 passed, 74 files); `npm run build` (200 modules). The
server-only oracle found nothing; the client-only oracle found 2. `cargo tree -p espansoconfig-core |
rg tauri` printed nothing.

| | 3-5-1 | 3-5-2-1 | Why |
|---|---|---|---|
| Rust tests passed | 1419 | **1419** | no Rust change |
| svelte-check files | 462 | **463** | +1: the new `MatchEditorScalar.test.ts` |
| vitest tests | 3592 | **3615** | +14 in `MatchEditorScalar.test.ts`; +7 in `scalarFields.test.ts`; +2 generated for the new file by `composition-guards.test.ts` and `ipc-detail.test.ts` |
| Vite modules | 200 | **200** | no module added; a test file is not bundled |

## 6. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | ES sentence | Producer |
|---|---|---|
| `browser.matchEditor.cursor.insert` | Insertar la posición del cursor | `MatchEditor.svelte`, `t()`, where `field.cursorAction` |
| `browser.matchEditor.cursor.hint` | Tras expandir, espanso coloca el cursor donde está $\|$. Este control pone una marca donde está el cursor en la caja de arriba, o selecciona la marca si el texto ya tiene una. | the same |
| `browser.matchEditor.suggestions` | Valores sugeridos, tal como los escribe espanso: | `MatchEditor.svelte`, `t()`, where `field.suggestions` is non-empty |
| `browser.matchEditor.suggestions.unfamiliar` | Este valor no es una de las formas sugeridas. Se conserva exactamente como está escrito. | `MatchEditor.svelte`, `t()`, where `field.unfamiliar` |
| `browser.matchEditor.contentRole.dormant` | El fragmento ya tiene otro tipo de contenido, así que esta clave no se puede añadir aquí: un fragmento tiene uno solo. Para usar este tipo en su lugar, cambia el tipo de contenido más abajo. | `contentRoleNoteKey` (`matchEditor.ts`) via `tContentRoleNote` |
| `browser.matchEditor.contentRole.switchedAway` | El cambio de tipo de contenido de más abajo renombra esta clave, así que su texto está ahora en la caja del tipo nuevo. | the same |
| `browser.matchEditor.contentRole.switchTarget` | El cambio de tipo de contenido de más abajo renombra la clave antigua a esta. Esta caja contiene el texto que tendrá, trasladado tal como estaba y sin convertir. | the same |
| `browser.matchEditor.switch.heading` | Tipo de contenido | `MatchEditor.svelte`, `t()`, the `contentKind` snippet |
| `browser.matchEditor.switch.offer` | Cambiar el tipo de contenido renombra su clave en el archivo. El texto se traslada tal como está: no se convierte nada de él. | the same |
| `browser.matchEditor.switch.to` | Cambiar a: {kind} | the same, per `view.switchChoices` |
| `browser.matchEditor.switch.preview` | {from} pasará a ser {to}. La clave se renombra en el mismo lugar del archivo. | the same, from `view.contentSwitch` |
| `browser.matchEditor.switch.textKept` | El texto se conserva exactamente como lo escribe el archivo. | the same, `preview.textKept` |
| `browser.matchEditor.switch.textEdited` | El texto se ha editado desde entonces y se escribe tal como está ahora en la caja de arriba. No se convierte nada de él. | the same, `!preview.textKept` |
| `browser.matchEditor.switch.companionsKept` | El cambio de tipo de contenido no quita ninguna de estas claves que acompañan al contenido. Una edición que se haga en una de ellas se guarda tal como se haya hecho: *(revised by the review fix, §8)* | the same, `preview.companionsKept` |
| `browser.matchEditor.switch.noCompanions` | El fragmento no tiene ninguna de las claves que acompañan a su contenido (vars, form_fields, paragraph), así que no interviene ninguna otra clave. | the same, both companion lists empty |
| `browser.matchEditor.switch.companionsRemoved` | El borrador también quita estas claves, algo que un cambio de tipo de contenido nunca hace: | the same, `preview.companionsRemoved` |
| `browser.matchEditor.switch.confirm` | Confirmar este cambio de tipo de contenido | the same, `!preview.confirmed` |
| `browser.matchEditor.switch.confirmed` | Este cambio de tipo de contenido está confirmado. Deshacer retira la confirmación. | the same, `preview.confirmed` |
| `browser.matchEditor.switch.cancel` | Cancelar el cambio de tipo de contenido | the same |
| `browser.matchEditor.saveWithheld.contentSwitchUnconfirmed` | Este fragmento no se puede guardar hasta que se confirme el cambio de tipo de contenido de arriba. | `saveWithheldKey` (`matchEditor.ts`) via `tSaveWithheld` |
| `browser.matchEditor.saveWithheld.switchRemovesCompanion` | Este fragmento no se puede guardar: el borrador cambia el tipo de contenido y además quita una clave que acompaña al contenido, y un cambio de tipo de contenido nunca quita otra clave. Conserva esa clave o cancela el cambio de tipo de contenido. | the same |

Twenty-one keys, each in both dictionaries. No existing sentence was changed. No `code.` key was added.
(`browser.matchEditor.cursor.severalMarkers` is 3-5-1's and is drawn for the first time here.)

## 7. Open items (noticed, not fixed here)

1. **The creation form's content kind and optional fields go to 3-13** (§2).
2. **The window half is 3-5-2-2's**: EN and ES through the picker and one block-scalar content
   conflict (rulings 30, 31). Nothing in this record is a claim about a window.
3. `switchRemovesCompanion` is not reachable through the editor's own transitions (`removeField`
   refuses `paragraph` while a switch is drafted and `chooseContentSwitch` refuses over a drafted
   removal); its sentence is drawn when the model answers it and is pinned by the dictionary test, not
   by a mounted press.
4. The companion keys in the preview are drawn as the file spells them (`vars`, `form_fields`,
   `paragraph`), not as localized names; a later phase may prefer labels.
5. The dormant content keys still draw four empty read-only boxes on a snippet with one content key;
   the role sentence now explains them, and whether to draw them at all is a question for the window
   reading.
6. 3-5-1's open items 2, 5 and 6 (deletion's R36 arm, repairing a `Several` content shape,
   `form_fields` not migrated by a switch) are untouched.

## 8. Review fix

`docs/reviews/phase-3-5-2-1.md`: ship-with-fixes, 0 blockers, one SHOULD-FIX, fixed in the files it
named.

1. **The switch preview promised kept companions stay "unchanged"** (`src/lib/i18n/en.json`,
   `browser.matchEditor.switch.companionsKept`). With `paragraph: 'true'`, a confirmed
   `replace`→`markdown` followed by an edit of `paragraph` to `false` still showed *"stay in the
   snippet, unchanged"*, while `beginSave` sent `paragraph: { Set: 'false' }` beside the switch. The
   sentence now says only what is guaranteed, in both dictionaries: the change of content kind removes
   none of the listed keys, and an edit drafted to one of them is saved as drafted. No model value
   changed — `companionsKept` already means *kept*, not *unchanged*.
   - EN: *"The change of content kind removes none of these keys that go with the content. An edit
     drafted to one of them is saved as drafted:"*
   - ES: see the revised row in §6.

   Regression: `promises only that the switch removes no companion, and a drafted companion edit is
   sent (review fix, …)` in `MatchEditorScalar.test.ts`, run for EN and ES — the review's repro, the
   corrected sentence rendered in each language, and the sent draft carrying both the switch and the
   `paragraph` edit.

Rung after the fix: **1419 / 463 / 3617 / 200** (+2 vitest).
