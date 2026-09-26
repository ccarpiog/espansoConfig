# Phase 4-12 — Visual form builder

**Status:** implementation record for step 4-12 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 8, 15–21, 23, 24, 29 and 31 of §3, plus the three items [`4-10-notes.md`](4-10-notes.md) §6 handed
to this step (`values` items, option removal, removal of every definition). The second **visible editing
surface** of Phase 4: one new component drawn beside the variables group inside the match editor, over
one new browser module and an extended form model. **No Rust source and no wire type changed**; one Rust
test was added. The step was **not cut**. **Window half owed to 4-13: no window reading was performed or
claimed** — every acceptance clause below is mounted evidence (ruling 29).

---

## 1. What changed and why

### 1.1 The form model: `src/lib/browser/formEditor.ts`

The three operations 4-10 §6 item 1 and item 4 handed on, all over wire shapes the core has accepted since
4-6 (`EntryDraft` `Remove` and `items`, `FormValuesIntent`, `FormFieldIntent::RemoveFields`):

- **`values`, in the representation the file uses** (ruling 18). `DefinitionBaseline.values`
  (`ValuesBaseline`: `absent` / `list` with one `FormScalarBaseline` per item and its flow flag / `text` /
  `unsupported`) and `DefinitionBuffer.values` (`ValuesBuffer`: one box and removal flag per existing item
  plus the new items appended at the end, or the one text box). `valuesDraftOf` derives a list's rewrites
  as an `EntryDraft` over the `values` option with `items` (`value: 'Unchanged'`), its removals as
  `RemoveItem`, its additions as one `InsertItems` at `End`; a text as a `Set` of the whole text. Nothing
  converts one representation into the other.
- **Option removal.** `DefinitionBuffer.removedOptions` (positions); a removed option is sent as
  `EntryDraft { value: 'Remove' }` and nothing else is said about it. `optionRemovable` mirrors Rust's rule
  (a block option mapping, a decoded key, a scalar or flat scalar-list value).
- **Removal of every definition.** `FormBuffer.removeAll`, sent as the form's only intent
  (`RemoveFields`), beside a verbose layout's `params` entry if drafted; `removeAllRefusal` withholds it
  while the draft adds a definition (Rust refuses the two together) or when the definitions are absent or
  not a mapping. A new `FormAdditionRefusal` `definitionsRemoved` refuses *Add field* while it is drafted.
- New pure transitions: `withOptionRemoval`, `withValuesItemText`, `withValuesItemRemoval`,
  `withValuesItemsAdded` (with `valuesOfLines`, the Choice insertion's one-value-per-line rule, and
  `ValuesAdditionProblem`), `withValuesAddedDiscarded`, `withValuesText`, `withAllDefinitionsRemoved`;
  `definitionIsEdited` for a row's marker. `withOptionText` and `withDefinitionRemoval` now refuse under a
  drafted container removal (and an option drafted for removal).
- **The send gate** (`formsWriteUnreadable`) now reads a `values` item rewrite and every new item as
  one-line text and a `values` text as multi-line text.
- **Retention** (`formRowsRetained`, `valuesRetainedRows`): an option removal is a `formOption` row with
  `removing`; `values` changes are an `optionName` row then `setting` / `itemRemoved` / `itemAdded` rows (or
  the text as `optionValue`); a container removal is one `formFields` row with `removing`. Existing
  statuses only.
- The module header and `FORM_OPTION_KEYS`' comment were rewritten to the present state.

### 1.2 `src/lib/browser/matchEditor.ts`

Session transitions at the forms composition point: `removeFormOption` / `restoreFormOption`,
`editFormValuesItem`, `removeFormValuesItem` / `restoreFormValuesItem`, `addFormValuesItems` (with
`FormValuesOutcome`), `discardFormValuesItem`, `editFormValuesText`, `removeFormFields` /
`restoreFormFields`. Every removal and addition is structural (its own history step) and spends a
`VariableStructureGrant` (R36, ruling 23); restorations, discards and typing need none. `TypingSubject`
gained `forms#n.d.values` and `forms#n.d.values#i`.

### 1.3 `src/lib/browser/formBuilder.ts` (new module)

The builder's decisions as values, drawn by `FormBuilder.svelte`:

- **Selection** (`FormBuilderSelection`, `FormRowKey`, `SeededFormSelection`, `seededFormSelection`,
  `formSelectionOfSeed`): a row, a form's *Add field* panel, or the Form insertion, bound to the
  `FormsBaseline` object it was made over — the 4-11 review's second finding, carried: a replaced baseline
  clears it.
- **The view** (`formBuilderViewOf`): per form its shape, variable name, layout (`contentField` for
  shorthand, a `box` or `readOnly` with its reason for verbose), the drafted layout's pieces, the derived
  rows (status marker, the drafted `type` text drawn raw, advisory), the container removal's state and
  refusal, and — **only for the selected row** — its controls: the four option boxes (with
  `FORM_OPTION_SUGGESTIONS`, exact strings), the `values` view, every other option (`OtherOptionView`,
  its scalar text or items for `SourceText`, or its shape), and the removal preview.
- **New definitions** (`FieldDraft`, `NewFieldKind`, `newFieldOf`, `fieldAdditionViewOf`, `addField`):
  *Add field* with a Text, Choice or List definition — a choice or a list opens its values at once — and
  the same panel defining a placeholder the layout already holds (selection `null`: the definition alone).
- **The Form insertion** (`FormInsertionDraft`, `InsertedFieldDraft`, `insertedFieldsOf`,
  `withInsertedField`, `formVariableOf`, `formInsertionViewOf`, `insertForm`, `FormInsertionProblem`): a
  provisional name (`form`, `form2`, …), a layout, per placeholder `none` / Choice / List and whether it is
  referenced, and the content key; *Insert* is one history step and one save through 4-9's
  `insertVariable`.
- Key functions: `rowStatusKey`, `removeAllRefusalKey`, `valuesProblemKey`, `formInsertionProblemKey`,
  `layoutMalformationKey`, `newFieldKindKey`.

### 1.4 `src/lib/browser/variableInsertion.ts`

`insertVariable`'s request gained optional `subReferences`: for a form, one `{{name.field}}` per field
named, separated by one space, in place of `{{name}}` — the consult's "selected `{{name.field}}`
references, not an unexplained `{{name}}` aggregate" (`phase-4-design.md:202`). Built from the
description's own name, as before.

### 1.5 Components

- **`src/lib/components/FormBuilder.svelte`** (new): heading; per form its heading, the layout (the
  sentence that the shorthand layout is the *Form layout* box above; a verbose layout box
  `textarea[data-form-layout]`; or `SourceText` with the reason), the synchronized display (a `pre` of the
  drafted layout with each supported placeholder in a `mark`, each malformed region named below it; not
  drawn over a layout holding a `\r`), the rows (`button.rowButton`, `aria-pressed`, occurrence count,
  raw `type`, status marker, advisory), *Add a field* and *Take out all the fields* / *Keep the fields*;
  the selected row's panel (option boxes — `input type="text"` or a text area for `default`, never a
  checkbox — suggestions, *Take this option out*, the `values` list item by item with *Add these values*,
  or the `values` text, every other option through `SourceText`, the removal preview); and *Insert a form*
  with its panel. Every press mints its grant (and the insertion its name context) from a read taken at
  the press (R37).
- **`MatchEditor.svelte`**: mounts `FormBuilder` inside the `variables` section, directly after
  `VariableGroup`; `selectionOf` also answers the shorthand layout's `form` box (for *Add field*'s caret).
  The header sentence names the builder.

### 1.6 i18n

**81 keys per language**, all frontend (no Rust code enum): 80 under `browser.formBuilder.*` and
`browser.formEditor.addition.definitionsRemoved`. Reactive wrappers in `src/lib/i18n/index.ts`:
`tFormRowStatus`, `tRemoveAllRefusal`, `tValuesProblem`, `tFormInsertionProblem` (a values problem names
its field as `{name}`), `tLayoutMalformation`, `tNewFieldKind`; the rest are drawn with `t(…)` on static
keys or through existing accessors (`tFormFieldRefusal`, `tFormAdditionRefusal`, `tFormRowAdvisory`,
`tNameVerdict`, `tInsertRefusal`, `tVariableMoveRefusal`, `tVariableAdditionRefusal`, `tValueKind`,
`tDetailField`). Counts avoid plurals ("Placeholders in the layout: {count}"), as the dictionaries do.
Every new key is used (checked by script).

### 1.7 Rust: one test

`the_form_builders_wire_drafts_apply_and_change_only_what_they_name` in
`crates/espansoconfig-core/tests/form_definitions.rs` deserializes the wire shapes the mounted builder
sends and applies them over one neutral fixture: a `values` item rewritten, one removed and two appended
(whole-file equality); an unknown option removed beside a multi-line `values` rewritten as one text (the
text decodes back exactly); `RemoveFields` (whole-file equality, the layout kept); and the Form insertion
(the `{{form.a}} {{form.b}}` body and a new verbose form with its Choice definition). Nothing ties its
literals to the TypeScript ones but this copy.

### 1.8 Tests

- `src/lib/browser/formBuilder.test.ts` (26 cases, node): option removal, `values` item by item and as a
  text, removal of every definition in both shapes, the view, D2u, the selection seed, *Add field* with a
  Choice/List definition, the Form insertion and its problems, retention, reapply and collision, recovery,
  and every new code in both languages.
- `src/lib/components/MatchEditorForms.test.ts` (18 cases, jsdom, invoke-zero guard; inventoried in
  `scripts/lint/composition-guards.test.ts`): one `describe` per acceptance clause.

## 2. How each acceptance clause is met — mounted evidence, recorded as mounted

`MEF` = `src/lib/components/MatchEditorForms.test.ts`; `FB` = `src/lib/browser/formBuilder.test.ts`. None of
this is a window reading; the visible counterpart of every row is owed to 4-13.

| Clause | Evidence (mounted unless marked model) |
|---|---|
| Both shapes | MEF 1: the shorthand form under the *Form layout* box — no second layout box in the builder, rows `pick, lines, q, solo`, the display's three `mark`s, zero inputs before a selection; a verbose form with its own `textarea[data-form-layout="0"]`, drawn in Spanish. Model: FB *draws the rows the layout derives …*, *draws a verbose form with its own layout box …* |
| Layout-only edits | MEF 2: typing in the `form` box re-derives the rows (a new placeholder with its count and *no definition*, a now definition-only row with its advisory) and the save sends `form: Set`, `form_fields: []`, `form_intents: []`; a verbose layout edit sends only `vars[0].params` with empty `fields` and `field_intents` |
| Explicit compound additions | MEF 3: *Add a field* with a Choice and values puts `[[z]]` at the caret and the definition into one draft — one *Undo* takes back both, *Redo* and one save send `form: Set` + one `InsertField` (type `choice`, `values` list); defining the placeholder `q` as a List sends the definition alone (`form: 'Unchanged'`); *Insert a form* writes `Hello {{form.a}} {{form.b}}` and one `InsertVariable` of a `Form` with its Choice definition, one save; a shorthand-form snippet is refused `noTarget`. Model: FB *Add field …*, *the Form insertion …* |
| Definition-only rows | MEF 4: `solo` drawn with the *no placeholder* advisory, its controls on selection, the removal preview (`0` kept), an explicit removal that keeps the row reachable and sends `RemoveField { index: 2 }` |
| Unknown source visible through `SourceText` | MEF 5: `pick`'s `hint` option drawn through `SourceText` with its *not edited here* marker and no box, removable (`Remove` by position); a verbose layout holding `\r\n` drawn through `SourceText` with the carriage-return sentence, no box and no display |
| `multiline`, defaults and trimming as textual controls | MEF 6: no checkbox in the builder; `multiline` an `input type="text"` holding `true`, `default` a text area, an absent `trim_string_values` an empty box with its sentence; typed `no`, a two-line default and the suggestion `false` are sent exactly (`Set` by position, `insert_options.trim_string_values: 'false'`) |
| (Choice/List controls, delivered) | MEF 7: a `values` item edited, one removed, two added (`items` rewrite, `RemoveItem`, `InsertItems` at `End`); a `values` text edited as one text beside a `type` removal; *Take out all the fields* sends `RemoveFields` alone, `form` unchanged |
| Conflict compare | MEF 8: a `values` edit under a save conflict — the retained panel holds the *Form field* `pick` row and the *Form option* row `A`; every builder box read-only, *Add a field* disabled. Model: FB *retains option removals, values items and a container removal, row by row*, *reapplies … and collides a changed one* |
| The recovery refusal | MEF 9: after a Form insertion, a save conflict and *Keep my draft*, the `variablesNotCarried` sentence is drawn, one save only; and the insertion's name verdict under a closed scope says *available*. Model: FB *is refused for recreate-as-new after a conflict (ruling 21)* |

## 3. Decisions

1. **Not cut.** Every clause, the three handed-on operations and the Form insertion fit one coherent
   builder over existing core operations.
2. **Accessor naming follows 4-9/4-10/4-11** (`*Key` functions in the model, `t*` wrappers in
   `index.ts`), not a `describeFormEdit` family in `codes.ts`: `codes.ts` bridges Rust code enums, and none
   of this step's codes is Rust's. Ruling 31 names the families as planning, not as an acceptance.
3. **The builder is mounted inside the existing `variables` section**, after `VariableGroup`, rather than
   as a new `EditorSection`: the section list and `sectionKey` stay unchanged. It is drawn for every
   snippet, because it carries *Insert a form* (a snippet with no form shows the heading, one sentence and
   that button).
4. **No second box for a shorthand layout** (ruling 17, the step's own 4-10 sentence): the builder draws a
   display of the `form` box's drafted text, and *Add field* writes through that box at its caret
   (`selectionOf('form')`).
5. **A new definition's `type` is written as the kind's name** (`text`, `choice`, `list`), a logical
   string; a Choice or List definition's values are always a list (one per line in the panel), never a
   text. A text `values` is edited only where the file already writes one.
6. **The Form insertion inserts `{{name.field}}` for the referenced fields, separated by one space**, every
   placeholder referenced by default (a toggle per field); the separator is this application's choice. A
   placeholder left `none` gets no definition — what espanso makes of an undefined field is not
   established here (R16). A snippet whose content is a shorthand `form` is refused `noTarget`: there,
   fields are authored by *Add a field* (the consult's "in a shorthand layout, Form opens field
   authoring").
7. **Removal rules are Rust's, pre-checked**: the last option (`FormFieldWouldHaveNoOptions`) and the last
   kept `values` item (`FormValuesWouldBeEmpty`, whatever is added beside it) are refused by the
   transition; container removal is withheld while a definition is added and vice versa. Anything else
   Rust refuses (for instance a combination landing two edits at one byte) comes back as the save's draft
   refusal; the model does not pre-check every combination (§5 item 6).
8. **New `values` items are appended at the end only**; no mid-list insertion and no reorder.
9. **Options this editor does not draft are shown and only removable** (ruling 19): no box, no raw route
   of their own (the whole-document and snippet raw editors remain the route).
10. **D2u**: a row draws the drafted `type` text exactly as its box holds it; suggestions are exact strings;
    nothing is a checkbox. No quoted-spelling line is drawn for form options (`FormScalarBaseline` carries
    no style; §5 item 3).
11. **Component state is not drafted**: the selection (bound to the forms baseline), the open panel's
    contents and the new-values text live in the component and are lost on close or re-seed; nothing is in
    the draft until a press, which is one history step.

## 4. Lifecycle dispositions of every new value

| Value | Save | Discard (undo, reload, close) | Reapply / conflict | Recovery | Reparse |
|---|---|---|---|---|---|
| `DefinitionBaseline.values` (`ValuesBaseline`) | Not sent | Not drafted | Replaced with the new projection | Read with the baseline | Reseeded by `startMatchEditor` |
| `DefinitionBuffer.removedOptions` | `EntryDraft { Remove }` by position, via `formsDerivationOf` | One `Draft` history; a reload installs a fresh buffer | Carried only for a form whose container verified unchanged (4-10's rule), else collision; retained as `removing` rows | Snippet holds `form_fields`/`vars`: refused (4-9) | Fresh |
| `DefinitionBuffer.values` (`ValuesBuffer`) | `items` rewrites, `RemoveItem`, one `InsertItems` at `End`, or a text `Set`; `\r`/line feed refused at send | As above | As above; retained as `setting` / `itemRemoved` / `itemAdded` / `optionValue` rows | As above | Fresh |
| `FormBuffer.removeAll` | `RemoveFields` alone | As above | As above; one `formFields` `removing` row | As above | Fresh |
| New `TypingSubject`s (`values`, `values#i`) | — | Typing runs end at a structural action | — | — | — |
| `FormAdditionRefusal` `definitionsRemoved`, `RemoveAllRefusal`, `ValuesAdditionProblem`, `FormValuesOutcome` | Derived on a press, never stored | — | — | — | — |
| Builder view values (`FormBuilderView`, rows, selected controls) | Derived on read | Follow the draft | Drawn read-only under a conflict | — | Recomputed |
| `SeededFormSelection` (component) | Not sent | Cleared when the forms baseline is replaced | Cleared by a reapply's new baseline | — | Cleared |
| `FieldDraft`, `FormInsertionDraft`, new-values text (component) | Not sent until a press | Lost on close or re-seed | Not retained (not drafted) | — | Lost |
| The Form insertion (a 4-9 added variable plus the content key's text) | `InsertVariable` + the key's `Set`, one save | One undo takes both | 4-9's: a form with definitions has no intended-params comparison, so a reapply collides `vars` | Refused (`variablesNotCarried`) | — |

## 5. Open items noticed, not fixed

1. **No `values` insertion where a definition has none** (the core's `insert_options.values` exists), and
   no new `values` text.
2. **No mid-list insertion or reorder of `values` items**; an extra option's value cannot be edited, only
   removed.
3. **No quoted-spelling line (D2u style) for form options**: `FormScalarBaseline` carries no `style`.
4. **A form inserted by this draft cannot be edited in the builder until saved and re-projected** (it is a
   drafted variable, not a baseline form) — the analogue of 4-10 §6 item 5.
5. **The builder is drawn for every snippet** (heading, one sentence, *Insert a form*), which bears on D15
   (four empty dormant content boxes) — a layout judgement the owner holds, presented in 4-13.
6. **Not every combination Rust refuses is pre-checked** (decision 7): such a draft is refused at save
   with Rust's code, the draft kept.
7. **`formBuilder.ts` reuses `choiceTargetsOf` from `variableGroup.ts`**, a dependency between two browser
   modules; and `MatchEditorForms.test.ts` copies `MatchEditorVariables.test.ts`'s mount harness (about
   300 lines) rather than sharing it.
8. The 81 new keys per language join the Phase 4 translation inventory (4-24); none has been read on a
   window.
9. Git was not run in this step.

## 6. Failing-first evidence, by mutation

Git was not used. `/private/tmp/4-12/mutate.py` applied each mutation, ran the clause's tests and restored
the file byte for byte (SHA-256 asserted); outputs `/private/tmp/4-12/mutation-M*.txt`, summary
`mutation-summary.txt`. Every mutation failed at least one test on an assertion (no `TypeError`,
`ReferenceError` or `SyntaxError` in any output). **M0 is the unchanged tree's behaviour** (no builder is
drawn).

| Mutation | Clause | What it breaks | Failing cases |
|---|---|---|---|
| M0 | all | the editor draws no form builder — the unchanged tree | 18 of 18 |
| M1 | layout-only edits | rows derived from the file's layout, not the drafted one | 2 |
| M2 | compound additions | *Add field* adds the definition without its placeholder | 1 |
| M3 | Form insertion | the aggregate `{{name}}` written | 2 |
| M4 | definition-only rows | rows with no occurrence not drawn | 7 |
| M5 | unknown source | an option this editor does not draft hidden | 2 |
| M6 | textual controls | `multiline` drawn as a checkbox | 1 |
| M7 | Choice/List | a removed `values` item not sent | 3 |
| M8 | option removal | an option removal not sent | 4 |
| M9 | remove-all | removing every field sends nothing | 4 |
| M10 | conflict compare | a conflict retains no `values` rows | 2 |
| M11 | recovery refusal | recovery recreates a snippet whose draft inserts a form | 2 |
| M12 | selection | a selection survives a replaced baseline | 1 |
| M13 | `\r` at send | the send gate does not read new `values` items | 1 |
| M14 | removal rules | the last kept `values` item can be removed | 1 |

## 7. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-12/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`: 1735 passed, 0 failed), `cargo clippy --workspace --all-targets -- -D warnings`
(`clippy.txt`), `cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`: 501 files, 0
errors, 0 warnings), `npm test` (`npm-test.txt`: 95 files, 4297 tests), `npm run build` (`npm-build.txt`:
223 modules); bundle oracle — server-only markers absent (`oracle-server.txt` empty), client-only present
(2); `cargo tree -p espansoconfig-core` holds no `tauri` (`cargo-tree.txt`).

Rung **`1735 / 501 / 4297 / 223`** (was `1734 / 497 / 4245 / 220`): +1 Rust test (§1.7); +4
`svelte-check` files (`formBuilder.ts`, `FormBuilder.svelte`, `formBuilder.test.ts`,
`MatchEditorForms.test.ts`); +52 vitest tests — 44 new cases (26 `formBuilder.test.ts`, 18
`MatchEditorForms.test.ts`) and 8 per-file inventory cases the lint suites generate for the new files (4
`scripts/lint/ipc-detail.test.ts`, 2 `composition-guards.test.ts`, 1 `built-translation-keys.test.ts`, 1
`hardcoded-strings.test.ts`), traced with vitest's JSON reporter (`vitest.json`); **+3 Vite modules**:
`formBuilder.ts` (one, a new `.ts` module) and `FormBuilder.svelte` (two, a styled component).

## 8. Review fixes

The adversarial review (`docs/reviews/4-12.md`, Codex) returned two should-fix findings and no blocker.
Each was fixed in the file it named and pinned by regressions; nothing else was changed. Git was not
used: the pre-fix files were copied to `/private/tmp/4-12/fix/{formBuilder.ts,FormBuilder.svelte}.orig`.
Failing first on the unfixed tree: `/private/tmp/4-12/fix/failfirst-unfixed-tree.txt` (4 of the new cases
fail on their intended assertions); after the fix `after-fix.txt` (48 of 48).

1. **SHOULD-FIX — a known option its box cannot hold was hidden** (`src/lib/browser/formBuilder.ts`). The
   `SourceText` fallback skipped every recognised key, so `default: [hidden-default]` drew an empty,
   read-only `default` box and its content nowhere. `isDraftedOption` (by key) became `isRepresented` (by
   content): an option leaves the fallback only when a control shows it — the box's own occurrence of one
   of the four keys with a shape it holds, or the `values` text or a list of scalars. A known option with a
   collection, a repeated key, and an unsupported `values` are drawn through `SourceText` beside the box's
   refusal, and stay removable. Regressions: FB *shows a known option its box cannot hold, and a repeated
   one, as unknown source*; MEF 10 *draws a known option its box cannot hold, and a repeated one, through
   SourceText*.
2. **SHOULD-FIX — a `values` text offered no removal** (`src/lib/components/FormBuilder.svelte`). The text
   branch drew editing and restoration only, though the model answered `canRemove`. It now draws *Take this
   option out* when `values.canRemove` holds, through `removeFormOption` with a grant minted at the press.
   Regressions: MEF 10 *offers the removal of a values text* in the shorthand and the verbose shape, each
   sending `Remove` by position.

**Gates after the fixes**, all exit 0, outputs under `/private/tmp/4-12/fix/`: `cargo-test.txt`,
`clippy.txt`, `fmt-check.txt`, `npm-check.txt`, `npm-test.txt`, `npm-build.txt`, `oracle-server.txt`
(empty), `oracle-client.txt`, `cargo-tree.txt` (no tauri). **Rung `1735 / 501 / 4301 / 223`** (was
`1735 / 501 / 4297 / 223`): +4 vitest tests (1 in `formBuilder.test.ts`, 3 in `MatchEditorForms.test.ts`);
no new file or module.
