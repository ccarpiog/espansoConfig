# Phase 3-8-3 — the window half of step 3-8: the reading, launch by launch

**Date:** 2026-09-24. **Spec:** `docs/decisions/3-split-notes.md` §2 *3-8* and its 2026-09-24 addendum,
rulings 30 and 31, §4.1, §4.2; `docs/decisions/3-8-2-notes.md` §5 item 1. What changed and why, the
instrument, the row table, the open items and the gates are in [`3-8-3-notes.md`](3-8-3-notes.md).

**Every statement below about what a window drew is a model's look** at a `screencapture -x -o -l <window>`
capture of the real Tauri app window, taken while `ioreg -n Root -d1` read `"IOConsoleLocked" = No`. It is
never the owner's judgement. **Every action on the page was a script-dispatched DOM event** (`.click()`, a
bubbling `click` `MouseEvent` where named, a `change` event on the picker's `<select>`, an `input` event on a
text area after setting its value) fired by the uncommitted probe; none is real keyboard or pointer input, so
**nothing here says anything about hit-testing, focus or typing**. No capture read is the lock screen: every
one shows the app's own window (title bar *espansoConfig*, sidebar, list, detail pane) with the probe's badge.
None is a hidden-page snapshot, and no mounted test is credited.

**How the launches were run.** `instrument-3-8-3/launch.sh <n> <plan> <lang> <captures>`: a fresh scratch tree
`/private/tmp/3-8-3/L<n>/`, a fresh bundle copy `…/espansoConfig-L<n>.app` (bundle identifier
`cc.carpio.espansoConfig`), `open -n --env XDG_CONFIG_HOME=…/xdg --env HOME=…/home`, the main window found
with `/private/tmp/3-8-3/winid` (layer 0, on screen, taller than 100 points), then one capture about every
1.2 s into `…/caps/cNN.png`. The lock state was read before the launch, before every capture and after the
launch, into `…/launch.txt`; the script stops at the first reading that is not `No`. **One plan per launch.**
The configuration directory held only `config/default.yml` (one comment line) and
`match/plan-<plan>-<lang>.yml`, a **byte copy of a committed synthetic corpus fixture** (`cmp` against the
corpus file: identical, logged as `fixture-copy: identical to corpus` in every `launch.txt`); the corpus files
themselves were never opened for writing. Every capture read shows only those two paths in the sidebar; the
owner's configuration was never reachable. After each launch the app was quit and the match file compared with
its `before.yml` (`disk:` line of `launch.txt`).

**The language was set through the in-app picker in every launch** (`#language-picker-select` set to `en` or
`es`, then `change`). The webview's `localStorage` follows the bundle identifier, and L01's first capture
opened in Spanish from an earlier session; from the picker step on, every capture read shows the picker reading
*English* / *Español* and the page in that language.

**The badge and the DOM line.** A yellow block over the empty middle of the window header:
`383 t=<s> <plan>-<lang> <step>` on its first line, then `<action note> || <DOM line>`. The DOM line is
read by the probe **600 ms after the step's action**, after Svelte has flushed it, and the badge is redrawn in
the same instant, so **each capture that shows a DOM line shows it beside the pixels it describes** — the DOM
state and the capture are read in one launch and, to within the capture interval, at one moment (§4.2). A
badge showing only the action note (no `||`) was captured in the 600 ms before the read and is not cited for
DOM state. The DOM line's words: `undo`/`redo`/`save`/`close` = the surface's *Undo*, *Redo*, *Save this
snippet* / *Save this file*, *Stop editing* button, found by its exact dictionary text, `on` (enabled), `off`
(`disabled`) or `none` (absent); `saving`, `cannotStop`, `unsaved` = whether the section's text contains the
dictionary's *Saving…*, *This save cannot be stopped…*, *Unsaved changes* sentence; `discardPanel` = whether
the *Discard my changes* button is present; `box` = the text area's `readOnly`; `text=<length>:<FNV-1a>` of the
text area's value; `edits` = whether it holds the probe's `EDIT-A` / `EDIT-B` markers; `held` = the raw save
commands the hold has caught so far in this launch (cumulative; it keeps its value after the release). The
refusal line's words name the dictionary sentences found (`rangeNotContiguous`, `lineEndings`,
`notEditable`), the *Go to the whole file's text* button (`offer`), the *pointing at another file* sentence
(`elsewhere`), the number of text areas, and, when the snippet editor is absent, the file-text section
(`fileText`), its *Edit this file's text* button (`rawEditorOpen`) and the whole-document editor's carriage-return
sentence (`rawEditorCr`). **The DOM lines quoted below are transcribed from the badges in the named captures**:
the window title did not follow `document.title` (every `launch.txt` title column reads `espansoConfig`), so
the capture is the only carrier of the line.

**The held save.** At step `h1-save-held` the probe armed a hold and pressed *Save*. The hold wraps
`window.fetch` (Tauri's IPC transport on macOS is a `fetch` to `ipc://localhost/<command>`) and delays a
`save_match_item_text` or `save_raw_document` request **before it is sent** until the probe releases it at
`r1-released`, about 12.6 s later. So nothing reached Rust while the save was held; the page was in its
`saving` state throughout. At `h3-pressed-in-hold` the probe pressed *Undo*, *Redo* and *Stop editing* two
ways each — `.click()` and a dispatched bubbling `click` event — and compared the text area's value before the
presses with its value 600 ms after them (`unchangedByPresses`) and again 3.1 s after them
(`unchangedSincePresses`).

Captures were read downscaled to 1400 px wide (`…/small/cNN.png`, `sips -Z 1400`); the control comparisons
below were read on full-resolution crops of the same captures (`L03/cmp-head.png`, `L03/cmp-btn.png`,
`L04/cmp-1825.png`, `L05/cmp-controls.png`). The window was 1180×760 points; every capture is 2360×1520 px.

**Lock state:** every one of the ten launches' `launch.txt` reads `"IOConsoleLocked" = No` before the launch,
at every capture and after it; no reading was `Yes` or unreadable (`rg -l 'Yes|unreadable|stopping'` over all
ten files finds nothing). The screen was checked again at 11:54:09 after the last launch: `No`.

---

## Binaries

| Binary | Main executable SHA-256 | Launches | Credited |
|---|---|---|---|
| A | `2be0492078a81ca3bc3c4d0802e572203fba116e3875403829cf9187e286ecbc` | L01 | no — the badge was unstyled (below) and every DOM line was read before Svelte flushed |
| B | `3313609a8c290bc86de4cc2fba27a0d1e5ff81a5ae1a6542b98c4dccf363c9cb` | L02 | no — the badge was still unstyled, and the `d4-undo` step did not press *Undo* |
| C | `082688893b37bef1926b9bbe7c360685840b3e1403f73b7891c6fc1b3409a447` | L03–L10 | yes |

Every rebuild changed only `probe.ts`; the app's tracked source is the same in all three. **Binary A's badge**:
the app's CSP (`style-src 'self'`) drops a `style` attribute, so the badge set through `setAttribute('style', …)`
was an unstyled block below the 100vh app, off screen, until an `scrollIntoView` scrolled the document root and
dragged it into view (L01 `c11`). Binary C sets the style through the CSSOM and scrolls only the nearest
scrollable ancestor, never the document root.

---

## L01, L02 — `snippet`, EN (exploratory, not credited)

L01 11:40:23, window 9642, 45 captures; L02 11:43:04, window 9653, 48 captures. Binaries A and B. They
established that the hold catches `save_match_item_text` (L01's badge `held=save_match_item_text`) and exposed
the two instrument defects above. L02's file came back with `after the blank EDIT-A EDIT-B` because its
*Undo* step did not press. Neither is cited for any row.

## L03 — `snippet`, EN; L04 — `snippet`, ES (rows 1, 4a, 5)

L03 11:44:37, window 9664, 48 captures (11:44:39–11:45:34). L04 11:46:42, window 9677, 48 captures
(11:46:43–11:47:39). Binary C. Match file: a byte copy of `block-scalars.yml`. Snippet `:interior-blank`, a
`|` block scalar whose interior blank line is scalar content, led by a two-line comment block.

**Screen and action (R38, ruling 31).** Screen: the snippet text editor (`RawSnippetEditor.svelte`) in the
detail pane. Action: the probe clicked the file row, the `:interior-blank` row, then *Edit this snippet's
text*; then typed twice into the box, pressed *Undo* once, and pressed *Save this snippet* under the hold.

- **Load** — L03 `c12`/`c13` (11:44:52), DOM line
  `scrolled || DOM rawSnippet undo=off redo=off save=off close=on saving=0 cannotStop=0 unsaved=0 discardPanel=0 box=editable text=257:3527a417 edits=-- held=0`.
  Seen: *File match/plan-snippet-en.yml*, *Stop editing* (dark), the scope sentence *"The lines this snippet
  owns in the file, exactly as the file writes them. Saving replaces these lines; if anything outside them
  would change, the save is refused and nothing is written."*, *"Starts at line 48 of the file."*, and a text
  area holding seven lines: the two comment lines `# A blank line that is scalar CONTENT. …`, `- trigger:
  :interior-blank`, `replace: |`, `before the blank`, **an empty line**, `after the blank`, `label:
  after-interior-blank` — the block's interior blank line drawn as a blank line inside the box, and the
  leading comment block inside the snippet's text. *Undo*, *Redo*, *Save this snippet* drawn grey. ES: L04
  `c12` (11:46:56), the same DOM line (`text=257:3527a417`), *Archivo*, *Dejar de editar*, *"Las líneas que
  este fragmento ocupa en el archivo, tal como el archivo las escribe. Al guardar se sustituyen estas líneas;
  si algo fuera de ellas fuera a cambiar, el guardado se rechaza y no se escribe nada."*, *"Empieza en la
  línea 48 del archivo."*, the same seven lines.
- **Draft** — L03 `c16` (`d3-editB`):
  `typed=1 || DOM rawSnippet undo=on redo=off save=on close=on saving=0 cannotStop=0 unsaved=1 discardPanel=0 box=editable text=271:6f8db818 edits=AB held=0`;
  *Unsaved changes* drawn beside the file name. L03 `c19` (11:45:00, `d4-undo`):
  `undo-pressed=on || DOM rawSnippet undo=on redo=on save=on close=on saving=0 cannotStop=0 unsaved=1 discardPanel=0 box=editable text=264:2dedae2f edits=A- held=0`;
  the box reads `after the blank EDIT-A`; *Undo*, *Redo*, *Save this snippet* and *Stop editing* drawn with
  **dark** labels (*Stop editing*: `L03/cmp-head.png` row 2; the three buttons: `small/c19.png`, against
  `c13`'s grey set in `cmp-btn.png` row 1). ES: L04
  `c16`, `c18` (`d4-undo`, same DOM line), *Cambios sin guardar*; `L04/cmp-1825.png` top: *Dejar de editar*
  dark, on its own row under the file name.
- **Held save (CF-55, row 4a)** — L03 `c25` (11:45:07, `h3-pressed-in-hold`):
  `pressed undo=off redo=off close=off || DOM rawSnippet undo=off redo=off save=off close=off saving=1 cannotStop=1 unsaved=1 discardPanel=0 box=readonly text=264:2dedae2f edits=A- held=save_match_item_text unchangedByPresses=1`.
  Seen in the same capture: *"This save cannot be stopped, so the editor stays open until it answers."*, the box
  still reading `after the blank EDIT-A` (greyed), **Undo, Redo and Save this snippet drawn with grey labels**,
  *Saving…* after them, and **Stop editing drawn with a grey label** (`L03/cmp-head.png` row 3, `cmp-btn.png`
  row 3) — no discard confirmation drawn. L03 `c27` (`h4-held`) adds `unchangedSincePresses=1`; L03 `c29`
  (11:45:12, `h5-held`) is the same DOM line without the comparison and the same drawing (`cmp-head.png` row 4,
  `cmp-btn.png` row 4). ES: L04 `c25` (11:47:12), the same DOM line with `unchangedByPresses=1`; *Este guardado
  no se puede detener, así que el editor sigue abierto hasta que responda.*, *Guardando…*, **Deshacer,
  Rehacer, Guardar este fragmento and Dejar de editar all drawn grey** (`L04/cmp-1825.png` bottom).
- **Save outcome** — L03 `c34` (11:45:18, `r2-outcome`):
  `scrolled || DOM rawSnippet undo=off redo=on save=off close=on saving=0 cannotStop=0 unsaved=0 discardPanel=0 box=editable text=264:2dedae2f edits=A- held=save_match_item_text`.
  Seen: *"The file was written. What is on disk now is exactly the text that was sent."*, the backup sentence,
  *Dismiss*; *Unsaved changes* gone; *Stop editing* dark again; *Undo* and *Save this snippet* grey, **Redo
  dark** (open item 1 of the notes). ES: L04 `c33` (11:47:21), same DOM line; *"Se ha escrito el archivo. Lo
  que hay ahora en el disco es exactamente el texto que se envió."*, *Descartar*, *Rehacer* dark.
- **Disk.** L03 and L04 `launch.txt`: `disk: changed`, and `diff before.yml after.yml` is exactly one line,
  `54c54`, `after the blank` → `after the blank EDIT-A`. Every other byte — the block's interior blank line,
  the comment block, the other ten snippets — is identical.

## L05 — `whole`, EN; L06 — `whole`, ES (row 4b, and R38 on the whole-document surface)

L05 11:47:45, window 9688, 48 captures (11:47:46–11:48:43). L06 11:48:49, window 9699, 48 captures
(11:48:50–11:49:46). Binary C. Match file: a byte copy of `block-scalars.yml` (2346 bytes, LF only). Screen:
the whole-document editor (`RawEditor.svelte`). Action: file row, *Show this file's text*, *Edit this file's
text*, two edits, *Undo*, *Save this file* under the hold.

- **Load** — L05 `c12` (11:48:00):
  `scrolled || DOM rawEditor undo=off redo=off save=off close=on saving=0 cannotStop=0 unsaved=0 discardPanel=0 box=editable text=2346:63223e7c edits=-- held=0`
  (the box holds all 2346 characters); *"Saving writes this file's whole text exactly as it appears here. This
  is not an edit to one snippet: the entire document is replaced."*, the box from `# Block-scalar matrix.`
  down. ES: L06 `c12`.
- **Before the save** — L05 `c19` (`d4-undo`):
  `undo-pressed=on || DOM rawEditor undo=on redo=on save=on close=on saving=0 cannotStop=0 unsaved=1 discardPanel=0 box=editable text=2353:63053538 edits=A- held=0`;
  *Stop editing*, *Undo*, *Redo*, *Save this file* drawn dark (`L05/cmp-controls.png` rows 1 and 3). ES: L06
  `c19`, same DOM line; *Dejar de editar* dark (`cmp-controls.png` row 5).
- **Held save (CF-55, row 4b)** — L05 `c25` (11:48:15):
  `pressed undo=off redo=off close=off || DOM rawEditor undo=off redo=off save=off close=off saving=1 cannotStop=1 unsaved=1 discardPanel=0 box=readonly text=2353:63053538 edits=A- held=save_raw_document unchangedByPresses=1`.
  Seen: *This save cannot be stopped, so the editor stays open until it answers.*, *Saving…*, **Undo, Redo,
  Save this file and Stop editing all drawn with grey labels** (`cmp-controls.png` rows 2 and 4). L05 `c27`:
  `unchangedSincePresses=1`. ES: L06 `c25` (11:49:19), same DOM line with `unchangedByPresses=1`; *Deshacer*,
  *Rehacer*, *Guardar este archivo*, *Guardando…*, **Dejar de editar grey** (`cmp-controls.png` row 6).
- **Save outcome** — L05 `c33` (11:48:25):
  `scrolled || DOM rawEditor undo=off redo=on save=off close=on saving=0 cannotStop=0 unsaved=0 discardPanel=0 box=editable text=2353:63053538 edits=A- held=save_raw_document`;
  *"The file was written. What is on disk now is exactly the text that was sent."*, *Dismiss*, *Redo* dark.
  ES: L06 `c33`, *Se ha escrito el archivo…*, *Descartar*, *Rehacer* dark.
- **Disk.** L05 and L06: `disk: changed`, one line `54c54`, `after the blank` → `after the blank EDIT-A`.
  The *EDIT-A* line is below the box's visible region in every capture; its presence is the DOM's
  (`edits=A-`) and the disk diff's, not the pixels'.

## L07 — `holed`, EN; L08 — `holed`, ES (row 2, R38 disjoint ownership)

L07 11:49:56, window 9710, 36 captures (11:49:57–11:50:39). L08 11:50:44, window 9721, 36 captures
(11:50:45–11:51:26). Binary C. Match file: a byte copy of `run-based-removal-boundaries.yml`, whose two
snippets each hold a file-owned comment inside their hull: `:folded-above-a-shallow-comment` (four comment lines
at column zero under a folded block indented six, then `second:`) and `:leading-comment-block` (an interior
`vars` comment with a blank line under it).

**Screen and action (ruling 31).** Screen: the snippet text editor in the detail pane. Action: the
`:leading-comment-block` row, *Edit this snippet's text*, *Stop editing*; then the
`:folded-above-a-shallow-comment` row, *Edit this snippet's text*, then *Go to the whole file's text*.

- L07 `c10`/`c12` (11:50:10), `:leading-comment-block`:
  `scrolled || DOM rawSnippet rangeNotContiguous=1 lineEndings=0 notEditable=0 offer=on elsewhere=0 textareas=0 save=none close=on`.
  L07 `c14`, after *Stop editing*: `rawSnippet.close=on || DOM rawSnippet absent fileText=0 rawEditorOpen=0 rawEditorCr=0`.
- L07 `c20` (11:50:20), `:folded-above-a-shallow-comment`, the same refusal line. Seen: *Stop editing*, and one
  bordered panel: *"At least one comment among this snippet's lines belongs to the file rather than to the
  snippet, so the snippet's text is not one run of lines and cannot be edited here on its own. The whole file's
  text can be edited instead."* and the button **Go to the whole file's text**; **no text box, no Undo/Redo, no
  save control** (`textareas=0 save=none`).
- L07 `c22` (`s10-offer`), after pressing the offer:
  `rawSnippet.openWholeDocument=on || DOM rawSnippet absent fileText=1 rawEditorOpen=1 rawEditorCr=0`.
  L07 `c24` (11:50:24): the snippet editor is gone; *Hide this file's text*, *FILE TEXT*, *"This is the file
  itself, not the snippets read out of it."*, **Edit this file's text**, *Replace this file's text from a
  backup entry*, and the file's text from its first line, the four column-zero comment lines drawn between
  `first: 'one'` and `second: 'two'`. *Edit this file's text* was **not pressed** in this launch.
- ES: L08 `c12`, `c20` (11:51:07), the same refusal lines; *Dejar de editar*; *"Al menos un comentario entre las
  líneas de este fragmento pertenece al archivo y no al fragmento, así que el texto del fragmento no es un único
  tramo de líneas y no se puede editar aquí por separado. En su lugar se puede editar el texto del archivo
  completo."*; **Ir al texto del archivo completo**. L08 `c25` (11:51:13):
  `waiting || DOM rawSnippet absent fileText=1 rawEditorOpen=1 rawEditorCr=0`; *Ocultar el texto de este
  archivo*, *TEXTO DEL ARCHIVO*, **Editar el texto de este archivo**.
- Disk: `disk: unchanged` in both launches.

## L09 — `cr`, EN; L10 — `cr`, ES (row 3, R38 `\r`)

L09 11:51:31, window 9732, 36 captures (11:51:32–11:52:14). L10 11:52:19, window 9743, 36 captures
(11:52:20–11:53:02). Binary C. Match file: a byte copy of `file-comments-and-mixed-endings.yml`: the snippet
`:crlf-anchor` owns the file's two CRLF lines; `:ends-the-file` is LF-only and ends the file with no line
break.

**Screen and action (ruling 31).** Screen: the snippet text editor, then the file-text view. Action: the
`:crlf-anchor` row, *Edit this snippet's text*, *Stop editing*; the `:ends-the-file` row, *Edit this snippet's
text*, *Stop editing*; *Show this file's text*.

- L09 `c12` (11:51:45), `:crlf-anchor`:
  `scrolled || DOM rawSnippet rangeNotContiguous=0 lineEndings=1 notEditable=0 offer=none elsewhere=0 textareas=0 save=none close=on`.
  Seen: one panel, *"This snippet's text contains a carriage return, which a text box cannot keep. Rather than
  change it without being asked, this editor will not open this snippet's text."*, **no fallback offer**, no
  box, no save control; *Stop editing* only.
- L09 `c21` (11:51:56), `:ends-the-file` in the same file:
  `scrolled || DOM rawSnippet undo=off redo=off save=off close=on saving=0 cannotStop=0 unsaved=0 discardPanel=0 box=editable text=73:0478bf24 edits=-- held=0`.
  Seen: *"Starts at line 19 of the file."* and a box with `- trigger: ':ends-the-file'` and `replace: 'nothing
  terminates this line'` — an LF-only snippet of a file that holds `\r` elsewhere opens (ruling 12). Nothing was
  typed or saved.
- L09 `c25`/`c27` (11:52:03), after *Show this file's text*:
  `waiting || DOM rawSnippet absent fileText=1 rawEditorOpen=0 rawEditorCr=1`. Seen: *FILE TEXT*, *"This file
  uses carriage returns in its line endings, and this editor cannot give them back exactly as they are. Rather
  than rewrite every line ending in the file without being asked, it will not open this file for editing."*,
  **no *Edit this file's text* button**, and the file's text.
- ES: L10 `c12` (11:52:33), same refusal line; *"El texto de este fragmento contiene un retorno de carro, que un
  cuadro de texto no puede conservar. En lugar de cambiarlo sin que nadie lo pida, este editor no abrirá el
  texto de este fragmento."*; L10 `c21` (11:52:44), the same `:ends-the-file` DOM line, *Empieza en la línea 19
  del archivo.*; L10 `c27` (11:52:51), `fileText=1 rawEditorOpen=0 rawEditorCr=1`, *"Este archivo usa retornos
  de carro en sus saltos de línea, …, no abrirá este archivo para editarlo."*
- Disk: `disk: unchanged` in both launches.
