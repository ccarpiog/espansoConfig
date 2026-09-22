# Phase 2d-6-6c-2 — the narrow window reading of the three authored external-conflict panels

**Date:** 2026-09-23 (launches 00:17–00:21 local time)
**Phase:** 2d-6-6c-2, the second half of 2d-6-6c ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2).
It owes what [`2d-6-6c-1-notes.md`](2d-6-6c-1-notes.md) §4 item 2 says jsdom could not establish:
where the external panel lands, whether it can be seen, and whether the sentences drawn in a real
window are the ones the mounted suites read.
**Instrument:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, **rebuilt** in this phase (§2).
**Binary for every proof launch:** `691d59113f5edbee94d6a7b133325ad0bcba90066f18b0d71b3136f73fd5042f`.

This is a **window reading**. It makes claims about what a real WKWebView window built from this
tree drew, and it backs them with ten launches of a hand-assembled macOS bundle, their transcripts
and sixteen WebKit snapshots. **No person looked at a live window.** The host's screen was locked for
the whole reading. §5 says what that costs.

**In short** (each claim is cited below). In both languages, a change written to disk while a panel
was open made each of the three authored panels draw its own external-conflict panel. The panel
appeared 305–308 ms after the probe asked the external writer to run. The origin, the observation's
line, the observed revision (equal to the SHA-256 of the fixture written), the affected file where
the panel draws one, the one way forward for a form that names no file, the comparison and the
choices were all there. The transcript printed the panel's rendered text, and a script outside the
application compared it with the EN/ES dictionary files: **every sentence the mounted suites read
appears verbatim** (§4.4). The panel is placed **at the top of the detail pane's scroller**. For the
editor and the creator, **the choice row was below the fold** (0 of 23 px visible, 0 of 50 px in
Spanish) until something scrolled it into view. The recovery form's panel and its choices were fully
visible. In the proof launches the copy control's disclosure said the copy **failed** (§4.1).

---

## 1. What the filesystem showed when this phase began

`/private/tmp/espansoconfig-harness-2d-5-7b/` **did not exist** (`ls /private/tmp/ | rg espansoconfig`
matched nothing). The four instrument paths were present, and `git diff --stat src-tauri/src/main.rs
src/main.ts` read `5 insertions(+), 1 deletion(-)`. The screen was locked: a `screencapture -x` taken
at 00:12 shows the lock screen.

## 2. The rebuilt harness, and what changed in the instrument

The tree is `/private/tmp/espansoconfig-harness-2d-6-6c-2/`. It has a **new** name, for the reason
`2d-5-7b-window-reading.md` §2 gives. `HARNESS_ROOT` in `src-tauri/src/probe.rs` was moved to it.
**2d-8, which deletes the harness, must delete this path**, not only the 2d-5-7b one.

```
launch.sh        one plan-driven launch: fresh bundle path, fresh XDG_CONFIG_HOME and HOME,
                 the wait for `--- end`/`--- failed`, a screen capture per `--- shot`, the kill,
                 the byte record (bytes.txt); refusals exit 68 (plan), 69 (name), 65 (name used)
tools/winid      a Swift helper that prints the CGWindowID of the process's largest window
tools/verbatim.cjs  the dictionary comparison of §4.4, run by Node outside the application
fixtures/        six synthetic files, all authored here (digests below)
launches/S01…S04, L01…L06   per launch: xdg/, xdg-before/, home/, espansoConfig.app, probe.log,
                 probe.err, launch.txt, bytes.txt, shots/
```

```
b657c4bee59a83e04e689c9227e71f2f0cb7aaf443af6f21c1633064bb0a834b  base-r0.yml           (match/conflict.yml at launch)
4a49eddc3fcbe2a898e25ad7914cc5161765f6def403005a72b315254101fc7e  target-changed-r1.yml  (:beta's replacement changed)
ae2e8fafeb1d11a4edf24dc710a82c02f9648f84578b606c0aa2ecaab955c15e  beta-removed-r1.yml    (:beta removed, :gamma changed)
e61a60fd3cb5d5eb0c58d39b62efc68c8e04d96dbafdb145de13ab6cc5dac731  other-r0.yml           (match/other.yml at launch)
a347935692e6561b90deeddeca34f995210844d75d9c2dd463c1e77824944a43  other-changed-r1.yml   (:delta's replacement changed)
cd5e2ead72c2f1f8533bc64a81b72ee7ce914807c22f98dddaebc397f2f08419  default-config.yml     (config/default.yml)
```

All content is neutral and synthetic (`:alpha`/`:beta`/`:gamma`/`:delta`, "… text", "… changed on
disk"). The real configuration was never read, copied or launched against. `HOME` and
`XDG_CONFIG_HOME` pointed into each launch's own tree, and every `open_workspace` answer in the
transcripts names a root under `launches/<name>/xdg/espanso`.

**Instrument changes (untracked files only; both are deleted by 2d-8):**

- **`src/probe.ts`**:
  - three cases: `external-editor`, `external-creator` and `external-recovery`;
  - their helpers: `reportSentences`, `reportChoices`, `reportPlacement`, `scrollerOf`, `shot`,
    `scrollAndShoot`, `waitForPanel`, `observedRevisionOf` and `runOtherWriter`;
  - imports of `conflictChoiceKey`, `recoveryChoiceKey` and `recoveryRefusalKey`, so no label key
    is built by hand;
  - three new entries in `PROBE_OWN_COMMANDS`.

  A `--- text` line prints the panel's `innerText` whole and collapsed. It is not cut at
  `BLOCK_TEXT_LIMIT`.
- **`src-tauri/src/probe.rs`**:
  - `HARNESS_ROOT` moved;
  - `probe_other_writer`, which replaces `<launch>/xdg/espanso/match/other.yml` (from
    `ECFG_PROBE_TARGET_OTHER`) with `ECFG_PROBE_R3`. It has the same plan requirement and pathname
    rules as the other writers, through a `replace_a_target` / `confined_target` generalised over
    the variable and the tail;
  - `probe_snapshot` and `probe_snapshot_state`. These ask `-[WKWebView
    takeSnapshotWithConfiguration:completionHandler:]` for a PNG written to
    `<launch>/shots/<tag>-webview.png`, confined to the launch directory `ECFG_PROBE_TARGET`
    resolves to.

  The snapshot is raw Objective-C through `objc_msgSend` and a hand-laid global block, because the
  instrument may not add a dependency to a tracked manifest. **No type checks any of those calls.**
  A PNG that shows the window is the only evidence that it works.
- After the launches, `probe.rs` was `rustfmt`-ed and one comment was reworded, so the
  `retained_state_contract` sweep would not read "outlives" as a lifetime claim. Neither change is
  executable, but the current source is **not** byte-identical to the one the proof binary was built
  from. The proof binary's digest is the one above.

The two hook files still read `5 insertions(+), 1 deletion(-)`.

## 3. The launch recipe

```sh
npm run build                                            # 193 modules
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol  # dev profile, embedded dist
/private/tmp/espansoconfig-harness-2d-6-6c-2/launch.sh <case>:<en|es> <name>
```

Each launch goes into a **bundle path never used before**. It uses
`open --env ECFG_PROBE_PLAN=… --env ECFG_PROBE_TARGET=… --env ECFG_PROBE_TARGET_OTHER=…
--env ECFG_PROBE_R1=… --env ECFG_PROBE_R3=… --env XDG_CONFIG_HOME=… --env HOME=… --stdout … --stderr …`.
Every plan sets the language **through the picker**, and every transcript has
`--- language picked=<lang> lang=<lang> label=ok`. **One plan per launch.**

`launch.sh` saves the person's text clipboard in memory, then restores it with `pbcopy` after the kill,
because the copy control writes the synthetic draft there. Non-text clipboard contents would not
survive this. None were known to be present.

The 68 refusal ran by accident when zsh passed a plan and a name as one word: *the plan
external-editor:en L01 is not <…>:<en|es>*. No launch directory was created by it.

## 4. The launches

| Launch | Plan | Binary | `end`/`failed`/`MISMATCH` | `probe.err` | Panel drawn after the writer | `conflict.yml` / `other.yml` after | Webview PNGs | Verdict |
|---|---|---|---|---|---|---|---|---|
| `S01` | `external-editor:en` | `2b04502f…` | 1/0/0 | 0 | 307 ms | R1 `4a49…` / R0 | 0 (hold too short) | shakedown; found that `pause()` hits its trip cap, so the shot hold was ~60 ms |
| `S02` | `external-editor:en` | `f9dd5868…` | 1/0/0 | 0 | 306 ms | R1 / R0 | 2 | shakedown; first snapshots |
| `S03` | `external-creator:en` | `691d5911…` | 1/0/0 | 0 | 307 ms | R1 / R0 | 3 | shakedown |
| `S04` | `external-recovery:en` | `691d5911…` | 1/0/0 | 0 | 307 + 306 ms | R1b `ae2e…` / R3 `a347…` | 2 | shakedown |
| **`L01`** | `external-editor:en` | `691d5911…` | 1/0/0 | 0 | 307 ms | R1 / R0 | 3 | **pass** |
| **`L02`** | `external-editor:es` | `691d5911…` | 1/0/0 | 0 | 306 ms | R1 / R0 | 3 | **pass** |
| **`L03`** | `external-creator:en` | `691d5911…` | 1/0/0 | 0 | 308 ms | R1 / R0 | 3 | **pass** |
| **`L04`** | `external-creator:es` | `691d5911…` | 1/0/0 | 0 | 306 ms | R1 / R0 | 3 | **pass** |
| **`L05`** | `external-recovery:en` | `691d5911…` | 1/0/0 | 0 | 308 + 305 ms | R1b / R3 | 2 | **pass** |
| **`L06`** | `external-recovery:es` | `691d5911…` | 1/0/0 | 0 | 305 + 305 ms | R1b / R3 | 2 | **pass** |

**The verdict is this reader's conjunction** of five facts: one `--- end` line, no `--- failed` line,
no `MISMATCH` line, an empty `probe.err`, and a synthetic tree whose only changed files are the ones
the external writers replaced, holding the fixture bytes (`bytes.txt`, `diff -rq xdg-before xdg`).
`home-files=0` on every launch: nothing was written under `HOME`, and no backup was taken, because no
launch saved. **No launch wrote through the application's save path.** Every byte change is an
external writer's.

### 4.1 Reading (a) — the editor over a file changed on disk (`L01`, `L02`)

Plan:
1. Open `match/conflict.yml`, select `:beta`, and press *Edit this snippet* / *Editar este fragmento*.
2. Type `beta draft typed by the probe` into the body.
3. `probe_second_writer` writes R1.
4. Wait for `section.matchEditor > div.panel.external`.
5. Read it, capture, scroll the choices into view, capture.
6. Press *Copy my text*, read, capture.

`--- before … absent` confirms that no external panel existed before the write.

Verbatim (`L01`):

```
--- panel section.matchEditor > div.panel.external drawn 307ms after the writer was asked
--- revision editor observed=4a49eddc3fcbe2a898e25ad7914cc5161765f6def403005a72b315254101fc7e
--- sentence editor expect=present drawn=yes ok browser.conflictOrigin.changedWhileOpen
--- sentence editor expect=present drawn=yes ok browser.externalConflict.fileChangedWhileOpen
--- sentence editor expect=present drawn=yes ok browser.externalConflict.revisionObserved
--- sentence editor expect=present drawn=yes ok browser.saveOutcome.retainedDraft
--- sentence editor expect=present drawn=yes ok browser.saveOutcome.diskVersion
--- sentence editor expect=present drawn=yes ok browser.saveOutcome.copyIsReference
--- sentence editor expect=absent drawn=no ok browser.conflictOrigin.refusedSave
--- sentence editor expect=absent drawn=no ok browser.saveOutcome.changedElsewhere
--- sentence editor expect=absent drawn=no ok browser.externalConflict.destinationRequired
--- comparison editor draft=drawn disk=drawn
--- choices editor count=4 [Keep editing · Copy my text · Keep my draft · Load the version on disk]
--- placement editor-panel box=658,44,508x970 scroller=section.detail.svelte-11my561 scrollTop=673 clientHeight=645 scrollHeight=1644 frame=44..689 visible=645px of 970px topVisible=yes
--- placement editor-choices box=667,984,489x23 scroller=section.detail.svelte-11my561 scrollTop=673 clientHeight=645 scrollHeight=1644 frame=44..689 visible=0px of 23px topVisible=no
--- copy editor draftCopied=absent draftCopyFailed=drawn
```

`L02` prints the same lines in Spanish: `choices editor count=4 [Seguir editando · Copiar mi texto ·
Conservar mi borrador · Cargar la versión del disco]`, a panel of `508x1049`, and a choice row of
`489x50` at `y=1035` (0 of 50 px visible). The same holds for its copy disclosure,
`draftCopied=absent draftCopyFailed=drawn`. The observed revision is R1's digest, exactly as in `L01`.

**The copy.** In both proof launches, the disclosure drawn was `draftCopyFailed`. In the shakedown
`S01`, which pressed *Copy my text* about 0.8 s after launch rather than about 6 s, it was
`draftCopied`. The controls were pressed with `HTMLElement.click()` in a hidden, unfocused window
(`hasFocus=false visibility=hidden` on every launch). That is plausibly why the clipboard refused
(no user activation). **This reading does not establish that a real click copies.** It establishes
only that the disclosure drawn is one of the two dictionary sentences, verbatim, and that the
failure is disclosed rather than swallowed.

### 4.2 Reading (b) — the creator that names no file, told of a change (`L03`, `L04`)

Plan:
1. Open `match/conflict.yml` and press *Add a snippet* / *Añadir un fragmento*.
2. Record the destination buttons. None was pressed: `--- destinations creator [config/default.yml ·
   match/conflict.yml · match/other.yml]`.
3. Type `:probe` and a body.
4. The writer writes R1.
5. Read and capture the external panel, then the choices.
6. Name `match/conflict.yml`, then read again.

```
--- sentence creator expect=present drawn=yes ok browser.conflictOrigin.changedWhileOpen
--- sentence creator expect=present drawn=yes ok browser.externalConflict.fileChangedWhileOpen
--- sentence creator expect=present drawn=yes ok browser.externalConflict.affectedFile
--- sentence creator expect=present drawn=yes ok browser.externalConflict.destinationRequired
--- sentence creator expect=present drawn=yes ok browser.saveOutcome.retainedDraft
--- sentence creator expect=present drawn=yes ok browser.saveOutcome.diskVersion
--- sentence creator expect=absent drawn=no ok browser.conflictOrigin.refusedSave
--- text creator-actions Undo Redo Add this snippet Choose the file this snippet should be added to.
--- sentence creator-actions expect=present drawn=yes ok browser.matchCreation.cannotCreate.noDestination
--- choices creator count=2 [Keep editing · Copy my text]
--- placement creator-panel box=658,44,508x738 scroller=section.detail.svelte-11my561 scrollTop=604 clientHeight=645 scrollHeight=1342 frame=44..689 visible=645px of 738px topVisible=yes
--- placement creator-choices box=667,752,489x23 scroller=section.detail.svelte-11my561 scrollTop=604 clientHeight=645 scrollHeight=1342 frame=44..689 visible=0px of 23px topVisible=no
--- pressed section.creator .destinations text="match/conflict.yml"
--- sentence creator-named expect=present drawn=yes ok browser.externalConflict.affectedFile
--- sentence creator-named expect=absent drawn=no ok browser.externalConflict.destinationRequired
--- choices creator-named count=4 [Keep editing · Copy my text · Keep my draft · Load the version on disk]
```

`L04`, in Spanish: `choices creator count=2 [Seguir editando · Copiar mi texto]`, then after naming
the file, `count=4 [Seguir editando · Copiar mi texto · Conservar mi borrador · Cargar la versión del
disco]`. Its actions row reads `Deshacer Rehacer Añadir este fragmento Elige el archivo al que debe
añadirse este fragmento.` The choice row is again below the fold (0 of 23 px).

This is scenario 2 of the mounted suite (`DPT:2265`) in a real window. Every eligible target is
blocked, only *Keep editing* and the copy are offered, and naming the affected file removes the
`destinationRequired` line and brings the reload and *Keep my draft*.

### 4.3 Reading (c) — recovery over a file other than its host's (`L05`, `L06`)

Plan:
1. Open the editor over `:beta` in `match/conflict.yml` and type a draft.
2. The writer writes **R1b**, which removes `:beta`, and the host editor draws its external panel.
3. Press *Keep my draft*. The reapply report draws the manual-resolution sentence and the
   no-correspondence reason (quoted below).
4. Press *Create a new snippet from supported fields* (`recoveryChoiceKey('createFromSupportedFields')`).
5. Name **`match/other.yml`** in the recovery form.
6. `probe_other_writer` writes R3 to that file.
7. Read the recovery form's external panel and the host's.

```
--- reapply host text=espansoConfig applied nothing. This reapply attempt wrote nothing, this window was not moved, and what you kept is still here exactly as it was. The reason follows. espansoConfig could not identify the snippet this change is about in the version on disk. No snippet in that list is written the way this change’s was, and none spells its trigger the way the file spelled it. The snippet may have been removed, or its trigger may have been rewritten or respelled.
--- recovery controls [Stop creating this snippet · match/conflict.yml · match/other.yml · Undo · Redo · Create this snippet]
--- pressed section.matchEditor .recovery text="match/other.yml"
--- writer other wrote=yes
--- panel section.matchEditor .recovery .panel.external drawn 305ms after the writer was asked
--- revision recovery observed=a347935692e6561b90deeddeca34f995210844d75d9c2dd463c1e77824944a43
--- sentence recovery expect=present drawn=yes ok browser.conflictOrigin.changedWhileOpen
--- sentence recovery expect=present drawn=yes ok browser.externalConflict.fileChangedWhileOpen
--- sentence recovery expect=present drawn=yes ok browser.externalConflict.affectedFile
--- sentence recovery expect=present drawn=yes ok browser.externalConflict.revisionObserved
--- sentence recovery expect=absent drawn=no ok browser.externalConflict.destinationRequired
--- sentence recovery-actions expect=present drawn=yes ok browser.externalConflict.fileChangedWhileOpen
--- choices recovery count=3 [Keep editing · Keep my draft · Load the version on disk]
--- revision host-after observed=ae2e8fafeb1d11a4edf24dc710a82c02f9648f84578b606c0aa2ecaab955c15e
--- sentence host-after expect=absent drawn=no ok browser.externalConflict.affectedFile
--- placement host-panel box=658,594,508x936 … visible=95px of 936px topVisible=yes
--- placement recovery-panel box=658,44,508x544 … visible=543px of 544px topVisible=no
--- placement recovery-choices box=667,557,489x23 … visible=23px of 23px topVisible=yes
```

(Quoted from `L05`, elided with `…` only inside the placement lines. `L06` prints the same lines in
Spanish, among them `recovery controls [Dejar de crear este fragmento · match/conflict.yml · match/other.yml ·
Deshacer · Rehacer · Crear este fragmento]` and `choices recovery count=3 [Seguir editando · Conservar
mi borrador · Cargar la versión del disco]`.)

**The host stays over A.** After B changed, its panel still shows the R1b revision
(`ae2e…`) of `match/conflict.yml` and does not name `match/other.yml`. The recovery form shows B's
revision (`a347…`) and names B. There is **no copy** in the recovery form's choices, which is the
declared `RECOVERY_CONFLICT_CAPABILITIES`. **Placement:** the recovery form's panel sat at the top of
the scroller and was fully visible, choices included. The host's panel lay below it, with 95 px (43 px
in Spanish) showing. `topVisible=no` on `recovery-panel` against `box y=44` and `frame 44..689` is
sub-pixel rounding: the helper compares unrounded values. The snapshot `L05/shots/recovery-panel-webview.png`
shows the panel's first line at the top of the pane.

The host in this reading holds an **external** conflict. The mounted scenario 3 (`DPT:2320`) uses a
host in a **save** conflict. A save conflict could not be produced deterministically here, because the
watcher's delivery (~300 ms) races the save. So the host's *save*-arm drawing beside a recovery form's
external arm is **not** read in a window.

### 4.4 The sentences are the ones the mounted suites read

`tools/verbatim.cjs` reads each proof launch's `--- text` lines. It substitutes the transcript's own
revision or the fixed path into the **dictionary files on disk** (`src/lib/i18n/en.json`, `es.json`),
collapses whitespace, and tests for a substring. The check runs in Node, outside the application's
`translate()`. Result: **every present-expected sentence is `VERBATIM` in all six launches.** That
covers the six editor sentences, the four creator sentences, `noDestination`, the four recovery
sentences, the recovery refusal, and the host's two sentences. The only `not-in-text` answers are
the two that must be absent: `draftCopied` (the copy failed, §4.1) and `destinationRequired` after the
file was named. These are the same keys, with the same operands, that `DetailPane.test.ts`'s
*the conflict panels' drawn sentences* suite asserts in both locales.

### 4.5 Placement and scrolling

In every launch the external panel's top was at the detail scroller's top edge (`box y=44`,
`frame=44..689`), with `scrollTop` non-zero. Nothing in the plan scrolled before this measurement,
so this reading attributes the position to the application's reveal. **The scroller's position before
the delivery was not measured**, so that attribution is an inference and not an observation. Two
geometries follow:

| Panel | Panel height | Choice row | Visible without scrolling |
|---|---|---|---|
| editor, EN / ES | 970 / 1049 px | y=984 / 1035 | **0 of 23 / 0 of 50 px** |
| creator, EN / ES | 738 / 772 px | y=752 / 786 | **0 of 23 px** |
| recovery form, EN / ES | 544 / 595 px | y=557 / 609 | 23 of 23 px |

The detail scroller is 645 px tall in a 1180×728 viewport. The comparison block (retained draft plus
the whole disk file) makes the editor's and the creator's panels taller than that. **What a person
sees first is the origin and the explanation, and the choices need a scroll.** This is recorded as an
open item and not changed here (notes §5).

The `*-choices` captures were taken **after the probe itself** called `scrollIntoView`, and the
transcript marks each with `--- scrolled … by-the-probe`. They show the choice row drawn and
labelled. They are not evidence of the reveal.

### 4.6 Snapshot evidence, and which evidence is which

- **Recorder transcript** (`probe.log`). The text, sentence, choice, placement and revision claims
  above come from here. They are DOM and layout readings taken inside the page.
- **WebKit snapshots** (`shots/*-webview.png`, 2360×1520 at dpr 2). These are what WebKit rendered
  for the page. Sixteen were taken on the proof set. This reader looked at
  `L01/shots/editor-copied-webview.png`, `L04/shots/creator-panel-webview.png`, and the shakedowns
  `S02/shots/editor-panel-webview.png` and `S04/shots/recovery-panel-webview.png`. Each shows the
  panel where the transcript placed it, with the sentences the transcript printed. The Spanish one
  draws the whole creator panel in Spanish. The others were not opened.
- **Screen captures** (`shots/*-screen.png`) show **the lock screen** and are not evidence of the
  window. **Window captures** (`screencapture -l`) answered `could not create image from window` on
  every attempt.

## 5. What the reading does **not** prove

- **No human looked, and the screen was locked.** The window was hidden and unfocused. The snapshots
  are WebKit's own render of the page, **not** a composited window. They say nothing about the window
  chrome, the menu or a real display's scaling.
- **No real input.** Controls were pressed with `HTMLElement.click()` and text was set through
  `value` plus an `input` event. So keyboard reach, focus order, a real mouse and the copy under a
  real gesture are all unestablished.
- **A `--- sentence` line is a containment test.** It does not show order, legibility or
  uniqueness. The panel text does show order, and the snapshots show legibility for the four images
  viewed.
- **One harness, one viewport (1180×728), one host.** The placement figures are this layout's. A
  larger window may show the choices.
- **The save-arm host beside the recovery form** (scenario 3 as mounted) was not read (§4.3). Neither
  were scenarios 4 to 6 (one decision on one file, a reopened editor, settlement order). The mounted
  suites carry those.
- **The creator's reload warning is drawn while the reload is not offered.** In the
  `destinationRequired` state the panel still draws *Loading the version on disk moves this window…*
  (L03, L04). That is legitimate text beside a choice that is absent. It is recorded for 2d-6-11's
  wording review (notes §5), and the reading does not judge it.

## 6. Where it is thin

- Two launches per panel, over one fixture each.
- The copy result differed between a shakedown and the proof set (§4.1).
- Twelve of the sixteen snapshots were not opened by this reader.
- The recovery host's origin differs from the mounted scenario's (§4.3).

## 7. Privacy

The only files read or written were synthetic fixtures under `/private/tmp`. The transcripts carry
harness paths and synthetic content only. `tests/corpus/real/` was not touched. The person's text
clipboard was held in shell memory and restored after each launch. It was never written to disk.
