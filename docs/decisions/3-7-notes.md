# Phase 3-7 — The local raw-item core edit

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-7", §3 rulings 11 and 12, and the consult's Q4
(`docs/reviews/phase-3-design.md:110-134`). **Risk:** high. **Driven**, one worker, with no window
half (ruling 30).

No window reading was performed or claimed.

---

## 1. What the tree could not do before this phase

- The only way to edit a snippet as text was `save_raw_document`, a whole-document
  `SaveContent::ReplaceText` with **no locality claim**. Ruling 11 forbids presenting that as a
  snippet edit.
- No command handed out one snippet's own text. The frontend cannot cut it itself: a `ByteSpan` counts
  bytes and a JavaScript string index counts UTF-16 code units (`CLAUDE.md` §6).

## 2. What changed

### 2.1 The core (`crates/espansoconfig-core/src/patch/edit/raw_item.rs`, new; `patch/edit.rs`)

- **`ItemTextReplacement { item: DocumentPath, text }`** and **`DocumentEdit::ReplaceItemText`**.
  The request carries no offset. `apply_edits` refuses it beside any other edit
  (`EditError::ItemTextMustBeTheOnlyEditInItsBatch`, the move's and the duplicate's rule) and hands it
  to `raw_item::apply_item_text`. That function plans, splices and verifies, and returns the batch's
  `PatchedDocument`.
- **`item_owned_text(source, item) -> OwnedItemText { text, first_line, line_count }`** is the read.
  It shares **one** range derivation (`owned_range`) with the edit, so the two cannot disagree about
  which bytes a snippet owns.
- **`replace_item_text`** is a one-edit convenience over `apply_edits`, like `duplicate_item`.
- **`no_ambiguous_plain_scalar_is_introduced` gained an `authored` parameter.** It lists candidate
  subtrees whose bytes a person wrote as-is. Every existing caller passes `&[]`, so their behaviour is
  unchanged (§3.3).
- **`draft/audit.rs`:** `check_closed_surface` refuses `ReplaceItemText` in a draft batch, and the
  key-ambiguity check treats it as a positional edit.
- Six `EditError` variants and seven `VerificationFailure` variants (§3), each with a `Display` arm.

### 2.2 The command layer (`src-tauri/`)

- **`match_item_text(id)`**, a reader. It takes `WorkspaceSession::match_item_text`, which cuts the
  range out of the cached source with `item_owned_text`. A stale `MatchId` is refused by
  `match_by_id` as `identityStaleRevision`. Every range refusal crosses as the new
  **`CommandError::ItemTextRefused { error: EditError }`**, carrying the core's refusal whole, as
  `DraftRefused` does.
- **`save_match_item_text(id, baseRevision, text, acknowledgement)`**, the seventh writer. It takes
  `save_one_item_text`, which has `duplicate_one_match`'s identity discipline: `document_at` first, so
  a stale base revision is `identityStaleRevision`, then `match_by_id`. It builds exactly one
  `ItemTextReplacement` and ends in `run_one_save` with `SaveContent::Edits`. The conflict evidence is
  `ReapplyMode::anchored(…, ExactItem)`. `at` is the item's own path, so `moved` names the edited match
  in the new revision. An engine refusal crosses as `saveFailed` carrying `SaveError::Patch(EditError)`.
- `item_text_path` maps `item_address`'s move-named refusal to
  `ItemTextRefused { NotASequenceItem }`, so no move code leaks. It is unreachable through today's
  projection.
- Both commands are registered in `main.rs`, and the surface is now 18 workspace commands plus 1 menu
  command. The module docs whose counts the change invalidated were edited in place
  (`commands.rs`, `main.rs`, `dispatch_check.rs`).

### 2.3 Wire and i18n

- `src/lib/ipc/types.ts`: the new `EditErrorName` and `VerificationFailureName` members, their payload
  unions, and `interface OwnedItemText`.
- `src/lib/ipc/errors.ts`: the `itemTextRefused` code, `ItemTextRefusedError`, the operand table entry
  and an `identityRecovery` arm (`none`).
- `src/lib/ipc/commands.ts`: `matchItemText` and `saveMatchItemText`, and both names in
  `COMMAND_NAMES`.
- `en.json` and `es.json`: 14 new `code.*` keys each (1 `commandError`, 6 `editError`,
  7 `verificationFailure`). No sentence quotes snippet content.
- Contract tables updated: `wire_contract.rs` (samples, 226 variants, `(143, 12, 71)`, `OwnedItemText`
  in `save_transaction_structs`, the command-list test now at 18 and 19 with 7 writers),
  `dictionary_contract.rs` (namespace counts), `error.rs` (`every_command_error`),
  `retained_state_contract.rs` (two "in lockstep" judgements, false positives), `codes.test.ts`
  (`COMMAND_ERRORS` sample, count 22) and `commands.test.ts`.
- `CLAUDE.md` §6: the sentence "A raw save may write text the YAML parser rejects" was ambiguous now
  that there are two raw saves. It now names `save_raw_document`, and says the local save never
  writes such text.

## 3. The design

### 3.1 The range

The range is `carve_envelope` over `trivia.subtree_extent(item)`. That is the lift's derivation,
which a move, a removal and a true duplicate already share, taken **below** the refusals whose
premise is deletion (as the duplicate takes it). So no second notion of ownership exists.

- **Contiguity (ruling 11).** More than one run means the file owns a comment inside the hull, and the
  read and the edit both refuse with `EditError::ItemRangeNotContiguous { hole }`. A single run that
  still covers a file-owned comment is refused under the same name, because the carving arithmetic is
  not its own witness.
- **Carriage return (ruling 12).** The owned text is checked **on the read and on the edit**, and the
  submitted text is checked **on the edit**, all as `ItemTextHoldsCarriageReturn`. Only the snippet's
  own text is examined, so an LF-only item in a mixed-ending file is readable and editable. Nothing is
  normalized, re-indented or reconstructed.
- **The gate.** `editable_sequence_item`, the move's four checks in the move's order. It refuses a
  flow sequence of matches, and a hazard anywhere in the sequence (§5 item 1).

### 3.2 Planning refusals, before a byte moves

- `ItemTextLosesItsFinalLineBreak`: bytes follow the range and the text does not end in `\n`.
- `ItemTextEscapesItsIndentation { line }`: a content line (neither blank nor a comment) starts left
  of the item's dash column. This is the escaped-indentation refusal over the submitted text. Comment
  lines are left to the ownership check in verification.
- `ItemTextWouldExtendABlockScalar`: the **opening seam**. The column of the text's first non-blank
  line is checked against a block scalar ending directly above the range (`block_absorbing_a_line`,
  the move's own condition).
- `StructuralGuard::Removal { kind: CarriesTheItem }` pins the one run against the original node spans.
  It may touch no node outside the item except ancestors, and it must cover every token of the item.

### 3.3 Verification, on the reparsed candidate

1. The replacement lies inside the permitted range, and every byte outside it is identical
   (`bytes_outside_the_replacements_match`). This covers the BOM.
2. The range equals exactly the single run `entry_owned_runs` derives from the text without the
   envelope (`ItemTextRangeNotOwned`).
3. The candidate parses (`DoesNotParse`). Ruling 12 means a local result that does not parse is never
   saved and never gets the whole-document editor's acknowledgeable finding.
4. File-owned comments survive (`file_comments_survive`).
5. The sequence has the same item count (`ItemTextIsNotOneItem { expected, found }`, for zero items or
   two), and the slot holds a mapping (`ItemTextIsNotAMapping`).
6. No construct outside the item changed (`ConstructChangedOutsideTheItemText`). The two parses are
   walked in lockstep, and kinds, collection styles, decoded values and child counts must agree everywhere except the
   item's own slot. This is the "changed sibling" property, and it covers other matches and keys
   beside `matches`.
7. The **closing seam** and the escape:
   - The new item's own lines must not end past the written text, and its first owned run must not
     start above it (`ItemTextExtendsPastItsRange`). A block scalar at the end of the text that
     swallows the next line fails here.
   - Its owned runs must be exactly the written text (`ItemTextEscapesTheItem`). A trailing blank
     line, or a comment the file would own, fails here.
8. Every comment outside the range keeps its offset, its text, its file-or-node ownership, and which
   side of the item boundary its owner is on (reuses `CommentOwnershipChanged`).
9. The candidate's sequence raises no hazard (`ItemTextIntroducesAHazard`). An anchor written into the
   item could re-bind an alias elsewhere, and no value comparison of an alias node can see that.
10. No new YAML 1.1-ambiguous plain scalar appears **outside** the new item. Inside it the author's
    text is not charged, because the check exists to catch an emitter's choice and no emitter chose
    those bytes. The whole-document editor takes the same stance, but it is looser: everything outside
    the item is still charged here.

"An unknown entry inside may change" follows from the design: no field whitelist applies inside the
range (the consult's Q4). "Outside survive" is properties 1 and 6.

## 4. Acceptance clauses and the tests that pin them

| Clause | Test(s) |
|---|---|
| Zero items refused | `a_text_with_no_item_is_refused` (`tests/patch_raw_item.rs`) |
| Two items refused | `a_text_with_two_items_is_refused` |
| Escaped indentation refused | `a_line_left_of_the_dash_column_is_refused_before_planning`, `a_trailing_line_the_item_does_not_own_is_refused` |
| A changed sibling refused | `a_text_that_changes_a_construct_outside_the_item_is_refused`, `the_text_may_not_merge_with_the_next_line` |
| A result that does not parse refused | `a_text_that_does_not_parse_is_refused_by_verification`; `a_result_that_does_not_parse_is_a_patch_failure_and_writes_nothing` (`tests/persist_raw_item.rs`); `raw_item_refusals_cross_with_the_cores_own_code` (`commands.rs`) |
| An owned range with holes refused, and the whole-document editor can be offered | `a_range_with_a_file_owned_hole_is_refused_on_the_read_and_the_edit`; `a_holed_range_and_a_carriage_return_are_refused_by_the_save`; `raw_item_refusals_cross_with_the_cores_own_code` and `the_local_raw_item_pair_is_reachable_and_its_text_reaches_the_disk` (`itemTextRefused` carrying `ItemRangeNotContiguous`) |
| BOM and every byte outside preserved | `the_bom_and_every_byte_outside_the_range_survive`; every success in `tests/patch_raw_item.rs` goes through the independent `assert_only_the_range_changed`; `every_readable_item_of_the_corpus_round_trips_byte_for_byte` |
| Both block-scalar seams checked | `the_opening_seam_refuses_a_line_a_block_above_would_absorb`, `the_closing_seam_refuses_a_block_that_swallows_the_line_below` (over `move-block-scalar-seams.yml`, each with its safe twin) |
| A stale identity refused | `a_stale_base_revision_writes_nothing` (transaction); `a_stale_identity_is_refused_by_the_raw_item_read_and_save` (`commands.rs`); the stale-read assertion in `the_local_raw_item_pair_is_reachable_and_its_text_reaches_the_disk` (`dispatch_check.rs`) |
| An unknown entry inside may change, and those outside survive | `an_unknown_entry_inside_the_range_may_change_and_those_outside_survive`; `a_raw_item_is_cut_in_rust_and_saved_in_place_naming_the_edited_match` |
| `\r` refused (ruling 12), and only the snippet's own | `a_carriage_return_in_the_range_or_the_text_is_refused`, `a_carriage_return_elsewhere_does_not_refuse_an_lf_only_item` |
| Carried as `SaveContent::Edits` through `save_document` / `run_one_save` | `a_committed_raw_item_save_writes_exactly_the_range`, `the_semantic_gate_still_refuses_and_an_acknowledgement_still_commits`, `a_byte_identical_text_commits_nothing`; the command tests above |

Also added: `the_read_cuts_the_owned_range_with_its_leading_comments_and_terminator`,
`the_read_and_the_edit_refuse_what_the_move_gate_refuses`,
`a_replacement_writes_exactly_the_text_in_exactly_the_range`, `an_identical_text_changes_nothing`,
`the_edit_is_alone_in_its_batch`, `a_text_whose_item_is_not_a_mapping_is_refused`,
`a_hazard_written_into_the_item_is_refused`,
`an_ambiguous_plain_scalar_the_author_writes_is_not_charged`, and
`every_readable_item_of_the_real_corpus_round_trips_byte_for_byte` (it skips cleanly when the real
corpus is absent).

**The sweeps.** Over the synthetic corpus, 119 items are readable and 31 are refused by name. Each
readable item passes an identical-text round trip (the candidate equals the source) and a
prepended-comment mutation, which landed byte-exactly on all 119. Over the local real corpus, 13
files, 65 items are readable, 0 are refused, and all 65 mutations landed. Only counts are printed.

## 5. Open items

1. **The gate is the whole sequence's.** An anchor, alias, tag or merge key anywhere in `matches`
   refuses local raw editing of every item, as it refuses a move, a removal and a duplicate. A later
   phase could narrow it to hazards inside the item plus the re-binding check in property 9.
2. **A trailing blank line in the submitted text is refused** (`ItemTextEscapesTheItem`), because the
   ownership rules do not give it to the item. Nothing trims it. 3-8's wording has to explain it.
3. **Property 8 compares which side of the item boundary a comment's owner is on, not the owner
   itself.** A comment re-attributed between two nodes that are both outside the item, with every byte
   outside the range unchanged and every decoded value intact, would not be seen. No such case was
   constructed.
4. **The authored-subtree exemption from the ambiguity check (property 10)** is a stance this phase
   took from the consult's "inside-unknown edits allowed". A review may want it narrowed, for example
   to a disclosed note instead of silence.
5. **The conflict evidence (`ExactItem`) is computed but not yet read by anything.** 3-8 owns what a
   conflict does with a drafted range.
6. The `wire_contract.rs` command-list assertion used to say "nothing may add a seventh writing
   command", about restore. It now counts seven writers and forbids an eighth. The restore ruling
   itself is unchanged.
7. 3-6-3's candidate defect (a list-item draft never drew the external-change panel) is untouched. It
   is not this phase's scope.

## 6. Verification

Every command below was run by this worker and exited 0.

- `cargo build --workspace`
- `cargo test --workspace -- --test-threads=1 > /private/tmp/3-7-cargo.log 2>&1`: 33 `test result`
  lines, **1464 passed, 0 failed**.
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --check`
- `cargo tree -p espansoconfig-core | rg tauri`: found nothing.
- `npm run check`: 466 files, 0 errors, 0 warnings.
- `npm test`: 3693 passed, 76 files.
- `npm run build`: 201 modules. The server-only oracle is absent, and the client-only oracle is
  present (2).

**Rung: `1464 / 466 / 3693 / 201`**, against `1430 / 466 / 3692 / 201`.

- **Rust +34:** 24 in `patch_raw_item.rs`, 6 in `persist_raw_item.rs`, 3 in `commands.rs` and 1 in
  `dispatch_check.rs`.
- **Vitest +1:** the raw-item arguments case in `commands.test.ts`.
- **svelte-check files and Vite modules unchanged:** no new `.ts` module and no component. The
  wrappers live in the existing `commands.ts`, and nothing imports them yet.

## 7. The review and its fix

`autoclaude-review.sh` exited 0 — **Codex** wrote [`docs/reviews/phase-3-7.md`](../reviews/phase-3-7.md)
(brief `docs/reviews/phase-3-7.brief.md`): **`ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX.**

- **SHOULD-FIX — the enclosing sequence's collection style was not compared.** The lockstep walk outside
  the item compared kinds, child counts and scalar values only, so a one-item block sequence rewritten
  as ` [{trigger: ':one', replace: first}]` kept all three and was accepted while restyling `matches`
  into a flow sequence. **Fixed:** `compare_outside` in `raw_item.rs` now compares `collection_style`
  too; `a_text_that_turns_the_sequence_into_a_flow_sequence_is_refused` in `tests/patch_raw_item.rs`
  failed before the fix (the edit was accepted) and passes after it. The save path reaches the same
  verifier through `apply_edits`, so no separate `save_document` test was added.
- After the fix, by the orchestrator, each exit 0: `cargo test --workspace -- --test-threads=1 >
  /private/tmp/3-7-orch-cargo2.log 2>&1` (33 result lines, **1465 passed**, 0 failed); clippy
  `-D warnings`; `cargo fmt --check`. Final rung **`1465 / 466 / 3693 / 201`**.
