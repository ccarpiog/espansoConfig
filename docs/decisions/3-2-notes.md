# Phase 3-2 — Sequence projection and block scalar-list edits

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-2", its §4.3 narrowing (`DocumentView.imports`), and
§3 rulings 4, 5, 23 and 34. **Risk:** high. **Core-only**, with no production UI caller.

3-2 gives the read model the difference between an absent list and an empty one, and gives the core
the edits that change how many items `triggers` and `search_terms` hold: scalar items added and
removed in a block list, a whole list field added or removed, and the `trigger`↔`triggers` switch.

No window reading was performed or claimed.

---

## 1. What the tree could not do before this phase

- **Absent and empty projected the same.** `TriggerSpec::triggers`, `MatchView::search_terms` and
  `DocumentView::imports` are `Vec<ValueView>`, empty both for a missing key and for `key: []`.
- **The empty-sequence anchor limit.** Before 3-1 it sat at `draft/plan.rs:852-869`; 3-1 moved it,
  and on the tree this phase started from it was the `visible_entries` doc at
  `draft/plan.rs:1054-1066`: a list was seen only through its first item's offset, so `triggers: []`
  gave an insertion no anchor, pinned by `an_empty_sequence_is_invisible_as_an_insertion_anchor`.
- **No scalar-item insertion existed.** `InsertItem` writes one flat *mapping* item. `RemoveItem`
  could already remove a scalar item of any block sequence, but the closed-surface audit refused
  every item edit and every list-field insertion.
- **No switch between a scalar and a list** (3-1 notes §8 item 3).

## 2. What changed

### 2.1 The projection (`model/{value,project,match_view,document,variable}.rs`)

- **`SequencePresence`** (`model/value.rs`): `Absent {}`, `Empty { location }`,
  `Items { location, flow, count }`, `UnsupportedShape { location, found }`. Every variant is a
  struct variant, so each crosses as a one-key object (`Absent {}` for `DraftError::MatchHasNoPath`'s
  reason). **`FieldLocation`** carries the key and value nodes, their byte spans and the value's
  path, all read off the syntax index in Rust.
- `Projector::scalar_sequence_field` now writes the presence on **both** branches, so a list written
  as a scalar, `~`, an empty value, a mapping or an alias is `UnsupportedShape` rather than absent.
  A repeated key is described by its first occurrence, the one the projection models.
- New fields: `TriggerSpec::triggers_presence`, `MatchView::search_terms_presence`,
  `DocumentView::imports_presence`. **§4.3 fits**: `imports` carries the same metadata, so 3-9 can
  draw absent and empty imports as two states. A profile, an unparsed document and a root that is not
  a mapping answer `Absent`. `depends_on` computes a presence and does not keep it (no surface).

### 2.2 The engine (`patch/edit.rs`, `patch/mod.rs`)

- **`EntryValue`** — `Scalar(String)` or `ScalarList(Vec<String>)`. `FieldInsertGroup` entries are
  now `(String, EntryValue)`; `new`/`after` still take scalar pairs, and `typed` takes either. A
  non-empty list is written in **block style** — the key alone on its line, one `- item` per line —
  and an empty one as `key: []` (ruling 5). The items' column is the key's column plus
  `indentation_step`, the document's own evidence (the mapping's block children first, then every
  mapping's, and two columns only when the document offers none), exactly as a `matches:` promotion
  derives it.
- **`ScalarItemInsert`** / `DocumentEdit::InsertScalarItems` — one or more scalar items at one
  `ItemPlacement` of an existing **block** sequence, written as one replacement in the stated order.
  Its landing is `block_sequence_landing`, which is `plan_item_insertion`'s former sequence arm moved
  into a function both now call, so a scalar item and a mapping item at one placement land at one
  offset. A flow list is `FlowSequenceInsertionUnsupported`; a non-sequence is `NotASequence` (no
  promotion: a list *field* is added through the group).
- **`ShapeSwitch`** / `DocumentEdit::SwitchShape` — renames an entry and changes its value between a
  single-line non-block scalar and a non-empty **block** list of scalars. Scalar → list replaces the
  key token through the old value with `newkey:` (or `newkey: []`), so an inline comment stays on the
  key's line, and writes the items after that line. List → scalar replaces the key token and its
  colon with `newkey: value` and deletes the items' lines through `removal_envelope` over the hull of
  the items' ownership extents — each item's own comments go, a file-owned comment stays — under a
  `StructuralGuard::Removal` with the sequence as the entry. Everything outside that licence is the
  new **`EditError::ShapeSwitchUnsupported`**.
- **Verification.** `verify_entry_value` checks a list value item by item (each decoded twice) and
  checks its style — flow for `[]`, block otherwise; `verify_items` checks a new scalar item the same
  way. Both report the new **`VerificationFailure::ItemNotInserted`**.
- **Position mapping.** `item_positions(edits, sequence, items)` (public) maps each original item
  index to its result index, or `None` for a removed one, from the same `replay_item_positions` the
  fold enforces. `candidate_path` carries every expectation path and every scalar-edit path through
  that map before `verify` re-resolves it in the candidate. **This was a defect the acceptance test
  found**: a `ScalarEdit` of `triggers[1]` beside a `RemoveItem` of `triggers[0]` was re-resolved at
  `triggers[1]` of the candidate — the wrong item — and refused as `ValueMismatch`. It was reachable
  before this phase too (an `InsertItem` into `matches` beside a scalar edit of a later match), but no
  caller built such a batch. `insertion_landings` now counts a `ScalarItemInsert`'s items when it
  derives where an `InsertItem` landed.

### 2.3 The draft (`draft/{sequence,plan,audit,error,match_draft,mod}.rs`)

- **`draft/sequence.rs`** (new): `SequenceIntent` (`InsertItems`, `RemoveItem`, `InsertField`,
  `RemoveField`), `TriggerSwitch` (`ToList { from, items }`, `FromList { to, value }`), `ScalarItems`
  (a first item and the rest: **"add no items" has no spelling**, which the type forces), and
  `MatchStructure`, which bundles them with the 3-1 substitutions.
- **`plan_match_edits_with(view, draft, &MatchStructure)`**; `plan_match_edits_with_substitutions`
  now delegates to it, and a default structure plans exactly what `plan_match_edits` planned.
- **Intent-level coherence** (`check_structure_is_coherent`), before any diffing: a whole-field intent
  is the only intent about its list; an item is removed once and not also rewritten; two insertions
  do not land at one place (`After(last)` and `End` are recognised as one place); an insertion does
  not land where the batch removes an item; a switch is the only intent about `triggers` and its
  scalar key carries no other intent.
- **Presence refusals**, per intent: `SequenceFieldAbsent`, `SequenceFieldPresent`,
  `SequenceHasAnUnsupportedShape`, `SequenceIsAFlowList` (item changes only — removing a whole flow
  list touches no delimiter and is allowed), `SequenceItemDoesNotExist`, `NotAScalar` for an elided
  item (removing it would discard structure never shown).
- **The last item** (`check_no_list_is_emptied`): removals that take every original item are
  `SequenceWouldBeEmpty`; `RemoveField` is the explicit intent for "no list". The engine refuses the
  same shape as `RemovalWouldEmptyTheSequence`, so no path leaves `[]` or a bare, null `key:`.
- **The switch**: `ToList` needs the scalar form present and `triggers` absent; `FromList` needs a
  block `triggers` of exactly one scalar item and the scalar form absent. A longer list is
  `SwitchWouldDiscardItems`.
- **The anchor limit is lifted.** `visible_entries` (`draft/plan.rs:1462-1471`) reads a list's key
  span from its presence, so `triggers: []` is visible; the test was rewritten in place (§6).
  `plan_insertions` also skips, as an anchor, a list the batch changes the items of (an insertion
  after its last item and after the whole entry are one offset) and the switched key.
- **The audit** (`draft/audit.rs`) admits: `RemoveItem` of `<match>.<triggers|search_terms>[i]`,
  `ScalarItemInsert` into `<match>.<triggers|search_terms>`, a group's `ScalarList` entry only under
  those two keys, `FieldRemoval` of either list, and a `ShapeSwitch` only between `trigger`/`regex`
  and `triggers`. Everything else — `vars`, `depends_on`, a `params` list, `matches`, a list under a
  scalar key, a mapping-item insertion — stays `OutsideTheClosedSurface`. Check 2 treats a switch and
  an item removal as removals; check 3 names a list's key for its item edits; check 8 covers a
  switch's new key; a new **check 9** refuses an item insertion landing on a removal, read off the
  placement alone.

### 2.4 The wire, the dictionaries and the contracts

Ten new codes, each in both dictionaries: `code.editError.shapeSwitchUnsupported`,
`code.verificationFailure.itemNotInserted`, and eight `code.draftError.*` —
`sequenceIntentsConflict`, `sequenceFieldAbsent`, `sequenceFieldPresent`,
`sequenceHasAnUnsupportedShape`, `sequenceIsAFlowList`, `sequenceWouldBeEmpty`,
`switchWouldDiscardItems` (placeholder `{items}`, a number operand) and `noSequenceInsertionAnchor`.
One new namespace, `code.sequencePresence.{absent,empty,items,unsupportedShape}`, with
`sequencePresenceKey`/`describeSequencePresence` in `codes.ts` and `tSequencePresence` in `index.ts`.

- `src/lib/ipc/types.ts`: `FieldLocation`, `SequencePresence`, `SequencePresenceName`, the three
  presence fields, and the new `EditError`, `VerificationFailure` and `DraftError` members.
- `dictionary_contract.rs`: `SequencePresence` registered; counts editError 42,
  verificationFailure 32, draftError 43, sequencePresence 4.
- `wire_contract.rs`: DraftError 43, EditError 42, save-transaction samples 210, operand check
  (127, 12, 71), placeholder check 210, a `FieldLocation` interface sample, `SequencePresenceName` in
  the union check, and the four presence states as tagged samples (14 → 18).
- `draftCodes.test.ts` (names, samples, count 43), `codes.test.ts` (namespace sample, one new case
  over both locales), `fixtures.ts` (`fixturePresence`), and `workspace.svelte.ts`'s owned copies.

The new Spanish sentences belong in the Phase 3 translation-review inventory (ruling 29): the ten
keys above and the four `code.sequencePresence.*` keys. Their producers are `plan_shape_switch` and
`verify_entry_value`/`verify_scalar_item` in `patch/edit.rs`, and `check_structure_is_coherent`,
`plan_sequence_intent`, `plan_switch`, `check_no_list_is_emptied`, `require_block_list` and
`plan_insertions` in `draft/plan.rs`, plus audit check 9.

## 3. Decisions

1. **Intents are an argument, not a `MatchDraft` field**, for 3-1 §4.4's reason: `MatchDraft`
   crosses the wire with `deny_unknown_fields`, and a core-first step commits no wire shape. None of
   the new draft types serializes. `ItemDraft { value: Remove }` **stays refused**
   (`SequenceItemRemoval`); a removal is a `SequenceIntent`. Its doc now says so.
2. **The last item is refused, never emptied.** Ruling 6 allows either refusal or a deliberate
   key removal; both are provided, as two intents.
3. **`FromList` refuses more than one item** rather than dropping aliases (3-6's "never silently
   drops an alias"). A caller removes the others first, as their own intents.
4. **Flow lists are refused for item changes** (3-3 owns delimiter-aware edits); `[a, b]` never
   becomes block style. A switch involving a flow list is `ShapeSwitchUnsupported`.
5. **A switch refuses multi-line values** and block-scalar old values rather than reshaping them.
6. **The fixtures are inline** (`tests/draft_sequence.rs`), as 3-1's are. The same text placed in
   `tests/corpus/synthetic/` failed nineteen corpus sweeps that pin a row or a census per fixture
   (projection counts, gate outcomes, frontier extents, the quoted-overshoot census among them);
   pinning nineteen new rows is not this step's subject, so the file was removed and no corpus
   fixture was added or changed.

## 4. Acceptance, criterion by criterion

| Criterion | Evidence (`tests/draft_sequence.rs` unless named) |
|---|---|
| Absent and present-empty project differently | `absent_and_present_empty_lists_project_differently`; also `every_presence_state_is_told_apart`, `imports_presence_tells_absent_from_empty` |
| Empty-sequence anchor limit lifted, with a test | `an_empty_sequence_is_visible_as_an_insertion_anchor` in `tests/draft_plan.rs` (rewritten, §6) |
| Multi-item insertion and a removal in one batch beside an edited survivor, byte-exact outside spans | `a_multi_item_insertion_and_a_removal_land_beside_an_edited_survivor` (exact text, `assert_outside_spans`, `item_positions` = `[None, Some(0), Some(1)]`); `items_after_a_middle_item_keep_their_order` |
| Removing the last item is explicit, never a stranded null | `removing_the_last_item_is_refused_and_removing_the_field_is_explicit` (draft `SequenceWouldBeEmpty`, engine `RemovalWouldEmptyTheSequence`, `RemoveField` leaves no bare key) |
| Item-owned comments travel, file-owned stay | `item_owned_comments_travel_and_file_owned_comments_stay`; `items_at_the_front_leave_the_first_items_comment_with_it`; the switch test with an owned comment |
| Outside `triggers`/`search_terms` refused by the audit | `a_list_edit_outside_the_two_lists_is_refused_by_the_audit` (`vars`, `depends_on`, a `params` list, `matches`, a list under `label`/`vars`, switches to other keys) |
| Trigger switch with a block list | `trigger_becomes_a_block_list_on_a_compact_first_line`, `a_one_item_list_becomes_a_single_trigger_and_a_longer_one_is_refused`, `the_engine_refuses_a_switch_it_does_not_reshape` |
| Verification maps original → result positions | `item_positions` + `candidate_path`; unit test `verification_rejects_a_list_item_or_a_list_value_that_is_not_the_one_asked_for` |
| Through `save_document` | `a_list_batch_commits_through_the_save_transaction` |
| Core free of tauri | `cargo tree -p espansoconfig-core \| rg tauri` printed nothing |

`assert_outside_spans` walks the bytes outside the engine's reported replacements itself; unlike
3-1's `assert_independently` it does not re-compare every untouched field's spelling, so the exact
expected text in most tests is what carries that half.

## 5. Gates and the rung

Every gate was run on 2026-09-23 and exited 0: `cargo build --workspace`;
`cargo test --workspace -- --test-threads=1 > /private/tmp/3-2-cargo.log 2>&1` (read from the log:
1372 passed, 0 failed); `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`;
`npm run check`; `npm test`; `npm run build`. The server-only oracle found nothing; the client-only
oracle found 2.

| | 3-1 | 3-2 | Why |
|---|---|---|---|
| Rust tests passed | 1352 | **1372** | +19 in the new `tests/draft_sequence.rs`, +1 unit test in `patch/edit.rs`. One `draft_plan.rs` test was rewritten in place. |
| svelte-check files | 461 | **461** | No `.ts`/`.svelte` file was added. |
| vitest tests | 3546 | **3548** | One new `it.each` case over two locales in `codes.test.ts`. |
| Vite modules | 200 | **200** | No module was added. |

## 6. Tests changed rather than added

- `an_empty_sequence_is_invisible_as_an_insertion_anchor` became
  `an_empty_sequence_is_visible_as_an_insertion_anchor`: its old assertion stated the limit this
  phase lifts.
- `verification_rejects_a_group_or_a_rename_out_of_place` (unit, `patch/edit.rs`) builds its
  `PendingField`s with `EntryValue::Scalar` now; its assertions are unchanged.

## 7. Open items

1. **No UI caller.** 3-6 owns list editing and the switch's preview and confirmation; it also
   decides whether `SequenceIntent`/`TriggerSwitch` get a wire shape, and what
   `code.draftError.sequenceItemRemoval` ("cannot take an item out of this list yet") should say once
   a UI removal exists on another path.
2. **No corpus sweep covers the new edits** (§3.6). A later step that adds a list fixture to the
   committed corpus owes the nineteen pins.
3. **`indentation_step` counts mapping children as evidence too**, so a document whose lists and
   mappings indent differently gives a new list the dominant of both. Correct YAML either way; a
   later step may prefer list-only evidence.
4. **`candidate_path` also changes a pre-3-2 behaviour**: a batch with an `InsertItem` into `matches`
   beside a scalar edit of a later match now verifies instead of being refused. No caller builds one
   (`create_match` sends one edit).
5. **Switches stop at the narrow licence**: flow lists, block-scalar triggers, multi-line values and
   lists of more than one item are refused, not reshaped.
6. **`FromList` and `ToList` name a `TriggerForm`**, so `regex`↔`triggers` is expressible. Nothing
   tests it through the planner beyond the audit's admission of `regex` → `triggers`.

## 8. Review fix (the adversarial review's one SHOULD-FIX)

`docs/reviews/phase-3-2.md` found that a disjoint batch the planner and audit admit — an item
appended to a block `triggers` list beside an absent `label` inserted after `replace` — was refused
by verification (`SiblingChanged`): the mapping fold digested the `triggers` entry as an untouched
sibling, and the list edit legitimately changes it. `apply_edits` in `patch/edit.rs` now hands
`fold_expectations` the scalar-rewritten nodes **plus every sequence with a pending item
expectation** (a promotion's zero-width scalar included). That drops only the list entry's digest:
its key and position are still compared, and the list's own item expectation still checks every
kept and new item, so no verification was weakened. Two regressions in
`tests/draft_sequence.rs` cover the append and a removal variant, each in both edit orders, with
the audit's admission, the independent outside-the-spans walk and the exact candidate text asserted.
Gates: `cargo test --workspace -- --test-threads=1` 1374 passed, 0 failed (+2); `cargo clippy`
and `cargo fmt --check` exit 0. Nothing else was noticed that needed an open item.
