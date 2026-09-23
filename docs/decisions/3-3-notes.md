# Phase 3-3 — Flow scalar-list cardinality

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-3", §3 rulings 5, 6 and 34, and the consult reply's
3-3 entry (`docs/reviews/phase-3-design.md:81`, `:417-425`). **Risk:** high. **Core-only**, with no
production UI caller.

3-3 lifts 3-2's refusal of flow lists: a scalar item is inserted into, or removed from, a
bracket-delimited list of scalars (`triggers: [":a", ":b"]`, `search_terms: [...]`, `imports: [...]`,
`[]`) between its brackets, **never converting presentation**.

No window reading was performed or claimed.

---

## 1. What the tree could not do before this phase

- **Flow lists were refused for item changes**, at both layers: the draft's `require_block_list`
  answered `SequenceIsAFlowList`, and the engine answered `FlowSequenceInsertionUnsupported` for an
  insertion and `FlowCollection` for a removal.
- **A comment anywhere inside a flow collection refuses the whole collection** (R6,
  `HazardKind::CommentInFlowCollection`), so the commented list at `flow-collections.yml:16-22` could
  not be edited by any path.
- **A flow collection opened by `[` or `{` followed by a space was read as block.** The substrate
  widens the start event of `[ a]` and reports `[ ]`'s as zero width; `SyntaxIndex::open_collection`
  required a one-byte event, so both became `CollectionStyle::Block` with a span that stopped short of
  `]`. Found by this phase's own test of `[ ':x' ,':y' ]` (§2.1).

## 2. What changed

### 2.1 The syntax layer (`syntax/index.rs`)

`open_collection` now reads a **sequence** as flow whenever its start event begins at `[` (a block
sequence opens at `-`, never at `[`), and a **mapping** as flow when a non-empty start event begins at
`{` (a block mapping whose first key is a flow mapping opens zero width at `{`, and keeps being
block). Pinned by `a_bracket_followed_by_spaces_still_opens_a_flow_collection` (`[ a]`, `[ ]`,
`[ 'x' ,'y' ]`, `{ a: 1}`, `{ }`, and the two block mappings with a flow first key). No committed
corpus fixture holds such a shape (`rg '\[ |\{ '` over `tests/corpus/synthetic/` finds nothing), and no
sweep moved.

### 2.2 The engine (`patch/edit/flow.rs`, new; `patch/edit.rs`)

- **Dispatch.** `apply_edits` routes a `RemoveItem` whose parent is a *flow scalar list* — a flow
  sequence, not inside another flow collection, every item a scalar — to `flow::plan_flow_removal`, and
  `plan_scalar_item_insertion` routes such a target to `flow::plan_flow_insertion`. Every other shape
  keeps its old refusal: `InsertItem` into any flow sequence, a flow sequence holding a collection, and
  one nested in a flow collection.
- **The narrowed gate.** `flow_list_hazard` is `TriviaIndex::disqualifying_hazard` minus exactly one
  hazard: `CommentInFlowCollection` raised **on this list**. A node-less hazard still refuses the
  document first; an anchor, alias, tag or any other hazard on the list, an ancestor or an item still
  refuses. The gate is unchanged for every other edit.
- **The placement rule** (`analyse`, `classify_gap`, `check_placements`). The list is taken apart into
  item tokens and `n + 1` gaps from the lexer's own trivia items, which must tile each gap. Accepted:
  a comment on `[`'s line before the first item (the list's; never touched); a comment on the line
  where an item ends, after its comma, while no other item shares that line (that item's). Everything
  else is refused by name (§3).
- **Two layouts.** A list whose every item starts its own line is edited **by lines**: a removal
  deletes the item's whole line (its comma and its comment with it), a new item is a new line copying
  the anchor's indentation and line break — above the first item for `Front`, directly under the
  anchor's line otherwise, and before `]` when `]` shares the last item's line. Any other list is
  edited **inline**: token plus one separator, copying the list's own first single-line separator
  (`, ` when there is none).
- **Which separator goes with a removed item.** With a surviving item after it, the separator after
  it; with none (the last item, or a run of removals reaching the end), the one before it, so a list
  keeps — or keeps lacking — its trailing comma. The planner reads the batch's other `RemoveItem`s of
  the same list (`removed_indices`), so adjacent removals abut instead of overlapping.
- **Empty lists.** `[]` and `[ ]` take items before `]`, joined by `, `, the padding mirrored
  (`[ 'one', 'two' ]`). An empty list whose brackets hold a line break or a comment is
  `FlowListLayoutUnsupported`.
- **New scalars** are `choose_scalar` in `ScalarContext::flow`, which never writes a plain or a block
  scalar there: every new token is single-quoted, or double-quoted with escapes when it holds a line
  break, so `,`, `[`, `]`, `{`, `}` and `#` cannot end it early and no YAML 1.1-ambiguous plain scalar is
  written. A token holding a line break would be refused rather than written.
- **Guards.** Two new `StructuralGuard` variants, checked against the original index before a byte
  moves: `FlowRemoval` (every run strictly inside the brackets, touching no node but the removed item
  and its ancestors, covering the item's token, and taking no comment unless it lies wholly inside the
  run on a line where a removed item's token ends) and `FlowInsertion` (the point inside the brackets,
  `]`'s own offset included, inside no token and no comment).
- **Verification.** The flow edits reuse `PendingItem`/`fold_item_expectations`/`verify_items`
  unchanged: every kept item keeps its subtree digest at its intended position, every new position holds
  a scalar decoding twice to the requested value, and bytes outside the replacements are compared.
  `ItemExpectation` gained `style`, read off the original sequence, and `verify_items` now fails
  **`VerificationFailure::SequenceStyleChanged`** when the reparsed sequence is not written in that
  style — for every item edit, block ones included, so "never converts presentation" is a verified
  property rather than a planner convention.

### 2.3 The draft (`draft/{plan,error,mod,sequence}.rs`)

`SequenceIntent::InsertItems` and `RemoveItem` call the new `require_list`, which admits a block list,
a flow list and `[]`. `require_block_list` stays for `TriggerSwitch::FromList`, which is now
`SequenceIsAFlowList`'s only producer. Docs on `SequenceIsAFlowList`, `SequenceIntent`, the module
and the planner's table say so.

### 2.4 The wire, the dictionaries and the contracts

Three new codes, each in both dictionaries: `code.editError.flowListTriviaAmbiguous`,
`code.editError.flowListLayoutUnsupported` and `code.verificationFailure.sequenceStyleChanged`, none
with a placeholder. `code.draftError.sequenceIsAFlowList` was reworded in both, because the sentence
("adding or removing its items is not available yet") stopped being true. `types.ts` carries the three
variants and their payloads; `dictionary_contract.rs` counts editError 44 and verificationFailure 33;
`wire_contract.rs` has the three samples, `EditError` 44, the save-transaction totals 213 and the
operand check (130, 12, 71). `codes.ts` needed nothing: its `editErrorKey` and
`verificationFailureKey` accessors derive the key from the variant name.

**Phase 3 translation-review inventory (ruling 29)** — added or changed ES sentences:

| Key | Change | Producer |
|---|---|---|
| `code.editError.flowListTriviaAmbiguous` | added | `analyse`, `classify_gap`, `check_placements`, `removal_runs`, `inline` in `patch/edit/flow.rs` |
| `code.editError.flowListLayoutUnsupported` | added | `analyse`, `classify_gap`, `check_placements`, `removal_runs`, `render_tokens`, `by_lines` |
| `code.verificationFailure.sequenceStyleChanged` | added | `verify_items` in `patch/edit.rs` |
| `code.draftError.sequenceIsAFlowList` | changed | `require_block_list` (via `plan_switch`) in `draft/plan.rs` |

## 3. Shapes accepted and refused

| Shape | Answer |
|---|---|
| Single-line list, any spacing, trailing comma or not | inline edit; spacing and trailing comma kept |
| One item per line, `]` on its own line or on the last item's | line edit |
| Wrapped list (several items on a line, several lines) | inline edit |
| `[]`, `[ ]` | insertion before `]`; removing the only item stays refused (3-2) |
| Comment on `[`'s line before the first item | kept, never moved |
| Comment after an item's comma, the item alone on its line | travels with the item |
| Comment on a line of its own inside the brackets | `FlowListTriviaAmbiguous` |
| Comment between an item and its comma (the comma off its item's line) | `FlowListTriviaAmbiguous`, at the comma |
| Comment trailing a line two items share | `FlowListTriviaAmbiguous` |
| Inline insertion after an item whose line carries its comment | `FlowListTriviaAmbiguous` |
| Removal of the item after a commented survivor, deleting from the survivor's end | `FlowListTriviaAmbiguous` |
| An item spanning lines; an empty list holding a break or a comment | `FlowListLayoutUnsupported` |
| A collection item, a list inside a flow collection, a mapping-item `InsertItem` | old refusals (`FlowSequenceInsertionUnsupported`, `FlowCollection`) |
| Any hazard but the list's own comments (anchor, alias, tag, …) | `Refused` |

The trivia rule is **global to the list**: one ambiguous comment refuses every cardinality edit of
that list, whether or not the edit would reach it.

## 4. Decisions

1. **The last item stays refused.** 3-2 refuses it (ruling 6: refusal or a deliberate key removal),
   and a flow list gets the same answer: `SequenceWouldBeEmpty` at the draft,
   `RemovalWouldEmptyTheSequence` at the engine. `RemoveField` stays the intent for "no list".
2. **The gate is narrowed for these two edits only**, not relaxed. R6's hazard still refuses every
   other edit of a commented flow collection, and the flow module refuses whatever its own rule cannot
   place. The **projection's** gate is untouched, so the draft layer still refuses the match that holds
   the fixture's commented list (§7 item 1).
3. **New items are always quoted** in flow context, because the emitter never writes a plain scalar
   there. `[greeting, saludo, "hola"]` gains `'hello'`, not `hello`. The consult's "preferring single
   quotes when quoting is required" is what the emitter does.
4. **The separator is copied, `, ` only when there is nothing to copy** (a one-item list, an empty
   list, a list whose every separator breaks a line or carries a comment). A line break is always
   copied, never chosen; LF is passed to the emitter only where no block scalar can result.
5. **The syntax fix is in scope** (§2.1): it is what makes `[ ]` and `[ a, b ]` flow lists at all. Left
   alone, a padded flow list was a *block* list to every layer, so 3-2's block path — not this phase's —
   would have been asked to edit it (it refused by accident, with `MalformedSpan`).
6. **The fixtures are inline** (`tests/flow_list.rs`), for 3-2's reason (`3-2-notes.md` §3.6).
   `flow-collections.yml` is **read** through `include_str!` and never written.

## 5. Acceptance, criterion by criterion

| Criterion | Evidence (`tests/flow_list.rs` unless named) |
|---|---|
| Insertion and removal at first, middle and last | `single_line_removals_at_every_position`, `single_line_insertions_at_every_position`, `the_fixtures_commented_list_loses_an_item_at_every_position`, `the_fixtures_commented_list_gains_an_item_at_every_position`, `unicode_items_are_retained_and_inserted_byte_exactly`, `mixed_quoting_survives_every_position` |
| Empty lists | `an_empty_list_takes_items_between_its_brackets`, `presence_stays_flow_and_an_empty_list_takes_a_draft_insertion`; last item: `removing_the_last_item_of_a_flow_list_is_refused` |
| The commented multi-line list, `flow-collections.yml:16-22` | the two `the_fixtures_commented_list_*` tests (engine, byte-exact, the comment kept with `":one"` or removed with it); `the_fixtures_other_lists_plan_through_the_draft` covers lines 5 and 13 through the draft and pins the draft-layer refusal of line 17's match |
| Trailing commas where YAML accepts them | `a_trailing_comma_is_kept` (single-line and one per line) |
| Unicode | `unicode_items_are_retained_and_inserted_byte_exactly`; `a_flow_list_batch_commits_through_the_save_transaction` |
| Mixed quoting | `mixed_quoting_survives_every_position`; the fixture's `search_terms` |
| Retained tokens and every outside byte identical | every success asserts the exact text **and** walks the bytes outside the reported replacements (`assert_outside_spans`); `flow_items` reparses and asserts the list still flow |
| Ambiguous trivia refused by name | `ambiguous_trivia_is_refused_by_name` (five shapes, each pointing at the culprit); `a_placeable_comment_stays_with_its_owner` for the accepted side |
| Flow-safe emission, YAML 1.1 rules | `new_items_are_spelled_safely_for_flow_context` (`a,b`, `[x]`, `{y}`, `a #z`, `yes`, `no`, `012`, `12:30`, quotes, a line break, `~`, empty) |
| Presentation never converted | `SequenceStyleChanged` in `verify_items`, unit-tested in `verification_rejects_a_list_item_or_a_list_value_that_is_not_the_one_asked_for` (`patch/edit.rs`); `the_engine_never_converts_a_flow_list` (`tests/draft_sequence.rs`) |
| Batches and position mapping | `adjacent_removals_abut`, `an_insertion_a_removal_and_an_edited_survivor_share_a_batch` (`item_positions` = `[None, Some(0), Some(3)]`) |
| Layouts and line endings | `a_list_keeps_its_own_spacing`, `a_closing_bracket_on_the_last_items_line_stays_there`, `new_lines_copy_the_line_ending_and_blank_lines_stay` (CRLF), `a_wrapped_list_is_edited_inline`, `a_flow_imports_list_is_edited_in_place` |
| Old refusals outside the licence | `shapes_outside_the_licence_keep_their_refusals` |
| Through `save_document` | `a_flow_list_batch_commits_through_the_save_transaction` |

## 6. Gates and the rung

Every gate was run on 2026-09-23 and exited 0: `cargo build --workspace`;
`cargo test --workspace -- --test-threads=1 > /private/tmp/3-3-cargo.log 2>&1` (29 `test result: ok`
lines, 1398 passed, 0 failed); `cargo clippy --workspace --all-targets -- -D warnings`;
`cargo fmt --check`; `npm run check` (461 files, 0 errors, 0 warnings); `npm test` (3548 passed, 72
files); `npm run build` (200 modules). The server-only oracle found nothing; the client-only oracle
found 2. `cargo tree -p espansoconfig-core | rg tauri` printed nothing.

| | 3-2 | 3-3 | Why |
|---|---|---|---|
| Rust tests passed | 1374 | **1398** | +23 in the new `tests/flow_list.rs`, +1 unit test in `syntax/index.rs`. Two `draft_sequence.rs` tests and one `patch/edit.rs` unit test were changed in place (§6.1). |
| svelte-check files | 461 | **461** | No `.ts`/`.svelte` file was added. |
| vitest tests | 3548 | **3548** | The new keys are covered by the existing parity and accessor suites. |
| Vite modules | 200 | **200** | No module was added. |

### 6.1 Tests changed rather than added

- `a_list_intent_the_list_cannot_honour_is_refused_by_name` (`tests/draft_sequence.rs`): its flow-list
  loop asserted `SequenceIsAFlowList` for an insertion, the refusal this phase lifts. It now asserts
  that the insertion plans, and that a `FromList` switch from the flow `triggers: []` is still
  `SequenceIsAFlowList`.
- `the_engine_never_converts_a_flow_list` (`tests/draft_sequence.rs`): it asserted
  `FlowSequenceInsertionUnsupported`; it now asserts the exact bracketed result.
- `verification_rejects_a_list_item_or_a_list_value_that_is_not_the_one_asked_for` (unit,
  `patch/edit.rs`): builds its `ItemExpectation` with `style`, and gains the flow-candidate case for
  `SequenceStyleChanged`.
- The doc comment at the top of `patch/edit/flow.rs` was reworded once so it does not contain the
  phrase `src-tauri/src/liveness_contract.rs`'s sweep treats as a liveness claim; no inventory entry was
  added.

## 7. Open items

1. **The draft layer still refuses a match whose list holds a comment.** The projection's
   `MatchView::safely_editable`/`blocking_hazard` is the match-wide gate, so the fixture's match at
   lines 17-23 answers `MatchNotEditable { CommentInFlowCollection }` for every intent, scalar edits of
   its `replace` included, although the engine can now edit that list. Narrowing the projection's gate
   changes what the UI treats as editable and moves the corpus sweeps' pinned gate outcomes; 3-6 (whose
   window half reads this very list) owns the decision.
2. **An inline `Front` insertion beside a rewritten first item** is `OverlappingEdits`: the insertion
   point is the first item's first byte, which the scalar edit's span also starts at, and the engine
   refuses two replacements that share a start. The draft's coherence check does not name it. `After`
   and `End` insertions land after the anchor's token and do not meet it.
3. **A mixed batch can give an odd but valid layout**: removing an inline item and the line-owning item
   after it (`[a,\n  b,\n  c\n]` removing `a` and `b`) leaves `[  c\n]`. Retained tokens and outside
   bytes are exact; the spacing is the join of what each removal leaves.
4. **The trivia rule is global to the list** (§3). A later step may make it local to the gaps an edit
   actually reaches.
5. **A flow mapping is still told from a block mapping by its start event's width** (§2.1), because a
   block mapping whose first key is a flow mapping opens zero width at `{`. `{ }` and `{ a: 1}` report a
   non-empty event and read as flow; a flow mapping reporting a zero-width event would still read as
   block. No such shape was found.
6. **No UI caller.** 3-6 owns the list editor, and with it whether the new refusals get their own
   presentation beyond the dictionary sentence.
7. **`removal_runs`' "strand the last item's comment" refusal is defensive**: under the placement rule
   a last item with its own comment that does not own its line cannot be removed alongside a survivor
   (it shares a line, which `check_placements` refuses first). It is kept rather than relied on.

## 8. Review findings and their resolutions

`docs/reviews/phase-3-3.md` (Codex): ship-with-fixes, no blocker, two SHOULD-FIX, both fixed in the
files named.

1. **A front insertion bypassed the comment-sharing refusal** (`patch/edit/flow.rs`, `inline`): an
   inline `Front` insertion into `l: [a, # of a\n b, c]` wrote `'x'` onto `a`'s commented line. Fixed by
   one check across every join, `check_comment_owners`, called by both planners after their
   replacements are derived: the edit's own replacements are spliced, the result reparsed, and every
   retained comment of the list must end up on a line whose items before it are exactly its owner under
   the placement rule (its own item, or none for the comment on `[`'s line). It also refuses a removal
   that pulls a commented item up onto another item's line (`l: [x, a,\n  b, # of b\n  c]` removing
   `a`). It sees one edit at a time; the rest of a batch is bounded by the guards and `verify`.
   Regression: `a_join_never_makes_a_retained_comment_shared`.
2. **Trailing trivia after `]` was read as part of the list.** The substrate's end event for a flow
   collection starts at the closing bracket but ends after the spaces and comment that follow it, and
   `SyntaxIndex::close_collection` kept that end, so `l: [a, b]  # note` had a span ending after
   `# note` and `analyse` found no `]` where the span ended. Fixed in **`syntax/index.rs`, not
   `flow.rs`**, because the span is wrong for every consumer, not only this one: `close_collection` cuts
   a flow collection's end marker back to the one bracket byte it starts at, so the span and the
   extent's `reported_end` end at `]` and the trivia after it stays outside the collection. Regression:
   `trivia_after_the_closing_bracket_stays_outside_the_list` (insert and remove on a list followed by a
   comment, and on one followed by spaces).

Gates after the fix, each exit 0: `cargo test --workspace -- --test-threads=1 >
/private/tmp/3-3-fix-cargo.log 2>&1` (29 result lines, 1400 passed, 0 failed; +2), `cargo clippy
--workspace --all-targets -- -D warnings`, `cargo fmt --check`. No sweep moved.
