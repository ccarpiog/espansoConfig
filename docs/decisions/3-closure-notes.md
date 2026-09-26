# Phase 3 — the closure record

**Spec:** `PROGRESS.md` *Next action* (2026-09-26, after 3-14): *"the Phase 3 closure, records only"*;
[`3-split-notes.md`](3-split-notes.md) §2 *3-15* (acceptance clauses 5 and 6), §4.1, §4.8 and §7;
[`3-15-2-notes.md`](3-15-2-notes.md) §2, §3, §4, §5, §7 and §8, which this record brings up to date.
**Risk:** routine. **Records only.** No source, test, configuration or dictionary file changed. This file
is new, and `3-15-2-notes.md` §3 and §7 carry dated corrections that point here. No window reading was
performed or claimed, no app was launched and no real-config file was opened.

Every figure below was read on 2026-09-26 against `main` at `6744752`.

---

## 1. What closed Phase 3, and when

- **3-15-2 left Phase 3 open for two owed items only.** It recorded that 3-13-3 and 3-14 were owed to
  an attended session under the owner ruling of 2026-09-24 (`3-15-2-notes.md` §7; `3-split-notes.md`
  §4.8). It closed 3-15-2 and step 3-15 and nothing else (`de08385`, 2026-09-24; SHA recorded by
  `a301f16`).
- **3-13-3 closed on 2026-09-26** in an attended session: commit `743da1d` (10:31:35 +0100), *"Phase
  3-13-3 — display names and creation defaults: the window half, closed"*. The window half ran on an
  unlocked screen between 10:19:14 and 10:23:11 (`3-13-3-notes.md` §1). Review: `ship-with-fixes`, 0
  blockers, 2 should-fix on the records (`docs/reviews/phase-3-13-3.md`). The notes as committed hold the
  two fixes (the isolation claim is limited to config and sidecar storage, §1 *Isolation*; the paste
  claim is left unresolved, §5 item 2). With 3-13-3 closed, **step 3-13 closed** (3-13-1 and 3-13-2 were
  already closed; `PROGRESS.md` status table).
- **3-14 closed on 2026-09-26** in the same session: commit `6744752` (10:55:39 +0100), *"Phase 3-14 —
  delete-conflict wording and action placement, closed"*. The owner's CF-52 and CF-54 rulings were
  quoted verbatim before any change (`3-14-notes.md` §0). The window half ran between 10:41:06 and
  10:46:11 (`3-14-window-reading.md` §1). Review: `ship`, 0 findings (`docs/reviews/phase-3-14.md`).
- **So every Phase 3 step is closed:** 3-1 … 3-12 and 3-15 before 2026-09-26 (`3-15-2-notes.md` §5.2;
  `PROGRESS.md` status table and `docs/progress-archive/status-table.md`), and 3-13 and 3-14 at `743da1d` and `6744752`. §4.8's condition for Phase 3
  closing (nothing on its owed list) is met. **Phase 3 is closed by this record**, on 2026-09-26.
- **This record does not start Phase 4.** `PROGRESS.md` *Next action* names Phase 4's design consult as
  the next step, as Phase 3 started with its own (`c89f029`).
- **Not done here, by instruction:** marking Phase 3 complete in `PROGRESS.md`'s status table and in
  `PROGRESS.json`. This record edits neither file. That is the orchestrator's records step.

## 2. The window halves, final state (step 3-15 acceptance clause 5)

Ruling 30 names seven steps that owe a window half: 3-5, 3-6, 3-8, 3-9, 3-11, 3-13, 3-14
(`3-15-2-notes.md` §3). §4.1 says a model's look at a `screencapture -l` capture of a visible window is
recorded as a model's look; real input, wording clarity and layout acceptance are a person's.

**Tally: seven owed, seven read in part, every one by the model's look and none by the owner. None is
unread and none is still owed.** The five rows 3-5 … 3-11 are unchanged from `3-15-2-notes.md` §3 and
are summarised here; that table holds their full "did not read" lists.

| Step | Piece, commit | Read? | By whom, and the record | What it did **not** read (per its own record) |
|---|---|---|---|---|
| 3-5 | 3-5-2-2 | **Read in part** | The driven model's look, 2026-09-24 (`3-5-2-2-notes.md` §1, §3, §4) | As `3-15-2-notes.md` §3 row 3-5 |
| 3-6 | 3-6-3 | **Read in part** | The driven model's look, 2026-09-24 (`3-6-3-notes.md` §1, §3) | As `3-15-2-notes.md` §3 row 3-6 |
| 3-8 | 3-8-3 | **Read in part** | The driven model's look, 2026-09-24 (`3-8-3-notes.md` §1, §4) | As `3-15-2-notes.md` §3 row 3-8 |
| 3-9 | 3-9-2 | **Read in part** | The driven model's look, 2026-09-24 (`3-9-2-notes.md` §1, §4, §8) | As `3-15-2-notes.md` §3 row 3-9 |
| 3-11 | 3-11-3 | **Read in part** | The driven model's look, 2026-09-24 (`3-11-3-notes.md` §1, §3) | As `3-15-2-notes.md` §3 row 3-11 |
| **3-13** | 3-13-3, `743da1d` | **Read in part** (was *unread, owed*) | **The model's look** in an attended session, 2026-09-26, two launches (L01 EN, L02 ES) through the picker, each with a long display name; every action a script-dispatched DOM event. *"No owner judgement was sought or is claimed"* (`3-13-3-notes.md` §1, §3; [`3-13-3-window-reading.md`](3-13-3-window-reading.md)). Of the four owed items, three were read and one, the line-feed measurement, in part (`3-13-3-notes.md` §1). The *Preferences saved.* row is itself **read in part** (partly under the badge; §3). | A real ⌘V paste of a line break, so whether the drawn "is removed" sentence is accurate for a paste is **unresolved**. The sidecar's non-loaded statuses; refused, failed and withdrawn saves; name and default refusals. A default seeded with LF, one withheld for CR, and `kept`. Real keyboard and pointer input. Wording and layout acceptance (`3-13-3-notes.md` §3, §5 items 2 and 7). |
| **3-14** | 3-14, `6744752` | **Read in part** (was *unread, not started*) | **The model's look** in an attended session, 2026-09-26, at a 1180x728 viewport, L02/L04 EN and L03/L05 ES, both origins at both reload steps; L01 superseded. *"No owner judgement was sought or is claimed"* (`3-14-window-reading.md` §1; `3-14-notes.md` §2). | Keyboard order read **in part** (DOM order on the badge; no real Tab). Focus, real input and wording acceptance by a person. The readiness line under the disk version and the unknown-outcome acknowledgement order, which the mounted suite pins and no capture shows (`3-14-notes.md` §2). |

**What the owner did in Phase 3's window halves.** The owner read no capture and judged no screen. The
owner's part was, all in the 2026-09-26 session: the CF-52 and CF-54 rulings (`3-14-notes.md` §0), and
accepting the one Tab-order swap in the unknown-outcome state as a deviation from *"keyboard order
unchanged"* (`3-14-notes.md` §4 item 1). Earlier owner rulings bound the split (`3-split-notes.md` §4.8)
and are not window readings. "Attended session" means the owner was present and the screen unlocked
(`3-13-3-window-reading.md` header); it does not mean the owner read anything.

Mounted jsdom evidence is not credited in this table, as in `3-15-2-notes.md` §3.

## 3. The translation-review inventory — the delta since 3-15-2 (ruling 29)

**What this is.** The same kind of inventory as `3-15-2-notes.md` §2, for the keys that changed after
it. It is **an inventory for the owner's native-speaker review (R35, CF-51), not evidence of meaning**.
No review of the Spanish was performed here.

### 3.1 How it was derived

- `git diff --stat de08385 HEAD -- src/lib/i18n/` and `git diff de08385 HEAD -- src/lib/i18n/`: one line
  added to each of `en.json` and `es.json`, **nothing removed and no value changed**. 3-13-3 changed no
  source (`3-13-3-notes.md` header); the one key is 3-14's (`6744752`).
- 3-15-2's scripts, still at `/private/tmp/3-15-2/` (outside the repository; `3-15-2-notes.md` §8 item 7),
  re-run against `HEAD` from the same base `c89f029`:
  `node /private/tmp/3-15-2/inventory.cjs <repo> c89f029 summary` and
  `node /private/tmp/3-15-2/producers.cjs <repo> c89f029 summary|rows`.
- The script-free cross-check `git diff c89f029 HEAD -- src/lib/i18n/en.json | rg -c '^\+  "'` answers
  **311** (310 added keys + 1 changed value; it was 310 at 3-15-2).

### 3.2 The delta

| # | Key | EN | ES | Step | Producer |
|---|---|---|---|---|---|
| D1 (added) | `browser.matchDeletion.changedWhileOpen` | What is compared here came from watching the file: it changed on disk while this panel was open. No save was initiated in response to this observation, so nothing was written from here in response to it, and this app cannot say what changed the file or when. | Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras este panel estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, así que desde aquí no se ha escrito nada como respuesta a ella, y esta aplicación no puede decir qué cambió el archivo ni cuándo. | 3-14 (`6744752`) | `components/MatchDeleter.svelte` |

- **Changed:** none. **Removed:** none. The two keys the merged paragraph replaces on the delete panel,
  `browser.conflictOrigin.changedWhileOpen` and `browser.externalConflict.fileChangedWhileOpen`, are
  unchanged and still drawn by the other surfaces (`3-14-notes.md` §1.1).
- **The Producer cell, and a bound on the method.** The producers script names two files for D1:
  `components/MatchDeleter.svelte` (line 831, `t('browser.matchDeletion.changedWhileOpen')`) and
  `browser/matchDeletion.ts#matchDeletionView`. The second was inspected by hand: the match is in the
  JSDoc of `externalLinesUnderMergedOpening`, which **names** the key and does not produce it, and the
  script credits it to the preceding function because a comment sits outside any function body. This is
  the bound `3-15-2-notes.md` §2.4 states (*"A match could sit in a comment"*); the cell above gives the
  drawing file only.
- **Position.** In `en.json` D1 stands after `browser.matchDeletion.revisionDisk`. The `P#` numbers of
  `3-15-2-notes.md` §2.3 are left as recorded at `96f24a1` and are not renumbered.

### 3.3 The new totals

| Figure | At 3-15-2 (`96f24a1`) | Now (`6744752`) |
|---|---|---|
| Keys at `HEAD` (EN / ES) | 1302 / 1302 | **1303 / 1303** |
| Keys Phase 3 added, present at `HEAD` (EN / ES; sets equal) | 309 / 309 | **310 / 310** |
| Pre-Phase-3 keys removed | 1 | 1 (unchanged) |
| Pre-Phase-3 keys whose value changed | 1 | 1 (unchanged) |
| Keys added in Phase 3 and removed again | 0 | 0 |
| Per step | 3-13-3: none; 3-14: not started | **3-13-3: 0; 3-14: 1** (all other steps unchanged) |
| Producers: keys / literal / template / none | 310 / 241 / 69 / 0 | **311 / 242 / 69 / 0** |

## 4. R16, R30, R35, R38 and the CF rows (step 3-15 acceptance clause 6)

`3-15-2-notes.md` §4 is the Phase 3 statement; this section says only what 3-13-3 and 3-14 changed. **No
record of either step claims that any of the four risks narrowed or closed.** This record does not edit
`PROGRESS.md`'s *Open risks* rows.

- **R16 — unchanged; one more instance bears on it.** 3-13-3 found that *Create* writes a seeded `word`
  default as `word: 'true'` (quoted) in both launches (`3-13-3-notes.md` §5 item 1). It is the creation
  path's form of `3-10-notes.md` §5 item 1. As `3-15-2-notes.md` §4.1 says of that item, a quoted `'true'`
  is a string under YAML 1.1 and 1.2 alike, so it is a spelling defect and not a resolver disagreement;
  R16's open half is untouched. The 3-10 review ruled the bulk instance a blocker because espanso reads
  `'true'` as a string where it expects a boolean (`3-10-notes.md` §5 item 1; `3-13-3-notes.md` §5 item 1).
  This record makes no claim of its own about espanso's reading. It is carried as a **candidate
  blocker-class defect** (§6, A1).
- **R30 — unchanged.** Neither step added a writer or touched a save path: 3-13-3 changed no tracked
  source (`3-13-3-notes.md` header), and 3-14 changed the delete panel's drawing and one pure model
  function, not `delete_match` (`3-14-notes.md` §1). 3-15-1's preservation evidence and its bounds stand
  (`3-15-2-notes.md` §4.2).
- **R35 — unchanged; one more Spanish value.** 3-14 added one EN/ES pair (§3), so Phase 3 now puts 310
  added values under R35's exposure. The owner chose the CF-54 ruling's content, not its Spanish wording
  (`3-14-notes.md` §0); no native-speaker review was performed. 3-13-3 §5 item 2 is a question of
  whether the drawn sentence is **true** for a real paste, in both languages; it is not a translation
  finding. R35 stays the owner's, before Phase 5 (CF-51).
- **R38 — unchanged.** Both window halves used synthetic fixtures (`3-13-3-notes.md` §2: `alpha`, `bravo`,
  `charlie`; `3-14-notes.md` §3: 26 synthetic snippets). Neither is a ruling-31 touch, and neither read a
  `CLAUDE.md` §4 fixture, so the count stays **three of the fifteen**, all at 3-8 (`3-15-2-notes.md` §4.4).

### 4.1 The CF rows whose state changed

**How CF rows are tracked.** The list is `2d-7-10-notes.md` §5 (CF-1 … CF-55), with each row's
disposition as of 2d-7-10. `3-split-notes.md` §7 places each row in Phase 3, and `3-15-2-notes.md` §4.5
states each row's state after the steps then closed. A later state is recorded in a later record, as
here; **the earlier rows are not edited**, because each was true when written. `2d-7-10-notes.md:568` and
`:570` (CF-52 and CF-54 as rulings owed to a later phase) and `3-split-notes.md` §7 (their home is 3-14,
after the owner's ruling) are therefore left as they are. The one sentence that is now wrong, the
`3-15-2-notes.md` §4.5 row *"CF-52, CF-54 … Open. 3-14 is owed"*, is corrected by pointer from the dated
correction under that file's §3.

| Row | What 3-13-3 / 3-14 did | State now |
|---|---|---|
| **CF-52** (the delete panel's choice row below the fold at 1180x728) | The owner ruled **"Move choices up (Recommended)"** (`3-14-notes.md` §0). 3-14 drew the choice row, the second step's warning and the reload-unavailable line before *The version on disk*, in the markup and not with CSS `order` (§1.2). Read at 1180x728 in EN and ES, both origins, both reload steps: the row visible before the disk version (§2). | **Resolved on the delete panel, per the owner's ruling, within its bounds.** Keyboard order was read in part and focus not at all (§2); the one Tab-order swap is owner-accepted (§4 item 1). The 2d-7-10 row notes the same fold on other panels; the mover and the duplicator likely share it and were not read (`3-14-notes.md` §5 item 3). |
| **CF-54** (the delete panel's two opening paragraphs repeat each other) | The owner ruled **"Merge into one (Recommended)"** (`3-14-notes.md` §0). 3-14 drew one new paragraph, `browser.matchDeletion.changedWhileOpen`, carrying the four facts the ruling lists, on the delete panel only (§1.1). Read: drawn once, first, with neither old sentence (§2). | **Resolved on the delete panel, per the owner's ruling.** The same repeat stands on the six other external-conflict surfaces, which the ruling did not name (`3-14-notes.md` §5 item 1; first seen as `3-5-2-2-notes.md` §5 item 2). |
| CF-53 (close/keep labels) | Nothing; *"CF-53's labels are kept"* (`3-14-notes.md` §0). | Unchanged: the owner's; labels kept. |
| CF-55 | Nothing. | Unchanged: closed by 3-8-3's reading within its bounds (`3-15-2-notes.md` §4.5). |
| Every other row | Neither record cites a CF row other than CF-52, CF-53 and CF-54 (`rg 'CF-[0-9]+'` over the 3-13-3 and 3-14 notes, window readings and reviews). | Unchanged from `3-15-2-notes.md` §4.5. |

## 5. Scope statement against plan §12 (ruling 17)

**Plan §12 gives Phase 3 no exit line.** Its Phase 3 paragraph (`IMPLEMENTATION_PLAN.md:1110-1116`) lists
scope only; the nearest **Exit:** is Phase 2's (`3-15-2-notes.md` §5.1). Phase 3 is therefore measured
against its scope list, with `3-split-notes.md` §5 as the binding override list.

**What changed since `3-15-2-notes.md` §5.1**, row by row; every other row stands as written there:

- **Sidecar display names and per-file new-snippet defaults (§8.9):** its window half is now **read in
  part** (§2), and step 3-13 is closed. The rest of that row stands: no control sets `sortOrder`,
  preferences refresh only on `open()` (`3-13-2-notes.md` §6 items 2–3), and §5 rows 6–8 override the plan.
  **New since 3-15-2:** *Create* writes a seeded boolean default as a quoted string
  (`3-13-3-notes.md` §5 item 1), so "defaults are text, never booleans" holds in the model and the
  sidecar, and the text `true` reaches the file as `'true'`.
- **Delete-conflict wording and action placement (3-14):** not a plan §12 item; the consult's home for
  CF-52 and CF-54 (ruling 32). **It shipped** at `6744752`, on the delete panel only (§4.1).

**Plan §12's Phase 3 scope, at closure:** every item has shipped in the form `3-15-2-notes.md` §5.1
records, with the overrides of `3-split-notes.md` §5 and ruling 1's moves (import editing, import
resolution and renames out of Phase 3).

### 5.1 Still **not** guaranteed

1. **Nothing is proven against espanso itself.** R16 and R30 stay open (§4). How espanso reads a quoted
   `'true'`, and how it handles a `_` configuration profile, are not checked here (`3-9-1-notes.md` §4
   item 2).
2. **The quoted-`'true'` spelling ships** in the single-match options editor (`3-10-notes.md` §5 item 1) and
   in *Create* with a seeded default (`3-13-3-notes.md` §5 item 1). Only bulk edit writes plain source.
3. **No window half is complete.** All seven are read in part, by a model, with script-dispatched events;
   no real keyboard or pointer input was read in Phase 3, and no person accepted any wording or layout
   (§2).
4. **The creation form does not author the wider fields** (content kinds, label, comment, trigger forms,
   `search_terms`, `paragraph`, `anchor`), though the core accepts them (`3-15-2-notes.md` §8 item 3;
   `3-13-1-notes.md` §6 item 4).
5. **A match whose flow list holds a comment is not editable at all** (`3-15-2-notes.md` §8 item 4;
   `3-6-3-notes.md` §4 item 2).
6. **The Spanish is unreviewed** (R35, CF-51): 310 Phase 3 values plus 2d-7-10's 145-row inventory.
7. **Preservation evidence is 3-15-1's, under 3-15-1's bounds** (`3-15-1-notes.md` §7): one LF fixture on
   the command path, no BOM, no hazards.
8. **Plan §12's Phase 2 exit** (a week of real use with zero data loss) has still not been run
   (`3-split-notes.md` §7, *Owner obligations*).
9. **The candidate defects of §6 B are unresolved**, none reproduced by a test.

## 6. Open items carried into Phase 4's selection

One consolidated list. Sources: `3-15-2-notes.md` §8, `3-13-3-notes.md` §5, `3-14-notes.md` §5, and the
records `PROGRESS.md` *Next action* lists. Items the sources mark fixed, or that a later record
supersedes, are left out (for example `3-9-2-notes.md` §5 item 1, F1, fixed; `3-8-2-notes.md` §5 items 1–2).
Where two records name one item, it appears once with both citations. **None was fixed in 3-13-3, 3-14
or here.** Numbered within groups; 47 items in all.

### A. Candidate blocker-class defect

1. **Quoted `'true'` on creation and in the single-match editor.** *Create* writes a seeded `word` default
   as `word: 'true'` in both launches (`3-13-3-notes.md` §5 item 1); the single-match options editor quotes
   option values the same way (`3-10-notes.md` §5 item 1; carried by `3-11-1-notes.md` §5 item 8,
   `3-11-2-notes.md` §5 item 6, `3-11-3-notes.md` §5 item 8). The 3-10 review ruled the bulk instance a
   **blocker** and it was fixed there with `ScalarEdit::plain_source`; these two paths do not use it.
   Cause on the creation path not investigated. **Candidate blocker-class: to be decided with a test
   before the owner relies on boolean defaults or edits a boolean option.**

### B. Other candidate defects (each to be reproduced with a test before deciding)

1. A draft holding a list-item addition never drew the external-change panel (`3-6-3-notes.md` §4 item 1;
   `3-15-2-notes.md` §8 item 6).
2. The snippet list draws no disabled state (`3-11-3-notes.md` §5 item 1).
3. A failed bulk file's promised reason is not drawn (`3-11-3-notes.md` §5 item 2).
4. The *All* list reorders after a bulk commit (`3-11-3-notes.md` §5 item 3).
5. The disk-version box does not wrap a long line (`3-5-2-2-notes.md` §5 item 1).
6. The drawn sentence that a pasted line break *is removed* / *se elimina* is **unresolved** for a real
   paste; the two script routes disagree (space vs. deletion) (`3-13-3-notes.md` §5 item 2).

### C. Scope left unowned or unfinished

1. The creation form's wider fields have no owning step (`3-15-2-notes.md` §8 item 3; `3-13-1-notes.md`
   §6 item 4).
2. The commented flow list gate (`CommentInFlowCollection`) was never decided (`3-15-2-notes.md` §8 item 4;
   `3-6-3-notes.md` §4 item 2).
3. No control sets `sortOrder` (`3-13-2-notes.md` §6 item 2; `3-13-3-notes.md` §5 item 6).
4. Preferences refresh only on `open()` (`3-13-2-notes.md` §6 item 3).
5. The creator's destination list shows paths only, not display names (`3-13-2-notes.md` §6 item 1; seen,
   `3-13-3-notes.md` §5 item 6).
6. The repeated opening paragraph stands on the six other external-conflict surfaces; a shared merge is an
   owner question (`3-14-notes.md` §5 item 1; `3-5-2-2-notes.md` §5 item 2).
7. The CF-52 fold likely exists on the mover and the duplicator; not read (`3-14-notes.md` §5 item 3).
8. `Several` offers no one-click form choice (`3-6-3-notes.md` §4 item 4).
9. No recovery sentence on the raw-snippet surface; a stale identity there is terminal; the pane's
   captured identity is the opening one; the line count is not drawn; `reconcileWithDisk` under an
   external conflict leaves the conflict standing (`3-8-2-notes.md` §5 items 3–7; `3-8-3-notes.md` §5
   item 4).
10. Bulk: no `RepairAttribution` names a bulk edit, so the external-change sentence announces the app's
    own commit (`3-11-1-notes.md` §5 item 1; `3-11-3-notes.md` §5 item 4); a `conflicted` file registers
    no conflict origin (`3-11-1-notes.md` §5 item 2); one spelling read per snippet (item 5); no warning
    beside a `NotOneScalar` option (item 7).
11. Bulk inspector: the file-text toggle stays drawn while selecting; a re-projected row draws unselected
    while its stale identity stays counted; one undo step per choice; drafts dropped on unmount
    (`3-11-2-notes.md` §5 items 1, 3, 4, 5).
12. Sidecar residue: quarantined and temporary files never reclaimed; no rename subject; the storage root
    not checked for symlinks; the lock has no timeout; the lock file is never removed (`3-12-notes.md` §6
    items 1, 6, 7, 8, 9).
13. How espanso treats a `_` configuration profile is unverified (`3-9-1-notes.md` §4 item 2;
    `3-9-2-notes.md` §5 item 4); an import entry holding a line break or `\r` has no fixture
    (`3-9-1-notes.md` §4 item 3).
14. The preferences control's unsaved draft survives a re-read of its file but **not a change of selection or an
    `open()`**: both end the control and discard its draft without asking, on purpose (`3-13-2-notes.md` §5).
    Carried as a recorded limitation, not a defect.

### D. Wording and layout questions for the owner (a person's, §4.1)

1. A named sidebar row drops its snippet count to its own line (`3-13-3-notes.md` §5 item 3).
2. A removed default keeps its *From this file's defaults* mark (`3-13-3-notes.md` §5 item 4).
3. The creator's pinned action block cuts the option lines scrolling past it (`3-13-3-notes.md` §5 item 5).
4. After *Leave this as it is* on a save-origin delete conflict, *Delete this snippet* is offered again
   while the pane says the file is not reconciled (`3-14-notes.md` §5 item 2).
5. *Applied files* / *Archivos aplicados* heads a *No file was written* answer (`3-11-3-notes.md` §5
   item 5).
6. The findings block words an elided import entry as the key's shape (`3-9-2-notes.md` §5 item 2).
7. A `_` configuration profile's detail pane offers *Add a snippet* (`3-9-2-notes.md` §5 item 3).
8. *Redo* stays enabled after a committed raw save (`3-8-3-notes.md` §5 item 1).
9. The raw fallback's label promises editing one press away (`3-8-3-notes.md` §5 item 2).
10. Both snippets of `run-based-removal-boundaries.yml` are refused as disjoint (`3-8-3-notes.md` §5
    item 3).
11. The regex outcome panel opens with a sentence about shape (`3-6-3-notes.md` §4 item 3).
12. Removed list items look like editable boxes (`3-6-3-notes.md` §4 item 5).
13. The `wouldDropAliases` count follows the file, not the draft (`3-6-3-notes.md` §4 item 6).
14. The ES rename sentence has no article and capitalised field labels (`3-5-2-2-notes.md` §5 item 3).
15. Four empty dormant content boxes are drawn for a one-content snippet (`3-5-2-2-notes.md` §5 item 4).

### E. Records and hygiene

1. `3-11-2-notes.md` §1.5 says 53 new keys; the dictionaries say 54 (`3-15-2-notes.md` §8 item 1).
2. `PROGRESS.md`'s R38 row does not mention Phase 3's four ruling-31 touches (`3-15-2-notes.md` §8 item 2).
3. The ruling-33 subject changes are unmapped to CF rows (`3-15-2-notes.md` §8 item 5).
4. The inventory scripts live outside the repository (`3-15-2-notes.md` §8 item 7).
5. The plan text still shows a boolean default and the old path (`3-12-notes.md` §6 item 4; the override
   is `3-split-notes.md` §5).
6. Stale sentences in `workspace.svelte.ts` (`3-11-1-notes.md` §5 item 6).
7. Empty debris directories at the repository root (`48/`, `en/`, `es/`, `snippet/`, `whole/`)
   (`3-11-3-notes.md` §5 item 6; the root listing in `3-13-3-notes.md` §4 still shows them).

### F. Unread window rows, open for a later reading if wanted

1. Every step's unread remainder (§2, and each notes file's *Unread* list), including all real keyboard
   and pointer input, a real ⌘V paste, the sidecar's non-loaded statuses, focus on the delete panel, and
   the readiness line and acknowledgement order under the disk version (`3-13-3-notes.md` §5 item 7;
   `3-14-notes.md` §2).

### G. Owed by the owner, outside any driven step

1. Plan §12's Phase 2 exit: a week of real use with zero data loss (`3-split-notes.md` §7).
2. R35 / CF-51: native-speaker review of Phase 3's 310 values and 2d-7-10's 145-row inventory, before
   Phase 5 (§3; `PROGRESS.md` *Next action*, "Owed by the owner").
3. The 2d-8 §4.6 entries left for the owner (`PROGRESS.md` *Next action*).

**Count:** A 1, B 6, C 14, D 15, E 7, F 1, G 3 — **47** numbered items.

## 7. Deviations

- **The derivation reused 3-15-2's out-of-repository scripts** rather than writing new ones; the one
  added key was also checked by hand against `git diff de08385 HEAD -- src/lib/i18n/` (§3.1).
- **`3-15-2-notes.md` was corrected in its header banner as well as §3 and §7**, by a dated note under the
  banner that points here: the banner's *"Phase 3 is NOT closed"* is the most prominent of the sentences
  now wrong, and leaving it would contradict this record. No other sentence of that file was edited.
- **`PROGRESS.md` and `PROGRESS.json` were not edited** (§1), by instruction.

## 8. Verification

| Command | Exit | Result |
|---|---|---|
| `git diff --stat de08385 HEAD` and `git diff de08385 HEAD -- src/lib/i18n/` | 0 | one line added to each dictionary (§3.1) |
| `node /private/tmp/3-15-2/inventory.cjs <repo> c89f029 summary` | 0 | 1303 / 1303 keys; 310 added, sets equal; per step 3-14 = 1 (§3.3) |
| `node /private/tmp/3-15-2/producers.cjs <repo> c89f029 summary` and `rows` | 0 | 311 keys: 242 literal, 69 template, 0 none (§3.2, §3.3) |
| `git diff c89f029 HEAD -- src/lib/i18n/en.json \| rg -c '^\+  "'` | 0 | 311 |
| `npm test` (output to a file in the session scratchpad, read with `tail`) | 0 | 88 files, 4074 passed — the rung's vitest figure, unchanged |
| `git status --short --untracked-files=all` | 0 | ` M PROGRESS.md` (pre-existing, the orchestrator's), ` M docs/decisions/3-15-2-notes.md`, `?? docs/decisions/3-closure-notes.md`; no `src/`, `src-tauri/`, `crates/` or real-corpus path |

The Rust gates, `npm run check` and `npm run build` were not run: no file they read changed. The rung
stays `1555 / 487 / 4074 / 214` (`3-14-notes.md` §6).
