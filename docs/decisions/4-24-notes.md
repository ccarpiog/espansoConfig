# Phase 4-24 — inventory, reconciliation and closure record

**Spec:** [`4-split-notes.md`](4-split-notes.md) §2 *4-24*, with §4.5 (this step does not touch
`PROGRESS.md`), §4.6 (what closes Phase 4) and §7 (the open-items map, E1 … E6);
[`phase-4-design.md`](../reviews/phase-4-design.md) rows E1 … E6 (`:406-408`). Its shape is
[`3-closure-notes.md`](3-closure-notes.md)'s.
**Risk:** routine. **Records only**, plus one in-repository script (E4). No source, test, configuration
or dictionary file changed. What changed:

- `docs/decisions/4-24-notes.md` — this record (new);
- `scripts/i18n-inventory.mjs` — the reproducible inventory procedure (new; §3.1);
- `docs/decisions/3-11-2-notes.md` §1.5 — one sentence corrected, dated (E1, §4.1).

**`PROGRESS.md`, `PROGRESS.json`, `IMPLEMENTATION_PLAN.md` and `CLAUDE.md` were not edited** (§4.5). No
window reading was performed or claimed, no app was launched, no instrument was built and no real-config
file was opened. Every figure below was read on 2026-09-27 against `main` at `b436c7d`.

**Phase 4 is NOT closed by this record.** Four window halves are owed (§2); §4.6 closes Phase 4 only when
none is. This record closes step 4-24 and nothing else.

---

## 1. What this step is, and what it is not

- **It is the reconciliation §2 *4-24* names:** the Phase 4 translation-review inventory from an
  in-repository procedure (§3), the corrected carried records (§4), gate and module accounting from runs
  (§8), the window halves with each one's state (§2) and a disposition for every carried item of
  `4-split-notes.md` §7 (§6).
- **It may run with window halves owed and lists them as owed** (§2 *4-24*: "It may run with window
  halves owed and lists them as owed; it closes Phase 4 **only** if none is owed"). So no owner ruling was
  needed to run it, and none was sought.
- **It is not the final Phase 4 closure.** When the four halves have been read, a later records step closes
  the phase, re-runs `scripts/i18n-inventory.mjs --phase 4` for any key the halves add (B5's fix at 4-13
  may add none or some; §4.7), and consolidates the per-step open items (§5 item 5).
- **Every Phase 4 implementation step is closed:** 4-1 … 4-12, 4-14 (as 4-14-1 and 4-14-2), 4-15, 4-17,
  4-18, 4-19 (as 4-19-1 and 4-19-2), 4-21 and 4-22 (`git log --oneline a1bc4d2..HEAD`, one *closed*
  commit each; `PROGRESS.md` status table). Only the four window halves and this step remained.

## 2. The window halves, state at `b436c7d`

Ruling 29 names four halves. None has been started: no `4-13`, `4-16`, `4-20` or `4-23` notes file,
window reading, review or commit exists (`ls docs/decisions/ docs/reviews/`, `git log --oneline`), and
every step that owes one records *"No window reading was performed or claimed"* or its equivalent.

| Half | Owed by (closed steps) | What it owes (per `4-split-notes.md` §2) | State |
|---|---|---|---|
| **4-13** — early authoring | 4-11, 4-12; 4-2 (B1's visible counterpart); 4-1 (A1's optional visible confirmation) | EN and ES readings of A1's outcomes, B1's conflict display, the variable and choice controls and both form representations; **B5** reproduced by a failing visible measurement and corrected only if demonstrated (§4.7); the D15 subject shown; deliberate R38 touches (block-scalar `layout` under conflict, item-owned comments, a CR refusal, a CRLF file's untouched bytes) | **Owed — unread, not started.** Set aside by driven runs (ruling 29) |
| **4-16** — remaining authoring | 4-14 (4-14-1, 4-14-2), 4-15 | EN and ES readings of every remaining kind and row: a multi-line command draft (not executed), script argument boundaries, the clipboard placeholder, open-scope naming, a held save and conflict retention | **Owed — unread, not started.** Set aside by driven runs |
| **4-20** — preview | 4-17, 4-18, 4-19 (4-19-1, 4-19-2) | EN and ES readings of the sample instant and zone, choice label versus id, form samples, unresolved chains, long output, command placeholders; the owner judges whether the wording over-promises | **Owed — unread, not started.** Set aside by driven runs |
| **4-23** — regex | 4-21, 4-22 | EN and ES readings of compile failure versus no match, optional captures and Unicode, insertion at the caret, the engine-version sentence; **D11** gets an owner disposition or stays owed | **Owed — unread, not started.** Needs the owner for D11; set aside by driven runs |

**Tally: four owed, zero read, zero in part.** Mounted jsdom evidence in the step records is not credited
here as a screen (ruling 29).

## 3. The Phase 4 translation-review inventory (E4; ruling 31)

**What this is.** Every dictionary key Phase 4 added, with its English and Spanish values at `b436c7d`, the
step whose commit first held it and the source that names it. It is **an inventory for the owner's
native-speaker review (R35, CF-51, G2), not evidence of meaning.** No review of the Spanish was performed
here; the i18n suites check key parity and placeholder agreement only (`CLAUDE.md` §2). It is kept apart
from Phase 3's inventory (`3-15-2-notes.md` §2, `3-closure-notes.md` §3) and 2d-7-10's 145-row one.

### 3.1 The procedure (answers E4)

`scripts/i18n-inventory.mjs` replaces the out-of-repository `/private/tmp/3-15-2/inventory.cjs` and
`producers.cjs` with one committed script. It reads **only git objects** (never the working tree), so a run
against the same commits prints the same bytes whatever is uncommitted. Run from the repository root:

```sh
node scripts/i18n-inventory.mjs --phase 4 summary   # the counts in §3.2 and the gap check
node scripts/i18n-inventory.mjs --phase 4 rows      # the §3.4 table
node scripts/i18n-inventory.mjs --phase 4 changed   # changed pre-Phase-4 values (none, §3.2)
node scripts/i18n-inventory.mjs --phase 4 check     # as summary, exit 1 if any gap exists
```

- **The base.** `--phase 4` resolves to the first commit that touches `docs/decisions/4-split-notes.md`:
  `a1bc4d2` (*"Phase 4 design consult — twenty-four steps, closed"*), which changed no dictionary.
  `--base REV` and `--head REV` override the range.
- **Added keys:** present in `en.json` or `es.json` at the head and in neither at the base. **Step
  attribution:** the first commit in range whose `en.json` holds the key, named by its `Phase N-…` subject;
  each Phase 4 step closed in one commit.
- **Producer:** among non-test `.ts`/`.svelte` files under `src/` at the head, first a literal match (the
  whole key between quotes), else the longest dot-ending prefix followed by `${` (a template). **Comments
  are blanked before matching**, which removes the bound `3-closure-notes.md` §3.2 found by hand (a key
  named only in a JSDoc). A `.ts` hit is suffixed `#name`, the enclosing top-level function.
- **The gap check:** a key is a gap if it has no English value, no Spanish value, or no producer; a `code.*`
  key is also a gap if no producer is in `src/lib/i18n/codes.ts` (the typed accessor layer).
- **Validated against Phase 3.** `node scripts/i18n-inventory.mjs --phase 3 --head 3a85326 summary` prints
  994 → 1303 keys, **310 added, 1 changed** (`browser.matchEditor.readOnly.triggerNotSingle`, 3-6-1), **1
  removed** (`browser.sidebar.notAutoLoaded`), 0 added-then-removed, producers **311: 242 literal, 69
  template, 0 none**, and the per-step counts of `3-15-2-notes.md` §2.1 plus 3-14's one — exactly
  `3-closure-notes.md` §3.3's figures. It also attributes **54** keys to 3-11-2 (E1, §4.1).
- **Not a gate.** The script is not wired into `npm test` or `cargo test`. It is outside `tsconfig.json`'s
  `include` and is imported by nothing, so it changes neither the `svelte-check` file count nor the Vite
  module count (§8: 519 and 234, as before).

**Bounds.** A match shows a file **names** a key, not that anything draws it; the component that renders a
`codes.ts` accessor's result is one call further on and is not traced. The template rule credits a family
to one function without checking the function can produce every member, **and nothing else checks it
either**: the compiler (`TranslationKey` in `src/lib/i18n/index.ts`, under `npm run check`) proves only
that every key an accessor *returns* exists in the dictionary, not that every dictionary member of the
family is reachable from some accessor input — a member no input maps to type-checks and passes this
script. Complete coverage would need an exhaustive test over each accessor's outputs, which does not
exist; that is open item §5 (accessor-output coverage). The reverse direction — a Rust wire
variant with no string — is `src-tauri/src/dictionary_contract.rs`'s, under `cargo test`. The line-comment
stripper tracks quotes per line only; a `//` inside a multi-line template literal would be blanked (none
was found to matter: every key has a producer).

### 3.2 The counts it printed

| Figure | Value |
|---|---|
| Range | `a1bc4d2..b436c7d` |
| Keys at the base (EN / ES) | 1303 / 1303 |
| Keys at `HEAD` (EN / ES) | **1743 / 1743** |
| **Keys Phase 4 added, present at `HEAD`** (EN / ES; the sets are equal) | **440 / 440** |
| Pre-Phase-4 keys whose EN or ES value changed | 0 |
| Pre-Phase-4 keys removed | 0 |
| Keys added in Phase 4 and removed again | **5** — `browser.variableGroup.echo.{open,heading,text,add}` (added by 4-11, removed by 4-14-1 when Echo moved to *Add variable*), `code.previewUnresolved.dateNotPreviewed` (added by 4-17, removed by 4-18) |
| Producers: keys / literal / template / none | **440 / 324 / 116 / 0** |
| `code.*` keys / produced in `codes.ts` | **116 / 116** |
| Added keys whose EN and ES values are identical | 3 — `browser.saveOutcome.label.vars` (*Variables*), `browser.variableKinds.kind.script` (*Script*), `browser.variableKinds.part.shell` (*Shell*); flagged for the owner's review, not judged here |
| **Gaps** | **0** |

Script-free cross-check: `git diff a1bc4d2 HEAD -- src/lib/i18n/en.json | rg -c '^\+  "'` answers **440**
(no value changed, so added lines equal added keys).

**Per step**, surviving at `HEAD`, against what each step's notes state:

| Step | Derived | The step's notes | Agree? |
|---|---|---|---|
| 4-1 | 1 | `code.draftError.optionNotPlainSource` (`4-1-notes.md:52-53`) | yes |
| 4-2 | 0 | no key named | yes |
| 4-3 | 14 | 14 (`4-3-notes.md:97`) | yes |
| 4-4 | 15 | 15 (`4-4-notes.md:114`) | yes |
| 4-5 | 9 | 9 (`4-5-notes.md:90`) | yes |
| 4-6 | 16 | 16 (`4-6-notes.md:126`) | yes |
| 4-7 | 2 | two (`4-7-notes.md:81`) | yes |
| 4-8 | 22 | 22 (`4-8-notes.md:87`) | yes |
| 4-9 | 33 | 33 (`4-9-notes.md:88`) | yes |
| 4-10 | 24 | 24 (`4-10-notes.md:73`) | yes |
| 4-11 | 53 | 57 (`4-11-notes.md:89`) | yes — 4 of the 57 removed by 4-14-1 |
| 4-12 | 81 | 81 (`4-12-notes.md:107`) | yes |
| 4-14-1 | 38 | 38 added, 4 removed (`4-14-1-notes.md:78`) | yes |
| 4-14-2 | 20 | 20 (`4-14-2-notes.md:113`) | yes |
| 4-15 | 15 | 15 (`4-15-notes.md:61`) | yes |
| 4-17 | 23 | 24 (`4-17-notes.md:86`) | yes — 1 of the 24 removed by 4-18 |
| 4-18 | 6 | +6 / −1 (`4-18-notes.md:90`) | yes |
| 4-19-1 | 0 | no key (`4-19-1-notes.md:59`) | yes |
| 4-19-2 | 34 | 34 (`4-19-2-notes.md:93`) | yes |
| 4-21 | 8 | 8 (`4-21-notes.md:60`) | yes |
| 4-22 | 26 | 26 (`4-22-notes.md:79`) | yes |
| **Total** | **440** | | |

By namespace: `browser.formBuilder` 80, `browser.variableGroup` 66, `code.draftError` 55,
`browser.variableKinds` 34, `browser.preview` 34, `browser.variableEditor` 23, `code.previewUnresolved` 22,
`browser.variableParams` 20, `browser.regexBench` 18, `browser.saveOutcome` 16, `browser.formEditor` 15,
`browser.kindInsertion` 14, `code.incompleteReason` 13, `code.regexRefusal` 5, `code.previewPlaceholder` 4,
three each `code.regexCompileFailure`, `code.previewLimit`, `code.malformedPlaceholder`, `code.injection`
and `browser.matchEditor`, two each `code.findingCode` and `code.edgeKind`, one each `code.commandError` and
`browser.recovery`.

### 3.3 The acceptance check: every new code has both strings and a typed producer

**Met, within the bounds of §3.1.** `node scripts/i18n-inventory.mjs --phase 4 check` exited **0** with
**0 gaps**: all 440 keys have a non-empty English and Spanish value and a producer in `src/`, and all 116
`code.*` keys are named by a `*Key` accessor in `src/lib/i18n/codes.ts` through a template. The other
324 are named literally, each as a `TranslationKey` the compiler checks exists. Beside it,
`dictionary_contract.rs` (every Rust code variant has a string, `cargo test`) and the typed accessors
(`npm run check`, 0 errors) both passed in the runs of §8. **What this does not show:** that each of the
116 template-credited keys is actually reachable from its accessor — neither the script nor the compiler
checks that direction (§3.1 *Bounds*), so it is recorded as open, not met. **No missing-string gap is
recorded.**

### 3.4 The 440 added keys

Values as at `b436c7d`: a key reworded after the step that added it shows only its final text. Rows are in
`en.json` order. Cells escape `|` as `\|`; no value holds a line break. Generated verbatim by
`node scripts/i18n-inventory.mjs --phase 4 rows`.

| # | Key | EN | ES | Step | Producer |
|---|---|---|---|---|---|
| P1 | `browser.saveOutcome.field.variableAdded` | part of a new variable this save would add | parte de una variable nueva que este guardado añadiría | 4-9 (`2475308`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P2 | `browser.saveOutcome.field.variableRemoved` | this variable would be taken out, with everything it holds | esta variable se quitaría, con todo lo que contiene | 4-9 (`2475308`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P3 | `browser.saveOutcome.field.variablesRemoved` | the whole list of variables would be taken out | se quitaría la lista entera de variables | 4-9 (`2475308`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P4 | `browser.saveOutcome.field.parameterName` | the name of a parameter the new variable would hold | el nombre de un parámetro que tendría la variable nueva | 4-9 (`2475308`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P5 | `browser.saveOutcome.field.parameterValue` | a value of the parameter named just above | un valor del parámetro nombrado justo encima | 4-9 (`2475308`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P6 | `browser.saveOutcome.field.fieldAdded` | a form field this save would add, named here | un campo de formulario que este guardado añadiría, nombrado aquí | 4-10 (`776836e`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P7 | `browser.saveOutcome.field.fieldRemoved` | this form field would be taken out with its options; the layout keeps its placeholders | este campo de formulario se quitaría con sus opciones; el diseño conserva sus marcadores | 4-10 (`776836e`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P8 | `browser.saveOutcome.field.fieldEdited` | a form field whose options would change as listed below | un campo de formulario cuyas opciones cambiarían como se indica debajo | 4-10 (`776836e`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P9 | `browser.saveOutcome.field.optionName` | the name of an option this form field would hold | el nombre de una opción que tendría este campo de formulario | 4-10 (`776836e`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P10 | `browser.saveOutcome.field.optionValue` | the value of the option named just above | el valor de la opción nombrada justo encima | 4-10 (`776836e`) | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P11 | `browser.saveOutcome.label.variableName` | Variable name | Nombre de la variable | 4-9 (`2475308`) | `browser/saveOutcome.ts#retainedLabelKey` |
| P12 | `browser.saveOutcome.label.vars` | Variables | Variables | 4-9 (`2475308`) | `browser/saveOutcome.ts#retainedLabelKey` |
| P13 | `browser.saveOutcome.label.formFields` | Form fields | Campos del formulario | 4-10 (`776836e`) | `browser/saveOutcome.ts#retainedLabelKey` |
| P14 | `browser.saveOutcome.label.formField` | Form field | Campo del formulario | 4-10 (`776836e`) | `browser/saveOutcome.ts#retainedLabelKey` |
| P15 | `browser.saveOutcome.label.formOption` | Form field option | Opción del campo | 4-10 (`776836e`) | `browser/saveOutcome.ts#retainedLabelKey` |
| P16 | `browser.saveOutcome.label.layout` | Layout | Diseño | 4-10 (`776836e`) | `browser/saveOutcome.ts#retainedLabelKey` |
| P17 | `browser.matchEditor.saveWithheld.varsWouldBeEmpty` | This snippet cannot be saved: the draft takes out every variable. Removing the whole list of variables is a separate action. | Este fragmento no se puede guardar: el borrador quita todas las variables. Quitar la lista entera de variables es otra acción. | 4-9 (`2475308`) | `browser/matchEditor.ts#saveWithheldKey` |
| P18 | `browser.matchEditor.saveWithheld.variableAdditionsCollide` | This snippet cannot be saved: the draft adds more than one new variable, and one save adds one. Save the first, then add the next. | Este fragmento no se puede guardar: el borrador añade más de una variable nueva, y cada guardado añade una. Guarda la primera y después añade la siguiente. | 4-9 (`2475308`) | `browser/matchEditor.ts#saveWithheldKey` |
| P19 | `browser.matchEditor.saveWithheld.formFieldsWouldBeEmpty` | This snippet cannot be saved: the draft takes out every field of one form, which this app does not do one field at a time. Restore one of them. | Este fragmento no se puede guardar: el borrador quita todos los campos de un formulario, algo que esta aplicación no hace campo a campo. Restaura uno de ellos. | 4-10 (`776836e`) | `browser/matchEditor.ts#saveWithheldKey` |
| P20 | `browser.variableEditor.readOnly.notInVariable` | This variable does not have this key, and this editor only changes keys a variable already has, so it is shown and not edited here. | Esta variable no tiene esta clave, y este editor solo cambia claves que la variable ya tiene, así que se muestra y no se edita aquí. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableFieldRefusalKey` |
| P21 | `browser.variableEditor.addition.varsNotABlockList` | A variable cannot be added here: this snippet’s variables are written on one line or are not a list, and this app adds a variable only to a list written one variable per line. | Aquí no se puede añadir una variable: las variables de este fragmento están escritas en una sola línea o no son una lista, y esta aplicación solo añade variables a una lista escrita con una variable por línea. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableAdditionRefusalKey` |
| P22 | `browser.variableEditor.addition.additionPending` | The draft already adds a new variable. Save it before adding another. | El borrador ya añade una variable nueva. Guárdala antes de añadir otra. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableAdditionRefusalKey` |
| P23 | `browser.variableEditor.addition.containerRemoved` | The draft takes out the whole list of variables, so nothing can be added to it. | El borrador quita la lista entera de variables, así que no se le puede añadir nada. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableAdditionRefusalKey` |
| P24 | `browser.variableEditor.addition.notDraftable` | This snippet was saved and has to be read again before its variables can be changed. | Este fragmento se ha guardado y hay que volver a leerlo antes de cambiar sus variables. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableAdditionRefusalKey` |
| P25 | `browser.variableEditor.structure.notInDocument` | This window no longer shows this snippet as the editor was opened on it, so its variables cannot be added, taken out or reordered. | Esta ventana ya no muestra este fragmento tal y como estaba al abrir el editor, así que no se pueden añadir, quitar ni reordenar sus variables. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P26 | `browser.variableEditor.structure.readOnly` | This app does not write this file, so its variables cannot be changed. | Esta aplicación no escribe en este archivo, así que sus variables no se pueden cambiar. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P27 | `browser.variableEditor.structure.staleDraftInDocument` | An editor is open in this file over an older version of it. Save or discard that draft before adding, taking out or reordering variables in this file. | Hay un editor abierto en este archivo sobre una versión anterior. Guarda o descarta ese borrador antes de añadir, quitar o reordenar variables en este archivo. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P28 | `browser.variableEditor.move.editorNotEditable` | Variables cannot be reordered while the editor is not accepting changes. | No se pueden reordenar las variables mientras el editor no admite cambios. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P29 | `browser.variableEditor.move.otherEditsPending` | A new order of the variables is saved on its own. Save or undo the other changes in the draft first. | Un nuevo orden de las variables se guarda por separado. Guarda o deshaz antes los demás cambios del borrador. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P30 | `browser.variableEditor.move.varsNotABlockList` | Only a list of variables written one variable per line can be reordered here. | Aquí solo se puede reordenar una lista de variables escrita con una variable por línea. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P31 | `browser.variableEditor.move.tooFewVariables` | There are fewer than two variables, so there is no other order. | Hay menos de dos variables, así que no hay otro orden posible. | 4-9 (`2475308`) | `browser/variableEditor.ts#variableMoveRefusalKey` |
| P32 | `browser.variableEditor.name.available` | No name this snippet can see uses it. | Ningún nombre que este fragmento pueda ver lo usa. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameVerdictKey` |
| P33 | `browser.variableEditor.name.availableAmongVisibleNames` | Available among visible names. Some names this snippet may use cannot be seen from here, such as those of an imported file or a name that could not be read, so a clash cannot be ruled out. | Disponible entre los nombres visibles. Algunos nombres que este fragmento puede usar no se ven desde aquí, como los de un archivo importado o un nombre que no se pudo leer, así que no se puede descartar una coincidencia. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameVerdictKey` |
| P34 | `browser.variableEditor.name.empty` | A variable needs a name. | Una variable necesita un nombre. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P35 | `browser.variableEditor.name.notAnIdentifier` | A name inserted as a reference has to start with a letter or an underscore and hold only letters, digits and underscores, on one line. | Un nombre que se inserta como referencia tiene que empezar por una letra o un guion bajo y contener solo letras, dígitos y guiones bajos, en una sola línea. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P36 | `browser.variableEditor.name.takenByLocal` | A variable of this snippet already has this name, or had it before the draft renamed or removed it. | Una variable de este fragmento ya tiene este nombre, o lo tenía antes de que el borrador la renombrara o la quitara. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P37 | `browser.variableEditor.name.takenByAddition` | A new variable in the draft already has this name. | Una variable nueva del borrador ya tiene este nombre. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P38 | `browser.variableEditor.name.takenByCapture` | A named group of the regular expression already uses this name. | Un grupo con nombre de la expresión regular ya usa este nombre. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P39 | `browser.variableEditor.name.takenByGlobal` | A global variable of this file already has this name. | Una variable global de este archivo ya tiene este nombre. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P40 | `browser.variableEditor.name.takenBySynthesized` | espanso gives this name to a form written in the content, so a variable does not take it. | espanso da este nombre a un formulario escrito en el contenido, así que una variable no lo toma. | 4-9 (`2475308`) | `browser/variableInsertion.ts#nameRefusalKey` |
| P41 | `browser.variableEditor.insert.fieldNotEditable` | Nothing can be inserted there now: the field or the variables are not accepting changes. | Ahora no se puede insertar nada ahí: el campo o las variables no admiten cambios. | 4-9 (`2475308`) | `browser/variableInsertion.ts#insertRefusalKey` |
| P42 | `browser.variableEditor.insert.unreadableText` | The new variable holds a line break a one-line box cannot hold, or a carriage return no box in this window can hold, so it was not added. | La variable nueva contiene un salto de línea que una caja de una línea no admite, o un retorno de carro que ninguna caja de esta ventana admite, así que no se ha añadido. | 4-9 (`2475308`) | `browser/variableInsertion.ts#insertRefusalKey` |
| P43 | `browser.variableGroup.heading` | Variables and fill-ins | Variables y campos para rellenar | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P44 | `browser.variableGroup.chips` | Variables of this snippet | Variables de este fragmento | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P45 | `browser.variableGroup.none` | This snippet has no local variables. | Este fragmento no tiene variables locales. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P46 | `browser.variableGroup.selectHint` | Choose a variable to show its controls. | Elige una variable para ver sus controles. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P47 | `browser.variableGroup.containerRemoved` | The draft takes out the whole list of variables when you save. Each variable can still be chosen below. | El borrador quita la lista entera de variables al guardar. Cada variable se puede seguir eligiendo abajo. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P48 | `browser.variableGroup.analysis.reading` | Reading how these variables are used… | Leyendo cómo se usan estas variables… | 4-11 (`8725fbd`) | `browser/variableGroup.ts#analysisStateKey` |
| P49 | `browser.variableGroup.analysis.current` | How the variables are used, as the file was last read. Changes in this draft are analysed once they are saved. | Cómo se usan las variables, según la última lectura del archivo. Los cambios de este borrador se analizan cuando se guardan. | 4-11 (`8725fbd`) | `browser/variableGroup.ts#analysisStateKey` |
| P50 | `browser.variableGroup.analysis.unavailable` | espansoConfig could not read how these variables are used, so no dependency state is shown. | espansoConfig no pudo leer cómo se usan estas variables, así que no se muestra su estado de dependencias. | 4-11 (`8725fbd`) | `browser/variableGroup.ts#analysisStateKey` |
| P51 | `browser.variableGroup.analysis.outOfStep` | The analysis at hand describes an earlier version of this snippet, so it is not shown. It is read again when the snippet is read again. | El análisis disponible describe una versión anterior de este fragmento, así que no se muestra. Se vuelve a leer cuando se vuelve a leer el fragmento. | 4-11 (`8725fbd`) | `browser/variableGroup.ts#analysisStateKey` |
| P52 | `browser.variableGroup.analysis.incomplete` | Analysis incomplete: | Análisis incompleto: | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P53 | `browser.variableGroup.status.edited` | changed in the draft | cambiada en el borrador | 4-11 (`8725fbd`) | `browser/variableGroup.ts#declarationStatusKey` |
| P54 | `browser.variableGroup.status.removed` | taken out in the draft | quitada en el borrador | 4-11 (`8725fbd`) | `browser/variableGroup.ts#declarationStatusKey` |
| P55 | `browser.variableGroup.status.added` | new in the draft | nueva en el borrador | 4-11 (`8725fbd`) | `browser/variableGroup.ts#declarationStatusKey` |
| P56 | `browser.variableGroup.unnamed` | (no readable name) | (sin nombre legible) | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P57 | `browser.variableGroup.row.usage` | References found: {body} in the content, {parameters} in other variables’ parameters, {dependsOn} in depends_on, {layout} in a form layout (not verified). | Referencias encontradas: {body} en el contenido, {parameters} en parámetros de otras variables, {dependsOn} en depends_on, {layout} en un diseño de formulario (sin verificar). | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P58 | `browser.variableGroup.row.noVisibleReference` | No visible reference found. espanso still evaluates this variable. | No se encontró ninguna referencia visible. espanso evalúa esta variable de todos modos. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P59 | `browser.variableGroup.row.dependsOn` | Depends on {name} ({kind}). | Depende de {name} ({kind}). | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P60 | `browser.variableGroup.row.usedBy` | Used by {name} ({kind}). | La usa {name} ({kind}). | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P61 | `browser.variableGroup.row.cycle` | Part of a dependency cycle. | Forma parte de un ciclo de dependencias. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P62 | `browser.variableGroup.row.missingDependencies` | Entries of its depends_on that name no visible variable: {count}. | Entradas de su depends_on que no nombran ninguna variable visible: {count}. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P63 | `browser.variableGroup.row.writtenBefore` | Written before {name}, which it depends on. The order stays as written, and the order of the file is not claimed to be the order espanso evaluates them in. | Está escrita antes que {name}, de la que depende. El orden se mantiene tal y como está escrito, y no se afirma que el orden del archivo sea el orden en que espanso las evalúa. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P64 | `browser.variableGroup.row.new` | New in this draft: analysed once saved. | Nueva en este borrador: se analiza al guardarla. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P65 | `browser.variableGroup.selected` | Controls for {name} | Controles de {name} | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P66 | `browser.variableGroup.close` | Hide these controls | Ocultar estos controles | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P67 | `browser.variableGroup.remove` | Take this variable out | Quitar esta variable | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P68 | `browser.variableGroup.restore` | Keep this variable | Mantener esta variable | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P69 | `browser.variableGroup.removedNote` | This variable is taken out when you save. | Esta variable se quita al guardar. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P70 | `browser.variableGroup.removeAll` | Take out all the variables | Quitar todas las variables | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P71 | `browser.variableGroup.restoreAll` | Keep the variables | Mantener las variables | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P72 | `browser.variableGroup.discard` | Drop this new variable | Descartar esta variable nueva | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P73 | `browser.variableGroup.quotedText` | The box holds the text between the quotes. | La caja contiene el texto que hay entre las comillas. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P74 | `browser.variableGroup.editWritesPlain` | Left untouched, it keeps its quotes; any edit writes it without quotes, as the setting it is. | Si no se toca, conserva sus comillas; cualquier cambio la escribe sin comillas, como el ajuste que es. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P75 | `browser.variableGroup.added.insertedInto` | Its reference was inserted into {field}. | Su referencia se insertó en {field}. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P76 | `browser.variableGroup.added.values` | Values | Valores | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P77 | `browser.variableGroup.move.heading` | Order | Orden | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P78 | `browser.variableGroup.move.hint` | A new order is saved at once, on its own. | Un nuevo orden se guarda en el acto y por separado. | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P79 | `browser.variableGroup.move.front` | Move to the top | Mover al principio | 4-11 (`8725fbd`) | `browser/variableGroup.ts#moveChoiceKey` |
| P80 | `browser.variableGroup.move.after` | Move after {name} | Mover después de {name} | 4-11 (`8725fbd`) | `browser/variableGroup.ts#moveChoiceKey` |
| P81 | `browser.variableGroup.move.end` | Move to the end | Mover al final | 4-11 (`8725fbd`) | `browser/variableGroup.ts#moveChoiceKey` |
| P82 | `browser.variableGroup.reorderConflict` | The new order of the variables was not saved. A new order is not a draft, so there is nothing to keep or to copy: load the version on disk and choose the order again. | El nuevo orden de las variables no se guardó. Un nuevo orden no es un borrador, así que no hay nada que conservar ni que copiar: carga la versión del disco y vuelve a elegir el orden. | 4-11 (`8725fbd`) | `components/MatchEditor.svelte` |
| P83 | `browser.variableGroup.reorderRefused` | The new order of the variables was not saved. This app does not offer to save a new order over these findings. | El nuevo orden de las variables no se guardó. Esta aplicación no ofrece guardar un nuevo orden pese a estos hallazgos. | 4-11 (`8725fbd`) | `components/MatchEditor.svelte` |
| P84 | `browser.variableGroup.choice.open` | Insert a choice | Insertar una opción | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P85 | `browser.variableGroup.choice.heading` | Insert a choice | Insertar una opción | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P86 | `browser.variableGroup.name` | Name | Nombre | 4-11 (`8725fbd`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P87 | `browser.variableGroup.choice.values` | Values, one per line | Valores, uno por línea | 4-11 (`8725fbd`) | `components/VariableGroup.svelte` |
| P88 | `browser.variableGroup.choice.target` | Insert the reference into | Insertar la referencia en | 4-11 (`8725fbd`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P89 | `browser.variableGroup.choice.insert` | Insert | Insertar | 4-11 (`8725fbd`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P90 | `browser.variableGroup.cancel` | Cancel | Cancelar | 4-11 (`8725fbd`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P91 | `browser.variableGroup.notEditable` | Nothing can be inserted while the editor is not accepting changes. | No se puede insertar nada mientras el editor no admite cambios. | 4-11 (`8725fbd`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P92 | `browser.variableGroup.choice.noTarget` | No text of this snippet can take a reference now: it needs a replacement text, Markdown or HTML that it already has. | Ningún texto de este fragmento admite ahora una referencia: hace falta un texto de sustitución, Markdown o HTML que ya tenga. | 4-11 (`8725fbd`) | `browser/regexBench.ts#captureInsertRefusalKey`, `browser/variableGroup.ts#choiceProblemKey`, `browser/variableKinds.ts#kindProblemKey`, `components/VariableGroup.svelte` |
| P93 | `browser.variableGroup.choice.noValues` | A choice needs at least one value. | Una opción necesita al menos un valor. | 4-11 (`8725fbd`) | `browser/variableGroup.ts#choiceProblemKey` |
| P94 | `browser.variableGroup.choice.emptyValue` | A line between two values is empty. Every line is one value. | Una línea entre dos valores está vacía. Cada línea es un valor. | 4-11 (`8725fbd`) | `browser/variableGroup.ts#choiceProblemKey` |
| P95 | `browser.variableGroup.choice.carriageReturn` | A value holds a carriage return, which no box in this window can hold, so it cannot be inserted. | Un valor contiene un retorno de carro, que ninguna caja de esta ventana admite, así que no se puede insertar. | 4-11 (`8725fbd`) | `browser/variableGroup.ts#choiceProblemKey` |
| P96 | `browser.variableGroup.addVariable.open` | Add a variable | Añadir una variable | 4-14-1 (`ff665ba`) | `components/VariableGroup.svelte` |
| P97 | `browser.variableGroup.addVariable.heading` | Add a variable | Añadir una variable | 4-14-1 (`ff665ba`) | `components/VariableGroup.svelte` |
| P98 | `browser.variableGroup.addVariable.add` | Add | Añadir | 4-14-1 (`ff665ba`) | `components/VariableGroup.svelte` |
| P99 | `browser.variableGroup.added.params` | Its parameters, as they will be written | Sus parámetros, tal como se escribirán | 4-14-1 (`ff665ba`) | `components/VariableGroup.svelte` |
| P100 | `browser.variableKinds.kindLabel` | Kind | Tipo | 4-14-1 (`ff665ba`) | `components/VariableGroup.svelte` |
| P101 | `browser.variableKinds.kind.echo` | Echo (fixed text) | Echo (texto fijo) | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P102 | `browser.variableKinds.kind.date` | Date and time | Fecha y hora | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P103 | `browser.variableKinds.kind.random` | Random choice | Elección al azar | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P104 | `browser.variableKinds.kind.clipboard` | Clipboard | Portapapeles | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P105 | `browser.variableKinds.kind.shell` | Shell command | Orden de shell | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P106 | `browser.variableKinds.kind.script` | Script | Script | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P107 | `browser.variableKinds.kind.match` | Another snippet | Otro fragmento | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#newVariableKindKey` |
| P108 | `browser.variableKinds.part.format` | Format | Formato | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P109 | `browser.variableKinds.part.offset` | Offset, in seconds | Desplazamiento, en segundos | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P110 | `browser.variableKinds.part.tz` | Time zone | Zona horaria | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P111 | `browser.variableKinds.part.locale` | Locale | Configuración regional | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P112 | `browser.variableKinds.part.choices` | Choices, one per line | Opciones, una por línea | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P113 | `browser.variableKinds.part.echo` | The text it echoes | El texto que repite | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P114 | `browser.variableKinds.part.cmd` | Command | Orden | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P115 | `browser.variableKinds.part.shell` | Shell | Shell | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P116 | `browser.variableKinds.part.trim` | Trim the output | Recortar la salida | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P117 | `browser.variableKinds.part.debug` | Debug | Depuración | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P118 | `browser.variableKinds.part.args` | Arguments, one per line | Argumentos, uno por línea | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P119 | `browser.variableKinds.part.trigger` | The other snippet's trigger | El disparador del otro fragmento | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindPartKey` |
| P120 | `browser.variableKinds.required` | Required. | Obligatorio. | 4-14-1 (`ff665ba`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P121 | `browser.variableKinds.optional` | Optional: left blank, it is not written. | Opcional: si se deja en blanco, no se escribe. | 4-14-1 (`ff665ba`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P122 | `browser.variableKinds.plainSource` | Written exactly as typed, not as quoted text. | Se escribe tal como se teclea, no como texto entre comillas. | 4-14-1 (`ff665ba`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P123 | `browser.variableKinds.note.executes` | Espanso may run this command when the snippet expands. This application never runs it. | Espanso puede ejecutar esta orden cuando se expande el fragmento. Esta aplicación nunca la ejecuta. | 4-14-1 (`ff665ba`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P124 | `browser.variableKinds.note.readsClipboard` | Espanso reads the clipboard when the snippet expands, and this variable takes no parameters. This application never reads the clipboard. | Espanso lee el portapapeles cuando se expande el fragmento, y esta variable no lleva parámetros. Esta aplicación nunca lee el portapapeles. | 4-14-1 (`ff665ba`) | `components/KindInsertion.svelte`, `components/VariableGroup.svelte` |
| P125 | `browser.variableKinds.problem.required` | {part} is required and is blank. | {part} es obligatorio y está en blanco. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindProblemKey` |
| P126 | `browser.variableKinds.problem.emptyItem` | A line between two items of {part} is empty. Every line is one item. | Una línea entre dos elementos de {part} está vacía. Cada línea es un elemento. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindProblemKey` |
| P127 | `browser.variableKinds.problem.carriageReturn` | {part} would hold a carriage return, which no box in this window can hold, so it was not taken. | {part} contendría un retorno de carro, que ninguna caja de esta ventana admite, así que no se ha tomado. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindProblemKey` |
| P128 | `browser.variableKinds.problem.lineBreak` | {part} is one line, so a line break was not taken. | {part} es de una sola línea, así que no se ha tomado el salto de línea. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindProblemKey` |
| P129 | `browser.variableKinds.warning.offsetNotAnInteger` | {part} is not a whole number of seconds. It is kept as typed. | {part} no es un número entero de segundos. Se conserva tal como se tecleó. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindWarningKey` |
| P130 | `browser.variableKinds.warning.notTrueOrFalse` | {part} is neither true nor false, so espanso may not read it as a switch. It is kept as typed. | {part} no es ni true ni false, así que puede que espanso no lo lea como un interruptor. Se conserva tal como se tecleó. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindWarningKey` |
| P131 | `browser.variableKinds.warning.unfamiliarShell` | {part} is not a shell name this application knows. It is kept as typed. | {part} no es un nombre de shell que esta aplicación conozca. Se conserva tal como se tecleó. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindWarningKey` |
| P132 | `browser.variableKinds.warning.formatWithoutSpecifier` | {part} holds no % specifier, so it is printed as written. It is kept as typed. | {part} no contiene ningún especificador %, así que se imprime tal cual. Se conserva tal como se tecleó. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindWarningKey` |
| P133 | `browser.variableKinds.warning.surroundingSpace` | {part} starts or ends with a space, which is kept. | {part} empieza o termina con un espacio, que se conserva. | 4-14-1 (`ff665ba`) | `browser/variableKinds.ts#kindWarningKey` |
| P134 | `browser.variableGroup.insert.heading` | Insert into the text: | Insertar en el texto: | 4-15 (`b8eade2`) | `components/VariableGroup.svelte` |
| P135 | `browser.kindInsertion.row.date` | Insert a date or time | Insertar una fecha u hora | 4-15 (`b8eade2`) | `browser/variableKinds.ts#insertRowKey` |
| P136 | `browser.kindInsertion.row.random` | Insert a random choice | Insertar una elección al azar | 4-15 (`b8eade2`) | `browser/variableKinds.ts#insertRowKey` |
| P137 | `browser.kindInsertion.row.clipboard` | Insert the clipboard contents | Insertar el contenido del portapapeles | 4-15 (`b8eade2`) | `browser/variableKinds.ts#insertRowKey` |
| P138 | `browser.kindInsertion.row.shell` | Insert a shell command | Insertar una orden de shell | 4-15 (`b8eade2`) | `browser/variableKinds.ts#insertRowKey` |
| P139 | `browser.kindInsertion.row.script` | Insert a script | Insertar un script | 4-15 (`b8eade2`) | `browser/variableKinds.ts#insertRowKey` |
| P140 | `browser.kindInsertion.row.match` | Insert another snippet | Insertar otro fragmento | 4-15 (`b8eade2`) | `browser/variableKinds.ts#insertRowKey` |
| P141 | `browser.kindInsertion.reference` | What goes into the text: | Lo que se inserta en el texto: | 4-15 (`b8eade2`) | `components/KindInsertion.svelte` |
| P142 | `browser.kindInsertion.written` | What the new variable will be written with, as text: | Con qué se escribirá la nueva variable, como texto: | 4-15 (`b8eade2`) | `components/KindInsertion.svelte` |
| P143 | `browser.kindInsertion.item` | Item {number} | Elemento {number} | 4-15 (`b8eade2`) | `components/KindInsertion.svelte` |
| P144 | `browser.kindInsertion.preview.heading` | Preview | Vista previa | 4-15 (`b8eade2`) | `components/KindInsertion.svelte` |
| P145 | `browser.kindInsertion.preview.commandNotRun` | No preview is available: this application never runs the command, so it cannot show what the command would print. | No hay vista previa: esta aplicación nunca ejecuta la orden, así que no puede mostrar lo que la orden imprimiría. | 4-15 (`b8eade2`) | `browser/variableKinds.ts#kindPreviewKey` |
| P146 | `browser.kindInsertion.preview.clipboardNotRead` | No preview is available: this application never reads the clipboard, so it cannot show what the clipboard would hold. | No hay vista previa: esta aplicación nunca lee el portapapeles, así que no puede mostrar lo que contendría el portapapeles. | 4-15 (`b8eade2`) | `browser/variableKinds.ts#kindPreviewKey` |
| P147 | `browser.kindInsertion.preview.notYetAvailable` | No preview is available: this application does not show what espanso would produce for this variable. | No hay vista previa: esta aplicación no muestra lo que espanso produciría para esta variable. | 4-15 (`b8eade2`) | `browser/variableKinds.ts#kindPreviewKey` |
| P148 | `browser.kindInsertion.kept` | What you type here is kept while this editor is open, until you insert it or press Cancel. | Lo que escribas aquí se conserva mientras este editor esté abierto, hasta que lo insertes o pulses Cancelar. | 4-15 (`b8eade2`) | `components/KindInsertion.svelte` |
| P149 | `browser.preview.heading` | Preview | Vista previa | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P150 | `browser.preview.illustration` | An illustration for one example, worked out by this application from the draft. It is not espanso's own expansion: nothing is run, the clipboard is not read, and nothing is saved. | Una ilustración para un ejemplo, calculada por esta aplicación a partir del borrador. No es la expansión de espanso: no se ejecuta nada, no se lee el portapapeles y no se guarda nada. | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P151 | `browser.preview.show` | Preview this draft | Previsualizar este borrador | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P152 | `browser.preview.refresh` | Refresh the preview | Actualizar la vista previa | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P153 | `browser.preview.hide` | Close the preview | Cerrar la vista previa | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P154 | `browser.preview.failed` | The preview could not be prepared. {reason} | No se pudo preparar la vista previa. {reason} | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P155 | `browser.preview.notice.pending` | Preparing the preview… | Preparando la vista previa… | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewNoticeKey` |
| P156 | `browser.preview.notice.noMatchInCandidate` | With this draft applied, the file would hold no snippet at this place, so there is nothing to preview. | Con este borrador aplicado, el archivo no tendría ningún fragmento en este lugar, así que no hay nada que previsualizar. | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewNoticeKey` |
| P157 | `browser.preview.notice.behindDraft` | The draft has changed since this preview was prepared. Refresh the preview to see the change. | El borrador ha cambiado desde que se preparó esta vista previa. Actualízala para ver el cambio. | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewNoticeKey` |
| P158 | `browser.preview.notice.noSamples` | This snippet takes no example values. | Este fragmento no admite valores de ejemplo. | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewNoticeKey` |
| P159 | `browser.preview.notice.noContent` | This snippet has no content to preview. | Este fragmento no tiene contenido que previsualizar. | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewNoticeKey` |
| P160 | `browser.preview.notice.instantMissing` | No date and time could be read from this computer, so dates are not previewed. | No se pudo leer la fecha y la hora de este ordenador, así que las fechas no se previsualizan. | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewNoticeKey` |
| P161 | `browser.preview.samples.heading` | Example values | Valores de ejemplo | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P162 | `browser.preview.slot.selection` | Entry number for {name} (1 is the first) | Número de entrada de {name} (1 es la primera) | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P163 | `browser.preview.slot.selectionUnnamed` | Entry number for a variable with no name (1 is the first) | Número de entrada de una variable sin nombre (1 es la primera) | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P164 | `browser.preview.slot.formField` | Field {field} of the form {name} | Campo {field} del formulario {name} | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P165 | `browser.preview.slot.formFieldUnnamed` | Field {field} of a form with no name | Campo {field} de un formulario sin nombre | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P166 | `browser.preview.slot.shorthandField` | Field {field} of this snippet's form | Campo {field} del formulario de este fragmento | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P167 | `browser.preview.slot.capture` | Capture {name} | Captura {name} | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P168 | `browser.preview.slot.entryRefused` | Type a whole number, 1 or more, or leave the box empty. | Escribe un número entero, 1 o mayor, o deja la casilla vacía. | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P169 | `browser.preview.output.heading` | Illustrative output | Resultado ilustrativo | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P170 | `browser.preview.choiceLabel` | Chosen entry: | Entrada elegida: | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P171 | `browser.preview.unresolvedCount` | Parts left as written because they could not be previewed: {count} | Partes que se dejan tal como están escritas porque no se pudieron previsualizar: {count} | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P172 | `browser.preview.limitations.heading` | What this preview does not show | Lo que esta vista previa no muestra | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P173 | `browser.preview.instant.heading` | Example date and time | Fecha y hora de ejemplo | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P174 | `browser.preview.instant.utc` | {instant}, UTC | {instant}, hora UTC | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P175 | `browser.preview.instant.seconds` | {seconds} seconds after 1 January 1970, UTC | {seconds} segundos después del 1 de enero de 1970, hora UTC | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P176 | `browser.preview.instant.note` | Dates are shown at this moment and in this zone, which stands in for the system zone espanso would use. | Las fechas se muestran en este momento y en esta zona, que sustituye a la zona del sistema que usaría espanso. | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P177 | `browser.preview.zone.named` | Time zone: {name} | Zona horaria: {name} | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P178 | `browser.preview.zone.fixed` | Offset from UTC: {offset} | Desfase respecto a UTC: {offset} | 4-19-2 (`724dbf3`) | `components/PreviewPanel.svelte` |
| P179 | `browser.preview.placeholder.clipboard` | clipboard contents | contenido del portapapeles | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewPlaceholderChipKey` |
| P180 | `browser.preview.placeholder.shell` | shell command output | salida de la orden de shell | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewPlaceholderChipKey` |
| P181 | `browser.preview.placeholder.script` | script output | salida del script | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewPlaceholderChipKey` |
| P182 | `browser.preview.placeholder.match` | another snippet's expansion | expansión de otro fragmento | 4-19-2 (`724dbf3`) | `browser/previewView.ts#previewPlaceholderChipKey` |
| P183 | `browser.regexBench.heading` | Regex test | Prueba de expresiones regulares | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P184 | `browser.regexBench.intro` | Tries this snippet’s regular expression, exactly as its box holds it, on a sample you type, and shows the first match found anywhere in the sample. No anchor is added, and nothing is saved. | Prueba la expresión regular de este fragmento, tal como la contiene su casilla, con un texto de ejemplo que escribas, y muestra la primera coincidencia encontrada en cualquier parte del ejemplo. No se añade ningún ancla y no se guarda nada. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P185 | `browser.regexBench.sample` | Sample text | Texto de ejemplo | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P186 | `browser.regexBench.sampleLineBreaks` | Every line break typed in this box is sent as a line feed. | Cada salto de línea que escribas en esta casilla se envía como un salto de línea LF. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P187 | `browser.regexBench.test` | Test the regular expression | Probar la expresión regular | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P188 | `browser.regexBench.pending` | Testing… | Probando… | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P189 | `browser.regexBench.behind` | The regular expression or the sample has changed since this result. Test again to see the result for what they hold now. | La expresión regular o el ejemplo han cambiado desde este resultado. Vuelve a probar para ver el resultado de lo que contienen ahora. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P190 | `browser.regexBench.found` | First match: | Primera coincidencia: | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P191 | `browser.regexBench.emptyMatch` | The first match is empty: it covers no characters. | La primera coincidencia está vacía: no abarca ningún carácter. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P192 | `browser.regexBench.notFound` | The regular expression compiled and matches nowhere in the sample. | La expresión regular compiló y no coincide en ninguna parte del ejemplo. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P193 | `browser.regexBench.groups` | Named groups: | Grupos con nombre: | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P194 | `browser.regexBench.noGroups` | The regular expression names no group. | La expresión regular no nombra ningún grupo. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P195 | `browser.regexBench.groupUnmatched` | took no part in the match | no participó en la coincidencia | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P196 | `browser.regexBench.groupEmpty` | captured empty text | capturó un texto vacío | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P197 | `browser.regexBench.notAReference` | This name is not inserted as a reference: this application inserts only names made of letters, digits and underscores that start with a letter or an underscore. | Este nombre no se inserta como referencia: esta aplicación solo inserta nombres formados por letras, dígitos y guiones bajos que empiezan por una letra o un guion bajo. | 4-22 (`b436c7d`) | `browser/regexBench.ts#captureInsertRefusalKey`, `components/RegexBench.svelte`, `components/VariableGroup.svelte` |
| P198 | `browser.regexBench.wrongRequest` | The regex test answered another request, so its answer is not shown. Test again. | La prueba de expresiones regulares respondió a otra solicitud, así que su respuesta no se muestra. Vuelve a probar. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P199 | `browser.regexBench.failed` | The regex test could not be run. {reason} | No se pudo hacer la prueba de expresiones regulares. {reason} | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P200 | `browser.regexBench.compatibility` | Tested with this editor’s regex {version}. espanso 2.3.0 uses regex 1.5.5, so this result establishes nothing about whether espanso accepts this pattern or when it triggers. | Probado con la versión {version} de regex de este editor. espanso 2.3.0 usa regex 1.5.5, así que este resultado no establece nada sobre si espanso acepta este patrón ni sobre cuándo se dispara. | 4-22 (`b436c7d`) | `components/RegexBench.svelte` |
| P201 | `browser.variableGroup.capture.open` | Insert a regex capture | Insertar una captura de la expresión regular | 4-22 (`b436c7d`) | `components/VariableGroup.svelte` |
| P202 | `browser.variableGroup.capture.heading` | Insert a regex capture | Insertar una captura de la expresión regular | 4-22 (`b436c7d`) | `components/VariableGroup.svelte` |
| P203 | `browser.variableGroup.capture.explain` | The named groups of this snippet’s regular expression, as it was last tested. Only a reference is inserted into the text; no variable is created. | Los grupos con nombre de la expresión regular de este fragmento, tal como se probó por última vez. Solo se inserta una referencia en el texto; no se crea ninguna variable. | 4-22 (`b436c7d`) | `components/VariableGroup.svelte` |
| P204 | `browser.variableGroup.capture.none` | The regular expression names no group, so there is nothing to insert. | La expresión regular no nombra ningún grupo, así que no hay nada que insertar. | 4-22 (`b436c7d`) | `components/VariableGroup.svelte` |
| P205 | `browser.variableGroup.capture.insertOne` | Insert {reference} | Insertar {reference} | 4-22 (`b436c7d`) | `components/VariableGroup.svelte` |
| P206 | `browser.variableGroup.capture.notOffered` | The regular expression has changed since it was tested, so its groups are not offered. Test it again. | La expresión regular ha cambiado desde que se probó, así que no se ofrecen sus grupos. Vuelve a probarla. | 4-22 (`b436c7d`) | `browser/regexBench.ts#captureInsertRefusalKey` |
| P207 | `browser.variableGroup.capture.notACapture` | That name is not a named group of the regular expression as it was last tested. | Ese nombre no es un grupo con nombre de la expresión regular tal como se probó por última vez. | 4-22 (`b436c7d`) | `browser/regexBench.ts#captureInsertRefusalKey` |
| P208 | `browser.variableGroup.capture.inserted` | The reference was inserted into {field}. No variable was created. | La referencia se insertó en {field}. No se creó ninguna variable. | 4-22 (`b436c7d`) | `components/VariableGroup.svelte` |
| P209 | `browser.variableParams.readOnly.keyNotNameable` | This parameter’s key is not one plain text, or another parameter has the same key, so it is not edited here. | La clave de este parámetro no es un único texto sin formato, u otro parámetro tiene la misma clave, así que aquí no se edita. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#paramRefusalKey` |
| P210 | `browser.variableParams.readOnly.notText` | This value is not a text or a list of texts (for example a label and id pair), so it is not edited here. | Este valor no es un texto ni una lista de textos (por ejemplo, un par de etiqueta e id), así que aquí no se edita. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#paramRefusalKey` |
| P211 | `browser.variableParams.problem.noItems` | Give at least one item. | Indica al menos un elemento. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#listItemsProblemKey` |
| P212 | `browser.variableParams.problem.emptyItem` | A line between two items is empty. Every line is one item. | Una línea entre dos elementos está vacía. Cada línea es un elemento. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#listItemsProblemKey` |
| P213 | `browser.variableParams.problem.carriageReturn` | An item holds a carriage return, which no box in this window can hold. | Un elemento contiene un retorno de carro, que ninguna caja de esta ventana puede contener. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#listItemsProblemKey` |
| P214 | `browser.variableParams.problem.notAList` | Items can only be added to a list this variable already writes, and only while its controls accept changes. | Solo se pueden añadir elementos a una lista que esta variable ya escribe, y solo mientras sus controles admiten cambios. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#listItemsProblemKey` |
| P215 | `browser.variableParams.problem.structure` | Items cannot be added now: this snippet does not accept structural changes. | Ahora no se pueden añadir elementos: este fragmento no admite cambios estructurales. | 4-14-2 (`1fbbfd8`) | `browser/variableParams.ts#listItemsProblemKey` |
| P216 | `browser.variableParams.value` | Value of {key} | Valor de {key} | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P217 | `browser.variableParams.item` | Item {number} of {key} | Elemento {number} de {key} | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P218 | `browser.variableParams.removeItem` | Take out | Quitar | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P219 | `browser.variableParams.restoreItem` | Keep | Mantener | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P220 | `browser.variableParams.discardItem` | Drop | Descartar | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P221 | `browser.variableParams.removedItem` | Taken out when you save. | Se quita al guardar. | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P222 | `browser.variableParams.newItem` | New, written at the end when you save. | Nuevo; se escribe al final al guardar. | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P223 | `browser.variableParams.newItems` | New items for {key}, one per line, added at the end | Elementos nuevos para {key}, uno por línea, que se añaden al final | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P224 | `browser.variableParams.addItems` | Add these items | Añadir estos elementos | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P225 | `browser.variableParams.flow` | The file writes this list on one line, between brackets; items are added and taken out there. | El archivo escribe esta lista en una sola línea, entre corchetes; los elementos se añaden y se quitan ahí. | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P226 | `browser.variableParams.fixed` | The items of this list are edited here; they are not added or taken out here. | Los elementos de esta lista se editan aquí; aquí no se añaden ni se quitan. | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P227 | `browser.variableParams.lastItem` | The last item stays: a list is never left empty here. | El último elemento se queda: aquí nunca se deja una lista vacía. | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P228 | `browser.variableParams.editRefused` | That text cannot go into this box: it holds a carriage return, or a line break where the box is one line. The box shows what the draft holds. | Ese texto no cabe en esta caja: contiene un retorno de carro, o un salto de línea donde la caja es de una sola línea. La caja muestra lo que contiene el borrador. | 4-14-2 (`1fbbfd8`) | `components/VariableGroup.svelte` |
| P229 | `browser.formEditor.readOnly.notInForm` | This form has no layout, and this editor only changes a layout a form already has, so it is shown and not edited here. | Este formulario no tiene diseño, y este editor solo cambia el diseño que un formulario ya tiene, así que se muestra y no se edita aquí. | 4-10 (`776836e`) | `browser/formEditor.ts#formFieldRefusalKey` |
| P230 | `browser.formEditor.readOnly.optionsNotABlockMapping` | This field does not have this option, and its options are not written one per line, so this app cannot add it here. | Este campo no tiene esta opción, y sus opciones no están escritas una por línea, así que esta aplicación no puede añadirla aquí. | 4-10 (`776836e`) | `browser/formEditor.ts#formFieldRefusalKey` |
| P231 | `browser.formEditor.addition.formNotEditable` | A field cannot be added now: the editor or this form is not accepting changes. | Ahora no se puede añadir un campo: el editor o este formulario no admiten cambios. | 4-10 (`776836e`) | `browser/formEditor.ts#formAdditionRefusalKey` |
| P232 | `browser.formEditor.addition.layoutNotEditable` | The placeholder cannot be put into this layout, because the layout is shown and not edited here. | El marcador no se puede poner en este diseño, porque el diseño se muestra y no se edita aquí. | 4-10 (`776836e`) | `browser/formEditor.ts#formAdditionRefusalKey` |
| P233 | `browser.formEditor.addition.definitionsNotABlockMapping` | A field cannot be added here: this form’s fields are written on one line or are not a list of definitions, and this app adds a field only to definitions written one per line. | Aquí no se puede añadir un campo: los campos de este formulario están escritos en una sola línea o no son una lista de definiciones, y esta aplicación solo añade campos a definiciones escritas una por línea. | 4-10 (`776836e`) | `browser/formEditor.ts#formAdditionRefusalKey` |
| P234 | `browser.formEditor.addition.definitionsUnreadable` | A field cannot be added here: the name of one of this form’s fields could not be read, so a new name cannot be checked against it. | Aquí no se puede añadir un campo: no se pudo leer el nombre de uno de los campos de este formulario, así que no se puede comprobar un nombre nuevo frente a él. | 4-10 (`776836e`) | `browser/formEditor.ts#formAdditionRefusalKey` |
| P235 | `browser.formEditor.addition.unreadableText` | The new field holds a line break a one-line box cannot hold, or a carriage return no box in this window can hold, so it was not added. | El campo nuevo contiene un salto de línea que una caja de una línea no admite, o un retorno de carro que ninguna caja de esta ventana admite, así que no se ha añadido. | 4-10 (`776836e`) | `browser/formEditor.ts#formAdditionRefusalKey` |
| P236 | `browser.formEditor.name.empty` | A field needs a name. | Un campo necesita un nombre. | 4-10 (`776836e`) | `browser/formEditor.ts#formNameRefusalKey` |
| P237 | `browser.formEditor.name.notAnIdentifier` | A field name has to start with a letter or an underscore and hold only letters, digits and underscores, so that it is a placeholder this app can find in the layout. | El nombre de un campo tiene que empezar por una letra o un guion bajo y contener solo letras, dígitos y guiones bajos, para que sea un marcador que esta aplicación pueda encontrar en el diseño. | 4-10 (`776836e`) | `browser/formEditor.ts#formNameRefusalKey` |
| P238 | `browser.formEditor.name.takenByDefinition` | A field of this form already has this name, or had it before the draft took it out. | Un campo de este formulario ya tiene este nombre, o lo tenía antes de que el borrador lo quitara. | 4-10 (`776836e`) | `browser/formEditor.ts#formNameRefusalKey` |
| P239 | `browser.formEditor.name.takenByAddition` | A new field in the draft already has this name. | Un campo nuevo del borrador ya tiene este nombre. | 4-10 (`776836e`) | `browser/formEditor.ts#formNameRefusalKey` |
| P240 | `browser.formEditor.row.noDefinition` | The layout holds this placeholder, and no field definition in the draft names it. | El diseño contiene este marcador, y ninguna definición de campo del borrador lo nombra. | 4-10 (`776836e`) | `browser/formEditor.ts#formRowAdvisoryKey` |
| P241 | `browser.formEditor.row.noOccurrence` | This field is defined, and the layout holds no placeholder for it. | Este campo está definido, y el diseño no contiene ningún marcador para él. | 4-10 (`776836e`) | `browser/formEditor.ts#formRowAdvisoryKey` |
| P242 | `browser.formEditor.row.noOccurrenceUnverified` | This field is defined and no placeholder for it was found, but the layout holds text this app does not read as placeholders, so one may be written in a way it cannot see. | Este campo está definido y no se encontró ningún marcador para él, pero el diseño contiene texto que esta aplicación no lee como marcadores, así que puede haber uno escrito de una forma que no ve. | 4-10 (`776836e`) | `browser/formEditor.ts#formRowAdvisoryKey` |
| P243 | `browser.formEditor.addition.definitionsRemoved` | A field cannot be added while the draft takes out all of this form’s fields. Keep the fields first. | No se puede añadir un campo mientras el borrador quita todos los campos de este formulario. Conserve primero los campos. | 4-12 (`bebd7c2`) | `browser/formEditor.ts#formAdditionRefusalKey` |
| P244 | `browser.formBuilder.heading` | Forms | Formularios | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P245 | `browser.formBuilder.none` | This snippet has no form. A form can be inserted below. | Este fragmento no tiene formulario. Abajo se puede insertar uno. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P246 | `browser.formBuilder.unnamed` | (a name this app could not read) | (un nombre que esta aplicación no pudo leer) | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P247 | `browser.formBuilder.shorthand` | The snippet’s own form (form and form_fields) | El formulario propio del fragmento (form y form_fields) | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P248 | `browser.formBuilder.verbose` | The form in the variable {name} (layout and fields) | El formulario de la variable {name} (layout y fields) | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P249 | `browser.formBuilder.notEditable` | The editor is not accepting changes now. | El editor no admite cambios ahora. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P250 | `browser.formBuilder.close` | Close | Cerrar | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P251 | `browser.formBuilder.selected` | Field {name} | Campo {name} | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P252 | `browser.formBuilder.noRows` | The layout holds no placeholder and the form defines no field. | El diseño no contiene ningún marcador y el formulario no define ningún campo. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P253 | `browser.formBuilder.layout.contentField` | Its layout is the Form layout box above. The placeholders found in it are shown here as you type; typing never adds or removes a field definition. | Su diseño es la casilla Diseño del formulario de arriba. Los marcadores que contiene se muestran aquí mientras escribe; escribir nunca añade ni quita una definición de campo. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P254 | `browser.formBuilder.layout.label` | Layout | Diseño | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P255 | `browser.formBuilder.layout.display` | The layout, with the placeholders this app reads | El diseño, con los marcadores que esta aplicación lee | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P256 | `browser.formBuilder.layout.empty` | is not read as a placeholder: there is no name between the brackets. | no se lee como marcador: no hay ningún nombre entre los corchetes. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#layoutMalformationKey` |
| P257 | `browser.formBuilder.layout.invalidIdentifier` | is not read as a placeholder: the name between the brackets is not written with letters, digits and underscores only. | no se lee como marcador: el nombre entre los corchetes no está escrito solo con letras, dígitos y guiones bajos. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#layoutMalformationKey` |
| P258 | `browser.formBuilder.layout.unterminated` | is not read as a placeholder: these opening brackets are not closed before the next ones. | no se lee como marcador: estos corchetes de apertura no se cierran antes de los siguientes. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#layoutMalformationKey` |
| P259 | `browser.formBuilder.row.occurrences` | Placeholders in the layout: {count} | Marcadores en el diseño: {count} | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P260 | `browser.formBuilder.status.edited` | changed | modificado | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#rowStatusKey` |
| P261 | `browser.formBuilder.status.removed` | taken out | quitado | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#rowStatusKey` |
| P262 | `browser.formBuilder.status.added` | new | nuevo | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#rowStatusKey` |
| P263 | `browser.formBuilder.status.undefined` | no definition | sin definición | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#rowStatusKey` |
| P264 | `browser.formBuilder.kind.heading` | Kind of field | Tipo de campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P265 | `browser.formBuilder.kind.text` | Text | Texto | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#newFieldKindKey` |
| P266 | `browser.formBuilder.kind.choice` | Choice | Elección | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#newFieldKindKey` |
| P267 | `browser.formBuilder.kind.list` | List | Lista | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#newFieldKindKey` |
| P268 | `browser.formBuilder.kind.none` | Text, with no definition | Texto, sin definición | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#newFieldKindKey` |
| P269 | `browser.formBuilder.addField.open` | Add a field | Añadir un campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P270 | `browser.formBuilder.addField.heading` | Add a field | Añadir un campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P271 | `browser.formBuilder.addField.name` | Field name | Nombre del campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P272 | `browser.formBuilder.addField.hint` | Adding puts the placeholder where the layout’s cursor is and adds the field’s definition, as one change that one undo takes back. | Al añadirlo, el marcador se pone donde está el cursor del diseño y se añade la definición del campo, como un solo cambio que se deshace de una vez. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P273 | `browser.formBuilder.addField.add` | Add the field | Añadir el campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P274 | `browser.formBuilder.define.heading` | Define the field {name} | Definir el campo {name} | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P275 | `browser.formBuilder.define.hint` | The layout already holds this placeholder. Defining it adds only its definition; the layout is not changed. | El diseño ya contiene este marcador. Definirlo añade solo su definición; el diseño no cambia. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P276 | `browser.formBuilder.define.add` | Add the definition | Añadir la definición | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P277 | `browser.formBuilder.added.placeholderInserted` | Its placeholder was put into the layout in the same change. | Su marcador se puso en el diseño en el mismo cambio. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P278 | `browser.formBuilder.added.discard` | Drop this new field | Descartar este campo nuevo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P279 | `browser.formBuilder.field.removedNote` | This field’s definition would be taken out. Its placeholders stay in the layout. | La definición de este campo se quitaría. Sus marcadores se quedan en el diseño. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P280 | `browser.formBuilder.field.optionsNotABlockMapping` | This field’s options are not written one per line, so only the options it already has can be changed here. | Las opciones de este campo no están escritas una por línea, así que aquí solo se pueden cambiar las opciones que ya tiene. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P281 | `browser.formBuilder.field.removalPreview` | Taking this field out removes only its definition. Placeholders for it that stay in the layout: {count} | Quitar este campo quita solo su definición. Marcadores suyos que se quedan en el diseño: {count} | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P282 | `browser.formBuilder.field.remove` | Take this field out | Quitar este campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P283 | `browser.formBuilder.field.restore` | Keep this field | Conservar este campo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P284 | `browser.formBuilder.option.absent` | The field does not have this option. Typing in the box adds it; leaving it empty adds nothing. | El campo no tiene esta opción. Escribir en la casilla la añade; dejarla vacía no añade nada. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P285 | `browser.formBuilder.option.suggestions` | Suggestions: | Sugerencias: | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P286 | `browser.formBuilder.option.remove` | Take this option out | Quitar esta opción | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P287 | `browser.formBuilder.option.restore` | Keep this option | Conservar esta opción | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P288 | `browser.formBuilder.option.removed` | This option would be taken out. | Esta opción se quitaría. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P289 | `browser.formBuilder.option.unknown` | not edited here; shown as the file writes it | no se edita aquí; se muestra como la escribe el archivo | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P290 | `browser.formBuilder.values.heading` | Values | Valores | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P291 | `browser.formBuilder.values.lines` | Values, one per line | Valores, uno por línea | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P292 | `browser.formBuilder.values.newLines` | New values, one per line, added at the end | Valores nuevos, uno por línea, que se añaden al final | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P293 | `browser.formBuilder.values.add` | Add these values | Añadir estos valores | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P294 | `browser.formBuilder.values.flow` | The file writes this list on one line, between brackets; values are added and taken out there. | El archivo escribe esta lista en una línea, entre corchetes; los valores se añaden y se quitan ahí. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P295 | `browser.formBuilder.values.removeItem` | Take out | Quitar | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P296 | `browser.formBuilder.values.restoreItem` | Keep | Conservar | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P297 | `browser.formBuilder.values.discardItem` | Drop | Descartar | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P298 | `browser.formBuilder.values.structure` | Values cannot be added now: this snippet does not accept structural changes. | Ahora no se pueden añadir valores: este fragmento no admite cambios estructurales. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P299 | `browser.formBuilder.values.text` | The file writes these values as one text, one value per line. It is edited as that text and is not turned into a list. | El archivo escribe estos valores como un solo texto, un valor por línea. Se edita como ese texto y no se convierte en una lista. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P300 | `browser.formBuilder.values.unsupported` | The file writes these values in a way this app does not edit here. | El archivo escribe estos valores de una forma que esta aplicación no edita aquí. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P301 | `browser.formBuilder.values.notAList` | Values can only be added to a list of values this field already has. | Solo se pueden añadir valores a una lista de valores que el campo ya tenga. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#valuesProblemKey` |
| P302 | `browser.formBuilder.values.noValues` | Give at least one value. | Indique al menos un valor. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#valuesProblemKey` |
| P303 | `browser.formBuilder.values.emptyValue` | A line between two values is empty. Every line is one value. | Una línea entre dos valores está vacía. Cada línea es un valor. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#valuesProblemKey` |
| P304 | `browser.formBuilder.values.unreadableText` | A value holds a carriage return, which no box in this window can hold. | Un valor contiene un retorno de carro, que ninguna casilla de esta ventana puede contener. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#valuesProblemKey` |
| P305 | `browser.formBuilder.removeAll.remove` | Take out all the fields | Quitar todos los campos | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P306 | `browser.formBuilder.removeAll.restore` | Keep the fields | Conservar los campos | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P307 | `browser.formBuilder.removeAll.drafted` | Every field definition of this form would be taken out. The layout and its placeholders stay. | Se quitarían todas las definiciones de campo de este formulario. El diseño y sus marcadores se quedan. | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P308 | `browser.formBuilder.removeAll.noDefinitions` | This form has no field definitions to take out, or they are not written as definitions. | Este formulario no tiene definiciones de campo que quitar, o no están escritas como definiciones. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#removeAllRefusalKey` |
| P309 | `browser.formBuilder.removeAll.additionsPending` | The draft adds a field to this form. Drop the new field before taking out all the fields. | El borrador añade un campo a este formulario. Descarte el campo nuevo antes de quitar todos los campos. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#removeAllRefusalKey` |
| P310 | `browser.formBuilder.removeAll.formNotEditable` | This form is not accepting changes now. | Este formulario no admite cambios ahora. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#removeAllRefusalKey` |
| P311 | `browser.formBuilder.insert.open` | Insert a form | Insertar un formulario | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P312 | `browser.formBuilder.insert.heading` | Insert a form | Insertar un formulario | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P313 | `browser.formBuilder.insert.name` | Name of the new form variable | Nombre de la nueva variable de formulario | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P314 | `browser.formBuilder.insert.reference` | Reference it in the text | Referenciarlo en el texto | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P315 | `browser.formBuilder.insert.target` | Insert the references into | Insertar las referencias en | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P316 | `browser.formBuilder.insert.written` | What will be inserted: | Lo que se insertará: | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P317 | `browser.formBuilder.insert.insert` | Insert | Insertar | 4-12 (`bebd7c2`) | `components/FormBuilder.svelte` |
| P318 | `browser.formBuilder.insert.noTarget` | No text of this snippet can take a reference now: it needs a replacement text, Markdown or HTML that it already has. A snippet whose content is a form gets its fields from Add a field instead. | Ningún texto de este fragmento puede recibir una referencia ahora: necesita un texto de sustitución, Markdown o HTML que ya tenga. Un fragmento cuyo contenido es un formulario obtiene sus campos con Añadir un campo. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#formInsertionProblemKey` |
| P319 | `browser.formBuilder.insert.noLayout` | Write the form’s layout first. | Escriba primero el diseño del formulario. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#formInsertionProblemKey` |
| P320 | `browser.formBuilder.insert.unreadableLayout` | The layout holds a carriage return, which no box in this window can hold. | El diseño contiene un retorno de carro, que ninguna casilla de esta ventana puede contener. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#formInsertionProblemKey` |
| P321 | `browser.formBuilder.insert.noPlaceholder` | The layout holds no placeholder this app reads, written as the field’s name between double square brackets. | El diseño no contiene ningún marcador que esta aplicación lea, escrito como el nombre del campo entre dobles corchetes. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#formInsertionProblemKey` |
| P322 | `browser.formBuilder.insert.noReference` | Choose at least one field to reference in the text. | Elija al menos un campo que referenciar en el texto. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#formInsertionProblemKey` |
| P323 | `browser.formBuilder.insert.values` | The values of the field {name} cannot be used: give one value per line, with no empty line between them. | Los valores del campo {name} no se pueden usar: indique un valor por línea, sin líneas vacías entre ellos. | 4-12 (`bebd7c2`) | `browser/formBuilder.ts#formInsertionProblemKey` |
| P324 | `browser.recovery.unavailable.variablesNotCarried` | A new snippet cannot be created from this draft: it has variables or form fields, and a new snippet is created without them, so its references would lose what they refer to. Copy your text or compare it with the version on disk, then keep editing or discard the draft. Nothing was written. | No se puede crear un fragmento nuevo a partir de este borrador: tiene variables o campos de formulario, y un fragmento nuevo se crea sin ellos, así que sus referencias perderían aquello a lo que se refieren. Copia tu texto o compáralo con la versión del disco, y después sigue editando o descarta el borrador. No se ha escrito nada. | 4-9 (`2475308`) | `browser/recovery.ts#recoveryUnavailableKey` |
| P325 | `code.commandError.candidateRefused` | espansoConfig could not judge this change, so it wrote nothing. What it reports beside this is the reason. | espansoConfig no pudo evaluar este cambio, así que no escribió nada. Lo que se indica junto a esto es el motivo. | 4-8 (`e3cb1da`) | `i18n/codes.ts#commandErrorKey` (template `code.commandError.${…}`) |
| P326 | `code.findingCode.variableDependencyCycle` | This change puts the variable “{name}” in a dependency cycle (variables involved: {size}), as espansoConfig reads depends_on and the references inside parameters. espansoConfig cannot determine how espanso will evaluate it. | Este cambio deja la variable «{name}» en un ciclo de dependencias (variables implicadas: {size}), según lee espansoConfig depends_on y las referencias dentro de los parámetros. espansoConfig no puede determinar cómo lo evaluará espanso. | 4-7 (`250f1be`) | `i18n/codes.ts#findingCodeKey` (template `code.findingCode.${…}`) |
| P327 | `code.findingCode.dependencyHasNoDeclaration` | This change makes a variable depend on “{name}”, and nothing this app can see declares a variable of that name. | Este cambio hace que una variable dependa de «{name}», y nada de lo que esta aplicación puede ver declara una variable con ese nombre. | 4-7 (`250f1be`) | `i18n/codes.ts#findingCodeKey` (template `code.findingCode.${…}`) |
| P328 | `code.incompleteReason.importsOpenScope` | This file imports other files, which may declare more names, so this analysis cannot list every visible name. | Este archivo importa otros archivos, que pueden declarar más nombres, así que este análisis no puede enumerar todos los nombres visibles. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P329 | `code.incompleteReason.globalVarsUnreadable` | espansoConfig could not read this file’s global variables, so their names are unknown to this analysis. | espansoConfig no pudo leer las variables globales de este archivo, así que este análisis desconoce sus nombres. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P330 | `code.incompleteReason.localVarsUnreadable` | espansoConfig could not read this snippet’s variables, so their names are unknown to this analysis. | espansoConfig no pudo leer las variables de este fragmento, así que este análisis desconoce sus nombres. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P331 | `code.incompleteReason.regexCapturesUnknown` | espansoConfig could not read the named groups of this snippet’s regex trigger, so the names they provide are unknown to this analysis. | espansoConfig no pudo leer los grupos con nombre del disparador regex de este fragmento, así que este análisis desconoce los nombres que aportan. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P332 | `code.incompleteReason.duplicateDeclaration` | Several variables here share one name, so a reference to that name is not linked to any of them. | Aquí varias variables comparten un mismo nombre, así que una referencia a ese nombre no se vincula con ninguna de ellas. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P333 | `code.incompleteReason.nameUnreadable` | A variable here has no name espansoConfig could read, so references to it cannot be counted. | Aquí hay una variable sin un nombre que espansoConfig pueda leer, así que no se pueden contar las referencias a ella. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P334 | `code.incompleteReason.localNameUnreadable` | A variable of this snippet writes a name espansoConfig could not read, so the set of names in this snippet is not known completely. | Una variable de este fragmento escribe un nombre que espansoConfig no pudo leer, así que no se conoce por completo el conjunto de nombres de este fragmento. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P335 | `code.incompleteReason.globalNameUnreadable` | A global variable of this file writes a name espansoConfig could not read, so the set of global names is not known completely. | Una variable global de este archivo escribe un nombre que espansoConfig no pudo leer, así que no se conoce por completo el conjunto de nombres globales. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P336 | `code.incompleteReason.dependsOnUnreadable` | A variable’s depends_on is not a list espansoConfig can read, so its explicit dependencies are unknown. | El depends_on de una variable no es una lista que espansoConfig pueda leer, así que se desconocen sus dependencias explícitas. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P337 | `code.incompleteReason.paramsUnreadable` | A variable’s parameters hold something espansoConfig does not read (an alias, a merge key or an elided value), so some references in them were not counted. | Los parámetros de una variable contienen algo que espansoConfig no lee (un alias, una clave de fusión o un valor omitido), así que algunas referencias en ellos no se contaron. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P338 | `code.incompleteReason.injectionUncertain` | A variable writes inject_vars in a spelling espansoConfig does not recognise as on or off, so references in its parameters are neither counted nor ruled out. | Una variable escribe inject_vars de una forma que espansoConfig no reconoce como activada ni desactivada, así que las referencias en sus parámetros ni se cuentan ni se descartan. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P339 | `code.incompleteReason.layoutUnavailable` | A form layout referred to here is not text espansoConfig can read, so its fields cannot be checked. | Un diseño de formulario al que se hace referencia aquí no es texto que espansoConfig pueda leer, así que no se pueden comprobar sus campos. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P340 | `code.incompleteReason.layoutUnsupported` | A form layout referred to here uses syntax outside the placeholder form espansoConfig reads, so a field cannot be said to be missing from it. | Un diseño de formulario al que se hace referencia aquí usa una sintaxis fuera de la forma de marcador que lee espansoConfig, así que no se puede afirmar que le falte un campo. | 4-8 (`e3cb1da`) | `i18n/codes.ts#incompleteReasonKey` (template `code.incompleteReason.${…}`) |
| P341 | `code.injection.enabled` | References in parameters are used | Se usan las referencias en los parámetros | 4-8 (`e3cb1da`) | `i18n/codes.ts#injectionKey` (template `code.injection.${…}`) |
| P342 | `code.injection.disabled` | References in parameters are not used | No se usan las referencias en los parámetros | 4-8 (`e3cb1da`) | `i18n/codes.ts#injectionKey` (template `code.injection.${…}`) |
| P343 | `code.injection.uncertain` | Unclear whether references in parameters are used | No está claro si se usan las referencias en los parámetros | 4-8 (`e3cb1da`) | `i18n/codes.ts#injectionKey` (template `code.injection.${…}`) |
| P344 | `code.edgeKind.explicit` | Declared in depends_on | Declarada en depends_on | 4-8 (`e3cb1da`) | `i18n/codes.ts#edgeKindKey` (template `code.edgeKind.${…}`) |
| P345 | `code.edgeKind.inferred` | Inferred from a reference in a parameter | Deducida de una referencia en un parámetro | 4-8 (`e3cb1da`) | `i18n/codes.ts#edgeKindKey` (template `code.edgeKind.${…}`) |
| P346 | `code.malformedPlaceholder.empty` | Nothing between the brackets | No hay nada entre los corchetes | 4-8 (`e3cb1da`) | `i18n/codes.ts#malformedPlaceholderKey` (template `code.malformedPlaceholder.${…}`) |
| P347 | `code.malformedPlaceholder.invalidIdentifier` | Not a field name espansoConfig reads between the brackets | Lo que hay entre los corchetes no es un nombre de campo que lea espansoConfig | 4-8 (`e3cb1da`) | `i18n/codes.ts#malformedPlaceholderKey` (template `code.malformedPlaceholder.${…}`) |
| P348 | `code.malformedPlaceholder.unterminated` | Opening brackets with no closing brackets | Corchetes de apertura sin corchetes de cierre | 4-8 (`e3cb1da`) | `i18n/codes.ts#malformedPlaceholderKey` (template `code.malformedPlaceholder.${…}`) |
| P349 | `code.previewUnresolved.unknownName` | No declaration this application can see carries this name, so the preview leaves the reference as written. | Ninguna declaración que esta aplicación pueda ver lleva este nombre, así que la vista previa deja la referencia tal como está escrita. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P350 | `code.previewUnresolved.ambiguousName` | Several declarations carry this name, so the preview does not pick one. | Varias declaraciones llevan este nombre, así que la vista previa no elige ninguna. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P351 | `code.previewUnresolved.cycle` | This variable is part of a dependency cycle as espansoConfig reads it, so the preview does not evaluate it. | Esta variable forma parte de un ciclo de dependencias tal como lo lee espansoConfig, así que la vista previa no la evalúa. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P352 | `code.previewUnresolved.depthLimit` | This value needs a longer chain of variables than the preview follows. | Este valor necesita una cadena de variables más larga de la que sigue la vista previa. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P353 | `code.previewUnresolved.workLimit` | The preview stopped evaluating values here because it reached its work limit. | La vista previa dejó de evaluar valores aquí porque alcanzó su límite de trabajo. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P354 | `code.previewUnresolved.missingSample` | Choose an example value to preview this. | Elige un valor de ejemplo para verlo en la vista previa. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P355 | `code.previewUnresolved.sampleOutOfRange` | The chosen example is not in this list. | El ejemplo elegido no está en esta lista. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P356 | `code.previewUnresolved.formIsNotAScalar` | A form holds several fields, not one text; the preview shows a form only through one of its fields. | Un formulario contiene varios campos, no un solo texto; la vista previa muestra un formulario solo a través de uno de sus campos. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P357 | `code.previewUnresolved.fieldNotInLayout` | This field is not found in the form's layout as espansoConfig reads it, and no example value was given. | Este campo no aparece en el diseño del formulario tal como lo lee espansoConfig, y no se dio ningún valor de ejemplo. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P358 | `code.previewUnresolved.subnameUnsupported` | Only a form's fields can be named after a dot, and this variable is not a form. | Solo los campos de un formulario pueden nombrarse tras un punto, y esta variable no es un formulario. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P359 | `code.previewUnresolved.injectionUncertain` | This variable's inject_vars setting is written in a way espansoConfig cannot read as on or off, so the preview does not resolve its references. | El ajuste inject_vars de esta variable está escrito de una forma que espansoConfig no puede leer como activado ni como desactivado, así que la vista previa no resuelve sus referencias. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P360 | `code.previewUnresolved.valueUnreadable` | The preview cannot read the text this value needs, as the file writes it. | La vista previa no puede leer el texto que necesita este valor, tal como lo escribe el archivo. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P361 | `code.previewUnresolved.ambiguousScalar` | This value is written unquoted in a way YAML may read as something other than text, so the preview does not guess. | Este valor está escrito sin comillas de una forma que YAML puede leer como algo distinto de un texto, así que la vista previa no adivina. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P362 | `code.previewUnresolved.dateInstantMissing` | Choose an example date and time to preview this date. | Elige una fecha y hora de ejemplo para ver esta fecha en la vista previa. | 4-18 (`e53d520`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P363 | `code.previewUnresolved.dateFormatMalformed` | This date format is not one the preview can read: check each % sign and the letter after it. | Este formato de fecha no es uno que la vista previa pueda leer: revisa cada signo % y la letra que lo sigue. | 4-18 (`e53d520`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P364 | `code.previewUnresolved.dateOffsetMalformed` | The preview reads a date offset only when it is written as a whole number of seconds without quotes, such as 3600 or -86400. | La vista previa solo lee el desplazamiento de una fecha cuando está escrito como un número entero de segundos sin comillas, como 3600 o -86400. | 4-18 (`e53d520`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P365 | `code.previewUnresolved.dateOutOfRange` | This date, with its offset, falls outside the range of dates the preview can write. | Esta fecha, con su desplazamiento, queda fuera del intervalo de fechas que la vista previa puede escribir. | 4-18 (`e53d520`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P366 | `code.previewUnresolved.zoneUnsupported` | The preview does not know this time zone. Use a name from the IANA time zone database, such as Europe/Madrid. | La vista previa no conoce esta zona horaria. Usa un nombre de la base de datos de zonas horarias de IANA, como Europe/Madrid. | 4-18 (`e53d520`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P367 | `code.previewUnresolved.localeUnsupported` | This date format uses day or month names, AM/PM markers, a decimal separator or a locale's own date layout, which depend on a language the preview does not simulate. Day and month names and decimal separators are shown only for a regional English locale whose data is English, such as en_US. | Este formato de fecha usa nombres de días o meses, marcas AM/PM, un separador decimal o la disposición de fecha propia de un idioma, que dependen de un idioma que la vista previa no simula. Los nombres de días y meses y los separadores decimales solo se muestran con un idioma (locale) inglés regional cuyos datos están en inglés, como en_US. | 4-18 (`e53d520`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P368 | `code.previewUnresolved.kindNotPreviewed` | The preview does not know this variable's type. | La vista previa no conoce el tipo de esta variable. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P369 | `code.previewUnresolved.unverifiedLayoutReference` | A reference inside a form layout: what it becomes when espanso loads the form is not established, so the preview does not resolve it. | Una referencia dentro del diseño de un formulario: no está establecido en qué se convierte cuando espanso carga el formulario, así que la vista previa no la resuelve. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P370 | `code.previewUnresolved.unsupportedLayoutSyntax` | This part of the layout is outside the field syntax espansoConfig reads. | Esta parte del diseño queda fuera de la sintaxis de campos que lee espansoConfig. | 4-17 (`c424d69`) | `i18n/codes.ts#previewUnresolvedKey` (template `code.previewUnresolved.${…}`) |
| P371 | `code.previewPlaceholder.clipboard` | The clipboard's contents when the snippet expands. This application never reads the clipboard. | El contenido del portapapeles cuando se expande el fragmento. Esta aplicación nunca lee el portapapeles. | 4-17 (`c424d69`) | `i18n/codes.ts#previewPlaceholderKey` (template `code.previewPlaceholder.${…}`) |
| P372 | `code.previewPlaceholder.shell` | The output of this shell command. espanso may run it when the snippet expands; this application does not run it. | La salida de este comando de shell. espanso puede ejecutarlo cuando se expande el fragmento; esta aplicación no lo ejecuta. | 4-17 (`c424d69`) | `i18n/codes.ts#previewPlaceholderKey` (template `code.previewPlaceholder.${…}`) |
| P373 | `code.previewPlaceholder.script` | The output of this script. espanso may run it when the snippet expands; this application does not run it. | La salida de este script. espanso puede ejecutarlo cuando se expande el fragmento; esta aplicación no lo ejecuta. | 4-17 (`c424d69`) | `i18n/codes.ts#previewPlaceholderKey` (template `code.previewPlaceholder.${…}`) |
| P374 | `code.previewPlaceholder.match` | The expansion of another snippet, which this preview does not render. | La expansión de otro fragmento, que esta vista previa no genera. | 4-17 (`c424d69`) | `i18n/codes.ts#previewPlaceholderKey` (template `code.previewPlaceholder.${…}`) |
| P375 | `code.previewLimit.outputBytes` | The preview is longer than what it shows: it stops at its size limit. | La vista previa es más larga de lo que muestra: se detiene en su límite de tamaño. | 4-17 (`c424d69`) | `i18n/codes.ts#previewLimitKey` (template `code.previewLimit.${…}`) |
| P376 | `code.previewLimit.segments` | The preview has more pieces than it shows: it stops at its limit. | La vista previa tiene más partes de las que muestra: se detiene en su límite. | 4-17 (`c424d69`) | `i18n/codes.ts#previewLimitKey` (template `code.previewLimit.${…}`) |
| P377 | `code.previewLimit.work` | The preview reached its work limit, so some values are not shown. | La vista previa alcanzó su límite de trabajo, así que algunos valores no se muestran. | 4-17 (`c424d69`) | `i18n/codes.ts#previewLimitKey` (template `code.previewLimit.${…}`) |
| P378 | `code.regexRefusal.patternTooLarge` | This pattern is longer than the regex test accepts, so it was not tried. | Este patrón es más largo de lo que admite la prueba de expresiones regulares, así que no se ha probado. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexRefusalKey` (template `code.regexRefusal.${…}`) |
| P379 | `code.regexRefusal.sampleTooLarge` | This sample text is longer than the regex test accepts, so the pattern was not tried on it. | Este texto de ejemplo es más largo de lo que admite la prueba de expresiones regulares, así que el patrón no se ha probado con él. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexRefusalKey` (template `code.regexRefusal.${…}`) |
| P380 | `code.regexRefusal.captureLimit` | This pattern names more groups than the regex test accepts, so it was not tried. | Este patrón nombra más grupos de los que admite la prueba de expresiones regulares, así que no se ha probado. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexRefusalKey` (template `code.regexRefusal.${…}`) |
| P381 | `code.regexRefusal.compileRejected` | This regular expression did not compile under the version espansoConfig uses. | Esta expresión regular no compiló con la versión que usa espansoConfig. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexRefusalKey` (template `code.regexRefusal.${…}`) |
| P382 | `code.regexRefusal.outputLimit` | The match is too long for the regex test to show, so it is not shown. | La coincidencia es demasiado larga para que la prueba de expresiones regulares la muestre, así que no se muestra. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexRefusalKey` (template `code.regexRefusal.${…}`) |
| P383 | `code.regexCompileFailure.syntax` | The pattern is not valid syntax for the version espansoConfig uses. | El patrón no tiene una sintaxis válida para la versión que usa espansoConfig. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexCompileFailureKey` (template `code.regexCompileFailure.${…}`) |
| P384 | `code.regexCompileFailure.compiledTooBig` | The pattern would compile to a program larger than the regex test allows. | El patrón se compilaría en un programa más grande de lo que permite la prueba de expresiones regulares. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexCompileFailureKey` (template `code.regexCompileFailure.${…}`) |
| P385 | `code.regexCompileFailure.other` | The pattern was refused for a reason the regex test does not recognise. | El patrón se rechazó por un motivo que la prueba de expresiones regulares no reconoce. | 4-21 (`3cb45d8`) | `i18n/codes.ts#regexCompileFailureKey` (template `code.regexCompileFailure.${…}`) |
| P386 | `code.draftError.optionNotPlainSource` | The text for {field} is empty or cannot be written as it was typed without quotes, so nothing was written. Enter it without quotes, comments or line breaks, or remove the option. | El texto de {field} está vacío o no se puede escribir tal como se tecleó sin comillas, así que no se escribió nada. Escríbelo sin comillas, comentarios ni saltos de línea, o quita la opción. | 4-1 (`fdb0ab7`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P387 | `code.draftError.newKeyIsEmpty` | A new parameter, form field or option was given no name, so nothing was written. | Un parámetro, campo de formulario u opción nuevo no tiene nombre, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P388 | `code.draftError.newKeyHasALineBreak` | A new name — of a parameter, a form field or an option — holds a line break, which a name cannot hold, so nothing was written. | Un nombre nuevo —de un parámetro, un campo de formulario o una opción— contiene un salto de línea, que un nombre no puede contener, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P389 | `code.draftError.newKeyHasAControlCharacter` | A new name — of a parameter, a form field or an option — holds a tab or another invisible control character, so nothing was written. | Un nombre nuevo —de un parámetro, un campo de formulario o una opción— contiene un tabulador u otro carácter de control invisible, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P390 | `code.draftError.newKeyIsAMergeKey` | “<<” has a special meaning as a key in these files and cannot name a new parameter, form field or option, so nothing was written. | «<<» tiene un significado especial como clave en estos archivos y no puede dar nombre a un parámetro, campo de formulario u opción nuevo, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P391 | `code.draftError.newKeyDuplicatesAnEntry` | That place already holds an entry with that name — a parameter of the variable, a field of the form or an option of the field — however either name is quoted, so nothing was written. | Ese lugar ya tiene una entrada con ese nombre —un parámetro de la variable, un campo del formulario o una opción del campo—, lleve comillas o no cualquiera de los dos, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P392 | `code.draftError.newKeyDuplicatesAnInsertion` | Two new entries in the same place were given the same name, so nothing was written. | Dos entradas nuevas en el mismo lugar tienen el mismo nombre, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P393 | `code.draftError.newKeyCannotBeCompared` | One of the entries already in that place has a name espansoConfig cannot read as text, so it cannot tell whether a new name repeats it. Nothing was written. | Una de las entradas que ya hay en ese lugar tiene un nombre que espansoConfig no puede leer como texto, así que no puede saber si un nombre nuevo lo repite. No se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P394 | `code.draftError.paramsAbsent` | This variable has no block of parameters yet, and one cannot be added here, so nothing was written. | Esta variable todavía no tiene un bloque de parámetros, y aquí no se puede añadir uno, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P395 | `code.draftError.paramsIsAFlowMapping` | This variable’s parameters are written between braces, and espansoConfig does not add entries inside braces, so nothing was written. | Los parámetros de esta variable están escritos entre llaves, y espansoConfig no añade entradas dentro de llaves, así que no se escribió nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P396 | `code.draftError.paramsHasAnUnsupportedShape` | This variable’s parameters are written as something other than a block of keys, so nothing can be added to them. | Los parámetros de esta variable están escritos como algo que no es un bloque de claves, así que no se les puede añadir nada. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P397 | `code.draftError.paramsWouldBeEmpty` | This would remove every parameter of the variable and leave an empty entry behind, so nothing was written. Keep at least one. | Esto quitaría todos los parámetros de la variable y dejaría una entrada vacía, así que no se escribió nada. Deja al menos uno. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P398 | `code.draftError.noParamInsertionAnchor` | The new parameter has no remaining entry to be written after, because the entries around it are being removed. Save the removal first, then add it. | El parámetro nuevo no tiene ninguna entrada restante detrás de la cual escribirse, porque se están quitando las de su alrededor. Guarda primero la eliminación y añádelo después. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P399 | `code.draftError.newKeyIsATypedSetting` | This name is one this app would write as text rather than as a number or a switch, and that would change its meaning, so nothing was written. Add it in this file’s text instead. | Este nombre es uno que esta aplicación escribiría como texto y no como número o interruptor, y eso cambiaría su significado, así que no se escribió nada. Añádelo en el texto de este archivo. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P400 | `code.draftError.insertionKeyAlreadyPresent` | A change adds an entry under a name its block already holds. That is a fault in this app. | Un cambio añade una entrada con un nombre que su bloque ya tiene. Es un fallo de esta aplicación. | 4-3 (`c986a3d`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P401 | `code.draftError.varsIntentsConflict` | Two changes to this snippet’s variables say different things about them, so it is not clear which was meant. Nothing was written. | Dos cambios a las variables de este fragmento dicen cosas distintas sobre ellas, así que no está claro cuál se quería. No se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P402 | `code.draftError.varsIsAFlowList` | This snippet’s variables are written between brackets, and espansoConfig does not add, remove or move variables inside brackets, so nothing was written. | Las variables de este fragmento están escritas entre corchetes, y espansoConfig no añade, quita ni mueve variables dentro de corchetes, así que no se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P403 | `code.draftError.varsHasAnUnsupportedShape` | This snippet’s variables are written as something other than a list, so nothing was written. | Las variables de este fragmento están escritas como algo que no es una lista, así que no se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P404 | `code.draftError.varsWouldBeEmpty` | This would take every variable out of the snippet. To have no variables at all, remove all of them together instead. | Esto quitaría todas las variables del fragmento. Para no tener ninguna variable, quítalas todas juntas. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P405 | `code.draftError.noVarsInsertionAnchor` | This snippet has no entry the new variables could be written after, so nothing was written. | Este fragmento no tiene ninguna entrada tras la cual escribir las variables nuevas, así que no se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P406 | `code.draftError.newVariableNameIsEmpty` | A new variable was given no name, so nothing was written. | Una variable nueva no tiene nombre, así que no se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P407 | `code.draftError.newVariableNameIsNotOneLine` | A new variable’s name holds a line break or another invisible control character, which a name cannot hold, so nothing was written. | El nombre de una variable nueva contiene un salto de línea u otro carácter de control invisible, que un nombre no puede contener, así que no se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P408 | `code.draftError.newVariableNameDuplicatesAVariable` | The snippet already has a variable with that name, so nothing was written. Choose another name. | El fragmento ya tiene una variable con ese nombre, así que no se escribió nada. Elige otro nombre. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P409 | `code.draftError.newVariableNameDuplicatesAnInsertion` | Two new variables were given the same name, so nothing was written. | Dos variables nuevas tienen el mismo nombre, así que no se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P410 | `code.draftError.newVariableNameCannotBeCompared` | One of the snippet’s variables has a name espansoConfig cannot read as text, so it cannot tell whether a new name repeats it. Nothing was written. | Una de las variables del fragmento tiene un nombre que espansoConfig no puede leer como texto, así que no puede saber si un nombre nuevo lo repite. No se escribió nada. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P411 | `code.draftError.newVariableSettingNotPlainSource` | The text for {setting} is empty or cannot be written as it was typed without quotes, so nothing was written. Enter it without quotes, comments or line breaks, or leave it out. | El texto de {setting} está vacío o no se puede escribir tal como se tecleó sin comillas, así que no se escribió nada. Escríbelo sin comillas, comentarios ni saltos de línea, o déjalo fuera. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P412 | `code.draftError.newVariableHasTooManyParams` | A new variable can be created with at most {limit} extra parameters, so nothing was written. Add the rest in this file’s text. | Una variable nueva se puede crear con un máximo de {limit} parámetros adicionales, así que no se escribió nada. Añade el resto en el texto de este archivo. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P413 | `code.draftError.newKeyIsAKindParameter` | An extra parameter of the new variable uses a name that its type already sets through its own field, so nothing was written. Use that field instead. | Un parámetro adicional de la variable nueva usa un nombre que su tipo ya fija con su propio campo, así que no se escribió nada. Usa ese campo. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P414 | `code.draftError.insertionLandsOnARemoval` | A change adds an item exactly where another change removes one. That is a fault in this app. | Un cambio añade un elemento justo donde otro cambio quita uno. Es un fallo de esta aplicación. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P415 | `code.draftError.variableMoveChangesNothing` | The variable is already in that place, so there is nothing to move. | La variable ya está en ese lugar, así que no hay nada que mover. | 4-4 (`d028708`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P416 | `code.draftError.variableListIntentsConflict` | Two changes to this variable’s {list} say different things about it, so it is not clear which was meant. Nothing was written. | Dos cambios en la lista {list} de esta variable dicen cosas distintas, así que no está claro cuál se quería. No se escribió nada. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P417 | `code.draftError.variableListAbsent` | This variable has no {list} list, and one cannot be added here, so nothing was written. | Esta variable no tiene la lista {list}, y aquí no se puede añadir, así que no se escribió nada. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P418 | `code.draftError.variableListHasAnUnsupportedShape` | This variable’s {list} is written as something other than a list, so its items cannot be changed here. | La entrada {list} de esta variable está escrita como algo que no es una lista, así que aquí no se pueden cambiar sus elementos. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P419 | `code.draftError.variableListIsAFlowList` | This variable’s {list} is written between brackets, and espansoConfig adds and removes only plain text inside brackets, never a labelled choice, so nothing was written. | La lista {list} de esta variable está escrita entre corchetes, y espansoConfig solo añade y quita texto simple dentro de corchetes, nunca una opción con etiqueta, así que no se escribió nada. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P420 | `code.draftError.variableListIsNotOfItsKind` | This variable’s type has no {list} list, so nothing was written. | El tipo de esta variable no tiene lista {list}, así que no se escribió nada. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P421 | `code.draftError.variableListWouldBeEmpty` | This would take every item out of this variable’s {list}, so nothing was written. Keep at least one. | Esto quitaría todos los elementos de la lista {list} de esta variable, así que no se escribió nada. Deja al menos uno. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P422 | `code.draftError.variableListItemShapeMismatch` | The new items are not of the kind this variable’s {list} holds: a list of plain choices takes plain text, and a list of labelled choices takes a label and an id. Nothing was written. | Los elementos nuevos no son del tipo que guarda la lista {list} de esta variable: una lista de opciones simples admite texto, y una de opciones con etiqueta admite una etiqueta y un id. No se escribió nada. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P423 | `code.draftError.notAChoiceRecord` | That item of the list is not a labelled choice, so it has no label or id to change. | Ese elemento de la lista no es una opción con etiqueta, así que no tiene etiqueta ni id que cambiar. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P424 | `code.draftError.choiceRecordFieldHasNoScalar` | That labelled choice holds no single value under that key, so there is nothing there to replace. | Esa opción con etiqueta no tiene un único valor bajo esa clave, así que no hay nada que sustituir. | 4-5 (`6f92dea`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P425 | `code.draftError.formIntentsConflict` | Two changes to this form’s fields say different things about them, so it is not clear which was meant. Nothing was written. | Dos cambios en los campos de este formulario dicen cosas distintas sobre ellos, así que no está claro cuál se quería. No se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P426 | `code.draftError.variableIsNotAForm` | This variable is not a form, so it has no form fields to change. Nothing was written. | Esta variable no es un formulario, así que no tiene campos de formulario que cambiar. No se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P427 | `code.draftError.formFieldsIsAFlowMapping` | This form’s fields are written between braces, and espansoConfig does not add or remove fields inside braces, so nothing was written. | Los campos de este formulario están escritos entre llaves, y espansoConfig no añade ni quita campos dentro de llaves, así que no se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P428 | `code.draftError.formFieldsHasAnUnsupportedShape` | This form’s fields are written as something other than a block of keys, so nothing was written. | Los campos de este formulario están escritos como algo que no es un bloque de claves, así que no se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P429 | `code.draftError.formFieldsWouldBeEmpty` | This would take every field out of the form. To have no field definitions at all, remove all of them together instead. | Esto quitaría todos los campos del formulario. Para no tener ninguna definición de campo, quítalas todas juntas. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P430 | `code.draftError.noFormFieldInsertionAnchor` | The new field has no remaining field to be written after, because the fields around it are being removed or changed. Save those changes first, then add it. | El campo nuevo no tiene ningún campo restante detrás del cual escribirse, porque se están quitando o cambiando los de su alrededor. Guarda primero esos cambios y añádelo después. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P431 | `code.draftError.formFieldOptionsAreNotABlockMapping` | This field’s options are written between braces or as a single value, and espansoConfig does not add options there, so nothing was written. | Las opciones de este campo están escritas entre llaves o como un único valor, y espansoConfig no añade opciones ahí, así que no se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P432 | `code.draftError.formFieldWouldHaveNoOptions` | This would remove every option of the field and leave an empty entry behind, so nothing was written. Keep at least one, or remove the field itself. | Esto quitaría todas las opciones del campo y dejaría una entrada vacía, así que no se escribió nada. Deja al menos una, o quita el campo entero. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P433 | `code.draftError.noFormOptionInsertionAnchor` | The new option has no remaining option to be written after, because the options around it are being removed or changed. Save those changes first, then add it. | La opción nueva no tiene ninguna opción restante detrás de la cual escribirse, porque se están quitando o cambiando las de su alrededor. Guarda primero esos cambios y añádela después. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P434 | `code.draftError.newFormOptionNotPlainSource` | The text for {setting} is empty or cannot be written as it was typed without quotes, so nothing was written. Enter it without quotes, comments or line breaks, or leave it out. | El texto de {setting} está vacío o no se puede escribir tal como se tecleó sin comillas, así que no se escribió nada. Escríbelo sin comillas, comentarios ni saltos de línea, o déjalo fuera. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P435 | `code.draftError.newKeyIsAFormOption` | An extra option of the field uses a name the field already sets through its own control, so nothing was written. Use that control instead. | Una opción adicional del campo usa un nombre que el campo ya fija con su propio control, así que no se escribió nada. Usa ese control. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P436 | `code.draftError.newFormFieldHasTooManyOptions` | A field can be given at most {limit} extra options at once, so nothing was written. Add the rest in this file’s text. | A un campo se le pueden dar como máximo {limit} opciones adicionales a la vez, así que no se escribió nada. Añade el resto en el texto de este archivo. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P437 | `code.draftError.formValuesAbsent` | This field has no list of values to add to or take from, so nothing was written. | Este campo no tiene una lista de valores a la que añadir o de la que quitar, así que no se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P438 | `code.draftError.formValuesIsNotAList` | This field’s values are written as text, one per line, not as a list, so they are edited as that text. Nothing was written. | Los valores de este campo están escritos como texto, uno por línea, y no como lista, así que se editan como ese texto. No se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P439 | `code.draftError.formValuesWouldBeEmpty` | This would take every value out of the field’s list, so nothing was written. Keep at least one. | Esto quitaría todos los valores de la lista del campo, así que no se escribió nada. Deja al menos uno. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P440 | `code.draftError.formValuesIntentsConflict` | Two changes to this field’s values say different things about them, so it is not clear which was meant. Nothing was written. | Dos cambios en los valores de este campo dicen cosas distintas sobre ellos, así que no está claro cuál se quería. No se escribió nada. | 4-6 (`dab5ee1`) | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |

## 4. The corrected carried records (E1 … E6)

### 4.1 E1 — 53 vs 54 keys in `3-11-2-notes.md`

**Corrected.** `3-11-2-notes.md` §1.5 said "53 new keys … `browser.bulkInspector.*` (46, of which 7 are
`count.*`)". Commit `fc728ec`'s `en.json` holds **47** `browser.bulkInspector.*` keys (7 of them `count.*`)
and its parent holds none of either namespace (`git show fc728ec:src/lib/i18n/en.json | rg -c …`), and
§3.1's Phase 3 run attributes **54** to 3-11-2. The sentence now reads 54 and 47 with a dated pointer here.
`3-15-2-notes.md` §8 item 1, which reported the disagreement, was true when written and is not edited.

### 4.2 E2 — `PROGRESS.md`'s R38 row omits Phase 3's touches

**Written here and handed to the orchestrator** (§4.5); `PROGRESS.md` was not edited. Verified: the R38 row
still ends *"… so the window half stays open for 2d-7"* and names neither 2d-7-7's viewer readings nor
Phase 3's four ruling-31 touches. Its opening clause, *"none of the fifteen corpus fixtures … has ever been
through the harness"*, is also no longer true as a statement about windows. **Proposed replacement for the
row's last sentence**, for the orchestrator's next edit of `PROGRESS.md`:

> **Narrowed at 2d-5-7b** (delivery only: a CRLF block-scalar fixture through a real launch, `L05`). 2d-7-7
> read the fifteen in the viewer (CF-50; the panel/refresh half, R38-c, stays unread). **Phase 3 made four
> deliberate touches under its ruling 31** — 3-5 (a `|` block-scalar content conflict), 3-6 (the commented
> multi-line flow list, drawn as a refusal), 3-8 (three corpus fixtures: `block-scalars.yml`,
> `run-based-removal-boundaries.yml`, `file-comments-and-mixed-endings.yml`) and 3-11 (an anchored snippet
> excluded from bulk) — so **three of the fifteen have been through a window**, all at 3-8, each with an
> unread remainder (`3-15-2-notes.md` §4.4). **Phase 4 has made none yet**: its touches are owed with the
> 4-13 window half (`4-split-notes.md` §2 *4-13*). **Not closed, and never closed wholesale.**

### 4.3 E3 — the ruling-33 subject changes, mapped row by row

Phase 3 ruling 33 (`3-split-notes.md:719-722`) says new surfaces change the subject of some CF rows
(`2d-7-10-notes.md` §5) without closing them, and that no row is closed unless its own missing observation
is supplied. `3-15-2-notes.md` §8 item 5 asked whether any reading supplies one. **Answer, per row, from the
Phase 3 window readings** (Phase 4 took none, §2; `rg 'CF-[0-9]+'` over the Phase 4 step notes finds no
citation):

| Row | Missing observation (`2d-7-10-notes.md` §5) | What a Phase 3 reading supplies | State |
|---|---|---|---|
| CF-12 | The recovery form's own retained field values printed | **In part:** 3-6-3 drew the recovery form carrying a regex row, a one-item `triggers` list and a `search_terms` list (`3-6-3-notes.md` §3, L22–L25); several-item lists, edited lists and the empty and refused arms unread (its open item 1) | **Open**; the partial reading is mapped here, not credited as closure |
| CF-13 | Disabled-state timing beyond raw, with a writer during the hold and a panel sample inside it | 3-8-3 held raw saves only; 3-11-3 held `apply_bulk_options` with no writer during the hold | **Open**, not supplied |
| CF-14 | Authored-text send state before the writer; an enabled creator send | **In part:** 3-13-3 created snippets through the creator with a defaulted destination (`3-13-3-notes.md` §1, §5 item 1); the send state before a writer was not read | **Open** |
| CF-15 | A locale switch with a conflict standing, then a re-read, beyond raw | Every Phase 3 half set the language through the picker **before** the conflict; no switch under a standing conflict was read | **Open**, not supplied |
| CF-16 | *Load the version on disk* pressed on the editor, creator or recovery form | 3-5-2-2 drew the choice **unpressed** (`3-5-2-2-notes.md` §4 row 5); 3-14 pressed it on the **delete** panel, an operation surface, not an authored-text one | **Open**, not supplied |
| CF-17 | *Keep editing* / *Leave this as it is* pressed on each family, state read after | **In part:** 3-14 pressed *Leave this as it is* on the delete panel and read the state after (`3-14-window-reading.md`, L02 and L03 `c23`); *Keep editing* was pressed on no surface; the other families unread | **Open** |
| CF-18 | The recovery form's own choices pressed | 3-6-3 did not press *Create this snippet* (`3-6-3-notes.md` §3, *Unread*) | **Open**, not supplied |
| CF-24 | `mayHaveWritten` armed on six surfaces' writes | No Phase 3 reading armed it | **Open**, not supplied |
| CF-25 | A refused acknowledgement press | No Phase 3 reading pressed a disabled acknowledgement | **Open**, not supplied |
| CF-27 | `projectionReplaced` under a registered origin | 3-11-3 saw re-projected rows after a bulk commit, with no registered conflict origin (`3-11-3-notes.md` §5) | **Open**, not supplied |
| CF-28 | A route acknowledgement outliving a projection replacement | None | **Open**, not supplied |
| CF-29 | `pathDrift.changed` from a writer on an unnamed path | None | **Open**, not supplied |
| CF-30 | A surface acknowledgement disabled by `projectionReplaced`/`superseded` or `holdMoved` | None | **Open**, not supplied |
| CF-39 | A save-arm conflict with a recovery form beside it | 3-6-3 reached recovery through an external change, not a save-time conflict (`3-6-3-notes.md` §5) | **Open**, not supplied |
| CF-40 | Mounted scenarios 4–6 in a window | None; the mounted suites carry them | **Open**, not supplied |
| CF-50 | R38's residue | The four Phase 3 touches (E2, §4.2) | **Open, not closed** (ruling 31) |

**So no ruling-33 row is closed.** Three (CF-12, CF-14, CF-17) have a partial Phase 3 observation, now
mapped. Phase 4's surfaces change the subject of the recovery rows again (ruling 21's refusal) and of CF-50
(4-13's owed touches), without closing any (`4-split-notes.md` §7).

### 4.4 E4 — the inventory scripts outside the repository

**Answered by §3.1.** `scripts/i18n-inventory.mjs` is committed, reads only git objects, reproduces
Phase 3's recorded figures exactly and produced Phase 4's. The `/private/tmp/3-15-2/` scripts are no longer
needed to re-derive any recorded inventory.

### 4.5 E5 — the plan text shows a boolean default and the old path

**Verified, recorded, and handed to the orchestrator; the plan was not edited.** `IMPLEMENTATION_PLAN.md`
§8.9 still shows `"newSnippetDefaults": { "word": true, "forceMode": "clipboard" }` (line 839) and the
storage root `~/Library/Application Support/espansoConfig/` (line 826). The binding overrides stand:
`3-split-notes.md` §5 row 8 (defaults are optional text, never booleans; ruling 28) and `3-12-notes.md`
§3 (the root is Tauri's `app_data_dir()`, `~/Library/Application Support/cc.carpio.espansoConfig/`,
following the bundle identifier `cc.carpio.espansoConfig` in `src-tauri/tauri.conf.json`). If the
orchestrator edits the plan, the two lines become `"word": "true"` (text) and
`~/Library/Application Support/cc.carpio.espansoConfig/`.

### 4.6 E6 — stale sentences in `workspace.svelte.ts`

**Verified: 4-9 changed only the comment it touched, and the three sentences E6 names are still stale.**
4-9 rewrote `ownedMatchOf`'s comment (`4-9-notes.md:75-77`). The three of `3-11-1-notes.md` §5 item 6, read
at `b436c7d`:

| Sentence | Line | What the code holds |
|---|---|---|
| Header: *"{@link BrowserCommands} holds the twelve"* | 17 | `BrowserCommands` declares **22** members (lines 254-545) |
| *"Since Phase 2d-4b there is a thirteenth member that is neither"* | 236 | True of 2d-4b; later paragraphs of the same comment add members, so "thirteenth" names an ordinal that no longer holds |
| `beginWrite`'s *"the `finally` at each of the six call sites"* | 5239 | `beginWrite(` is called at **seven** sites (lines 6129, 6252, 7354, 7659, 7771, 7871, 8019) |

Correcting them is a source-file comment edit, outside a records-only step (§4.5). Carried as §5 item 1.

## 5. Open items (noticed, not fixed here)

1. **E6's three stale sentences in `src/lib/browser/workspace.svelte.ts`** (§4.6) — a comment-only fix for
   the next step that edits that file. `CLAUDE.md` §5 counts a comment claiming what the code does not hold
   as this project's worst defect class, so it should not wait for an unrelated change indefinitely.
2. **E2's R38 sentence and E5's plan lines** are the orchestrator's to write (§4.2, §4.5).
3. **The four window halves are owed** (§2), and with them B5 (4-13), B1's and A1's visible counterparts
   (4-13), D15's new subject (4-13) and D11's disposition (4-23).
4. **The inventory grows the owner's R35 review** (G2) by 440 EN/ES pairs; three are identical in both
   languages (§3.2). No Spanish was reviewed.
5. **The per-step open items stand in their own records, unconsolidated:** 156 numbered items across
   `4-1` … `4-22` (§5 of each, §6 of 4-2 and 4-10). The ones that hand their keys to this inventory are
   answered by §3; the rest are for the Phase 4 closure record to consolidate, as `3-closure-notes.md` §6 did.
6. **The debris directories of E7** (`48/`, `en/`, `es/`, `snippet/`, `whole/`) are still at the root;
   deferred, on the owner's word (§6).
7. **Accessor-output coverage** (added by the review of this step, `docs/reviews/4-24.md`): nothing proves
   that each of the 116 template-credited `code.*` keys is reachable from its `codes.ts` accessor — the
   script credits a family to one function and `TranslationKey` proves only that returned keys exist
   (§3.1 *Bounds*, §3.3). Closing it needs an exhaustive test enumerating each accessor's inputs against
   the dictionary family it names.

## 6. Disposition of every carried item of `4-split-notes.md` §7

The 47 items of `3-closure-notes.md` §6 plus the 3-6-3 item. "Unchanged" means no Phase 4 step took it and
it keeps §7's disposition.

| Item | §7 disposition | State at `b436c7d` |
|---|---|---|
| **A1** | 4-1; optional visible confirmation in 4-13 | **Fixed by 4-1** (`fdb0ab7`), byte-level, on *Create* and the single-match editor, failing-first (`4-1-notes.md`); visible confirmation owed with 4-13. No claim about espanso's reading (§4.2 of the split) |
| **B1** | 4-2; regression in 4-9; visible counterpart 4-13 | **Reproduced and repaired by 4-2** (`8d2d840`) in mounted tests (`4-2-notes.md` §1); visible counterpart owed with 4-13 |
| **3-6-3 item 1** | As B1 | As B1 |
| B2 | Deferred | Unchanged |
| B3 | Deferred | Unchanged |
| B4 | Deferred | Unchanged |
| **B5** | 4-13 | **Owed with 4-13**; not reproduced |
| B6 | Owner | Unchanged — the owner's (a real ⌘V) |
| C1 | Deferred | Unchanged |
| **C2** | Refusal retained; 4-5 pins it; decision deferred | **Pinned by 4-5** (`4-5-notes.md` row *"keeps `CommentInFlowCollection` (C2)"*); the decision stays deferred (its §5 item 3) |
| C3 | Deferred | Unchanged |
| C4 | Deferred | Unchanged |
| C5 | Deferred | Unchanged |
| C6 | Owner | Unchanged |
| C7 | Owner | Unchanged |
| C8 | Deferred | Unchanged |
| C9 | Deferred | Unchanged |
| C10 | Deferred | Unchanged |
| C11 | Deferred | Unchanged |
| C12 | Deferred | Unchanged |
| C13 | Deferred | Unchanged |
| C14 | Recorded limitation | Unchanged |
| D1 … D10 | Owner | Unchanged, each the owner's |
| **D11** | Owner; wording presented in 4-22/4-23 | **Replacement wording presented** in `4-22-notes.md` §4, **not adopted**; the owner's disposition owed at 4-23 |
| D12 … D14 | Owner | Unchanged, each the owner's |
| **D15** | Owner; new form surface shown in 4-13 | **Owed with 4-13**; no automatic closure |
| **E1** | 4-24 | **Corrected** (§4.1) |
| **E2** | 4-24, handed to the orchestrator | **Written and handed** (§4.2) |
| **E3** | 4-24 | **Mapped** (§4.3); no row closed |
| **E4** | 4-24 | **Answered** (§3.1, §4.4) |
| **E5** | 4-24, recorded | **Verified and recorded**; plan unedited (§4.5) |
| **E6** | 4-9 for its comments; 4-24 verifies | **Verified**: 4-9's comment corrected; three sentences still stale (§4.6, §5 item 1) |
| E7 | Deferred | Unchanged; the directories remain |
| F1 | Owner | Unchanged; Phase 4's halves have credited no row (none read) |
| G1 | Owner | Unchanged |
| **G2** | Owner; grows by Phase 4's inventory | **Grown by 440 pairs** (§3); the owner's, before Phase 5 |
| G3 | Owner | Unchanged |

**Count:** 48 rows (47 items plus the 3-6-3 item, the same as B1), each with one disposition. Taken by a
step and discharged: A1 (visible half owed), B1 (visible half owed), C2 (pinned), E1–E6 (E6 with an open
item) — 10; owed with a window half: B5, D15, D11 (and A1's and B1's visible halves); owner and deferred
items unchanged.

**`2d-6-split-notes.md` §7 items 1 and 10** stay "no phase" (Phase 3 ruling 32), unchanged.

## 7. R16, R25, R29, R30, R35, R36, R37 and R38 — not closed by assertion

**All eight stay exactly as `PROGRESS.md` *Open risks and deviations* states them.** This record closes,
narrows or rewrites none, and `rg` over the Phase 4 step notes finds no sentence claiming any of them closed
or narrowed. What Phase 4 did beside each, for the record only:

- **R16** — 4-1 writes the eight options as validated plain source; the projection is still unproven
  against espanso's resolver. Open.
- **R25** — kept: a variable reorder is alone in its batch and unavailable while other edits are pending
  (ruling 10; `4-11-notes.md` row *"Reorder cannot bypass the pending-draft rule or R25"*). Unchanged.
- **R29** — no Phase 4 step renders a span-accounted subtree. Unchanged.
- **R30** — no Phase 4 claim is proven against espanso; preview and the regex bench say so in both
  languages (rulings 26, 28). Open.
- **R35** — 440 more Spanish values under its exposure (§3); no native-speaker review. Open, the owner's.
- **R36, R37** — 4-9 applied R36's conservative rule and R37's single read to the variable editor, stated
  as what the code forces and what it cannot (`4-9-notes.md` §2–§4). Open.
- **R38** — no Phase 4 touch yet; 4-13's are owed (§4.2). Open.

## 8. Gate and module accounting (from runs)

Every command below was run on 2026-09-27 at `b436c7d` plus this step's three files, output redirected to
`/private/tmp/4-24/` and read with `rg`/`tail`; no exit status was read through a pipe.

| Command | Exit | Result |
|---|---|---|
| `cargo test --workspace -- --test-threads=1` | 0 | **1809 passed**, 0 failed (45 result lines summed) |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `cargo tree -p espansoconfig-core -i tauri` | 101 | *"package ID specification `tauri` did not match any packages"* — the core does not depend on tauri |
| `npm run check` | 0 | **519 files**, 0 errors, 0 warnings |
| `npm test` | 0 | 105 files, **4585 passed** |
| `npm run build` | 0 | **234 modules** transformed |
| bundle oracle, server-only `rg -c '\$\$payload\|head_payload\|push_element'` | 1 | absent |
| bundle oracle, client-only `rg -c 'window\.__svelte\|svelte-trusted-html'` | 0 | present (2) |
| `node scripts/i18n-inventory.mjs --phase 4 summary` / `check` / `rows` | 0 | §3.2, 0 gaps, §3.4 |
| `node scripts/i18n-inventory.mjs --phase 3 --head 3a85326 summary` | 0 | Phase 3's recorded figures (§3.1) |
| `git diff a1bc4d2 HEAD -- src/lib/i18n/en.json \| rg -c '^\+  "'` | 0 | 440 |

**Rung `1809 / 519 / 4585 / 234` — unchanged from 4-22.** The script is outside `tsconfig.json`'s
`include` (so not a `svelte-check` file), is imported by nothing (so not a Vite module) and is matched by
no vitest suite; this step changed no source, test or dictionary.

**Phase 4's accounting against the Phase 3 closure rung `1555 / 487 / 4074 / 214`:** +254 Rust tests,
+32 `svelte-check` files, +511 vitest tests, +20 Vite modules, each step's share recorded in its own
verification block (`PROGRESS.md` and `docs/progress-archive/status-table.md`). The consult named five new
browser modules (`variableEditor.ts`, `formEditor.ts`, `variableInsertion.ts`, `preview.ts`,
`regexBench.ts`); the per-step blocks carry the rest of the 20.

## 9. Phase 4 is not closed; deviations

- **Phase 4 stays open** because 4-13, 4-16, 4-20 and 4-23 are owed (§2; `4-split-notes.md` §4.6). Owner
  judgements (D-items, D11 and D15's subjects, F1, G1–G3) are carried and would not by themselves hold the
  phase open, except D11's disposition, which 4-23's own acceptance names (it may be "stays owed").
- **Not done here, by instruction:** any edit to `PROGRESS.md`, `PROGRESS.json`, `IMPLEMENTATION_PLAN.md` or
  `CLAUDE.md`; the orchestrator owns the status row, the R38 sentence (§4.2) and the plan lines (§4.5).
- **One script was added** to a records-only step, because E4 asks for an in-repository procedure and a
  record cannot be one. It carries a header comment and JSDoc on every function (`CLAUDE.md` §5).
- **The per-step open items were not consolidated** (§5 item 5): the phase is not closing, and the halves
  may add to them.
