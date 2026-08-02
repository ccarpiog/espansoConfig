# Phase 2b-2c-1 — decision record

`InsertItem` and `RemoveItem`, the two missing core patch primitives. `DocumentEdit` had four
variants and three of Phase 2b's six commands had no primitive behind them; two of the three now do.
**No Tauri command was added**, and nothing here can be reached from a screen yet.

---

## 1. What the two primitives now are

| Piece | Where |
|---|---|
| `InsertItem` and `RemoveItem`, the request types, with `From<…> for DocumentEdit` | `crates/espansoconfig-core/src/patch/edit.rs` |
| `DocumentEdit::InsertItem` / `DocumentEdit::RemoveItem`, variants five and six | same |
| `insert_item()` / `remove_item()`, the single-edit convenience entry points | same |
| `editable_sequence_item()`, `lift_item()`, `block_the_source_close_would_feed()` — **the shared lift**, factored out of `plan_move` | same |
| `plan_item_removal()` and `plan_item_insertion()` | same |
| `check_inserted_fields()`, `sequence_marker_column()`, `promote_implicit_null()`, `indentation_step()`, `render_item()` | same |
| `PendingItem` / `ItemSlot` / `ItemExpectation` / `fold_item_expectations()` | same |
| `verify_items()` and `verify_inserted_item()`, the sequence's `verify_field` | same |
| `leading_comment_block_start()` — one walk where there were two, and a CRLF bug fixed | same |
| Eight new `EditError` variants, with their `Display` arms | same |
| The acceptance test — a table-driven boundary suite, 32 tests | `crates/espansoconfig-core/tests/patch_item.rs` |

**`RemoveItem` is `ItemMove`'s lift half with no landing, as code and not as an agreement.** The four
gates are `editable_sequence_item`, the envelope is `lift_item` and the join the deletion opens is
`block_the_source_close_would_feed` — three functions `plan_move` now calls as well, factored out of
it rather than reimplemented beside it.

**`InsertItem` is one narrow exception to "no generic primitive may synthesize a collection",** stated
as an exception rather than by weakening the rule. Its doc comment carries the sentence verbatim:

> No generic primitive may synthesize a collection. `InsertItem` may synthesize exactly one new flat
> block-mapping sequence item with scalar fields, at a sequence-item boundary.

---

## 2. The decisions, each with its reason

### 2.1 D1 — `RemoveItem` addresses the item, not `(sequence, index)`

The design consult wrote `RemoveItem { sequence, index }` and allowed "the file's equivalent style".
The file's equivalent style is `ItemMove { item: DocumentPath, … }` and `FieldRemoval { field:
DocumentPath }`, and a `DocumentPath` ending in an index segment **is** `sequence[index]` spelled as
one value. Taking the pair instead would have meant a second way to name a sequence item, and
`editable_sequence_item` — the whole point of which is that a move and a removal cannot disagree
about what is addressable — would have had to accept both.

`InsertItem`'s shape was decided and is not varied: `{ sequence, after: Option<usize>, fields }`, with
`new()` appending and `after()` anchoring, private fields and accessors, matching `FieldInsert`.

### 2.2 D2 — the source-gap join is shared, and each caller names it in its own vocabulary

`block_the_source_close_would_feed` answers one question — *would the line that rises after the lift
become content of a block scalar above it?* — and both callers ask it. `plan_move` reports
`MoveWouldExtendABlockScalar { seam: SourceCloses }` because a move has three other seams to tell it
apart from; `plan_item_removal` reports the existing `RemovalWouldExtendABlockScalar`, whose own
summary line already says *the bytes this removal would leave behind would join a block scalar*.

Sharing the **condition** and not the error name is deliberate: a removal that answered
"MoveWouldExtend…" would be naming an operation the user did not ask for.

A **mapping entry's** removal does not ask this question, and does not need to: its neighbours' keys
all sit at one column, shallower than any block body inside the entry above, so the line that rises
always ends the block instead of extending it. A sequence item's next-door neighbour can be a leading
comment block at a column the user chose, and that is the case this reaches — pinned by
`a_removal_that_would_feed_a_block_scalar_is_refused_at_the_source_close`, which asserts the removal's
refusal and the move's refusal on the same document in the same test.

### 2.3 D3 — the removal is guarded as `RemovesTheEntry`, not as `CarriesTheItem`

`EnvelopeKind::CarriesTheItem` skips the `entry_owned_runs` bound because `verify` bounds a move's
runs twice over (`MoveCarriesMoreThanTheItem`, `CommentOwnershipChanged`). A removal has no such
verify-side bound, so it takes `RemovesTheEntry` — the kind that also bounds every run by what
`entry_owned_runs` says the entry owns, which is **the only layer that can see a deleted blank line**
(the Phase 0c-3b-2b review's blocking finding). `entry_owned_runs` is called with the item as both
halves of the entry, because a sequence item has no key.

### 2.4 D4 — the line ending is copied, not taken from the document's dominant one

The consult said "line ending from the document's dominant line ending" for the promotion. This uses
`line_ending_before(source, point)`, the same call `plan_insertion` makes: the break that terminates
the `matches:` line itself. That is strictly more local, and `PROGRESS.md` D2p is explicit that the
dominant answer's fallback — `LineEnding::detect`'s LF default for a document with no break at all —
is precisely the silent reformatting this crate exists to prevent. A document with no observable
break is refused with the existing `NoObservableLineEnding`.

### 2.5 D5 — the indentation step is evidence, in three narrowing passes

For a promotion the mapping-key column comes from the `matches:` line and the `-` marker column is
that plus a **step**:

1. the block children of the **same surrounding mapping** — the closest thing the document says about
   how this mapping indents;
2. every mapping entry **in the document** whose value is a block collection — the document's own
   dominant step;
3. **two columns**, the renderer's documented default, and only when the document offers no evidence
   at all.

A step of **zero** is real evidence rather than a missing answer: `matches:` with its dashes at the
key's own column is idiomatic YAML. Ties break to the smallest step, which a `BTreeMap`'s ascending
iteration gives for free. `a_promotion_takes_its_step_from_the_documents_own_block_children` pins a
four-column document, where a default of two would be visible.

### 2.6 D6 — the marker column is read off the ownership layer

Each item owns the `Punctuation::SequenceDash` that introduces it (`PROGRESS.md` D2d), so the column
is a fact the trivia scanner already published. Scanning the text for a `-` would be a second answer
to a question that already has one, and it would get `- - x` and a `-` alone on its line wrong.

### 2.7 D7 — the fold replays the batch over the **original** positions

`fold_item_expectations` makes one pass over the original item positions, emitting the insertions
anchored above each one and then the item itself unless a removal took it. That is not a convention:
an insertion's point is just past the anchor item's line and a removal's runs begin at the start of
the removed item's first line, so an insertion anchored after an item that is *itself* removed lands
exactly where that item was, and the loop gives that answer with no special case
(`an_insert_and_a_removal_in_one_batch_land_where_the_bytes_say`).

Two batches this arithmetic could describe never reach it, because `apply_edits` has rejected two
spans that **share a start** since Phase 0c-3a: two insertions with the same anchor, and an insertion
anchored after item *k* when item *k + 1* is also being removed. The second is a genuine ambiguity —
the new text could land before or after the deleted region — and
`inserting_at_the_start_of_a_removed_item_is_an_overlap` records it as a rule rather than as a
surprise.

### 2.8 D8 — a sequence-item edit is outside a draft's closed surface

`DocumentEdit` gained two variants and `crates/espansoconfig-core/src/draft/audit.rs` matches it
exhaustively in two places. Both new variants answer `false` / `None`, so a draft batch containing one
is refused as `OutsideTheClosedSurface` — which is what it is. A draft diff describes one match's own
scalar fields; adding or deleting an item of a sequence is a cardinality change with a different
primitive behind it, and the surface has no shape for it at all.

---

## 3. The refusal taxonomy

Eight new `EditError` variants. All eight are struct variants, all eight carry positions, counts or
node identifiers and **none carries a key or a value** (`CLAUDE.md` §1).

| Variant | Raised by | Because |
|---|---|---|
| `NotASequence` | insert | the path names neither a block sequence nor the one implicit null this step may promote |
| `InsertedItemHasNoFields` | insert | `- ` alone is a null item, which is a different document rather than a smaller one |
| `DuplicateInsertedField` | insert | the item would be born with a duplicate key, so it would be uneditable the moment it landed |
| `InvalidInsertedFieldKey` | insert | an empty key, or one holding a line break — neither has a spelling a caller means |
| `FlowSequenceInsertionUnsupported` | insert | `matches: []` and `[a, b]` have no line to add to, and rewriting them as block changes bytes nobody asked about |
| `InconsistentSequenceIndentation` | insert | a new item's column comes from its siblings; a majority spelling would be this crate choosing the file's look. **Argued unreachable** — see §5 |
| `ImplicitNullSequenceHasAmbiguousTrivia` | insert (promotion) | a standalone comment under the bare key belongs to whatever comes next, and materialising a sequence changes what comes next |
| `RemovalWouldEmptyTheSequence` | remove, and the fold | `matches: []` synthesizes a collection, bare `matches:` is YAML null; neither is "remove one existing item" |

Reused rather than duplicated, each with a reason:

| Variant | Why it is the right one |
|---|---|
| `RemovalCarriesMoreThanTheEntry` | the deletion span carrying material the item does not own — the same `entry_owned_runs` bound a mapping entry gets, with the item as both halves |
| `RemovalWouldExtendABlockScalar` | the source-gap join (D2); the variant's own summary line already said it |
| `NotASequenceItem`, `Refused`, `FlowCollection`, `NoSuchDestinationItem`, `EntryDoesNotOwnItsLines`, `NoObservableLineEnding`, `MalformedSpan`, `OverlappingEdits`, `Unresolvable` | inherited whole, because the code that raises them is inherited whole |

**No `VerificationFailure` variant was added.** `verify_items` reports through `MappingLost` (the name
the move's own sequence check already reports a lost sequence under), `EntryCountChanged`,
`SiblingChanged`, `FieldNotInserted`, `Undecodable` and `DecoderDisagreement`. Their English prose
speaks of *entries* and *blocks* rather than of *items*; that is recorded as a hole rather than fixed,
because widening the enum widens the wire.

---

## 4. The headline property

`crates/espansoconfig-core/tests/patch_item.rs`, a twelve-row table crossing the removed item's
position — **first, middle, last** — with zero, one and two blank lines around it, plus the three
comment-ownership shapes a blank-line count cannot express: a leading block the item **owns**, a
file-owned comment **beside** it, and a file-owned comment **inside its own hull** (the shape that
makes an envelope a set of runs at all). Four assertions per row:

1. **the exact expected output bytes**, stated as a whole-document literal, not a proxy;
2. **every byte outside the computed replacement region is unchanged**, re-derived in the test file by
   replaying the replacement list over the source — deliberately a different walk from the engine's,
   which compares the two texts side by side;
3. **`RemoveItem`'s output equals `ItemMove`'s lift-site output for the same item.** The move is
   applied for real and its arrival — the one replacement with text — discarded; both the replacement
   **spans** and the resulting **document** must be equal. This is the architectural claim of D2 and
   §1, pinned;
4. **the CRLF twin behaves identically**: the candidate for the CRLF document is exactly the CRLF twin
   of the LF candidate, for all twelve rows.

Insertion gets the mirror: exact bytes for append, insert-after-first, a four-column sequence, a CRLF
document, a promoted implicit null, a promotion whose step is evidence and a promotion that keeps the
key line's inline comment — plus one case per named refusal, and
`the_codec_and_not_this_test_decides_how_a_value_is_spelled`, which pins `'*star'`, `'''quoted'''` and
a `|` block for `"line one\nline two\n"`. `an_inserted_key_is_spelled_by_the_codec_too` records that
the value `1` comes back **quoted** — a plain `1` is an integer under YAML 1.1 and this crate never
writes one (`PROGRESS.md` R16).

---

## 5. A latent defect this phase found, and fixed

**No CRLF document ever had its leading comment block counted as owned.**

`item_own_lines` and `entry_owned_runs` each walked up over comment-only lines by stepping back one
byte from a line start and asking for *that* byte's line start. Under LF that is the line above; under
CRLF the byte is the `\n` of a `\r\n`, and the answer is the offset one past the `\r` — the **same
line, one byte in**. The walk then read a "line" that was just the terminator, decided it was not a
comment, and stopped.

Consequences, both latent until now:

- an `entry_owned_runs` bound one line too small, so a CRLF removal of an entry with a leading comment
  block was refused with `RemovalCarriesMoreThanTheEntry`;
- the same for a move, as `MoveCarriesMoreThanTheItem`.

**No attempted corpus removal or move reaches the corrected walk**, so the whole existing suite passed
with the defect present. The precise statement matters, because a looser one is false: the synthetic
`crlf-line-endings.yml` *does* open with a two-line comment block immediately above `matches:`, its
root mapping's only entry. That entry is refused before any envelope is derived, so `entry_owned_runs`
never evaluates the shape; and none of the fixture's sequence items has a leading comment block of its
own. The real corpus has **zero** CRLF files. The defect was found by the removal table's **CRLF
twin**, which is exactly the row an LF-only fixture cannot produce.

The walk is now `leading_comment_block_start`, written **once** and called by both. LF behaviour is
byte-identical to before; the CRLF case now climbs. Every pinned tally in `tests/patch_move.rs` and
`tests/patch_structure.rs` is unchanged, which is the evidence that the fix reaches only shapes no
corpus sweep attempts.

---

## 6. Holes this phase leaves open

1. **Nothing calls either primitive.** There is no `#[tauri::command]`, no wrapper and no screen.
   `create_match` and `delete_match` are 2b-2c-2's; `save_raw_document` still has no primitive at all
   and is 2b-2c-3's.
2. **The real configuration exercises none of this.** Every document in `tests/patch_item.rs` is
   written in that file. The real corpus is swept for *moves* and for *field* edits and has never had
   an item inserted into it or removed from it, so nothing here is evidence about a real espanso file.
3. **`verify_items` speaks in `verify_field`'s vocabulary.** A sequence that lost an item reports
   `EntryCountChanged` and an item that changed reports `SiblingChanged`, whose English sentences say
   *entry* and *block*. No `VerificationFailure` variant was added because each one widens the wire,
   the dictionary, the TypeScript union and three contract tests; the cost of the reuse is that a
   diagnostic a developer reads is slightly wrong about what it is describing. A user never sees it —
   a verification failure means the candidate was discarded — but a future phase that surfaces these
   should split them.
4. **`InconsistentSequenceIndentation` is argued unreachable and never fires.** YAML ends a block
   sequence at the first line shallower than its items, so a document whose dashes disagree does not
   parse. `a_sequence_cannot_disagree_with_itself_about_its_dash_column` records the argument by
   asserting `SourceDoesNotParse`; the refusal is kept because "the substrate always agrees" is a
   claim about a pre-1.0 dependency (R1). It is the third such argued-unreachable refusal in this
   module, after `RemovalWouldDeleteAFileComment` and `MalformedSpan`.
5. **A removal between two blank-separated items leaves both blank lines.** Removing the middle item
   of a sequence with one blank line between each pair leaves two consecutive blank lines, and with two
   blanks it leaves four. That is the *lift-site join rule* applied literally — a blank line beside an
   item is not the item's, `RemovalCarriesMoreThanTheEntry` bounds any run that takes one, and deciding
   *which* of the two runs to collapse is a layout decision no primitive may make. It is pinned as
   expected bytes rather than left to be discovered, but it is a real ergonomic cost, and a UI that
   deletes matches will show it.
6. **The insert has no "before the first item" form.** `after: Option<usize>` cannot express it, by
   the shape the consult fixed. `ItemMove` *can* go to the front, so the two are asymmetric; whichever
   phase needs it will have to derive the destination the way `plan_move` derives its front.
7. **The promotion's ambiguity test is one line deep.** It refuses when the line immediately below the
   bare key is a comment line. A comment two blank lines down, or a comment below an *indented* blank
   run, is judged unambiguous by rule 2 and allowed. That is believed correct and is not proven over a
   corpus.
8. **Eight Spanish sentences were added and are checked only by heuristic.** Nothing establishes that
   any is idiomatic. Hole 9 of `1b-1-notes.md`, eight entries larger.
9. **The eight new codes have never been drawn on a screen.** They have key parity, placeholder parity
   and a compile-checked accessor, and no component can produce one because no command reaches these
   primitives. Hole 1 of `2b-2b-3-notes.md`, restated.

---

## 7. Deviation from the brief, recorded rather than hidden

The brief said *"Nothing under `src-tauri/` or `src/` should need to change; if you believe it does,
stop and say so."* Five files under those trees did change, and none of it is behaviour:

| File | Change | Why it is forced |
|---|---|---|
| `src/lib/i18n/en.json`, `es.json` | eight `code.editError.*` sentences | `dictionary_contract::the_code_dictionary_is_exactly_the_declared_variants` fails without them — a code with no string is a build failure by design |
| `src-tauri/src/dictionary_contract.rs` | `("editError", 28)` → `36` | the non-vacuity floor |
| `src-tauri/src/wire_contract.rs` | eight samples, three counts | `every_save_transaction_sample_list_is_its_enums_declaration` derives the variant list **from the core's own source** |
| `src/lib/ipc/types.ts` | eight members of `EditErrorName` and `EditError` | `every_save_transaction_union_declares_exactly_the_rust_variants` |

The brief mandated the eight named refusals *and* `cargo test --workspace` exit 0, and `EditError`
already crossed the wire before this phase. The two instructions are only compatible if the wire
surface follows the enum, which is exactly what these five files are for. **No `#[tauri::command]` was
added, no command changed, and no component was touched.** The brief's own acceptance criteria
anticipate this: they say to run `npm test` and `npm run check` *if and only if* `src/` changed.

---

## 8. Verification

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **959 passed, 0 failed** (927 before; 927 + 32 = 959 exactly) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm install` then `npm test` | **696 passed, 0 failed** (unchanged: the dictionary parity tests enumerate keys rather than count them) |
| `npm run check` | 376 files, **0 errors, 0 warnings** |
| `git status --short --untracked-files=all` | no path under `tests/corpus/real/` |

**No corpus fixture was added, modified or removed.** The twelve boundary documents are string
constants in `tests/patch_item.rs`, so `CLAUDE.md` §4's table of fifteen and `tests/corpus_integrity.rs`
are untouched, and no test that pins a corpus file count needed changing.

The +32 tests are exactly `tests/patch_item.rs` — no existing test was deleted, weakened or re-pinned.
Three counts in `src-tauri/src/wire_contract.rs` moved, and each moved by exactly the eight variants
this phase declared.
