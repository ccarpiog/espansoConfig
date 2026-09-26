# Phase 4-6 — Form-definition structural core

**Status:** implementation record for step 4-6 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 4, 6, 7, 8 and 15–19 of §3. Core-first: **no production UI caller** sends anything this step
adds (`matchEditor.ts` drafts `form_fields: []` and `form_intents: []`). The step was **not cut**.
No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Engine (`crates/espansoconfig-core/src/patch/edit.rs`)

A form definition is a mapping inside a mapping (`form_fields.<name>.<option>`), and a new verbose
form variable holds three mappings under its item (`params` → `fields` → `<name>` → options). Neither
fits Phase 4-4's `ItemValue`, whose one mapping level was fixed by its type.

- **`ItemValue::Mapping` now holds `ItemValue`s** (recursive), with `ItemValue::flat` for the old
  flat shape and `ItemValue::as_entry`. `EntryValue` stays non-recursive (ruling 6). **The type no
  longer bounds the depth**: what a draft can ask for is bounded by the closed draft types and
  re-read by the audit (§1.4), and the doc comment on `ItemValue` says so in the same sentence.
- One recursive renderer, **`value_lines`**, factored out of `item_lines`: a new item's fields, a
  nested mapping at any depth and a group's mapping-valued entry are spelled by the same code
  (block style, `{}` when empty, steps read off the document through `ItemSteps`).
- **`FieldInsertGroup` mapping-valued entries** — `of_mappings`, `with_mappings`, `mappings()`,
  and `keys()` listing them after the typed entries and before an item list. Rendered after the
  typed entries; carried by `PendingField`/`FieldExpectation::inserted_mappings`, counted and ordered
  by the fold like any inserted key, and verified by **`verify_item_value`** in `verify_field`.
- `verify_item_value` recurses: every mapping at every depth states its own style, entry count,
  decoded keys and order, down to `verify_entry_value` for every leaf. `check_nested_keys` applies
  the inserted-key rules at every depth. `mapping_plain_source_nodes` names exactly the requested
  plain-source value nodes at every depth, for items and for a group's mapping-valued entries
  (ruling 3's exemption stays as wide as the requested entries).

### 1.2 Draft types (`draft/form_definition.rs`, new; `draft/match_draft.rs`; `draft/new_variable.rs`)

- **`FormOwner`** — `Shorthand {}`, `Variable { variable }`, `NewVariable { insertion }`: which
  form an intent or a refusal is about, by position.
- **`NewFormField { name, options: FormOptions }`**, **`FormOptions`** (`type`, `default`,
  `multiline`, `values`, `trim_string_values` — written in that order — plus at most
  `MAX_EXTRA_OPTIONS` (16) extra author-named scalar or list options) and **`FormValues`**
  (`List(Vec<String>)` or `Text(String)`, ruling 18: the two representations stay distinct).
- **Ruling 4 for the last two typed settings:** `multiline` and `trim_string_values` are written as
  validated plain source (`is_plain_source`), never quoted; everything else is a logical string. This
  is the policy 4-3 §5 item 7 and 4-4 §5 item 5 asked for. `VariableSetting` gained `Multiline` and
  `TrimStringValues`.
- **`FormFieldIntent`** — `InsertField { after: Option<usize>, field }`, `RemoveField { index }`,
  `RemoveFields {}` — carried by **`MatchDraft::form_intents`** (shorthand) and
  **`VariableDraft::field_intents`** (verbose): one type, two carriers, never a conversion (ruling 17).
- **`FormFieldDraft`** gained `insert_options: FormOptions` and `values: Vec<FormValuesIntent>`
  (`InsertItems { at, items: ScalarItems }`, `RemoveItem { index }`); **`VariableDraft::fields`**
  carries it for a verbose form.
- **`NewVariableParams::Form`** gained `fields: Vec<NewFormField>` (serde default) and
  `NewVariable::form_with_fields`: a complete new verbose form is one description.
- **`DraftTarget`** gained `VariableFormField`, `VariableFormFieldOption`,
  `VariableFormFieldOptionItem`, `NewFormField { form, field }`, `NewFormFieldOption`,
  `NewFormOption` — positions only.

### 1.3 Planner (`draft/form_plan.rs`, new; `draft/plan.rs`)

`FormAt` resolves one form's definitions (`shorthand` or `verbose`, the latter refusing a variable
that is not a form: `VariableIsNotAForm`), and one set of functions plans both shapes:

- **Intent level** (`check_form_intents`): `RemoveFields` alone; one removal per definition and none
  of a drafted one; an explicit `after` naming a removed definition, one whose successor is removed,
  or one whose structure the draft changes, is `FormIntentsConflict` (the two replacements would
  share a byte). New names meet ruling 7 and repeat no existing decoded name (removed ones included)
  and no earlier new one; options meet `check_new_options` (plain source, bound, extra keys not a
  typed setting and not one of the five schema-known options — `NewKeyIsAFormOption`). A new
  variable's definitions meet the same rules in `check_new_variables_are_admissible`.
- **`plan_form`**: absent definitions → the whole entry is returned for the caller's group (a
  shorthand `form_fields:` becomes a mapping-valued entry of the match-level group in
  `plan_insertions`; a verbose `fields:` one of the `params` group in `plan_new_params`); a
  non-mapping is `FormFieldsHasAnUnsupportedShape`; a flow mapping (`{}` included) refuses
  insertion and removal (`FormFieldsIsAFlowMapping`) but allows `RemoveFields`; insertions landing
  after one definition are one `FieldInsertGroup::of_mappings` in intent order; a removal is one
  `FieldRemoval` of the definition, refused as `NestedRemovalWouldDiscardUnshownStructure` when the
  definition holds a mapping or a list holding a collection; removing every definition is
  `FormFieldsWouldBeEmpty`.
- **Per definition** (`plan_definition`): existing options through `plan_open_mapping`, as before
  (a flat-list option is now removable there too, not only in `params`); removing every option is
  `FormFieldWouldHaveNoOptions`; new options are one `FieldInsertGroup` after the last option that
  survives and is not a `values` list whose items change (`NoFormOptionInsertionAnchor`,
  `FormFieldOptionsAreNotABlockMapping`, duplicates by decoded key); `values` intents need a `values`
  (`FormValuesAbsent`) that is a list (`FormValuesIsNotAList` — text stays text), resolve to
  `ScalarItemInsert`/`RemoveItem` (a flow list stays flow), and are checked for contradictions
  (`FormValuesIntentsConflict`) and emptying (`FormValuesWouldBeEmpty`).
- `visible_entries` lists `form_fields` as a **non-anchorable** entry, as 4-4 did for `vars`, so a
  removal of it keeps the entry before it from anchoring an insertion at its first byte.
  `plan_new_params` treats a drafted verbose `fields` as non-anchorable and counts `RemoveFields`
  toward `ParamsWouldBeEmpty`. `check_no_index_is_drafted_twice` and
  `check_no_entry_drafts_two_shapes` cover the verbose definitions.

### 1.4 Audit (`draft/audit.rs`)

`check_closed_surface` admits, by named shape: a group of mapping-valued entries into
`<match>.form_fields` or `<match>.vars[i].params.fields` whose every entry is a definition
(`names_a_definition_insertion`, `is_a_definition`); a group of options into one definition
(`names_an_option_insertion`, `is_a_definition_option`: plain source only and always under
`multiline`/`trim_string_values`, never a typed setting as a string); the whole `form_fields:` as a
mapping-valued entry of the match's own group and the whole `fields:` in a `params` group
(`is_a_definition_map`); a new variable's `fields` only when its `type` is `form`; removals of
`<match>.form_fields`, of one definition in either shape and of one verbose option; scalar edits of a
verbose option and of one element of it; a scalar-item insertion into and an item removal from a
definition's `values`. `check_no_removal_contains_another_edit` now also counts an insertion into a
mapping the batch removes.

### 1.5 Errors, wire, contracts, i18n

- **Sixteen new `DraftError` variants (82 → 98):** `FormIntentsConflict`, `VariableIsNotAForm`,
  `FormFieldsIsAFlowMapping`, `FormFieldsHasAnUnsupportedShape`, `FormFieldsWouldBeEmpty`,
  `NoFormFieldInsertionAnchor`, `FormFieldOptionsAreNotABlockMapping`, `FormFieldWouldHaveNoOptions`,
  `NoFormOptionInsertionAnchor`, `NewFormOptionNotPlainSource`, `NewKeyIsAFormOption`,
  `NewFormFieldHasTooManyOptions`, `FormValuesAbsent`, `FormValuesIsNotAList`,
  `FormValuesWouldBeEmpty`, `FormValuesIntentsConflict`. Operands are `FormOwner`, indices, counts,
  `DraftTarget`, `ValueKind` and `VariableSetting` — the types force the no-text rule.
- `src/lib/ipc/types.ts`: the new types, `MatchDraft.form_intents`, `VariableDraft.fields` /
  `field_intents`, `FormFieldDraft.insert_options` / `values`, `NewVariableParams.Form.fields`, the
  six targets, two `VariableSetting` members, sixteen names and payloads. `matchEditor.ts`
  (`draftWith`) and three test fixtures send `form_intents: []`.
- `src-tauri/src/dictionary_contract.rs`: `draftError` 82 → 98; `FormOwner`, `FormValues`,
  `FormFieldIntent`, `FormValuesIntent` on `NOT_A_CODE` with reasons; the `VariableSetting` reason
  names the two new keys. `wire_contract.rs`: 82 → 98. `retained_state_contract.rs`: the inventory
  entry for `match_draft.rs`' "never removed" is deleted — the sentence it judged (a form field entry
  "is never removed") was false after this step and was rewritten.
- `src/lib/i18n/{en,es}.json`: **16 keys per language** (`{setting}`, `{limit}`); `draftCodes.test.ts`
  samples all sixteen (count 98); `describeDraftError`'s operand sentence names the new placeholders.
  **Eight existing sentences were generalized** (`newKeyIsEmpty`, `newKeyHasALineBreak`,
  `newKeyHasAControlCharacter`, `newKeyIsAMergeKey`, `newKeyDuplicatesAnEntry`,
  `newKeyDuplicatesAnInsertion`, `newKeyCannotBeCompared`, `newKeyIsATypedSetting`): their codes now
  have producers about form fields and options, and the old sentences said "parameter" only.
- Present-state sentences corrected: `draft/mod.rs` (the insertion list, the invariant, a new
  section), `draft/match_draft.rs` (module doc, `VariableDraft`, `FormFieldDraft`),
  `draft/author_key.rs` and `draft/error.rs` (`TYPED_SETTINGS`/`NewKeyIsATypedSetting`: the policies
  exist now), `draft/new_match.rs` (why creation writes no `form_fields`), `draft/new_variable.rs`,
  `draft/audit.rs` (module doc, surface list, the scalar table and the removable shapes),
  `draft/plan.rs` (`plan_match_edits`, `plan_insertions`, `visible_entries`, `plan_entry_value`),
  `patch/edit.rs` (`ItemValue`, `InsertItem`'s licence, `FieldInsertGroup`, `verify_item_value`).

## 2. How each acceptance clause is met

Tests in `crates/espansoconfig-core/tests/form_definitions.rs` (15) and the Phase 4-6 section of
`src/patch/edit/corrupted_candidate_tests.rs` (3). Exact-bytes assertions throughout.

| Acceptance | Evidence |
|---|---|
| One intention writes shorthand or verbose shape, never converting | `one_intention_writes_its_own_shape_and_never_converts` (the same `FormFieldIntent` into `form_fields` and into `params.fields`; neither gains the other shape); `a_form_without_definitions_gains_the_whole_entry_in_its_own_shape` (`form_fields:` on a match, `fields:` in `params`, `{}` for an option-less definition, a YAML 1.1 boolean key quoted) |
| A layout edit plus a field addition is one batch | `a_layout_edit_plus_a_field_addition_is_one_batch` (shorthand `form` + definition; verbose `params.layout` + definition; a layout edit alone creates or deletes no definition, ruling 15); `a_complete_new_verbose_form_is_one_description` (a new variable with layout and definitions, and as a whole `vars:` beside a layout edit) |
| Deleting a definition touches only its owned span | `deleting_a_definition_touches_only_its_owned_span` (first with its owned comment, middle, last with a literal-block `values`, verbose; beside an insertion); `removing_the_last_definition_is_refused_and_removing_all_is_explicit` |
| Scalar-list and multiline-string `values` (`form-layout-and-choice.yml:43-54`) keep their representation | `a_scalar_list_and_a_multiline_string_keep_their_representation` (on the committed corpus fixture: `prioridad`'s list gains, loses and rewrites items and stays a block list; `equipo`'s text is rewritten and stays a literal block; list intents on the text are `FormValuesIsNotAList`; options removed one at a time; the shorthand list of the same file); `a_new_definitions_values_text_is_a_literal_block_that_reads_back` |
| Unsupported subtrees refuse structured rewriting | `unsupported_subtrees_refuse_structured_rewriting` (flow `form_fields`, scalar `form_fields`, a definition and an option holding a mapping, options between braces, missing `values`, a non-form variable; a flat and a braced definition removable; a flow `values` stays flow) |
| New shapes carry their own verifiers | `a_new_definitions_honest_candidate_verifies`, `a_corrupted_definition_is_refused_by_its_own_verifier` (seven corruptions × three batches: ambiguous neighbour, wrong nested value, quoted setting, dedented option, wrong list item, flow definition, extra option), `a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_definition` |
| Refusals carry positions and codes, never text | forced by the types (§1.5); `new_definitions_are_refused_by_position_never_by_text` (`assert_no_text` over JSON, `Display`, `Debug`) |
| Coherence, surface, wire, hard shapes | `intents_that_contradict_each_other_are_refused_before_any_diffing`, `new_options_are_written_after_the_last_option_that_stays`, `the_closed_surface_admits_the_definition_shapes_and_nothing_near_them`, `form_drafts_cross_the_wire_as_closed_shapes`, `crlf_and_a_missing_final_newline_are_kept` |

**Failing-first evidence.** The brief forbade running git, so no pristine `git archive HEAD` copy was
built and nothing was run against the unchanged tree. What stands in for it:

- **Mutation runs of the new checks**, each restored afterwards (the tree holds no `MUTATION`
  marker): the mapping-valued entry's verifier skipped — `a_corrupted_definition_is_refused_by_its_own_verifier`
  fails, a wrong nested value verifying (`/private/tmp/4-6/mutation-1-mapping-verifier-skipped.txt`);
  `verify_item_value`'s recursion removed — the same test fails on the whole-`form_fields` batch
  (`/private/tmp/4-6/mutation-2-no-recursion.txt`); the audit's option rule made vacuous —
  `the_closed_surface_admits_the_definition_shapes_and_nothing_near_them` fails
  (`/private/tmp/4-6/mutation-3-audit-option-rule.txt`).
- **The old refusals, pinned by existing tests that failed on the new tree** before their
  expectations were moved (`/private/tmp/4-6/core-tests-1.txt` … `core-tests-3.txt`): a group into a
  shorthand definition's options, a removal of a definition, a removal of a verbose definition, and a
  `values` item insertion and removal were all `OutsideTheClosedSurface`.

**Existing tests whose expectation changed:** `the_closed_surface_admits_a_group_into_params_and_nothing_near_it`
(`tests/draft_params.rs`: its "form field's options" sample moved one segment deeper, since a group
into a definition is inside now); `the_closed_surface_guard_refuses_an_edit_that_names_a_whole_open_container`
(`tests/draft_plan.rs`: a definition and the whole `form_fields` are removable now, a scalar edit of
either still refused); `a_path_one_segment_deeper_than_the_surface_is_refused` (`tests/draft_plan.rs`:
`params.fields.<k>` is a verbose definition now, so `params.cmd.one` stands in, plus two paths one
past a verbose option); `a_list_edit_outside_the_two_lists_is_refused_by_the_audit`
(`tests/draft_sequence.rs`: `values` items are inside now; `default` items stand in). Mechanical:
`ItemValue::Mapping(vec![…EntryValue…])` became `ItemValue::flat(…)` in `tests/variable_intents.rs` and
`corrupted_candidate_tests.rs`. **The corrupted-candidate mirror** (`candidate_through`) lacked the
4-3 review fix's line of `apply_edits` (every changed mapping in `changed`); this step's batches were
the first there to need it, and it was added.

## 3. What is not guaranteed

- **`ItemValue` nesting is unbounded by its type.** A Rust caller can build any depth, and the
  renderer and verifier follow it; only the closed draft types and the audit bound what a draft
  produces. No engine refusal by depth exists (one would be a new `EditError` and dictionary entry).
- **A definition written `{}`** (what an option-less new definition becomes) is a flow mapping, so it
  takes no new option afterwards (`FormFieldOptionsAreNotABlockMapping`); it must be removed and
  re-added with options, or edited in the text.
- **Placement is "after a definition" or "at the end"** — no front placement (a group is anchored
  after an entry), and **no reorder** of definitions (no mapping-entry move primitive exists).
- **Kind and shape are the projection's**: `VariableIsNotAForm` reads `type`; a draft that also
  rewrites `type` is judged against the old kind (as in 4-5 §3). Nothing refuses a shorthand
  `form_fields` added to a match whose content is not `form`.
- **Removing a flat definition removes its unknown options with it**, as removing a variable or a
  record does; they were projected, so a screen can show them.
- **The removal rule reads projected shapes**: a definition is removable when every option is a
  scalar or a flat list; an alias or an elided value refuses it.
- **Whether espanso reads** `multiline: true` written verbatim, a quoted definition name, `{}` or a
  `values` text the same way as a hand-written file is R16/R30 territory and is not claimed.
- **TypeScript mirrors are hand-written**; the new input types are checked on the Rust side only
  (`form_drafts_cross_the_wire_as_closed_shapes`).

## 4. Gate and rung

All run serially, output under `/private/tmp/4-6/`: `cargo test --workspace -- --test-threads=1` 0
(1668 passed); `cargo clippy --workspace --all-targets -- -D warnings` 0; `cargo fmt --check` 0;
`npm run check` 0 (487 files, 0 errors, 0 warnings); `npm test` 0 (4086); `npm run build` 0 (214
modules); bundle oracle — server-only markers absent, client markers present (2);
`cargo tree -p espansoconfig-core | rg tauri` empty. **Rung:**
`1668 / 487 / 4086 / 214` against `1650 / 487 / 4086 / 214` — eighteen Rust tests added
(`form_definitions.rs` 15, `corrupted_candidate_tests.rs` 3). Vitest's count is unchanged:
`draftCodes.test.ts` gained sixteen samples inside existing cases. **Module count unchanged:** no new
`.ts` module or styled component.

## 5. Open items noticed, not fixed

1. **Removing the last entry of a file with no final newline leaves the line break before it**, so
   the file gains a final newline (seen while writing `crlf_and_a_missing_final_newline_are_kept`:
   inserting a definition at the end of such a file and removing it again ends in `\r\n`). This is
   `FieldRemoval`'s existing behaviour, not this step's; the test pins the removal of a definition
   that is not last instead.
2. **An `insert_params` key `fields` beside a verbose form's new `fields:`** reaches the audit
   (`InsertionKeyAlreadyPresent`) rather than a named planner refusal.
3. **`{}` definitions cannot take options** (§3); a later step may write an option-less definition
   differently or convert `{}` on an explicit request.
4. **No front placement and no reorder of definitions** (§3). The form editor (4-10) owes the answer
   of whether either is needed.
5. `code.draftError.targetDoesNotExist` still says the visual editor "adds nothing inside a snippet"
   (4-3 §5 item 1, 4-4 §5 item 4, 4-5 §5 item 2); less true again after this step.
6. **Replacement of existing bytes is still guarded by the ambiguity differential only** (4-4 §6,
   4-5 §5 item 5): a rewritten option value balanced by a removal elsewhere is not covered by the
   inserted-text property.
7. `rustdoc` still warns about links from public docs to private items in `audit.rs`/`plan.rs`/
   `edit.rs` (4-4 §5 item 8); this step's new links follow the pattern (not a gate).
8. Neither language's sentence for the sixteen new codes, nor the eight generalized ones, has been
   read on a window (4-13; the Phase 4 translation inventory, 4-24).

## 6. Review fixes

Review: [`../reviews/4-6.md`](../reviews/4-6.md) — Codex, `ship-with-fixes`, 0 blockers, 2 SHOULD-FIX.
Both regressions were written before either fix and failed on the unfixed tree
(`/private/tmp/4-6/fix/failing-first-plain-source.txt`,
`/private/tmp/4-6/fix/failing-first-nested-keys.txt`); both pass after it
(`/private/tmp/4-6/fix/after-*.txt`).

1. **Rewriting an existing `multiline` or `trim_string_values` changed its YAML type.** Existing
   options went through `plan_open_mapping` → `plan_scalar` → `ScalarEdit::new`, so `multiline: true`
   set to `false` was written `'false'`. **Fix** (`draft/form_plan.rs`, `plan_typed_settings`, called
   by `plan_definition` before `plan_open_mapping`): a `Set` of an existing scalar option whose
   decoded key is one of the two settings is validated as plain source first
   (`NewFormOptionNotPlainSource`, naming the option by position — the existing code and sentence,
   so no dictionary change), then compared and written by `plan_plain_source_scalar` (made
   `pub(super)` in `draft/plan.rs`) as a `ScalarEdit::plain_source`; a quoted `'true'` drafted as
   `true` is rewritten plain, and the same plain text derives nothing. The path is shared, so the
   shorthand shape — whose existing options were editable before this step and had the same flaw —
   is fixed too. Regression `an_existing_typed_form_setting_is_rewritten_as_plain_source`
   (`tests/form_definitions.rs`: verbose `trim_string_values` and `multiline` on the corpus fixture,
   shorthand rewrite, no-op, quoted-to-plain, refusal carrying no text).
2. **A mapping-valued group entry skipped the inserted-key rules.** `plan_insertion_group` checked
   `check_inserted_fields` for an item list only, so a direct engine caller could write a definition
   holding a duplicate, empty or line-breaking key. **Fix** (`patch/edit.rs`): every mapping-valued
   entry goes through `check_mapping_keys` (the slice form of `check_nested_keys`) at every depth
   before rendering; an empty mapping has no key and stays legal (`{}`). Regression
   `a_mapping_valued_group_entry_is_held_to_the_inserted_key_rules`
   (`src/patch/edit/corrupted_candidate_tests.rs`: duplicate, empty, LF and CR keys, a duplicate two
   levels deep inside a whole `form_fields:`, and `{}` still written).

**Open items noticed, not fixed:** a new *typed entry* of a group (`FieldInsertGroup::typed`) still
has only its duplicate check in the engine, not the empty/line-break rule — pre-existing, and every
planner caller checks its keys first; an existing `offset`/`trim`/`debug` of a variable's `params`
is still rewritten through `plan_scalar` as a logical string (4-4 wrote those plain only on creation),
the same flaw one kind over, outside this finding's files.

Gates after the fixes, output under `/private/tmp/4-6/fix/`: see the report. No frontend file
changed, so the npm gates were not re-run. **Rung: `1670 / 487 / 4086 / 214`** (two Rust tests added).
