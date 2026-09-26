# Phase 4-4 — Local variable insertion, deletion and movement

**Status:** implementation record for step 4-4 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 4, 6, 7, 8 and 10 of §3. Core-first: **no production UI caller** sends anything this step adds
(`matchEditor.ts` drafts `var_intents: []`). The step was **not cut**. No window reading was performed or
claimed.

---

## 1. What changed and why

### 1.1 Engine (`crates/espansoconfig-core/src/patch/edit.rs`)

A new variable is a mapping item whose `params` is itself a mapping, which no engine type could spell:
`InsertItem` wrote flat items only, and `FieldInsertGroup` could not add a sequence of mappings. Ruling 6
keeps `EntryValue` non-recursive, so the new depth is a **separate** type, bounded by construction.

- **`ItemValue`** (exported, with the alias `ItemFields`): `Entry(EntryValue)` or
  `Mapping(Vec<(String, EntryValue)>)`. Nothing can hold an `ItemValue`, so a mapping inside a mapping has
  no spelling. A non-empty mapping is block style; an empty one would be `{}` (ruling 8; the planner never
  asks for one).
- **`InsertItem::nested`**: `InsertItem`'s fields are now `ItemValue`s (`typed` wraps `EntryValue`s, so
  every existing caller is unchanged). Rendering is `item_lines`/`entry_lines`, shared by both callers
  below; a nested mapping's step is the document's dominant **non-zero** step (`ItemSteps`), because a
  mapping's entries at their key's own column would be siblings.
- **`FieldInsertGroup::with_item_list`**: a group may end with **one** entry holding a new block sequence
  of new items — the whole `vars:` subtree. It is part of the group, not a second edit, because two
  insertions after one anchor state no order and a new `vars` beside a new match field is one intention.
  `FieldInsertGroup::keys` lists every key the group writes, the item list's last.
- **Own verifiers** (ruling 6: new shapes do not inherit a guarantee by reaching `verify_entry_value`):
  `verify_item_value` (mapping kind, block/flow style, exact entry count, decoded keys in order, each value
  through `verify_entry_value`) and `verify_inserted_items` (a block sequence of exactly the requested
  items, each through `verify_inserted_item`). `FieldExpectation`/`PendingField` gained `inserted_items`,
  counted and ordered like any inserted key.
- **Plain-source exemption kept exact:** `item_plain_source_nodes` names the requested `PlainSource`
  value nodes of one new item and of its nested mapping, positionally and by decoded key; a count that
  disagrees names nothing. `plain_source_nodes` applies it to a group's item list as well.
- `check_inserted_fields` applies its key rules inside a nested mapping too.

### 1.2 Draft types (`draft/new_variable.rs`, new; `draft/match_draft.rs`)

- **`NewVariable`** — `name` (logical string), `params: NewVariableParams`, `inject_vars` (plain source),
  `depends_on` (flat list; `Some([])` is `[]`), `extra_params: Vec<NewParam>` bounded by
  `NewVariable::MAX_EXTRA_PARAMS` (16). Nine bounded constructors: `date`, `choice`, `random`, `clipboard`,
  `echo`, `shell`, `script`, `form`, `match_reference`, plus `new` and three builders.
- **`NewVariableParams`** — one variant per kind, each naming exactly plan §3.4's parameters; required ones
  (`validate::required_param`) are plain fields. `type` is derived from the variant. `choice` is a string
  list only (records are 4-5's); `form` has `layout` only (`fields` are 4-6's).
- **Ruling 4:** `inject_vars`, `date.offset`, `shell.trim`/`script.trim` and `shell.debug`
  (**`VariableSetting`**, serialized as the espanso key) are written verbatim as plain source after
  `is_plain_source`; every other value is a logical string. This is the policy 4-3 §5 item 7 asked for,
  for these four; `NewKeyIsATypedSetting` still refuses all five typed settings as a new `params` entry of
  an existing variable or as an extra parameter, so the kind field is the only route.
- **`VarsIntent`** — `InsertVariable { at: ListPlacement, variable: Box<NewVariable> }` (constructor
  `VarsIntent::insert`), `RemoveVariable { index }`, `RemoveVars {}`; carried as **`MatchDraft::var_intents`**
  (serde default). A reorder is deliberately **not** an intent (§1.4).
- **`DraftTarget::NewVariable { insertion }`** and **`NewVariableParam { insertion, param }`** — positions
  in `var_intents` and in `extra_params`, never text.

### 1.3 Planner (`draft/plan.rs`)

- Steps 1–3 of `plan_match_edits` factored into `editable_match_path`, shared with the move planner.
- Intent level: `check_vars_intents_are_coherent` (`RemoveVars` alone and beside no `VariableDraft`; one
  removal per variable and none of a drafted one; no two insertions at one landing — so a match without
  `vars` takes one new variable per draft; no insertion landing on a removal's first byte) and
  `check_new_variables_are_admissible` (name empty / not one line / repeats an existing decoded name, even
  of a removed or renamed variable / repeats an earlier new one / cannot be compared; settings plain
  source; extras bounded, ruling-7 keys, no typed setting, no key the kind owns, no repeat).
- `plan_vars_intents`: an insertion into a block `vars` is one `InsertItem::nested`; into an absent `vars`
  the new variable becomes the match-level group's trailing item list (`Front`/`End` only; `After` names
  an item there is not); a removal is one `RemoveItem` on the projection's own path; `RemoveVars` is one
  `FieldRemoval` (nothing when absent). Flow `vars` (`[]` included) refuses insertion/removal
  (`VarsIsAFlowList`); a non-list `vars` refuses everything (`VarsHasAnUnsupportedShape`); removing every
  variable is `VarsWouldBeEmpty` (a new variable does not rescue it).
- `visible_entries` now lists `vars` (via its presence's key span) as **non-anchorable**, so removing it
  keeps the entry before it from anchoring an insertion at its first byte (the old comment's premise, "a
  draft cannot take `vars` away", stopped being true).

### 1.4 Reorder (R25, ruling 10)

**`plan_variable_move(view, variable, to: ListPlacement)`** returns exactly one `ItemMove` on
`<match>.vars[i]` (same sequence by construction, D2r), after the match gate, a block-`vars` check, index
checks and `VariableMoveChangesNothing`. **`check_variable_move`** (audit, public) accepts only such a
one-edit batch. Combining the move with anything is the engine's existing
`MoveMustBeTheOnlyEditInItsBatch`; this step tests it against every `DocumentEdit` category (§2). The
dedicated writer ending in `run_one_save` is 4-8's.

### 1.5 Audit (`draft/audit.rs`)

`check_closed_surface` admits three named `vars` shapes: an `InsertItem` into `<match>.vars` whose fields
pass **`is_a_new_variable`** (keys a subsequence of `name, type, depends_on, inject_vars, params` in that
order, `name`/`type` present, `type` one of the nine, `depends_on` a list, `inject_vars` plain source,
`params` a non-empty mapping with ruling-7 keys and plain source only — and always — under
`offset`/`trim`/`debug`); the same shape as a group's item list under `vars` on the match's own mapping;
and removal of `<match>.vars[i]` or of `<match>.vars`. Batch independence: an `InsertItem` inside a removed
`vars` is `RemovalContainsAnEdit`; an `InsertItem` landing on a `RemoveItem` is the new
`InsertionLandsOnARemoval`; group keys come from `FieldInsertGroup::keys`.

### 1.6 Errors, wire, contracts, i18n

- **Fifteen new `DraftError` variants (58 → 73):** `VarsIntentsConflict`, `VarsIsAFlowList`,
  `VarsHasAnUnsupportedShape`, `VarsWouldBeEmpty`, `NoVarsInsertionAnchor`, `NewVariableNameIsEmpty`,
  `NewVariableNameIsNotOneLine`, `NewVariableNameDuplicatesAVariable`,
  `NewVariableNameDuplicatesAnInsertion`, `NewVariableNameCannotBeCompared`,
  `NewVariableSettingNotPlainSource`, `NewVariableHasTooManyParams`, `NewKeyIsAKindParameter`,
  `InsertionLandsOnARemoval`, `VariableMoveChangesNothing`. Every operand is a `DraftTarget`, an index, a
  count, a `ValueKind` or a `VariableSetting` — none holds a string, so the types force the no-text rule.
- `src/lib/ipc/types.ts`: `VariableSetting`, `NewVariableParams`, `NewVariable`, `VarsIntent`,
  `MatchDraft.var_intents`, the two `DraftTarget` variants, the fifteen names and payloads.
  `matchEditor.ts` `draftWith` and three test fixtures send `var_intents: []`.
- `src-tauri/src/dictionary_contract.rs`: `draftError` 58 → 73; `VariableSetting`, `NewVariableParams`
  and `VarsIntent` on `NOT_A_CODE` with reasons; `VariableSetting` added to the exempted-union list.
  `src-tauri/src/wire_contract.rs`: the object-variant count 58 → 73.
- `src/lib/i18n/{en,es}.json`: **15 keys per language**, `code.draftError.*` (placeholders `{setting}`,
  `{limit}`); `draftCodes.test.ts` samples every new variant (count 73). No new accessor.
- Present-state sentences corrected: `draft/mod.rs` (module doc, invariant, a new section),
  `draft/match_draft.rs` (the insertion bullet), `draft/audit.rs` (module doc, surface list),
  `draft/error.rs` (`NewKeyIsATypedSetting`, the variant counts), `patch/edit.rs` (`InsertItem`'s licence,
  `render_item`), `draft/plan.rs` (`plan_insertions`, `visible_entries`).

## 2. How each acceptance bullet is met

Tests in `crates/espansoconfig-core/tests/variable_intents.rs` (27) and the Phase 4-4 section of
`src/patch/edit/corrupted_candidate_tests.rs` (3).

| Acceptance | Evidence |
|---|---|
| All nine kinds have bounded constructors | `all_nine_kinds_have_bounded_constructors_and_project_back_as_themselves` (each kind reparses as itself with exactly its own `params` keys, no `params:` for a parameterless one, bytes outside unchanged); `a_new_variable_is_written_as_its_exact_block_shape`; `typed_settings_are_plain_source_and_everything_else_is_a_logical_string`; `extra_parameters_are_bounded_and_keep_ruling_seven` (at and past the bound) |
| A new variable plus a content edit applies in one batch | `a_new_variable_plus_a_content_edit_applies_in_one_batch` — into an existing `vars` beside a rewritten `replace`, a new `label` and a renamed existing variable whose path the insertion shifts; and as a new `vars:` subtree in the same group as a new `label`, beside a `replace` edit (exact bytes) |
| Item-owned and file-owned comments obey the ownership rules | `an_insertion_at_the_front_leaves_the_first_variables_comment_with_it`, `an_insertion_after_a_middle_variable_lands_before_the_next_ones_comment`, `a_removed_variable_takes_its_own_comments_and_leaves_the_files`, `a_reorder_succeeds_alone_and_carries_the_variables_own_comments`, `removing_every_variable_is_refused_and_removing_vars_is_explicit` (the file comment survives a whole-`vars` removal), `the_chain_takes_an_insertion_a_removal_and_a_move_with_its_comments` (`variable-chain.yml`, read only) |
| Removing the final item: explicit empty list or container removal, never a null | `removing_every_variable_is_refused_and_removing_vars_is_explicit` (`VarsWouldBeEmpty`, a new variable does not rescue it; `RemoveVars` removes the entry and reprojects `Absent`; no-op when absent); `a_flow_or_empty_vars_is_refused_rather_than_converted` (`vars: []` removed explicitly) |
| A reorder succeeds alone and is refused beside every other edit category | `a_reorder_beside_every_other_edit_category_is_refused` — twelve batches (scalar edit, field insertion, group, key substitution, field removal, item insertion, item removal, scalar-item insertion, shape switch, duplicate, raw item text, a second move), the move first (`MoveMustBeTheOnlyEditInItsBatch { edit: 0, edits: 2 }`) and second (that error or the other edit's own batch rule), and beside a draft's own three-edit batch; `a_reorder_the_list_cannot_honour_is_refused_by_name` |
| Byte preservation, hard shapes | exact-bytes assertions throughout; `crlf_line_endings_are_copied_into_every_new_line` (insertion, subtree, removal), `a_file_with_no_final_newline_keeps_not_having_one`, `a_block_scalar_before_the_insertion_point_keeps_its_value` (clip and keep chomping), `a_multi_line_value_becomes_a_block_scalar_that_reads_back` |
| New shapes carry their own verifiers | `a_new_variables_honest_candidate_verifies`, `a_corrupted_nested_value_or_shape_is_refused_by_its_own_verifier` (an ambiguous neighbour, a wrong nested value, a dedented entry, a flow mapping, a quoted setting — each inside the span, each refused by verification, for both the item and the subtree), `a_corrupted_new_vars_sequence_is_refused` |
| Refusals carry positions and codes, never text | forced by the types (§1.6); `assert_no_text` (JSON, `Display`, `Debug`) in the name, setting and extra-parameter tests |
| Closed surface and wire | `the_closed_surface_admits_a_new_variable_and_nothing_near_it`, `an_insertion_landing_on_a_removal_is_caught_by_the_guard`, `vars_intents_cross_the_wire_as_closed_shapes` |

**Failing first** (`/private/tmp/4-4/failing-first.txt`, a throwaway probe on the unchanged tree, deleted
after the run): a `vars` item removal, a `vars` item insertion and a whole-`vars` removal were each
`OutsideTheClosedSurface`, and no variable-move planner existed.

**Existing tests whose expectation changed:** `the_closed_surface_guard_refuses_an_edit_that_names_a_whole_open_container`
(`tests/draft_plan.rs`) — a `FieldRemoval` of `<match>.vars` is now inside the surface (a scalar edit of it
is still refused, and now asserted); `a_list_edit_outside_the_two_lists_is_refused_by_the_audit`
(`tests/draft_sequence.rs`) — a `RemoveItem` of `<match>.vars[0]` left its "outside" list.

## 3. What is not guaranteed

- **`is_a_new_variable` is a shape check over the batch**, sharing the planner's vocabulary
  (`NEW_VARIABLE_KEYS`, `PLAIN_SOURCE_PARAMS`); it does not check that a plain-source setting belongs to the
  declared kind (`trim` on an `echo` passes the audit, though the planner never writes one).
- **Whole-variable removal** deletes the item's owned runs whatever the item holds — unknown entries, or a
  non-mapping item the projection shows as empty — exactly as deleting a snippet does. No projection-level
  check refuses it.
- **Name uniqueness** is against the pre-batch decoded names of the same `vars` and the draft's other new
  variables; `global_vars`, regex captures and synthesized names (ruling 20) are the UI's (4-9 onwards).
- **Whether espanso reads** a plain `trim: true`, a quoted key or a moved variable as intended is R16/R30
  territory and is not claimed. Authored order is preserved; no dependency advisory is produced (4-7).
- **TypeScript mirrors are hand-written**; the new input types are checked on the Rust side only
  (`vars_intents_cross_the_wire_as_closed_shapes`).

## 4. Gate and rung

All run serially, output under `/private/tmp/4-4/`: `cargo test --workspace -- --test-threads=1` 0;
`cargo clippy --workspace --all-targets -- -D warnings` 0; `cargo fmt --check` 0; `npm run check` 0
(487 files, 0 errors, 0 warnings); `npm test` 0; `npm run build` 0; bundle oracle — server-only markers
absent, client markers present (2); `cargo tree -p espansoconfig-core | rg tauri` empty.

**Rung:** `1625 / 487 / 4086 / 214` against `1595 / 487 / 4086 / 214` — thirty Rust tests added
(`variable_intents.rs` 27, `corrupted_candidate_tests.rs` 3). Vitest's count is unchanged:
`draftCodes.test.ts` gained fifteen samples inside existing cases. **Module count unchanged:** no new `.ts`
module or styled component.

## 5. Open items noticed, not fixed

1. **One new variable per landing.** `InsertItem` writes one item, so two new variables at one place —
   and two into a match without `vars` — are `VarsIntentsConflict`; saved as two saves they work. The
   engine's item list already takes several items; a multi-item `InsertItem` is a later step's.
2. **`NewVariableNameCannotBeCompared` is not driven by any test**: no parseable text was found that
   projects an existing name as undecoded.
3. **An engine-level overlap the planner does not pre-check:** a new variable at `End` beside an
   `insert_params` group into the last variable whose `params` is its last entry lands at the same offset
   and is refused by the engine as `OverlappingEdits` (typed, never written). Not tested.
4. `code.draftError.targetDoesNotExist` still says the visual editor "adds nothing inside a snippet"
   (4-3 §5 item 1); true of every screen today, owed a rewrite by the step that draws a variable insertion.
5. `multiline` and `trim_string_values` keep `NewKeyIsATypedSetting` with no plain-source route; they are
   form-field settings (4-6).
6. Kind lists (`values`, `choices`, `args`, `depends_on`) have no length bound; only the extra parameters
   are bounded.
7. After a whole-`vars` removal, a comment the blank-line rule gives to the file stays at its column
   between the match's remaining entries, as the ownership rules say; whether a screen should warn about it
   is a UI question.
8. `rustdoc` warns about links from public docs to private items in `audit.rs`/`plan.rs`, a pattern this
   step's new links follow (not a gate).
9. Neither language's sentence for the fifteen new codes has been read on a window (4-13; the Phase 4
   translation inventory, 4-24).

## 6. Review fix

Review: [`../reviews/4-4.md`](../reviews/4-4.md) — Codex, `ship-with-fixes`, 0 blockers, 1 SHOULD-FIX.

**A corrupted insertion could pass verification in a balanced batch.** The ambiguity property
(`no_ambiguous_plain_scalar_is_introduced`) is a whole-document differential, so a batch that removes a
pre-existing plain `trim: true` and inserts a logical string `true` that a defective renderer left
unquoted held as many ambiguous plain scalars as the original and passed. **Phase 4-3's `params`
insertion had the same blind spot** (a new `flag: 'true'` rendered plain beside the removal of the same
mapping's `trim: true`). Both regressions failed first on the unfixed tree, each corrupted candidate
verifying (`/private/tmp/4-4/fix/failing-first.txt`):
`a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_new_variable` and
`a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_new_param` (`src/patch/edit/corrupted_candidate_tests.rs`).

**Fix** (`crates/espansoconfig-core/src/patch/edit.rs`): `verify` also runs
`no_inserted_text_holds_an_ambiguous_plain_scalar`, a local property with no budget. Every zero-width
replacement is an insertion; its range in the candidate is derived from the sorted replacement list, and
every non-empty candidate scalar wholly inside it — keys, values, list elements, at any depth — must not be
an ambiguous plain scalar unless it is one of the requested plain-source value nodes (`plain_source_nodes`:
the eight match options and a new variable's typed settings). It covers every insertion kind, not only
variables. A move and a duplicate are skipped (they carry bytes rather than write them, and are alone in
their batch).

**Not covered, open item:** a replacement of existing bytes — a scalar edit, a key substitution, a shape
switch — is still guarded by the differential alone, so the same balancing could hide a corrupted rewrite
beside a removal.

Gates after the fix, output under `/private/tmp/4-4/fix/`: `cargo test --workspace -- --test-threads=1` 0
(1627 passed); `cargo clippy --workspace --all-targets -- -D warnings` 0; `cargo fmt --check` 0. No
frontend file changed, so the npm gates were not re-run. **Rung: `1627 / 487 / 4086 / 214`** (two Rust
tests added).
