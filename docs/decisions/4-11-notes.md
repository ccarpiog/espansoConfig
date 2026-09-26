# Phase 4-11 — Variable group, chips and choice controls

**Status:** implementation record for step 4-11 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 10, 11, 13, 20, 21, 23, 24 and 29 of §3 and override rows 4, 7 and 8 of §5, plus the four items
[`4-9-notes.md`](4-9-notes.md) §5/§8 handed to this step. The first **visible editing surface** of Phase 4:
a group inside the match editor, drawn by one new component over one new browser module. **No Rust
source and no wire type changed.** The step was **not cut**. **Window half owed to 4-13: no window reading
was performed or claimed** — every acceptance clause below is mounted evidence (ruling 29).

---

## 1. What changed and why

### 1.1 Browser: `src/lib/browser/variableGroup.ts` (new module)

The group's decisions as values; `VariableGroup.svelte` draws them.

- **`VariableGroupPort`** — what the surface needs from the window as one object: `snapshot`
  (`BrowserState.matchAuthoringSnapshot`), `structureRead` (`BrowserState.variableStructureRead` with the
  drafts open beside the editor) and `moveVariable` (`BrowserState.moveVariable`).
- **The analysis held** (`HeldAnalysis`, `analysisOf`, `heldAfterReply`): the Rust authoring snapshot for
  the session's identity. It counts as `current` only when both what it was asked for and the snapshot's
  own `id` equal the session's identity (document, revision, node); otherwise `reading`, `unavailable` or
  `outOfStep`, and nothing is drawn from it. A reply for an identity the editor moved away from replaces
  nothing.
- **The view** (`variableGroupViewOf`): the chip strip (one chip per declaration in authored order, then
  the draft's new variables — a removed declaration and a removed container keep every chip), the ordered
  list with each declaration's dependency state read from the analysis (usage by place, "no visible
  reference found", edges both ways with their kind, cycle membership, missing `depends_on` entries,
  ruling 11's "written before its dependency" advisory naming both, and the incomplete reasons that name
  it), the analysis-level incomplete reasons, the structure/addition/reorder refusals, and the controls of
  the one selection (`SelectedVariable` / `SelectedAddition`). `liveSelection` drops a selection that no
  longer names anything.
- **The Choice insertion** (`ChoiceDraft`, `choiceTargetsOf`, `choiceDraftOf`, `choiceValuesOf`,
  `choiceVariableOf`, `choiceInsertionViewOf`, `insertChoice`): a provisional name (`choice`, `choice2`, …
  via `suggestedName`), values one per line, the content key the `{{reference}}` goes into, the live name
  verdict, and *Insert* through 4-9's `insertVariable` — one history step, one save.
- **The echo *Add variable*** (`EchoDraft`, `echoDraftOf`, `echoVariableOf`, `echoAdditionViewOf`,
  `addEcho`): ruling 20's "Echo is authored through *Add variable*", over 4-9's `addVariable`.
- Key functions for the new codes: `analysisStateKey`, `declarationStatusKey`, `moveChoiceKey`,
  `choiceProblemKey`.

### 1.2 `src/lib/browser/matchEditor.ts`

- **The reorder writer's lifecycle** (4-9 §5 item 2): `MatchEditorSession.movedVariable` (the reorder the
  last submission sent, cleared by `beginSave`), **`beginVariableMove`** (refuses a dirty draft, a held
  observation, variables that accept no change, an offer for another identity or base revision, and a
  choice the offer does not hold; reads the installed session once, last) with `StartedVariableMove`
  (`submission`, and `acknowledgement` always `EMPTY_ACKNOWLEDGEMENT`). The answer goes through the
  existing `applySave` / `saveCouldNotBeSent`, so a commit adopts `saved.moved`, owes a re-projection and
  is never reported as an error; a committed reorder also marks the variables and the forms baselines
  `reprojectionOwed` (`baselineAfterAReorder`: every position moved).
- **`matchEditorView`**: `reorderAnswered`; over a reorder's outcome the refusal offers only *Keep
  editing*, and the reorder's own conflict withdraws *Keep my draft* and *Copy my text* and retains no
  rows (§3 items 3–4). The external conflict is never the reorder's and is untouched.
- **Sections**: `EditorSection` gained `{ kind: 'variables' }`, placed after the content keys and the
  content switch; **`sectionKey`** gives every section a stable key (§3 item 6).

### 1.3 `src/lib/browser/workspace.svelte.ts`

- `BrowserCommands` gained **`matchAuthoringSnapshot`**, **`analyzeMatchCandidate`** (4-9 §5 item 3) and
  **`moveVariable`**, with `REAL_COMMANDS` entries; the header's count of file-changing members became
  nine.
- `BrowserState` gained **`moveVariable`** (through `saveOneSnippetInPlace`, `saveMatch`'s one body:
  barrier, adoption, conflict that installs nothing, re-read after a failure that may have written) and
  the two readers as reported passthroughs (`reportedRead`). No screen calls `analyzeMatchCandidate` yet
  (§5 item 1). The `saveOneSnippetInPlace` doc and one stale "seven writing wrappers" comment in it were
  corrected, and `variableEditor.ts`'s `VariableMoveSubmission` doc now names the real sending path.

### 1.4 Components

- **`src/lib/components/VariableGroup.svelte`** (new): heading, chip strip (`button.chip`,
  `aria-pressed`), the analysis sentence and reasons, the ordered list (`li.variableRow`), *Insert a
  choice*, *Add an echo variable*, *Take out all the variables* / *Keep the variables*, the refusal
  sentences, and **only for the selection** the controls: three one-line boxes (or `SourceText` plus the
  reason for a read-only scalar), the D2u style line, remove/restore, the reorder choices or their refusal;
  a new variable's name, values and where its reference went, with *Drop this new variable*; or one of the
  two forms. Every transition goes back through `apply` to the editor's one session; every press mints its
  grant and name context from a structure read taken at the press (R37).
- **`MatchEditor.svelte`**: required prop **`variables: VariableGroupPort`**; the snapshot read (an effect
  keyed on the identity's three fields only, kept through `heldAfterReply`); `runVariableMove` (decided
  again over a fresh read, answered by the same transitions as a draft save); `selectionOf` (the content
  box found by a new `data-field` attribute); the section walk keyed by `sectionKey`; the reorder's
  refusal and conflict sentences.
- **`DetailPane.svelte`**: builds the port (`variablePort`) and `draftsBesideTheEditor` (§3 item 7).

### 1.5 i18n

**57 keys per language**, all frontend (no Rust code enum): 57 under `browser.variableGroup.*`. Reactive
wrappers in `src/lib/i18n/index.ts`: `tAnalysisState`, `tDeclarationStatus`, `tMoveChoice`,
`tChoiceProblem`; the rest are drawn with `t(…)` on static keys or through existing accessors
(`tRetainedLabel` for the three field labels, `tScalarStyle`, `tEdgeKind`, `tIncompleteReason`,
`tNameVerdict`, `tVariableFieldRefusal`, `tVariableMoveRefusal`, `tVariableAdditionRefusal`,
`tInsertRefusal`). Accessor naming follows 4-9/4-10's precedent (`*Key` in the model, `t*` wrappers), not a
`describe*` family in `codes.ts`. Every new key is used (checked by script).

### 1.6 Tests

- `src/lib/browser/variableGroup.test.ts` (20 cases, node environment): the view, the dependency state,
  D2u, both forms, the reorder writer, both languages for every new code.
- `src/lib/components/MatchEditorVariables.test.ts` (16 cases, jsdom, invoke-zero guard; inventoried in
  `scripts/lint/composition-guards.test.ts`): one `describe` per acceptance clause.
- `src/lib/components/DetailPane.test.ts`: *B1, extended to variable lists — the mounted half* (2 cases).
- `src/lib/browser/workspace.test.ts`: the reorder's write and the two readers (3 cases);
  `BARRIERED_MEMBERS` gained `moveVariable`.
- `src/lib/browser/scalarFields.test.ts`: the section order includes `variables`, and section keys are
  unique.
- Every strict `BrowserCommands` implementation in the tests gained the three members; the three
  `MatchEditor` mount sites pass `inertVariablePort` (new in `src/lib/browser/fixtures.ts`).

## 2. How each acceptance clause is met — mounted evidence, recorded as mounted

`MEV` = `src/lib/components/MatchEditorVariables.test.ts`; `VG` = `src/lib/browser/variableGroup.test.ts`.
None of this is a window reading; the visible counterpart of every row is owed to 4-13.

| Clause | Evidence (mounted unless marked model) |
|---|---|
| Controls are not mounted until selected | MEV suite 1: *draws the chips and the list with no box, then one declaration's boxes on selection* (zero inputs in the group before a press; three after pressing `second`; a second press hides them; `first`'s absent `inject_vars` is a sentence, not a box); *draws the group in Spanish too*; *edits a selected variable through its box* (the rename reaches the one save as `vars[0].name: Set`). Model: VG *draws one chip per declaration … and no controls until one is selected* |
| Every declaration stays reachable | MEV suite 2: *keeps a removed variable's chip and its restoration, and every chip under a removed container* (remove → chip kept and marked → restore; remove all → three marked chips, a chip still selectable, its boxes read-only → keep the variables); *draws a chip for a new variable, whose controls can drop it again*; *adds an echo variable through Add variable, with a chip, sent by one save*. Model: VG *keeps every declaration reachable …*, *drops a selection that names nothing any more* |
| A provisional name is labelled "available among visible names" under an open scope | MEV suite 3: with no analysis at hand and with an analysis whose scope is open, the Choice form opens with `choice` and the verdict line is exactly `browser.variableEditor.name.availableAmongVisibleNames`; under a closed scope it is `…name.available`, and a taken name is refused by name with *Insert* disabled; the Spanish sentence under an open scope. Model: VG *proposes a provisional name …* (`choice2` beside an existing `choice`) |
| The compound insertion reaches one save | MEV suite 4: *puts the reference and the choice variable into one draft, sent by one save* — the `replace` box reads `Hello {{choice}}`, one save call carries `replace: Set` and one `InsertVariable` with `Choice.values ['yes','no']`, and no reorder was sent; *takes both halves back with one undo*. Model: VG *inserts the reference and the choice variable as one step …* |
| Reorder cannot bypass the pending-draft rule or R25 | MEV suite 5: *offers no reorder while anything else is drafted, and offers it again once the draft is clean* (the `otherEditsPending` sentence replaces the choices); *offers no reorder over a stale draft in the file (R36)*; *sends the reorder alone, through the reorder port, and takes a commit as a success* (one `moveVariable` with `{ Front: {} }`, base `BASE`, empty acknowledgement; zero saves; the re-projection sentence, no failure sentence; the group read-only afterwards). Model: VG *starts only from a clean draft (R25), an offer for this identity and a choice the offer holds* |
| Conflict and recovery states draw | MEV suite 6: *draws a variable draft under a save conflict, read-only, and the recovery refusal after Keep my draft* (the retained row labelled *Variable name* holds `renamed`; the selected variable's boxes read-only; the reorder refused `editorNotEditable`; after *Keep my draft* the `variablesNotCarried` recovery sentence is drawn); *draws a reorder's conflict with nothing to keep or copy, and says why*. DetailPane *B1, extended to variable lists* (external removal and change): delivered `raised`, standing origin, save disabled, boxes read-only, `.panel.external` drawn with **two** *Variable name* rows in order. Model: VG *withdraws Keep my draft and Copy my text from a reorder's conflict …*, *offers only Keep editing over a reorder's refusal …* |

The four items owed by 4-9: sending `moveVariable` and handling its outcome (§1.2, §1.3; rows 5 and 6);
the two `BrowserCommands` wrappers (§1.3); B1's mounted variable-list case (row 6); the quoted
`inject_vars` display decision (§3 item 1; VG *says how the file writes a quoted inject_vars …*).

## 3. Decisions

1. **Quoted `inject_vars` (D2u).** The box holds the scalar's decoded text — the characters between the
   quotes, which is what `ScalarView.text` carries; no spelling is reconstructed and no byte span is
   sliced in TypeScript. Beside it the group draws how the file writes it (`tScalarStyle`: *Written
   between single quotes*), that the box holds the text between the quotes, and — for `inject_vars`
   only — that leaving it untouched keeps its quotes while any edit writes it without quotes (every
   writing path emits it as validated plain source since the 4-9 review). No type is inferred: `'false'`
   is shown as the text `false` with its style, never as a boolean. The same style line is drawn for a
   quoted `name` or `type`, which stay logical strings.
2. **The dependency state is the Rust analysis of the file as last read**, never re-derived and never
   claimed for the draft: renamed and new variables are analysed after saving, and the sentence above the
   list says so. It comes from `match_authoring_snapshot`, read once per identity.
3. **A reorder's conflict retains nothing and reapplies nothing.** The reorder is sent from a clean draft
   (R25), so the conflict retains no rows, *Keep my draft* and *Copy my text* are withdrawn, and a
   sentence says to load the disk version and choose the order again. This answers 4-8 §5 item 5 ("its
   conflict payload compares no container"): no container needs comparing because nothing is reapplied.
4. **A reorder's refusal offers only *Keep editing*.** Consent for a reorder is never collected
   (`StartedVariableMove.acknowledgement` is always empty); a sentence says the app does not offer to save
   a new order over findings. A reorder introduces no dependency edge, so a refusal is not expected; the
   route is recorded as a limit (§5 item 2), not built.
5. **One new variable per draft still holds** (4-9 decision 4): after a Choice insertion or an *Add
   variable*, both forms say the draft already adds one until it is saved.
6. **Sections are keyed by `sectionKey`, not by position.** The mounted suite's first run found that the
   content-switch section disappears during a save or a conflict, which shifted the variables section's
   position; a walk keyed by position handed its block to another section and destroyed the group's
   selection. The pre-existing walk was harmless until a section held component state; it is part of this
   step's own surface, so it was fixed here (mutation M8 pins it).
7. **The structure read from inside the editor names only the drafts open beside it**
   (`draftsBesideTheEditor`): `DetailPane`'s `editingMatch` captured the identity the editor opened with,
   which a committed save and re-seed leave stale, and listing it would make the editor's own old
   revision refuse every structural action. The grant adds the session's own identity itself.
8. **Choice targets** are the three reference bodies that accept changes and that the snippet holds or
   the draft writes: a reference never becomes the reason a new content key appears. A snippet whose
   content is a shorthand `form` gets `noTarget`.
9. **Choice values are one per line**; one final line break ends the last value; an empty line between
   values is refused by name (`emptyValue`) rather than dropped.
10. **The group's selection and the two forms' contents are component state**, not drafted: nothing is in
    the draft until *Insert* / *Add*, which is one history step. The selection is validated against the
    session on every read (`liveSelection`).
11. **No `analyzeMatchCandidate` call on screen.** The wrapper exists (4-9 §5 item 3); ruling 11's order
    advisory is drawn from the snapshot after the reorder commits and the snippet is read again, not as a
    preview before it (§5 item 1).

## 4. What is and is not guaranteed

- **Guaranteed by construction and pinned by tests, not by the compiler:** the group holds no session and
  every change goes through Phase 4-9's transitions into the editor's one draft; a reorder starts only
  through `beginVariableMove`, which refuses a dirty draft whatever an offer said; a reorder's answer is
  taken by the same transitions as a draft save's; a reply for another identity is not drawn; the controls
  of at most one declaration are mounted.
- **Not guaranteed:** that a handler mints its grant from a read taken at the press rather than reusing
  the drawn one (R37 — each handler in `VariableGroup.svelte` does, TypeScript cannot force it); that a
  host passes `BrowserState.moveVariable` rather than the bare command in the port (the prop's comment
  says so); that "available among visible names" means espanso accepts the name (imports are never
  resolved); anything about espanso's evaluation order or how it reads a quoted `'false'` (R16, R30).
- **Not guaranteed by this step at all:** that any window draws these values — the window half is 4-13's.

## 5. Open items noticed, not fixed

1. **No pre-move preview of ruling 11's advisory**: `analyzeMatchCandidate` is wrapped but no screen calls
   it; the "written before its dependency" advisory appears only after a committed reorder is re-read.
2. **No acknowledgement route for a refused reorder** (§3 item 4).
3. **Only the Choice and echo additions have forms**; the other `+ Insert` rows are later steps (ruling
   20's order), and existing variables' `params`, `depends_on` and list items stay 4-14's.
4. **The group's selection and form contents are lost when the editor closes or re-seeds** after a commit
   (§3 item 10); a re-seed also re-reads the snapshot.
5. **The editor reads a snapshot on every opening**, including snippets with no variables (needed for the
   name context's scope and captures); not measured.
6. **`openMatchDrafts` in `DetailPane.svelte` still lists `editingMatch`'s captured identity** for the
   move, delete and duplicate surfaces (their refusals are mutually exclusive with an open editor today,
   as its own comment records); §3 item 7's reasoning may apply there once that stops being true.
7. The 57 new keys per language join the Phase 4 translation inventory (4-24); none has been read on a
   window.
8. `git status --short` was run once, read-only, to list the changed files. No other git command was run.

## 6. Failing-first evidence, by mutation

Git was not used. `/private/tmp/4-11/mutate.py` applied each mutation, ran the clause's tests and
restored the file byte for byte (SHA-256 asserted); outputs `/private/tmp/4-11/mutation-M*.txt`, summary
`mutation-summary.txt`. Every mutation failed at least one test (runtime assertions, not build errors).
**M0 is the unchanged tree's behaviour** (no group is drawn).

| Mutation | Clause | What it breaks | Failing cases |
|---|---|---|---|
| M0 | all | the editor draws no variables group — the unchanged tree | 16 |
| M1 | 1 | a declaration's controls mounted with nothing selected | 3 |
| M2 | 2 | a removed declaration loses its chip | 2 |
| M3 | 3 | no analysis at hand read as a closed scope | 4 |
| M4 | 4 | the Choice insertion drafts the variable without its reference | 3 |
| M5 | 5 | a reorder offered over a pending draft (the offer) | 1 |
| M6 | 5 | `beginVariableMove` over a pending draft (the door) | 1 |
| M7 | 6 | a reorder's conflict offers *Keep my draft* and *Copy my text* | 2 |
| M8 | 6 | sections keyed by position (the group loses its selection) | 1 |
| M9 | 6 (B1) | the comparison keyed by label | 2 |
| M10 | 5 | a committed reorder owes no re-projection of variables and forms | 1 |
| M11 | 1–2 | a late snapshot reply for another identity overwrites the read | 1 |
| M12 | 6 | *Save anyway* offered over a reorder's refusal | 1 |
| M13 | 5 | `BrowserState.moveVariable` substitutes a base revision | 1 |
| M14 | D2u | a quoted `inject_vars` says nothing about an edit writing it plain | 1 |
| M15 | 2 | the echo name checked as a reference | 1 |

## 7. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-11/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`: 1734 passed, 0 failed), `cargo clippy --workspace --all-targets -- -D warnings`
(`clippy.txt`), `cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`: 497 files, 0
errors, 0 warnings), `npm test` (`npm-test.txt`: 93 files, 4240 tests), `npm run build` (`npm-build.txt`:
220 modules); bundle oracle — server-only markers absent (`oracle-server.txt` empty), client-only present
(2); `cargo tree -p espansoconfig-core` holds no `tauri` (`cargo-tree.txt`).

Rung **`1734 / 497 / 4240 / 220`** (was `1734 / 493 / 4191 / 217`): no Rust test added; +4
`svelte-check` files (`variableGroup.ts`, `VariableGroup.svelte`, `variableGroup.test.ts`,
`MatchEditorVariables.test.ts`); +49 vitest tests — 41 new cases (20 `variableGroup.test.ts`, 16
`MatchEditorVariables.test.ts`, 3 `workspace.test.ts`, 2 `DetailPane.test.ts`) and 8 per-file inventory
cases the lint suites generate for the new files (4 `scripts/lint/ipc-detail.test.ts`, 2
`composition-guards.test.ts`, 1 `built-translation-keys.test.ts`, 1 `hardcoded-strings.test.ts`), traced
with vitest's JSON reporter (`vitest.json`); **+3 Vite modules**: `variableGroup.ts` (one, a new `.ts`
module) and `VariableGroup.svelte` (two, a styled component).

## 8. Review fixes

The adversarial review (`docs/reviews/4-11.md`) returned two should-fix findings and no blocker. Each was
fixed in `src/lib/browser/variableGroup.ts` (plus `VariableGroup.svelte`, which holds the selection) and
pinned by tests; nothing else was changed. Failing-first evidence under `/private/tmp/4-11/fix/`: the new
mounted regressions run against the **unfixed tree** (`failfirst-unfixed-tree.txt`: the three suite-7
cases fail on their intended assertions), and each fix undone in place on the fixed tree
(`mutate-fix.py`, `failfirst-F1.txt`, `failfirst-F2.txt`, `failfirst-summary.txt`; file restored byte for
byte, SHA-256 asserted).

1. **SHOULD-FIX — new-revision analysis attached to old-order rows.** A committed write moves
   `session.match` to the new revision at once, so the snapshot read for it answered and matched, while
   the baseline rows stayed in the old order until the re-seed. `analysisOf` now answers `outOfStep` while
   `session.needsReprojection` or `baseline.variables.reprojectionOwed` holds: analysis positions are
   attached to rows only when both describe one projection. Tests: MEV *7 … draws no new-revision
   analysis over the old order, and the new order's after the re-seed* (reorder → committed → snapshot
   for the new revision answered → no row carries a usage line and the out-of-step sentence is drawn →
   *Read this snippet again* → the new order carries the new counts); VG *draws no analysis while a
   committed write owes the rows a re-projection …*. Undone: F1, 2 failing.
2. **SHOULD-FIX — a positional selection survived a re-seed.** `SeededSelection` binds a selection to
   the `MatchBaseline.variables` object it was chosen over (`seededSelection`, `selectionOfSeed`,
   `NO_SELECTION`); a baseline is replaced whole by a commit, a re-seed and a reapply and never by an
   edit, so a replaced one clears the selection whatever positions the new one holds. `VariableGroup.svelte`
   holds only a seeded selection (`select`). A side effect, deliberate: any committed write that replaced
   the variables baseline also clears the selection before the re-seed — the group accepts no change then
   anyway. Tests: MEV *7 … clears the selection when a reorder is committed and the editor re-seeded* and
   *… when a removal is committed …* (select `second` → move / remove + save → re-seed → no chip pressed,
   no box); VG *binds a selection to the baseline it was made over …*. Undone: F2, 3 failing.

**Open item added (§5, not fixed):** 9. The two forms' contents (`choice`, `echo` in
`VariableGroup.svelte`) are not seeded; they are hidden with the selection after a re-seed and their
stale text reappears only if the person reopens a form, which re-derives a provisional name anyway — so
nothing wrong is drawn, but the state lingers.

**Gates after the fixes**, all exit 0, outputs under `/private/tmp/4-11/fix/`: `cargo-test.txt` (1734
passed), `clippy.txt`, `fmt-check.txt`, `npm-check.txt` (497 files, 0 errors, 0 warnings), `npm-test.txt` (4245),
`npm-build.txt` (220 modules), `oracle-server.txt` (empty), `oracle-client.txt` (2), `cargo-tree.txt` (no tauri).

**Rung `1734 / 497 / 4245 / 220`** (was `1734 / 497 / 4240 / 220`): +5 vitest tests (3 mounted in
`MatchEditorVariables.test.ts` suite 7, 2 in `variableGroup.test.ts`); no new file or module.
