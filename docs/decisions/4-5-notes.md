# Phase 4-5 — Variable lists and labelled choices

**Status:** implementation record for step 4-5 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 4, 6, 8 and Phase 3 ruling 5 of §3, and with C2 of §7 pinned. Core-first: **no production UI
caller** sends anything this step adds (`matchEditor.ts` drafts `vars: []`). The step was **not cut**.
No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Draft types (`crates/espansoconfig-core/src/draft/variable_list.rs`, new)

- **`VariableList`** — `depends_on`, `values`, `choices`, `args`, serialized as the espanso key. A kind
  list is addressable only on its own kind (`VariableList::kind`, the inverse of
  `VariableKind::list_param_key`, pinned by a test); `values` alone `takes_records`.
- **`NewListItems`** — `Strings(ScalarItems)` or `Records(ChoiceRecords)`, each non-empty by
  construction and on the wire, so one insertion has one shape. **`ChoiceRecord { label, id }`**
  (logical strings, `deny_unknown_fields`).
- **`VariableListIntent`** — `InsertItems { list, at: ListPlacement, items }` and
  `RemoveItem { list, index }`. No whole-list add/remove: a kind list is a `params` entry with its own
  routes (`insert_params`, an `EntryDraft` `Remove`); `depends_on` has none yet (§5 item 1).
- **`ChoiceRecordDraft { index, label: Option, id: Option }`** — rewrites an existing record's two
  entries only; no remove spelling, and every other entry of the record is never named.
- **`VariableDraft`** gained `depends_on: Vec<ItemDraft>`, `records`, `lists` (serde default).
  An existing string of a kind list is still rewritten through its `params` entry's `EntryDraft::items`
  (2b-2b-2's route, unchanged), so each node has one route.
- **`DraftTarget`** gained `VariableListItem { variable, list, item }` and
  `ChoiceRecordField { variable, record, field }` — positions and schema keys, never text.

### 1.2 Planner (`draft/plan.rs`)

- `resolve_variable_list` finds a list or refuses by name: kind mismatch, `params` written between braces
  (`ParamsIsAFlowMapping`), absent, repeated key (`TargetKeyIsAmbiguous` via `nameable_key`), not a list.
- `check_variable_lists_are_coherent` (intent level): a list intent beside a `Set`/`Remove` of the kind
  list's own `params` entry; an item removed twice or removed and rewritten (by any of the three routes);
  two insertions at one landing; an insertion landing on a removal. `check_no_index_is_drafted_twice`
  also covers `depends_on` items and non-empty record drafts.
- `plan_variable_lists`, called per drafted variable after its scalars: `depends_on` rewrites and record
  rewrites are `ScalarEdit`s through `plan_scalar` (the one comparison); strings are one
  `ScalarItemInsert` (block, or between a flow list's brackets — Phase 3-3's engine); records are one
  `InsertItem::several` (block only); a removal is one `RemoveItem`. Shapes stay distinct
  (`VariableListItemShapeMismatch`: new items must match every existing item; records only in `values`;
  a mixed list takes neither). A record never enters or leaves brackets, and nothing leaves a flow list
  holding a non-string (`VariableListIsAFlowList`). A removed item is a string or a **flat** record; a
  record holding a collection is `NestedRemovalWouldDiscardUnshownStructure`. Removing every item is
  `VariableListWouldBeEmpty` (insertions do not rescue it, as for `triggers`).
- `plan_new_params` no longer anchors on a kind list whose items the draft changes (the list's end and
  the entry's end are one offset — the 3-2 rule one level down), so a new `params` entry beside an
  appended `args` item lands before the list instead of being refused as `OverlappingEdits`.

### 1.3 Engine (`patch/edit.rs`)

- **`InsertItem::several`** — several new mapping items at one boundary as one edit, in the stated
  order (the acceptance's "several insertions at one boundary" for records; two insertions at one offset
  state no order). `InsertItem::items`/`item_count`; `render_item` renders a run; the fold gets one
  `NewItem::Mapping` slot per item; `item_positions` and `insertion_landings` count every item and
  report every item's landing (§6). Every other constructor writes one item, unchanged.
- **Defect fixed — a new item's own mapping was not held to block style.** `verify_inserted_item`
  checked keys and values only, so a candidate rewriting a new item as `- {key: value}` verified
  (ruling 8 writes new non-empty collections in block style; `verify_item_value` already enforced it one
  level down). Failing first on a pristine `git archive HEAD` copy with pre-existing API only
  (`/private/tmp/4-5/failing-first-flow-item.txt`); regression
  `a_new_item_rewritten_as_a_flow_mapping_is_refused`. Fixed by requiring `CollectionStyle::Block`.

### 1.4 Audit (`draft/audit.rs`)

`check_closed_surface` admits: a scalar-item insertion into and an item removal from
`<match>.vars[i].depends_on` / `…params.<values|choices|args>` (`names_a_variable_list`); an
`InsertItem` into `…params.values` whose every item is exactly `label` then `id`, both logical-string
scalars (`is_a_new_choice_record`); scalar edits of `…depends_on[j]` and `…params.values[j].<label|id>`.
Everything one segment deeper, `label`/`id` under any other list, a record with an extra key and records
in any other list stay outside. `check_no_insertion_lands_on_a_removal` names a nested list's clash by
positions (`InsertionLandsOnARemoval`) instead of mislabelling it as `triggers`. An `InsertItem` into
`vars` now requires every item to be a new variable.

### 1.5 Errors, wire, contracts, i18n

- **Nine new `DraftError` variants (73 → 82):** `VariableListIntentsConflict`, `VariableListAbsent`,
  `VariableListHasAnUnsupportedShape`, `VariableListIsAFlowList`, `VariableListIsNotOfItsKind`,
  `VariableListWouldBeEmpty`, `VariableListItemShapeMismatch`, `NotAChoiceRecord`,
  `ChoiceRecordFieldHasNoScalar`. Operands are indices, `VariableList`, `DraftTarget` and `ValueKind`
  only, so the types force the no-text rule.
- `src/lib/ipc/types.ts`: `VariableList`, `ChoiceRecordField`, `ChoiceRecord`, `NewListItems`,
  `VariableListIntent`, `ChoiceRecordDraft`, the three `VariableDraft` fields, two `DraftTarget`
  variants, nine names and payloads.
- `src-tauri/src/dictionary_contract.rs`: `draftError` 73 → 82; `VariableList`, `ChoiceRecordField`,
  `NewListItems`, `VariableListIntent` on `NOT_A_CODE` with reasons; the first two on the exempted-union
  list. `src-tauri/src/wire_contract.rs`: 73 → 82.
- `src/lib/i18n/{en,es}.json`: **9 keys per language** (`{list}` interpolates the espanso key);
  `draftCodes.test.ts` samples all nine (count 82). No new accessor: `describeDraftError` covers them,
  and its doc comment's operand sentence was corrected (it was already missing 4-4's `{setting}` and
  `{limit}`).
- Present-state sentences corrected: `draft/mod.rs` (module doc, invariant, new section),
  `draft/match_draft.rs` (insertion bullet, `VariableField`, `VariableDraft`), `draft/new_variable.rs`
  (the records sentence), `draft/plan.rs` (`plan_match_edits`), `draft/audit.rs` (module doc,
  `check_closed_surface`, `names_a_surface_scalar`), `patch/edit.rs` (`InsertItem`'s licence,
  `verify_inserted_item`, `render_item`).

## 2. How each acceptance clause is met

Tests in `crates/espansoconfig-core/tests/variable_lists.rs` (18) and the Phase 4-5 section of
`src/patch/edit/corrupted_candidate_tests.rs` (3). Exact-bytes assertions throughout.

| Acceptance | Evidence |
|---|---|
| First, middle and last additions and removals | `first_middle_and_last_additions_land_where_asked_in_every_block_list` (`depends_on`, `values`, `args`, the front landing above the first item's owned comment); `first_middle_and_last_removals_take_the_items_own_comments` (strings and records, the owned comment going with its item, a flat record with an unknown entry, a record holding a collection refused) |
| Empty lists | `an_empty_list_takes_strings_between_its_brackets_and_is_never_emptied` (`depends_on: []` and `values: []` gain strings in place; a record into `[]` refused; no item 0 of `[]`; removing the last item refused, with and without a rescuing insertion) |
| Changed survivors | `an_insertion_a_removal_and_a_changed_survivor_share_one_batch` (`depends_on`; string `values` through `EntryDraft::items`; records with a relabelled survivor; `args`; flow `choices`) |
| Several insertions at one boundary | `several_insertions_at_one_boundary_are_one_edit_in_the_order_asked` (three strings, one quoted `'true'`; two records as one `InsertItem`, `'Yes'`/`'yes'` quoted; two intents at one landing refused); `several_items_of_one_insertion_take_one_position_each` (`item_positions`, `insertion_landings`) |
| String and record shapes stay distinct | `string_and_record_shapes_stay_distinct` (records into strings, `depends_on`, `args`; strings into records; a mixed list; a record rewrite of a string `NotAChoiceRecord`; a string rewrite of a record `NotAScalar`; a record draft on a `random`) |
| An existing flow list stays flow or is refused by type | `a_flow_list_stays_flow_or_is_refused_by_type` (front/end/removal in flow `choices`, flow `depends_on`; records into/out of a flow list and strings into flow records refused; a flow record rewritten in place; `params: {…}` refused) |
| A flow list holding a comment keeps `CommentInFlowCollection` (C2) | `a_flow_list_holding_a_comment_keeps_its_comment_in_flow_collection_refusal` (insertion, removal and item rewrite all `MatchNotEditable { CommentInFlowCollection }`; the projection's gate named) |
| Unknown entries inside a record survive | `unknown_entries_inside_a_record_survive_its_edits` (`emoji: smile` kept byte for byte; an unchanged `Some` derives nothing; an absent `id` is refused, not added) |
| Corrupted candidates for new nested shapes | `a_nested_lists_honest_candidate_verifies`, `a_corrupted_nested_list_item_is_refused_by_verification` (12 corruptions over several records, nested block strings, nested flow strings and a record label: ambiguous scalars, wrong values, a dropped/extra/swapped/string record, a record as a flow mapping), `a_new_item_rewritten_as_a_flow_mapping_is_refused` (§1.3) |
| Refusals carry positions and codes | forced by the types (§1.5); `refusals_carry_positions_and_codes_never_text`, `a_list_that_is_not_there_or_not_a_list_is_refused_by_name` |
| Coherence, surface, wire, hard shapes | `intents_that_contradict_each_other_are_refused_before_any_diffing`, `a_new_param_beside_a_list_insertion_is_anchored_before_the_list`, `the_closed_surface_admits_the_four_lists_and_nothing_near_them`, `variable_list_drafts_cross_the_wire_as_closed_shapes`, `crlf_and_a_missing_final_newline_are_kept`, `every_kind_list_is_its_kinds_list_parameter` |

**Failing first** (`/private/tmp/4-5/failing-first.txt`, a throwaway probe on the tree before any change,
deleted after the run): every one of nine edits — flow and block `depends_on` insertion, removal, a flow
`choices` removal, a record insertion, removal and label edit, a flow record edit, a `depends_on` item
edit — was `OutsideTheClosedSurface`; the engine applied all of them. The verifier defect's own evidence
is §1.3's.

**Existing tests whose expectation changed:** `a_path_one_segment_deeper_than_the_surface_is_refused`
(`tests/draft_plan.rs`: `values[0].id` is inside now; the over-deep samples became `choices[0].id`,
`values[0].id.deeper`, `depends_on[0].deeper`); `a_list_edit_outside_the_two_lists_is_refused_by_the_audit`
(`tests/draft_sequence.rs`: the `depends_on`/`values` items moved to its "inside" list, replaced outside by
`params.layout` and a form field's `values`); `the_closed_surface_admits_a_new_variable_and_nothing_near_it`
(`tests/variable_intents.rs`: its "one segment deeper" removal became `params.layout[0]`).

## 3. What is not guaranteed

- **Removing a flat record removes its unknown entries with it**, as removing a whole variable does
  (4-4 §3). They were projected, so a screen can show them; nothing refuses the removal for holding them.
- **The shape rule reads the projection's item kinds**: a list of mappings that are not `{label, id}`
  records still counts as "records" and takes a new record; the audit checks only what is written.
- **Kind is the projection's**: a draft that also rewrites `type` is judged against the old kind.
- **A variable inside a flow `vars`** (`vars: [{name: a, depends_on: [b], params: {…}}]`): a kind-list
  intent is `ParamsIsAFlowMapping`, but a `depends_on` insertion or removal is planned and then refused
  by the engine (`FlowSequenceInsertionUnsupported`, typed, never written), not by the planner by name.
  A rewrite of an existing item there is an in-place scalar edit and is written, as a variable scalar
  of a flow `vars` already was (probe output `/private/tmp/4-5/probe-flow-variable.txt`).
- **Whether espanso reads** a record list mixing shapes, or an empty `values`, as intended is R16/R30
  territory and not claimed. **TypeScript mirrors are hand-written**; the new input types are checked on
  the Rust side only (`variable_list_drafts_cross_the_wire_as_closed_shapes`).

## 4. Gate and rung

All run serially, output under `/private/tmp/4-5/`: `cargo test --workspace -- --test-threads=1` 0
(1648 passed); `cargo clippy --workspace --all-targets -- -D warnings` 0; `cargo fmt --check` 0;
`npm run check` 0 (487 files, 0 errors, 0 warnings); `npm test` 0 (4086); `npm run build` 0 (214
modules); bundle oracle — server-only markers absent, client markers present (2);
`cargo tree -p espansoconfig-core | rg tauri` empty.

**Rung:** `1648 / 487 / 4086 / 214` against `1627 / 487 / 4086 / 214` — twenty-one Rust tests added
(`variable_lists.rs` 18, `corrupted_candidate_tests.rs` 3). Vitest's count is unchanged:
`draftCodes.test.ts` gained nine samples inside existing cases. **Module count unchanged:** no new `.ts`
module or styled component.

## 5. Open items noticed, not fixed

1. **`depends_on` cannot be added or removed as a whole** by a draft (no `depends_on:` insertion into a
   variable, no explicit container removal), so its last item cannot be taken away at all; a kind list's
   whole-entry routes exist. The step that draws a dependency editor owes one or the other.
2. **`nestedItemRemoval`'s sentence** ("cannot yet take an item out of that list") is still what an
   `ItemDraft` `Remove` reads; removal now exists as a list intent, so the sentence should point there when
   a screen draws it. `targetDoesNotExist` still says the editor "adds nothing inside a snippet" (4-4 §5
   item 4), which is now less true again.
3. **C2's decision stays deferred**: the flow engine can place a comment on an item's own line, yet the
   match-wide gate refuses the whole match first. This step pins the refusal; it does not decide it.
4. **A new record's `label`/`id` are always both written.** Espanso may accept a record without `id`;
   whether a screen needs a one-key record is a later step's question.
5. **Replacement of existing bytes is still guarded by the ambiguity differential only** (4-4 §6): a
   record-label or `depends_on` rewrite balanced by a removal of an ambiguous scalar would pass the
   whole-document budget; the inserted-text property does not cover a rewrite.
6. **List lengths remain unbounded** (4-4 §5 item 6); `InsertItem::several` and `ScalarItems` take any
   count.
7. Neither language's sentence for the nine new codes has been read on a window (4-13; the Phase 4
   translation inventory, 4-24).
8. A `depends_on` cardinality edit inside a flow `vars` reaches the engine before it is refused (§3); a
   named planner refusal would need a sentence that fits a list inside a bracketed variable.

## 6. Review fixes

Review: [`../reviews/4-5.md`](../reviews/4-5.md) — Codex, `ship-with-fixes`, 0 blockers, 2 SHOULD-FIX.
Both regressions failed first on the unfixed tree (`/private/tmp/4-5/fix/failing-first.txt`,
`/private/tmp/4-5/fix/failing-first-mixed.txt`).

1. **Only the first item of a several-item insertion was judged for a repeated trigger.**
   `insertion_landings` reported the first item's landing alone, so `persist/save.rs` produced
   `NewMatchRepeatsLiteralTrigger` for that item only and a later new snippet repeating a trigger saved
   unacknowledged. **Fix:** `insertion_landings` (`patch/edit.rs`) reports one pair per item written, and
   `findings_of` (`persist/save.rs`) judges every landing of each insertion. Regression
   `every_item_of_a_several_item_insertion_is_checked_for_a_repeated_trigger` (`tests/persist_save.rs`);
   `several_items_of_one_insertion_take_one_position_each` now expects both landings. No production
   caller builds a several-item insertion into `matches` today; the fix closes the engine-level route.
2. **A list edit beside a variable insertion or removal was refused.** The nodes a kept sequence item
   may differ at (`touched` in `apply_edits`) held scalar rewrites and changed mappings only, so a kept
   `vars` item whose nested list the batch changed failed its digest (`SiblingChanged`). **Fix:**
   `touched` also holds every sequence an item edit of the batch changes; the kept item keeps its
   position check and the nested list keeps its own folded item expectation. The corrupted-candidate
   mirror (`candidate_through`) makes the same change. Regression
   `a_list_edit_beside_a_variable_insertion_or_removal_is_one_batch` (`tests/variable_lists.rs`): eight
   list edits (strings, records and a flow string inserted; a string, a record and a flow string
   removed; a dependency and a record rewritten), each beside a new variable and beside a removed one,
   planned and applied, each result holding both edits' bytes and nothing else.

**Open item noticed, not fixed:** the regression's byte check compares the prefix before the list edit
and the total length, not a full reconstruction of both edits; the per-edit exact-bytes tests in §2 are
the stronger evidence for each edit's bytes.

Gates after the fixes, output under `/private/tmp/4-5/fix/`: see the report. No frontend file changed,
so the npm gates were not re-run. **Rung: `1650 / 487 / 4086 / 214`** (two Rust tests added).
