# Phase 2d-7-6-2 — G3: choices, adoption arms and the open-surface refusal (window reading)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-6* and its *Addendum 2026-09-23 — the
orchestrator's cut* (this is the `2d-7-6-2` half), bound by §3 entries 15–18, 23, 25 and 35 and by §5.8.
The G3 rows are the consult's (`docs/reviews/phase-2d-7-design.md:417-432`). What was done and why, the
acceptance clause by clause, the deviations and the open items are in
[`2d-7-6-2-notes.md`](2d-7-6-2-notes.md).
**Instrument:** frozen. The four instrument paths and the fourteen harness files equal
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §5.3 and `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`,
18 of 18, before the first launch (16:15:52) and after the gates (16:29:44) (notes §1).
**Binary for every launch** (`G3-01` … `G3-28`, each launch's `binary.sha256`):
`53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`, the binary 2d-7-4-2 §9.6 built and
2d-7-5 and 2d-7-6-1 used. It was not rebuilt.
**Harness:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh`, `5d5f6397…82ec`.

The claims rest on:
- twenty-eight launches, each on its own bundle path and bundle identifier, and their transcripts
  (`launches/G3-*/probe.log`, `launch.txt`);
- the probe's reconciliation of Rust's tallies against the page's recorded commands, and of emitted
  wakes against delivered ones (entry 15);
- out-of-app scripts: `tools/verbatim-9c.cjs` over every launch, and two scripts of this step,
  `/private/tmp/2d7-6-2-fixturein.cjs` (which fixture's whitespace-collapsed text a `--- text` line
  contains) and `/private/tmp/2d7-6-2-keysets.cjs` (the EN/ES key-set comparison);
- one window capture looked at by the worker (§7).

**The screen read unlocked at every recorded check, unlike 2d-7-5 and 2d-7-6-1.** Every preflight read
`lock=unlocked` (`rule=primary-unlocked-and-cross-check-not-locked`, `CGSSessionScreenIsLocked=absent`),
every one of the 295 beats read `visibility=visible` (55 of them `focus=yes`, 240 `focus=no`), and all 74
captures are `used=window` (`screencapture -l`). **No launch ran with `:keepalive`**, because entry 18
forbids it in a visible launch; every launch reached its terminal line without it. So entry 18's three
conditions were **observed at the sampled instants only**: unlocked at each recorded preflight check,
`visibility=visible` at each of the 295 recorded beats, a window capture at each of the 74 capture
instants. The lock checks and captures are separate from the beats (`G3-03` has 14 beats and four
captures), so nothing is claimed about the conditions between samples. **This reading still makes no visual judgement** beyond the
one capture named in §7: every statement below is about the DOM, the transport or files on disk, and
"drawn" means **present in the DOM**. Visual judgements stay 2d-7-9's.

---

## 1. The launches

| Launch EN / ES | Plan | Fixture set | Family | G3 rows it serves |
|---|---|---|---|---|
| `G3-01` / `G3-15` | `external-recovery` | **plain** (`base-r0`, `beta-removed-r1`, `other-changed-r1`) | authored text | compare (host editor, recovery form); keep (*Keep my draft*); recovery |
| `G3-02` / `G3-16` | `external-creator` | hard LF | authored text | compare (creator) |
| `G3-03` / `G3-17` | `external-deleter` | **hard LF only** | operation | compare; keep ×2; reload, two steps; `installed` |
| `G3-04` / `G3-18` | `external-mover` | **hard LF only** | operation | the same |
| `G3-05` / `G3-19` | `external-duplicator` | **hard LF only** | operation | the same |
| `G3-06` / `G3-20` | `external-mover-untouched` | **hard LF only** | operation | compare; reload, two steps |
| `G3-07` / `G3-21` | `external-raw` | hard LF | whole file | compare; reload, two steps (reseed) |
| `G3-08` / `G3-22` | `external-raw-cr` | hard LF r0, `hardcr-alpha-changed-r1.yml` | whole file | compare over `\r`; the withheld confirmation; reseed |
| `G3-09` / `G3-23` | `external-restore` | hard LF + `hard-candidate.yml` | whole file | compare; reload, two steps (retarget); the send |
| `G3-10` / `G3-24` | `external-restore-cr` | CRLF + `hardcrlf-candidate.yml` | whole file | the same over `\r` |
| `G3-11` / `G3-25` | `external-restore-drop` | hard LF + candidate | whole file | compare with the candidate dropped and re-picked |
| `G3-12` / `G3-26` | `raw-save-race` | hard LF | whole file | the save arm's own conflict (compare, choices) |
| `G3-13` / `G3-27` | `restore-save-race` | hard LF + candidate | whole file | the same, restore |
| `G3-14` / `G3-28` | `restore-registry` | the default set | — | the open-surface refusal (§5) |

`G3-01` … `G3-14` are EN and `G3-15` … `G3-28` their ES twins, plan for plan. **`external-editor` was
not launched**: `launch-7.sh` refused it three times (exit 73, no name spent) because the host clipboard
held a non-plain-text item it could not put back (notes §6 item 1). The copy row (§3) and the editor's
own compare line are therefore not read in this step's launches.

Every launch: `reached-terminal=yes alive-at-kill=yes`, one `--- end` line, `failed-lines=0`,
`mismatch-lines=0`, `reconcile-lines=2 void-lines=0`, `probe.err-bytes=0`, `home-files=0`,
`script-writers=0`, `--- instrument ok probe-commands=14 page=14`, `lsappinfo-bundle-id` equal to the
launch's own `cc.carpio.espansoConfig.probe.G3-NN`, and its language set through the picker
(`--- language picked=<en|es> lang=<en|es> label=ok`). All 56 `--- reconcile` lines read
`commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1]
probe-half=ok`, with `emitted` equal to `delivered` on every one. No launch was voided or re-run. The
clipboard was untouched by all 28 (`copies=no`, `changeCount` unchanged).

"Family" is 2d-7-6-1's grouping (its reading §1): **authored text** (editor, creator, recovery),
**operation** (deleter, mover, duplicator), **whole file** (raw editor, restore).

---

## 2. The choices, per family

"Pressed" means the plan pressed the control by `click()` and printed what followed. Each family's
choice rows are quoted as the transcripts print them (EN; each ES twin prints the same row in Spanish).

### 2.1 Authored text

Rows drawn: host editor `[Keep editing · Copy my text · Keep my draft · Load the version on disk]` (the
row is not printed by `external-recovery` at the host's first conflict; it is quoted from 2d-7-6-1's
`G2-01` as corroboration); recovery form `[Keep editing · Keep my draft · Load the version on disk]`
(`G3-01`); creator without a destination `[Keep editing · Copy my text]`, with one
`[Keep editing · Copy my text · Keep my draft · Load the version on disk]` (`G3-02`).

| Choice | Standing | Evidence |
|---|---|---|
| **Compare** | **read** on the host editor, the recovery form and the creator | The panel's whole rendered text holds the disk version, matched out of app **whitespace-collapsed, not byte for byte** (these plans print no `--- disk` line): host editor after the keep, `beta-removed-r1.yml`; recovery form, `other-changed-r1.yml`; creator and creator-named, `hard-alpha-changed-r1.yml` (`2d7-6-2-fixturein.cjs`, `G3-01`/`15`/`02`/`16`). The retained draft beside it: the host panel prints `beta draft typed by the probe`; the creator's `:probe` / `creator draft typed by the probe` is `verbatim-9c`'s only residue. **Plain fixture set for the host editor and the recovery form.** |
| **Compare, the editor's own plan** (owed from 2d-7-6-1 §7 item 2) | **not run here**; corroboration only | `external-editor` was refused (§1). Out of app over 2d-7-6-1's transcripts, the `--- text editor` line of `G2-01` and of `G2-11` contains `hard-alpha-changed-r1.yml` whitespace-collapsed. So that plan's `disk=absent` reflected its marker (`beta changed on disk`), not a missing disk text. That is a reading of 2d-7-6-1's lines, not a line of this step. |
| **Keep** (*Keep my draft*) | **read, one arm** (host editor) | `--- pressed … choice.keepMyDraft`, then `--- reapply host text=espansoConfig applied nothing. … this window was not moved …` with the reason that the snippet could not be identified in the version on disk (`browser.reapply.manualResolution`). The plain fixture removes `:beta`, so only this arm is reachable; the success arm (`reapplied`) on this family is **unread**. **Plain fixture set.** |
| **Recovery** | **read** | After that keep, `browser.recovery.open` was pressed; `--- recovery controls [Stop creating this snippet · match/conflict.yml · match/other.yml · Undo · Redo · Create this snippet]`; the form named `match/other.yml`; a writer changed that file; its own external panel was drawn in 305–307 ms with the three choices above and `Create this snippet` carrying the `fileChangedWhileOpen` refusal. None of the recovery form's own choices was pressed. **Plain fixture set.** |
| **Reload** (*Load the version on disk*, both steps) | **UNREAD** | No frozen plan presses it on the editor, the creator or the recovery form. |
| **Copy** (*Copy my text*) | **UNREAD in this step** | §3. |
| *Keep editing* | **UNREAD** | No frozen plan presses it on any surface. |

### 2.2 Operation — hard LF set only

Rows drawn (`G3-03`/`04`/`05`): `[Leave this as it is · Keep what I asked for · Load the version on disk]`,
at the reload's second step `[Leave this as it is · Keep what I asked for · Close this and load it]`;
the untouched mover (`G3-06`) `[Leave this as it is · Load the version on disk]` then
`[Leave this as it is · Close this and load it]`. **Copy is not in any row of this family.**

| Choice | Standing | Evidence |
|---|---|---|
| **Compare** | **read**, all three surfaces and the untouched mover | `--- disk <tag>-c1/-c2/-c3` held against the fixtures out of app: `exact hard-alpha-changed-r1.yml` (836 chars), `exact hard-beta-changed-again-r2.yml` (842), `exact hard-beta-removed-r4.yml` (682), on the deleter, mover and duplicator; `mover-untouched exact hard-alpha-changed-r1.yml`. The retained request is drawn beside it (`retainedOperation` and the operation's summary, sentence verdicts `ok`). |
| **Keep** (*Keep what I asked for*) | **read, two arms**, all three surfaces | Over c1: `--- reapply <surface>-keep1 arm=browser.reapply.reapplied` ("This window now shows the version on disk, with what you kept set up over it. …") and `after-keep1 … external=absent`. Over c3 (a version without `:beta`, after a supersession at the second step): `browser.reapply.externalEvidence.baseRevisionMoved` + `browser.reapply.manualResolution` ("… this window was not moved …") and `after-keep2 … external=present`. |
| **Reload**, two steps | **read**, all three surfaces and the untouched mover | Step one → the row's third choice becomes *Close this and load it*, with the surface's reload warning drawn; a writer at that step superseded the conflict (`--- superseded <surface> …ms after the writer was asked`, 305–307 ms) and the row went back to *Load the version on disk*. The final *Load* → *Close this and load it* closed the section (`--- closed <surface> section=absent`). Arm: §4. |
| **Recovery** | **read as refused** | `--- sentence <surface>-c1-outside expect=present drawn=yes ok browser.recovery.unavailable.operationDraft` on all three, EN and ES. No recovery form is offered on this family. |
| *Leave this as it is* | **UNREAD** | Never pressed. |

### 2.3 Whole file — raw editor and restore, LF and CRLF

Rows drawn: raw `[Keep editing · Copy my text · Load the version on disk]`, at the second step
`[Keep editing · Copy my text · Discard my text and load it]`; restore
`[Leave this as it is · Load the version on disk]`, at the second step
`[Leave this as it is · Load it and keep the text selected here]`. **Neither row carries a keep
(*Keep my draft* / *Keep what I asked for*) or a recovery choice.**

| Choice | Standing | Evidence |
|---|---|---|
| **Compare** | **read**, raw and restore, LF and CRLF | Out of app, byte for byte: raw `raw-c1 exact hard-beta-changed-again-r2.yml`, `raw-c2 exact hard-beta-removed-r4.yml`, the box holding `hard-alpha-changed-r1.yml` + the typed line; restore `restore-c1 exact hard-alpha-changed-r1.yml`, `restore-c2 exact hard-beta-changed-again-r2.yml`, candidate `exact hard-candidate.yml`. Over `\r` (`G3-08`, `G3-10`): `crlf-as-one-break+lone-cr-as-marker … hardcr-alpha-changed-r1.yml markers=1`. Dropped and re-picked candidate (`G3-11`): `drop-dropped exact hard-alpha-changed-r1.yml`, `drop-repicked-candidate exact hard-candidate.yml`. |
| **Reload**, two steps — raw (reseed) | **read** | *Load* → *Discard my text and load it* → pressed: `--- reseeded raw section=present external=absent`, `--- rereads raw-reseed count=1 [#18 document_text args={"id":1}]`, box `exact hard-beta-removed-r4.yml` (682 chars), `readonly=no`. Over `\r` (`G3-08`) the confirmation was drawn `[off]`; forced as-is and with `disabled` lifted it issued nothing and the box kept the draft; after an LF supersession the reseed went through (`rawcr-reseeded-box exact hard-beta-changed-again-r2.yml`). |
| **Reload**, two steps — restore (retarget) | **read** | *Load* → *Load it and keep the text selected here* → pressed (`confirmReloadRetargeting`): `--- retargeted restore section=present external=absent`, candidate still `exact hard-candidate.yml`, `rereads restore-retarget count=1 [#15 document_text …]`; the send that followed went against the adopted revision and answered `ok` (`send restore #16 baseRevision="51104dae…" textLength=842 -> ok`; CRLF `8b5225ea…`, 867). |
| **Compare, the save arm's own conflict** | **read** (extra) | `raw-save-race` / `restore-save-race`: the save, pressed 121 / 95 ms after the writer was asked, answered `conflict` (expected `a569b4d9…`, found `0b6c6dfd…`); its panel drew the disk text `exact hard-alpha-changed-r1.yml` and the rows `[Keep editing · Copy my text · Load the version on disk]` / `[Leave this as it is · Load the version on disk]`. Nothing was pressed on them. |
| **Copy** (raw's *Copy my text*) | **UNREAD** | Never pressed. |
| *Keep editing* / *Leave this as it is* | **UNREAD** | Never pressed. |
| **Keep**, **recovery** | **not offered** by any row read on this family | The rows above; whether the family has any other keep or recovery path was not read. |

---

## 3. Copy by `click()`

**UNREAD in this step's launches.** The only plan that presses a copy control is `external-editor`
(`COPY_CASES=" external-editor "` in `launch-7.sh`). The harness refuses a copy case unless it can put
the clipboard back exactly, and the host clipboard held `public.utf8-plain-text` plus
`com.runningwithcrayons.alfred.clipping` at 16:18, at 16:26 and again at the end, so every attempt
stopped with exit 73 before a tree was built. The worker did not change the host clipboard to get past
it. **Corroboration only, not a line of this step:** 2d-7-6-1's `G2-01` and `G2-11` printed `--- copy
editor draftCopied=absent draftCopyFailed=drawn` after the `click()` copy. Copy under a real gesture
stays 2d-7-9's (entry 20).

---

## 4. The adoption arms

**Which paths answer a `DiskAdoptionOutcome`.** `BrowserState.adoptDiskVersion`
(`src/lib/browser/workspace.svelte.ts`) is the one door, and the match surfaces' transitions are its
callers. The raw editor's reseed and the restore's retarget "take no adoption function at all"
(`src/lib/browser/saveOutcome.ts`, the doc comment of `reapplyAuthorizationFor`). Those two are
therefore **not** classed under the three arms. They were read as reload choices (§2.3).

**An observation that bears on the consult's `delay` shape.** In every operation launch the confirming
press issued **no command**: after c3's drain (`#12 drain_external_changes`, `#13` in ES) the page recorded no
further command up to `--- closed`, and Rust's tally reconciled `equal` at `end`. The installed snapshot is the one the drain delivered. So a `delay` on
`reload_document` would not have held this adoption, in these plans. No frozen plan arms `delay` on
`reload_document` in any case.

| Arm | Class | Evidence |
|---|---|---|
| **`installed`** | ***reached*** — deleter, mover and duplicator, EN and ES | After *Close this and load it*, `--- text <surface>-after-close` holds `browser.notice.differentMatch` ("…so the selection was cleared", `verbatim-9c` attribution, all six launches). In `adoptDiskVersion`, only the `installed` branch runs `installView` and `repairAfter`, which produces that notice. `alreadyThere` returns before either, and `refused` installs nothing. Keep2 just before had reported "this window was not moved". **That the notice is this branch's product is a reading of the source, not a transcript line.** |
| keep1's adoption (`reapplied`) | ***reached***, **`installed` or `alreadyThere` — not distinguished** | "This window now shows the version on disk…" is drawn for either arm, and no line tells them apart. |
| **`alreadyThere`** | **unread** | No frozen plan arms `delay`, and nothing in these launches put the window at the disk revision before a confirm. |
| **`refused`** | **unread** | `browser.reapply.adoptionRefused`, `browser.saveOutcome.reloadUnavailable` and `reloadUnavailableOperation` were never drawn: each appears only in `expect=absent drawn=no ok` lines. Keep2's refusal is the reapply's own `baseRevisionMoved` verdict, not the adoption arm. |
| **committed-but-reprojection-failed** | **unreachable, named up front** (entry 23) | Not attempted. |

---

## 5. The open-surface refusal (§5.8)

`restore-registry` is the only plan that prints `--- restore` lines (`reportRestoreRefusal`). `G3-14`:

```
--- restore opened pane=present refusals=[browser.restore.refused.noCandidate] competing=0 prepare=absentOrOff confirm=absentOrOff
--- restore candidate pane=present refusals=[] competing=0 prepare=enabled confirm=absentOrOff
--- restore confirming pane=present refusals=[] competing=0 prepare=absentOrOff confirm=enabled
--- restore final pane=present refusals=[browser.restore.refused.alreadyRestored] competing=0 prepare=absentOrOff confirm=absentOrOff
```

`G3-28` (ES) prints the same four lines. **Every line reads `competing=0`, so the open-surface refusal
is NOT credited: unread.** The instrument's own doc comment on `restorePlan` gives the reason: the
negative half "cannot be constructed from a window", because `DetailPane.svelte`'s `busy` makes the
seven surfaces mutually exclusive. That is the instrument's statement, not a reading of this step.

---

## 6. Languages (entry 25)

- **EN in full:** every row above was run in EN (`G3-01` … `G3-14`), except the editor plan (§1).
- **ES:** every EN launch has an ES twin running the same plan (`G3-15` … `G3-28`). Their structural
  lines (closed, reseeded, retargeted, keep arms, sends, `--- restore` lines, counts) match their EN
  twins line for line, apart from language and a one-higher command sequence number (the ES launch's
  extra `set_menu_labels`).
- **Out of app:** `verbatim-9c.cjs` over all 28 launches ends `summary problems=0 not-found=0
  matches-no-fixture=0` on every one. The residues are only file paths, the batch name, `:beta` and the
  creator's typed draft.
- **Each distinct drawn sentence in ES:** `2d7-6-2-keysets.cjs` over the 28 `verbatim-9c` outputs:
  `en-keys=116 es-keys=116 only-en=0 only-es=0`. Every distinct sentence these reads drew in EN was also
  drawn in ES and matched `es.json` verbatim. **This is bounded by what was drawn:** sentences only the
  unread choices would draw (the copy outcome, the authored-text reload, *Keep editing*) are in neither
  set.

---

## 7. What this reading does not show

- **Visual judgements, except one look.** Entry 18's conditions were observed at the sampled instants only (§1), and the worker looked
  at one capture only: `G3-01/shots/recovery-choices-window.png`. It is the app's own window, not the
  lock screen. It shows the recovery form's external panel with *Keep editing*, *Keep my draft* and
  *Load the version on disk* at its foot, and *Not reconciled* marks beside both files in the sidebar.
  Every other visual claim is **unread**, and the judgements remain 2d-7-9's.
- **No per-action no-write witness** (S5, 2d-7-5 §9): these are retained plans. Launch-wide tallies
  and tree diffs are not cited as entry-16 witnesses anywhere in this record.
- **Nothing of the unread choices**: the authored-text reload, *Keep editing* / *Leave this as it is*
  on every family, copy (§3), the recovery form's own choices, and `alreadyThere` / `refused`.
- **An observation, not a finding:** in the four save-race launches Rust emitted no wake at all
  (`emitted=0 delivered=0` at `end`). No external panel followed the save's own conflict within the
  plan's 3 s wait (`after-reading external=absent savePanel=present drains=1`). Recorded for 2d-7-8.
