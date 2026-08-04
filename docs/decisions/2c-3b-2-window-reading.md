# Phase 2c-3b step 2 — the window reading

The third of the three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires of every 2c
sub-phase, taken over `src/lib/components/MatchMover.svelte` and the `DetailPane.svelte` wiring that
draws it. The model tests and the thirteen mounted cases are 2c-3b-2's own; this file is the record
of **what a screen actually did**. It discharges `docs/decisions/2c-3b-2-notes.md` §4 hole 1, settles
the six questions `PROGRESS.md`'s "Next action" put to it — including the `invalidatedByCommit`
judgement `2c-3b-1-notes.md` §5.2 deferred to exactly this reading — and pays the creation-form
width measurement `PROGRESS.md` has owed since `fragmento` replaced `atajo`.

**Nothing here was inferred from the test suite.** Every line quoted below came out of a running
WKWebView, and every claim about a file's bytes was checked with a whole-tree comparison and an
anchored byte-for-byte reconstruction — never by reading the panel the application drew about
itself. **Two launches are the stated exception to "the pipeline was driven"**: §4.3's two arms
cannot be produced by any end-to-end run, so they were drawn by the real component in the real
webview over a **canned command answer**, and every number from those launches says so.

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

**One plan per launch, into a fresh bundle path, over a freshly rebuilt configuration.** **Twelve
launches**, each with its own `espansoConfig.app`, its own `XDG_CONFIG_HOME` and its own `HOME`. A
temporary `src/probe.ts` drives one plan 700 ms after mount; a temporary `probe_plan` command reads
`ECFG_PROBE_PLAN` and a temporary `render_probe` prints the transcript to stdout. **All twelve
reached their own `--- end` and all twelve `probe.err` files were zero bytes**, so no transcript
below is a partial run rounded up to a conclusion.

**Every plan set the language explicitly through the application's own picker**, with a bubbling
`change` event, as its first step — `2c-2-2-window-reading.md` §1.2's lesson applied rather than
re-learned. Each transcript's own `language set through the picker: <tag>` line is the evidence; no
launch was lost to a leaked `localStorage` override. Six launches ran in Spanish (L1, L2, L4, L4b,
L8, L11) and six in English (L3, L5, L6, L7, L9, L10).

The probe reaches the screen the way a person does — `HTMLElement.click()` on a real control — and
reports each element's own `getBoundingClientRect()`, so a control in the DOM at zero size is not
reported as a control that was drawn. Where a plan needed a **second writer**, it called the
raw-save IPC command directly (`saveRawDocument` in `src/lib/ipc/commands.ts`), never the window's
own state — the write reaches the disk through the real command layer while the window's
projections stay unaware, which is exactly what an external program does to this application.

### 1.1 The launches, including the one whose plan was wrong

| # | Plan | Lang | What it was for |
|---|---|---|---|
| L1 | `moverOpen:es` | es | the destination panel's geometry over a 25-snippet sequence — item 1 |
| L2 | `moveCommit:es` | es | a committed move, the `moved` sentence, the spent panel — items 3, 5 |
| L3 | `moveCommit:en` | en | the English twin of L2 |
| L4 | `moveConflict:es` | es | **the plan was wrong, not the product.** It expected a *conflict* outcome from an external write and looked for *Keep editing*; the command's identity gate answers first (§4.2), so the control it waited for never exists on that path. The launch itself succeeded, reached `--- end`, and its transcript of the failure panel is what taught the correction |
| L4b | `moveConflict:es` | es | the corrected plan: send failure → *Volver a leer este archivo* → `outOfDate` — items 3, 5 |
| L5 | `moveConflict:en` | en | the English twin of L4b |
| L6 | `midflight:inside` | en | the parked selection **inside** the shifted range — item 4 |
| L7 | `midflight:outside` | en | the parked selection **outside** the shifted range — item 4 |
| L8 | `createForm:es` | es | the creation form with `fragmento` drawn — item 2 |
| L9 | `editorOpen:en` | en | the silent absence of Move while an editor is open — item 6 |
| L10 | `stubArms:en` | en | the two arms no pipeline run can produce, canned — items 3, 5 |
| L11 | `stubArms:es` | es | the Spanish twin of L10 |

### 1.2 The configuration

**Synthetic, hand-written for this run, in a scratch directory outside the repository**, and rebuilt
from scratch before every launch — this screen writes files, and a reading must not stand on the
previous launch's bytes. **Nine files**:

| File | What it is for |
|---|---|
| `config/default.yml` | a profile, so the sidebar has one |
| `match/four.yml` | `:alpha` `:beta` `:gamma` `:delta` — a reorder of the first two leaves the last two positions untouched, which is what item 4 needs |
| `match/long.yml` | **twenty-five** snippets `:t01`–`:t25` — the longest sequence of this reading, for item 1 |
| `match/m1.yml` … `match/m6.yml` | one snippet each, so the creation form's destination list saturates its bound |

`XDG_CONFIG_HOME` and `HOME` both point into that tree. **The owner's real configuration was never
opened**, and nothing below quotes anything but this run's own synthetic content and this
application's own strings.

A pristine copy of the tree (`<launch>/xdg-before`) was taken before every launch, which is what the
byte checks compare against.

---

## 2. Item 1 — the destination panel's height, measured, in Spanish. **PASS**

L1: `match/long.yml`, `:t01` selected, *Mover este fragmento…* clicked. The sequence gives the panel
**26 destination rows** — the top, twenty-four anchors, the end.

```
viewport 1180x728
detail  box=644,44,536x645 scrollH=645 clientH=645 scrollTop=0
mover   box=658,95,508x394 scrollH=394 clientH=394
boundary box=658,205,508x51: Un fragmento se mueve dentro de la lista en la que ya está, así que
         todos los sitios que se ofrecen aquí están en match/long.yml. Los fragmentos de otros
         archivos no son destinos posibles.
destinations box=658,260,508x168 scrollH=777 clientH=168 overflowY=auto maxHeight=168px
destination rows: 26
dest[0]  "Al principio de la lista" pressed=true marker="Donde está ahora"
dest[25] "Al final de la lista"
actions box=658,435,508x54 position=sticky bottom=0px
move control box=658,438,158x27 disabled=true insideViewport=true "Mover este fragmento"
refusal box=658,468,508x17 insideViewport=true: Aquí es donde el archivo ya escribe este fragmento.
        Elige otro sitio para él.
after list scroll: scrollTop=609 last box=658,401,125x27 "Al final de la lista"
        insideList=true insideViewport=true
```

**The whole panel is 394 px tall inside a 645 px pane — 251 px to spare — and the pane does not
scroll at all** (`scrollHeight` 645 against 645). The list is doing exactly what §2.8 bounded it to
do: **168 px of box over 777 px of content** — `max-height: 12rem` computes to 168 px at this
window's 14 px root font size — with `overflow-y: auto`, and all 26 rows in it. Scrolling the list
itself through its whole range (`scrollTop` 0 → 609, which is exactly 777 − 168) brings the last
option fully inside the list and the viewport, whole and unclipped. **The sticky action row holds
the move control at y = 438, on screen**, with its refusal sentence one line (17 px) below it.

Two cross-checks that the height is a constant rather than a coincidence: the same panel over
`match/four.yml`'s five rows (L2) is 372 px — the only difference is the list below its cap — and
at 26 rows nothing outside the list moved at all. **The panel's height does not depend on the
snippet count**, which is the property the 2c-3a-2 layout defect lacked.

**What the panel opens showing is also on this transcript**: the snippet's current place is
pre-chosen (`aria-pressed` on *Al principio de la lista*, with the *Donde está ahora* marker beside
it), the control is disabled, and the `alreadyThere` sentence says why — *"Aquí es donde el archivo
ya escribe este fragmento. Elige otro sitio para él."* Choosing *Después de :t13* enabled the
control and withdrew the sentence in the same breath (`chosen` block of the transcript: control
`disabled=false`, refusal `ABSENT`, actions row 54 → 34 px).

---

## 3. Item 2 — the creation form's width in Spanish, with `fragmento` drawn. **PASS**

L8, Spanish, nothing selected, *Añadir un fragmento* clicked. This is the measurement `PROGRESS.md`
has owed since the terminology change: `2c-3a-2-window-reading.md` §12.7 measured **13 px** of
vertical margin and a **125 × 27** create control while the words were still `atajo`.

```
viewport 1180x728
detail  box=644,44,536x645 scrollH=645 clientH=645 scrollTop=0
creator box=658,58,508x604 scrollH=604 clientH=604
destinations box=658,135,508x168 scrollH=301 clientH=168 overflowY=auto controls=9
field[2] "Disparador"            box=658,358,508x96  control=658,376,508x22
field[2] disclosure box=658,402,508x51: Esta caja contiene una sola línea. … el texto que activa el
         fragmento es el que queda una vez quitado.
field[3] "Texto de sustitución"  box=658,460,508x140 control=658,479,508x84
field[3] disclosure box=658,566,508x34: Un salto de línea en esta caja se escribe como avance de
         línea. …
actions box=658,608,508x54 position=sticky
action "Deshacer"              box=658,611,77x27
action "Rehacer"               box=740,611,69x27
action "Añadir este fragmento" box=815,611,160x27 disabled=true insideViewport=true
refusal box=658,641,508x17 insideViewport=true: Elige el archivo al que debe añadirse este fragmento.
action row tops: 611 611 611
```

**The form is 604 px tall against the same 617 px of room — the margin is still 13 px**, unchanged
to the pixel from §12.7, because the two sentences that grew (`fragmento` for `atajo` in both
disclosures) wrap to the same line counts they wrapped to before (51 px and 34 px). **The create
control grew from 125 px to 160 px wide** (*Añadir este fragmento* for *Añadir este atajo*) and the
action row still holds *Deshacer*, *Rehacer* and the create control **on one line** — three
identical `top` values, right edge at x = 975 inside a form that runs to x = 1166. Nothing wraps,
nothing clips, no control leaves the form's width, and the disabled control's reason is on screen
under it. The destination list is at its bound (168 px of box over 301 px of content, nine
controls) and the pane does not scroll.

---

## 4. Item 3 — the three rewritten sentences, on screen, in both languages

No test asserts what these sentences say (2c-3b-2's notes, hole 10), so this section is their only
reading. Verdict per sentence: **drawn whole, wrapped cleanly, and each reads as a coherent
instruction — none reads as nonsense.**

### 4.1 `moved` — a real committed move (L2 Spanish, L3 English). **PASS**

`:alpha` moved after `:beta` in `match/four.yml`, through the real pipeline. English, from L3:

```
panel[0] p[0] box=667,392,489x17: The file was written. What is on disk now is exactly the text
         that was sent.
panel[0] p[1] box=667,415,489x51: A copy of this file as it was before this session's first change
         to it was kept. …
panel[0] p[2] box=667,471,489x51: This snippet has been moved. Nothing more can be moved from here:
         the places this panel offers came from the reading of the file it was opened over, so
         close this and pick the snippet in the list to move it again.
panel[0] p[3] box=667,528,489x23: Done
```

Three lines at 489 px wide, inside the viewport, in a panel whose only live control is *Done*. The
Spanish twin (L2) is 489 × 51 as well and reads the same way. **The list beside it shows the move**:
`:beta` `:alpha` `:gamma` `:delta`, with `aria-current` on `:alpha` and on nothing else — the
selection followed the moved snippet, **no notice was raised** for the person who asked for the
move, and the sidebar's counts did not change. The bytes: §8.

### 4.2 `cannotMove.outOfDate` — a real out-of-date session (L4b Spanish, L5 English). **PASS**

The honest route to this sentence, driven end to end: the panel open over `:alpha`, a **second
writer** appends one comment line to `match/four.yml` through the raw-save IPC command
(`outcome=saved committed=true`, the window's projections untouched), the move is sent, and the
command rejects it at its identity gate. The panel draws the failure and its recovery:

```
failed panel p[0] box=667,445,489x17: This move could not be sent, so this move wrote nothing.
failed panel p[1] box=667,467,489x17: What this app was told:
failed panel p[2] box=667,489,489x34: This file has changed since that snippet was selected, so the
       selection has to be resolved again.
failed panel p[3] box=667,529,489x23: Read this file again
```

— note that at this moment the move control is still **enabled** and no refusal is drawn: the
window's own projection has not changed, so the live check has nothing to notice yet, and a person
who clicked again would get the same failure. *Read this file again* is what resolves it. Clicking
it re-reads the file, the projection is replaced, and the live check answers on the next render:

```
reread move control box=658,381,130x27 disabled=true "Move this snippet"
reread refusal box=658,411,508x34 insideViewport=true: The places offered here come from a reading
       of this file that this window can no longer stand behind. This move wrote nothing. Close
       this and pick the snippet in the list to move it.
notice box=658,58,508x61: This file changed on disk, and the snippet you had selected was found
       again. Dismiss
```

Two lines in English (508 × 34), three in Spanish (508 × 51, L4b), inside the viewport both times,
beside a disabled control. **"This move wrote nothing" is true on this screen** — the refusal
precedence that guarantees it is the rule `PROGRESS.md` records — and the `kept` notice above it is
*accurate here*, because the file really was changed by another writer. The bytes: the file holds
exactly the before text plus the one appended comment line, and the move wrote nothing (§8).

### 4.3 `movedNotIdentified` — canned, stated as canned (L10 English, L11 Spanish). **PASS with an instrument note**

`SaveResult.moved` is `null` on a committed move only when another writer lands **between the
transaction's rename and its own re-read** (`after_a_save` in `src-tauri/src/commands.rs`) — a
window of microseconds no probe can hit — so this sentence, and §6's `mayHaveWritten` state, were
drawn by mounting the **real `MatchMover` over the real projection in the real webview** with a
`move` prop that answers a canned `{outcome: 'saved', committed: true, moved: null}`. The real
reducer ran, the real dictionary rendered, real WebKit laid it out; **only the wire answer was
invented**, and no byte of any file was touched (§8). English, from L10:

```
panel[0] p[2] box=667,593,472x51: This snippet has been moved. Nothing more can be moved from here: …
panel[0] p[3] box=667,649,472x51 insideViewport=true: The file changed again between the write and
         the reading that followed it, so this window cannot say where the moved snippet is, or
         whether it is still there. Look at the file as it is now.
panel[0] p[4] box=667,705,472x23 insideViewport=true: Done
```

Three lines at 472 px, directly under the `moved` sentence, and the pair reads as one narrative —
*it moved; this window cannot say where it is now* — with neither claiming what the other suspends.
The Spanish twin (L11) is 472 × 51 and reads the same. **Instrument note:** in L11 the sentence and
*Done* sat below the fold (`insideViewport=false`, pane `scrollHeight` 740 over 645) — that is the
stub's mounting, not the real screen: the stub stacked the panel **under** the pane's own standing
content (its section opens at y = 127 where L2's real one opens at y = 95) and kept all five
destination rows, where a real commit's replaced projection shrinks the list to two (visible in
L2/L3; the *After …* rows resolve their anchors against the live projections and a replaced parse
answers none, which is also §7.3's mechanism) — 122 px that the real flow does not spend. L2, the real Spanish committed flow, ends its panel at y = 592, comfortably inside the pane;
and the pane scrolls in any case, with the action row sticky. No real-flow launch of this reading
put any sentence off screen.

---

## 5. Item 4 — `invalidatedByCommit`, judged: **the `differentMatch` notice is a false alarm, and the arm is worth adding**

The question `2c-3b-1-notes.md` §5.2 deferred to this reading, driven exactly as it asked: a file
of four snippets, the panel moving `:alpha` after `:beta`, and the person clicking a **different**
snippet in the list while the panel is open — once at a position the reorder touches, once at one
it does not.

### 5.1 Inside the shifted range (L6): dropped, with a sentence that reads as an external surprise

Selection parked on `:beta` — position 1, which the reorder rewrites. After the commit:

```
notice box=658,58,508x61: This file changed on disk, and what is now in that position is a
       different snippet, so the selection was cleared. Dismiss
list[0] current=null ":beta"
list[1] current=null ":alpha"
list[2] current=null ":gamma"
list[3] current=null ":delta"
panel[0] p[0]: The file was written. What is on disk now is exactly the text that was sent.
panel[0] p[2]: This snippet has been moved. …
```

**Judged on the screen: yes, it reads as a false alarm.** Three sentences apart, one window
describes one write twice — the notice as *"this file changed on disk"*, an external event that
cost the person their selection; the outcome panel as *"the file was written"*, the success they
asked for. The dropped snippet `:beta` is visibly in the list one row above its old position, and
**nothing is selected**. A person who parked their selection while their own move was in flight is
told their file moved under them.

### 5.2 Outside the shifted range (L7): kept — and the milder half of the same misattribution

Selection parked on `:delta` — position 3, untouched. After the commit the selection survives under
its new identity (`current=true` on `:delta`), and the notice is:

```
notice box=658,58,508x61: This file changed on disk, and the snippet you had selected was found
       again. Dismiss
```

The repair does the right thing, and its sentence still opens with *"This file changed on disk"* —
the same attribution of the person's own move to the disk, with nothing lost this time.

### 5.3 The judgement, recorded and not fixed

Both arms of `repairAfter`'s answer were measured doing exactly what
`2c-3b-1-notes.md` §5.1's model test said they would. The `differentMatch` case is the finding
(§7.1): **the arm is worth adding**, and per §5.2 of that record the right shape is **an explicit
notice argument on the adoption, never a swap inside `repairAfter`** — L4b/L5 of this very reading
are the proof that the same sentences are *accurate* when the file really was changed by another
writer, so rewording them globally would fix this screen by breaking that one. Nothing was changed
in this reading.

---

## 6. Item 5 — whether a spent session reads as a dead end. **It does not: every spent state names its exit, and the exit is live**

Three spent states were read — two through the real pipeline, one canned (§4.3's method):

- **`alreadyMoved`** (L2/L3, real): *"This snippet has been moved. Reading the file again is what
  tells this app where everything now is, so pick the snippet in the list to move it again."*
  (508 × 34 EN, 508 × 34 ES) beside the disabled control, with the `moved` sentence below ending
  *"…close this and pick the snippet in the list to move it again."* The live controls in the
  window: *Done* — which closes the panel — and the header's *Leave it where it is*, also enabled.
- **`outOfDate`** (L4b/L5, real): *"…Close this and pick the snippet in the list to move it."*
  (508 × 34 EN, 508 × 51 ES). The header's exit is enabled; the snippet is one click away in the
  list beside the pane.
- **`mayHaveWritten`** (L10/L11, canned): *"A move was sent and this app cannot tell whether the
  file was written. So this panel can no longer establish where this snippet is: look at the file,
  then close this and pick the snippet in the list to move it from wherever the file now writes
  it."* (508 × 51 EN, 491 × 68 ES), above a failure panel that offers **no** recovery control —
  the button roll holds *Leave it where it is* and nothing else live, which is the "no re-read for
  a send this application cannot account for" rule seen from a window.

**Every one of the three sentences says, in words, to close the panel and pick the snippet in the
list, and the control that does it is enabled in every state.** A spent panel is a terminal state
with a stated way out, not a dead end. Two things a reader of these screens does notice are
recorded as §7.2 and §7.3.

---

## 7. What the window showed that is wrong, and two observations

### 7.1 **`differentMatch` after an asked-for move is a false alarm.** Medium

§5.1, measured in L6. The notice tells the person their file *changed on disk* and that *a
different snippet is at that position*, directly above a panel reporting the very write they asked
for as a success — and it costs them a selection whose snippet is still on screen. It is wrong in
what it *attributes*, not in what it does: dropping the selection under R27 is defensible, the
sentence explaining it is not. **Not fixed here** — the fix is an explicit notice argument on the
adoption (`2c-3b-1-notes.md` §5.2), it touches a path four writing wrappers share, and L4b/L5 show
the same sentence being accurate for a genuinely external change, so this is a change to make
deliberately, with its own re-taken reading. The `kept` arm (§5.2, L7) is the same misattribution
with nothing lost, and one fix should cover both.

### 7.2 **The committed panel makes the same claim twice, five lines apart.** Low

L2/L3 (and both stub launches): after a commit, the `alreadyMoved` refusal beside the disabled
control and the `moved` sentence in the outcome panel both begin *"This snippet has been moved"* /
*"Este fragmento se ha movido"* and both end by telling the person to pick the snippet in the list
again. Neither is wrong and each is right for its own place — one explains a disabled control, one
reports an outcome — but a person reads one screen, and that screen says the same thing twice in
two registers. Cosmetic; recorded because it was seen.

### 7.3 **After a successful recovery re-read, the two placeless destinations stay enabled under a refusal that says the panel cannot be stood behind.** Low

L4b/L5's end state: the *After …* rows are gone (their anchors no longer resolve in the replaced
parse), the two that remain — *At the top of the list*, *At the bottom of the list* — are
**enabled**, and the refusal under the disabled move control says the panel's offers come from a
reading the window can no longer stand behind. Choosing one of the enabled rows withdraws the
failure panel — taking the *Read this file again* control with it — and cannot lead to a send
unless the file returns to the session's revision. This is the model's own rule read literally: a
successful re-read does not spend the session (F5 spends only a failed one), `canChoose` consults
the session and the liveness check is live, so a file restored byte-for-byte would genuinely
revive the panel. Coherent, and strange to look at. Recorded, not fixed.

### 7.4 **The *Where it is now* marker on a spent panel marks where it was.** Observation

L2/L3: after the commit, the surviving *At the top of the list* row still carries *Where it is
now* — computed from the session's frozen members, in which `:alpha` was first. The file now
writes it second. The `moved` sentence directly above says the panel's places *"came from the
reading of the file it was opened over"*, which is exactly this fact stated in words, and every
control it could mislead is disabled. Recorded because a person can see it; not judged a defect.

---

## 8. The bytes

Every launch's tree was compared whole against its pristine copy, with `.espansoconfig-backups`
accounted separately.

```
L2, L3, L6, L7 (committed moves):
  changed files: match/four.yml and nothing else
  after == before with the ':alpha' two-line block moved to just after the ':beta' block: True
  257 bytes before, 257 after; comment line and every other snippet byte-identical
  backup present, one file, beside its .espansoconfig-batch marker

L4, L4b, L5 (send failure and recovery):
  changed files: match/four.yml and nothing else
  after == before plus the probe's one appended comment line: True   (the move wrote nothing)

L1, L8, L9, L10, L11:
  changed files: none; no backup directory — launches that were not supposed to write wrote
  nothing at all, the two canned-answer launches included
```

**No defect was found in what is written.** Every committed move wrote exactly the relocation and
left every other byte of the file alone.

---

## 9. Item 6 — the silent absence of Move while an editor is open. **Judged not confusing, and the judgement is about what was actually drawn**

L9: `:alpha` selected, then *Edit this snippet* clicked.

```
before editor — detail buttons: [Show this file’s text] [Add a snippet] [Edit this snippet]
                                [Delete this snippet…] [Move this snippet…]
with editor open — window buttons: … [Show this file’s text] [Stop editing] [Take this key out]
                                [Take this key out] [Undo DISABLED] [Redo DISABLED]
                                [Save this snippet DISABLED]
move opener while editor open: ABSENT
any text mentioning "move" in the third pane: false
```

The R36 refusal seen from a window is **not** a Move control missing from a row of survivors: the
whole third pane changes subject to the editor, and *Add a snippet*, *Delete this snippet…* and
*Move this snippet…* are withdrawn together, none of them singled out. A person looking at this
screen is editing, with *Stop editing* as the stated way back — after which all four openers
return. Nothing says "close the editor to move this snippet", but nothing invites the question
either, because no sibling action survives to make Move's absence conspicuous. **The confirmation
review's "acceptable for the chosen policy" holds on screen.** What this does not test is a person
who *wants* to move mid-edit and has to discover the path themselves; that is a usability question
beyond a DOM transcript.

---

## 10. What this evidence is, and what it is not

**Is:** what WebKit laid out and rendered in the real application's webview — every rectangle above
is an element's own — plus whole-tree byte comparisons on both sides of every launch.

**Is not**, carrying the standing gaps forward and adding this reading's own:

1. **Pixels, pointer hit-testing, real keystrokes** — unchanged since `1c-1-notes.md` §10.3. List
   scrolling was an assignment to `scrollTop`, not a trackpad.
2. **The `conflict` outcome was not provoked, and this reading measured why it is hard.** An
   external write through the IPC is caught by the command's *identity gate* (`view_at` checks the
   base revision first) and comes back as a typed command failure — L4's discovery — so the three
   `revision*` sentences, *Keep editing*, and `cannotMove.conflict` still have model-suite and
   mounted evidence only. Reaching them from a window needs a write the command layer's own cache
   does not see (a filesystem write from outside the process, timed between the gate and the lock).
3. **`movedNotIdentified` and the `mayHaveWritten` state were never produced by the pipeline** —
   §4.3 and §6 are canned-answer readings of the real component, stated as such everywhere they are
   cited. Their layout and copy are measured; that the pipeline can deliver those states to this
   panel rests on the model suite and `MatchMover.test.ts`.
4. **The `notMovable` arms were not driven** — `readOnly`, `onlySnippetInSequence`,
   `noSequencePosition`, `unsavedDraft` — nor the refused-verdict/acknowledgement round trip, nor
   the in-flight `moving` marker, which is transient and was never sampled mid-send.
5. **The anchor aliasing** (*end* and *after the one above it* both marked *Where it is now* for a
   last snippet) was not driven; every launch moved a first snippet, so only the single-marker case
   is on a transcript.
6. **The real configuration.** Never opened, deliberately (§1.2).

---

## 11. Verdict

| Item | Verdict |
|---|---|
| 1 — the destination panel's height, in Spanish | **PASS, measured** — 394 px panel in a 645 px pane over 26 rows; list capped at 168 px (12 rem at the 14 px root) over 777 px of content; sticky row on screen; last row reachable, whole; height independent of the snippet count |
| 2 — the creation form in Spanish, `fragmento` drawn | **PASS, measured** — 604 px against 617 px of room, the same 13 px margin as before the terminology change; the create control grew 125 → 160 px and the action row still fits on one line; nothing wraps or clips |
| 3 — the three rewritten sentences, both languages | **PASS** — `moved` and `cannotMove.outOfDate` through the real pipeline, `movedNotIdentified` canned (§4.3); all six renderings whole, cleanly wrapped, coherent |
| 4 — `invalidatedByCommit` | **Settled: false alarm confirmed** (§5, §7.1, medium) — `differentMatch` attributes the person's own move to the disk and drops a selection whose snippet is on screen; `kept` is the milder half; the fix direction is recorded, not applied |
| 5 — a spent session as a dead end | **Not a dead end** — all three spent states name the exit in their own sentence and the exit is enabled; §7.2 and §7.3 are what a reader notices |
| 6 — the silent absence of Move | **Not confusing as drawn** — the whole pane changes subject and no sibling action survives to make the absence conspicuous; R36's silence costs nothing a screen can see |

**One medium finding, two low, two observations.** §7.1 (`differentMatch` false alarm, medium —
the item-4 question answered), §7.2 (the same claim twice on the committed panel, low), §7.3
(enabled placeless destinations under `outOfDate`, low), §7.4 (the frozen *Where it is now*
marker, observation), and L4's plan error (an instrument lesson, §1.1). **No defect was found in
what is written to disk.**

---

## 12. The probe, and its removal

`src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored from copies
taken **before** the probe existed and compared with `diff`: **`main.ts IDENTICAL`,
`main.rs IDENTICAL`**. `rg "render_probe|probe_plan|ECFG_PROBE|startProbe" src src-tauri/src
scripts` finds nothing. Every scratch path — the twelve bundles, the twelve configurations, the
twelve `HOME`s — lived outside the repository, and this record is the only file this reading added
to the tree. No git command was run.

Re-run afterwards from the reverted source, all passing and all at the counts `PROGRESS.md`
expects:

```
npm run check          407 files, 0 errors, 0 warnings
npm test               44 files, 1242 tests
npm run build          168 modules
cargo test --workspace 1008 passed, 0 failed
```

**The module guard is unmoved at 168**, with no `svelte/internal/server` and no `node:async_hooks`
in the bundle. During the reading it was **169**, which is 168 plus `probe.ts` — the "moved by
exactly the number of new source modules" shape, not the `resolve.conditions` regression.

---

## 13. The re-taken reading after the §7.1 fix

**A window reading is re-taken after any change to a component's screen** (CLAUDE.md §6), and
§7.1's finding was fixed after this record was first written: `repairAfter` and the two adoptions
now carry an explicit **attribution** argument (default `'externalChange'`, byte-identical for
every caller except `moveMatch`'s committed adoption, which passes `'requestedMove'` guarded on the
re-read being exactly the parse the write produced), and two new `SelectionNotice` arms —
`keptAfterMove` and `displacedByMove` — carry new sentences in both dictionaries. The fix passed a
Codex review with no findings (`docs/reviews/phase-2c-3b-2-reading-fix.md`, READY). This section is
the re-take of the arms that change touched; **nothing above it has been edited**.

**§7.1's disposition is superseded by this section**: the false alarm it records was real, was
fixed, and the fix is measured below. **§5's transcripts are the PRE-fix sentences, kept exactly as
taken** — they are the record of what the defect looked like on a screen, and rewriting them to
match later code would be inventing evidence. §7.2–§7.4 are untouched by the fix and stand as
written.

### 13.1 The launches

Same technique, same constraint, same configuration recipe as §1 — one plan per launch, into a
fresh bundle path, over a freshly rebuilt configuration, the language set **through the picker** at
the top of every plan, `npm run build` and `cargo build -p espansoconfig --features custom-protocol`
re-run before bundling so the new sentences are in the binary. The baseline is the working tree
with the fix in it: `npm test` **1244** over 44 files and `npm run build` **168** modules before
the probe went in (169 with it — 168 plus `probe.ts`, the legal shape).

**Five launches, five `--- end` markers, five zero-byte `probe.err` files. None failed.**

| # | Plan | Lang | What it was for |
|---|---|---|---|
| R1 | `midflight:inside:en` | en | the L6 analogue — `displacedByMove`, English |
| R2 | `midflight:outside:en` | en | the L7 analogue — `keptAfterMove`, English |
| R3 | `midflight:inside:es` | es | the Spanish twin of R1 |
| R4 | `midflight:outside:es` | es | the Spanish twin of R2 |
| R5 | `moveConflict:en` | en | the L5 analogue — that the **external** attribution survives where it is accurate |

### 13.2 The displaced arm, both languages — the new sentence, whole, and no false alarm. **PASS**

R1, English: `:alpha` moved after `:beta` while the selection was parked on `:beta` — position 1,
which the reorder rewrites. After the commit:

```
notice box=658,58,508x103 p=669,69,412x84 insideViewport=true: The move you asked for reordered
       this file, and what is now in that position is a different snippet, so the selection was
       cleared. The snippet you had selected is still in the file; pick it in the list again.
       Dismiss
list[0..3] current=null  (":beta" ":alpha" ":gamma" ":delta")
panel[0] p[0]: The file was written. What is on disk now is exactly the text that was sent.
panel[0] p[2]: This snippet has been moved. …
```

**The false alarm is gone.** The sentence names the move the person asked for as the cause, says
the snippet is still in the file, and says what to do — four lines at 412 px, whole, inside the
viewport, and now *coherent* with the success panel below it instead of contradicting it. Nothing
claims the file "changed on disk". The selection is still cleared, which is the R27 behaviour the
fix deliberately kept; what changed is that the screen now tells the truth about why. The Spanish
twin (R3) is 382 × 84, four lines, whole: *"El traslado que has pedido ha reordenado este archivo y
en esa posición hay ahora un fragmento distinto, así que se ha borrado la selección. El fragmento
que tenías seleccionado sigue en el archivo; vuelve a elegirlo en la lista."*

### 13.3 The kept arm, both languages. **PASS**

R2, English: the selection parked on `:delta` — position 3, untouched by the reorder — survives
under its new identity (`current=true` on `:delta` after the commit), and the notice is the new
sentence:

```
notice box=658,58,508x61 p=669,69,412x42 insideViewport=true: The move you asked for reordered
       this file, and the snippet you had selected was found again. Dismiss
```

Two lines, whole, correctly attributed. The Spanish twin (R4) is 399 × 42: *"El traslado que has
pedido ha reordenado este archivo y el fragmento que tenías seleccionado se ha vuelto a
encontrar."* — same shape, same verdict. §5.2's milder misattribution is gone with the louder one.

### 13.4 The external attribution survives where it is accurate. **PASS** (R5)

The L4b/L5 route re-driven end to end on the fixed code: a second writer appends a comment line
through the raw-save IPC, the move is sent, the command rejects it at the identity gate, and *Read
this file again* re-reads the file. The repair that follows is a re-read of a **genuinely external**
change, and the notice is the **old** sentence, unchanged:

```
refusal box=658,411,508x34: The places offered here come from a reading of this file that this
        window can no longer stand behind. This move wrote nothing. Close this and pick the
        snippet in the list to move it.
notice  box=658,58,508x61: This file changed on disk, and the snippet you had selected was found
        again. Dismiss
```

*"This file changed on disk"* is exactly right on this screen, and the fix left it there — the
attribution defaulted to `externalChange` because no committed move of this window produced that
parse. The `outOfDate` refusal beside the disabled control is unchanged from §4.2. What this launch
does **not** exercise is the guard's sharpest case — a committed move whose adoption re-read races
a third writer, where `fromThisWrite` falls back to `externalChange`; that case rests on the model
tests and the reviewed trace, not on a window.

### 13.5 The bytes, and the instrument's removal

R1–R4: `match/four.yml` and nothing else changed, and the after-text is **exactly** the before
text with the `:alpha` two-line block moved to just after the `:beta` block (257 bytes → 257
bytes), backup present. R5: the file holds exactly the before text plus the probe's one appended
comment line — the move wrote nothing. **No defect in what is written.**

The probe was removed exactly as §12: `src/probe.ts` deleted, `src/main.ts` and
`src-tauri/src/main.rs` restored from pristine copies and compared with `diff` — **`main.ts
IDENTICAL`, `main.rs IDENTICAL`** — and `rg "render_probe|probe_plan|ECFG_PROBE|startProbe"` over
`src`, `src-tauri/src` and `scripts` finds nothing. No git command was run. Re-run afterwards from
the reverted source:

```
npm run check          407 files, 0 errors, 0 warnings
npm test               44 files, 1244 tests
npm run build          168 modules, no svelte/internal/server, no node:async_hooks
```

### 13.6 Verdict

| Item | Verdict |
|---|---|
| the new sentences, both languages | **PASS** — all four renderings whole (412×84 / 382×84 displaced, 412×42 / 399×42 kept), wrapped cleanly, inside the viewport, coherent |
| the displaced arm's attribution | **PASS** — names the asked-for move, says the snippet is still in the file, says what to do; no "changed on disk" above the success panel |
| the kept arm's attribution | **PASS** — same, with the selection surviving |
| the external attribution | **PASS on the driven path** — the old sentence still appears for a genuinely external change (R5); the racing-adoption guard rests on model tests and the reviewed trace |
| the bytes | **PASS** — committed moves write exactly the relocation; the failed send wrote nothing |

**No new finding.** §7.1 is closed by measurement; §7.2, §7.3 and §7.4 remain open exactly as
recorded.
