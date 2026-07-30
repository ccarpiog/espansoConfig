//! Phase 0b-1 acceptance tests: the byte-accurate span layer.
//!
//! Four properties, checked over **every** valid synthetic fixture and over the
//! owner's real configuration when it is present (the real corpus is gitignored
//! and optional, so these tests skip cleanly without it):
//!
//! 1. **Slice fidelity** — every node's span slices out of the original source
//!    to exactly the text that node is written as.
//! 2. **Reconstruction** — concatenating the frontier spans and the gaps
//!    between them, in order, reproduces the file byte for byte: BOM, CRLF,
//!    trailing spaces and a missing final newline included. This is the
//!    headline acceptance property for Phase 0b.
//! 3. **Block-scalar recovery** — every `|`/`>` scalar's decoded value is
//!    reproducible from its trimmed span plus its header, which is what proves
//!    the trim landed on the true content end and not merely somewhere
//!    plausible.
//! 4. **No character offset leaks** — the non-ASCII fixtures slice correctly,
//!    which they cannot do if a reported offset is ever trusted as a byte
//!    index.
//!
//! Nothing here prints file contents from the real corpus: counts, file names
//! and offsets only.

mod common;

use espansoconfig_core::syntax::{
    CollectionStyle, ExtentDerivation, Node, NodeKind, ScalarNode, SyntaxError, SyntaxIndex,
    TriviaIndex,
};
use espansoconfig_core::{
    ByteSpan, Chomping, HeaderIndicatorOrder, NodeId, ScalarPresentation, ScalarStyle,
};

// ===========================================================================
// Pinned corpus measurements
// ===========================================================================
//
// The synthetic corpus is committed and stable, so every count it produces is
// asserted **exactly**. Adding or losing a fixture then has to be a deliberate
// act that updates these constants, instead of a `>=` quietly absorbing it.
//
// The real corpus is the owner's private configuration: per-machine, absent in
// CI, and different on every install. Nothing about its size is pinned. What is
// asserted there is that every discovered file was processed and that the
// failure count is exactly zero.

/// Valid fixtures in `corpus/synthetic/`.
///
/// 19 from Phase 0a, plus the three block-scalar shapes neither corpus
/// contained until the Phase 0b-1 review was closed out, plus
/// `block-scalar-header-tails.yml` from the Phase 0c-2b review's fix round, plus
/// `empty-entries-and-extents.yml` from Phase 0c-3a, plus the two the Phase
/// 0c-3a **review's** fix round added, plus
/// `run-based-removal-envelope.yml` from Phase 0c-3b-1.
///
/// Each of those moves every figure below, and each delta is exactly its own
/// shape. `block-scalar-header-tails.yml`: 19 nodes — 1 document, 1 root
/// mapping, the `matches` key, the sequence, 3 item mappings and 12 scalars —
/// carrying 3 block scalars and 6 whole-line comments.
/// `empty-entries-and-extents.yml`: 40 nodes — 1 document, 1 root mapping, the
/// `matches` sequence, 4 item mappings, the nested `vars` sequence, its 1 item
/// mapping and 31 scalars — of which **5 are zero width**, so it adds 31 scalars
/// but only 26 frontier members.
/// `file-comments-and-mixed-endings.yml`: 27 nodes — 1 document, 6 collections
/// (the root mapping, the `matches` sequence, 3 item mappings and the nested
/// `vars` mapping) and 20 scalars, none zero width, carrying 6 whole-line
/// comments and 3 real blank lines.
/// `single-line-no-line-ending.yml`: 4 nodes — 1 document, the root mapping and
/// its one key and one value — with no comment, no blank line and no line break
/// at all. `docs/decisions/0c-3a-notes.md` section 8 tabulates every count they
/// moved.
/// `run-based-removal-envelope.yml`: 26 nodes — 1 document, 6 collections (the
/// root mapping, the `matches` sequence, 2 item mappings and their 2 nested
/// `vars` mappings) and 19 scalars, none zero width, one of them a `|` block,
/// carrying 9 whole-line comments and 3 real blank lines.
/// `run-based-removal-boundaries.yml`, from that phase's **review**: the same
/// shape again — 26 nodes, 6 collections, 19 scalars, none zero width — but its
/// one block scalar is a `>` and it carries **12** whole-line comments and 2 real
/// blank lines. `docs/decisions/0c-3b-1-notes.md` section 5 tabulates every count
/// the two of them moved.
/// Phase 0c-3b-2a added `move-a-match.yml` and `move-block-scalar-seams.yml`, and
/// its **review** added two more. `move-run-joins.yml`: 31 nodes — 1 document, 7
/// collections (the root mapping, the `matches` sequence, 3 item mappings and 2
/// nested `vars` mappings) and 23 scalars, none zero width, 2 of them `|` blocks
/// with their bodies at column seven — carrying 22 whole-line comments and 4 real
/// blank lines. `move-kept-comment-joins-a-block.yml`: 28 nodes — 1 document, 6
/// collections (the root mapping, the `matches` sequence and 4 item mappings) and
/// 21 scalars, none zero width, 2 of them `|` blocks at column five — carrying 20
/// whole-line comments and 4 real blank lines.
/// `docs/decisions/0c-3b-2a-notes.md` section 5.2 tabulates every count they
/// moved.
const SYNTHETIC_FIXTURES: usize = 32;

/// Scalar nodes across the valid synthetic corpus.
const SYNTHETIC_SCALARS: usize = 1016;

/// Collection nodes across the valid synthetic corpus.
const SYNTHETIC_COLLECTIONS: usize = 300;

/// Alias nodes across the valid synthetic corpus.
const SYNTHETIC_ALIASES: usize = 5;

/// Frontier members across the valid synthetic corpus.
const SYNTHETIC_FRONTIER_MEMBERS: usize = 1016;

/// Block scalars across the valid synthetic corpus.
const SYNTHETIC_BLOCK_SCALARS: usize = 53;

/// Block scalars whose reported end overshot their true content end (R3).
///
/// 44 of the 47, not 47, and the three exceptions are exactly the blocks with no
/// following token to overshoot into: `block-scalar-header-tails.yml`'s `>2` at
/// end of file, `block-scalar-terminal-spaces.yml`'s block that ends the file,
/// and `multi-document.yml`'s. The `|` of `run-based-removal-envelope.yml` and the
/// `>` of `run-based-removal-boundaries.yml` are both followed by further entries,
/// so both overshoot. All four blocks of the two fixtures the Phase 0c-3b-2a
/// review added overshoot too, because each is followed by a further match.
const SYNTHETIC_OVERSHOOTING_BLOCKS: usize = 50;

/// Comment lines recoverable from the gaps of the valid synthetic corpus.
const SYNTHETIC_GAP_COMMENTS: usize = 316;

/// Flow collections across the valid synthetic corpus.
///
/// Kept apart from the block ones because their end markers are a different
/// measurement: a flow collection's is its closing bracket and is exact, a block
/// one's is a zero-width position that overshoots (`PROGRESS.md`, R3). Folding
/// the two into one figure is how the block-scalar overshoot hid for three
/// phases (R20).
const SYNTHETIC_FLOW_COLLECTIONS: usize = 11;

/// Block collections whose reported end marker overshot their span (R3).
///
/// Measured before the trim rule was written: 223 of the 235 block collections
/// then in the corpus, plus all 8 of `empty-entries-and-extents.yml`, none of
/// which ends the file, plus 3 of the 6 in
/// `file-comments-and-mixed-endings.yml` — its root mapping, its `matches`
/// sequence and its last item mapping all end at end of file, so they have
/// nowhere to overshoot into. `single-line-no-line-ending.yml`'s one mapping
/// ends the file too, and adds nothing here.
/// `run-based-removal-envelope.yml` adds **all 6** of its block collections,
/// because it does end with a line break: every collection that reaches the end of
/// the file still has that break to overshoot into, which is exactly why the
/// mixed-endings fixture — which has no final break — contributed only 3 of its 6.
/// `run-based-removal-boundaries.yml` adds all 6 of its own for the same reason.
/// The two fixtures the Phase 0c-3b-2a review added contribute **all 13** of
/// theirs, 7 and 6, on the same terms: both end with a line break.
const SYNTHETIC_OVERSHOOTING_COLLECTIONS: usize = 273;

/// Block collections that own bytes past their published span end.
///
/// The trailing `:` of an empty final entry, or an inline comment after the
/// final value. **4 before Phase 0c-3a, and all four were inline comments**: no
/// fixture in either corpus ended a mapping with an entry that has no value, so
/// the entry-punctuation half of the rule was unreachable from corpus data.
/// That is R20 exactly, and `empty-entries-and-extents.yml` closes it with three
/// more. The eighth is Phase 0c-3b-2a's `move-a-match.yml`, whose first match
/// ends in an inline comment — the trivia a move must carry with the match, which
/// is why that fixture has one at all.
const SYNTHETIC_COLLECTIONS_WITH_AN_OWNED_TAIL: usize = 8;

/// Zero-width scalar leaves across the valid synthetic corpus (R7).
///
/// The value of an entry written `label:` with nothing after it, and of a bare
/// `-` sequence item. All five come from `empty-entries-and-extents.yml`: until
/// Phase 0c-3a added it, **no fixture in either corpus had an empty entry**, so
/// two corpus-wide tests that must skip such a node had no skip at all and this
/// count would have been zero.
const SYNTHETIC_ZERO_WIDTH_LEAVES: usize = 5;

/// Blank lines recoverable from the gaps of the valid synthetic corpus.
///
/// This is the deliberately loose **per-gap line scan** of D2d, kept as the
/// Phase 0b-1 tripwire on the block-scalar trim: it counts every gap line that
/// trims to nothing, the break that merely *terminates* a content line included.
/// `tests/trivia_scanner.rs` pins the token-accurate figure, and the two are
/// expected to disagree. So `block-scalar-header-tails.yml` moves this by 9 while
/// adding only the **two** real blank lines that separate its three items — and
/// the trivia scanner's own count is what proves that, by moving by 2. The same
/// cross-check holds for `file-comments-and-mixed-endings.yml`, which moves this
/// loose figure by 18 and the scanner's by its **three** real blank lines, and for
/// `run-based-removal-envelope.yml`, which also moves it by 18 while the scanner
/// moves by its **three**. `run-based-removal-boundaries.yml` moves it by 17 and
/// the scanner's by its **two**. The two fixtures the Phase 0c-3b-2a review added
/// move this loose figure by 39 between them while carrying **four real blank
/// lines each**, and `tests/trivia_scanner.rs` is what says so.
const SYNTHETIC_GAP_BLANK_LINES: usize = 843;

// ===========================================================================
// 1. Slice fidelity
// ===========================================================================

#[test]
fn every_node_span_slices_the_source_it_was_written_as() {
    let mut scalars = 0usize;
    let mut collections = 0usize;
    let mut aliases = 0usize;
    let mut failures: Vec<String> = Vec::new();

    println!("\n--- slice fidelity over the valid synthetic corpus ---");
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
        let counts = check_slice_fidelity(&file.name, &file.source, &index, &mut failures);
        scalars += counts.0;
        collections += counts.1;
        aliases += counts.2;
        println!(
            "{:<40} {:>4} nodes, {:>4} scalars, {:>3} collections",
            file.name,
            index.nodes().len(),
            counts.0,
            counts.1
        );
    }

    let zero_width: usize = common::synthetic_valid()
        .iter()
        .map(|file| {
            SyntaxIndex::parse(&file.source)
                .expect("parses")
                .zero_width_leaves()
                .count()
        })
        .sum();
    println!(
        "scalars asserted: {scalars}  collections: {collections}  aliases: {aliases}           zero-width leaves skipped: {zero_width}"
    );
    assert_eq!(
        zero_width, SYNTHETIC_ZERO_WIDTH_LEAVES,
        "the zero-width skip above must stay bounded"
    );
    for failure in failures.iter().take(20) {
        println!("  {failure}");
    }
    // Exact, not `>`: the synthetic corpus is committed, so a fixture appearing
    // or disappearing must be a deliberate act that updates these constants.
    assert_eq!(scalars, SYNTHETIC_SCALARS, "scalar nodes in the corpus");
    assert_eq!(
        collections, SYNTHETIC_COLLECTIONS,
        "collection nodes in the corpus"
    );
    assert_eq!(aliases, SYNTHETIC_ALIASES, "alias nodes in the corpus");
    assert!(failures.is_empty(), "{} slice failures", failures.len());
} // End of function every_node_span_slices_the_source_it_was_written_as()

#[test]
fn every_real_corpus_node_span_slices_the_source_it_was_written_as() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "every_real_corpus_node_span_slices_the_source_it_was_written_as",
        &files,
    ) {
        return;
    }

    let mut scalars = 0usize;
    let mut processed = 0usize;
    let mut failures: Vec<String> = Vec::new();
    for file in &files {
        let index = SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
        scalars += check_slice_fidelity(&file.name, &file.source, &index, &mut failures).0;
        processed += 1;
    }

    println!(
        "real corpus: {processed} files, {scalars} scalar spans decode to their value, {} failures",
        failures.len()
    );
    // Only the file NAME and an offset are ever printed, never a line of the
    // owner's configuration.
    for failure in failures.iter().take(10) {
        println!("  {failure}");
    }
    // No count is pinned: the real corpus is per-machine and absent in CI. What
    // is pinned is that every discovered file was processed and nothing failed.
    assert_eq!(processed, files.len(), "every discovered file is processed");
    assert!(failures.is_empty(), "{} slice failures", failures.len());
} // End of function every_real_corpus_node_span_slices_the_source_it_was_written_as()

// ===========================================================================
// 2. Reconstruction — the headline acceptance property
// ===========================================================================

#[test]
fn frontier_and_gaps_reconstruct_every_synthetic_fixture_byte_for_byte() {
    println!("\n--- reconstruction over the valid synthetic corpus ---");
    println!(
        "{:<40} {:>6} {:>6} {:>6} {:>5} {:>5} {:>5}",
        "fixture", "bytes", "leaves", "gaps", "bom", "crlf", "eol"
    );

    let mut reconstructed = 0usize;
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
        assert_reconstructs(&file.name, &file.source, &index);
        let segments = index.segments();
        println!(
            "{:<40} {:>6} {:>6} {:>6} {:>5} {:>5} {:>5}",
            file.name,
            file.source.len(),
            index.frontier().len(),
            segments.iter().filter(|segment| segment.is_gap()).count(),
            index.preamble().bom,
            file.source.contains("\r\n"),
            file.source.ends_with('\n'),
        );
        reconstructed += 1;
    }

    println!("fixtures reconstructed byte-for-byte: {reconstructed}");
    assert_eq!(
        reconstructed, SYNTHETIC_FIXTURES,
        "every valid fixture must be covered, and the count is deliberate"
    );
} // End of function frontier_and_gaps_reconstruct_every_synthetic_fixture_byte_for_byte()

#[test]
fn the_awkward_fixtures_keep_their_distinguishing_bytes_through_a_round_trip() {
    // The three fixtures no editor may "fix", checked one at a time so a
    // failure names the property that broke rather than a generic mismatch.
    let bom = fixture("bom-utf8.yml");
    let index = SyntaxIndex::parse(&bom.source).expect("a stripped BOM lets the document parse");
    assert!(index.preamble().bom, "the BOM must be recorded");
    assert!(
        rebuild(&bom.source, &index).starts_with('\u{feff}'),
        "the BOM must come back"
    );
    assert_reconstructs(&bom.name, &bom.source, &index);
    // The BOM is trivia: no leaf may claim it.
    assert!(
        index.frontier().iter().all(|entry| entry.span.start >= 3),
        "no node may start inside the BOM"
    );

    let crlf = fixture("crlf-line-endings.yml");
    let index = SyntaxIndex::parse(&crlf.source).expect("parses");
    let rebuilt = rebuild(&crlf.source, &index);
    assert!(rebuilt.contains("\r\n"), "CRLF must survive");
    assert_eq!(
        rebuilt.matches("\r\n").count(),
        crlf.source.matches("\r\n").count()
    );
    assert_reconstructs(&crlf.name, &crlf.source, &index);

    let bare = fixture("no-trailing-newline.yml");
    let index = SyntaxIndex::parse(&bare.source).expect("parses");
    let rebuilt = rebuild(&bare.source, &index);
    assert!(
        !rebuilt.ends_with('\n'),
        "the missing final newline must stay missing"
    );
    assert_reconstructs(&bare.name, &bare.source, &index);
} // End of function the_awkward_fixtures_keep_their_distinguishing_bytes_through_a_round_trip()

#[test]
fn frontier_and_gaps_reconstruct_the_real_corpus_byte_for_byte() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "frontier_and_gaps_reconstruct_the_real_corpus_byte_for_byte",
        &files,
    ) {
        return;
    }

    let mut leaves = 0usize;
    let mut gaps = 0usize;
    let mut reconstructed = 0usize;
    for file in &files {
        let index = SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
        assert_reconstructs(&file.name, &file.source, &index);
        leaves += index.frontier().len();
        gaps += index.gaps().len();
        reconstructed += 1;
    }

    println!(
        "real corpus: {reconstructed} files reconstructed byte-for-byte ({leaves} leaves, {gaps} gaps)"
    );
    assert_eq!(
        reconstructed,
        files.len(),
        "every discovered file is reconstructed"
    );
} // End of function frontier_and_gaps_reconstruct_the_real_corpus_byte_for_byte()

#[test]
fn the_frontier_is_ordered_non_overlapping_and_covers_only_leaves() {
    let mut checked = 0usize;
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        let mut cursor = 0usize;
        for entry in index.frontier() {
            assert!(
                entry.span.start >= cursor,
                "{}: frontier is not monotonic at {}",
                file.name,
                entry.span.start
            );
            assert!(
                !entry.span.is_empty(),
                "{}: zero-width frontier member",
                file.name
            );
            let node = index.node(entry.node).expect("frontier points at a node");
            assert!(
                matches!(node.kind, NodeKind::Scalar | NodeKind::Alias),
                "{}: only Scalar and Alias may be frontier members",
                file.name
            );
            cursor = entry.span.end;
            checked += 1;
        }
        assert!(cursor <= file.source.len());
    }
    println!("\nfrontier members checked for order and disjointness: {checked}");
    assert_eq!(
        checked, SYNTHETIC_FRONTIER_MEMBERS,
        "frontier members in the corpus"
    );
} // End of function the_frontier_is_ordered_non_overlapping_and_covers_only_leaves()

#[test]
fn no_comment_or_blank_line_is_hidden_inside_a_frontier_leaf() {
    // The frontier's whole purpose is to leave every comment in a gap. A block
    // scalar span that was not trimmed would swallow blank lines that YAML's
    // chomping rules make trivia, so this also guards the trim.
    let mut comments = 0usize;
    let mut blanks = 0usize;
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        for gap in index.gaps() {
            for line in gap.slice(&file.source).expect("gap slices").lines() {
                // A BOM is not whitespace to `str::trim`, and it sits in the
                // first gap of a file that has one. Phase 0b-2's scanner will
                // consume the preamble properly; here it is simply skipped.
                let trimmed = line.trim_start_matches('\u{feff}').trim();
                if trimmed.is_empty() {
                    blanks += 1;
                } else if trimmed.starts_with('#') {
                    comments += 1;
                }
            }
        }
    }
    println!("\ncomments recoverable from gaps: {comments}");
    println!("blank lines recoverable from gaps: {blanks}");
    // Exact figures over the trimmed leaf frontier. A regression in the
    // block-scalar trim shows up here immediately as a smaller blank-line
    // count: the untrimmed frontier recovers only 631 over the Phase 0a
    // fixtures alone.
    //
    // Both numbers moved when the Phase 0b-1 review was closed out, and the
    // move is fully accounted for:
    //
    // - Comments: 153 over the 19 Phase 0a fixtures, unchanged, plus 42 in the
    //   three fixtures added for the block-scalar shapes the corpus lacked.
    // - Blank lines: 636 over the same 19 fixtures — 31 fewer than the 667
    //   Phase 0a measured, which is exactly the number of block scalars in
    //   those fixtures. Under the old two-convention start, each ordinary
    //   block's first content line left its indentation in the preceding gap,
    //   and a per-gap line scan counted that indentation fragment as a blank
    //   line it was not. The single content-start convention hands that
    //   indentation to the scalar, so the spurious count is gone. Plus 52 real
    //   blank lines in the three new fixtures.
    assert_eq!(
        comments, SYNTHETIC_GAP_COMMENTS,
        "comment recovery from gaps"
    );
    assert_eq!(
        blanks, SYNTHETIC_GAP_BLANK_LINES,
        "blank-line recovery from gaps"
    );
} // End of function no_comment_or_blank_line_is_hidden_inside_a_frontier_leaf()

// ===========================================================================
// 3. Block scalars — the trim is the true content end
// ===========================================================================

#[test]
fn every_block_scalar_decodes_from_its_trimmed_span_and_header() {
    let mut decoded = 0usize;
    let mut overshooting = 0usize;
    let mut failures: Vec<String> = Vec::new();

    println!("\n--- block scalars decoded from (trimmed span, indent, header) ---");
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        let (count, over) = check_block_scalars(&file.name, &file.source, &index, &mut failures);
        if count > 0 {
            println!(
                "{:<40} {count} block scalars, {over} overshooting",
                file.name
            );
        }
        decoded += count;
        overshooting += over;
    }

    println!("block scalars decoded byte-exactly: {decoded}");
    println!("of those, spans whose reported end overshot: {overshooting}");
    for failure in failures.iter().take(10) {
        println!("  {failure}");
    }
    assert_eq!(
        decoded, SYNTHETIC_BLOCK_SCALARS,
        "block scalars in the corpus, every one decoded byte-exactly"
    );
    assert_eq!(
        overshooting, SYNTHETIC_OVERSHOOTING_BLOCKS,
        "the overshoot is the rule, not an edge case"
    );
    assert!(
        failures.is_empty(),
        "{} block scalars failed",
        failures.len()
    );
} // End of function every_block_scalar_decodes_from_its_trimmed_span_and_header()

#[test]
fn every_real_corpus_block_scalar_decodes_from_its_trimmed_span_and_header() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "every_real_corpus_block_scalar_decodes_from_its_trimmed_span_and_header",
        &files,
    ) {
        return;
    }

    let mut decoded = 0usize;
    let mut overshooting = 0usize;
    let mut processed = 0usize;
    let mut failures: Vec<String> = Vec::new();
    for file in &files {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        let (count, over) = check_block_scalars(&file.name, &file.source, &index, &mut failures);
        decoded += count;
        overshooting += over;
        processed += 1;
    }

    println!(
        "real corpus: {processed} files, {decoded} block scalars decoded, {overshooting} had an overshoot"
    );
    for failure in failures.iter().take(10) {
        println!("  {failure}");
    }
    // Counts are not pinned here: the real corpus is per-machine and absent in
    // CI. Every discovered file is processed and nothing may fail.
    assert_eq!(processed, files.len(), "every discovered file is processed");
    assert!(
        failures.is_empty(),
        "{} block scalars failed",
        failures.len()
    );
} // End of function every_real_corpus_block_scalar_decodes_from_its_trimmed_span_and_header()

#[test]
fn the_block_scalar_matrix_trims_to_the_exact_bytes_measured_in_phase_0a() {
    // The eight rows `tests/parser_evaluation.rs` pins, restated against the
    // real implementation rather than a probe helper. `span` is what the node
    // now carries; `trivia` is what the trim handed back to the gap scanner.
    let file = fixture("block-scalars.yml");
    let index = SyntaxIndex::parse(&file.source).expect("parses");
    let blocks: Vec<(&Node, &ScalarNode)> = index
        .nodes()
        .iter()
        .filter_map(|node| node.scalar.as_ref().map(|scalar| (node, scalar)))
        .filter(|(_, scalar)| scalar.style().is_block())
        .collect();
    assert_eq!(blocks.len(), 11, "the fixture must cover the whole matrix");

    // `span` now starts at the head of the first body line, so it carries that
    // line's indentation exactly like every later line's: one convention for
    // every block shape (see `ScalarPresentation::content_span`).
    let cases: &[(&str, Chomping, &str, &str)] = &[
        (
            "|",
            Chomping::Clip,
            "      clip line one\n      clip line two\n",
            "\n\n    ",
        ),
        ("|-", Chomping::Strip, "      stripped", "\n    "),
        ("|+", Chomping::Keep, "      kept\n\n\n", "    "),
        (
            "|2-",
            Chomping::Strip,
            "        four-space first line\n      two-space second line",
            "\n    ",
        ),
        (
            "|2+",
            Chomping::Keep,
            "        four-space first line\n\n",
            "    ",
        ),
        (">", Chomping::Clip, "      folded clip\n", "    "),
        (">-", Chomping::Strip, "      folded strip", "\n    "),
        (">+", Chomping::Keep, "      folded keep\n\n", "    "),
    ];

    println!("\n--- the trimmed block-scalar matrix ---");
    for (header_text, chomping, span_text, trivia) in cases {
        let (node, scalar) = blocks
            .iter()
            .find(|(node, scalar)| {
                scalar
                    .header
                    .is_some_and(|header| header.span.slice(&file.source) == Some(header_text))
                    && node.span.slice(&file.source) == Some(*span_text)
            })
            .unwrap_or_else(|| panic!("no block scalar with header {header_text:?}"));
        let header = scalar.header.expect("a block scalar has a header");
        println!(
            "{header_text:<4} chomping={:?} span={span_text:?} trivia={trivia:?}",
            header.chomping
        );
        assert_eq!(header.chomping, *chomping, "chomping of {header_text}");
        assert!(!header.inside_span, "{header_text} is a complete block");
        assert_eq!(
            ByteSpan::new(node.span.end, scalar.reported_span.end).slice(&file.source),
            Some(*trivia),
            "trivia the trim handed back after {header_text}"
        );
        assert_eq!(
            scalar.presentation.explicit_indent,
            header_text
                .chars()
                .find(|character| character.is_ascii_digit())
                .map(|digit| digit as usize - '0' as usize),
            "explicit indent of {header_text}"
        );
    }
} // End of function the_block_scalar_matrix_trims_to_the_exact_bytes_measured_in_phase_0a()

#[test]
fn every_block_shape_uses_the_same_content_start_convention() {
    // F1. One rule for every shape: the content span begins immediately after
    // the header line's break, so it carries the FIRST body line's indentation
    // exactly like every later line's. Two conventions would leave a future
    // emitter unable to indent a replacement without knowing which shape it was
    // looking at, and it would under-indent or double-indent — changing YAML
    // structure rather than a value.
    println!("\n--- one content-start convention, every shape ---");
    let sources = [
        // Ordinary blocks: the first body line's indentation is IN the span.
        "matches:\n  - replace: |\n      body\n    label: x\n",
        "matches:\n  - replace: |-\n      body\n    label: x\n",
        "matches:\n  - replace: >\n      body\n    label: x\n",
        // Blocks that open with empty lines: the leading breaks are content,
        // and the first non-empty line's indentation is in the span too.
        "matches:\n  - replace: |\n\n      body\n    label: x\n",
        "matches:\n  - replace: |\n\n\n      body\n    label: x\n",
        "matches:\n  - replace: |-\n\n      body\n    label: x\n",
        "matches:\n  - replace: |+\n\n      body\n\n    label: x\n",
        "matches:\n  - replace: >\n\n      body\n    label: x\n",
        "matches:\n  - replace: >-\n\n\n      body\n    label: x\n",
        // An explicit indentation indicator, where the content indent is not
        // the first non-space column.
        "matches:\n  - replace: |2\n        deeper\n      base\n    label: x\n",
    ];
    for source in sources {
        let index = SyntaxIndex::parse(source).expect("parses");
        let mut failures = Vec::new();
        let (decoded, _) = check_block_scalars("convention", source, &index, &mut failures);
        let node = index
            .nodes()
            .iter()
            .find(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.style().is_block())
            })
            .expect("a block scalar");
        let scalar = node.scalar.as_ref().expect("a block scalar");
        let text = node.span.slice(source).expect("the span slices");
        println!("{source:?} -> span {text:?} value {:?}", scalar.value);

        // The single invariant: the byte before the content start is the
        // header line's break.
        assert!(
            source[..node.span.start].ends_with(['\n', '\r']),
            "{source:?}: the content span must start just past a line break"
        );
        // Which means every non-empty line of the span — the first included —
        // carries the recorded indentation.
        let indent = " ".repeat(scalar.presentation.indent);
        for line in text.split('\n') {
            let line = line.strip_suffix('\r').unwrap_or(line);
            assert!(
                line.is_empty() || line.starts_with(indent.as_str()),
                "{source:?}: line {line:?} is not indented as recorded"
            );
        } // End of the loop over the content span's physical lines
        assert_eq!(decoded, 1, "{source:?} must decode");
        assert!(failures.is_empty(), "{failures:?}");
        assert_eq!(rebuild(source, &index), source);
    } // End of the loop over the block shapes
} // End of function every_block_shape_uses_the_same_content_start_convention()

#[test]
fn terminal_spaces_at_end_of_source_stay_inside_the_block_scalar() {
    // F2. Mid-document a trailing run of spaces is the next token's
    // indentation and must be handed back as trivia. At end-of-source there is
    // no next token, so the run is scalar data: trimming it shortens the user's
    // expansion by exactly those bytes, silently.
    println!("\n--- terminal whitespace at end-of-source ---");
    for (source, expected_span) in [
        ("a: |\n  body  ", "  body  "),
        ("a: |-\n  body  ", "  body  "),
        ("a: |+\n  body  ", "  body  "),
        ("a: |\n  body\t\t", "  body\t\t"),
        // The same run mid-document belongs to the following key.
        ("a: |\n  body\nb: 1\n", "  body\n"),
    ] {
        let index = SyntaxIndex::parse(source).expect("parses");
        let node = index
            .nodes()
            .iter()
            .find(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.style().is_block())
            })
            .expect("a block scalar");
        println!("{source:?} -> span {:?}", node.span.slice(source));
        assert_eq!(node.span.slice(source), Some(expected_span));

        let mut failures = Vec::new();
        let (decoded, _) = check_block_scalars("terminal", source, &index, &mut failures);
        assert_eq!(
            decoded, 1,
            "{source:?} must decode to the substrate's value"
        );
        assert!(failures.is_empty(), "{failures:?}");
        assert_eq!(rebuild(source, &index), source);
    } // End of the loop over the terminal-whitespace shapes
} // End of function terminal_spaces_at_end_of_source_stay_inside_the_block_scalar()

#[test]
fn the_new_block_scalar_fixtures_cover_the_shapes_the_corpus_was_missing() {
    // F9. Three shapes were absent from both corpora until now, so nothing
    // proved the layer handled them: a block opening with blank lines, a block
    // with genuine terminal spaces at EOF, and a folded block with
    // more-indented lines.
    println!("\n--- the shapes the corpus was missing ---");

    let leading = fixture("block-scalar-leading-blank-lines.yml");
    let index = SyntaxIndex::parse(&leading.source).expect("parses");
    let opening_blank = index
        .nodes()
        .iter()
        .filter(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.style().is_block())
                && node
                    .span
                    .slice(&leading.source)
                    .is_some_and(|text| text.starts_with('\n'))
        })
        .count();
    println!(
        "{}: {opening_blank} blocks open with a blank line",
        leading.name
    );
    assert_eq!(opening_blank, 5, "every block in the fixture opens blank");
    assert_reconstructs(&leading.name, &leading.source, &index);

    let terminal = fixture("block-scalar-terminal-spaces.yml");
    assert!(
        !terminal.source.ends_with('\n') && terminal.source.ends_with("  "),
        "the fixture must still end in two spaces with no final newline"
    );
    let index = SyntaxIndex::parse(&terminal.source).expect("parses");
    let last_block = index
        .nodes()
        .iter()
        .rfind(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.style().is_block())
        })
        .expect("a block scalar");
    println!(
        "{}: last block span ends at {} of {} bytes",
        terminal.name,
        last_block.span.end,
        terminal.source.len()
    );
    assert_eq!(
        last_block.span.end,
        terminal.source.len(),
        "the terminal spaces are content, so the span runs to end-of-source"
    );
    assert!(last_block
        .span
        .slice(&terminal.source)
        .is_some_and(|text| text.ends_with("  ")));
    assert_reconstructs(&terminal.name, &terminal.source, &index);

    let folded = fixture("folded-more-indented.yml");
    let index = SyntaxIndex::parse(&folded.source).expect("parses");
    let more_indented = index
        .nodes()
        .iter()
        .filter(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.style() == ScalarStyle::Folded)
                && node.scalar.as_ref().is_some_and(|scalar| {
                    // A more-indented line survives folding as a line that
                    // still starts with a space in the decoded value.
                    scalar.value.lines().any(|line| line.starts_with(' '))
                })
        })
        .count();
    println!(
        "{}: {more_indented} folded blocks keep a more-indented line",
        folded.name
    );
    assert_eq!(
        more_indented, 4,
        "every folded block in the fixture must keep an unfolded line"
    );
    assert_reconstructs(&folded.name, &folded.source, &index);
} // End of function the_new_block_scalar_fixtures_cover_the_shapes_the_corpus_was_missing()

#[test]
fn a_truncated_block_header_is_not_lexed_backwards() {
    // Risk R5, the one measured case where the reported span contains the
    // header. The backwards lexer must refuse to run, or it walks into the
    // previous line and mis-locates the node while the user is still typing.
    //
    // The content span must also start *after* the header line, never in the
    // middle of it: a span that began right after the `|` would claim the
    // header's own line break as content, and rewriting it would splice the new
    // value onto the header line and destroy the block.
    println!("\n--- truncated block headers (R5) ---");
    for (source, header_text) in [
        ("replace: |\n", "|"),
        ("replace: |2-\n", "|2-"),
        ("replace: >\n", ">"),
        ("matches:\n  - replace: |\n", "|"),
        ("replace: |", "|"),
        ("replace: |\n\n", "|"),
    ] {
        let index = SyntaxIndex::parse(source).expect("the substrate accepts it");
        let scalar = index
            .nodes()
            .iter()
            .filter_map(|node| node.scalar.as_ref())
            .find(|scalar| scalar.style().is_block())
            .unwrap_or_else(|| panic!("{source:?} must still yield a block scalar"));
        let header = scalar.header.expect("the header is still recoverable");
        let content = scalar.presentation.content_span;
        println!(
            "{source:?} -> header {:?} inside_span={} content {:?} value {:?}",
            header.span.slice(source),
            header.inside_span,
            content.slice(source),
            scalar.value
        );
        assert!(header.inside_span, "R5 must be flagged for {source:?}");
        assert_eq!(header.span.slice(source), Some(header_text));
        assert!(
            content.start >= header.span.end,
            "{source:?}: content may never start inside the header"
        );
        assert!(
            content
                .slice(source)
                .is_some_and(|text| !text.starts_with(['|', '>'])),
            "{source:?}: the header must stay outside the content span"
        );
        // The header's own line break is not content: it belongs to the gap.
        assert!(
            source.get(..content.start).is_some_and(
                |before| before.ends_with(['\n', '\r']) || content.start == source.len()
            ),
            "{source:?}: the content must begin just past the header line"
        );
        // F5: the presentation must agree with the value the substrate decoded,
        // not merely reconstruct the bytes.
        assert_eq!(
            decode_block(
                content.slice(source).expect("the content span slices"),
                scalar.presentation.indent,
                scalar.style(),
                scalar.presentation.chomping,
                header_line_is_terminated(source, scalar),
            ),
            Some(scalar.value.clone()),
            "{source:?}: presentation and decoded value must agree"
        );
        // And the document still rebuilds exactly, header included.
        assert_eq!(rebuild(source, &index), source);
    } // End of the loop over the truncated-header shapes
} // End of function a_truncated_block_header_is_not_lexed_backwards()

#[test]
fn the_scalar_check_rejects_the_spans_the_old_delimiter_check_accepted() {
    // F6. "Scalar spans slice exactly" used to assert almost nothing: an empty
    // scalar passed automatically, a multi-line plain scalar passed merely by
    // containing a newline, a double-quoted scalar was checked only for its two
    // quotes, and a block scalar only for not starting with its header. Each
    // row below is a span/value pair that is plainly wrong and that the old
    // predicate nevertheless accepted.

    /// The predicate this file used to ship, kept verbatim as the baseline the
    /// replacement is measured against. It is never used to assert anything.
    fn old_predicate(text: &str, scalar: &ScalarNode) -> bool {
        if text.is_empty() {
            return true;
        }
        match scalar.style() {
            ScalarStyle::Plain => text.contains('\n') || text == scalar.value,
            ScalarStyle::SingleQuoted => {
                text.starts_with('\'')
                    && text.ends_with('\'')
                    && text.len() >= 2
                    && (text.contains('\n')
                        || text[1..text.len() - 1].replace("''", "'") == scalar.value)
            }
            ScalarStyle::DoubleQuoted => {
                text.starts_with('"') && text.ends_with('"') && text.len() >= 2
            }
            ScalarStyle::Literal | ScalarStyle::Folded => {
                scalar.header_inside_span() || !text.starts_with(['|', '>'])
            }
        }
    } // End of function old_predicate()

    println!("\n--- spans the old delimiter check waved through ---");
    let wrong: &[(&str, ScalarStyle, &str)] = &[
        // An empty span against a non-empty value: the automatic pass.
        ("", ScalarStyle::Plain, "not empty at all"),
        // A multi-line plain scalar whose span lost its last word.
        (
            "first line\n  second lin",
            ScalarStyle::Plain,
            "first line second line",
        ),
        // A double-quoted token whose escapes were never checked.
        ("\"line\\tone\"", ScalarStyle::DoubleQuoted, "line one"),
        // A double-quoted token with the wrong content between right quotes.
        ("\"something else\"", ScalarStyle::DoubleQuoted, "expected"),
        // A single-quoted token that folds to something else.
        (
            "'first\n\n  second'",
            ScalarStyle::SingleQuoted,
            "first second",
        ),
    ];
    for (text, style, value) in wrong {
        let scalar = flow_scalar_node(*style, value);
        println!("{style:?} span {text:?} vs value {value:?}");
        assert!(
            old_predicate(text, &scalar),
            "the baseline must actually have accepted {text:?}, or this proves nothing"
        );
        assert!(
            !scalar_text_matches(text, text, &scalar),
            "the replacement must reject {text:?} against {value:?}"
        );
    } // End of the loop over the wrongly accepted spans

    // And the correct spellings of the same shapes must still be accepted, so
    // the new check is not merely stricter by rejecting everything.
    let right: &[(&str, ScalarStyle, &str)] = &[
        ("", ScalarStyle::Plain, ""),
        (
            "first line\n  second line",
            ScalarStyle::Plain,
            "first line second line",
        ),
        ("\"line\\tone\"", ScalarStyle::DoubleQuoted, "line\tone"),
        ("\"a\\u00e9b\"", ScalarStyle::DoubleQuoted, "a\u{e9}b"),
        (
            "\"joined \\\n   up\"",
            ScalarStyle::DoubleQuoted,
            "joined up",
        ),
        (
            "'first\n\n  second'",
            ScalarStyle::SingleQuoted,
            "first\nsecond",
        ),
        ("'don''t'", ScalarStyle::SingleQuoted, "don't"),
    ];
    for (text, style, value) in right {
        let scalar = flow_scalar_node(*style, value);
        assert!(
            scalar_text_matches(text, text, &scalar),
            "{style:?} span {text:?} must decode to {value:?}, got {:?}",
            decode_scalar(text, text, &scalar)
        );
    } // End of the loop over the correctly spelled spans
} // End of function the_scalar_check_rejects_the_spans_the_old_delimiter_check_accepted()

#[test]
fn a_multi_line_plain_scalar_decodes_from_its_span() {
    // The synthetic corpus has no multi-line plain scalar, so the folding path
    // that the strengthened check exercises would otherwise never run over real
    // parser output. These are parsed, not hand-built.
    println!("\n--- multi-line plain scalars ---");
    for source in [
        "matches:\n  - replace: first line\n      second line\n",
        "matches:\n  - replace: first line\n\n      after a blank\n",
        "items: [one\n  two, three]\n",
    ] {
        let index = SyntaxIndex::parse(source).expect("parses");
        let mut failures = Vec::new();
        check_slice_fidelity("multiline-plain", source, &index, &mut failures);
        let multiline = index
            .nodes()
            .iter()
            .filter(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.style() == ScalarStyle::Plain)
                    && node
                        .span
                        .slice(source)
                        .is_some_and(|text| text.contains('\n'))
            })
            .count();
        println!("{source:?} -> {multiline} multi-line plain scalars");
        assert_eq!(multiline, 1, "{source:?} must exercise the folding path");
        assert!(failures.is_empty(), "{failures:?}");
        assert_reconstructs("multiline-plain", source, &index);
    } // End of the loop over the multi-line plain sources
} // End of function a_multi_line_plain_scalar_decodes_from_its_span()

#[test]
fn no_quoted_scalar_in_either_corpus_falls_back_to_its_reported_span() {
    // The Phase 0c-2b review's finding 5. `SyntaxIndex` trims a quoted scalar's
    // reported end back to its closing delimiter (R20), and when it cannot lex
    // that delimiter it keeps the reported span rather than rejecting the
    // document: rejecting would make a real file unopenable for a case no
    // accepted document reaches, which is the R14 mistake. The span it keeps is
    // the exact one shown capable of swallowing a trailing comment, so the
    // fallback must be **observable**, and this is where it is observed — on real
    // documents, not on a hand-written probe.
    //
    // Pinned at zero over both corpora. If the substrate ever changes so that an
    // accepted document reaches the fallback, this fails instead of silently
    // publishing an overshooting span again.
    let mut quoted = 0usize;
    let mut fallbacks = 0usize;
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        quoted += index
            .nodes()
            .iter()
            .filter(|node| {
                node.scalar.as_ref().is_some_and(|scalar| {
                    matches!(
                        scalar.style(),
                        ScalarStyle::SingleQuoted | ScalarStyle::DoubleQuoted
                    )
                })
            })
            .count();
        fallbacks += index.unlexable_quoted_scalars();
    } // End of the loop over the valid synthetic corpus
    println!("\nsynthetic: {quoted} quoted scalars, {fallbacks} reported-span fallbacks");
    assert!(quoted > 0, "the corpus must contain quoted scalars");
    assert_eq!(fallbacks, 0, "quoted-span fallbacks in the corpus");

    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "no_quoted_scalar_in_either_corpus_falls_back_to_its_reported_span",
        &files,
    ) {
        return;
    }
    let mut real = 0usize;
    for file in &files {
        real += SyntaxIndex::parse(&file.source)
            .expect("parses")
            .unlexable_quoted_scalars();
    } // End of the loop over the real corpus
    println!("real: {real} reported-span fallbacks");
    assert_eq!(real, 0, "quoted-span fallbacks in the real corpus");
} // End of function no_quoted_scalar_in_either_corpus_falls_back_to_its_reported_span()

// ===========================================================================
// 4. No character offset may be mistaken for a byte offset
// ===========================================================================

#[test]
fn non_ascii_documents_produce_byte_spans_not_character_spans() {
    // `unicode-offsets.yml` separates all four plausible offset-counting
    // schemes: precomposed é, decomposed é (two code points), an astral emoji.
    // 29 of the 33 spans in `non-ascii.yml` truncate a multi-byte character if
    // a reported offset is trusted as a byte index, so a regression in the
    // `CharToByte` adapter fails here loudly rather than corrupting a file.
    println!("\n--- byte spans over the non-ASCII fixtures ---");
    for name in ["unicode-offsets.yml", "non-ascii.yml"] {
        let file = fixture(name);
        let index = SyntaxIndex::parse(&file.source).expect("parses");

        let multibyte = file.source.chars().filter(|c| c.len_utf8() > 1).count();
        assert!(multibyte > 0, "{name} must contain multi-byte characters");

        let mut divergences = 0usize;
        for node in index.nodes() {
            let Some(scalar) = node.scalar.as_ref() else {
                continue;
            };
            // The span must slice, and slice to the right thing.
            let text = node
                .span
                .slice(&file.source)
                .unwrap_or_else(|| panic!("{name}: span {:?} does not slice", node.span));
            if scalar.style() == ScalarStyle::Plain && !text.contains('\n') {
                assert_eq!(
                    text, scalar.value,
                    "{name}: plain token must equal its value"
                );
            }
            // What the same span would have sliced had the reported character
            // offset been used directly. Every divergence is a byte the naive
            // reading would have cut in half, or dropped.
            let naive = ByteSpan::new(
                char_offset(&file.source, node.span.start),
                char_offset(&file.source, node.span.end),
            );
            if naive.slice(&file.source) != Some(text) {
                divergences += 1;
            }
        }

        println!("{name}: {multibyte} multi-byte characters, {divergences} spans a character index would have sliced wrongly");
        assert_reconstructs(&file.name, &file.source, &index);
        assert!(
            divergences > 0,
            "{name} must actually exercise the hazard, or it proves nothing"
        );
    }

    // The concrete damage, restated on the fixture the Phase 0a evaluation
    // measured it on: 29 of the 33 scalar spans in `non-ascii.yml` slice to
    // something different — usually a character cut in half — if the reported
    // offset is used as a byte index.
    let file = fixture("non-ascii.yml");
    let index = SyntaxIndex::parse(&file.source).expect("parses");
    let scalars: Vec<&Node> = index
        .nodes()
        .iter()
        .filter(|node| node.kind == NodeKind::Scalar)
        .collect();
    let corrupted = scalars
        .iter()
        .filter(|node| {
            let naive = ByteSpan::new(
                char_offset(&file.source, node.span.start),
                char_offset(&file.source, node.span.end),
            );
            naive.slice(&file.source) != node.span.slice(&file.source)
        })
        .count();
    println!(
        "non-ascii.yml: {corrupted} of {} scalar spans would slice wrongly as character indices",
        scalars.len()
    );
    assert_eq!(scalars.len(), 33, "the fixture's scalar count is pinned");
    assert_eq!(
        corrupted, 29,
        "the exact damage the CharToByte adapter prevents"
    );
} // End of function non_ascii_documents_produce_byte_spans_not_character_spans()

// ===========================================================================
// Structure, errors and the risks Phase 0b-1 only observes
// ===========================================================================

#[test]
fn the_tree_is_internally_consistent() {
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        for node in index.nodes() {
            // Parent and child agree.
            if let Some(parent) = node.parent {
                assert!(
                    index
                        .node(parent)
                        .expect("parent exists")
                        .children
                        .contains(&node.id),
                    "{}: node {:?} is not among its parent's children",
                    file.name,
                    node.id
                );
            }
            // A collection encloses every child.
            for child in &node.children {
                let child = index.node(*child).expect("child exists");
                assert!(
                    node.span.contains(child.span),
                    "{}: {:?} {:?} does not contain child {:?}",
                    file.name,
                    node.kind,
                    node.span,
                    child.span
                );
            }
            // Kind-specific payloads are present exactly where they belong.
            assert_eq!(node.scalar.is_some(), node.kind == NodeKind::Scalar);
            assert_eq!(
                node.collection_style.is_some(),
                matches!(node.kind, NodeKind::Mapping | NodeKind::Sequence)
            );
            assert_eq!(
                node.document_markers.is_some(),
                node.kind == NodeKind::Document
            );
        }
        assert!(!index.documents().is_empty(), "{}: no document", file.name);
    }
} // End of function the_tree_is_internally_consistent()

#[test]
fn multi_document_streams_are_kept_whole() {
    let file = fixture("multi-document.yml");
    let index = SyntaxIndex::parse(&file.source).expect("parses");
    assert_eq!(index.documents().len(), 3, "three documents in the stream");
    for (position, id) in index.documents().iter().enumerate() {
        let document = index.node(*id).expect("document node");
        assert_eq!(document.document_index, position);
        assert!(
            document.document_markers.expect("markers").start.is_some(),
            "every document in this fixture opens with an explicit `---`"
        );
    }
    assert_reconstructs(&file.name, &file.source, &index);
} // End of function multi_document_streams_are_kept_whole()

#[test]
fn flow_and_block_collections_are_told_apart() {
    let file = fixture("flow-collections.yml");
    let index = SyntaxIndex::parse(&file.source).expect("parses");
    let mut flow = 0usize;
    let mut block = 0usize;
    for node in index.nodes() {
        match node.collection_style {
            Some(CollectionStyle::Flow) => {
                let text = node.span.slice(&file.source).expect("slices");
                assert!(
                    text.starts_with(['[', '{']) && text.ends_with([']', '}']),
                    "a flow collection spans bracket to bracket: {text:?}"
                );
                flow += 1;
            }
            Some(CollectionStyle::Block) => block += 1,
            None => {}
        }
    }
    println!("\nflow-collections.yml: {flow} flow collections, {block} block collections");
    assert!(flow >= 6, "the fixture must exercise flow collections");
    assert!(block >= 2, "and block ones too");
} // End of function flow_and_block_collections_are_told_apart()

#[test]
fn merge_keys_and_aliases_are_classified_syntactically() {
    // Risk R8: `<<` arrives as an ordinary scalar key and an alias is not a
    // scalar value, so a resolver that assumes key/value scalar pairs picks the
    // wrong node. Recording the role and the kind separately is what makes the
    // distinction available to Phase 0c.
    let file = fixture("anchors-aliases-tags-merge.yml");
    let index = SyntaxIndex::parse(&file.source).expect("parses");

    let merge_keys = index
        .nodes()
        .iter()
        .filter(|node| {
            node.role == espansoconfig_core::syntax::NodeRole::MappingKey
                && node.span.slice(&file.source) == Some("<<")
        })
        .count();
    let aliases = index
        .nodes()
        .iter()
        .filter(|node| node.kind == NodeKind::Alias)
        .count();
    let anchors = index
        .nodes()
        .iter()
        .filter(|node| node.anchor.is_some())
        .count();
    let tags = index
        .nodes()
        .iter()
        .filter(|node| node.tag.is_some())
        .count();

    println!("\nanchors-aliases-tags-merge.yml: {merge_keys} merge keys, {aliases} aliases, {anchors} anchored nodes, {tags} tagged nodes");
    assert!(merge_keys >= 1, "the fixture must carry a merge key");
    assert!(aliases >= 1, "and an alias");
    assert!(anchors >= 1, "and an anchor definition");
    assert!(tags >= 1, "and an explicit tag");

    // An anchor's and a tag's spelling always lies outside the node span, so
    // both are gap material for the Phase 0b-2 scanner.
    for node in index.nodes().iter().filter(|node| node.anchor.is_some()) {
        let text = node.span.slice(&file.source).expect("slices");
        assert!(
            !text.starts_with('&'),
            "anchor spelling leaked into a span: {text:?}"
        );
        assert!(
            !text.starts_with('!'),
            "tag spelling leaked into a span: {text:?}"
        );
    }
} // End of function merge_keys_and_aliases_are_classified_syntactically()

#[test]
fn zero_width_nodes_are_recorded_without_claiming_bytes() {
    // Risk R7. What is observed, and deliberately not yet decided: an implicit
    // or empty node owns no bytes, so the colon, trailing spaces and line break
    // around it have no unique owner. They stay in the gaps until an ownership
    // policy exists.
    println!("\n--- zero-width nodes (R7) ---");
    for (source, expected) in [("empty:\n", 1usize), ("-", 1), ("key:\n  :\n", 2)] {
        let index = SyntaxIndex::parse(source).expect("accepted");
        let zero_width = index.zero_width_leaves().count();
        println!("{source:?} -> {zero_width} zero-width leaves");
        assert_eq!(zero_width, expected, "zero-width leaves in {source:?}");
        assert_eq!(rebuild(source, &index), source);
    }

    let mut corpus_zero_width = 0usize;
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        corpus_zero_width += index.zero_width_leaves().count();
    }
    println!("zero-width leaves across the valid corpus: {corpus_zero_width}");
} // End of function zero_width_nodes_are_recorded_without_claiming_bytes()

#[test]
fn invalid_fixtures_are_rejected_with_a_located_byte_offset() {
    println!("\n--- rejection on invalid/ ---");
    let files = common::synthetic_invalid();
    assert!(!files.is_empty(), "invalid/ must not be empty");

    let mut rejected = 0usize;
    for file in &files {
        match SyntaxIndex::parse(&file.source) {
            Err(SyntaxError::Parse(failure)) => {
                rejected += 1;
                let byte = failure.byte_index.expect("a located error converts");
                assert!(byte <= file.source.len());
                assert!(
                    file.source.is_char_boundary(byte),
                    "the reported byte offset must be a character boundary"
                );
                println!(
                    "{:<40} rejected at byte {byte} (line {})",
                    file.name, failure.line
                );
            }
            Err(other) => panic!("{}: unexpected error {other:?}", file.name),
            Ok(_) => println!("{:<40} accepted by the tokenizer", file.name),
        }
    }
    assert!(
        rejected >= files.len() - 1,
        "most invalid fixtures must fail at the parse level"
    );
} // End of function invalid_fixtures_are_rejected_with_a_located_byte_offset()

#[test]
fn truncating_a_fixture_at_every_character_never_panics_and_always_reconstructs() {
    // A desktop editor sees YAML mid-keystroke on every character typed. The
    // span layer must survive every one of those states: no panic, and when the
    // prefix parses, the frontier must still rebuild it exactly.
    let mut prefixes = 0usize;
    let mut accepted = 0usize;
    let mut rejected = 0usize;

    for name in [
        "block-scalars.yml",
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
            match SyntaxIndex::parse(prefix) {
                Ok(index) => {
                    assert_eq!(
                        rebuild(prefix, &index),
                        prefix,
                        "{name} truncated at byte {cut} must still reconstruct"
                    );
                    accepted += 1;
                }
                Err(SyntaxError::Parse(_)) => rejected += 1,
                Err(other) => panic!("{name} at byte {cut}: unexpected {other:?}"),
            }
        }
    }

    println!("\n--- truncation sweep over the span layer ---");
    println!("prefixes: {prefixes}  accepted and reconstructed: {accepted}  rejected: {rejected}");
    assert!(prefixes > 3_000, "the sweep must be broad");
    assert!(accepted > 0 && rejected > 0);
} // End of function truncating_a_fixture_at_every_character_never_panics_and_always_reconstructs()

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

/// Concatenates every segment's slice, in order.
fn rebuild(source: &str, index: &SyntaxIndex) -> String {
    let mut out = String::with_capacity(source.len());
    for segment in index.segments() {
        out.push_str(
            segment
                .span()
                .slice(source)
                .unwrap_or_else(|| panic!("segment {:?} does not slice", segment.span())),
        );
    }
    out
}

/// Asserts that `index` rebuilds `source` byte for byte, and that the segment
/// sequence is a proper partition: contiguous, ordered, gap-then-leaf.
fn assert_reconstructs(name: &str, source: &str, index: &SyntaxIndex) {
    let segments = index.segments();
    let mut cursor = 0usize;
    for segment in &segments {
        let span = segment.span();
        assert_eq!(span.start, cursor, "{name}: segments must be contiguous");
        assert!(span.end >= span.start, "{name}: inverted segment");
        cursor = span.end;
    }
    assert_eq!(cursor, source.len(), "{name}: segments must cover the file");
    // Two gaps may never be adjacent, or the partition is not canonical.
    for pair in segments.windows(2) {
        assert!(
            !(pair[0].is_gap() && pair[1].is_gap()),
            "{name}: adjacent gaps are not a canonical partition"
        );
    }
    assert_eq!(
        rebuild(source, index),
        source,
        "{name}: byte-for-byte rebuild"
    );
} // End of function assert_reconstructs()

/// Checks every node's span against the text it is written as.
///
/// Returns `(scalars, collections, aliases)` asserted, and appends a line to
/// `failures` for anything that does not hold. Failure lines carry a file name
/// and an offset only — never a slice of the source, because this helper also
/// runs over the owner's private configuration.
fn check_slice_fidelity(
    name: &str,
    source: &str,
    index: &SyntaxIndex,
    failures: &mut Vec<String>,
) -> (usize, usize, usize) {
    let mut scalars = 0usize;
    let mut collections = 0usize;
    let mut aliases = 0usize;

    for node in index.nodes() {
        let Some(text) = node.span.slice(source) else {
            failures.push(format!("{name}: span {:?} does not slice", node.span));
            continue;
        };
        match node.kind {
            NodeKind::Scalar => {
                let scalar = node.scalar.as_ref().expect("a scalar carries its detail");
                scalars += 1;
                // An **implicit** node — the value of `label:` with nothing
                // after it — owns no bytes at all (`PROGRESS.md`, R7), and the
                // substrate gives it the null value `~`. There is no token to
                // decode, so "the span slices to what the node is written as" is
                // vacuous rather than false. The skip is bounded:
                // `SYNTHETIC_ZERO_WIDTH_LEAVES` pins how many there are.
                if node.is_zero_width() {
                    continue;
                }
                if !scalar_text_matches(source, text, scalar) {
                    failures.push(format!(
                        "{name}: {:?} scalar at byte {} does not decode to its value",
                        scalar.style(),
                        node.span.start
                    ));
                }
            }
            NodeKind::Alias => {
                aliases += 1;
                if !text.starts_with('*') {
                    failures.push(format!(
                        "{name}: alias at byte {} is not `*…`",
                        node.span.start
                    ));
                }
            }
            NodeKind::Mapping | NodeKind::Sequence => collections += 1,
            NodeKind::Document => {}
        }
    }
    (scalars, collections, aliases)
} // End of function check_slice_fidelity()

/// Builds a flow `ScalarNode` for the decoder tests.
///
/// Only the style and the value matter to [`scalar_text_matches`] for a flow
/// scalar; the spans are what a caller would have obtained from the index and
/// are unused on that path.
fn flow_scalar_node(style: ScalarStyle, value: &str) -> ScalarNode {
    ScalarNode {
        value: value.to_owned(),
        presentation: ScalarPresentation {
            style,
            header_span: ByteSpan::default(),
            content_span: ByteSpan::default(),
            indent: 0,
            chomping: Chomping::Clip,
            explicit_indent: None,
            indicator_order: HeaderIndicatorOrder::IndentFirst,
        },
        reported_span: ByteSpan::default(),
        header: None,
    }
} // End of function flow_scalar_node()

/// Whether a scalar's span text is exactly the token it was written as.
///
/// The honest way to prove that is to **decode the span slice** with the rules
/// of its own style and require the result to equal the value the substrate
/// produced, byte for byte. The reverse — re-emitting the token from the value
/// — cannot be done: `"a\tb"`, `"a\x09b"` and a literal tab all decode to the
/// same value, so an encoder has no way to pick the spelling that is actually
/// on disk. Decoding has no such freedom, and it fails on every boundary error
/// this check is meant to catch:
///
/// - a span one byte short of the closing quote stops unescaping mid-sequence;
/// - a span that swallows the next line folds an extra word into the value;
/// - a block span with the wrong indentation boundary de-indents to the wrong
///   text;
/// - an empty span decodes to `""`, which only matches an empty value.
fn scalar_text_matches(source: &str, text: &str, scalar: &ScalarNode) -> bool {
    decode_scalar(source, text, scalar).is_some_and(|decoded| decoded == scalar.value)
}

/// Decodes a scalar's source token into the value it denotes.
///
/// Returns `None` when the token is not well formed for its style, which is
/// itself a span failure: a correctly delimited span always decodes.
fn decode_scalar(source: &str, text: &str, scalar: &ScalarNode) -> Option<String> {
    match scalar.style() {
        ScalarStyle::Plain => Some(fold_flow_lines(&flow_lines(text))),
        ScalarStyle::SingleQuoted => {
            let inner = text.strip_prefix('\'')?.strip_suffix('\'')?;
            // A lone `'` is a prefix and a suffix at once, so a one-byte token
            // would slip through the two strips above.
            if text.len() < 2 {
                return None;
            }
            Some(fold_flow_lines(&flow_lines(inner)).replace("''", "'"))
        }
        ScalarStyle::DoubleQuoted => {
            if text.len() < 2 {
                return None;
            }
            let inner = text.strip_prefix('"')?.strip_suffix('"')?;
            decode_double_quoted(inner)
        }
        ScalarStyle::Literal | ScalarStyle::Folded => decode_block(
            text,
            scalar.presentation.indent,
            scalar.style(),
            scalar.presentation.chomping,
            header_line_is_terminated(source, scalar),
        ),
    }
} // End of function decode_scalar()

/// Whether the block header's line ends in a line break.
///
/// The content span always starts immediately past that break, so the question
/// is answered by the byte before the content start. It is `false` only for a
/// header typed at the very end of a file (`replace: |` with no newline), where
/// YAML's "end of input is a line break" rule does not apply.
fn header_line_is_terminated(source: &str, scalar: &ScalarNode) -> bool {
    let start = scalar.presentation.content_span.start;
    source
        .get(..start)
        .is_some_and(|before| before.ends_with(['\n', '\r']))
} // End of function header_line_is_terminated()

/// Splits a flow scalar's token into logical lines and strips the whitespace
/// YAML removes around each line break.
///
/// The break itself is what triggers the stripping, so the first line keeps its
/// leading whitespace (it follows the opening quote) and the last keeps its
/// trailing whitespace (it precedes the closing one).
fn flow_lines(text: &str) -> Vec<String> {
    let raw = split_line_breaks(text);
    let last = raw.len() - 1;
    raw.iter()
        .enumerate()
        .map(|(position, line)| {
            let line = if position > 0 {
                line.trim_start_matches([' ', '\t'])
            } else {
                line.as_str()
            };
            let line = if position < last {
                line.trim_end_matches([' ', '\t'])
            } else {
                line
            };
            line.to_owned()
        })
        .collect()
} // End of function flow_lines()

/// Applies YAML flow folding to already-stripped lines.
///
/// One line break between two non-empty lines folds to a space; a run of `n`
/// breaks yields `n - 1` line breaks.
fn fold_flow_lines(lines: &[String]) -> String {
    let mut out = String::new();
    let mut pending = 0usize;
    let mut started = false;
    for (position, line) in lines.iter().enumerate() {
        if position > 0 {
            pending += 1;
        }
        if line.is_empty() && position < lines.len() - 1 {
            continue;
        }
        if !started {
            out.push_str(line);
            started = true;
        } else if pending == 1 {
            out.push(' ');
            out.push_str(line);
        } else {
            for _ in 0..pending.saturating_sub(1) {
                out.push('\n');
            }
            out.push_str(line);
        }
        pending = 0;
    }
    out
} // End of function fold_flow_lines()

/// Decodes the inside of a double-quoted token: the one style with escapes.
///
/// Line folding runs first, because a `\` at the end of a line escapes the
/// break itself and must join the two lines with nothing between them; the
/// escape sequences are then resolved on the folded text.
fn decode_double_quoted(inner: &str) -> Option<String> {
    let mut lines: Vec<(String, bool)> = Vec::new();
    let mut current = String::new();
    let mut characters = inner.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '\\' => match characters.peek().copied() {
                Some('\r') => {
                    characters.next();
                    if characters.peek() == Some(&'\n') {
                        characters.next();
                    }
                    lines.push((std::mem::take(&mut current), true));
                }
                Some('\n') => {
                    characters.next();
                    lines.push((std::mem::take(&mut current), true));
                }
                Some(escaped) => {
                    characters.next();
                    current.push('\\');
                    current.push(escaped);
                }
                None => current.push('\\'),
            },
            '\r' => {
                if characters.peek() == Some(&'\n') {
                    characters.next();
                }
                lines.push((std::mem::take(&mut current), false));
            }
            '\n' => lines.push((std::mem::take(&mut current), false)),
            other => current.push(other),
        }
    }
    lines.push((current, false));

    // Fold, treating an escaped break as no break at all.
    let mut folded: Vec<String> = Vec::new();
    for (position, (text, escaped)) in lines.iter().enumerate() {
        let text = if position > 0 {
            text.trim_start_matches([' ', '\t'])
        } else {
            text.as_str()
        };
        let text = if position + 1 < lines.len() && !escaped {
            text.trim_end_matches([' ', '\t'])
        } else {
            text
        };
        if position > 0 && lines[position - 1].1 {
            folded
                .last_mut()
                .expect("an escaped break always follows a line")
                .push_str(text);
        } else {
            folded.push(text.to_owned());
        }
    }
    unescape_double_quoted(&fold_flow_lines(&folded))
} // End of function decode_double_quoted()

/// Resolves the escape sequences of a double-quoted scalar.
fn unescape_double_quoted(text: &str) -> Option<String> {
    let mut out = String::with_capacity(text.len());
    let mut characters = text.chars();
    while let Some(character) = characters.next() {
        if character != '\\' {
            out.push(character);
            continue;
        }
        let escaped = characters.next()?;
        match escaped {
            '0' => out.push('\0'),
            'a' => out.push('\u{7}'),
            'b' => out.push('\u{8}'),
            't' | '\t' => out.push('\t'),
            'n' => out.push('\n'),
            'v' => out.push('\u{b}'),
            'f' => out.push('\u{c}'),
            'r' => out.push('\r'),
            'e' => out.push('\u{1b}'),
            ' ' => out.push(' '),
            '"' => out.push('"'),
            '/' => out.push('/'),
            '\\' => out.push('\\'),
            'N' => out.push('\u{85}'),
            '_' => out.push('\u{a0}'),
            'L' => out.push('\u{2028}'),
            'P' => out.push('\u{2029}'),
            'x' => out.push(take_hex(&mut characters, 2)?),
            'u' => out.push(take_hex(&mut characters, 4)?),
            'U' => out.push(take_hex(&mut characters, 8)?),
            _ => return None,
        }
    }
    Some(out)
} // End of function unescape_double_quoted()

/// Reads exactly `width` hexadecimal digits and returns the character they name.
fn take_hex(characters: &mut std::str::Chars<'_>, width: usize) -> Option<char> {
    let mut digits = String::with_capacity(width);
    for _ in 0..width {
        digits.push(characters.next()?);
    }
    char::from_u32(u32::from_str_radix(&digits, 16).ok()?)
} // End of function take_hex()

/// Splits `text` on every YAML line break: `\r\n`, a bare `\n` and a bare `\r`.
///
/// `n` breaks always yield `n + 1` pieces, so a trailing break produces a final
/// empty piece — which is how "the content ends with a line break" is told from
/// "the content ends with data".
fn split_line_breaks(text: &str) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    let mut characters = text.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '\r' => {
                if characters.peek() == Some(&'\n') {
                    characters.next();
                }
                lines.push(std::mem::take(&mut current));
            }
            '\n' => lines.push(std::mem::take(&mut current)),
            other => current.push(other),
        }
    }
    lines.push(current);
    lines
} // End of function split_line_breaks()

/// Decodes every block scalar from its trimmed span plus its header and
/// compares the result with the value the substrate produced.
///
/// Returns `(decoded, overshooting)`.
fn check_block_scalars(
    name: &str,
    source: &str,
    index: &SyntaxIndex,
    failures: &mut Vec<String>,
) -> (usize, usize) {
    let mut decoded = 0usize;
    let mut overshooting = 0usize;

    for node in index.nodes() {
        let Some(scalar) = node.scalar.as_ref() else {
            continue;
        };
        if !scalar.style().is_block() {
            continue;
        }
        if scalar.reported_span.end > node.span.end {
            overshooting += 1;
        }
        // The header must always be recoverable: since F3 there is no fallback
        // that publishes the reported span with no header behind it.
        if scalar.header.is_none() {
            failures.push(format!(
                "{name}: block scalar at byte {} carries no header",
                node.span.start
            ));
        }
        // Whatever the trim removed must be whitespace: a block-scalar span can
        // swallow blank lines and indentation but never a comment. The accepted
        // set is YAML's four separation characters, not `char::is_whitespace`,
        // which would also accept a non-breaking space (F7).
        let trivia = ByteSpan::new(node.span.end, scalar.reported_span.end.max(node.span.end))
            .slice(source)
            .unwrap_or("");
        if !trivia
            .chars()
            .all(|character| matches!(character, ' ' | '\t' | '\r' | '\n'))
        {
            failures.push(format!(
                "{name}: the trim at byte {} handed back non-whitespace",
                node.span.end
            ));
        }
        // The node span and the presentation's content span are the same region
        // by construction; a divergence would mean an emitter and a reader
        // disagreed about which bytes the value occupies.
        if scalar.presentation.content_span != node.span {
            failures.push(format!(
                "{name}: block scalar at byte {} has a content span that is not its node span",
                node.span.start
            ));
        }
        let content = node.span.slice(source).expect("the trimmed span slices");
        match decode_block(
            content,
            scalar.presentation.indent,
            scalar.style(),
            scalar.presentation.chomping,
            header_line_is_terminated(source, scalar),
        ) {
            Some(value) if value == scalar.value => decoded += 1,
            Some(_) => failures.push(format!(
                "{name}: block scalar at byte {} decodes to a different value",
                node.span.start
            )),
            None => failures.push(format!(
                "{name}: block scalar at byte {} is not indented as recorded",
                node.span.start
            )),
        }
    } // End of the loop over the index's nodes
    (decoded, overshooting)
} // End of function check_block_scalars()

/// Re-derives a block scalar's value from its content region alone.
///
/// This is the proof that the trimmed span is the *right* region: stripping
/// exactly `indent` columns from **every** line — the first line included,
/// because the content span starts just past the header line's break — and then
/// folding for `>` must reproduce the substrate's own value byte for byte.
///
/// The de-indentation is strict. There is **no `trim_start_matches` fallback**:
/// a line that is not indented as recorded is a failure, because that is
/// precisely what a wrong indentation boundary looks like. The one exception is
/// YAML's own: a line that is empty, or holds nothing but spaces and is shorter
/// than the indentation, is a blank content line and de-indents to nothing.
///
/// `header_line_terminated` says whether a line break followed the header. When
/// it did and the content does not end in a break, YAML's "end of input is a
/// line break" rule supplies the missing one, which clip and keep chomping then
/// retain — this is the case a block scalar with terminal spaces at EOF
/// exercises.
fn decode_block(
    content: &str,
    indent: usize,
    style: ScalarStyle,
    chomping: Chomping,
    header_line_terminated: bool,
) -> Option<String> {
    let prefix = " ".repeat(indent);
    let mut lines: Vec<String> = Vec::new();
    for raw in split_line_breaks(content) {
        match raw.strip_prefix(prefix.as_str()) {
            Some(stripped) => lines.push(stripped.to_owned()),
            // A blank line may be shorter than the block's indentation; YAML
            // reads it as an empty content line. Anything else is a genuine
            // indentation-boundary failure and must not be papered over.
            None if raw.chars().all(|character| character == ' ') => {
                lines.push(String::new());
            }
            None => return None,
        }
    } // End of the loop over the content's physical lines

    let mut value = match style {
        ScalarStyle::Literal => lines.join("\n"),
        ScalarStyle::Folded => fold_block_lines(&lines),
        _ => return None,
    };
    if header_line_terminated
        && !content.ends_with(['\n', '\r'])
        && chomping != Chomping::Strip
        && !value.ends_with('\n')
    {
        value.push('\n');
    }
    Some(value)
} // End of function decode_block()

/// Applies YAML block folding to already de-indented content lines.
///
/// A single line break between two ordinary content lines folds to one space;
/// a run of `n` breaks yields `n - 1` line breaks. Two exceptions, both of them
/// what the folded corpus fixture exists to pin:
///
/// - a **more-indented** line — one that still starts with a space or a tab
///   after de-indentation — is never folded, and neither are the breaks on
///   either side of it, so a run of `n` breaks next to one yields `n` breaks;
/// - line breaks *before* the first content line are leading breaks and are
///   kept in full, which is the block-opens-with-empty-lines case.
fn fold_block_lines(lines: &[String]) -> String {
    /// Whether a de-indented line is more-indented, and so never folded.
    fn more_indented(line: &str) -> bool {
        line.starts_with([' ', '\t'])
    }

    let mut out = String::new();
    let mut pending = 0usize;
    let mut previous: Option<&str> = None;
    for (position, line) in lines.iter().enumerate() {
        if position > 0 {
            pending += 1;
        }
        if line.is_empty() {
            continue;
        }
        match previous {
            // Leading breaks, before any content line, are kept in full.
            None => out.push_str(&"\n".repeat(pending)),
            Some(before) => {
                if more_indented(before) || more_indented(line) {
                    out.push_str(&"\n".repeat(pending));
                } else if pending == 1 {
                    out.push(' ');
                } else {
                    out.push_str(&"\n".repeat(pending - 1));
                }
            }
        }
        out.push_str(line);
        previous = Some(line);
        pending = 0;
    } // End of the loop over the de-indented content lines
    out.push_str(&"\n".repeat(pending));
    out
} // End of function fold_block_lines()

/// What the substrate would have reported for `byte_offset`, read naively as a
/// byte index.
///
/// The substrate counts Unicode scalar values, so the number it reports for a
/// position is `source[..byte_offset].chars().count()`. Trusting that number as
/// a byte index is the silent-corruption trap the `CharToByte` adapter exists
/// to close; this helper only *measures* the divergence and is never how the
/// library converts.
fn char_offset(source: &str, byte_offset: usize) -> usize {
    source[..byte_offset].chars().count()
}

// ===========================================================================
// 5. Where a collection ends (`PROGRESS.md`, R3) — Phase 0c-3a
// ===========================================================================

/// The bytes between a collection's published span end and its owned end.
///
/// `owned_end()` is fallible since the Phase 0c-3a review's finding 4, and the
/// `expect` here is the point: a golden that silently accepted "the derivation
/// gave up" would be measuring nothing.
fn owned_tail<'source>(source: &'source str, node: &Node) -> &'source str {
    let extent = node.collection_extent.expect("a collection has an extent");
    let owned_end = extent
        .owned_end()
        .expect("this probe's collections are all accountable");
    &source[node.span.end..owned_end]
}

#[test]
fn the_collection_extent_agrees_with_the_ownership_rules_over_both_corpora() {
    // The R3 answer, cross-checked by two derivations that share no code.
    //
    // `crate::syntax::collection` derives a block collection's owned end
    // **textually**, by scanning the substrate's own overshooting end marker.
    // `TriviaIndex::subtree_extent` derives the same number from the plan
    // section 6.2 **ownership rules**, by taking the hull of everything the
    // collection's subtree owns. They must agree on every block collection of
    // both corpora — which is what makes either of them trustworthy, because a
    // single derivation checked against itself proves nothing.
    //
    // Flow collections are deliberately excluded from the equality: their span
    // ends at the closing bracket, which is exact and is asserted separately,
    // while an inline comment *after* the bracket is still attached to the
    // collection by rule 3 and so widens the ownership hull. Two different
    // questions, and folding them into one figure is the R20 mistake.
    let mut block_collections = 0usize;
    let mut overshooting = 0usize;
    let mut with_a_tail = 0usize;
    let mut unaccountable = 0usize;

    for tier in [common::synthetic_valid(), common::real_corpus()] {
        for file in &tier {
            let index = SyntaxIndex::parse(&file.source)
                .unwrap_or_else(|error| panic!("{} must parse: {error}", file.name));
            let trivia = TriviaIndex::scan(&file.source, &index);
            unaccountable += index.unaccountable_collection_extents();

            for node in index.nodes() {
                let Some(extent) = node.collection_extent else {
                    continue;
                };
                // Fallible since the review's finding 4: `None` is "the
                // derivation gave up", and a consumer that unwrapped it would be
                // reading a number known to be too small. Here it must never be
                // `None`, which is the same statement the `unaccountable` count
                // makes and is worth making twice.
                let owned_end = extent.owned_end().unwrap_or_else(|| {
                    panic!(
                        "{}: node {} published no owned end",
                        file.name,
                        node.id.get()
                    )
                });
                assert!(
                    owned_end >= node.span.end,
                    "{}: node {} owns less than its span",
                    file.name,
                    node.id.get()
                );
                if node.collection_style == Some(CollectionStyle::Flow) {
                    assert_eq!(
                        extent.reported_end.end, node.span.end,
                        "{}: a flow collection ends at its closing bracket",
                        file.name
                    );
                    assert_eq!(
                        extent.derivation,
                        ExtentDerivation::ClosingBracket,
                        "{}: node {}",
                        file.name,
                        node.id.get()
                    );
                    continue;
                }

                block_collections += 1;
                if extent.overshoots(node.span) {
                    overshooting += 1;
                }
                if owned_end > node.span.end {
                    with_a_tail += 1;
                }
                // The substrate's marker never *undershoots*: measured 0 of 475
                // across both corpora, and the whole derivation rests on it.
                assert!(
                    extent.reported_end.end >= node.span.end,
                    "{}: node {} reported an end before its own last child",
                    file.name,
                    node.id.get()
                );
                assert_eq!(
                    trivia.subtree_extent(&index, node.id).end,
                    owned_end,
                    "{}: node {} — the textual extent and the ownership hull disagree",
                    file.name,
                    node.id.get()
                );
            } // End of the loop over one file's collections
        } // End of the loop over one corpus tier
    } // End of the loop over the two corpus tiers

    println!(
        "\ncollection extents: {block_collections} block collections, \
         {overshooting} whose marker overshoots, {with_a_tail} that own bytes past their span, \
         {unaccountable} unaccountable"
    );
    assert!(block_collections > 0, "no collection was checked at all");
    // The counted fallback of `crate::syntax::collection`, pinned at zero: a
    // derivation that quietly gave up would under-claim exactly the bytes a
    // removal envelope needs.
    assert_eq!(unaccountable, 0, "unaccountable collection extents");
    // And the shape the corpus was missing until this phase added a fixture for
    // it (R20): a collection that owns bytes its span does not cover.
    assert!(
        with_a_tail > 0,
        "no fixture exercises a collection whose owned end passes its span end"
    );
} // End of function the_collection_extent_agrees_with_the_ownership_rules_over_both_corpora()

#[test]
fn the_synthetic_collection_extents_are_pinned_exactly() {
    // The per-corpus figures, so a substrate change cannot move them silently.
    // Measured before the rule was written, which is the point: R3 and R20 were
    // both found by measuring span behaviour rather than assuming it.
    let mut block = 0usize;
    let mut flow = 0usize;
    let mut overshooting = 0usize;
    let mut with_a_tail = 0usize;
    for file in common::synthetic_valid() {
        let index = SyntaxIndex::parse(&file.source).expect("parses");
        for node in index.nodes() {
            let Some(extent) = node.collection_extent else {
                continue;
            };
            if node.collection_style == Some(CollectionStyle::Flow) {
                flow += 1;
                continue;
            }
            block += 1;
            if extent.overshoots(node.span) {
                overshooting += 1;
            }
            if extent.owned_end().is_some_and(|end| end > node.span.end) {
                with_a_tail += 1;
            }
        } // End of the loop over one fixture's collections
    } // End of the loop over the valid synthetic corpus

    println!(
        "\nsynthetic collections: {block} block + {flow} flow; \
         {overshooting} overshoot, {with_a_tail} own a tail"
    );
    assert_eq!(block + flow, SYNTHETIC_COLLECTIONS);
    assert_eq!(flow, SYNTHETIC_FLOW_COLLECTIONS);
    assert_eq!(overshooting, SYNTHETIC_OVERSHOOTING_COLLECTIONS);
    assert_eq!(with_a_tail, SYNTHETIC_COLLECTIONS_WITH_AN_OWNED_TAIL);
} // End of function the_synthetic_collection_extents_are_pinned_exactly()

#[test]
fn each_case_of_the_collection_extent_rule_has_its_own_golden() {
    // The rule has cases, so each one is pinned by exact bytes rather than by a
    // corpus-wide count that two opposing drifts could cancel inside.
    //
    // `(source, the innermost mapping's span, the bytes it owns past that span)`
    let cases: [(&str, &str, &str); 9] = [
        // No overshoot at all: the marker stops where the last child does.
        ("a:\n  b: 1", "b: 1", ""),
        // Pure layout in the overshoot: a line break, blank lines.
        ("a:\n  b: 1\nnext: 2\n", "b: 1", ""),
        ("a:\n  b: 1\n\n\nnext: 2\n", "b: 1", ""),
        // A comment on a *later* line belongs to the file or to what follows,
        // so the collection does not claim it.
        ("a:\n  b: 1\n  # later\nnext: 2\n", "b: 1", ""),
        ("a:\n  b: 1\n\n# spaced\nnext: 2\n", "b: 1", ""),
        // An **inline** comment is rule 3 trivia and travels with the entry.
        ("a:\n  b: 1 # why\nnext: 2\n", "b: 1", " # why"),
        // The entry punctuation of an empty final value. The substrate reports
        // the empty value as a zero-width scalar *before* its colon, so the
        // span stops one byte short of a byte the entry plainly owns.
        ("a:\n  b: 1\n  c:\nnext: 2\n", "b: 1\n  c", ":"),
        // …and the same shape carrying an inline comment as well.
        ("a:\n  c: # why\nnext: 2\n", "c", ": # why"),
        // A block-scalar value already ends past its own line, so there is
        // nothing left for the collection to claim.
        (
            "a:\n  b: |\n    body\n\n\nnext: 2\n",
            "b: |\n    body\n",
            "",
        ),
    ];
    for (source, span, tail) in cases {
        let index = SyntaxIndex::parse(source).expect("the probe parses");
        let mapping = index
            .nodes()
            .iter()
            .filter(|node| node.kind == NodeKind::Mapping)
            .max_by_key(|node| node.span.start)
            .expect("a mapping");
        assert_eq!(mapping.span.slice(source), Some(span), "span of {source:?}");
        assert_eq!(
            owned_tail(source, mapping),
            tail,
            "owned tail of {source:?}"
        );
    } // End of the loop over the extent rule's cases

    // A bare final sequence item: the dash and the space after it are already
    // inside the span, because the substrate reports the empty item's
    // zero-width scalar *after* them rather than before.
    let source = "a:\n  - x\n  - \nnext: 2\n";
    let index = SyntaxIndex::parse(source).expect("the probe parses");
    let sequence = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Sequence)
        .expect("a sequence");
    assert_eq!(sequence.span.slice(source), Some("- x\n  - "));
    assert_eq!(owned_tail(source, sequence), "");

    // A flow collection ends at its bracket, and the derivation says so.
    let source = "a: [1, 2]\n";
    let index = SyntaxIndex::parse(source).expect("the probe parses");
    let flow = index
        .nodes()
        .iter()
        .find(|node| node.collection_style == Some(CollectionStyle::Flow))
        .expect("a flow sequence");
    assert_eq!(flow.span.slice(source), Some("[1, 2]"));
    assert_eq!(
        flow.collection_extent.unwrap().derivation,
        ExtentDerivation::ClosingBracket
    );
} // End of function each_case_of_the_collection_extent_rule_has_its_own_golden()

#[test]
fn a_collection_span_never_out_ends_its_own_deepest_child() {
    // Why the published span stops at the last child although the collection
    // owns more: `ownership.rs` gives a trailing `:` and an inline comment to
    // the node with the **greatest** end, so a mapping that reached past its own
    // key would take both away from that key. `PROGRESS.md` D2d pins them to the
    // key, and this is the measurement that shows the two facts are in tension
    // rather than independent.
    let source = "empty: # why\n";
    let index = SyntaxIndex::parse(source).expect("parses");
    let trivia = TriviaIndex::scan(source, &index);
    let mapping = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Mapping)
        .expect("a mapping");
    let key = index
        .nodes()
        .iter()
        .find(|node| node.role == espansoconfig_core::syntax::NodeRole::MappingKey)
        .expect("a key");
    assert_eq!(mapping.span.end, key.span.end, "the span stops at the key");
    assert_eq!(
        trivia
            .comments()
            .iter()
            .map(|comment| comment.owner.node())
            .collect::<Vec<_>>(),
        vec![Some(key.id)],
        "the inline comment stays on the key, not on the mapping"
    );
    // The collection still *owns* the colon and the comment through its subtree.
    assert_eq!(owned_tail(source, mapping), ": # why");
} // End of function a_collection_span_never_out_ends_its_own_deepest_child()

#[test]
fn a_subtree_extent_never_reaches_into_a_node_outside_the_subtree() {
    // `subtree_extent` is a hull, so the one thing that could go wrong is that
    // it swallows a neighbour. Checked over both corpora for every node: no byte
    // of the hull may fall strictly inside a node that is neither an ancestor
    // nor a descendant.
    let mut checked = 0usize;
    for tier in [common::synthetic_valid(), common::real_corpus()] {
        for file in &tier {
            let index = SyntaxIndex::parse(&file.source).expect("parses");
            let trivia = TriviaIndex::scan(&file.source, &index);
            for node in index.nodes() {
                if node.kind == NodeKind::Document {
                    continue;
                }
                let hull = trivia.subtree_extent(&index, node.id);
                for other in index.nodes() {
                    if other.kind == NodeKind::Document
                        || other.span.is_empty()
                        || related(&index, node.id, other.id)
                    {
                        continue;
                    }
                    assert!(
                        other.span.end <= hull.start || other.span.start >= hull.end,
                        "{}: the hull of node {} overlaps unrelated node {}",
                        file.name,
                        node.id.get(),
                        other.id.get()
                    );
                } // End of the loop over the other nodes
                checked += 1;
            } // End of the loop over one file's nodes
        } // End of the loop over one corpus tier
    } // End of the loop over the two corpus tiers
    println!("\nsubtree hulls checked for overlap: {checked}");
    assert!(checked > 0);
} // End of function a_subtree_extent_never_reaches_into_a_node_outside_the_subtree()

/// Whether one node is the other, an ancestor of it, or a descendant of it.
fn related(index: &SyntaxIndex, first: NodeId, second: NodeId) -> bool {
    if first == second {
        return true;
    }
    let ancestor_of = |ancestor: NodeId, node: NodeId| {
        let mut current = index.node(node).and_then(|node| node.parent);
        while let Some(id) = current {
            if id == ancestor {
                return true;
            }
            current = index.node(id).and_then(|node| node.parent);
        }
        false
    };
    ancestor_of(first, second) || ancestor_of(second, first)
} // End of function related()
