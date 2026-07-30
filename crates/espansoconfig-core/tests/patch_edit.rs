//! Phase 0c-2b acceptance: the first code that mutates a document.
//!
//! This is the 0c-3 gate test in miniature. For **every addressable scalar** of
//! all 23 synthetic fixtures and of the real corpus, a set of replacement values
//! is attempted, and each attempt must end in one of exactly two ways:
//!
//! - a **typed refusal whose reason this file re-derives from the document
//!   itself**, never from the engine's word for it. That matters more than it
//!   looks: an engine that refused *everything* would satisfy "no edit ever
//!   corrupted a file" while being useless, and only an independent derivation
//!   of each reason catches it;
//! - a **successful edit satisfying all three verification properties**: the
//!   candidate parses, re-resolving the same path decodes to exactly the
//!   intended value, and every byte outside the spans the edited scalar *owns*
//!   is byte-identical. All three are re-checked here rather than trusted.
//!
//! Synthetic counts are pinned **per fixture and per category**
//! ([`SYNTHETIC_OUTCOMES`]), so neither two opposing drifts inside one number
//! nor two fixtures exchanging eligibility can pass unnoticed. No count taken
//! from the real corpus is hard-coded.
//!
//! # The permitted spans are not the planner's opinion
//!
//! The Phase 0c-2b review's finding 3: an acceptance test that rebuilds the
//! candidate from `PatchedDocument::replacements()` and measures those
//! replacements against an envelope derived from the *same policy as production*
//! authorises whatever production decided. So [`permitted`] here states the rule
//! from **immutable syntax facts** instead — a block scalar owns its
//! `header_span` and its `content_span`, and the bytes between them (the header
//! line's tail and its own line break, `PROGRESS.md` D2c) belong to neither —
//! and every replacement must lie wholly inside one of those exact spans.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! This file prints file names, counts and byte offsets only. It never prints a
//! scalar, a key, a path or a byte of real content, and every real-corpus test
//! skips cleanly when the directory is absent.

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::emit::{decode, literal_block_can_carry};
use espansoconfig_core::patch::{
    apply_scalar_edit, apply_scalar_edits, path_to, resolve, DocumentPath, EditError,
    PatchedDocument, ScalarEdit,
};
use espansoconfig_core::syntax::{Hazard, NodeKind, ScalarPresentation, TriviaIndex};
use espansoconfig_core::{ByteSpan, NodeId, ScalarStyle, SyntaxIndex};

/// The values every addressable scalar is asked to take.
///
/// Chosen to reach every branch of the emitter and of the span surgery: a
/// plain-safe word, the empty string (which no block scalar can hold), a YAML
/// 1.1 boolean spelling, a value that would become a key if left plain, an
/// apostrophe, a regex full of backslashes, padding YAML would strip, the three
/// trailing-newline classes that drive chomping, a control character that only
/// double quotes can carry, and non-ASCII including an astral character.
const REPLACEMENTS: [&str; 12] = [
    "plain",
    "",
    "no",
    "a: b",
    "Don't",
    r"(?P<ticket>[A-Z]+-\d+)",
    "  padded  ",
    "one\ntwo\n",
    "one\ntwo",
    "one\ntwo\n\n",
    "a\tb",
    "día ⌘😀",
];

/// How many of the twelve values each real-corpus scalar is given.
///
/// The real files are an order of magnitude larger than the synthetic ones and
/// `TriviaIndex::scan` is quadratic in (trivia items × nodes) — see [`audit`] —
/// so the full cross product costs a minute of wall clock on a test that only
/// ever runs on the one machine that has the private corpus. Four of the twelve
/// values per scalar, rotated by node index, keeps every value exercised over
/// the corpus at a quarter of the cost. The synthetic sweep, which everyone
/// runs, keeps the full cross product.
const REAL_CORPUS_STRIDE: usize = 3;

/// How every attempted edit of one corpus ended.
///
/// The four categories are exhaustive over the outcomes an addressable,
/// non-zero-width scalar can produce: [`audit`] panics on anything else, so a
/// new refusal family cannot slip in as "some other error".
#[derive(Debug, Default, PartialEq, Eq)]
struct Tally {
    /// Edits that applied and satisfied all three verification properties.
    applied: usize,
    /// Edits the hazard gate refused.
    refused_by_the_gate: usize,
    /// Edits refused because the target is an empty, zero-width scalar.
    empty_target: usize,
    /// Edits refused because the value's trailing newlines are unrepresentable.
    trailing_newlines: usize,
}

impl Tally {
    /// Every attempt this tally accounts for.
    fn total(&self) -> usize {
        self.applied + self.refused_by_the_gate + self.empty_target + self.trailing_newlines
    }

    /// Folds another file's tally into this one.
    fn add(&mut self, other: &Tally) {
        self.applied += other.applied;
        self.refused_by_the_gate += other.refused_by_the_gate;
        self.empty_target += other.empty_target;
        self.trailing_newlines += other.trailing_newlines;
    }
} // End of impl Tally

/// One fixture's pinned outcome row: its file name followed by the four
/// [`Tally`] fields in declaration order — applied, refused by the gate, empty
/// target, trailing newlines.
type OutcomeRow = (&'static str, usize, usize, usize, usize);

/// Every synthetic fixture's complete outcome split, pinned exactly.
///
/// The Phase 0c-2b review's finding 4: the corpus-wide per-category totals this
/// file used to assert let **two fixtures exchange eligibility** without moving
/// any number. A complete per-fixture row cannot. The list is also asserted to
/// cover the corpus exactly, so a new fixture has to be given a row rather than
/// disappearing into a total.
///
/// Each row is `addressable scalars × 12` replacement values, split by outcome.
const SYNTHETIC_OUTCOMES: [OutcomeRow; 23] = [
    ("anchors-aliases-tags-merge.yml", 60, 144, 0, 0),
    ("blank-lines.yml", 106, 0, 0, 2),
    // Every one of its 72 attempts applies, header comment and header spaces
    // included: that is the Phase 0c-2b review's finding 1 and finding 2 pinned
    // on corpus data rather than on a hand-written source string.
    ("block-scalar-header-tails.yml", 72, 0, 0, 0),
    ("block-scalar-leading-blank-lines.yml", 180, 0, 0, 0),
    ("block-scalar-terminal-spaces.yml", 60, 0, 0, 0),
    ("block-scalars.yml", 396, 0, 0, 0),
    ("bom-utf8.yml", 48, 0, 0, 0),
    ("comments-everywhere.yml", 84, 0, 0, 0),
    ("config-profile.yml", 192, 0, 0, 0),
    ("crlf-line-endings.yml", 72, 0, 0, 0),
    ("duplicate-keys.yml", 96, 24, 0, 0),
    ("flow-collections.yml", 240, 36, 0, 0),
    ("folded-more-indented.yml", 144, 0, 0, 0),
    ("form-layout-and-choice.yml", 384, 0, 0, 0),
    ("html-and-markdown.yml", 132, 0, 0, 0),
    ("imports-and-global-vars.yml", 312, 0, 0, 0),
    ("multi-document.yml", 0, 72, 0, 0),
    ("no-trailing-newline.yml", 24, 0, 0, 0),
    ("non-ascii.yml", 180, 0, 0, 0),
    ("plain-scalar-hazards.yml", 888, 0, 0, 0),
    ("scalar-styles.yml", 264, 0, 0, 0),
    ("unicode-offsets.yml", 60, 0, 0, 0),
    ("variable-chain.yml", 456, 0, 0, 0),
];

/// Parses a corpus file, failing loudly with its name if it does not parse.
fn index_of(file: &CorpusFile) -> SyntaxIndex {
    SyntaxIndex::parse(&file.source).unwrap_or_else(|error| {
        panic!("{}: expected a valid fixture, got {error}", file.name);
    })
}

/// The exact spans an edit to this scalar is allowed to rewrite.
///
/// Stated from the two span facts the syntax index reports and from nothing else:
///
/// - a **block scalar** owns its `header_span` and its `content_span`, and those
///   two spans only. The bytes between them are the header line's tail — trailing
///   spaces, an inline comment — and the line break that ends it, because
///   `PROGRESS.md` D2c starts the content span *after* that break. They belong to
///   no scalar, so no scalar edit may write them;
/// - a **flow scalar** owns its token, delimiters included.
///
/// Deliberately **not** the `header_span.start .. content_span.end` envelope this
/// file used to allow: that envelope is what let a block-to-flow edit regenerate
/// a CRLF header as LF and delete three spaces the user had typed, and an
/// acceptance test that allows it cannot see the defect.
fn permitted(presentation: &ScalarPresentation, span: ByteSpan) -> Vec<ByteSpan> {
    if presentation.style.is_block() {
        vec![presentation.header_span, presentation.content_span]
    } else {
        vec![span]
    }
} // End of function permitted()

/// Re-derives the hazard gate's answer from the hazard list and the tree.
///
/// Deliberately not a call to `is_safely_editable`: the point is to know that
/// the refusal the engine reported is one the document actually justifies. A
/// hazard disqualifies a node when it sits on that node, on an ancestor, on a
/// descendant, or on no node at all.
fn hazard_that_blocks<'trivia>(
    index: &SyntaxIndex,
    trivia: &'trivia TriviaIndex,
    node: NodeId,
) -> Option<&'trivia Hazard> {
    let ancestors = {
        let mut chain = vec![node];
        let mut current = index.node(node).and_then(|here| here.parent);
        while let Some(id) = current {
            chain.push(id);
            current = index.node(id).and_then(|here| here.parent);
        }
        chain
    };
    let mut descendants = vec![node];
    let mut pending = vec![node];
    while let Some(id) = pending.pop() {
        if let Some(here) = index.node(id) {
            for child in &here.children {
                descendants.push(*child);
                pending.push(*child);
            }
        }
    } // End of the walk that collects the node's descendants

    trivia.hazards().iter().find(|hazard| match hazard.node {
        None => true,
        Some(flagged) => ancestors.contains(&flagged) || descendants.contains(&flagged),
    })
} // End of function hazard_that_blocks()

/// Re-derives whether `value` will be written as a literal block.
///
/// Built from the emitter's own **public predicates** rather than from the edit
/// engine, so it is an independent statement of the same rule: an existing block
/// scalar keeps its style whenever a literal block can carry the new value, and
/// a folded one is rewritten as `|` only when the new value is multi-line.
fn becomes_a_block(style: ScalarStyle, value: &str) -> bool {
    if !literal_block_can_carry(value) {
        return false;
    }
    match style {
        ScalarStyle::Literal => true,
        _ => value.contains('\n'),
    }
}

/// The bytes from `at` to the end of its line, trimmed of spaces and tabs.
fn line_tail(source: &str, at: usize) -> &str {
    let rest = &source[at..];
    let end = rest.find(['\n', '\r']).unwrap_or(rest.len());
    rest[..end].trim_matches([' ', '\t'])
}

/// How many line breaks the run at `source[at..]` holds, `\r\n` counting once.
fn following_breaks(source: &str, at: usize) -> usize {
    let mut rest = &source[at..];
    let mut count = 0;
    loop {
        if let Some(tail) = rest.strip_prefix("\r\n") {
            rest = tail;
        } else if let Some(tail) = rest.strip_prefix('\n').or_else(|| rest.strip_prefix('\r')) {
            rest = tail;
        } else {
            return count;
        }
        count += 1;
    } // End of the loop over the leading line-break run
}

/// Checks the three verification properties on a successful edit, again.
///
/// The engine verifies its own output; this repeats the work from the outside so
/// that a bug in the engine's verifier cannot hide a bug in its splice.
fn check_applied(
    label: &str,
    source: &str,
    path: &DocumentPath,
    value: &str,
    allowed: &[ByteSpan],
    patched: &PatchedDocument,
) {
    // Property 3, in the strongest form available: every replacement lies wholly
    // inside **one** of the spans the edited scalar owns, and the candidate is
    // exactly the source with those replacements applied. Together those say that
    // no byte outside those spans changed at all — the header line's tail and its
    // line break included, since they are inside neither.
    let mut rebuilt = String::with_capacity(patched.text().len());
    let mut cursor = 0usize;
    for replacement in patched.replacements() {
        assert!(
            allowed.iter().any(|span| span.contains(replacement.span)),
            "{label}: replacement {}..{} is not wholly inside one permitted span",
            replacement.span.start,
            replacement.span.end
        );
        assert!(
            replacement.span.start >= cursor,
            "{label}: replacements are not in ascending order"
        );
        rebuilt.push_str(&source[cursor..replacement.span.start]);
        rebuilt.push_str(&replacement.text);
        cursor = replacement.span.end;
    } // End of the loop that rebuilds the candidate from the replacement list
    rebuilt.push_str(&source[cursor..]);
    assert_eq!(
        rebuilt.len(),
        patched.text().len(),
        "{label}: the candidate is not the source with the replacements applied"
    );
    assert!(
        rebuilt == patched.text(),
        "{label}: the candidate is not the source with the replacements applied"
    );

    // Property 1: it still parses.
    let index = SyntaxIndex::parse(patched.text())
        .unwrap_or_else(|error| panic!("{label}: the candidate does not parse: {error}"));

    // Property 2: re-resolving the same path decodes to exactly the value asked
    // for — checked with the substrate's decoder and with ours.
    let id = resolve(&index, path)
        .unwrap_or_else(|error| panic!("{label}: the path is lost in the candidate: {error}"));
    let node = index.node(id).expect("a resolved node exists");
    let scalar = node
        .scalar
        .as_ref()
        .unwrap_or_else(|| panic!("{label}: the path now names a {:?}", node.kind));
    assert!(
        scalar.value == value,
        "{label}: the candidate holds a {}-byte value where {} bytes were intended",
        scalar.value.len(),
        value.len()
    );
    let ours = decode(patched.text(), &scalar.presentation)
        .unwrap_or_else(|error| panic!("{label}: our decoder failed on the candidate: {error}"));
    assert!(
        ours == scalar.value,
        "{label}: our decoder and the substrate disagree about the candidate"
    );
} // End of function check_applied()

/// Asserts a block scalar's header-line tail came through the edit unchanged.
///
/// The Phase 0c-2b review's finding 1, checked in bytes rather than inferred: the
/// tail runs from the end of the indicator to the start of the content, so it
/// holds whatever the user wrote after `|` — spaces, a comment — and the line
/// break that terminates the header line. It sits between the two permitted
/// spans, so it must appear in the candidate immediately after the new header,
/// byte for byte, whatever style the new value took.
fn check_the_header_tail_survived(
    label: &str,
    source: &str,
    presentation: &ScalarPresentation,
    patched: &PatchedDocument,
) {
    if !presentation.style.is_block() {
        return;
    }
    let tail = &source[presentation.header_span.end..presentation.content_span.start];
    let header = patched
        .replacements()
        .iter()
        .find(|replacement| replacement.span == presentation.header_span)
        .unwrap_or_else(|| panic!("{label}: a block edit must replace its header span"));
    let at = presentation.header_span.start + header.text.len();
    assert_eq!(
        patched.text().get(at..at + tail.len()),
        Some(tail),
        "{label}: the header line's tail ({} bytes) did not survive at byte {at}",
        tail.len()
    );
} // End of function check_the_header_tail_survived()

/// Asserts the flow fallback fired instead of a refusal.
///
/// The Phase 0c-2b review's finding 2, second counterexample, re-derived at
/// corpus scale: a value the emitter would write as a block scalar, on a line
/// whose tail is not free, is written as a **double-quoted flow scalar on one
/// physical line** rather than refused. The obstruction — a comment — is outside
/// the token and therefore already covered by the permitted-span property; what
/// this adds is that the value survives and the style is one that can hold it.
fn check_the_flow_fallback(
    label: &str,
    path: &DocumentPath,
    value: &str,
    patched: &PatchedDocument,
) {
    let index = SyntaxIndex::parse(patched.text()).expect("the candidate parses");
    let id = resolve(&index, path).expect("the path survives");
    let scalar = index
        .node(id)
        .and_then(|node| node.scalar.as_ref())
        .unwrap_or_else(|| panic!("{label}: the path no longer names a scalar"));
    assert_eq!(
        scalar.presentation.style,
        ScalarStyle::DoubleQuoted,
        "{label}: an occupied line must be answered with a double-quoted scalar"
    );
    assert!(scalar.value == value, "{label}: the value did not survive");
    assert_eq!(
        scalar
            .presentation
            .content_span
            .slice(patched.text())
            .unwrap_or_default()
            .matches('\n')
            .count(),
        0,
        "{label}: the fallback token must occupy one physical line"
    );
} // End of function check_the_flow_fallback()

/// Attempts replacement values on every addressable scalar of one file.
///
/// `stride` thins the value set: `1` applies all twelve values to every scalar,
/// and `n > 1` gives each scalar the values whose position is congruent to its
/// own node index modulo `n`, so every value is still applied to a share of the
/// corpus. It exists for one reason, measured rather than assumed:
/// `TriviaIndex::scan` is **quadratic** in (trivia items × nodes) — its
/// ownership primitives scan every node once per item — so a 17 KB real file
/// costs 20 ms to scan against 2.6 ms to parse, and the safe entry point
/// re-scans on every call by design. The synthetic corpus therefore keeps the
/// full cross product, and the real corpus, whose files are an order of
/// magnitude larger, is swept with a stride.
///
/// Returns the tally. Any outcome this function cannot justify from the document
/// panics, which includes **every** verification failure: a verification failure
/// is a defect in the engine, not an expected answer.
fn audit(name: &str, source: &str, stride: usize) -> Tally {
    let index = SyntaxIndex::parse(source).expect("the caller checked this parses");
    let trivia = TriviaIndex::scan(source, &index);
    let mut tally = Tally::default();

    for node in index.nodes() {
        if node.kind != NodeKind::Scalar {
            continue;
        }
        // Only a node a path can name is an edit target; `path_to` refuses
        // documents, mapping keys, duplicated keys and non-scalar keys, and
        // `tests/patch_path.rs` is where those refusals are audited.
        let Ok(path) = path_to(&index, node.id) else {
            continue;
        };
        let scalar = node.scalar.as_ref().expect("a scalar node has scalar data");
        let presentation = &scalar.presentation;
        let allowed = permitted(presentation, node.span);
        let blocked = hazard_that_blocks(&index, &trivia, node.id);

        for (choice, value) in REPLACEMENTS.iter().enumerate() {
            if choice % stride != node.id.get() % stride {
                continue;
            }
            let value = *value;
            let label = format!("{name} node {} value {}", node.id.get(), value.len());
            match apply_scalar_edit(source, &path, value) {
                Ok(patched) => {
                    assert!(
                        blocked.is_none(),
                        "{label}: applied although a hazard disqualifies the node"
                    );
                    assert!(
                        !node.is_zero_width(),
                        "{label}: applied to a zero-width scalar"
                    );
                    check_applied(&label, source, &path, value, &allowed, &patched);
                    check_the_header_tail_survived(&label, source, presentation, &patched);
                    if becomes_a_block(presentation.style, value)
                        && !presentation.style.is_block()
                        && !line_tail(source, node.span.end).is_empty()
                    {
                        check_the_flow_fallback(&label, &path, value, &patched);
                    }
                    tally.applied += 1;
                }
                Err(EditError::Refused { hazard, .. }) => {
                    let derived = blocked
                        .unwrap_or_else(|| panic!("{label}: refused with no hazard to justify it"));
                    assert_eq!(
                        derived.kind, hazard,
                        "{label}: refused for a hazard the document does not have"
                    );
                    tally.refused_by_the_gate += 1;
                }
                Err(EditError::EmptyTarget { at, .. }) => {
                    assert!(
                        node.is_zero_width(),
                        "{label}: refused as empty although it owns bytes"
                    );
                    assert_eq!(
                        at, node.span,
                        "{label}: the reported span is not the node's"
                    );
                    tally.empty_target += 1;
                }
                Err(EditError::TrailingNewlinesNotRepresentable {
                    wanted, following, ..
                }) => {
                    assert_eq!(
                        wanted,
                        value.len() - value.trim_end_matches('\n').len(),
                        "{label}: the reported count is not the value's"
                    );
                    assert!(wanted >= 2, "{label}: only keep chomping is exact");
                    assert!(
                        wanted < following,
                        "{label}: refused although the count fits"
                    );
                    assert_eq!(
                        following,
                        following_breaks(source, presentation.content_span.end),
                        "{label}: the reported break run is not the document's"
                    );
                    tally.trailing_newlines += 1;
                }
                Err(other) => panic!("{label}: unexpected outcome {other}"),
            }
        } // End of the loop over the replacement values
    } // End of the loop over every scalar of the document

    tally
} // End of function audit()

#[test]
fn every_addressable_synthetic_scalar_is_edited_or_refused_for_a_derivable_reason() {
    let files = synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus must be present");

    assert_eq!(
        files.len(),
        SYNTHETIC_OUTCOMES.len(),
        "every fixture needs a pinned outcome row"
    );

    println!("\n--- attempted edits per synthetic fixture ---");
    println!(
        "{:<48} {:>7} {:>7} {:>7} {:>7} {:>7}",
        "fixture", "total", "applied", "gate", "empty", "breaks"
    );
    let mut total = Tally::default();
    for file in &files {
        let _ = index_of(file);
        let tally = audit(&file.name, &file.source, 1);
        println!(
            "{:<48} {:>7} {:>7} {:>7} {:>7} {:>7}",
            file.name,
            tally.total(),
            tally.applied,
            tally.refused_by_the_gate,
            tally.empty_target,
            tally.trailing_newlines
        );
        // Pinned per fixture *and* per category. A corpus-wide per-category total
        // cannot tell two fixtures that exchanged eligibility from two that did
        // not, which is the review's finding 4; a complete row can.
        // Matched on the whole file name, not on a suffix: `blank-lines.yml` is a
        // suffix of `block-scalar-leading-blank-lines.yml`, so a suffix match
        // silently compares one fixture against another fixture's row.
        let base = file.name.rsplit('/').next().unwrap_or(&file.name);
        let row = SYNTHETIC_OUTCOMES
            .iter()
            .find(|row| row.0 == base)
            .unwrap_or_else(|| panic!("{} has no pinned outcome row", file.name));
        assert_eq!(
            tally,
            Tally {
                applied: row.1,
                refused_by_the_gate: row.2,
                empty_target: row.3,
                trailing_newlines: row.4,
            },
            "{}: outcome split",
            file.name
        );
        total.add(&tally);
    } // End of the loop over the valid synthetic fixtures

    println!(
        "synthetic: {} attempted edits — {} applied, {} refused by the gate, \
         {} empty-target, {} trailing-newline",
        total.total(),
        total.applied,
        total.refused_by_the_gate,
        total.empty_target,
        total.trailing_newlines
    );

    // The rows must also add up to the corpus-wide figures, so neither the rows
    // nor the totals can be "fixed" on their own. An engine that refused
    // everything would show up here as `applied == 0` even though every refusal
    // is separately justified above.
    //
    // 394 addressable scalars × 12 replacement values. The 388 this figure held
    // before Phase 0c-2b's fix round gained the 6 scalars of the new
    // `block-scalar-header-tails.yml`.
    assert_eq!(total.total(), 4728);
    assert_eq!(
        total.total(),
        SYNTHETIC_OUTCOMES
            .iter()
            .map(|row| row.1 + row.2 + row.3 + row.4)
            .sum::<usize>(),
        "the pinned rows must add up to the pinned total"
    );
    assert_eq!(total.applied, 4450);
    // 23 scalars × 12: everything an anchor, alias, tag, merge key, duplicate
    // key, multi-document marker or flow-interior comment reaches.
    assert_eq!(total.refused_by_the_gate, 276);
    // An empty entry (`empty:`) is a zero-width scalar with no bytes to replace,
    // so giving it a value is a structural edit rather than a span replacement.
    // No fixture holds an *addressable* one that the gate does not already
    // refuse, so this is a coverage statement; the branch is covered by
    // `an_empty_value_has_no_bytes_to_replace` in `src/patch/edit.rs`.
    assert_eq!(total.empty_target, 0);
    // The one block scalar followed by more blank lines than `one\ntwo\n\n`
    // wants, in two fixtures. The only refusal a *representable* value can still
    // meet: keep chomping is the one indicator that cannot leave a trailing break
    // as trivia (D2l).
    assert_eq!(total.trailing_newlines, 2);
} // End of function every_addressable_synthetic_scalar_is_edited_or_refused_for_a_derivable_reason()

#[test]
fn every_addressable_real_scalar_is_edited_or_refused_for_a_derivable_reason() {
    let files = real_corpus();
    if skip_without_real_corpus("real corpus scalar edits", &files) {
        return;
    }

    let mut total = Tally::default();
    for file in &files {
        let _ = index_of(file);
        total.add(&audit(&file.name, &file.source, REAL_CORPUS_STRIDE));
    }

    // No count from private data is hard-coded (`PROGRESS.md`, D1). What is
    // asserted is the shape of the result: real scalars are editable, and every
    // refusal was justified from the document by `audit` itself.
    println!(
        "real: {} files, {} attempted edits — {} applied, {} refused by the gate, \
         {} empty-target, {} trailing-newline",
        files.len(),
        total.total(),
        total.applied,
        total.refused_by_the_gate,
        total.empty_target,
        total.trailing_newlines
    );
    assert!(total.applied > 0, "no real scalar could be edited at all");
} // End of function every_addressable_real_scalar_is_edited_or_refused_for_a_derivable_reason()

// ---------------------------------------------------------------------------
// The awkward fixtures, pinned by name
//
// The corpus sweep proves the *properties*; these prove the bytes, on the five
// fixtures whose whitespace is the test data (`CLAUDE.md` section 4).
// ---------------------------------------------------------------------------

/// Loads one synthetic fixture by file name.
fn fixture(name: &str) -> CorpusFile {
    synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with(name))
        .unwrap_or_else(|| panic!("{name} must be in the corpus"))
}

/// The first addressable scalar of `source` whose style is `style`, with its
/// path.
fn first_scalar_of_style(source: &str, style: ScalarStyle) -> (DocumentPath, ByteSpan) {
    let index = SyntaxIndex::parse(source).expect("the fixture parses");
    for node in index.nodes() {
        let Some(scalar) = node.scalar.as_ref() else {
            continue;
        };
        if scalar.presentation.style != style || node.is_zero_width() {
            continue;
        }
        if let Ok(path) = path_to(&index, node.id) {
            return (path, node.span);
        }
    } // End of the loop that looks for a scalar of the wanted style
    panic!("no addressable {style:?} scalar in the fixture");
} // End of function first_scalar_of_style()

#[test]
fn an_edit_to_a_crlf_document_disturbs_no_other_line_ending() {
    let file = fixture("crlf-line-endings.yml");
    let (path, _) = first_scalar_of_style(&file.source, ScalarStyle::Plain);
    let patched = apply_scalar_edit(&file.source, &path, "one\ntwo\n").expect("the edit applies");

    let before = file.source.matches("\r\n").count();
    let bare = patched.text().matches('\n').count() - patched.text().matches("\r\n").count();
    assert_eq!(bare, 0, "an edit must not introduce a bare line feed");
    assert!(
        patched.text().matches("\r\n").count() > before,
        "the block scalar's own lines are CRLF too"
    );
}

#[test]
fn an_edit_to_a_bom_document_leaves_the_bom_alone() {
    let file = fixture("bom-utf8.yml");
    assert!(file.has_bom());
    let (path, _) = first_scalar_of_style(&file.source, ScalarStyle::Plain);
    let patched = apply_scalar_edit(&file.source, &path, "changed").expect("the edit applies");
    assert!(
        patched.text().starts_with('\u{feff}'),
        "the BOM must survive byte for byte"
    );
    for replacement in patched.replacements() {
        assert!(replacement.span.start >= 3, "no edit may touch the BOM");
    }
}

#[test]
fn an_edit_to_a_file_without_a_final_newline_does_not_add_one() {
    let file = fixture("no-trailing-newline.yml");
    assert!(!file.source.ends_with('\n'));
    let index = SyntaxIndex::parse(&file.source).expect("the fixture parses");

    // The last scalar of the file is the one whose edit could add a newline.
    let last = index
        .nodes()
        .iter()
        .filter(|node| node.scalar.is_some() && !node.is_zero_width())
        .max_by_key(|node| node.span.end)
        .expect("a scalar");
    assert_eq!(last.span.end, file.source.len());
    let path = path_to(&index, last.id).expect("it is addressable");

    let patched = apply_scalar_edit(&file.source, &path, "still no newline").expect("applies");
    assert!(
        !patched.text().ends_with('\n'),
        "an edit must not invent a final newline"
    );
}

#[test]
fn a_block_scalars_terminal_spaces_survive_an_edit_elsewhere() {
    // `block-scalar-terminal-spaces.yml` ends in two real spaces with no final
    // newline (R11). Editing a different scalar must leave those bytes alone,
    // which the envelope property already guarantees — this pins the bytes.
    let file = fixture("block-scalar-terminal-spaces.yml");
    assert!(file.source.ends_with("  "));
    let (path, _) = first_scalar_of_style(&file.source, ScalarStyle::Plain);
    let patched = apply_scalar_edit(&file.source, &path, "changed").expect("the edit applies");
    assert!(patched.text().ends_with("  "));
}

// ---------------------------------------------------------------------------
// The scope items, each with its own test
// ---------------------------------------------------------------------------

#[test]
fn a_batch_of_edits_in_one_document_is_applied_highest_offset_first() {
    // Requested in ascending order, which is the order that breaks if the spans
    // are applied as they arrive: the first replacement changes the length of
    // everything after it.
    let file = fixture("scalar-styles.yml");
    let index = SyntaxIndex::parse(&file.source).expect("the fixture parses");
    let trivia = TriviaIndex::scan(&file.source, &index);

    let mut edits = Vec::new();
    let mut spans = Vec::new();
    for node in index.nodes() {
        if node.is_zero_width() || node.scalar.is_none() {
            continue;
        }
        if !trivia.is_safely_editable(&index, node.id) {
            continue;
        }
        let Ok(path) = path_to(&index, node.id) else {
            continue;
        };
        if apply_scalar_edit(&file.source, &path, "batched").is_err() {
            continue;
        }
        spans.push(node.span);
        edits.push(ScalarEdit::new(path, "batched"));
        if edits.len() == 6 {
            break;
        }
    } // End of the loop that collects a batch of editable scalars
    assert_eq!(
        edits.len(),
        6,
        "the fixture must offer six editable scalars"
    );
    assert!(
        spans.windows(2).all(|pair| pair[0].start < pair[1].start),
        "the batch is requested in ascending order on purpose"
    );

    let patched = apply_scalar_edits(&file.source, &edits).expect("the batch applies");
    let index = SyntaxIndex::parse(patched.text()).expect("the candidate parses");
    for edit in &edits {
        let id = resolve(&index, edit.path()).expect("every edited path resolves");
        assert_eq!(
            index.node(id).unwrap().scalar.as_ref().unwrap().value,
            "batched"
        );
    }
    assert!(
        patched
            .replacements()
            .windows(2)
            .all(|pair| pair[0].span.end <= pair[1].span.start),
        "the replacements must be disjoint and ordered"
    );
} // End of function a_batch_of_edits_in_one_document_is_applied_highest_offset_first()

#[test]
fn the_hazard_gate_refuses_by_scope_and_not_by_file() {
    // Scope item 2, at corpus scale, and a correction to `PROGRESS.md` R12,
    // which says refusal is "**total** for anchors, aliases, tags, merge keys,
    // duplicate keys and multi-document streams … a real file that uses any of
    // them is entirely non-editable". It is not: `is_safely_editable` refuses
    // the flagged node, its ancestors and its descendants, so a **sibling**
    // entry stays editable. `anchors-aliases-tags-merge.yml` proves it — its
    // `matches[2].trigger` is editable although the tag hazard sits on the
    // `replace` beside it.
    //
    // Only a hazard on a document node reaches everything, which is why the
    // multi-document stream really is total.
    let partial: [(&str, usize, usize); 2] = [
        // file, addressable scalars refused, addressable scalars applied
        ("anchors-aliases-tags-merge.yml", 12, 5),
        ("duplicate-keys.yml", 2, 8),
    ];
    for (name, expected_refused, expected_applied) in partial {
        let file = fixture(name);
        let index = SyntaxIndex::parse(&file.source).expect("the fixture parses");
        let mut refused = 0;
        let mut applied = 0;
        for node in index.nodes() {
            if node.scalar.is_none() || node.is_zero_width() {
                continue;
            }
            let Ok(path) = path_to(&index, node.id) else {
                continue;
            };
            match apply_scalar_edit(&file.source, &path, "changed") {
                Ok(_) => applied += 1,
                Err(EditError::Refused { .. }) => refused += 1,
                Err(other) => panic!("{name}: node {} gave {other}", node.id.get()),
            }
        } // End of the loop over the fixture's addressable scalars
        assert_eq!(refused, expected_refused, "{name}: refusals");
        assert_eq!(applied, expected_applied, "{name}: edits applied");
    } // End of the loop over the partially refused fixtures

    // A multi-document stream is the one family that really is total: every
    // document node raises the hazard and every node has one above it.
    let file = fixture("multi-document.yml");
    let index = SyntaxIndex::parse(&file.source).expect("the fixture parses");
    let mut attempted = 0;
    for node in index.nodes() {
        if node.scalar.is_none() || node.is_zero_width() {
            continue;
        }
        let Ok(path) = path_to(&index, node.id) else {
            continue;
        };
        attempted += 1;
        assert!(
            matches!(
                apply_scalar_edit(&file.source, &path, "changed"),
                Err(EditError::Refused {
                    hazard: espansoconfig_core::syntax::HazardKind::MultiDocumentStream,
                    ..
                })
            ),
            "multi-document.yml: node {} must be refused",
            node.id.get()
        );
    } // End of the loop over the multi-document fixture's scalars
    assert!(attempted > 0, "nothing was attempted");
} // End of function the_hazard_gate_refuses_by_scope_and_not_by_file()

#[test]
fn a_flow_interior_edit_is_flow_legal_in_both_directions() {
    // Scope item 3, the R17 decision: flow-interior edits are **not** refused,
    // and flow legality is guaranteed by rendering rather than by the gate. A
    // multi-line value inside a flow collection becomes a double-quoted
    // one-liner; the same value in block context becomes a literal block.
    let file = fixture("flow-collections.yml");
    let index = SyntaxIndex::parse(&file.source).expect("the fixture parses");
    let trivia = TriviaIndex::scan(&file.source, &index);

    let mut flow_edits = 0;
    for node in index.nodes() {
        let Some(scalar) = node.scalar.as_ref() else {
            continue;
        };
        if node.is_zero_width() {
            continue;
        }
        // Only the scalars inside a bracketed collection, and only the ones the
        // gate allows — `flow-collections.yml` also holds the one collection
        // that carries a comment, which is refused (D2d).
        let inside_flow = {
            let mut current = node.parent.and_then(|parent| index.node(parent));
            let mut found = false;
            while let Some(ancestor) = current {
                if ancestor.collection_style
                    == Some(espansoconfig_core::syntax::CollectionStyle::Flow)
                {
                    found = true;
                    break;
                }
                current = ancestor.parent.and_then(|parent| index.node(parent));
            }
            found
        };
        if !inside_flow || !trivia.is_safely_editable(&index, node.id) {
            continue;
        }
        let Ok(path) = path_to(&index, node.id) else {
            continue;
        };

        let patched = apply_scalar_edit(&file.source, &path, "one\ntwo\n")
            .expect("a flow-interior edit is not refused");
        let candidate = SyntaxIndex::parse(patched.text()).expect("the candidate parses");
        let id = resolve(&candidate, &path).expect("the path survives");
        let edited = candidate.node(id).unwrap().scalar.as_ref().unwrap();
        assert_eq!(edited.value, "one\ntwo\n");
        assert_eq!(
            edited.presentation.style,
            ScalarStyle::DoubleQuoted,
            "only double quotes can carry a multi-line value in flow context"
        );
        assert!(
            !edited.presentation.style.is_block(),
            "a block scalar is illegal inside a flow collection"
        );
        // The scalar occupies one physical line, so the collection's own layout
        // is untouched.
        assert!(!scalar.presentation.style.is_block());
        assert_eq!(
            edited
                .presentation
                .content_span
                .slice(patched.text())
                .unwrap()
                .matches('\n')
                .count(),
            0
        );
        flow_edits += 1;
    } // End of the loop over the fixture's flow-interior scalars
    assert_eq!(
        flow_edits, 11,
        "the flow fixture's editable interior scalar count is pinned"
    );

    // And the same value in block context is a literal block, so the flow rule
    // is a *context* rule rather than a blanket refusal of multi-line values.
    let block = "matches:\n  - replace: old\n";
    let patched = apply_scalar_edit(
        block,
        &DocumentPath::parse("matches[0].replace").unwrap(),
        "one\ntwo\n",
    )
    .expect("applies");
    assert_eq!(
        patched.text(),
        "matches:\n  - replace: |\n      one\n      two\n"
    );
} // End of function a_flow_interior_edit_is_flow_legal_in_both_directions()

#[test]
fn a_verification_failure_yields_no_document_at_all() {
    // Scope item 4. The failure cannot be provoked through the entry point,
    // which by construction produces candidates that verify, so what is asserted
    // here is the type-level guarantee that goes with it: `PatchedDocument` has
    // no public constructor, so the only way to hold candidate bytes is to have
    // been handed them *after* verification. The verifier's own branches are
    // driven directly by the unit tests in `src/patch/edit.rs`.
    //
    // What is checkable from outside is that a refused edit produces no text at
    // all, for every refusal family that survives the Phase 0c-2b review's
    // finding 2. The two families that used to be probed here — a comment on a
    // block header, and a multi-line value on an occupied line — are **not**
    // refusals any more, and the two assertions that said they were have moved
    // rather than been dropped: `the_two_refusals_the_review_removed_now_apply`
    // below asserts the answer each one produces instead.
    let refusals: [(&str, &str, &str); 4] = [
        // The hazard gate: an anchor definition.
        ("base: &a\n  k: v\nuse: *a\n", "base.k", "changed"),
        // A zero-width scalar, which owns no bytes to replace.
        ("empty:\nnext: 1\n", "empty", "changed"),
        // Keep chomping cannot leave a trailing break as trivia, so a value with
        // fewer trailing newlines than the file holds is unrepresentable.
        ("k: |-\n  a\n\n\nnext: 1\n", "k", "a\n\n"),
        // A collection cannot be given a scalar value by a span replacement.
        ("matches:\n  - trigger: :hi\n", "matches", "changed"),
    ];
    for (source, path, value) in refusals {
        let path = DocumentPath::parse(path).expect("the probe path parses");
        let outcome = apply_scalar_edit(source, &path, value);
        assert!(
            outcome.is_err(),
            "{path} must be refused, not silently applied"
        );
        // The source is untouched: a refusal returns an error, never bytes.
        assert!(SyntaxIndex::parse(source).is_ok());
    } // End of the loop over one refusal of each family
} // End of function a_verification_failure_yields_no_document_at_all()

#[test]
fn the_two_refusals_the_review_removed_now_apply() {
    // The Phase 0c-2b review's finding 2, at the acceptance level: both refusals
    // it called unnecessary have a lossless answer, and both now produce it. The
    // `EditError` variants that used to be returned here — `CommentOnBlockHeader`
    // and `LineNotFreeForBlockScalar` — no longer exist, because after the split
    // replacement and the flow fallback nothing can reach them.
    let cases: [(&str, &str, &str, &str); 4] = [
        // A comment on a block header survives a block-to-flow change.
        (
            "k: | # why\n  body\nnext: 1\n",
            "k",
            "",
            "k: '' # why\nnext: 1\n",
        ),
        // So do trailing spaces after the indicator.
        ("k: |   \n  body\nnext: 1\n", "k", "", "k: ''   \nnext: 1\n"),
        // A CRLF header line keeps its CRLF even when the body it introduces is
        // written with bare line feeds.
        ("k: |\r\n  body\nnext: 1\n", "k", "", "k: ''\r\nnext: 1\n"),
        // A multi-line value on a line that already carries a comment becomes a
        // double-quoted flow scalar rather than a refusal.
        (
            "k: old # why\n",
            "k",
            "one\ntwo\n",
            "k: \"one\\ntwo\\n\" # why\n",
        ),
    ];
    for (source, path, value, expected) in cases {
        let path = DocumentPath::parse(path).expect("the probe path parses");
        let patched = apply_scalar_edit(source, &path, value)
            .unwrap_or_else(|error| panic!("{source:?} -> {value:?} must apply: {error}"));
        assert_eq!(patched.text(), expected, "{source:?} -> {value:?}");
    } // End of the loop over the review's four counterexamples
} // End of function the_two_refusals_the_review_removed_now_apply()
