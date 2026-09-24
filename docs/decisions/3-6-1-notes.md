# Phase 3-6-1 — Trigger forms and `search_terms`: the model and the coordination

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-6" and its addendum of 2026-09-24 (the 3-6-1 /
3-6-2 / 3-6-3 cut); §3 rulings 4, 5, 6, 7, 23, 29, 30 and 31; §4.1.
**Risk:** high. **Model, coordination and the wire fields they need.** 3-6-2 owns the components and
the drawn strings; 3-6-3 owns the window half (ruling 31's commented multi-line flow list).

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 The core and the wire (`crates/espansoconfig-core/src/draft/`)

3-2 and 3-3 built the list intents and the trigger switch as a planner **argument** that did not
serialize (3-1 §4.4: commit no wire shape before a UI step needs one). 3-6-1 is that UI step.

- `MatchDraft` gains **`trigger_form: Option<TriggerFormChange>`** and **`sequences:
  Vec<SequenceIntent>`**, both `#[serde(default)]`, with builders `with_trigger_form` and
  `with_sequence`. `plan_match_edits_with` merges them into the structure exactly as it merges
  `content_switch`: a `Rename` is one more `FieldSubstitution::Trigger`, a `Switch` is the
  structure's switch, the intents are appended — so `plan_match_edits` alone (and therefore
  `save_match` and `run_one_save`, unchanged) plans everything. A draft switch beside a structure
  switch is refused at intent level as `SequenceIntentsConflict { triggers }`, after the three
  match-level checks, keeping the documented check order.
- New **`TriggerFormChange`** (`Rename { from }` — the destination is the other scalar form, so a
  rename to itself has no spelling — and `Switch { switch }`), **`ListPlacement`** (`Front {}`,
  `After { index }`, `End {}`, the wire twin of the engine's `ItemPlacement`, which keeps no serde),
  and serde on `SequenceIntent`, `TriggerSwitch` and `TriggerForm` (espanso keys, `snake_case`).
  `ScalarItems` crosses as a plain array read through `from_vec`, so **an empty item list is refused
  while the command's arguments are read**. Every variant is `deny_unknown_fields`.
- No new `DraftError`, `EditError`, finding or command. `src-tauri/src/dictionary_contract.rs`: the
  five new serializable enums are on `NOT_A_CODE` with reasons (`TriggerForm` a field identifier; the
  other four protocol tags), and the exempted-union list is six (`TriggerForm` added).

### 1.2 The wire mirror (`src/lib/ipc/types.ts`)

`TriggerForm`, `ListPlacement`, `SequenceIntent`, `TriggerSwitch`, `TriggerFormChange`, and the two
new `MatchDraft` properties. The three test-side `MatchDraft` literals gained them.

### 1.3 The list submodel (`src/lib/browser/matchLists.ts`, new)

`ListBaseline` (the file's list: style `absent`/`empty`/`block`/`flow`/`unsupported`, item texts,
eligibility), `ListBuffer` (`present` and items, each `{ origin, text }` — `origin` names a kept item
of the file's list, `null` a new one), the pure transitions (`withItemText`, `withItemAdded`,
`withItemRemoved` — never the last item, ruling 6 — `withListAdded`, `withListRemoved`),
`listDerivationOf` (the one producer of a list's wire intents), `listReapply`/`sameListState`/
`rebuiltList` (ruling 23), `committedList`, `listRowsOf`, `textsWritten`, `listRefusalKey`.

- **The intended order.** A run of new items is placed immediately above the next kept item
  (`Front`, `After(k-1)`, or `End`), so it never lands where the batch removes an item (rule 4 of
  `check_structure_is_coherent`), two runs never share a landing, and the file ends up holding the
  drafted order. `After` an item the same batch removes is legal and lands on the kept item —
  pinned in Rust by `an_item_placed_after_a_removed_item_lands_in_the_intended_order`.
- **Style is Rust's.** The model never chooses one: items move through 3-2/3-3's item intents, which
  write between a flow list's brackets and as block items in a block list; a new list is block, an
  explicitly empty one `[]` (ruling 5).
- **Refused rather than approximated**: kept items out of the file's order (`notInOrder`, reachable
  only by a hand-built buffer), every original item removed while new ones are added
  (`everyItemReplaced` — the core's `SequenceWouldBeEmpty`), a present list with no item
  (`wouldBeEmpty`).
- **Eligibility**, whole list: `unsupportedShape`, `unmodelledShape` (a repeated key), `itemNotText`,
  `itemNotDecodable`, `carriageReturn`, `lineBreak`, `ownsNoBytes`. Every item control is one line.

### 1.4 The editor model (`src/lib/browser/matchEditor.ts`)

- **`MatchBaseline.structure`** (`TriggerSideBaseline` — kind, held form, the `regex` scalar as a
  `FieldBaseline`, the `triggers` list, which form keys are free, the forms held in file order — and
  the `search_terms` list) and **`MatchBuffers.triggerSide`** (`form`, `confirmed`, the `regex` box,
  the `triggers` list) and **`MatchBuffers.searchTerms`**. The seventeen fields are unchanged in
  number; `regex` lives in the trigger side, not in `EDITABLE_FIELDS`, so no field walk, recovery
  table or retained-draft count moved for a draft that does not touch it.
- **`triggerSideDerivationOf`** is the one producer of the trigger side's wire intents (its table is
  in its doc comment): a held form edited in place; `trigger`↔`regex` as a `Rename` (the destination
  `Set` only when its text differs from the source's value, so the bytes are kept); scalar →
  `triggers` as `ToList` with the drafted items; a one-item block `triggers` → scalar as `FromList`;
  an `Absent` snippet's explicit *Add trigger*; nothing for `Several`. `intentsOf` takes the literal
  `trigger`'s intent from it, and `draftWith` fills `regex`, `triggers`, `search_terms`, `sequences`
  and `trigger_form` from one captured read (`capturedStructure`, the check-and-spend rule).
- **Transitions**: `chooseTriggerForm` (unconfirmed; carries the text unconverted; re-pointing resets
  the abandoned destination; choosing the held form cancels), `confirmTriggerForm`,
  `cancelTriggerForm`, `editRegex`, `editListItem`, `addListItem`, `removeListItem`, `addList`,
  `removeList` (`search_terms` only). Each structural one is its own history step; typing coalesces
  per subject (`TypingSubject`: a field, `regex`, or `list#position`).
- **Choices as values**: `triggerFormChoices` lists every other form with `offered` or a
  `TriggerFormRefusal` — **`wouldDropAliases { count }`** for a list longer than one (multiple→single
  never drops an alias silently), `flowList`, `listEdited`, `notEditable`. `Several` offers none;
  `Absent` offers each free form.
- **Presentation as model values**: `TriggerPresentation` — `form`, `several { forms, repair:
  'rawDocument' }` (every form shown, none picked, raw repair as a code), `absent`.
  `MatchEditorView.structure` carries the trigger side's view (presentation, drafted form, choices,
  preview, the `regex` box, the `triggers` list) and the `search_terms` list's.
- **Save gates**: `canSave` and `beginSave` refuse a `StructureProblem`
  (`triggerFormUnconfirmed`, `triggerFormEmpty`, `triggerFormNotOffered`, `listNotInOrder`,
  `listEveryItemReplaced`, `listWouldBeEmpty`), which `saveWithheld` reports.
  `writesACarriageReturn` also checks every structure text (`regex`, rewritten and added items, a
  switch's items or value) for a carriage return **and** a line feed.
- **The literal trigger** belongs to the trigger side: `isFieldEditable('trigger')` is true while the
  drafted form is `trigger` (held and editable, or the destination of a switch or an addition onto a
  free key); `removeField('trigger')` is refused and `canRemove` is `false` for it (ruling 6: removing
  the only trigger form is never an edit of one key). An editable box owes no refusal in its field
  model.
- **Reapply** (ruling 23): `planMatchReapply` adds `triggerSide` (in place: `regex` through
  `fieldReapply`, `triggers` through `listReapply`; a change of form is compound — applicable only
  when the whole trigger side is unchanged, satisfied when the disk already holds the drafted form
  and value or items, otherwise a collision of every form involved) and `searchTerms`. **Any external
  reorder, addition, removal, retyping, duplicated item or repeated key collides the whole list.**
  `collisions` became `CollisionSubject[]` (a field, `regex`, `triggers`, `search_terms`), named by
  `collisionLabelName` in `describeEditorReapplyObstacle`.
- **Conflict compare and copy**: `retainedDraft` appends rows for `regex` and each list **only when
  the draft says something about them**, with four new `DraftFieldStatus` arms (`itemAdded`,
  `itemRemoved`, `triggerFormAway`, `triggerFormTo`); the literal's row reports a change of form.
- **A commit** moves the structure baseline (`committedStructure`, `committedList`); the list style
  is predicted and the re-projection the commit owes reports the file's own.
- **A regex is never compiled in TypeScript**: `RegexDoesNotCompile` is the Rust validator's at save
  time, an editor-model error nobody can acknowledge; the refused outcome keeps the draft.

### 1.5 Recovery (`src/lib/browser/recovery.ts`)

`RecoverySession.structure: StructureTransfer` — `TriggerTransfer` (`trigger` in the box as before;
`regex`, seeded into the box and written `{ Regex }`; `triggers`, every item in order, written
`{ Multiple }`, the box unused and `editRecoveryField('trigger')` refused) and `ListTransfer` for
`search_terms` (the whole intended list, `[]` included, or `notCarried` with a reason). **Everything
or nothing**: a trigger side that cannot be carried whole falls back to the literal box with its
reason on the literal's row; a list is never carried in part. New `TransferRefusal` arms
`triggerFormCarried` and `listNotEditable { reason }` (composed with `tListRefusal`).
`structureTransferOfMatchDraft` and `LITERAL_TRIGGER_ONLY` are exported; `newMatchOfRecovery` takes
the structure as a required third argument. `RecoveryView` gains `triggerForm`, `triggerItems`,
`triggerEditable` and `searchTerms`.

### 1.6 i18n

26 new keys in each language (§7), one changed sentence, and typed accessors `tListRefusal`,
`tTriggerFormRefusal` (`{count}`), `tTriggerPresentation`, `tTriggerRepair`; `tSaveWithheld` and
`tTransferRefusal` cover their new codes.

## 2. Decisions

- **D1 — both new intents are draft fields, not command arguments**, for 3-5-1 D1's reason: one save
  intention, and the component's call path (`started.draft` → `saveMatch`) needs no change.
- **D2 — `regex` is part of the trigger side, not an eighteenth editable field.** Its box is editable
  only while the drafted form is `regex`, which is a trigger-side question; keeping it out of
  `EDITABLE_FIELDS` leaves every seventeen-field walk, table and count as it was.
- **D3 — multiple→single needs a one-item block list in the file.** The core refuses a switch beside
  any other `triggers` intent, so removing aliases and switching is two saves; the choice says so
  with `wouldDropAliases` and its count rather than dropping anything.
- **D4 — adding a trigger to an `Absent` snippet needs no confirmation**; a switch does (ruling 6
  names the switch). A blank addition is withheld (`triggerFormEmpty`), never written as nothing.
- **D5 — the literal trigger is not removable.** It is the only trigger form whenever it is editable,
  and ruling 6 forbids an unnoticed trigger-less snippet. Stated here because `canRemove` changes.
- **D6 — recovery carries a Multiple list and a regex.** Before this phase such a snippet's recovery
  carried no trigger and asked for a literal; it now carries the form whole. A `Several` still falls
  back to the blank literal box.

## 3. Deviations

- **Tests changed rather than added**: `recovery.test.ts` (two cases now use a `Several` fixture,
  since a `Multiple` and a `Regex` are carried; the export partition lists the two new exports),
  `RecoveryPanel.test.ts` (the mounted "opens its box blank" case likewise uses a `Several` — a test
  file; no component changed), `scalarFields.test.ts` and `recovery.test.ts` (`newMatchOfRecovery`'s
  third argument), and three `MatchDraft` literals.
- **The `triggerNotSingle` sentence was changed in both languages**: it said changing a snippet's
  trigger form *is not something this app does*, which this phase makes false. It now says only that
  the box does not edit the trigger and shows what the file holds.
- **No component was edited.** `svelte-check` passed over every component unchanged.
- One read-only `git status --short` was run by mistake at the start while reading the split notes;
  it changed nothing. No other git command was run.

## 4. Acceptance, clause by clause

| Clause | Evidence |
|---|---|
| Block and flow lists keep their style | `edits a block list only by item intents…`, `edits a flow list by the same item intents…`, `adds a new list as one field intent…` (`triggerLists.test.ts`); Rust `drafted_items_keep_the_list_style_and_the_intended_order` (`tests/draft_wire.rs`) |
| Additions and removals keep the intended order | `places each run of new items directly above the next kept item`, `refuses to remove the last item…`, `refuses a hand-built list whose kept items are out of the file’s order`, `undoes an addition as one step`; Rust `an_item_placed_after_a_removed_item_lands_in_the_intended_order`, `drafted_list_intents_plan_as_the_structure_argument_does` |
| A failed regex keeps the draft; the finding is Rust's `RegexDoesNotCompile`, never a JS `RegExp` | `sends a pattern that does not compile, and keeps the draft when Rust refuses it`, `holds no RegExp anywhere in the model that drafts a pattern`; Rust `a_drafted_regex_that_does_not_compile_is_refused_and_writes_nothing` (`commands.rs`) |
| Multiple→single never silently drops an alias | `refuses multiple→single for a longer list, by count, and never drafts it`, `converts a one-item block list…after a confirmation`, `refuses the switch for a flow list and for a list with unsaved edits`, `never removes the only trigger form`; Rust `a_drafted_switch_from_a_longer_list_is_refused_with_its_count` |
| External reorder or duplicate-list ambiguity refuses reapply for the whole list | `collides the whole list on an external reorder, a duplicate or a repeated key`, `collides the triggers list on an external reorder`, `collides a whole change of trigger form…`, `applies over an unchanged list and is satisfied by the whole intended result` |
| Recovery transfers everything or refuses explicitly | `carries a drafted triggers list and search_terms whole, in order`, `refuses a list it cannot carry whole, by name, and carries none of it`, `writes a recovered snippet with the carried form through the form’s own create` |
| `\r` refused at eligibility, at the transitions and at `beginSave` | the three `a carriage return or a line feed is refused for every new control` cases |
| `Several`/`Absent` as model values, raw repair as a code | the two `the Several and Absent presentations` cases |
| Trigger-form switching, compound and confirmed | `turns a single trigger into a list…`, `renames trigger↔regex in place…`, `gives everything back when the change is cancelled`; Rust `a_drafted_trigger_form_change_plans_as_the_argued_one`, `a_switch_is_the_only_intent_about_triggers`, `a_drafted_trigger_form_and_list_save_through_save_match` (`commands.rs`) |
| Wire form closed | Rust `the_list_and_trigger_form_wire_forms_are_closed` |
| Conflict compare and copy | `lists the drafted items with their status, and nothing for an untouched list` |
| New codes have sentences in both languages | `names a key for each code, present and non-empty in EN and ES, placeholders agreeing`; the i18n parity suites |

## 5. Gates and the rung

Every gate exited 0 on 2026-09-24: `cargo build --workspace`; `cargo test --workspace --
--test-threads=1 > /private/tmp/3-6-1-cargo.log 2>&1` (1428 passed, 0 failed, summed from the log);
`cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`; `npm run check` (465
files, 0 errors, 0 warnings); `npm test` (3651 passed, 75 files); `npm run build` (201 modules). The
server-only oracle printed nothing; the client-only oracle printed 2. `cargo tree -p
espansoconfig-core | rg tauri` printed nothing.

| | 3-5-2-2 | 3-6-1 | Why |
|---|---|---|---|
| Rust tests passed | 1419 | **1428** | +7 in the new `tests/draft_wire.rs`, +2 command tests in `commands.rs` |
| svelte-check files | 463 | **465** | +2: `src/lib/browser/matchLists.ts` and `src/lib/browser/triggerLists.test.ts` |
| vitest tests | 3617 | **3651** | +32 in `triggerLists.test.ts`; +2 generated by `scripts/lint/ipc-detail.test.ts`'s per-source-file scan for the two new files |
| Vite modules | 200 | **201** | +1: `src/lib/browser/matchLists.ts`, imported by `matchEditor.ts` and `../i18n` |

## 6. Open items (noticed, not fixed here)

1. **3-6-2 owns the drawing, including the recovery panel.** No component draws
   `MatchEditorView.structure` (presentation, choices, preview, the `regex` box, both lists) or
   `saveWithheld`'s new codes. `RecoveryPanel.svelte` does not draw `RecoveryView.triggerForm`,
   `triggerItems`, `triggerEditable` or `searchTerms`: for a carried `regex` its trigger box is still
   labelled *trigger*, and for a carried `triggers` list it draws a box whose input the model refuses.
   The addendum's 3-6-2 bullet names `MatchEditor.svelte` and the detail integration; the recovery
   panel belongs with them.
2. List items cannot be reordered (no core capability), and a list rewritten wholesale is withheld
   (`listEveryItemReplaced`); editing items in place is the route.
3. Multiple→single from a longer list takes two saves (remove the other aliases, save, switch).
4. A committed list's style is predicted (`committedList`), not observed; the re-projection a commit
   owes is what reports the file's own.
5. The `regex` box and list items are typed without moving `MatchEditorSession.focus`, which stays a
   seventeen-field value; a renderer that reports focus for them has no field to name.
6. The Rust tests pin byte output for the synthetic cases in `draft_wire.rs`; ruling 31's commented
   multi-line flow list (`flow-collections.yml:16-22`) is covered in the core by 3-3 and is 3-6-3's to
   read in a window.

## 8. Review fixes

`docs/reviews/phase-3-6-1.md`: one BLOCKER and one SHOULD-FIX, both fixed in the files they named.
No new key, code or Spanish sentence.

1. **BLOCKER — re-pointing a drafted list silently dropped aliases** (`src/lib/browser/matchEditor.ts`).
   `trigger ':a'` → *triggers* → add `:alias` → *regex* → confirm sent a rename and lost `:alias`:
   the choices checked the file's list, not the drafted one. `triggerFormChoices` now refuses a
   scalar form with `wouldDropAliases { count }` whenever the drafted form is a `triggers` list the
   file does not hold and it holds more than one item, so `chooseTriggerForm` refuses it and leaves
   every buffer as it was; the same guard covers an `Absent` snippet's drafted list, and choosing the
   held literal back over such a list (the sibling path, which went through the cancellation) is
   refused too — `cancelTriggerForm` stays the explicit discard. Regressions: the four `review fix: a
   drafted list is never dropped…` cases in `triggerLists.test.ts`.
2. **SHOULD-FIX — flow insertions overlapped removals** (`src/lib/browser/matchLists.ts`). In a flow
   list a removal takes its separator, so `RemoveItem(k)` beside `InsertItems After(k)` overlapped
   (the engine's `OverlappingEdits`). `listDerivationOf` now derives a flow list gap by gap
   (`flowGapIntents`): new items take removed items' places in order as `ItemDraft` rewrites, the
   removals left over are `RemoveItem`s, and new items left over go after the last rewritten item.
   A block list keeps the old placement, whose spans are disjoint. Regressions: the three `review fix:
   flow-list insertions…` model cases, and byte-exact Rust
   `flow_list_rewrites_in_a_removed_place_are_disjoint_and_byte_exact` and
   `block_list_insertions_beside_removals_are_byte_exact` (`tests/draft_wire.rs`).

Rung after the fixes: **1430 / 465 / 3658 / 201** (+2 Rust tests in `tests/draft_wire.rs`, +7 vitest cases in `triggerLists.test.ts`); every gate re-run and exited 0, the cargo log at `/private/tmp/3-6-1-fix-cargo.log`.

Open items noticed while fixing (not fixed here):

7. A rewritten flow item keeps any comment the file wrote beside it inside the brackets, where a
   removal would have taken it (stated in `flowGapIntents`' doc comment).
8. Flow pairing would make an every-item replacement of a flow list expressible, but
   `listEveryItemReplaced` still withholds it for every style.

## 7. New and changed Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | Producer |
|---|---|
| `browser.matchEditor.list.readOnly.{unsupportedShape, unmodelledShape, itemNotText, itemNotDecodable, carriageReturn, lineBreak, ownsNoBytes}` (7) | `listRefusalKey` (`matchLists.ts`), via `listBaselineOf` |
| `browser.matchEditor.saveWithheld.{triggerFormUnconfirmed, triggerFormEmpty, triggerFormNotOffered, listNotInOrder, listEveryItemReplaced, listWouldBeEmpty}` (6) | `saveWithheldKey` (`matchEditor.ts`), via `structureProblemOf` |
| `browser.matchEditor.triggerForm.{several, absent}` (2) | `triggerPresentationKey`, via `triggerFormViewOf` |
| `browser.matchEditor.triggerForm.repair.rawDocument` | `triggerRepairKey` |
| `browser.matchEditor.triggerForm.refused.{wouldDropAliases, flowList, listEdited, notEditable}` (4) | `triggerFormRefusalKey`, via `triggerFormChoices` |
| `browser.saveOutcome.field.{itemAdded, itemRemoved, triggerFormAway, triggerFormTo}` (4) | `draftFieldStatusKey` (`saveOutcome.ts`), via `structureRowsOf` / `retainedDraftOf` |
| `browser.recovery.transfer.{triggerFormCarried, listNotEditable}` (2) | `transferRefusalKey` (`recovery.ts`), via `transferOfMatchDraft` / `listTransferOf` |
| `browser.matchEditor.readOnly.triggerNotSingle` — **changed** | `fieldRefusalKey`, via `fieldEligibility` |

No `code.` key was added.
