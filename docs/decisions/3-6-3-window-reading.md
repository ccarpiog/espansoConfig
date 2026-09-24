# Phase 3-6-3 — the window half of step 3-6: the reading, launch by launch

**Date:** 2026-09-24. **Spec:** `docs/decisions/3-split-notes.md` §2 *3-6* and its 2026-09-24 addendum,
rulings 30 and 31, §4.1. What changed and why, the instrument, the surface table, the open items and the
gates are in [`3-6-3-notes.md`](3-6-3-notes.md).

**Every statement below about what a window drew is a model's look** at a `screencapture -x -o -l <window>`
capture of the real Tauri app window, taken while `ioreg -n Root -d1` read `"IOConsoleLocked" = No`. It is
never the owner's judgement. **Every action on the page was a script-dispatched DOM event** (`.click()`, a
`change` event on the picker's `<select>`, an `input` event on a box after setting its value,
`scrollIntoView`) fired by the uncommitted probe; none is real keyboard or pointer input, so **nothing here
says anything about hit-testing, focus or typing**. No capture read is the lock screen: every one shows the
app's own window (title bar *espansoConfig*, sidebar, list, detail pane) with the probe's badge. None is a
hidden-page snapshot: each is a CoreGraphics capture of the on-screen main window.

**How the launches were run.** `instrument-3-6-3/launch.sh <n> <plan> <lang> <seconds>`: a fresh scratch tree
`/private/tmp/3-6-3/L<n>/`, a fresh bundle copy `…/espansoConfig-L<n>.app` (bundle identifier
`cc.carpio.espansoConfig`), `open -n --env XDG_CONFIG_HOME=…/xdg --env HOME=…/home`, the main window found
with `/private/tmp/3-6-3/winid` (layer 0, on screen, taller than 100 points), then one capture about every
1.2 s into `…/caps/cNN.png`, with the lock state read before the launch, before every capture and after the
launch (`…/launch.txt`). **One plan per launch.** The configuration directory held only
`config/default.yml` (one comment line) and `match/plan-<plan>-<lang>.yml`: a neutral instrument file, or for
the `flow*` plans a byte-identical copy of `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml`
(`cmp` against the corpus file: identical). Every capture read shows only those two paths in the sidebar;
the owner's configuration was never reachable.

**The language was set through the in-app picker in every launch** (`#language-picker-select` set to `en` or
`es`, then `change`); every capture read shows the picker reading *English* / *Español* and the page in that
language.

**The badge.** A yellow line in the bottom-left corner, `363 t=<s> <plan>-<lang> <step> [facts]`, drawn by
the probe over the left end of the status line. It is instrument output, not the app's. Where a step's
`disabled=` fact is quoted below it is the probe's reading of the pressed button's `disabled` property.

Captures were read downscaled to 1400 px wide (`…/small/cNN.png`, `sips -Z 1400`), several of them as EN/ES
side-by-side pairs (`/private/tmp/3-6-3/pairs/<name>.png`, left EN, right ES, each half one `small/` capture
named below). The window was 1180×760 points; every capture is 2360×1520 px.

**Lock state:** every one of the 31 launches' `launch.txt` reads `"IOConsoleLocked" = No` before the launch,
at every capture and after it; no reading was `Yes` or unreadable (`rg -l 'Locked" = Yes|unreadable|stopping'`
over all 31 files finds nothing).

---

## Binaries

| Binary | Main executable SHA-256 (prefix) | Launches |
|---|---|---|
| A | `6f9d21b5a2a3` | L01–L09 |
| B–H | exploratory rebuilds of the recovery plans | L10–L21 (not credited, §L09–L21) |
| I | `f08efdbfc27b` | L22–L27 |
| J | `4c098a2e67f6` | L28, L29 |
| K | `65738055b575` | L30, L31 |

Every rebuild changed only `probe.ts` (plans added or a panel search added) and, for the recovery plans, the
launcher's disk rewrite; the app's tracked source is the same in all of them.

---

## L01 — `forms`, EN; L02 — `forms`, ES

L01 09:05:52, window 9028, 60 captures (09:05:54–09:07:05). L02 09:07:58, window 9039, 42 captures
(09:07:59–09:08:49). Binary A. Snippet `:lit` (`trigger: ":lit"`, `label`, `replace`).

- `pairs/f1.png` = L01 `c06` / L02 `c06`, `f1-literal`: heading **Trigger form** / **Forma de disparador**;
  *Trigger* / *Disparador* one-line box `:lit`; *Take this key out* / *Quitar esta clave*; the offer
  sentence (*"A snippet fires from one literal trigger, from a regular expression or from a list of
  triggers. Changing the form carries the text over as it is: nothing in it is converted."* / *"Un fragmento
  se activa con un disparador literal, … no se convierte nada de él."*); two buttons **Change to: Regular
  expression**, **Change to: Triggers** / **Cambiar a: Expresión regular**, **Cambiar a: Disparadores**.
  **Literal control: read.**
- `pairs/f2.png` = `c09` / `c09`, `f2-regex-preview`, after *Change to: Regular expression*: the control is
  now *Regular expression* / *Expresión regular* holding `:lit` with the hint *"Whether this pattern compiles
  is checked when you save, not while you type."* / *"Si este patrón compila se comprueba al guardar, no
  mientras escribes."*; the pressed choice drawn grey; a bordered preview: *Trigger form in the file:
  Trigger*, *Trigger form after saving: Regular expression*, *"The text is kept exactly as the file writes
  it:"*, `:lit`, **Confirm this change of trigger form**, **Cancel the change of trigger form** (ES: *Forma de
  disparador en el archivo: Disparador*, *… tras guardar: Expresión regular*, *El texto se conserva
  exactamente como lo escribe el archivo:*, *Confirmar este cambio de forma de disparador* and *Cancelar el
  cambio de forma de disparador* on two rows). **Regex control and switch preview: read.**
- `pairs/f3.png` = `c11` / `c11`, `f3-withheld save-disabled=true`: *Undo*, *Redo*, *Save this snippet* and
  under them *"This snippet cannot be saved until the change of trigger form above is confirmed."* / *"Este
  fragmento no se puede guardar hasta que se confirme el cambio de forma de disparador de arriba."*
- `pairs/f4.png` = `c14` / `c14`, `f4-cancelled`, after *Cancel*: back to the literal *Trigger* box `:lit`
  and both choices, no preview. **Cancel: read.**
- `pairs/f5.png` = `c17` / `c17`, `f5-list-preview`, after *Change to: Triggers*: the control is the
  *Triggers* / *Disparadores* list: *Item 1* / *Elemento 1*, marker *New item* / *Elemento nuevo*, box `:lit`,
  *Take this item out*, the sentence *"The only item left cannot be taken out on its own: a list keeps at
  least one item."* / *"El único elemento que queda no se puede quitar por sí solo: …"*, *Add an item*; the
  preview says *Trigger form after saving: Triggers* and *"The list will hold these triggers, in this
  order:"* / *"La lista contendrá estos disparadores, en este orden:"* with `:lit`, and Confirm / Cancel.
- `pairs/f6.png` = `c21` / `c21`, `f6-confirmed`: the preview ends *"This change of trigger form is
  confirmed. Undo takes the confirmation back."* / *"Este cambio de forma de disparador está confirmado.
  Deshacer retira la confirmación."* with only *Cancel…*. **Confirm: read.**
- `pairs/f7.png` = `c24` / `c24`, `f7-added`, after *Add an item* and `:lit-two` put into the new box: two
  items, both *New item*, `:lit` and `:lit-two`, each with *Take this item out*; the preview's list now shows
  both; and under the choices a refused-choice row *Regular expression* — *"The list holds 2 triggers, and a
  single trigger form holds one, so changing to it would drop the others. Take the others out and save
  first."* / *"La lista tiene 2 disparadores, y una forma de disparador única tiene uno, así que cambiar a ella
  descartaría los demás. Quita los demás y guarda antes."* **List add on `triggers`: read. `wouldDropAliases`
  with its count: read** (count 2 here, count 3 in L03/L04).
- `pairs/f8.png` = `c29` / `c29`, `f8-save save-disabled=false`: *Save this snippet* / *Guardar este
  fragmento* drawn enabled, no withheld sentence. **No save was pressed.**

## L03 — `refusals`, EN; L04 — `refusals`, ES

L03 09:08:55, window 9050, 60 captures (09:08:56–09:10:08). L04 09:10:40, window 9061, 48 captures
(09:10:41–09:11:38). Binary A. Snippets `pattern one` (`regex: 'rx-(\d+)'`) and `list one` (a block
`triggers` list `:a1`, `:a2`, `:a3`).

- `pairs/r1.png` = L03 `c06` / L04 `c06`, `r1-regex`: the list row shows `rx-(\d+)` with the badge *Regex* /
  *Expresión regular*; the editor's *Regular expression* box `rx-(\d+)`, its hint, and **Change to: Trigger**,
  **Change to: Triggers**. **Regex control: read.**
- `pairs/r3.png` = `c14` / `c14`, `r3-finding found=true`, after `rx-(\d+` was put into the box and *Save this
  snippet* pressed: under the save row a panel *"Nothing was written. The file on disk is exactly as it was."*,
  *"The result contradicts the shape espansoConfig models for a snippet, so it was not saved."*, *"What the
  check found:"* and the bullet *"This regular expression did not compile under the version espansoConfig
  uses. espanso pins an older one, so the two can disagree."*, then **Keep editing** only — no *Save anyway*
  (ES: *No se ha escrito nada. …*, *El resultado contradice la forma que espansoConfig modela para un
  fragmento, así que no se guardó.*, *Lo que ha encontrado la comprobación:*, *Esta expresión regular no
  compiló con la versión que usa espansoConfig. …*, **Seguir editando**). `pairs/r3b.png` (`c16`/`c16`) is the
  same view.
- `pairs/r4.png` = `c19` / `c19`, `r4-draft-kept`: scrolled back to the top, the *Regular expression* box still
  holds `rx-(\d+` (the drafted, unclosed text), not the file's `rx-(\d+)`. **`RegexDoesNotCompile` with the
  draft kept: read.** That the finding came from the Rust validator is not a thing a window shows; the
  window shows the save-outcome panel's finding sentence.
- `pairs/r5.png` = `c24` / `c24`, `r5-aliases` on `list one`: *Triggers*, *"Written one item per line. A save
  keeps it that way."* / *"Escrita con un elemento por línea. Al guardar se mantiene así."*, *Item 1…3* boxes
  `:a1`, `:a2`, `:a3`, each *Take this item out*, *Add an item*; **Change to: Trigger**, **Change to: Regular
  expression**; and two refused-choice rows, *Trigger* and *Regular expression*, each *"The list holds 3
  triggers, … Take the others out and save first."* (ES: *"La lista tiene 3 disparadores, …"*).
  **`wouldDropAliases` with its count: read.** Whether the two buttons are disabled is not recorded by the
  probe and is not claimed from the pixels.
- `pairs/r6.png` = `c30` / `c30`, `r6-removed list=2 boxes`, after *Take this item out* on item 2: boxes `:a1`,
  `:a3`; *"These items will be taken out of the list when you save:"* / *"Estos elementos se quitarán de la
  lista al guardar:"* and `:a2` in a grey source-text box (no *Take this item out* beside it). **List remove on
  `triggers`: read.**
- `pairs/r7.png` = `c34` / `c34`, `r7-added list=3 boxes`: `:a1`, `:a3`, and *Item 3* *New item* `:a4`; `:a2`
  still listed as taken out. The refusal rows still say 3 triggers (the file's count).

## L05 — `presence`, EN; L06 — `presence`, ES

L05 09:11:44, window 9072, 45 captures (09:11:46–09:12:39). L06 09:13:01, window 9083, 34 captures
(09:13:02–09:13:42). Binary A. Snippets `several one` (`trigger: ":sev"` and `triggers: [":sev-two"]` in block
style) and `absent one` (no trigger key).

- `pairs/p1.png` = L05 `c06` / L06 `c06`, `p1-several`: the list row reads `:sev`; under **Trigger form**:
  *"This snippet is written with more than one trigger form, so it is not clear which one espanso uses. Every
  form is shown, and this editor picks none of them."* and the raw-repair sentence *"To keep one form and take
  the others out, edit the file's text directly."* (ES: *"Este fragmento está escrito con más de una forma de
  disparador, …"*, *"Para conservar una forma y quitar las demás, edita directamente el texto del
  archivo."*); then *Trigger*, *Trigger — shown here as the file writes it* `:sev`, *Triggers — shown here as
  the file writes it* `:sev-two`, and *"This snippet does not fire from one literal trigger, so this box does
  not edit its trigger. …"*. **No choice-of-form button is drawn** (`pairs/p2.png`, `c09`/`c09`, the same
  view). **`Several` with the raw-repair sentence: read.**
- `pairs/p3.png` = `c14` / `c14`, `p3-absent`: the list row reads *No trigger* / *Sin disparador*; *"This
  snippet has no trigger. Choose a trigger form to add one."* / *"Este fragmento no tiene disparador. Elige una
  forma de disparador para añadir uno."*, the offer sentence, and **Add a trigger as: Trigger / Regular
  expression / Triggers** (ES: *Añadir un disparador como: …*, one per row). **`Absent`: read.**
- `pairs/p4.png` = `c17` / `c17`, `p4-added`, after *Add a trigger as: Trigger*: an empty *Trigger* box, that
  choice drawn grey, and **Take back the added trigger** / **Retirar el disparador añadido**. No preview panel
  (an addition owes no confirmation).
- `pairs/p4b.png` = `c19` / `c19`, `p4b-save save-disabled=true`: *"This snippet cannot be saved: its trigger
  form holds nothing. Type a trigger, add an item to the list, or cancel the change of trigger form."* / *"Este
  fragmento no se puede guardar: su forma de disparador no contiene nada. …"*
- `pairs/p6.png` = `c25` / `c25`, `p6-save save-disabled=false`, after `:absent` was put into the box: the
  withheld sentence is gone. **Take back the added trigger was not pressed; no save was pressed.**

## L07 — `lists`, EN; L08 — `lists`, ES

L07 09:13:47, window 9094, 50 captures (09:13:49–09:14:48). L08 09:15:12, window 9105, 36 captures
(09:15:13–09:15:55). Binary A. Snippets `terms one` (block `search_terms: [alpha, beta]`) and `terms two` (none).

- `pairs/l1.png` = L07 `c06` / L08 `c06`, `l1-terms`: **Search terms** / *Términos de búsqueda* as its own
  section, the block style note, *Item 1* `alpha`, *Item 2* `beta`, each *Take this item out*, then **Add an
  item** and **Take this list out** / **Añadir un elemento**, **Quitar esta lista**.
- `pairs/l2.png` = `c09` / `c09`, `l2-added`: *Item 3*, *New item*, `gamma`. **List add on `search_terms`:
  read.**
- `pairs/l3.png` = `c12` / `c12`, `l3-removed-item`, after *Take this item out* on `alpha`: boxes `beta`,
  `gamma`; *"These items will be taken out of the list when you save:"* and `alpha` in a grey source-text box.
  **List remove on `search_terms`: read.**
- `pairs/l4.png` = `c15` / `c15`, `l4-list-removed list=0 boxes`, after *Take this list out*: *"This list will
  be taken out of the file when you save."* / *"Esta lista se quitará del archivo al guardar."*, then `beta`
  and `gamma` drawn as grey source-text boxes (the probe counted **0** `<input>`s in the block), and only
  **Add this list** / **Añadir esta lista**. **Removed-list read-only items: read.**
- `pairs/l5.png` = `c21` / `c21`, `l5-absent` on `terms two`: *"The file does not hold this list."* / *"El
  archivo no contiene esta lista."* and **Add this list**.
- `pairs/l6.png` = `c25` / `c25`, `l6-list-added`: *"This list holds no item."* / *"Esta lista no contiene
  ningún elemento."*, *Add an item*, *Take this list out*.
- `pairs/l7.png` = `c28` / `c28`, `l7-item-added`: *Item 1*, *New item*, `delta`, *Take this item out*, and the
  last-item sentence.

## L09–L21 — the recovery route, exploratory (EN only; **not credited** except as stated)

Thirteen launches built toward the recovery panel. Each opened `recover one`, drafted a change, and had the
launcher rewrite the file on disk at capture 22 (L09) or 14 (L10–L21): either removing the snippet
(`recovery-after.yml`, moved into place), changing its trigger (`recovery-collide.yml`), or an in-place
`sed -i ''` of its `replace` line. The probe then waited for the editor's external-change panel
(`.matchEditor .panel.external`) and its *Keep my draft*.

What the badges and the captures looked at show, per draft (a model's look at `badges.png` strips built from
the captures' bottom-left corners, `/private/tmp/3-6-3/expl.png`, `iso.png`):

| Launch | Draft | Disk change | External panel within the probe's wait |
|---|---|---|---|
| L09, L10, L11, L14, L15 | literal→regex, pattern edited, **one item added to `search_terms`** | snippet removed | not drawn (`k3-panel found=false`) |
| L12 | **one item added to `search_terms`** only | snippet removed | not drawn |
| L13 | literal→regex, **`search_terms` item added** | trigger changed | not drawn |
| L16 | literal→regex, **`search_terms` item added** | `sed` of `replace` | not drawn |
| L17 | `replace` edited only | `sed` of `replace` | drawn; the probe ran on to its last step |
| L18 | **`search_terms` item added** only | `sed` of `replace` | not drawn |
| L19 | literal→regex only | `sed` of `replace` | drawn; the probe ran on to its recovery steps |
| L20 | literal→triggers, **one item added to the list** | `sed` of `replace` | not drawn |
| L21 | `replace` edited only | snippet removed | drawn; the probe ran on to its recovery steps |

**In every one of these launches whose draft held a list-item addition, the external-change panel was not
found in the ~30 s the probe waited; in every one without, it was.** This is recorded as observed, with no
claim about its cause (open item 1 in the notes). The recovery surface was then read from L22–L25, whose
drafts hold no list-item edit. L10–L21 are otherwise not credited.

## L22 — `recrx`, EN; L24 — `recrx`, ES (carried regex)

L22 09:33:51, window 9261, 42 captures (09:33:52–09:34:42), disk rewrite (snippet removed) after `c14`.
L24 09:36:00, window 9283, 42 captures (09:36:02–09:36:52). Binary I. Draft: *Change to: Regular expression*,
*Confirm*, the box set to `rec-\d`; no list edit.

- `pairs/k4en.png` left = L22 `c23`, `k4-kept`, after *Keep my draft*: *"espansoConfig applied nothing. This
  reapply attempt wrote nothing, this window was not moved, and what you kept is still here exactly as it was.
  The reason follows."*, *"espansoConfig could not identify the snippet this change is about in the version on
  disk. …"*, and **Create a new snippet from supported fields**; below it the external-change panel.
  ES: L25 `c23` (`pairs` not built; read directly as `L25/small/c23.png`) shows *espansoConfig no ha aplicado
  nada. …* and **Crear un fragmento nuevo con los campos admitidos**.
- `pairs/k6en.png` left = L22 `c29`, `k6-transfer`: **What this new snippet is made from**: *Trigger —
  carried over in another trigger form, shown below, so no literal trigger is written* with *"The snippet's
  trigger is carried over in its other form, as a pattern or as a list of triggers, so it is not written as
  one literal trigger."*; *Replacement text — carried over* `Recovery expansion`; the dormant keys *not carried
  over …*; *Label — carried over* `recover one`. ES: `L24/small/c29.png`, *se traslada en otra forma de
  disparador, que se muestra abajo, así que no se escribe ningún disparador literal*.
- `pairs/k7en.png` left = L22 `c32`, `k7-trigger-side`: the position sentence; **Regular expression** box
  `rec-\d` (labelled as a regular expression, not *Trigger*) with the one-line box sentence; *Replacement text*;
  **Search terms** — *"Carried over whole, in order:"* `one`, `two`; *Undo*, *Redo*, **Create this snippet**.
  ES: `L24/small/c32.png`, *Expresión regular* `rec-\d`, *Términos de búsqueda*, *Se traslada entera, en
  orden:* `one`, `two`, *Crear este fragmento*. **Carried regex row and the `search_terms` outcome
  (carried arm): read.** *Create this snippet* was not pressed.

## L23 — `reclst`, EN; L25 — `reclst`, ES (carried `triggers` list)

L23 09:34:48, window 9272, 42 captures (09:34:49–09:35:39). L25 09:36:57, window 9294, 42 captures
(09:36:59–09:37:49). Binary I. Draft: *Change to: Triggers*, *Confirm*, nothing added (the one-item list
`:rec`).

- `pairs/k6en.png` right = L23 `c29`: the same transfer rows, *Trigger — carried over in another trigger
  form…*. ES: `L25/small/c29.png`.
- `pairs/k7en.png` right = L23 `c32`: **Triggers** — *"The new snippet fires from this list of triggers,
  carried over whole and in order:"* and `:rec` in a grey source-text box, **no input box**; then *Search
  terms*, *Carried over whole, in order:* `one`, `two`. ES: `L25/small/c32.png`, *Disparadores*, *El fragmento
  nuevo se activa con esta lista de disparadores, trasladada entera y en orden:* `:rec`. **Carried `triggers`
  list row: read, for a one-item list only**; a carried list of several items is unread (open item 1).
- `pairs/k4en.png` right = L23 `c35`, `k8-search-terms`: the external panel under the form also shows *What
  you wrote, kept here*, *Trigger — this trigger form would be replaced by another, and what it holds is
  carried over* `:rec`.

## L26, L27 — `flow`, EN / ES (superseded)

The plan pressed *Edit this snippet* on `multi-line flow`, which is not drawn for that snippet (L28), so its
later steps found nothing. Superseded by L28/L29 and not credited.

## L28 — `flow`, EN; L29 — `flow`, ES — ruling 31, the commented multi-line flow list

L28 09:40:25, window 9327, 20 captures (09:40:27–09:40:50). L29 09:40:54, window 9338, 20 captures
(09:40:55–09:41:18). Binary J. The match file is a byte copy of `flow-collections.yml`; lines 16–22 are the
snippet labelled `multi-line flow`, whose `triggers` flow list spans five lines with the comment
`# first alias` inside it.

**Screen and action.** Screen: the detail pane (`DetailPane.svelte`) for the snippet `multi-line flow`.
Action: the probe clicked its row in the snippet list (`.list button.row`), then scrolled the detail pane to
its *Source text* section; it then clicked the `:hi` row (the one-line flow list at line 5) for comparison.

- `L28/small/c04.png` (EN), `w1-detail row=true edit=false`: the list row `:one multi-line flow` with the badges
  *Several triggers* and **Not editable**; the detail pane: *Show this file's text*, *Add a snippet*, *File
  match/plan-flow-en.yml*, then the bordered sentence **"This app will not edit this snippet: this file
  contains a comment inside an inline list or map."**, then *Delete / Move / Duplicate this snippet…* and **no
  *Edit this snippet* button** (the probe's `edit=false`); **TRIGGER** — *Trigger form: Several triggers*,
  *Triggers*: `:one`, `:two`, `:three`, each *Written between double quotes*; *Replacement text* `multi-line flow
  sequence`; *Label* `multi-line flow`.
- `L28/small/c06.png` (EN), `w1b-source found=true`: **SOURCE TEXT** — *shown here as the file writes it*:
  `label: multi-line flow`, `triggers: [`, `":one",   # first alias`, `":two",`, `":three"`, `]`, `replace:
  multi-line flow sequence` — the list's line breaks, indentation and inner comment drawn as in the file.
- `L29/small/c04.png` (ES): *No editable*; **"Esta aplicación no editará este fragmento: este archivo contiene
  un comentario dentro de una lista o un mapa en línea."**; no *Editar este fragmento*; *Forma del disparador:
  Varios disparadores*, `:one`, `:two`, `:three`, *Escrito entre comillas dobles*.
- `L29/small/c07.png` (ES), `w1b-source`: *TEXTO DE ORIGEN*, the same seven lines with `# first alias`.
- `L28/small/c10.png` (EN) / `pairs/wdet.png` right = L29 `c10` (ES), `w1c-hi edit=true`: for `:hi`
  (`triggers: [":hi", ":hello", ":hey"]`, line 5) the pane **does** draw *Edit this snippet* / *Editar este
  fragmento* and no refusal, although it is in the same file.

**Result (a model's look):** the commented multi-line flow list is **drawn read-only with its source text
intact, and editing is refused for that snippet with the sentence above, in EN and ES**. The match editor was
never opened on it, so its list controls, a save and the file's bytes after a save are **unread** for that
snippet because no editing route is offered. The file on disk was unchanged by L26–L29 (`diff before.yml
after.yml`: no difference).

## L30 — `flowhi`, EN; L31 — `flowhi`, ES (the one-line flow list, for the flow style note)

L30 09:41:45, window 9349, 22 captures (09:41:47–09:42:13). L31 09:42:16, window 9360, 22 captures
(09:42:17–09:42:43). Binary K. Same file; snippet `:hi`.

- `L30/small/c06.png` / `L31/small/c06.png`, `h1-editor`: *Triggers*, **"Written between brackets on one line.
  A save keeps it that way."** / **"Escrita entre corchetes en una sola línea. Al guardar se mantiene así."**,
  items `:hi`, `:hello`, `:hey`, *Add an item*; **Change to: Trigger**, **Change to: Regular expression** and
  two refused rows, each *"The list is written between brackets on one line, and this editor changes the
  trigger form of a list written one item per line only."* / *"La lista está escrita entre corchetes en una
  sola línea, y este editor solo cambia la forma de disparador de una lista escrita con un elemento por
  línea."* — the `flowList` refusal, shown instead of `wouldDropAliases` for this three-item list.
- `L30/small/c14.png` / `L31/small/c14.png`, `h4-removed`: `:hi`, `:hey`, *New item* `:hiya`; `:hello` under
  *"These items will be taken out of the list when you save:"*. No save was pressed; the flow list's bytes
  after a save are **unread** in a window.
