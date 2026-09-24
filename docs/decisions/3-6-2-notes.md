# Phase 3-6-2 — Trigger forms and `search_terms`: the components and the i18n

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-6" and its addendum of 2026-09-24 (the 3-6-2
bullet); `docs/decisions/3-6-1-notes.md`, whose model values this phase draws.
**Risk:** high. **Components, i18n, mounted tests.** The window half is 3-6-3's.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 The small editor (`src/lib/components/MatchEditor.svelte`)

- **The trigger side is a section of its own** (`triggerSide` snippet), first, where the literal
  trigger's block used to be. It draws the presentation's sentence (`tTriggerPresentation`) and, for a
  `Several`, the raw-repair offer (`tTriggerRepair`); then **one control, the drafted form's**
  (`TriggerFormView.control`): the literal's own field block, the `regex` box, or the `triggers` list.
  A `Several` draws the literal's refused block, which already shows every held form, each named by
  its key, and picks none; an `Absent` draws no control until a form is added.
- **The choices of form**: one button per `TriggerFormChoice` — *Change to: {form}*, or *Add a trigger
  as: {form}* on a snippet with none (`triggerFormChoiceKey`). A refused choice is drawn disabled with
  its reason beside it, so `wouldDropAliases` says its count; the drafted choice is disabled.
- **A drafted change's preview**: the form in the file and the form after saving, a sentence
  introducing what is written (`triggerFormTextNoteKey`: the kept text, the text as it now stands, or
  the list's items in order), each text through `SourceText`, the *confirmed* sentence, *Confirm* and
  *Cancel*. The save is withheld until the confirmation through the existing `tSaveWithheld`. An
  addition on an `Absent` snippet owes no confirmation; its withdrawal is *Take back the added
  trigger* (`TriggerFormView.withdrawal`).
- **The `regex` box** (`regexBlock`): a one-line box with a hint that compiling is checked at save; a
  refused pattern (a carriage return, not decodable, …) through `SourceText` with `tFieldRefusal`.
  `RegexDoesNotCompile` is drawn by the existing refused-outcome arm (`tFindingCode`); the draft stays
  in the box, and no *Save anyway* is offered.
- **The list control** (`listBlock`, for `triggers` and `search_terms`): a style note for a block or
  flow list; the absent / empty / being-removed sentences; one one-line box per item with its number
  and its status marker (new, edited); *Take this item out* per item (disabled for the last one, with
  the sentence saying why); the items the draft takes out, through `SourceText`; *Add an item* at the
  end; *Add this list* / *Take this list out* for `search_terms`. **No reorder control.** A read-only
  list draws `ListModel.shown` through `SourceText` (a non-text item named by its shape) with
  `tListRefusal`, never boxes.
- `search_terms` is a section of its own under the label and the comment, as the detail pane groups
  them.

### 1.2 The model additions (values the components needed, so the components decide nothing)

- `matchLists.ts`: `ListBaseline.shown` and `ListShownItem` (what a read-only list shows);
  `listStyleNoteKey`, `listItemStatusKey`.
- `matchEditor.ts`: `ListModel.{shown, saysAbsent, removing, saysEmpty, lastItemKept}`;
  `TriggerFormView.{control, withdrawal}` with `TriggerControl` and `TriggerWithdrawal`;
  `triggerFormChoiceKey`, `triggerFormTextNoteKey`, `triggerWithdrawalKey`; `EditorSection` gains
  `triggerSide` (carrying the literal trigger's field model) and `searchTerms`, and `sectionsOf`
  places them; `EditableFieldModel.saysAbsent` is `false` for the literal trigger (see §3).
- `recovery.ts`: `RecoveryView.triggerLabel`.
- `src/lib/i18n/index.ts`: `tTriggerFormChoice`, `tTriggerFormTextNote`, `tTriggerWithdrawal`,
  `tListStyleNote`, `tListItemStatus` — the same key-function-plus-wrapper arrangement as 3-5-2-1, so
  a code with no entry is a compile error.

### 1.3 Recovery (`src/lib/components/RecoveryPanel.svelte`)

The trigger box is labelled by `form.triggerLabel`, so a carried pattern is *Regular expression* and
not *Trigger*; its `readonly` is `triggerEditable`. A carried `triggers` list is drawn as its items,
in order, through `SourceText`, with **no box** (the model refuses the box's input). `search_terms` is
drawn whole (items in order, or an explicitly empty list written `[]`) or with the reason nothing of it
is carried (`tTransferRefusal`).

### 1.4 The detail integration

Nothing changed in `DetailPane.svelte`: it mounts the editor and the recovery panel, which draw
everything above.

## 2. `\r` and D2u

Every new box is an `<input type="text">`, and each one is drawn only where the model's eligibility is
editable: a list or a pattern holding a carriage return (or a list item holding a line feed) is
refused at eligibility and drawn through `SourceText`. The transitions and `beginSave` refuse either
character (3-6-1). No checkbox was added; values are drawn as their source text.

## 3. Deviations

- **Tests changed rather than added.** Three `MatchEditor.test.ts` cases pinned the literal trigger's
  refused block showing a `regex:` or a `triggers:` list read-only; that block no longer draws for
  those forms, because the form's own control does. They now pin the `regex` box, the list's boxes in
  order, and a read-only list's captions (shape vs. text) inside the list control. The window reading's
  finding they protect (triggers visible on screen) still holds. `scalarFields.test.ts`'s sections case
  now expects `triggerSide` first and `searchTerms` after the label and the comment.
- **`saysAbsent` changed for the literal trigger**: when the file does not hold `trigger:`, its box is
  drawn only as a change's destination or an addition, where a blank box is withheld
  (`triggerFormEmpty`); *"leaving this box empty writes nothing"* would be false there.
- **The raw-repair offer is a sentence, not a button.** Opening the raw editor from inside the match
  editor would need a new route through `DetailPane.svelte` (close the editor, show the file text,
  open the raw editor); the sentence names the route. See open item 1.
- `scripts/lint/composition-guards.test.ts` gained the inventory entry the new mounted suite needs.

## 4. Acceptance (mounted evidence, never a screen)

| Criterion | Evidence |
|---|---|
| List controls: add / remove / edit, order kept, no reorder | `adds search_terms, items in order…` (EN, ES); `edits, removes and adds items of a block triggers list, and offers no reorder`; `keeps the last item, says why, and says a flow list stays in brackets` (`MatchEditorTriggers.test.ts`) |
| Trigger-form switch + confirmation | `previews a change to a list, withholds the save until confirmed, and sends the switch` (EN, ES; also undo); `renames trigger to regex keeping the text, and cancelling gives the literal back` |
| `wouldDropAliases { count }` | `refuses multiple→single for a longer list, by count, and never offers it` (EN, ES) |
| `Several` / `Absent` + raw repair | `shows every form of a Several, picks none, and offers the raw repair` (EN, ES); `adds a trigger to a snippet with none, and takes the addition back` (EN, ES) |
| Regex finding, draft kept | `is sent, refused by Rust’s finding, and the draft is kept` (EN, ES) |
| `\r` read-only via `SourceText` | `draws a list holding a carriage return through SourceText…`; `draws a pattern holding a carriage return through SourceText…` |
| RecoveryPanel label and carried list | `labels a carried pattern as a regular expression, in its box` (EN, ES); `draws a carried triggers list as its items…`; `carries search_terms whole, says an empty list is written []…` (`RecoveryPanel.test.ts`) |
| Model values | the two `Phase 3-6-2` describes at the end of `triggerLists.test.ts` |

## 5. Gates and the rung

Every gate exited 0 on 2026-09-24: `cargo test --workspace -- --test-threads=1 >
/private/tmp/3-6-2-cargo.log 2>&1` (read from the log); `cargo clippy --workspace --all-targets -- -D
warnings`; `cargo fmt --check`; `npm run check` (466 files, 0 errors, 0 warnings); `npm test` (3689
passed, 76 files); `npm run build` (201 modules). The server-only oracle found nothing; the
client-only oracle found 2. `cargo tree -p espansoconfig-core | rg tauri` printed nothing.

| | 3-6-1 | 3-6-2 | Why |
|---|---|---|---|
| Rust tests passed | 1430 | **1430** | no Rust change |
| svelte-check files | 465 | **466** | +1: `MatchEditorTriggers.test.ts` |
| vitest tests | 3658 | **3689** | +17 in `MatchEditorTriggers.test.ts`; +8 in `triggerLists.test.ts`; +4 in `RecoveryPanel.test.ts`; +2 generated for the new file |
| Vite modules | 201 | **201** | no module added |

## 6. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | ES sentence |
|---|---|
| `browser.matchEditor.list.style.block` | Escrita con un elemento por línea. Al guardar se mantiene así. |
| `browser.matchEditor.list.style.flow` | Escrita entre corchetes en una sola línea. Al guardar se mantiene así. |
| `browser.matchEditor.list.absent` | El archivo no contiene esta lista. |
| `browser.matchEditor.list.empty` | Esta lista no contiene ningún elemento. |
| `browser.matchEditor.list.removing` | Esta lista se quitará del archivo al guardar. |
| `browser.matchEditor.list.removedItems` | Estos elementos se quitarán de la lista al guardar: |
| `browser.matchEditor.list.lastItemKept` | El único elemento que queda no se puede quitar por sí solo: una lista conserva al menos un elemento. |
| `browser.matchEditor.list.item` | Elemento {number} |
| `browser.matchEditor.list.item.added` | Elemento nuevo |
| `browser.matchEditor.list.item.edited` | Editado |
| `browser.matchEditor.list.addItem` | Añadir un elemento |
| `browser.matchEditor.list.removeItem` | Quitar este elemento |
| `browser.matchEditor.list.add` | Añadir esta lista |
| `browser.matchEditor.list.remove` | Quitar esta lista |
| `browser.matchEditor.triggerForm.heading` | Forma de disparador |
| `browser.matchEditor.triggerForm.offer` | Un fragmento se activa con un disparador literal, con una expresión regular o con una lista de disparadores. Al cambiar de forma, el texto se traslada tal como está: no se convierte nada de él. |
| `browser.matchEditor.triggerForm.to` | Cambiar a: {form} |
| `browser.matchEditor.triggerForm.add` | Añadir un disparador como: {form} |
| `browser.matchEditor.triggerForm.previewFrom` | Forma de disparador en el archivo: {form} |
| `browser.matchEditor.triggerForm.previewTo` | Forma de disparador tras guardar: {form} |
| `browser.matchEditor.triggerForm.textKept` | El texto se conserva exactamente como lo escribe el archivo: |
| `browser.matchEditor.triggerForm.textEdited` | El texto se escribe tal como está ahora, sin convertir nada de él: |
| `browser.matchEditor.triggerForm.listHolds` | La lista contendrá estos disparadores, en este orden: |
| `browser.matchEditor.triggerForm.confirm` | Confirmar este cambio de forma de disparador |
| `browser.matchEditor.triggerForm.confirmed` | Este cambio de forma de disparador está confirmado. Deshacer retira la confirmación. |
| `browser.matchEditor.triggerForm.cancel` | Cancelar el cambio de forma de disparador |
| `browser.matchEditor.triggerForm.cancelAddition` | Retirar el disparador añadido |
| `browser.matchEditor.regex.hint` | Si este patrón compila se comprueba al guardar, no mientras escribes. |
| `browser.recovery.triggerItems` | El fragmento nuevo se activa con esta lista de disparadores, trasladada entera y en orden: |
| `browser.recovery.searchTerms.carried` | Se traslada entera, en orden: |
| `browser.recovery.searchTerms.empty` | Se traslada como una lista vacía, escrita como []. |

Thirty-one keys, each in both dictionaries. Labels (`{form}`) are drawn only after a colon, so no
capitalised label lands mid-sentence. No existing sentence was changed; no `code.` key was added.
3-6-1's sentences (`triggerForm.several`, `.absent`, `.repair.rawDocument`, `.refused.*`, the six
`saveWithheld` codes, `list.readOnly.*`) are drawn for the first time here.

## 7. Open items (noticed, not fixed here)

1. **No one-click route to the raw editor from a `Several`.** The repair is a sentence; a button would
   need `DetailPane.svelte` to close the match editor and open the file text's raw editor.
2. Items are added only at the end of a list; the model can place one anywhere (`addListItem`'s
   position), and a per-item *Insert above* is a later choice.
3. A read-only list whose key holds something that is not a list (`unsupportedShape`) shows only its
   refusal: the projection carries no items for it, and its bytes are not on `ListBaseline.shown`.
4. The literal trigger keeps a disabled *Take this key out* control with no reason beside it
   (`canRemove` is `false` for it since 3-6-1, ruling 6).
5. The window half — EN and ES through the picker, including the commented multi-line flow list at
   `flow-collections.yml:16-22` — is 3-6-3's. Nothing here is a claim about a window.
6. 3-6-1's open items 2–8 are untouched.

## 8. Review fixes

`docs/reviews/phase-3-6-2.md` (Codex, ship-with-fixes): two SHOULD-FIX items, both fixed in the files
they named.

1. **A removed list kept writable item boxes that discarded edits** (`MatchEditor.svelte`). After
   *Take this list out*, the items stayed as `<input>`s the model refused (`editListItem` needs a
   present list), so typed text stayed on screen and was never drafted. `ListModel.itemsEditable`
   (new, `matchEditor.ts`: editable **and** present) now drives the boxes' `readonly`, and a list the
   draft takes out draws its items through `SourceText`, with no box. Regressions: `review fix: a list
   the draft takes out` (`MatchEditorTriggers.test.ts` — remove, no boxes, add back, edit another
   field, save: nothing about `search_terms` is sent) and the `itemsEditable` assertions in
   `triggerLists.test.ts`.
2. **The transfer table asked for a literal trigger when `regex` or `triggers` was carried**
   (`RecoveryPanel.svelte`, decided in `recovery.ts`). `transferStatusOf` now answers a fifth status,
   `carriedInAnotherForm`, for a literal left out with `triggerFormCarried`, instead of `needsAValue`.
   New key `browser.recovery.transfer.carriedInAnotherForm` — EN *"carried over in another trigger
   form, shown below, so no literal trigger is written"*; ES *"se traslada en otra forma de
   disparador, que se muestra abajo, así que no se escribe ningún disparador literal"* — through the
   existing `transferStatusKey` / `tTransferStatus`. Regressions: `never asks for a literal trigger
   when a regex / a triggers list is carried (review fix)` (`RecoveryPanel.test.ts`).

Rung after the fixes: **1430 / 466 / 3692 / 201** (+3 vitest; no Rust change, no new file or module).
