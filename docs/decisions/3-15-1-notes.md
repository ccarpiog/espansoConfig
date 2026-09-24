# Phase 3-15-1 — Cross-layer preservation evidence

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-15" and its addendum of 2026-09-24 (the
3-15-1 / 3-15-2 cut). This piece owns the first four acceptance clauses of 3-15.
**Risk:** high. **Tests only**, plus this record. No feature, no behaviour change, no production
code path touched, no user-facing string, no window claim.

No window reading was performed or claimed.

---

## 1. What changed

Three new test modules, and one `#[cfg(test)] mod …;` line in each of three existing files to
declare them:

| File | Declared from | Tests |
|---|---|---|
| `src-tauri/src/commands/preservation_check.rs` (new) | `src-tauri/src/commands.rs`, beside `mod bulk_check;` | 15 |
| `crates/espansoconfig-core/src/patch/edit/corrupted_candidate_tests.rs` (new) | `crates/espansoconfig-core/src/patch/edit.rs` | 3 |
| `crates/espansoconfig-core/src/patch/edit/raw_item/corrupted_candidate_tests.rs` (new) | `crates/espansoconfig-core/src/patch/edit/raw_item.rs` | 3 |

- **`preservation_check.rs`** drives every Phase 3 writer through `WorkspaceSession`. Each Tauri
  command is a one-line wrapper over a session method. Its fixture, `DENSE_UNKNOWNS`, is an inline,
  hand-authored, neutral match file. It holds unknown entries at the top level before and after
  `matches`, inside a global variable, and inside every snippet (a plain scalar, a block scalar, a
  nested mapping, a block list). Beside them sit a block `triggers` list, a flow `search_terms` list
  and comments owned by the file and by an item. No corpus fixture was added or edited, so
  `tests/corpus_integrity.rs` and the corpus `.gitattributes` are untouched.
- **The two `corrupted_candidate_tests` modules** are children of the modules they test, so they can
  reach the private verifiers (`verify`, `verify_item_text`) without widening any visibility.

## 2. Phase 3's writers

The list comes from the code and the step notes. A *writer* here is a path that can change bytes on
disk. Phase 3 added three new writing commands and widened two existing ones:

| # | Writer | Step | Command (session method) | Core operation |
|---|---|---|---|---|
| W1 | Grouped insertion of absent fields | 3-1 | `save_match` (widened) | `DocumentEdit::InsertFields` |
| W2 | Key substitution / content switch | 3-1, 3-5-1 | `save_match` (widened) | `DocumentEdit::SubstituteKey` |
| W3 | Block scalar-list edits and shape switch | 3-2, 3-6-1 | `save_match` (widened) | `InsertScalarItems`, `RemoveItem`, `SwitchShape` |
| W4 | Flow scalar-list cardinality | 3-3 | `save_match` (widened) | `flow::plan_flow_insertion` / `plan_flow_removal` |
| W5 | Bounded wide creation | 3-4 | `create_match` (widened) | `NewMatch` → `InsertItem` |
| W6 | Local raw-item save | 3-7 | `save_match_item_text` (new) | `DocumentEdit::ReplaceItemText` |
| W7 | Per-file bulk coordinator | 3-10 | `apply_bulk_options` (new) | `plan_bulk_option_edits` + one `run_one_save` per file |
| W8 | Application sidecar store | 3-12 | `update_sidecar` (new; not a user-file writer) | `sidecar::update_with` → `sidecar/store.rs` |

Steps 3-5, 3-6, 3-8, 3-9, 3-11 and 3-13 added browser models and components over these commands, but
no new writer. The TypeScript wrappers' own success and refusal handling is cited in §3 where it
matters (W6, W7).

## 3. Clause 1 — every writer has a success case and a refusal case

**New** marks a test this phase added. Every other name already existed and is cited, not repeated.
Paths: `core/` = `crates/espansoconfig-core/tests/`, `cmd` = `src-tauri/src/commands.rs` (its
`tests` module), `pc` = `src-tauri/src/commands/preservation_check.rs`,
`bulk` = `src-tauri/src/commands/bulk_check.rs`, `side` = `src-tauri/src/sidecar/tests.rs`.

| Writer | Success | Refusal |
|---|---|---|
| W1 | `core/draft_compose.rs::one_save_adds_two_absent_options`, `::a_composed_batch_commits_through_the_save_transaction`; **new** `pc::a_grouped_insertion_conserves_unknown_bytes_and_coverage_through_save_match` | `core/draft_compose.rs::a_group_with_a_duplicate_key_is_refused`, `::the_engine_refuses_a_group_whose_anchor_is_gone`, `::two_insertion_edits_after_one_anchor_are_still_refused` (core only — see §7 item 1) |
| W2 | `core/draft_compose.rs::a_drafted_switch_commits_through_the_save_transaction`; `cmd::a_drafted_content_switch_renames_the_key_through_save_match`; **new** `pc::a_content_switch_conserves_unknown_bytes_and_coverage_through_save_match` | `core/draft_compose.rs::a_refused_substitution_writes_nothing`, `::a_drafted_switch_is_refused_by_the_substitution_rules`; **new** `pc::a_content_switch_from_an_absent_key_is_refused_through_save_match_and_writes_nothing` |
| W3 | `core/draft_sequence.rs::a_list_batch_commits_through_the_save_transaction`; `cmd::a_drafted_trigger_form_and_list_save_through_save_match`; **new** `pc::a_block_list_edit_conserves_unknown_bytes_and_coverage_through_save_match`, `pc::a_trigger_form_switch_conserves_unknown_bytes_and_coverage_through_save_match` | `core/draft_sequence.rs::removing_the_last_item_is_refused_and_removing_the_field_is_explicit`, `::a_list_edit_outside_the_two_lists_is_refused_by_the_audit`, `::the_engine_refuses_a_switch_it_does_not_reshape`; `cmd::a_draft_the_planner_refuses_crosses_as_draft_refused_and_writes_nothing`, `cmd::a_drafted_regex_that_does_not_compile_is_refused_and_writes_nothing`; **new** `pc::emptying_a_block_list_is_refused_through_save_match_and_writes_nothing` |
| W4 | `core/flow_list.rs::a_flow_list_batch_commits_through_the_save_transaction`; **new** `pc::a_flow_list_edit_conserves_unknown_bytes_and_coverage_through_save_match` | `core/flow_list.rs::removing_the_last_item_of_a_flow_list_is_refused`, `::ambiguous_trivia_is_refused_by_name`, `::shapes_outside_the_licence_keep_their_refusals`; **new** `pc::emptying_a_flow_list_is_refused_through_save_match_and_writes_nothing` |
| W5 | `core/new_match_creation.rs::every_trigger_and_content_alternative_creates_exactly_one_item`; `cmd::a_wide_creation_reaches_the_disk_in_crlf_and_without_a_final_newline`; **new** `pc::a_wide_creation_conserves_unknown_bytes_and_coverage_through_create_match` | `core/new_match_creation.rs::a_flow_match_list_is_refused`, `::a_repeated_key_is_refused_even_beside_a_list`; `cmd::a_wide_creation_meets_the_saves_own_findings`; **new** `pc::a_wide_creation_into_a_flow_match_list_is_refused_and_writes_nothing` |
| W6 | `core/persist_raw_item.rs::a_committed_raw_item_save_writes_exactly_the_range`; `cmd::a_raw_item_is_cut_in_rust_and_saved_in_place_naming_the_edited_match`; **new** `pc::an_explicit_raw_item_edit_conserves_everything_outside_its_range`; model: `src/lib/browser/rawSnippet.test.ts` "adopts the edited snippet’s new identity and rebases the draft on the text sent" | `core/persist_raw_item.rs::a_stale_base_revision_writes_nothing`, `::a_result_that_does_not_parse_is_a_patch_failure_and_writes_nothing`, `::a_holed_range_and_a_carriage_return_are_refused_by_the_save`; `cmd::a_stale_identity_is_refused_by_the_raw_item_read_and_save`, `cmd::raw_item_refusals_cross_with_the_cores_own_code`; model: `rawSnippet.test.ts` "keeps the draft on an engine refusal, and allows a corrected retry" |
| W7 | `core/draft_bulk.rs::several_snippets_and_absent_options_become_one_batch`; `bulk::several_matches_and_absent_options_share_one_save_per_file`; **new** `pc::a_bulk_run_conserves_unknown_bytes_and_coverage_through_apply_bulk_options` | `core/draft_bulk.rs::malformed_requests_and_selections_are_refused_by_name`, `::the_engine_refuses_plain_source_that_does_not_read_back`; `bulk::a_preflight_blocker_writes_nothing`, `bulk::a_suspicion_is_refused_per_file_until_that_candidate_is_consented_to`, `bulk::bulk_booleans_are_written_as_plain_source_and_an_ineligible_spelling_writes_nothing`, `bulk::there_is_no_force_flag_on_the_wire` |
| W8 | `side::every_write_stays_under_app_storage_and_no_espanso_file_changes`; **new** `pc::the_sidecar_writer_saves_under_app_storage_and_refuses_through_the_command_composition` | `side::a_future_schema_is_retained_and_never_rewritten`, `side::an_unreadable_sidecar_is_left_untouched_and_refuses_writes`, `side::an_unknown_document_is_refused_before_anything_is_read`, `side::no_storage_root_or_no_workspace_root_reads_and_writes_nothing`; **new** the same `pc::the_sidecar_writer_…` (no storage root → `NotWritable`, unlisted document → `UnknownDocument`, closed workspace → `NoWorkspaceOpen`) |

Every new `pc` refusal also asserts that the file is byte-identical and that no backup directory was
created, which means no transaction started.

## 4. Clause 2 — unknown bytes and coverage conserved outside explicit raw edits, through the command path

**All new**, in `pc`. Every success test in this section runs `assert_conserved` after its save. That
function checks four things:

1. **Exact disk bytes.** The file on disk must equal, byte for byte, an expected text the test builds
   **independently of the engine**. `replaced` takes the original and swaps in only the intended
   span. The test states that span as literal text, which must occur in the original exactly once
   (asserted). Every other byte must be the original's, **including the bytes inside the edited
   snippet** outside that span. The session's text must also equal the disk's.
2. **Unknown entries in the refreshed projection.** After `run_one_save`, the session projection is
   compared with the original as a sorted multiset of
   (owner, entry path, **key source bytes**, value source bytes, value kind, reason). The owner is
   the top level, a global variable, a snippet or a snippet's variable. The key's spelling is
   sliced from the text that view was projected from. A structured save must conserve **every**
   unknown entry, the edited snippet's own included. The explicit raw edit must conserve every entry
   outside its snippet.
3. **Coverage.** Every `MappingCoverage` record outside the edited snippets keeps its path and its
   modelled and unknown counts.
4. **Whole-document accounting**, re-derived rather than read off the view:
   `DocumentView::coverage_is_complete` and `DocumentView::unaccounted_keys` run against a **fresh
   `SyntaxIndex::parse` of the disk bytes**. The view must carry no `CoverageIsIncomplete` or
   `KeyNotAccountedFor` diagnostic.

| Writer | Test |
|---|---|
| W1 | `a_grouped_insertion_conserves_unknown_bytes_and_coverage_through_save_match` |
| W2 | `a_content_switch_conserves_unknown_bytes_and_coverage_through_save_match` |
| W3 | `a_block_list_edit_conserves_unknown_bytes_and_coverage_through_save_match`, `a_trigger_form_switch_conserves_unknown_bytes_and_coverage_through_save_match` |
| W4 | `a_flow_list_edit_conserves_unknown_bytes_and_coverage_through_save_match` |
| W5 | `a_wide_creation_conserves_unknown_bytes_and_coverage_through_create_match`: the expected text is the original with the new item inserted after the last snippet's final line, before the top-level unknown entry that follows the match list. |
| W6 (explicit raw) | `an_explicit_raw_item_edit_conserves_everything_outside_its_range`: it asserts that the Rust-cut range is exactly the snippet's lines, and that the disk is exactly the original with those lines replaced. It also asserts that the snippet's own unknown entry **did** change, so the exclusion is not what made the comparison pass. |
| W7 | `a_bulk_run_conserves_unknown_bytes_and_coverage_through_apply_bulk_options`: the expected text inserts the two option lines after the last line of snippet 0 and after the last line of snippet 2, and changes nothing else. |
| negative control | `the_conservation_comparison_sees_a_lost_moved_respelled_or_altered_unknown_entry`: it checks four changes. A dropped unknown entry changes both the multiset and the coverage signature. One altered byte inside an unknown value changes the multiset. A **key respelled** as `"unknown_scalar"` changes it, and the decoded keys are first asserted equal. An entry **moved byte for byte to another snippet** changes it, and the decoded key and value are first asserted equal. |
| negative control | `the_exact_bytes_check_sees_a_change_inside_the_edited_snippet`: after a real grouped insertion, the check rejects an expected text differing by one byte inside the edited snippet but outside the inserted span, and one with a key respelled inside that snippet. The previous hull check excluded that snippet and would have accepted both. |

Related existing evidence, cited rather than repeated:

- `core/patch_raw_item.rs::an_unknown_entry_inside_the_range_may_change_and_those_outside_survive`
  covers the same rule at the core layer.
- `core/patch_raw_item.rs::every_readable_item_of_the_corpus_round_trips_byte_for_byte` covers the
  synthetic corpus.
- `::every_readable_item_of_the_real_corpus_round_trips_byte_for_byte` covers the gitignored real
  corpus and **skips cleanly when that corpus is absent**. This phase adds no real-corpus test.

## 5. Clause 3 — stale, uncertain and partial bulk outcomes

Already fully discharged. Cited, nothing added:

| Outcome | Command layer (`bulk`) | Browser model (`src/lib/browser/bulkEdit.test.ts`) and inspector (`src/lib/components/BulkInspector.test.ts`) |
|---|---|---|
| Stale | `a_preflight_blocker_writes_nothing` (a stale base revision is blocked as `IdentityStaleRevision` and nothing is written), `consent_for_an_earlier_base_revision_is_refused`, `consent_from_one_file_replayed_on_another_is_refused` | "is stale when a file’s projection moved on, and blocks without re-resolving"; "is stale when a spelling read answered identityStaleRevision, handled rather than unwrapped"; "is stale when the file is no longer projected at all"; inspector "blocks a selection whose spelling read answered a stale identity" |
| Uncertain | `an_uncertain_write_stops_later_attempts` | "reports an uncertain write as uncertain, and the files after it as not attempted" |
| Partial | `an_injected_second_file_failure_keeps_the_first_files_success`, `a_conflict_under_the_lock_stops_the_run_and_keeps_earlier_commits`, `each_files_actual_backup_or_no_op_result_is_visible` | "keeps a committed file saved beside a later failure, and never calls it an error"; "never says nothing was written for a partial outcome, and says so for none written"; inspector "draws a partial outcome with execution outcomes and exclusions counted apart" |

## 6. Clause 4 — a deliberately corrupted candidate fails the oracle

**All new.** `apply_edits` never hands out a wrongly built candidate, so these modules build one on
purpose:

- `candidate_through` in `patch/edit/corrupted_candidate_tests.rs` plans a batch exactly as
  `apply_edits` does. It then lets the test rewrite the planned replacements, splices, lets the test
  corrupt the spliced candidate, and runs the same `verify` call.
- Its twin in `patch/edit/raw_item/corrupted_candidate_tests.rs` does the same for
  `apply_item_text` / `verify_item_text`.

| Test | What it shows |
|---|---|
| `patch::edit::corrupted_candidate_tests::the_mirror_builds_the_candidate_apply_edits_builds` | For eight Phase 3 batches, the honest run of the mirror equals `apply_edits`'s own candidate. This is the drift guard for the mirror. The batches are: grouped insertion, key substitution, block list insertion, block list removal, flow list insertion, flow list removal, shape switch, and a composed group + substitution. |
| `…::a_candidate_corrupted_outside_the_planned_spans_fails_the_oracle` | Four corruptions outside every span are applied to each of the eight batches, and every one is refused by the byte oracle (`BytesOutsideTheSpanChanged` / `LengthMismatch`). The corruptions are: one byte of the file comment, one byte of the closing comment, an appended byte, and a dropped byte. |
| `…::a_candidate_that_says_the_wrong_thing_inside_its_span_fails_the_oracle` | The planned replacement text is rewritten so that splice and replacement list agree, which the byte oracle cannot see. The planner's recorded claims refuse it: `FieldNotInserted` for the group, `ItemNotInserted` for the flow insertion. |
| `patch::edit::raw_item::corrupted_candidate_tests::the_raw_item_mirror_builds_the_candidate_apply_edits_builds` | The drift guard for the raw-item mirror. |
| `…::a_raw_item_candidate_corrupted_outside_its_range_fails_the_oracle` | A corrupted byte of the file comment, of the snippet above, of the snippet below, or an appended byte is refused by the byte oracle. |
| `…::a_raw_item_replacement_stretched_past_its_range_fails_the_oracle` | A replacement is stretched one line past the owned range and carries the next line byte for byte. It is refused as `SpanNotPermitted`. |

Pre-Phase-3 relatives, cited:
- `patch/edit.rs` `tests::verification_rejects_a_candidate_whose_untouched_bytes_moved`;
- the `tampered_removal` / `tampered_move` / `tampered_duplicate` suites in `patch/edit.rs`;
- `core/model_projection.rs::a_truncated_unknown_value_is_caught_by_the_oracle` and
  `::a_dropped_key_is_caught_by_the_coverage_oracle`, which cover the projection oracle.

## 7. Not guaranteed

These tests do not prove the following:

1. **W1's refusal is shown at the core layer only.** `MatchDraft` cannot express a duplicate key or a
   stale group anchor: the type prevents both. So no command-layer test drives a *group* refusal. The
   W1 row cites the core refusals.
2. **`update_sidecar` itself is not called.** It takes Tauri `State`, and no test in this tree builds
   one. The new test runs its exact two-call body, `WorkspaceSession::sidecar_files` followed by
   `SidecarSession::update`. A future edit that changed the command's body without changing those two
   calls would not be seen.
3. **"Rather than committing" is shown at the verifier, not at the transaction.** `save_document` has
   no seam through which a corrupted candidate could be handed to it. The only way a candidate reaches
   the disk under `SaveContent::Edits` is as the `PatchedDocument` that `apply_edits` returned after
   `verify` passed. That is how the code is built, not something these tests assert.
4. **The mirrors cover the kinds they list.** `candidate_through` copies `apply_edits`' planning loop
   and fold. The drift guard catches a divergence only for the batches it runs. A new edit kind, or a
   change to the fold, is not covered until a batch exercises it. A kind it does not mirror (move,
   duplicate, raw item) panics rather than passing.
5. **The conservation fixture is one file.** It has LF line endings, no BOM and no CRLF, and it holds
   no anchors, aliases, tags or multi-document streams. The byte comparison says nothing about those
   shapes through the command path. They are covered at the core layer by the corpus suites and by
   the existing CRLF/no-final-newline creation test,
   `cmd::a_wide_creation_reaches_the_disk_in_crlf_and_without_a_final_newline`.
6. **The coverage comparison is by path and counts.** It is not by key identity. A record that
   swapped one modelled key for another with the same counts would pass it. The exact disk-bytes
   check, the unknown-entry multiset (owner, key spelling, value bytes) and the fresh-parse
   accounting are what constrain that case.
7. **The expected bytes are the test author's statement.** Each expected text was written from the
   intended edit, and the save's output then matched it on the first run. The tests pin that exact
   output, so an engine change that respelled an inserted value (for example, `'true'` against
   `true`) would fail them even where the new spelling was equally correct. That strictness is
   intended.
8. **No window claim, and no claim about the browser models** beyond the named tests in §3 and §5.

## 8. Open items (noticed, not fixed here)

1. **A prose-sweep false positive.** `src-tauri/src/retained_state_contract.rs`'s sweep flagged the
   phrase "in one block" in a doc comment of the new module, as a restatement of the
   retained-state contract. The comment was reworded rather than added to the inventory. The sweep's
   phrase list may catch other ordinary YAML prose ("block" as in block style); a later phase may want
   to narrow it.
2. **An old doc comment's count.** The doc comment on `cmd::a_draft_the_planner_refuses_crosses_as_draft_refused_and_writes_nothing`
   still describes its refusal as "a cardinality change the four primitives cannot express". Since
   3-2 that is no longer the whole story: cardinality is expressible through `SequenceIntent`, and
   the refusal is about an index into an absent list. The test itself is correct; only the sentence
   is dated.

## 9. Review fix

The review (`docs/reviews/phase-3-15-1.md`) had one SHOULD-FIX, at `preservation_check.rs:148`. It
found that the clause-2 oracle kept decoded keys and value text but dropped key spelling and owner
paths, and that `assert_conserved` left the whole edited snippet out of the byte comparison. The
fix, in that file only:

- **Exact expected disk bytes replace the prefix/suffix hull.** Every structured save now compares
  the disk with `replaced(original, [(span, replacement)])`, built independently of the engine, so a
  byte changed inside the edited snippet outside the intended span fails. `owned_range` was removed.
  The raw edit's expected text uses the literal snippet lines, and the Rust-cut range is asserted
  equal to them.
- **Unknown entries are compared by owner and source bytes.** The signature is now
  (owner, entry path, key source bytes, value source bytes, kind, reason).
- **Negative controls, one per strengthened check.** The multiset control gained a key respelling
  and an ownership move, each shown invisible to decoded key and value first. A new test,
  `the_exact_bytes_check_sees_a_change_inside_the_edited_snippet`, covers an in-snippet byte change
  and an in-snippet key respelling.

§4 and §7 were rewritten to claim only this. Rust tests went from 1554 to 1555.

## 10. Verification

| Gate | Exit | Figure |
|---|---|---|
| `cargo build --workspace` | 0 | |
| `cargo test --workspace -- --test-threads=1` | 0 | 1555 passed, 0 failed (after the review fix) |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | |
| `cargo fmt --check` | 0 | |
| `npm run check` | 0 | 487 files, 0 errors, 0 warnings |
| `npm test` | 0 | 4064 tests |
| `npm run build` | 0 | 214 modules |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | nothing found |

**Rung: `1555 / 487 / 4064 / 214`**, against `1534 / 487 / 4064 / 214`. Rust has +21 tests: 15 in
`preservation_check.rs` and 6 in the two `corrupted_candidate_tests` modules. svelte-check files,
vitest tests and Vite modules are unchanged, because this phase touched no frontend file.
`git status --short --untracked-files=all` shows no real-config path.
