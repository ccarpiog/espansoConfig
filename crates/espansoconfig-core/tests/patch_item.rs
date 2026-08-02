//! Phase 2b-2c-1 acceptance: the sequence's own pair of primitives.
//!
//! `InsertItem` and `RemoveItem`, the two `DocumentEdit` variants that make a
//! sequence longer or shorter. A separate file from `tests/patch_move.rs` for the
//! reason that file is separate from `tests/patch_structure.rs`: these two have
//! their own refusal families and their own expectation, and folding them into a
//! corpus sweep would hide every one of them inside a total.
//!
//! # What this file is evidence of
//!
//! **Exact bytes.** Every applied case states the whole candidate document as a
//! literal, so a change of one space, one line break or one blank line fails here
//! rather than being absorbed by a proxy assertion. The removal table crosses the
//! removed item's position — **first, middle, last** — with zero, one and two
//! blank lines around it, and with comment blocks the item owns, comment blocks
//! the *file* owns beside it, and a file-owned comment **inside the item's own
//! hull**, which is the shape that makes an envelope a set of runs at all.
//!
//! Four assertions per row, and the third is the architectural one:
//!
//! 1. the candidate is byte-for-byte the expected document;
//! 2. every byte outside the computed replacement region is unchanged, re-derived
//!    here from the replacement list rather than trusted from the engine;
//! 3. **`RemoveItem`'s output equals `ItemMove`'s lift-site output for the same
//!    item** — the same replacement spans, and the same document once the move's
//!    arrival is discarded. `RemoveItem` is documented as a move's lift half with
//!    no landing, and this is the sentence that makes that a fact rather than a
//!    claim;
//! 4. the CRLF twin of the row behaves identically: the candidate for the CRLF
//!    document is exactly the CRLF twin of the LF candidate.
//!
//! # Privacy
//!
//! Every document here is written in this file. Nothing reads the real corpus
//! (`CLAUDE.md` section 1), so nothing here can print a byte of it.

use espansoconfig_core::patch::{
    apply_edits, insert_item, move_item, remove_item, DocumentEdit, DocumentPath, EditError,
    InsertItem, ItemPlacement, PatchedDocument, PresentationNote, RemoveItem, Replacement,
};

// ---------------------------------------------------------------------------
// The documents the table is written over
// ---------------------------------------------------------------------------

/// Three items, nothing between them.
const TIGHT: &str = "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n";

/// Three items, one blank line between each pair.
const ONE_BLANK: &str = "matches:\n  - trigger: a\n\n  - trigger: b\n\n  - trigger: c\n";

/// Three items, two blank lines between each pair.
const TWO_BLANKS: &str = "matches:\n  - trigger: a\n\n\n  - trigger: b\n\n\n  - trigger: c\n";

/// Three items, each with a leading comment block it **owns** (rule 1).
const OWNED_COMMENTS: &str = "matches:\n  # about a\n  - trigger: a\n  # about b\n  \
                              - trigger: b\n  # about c\n  - trigger: c\n";

/// A comment the **file** owns, sitting between two items and inside no hull.
const FILE_COMMENT_BETWEEN: &str = "matches:\n  - trigger: a\n\n  # the file's own note\n\n  \
                                    - trigger: b\n  - trigger: c\n";

/// A comment the **file** owns, sitting **inside** the middle item's own hull.
///
/// The shape `PROGRESS.md` D2o exists for: the item's ownership hull is
/// contiguous and this comment lies between two of its descendants, so the
/// envelope has to be a set of runs with the comment punched out of it.
const FILE_COMMENT_INSIDE: &str = "matches:\n  - trigger: a\n  - trigger: b\n\n    \
                                   # the file's own note\n\n    replace: B\n  - trigger: c\n";

/// The path of the `index`-th item of the root mapping's `matches` sequence.
///
/// @param index - Zero-based position in the sequence.
/// @returns The item's own path.
fn item(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// The path of the root mapping's `matches` value.
fn sequence() -> DocumentPath {
    DocumentPath::root(0).with_key("matches")
}

/// The CRLF twin of an LF document.
///
/// Every fixture in this file is written with bare line feeds and holds none
/// inside a scalar value, so a blind substitution is the whole conversion.
fn crlf(text: &str) -> String {
    text.replace('\n', "\r\n")
}

// ---------------------------------------------------------------------------
// The independent checks
// ---------------------------------------------------------------------------

/// Checks that `candidate` differs from `source` only inside `replacements`.
///
/// Written here rather than imported: the engine makes the same check, and a
/// property checked only inside the thing it checks is not an independent one.
/// The walk is deliberately naive — take the source, apply the replacements in
/// ascending order, and compare — because the engine's own version walks the two
/// texts together and a second implementation that shared its shape would share
/// its blind spots.
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

/// The document a **move** of the same item leaves behind at its source.
///
/// The move is applied for real, and then its **arrival** — the one replacement
/// with text — is discarded, leaving exactly the lift. Comparing that against
/// `RemoveItem`'s own answer is what pins "the removal is the move's lift half"
/// as a fact about the code rather than a sentence in a doc comment.
///
/// @param source - The document to lift out of.
/// @param at - The item's position in its sequence.
/// @param items - How many items the sequence holds, so a destination that is
///   somewhere else can be chosen.
/// @returns The lifted document and the departure spans that produced it.
fn lift_site_of_a_move(source: &str, at: usize, items: usize) -> (String, Vec<Replacement>) {
    // Anywhere but where it already is. The first item goes to the end, and
    // everything else goes to the front, so `MoveChangesNothing` is never the
    // answer for a sequence of two or more.
    let destination = if at == 0 { Some(items - 1) } else { None };
    let moved = move_item(source, &item(at), destination).expect("the move must apply");
    let departures: Vec<Replacement> = moved
        .replacements()
        .iter()
        .filter(|replacement| replacement.text.is_empty())
        .cloned()
        .collect();
    let mut lifted = String::new();
    let mut cursor = 0usize;
    for departure in &departures {
        lifted.push_str(&source[cursor..departure.span.start]);
        cursor = departure.span.end;
    } // End of the loop that deletes every departure run
    lifted.push_str(&source[cursor..]);
    (lifted, departures)
} // End of function lift_site_of_a_move()

/// One row of the removal table.
struct Removal {
    /// What the row is about, printed when it fails.
    name: &'static str,
    /// The document, in LF.
    source: &'static str,
    /// Which item is removed.
    at: usize,
    /// How many items the sequence holds.
    items: usize,
    /// The whole candidate document, in LF, byte for byte.
    expected: &'static str,
}

/// Every position × blank-line shape × comment-ownership case, with its bytes.
///
/// Twelve rows: three positions against three blank-line shapes, plus the three
/// comment-ownership shapes that a blank-line count cannot express.
const REMOVALS: &[Removal] = &[
    Removal {
        name: "first item, nothing between the items",
        source: TIGHT,
        at: 0,
        items: 3,
        expected: "matches:\n  - trigger: b\n  - trigger: c\n",
    },
    Removal {
        name: "middle item, nothing between the items",
        source: TIGHT,
        at: 1,
        items: 3,
        expected: "matches:\n  - trigger: a\n  - trigger: c\n",
    },
    Removal {
        name: "last item, nothing between the items",
        source: TIGHT,
        at: 2,
        items: 3,
        expected: "matches:\n  - trigger: a\n  - trigger: b\n",
    },
    Removal {
        name: "first item, one blank line between each pair",
        source: ONE_BLANK,
        at: 0,
        items: 3,
        expected: "matches:\n\n  - trigger: b\n\n  - trigger: c\n",
    },
    Removal {
        // Both separator runs survive. Deleting one would delete a line the item
        // does not own, which `RemovalCarriesMoreThanTheEntry` bounds, and
        // choosing *which* one is a layout decision no primitive may make.
        name: "middle item, one blank line between each pair",
        source: ONE_BLANK,
        at: 1,
        items: 3,
        expected: "matches:\n  - trigger: a\n\n\n  - trigger: c\n",
    },
    Removal {
        name: "last item, one blank line between each pair",
        source: ONE_BLANK,
        at: 2,
        items: 3,
        expected: "matches:\n  - trigger: a\n\n  - trigger: b\n\n",
    },
    Removal {
        name: "first item, two blank lines between each pair",
        source: TWO_BLANKS,
        at: 0,
        items: 3,
        expected: "matches:\n\n\n  - trigger: b\n\n\n  - trigger: c\n",
    },
    Removal {
        name: "middle item, two blank lines between each pair",
        source: TWO_BLANKS,
        at: 1,
        items: 3,
        expected: "matches:\n  - trigger: a\n\n\n\n\n  - trigger: c\n",
    },
    Removal {
        name: "last item, two blank lines between each pair",
        source: TWO_BLANKS,
        at: 2,
        items: 3,
        expected: "matches:\n  - trigger: a\n\n\n  - trigger: b\n\n\n",
    },
    Removal {
        // The item's own leading comment block goes with it; the neighbours' stay
        // byte-identical. Leaving it would strand a comment describing something
        // that is no longer in the file.
        name: "middle item, every item owning a leading comment block",
        source: OWNED_COMMENTS,
        at: 1,
        items: 3,
        expected: "matches:\n  # about a\n  - trigger: a\n  # about c\n  - trigger: c\n",
    },
    Removal {
        // The comment is the file's by rule 2 and lies outside every hull, so it
        // is not even a candidate for deletion.
        name: "middle item, a file-owned comment beside it",
        source: FILE_COMMENT_BETWEEN,
        at: 1,
        items: 3,
        expected: "matches:\n  - trigger: a\n\n  # the file's own note\n\n  - trigger: c\n",
    },
    Removal {
        // The run-based envelope, seen by a sequence item: the comment lies
        // between two of the item's own descendants, so the hull crosses it and
        // the envelope has to punch it out.
        name: "middle item, a file-owned comment inside its own hull",
        source: FILE_COMMENT_INSIDE,
        at: 1,
        items: 3,
        expected: "matches:\n  - trigger: a\n\n    # the file's own note\n\n  - trigger: c\n",
    },
];

#[test]
fn every_removal_writes_exactly_the_expected_bytes() {
    for row in REMOVALS {
        let removed = remove_item(row.source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the removal was refused: {error}", row.name));
        assert_eq!(removed.text(), row.expected, "{}", row.name);
    } // End of the loop over the removal table
} // End of function every_removal_writes_exactly_the_expected_bytes()

#[test]
fn every_removal_leaves_every_byte_outside_its_runs_alone() {
    for row in REMOVALS {
        let removed = remove_item(row.source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the removal was refused: {error}", row.name));
        bytes_outside_the_replacements_match(row.source, removed.text(), removed.replacements());
        for replacement in removed.replacements() {
            assert!(
                replacement.text.is_empty(),
                "{}: a removal writes no bytes",
                row.name
            );
        }
    } // End of the loop over the removal table
} // End of function every_removal_leaves_every_byte_outside_its_runs_alone()

#[test]
fn a_removal_is_a_move_with_no_landing() {
    for row in REMOVALS {
        let removed = remove_item(row.source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the removal was refused: {error}", row.name));
        let (lifted, departures) = lift_site_of_a_move(row.source, row.at, row.items);
        assert_eq!(
            removed.replacements(),
            departures.as_slice(),
            "{}: the removal and the move take different spans",
            row.name
        );
        assert_eq!(
            removed.text(),
            lifted,
            "{}: the removal and the move leave different documents behind",
            row.name
        );
    } // End of the loop over the removal table
} // End of function a_removal_is_a_move_with_no_landing()

#[test]
fn a_crlf_document_removes_exactly_as_its_lf_twin_does() {
    for row in REMOVALS {
        let source = crlf(row.source);
        let removed = remove_item(&source, &item(row.at))
            .unwrap_or_else(|error| panic!("{}: the CRLF removal was refused: {error}", row.name));
        assert_eq!(removed.text(), crlf(row.expected), "{} (CRLF)", row.name);
        bytes_outside_the_replacements_match(&source, removed.text(), removed.replacements());
    } // End of the loop over the removal table
} // End of function a_crlf_document_removes_exactly_as_its_lf_twin_does()

/// A removal that leaves two blank separations adjacent says so.
///
/// Plan section 6.2 — never silently normalise — applied to a change the bytes
/// alone cannot disclose. Deleting the middle item of `ONE_BLANK` leaves the
/// blank line above it and the blank line below it next to each other, which is
/// **correct**: neither belonged to the item, and collapsing either would delete
/// trivia outside it. What the operation owes is the disclosure, and that is the
/// note.
///
/// Three negatives sit beside the claim, because a detector that answered *yes*
/// to everything would pass the claim on its own:
///
/// - a document with no blank line beside the item reports nothing;
/// - removing the **first** item has nothing above it to double;
/// - removing the **last** item has nothing below it.
#[test]
fn a_removal_between_blank_separated_items_reports_the_doubled_separation() {
    let removed = remove_item(ONE_BLANK, &item(1)).expect("the removal applies");
    assert_eq!(
        removed.text(),
        "matches:\n  - trigger: a\n\n\n  - trigger: c\n",
        "both blank lines survive, because neither belonged to the item"
    );
    assert_eq!(
        removed.notes(),
        [PresentationNote::DoubledSequenceSeparation { edit: 0 }],
        "the doubled separation is disclosed rather than collapsed"
    );

    for (what, source, at) in [
        ("no blank line anywhere", TIGHT, 1),
        ("nothing above the first item", ONE_BLANK, 0),
        ("nothing below the last item", ONE_BLANK, 2),
    ] {
        let quiet = remove_item(source, &item(at)).expect("the removal applies");
        assert!(quiet.notes().is_empty(), "{what}: {:?}", quiet.notes());
    } // End of the loop over the removals that double nothing
} // End of function a_removal_between_blank_separated_items_reports_the_doubled_separation()

/// The **move** that lifts the same item still reports nothing.
///
/// `RemoveItem` and `ItemMove` share `lift_item`, so a move out of a
/// blank-separated list leaves the identical two blank lines at its source. The
/// detection is deliberately at the `RemoveItem` planning level and not inside
/// the shared derivation, because `SaveResult::notes` is documented as **always
/// empty for a move** and this is what keeps that a fact.
/// `docs/decisions/2b-2c-2-notes.md` section 6.2 records the move's half as open.
#[test]
fn a_move_out_of_the_same_gap_still_reports_nothing() {
    let moved = move_item(ONE_BLANK, &item(1), None).expect("the move applies");
    assert!(
        moved.notes().is_empty(),
        "a move's notes are always empty: {:?}",
        moved.notes()
    );
} // End of function a_move_out_of_the_same_gap_still_reports_nothing()

// ---------------------------------------------------------------------------
// Insertion
// ---------------------------------------------------------------------------

/// One `(key, value)` pair, spelled the way the primitive takes them.
fn field(key: &str, value: &str) -> (String, String) {
    (key.to_owned(), value.to_owned())
}

#[test]
fn appending_an_item_writes_it_after_the_last_one() {
    let fields = vec![field("trigger", "d"), field("replace", "D")];
    let inserted = insert_item(TIGHT, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n  - trigger: d\n    \
         replace: D\n"
    );
    bytes_outside_the_replacements_match(TIGHT, inserted.text(), inserted.replacements());
} // End of function appending_an_item_writes_it_after_the_last_one()

#[test]
fn inserting_after_the_first_item_writes_it_between_the_first_two() {
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(TIGHT, &sequence(), ItemPlacement::After(0), &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "matches:\n  - trigger: a\n  - trigger: x\n  - trigger: b\n  - trigger: c\n"
    );
} // End of function inserting_after_the_first_item_writes_it_between_the_first_two()

#[test]
fn inserting_at_the_front_writes_it_above_the_first_item() {
    let fields = vec![field("trigger", "x"), field("replace", "X")];
    let inserted =
        insert_item(TIGHT, &sequence(), ItemPlacement::Front, &fields).expect("the insert applies");
    assert_eq!(
        inserted.text(),
        "matches:\n  - trigger: x\n    replace: X\n  - trigger: a\n  - trigger: b\n  \
         - trigger: c\n"
    );
    bytes_outside_the_replacements_match(TIGHT, inserted.text(), inserted.replacements());
} // End of function inserting_at_the_front_writes_it_above_the_first_item()

/// The front destination is the first item's **hull**, so that item's own
/// leading comment block stays with it.
///
/// The whole reason [`ItemPlacement::Front`] reuses `plan_move`'s derivation
/// rather than "the line after `matches:`": the comment describes the snippet it
/// sits above, and an arrival that landed between the two would silently
/// re-point it at a snippet nobody wrote it for. `OWNED_COMMENTS` gives every
/// item a comment it owns, so the assertion is about which side of `# about a`
/// the new item lands on.
#[test]
fn a_front_insertion_lands_above_the_first_items_own_comment_block() {
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(OWNED_COMMENTS, &sequence(), ItemPlacement::Front, &fields)
        .expect("the insert applies");
    assert_eq!(
        inserted.text(),
        "matches:\n  - trigger: x\n  # about a\n  - trigger: a\n  # about b\n  - trigger: b\n  \
         # about c\n  - trigger: c\n"
    );
    bytes_outside_the_replacements_match(OWNED_COMMENTS, inserted.text(), inserted.replacements());
} // End of function a_front_insertion_lands_above_the_first_items_own_comment_block()

/// A front insertion agrees with the move that lands in the same place.
///
/// The architectural claim, pinned the way `a_removal_is_a_move_with_no_landing`
/// pins its own: moving the last item to the front and inserting a new one at the
/// front must put their bytes at the **same offset**, because both ask
/// `removal_span` for the start of the first item's hull. A second derivation
/// that drifted by one line would show up here as two different arrival offsets.
#[test]
fn a_front_insertion_lands_where_a_front_move_lands() {
    let inserted = insert_item(
        OWNED_COMMENTS,
        &sequence(),
        ItemPlacement::Front,
        &[field("trigger", "x")],
    )
    .expect("the insert applies");
    let moved = move_item(OWNED_COMMENTS, &item(2), None).expect("the move applies");
    let arrival = moved
        .replacements()
        .iter()
        .find(|replacement| !replacement.text.is_empty())
        .expect("a move writes exactly one non-empty replacement");
    assert_eq!(inserted.replacements().len(), 1);
    assert_eq!(
        inserted.replacements()[0].span.start,
        arrival.span.start,
        "the insertion and the move must derive one front offset, not two"
    );
} // End of function a_front_insertion_lands_where_a_front_move_lands()

#[test]
fn a_front_insertion_copies_the_documents_crlf_line_ending() {
    let source = crlf(TIGHT);
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(&source, &sequence(), ItemPlacement::Front, &fields)
        .expect("the insert applies");
    assert_eq!(
        inserted.text(),
        crlf("matches:\n  - trigger: x\n  - trigger: a\n  - trigger: b\n  - trigger: c\n")
    );
    bytes_outside_the_replacements_match(&source, inserted.text(), inserted.replacements());
} // End of function a_front_insertion_copies_the_documents_crlf_line_ending()

/// A promotion has no first item, so the front and the end are one offset.
///
/// `matches:` with no value at all is promoted into its first block-sequence
/// item, and there is no item for a placement to sit above or below. `Front` and
/// `End` must therefore produce the same bytes — stated as an equality of
/// documents rather than as an argument, because a `Front` branch that reached
/// for `children.first()` on an empty child list would refuse instead.
///
/// **`After(_)` is not one of them**, and the twin below says why.
#[test]
fn front_and_end_promote_a_bare_key_to_the_same_bytes() {
    let source = "matches:\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    let expected = "matches:\n  - trigger: x\nother: 1\n";
    for placement in [ItemPlacement::Front, ItemPlacement::End] {
        let inserted = insert_item(source, &sequence(), placement, &fields)
            .unwrap_or_else(|error| panic!("{placement:?} was refused: {error}"));
        assert_eq!(inserted.text(), expected, "{placement:?}");
    } // End of the loop over the two placements a promotion accepts
} // End of function front_and_end_promote_a_bare_key_to_the_same_bytes()

/// A promotion refuses every `After(_)`, because it has no item to name.
///
/// `ItemPlacement::After(k)` means *after the item at index `k` of the original
/// sequence*, and an implicit-null value has zero items — so every anchor is out
/// of range, including `After(0)`, which is the one an off-by-one would let
/// through. Accepting it would make an invalid coordinate a third spelling of the
/// promotion's single offset and would leave the public API answering a question
/// the caller had no business asking.
///
/// The count in the refusal is asserted as well as its name: `items: 0` is what
/// makes the sentence *"the sequence has no such item"* true rather than merely
/// present.
#[test]
fn a_promotion_refuses_every_after_anchor() {
    let source = "matches:\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    for anchor in [0usize, 1, 7] {
        let error = insert_item(source, &sequence(), ItemPlacement::After(anchor), &fields)
            .expect_err("an implicit null has no item to sit after");
        assert!(
            matches!(
                error,
                EditError::NoSuchDestinationItem {
                    edit: 0,
                    items: 0,
                    ..
                }
            ),
            "After({anchor}): {error:?}"
        );
    } // End of the loop over the anchors a promotion cannot have
} // End of function a_promotion_refuses_every_after_anchor()

#[test]
fn an_inserted_item_takes_the_column_the_sequence_already_uses() {
    // Four columns, not the renderer's two: the marker column is read off the
    // sequence's own dashes.
    let source = "matches:\n    - trigger: a\n";
    let fields = vec![field("trigger", "b")];
    let inserted = insert_item(source, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "matches:\n    - trigger: a\n    - trigger: b\n"
    );
} // End of function an_inserted_item_takes_the_column_the_sequence_already_uses()

#[test]
fn an_inserted_item_copies_the_documents_crlf_line_ending() {
    let source = crlf(TIGHT);
    let fields = vec![field("trigger", "d"), field("replace", "D")];
    let inserted = insert_item(&source, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        crlf(
            "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n  - trigger: d\n    \
              replace: D\n"
        )
    );
} // End of function an_inserted_item_copies_the_documents_crlf_line_ending()

#[test]
fn a_bare_matches_key_is_promoted_into_its_first_item() {
    // No block collection anywhere, so the step is the renderer's documented
    // two-column default — the third and last source of evidence.
    let source = "matches:\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(source, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(inserted.text(), "matches:\n  - trigger: x\nother: 1\n");
} // End of function a_bare_matches_key_is_promoted_into_its_first_item()

#[test]
fn a_promotion_takes_its_step_from_the_documents_own_block_children() {
    // `vars` indents its items four columns past its key, so the promoted
    // `matches` does too. A default of two would be visible here.
    let source = "vars:\n    - name: one\nmatches:\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(source, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "vars:\n    - name: one\nmatches:\n    - trigger: x\nother: 1\n"
    );
} // End of function a_promotion_takes_its_step_from_the_documents_own_block_children()

#[test]
fn a_promotion_keeps_the_inline_comment_on_the_key_line() {
    let source = "matches:  # a note on the key\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(source, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "matches:  # a note on the key\n  - trigger: x\nother: 1\n"
    );
} // End of function a_promotion_keeps_the_inline_comment_on_the_key_line()

#[test]
fn the_codec_and_not_this_test_decides_how_a_value_is_spelled() {
    // Three values no plain scalar can hold: a leading `*` is an alias
    // indicator, a leading `'` opens a quoted scalar, and a value with a line
    // break in it has no single-line spelling at all.
    let fields = vec![
        field("trigger", "*star"),
        field("label", "'quoted'"),
        field("replace", "line one\nline two\n"),
    ];
    let inserted = insert_item(TIGHT, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n  - trigger: '*star'\n    \
         label: '''quoted'''\n    replace: |\n      line one\n      line two\n"
    );
    bytes_outside_the_replacements_match(TIGHT, inserted.text(), inserted.replacements());
} // End of function the_codec_and_not_this_test_decides_how_a_value_is_spelled()

#[test]
fn an_inserted_key_is_spelled_by_the_codec_too() {
    // The key is quoted because `*` opens an alias, and the **value** is quoted
    // although nothing about `1` looks dangerous: a plain `1` is an integer under
    // YAML 1.1 and this crate never writes a plain scalar espanso would resolve to
    // something other than a string (`PROGRESS.md`, R16). Both decisions are the
    // codec's, and this test states what it chose rather than what it should.
    let fields = vec![field("*odd", "1")];
    let inserted = insert_item(TIGHT, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert!(
        inserted.text().ends_with("  - '*odd': '1'\n"),
        "the key and the value must both be quoted: {}",
        inserted.text()
    );
} // End of function an_inserted_key_is_spelled_by_the_codec_too()

// ---------------------------------------------------------------------------
// Every named refusal, one case each
// ---------------------------------------------------------------------------

#[test]
fn an_item_with_no_fields_is_refused() {
    let error = insert_item(TIGHT, &sequence(), ItemPlacement::End, &[]).expect_err("must refuse");
    assert!(
        matches!(error, EditError::InsertedItemHasNoFields { edit: 0 }),
        "{error:?}"
    );
} // End of function an_item_with_no_fields_is_refused()

#[test]
fn two_fields_sharing_a_key_are_refused() {
    let fields = vec![field("trigger", "x"), field("trigger", "y")];
    let error =
        insert_item(TIGHT, &sequence(), ItemPlacement::End, &fields).expect_err("must refuse");
    assert!(
        matches!(
            error,
            EditError::DuplicateInsertedField { edit: 0, field: 1 }
        ),
        "{error:?}"
    );
} // End of function two_fields_sharing_a_key_are_refused()

#[test]
fn an_empty_key_and_a_key_holding_a_line_break_are_both_refused() {
    for (at, fields) in [
        (0usize, vec![field("", "x")]),
        (1usize, vec![field("trigger", "x"), field("a\nb", "y")]),
    ] {
        let error =
            insert_item(TIGHT, &sequence(), ItemPlacement::End, &fields).expect_err("must refuse");
        assert!(
            matches!(error, EditError::InvalidInsertedFieldKey { edit: 0, field } if field == at),
            "{error:?}"
        );
    } // End of the loop over the two invalid key shapes
} // End of function an_empty_key_and_a_key_holding_a_line_break_are_both_refused()

#[test]
fn a_flow_sequence_is_refused_whether_it_is_empty_or_not() {
    for source in ["matches: []\n", "matches: [{trigger: a}]\n"] {
        let fields = vec![field("trigger", "x")];
        let error =
            insert_item(source, &sequence(), ItemPlacement::End, &fields).expect_err("must refuse");
        assert!(
            matches!(
                error,
                EditError::FlowSequenceInsertionUnsupported { edit: 0, .. }
            ),
            "{source:?}: {error:?}"
        );
    } // End of the loop over the two flow shapes
} // End of function a_flow_sequence_is_refused_whether_it_is_empty_or_not()

#[test]
fn a_sequence_cannot_disagree_with_itself_about_its_dash_column() {
    // `InconsistentSequenceIndentation` is a **defensive** refusal, and this is
    // the record of the argument that it is one rather than dead code nobody
    // noticed. YAML ends a block sequence at the first line shallower than its
    // items and reads a deeper `-` as content of the item above it, so a document
    // whose dashes disagree is not one sequence at all: the substrate refuses it
    // before this engine sees a node. The refusal is kept because "the substrate
    // always agrees" is a claim about a pre-1.0 dependency (`PROGRESS.md`, R1),
    // and a named refusal is cheaper than the guess it replaces.
    let source = "matches:\n  - trigger: a\n  - trigger: b\n    - trigger: c\n";
    let fields = vec![field("trigger", "x")];
    let error =
        insert_item(source, &sequence(), ItemPlacement::End, &fields).expect_err("must refuse");
    assert!(
        matches!(error, EditError::SourceDoesNotParse(_)),
        "{error:?}"
    );
} // End of function a_sequence_cannot_disagree_with_itself_about_its_dash_column()

#[test]
fn a_standalone_comment_under_a_bare_key_makes_the_promotion_ambiguous() {
    let source = "matches:\n  # whose comment is this?\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    let error =
        insert_item(source, &sequence(), ItemPlacement::End, &fields).expect_err("must refuse");
    assert!(
        matches!(
            error,
            EditError::ImplicitNullSequenceHasAmbiguousTrivia { edit: 0, .. }
        ),
        "{error:?}"
    );
} // End of function a_standalone_comment_under_a_bare_key_makes_the_promotion_ambiguous()

#[test]
fn a_comment_a_blank_line_below_a_bare_key_is_not_ambiguous() {
    // Rule 2 gives it to the file, and the file keeps it wherever the item lands.
    let source = "matches:\n\n# the file's own note\n\nother: 1\n";
    let fields = vec![field("trigger", "x")];
    let inserted = insert_item(source, &sequence(), ItemPlacement::End, &fields)
        .expect("the insert must apply");
    assert_eq!(
        inserted.text(),
        "matches:\n  - trigger: x\n\n# the file's own note\n\nother: 1\n"
    );
} // End of function a_comment_a_blank_line_below_a_bare_key_is_not_ambiguous()

#[test]
fn a_path_that_names_no_sequence_is_refused() {
    let source = "matches: a scalar\n";
    let fields = vec![field("trigger", "x")];
    let error =
        insert_item(source, &sequence(), ItemPlacement::End, &fields).expect_err("must refuse");
    assert!(
        matches!(error, EditError::NotASequence { edit: 0, .. }),
        "{error:?}"
    );
} // End of function a_path_that_names_no_sequence_is_refused()

#[test]
fn an_anchor_index_the_sequence_does_not_have_is_refused() {
    let fields = vec![field("trigger", "x")];
    let error =
        insert_item(TIGHT, &sequence(), ItemPlacement::After(9), &fields).expect_err("must refuse");
    assert!(
        matches!(
            error,
            EditError::NoSuchDestinationItem {
                edit: 0,
                items: 3,
                ..
            }
        ),
        "{error:?}"
    );
} // End of function an_anchor_index_the_sequence_does_not_have_is_refused()

#[test]
fn removing_the_only_item_of_a_sequence_is_refused_by_name() {
    let source = "matches:\n  - trigger: a\n";
    let error = remove_item(source, &item(0)).expect_err("must refuse");
    assert!(
        matches!(
            error,
            EditError::RemovalWouldEmptyTheSequence { edit: 0, .. }
        ),
        "{error:?}"
    );
} // End of function removing_the_only_item_of_a_sequence_is_refused_by_name()

#[test]
fn a_batch_that_removes_every_item_is_refused_by_the_same_name() {
    let batch: Vec<DocumentEdit> = (0..3)
        .map(|at| DocumentEdit::RemoveItem(RemoveItem::new(item(at))))
        .collect();
    let error = apply_edits(TIGHT, &batch).expect_err("must refuse");
    assert!(
        matches!(error, EditError::RemovalWouldEmptyTheSequence { .. }),
        "{error:?}"
    );
} // End of function a_batch_that_removes_every_item_is_refused_by_the_same_name()

#[test]
fn a_path_that_names_a_mapping_entry_is_not_a_sequence_item() {
    let source = "matches:\n  - trigger: a\n  - trigger: b\n";
    let path = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("trigger");
    let error = remove_item(source, &path).expect_err("must refuse");
    assert!(
        matches!(error, EditError::NotASequenceItem { edit: 0, .. }),
        "{error:?}"
    );
} // End of function a_path_that_names_a_mapping_entry_is_not_a_sequence_item()

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

#[test]
fn two_removals_from_one_sequence_take_both_items_and_nothing_else() {
    let batch = vec![
        DocumentEdit::RemoveItem(RemoveItem::new(item(0))),
        DocumentEdit::RemoveItem(RemoveItem::new(item(2))),
    ];
    let removed = apply_edits(TIGHT, &batch).expect("the batch must apply");
    assert_eq!(removed.text(), "matches:\n  - trigger: b\n");
    bytes_outside_the_replacements_match(TIGHT, removed.text(), removed.replacements());
} // End of function two_removals_from_one_sequence_take_both_items_and_nothing_else()

#[test]
fn an_insert_and_a_removal_in_one_batch_land_where_the_bytes_say() {
    // The insert is anchored after item 1 and item 1 is itself removed, so the
    // new item takes the place item 1 held. That is the fold's replay of the batch
    // and the splice's own arithmetic agreeing, which is the only reason the fold
    // is written as one pass over the original positions.
    let batch = vec![
        DocumentEdit::InsertItem(InsertItem::after(
            sequence(),
            1,
            vec![field("trigger", "x")],
        )),
        DocumentEdit::RemoveItem(RemoveItem::new(item(1))),
    ];
    let patched = apply_edits(TIGHT, &batch).expect("the batch must apply");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: a\n  - trigger: x\n  - trigger: c\n"
    );
} // End of function an_insert_and_a_removal_in_one_batch_land_where_the_bytes_say()

#[test]
fn inserting_at_the_start_of_a_removed_item_is_an_overlap() {
    // Anchoring after item 0 puts the insertion point at the first byte of item
    // 1's removal run, and a zero-width span sharing a start with a deletion has
    // no answer: the new text could land before or after the deleted region, and
    // the order of the batch would decide. `apply_edits` has rejected two spans
    // that share a start since Phase 0c-3a, and this is that rule reaching the
    // sequence primitives.
    let batch = vec![
        DocumentEdit::InsertItem(InsertItem::after(
            sequence(),
            0,
            vec![field("trigger", "x")],
        )),
        DocumentEdit::RemoveItem(RemoveItem::new(item(1))),
    ];
    let error = apply_edits(TIGHT, &batch).expect_err("must refuse");
    assert!(
        matches!(error, EditError::OverlappingEdits { .. }),
        "{error:?}"
    );
} // End of function inserting_at_the_start_of_a_removed_item_is_an_overlap()

#[test]
fn a_move_may_not_share_its_batch_with_a_sequence_item_edit() {
    let batch = vec![
        DocumentEdit::MoveItem(espansoconfig_core::patch::ItemMove::to_front(item(2))),
        DocumentEdit::RemoveItem(RemoveItem::new(item(0))),
    ];
    let error = apply_edits(TIGHT, &batch).expect_err("must refuse");
    assert!(
        matches!(error, EditError::MoveMustBeTheOnlyEditInItsBatch { .. }),
        "{error:?}"
    );
} // End of function a_move_may_not_share_its_batch_with_a_sequence_item_edit()

// ---------------------------------------------------------------------------
// The shapes a removal inherits from a mapping entry's
// ---------------------------------------------------------------------------

#[test]
fn an_item_sharing_its_line_with_the_sequences_own_punctuation_is_refused() {
    // A nested compact item: the inner sequence's first item shares its line with
    // the outer dash, so it owns no whole line of its own.
    let source = "matches:\n  - - trigger: a\n    - trigger: b\n  - trigger: c\n";
    let path = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_index(0);
    let error = remove_item(source, &path).expect_err("must refuse");
    assert!(
        matches!(error, EditError::EntryDoesNotOwnItsLines { edit: 0, .. }),
        "{error:?}"
    );
} // End of function an_item_sharing_its_line_with_the_sequences_own_punctuation_is_refused()

#[test]
fn a_removal_that_would_feed_a_block_scalar_is_refused_at_the_source_close() {
    // The comment belongs to item `c` by rule 1, so it is not in `b`'s envelope —
    // and it sits at the block's own body column, so deleting `b` would put it
    // directly under `body` and lengthen a value nobody edited.
    let source = "matches:\n  - replace: |\n      body\n  - trigger: b\n      \
                  # a comment for c\n  - trigger: c\n";
    let error = remove_item(source, &item(1)).expect_err("must refuse");
    assert!(
        matches!(
            error,
            EditError::RemovalWouldExtendABlockScalar { edit: 0, .. }
        ),
        "{error:?}"
    );
    // The same document, the same item, refused by the move at the seam it names.
    let refused = move_item(source, &item(1), None).expect_err("the move must refuse too");
    assert!(
        matches!(
            refused,
            EditError::MoveWouldExtendABlockScalar {
                edit: 0,
                seam: espansoconfig_core::patch::MoveSeam::SourceCloses,
                ..
            }
        ),
        "{refused:?}"
    );
} // End of function a_removal_that_would_feed_a_block_scalar_is_refused_at_the_source_close()

/// A `PatchedDocument` is only ever built by a verified edit, so holding one is
/// the whole assertion; this exists so the import is not merely decorative.
#[test]
fn every_applied_edit_hands_back_a_verified_document() {
    let removed: PatchedDocument = remove_item(TIGHT, &item(1)).expect("the removal must apply");
    assert!(removed.notes().is_empty(), "a removal renders nothing");
    let inserted = insert_item(
        TIGHT,
        &sequence(),
        ItemPlacement::End,
        &[field("trigger", "d")],
    )
    .expect("the insert must apply");
    assert!(
        inserted.notes().is_empty(),
        "a new item has no previous presentation to change"
    );
} // End of function every_applied_edit_hands_back_a_verified_document()
