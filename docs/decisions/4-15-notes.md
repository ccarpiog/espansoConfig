# Phase 4-15 — Remaining popovers

**Status:** implementation record for step 4-15 of [`4-split-notes.md`](4-split-notes.md) §2, under rulings
20, 21, 23, 24, 26, 29 and 31 of §3. It delivers the six remaining `+ Insert` rows — Date/time, Random
choice, Clipboard, Shell command, Script, Another match — each opening a popover that drafts through the
4-14-1 kind submodels and inserts through 4-9's `insertVariable`; Echo stays reachable through *Add a
variable* and has no row. **No Rust source and no wire type changed.** The step was **not cut**. **Window
half owed to 4-16: no window reading was performed or claimed** — every acceptance clause below is mounted
evidence (ruling 29).

---

## 1. What changed and why

### 1.1 Browser: `src/lib/browser/variableKinds.ts`

The row model, beside the kind submodels it reuses (no new module):

- `InsertRowKind` (the seven kinds minus `echo`) and `INSERT_ROW_KINDS` — the six rows in ruling 20's order
  (`date`, `random`, `clipboard`, `shell`, `script`, `match`).
- `KindInsertionDraft` (`form`: a `KindDraft` fixed to the row's kind; `target`: the content key) and
  `kindInsertionDraftOf` (blank form, provisional name via `suggestedName`, the focused content key when
  it can take a reference, else the first — the Choice insertion's rule).
- `editKindInsertion` — the edit gate, over `editKindDraft` (a `\r` refused anywhere; a line feed refused
  in a one-line box and in the name), keeping the target.
- `KindPreview` / `kindPreviewOf` — what a popover says in place of a preview: `commandNotRun` (shell,
  script), `clipboardNotRead` (clipboard), `notYetAvailable` (date, random, match).
- `KindInsertionView` / `kindInsertionViewOf` — the parts (the shared `partViewsOf`, extracted from
  `kindAdditionViewOf`), the targets, the name verdict **as a reference** (an identifier is required), the
  problem (`noTarget` first, then the form's), warnings, `withheld`, `executes`, `readsClipboard`, the
  `{{name}}` text to be inserted (or `null` while the name is refused), `written` (`WrittenParam`: each
  parameter as text, lists marked so each item is drawn on its own — a script's argument boundaries) and
  `canInsert`. One snapshot of the form, one read of the target.
- `insertKindRow` — *Insert*: reads the value once and calls `insertKindVariable` (and so `insertVariable`):
  one history step, one save, the existing undo, conflict, reapply and recovery.
- Key functions `insertRowKey`, `kindPreviewKey`.

### 1.2 `src/lib/browser/variableGroup.ts`

`GroupSelection` gained `{ kind: 'insert', row }`; `sameSelection`, `liveSelection` and `selectedOf` handle
it (a popover is a selection like the Choice form, so at most one panel of the group is open).

### 1.3 Components

- **`src/lib/components/KindInsertion.svelte`** (new): one row's popover — heading, name box and live
  verdict, the espanso-may-run / reads-the-clipboard sentence (the existing
  `browser.variableKinds.note.*`), one textual box per owned part (label, espanso key, required/optional,
  *Written exactly as typed*, warnings), the target buttons, *What goes into the text* (`{{name}}`) and
  *What the new variable will be written with, as text* (each value through `SourceText`, list items
  labelled *Item n*), the *Preview* line, the edit refusal, the problem, the withheld reason, the insert
  refusal, the retention sentence, *Insert* and *Cancel*. **No other control.** A refused edit puts the
  box back and says why. *Insert* mints its grant and names from a read taken at the press (R37).
- **`src/lib/components/VariableGroup.svelte`**: the insertion row group *Insert into the text:* now holds
  *Insert a choice* followed by the six rows (`data-row`); *Add a variable* and the removal moved to the
  line under it. The group holds each row's popover value (`rowDrafts`, one per row), drawn through
  `KindInsertion` keyed by row; *Cancel* drops it, a successful *Insert* installs the session, drops it and
  selects the new variable.

### 1.4 i18n

**15 keys per language**: `browser.variableGroup.insert.heading`, six `browser.kindInsertion.row.*`,
`browser.kindInsertion.{reference,written,item,kept}`, `browser.kindInsertion.preview.{heading,
commandNotRun,clipboardNotRead,notYetAvailable}`. Wrappers `tInsertRow`, `tKindPreview` in
`src/lib/i18n/index.ts` (the `*Key` / `t*` precedent). Reused: `browser.variableGroup.{name,cancel,
choice.target,choice.insert,notEditable}`, `browser.variableKinds.*`.

### 1.5 Tests

- `src/lib/browser/variableKinds.test.ts`: suite *Phase 4-15 — the + Insert rows* (10 cases, node).
- `src/lib/components/MatchEditorVariables.test.ts`: **suite 10** (24 cases, mounted, the file's
  invoke-zero guard).
- `scripts/lint/no-execution.test.ts`: one case asserting the popover component, `VariableGroup.svelte`
  and `variableKinds.ts` are among the scanned files and clean.

## 2. How each acceptance clause is met — mounted evidence, recorded as mounted

`MEV10` = suite 10 of `src/lib/components/MatchEditorVariables.test.ts`; `VK15` = the Phase 4-15 suite of
`src/lib/browser/variableKinds.test.ts`.

| Clause | Evidence |
|---|---|
| The six rows; Echo through *Add variable*, no eleventh row | MEV10 *draws six rows after Insert a choice…* (labels in order, no `data-row="echo"`, Echo offered in *Add a variable*); VK15 *offers six rows…*; *draws the rows and a popover in Spanish* |
| Caret insertion | MEV10 *$row: inserts the reference at the caret…* (6 cases: caret at 6 → `Hello {{row}}`, one save, closed shape compared whole); *inserts into the chosen content key, at its own caret* (`html`) |
| Selection insertion | MEV10 *replaces the selected text with the reference, and one undo takes both halves back*; VK15 *replaces the selection…* |
| Cancellation | MEV10 *cancels without drafting anything, and opens blank again afterwards* (no chip, body unchanged, *Save* disabled) |
| Name collisions | MEV10 *refuses a colliding name by name…* (`takenByLocal`, `notAnIdentifier`, `takenByAddition`; "available among visible names" under the open scope); VK15 *checks the name as a reference…* |
| Required values | MEV10 *keeps Insert disabled until the required value is given…* (random, shell, script, match; date and clipboard enabled blank); VK15 *keeps Insert disabled…* |
| Retained drafts | MEV10 *retains each row's draft while another row, a chip or a form is looked at* (and a successful *Insert* drops only that row's); the conflict half: *retains an inserted shell variable and its reference under a save conflict…* (+ recovery refusal after *Keep my draft*) |
| Textual command and argument display, with the sentence | MEV10 *shows a multi-line command and each script argument as text…* (the `cmd` value with its one line break, each argument its own `SourceText`, *Item 2*, `note.executes`); VK15 *shows the command and each argument as text…* |
| No *Run test*, no clipboard-read control | MEV10 *%s: offers no Run test and no clipboard-read control…* (6 cases: the popover's buttons are exactly the two targets, *Insert*, *Cancel*); `scripts/lint/no-execution.test.ts` (the tree scan, now asserting the new sources are read) |
| Unsupported preview states are honest | MEV10 *says no preview is available for every row, and why…*; VK15 *shows the command… with no preview invented* |
| `\r` at load, edit and send | Load: a popover opens blank (VK15 *opens blank…*). Edit: MEV10 *never takes a carriage return at edit…* (textarea normalization; a forged value refused, put back and said); VK15 *refuses a carriage return at edit…*. Send: VK15 *refuses a forged carriage return at send…*; `insertVariable` and `beginSave` gates unchanged |

## 3. Decisions and deviations

1. **The rows live in the variables group, not in one unified `+ Insert` menu.** *Insert cursor position*
   stays beside the `replace` box (`MatchEditor.svelte`) and *Insert a form* in the form builder
   (`FormBuilder.svelte`), where 4-11/4-12 put them; the six new rows join *Insert a choice* under one
   *Insert into the text:* heading. Gathering all ten into one menu is a layout call recorded for 4-16 and
   the owner (§5 item 1).
2. **A "popover" is an inline panel**, the Choice form's pattern: the group's one selection. No floating
   layer was introduced; whether it should float is 4-16's window reading.
3. **"Retained drafts" means two things, both delivered.** A row's typed value is held per row by
   `VariableGroup.svelte` while another row, a chip or a form is looked at, and is dropped only by *Cancel*
   or a successful *Insert*; and an inserted draft is retained under a save conflict by the existing
   lifecycle (not copied). A row's value is component state and is lost when the editor closes (§5 item 3).
4. **The name is checked as a reference** (an identifier), as the Choice form does, because a row always
   inserts `{{name}}`. *Add a variable* still checks it as a name.
5. **No preview is shown for any row.** The preview core is 4-17 and the controls 4-19; until then each
   popover says no preview is available and why. For shell, script and clipboard the reason is permanent
   (ruling 26); for date, random and match the sentence says only that this application does not show
   what espanso would produce — it does not promise one.
6. **The "written" display is drawn only when the form has no problem**, since it shows exactly what
   `paramsOf` would send; a blank required part shows nothing plus the *required* sentence.
7. **Reused keys**: *Insert*, *Cancel*, *Name*, *Insert the reference into* and the two notes are the
   existing 4-11/4-14-1 strings; the popover heading is the row's label.

## 4. Lifecycle dispositions of every new value

| Value | Save | Discard (undo, reload, close) | Reapply / conflict | Recovery | Reparse |
|---|---|---|---|---|---|
| `KindInsertionDraft` (component state `rowDrafts`, one per row) | Not sent until *Insert* | Dropped by *Cancel* or a successful *Insert*; lost on close | Not retained (not drafted) | — | Kept (not positional); its verdict and target are re-derived live |
| The refused edit / refused insert (`KindInsertion.svelte` state) | Not sent | Drawn only over the value / session it was refused over | — | — | Lost |
| The inserted reference and variable | One `Set` on the content key plus one `InsertVariable`, one save | One undo takes both back | 4-9/4-14-1's rows and reapply, unchanged | Refused, `variablesNotCarried` (ruling 21) | Re-seeded after a commit |
| Selection `{ kind: 'insert', row }` | Not sent | Bound to its baseline by `SeededSelection` | Cleared by a new baseline | — | Cleared |
| `KindInsertionView`, `WrittenParam`, `KindPreview` | Derived on each read | — | — | — | — |

## 5. Open items noticed, not fixed

1. **No single `+ Insert` menu** gathers Cursor, Choice, Form and the six rows (§3 item 1); the Regex
   capture row is 4-22's.
2. **The popover is inline, not floating** (§3 item 2); its window reading, the multi-line command draft,
   the argument boundaries and the clipboard placeholder are owed to 4-16.
3. **Row values are lost when the editor closes or is re-opened** (component state, as 4-11 §5 item 4).
4. **One new variable per draft still holds** (4-9 decision 4): after one insertion every row is withheld
   with the `additionPending` sentence until the draft is saved.
5. **No `match`-kind check that the trigger exists** (4-14-1 §5 item 3, unchanged).
6. **No preview** for any row until 4-17/4-19 (§3 item 5).
7. The 15 new keys per language join the Phase 4 translation inventory (4-24); the ES text was written by
   the worker and is owed the owner's native-speaker review (R35).
8. `insertVariable` returns the caret after the reference; like the Choice insertion, the row does not
   move the body box's caret there.

## 6. Failing-first evidence, by mutation

Git was not used. `/private/tmp/4-15/mutate.py` applied each mutation, ran
`MatchEditorVariables.test.ts` and `variableKinds.test.ts`, and restored the file byte for byte (SHA-256
asserted); outputs `/private/tmp/4-15/mutation-M*.txt`, summary `mutation-summary.txt`. Every mutation
failed at least one test. **M1 is the unchanged tree's behaviour** (no row drawn).

| Mutation | Clause | What it breaks | Failing cases |
|---|---|---|---|
| M1 | all rows | no row drawn | 24 |
| M2 | retained drafts | a row reopens blank | 1 |
| M3 | cancellation | *Cancel* keeps the draft | 1 |
| M4 | name collisions | name not checked as a reference | 2 |
| M5 | honest preview | clipboard preview state says "not yet" | 2 |
| M6 | command sentence | no espanso-may-run sentence in the popover | 2 |
| M7 | `\r` at edit | a refused edit left in the box | 1 |
| M8 | no *Run test* | an extra control in the popover | 6 |
| M9 | argument display | arguments joined into one text | 2 |
| M10 | caret and selection | the box's selection ignored | 2 |
| M11 | no eleventh row | an echo row | 5 |

## 7. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-15/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`: 1738 passed, 0 failed), `cargo clippy --workspace --all-targets -- -D warnings`
(`clippy.txt`), `cargo fmt --check`, `npm run check` (`npm-check.txt`: 507 files, 0 errors, 0 warnings),
`npm test` (`npm-test.txt`: 98 files, 4464 tests), `npm run build` (`npm-build.txt`: 227 modules); bundle
oracle — server-only markers absent, client-only present (2).

Rung **`1738 / 507 / 4464 / 227`** (was `1738 / 506 / 4425 / 225`): no Rust test added; +1 `svelte-check`
file (`KindInsertion.svelte`); +39 vitest tests — 10 in `variableKinds.test.ts`, 24 in suite 10, 1 in
`no-execution.test.ts`, and 4 per-file cases the lint suites generate for the new component
(`built-translation-keys`, `hardcoded-strings`, `composition-guards`, `ipc-detail`); **+2 Vite modules**:
one new styled component.

**No window reading was performed or claimed.**

## 8. Review

The adversarial review ([`docs/reviews/4-15.md`](../reviews/4-15.md)) returned **ship-with-fixes: 0
BLOCKERS + 1 SHOULD-FIX**, fixed in the files it named and pinned by a regression that failed first on the
unfixed code; nothing else was changed. Evidence under `/private/tmp/4-15/`.

1. **SHOULD-FIX — the insertion target was lost across focus loss** (`src/lib/browser/variableKinds.ts`,
   `kindInsertionDraftOf`). The popover's initial target read `session.focus`, which the editor clears on
   the blur that pressing a row causes, so a reference meant for `html` went into `replace`. Fix:
   `lastContentFocusOf` answers the content key the focus names, or the one kept before; `VariableGroup.svelte`
   keeps it in `lastContent` (an effect over the session's focus), and `kindInsertionDraftOf` takes it as a
   fallback after the live focus and before the first eligible key. What TypeScript cannot force is that a
   caller keeps and passes it; `VariableGroup.svelte` does. Regression: suite 10 of
   `MatchEditorVariables.test.ts`, *review fix — keeps the content field last focused as the target after
   it blurs, and inserts and saves there* (focus `html`, place the caret, blur, open a row, insert: the
   pressed target is *HTML content*, the `html` box holds the reference, the save sends `html: Set` and
   `replace: Unchanged`). Failing first: `review-failfirst.txt` (1 failed — the target was *Replacement
   text*); fixed: `review-fixed.txt`. The Choice form's `choiceDraftOf` reads the focus the same way; it is
   outside this finding and recorded here as an open item for a later step.

**Gates after the fix**, exit 0: `npm run check` (`review-npm-check.txt`), `npm test`
(`review-npm-test.txt`), `npm run build` (`review-npm-build.txt`). Rung **`1738 / 507 / 4465 / 227`** (+1
vitest case); no new file or module.
