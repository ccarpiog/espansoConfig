# Phase 2d-6-7c — the narrow window reading of the three operation panels' external conflicts

**Date:** 2026-09-23 (launches 01:53–01:58 local time)
**Phase:** 2d-6-7c, the last third of 2d-6-7 ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2,
*The orchestrator's cut of 2d-6-7*). It owes what [`2d-6-7b-notes.md`](2d-6-7b-notes.md) §4 item 7
says jsdom could not establish: that a real window draws the deleter's, the mover's and the
duplicator's external panel over a file another writer changed, in English and Spanish, with the
sentences the mounted suites read, and where the panel and its choices land.
**Instrument:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, widened in this phase (§2).
**Binary for every proof launch:** `b8cafb2e60b0c4aac8de652bd7fb7e4126d937f527e70a5831412ecdc97734d5`
(`P01`–`P08`); `6d48fd5085dc41895ce51b77a2913a7b1741428d12c66ce8eb58c5c262f31bc0` for the
hard-fixture launches `H02`–`H05` added in the fix round (§8).

This is a **window reading**. It makes claims about what a real WKWebView window built from this tree
drew. They rest on thirteen launches of a hand-assembled macOS bundle, their transcripts, and 26
WebKit snapshots from the proof set. **No person looked at a live window.** The screen was locked for
the whole reading: a `screencapture -x` taken after the launches is solid black. §5 says what that
costs.

**In short.** In both languages, a change written to disk while an operation panel was open made each
of the three panels draw its own external panel 298–316 ms after the probe asked the writer to run.
The panel carried:
- the origin;
- the three observation lines;
- the observed revision (the SHA-256 of the fixture written);
- the retained operation and its identity caveat;
- the whole disk text;
- the readiness line;
- three choices.

The deleter's question was withdrawn. The mover's and the duplicator's send was disabled, and a press
sent no command. *Keep what I asked for* rebuilt the request (`reapplied`). A second change raised a
new panel. *Load the version on disk* gave the second step with each surface's warning. A third change,
arriving at that step, **withdrew the warning and the old revision** and drew the new ones.
*Keep what I asked for* then drew a manual resolution with its reason, and the two-step reload closed
the panel. A mover nobody touched drew no summary, no *Keep what I asked for*, no readiness line and
no destination warning.

A script outside the application checked the transcript against the dictionary files on disk. It
attributed **every sentence in every panel text to a dictionary key**. After removing those sentences,
what remained was only the file path, the trigger, and the synthetic disk text (§4.5). **No defect was
found.**

---

## 1. What the filesystem showed when this phase began

The harness `/private/tmp/espansoconfig-harness-2d-6-6c-2/` existed with `launch.sh`, six fixtures,
`tools/` and launches `S01`–`S04`, `L01`–`L06`. The four instrument paths were present, and
`git diff --stat src-tauri/src/main.rs src/main.ts` read `5 insertions(+), 1 deletion(-)`.

## 2. What changed in the harness and the instrument (never committed; 2d-8 deletes both)

**Harness** (outside the repository):

```
launch-7c.sh          a copy of launch.sh: plans external-deleter | external-mover |
                      external-duplicator | external-mover-untouched, :en|:es; also passes
                      ECFG_PROBE_R2 and ECFG_PROBE_R4; waits up to 150 s instead of 60 s
tools/verbatim-7c.cjs the dictionary comparison of §4.5
fixtures/alpha-changed-r1.yml        new (R1: :alpha's replacement changed, :beta untouched)
fixtures/beta-changed-again-r2.yml   new (R2: :beta's replacement changed)
launches/T01…T05, P01…P08
```

```
b657c4bee59a83e04e689c9227e71f2f0cb7aaf443af6f21c1633064bb0a834b  base-r0.yml              (at launch)
9c9765c38478061c82e5b71c22d4c0d9c17a5ac711d3bf9f5637f2b4ff2c7526  alpha-changed-r1.yml     (R1, second writer)
8a881a1b54186df2f0e5ad267dbb0f263ad22cbf0b97e4e6c2acf4f390fb78d1  beta-changed-again-r2.yml (R2, third writer)
ae2e8fafeb1d11a4edf24dc710a82c02f9648f84578b606c0aa2ecaab955c15e  beta-removed-r1.yml      (R4, fourth writer: :beta removed, :gamma changed)
```

All content is neutral and synthetic. The real configuration was never read, copied or launched
against. `HOME` and `XDG_CONFIG_HOME` pointed into each launch's own tree.

**Instrument** (the two untracked files only; the `main.rs`/`main.ts` hook diff is unchanged at
`5 insertions(+), 1 deletion(-)`):

- `src-tauri/src/probe.rs`: a new `probe_fourth_writer` that replaces the launch's target with
  `ECFG_PROBE_R4`. It is confined like the other writers, through the same `replace_the_target`, and
  registered in `register_with_probe`. The module header's command count now reads eight.
- `src/probe.ts`: a new section *The operation panels' external conflicts — Phase 2d-6-7c*. It holds
  two cases, `externalOperationPlan` (per surface) and `externalMoverUntouchedPlan`, with these
  helpers: `OPERATION_SURFACES`, `externalOf`, `runFourthWriter`, `reportKeys`, `readElement`,
  `reportSurroundings`, `waitForRevisionChange`, `openOperation`, `reportScroller` and
  `askedPanelKeys`. It adds four `runCase` arms and one entry in `PROBE_OWN_COMMANDS`. A `--- sentence`
  line now also prints the params it substituted, so the outside check can rebuild the value.
- The proof binary `b8cafb2e…` was built from `probe.ts` `f9deca52…` and `probe.rs` `b44b8569…`. The
  fix round (§8) then added `reportDiskText` to `probe.ts`, so the current `probe.ts` is
  `e452dfb8…`, the source of the hard-fixture binary `6d48fd50…`. `probe.rs` did not change again.

## 3. The launch recipe

```sh
npm run build                                            # 193 modules
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol  # dev profile, embedded dist
bash -c '/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7c.sh <case>:<en|es> <name>'
```

Every launch goes into a bundle path never used before. Every plan sets the language through the
picker: each transcript has `--- language picked=<lang> lang=<lang> label=ok`. There is one plan per
launch. The first attempt at the proof loop ran under zsh, which passed a plan and a name as one word.
All eight answered the 68 refusal (`the plan external-deleter:en P01 is not <…>:<en|es>`), and no
launch directory was created. The loop was re-run under `bash -c`.

**The plan `external-<deleter|mover|duplicator>`**, all inside one launch:

1. Open `match/conflict.yml` and select `:beta`. Open the panel through the pane (*Delete this
   snippet…* / *Move this snippet…* / *Duplicate this snippet…*). The mover also chooses *To the top
   of the list*. The deleter raises its question on opening, so it needs no extra press (shakedown `T01`).
2. **C1:** the second writer writes R1. Read the external panel, the section outside it, the send
   control (pressed anyway when disabled), the scroller and the placement. Take a snapshot.
3. Press *Keep what I asked for*. Read the reapply report.
4. **C2:** the third writer writes R2. Read the new panel. Press *Load the version on disk*. Read the
   second step. Take a snapshot.
5. **C3:** the fourth writer writes R4 while the panel is at the second step. Wait for the drawn
   revision to change. Read. Take a snapshot.
6. Press *Keep what I asked for*. Read the report. Take a snapshot.
7. Press *Load the version on disk*, then *Close this and load it*. Wait for the section to go.

**The plan `external-mover-untouched`:** open the mover, choose nothing, write R1, read the panel,
press *Load the version on disk*, read the second step, and press *Close this and load it*.

## 4. The launches

| Launch | Plan | Binary | `end`/`failed`/`MISMATCH` | `probe.err` | Panel after the writer (C1 / C2 / C3) | Target after | Webview PNGs | Verdict |
|---|---|---|---|---|---|---|---|---|
| `T01` | `external-deleter:en` | `969832e3…` | 0/1/0 | 0 | — | R0 | 0 | shakedown; the deleter opens with its question, so the plan's *Delete this snippet* press timed out |
| `T02` | `external-deleter:en` | `8009c21c…` | 1/0/0 | 0 | 307 / 307 / 308 | R4 | 4 | shakedown with R1 = `:beta` changed; *Keep* answered manual resolution (§4.3), so R1 was moved to `:alpha` |
| `T03` | `external-mover:en` | `b8cafb2e…` | 1/0/0 | 0 | 306 / 307 / 306 | R4 | 4 | shakedown |
| `T04` | `external-duplicator:es` | `b8cafb2e…` | 1/0/0 | 0 | 306 / 306 / 314 | R4 | 4 | shakedown |
| `T05` | `external-mover-untouched:en` | `b8cafb2e…` | 1/0/0 | 0 | 306 | R1 | 1 | shakedown |
| **`P01`** | `external-deleter:en` | `b8cafb2e…` | 1/0/0 | 0 | 307 / 306 / 307 | R4 `ae2e…` | 4 | **pass** |
| **`P02`** | `external-deleter:es` | `b8cafb2e…` | 1/0/0 | 0 | 308 / 307 / 306 | R4 | 4 | **pass** |
| **`P03`** | `external-mover:en` | `b8cafb2e…` | 1/0/0 | 0 | 305 / 308 / 307 | R4 | 4 | **pass** |
| **`P04`** | `external-mover:es` | `b8cafb2e…` | 1/0/0 | 0 | 306 / 298 / 316 | R4 | 4 | **pass** |
| **`P05`** | `external-duplicator:en` | `b8cafb2e…` | 1/0/0 | 0 | 304 / 306 / 307 | R4 | 4 | **pass** |
| **`P06`** | `external-duplicator:es` | `b8cafb2e…` | 1/0/0 | 0 | 306 / 309 / 306 | R4 | 4 | **pass** |
| **`P07`** | `external-mover-untouched:en` | `b8cafb2e…` | 1/0/0 | 0 | 306 | R1 `9c97…` | 1 | **pass** |
| **`P08`** | `external-mover-untouched:es` | `b8cafb2e…` | 1/0/0 | 0 | 306 | R1 | 1 | **pass** |

**The verdict is this reader's conjunction** of these facts:
- one `--- end` line, no `--- failed` line and no `MISMATCH` line;
- an empty `probe.err`;
- `verbatim-7c.cjs` reporting `problems=0`;
- a synthetic tree where only `match/conflict.yml` differs from `xdg-before`, and it holds the last
  fixture written;
- `other.yml` unchanged (`e61a60fd…`);
- `home-files=0`.

Every byte change is an external writer's. **No launch wrote through the application's save path**:
no plan pressed a send that was offered, and the one press of a disabled send issued no command
(§4.2).

### 4.1 The external panel, C1 (all six operation launches)

Every present-expected key below printed `expect=present drawn=yes ok`, in both languages, and every
absent-expected key printed `expect=absent drawn=no ok`:

| Keys | Deleter | Mover | Duplicator |
|---|---|---|---|
| `browser.conflictOrigin.changedWhileOpen`; `browser.externalConflict.fileChangedWhileOpen`; `browser.saveOutcome.operationKeptInMemory`; `browser.saveOutcome.reloadAbandonsOperation`; `browser.externalConflict.revisionObserved` (R1's digest); `browser.saveOutcome.retainedOperation`; `browser.saveOutcome.operationIdentityIsOld`; `browser.saveOutcome.diskVersion`; `browser.reapply.readyOperation` | present | present | present |
| the operation summary | `…operation.deleteSnippet` | `…operation.moveToTop` | `…operation.duplicateSnippet` |
| absent: `browser.conflictOrigin.refusedSave`, `browser.saveOutcome.changedElsewhere`, `browser.saveOutcome.reloadUnavailableOperation`, the surface's reload warning | absent | absent | absent |

The disk text drawn was R1's (`comparison … disk=drawn`, and the residue in §4.5). Each panel prints
exactly one 64-digit run, the observed revision. No *expected* and no *found* are drawn. The choices,
verbatim (`P01`, `P02`):

```
--- choices deleter-c1 count=3 [Leave this as it is · Keep what I asked for · Load the version on disk]
--- choices deleter-c1 count=3 [Dejarlo como está · Conservar lo que he pedido · Cargar la versión del disco]
```

The mover and the duplicator print the same three labels in each language. The snapshot
`P01/shots/deleter-c1-panel-webview.png` shows the panel in the detail pane, in the order the
transcript printed. It shows the observed revision `9c9765c3…`, the heading *What you asked for,
kept here*, *You asked to delete this snippet from this file.*, the fixture text, the readiness
paragraph, and the choice row cut at the pane's bottom edge.

### 4.2 Direct submission refused (C1)

- **Deleter.** The question and its controls are gone. Outside the panel, only the header control
  and the recovery sentence remain:

  ```
  --- controls deleter-c1 outside-external [Leave this alone]
  --- text deleter-c1-outside Deleting a snippet Leave this alone File match/conflict.yml Trigger :beta What you asked for here is an action on a snippet rather than text you wrote, so there is nothing to make a new snippet out of. Load the version on disk, choose a snippet in it, and ask again.
  ```

  The keys `browser.matchDeletion.question`, `.confirm` and `.request` were each `absent … ok`.
  Before the write the same section read `[Leave this alone · Delete it · Keep it]` and drew the
  question.
- **Mover and duplicator.** The send is disabled. The refusal line (`fileChangedWhileOpen`) and the
  recovery sentence sit under it. The probe pressed the disabled control anyway:

  ```
  --- controls mover-c1 outside-external [Leave it where it is · [off] Move this snippet]
  --- send mover-c1 control=disabled
  --- send mover-c1 pressed-anyway commands=0 panels=1->1
  --- text mover-c1-outside Moving a snippet Leave it where it is File match/conflict.yml Trigger :beta Where it should go A snippet is moved inside the list it is already in, so every place offered here is in match/conflict.yml. Snippets in other files are not destinations. Move this snippet This file changed on disk while this panel was open. No save was initiated in response to this observation, and this app cannot say what changed the file or when. What you asked for here is an action on a snippet rather than text you wrote, so there is nothing to make a new snippet out of. Load the version on disk, choose a snippet in it, and ask again.
  ```

  `commands=0` counts the recorded `move_match` / `duplicate_match` IPC calls, which are none. The
  duplicator prints `[Leave this alone · [off] Duplicate this snippet]`, `control=disabled` and
  `commands=0` (`P05`). In Spanish it prints `[Dejarlo como está · [off] Duplicar este fragmento]`
  (`P06`), and the mover prints `[Dejarlo donde está · [off] Mover este fragmento]` (`P04`).

### 4.3 *Keep what I asked for*: reapplied, then manual resolution

- **Over R1** (only `:alpha` changed), all six launches report `arm=browser.reapply.reapplied`, the
  external panel absent after, and the report's whole text attributed to `browser.reapply.reapplied`
  alone. `P03`: *"This window now shows the version on disk, with what you kept set up over it. This
  reapply attempt wrote nothing: send it when you are ready, and that save can still be refused or
  conflict."*
  - The deleter's question is not raised again. Its request control comes back instead:
    `--- controls deleter-keep1 outside-external [Leave this alone · Delete this snippet]` (`P01`),
    `[Dejarlo como está · Eliminar este fragmento]` (`P02`).
  - The mover's and the duplicator's send is enabled again: `[Leave it where it is · Move this
    snippet]` (`P03`), `[Leave this alone · Duplicate this snippet]` (`P05`), and the same without
    `[off]` in Spanish (`P04`, `P06`).
- **Over R4, after the supersession of §4.4**, all six report the manual resolution with the reason
  `browser.reapply.externalEvidence.baseRevisionMoved`. The panel stays at the R4 revision.
  - `P01`: *"espansoConfig applied nothing. This reapply attempt wrote nothing, this window was not
    moved, and what you kept is still here exactly as it was. The reason follows. The correspondence
    that reading carried was worked out from a different version of this file than the one you
    started from, so it says nothing about what you kept. This reapply attempt wrote nothing."*
  - `P02`: *"espansoConfig no ha aplicado nada. Este intento de reaplicar no ha escrito nada, esta
    ventana no se ha movido y lo que conservaste sigue aquí exactamente igual. El motivo es el
    siguiente. La correspondencia que traía esa lectura se calculó a partir de una versión de este
    archivo distinta de aquella desde la que empezaste, así que no dice nada sobre lo que has
    conservado. Este intento de reaplicar no ha escrito nada."*

  The reason is true of this sequence. The session was rebuilt over R1, and the superseding
  reading's correspondence was worked out from R2 to R4.
- In the shakedown `T02`, R1 changed `:beta` itself. *Keep* then answered a manual resolution with
  the evidence reason *"… No snippet in that list carries the exact owned-line correspondence
  evidence recorded for this change. This operation or positional anchor requires exact owned-line
  correspondence, so nothing weaker will do."* That is a deletion over a snippet whose text changed,
  and the refusal is the documented rule. It is shakedown evidence only: the proof set did not repeat
  it.

### 4.4 The two-step reload, and supersession withdrawing the warning

- **Second step (C2, after *Load the version on disk*).** The surface's warning is present, the
  revision is R2's, and the choices become:

  ```
  --- choices deleter-step count=3 [Leave this as it is · Keep what I asked for · Close this and load it]
  --- choices duplicator-step count=3 [Dejarlo como está · Conservar lo que he pedido · Cerrar esto y cargarla]
  ```

  The warning keys are `browser.matchDeletion.reloadIdentifiesNoSnippet`,
  `browser.matchMove.reloadDropsPositionalDestination` and
  `browser.matchDuplication.reloadIdentifiesNoSnippet`, each `present … ok` in both languages.
  `P04/shots/mover-step-webview.png` shows the Spanish mover at this step: *El destino que elegiste
  no se conserva…* above the readiness paragraph, and the row *Dejarlo como está · Conservar lo que he
  pedido · Cerrar esto y cargarla* fully inside the pane.
- **Supersession (C3).** The fourth writer ran while the panel was at the second step. The drawn
  revision changed 306–316 ms later (`--- superseded …`). In all six launches:
  - `revisionObserved` with R4's digest is `present`, and with R2's digest it is `absent`;
  - the surface's warning is `absent`;
  - the disk text is R4's (`old-disk=absent new-disk=drawn`);
  - the choices are back to *Load the version on disk*, and *Close this and load it* is gone:

  ```
  --- choices mover-c3 count=3 [Leave this as it is · Keep what I asked for · Load the version on disk]
  ```
- **The reload carried through.** After the manual resolution, *Load the version on disk* then
  *Close this and load it* removed the section (`--- closed <surface> section=absent`) in all six.
  The pane then drew `browser.notice.differentMatch` with *Dismiss*, because R4 no longer holds
  `:beta` where the selection was.

### 4.5 The sentences are the dictionary's, verbatim

`tools/verbatim-7c.cjs` runs in Node outside the application. It reads `src/lib/i18n/en.json` or
`es.json` from disk and does two things:
1. It re-derives every `--- sentence` line from the key and the printed params. Result: **45 / 45 / 43 /
   43 / 43 / 43 / 17 / 17 checked, 0 problems** (P01…P08). Every present-expected value is
   `VERBATIM` in the printed text, and the in-app verdict agrees every time.
2. It attributes every `--- text` line by removing each dictionary value of the launch's language,
   longest first, and naming the key that holds it. **The residue of every text line in every proof
   launch** is one of:
   - nothing (the reapply reports, the text after the close);
   - `match/conflict.yml` and `:beta` (the sections outside the panel);
   - the synthetic fixture text of the revision the panel names (the external panels).

   R1's text is at C1, R2's at C2 and at the step, and R4's at C3.

So no sentence drawn in these panels is outside the dictionaries. The per-launch output is
`launches/P0n/verbatim.txt`.

**The Spanish label pair (7b §4 item 1), in a window.** In `P02` and `P06`, the header control
(`--- head deleter-c1 close=Dejarlo como está`) and the first conflict choice read the same. The
attribution names one value for three keys:
`browser.saveOutcome.choice.keepOperation|browser.matchDeletion.close|browser.matchDuplication.close`.
The mover's header reads *Dejarlo donde está* and does not collide (`P04`, `P08`).
`P06/shots/duplicator-keep2-webview.png` does not show the header, because the pane is scrolled; the
pair is established from the transcript.

**The mover's refusal repeating the panel's first observation line (7b §4 item 3).** This appears in
every mover and duplicator launch: `fileChangedWhileOpen` is drawn once under the disabled send
and again inside the external panel. `P08/shots/mover-untouched-panel-webview.png` shows both, one
above the recovery sentence and one as the panel's second paragraph.

### 4.6 A mover nobody touched (`P07`, `P08`)

The whole panel text (`P07`), verbatim:

> What is compared here came from watching the file: it changed on disk while this was open. No save
> was initiated in response to this observation, so nothing was written from here in response to it,
> and this app cannot say what changed the file or when. This file changed on disk while this panel
> was open. No save was initiated in response to this observation, and this app cannot say what
> changed the file or when. What you asked for here is still set up, exactly as you left it. Nothing
> has been discarded and nothing has been reloaded. Loading the version on disk moves this window to
> it and closes this panel. What you asked for here is not carried out, and the file is not written
> either way. The version read from disk when this change was observed is
> 9c9765c38478061c82e5b71c22d4c0d9c17a5ac711d3bf9f5637f2b4ff2c7526. This panel names the snippet as
> this window read it before the file changed. This app does not look for a matching snippet in the
> version on disk, so nothing here says what that version holds. The version on disk *[R1's
> text]* Leave this as it is Load the version on disk

- `browser.saveOutcome.retainedOperation`, `…operation.moveToTop`, `browser.reapply.readyOperation`,
  `browser.saveOutcome.choice.keepMyRequest` and both `reloadDrops*Destination` warnings are `absent
  … ok`. The choices are `[Leave this as it is · Load the version on disk]` and, in Spanish,
  `[Dejarlo como está · Cargar la versión del disco]`.
- At the second step the choices are `[Leave this as it is · Close this and load it]` (in Spanish
  `[Dejarlo como está · Cerrar esto y cargarla]`), with no destination warning. The confirm press
  closed the mover.
- This is 7b §2 ruling 3 and §5 finding 1 in a window. **Still drawn:** `operationKeptInMemory` (*What
  you asked for here is still set up…*), `reloadAbandonsOperation` and
  `recovery.unavailable.operationDraft`. These are the sentences 7b §4 item 2 records as assuming an
  ask. The window confirms that they reach the screen.

### 4.7 Placement and the reveal

The scroller's position **before** each write was measured this time, and it was `scrollTop=0` in
every launch. So the scrolling below is the application's reveal. The detail scroller is 645 px tall
in a 1180×728 viewport.

| Launch | C1 panel top | C1 panel height | C1 choices visible | Step choices visible |
|---|---|---|---|---|
| deleter EN / ES | y=44 (scroller top) | 662 / 730 px | **14 / 0 of 23 px** | 22 / 22 of 23 px |
| mover EN / ES | y=44 | 662 / 730 px | **14 / 0 of 23 px** | 23 / 22 of 23 px |
| duplicator EN / ES | y=44 | 662 / 730 px | **14 / 0 of 23 px** | 22 / 23 of 23 px |
| untouched mover EN / ES | y=202 / 168 | 487 / 521 px | whole panel visible | — |

- `topVisible=no` beside `box y=44` and `frame 44..689` is the sub-pixel rounding 6c-2 §4.3 already
  names.
- **At C1 the reveal lands the panel's top at the scroller's top, and the choice row is partly (EN)
  or wholly (ES) below the fold.** This is the same shape 6c-2 §4.5 recorded for the editor and the
  creator.
- **At the reload's second step, the reveal brings the choice row into view** (22–23 px of 23 in
  every launch). That is 7b's `awaitingReloadConfirmation` cue, with the target at the choices,
  observed in a window.
- The untouched mover's panel is shorter than the scroller and is drawn whole.

## 5. What the reading does **not** prove

- **No human looked, and the screen was locked.** The window was hidden and unfocused
  (`hasFocus=false visibility=hidden`). The snapshots are WebKit's render of the page, not a
  composited window. Screen captures are the lock screen, and window captures answered `could not
  create image from window`.
- **No real input.** Controls were pressed with `HTMLElement.click()`. The disabled-send press shows
  that a disabled control issues no command. It does not show keyboard reach or focus.
- **The deleter's *Delete it* disabled under a held reading (7b §4 item 7, fourth bullet) was not
  reached.** It needs a reading held during a write in flight, which this plan cannot time. The
  mounted case *holds the question while a reading waits…* carries it.
- **Only one manual-resolution reason was read in the proof set**, `baseRevisionMoved`.
  - `noCorrespondence`, `supersededConflict` and the `writeOutcomeUnknown` withholding were not
    produced.
  - The evidence gate answers first after a supersession, so a reason about the removed snippet
    itself is not reachable along this sequence.
  - 7b §4 item 5 (`supersededConflict` without a mounted case) is therefore **still** without a window
    reading.
- **The save-arm origin** (`refusedSave`) on these panels was not produced. The watcher's delivery
  (~300 ms) races any save, as in 6c-2 §4.3.
- **The locale switch keeping the session** (entry 35) was not exercised in a window. Each launch
  runs in one language.
- **A `--- sentence` line is a containment test.** The attribution of §4.5 shows that the text holds
  only dictionary values and synthetic data. It does not show legibility, except in the four snapshots
  opened (§6).

## 6. Where it is thin

- Two proof launches per plan, over one fixture sequence.
- Of the 26 proof-set snapshots, this reader opened three:
  - `P01/shots/deleter-c1-panel-webview.png`;
  - `P04/shots/mover-step-webview.png`;
  - `P06/shots/duplicator-keep2-webview.png`.

  The reader also opened `P08/shots/mover-untouched-panel-webview.png`, and a black `screencapture`
  as evidence of the lock. The other snapshots were not opened.
- The reapplied arm was read only for a change elsewhere in the file (`:alpha`), not for a change to
  the snippet itself (`T02` found that path refused for the deleter).
- One viewport, 1180×728.

## 7. Privacy

The only files read or written were synthetic fixtures under `/private/tmp`. The transcripts carry
harness paths and synthetic content only. `tests/corpus/real/` was not touched. `launch-7c.sh` keeps
`launch.sh`'s clipboard save and restore. No plan pressed a copy control.

## 8. Fix round — the hard fixture (review finding, ruling 38)

**Launches 02:08–02:10 local time.** The review ([`phase-2d-6-7c.md`](../reviews/phase-2d-6-7c.md))
found that §1-§7 read only plain fixtures. Ruling 38 ([`2d-6-split-notes.md`](2d-6-split-notes.md)
§3) and the consult (`phase-2d-6-design.md:265`) require the narrow reading to *include one hard
fixture*. This section adds that reading, with the same harness, recipe and plan as §3.

### 8.1 The fixtures

There are two harness-authored sets, with neutral content. **Hard** has the shape of the corpus
fixture `move-block-scalar-seams.yml` and borrows from `block-scalars.yml` and
`folded-more-indented.yml`:
- `|` block bodies at **column five**;
- a line inside `:alpha`'s block reading `# not a comment: block content at column five`, which is
  block **content** that looks like a comment;
- a leading comment at **column five** owned by `:beta`, directly under a single-quoted scalar;
- a blank line inside `:beta`'s block, and two blank lines after it;
- a leading comment at **column two** owned by `:gamma`;
- a `>-` folded block with a more-indented line.

The corpus files themselves were not copied. **Hardcrlf** is the same bytes with every line ending
CRLF. Each set has four revisions, the same roles as §2:

```
a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322  hard-r0.yml
0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db  hard-alpha-changed-r1.yml
51104dae5ae5827b1dd201cf72935c229d588745b6ec71a2ed77452d2a0c8d85  hard-beta-changed-again-r2.yml
edabfe428b0b1e509c3ad869b75b65baa5b0358b322f0bb554ebddd4de06f71b  hard-beta-removed-r4.yml
02f0ab5712eec235288b7cb49f0b5733904bc1b36ed6b388953aea56bd4e2750  hardcrlf-r0.yml
7702ea7419790df315b2eeeab57af0229f01548cc084724e7a299c78407dc4e4  hardcrlf-alpha-changed-r1.yml
8b5225ead21674c03281f792c7cea5e0dda59341c425ceb4d3404f49e4bef8a8  hardcrlf-beta-changed-again-r2.yml
478e30d6dc0c0890edaab1e0d32feb08d88a82a9b71892d1d31e89b74de2116e  hardcrlf-beta-removed-r4.yml
```

**What changed in the harness and the instrument:**
- `launch-7c.sh` takes an optional third argument, `plain | hard | hardcrlf`, which picks the set
  and also the file copied in at launch.
- `probe.ts` gained `reportDiskText`. It rebuilds the disk text a panel's `SourceText` box draws: a
  text node is its text, a `<br>` is `\n`, and a marker is `⟦label⟧`. The result is printed as JSON.
- `tools/verbatim-7c.cjs` compares each such line with the bytes of every fixture the launch used.
  The verdict is one of:
  - `exact`;
  - `crlf-as-one-break`: equal once every `\r\n` is read as one break;
  - `crlf-as-marker`.

The shakedown `H01` (binary `61f22480…`) printed the framework's empty comment anchors as `⟦⟧`
markers. The probe was corrected to skip them before the proof launches.

### 8.2 The launches

| Launch | Plan | Set | Binary | `end`/`failed`/`MISMATCH` | `probe.err` | Panel after the writer (C1 / C2 / C3) | Target after | Sentences (verbatim-7c) | Disk text | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| `H01` | `external-mover:en` | hard | `61f22480…` | 1/0/0 | 0 | 307 / 307 / 308 | hard R4 | 43, 0 problems | — (anchors printed as markers) | shakedown |
| **`H02`** | `external-mover:en` | hard | `6d48fd50…` | 1/0/0 | 0 | 306 / 307 / 307 | hard R4 `edab…` | 43, 0 problems | `exact` × 3 | **pass** |
| **`H03`** | `external-mover:es` | hard | `6d48fd50…` | 1/0/0 | 0 | 307 / 307 / 307 | hard R4 | 43, 0 problems | `exact` × 3 | **pass** |
| **`H04`** | `external-mover:en` | hardcrlf | `6d48fd50…` | 1/0/0 | 0 | 306 / 308 / 307 | hardcrlf R4 `478e…` | 43, 0 problems | `crlf-as-one-break` × 3 | **pass** |
| **`H05`** | `external-mover:es` | hardcrlf | `6d48fd50…` | 1/0/0 | 0 | 305 / 307 / 325 | hardcrlf R4 | 43, 0 problems | `crlf-as-one-break` × 3 | **pass** |

The verdict is §4's conjunction. In each proof launch:
- only `match/conflict.yml` differs from `xdg-before`, and it holds that set's R4;
- `other.yml` is `e61a60fd…`;
- `home-files=0`;
- 4 webview snapshots were written.

### 8.3 What was read, verbatim

- **Sentences.** The mover's whole §4 sequence gave the same keys as over the plain fixture:
  - C1: origin, three observation lines, revision, retained operation `moveToTop`, identity caveat,
    disk heading, readiness line and three choices;
  - the send `[off]`, with a forced press giving `commands=0 panels=1->1`, and the refusal and
    recovery lines under it;
  - `reapplied` over R1;
  - C2, then the second step with `reloadDropsPositionalDestination` and *Close this and load it*;
  - the supersession at C3: warning and old revision absent, new revision present;
  - `manualResolution` plus `externalEvidence.baseRevisionMoved`;
  - the close.

  Every `--- sentence` line was re-derived from `en.json` / `es.json` on disk as `VERBATIM`, with 0
  problems in all four launches. After the attribution, every residue is only `match/conflict.yml`,
  `:beta`, or the disk text of the revision the panel names. The Spanish choice rows, verbatim
  (`H03`, `H05`):

  ```
  --- choices mover-c1 count=3 [Dejarlo como está · Conservar lo que he pedido · Cargar la versión del disco]
  --- choices mover-step count=3 [Dejarlo como está · Conservar lo que he pedido · Cerrar esto y cargarla]
  ```
- **The disk text is the file's, character for character (LF).** At C1, C2 and C3 in `H02` and
  `H03`, the rebuilt disk text is **identical** to R1, R2 and R4 (836, 842 and 682 characters). That
  includes:
  - the column-five indentation;
  - the block-content line that looks like a comment;
  - the column-five and column-two comments;
  - the interior blank line and the blank run after `:beta`'s block;
  - the more-indented folded line.

  Nothing was re-indented, trimmed, or dropped.
  `H03/shots/mover-c3-webview.png` shows R4 drawn in the Spanish panel with those columns. Lines
  wider than the box run past its edge instead of wrapping (the `white-space: pre` rule in
  `SourceText.svelte`).
- **CRLF (`H04`, `H05`).** The drawn text equals the file with every `\r\n` read as **one break**. No
  carriage-return marker is drawn and no extra break. This is `SourceText.svelte`'s documented rule
  (*"a CRLF draws one break rather than one plus whatever the engine does with a stray carriage
  return"*). So the panel does **not** show which line-ending convention the disk version uses: a
  person cannot tell `hard` from `hardcrlf` in this panel. That is the renderer's stated design, not a
  defect of this phase. It is recorded as an open item for a later deliberate decision (notes §4).

### 8.4 What the fixture shape did and did not change

- **Unchanged:**
  - every sentence and its key;
  - every choice list;
  - the reapply arms (`reapplied`, then `baseRevisionMoved`);
  - the supersession behaviour;
  - the delivery latency (305–325 ms);
  - the byte result on disk (only the external writers wrote).

  A move of `:beta`, whose leading comment is at column five, rebuilt over R1 without refusal.
- **Changed: the geometry only.**
  - The panel is taller, 952 px in EN and 1020 px in ES, against 662 / 730 px over the plain fixture.
  - So the C1 choice row is **wholly** below the fold in **both** languages (0 of 23 px). Over the
    plain fixture, English showed 14 px.
  - The reveal at the second step still brought the row fully into view (23 of 23 px in all four).
  - This strengthens notes §4 item 1 and does not change it.
- **Not read over the hard fixture:** the deleter, the duplicator, the untouched mover, and a *send*
  over the hard shape. No plan sends, so the move's seam refusals (the fixture shape's own purpose in
  the corpus) are not exercised by any window reading here.

### 8.5 The limits of §5 still apply

The window was hidden, and the screen was locked (a `screencapture -x` is black). The evidence is the
transcript, the out-of-app comparison, and WebKit snapshots. This reader opened one of the 16
hard-fixture snapshots, `H03/shots/mover-c3-webview.png`. **Ruling 38 asks for a *visible* window.**
That was not possible on this host during this run, and the notes record it as a deviation.
