//! Phase 0c-1 acceptance: the scalar codec and the `choose_scalar` emitter.
//!
//! Two property tests carry this phase, and they are deliberately of different
//! kinds — one measures us against the substrate over real bytes, the other
//! measures us against ourselves over bytes nobody has ever written.
//!
//! 1. **Round-trip through the substrate.** For an adversarial value set and a
//!    seeded generative sweep, render `choose_scalar(value)` into a tiny
//!    document at a realistic indentation, parse it, and require the decoded
//!    value back **exactly** — byte for byte, no normalisation.
//! 2. **Corpus decode/re-encode identity.** For every scalar in both corpora,
//!    decode it and re-encode it in its own presentation, and require the
//!    result to equal the source bytes. Presentations that are *provably*
//!    lossy in the decode direction — `>`, a folded multi-line flow scalar, an
//!    escaped double-quoted scalar — are refused by name rather than excused.
//!
//! A third, quieter oracle underpins both: our decoder is checked against
//! `saphyr-parser`'s own decoded value for **every** scalar in both corpora.
//! The substrate is the authority; where the two disagreed during development
//! it was our folding rules that were wrong, every time.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`PROGRESS.md`, D1).
//! Nothing here prints a byte of its content: file names, counts and offsets
//! only, and every real-corpus test skips cleanly when the directory is absent.

mod common;

use std::collections::BTreeMap;

use espansoconfig_core::emit::{
    choose_scalar, decode, is_conservatively_safe_plain_scalar, literal_block_can_carry,
    preserve_scalar, reencode_in_place, single_quotes_can_carry, NotReencodable, ScalarContext,
    ScalarPlan,
};
use espansoconfig_core::syntax::{NodeRole, SyntaxIndex};
use espansoconfig_core::{LineEnding, ScalarPresentation, ScalarStyle};

// ---------------------------------------------------------------------------
// Oracle 1 — our decoder against the substrate's, over both corpora
// ---------------------------------------------------------------------------

/// Decodes every scalar of `source` with both decoders and returns
/// `(agreements, disagreements)`; a disagreement carries no scalar text so the
/// caller can print it even for the private corpus.
fn compare_decoders(source: &str) -> (usize, Vec<String>) {
    let Ok(index) = SyntaxIndex::parse(source) else {
        return (0, Vec::new());
    };
    let mut agreements = 0;
    let mut disagreements = Vec::new();
    for node in index.nodes() {
        let Some(scalar) = &node.scalar else {
            continue;
        };
        // An **implicit** node owns no bytes (`PROGRESS.md`, R7), and the two
        // decoders answer different questions about it: ours reads the span and
        // returns the empty string, the substrate resolves the absent node and
        // returns YAML's null, `~`. Neither is wrong, and there is nothing to
        // reconcile without a null in the value model — which is a projection
        // question, not a codec one. It is out of scope here and **bounded**:
        // `an_implicit_node_is_the_one_place_the_two_decoders_answer_differently`
        // pins the divergence and its count instead of this skip hiding it.
        // The branch became reachable in Phase 0c-3a, when
        // `empty-entries-and-extents.yml` gave the corpus its first empty entry.
        //
        // **The skip is qualified, not merely counted.** The Phase 0c-3a review
        // accepted the reasoning and asked for the guard, and it is cheap: an
        // implicit node is written with no characters at all, so it is plain,
        // carries no block header, and the substrate resolves it to `~`. A
        // zero-width scalar that is any of those things is not an implicit node,
        // and letting it through this branch would hide a genuine disagreement
        // rather than a documented one.
        if node.is_zero_width() {
            assert_eq!(
                scalar.presentation.style,
                ScalarStyle::Plain,
                "a zero-width scalar at bytes {}..{} is not plain",
                node.span.start,
                node.span.end
            );
            assert!(
                scalar.presentation.header_span.is_empty(),
                "a zero-width scalar at bytes {}..{} carries a block header",
                node.span.start,
                node.span.end
            );
            assert_eq!(
                scalar.value, "~",
                "a zero-width scalar at bytes {}..{} is not the substrate's implicit null",
                node.span.start, node.span.end
            );
            continue;
        }
        match decode(source, &scalar.presentation) {
            Ok(ours) if ours == scalar.value => agreements += 1,
            Ok(_) => disagreements.push(format!(
                "{:?} scalar at bytes {}..{} decodes differently",
                scalar.presentation.style, node.span.start, node.span.end
            )),
            Err(error) => disagreements.push(format!(
                "{:?} scalar at bytes {}..{} failed to decode: {error}",
                scalar.presentation.style, node.span.start, node.span.end
            )),
        }
    } // End of the loop over the document's scalars
    (agreements, disagreements)
} // End of function compare_decoders()

#[test]
fn our_decoder_agrees_with_the_substrate_on_every_synthetic_scalar() {
    let mut total = 0;
    let mut problems = Vec::new();
    for file in common::synthetic_valid() {
        let (agreements, disagreements) = compare_decoders(&file.source);
        total += agreements;
        for problem in disagreements {
            problems.push(format!("{}: {problem}", file.name));
        }
    }
    println!("synthetic corpus: {total} scalars decoded in agreement with the substrate");
    assert!(problems.is_empty(), "decoder disagreements: {problems:#?}");
    // 864, not the 838 pinned before Phase 0c-3a: `empty-entries-and-extents.yml`
    // adds 31 scalars, of which **5 are zero width** and are skipped above, so
    // the figure moves by 26 and our decoder agrees with the substrate on every
    // one of the 26. 886 since the review's fix round added 22 more scalars in
    // two fixtures, none of them zero width, all of them in agreement. 905 since
    // Phase 0c-3b-1's `run-based-removal-envelope.yml` added 19, likewise none
    // zero width and all in agreement, and 924 since its review's fix round added
    // the 19 of `run-based-removal-boundaries.yml` on the same terms. 967 since
    // Phase 0c-3b-2a's two move fixtures added 20 and 23, none zero width and all
    // in agreement. 1 011 since that phase's review added two more: the 23 scalars
    // of `move-run-joins.yml` and the 21 of `move-kept-comment-joins-a-block.yml`,
    // on the same terms. 1 026 since Phase 0c-3b-2b's `explicit-key-mappings.yml`
    // added its 15, again none zero width and all in agreement — the explicit
    // `?`/`:` punctuation is trivia, so it changes no scalar's own bytes.
    assert_eq!(
        total, 1026,
        "the synthetic corpus scalar count is pinned; update it deliberately"
    );
} // End of function our_decoder_agrees_with_the_substrate_on_every_synthetic_scalar()

#[test]
fn our_decoder_agrees_with_the_substrate_on_every_real_scalar() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "our_decoder_agrees_with_the_substrate_on_every_real_scalar",
        &files,
    ) {
        return;
    }
    let mut total = 0;
    let mut problems = Vec::new();
    for file in &files {
        let (agreements, disagreements) = compare_decoders(&file.source);
        total += agreements;
        for problem in disagreements {
            problems.push(format!("{}: {problem}", file.name));
        }
    }
    println!(
        "real corpus: {total} scalars across {} files decoded in agreement with the substrate",
        files.len()
    );
    assert!(problems.is_empty(), "decoder disagreements: {problems:#?}");
    assert!(total > 0, "the real corpus is present but holds no scalars");
} // End of function our_decoder_agrees_with_the_substrate_on_every_real_scalar()

// ---------------------------------------------------------------------------
// Oracle 2 — decode then re-encode is the identity on the source bytes
// ---------------------------------------------------------------------------

/// The outcome of re-encoding every scalar in one document.
#[derive(Default)]
struct ReencodeTally {
    /// Scalars whose header and content came back byte-identical.
    identical: usize,
    /// Scalars refused by name, counted per reason.
    refused: BTreeMap<String, usize>,
    /// Scalars that re-encoded to different bytes — always a defect.
    mismatches: Vec<String>,
}

impl ReencodeTally {
    /// Folds another document's tally into this one.
    fn absorb(&mut self, other: ReencodeTally, file: &str) {
        self.identical += other.identical;
        for (reason, count) in other.refused {
            *self.refused.entry(reason).or_default() += count;
        }
        for mismatch in other.mismatches {
            self.mismatches.push(format!("{file}: {mismatch}"));
        }
    } // End of function absorb()
} // End of impl ReencodeTally

/// Names a refusal without quoting any scalar text.
fn refusal_name(refusal: &NotReencodable) -> &'static str {
    match refusal {
        NotReencodable::FoldedStyle => "FoldedStyle",
        NotReencodable::FoldedFlowScalar => "FoldedFlowScalar",
        NotReencodable::NonCanonicalEscaping => "NonCanonicalEscaping",
        NotReencodable::NonCanonicalBlankLine => "NonCanonicalBlankLine",
        NotReencodable::MixedLineBreaks => "MixedLineBreaks",
        NotReencodable::BareCarriageReturn => "BareCarriageReturn",
        NotReencodable::SynthesisedFinalBreak => "SynthesisedFinalBreak",
        NotReencodable::Undecodable(_) => "Undecodable",
    }
} // End of function refusal_name()

/// Re-encodes every scalar of `source` in its own presentation.
fn reencode_document(source: &str) -> ReencodeTally {
    let mut tally = ReencodeTally::default();
    let Ok(index) = SyntaxIndex::parse(source) else {
        return tally;
    };
    for node in index.nodes() {
        let Some(scalar) = &node.scalar else {
            continue;
        };
        let presentation = &scalar.presentation;
        let plan = match reencode_in_place(source, presentation) {
            Ok(plan) => plan,
            Err(refusal) => {
                *tally
                    .refused
                    .entry(refusal_name(&refusal).to_owned())
                    .or_default() += 1;
                continue;
            }
        };
        let header = presentation.header_span.slice(source).unwrap_or_default();
        let content = presentation.content_span.slice(source).unwrap_or_default();
        if plan.render_header() != header {
            tally.mismatches.push(format!(
                "{:?} header at bytes {}..{} differs",
                presentation.style, presentation.header_span.start, presentation.header_span.end
            ));
        } else if plan.render_content() != content {
            tally.mismatches.push(format!(
                "{:?} content at bytes {}..{} differs",
                presentation.style, presentation.content_span.start, presentation.content_span.end
            ));
        } else {
            tally.identical += 1;
        }
    } // End of the loop over the document's scalars
    tally
} // End of function reencode_document()

#[test]
fn every_synthetic_scalar_reencodes_to_its_own_bytes() {
    let mut tally = ReencodeTally::default();
    for file in common::synthetic_valid() {
        tally.absorb(reencode_document(&file.source), &file.name);
    }
    println!(
        "synthetic corpus: {} scalars re-encoded byte-identically, {} refused by name: {:?}",
        tally.identical,
        tally.refused.values().sum::<usize>(),
        tally.refused
    );
    assert!(
        tally.mismatches.is_empty(),
        "re-encoding changed bytes: {:#?}",
        tally.mismatches
    );
    // 820, not the 808 pinned before Phase 0c-2b's fix round: the new
    // `block-scalar-header-tails.yml` holds 13 scalars, 12 of which re-encode
    // byte-identically. The thirteenth is its `>2` folded scalar, which joins the
    // `FoldedStyle` family below because `>` is decode-only (D2e).
    // 851 since Phase 0c-3a: `empty-entries-and-extents.yml` adds 31 scalars and
    // every one of them re-encodes byte-identically, its 5 zero-width ones
    // included — an empty span re-encodes to no bytes, which is exactly right.
    // 873 since the Phase 0c-3a review's fix round: the 20 scalars of
    // `file-comments-and-mixed-endings.yml` and the 2 of
    // `single-line-no-line-ending.yml`, all quoted or plain and all identical.
    // 892 since Phase 0c-3b-1's `run-based-removal-envelope.yml`: 18 quoted or
    // plain scalars plus its one `|` block, all of which re-encode identically —
    // a literal block does, unlike a folded one (D2e).
    // 910 since its review's fix round added `run-based-removal-boundaries.yml`,
    // which moves this figure by **18 of its 19** rather than by all of them: its
    // one block scalar is a `>`, so it joins the `FoldedStyle` family below. That
    // asymmetry between the two otherwise identically shaped fixtures is its own
    // cross-check on D2e.
    // 953 since Phase 0c-3b-2a's two move fixtures: 20 in `move-a-match.yml` and
    // 23 in `move-block-scalar-seams.yml`, whose two `|` blocks re-encode
    // identically as literal blocks do.
    // 997 since that phase's review added two more, both moving this figure by
    // **all** of their scalars: 23 in `move-run-joins.yml`, whose two `|` blocks
    // re-encode identically, and 21 in `move-kept-comment-joins-a-block.yml`,
    // whose two do as well.
    // 1 012 since Phase 0c-3b-2b's `explicit-key-mappings.yml`, all 15 of whose
    // scalars are plain or single-quoted and re-encode identically.
    assert_eq!(tally.identical, 1012, "pinned; update deliberately");
    assert_eq!(
        tally.refused,
        BTreeMap::from([
            ("FoldedStyle".to_owned(), 12),
            ("NonCanonicalEscaping".to_owned(), 4),
            ("FoldedFlowScalar".to_owned(), 2),
            ("SynthesisedFinalBreak".to_owned(), 1),
        ]),
        "the refusal families are pinned per family, so two drifts cannot cancel"
    );
} // End of function every_synthetic_scalar_reencodes_to_its_own_bytes()

/// Every refusal in `source`, as `"style span reason"`, in document order.
fn refusals_of(source: &str) -> Vec<String> {
    let mut refusals = Vec::new();
    let Ok(index) = SyntaxIndex::parse(source) else {
        return refusals;
    };
    for node in index.nodes() {
        let Some(scalar) = &node.scalar else {
            continue;
        };
        if let Err(refusal) = reencode_in_place(source, &scalar.presentation) {
            refusals.push(format!(
                "{:?} {}..{} {}",
                scalar.presentation.style,
                node.span.start,
                node.span.end,
                refusal_name(&refusal)
            ));
        }
    } // End of the loop over the document's scalars
    refusals
} // End of function refusals_of()

/// The exact scalar every synthetic fixture refuses, pinned by span.
///
/// Counting refusals per family is not enough on its own: two scalars could
/// swap eligibility *inside* one family and the totals would still agree. This
/// list names the byte range of every refused scalar, so any such swap changes
/// it. There is deliberately **no real-corpus counterpart**: that corpus is
/// private (`PROGRESS.md`, D1) and no figure derived from it may be committed.
const SYNTHETIC_REFUSALS: [(&str, &str); 19] = [
    (
        // Phase 0c-2b's fix round added this fixture. Its `>2` header is the only
        // refusal it contributes: `>` is decode-only (D2e), so the other 12
        // scalars re-encode byte-identically.
        "synthetic/block-scalar-header-tails.yml",
        "Folded 694..728 FoldedStyle",
    ),
    (
        "synthetic/block-scalar-leading-blank-lines.yml",
        "Folded 1265..1304 FoldedStyle",
    ),
    (
        "synthetic/block-scalar-terminal-spaces.yml",
        "Literal 675..712 SynthesisedFinalBreak",
    ),
    (
        "synthetic/block-scalars.yml",
        "Folded 1834..1852 FoldedStyle",
    ),
    (
        "synthetic/block-scalars.yml",
        "Folded 1925..1943 FoldedStyle",
    ),
    (
        "synthetic/block-scalars.yml",
        "Folded 2017..2036 FoldedStyle",
    ),
    (
        "synthetic/config-profile.yml",
        "DoubleQuoted 822..826 NonCanonicalEscaping",
    ),
    (
        "synthetic/folded-more-indented.yml",
        "Folded 683..806 FoldedStyle",
    ),
    (
        "synthetic/folded-more-indented.yml",
        "Folded 981..1077 FoldedStyle",
    ),
    (
        "synthetic/folded-more-indented.yml",
        "Folded 1249..1286 FoldedStyle",
    ),
    (
        "synthetic/folded-more-indented.yml",
        "Folded 1526..1589 FoldedStyle",
    ),
    (
        "synthetic/plain-scalar-hazards.yml",
        "DoubleQuoted 1877..1900 NonCanonicalEscaping",
    ),
    (
        "synthetic/plain-scalar-hazards.yml",
        "DoubleQuoted 2138..2172 NonCanonicalEscaping",
    ),
    (
        // The Phase 0c-3b-1 review's fix round added this fixture, and its one
        // block scalar is a `>` on purpose: it is the folded shape finding 2's
        // safe case needs, and it is also the only refusal the fixture
        // contributes, so its other 18 scalars re-encode byte-identically.
        "synthetic/run-based-removal-boundaries.yml",
        "Folded 239..299 FoldedStyle",
    ),
    (
        "synthetic/scalar-styles.yml",
        "DoubleQuoted 476..507 NonCanonicalEscaping",
    ),
    (
        "synthetic/scalar-styles.yml",
        "SingleQuoted 745..777 FoldedFlowScalar",
    ),
    (
        "synthetic/scalar-styles.yml",
        "DoubleQuoted 894..931 FoldedFlowScalar",
    ),
    (
        "synthetic/scalar-styles.yml",
        "Folded 1741..1794 FoldedStyle",
    ),
    (
        "synthetic/scalar-styles.yml",
        "Folded 1870..1925 FoldedStyle",
    ),
];

#[test]
fn the_refused_synthetic_scalars_are_pinned_one_by_one() {
    let mut observed = Vec::new();
    for file in common::synthetic_valid() {
        for refusal in refusals_of(&file.source) {
            observed.push((file.name.clone(), refusal));
        }
    }
    let expected: Vec<(String, String)> = SYNTHETIC_REFUSALS
        .iter()
        .map(|(file, refusal)| ((*file).to_owned(), (*refusal).to_owned()))
        .collect();
    assert_eq!(
        observed, expected,
        "the refused scalars are pinned per scalar, not merely per family"
    );
} // End of function the_refused_synthetic_scalars_are_pinned_one_by_one()

#[test]
fn both_block_header_indicator_orders_reencode_byte_identically() {
    // Phase 0c-1 review, finding 5. `|2+` and `|+2` are the same header to
    // YAML and produce the same decoded value, so nothing but the recorded
    // source order can tell them apart — and `reencode_in_place` promises byte
    // identity, not "close enough". Written inline rather than as a fixture:
    // the corpus fixture counts are pinned exactly in three other test files.
    for document in [
        "key: |2+\n   body\n",
        "key: |+2\n   body\n",
        "key: |2-\n   body\n",
        "key: |-2\n   body\n",
        "key: >2+\n   body\n",
        "key: >+2\n   body\n",
        "key: |3+\n    body\n",
        "key: |+3\n    body\n",
    ] {
        let index = SyntaxIndex::parse(document).expect("the document parses");
        let mut checked = 0;
        for node in index.nodes() {
            let Some(scalar) = &node.scalar else {
                continue;
            };
            if !scalar.presentation.style.is_block() {
                continue;
            }
            checked += 1;
            let header = scalar
                .presentation
                .header_span
                .slice(document)
                .expect("the header slices");
            match reencode_in_place(document, &scalar.presentation) {
                Ok(plan) => assert_eq!(
                    plan.render_header(),
                    header,
                    "header of {document:?} did not come back byte-identical"
                ),
                // A folded scalar is refused for an unrelated reason, but its
                // header order must still have been recorded.
                Err(NotReencodable::FoldedStyle) => assert!(
                    header.starts_with('>'),
                    "only `>` may refuse with FoldedStyle"
                ),
                Err(refusal) => panic!("{document:?} refused: {refusal}"),
            }
        } // End of the loop over the document's block scalars
        assert_eq!(checked, 1, "one block scalar per document");
    } // End of the loop over both indicator orders
} // End of function both_block_header_indicator_orders_reencode_byte_identically()

#[test]
fn every_real_scalar_reencodes_to_its_own_bytes() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus("every_real_scalar_reencodes_to_its_own_bytes", &files) {
        return;
    }
    let mut tally = ReencodeTally::default();
    for file in &files {
        tally.absorb(reencode_document(&file.source), &file.name);
    }
    println!(
        "real corpus: {} scalars across {} files re-encoded byte-identically, \
         {} refused by name: {:?}",
        tally.identical,
        files.len(),
        tally.refused.values().sum::<usize>(),
        tally.refused
    );
    assert!(
        tally.mismatches.is_empty(),
        "re-encoding changed bytes: {:#?}",
        tally.mismatches
    );
    assert!(tally.identical > 0, "no real scalar re-encoded at all");
} // End of function every_real_scalar_reencodes_to_its_own_bytes()

// ---------------------------------------------------------------------------
// Oracle 3 — choose_scalar round-trips through the substrate
// ---------------------------------------------------------------------------

/// One place a scalar can be written, and how a document around it is built.
struct Site {
    /// What precedes `key: ` in the document.
    prefix: &'static str,
    /// The column of the mapping the scalar's key belongs to.
    parent_indent: usize,
    /// A block-body column other than the conventional `parent_indent + 2`.
    ///
    /// `Some(n)` exercises [`ScalarContext::with_indent`], which is where the
    /// indentation indicator's `1..=9` limit bites: a delta above nine cannot
    /// be spelled at all, and the review's finding 1 was that clamping the
    /// indicator while leaving the body deeper pushed the surplus columns into
    /// the value.
    indent: Option<usize>,
    /// The document's line ending.
    line_ending: LineEnding,
    /// Whether another key follows the scalar, rather than end-of-file.
    followed: bool,
}

impl Site {
    /// The context a value is written with at this site.
    fn context(&self) -> ScalarContext {
        let context = ScalarContext::block(self.parent_indent, self.line_ending);
        match self.indent {
            Some(indent) => context.with_indent(indent),
            None => context,
        }
    } // End of function context()
} // End of impl Site

/// The block-context sites every value is round-tripped through.
///
/// The last three carry explicit body columns at, just past and far past the
/// indentation indicator's ceiling of nine columns beyond the parent.
const BLOCK_SITES: [Site; 9] = [
    Site {
        prefix: "",
        parent_indent: 0,
        indent: None,
        line_ending: LineEnding::Lf,
        followed: false,
    },
    Site {
        prefix: "",
        parent_indent: 0,
        indent: None,
        line_ending: LineEnding::Lf,
        followed: true,
    },
    Site {
        prefix: "outer:\n  ",
        parent_indent: 2,
        indent: None,
        line_ending: LineEnding::Lf,
        followed: true,
    },
    Site {
        prefix: "outer:\n  inner:\n    ",
        parent_indent: 4,
        indent: None,
        line_ending: LineEnding::Lf,
        followed: true,
    },
    Site {
        prefix: "",
        parent_indent: 0,
        indent: None,
        line_ending: LineEnding::Crlf,
        followed: false,
    },
    Site {
        prefix: "outer:\r\n  ",
        parent_indent: 2,
        indent: None,
        line_ending: LineEnding::Crlf,
        followed: true,
    },
    // Exactly nine columns past the parent: the deepest indicator YAML spells.
    Site {
        prefix: "",
        parent_indent: 0,
        indent: Some(9),
        line_ending: LineEnding::Lf,
        followed: true,
    },
    // Ten: one column past what any indicator can announce.
    Site {
        prefix: "",
        parent_indent: 0,
        indent: Some(10),
        line_ending: LineEnding::Lf,
        followed: true,
    },
    // Far past it, and nested, so the parent column is not zero either.
    Site {
        prefix: "outer:\r\n  ",
        parent_indent: 2,
        indent: Some(20),
        line_ending: LineEnding::Crlf,
        followed: false,
    },
];

/// Builds the smallest document that puts `plan` at `site`.
///
/// No newline is appended after a block scalar that already ends with one: a
/// `|+` block would silently gain a trailing line feed, which is exactly the
/// class of corruption this phase exists to rule out.
fn document_for(site: &Site, plan: &ScalarPlan) -> String {
    let ending = site.line_ending.as_str();
    let mut document = String::from(site.prefix);
    document.push_str("key: ");
    document.push_str(&plan.render());
    if site.followed {
        if !document.ends_with('\n') {
            document.push_str(ending);
        }
        document.push_str(&" ".repeat(site.parent_indent));
        document.push_str("next: 1");
        document.push_str(ending);
    }
    document
} // End of function document_for()

/// Builds the smallest document that puts `plan` in **mapping-key** position.
///
/// The key is written at the site's parent column and given a trivial value, so
/// the only thing the round trip can be measuring is the key's own spelling.
fn key_document_for(site: &Site, plan: &ScalarPlan) -> String {
    let ending = site.line_ending.as_str();
    let mut document = String::from(site.prefix);
    document.push_str(&plan.render());
    document.push_str(": 1");
    document.push_str(ending);
    document
} // End of function key_document_for()

/// Returns the **last** mapping key of `document`, decoded by the substrate and
/// by us.
///
/// The last one, because a nested site writes its own `outer:` key first and
/// the key under test is always the innermost.
fn parse_back_key(document: &str) -> Result<(String, String), String> {
    let index = SyntaxIndex::parse(document).map_err(|error| format!("parse failed: {error}"))?;
    let mut last = None;
    for node in index.nodes() {
        if node.role != NodeRole::MappingKey {
            continue;
        }
        let scalar = node
            .scalar
            .as_ref()
            .ok_or_else(|| format!("the key is a {:?}, not a scalar", node.kind))?;
        let ours = decode(document, &scalar.presentation)
            .map_err(|error| format!("our decoder failed: {error}"))?;
        last = Some((scalar.value.clone(), ours));
    } // End of the loop that walks every mapping key
    last.ok_or_else(|| "no mapping key found".to_owned())
} // End of function parse_back_key()

/// Returns the value scalar of the `key:` entry, decoded by the substrate and
/// by us, or a description of what went wrong.
fn parse_back(document: &str) -> Result<(String, String), String> {
    let index = SyntaxIndex::parse(document).map_err(|error| format!("parse failed: {error}"))?;
    let mut expect_value = false;
    for node in index.nodes() {
        if expect_value {
            let scalar = node
                .scalar
                .as_ref()
                .ok_or_else(|| format!("the value is a {:?}, not a scalar", node.kind))?;
            let ours = decode(document, &scalar.presentation)
                .map_err(|error| format!("our decoder failed: {error}"))?;
            return Ok((scalar.value.clone(), ours));
        }
        if node.role == NodeRole::MappingKey
            && node.scalar.as_ref().is_some_and(|s| s.value == "key")
        {
            expect_value = true;
        }
    } // End of the loop that finds the `key:` entry's value
    Err("no `key:` entry found".to_owned())
} // End of function parse_back()

/// The longest value a round trip writes into **key** position.
///
/// YAML limits a simple key to 1024 characters, and `saphyr-parser` enforces it
/// (measured: a 1024-character key parses, a 1025-character one is rejected
/// with "mapping values are not allowed in this context"). Longer keys need the
/// explicit `? key` form, which this crate refuses to edit at all
/// (`HazardKind::ExplicitKeyMapping`), so they are out of scope rather than
/// unhandled.
const LONGEST_SIMPLE_KEY: usize = 1024;

/// Round-trips one value through every block site, a flow site and the key
/// sites, and returns whatever failed.
fn round_trip(value: &str) -> Vec<String> {
    let mut failures = Vec::new();
    for site in &BLOCK_SITES {
        let plan = choose_scalar(value, site.context());
        let document = document_for(site, &plan);
        match parse_back(&document) {
            Ok((substrate, ours)) => {
                if substrate != value {
                    failures.push(format!(
                        "block site (parent {}, indent {:?}, {:?}, followed {}): {:?} rendered \
                         as {:?} came back as {substrate:?}",
                        site.parent_indent,
                        site.indent,
                        site.line_ending,
                        site.followed,
                        value,
                        plan.render()
                    ));
                } else if ours != value {
                    failures.push(format!(
                        "our decoder disagreed for {value:?} rendered as {:?}: got {ours:?}",
                        plan.render()
                    ));
                }
            }
            Err(problem) => failures.push(format!(
                "block site (parent {}, indent {:?}, {:?}): {value:?} rendered as {:?}: {problem}",
                site.parent_indent,
                site.indent,
                site.line_ending,
                plan.render()
            )),
        }
    } // End of the loop over the block sites

    let flow = ScalarContext::flow(6, LineEnding::Lf);
    let plan = choose_scalar(value, flow);
    let document = format!("outer: {{key: {}}}\n", plan.render());
    match parse_back(&document) {
        Ok((substrate, ours)) => {
            if substrate != value {
                failures.push(format!(
                    "flow site: {value:?} rendered as {:?} came back as {substrate:?}",
                    plan.render()
                ));
            } else if ours != value {
                failures.push(format!(
                    "flow site: our decoder disagreed for {value:?}: got {ours:?}"
                ));
            }
        }
        Err(problem) => failures.push(format!(
            "flow site: {value:?} rendered as {:?}: {problem}",
            plan.render()
        )),
    }

    failures.extend(round_trip_as_a_key(value));
    failures
} // End of function round_trip()

/// Round-trips one value through mapping-**key** position, block and flow.
///
/// The review's finding 6: `is_conservatively_safe_plain_scalar("<<")` used to
/// be true, and `<<` written plain in key position is YAML's merge key rather
/// than the two-character string. Nothing in the value-only sites above could
/// have seen it.
fn round_trip_as_a_key(value: &str) -> Vec<String> {
    let mut failures = Vec::new();
    if value.chars().count() > LONGEST_SIMPLE_KEY {
        return failures;
    }
    for site in &BLOCK_SITES {
        let plan = choose_scalar(value, site.context().as_key());
        let document = key_document_for(site, &plan);
        match parse_back_key(&document) {
            Ok((substrate, ours)) => {
                if substrate != value {
                    failures.push(format!(
                        "key site (parent {}): {value:?} rendered as {:?} came back as \
                         {substrate:?}",
                        site.parent_indent,
                        plan.render()
                    ));
                } else if ours != value {
                    failures.push(format!(
                        "key site: our decoder disagreed for {value:?} rendered as {:?}: \
                         got {ours:?}",
                        plan.render()
                    ));
                }
            }
            Err(problem) => failures.push(format!(
                "key site (parent {}): {value:?} rendered as {:?}: {problem}",
                site.parent_indent,
                plan.render()
            )),
        }
    } // End of the loop over the key sites

    let flow = ScalarContext::flow(8, LineEnding::Lf).as_key();
    let plan = choose_scalar(value, flow);
    let document = format!("outer: {{{}: 1}}\n", plan.render());
    match mapping_keys(&document) {
        Ok(keys) if keys.len() == 2 && keys[0] == "outer" && keys[1] == value => {}
        Ok(keys) => failures.push(format!(
            "flow key site: {value:?} rendered as {:?} produced keys {keys:?}",
            plan.render()
        )),
        Err(problem) => failures.push(format!(
            "flow key site: {value:?} rendered as {:?}: {problem}",
            plan.render()
        )),
    }
    failures
} // End of function round_trip_as_a_key()

/// Every mapping key of `document`, in document order, as the substrate
/// decoded them.
fn mapping_keys(document: &str) -> Result<Vec<String>, String> {
    let index = SyntaxIndex::parse(document).map_err(|error| format!("parse failed: {error}"))?;
    let mut keys = Vec::new();
    for node in index.nodes() {
        if node.role == NodeRole::MappingKey {
            let scalar = node
                .scalar
                .as_ref()
                .ok_or_else(|| format!("a key is a {:?}, not a scalar", node.kind))?;
            keys.push(scalar.value.clone());
        }
    }
    Ok(keys)
} // End of function mapping_keys()

/// The adversarial value set: every shape known to break a naive emitter.
fn adversarial_values() -> Vec<String> {
    let mut values: Vec<String> = Vec::new();

    // Empty and white space.
    for value in [
        "",
        " ",
        "  ",
        "\t",
        " leading",
        "trailing ",
        "\tleading tab",
        "trailing tab\t",
        " both ",
    ] {
        values.push(value.to_owned());
    }

    // Bool, null and their YAML 1.1 spellings.
    for value in [
        "no", "No", "NO", "yes", "Yes", "on", "off", "y", "n", "Y", "N", "true", "True", "false",
        "null", "Null", "NULL", "~",
    ] {
        values.push(value.to_owned());
    }

    // Numbers, timestamps, infinities.
    for value in [
        "0",
        "1.5",
        "1e3",
        "0x1f",
        "0o17",
        "0b1011",
        ".inf",
        "-.Inf",
        ".nan",
        "12:30",
        "2024-01-01",
        "2024-01-01T10:00:00Z",
        "2024-01-01 10:00:00 +01:00",
        "1_000",
        "-3",
        "+3",
        "010",
    ] {
        values.push(value.to_owned());
    }

    // A value starting with each YAML indicator.
    for indicator in "-?:,[]{}#&*!|>'\"%@`".chars() {
        values.push(format!("{indicator}rest"));
        values.push(indicator.to_string());
    }

    // Structural confusions.
    for value in [
        "a: b", "a #b", "a#b", "a:b", "a: ", "b:", "---", "...", "--- x", "...x", "- a", "? a",
    ] {
        values.push(value.to_owned());
    }

    // Regex and path shapes: the reason single quotes are the default.
    for value in [
        r"(?P<t>[A-Z]+-\d+)",
        r"\n",
        r"\\",
        r"C:\path\to",
        r"^\s*$",
        r"a\'b",
    ] {
        values.push(value.to_owned());
    }

    // Apostrophes and quotes.
    for value in ["Don't", "''", "'''", "\"quoted\"", "it's a 'test'"] {
        values.push(value.to_owned());
    }

    // Control characters, the two YAML 1.1 line separators, and the Unicode
    // noncharacters — the last two families are not `char::is_control()` and
    // were the review's findings 3 and 7.
    for value in [
        "\t",
        "\u{0}",
        "\u{7}",
        "\u{1b}",
        "\u{7f}",
        "\u{85}",
        "\u{a0}",
        "\u{2028}",
        "\u{2029}",
        "a\tb",
        "a\u{0}b",
        "a\u{1b}b",
        "a\u{2028}b",
        "a\u{2029}b",
        "line\u{2028}\nfeed\n",
        "\u{fffe}",
        "\u{ffff}",
        "a\u{fffe}b",
        "\u{fdd0}",
        "\u{fdef}",
        "\u{1fffe}",
        "a\u{fffe}\nb\n",
        // The characters immediately outside each excluded range, which must
        // stay raw.
        "\u{fffd}",
        "\u{fdcf}\u{fdf0}",
    ] {
        values.push(value.to_owned());
    }

    // The merge key, and shapes near it (finding 6).
    for value in ["<<", "<", "<<<", "a<<b", "<<a"] {
        values.push(value.to_owned());
    }

    // Multi-line, with 0…3 trailing newlines and every awkward opening.
    for body in ["one\ntwo", "one\ntwo\n", "one\ntwo\n\n", "one\ntwo\n\n\n"] {
        values.push(body.to_owned());
    }
    for value in [
        "  indented first\nsecond\n",
        "\nblank first\n",
        "\n\ntwo blanks first\n",
        "a\n   \nb\n",
        "a\n\t\nb\n",
        "ends in a space \n",
        "\n",
        "\n\n",
        "\n\n\n",
        "a\n",
        " \n ",
        "tab\there\nand\there\n",
        "line\n  more indented\nback\n",
    ] {
        values.push(value.to_owned());
    }

    // Carriage returns, which no block or quoted style but `"` can hold.
    for value in ["a\r\nb", "a\rb", "\r", "\r\n", "a\r\n"] {
        values.push(value.to_owned());
    }

    // Non-ASCII, never to be normalised or escaped.
    for value in [
        "é",
        "e\u{301}",
        "😀",
        "⌘⌥⇧",
        "עברית ואנגלית",
        "señor año",
        "こんにちは",
        "é\ndecomposed e\u{301}\n",
    ] {
        values.push(value.to_owned());
    }

    // A very long single line, and a long line inside a block.
    values.push("x".repeat(4096));
    values.push(format!("{}\n{}\n", "y".repeat(2048), "z".repeat(2048)));

    values
} // End of function adversarial_values()

#[test]
fn choose_scalar_round_trips_every_adversarial_value() {
    let values = adversarial_values();
    let mut failures = Vec::new();
    for value in &values {
        failures.extend(round_trip(value));
    }
    println!(
        "adversarial set: {} values round-tripped through {} value sites and {} key sites each",
        values.len(),
        BLOCK_SITES.len() + 1,
        BLOCK_SITES.len() + 1
    );
    assert!(failures.is_empty(), "round-trip failures: {failures:#?}");
} // End of function choose_scalar_round_trips_every_adversarial_value()

#[test]
fn a_whitespace_only_final_line_at_end_of_file_keeps_its_columns() {
    // Phase 0c-1 review, finding 2 — formerly a documented shortfall, now
    // fixed, and pinned in the direction that matters: our span-derived decode
    // must equal the substrate's.
    //
    // The file's last line is three spaces with no terminator. Under `|2` that
    // is two columns of block indentation plus one column of content, so the
    // value is " \n ". `block::content_len` used to write the whole line off as
    // the next token's indentation because it had no indentation column to
    // compare against; it now takes one, and a whitespace-only final line is
    // content exactly when it is wider than that column.
    let document = "key: |2-\n   \n   ";
    let (substrate, ours) = parse_back(document).expect("the document parses");
    assert_eq!(substrate, " \n ", "the substrate keeps the final line");
    assert_eq!(ours, " \n ", "and so do we");

    // The same block one byte from the end of the file, which never went
    // through the end-of-source branch at all.
    let followed = "key: |2-\n   \n   \nnext: 1\n";
    let (substrate, ours) = parse_back(followed).expect("the document parses");
    assert_eq!(substrate, " \n ");
    assert_eq!(ours, " \n ");

    // The neighbouring shapes, so the fix cannot become "always keep it": a
    // final line at or inside the indentation column is still an empty line.
    for (document, expected) in [
        ("key: |2-\n  a\n  ", "a"),
        ("key: |2-\n  a\n   ", "a\n "),
        ("key: |2-\n  a\n    ", "a\n  "),
        ("key: |2-\n  a\n\t", "a"),
        ("key: |2-\n  a\n  \t", "a\n\t"),
        ("key: |2-\n   ", " "),
        ("key: |2-\n  ", ""),
        ("key: |2+\n  a\n   ", "a\n \n"),
    ] {
        let (substrate, ours) = parse_back(document).expect("the document parses");
        assert_eq!(substrate, expected, "substrate for {document:?}");
        assert_eq!(ours, expected, "our decode for {document:?}");
    } // End of the loop over the neighbouring terminal-whitespace shapes
} // End of function a_whitespace_only_final_line_at_end_of_file_keeps_its_columns()

#[test]
fn a_block_body_column_more_than_nine_past_its_parent_still_round_trips() {
    // Phase 0c-1 review, finding 1, end to end. The indentation indicator can
    // only spell 1..=9 columns past the parent, and the emitter used to clamp
    // the indicator while leaving the body at the requested column: the surplus
    // columns then came back as leading spaces in the value.
    let value = " x\n";
    for indent in [3, 9, 10, 11, 20, 40] {
        let context = ScalarContext::block(0, LineEnding::Lf).with_indent(indent);
        let plan = choose_scalar(value, context);
        let document = format!("key: {}next: 1\n", plan.render());
        let (substrate, ours) = parse_back(&document).expect("the document parses");
        assert_eq!(
            substrate,
            value,
            "indent {indent} rendered as {:?}",
            plan.render()
        );
        assert_eq!(ours, value, "indent {indent}");
    } // End of the loop over the requested body columns

    // The same value nested, so the parent column is not zero.
    for parent in [2, 4] {
        for indent in [parent + 9, parent + 10, parent + 25] {
            let context = ScalarContext::block(parent, LineEnding::Lf).with_indent(indent);
            let plan = choose_scalar(value, context);
            let padding = " ".repeat(parent);
            let document = format!("outer:\n{padding}key: {}", plan.render());
            let (substrate, ours) = parse_back(&document).expect("the document parses");
            assert_eq!(substrate, value, "parent {parent}, indent {indent}");
            assert_eq!(ours, value, "parent {parent}, indent {indent}");
        }
    } // End of the loop over the nested sites

    // An unambiguous value needs no indicator, so a deep column is honoured
    // exactly rather than pulled back: the fix must not over-refuse.
    let deep = ScalarContext::block(0, LineEnding::Lf).with_indent(20);
    let plan = choose_scalar("x\n", deep);
    assert_eq!(plan.render_header(), "|");
    assert_eq!(plan.render_content(), format!("{}x\n", " ".repeat(20)));
} // End of function a_block_body_column_more_than_nine_past_its_parent_still_round_trips()

#[test]
fn the_yaml_one_one_line_separators_are_emitted_escaped() {
    // Phase 0c-1 review, finding 3. `saphyr-parser` accepts a raw U+2028 in
    // every style (measured), so the round-trip oracle alone cannot see this:
    // the assertion has to be about the *bytes emitted*, not about what comes
    // back. Under YAML 1.1 — espanso's own dialect — these are line breaks.
    for (value, escape) in [("a\u{2028}b", r"\L"), ("a\u{2029}b", r"\P")] {
        for context in [
            ScalarContext::block(0, LineEnding::Lf),
            ScalarContext::block(0, LineEnding::Lf).as_key(),
            ScalarContext::flow(0, LineEnding::Lf),
        ] {
            let plan = choose_scalar(value, context);
            assert_eq!(plan.style(), ScalarStyle::DoubleQuoted, "{value:?}");
            let rendered = plan.render();
            assert!(
                rendered.contains(escape),
                "{value:?} rendered as {rendered:?} without {escape}"
            );
            assert!(
                !rendered.contains('\u{2028}') && !rendered.contains('\u{2029}'),
                "{value:?} rendered a raw separator: {rendered:?}"
            );
        }
    } // End of the loop over the two separators

    // A multi-line value carrying one leaves the block style entirely, because
    // a block scalar has no escape grammar to spell it with.
    let plan = choose_scalar("a\u{2028}b\nc\n", ScalarContext::block(0, LineEnding::Lf));
    assert_eq!(plan.style(), ScalarStyle::DoubleQuoted);
    assert_eq!(plan.render(), "\"a\\Lb\\nc\\n\"");
} // End of function the_yaml_one_one_line_separators_are_emitted_escaped()

#[test]
fn unicode_noncharacters_are_emitted_escaped() {
    // Phase 0c-1 review, finding 7, and its measurement: `saphyr-parser`
    // accepts U+FFFE, U+FFFF and U+FDD0 raw *and* through their `\u` escapes,
    // so the substrate can represent them either way. U+FFFE and U+FFFF are
    // outside YAML's own `c-printable` production and all of them are Unicode
    // noncharacters, so the escaped spelling is the one that survives a
    // stricter parser — and it is lossless here, which a refusal would not be.
    for value in ["\u{fffe}", "\u{ffff}", "\u{fdd0}", "\u{1fffe}"] {
        for context in [
            ScalarContext::block(0, LineEnding::Lf),
            ScalarContext::flow(0, LineEnding::Lf),
        ] {
            let plan = choose_scalar(value, context);
            assert_eq!(plan.style(), ScalarStyle::DoubleQuoted, "{value:?}");
            let rendered = plan.render();
            assert!(
                rendered.is_ascii(),
                "{value:?} rendered a raw noncharacter: {rendered:?}"
            );
            let document = format!("key: {rendered}\n");
            let (substrate, ours) = parse_back(&document).expect("the document parses");
            assert_eq!(substrate, value, "rendered as {rendered:?}");
            assert_eq!(ours, value, "rendered as {rendered:?}");
        }
    } // End of the loop over the noncharacters
} // End of function unicode_noncharacters_are_emitted_escaped()

// ---------------------------------------------------------------------------
// Oracle 3b — a seeded generative sweep over the same property
// ---------------------------------------------------------------------------

/// A deliberately tiny xorshift64* generator.
///
/// Seeded and deterministic so a failure is reproducible, and hand-written so
/// the crate gains no dependency: `proptest` and `quickcheck` would both be new
/// entries in a workspace that currently has four.
struct Prng(u64);

impl Prng {
    /// Returns the next pseudo-random word.
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// Returns a value in `0..bound`.
    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }
}

/// The alphabet the sweep draws from: every character class that has ever
/// needed a quoting decision.
const SWEEP_ALPHABET: [char; 43] = [
    'a', 'b', 'y', 'n', '0', '1', '.', ' ', '\t', '\n', '\r', ':', '#', '-', '?', ',', '[', ']',
    '{', '}', '\'', '"', '\\', '|', '>', '!', '%', '@', '`', '&', '*', '~', '=', '/', 'é', '😀',
    '\u{85}', '\u{a0}', '\u{2028}', '\u{1b}', '\u{2029}', '\u{fffe}', '<',
];

#[test]
fn choose_scalar_round_trips_a_seeded_generative_sweep() {
    let mut prng = Prng(0x5eed_1c0d_e5ca_1a12);
    let mut failures = Vec::new();
    let cases = 1500;
    for _ in 0..cases {
        let length = prng.below(9);
        let value: String = (0..length)
            .map(|_| SWEEP_ALPHABET[prng.below(SWEEP_ALPHABET.len())])
            .collect();
        failures.extend(round_trip(&value));
        if failures.len() > 20 {
            break;
        }
    } // End of the loop over the generated cases
    println!(
        "generative sweep: {cases} seeded values round-tripped through {} value sites and \
         {} key sites each",
        BLOCK_SITES.len() + 1,
        BLOCK_SITES.len() + 1
    );
    assert!(failures.is_empty(), "sweep failures: {failures:#?}");
} // End of function choose_scalar_round_trips_a_seeded_generative_sweep()

// ---------------------------------------------------------------------------
// Style preservation
// ---------------------------------------------------------------------------

/// The distinct presentations the corpus donates, several per style.
///
/// The reviewer's point about the earlier version of this test: one
/// presentation per style cannot see a *presentation variant*, so a block
/// scalar's indentation, its chomping and its header-indicator order were all
/// untested through `preserve_scalar`. Presentations are therefore keyed on
/// everything that changes what is emitted — style, indentation, chomping,
/// explicit indicator and indicator order — and the two header orders that no
/// corpus fixture carries are synthesised so both are covered.
fn distinct_presentations() -> Vec<ScalarPresentation> {
    let mut by_shape: BTreeMap<String, ScalarPresentation> = BTreeMap::new();
    let mut record = |presentation: ScalarPresentation| {
        by_shape.insert(
            format!(
                "{:?}/{}/{:?}/{:?}/{:?}",
                presentation.style,
                presentation.indent,
                presentation.chomping,
                presentation.explicit_indent,
                presentation.indicator_order
            ),
            presentation,
        );
    };
    for file in common::synthetic_valid() {
        let Ok(index) = SyntaxIndex::parse(&file.source) else {
            continue;
        };
        for node in index.nodes() {
            if let Some(scalar) = &node.scalar {
                record(scalar.presentation);
            }
        }
    } // End of the loop over the corpus files

    // Both block-header indicator orders, which no fixture spells.
    for document in ["key: |2+\n   body\n", "key: |+2\n   body\n"] {
        let index = SyntaxIndex::parse(document).expect("the document parses");
        for node in index.nodes() {
            if let Some(scalar) = &node.scalar {
                record(scalar.presentation);
            }
        }
    } // End of the loop over the two indicator orders
    by_shape.into_values().collect()
} // End of function distinct_presentations()

#[test]
fn preserve_scalar_round_trips_every_adversarial_value_through_every_presentation() {
    // Every distinct corpus presentation is donated; every adversarial value is
    // written into it. Whatever `preserve_scalar` decides, the value must come
    // back unchanged.
    let presentations = distinct_presentations();
    let mut styles: BTreeMap<String, usize> = BTreeMap::new();
    for presentation in &presentations {
        *styles
            .entry(format!("{:?}", presentation.style))
            .or_default() += 1;
    }
    assert_eq!(styles.len(), 5, "every style must be represented");
    assert!(
        styles.values().all(|count| *count > 1),
        "every style needs more than one presentation: {styles:?}"
    );

    let site = &BLOCK_SITES[2];
    let context = ScalarContext::block(site.parent_indent, site.line_ending);
    let mut failures = Vec::new();
    let mut checked = 0;
    for value in adversarial_values() {
        for presentation in &presentations {
            let plan = preserve_scalar(&value, presentation, context);
            let document = document_for(site, &plan);
            checked += 1;
            match parse_back(&document) {
                Ok((substrate, _)) if substrate == value => {}
                Ok((substrate, _)) => failures.push(format!(
                    "{:?} presentation, {value:?} rendered as {:?} came back as {substrate:?}",
                    presentation.style,
                    plan.render()
                )),
                Err(problem) => failures.push(format!(
                    "{:?} presentation, {value:?} rendered as {:?}: {problem}",
                    presentation.style,
                    plan.render()
                )),
            }
        }
    } // End of the loop over the adversarial values
    println!(
        "style preservation: {checked} (value, presentation) pairs round-tripped over {} \
         distinct presentations {styles:?}",
        presentations.len()
    );
    assert!(failures.is_empty(), "preservation failures: {failures:#?}");
} // End of function preserve_scalar_round_trips_every_adversarial_value_through_every_presentation()

#[test]
fn an_unchanged_corpus_scalar_keeps_its_style_when_rewritten_with_its_own_value() {
    // Rule 1 of plan section 6.3, measured over the corpus rather than asserted
    // in the abstract: feeding a scalar its own value back must keep its
    // presentation **exactly when the presentation can still carry that
    // value**, and must change it otherwise. Both halves are checked, so a
    // `preserve_scalar` that simply never changed anything would fail here just
    // as loudly as one that changed everything.
    let mut kept = 0;
    let mut changed = 0;
    let mut surprises = Vec::new();
    for file in common::synthetic_valid() {
        let Ok(index) = SyntaxIndex::parse(&file.source) else {
            continue;
        };
        for node in index.nodes() {
            let Some(scalar) = &node.scalar else {
                continue;
            };
            let value = &scalar.value;
            let representable = match scalar.presentation.style {
                ScalarStyle::Plain => {
                    !value.contains('\n') && is_conservatively_safe_plain_scalar(value)
                }
                ScalarStyle::SingleQuoted => single_quotes_can_carry(value),
                ScalarStyle::DoubleQuoted => true,
                ScalarStyle::Literal => literal_block_can_carry(value),
                // `>` is decode-only in this crate, so it is never preserved.
                ScalarStyle::Folded => false,
            };
            let context =
                ScalarContext::block(scalar.presentation.indent.saturating_sub(2), LineEnding::Lf);
            let plan = preserve_scalar(value, &scalar.presentation, context);
            let same = plan.style() == scalar.presentation.style;
            if same == representable {
                if same {
                    kept += 1;
                } else {
                    changed += 1;
                }
            } else {
                surprises.push(format!(
                    "{}: {:?} became {:?} at bytes {}..{} (representable: {representable})",
                    file.name,
                    scalar.presentation.style,
                    plan.style(),
                    node.span.start,
                    node.span.end
                ));
            }
        }
    } // End of the loop over the corpus files
    println!(
        "style preservation over the synthetic corpus: {kept} scalars kept their style, \
         {changed} could no longer carry their value and were restyled"
    );
    assert!(surprises.is_empty(), "rule 1 violations: {surprises:#?}");
    assert!(kept > 0 && changed > 0);
} // End of function an_unchanged_corpus_scalar_keeps_its_style_when_rewritten_with_its_own_value()

// ---------------------------------------------------------------------------
// The one place the two decoders answer differently — Phase 0c-3a
// ---------------------------------------------------------------------------

#[test]
fn an_implicit_node_is_the_one_place_the_two_decoders_answer_differently() {
    // `compare_decoders` skips zero-width scalars, and a skip that is not
    // bounded is a hiding place. This states exactly what is being skipped, why,
    // and how many there are.
    //
    // An entry written `label:` with nothing after it has an **implicit** value:
    // the substrate resolves it to YAML's null and reports the value `~`, while
    // our decoder reads the span — which is empty — and returns the empty
    // string. The two are answering different questions, and reconciling them
    // needs a null in the value model rather than a change to the codec.
    //
    // Phase 0c-3a found this by adding the corpus's first empty mapping entry;
    // before that no fixture in either corpus had one, so the divergence existed
    // and was invisible. Nothing edits such a node — `EditError::EmptyTarget`
    // refuses it — so nothing is corrupted by it today.
    let source = "label:\n";
    let index = SyntaxIndex::parse(source).expect("parses");
    let implicit = index
        .nodes()
        .iter()
        .find(|node| node.scalar.is_some() && node.is_zero_width())
        .expect("an implicit value");
    let scalar = implicit.scalar.as_ref().expect("scalar data");
    assert_eq!(scalar.value, "~", "the substrate resolves it to null");
    assert_eq!(
        decode(source, &scalar.presentation),
        Ok(String::new()),
        "our decoder reads the span, which is empty"
    );

    // The three properties `compare_decoders` asserts of every node it skips,
    // stated once here on a node that is unambiguously implicit. Added by the
    // Phase 0c-3a review, which accepted the skip's reasoning and asked that it
    // be unable to widen: a zero-width scalar that is quoted, or carries a block
    // header, or resolves to anything but `~`, is not an implicit node and must
    // not be skipped.
    assert_eq!(scalar.presentation.style, ScalarStyle::Plain);
    assert!(scalar.presentation.header_span.is_empty());

    // And the corpus-wide count of the skip, pinned.
    let skipped: usize = common::synthetic_valid()
        .iter()
        .map(|file| {
            SyntaxIndex::parse(&file.source)
                .expect("parses")
                .zero_width_leaves()
                .count()
        })
        .sum();
    println!("\nsynthetic corpus: {skipped} implicit nodes skipped by the decoder oracle");
    assert_eq!(
        skipped, 5,
        "the four empty entries of empty-entries-and-extents.yml plus its bare item"
    );
} // End of function an_implicit_node_is_the_one_place_the_two_decoders_answer_differently()
