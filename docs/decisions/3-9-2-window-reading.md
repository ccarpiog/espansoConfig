# Phase 3-9-2 — the window half of step 3-9: the reading, launch by launch

**Date:** 2026-09-24. **Spec:** `docs/decisions/3-split-notes.md` §2 *3-9* and its 2026-09-24 addendum,
ruling 30, §4.1; `docs/decisions/3-9-1-notes.md` §1 (what the model and the components draw). What changed
and why, the instrument, the open items and the gate statement are in [`3-9-2-notes.md`](3-9-2-notes.md).

**Every statement below about what a window drew is a model's look** at a `screencapture -x -o -l <window>`
capture of the real Tauri app window, taken while `ioreg -n Root -d1` read `"IOConsoleLocked" = No`. It is
never the owner's judgement. **Every action on the page was a script-dispatched DOM event** (`.click()` on a
sidebar row button, a `change` event on the picker's `<select>` after setting its value) fired by the
uncommitted probe; none is real keyboard or pointer input. No capture read is the lock screen: every one shows
the app's own window (title bar *espansoConfig*, sidebar, list pane, detail pane, footer) with the probe's
badge. None is a hidden-page snapshot, and no mounted test is credited.

## How the launches were run

`instrument-3-9-2/launch.sh <n> <lang> <captures>`: a fresh scratch tree `/private/tmp/3-9-2/L<n>/`, a fresh
bundle copy `…/espansoConfig-L<n>.app` (bundle identifier `cc.carpio.espansoConfig`), `open -n --env
XDG_CONFIG_HOME=…/xdg --env HOME=…/home`, the main window found with `/private/tmp/3-9-2/winid` (layer 0, on
screen, taller than 100 points), then one capture about every 1.4 s into `…/caps/cNN.png` (2360 × 1520 px;
1400-px copies in `…/small/`). The lock state was read before the launch, before every capture and after the
launch, into `…/launch.txt`; the script stops at the first reading that is not `No`. After the last capture the
app was killed and the scratch configuration compared with its pre-launch copy (`disk:` line).

**One plan per launch**, the same plan in each: set the language, then scope the list to each of five files in
turn, six seconds each. The configuration directory held only synthetic, neutral files written for this phase
(`instrument-3-9-2/config/*.yml`, `instrument-3-9-2/match/*.yml`) plus a one-snippet marker file
`match/probe-walk-<lang>.yml` from which the probe reads the language. Every capture read shows only those
seven paths in the sidebar; the owner's configuration was never reachable.

**The language was set through the in-app picker in every launch** (`#language-picker-select` set to `en` or
`es`, then `change`). Every capture cited below shows the picker reading *English* / *Español* and the footer
reading *Interface language: English* / *Idioma de la interfaz: Español*.

**The badge and the DOM line.** A yellow block over the bottom-right of the window (footer and the empty
bottom of the detail pane): `392 t=<s> <lang> s<k> <file>` on its first line, then `|| <DOM line>`, read
600 ms after the row was pressed and redrawn in the same instant, so each capture cited shows the DOM line
beside the pixels it describes. The DOM line's words: `lang` = `<html lang>`; `row`/`current` = the sidebar row
was found and carries `aria-current="true"`; `mark` = which dictionary key the row's non-warning mark text
equals (`none` if no mark); `title` = which key the mark's `title` attribute equals; `scope` = the inspector's
`<section class="scope">` is present; `auto` = which key the inspector's `_` paragraph equals; `state` = which
`browser.fileScope.imports.*` key the state sentence equals; `rows` = the number of `<li>` in the inspector's
`<ol>`; `unsupportedAt` = the 1-based positions of rows drawn as an unsupported reason. **The DOM lines quoted
below are transcribed from the badges in the named captures.** A DOM line is DOM evidence, not a window
reading; it is cited beside the pixels, never instead of them.

## Launches and the lock state

| Launch | Plan | Lang | Window | Captures (times) | Lock before / every capture / after | Disk | Status |
|---|---|---|---|---|---|---|---|
| L01 | walk | EN | 9758 | 36 (12:38:29–12:39:19) | No / No ×36 / No | unchanged | exploratory, not credited: the badge covered the language picker |
| L02 | walk | EN | 9769 | 36 (12:40:09–12:40:59) | No / No ×36 / No | unchanged | read |
| L03 | walk | ES | 9780 | 36 (12:41:05–12:41:55) | No / No ×36 / No | unchanged | read |
| L04 | walk | EN | 9792 | 36 (12:50:02–12:50:53) | No / No ×36 / No | unchanged | read — F1 recapture over the fixed tree |
| L05 | walk | ES | 9803 | 36 (12:50:57–12:51:47) | No / No ×36 / No | unchanged | read — F1 recapture over the fixed tree |

L01 drew the same inspector content as L02 (its `c05`, `c10`, `c19` were looked at), but its badge sat over the
header's picker, so the picker's reading is not visible in it; the badge was moved to the bottom right and the
bundle rebuilt before L02. Nothing below cites L01 except the first sight of the numbering finding, which L02
and L03 reproduce.

## (1) Ordered imports with unsupported entries — `match/imports-listed.yml`

The file writes, in order: `first-sample.yml`, the flow sequence `[second-a.yml, second-b.yml]`,
`'third-sample.yml'` (single-quoted), the flow mapping `{path: fourth-sample.yml}`, `../match/fifth-sample.yml`.

**EN — read, L02 `c03`** (full-resolution crop `L02/cmp-list.png`). DOM: `lang=en row=found current=1
mark=none title=none scope=1 auto=none state=imports.listed rows=5 unsupportedAt=2,4`. Drawn in the list pane,
under the file's findings block and above the snippet row `:sample-one`: a bordered block headed **Imports**;
the sentence *In the order the file writes them, shown as written. This app does not look up these files or
check whether they exist.*; then five rows in file order — `first-sample.yml` in a source-text box; *Written as
a list, not as a single path. It stays in the file as written.* in an outlined span; `third-sample.yml` in a
source-text box with *Written between single quotes* under it; *Written as a set of keys, not as a single path.
It stays in the file as written.*; `../match/fifth-sample.yml` in a source-text box. No `_` paragraph; the
sidebar row carries no mark. No path is resolved, no existence is claimed, no control is drawn in the block.

**ES — read, L03 `c03`** (`L03/cmp-list.png`). DOM: the same line with `lang=es`. Drawn: **Importaciones**; *En
el orden en que las escribe el archivo, tal como están escritas. Esta aplicación no busca estos archivos ni
comprueba si existen.*; the same five rows in the same order, the two reasons reading *Escrita como una lista,
no como una sola ruta. Se conserva en el archivo tal como está escrita.* and *Escrita como un conjunto de
claves, no como una sola ruta. Se conserva en el archivo tal como está escrita.*, the quoted entry's marker
*Escrito entre comillas simples*. Nothing clipped; the sentences wrap inside the block.

**Against 3-9-1: one contradiction (finding F1).** 3-9-1 specifies the list as "numbered by the browser, so
the number is the entry's position in the file; an unsupported entry keeps its number too"
(`FileScope.svelte`'s style comment; `3-9-1-notes.md` §1.1 "1-based position included"). **The window draws
the numbers `2.` and `4.` only**, beside the two unsupported reasons; the three rows drawn through
`SourceText` (positions 1, 3, 5) have **no number**, in EN and ES alike (L02 and L03 crops; also L01 `c05`).
The order is right and every entry is present, but a reader cannot read positions 1, 3 and 5 from the screen,
and the visible `2.`/`4.` alone suggest a list that starts at two. The DOM line says the `<ol>` holds five
`<li>` (`rows=5`), so the numbers are lost in drawing, not in the model. A code reading suggests the cause —
`SourceText`'s root is a block `div` with `white-space: pre; overflow-x: auto` as the `<li>`'s first child,
and WebKit does not draw an outside marker beside such a box — but that cause was **not verified**. The phase
review made F1 a closure blocker; it was fixed in `FileScope.svelte` (the notes' §8) and re-read below.

**After the fix — EN read, L04 `c03`; ES read, L05 `c03`** (crops `L04/cmp-list.png`, `L05/cmp-list.png`). DOM
line as in L02/L03 (`rows=5 unsupportedAt=2,4`). Drawn: a grey digit at the left of every row, **`1` beside
`first-sample.yml`, `2` beside the list reason, `3` beside `third-sample.yml` (its *Written between single
quotes* / *Escrito entre comillas simples* marker under it), `4` beside the set-of-keys reason, `5` beside
`../match/fifth-sample.yml`**, in file order, EN and ES. The source-text boxes, the reasons, the heading and the
sentence are as L02/L03 drew them, and nothing is clipped. **F1 no longer holds; row (1) matches 3-9-1.**

Also drawn, not 3-9-1's: the file's findings block above the inspector (*What this app noticed in this file:*
/ *Lo que esta aplicación ha detectado en este archivo:*) lists two findings, *The key “imports” holds a list,
which is not the shape espansoConfig's model allows there.* and *… holds a set of keys …* (ES: *La clave
«imports» contiene una lista…* / *…un conjunto de claves…*). See the notes' open items.

## (2) No `imports` key — `match/imports-absent.yml`

**EN — read, L02 `c08`.** DOM: `… current=1 mark=none title=none scope=1 auto=none state=imports.absent rows=0
unsupportedAt=-`. Drawn: the block with **Imports** and *This file has no “imports” key.*, no list, no `_`
paragraph, above the row `:sample-two`. **Matches 3-9-1.**

**ES — read, L03 `c08`.** Same DOM line with `lang=es`. Drawn: **Importaciones**, *Este archivo no tiene la
clave «imports».* **Matches 3-9-1.**

## (3) An empty `imports` list — `match/imports-empty.yml`

**EN — read, L02 `c12`.** DOM: `… state=imports.empty rows=0 unsupportedAt=-`. Drawn: **Imports**, *This file
writes “imports” as an empty list.*, no list, no `_` paragraph. Distinct from (2) on screen. **Matches 3-9-1.**

**ES — read, L03 `c12`.** Drawn: **Importaciones**, *Este archivo escribe «imports» como una lista vacía.*
**Matches 3-9-1.**

## (4) A `_` match file — `match/_not-auto-loaded.yml`

**EN — read, L02 `c16`.** DOM: `… mark=notAutoLoaded.mark title=notAutoLoaded.explanation scope=1
auto=notAutoLoaded.explanation state=imports.absent rows=0 unsupportedAt=-`. Drawn in the inspector, above
**Imports**: *Not loaded automatically: the file name starts with “_”, and espanso’s default include pattern
skips such files. What it holds is used only when something brings it in: another file’s “imports”, or a
configuration’s “includes” or “extra_includes”.*; then *This file has no “imports” key.* In the sidebar, under
the name, the outlined mark *Not loaded automatically* beside the count `1` (full-resolution crop
`L02/cmp-sidebar.png`, taken from `c20`, where the same row is unselected). No word "inactive" is drawn.
**Matches 3-9-1.**

**ES — read, L03 `c16`.** Drawn: *No se carga automáticamente: el nombre del archivo empieza por «_», y el
patrón de inclusión predeterminado de espanso omite esos archivos. Lo que contiene solo se usa cuando algo lo
incorpora: el «imports» de otro archivo, o el «includes» o el «extra_includes» de una configuración.*, then
*Este archivo no tiene la clave «imports».*; sidebar mark *No se carga automáticamente* (`L03/cmp-sidebar.png`).
**Matches 3-9-1.**

**The sidebar tooltip — unread, EN and ES.** The mark's explanation is carried by a native `title` attribute,
which WebKit shows only after a real pointer rests over the element; a script-dispatched event does not raise
it, and real pointer input is reserved to a person by §4.1 (and was not produced). No capture shows a tooltip.
What *was* read is DOM evidence only: in L02 `c16` and L03 `c16` the badge reports
`title=notAutoLoaded.explanation`, i.e. the attribute's text equals the dictionary's explanation sentence in
that language. That the tooltip draws, and how, stays **unread**, owed to a person if wanted.

## (5) A `_` configuration profile — `config/_neutral-profile.yml`

**EN — read, L02 `c20`.** DOM: `… mark=underscoreProfile.mark title=underscoreProfile.explanation scope=1
auto=underscoreProfile.explanation state=imports.absent rows=0 unsupportedAt=-`. Drawn: *The file name starts
with “_”. For snippet files, espanso’s default include pattern skips such names; this is a configuration file,
and this app does not check how espanso treats one named this way.*, then **Imports** / *This file has no
“imports” key.*, then *There are no snippets here.* (list count *0 of 0*). Sidebar, under *PROFILES*: the mark
*Name starts with “_”* beside the unread dash `–` (`L02/cmp-sidebar.png`). The profile sentence makes no loading
claim and says neither "not loaded automatically" nor "inactive". **Matches 3-9-1** (§5, the review fix).

**ES — read, L03 `c20`.** Drawn: *El nombre del archivo empieza por «_». En los archivos de fragmentos, el
patrón de inclusión predeterminado de espanso omite esos nombres; este es un archivo de configuración, y esta
aplicación no comprueba cómo trata espanso uno con este nombre.*, **Importaciones**, *Este archivo no tiene la
clave «imports».*, *Aquí no hay ningún fragmento.*; sidebar *PERFILES*, mark *El nombre empieza por «_»*
(`L03/cmp-sidebar.png`). **Matches 3-9-1.** The profile's tooltip is unread for the reason given under (4);
DOM only: `title=underscoreProfile.explanation`.

## Unread, and why

- Both sidebar tooltips (the `_` match file's and the `_` profile's), EN and ES: native `title` tooltips need
  real pointer hover (§4.1 reserves it to a person).
- Real keyboard and pointer input on the sidebar rows: every press was a script-dispatched `.click()`.
- The `notRead` state (a file the substrate does not accept) and the `unsupportedShape` state (`imports`
  written as a scalar or mapping): not in this phase's list of shapes and not exercised.
- An entry holding a line break or a `\r` (3-9-1 open item 3): not exercised.
- Layout acceptance and wording clarity: judgements §4.1 reserves to a person; nothing here claims them.
