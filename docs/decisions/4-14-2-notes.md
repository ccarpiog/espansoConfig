# Phase 4-14-2 — Existing variables' parameters

**Status:** implementation record for step 4-14-2 of [`4-split-notes.md`](4-split-notes.md) §2 — the second
of the two pieces the dated 2026-09-26 addendum under `### 4-14` cut 4-14 into: drafting an existing
variable's `params` values, `depends_on` and list items, and an edited `offset`/`trim`/`debug` written as
plain source rather than a quoted logical string. It takes the inherited items `4-9-notes.md` §5 item 4 and
§8 finding 1 (and the `4-6-notes.md` open item they point at). **The popovers stay 4-15's.** **No window
reading was performed or claimed** — the evidence is model and mounted (ruling 29); the window half is 4-16's.

---

## 1. What changed and why

### 1.1 Rust: typed settings of an open mapping are planned by `plan_open_mapping` (failing first)

An existing variable's `params.offset`, `params.trim` and `params.debug` went through
`plan_open_mapping` → `plan_entry_value` → `plan_scalar`, so `offset: 0` edited to `3600` was written as
the string `'3600'` and `trim: true` edited to `false` as `'false'` (ruling 4's defect, fixed for
`inject_vars` in 4-9's review and for a form definition's `multiline`/`trim_string_values` in 4-6's).

- `OpenMapping` (`crates/espansoconfig-core/src/draft/plan.rs`) gained `typed_setting(key)` — `Offset`,
  `Trim`, `Debug` for `Params`; `Multiline`, `TrimStringValues` for a definition's options — and
  `not_plain_source(target, setting)`, the refusal per owner (`NewVariableSettingNotPlainSource` for
  `params`, `NewFormOptionNotPlainSource` for options).
- `plan_open_mapping` now asks each drafted entry whether it is a typed setting (key decoded, value a
  scalar), validates a `Set` with `is_plain_source` **before any comparison** and refuses by name, and
  hands `plain` to `plan_entry_value`, which plans a `Set` through `plan_plain_source_scalar` (source
  comparison, `ScalarEdit::plain_source`) instead of `plan_scalar`.
- **Reuse, not a copy:** 4-6's `plan_typed_settings` (`draft/form_plan.rs`) is **deleted**; `plan_definition`
  calls `plan_open_mapping` directly, so the definition options and `params` go through one rule. Four
  now-unused imports went with it.
- `DraftError::NewVariableSettingNotPlainSource`'s doc (`draft/error.rs`) now names the `Param` target.
  No wire change: the variant, its fields and its sentence
  (`code.draftError.newVariableSettingNotPlainSource`) already fit an existing parameter.
- Tests (`crates/espansoconfig-core/tests/draft_plan.rs`, new fixture `TYPED_PARAMS`):
  `an_existing_offset_and_trim_are_written_as_plain_source` (the editor's wire JSON for `offset` →
  `3600`, and `trim` → `false`: plain-source edits, plain bytes, nothing else moved),
  `an_existing_typed_param_compares_as_source_and_other_params_stay_logical` (a quoted `debug: 'false'`
  drafted as `false` is rewritten plain, a plain `offset: 0` drafted as `0` derives nothing, `format`
  stays a codec-quoted logical string), `an_existing_typed_param_refuses_a_text_that_is_not_plain_source`
  (eight texts × three settings, refused by name with a `Param` target).

### 1.2 Browser: `src/lib/browser/variableParams.ts` (new module)

The submodel of one existing variable's parameters, composed into `./variableEditor.ts`'s rows:

- **Baseline** (`ParamsBaseline`, from `paramsBaselineOf(view)`): one `ParamBaseline` per `params` entry —
  a `text` (a scalar: one-line when the key is a typed setting, else multi-line), a `list` (a sequence of
  scalars — and `{label, id}` records, whose items are then read-only `notText`), or `other` with a
  refusal (`keyNotNameable`: a key that is not a decoded scalar or that another entry repeats — Rust's
  `nameable_key`; `notText`: a mapping, an alias, an elided node). `depends_on` is a `ListBaseline` when
  written as a list. A list's `list` (its Rust `VariableList` name) is set only when items may be added
  and taken out: `depends_on`, or the kind's own list (`values`/`choices`/`args`, the first entry with
  that key, as Rust's `list_entry`), written with items, every item a scalar, and `params` not a flow
  mapping (`ParamsIsAFlowMapping`). A `form` variable's `layout` and `fields` are **excluded**: they are
  `./formEditor.ts`'s. `PLAIN_SOURCE_PARAMS` (`offset`, `trim`, `debug`) is the one TypeScript copy of
  Rust's list; `variableKinds.ts`'s `PLAIN_SOURCE_PARTS` now *is* it.
- **Buffer** (`ParamsBuffer`): the text of every text box, and per list one box and a removal flag per item
  plus the new items; `capturedParams` copies it into plain values (read once).
- **Derivation** (`paramsDerivationOf`): `EntryDraft { value: Set }` for a changed text,
  `EntryDraft { value: 'Unchanged', items }` for changed items of a `params` list, `ItemDraft`s for
  `depends_on`, and `VariableDraft.lists` — every `RemoveItem`, then one `InsertItems { End, Strings }`
  per list. A removed item's rewrite is never sent (Rust's `VariableListIntentsConflict` rule 2), a text
  equal to the file's is `'Unchanged'`, and every text is sent exactly as typed.
- **Transitions:** `withParamText`, `withListItemText`, `withListItemRemoval` (refused for the last item a
  list keeps — Rust counts removals against the original length), `withListItemsAppended`,
  `withAppendedItemDiscarded`; each refuses a carriage return, and a line feed in a one-line box.
- **Reapply and retention:** `intendedParamOf` / `intendedItemsOf` (what the draft intends each entry and
  list to hold) and `paramRowsOf` (the retained rows: `parameterName` with the key, then one
  `parameterValue` per intended value; one `dependsOn` row per intended `depends_on` item).
- **View:** `paramsViewOf` (`ParamsView`, `ParamView`, `ListView`, `ItemView`, `TextView`).
- **Codes:** `ParamRefusal` (four shared with the match editor's read-only sentences, two new) and
  `ListItemsProblem` (`noItems`, `emptyItem`, `carriageReturn`, `notAList`, `structure`), with
  `paramRefusalKey` / `listItemsProblemKey`.

### 1.3 `variableEditor.ts`, `formEditor.ts`, `matchEditor.ts`, `variableGroup.ts`

- `variableEditor.ts`: `VariableRowBaseline.boxes` and `VariableRowBuffer.boxes`; `variablesDerivationOf`
  sends a `VariableDraft` when a scalar **or** a parameter, item or dependency changes;
  `variableTextsOf` (the `beginSave` gate) now collects every `params` value (multi-line), every item
  rewrite and every `depends_on` rewrite (one-line) and every inserted list item (one-line);
  `keptRowIntended` compares `params` and `depends_on` **as intended** (`paramsIntended`,
  `dependsOnIntended`, `itemsIntended`: a drafted typed setting must be plain on disk, any other drafted
  text its logical string, an untouched value the same projected value); `variableRowsOf` appends
  `paramRowsOf`. New `withVariableBoxes` (the guard every parameter transition goes through: draftable,
  not removed, container not removed) and `variableRowEdited` (the one "edited" answer the derivation and
  the chip share).
- `formEditor.ts`: `withVerboseForms` **appends** a verbose layout's `params` entry to the variable
  editor's own `params` drafts instead of overwriting them (both reach one `VariableDraft`; they never
  name one entry).
- `matchEditor.ts`: `editVariableParam`, `editVariableListItem` (typing, joining the box's run; new
  `TypingSubject` spellings), `removeVariableListItem` and `appendVariableListItems` (structural, one
  history step, **under a grant** as 4-12's `values` items are — R36/R37), `restoreVariableListItem`,
  `discardVariableListItem` (no grant), `ListItemsOutcome`. *Add these items* parses one item per line
  with 4-12's `valuesOfLines` (reused).
- `variableGroup.ts`: `SelectedVariable.boxes` (`paramsViewOf`), and the chip's `edited` status from
  `variableRowEdited`.

### 1.4 `VariableGroup.svelte`

Inside the selected existing variable's controls, after its three scalar boxes: a *Parameters* heading and
one `[data-param]` block per entry (the key; a typed setting in an `<input>` with *Written exactly as
typed…*; any other text in a `<textarea>`; the style, the quoted-text and *any edit writes it without
quotes* notes, reused from 4-11; a refused value through `SourceText` with its sentence), and a *Depends
on* heading. A list (`listControls` snippet, `[data-list]`) draws one `<input>` per item with *Take out* /
*Keep*, each new item through `SourceText` with *Drop*, the *last item stays* note, and a *New items for
{key}* text area with *Add these items* and its problem. A refused box edit puts the box back to the
draft's text and says so beside it (role `status`). *Take out* and *Add these items* mint their grant
from a read taken at the press. No popover, no new component.

### 1.5 i18n

**20 keys per language** under `browser.variableParams.*`: `readOnly.{keyNotNameable,notText}`,
`problem.{noItems,emptyItem,carriageReturn,notAList,structure}`, `value`, `item`, `removeItem`,
`restoreItem`, `discardItem`, `removedItem`, `newItem`, `newItems`, `addItems`, `flow`, `fixed`,
`lastItem`, `editRefused`. Reused without change: the four `browser.matchEditor.readOnly.*` sentences,
`browser.variableKinds.plainSource`, `browser.variableGroup.{quotedText,editWritesPlain}`,
`browser.detail.field.{params,dependsOn}` (through `tRetainedLabel`). Wrappers in
`src/lib/i18n/index.ts`: `tParamRefusal`, `tListItemsProblem`. No value is identical across languages.

### 1.6 Tests and fixtures

- `src/lib/browser/variableParams.test.ts` (new, 19 cases, node): the wire shapes (offset, trim, debug,
  unfamiliar text, items, depends_on, removal plus insertion, restore, drop, last item, grants and
  problems, the verbose-form merge); box eligibility, `\r` at edit and at send (forged parameter, item,
  new item, line feed), and a getter read once; undo; a save conflict's retained rows and copy;
  `applicable` / `satisfied` / `collision` through `planMatchReapply`; recovery's `carriesDefinitions`;
  both languages.
- `src/lib/components/MatchEditorVariables.test.ts`: **suite 9** (8 cases, mounted). Suite 1's first case
  now expects the `echo` parameter box of `first` (a behaviour this step adds).
- `src/lib/browser/fixtures.ts`: `makeVariable` takes `listParamPresence` (default `null`, as before).

## 2. How each acceptance clause is met

`VP` = `src/lib/browser/variableParams.test.ts`; `MEV9` = suite 9 of
`src/lib/components/MatchEditorVariables.test.ts`; `DP` = `crates/espansoconfig-core/tests/draft_plan.rs`.

| Clause | Evidence |
|---|---|
| Failing-first Rust test: an edited existing `offset`/`trim`/`debug` written plain, refused by name, through `plan_open_mapping` | DP's three `…typed_param…` / `…offset_and_trim…` cases (§6.1 for the failing run) |
| Existing `params` values drafted | VP *the wire* suite; MEV9 *draws the parameters…*, *says how a quoted typed setting is written…* |
| `depends_on` and list items drafted | VP *sends a list item rewrite…*, *…a removal and an insertion…*, *never takes out the last item…*; MEV9 *edits, takes out, keeps and adds list items…*, *says why new items were not added…* |
| Shared lifecycle — undo | VP *takes a parameter edit back with one undo…*; MEV9 *takes a parameter edit back with one undo* |
| — conflict | VP *retains every drafted parameter…*; MEV9 *retains the drafted parameters under a save conflict, read-only…* |
| — reapply | VP *reapplies over an unchanged container, is satisfied…, and collides otherwise*, *is satisfied by removals and insertions…* |
| — recovery | VP *refuses recovery…*; MEV9 (recovery refusal after *Keep my draft*) |
| — save | MEV9 (every case that presses *Save* reads the sent `VariableDraft`) |
| Values as source text (D2u), unfamiliar text kept | VP *keeps an unfamiliar text exactly as typed…*; MEV9 (quoted-style and plain-source notes) |
| `\r` refused at load, edit and send | VP *makes a typed setting one line…* (load: `carriageReturn` read-only), *refuses a carriage return at edit…*, *refuses a forged carriage return at send…*; MEV9 *never takes a carriage return at edit…* |
| Both languages | VP *sentences*; MEV9 *draws the parameter controls in Spanish* |

## 3. Decisions

1. **The Rust fix lives in `plan_open_mapping`**, keyed by `OpenMapping`, so the three owners of an open
   mapping share one typed-setting rule and 4-6's separate pre-pass is gone. **Decided by the key alone**,
   whatever the variable's `type` (an `offset` on an `echo` is plain source too): that is the rule the
   audit (`is_a_new_variable`) and a new variable already use, and a typed spelling is never quoted.
2. **Order of refusals within one entry is unchanged in kind:** "does not exist" first, then the
   plain-source refusal, then the key's nameability — 4-6's pre-pass checked plain source over *all*
   entries before any other refusal; now it is per entry, in draft order. A draft carrying two faults can
   name a different one first than before; no existing test depended on it.
3. **A box shows the decoded text**, with the style beside it (4-9's and 4-11's rule for `inject_vars`),
   not the raw source slice: slicing a byte span in TypeScript is forbidden (`CLAUDE.md` §6), and no
   command hands a parameter's source text. A quoted typed setting says an edit will write it plain.
4. **Items are one-line boxes.** An item holding a line feed is read-only (`lineBreak`); new items come
   one per line, so a new item can never hold one. A `params` text other than a typed setting is a
   multi-line text area (`echo`, `cmd`, `format` may span lines).
5. **Adding and taking out items is offered only on the four lists Rust's `VariableList` names** and only
   when written with items. Other flat lists in `params` (an author-named list) are edited item by item
   only (`fixed` note). Items are appended at the end only; no front/after placement.
6. **The last item a list keeps is never taken out**, even beside new items: Rust counts removals against
   the original length. The note says so.
7. **Item removal and addition spend a structure grant**, as 4-12's `values` items do; editing a text and
   restoring or dropping need none.
8. **"Already there" compares the intended list item by item** (kept items by projected value, drafted
   texts as logical strings), so a reapply over a moved container is `satisfied` only when the whole
   intended result is on disk; any doubt collides the whole container (4-9 decision 5).

## 4. Lifecycle dispositions of every new value

| Value | Save | Discard (undo, reload, close) | Reapply / conflict | Recovery | Reparse |
|---|---|---|---|---|---|
| `VariableRowBuffer.boxes` (`ParamsBuffer`) | Derived into `VariableDraft.params` / `depends_on` / `lists`; `\r` refused by `beginSave` | One undo per typing run or structural action | Retained; rows `parameterName` / `parameterValue` / `dependsOn`; `applicable` holds it, `satisfied`/`collision` re-seed from the new baseline | Refused (`variablesNotCarried`, ruling 21) | Re-seeded from the projection after a commit |
| `VariableRowBaseline.boxes` (`ParamsBaseline`) | Not sent | — | Compared by `keptRowIntended` | — | Recomputed |
| `ParamsView` and its parts | Derived on read | — | Drawn read-only under a conflict | — | Recomputed |
| Component state `pendingItems` | Not sent until *Add these items* | Lost on close or re-mount | Not retained | — | Lost |
| Component state `itemsRefused`, `boxRefused` | Not sent | Drawn only while the session is the one refused over | — | — | Lost |

## 5. Open items noticed, not fixed

1. **`{label, id}` records of a `choice`'s `values`** are shown read-only (`notText`): the wire's
   `ChoiceRecordDraft` and record insertions are not drafted from the editor.
2. **An empty list (`depends_on: []`, `values: []`) takes no new item here**: `list` is set only for a list
   written with items. Rust's `ScalarItemInsert` may accept an insertion into `[]`; not measured.
3. **New parameters of an existing variable** (`insert_params`) and removing a whole parameter entry are not
   offered; nor is `depends_on` created where the variable has none.
4. **A key that repeats elsewhere in `params`** makes that entry read-only; the whole variable is refused by
   Rust (`AmbiguousVariableKey`) anyway, and the UI does not say that the other entries will be refused too.
5. **Plain-source text is not pre-checked in TypeScript** (as 4-14-1 §5 item 2): `offset: 1 d` or an empty
   `trim` is refused at save by name, the draft kept.
6. **Items are one per line and new items are appended at the end only**; no reordering of items.
7. `formsWriteUnreadable` in `formEditor.ts` also checks every `params` value for `\r`, so the variable
   editor's own collection of `params` values in `variableTextsOf` is a second, redundant guard (mutation
   M6 in §6.2 survived for this reason).
8. The 20 new keys per language join the Phase 4 translation inventory (4-24); none has been read on a
   window. The window half of these controls is owed to 4-16. The ES wording is owed the owner's
   native-speaker review with the rest of R35.
9. Git: one read-only `git status --short` (output discarded) was run by mistake, appended to a mutation
   command. No git command changed the tree or the index.

## 6. Failing-first evidence

### 6.1 Rust, on the unfixed tree

The three `draft_plan.rs` cases were written and run before the fix (outputs
`/private/tmp/4-14-2/failfirst-rust.txt` and `failfirst-rust-2.txt`): all three failed on runtime
assertions — `…offset_and_trim…` at the `writes_plain_source` assertion (the edit was a logical string),
`…compares_as_source…` at the quoted-`debug` rewrite (no edit derived), `…refuses…` at `"" in offset` (no
refusal). After the fix all three pass, and the core's whole suite passes unchanged (4-6's form-option
tests included).

### 6.2 Frontend, by mutation

Git was not used. `/private/tmp/4-14-2/mutate.py` applied each mutation, ran `variableParams.test.ts` and
`MatchEditorVariables.test.ts`, and restored the file byte for byte (SHA-256 asserted); outputs
`/private/tmp/4-14-2/mutation-M*.txt`, summary `mutation-summary.txt`.

| Mutation | What it breaks | Failing cases |
|---|---|---|
| M1 | the derivation sends no `params`/`depends_on`/`lists` — **the unchanged tree's wire** | 12 |
| M2 | a box takes a carriage return at edit | 2 |
| M3 | "already there" compares `params` as the baseline (the unchanged tree's reapply) | 2 |
| M4 | the last item a list keeps can be taken out | 2 |
| M5 | `withVerboseForms` overwrites the variable's `params` drafts (the unchanged tree's merge) | 1 |
| M6 | `variableTextsOf` ignores `params` values | 0 — survived; `formsWriteUnreadable` guards the same text (§5 item 7) |
| M7 | no key is a typed setting (`offset` a text area, no plain-source note) | 5 |
| M8 | a removed item's rewrite is sent beside its removal | 1 |
| M9 | `variableTextsOf` ignores `depends_on` rewrites | 1 |
| M10 | `variableTextsOf` ignores inserted list items | 1 |

## 7. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-14-2/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`: 1738 passed, 0 failed), `cargo clippy --workspace --all-targets -- -D warnings`
(`clippy.txt`), `cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check-final.txt`: 506 files,
0 errors, 0 warnings), `npm test` (`npm-test-final.txt`: 98 files, 4424 tests), `npm run build`
(`npm-build-final.txt`: 225 modules); bundle oracle — server-only markers absent, client-only present (2);
`cargo tree -p espansoconfig-core` (`cargo-tree.txt`) holds no `tauri`.

Rung **`1738 / 506 / 4424 / 225`** (was `1735 / 504 / 4395 / 224`): **+3 Rust tests** (the three
`draft_plan.rs` cases); **+2 `svelte-check` files** (`variableParams.ts`, `variableParams.test.ts`);
**+29 vitest tests** — 19 in `variableParams.test.ts`, 8 in suite 9, and 2 per-file inventory cases
`scripts/lint/ipc-detail.test.ts` generates for the two new `src/` files; **+1 Vite module**:
`variableParams.ts` (a new `.ts` module; no new component).

## 8. Review fix

The adversarial review ([`docs/reviews/4-14-2.md`](../reviews/4-14-2.md)) returned **ship-with-fixes: 0
BLOCKERS + 1 SHOULD-FIX**. It was fixed in the file it named and pinned by a mounted regression that failed
first on the unfixed code; nothing else was changed. Evidence under `/private/tmp/4-14-2/`.

1. **SHOULD-FIX — pending new-item text followed a position across a baseline replacement**
   (`src/lib/components/VariableGroup.svelte`). `pendingItems` was keyed by variable and parameter
   positions only, so text typed into `pick`'s *New items* box survived a commit and re-seed and was drawn
   (and could be added) in the box of whichever variable then held that position. **Fix:** `pendingItems`
   is now `{ seed, texts }`, bound to the `session.baseline.variables` it was typed over — 4-11's
   `SeededSelection` rule — and read only through the derived `pending`, which answers nothing once the
   baseline has been replaced (a commit, a re-seed, a reapply); `setPending` records a text over the
   current baseline and drops every text typed over a replaced one. **Regression:** suite 9 of
   `MatchEditorVariables.test.ts`, *review fix — pending new items never follow a position across a
   re-seed into another variable* (text typed for `pick` at position 1, an edit committed, the editor
   re-seeded over a file where `other` is at position 1: its box is empty and the text is nowhere in the
   group). Failing first: `review-failfirst.txt` (`expected 'meant for pick' to be ''`); fixed:
   `review-fixed.txt`. The case's last two assertions were adjusted after the failing run (a press of
   *Add these items* was dropped, because the harness's window read stays at the old revision, so the
   grant is refused and the button disabled); the assertion that failed first is unchanged.

**Gates after the fix**, exit 0: `npm run check` (`review-npm-check.txt`: 506 files, 0 errors, 0
warnings), `npm test` (`review-npm-test.txt`: 98 files, 4425 tests), `npm run build`
(`review-npm-build.txt`: 225 modules). Rung **`1738 / 506 / 4425 / 225`** (+1 vitest, the regression; no
new file or module).
