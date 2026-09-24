# Phase 3-11-3 — the window half of step 3-11: the reading, launch by launch

**Date:** 2026-09-24. **Spec:** `docs/decisions/3-split-notes.md` §2 *3-11* and its 2026-09-24 addendum (the
3-11-3 bullet), ruling 30, ruling 31 (one R38 touch), §4.1; `docs/decisions/3-11-2-notes.md` §1 (what the
components draw). What changed and why, the instrument, the row classification and the open items are in
[`3-11-3-notes.md`](3-11-3-notes.md).

**Every statement below about what a window drew is a model's look** at a `screencapture -x -o -l <window>`
capture of the real Tauri app window, taken while `ioreg -n Root -d1` read `"IOConsoleLocked" = No`. It is
never the owner's judgement. **Every action on the page was a script-dispatched DOM event** (`.click()` on a
button, a `change` event on a `<select>` after setting its value) fired by the uncommitted probe; none is real
keyboard or pointer input. No capture read is the lock screen: every one shows the app's own window (title bar
*espansoConfig*, header with the language picker, sidebar, list pane, detail pane, footer) with the probe's
badge. None is a hidden-page snapshot, and no mounted test is credited.

## How the launches were run

`instrument-3-11-3/launch.sh <n> <lang> 80`: a fresh scratch tree `/private/tmp/3-11-3/L<n>/`, the synthetic
fixtures copied into `…/xdg/espanso/` plus a one-snippet marker file `match/probe-bulk-<lang>.yml` (the probe
reads the language from its name), a pre-launch copy in `…/before/`, **`match/locked/` set to mode `555`** (the
execution failure, below), a fresh bundle copy `…/espansoConfig-L<n>.app` (identifier `cc.carpio.espansoConfig`),
`open -n --env XDG_CONFIG_HOME=…/xdg --env HOME=…/home`, the main window found with `/private/tmp/3-11-3/winid
<pid>` (layer 0, on screen, taller than 100 points), then 80 captures about 1.15 s apart into `…/caps/cNN.png`
(2360 × 1520 px; 1400-px copies in `…/small/`). The lock state was read before the launch, before every capture
and after the launch into `…/launch.txt`; the script stops at the first reading that is not `No`. After the last
capture the app was killed, `match/locked/` set back to `755`, and the scratch tree compared with `before/`
(`disk.diff`, `disk:` line).

**The configuration was synthetic and neutral**: `config/default.yml` (one comment line) and four match files —
`bulk-alpha.yml` (`:alpha1` with `word: true`, `:alpha2` with `word: 'true'`, both `propagate_case: true`),
`bulk-delta.yml` (`:delta1`, whose `replace` holds a reference to an undeclared variable `nowhere`, so any
candidate of this file carries an acknowledgeable `ReferenceHasNoDeclaration` suspicion), `bulk-gamma.yml`
(`:gamma1`, whose `replace` carries an anchor `&shared`, so the snippet is not safely editable — the R38 touch),
and `locked/bulk-beta.yml` (`:beta1`, `word: true`), in a directory the app can read but cannot create a
temporary file in. Every capture shows only those paths in the sidebar; the owner's configuration was never
reachable.

**One plan, the same in both launches** (probe steps `s01` … `s24`, each held about 3.2–4.2 s): set the language
through the picker; press *All*; select `:alpha1` alone and open its editor; close the editor; turn *Select
several* on; toggle `:alpha1`, `:alpha2`, `:delta1`, `:gamma1`, `:beta1` in that order; walk the option controls;
set `force_mode` to *Set to* and press the `clipboard` suggestion; set `propagate_case` to *Remove*; *Undo*;
*Redo*; *Apply* (#1); read the consent review; *Confirm for this file*; *Apply* (#2) with the probe holding the
`apply_bulk_options` IPC call for 7 s; read the outcome; *Keep only the snippets that were not written*; stop
selecting.

**The language was set through the in-app picker in both launches** (`#language-picker-select` set to `en` or
`es`, then `change`). Every capture cited shows the picker reading *English* / *Español* and the footer's tail
*…face language: English* / *…de la interfaz: Español* (the badge covers the footer's first words).

**The badge and the DOM line.** A yellow block over the bottom-left corner (the sidebar's empty bottom and the
start of the footer): `3113 <lang> s<k> <step>` on its first line, then `|| <DOM line>`, redrawn 500 ms after the
step's action. Its words: `toggle` = the list's first bulk button's `aria-pressed` (and `/dis` when disabled);
`listBtns` = each list bulk button enabled (`e`) or disabled (`D`); `hints` = the list's hint paragraphs;
`rows`/`pressed`/`rowsDis` = list rows, rows with `aria-pressed="true"`, disabled rows; `insp` = the inspector is
mounted; `mixed` = options drawing the *Mixed, and left as it is* line; `intents` = the seven `<select>` values'
first letters in `BULK_OPTIONS` order (`u`ntouched / `s`et / `r`emove); `excl` = the exclusion rows' reasons;
`block` = the blockers drawn; `apply` = the Apply button enabled/disabled; `applying` = the *Applying…* marker;
`head` = the outcome headline; `exec` / `exclC` = the `data-count` names in the two count lists; `files` = each
file line's outcome; `consent` = consent items (`+held` when *Confirmed* is drawn). **A DOM line is DOM evidence,
not a window reading**; it is cited beside the pixels, never instead of them. Because the badge is redrawn 500 ms
after the action, a capture taken inside that window can show the next step's pixels under the previous step's
badge (L02 `c26`, which already draws `force_mode` *Establecer en clipboard* under the `s08` badge); every citation
below was checked against the pixels.

## Launches and the lock state

| Launch | Lang | Window | Captures (times) | Lock before / every capture / after | Disk | Status |
|---|---|---|---|---|---|---|
| L01 | EN | 9830 | 80 (15:08:57–15:10:26) | No / No ×80 / No | `bulk-alpha.yml` and `bulk-delta.yml` written; `bulk-gamma.yml`, `locked/bulk-beta.yml`, `config/default.yml` and the marker byte-identical; `.espansoconfig-backups/` created | read |
| L02 | ES | 9841 | 80 (15:12:00–15:13:29) | No / No ×80 / No | the same | read |

In both launches `disk.diff` shows, for `bulk-alpha.yml`, `force_mode: clipboard` added and `propagate_case: true`
removed in both snippets, and for `bulk-delta.yml`, `force_mode: clipboard` added; nothing else differs. That is
the partial success on disk: two files committed, one execution failure, one file excluded.

## Step to capture map

| Step | L01 (EN) | L02 (ES) |
|---|---|---|
| s01 picker | c04–c05 | c02–c04 |
| s02 *All*, single mode | c06–c09 | c05–c07 |
| s03 `:alpha1` editor open | c10–c12 | c08–c10 |
| s04 editor closed | c13–c15 | c11–c13 |
| s05 *Select several* on | c16–c18 | c14–c16 |
| s06 five toggled | c19–c22 | c17–c20 |
| s07 options, lower half | c23–c25 | c21–c23 |
| s08 exclusions and apply panel | c26–c28 | c24–c26 |
| s09 intents set | c29–c32 | c27–c30 |
| s10 Undo | c33–c35 | c31–c33 |
| s11 Redo | c36–c38 | c34–c36 |
| s12 apply panel before #1 | c39–c42 | c37–c40 |
| s13–s14 apply #1 answered, consent | c43–c49 | c41–c47 |
| s15 confirmed | c50–c52 | c48–c50 |
| s16–s17 apply #2 pending | c53–c59 | c51–c57 |
| s18–s20 apply #2 outcome | c60–c69 | c58–c67 |
| s21–s22 kept only what was not written | c70–c75 | c68–c73 |
| s23–s24 stopped selecting | c76–c80 | c74–c80 |

## What was seen

Paths are `/private/tmp/3-11-3/L<n>/small/cNN.png` unless named otherwise.

### 1. The *Select several* toggle, single mode, and its refusal

- **Single mode** (L01 `c04`, L02 `c05`): under *6 of 6* / *6 de 6*, one button *Select several* / *Seleccionar
  varios*; the rows are the plain rows, `:gamma1` with its *Not editable* / *No editable* badge. DOM:
  `toggle=false listBtns=e hints=0 rows=6 pressed=0`.
- **Refused while an editor is open** (L01 `c11`, L02 `c09`): the editor for `:alpha1` is drawn in the detail
  pane (*Stop editing* / *Dejar de editar*), and under the toggle the list says *Close the open editor or panel to
  select several snippets.* / *Cierra el editor o el panel abierto para seleccionar varios fragmentos.* DOM:
  `toggle=false/dis listBtns=D hints=1`. **The disabled toggle is drawn pixel-identical to the enabled one**: a
  crop of the button in `c04` and in the refusal capture differs in **0 pixels** in both launches (crop
  `L01/cmp-toggle.png`). The refusal is visible only through the sentence (§5 item 1 of the notes).
- **After *Stop editing*** (L01 `c14`, L02 `c12`): the sentence is gone and the toggle enabled (DOM `listBtns=e
  hints=0`).

### 2. Selecting several: the mode, the rows, the count

- **Mode on, nothing selected** (L01 `c16`, L02 `c15`): the list draws *Stop selecting several* and *Clear the
  selection* (*Dejar de seleccionar varios*, *Vaciar la selección*), the hint *Press a snippet to add it to the
  selection, or press it again to take it out.* / *Pulsa un fragmento para añadirlo a la selección, o vuelve a
  pulsarlo para quitarlo.*, and *Selected: 0* / *Seleccionados: 0*; every row carries an empty box `☐` and no
  badge. The detail pane draws the inspector — *Options of several snippets* / *Opciones de varios fragmentos*,
  its own *Stop selecting several*, *Selected snippets: 0* — and every option reads *Not read yet* / *Aún no
  leída*. *Show this file's text* / *Mostrar el texto de este archivo* is still drawn above the inspector
  (3-11-2 §5 item 1, now seen). DOM: `block=noSelection,noChanges apply=D`, *Clear* disabled (`listBtns=eD`).
- **Five toggled** (L01 `c20`, L02 `c18`): five rows drawn with `☑`, a shaded background and the *Selected* /
  *Seleccionado* badge; `:marker` stays `☐`. The count reads *Selected: 5* / *Seleccionados: 5*. `:gamma1` is
  selectable in the mode even though single mode badges it *Not editable* — the exclusion is the inspector's (§4).
  In the mode the list draws no *Not editable* badge on `:gamma1`.

### 3. The inspector: the seven options, Mixed, intents, Undo/Redo

- **The seven options, in `BULK_OPTIONS` order** (L01 `c20` + `c23`; L02 `c18` for `word`, `left_word`, `right_word`, `propagate_case`, `uppercase_style` + `c20` for `propagate_case` through `force_clipboard`): *Whole word* `word`,
  *Boundary on the left* `left_word`, *Boundary on the right* `right_word`, *Follow the case that was typed*
  `propagate_case`, *Capitalisation style* `uppercase_style`, *Insertion mode* `force_mode`, *Force the clipboard
  (older setting)* `force_clipboard` (ES: *Palabra completa*, *Límite por la izquierda*, *Límite por la derecha*,
  *Seguir las mayúsculas que se escriban*, *Estilo de mayúsculas*, *Modo de inserción*, *Forzar el portapapeles
  (ajuste antiguo)*), each with the espanso key in monospace. DOM `options=7`.
- **Mixed** (L01 `c20`): `word` reads *In the selected snippets now: Mixed* with *Mixed, and left as it is in each
  snippet.*; `propagate_case` the same. ES (L02 `c18` for `word` and `propagate_case`; `c20` and `c32` for `propagate_case`): *Ahora, en los fragmentos seleccionados: Mixta* /
  *Mixta, y se deja como está en cada fragmento.* `word` is Mixed across `true`, `'true'` and absent;
  `propagate_case` across present and absent. **Mixed by exact spelling alone was not isolated**: `word` is
  absent from `:delta1` and `:gamma1` too, so this reading shows Mixed, not that `true` against `'true'` alone
  would draw it (a model test carries that, `3-11-2-notes.md` §4). The other five read *Not set in any selected
  snippet* / *No está en ningún fragmento seleccionado*.
- **Suggestions** (L01 `c23`): `uppercase_style` offers `uppercase`, `capitalize`, `capitalize_words`; `force_mode`
  offers `clipboard`, `keys`, under *Suggested values, as espanso spells them:* / *Valores sugeridos, tal como los
  escribe espanso:*.
- **Intents** (L01 `c30`): `force_mode` reads *Set to* with a text box holding `clipboard`; `propagate_case` reads
  *Remove*, and its *Mixed, and left as it is* line is gone (the line is drawn only while untouched). ES (L02
  `c35`): *Establecer en* `clipboard`, *Quitar*. DOM `intents=uuurusu`, `block=` (none), `apply=e`.
- **Undo** (L01 `c34`, L02 `c32`): `propagate_case` is back to *Leave as it is* / *Dejar como está* with the Mixed
  line; `force_mode` stays *Set to* `clipboard` — one undo step per choice (3-11-2 §5 item 4). *Redo* is enabled.
  DOM `intents=uuuuusu`.
- **Redo** (L01 `c37`, L02 `c35`): `propagate_case` is *Remove* again; *Redo* / *Rehacer* is drawn grey
  (disabled). DOM `intents=uuurusu`.
- **The draft-only sentence** (L01 `c23`, L02 `c20`): *Undo and Redo change only the choices above. They do not
  change any file.* / *Deshacer y Rehacer cambian solo las elecciones de arriba. No cambian ningún archivo.*

### 4. Exclusions, plan counts, blockers, the no-disk-undo sentence (the R38 touch)

- **The R38 touch — a read-only selection, excluded with its reason** (L01 `c26`, L02 `c25`): under *Left out* /
  *Excluidos*, `:gamma1` with `match/bulk-gamma.yml` and *Left out: espansoConfig cannot edit this snippet here, so
  the options are not applied to it.* / *Excluido: espansoConfig no puede editar este fragmento aquí, así que las
  opciones no se le aplican.* The screen is the bulk inspector in the detail pane; the action was toggling
  `:gamma1` (a snippet whose value carries an anchor) into the selection with *Select several* on. DOM
  `excl=readOnly`.
- **Plan counts** (L01 `c26`, L02 `c25`): *Files to write: 3*, *Snippets to change: 4* (ES *Archivos que se escribirán: 3*,
  *Fragmentos que cambiarán: 4*) — `:gamma1`'s file is not counted.
- **A blocker** (L01 `c26`, L02 `c25`): before any intent, *Set or remove at least one option. Options left as they are,
  mixed ones included, are not changed.* / *Establece o quita al menos una opción. Las opciones que se dejan como
  están, incluidas las mixtas, no cambian.*, and *Apply to the selected snippets* drawn grey (DOM `apply=D`).
- **The no-disk-undo sentence** (L01 `c26`, L02 `c25`): *Applying saves each file on its own. Once a file is saved,
  nothing here takes that save back.* / *Aplicar guarda cada archivo por separado. Una vez guardado un archivo,
  nada de aquí anula ese guardado.*

### 5. Apply #1: nothing written, the consent review

- **Outcome** (L01 `c44`, L02 `c43`): *Result* / *Resultado*, headline *No file was written.* / *No se escribió
  ningún archivo.*; under *Applied files* / *Archivos aplicados*: *Not written: 1*, *Not attempted: 2*; under
  *Left out before applying* / *Excluidos antes de aplicar*: *Files left out: 1*, *Snippets left out: 1*. Per file:
  `bulk-alpha.yml` and `locked/bulk-beta.yml` *This file was not attempted, and it was not changed.*;
  `bulk-delta.yml` *espansoConfig did not write this file, because of what it found in the result.*;
  `bulk-gamma.yml` *This file was left out before applying, and it was not changed.* The preflight's refusal of
  one file wrote nothing anywhere, as the coordinator states.
- **Consent review** (L01 `c44`/`c47`, L02 `c43`): *Needs your confirmation* / *Necesita tu confirmación*, the
  introduction sentence, `match/bulk-delta.yml`, the verdict *The result contains something that looks wrong.
  Saving it needs your confirmation first.*, *What it found:* and the finding *The text refers to “nowhere”, and
  nothing this app can see declares a variable of that name.* (ES *El texto hace referencia a «nowhere», y nada
  de lo que esta aplicación puede ver declara una variable con ese nombre.*), then *Confirm for this file* /
  *Confirmar para este archivo*.
- **Confirmed** (L01 `c51`, L02 `c49`): the button is replaced by *Confirmed. Apply again to write this file with
  these options.* / *Confirmado. Vuelve a aplicar para escribir este archivo con estas opciones.* DOM
  `consent=1+held`.

### 6. Apply #2: the pending-apply lock

(L01 `c55`, L02 `c54`, the IPC call held by the probe.) The inspector draws *Applying…* / *Aplicando…* beside a
grey *Apply to the selected snippets*. DOM: `toggle=true/dis listBtns=DD rowsDis=6 apply=D applying=y` — the
list's *Stop selecting several*, *Clear the selection* and all six rows are disabled, and the probe's `.click()`
on the list's *Stop* during the hold changed nothing (the inspector stayed mounted; `insp=y` through `c59`).
**In pixels the list is unchanged**: a 760 × 520 crop of the list pane before the apply (`c51` / `c49`) and during
the hold (`c55` / `c54`) differs in **0 pixels** in both launches (crop `L01/cmp-pending-list.png`). The lock is
real in the DOM and visible only in the inspector (§5 item 1 of the notes). The previous outcome, its consent
item and *Confirmed* stay drawn under the apply panel during the hold.

### 7. Apply #2: the partial success

(L01 `c62`/`c65`/`c68`; L02 `c60`.) Headline *Some files were saved and others were not. The files that were
saved stay saved.* / *Algunos archivos se guardaron y otros no. Los archivos que se guardaron siguen guardados.*
Under *Applied files*: *Saved: 2*, *Not written: 1* (ES *Guardados: 2*, *No escritos: 1*); **apart**, under *Left
out before applying*: *Files left out: 1*, *Snippets left out: 1*. Per file: `bulk-alpha.yml` and
`bulk-delta.yml` *This file was written.* / *Este archivo se escribió.*; `locked/bulk-beta.yml` *Writing this file
failed, and it was not changed.* / *Falló la escritura de este archivo, y no se modificó.*, followed by the command
error sentence *espansoConfig could not carry this save through. What it reports beside this is the reason.* /
*espansoConfig no pudo llevar a cabo este guardado. Lo que informa junto a esto es el motivo.* — **and nothing
beside it**: no reason is drawn (§5 item 2 of the notes); `bulk-gamma.yml` *This file was left out before
applying, and it was not changed.* DOM `head=partial exec=saved,notWritten exclC=excludedFiles,excludedSnippets
files=saved,saved,failed,excludedBeforeApply`. The disk agrees (§ Launches).

After the commit (same captures):

- **The stale selection blocks**: the apply panel reads *Files to write: 1*, *Snippets to change: 1* and *The file
  of at least one selected snippet has changed since it was selected. Select the snippets again before applying.*
  / *El archivo de al menos un fragmento seleccionado ha cambiado desde que se seleccionó. Vuelve a seleccionar
  los fragmentos antes de aplicar.*, Apply grey. DOM `block=staleSelection`.
- **The list**: the count still reads *Selected: 5* while only `:gamma1` and `:beta1` are drawn `☑`; `:alpha1`,
  `:alpha2`, `:delta1` are drawn `☐` (3-11-2 §5 item 3, now seen). **The *All* list's order changed**: before
  the commit `:alpha1, :alpha2, :delta1, :gamma1, :beta1, :marker`; after it `:gamma1, :beta1, :marker, :alpha1,
  :alpha2, :delta1` — the two re-read files moved to the end (§5 item 3 of the notes).
- ***Keep only the snippets that were not written*** / *Conservar solo los fragmentos que no se escribieron* is
  offered, with *Dismiss* / *Descartar*.

### 8. Narrowing, and stopping

- **Kept** (L01 `c71`/`c74`, L02 `c72`): *Selected: 2* / *Seleccionados: 2* in the list and *Selected snippets: 2*
  in the inspector; `word` still Mixed (`:beta1` has it, `:gamma1` not); `propagate_case` keeps *Remove* over *Not
  set in any selected snippet*; the stale blocker is gone, the plan reads *Files to write: 1*, *Snippets to
  change: 1*, `:gamma1` still *Left out*, and Apply is enabled. The previous result stays drawn without the
  narrowing button.
- **Stopped** (L01 `c77`, L02 `c75`): the list is back to single mode (*Select several*, plain rows, `:gamma1`
  badged *Not editable*); the detail pane draws the external-change notice for the earlier single selection of
  `:alpha1`: *This file changed on disk, and what is now in that position is no longer written the way the
  snippet you had selected was, so the selection was cleared. …* / *Este archivo ha cambiado en el disco y lo que
  ahora ocupa esa posición ya no está escrito como estaba el fragmento que tenías seleccionado, así que se ha
  borrado la selección. …* — the app's own bulk commit is described as a change on disk (3-11-1 §5 item 1, now
  seen).

**ES fit.** Nothing was seen clipped in Spanish. The longer option-summary sentences wrap onto their own line
under *Ahora, en los fragmentos seleccionados:* (L02 `c18`, `c20`), and the list hint wraps to two lines; both stay inside
their panes.

## Rows not read

- **Real keyboard and pointer input** on every control: Tab to a row, Space or Return to toggle it, the
  `aria-pressed` announcement. §4.1 reserves real input to a person; every action here was a dispatched event.
- **Typing into a *Set to* box** (`typeBulkIntentText`'s one-step typing run): the probe used a suggestion
  button, not the box.
- **Blockers and answers not reached by the fixtures**: `emptyValue`, `nothingToApply`; the `editorOpen`
  exclusion (unreachable in this window, 3-11-2 §5 item 2); *Confirming cannot let this file be written*
  (`consentNotPossible`), `consentOutdated`, `readFailed` with *Read the options again*; the `conflicted`,
  `consentStale`, `blocked`, `writeOutcomeUnknown` and `alreadyUnchanged` file outcomes; the `notAttempted` and
  `failed` answer kinds; the `rereadFailed` line. This phase's fixtures and probe steps did not reach them; some
  would need only another fixture or step, most would need fault injection.
- **A failure's reason**: not drawn, so not readable (§7 above).
- **Wording clarity and layout acceptance**: a person's judgement.

None of these rows is required by 3-11's window acceptance (*EN and ES, including a partial success*) or by
rulings 30 and 31, all three of which this reading meets. [`3-11-3-notes.md`](3-11-3-notes.md) §3 judges each row
against that acceptance and names the capability a later reading would need; §5 item 7 holds them as open items.
