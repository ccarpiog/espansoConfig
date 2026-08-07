# Phase 2c-4a step 3c-2 — the window reading, six write surfaces

The third of the three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires of every 2c
sub-phase, taken over the conflict panels of all six write surfaces — `RawEditor.svelte`,
`MatchEditor.svelte`, `MatchCreator.svelte`, `MatchDeleter.svelte`, `MatchMover.svelte` and
`MatchDuplicator.svelte` — and the `DetailPane.svelte` wiring that draws them. The model tests and
the mounted cases belong to 2c-4a-3a and 2c-4a-3b; **this file is the record of what a screen
actually did**, and it is the last deliverable step 3 owes before its fixes.

**The instrument is `docs/decisions/2c-4a-3c-1-instrument.md` and it was not re-derived.** That step
proved a true `SaveResult::Conflict` can be provoked from a window by a second writer that is an
external filesystem process, on three surfaces. This step drove **all six**, in **both languages**,
and added the copy, the two-step reload, the geometry and the clipboard question that 3c-1
deliberately did not ask.

**Nothing here was inferred from the test suite.** Every line quoted below came out of a running
WKWebView, every rectangle is an element's own `getBoundingClientRect()`, and every claim about a
file's bytes is a whole-tree comparison against a pristine copy taken before that launch — never the
panel's own account of itself. Where a claim could **not** be established, §11 says so in the same
words the claim would have used.

**Three surfaces were driven for the first time**: `RawEditor`, `MatchCreator` and `MatchDeleter`.
Consult Q7's points 1, 3 and 4 were claims when 3c-1 handed over; they are transcripts now.

---

## 1. The setup

Unchanged from `2c-4a-3c-1-instrument.md` §§1–2, with four additions this step needed. The harness is
`src/probe.ts`, `src-tauri/src/probe.rs`, two hook lines each in `src/main.ts` and
`src-tauri/src/main.rs`, and `<scratch>/launch.sh`. `<scratch>` is
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/5297a7df-1f6e-4dca-8b0a-f02a92f3b872/scratchpad`,
outside the repository.

Per launch: a fresh synthetic configuration, a fresh `HOME`, a fresh ad-hoc-signed bundle at a path
never used before, one plan, and a whole-tree byte comparison afterwards.

```sh
npm run build && touch src-tauri/build.rs && cargo build -p espansoconfig --features custom-protocol
./launch.sh <surface>:<language>[:<flag>…] <name>
```

### 1.1 What this step added to the instrument

1. **A flag set instead of positional fields.** A plan is `<surface>:<language>[:<flag>…]` and the
   flags are a set: `copy`, `reload`, `after`, `twice`, `clipapi`, `external`, `cr`, `crlf`,
   `truncate`. A reading asks several independent questions of one surface, and a positional grammar
   would have made every combination a new plan name.
2. **Three new plans** — `rawconflict`, `creatorconflict`, `deleterconflict` — on
   `duplicatorConflict`'s pattern.
3. **The pasteboard on both sides.** `launch.sh` seeds it with a sentinel this launch could not have
   written (`pbcopy`), and reads it back with `pbpaste` after `--- end` and again after the process
   is killed. *Nothing was copied* is therefore distinguishable from *the previous launch's copy is
   still there*.
4. **Geometry that walks every ancestor.** `reportGeometry` prints each ancestor's computed
   `overflow-y`, `clientHeight`, `scrollHeight` and `scrollTop`, scrolls only the ones that are
   really scrollable, and re-measures. **L08 is the mistake that forced this**: a walk that stopped
   at the first ancestor whose content was taller than its box stopped at `section.rawEditor`, whose
   `overflow` is `visible` and which ignores every write to `scrollTop` — and reported a panel as
   unreachable when the real scroller, `section.detail`, was two levels further up.

### 1.2 The configuration

Synthetic, hand-written for this run, rebuilt from scratch per launch, outside the repository. One
profile (`config/default.yml`, one `label:` line) and one snippet file
(`match/conflict.yml`, 304 bytes, three snippets, one leading comment and one interior comment).
Two variants:

- `cr` — the first snippet's label is `"carriage\rreturn"`, which decodes to a value holding a
  **real** carriage return. That is the only way `copyReferenceText`'s carriage-return refusal is
  reachable from a window: the field is refused for `carriageReturn`, its buffer legitimately holds
  the character, and the retained draft a conflict copies therefore holds one too. 305 bytes.
- `crlf` — the second writer's own appended line ends in CRLF, so the *version on disk* holds a
  carriage return and the raw editor must refuse to reload it.

**The owner's real espanso configuration was never opened.** `XDG_CONFIG_HOME` is the first
candidate `resolve_config_dir()` probes and `HOME` was overridden to an empty directory, so neither
candidate can reach it. Nothing in this file quotes anything but this run's own synthetic content and
this application's own strings.

### 1.3 The launches

Twenty-five, L08 through L32, continuing 3c-1's numbering. **All twenty-five reached their own
`--- end` and all twenty-five `probe.err` files were zero bytes.**

| # | Plan | Lang | Purpose | Result |
|---|---|---|---|---|
| L08 | `rawconflict:en:clipapi:copy` | en | the raw editor's first drive; the clipboard question | **conflict**; copy failed; §1.1(4) learned |
| L09 | `rawconflict:en:clipapi:copy:reload` | en | the raw editor's two-step reload | **conflict**; reload **installed**, draft reseeded |
| L10 | `rawconflict:es:clipapi:copy:twice` | es | the Spanish twin, and the **second** submission | **conflict**, then a **second conflict** |
| L11 | `rawconflict:es:clipapi:reload` | es | the Spanish reload, byte-checked in the box | **conflict**; box reseeded to 340 chars |
| L12 | `editorconflict:en:clipapi:copy` | en | the six-field panel and its copy | **conflict**; copy failed |
| L13 | `creatorconflict:en:copy:reload` | en | the creator's first drive | **conflict**; reload closed the form |
| L14 | `creatorconflict:es:copy:reload` | es | the Spanish twin | **conflict**; **finding 1** |
| L15 | `deleterconflict:en:reload` | en | the deleter's first drive | **failed launch** — the plan looked for a control that does not exist |
| L16 | `deleterconflict:en:reload` | en | the same, with the panel rolled | **failed launch**, and it taught §10.9 |
| L17 | `deleterconflict:en:reload` | en | the corrected launch | **conflict**; reload closed the panel |
| L18 | `deleterconflict:es:reload` | es | the Spanish twin | **conflict** |
| L19 | `editorconflict:en:reload` | en | the editor's confirmation line and label | **conflict**; reload closed the editor |
| L20 | `editorconflict:es:copy:reload` | es | the Spanish twin | **conflict**; panel entirely below the fold |
| L21 | `editorconflict:en:cr:copy` | en | a retained draft holding a **real** carriage return | **conflict**; the CR drawn **by name** |
| L22 | `moverconflict:en:after:reload` | en | the **anchored** destination arm | **conflict**; `anchoredDestination` |
| L23 | `moverconflict:es:after:reload` | es | the Spanish twin | **conflict**; `anchoredDestination` |
| L24 | `moverconflict:en:reload` | en | the **positional** destination arm | **conflict**; `positionalDestination` |
| L25 | `moverconflict:es:reload` | es | the Spanish twin | **conflict**; `positionalDestination` |
| L26 | `duplicatorconflict:en:reload` | en | the duplicator's reload | **conflict**; reload closed the panel |
| L27 | `duplicatorconflict:es:reload` | es | the Spanish twin | **conflict** |
| L28 | `editorconflict:en:twice` | en | the **second** submission on a match surface | **conflict**, then `identityStaleRevision` |
| L29 | `rawconflict:en:crlf:reload` | en | a disk version holding a carriage return | **conflict**; reload **refused and disabled** |
| L30 | `rawconflict:en:external:truncate:reload` | en | the empty-disk-version arm | **failed launch** — and it **wrote**; §9.2 |
| L31 | `rawconflict:en:external:truncate:reload` | en | the corrected launch | **conflict**; the `empty` arm drawn |
| L32 | `moverconflict:en:after` | en | is the marked destination still there afterwards | **conflict**; `pressed=true`, list disabled |

Balance: thirteen English, ten Spanish, and two of the three failed launches English. Every
user-facing sentence judged below was judged in both languages.

---

## 2. Item 1 — the clipboard on the three authored-text panels. **FAIL to settle, with four new facts**

3a §4 hole 6 asked: *is `navigator.clipboard.writeText` available or permitted in this shipped
WKWebView, or denied?* **This reading could not settle it, and the reason is worth more than the
answer would have been.**

### 2.1 What the platform said (L08, L09, L10, L11, L12)

```
clipboard API: navigator.clipboard=object writeText=function isSecureContext=true
               protocol=tauri: execCommand=function hasFocus=false
clipboard API: after window.focus() and a wait, hasFocus=false visibilityState=hidden
clipboard API: permissions.query(clipboard-write) threw TypeError: Type error
clipboard API: writeText REJECTED name=NotAllowedError
               message="The request is not allowed by the user agent or the platform in the
                        current context, possibly because the user denied permission."
clipboard API: bare execCommand('copy') over a selected carrier answered false
```

Four facts, none of them previously written down:

1. **The API is present and the context is secure.** `navigator.clipboard` is an object,
   `writeText` is a function, `isSecureContext` is `true` under the `tauri:` protocol. It is not
   absent, and it is not blocked for being an insecure context.
2. **It rejects with `NotAllowedError`** in the conditions these launches could produce.
3. **There is no way to ask.** `navigator.permissions.query({ name: 'clipboard-write' })` throws a
   `TypeError` — WebKit does not implement that descriptor — so a component cannot pre-flight the
   question either.
4. **Both routes fail together.** A bare `document.execCommand('copy')` over a carrier this probe
   selected itself, outside the application entirely, answered `false` in the same launch. So a
   `copyReferenceText` returning `false` here says nothing about *which* route failed and nothing
   about the carriage-return refusal.

### 2.2 Why it is not settled

`document.hasFocus()` was `false` and `document.visibilityState` was `hidden` in **every** launch,
and the window could not be brought to the front from this harness. Every route was tried:
`open`, `open -a`, `tell application id "cc.carpio.espansoConfig" to activate`, System Events
`set frontmost of process "espansoConfig" to true`, and System Events `AXRaise` of window 1 in a
retry loop started **before** the launch. The frontmost process stayed `Google Chrome`; System Events
reported `0` windows for the process. And a synthetic `HTMLElement.click()` carries **no user
activation** at all.

So the two conditions WebKit gates a clipboard write on — a focused document and a transient user
activation — were both absent, and neither can be supplied by this instrument. `2c-1b-notes.md`
§9.11.4 left the same question open for the same reason, and this reading narrows it rather than
closing it: it is now known that **the API exists, that it rejects here, and that the fallback
rejects here too**.

### 2.3 What was established anyway

**The disclosure is reachable in practice, not hypothetically.** Every launch that pressed
*Copy my text* drew the failure sentence, on all three panels that offer the control:

```
L12 editor  copy result: shared copied=false failed=true
L13 creator copy result: shared copied=false failed=true
L08 raw     copy result: raw copied=false failed=true
```

**The pasteboard is the second observation and it agrees**: in all twenty-five launches
`clipboard-after.bin` was byte-identical to the sentinel `launch.sh` had seeded, and no launch's
pasteboard held a carriage return. Nothing was ever copied, by either route, under any plan.

**The carriage-return draft was drawn, and the panel names the character** (L21, the `cr`
configuration). The label field's projected value is not printed — it is written out:

```
editor outcome [10] div: Label  left as the file has it  carriagecarriage return U+000Dreturn
editor sourceText [2] box=667,1332,472x26 chars=36 "carriagecarriage return U+000Dreturn"
```

That is `SourceText` replacing the character with its localized **name**, which is exactly what the
shared `draftCopyFailed` sentence claims — *"any character no font can draw is written there by name
instead of as itself, so selecting it by hand does not always give back exactly what you wrote"*.
The sentence was read against a screen that was doing what it says. **What could not be shown is
that the CR is what refused the copy**, because §2.1(4) makes every copy fail.

**Verdict: FAIL to settle hole 6; PASS on the disclosure, the display and the pasteboard.**

---

## 3. Item 2 — legibility. **PASS on the comparison, PASS on the six fields, one Medium on where it lands**

### 3.1 The two-column comparison beside a whole file's text

There is no two-column layout: the retained draft and the disk version are **stacked**, each under
its own `h3`, and the file's text is a single `SourceText` block. Measured on all six surfaces at
1180 × 728:

| Surface | Panel | Disk-text block | Whole file legible |
|---|---|---|---|
| raw editor | 491 × 578 at y = 369 (L09) | 472 × 231, `chars=301`, `scrollHeight=229` | yes, no inner scroll |
| match editor | 491 × 1044 at y = 720 (L19) | 472 × 231, `chars=301` | yes |
| creator | 491 × 806 at y = 591 (L13) | 472 × 231, `chars=301` | yes |
| deleter | 491 × 684 at y = 209 (L17) | 472 × 231, `chars=301` | yes |
| mover | 491 × 701 at y = 469 (L22) | 472 × 231, `chars=301` | yes |
| duplicator | 491 × 684 at y = 328 (L26) | 472 × 231, `chars=301` | yes |

The 301-character file renders whole in 231 px with `scrollHeight = 229` — it is **not** clipped and
does not scroll inside itself. The comparison reads top-to-bottom: three revision lines, *What you
wrote, kept here* (or *What you asked for, kept here*), the draft, *The version on disk*, the file.
**Nothing on any panel invites a comparison the application refuses to make** — the disk side is the
whole file and is never a projection of "the same snippet".

### 3.2 The match editor's six fields, three of them empty (3a §4 hole 1)

L12 and L19 (en), L20 (es). All six are drawn, in `EDITABLE_FIELDS` order:

```
editor outcome [8]  div box=667,1065,472x58 : Trigger  left as the file has it  :alpha
editor outcome [9]  div box=667,1129,472x93 : Replacement text  this text would be written  alpha onealpha twoprobe edit
editor outcome [10] div box=667,1227,472x58 : Label  left as the file has it  the first snippet
editor outcome [11] div box=667,1290,472x41 : Whole word  left as the file has it
editor outcome [12] div box=667,1337,472x41 : Boundary on the left  left as the file has it
editor outcome [13] div box=667,1384,472x41 : Boundary on the right  left as the file has it
editor sourceText [3] box=667,1323,472x9 chars=0
editor sourceText [4] box=667,1369,472x9 chars=0
editor sourceText [5] box=667,1416,472x9 chars=0
```

**The hole is closed by measurement rather than by opinion, and the answer is that it is fine.** Each
of the three carries a name and *left as the file has it* / *se deja tal y como lo tiene el archivo*,
and the empty 9 px box under it is unambiguous — the status line is what carries the meaning, and a
field the file does not hold reads as a field the file does not hold. The three cost 123 px of a
1 044 px panel, about 12 %. **No change is recommended.**

### 3.3 Where the panel lands. **Medium — §10.3**

Every panel's controls are below the fold before any scroll, and on the match editor the whole panel
is. See §10.3.

---

## 4. Item 3 — the operation summary as a summary. **PASS, both languages**

Three surfaces draw a retained *operation* rather than authored text. All three sentences begin with
what the person did, in the past, and none is an instruction.

| Surface | English (L17, L24, L22, L26) | Spanish (L18, L25, L23, L27) |
|---|---|---|
| deleter | *You asked to delete this snippet from this file.* | *Pediste borrar este fragmento de este archivo.* |
| mover, `end` | *You asked to move this snippet to the end of this file's snippet list.* | *Pediste mover este fragmento al final de la lista de fragmentos de este archivo.* |
| mover, `after` | *You asked to move this snippet after another snippet of this file's list, the one marked as chosen among the destinations above.* | *Pediste mover este fragmento detrás de otro fragmento de la lista de este archivo, el que aparece marcado como elegido entre los destinos de arriba.* |
| duplicator | *You asked to copy this snippet into the same file, immediately after itself.* | *Pediste copiar este fragmento en el mismo archivo, justo detrás de sí mismo.* |

**It reads as a description of what was asked for.** *You asked to…* / *Pediste…* is past and
first-person-addressed; there is no imperative anywhere in the block, and the only imperative on those
panels is inside a *control*'s own label. Beneath it, on every one of the three, comes
`operationIdentityIsOld` — *This panel names the snippet as this window read it before the file
changed…* — which is what stops the summary being read as a claim about the file as it is now.

**The `after` arm's cross-reference is true, and was checked** (L32). After the conflict the
destination list is still drawn above the panel, still carries the mark, and is disabled:

```
mover destination after the conflict box=658,297,84x27 disabled=true pressed=true "After :beta"
mover destination after the conflict box=658,267,144x27 disabled=true pressed=false "At the top of the list"
```

So *the one marked as chosen among the destinations above* points at something that exists and is
marked. That is `markedAmongTheDestinations`'s decision, taken in `matchMove.ts`, seen in a window.

---

## 5. Item 4 — the mover's two `reloadWarning` arms. **PASS, both arms, both languages**

Staged by choosing the destination rather than by canning anything: the `after` flag picks the first
option that is neither *At the top of the list* nor *At the bottom of the list*.

**`positionalDestination`** — L24 (`At the bottom of the list`), L25 (`Al final de la lista`):

> The destination you chose is not kept: it names a position in this file's snippet list as this
> window read it. Choose a destination again from the list afterwards.

> El destino que elegiste no se conserva: nombra una posición de la lista de fragmentos de este
> archivo tal y como la leyó esta ventana. Vuelve a elegir un destino desde la lista después.

**`anchoredDestination`** — L22 (`After :beta`), L23 (`Después de :beta`):

> The destination you chose is not kept: it names another snippet as this window read it, and this
> app will not look for that snippet in the version on disk. Choose a destination again from the
> list afterwards.

> El destino que elegiste no se conserva: nombra otro fragmento tal y como lo leyó esta ventana, y
> esta aplicación no lo va a buscar en la versión del disco. Vuelve a elegir un destino desde la
> lista después.

Both appear **only** at the confirmation step, both sit directly above the choices, and **neither
restates the shared close/abandon guarantee** drawn at the top of the same panel — which is what
2c-4a-3b's finding 3 asked a reading to check. The shared line above them is, in both cases:

> Loading the version on disk moves this window to it and closes this panel. What you asked for here
> is not carried out, and the file is not written either way.

The division of labour is visible on screen: the shared line says what becomes of the *operation and
the file*, the arm says what becomes of the *destination*. **The distinction between the two arms
survives translation** — *una posición* against *otro fragmento* is the same contrast as *a position*
against *another snippet*.

---

## 6. Item 5 — the five renamed confirmation lines, both languages. **PASS on all five**

Each was read at the confirmation step, on its own surface, against the shared warning above it.

| Surface | Confirmation line | Seen |
|---|---|---|
| match editor | *This app will not guess which snippet in the version on disk corresponds to the one you are editing. Open the snippet again from the list afterwards.* | L19 |
| | *Esta aplicación no va a adivinar qué fragmento de la versión del disco se corresponde con el que estás editando. Vuelve a abrir el fragmento desde la lista después.* | L20 |
| creator | *A file on disk holds no half-written snippet, so there is nothing there this form could be filled from. A form opened afterwards starts empty.* | L13 |
| | *En el disco no hay ningún fragmento a medio escribir, así que ahí no hay nada con lo que se pudiera rellenar este formulario. Un formulario que se abra después empieza vacío.* | L14 |
| deleter | *This app will not guess which snippet in the version on disk is the one you asked to delete. Open the snippet again from the list afterwards.* | L17 |
| | *Esta aplicación no va a adivinar qué fragmento de la versión del disco es el que pediste borrar. Vuelve a abrir el fragmento desde la lista después.* | L18 |
| mover | the two arms of §5 | L22–L25 |
| duplicator | *This app will not guess which snippet in the version on disk is the one you asked to copy. Open the snippet again from the list afterwards.* | L26 |
| | *Esta aplicación no va a adivinar qué fragmento de la versión del disco es el que pediste copiar. Vuelve a abrir el fragmento desde la lista después.* | L27 |

**The duplication 3b's finding 3 removed has not come back on any of the five.** On every panel the
shared line is drawn once, at the top, and the surface line says only what that surface alone can
say. Read in order on the duplicator (L26), the two are:

```
[3]  Loading the version on disk moves this window to it and closes this panel. What you asked for
     here is not carried out, and the file is not written either way.
[12] This app will not guess which snippet in the version on disk is the one you asked to copy.
     Open the snippet again from the list afterwards.
```

No overlap, no restatement. The same holds in Spanish on all five.

**The confirmation *label* is the surface's own, and the branch is visible.** `confirmReload` —
*Discard my text and load it* / *Descartar mi texto y cargarla* — on the three authored-text
surfaces; `confirmReloadClosing` — *Close this and load it* / *Cerrar esto y cargarla* — on the
three operation-choice ones. Every launch printed which of the two it found:

```
L09 raw editor  confirmation control label=confirmReload
L13 creator     confirmation control label=confirmReload
L19 editor      confirmation control label=confirmReload
L17 deleter     confirmation control label=confirmReloadClosing
L24 mover       confirmation control label=confirmReloadClosing
L26 duplicator  confirmation control label=confirmReloadClosing
```

---

## 7. Item 6 — the whole reload machine on each surface. **PASS on `installed`; two outcomes not reachable**

### 7.1 The two steps, on all six

*Load the version on disk* is drawn on every conflict panel; pressing it **replaces itself** with the
confirmation and adds the surface's own line. No panel ever drew both at once, which is what
`conflictChoicesFor` promises. The choice lists are `CONFLICT_CAPABILITIES` read off a screen:

```
L09 raw editor   [Keep editing] [Copy my text] [Load the version on disk]      3 controls
L12 editor       [Keep editing] [Copy my text] [Load the version on disk]      3 controls
L13 creator      [Keep editing] [Copy my text] [Load the version on disk]      3 controls
L17 deleter      [Keep editing]                [Load the version on disk]      2 controls
L24 mover        [Keep editing]                [Load the version on disk]      2 controls
L26 duplicator   [Keep editing]                [Load the version on disk]      2 controls
```

*Copy my text* is absent on exactly the three surfaces whose `draftKind` is `operationChoice`, which
is consult Q4 refusing a copy for a `MovePlacement` or a `MatchId` as a property of the drafted
value.

### 7.2 `adoptDiskVersion` answering `installed`, checked at the byte level

The two `reloadOutcome` kinds behaved differently and correctly.

**`reseedsDraft` (raw editor)** — the panel closes, the editor stays open, and the box is reseeded
with the disk version. L11, Spanish, after the confirmation:

```
raw editor after the confirmation: surface STILL OPEN
raw editor after the confirmation box [0] textarea chars=340
  value="# a synthetic snippet file for the conflict instrument\nmatches:\n  # the first snippet, …"
buttons: [Dejar de editar enabled] [Deshacer disabled] [Rehacer disabled] [Guardar este archivo disabled]
```

304 + 36 = **340**, the exact byte count of the file the second writer left. *Undo*, *Redo* and
*Save* are all disabled — a fresh draft with no history and nothing to save. That is the strongest
statement available that the window moved to the disk revision.

L31 is the same check with an empty file: `chars=0`, and the panel had said
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, which is the SHA-256 of the empty
string.

**`closesSurface` (the five match surfaces)** — the surface closes and the detail pane returns.
L17, after the confirmation:

```
deleter after the confirmation: surface CLOSED
deleter detail pane after the confirmation box=644,44,536x645
deleter detail sourceText [0] chars=73 "trigger: ":alpha" replace: | alpha one alpha two label: the first snippet"
```

Same on L13/L14 (creator), L19/L20 (editor), L22–L25 (mover), L26/L27 (duplicator).

### 7.3 The refused reload the window **can** produce

Not `adoptDiskVersion` refusing — see §7.4 — but the raw editor refusing the *text*. L29 made the
second writer end its line in CRLF, so the version on disk holds a carriage return:

```
raw editor outcome [8] div : … label: "carriage\rreturn" … # a second writer reached this file
raw editor outcome [9] p   : This file uses carriage returns in its line endings, and this editor
                             cannot give them back exactly as they are. Rather than rewrite every
                             line ending in the file without being asked, it will not open this
                             file for editing.
raw editor confirmation button box=848,658,160x23 disabled=true "Discard my text and load it"
```

**The disk text is still shown, *Keep editing* and *Copy my text* are still live, and only the
confirmation is disabled** — which is `loadDiskVersion`'s rule drawn correctly. Pressing the disabled
control did nothing and the surface stayed open. §10.5 is what is wrong with the sentence.

### 7.4 `alreadyThere` and `refused` were not produced, and cannot be

`adoptDiskVersion` answers `installed | alreadyThere | refused`, and every caller stops only on
`refused`. **Only `installed` is reachable from a window**, and this is a property of the screens
rather than of the launches: the spend is bound to the conflict's origin by document **and
projection generation**, so producing `refused` needs a projection replacement to land between
*Load the version on disk* and the confirmation. Nothing on a conflict panel can cause one — the
mover's, the deleter's and the duplicator's *Read this file again* recovery is drawn only for a
`sendFailure`, and the conflict arm is not one. `alreadyThere` needs the projection to have already
reached the conflict's revision, which the same absence rules out.

**Consequence: `browser.saveOutcome.reloadUnavailable` was never drawn on any surface**, in either
language, in any launch. It is the disclosure 3b drew for the first time, and it rests on model and
mounted evidence only. §11.3.

---

## 8. Item 7 — the panel below the fold. **Answered: reachable, but nothing takes you there**

`2c-4a-3c-1-instrument.md` §5.6 measured the editor's panel at y = 720 in a 728 px viewport and left
*can a person find it* to this step.

**It can be scrolled to.** `section.detail` is the scroller (`overflow-y: auto`, `clientHeight` 645);
every intermediate element — `section.matchEditor`, `section.rawEditor`, `main.panes`, `div.shell`,
`body`, `html` — is `overflow-y: visible`. Setting `.detail`'s `scrollTop` to its `scrollHeight`
brings every panel fully into view on every surface:

| Surface | Panel before | `.detail` scrollHeight | After scrolling | Last control |
|---|---|---|---|---|
| raw editor (L09) | y = 369, 578 px | 903 | y = 111, both edges in view | y = 658 ✓ |
| match editor (L19 en) | **y = 720**, 1044 px | 1720 | y = −355, bottom in view | y = 658 ✓ |
| match editor (L20 es) | **y = 771**, 1044 px | 1771 | y = −355 | y = 658 ✓ |
| creator (L13) | y = 591, 806 px | 1354 | y = −118 | y = 658 ✓ |
| deleter (L17) | y = 209, 684 px | 849 | y = 5 | y = 659 ✓ |
| mover (L22) | y = 469, 701 px | 1126 | y = −12 | y = 658 ✓ |
| duplicator (L26) | y = 328, 684 px | 968 | y = 5 | y = 659 ✓ |

**But nothing scrolls to it.** In every launch `.detail`'s `scrollTop` was `0` when the panel
appeared, and the probe had to move it. On the match editor that means a person who presses *Save
this snippet* sees **8 px** of a 1 044 px panel in English and **none of it** in Spanish
(`belowTheFold=true` at y = 771). §10.3.

The panel is `role="status"`, so its text is announced to a screen reader whatever the layout does.
**This is a visual failure and not an accessibility one**, and the two should not be confused when it
is fixed.

---

## 9. The bytes

Every launch compared the **whole configuration tree** against a pristine copy taken immediately
before it, and printed the target file's size on both sides and whether a backup directory existed.

**Twenty-one launches wrote nothing at all.** The only difference in each was the second writer's own
line — `304 → 340` bytes, `12a13 > # a second writer reached this file`; `305 → 341` for the `cr`
variant (L21) and `305 → 342` for `crlf` (L29) — and **no `.espansoconfig-backups` directory existed
in any of them**, which is the strongest available statement that the transaction never reached its
write.

### 9.1 The two launches with no second writer

L15 and L16 (`304 → 304`, no backups) reached `--- end` without provoking anything: the plan looked
for a *Delete this snippet* control that does not exist (§10.9), returned before the writer ran, and
the file was untouched on both sides.

### 9.2 The one launch that wrote — and why it is worth keeping

**L30 wrote the file and created a backup.** The launch script tested for the detached writer with
`[[ "$PLAN" == *":external" ]]`, which requires the plan to *end* with that word; the plan was
`rawconflict:en:external:truncate:reload`, so the second writer never started, the base was never
stale, and the raw save **committed**:

```
Only in …/L30/xdg/espanso: .espansoconfig-backups
12a13 > # a probe edit that was never written
before 304 bytes, after 342 bytes
raw editor outcome: not a conflict
raw editor outcome [0] p: The file was written. What is on disk now is exactly the text that was sent.
```

**This is the reading's own control and it is not an embarrassment.** Twenty-four launches say
*nothing was written*; the byte check is only evidence if it is capable of saying otherwise, and L30
is the launch where it did — on the same instrument, from the same script, with the same comparison.
It also confirms the ordinary committed path end to end on the raw editor, which nothing else here
did. The test is now `[[ ":$PLAN:" == *":external:"* ]]`, and L31 is the corrected launch.

L31's own bytes are the inverse shape: the external writer **truncated** the file, so
`before 304 bytes, after 0 bytes` and no backup — the conflicted save wrote nothing over a file that
another process had emptied.

### 9.3 The pasteboard

Seeded before every launch and read twice after: `clipboard-after.bin` was byte-identical to the
seed in **all twenty-five**, and `od -c` found no `\r` in any of them. Nothing this application drew
ever reached the system pasteboard, by either route (§2).

---

## 10. What the window showed that is wrong

### 10.1 **The Spanish creator conflict panel says the snippet has been written.** High

`browser.matchCreation.revisionExpected` in `es.json` is
*"Este fragmento **se ha escrito** sobre la versión {revision}."* — present perfect passive, which
reads as *this snippet has been written*. It is drawn as line [4] of a panel whose line [0] is
*"No se ha escrito nada. El archivo del disco sigue exactamente igual."* L14:

```
creator outcome [0] p: No se ha escrito nada. El archivo del disco sigue exactamente igual.
creator outcome [4] p: Este fragmento se ha escrito sobre la versión 50a2bbc3….
```

The English is *"This snippet was written against version {revision}"* — *written against* is
drafting, not writing to a file. The Spanish drops *against* and keeps *escrito*, and no other
surface does: the editor says *se cargó desde*, the deleter *se leyó de*, the mover *se decidió
sobre*, the duplicator *se decidió sobre*.

**Why it is High.** It is a false claim about whether the person's file was written, four lines under
the sentence that says it was not, on the one panel whose entire job is to make that unambiguous.
It is also the exact class `CLAUDE.md` §6 names — a claim the code does not support, kept green by
suites that check parity and placeholders and never meaning.

**For 3c-3**: the key is pre-existing (it shipped with 2c-3a-1) and is reachable **only** from a
conflict panel, which is why a reading is what found it. A wording in the family the siblings use —
*"Este fragmento se redactó sobre la versión {revision}."* — restores the sense; the English is
weaker but sound, and §10.6 records it as an observation rather than a second finding. Any fix must
also add whatever the i18n suites cannot: nothing today would fail if it were reverted.

### 10.2 **Three panels offer *Keep editing* where nothing is being edited.** Medium

`conflictChoiceKey` in `src/lib/browser/saveOutcome.ts` branches `confirmReload` on
`ConflictDraftKind` — that is 2c-4a-3b's finding 1, and it is why *Close this and load it* exists —
but `keepEditing` returns `browser.rawSave.choice.keepEditing` unconditionally. On the deleter, the
mover and the duplicator that draws *Keep editing* / *Seguir editando* beside a panel about a
deletion, a move or a copy:

```
L17 deleter    button box=667,863,83x23  "Keep editing"        (and "Load the version on disk")
L18 deleter    button box=667,863,101x23 "Seguir editando"
L24 mover      button                    "Keep editing"
L26 duplicator button                    "Keep editing"
L27 duplicator button box=667,698,101x23 "Seguir editando"
```

The function's own doc says the label *"reuses the raw editor's own label rather than adding a second
string that reads the same: it is the same offer, made about a different refusal."* That was written
before the operation-choice panels existed. It is now the same offer made about a different
*activity*, and it is a **narrower instance of the finding step 3b closed for the sentences on these
three exact surfaces** — precisely the *sweep for what the type now says, not for the words the old
finding used* failure `CLAUDE.md` §6 records.

**For 3c-3**: the branch already exists and is required, so this is one `draftKind ===
'authoredText' ? … : …` and one new key per language. Something like *Leave this as it is* /
*Dejarlo como está* is the shape; the naming is 3c-3's, not this reading's.

### 10.3 **The match editor's conflict panel is drawn entirely below the fold and nothing scrolls to it.** Medium

At 1180 × 728 the panel's top is at **y = 720** in English (L12, L19) and **y = 771** in Spanish
(L20), and it is **1 044 px tall**. `section.detail`'s `scrollTop` is `0` when it appears and no code
moves it. So a person who presses *Save this snippet* and hits a conflict sees eight pixels of a
panel in English and **nothing at all** in Spanish — no *Nothing was written*, no revisions, no
draft, no controls. The editor above is unchanged in size and position across the save
(`editor open box=658,95,491x580` and `editor after the save box=658,95,491x580`, L12), so there is
nothing in the visible region to mark that anything happened.

Every other surface puts at least its first sentences in view (raw 369, deleter 209, duplicator 328,
mover 469, creator 591), but **on all six the controls are below 728 before any scroll**:

```
L09 raw        outcome buttons at y = 916, viewport 728
L13 creator    outcome buttons at y = 1367
L19 editor     outcome buttons at y = 1733
L17 deleter    outcome buttons at y = 863
L22 mover      outcome buttons at y = 1139
L26 duplicator outcome buttons at y = 982
```

`2c-3c-3-window-reading.md` §10.2 recorded the same class as a **Low** for the committed panel; this
is a **Medium** because on one surface the panel is not merely below the fold but wholly invisible,
and because what is invisible is *the statement that nothing was written*. The panel is
`role="status"`, so a screen reader is told; a sighted person is not.

**For 3c-3**: scrolling the outcome panel into view when it appears is the obvious repair and it is
the panel's own concern, not the model's. Whatever is done must be done for six surfaces and
re-checked in Spanish, which is where the extra 51 px came from.

### 10.4 **The second step's control is pushed below the fold by the sentence that justifies it.** Low

Pressing *Load the version on disk* adds the surface's confirmation line and, on the longest panels,
that growth moves the confirmation control back out of the viewport — after the pane had already been
scrolled to its end:

```
L13 creator en  confirmation control box=848,771,160x23   viewport height 728
L14 creator es  confirmation control box=877,788,172x23
L20 editor es   confirmation control box=877,771,172x23
```

Everywhere else it lands at y = 698–715 and stays in view. Because the pane is scrolled to its end,
the content grows *downwards* past the fixed `scrollTop` and a second scroll is needed. It is
reachable, so it is a Low; it is listed separately from §10.3 because a fix for that one — scroll to
the panel once — does not necessarily fix this one.

### 10.5 **The raw editor's refused-reload sentence names the wrong door.** Low

L29. The confirmation is disabled and the only explanation beside it is
`browser.rawEditor.lineEndingsNotPreserved`, which ends *"…it will not open this file for editing"* —
shown on a panel where the editor **is** open, over a draft the person is holding, about an action
that is a **reload** and not an opening:

```
raw editor outcome [9] p: This file uses carriage returns in its line endings, and this editor
                          cannot give them back exactly as they are. Rather than rewrite every line
                          ending in the file without being asked, it will not open this file for
                          editing.
raw editor confirmation button "Discard my text and load it" disabled=true
```

The substance is right — this application will not hand back a text it cannot preserve — and the
policy sentence is the same policy. What is wrong is that the reason for a **disabled control** is
carried by a sentence about a **different control**, and a person reading it while looking at the
open editor has to work out which of the two it means.

**For 3c-3**: `view.diskRefusal` is a separate field from the editor's own opening refusal
(`RawEditor.svelte` draws it as `marker warn`), so a reload-specific arm can be given a
reload-specific sentence without touching the opening one.

### 10.6 **The English creator line is weaker than its siblings.** Observation

*"This snippet was written against version {revision}."* is correct — *written against* is drafting —
but it is the only one of the six that uses the verb *written* at all on a panel that opens with
*Nothing was written*. The other five are *loaded from*, *read from*, *decided against*, *decided
against*, *loaded from*. It is not a defect; it is the reason §10.1 was easy to mistranslate, and a
fix that only touches Spanish leaves the trap in place.

### 10.7 **The raw editor promises a hand copy and the other two do not — and that is correct.** Observation

`browser.rawEditor.draftCopyFailed` says *"It is still in the box above, so it can be selected and
copied by hand"* (L08, L09; Spanish L10: *"Sigue en el cuadro de arriba, así que puedes seleccionarlo
y copiarlo a mano."*), while the shared `browser.saveOutcome.draftCopyFailed` on the editor and the
creator explicitly promises **no** hand copy.

This looks exactly like the defect `CLAUDE.md` §6 records and **is not one**. The raw editor's draft
lives in a real `<textarea>` on screen, and `rawEditorRefusal` guarantees that a text this editor
opened holds no carriage return — so selecting it by hand does give back exactly the draft. The other
two draw their drafts through `SourceText`, where an undrawable character is replaced by its name.
Recorded so that a later sweep does not "fix" a true sentence into a false one.

### 10.8 **`Keep editing` after a match conflict restores the editor with the draft intact.** Observation

L28, after pressing it: the editor's fields are back, every *Take this key out* control is live, the
*Unsaved changes* marker is still on the head, and *Undo* is enabled while *Redo* is not. Nothing was
cleared and nothing was reloaded, which is what the panel had promised three lines above.

### 10.9 **The deletion panel opens already asking.** Observation

There is no *Delete this snippet* press: `view.confirming` is true from the first frame, so the
detail pane's *Delete this snippet…* opener **is** the request and the panel opens at its question.
L15 and L16 are the two launches that cost. Consult Q7 point 4 says *"open deletion and reach its
confirmation prompt"*, which reads as two steps and is one. Not a defect — it is one press instead of
two for a destructive action that is still confirmed — but the recipe should say so.

---

## 11. What this evidence is, and what it is not

**Is:** what WebKit laid out and rendered in the real application's webview — every rectangle above is
an element's own — over a real projection of a real file, with a real
`SaveResult::Conflict` returned by the real command layer after a real second writer changed the file
on disk; plus a whole-tree byte comparison on both sides of every launch and a pasteboard read on
both sides of every launch.

**Is not:**

1. **Pixels, pointer hit-testing, real keystrokes, or a real user gesture.** Unchanged since
   `1c-1-notes.md` §10.3. Every control was reached with `HTMLElement.click()`, every scroll was an
   assignment to `scrollTop`, and every text box was driven by assigning `.value` and dispatching an
   `input` event. **The absence of user activation is what bounds §2**, and it bounds nothing else
   here.
2. **A focused or visible window.** `document.hasFocus()` was `false` and `document.visibilityState`
   was `hidden` in every launch, and §2.2 lists the five ways that were tried to change it. Any claim
   that depends on focus — the clipboard, above all — is a claim about *this* condition.
3. **`adoptDiskVersion`'s `alreadyThere` and `refused` outcomes, and therefore
   `browser.saveOutcome.reloadUnavailable` on any surface.** Not a gap in the plans: §7.4 shows no
   control on a conflict panel can move a projection generation, so the arms are unreachable from a
   window at all. They keep model-suite and mounted evidence only, in both languages.
4. **The disk-text `unavailable` arm.** Two of the three were drawn — `text` on twenty-three launches
   and `empty` on L31 (*This file holds no characters at all.*) — but a **failure to obtain** the
   disk text was never staged, so `conflictDiskText`'s third arm and the sentence beside it were not
   seen.
5. **`moveAfterSnippetNoLongerShown`.** The `after` summary's other half — the destination that is no
   longer offered — needs the option list to change under a live conflict, which nothing on the panel
   can do.
6. **`findingsAreStale`, the `notes` lists, and the in-flight *saving* / *deleting* / *moving*
   markers.** None appeared on any transcript; the first two are unreachable for a refused save that
   never ran its validation, and the third is transient and was never sampled mid-send.
7. **The second-submission sentences were each read in one language only.** The raw editor's second
   **conflict** was read in Spanish (L10) and the match editor's `identityStaleRevision` in English
   (L28). Both are §12's row 8; neither was read in the other language.
8. **One projection shape throughout.** One profile, one snippet file, one snippet list, three
   snippets. Nothing here says what a conflict panel does over a file with two snippet lists, over a
   file the window could not parse, or over a read-only file.
9. **Only `save_match`, `create_match`, `delete_match`, `move_match`, `duplicate_match` and
   `save_raw_document` were exercised on their conflict arm.** No committed save was read here except
   L30's accident (§9.2), and no refusal-with-findings path was on any transcript.
10. **The real configuration.** Never opened, deliberately (§1.2). Everything above is synthetic.

---

## 12. Verdict

| Item | Verdict |
|---|---|
| 1 — the clipboard on the three authored-text panels | **FAIL to settle 3a §4 hole 6** (§2). The API **exists**, the context is **secure**, it rejects `NotAllowedError`, `permissions.query` is unimplemented, and the `execCommand` fallback fails under the same conditions — but `document.hasFocus()` was false and a synthetic click has no user activation, and neither could be changed. **PASS** on the disclosure (drawn on all three, both languages), on the display of a real carriage return **by name** (L21), and on the pasteboard (untouched in all 25) |
| 2 — legibility | **PASS** (§3). The 301-character file renders whole in 231 px with no inner scroll beside every draft, on all six surfaces; the comparison reads top-to-bottom and never invites an identification the app refuses. **3a §4 hole 1 is closed by measurement**: the three usually-empty fields are labelled, carry *left as the file has it*, cost 12 % of the panel and are not confusing. §10.3 is where it lands, not how it reads |
| 3 — the operation summary as a summary | **PASS, both languages** (§4). *You asked to…* / *Pediste…* on all three surfaces, past tense, no imperative, `operationIdentityIsOld` under it; and the `after` arm's cross-reference to *the one marked as chosen* is **true on screen** (L32: `pressed=true`, list disabled) |
| 4 — the mover's two `reloadWarning` arms | **PASS, both arms, both languages** (§5). `positionalDestination` L24/L25, `anchoredDestination` L22/L23; both only at the confirmation step, both above the choices, **neither restating the shared guarantee** |
| 5 — the five renamed confirmation lines | **PASS on all five, both languages** (§6). No duplication of the shared warning on any of them; the `confirmReload` / `confirmReloadClosing` branch is visible in the label on all six surfaces |
| 6 — the whole reload machine | **PASS on the two steps and on `installed`** (§7). Six surfaces, both languages; `reseedsDraft` reseeds to the exact disk byte count (340, and 0 on the truncated file), `closesSurface` closes; the capability lists are 3/3/3/2/2/2 exactly as declared. **`alreadyThere`, `refused` and `reloadUnavailable` were not produced and are unreachable from a window** (§7.4, §11.3). The one refused reload a window *can* produce — a disk text holding a carriage return — draws its reason and disables only the confirmation (L29) |
| 7 — the panel below the fold | **Answered** (§8). Reachable: `section.detail` scrolls, and every panel comes fully into view. **Not reached automatically**: `scrollTop` is 0 when the panel appears, so the match editor shows 8 px of it in English and none in Spanish. §10.3 |
| 8 — the inherited rule, checked rather than assumed | **PASS** (L28, L10). A dismissed **match** conflict's second submission is refused by `view_at`: *"The save could not be sent, so nothing was written… This file has changed since that snippet was selected, so the selection has to be resolved again."* — `identityStaleRevision`, **not** a second conflict. A dismissed **raw** conflict's second submission is a **second conflict**, with the same three revisions. Write-safe both ways, and they are different sentences |
| 9 — the bytes | **PASS** (§9). 21 of 25 launches changed nothing but the second writer's own line, with **no backup directory created at all**; 2 changed nothing whatever; 1 truncated by the external writer with the conflicted save writing nothing; and **1 wrote** — the harness defect of §9.2, which is also this reading's proof that the byte check can say *yes* |

**One High, two Mediums, two Lows and four Observations.** §10.1 (the Spanish creator line claiming
the snippet has been written, **High**), §10.2 (*Keep editing* on the three operation-choice panels,
**Medium**), §10.3 (the match editor's panel wholly below the fold with nothing scrolling to it,
**Medium**), §10.4 (the confirmation control pushed out by its own sentence, **Low**), §10.5 (the raw
editor's refused-reload sentence naming the wrong door, **Low**), §10.6 (the English creator line's
verb, observation), §10.7 (the raw editor's hand-copy promise, correct, observation), §10.8
(*Keep editing* restores the draft, observation), §10.9 (the deletion panel opens already asking,
observation).

**No defect was found in what is written to disk.** Every conflicted save wrote nothing, on all six
surfaces, in both languages, checked whole-tree against a pristine copy — and the one launch that did
write is the one whose second writer never ran.

**Step 3c-2 is complete. Step 3c-3 owes the fixes for §10.1–§10.5 and a re-take of this reading over
every component it changes.**

---

## 13. The gates, with the harness still in the tree

```
npm test                 46 files, 1427 tests, all passing
npm run check            413 files, 0 errors, 0 warnings
npm run build            173 modules   (172 + src/probe.ts)
cargo build --workspace  ok
```

All four are `2c-4a-3c-1-instrument.md` §6's numbers, unmoved: this step grew `src/probe.ts` and
`<scratch>/launch.sh` and changed **no production file**. The probe, its two Rust commands and the
four hook lines are still uncommitted and are 3c-3's to remove.
