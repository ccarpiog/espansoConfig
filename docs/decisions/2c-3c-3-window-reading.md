# Phase 2c-3c step 3 — the window reading

The third of the three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires of every 2c
sub-phase, taken over `src/lib/components/MatchDuplicator.svelte` and the `DetailPane.svelte` wiring
that draws it. The model tests and the mounted cases are 2c-3c-3's own; this file is the record of
**what a screen actually did**. It answers the seven things
`docs/reviews/phase-2c-3c-3-code.md` left to a manual reading — the round-1 closing bullet and the
round-2 closing paragraph name five of them by hand — and it is the last deliverable 2c-3c owes.

**Duplicate is unlike its siblings in one way that shapes the whole reading: refuse-then-acknowledge
is its ordinary path, not its exceptional one.** The transaction interrupts the first attempt with
`DuplicateKeepsTriggerDefinition` whenever the source has a modelled trigger form, so the consent
round trip is on the happy path and had to be read on a screen in both languages. It was, twice
each, end to end, with the bytes checked on both sides.

**Nothing here was inferred from the test suite.** Every line quoted below came out of a running
WKWebView, and every claim about a file's bytes was checked with a whole-tree comparison against a
pristine copy taken before the launch plus an anchored byte-for-byte reconstruction — never by
reading the panel the application drew about itself. **Eleven launches are the stated exception to
"the pipeline was driven"**: their arms cannot be produced by any end-to-end run, so they were drawn
by the **real component in the real webview** over a canned answer, `2c-3b-2-window-reading.md`
§4.3's precedent. Every number from one of those launches says it is canned, in the same sentence.

---

## 1. The setup

The technique is `docs/decisions/1c-1-notes.md` §10 with the constraint of
`docs/decisions/1c-2b-2b-2-notes.md` §6.1 unchanged.

```sh
npm run build
cargo build -p espansoconfig --features custom-protocol
# binary into a hand-assembled espansoConfig.app (Contents/MacOS + Info.plist), ad-hoc signed
open --env "ECFG_PROBE_PLAN=<plan>" \
     --env "XDG_CONFIG_HOME=<scratch>/<launch>/xdg" \
     --env "HOME=<scratch>/<launch>/home" \
     --stdout <scratch>/<launch>/probe.log --stderr <scratch>/<launch>/probe.err \
     <scratch>/<launch>/espansoConfig.app
```

**One plan per launch, into a fresh bundle path, over a freshly rebuilt configuration.**
**Twenty-four launches**, each with its own `espansoConfig.app`, its own `XDG_CONFIG_HOME` and its
own `HOME`. A temporary `src/probe.ts` drove one plan 700 ms after mount; a temporary `probe_plan`
command read `ECFG_PROBE_PLAN` and a temporary `render_probe` printed the transcript to stdout.
**All twenty-four reached their own `--- end` and all twenty-four `probe.err` files were zero
bytes**, so no transcript below is a partial run rounded up to a conclusion.

**Every plan set the language explicitly through the application's own picker**, with a bubbling
`change` event, as its first step — `2c-2-2-window-reading.md` §1.2's lesson applied rather than
re-learned. Each transcript's own `language set through the picker: <tag>` line, which also prints
the resulting `documentElement.lang`, is the evidence; **no launch was lost to a leaked
`localStorage` override.** Thirteen launches ran in Spanish and eleven in English.

The probe reached the screen the way a person does — `HTMLElement.click()` on a real control — and
reported each element's own `getBoundingClientRect()`, so a control in the DOM at zero size is not
reported as a control that was drawn. Where a plan needed a **second writer**, it called the raw-save
IPC command directly (`saveRawDocument` in `src/lib/ipc/commands.ts`), never the window's own state:
the write reaches the disk through the real command layer while the window's projections stay
unaware, which is exactly what an external program does to this application.

**What a canned launch cans, and what it does not.** The first attempt to intercept the wire failed
(§1.1, L05 and L05b): in this WKWebView `window.__TAURI_INTERNALS__` is a **non-configurable
property whose `invoke` is read-only**, so neither the property nor the object can be replaced, and
a canned *wire answer* is not reachable at all. The canned launches therefore mount the real
`MatchDuplicator` — over a **real projection read through the real `get_document`**, in a container
whose geometry and box properties are copied from the real detail pane — and can only the panel's
`duplicate` and `unsavedDraftInDocument` props. The real reducer ran, the real dictionary rendered,
real WebKit laid it out. **Five of those eleven still wrote the file for real** — L07, L08, L09, L10
and L17 — by calling the real `duplicate_match` inside the canned prop and inventing only the half
the arm needs.

### 1.1 The launches, including the two whose instrument was wrong

| # | Plan | Lang | What it was for |
|---|---|---|---|
| L01 | `ordinary:es` | es | item 1 — the whole ordinary path, Spanish |
| L02 | `ordinary:en` | en | item 1 — the English twin |
| L03 | `outofdate:es` | es | item 4 — `outOfDate`, driven end to end |
| L04 | `outofdate:en` | en | the English twin |
| L05 | `mayhavewritten:es` | es | **the instrument was wrong, not the product.** It tried to can the wire by assigning `window.__TAURI_INTERNALS__.invoke`; WebKit answered *"Attempted to assign to readonly property"*. The launch itself succeeded and reached `--- end`; its transcript is what taught the correction |
| L05b | `mayhavewritten:es` | es | **the second wrong instrument**: `Object.defineProperty` on the same property, then on `window.__TAURI_INTERNALS__` itself — *"Attempting to change configurable attribute of unconfigurable property"*. This is what settled the canned route as a mounted component |
| L05c | `mayhavewritten:es` | es | item 4 — `mayHaveWritten`, **canned**, Spanish |
| L06 | `mayhavewritten:en` | en | the English twin, **canned** |
| L07 | `notidentified:es` | es | items 4 and 6 — `landed === null`, **real write, canned `moved`**, Spanish |
| L08 | `notidentified:en` | en | the English twin |
| L09 | `adoptionfailed:es` | es | item 5 — **real write, canned adoption failure**, Spanish |
| L10 | `adoptionfailed:en` | en | the English twin |
| L11 | `openeditor:es` | es | item 3 — the long Spanish `unsavedDraftInDocument` paragraph, **canned** |
| L12 | `openeditor:en` | en | the English twin, **canned** |
| L13 | `leaveandreturn:en` | en | item 7 — a real leave-and-return **during** the send, English |
| L14 | `leaveandreturn:es` | es | the Spanish twin |
| L15 | `keptafter:en` | en | item 7 — the same, with the parked selection outside the shifted range |
| L16 | `keptafter:es` | es | the Spanish twin |
| L17 | `sticky:es` | es | item 2 — the action row in a mounted panel whose pane is **shortened on purpose** to 260 px; **real write, canned adoption status** |
| L18 | `stickyreal:en` | en | item 2 — the real pane at the target size. **Superseded by L18b**: the probe's own scroll report left the pane at `scrollTop=414`, so the post-commit snapshot measured where the instrument had put the pane rather than where the application left it |
| L18b | `stickyreal:en` | en | the corrected instrument: the scroll report restores `scrollTop` |
| L19 | `stickyreal:es` | es | the Spanish twin of L18b |
| L20 | `precedence:en` | en | §9 — a refused eligibility beside a live `outOfDate`, **canned** |
| L21 | `precedence:es` | es | the Spanish twin, **canned** |

### 1.2 The configuration

**Synthetic, hand-written for this run, in a scratch directory outside the repository**, and rebuilt
from scratch before every launch — this screen writes files, and a reading must not stand on the
previous launch's bytes. **The owner's real configuration was never opened**, and nothing below
quotes anything but this run's own synthetic content and this application's own strings.

| File | What it is for |
|---|---|
| `config/default.yml` | a profile, so the sidebar has one |
| `match/dup.yml` | `:one` `:two` `:three`. `:one` carries a **two-line comment block**, a `\|` block scalar and a `label`, so "the clone is the item's exact owned runs, byte-identical" is a claim with something to be exact about |
| `match/other.yml` | `:other`, a second file, so the "All" scope holds a snippet a duplicate must not touch |
| `match/tall.yml` | `:tall`, whose `label` is 2 859 characters — long enough to push the panel past the height of the detail pane at the shipped window size, which is what item 2 needs. **Added to the recipe for L18 onwards**; every earlier launch's own pristine copy is the three-file tree, which is what `<launch>/xdg-before` records per launch |

`XDG_CONFIG_HOME` and `HOME` both point into that tree, and a pristine copy (`<launch>/xdg-before`)
was taken before every launch — that is what §11's byte checks compare against.

---

## 2. Item 1 — the ordinary path end to end, both languages. **PASS**

L01 (Spanish) and L02 (English), through the real pipeline: `:one` selected in `match/dup.yml`,
*Duplicate this snippet…* clicked, the panel opened, the duplicate sent, the
`DuplicateKeepsTriggerDefinition` refusal drawn, *Save anyway* clicked, the commit reported.

```
L02, English. viewport 1180x728
detail  box=644,44,536x645 scrollH=645 clientH=645 scrollTop=0
opener  box=658,275,167x27 "Duplicate this snippet…"

opened    duplicator box=658,95,508x189 scrollH=189 clientH=189
opened    actions box=658,250,508x34 position=sticky bottom=0px insideViewport=true
opened    duplicate control box=658,254,156x27 disabled=false insideViewport=true
opened    p[0] box=658,209,508x34: The copy is written immediately after this snippet, in the same
          list, exactly as the file writes it. There is no place to choose.
opened    buttons: [Leave this alone] [Duplicate this snippet]

refused   duplicator box=658,95,508x341
refused   p[2] box=667,299,489x17: Nothing was written. The file on disk is exactly as it was.
refused   p[3] box=667,321,489x17: The result contains something that looks wrong. Saving it needs
          your confirmation first.
refused   p[4] box=667,343,489x17: What the check found:
refused   p[5] box=685,366,471x34: The duplicate keeps the same trigger definition as its source,
          and espansoConfig cannot determine how espanso chooses between overlapping definitions.
refused   buttons: [Leave this alone] [Duplicate this snippet] [Save anyway] [Keep editing]

committed duplicator box=658,95,508x407
committed actions box=658,250,508x71 position=sticky bottom=0px insideViewport=true
committed duplicate control box=658,254,156x27 disabled=true insideViewport=true
committed p[2] box=658,284,508x34: This snippet has been copied. Reading the file again is what
          tells this app where everything now is, so pick the snippet in the list to duplicate it
          again.
committed p[3] box=667,336,489x17: The file was written. What is on disk now is exactly the text
          that was sent.
committed p[4] box=667,359,489x51: A copy of this file as it was before this session's first change
          to it was kept. …
committed p[5] box=667,415,489x51: This snippet has been copied. Nothing more can be duplicated from
          here: the write gave every snippet in this file a new identity, so close this and pick a
          snippet in the list to duplicate it.
committed buttons: [Leave this alone] [Duplicate this snippet DISABLED] [Done]
notice ABSENT
list[0] current=null ":one"
list[1] current=true ":one"
list[2] current=null ":two"
list[3] current=null ":three"
list[4] current=null ":other"
```

**The three states of the ordinary path all fit the pane, whole, at the target size**: 189 px, then
341 px, then 407 px, in a 645 px pane that never scrolls (`scrollHeight` 645 against 645). The
Spanish twin (L01) is 189 → 375 → 424 px — the same three states, 34 px and 17 px taller at the two
that carry a wrapped sentence, still 221 px inside the pane. Every paragraph and every control is
`insideViewport=true` at every step of both launches.

**The refusal is the ordinary second step and it reads as one.** The panel says *nothing was
written*, says the verdict, then names the finding, and the roll of controls grows by exactly the
two the acknowledgement offers. The finding's sentence claims risk and not semantics — *"espansoConfig
cannot determine how espanso chooses between overlapping definitions"* — which is D2u seen from a
window.

**The commit lands where the design says and the selection follows it.** `list[1]` is a second
`:one` immediately after the first, `aria-current` is on it and on nothing else, and **no notice was
raised** for the person who asked for the copy. The bytes: §11 — the clone is byte-identical to the
171 bytes immediately preceding it, comment block included, and every other byte of the file is
unchanged.

---

## 3. Item 2 — the sticky action row at the target size. **PASS, with one recorded observation**

The target size is the shipped window, 1180 × 760, giving a 1180 × 728 viewport and a 536 × 645
detail pane — the same numbers `2c-3b-2-window-reading.md` §2 measured.

**At that size, no state this reading reached overflows the pane.** The tallest is L07's Spanish
committed-plus-`duplicatedNotIdentified` panel at **481 px in 645 px**, and the tallest ordinary one
is L01's 424 px. In every one of those launches `detail scrollH == clientH == 645`: the pane does not
scroll, the sticky row is at its natural place, and the primary control and its sentence are on
screen without any scrolling at all.

**So the row's own claim — that it stays on screen when the panel grows past the pane — was measured
where it can be**, over `:tall`, whose 2 859-character label makes the panel 580 px of box over
1 008 px of content inside the same 645 px pane. L18b, English, the real pane and the real ordinary
path, nothing canned:

```
tall opened   detail box=644,44,536x645 scrollH=1059 clientH=645 scrollTop=0
tall opened   duplicator box=658,95,491x580 scrollH=1008 clientH=580
tall opened   actions box=658,641,491x34 position=sticky bottom=0px insideViewport=true
tall opened   duplicate control box=658,645,156x27 disabled=false insideViewport=true
tall opened   p[0] box=658,1028,491x34 insideViewport=false: The copy is written immediately after…
tall opened   at scrollTop=0   actions box=658,641 control box=658,645 insideHost=true
tall opened   at scrollTop=414 actions box=658,641 control box=658,645 insideHost=true

tall committed detail box=644,44,536x645 scrollH=1277 clientH=645 scrollTop=0
tall committed actions box=658,604,491x71 insideViewport=true
tall committed duplicate control box=658,607,156x27 disabled=true insideViewport=true
tall committed p[2] box=658,637,491x34 insideViewport=true: This snippet has been copied. Reading
               the file again is what tells this app where everything now is, …
tall committed p[3] box=667,1155,472x17 insideViewport=false: The file was written. …
tall committed at scrollTop=0   actions box=658,604 control box=658,607 insideHost=true
tall committed at scrollTop=632 actions box=658,437 control box=658,441 insideHost=true
```

**The row does what it claims.** With 1 277 px of content in a 645 px pane the action row is pinned
at y = 604–675, fully inside the pane, at `scrollTop = 0` and at `scrollTop = 414`, and the control
is at y = 607 with the sentence that says why it is disabled **inside the same row** at y = 637.
That is the one thing the CSS comment promises — a control never left pinned with its reason above
the fold — and it holds: the reason travels with the control while the rest of the panel scrolls
underneath. L19, the Spanish twin, is the same shape at 1 378 px of content: row at 604, control at
607, sentence at 637, all `insideViewport=true`.

**The panel is usable at that height.** Nothing is stranded: *Leave this alone* is at the top of the
panel and visible at `scrollTop = 0`, the pinned row holds the primary control, and scrolling reaches
everything else. What a reader does notice is §10.2.

**And the one place the row stops being pinned is measured too**, in a mounted panel whose pane was
shortened on purpose to 260 px (L17 — **an instrument, not the shipped window**): at `scrollTop = 0` the row is at
y = 213–284, `insideHost=true`; at the end of the scroll (`scrollTop = 178`) it has returned to its
natural place at y = 35, nine pixels above the pane's top edge, `insideHost=false`. That is
`position: sticky` behaving as defined — an element cannot stay pinned once the content *below* it
is taller than the scrollport — and at that moment the control it carries is disabled and *Done* is
the visible control. Recorded as §10.3, not judged a defect.

---

## 4. Item 3 — the long Spanish `unsavedDraftInDocument` paragraph. **PASS, and it reads naturally**

The route to this arm is **canned and has no other**: `DetailPane`'s six write surfaces are mutually
exclusive through `busy`, so a file with an open match editor is never offered a duplicate at all.
L11 and L12 mount the real panel over the real projection with `unsavedDraftInDocument` answering
`true`.

```
L11, Spanish, canned prop. duplicator box=658,58,508x318 scrollH=318 clientH=318 in a 645 px pane
blocked box=658,172,508x101 insideViewport=true: Un fragmento de este archivo está abierto en el
        editor, y esta aplicación no puede saber si se ha modificado. Duplicar escribe el archivo y
        le da una identidad nueva a cada fragmento, así que lo que no se haya guardado se quedaría
        sin ningún sitio donde guardarse: cierra antes el editor, guardando o descartando lo que
        tenga. Así funciona esta aplicación, no es algo que rechace el archivo.
actions box=658,321,508x54 position=sticky bottom=0px insideViewport=true
duplicate control box=658,325,172x27 disabled=true insideViewport=true
p[3] box=658,355,508x17: Este fragmento no se puede duplicar, y el motivo aparece a su lado.
buttons: [Dejarlo como está] [Duplicar este fragmento DISABLED]
```

```
L12, English, canned prop. duplicator box=658,58,508x300
blocked box=658,172,508x84 insideViewport=true: A snippet in this file is open in the editor, and
        this app cannot tell whether it has been edited. …
actions box=658,304,508x54 duplicate control box=658,308,156x27 disabled=true
```

**391 Spanish characters wrap to six lines and 101 px; 360 English characters wrap to five and
84 px.** Both are drawn whole inside a bordered block at the pane's full 508 px width, both are
`insideViewport=true`, and the panel they sit in is 318 px (Spanish) and 300 px (English) in a
645 px pane — **the length breaks nothing**: the pane does not scroll, the sticky row stays at its
natural place with the disabled control and the `notDuplicable` pointer sentence one line below it,
and no control leaves the panel's width.

**It reads as a conditional open-editor warning, and not as an assertion that unsaved edits exist.**
The Spanish opens with the fact — *"Un fragmento de este archivo está abierto en el editor"* —
immediately disclaims the knowledge — *"y esta aplicación no puede saber si se ha modificado"* — and
carries the conditional through the consequence with a subjunctive, *"lo que no se haya guardado se
quedaría sin ningún sitio donde guardarse"*. Nowhere does it say there **are** unsaved changes. It
then names the instruction (*"cierra antes el editor, guardando o descartando lo que tenga"*) and
closes by placing the rule where it belongs (*"Así funciona esta aplicación, no es algo que rechace
el archivo"*). **Judged natural Spanish**: no calque, no English word order, the colon carrying the
consequence the way a Spanish sentence of this length wants it. It is long, and it is long because it
makes four separate statements; nothing in it is padding.

---

## 5. Item 4 — `mayHaveWritten`, `outOfDate` and `duplicatedNotIdentified`, drawn, both languages. **PASS**

### 5.1 `outOfDate`, driven end to end (L03 Spanish, L04 English)

The honest route, driven: the panel open over `:one`, a **second writer** appends one comment line to
`match/dup.yml` through the raw-save IPC command (`outcome=saved committed=true`, the window's
projections untouched), the duplicate is sent, and the command rejects it at its identity gate.

```
L04, English.
failed p[2] box=667,299,489x17: This duplicate could not be sent, so nothing was written. The file
       holds what it held.
failed p[3] box=667,321,489x17: What this app was told:
failed p[4] box=667,343,489x34: This file has changed since that snippet was selected, so the
       selection has to be resolved again.
failed buttons: [Leave this alone] [Duplicate this snippet] [Read this file again]

reread duplicator box=658,166,508x356
reread duplicate control box=658,325,156x27 disabled=true
reread p[2] box=658,355,508x34 insideViewport=true: This panel comes from a reading of this file
       that this window can no longer stand behind. This duplicate wrote nothing. Close this and
       pick the snippet in the list to duplicate it.
notice box=658,58,508x61: This file changed on disk, and the snippet you had selected was found
       again. Dismiss
```

Two lines in English (508 × 34), three in Spanish (508 × 51, L03), inside the viewport both times,
beside a disabled control. **"This duplicate wrote nothing" is true on this screen** — §11 shows the
file holds exactly the before text plus the probe's own 27-byte comment line — and the `kept` notice
above it is *accurate here*, because the file really was changed by another writer, which is the
attribution guard `2c-3b-2-window-reading.md` §13.4 measured for a move working for a duplicate.

### 5.2 `mayHaveWritten` — canned (L05c Spanish, L06 English)

`may_have_written` is `true` only for a `saveFailed` raised at or after the rename, which no probe
can provoke, so **both of these launches are canned** and neither sent or wrote anything (§11).

```
L06, English, canned failure.
refused p[2] box=658,247,508x51 insideViewport=true: A duplicate was sent and this app cannot tell
        whether the file was written. So this panel can no longer establish what the file holds:
        look at the file, then close this and pick the snippet in the list to duplicate what the
        file now writes.
refused p[3] box=667,316,489x34: The save did not finish, and this app cannot tell whether the file
        was written. The copy may already be in the file, or may not. Look at the file before
        duplicating this again.
refused p[4] box=667,356,489x17: What this app was told:
refused p[5] box=667,378,489x17: espansoConfig could not carry this save through. …
refused p[6] box=667,400,489x17: The file could not be replaced. Reload it to see what it holds now.
refused buttons: [Leave this alone] [Duplicate this snippet DISABLED]
```

**The standing rule holds on this screen, and it holds by position.** The uncertain claim is drawn
**above** everything else: `cannotDuplicate.mayHaveWritten` sits in the sticky action row at y = 247,
the send-failure sentence at 316, its reasons below that — and **no definite sentence appears at
all**. The Spanish twin (L05c) is 508 × 51 and 489 × 51 and reads the same. **No recovery control is
offered**, which is the "no re-read for a send this application cannot account for" rule seen from a
window: the roll holds *Leave this alone* and the disabled control and nothing else.

**What no launch could produce is the pair.** A session that is both `duplicated` and
`mayHaveWritten` is unreachable — a spent session cannot send again, so `beginDuplicate` refuses
before a second failure can be recorded — so *"`mayHaveWritten` outranks `alreadyDuplicated`"* is
still model-suite evidence only. What a window shows is the rule's other half: the uncertain sentence
is where a definite one would otherwise be, and it stands alone.

### 5.3 `duplicatedNotIdentified` — a real write with a canned `moved` (L07 Spanish, L08 English)

`SaveResult.moved` is `null` on a committed duplicate only when another writer lands between the
transaction's rename and its own re-read, a window of microseconds no probe can hit. **These two
launches wrote the file for real** — the real `duplicate_match` ran inside the canned prop, and §11
checks its bytes — and **only the `moved` field of the answer was replaced with `null`**.

```
L08, English. duplicator box=658,58,508x463 (canned `moved`, real write)
p[3] box=667,299,489x17: The file was written. What is on disk now is exactly the text that was sent.
p[4] box=667,322,489x51: A copy of this file as it was before this session's first change to it was
     kept. …
p[5] box=667,378,489x51: This snippet has been copied. Nothing more can be duplicated from here: …
p[6] box=667,434,489x51 insideViewport=true: This window could not identify the copy in the reading
     that followed the write, so it cannot say where the copy is — or say why not: the file may have
     changed again, or that reading may have failed. Look at the file as it is now.
buttons: [Leave this alone] [Duplicate this snippet DISABLED] [Done]
```

Three lines at 489 px directly under the `duplicated` sentence, and the pair reads as one narrative —
*it was copied; this window cannot say where the copy is* — with neither claiming what the other
suspends. The Spanish twin (L07) is 489 × 51 in a 481 px panel, the tallest state of this reading,
still 164 px inside the pane.

---

## 6. Item 5 — the committed-with-failed-adoption layout. **PASS**

The one Codex named specifically. L09 (Spanish) and L10 (English) **wrote the file for real** and
canned only the adoption's own status, so `fileWritten`, `windowOutOfStep` and the duplicate outcome
are drawn together.

```
L10, English. duplicator box=658,58,508x446 (real write, canned adoption failure)
p[2] box=658,247,508x34: This snippet has been copied. Reading the file again is what tells this app
     where everything now is, so pick the snippet in the list to duplicate it again.   [action row]
p[3] box=667,299,489x17: The file was written. What is on disk now is exactly the text that was sent.
p[4] box=667,322,489x51: A copy of this file as it was before this session's first change to it was
     kept. …
p[5] box=667,378,489x34: The file was written. This window could not read it back afterwards, so
     what it shows of this file is incomplete rather than wrong.
p[6] box=667,417,489x51: This snippet has been copied. Nothing more can be duplicated from here: …
buttons: [Leave this alone] [Duplicate this snippet DISABLED] [Done]
```

**A committed write is never afterwards presented as an error**, and the screen makes that hard to
misread rather than merely true: `windowOutOfStep` **opens by restating the commit** — *"The file was
written. This window could not read it back afterwards"* — so the sentence that reports a failure
begins with the success it does not undo, and ends by bounding the damage (*"incomplete rather than
wrong"*). Nothing on the panel says the duplicate failed, nothing offers to retry it, and
`duplicatedNotIdentified` is correctly **absent** here because `landed` is not `null`.

**On the ambiguity question, the finding is that each sentence carries its own subject and that is
the whole of what separates them.** All four are plain `<p>` in one bordered `.panel` with
`role="status"`, in a fixed order, in the same type and colour; there is no icon, rule or grouping
that says *this one is about the file and this one is about the window*. Judged **not ambiguous as
drawn**, because every sentence names its subject in its first three words — *The file was written*,
*A copy of this file … was kept*, *The file was written. This window could not read it back*, *This
snippet has been copied* — and because the order is transaction-first, window-second, outcome-last.
Recorded as §10.4: the distinction is carried entirely by the words, so a future sentence that opens
with a pronoun would lose it and nothing would fail.

The Spanish twin (L09) is the same shape at 463 px, with `windowOutOfStep` at 489 × 34.

---

## 7. Item 6 — `landed === null`, and nothing reversible. **PASS**

**What the `landed === null` sentence says, it says alone.** §5.3's transcripts are the reading:
`duplicatedNotIdentified` states that this window could not identify the copy, that it therefore
cannot say where the copy is, and that it cannot say why not — then names two possibilities without
asserting either (*"the file may have changed again, or that reading may have failed"*). It never
says the duplicate failed; the `duplicated` sentence sits directly above it saying the opposite, and
the two do not contradict. **It does not imply a second file change**: a possibility offered as one
of two candidate causes is not a claim that a second writer exists, which is exactly the distinction
the module's own comment draws.

**No control anywhere presented the insertion as reversible.** Across all twenty-four launches the
complete roll of controls the duplicate surface ever drew is:

```
[Leave this alone] [Duplicate this snippet] [Save anyway] [Keep editing]
[Read this file again] [Done]
```

— and their Spanish twins. There is **no undo, no revert, no restore and no "keep my draft"**: a
dictionary scan confirms the four `*.undo` keys belong to the raw editor, the small editor, the
creation form and the macOS menu, and that neither dictionary holds any duplicate key naming a
reversal. *Keep editing* is `RawSaveChoice.keepEditing` — the control that dismisses a refusal — and
it is drawn only beside *Save anyway*, never after a commit. **After every commit the only live
controls were *Leave this alone* and *Done*.**

---

## 8. Item 7 — selection behaviour, driven. **PASS**

**A leave-and-return during the operation was driven, not asserted.** The plan clicks *Save anyway*
and then, **with no await between the two**, clicks a different row in the list — so the second
intent is expressed while the duplicate is genuinely in flight, which is the race the step-2 review's
High was about.

L13, English, the parked selection **inside** the shifted range (`:three`, which the insertion
displaces):

```
clicked :three with the duplicate in flight
notice box=658,58,508x103 insideViewport=true: The copy you asked for grew this file, and what is
       now in that position is a different snippet, so the selection was cleared. The snippet you
       had selected is still in the file; pick it in the list again. Dismiss
list[0..4] current=null  (":one" ":one" ":two" ":three" ":other")
committed p[3]: The file was written. What is on disk now is exactly the text that was sent.
```

**The clone did not hijack the selection.** The intent captured before the command was re-validated
after the adoption's own await and correctly rejected, so nothing followed the copy; the selection
was cleared under R27 and the notice **names the copy the person asked for as the cause** — not the
disk. That is `displacedByDuplicate`, four lines at 508 × 103, whole, inside the viewport, coherent
with the success panel below it. The Spanish twin (L14) is the same shape and reads *"La copia que
has pedido ha hecho crecer este archivo y en esa posición hay ahora un fragmento distinto, así que
se ha borrado la selección. El fragmento que tenías seleccionado sigue en el archivo; vuelve a
elegirlo en la lista."*

L15 and L16, the parked selection **outside** the shifted range (`:one` at position 0, which the
insertion does not move):

```
notice box=658,58,508x61: The copy you asked for grew this file, and the snippet you had selected
       was found again. Dismiss
list[0] current=true ":one"
list[1] current=null ":one"
```

The selection survives under its new identity, on the **source** and not on the clone, and the notice
is `keptAfterDuplicate` — two lines at 508 × 61, correctly attributed. The Spanish twin (L16) is the
same at 508 × 61.

And **when nobody moves the selection, the clone is followed**: L01 and L02 (§2) end with
`aria-current` on `list[1]`, the copy, and **no notice at all**. All three arms of the rule were seen
on a screen.

---

## 9. The round-1 Medium, seen from a window

`docs/reviews/phase-2c-3c-3-code.md`'s round-1 finding 1 was that a frozen `notDuplicable` reason
could be drawn beside a live `outOfDate`, and that the only thing preventing it was a condition in
the markup. The fix moved the precedence into `matchDuplicationView.notDuplicableToShow`. **Both
halves are now on a transcript, in both languages.**

L20 (English) and L21 (Spanish) mount the real panel over a real projection with
`unsavedDraftInDocument` answering `true` — a **refused** eligibility — and a `projections` function
answering an empty list, which is a window that no longer holds that file's parse. Canned:

```
L20, English. duplicator box=658,58,508x226
precedence blocked ABSENT
precedence duplicate control box=658,217,156x27 disabled=true
precedence p[2] box=658,247,508x34: This panel comes from a reading of this file that this window
           can no longer stand behind. This duplicate wrote nothing. Close this and pick the snippet
           in the list to duplicate it.
```

**`blocked ABSENT` is the fix measured.** The frozen claim about the snippet is not drawn; only the
weaker live sentence is, beside the disabled control. L12 is its twin with live projections, where
the same session draws the frozen paragraph at 508 × 84 and the refusal sentence is
`notDuplicable`. L21 is the Spanish pair of L20: `blocked ABSENT`, refusal 508 × 51, panel 243 px.

---

## 10. What the window showed that is wrong, and three observations

### 10.1 **The committed panel makes the same claim twice, five lines apart.** Low

L01, L02 and every committed launch: after a commit, the `alreadyDuplicated` refusal in the action
row and the `duplicated` sentence in the outcome panel both begin *"This snippet has been copied"* /
*"Este fragmento se ha copiado"*, and both end by telling the person to pick a snippet in the list
and duplicate it again. Neither is wrong and each is right for its own place — one explains a
disabled control, one reports an outcome — but a person reads one screen, and that screen says the
same thing twice in two registers, 131 px apart (L02: y = 284 and y = 415). **This is `2c-3b-2-window-reading.md` §7.2
inherited unchanged**, and it keeps that record's disposition: cosmetic, recorded because it was
seen, not fixed.

### 10.2 **When the panel is taller than the pane, the committed outcome lands below the fold and nothing scrolls to it.** Low

L18b and L19, measured in the **real** pane at the target size over `:tall`. After the commit the
pane sits at `scrollTop = 0` and the outcome panel is at y = 1 155–1 285 (English) and y = 1 239–1 386
(Spanish) — `insideViewport=false` for all three of its sentences, including *The file was written*
and the *Done* control. What is on screen is the pinned action row, whose own sentence already says
*"This snippet has been copied"*, and the panel head with *Leave this alone*.

So the person is **not** left uninformed and **not** stranded — the fact of the copy is in the pinned
row and a way out is at the top — but the transaction's own report has to be scrolled to. It needs
the snippet's projected fields to overflow the pane on their own, which took a 2 859-character label
here; the tallest realistic panel this reading produced is 481 px in 645 px. **Not fixed**: scrolling
the outcome into view is a change to a component, it would want its own decision about whether a save
may move the pane under a reader, and a change to `MatchDuplicator.svelte` obliges a re-taken
reading.

### 10.3 **At the very bottom of a pane shorter than the outcome panel, the sticky row returns to its natural place and can leave the pane.** Observation

L17, in a mounted panel whose pane was **shortened on purpose to 260 px** — an instrument, not the
shipped window. At
`scrollTop = 0` the row is pinned at y = 213–284 inside the pane; at the end of the scroll
(`scrollTop = 178`) it is at y = 35, nine pixels above the pane's top edge, `insideHost=false`. That
is `position: sticky` as specified — an element cannot stay pinned past its own natural position —
and the state it happens in is one where the control it carries is disabled and *Done* is what the
person is scrolling towards. Recorded because a reader can see it; not judged a defect. It did not
occur in any real-pane launch.

### 10.4 **Four sentences of two different kinds share one visual register on the committed-with-failed-adoption panel.** Observation

§6. *The file was written*, *a copy … was kept*, *this window could not read it back*, *this snippet
has been copied* are four plain paragraphs in one bordered panel, identical in type, colour and
spacing. Today nothing is ambiguous, because each names its own subject in its opening words and the
order is transaction, window, outcome. What is worth writing down is that **the distinction is
carried entirely by the sentences** — a later message that opens with a pronoun, or a reordering,
would blur it and no test in this repository would fail.

### 10.5 **The primary control stays enabled while an unacknowledged refusal is on screen.** Observation

L01, L02 and every refusal transcript: the roll is `[Leave this alone] [Duplicate this snippet]
[Save anyway] [Keep editing]`, and *Duplicate this snippet* is **not** disabled. Clicking it re-sends
without consent and earns the same refusal, which is correct — a refusal is about one candidate and
the file may have changed since — but it puts two controls that both send, and differ only in whether
they carry the acknowledgement, four pixels apart. This is `MatchMover.svelte`'s and
`RawEditor.svelte`'s shape too, so it is a family property rather than this panel's; recorded, not
fixed.

**No defect was found in what is written to disk, and no High or Medium was found at all.**

---

## 11. The bytes

Every launch's tree was compared **whole** against its pristine copy, with `.espansoconfig-backups`
accounted separately. For every file whose bytes changed, the after-text was reconstructed as
*before with one run inserted*, and then the strongest claim the duplicate primitive makes was
checked directly: **the inserted run is byte-identical to the bytes immediately preceding the
insertion point.**

```
L01, L02, L07, L08, L09, L10, L13, L14, L15, L16, L17 (committed duplicates of :one):
  changed files: match/dup.yml and nothing else
  275 bytes before, 446 after
  insertion at byte 182, 171 bytes
  identical to the 171 bytes immediately before it: True
  everything outside the inserted run byte-identical: True
  backup present, one file, beside its .espansoconfig-batch marker

L18, L18b, L19 (committed duplicates of :tall):
  changed files: match/tall.yml and nothing else
  2923 bytes before, 5837 after
  insertion at byte 2923, 2914 bytes
  identical to the 2914 bytes immediately before it: True
  everything outside the inserted run byte-identical: True

L03, L04 (send failure and recovery):
  changed files: match/dup.yml and nothing else
  275 bytes before, 302 after
  insertion at byte 275, 27 bytes — the probe's own "# a second writer was here\n" and nothing else
  identical to the 27 bytes immediately before it: False   (it is the second writer's own line, not
  a clone; the duplicate wrote nothing)
  backup present — the second writer's raw save took it, not the duplicate

L05, L05b, L05c, L06, L11, L12, L20, L21:
  changed files: none; no backup directory — every launch that was not supposed to write wrote
  nothing at all, the canned ones included
```

The 171 bytes are the whole of what `:one` owns: its **two-line comment block**, its `- trigger:`
line, its `replace: |` block scalar with both body lines, its `label:` line and the indentation that
carries the next item. The clone holds them all, byte for byte, and lands immediately after the
source in the same list — which is `DuplicateItem`'s promise checked on a disk rather than read off a
panel. **No defect was found in what is written.**

---

## 12. What this evidence is, and what it is not

**Is:** what WebKit laid out and rendered in the real application's webview — every rectangle above is
an element's own — plus whole-tree byte comparisons on both sides of every launch and an anchored
reconstruction of every file that changed.

**Is not**, carrying the standing gaps forward and adding this reading's own:

1. **Pixels, pointer hit-testing, real keystrokes** — unchanged since `1c-1-notes.md` §10.3. Pane
   scrolling was an assignment to `scrollTop`, not a trackpad.
2. **Eleven launches are canned, and five of them still wrote.** `mayHaveWritten` (L05c, L06),
   `unsavedDraftInDocument` (L11, L12) and the precedence pair (L20, L21) sent nothing and wrote
   nothing; `duplicatedNotIdentified` (L07, L08), the failed adoption (L09, L10) and the shortened
   pane (L17) performed a **real** `duplicate_match` and invented only `moved`, the adoption's status
   and the pane's height respectively. In all eleven the panel is the real component over a real
   projection, but **the `DetailPane` wiring and `BrowserState.duplicateMatch` were not on the
   path** — those two rest on the mounted suite and the model tests, not on a window.
3. **The wire could not be canned at all**, so no launch exercised
   `BrowserState.duplicateMatch`'s own failure handling from a window: the `mayHaveWritten` branch
   that forgets the text cache and re-reads is model-suite evidence only. §1.1's L05/L05b are why.
4. **The `conflict` outcome was not provoked**, exactly as `2c-3b-2-window-reading.md` §10.2 records
   for a move: an external write through the IPC is caught by the command's identity gate first
   (§5.1 is that route), so the three `revision*` sentences and `cannotDuplicate.conflict` still have
   model-suite and mounted evidence only.
5. **`mayHaveWritten` was never seen beside a definite claim**, because the pair is unreachable
   (§5.2). The half of the precedence rule a window can show is that the uncertain sentence stands
   where a definite one would be.
6. **Three `DuplicationRefusal` arms were not drawn**: `readOnly`, `notInDocument` and
   `noSequencePosition`. Only `unsavedDraftInDocument` was.
7. **`findingsAreStale`, the `notes` list and the in-flight `duplicating` marker were never on a
   transcript.** The first two are unreachable for a duplicate as the core stands (the candidate
   cannot change, and no scalar is re-encoded); the third is transient and was never sampled
   mid-send.
8. **`duplicationRecoveryFailed` was not driven** — the re-read that fails, and the `reloadFailed`
   sentence beside it.
9. **The real configuration.** Never opened, deliberately (§1.2).

---

## 13. Verdict

| Item | Verdict |
|---|---|
| 1 — the ordinary path end to end, both languages | **PASS, driven** (L01, L02) — refuse → acknowledge → commit, 189 → 341 → 407 px English and 189 → 375 → 424 px Spanish, all inside a 645 px pane that never scrolls; the clone lands immediately after its source, the selection follows it, no notice; the bytes check out (§11) |
| 2 — the sticky action row at the target size | **PASS, measured** (L18b, L19, L17) — at the target size nothing overflows the pane at all (tallest state 481 px in 645 px); over a panel of 1 277 px of content the row is pinned at y = 604 with its own reason inside it at every scroll position, and the panel stays usable; §10.2 and §10.3 are what a reader notices |
| 3 — the long Spanish `unsavedDraftInDocument` paragraph | **PASS, and natural** (L11, L12) — 391 characters wrap to six lines and 101 px, whole, inside the viewport, in a 318 px panel; reads as a conditional open-editor warning throughout and never asserts that unsaved edits exist; the length breaks nothing |
| 4 — `mayHaveWritten`, `outOfDate`, `duplicatedNotIdentified` | **PASS** — `outOfDate` driven end to end (L03, L04), the other two canned (L05c/L06, L07/L08); the uncertain claim is drawn above everything and stands alone, with no recovery offered beside it |
| 5 — committed with a failed adoption | **PASS** (L09, L10) — `fileWritten`, the backup sentence, `windowOutOfStep` and the duplicate outcome in one panel, each naming its own subject, transaction-first; a committed write is never afterwards presented as an error, and `windowOutOfStep` opens by restating the commit. §10.4 records what carries the distinction |
| 6 — `landed === null`, and nothing reversible | **PASS** (L07, L08, and all 24) — the sentence says only that the copy could not be identified, offers two candidate causes without asserting either, and never says the duplicate failed; no undo, revert, restore or "keep my draft" control exists anywhere on this surface |
| 7 — selection behaviour | **PASS, driven** (L13–L16, L01, L02) — a real leave-and-return during the send does **not** let the clone hijack the selection; both repair arms carry the duplicate's own attribution; with no leave-and-return the clone is followed and no notice is raised |

**No High and no Medium. Two Lows and three Observations**: §10.1 (the same claim twice, low —
`2c-3b-2` §7.2 inherited), §10.2 (the outcome below the fold in an overflowing panel, low), §10.3
(the sticky row un-pinning at the end of a short pane, observation), §10.4 (four sentences in one
register, observation), §10.5 (the primary control live beside an unacknowledged refusal,
observation). **No defect was found in what is written to disk.** The round-1 review's Medium is
closed by measurement in §9.

**2c-3c step 3's third kind of evidence is discharged, and 2c-3c is complete.**

---

## 14. The probe, and its removal

`src/probe.ts` and `src-tauri/src/probe.rs` were deleted; `src/main.ts` and `src-tauri/src/main.rs`
were restored by hand to exactly what they held before the probe existed, and
`git status --short --untracked-files=all` shows **neither of them modified** — the tree holds only
step 3's own eight modified files, its three new ones and this record. `rg "render_probe|probe_plan|
ECFG_PROBE|startProbe" src src-tauri/src scripts` finds nothing. Every scratch path — the
twenty-four bundles, the twenty-four configurations, the twenty-four `HOME`s — lived outside the
repository. **No git command that changes anything was run.**

Re-run afterwards from the reverted source:

```
npm test               46 files, 1324 tests, all passing
npm run check          411 files, 0 errors, 0 warnings
npm run build          171 modules
```

**The module guard is unmoved at 171**, with no `svelte/internal/server` and no `node:async_hooks` in
the bundle. During the reading it was **172**, which is 171 plus `probe.ts` — the "moved by exactly
the number of new source modules" shape, not the `resolve.conditions` regression.
