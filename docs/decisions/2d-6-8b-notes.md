# Phase 2d-6-8b — the raw editor's and restore's external-conflict rendering

**Status: implemented, gates green, reviewed (Codex, `ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX fixed in this record, §6). CLOSED.**
Risk class: **high** (the orchestrator's classification). Markup changes on two components, one
model decision in `restore.ts` (2d-6-5 §4 item 12) pinned by cases shown failing first, one new
dictionary key in EN and ES with one typed accessor. **No new module, no new component, no Rust,
no `src-tauri/` file.** No window was launched: the window reading is 2d-6-8c's.

This is the second of the three sub-phases 2d-6-8 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-8*). It starts
from [`2d-6-8a-notes.md`](2d-6-8a-notes.md) §5 item 1 and copies the rendering pattern of
[`2d-6-7b-notes.md`](2d-6-7b-notes.md). Bound by the split record's §3 entries 1, 10, 23, 32,
34-36 and 38.

Abbreviations: `RE` is `src/lib/components/RawEditor.svelte`, `RP` `RestorePane.svelte`, `RS`
`src/lib/browser/restore.ts`, `DPT` `src/lib/components/DetailPane.test.ts`.

---

## 1. What landed

### 1.1 The rendering (entries 10 and 23), on both panels

Both follow `MatchEditor.svelte`'s shape, as the three operation panels have since 7b:

- **An external conflict is drawn in a panel of its own**, `div.panel.external[role=status]`,
  outside the save-outcome branch. A `$derived` `external`, through `isExternalConflict` (the one
  tested guard), decides the arm; the nested `source.kind` does not narrow the model.
- **The origin** (`tConflictOriginMessage(conflictOriginMessage(...))`): `changedWhileOpen` on the
  external panel, and **`refusedSave` now on the save arm too** (7b §2 ruling 5 carried over).
- **The model's own lines** from `view.externalMessages` through `tConflictMessage` — never
  `view.messages`, which are a save's.
- **The one revision an observation has** (`browser.externalConflict.revisionObserved`); no
  *expected*, no *found*.
- **The comparison is one `comparison` snippet per component**, rendered by both arms and typed
  over the view (`RawEditorView` / `RestoreView`):
  - `RE`: the whole disk text through `SourceText … documentStart`, the reload's carriage-return
    refusal (`tRawEditorDiskRefusal`), the reload-unavailable line, the copy disclosure and the
    choices. The draft side is the box above, read-only under either origin and `\r`-free by
    construction.
  - `RP`: the operation summary (heading and sentence only while `conflictOperation` is non-null),
    the whole disk text through `SourceText`, the reload-unavailable line (now through
    `tRestoreReloadUnavailable`, §1.2) and the choices. The candidate itself stays in its own step
    above, unchanged.
- **Notices.** `RE` draws `view.externalNotices` under the *Save* control — until this phase a
  disabled *Save* with no sentence (8a §5 item 1). `RP` draws the new
  `view.noticesBesideRefusal` under its refusal line in `.actions`.
- **The distinct reload effects** are the existing transitions, now reachable from the external
  panel: raw **reseeds** (`loadDiskVersion` — the box takes the disk text, becomes editable, the
  panel goes), restore **retargets** (`reloadTheDiskVersion` — the window adopts, the base moves,
  the same candidate is confirmed again against the adopted revision).
- **The reveal.** An active external conflict gives the cue `conflict` and the target is the
  external panel, **ahead of any outcome kept as history** (7b §5 finding 2's shape), through an
  `externalShown` boolean `$derived`.
- **`RE`'s copy disclosure** is now a `CopyDisclosure` bound to the conflict on screen by identity
  and to the copied text (the editor's shape since 6c-2), so a later reading withdraws it
  (entry 12's *copy feedback cleared where it would describe the wrong panel*).

### 1.2 Model changes (values; the components only draw them)

| Where | What | Why |
|---|---|---|
| `RS` `restoreView` `messages`, `externalMessages` | less `operationKeptInMemory` and `reloadRetargetsCandidate` when no candidate is retained (private `aboutTheCandidate`) | §2 ruling 1 |
| `RS` `RestoreView.conflictOperation` | `null` whenever no candidate is retained, of either origin (was: external origin only) | §2 ruling 1 |
| `RS` `RestoreView.reloadUnavailableLine` | new: `'candidateKept' \| 'noCandidate' \| null` | §2 ruling 1 |
| `RS` `RestoreReloadUnavailable`, `restoreReloadUnavailableKey` | new type and key function; `candidateKept` delegates to `reloadUnavailableKey('operationChoice')` | §2 ruling 1 |
| `RS` `RestoreView.noticesBesideRefusal` | new: the notices less the one an `observationRetained` refusal already renders | §2 ruling 3 |
| `i18n/index.ts` `tRestoreReloadUnavailable` | new accessor over the key function | CLAUDE.md §2 |
| `en.json` / `es.json` | new key `browser.restore.reloadUnavailableNoCandidate` | §2 ruling 1 |

### 1.3 Sentences corrected in place (entry 41)

Each said the raw editor's and restore's rendering was 2d-6-8's / 2d-6-8b's, or that no component
reads a field, and this phase made it false: the module headers of `rawEditor.ts` and `RS`; the
`externalMessages` / `externalNotices` docs of `RawEditorView` and `RestoreView`;
`observationDelivery.ts` (the notice doc); `saveOutcome.ts` (`ExternalConflictModel`, now "all
eight"); `i18n/index.ts` (`tConflictMessage`, `tExternalConflictNotice`, `tConflictOriginMessage`,
now "eight components"); the receiver comments in `RE` and `RP`; `RS`'s `overNoCandidate` doc
(the drop direction is now the view's); `RestorePane.test.ts`'s header (the scan covers nineteen
states, and there are seven open-surface refusals, not six).

### 1.4 Tests (+73 vitest cases, 3083 → 3156)

| File | Added | What |
|---|---|---|
| `restore.test.ts` | 5 | *a candidate dropped under a standing conflict* (§2 ruling 1), written first |
| `restoreCodes.test.ts` | 3 | the new key function: delegation, both sentences in EN/ES, the dropped clause absent |
| `RawEditor.test.ts` | 28 | suite *under an external conflict, in English and Spanish* (11 cases × EN/ES, one × 3 adoptions) and two reveal cases |
| `RestorePane.test.ts` | 31 | suite *under an external conflict* (10 cases × EN/ES, one × 2 adoptions), *a candidate dropped … on screen* (2 × EN/ES), one reveal case, and two new states × 2 locales in the forbidden-claims scan |
| `DetailPane.test.ts` | 6 | *drawn sentences through the pane* (2 kinds × EN/ES) and *the viewer refreshes, the editor conflicts* (× EN/ES) |

`mountEditor` now captures the reported receiver as `deliver`. `mountRestore` gains `deliver`,
`observe` (the real `BrowserState.observeExternalChange`) and an `Opened.live` flag that registers
the pane's receiver with the real state and adopts through the real `adoptDiskVersion`, so the
retarget is shown moving the window's projection and the next send going out against the adopted
revision. `PaneScript` gains optional `reloadDocument` and `documentText` hooks.

**Direct submission is pressed, not only looked at.** A `forcePress` helper in both panel suites
lifts `disabled` for one press, because jsdom dispatches nothing on a disabled button: the
component's handler runs and the model door refuses. Pinned: raw *Save* under a held reading and
under an external conflict (0 `save` calls); raw *Discard my text and load it* over a disk text
holding `\r` (0 adoptions); restore *Replace entire file* under a held reading (0 saves); restore
*Prepare* under an external conflict (no question drawn).

## 2. Rulings taken here, and what each does and does not force

1. **2d-6-5 §4 item 12: the lines follow the live preview, derived at the view — the selection is
   not frozen.** `chooseBatch` / `chooseEntry` stay open under a conflict of either origin;
   freezing them would take the catalogue away from a person who is only looking, and would need a
   disabled control with its own reason. Instead `restoreView` decides on every read, from
   `session.preview !== null`: the two candidate lines leave `messages` and `externalMessages`,
   `conflictOperation` is `null`, and the reload-unavailable line becomes the new
   `noCandidate` sentence (the shared one says *what you asked for here is still set up*).
   - **Pre-fix failure, verbatim** (`/tmp/8b-item12-prefix.txt`), 4 failed, 1 passed:
     `AssertionError: expected [ 'operationKeptInMemory', …(1) ] to deeply equal []` (save
     conflict, batch and entry dropped); `AssertionError: expected [ 'fileChangedWhileOpen', …(2) ]
     to deeply equal [ 'fileChangedWhileOpen' ]` (external conflict, dropped);
     `AssertionError: expected undefined to be 'candidateKept' // Object.is equality`
     (reload-unavailable line). The passing case is the control (lines kept while retained).
   - **What TypeScript forces**: a third member of `RestoreReloadUnavailable` is a compile error in
     `restoreReloadUnavailableKey`. **What it does not force**: that `RestorePane.svelte` obtains the
     line through the view's field — the current markup does, but nothing stops a renderer from
     calling `tRestoreReloadUnavailable` with a hard-coded member (the 8b review compiled exactly
     that); that `aboutTheCandidate` catches a candidate line some producer adds later — it filters
     two kinds by name — nor that a renderer draws `messages` rather than the model's own list. The
     mounted *dropped … on screen* cases are what read the current markup.
   - **Left as it was**: an external conflict raised over **no** candidate and a candidate read
     *afterwards* carries only the file's line (`overNoCandidate` decides at the verdict). That is
     an omission, not a false claim; §4 item 3.
2. **The raw editor draws its notices under *Save*, with no refusal line of its own.** The raw
   editor has none, and the notices say why *Save* is off under a held reading and an unknown
   outcome; under an external conflict the panel's first lines say why. **Forced**: nothing makes
   the markup draw them; the held-reading and unknown-outcome cases read them in both languages,
   and a mutation removing the loop fails 4 cases.
3. **Restore draws `noticesBesideRefusal`, not every notice** (7b §2 ruling 4). `restoreRefusalKey`
   renders `observationRetained` through the notice's own sentence, so drawing both would print it
   twice. **Forced**: the rule is decided in one place. **Not forced**: it compares kinds, correct
   only while the refusal key keeps delegating to `externalConflictNoticeKey`.
4. **"The viewer refreshes through the guarded path while the editor conflicts" is read as the
   viewer/editor distinction of the 2d-5 record's entry 20 and this record's §3 entry 34 ("raw
   refresh, raw editor conflict").** The raw editor outranks the viewer in `DetailPane.svelte`, so
   the viewer is never on screen beside the editor. The `DPT` case therefore shows, in one
   window: with no editor, a change to `match/a.yml` is reread through `rereadUnderGuard`
   (`reload_document(1)`, the viewer draws the new text, no delivery, no standing conflict); with
   the editor open over the same file, the next change is delivered as `raised`, the external panel
   is drawn, the file is `stale`, **no** `reload_document` or `document_text` is issued and the
   viewer's snapshot underneath stays the first change; and while that conflict stands a change to
   `match/c.yml`, which no surface is over, is still reread through the guarded path. **What this
   does not show**: a screen with the viewer and the editor both drawn (none exists), or anything
   about wake delivery in a real window (8c, and ruling 38's limits).
5. **Restore's reload-unavailable line moved off `tReloadUnavailable`** onto
   `tRestoreReloadUnavailable`, whose `candidateKept` arm answers the same key. The existing
   *refused adoption* cases are unchanged and still read `reloadUnavailableOperation`.
6. **No dictionary sentence was reworded.** The one new key is restore's own
   (`browser.restore.*`), so it joins `restoreCodes.test.ts`'s forbidden-claims scan and the pane's
   rendered-screen scan (a new state proves it is drawn).

## 3. Acceptance, clause by clause

| Clause | Where it is checked |
|---|---|
| **Origin** and observed revision, EN and ES | `RawEditor.test.ts` / `RestorePane.test.ts` *draws the origin …* and *withdraws the question …*; `DPT` *drawn sentences through the pane* (2 × 2). Each asserts `changedWhileOpen`, `revisionObserved`, and the absence of `refusedSave`, `changedElsewhere`, `nothingWasWritten` and *expected*. |
| **Comparison** | Raw: the frozen box holds the draft, the panel holds the whole disk text (a marker word). Restore: the candidate still drawn in its step, the panel holds the operation and the disk text. |
| **`externalMessages` / `externalNotices`** | The lines per surface (`draftKeptInMemory` + `reloadDiscardsDraft`; `operationKeptInMemory` + `reloadRetargetsCandidate`); `observationRetained` and `writeOutcomeUnknown` read in both locales; restore's retained sentence drawn exactly once. |
| **Distinct reload effects** | Raw *reseeds … on what the window answers* × `installed` / `alreadyThere` / `refused` × EN/ES: box = disk text, editable, panel gone, not closed; `refused` keeps the draft with the reload-unavailable line. Restore *retargets … through the window* (real adoption: projection at the observed revision, the next send carries `CANDIDATE` against it) and *keeps the candidate whatever the window answers* × `alreadyThere` / `refused`. |
| **Viewer refreshes through the guarded path while the editor conflicts** | `DPT` *refreshes the raw viewer through the guarded reread …* × EN/ES (§2 ruling 4). |
| **Restore candidate survives** | Every restore external case asserts the candidate marker after the delivery, the supersession, the reload and the language switch. |
| **CR disclosure** | Raw: a disk text with a lone `\r` is named by `SourceText` (`browser.source.invisible.carriageReturn`), `diskLineEndingsNotPreserved` stands beside it, the only text control is the editor's own `\r`-free box, and a forced *Discard my text and load it* adopts nothing. Restore: the same naming, and zero `textarea`/`input` in the pane. The raw editor's refusal of a `\r` text on opening is the existing *does not open a CRLF document* case. |
| **Every offered control, both locales** | Raw: *Keep editing*, *Copy my text*, *Load the version on disk*, *Discard my text and load it*, *Save anyway* withdrawn. Restore: *Leave this as it is*, *Load the version on disk*, *Load it and keep the text selected here*, *Prepare*, *Replace entire file*. |
| **Direct submission refused** (a forced press issues 0 commands) | §1.4, *Direct submission is pressed*. |
| **Supersession withdraws the warning** | *withdraws the reload warning when a later reading supersedes the conflict* on both panels (restore through the real arbitration). |
| **Locale switch keeps the session** (entry 35) | *keeps its session across a change of language* on both panels. |
| **2d-6-5 §4 item 12** | §2 ruling 1: the model cases and the mounted *dropped … on screen* cases. |

**Shown discriminating.** For each mutation the files were copied to `/tmp`, mutated for one run,
copied back and compared with `cmp` (identical):

| Mutation | Result |
|---|---|
| Both `{#if external !== null}` → `{#if false}` | **53 failed** across the three component suites (`/tmp/8b-mut1.txt`) |
| Both reveal targets back to `outcomePanel` alone | **3 failed** (the three new reveal cases; `/tmp/8b-mut2.txt`) |
| `noticesBesideRefusal` given `null` in `restoreView` | **2 failed**: `expected 2 to be 1` (EN/ES; `/tmp/8b-mut3.txt`) |
| `RE`'s notice loop removed | **4 failed** (held reading and unknown outcome × EN/ES; `/tmp/8b-mut4.txt`) |
| `retained` forced `true` in `restoreView` | **11 failed** (5 model — the 4 new and 2d-6-5's *claims no candidate … raised over none* — 4 mounted, and the 2 scan proofs of the no-candidate state; `/tmp/8b-mut5.txt`) |

## 4. Open items (not fixed here, `CLAUDE.md` §7)

1. **8c: no window was read.** Nothing here claims what a window draws or where. What 8c should
   look at: both external panels and their reveal in EN and ES; the raw notices under *Save*; the
   restore refusal line with the notice beside it; the raw reseed and the restore retarget; the
   disk text with a `\r` named on both panels; the no-candidate reload-unavailable sentence (hard
   to reach: a refused adoption, then a dropped candidate).
2. **Restore's `externalConflict` refusal repeats the panel's first line** (`fileChangedWhileOpen`),
   as the mover's and duplicator's do (7b §4 item 3) — a dictionary decision for 2d-6-11.
3. **A candidate read *after* an external conflict raised over none** gains the operation summary
   (`conflictOperation`) but not the two candidate lines, because `overNoCandidate` decided at the
   verdict. An omission, not a false claim; making the lines follow the preview in that direction
   too would mean the view re-deriving the model's lines from the declaration.
4. **The confirmation label *Load it and keep the text selected here*** is still offered when no
   candidate is selected (after a drop, or over none). It describes the reload's effect on a
   selection that does not exist — for 2d-6-11's bilingual review.
5. **`recovery.unavailable.operationDraft` on restore** says the request is "an action on a
   snippet", which is not what a whole-file restore is (pre-existing since 2c-4c; the same
   sentence is drawn for the three operation panels). For 2d-6-11.
6. **The raw editor's `acknowledgeSnapshot` and restore's `acknowledgeRestoreSnapshot` are still
   drawn by nothing**: under `writeOutcomeUnknown` both panels offer no way to the reload. That is
   2d-6-9's control.
7. **Still open from earlier records**, untouched here: 8a §5 items 3-6 and §7.3; 7b §4; the
   `consumingHeldDeliveries` queue-read shape on the other six sessions.

## 5. Verification

Each gate ran on its own, with output redirected to a file and read from there, never through a pipe.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings (no new file) |
| `npm test` | 0 | **3156 passed**, 65 files (+73, §1.4) |
| `npm run build` | 0 | **193 modules** (unchanged: no new module, no new component) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are present |
| `cargo test --workspace -- --test-threads=1` | 0 | **1323 passed**, 0 failed (no Rust edited; the dictionary contract re-ran over the new key) |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `git diff --stat -- src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

New rung (with the instrument): **`1323 / 449 / 3156 / 193`**. Only read-only git commands were run
(`git status`, `git diff --stat`). The four instrument paths, `PROGRESS.md` and `PROGRESS.json` were
not touched.

## 6. Review

Codex through `autoclaude-review.sh` (exit 0, no fallback agent): **`ship-with-fixes`, 0 BLOCKERS,
1 SHOULD-FIX** ([`phase-2d-6-8b.md`](../reviews/phase-2d-6-8b.md)). The finding: §2 item 1 claimed
TypeScript forces `RestorePane.svelte` to draw the reload-unavailable line through the view's field.
**Re-derived and held** — `tRestoreReloadUnavailable` accepts any member, so a renderer can pass one
by hand. **Fixed in this record only**: the sentence now names the accessor's exhaustiveness as what
is forced and the renderer's route as what is not. No source changed, so no gate was re-run.
