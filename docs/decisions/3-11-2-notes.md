# Phase 3-11-2 — Bulk selection: the components and the i18n

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-11" and its addendum of 2026-09-24 (the
3-11-1 / 3-11-2 / 3-11-3 cut); §3 rulings 20–22. The model and coordination this draws are 3-11-1's
(`docs/decisions/3-11-1-notes.md`).
**Risk:** high. **Components and i18n only.** 3-11-3 owns the window half.

No window reading was performed or claimed. Every piece of evidence below is a model test or a
mounted jsdom test, and mounted evidence is not a screen (`CLAUDE.md` §6).

---

## 1. What changed, and why

### 1.1 The multi-select (`src/lib/components/SnippetList.svelte`)

- A **Select several** toggle (`aria-pressed`) above the list. While it is on, a row press adds that
  snippet to the bulk selection or takes it out, instead of selecting it alone; the row stays the same
  `<button>`, now carrying `aria-pressed`, with a drawn mark and a *Selected* badge. A **Clear the
  selection** button and a live count (`role="status"`) sit beside the toggle.
- **Keyboard:** the rows are native buttons, so Tab reaches each one and Space or Return toggles it;
  `aria-pressed` is what a screen reader is told. No checkbox is drawn — one control per row, and no
  checkbox anywhere near the option values (`CLAUDE.md` §6).
- **Single-select is unchanged** outside the mode: the row is exactly the previous button with
  `aria-current` and `browser.select(match)`.
- The toggle is **refused while any write surface is open** (`bulkSelectingAvailability` over
  `browser.openWriteSurfaces()`): disabled, with `browser.list.bulk.unavailable` said beside it.

### 1.2 The selection lives on `BrowserState` (`src/lib/browser/workspace.svelte.ts`)

The list draws it and the detail pane's inspector draws it, so it is window state:
`bulkSelecting`, `bulkSelection` (frozen identities, `$state.raw`), `setBulkSelecting(on)` (off
empties the selection), `toggleBulkSelection(id)` (a no-op unless selecting), and
`replaceBulkSelection(next)` (copies). `open()` resets both, because a bulk selection names
identities of the workspace being closed. Nothing re-resolves an identity: after a re-read the old
identities stay, stale, and `bulkSelectionFreshness` blocks.

### 1.3 The inspector (`src/lib/components/BulkInspector.svelte`, new)

Drawn by `DetailPane.svelte` in place of one snippet while `browser.bulkSelecting` (a new arm of the
top-level chain, after the eight write surfaces). It holds only session state — spelling reads, the
`BulkDraft`, consent grants, the last answer — and decides nothing:

- **Reads** go through `BrowserState.matchOptionSpellings` (prop `readSpellings`); which to take is
  `spellingReadsWanted`, failures are counted by `failedSpellingReads` with a *Read the options again*
  action (`withoutFailedReads`).
- **Per option:** the detail pane's own label (`bulkOptionField` → `tDetailField`) and the espanso key;
  *In the selected snippets now:* the Rust-cut bytes through `SourceText` for `same`, otherwise
  `tBulkOptionSummary`; *Mixed, and left as it is in each snippet* when `showsMixed`. The intent is a
  `<select>` (leave / set / remove, `chooseBulkIntent`) plus, for *set*, a text box
  (`typeBulkIntentText`) and the single-snippet editor's suggestions (`bulkSuggestionsFor`). Textual
  controls only; a box holds only what the person typed, never a file's bytes, so the `\r`
  normalization of an `<input>` never touches file text.
- **Draft Undo / Redo** (`undoBulkDraft` / `redoBulkDraft`) with `browser.bulkInspector.draftOnly`
  saying they change only the choices; `browser.bulkInspector.noDiskUndo` beside the apply says a saved
  file is not taken back by anything here (ruling 21).
- **Exclusions** with reasons (`bulkExclusionRows` → trigger, file, `tBulkExclusion`).
- **Apply:** plan counts (`bulkPlanCounts`), every blocker (`tBulkBlocker`), and the button sends
  `prepareBulkApply`'s request through `BrowserState.applyBulkOptions` (prop `apply`).
- **Outcome:** the headline, then execution counts and exclusion counts **in two separate lists**
  (`bulkOutcomeCounts` → `tBulkCount`), then each file (`bulkFileLines`: outcome sentence, command
  error, a failed re-read that is never a save failure). `notAttempted` and `failed` answers have their
  own sentences.
- **Consent review (ruling 22):** per refused file, the verdict, each finding (`tFindingCode`), and
  *Confirm for this file* (`acknowledgeBulkRefusal`) — or *Confirming cannot let this file be written*
  for a verdict no acknowledgement moves. The next apply carries the grant only while its key matches;
  `grantsAfterBulkAnswer` drops grants a new answer spent or invalidated.
- **Keep only the snippets that were not written** (`bulkNarrowingOffered` / `remainingBulkSelection`)
  drops the identities of files that were written, so the rest can be applied again; it never
  re-resolves.

### 1.4 Model additions (`src/lib/browser/bulkEdit.ts`)

`typeBulkIntentText` (a run of typing into one box is one undo step), `chooseBulkIntent`,
`bulkSelectingAvailability`, `spellingReadsWanted`, `failedSpellingReads`, `withoutFailedReads`,
`bulkOptionField`, `bulkSuggestionsFor`, `bulkExclusionRows`, `bulkPlanCounts`, `BulkCountName` /
`bulkOutcomeCounts`, `bulkFileLines`, `remainingBulkSelection`, `bulkNarrowingOffered`,
`grantsAfterBulkAnswer`, `bulkConsentRecorded`, `bulkCountKey`. Each has a unit test.

### 1.5 i18n

53 new keys in each language: `browser.list.bulk.*` (7) and `browser.bulkInspector.*` (46, of which 7
are `count.*`), plus the typed accessor `describeBulkCount` (`codes.ts`) / `tBulkCount` (`index.ts`).
The 15 `browser.bulkEdit.*` keys are unchanged. The draft's *Undo*/*Redo* labels are deliberately under
`browser.bulkInspector.*`, so 3-11-1's check that no `browser.bulkEdit.*` sentence names an undo still
holds; a new test pins that only `draftUndo`, `draftOnly` and `noDiskUndo` may name one.

### 1.6 Other files

- `DetailPane.svelte`: imports the inspector, counts `browser.bulkSelecting` in `busy` (the openers
  are withdrawn while it is drawn; its doc comment states why), and the new arm passes
  `openMatchDrafts()`.
- `scripts/lint/composition-guards.test.ts`: the new mounted suite joins the inventory (`invokeZero`).

## 2. Decisions

- **D1 — no `OpenWriteSurfaceKind` for the bulk edit** (3-11-1 §5 open item 3). Decided against,
  for three reasons:
  1. *The registry cannot represent it.* It holds one live entry per kind with one target, and
     `unknown` is reserved to the two destination-choosing kinds and means "every creator-eligible
     file" to `targetingSurfaceFor`. A bulk edit names several files; either representation would be a
     false statement to both predicates.
  2. *Neither consumer needs it.* `competingSurfaceFor` (a restore replacing a file under an open
     surface) and the inspector are mutually exclusive in this window: the inspector counts in
     `DetailPane`'s `busy`, so no restore (or any other surface) can be opened while it is drawn, and
     the list refuses to start selecting while any registered surface is open. `targetingSurfaceFor`
     (reconciliation not silently reloading under an open surface) protects drafted *file text*; the
     bulk draft holds none — only intents and identities — so a reload under it loses nothing and makes
     the selection stale, which `prepareBulkApply` blocks. While an apply is in flight, ruling 27's
     barrier is open on every applied file (3-11-1 §1.3).
  3. *Adding one forces the exhaustive assembly* (`PaneWriteSurfaces`, `WALKS` in `DetailPane.test.ts`,
     the receiver roster, the restore-refusal sentences) for no protected state.
  What this does **not** give: nothing in TypeScript forces the exclusivity — it rests on `busy` and on
  `bulkSelectingAvailability` being asked before the toggle is offered.
- **D2 — the selection is on `BrowserState`**, not a component's, because two panes draw it; it is
  reset by `open()`.
- **D3 — a row toggle, not checkboxes.** One control per row, native-button keyboard behaviour, and no
  checkbox that could be mistaken for an option value.
- **D4 — 3-11-1 §5 item 4 (an open raw draft):** answered by D1's exclusivity — the raw editor cannot
  be open while the inspector is, and vice versa — so no extra refusal was added.
- **D5 — 3-11-1 §5 item 1 (a bulk `RepairAttribution`):** not added. After a committed bulk file the
  held single selection gets the external-change notice; see §5.

## 3. Deviations

- `DetailPane`'s file-text toggle is still drawn while the inspector is open (see §5 item 1): hiding it
  would change a condition `rawDocument.test.ts` pins by exact source text, and that is not this
  phase's file to change.

## 4. Acceptance, clause by clause

| Clause | Test(s) |
|---|---|
| Multi-select drives the bulk selection; single-select unchanged | `keeps a row press a single selection until several are being selected`; `toggles rows into the bulk selection, draws the inspector and applies through the state`; `refuses to start selecting several while a write surface is open, and says why`; `drops the bulk selection when a workspace is opened again`; `ignores a toggle while not selecting several` (`BulkInspector.test.ts`, each per locale where marked) |
| Mixed display, untouched control emits nothing | `draws Mixed from two spellings of one text and the shared bytes of another, and sends nothing untouched`; in the partial case the request carries only the touched option |
| An exclusion with its reason | `lists a read-only snippet as left out with its reason, apart from what is written` |
| Consent review | `reviews a refused file’s findings, and the next request carries that file’s consent alone` |
| Partial outcome, exclusions and execution counted apart | `draws a partial outcome with execution outcomes and exclusions counted apart`; model: `keeps execution counts and exclusion counts in two lists, zero lines left out` |
| Draft undo/redo, no disk undo | `undoes and redoes the drafted intents, touching no file`; model: `keeps a run of typing into one box as one step…`, `names an undo only for the draft, and says a saved file is not taken back` |
| A stale selection blocks (drawn) | `blocks a selection whose spelling read answered a stale identity`; the real-state case after a committed file |
| Applies through `applyBulkOptions`, reads through `matchOptionSpellings` | the real-state case (`commands.matchOptionSpellings` ×2, `commands.applyBulkOptions` ×1, file 2 re-read at `rev-b`) |

## 5. Open items (noticed, not fixed here)

1. **The file-text toggle stays drawn while selecting several.** Pressing it shows nothing new (the
   inspector arm precedes the viewer arm) until selecting stops. Hiding it touches the condition
   `rawDocument.test.ts` pins verbatim.
2. **The `editorOpen` exclusion is unreachable in this window** for the same reason the duplicator's
   open-editor refusal is: `busy` keeps an editor from opening beside the inspector, and the toggle is
   refused while one is open. The wiring (`openMatchDrafts()`) is live; the model tests drive the arm.
3. **After a commit, the list's marks follow the new parse:** a row re-projected at a new revision is
   drawn unselected while the stale identity is still in `bulkSelection` (the count says so, and the
   inspector blocks with `staleSelection`). *Keep only the snippets that were not written* or *Clear the
   selection* is the way on. Whether a bulk-specific notice is owed is 3-11-3's or later.
4. **One undo step per choice, one per typing run.** A suggestion press is its own step.
5. **The inspector drops its reads, draft and grants when it unmounts** (stopping selection). That is
   the draft's lifetime by design; a person who stops selecting loses the drafted intents.
6. **Carried:** 3-11-1 §5 items 1, 2, 5, 6, 7, 8 stand unchanged (bulk `RepairAttribution`, conflicted
   file registers no origin, one read per snippet, stale sentences in `workspace.svelte.ts`, no warning
   beside a `NotOneScalar` option, the quoted-boolean discrepancy).

## 6. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Keys | Producer |
|---|---|
| `browser.list.bulk.{start, stop, unavailable, hint, count, clear, selectedMark}` (7, new) | `SnippetList.svelte` through `t` |
| `browser.bulkInspector.*` except `count.*` (39, new) | `BulkInspector.svelte` through `t` |
| `browser.bulkInspector.count.*` (7, new) | `bulkCountKey` / `describeBulkCount` / `tBulkCount` |

## 7. Gates and the rung

Each command below was run by this worker and exited 0; output went to files under `/tmp`, which were
then searched.

- `cargo test --workspace -- --test-threads=1`: 34 `test result` lines, **1505 passed, 0 failed** (unchanged; no Rust source changed)
- `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check` (no Rust source changed)
- `npm run check`: **479 files**, 0 errors, 0 warnings (+2: `BulkInspector.svelte`,
  `BulkInspector.test.ts`)
- `npm test`: **3922 passed**, 83 files (+38: 12 `bulkEdit.test.ts`, 20 `BulkInspector.test.ts`, 6 from
  the per-file lint scans over the two new files — built keys, hardcoded strings, boundary imports,
  the guard inventory, and the two `ipc-detail` scans)
- `npm run build`: **210 modules** (+2: `BulkInspector.svelte` is a styled component, which costs two —
  the component and its stylesheet; no new `.ts` module). Bundle oracle: the server-only markers are
  absent, the client-only markers present (2).

**Rung: `1505 / 479 / 3922 / 210`**, against `1505 / 477 / 3884 / 208`.

## § Review fixes

The phase review (`docs/reviews/phase-3-11-2.md`, Codex, ship-with-fixes) named one blocker and two
should-fix items. Each was fixed in the file it named plus the model and test files the fix needed,
each reproduced case is a test, and the gates were re-run (figures below replace §7's). No Rust source
changed, so cargo was not re-run.

1. **Blocker — the list's Stop stayed enabled while a bulk apply was pending**
   (`src/lib/components/SnippetList.svelte`). Pressing it unmounted the inspector and cleared
   `DetailPane`'s `busy`, so another writer could open mid-apply. `BrowserState` now counts its own
   `applyBulkOptions` calls (`bulkApplyPending`, the body moved unchanged into `runBulkApply` inside a
   counting `try`/`finally`); while one is out, `setBulkSelecting`, `toggleBulkSelection` and
   `replaceBulkSelection` change nothing, so the inspector stays mounted and `busy` holds until the
   apply settles. The list draws Stop, Clear and every row disabled from the same flag. Test:
   `keeps the selection session and every other writer closed while an apply is out (fix 1)`.
2. **Should-fix — a confirmation could bind options other than those shown**
   (`src/lib/components/BulkInspector.svelte`). New `bulkConsentReviewStatus` in `bulkEdit.ts`
   compares the file's key in the reviewed submission with its key as it would be sent now:
   `offered` / `recorded` only while they match, otherwise `outdated` — no *Confirm*, no *Confirmed*,
   and the new sentence `browser.bulkInspector.consentOutdated` (EN and ES). `onConsent` refuses unless
   the status is `offered`. A grant recorded earlier is kept but neither shown nor sent while the key
   differs (`prepareBulkApply` already matched keys); changing back makes it current again. Tests:
   `offers consent only while the file as it would be sent is the one reviewed (review fix 2)` (model)
   and `withdraws a confirmation once the options differ from the ones reviewed (fix 2)` (mounted).
3. **Should-fix — narrowing dropped snippets selected after the submission**
   (`src/lib/components/BulkInspector.svelte`). The last apply now keeps the selection it was built
   from, and `remainingBulkSelection` / `bulkNarrowingOffered` take it as `submitted`: only an identity
   in that snapshot is judged by the answer; one selected later is kept. Tests: `keeps a snippet
   selected after the submission, whatever that answer says (review fix 3)` (model) and `keeps a
   snippet selected after the apply when narrowing to what was not written (fix 3)` (mounted).

Noticed, not fixed: `open()` still resets the bulk selection even while an apply is out (a workspace
replacement, not a session end the review named).

Gates: `npm run check` **479 files**, 0 errors, 0 warnings; `npm test` **3930 passed** (+8: 2 model, 6
mounted — three cases per locale); `npm run build` **210 modules**, bundle oracle: server-only markers
absent, client-only present (2). One new ES sentence for the ruling 29 inventory:
`browser.bulkInspector.consentOutdated`.

Rung after the fixes: **`1505 / 479 / 3930 / 210`**.
