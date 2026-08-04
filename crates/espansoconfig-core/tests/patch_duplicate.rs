//! Phase 2c-3c-1 acceptance: duplicating a whole sequence item, byte-exactly.
//!
//! The sibling of `tests/patch_item.rs` and `tests/patch_move.rs`, and a
//! separate file for the reason each of those is: a duplicate has its own
//! refusal family — destination-only seams, no source close — its own
//! expectation, and the one non-item byte no other edit writes (the copied EOF
//! line ending in front of a clone that lands at an unterminated end of file).
//!
//! # What this file is evidence of
//!
//! **Exact bytes.** Every applied case states the whole candidate document as a
//! literal, so a change of one space, one line break or one blank line fails
//! here rather than being absorbed by a proxy assertion. The table crosses the
//! duplicated item's position — first, middle, last — with blank-line shapes,
//! owned comment blocks, file-owned comments beside and **inside** the item's
//! hull, block scalars, CRLF, a BOM, mixed endings, Unicode in three encodings
//! and an unterminated end of file.
//!
//! Three assertions per row, and the second is the architectural one:
//!
//! 1. the candidate is byte-for-byte the expected document;
//! 2. **the original is unchanged**: a duplicate's replacement list is exactly
//!    one zero-width arrival, so the candidate is the source with the clone's
//!    bytes inserted and nothing else — re-derived here from the replacement
//!    list rather than trusted from the engine;
//! 3. the CRLF twin of the row behaves identically.
//!
//! The three seam fixtures named in `CLAUDE.md` §4 get duplicate rows whose
//! accepted/refused split differs from the move's exactly where the absent
//! source-close seam says it should — `move-kept-comment-joins-a-block.yml`'s
//! deep kept comment refuses a move and permits a duplicate, because the
//! comment never moves.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! The one test that reads it prints file names, counts and offsets only, and
//! skips cleanly when the corpus is absent.

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::patch::{
    apply_edits, duplicate_item, DocumentEdit, DocumentPath, DuplicateItem, DuplicateSeam,
    EditError, PathSegment, RemoveItem, Replacement,
};
use espansoconfig_core::SyntaxIndex;

// ---------------------------------------------------------------------------
// The documents the table is written over
// ---------------------------------------------------------------------------

/// Three items, nothing between them.
const TIGHT: &str = "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n";

/// Three items, one blank line between each pair.
const ONE_BLANK: &str = "matches:\n  - trigger: a\n\n  - trigger: b\n\n  - trigger: c\n";

/// Three items, each with a leading comment block it **owns** (rule 1).
const OWNED_COMMENTS: &str = "matches:\n  # about a\n  - trigger: a\n  # about b\n  \
                              - trigger: b\n  # about c\n  - trigger: c\n";

/// A comment the **file** owns, sitting between two items and inside no hull.
const FILE_COMMENT_BETWEEN: &str = "matches:\n  - trigger: a\n\n  # the file's own note\n\n  \
                                    - trigger: b\n  - trigger: c\n";

/// A comment the **file** owns, sitting **inside** the middle item's own hull.
///
/// The shape `PROGRESS.md` D2o exists for, seen by a copy: the envelope is two
/// runs, and the clone is their concatenation — the comment and the blank runs
/// that keep it file-owned stay at the source and are **not** copied.
const FILE_COMMENT_INSIDE: &str = "matches:\n  - trigger: a\n  - trigger: b\n\n    \
                                   # the file's own note\n\n    replace: B\n  - trigger: c\n";

/// An item whose value is a literal block scalar, and a neighbour.
const BLOCK: &str =
    "matches:\n  - trigger: a\n    replace: |\n      line one\n      line two\n  - trigger: b\n";

/// Unicode in the three shapes `unicode-offsets.yml` distinguishes: precomposed
/// `é`, decomposed `é` and an astral `😀`. A copy must never normalise any of
/// them.
const UNICODE: &str =
    "matches:\n  - trigger: ':\u{e9}'\n    replace: 'e\u{301}\u{1f600}'\n  - trigger: b\n";

/// Two items and no final newline: the one shape whose duplicate writes a byte
/// the item does not own.
const NO_FINAL_NEWLINE: &str = "matches:\n  - trigger: a\n  - trigger: b";

/// The path of the `index`-th item of the root mapping's `matches` sequence.
///
/// @param index - Zero-based position in the sequence.
/// @returns The item's own path.
fn item(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// The CRLF twin of an LF document.
///
/// Every fixture in this file's table is written with bare line feeds and holds
/// none inside a scalar value, so a blind substitution is the whole conversion.
fn crlf(text: &str) -> String {
    text.replace('\n', "\r\n")
}

// ---------------------------------------------------------------------------
// The independent checks
// ---------------------------------------------------------------------------

/// Checks that `candidate` differs from `source` only inside `replacements`.
///
/// Written here rather than imported, for `tests/patch_item.rs`'s reason: the
/// engine makes the same check, and a property checked only inside the thing it
/// checks is not an independent one.
///
/// @param source - The original document.
/// @param candidate - What the edit produced.
/// @param replacements - The spans the edit declared, in ascending order.
fn bytes_outside_the_replacements_match(
    source: &str,
    candidate: &str,
    replacements: &[Replacement],
) {
    let mut rebuilt = String::new();
    let mut cursor = 0usize;
    for replacement in replacements {
        assert!(
            replacement.span.start >= cursor,
            "the replacements are not in ascending, disjoint order"
        );
        rebuilt.push_str(&source[cursor..replacement.span.start]);
        rebuilt.push_str(&replacement.text);
        cursor = replacement.span.end;
    } // End of the loop that replays the replacement list over the source
    rebuilt.push_str(&source[cursor..]);
    assert_eq!(
        rebuilt, candidate,
        "a byte outside the declared replacements moved"
    );
} // End of function bytes_outside_the_replacements_match()

/// Asserts the one replacement shape a duplicate may have, and returns it.
///
/// A duplicate deletes nothing and rewrites nothing, so its replacement list is
/// exactly one zero-width arrival with text. This is the "the original is
/// unchanged" half of the byte oracle, stated over the plan: every byte of the
/// source is still in the candidate, in order, with the clone spliced between
/// two of them.
///
/// @param what - The row's name, printed when it fails.
/// @param replacements - The applied edit's replacement list.
/// @returns The arrival.
fn the_one_zero_width_arrival<'a>(what: &str, replacements: &'a [Replacement]) -> &'a Replacement {
    assert_eq!(
        replacements.len(),
        1,
        "{what}: a duplicate is one insertion and nothing else"
    );
    let arrival = &replacements[0];
    assert!(
        arrival.span.is_empty(),
        "{what}: a duplicate replaces no source byte"
    );
    assert!(
        !arrival.text.is_empty(),
        "{what}: a duplicate writes the clone"
    );
    arrival
} // End of function the_one_zero_width_arrival()

/// How many items the root `matches` sequence of `source` holds.
///
/// Read from a fresh parse, so the count the tests compare against is the
/// substrate's own answer rather than this file's arithmetic.
fn matches_item_count(source: &str) -> usize {
    let index = SyntaxIndex::parse(source).expect("the document parses");
    let root = index.documents()[0];
    let mapping = index.node(root).expect("the root resolves").children[0];
    let mapping = index.node(mapping).expect("the mapping resolves");
    // The flat key/value child list: `matches` is the first key, its value the
    // second child.
    let sequence = mapping.children[1];
    index
        .node(sequence)
        .expect("the sequence resolves")
        .children
        .len()
} // End of function matches_item_count()

// ---------------------------------------------------------------------------
// The byte-exact table
// ---------------------------------------------------------------------------

/// One row of the duplication table.
struct Duplication {
    /// What the row is about, printed when it fails.
    name: &'static str,
    /// The document, in LF.
    source: &'static str,
    /// Which item is duplicated.
    at: usize,
    /// The whole candidate document, in LF, byte for byte.
    expected: &'static str,
}

/// Every position × separation × comment-ownership × scalar-shape case, with
/// its bytes.
const DUPLICATIONS: &[Duplication] = &[
    Duplication {
        name: "first item, nothing between the items",
        source: TIGHT,
        at: 0,
        expected: "matches:\n  - trigger: a\n  - trigger: a\n  - trigger: b\n  - trigger: c\n",
    },
    Duplication {
        name: "middle item, nothing between the items",
        source: TIGHT,
        at: 1,
        expected: "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: b\n  - trigger: c\n",
    },
    Duplication {
        name: "last item, nothing between the items",
        source: TIGHT,
        at: 2,
        expected: "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n  - trigger: c\n",
    },
    Duplication {
        // The clone lands between the item and the blank separator below it:
        // the blank line is not the item's (rule 2 reads it), so it is neither
        // copied nor crossed.
        name: "middle item, one blank line between each pair",
        source: ONE_BLANK,
        at: 1,
        expected: "matches:\n  - trigger: a\n\n  - trigger: b\n  - trigger: b\n\n  - trigger: c\n",
    },
    Duplication {
        // The item's own leading comment block is part of the clone; the
        // neighbours' blocks stay byte-identical and stay theirs.
        name: "middle item, every item owning a leading comment block",
        source: OWNED_COMMENTS,
        at: 1,
        expected: "matches:\n  # about a\n  - trigger: a\n  # about b\n  - trigger: b\n  \
                   # about b\n  - trigger: b\n  # about c\n  - trigger: c\n",
    },
    Duplication {
        // The file's comment lies outside every hull, so the clone lands above
        // it and the comment stays exactly where it is, byte-identical.
        name: "first item, a file-owned comment below it",
        source: FILE_COMMENT_BETWEEN,
        at: 0,
        expected: "matches:\n  - trigger: a\n  - trigger: a\n\n  # the file's own note\n\n  \
                   - trigger: b\n  - trigger: c\n",
    },
    Duplication {
        // The run-based envelope, seen by a copy: the comment lies between two
        // of the item's own descendants, so the clone is the two runs
        // concatenated and the comment is NOT copied — one comment in the
        // source before, one after, and the clone holds none.
        name: "middle item, a file-owned comment inside its own hull",
        source: FILE_COMMENT_INSIDE,
        at: 1,
        expected: "matches:\n  - trigger: a\n  - trigger: b\n\n    # the file's own note\n\n    \
                   replace: B\n  - trigger: b\n    replace: B\n  - trigger: c\n",
    },
    Duplication {
        // A literal block scalar travels whole: header, body and each line's
        // own terminator, with no re-indent and no re-render.
        name: "first item, a literal block scalar value",
        source: BLOCK,
        at: 0,
        expected: "matches:\n  - trigger: a\n    replace: |\n      line one\n      line two\n  \
                   - trigger: a\n    replace: |\n      line one\n      line two\n  - trigger: b\n",
    },
    Duplication {
        // Precomposed é, decomposed é and an astral 😀, all byte-identical in
        // the clone: a copy never normalises.
        name: "first item, Unicode in three encodings",
        source: UNICODE,
        at: 0,
        expected: "matches:\n  - trigger: ':\u{e9}'\n    replace: 'e\u{301}\u{1f600}'\n  \
                   - trigger: ':\u{e9}'\n    replace: 'e\u{301}\u{1f600}'\n  - trigger: b\n",
    },
    Duplication {
        // The only sequence with one item: a duplicate is legal where a removal
        // is not, because it takes nothing away.
        name: "the only item of a sequence",
        source: "matches:\n  - trigger: a\n",
        at: 0,
        expected: "matches:\n  - trigger: a\n  - trigger: a\n",
    },
];

#[test]
fn every_duplication_writes_exactly_the_expected_bytes() {
    for row in DUPLICATIONS {
        let duplicated = duplicate_item(row.source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the duplicate was refused: {error}", row.name));
        assert_eq!(duplicated.text(), row.expected, "{}", row.name);
        assert!(
            duplicated.notes().is_empty(),
            "{}: a duplicate renders nothing and has nothing to disclose",
            row.name
        );
    } // End of the loop over the duplication table
} // End of function every_duplication_writes_exactly_the_expected_bytes()

#[test]
fn every_duplication_is_one_zero_width_arrival_and_touches_no_source_byte() {
    for row in DUPLICATIONS {
        let duplicated = duplicate_item(row.source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the duplicate was refused: {error}", row.name));
        let arrival = the_one_zero_width_arrival(row.name, duplicated.replacements());
        bytes_outside_the_replacements_match(
            row.source,
            duplicated.text(),
            duplicated.replacements(),
        );
        // The candidate is the source with the clone spliced at the arrival,
        // restated naively from the row's own data.
        let rebuilt = format!(
            "{}{}{}",
            &row.source[..arrival.span.start],
            arrival.text,
            &row.source[arrival.span.start..]
        );
        assert_eq!(rebuilt, row.expected, "{}", row.name);
    } // End of the loop over the duplication table
} // End of function every_duplication_is_one_zero_width_arrival_and_touches_no_source_byte()

#[test]
fn every_duplication_grows_its_sequence_by_exactly_one() {
    for row in DUPLICATIONS {
        let before = matches_item_count(row.source);
        let duplicated = duplicate_item(row.source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the duplicate was refused: {error}", row.name));
        assert_eq!(
            matches_item_count(duplicated.text()),
            before + 1,
            "{}",
            row.name
        );
    } // End of the loop over the duplication table
} // End of function every_duplication_grows_its_sequence_by_exactly_one()

#[test]
fn a_crlf_document_duplicates_exactly_as_its_lf_twin_does() {
    for row in DUPLICATIONS {
        let source = crlf(row.source);
        let duplicated = duplicate_item(&source, &item(row.at)).unwrap_or_else(|error| {
            panic!("{}: the CRLF duplicate was refused: {error}", row.name)
        });
        assert_eq!(duplicated.text(), crlf(row.expected), "{} (CRLF)", row.name);
        bytes_outside_the_replacements_match(&source, duplicated.text(), duplicated.replacements());
    } // End of the loop over the duplication table
} // End of function a_crlf_document_duplicates_exactly_as_its_lf_twin_does()

// ---------------------------------------------------------------------------
// The EOF seam — the one non-item byte a duplicate may write
// ---------------------------------------------------------------------------

/// The clone of an unterminated last item is itself unterminated, and the
/// copied line ending goes in front of it.
///
/// The source's last line becomes terminated — a line the edit names, since it
/// is the item being duplicated — the clone ends the file without a break, and
/// the file keeps not having a final newline. This is the same EOF seam an
/// insertion already needs, pinned byte-exactly.
#[test]
fn duplicating_the_unterminated_last_item_writes_the_break_in_front_of_the_clone() {
    let duplicated = duplicate_item(NO_FINAL_NEWLINE, &item(1)).expect("the duplicate applies");
    assert_eq!(
        duplicated.text(),
        "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: b"
    );
    assert!(
        !duplicated.text().ends_with(['\n', '\r']),
        "the file must keep not having a final newline"
    );
    let arrival = the_one_zero_width_arrival("EOF clone", duplicated.replacements());
    assert_eq!(
        arrival.text, "\n  - trigger: b",
        "the copied ending is in front of the clone, not behind it"
    );
    bytes_outside_the_replacements_match(
        NO_FINAL_NEWLINE,
        duplicated.text(),
        duplicated.replacements(),
    );
} // End of function duplicating_the_unterminated_last_item_writes_the_break_in_front_of_the_clone()

/// Duplicating an earlier item of the same document is the ordinary seam.
#[test]
fn duplicating_a_terminated_item_of_an_unterminated_document_copies_no_extra_byte() {
    let duplicated = duplicate_item(NO_FINAL_NEWLINE, &item(0)).expect("the duplicate applies");
    assert_eq!(
        duplicated.text(),
        "matches:\n  - trigger: a\n  - trigger: a\n  - trigger: b"
    );
} // End of function duplicating_a_terminated_item_of_an_unterminated_document_copies_no_extra_byte()

/// A strip-chomped terminal block is safe at the EOF seam; keep and clip are
/// not, and each is refused by name.
///
/// The prefix terminates the source's own last line, so a block that counts
/// trailing breaks into its value would decode differently although nothing
/// about it was edited — `|+` always, `|` exactly when its last content line is
/// the unterminated one, `|-` never.
#[test]
fn the_eof_prefix_refuses_a_keep_or_clip_terminal_block_and_permits_a_strip_one() {
    let strip = "matches:\n  - trigger: a\n  - replace: |-\n      x";
    let duplicated = duplicate_item(strip, &item(1)).expect("a strip block discards the break");
    assert_eq!(
        duplicated.text(),
        "matches:\n  - trigger: a\n  - replace: |-\n      x\n  - replace: |-\n      x"
    );

    for (what, source) in [
        ("keep", "matches:\n  - trigger: a\n  - replace: |+\n      x"),
        ("clip", "matches:\n  - trigger: a\n  - replace: |\n      x"),
    ] {
        let error = duplicate_item(source, &item(1)).expect_err("the block's value would change");
        assert!(
            matches!(
                error,
                EditError::DuplicateWouldExtendAKeptBlock { edit: 0, .. }
            ),
            "{what}: {error:?}"
        );
    } // End of the loop over the two chomping modes the prefix would feed
} // End of function the_eof_prefix_refuses_a_keep_or_clip_terminal_block_and_permits_a_strip_one()

// ---------------------------------------------------------------------------
// The terminal keep-chomped block, away from the end of file
// ---------------------------------------------------------------------------

/// A `|+` block's trailing blank lines are the scalar's **own value bytes**, so
/// the clone carries them and both copies decode to what the source decoded to.
///
/// This is the substrate's answer, pinned rather than assumed: the keep-chomped
/// block's content span runs over the blank line below it — the blank *is* the
/// value's second trailing newline — so the ownership hull covers it, the clone
/// includes it, and the landing sits on the next item's own line. Every decoded
/// value is preserved on both sides, which the engine's own lockstep walk
/// certifies before this test ever sees the bytes. The refusal
/// [`EditError::DuplicateWouldExtendAKeptBlock`] therefore has two clauses of
/// which only the EOF one is known reachable; the landing clause is kept as a
/// defensive gate for the same reason `InconsistentSequenceIndentation` is —
/// "the substrate always consumes a keep block's trailing blanks" is a claim
/// about a pre-1.0 dependency (`PROGRESS.md`, R1).
#[test]
fn a_kept_blocks_trailing_blank_is_value_and_travels_with_the_clone() {
    let separated = "matches:\n  - replace: |+\n      x\n\n  - trigger: b\n";
    let duplicated = duplicate_item(separated, &item(0)).expect("the blank is the block's value");
    assert_eq!(
        duplicated.text(),
        "matches:\n  - replace: |+\n      x\n\n  - replace: |+\n      x\n\n  - trigger: b\n"
    );
    let arrival = the_one_zero_width_arrival("kept block", duplicated.replacements());
    assert_eq!(
        arrival.text, "  - replace: |+\n      x\n\n",
        "the trailing blank is copied because it is the value's own byte"
    );

    let tight = "matches:\n  - replace: |+\n      x\n  - trigger: b\n";
    let duplicated = duplicate_item(tight, &item(0)).expect("no blank line, no extra byte");
    assert_eq!(
        duplicated.text(),
        "matches:\n  - replace: |+\n      x\n  - replace: |+\n      x\n  - trigger: b\n"
    );
} // End of function a_kept_blocks_trailing_blank_is_value_and_travels_with_the_clone()

// ---------------------------------------------------------------------------
// The destination seams — asymmetric on purpose
// ---------------------------------------------------------------------------

/// An item that ends in a block scalar and owns a leading comment block at that
/// block's body column cannot be duplicated: the clone's first line would
/// become the source block's content. The twin two columns shallower applies.
///
/// This is `move-block-scalar-seams.yml`'s condition met at the one destination
/// a duplicate has — the slot immediately after the source — where the block
/// that absorbs is the source item's **own** terminal block.
#[test]
fn a_deep_leading_comment_on_a_block_ended_item_is_refused_at_the_landing() {
    let deep =
        "matches:\n  - trigger: a\n     # my own comment at column five\n  - trigger: b\n    \
                replace: |\n     body at column five\n  - trigger: z\n";
    let error = duplicate_item(deep, &item(1)).expect_err("the comment would join the block");
    assert!(
        matches!(
            error,
            EditError::DuplicateWouldExtendABlockScalar {
                edit: 0,
                seam: DuplicateSeam::ArrivalLands,
                ..
            }
        ),
        "{error:?}"
    );

    let shallow =
        "matches:\n  - trigger: a\n  # my own comment at column two\n  - trigger: b\n    \
                   replace: |\n     body at column five\n  - trigger: z\n";
    let duplicated = duplicate_item(shallow, &item(1)).expect("column two ends the block");
    assert_eq!(
        duplicated.text(),
        "matches:\n  - trigger: a\n  # my own comment at column two\n  - trigger: b\n    \
         replace: |\n     body at column five\n  # my own comment at column two\n  - trigger: b\n    \
         replace: |\n     body at column five\n  - trigger: z\n"
    );
} // End of function a_deep_leading_comment_on_a_block_ended_item_is_refused_at_the_landing()

/// An item ending in an **empty** block scalar is refused conservatively: the
/// span layer observed no body column, so nothing can prove the clone's first
/// line would not join it.
#[test]
fn an_item_ending_in_an_empty_block_scalar_is_refused_conservatively() {
    let source = "matches:\n  - trigger: a\n    replace: |\n  - trigger: b\n";
    let error = duplicate_item(source, &item(0)).expect_err("no observed body column");
    assert!(
        matches!(
            error,
            EditError::DuplicateWouldExtendABlockScalar {
                edit: 0,
                seam: DuplicateSeam::ArrivalLands,
                ..
            }
        ),
        "{error:?}"
    );
} // End of function an_item_ending_in_an_empty_block_scalar_is_refused_conservatively()

// ---------------------------------------------------------------------------
// Every named refusal, one case each
// ---------------------------------------------------------------------------

#[test]
fn a_duplicate_may_not_share_its_batch_with_anything() {
    for (what, batch) in [
        (
            "the duplicate first",
            vec![
                DocumentEdit::DuplicateItem(DuplicateItem::new(item(0))),
                DocumentEdit::RemoveItem(RemoveItem::new(item(2))),
            ],
        ),
        (
            "the duplicate second",
            vec![
                DocumentEdit::RemoveItem(RemoveItem::new(item(2))),
                DocumentEdit::DuplicateItem(DuplicateItem::new(item(0))),
            ],
        ),
    ] {
        let error = apply_edits(TIGHT, &batch).expect_err("must refuse");
        assert!(
            matches!(
                error,
                EditError::DuplicateMustBeTheOnlyEditInItsBatch { edits: 2, .. }
            ),
            "{what}: {error:?}"
        );
    } // End of the loop over the two batch orders
} // End of function a_duplicate_may_not_share_its_batch_with_anything()

#[test]
fn a_flow_sequence_item_is_refused() {
    let source = "matches: [{trigger: a}, {trigger: b}]\n";
    let error = duplicate_item(source, &item(0)).expect_err("must refuse");
    assert!(
        matches!(error, EditError::FlowCollection { edit: 0, .. }),
        "{error:?}"
    );
} // End of function a_flow_sequence_item_is_refused()

#[test]
fn a_hazard_anywhere_in_the_sequence_refuses_the_duplicate() {
    // The gate is asked about the whole sequence, exactly as a move asks it: a
    // duplicate changes the sequence's own shape.
    let source = "matches:\n  - trigger: a\n    replace: &keep val\n  - trigger: b\n";
    let error = duplicate_item(source, &item(1)).expect_err("must refuse");
    assert!(
        matches!(error, EditError::Refused { edit: 0, .. }),
        "{error:?}"
    );
} // End of function a_hazard_anywhere_in_the_sequence_refuses_the_duplicate()

#[test]
fn a_path_that_names_a_mapping_entry_is_not_a_sequence_item() {
    let path = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("trigger");
    let error = duplicate_item(TIGHT, &path).expect_err("must refuse");
    assert!(
        matches!(error, EditError::NotASequenceItem { edit: 0, .. }),
        "{error:?}"
    );
} // End of function a_path_that_names_a_mapping_entry_is_not_a_sequence_item()

#[test]
fn an_item_sharing_its_line_with_the_sequences_own_punctuation_is_refused() {
    let source = "matches:\n  - - trigger: a\n    - trigger: b\n  - trigger: c\n";
    let path = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_index(0);
    let error = duplicate_item(source, &path).expect_err("must refuse");
    assert!(
        matches!(error, EditError::EntryDoesNotOwnItsLines { edit: 0, .. }),
        "{error:?}"
    );
} // End of function an_item_sharing_its_line_with_the_sequences_own_punctuation_is_refused()

// ---------------------------------------------------------------------------
// The arithmetic the caller and the engine must share
// ---------------------------------------------------------------------------

#[test]
fn the_resulting_index_and_path_are_the_slot_after_the_source() {
    let duplicate = DuplicateItem::new(item(1));
    assert_eq!(duplicate.resulting_index(1), 2);
    assert_eq!(duplicate.resulting_path(), Some(item(2)));

    // A path that does not end in an index has no clone address at all.
    let not_an_item = DuplicateItem::new(DocumentPath::root(0).with_key("matches"));
    assert_eq!(not_an_item.resulting_path(), None);

    // And the clone really is at that index: its bytes decode as the source's.
    let duplicated = duplicate_item(TIGHT, &item(1)).expect("the duplicate applies");
    let index = SyntaxIndex::parse(duplicated.text()).expect("the candidate parses");
    let resolved = espansoconfig_core::patch::resolve(
        &index,
        &duplicate.resulting_path().expect("the path exists"),
    )
    .expect("the clone's path resolves in the candidate");
    let node = index.node(resolved).expect("the clone's node exists");
    assert_eq!(node.children.len(), 2, "the clone is one trigger entry");
} // End of function the_resulting_index_and_path_are_the_slot_after_the_source()

/// The clone address is one path segment arithmetic, stated once.
#[test]
fn the_resulting_path_keeps_every_leading_segment() {
    let nested = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("vars")
        .with_index(3);
    let duplicate = DuplicateItem::new(nested);
    let expected = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("vars")
        .with_index(4);
    assert_eq!(duplicate.resulting_path(), Some(expected));
    let _ = PathSegment::Index(0); // the segment kind the arithmetic reads
} // End of function the_resulting_path_keeps_every_leading_segment()

// ---------------------------------------------------------------------------
// The three seam fixtures — the asymmetry against the move, pinned
// ---------------------------------------------------------------------------

/// One synthetic fixture's expected duplicate outcomes, item by item.
struct FixtureRow {
    /// The fixture's file name.
    name: &'static str,
    /// One expected outcome per item of its `matches` sequence, in order.
    outcomes: &'static [Outcome],
}

/// How one attempted duplicate must end.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    /// The duplicate applies and satisfies every independent check.
    Applies,
    /// Refused at a copied-runs join: the envelope's hole makes two runs
    /// neighbours inside the clone.
    RunsJoin,
}

/// The three fixtures `CLAUDE.md` §4 names for the move's seams, read by the
/// duplicate.
///
/// **Every difference from the move's rows is the absent source-close seam.**
/// `move-block-scalar-seams.yml` refuses five moves at `SourceCloses` and four
/// at the arrival seams; a duplicate's destination is the slot beside the
/// source, where no deep comment ever parks under a foreign block, so all six
/// items copy. `move-kept-comment-joins-a-block.yml` refuses three moves for
/// the comment the file owns rising under a block; a duplicate leaves the
/// source — and the comment — in place, so all four items copy. Only
/// `move-run-joins.yml`'s internal seam survives, because it is about the
/// clone's own concatenated runs, not about anything the source loses.
const SEAM_FIXTURES: &[FixtureRow] = &[
    FixtureRow {
        name: "move-block-scalar-seams.yml",
        outcomes: &[
            Outcome::Applies,
            Outcome::Applies,
            Outcome::Applies,
            Outcome::Applies,
            Outcome::Applies,
            Outcome::Applies,
        ],
    },
    FixtureRow {
        name: "move-run-joins.yml",
        outcomes: &[Outcome::RunsJoin, Outcome::Applies, Outcome::Applies],
    },
    FixtureRow {
        name: "move-kept-comment-joins-a-block.yml",
        outcomes: &[
            Outcome::Applies,
            Outcome::Applies,
            Outcome::Applies,
            Outcome::Applies,
        ],
    },
];

/// The synthetic corpus files, keyed once for the fixture tests.
///
/// A [`CorpusFile::name`] is relative to the corpus root, so the synthetic tier
/// prefixes `synthetic/`.
fn fixture(name: &str) -> CorpusFile {
    let wanted = format!("synthetic/{name}");
    synthetic_valid()
        .into_iter()
        .find(|file| file.name == wanted)
        .unwrap_or_else(|| panic!("{name} is not in the synthetic corpus"))
} // End of function fixture()

#[test]
fn the_three_seam_fixtures_duplicate_exactly_where_the_absent_source_close_says() {
    for row in SEAM_FIXTURES {
        let file = fixture(row.name);
        assert_eq!(
            matches_item_count(&file.source),
            row.outcomes.len(),
            "{}: the row does not cover the fixture",
            row.name
        );
        for (at, outcome) in row.outcomes.iter().enumerate() {
            let attempt = duplicate_item(&file.source, &item(at));
            match outcome {
                Outcome::Applies => {
                    let duplicated = attempt
                        .unwrap_or_else(|error| panic!("{} item {at}: refused: {error}", row.name));
                    the_one_zero_width_arrival(row.name, duplicated.replacements());
                    bytes_outside_the_replacements_match(
                        &file.source,
                        duplicated.text(),
                        duplicated.replacements(),
                    );
                    assert_eq!(
                        matches_item_count(duplicated.text()),
                        row.outcomes.len() + 1,
                        "{} item {at}",
                        row.name
                    );
                }
                Outcome::RunsJoin => {
                    let error = attempt.expect_err("the internal seam must refuse");
                    assert!(
                        matches!(
                            error,
                            EditError::DuplicateWouldExtendABlockScalar {
                                edit: 0,
                                seam: DuplicateSeam::CopiedRunsJoin,
                                ..
                            }
                        ),
                        "{} item {at}: {error:?}",
                        row.name
                    );
                }
            }
        } // End of the loop over the fixture's items
    } // End of the loop over the three seam fixtures
} // End of function the_three_seam_fixtures_duplicate_exactly_where_the_absent_source_close_says()

/// The deep kept comment that refuses a move permits a duplicate, and the
/// clone leaves it untouched — the asymmetry, shown on the exact bytes.
#[test]
fn the_deep_kept_comment_stays_at_the_source_and_is_not_copied() {
    let file = fixture("move-kept-comment-joins-a-block.yml");
    let duplicated = duplicate_item(&file.source, &item(1)).expect("the duplicate applies");
    let clone = "  - trigger: ':deep-kept-comment'\n    first: 'one'\n    second: 'two'\n";
    let arrival = the_one_zero_width_arrival("deep kept comment", duplicated.replacements());
    assert_eq!(
        arrival.text, clone,
        "the clone is the two runs concatenated, without the file's comment"
    );
    // The file's own comment block is still in the candidate exactly once.
    let needle = "# A blank line on either side gives this comment to the FILE";
    assert_eq!(
        duplicated.text().matches(needle).count(),
        1,
        "the file-owned comment is neither copied nor lost"
    );
} // End of function the_deep_kept_comment_stays_at_the_source_and_is_not_copied()

// ---------------------------------------------------------------------------
// The other byte-exact fixtures
// ---------------------------------------------------------------------------

/// Duplicating inside the BOM fixture leaves the BOM alone.
#[test]
fn a_bom_document_keeps_its_bom_and_duplicates_byte_exactly() {
    let file = fixture("bom-utf8.yml");
    let duplicated = duplicate_item(&file.source, &item(0)).expect("the duplicate applies");
    assert!(
        duplicated.text().starts_with('\u{feff}'),
        "the BOM must survive"
    );
    let clone = "  - trigger: :bom\n    replace: 'the file starts with a byte-order mark'\n";
    let expected = file.source.replacen(clone, &format!("{clone}{clone}"), 1);
    assert_eq!(duplicated.text(), expected);
} // End of function a_bom_document_keeps_its_bom_and_duplicates_byte_exactly()

/// Duplicating inside the CRLF fixture copies CRLF terminators, block body
/// included.
#[test]
fn a_crlf_fixture_item_with_a_block_scalar_duplicates_byte_exactly() {
    let file = fixture("crlf-line-endings.yml");
    let duplicated = duplicate_item(&file.source, &item(1)).expect("the duplicate applies");
    let clone =
        "  - trigger: :crlf-block\r\n    replace: |\r\n      first block line\r\n      second block line\r\n";
    let expected = file.source.replacen(clone, &format!("{clone}{clone}"), 1);
    assert_eq!(duplicated.text(), expected);
} // End of function a_crlf_fixture_item_with_a_block_scalar_duplicates_byte_exactly()

/// The mixed-endings fixture: a CRLF item inside an LF file duplicates with its
/// own endings, the file-owned hole is not copied, and the unterminated last
/// item takes the EOF seam.
#[test]
fn the_mixed_endings_fixture_duplicates_all_three_of_its_shapes() {
    let file = fixture("file-comments-and-mixed-endings.yml");

    // Item 0: the file-owned comment inside the hull stays, uncopied.
    let holed = duplicate_item(&file.source, &item(0)).expect("item 0 applies");
    let arrival = the_one_zero_width_arrival("interior file comment", holed.replacements());
    assert_eq!(
        arrival.text,
        "  - trigger: ':interior-file-comment'\n    vars:\n      first: 'one'\n      \
         second: 'two'\n    replace: 'the entry above carries a comment the file owns'\n",
        "the clone is the runs concatenated, without the file's comment"
    );

    // Item 1: the two CRLF lines stay CRLF and the LF line stays LF.
    let mixed = duplicate_item(&file.source, &item(1)).expect("item 1 applies");
    let clone = "  - trigger: ':crlf-anchor'\r\n    replace: 'this line ends with CRLF although \
                 the file is mostly LF'\r\n    label: 'an entry inserted after either line above \
                 must end with CRLF'\n";
    let expected = file.source.replacen(clone, &format!("{clone}{clone}"), 1);
    assert_eq!(
        mixed.text(),
        expected,
        "item 1 copies its own mixed endings"
    );

    // Item 2: the unterminated last item, via the EOF seam.
    let last = duplicate_item(&file.source, &item(2)).expect("item 2 applies");
    assert!(
        last.text().ends_with(
            "  - trigger: ':ends-the-file'\n    replace: 'nothing terminates this line'\n  \
             - trigger: ':ends-the-file'\n    replace: 'nothing terminates this line'"
        ),
        "the source is terminated and the clone is not"
    );
    assert!(!last.text().ends_with(['\n', '\r']));
} // End of function the_mixed_endings_fixture_duplicates_all_three_of_its_shapes()

/// The terminal-spaces fixture: the ordinary item duplicates byte-exactly, and
/// the item whose clip block ends the unterminated file is refused by name.
#[test]
fn the_terminal_spaces_fixture_splits_exactly_at_the_eof_block() {
    let file = fixture("block-scalar-terminal-spaces.yml");

    let ordinary = duplicate_item(&file.source, &item(0)).expect("item 0 applies");
    let clone = "  - trigger: :ordinary\n    replace: |\n      an ordinary block with a normal \
                 ending\n    label: after-ordinary\n";
    let expected = file.source.replacen(clone, &format!("{clone}{clone}"), 1);
    assert_eq!(ordinary.text(), expected);

    let error = duplicate_item(&file.source, &item(1))
        .expect_err("the EOF prefix would give the clip block a trailing break");
    assert!(
        matches!(
            error,
            EditError::DuplicateWouldExtendAKeptBlock { edit: 0, .. }
        ),
        "{error:?}"
    );
} // End of function the_terminal_spaces_fixture_splits_exactly_at_the_eof_block()

/// The flow fixture: every item of a flow sequence is refused outright.
#[test]
fn the_unicode_offsets_fixture_refuses_because_its_sequence_is_flow() {
    let file = fixture("unicode-offsets.yml");
    let path = DocumentPath::root(0).with_key("probe").with_index(0);
    let error = duplicate_item(&file.source, &path).expect_err("a flow sequence is refused");
    assert!(
        matches!(error, EditError::FlowCollection { edit: 0, .. }),
        "{error:?}"
    );
} // End of function the_unicode_offsets_fixture_refuses_because_its_sequence_is_flow()

// ---------------------------------------------------------------------------
// The real corpus — counts and offsets only (`CLAUDE.md` section 1)
// ---------------------------------------------------------------------------

/// Every third item of every real file's `matches` sequence is offered for
/// duplication; every applied case must satisfy the independent checks, every
/// refusal must be one of the classes a duplicate can legitimately produce —
/// and the sweep must not be satisfiable by refusing everything.
///
/// **Non-vacuous by construction** (the Phase 2c-3c-1 review's finding 4): when
/// the corpus is present, at least one item must have been offered and at least
/// one duplicate must have applied — the real configuration is known to hold
/// ordinary matches, so a sweep in which every attempt regressed to a refusal
/// is a failure of the engine, not a fact about the corpus. A refusal outside
/// the allowlisted classes — a verification discard, a malformed span — is an
/// engine defect and panics rather than being counted.
///
/// A thinned sweep for `tests/patch_move.rs`'s reason: `TriviaIndex::scan` is
/// quadratic (`PROGRESS.md`, R19) and the safe entry point re-scans per call.
/// Still skips cleanly when the corpus is absent.
#[test]
fn every_real_corpus_duplicate_ends_in_a_typed_outcome() {
    let files = real_corpus();
    if skip_without_real_corpus("patch_duplicate", &files) {
        return;
    }
    let mut applied = 0usize;
    let mut refused = 0usize;
    for file in &files {
        let Ok(index) = SyntaxIndex::parse(&file.source) else {
            continue;
        };
        let Some(items) = matches_items_of(&index) else {
            continue;
        };
        for at in (0..items).step_by(3) {
            match duplicate_item(&file.source, &item(at)) {
                Ok(duplicated) => {
                    the_one_zero_width_arrival(&file.name, duplicated.replacements());
                    bytes_outside_the_replacements_match(
                        &file.source,
                        duplicated.text(),
                        duplicated.replacements(),
                    );
                    let reparsed = SyntaxIndex::parse(duplicated.text())
                        .unwrap_or_else(|error| panic!("{}: {error}", file.name));
                    assert_eq!(
                        matches_items_of(&reparsed),
                        Some(items + 1),
                        "{}: the sequence must grow by exactly one",
                        file.name
                    );
                    applied += 1;
                }
                // The refusal classes a duplicate can legitimately meet on a
                // real file. Anything else — a verification discard above all —
                // is an engine defect this sweep exists to surface, and the
                // catch-all arm panics with the file's name and never its
                // content (`CLAUDE.md` section 1).
                Err(
                    EditError::Refused { .. }
                    | EditError::FlowCollection { .. }
                    | EditError::EntryDoesNotOwnItsLines { .. }
                    | EditError::NoObservableLineEnding { .. }
                    | EditError::DuplicateWouldCopyAFileComment { .. }
                    | EditError::DuplicateWouldExtendAKeptBlock { .. }
                    | EditError::DuplicateWouldExtendABlockScalar { .. },
                ) => {
                    refused += 1;
                }
                Err(unexpected) => {
                    panic!(
                        "{} item {at}: not a duplicate's refusal: {unexpected}",
                        file.name
                    )
                }
            }
        } // End of the loop over every third item of the file
    } // End of the loop over the real corpus
    assert!(
        applied + refused > 0,
        "the corpus is present, so at least one item must have been offered"
    );
    assert!(
        applied > 0,
        "the real configuration holds ordinary matches, so an all-refused sweep is an \
         engine regression: {refused} refused"
    );
    println!("real corpus duplicates: {applied} applied, {refused} refused");
} // End of function every_real_corpus_duplicate_ends_in_a_typed_outcome()

/// The item count of a parsed document's root `matches` sequence, or `None`.
fn matches_items_of(index: &SyntaxIndex) -> Option<usize> {
    let root = *index.documents().first()?;
    let mapping = index.node(root)?.children.first().copied()?;
    let mapping = index.node(mapping)?;
    let mut entries = mapping.children.chunks(2);
    let sequence = entries.find_map(|pair| {
        let key = index.node(*pair.first()?)?;
        let value = *pair.get(1)?;
        (key.scalar.as_ref()?.value == "matches").then_some(value)
    })?;
    let node = index.node(sequence)?;
    (node.kind == espansoconfig_core::syntax::NodeKind::Sequence).then_some(node.children.len())
} // End of function matches_items_of()
