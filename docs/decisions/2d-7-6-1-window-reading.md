# Phase 2d-7-6-1 — G2: surface retention, conflict timing and the locale switch (window reading)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-6* and its *Addendum 2026-09-23 — the
orchestrator's cut* (this is the `2d-7-6-1` half), bound by §3 entries 15–18, 23 and 25 and by §5.8. The
G2 rows are the consult's (`docs/reviews/phase-2d-7-design.md:408-416`). What was done and why, the
acceptance clause by clause, the deviations and the open items are in
[`2d-7-6-1-notes.md`](2d-7-6-1-notes.md).
**Instrument:** frozen. The four instrument paths and the fourteen harness files equal
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §5.3 and `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`,
18 of 18, before the first launch (11:06:28) and after the gates (11:18:43) (notes §1).
**Binary for every launch** (`G2-01` … `G2-20`, each launch's `binary.sha256`):
`53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`, the binary 2d-7-4-2 §9.6 built from
the final instrument bytes and 2d-7-5 used. It was not rebuilt.
**Harness:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh`, `5d5f6397…82ec`.

This is a **window reading with every visual claim unread.** It makes claims about what a WKWebView
window built from this tree dispatched, received and put in its DOM, and about files on disk. The
claims rest on:
- twenty launches, each on its own bundle path and bundle identifier, and their transcripts
  (`launches/G2-*/probe.log`, `launch.txt`);
- the probe's reconciliation of Rust's tallies against the page's recorded commands, and of emitted
  wakes against delivered ones (entry 15);
- out-of-app scripts: `tools/verbatim-9c.cjs` over every launch, `tools/verbatim.cjs` over the three
  authored-text launches per language, and two scripts of this step
  (`/private/tmp/2d7-6-1-window.cjs`, the per-action command window; `/private/tmp/2d7-6-1-keysets.cjs`,
  the EN/ES key-set comparison).

**The screen was locked for every launch.** Every preflight and every `lock-at-end` read locked:

```
--- preflight lock=locked rule=primary-locked primary="locked source=CGSessionCopyCurrentDictionary CGSSessionScreenIsLocked=1 kCGSessionOnConsoleKey=true" cross-check=ioreg:IOConsoleUsers[uid=501,onConsole=true].CGSSessionScreenIsLocked=true at=11:07:50.640
lock-at-end=locked (primary-locked)
```

Entry 18's first condition therefore fails at every moment of this step. All 64 captures are the
WebKit page snapshot (`used=webview reason=screen-locked(primary-locked)`), every beat reads
`visibility=hidden focus=no`, and **no statement below is about what a person would see.** "Drawn"
means **present in the DOM**. Every launch ran with `:keepalive`, which entry 18 allows in a hidden
launch; it is disclosed here. Timing figures (for example "panel drawn 305 ms after the writer was
asked") were taken under the keep-alive's load and mean only "within the plan's wait".

---

## 1. The launches

| Launch | Plan | Lang | Fixture set | Beats | G2 rows it serves |
|---|---|---|---|---|---|
| `G2-01` | `external-editor:en:keepalive` | en | hard LF | 11 | retention (editor); enabled-state (authored) |
| `G2-02` | `external-creator:en:keepalive` | en | hard LF | 11 | retention (creator); enabled-state (authored) |
| `G2-03` | `external-recovery:en:keepalive` | en | **plain** (`base-r0` / `beta-removed-r1`) | 9 | retention (recovery) |
| `G2-04` | `external-deleter:en:keepalive` | en | hard LF | 14 | retention (deleter); enabled-state (operation) |
| `G2-05` | `external-mover:en:keepalive` | en | hard LF | 14 | retention (mover); enabled-state (operation) |
| `G2-06` | `external-duplicator:en:keepalive` | en | hard LF | 14 | retention (duplicator); enabled-state (operation) |
| `G2-07` | `external-raw:en:keepalive` | en | hard LF | 16 | retention (raw); enabled-state (whole-file) |
| `G2-08` | `external-restore:en:keepalive` | en | hard LF + `hard-candidate.yml` | 17 | retention (restore); enabled-state (whole-file) |
| `G2-09` | `status-held:en:keepalive` | en | hard LF | 14 | disabled-state timing (raw), *held* |
| `G2-10` | `external-raw-cr:en:keepalive` | en → **es** | hard LF r0, `hardcr-alpha-changed-r1.yml` | 11 | locale switch (whole-file, raw) |
| `G2-11` … `G2-18` | the eight above, `:es:keepalive` | es | as their EN twins | 11, 11, 9, 14, 14, 14, 16, 17 | the same rows in ES |
| `G2-19` | `status-held:es:keepalive` | es | hard LF | 14 | disabled-state timing in ES |
| `G2-20` | `external-raw-cr:es:keepalive` | es → **en** | as `G2-10` | 11 | locale switch, the other direction |

Every launch: `reached-terminal=yes alive-at-kill=yes`, one `--- end` line, `failed-lines=0`,
`mismatch-lines=0`, `reconcile-lines=2 void-lines=0`, `probe.err-bytes=0`, `home-files=0`,
`script-writers=0`, `--- instrument ok probe-commands=14 page=14`, `--- recorder-ordering …
verdict=ok`, and `lsappinfo-bundle-id` equal to the launch's own
`cc.carpio.espansoConfig.probe.G2-NN`. Every launch's language was set through the picker
(`--- language picked=<en|es> lang=<en|es> label=ok`). **No launch had a Rust/page command mismatch**;
none was voided and none re-run. Both `--- reconcile` lines of every launch read
`commands=equal(except-plugin:event)`, `probe-half=ok`, and `events=observed` (or
`none-emitted(spy=installed)` at `start`), with `emitted` equal to `delivered`.

The family grouping used below is the one the three 2d-6 panel readings used: **authored text**
(editor, creator, recovery — 2d-6-6c-2), **operation** (deleter, mover, duplicator — 2d-6-7c) and
**whole file** (raw editor, restore — 2d-6-8c). The record and the consult name "family" without
defining it; this is the reading's choice, and it says so.

---

## 2. Retention — the eight surfaces

Each plan opens its surface with a draft, a request or a candidate, has the probe's writer change the
file under it, waits for the conflict panel, and reads the retained value back from the DOM.

### 2.1 Per surface, one line (entry 17)

"Commands in the action window" is the list the page recorded between the writer that raised the
conflict and the line that reads the retained value back (`/private/tmp/2d7-6-1-window.cjs`; Rust's
application tally reconciled `equal` with the page at `end`). **Entry 16's per-action witness is UNREAD
on every row** (§2.3).

| # | Surface | Launch EN / ES | Retained value read back | Commands in the action window | Per-action witness (entry 16) | Class | Standing |
|---|---|---|---|---|---|---|---|
| 1 | Match editor | G2-01 / G2-11 | `--- comparison editor draft=drawn`: the typed draft `beta draft typed by the probe` is in the panel's DOM text; `retainedDraft` sentence drawn | `#10 drain_external_changes` / `#11 drain_external_changes`; write commands none | **UNREAD** | *reached* | **value read**; no-write unread |
| 2 | Creator | G2-02 / G2-12 | the typed trigger `:probe` and body `creator draft typed by the probe` in the panel text (they are `verbatim-9c`'s residue there, beside no fixture text); `retainedDraft` drawn | `#9` / `#10 drain_external_changes`; none | **UNREAD** | *reached* | **value read**; no-write unread |
| 3 | Recovery (over `match/other.yml`, host editor over `match/conflict.yml`) | G2-03 / G2-13 | the recovery panel draws `retainedDraft` ("Your text is still here…"); the **host** panel still draws the draft value (`beta draft typed by the probe`, `--- text host-after`); **the recovery form's own field values are not printed by the plan** | `#10`, `#11` / `#11`, `#12 drain_external_changes`; none | **UNREAD** | *reached* | **partial**: the sentence and the host's draft read; the form's fields unread. **Plain fixture set** (owed from 2d-7-5) |
| 4 | Deleter | G2-04 / G2-14 | `retainedOperation`, `operationKeptInMemory` and `operation.deleteSnippet` drawn at c1 (`verbatim-9c`: VERBATIM, agrees) | `#10` / `#11 drain_external_changes`; none | **UNREAD** | *reached* | **value read**; no-write unread |
| 5 | Mover (request: top of list) | G2-05 / G2-15 | `retainedOperation`, `operationKeptInMemory`, `operation.moveToTop` drawn at c1 | `#10` / `#11 drain_external_changes`; none; forced press `commands=0` | **UNREAD** | *reached* | **value read**; no-write unread |
| 6 | Duplicator | G2-06 / G2-16 | `retainedOperation`, `operationKeptInMemory`, `operation.duplicateSnippet` drawn at c1 | `#10` / `#11 drain_external_changes`; none; forced press `commands=0` | **UNREAD** | *reached* | **value read**; no-write unread |
| 7 | Raw editor | G2-07 / G2-17 | `--- box raw-c1 readonly=yes holds-draft=yes length=870`; out of app, the box text is `hard-alpha-changed-r1.yml` plus the typed draft line, byte for byte (`disk raw-c1-box fixture+draft-line … chars=870`) | `#13` / `#14 drain_external_changes`; none; `counts raw-before` = `counts raw-c1` (`save_raw_document=0`); forced save, as-is and with `disabled` lifted, issued nothing | **UNREAD** | *reached* | **value read**; no-write unread |
| 8 | Restore | G2-08 / G2-18 | `--- candidate restore-c1 present`; out of app the candidate box equals `hard-candidate.yml` (`disk restore-c1-candidate exact hard-candidate.yml chars=842`) | `#13` / `#14 drain_external_changes`; none; forced *prepare* issued nothing | **UNREAD** | *reached* | **value read**; no-write unread |

The operation panels were read on the **hard LF set only**: `launch-7.sh` gives the three operation
plans no CRLF set (owed from 2d-7-5, `2d-7-4-2-notes.md` §8 item 8).

### 2.2 Transcript lines

Editor, `G2-01`:

```
--- before section.matchEditor > div.panel.external absent
--- writer second wrote=yes
--- delivered n=1 handler=1439370238 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=763ms
--- ipc #10 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322 disk=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db content=Projected] t=764ms dt=0ms
--- panel section.matchEditor > div.panel.external drawn 305ms after the writer was asked
--- sentence editor expect=present drawn=yes ok browser.saveOutcome.retainedDraft
--- comparison editor draft=drawn disk=absent
--- choices editor count=4 [Keep editing · Copy my text · Keep my draft · Load the version on disk]
```

Recovery, `G2-03` (the host panel after the recovery form's conflict; cut):

```
--- pressed section.matchEditor .recovery text="match/other.yml"
--- writer other wrote=yes
--- panel section.matchEditor .recovery .panel.external drawn 366ms after the writer was asked
--- choices recovery count=3 [Keep editing · Keep my draft · Load the version on disk]
--- text host-after … What you wrote, kept here Trigger left as the file has it :beta Replacement text this text would be written beta draft typed by the probe …
```

Mover, `G2-05`:

```
--- controls mover-before outside-external [Leave it where it is · Move this snippet]
--- writer second wrote=yes
--- panel section.mover > div.panel.external drawn 305ms after the writer was asked
--- text mover-c1 … What you asked for here is still set up, exactly as you left it. … What you asked for, kept here You asked to move this snipp…
--- controls mover-c1 outside-external [Leave it where it is · [off] Move this snippet]
--- send mover-c1 control=disabled
--- send mover-c1 pressed-anyway commands=0 panels=1->1
```

Raw editor, `G2-07`:

```
--- box raw-drafted readonly=no holds-draft=yes length=870
--- controls raw-before outside-external [Stop editing · Undo · [off] Redo · Save this file]
--- counts raw-before reload_document=1 document_text=2 save_raw_document=0 inFlight=0
--- writer third wrote=yes
--- panel raw-c1 drawn 364ms after the writer was asked
--- box raw-c1 readonly=yes holds-draft=yes length=870
--- controls raw-c1 outside-external [Stop editing · Undo · [off] Redo · [off] Save this file]
--- forced raw-c1-save pressed-with-disabled-lifted before=[reload_document=1 document_text=2 save_raw_document=0] after=[reload_document=1 document_text=2 save_raw_document=0] inFlight=0
--- counts raw-c1 reload_document=1 document_text=2 save_raw_document=0 inFlight=0
```

Restore, `G2-08`:

```
--- controls restore-confirming outside-external [Close · List them again · Backup batch named 2026-09-23T000000Z · match/conflict.yml · Replace entire file with the shown text · Do not replace this file]
--- counts restore-before reload_document=0 document_text=1 save_raw_document=0 inFlight=0
--- writer second wrote=yes
--- panel restore-c1 drawn 309ms after the writer was asked
--- candidate restore-c1 present
--- controls restore-c1 outside-external [Close · List them again · Backup batch named 2026-09-23T000000Z · match/conflict.yml · [off] Prepare to replace file]
--- restore-c1 question-after-forced=absent
```

Out of app (`verbatim-9c.cjs`, `G2-07` and `G2-08`):

```
disk raw-c1-box fixture+draft-line hard-alpha-changed-r1.yml chars=870 markers=0
disk restore-c1-candidate exact hard-candidate.yml chars=842 markers=0
```

### 2.3 Why every per-action witness is unread, and what is recorded instead

All eight plans are **retained plans** (`2d-7-4-2-notes.md` §8 item 7; `2d-7-5-notes.md` §9). They take
only the launch-wide `start` and `end` checkpoints, and their probe writers take no witness when they
return. Entry 16's files part (each writer-changed file equal to the witness taken just after that
writer returned) and its time part (from the checkpoint before the action) therefore cannot be met.
**Every row's per-action `writes=0 witness=unchanged(except …)` claim is UNREAD.** The following are
separate, labelled observations and are **not** that claim:

- *Commands, action window:* the page's records in the window hold no write command on any of the
  eight rows (table, column 5). The page records a command when it is answered. Rust's application
  tally reconciled `equal` with the page at `end`.
- *Commands, launch-wide:* `rust-writes=0` in the six authored and operation launches and in the raw
  launches. In the restore launches it is `rust-writes=1`, from the plan's own final send
  (`#16 save_raw_document` in `G2-08`, `#17` in `G2-18`), pressed after the retention action.
- *Launch spans:* every one reads `witness=CHANGED(except none)`. Probe writers are not named as
  exceptions (`2d-7-4-2-notes.md` §8 item 3), so the span is not evidence either way.
- *Final files:* `launch-7.sh`'s tree diff lists `match/conflict.yml` in every launch, `match/other.yml`
  in the recovery and raw launches (the probe's other writer), and the app's own backup batch in the
  restore launches only (their final send).

---

## 3. Disabled-state timing — a conflict while the send is in flight

**Only the raw editor has a plan for this shape**: `status-held` arms `delay` on `save_raw_document`'s
answer (7000 ms), presses *Save*, and runs the second writer 200 ms into the hold. `delay` is the only
substitution armed, so the class is ***held*** (entry 17). The plan makes no no-write claim, and its
save commits (the launch's `rust-writes=1` is that save).

`G2-09`:

```
--- box raw-drafted readonly=no holds-draft=yes length=859
--- substituted #10 save_raw_document answered; held 7000ms by the probe t=516ms
--- writer second wrote=yes
--- delivered n=1 handler=4180987144 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=1022ms
--- ipc #11 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=a569b4d9426631b0a9b59ca7e3e26c3918f6d5f3371b6b0c6b2f4822a12e8322 disk=0b6c6dfd8a2c1a05466a3c4f1ac0781359a98999fba2dcd8e119e677a9af90db content=Projected] t=1022ms dt=1ms
--- waited the pane’s held sentence 566ms
--- region hd-pane present controls=[[off] Check the observed change now] rendered=yes
--- text hd-pane What this window shows of this file has not been reconciled with the file on disk. An observed change is waiting to be checked against this window’s state. Check the observed change now A write to a file is still in progress. This is available once it finishes.
--- controls hd-raw outside-external [[off] Stop editing · Undo · [off] Redo · [off] Save this file]
--- substituted #10 save_raw_document released t=7516ms
--- ipc #10 save_raw_document args={"document":1,"baseRevision":"a569b4d9…",…} -> ok answer={"outcome":"saved","revision":"d4d2ab1732df7623a3825c6679b498083636f936e1bb0b3c479d4be8705c9cb4","committed":true,"notes":[],"backup_taken":true,"moved":null} t=496ms dt=7021ms
--- waited the held sentence to go 7265ms
--- region hd-released-pane present controls=[] rendered=yes
--- hd released raw-external=present
--- choices hd-released-panel count=3 [Keep editing · Copy my text · Load the version on disk]
```

**Reading.** With the save answered by Rust but held by the probe, a foreign write was observed and
delivered. Sampled once during the hold (the `hd-pane` and `hd-raw` lines, about 0.6 s after the
press), the pane drew the *held* sentence (`browser.externalConflict.observationRetained`), with its
retry disabled and the `writeInFlight` refusal (`browser.reconciliation.refusal.writeInFlight`), and the
raw editor's *Save*, *Stop editing* and *Redo* were disabled. The held sentence was next seen gone
7265 ms after the press, after the release. **Whether the raw editor's external-conflict panel existed
during the hold is UNREAD**: `statusHeldPlan` samples the raw section through `reportOutside`, which
lists only the controls outside `div.panel.external` and removes that panel from the text it prints, so
no line reports the panel's presence or absence before the release. After the release
(`--- hd released raw-external=present`) the raw editor's external-conflict panel was present, showing the disk text `hard-alpha-changed-r1.yml`
exactly (out of app: `disk hd-released-panel exact hard-alpha-changed-r1.yml chars=836`), with the
three choices. `G2-19` (ES) has the same shape: held 7000 ms, `[off] Comprobar ahora el cambio
observado`, `[[off] Dejar de editar · Deshacer · [off] Rehacer · [off] Guardar este archivo]`, then
`raw-external=present` with `[Seguir editando · Copiar mi texto · Cargar la versión del disco]`.

**Classed:** raw editor (whole-file family) — ***reached under a held answer.*** Every other surface
(editor, creator, recovery, deleter, mover, duplicator, restore) is **unread**: no frozen plan arms
`delay` on their send (`save_match`, `create_match`, `delete_match`, `move_match`, `duplicate_match`, or
the restore's `save_raw_document`) with a writer during the hold. `raw-save-race` and
`restore-save-race` race a real save against the watcher without `delay`. That is the save arm's own
conflict, not this row's shape, and they were not run. So the **authored-text and operation
families are unread**, and the whole-file family is read on one of its two members.

---

## 4. Enabled-state timing — a conflict with the send enabled and unpressed

Read from each plan's control list printed before the writer and again at the first conflict. The page
issued no write command before the panel (§2.1) in any of them. Class ***reached*** wherever read.

| Family | Surface | Before the writer | At the first conflict | Standing |
|---|---|---|---|---|
| Operation | Deleter (G2-04/14) | `[Leave this alone · Delete it · Keep it]` (the question's *Delete it* enabled) | `[Leave this alone]`: the question withdrawn | **read** |
| Operation | Mover (G2-05/15) | `[Leave it where it is · Move this snippet]` | `[… · [off] Move this snippet]`; forced press `commands=0` | **read** |
| Operation | Duplicator (G2-06/16) | `[Leave this alone · Duplicate this snippet]` | `[… · [off] Duplicate this snippet]`; forced press `commands=0` | **read** |
| Whole file | Raw editor (G2-07/17) | `[Stop editing · Undo · [off] Redo · Save this file]` | `[… · [off] Save this file]`; forced save (as-is and with `disabled` lifted) issued nothing | **read** |
| Whole file | Restore (G2-08/18) | `[… · Replace entire file with the shown text · Do not replace this file]` (the confirming step) | `[… · [off] Prepare to replace file]`; the question withdrawn; forced *prepare* issued nothing | **read** |
| Authored text | Editor (G2-01/11) | draft typed, no press; **the save control's state is not printed** | conflict panel drawn; no `save_match` issued | **partial**: unpressed read, "enabled" unread |
| Authored text | Creator (G2-02/12) | no destination chosen, so its send carries the `cannotCreate.noDestination` refusal (`--- text creator-actions Undo Redo Add this snippet Choose the file this snippet should be added to.`) | the same | **unread as specified**: the plan's send is not enabled before the writer |
| Authored text | Recovery (G2-03/13) | form open over `match/other.yml`; control state before the writer not printed | `recovery-actions`: `Create this snippet` with the `fileChangedWhileOpen` refusal | **partial**: the after state read, the before state unread |

So the operation and whole-file families are **read** on every member. The authored-text family is
**partial**: no frozen plan prints the editor's or the recovery form's send state before the writer, and
the creator plan never enables its send.

---

## 5. The locale switch with each family open

**Only `external-raw-cr` switches language with a write surface open.** It switches with the raw
editor's conflict standing at the reload's second step, after the withheld confirmation.

`G2-10` (EN → ES):

```
--- box rawcr-after-forced readonly=yes holds-draft=yes length=859
--- external rawcr-after-forced present
--- language picked=es lang=es label=ok
--- ipc #11 set_menu_labels args={"labels":{"about":"Acerca de espansoConfig","services":"Servicios",…
--- text rawcr-switched Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras esto estaba abierto. …
--- sentence rawcr-switched expect=present drawn=yes ok browser.externalConflict.revisionObserved params={"revision":"8347c590cecff008f21aff6cbe9daed42044ad7d27d833f1cdd35ffe8787dcca"}
--- sentence rawcr-switched expect=present drawn=yes ok browser.source.invisible.carriageReturn params={"code":"U+000D"}
--- choices rawcr-switched count=3 [Seguir editando · Copiar mi texto · [off] Descartar mi texto y cargarla]
--- box rawcr-switched readonly=yes holds-draft=yes length=859
```

`G2-20` (ES → EN): `--- language picked=en lang=en label=ok`, then `choices rawcr-switched count=3
[Keep editing · Copy my text · [off] Discard my text and load it]` and `box rawcr-switched readonly=yes
holds-draft=yes length=859`.

Out of app, `verbatim-9c.cjs` (which follows the `--- language picked=` line) re-derived all eleven
`rawcr-switched` sentence verdicts in the new language as `VERBATIM agrees ok`, eight present and three
absent, in both launches.

**Reading.** Across the switch the conflict panel stayed drawn with the same observed revision, redrawn
wholly in the new language, including the carriage-return marker's label. The draft stayed in the box
(`holds-draft=yes`, same length), the box stayed read-only, the reload's confirmation stayed withheld,
and the switch issued `set_menu_labels` and no other application command. ***Reached.***

**Classed per family:**
- **Whole file:** read on the raw editor; **restore unread**. No plan switches language with the
  restore pane open.
- **Authored text:** **unread**. No plan switches language with the editor, creator or recovery
  open.
- **Operation:** **unread**. No plan switches language with the deleter, mover or duplicator open.

`status-uncertain-route` also switches language, but over the status route under a `mayHaveWritten`
substitution. That is *constructed* (entry 17), not a write surface, and it was not run.

---

## 6. Languages (entry 25)

- **EN in full:** every row above was run in EN (`G2-01` … `G2-10`).
- **ES:** every EN launch has an ES twin running the same plan (`G2-11` … `G2-20`). `G2-10` and `G2-20`
  each draw the raw panel in both languages.
- **Out-of-app verbatim check:**
  - `verbatim-9c.cjs` over all twenty launches: every one ends `summary problems=0 not-found=0
    matches-no-fixture=0`. The residues are only file paths, the batch name, triggers and the probe's
    typed creator draft. The sentence re-derivations agree on every checked sentence: 45 / 43 / 43
    (deleter, mover, duplicator), 32 (raw), 42 (restore), 5 (held) and 36 (raw-cr) per launch, in each
    language.
  - `verbatim.cjs` checks the authored-text plans, whose `--- sentence` lines `verbatim-9c.cjs` does
    not parse. It found 7 / 6 / 7 keys VERBATIM for the editor, creator and recovery in each language.
    Its only `not-in-text` lines are the two expected absences: `draftCopied` (the copy failed, which
    is 2d-7-6-2's subject) and `destinationRequired` once a destination is named.
- **Each distinct drawn sentence in ES:** `/private/tmp/2d7-6-1-keysets.cjs` collects every dictionary
  key `verbatim-9c.cjs` attributed to drawn text, per language, over all twenty launches:
  `en-keys=115 es-keys=115 only-en=0 only-es=0`. Every distinct sentence these reads drew in EN was
  also drawn in ES and matched `es.json` verbatim. An alternation such as
  `browser.saveOutcome.diskVersion|browser.rawEditor.diskVersion`, where two keys hold the same value,
  counts as one item.

---

## 7. What this reading does not show

- **Nothing visual.** The screen was locked. 2d-7-9 owes every visual judgement.
- **No per-action no-write witness on any surface** (§2.3).
- **Nothing of G3.** The editor's copy (`draftCopyFailed` drawn after a `click()` copy), keep, reload,
  the adoption arms and the open-surface refusal were drawn in these launches, but they are 2d-7-6-2's
  subject and are not read here. `--- restore` lines with `competing≥1` were not looked for.
- **No claim about sends not made** beyond the forced presses above, and no claim about the 150–300 ms
  boundary or any timing beyond "within the wait".
