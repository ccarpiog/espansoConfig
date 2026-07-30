//! Phase 0b-2 acceptance tests: gap classification and trivia attribution.
//!
//! Phase 0b-1 proved that the frontier and its gaps reconstruct a file byte for
//! byte, but a gap was an opaque byte range: the property held for *any*
//! ordered, disjoint frontier. These tests strengthen it into something that
//! cannot hold by accident:
//!
//! 1. **Total classification** — every byte of every gap belongs to exactly one
//!    typed trivia item, the items tile each gap contiguously, and concatenating
//!    frontier leaves and trivia items reproduces the file byte for byte.
//!    Unclassified bytes are a permitted *category*, never a silent omission,
//!    and their count is pinned so it cannot drift.
//! 2. **The four ownership rules** of `IMPLEMENTATION_PLAN.md` section 6.2, each
//!    with its own test, including the load-bearing file-header rule.
//! 3. **The ambiguous cases** the Phase 0b-1 review flagged — a zero-width
//!    value, a bare `- ` item, a compact `- key: value`, an explicit `? key` /
//!    `: value`, and a comment inside a flow collection — each with a
//!    documented, deterministic policy and a test that pins it.
//! 4. **Move and delete envelopes**, added after the Phase 0b-2 review: direct
//!    ownership strands a descendant-owned comment, so the subtree queries are
//!    the envelope and the stranding case itself is pinned.
//! 5. **The hazard set**, likewise: anchors, aliases, merge keys, duplicate
//!    keys, explicit tags and multi-document streams are each refused, because
//!    plan section 7 (rows 6–8, 13) and section 13 say they must be.
//! 6. **Classification and ownership goldens.** Reconstruction is not a
//!    semantic oracle — a comment mislabelled as a tag, or a colon attributed
//!    to the wrong node, satisfies every tiling assertion. So every documented
//!    token spelling has an exact `(span, kind)` golden, ownership has exact
//!    `(span, owner, rule)` goldens, and two corpus-wide tests re-derive both
//!    from the source text independently of the scanner's own reasoning.
//!
//! Counts over the committed synthetic corpus are asserted **exactly**, per the
//! Phase 0b-1 convention. Nothing about the owner's private real corpus is
//! pinned: it is per-machine and absent in CI, so what is asserted there is that
//! every discovered file is processed with zero failures. No test in this file
//! ever prints a line of real-configuration content.

mod common;

use espansoconfig_core::syntax::{
    CollectionStyle, CommentAttachment, CommentOwner, HazardKind, NodeKind, NodeRole,
    OwnershipRule, Punctuation, SyntaxIndex, TriviaIndex, TriviaKind,
};
use espansoconfig_core::ByteSpan;

// ===========================================================================
// Pinned corpus measurements
// ===========================================================================
//
// Exact, not `>=`: the synthetic corpus is committed and stable, so a fixture
// appearing or disappearing has to be a deliberate act that updates these
// constants rather than something a comparison quietly absorbs.

/// Valid fixtures in `corpus/synthetic/`. Must agree with `syntax_index.rs`.
const SYNTHETIC_FIXTURES: usize = 23;

/// Trivia items across the valid synthetic corpus.
const SYNTHETIC_TRIVIA_ITEMS: usize = 2742;

/// Comments the scanner finds in the gaps of the valid synthetic corpus.
///
/// Four more than the 201 `syntax_index.rs` pins from its per-gap line scan, and
/// the difference is the point of this phase: that scan trims a whole gap line
/// and asks whether it starts with `#`, so an inline comment sharing its line
/// with structural punctuation — `matches: # …` — is invisible to it. The
/// scanner classifies by token, so it sees both.
///
/// The Phase 0c-2b fix round's `block-scalar-header-tails.yml` widened the gap
/// from two to four, and that is the cross-check that its comments were counted
/// correctly: the fixture carries 6 whole-line comments, which **both** counts
/// see, and 2 comments sharing a block-scalar header line, which only this one
/// does. So the line scan gained 6 and the scanner gained 8.
const SYNTHETIC_COMMENTS: usize = 205;

/// Blank lines — whole physical lines holding nothing but spaces and tabs.
///
/// Far below the 688 `syntax_index.rs` pins, and again deliberately: that count
/// treats every line of a gap as blank when it trims to nothing, so the line
/// break that merely *terminates* a content line is counted as a blank line of
/// its own. Here a line break is a `LineBreak` item and only a line that lies
/// wholly inside a gap and holds nothing can be blank.
const SYNTHETIC_BLANK_LINES: usize = 96;

/// Maximal runs of consecutive blank lines.
const SYNTHETIC_BLANK_RUNS: usize = 92;

/// Bytes the scanner could not name. **Zero, and pinned at zero**: the whole
/// point of the category is that it stays empty and says so loudly if it does
/// not.
const SYNTHETIC_UNCLASSIFIED: usize = 0;

/// Constructs flagged as unsafe to edit visually.
///
/// **Was 1, is now 18.** The old figure counted only the comment inside the
/// multi-line flow sequence of `flow-collections.yml`, which was the review's
/// evidence that the gate was not pessimistic: the corpus contains three
/// fixtures full of constructs plan section 7 (rows 7 and 8) and section 13 say
/// must be refused, and none of them was flagged. The new figure is the sum of
/// [`HAZARDS_BY_KIND`], each entry of which is asserted separately, so a drift
/// in any single family cannot hide inside the total.
const SYNTHETIC_HAZARDS: usize = 18;

/// Every hazard kind and how many times the valid synthetic corpus raises it.
///
/// Pinned individually, and the list is exhaustive over [`HazardKind`], so a
/// new variant cannot be added without deciding what the corpus says about it.
///
/// | Kind | Where it comes from |
/// |---|---|
/// | `CommentInFlowCollection` | the multi-line flow sequence in `flow-collections.yml` |
/// | `AnchorDefinition` | `&shared_defaults`, `&clipboard_var`, `&greeting` |
/// | `AliasReference` | the five `*name` references in the same fixture |
/// | `MergeKey` | its two `<<:` entries |
/// | `ExplicitTag` | its two `!!str` values |
/// | `DuplicateMappingKey` | the repeated `replace` and `label` of `duplicate-keys.yml` |
/// | `MultiDocumentStream` | the three documents of `multi-document.yml` |
/// | `ExplicitKeyMapping`, `TruncatedBlockScalarHeader`, `UnclassifiedTrivia` | nothing valid — they need the explicit `?` form, incomplete input, or bytes we cannot name |
const HAZARDS_BY_KIND: [(HazardKind, usize); 10] = [
    (HazardKind::CommentInFlowCollection, 1),
    (HazardKind::ExplicitKeyMapping, 0),
    (HazardKind::TruncatedBlockScalarHeader, 0),
    (HazardKind::UnclassifiedTrivia, 0),
    (HazardKind::AnchorDefinition, 3),
    (HazardKind::AliasReference, 5),
    (HazardKind::MergeKey, 2),
    (HazardKind::DuplicateMappingKey, 2),
    (HazardKind::ExplicitTag, 2),
    (HazardKind::MultiDocumentStream, 3),
];

// ===========================================================================
// 1. Total classification — the strengthened reconstruction property
// ===========================================================================

#[test]
fn frontier_leaves_and_trivia_items_reconstruct_every_synthetic_fixture_byte_for_byte() {
    println!("\n--- trivia tiling over the valid synthetic corpus ---");
    println!(
        "{:<44} {:>6} {:>6} {:>5} {:>5} {:>5}",
        "fixture", "bytes", "items", "cmt", "blank", "uncl"
    );

    let mut tiled = 0usize;
    let mut items = 0usize;
    let mut comments = 0usize;
    let mut blank_lines = 0usize;
    let mut blank_runs = 0usize;
    let mut unclassified = 0usize;
    let mut hazards = 0usize;

    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
        let trivia = TriviaIndex::scan(&file.source, &index);
        assert_tiles(&file.name, &file.source, &index, &trivia);

        println!(
            "{:<44} {:>6} {:>6} {:>5} {:>5} {:>5}",
            file.name,
            file.source.len(),
            trivia.items().len(),
            trivia.count(TriviaKind::Comment),
            trivia.count(TriviaKind::BlankLine),
            trivia.unclassified().count(),
        );
        items += trivia.items().len();
        comments += trivia.count(TriviaKind::Comment);
        blank_lines += trivia.count(TriviaKind::BlankLine);
        blank_runs += trivia.blank_runs().len();
        unclassified += trivia.unclassified().count();
        hazards += trivia.hazards().len();
        tiled += 1;
    } // End of the loop over the valid synthetic fixtures

    println!("fixtures tiled byte-for-byte: {tiled}");
    println!("items {items}  comments {comments}  blank lines {blank_lines} in {blank_runs} runs");
    println!("unclassified spans {unclassified}  hazards {hazards}");
    assert_eq!(tiled, SYNTHETIC_FIXTURES, "every valid fixture is covered");
    assert_eq!(items, SYNTHETIC_TRIVIA_ITEMS, "trivia items in the corpus");
    assert_eq!(comments, SYNTHETIC_COMMENTS, "comments in the corpus");
    assert_eq!(
        blank_lines, SYNTHETIC_BLANK_LINES,
        "blank lines in the corpus"
    );
    assert_eq!(
        blank_runs, SYNTHETIC_BLANK_RUNS,
        "blank-line runs in the corpus"
    );
    // The number is asserted, not merely reported, so it cannot drift silently.
    assert_eq!(
        unclassified, SYNTHETIC_UNCLASSIFIED,
        "unclassified spans in the corpus"
    );
    assert_eq!(hazards, SYNTHETIC_HAZARDS, "hazards in the corpus");
} // End of function frontier_leaves_and_trivia_items_reconstruct_every_synthetic_fixture_byte_for_byte()

#[test]
fn every_hazard_family_is_counted_separately_over_the_synthetic_corpus() {
    // The aggregate above cannot tell two opposing drifts apart. This one can:
    // each family is pinned on its own, and the families must add up to the
    // aggregate, so neither number can be "fixed" without the other noticing.
    let mut found: Vec<(HazardKind, usize)> = HAZARDS_BY_KIND
        .iter()
        .map(|(kind, _)| (*kind, 0usize))
        .collect();
    for file in common::synthetic_valid() {
        let (_, trivia) = scan(&file.source);
        for hazard in trivia.hazards() {
            let entry = found
                .iter_mut()
                .find(|(kind, _)| *kind == hazard.kind)
                .unwrap_or_else(|| panic!("{:?} is missing from HAZARDS_BY_KIND", hazard.kind));
            entry.1 += 1;
        } // End of the loop over one fixture's hazards
    } // End of the loop over the valid synthetic corpus

    println!("\n--- hazards by kind over the valid synthetic corpus ---");
    for (kind, count) in &found {
        println!("{kind:<32?} {count}", kind = kind, count = count);
    }
    assert_eq!(found, HAZARDS_BY_KIND.to_vec(), "hazards by kind");
    assert_eq!(
        found.iter().map(|(_, count)| count).sum::<usize>(),
        SYNTHETIC_HAZARDS,
        "the families must add up to the pinned aggregate"
    );
} // End of function every_hazard_family_is_counted_separately_over_the_synthetic_corpus()

#[test]
fn frontier_leaves_and_trivia_items_reconstruct_the_real_corpus_byte_for_byte() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "frontier_leaves_and_trivia_items_reconstruct_the_real_corpus_byte_for_byte",
        &files,
    ) {
        return;
    }

    let mut processed = 0usize;
    let mut items = 0usize;
    let mut comments = 0usize;
    let mut unclassified = 0usize;
    for file in &files {
        let index = SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
        let trivia = TriviaIndex::scan(&file.source, &index);
        assert_tiles(&file.name, &file.source, &index, &trivia);
        items += trivia.items().len();
        comments += trivia.count(TriviaKind::Comment);
        unclassified += trivia.unclassified().count();
        processed += 1;
    } // End of the loop over the real corpus

    // Aggregates only, and never a slice of the owner's configuration.
    println!(
        "real corpus: {processed} files tiled byte-for-byte ({items} items, {comments} comments, {unclassified} unclassified)"
    );
    // No count from private data is hard-coded. What is pinned is that every
    // discovered file was processed and that nothing resisted classification.
    assert_eq!(processed, files.len(), "every discovered file is processed");
    assert_eq!(
        unclassified, 0,
        "no byte of the real corpus may resist classification"
    );
} // End of function frontier_leaves_and_trivia_items_reconstruct_the_real_corpus_byte_for_byte()

#[test]
fn the_awkward_fixtures_tile_exactly_too() {
    // The three fixtures no editor may "fix". A BOM is trivia of its own, a
    // CRLF break is one two-byte item and not two, and a file that ends without
    // a newline must not grow one.
    let bom = fixture("bom-utf8.yml");
    let index = SyntaxIndex::parse(&bom.source).expect("parses");
    let trivia = TriviaIndex::scan(&bom.source, &index);
    assert_eq!(trivia.items()[0].kind, TriviaKind::Bom);
    assert_eq!(trivia.items()[0].span, ByteSpan::new(0, 3));
    assert_tiles(&bom.name, &bom.source, &index, &trivia);

    let crlf = fixture("crlf-line-endings.yml");
    let index = SyntaxIndex::parse(&crlf.source).expect("parses");
    let trivia = TriviaIndex::scan(&crlf.source, &index);
    let breaks = trivia
        .items()
        .iter()
        .filter(|item| matches!(item.kind, TriviaKind::LineBreak | TriviaKind::BlankLine))
        .filter(|item| {
            item.span
                .slice(&crlf.source)
                .is_some_and(|t| t.contains('\r'))
        })
        .count();
    println!("\ncrlf-line-endings.yml: {breaks} items carry a CR");
    assert!(breaks > 0, "the fixture must exercise CRLF");
    for item in trivia.items() {
        let text = item.span.slice(&crlf.source).expect("slices");
        assert!(
            !(text.ends_with('\r') && item.span.end < crlf.source.len()),
            "a CRLF pair must never be split across two items: {item:?}"
        );
    } // End of the loop over the CRLF fixture's items
    assert_tiles(&crlf.name, &crlf.source, &index, &trivia);

    let bare = fixture("no-trailing-newline.yml");
    let index = SyntaxIndex::parse(&bare.source).expect("parses");
    let trivia = TriviaIndex::scan(&bare.source, &index);
    assert!(!rebuild(&bare.source, &index, &trivia).ends_with('\n'));
    assert_tiles(&bare.name, &bare.source, &index, &trivia);
} // End of function the_awkward_fixtures_tile_exactly_too()

#[test]
fn truncating_a_fixture_at_every_character_never_panics_and_always_tiles() {
    // A desktop editor sees YAML mid-keystroke on every character typed, and the
    // scanner runs on every one of those states. It must never panic and must
    // always tile, including on the half-written comments, headers and anchors a
    // truncation produces.
    let mut prefixes = 0usize;
    let mut tiled = 0usize;
    let mut unclassified = 0usize;

    for name in [
        "comments-everywhere.yml",
        "anchors-aliases-tags-merge.yml",
        "flow-collections.yml",
    ] {
        let file = fixture(name);
        for (cut, _) in file
            .source
            .char_indices()
            .chain(std::iter::once((file.source.len(), ' ')))
        {
            let prefix = &file.source[..cut];
            prefixes += 1;
            if let Ok(index) = SyntaxIndex::parse(prefix) {
                let trivia = TriviaIndex::scan(prefix, &index);
                assert_tiles(name, prefix, &index, &trivia);
                unclassified += trivia.unclassified().count();
                tiled += 1;
            }
        } // End of the loop over the prefixes of one fixture
    } // End of the loop over the swept fixtures

    println!("\n--- truncation sweep over the trivia scanner ---");
    println!("prefixes {prefixes}  parsed and tiled {tiled}  unclassified spans {unclassified}");
    assert!(prefixes > 3_000, "the sweep must be broad");
    assert!(tiled > 0);
    // Even half-written documents produce nothing the scanner cannot name.
    assert_eq!(unclassified, 0, "no prefix may produce unclassified bytes");
} // End of function truncating_a_fixture_at_every_character_never_panics_and_always_tiles()

// ===========================================================================
// 2. The four ownership rules of plan section 6.2
// ===========================================================================

#[test]
fn rule_one_contiguous_comments_above_an_item_belong_to_that_item() {
    // "Contiguous comments immediately above a sequence item, with no blank
    // line between, belong to that item."
    let source = "matches:\n  - trigger: :a\n\n  # one\n  # two\n  - trigger: :b\n";
    let (index, trivia) = scan(source);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 2);

    let second_item = index
        .nodes()
        .iter()
        .filter(|node| node.role == NodeRole::SequenceItem)
        .nth(1)
        .expect("a second sequence item");
    assert_eq!(second_item.span.slice(source), Some("trigger: :b"));

    for attachment in &attachments {
        assert_eq!(attachment.rule, OwnershipRule::LeadingBlock);
        assert_eq!(attachment.owner, CommentOwner::Node(second_item.id));
    }
    // Both comments are one block, so a move takes them together.
    assert_eq!(attachments[0].block, attachments[1].block);
    assert_eq!(attachments[0].block.slice(source), Some("# one\n  # two"));
    // The blank line *above* the block does not break the rule: what matters is
    // that nothing separates the block from the item below it.
    assert_eq!(trivia.count(TriviaKind::BlankLine), 1);
    assert_eq!(trivia.comments_owned_by(second_item.id).count(), 2);
} // End of function rule_one_contiguous_comments_above_an_item_belong_to_that_item()

#[test]
fn rule_two_a_comment_separated_by_a_blank_line_belongs_to_the_file() {
    // "A comment separated by one or more blank lines belongs to the file."
    let source = "matches:\n  - trigger: :a\n  # about nothing\n\n  - trigger: :b\n";
    let (index, trivia) = scan(source);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].rule, OwnershipRule::BlankLineSeparated);
    assert_eq!(
        attachments[0].owner,
        CommentOwner::File { document_index: 0 }
    );
    assert!(attachments[0].owner.is_file());
    // No node claims it, so reordering the matches leaves it exactly where it
    // is.
    for node in index.nodes() {
        assert_eq!(trivia.comments_owned_by(node.id).count(), 0);
    }

    // And removing the blank line hands the very same comment to the item.
    let joined = "matches:\n  - trigger: :a\n  # about nothing\n  - trigger: :b\n";
    let (_, trivia) = scan(joined);
    assert_eq!(comments_of(&trivia)[0].rule, OwnershipRule::LeadingBlock);
} // End of function rule_two_a_comment_separated_by_a_blank_line_belongs_to_the_file()

#[test]
fn rule_three_an_inline_comment_belongs_to_its_mapping_entry() {
    // "Inline comments belong to their mapping entry." The entry is identified
    // by the node the comment trails: the value when it follows a value, the
    // key when the value is on later lines.
    let source = "matches: # about the key\n  - trigger: :a # about the value\n";
    let (index, trivia) = scan(source);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 2);
    for attachment in &attachments {
        assert_eq!(attachment.rule, OwnershipRule::Inline);
    }

    let key = node_with_text(&index, source, "matches", NodeRole::MappingKey);
    let value = node_with_text(&index, source, ":a", NodeRole::MappingValue);
    assert_eq!(attachments[0].owner, CommentOwner::Node(key));
    assert_eq!(attachments[1].owner, CommentOwner::Node(value));
    // An inline comment is never part of a leading block: it trails content
    // rather than introducing anything.
    assert_ne!(attachments[0].block, attachments[1].block);
} // End of function rule_three_an_inline_comment_belongs_to_its_mapping_entry()

#[test]
fn rule_four_a_file_header_comment_never_belongs_to_the_first_match() {
    // The load-bearing rule. The owner's real files all open with a generated
    // header comment; attaching it to the first snippet would move it on every
    // reorder.
    let source = "# header one\n# header two\nmatches:\n  - trigger: :a\n";
    let (index, trivia) = scan(source);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 2);
    for attachment in &attachments {
        assert_eq!(attachment.rule, OwnershipRule::FileHeader);
        assert!(attachment.owner.is_file());
    }
    // Emphatically: not the first match, and not the `matches` key either.
    let first_match = index
        .nodes()
        .iter()
        .find(|node| node.role == NodeRole::SequenceItem)
        .expect("a first match");
    assert_eq!(trivia.comments_owned_by(first_match.id).count(), 0);
    let key = node_with_text(&index, source, "matches", NodeRole::MappingKey);
    assert_eq!(trivia.comments_owned_by(key).count(), 0);
    assert_eq!(trivia.file_comments().count(), 2);

    // The rule is about the *first top-level key* only: the identical comment
    // above the second top-level key belongs to that key.
    let source = "matches: []\n# about the second key\nlabel: x\n";
    let (index, trivia) = scan(source);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments[0].rule, OwnershipRule::LeadingBlock);
    let label = node_with_text(&index, source, "label", NodeRole::MappingKey);
    assert_eq!(attachments[0].owner, CommentOwner::Node(label));

    // A document whose root is a sequence behaves the same way.
    let source = "# header\n- trigger: :a\n";
    let (_, trivia) = scan(source);
    assert_eq!(comments_of(&trivia)[0].rule, OwnershipRule::FileHeader);
} // End of function rule_four_a_file_header_comment_never_belongs_to_the_first_match()

#[test]
fn the_corpus_fixture_written_for_the_ownership_rules_gets_the_answers_it_states() {
    // `comments-everywhere.yml` documents, in its own prose, who should own
    // each of its comments. This test holds the implementation to that text.
    let file = fixture("comments-everywhere.yml");
    let (index, trivia) = scan(&file.source);
    let attachments = comments_of(&trivia);

    println!("\n--- comments-everywhere.yml ---");
    for attachment in &attachments {
        println!(
            "{:<20} {:?}",
            format!("{:?}", attachment.rule),
            attachment
                .span
                .slice(&file.source)
                .map(|text| text.chars().take(48).collect::<String>())
        );
    } // End of the loop over the fixture's comments

    let rule_count = |rule: OwnershipRule| {
        attachments
            .iter()
            .filter(|attachment| attachment.rule == rule)
            .count()
    };
    // Six header lines, which the fixture says must never move with the first
    // match; three inline; three leading; three blank-line separated; one
    // trailing.
    assert_eq!(rule_count(OwnershipRule::FileHeader), 6);
    assert_eq!(rule_count(OwnershipRule::Inline), 3);
    assert_eq!(rule_count(OwnershipRule::LeadingBlock), 3);
    assert_eq!(rule_count(OwnershipRule::BlankLineSeparated), 3);
    assert_eq!(rule_count(OwnershipRule::TrailingFile), 1);
    assert_eq!(attachments.len(), 16);

    // The `#` inside the literal block is data, not a comment: it lives in a
    // frontier leaf and the scanner never sees it.
    let block = index
        .nodes()
        .iter()
        .find(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.style().is_block())
        })
        .expect("the fixture has a literal block");
    assert!(block
        .span
        .slice(&file.source)
        .is_some_and(|text| text.contains('#')));
    assert!(
        attachments
            .iter()
            .all(|attachment| !block.span.contains(attachment.span)),
        "a `#` inside a block scalar is data, never a comment"
    );
} // End of function the_corpus_fixture_written_for_the_ownership_rules_gets_the_answers_it_states()

// ===========================================================================
// 3. The ambiguous cases the Phase 0b-1 review flagged
// ===========================================================================

#[test]
fn an_empty_value_with_an_inline_comment_attaches_to_its_key_not_the_zero_width_value() {
    // Review section 3: "For an empty value followed by an inline comment, the
    // colon, spaces, comment and newline occupy one gap shared by the key, the
    // zero-width value and the mapping."
    //
    // POLICY: the gap is decomposed and **both the `:` and the comment belong
    // to the key**. The zero-width value is deliberately never the owner: it
    // owns no bytes, and the substrate reports it at the byte *before* the
    // colon, so a rule that used it would attach a trailing comment to a node
    // sitting on the wrong side of the punctuation it trails. The key is the
    // entry's visible identity, and the entry stays safely editable.
    let source = "empty: # why\n";
    let (index, trivia) = scan(source);

    let key = node_with_text(&index, source, "empty", NodeRole::MappingKey);
    let value = index
        .zero_width_leaves()
        .next()
        .expect("an empty value is a zero-width leaf");
    assert_eq!(value.role, NodeRole::MappingValue);
    assert_eq!(
        value.span,
        ByteSpan::new(5, 5),
        "the empty value is reported before the colon, which is why it cannot own it"
    );

    let colon = trivia
        .items()
        .iter()
        .find(|item| item.kind == TriviaKind::Punctuation(Punctuation::Colon))
        .expect("a colon");
    assert_eq!(colon.owner, Some(key), "the colon terminates its key");

    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].rule, OwnershipRule::Inline);
    assert_eq!(
        attachments[0].owner,
        CommentOwner::Node(key),
        "the inline comment belongs to the entry, identified by its key"
    );
    assert_eq!(trivia.comments_owned_by(value.id).count(), 0);
    assert!(
        trivia.is_safely_editable(&index, key),
        "a named owner is not a hazard"
    );
    // Every byte of the shared gap now has a name: `:`, spacing, comment, break.
    let kinds: Vec<TriviaKind> = trivia.items().iter().map(|item| item.kind).collect();
    assert_eq!(
        kinds,
        vec![
            TriviaKind::Punctuation(Punctuation::Colon),
            TriviaKind::Spacing,
            TriviaKind::Comment,
            TriviaKind::LineBreak,
        ]
    );
    assert_eq!(rebuild(source, &index, &trivia), source);
} // End of function an_empty_value_with_an_inline_comment_attaches_to_its_key_not_the_zero_width_value()

#[test]
fn a_bare_sequence_item_owns_its_dash_and_its_inline_comment() {
    // POLICY: the `-` belongs to the item it introduces, which for an empty
    // item is the zero-width scalar the substrate reports at the end of the
    // line — *after* the comment. An inline comment on that line has no node
    // before it, so it attaches forwards to the same item. Moving the item
    // therefore moves its dash and its comment together.
    let source = "matches:\n  - # nothing yet\n";
    let (index, trivia) = scan(source);
    let item = index
        .zero_width_leaves()
        .next()
        .expect("a bare item is a zero-width leaf")
        .id;

    let dash = trivia
        .items()
        .iter()
        .find(|item| item.kind == TriviaKind::Punctuation(Punctuation::SequenceDash))
        .expect("a dash");
    assert_eq!(dash.owner, Some(item), "the dash belongs to its item");

    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].rule, OwnershipRule::Inline);
    assert_eq!(attachments[0].owner, CommentOwner::Node(item));
    assert_eq!(rebuild(source, &index, &trivia), source);

    // A bare item with nothing at all on its line still owns its dash.
    let source = "matches:\n  - \n";
    let (index, trivia) = scan(source);
    let item = index.zero_width_leaves().next().expect("a bare item").id;
    let dash = trivia
        .items()
        .iter()
        .find(|item| item.kind == TriviaKind::Punctuation(Punctuation::SequenceDash))
        .expect("a dash");
    assert_eq!(dash.owner, Some(item));
    assert_eq!(rebuild(source, &index, &trivia), source);
} // End of function a_bare_sequence_item_owns_its_dash_and_its_inline_comment()

#[test]
fn a_compact_mapping_item_owns_its_dash_not_its_first_key() {
    // POLICY: in a compact `- key: value` the dash belongs to the **item
    // mapping**, never to the first key. The two start on the same line and the
    // frontier gives neither of them the dash, so without a rule a reorder
    // would either leave the dash behind or duplicate it.
    let source = "matches:\n  - trigger: :a\n    replace: x\n  - trigger: :b\n";
    let (index, trivia) = scan(source);

    let items: Vec<_> = index
        .nodes()
        .iter()
        .filter(|node| node.role == NodeRole::SequenceItem && node.kind == NodeKind::Mapping)
        .map(|node| node.id)
        .collect();
    assert_eq!(items.len(), 2, "two compact item mappings");

    let dashes: Vec<_> = trivia
        .items()
        .iter()
        .filter(|item| item.kind == TriviaKind::Punctuation(Punctuation::SequenceDash))
        .collect();
    assert_eq!(dashes.len(), 2);
    assert_eq!(dashes[0].owner, Some(items[0]));
    assert_eq!(dashes[1].owner, Some(items[1]));

    // Not the first key, which is what a positional guess would have picked.
    let first_key = node_with_text(&index, source, "trigger", NodeRole::MappingKey);
    assert!(dashes.iter().all(|dash| dash.owner != Some(first_key)));
    assert_eq!(trivia.items_owned_by(items[0]).count(), 1);
    assert_eq!(rebuild(source, &index, &trivia), source);
} // End of function a_compact_mapping_item_owns_its_dash_not_its_first_key()

#[test]
fn an_explicit_key_mapping_is_attributed_and_flagged_unsafe() {
    // POLICY: the `?` belongs to the key it introduces and the line-leading `:`
    // to the value it introduces — but espanso never writes this form, and its
    // punctuation does not sit where the compact form's does. So the enclosing
    // mapping raises `ExplicitKeyMapping` and Phase 0c refuses to edit it
    // visually rather than guessing an envelope.
    let source = "? key\n: value\n";
    let (index, trivia) = scan(source);

    let key = node_with_text(&index, source, "key", NodeRole::MappingKey);
    let value = node_with_text(&index, source, "value", NodeRole::MappingValue);
    let question = trivia
        .items()
        .iter()
        .find(|item| item.kind == TriviaKind::Punctuation(Punctuation::ExplicitKey))
        .expect("a `?`");
    assert_eq!(question.owner, Some(key), "`?` introduces its key");
    let colon = trivia
        .items()
        .iter()
        .find(|item| item.kind == TriviaKind::Punctuation(Punctuation::Colon))
        .expect("a `:`");
    assert_eq!(
        colon.owner,
        Some(value),
        "a line-leading `:` introduces its value"
    );

    let hazards = trivia.hazards();
    assert_eq!(hazards.len(), 1);
    assert_eq!(hazards[0].kind, HazardKind::ExplicitKeyMapping);
    let mapping = index.node(key).expect("the key").parent.expect("a mapping");
    assert_eq!(hazards[0].node, Some(mapping));
    assert!(
        !trivia.is_safely_editable(&index, mapping),
        "the mapping must refuse visual editing"
    );
    assert!(
        !trivia.is_safely_editable(&index, key),
        "and so must anything inside it"
    );
    assert_eq!(rebuild(source, &index, &trivia), source);
} // End of function an_explicit_key_mapping_is_attributed_and_flagged_unsafe()

#[test]
fn a_comment_inside_a_flow_collection_belongs_to_the_collection_and_flags_it() {
    // Risk R6: in `items: [one, # why` / `two]` the comment belongs to no
    // obvious node.
    //
    // POLICY: it belongs to the **innermost enclosing flow collection**, and
    // that collection raises `CommentInFlowCollection`, which refuses the
    // collection **outright** — whole-collection replacement included. An
    // earlier write-up called that replacement legal; the gate never agreed,
    // and the contradiction is resolved in the gate's favour because the gate
    // is the answer that cannot lose a comment. `is_safely_editable` has no way
    // to say "safe to replace, unsafe to reorder", and inventing one would put
    // the burden of remembering the distinction on every future caller.
    let source = "items: [one, # why\n  two]\n";
    let (index, trivia) = scan(source);

    let flow = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Sequence)
        .expect("a flow sequence");
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].rule, OwnershipRule::FlowInterior);
    assert_eq!(attachments[0].owner, CommentOwner::Node(flow.id));

    let hazards = trivia.hazards();
    assert_eq!(hazards.len(), 1);
    assert_eq!(hazards[0].kind, HazardKind::CommentInFlowCollection);
    assert_eq!(hazards[0].node, Some(flow.id));
    assert!(!trivia.is_safely_editable(&index, flow.id));
    // The entries inside it are refused as well: a descendant edit rewrites the
    // bytes the comment sits in.
    for child in &flow.children {
        assert!(!trivia.is_safely_editable(&index, *child));
    }
    assert_eq!(rebuild(source, &index, &trivia), source);

    // Without the comment, the same flow collection is perfectly editable.
    let clean = "items: [one, two]\n";
    let (index, trivia) = scan(clean);
    assert!(trivia.hazards().is_empty());
    let flow = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Sequence)
        .expect("a flow sequence");
    assert!(trivia.is_safely_editable(&index, flow.id));
} // End of function a_comment_inside_a_flow_collection_belongs_to_the_collection_and_flags_it()

#[test]
fn a_truncated_block_scalar_header_is_flagged_rather_than_guessed() {
    // R5, the one measured case where the reported span contains its own
    // header. It only happens on incomplete input, which a desktop editor sees
    // on every keystroke, and the presentation cannot be trusted there.
    let source = "matches:\n  - replace: |\n";
    let (index, trivia) = scan(source);
    let hazards = trivia.hazards();
    assert_eq!(hazards.len(), 1);
    assert_eq!(hazards[0].kind, HazardKind::TruncatedBlockScalarHeader);
    let block = index
        .nodes()
        .iter()
        .find(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.header_inside_span())
        })
        .expect("a truncated block scalar");
    assert_eq!(hazards[0].node, Some(block.id));
    assert!(!trivia.is_safely_editable(&index, block.id));
    assert_eq!(rebuild(source, &index, &trivia), source);
} // End of function a_truncated_block_scalar_header_is_flagged_rather_than_guessed()

// ===========================================================================
// 4. Decoration: what the substrate never reports
// ===========================================================================

#[test]
fn anchor_and_tag_spelling_is_recovered_and_attached_to_the_node_it_decorates() {
    // The substrate reports a numeric anchor identity and never the spelling,
    // and both an anchor and a tag always fall outside their node's span. The
    // gap scanner is the only place either exists.
    let file = fixture("anchors-aliases-tags-merge.yml");
    let (index, trivia) = scan(&file.source);

    let mut anchored = 0usize;
    let mut tagged = 0usize;
    for node in index.nodes() {
        if node.anchor.is_some() {
            anchored += 1;
            let named = trivia
                .items_owned_by(node.id)
                .filter(|item| item.kind == TriviaKind::Anchor)
                .count();
            assert_eq!(named, 1, "every anchored node needs exactly one `&name`");
        }
        if node.tag.is_some() {
            tagged += 1;
            let named = trivia
                .items_owned_by(node.id)
                .filter(|item| item.kind == TriviaKind::Tag)
                .count();
            assert_eq!(named, 1, "every tagged node needs exactly one tag spelling");
        }
    } // End of the loop over the fixture's nodes

    println!("\nanchors-aliases-tags-merge.yml: {anchored} anchored nodes, {tagged} tagged nodes");
    assert!(
        anchored >= 1 && tagged >= 1,
        "the fixture must exercise both"
    );
    for item in trivia
        .items()
        .iter()
        .filter(|item| item.kind == TriviaKind::Anchor)
    {
        assert!(item
            .span
            .slice(&file.source)
            .is_some_and(|text| text.starts_with('&') && text.len() > 1));
    } // End of the loop over the anchor items
} // End of function anchor_and_tag_spelling_is_recovered_and_attached_to_the_node_it_decorates()

#[test]
fn every_block_scalar_header_is_adopted_from_the_span_layer_and_owned_by_its_scalar() {
    // The scanner must not lex a header a second time: `crate::syntax::block`
    // already did, and the trimmed content span was derived from that answer. A
    // second opinion could disagree with the first.
    let mut headers = 0usize;
    for file in common::synthetic_valid() {
        let (index, trivia) = scan(&file.source);
        for node in index.nodes() {
            let Some(header) = node.scalar.as_ref().and_then(|scalar| scalar.header) else {
                continue;
            };
            let matched = trivia
                .items()
                .iter()
                .filter(|item| item.kind == TriviaKind::BlockScalarHeader)
                .filter(|item| item.span == header.span && item.owner == Some(node.id))
                .count();
            assert_eq!(
                matched, 1,
                "{}: the header at byte {} must appear once, owned by its scalar",
                file.name, header.span.start
            );
            headers += 1;
        } // End of the loop over one fixture's nodes
    } // End of the loop over the valid synthetic corpus

    println!("\nblock-scalar headers adopted from the span layer: {headers}");
    // The same 45 block scalars `syntax_index.rs` pins.
    assert_eq!(headers, 45, "block scalars in the corpus");
} // End of function every_block_scalar_header_is_adopted_from_the_span_layer_and_owned_by_its_scalar()

#[test]
fn document_markers_and_directives_are_named_not_guessed() {
    let file = fixture("multi-document.yml");
    let (index, trivia) = scan(&file.source);
    let markers: Vec<&str> = trivia
        .items()
        .iter()
        .filter(|item| item.kind == TriviaKind::DocumentMarker)
        .filter_map(|item| item.span.slice(&file.source))
        .collect();
    println!("\nmulti-document.yml: markers {markers:?}");
    assert_eq!(index.documents().len(), 3);
    assert!(markers.iter().filter(|text| **text == "---").count() == 3);
    assert!(trivia.unclassified().count() == 0);

    // A directive line is its own item, and a `%` mid-line is not one.
    let source = "%YAML 1.2\n---\na: 1\n";
    let (_, trivia) = scan(source);
    let directives: Vec<&str> = trivia
        .items()
        .iter()
        .filter(|item| item.kind == TriviaKind::Directive)
        .filter_map(|item| item.span.slice(source))
        .collect();
    assert_eq!(directives, vec!["%YAML 1.2"]);
} // End of function document_markers_and_directives_are_named_not_guessed()

// ===========================================================================
// 5. Move and delete envelopes — direct ownership is not enough
// ===========================================================================

#[test]
fn a_final_inline_comment_is_stranded_by_direct_ownership_and_carried_by_the_subtree_query() {
    // The Phase 0b-2 review's top-ranked risk, verbatim: "a comment after the
    // last value of a sequence-item mapping is owned by that value, not the
    // item", so an envelope built from `items_owned_by`/`comments_owned_by`
    // moves the item and leaves the comment behind — where it silently becomes
    // a comment about the *next* snippet.
    let source =
        "matches:\n  - trigger: :a\n    replace: x # about the replacement\n  - trigger: :b\n";
    let (index, trivia) = scan(source);

    let items: Vec<_> = index
        .nodes()
        .iter()
        .filter(|node| node.role == NodeRole::SequenceItem && node.kind == NodeKind::Mapping)
        .map(|node| node.id)
        .collect();
    assert_eq!(items.len(), 2, "two item mappings");

    // The comment really is owned by the value, not by the item. That is the
    // trap, and it is asserted rather than assumed.
    let value = node_with_text(&index, source, "x", NodeRole::MappingValue);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].owner, CommentOwner::Node(value));
    assert_eq!(
        trivia.comments_owned_by(items[0]).count(),
        0,
        "the item directly owns no comment at all — this is what strands it"
    );

    // The envelope query finds it, and finds it for the right item only.
    let carried = trivia.comments_owned_by_subtree(&index, items[0]);
    assert_eq!(carried.len(), 1);
    assert_eq!(
        carried[0].span.slice(source),
        Some("# about the replacement")
    );
    assert!(
        trivia
            .comments_owned_by_subtree(&index, items[1])
            .is_empty(),
        "the comment must not travel with the item below it as well"
    );

    // Punctuation behaves the same way: the dash is the item's own, both colons
    // belong to its keys, and only the subtree query returns the whole set.
    assert_eq!(trivia.items_owned_by(items[0]).count(), 1, "only its dash");
    let envelope = trivia.items_owned_by_subtree(&index, items[0]);
    let kinds: Vec<TriviaKind> = envelope.iter().map(|item| item.kind).collect();
    assert_eq!(
        kinds,
        vec![
            TriviaKind::Punctuation(Punctuation::SequenceDash),
            TriviaKind::Punctuation(Punctuation::Colon),
            TriviaKind::Punctuation(Punctuation::Colon),
            TriviaKind::Comment,
        ]
    );
    // Every one of them lies inside or immediately around the item, never past
    // the start of the item below.
    let below = index.node(items[1]).expect("the second item").span.start;
    assert!(envelope.iter().all(|item| item.span.end <= below));
} // End of function a_final_inline_comment_is_stranded_by_direct_ownership_and_carried_by_the_subtree_query()

#[test]
fn the_subtree_query_returns_a_superset_of_the_direct_one_everywhere_in_the_corpus() {
    // A structural invariant rather than a single case: for every node of every
    // fixture, whatever the direct query returns the subtree query returns too,
    // and the root's subtree accounts for every owned item in the document.
    for file in common::synthetic_valid() {
        let (index, trivia) = scan(&file.source);
        for node in index.nodes() {
            let direct: Vec<ByteSpan> = trivia
                .items_owned_by(node.id)
                .map(|item| item.span)
                .collect();
            let subtree: Vec<ByteSpan> = trivia
                .items_owned_by_subtree(&index, node.id)
                .iter()
                .map(|item| item.span)
                .collect();
            assert!(
                direct.iter().all(|span| subtree.contains(span)),
                "{}: direct ownership must be a subset of subtree ownership",
                file.name
            );
        } // End of the loop over one fixture's nodes

        let owned = trivia
            .items()
            .iter()
            .filter(|item| item.owner.is_some())
            .count();
        let from_documents: usize = index
            .documents()
            .iter()
            .map(|document| trivia.items_owned_by_subtree(&index, *document).len())
            .sum();
        assert_eq!(
            owned, from_documents,
            "{}: every owned item must hang off some document's subtree",
            file.name
        );
    } // End of the loop over the valid synthetic corpus
} // End of function the_subtree_query_returns_a_superset_of_the_direct_one_everywhere_in_the_corpus()

// ===========================================================================
// 6. The hazard set — every construct the plan says to refuse
// ===========================================================================

#[test]
fn an_anchor_definition_and_its_alias_are_both_refused() {
    // Plan section 7 row 8 and section 13: editing an anchored node changes the
    // effective value of every alias pointing at it, and moving or deleting it
    // can leave those aliases dangling. The index has recorded `anchor` and
    // `alias_target` since 0b-1; before this fix the safety collector ignored
    // both and called the whole document editable.
    let source = "a: &shared value\nb: *shared\n";
    let (index, trivia) = scan(source);

    let anchored = index
        .nodes()
        .iter()
        .find(|node| node.anchor.is_some())
        .expect("an anchored node");
    let alias = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Alias)
        .expect("an alias node");

    let kinds: Vec<HazardKind> = trivia.hazards().iter().map(|hazard| hazard.kind).collect();
    assert_eq!(
        kinds,
        vec![HazardKind::AnchorDefinition, HazardKind::AliasReference]
    );
    assert!(!trivia.is_safely_editable(&index, anchored.id));
    assert!(!trivia.is_safely_editable(&index, alias.id));
    // And the mapping that encloses them, because an edit to it rewrites both.
    let root = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Mapping)
        .expect("the root mapping");
    assert!(!trivia.is_safely_editable(&index, root.id));

    // The anchor spelling is still recovered and still owned: refusing to edit
    // a construct is not the same as failing to see it.
    assert_eq!(
        trivia
            .items_owned_by(anchored.id)
            .filter(|item| item.kind == TriviaKind::Anchor)
            .count(),
        1
    );
    assert_eq!(rebuild(source, &index, &trivia), source);
} // End of function an_anchor_definition_and_its_alias_are_both_refused()

#[test]
fn a_merge_key_is_recognised_syntactically_and_refuses_its_mapping() {
    // Risk R8: `<<` arrives from the substrate as an ordinary plain scalar key,
    // so nothing but its spelling distinguishes it. The entries it contributes
    // are written nowhere inside the mapping, so no local edit to that mapping
    // can be reasoned about.
    let source = "matches:\n  - <<: {word: true}\n    trigger: :a\n";
    let (index, trivia) = scan(source);

    let hazards = trivia.hazards();
    assert_eq!(hazards.len(), 1);
    assert_eq!(hazards[0].kind, HazardKind::MergeKey);
    assert_eq!(hazards[0].span.slice(source), Some("<<"));

    let item = index
        .nodes()
        .iter()
        .find(|node| node.role == NodeRole::SequenceItem && node.kind == NodeKind::Mapping)
        .expect("the item mapping");
    assert_eq!(hazards[0].node, Some(item.id));
    assert!(!trivia.is_safely_editable(&index, item.id));

    // A quoted `'<<'` is an ordinary string key by YAML's own rules, and is
    // deliberately not flagged: the gate is pessimistic, not superstitious.
    let quoted = "matches:\n  - '<<': plain string key\n    trigger: :a\n";
    let (_, trivia) = scan(quoted);
    assert!(trivia.hazards().is_empty());
} // End of function a_merge_key_is_recognised_syntactically_and_refuses_its_mapping()

#[test]
fn duplicate_mapping_keys_are_detected_and_refuse_their_mapping() {
    // Plan section 7 row 7: parse-valid, compose-ambiguous. A visual path such
    // as `matches[0].replace` cannot say which occurrence it means, so the
    // mapping is refused rather than resolved by a coin toss.
    let source = "matches:\n  - trigger: :a\n    replace: one\n    replace: two\n";
    let (index, trivia) = scan(source);

    let hazards = trivia.hazards();
    assert_eq!(hazards.len(), 1);
    assert_eq!(hazards[0].kind, HazardKind::DuplicateMappingKey);
    let item = index
        .nodes()
        .iter()
        .find(|node| node.role == NodeRole::SequenceItem && node.kind == NodeKind::Mapping)
        .expect("the item mapping");
    assert_eq!(hazards[0].node, Some(item.id));
    assert_eq!(
        hazards[0].span.start,
        source.rfind("replace").expect("the second occurrence"),
        "the hazard points at the duplicate, not at the original"
    );
    assert!(!trivia.is_safely_editable(&index, item.id));

    // Keys are compared by decoded value, so a style change cannot hide one.
    let styled = "matches:\n  - trigger: :a\n    replace: one\n    'replace': two\n";
    let (_, trivia) = scan(styled);
    assert_eq!(trivia.hazards().len(), 1);
    assert_eq!(trivia.hazards()[0].kind, HazardKind::DuplicateMappingKey);

    // The corpus fixture written for this raises exactly two: the repeated
    // `replace` and the repeated `label`. The nested `name` keys live in
    // different mappings and are not duplicates.
    let file = fixture("duplicate-keys.yml");
    let (_, trivia) = scan(&file.source);
    assert_eq!(
        trivia
            .hazards()
            .iter()
            .filter(|hazard| hazard.kind == HazardKind::DuplicateMappingKey)
            .count(),
        2
    );
} // End of function duplicate_mapping_keys_are_detected_and_refuse_their_mapping()

#[test]
fn an_explicit_tag_is_refused_rather_than_treated_as_movable_decoration() {
    // A tag changes how a scalar resolves — `!!str 1.50` is the string, not the
    // number — and the visual model has no representation for it. Plan section
    // 13 defers visual tag editing past v1, so the gate refuses it.
    let source = "label: !!str 1.50\n";
    let (index, trivia) = scan(source);

    let tagged = index
        .nodes()
        .iter()
        .find(|node| node.tag.is_some())
        .expect("a tagged node");
    assert_eq!(trivia.hazards().len(), 1);
    assert_eq!(trivia.hazards()[0].kind, HazardKind::ExplicitTag);
    assert_eq!(trivia.hazards()[0].node, Some(tagged.id));
    assert!(!trivia.is_safely_editable(&index, tagged.id));

    // The spelling is still attached to the node it decorates.
    assert_eq!(
        trivia
            .items_owned_by(tagged.id)
            .filter(|item| item.kind == TriviaKind::Tag)
            .count(),
        1
    );
} // End of function an_explicit_tag_is_refused_rather_than_treated_as_movable_decoration()

#[test]
fn a_multi_document_stream_refuses_every_node_in_every_document() {
    // Recognised since 0b-1, hazardous only now. Espanso reads the first
    // document, but truncating the rest on save would destroy data, and no path
    // in the visual model is document-scoped yet.
    let source = "---\na: 1\n---\nb: 2\n";
    let (index, trivia) = scan(source);
    assert_eq!(index.documents().len(), 2);
    assert_eq!(trivia.hazards().len(), 2);
    assert!(trivia
        .hazards()
        .iter()
        .all(|hazard| hazard.kind == HazardKind::MultiDocumentStream));
    for node in index.nodes() {
        assert!(
            !trivia.is_safely_editable(&index, node.id),
            "no node of a multi-document stream may be editable"
        );
    } // End of the loop over the stream's nodes

    // One document is not a stream, and is not refused.
    let single = "---\na: 1\n...\n";
    let (index, trivia) = scan(single);
    assert_eq!(index.documents().len(), 1);
    assert!(trivia.hazards().is_empty());
} // End of function a_multi_document_stream_refuses_every_node_in_every_document()

#[test]
fn the_three_hazard_bearing_fixtures_refuse_every_node_they_contain() {
    // The gate is only useful if it actually says no. For the fixtures the
    // corpus keeps precisely because they are hostile, no node may be editable.
    for name in [
        "anchors-aliases-tags-merge.yml",
        "duplicate-keys.yml",
        "multi-document.yml",
    ] {
        let file = fixture(name);
        let (index, trivia) = scan(&file.source);
        assert!(!trivia.hazards().is_empty(), "{name} must raise hazards");
        let editable = index
            .nodes()
            .iter()
            .filter(|node| trivia.is_safely_editable(&index, node.id))
            .count();
        println!(
            "{name}: {} hazards, {editable} editable nodes",
            trivia.hazards().len()
        );
    } // End of the loop over the hazard-bearing fixtures

    // `multi-document.yml` is the total case: every document is flagged, so
    // every node in the file has a flagged ancestor.
    let file = fixture("multi-document.yml");
    let (index, trivia) = scan(&file.source);
    for node in index.nodes() {
        assert!(!trivia.is_safely_editable(&index, node.id));
    } // End of the loop over the multi-document fixture's nodes
} // End of function the_three_hazard_bearing_fixtures_refuse_every_node_they_contain()

#[test]
fn a_header_comment_before_the_next_documents_marker_is_filed_under_that_document() {
    // A metadata boundary bug the review found: the comment introduces document
    // 2, but positionally it sits past the end of document 1, so deriving the
    // document from the comment's own offset filed it under document 0.
    let source = "---\na: 1\n...\n# header for the second document\n---\nb: 2\n";
    let (_, trivia) = scan(source);
    let attachments = comments_of(&trivia);
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].rule, OwnershipRule::FileHeader);
    assert_eq!(
        attachments[0].owner,
        CommentOwner::File { document_index: 1 },
        "the header belongs to the document it introduces, not the one it follows"
    );

    // In a single-document file the two answers coincide, which is why the bug
    // stayed invisible.
    let single = "# header\na: 1\n";
    let (_, trivia) = scan(single);
    assert_eq!(
        comments_of(&trivia)[0].owner,
        CommentOwner::File { document_index: 0 }
    );
} // End of function a_header_comment_before_the_next_documents_marker_is_filed_under_that_document()

// ===========================================================================
// 7. Classification and ownership goldens — reconstruction is not an oracle
// ===========================================================================

#[test]
fn every_documented_token_spelling_lexes_to_its_exact_span_and_kind() {
    // `assert_tiles` proves contiguity, coverage and reconstruction, all of
    // which a comment mislabelled as a `Tag` survives unharmed. These are the
    // assertions that do not: for one document per documented spelling, the
    // exact list of `(text, kind)` pairs, in order.
    use espansoconfig_core::syntax::Punctuation as Mark;
    use espansoconfig_core::syntax::TriviaKind as Kind;

    let cases: Vec<(&str, Vec<(&str, TriviaKind)>)> = vec![
        (
            "\u{feff}a: 1\n",
            vec![
                ("\u{feff}", Kind::Bom),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: 1\n  # a comment\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
                ("  ", Kind::Indentation),
                ("# a comment", Kind::Comment),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: 1\n\nb: 2\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
                ("\n", Kind::BlankLine),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: 1\r\nb: 2\r\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\r\n", Kind::LineBreak),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\r\n", Kind::LineBreak),
            ],
        ),
        // The second line break is not the header's: `|2-` strips, so the
        // content span ends before the file's final newline and that newline is
        // trivia of its own.
        (
            "a: |2-\n    body\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("|2-", Kind::BlockScalarHeader),
                ("\n", Kind::LineBreak),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: &anchor_name 1\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("&anchor_name", Kind::Anchor),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: !!str 1\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("!!str", Kind::Tag),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: !custom 1\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("!custom", Kind::Tag),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        // The spelling `TriviaKind::Tag` documents and the classifier used to
        // get wrong: a verbatim tag whose URI contains a comma. Reusing the
        // anchor-name predicate stopped it at the comma and split one tag into
        // a `Kind::Tag`, a `Comma` and unclassified bytes.
        (
            "a: !<tag:example.com,2000:x> 1\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("!<tag:example.com,2000:x>", Kind::Tag),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "%YAML 1.2\n---\na: 1\n...\n",
            vec![
                ("%YAML 1.2", Kind::Directive),
                ("\n", Kind::LineBreak),
                ("---", Kind::DocumentMarker),
                ("\n", Kind::LineBreak),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
                ("...", Kind::DocumentMarker),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "- a\n",
            vec![
                ("-", Kind::Punctuation(Mark::SequenceDash)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "? k\n: v\n",
            vec![
                ("?", Kind::Punctuation(Mark::ExplicitKey)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("\n", Kind::LineBreak),
            ],
        ),
        (
            "a: {x: 1, y: [2, 3]}\n",
            vec![
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("{", Kind::Punctuation(Mark::FlowMappingOpen)),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                (",", Kind::Punctuation(Mark::Comma)),
                (" ", Kind::Spacing),
                (":", Kind::Punctuation(Mark::Colon)),
                (" ", Kind::Spacing),
                ("[", Kind::Punctuation(Mark::FlowSequenceOpen)),
                (",", Kind::Punctuation(Mark::Comma)),
                (" ", Kind::Spacing),
                ("]", Kind::Punctuation(Mark::FlowSequenceClose)),
                ("}", Kind::Punctuation(Mark::FlowMappingClose)),
                ("\n", Kind::LineBreak),
            ],
        ),
    ];

    println!("\n--- exact (span, kind) goldens ---");
    let mut seen: Vec<TriviaKind> = Vec::new();
    for (source, expected) in &cases {
        let (index, trivia) = scan(source);
        let actual: Vec<(&str, TriviaKind)> = trivia
            .items()
            .iter()
            .map(|item| (item.span.slice(source).expect("slices"), item.kind))
            .collect();
        assert_eq!(&actual, expected, "token stream for {source:?}");
        // Spans, not merely text: an item that slices to the right characters
        // from the wrong offset would still be a defect.
        let mut cursor = None;
        for item in trivia.items() {
            if let Some(previous) = cursor {
                assert!(item.span.start >= previous, "items must be ordered");
            }
            cursor = Some(item.span.end);
            assert_eq!(item.span.slice(source).map(str::len), Some(item.span.len()));
        } // End of the loop over one case's items
        for (_, kind) in expected {
            if !seen.contains(kind) {
                seen.push(*kind);
            }
        }
        assert_eq!(rebuild(source, &index, &trivia), *source);
        println!("{source:?} -> {} items", actual.len());
    } // End of the loop over the golden cases

    // Every documented spelling is covered except `Unclassified`, which by
    // construction has none: it is what the scanner emits when it recognises
    // nothing, and no valid YAML document in either corpus produces one. Listed
    // exhaustively so that adding a `TriviaKind` without a golden fails here.
    let documented = [
        Kind::Bom,
        Kind::Comment,
        Kind::BlankLine,
        Kind::LineBreak,
        Kind::Indentation,
        Kind::Spacing,
        Kind::BlockScalarHeader,
        Kind::Anchor,
        Kind::Tag,
        Kind::Directive,
        Kind::DocumentMarker,
        Kind::Punctuation(Mark::SequenceDash),
        Kind::Punctuation(Mark::Colon),
        Kind::Punctuation(Mark::ExplicitKey),
        Kind::Punctuation(Mark::Comma),
        Kind::Punctuation(Mark::FlowSequenceOpen),
        Kind::Punctuation(Mark::FlowSequenceClose),
        Kind::Punctuation(Mark::FlowMappingOpen),
        Kind::Punctuation(Mark::FlowMappingClose),
        Kind::Unclassified,
    ];
    for kind in documented {
        assert_eq!(
            kind != Kind::Unclassified,
            seen.contains(&kind),
            "{kind:?} must have exactly one golden unless it is Unclassified"
        );
    } // End of the loop over the documented kinds
    assert_eq!(seen.len(), documented.len() - 1);
} // End of function every_documented_token_spelling_lexes_to_its_exact_span_and_kind()

#[test]
fn every_trivia_kind_agrees_with_an_independent_predicate_across_both_corpora() {
    // The corpus-wide half of the same argument. Each item's `kind` is checked
    // against a lexical predicate computed here, from the source text alone,
    // rather than against the scanner's own reasoning — so a systematic
    // mislabelling cannot pass by being self-consistent.
    let mut checked = 0usize;
    for file in common::synthetic_valid() {
        let (_, trivia) = scan(&file.source);
        checked += assert_kinds_are_independently_valid(&file.name, &file.source, &trivia);
    } // End of the loop over the valid synthetic corpus
    println!("\nsynthetic: {checked} trivia items independently re-checked");
    assert_eq!(checked, SYNTHETIC_TRIVIA_ITEMS);

    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "every_trivia_kind_agrees_with_an_independent_predicate_across_both_corpora",
        &files,
    ) {
        return;
    }
    let mut real = 0usize;
    for file in &files {
        let (_, trivia) = scan(&file.source);
        real += assert_kinds_are_independently_valid(&file.name, &file.source, &trivia);
    } // End of the loop over the real corpus
      // Aggregate only, never a slice of the owner's configuration.
    println!("real: {real} trivia items independently re-checked");
    assert!(real > 0);
} // End of function every_trivia_kind_agrees_with_an_independent_predicate_across_both_corpora()

#[test]
fn ownership_is_pinned_by_span_owner_and_rule_not_only_by_totals() {
    // Golden `(comment text, owner, rule)` triples. Counting rules per fixture
    // cannot tell two opposing misattributions apart; naming the owner can.
    /// One expected attachment: comment text, owner label, deciding rule.
    type Golden = (&'static str, &'static str, OwnershipRule);

    let cases: Vec<(&str, Vec<Golden>)> = vec![
        (
            "# header one\n# header two\nmatches:\n  - trigger: :a\n",
            vec![
                ("# header one", "file[0]", OwnershipRule::FileHeader),
                ("# header two", "file[0]", OwnershipRule::FileHeader),
            ],
        ),
        (
            "matches:\n  - trigger: :a\n  # lead\n  - trigger: :b\n",
            vec![(
                "# lead",
                "SequenceItem(\"trigger: :b\")",
                OwnershipRule::LeadingBlock,
            )],
        ),
        (
            "matches:\n  - trigger: :a\n  # far\n\n  - trigger: :b\n",
            vec![("# far", "file[0]", OwnershipRule::BlankLineSeparated)],
        ),
        (
            "matches: # about the key\n  - trigger: :a # about the value\n",
            vec![
                (
                    "# about the key",
                    "MappingKey(\"matches\")",
                    OwnershipRule::Inline,
                ),
                (
                    "# about the value",
                    "MappingValue(\":a\")",
                    OwnershipRule::Inline,
                ),
            ],
        ),
        (
            "empty: # why\n",
            vec![("# why", "MappingKey(\"empty\")", OwnershipRule::Inline)],
        ),
        (
            "a: 1\n# trailing\n",
            vec![("# trailing", "file[0]", OwnershipRule::TrailingFile)],
        ),
        (
            "items: [one, # why\n  two]\n",
            vec![(
                "# why",
                "MappingValue(\"[one, # why\\n  two]\")",
                OwnershipRule::FlowInterior,
            )],
        ),
        (
            "---\na: 1\n...\n# introduces document two\n---\nb: 2\n",
            vec![(
                "# introduces document two",
                "file[1]",
                OwnershipRule::FileHeader,
            )],
        ),
    ];

    println!("\n--- (span, owner, rule) goldens ---");
    for (source, expected) in &cases {
        let (index, trivia) = scan(source);
        let actual: Vec<(&str, String, OwnershipRule)> = trivia
            .comments()
            .iter()
            .map(|attachment| {
                (
                    attachment.span.slice(source).expect("slices"),
                    owner_label(&index, source, attachment.owner),
                    attachment.rule,
                )
            })
            .collect();
        let expected: Vec<(&str, String, OwnershipRule)> = expected
            .iter()
            .map(|(text, owner, rule)| (*text, (*owner).to_owned(), *rule))
            .collect();
        assert_eq!(actual, expected, "ownership for {source:?}");
        for entry in &actual {
            println!("{:<28} {:<34} {:?}", entry.0, entry.1, entry.2);
        }
    } // End of the loop over the ownership goldens
} // End of function ownership_is_pinned_by_span_owner_and_rule_not_only_by_totals()

#[test]
fn every_comment_attachment_is_consistent_with_its_rule_across_both_corpora() {
    // The corpus-wide ownership oracle: whatever rule fired, the relationship
    // it claims between the comment and its owner must actually hold in the
    // source.
    let mut checked = 0usize;
    for file in common::synthetic_valid() {
        let (index, trivia) = scan(&file.source);
        checked +=
            assert_ownership_is_independently_valid(&file.name, &file.source, &index, &trivia);
    } // End of the loop over the valid synthetic corpus
    println!("\nsynthetic: {checked} comment attachments independently re-checked");
    assert_eq!(checked, SYNTHETIC_COMMENTS);

    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "every_comment_attachment_is_consistent_with_its_rule_across_both_corpora",
        &files,
    ) {
        return;
    }
    let mut real = 0usize;
    for file in &files {
        let (index, trivia) = scan(&file.source);
        real += assert_ownership_is_independently_valid(&file.name, &file.source, &index, &trivia);
    } // End of the loop over the real corpus
    println!("real: {real} comment attachments independently re-checked");
    assert!(real > 0);
} // End of function every_comment_attachment_is_consistent_with_its_rule_across_both_corpora()

// ===========================================================================
// Helpers
// ===========================================================================

/// Loads one synthetic fixture by file-name suffix.
fn fixture(name: &str) -> common::CorpusFile {
    common::synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with(name))
        .unwrap_or_else(|| panic!("{name} missing from the corpus"))
}

/// Parses and scans one document.
fn scan(source: &str) -> (SyntaxIndex, TriviaIndex) {
    let index = SyntaxIndex::parse(source).expect("the document parses");
    let trivia = TriviaIndex::scan(source, &index);
    (index, trivia)
}

/// The comment attachments, in document order.
fn comments_of(trivia: &TriviaIndex) -> Vec<CommentAttachment> {
    trivia.comments().to_vec()
}

/// Finds the single node written as `text` in the given role.
fn node_with_text(
    index: &SyntaxIndex,
    source: &str,
    text: &str,
    role: NodeRole,
) -> espansoconfig_core::NodeId {
    index
        .nodes()
        .iter()
        .find(|node| node.role == role && node.span.slice(source) == Some(text))
        .unwrap_or_else(|| panic!("no {role:?} node written as {text:?}"))
        .id
}

/// A short, readable name for a comment's owner, used by the ownership
/// goldens: `file[0]`, or the owning node's role and source text.
fn owner_label(index: &SyntaxIndex, source: &str, owner: CommentOwner) -> String {
    match owner {
        CommentOwner::File { document_index } => format!("file[{document_index}]"),
        CommentOwner::Node(id) => {
            let node = index.node(id).expect("an owning node must exist");
            format!(
                "{:?}({:?})",
                node.role,
                node.span.slice(source).unwrap_or_default()
            )
        }
    }
} // End of function owner_label()

/// The text of one structural punctuation mark.
fn punctuation_text(punctuation: Punctuation) -> &'static str {
    match punctuation {
        Punctuation::SequenceDash => "-",
        Punctuation::Colon => ":",
        Punctuation::ExplicitKey => "?",
        Punctuation::Comma => ",",
        Punctuation::FlowSequenceOpen => "[",
        Punctuation::FlowSequenceClose => "]",
        Punctuation::FlowMappingOpen => "{",
        Punctuation::FlowMappingClose => "}",
    }
}

/// Whether `position` begins a physical line, computed here from the source
/// text alone so it is an independent check on the scanner's own answer.
fn begins_a_line(source: &str, position: usize) -> bool {
    let before = &source[..position];
    before.is_empty()
        || before == "\u{feff}"
        || before.ends_with('\n')
        || (before.ends_with('\r') && !source[position..].starts_with('\n'))
} // End of function begins_a_line()

/// Whether two byte offsets sit on the same physical line.
fn on_one_line(source: &str, from: usize, to: usize) -> bool {
    let (from, to) = if from <= to { (from, to) } else { (to, from) };
    source
        .get(from..to)
        .is_some_and(|between| !between.contains(['\n', '\r']))
}

/// Re-derives every item's kind from the source text and asserts it matches.
///
/// Returns the number of items checked. Deliberately *not* written in terms of
/// the scanner's own helpers: the value of the check is that it is a second,
/// independent opinion. Failure messages carry a byte offset only, never a
/// slice, because this also runs over the owner's private corpus.
fn assert_kinds_are_independently_valid(name: &str, source: &str, trivia: &TriviaIndex) -> usize {
    for item in trivia.items() {
        let text = item.span.slice(source).expect("an item slices");
        let at = item.span.start;
        let line_start = begins_a_line(source, at);
        let blank = |text: &str| text.chars().all(|c| matches!(c, ' ' | '\t' | '\r' | '\n'));
        let horizontal = |text: &str| text.chars().all(|c| c == ' ' || c == '\t');
        let ok = match item.kind {
            TriviaKind::Bom => text == "\u{feff}" && at == 0,
            TriviaKind::Comment => {
                text.starts_with('#')
                    && !text.contains(['\n', '\r'])
                    && (line_start || source[..at].ends_with([' ', '\t']))
            }
            TriviaKind::BlankLine => line_start && blank(text) && !text.is_empty(),
            TriviaKind::LineBreak => matches!(text, "\n" | "\r\n" | "\r"),
            TriviaKind::Indentation => line_start && horizontal(text) && !text.is_empty(),
            TriviaKind::Spacing => !line_start && horizontal(text) && !text.is_empty(),
            TriviaKind::BlockScalarHeader => text.starts_with('|') || text.starts_with('>'),
            TriviaKind::Anchor => text.starts_with('&') && text.len() > 1,
            TriviaKind::Tag => {
                text.starts_with('!')
                    && (!text.starts_with("!<") || text.ends_with('>'))
                    && !text.contains([' ', '\t', '\n', '\r'])
            }
            TriviaKind::Directive => line_start && text.starts_with('%'),
            TriviaKind::DocumentMarker => text == "---" || text == "...",
            TriviaKind::Punctuation(punctuation) => text == punctuation_text(punctuation),
            TriviaKind::Unclassified => false,
        };
        assert!(
            ok,
            "{name}: the item at byte {at} is classified {:?}, which an independent read of the source contradicts",
            item.kind
        );
    } // End of the loop over one document's trivia items
    trivia.items().len()
} // End of function assert_kinds_are_independently_valid()

/// Re-derives every comment's owner relationship from the source and asserts it
/// matches the rule that was recorded.
///
/// Returns the number of attachments checked.
fn assert_ownership_is_independently_valid(
    name: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
) -> usize {
    for attachment in trivia.comments() {
        let at = attachment.span.start;
        assert!(
            attachment.block.contains(attachment.span),
            "{name}: the comment at byte {at} is not inside its own block"
        );
        assert!(
            trivia
                .items()
                .iter()
                .any(|item| item.is_comment() && item.span == attachment.span),
            "{name}: the attachment at byte {at} has no matching comment item"
        );
        let line_prefix = &source[source[..at].rfind(['\n', '\r']).map_or(0, |o| o + 1)..at];
        let inline = line_prefix
            .chars()
            .any(|c| c != ' ' && c != '\t' && c != '\u{feff}');

        match attachment.rule {
            OwnershipRule::FileHeader
            | OwnershipRule::BlankLineSeparated
            | OwnershipRule::TrailingFile => {
                assert!(
                    attachment.owner.is_file(),
                    "{name}: the comment at byte {at} claims a file rule but names a node"
                );
            }
            OwnershipRule::Inline => {
                assert!(
                    inline,
                    "{name}: the comment at byte {at} is called inline but starts its line"
                );
                if let Some(owner) = attachment.owner.node() {
                    let span = index.node(owner).expect("an owning node").span;
                    assert!(
                        on_one_line(source, span.end, at) || on_one_line(source, span.start, at),
                        "{name}: the inline comment at byte {at} does not share a line with its owner"
                    );
                }
            }
            OwnershipRule::LeadingBlock => {
                assert!(
                    !inline,
                    "{name}: the comment at byte {at} leads a block but sits after content"
                );
                let owner = attachment
                    .owner
                    .node()
                    .unwrap_or_else(|| panic!("{name}: a leading block at byte {at} needs a node"));
                let span = index.node(owner).expect("an owning node").span;
                assert!(
                    span.start >= attachment.block.end,
                    "{name}: the owner of the leading block at byte {at} does not follow it"
                );
            }
            OwnershipRule::FlowInterior => {
                let owner = attachment.owner.node().unwrap_or_else(|| {
                    panic!("{name}: a flow-interior comment at byte {at} needs a node")
                });
                let node = index.node(owner).expect("an owning node");
                assert_eq!(
                    node.collection_style,
                    Some(CollectionStyle::Flow),
                    "{name}: the owner of the flow comment at byte {at} is not a flow collection"
                );
                assert!(
                    node.span.contains(attachment.span),
                    "{name}: the flow comment at byte {at} is not inside its owner"
                );
            }
        }
    } // End of the loop over one document's comment attachments
    trivia.comments().len()
} // End of function assert_ownership_is_independently_valid()

/// Concatenates every frontier leaf and every trivia item, in order.
fn rebuild(source: &str, index: &SyntaxIndex, trivia: &TriviaIndex) -> String {
    let mut out = String::with_capacity(source.len());
    let mut items = trivia.items().iter().peekable();
    for segment in index.segments() {
        match segment {
            espansoconfig_core::syntax::Segment::Leaf(leaf) => {
                out.push_str(leaf.span.slice(source).expect("a leaf slices"));
            }
            espansoconfig_core::syntax::Segment::Gap(gap) => {
                let mut cursor = gap.start;
                while cursor < gap.end {
                    let item = items.next().expect("a gap must be fully tiled");
                    out.push_str(item.span.slice(source).expect("an item slices"));
                    cursor = item.span.end;
                }
            }
        }
    } // End of the loop over the document's segments
    assert!(items.next().is_none(), "no item may sit outside a gap");
    out
} // End of function rebuild()

/// Asserts that the trivia items tile every gap exactly and that the document
/// rebuilds byte for byte from leaves plus items.
///
/// This is the Phase 0b acceptance property, strengthened: Phase 0b-1 could
/// reconstruct with any ordered, disjoint frontier because a gap was defined as
/// whatever lay between two leaves. Here the gaps must additionally be *filled*
/// by named items, contiguously and without overlap, so no byte can be
/// unaccounted for.
///
/// Failure messages carry the file name and a byte offset only, never a slice
/// of the source: this helper also runs over the owner's private corpus.
fn assert_tiles(name: &str, source: &str, index: &SyntaxIndex, trivia: &TriviaIndex) {
    let mut items = trivia.items().iter().peekable();
    let mut covered = 0usize;
    for gap in index.gaps() {
        let mut cursor = gap.start;
        while cursor < gap.end {
            let item = items
                .next()
                .unwrap_or_else(|| panic!("{name}: gap at byte {cursor} is not tiled"));
            assert_eq!(
                item.span.start, cursor,
                "{name}: items must be contiguous at byte {cursor}"
            );
            assert!(
                item.span.end > item.span.start,
                "{name}: zero-width trivia item at byte {cursor}"
            );
            assert!(
                item.span.end <= gap.end,
                "{name}: item at byte {cursor} runs past its gap"
            );
            assert!(
                item.span.slice(source).is_some(),
                "{name}: item at byte {cursor} does not slice"
            );
            covered += item.span.len();
            cursor = item.span.end;
        } // End of the loop over one gap's items
    } // End of the loop over the document's gaps
    assert!(
        items.next().is_none(),
        "{name}: a trivia item sits outside every gap"
    );

    let gap_bytes: usize = index.gaps().iter().map(|gap| gap.len()).sum();
    assert_eq!(covered, gap_bytes, "{name}: every gap byte must be covered");
    assert_eq!(
        rebuild(source, index, trivia).len(),
        source.len(),
        "{name}: byte-for-byte rebuild"
    );
    assert!(
        rebuild(source, index, trivia) == source,
        "{name}: byte-for-byte rebuild"
    );
} // End of function assert_tiles()
