# Phase 2d-6-8c — the narrow window reading of the raw editor's and restore's external conflicts

**Date:** 2026-09-23 (shakedowns 03:20–03:25, proof launches 03:26–03:33 local time)
**Phase:** 2d-6-8c, the last third of 2d-6-8 ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2,
*The orchestrator's cut of 2d-6-8*). It owes what [`2d-6-8b-notes.md`](2d-6-8b-notes.md) §4 item 1
says jsdom could not establish. That is: what a real window draws when another writer changes the
file under the raw editor and the restore pane, in English and Spanish, over the hard fixture
(ruling 38).
**Instrument:** the harness `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, widened in this phase (§2).
**Binary for every proof launch** (`P8-01`–`P8-17`):
`9f91e512b382d6576c3eece92fabfb387a6efaaf999afd99151fe8196c97bd93`, built from `src/probe.ts`
`e6b6aea2…` and `src-tauri/src/probe.rs` `b44b8569…`. The Rust half is unchanged since 2d-6-7c.
The fix round's four launches, `P8-18`–`P8-21` (§9), used binary `6308ad93…`, built from
`src/probe.ts` `c1fa7377…`.

This is a **window reading**. It makes claims about what a real WKWebView window built from this tree
drew. The claims rest on the following, and on nothing else:
- 17 proof launches of a hand-assembled macOS bundle and their transcripts;
- an out-of-app comparison of every transcript against the dictionary files and the fixture bytes;
- the WebKit page snapshots the probe asked for.

**No person looked at a live window.** The screen was locked for the whole reading: every
`screencapture -x` in the launches is solid black, and every window capture answered `could not
create image from window`. §6 says what that costs.

**In short.** In both languages, a change written to disk while the raw editor or the restore pane
was open drew that surface's external panel 304–346 ms after the probe asked the writer to run. The
panel carried:
- the origin;
- the file's own line, and the surface's two lines about what is kept and what the reload does;
- the one observed revision;
- the whole disk text, **character for character the file's**.

The draft or the candidate stayed on screen, unchanged. *Save* (raw) and *Prepare to replace file*
(restore) were disabled. A press with `disabled` lifted, so that the component's handler ran,
issued **no command**.

A further change at the reload's second step **withdrew the confirmation** and drew the new
revision and text. After that:
- the raw **reseed** put the disk text in the box byte for byte and made it editable;
- the restore **retarget** kept the candidate. The next send went out against the adopted revision
  and wrote the candidate's bytes exactly, CRLF included.

A disk text holding CRLF lines and one lone `\r` was named on both panels: the marker *carriage
return U+000D* in the text, and on raw also the reload-refusal sentence, with *Discard my text and
load it* disabled. A forced press of that choice adopted nothing. A language switch in the middle of
that conflict kept the draft and redrew every sentence in the other language.

The viewer refreshed through the guarded path while no editor was open. It issued no reread for
the file while the editor over it conflicted, and another file was still reread during that
conflict.

Every sentence in every panel was attributed to a dictionary key, and nothing but file paths,
batch names and fixture text was left over. **No defect in 2d-6-8's rendering was found.** One
pre-existing rendering fault in `SourceText.svelte` was seen, and is recorded as an open item (§5.1).

---

## 1. What the filesystem showed when this phase began

The harness existed with `launch.sh`, `launch-7c.sh`, the 7c tools and fixtures, and launches up to
`H05`. The four instrument paths were present. `git diff --stat src-tauri/src/main.rs src/main.ts`
read `5 insertions(+), 1 deletion(-)`. `src/probe.ts` was `e452dfb8…` (7c's last) and
`src-tauri/src/probe.rs` was `b44b8569…`. `PROGRESS.json` was already modified; that is the
orchestrator's, and this phase did not touch it.

## 2. What changed in the harness and the instrument (never committed; 2d-8 deletes both)

**Harness** (outside the repository; the same `HARNESS_ROOT`, so `probe.rs` needed no change):

```
launch-8c.sh           a copy of launch-7c.sh. It takes eight plans (§3). The fixture set follows
                       from the plan. For restore plans it seeds one recognised backup batch
                       (.espansoconfig-backups/2026-09-23T000000Z/match/conflict.yml plus the batch
                       marker) inside the launch's own tree, made owner-private (chmod go-rwx)
tools/verbatim-8c.cjs  the out-of-app comparison of §4.8
fixtures/hardcr-alpha-changed-r1.yml   new: the CRLF copy of hard R1 with one lone \r added
fixtures/hard-candidate.yml            new: hard R0 with :alpha's text changed (the backup entry)
fixtures/hardcrlf-candidate.yml        new: the same with every line ending CRLF
launches/S8-01 … S8-11 (shakedowns), P8-01 … P8-17 (proof)
```

```
a569b4d9…  hard-r0.yml                          825 B  LF (7c's)
0b6c6dfd…  hard-alpha-changed-r1.yml            836 B  LF (7c's)
51104dae…  hard-beta-changed-again-r2.yml       842 B  LF (7c's)
edabfe42…  hard-beta-removed-r4.yml             682 B  LF (7c's)
02f0ab57…  hardcrlf-r0.yml                      850 B  CRLF (7c's)
8b5225ea…  hardcrlf-beta-changed-again-r2.yml   867 B  CRLF (7c's)
8347c590…  hardcr-alpha-changed-r1.yml          CRLF, plus one lone \r inside :alpha's block (new)
61266e29…  hard-candidate.yml                   842 B  LF (new)
ca53a69c…  hardcrlf-candidate.yml               867 B  CRLF (new)
a3479356…  other-changed-r1.yml                 match/other.yml's replacement (6c-2's)
```

The hard shape is 7c's §8.1: `|` block bodies at column five, block content that looks like a
comment, a column-five comment owned by `:beta`, an interior blank line and a blank run, a
column-two comment owned by `:gamma`, and a `>-` folded block with a more-indented line. All
content is neutral and synthetic. The real configuration was never read, copied or launched
against. `HOME` and `XDG_CONFIG_HOME` pointed into each launch's own tree.

**Instrument.** Only `src/probe.ts` changed. The `main.rs`/`main.ts` hook diff is unchanged.

- It gained a section, *The raw editor's and restore's external conflicts — Phase 2d-6-8c*, with
  eight cases (§3) and these helpers: `reportRawText`, `commandCounts`, `reportCounts`,
  `reportRereadsSince`, `controlOutsidePanel`, `controlInPanel`, `pressDisabled`, `reportOutside`,
  `reportRawBox`, `waitForObservation`, `placeAndShoot`, `openViewer`, `openRawWithDraft`,
  `openRestoreWithCandidate`, `candidateStep` and `reportCandidate`.
- It gained eight `runCase` arms.
- It gained **no new backend command**.

`pressDisabled` presses a disabled control twice:
1. **as it is.** A real engine dispatches nothing to a disabled button.
2. **with `disabled` lifted for that one press, then put back.** This is the window counterpart of
   8b's jsdom `forcePress`: the component's handler runs, and the model's own door has to refuse.

After each press it prints the counts of `reload_document`, `document_text` and `save_raw_document`,
the three commands that could reread or write.

## 3. The launch recipe and the plans

```sh
npm run build                                            # 193 modules
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol  # dev profile, embedded dist
bash -c '/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-8c.sh <plan>:<en|es> <name>'
```

Every launch goes into a bundle path never used before. There is one plan per launch, and every
plan sets the language through the picker (`--- language picked=<lang> lang=<lang> label=ok` in
each transcript). The writers are 7c's: second = `R1`, third = `R2`, fourth = `R4`, other =
`match/other.yml`.

| Plan | Fixtures (R0 → writers) | What it drives |
|---|---|---|
| `external-raw` | hard R0 → R1, R2, other, R4 (all LF) | See *The plan `external-raw`* below |
| `external-raw-cr` | hard R0 (LF) → `hardcr` R1 (CRLF + lone `\r`) → hard R2 (LF) | See *The plan `external-raw-cr`* below |
| `raw-open-crlf` | hardcrlf R0 | The viewer over the CRLF copy, and raw's opening refusal |
| `external-restore` | hard R0 → R1, R2; candidate `hard-candidate` | See *The plans `external-restore` and `external-restore-cr`* below |
| `external-restore-cr` | hardcrlf R0 → `hardcr` R1 → hardcrlf R2; candidate `hardcrlf-candidate` | The same, over the CRLF copy, with the lone `\r` at the first change |
| `external-restore-drop` | hard R0 → R1; candidate `hard-candidate` | Candidate chosen, change, the batch chosen again (candidate dropped), the entry chosen again |
| `raw-save-race` / `restore-save-race` | hard R0 → R1 | *Save* / *Replace entire file* pressed straight after the writer, before the watcher's reading arrives (~80 ms) |

**The plan `external-raw`:**
1. With the viewer shown and no editor open, the second writer runs. The viewer refreshes.
2. The raw editor opens and a draft line is typed.
3. **C1:** the third writer runs. The probe reads the panel, the box, the section outside the
   panel and the reveal, and forces *Save*.
4. The other file is changed.
5. *Load the version on disk* is pressed (the second step).
6. **C2:** the fourth writer runs, which supersedes the conflict at that step.
7. *Load the version on disk*, then *Discard my text and load it* (the reseed).

**The plan `external-raw-cr`:**
1. The raw editor opens and a draft line is typed.
2. **C1**, a change holding carriage returns: the panel is read.
3. The second step, where the confirmation is forced.
4. The language is switched through the picker.
5. **C2**, an LF change supersedes the conflict. Then the reseed.

**The plans `external-restore` and `external-restore-cr`:**
1. List the batches, choose the batch and the entry: the candidate is drawn. Then *Prepare* (the
   question is drawn).
2. **C1:** the panel, the candidate, the section outside the panel, and *Prepare* forced.
3. The second step.
4. **C2**, which supersedes the conflict at that step.
5. The retarget.
6. *Prepare*, then *Replace entire file*. The probe then waits 1.5 s for the watcher's reading of
   this window's own write.

## 4. The launches

| Launch | Plan | `end`/`failed`/`MISMATCH` | `probe.err` | Panel after the writer (ms) | Target after | Sentences (verbatim-8c) | Verdict |
|---|---|---|---|---|---|---|---|
| `S8-01`–`S8-11` | shakedowns of all eight plans | — | 0 | 282–422 | — | — | shakedown. `S8-04`–`S8-06` failed at *List recognised backup batches* with `backupReadFailed` / `RootNotPrivate { mode: 493 }`: the seeded folder was 0755. The launcher then made it owner-private. `S8-09`/`S8-10` added the save-race plans |
| **`P8-01`** | `external-raw:en` | 1/0/0 | 0 | 308 / 309 | R4 `edabfe42…` | 32, 0 problems | **pass** |
| **`P8-02`** | `external-raw:es` | 1/0/0 | 0 | 304 / 307 | R4 | 32, 0 | **pass** |
| **`P8-03`** | `external-raw-cr:en` (→ es) | 1/0/0 | 0 | 307 / 310 | R2 `51104dae…` | 36, 0 | **pass** |
| **`P8-04`** | `external-raw-cr:es` (→ en) | 1/0/0 | 0 | 306 / 310 | R2 | 36, 0 | **pass** |
| **`P8-05`** | `raw-open-crlf:en` | 1/0/0 | 0 | — | R0 `02f0ab57…` | 4, 0 | **pass** |
| **`P8-06`** | `raw-open-crlf:es` | 1/0/0 | 0 | — | R0 | 4, 0 | **pass** |
| **`P8-07`** | `external-restore:en` | 1/0/0 | 0 | 304 / 308 | **candidate `61266e29…`** | 42, 0 | **pass** |
| **`P8-08`** | `external-restore:es` | 1/0/0 | 0 | 305 / 346 | candidate | 42, 0 | **pass** |
| `P8-09` | `external-restore-cr:en` | **0**/0/0 | 0 | 305 / 307 | candidate `ca53a69c…` | 42, 0 | **no terminal line.** The transcript stops after `--- counts restore-sent`, inside the 1.5 s pause. The launcher's 150 s limit ran out and the process was killed. Every reading before it is present, but the launch is not counted; it was re-run as `P8-17` |
| **`P8-10`** | `external-restore-cr:es` | 1/0/0 | 0 | 305 / 307 | candidate `ca53a69c…` | 42, 0 | **pass** |
| **`P8-11`** | `external-restore-drop:en` | 1/0/0 | 0 | 307 | R1 `0b6c6dfd…` | 34, 0 | **pass** |
| **`P8-12`** | `external-restore-drop:es` | 1/0/0 | 0 | 306 | R1 | 34, 0 | **pass** |
| **`P8-13`** | `raw-save-race:en` | 1/0/0 | 0 | — | R1 | 5, 0 | **pass** |
| **`P8-14`** | `raw-save-race:es` | 1/0/0 | 0 | — | R1 | 5, 0 | **pass** |
| **`P8-15`** | `restore-save-race:en` | 1/0/0 | 0 | — | R1 | 5, 0 | **pass** |
| **`P8-16`** | `restore-save-race:es` | 1/0/0 | 0 | — | R1 | 5, 0 | **pass** |
| **`P8-17`** | `external-restore-cr:en` | 1/0/0 | 0 | 305 / 308 | candidate `ca53a69c…` | 42, 0 | **pass** |

**Each verdict is a conjunction** that this reader checked:
- one `--- end` line, no `--- failed` line and no `MISMATCH` line;
- an empty `probe.err`;
- `verbatim-8c.cjs` reporting 0 problems, no `NOT-FOUND`, and no `MATCHES-NO-FIXTURE`;
- a synthetic tree in which only the files the plan's writers touched differ from `xdg-before`,
  holding the expected bytes;
- `home-files=0`.

Where a raw plan's tree changed `match/other.yml`, it holds `a3479356…`, the fixture written.
**The only writes by the application** are the four restore sends of `P8-07`, `P8-08`, `P8-10` and
`P8-17`, each of which the plan asked for. All four ended with `conflict.yml` byte-identical to the
backup entry. Every other byte change was an external writer's.

### 4.1 The external panels, their origin and their observed revision (C1, all proof launches)

Every present-expected key below printed `expect=present drawn=yes ok` in both languages, and every
absent-expected key printed `expect=absent drawn=no ok`:

| Keys | Raw (`P8-01`–`04`) | Restore (`P8-07`, `08`, `10`, `17`) |
|---|---|---|
| `browser.conflictOrigin.changedWhileOpen`; `browser.externalConflict.fileChangedWhileOpen`; `browser.externalConflict.revisionObserved` (the digest of the fixture written) | present | present |
| `browser.saveOutcome.draftKeptInMemory`; `browser.saveOutcome.reloadDiscardsDraft`; `browser.rawEditor.diskVersion` | present | — |
| `browser.saveOutcome.operationKeptInMemory`; `browser.saveOutcome.reloadRetargetsCandidate`; `browser.saveOutcome.retainedOperation`; `browser.saveOutcome.operation.replaceFileFromBackup`; `browser.saveOutcome.diskVersion` | — | present |
| absent: `browser.conflictOrigin.refusedSave`, `browser.saveOutcome.changedElsewhere`, `browser.saveOutcome.nothingWasWritten` | absent | absent |

- Each panel prints exactly one 64-digit run, the observed revision, which equals the SHA-256 of
  the fixture the writer put there. No *expected* and no *found* is drawn.
- The restore panel also draws the withdrawal of the confirmation (*"Your confirmation is withdrawn,
  because it was given against the reading this window held before…"*), attributed to its key by
  §4.8.
- The choices, verbatim:

```
--- choices raw-c1 count=3 [Keep editing · Copy my text · Load the version on disk]                 (P8-01)
--- choices raw-c1 count=3 [Seguir editando · Copiar mi texto · Cargar la versión del disco]         (P8-02)
--- choices restore-c1 count=2 [Leave this as it is · Load the version on disk]                     (P8-07)
--- choices restore-c1 count=2 [Dejarlo como está · Cargar la versión del disco]                     (P8-08)
```

**The whole disk text.** `verbatim-8c.cjs` compares each `--- disk` line with the fixture bytes. The
line is the panel's `SourceText` box rebuilt: text as text, `<br>` as `\n`, a marker as `⟦label⟧`.
- LF plans: the verdict is `exact` in every case. C1 drew R2 (raw, 842 characters) or R1 (restore,
  836), and C2 drew R4 (raw, 682) or R2 (restore). Nothing was re-indented, trimmed, joined or
  dropped. That covers the column-five bodies, the comment-looking block line, both owned comments,
  the interior blank line, the blank run and the more-indented folded line.
- CRLF plans: the verdict is `crlf-as-one-break` for the CRLF texts, and
  `crlf-as-one-break+lone-cr-as-marker(carriage return U+000D | retorno de carro U+000D)` for the
  `hardcr` text (§4.4).

**Reveal.** The detail scroller was at `scrollTop=0` before every first write, so the scrolling
below is the application's.

| Launch | C1 panel top | C1 panel height | C1 choices visible | Step choices visible |
|---|---|---|---|---|
| raw EN / ES (`P8-01`/`02`) | y=44 (the scroller's top) | 721 / 755 px | **0 of 23 px** | 22 / 22 of 23 |
| raw with `\r` EN / ES (`P8-03`/`04`) | y=44 | 789 / 837 px | **0 of 23** | 23 / 22 of 23 |
| restore EN / ES (`P8-07`/`08`) | y=44 | 822 / 873 px | **0 of 23** | 22 / 23 of 23 |
| restore CRLF ES / EN (`P8-10`/`17`) | y=44 | 890 / 839 px | **0 of 23** | 23 / 23 of 23 |
| restore, candidate dropped (`P8-11`/`12`) | y=47 (EN) | 642 px (EN) | 23 / 23 of 23 | — |

- At C1 the reveal lands the panel's top at the scroller's top. Over the hard fixture the choice
  row is **wholly below the fold** in both languages: 7c's notes §4 item 1, now on the two
  whole-file panels too.
- At the reload's second step, the reveal brings the choice row into view (22–23 of 23 px). That is
  8b's `externalShown` cue with the target at the choices, observed in a window.
- For 1–2 px, `topVisible=no` beside `box y=44` is the sub-pixel rounding 6c-2 §4.3 names.

### 4.2 Direct submission refused; the draft and the candidate kept

**Raw, C1** (`P8-01`, EN):

```
--- box raw-c1 readonly=yes holds-draft=yes length=870
--- controls raw-c1 outside-external [Stop editing · Undo · [off] Redo · [off] Save this file]
--- forced raw-c1-save control=disabled
--- forced raw-c1-save pressed-as-is before=[reload_document=1 document_text=2 save_raw_document=0] after=[reload_document=1 document_text=2 save_raw_document=0]
--- forced raw-c1-save pressed-with-disabled-lifted before=[…] after=[reload_document=1 document_text=2 save_raw_document=0] inFlight=0
```

- The box's `--- disk raw-c1-box` is `fixture+draft-line hard-alpha-changed-r1.yml`: R1 plus the
  probe's typed line. That is the draft, untouched and read-only, beside the disk text.
- `P8-02` prints `[Dejar de editar · Deshacer · [off] Rehacer · [off] Guardar este archivo]` and the
  same zero counts.
- Outside the panel, only `browser.recovery.unavailable.wholeDocumentDraft` is added to the
  section's own lines (attributed by §4.8).

**Restore, C1** (`P8-07`): the question and *Replace entire file with the shown text* are gone.
*Prepare* is disabled, with the refusal line under it:

```
--- controls restore-c1 outside-external [Close · List them again · Backup batch named 2026-09-23T000000Z · match/conflict.yml · [off] Prepare to replace file]
--- forced restore-c1-prepare pressed-with-disabled-lifted before=[reload_document=0 document_text=1 save_raw_document=0] after=[reload_document=0 document_text=1 save_raw_document=0] inFlight=0
--- restore-c1 question-after-forced=absent
--- candidate restore-c1 present
```

- In the section outside the panel, `browser.restore.question` and `browser.restore.confirm` are
  `absent … ok`, and `browser.externalConflict.fileChangedWhileOpen` is `present … ok`. That line is
  the refusal, which repeats the panel's second line (8b §4 item 2, seen).
- The candidate's `--- disk` is `exact hard-candidate.yml` (`crlf-as-one-break
  hardcrlf-candidate.yml` in `P8-10`/`17`) before the change, at C1, and after the retarget.

**Raw's notices under *Save*, and restore's notices beside its refusal.** Both
`browser.externalConflict.observationRetained` and `browser.externalConflict.writeOutcomeUnknown`
were `absent … ok` wherever they were sought: `raw-c1-outside`, `restore-c1-outside` and
`drop-dropped-outside`. The notices themselves were **not reached** (§6).

### 4.3 The reload's second step, supersession, the reseed and the retarget

**Second step (after *Load the version on disk*).**

```
--- choices raw-step count=3 [Keep editing · Copy my text · Discard my text and load it]
--- choices raw-step count=3 [Seguir editando · Copiar mi texto · Descartar mi texto y cargarla]
--- choices restore-step count=2 [Leave this as it is · Load it and keep the text selected here]
--- choices restore-step count=2 [Dejarlo como está · Cargarla y mantener aquí el texto elegido]
```

**Supersession at the second step (C2).** A further writer ran while the panel was at the second
step. The drawn revision changed 307–346 ms later. In every raw and restore launch:
- the new revision's `revisionObserved` was `present` and the old one's `absent`;
- the disk text was the new fixture's;
- the choices went back to *Load the version on disk*, so the confirmation was withdrawn:

```
--- choices raw-c2 count=3 [Keep editing · Copy my text · Load the version on disk]
--- choices restore-c2 count=2 [Dejarlo como está · Cargar la versión del disco]
```

- The draft stayed in the box (`raw-c2-box` = R1 plus the draft line).

**The raw reseed** (`P8-01`/`02`: *Load the version on disk*, then *Discard my text and load it*):

```
--- reseeded raw section=present external=absent
--- box raw-reseeded readonly=no holds-draft=n/a length=682
--- controls raw-reseeded outside-external [Stop editing · [off] Undo · [off] Redo · [off] Save this file]
--- rereads raw-reseed count=1 [#18 document_text args={"id":1}]
```

- `raw-reseeded-box` is `exact hard-beta-removed-r4.yml`: the box holds R4 byte for byte, it is
  editable, and it is clean. *Unsaved changes* is not drawn and *Save* is off.
- The editor stayed open.
- The adoption issued no `reload_document`.
- In `P8-03`/`04`, the reseed after the language switch put `hard-beta-changed-again-r2.yml` in the
  box, `exact`.

**The restore retarget** (*Load the version on disk*, then *Load it and keep the text selected here*):

```
--- retargeted restore section=present external=absent
--- candidate restore-retargeted present
--- controls restore-retargeted outside-external [Close · List them again · Backup batch named 2026-09-23T000000Z · match/conflict.yml · Prepare to replace file]
--- send restore #17 baseRevision="51104dae5ae5827b1dd201cf72935c229d588745b6ec71a2ed77452d2a0c8d85" textLength=842 -> ok
--- after-send restore external=absent drains=3
```

- The candidate is unchanged (`exact hard-candidate.yml`), and *Prepare* is enabled again.
- The send's `baseRevision` is **R2's digest, the adopted revision**, not R0's.
- The outcome panel drew `browser.restore.replaced` (*"This attempt wrote the whole of this
  file…"*).
- `conflict.yml` afterwards is `61266e29…`, the candidate's bytes.
- Over the CRLF copy (`P8-10`, `P8-17`), the send carried `baseRevision` = `8b5225ea…` (hardcrlf
  R2) with `textLength=867`. The file afterwards is `ca53a69c…`, the CRLF candidate byte for byte.
  The carriage returns reached the wire because the candidate never passed through a text box.
- The watcher's reading of this window's own write raised no panel within 1.5 s
  (`external=absent`).

### 4.4 A disk text holding `\r`, named on both panels

The `hardcr` fixture is the CRLF copy of hard R1 plus one lone `\r` inside `:alpha`'s block.

- **Raw** (`P8-03`, EN; `P8-04`, ES). The panel draws:
  - `browser.source.invisible.carriageReturn` (`carriage return U+000D` / `retorno de carro U+000D`);
  - `browser.rawEditor.diskLineEndingsNotPreserved` (*"The version on disk uses carriage returns in
    its line endings, and this editor cannot give them back exactly as they are. … it will not load
    that version into this editor. Your own text is untouched and the file is not written either
    way."*).

  `browser.rawEditor.lineEndingsNotPreserved` (the opening refusal's sentence) is `absent … ok`. At
  the second step the confirmation is drawn and disabled:

  ```
  --- choices rawcr-step count=3 [Keep editing · Copy my text · [off] Discard my text and load it]
  --- forced rawcr-step-confirm pressed-with-disabled-lifted before=[reload_document=0 document_text=1 save_raw_document=0] after=[reload_document=0 document_text=1 save_raw_document=0] inFlight=0
  --- box rawcr-after-forced readonly=yes holds-draft=yes length=859
  --- external rawcr-after-forced present
  ```

  The forced press adopted nothing: the box still holds the draft and the panel stands. An LF change
  then superseded the conflict (`rawcr-c2`). The marker and the refusal sentence went (`absent …
  ok`), the confirmation was enabled, and the reseed took `hard-beta-changed-again-r2.yml`.
- **Restore** (`P8-10`, ES; `P8-17`, EN). The panel draws the marker at C1 and at the second step.
  The CRLF lines of the same text are drawn as one break each, with no marker. The CRLF candidate
  is likewise drawn with one break per line. C2 (hardcrlf R2, CRLF only) draws no marker.
- **Snapshot.** `P8-03/shots/rawcr-step-webview.png` and `P8-10/shots/restore-c1-webview.png` show
  the marker as a bordered pill after `alpha changed on disk`. In both, **the pill itself wraps**:
  *carriage return* ends the visual line and *U+000D* starts the next one at column zero, followed
  by the rest of that same file line. This is §5.1.
- **The opening refusal over the CRLF copy** (`P8-05`/`06`). The viewer draws the whole text
  (`crlf-as-one-break hardcrlf-r0.yml`) and `browser.rawEditor.lineEndingsNotPreserved`. There is
  no *Edit this file's text* control (`rawEditorOpen=absent`), and *Replace this file's text from a
  backup entry* is still offered. The viewer's own scope sentence says *"every line ending is drawn
  as one line break"*, which the conflict panels do not say (7c notes §4 item 7).

### 4.5 A language switch with the conflict standing (`P8-03` EN → ES, `P8-04` ES → EN)

With the CR conflict at its second step, the probe picked the other language through the picker.
- The panel redrew every sought sentence in the new language, `present … ok`, including the marker
  label (`retorno de carro U+000D` ↔ `carriage return U+000D`) and the refusal sentence.
- The disk text stayed the same fixture (`crlf-as-one-break+lone-cr-as-marker`).
- The draft stayed in the box (`box rawcr-switched readonly=yes holds-draft=yes length=859`).
- The disabled confirmation stayed disabled: `[Seguir editando · Copiar mi texto · [off] Descartar
  mi texto y cargarla]` (`P8-03`) and `[Keep editing · Copy my text · [off] Discard my text and load
  it]` (`P8-04`).
- The rest of the plan (supersession and reseed) ran in the switched language.

This is entry 35's locale switch, read in a window on the raw editor only.

### 4.6 The viewer refreshing through the guarded path, and not while the editor conflicts (`P8-01`/`02`)

```
--- viewer refreshed 305ms after the writer was asked
--- rereads viewer count=2 [#11 reload_document args={"id":1} · #12 document_text args={"id":1}]
--- rereads raw-c1 count=0 []
--- other-file reread 313ms after the writer was asked
--- rereads other-file count=2 [#15 reload_document args={"id":2} · #16 document_text args={"id":1}]
```

- **No editor open.** The change to `match/conflict.yml` (id 1) was reread (`reload_document(1)`),
  and the viewer drew R1 `exact`.
- **The raw editor open over the same file.** The next change was delivered to the editor as a
  panel, and **no** `reload_document` and **no** `document_text` were issued for it.
- **With that conflict standing**, a change to `match/other.yml` (id 2), which no surface is over,
  was reread through the same path (`reload_document(2)`). The raw panel's revision was unchanged
  (`--- revision raw-after-other observed=51104dae…`).
- The `document_text(1)` beside it is the viewer's text read again from the **session cache**:
  `document_text` reads "nothing from disk that `get_document` would not" (`commands.rs`), and id 1
  was not reloaded. So it is the window's own projection of R1, not the disk's R2. It is recorded
  here because 8b §2 ruling 4's jsdom case speaks only of the conflicted file's rereads. Nothing in
  it installs the conflicted disk text.

### 4.7 The restore candidate dropped and chosen again (`P8-11`/`12`; 8b §2 ruling 1)

Under a standing conflict, the probe pressed the batch again. The entry list was reread and the
candidate step disappeared (`--- candidate drop-dropped absent`).
- **Went from the panel:** `operationKeptInMemory`, `reloadRetargetsCandidate`, `retainedOperation`
  and `operation.replaceFileFromBackup`, each `absent … ok`.
- **Stayed:** the origin, `fileChangedWhileOpen`, the revision and the disk text.
- The choices stayed `[Leave this as it is · Load the version on disk]` / `[Dejarlo como está ·
  Cargar la versión del disco]`, and *Prepare* was `[off]`.

Choosing the entry again brought the candidate back (`exact hard-candidate.yml`), and all four
lines returned (`present … ok`). **The lines follow the live preview**, as 8b ruled.

### 4.8 The sentences are the dictionary's, verbatim

`tools/verbatim-8c.cjs` runs in Node outside the application. It reads `src/lib/i18n/en.json` and
`es.json` from disk and switches dictionary at each `--- language picked=` line. It then:

1. **Re-derives every `--- sentence` line** from the key and the printed params. Result: **32 / 32 /
   36 / 36 / 4 / 4 / 42 / 42 / 42 / 34 / 34 / 5 / 5 / 5 / 5 / 42 checked, 0 problems** (`P8-01` …
   `P8-17`, less `P8-09`). The in-app verdict agrees every time.
2. **Removes, from every `--- text` line,** the drawn disk text of the same tag and the 64-digit
   revisions, then every dictionary value of that tag's language, longest first. A second pass
   catches headings drawn uppercase by CSS, where `innerText` applies `text-transform`. **In every
   proof launch, every residue** is one of:
   - nothing: every panel text, every step, every outcome;
   - `match/conflict.yml` (the section headers);
   - `2026-09-23T000000Z` (the batch name).

   `disk=removed` for every panel text that has a disk line; not one `NOT-FOUND`.
3. **Holds every `--- disk` line** (panel texts, candidates, raw boxes) against the bytes of the
   fixtures the launch used. Every line matched a named fixture, and none printed
   `MATCHES-NO-FIXTURE`.

So no sentence drawn on these two panels is outside the dictionaries, and no text drawn as the
file's is anything but the file's. Per-launch output: `launches/P8-nn/verbatim.txt`.

### 4.9 The save arm's own origin (`P8-13`–`P8-16`)

*Save* (raw) or *Replace entire file* (restore) was pressed 78–82 ms after the writer ran, before
the watcher's reading could arrive. The save was refused under the lock:

```
--- raw-race saves=1 [#11 ok {"outcome":"conflict","expected":"a569b4d9…","found":"0b6c6dfd…" …] external=absent
```

The save panel drew:
- `browser.conflictOrigin.refusedSave` (*"What is compared here came from a save this app
  attempted…"*);
- `browser.rawEditor.revisionExpected` / `revisionFound` / `revisionDisk` (R0, R1, R1), or the
  `browser.restore.*` three on restore;
- the disk text (`exact hard-alpha-changed-r1.yml`);
- the same choices as the external arm.

`changedWhileOpen` was `absent … ok`. This is 8b's *`refusedSave` on the save arm*, which 7c could
not produce for the operation panels.

**What came after (observed, cause not established):** 3 s later, `drains=1`, which is only the
opening drain. No reading of that change was ever delivered, and the save panel stood alone. The
save conflict had already reported R1 as *found*. Why the watcher's observation of the same bytes
produced no drain was not investigated (notes §4 item 4).

## 5. Seen, and not a defect of this phase

### 5.1 The carriage-return marker wraps inside a line (pre-existing, `SourceText.svelte`)

In both snapshots of §4.4, the `.invisible` pill (`white-space: normal`) breaks between its words at
the end of a long file line. The rest of that file line then continues on a new visual line at
column zero. The file has no line break there: a lone `\r` is not a break in `sourceSegments`.

`SourceText.svelte`'s own comment says that nothing wraps, *"so every visual line is a line the
file has"*. The screen contradicts that claim for a line holding a marker that the box has to scroll.
The rule dates from the renderer's introduction and is shared by every `SourceText` in the app. It
is not 2d-6-8's rendering, so under `CLAUDE.md` §7 it is recorded as an open item (notes §4 item 1)
and not fixed here.

## 6. What the reading does **not** prove

- **No human looked, and the screen was locked.** The window was hidden and unfocused
  (`hasFocus=false visibility=hidden`). The snapshots are WebKit's render of the page, not a
  composited window.
- **No real input.** Controls were pressed with `HTMLElement.click()`, and no keyboard was used.
- **Not reached:**
  - raw's notices under *Save* and restore's notice beside its refusal. `observationRetained` needs a
    reading to arrive while this window's write to the file is in flight (~ms, against a ~300 ms
    delivery). `writeOutcomeUnknown` needs a write whose outcome is unknown. Neither can be timed
    from this plan; the mounted cases carry both (8b §3).
  - the no-candidate reload-unavailable sentence (a refused adoption, then a dropped candidate).
    No refused adoption was produced.
  - *Copy my text* and its disclosure. No plan pressed a copy control, and the launcher restores the
    clipboard anyway.
  - the reload's `alreadyThere` and `refused` arms; only `installed` was read.
- **The locale switch** was read on the raw editor only, at one step.
- **`P8-09`** ended without a terminal line during a pause after its send, and is not counted. Its
  re-run `P8-17` passed. The cause was not investigated: the transcript simply stops, and the timer
  stall of `CLAUDE.md` §6 is one candidate.
- **A `--- sentence` line is a containment test.** The attribution shows that the text holds only
  dictionary values and synthetic data, not that it is legible, except in the snapshots opened (§7).

## 7. Where it is thin, and which snapshots were looked at

- Two proof launches per plan and language pair, over one fixture sequence per plan.
- One viewport, 1180×728.
- **The snapshots this reader opened and looked at** are listed in §9.2, after the fix round. The
  first pass opened only two (`P8-03` raw EN and `P8-10` restore ES), plus a black `…-screen.png` of
  `S8-01` as evidence of the lock. In the restore one, the choices were below the viewport. The
  review found that too thin for an acceptance of *both panels in both languages*, and §9 answers
  it. Every snapshot not listed in §9.2 was not opened.

## 8. Privacy

Only synthetic fixtures under `/private/tmp` were read or written. The transcripts carry harness
paths and synthetic content only. `tests/corpus/real/` was not touched.

## 9. Fix round — the snapshots of both panels in both languages (review finding)

The review ([`phase-2d-6-8c.md`](../reviews/phase-2d-6-8c.md), Codex, `ship-with-fixes`, 0 blockers,
1 SHOULD-FIX) found that the notes marked the window acceptance as met while §7 had inspected only
two snapshots: raw in English and restore in Spanish. The restore one did not show the choice row.
**Re-derived and held.** This section records the inspection the acceptance needs.

### 9.1 What was added

- **The instrument.** `src/probe.ts` (`e6b6aea2…` → `c1fa7377…`), still uncommitted. After the C1
  snapshot, `external-raw` and `external-restore` now scroll the C1 choice row into view **by the
  probe's own hand** and take one more snapshot (`raw-c1-choices`, `restore-c1-choices`). Each
  transcript prints `--- scrolled … by-the-probe`, so the view is not evidence of the reveal.
  Nothing else changed.
- **Four launches**, one each, 03:39–03:40, binary
  `6308ad93c1ba8b5d6cfa0b78514da96dd435230a0b54f30c59ff1c93ff6d57ff`:

| Launch | Plan | `end`/`failed`/`MISMATCH` | `probe.err` | Target after | Sentences (verbatim-8c) | C1 choice row: app's reveal → probe's scroll | Verdict |
|---|---|---|---|---|---|---|---|
| **`P8-18`** | `external-raw:en` | 1/0/0 | 0 | R4 `edabfe42…` | 32, 0 problems | 0 → 22 of 23 px | **pass** |
| **`P8-19`** | `external-raw:es` | 1/0/0 | 0 | R4 | 32, 0 | 0 → 22 of 23 px | **pass** |
| **`P8-20`** | `external-restore:en` | 1/0/0 | 0 | candidate `61266e29…` | 42, 0 | 0 → 22 of 23 px | **pass** |
| **`P8-21`** | `external-restore:es` | 1/0/0 | 0 | candidate | 42, 0 | 0 → 23 of 23 px | **pass** |

The verdict is §4's conjunction. `home-files=0` in all four, and `verbatim-8c.cjs` reported no
`NOT-FOUND`, `MATCHES-NO-FIXTURE`, `WRONG` or `DISAGREES`. These four repeat `P8-01`/`02`/`07`/`08`
with the extra view. Every reading they share with those launches came out the same.

### 9.2 The snapshots opened and looked at, per panel and language

Every image named here was opened and looked at by this reader. They are WebKit page snapshots of a
hidden window (§6), not screen captures.

| Panel · language | The panel's top at C1 (origin, lines, revision) | The C1 choice row, enabled | The second step's choice row, enabled |
|---|---|---|---|
| **Raw · EN** | `P8-01/shots/raw-c1-webview.png`: the panel at the scroller's top. Origin, `fileChangedWhileOpen`, the two draft lines, revision `51104dae…`, *The version on disk* and the hard fixture's text at its columns. The choice row is below the fold | `P8-18/shots/raw-c1-choices-webview.png`: *Keep editing · Copy my text · Load the version on disk*, all three drawn enabled, under the whole disk text | `P8-01/shots/raw-step-webview.png`: *Keep editing · Copy my text · Discard my text and load it*, all enabled, in view after the app's own reveal |
| **Raw · ES** | `P8-19/shots/raw-c1-webview.png`: the same in Spanish (*Lo que se compara aquí viene de la vigilancia del archivo…*, *Tu texto sigue aquí…*, *Cargar la versión del disco sustituye tu texto…*, revision, *La versión del disco*). The row is below the fold | `P8-19/shots/raw-c1-choices-webview.png`: *Seguir editando · Copiar mi texto · Cargar la versión del disco* | `P8-02/shots/raw-step-webview.png`: *Seguir editando · Copiar mi texto · Descartar mi texto y cargarla* |
| **Restore · EN** | `P8-20/shots/restore-c1-webview.png`: origin, file line, *What you asked for here is still set up…*, *Loading the version on disk moves this window to it and leaves this panel open…* with the confirmation's withdrawal, revision `0b6c6dfd…`, *What you asked for, kept here* with the operation sentence, *The version on disk*. The row is below the fold | `P8-20/shots/restore-c1-choices-webview.png`: *Leave this as it is · Load the version on disk* | `P8-07/shots/restore-step-webview.png`: *Leave this as it is · Load it and keep the text selected here* |
| **Restore · ES** | `P8-08/shots/restore-c1-webview.png`: the same in Spanish (*Lo que pediste aquí sigue preparado…*, *Cargar la versión del disco lleva esta ventana a ella y deja este panel abierto…*, *Tu confirmación queda retirada…*, *Lo que pediste, conservado aquí*, *La versión del disco*). The row is below the fold | `P8-21/shots/restore-c1-choices-webview.png`: *Dejarlo como está · Cargar la versión del disco* | `P8-08/shots/restore-step-webview.png`: *Dejarlo como está · Cargarla y mantener aquí el texto elegido* |
| *Also opened (§4.4)* | `P8-03/shots/rawcr-step-webview.png` (raw EN, the lone-`\r` marker, `diskLineEndingsNotPreserved`, a disabled *Discard my text and load it*). `P8-10/shots/restore-c1-webview.png` (restore ES, the marker) | | |

In every image the disk text keeps the hard fixture's columns, blank lines and more-indented folded
line. No choice label is clipped, and the labels are the dictionary's.

**Enabled** is read from the transcripts, not from the picture. A disabled control is drawn in the
muted colour, which a still image cannot tell apart reliably, and each transcript's `--- choices`
line marks a disabled control `[off]`. None of the rows above carries `[off]`, and none of their
labels is drawn muted in the snapshot. The only `[off]` in the proof set is raw's *Discard my text
and load it* over the `\r` text (§4.4). That one is drawn muted in `P8-03/shots/rawcr-step-webview.png`.

### 9.3 What this does and does not change

- **The views of the C1 choice row are the probe's scrolling, not the application's.** The reveal
  still leaves that row below the fold at C1 over the hard fixture, in both languages, on both
  panels (§4.1; notes §4 item 2). The snapshots show what a person gets after scrolling. They do
  not show the reveal reaching the row.
- The second step's row **is** brought into view by the application's own reveal. All four step
  snapshots show it without any probe scrolling.
- **Still not looked at:**
  - the reseed and retarget snapshots (`raw-reseeded`, `restore-retargeted`) and every `S8-*`, `P8-11`–`P8-17` snapshot. Those readings rest on the
    transcripts and the out-of-app comparison;
  - a composited, visible window. The screen was still locked.
- **The unread states of §6 stay unread:** raw's notices under *Save*, restore's notice beside its
  refusal, the no-candidate reload-unavailable sentence, *Copy my text*, and the reload's
  `alreadyThere` / `refused` arms.
