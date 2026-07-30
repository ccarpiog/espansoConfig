//! Phase 0c-3a acceptance: inserting and removing a mapping field.
//!
//! The same shape as `tests/patch_edit.rs`, one level up. For **every mapping**
//! of all 26 synthetic fixtures and of the real corpus, every entry is offered
//! for removal and a new entry is offered for insertion at several positions —
//! including after a sibling the mapping does not have — and each attempt must
//! end in one of exactly two ways:
//!
//! - a **typed refusal whose reason this file re-derives from the document
//!   itself**, by walking the tree and reading the source text rather than by
//!   asking the production gate. An engine that refused everything would satisfy
//!   "no edit ever corrupted a file" while being useless, and only an
//!   independent derivation of each reason catches that;
//! - a **successful edit satisfying every verification property**, all of them
//!   re-checked here rather than trusted: the candidate is the source with the
//!   reported replacements applied, every replacement lies inside an envelope
//!   this file derives independently, the candidate parses, the field is present
//!   or absent as asked, and **every sibling entry still decodes to exactly the
//!   value it had before**, nested collections included.
//!
//! Synthetic counts are pinned **per fixture and per category**
//! ([`SYNTHETIC_OUTCOMES`]), so neither two opposing drifts inside one number
//! nor two fixtures exchanging eligibility can pass unnoticed. No count taken
//! from the real corpus is hard-coded.
//!
//! # The envelope is not the planner's opinion
//!
//! The Phase 0c-2b review's finding 3, carried into structural edits: an
//! acceptance test that measures a removal against an envelope built by the same
//! `subtree_extent` call the planner used authorises whatever the planner
//! decided. So [`check_removal_envelope`] states the rule from **properties**
//! instead — whole lines, containing both halves of the entry, touching no node
//! outside it — none of which is a restatement of how the envelope was built.
//!
//! # …and neither are the bytes the file owns
//!
//! Those four properties are all about **nodes**, and that is how the Phase
//! 0c-3a review's finding 1 walked past this file: a removal envelope deleted a
//! comment the ownership rules give to the *file*, and nothing here could see it.
//! Every applied removal is now also required to leave every file-owned comment
//! of the original in the candidate ([`lost_file_comment`]), with the candidate's
//! comments found by [`comment_texts`] — a scan written here, sharing no code
//! with the production check it must be able to contradict.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! This file prints file names, counts and byte offsets only. It never prints a
//! scalar, a key, a path or a byte of real content, and every real-corpus test
//! skips cleanly when the directory is absent.

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::patch::{
    apply_edits, insert_field, path_to, remove_field, DocumentEdit, DocumentPath, EditError,
    FieldInsert, PatchedDocument,
};
use espansoconfig_core::syntax::{CollectionStyle, Hazard, HazardKind, NodeKind, TriviaIndex};
use espansoconfig_core::{ByteSpan, NodeId, SyntaxIndex};

/// The values every insertion is asked to write.
///
/// Chosen to reach every branch of the emitter through a path that has never
/// carried a value before: a plain-safe word, the empty string, a YAML 1.1
/// boolean spelling, a multi-line value that must become a `|` block indented
/// from its own entry, an apostrophe, and non-ASCII including an astral
/// character.
const INSERT_VALUES: [&str; 6] = ["plain", "", "no", "one\ntwo\n", "Don't", "día ⌘😀"];

/// The key every insertion writes. Deliberately one no fixture contains, so a
/// `KeyAlreadyPresent` refusal is never an accident of the corpus.
const INSERT_KEY: &str = "phase0c3aInserted";

/// The sibling every mapping is asked to insert after, and none of them has.
///
/// `EditError::NoSuchSibling` existed in the engine from the start of the phase
/// and was attempted by no test, which the Phase 0c-3a review's finding 5 named:
/// a refusal nothing exercises is a refusal nothing knows the shape of.
const MISSING_SIBLING: &str = "phase0c3aNoSuchSibling";

/// How many of the six values each real-corpus mapping is given.
///
/// `TriviaIndex::scan` is quadratic in (trivia items × nodes) — `PROGRESS.md`
/// R19 — and the safe entry point re-scans on every call by design, so the full
/// cross product over the real files costs minutes on the one machine that has
/// them. Two of the six values per mapping, rotated by node index, keeps every
/// value exercised across the corpus. The synthetic sweep, which everyone runs,
/// keeps the full cross product.
const REAL_CORPUS_STRIDE: usize = 3;

/// How every attempted structural edit of one corpus ended.
///
/// The categories are exhaustive over the outcomes an addressable mapping can
/// produce: [`audit`] panics on anything else, so a new refusal family cannot
/// slip in as "some other error".
#[derive(Debug, Default, PartialEq, Eq)]
struct Tally {
    /// Insertions that applied and satisfied every verification property.
    inserted: usize,
    /// Removals that applied and satisfied every verification property.
    removed: usize,
    /// Edits the hazard gate refused, consulted on the **mapping**.
    refused_by_the_gate: usize,
    /// Edits refused because the mapping is, or is inside, a flow collection.
    flow: usize,
    /// Removals refused because they would empty the mapping.
    last_entry: usize,
    /// Edits refused because the entry shares its line with something else.
    shares_a_line: usize,
    /// Insertions refused because the mapping already holds that key.
    key_present: usize,
    /// Removals refused because a keep-chomped block above would grow.
    kept_block: usize,
    /// Removals refused because the envelope crosses a file-owned comment.
    ///
    /// The Phase 0c-3a review's finding 1. Added with the refusal itself: a
    /// category that exists in the engine and not in this table is a category
    /// nothing measures.
    file_comment: usize,
    /// Insertions refused because `FieldInsert::after` named no entry.
    ///
    /// Absent from this table until the review's fix round, although the engine
    /// has had the refusal since the phase began — which is why the sweep never
    /// attempted it.
    no_such_sibling: usize,
    /// Insertions refused because the mapping's keys disagree on a column.
    ///
    /// **Pinned at zero, and unreachable rather than merely unreached.** A block
    /// mapping's keys must all begin at one column or the document does not
    /// parse; the two shapes that *can* disagree — a flow mapping written across
    /// lines, and an explicit `? key` mapping — are refused earlier, by
    /// `FlowCollection` and by the `ExplicitKeyMapping` hazard. So no fixture
    /// can be written that reaches this branch, and the zero is a fact about
    /// YAML rather than a coverage hole. See `docs/decisions/0c-3a-notes.md`.
    inconsistent_indent: usize,
    /// Insertions refused because no line break could be copied.
    ///
    /// The Phase 0c-3a review's finding 2, reached by
    /// `single-line-no-line-ending.yml` — the one document in the corpus that
    /// offers an insertion no line ending to learn from.
    no_line_ending: usize,
}

/// How many categories a [`Tally`] has. Every pinned row states all of them.
const CATEGORIES: usize = 12;

impl Tally {
    /// Builds a tally from a pinned row's numbers, in declaration order.
    fn from_row(row: [usize; CATEGORIES]) -> Tally {
        Tally {
            inserted: row[0],
            removed: row[1],
            refused_by_the_gate: row[2],
            flow: row[3],
            last_entry: row[4],
            shares_a_line: row[5],
            key_present: row[6],
            kept_block: row[7],
            file_comment: row[8],
            no_such_sibling: row[9],
            inconsistent_indent: row[10],
            no_line_ending: row[11],
        }
    } // End of function from_row()

    /// Every attempt this tally accounts for.
    fn total(&self) -> usize {
        self.inserted
            + self.removed
            + self.refused_by_the_gate
            + self.flow
            + self.last_entry
            + self.shares_a_line
            + self.key_present
            + self.kept_block
            + self.file_comment
            + self.no_such_sibling
            + self.inconsistent_indent
            + self.no_line_ending
    } // End of function total()

    /// Folds another file's tally into this one.
    fn add(&mut self, other: &Tally) {
        self.inserted += other.inserted;
        self.removed += other.removed;
        self.refused_by_the_gate += other.refused_by_the_gate;
        self.flow += other.flow;
        self.last_entry += other.last_entry;
        self.shares_a_line += other.shares_a_line;
        self.key_present += other.key_present;
        self.kept_block += other.kept_block;
        self.file_comment += other.file_comment;
        self.no_such_sibling += other.no_such_sibling;
        self.inconsistent_indent += other.inconsistent_indent;
        self.no_line_ending += other.no_line_ending;
    } // End of function add()
} // End of impl Tally

/// One fixture's pinned outcome row: its file name and its twelve [`Tally`]
/// fields, in declaration order — inserted, removed, gate, flow, last-entry,
/// shares-a-line, duplicate-key, kept-block, file-comment, no-such-sibling,
/// inconsistent-indentation, no-line-ending.
type OutcomeRow = (&'static str, [usize; CATEGORIES]);

/// Every synthetic fixture's complete outcome split, pinned exactly.
///
/// A complete row per fixture rather than one corpus-wide tally per category:
/// the latter cannot tell two fixtures that exchanged eligibility from two that
/// did not (the Phase 0c-2b review's finding 4). The list is also asserted to
/// cover the corpus exactly, so a new fixture has to be given a row rather than
/// disappearing into a total.
///
/// Retabulated by the Phase 0c-3a review's fix round, deliberately and for three
/// separate reasons: the sweep now attempts one **missing-sibling** insertion per
/// mapping, so every row's total grows; a removal whose envelope crosses a
/// file-owned comment is now refused rather than applied; and two fixtures
/// joined the corpus.
const SYNTHETIC_OUTCOMES: [OutcomeRow; 26] = [
    (
        "anchors-aliases-tags-merge.yml",
        [0, 0, 132, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    ("blank-lines.yml", [40, 5, 0, 0, 1, 4, 5, 0, 0, 5, 0, 0]),
    (
        "block-scalar-header-tails.yml",
        [31, 3, 0, 0, 1, 3, 4, 0, 0, 4, 0, 0],
    ),
    (
        "block-scalar-leading-blank-lines.yml",
        [52, 9, 0, 0, 1, 5, 6, 1, 0, 6, 0, 0],
    ),
    (
        "block-scalar-terminal-spaces.yml",
        [24, 3, 0, 0, 1, 2, 3, 0, 0, 3, 0, 0],
    ),
    (
        "block-scalars.yml",
        [106, 19, 0, 0, 1, 11, 12, 3, 0, 12, 0, 0],
    ),
    ("bom-utf8.yml", [23, 2, 0, 0, 1, 2, 3, 0, 0, 3, 0, 0]),
    (
        "comments-everywhere.yml",
        [32, 4, 0, 0, 1, 3, 4, 0, 0, 4, 0, 0],
    ),
    ("config-profile.yml", [19, 13, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
    (
        "crlf-line-endings.yml",
        [31, 3, 0, 0, 1, 3, 4, 0, 0, 4, 0, 0],
    ),
    ("duplicate-keys.yml", [41, 6, 34, 0, 2, 3, 5, 0, 0, 5, 0, 0]),
    (
        "empty-entries-and-extents.yml",
        [52, 11, 0, 0, 0, 5, 6, 0, 0, 6, 0, 0],
    ),
    // The fixture the review's fix round added for finding 1. Its one
    // file-comment refusal is the `vars` entry whose value holds a comment the
    // ownership rules give to the file; before the fix that removal *applied*,
    // and deleted the comment.
    (
        "file-comments-and-mixed-endings.yml",
        [41, 6, 0, 0, 1, 3, 5, 0, 1, 5, 0, 0],
    ),
    (
        "flow-collections.yml",
        [36, 8, 24, 24, 0, 4, 4, 0, 0, 4, 0, 0],
    ),
    (
        "folded-more-indented.yml",
        [43, 7, 0, 0, 1, 4, 5, 1, 0, 5, 0, 0],
    ),
    (
        "form-layout-and-choice.yml",
        [156, 30, 0, 0, 4, 8, 19, 0, 0, 19, 0, 0],
    ),
    (
        "html-and-markdown.yml",
        [48, 6, 0, 0, 1, 5, 6, 0, 0, 6, 0, 0],
    ),
    (
        "imports-and-global-vars.yml",
        [87, 19, 0, 0, 1, 7, 10, 0, 0, 10, 0, 0],
    ),
    ("multi-document.yml", [0, 0, 66, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    (
        "no-trailing-newline.yml",
        [15, 1, 0, 0, 1, 1, 2, 0, 0, 2, 0, 0],
    ),
    ("non-ascii.yml", [72, 9, 0, 0, 2, 7, 9, 0, 0, 9, 0, 0]),
    (
        "plain-scalar-hazards.yml",
        [303, 37, 0, 0, 1, 37, 38, 0, 0, 38, 0, 0],
    ),
    (
        "scalar-styles.yml",
        [95, 11, 0, 0, 1, 11, 12, 0, 0, 12, 0, 0],
    ),
    // The fixture the review's fix round added for finding 2, and the only
    // source of `NoObservableLineEnding` in the sweep: 6 appended values plus 1
    // insertion after its single entry, all refused because the document holds
    // no line break to copy. Its duplicate-key and missing-sibling attempts are
    // refused earlier, and its one entry cannot be removed.
    (
        "single-line-no-line-ending.yml",
        [0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 7],
    ),
    ("unicode-offsets.yml", [8, 2, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
    (
        "variable-chain.yml",
        [148, 34, 0, 0, 4, 8, 17, 0, 0, 17, 0, 0],
    ),
];

// ---------------------------------------------------------------------------
// Independent re-derivations — none of these calls the production policy
// ---------------------------------------------------------------------------

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
    let mut ancestors = vec![node];
    let mut current = index.node(node).and_then(|here| here.parent);
    while let Some(id) = current {
        ancestors.push(id);
        current = index.node(id).and_then(|here| here.parent);
    } // End of the walk that collects the node's ancestors

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

/// Whether `node` is, or is inside, a bracket-delimited collection.
fn inside_flow(index: &SyntaxIndex, node: NodeId) -> bool {
    let mut current = index.node(node);
    while let Some(here) = current {
        if here.collection_style == Some(CollectionStyle::Flow) {
            return true;
        }
        current = here.parent.and_then(|parent| index.node(parent));
    }
    false
} // End of function inside_flow()

/// Whether `offset` begins its physical line, ignoring indentation.
///
/// The independent statement of `EditError::EntryDoesNotOwnItsLines`: an entry
/// owns its lines exactly when nothing but spaces and tabs stands between the
/// start of its line and its own first byte. The reachable failure is the first
/// entry of a compact `- key: value` item, whose line begins with the `-`.
fn begins_its_line(source: &str, offset: usize, body_offset: usize) -> bool {
    let line_start = source[..offset]
        .rfind(['\n', '\r'])
        .map_or(body_offset, |at| at + 1)
        .max(body_offset);
    source[line_start..offset]
        .chars()
        .all(|character| character == ' ' || character == '\t')
} // End of function begins_its_line()

/// A canonical rendering of everything a node's subtree decodes to.
///
/// Written independently of the engine's own digest, over the substrate's
/// decoded values, so that "every sibling still decodes to what it decoded to
/// before" is checked by something other than the code that claims it. Never
/// printed: it holds decoded values, and the real corpus is private.
fn shape(index: &SyntaxIndex, node: NodeId) -> String {
    let Some(here) = index.node(node) else {
        return "?".to_owned();
    };
    match here.kind {
        NodeKind::Scalar => match here.scalar.as_ref() {
            Some(scalar) => format!("<{}|{}>", scalar.value.len(), scalar.value),
            None => "?".to_owned(),
        },
        NodeKind::Alias => format!("alias{}", here.span.len()),
        NodeKind::Mapping | NodeKind::Sequence => {
            let inner: Vec<String> = here
                .children
                .iter()
                .map(|child| shape(index, *child))
                .collect();
            if here.kind == NodeKind::Mapping {
                format!("map({})", inner.join("|"))
            } else {
                format!("seq({})", inner.join("|"))
            }
        }
        NodeKind::Document => "doc".to_owned(),
    }
} // End of function shape()

/// Every entry of a mapping, as (decoded key, subtree shape), in source order.
fn entry_shapes(index: &SyntaxIndex, mapping: NodeId) -> Vec<(String, String)> {
    let Some(node) = index.node(mapping) else {
        return Vec::new();
    };
    node.children
        .chunks(2)
        .filter_map(|pair| match (pair.first(), pair.get(1)) {
            (Some(&key), Some(&value)) => Some((
                index
                    .node(key)
                    .and_then(|key| key.scalar.as_ref())
                    .map(|scalar| scalar.value.clone())
                    .unwrap_or_default(),
                shape(index, value),
            )),
            _ => None,
        })
        .collect()
} // End of function entry_shapes()

/// Checks that the candidate is the source with exactly these replacements.
///
/// Re-derived from `PatchedDocument::replacements()` rather than trusted, so an
/// off-by-one in the splice shows up here as well as in the engine's own
/// verifier.
fn check_candidate_is_the_splice(label: &str, source: &str, patched: &PatchedDocument) {
    let mut rebuilt = String::with_capacity(patched.text().len());
    let mut cursor = 0usize;
    for replacement in patched.replacements() {
        assert!(
            replacement.span.start >= cursor,
            "{label}: replacements are not in ascending order"
        );
        rebuilt.push_str(&source[cursor..replacement.span.start]);
        rebuilt.push_str(&replacement.text);
        cursor = replacement.span.end;
    } // End of the loop that rebuilds the candidate from the replacement list
    rebuilt.push_str(&source[cursor..]);
    assert!(
        rebuilt == patched.text(),
        "{label}: the candidate is not the source with the replacements applied"
    );
} // End of function check_candidate_is_the_splice()

/// Checks a removal envelope by its **properties**, not by how it was built.
///
/// Four of them, and none is a restatement of `subtree_extent`:
///
/// 1. it starts at the beginning of a line and ends at the beginning of one, or
///    at end of file — a removal deletes whole lines;
/// 2. it covers the entry's key and its value entirely;
/// 3. it covers no node that is neither part of the entry nor an ancestor of
///    it — an envelope one entry too long fails here, and nowhere else;
/// 4. it stays clear of the BOM.
fn check_removal_envelope(
    label: &str,
    source: &str,
    index: &SyntaxIndex,
    span: ByteSpan,
    key: NodeId,
    value: NodeId,
) {
    let body_offset = index.preamble().body_offset;
    assert!(
        span.start >= body_offset,
        "{label}: the envelope reaches into the BOM"
    );
    assert!(
        begins_its_line(source, span.start, body_offset)
            && span.start == line_start(source, span.start, body_offset),
        "{label}: the envelope does not start a line"
    );
    assert!(
        span.end == source.len() || line_start(source, span.end, body_offset) == span.end,
        "{label}: the envelope does not end a line"
    );
    for node in [key, value] {
        let owned = index.node(node).expect("a node of the entry").span;
        assert!(
            span.contains(owned),
            "{label}: the envelope does not cover the entry's own bytes"
        );
    } // End of the loop over the entry's two halves

    let mut inside = vec![key, value];
    let mut pending = vec![key, value];
    while let Some(id) = pending.pop() {
        if let Some(node) = index.node(id) {
            for child in &node.children {
                inside.push(*child);
                pending.push(*child);
            }
        }
    } // End of the walk over the entry's own subtree
    let mut ancestors = Vec::new();
    let mut current = index.node(key).and_then(|node| node.parent);
    while let Some(id) = current {
        ancestors.push(id);
        current = index.node(id).and_then(|node| node.parent);
    } // End of the walk over the entry's ancestors

    for node in index.nodes() {
        if node.span.is_empty()
            || inside.contains(&node.id)
            || ancestors.contains(&node.id)
            || node.span.end <= span.start
            || node.span.start >= span.end
        {
            continue;
        }
        panic!(
            "{label}: the envelope {}..{} reaches into node {}",
            span.start,
            span.end,
            node.id.get()
        );
    } // End of the loop over every node the envelope might disturb
} // End of function check_removal_envelope()

/// Re-derives whether a keep-chomped block above this entry would grow.
///
/// Independent of the engine's own test: it works from the entry's **own line
/// range** ([`entry_lines`], found textually) rather than from the envelope the
/// planner built. A `|+` block's value is every break physically after its last
/// content line, so removing the lines that terminate one hands it the blank
/// line below.
///
/// `lines` is passed in rather than recomputed. It used to be derived a second
/// time here, with a walk that consumed one line more than [`entry_lines`] does
/// for a block-scalar value — two answers to one question, where nothing forced
/// them to agree.
fn kept_block_above(source: &str, index: &SyntaxIndex, lines: ByteSpan) -> bool {
    let start = lines.start;
    let after = &source[lines.end..];
    if after.is_empty() {
        return false;
    }
    let next_line = after.find(['\n', '\r']).unwrap_or(after.len());
    if !after[..next_line]
        .chars()
        .all(|character| character == ' ' || character == '\t')
    {
        return false;
    }
    index.nodes().iter().any(|node| {
        node.scalar.as_ref().is_some_and(|scalar| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                && presentation.chomping == espansoconfig_core::Chomping::Keep
                && presentation.content_span.end <= start
                && source[presentation.content_span.end..start]
                    .trim()
                    .is_empty()
        })
    })
} // End of function kept_block_above()

/// The whole lines one mapping entry occupies, found textually.
///
/// From the start of the key's line to the start of the line after the entry's
/// last. Derived from the two node spans and the source text, so it owes nothing
/// to the envelope the planner built — which is what lets it be used to justify
/// a refusal about that envelope.
fn entry_lines(
    source: &str,
    index: &SyntaxIndex,
    key: NodeId,
    value: NodeId,
    body_offset: usize,
) -> ByteSpan {
    let key_span = index.node(key).expect("a key").span;
    let value_span = index.node(value).expect("a value").span;
    let start = line_start(source, key_span.start, body_offset);
    let mut end = key_span.end.max(value_span.end);
    // A block-scalar value already ends past its own final break (D2c), so the
    // entry's lines are complete and there is nothing to walk.
    if !source[..end].ends_with(['\n', '\r']) {
        end = match source[end..].find(['\n', '\r']) {
            None => source.len(),
            Some(offset) => {
                let at = end + offset;
                at + if source[at..].starts_with("\r\n") {
                    2
                } else {
                    1
                }
            }
        };
    }
    ByteSpan::new(start, end)
} // End of function entry_lines()

/// A comment the **file** owns that sits inside the entry's own lines.
///
/// The independent statement of `EditError::RemovalWouldDeleteAFileComment`:
/// ownership comes from the trivia index, which is the document's own answer,
/// and the byte range comes from [`entry_lines`], which is this file's.
fn file_comment_in_entry(trivia: &TriviaIndex, lines: ByteSpan) -> Option<ByteSpan> {
    trivia
        .file_comments()
        .map(|comment| comment.span)
        .find(|comment| comment.intersects(lines))
} // End of function file_comment_in_entry()

/// The offset at which `position`'s physical line begins.
fn line_start(source: &str, position: usize, body_offset: usize) -> usize {
    source[..position]
        .rfind(['\n', '\r'])
        .map_or(body_offset, |at| at + 1)
        .max(body_offset)
}

/// Checks an insertion point by its properties.
///
/// Zero width, at the beginning of a line or at end of file, and never strictly
/// inside a frontier leaf — a point inside a token would splice into the middle
/// of a scalar rather than between two lines.
fn check_insertion_point(label: &str, source: &str, index: &SyntaxIndex, span: ByteSpan) {
    assert!(span.is_empty(), "{label}: an insertion replaces no bytes");
    let body_offset = index.preamble().body_offset;
    assert!(
        span.start == source.len() || line_start(source, span.start, body_offset) == span.start,
        "{label}: the insertion point does not begin a line"
    );
    for node in index.nodes() {
        assert!(
            !(node.is_frontier_leaf()
                && node.span.start < span.start
                && span.start < node.span.end),
            "{label}: the insertion point falls inside node {}",
            node.id.get()
        );
    } // End of the loop over the frontier leaves
} // End of function check_insertion_point()

/// Every comment of `source`, found **without asking the trivia scanner**.
///
/// A `#` is a comment when it opens a line or follows white space and does not
/// lie inside a frontier leaf — the only place a `#` can be data rather than a
/// comment is inside a scalar's own token, and the syntax index says where those
/// are. Deliberately re-derived here rather than taken from `TriviaIndex`: the
/// candidate side of the file-comment oracle must not share an implementation
/// with the production check it is meant to be able to contradict.
fn comment_texts(source: &str) -> Vec<&str> {
    // A document with no `#` in it has no comments, and answering that costs a
    // memchr rather than a parse. Worth the line: this runs once per applied
    // removal in a sweep whose cost is already dominated by parsing (R19).
    if !source.contains('#') {
        return Vec::new();
    }
    let Ok(index) = SyntaxIndex::parse(source) else {
        return Vec::new();
    };
    let leaves: Vec<ByteSpan> = index
        .nodes()
        .iter()
        .filter(|node| node.is_frontier_leaf())
        .map(|node| node.span)
        .collect();

    let mut found = Vec::new();
    let mut skip_to = 0usize;
    let mut previous: Option<char> = None;
    for (at, character) in source.char_indices() {
        // A BOM counts as "nothing before it": in `bom-utf8.yml` the file's first
        // comment opens at byte 3, immediately after it.
        if at >= skip_to
            && character == '#'
            && (previous.is_none()
                || matches!(previous, Some(' ' | '\t' | '\n' | '\r' | '\u{feff}')))
            && !leaves.iter().any(|leaf| leaf.start <= at && at < leaf.end)
        {
            let end = source[at..]
                .find(['\n', '\r'])
                .map_or(source.len(), |offset| at + offset);
            found.push(&source[at..end]);
            skip_to = end;
        }
        previous = Some(character);
    } // End of the scan for comment openers
    found
} // End of function comment_texts()

/// The offset of a file-owned comment the candidate lost, if there is one.
///
/// **The oracle finding 1 slipped past.** Every other check in this file is
/// about nodes: the entry went, the siblings decode to what they decoded to, the
/// envelope touches no node outside the entry. A comment the ownership rules
/// give to the *file* is none of those, so a removal envelope could delete one
/// and satisfy the lot — which is exactly what happened.
///
/// `owned` is the file's comments as the **original document's** ownership rules
/// assigned them, computed once per file by [`audit`]. What must hold is that
/// every one of them still appears in the candidate, as a comment, at least as
/// often. Comparing text rather than position is what allows an edit above a
/// comment to move it; comparing counts is what stops two identical comments
/// collapsing into one.
fn lost_file_comment(owned: &[(String, usize)], candidate: &str) -> Option<usize> {
    // Greedy consumption: each file-owned comment claims one match out of the
    // candidate's, and the first that finds none is the one that went. Counting
    // per distinct text instead would name the *first* occurrence of the missing
    // text rather than the missing occurrence, which is the harder thing to
    // localise when a real regression trips this.
    let mut survivors = comment_texts(candidate);
    for (text, at) in owned {
        match survivors.iter().position(|found| found == text) {
            Some(claimed) => {
                survivors.swap_remove(claimed);
            }
            None => return Some(*at),
        }
    } // End of the loop over the comments the file owns
    None
} // End of function lost_file_comment()

/// The line ending in use immediately before `at`, as its exact bytes.
fn line_ending_before(source: &str, at: usize) -> Option<&'static str> {
    let before = source.get(..at)?;
    let last = before.rfind(['\n', '\r'])?;
    if !before[last..].starts_with('\n') {
        return Some("\r");
    }
    if before[..last].ends_with('\r') {
        Some("\r\n")
    } else {
        Some("\n")
    }
} // End of function line_ending_before()

/// Checks that an insertion copied its line ending instead of inventing one.
///
/// Every line break the new bytes contain must be byte-identical to the one
/// already in use where they land. Derived from the source text here, so a
/// document whose *dominant* ending differs from its anchor's — which is exactly
/// what `file-comments-and-mixed-endings.yml` is — fails this rather than
/// passing quietly.
fn check_written_line_endings(label: &str, source: &str, span: ByteSpan, text: &str) {
    let expected = line_ending_before(source, span.start)
        .unwrap_or_else(|| panic!("{label}: an insertion happened with no break to copy"));
    let mut rest = text;
    while let Some(at) = rest.find(['\n', '\r']) {
        let found = if rest[at..].starts_with("\r\n") {
            "\r\n"
        } else {
            &rest[at..at + 1]
        };
        assert_eq!(
            found, expected,
            "{label}: the insertion wrote a line ending the anchor does not use"
        );
        rest = &rest[at + found.len()..];
    } // End of the walk over the breaks the insertion wrote
} // End of function check_written_line_endings()

/// Whether every key of the mapping begins at one column.
///
/// The independent statement of `EditError::InconsistentEntryIndentation`.
/// Columns are counted in characters from the start of the line, the BOM
/// excluded, exactly as an inserted entry's indentation would have to be.
fn key_columns_agree(
    source: &str,
    index: &SyntaxIndex,
    entries: &[(NodeId, NodeId)],
    body_offset: usize,
) -> bool {
    let column = |key: NodeId| {
        let at = index.node(key).expect("a key").span.start;
        source[line_start(source, at, body_offset)..at]
            .chars()
            .count()
    };
    let mut columns = entries.iter().map(|(key, _)| column(*key));
    match columns.next() {
        None => true,
        Some(first) => columns.all(|found| found == first),
    }
} // End of function key_columns_agree()

/// Facts about one attempted edit, every one derived from the document.
///
/// Not one of these asks the production code what it thinks; [`classify`] then
/// requires the refusal the engine reported to be justified by the matching
/// field. Collected into a struct rather than passed as eight booleans because
/// the review's finding 5 was, in part, that a positional argument list is where
/// a missing check hides: `KeyAlreadyPresent` was counted without anything
/// checking that the key really was present.
struct Derived {
    /// The hazard that disqualifies the mapping, re-derived from the tree.
    blocked: Option<HazardKind>,
    /// Whether the mapping is, or is inside, a bracket-delimited collection.
    flow: bool,
    /// Whether the mapping has fewer than two entries.
    last_entry: bool,
    /// Whether the entry in question begins its own line.
    owns_its_line: bool,
    /// Whether a keep-chomped block above the entry would grow.
    kept_block: bool,
    /// Whether the mapping already holds the key the insertion asks for.
    key_present: bool,
    /// Whether `FieldInsert::after` named an entry the mapping has.
    sibling_exists: bool,
    /// Whether every key of the mapping starts at one column.
    columns_agree: bool,
    /// Whether the document holds a line break an insertion could copy.
    has_a_line_ending: bool,
    /// A file-owned comment inside the entry's own lines, if there is one.
    file_comment: Option<ByteSpan>,
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/// Attempts every structural edit on every mapping of one file.
///
/// `stride` thins the value set exactly as `tests/patch_edit.rs` does, and for
/// the same measured reason (R19). Returns the tally; any outcome this function
/// cannot justify from the document panics, verification failures included — a
/// verification failure is a defect in the engine, not an expected answer.
fn audit(name: &str, source: &str, stride: usize) -> Tally {
    let index = SyntaxIndex::parse(source).expect("the caller checked this parses");
    let trivia = TriviaIndex::scan(source, &index);
    let body_offset = index.preamble().body_offset;
    let mut tally = Tally::default();

    // The document's own answer to "which comments does the file own", taken
    // once. Every applied removal is then required to leave all of them in
    // place — the check the review's finding 1 walked straight through.
    let owned_comments: Vec<(String, usize)> = trivia
        .file_comments()
        .filter_map(|comment| {
            comment
                .span
                .slice(source)
                .map(|text| (text.to_owned(), comment.span.start))
        })
        .collect();
    // An insertion needs a line break to copy, and refuses when the document
    // holds none it can write (`EditError::NoObservableLineEnding`).
    let has_a_line_ending = source.contains('\n');

    for mapping in index.nodes() {
        if mapping.kind != NodeKind::Mapping {
            continue;
        }
        let Ok(mapping_path) = path_to(&index, mapping.id) else {
            continue;
        };
        let entries: Vec<(NodeId, NodeId)> = mapping
            .children
            .chunks(2)
            .filter_map(|pair| match (pair.first(), pair.get(1)) {
                (Some(&key), Some(&value)) => Some((key, value)),
                _ => None,
            })
            .collect();
        if entries.is_empty() {
            continue;
        }

        // Independently derived facts about this mapping, none of which asks the
        // production code what it thinks.
        let blocked = hazard_that_blocks(&index, &trivia, mapping.id).map(|hazard| hazard.kind);
        let flow = inside_flow(&index, mapping.id);
        let before = entry_shapes(&index, mapping.id);
        let columns_agree = key_columns_agree(source, &index, &entries, body_offset);
        // One statement of "does this entry begin its own line", used by every
        // attempt below rather than spelled out at each of them.
        let owns_its_line = |key: NodeId| {
            begins_its_line(
                source,
                index.node(key).expect("a key").span.start,
                body_offset,
            )
        };
        let last = *entries.last().expect("checked non-empty");
        let keys: Vec<String> = entries
            .iter()
            .map(|(key, _)| {
                index
                    .node(*key)
                    .and_then(|key| key.scalar.as_ref())
                    .map(|scalar| scalar.value.clone())
                    .unwrap_or_default()
            })
            .collect();
        // Every attempt below starts from this and overrides only what its own
        // shape changes, so a fact can never be silently left out of one call.
        // The entry it is given is the one the attempt would work from — the
        // mapping's last for an append, the named one otherwise — so no field is
        // ever filled in with a value the document did not supply.
        let base = |entry_owns_its_line: bool| Derived {
            blocked,
            flow,
            last_entry: entries.len() < 2,
            owns_its_line: entry_owns_its_line,
            kept_block: false,
            key_present: false,
            sibling_exists: true,
            columns_agree,
            has_a_line_ending,
            file_comment: None,
        };

        // 1. Append a new entry, once per replacement value.
        for (choice, value) in INSERT_VALUES.iter().enumerate() {
            if choice % stride != mapping.id.get() % stride {
                continue;
            }
            let label = format!("{name} mapping {} insert {choice}", mapping.id.get());
            match insert_field(source, &mapping_path, INSERT_KEY, value) {
                Ok(patched) => {
                    assert!(
                        blocked.is_none() && !flow,
                        "{label}: applied although refused"
                    );
                    check_candidate_is_the_splice(&label, source, &patched);
                    assert_eq!(patched.replacements().len(), 1, "{label}: one replacement");
                    let written = &patched.replacements()[0];
                    check_insertion_point(&label, source, &index, written.span);
                    check_written_line_endings(&label, source, written.span, &written.text);
                    check_inserted(&label, &mapping_path, value, &before, &patched);
                    tally.inserted += 1;
                }
                Err(error) => classify(&label, &error, &base(owns_its_line(last.0)), &mut tally),
            }
        } // End of the loop over the insertion values

        // 2. Insert after each named sibling, so the position logic is swept and
        //    not only the append path.
        for ((key, _), sibling) in entries.iter().zip(&keys) {
            let label = format!("{name} mapping {} after {}", mapping.id.get(), key.get());
            let edit: DocumentEdit =
                FieldInsert::after(mapping_path.clone(), sibling.clone(), INSERT_KEY, "plain")
                    .into();
            match apply_edits(source, &[edit]) {
                Ok(patched) => {
                    assert!(
                        blocked.is_none() && !flow,
                        "{label}: applied although refused"
                    );
                    check_candidate_is_the_splice(&label, source, &patched);
                    let written = &patched.replacements()[0];
                    check_insertion_point(&label, source, &index, written.span);
                    check_written_line_endings(&label, source, written.span, &written.text);
                    check_inserted(&label, &mapping_path, "plain", &before, &patched);
                    tally.inserted += 1;
                }
                Err(error) => classify(&label, &error, &base(owns_its_line(*key)), &mut tally),
            }
        } // End of the loop over the mapping's entries, inserting after each

        // 3. One insertion of a key the mapping already has. The refusal is
        //    checked against a re-derived fact — that the key really is there —
        //    which the Phase 0c-3a review found this table counting without.
        //
        //    That derivation is true by construction *here*, because the key was
        //    taken from this mapping. It is not vacuous overall: attempts 1, 2
        //    and 4 pass a key no fixture contains and set `key_present: false`,
        //    so an engine that answered `KeyAlreadyPresent` for an absent key
        //    fails the same assertion in `classify`.
        if let Some(existing) = keys.first() {
            let label = format!("{name} mapping {} duplicate key", mapping.id.get());
            match insert_field(source, &mapping_path, existing, "plain") {
                Ok(_) => panic!("{label}: a duplicate key must never be inserted"),
                Err(error) => classify(
                    &label,
                    &error,
                    &Derived {
                        key_present: keys.iter().any(|key| key == existing),
                        ..base(owns_its_line(last.0))
                    },
                    &mut tally,
                ),
            }
        }

        // 4. One insertion after a sibling the mapping does not have. Added by
        //    the review's fix round: `NoSuchSibling` existed in the engine and in
        //    no test, so nothing said whether it was reachable or correct.
        {
            let label = format!("{name} mapping {} missing sibling", mapping.id.get());
            let edit: DocumentEdit =
                FieldInsert::after(mapping_path.clone(), MISSING_SIBLING, INSERT_KEY, "plain")
                    .into();
            match apply_edits(source, &[edit]) {
                Ok(_) => panic!("{label}: inserted after an entry that does not exist"),
                Err(error) => classify(
                    &label,
                    &error,
                    &Derived {
                        sibling_exists: keys.iter().any(|key| key == MISSING_SIBLING),
                        ..base(owns_its_line(last.0))
                    },
                    &mut tally,
                ),
            }
        }

        // 5. Remove each entry.
        for (key, value) in &entries {
            let Ok(field) = path_to(&index, *value) else {
                continue;
            };
            let lines = entry_lines(source, &index, *key, *value, body_offset);
            let label = format!("{name} mapping {} remove {}", mapping.id.get(), key.get());
            match remove_field(source, &field) {
                Ok(patched) => {
                    assert!(
                        blocked.is_none() && !flow,
                        "{label}: applied although refused"
                    );
                    assert!(entries.len() > 1, "{label}: emptied its mapping");
                    check_candidate_is_the_splice(&label, source, &patched);
                    assert_eq!(patched.replacements().len(), 1, "{label}: one replacement");
                    check_removal_envelope(
                        &label,
                        source,
                        &index,
                        patched.replacements()[0].span,
                        *key,
                        *value,
                    );
                    check_removed(&label, &index, &mapping_path, *key, &before, &patched);
                    // The oracle finding 1 walked past: a comment the document
                    // gives to the file must still be in the candidate.
                    if let Some(at) = lost_file_comment(&owned_comments, patched.text()) {
                        panic!("{label}: the file-owned comment at byte {at} was deleted");
                    }
                    tally.removed += 1;
                }
                Err(error) => classify(
                    &label,
                    &error,
                    &Derived {
                        kept_block: kept_block_above(source, &index, lines),
                        file_comment: file_comment_in_entry(&trivia, lines),
                        ..base(owns_its_line(*key))
                    },
                    &mut tally,
                ),
            }
        } // End of the loop over the mapping's entries, removing each
    } // End of the loop over every mapping of the document

    tally
} // End of function audit()

/// Files one refusal, asserting the document justifies it independently.
///
/// Every arm asserts a **re-derived** fact before it counts, and the assertions
/// are the point: a tally that counted refusals without checking them would
/// record an engine that refused everything as a clean sweep. That was not
/// hypothetical — `KeyAlreadyPresent` was counted with no such check until the
/// Phase 0c-3a review's finding 5.
fn classify(label: &str, error: &EditError, derived: &Derived, tally: &mut Tally) {
    match error {
        EditError::Refused { hazard, .. } => {
            let found = derived
                .blocked
                .unwrap_or_else(|| panic!("{label}: refused with no hazard to justify it"));
            assert_eq!(
                found, *hazard,
                "{label}: refused for a hazard the document does not have"
            );
            tally.refused_by_the_gate += 1;
        }
        EditError::FlowCollection { .. } => {
            assert!(
                derived.flow,
                "{label}: no enclosing collection is bracket-delimited"
            );
            tally.flow += 1;
        }
        EditError::LastEntryOfMapping { .. } => {
            assert!(
                derived.last_entry,
                "{label}: the mapping has more than one entry"
            );
            tally.last_entry += 1;
        }
        EditError::EntryDoesNotOwnItsLines { .. } => {
            assert!(
                !derived.owns_its_line,
                "{label}: the entry does begin its own line, so the refusal is unjustified"
            );
            tally.shares_a_line += 1;
        }
        EditError::KeyAlreadyPresent { .. } => {
            assert!(
                derived.key_present,
                "{label}: the mapping does not hold the key it was refused for"
            );
            tally.key_present += 1;
        }
        EditError::NoSuchSibling { .. } => {
            assert!(
                !derived.sibling_exists,
                "{label}: the named sibling is in the mapping, so the refusal is unjustified"
            );
            tally.no_such_sibling += 1;
        }
        EditError::InconsistentEntryIndentation { .. } => {
            assert!(
                !derived.columns_agree,
                "{label}: every key of the mapping starts at one column"
            );
            tally.inconsistent_indent += 1;
        }
        EditError::NoObservableLineEnding { .. } => {
            assert!(
                !derived.has_a_line_ending,
                "{label}: the document does hold a line break the insertion could copy"
            );
            tally.no_line_ending += 1;
        }
        EditError::RemovalWouldExtendAKeptBlock { .. } => {
            assert!(
                derived.kept_block,
                "{label}: no keep-chomped block above would grow"
            );
            tally.kept_block += 1;
        }
        EditError::RemovalWouldDeleteAFileComment { comment, .. } => {
            let found = derived.file_comment.unwrap_or_else(|| {
                panic!("{label}: no file-owned comment lies in the entry's own lines")
            });
            assert_eq!(
                found, *comment,
                "{label}: the refusal names a different comment than the document's own \
                 ownership rules do"
            );
            tally.file_comment += 1;
        }
        other => panic!("{label}: unexpected outcome {other}"),
    }
} // End of function classify()

/// Re-checks an applied insertion against the reparsed candidate.
fn check_inserted(
    label: &str,
    mapping_path: &DocumentPath,
    value: &str,
    before: &[(String, String)],
    patched: &PatchedDocument,
) {
    let index = SyntaxIndex::parse(patched.text())
        .unwrap_or_else(|error| panic!("{label}: the candidate does not parse: {error}"));
    let mapping = espansoconfig_core::patch::resolve(&index, mapping_path)
        .unwrap_or_else(|error| panic!("{label}: the mapping is lost: {error}"));
    let after = entry_shapes(&index, mapping);
    assert_eq!(
        after.len(),
        before.len() + 1,
        "{label}: the mapping did not gain exactly one entry"
    );
    let inserted: Vec<&(String, String)> =
        after.iter().filter(|(key, _)| key == INSERT_KEY).collect();
    assert_eq!(inserted.len(), 1, "{label}: the new key is not there once");
    assert_eq!(
        inserted[0].1,
        format!("<{}|{}>", value.len(), value),
        "{label}: the inserted entry does not decode to the intended value"
    );
    let siblings: Vec<&(String, String)> =
        after.iter().filter(|(key, _)| key != INSERT_KEY).collect();
    assert_eq!(
        siblings.len(),
        before.len(),
        "{label}: a sibling disappeared"
    );
    for (position, (was, now)) in before.iter().zip(&siblings).enumerate() {
        assert!(
            was == *now,
            "{label}: sibling {position} is not what it was"
        );
    } // End of the loop that compares every sibling with itself
} // End of function check_inserted()

/// Re-checks an applied removal against the reparsed candidate.
fn check_removed(
    label: &str,
    original: &SyntaxIndex,
    mapping_path: &DocumentPath,
    key: NodeId,
    before: &[(String, String)],
    patched: &PatchedDocument,
) {
    let gone = original
        .node(key)
        .and_then(|key| key.scalar.as_ref())
        .map(|scalar| scalar.value.clone())
        .unwrap_or_default();
    let index = SyntaxIndex::parse(patched.text())
        .unwrap_or_else(|error| panic!("{label}: the candidate does not parse: {error}"));
    let mapping = espansoconfig_core::patch::resolve(&index, mapping_path)
        .unwrap_or_else(|error| panic!("{label}: the mapping is lost: {error}"));
    let after = entry_shapes(&index, mapping);
    assert_eq!(
        after.len(),
        before.len() - 1,
        "{label}: the mapping did not lose exactly one entry"
    );
    assert!(
        after.iter().all(|(found, _)| *found != gone),
        "{label}: the removed key is still there"
    );
    let expected: Vec<&(String, String)> =
        before.iter().filter(|(found, _)| *found != gone).collect();
    for (position, (was, now)) in expected.iter().zip(&after).enumerate() {
        assert!(
            **was == *now,
            "{label}: sibling {position} is not what it was"
        );
    } // End of the loop that compares every surviving sibling with itself
} // End of function check_removed()

// ---------------------------------------------------------------------------
// The corpus-wide tests
// ---------------------------------------------------------------------------

/// Column headings for the printed tables, in [`Tally`] declaration order.
const HEADINGS: &str = "   ins    rem  gate  flow  last  line   dup  keep  cmnt   sib  ind  brk";

/// One tally's twelve numbers, formatted under [`HEADINGS`].
fn columns(tally: &Tally) -> String {
    format!(
        "{:>6} {:>6} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>4} {:>4}",
        tally.inserted,
        tally.removed,
        tally.refused_by_the_gate,
        tally.flow,
        tally.last_entry,
        tally.shares_a_line,
        tally.key_present,
        tally.kept_block,
        tally.file_comment,
        tally.no_such_sibling,
        tally.inconsistent_indent,
        tally.no_line_ending
    )
} // End of function columns()

#[test]
fn every_mapping_of_the_synthetic_corpus_is_edited_or_refused_for_a_derivable_reason() {
    let files = synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus must be present");
    assert_eq!(
        files.len(),
        SYNTHETIC_OUTCOMES.len(),
        "every fixture needs a pinned outcome row"
    );

    println!("\n--- attempted structural edits per synthetic fixture ---");
    println!("{:<40} {:>6}  {}", "fixture", "total", HEADINGS);
    let mut total = Tally::default();
    for file in &files {
        SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{}: expected a valid fixture, got {error}", file.name));
        let tally = audit(&file.name, &file.source, 1);
        println!(
            "{:<40} {:>6}  {}",
            file.name,
            tally.total(),
            columns(&tally)
        );
        let base = file.name.rsplit('/').next().unwrap_or(&file.name);
        let row = SYNTHETIC_OUTCOMES
            .iter()
            .find(|row| row.0 == base)
            .unwrap_or_else(|| panic!("{} has no pinned outcome row", file.name));
        assert_eq!(
            tally,
            Tally::from_row(row.1),
            "{}: outcome split",
            file.name
        );
        total.add(&tally);
    } // End of the loop over the valid synthetic fixtures

    println!(
        "synthetic: {} attempted structural edits\n{}\n{}",
        total.total(),
        HEADINGS,
        columns(&total)
    );
    assert_eq!(
        total.total(),
        SYNTHETIC_OUTCOMES
            .iter()
            .map(|row| row.1.iter().sum::<usize>())
            .sum::<usize>(),
        "the pinned rows must add up to the pinned total"
    );
    // An engine that refused everything satisfies every refusal assertion above
    // and fails here.
    assert!(
        total.inserted > 1000,
        "structural insertion is not reaching the corpus"
    );
    assert!(
        total.removed > 200,
        "structural removal is not reaching the corpus"
    );
    assert!(
        total.kept_block > 0,
        "the keep-chomping refusal is unreached"
    );
    // Every refusal family must be reached by the corpus, or its assertion is a
    // statement about nothing. The three the Phase 0c-3a review's fix round added
    // are here too: a file-owned comment inside a removable collection
    // (`file-comments-and-mixed-endings.yml`), an insertion after an entry that
    // does not exist (every mapping), and a document with no line break at all
    // (`single-line-no-line-ending.yml`).
    assert!(total.refused_by_the_gate > 0);
    assert!(total.flow > 0);
    assert!(total.last_entry > 0);
    assert!(total.shares_a_line > 0);
    assert!(total.key_present > 0);
    assert!(
        total.file_comment > 0,
        "no fixture offers a removal whose envelope crosses a file-owned comment"
    );
    assert!(
        total.no_such_sibling > 0,
        "the missing-sibling refusal is unreached"
    );
    assert!(
        total.no_line_ending > 0,
        "no fixture offers an insertion with no line ending to copy"
    );
    // And the one category that is unreachable rather than unreached: a block
    // mapping whose keys disagree on a column does not parse, and the two shapes
    // that can disagree are refused earlier. Asserted at zero deliberately, with
    // the reason recorded on `Tally::inconsistent_indent`.
    assert_eq!(
        total.inconsistent_indent, 0,
        "a valid block mapping cannot have keys at two columns"
    );
} // End of function every_mapping_of_the_synthetic_corpus_is_edited_or_refused_for_a_derivable_reason()

#[test]
fn every_mapping_of_the_real_corpus_is_edited_or_refused_for_a_derivable_reason() {
    let files = real_corpus();
    if skip_without_real_corpus("real corpus structural edits", &files) {
        return;
    }

    let mut total = Tally::default();
    for file in &files {
        SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{}: expected a valid file, got {error}", file.name));
        total.add(&audit(&file.name, &file.source, REAL_CORPUS_STRIDE));
    } // End of the loop over the real corpus

    // No count from private data is hard-coded (`PROGRESS.md`, D1). What is
    // asserted is the shape of the result: real mappings can be edited
    // structurally, and every refusal was justified from the document by `audit`
    // itself.
    println!(
        "real: {} files, {} attempted structural edits\n{}\n{}",
        files.len(),
        total.total(),
        HEADINGS,
        columns(&total)
    );
    assert!(total.inserted > 0, "no real mapping accepted an insertion");
    assert!(total.removed > 0, "no real entry could be removed");
} // End of function every_mapping_of_the_real_corpus_is_edited_or_refused_for_a_derivable_reason()

// ---------------------------------------------------------------------------
// The awkward fixtures, pinned by bytes
// ---------------------------------------------------------------------------

/// Loads one synthetic fixture by file name.
fn fixture(name: &str) -> CorpusFile {
    synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with(name))
        .unwrap_or_else(|| panic!("{name} must be in the corpus"))
}

#[test]
fn a_structural_edit_to_a_crlf_document_writes_only_crlf() {
    let file = fixture("crlf-line-endings.yml");
    let path = DocumentPath::parse("matches[0]").expect("the path parses");
    let patched =
        insert_field(&file.source, &path, INSERT_KEY, "one\ntwo\n").expect("the insertion applies");
    let bare = patched.text().matches('\n').count() - patched.text().matches("\r\n").count();
    assert_eq!(
        bare, 0,
        "a structural edit must not introduce a bare line feed"
    );
    assert!(patched.text().contains(INSERT_KEY));
} // End of function a_structural_edit_to_a_crlf_document_writes_only_crlf()

#[test]
fn a_structural_edit_to_a_bom_document_leaves_the_bom_alone() {
    let file = fixture("bom-utf8.yml");
    assert!(file.has_bom());
    let patched = insert_field(&file.source, &DocumentPath::root(0), INSERT_KEY, "x")
        .expect("the insertion applies");
    assert!(patched.text().starts_with('\u{feff}'));
    for replacement in patched.replacements() {
        assert!(replacement.span.start >= 3, "no edit may touch the BOM");
    }
}

#[test]
fn a_structural_edit_to_a_file_without_a_final_newline_does_not_add_one() {
    let file = fixture("no-trailing-newline.yml");
    assert!(!file.source.ends_with('\n'));
    let patched = insert_field(&file.source, &DocumentPath::root(0), INSERT_KEY, "x")
        .expect("the insertion applies");
    assert!(
        !patched.text().ends_with('\n'),
        "an insertion must not invent a final newline"
    );
    assert!(patched.text().ends_with("x"));
}

#[test]
fn a_block_scalars_terminal_spaces_survive_a_structural_edit_elsewhere() {
    let file = fixture("block-scalar-terminal-spaces.yml");
    assert!(file.source.ends_with("  "));
    let patched = insert_field(&file.source, &DocumentPath::root(0), INSERT_KEY, "x")
        .expect("the insertion applies");
    // The new root entry goes after the last one, which ends the file, so the
    // terminal spaces stay put and the entry follows them on a new line.
    assert!(patched.text().contains("  \n"));
    assert!(patched.text().ends_with("x"));
} // End of function a_block_scalars_terminal_spaces_survive_a_structural_edit_elsewhere()

#[test]
fn the_empty_entry_fixture_removes_and_inserts_around_its_zero_width_values() {
    // The fixture Phase 0c-3a added for the collection-extent work is also the
    // only one whose entries have no value, so it is where a removal's envelope
    // has to come from the **key's** subtree — the value owns no bytes at all.
    let file = fixture("empty-entries-and-extents.yml");
    let patched = remove_field(
        &file.source,
        &DocumentPath::parse("matches[0].label").expect("the path parses"),
    )
    .expect("an empty entry is removable");
    // The fixture holds two entries written exactly `    label:` — the first
    // match's and the interior one's — so removing the first leaves one.
    assert_eq!(file.source.matches("    label:\n").count(), 2);
    assert_eq!(patched.text().matches("    label:\n").count(), 1);
    assert!(patched.text().contains("replace: 'first'"));

    // And the one whose empty entry carries an inline comment: the comment
    // belongs to the entry and goes with it.
    let patched = remove_field(
        &file.source,
        &DocumentPath::parse("matches[1].label").expect("the path parses"),
    )
    .expect("an empty entry with a comment is removable");
    assert!(!patched.text().contains("deliberately left blank"));
    assert!(patched.text().contains("replace: 'second'"));
} // End of function the_empty_entry_fixture_removes_and_inserts_around_its_zero_width_values()

// ---------------------------------------------------------------------------
// The Phase 0c-3a review's findings, pinned
// ---------------------------------------------------------------------------

#[test]
fn removing_a_collection_that_holds_a_file_comment_is_refused_rather_than_applied() {
    // The review's finding 1, on its own input. Before the fix this removal
    // **applied** and returned `b: 3\n`: the comment is separated from `y` by a
    // blank line, so `PROGRESS.md` D2d gives it to the file, and the file's
    // comments are the one thing an entry's envelope may never contain.
    let source = "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\nb: 3\n";
    let index = SyntaxIndex::parse(source).expect("the probe parses");
    let trivia = TriviaIndex::scan(source, &index);

    // Stated first as a fact about the document, so the refusal below is not the
    // only thing claiming it.
    let owned: Vec<_> = trivia.file_comments().collect();
    assert_eq!(owned.len(), 1, "the file owns exactly the one comment");
    assert_eq!(
        owned[0].span.slice(source),
        Some("# keep this file comment")
    );

    let path = DocumentPath::parse("a").expect("the path parses");
    match remove_field(source, &path) {
        Err(EditError::RemovalWouldDeleteAFileComment { comment, .. }) => {
            assert_eq!(comment, owned[0].span, "the refusal names that comment");
        }
        Ok(patched) => panic!("the removal applied and produced {:?}", patched.text()),
        Err(other) => panic!("refused for the wrong reason: {other}"),
    }

    // …and the entries *inside* the collection are still removable, so the
    // refusal is scoped to the envelope that actually crosses the comment
    // (`PROGRESS.md`, R12) rather than to anything near one.
    for field in ["a.x", "a.y"] {
        remove_field(source, &DocumentPath::parse(field).expect("parses"))
            .unwrap_or_else(|error| panic!("{field} must still be removable: {error}"));
    }
} // End of function removing_a_collection_that_holds_a_file_comment_is_refused_rather_than_applied()

#[test]
fn the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts() {
    // The refusal is not the interesting half. Finding 1 got through because
    // **nothing could see it**: the candidate parsed, `b` was unchanged, the
    // entry count had dropped by one, and the digests hold no comments. So this
    // asserts the oracle itself, on the exact bytes the old engine produced.
    let source = "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\nb: 3\n";
    let index = SyntaxIndex::parse(source).expect("the probe parses");
    let trivia = TriviaIndex::scan(source, &index);
    let owned: Vec<(String, usize)> = trivia
        .file_comments()
        .map(|comment| {
            (
                comment.span.slice(source).expect("slices").to_owned(),
                comment.span.start,
            )
        })
        .collect();

    // What the engine used to return. Everything about it is well-formed.
    let corrupted = "b: 3\n";
    assert!(SyntaxIndex::parse(corrupted).is_ok());
    assert_eq!(
        lost_file_comment(&owned, corrupted),
        Some(12),
        "the oracle must see the comment that is gone"
    );

    // And it does not fire on a candidate that merely moved the comment: a
    // removal of `x` shifts it up without losing it.
    let moved = remove_field(source, &DocumentPath::parse("a.x").expect("parses"))
        .expect("removing x is legal");
    assert_eq!(lost_file_comment(&owned, moved.text()), None);

    // The independent comment scan is what makes that possible, so pin it too: a
    // `#` inside a scalar is data, not a comment.
    assert_eq!(
        comment_texts("a: 'not # a comment'\n# but this is\n"),
        vec!["# but this is"]
    );
} // End of function the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts()

#[test]
fn an_insertion_copies_the_anchors_line_ending_and_not_the_documents() {
    // The review's finding 2, on corpus data. This fixture's lines end with a
    // bare LF except two, so `LineEnding::detect` calls the document LF while the
    // entry an insertion is anchored to ends with CRLF. Writing the document's
    // answer there would put a bare LF into a CRLF line's neighbourhood.
    let file = fixture("file-comments-and-mixed-endings.yml");
    assert_eq!(
        espansoconfig_core::LineEnding::detect(&file.source),
        espansoconfig_core::LineEnding::Lf,
        "the document-wide answer must still be the wrong one"
    );

    let item = DocumentPath::parse("matches[1]").expect("the path parses");
    for (sibling, expected) in [("trigger", "\r\n"), ("replace", "\r\n"), ("label", "\n")] {
        let edit: DocumentEdit = FieldInsert::after(item.clone(), sibling, INSERT_KEY, "x").into();
        let patched = apply_edits(&file.source, &[edit]).expect("the insertion applies");
        assert_eq!(
            patched.replacements()[0].text,
            format!("    {INSERT_KEY}: x{expected}"),
            "inserting after {sibling} must copy that entry's own line ending"
        );
    } // End of the loop over the three anchors of the mixed-ending item

    // The file also ends without a break, so an insertion there learns from a
    // sibling and still leaves the file without a final newline.
    let last = DocumentPath::parse("matches[2]").expect("the path parses");
    let patched = insert_field(&file.source, &last, INSERT_KEY, "x").expect("applies");
    assert_eq!(
        patched.replacements()[0].text,
        format!("\n    {INSERT_KEY}: x")
    );
    assert!(!patched.text().ends_with('\n'));
} // End of function an_insertion_copies_the_anchors_line_ending_and_not_the_documents()

#[test]
fn a_document_with_no_line_break_refuses_an_insertion_rather_than_inventing_one() {
    // The other half of finding 2: `LineEnding::detect` answers LF for a
    // single-line document by **defaulting**, and writing that answer would put
    // a byte in the file that the file never contained.
    let file = fixture("single-line-no-line-ending.yml");
    assert!(!file.source.contains('\n') && !file.source.contains('\r'));
    match insert_field(&file.source, &DocumentPath::root(0), INSERT_KEY, "x") {
        Err(EditError::NoObservableLineEnding { at, .. }) => {
            assert_eq!(at, file.source.len(), "the point is end of file");
        }
        Ok(patched) => panic!("an ending was invented: {:?}", patched.text()),
        Err(other) => panic!("refused for the wrong reason: {other}"),
    }
    // A scalar edit in the same document is unaffected: it writes no break.
    let edited = espansoconfig_core::patch::apply_scalar_edit(
        &file.source,
        &DocumentPath::parse("only").expect("parses"),
        "replaced",
    )
    .expect("a scalar edit needs no line ending");
    assert!(!edited.text().contains('\n'));
} // End of function a_document_with_no_line_break_refuses_an_insertion_rather_than_inventing_one()
