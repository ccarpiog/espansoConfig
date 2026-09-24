//! Phase 3-7 acceptance: the local raw-item core edit.
//!
//! One snippet's owned physical-line range is cut out in Rust
//! ([`item_owned_text`]) and replaced by exact text
//! ([`ItemTextReplacement`]) as a `DocumentEdit`, through the one engine every
//! other locality-preserving edit goes through. The step's acceptance clauses
//! (`docs/decisions/3-split-notes.md` §2, step 3-7), and the test that pins each:
//!
//! | Clause | Test |
//! |---|---|
//! | zero items in the result is refused | `a_text_with_no_item_is_refused` |
//! | two items in the result is refused | `a_text_with_two_items_is_refused` |
//! | escaped indentation is refused | `a_line_left_of_the_dash_column_is_refused_before_planning`, `a_trailing_line_the_item_does_not_own_is_refused` |
//! | a changed sibling is refused | `a_text_that_changes_a_construct_outside_the_item_is_refused`, `the_text_may_not_merge_with_the_next_line` |
//! | a result that does not parse is refused | `a_text_that_does_not_parse_is_refused_by_verification` |
//! | an owned range with holes is refused | `a_range_with_a_file_owned_hole_is_refused_on_the_read_and_the_edit` |
//! | the BOM and every byte outside the range survive | `the_bom_and_every_byte_outside_the_range_survive`, `every_readable_item_of_the_corpus_round_trips_byte_for_byte` |
//! | both block-scalar seams are checked | `the_opening_seam_refuses_a_line_a_block_above_would_absorb`, `the_closing_seam_refuses_a_block_that_swallows_the_line_below` |
//! | an unknown entry inside may change, those outside survive | `an_unknown_entry_inside_the_range_may_change_and_those_outside_survive` |
//! | a `\r` in the owned text is refused | `a_carriage_return_in_the_range_or_the_text_is_refused`, `a_carriage_return_elsewhere_does_not_refuse_an_lf_only_item` |
//!
//! The stale-identity clause is the save transaction's and the command layer's:
//! `tests/persist_raw_item.rs` and `src-tauri/src/commands.rs`.
//!
//! # Privacy
//!
//! The one test that reads the real corpus prints file names and counts only,
//! and skips cleanly when the corpus is absent (`CLAUDE.md` section 1).

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::patch::{
    apply_edits, item_owned_text, replace_item_text, DocumentEdit, DocumentPath, EditError,
    ItemTextReplacement, PatchedDocument, RemoveItem, VerificationFailure,
};
use espansoconfig_core::SyntaxIndex;

// ---------------------------------------------------------------------------
// The documents
// ---------------------------------------------------------------------------

/// Three items, nothing between them.
const TIGHT: &str = "matches:\n  - trigger: a\n  - trigger: b\n  - trigger: c\n";

/// Three items, each with a leading comment block it owns.
const OWNED_COMMENTS: &str = "matches:\n  # about a\n  - trigger: a\n  # about b\n  \
                              - trigger: b\n  # about c\n  - trigger: c\n";

/// A compact sequence — dashes at column zero — beside another root key.
const COMPACT: &str = "matches:\n- trigger: a\n- trigger: b\nother: 1\n";

/// Unknown entries inside and outside the item that is edited.
const UNKNOWNS: &str = "matches:\n  - trigger: a\n    mystery: 1\n  - trigger: b\n    \
                        other_unknown: [x, y]\nextra_top: z\n";

/// The path of the `index`-th item of the root mapping's `matches` sequence.
///
/// @param index - Zero-based position in the sequence.
/// @returns The item's own path.
fn item(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// Replaces item `index` of `source` with `text`.
fn replace(source: &str, index: usize, text: &str) -> Result<PatchedDocument, EditError> {
    replace_item_text(source, &item(index), text)
}

/// The fixture called `name` from the synthetic corpus.
fn fixture(name: &str) -> CorpusFile {
    synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with(name))
        .unwrap_or_else(|| panic!("the synthetic corpus holds {name}"))
}

/// How many items the root `matches` sequence of `source` holds, when it has
/// one.
fn matches_items(source: &str) -> usize {
    let index = SyntaxIndex::parse(source).expect("the fixture parses");
    espansoconfig_core::patch::resolve(&index, &DocumentPath::root(0).with_key("matches"))
        .ok()
        .and_then(|id| index.node(id))
        .filter(|node| node.kind == espansoconfig_core::NodeKind::Sequence)
        .map_or(0, |node| node.children.len())
}

/// Checks, independently of the engine, that `candidate` is `source` with the
/// range `range` replaced by `text` and nothing else changed.
///
/// The range is found by locating the read text in the source: `read` must
/// occur at exactly one offset, which every fixture this is called on satisfies.
fn assert_only_the_range_changed(source: &str, read: &str, text: &str, candidate: &str) {
    let at = source
        .find(read)
        .expect("the read text is a slice of the source");
    assert_eq!(
        source.matches(read).count(),
        1,
        "the read text occurs once in the source"
    );
    assert_eq!(
        &candidate[..at],
        &source[..at],
        "the bytes before the range"
    );
    assert_eq!(&candidate[at..at + text.len()], text, "the written text");
    assert_eq!(
        &candidate[at + text.len()..],
        &source[at + read.len()..],
        "the bytes after the range"
    );
} // End of function assert_only_the_range_changed()

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

#[test]
fn the_read_cuts_the_owned_range_with_its_leading_comments_and_terminator() {
    let read = item_owned_text(OWNED_COMMENTS, &item(1)).expect("item 1 is readable");
    assert_eq!(read.text, "  # about b\n  - trigger: b\n");
    assert_eq!(read.first_line, 4);
    assert_eq!(read.line_count, 2);

    let read = item_owned_text(TIGHT, &item(2)).expect("item 2 is readable");
    assert_eq!(read.text, "  - trigger: c\n");
    assert_eq!((read.first_line, read.line_count), (4, 1));
}

#[test]
fn the_read_and_the_edit_refuse_what_the_move_gate_refuses() {
    // A flow sequence of matches is not a block sequence item.
    let flow = "matches: [{trigger: a}, {trigger: b}]\n";
    assert!(matches!(
        item_owned_text(flow, &item(0)),
        Err(EditError::FlowCollection { edit: 0, .. })
    ));
    assert!(matches!(
        replace(flow, 0, "{trigger: a}"),
        Err(EditError::FlowCollection { edit: 0, .. })
    ));
    // A hazard anywhere in the sequence refuses every item of it.
    let anchored = "matches:\n  - trigger: a\n    replace: &x A\n  - trigger: b\n";
    assert!(matches!(
        item_owned_text(anchored, &item(1)),
        Err(EditError::Refused { edit: 0, .. })
    ));
    // An index the sequence does not have names nothing.
    assert!(matches!(
        item_owned_text(TIGHT, &item(7)),
        Err(EditError::Unresolvable { edit: 0, .. })
    ));
}

// ---------------------------------------------------------------------------
// Successes, byte for byte
// ---------------------------------------------------------------------------

#[test]
fn a_replacement_writes_exactly_the_text_in_exactly_the_range() {
    let text = "  - trigger: b\n    replace: B\n";
    let patched = replace(TIGHT, 1, text).expect("the replacement applies");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: a\n  - trigger: b\n    replace: B\n  - trigger: c\n"
    );
    assert_only_the_range_changed(TIGHT, "  - trigger: b\n", text, patched.text());
    assert!(
        patched.notes().is_empty(),
        "a raw item edit discloses nothing"
    );

    // The leading comment block is the item's, so the text may rewrite it.
    let text = "  # a new note about b\n  - trigger: b\n";
    let patched = replace(OWNED_COMMENTS, 1, text).expect("the replacement applies");
    assert_only_the_range_changed(
        OWNED_COMMENTS,
        "  # about b\n  - trigger: b\n",
        text,
        patched.text(),
    );
}

#[test]
fn an_identical_text_changes_nothing() {
    for (source, index) in [(TIGHT, 0), (TIGHT, 2), (OWNED_COMMENTS, 1), (COMPACT, 1)] {
        let read = item_owned_text(source, &item(index)).expect("readable");
        let patched = replace(source, index, &read.text).expect("applies");
        assert_eq!(patched.text(), source);
    } // End of the loop over the identity cases
}

#[test]
fn the_bom_and_every_byte_outside_the_range_survive() {
    let file = fixture("bom-utf8.yml");
    assert!(file.has_bom(), "the fixture's premise");
    let read = item_owned_text(&file.source, &item(0)).expect("the first item is readable");
    let text = "  - trigger: :bom\n    replace: 'rewritten'\n";
    let patched = replace(&file.source, 0, text).expect("applies");
    assert!(patched.text().starts_with('\u{feff}'), "the BOM survives");
    assert_only_the_range_changed(&file.source, &read.text, text, patched.text());
}

#[test]
fn the_edit_is_alone_in_its_batch() {
    let edits = [
        DocumentEdit::ReplaceItemText(ItemTextReplacement::new(item(0), "  - trigger: a\n")),
        DocumentEdit::RemoveItem(RemoveItem::new(item(2))),
    ];
    assert!(matches!(
        apply_edits(TIGHT, &edits),
        Err(EditError::ItemTextMustBeTheOnlyEditInItsBatch { edit: 0, edits: 2 })
    ));
}

// ---------------------------------------------------------------------------
// The refusals the acceptance list names
// ---------------------------------------------------------------------------

#[test]
fn a_text_with_no_item_is_refused() {
    assert!(matches!(
        replace(TIGHT, 1, ""),
        Err(EditError::Verification(
            VerificationFailure::ItemTextIsNotOneItem {
                edit: 0,
                expected: 3,
                found: 2
            }
        ))
    ));
    assert!(matches!(
        replace(TIGHT, 1, "  # only a comment\n"),
        Err(EditError::Verification(
            VerificationFailure::ItemTextIsNotOneItem {
                expected: 3,
                found: 2,
                ..
            }
        ))
    ));
    // The only item, gone: the key is left with no sequence at all.
    assert!(matches!(
        replace("matches:\n  - trigger: a\n", 0, ""),
        Err(EditError::Verification(
            VerificationFailure::ItemTextIsNotOneItem {
                expected: 1,
                found: 0,
                ..
            }
        ))
    ));
}

#[test]
fn a_text_with_two_items_is_refused() {
    assert!(matches!(
        replace(TIGHT, 1, "  - trigger: b\n  - trigger: b2\n"),
        Err(EditError::Verification(
            VerificationFailure::ItemTextIsNotOneItem {
                edit: 0,
                expected: 3,
                found: 4
            }
        ))
    ));
}

#[test]
fn a_text_whose_item_is_not_a_mapping_is_refused() {
    assert!(matches!(
        replace(TIGHT, 1, "  - just a scalar\n"),
        Err(EditError::Verification(
            VerificationFailure::ItemTextIsNotAMapping { edit: 0, .. }
        ))
    ));
}

#[test]
fn a_line_left_of_the_dash_column_is_refused_before_planning() {
    assert!(matches!(
        replace(TIGHT, 1, "  - trigger: b\nx: 1\n"),
        Err(EditError::ItemTextEscapesItsIndentation { edit: 0, line: 1 })
    ));
    assert!(matches!(
        replace(TIGHT, 1, "  - trigger: b\n replace: B\n"),
        Err(EditError::ItemTextEscapesItsIndentation { edit: 0, line: 1 })
    ));
}

#[test]
fn a_trailing_line_the_item_does_not_own_is_refused() {
    // A blank line after the item is a separation between items, not the
    // item's own: the written text would hold a byte the item does not own.
    assert!(matches!(
        replace(TIGHT, 1, "  - trigger: b\n\n"),
        Err(EditError::Verification(
            VerificationFailure::ItemTextEscapesTheItem { edit: 0, .. }
        ))
    ));
}

#[test]
fn a_text_that_changes_a_construct_outside_the_item_is_refused() {
    // A compact sequence gives no column to escape past, so a root key written
    // into the text parses — and changes the root mapping, a sibling of
    // `matches`, which the lockstep walk sees.
    let refused = replace(COMPACT, 1, "- trigger: b\nextra: 2\n");
    assert!(
        matches!(
            refused,
            Err(EditError::Verification(
                VerificationFailure::ConstructChangedOutsideTheItemText { edit: 0, .. }
            ))
        ),
        "{refused:?}"
    );
}

#[test]
fn a_text_that_turns_the_sequence_into_a_flow_sequence_is_refused() {
    // The one item rewritten as a flow sequence holding one mapping keeps the
    // item count, the kinds and the values, so only the enclosing sequence's
    // collection style tells the two parses apart.
    let source = "matches:\n - trigger: ':one'\n   replace: first\n";
    let refused = replace(source, 0, " [{trigger: ':one', replace: first}]\n");
    assert!(
        matches!(
            refused,
            Err(EditError::Verification(
                VerificationFailure::ConstructChangedOutsideTheItemText { edit: 0, .. }
            ))
        ),
        "{refused:?}"
    );
}

#[test]
fn the_text_may_not_merge_with_the_next_line() {
    assert!(matches!(
        replace(TIGHT, 1, "  - trigger: b"),
        Err(EditError::ItemTextLosesItsFinalLineBreak { edit: 0 })
    ));
}

#[test]
fn a_text_that_does_not_parse_is_refused_by_verification() {
    let refused = replace(TIGHT, 1, "  - trigger: 'b\n");
    assert!(
        matches!(
            refused,
            Err(EditError::Verification(VerificationFailure::DoesNotParse(
                _
            )))
        ),
        "{refused:?}"
    );
}

#[test]
fn a_hazard_written_into_the_item_is_refused() {
    let refused = replace(TIGHT, 1, "  - trigger: b\n    replace: &x B\n");
    assert!(
        matches!(
            refused,
            Err(EditError::Verification(
                VerificationFailure::ItemTextIntroducesAHazard { edit: 0, .. }
            ))
        ),
        "{refused:?}"
    );
}

#[test]
fn a_range_with_a_file_owned_hole_is_refused_on_the_read_and_the_edit() {
    let file = fixture("run-based-removal-boundaries.yml");
    for index in 0..2 {
        assert!(
            matches!(
                item_owned_text(&file.source, &item(index)),
                Err(EditError::ItemRangeNotContiguous { edit: 0, .. })
            ),
            "item {index} of {} has a file-owned hole",
            file.name
        );
        assert!(matches!(
            replace(&file.source, index, "  - trigger: ':x'\n"),
            Err(EditError::ItemRangeNotContiguous { edit: 0, .. })
        ));
    } // End of the loop over the two holed items

    // The first item of the mixed-endings fixture holds a file-owned comment
    // inside its `vars` entry.
    let file = fixture("file-comments-and-mixed-endings.yml");
    assert!(matches!(
        item_owned_text(&file.source, &item(0)),
        Err(EditError::ItemRangeNotContiguous { edit: 0, .. })
    ));
}

#[test]
fn a_carriage_return_in_the_range_or_the_text_is_refused() {
    let file = fixture("crlf-line-endings.yml");
    let items = matches_items(&file.source);
    assert!(items > 0, "the fixture's premise");
    for index in 0..items {
        assert!(matches!(
            item_owned_text(&file.source, &item(index)),
            Err(EditError::ItemTextHoldsCarriageReturn { edit: 0 })
        ));
        assert!(matches!(
            replace(&file.source, index, "  - trigger: :x\n"),
            Err(EditError::ItemTextHoldsCarriageReturn { edit: 0 })
        ));
    } // End of the loop over the CRLF fixture's items

    // The CRLF item of the mixed fixture.
    let file = fixture("file-comments-and-mixed-endings.yml");
    assert!(matches!(
        item_owned_text(&file.source, &item(1)),
        Err(EditError::ItemTextHoldsCarriageReturn { edit: 0 })
    ));

    // An LF-only range, and a replacement holding a `\r`.
    assert!(matches!(
        replace(TIGHT, 1, "  - trigger: b\r\n"),
        Err(EditError::ItemTextHoldsCarriageReturn { edit: 0 })
    ));
}

#[test]
fn a_carriage_return_elsewhere_does_not_refuse_an_lf_only_item() {
    let file = fixture("file-comments-and-mixed-endings.yml");
    assert!(file.source.contains('\r'), "the fixture's premise");
    let read = item_owned_text(&file.source, &item(2)).expect("the last item is LF-only");
    assert!(!read.text.contains('\r'));
    assert!(
        !read.text.ends_with('\n'),
        "the last item ends the file with no break"
    );
    // At an unterminated end of file the text may stay unterminated.
    let text = "  - trigger: ':ends-the-file'\n    replace: 'still nothing terminates this'";
    let patched = replace(&file.source, 2, text).expect("applies");
    assert_only_the_range_changed(&file.source, &read.text, text, patched.text());
    assert!(!patched.text().ends_with('\n'));
}

#[test]
fn the_opening_seam_refuses_a_line_a_block_above_would_absorb() {
    let file = fixture("move-block-scalar-seams.yml");
    // Item 1 sits directly under item 0's `|` block, whose body is at column
    // five. A first line at column five would become that block's content.
    let refused = replace(
        &file.source,
        1,
        "     # deep enough to be absorbed\n  - trigger: ':between-a'\n    replace: 'x'\n",
    );
    assert!(
        matches!(
            refused,
            Err(EditError::ItemTextWouldExtendABlockScalar { edit: 0, .. })
        ),
        "{refused:?}"
    );
    // The same text with the comment at column two ends the block instead.
    let read = item_owned_text(&file.source, &item(1)).expect("readable");
    let text = "  # shallow enough to end the block\n  - trigger: ':between-a'\n    replace: 'x'\n";
    let patched = replace(&file.source, 1, text).expect("applies");
    assert_only_the_range_changed(&file.source, &read.text, text, patched.text());
}

#[test]
fn the_closing_seam_refuses_a_block_that_swallows_the_line_below() {
    let file = fixture("move-block-scalar-seams.yml");
    // Item 1 is followed by item 2's leading comment at column five. A block
    // ending the text with its body at column five would swallow it.
    let block = "  - trigger: ':between-a'\n    replace: |\n     a body at column five\n";
    let refused = replace(&file.source, 1, block);
    assert!(
        matches!(
            refused,
            Err(EditError::Verification(
                VerificationFailure::ItemTextExtendsPastItsRange { edit: 0, .. }
            ))
        ),
        "{refused:?}"
    );
    // Item 4 is followed by item 5's leading comment at column two, which ends
    // a block instead of joining it.
    let read = item_owned_text(&file.source, &item(4)).expect("readable");
    let text = "  - trigger: ':between-b'\n    replace: |\n     a body at column five\n";
    let patched = replace(&file.source, 4, text).expect("applies");
    assert_only_the_range_changed(&file.source, &read.text, text, patched.text());
}

#[test]
fn an_unknown_entry_inside_the_range_may_change_and_those_outside_survive() {
    let text = "  - trigger: a\n    mystery: 2\n    nested:\n      deep: [1, 2]\n";
    let patched = replace(UNKNOWNS, 0, text).expect("an unknown entry inside may change");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: a\n    mystery: 2\n    nested:\n      deep: [1, 2]\n  \
         - trigger: b\n    other_unknown: [x, y]\nextra_top: z\n"
    );
    // The other item's unknown entry and the root's are the same bytes and the
    // same values: the other item reads back exactly as it did.
    let before = item_owned_text(UNKNOWNS, &item(1)).expect("readable");
    let after = item_owned_text(patched.text(), &item(1)).expect("readable");
    assert_eq!(before.text, after.text);
    assert!(patched.text().ends_with("extra_top: z\n"));

    // Removing an unknown entry inside the range is equally the author's call.
    let patched = replace(UNKNOWNS, 0, "  - trigger: a\n").expect("applies");
    assert!(!patched.text().contains("mystery"));
    assert!(patched.text().contains("other_unknown: [x, y]"));
}

#[test]
fn an_ambiguous_plain_scalar_the_author_writes_is_not_charged() {
    // `yes` is a boolean to YAML 1.1 and a string to 1.2. An emitter must never
    // choose to write it plain; an author writing it inside the item may.
    let patched =
        replace(TIGHT, 1, "  - trigger: b\n    word: yes\n").expect("the author's text stands");
    assert!(patched.text().contains("word: yes"));
}

// ---------------------------------------------------------------------------
// Sweeps over the corpus
// ---------------------------------------------------------------------------

/// Every refusal a read of a committed fixture's item may legitimately give.
fn is_an_expected_read_refusal(error: &EditError) -> bool {
    matches!(
        error,
        EditError::ItemRangeNotContiguous { .. }
            | EditError::ItemTextHoldsCarriageReturn { .. }
            | EditError::Refused { .. }
            | EditError::FlowCollection { .. }
    )
}

/// Reads and round-trips every item of the root `matches` sequence of `file`,
/// returning `(readable, refused, landed)` — `landed` counts the prepended
/// comments that were written.
///
/// On every readable item, two properties: the identical text changes nothing,
/// and a comment line prepended at the dash column either lands byte-exactly
/// or is refused by a named refusal — never written anywhere else.
fn sweep(file: &CorpusFile) -> (usize, usize, usize) {
    let Ok(index) = SyntaxIndex::parse(&file.source) else {
        return (0, 0, 0);
    };
    let Ok(sequence) =
        espansoconfig_core::patch::resolve(&index, &DocumentPath::root(0).with_key("matches"))
    else {
        return (0, 0, 0);
    };
    let items = index
        .node(sequence)
        .filter(|node| node.kind == espansoconfig_core::NodeKind::Sequence)
        .map_or(0, |node| node.children.len());
    let (mut readable, mut refused, mut landed) = (0, 0, 0);
    for at in 0..items {
        let read = match item_owned_text(&file.source, &item(at)) {
            Ok(read) => read,
            Err(error) => {
                assert!(
                    is_an_expected_read_refusal(&error),
                    "{} item {at}: unexpected read refusal {error}",
                    file.name
                );
                refused += 1;
                continue;
            }
        };
        readable += 1;
        let identity = replace(&file.source, at, &read.text)
            .unwrap_or_else(|error| panic!("{} item {at}: identity refused: {error}", file.name));
        assert_eq!(
            identity.text(),
            file.source,
            "{} item {at}: the identical text changed the file",
            file.name
        );

        let indent: String = read
            .text
            .lines()
            .find(|line| {
                let body = line.trim_start();
                !body.is_empty() && !body.starts_with('#')
            })
            .map(|line| " ".repeat(line.len() - line.trim_start().len()))
            .unwrap_or_default();
        let text = format!("{indent}# a note added by the sweep\n{}", read.text);
        match replace(&file.source, at, &text) {
            Ok(patched) => {
                assert_only_the_range_changed(&file.source, &read.text, &text, patched.text());
                landed += 1;
            }
            Err(EditError::ItemTextWouldExtendABlockScalar { .. })
            | Err(EditError::Verification(
                VerificationFailure::CommentOwnershipChanged { .. }
                | VerificationFailure::ItemTextEscapesTheItem { .. }
                | VerificationFailure::ItemTextExtendsPastItsRange { .. },
            )) => {}
            Err(error) => panic!("{} item {at}: prepended comment: {error}", file.name),
        }
    } // End of the loop over the sequence's items
    (readable, refused, landed)
} // End of function sweep()

#[test]
fn every_readable_item_of_the_corpus_round_trips_byte_for_byte() {
    let (mut readable, mut refused, mut landed) = (0, 0, 0);
    for file in synthetic_valid() {
        let (ok, no, written) = sweep(&file);
        readable += ok;
        refused += no;
        landed += written;
    } // End of the loop over the synthetic corpus
    assert!(
        readable >= 40,
        "the sweep reads a meaningful number of items: {readable}"
    );
    assert!(refused > 0, "the sweep meets refusals too: {refused}");
    assert!(
        landed * 2 >= readable,
        "most prepended comments land: {landed} of {readable}"
    );
    println!(
        "synthetic sweep: {readable} items readable, {refused} refused by name, \
         {landed} prepended comments landed"
    );
}

#[test]
fn every_readable_item_of_the_real_corpus_round_trips_byte_for_byte() {
    let files = real_corpus();
    if skip_without_real_corpus("every_readable_item_of_the_real_corpus_round_trips", &files) {
        return;
    }
    let (mut readable, mut refused, mut landed) = (0, 0, 0);
    for file in &files {
        let (ok, no, written) = sweep(file);
        readable += ok;
        refused += no;
        landed += written;
    } // End of the loop over the real corpus
    println!(
        "real sweep: {} files, {readable} items readable, {refused} refused by name, \
         {landed} prepended comments landed",
        files.len()
    );
}
