# Phase 2c-3a step 2 — the window reading

The third of the three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires of every 2c
sub-phase, taken over `src/lib/components/MatchCreator.svelte`, `src/lib/components/MatchDeleter.svelte`
and the `DetailPane.svelte` changes that draw them. The model tests and the two mounted suites are
2c-3a-2's own; this file is the record of **what a screen actually did**. `docs/decisions/2c-3a-2-notes.md`
§4 hole 1 is what it discharges.

**Nothing here was inferred from the test suite.** Every line quoted below came out of a running
WKWebView, and every claim about a file's bytes was checked with `diff -r` and an anchored
byte-for-byte reconstruction — never by reading the panel the application drew about itself.

---

## 1. The setup

The technique is `docs/decisions/1c-1-notes.md` §10 with the constraint of
`docs/decisions/1c-2b-2b-2-notes.md` §6.1 unchanged.

```sh
npm run build
cargo build -p espansoconfig --features custom-protocol
# binary into a hand-assembled espansoConfig.app (Contents/MacOS + Info.plist), ad-hoc signed
open --env "ECFG_PROBE_PLAN=<plan>" \
     --env "XDG_CONFIG_HOME=<scratch>/xdg" \
     --env "HOME=<scratch>/home" \
     --stdout <scratch>/probe.log --stderr <scratch>/probe.err \
     <scratch>/espansoConfig.app
```

**One plan per launch, into a fresh bundle path, over a freshly rebuilt configuration.** **Twelve
launches**, `<scratch>/L1` … `<scratch>/L12`, each with its own `espansoConfig.app`, its own
`XDG_CONFIG_HOME` and its own `HOME`. A temporary `src/probe.ts` drives one plan 700 ms after mount;
a temporary `probe_plan` command reads `ECFG_PROBE_PLAN` and a temporary `render_probe` prints the
transcript to stdout. **All twelve reached their own `--- end` and all twelve `probe.err` were zero
bytes**, so no transcript below is a partial run rounded up to a conclusion.

`2c-2-2-window-reading.md` §1.2's first lesson was applied rather than re-learned: **every plan sets
the language explicitly through the application's own picker**, with a bubbling `change` event. No
launch was lost to a leaked `localStorage` override this time.

The probe reaches the screen the way a person does — `HTMLElement.click()` on a real control, and for
a text box a `value` assignment followed by a bubbling `input` event, which is the path both new
components' `oninput` takes. It reports each element's own `getBoundingClientRect()`, so a control in
the DOM at zero size is not reported as a control that was drawn.

### 1.1 The launches, including the one that was wasted

| # | Plan | What it was for |
|---|---|---|
| L1 | `createOpen` | the creation form as it opens, English — items 1, 2, 7 |
| L2 | `createCommit` | **wasted in part.** The probe read `aria-pressed` on a snippet row; `SnippetList.svelte` writes `aria-current`, so the transcript could not say what was selected after the create. The create itself is not reported from this launch |
| L3 | `createCommit` | the same plan with the probe corrected — item 3 |
| L4 | `deleteTwoPhase` | the question, and cancelling — item 4 |
| L5 | `deleteMiddle` | deleting the middle of three — item 5 |
| L6 | `deleteLast` | deleting the last of three — item 5's fallback |
| L7 | `deleteOnly` | a file holding exactly one snippet — item 6 |
| L8 | `createOpenEs` | the whole creation form in Spanish — item 8 |
| L9 | `deleteEs` | the Spanish twin of L5, question through outcome and notice — item 8 |
| L10 | `deleteOnlyEs` | the Spanish twin of L7 — items 6 and 8 |
| L11 | `createReseed` | *Add another snippet* after a committed create, the committed-form dead-end risk |
| L12 | `createGeometry` | the form's layout against the viewport — §7's finding |

**One failure in twelve, and it was the instrument, not the product** (L2). Nothing failed to launch,
nothing blanked, and no plan had to be abandoned.

### 1.2 The configuration

**Synthetic, hand-written for this run, in a scratch directory outside the repository**, and rebuilt
from scratch before every launch — these screens write files, and a reading must not stand on the
previous launch's bytes. **Eight files**, chosen so that the destination list has one file per
eligibility answer:

| File | What it is for |
|---|---|
| `config/default.yml` | a profile — the `notASnippetFile` destination refusal |
| `match/base.yml` | two neighbouring snippets — the create target, so an insertion has a neighbour to leave alone |
| `match/three.yml` | three snippets — so a deletion has an ordinal for the next one to land on |
| `match/single.yml` | **exactly one** snippet — the consult's Q6 |
| `match/nolist.yml` | a match file whose only top-level key is `global_vars:` — the `noMatchList` refusal |
| `match/broken.yml` | deliberately invalid YAML — the `notParsed` refusal |
| `match/unreadable.yml` | mode `000` — the `couldNotBeRead` refusal, and a sidebar partial total |
| `match/packages/example/package.yml` | a package snippet — the `readOnly` refusal |

`XDG_CONFIG_HOME` and `HOME` both point into that tree. **The owner's real configuration was never
opened**, and nothing below quotes anything but this run's own synthetic content and this
application's own strings.

A pristine copy of the tree (`<scratch>/xdg-before`) was taken before every launch, which is what the
byte checks compare against.

---

## 2. Item 1 — the creation screen draws. **PASS**

L1, English, with nothing selected — which is the case `DetailPane.svelte`'s comment says the opener
has to serve.

```
opener: present
open creator box=658,58,491x617
open head: A new snippet Stop adding
open fields: 4
open f0 "Which file it goes in"           control=destinations box=658,92,491x433
open f1 "Where in that file it goes"      control=select       box=658,532,491x41
open f2 "Trigger"                         control=input        box=658,580,491x78
open f3 "Replacement text"                control=textarea     box=658,665,491x140
open positions: 2 box=658,551,491x22
open position "At the top of the list"    selected=false
open position "At the bottom of the list" selected=true
open triggerBox=658,599,491x22  bodyBox=658,684,491x84
open buttons: … [Stop adding] [config/default.yml DISABLED] [match/base.yml] … [Undo DISABLED]
              [Redo DISABLED] [Add this snippet DISABLED]
open formKind: Choose the file this snippet should be added to.
open panels: 0
```

**All four parts are on a screen with real geometry**: the destination list (491×433), the position
`<select>` (491×22, two options with the End option selected), the trigger `<input>` (491×22), the
body `<textarea>` (491×84), and the create control. The form is 491 px wide and 617 tall in the third
pane, and nothing threw — which is the entire reason this reading exists, because a component that
threw would have produced a blank pane all 1160 tests sail past.

**A disabled create control says why.** `Add this snippet` is disabled and
`browser.matchCreation.cannotCreate.noDestination` is drawn under it as a sentence. That is
`MatchCreator.svelte`'s "every refusal has a code here" on a screen.

**The opener is withdrawn while the form is open.** `Add a snippet` is absent from `open buttons`,
which is `busy` doing what D1 says it does.

---

## 3. Item 2 — every listed file is offered, refused ones included. **PASS**

L1, the same launch. **Eight files listed, eight destination controls, and every refusal drawn as a
localized sentence beside its own control:**

```
open destinations: 8
dest "config/default.yml"     disabled=true  reason="espanso does not load snippets out of this file,
      so a snippet written here would never fire. Choose a snippet file instead."
dest "match/base.yml"         disabled=false reason=NONE
dest "match/broken.yml"       disabled=true  reason="This file could not be read as YAML, so this app
      does not know where a snippet would go in it. Repair the file first."
dest "match/nolist.yml"       disabled=true  reason="This file has no snippet list to add to. Add a
      “matches:” list to it in the file itself, and it can be chosen here afterwards."
dest "match/packages/example/package.yml" disabled=true reason="This app must not write to this file,
      so it cannot add a snippet to it."
dest "match/single.yml"       disabled=false reason=NONE
dest "match/three.yml"        disabled=false reason=NONE
dest "match/unreadable.yml"   disabled=true  reason="This app could not read this file, so it does not
      know what is in it or where a snippet would go. The file list says why it could not be read."
```

**All five members of `DestinationRefusal` reached a screen in one launch** — `notASnippetFile`,
`notParsed`, `noMatchList`, `readOnly`, `couldNotBeRead`. Nothing is omitted: the eight controls
match the eight rows the sidebar draws in the same window (`[All 7] [match/base.yml 2]
[match/broken.yml 0] [match/nolist.yml 0] [match/single.yml 1] [match/three.yml 3]
[match/unreadable.yml Could not be read] [config/default.yml –] [match/packages/example/package.yml 1]`).
That is the consult's Q5 read literally — offered and refused, never silently shorter than the
sidebar.

**One observation, not a defect** (§7.3): the destination list's *order* is not the sidebar's.

---

## 4. Item 3 — a snippet is created, and the identity is adopted. **PASS**

L3. `match/base.yml` chosen, *At the bottom of the list* picked from the position control, `:made`
typed into the trigger and `made body` into the body.

```
positions after destination: 4
position "At the top of the list"    selected=false
position "After :one"                selected=false
position "After :two"                selected=false
position "At the bottom of the list" selected=true
typed buttons: … [Undo] [Redo DISABLED] [Add this snippet]
create control disabled=false
```

**The position control gains one option per anchor the chosen file holds**, named through
`triggerLabel` — `After :one`, `After :two` — which is D5 on a screen. Typing enabled *Undo* and the
create control.

After the click:

```
saved panel0: The file was written. What is on disk now is exactly the text that was sent. A copy of
              this file as it was before this session's first change to it was kept. Only the last ten
              sessions of copies are kept, so this is not a promise that the file can be recovered
              later. This snippet is in the file. The files this form was offering have been written
              to since it opened, so adding another one starts from a fresh reading of them.
              [Add another snippet]
saved buttons: [All 8] [match/base.yml 3] … [Undo DISABLED] [Redo DISABLED]
               [Add this snippet DISABLED] [Add another snippet]
saved listRows: 8
saved list[0] current=null ":one first label"
saved list[1] current=null ":two"
saved list[2] current=true  ":made"
saved list[3] current=null ":pkg"
…
```

**The created snippet is in the list and it is the selection.** `aria-current="true"` sits on `:made`
and on nothing else, which is `adoptTheCreatedSnippet` selecting the identity the command answered.
The sidebar's counts moved with it — `All 7 → All 8`, `match/base.yml 2 → 3`.

**A committed form offers a re-seed and no *Dismiss*.** Every destination control is disabled, the
create control is disabled, and `browser.matchCreation.committed` is drawn; the only live control is
*Add another snippet*.

### 4.1 The bytes

```
$ diff -r <before> <after>
  Only in <after>/espanso: .espansoconfig-backups
  diff -r <before>/espanso/match/base.yml <after>/espanso/match/base.yml
  8a9,10
  >   - trigger: ':made'
  >     replace: made body

before 174 bytes, after 218 bytes
prefix identical:                       True
tail is exactly the inserted two lines: True
reconstruction equal:                   True
carriage returns in after:              0
```

**Exactly one file changed**, exactly two lines were appended, and the whole of the file before the
insertion — the comment line, `matches:`, both existing snippets, the blank line between them, their
quoted scalars — came out byte-for-byte identical. The backup the panel's second sentence discloses is
real and is `cmp`-identical to the file as it was before the save
(`<scratch>/espanso/.espansoconfig-backups/<timestamp>/match/base.yml`, beside its
`.espansoconfig-batch` marker).

### 4.2 The re-seed is not a dead end (L11)

```
committed buttons: … [Add this snippet DISABLED] [Add another snippet]
reseeded panels: 0
reseeded buttons: … [match/base.yml] [match/single.yml] [match/three.yml] …
                    [Undo DISABLED] [Redo DISABLED] [Add this snippet DISABLED]
reseeded trigger value="" readonly=false
reseeded positions: 5
```

The outcome panel is gone, the eligible destinations are enabled again, the boxes are empty and
editable, and **the position control now offers five options** — Front, three anchors and End — over a
file that held two snippets when the form opened and holds three now. So the re-seed really did read
the files as the window had just re-read them, and the committed form has a way out that works.

---

## 5. Items 4, 5 and 6 — the deletion panel

### 5.1 Item 4 — two phases, and cancelling takes it back. **PASS** (L4)

`:one` in `match/base.yml`, selected from the list.

```
detail buttons: … [Show this file’s text] [Add a snippet] [Edit this snippet] [Delete this snippet…]
opened deleter box=658,95,508x192
opened text: Deleting a snippet Leave this alone File match/base.yml Trigger :one Label first label
             Delete this snippet from the file? It is written to disk straight away, and this app
             cannot bring it back afterwards. Delete it Keep it
opened panel0 box=658,209,508x78: Delete this snippet from the file? … Delete it Keep it
opened buttons: … [Show this file’s text] [Leave this alone] [Delete it] [Keep it]
after cancel deleter: ABSENT
after cancel buttons: … [Add a snippet] [Edit this snippet] [Delete this snippet…]
afterCancel list[0] current=true ":one first label"
afterCancel list[1] current=null ":two"
```

**The question is on screen when the panel opens** — one click, not two — inside a bordered panel
78 px tall, with the snippet identified by its file, trigger and label above it. *Keep it* removes the
panel **and closes it**, the pane comes back with its three controls, and the snippet is still
selected and still in the list. `diff -r` over the whole tree after that launch: **no output at all**,
not even a backup directory. A declined deletion wrote nothing.

### 5.2 Item 5 — where the selection lands. **PASS** (L5, and L6 for the fallback)

`match/three.yml`, `:alpha` `:beta` `:gamma`. **`:beta` — ordinal 1 — selected and deleted.**

```
selected before: :beta
opened text: … File match/three.yml Trigger :beta Delete this snippet from the file? … Delete it Keep it
after panel0: The file was written. What is on disk now is exactly the text that was sent. … This
              snippet has been deleted. Nothing more can be deleted from here: pick another snippet in
              the list first. [Done]
after listRows: 2
after list[0] current=null ":alpha"
after list[1] current=true  ":gamma"
after notice: That snippet was deleted. This window has read the file again and selected whatever now
              sits where it was; if the file holds no snippets any more, nothing is selected. [Dismiss]
```

**The selection landed on `:gamma`, which is the snippet now occupying ordinal 1** — the deleted one's
former position — and the localized `deleted` notice is drawn above the panel with its *Dismiss*
control. This sub-phase fails as an identity mistake, and this is the case that would show one: a
window that kept naming `:beta`, or that fell back to the first row, would be visible here. It did
neither.

**The fallback (L6).** `:gamma` — the **last** of three — deleted:

```
after list[0] current=null ":alpha"
after list[1] current=true  ":beta"
after notice: That snippet was deleted. …
```

`Math.min(position, matches.length - 1)` seen from a window: the former ordinal 2 no longer exists, so
the selection lands on the **new last snippet**. Both arms of Q1's rule are on a screen.

**The bytes, both launches:**

```
L5  anchor '  - trigger: ":beta"\n    replace: "beta body"\n'  occurs 1 time
    before 227 bytes, after 181 bytes, expected 181
    RESULT: byte-identical outside the one removed span

L6  anchor '  - trigger: ":gamma"\n    replace: "gamma body"\n' occurs 1 time
    before 227 bytes, after 179 bytes, expected 179
    RESULT: byte-identical outside the one removed span
```

Exactly the two lines of the removed snippet, and nothing else: the comment line, `matches:` and both
surviving snippets came out byte-for-byte unchanged. `diff -r` over each tree reports exactly one
changed file plus one new backup directory.

### 5.3 Item 6 — the only snippet in a file. **PASS** (L7)

`:only` in `match/single.yml`.

```
only deleter box=658,95,508x140
only text: Deleting a snippet Leave this alone File match/single.yml Trigger :only
           This is the only snippet in this file, and emptying a file’s snippet list is not something
           this app does. Delete the file itself instead, outside this app.
only blocked: 658,185,508x50 "This is the only snippet in this file, and emptying a file’s snippet
              list is not something this app does. Delete the file itself instead, outside this app."
only panels: 0
only buttons: … [Show this file’s text] [Leave this alone]
```

**The panel opens with its reason and no question.** `panels: 0` — there is no confirmation panel at
all — and the roll of every button in the window holds **no** *Delete this snippet* and no *Delete it*:
the affordance is withdrawn, the localized `lastSnippet` sentence is drawn inline in a bordered block
508×50 of real drawn text, and *Leave this alone* is the way out. That is the consult's Q6 read
literally.

Note that the opener in the detail pane is **not** withdrawn for such a snippet — *Delete this
snippet…* is drawn, and clicking it is how a person learns why. `MatchDeleter.svelte`'s header says
that is deliberate ("offered whether or not the snippet may be deleted"), and it is what a screen
does.

---

## 6. Item 7 — the two line-ending disclosures. **PASS**

L1 again. These two sentences were added minutes before this reading, to close the code review's
first finding, and had never been seen in a window.

```
open f2 "Trigger" control=input box=658,580,491x78
open f2 disclosure box=658,624,491x34: This box holds one line. A carriage return pasted into it is
        removed rather than turned into a line break, so the text that fires the snippet is what is
        left once it has been taken out.

open f3 "Replacement text" control=textarea box=658,665,491x140
open f3 disclosure box=658,771,491x34: A line break in this box is written as a line feed. A carriage
        return cannot be typed here, and one that is pasted in becomes an ordinary line break.
```

**Two different sentences, each inside its own control's `.field` block, each 491×34 of real drawn
text**, each directly under the control it is about. The trigger's says the character is **removed**;
the body's says a line break is written as a line feed and a pasted carriage return becomes one.
Neither claims what the other measured, which is the whole point of the fix — the shared sentence they
replaced was true of the `<textarea>` and false of the `<input>`.

**The Spanish pair is drawn too** (L8, §8), and the trigger's runs to two lines there (491×51), which
is the sizing rule plan §9 asks for doing its job.

**What this does not establish**, and D6 says so as well: these are *standing* sentences, identical
before a paste and after one. Nothing in this window reacts at the moment a character is altered, and
whether a person reads a sentence under a box is not a claim a DOM transcript can make. §7.2 is a
finding about whether the body's sentence is even **on screen** when the form opens.

---

## 7. What the window showed that is wrong

### 7.1 **Two Spanish words for a snippet, on the same screen at the same moment.** L9

The 2c namespaces call a snippet **`atajo`**; the rest of the interface calls it **`fragmento`**. In
L9 both are drawn in the third pane at once, five lines apart:

```
esAfter panel0: … Este atajo se ha eliminado. Desde aquí ya no se puede eliminar nada más: elige antes
                otro atajo en la lista. Listo
esAfter notice: Ese fragmento se ha eliminado. Esta ventana ha vuelto a leer el archivo y ha
                seleccionado lo que ahora ocupa su lugar; si el archivo ya no contiene fragmentos, no
                hay nada seleccionado. Descartar
```

and the sidebar row above them reads `3 fragmentos` in its tooltip while the panel says `atajo`.

**Counted rather than impressionistic.** Of the **51** Spanish strings this step added, **22 contain
`atajo` and none contains `fragmento`**. At `HEAD` the word `atajo` appears on **27** lines of the
Spanish dictionary and every one of those is inside `browser.matchEditor.*`,
`browser.matchCreation.*` or `browser.matchDeletion.*` — the 2c namespaces. Everything older —
`browser.list.*`,
`browser.detail.*`, `browser.sidebar.*`, `browser.notice.*`, `code.diagnosticCode.*` — says
`fragmento`.

**So the split predates this sub-phase and this sub-phase widened it**, and 2c-3a-2 is the first step
whose screens draw both words *simultaneously*, because the deletion outcome and the selection notice
occupy the same pane. It is a localization defect, not a data risk; nothing is written differently and
no English string is affected. **Severity: medium** — it is the kind of inconsistency a Spanish reader
notices immediately and no parity test can see, since both files have every key and neither value is
identical to the other language's.

No fix was applied here: choosing between the two words is a decision about 27 + 22 existing strings
across four sub-phases, and changing any of them obliges a re-taken reading.

### 7.2 **The create control is below the fold when the form opens.** L12, measured — **FIXED, and re-measured in §12**

```
viewport 1180x728
detail  box=644,44,536x645  scrollH=819 clientH=645 overflowY=auto
creator box=658,58,491x617  scrollH=805 clientH=617 overflowY=visible
destinations box=658,135,491x390
create control box=768,813,121x27  insideViewport=false
after scroll: paneScrollTop=174 create box=768,639,121x27 insideViewport=true
```

On the **default window size** (`tauri.conf.json` says 1180×760; the webview is 1180×728) with
**eight** files listed, the form is 805 px tall inside a 645 px pane. *Add this snippet* sits at
y = 813, **85 px below the bottom of the viewport**, and so does the body's line-ending disclosure
(y = 771). The bottom ~40 px of the `<textarea>` is cut too.

It is **not a dead end**: the pane's `overflow-y: auto` is real, scrolling it 174 px brings the create
control fully into view, and a person can scroll. But a form whose submit control is off-screen on
open, with nothing on screen saying the form continues, is a real thing a screen does that no model
test and no jsdom test can fail for — jsdom has no layout at all.

**It scales with the file count, which is the part that matters.** The destination list is one full
control per listed file with no bound and no scroller of its own — 390 px for eight files here. The
owner's configuration has thirteen (`1c-2b-2b-2-notes.md` §8), which would push the create control a
further ~200 px down. `2c-3a-2-notes.md` hole 4 names the unbounded `after` `<select>`; the unbounded
**destination list** is its sibling and is not named anywhere. **Severity: medium** — usability, not
correctness.

**Fixed on 2026-08-03, and the fix was re-measured in a window rather than reasoned about.**
`MatchCreator.svelte`'s destination list now has a maximum height and scrolls inside itself, and its
action row is `position: sticky; bottom: 0`. **§12 is the re-take** and holds every new number: at
eight files the create control is at y = 594 inside a pane whose content ends at y = 675, and at
**fourteen** files it is at the same y = 594, because the list's height no longer depends on the file
count. The measurements above are left exactly as they were taken — they are what the screen did
before the change.

### 7.3 The destination list's order is not the sidebar's. Observation, not a defect claim

```
sidebar order:      match/base.yml · match/broken.yml · match/nolist.yml · match/single.yml ·
                    match/three.yml · match/unreadable.yml · config/default.yml ·
                    match/packages/example/package.yml
destination order:  config/default.yml · match/base.yml · match/broken.yml · match/nolist.yml ·
                    match/packages/example/package.yml · match/single.yml · match/three.yml ·
                    match/unreadable.yml
```

`destinationsOf` maps `BrowserState.documents` in order and `Sidebar.svelte` regroups that list into
FILES / PROFILES / PACKAGES, so **both panes are correct and neither doc is wrong** —
`MatchCreator.svelte` and `2c-3a-2-notes.md` §2.4 both say "in window order", which is the document
list's order and is exactly what is drawn. What a person sees, however, is the same eight files in two
different orders in two panes of one window, with the profile first in one and seventh in the other.
Recorded because it was seen, not because anything in the code contradicts a record.

### 7.4 The raw-text toggle is not withdrawn while the new screens are open. Confirmed, known

`2c-3a-2-notes.md` hole 13 predicted that "a window reading would be right to flag" this. It is on
screen in every deletion launch:

```
opened buttons: … [Show this file’s text] [Leave this alone] [Delete it] [Keep it]
only buttons:   … [Show this file’s text] [Leave this alone]
```

and, after a committed create selects the new snippet, in the creation form too
(`saved buttons: … [Show this file’s text] [Stop adding] …`). The consequence is exactly what the hole
says — cosmetic, because the four write surfaces outrank the viewer in the `{#if}` chain, so the
toggle changes nothing while one is open. **Severity: low**, and its fix is scoped out for the stated
reason (it would change what the small editor draws and oblige a re-take of that reading).

---

## 8. Item 8 — both languages

### 8.1 The creation form in Spanish (L8)

```
open head: Un atajo nuevo Dejar de añadir
open f0 "En qué archivo va"               control=destinations box=658,92,491x433
open f1 "En qué lugar de ese archivo va"  control=select       box=658,532,491x41
open f2 "Disparador"                      control=input        box=658,580,491x96
open f2 disclosure box=658,624,491x51: Esta caja contiene una sola línea. Un retorno de carro que se
        pegue aquí se elimina en lugar de convertirse en un salto de línea, así que el texto que
        activa el atajo es el que queda una vez quitado.
open f3 "Texto de sustitución"            control=textarea     box=658,682,491x140
open f3 disclosure box=658,789,491x34: Un salto de línea en esta caja se escribe como avance de
        línea. Aquí no se puede escribir un retorno de carro, y el que se pegue se convierte en un
        salto de línea normal.
open position "Al principio de la lista" selected=false
open position "Al final de la lista"     selected=true
open formKind: Elige el archivo al que debe añadirse este atajo.
open buttons: … [Dejar de añadir] [config/default.yml DISABLED] … [Deshacer DISABLED]
              [Rehacer DISABLED] [Añadir este atajo DISABLED]
```

**All five destination refusals are drawn in Spanish as well** — `espanso no carga atajos de este
archivo…`, `Este archivo no se ha podido leer como YAML…`, `Este archivo no tiene una lista de atajos
a la que añadir. Añádele una lista «matches:»…`, `Esta aplicación no debe escribir en este archivo…`,
`Esta aplicación no ha podido leer este archivo…`. The layout is 491 px wide as in English and the
trigger's disclosure grows to two lines, which is the no-fixed-width rule working.

### 8.2 The deletion panel in Spanish, question through outcome (L9)

```
esOpen text: Eliminación de un atajo Dejarlo como está Archivo match/three.yml Disparador :beta
             ¿Eliminar este atajo del archivo? Se escribe en el disco de inmediato y esta aplicación
             no puede recuperarlo después. Eliminarlo Conservarlo
esAfter panel0: Se ha escrito el archivo. Lo que hay ahora en el disco es exactamente el texto que se
             envió. Se ha guardado una copia de este archivo tal y como estaba antes del primer cambio
             de esta sesión. … Este atajo se ha eliminado. Desde aquí ya no se puede eliminar nada
             más: elige antes otro atajo en la lista. Listo
esAfter list[0] current=null ":alpha"
esAfter list[1] current=true  ":gamma"
esAfter notice: Ese fragmento se ha eliminado. …
```

The Spanish twin of §5.2 behaves identically, selection included, and its bytes are the same:
`before 227 bytes, after 181 bytes, RESULT: byte-identical outside the one removed span`. §7.1 is the
finding this transcript carries.

### 8.3 The last-snippet refusal in Spanish (L10)

```
esOnly blocked: 658,185,508x50 "Este es el único atajo de este archivo, y vaciar la lista de atajos de
                un archivo no es algo que haga esta aplicación. Elimina el archivo entero fuera de la
                aplicación."
esOnly panels: 0
esOnly buttons: … [Mostrar el texto de este archivo] [Dejarlo como está]
```

Same shape as English, same geometry to the pixel, no question, no delete control.

---

## 9. What this evidence is, and what it is not

**Is:** what WebKit actually laid out and rendered in the real application's webview — including each
control's own rectangle and, in L12, the pane's scroll geometry — plus what `diff -r` and an anchored
byte-for-byte reconstruction say about the bytes on disk on each side of every save.

**Is not**, carrying `2c-2-2-window-reading.md` §16 forward and adding this sub-phase's own gaps:

1. **Pixels.** The probe reads the DOM and layout geometry. It cannot see a control painted
   white-on-white, a `z-index` accident or a font that failed to load. Unchanged since `1c-1-notes.md`
   §10.3.
2. **Pointer hit-testing and real keystrokes.** `HTMLElement.click()` takes the same path into
   `onclick` a user's click takes, and a `value` assignment plus a bubbling `input` event is the
   component's path — neither is the input method's. Composition, autocorrect and IME are untested,
   and **no carriage return was actually pasted into either new box**: §6 reads the two disclosures,
   it does not re-measure what §6 of the previous reading measured.
3. **Every outcome arm.** Only `saved` was provoked, in both components. **A conflict, a `refused`
   verdict with findings, `findingsAreStale`, `sendFailed`, `mayHaveWritten` and
   `createdNotIdentified` were all left undriven**, so those strings — and the *Save anyway* →
   re-raise round trip that `MatchDeleter.svelte` describes — have **model-suite and mounted-test
   evidence only**.
4. **`confirmationRefused` was not provoked**, so `browser.matchDeletion.confirmationRefused` has
   never been on a screen. Reaching it needs the window to re-read the file between the question and
   the answer, which this probe has no path to.
5. **`notInDocument`** is unreachable from the running screen by construction
   (`2c-3a-2-notes.md` hole 6), and it was not reached here either.
6. **The leaving confirmation was not driven.** `browser.matchCreation.discardWarning`,
   `discard` and the *Keep editing* control beside them were not seen; nor were the in-flight
   sentences (`saving`, `savingCannotBeStopped`, `deleting`, `deletingCannotBeStopped`), which are
   transient and the probe never sampled during a send.
7. **Undo and redo were not clicked.** *Undo* was observed becoming enabled after typing (§4) and
   disabled again after a commit; nothing here establishes what pressing it does.
8. **`code.commandError.documentHasNoMatchList`** — the *command's* error — was not provoked. What
   §3 shows is its frontend twin, the `noMatchList` destination refusal, which is a different string
   computed from the projection.
9. **The delete opener's absence for a file whose read refused** (`2c-3a-2-notes.md` hole 5) was not
   examined; that file has no snippets to select, so there was nothing to click.
10. **The real configuration.** Never opened, deliberately (§1.2).

---

## 10. Verdict

| Item | Verdict |
|---|---|
| 1 — the creation screen draws | **PASS** — destination list, position control, both boxes and the create control, all with real geometry; a disabled create control says why |
| 2 — every listed file offered | **PASS** — eight files, eight controls, all five `DestinationRefusal` members drawn as localized sentences; nothing omitted |
| 3 — a snippet is created and adopted | **PASS** — `:made` in the list, `aria-current` on it and nothing else, counts moved, byte-identical outside the two inserted lines, backup real |
| 4 — the confirmation is two-phase | **PASS** — the question is drawn on open, *Keep it* takes it back and closes, nothing written at all; *Delete it* deletes |
| 5 — the selection after a committed delete | **PASS** — lands on the snippet at the deleted one's former ordinal (`:beta` → `:gamma`), falls back to the new last (`:gamma` → `:beta`), localized notice both times, byte-identical outside the removed span |
| 6 — refused for a file holding one snippet | **PASS** — no question, no delete control anywhere in the window, the localized reason inline in a 508×50 block |
| 7 — the two line-ending disclosures | **PASS** — two different sentences, each in its own control's block, each real drawn text; **but see §7.2**, the body's is below the fold when the form opens |
| 8 — both languages | **PASS** — the whole creation form, all five refusals, the deletion question, the outcome, the spent sentence, the notice and the last-snippet refusal all read in Spanish; **§7.1 is what that reading found** |

**Three findings and one confirmed known hole.** §7.1 (Spanish `atajo`/`fragmento` on one screen,
medium), §7.2 (the create control below the fold on a default window, medium — **fixed 2026-08-03,
re-measured in §12**), §7.3 (the two panes list the same files in two orders, observation), §7.4 (the
raw-text toggle not withdrawn — hole 13, seen).

**No defect was found in what is written.** Every save this reading provoked wrote exactly the span it
was asked to and left every other byte of the file alone, and every launch that was not supposed to
write wrote nothing at all — not even a backup directory.

---

## 11. The probe, and its removal

`src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored from copies taken
**before** the probe existed and compared with `diff`: **`main.ts IDENTICAL`, `main.rs IDENTICAL`**.
`git status --short --untracked-files=all` afterwards is the status this reading started from — the
same twelve modified files and the same seven untracked ones, with **no probe file and no probe
artefact** — plus this record, which is the eighth untracked file and the only thing this reading
added to the tree. Every scratch path lived outside the repository.

`dist/` was rebuilt from the reverted source and came back to **165 modules**, the count
`2c-3a-2-notes.md` §3 rebaselined to, with **no `svelte/internal/server` and no `node:async_hooks`**
in the bundle. During the reading it was 166 — 165 plus `probe.ts`, which is the "moved by exactly the
number of new source modules" shape rather than the jump to ~180 that means the `resolve.conditions`
regression.

Re-run afterwards, all passing and all unchanged from the pre-reading figures:

```
npm test               42 files, 1160 tests
npm run check          403 files, 0 errors, 0 warnings
npm run build          165 modules
cargo test --workspace 1008 passed, 0 failed
```

---

## 12. The re-take of 2026-08-03 — §7.2 fixed, and the plans it touched run again

**A window reading is re-taken after any change to a component** (CLAUDE.md §6). §7.2's finding was
fixed in `src/lib/components/MatchCreator.svelte`, so the plans that measured the creation form's
geometry were run again in a real window. **Nothing above this section has been edited except the
two pointers into here** — §7.2's own heading and the paragraph that closes it — because a reading is
a record of a screen at a moment and rewriting one to match later code would be inventing evidence.

### 12.1 What was changed

Two rules in `MatchCreator.svelte`, plus one wrapper element in its markup. **No model file, no
dictionary key, no Rust.**

- **`.destinations` is bounded**: `max-height: 12rem; overflow-y: auto`. The list is the same height
  at eight files and at fourteen; what changes is how far it scrolls. **Nothing is omitted and no
  sentence is truncated** — omitting a file or clipping a refusal would reintroduce exactly the
  finding the design consult's Q5 exists to prevent, which would be worse than the defect.
- **The action row is `position: sticky; bottom: 0`**, with an opaque background. `.creator` is a
  flex item that shrinks to the pane's height with its content overflowing, so its content box bottom
  *is* the bottom of what the pane shows, and `bottom: 0` clamps the row to exactly there.
- **The create control and the sentence saying why it is disabled are now one block**, so that a row
  pinned to the bottom cannot leave its own reason above the fold. That is what the new wrapper is.

Both are layout. **There is no new condition in the markup about what may be created or when a save
may start**, and no new user-facing string — a bounded list needs no sentence, because nothing about
what the list contains changed.

### 12.2 The launches

Same technique and same constraint as §1: `npm run build`, `cargo build -p espansoconfig --features
custom-protocol`, the binary into a hand-assembled ad-hoc-signed `espansoConfig.app`, launched
through LaunchServices with `ECFG_PROBE_PLAN`, `XDG_CONFIG_HOME` and `HOME` — **one plan per launch,
into a fresh bundle path, over a freshly built configuration**, and the language set **through the
application's own picker** with a bubbling `change` event.

**Six launches, six transcripts, six `--- end` markers, and six zero-byte `probe.err` files. None
failed.** No launch was lost to a leaked `localStorage` override, none blanked and no plan was
abandoned.

| # | Plan | Files | What it was for |
|---|---|---|---|
| R1 | `geometry` | 8 | the create control's position on open — the re-take's item 1 |
| R2 | `disclosures` | 8 | both line-ending sentences, each in its own control's block — item 2 |
| R3 | `destinations` | 8 | every destination reachable, every refusal readable — item 3 |
| R4 | `geometryMany` | **14** | the same geometry with more files than the owner's thirteen — item 4 |
| R5 | `disclosures:es` | 8 | Spanish, which is the taller of the two and so the fit's real test |
| R6 | `sticky` | 8 | the sticky row under a form deliberately made taller than the pane |

The configuration was **synthetic and hand-written for this run**, in a scratch directory outside the
repository, rebuilt from scratch before every launch. It is §1.2's eight-file set — one file per
destination-eligibility answer — and R4 adds **six further eligible snippet files** to it, for
fourteen. **The owner's real configuration was never opened**, and nothing below quotes anything but
this run's own synthetic content and this application's own strings.

### 12.3 Item 1 — the create control is visible on open. **PASS** (R1)

```
viewport 1180x728
detail  box=644,44,536x645 scrollH=645 clientH=645 scrollTop=0
creator box=658,58,508x587 scrollH=587 clientH=587
destinations box=658,135,508x168 scrollH=390 clientH=168 overflowY=auto
destination controls: 8
actions box=658,591,508x54 position=sticky
create control box=768,594,121x27 disabled=true insideViewport=true
refusal box=658,624,508x17: Choose the file this snippet should be added to.
```

**The pane no longer scrolls at all**: `scrollHeight` **645** against `clientHeight` 645, where §7.2
measured 819 against 645. The form is **587 px tall** where it was 805, inside a pane whose content
runs y = 58 to y = 675 — **617 px of room and 30 px to spare**. *Add this snippet* is at **y = 594**
(y = 813 before), fully inside the viewport, and the sentence saying why it is disabled is at y = 624,
on screen with it.

The list is doing exactly what it was bounded to do: `clientH` **168** against a `scrollH` of **390**,
`overflow-y: auto`, and **eight** destination controls in it — the same eight §3 read, none dropped.

The form is 508 px wide here rather than §2's 491 because the pane no longer needs a scrollbar.

### 12.4 Item 2 — both line-ending disclosures are still drawn, and now on screen. **PASS** (R2)

```
trigger box=658,376,508x22 insideViewport=true
trigger disclosure box=658,402,508x34 insideViewport=true: This box holds one line. A carriage return
        pasted into it is removed rather than turned into a line break, so the text that fires the
        snippet is what is left once it has been taken out.
replace box=658,462,508x84 insideViewport=true
replace disclosure box=658,549,508x34 insideViewport=true: A line break in this box is written as a
        line feed. A carriage return cannot be typed here, and one that is pasted in becomes an
        ordinary line break.
```

Two different sentences, each **found by walking up from its own box to that box's `.field` block**
and taking the sentence inside it — so the pairing is measured, not assumed — each 508×34 of real
drawn text. **The body's disclosure is now on screen when the form opens**: y = 549, where §7.2
measured y = 771 and off the viewport. That is the half of §7.2's finding §6 flagged.

### 12.5 Item 3 — every destination still reachable, every refusal still whole. **PASS** (R3)

```
destinations: 8
list clientH=168 scrollH=390 scrollTop=0
dest[0] "config/default.yml"     disabled=true  visibleWithoutScrolling=true  reason="espanso does not
        load snippets out of this file, so a snippet written here would never fire. Choose a snippet
        file instead."
dest[1] "match/base.yml"         disabled=false visibleWithoutScrolling=true  reason=NONE
dest[2] "match/broken.yml"       disabled=true  visibleWithoutScrolling=true  reason="This file could
        not be read as YAML, …"
dest[3] "match/nolist.yml"       disabled=true  visibleWithoutScrolling=false reason="This file has no
        snippet list to add to. …"
dest[4] "match/packages/example/package.yml" disabled=true visibleWithoutScrolling=false
        reason="This app must not write to this file, so it cannot add a snippet to it."
dest[5] "match/single.yml"       disabled=false visibleWithoutScrolling=false reason=NONE
dest[6] "match/three.yml"        disabled=false visibleWithoutScrolling=false reason=NONE
dest[7] "match/unreadable.yml"   disabled=true  visibleWithoutScrolling=false reason="This app could
        not read this file, so it does not know what is in it or where a snippet would go. The file
        list says why it could not be read."
after list scroll: scrollTop=222 last box=658,242,491x61 insideList=true insideViewport=true
after list scroll: last reason height=34 text="This app could not read this file, so it does not know
        what is in it or where a snippet would go. The file list says why it could not be read."
```

**All eight are in the list and all five `DestinationRefusal` members are still drawn in full.** Three
are inside the list's own box without scrolling; **the other five were reached by scrolling the list
itself** — `scrollTop` 0 → 222, which is the whole of its 390 − 168 range — and the last of them,
`match/unreadable.yml`, then sits **inside the list and inside the viewport**, with its refusal 34 px
of real drawn text and the sentence complete to its final word. So the bound costs a scroll and
hides nothing, which is the condition this fix had to meet.

### 12.6 Item 4 — fourteen files, and the create control does not move. **PASS** (R4)

```
sidebar rows: 15
detail  box=644,44,536x645 scrollH=645 clientH=645 scrollTop=0
creator box=658,58,508x587 scrollH=587 clientH=587
destinations box=658,135,508x168 scrollH=570 clientH=168 overflowY=auto
destination controls: 14
actions box=658,591,508x54 position=sticky
create control box=768,594,121x27 disabled=true insideViewport=true
```

**Fourteen destination controls — one more than the owner's thirteen — and every number outside the
list is identical to R1's**: the form is still 587 px, the pane still does not scroll, and the create
control is still at **y = 594**. Only the list's `scrollHeight` moved, 390 → **570**. That is the
property §7.2 said was missing, measured rather than argued: the form's height no longer depends on
how many files a person has.

### 12.7 Spanish, which is the taller of the two. **PASS** (R5)

```
creator box=658,58,508x604 scrollH=604 clientH=604
destinations box=658,135,508x168 scrollH=390 clientH=168 overflowY=auto
actions box=658,608,508x54 position=sticky
create control box=815,611,125x27 disabled=true insideViewport=true
refusal box=658,641,508x17: Elige el archivo al que debe añadirse este atajo.
trigger disclosure box=658,402,508x51: Esta caja contiene una sola línea. …
replace disclosure box=658,566,508x34: Un salto de línea en esta caja se escribe como avance de línea. …
```

The Spanish form is **604 px** against the same 617 px of room — it fits, and the create control is at
y = 611 with its refusal at y = 641, both on screen. **The margin is 13 px and this record says 13
rather than "comfortably".** The trigger's disclosure runs to two lines here (508×51) as §8.1 found,
which is where the extra 17 px goes. A longer translation, a larger system font or one more sentence
in this form would consume that margin — which is why the sticky row exists and why §12.8 was taken.

### 12.8 The sticky row, provoked. **PASS** (R6)

Bounding the list is what makes the form fit *today*; the sticky row is what is supposed to hold when
it does not. So one launch made it not fit, by growing the replacement box — which `resize: vertical`
lets a person do with the handle — from its default height to 24 rows.

```
before growing the body:
detail  box=644,44,536x645 scrollH=645 clientH=645
creator box=658,58,508x587 scrollH=587 clientH=587
create control box=768,594,121x27 insideViewport=true

after growing the body:
detail  box=644,44,536x645 scrollH=838 clientH=645
creator box=658,58,491x617 scrollH=824 clientH=617
destinations box=658,135,491x168 scrollH=390 clientH=168 overflowY=auto
actions box=658,621,491x54 position=sticky
create control box=768,624,121x27 disabled=true insideViewport=true
refusal box=658,654,491x17: Choose the file this snippet should be added to.
```

**824 px of form inside a 617 px box — a worse overflow than the 805 px §7.2 recorded — and the create
control is at y = 624, on screen, with its reason at y = 654 on screen beside it.** The pane really is
overflowing (`scrollHeight` 838 against 645, and the form has narrowed to 491 because the scrollbar is
back), and the row pinned itself to the bottom of what the pane shows rather than travelling off it.

**What this provocation is**: setting the `<textarea>`'s `rows` attribute, which produces the same
layout condition a drag of the resize handle produces. It is not a drag, and no pointer was used.

### 12.9 What this re-take did not establish

Stated as gaps, not rounded up:

1. **Nothing was saved.** No launch of this re-take clicked *Add this snippet*, so no bytes were
   written and none were checked. §4.1's byte evidence stands as taken; this change is two CSS rules
   and a wrapper element and touches nothing that decides what is written, but that is a reading of
   the diff and not a measurement.
2. **The Spanish destination list was not re-read.** R5 read the Spanish geometry and both Spanish
   disclosures; §8.1's five Spanish refusals were not re-listed, and §12.5's reachability claim is
   English only.
3. **Pixels, pointer hit-testing and real keystrokes** — §9 items 1 and 2, unchanged. In particular
   **no scroll gesture was used**: R3 scrolled the list by assigning `scrollTop`, which is not a
   trackpad, and whether the bounded list *looks* scrollable to a person who has not tried is a
   question no DOM transcript can answer. macOS draws overlay scrollbars only while scrolling.
4. **Every other item of §§2–8 was not re-run**, deliberately: the change touches the creation form's
   layout, and the plans it does not touch were left as they were taken.
5. **One number is a margin and not a guarantee.** §12.7 measures 13 px of slack in Spanish at the
   default window size. Nothing in this repository fails if a future sentence consumes it; §12.8 is
   the evidence that the create control survives when it is consumed, and that is the whole of what
   is promised.

### 12.10 The probe, and its removal — again

`src/probe.ts` was deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored from copies taken
**before** this re-take's probe existed and compared with `diff`: **`main.ts IDENTICAL`,
`main.rs IDENTICAL`**. `rg 'render_probe|probe_plan|ECFG_PROBE|startProbe' src src-tauri/src scripts`
finds nothing. Every scratch path — the six bundles, the six configurations, the six `HOME`s — lived
outside the repository.

Re-run afterwards from the reverted source:

```
npm run check          403 files, 0 errors, 0 warnings
npm test               42 files, 1160 tests
npm run build          165 modules
cargo test --workspace 1008 passed, 0 failed
```

**The module guard is unmoved at 165**, with no `svelte/internal/server` and no `node:async_hooks` in
the bundle — a CSS rule and a wrapper `<div>` add no module. During the re-take it was **166**, which
is 165 plus `probe.ts`.
