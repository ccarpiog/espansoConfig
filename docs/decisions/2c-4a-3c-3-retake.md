# Phase 2c-4a step 3c-3 — the re-take, six write surfaces, both languages

`docs/decisions/2c-4a-3c-2-window-reading.md` §10 found one High, two Mediums and two Lows, and
§12 closed with *"Step 3c-3 owes the fixes for §10.1–§10.5 and a re-take of this reading over every
component it changes."* This file is that re-take. The fixes and their reasoning are
`docs/decisions/2c-4a-3c-3-notes.md`; **this file is only what a screen did afterwards.**

**The standing rule this project pays every time**: a window reading is re-taken after any change
to a component. The scroll fix touches **all six** write surfaces, the label fix touches the three
operation-choice panels, and the sentence fixes touch the raw editor and the creator — so the
re-take covers six surfaces in two languages, and the instrument was not re-derived
(`docs/decisions/2c-4a-3c-1-instrument.md`).

**Nothing here was inferred from the test suite.** Every rectangle below is an element's own
`getBoundingClientRect()`, every `scrollTop` is the real `section.detail`'s, and every claim about
a file's bytes is a whole-tree comparison against a pristine copy taken immediately before that
launch.

---

## 1. What this step added to the instrument

Three additions, all in `src/probe.ts`, all temporary and all for measuring the fix rather than for
reaching it.

1. **`reportGeometry` prints the application's own scroll position first.** A new
   `<what> reveal: section.detail scrollTop=… scrollHeight=… clientHeight=…` line, emitted **before**
   the probe touches any scroller. 3c-2's §10.3 was *`scrollTop` is `0` when the panel appears and no
   code moves it*; this line is the re-take's primary measurement and it has to be taken before the
   instrument intervenes. `belowTheFold` is now joined by `topInView`.
2. **A `noscroll` flag.** A reading that scrolls the pane to its end and *then* walks the reload
   cannot say where the application put the confirmation control, because the probe moved the
   viewport first. §10.4 is exactly that measurement, so every launch of this re-take carries
   `noscroll` and forgoes 3c-2's *can it be reached by hand* half — which 3c-2 already answered
   **yes** for all six.
3. **A `nowriter` flag, and geometry for a panel that is not a conflict.** `outcomeReveal` answers
   `panel` for **every** arm of a save outcome, so the *committed* panel that
   `2c-3c-3-window-reading.md` §10.2 recorded as its own Low moves with the conflict's Medium. A
   plan with no second writer produces a committed save; `afterTheConflict` now measures a
   non-conflict panel too instead of returning. **These two launches write the synthetic file**,
   deliberately, and are this re-take's control on the byte check (§4.2).

`<scratch>/launch.sh` gained only a comment: its flag list now names `crlf`, `truncate` and
`noscroll`, which 3c-2 had used without documenting.

## 2. The launches

Sixteen, L33 through L48, continuing 3c-2's numbering. **All sixteen reached their own `--- end`
and all sixteen `probe.err` files were zero bytes.** Eight English, six Spanish, and the two
committed-save controls English.

| # | Plan | Lang | What it was for | Result |
|---|---|---|---|---|
| L33 | `editorconflict:en:reload:noscroll` | en | §10.3's own surface, and §10.4 | conflict; panel **y = 44**, `scrollTop` 676 |
| L34 | `editorconflict:es:reload:noscroll` | es | the Spanish twin — where the panel was wholly invisible | conflict; panel **y = 44**, `scrollTop` 727 |
| L35 | `rawconflict:en:reload:noscroll` | en | the raw editor | conflict; panel y = 111, `scrollTop` 258 |
| L36 | `rawconflict:es:reload:noscroll` | es | the Spanish twin, and the authored-text label | conflict; *Seguir editando* kept |
| L37 | `creatorconflict:en:reload:noscroll` | en | §10.6's English line, and §10.4 | conflict; *drafted against*; confirm **in view** |
| L38 | `creatorconflict:es:reload:noscroll` | es | **§10.1, the High** | conflict; *se redactó sobre*; confirm **in view** |
| L39 | `deleterconflict:en:reload:noscroll` | en | §10.2 | conflict; *Leave this as it is* |
| L40 | `deleterconflict:es:reload:noscroll` | es | the Spanish twin | conflict; *Dejarlo como está* |
| L41 | `moverconflict:en:after:reload:noscroll` | en | §10.2, and the mover's own confirmation-step field | conflict; *Leave this as it is* |
| L42 | `moverconflict:es:after:reload:noscroll` | es | the Spanish twin | conflict; *Dejarlo como está* |
| L43 | `duplicatorconflict:en:reload:noscroll` | en | §10.2 | conflict; *Leave this as it is* |
| L44 | `duplicatorconflict:es:reload:noscroll` | es | the Spanish twin | conflict; *Dejarlo como está* |
| L45 | `rawconflict:en:crlf:reload:noscroll` | en | **§10.5** | conflict; reload-specific refusal, confirm disabled |
| L46 | `rawconflict:es:crlf:reload:noscroll` | es | the Spanish twin | conflict; the same, in Spanish |
| L47 | `rawconflict:en:nowriter:noscroll` | en | the **committed** panel, and the byte check's control | **saved**; the file was written |
| L48 | `editorconflict:en:nowriter:noscroll` | en | the committed panel on the surface §10.3 was about | **saved**; panel revealed, `scrollTop` 188 |

---

## 3. What the window showed, finding by finding

### 3.1 §10.1 — the Spanish creator line. **CLOSED**

The High was a false claim about whether the person's file had been written, four lines under the
sentence that says it was not. L38, the same panel, lines [0] and [4] as `reportPanel` printed them:

```
creator outcome [0] p box=667,52,472x17:
    No se ha escrito nada. El archivo del disco sigue exactamente igual.
creator outcome [4] p box=667,227,472x34:
    Este fragmento se redactó sobre la versión 50a2bbc3….
```

*se redactó* is a verb of composing, in the family the five siblings use — the editor's *se cargó
desde*, the deleter's *se leyó de*, the mover's and duplicator's *se decidió sobre*. There is no
longer a sentence on that panel claiming the snippet was written.

**And the English moved with it** (§10.6, an Observation the reading asked 3c-3 to decide
deliberately). L37, the same two lines:

```
creator outcome [0] p: Nothing was written. The file on disk is exactly as it was.
creator outcome [4] p: This snippet was drafted against version 50a2bbc3….
```

*written against* was correct and was the only one of the six that used *written* at all on a panel
opening with *Nothing was written*; the reading called it *"the reason §10.1 was easy to
mistranslate"*. It is now *drafted against*, which is the same claim in the siblings' family. The
decision and its alternative are `2c-4a-3c-3-notes.md` §2.1.

**What a test now holds, and what it does not**: `dictionaries.test.ts` fails if **any** of the six
`*.revisionExpected` values, in **either** locale, uses a verb of writing, and it keeps that word
list falsifiable against the panel's own *nothing was written* sentence. It cannot say that
*redactó* or *drafted* is the right word — no test in this repository pins meaning. The mutation
check is §5.1.

### 3.2 §10.2 — *Keep editing* where nothing is being edited. **CLOSED**

The three operation-choice panels draw a label of their own now, and the three authored-text
surfaces are untouched. Read off the roll of controls, which prints every button's own text:

```
L39 deleter    button box=667,698,108x23 "Leave this as it is"     "Load the version on disk"
L40 deleter    button box=667,698,113x23 "Dejarlo como está"       "Cargar la versión del disco"
L41 mover      button box=667,714,108x23 "Leave this as it is"
L42 mover      button box=667,715,113x23 "Dejarlo como está"
L43 duplicator button box=667,698,108x23 "Leave this as it is"
L44 duplicator button box=667,698,113x23 "Dejarlo como está"
```

**The authored-text label is unchanged on all three surfaces that draft text**, which is the other
half of the finding and the half a careless fix would have broken:

```
L33 editor     button box=667,1057,83x23  "Keep editing"      "Copy my text"
L34 editor     button box=667,1057,101x23 "Seguir editando"   "Copiar mi texto"
L35 raw editor button                     "Keep editing"      "Copy my text"
L36 raw editor button box=667,658,101x23  "Seguir editando"   "Copiar mi texto"
L37 creator    button box=667,820,83x23   "Keep editing"      "Copy my text"
L38 creator    button box=667,820,101x23  "Seguir editando"   "Copiar mi texto"
```

The capability lists are still 3/3/3/2/2/2 — the copy is still absent on exactly the three surfaces
whose `draftKind` is `operationChoice`, which is consult Q4 unchanged.

### 3.3 §10.3 — the panel below the fold. **CLOSED, on all six, in both languages**

The Medium: at 1180 × 728 the match editor's panel opened at **y = 720** in English and **y = 771**
in Spanish, 1 044 px tall, with `section.detail`'s `scrollTop` at `0` and nothing moving it — eight
pixels of a panel in one language and none of it in the other, and what was invisible was the
statement that nothing had been written. Every other surface put its **controls** below 728.

Measured again, with `noscroll`, so every number below is the application's own:

| Surface | Lang | Panel then (3c-2) | Panel now | `.detail` `scrollTop` then → now | `topInView` |
|---|---|---|---|---|---|
| match editor | en (L33) | y = **720** | **y = 44** | 0 → **676** | true |
| match editor | es (L34) | y = **771** | **y = 44** | 0 → **727** | true |
| raw editor | en (L35) | y = 369 | y = 111 | 0 → **258** | true |
| raw editor | es (L36) | — | y = 111 | 0 → **258** | true |
| creator | en (L37) | y = 591 | **y = 44** | 0 → **547** | true |
| creator | es (L38) | — | **y = 44** | 0 → **564** | true |
| deleter | en (L39) | y = 209 | **y = 44** | 0 → **165** | true |
| deleter | es (L40) | — | **y = 44** | 0 → **165** | true |
| mover | en (L41) | y = 469 | **y = 44** | 0 → **425** | true |
| mover | es (L42) | — | **y = 44** | 0 → **442** | true |
| duplicator | en (L43) | y = 328 | **y = 44** | 0 → **284** | true |
| duplicator | es (L44) | — | **y = 44** | 0 → **284** | true |

`belowTheFold=false` and `topInView=true` on all twelve. **The 51 px Spanish difference no longer
matters**: the panel's top is placed at the scrollport's top in both languages, so the surface's own
height above it is scrolled past rather than added to the panel's offset.

The raw editor lands at y = 111 rather than y = 44 because its scroller runs out — `scrollHeight`
903 against `clientHeight` 645 gives a maximum `scrollTop` of 258, which is exactly what it holds.
That is the panel as high as this layout allows, with every edge in view.

**This is a visual fix and not an accessibility one**, and the panel is still `role="status"`, so
what a screen reader is told is unchanged. 3c-2 §8 asked for the two not to be confused when it was
fixed.

### 3.4 §10.4 — the confirmation control pushed out by its own sentence. **CLOSED**

The Low: pressing *Load the version on disk* adds the surface's confirmation line, and on the
longest panels that growth moved the confirmation control back out of a 728 px viewport — measured
at y = 771 (creator, en), y = 788 (creator, es) and y = 771 (editor, es) — **after** the pane had
already been scrolled to its end. The reading noted explicitly that a fix for §10.3 does not
necessarily fix this one, so the second step has a target of its own.

Every one of the twelve conflict launches, both languages, all six surfaces:

```
L33 editor     en confirmation control box=848,667,160x23 label=confirmReload        inView=true
L34 editor     es confirmation control box=877,667,172x23 label=confirmReload        inView=true
L35 raw editor en confirmation control box=848,666,160x23 label=confirmReload        inView=true
L36 raw editor es confirmation control box=877,666,172x23 label=confirmReload        inView=true
L37 creator    en confirmation control box=848,666,160x23 label=confirmReload        inView=true
L38 creator    es confirmation control box=877,666,172x23 label=confirmReload        inView=true
L39 deleter    en confirmation control box=781,666,129x23 label=confirmReloadClosing inView=true
L40 deleter    es confirmation control box=786,666,133x23 label=confirmReloadClosing inView=true
L41 mover      en confirmation control box=781,666,129x23 label=confirmReloadClosing inView=true
L42 mover      es confirmation control box=786,666,133x23 label=confirmReloadClosing inView=true
L43 duplicator en confirmation control box=781,666,129x23 label=confirmReloadClosing inView=true
L44 duplicator es confirmation control box=786,666,133x23 label=confirmReloadClosing inView=true
```

**y = 666–667 on all twelve, `inView=true` on all twelve**, and the scroller moved a second time to
put it there — the editor's `scrollTop` went 676 → 1106 in English and 727 → 1157 in Spanish, the
creator's 547 → 740 and 564 → 774. The two surfaces whose control was previously outside the
viewport are the two that moved furthest.

**The `confirmReload` / `confirmReloadClosing` branch is still visible in the label**, unchanged
from 3c-2 §6: three of each, on the surfaces that declared them.

### 3.5 §10.5 — the raw editor's refused-reload sentence. **CLOSED**

The Low: the reason for a **disabled reload confirmation** was carried by a sentence about a
**different** control, ending *"…it will not open this file for editing"*, on a panel where the
editor is open and the person's own draft is in the box. L45, the panel's line [9] beside its
line [10]:

```
raw editor outcome [9] p box=667,607,472x45:
    The version on disk uses carriage returns in its line endings, and this editor cannot give
    them back exactly as they are. Rather than rewrite every line ending in the file without
    being asked, it will not load that version into this editor. Your own text is untouched and
    the file is not written either way.
raw editor confirmation control box=848,666,160x23 disabled=true label=confirmReload inView=true
raw editor after the confirmation: surface STILL OPEN
```

L46, the Spanish twin:

```
raw editor outcome [9] p box=667,593,472x60:
    La versión del disco usa retornos de carro en sus saltos de línea, y este editor no puede
    devolverlos exactamente como están. En lugar de reescribir todos los saltos de línea del
    archivo sin que nadie lo pida, no cargará esa versión en este editor. Tu texto sigue intacto
    y el archivo no se escribe en ningún caso.
```

The sentence now names the door it is about. Everything else on that panel is unchanged and was
right already: the disk text is still shown, *Keep editing* and *Copy my text* are still live, and
**only** the confirmation is disabled — `loadDiskVersion`'s rule, drawn correctly. Pressing the
disabled control did nothing and the surface stayed open, exactly as at L29.

**The opening refusal is untouched.** `browser.rawEditor.lineEndingsNotPreserved` still says what it
said, and is still what `DetailPane` and a refused `startRawEditor` draw; the two are now two keys
over one refusal, chosen by which door is being refused.

---

## 4. The bytes

Every launch compared the **whole configuration tree** against a pristine copy taken immediately
before it, and printed the target file's size on both sides and whether a backup directory existed.

### 4.1 The fourteen conflict launches wrote nothing

L33–L46: the only difference in each tree was the second writer's own line —
`12a13 > # a second writer reached this file`, `304 → 340` bytes (`304 → 341` for the two `crlf`
launches, whose appended line ends in CRLF) — and **no `.espansoconfig-backups` directory existed in
any of them**, which is the strongest available statement that the transaction never reached its
write. Sixteen of sixteen pasteboards were byte-identical to the sentinel `launch.sh` had seeded,
and none held a carriage return.

### 4.2 The two launches that wrote are the control

L47 and L48 carry `nowriter`, so no second writer ran, the base was never stale, and the save
**committed**:

```
L47  Only in …/L47/xdg/espanso: .espansoconfig-backups
     12a13 > # a probe edit that was never written
     before 304 bytes, after 342 bytes
     raw editor outcome: not a conflict
     raw editor outcome [0] p: The file was written. What is on disk now is exactly the text
                              that was sent.

L48  Only in …/L48/xdg/espanso: .espansoconfig-backups
     >       probe edit
     before 304 bytes, after 321 bytes
     editor outcome: not a conflict
     editor outcome [0] p: The file was written. What is on disk now is exactly the text that
                           was sent.
```

**The byte check is only evidence if it is capable of saying otherwise**, and these two are where it
did — same instrument, same script, same whole-tree comparison. 3c-2 made the same point about its
own L30, which was an accident; these two are deliberate.

They also carry the extra thing this re-take set out to learn (§5.3).

---

## 5. Falsifiability

### 5.1 The wording guard fires

`browser.matchCreation.revisionExpected` in `es.json` was temporarily restored to the string §10.1
found, and `src/lib/i18n/dictionaries.test.ts` failed:

```
× never uses a verb of writing, in either locale
AssertionError: es:browser.matchCreation.revisionExpected: expected [ 'escrito' ] to deeply equal []
```

Restored, and the suite is green. **Before this step nothing in the repository would have failed**;
that is what §10.1 asked 3c-3 to add.

### 5.2 The reveal guards fire

Two mutations, each applied to one component and reverted:

- **`$effect` removed from `MatchDeleter.svelte`** (the call replaced by `void reveal;`, so the
  derived value is still read and nothing else changes) → `MatchDeleter.test.ts` failed **2 cases**:
  *scrolls the panel's first line into view when a conflict appears* and *scrolls the controls into
  view at the reload's second step*.
- **`bind:this={outcomeChoices}` removed from `MatchMover.svelte`** → `MatchMover.test.ts` failed
  **1 case**: *scrolls the controls into view at the reload's second step*. The other case still
  passed, which is right — the panel binding was untouched.

Both are things that can be deleted silently and that no model test can see, which is why the
mounted suites carry them.

### 5.3 The reveal is every arm's, and a window says so

`outcomeReveal` answers `panel` for `saved` and `refused` too, not for `conflict` alone. L48, a
**committed** save on the surface §10.3 was about:

```
editor outcome: not a conflict
editor outcome [0] p box=667,540,472x17: The file was written. …
editor geometry viewport=1180x728 box=658,532,491x157 belowTheFold=false topInView=true
editor reveal: section.detail scrollTop=188 scrollHeight=833 clientHeight=645
```

`scrollTop` is 188, which is that scroller's maximum (833 − 645), so the panel is as high as the
layout allows and fully in view. **`2c-3c-3-window-reading.md` §10.2 recorded the same class as a
Low for the committed panel**; it is closed by the same change, and this is the window evidence for
it. `RawEditor.test.ts` carries the mounted case, which is also what would fail if a later edit
narrowed the reveal to conflicts.

---

## 6. What this evidence is, and what it is not

**Is:** what WebKit laid out and rendered in the real application's webview, over a real projection
of a real file, with a real `SaveResult::Conflict` from the real command layer after a real second
writer changed the file on disk (fourteen launches) or a real committed save (two); plus a
whole-tree byte comparison and a pasteboard read on both sides of every launch.

**Is not**, in addition to everything `2c-4a-3c-2-window-reading.md` §11 already lists, which is
unchanged:

1. **A pointer, a keystroke, or a user gesture.** Every control was reached with
   `HTMLElement.click()`. **The scroll is now the application's own** rather than an assignment by
   the probe — which is this re-take's whole point — but what triggers it is still a synthetic
   click.
2. **Any window size but 1180 × 728.** Every rectangle above is at that viewport. `scrollIntoView`
   is defined against the scrollport rather than against a constant, so nothing here depends on
   those numbers; nothing here measures another size either.
3. **Smooth scrolling, or a person's experience of the movement.** The reveal is instant by
   construction. Whether the jump is disorienting is a judgement no transcript can make.
4. **The `noscroll` half.** These launches did **not** re-check that the pane can be scrolled to its
   end by hand — 3c-2 §8 established that for all six and nothing in this step changes the
   scroller.
5. **The clipboard.** No launch of this re-take pressed *Copy my text*; 3c-2 §2's FAIL-to-settle
   stands untouched, and the pasteboard was checked only as a negative.
6. **`alreadyThere`, `refused` and `browser.saveOutcome.reloadUnavailable`.** Still unreachable from
   a window, for the reason 3c-2 §7.4 gives, which this step did not change.
7. **A second `revisionExpected` reading in the other language for each surface.** §10.1 and §10.6
   were read on the creator in both; the other five surfaces' `revisionExpected` lines were read in
   whichever language their launch used, and the invariant over all twelve values is carried by
   `dictionaries.test.ts` rather than by a screen.
8. **The real configuration.** Never opened, deliberately. `XDG_CONFIG_HOME` pointed at a synthetic
   three-snippet tree rebuilt per launch and `HOME` at an empty directory, so neither candidate
   `resolve_config_dir()` probes can reach it. Nothing in this file quotes anything but this run's
   own synthetic content and this application's own strings.

---

## 7. Verdict

| Finding | 3c-2 | Now | Evidence |
|---|---|---|---|
| §10.1 the Spanish creator line claims the snippet was written | **High** | **CLOSED** | L38 lines [0] and [4]; §3.1; the guard fires at §5.1 |
| §10.2 *Keep editing* on three operation-choice panels | **Medium** | **CLOSED** | L39–L44 draw the new label, L33–L38 keep the old; §3.2 |
| §10.3 the panel below the fold with nothing scrolling to it | **Medium** | **CLOSED** | twelve launches, `topInView=true`, `scrollTop` 0 → non-zero; §3.3 |
| §10.4 the confirmation control pushed out by its own sentence | **Low** | **CLOSED** | twelve launches, y = 666–667, `inView=true`; §3.4 |
| §10.5 the refused-reload sentence names the wrong door | **Low** | **CLOSED** | L45 and L46; §3.5 |
| §10.6 the English creator line's verb | Observation | **moved with §10.1** | L37; the decision is `2c-4a-3c-3-notes.md` §2.1 |
| `2c-3c-3-window-reading.md` §10.2, the committed panel | Low, elsewhere | **CLOSED as a side effect** | L48; §5.3 |

**No defect was found in what is written to disk.** Every conflicted save wrote nothing, on all six
surfaces, in both languages, checked whole-tree against a pristine copy — and the two launches that
did write are the ones whose second writer never ran.

**Nothing the fixes did broke anything a launch could see.** The capability lists, the
`confirmReload` / `confirmReloadClosing` branch, the two `MoveReloadWarning` arms, the five
confirmation lines, the operation summaries, the disk-text block and the two-step reload machine all
behaved exactly as 3c-2 recorded them. What §8 of that reading called *reachable, but nothing takes
you there* is now reached.

## 8. The gates, with the harness still in the tree

```
npm test                 47 files, 1464 tests, all passing
npm run check            415 files, 0 errors, 0 warnings
npm run build            174 modules
cargo build --workspace  ok
cargo clippy --workspace --all-targets -- -D warnings   ok
cargo fmt --check        ok
cargo test -p espansoconfig   149 passed, 0 failed
```

Each move from 3c-2's 46 / 1427 / 413 / 173 is accounted for in `2c-4a-3c-3-notes.md` §6. The probe,
its two Rust commands and the four hook lines are still uncommitted; removing them is the next step,
and `174 → 173` is what that will show.
