# Phase 4-3 — Nested presence and author-key foundation

**Status:** implementation record for step 4-3 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 4, 6, 7 and 8 of §3. Source consult: [`../reviews/phase-4-design.md`](../reviews/phase-4-design.md)
Q2. Core-first: **no production UI caller** sends anything this step adds. No window reading was
performed or claimed.

---

## 1. What changed and why

### 1.1 Presence and location metadata below the match mapping

An empty projected vector is no authority to insert a container or an entry: `vars: []`, an absent
`vars` and a `vars` holding a scalar all projected as no variables, and `depends_on`'s presence was
computed and discarded. The projection now carries a four-state presence (absent / empty / supported /
unsupported shape, each with a Rust-derived `FieldLocation`) for every container the step names.

- **`MappingPresence`** (`crates/espansoconfig-core/src/model/value.rs`) — the mapping twin of
  `SequencePresence`: `Absent {}`, `Empty { location }` (`{}`), `Entries { location, flow, count }`,
  `UnsupportedShape { location, found }`.
- **`FormFieldShape { options: MappingPresence, values: SequencePresence }`** — one per field
  definition, parallel to the definition mapping's projected entries.
- **`MatchView`** (`model/match_view.rs`): `vars_presence`, `form_fields_presence`,
  `form_field_shapes`.
- **`VariableView`** (`model/variable.rs`): `params_presence`, `depends_on_presence` (no longer
  discarded), `list_param_presence` (the kind's one list parameter: `choice` → `values`, `random` →
  `choices`, `script` → `args`, via the new `VariableKind::list_param_key`; `None` for other kinds),
  `fields_presence` (a verbose form's `params.fields`; `None` unless the kind is `form`) and
  `field_shapes`. The kind-dependent ones are filled after the variable's walk
  (`VariableView::describe_nested`), because `type` may follow `params` in the file.
- **Projector helpers** (`model/project.rs`): `location`, `sequence_presence`, `mapping_presence`,
  `first_entry`, `nested_sequence_presence`, `form_field_shapes` — pure readings of the index.
  `scalar_sequence_field` now uses `sequence_presence`, so `triggers`, `search_terms`, `imports`,
  `vars`, `depends_on` and the nested lists share one definition of the four states.

### 1.2 The one lift of D1: a new author-named `params` entry

- **`NewParam { key, value: NewParamValue }`** and **`NewParamValue::{Scalar, List}`**
  (`draft/match_draft.rs`), carried in the new **`VariableDraft::insert_params`** (serde default, so
  every existing wire message is unchanged). Values are **logical strings** spelled by the codec; a
  non-empty list is block style, an empty one `[]` (ruling 8).
- **`DraftTarget::NewParam { variable, insertion }`** — the only target that names something not yet in
  the file, and still a position.
- **Key rules** (`draft/author_key.rs`, new): `author_key_fault` refuses the empty key, a line break
  (`\n`, `\r`, NEL, U+2028, U+2029), any other control character (tab included) or U+FEFF, and `<<`
  (whatever the quoting). `TYPED_SETTINGS` (`offset`, `trim`, `debug`, `multiline`,
  `trim_string_values`) are refused as new keys, because ruling 4 gives them a plain-source policy in a
  later step and a logical string would reproduce A1 one level down.
- **Planner** (`draft/plan.rs`): intent-level `check_new_keys_are_admissible` (text rules, typed
  settings, duplicate among the draft's own insertions); in `plan_vars`, `check_params_keep_an_entry`
  and `plan_new_params`. `plan_new_params` refuses an absent, flow (`{}` included) or non-mapping
  `params` by name; refuses an existing key that is not a decoded scalar (`NewKeyCannotBeCompared`) or
  that decodes to the new key's text (`NewKeyDuplicatesAnEntry` — so `'alpha'`, `"alpha"` and `alpha`
  all refuse `alpha`, and an entry the same draft removes still counts); and writes one
  `FieldInsertGroup` after the last entry that survives the batch and whose successor also survives
  (otherwise the new run would begin where that removal begins), else `NoParamInsertionAnchor`.
- **Removal lifted in `params` only:** `plan_entry_value` now removes a `params` entry whose value is a
  flat list of scalars (`is_a_scalar_list`, `[]` included). A mapping, a list holding a collection, and
  every list under a shorthand form field's options stay refused as
  `NestedRemovalWouldDiscardUnshownStructure`. A draft that would remove every `params` entry and add
  none is refused as `ParamsWouldBeEmpty` rather than leaving `params:` holding a null (ruling 8) — this
  also applies to scalar entries, which could be removed down to nothing before this step.
- **Audit** (`draft/audit.rs`): `check_closed_surface` admits **one named shape more** —
  `names_a_params_insertion`: a `FieldInsertGroup` into exactly `<match>.vars[i].params`, every entry
  `EntryValue::Scalar` or `EntryValue::ScalarList` (never `PlainSource`), every key passing
  `author_key_fault` and not in `TYPED_SETTINGS`. A single `FieldInsert` there, any deeper path, the
  variable's own mapping, a form field's options and `params.fields` stay outside. The match-level
  anchor check now skips insertions into other mappings, and a new check 10,
  `check_every_nested_insertion_is_independent`, restates checks 4–7 against the `NestedKeys` given for
  the insertion's own mapping and adds `InsertionKeyAlreadyPresent` (a key the mapping holds, or one two
  insertions both write). An insertion into a mapping with no `NestedKeys` is refused
  (`InsertionAnchorNotInOriginal`).
- **Fourteen new `DraftError` variants** (44 → 58): `NewKeyIsEmpty`, `NewKeyHasALineBreak`,
  `NewKeyHasAControlCharacter`, `NewKeyIsAMergeKey`, `NewKeyDuplicatesAnEntry`,
  `NewKeyDuplicatesAnInsertion`, `NewKeyCannotBeCompared`, `ParamsAbsent`, `ParamsIsAFlowMapping`,
  `ParamsHasAnUnsupportedShape`, `ParamsWouldBeEmpty`, `NoParamInsertionAnchor`,
  `NewKeyIsATypedSetting`, `InsertionKeyAlreadyPresent`. Every operand is a `DraftTarget`, an index or
  a `ValueKind`.
- **Stale present-state sentences corrected** where they said the engine inserts nothing below the
  match mapping: `draft/mod.rs`, `draft/match_draft.rs` (module doc, `VariableDraft`),
  `draft/audit.rs`, `draft/error.rs` (`TargetDoesNotExist`, `VariableFieldHasNoScalar`,
  `NestedValueIsACollection`), `draft/plan.rs` (`plan_variable_scalar`), `draft/new_match.rs`, and
  `SequencePresence`'s list of users in `model/value.rs`.

### 1.3 Wire, contracts and i18n

- `src/lib/ipc/types.ts`: `MappingPresence`, `FormFieldShape`, the new `MatchView` and `VariableView`
  properties, `NewParamValue`, `NewParam`, `VariableDraft.insert_params`, `DraftTarget.NewParam`, the
  fourteen names in `DraftErrorName` and their payloads in `DraftError`.
- `src-tauri/src/wire_contract.rs`: a `FormFieldShape` interface sample; `mapping_presence_samples()`
  (one projected sample per state) in the tagged-operand check (18 → 22 checked payloads); the
  `DraftError` count 44 → 58.
- `src-tauri/src/dictionary_contract.rs`: `draftError` 44 → 58; `MappingPresence` and `NewParamValue`
  added to `NOT_A_CODE` with reasons (a value shape no screen draws yet; a protocol tag). The TS unions
  of both are all-object, so the exempted-union list is unchanged.
- `src/lib/i18n/{en,es}.json`: **14 keys per language**, `code.draftError.*`. The existing
  `describeDraftError` accessor and its reactive wrapper `tDraftError` cover them; no new accessor.
  `draftCodes.test.ts` samples every new variant (count 58).
- `src/lib/browser/fixtures.ts`: `fixturePresence` accepts any array; new `fixtureMappingPresence`
  and `fixtureFieldShape`; `makeVariable` and `makeMatch` fill the new properties.
  `src/lib/browser/workspace.svelte.ts`: `ownedMatchOf` copies the three new `MatchView` properties.

## 2. How each acceptance bullet is met

| Acceptance | Evidence |
|---|---|
| The four presence states differ on synthetic fixtures | `tests/nested_presence.rs`: `vars_has_four_states_that_an_empty_vector_cannot_tell_apart`, `form_fields_has_four_states_and_one_shape_per_definition`, `params_and_depends_on_have_four_states_each`, `a_kinds_list_parameter_has_four_states_and_other_kinds_have_none`, `verbose_form_fields_have_their_presence_and_one_shape_per_definition`, `a_presence_describes_the_first_of_a_repeated_key`; `wire_contract::mapping_presence_samples` |
| Unicode and punctuation keys round-trip | `tests/draft_params.rs`: `unicode_and_punctuation_keys_round_trip` (41 keys — precomposed and decomposed `é`, Cyrillic, CJK, an astral emoji, `a: b`, `#x`, `- x`, `[x]`, `{y}`, `yes`, `null`, `~`, numbers, quotes, leading/trailing spaces, `?`, `&`, `*`, `!`, `%`, `@`, `` ` ``, `|`, `>`, `---`, `...`, `<`, `<<<`), each asserted to be one zero-width insertion with every other byte unchanged, decoded back to the same text, and the match still editable |
| A duplicate key refuses, including an equivalently quoted spelling and a pending insertion | `a_duplicate_of_an_existing_key_refuses_however_either_is_quoted` (single-quoted, double-quoted, plain; an entry the draft removes), `a_duplicate_of_a_pending_insertion_refuses`; guard level: `nested_insertions_are_checked_for_independence_against_their_own_key_list`; engine level: `the_engine_refuses_an_equivalently_quoted_duplicate_on_its_own` |
| `<<`, an empty key, CR/LF and a one-level-too-deep path refuse | `a_key_whose_text_breaks_ruling_seven_refuses_by_position_and_code` (empty, `\n`, `\r`, `\r\n`, U+2028, tab, BEL, `<<`); `author_key::tests::every_fault_is_named_and_ordinary_text_passes`; `an_insertion_one_segment_deeper_than_params_is_refused` |
| Every refusal carries positions and codes, never the key text | Forced by the types for the new variants (no operand holds a string). Tested: `assert_no_key_text` (JSON, `Display` and `Debug`) in `a_duplicate_of_a_pending_insertion_refuses`, `a_key_whose_text_breaks_ruling_seven_refuses_by_position_and_code`, `every_refusal_about_a_new_key_carries_no_key_text` |
| The audit's closed surface is widened by named shapes only, and one segment deeper is refused | `names_a_params_insertion` is the one new shape; `the_closed_surface_admits_a_group_into_params_and_nothing_near_it` (plain source, a single `FieldInsert`, `<<`, empty, LF, tab, the variable's own mapping, a form field's options, `params.fields`); `an_insertion_one_segment_deeper_than_params_is_refused` (a group into `params.delta` and `params.gamma`, a removal below a `params` entry) |

Further behaviour tests in `tests/draft_params.rs`: `a_new_scalar_and_new_lists_are_written_after_the_last_entry`
(the exact bytes, block list, `[]`), `a_new_value_is_a_logical_string_never_plain_source`,
`a_params_that_is_absent_flow_or_not_a_mapping_refuses`,
`a_flat_scalar_list_entry_is_removed_and_a_list_of_records_is_not`,
`removing_the_last_entry_of_params_refuses_rather_than_writing_a_null`,
`an_insertion_beside_a_removal_is_written_after_an_entry_whose_successor_stays`,
`a_new_param_and_edits_elsewhere_save_as_one_batch` (a content edit, an item edit, an edited anchor
and two insertion groups in one batch, exact bytes), `a_new_param_after_an_edited_block_scalar_lands_after_it`,
`a_new_key_naming_a_typed_setting_refuses_rather_than_quoting_its_value`,
`a_new_param_crosses_the_wire_as_a_closed_shape` (unknown fields, a mapping value and a nested list
refused while the command's arguments are read).

**Existing test whose expectation changed:** `removing_an_open_entry_whose_value_was_never_displayed_is_refused_as_a_decision`
(`tests/draft_plan.rs`). Its second half removed a `values` list that is its variable's only parameter
and expected `NestedRemovalWouldDiscardUnshownStructure { found: Sequence }`. A flat scalar list is now
removable, so that draft meets `ParamsWouldBeEmpty { variable: 1 }` instead; the mapping half is
unchanged.

## 3. What is not guaranteed

- **The verifier for a nested insertion is the existing one.** `FieldInsertGroup`'s expectation
  (every entry decodes to its value, the candidate mapping's keys are the originals plus the group in
  order after the anchor) and the engine's outside-the-permitted-span check are path-agnostic, and this
  step relies on them at `<match>.vars[i].params`. No new verifier was written, because the value
  shapes are the two the group already verifies. The tests show exact bytes and round trips; no
  mutation of the engine was run to show that the verifier itself would catch a wrong nested rendering.
- **Presence is container presence.** `SequencePresence::Items` for a `choice` list counts `{label, id}`
  records as items; it says nothing about item shapes. `FormFieldShape` is parallel to the projected
  entries by construction (both walk `mapping_entries` of one node in order); no type forces the
  parallelism.
- **`list_param_presence` and `fields_presence` depend on the `type` text.** They classify by
  `VariableKind`, a string comparison; a variable with no or an unrecognised `type` gets `None`.
- **`TYPED_SETTINGS` is this project's reading of ruling 4**, compared by exact decoded text. It is not
  a schema espanso publishes; an unknown non-string parameter is still written as a quoted string if
  the author names it, because ruling 7 forbids inferring its type.
- **A key over 1024 characters** is not refused by name. YAML limits implicit keys; if the codec's
  spelling does not reparse, the engine refuses at verification, but no test drives that length.
- **Whether espanso reads a quoted key as the same key** is R16/R30 territory and is not claimed. The
  refusal of `<<` in every spelling is deliberate because of it.
- **TypeScript mirrors are hand-written.** `wire_contract.rs` checks the projection interfaces and the
  tagged payloads; `NewParam`, `NewParamValue` and `VariableDraft.insert_params` travel into Rust and
  are checked only by `a_new_param_crosses_the_wire_as_a_closed_shape` on the Rust side. The browser
  fixtures report `list_param_presence: null`, `fields_presence: null` and `field_shapes: []` for every
  variable; a test that needs those projects a document in Rust.

## 4. Gate and rung

All run serially, output under `/private/tmp/4-3/`: `cargo build --workspace` 0;
`cargo test --workspace -- --test-threads=1` 0; `cargo clippy --workspace --all-targets -- -D warnings`
0; `cargo fmt --check` 0; `npm run check` 0 (487 files, 0 errors, 0 warnings); `npm test` 0;
`npm run build` 0; bundle oracle — server-only markers absent, client markers present (2);
`cargo tree -p espansoconfig-core | rg tauri` empty.

**Rung:** `1593 / 487 / 4086 / 214` against `1567 / 487 / 4086 / 214` — twenty-six Rust tests added
(`nested_presence.rs` 6, `draft_params.rs` 19, the `author_key` unit test 1). Vitest's count is
unchanged: `draftCodes.test.ts` gained fourteen samples inside existing cases. **Module count
unchanged:** no new `.ts` module or styled component (the changes are to existing modules).

## 5. Open items noticed, not fixed

1. `code.draftError.targetDoesNotExist` (EN/ES) says the visual editor "adds nothing inside a snippet".
   True while no UI caller sends `insert_params`; the step that first draws a parameter insertion
   (4-9 onwards) must revisit it.
2. The match-level `check_every_anchor_survives` still counts a removal *anywhere below* `vars` as
   removing the match-level key `vars` (its `key_in` reads the first segment). Conservative, pre-existing,
   and left as is; the nested check added here is exact.
3. A draft whose every surviving `params` entry is directly followed by a removed one (for example
   `a`, `b` with `b` removed, plus an insertion) is refused as `NoParamInsertionAnchor`; saved as two
   saves it works. A later step may anchor such an insertion after the removed run instead.
4. `MappingPresence` has no dictionary namespace (`NOT_A_CODE`); the step that first draws one owes it
   one, as `SequencePresence` has.
5. Removal of a scalar list is lifted in `params` only; shorthand form-field option lists keep their
   refusal (4-6). `depends_on`, `random.choices`, `script.args` and `choice.values` item edits are 4-5's.
6. `global_vars` carries no new presence (display-only, ruling 9).
7. The ruling-4 settings keep no plain-source policy yet; `NewKeyIsATypedSetting` holds the line until
   4-4 … 4-6 give them one, and the step that does must lift or narrow that refusal.
8. Neither language's sentence for the fourteen new codes has been read on a window (4-13; the Phase 4
   translation inventory, 4-24).

## 6. Review findings and their resolution

Review: [`../reviews/4-3.md`](../reviews/4-3.md) — Codex, `ship-with-fixes`, 0 blockers, 2 SHOULD-FIX.
Both fixed; both regressions failed first on the unfixed tree (`/private/tmp/4-3/fix/failing-first*.txt`).

1. **Nested insertions did not compose with match-level structural edits.** A new `params` entry plus a
   new match field (`label`) planned, but the engine refused the batch at verification with
   `SiblingChanged { edit: 1, entry: 2 }`: the match-level claim digested its `vars` sibling, which the
   nested insertion legitimately changes. A nested field *removal* beside a match-level insertion met
   the same refusal. **Fix** (`crates/espansoconfig-core/src/patch/edit.rs`, `apply_edits`): every
   mapping a structural claim of the batch changes is added to the nodes an ancestor's kept entry may
   differ at, exactly as a scalar edit's node and an item-edited sequence already were. Only the
   ancestor's digest of that entry is dropped; its key and position are still compared, and the nested
   mapping's own folded expectation verifies its entries and order. The planner never gives the two
   insertions one offset (the match-level anchor is a visible entry and `vars` is not one), and the
   test asserts the offsets differ. Regression: `a_new_param_and_a_new_match_field_save_as_one_batch`
   (`tests/draft_params.rs`), exact bytes for both the insertion and the removal combinations. The fix
   is in `edit.rs` rather than `plan.rs` because the defect was the ancestor expectation, which the
   finding's own remedy names.
2. **An unsupported first occurrence of a container lost to a later one.** `params: scalar` followed by
   `params: {…}` left the first key unclaimed (`skip_shape` records it but does not claim it), so the
   second overwrote `params_presence` and the entries. **Fix** (`model/variable.rs`,
   `model/match_view.rs`): `first_container_seen_before` records every occurrence of `params`,
   `depends_on`, `vars` and `form_fields`, modelled or not, and `skip_repeated_container` records a
   later one as a `RepeatedKey` unknown entry with a `RepeatedKey` diagnostic. The nested presences
   (`params.fields`, a kind's list parameter, a form field's `values`) already read the first
   occurrence through `Projector::first_entry` and needed no change. `triggers` and `search_terms`
   (Phase 3-2) keep their handling and are listed as an open item below. Regression:
   `the_first_occurrence_of_a_container_governs_even_when_unsupported` (`tests/nested_presence.rs`).

Gates after the fix, output under `/private/tmp/4-3/fix/`: `cargo test --workspace -- --test-threads=1`
0; `cargo clippy --workspace --all-targets -- -D warnings` 0; `cargo fmt --check` 0. No TypeScript or
i18n file changed, so the npm gates were not re-run. **Rung: `1595 / 487 / 4086 / 214`** (two Rust
tests added).

Open item added: `triggers` and `search_terms` have the same unsupported-first pattern (a
`triggers: scalar` then `triggers: [...]` projects the second); it predates this step and was not
touched here.
