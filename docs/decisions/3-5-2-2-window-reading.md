# Phase 3-5-2-2 — the window half of step 3-5: the reading, launch by launch

**Date:** 2026-09-24. **Spec:** `docs/decisions/3-split-notes.md` §2 *3-5* and its two addenda, rulings
30 and 31, §4.1. What changed and why, the instrument, the row table, the open items and the gates are in
[`3-5-2-2-notes.md`](3-5-2-2-notes.md).

**Every statement below about what a window drew is a model's look** at a `screencapture -l <window>`
capture of the real Tauri app window, taken while `ioreg -n Root -d1` read `"IOConsoleLocked" = No` with
no `CGSSessionScreenIsLocked` key. It is never the owner's judgement. **Every action on the page was a
script-dispatched DOM event** (`.click()`, a `change` event on the picker's `<select>`, an `input` event
on a text area, `setSelectionRange`, `scrollIntoView`) fired by the uncommitted probe; none is real
keyboard or pointer input, so **nothing here says anything about hit-testing, focus or typing**.

**How the launches were run.** `instrument-3-5-2-2/launch.sh <n> <plan> <lang> <seconds>`: a fresh
scratch tree `/private/tmp/3522/L<n>/`, a fresh bundle copy `…/espansoConfig-L<n>.app` (same bundle
identifier `cc.carpio.espansoConfig`), `open -n --env XDG_CONFIG_HOME=…/xdg --env HOME=…/home`, the
window number found with `winid` (CoreGraphics window list), then one `screencapture -x -o -l <window>`
per second into `…/caps/cNN.png`, with the lock state read before the launch, before every capture and
after the launch (`…/launch.txt`). **One plan per launch.** The configuration directory held only the
two synthetic files of the instrument (`config/default.yml`, a comment line; `match/plan-<plan>-<lang>.yml`,
three neutral snippets `:block`, `:two`, `:plain`), and every capture read shows `match/plan-<plan>-<lang>.yml`
and `config/default.yml` as the only files in the sidebar. The owner's configuration was never reachable:
`XDG_CONFIG_HOME/espanso` existed, and `HOME` pointed into the scratch tree.

**The language was set through the in-app picker in every launch**: the probe set
`#language-picker-select` to `en` or `es` and dispatched `change`; every capture read shows the picker
reading *English* / *Español* and the whole page in that language.

**The badge.** The probe draws a small yellow line in the bottom-left corner
(`3522 t=<s> <plan>-<lang> <step> checkboxes=<n>`), naming the step a capture belongs to and the count of
`input[type="checkbox"]` elements in the whole document at that step. It covers the left end of the
status line at the bottom of the window; nothing of the editor is under it.

Captures were read downscaled to 1400 px wide (`…/small/cNN.png`, made with `sips -Z 1400`) unless a
full-size path is given. The window was 1182×762 points (1180×760 in L08) and every capture 2360×1520 px.

---

## L01 — `cursor`, EN

Started 07:13:29; window 8890 at 07:13:30; 14 captures, last `c14` at 07:13:43. Lock before, at every
capture and after: `IOConsoleLocked = No`. Binary A.

- `/private/tmp/3522/L01/caps/c06.png` (full size), badge `c1-control`: snippet `:two` selected, the
  editor scrolled to *Replacement text* holding `One $|$ and two $|$ markers`; directly under the box the
  **Insert cursor position** button and its hint *"After expanding, espanso places the cursor where $|$
  stands. This control puts one marker where the cursor is in the box above, or selects the marker when
  the text already holds one."*; then *Take this key out*. The *Markdown content* and *HTML content*
  boxes below are empty and each carries the dormant role sentence.
- `/private/tmp/3522/L01/caps/c12.png` (full size), badge `c2-advisory`, after the probe set the
  selection to 0 and clicked the button: a new sentence between the hint and *Take this key out*:
  *"This text holds 2 cursor markers ($|$). Espanso places the cursor at one of them, so this action
  neither adds another nor picks one: remove the ones you do not want."* The text is unchanged.

## L02 — `cursor`, ES

Started 07:13:55; window 8909; 14 captures, last `c14` at 07:14:09. Lock: No throughout. Binary A.

- `/private/tmp/3522/L02/caps/c12.png` (full size; badge already `done`, the state is the advisory's):
  *Texto de sustitución*; **Insertar la posición del cursor**; the hint *"Tras expandir, espanso coloca
  el cursor donde está $|$. …"*; the advisory *"Este texto tiene 2 marcas de cursor ($|$). Espanso coloca
  el cursor en una de ellas, así que esta acción no añade otra ni elige ninguna: quita las que no
  quieras."*; *Quitar esta clave*. The dormant role sentences wrap to three lines; nothing is clipped.

## L03 — `editor`, EN

Started 07:14:15; window 8920; 60 captures, last `c60` at 07:15:14. Lock: No throughout. Binary A.
Snippet `:block` (a `|` block `replace`, `label`, `comment`, `word: true`, `uppercase_style: shouting`,
`force_mode: clipboard`, `force_clipboard: false`).

- `…/L03/caps/c07.png` (full size), `e1-top`: *File match/plan-editor-en.yml*, *Stop editing*;
  *Trigger* `:block` in a one-line box; *Replacement text* in a multi-line box holding the two block
  lines; *Insert cursor position* and its hint; *Markdown content* (empty, dormant sentence), *HTML
  content*.
- `…/L03/small/c12.png`, `e2-label`: *Label* (one-line box), *Comment* (multi-line box); heading **Word
  boundary** with *Whole word* holding the text `true` in a text box, then *Boundary on the left* and
  *on the right*, empty, each with *"This key is not in the file. Leaving this box empty writes nothing;
  typing in it adds the key."*; heading **Capital letters** begins.
- `…/L03/small/c17.png`, `e3-group0`: heading **Content kind**, the sentence *"Changing the kind of
  content renames its key in the file. The text is carried over as it is: nothing in it is converted."*,
  four buttons *Change to: Markdown content / HTML content / Image path / Form layout*; then *Label*,
  *Comment*, **Word boundary**. Order read: trigger and content → content kind → label and comment →
  option groups.
- `…/L03/small/c27.png`, `e3-group2`: **Capital letters**: *Follow the case that was typed* (empty),
  *Capitalisation style* holding `shouting`, *Suggested values, as espanso spells them:* and three
  buttons `uppercase`, `capitalize`, `capitalize_words` drawn in monospace, then *"This value is not one
  of the suggested spellings. It is kept exactly as written."*; **Insertion method**: *Insertion mode*
  holding `clipboard` with suggestion buttons `clipboard`, `keys` and no unfamiliar sentence; *Force the
  clipboard (older setting)* holding `false` in a text box, with its own *Take this key out*; **Other**:
  *Paragraph*, *Anchor*, both empty.
- `…/L03/small/c32.png`, `e3-group3`: the same groups scrolled to the end of the editor: *Undo*, *Redo*
  (grey), *Save this snippet*. **Every badge in this launch reads `checkboxes=0`.**

## L04 — `editor`, ES

Started 07:15:31; window 8933; 40 captures, last `c40` at 07:16:11. Lock: No throughout. Binary A.

- `…/L04/small/c03.png`, `e1-top`: *Archivo*, *Dejar de editar*; *Disparador*; *Texto de sustitución*
  (multi-line); *Insertar la posición del cursor* and hint; *Contenido en Markdown* with the dormant
  sentence (three lines); *Contenido en HTML*.
- `…/L04/small/c12.png`, `e3-group0`: **Tipo de contenido**, *"Cambiar el tipo de contenido renombra
  su clave en el archivo. El texto se traslada tal como está: no se convierte nada de él."*, four buttons
  *Cambiar a: Contenido en Markdown / Contenido en HTML / Ruta de la imagen / Diseño del formulario* on
  two rows; *Etiqueta*, *Comentario*; **Límites de palabra** with *Palabra completa* `true`.
- `…/L04/small/c07.png`, `e2-label`: *Etiqueta*, *Comentario*, **Límites de palabra** (*Límite por la
  izquierda*, *Límite por la derecha*, each with the two-line absent sentence), **Mayúsculas** begins.
- `…/L04/small/c17.png`, `e3-group1`: **Mayúsculas**: *Seguir las mayúsculas que se escriban*, *Estilo
  de mayúsculas* `shouting`, *Valores sugeridos, tal como los escribe espanso:* `uppercase`,
  `capitalize`, `capitalize_words`, then *"Este valor no es una de las formas sugeridas. Se conserva
  exactamente como está escrito."*; **Método de inserción** begins with *Modo de inserción* `clipboard`.
- `…/L04/small/c32.png`, `e3-group4`: **Método de inserción** — *Modo de inserción* `clipboard` with
  `clipboard`, `keys`; *Forzar el portapapeles (ajuste antiguo)* `false`; **Otras** — *Párrafo*, *Ancla*;
  *Deshacer*, *Rehacer*, *Guardar este fragmento*. `checkboxes=0` on every badge read.

## L05 — `switch`, EN — **void, not read**

Started 07:16:26. The launcher's first window filter picked window 8938, a 3072×30 window of the app that
was not on screen, instead of the 1178×760 main window (8944). No capture of this launch was read or is
credited. The filter was corrected (layer 0, on screen, taller than 100 points) before L06.

## L06 — `switch`, EN

Started 07:17:14; window 8955; 40 captures, last `c40` at 07:17:54. Lock: No throughout. Binary A.
Snippet `:plain` (`replace: "Plain text"` and a `vars` list).

- `…/L06/small/c08.png`, `s2-preview`, after *Change to: Markdown content* was clicked: that button is
  drawn disabled (grey); a bordered panel: *"Replacement text will become Markdown content. The key is
  renamed where it stands in the file."*, *"The text is kept exactly as the file writes it."*, *"The change
  of content kind removes none of these keys that go with the content. An edit drafted to one of them is
  saved as drafted:"*, a bullet `vars` in monospace, and the buttons **Confirm this change of content
  kind** and **Cancel the change of content kind**.
- `…/L06/small/c13.png`, `s3-save disabled=true`: at the end of the editor *Undo* (dark), *Redo* (grey),
  *Save this snippet* (grey, as *Redo*), and under them *"This snippet cannot be saved until the change of
  content kind above is confirmed."*
- `…/L06/small/c23.png`, `s5-confirmed`, after *Confirm* was clicked: the panel now ends with *"This
  change of content kind is confirmed. Undo takes the confirmation back."* and only *Cancel the change of
  content kind*.
- `…/L06/small/c28.png`, `s6-save disabled=false`: *Save this snippet* drawn dark like *Undo*; the
  withheld sentence is gone.

## L07 — `switch`, ES

Started 07:18:16; window 8966; 40 captures, last `c40` at 07:18:56. Lock: No throughout. Binary A.

- `…/L07/small/c08.png`, `s2-preview`: *Cambiar a: Contenido en Markdown* grey; the panel: *"Texto de
  sustitución pasará a ser Contenido en Markdown. La clave se renombra en el mismo lugar del archivo."*,
  *"El texto se conserva exactamente como lo escribe el archivo."*, the companions sentence, `vars`, and
  **Confirmar este cambio de tipo de contenido** / **Cancelar el cambio de tipo de contenido**, each on
  its own row (EN fitted both on one row).
- `…/L07/small/c13.png`, `s3-save disabled=true`: *Deshacer*, *Rehacer* (grey), *Guardar este fragmento*
  (grey), and *"Este fragmento no se puede guardar hasta que se confirme el cambio de tipo de contenido de
  arriba."* on two lines.
- `…/L07/small/c23.png`, `s5-confirmed`: *"Este cambio de tipo de contenido está confirmado. Deshacer
  retira la confirmación."* and only *Cancelar…*.
- `…/L07/small/c28.png`, `s6-save disabled=false`: *Guardar este fragmento* dark; no withheld sentence.

## L08 — `conflict`, EN (first attempt; binary A)

Started 07:19:11; window 8977 at 07:19:13; 66 captures, last `c66` at 07:20:18. Lock: No throughout.
**Disk rewrite at 07:19:26** (after `c14`): `sed -i ''` replaced `Second line of a block.` with
`Second line, changed on disk.` in `match/plan-conflict-en.yml`.

- `…/L08/small/c06.png`, `k1-draft`: the `:block` editor, *Unsaved changes* beside the file name, the
  *Replacement text* box holding the two block lines plus *A third line typed in the editor.*
- `…/L08/small/c18.png` (4 s after the rewrite; the badge still reads `k1-draft`, because the probe
  names no step while it waits): **the conflict surface appeared from the watcher alone, with no save
  pressed**: the sidebar row gained a *Not reconciled* mark; the detail pane was scrolled to a bordered
  panel reading *"What is compared here came from watching the file: it changed on disk while this was
  open. No save was initiated in response to this observation, …"*, *"This file changed on disk while
  this panel was open. …"*, *"Your text is still here, exactly as you wrote it. Nothing has been discarded
  and nothing has been reloaded."*, the *Loading the version on disk…* warning, the observed revision
  hash, then **What you wrote, kept here** with *Replacement text — this text would be written* and the
  three drafted lines.
- `…/L08/small/c23.png` and `c30.png` (`k2`, `k3`): the editor above the panel is read-only: every box
  greyed, the *Insert cursor position* control no longer drawn. What pressing *Save* did in this state is
  **unread** (the probe's line naming the button's disabled state was overwritten before a capture).
- This probe version did not scroll to the disk version or the choices; the probe was revised
  (binary B) and the reading re-taken as L09.

## L09 — `conflict`, EN (binary B)

Started 07:21:14; window 8988; 62 captures, last `c62` at 07:22:16. Lock: No throughout. **Disk rewrite
at 07:21:28.**

- `…/L09/small/c35.png`, `k4-panel-top`: the same panel top as L08 `c18`, in full: the two observation
  sentences, *Your text is still here…*, the reload warning, the revision hash, **What you wrote, kept
  here**, *Trigger — left as the file has it* `:block`, *Replacement text — this text would be written*
  with the three lines, then *Markdown content*, *HTML content*, *Image path*, *Form layout*, each *left
  as the file has it* with an empty box.
- `…/L09/small/c45.png`, `k6-disk-version`: **The version on disk**: the file text in a monospace box,
  with `replace: |`, `First line of a block.` and **`Second line, changed on disk.`** — the disk side of
  the conflict; then *"The copy is a labelled reference of what you wrote, one field at a time. …"*, the
  reapply sentence, and the four buttons **Keep editing**, **Copy my text**, **Keep my draft**, **Load
  the version on disk**. The box's first line (the file's comment) runs past the box's right edge and is
  cut at *"… Neutral content"*.
- `…/L09/small/c50.png`, `k7-choices found=true`: the same view; the probe found *Load the version on
  disk* by its exact text. No choice was pressed.

## L10 — `conflict`, ES (binary B)

Started 07:22:32; window 8999; 62 captures, **last capture `c62` at 07:23:33**; lock after at 07:23:34:
No. **Disk rewrite at 07:22:45.**

- `…/L10/small/c06.png`, `k1-draft`: *Archivo match/plan-conflict-es.yml*, *Cambios sin guardar*; *Dejar
  de editar* has wrapped to its own row under the file name; the three drafted lines in *Texto de
  sustitución*; *Insertar la posición del cursor*.
- `…/L10/small/c35.png`, `k4-panel-top`: sidebar mark *Sin conciliar*; *"Lo que se compara aquí viene de
  la vigilancia del archivo: cambió en el disco mientras esto estaba abierto. …"*, *"Este archivo ha
  cambiado en el disco mientras este panel estaba abierto. …"*, *"Tu texto sigue aquí, exactamente como lo
  escribiste. …"*, the reload warning, the revision, **Lo que escribiste, conservado aquí**, *Texto de
  sustitución — se escribiría este texto* with the three lines, the dormant keys *se deja tal y como lo
  tiene el archivo*.
- `…/L10/small/c50.png`, `k7-choices found=true`: the disk text with `Second line, changed on disk.`; *"La
  copia es una referencia con etiquetas…"*, the reapply paragraph, and **Seguir editando**, **Copiar mi
  texto**, **Conservar mi borrador** on one row and **Cargar la versión del disco** on a second. The same
  first-line overflow in the disk box.
