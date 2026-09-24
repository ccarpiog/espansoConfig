# Phase 3-15-2 — The Phase 3 closure record

**Spec:** [`3-split-notes.md`](3-split-notes.md) §2 step *3-15*, its acceptance clauses 5 and 6 (the
window halves; R16, R30, R35, R38 and the untouched CF rows) and its 2026-09-24 addendum (the 3-15-2
bullet); §3 rulings 17, 29, 30, 31, 33; §4.1 and §4.8 (the owner ruling of 2026-09-24).
**Risk:** high. **Records only.** No source, test, configuration or dictionary file changed; this file
is the phase's only change. It makes no new window claim and adds no feature.

No window reading was performed or claimed.

> **Phase 3 is NOT closed, and step 3-13 is NOT closed.** 3-13-3 (the window half of step 3-13) and
> 3-14 (delete-conflict wording and action placement) are **owed to an attended session** under the
> owner ruling of 2026-09-24 (`3-split-notes.md` §4.8; `PROGRESS.md` *Next action*, "Owed to an
> attended session"). This record closes **3-15-2 only**, and step 3-15 with it, on this record's
> review. It does not close Phase 3, and it does not start Phase 4 (§4.8, last bullet).

---

## 1. What changed, and why

- **New:** `docs/decisions/3-15-2-notes.md` (this file). Nothing else in the tree changed.
- **Why:** the 3-15 addendum cut step 3-15 into the preservation evidence (3-15-1, closed; tests
  only) and this closure record (`3-split-notes.md` §2, 3-15 addendum, the 3-15-2 bullet). This record
  delivers the five things that bullet names: the translation-review inventory (§2), the window halves
  (§3), the four risks and the CF rows (§4), the scope statement against what shipped (§5), and the
  statement above that Phase 3 and step 3-13 stay open (also §7).
- **How it was drawn:** `git log`, `git show`, `rg`, `sed` and `wc` reads, and two Node scripts outside
  the repository (§2.1, §2.4). No gate beyond `npm test` (§9) was run, no app was launched, and no
  real-config file was opened. Every figure below was read on 2026-09-24 against `main` at `96f24a1`.

## 2. The Phase 3 translation-review inventory (ruling 29)

**What this is.** Every dictionary key Phase 3 added, with its English and Spanish values as they
stand at `HEAD`, and the step whose commit first added it. It is **an inventory for the owner's
native-speaker review (R35, CF-51), not evidence of meaning.** No review of the Spanish was performed
here. The i18n suites check key parity and placeholder agreement only (`CLAUDE.md` §2; R35 in
`PROGRESS.md` *Open risks*), so nothing in this table establishes that a Spanish value says what its
English value says. It is kept separate from 2d-7-10's 145-row ES inventory, which is not extended
(ruling 29; `2d-7-10-notes.md` §3).

### 2.1 How it was derived (re-runnable)

- **Phase 3's start** is the design consult commit `c89f029` (*"Phase 3 design consult — the
  fifteen-step split, closed"*), the first commit that touches `docs/decisions/3-split-notes.md`
  (`git log --reverse --oneline -- docs/decisions/3-split-notes.md`). It changed no dictionary.
- **The commits in range** that touch a dictionary: `git log --reverse --format='%h %s' c89f029..HEAD --
  src/lib/i18n/en.json src/lib/i18n/es.json` — seventeen, from 3-1 (`9513c5c`) to 3-13-2 (`e0d7f67`).
  Steps 3-4, 3-5-2-2, 3-6-3, 3-8-3, 3-9-2 (whose F1 fix added no key, `3-9-2-notes.md` §8), 3-11-3,
  3-15-1 and every records-only commit touched neither dictionary.
- **The script** is `/private/tmp/3-15-2/inventory.cjs` (outside the repository, not committed). It
  flattens `en.json` and `es.json` at `c89f029` and at `HEAD` (both dictionaries are flat key → string
  maps), lists the keys present at `HEAD` and absent at `c89f029`, and attributes each to the first
  commit in range whose `en.json` holds it. Re-run with:

  ```sh
  node /private/tmp/3-15-2/inventory.cjs <repo> c89f029 summary   # the counts below
  node /private/tmp/3-15-2/inventory.cjs <repo> c89f029 rows      # the §2.3 table rows
  node /private/tmp/3-15-2/inventory.cjs <repo> c89f029 changed   # the §2.2 row
  ```

  The same count without the script: `git diff c89f029 HEAD -- src/lib/i18n/en.json | rg -c '^\+  "'`
  counts added lines, which includes the one changed value (§2.2), so it reads one more than the
  added-key count.

**The counts it printed:**

| Figure | Value |
|---|---|
| Keys at `c89f029` (EN / ES) | 994 / 994 |
| Keys at `HEAD` (EN / ES) | 1302 / 1302 |
| **Keys Phase 3 added, present at `HEAD`** (EN / ES; the two sets are equal) | **309 / 309** |
| Pre-Phase-3 keys removed | 1 — `browser.sidebar.notAutoLoaded`, removed by 3-9-1 (`d217ecf`; `git log -S`) and superseded by `browser.fileScope.notAutoLoaded.*` |
| Pre-Phase-3 keys whose EN or ES value changed | 1 (§2.2) |
| Keys added in Phase 3 and removed again before `HEAD` | 0 |

**Per step** (keys added): 3-1 **5**, 3-2 **14**, 3-3 **3**, 3-5-1 **7**, 3-5-2-1 **21**, 3-6-1 **26**,
3-6-2 **32**, 3-7 **14**, 3-8-1 **4**, 3-8-2 **32**, 3-9-1 **12**, 3-10 **21**, 3-11-1 **15**, 3-11-2
**54**, 3-12 **12**, 3-13-1 **3**, 3-13-2 **34** — total 309. Where a step's notes state a count it
agrees, except 3-11-2 (open item 1, §8): 3-6-1 "26 new keys in each language … one changed sentence"
(`3-6-1-notes.md:134`), 3-12 "12 keys each" (`3-12-notes.md:81`), 3-13-2 "34 keys"
(`3-13-2-notes.md:67`).

**Bounds on the derivation.** Attribution is by the commit that first holds the key, and each Phase 3
step closed in one commit, so the step is the commit's `Phase 3-…` subject. The rows hold the value at
`HEAD`: a key whose value was reworded after the step that added it (for example by a review fix in a
later commit) shows only its final text. The **Producer** column (ruling 29) is derived as §2.4 states. Table cells escape `|` as `\|`; no value holds a line break.

### 2.2 The one changed pre-Phase-3 value

| # | Key | EN (before → after) | ES (before → after) | Step | Producer |
|---|---|---|---|---|---|
| C1 | `browser.matchEditor.readOnly.triggerNotSingle` | This snippet does not fire from one literal trigger, so its trigger is shown and not edited here. Changing a snippet from one trigger form to another is not something this app does. → This snippet does not fire from one literal trigger, so this box does not edit its trigger. What the file holds for its trigger is shown here as written. | Este fragmento no se dispara con un único disparador literal, así que su disparador se muestra y no se edita aquí. Cambiar un fragmento de una forma de disparador a otra no es algo que haga esta aplicación. → Este fragmento no se dispara con un único disparador literal, así que esta caja no edita su disparador. Lo que el archivo tiene como disparador se muestra aquí tal como está escrito. | 3-6-1 | `browser/matchEditor.ts#fieldRefusalKey` |

### 2.3 The 309 added keys

`P#` follows the key's position in `HEAD`'s `en.json`, which groups keys by family. **Step** is the
step whose commit first added the key (§2.1). **Producer** is the source file, and for a `.ts` file
the function, that names the key (§2.4).

| # | Key | EN | ES | Step | Producer |
|---|---|---|---|---|---|
| P1 | `browser.fileScope.label` | About this file | Sobre este archivo | 3-9-1 | `components/FileScope.svelte` |
| P2 | `browser.fileScope.notAutoLoaded.mark` | Not loaded automatically | No se carga automáticamente | 3-9-1 | `browser/fileScope.ts#autoLoadKey` |
| P3 | `browser.fileScope.notAutoLoaded.explanation` | Not loaded automatically: the file name starts with “_”, and espanso’s default include pattern skips such files. What it holds is used only when something brings it in: another file’s “imports”, or a configuration’s “includes” or “extra_includes”. | No se carga automáticamente: el nombre del archivo empieza por «_», y el patrón de inclusión predeterminado de espanso omite esos archivos. Lo que contiene solo se usa cuando algo lo incorpora: el «imports» de otro archivo, o el «includes» o el «extra_includes» de una configuración. | 3-9-1 | `browser/fileScope.ts#autoLoadKey` |
| P4 | `browser.fileScope.underscoreProfile.mark` | Name starts with “_” | El nombre empieza por «_» | 3-9-1 | `browser/fileScope.ts#autoLoadKey` |
| P5 | `browser.fileScope.underscoreProfile.explanation` | The file name starts with “_”. For snippet files, espanso’s default include pattern skips such names; this is a configuration file, and this app does not check how espanso treats one named this way. | El nombre del archivo empieza por «_». En los archivos de fragmentos, el patrón de inclusión predeterminado de espanso omite esos nombres; este es un archivo de configuración, y esta aplicación no comprueba cómo trata espanso uno con este nombre. | 3-9-1 | `browser/fileScope.ts#autoLoadKey` |
| P6 | `browser.fileScope.imports.heading` | Imports | Importaciones | 3-9-1 | `components/FileScope.svelte` |
| P7 | `browser.fileScope.imports.notRead` | This file could not be read as YAML, so nothing is said here about its imports. | Este archivo no se ha podido leer como YAML, así que aquí no se dice nada sobre sus importaciones. | 3-9-1 | `browser/fileScope.ts#importsStateKey` |
| P8 | `browser.fileScope.imports.absent` | This file has no “imports” key. | Este archivo no tiene la clave «imports». | 3-9-1 | `browser/fileScope.ts#importsStateKey` |
| P9 | `browser.fileScope.imports.empty` | This file writes “imports” as an empty list. | Este archivo escribe «imports» como una lista vacía. | 3-9-1 | `browser/fileScope.ts#importsStateKey` |
| P10 | `browser.fileScope.imports.unsupportedShape` | This file writes “imports” as {kind}, not as a list. It stays in the file as written and is not listed here. | Este archivo escribe «imports» como {kind}, no como una lista. Se conserva en el archivo tal como está escrito y no se enumera aquí. | 3-9-1 | `browser/fileScope.ts#importsStateKey` |
| P11 | `browser.fileScope.imports.listed` | In the order the file writes them, shown as written. This app does not look up these files or check whether they exist. | En el orden en que las escribe el archivo, tal como están escritas. Esta aplicación no busca estos archivos ni comprueba si existen. | 3-9-1 | `browser/fileScope.ts#importsStateKey` |
| P12 | `browser.fileScope.imports.entryNotAPath` | Written as {kind}, not as a single path. It stays in the file as written. | Escrita como {kind}, no como una sola ruta. Se conserva en el archivo tal como está escrita. | 3-9-1 | `browser/fileScope.ts#unsupportedImportKey` |
| P13 | `browser.saveOutcome.field.switchingAway` | this key would be renamed to another content kind, keeping its text | esta clave se cambiaría a otro tipo de contenido, conservando su texto | 3-5-1 | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P14 | `browser.saveOutcome.field.switchingTo` | the content kind this snippet would switch to, holding this text | el tipo de contenido al que cambiaría este fragmento, con este texto | 3-5-1 | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P15 | `browser.saveOutcome.field.itemAdded` | this item would be added to the list | este elemento se añadiría a la lista | 3-6-1 | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P16 | `browser.saveOutcome.field.itemRemoved` | this item would be taken out of the list | este elemento se quitaría de la lista | 3-6-1 | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P17 | `browser.saveOutcome.field.triggerFormAway` | this trigger form would be replaced by another, and what it holds is carried over | esta forma de disparador se sustituiría por otra, y lo que contiene se traslada | 3-6-1 | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P18 | `browser.saveOutcome.field.triggerFormTo` | the trigger form this snippet would change to, holding this text | la forma de disparador a la que cambiaría este fragmento, con este texto | 3-6-1 | `browser/saveOutcome.ts#draftFieldStatusKey` |
| P19 | `browser.rawSnippet.refused.rangeNotContiguous` | At least one comment among this snippet’s lines belongs to the file rather than to the snippet, so the snippet’s text is not one run of lines and cannot be edited here on its own. The whole file’s text can be edited instead. | Al menos un comentario entre las líneas de este fragmento pertenece al archivo y no al fragmento, así que el texto del fragmento no es un único tramo de líneas y no se puede editar aquí por separado. En su lugar se puede editar el texto del archivo completo. | 3-8-1 | `browser/rawSnippet.ts#rawSnippetRefusalKey` |
| P20 | `browser.rawSnippet.refused.lineEndingsNotPreserved` | This snippet’s text contains a carriage return, which a text box cannot keep. Rather than change it without being asked, this editor will not open this snippet’s text. | El texto de este fragmento contiene un retorno de carro, que un cuadro de texto no puede conservar. En lugar de cambiarlo sin que nadie lo pida, este editor no abrirá el texto de este fragmento. | 3-8-1 | `browser/rawSnippet.ts#rawSnippetRefusalKey` |
| P21 | `browser.rawSnippet.refused.notEditable` | espansoConfig cannot edit this snippet’s text on its own. What it reports beside this is the reason. | espansoConfig no puede editar el texto de este fragmento por separado. Lo que se indica junto a esto es el motivo. | 3-8-1 | `browser/rawSnippet.ts#rawSnippetRefusalKey` |
| P22 | `browser.rawSnippet.refused.unreadable` | This snippet’s text could not be read. What this app was told is beside this. | No se pudo leer el texto de este fragmento. Lo que se le comunicó a esta aplicación aparece junto a esto. | 3-8-1 | `browser/rawSnippet.ts#rawSnippetRefusalKey` |
| P23 | `browser.rawSnippet.open` | Edit this snippet’s text | Editar el texto de este fragmento | 3-8-2 | `components/DetailPane.svelte` |
| P24 | `browser.rawSnippet.label` | This snippet’s text | El texto de este fragmento | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P25 | `browser.rawSnippet.scope` | The lines this snippet owns in the file, exactly as the file writes them. Saving replaces these lines; if anything outside them would change, the save is refused and nothing is written. | Las líneas que este fragmento ocupa en el archivo, tal como el archivo las escribe. Al guardar se sustituyen estas líneas; si algo fuera de ellas fuera a cambiar, el guardado se rechaza y no se escribe nada. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P26 | `browser.rawSnippet.startsAt` | Starts at line {line} of the file. | Empieza en la línea {line} del archivo. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P27 | `browser.rawSnippet.loading` | Reading this snippet’s text… | Leyendo el texto de este fragmento… | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P28 | `browser.rawSnippet.close` | Stop editing | Dejar de editar | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P29 | `browser.rawSnippet.save` | Save this snippet | Guardar este fragmento | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P30 | `browser.rawSnippet.saving` | Saving… | Guardando… | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P31 | `browser.rawSnippet.undo` | Undo | Deshacer | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P32 | `browser.rawSnippet.redo` | Redo | Rehacer | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P33 | `browser.rawSnippet.unsaved` | Unsaved changes | Cambios sin guardar | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P34 | `browser.rawSnippet.savingCannotBeStopped` | This save cannot be stopped, so the editor stays open until it answers. | Este guardado no se puede detener, así que el editor sigue abierto hasta que responda. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P35 | `browser.rawSnippet.discardWarning` | Leaving this editor discards the text in this box, and it cannot be brought back afterwards. Leaving writes nothing to the file. | Salir de este editor descarta el texto de este cuadro, y después no se puede recuperar. Salir no escribe nada en el archivo. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P36 | `browser.rawSnippet.discard` | Discard my changes | Descartar mis cambios | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P37 | `browser.rawSnippet.sendFailed` | The save could not be sent, so nothing was written. Your text is still here. | No se pudo enviar el guardado, así que no se escribió nada. Tu texto sigue aquí. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P38 | `browser.rawSnippet.mayHaveWritten` | The save did not finish, and this app cannot tell whether the file was written. The snippet in the file may hold your text, or what it held before. Your text is still here. | El guardado no terminó, y esta aplicación no puede saber si se escribió el archivo. El fragmento del archivo puede contener tu texto o lo que tenía antes. Tu texto sigue aquí. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P39 | `browser.rawSnippet.failureReason` | What this app was told: | Lo que se le comunicó a esta aplicación: | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P40 | `browser.rawSnippet.trailingBlankLine` | The text you sent ends with a blank line. A blank line at the end is never part of the snippet — the file owns it — so a text that ends with one is refused, and this app does not remove the line for you. Delete the blank line at the end and save again. | El texto que enviaste termina con una línea en blanco. Una línea en blanco al final nunca forma parte del fragmento —pertenece al archivo—, así que un texto que termina con una se rechaza, y esta aplicación no quita esa línea por ti. Borra la línea en blanco del final y vuelve a guardar. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P41 | `browser.rawSnippet.needsReconciliation` | Before this snippet can be saved again, this editor has to read it from the file again, to learn whether that save landed. | Antes de poder guardar de nuevo este fragmento, este editor tiene que volver a leerlo del archivo para saber si ese guardado llegó a escribirse. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P42 | `browser.rawSnippet.readAgain` | Read the snippet from the file again | Volver a leer el fragmento del archivo | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P43 | `browser.rawSnippet.reading` | Reading… | Leyendo… | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P44 | `browser.rawSnippet.reconciled.written` | The snippet in the file holds the text you saved, so that save did land. This editor now works from the file as it is. | El fragmento del archivo contiene el texto que guardaste, así que ese guardado sí se escribió. Este editor trabaja ahora a partir del archivo tal como está. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P45 | `browser.rawSnippet.reconciled.notWritten` | The snippet in the file still holds the text this editor opened with, so that save did not land. Your text is kept, and it can be saved again. | El fragmento del archivo sigue conteniendo el texto con el que se abrió este editor, así que ese guardado no se escribió. Tu texto se conserva y se puede volver a guardar. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P46 | `browser.rawSnippet.reconciled.diverged` | The snippet this window now points at holds neither the text this editor opened with nor the text you tried to save, or it does not start on the same line, so this editor cannot tell what became of that save. Your text is kept and saving stays off: copy it from the box, then stop editing and open the snippet again. | El fragmento al que apunta ahora esta ventana no contiene ni el texto con el que se abrió este editor ni el que intentaste guardar, o no empieza en la misma línea, así que este editor no puede saber qué pasó con ese guardado. Tu texto se conserva y guardar sigue desactivado: cópialo del cuadro, deja de editar y vuelve a abrir el fragmento. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P47 | `browser.rawSnippet.reconciled.noIdentity` | This window is not pointing at a snippet of this file right now, so there is nothing to read again. Select this snippet in the list, then try again. | Esta ventana no apunta ahora a ningún fragmento de este archivo, así que no hay nada que volver a leer. Selecciona este fragmento en la lista y vuelve a intentarlo. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P48 | `browser.rawSnippet.identityStale` | This editor no longer has a current address for this snippet in the file, so saving from it is not offered again. Nothing you typed is lost: it is still in the box, where it can be selected and copied. Stop editing and open the snippet again to go on. | Este editor ya no tiene una dirección vigente para este fragmento dentro del archivo, así que no se vuelve a ofrecer guardar desde él. No se pierde nada de lo que escribiste: sigue en el cuadro, donde se puede seleccionar y copiar. Deja de editar y vuelve a abrir el fragmento para continuar. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P49 | `browser.rawSnippet.openWholeDocument` | Go to the whole file’s text | Ir al texto del archivo completo | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P50 | `browser.rawSnippet.wholeDocumentElsewhere` | This window is pointing at another file right now. Select a snippet of this file to reach its whole text. | Esta ventana apunta ahora a otro archivo. Selecciona un fragmento de este archivo para llegar a su texto completo. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P51 | `browser.rawSnippet.diskVersion` | The whole file as it is on disk | El archivo completo tal como está en disco | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P52 | `browser.rawSnippet.draftCopied` | Your text was copied to the clipboard. | Tu texto se copió al portapapeles. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P53 | `browser.rawSnippet.draftCopyFailed` | Your text could not be copied to the clipboard. It is still in the box above, so it can be selected and copied by hand. | Tu texto no se pudo copiar al portapapeles. Sigue en el cuadro de arriba, así que se puede seleccionar y copiar a mano. | 3-8-2 | `components/RawSnippetEditor.svelte` |
| P54 | `browser.bulkEdit.exclusion.readOnly` | Left out: espansoConfig cannot edit this snippet here, so the options are not applied to it. | Excluido: espansoConfig no puede editar este fragmento aquí, así que las opciones no se le aplican. | 3-11-1 | `browser/bulkEdit.ts#bulkExclusionKey` |
| P55 | `browser.bulkEdit.exclusion.editorOpen` | Left out: a snippet of this file is open in the editor, and espansoConfig cannot tell whether it has been edited. Close the editor to include this file. | Excluido: hay un fragmento de este archivo abierto en el editor, y espansoConfig no puede saber si se ha modificado. Cierra el editor para incluir este archivo. | 3-11-1 | `browser/bulkEdit.ts#bulkExclusionKey` |
| P56 | `browser.bulkEdit.blocked.noSelection` | Select at least one snippet. | Selecciona al menos un fragmento. | 3-11-1 | `browser/bulkEdit.ts#bulkBlockerKey` |
| P57 | `browser.bulkEdit.blocked.staleSelection` | The file of at least one selected snippet has changed since it was selected. Select the snippets again before applying. | El archivo de al menos un fragmento seleccionado ha cambiado desde que se seleccionó. Vuelve a seleccionar los fragmentos antes de aplicar. | 3-11-1 | `browser/bulkEdit.ts#bulkBlockerKey` |
| P58 | `browser.bulkEdit.blocked.noChanges` | Set or remove at least one option. Options left as they are, mixed ones included, are not changed. | Establece o quita al menos una opción. Las opciones que se dejan como están, incluidas las mixtas, no cambian. | 3-11-1 | `browser/bulkEdit.ts#bulkBlockerKey` |
| P59 | `browser.bulkEdit.blocked.emptyValue` | An option is set to an empty value. Type a value, or choose to remove the option. | Una opción tiene un valor vacío. Escribe un valor o elige quitar la opción. | 3-11-1 | `browser/bulkEdit.ts#bulkBlockerKey` |
| P60 | `browser.bulkEdit.blocked.nothingToApply` | Every selected snippet is left out, so there is nothing to apply. | Todos los fragmentos seleccionados quedan excluidos, así que no hay nada que aplicar. | 3-11-1 | `browser/bulkEdit.ts#bulkBlockerKey` |
| P61 | `browser.bulkEdit.option.unknown` | Not read yet | Aún no leída | 3-11-1 | `browser/bulkEdit.ts#optionSummaryKey` |
| P62 | `browser.bulkEdit.option.absent` | Not set in any selected snippet | No está en ningún fragmento seleccionado | 3-11-1 | `browser/bulkEdit.ts#optionSummaryKey` |
| P63 | `browser.bulkEdit.option.notOneScalar` | Written in a form that cannot be shown as one value | Escrita de una forma que no se puede mostrar como un único valor | 3-11-1 | `browser/bulkEdit.ts#optionSummaryKey` |
| P64 | `browser.bulkEdit.option.mixed` | Mixed | Mixta | 3-11-1 | `browser/bulkEdit.ts#optionSummaryKey` |
| P65 | `browser.bulkEdit.outcome.complete` | Every file was saved, or already held these values. | Todos los archivos se guardaron o ya tenían estos valores. | 3-11-1 | `browser/bulkEdit.ts#bulkOutcomeHeadlineKey` |
| P66 | `browser.bulkEdit.outcome.partial` | Some files were saved and others were not. The files that were saved stay saved. | Algunos archivos se guardaron y otros no. Los archivos que se guardaron siguen guardados. | 3-11-1 | `browser/bulkEdit.ts#bulkOutcomeHeadlineKey` |
| P67 | `browser.bulkEdit.outcome.uncertain` | At least one file may have been written, and espansoConfig could not confirm it. Files reported as saved stay saved. | Puede que al menos un archivo se haya escrito, y espansoConfig no pudo confirmarlo. Los archivos que figuran como guardados siguen guardados. | 3-11-1 | `browser/bulkEdit.ts#bulkOutcomeHeadlineKey` |
| P68 | `browser.bulkEdit.outcome.nothingWritten` | No file was written. | No se escribió ningún archivo. | 3-11-1 | `browser/bulkEdit.ts#bulkOutcomeHeadlineKey` |
| P69 | `browser.sidecar.displayNameRefusal.lineBreak` | A display name must fit on one line, so this one was not saved. | Un nombre visible debe caber en una sola línea, así que este no se guardó. | 3-13-1 | `browser/preferences.ts#displayNameRefusalKey` |
| P70 | `browser.sidecar.defaultRefusal.carriageReturn` | This default holds a carriage return, which a text box here cannot keep, so it is not used. | Este valor predeterminado contiene un retorno de carro, que un cuadro de texto de aquí no puede conservar, así que no se usa. | 3-13-1 | `browser/preferences.ts#defaultRefusalKey` |
| P71 | `browser.sidecar.saveWithdrawn` | The configuration folder was replaced before these preferences were sent, so nothing was saved. | La carpeta de configuración se sustituyó antes de enviar estas preferencias, así que no se guardó nada. | 3-13-1 | `browser/preferences.ts#withdrawnPreferenceSaveKey` |
| P72 | `browser.filePreferences.open` | File preferences | Preferencias del archivo | 3-13-2 | `components/FilePreferences.svelte` |
| P73 | `browser.filePreferences.close` | Close file preferences | Cerrar las preferencias del archivo | 3-13-2 | `components/FilePreferences.svelte` |
| P74 | `browser.filePreferences.label` | Preferences for {path} | Preferencias de {path} | 3-13-2 | `components/FilePreferences.svelte` |
| P75 | `browser.filePreferences.appOnly` | espansoConfig keeps these preferences in its own folder. No espanso file is changed. | espansoConfig guarda estas preferencias en su propia carpeta. No se modifica ningún archivo de espanso. | 3-13-2 | `components/FilePreferences.svelte` |
| P76 | `browser.filePreferences.reading` | Reading the preferences… | Leyendo las preferencias… | 3-13-2 | `components/FilePreferences.svelte` |
| P77 | `browser.filePreferences.readFailed` | The preferences could not be read, so they cannot be changed now. New snippets start with no defaults. | No se han podido leer las preferencias, así que ahora no se pueden cambiar. Los fragmentos nuevos empiezan sin valores predeterminados. | 3-13-2 | `components/FilePreferences.svelte` |
| P78 | `browser.filePreferences.displayName` | Display name | Nombre visible | 3-13-2 | `components/FilePreferences.svelte` |
| P79 | `browser.filePreferences.displayNameHint` | Shown in the sidebar above the file's real name, which stays visible. Leave it empty to show only the file's name. | Se muestra en la barra lateral encima del nombre real del archivo, que sigue visible. Déjalo vacío para mostrar solo el nombre del archivo. | 3-13-2 | `components/FilePreferences.svelte` |
| P80 | `browser.filePreferences.displayNameShown` | This name holds a line break, which a one-line box would remove, so it is shown as it is. Clear it to write a new one. | Este nombre contiene un salto de línea, que una caja de una sola línea eliminaría, así que se muestra tal cual. Bórralo para escribir uno nuevo. | 3-13-2 | `components/FilePreferences.svelte` |
| P81 | `browser.filePreferences.clearName` | Clear the name | Borrar el nombre | 3-13-2 | `components/FilePreferences.svelte` |
| P82 | `browser.filePreferences.defaultsHeading` | Defaults for new snippets | Valores predeterminados para fragmentos nuevos | 3-13-2 | `components/FilePreferences.svelte` |
| P83 | `browser.filePreferences.defaultsHint` | A snippet added to this file starts with these options filled in, and you can change or remove each one before adding it. Snippets already in the file are not changed. | Un fragmento añadido a este archivo empieza con estas opciones ya rellenas, y puedes cambiar o quitar cada una antes de añadirlo. Los fragmentos que ya están en el archivo no cambian. | 3-13-2 | `components/FilePreferences.svelte` |
| P84 | `browser.filePreferences.defaultsNotApplicable` | New snippets are added only to snippet files, so this file has no defaults. | Los fragmentos nuevos solo se añaden a archivos de fragmentos, así que este archivo no tiene valores predeterminados. | 3-13-2 | `components/FilePreferences.svelte` |
| P85 | `browser.filePreferences.noDefault` | No default: a new snippet gets no such key. | Sin valor predeterminado: un fragmento nuevo no recibe esta clave. | 3-13-2 | `components/FilePreferences.svelte` |
| P86 | `browser.filePreferences.emptyDefault` | Empty: a new snippet gets this key with no value. | Vacío: un fragmento nuevo recibe esta clave sin valor. | 3-13-2 | `components/FilePreferences.svelte` |
| P87 | `browser.filePreferences.shownDefault` | This default holds a line break, which a one-line box would remove, so it is shown as it is. Remove it to write a new one. | Este valor predeterminado contiene un salto de línea, que una caja de una sola línea eliminaría, así que se muestra tal cual. Quítalo para escribir uno nuevo. | 3-13-2 | `components/FilePreferences.svelte` |
| P88 | `browser.filePreferences.valueLabel` | Default for {option} | Valor predeterminado de {option} | 3-13-2 | `components/FilePreferences.svelte` |
| P89 | `browser.filePreferences.addDefault` | Add a default | Añadir un valor predeterminado | 3-13-2 | `components/FilePreferences.svelte` |
| P90 | `browser.filePreferences.removeDefault` | Remove the default | Quitar el valor predeterminado | 3-13-2 | `components/FilePreferences.svelte` |
| P91 | `browser.filePreferences.suggestions` | Suggested values, as espanso spells them: | Valores sugeridos, tal como los escribe espanso: | 3-13-2 | `components/FilePreferences.svelte` |
| P92 | `browser.filePreferences.lineEndings` | Each box holds one line. A line break or a carriage return pasted into one is removed. | Cada caja contiene una sola línea. Un salto de línea o un retorno de carro que se pegue en ella se elimina. | 3-13-2 | `components/FilePreferences.svelte` |
| P93 | `browser.filePreferences.save` | Save preferences | Guardar las preferencias | 3-13-2 | `components/FilePreferences.svelte` |
| P94 | `browser.filePreferences.saving` | Saving the preferences… | Guardando las preferencias… | 3-13-2 | `components/FilePreferences.svelte` |
| P95 | `browser.list.bulk.start` | Select several | Seleccionar varios | 3-11-2 | `components/SnippetList.svelte` |
| P96 | `browser.list.bulk.stop` | Stop selecting several | Dejar de seleccionar varios | 3-11-2 | `components/SnippetList.svelte` |
| P97 | `browser.list.bulk.unavailable` | Close the open editor or panel to select several snippets. | Cierra el editor o el panel abierto para seleccionar varios fragmentos. | 3-11-2 | `components/SnippetList.svelte` |
| P98 | `browser.list.bulk.hint` | Press a snippet to add it to the selection, or press it again to take it out. | Pulsa un fragmento para añadirlo a la selección, o vuelve a pulsarlo para quitarlo. | 3-11-2 | `components/SnippetList.svelte` |
| P99 | `browser.list.bulk.count` | Selected: {count} | Seleccionados: {count} | 3-11-2 | `components/SnippetList.svelte` |
| P100 | `browser.list.bulk.clear` | Clear the selection | Vaciar la selección | 3-11-2 | `components/SnippetList.svelte` |
| P101 | `browser.list.bulk.selectedMark` | Selected | Seleccionado | 3-11-2 | `components/SnippetList.svelte` |
| P102 | `browser.bulkInspector.label` | Options of several snippets | Opciones de varios fragmentos | 3-11-2 | `components/BulkInspector.svelte` |
| P103 | `browser.bulkInspector.selected` | Selected snippets: {count} | Fragmentos seleccionados: {count} | 3-11-2 | `components/BulkInspector.svelte` |
| P104 | `browser.bulkInspector.optionsHeading` | Options | Opciones | 3-11-2 | `components/BulkInspector.svelte` |
| P105 | `browser.bulkInspector.now` | In the selected snippets now: | Ahora, en los fragmentos seleccionados: | 3-11-2 | `components/BulkInspector.svelte` |
| P106 | `browser.bulkInspector.intentLabel` | What to do with {option} | Qué hacer con {option} | 3-11-2 | `components/BulkInspector.svelte` |
| P107 | `browser.bulkInspector.valueLabel` | Value for {option} | Valor de {option} | 3-11-2 | `components/BulkInspector.svelte` |
| P108 | `browser.bulkInspector.intent.untouched` | Leave as it is | Dejar como está | 3-11-2 | `components/BulkInspector.svelte` |
| P109 | `browser.bulkInspector.intent.set` | Set to | Establecer en | 3-11-2 | `components/BulkInspector.svelte` |
| P110 | `browser.bulkInspector.intent.remove` | Remove | Quitar | 3-11-2 | `components/BulkInspector.svelte` |
| P111 | `browser.bulkInspector.mixedLeft` | Mixed, and left as it is in each snippet. | Mixta, y se deja como está en cada fragmento. | 3-11-2 | `components/BulkInspector.svelte` |
| P112 | `browser.bulkInspector.suggestions` | Suggested values, as espanso spells them: | Valores sugeridos, tal como los escribe espanso: | 3-11-2 | `components/BulkInspector.svelte` |
| P113 | `browser.bulkInspector.readFailed` | Snippets whose options could not be read: {count} | Fragmentos cuyas opciones no se pudieron leer: {count} | 3-11-2 | `components/BulkInspector.svelte` |
| P114 | `browser.bulkInspector.readAgain` | Read the options again | Volver a leer las opciones | 3-11-2 | `components/BulkInspector.svelte` |
| P115 | `browser.bulkInspector.draftUndo` | Undo | Deshacer | 3-11-2 | `components/BulkInspector.svelte` |
| P116 | `browser.bulkInspector.draftRedo` | Redo | Rehacer | 3-11-2 | `components/BulkInspector.svelte` |
| P117 | `browser.bulkInspector.draftOnly` | Undo and Redo change only the choices above. They do not change any file. | Deshacer y Rehacer cambian solo las elecciones de arriba. No cambian ningún archivo. | 3-11-2 | `components/BulkInspector.svelte` |
| P118 | `browser.bulkInspector.noDiskUndo` | Applying saves each file on its own. Once a file is saved, nothing here takes that save back. | Aplicar guarda cada archivo por separado. Una vez guardado un archivo, nada de aquí anula ese guardado. | 3-11-2 | `components/BulkInspector.svelte` |
| P119 | `browser.bulkInspector.exclusionsHeading` | Left out | Excluidos | 3-11-2 | `components/BulkInspector.svelte` |
| P120 | `browser.bulkInspector.unknownFile` | A file this window no longer lists | Un archivo que esta ventana ya no muestra | 3-11-2 | `components/BulkInspector.svelte` |
| P121 | `browser.bulkInspector.unknownSnippet` | A snippet this window no longer shows | Un fragmento que esta ventana ya no muestra | 3-11-2 | `components/BulkInspector.svelte` |
| P122 | `browser.bulkInspector.planFiles` | Files to write: {count} | Archivos que se escribirán: {count} | 3-11-2 | `components/BulkInspector.svelte` |
| P123 | `browser.bulkInspector.planSnippets` | Snippets to change: {count} | Fragmentos que cambiarán: {count} | 3-11-2 | `components/BulkInspector.svelte` |
| P124 | `browser.bulkInspector.apply` | Apply to the selected snippets | Aplicar a los fragmentos seleccionados | 3-11-2 | `components/BulkInspector.svelte` |
| P125 | `browser.bulkInspector.applying` | Applying… | Aplicando… | 3-11-2 | `components/BulkInspector.svelte` |
| P126 | `browser.bulkInspector.outcomeHeading` | Result | Resultado | 3-11-2 | `components/BulkInspector.svelte` |
| P127 | `browser.bulkInspector.executionHeading` | Applied files | Archivos aplicados | 3-11-2 | `components/BulkInspector.svelte` |
| P128 | `browser.bulkInspector.exclusionCountsHeading` | Left out before applying | Excluidos antes de aplicar | 3-11-2 | `components/BulkInspector.svelte` |
| P129 | `browser.bulkInspector.count.saved` | Saved: {count} | Guardados: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P130 | `browser.bulkInspector.count.alreadyUnchanged` | Already held these values: {count} | Ya tenían estos valores: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P131 | `browser.bulkInspector.count.notWritten` | Not written: {count} | No escritos: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P132 | `browser.bulkInspector.count.writeOutcomeUnknown` | May have been written, not confirmed: {count} | Quizá escritos, sin confirmar: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P133 | `browser.bulkInspector.count.notAttempted` | Not attempted: {count} | No intentados: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P134 | `browser.bulkInspector.count.excludedFiles` | Files left out: {count} | Archivos excluidos: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P135 | `browser.bulkInspector.count.excludedSnippets` | Snippets left out: {count} | Fragmentos excluidos: {count} | 3-11-2 | `browser/bulkEdit.ts#bulkCountKey` |
| P136 | `browser.bulkInspector.rereadFailed` | Reading this file again afterwards failed. What its outcome says above still stands. | No se pudo volver a leer este archivo después. Lo que dice su resultado arriba sigue siendo válido. | 3-11-2 | `components/BulkInspector.svelte` |
| P137 | `browser.bulkInspector.notAttempted` | Nothing was sent, because a selected file is no longer shown in this window. No file was written. | No se envió nada, porque un archivo seleccionado ya no se muestra en esta ventana. No se escribió ningún archivo. | 3-11-2 | `components/BulkInspector.svelte` |
| P138 | `browser.bulkInspector.failedNothingWritten` | The bulk edit could not run, and no file was written. | La edición en bloque no se pudo ejecutar, y no se escribió ningún archivo. | 3-11-2 | `components/BulkInspector.svelte` |
| P139 | `browser.bulkInspector.failedMayHaveWritten` | The bulk edit stopped, and a file may have been written. Read the files again before going on. | La edición en bloque se detuvo, y puede que se haya escrito un archivo. Vuelve a leer los archivos antes de continuar. | 3-11-2 | `components/BulkInspector.svelte` |
| P140 | `browser.bulkInspector.consentHeading` | Needs your confirmation | Necesita tu confirmación | 3-11-2 | `components/BulkInspector.svelte` |
| P141 | `browser.bulkInspector.consentIntro` | These files were not written because of what espansoConfig found in the result. A confirmation covers only that file, the findings shown for it and the options as they are now. | Estos archivos no se escribieron por lo que espansoConfig encontró en el resultado. Una confirmación cubre solo ese archivo, los hallazgos que se muestran para él y las opciones tal como están ahora. | 3-11-2 | `components/BulkInspector.svelte` |
| P142 | `browser.bulkInspector.consentFindings` | What it found: | Lo que encontró: | 3-11-2 | `components/BulkInspector.svelte` |
| P143 | `browser.bulkInspector.consentGive` | Confirm for this file | Confirmar para este archivo | 3-11-2 | `components/BulkInspector.svelte` |
| P144 | `browser.bulkInspector.consentHeld` | Confirmed. Apply again to write this file with these options. | Confirmado. Vuelve a aplicar para escribir este archivo con estas opciones. | 3-11-2 | `components/BulkInspector.svelte` |
| P145 | `browser.bulkInspector.consentNotPossible` | Confirming cannot let this file be written. | Confirmar no puede hacer que este archivo se escriba. | 3-11-2 | `components/BulkInspector.svelte` |
| P146 | `browser.bulkInspector.consentOutdated` | The options or the selection changed after this was found, so it cannot be confirmed. Apply again to see what the file's result holds now. | Las opciones o la selección cambiaron después de encontrar esto, así que no se puede confirmar. Vuelve a aplicar para ver qué contiene ahora el resultado de este archivo. | 3-11-2 | `components/BulkInspector.svelte` |
| P147 | `browser.bulkInspector.keepRemaining` | Keep only the snippets that were not written | Conservar solo los fragmentos que no se escribieron | 3-11-2 | `components/BulkInspector.svelte` |
| P148 | `browser.bulkInspector.stop` | Stop selecting several | Dejar de seleccionar varios | 3-11-2 | `components/BulkInspector.svelte` |
| P149 | `browser.matchEditor.readOnly.lineBreak` | This value spans more than one line, and the box this field is edited in holds one line only, so it is shown and not edited here — editing it would join its lines. | Este valor ocupa más de una línea, y la caja en la que se edita este campo solo admite una, así que se muestra y no se edita aquí: editarlo uniría sus líneas. | 3-5-1 | `browser/matchEditor.ts#fieldRefusalKey` |
| P150 | `browser.matchEditor.list.readOnly.unsupportedShape` | This file writes this key as something other than a list, so this app cannot edit it as one and will not overwrite it. It is shown and not edited. | Este archivo escribe esta clave como algo que no es una lista, así que esta aplicación no puede editarla como tal y no la va a sobrescribir. Se muestra y no se edita. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P151 | `browser.matchEditor.list.readOnly.unmodelledShape` | This file writes this key in a way this app did not read as one list (it may appear more than once), so which list an edit would change is not clear. It is shown and not edited. | Este archivo escribe esta clave de un modo que esta aplicación no leyó como una sola lista (puede aparecer más de una vez), así que no está claro qué lista cambiaría una edición. Se muestra y no se edita. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P152 | `browser.matchEditor.list.readOnly.itemNotText` | An item of this list is not one piece of text, so this app cannot edit the list without touching something it never showed. It is shown and not edited. | Un elemento de esta lista no es un solo fragmento de texto, así que esta aplicación no puede editar la lista sin tocar algo que nunca mostró. Se muestra y no se edita. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P153 | `browser.matchEditor.list.readOnly.itemNotDecodable` | This app could not read an item of this list back as plain text, so the list is shown as the file writes it and not edited. | Esta aplicación no pudo leer un elemento de esta lista como texto sencillo, así que la lista se muestra tal como la escribe el archivo y no se edita. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P154 | `browser.matchEditor.list.readOnly.carriageReturn` | An item of this list contains a carriage return, which a text box in this window cannot give back unchanged, so the list is shown and not edited. | Un elemento de esta lista contiene un retorno de carro, que una caja de texto de esta ventana no puede devolver sin cambios, así que la lista se muestra y no se edita. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P155 | `browser.matchEditor.list.readOnly.lineBreak` | An item of this list spans more than one line, and each item is edited in a one-line box, so the list is shown and not edited: editing it would join its lines. | Un elemento de esta lista ocupa más de una línea, y cada elemento se edita en una caja de una sola línea, así que la lista se muestra y no se edita: editarla uniría sus líneas. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P156 | `browser.matchEditor.list.readOnly.ownsNoBytes` | An item of this list is in the file with nothing written for it, so there is no value to replace. The list is shown and not edited. | Un elemento de esta lista está en el archivo sin nada escrito, así que no hay ningún valor que sustituir. La lista se muestra y no se edita. | 3-6-1 | `browser/matchLists.ts#listRefusalKey` |
| P157 | `browser.matchEditor.list.style.block` | Written one item per line. A save keeps it that way. | Escrita con un elemento por línea. Al guardar se mantiene así. | 3-6-2 | `browser/matchLists.ts#listStyleNoteKey` |
| P158 | `browser.matchEditor.list.style.flow` | Written between brackets on one line. A save keeps it that way. | Escrita entre corchetes en una sola línea. Al guardar se mantiene así. | 3-6-2 | `browser/matchLists.ts#listStyleNoteKey` |
| P159 | `browser.matchEditor.list.absent` | The file does not hold this list. | El archivo no contiene esta lista. | 3-6-2 | `components/MatchEditor.svelte` |
| P160 | `browser.matchEditor.list.empty` | This list holds no item. | Esta lista no contiene ningún elemento. | 3-6-2 | `components/MatchEditor.svelte` |
| P161 | `browser.matchEditor.list.removing` | This list will be taken out of the file when you save. | Esta lista se quitará del archivo al guardar. | 3-6-2 | `components/MatchEditor.svelte` |
| P162 | `browser.matchEditor.list.removedItems` | These items will be taken out of the list when you save: | Estos elementos se quitarán de la lista al guardar: | 3-6-2 | `components/MatchEditor.svelte` |
| P163 | `browser.matchEditor.list.lastItemKept` | The only item left cannot be taken out on its own: a list keeps at least one item. | El único elemento que queda no se puede quitar por sí solo: una lista conserva al menos un elemento. | 3-6-2 | `components/MatchEditor.svelte` |
| P164 | `browser.matchEditor.list.item` | Item {number} | Elemento {number} | 3-6-2 | `components/MatchEditor.svelte` |
| P165 | `browser.matchEditor.list.item.added` | New item | Elemento nuevo | 3-6-2 | `browser/matchLists.ts#listItemStatusKey` |
| P166 | `browser.matchEditor.list.item.edited` | Edited | Editado | 3-6-2 | `browser/matchLists.ts#listItemStatusKey` |
| P167 | `browser.matchEditor.list.addItem` | Add an item | Añadir un elemento | 3-6-2 | `components/MatchEditor.svelte` |
| P168 | `browser.matchEditor.list.removeItem` | Take this item out | Quitar este elemento | 3-6-2 | `components/MatchEditor.svelte` |
| P169 | `browser.matchEditor.list.add` | Add this list | Añadir esta lista | 3-6-2 | `components/MatchEditor.svelte` |
| P170 | `browser.matchEditor.list.remove` | Take this list out | Quitar esta lista | 3-6-2 | `components/MatchEditor.svelte` |
| P171 | `browser.matchEditor.cursor.severalMarkers` | This text holds {count} cursor markers ($\|$). Espanso places the cursor at one of them, so this action neither adds another nor picks one: remove the ones you do not want. | Este texto tiene {count} marcas de cursor ($\|$). Espanso coloca el cursor en una de ellas, así que esta acción no añade otra ni elige ninguna: quita las que no quieras. | 3-5-1 | `browser/matchEditor.ts#cursorAdvisoryKey` |
| P172 | `browser.matchEditor.cursor.insert` | Insert cursor position | Insertar la posición del cursor | 3-5-2-1 | `components/MatchEditor.svelte` |
| P173 | `browser.matchEditor.cursor.hint` | After expanding, espanso places the cursor where $\|$ stands. This control puts one marker where the cursor is in the box above, or selects the marker when the text already holds one. | Tras expandir, espanso coloca el cursor donde está $\|$. Este control pone una marca donde está el cursor en la caja de arriba, o selecciona la marca si el texto ya tiene una. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P174 | `browser.matchEditor.suggestions` | Suggested values, as espanso spells them: | Valores sugeridos, tal como los escribe espanso: | 3-5-2-1 | `components/MatchEditor.svelte` |
| P175 | `browser.matchEditor.suggestions.unfamiliar` | This value is not one of the suggested spellings. It is kept exactly as written. | Este valor no es una de las formas sugeridas. Se conserva exactamente como está escrito. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P176 | `browser.matchEditor.contentRole.dormant` | The snippet already has another kind of content, so this key cannot be added here: a snippet holds one. To use this kind instead, change the content kind below. | El fragmento ya tiene otro tipo de contenido, así que esta clave no se puede añadir aquí: un fragmento tiene uno solo. Para usar este tipo en su lugar, cambia el tipo de contenido más abajo. | 3-5-2-1 | `browser/matchEditor.ts#contentRoleNoteKey` |
| P177 | `browser.matchEditor.contentRole.switchedAway` | The change of content kind below renames this key, so its text is now in the box of the new kind. | El cambio de tipo de contenido de más abajo renombra esta clave, así que su texto está ahora en la caja del tipo nuevo. | 3-5-2-1 | `browser/matchEditor.ts#contentRoleNoteKey` |
| P178 | `browser.matchEditor.contentRole.switchTarget` | The change of content kind below renames the old key to this one. This box holds the text it will have, carried over as it was and not converted. | El cambio de tipo de contenido de más abajo renombra la clave antigua a esta. Esta caja contiene el texto que tendrá, trasladado tal como estaba y sin convertir. | 3-5-2-1 | `browser/matchEditor.ts#contentRoleNoteKey` |
| P179 | `browser.matchEditor.switch.heading` | Content kind | Tipo de contenido | 3-5-2-1 | `components/MatchEditor.svelte` |
| P180 | `browser.matchEditor.switch.offer` | Changing the kind of content renames its key in the file. The text is carried over as it is: nothing in it is converted. | Cambiar el tipo de contenido renombra su clave en el archivo. El texto se traslada tal como está: no se convierte nada de él. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P181 | `browser.matchEditor.switch.to` | Change to: {kind} | Cambiar a: {kind} | 3-5-2-1 | `components/MatchEditor.svelte` |
| P182 | `browser.matchEditor.switch.preview` | {from} will become {to}. The key is renamed where it stands in the file. | {from} pasará a ser {to}. La clave se renombra en el mismo lugar del archivo. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P183 | `browser.matchEditor.switch.textKept` | The text is kept exactly as the file writes it. | El texto se conserva exactamente como lo escribe el archivo. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P184 | `browser.matchEditor.switch.textEdited` | The text has been edited since, and is written as it now stands in the box above. Nothing in it is converted. | El texto se ha editado desde entonces y se escribe tal como está ahora en la caja de arriba. No se convierte nada de él. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P185 | `browser.matchEditor.switch.companionsKept` | The change of content kind removes none of these keys that go with the content. An edit drafted to one of them is saved as drafted: | El cambio de tipo de contenido no quita ninguna de estas claves que acompañan al contenido. Una edición que se haga en una de ellas se guarda tal como se haya hecho: | 3-5-2-1 | `components/MatchEditor.svelte` |
| P186 | `browser.matchEditor.switch.noCompanions` | The snippet has none of the keys that go with its content (vars, form_fields, paragraph), so no other key is involved. | El fragmento no tiene ninguna de las claves que acompañan a su contenido (vars, form_fields, paragraph), así que no interviene ninguna otra clave. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P187 | `browser.matchEditor.switch.companionsRemoved` | The draft also takes out these keys, which a change of content kind never does: | El borrador también quita estas claves, algo que un cambio de tipo de contenido nunca hace: | 3-5-2-1 | `components/MatchEditor.svelte` |
| P188 | `browser.matchEditor.switch.confirm` | Confirm this change of content kind | Confirmar este cambio de tipo de contenido | 3-5-2-1 | `components/MatchEditor.svelte` |
| P189 | `browser.matchEditor.switch.confirmed` | This change of content kind is confirmed. Undo takes the confirmation back. | Este cambio de tipo de contenido está confirmado. Deshacer retira la confirmación. | 3-5-2-1 | `components/MatchEditor.svelte` |
| P190 | `browser.matchEditor.switch.cancel` | Cancel the change of content kind | Cancelar el cambio de tipo de contenido | 3-5-2-1 | `components/MatchEditor.svelte` |
| P191 | `browser.matchEditor.saveWithheld.contentSwitchUnconfirmed` | This snippet cannot be saved until the change of content kind above is confirmed. | Este fragmento no se puede guardar hasta que se confirme el cambio de tipo de contenido de arriba. | 3-5-2-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P192 | `browser.matchEditor.saveWithheld.switchRemovesCompanion` | This snippet cannot be saved: the draft changes the content kind and also takes out a key that goes with the content, and a change of content kind never removes another key. Keep that key, or cancel the change of content kind. | Este fragmento no se puede guardar: el borrador cambia el tipo de contenido y además quita una clave que acompaña al contenido, y un cambio de tipo de contenido nunca quita otra clave. Conserva esa clave o cancela el cambio de tipo de contenido. | 3-5-2-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P193 | `browser.matchEditor.saveWithheld.triggerFormUnconfirmed` | This snippet cannot be saved until the change of trigger form above is confirmed. | Este fragmento no se puede guardar hasta que se confirme el cambio de forma de disparador de arriba. | 3-6-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P194 | `browser.matchEditor.saveWithheld.triggerFormEmpty` | This snippet cannot be saved: its trigger form holds nothing. Type a trigger, add an item to the list, or cancel the change of trigger form. | Este fragmento no se puede guardar: su forma de disparador no contiene nada. Escribe un disparador, añade un elemento a la lista o cancela el cambio de forma de disparador. | 3-6-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P195 | `browser.matchEditor.saveWithheld.triggerFormNotOffered` | This snippet cannot be saved: the draft holds a trigger form this editor does not offer for this snippet. Cancel the change of trigger form. | Este fragmento no se puede guardar: el borrador tiene una forma de disparador que este editor no ofrece para este fragmento. Cancela el cambio de forma de disparador. | 3-6-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P196 | `browser.matchEditor.saveWithheld.listNotInOrder` | This snippet cannot be saved: a list in the draft holds the file's items out of their order, which this editor never does. Undo back to where the list was right. | Este fragmento no se puede guardar: una lista del borrador tiene los elementos del archivo fuera de su orden, algo que este editor nunca hace. Deshaz hasta donde la lista estaba bien. | 3-6-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P197 | `browser.matchEditor.saveWithheld.listEveryItemReplaced` | This snippet cannot be saved: the draft takes out every item the file's list holds and adds new ones, which rewrites the list rather than editing it. Edit the existing items instead, or keep one of them. | Este fragmento no se puede guardar: el borrador quita todos los elementos que tiene la lista del archivo y añade otros nuevos, lo que reescribe la lista en lugar de editarla. Edita los elementos existentes o conserva uno de ellos. | 3-6-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P198 | `browser.matchEditor.saveWithheld.listWouldBeEmpty` | This snippet cannot be saved: a list in the draft has no item left. Removing the whole list is a separate action. | Este fragmento no se puede guardar: una lista del borrador se ha quedado sin elementos. Quitar la lista entera es otra acción. | 3-6-1 | `browser/matchEditor.ts#saveWithheldKey` |
| P199 | `browser.matchEditor.triggerForm.several` | This snippet is written with more than one trigger form, so it is not clear which one espanso uses. Every form is shown, and this editor picks none of them. | Este fragmento está escrito con más de una forma de disparador, así que no está claro cuál usa espanso. Se muestran todas las formas, y este editor no elige ninguna. | 3-6-1 | `browser/matchEditor.ts#triggerPresentationKey` |
| P200 | `browser.matchEditor.triggerForm.absent` | This snippet has no trigger. Choose a trigger form to add one. | Este fragmento no tiene disparador. Elige una forma de disparador para añadir uno. | 3-6-1 | `browser/matchEditor.ts#triggerPresentationKey` |
| P201 | `browser.matchEditor.triggerForm.repair.rawDocument` | To keep one form and take the others out, edit the file's text directly. | Para conservar una forma y quitar las demás, edita directamente el texto del archivo. | 3-6-1 | `browser/matchEditor.ts#triggerRepairKey` |
| P202 | `browser.matchEditor.triggerForm.refused.wouldDropAliases` | The list holds {count} triggers, and a single trigger form holds one, so changing to it would drop the others. Take the others out and save first. | La lista tiene {count} disparadores, y una forma de disparador única tiene uno, así que cambiar a ella descartaría los demás. Quita los demás y guarda antes. | 3-6-1 | `browser/matchEditor.ts#triggerFormRefusalKey` |
| P203 | `browser.matchEditor.triggerForm.refused.flowList` | The list is written between brackets on one line, and this editor changes the trigger form of a list written one item per line only. | La lista está escrita entre corchetes en una sola línea, y este editor solo cambia la forma de disparador de una lista escrita con un elemento por línea. | 3-6-1 | `browser/matchEditor.ts#triggerFormRefusalKey` |
| P204 | `browser.matchEditor.triggerForm.refused.listEdited` | The list has changes that are not saved, and changing the trigger form would discard them. Save them or undo them first. | La lista tiene cambios sin guardar, y cambiar la forma de disparador los descartaría. Guárdalos o deshazlos antes. | 3-6-1 | `browser/matchEditor.ts#triggerFormRefusalKey` |
| P205 | `browser.matchEditor.triggerForm.refused.notEditable` | This trigger form cannot be written here: the snippet's trigger, or the key this form is written under, is one this editor may not change. | Esta forma de disparador no se puede escribir aquí: el disparador del fragmento, o la clave con la que se escribe esta forma, es uno que este editor no puede cambiar. | 3-6-1 | `browser/matchEditor.ts#triggerFormRefusalKey` |
| P206 | `browser.matchEditor.triggerForm.heading` | Trigger form | Forma de disparador | 3-6-2 | `components/MatchEditor.svelte` |
| P207 | `browser.matchEditor.triggerForm.offer` | A snippet fires from one literal trigger, from a regular expression or from a list of triggers. Changing the form carries the text over as it is: nothing in it is converted. | Un fragmento se activa con un disparador literal, con una expresión regular o con una lista de disparadores. Al cambiar de forma, el texto se traslada tal como está: no se convierte nada de él. | 3-6-2 | `components/MatchEditor.svelte` |
| P208 | `browser.matchEditor.triggerForm.to` | Change to: {form} | Cambiar a: {form} | 3-6-2 | `browser/matchEditor.ts#triggerFormChoiceKey` |
| P209 | `browser.matchEditor.triggerForm.add` | Add a trigger as: {form} | Añadir un disparador como: {form} | 3-6-2 | `browser/matchEditor.ts#triggerFormChoiceKey` |
| P210 | `browser.matchEditor.triggerForm.previewFrom` | Trigger form in the file: {form} | Forma de disparador en el archivo: {form} | 3-6-2 | `components/MatchEditor.svelte` |
| P211 | `browser.matchEditor.triggerForm.previewTo` | Trigger form after saving: {form} | Forma de disparador tras guardar: {form} | 3-6-2 | `components/MatchEditor.svelte` |
| P212 | `browser.matchEditor.triggerForm.textKept` | The text is kept exactly as the file writes it: | El texto se conserva exactamente como lo escribe el archivo: | 3-6-2 | `browser/matchEditor.ts#triggerFormTextNoteKey` |
| P213 | `browser.matchEditor.triggerForm.textEdited` | The text is written as it now stands, and nothing in it is converted: | El texto se escribe tal como está ahora, sin convertir nada de él: | 3-6-2 | `browser/matchEditor.ts#triggerFormTextNoteKey` |
| P214 | `browser.matchEditor.triggerForm.listHolds` | The list will hold these triggers, in this order: | La lista contendrá estos disparadores, en este orden: | 3-6-2 | `browser/matchEditor.ts#triggerFormTextNoteKey` |
| P215 | `browser.matchEditor.triggerForm.confirm` | Confirm this change of trigger form | Confirmar este cambio de forma de disparador | 3-6-2 | `components/MatchEditor.svelte` |
| P216 | `browser.matchEditor.triggerForm.confirmed` | This change of trigger form is confirmed. Undo takes the confirmation back. | Este cambio de forma de disparador está confirmado. Deshacer retira la confirmación. | 3-6-2 | `components/MatchEditor.svelte` |
| P217 | `browser.matchEditor.triggerForm.cancel` | Cancel the change of trigger form | Cancelar el cambio de forma de disparador | 3-6-2 | `browser/matchEditor.ts#triggerWithdrawalKey` |
| P218 | `browser.matchEditor.triggerForm.cancelAddition` | Take back the added trigger | Retirar el disparador añadido | 3-6-2 | `browser/matchEditor.ts#triggerWithdrawalKey` |
| P219 | `browser.matchEditor.regex.hint` | Whether this pattern compiles is checked when you save, not while you type. | Si este patrón compila se comprueba al guardar, no mientras escribes. | 3-6-2 | `components/MatchEditor.svelte` |
| P220 | `browser.matchCreation.optionsHeading` | Options | Opciones | 3-13-2 | `components/MatchCreator.svelte` |
| P221 | `browser.matchCreation.seededFrom` | The defaults saved for {path} are filled in below. Each is written only if it is still here when you add the snippet, and you can change or remove any of them. | Abajo aparecen los valores predeterminados guardados para {path}. Cada uno se escribe solo si sigue aquí cuando añadas el fragmento, y puedes cambiar o quitar cualquiera de ellos. | 3-13-2 | `components/MatchCreator.svelte` |
| P222 | `browser.matchCreation.defaultKept` | {option} already had a value here, so its default was not used. | {option} ya tenía un valor aquí, así que no se usó su valor predeterminado. | 3-13-2 | `components/MatchCreator.svelte` |
| P223 | `browser.matchCreation.optionSeeded` | From this file's defaults | De los valores predeterminados de este archivo | 3-13-2 | `components/MatchCreator.svelte` |
| P224 | `browser.matchCreation.optionAbsent` | Not set: the new snippet gets no such key. | Sin definir: el fragmento nuevo no recibe esta clave. | 3-13-2 | `components/MatchCreator.svelte` |
| P225 | `browser.matchCreation.optionEmpty` | Empty: the new snippet gets this key with no value. | Vacío: el fragmento nuevo recibe esta clave sin valor. | 3-13-2 | `components/MatchCreator.svelte` |
| P226 | `browser.matchCreation.optionShown` | This value holds a line break, which a one-line box would remove, so it is shown as it is. Remove it to leave the key out. | Este valor contiene un salto de línea, que una caja de una sola línea eliminaría, así que se muestra tal cual. Quítalo para dejar fuera la clave. | 3-13-2 | `components/MatchCreator.svelte` |
| P227 | `browser.matchCreation.optionValueLabel` | Value for {option} | Valor de {option} | 3-13-2 | `components/MatchCreator.svelte` |
| P228 | `browser.matchCreation.optionAdd` | Add this option | Añadir esta opción | 3-13-2 | `components/MatchCreator.svelte` |
| P229 | `browser.matchCreation.optionRemove` | Remove | Quitar | 3-13-2 | `components/MatchCreator.svelte` |
| P230 | `browser.matchCreation.lineEndings.options` | Each option box holds one line. A line break or a carriage return pasted into one is removed. | Cada caja de opción contiene una sola línea. Un salto de línea o un retorno de carro que se pegue en ella se elimina. | 3-13-2 | `components/MatchCreator.svelte` |
| P231 | `browser.recovery.transfer.carriedInAnotherForm` | carried over in another trigger form, shown below, so no literal trigger is written | se traslada en otra forma de disparador, que se muestra abajo, así que no se escribe ningún disparador literal | 3-6-2 | `browser/recovery.ts#transferStatusKey` |
| P232 | `browser.recovery.transfer.switchedAway` | You asked for this content kind to be switched to another, so the new snippet is written with that other key instead. | Pediste que este tipo de contenido se cambiara por otro, así que el fragmento nuevo se escribe con esa otra clave en su lugar. | 3-5-1 | `browser/recovery.ts#transferRefusalKey` |
| P233 | `browser.recovery.transfer.oneContentOnly` | A snippet is written with one content kind, and another one is already carried over, so this one is not. | Un fragmento se escribe con un solo tipo de contenido, y ya se traslada otro, así que este no. | 3-5-1 | `browser/recovery.ts#transferRefusalKey` |
| P234 | `browser.recovery.transfer.triggerFormCarried` | The snippet's trigger is carried over in its other form, as a pattern or as a list of triggers, so it is not written as one literal trigger. | El disparador del fragmento se traslada en su otra forma, como patrón o como lista de disparadores, así que no se escribe como un único disparador literal. | 3-6-1 | `browser/recovery.ts#transferRefusalKey` |
| P235 | `browser.recovery.transfer.listNotEditable` | This list is one this app may not edit, so none of it is carried over: a list is carried whole or not at all. | Esta lista es una que esta aplicación no puede editar, así que no se traslada nada de ella: una lista se traslada entera o no se traslada. | 3-6-1 | `browser/recovery.ts#transferRefusalKey` |
| P236 | `browser.recovery.triggerItems` | The new snippet fires from this list of triggers, carried over whole and in order: | El fragmento nuevo se activa con esta lista de disparadores, trasladada entera y en orden: | 3-6-2 | `components/RecoveryPanel.svelte` |
| P237 | `browser.recovery.searchTerms.carried` | Carried over whole, in order: | Se traslada entera, en orden: | 3-6-2 | `components/RecoveryPanel.svelte` |
| P238 | `browser.recovery.searchTerms.empty` | Carried over as an empty list, written as []. | Se traslada como una lista vacía, escrita como []. | 3-6-2 | `components/RecoveryPanel.svelte` |
| P239 | `browser.matchMove.refused.staleDraftInDocument` | A snippet in this file is open in the editor over an older reading of the file, and this app cannot tell which snippet those edits now belong to. Moving anything in this file writes it and gives its snippets new places, which could leave those edits with nothing to be saved to — so close the editor first, saving or discarding what is in it. This is how this app works, not something the file refuses. | Hay un fragmento de este archivo abierto en el editor sobre una lectura anterior del archivo, y esta aplicación no puede saber a qué fragmento corresponden ahora esos cambios. Mover cualquier cosa en este archivo lo escribe y les da a sus fragmentos sitios nuevos, lo que podría dejar esos cambios sin nada donde guardarse: cierra antes el editor, guardando o descartando lo que tenga. Así funciona esta aplicación, no es algo que rechace el archivo. | 3-5-1 | `browser/matchMove.ts#moveRefusalKey` |
| P240 | `browser.restore.refused.rawSnippetEditorOpen` | A snippet of this file is open in the snippet text editor, and this app cannot tell whether it has been edited. Replacing this file's whole text gives every snippet in it a new identity, which would leave anything unsaved with nothing to be saved to — so close that editor first, saving or discarding what is in it. This is how this app works, not something the file refuses. | Hay un fragmento de este archivo abierto en el editor de texto de fragmentos, y esta aplicación no puede saber si se ha modificado. Sustituir todo el texto de este archivo da a cada fragmento una identidad nueva, lo que dejaría lo que no se haya guardado sin ningún sitio donde guardarse: cierra antes ese editor, guardando o descartando lo que tenga. Así funciona esta aplicación, no es algo que rechace el archivo. | 3-8-2 | `browser/restore.ts#openWriteSurfaceKey` |
| P241 | `code.sequencePresence.absent` | Not in the file | No está en el archivo | 3-2 | `i18n/codes.ts#sequencePresenceKey` (template `code.sequencePresence.${…}`) |
| P242 | `code.sequencePresence.empty` | An empty list | Una lista vacía | 3-2 | `i18n/codes.ts#sequencePresenceKey` (template `code.sequencePresence.${…}`) |
| P243 | `code.sequencePresence.items` | A list with items | Una lista con elementos | 3-2 | `i18n/codes.ts#sequencePresenceKey` (template `code.sequencePresence.${…}`) |
| P244 | `code.sequencePresence.unsupportedShape` | Written, but not as a list | Escrita, pero no como lista | 3-2 | `i18n/codes.ts#sequencePresenceKey` (template `code.sequencePresence.${…}`) |
| P245 | `code.commandError.itemTextRefused` | espansoConfig cannot open this snippet’s text on its own. What it reports beside this is the reason. | espansoConfig no puede abrir el texto de este fragmento por separado. Lo que se indica junto a esto es el motivo. | 3-7 | `i18n/codes.ts#commandErrorKey` (template `code.commandError.${…}`) |
| P246 | `code.commandError.bulkRefused` | espansoConfig could not plan this bulk edit, so it wrote nothing. What it reports beside this is the reason. | espansoConfig no pudo planificar esta edición en bloque, así que no escribió nada. Lo que se indica junto a esto es el motivo. | 3-10 | `i18n/codes.ts#commandErrorKey` (template `code.commandError.${…}`) |
| P247 | `code.editError.keyNotSubstitutable` | The key of that entry is not a single-line value espansoConfig can rewrite in place, so it cannot be switched to another key. | La clave de esa entrada no es un valor de una sola línea que espansoConfig pueda reescribir en su sitio, así que no se puede cambiar por otra clave. | 3-1 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P248 | `code.editError.shapeSwitchUnsupported` | That entry cannot be switched between a single value and a list in place: only a one-line value, or a list written one item per line holding single values, can be. | Esa entrada no se puede cambiar en su sitio entre un valor único y una lista: solo se puede con un valor de una sola línea, o con una lista escrita con un elemento por línea que contenga valores únicos. | 3-2 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P249 | `code.editError.flowListTriviaAmbiguous` | A comment or a comma inside this bracketed list sits where it is not clear which item it belongs to, so its items cannot be added or removed without guessing. | Un comentario o una coma dentro de esta lista entre corchetes está donde no queda claro a qué elemento pertenece, así que no se pueden añadir ni quitar elementos sin adivinar. | 3-3 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P250 | `code.editError.flowListLayoutUnsupported` | This bracketed list is laid out in a way item edits do not support: an item spans lines, or an empty list holds a line break or a comment. | Esta lista entre corchetes está escrita de una forma que la edición de elementos no admite: un elemento ocupa varias líneas, o una lista vacía contiene un salto de línea o un comentario. | 3-3 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P251 | `code.editError.itemTextMustBeTheOnlyEditInItsBatch` | A snippet’s text has to be saved on its own; espansoConfig does not check it combined with another change. | El texto de un fragmento debe guardarse solo; espansoConfig no lo comprueba combinado con otro cambio. | 3-7 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P252 | `code.editError.itemRangeNotContiguous` | This snippet’s lines include a comment that belongs to the file rather than to the snippet, so its text cannot be edited on its own. Edit the whole file’s text instead. | Las líneas de este fragmento incluyen un comentario que pertenece al archivo y no al fragmento, así que su texto no se puede editar por separado. Edita el texto de todo el archivo. | 3-7 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P253 | `code.editError.itemTextHoldsCarriageReturn` | This snippet’s text contains a carriage return, which a text box cannot keep. Edit the whole file’s text instead. | El texto de este fragmento contiene un retorno de carro, que un cuadro de texto no puede conservar. Edita el texto de todo el archivo. | 3-7 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P254 | `code.editError.itemTextLosesItsFinalLineBreak` | The text has to end with a line break, or the line after the snippet would join its last line. | El texto debe terminar con un salto de línea; si no, la línea que sigue al fragmento se uniría a su última línea. | 3-7 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P255 | `code.editError.itemTextEscapesItsIndentation` | A line of the text starts further left than the snippet’s dash, so it would belong to something outside the snippet. | Una línea del texto empieza más a la izquierda que el guion del fragmento, así que pertenecería a algo fuera del fragmento. | 3-7 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P256 | `code.editError.itemTextWouldExtendABlockScalar` | A text block just above the snippet would swallow the first line of the text, changing a value nobody edited. | Un bloque de texto justo encima del fragmento se tragaría la primera línea del texto, cambiando un valor que nadie editó. | 3-7 | `i18n/codes.ts#editErrorKey` (template `code.editError.${…}`) |
| P257 | `code.verificationFailure.plainSourceNotReadBack` | A value written as it was typed does not read back as that text. | Un valor escrito tal como se tecleó no se lee de vuelta como ese texto. | 3-10 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P258 | `code.verificationFailure.entriesNotInTheIntendedOrder` | The block’s entries are not in the order the change asked for. | Las entradas del bloque no están en el orden que pedía el cambio. | 3-1 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P259 | `code.verificationFailure.itemNotInserted` | A list does not hold the item the change asked for at one of its positions. | Una lista no contiene, en una de sus posiciones, el elemento que pedía el cambio. | 3-2 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P260 | `code.verificationFailure.sequenceStyleChanged` | A list the change added items to or removed items from is no longer written the way it was, bracketed or one item per line. | Una lista a la que el cambio añadió o quitó elementos ya no está escrita como estaba, entre corchetes o con un elemento por línea. | 3-3 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P261 | `code.verificationFailure.itemTextRangeNotOwned` | The lines espansoConfig would replace are not exactly the lines the snippet owns. That is a fault in this app. | Las líneas que espansoConfig sustituiría no son exactamente las líneas que posee el fragmento. Eso es un fallo de esta aplicación. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P262 | `code.verificationFailure.itemTextIsNotOneItem` | The text does not hold exactly one snippet: it holds none, or more than one, or it took a neighbour with it. | El texto no contiene exactamente un fragmento: no contiene ninguno, o más de uno, o se llevó un vecino consigo. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P263 | `code.verificationFailure.itemTextIsNotAMapping` | The text holds a list item that is not a snippet with fields. | El texto contiene un elemento de lista que no es un fragmento con campos. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P264 | `code.verificationFailure.constructChangedOutsideTheItemText` | Something outside the snippet would read differently with this text, and nothing asked it to. | Algo fuera del fragmento se leería de otra forma con este texto, y nada lo pidió. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P265 | `code.verificationFailure.itemTextExtendsPastItsRange` | The snippet this text writes would take in lines outside the text, such as a text block swallowing the line below it. | El fragmento que escribe este texto abarcaría líneas fuera del texto, como un bloque de texto que se traga la línea de debajo. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P266 | `code.verificationFailure.itemTextEscapesTheItem` | Part of the text would not belong to the snippet, such as a blank line at its end or a comment the file would own. | Parte del texto no pertenecería al fragmento, como una línea en blanco al final o un comentario que sería del archivo. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P267 | `code.verificationFailure.itemTextIntroducesAHazard` | The text adds a construct the visual editor does not edit, such as an anchor, an alias or a tag. | El texto añade una construcción que el editor visual no edita, como un ancla, un alias o una etiqueta. | 3-7 | `i18n/codes.ts#verificationFailureKey` (template `code.verificationFailure.${…}`) |
| P268 | `code.draftError.substitutionSourceAbsent` | The field this switch was to change is no longer in the snippet, so there is nothing to switch. | El campo que este cambio iba a sustituir ya no está en el fragmento, así que no hay nada que cambiar. | 3-1 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P269 | `code.draftError.substitutionTargetPresent` | The snippet already has the field this switch would create, and two entries sharing one key make every change to the snippet ambiguous. | El fragmento ya tiene el campo que este cambio crearía, y dos entradas con la misma clave hacen ambiguo cualquier cambio en el fragmento. | 3-1 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P270 | `code.draftError.substitutionConflictsWithField` | A switch and another change name the same field, so it is not clear which of them was meant. | Un cambio de campo y otro cambio nombran el mismo campo, así que no está claro cuál de los dos se quería. | 3-1 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P271 | `code.draftError.sequenceIntentsConflict` | Two changes to the same list say different things about it, so it is not clear which was meant. | Dos cambios a la misma lista dicen cosas distintas sobre ella, así que no está claro cuál se quería. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P272 | `code.draftError.sequenceFieldAbsent` | The snippet has no such list, so there is nothing to add to or take from. | El fragmento no tiene esa lista, así que no hay nada a lo que añadir ni de lo que quitar. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P273 | `code.draftError.sequenceFieldPresent` | The snippet already has that list, so it cannot be added again. | El fragmento ya tiene esa lista, así que no se puede añadir otra vez. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P274 | `code.draftError.sequenceHasAnUnsupportedShape` | That list is written as something other than a list, so its items cannot be changed here. | Esa lista está escrita como algo que no es una lista, así que aquí no se pueden cambiar sus elementos. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P275 | `code.draftError.sequenceIsAFlowList` | That list is written between brackets, and it cannot be switched to a single value in place. | Esa lista está escrita entre corchetes, y no se puede cambiar en su sitio a un valor único. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P276 | `code.draftError.sequenceWouldBeEmpty` | This would take every item out of the list. To have no list at all, remove the whole list instead. | Esto quitaría todos los elementos de la lista. Para no tener ninguna lista, quita la lista entera. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P277 | `code.draftError.switchWouldDiscardItems` | The list holds {items} items, and a single value would keep only one. Remove the others first. | La lista tiene {items} elementos, y un valor único conservaría solo uno. Quita primero los demás. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P278 | `code.draftError.noSequenceInsertionAnchor` | The snippet has no entry the new list could be written after. | El fragmento no tiene ninguna entrada después de la cual escribir la nueva lista. | 3-2 | `i18n/codes.ts#draftErrorKey` (template `code.draftError.${…}`) |
| P279 | `code.bulkPlanError.noOptionChanges` | No option was changed, so there is nothing to apply. | No se cambió ninguna opción, así que no hay nada que aplicar. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P280 | `code.bulkPlanError.optionRepeated` | The option {option} was asked for twice, so the edit cannot tell which value to write. | Se pidió dos veces la opción {option}, así que la edición no puede saber qué valor escribir. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P281 | `code.bulkPlanError.optionNotPlainSource` | The text for {option} cannot be written as it was typed without quotes, so nothing was written. Enter it without quotes, comments or line breaks. | El texto de {option} no se puede escribir tal como se tecleó sin comillas, así que no se escribió nada. Escríbelo sin comillas, comentarios ni saltos de línea. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P282 | `code.bulkPlanError.noFiles` | No file was selected, so there is nothing to apply. | No se seleccionó ningún archivo, así que no hay nada que aplicar. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P283 | `code.bulkPlanError.documentRepeated` | One file appears twice in this bulk edit. | Un archivo aparece dos veces en esta edición en bloque. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P284 | `code.bulkPlanError.noMatches` | No snippet of this file was selected. | No se seleccionó ningún fragmento de este archivo. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P285 | `code.bulkPlanError.matchRepeated` | One snippet of this file was selected twice. | Un fragmento de este archivo se seleccionó dos veces. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P286 | `code.bulkPlanError.identity` | A selected snippet of this file could not be found as it was selected. Read the file again and select it again. | No se encontró un fragmento seleccionado de este archivo tal como se seleccionó. Vuelve a leer el archivo y selecciónalo de nuevo. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P287 | `code.bulkPlanError.draft` | A selected snippet of this file cannot take these options. What it reports beside this is the reason. | Un fragmento seleccionado de este archivo no admite estas opciones. Lo que se indica junto a esto es el motivo. | 3-10 | `i18n/codes.ts#bulkPlanErrorKey` (template `code.bulkPlanError.${…}`) |
| P288 | `code.bulkFileOutcome.saved` | This file was written. | Este archivo se escribió. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P289 | `code.bulkFileOutcome.alreadyUnchanged` | This file already held these values, so nothing was written to it. | Este archivo ya tenía estos valores, así que no se escribió nada en él. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P290 | `code.bulkFileOutcome.conflicted` | This file changed after it was read, so nothing was written to it. | Este archivo cambió después de leerse, así que no se escribió nada en él. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P291 | `code.bulkFileOutcome.refused` | espansoConfig did not write this file, because of what it found in the result. | espansoConfig no escribió este archivo por lo que encontró en el resultado. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P292 | `code.bulkFileOutcome.consentStale` | What was confirmed for this file no longer matches the change, so it has to be confirmed again. No file was written. | Lo que se confirmó para este archivo ya no corresponde al cambio, así que hay que confirmarlo de nuevo. No se escribió ningún archivo. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P293 | `code.bulkFileOutcome.blocked` | This file could not be prepared, so no file was written. | Este archivo no se pudo preparar, así que no se escribió ningún archivo. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P294 | `code.bulkFileOutcome.failed` | Writing this file failed, and it was not changed. | Falló la escritura de este archivo, y no se modificó. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P295 | `code.bulkFileOutcome.writeOutcomeUnknown` | Writing this file failed after it may already have been replaced, so what it holds now is unknown. Read it again before going on. | La escritura de este archivo falló cuando quizá ya se había sustituido, así que no se sabe qué contiene ahora. Vuelve a leerlo antes de continuar. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P296 | `code.bulkFileOutcome.notAttempted` | This file was not attempted, and it was not changed. | No se intentó guardar este archivo, y no se modificó. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P297 | `code.bulkFileOutcome.excludedBeforeApply` | This file was left out before applying, and it was not changed. | Este archivo se dejó fuera antes de aplicar, y no se modificó. | 3-10 | `i18n/codes.ts#bulkFileOutcomeKey` (template `code.bulkFileOutcome.${…}`) |
| P298 | `code.sidecarStatus.fresh` | No preferences are saved for this configuration folder yet. | Todavía no hay preferencias guardadas para esta carpeta de configuración. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P299 | `code.sidecarStatus.loaded` | Preferences were read. | Se leyeron las preferencias. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P300 | `code.sidecarStatus.quarantined` | The preferences file was damaged. It has been renamed to {aside} in the application's own folder, and preferences start empty. No espanso file was changed. | El archivo de preferencias estaba dañado. Se ha renombrado como {aside} en la carpeta propia de la aplicación, y las preferencias empiezan vacías. No se modificó ningún archivo de espanso. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P301 | `code.sidecarStatus.quarantineFailed` | The preferences file is damaged and could not be set aside. It was left untouched, defaults are in use, and preferences cannot be saved. | El archivo de preferencias está dañado y no se pudo apartar. Se dejó intacto, se usan los valores predeterminados y no se pueden guardar las preferencias. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P302 | `code.sidecarStatus.futureSchema` | The preferences file was written by a newer version of espansoConfig (format {version}). It was left untouched, and preferences cannot be saved. | El archivo de preferencias lo escribió una versión más reciente de espansoConfig (formato {version}). Se dejó intacto y no se pueden guardar las preferencias. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P303 | `code.sidecarStatus.unreadable` | The preferences file could not be read. It was left untouched, and preferences cannot be saved. | No se pudo leer el archivo de preferencias. Se dejó intacto y no se pueden guardar las preferencias. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P304 | `code.sidecarStatus.rootUnresolved` | The location of the configuration folder could not be resolved, so preferences cannot be read or saved. | No se pudo determinar la ubicación de la carpeta de configuración, así que no se pueden leer ni guardar las preferencias. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P305 | `code.sidecarStatus.storageUnavailable` | The application's own storage folder is not available, so preferences cannot be read or saved. | La carpeta de almacenamiento propia de la aplicación no está disponible, así que no se pueden leer ni guardar las preferencias. | 3-12 | `i18n/codes.ts#sidecarStatusKey` (template `code.sidecarStatus.${…}`) |
| P306 | `code.sidecarUpdateOutcome.saved` | Preferences saved. | Preferencias guardadas. | 3-12 | `i18n/codes.ts#sidecarUpdateOutcomeKey` (template `code.sidecarUpdateOutcome.${…}`) |
| P307 | `code.sidecarUpdateOutcome.unchanged` | The preferences already held this, so nothing was saved. | Las preferencias ya tenían esto, así que no se guardó nada. | 3-12 | `i18n/codes.ts#sidecarUpdateOutcomeKey` (template `code.sidecarUpdateOutcome.${…}`) |
| P308 | `code.sidecarUpdateOutcome.notWritable` | Preferences cannot be saved right now, so nothing was written. | Ahora mismo no se pueden guardar las preferencias, así que no se escribió nada. | 3-12 | `i18n/codes.ts#sidecarUpdateOutcomeKey` (template `code.sidecarUpdateOutcome.${…}`) |
| P309 | `code.sidecarUpdateOutcome.writeFailed` | Saving the preferences failed, and the previous preferences file was left as it was. | No se pudieron guardar las preferencias, y el archivo de preferencias anterior quedó como estaba. | 3-12 | `i18n/codes.ts#sidecarUpdateOutcomeKey` (template `code.sidecarUpdateOutcome.${…}`) |

**309 rows.** Every key resolves in both dictionaries at `HEAD`.

### 2.4 How the Producer column was derived (re-runnable)

**What a producer is here.** A producer is a non-test source file under `src/` that names the key.
Paths are shown relative to `src/lib/`. A `.ts` file is suffixed with `#name`, the top-level function
or `const` that encloses the first match. That name is the exact accessor: a `*Key` function in
`i18n/codes.ts`, or a key-choosing function in a `browser/*.ts` model. A `.svelte` file is the
component that names the key directly.

**The script** is `/private/tmp/3-15-2/producers.cjs`, outside the repository and not committed.
It is re-run with:

```sh
node /private/tmp/3-15-2/producers.cjs <repo> c89f029 summary   # the counts below
node /private/tmp/3-15-2/producers.cjs <repo> c89f029 rows      # key <TAB> producer, 310 lines
```

It builds the candidate files with `rg --files src -g '*.ts' -g '*.svelte' -g '!*.test.ts' -g
'!*.d.ts'`, run from the repository root. The 310 keys are the 309 added keys and the 1 changed key
(§2.2). For each key it tries two matches, in order:

1. **Literal:** the whole key between quote characters (`'…'`, `"…"` or `` `…` ``).
2. **Template:** only if no literal match is found. It looks for the longest dot-ending prefix of
   the key followed by `${`, as in `` `code.editError.${…}` ``.

An equivalent `rg` check for one key is `rg -l --glob '!*.test.ts' --glob '!*.json' "['\"\`]<key>['\"\`]" src`.

**The counts it printed:**
- 310 keys in all.
- **241** matched literally.
- **69** matched through a template, all in `i18n/codes.ts`, through `sequencePresenceKey`,
  `commandErrorKey`, `editErrorKey`, `verificationFailureKey`, `draftErrorKey`, `bulkPlanErrorKey`,
  `bulkFileOutcomeKey`, `sidecarStatusKey` and `sidecarUpdateOutcomeKey`.
- **0 keys with no producer found in `src/`.** Had a key had none, its cell would read "none found
  in `src/`".

**Bounds.** A literal match shows that a file **names** the key, not that it draws it.
- A match could sit in a comment. No match was inspected by hand.
- Where the producer is a `*Key` function in `codes.ts` or a `browser/*.ts` model, the component
  that renders that function's result is one call further on. It is **not traced here**.
- The template rule credits a whole family to one function. It does not check that the function can
  actually produce every member of the family. That is the job of the `codes.ts` type checks and the
  i18n parity suites.
- A file that names a key in more than one function is listed once, under its first function.

---

## 3. The window halves owed by 3-5 … 3-14 (step 3-15 acceptance clause 5)

Ruling 30 names the steps that owe a window half: **3-5, 3-6, 3-8, 3-9, 3-11, 3-13, 3-14**. The steps
with none (3-1, 3-2, 3-3, 3-4, 3-7, 3-10, 3-12, 3-15) record *"No window reading was performed or
claimed"* (ruling 30). §4.1 says a model's look at a `screencapture -l` capture of a visible window
is recorded as a model's look. Real keyboard and pointer input, wording clarity and layout
acceptance are reserved to a person. No mounted test and no hidden page counts as a reading.

**Tally: seven owed. Five were read in part, each by the driven model's look and none by the owner.
Two are unread and owed to an attended session.** None of the five readings is complete. Each
record lists what it did not read, summarised in the last column.

| Step | Piece | Read? | By whom, and the record | What it did **not** read (per its own record) |
|---|---|---|---|---|
| **3-5** | 3-5-2-2 | **Read in part.** Step 3-5 closed. | The **driven model's look**, 2026-09-24 07:13–07:23. Unlocked screen, EN and ES through the picker, 10 launches (L05 void, L08 read in part). [`3-5-2-2-notes.md`](3-5-2-2-notes.md) §1, §3, §4; [`3-5-2-2-window-reading.md`](3-5-2-2-window-reading.md). Review `ship`, 0 findings (`docs/reviews/phase-3-5-2-2.md`). | Real keyboard or pointer input. Pressing a suggestion. The *text edited* switch-preview variant and a removed-companion list. A single-marker `$\|$` insertion and its undo. **Every conflict choice after the block-scalar conflict** (reload, reapply, copy, keep editing). The save-press path of a conflict; the conflict was raised by the watcher, not by a save (§4 row 5, §5 item 6, §6). |
| **3-6** | 3-6-3 | **Read in part.** Step 3-6 closed. | The **driven model's look**, 2026-09-24 09:05–09:42. 31 launches, of which L09–L21 were exploratory and L26/L27 superseded. [`3-6-3-notes.md`](3-6-3-notes.md) §1, §3; [`3-6-3-window-reading.md`](3-6-3-window-reading.md). Review `ship`, 0 findings. | Real input. **Every save of a trigger-form change or a list edit**; none was pressed, so no post-save bytes were seen. *Take back the added trigger*. The *text edited* variant. Pressing recovery's *Create this snippet*. A carried multi-item `triggers` list and a carried *edited* `search_terms` list in recovery. The empty and refused `search_terms` recovery arms. The commented multi-line flow list was read **only as a refusal**, because no editor is offered for it (§3 *Unread*, §4 items 1–2). |
| **3-8** | 3-8-3 | **Read in part.** Step 3-8 closed. | The **driven model's look**, 2026-09-24 11:40–11:53. L01/L02 exploratory, L03–L10 read. [`3-8-3-notes.md`](3-8-3-notes.md) §1, §4; [`3-8-3-window-reading.md`](3-8-3-window-reading.md). Review `ship`, 0 findings. | Real input. Pressing *Redo* after a committed save. The discard confirmation over a dirty draft. *Edit this file's text* pressed from the fallback route. The snippet editor's send-failure, uncertain-write, conflict and stale-identity panels. The trailing-blank-line refusal. Whether the grey reads as "unavailable" to a person. A save held **inside Rust**: the hold delayed the IPC request only (§4 *Unread*). |
| **3-9** | 3-9-2 | **Read in part.** Step 3-9 closed. | The **driven model's look**, 2026-09-24 12:38–12:51. L01 exploratory, L02/L03 read, and **L04/L05 re-read the F1 fix**. [`3-9-2-notes.md`](3-9-2-notes.md) §1, §4, §8; [`3-9-2-window-reading.md`](3-9-2-window-reading.md). Review `ship-with-fixes`: F1 fixed and re-read. | **Both sidebar tooltips** (DOM only; a native `title` needs real hover). Real input. The `notRead` and `unsupportedShape` states. An import entry holding a line break or `\r`. Layout and wording judgement (§4 *Unread*, §5 item 5). |
| **3-11** | 3-11-3 | **Read in part.** Step 3-11 closed. | The **driven model's look**, 2026-09-24 15:08–15:13. Two launches, L01 EN and L02 ES. [`3-11-3-notes.md`](3-11-3-notes.md) §1, §3; [`3-11-3-window-reading.md`](3-11-3-window-reading.md). Review `ship-with-fixes`, 2 SHOULD-FIX fixed in the records (`docs/progress-archive/status-table.md`, the 3-11-3 row). | Real input. Typing into a *Set to* box. The blockers `emptyValue`, `nothingToApply`, `editorOpen`, `consentNotPossible`, `consentOutdated`, `readFailed`. The outcomes `conflicted`, `consentStale`, `blocked`, `writeOutcomeUnknown`, `alreadyUnchanged`, the `notAttempted`/`failed` answers and `rereadFailed`. Mixed by exact spelling alone. Wording and layout (§3 *Unread*, §5 item 7, §6). |
| **3-13** | 3-13-3 | **Unread. Owed to an attended session.** Step 3-13 is **not** closed. | Nobody. The driven iteration of 2026-09-24 17:15 WEST found the screen locked. The owner ruling of that day set the step aside ([`3-split-notes.md`](3-split-notes.md) §4.8; `PROGRESS.md` status row *3-13-3*). No instrument, no reading. 3-13-1 and 3-13-2 each record *"No window reading was performed or claimed"* (`PROGRESS.md` status rows *3-13-1*, *3-13-2*). | All of it. Owed: EN and ES through the picker, with a long display name, over synthetic data. The sidebar's display name with the real path and the rank order. The creator's seeded defaults drawn before *Create*, one removed and its key absent from the file. The preferences control saving, and its sidecar codes. **Measuring** `3-13-2-notes.md`'s unmeasured claim that a one-line input deletes a pasted line feed (`PROGRESS.md` *Next action*, "3-13-3, cold"). |
| **3-14** | 3-14 | **Unread, and not started. Owed to an attended session.** | Nobody. It needs the owner's CF-52 and CF-54 rulings, quoted verbatim before any change, then its window half (`3-split-notes.md` §2 *3-14*, §4.4, §4.8). | All of it: the rulings, any change they ask for, and the reading at 1180x728 in EN and ES of the save-origin and the external-origin panels. |

**Mounted evidence is not in this table.** 3-5-2-1, 3-6-2, 3-8-2, 3-9-1, 3-11-2 and 3-13-2 carry
mounted jsdom suites. Per ruling 30 and §4.1 those are mounted evidence, not screens, and none is
credited here.

---

## 4. R16, R30, R35, R38 and the CF rows, bounded (step 3-15 acceptance clause 6)

Each entry states what Phase 3 changed about the item, if anything, and what stays open. **No Phase 3
record claims that any of the four risks narrowed or closed.** The `PROGRESS.md` *Open risks* rows for
all four are unchanged by Phase 3.

### 4.1 R16 — saphyr (YAML 1.2) versus espanso's 1.1-ish resolver

- **What Phase 3 changed:** nothing about the risk itself. Phase 3 widened the editor to every eligible
  scalar field, the nine options included, as **textual controls**. D2u holds: no control infers a
  type (ruling 10; `3-split-notes.md` §2 *3-5* acceptance, "No control infers a boolean").
  Suggestions compare by `===` only (`CLAUDE.md` §6). Bulk writes booleans as plain source, and an
  ineligible spelling writes nothing
  (`bulk::bulk_booleans_are_written_as_plain_source_and_an_ineligible_spelling_writes_nothing`, cited
  in `3-15-1-notes.md` §3 W7).
- **What stays open, unchanged:** R16's open half, the projection of pre-existing plain scalars
  against espanso's actual resolver, with the two named weaknesses in `PROGRESS.md` (explicit tags
  outside the table; no second implementation of the 1.2-core half). Ruling 17 records that a vendored
  schema would not touch R16. `3-split-notes.md` §1 bound 2 says R16 stays open.
- **One Phase 3 item bears on it without changing it:** `3-10-notes.md` §5 item 1 (carried by
  `PROGRESS.md` *Next action*). The single-match options editor writes `word: 'true'` quoted. A
  quoted `'true'` is a string under both YAML 1.1 and 1.2, so this is a spelling question for a later
  phase, not a resolver disagreement. This record makes no claim about how espanso reads it.

### 4.2 R30 — nothing in the projection is proven against espanso itself

- **What Phase 3 changed:** plan §12 puts "unknown-field preservation verified end to end" in Phase 3.
  3-15-1 supplies that evidence through the command path (`3-15-1-notes.md` §4). Each Phase 3 writer
  conserves every pre-existing unknown entry, by owner, key spelling and value bytes, outside an
  explicit raw edit. That is **R30's accepted failure mode, now evidenced through `run_one_save`**: a
  field espanso has and plan §3 lacks lands in `unknown_entries` and survives. It is not a check
  against espanso's schema.
- **What stays open:** all of R30. **"R30 stays open"** (ruling 17; `3-split-notes.md` §1 bound 2).
  No schema was vendored, and no differential field-list check exists. The `$|$`-in-`replace`-only
  rule (ruling 18) rests on plan §3, which R30 says is unverified (`3-split-notes.md` §8 item 3). The
  3-15-1 bounds apply: one LF fixture with no BOM and no hazards (`3-15-1-notes.md` §7 item 5).

### 4.3 R35 — nothing establishes that a Spanish string is Spanish

- **What Phase 3 changed:** it added 309 keys and changed one value, EN and ES (§2). That is 309
  more Spanish values under R35's exposure, which is the growth R35 predicts. This record delivers
  the separate inventory ruling 29 asks for (§2.3). The window halves record a few Spanish wording
  observations, each for the owner: `3-5-2-2-notes.md` §5 item 3 (the ES rename sentence without an
  article and with capitalised field labels) and `3-11-3-notes.md` §5 item 5 (*Archivos aplicados* for
  a file that was not applied). The window halves also record **ES fit** (nothing seen clipped) in
  `3-5-2-2-notes.md` §4, `3-6-3-notes.md` §3, `3-8-3-notes.md` §4, `3-9-2-notes.md` §4 and
  `3-11-3-notes.md` §3. Fit is a layout observation, not a translation check.
- **What stays open:** all of R35. No native-speaker review of any Spanish string, Phase 3's or
  2d-7-10's 145, was performed. It stays **the owner's, before Phase 5** (ruling 29; CF-51;
  `PROGRESS.md` *Next action*, "Owed by the owner").

### 4.4 R38 — window readings on one easy fixture shape

- **What Phase 3 changed:** ruling 31 made four deliberate touches, each read by the driven model's
  look on an unlocked screen (§3):
  1. **3-5:** a `|` block-scalar content conflict on a synthetic snippet. The watcher's conflict
     panel was drawn over a two-line block with the disk version shown (`3-5-2-2-notes.md` §4 row 5).
  2. **3-6:** the commented multi-line flow list, a byte copy of `flow-collections.yml:16-22`. It was
     drawn as a **refusal** with its source text intact, and no editor is offered
     (`3-6-3-notes.md` §3, §4 item 2).
  3. **3-8:** three corpus fixtures, byte-copied. `block-scalars.yml`: a `|` block with an interior
     blank line under a leading comment block, where the save changed one line.
     `run-based-removal-boundaries.yml`: the disjoint-ownership refusal.
     `file-comments-and-mixed-endings.yml`: CRLF lines among LF ones and no final newline, with
     the `\r` refusal (`3-8-3-notes.md` §4 row 5).
  4. **3-11:** an anchored snippet excluded from a bulk selection as read-only, on a synthetic
     fixture (`3-11-3-notes.md` §3).

  So **three of the fifteen `CLAUDE.md` §4 fixtures have now been through a window**, all at 3-8.
  2d-7-7's viewer readings of the fifteen are counted separately under CF-50.
- **What stays open:** R38 is **not closed and not narrowed wholesale** (ruling 31: "touched
  deliberately, never closed wholesale"). Each touch has an unread remainder (§3). No conflict choice
  was pressed after the block-scalar conflict. The commented flow list was never edited. 3-8's
  `run-based-removal-boundaries.yml` reading reached only the refusal. No Unicode case was read in a
  window, although the consult asked for one where a surface displays it
  (`docs/reviews/phase-3-design.md:319`). The panel/refresh half of CF-50 (R38-c) stays unread.
  The `PROGRESS.md` R38 row still ends at 2d-5-7b and does not mention these touches (open item 2,
  §8).

### 4.5 The CF rows (CF-1 … CF-55, `2d-7-10-notes.md` §5)

`3-split-notes.md` §7 places every row by range. **Only CF-55 changed state in Phase 3.** No step
record from 3-1 to 3-15-1 cites a CF row other than CF-55, which 3-8-1, 3-8-2 and 3-8-3 cite.

| Rows | What Phase 3 did | State after Phase 3 |
|---|---|---|
| **CF-55** (raw *Undo* enabled while `saving`; *Stop editing* drawn dark) | Ruling 13 fixed it on both raw surfaces. The model half is in 3-8-1, the mounted half in 3-8-2. The window half, 3-8-3, read the DOM state and the capture in one launch, EN and ES, on `RawSnippetEditor` and `RawEditor`. All four controls were `disabled` and drawn grey, synthetic presses changed nothing, and the 2d-7 *Stop editing* observation did not reproduce (`3-8-3-notes.md` §1, §4 rows 4a/4b). | **Closed by 3-8-3's reading, within its bounds.** Presses were script-dispatched, not real input. The hold delayed the IPC request, and a save held inside Rust was not produced (`3-8-3-notes.md` §1, §4 *Unread*). *Redo* stays enabled after a committed save, recorded as an observation, not a defect (`3-8-3-notes.md` §5 item 1). |
| CF-52, CF-54 (delete-panel fold; overlapping opening paragraphs) | Nothing. Assigned to 3-14 after the owner's ruling (§4.4). | **Open.** 3-14 is owed to an attended session (§3). |
| CF-53 (close/keep labels) | Nothing. | The owner's; labels kept (ruling 32). |
| CF-51 (R35) | The inventory in §2 is its Phase 3 input. | **Open**, the owner's before Phase 5 (§4.3). |
| CF-50 (R38's residue) | Touched by 3-5, 3-6, 3-8 and 3-11 (ruling 31; §4.4 above). No step record names CF-50 by number. | **Open, not closed** (`3-split-notes.md` §7). |
| CF-12, CF-14 … CF-18, CF-39, CF-40 (recovery, authored-text conflict) | Ruling 33 says 3-5 and 3-6 change their **subject** (wider recovery). No step record cites any of them, and none supplies its missing observation. | **Open, unchanged.** Ruling 33: no row is closed unless its own missing observation is supplied. The 3-6-3 recovery readings (§3) are not credited to any of these rows here, because no record maps them. |
| CF-13, CF-24, CF-25 (held-save and acknowledgement states) | Subject changed by 3-5, 3-6, 3-8, 3-11 (ruling 33). Not cited by any step record. | **Open, unchanged.** 3-8-3's held-save reading is credited to CF-55 only, as its record says. |
| CF-27 … CF-30 (projection replacement, surface notes) | Subject changed by 3-11's selection invalidation (ruling 33). Not cited. | **Open, unchanged.** |
| CF-1 … CF-6 (the rebindings) | Nothing. | Ended with the instrument at 2d-8, **not closed by proof** (§4.5). |
| CF-47 … CF-49 (constructed readings) | Nothing. | **Never credited as reached** (§4.5). |
| **Untouched:** CF-7 … CF-11, CF-19 … CF-23, CF-26, CF-31 … CF-38, CF-41 … CF-46 | Nothing. | **No phase named; unchanged** (`3-split-notes.md` §7). |

**What this table does not claim.** A row whose subject ruling 33 says changed is not narrowed by that
sentence. No Phase 3 record ties a reading to it, so this record treats it exactly as before Phase 3.

---
## 5. Scope statement: what shipped against plan §12 (ruling 17)

### 5.1 Plan §12's Phase 3 scope, item by item

Plan §12 (`IMPLEMENTATION_PLAN.md:1110-1116`) lists Phase 3's scope and gives it **no exit line**; the
nearest **Exit:** (`:1108`) is Phase 2's. `3-split-notes.md` §5 is the binding list of plan sentences
Phase 3 overrides, and ruling 1 moves some things out of Phase 3.

| Plan item | What shipped | What did not ship, or is owed |
|---|---|---|
| `triggers` (multiple) and `regex` | **In the editor:** trigger-form switching (`trigger` / `triggers` / `regex`) with a preview and a confirmation. List add and remove on `triggers` that keeps block or flow style. `regex` checked by the Rust validator at save. `Several`/`Absent` drawn with no silent winner. Built by 3-2 and 3-3 (core), 3-6-1 (model), 3-6-2 (components) and 3-6-3 (window, read in part). | No debounce validation (ruling 7; §5 row 1). A `RegexDoesNotCompile` finding reflects this crate's `regex`, not espanso's runtime. `Several` offers only a raw-repair sentence, not a one-click route (`3-6-3-notes.md` §4 item 4). No list reordering (`3-6-1-notes.md` §6). **A match whose flow list holds a comment is not editable at all** (`3-3-notes.md` §7 item 1; `3-6-3-notes.md` §4 item 2). |
| Markdown / HTML / `image_path` / shorthand forms | All five content fields are editable in the match editor, with a content-kind switch that has a preview and a confirmation. Built by 3-1 (core substitution), 3-5-1 and 3-5-2-1. | `form_fields` stays read-only until Phase 4, and shorthand `form` is layout text only (ruling 9). Dormant empty content boxes are drawn (`3-5-2-2-notes.md` §5 item 4). |
| all metadata and matching options | `label`, `comment` and the nine options as textual controls, with exact-string suggestions for `uppercase_style` and `force_mode`, and `force_mode` and `force_clipboard` in one *Insertion* group as two controls (ruling 10; 3-5-1, 3-5-2-1). `search_terms` list editing (3-6). | **The new-snippet form does not author the wider fields.** Core `NewMatch` supports them (3-4), but `MatchCreator.svelte` authors trigger + `replace` plus the seven option defaults only. 3-5-2-1 left the rest to 3-13 (`3-5-2-1-notes.md` §2), and 3-13-1 left it unauthored (`3-13-1-notes.md` §3, §6 item 4). No step owns it (open item 3, §8). The single-match editor writes `word: 'true'` quoted (`3-10-notes.md` §5 item 1). |
| cursor hint insertion | A buffer-only `$\|$` action for `replace` only, with a several-markers advisory (ruling 18; 3-5-1, 3-5-2-1). | A single-marker insertion and its undo were not read in a window (§3). The `replace`-only rule rests on plan §3, which R30 says is unverified. |
| `imports` and `_`-disabled files | **Display only** (ruling 14): ordered imports, the absent/empty/unsupported states, and the `_` explanation as "not auto-loaded". Built by 3-2 (presence) and 3-9-1, with 3-9-2 as the window half (read in part, F1 fixed). | Import editing, import resolution and file renames are **out of Phase 3** (ruling 1). How espanso handles `_` configuration profiles is unverified (`3-9-2-notes.md` §5 item 4). |
| raw YAML escape hatch per snippet | A local, contiguous owned-range edit (`save_match_item_text`, 3-7), cut in Rust and never `ReplaceText`. The raw-snippet model and component follow (3-8-1, 3-8-2). CF-55 is fixed on both raw surfaces (3-8). | A non-contiguous range falls back to the whole-document editor. An anchor, alias, tag or merge key anywhere in `matches` refuses raw editing of every snippet (`3-7-notes.md` §5). A trailing blank line is refused. |
| unknown-field preservation verified end to end | **3-15-1:** each of the eight Phase 3 writers has a success and a refusal test. Conservation of unknown bytes and coverage is checked through the session/command path, with exact expected disk bytes and unknown entries compared by owner, path, key spelling and value bytes against a fresh parse. Stale, uncertain and partial bulk outcomes are covered. Corrupted candidates are refused by the real verifiers ([`3-15-1-notes.md`](3-15-1-notes.md) §2–§6). | **3-15-1's own "Not guaranteed"** (`3-15-1-notes.md` §7) bounds this. W1's refusal is shown at the core layer only. `update_sidecar` is tested through its two-call body, not called. "Refused rather than committed" is shown at the verifier, not at the transaction. The candidate mirrors cover only the edit kinds they list. The command-path fixture is one LF file with no BOM and no hazards. Coverage is compared by path and counts. The expected bytes are the test author's statement. It makes no window claim. R30 stays open (§4.2). |
| multi-select bulk edit (§8.8) | One backend coordinator, `apply_bulk_options` (3-10): preflight every file, one `run_one_save` per file, stop at the first conflict, refusal, failure or uncertain write, and account for every file. *Select several* in the snippet list and the bulk inspector (3-11-1, 3-11-2): Mixed by exact spelling sliced in Rust, explicit intents limited to the seven options, exclusions, per-file consent, partial outcomes. Window half read in part at 3-11-3, including a partial success agreeing with the disk. | Overridden by `3-split-notes.md` §5: **per-file atomicity, not cross-file** (row 3). *Move to file* removed (row 4). No post-save batch undo (row 5). Three candidate defects are recorded at `3-11-3-notes.md` §5 items 1–3. |
| sidecar display names and per-file new-snippet defaults (§8.9) | The application sidecar store (3-12), confined to app storage, with atomic replacement, truthful quarantine and last-write-wins. Display names with the real path always shown, `sortOrder` as a rank, and the seven defaults as optional text seeded visibly into a new-snippet draft (3-13-1, 3-13-2). | **Its window half, 3-13-3, is owed and unread (§3), so step 3-13 is not closed.** No control on screen sets `sortOrder`, and preferences refresh only on `open()` (`3-13-2-notes.md` §6). Overridden by `3-split-notes.md` §5 rows 6–8: defaults are text, never booleans. A moved workspace opens a fresh sidecar. Deleting the sidecar loses names, ordering and defaults. |

**Delete-conflict wording and action placement (3-14)** is not a plan §12 item. It is the consult's
home for CF-52 and CF-54 (ruling 32). **It did not ship and is not started**, and it is owed to an
attended session (§3).

### 5.2 Per step, what each delivered

Each step's notes are the full account. This is the one-line index.

| Step | Delivered | Window | Record |
|---|---|---|---|
| 3-1 | Core: grouped insertion of several absent fields after one anchor (`InsertFields`), and key substitution (`SubstituteKey`) that keeps the sequence dash on a compact first entry. | none owed | `3-1-notes.md` |
| 3-2 | Core: sequence presence (absent / empty / items / unsupported) for `triggers`, `search_terms` and `DocumentView.imports`; block scalar-list insertion and removal; `trigger`↔`triggers` shape switch. | none owed | `3-2-notes.md` |
| 3-3 | Core: flow scalar-list insertion and removal without changing presentation; ambiguous trivia refused by name. | none owed | `3-3-notes.md` |
| 3-4 | Core and command: wider `NewMatch` (trigger forms, content kinds, label, comment, `search_terms`, nine options as text) through `create_match`. | none owed | `3-4-notes.md` |
| 3-5 | 3-5-1 model: 17 editable scalar fields, content switch, `$\|$` action, recovery widened, R36's conservative rule. 3-5-2-1 components and i18n. 3-5-2-2 window. | read in part (model) | `3-5-1-notes.md`, `3-5-2-1-notes.md`, `3-5-2-2-notes.md` |
| 3-6 | 3-6-1 model: trigger-form and list submodels, conservative list reapply, recovery for regex and lists. 3-6-2 components. 3-6-3 window. | read in part (model) | `3-6-1-notes.md`, `3-6-2-notes.md`, `3-6-3-notes.md` |
| 3-7 | Core and command: the local raw-item edit, and `match_item_text` / `save_match_item_text`. | none owed | `3-7-notes.md` |
| 3-8 | 3-8-1 raw-snippet model and CF-55's model half. 3-8-2 `RawSnippetEditor.svelte` and CF-55's mounted half. 3-8-3 window, with CF-55 read. | read in part (model) | `3-8-1-notes.md`, `3-8-2-notes.md`, `3-8-3-notes.md` |
| 3-9 | 3-9-1 file-scope model and inspector, and the `_` mark. 3-9-2 window with the F1 position fix. | read in part (model) | `3-9-1-notes.md`, `3-9-2-notes.md` |
| 3-10 | Core and command: the per-file bulk coordinator `apply_bulk_options`. | none owed | `3-10-notes.md` |
| 3-11 | 3-11-1 bulk model and `match_option_spellings`. 3-11-2 multi-select and `BulkInspector.svelte`. 3-11-3 window. | read in part (model) | `3-11-1-notes.md`, `3-11-2-notes.md`, `3-11-3-notes.md` |
| 3-12 | The application sidecar store (`src-tauri/src/sidecar.rs` and `sidecar/`), `load_sidecar` / `update_sidecar`, and `CLAUDE.md` §6's application-metadata sentence (ruling 25). | none owed | `3-12-notes.md` |
| 3-13 | 3-13-1 preferences model and seeding; sidecar commands made async. 3-13-2 sidebar names, the creator's seeded defaults, and `FilePreferences.svelte`. **3-13-3 owed.** | **unread, owed** | `3-13-1-notes.md`, `3-13-2-notes.md` |
| 3-14 | **Nothing; not started.** | **unread, owed** | `3-split-notes.md` §2 *3-14*, §4.8 |
| 3-15 | 3-15-1 cross-layer preservation evidence (tests only). 3-15-2 this record. | none owed | `3-15-1-notes.md`, this file |

---

## 6. Not guaranteed

1. **The inventory is not a translation review.** It lists values. It does not judge them, and parity
   between the dictionaries says nothing about meaning (R35). Its step attribution is by first commit.
   A value reworded later shows only its final text (§2.1).
2. **The window table reports what the records say.** This record re-read no capture and launched
   nothing. "Read in part" is the most any row can claim. Each reading was a model's look at captures
   driven by script-dispatched DOM events, and **no Phase 3 window half was read by the owner**.
3. **The risk and CF statements are bounded by the records.** Where no Phase 3 record ties a reading
   to a CF row, the row is stated unchanged, even where a reading might bear on it (§4.5).
4. **The scope statement is a map, not new evidence.** Its preservation claims are 3-15-1's, under
   3-15-1's own bounds (§5.1). Its per-step summaries paraphrase each step's notes, and those notes
   govern where they differ.
5. **Nothing here is about espanso's runtime.** R16 and R30 stay open.

## 7. What is not closed

- **Phase 3 is NOT closed.** Two items are owed to an attended session (`3-split-notes.md` §4.8;
  `PROGRESS.md` *Next action*):
  1. **3-13-3**, the window half of step 3-13, needs a visible, unlocked screen.
  2. **3-14** needs the owner's CF-52 and CF-54 rulings first, then its window half.
- **Step 3-13 is NOT closed** while 3-13-3 is owed (§4.8, third bullet).
- **3-15-2 closes on this record's review, and step 3-15 closes with it.** Step 3-15 does not
  close Phase 3 (§4.8). After 3-15-2 the driven run stops BLOCKED on the attended session, and the
  ruling does not start Phase 4 (§4.8, last bullet).
- Owed by the owner and outside the split, unchanged: plan §12's Phase 2 exit (a week of real use
  with zero data loss) has not been run, and R35/CF-51 is the owner's before Phase 5
  (`3-split-notes.md` §7, "Owner obligations").

## 8. Open items (noticed, not fixed here)

1. **A count in a record disagrees with the dictionaries.** `3-11-2-notes.md` §1.5 says "53 new keys in
   each language: `browser.list.bulk.*` (7) and `browser.bulkInspector.*` (46 …)". The derivation in
   §2.1 attributes **54** keys to 3-11-2's commit `fc728ec`: 7 `browser.list.bulk.*` and **47**
   `browser.bulkInspector.*`, all present at `HEAD`. This record does not correct that sentence; a
   later records step should.
2. **`PROGRESS.md`'s R38 row does not mention Phase 3's four ruling-31 touches.** It still ends at
   "Narrowed at 2d-5-7b". §4.4 states them. Whether the row gains a sentence is for the phase that
   next edits `PROGRESS.md`.
3. **The creation form's wider fields have no owning step.** Core `NewMatch` accepts content kinds,
   label, comment, trigger forms and `search_terms` (3-4). 3-5-2-1 deferred the form to 3-13
   (`3-5-2-1-notes.md` §2), and 3-13-1 left it unauthored (`3-13-1-notes.md` §6 item 4). A later phase
   should take it deliberately, or the scope statement should keep saying it did not ship.
4. **The commented flow list handoff was dropped.** `3-3-notes.md` §7 item 1 gives 3-6 the decision
   on the match-wide `CommentInFlowCollection` gate. `3-6-1-notes.md` §6 says the list "is covered in
   the core by 3-3 and is 3-6-3's to read in a window". 3-6-3 then found the match not editable at all
   (`3-6-3-notes.md` §4 item 2). No step decided the gate, so step 3-6's "block and flow lists keep
   their style" holds, in a window, for comment-free flow lists only.
5. **The ruling-33 subject changes are unmapped.** No step record maps a reading to CF-12 … CF-18,
   CF-24, CF-25, CF-27 … CF-30, CF-39, CF-40 or CF-50 (§4.5). A later records step could say, row by
   row, whether any Phase 3 reading supplies a row's missing observation. This record does not.
6. **The candidate defects the window halves recorded remain open**, none of them fixed:
   - `3-6-3-notes.md` §4 item 1: a draft holding a list-item addition never drew the external-change
     panel.
   - `3-11-3-notes.md` §5 items 1–3: the list draws no disabled state; a failed file's promised
     reason is not drawn; the *All* list reorders after a bulk commit.
   - `3-5-2-2-notes.md` §5 item 1: the disk-version box does not wrap.

   `PROGRESS.md` *Next action* carries these together with the per-step open-item lists.
7. **The derivation scripts are outside the repository** (`/private/tmp/3-15-2/inventory.cjs` and
   `producers.cjs`). §2.4 gives a one-key `rg` form of the producer check. §2.1
   gives the `git diff | rg -c` cross-check so the count can be re-derived without it.

## 9. Verification

| Command | Exit | Result |
|---|---|---|
| `node /private/tmp/3-15-2/inventory.cjs <repo> c89f029 summary` | 0 | the counts in §2.1 |
| `git diff c89f029 HEAD -- src/lib/i18n/en.json \| rg -c '^\+  "'` | 0 | 310 (309 added keys + 1 changed value) |
| `node /private/tmp/3-15-2/producers.cjs <repo> c89f029 summary` | 0 | 310 keys: 241 literal, 69 template, 0 none (§2.4) |
| `node /private/tmp/3-15-2/producers.cjs <repo> c89f029 rows` | 0 | 310 lines, merged into §2.2 and §2.3 as the Producer column |
| `npm test` (output to `/private/tmp/3-15-2/vitest.log`) | 0 | 88 files, 4064 passed — the rung's vitest figure, unchanged |
| `git status --short --untracked-files=all` | 0 | ` M PROGRESS.json` (the orchestrator's) and `?? docs/decisions/3-15-2-notes.md`; no `src/`, `src-tauri/`, `crates/` or real-corpus path |

The Rust gates, `npm run check` and `npm run build` were not run. No file they read changed, so the
rung stays `1555 / 487 / 4064 / 214` (3-15-1).
