//! Phase 0c-3a acceptance: inserting and removing a mapping field.
//!
//! The same shape as `tests/patch_edit.rs`, one level up. For **every mapping**
//! of all 30 synthetic fixtures and of the real corpus, every entry is offered
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
    /// Removals refused because a run of the envelope still covers a file-owned
    /// comment.
    ///
    /// **Pinned at zero since Phase 0c-3b-1, and it changed meaning rather than
    /// merely changing value.** In Phase 0c-3a this was the *policy*: a removal
    /// whose contiguous hull crossed a comment the file owns was refused, because
    /// one span cannot delete the entry and keep the comment. The envelope is now
    /// a set of runs with those comments punched out, so the refusal is what is
    /// left over — an assertion on the derived run set, read off
    /// `TriviaIndex::file_comments` rather than off the punch-out. It is argued
    /// unreachable, and `docs/decisions/0c-3b-1-notes.md` records the experiment
    /// that makes it fire, so the zero is a live layer rather than dead code.
    file_comment: usize,
    /// Removals refused because the bytes they would keep would join a block
    /// scalar above.
    ///
    /// The residual shape of R21: a comment left in place directly under a block
    /// scalar's content, at that block's own body column, is content of the block
    /// rather than a comment. Reached by `run-based-removal-envelope.yml`.
    block_absorbs: usize,
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
const CATEGORIES: usize = 13;

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
            block_absorbs: row[9],
            no_such_sibling: row[10],
            inconsistent_indent: row[11],
            no_line_ending: row[12],
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
            + self.block_absorbs
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
        self.block_absorbs += other.block_absorbs;
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
const SYNTHETIC_OUTCOMES: [OutcomeRow; 33] = [
    (
        "anchors-aliases-tags-merge.yml",
        [0, 0, 132, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    ("blank-lines.yml", [40, 5, 0, 0, 1, 4, 5, 0, 0, 0, 5, 0, 0]),
    (
        "block-scalar-header-tails.yml",
        [31, 3, 0, 0, 1, 3, 4, 0, 0, 0, 4, 0, 0],
    ),
    (
        "block-scalar-leading-blank-lines.yml",
        [52, 9, 0, 0, 1, 5, 6, 1, 0, 0, 6, 0, 0],
    ),
    (
        "block-scalar-terminal-spaces.yml",
        [24, 3, 0, 0, 1, 2, 3, 0, 0, 0, 3, 0, 0],
    ),
    (
        "block-scalars.yml",
        [106, 19, 0, 0, 1, 11, 12, 3, 0, 0, 12, 0, 0],
    ),
    ("bom-utf8.yml", [23, 2, 0, 0, 1, 2, 3, 0, 0, 0, 3, 0, 0]),
    (
        "comments-everywhere.yml",
        [32, 4, 0, 0, 1, 3, 4, 0, 0, 0, 4, 0, 0],
    ),
    (
        "config-profile.yml",
        [19, 13, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    ),
    (
        "crlf-line-endings.yml",
        [31, 3, 0, 0, 1, 3, 4, 0, 0, 0, 4, 0, 0],
    ),
    (
        "duplicate-keys.yml",
        [41, 6, 34, 0, 2, 3, 5, 0, 0, 0, 5, 0, 0],
    ),
    (
        "empty-entries-and-extents.yml",
        [52, 11, 0, 0, 0, 5, 6, 0, 0, 0, 6, 0, 0],
    ),
    // Phase 0c-3b-2b's fixture for `HazardKind::ExplicitKeyMapping`, which had
    // no corpus fixture at all before it (R20). The `matches:` subtree is
    // refused whole and `global_vars:` is not.
    (
        "explicit-key-mappings.yml",
        [24, 3, 22, 0, 1, 2, 3, 0, 0, 0, 3, 0, 0],
    ),
    // The fixture the Phase 0c-3a review's fix round added for finding 1. Its
    // `vars` entry holds a comment the ownership rules give to the file, so its
    // removal was **refused** for the whole of 0c-3a. Since 0c-3b-1 the envelope
    // is a set of runs and that removal applies, which is why this row's
    // file-comment column is 0 and its removed column is one higher.
    (
        "file-comments-and-mixed-endings.yml",
        [41, 7, 0, 0, 1, 3, 5, 0, 0, 0, 5, 0, 0],
    ),
    (
        "flow-collections.yml",
        [36, 8, 24, 24, 0, 4, 4, 0, 0, 0, 4, 0, 0],
    ),
    (
        "folded-more-indented.yml",
        [43, 7, 0, 0, 1, 4, 5, 1, 0, 0, 5, 0, 0],
    ),
    (
        "form-layout-and-choice.yml",
        [156, 30, 0, 0, 4, 8, 19, 0, 0, 0, 19, 0, 0],
    ),
    (
        "html-and-markdown.yml",
        [48, 6, 0, 0, 1, 5, 6, 0, 0, 0, 6, 0, 0],
    ),
    (
        "imports-and-global-vars.yml",
        [87, 19, 0, 0, 1, 7, 10, 0, 0, 0, 10, 0, 0],
    ),
    // The two fixtures Phase 0c-3b-2a added for the move. They are swept here as
    // well, because a fixture that only one sweep sees is a fixture whose other
    // outcomes nobody has looked at.
    ("move-a-match.yml", [40, 6, 0, 0, 1, 3, 5, 0, 0, 0, 5, 0, 0]),
    (
        "move-block-scalar-seams.yml",
        [55, 6, 0, 0, 1, 6, 7, 0, 0, 0, 7, 0, 0],
    ),
    // The two fixtures the Phase 0c-3b-2a **review** added, given a structural row
    // as well for the same reason the two above are: a fixture only one sweep looks
    // at is a fixture whose other outcomes nobody has checked. Neither reaches a
    // structural refusal the corpus did not already reach — what is new in them is
    // a *move's* seam, not a removal's.
    (
        "move-kept-comment-joins-a-block.yml",
        [41, 6, 0, 0, 1, 4, 5, 0, 0, 0, 5, 0, 0],
    ),
    (
        "move-run-joins.yml",
        [49, 9, 0, 0, 1, 3, 6, 0, 0, 0, 6, 0, 0],
    ),
    (
        "multi-document.yml",
        [0, 0, 66, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "no-trailing-newline.yml",
        [15, 1, 0, 0, 1, 1, 2, 0, 0, 0, 2, 0, 0],
    ),
    ("non-ascii.yml", [72, 9, 0, 0, 2, 7, 9, 0, 0, 0, 9, 0, 0]),
    // The fixture the Phase 0c-3b-1 review's fix round added for finding 2, and
    // the counter-example to the row below it: the *same* two `vars` removals,
    // both of which apply. Its first match keeps a **column-zero** comment under
    // a folded block, so R23's column comparison proves the comment cannot become
    // block content; its second match pairs an entry-owned leading comment block
    // with an interior file comment, the run-boundary construct that makes the
    // envelope start above the entry's own first line. `block_absorbs` is 0 here
    // and 1 below, which is the narrowing pinned as a difference between two
    // fixtures rather than as a unit test.
    (
        "run-based-removal-boundaries.yml",
        [41, 8, 0, 0, 1, 2, 5, 0, 0, 0, 5, 0, 0],
    ),
    // The fixture Phase 0c-3b-1 added, and the only source of `block_absorbs` in
    // the sweep. Its first match's `vars` removal is the run-based envelope
    // succeeding with blank lines preserved on **both** sides of the kept
    // comment; its second match's `vars` removal is the one shape a run set
    // cannot express, because the bytes it would keep sit at the body column of a
    // block scalar directly above them.
    (
        "run-based-removal-envelope.yml",
        [41, 7, 0, 0, 1, 2, 5, 0, 0, 1, 5, 0, 0],
    ),
    (
        "plain-scalar-hazards.yml",
        [303, 37, 0, 0, 1, 37, 38, 0, 0, 0, 38, 0, 0],
    ),
    (
        "scalar-styles.yml",
        [95, 11, 0, 0, 1, 11, 12, 0, 0, 0, 12, 0, 0],
    ),
    // The fixture the review's fix round added for finding 2, and the only
    // source of `NoObservableLineEnding` in the sweep: 6 appended values plus 1
    // insertion after its single entry, all refused because the document holds
    // no line break to copy. Its duplicate-key and missing-sibling attempts are
    // refused earlier, and its one entry cannot be removed.
    (
        "single-line-no-line-ending.yml",
        [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 7],
    ),
    (
        "unicode-offsets.yml",
        [8, 2, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    ),
    (
        "variable-chain.yml",
        [148, 34, 0, 0, 4, 8, 17, 0, 0, 0, 17, 0, 0],
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
/// Since Phase 0c-3b-1 the envelope is an ordered set of **runs** rather than one
/// span (`PROGRESS.md`, R21), and that changed what has to be proved: a hull
/// covered every byte of the entry by construction, a set does not, and a set can
/// be split anywhere at all. Eight properties since that phase's review rewrote
/// property 6 and split property 8 out of it, none of them a restatement of
/// `subtree_extent` or of the punch-out that derived the runs:
///
/// 1. every run is non-empty, they are in ascending order and they are disjoint;
/// 2. every run starts a line and ends a line or the file — a removal deletes
///    whole lines;
/// 3. no run reaches into the BOM;
/// 4. the runs together cover every **frontier leaf** of the entry, so no token
///    of it survives. Stated over leaves rather than over every node because the
///    span of a collection inside the entry legitimately straddles a preserved
///    comment: it is derived from children that lie on both sides of it;
/// 5. no run covers a node that is neither part of the entry nor an ancestor of
///    it — an envelope one entry too long fails here, and nowhere else;
/// 6. **the runs and the bytes the preservation rule protects partition the
///    envelope's own byte range.** Every byte the envelope spans is either deleted
///    or protected by [`preserved_by_the_rule`], and none is both. Stated in both
///    directions, so an engine that *under*-preserves — deleting the blank line
///    that makes a kept comment file-owned — fails as loudly as one that keeps
///    bytes the rule does not protect. This replaces the Phase 0c-3b-1 property
///    "every gap holds a file-owned comment", which the review found could not see
///    under-preservation at all and which rejected any change to the rule
///    mechanically instead of reporting a disagreement about named bytes;
/// 7. no run intersects a comment the file owns;
/// 8. every gap holds whole lines and holds nothing but comment and blank lines.
///    Property 6 already pins *which* bytes are kept; this pins what kind of bytes
///    the rule is allowed to be about, and it is written over the source text
///    rather than over the trivia index, so a `preserved_by_the_rule` that
///    protected a content line would be caught by it rather than agreed with.
fn check_removal_runs(
    label: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    runs: &[ByteSpan],
    key: NodeId,
    value: NodeId,
) {
    let body_offset = index.preamble().body_offset;
    assert!(!runs.is_empty(), "{label}: the envelope deletes nothing");
    let mut previous_end = 0usize;
    for run in runs {
        assert!(!run.is_empty(), "{label}: an envelope run is empty");
        assert!(
            run.start >= previous_end,
            "{label}: the envelope runs are not ordered and disjoint"
        );
        previous_end = run.end;
        assert!(
            run.start >= body_offset,
            "{label}: an envelope run reaches into the BOM"
        );
        assert!(
            begins_its_line(source, run.start, body_offset)
                && run.start == line_start(source, run.start, body_offset),
            "{label}: an envelope run does not start a line"
        );
        assert!(
            run.end == source.len() || line_start(source, run.end, body_offset) == run.end,
            "{label}: an envelope run does not end a line"
        );
        assert!(
            file_comment_in_entry(trivia, *run).is_none(),
            "{label}: an envelope run covers a comment the file owns"
        );
    } // End of the loop over the envelope's runs

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
        if node.span.is_empty() {
            continue;
        }
        let of_the_entry = inside.contains(&node.id);
        if of_the_entry && node.is_frontier_leaf() {
            assert!(
                runs.iter().any(|run| run.contains(node.span)),
                "{label}: no run covers node {}, which the entry owns",
                node.id.get()
            );
        }
        if of_the_entry || ancestors.contains(&node.id) {
            continue;
        }
        if let Some(run) = runs.iter().find(|run| run.intersects(node.span)) {
            panic!(
                "{label}: the envelope run {}..{} reaches into node {}",
                run.start,
                run.end,
                node.id.get()
            );
        }
    } // End of the loop over every node the envelope might disturb

    // Property 6, both directions. The envelope's own byte range is used rather
    // than a re-derived hull so that nothing here depends on reproducing
    // `subtree_extent`; a region the rule protects outside that range was never at
    // risk, because the envelope does not reach it.
    let envelope = ByteSpan::new(
        runs.first().expect("checked non-empty").start,
        runs.last().expect("checked non-empty").end,
    );
    let expected = preserved_by_the_rule(source, trivia, envelope, body_offset);
    let gaps: Vec<ByteSpan> = runs
        .windows(2)
        .map(|pair| ByteSpan::new(pair[0].end, pair[1].start))
        .collect();
    for region in &expected {
        let held = gaps
            .iter()
            .any(|gap| gap.start <= region.start && region.end <= gap.end);
        assert!(
            held,
            "{label}: the envelope deletes {}..{}, which the preservation rule protects \
             for a comment the file owns",
            region.start, region.end
        );
    } // End of the loop over the regions the rule protects
    for gap in &gaps {
        let justified = expected
            .iter()
            .any(|region| region.start <= gap.start && gap.end <= region.end);
        assert!(
            justified,
            "{label}: the envelope keeps {}..{}, which the preservation rule does not protect",
            gap.start, gap.end
        );
    } // End of the loop over the bytes the envelope declined to delete

    // Property 8: what kind of bytes the rule may be about, read off the source.
    for gap in &gaps {
        let text = gap.slice(source).expect("the gap slices");
        for line in text.split_inclusive(['\n', '\r']) {
            let content = line.trim_start_matches([' ', '\t']).trim_end();
            assert!(
                content.is_empty() || content.starts_with('#'),
                "{label}: the envelope skips a line that is neither blank nor a comment"
            );
        } // End of the loop over the lines the envelope leaves in place
        assert!(
            text.ends_with(['\n', '\r']),
            "{label}: the envelope skips part of a line"
        );
    } // End of the loop over the gaps between the runs
} // End of function check_removal_runs()

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

/// Re-derives whether the bytes a removal keeps would join a block scalar.
///
/// The independent statement of `EditError::RemovalWouldExtendABlockScalar`, and
/// three facts rather than the two it used to be — the third is the Phase
/// 0c-3b-1 review's finding 2:
///
/// 1. the removal has something to preserve at all (`kept` is non-empty, which
///    [`preserved_by_the_rule`] answers from the file's own comments);
/// 2. some block scalar's content ends at or before `at` with nothing but
///    whitespace in between, so once the entry's runs are gone the kept bytes sit
///    directly under that content;
/// 3. the first non-blank line among the kept bytes is at that block's body
///    column **or deeper**, so YAML would read it as one more body line. A
///    shallower line ends the block, which is what the removed entry's own key
///    already did.
///
/// Fact 3 is stated here over `ScalarPresentation::indent` and the source text,
/// and in the engine over the same published column: there is one body-column
/// fact in the document and both sides read it rather than re-lexing the block.
/// What is independent is the byte range the columns are measured in — this file
/// finds the entry textually, the engine derives it from `subtree_extent`.
///
/// `at` is [`entry_hull_lines`]'s start, which covers the entry's leading comment
/// block as the engine's ownership hull does. Measuring from [`entry_lines`]
/// instead used to make the two disagree for an entry that owns a leading comment
/// block, a shape no fixture paired with an interior file comment until
/// `run-based-removal-boundaries.yml` did.
fn kept_bytes_would_join_a_block(
    source: &str,
    index: &SyntaxIndex,
    kept: &[ByteSpan],
    at: usize,
) -> bool {
    let Some(column) = first_kept_column(source, kept, index.preamble().body_offset) else {
        return false;
    };
    index.nodes().iter().any(|node| {
        node.scalar.as_ref().is_some_and(|scalar| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                && presentation.content_span.end <= at
                && source[presentation.content_span.end..at].trim().is_empty()
                // An empty content span means the span layer observed no body
                // column, so there is nothing to compare and the engine refuses.
                && (presentation.content_span.is_empty() || column >= presentation.indent)
        })
    })
} // End of function kept_bytes_would_join_a_block()

/// The column of the first non-blank line among the bytes a removal keeps.
///
/// Every byte between the block scalar above and this line is deleted, so this is
/// the line that ends up directly under that block's content — and one column
/// answers the question for the whole kept set, because a line shallower than the
/// body column ends the block and nothing after it can rejoin one.
fn first_kept_column(source: &str, kept: &[ByteSpan], body_offset: usize) -> Option<usize> {
    for region in kept {
        let Some(text) = region.slice(source) else {
            continue;
        };
        let mut at = region.start;
        for line in text.split_inclusive(['\n', '\r']) {
            let body = line.trim_start_matches([' ', '\t']);
            if !body.trim_end().is_empty() {
                let opener = at + (line.len() - body.len());
                return Some(
                    source[line_start(source, opener, body_offset)..opener]
                        .chars()
                        .count(),
                );
            }
            at += line.len();
        } // End of the loop over this region's lines
    } // End of the loop over the kept regions, in ascending order
    None
} // End of function first_kept_column()

/// The bytes a removal of this entry **must keep**, from the document's own
/// trivia facts.
///
/// **This is the preservation rule, written down once on the test side.** The
/// Phase 0c-3b-1 review's finding 1 was that the sweep's old property 6 —
/// "every gap between two runs holds a comment the file owns" — *codified* the
/// engine's behaviour instead of checking it. It could not see a kept comment's
/// ownership-establishing blank line being deleted, and had the rule ever changed
/// it would have rejected the new behaviour mechanically rather than reporting a
/// disagreement about named bytes. An oracle that cannot fail for the right
/// reason is not an oracle.
///
/// The rule, both halves:
///
/// - the **whole line** each file-owned comment inside `region` occupies survives,
///   indentation and terminating break included;
/// - so does **every blank run touching one of those lines**. The run below is what
///   plan section 6.2's rule 2 reads to give the comment to the file, so deleting
///   it re-attributes the comment; the run above is grouped with the comment's line
///   by the same `blank_runs()` answer.
/// - **nothing else.** A blank run touching no such comment is trivia interior to
///   the entry the user asked to remove, and goes with it.
///
/// The two inputs are the document's ownership answers, `file_comments()` and
/// `blank_runs()`, which this file is entitled to read — the same way
/// [`file_comment_in_entry`] does. The line arithmetic, the intersection test, the
/// clamp and the merge are written here, so an off-by-one, a wrong side or a
/// missing merge in the engine's `preserved_regions` shows up as a disagreement.
/// If the rule itself is ever changed, **this function is the one place to change
/// it**, and until it is changed the sweep names the exact bytes the two sides
/// disagree about and in which direction.
fn preserved_by_the_rule(
    source: &str,
    trivia: &TriviaIndex,
    region: ByteSpan,
    body_offset: usize,
) -> Vec<ByteSpan> {
    let mut kept: Vec<ByteSpan> = Vec::new();
    for comment in trivia.file_comments() {
        if !comment.span.intersects(region) {
            continue;
        }
        let mut start = line_start(source, comment.span.start, body_offset);
        let mut end = line_end(source, comment.span.end);
        for run in trivia.blank_runs() {
            if run.span.end == start {
                start = run.span.start.max(body_offset);
            }
            if run.span.start == end {
                end = run.span.end;
            }
        } // End of the loop that grows the region over the blank runs beside it
        let start = start.max(region.start).min(region.end);
        let end = end.min(region.end).max(start);
        if start < end {
            kept.push(ByteSpan::new(start, end));
        }
    } // End of the loop over the comments the file owns

    kept.sort_by_key(|span| (span.start, span.end));
    let mut merged: Vec<ByteSpan> = Vec::new();
    for span in kept {
        match merged.last_mut() {
            Some(last) if span.start <= last.end => last.end = last.end.max(span.end),
            _ => merged.push(span),
        }
    } // End of the loop that merges the kept regions into a disjoint, ordered set
    merged
} // End of function preserved_by_the_rule()

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

/// The offset just past the break that terminates `position`'s physical line.
fn line_end(source: &str, position: usize) -> usize {
    match source[position..].find(['\n', '\r']) {
        None => source.len(),
        Some(offset) => {
            let at = position + offset;
            at + if source[at..].starts_with("\r\n") {
                2
            } else {
                1
            }
        }
    }
} // End of function line_end()

/// The whole lines a removal of this entry deletes or keeps, leading comment
/// block included.
///
/// [`entry_lines`] starts at the key's own line. The engine's envelope starts at
/// the start of the **ownership hull**, which reaches further up whenever the
/// entry owns a leading comment block: plan section 6.2's rule 1 gives contiguous
/// comments immediately above a node to that node, so they are the entry's trivia
/// and are deleted with it.
///
/// Derived textually — walk up over comment-only lines and stop at the first line
/// that is blank or holds anything else — rather than by asking
/// `TriviaIndex::subtree_extent`, which is the very hull the engine used. The walk
/// cannot pull a **file-owned** comment in: a blank line above the block is what
/// rule 2 reads to give the comments above it to the file, and the walk stops
/// there.
///
/// # The `#` that is not a comment
///
/// A line whose first non-blank byte is `#` is a comment **only if it does not lie
/// inside a frontier leaf**: a line of shell or Python inside a `replace: |`
/// block's body looks exactly like a leading comment to a textual walk, and the
/// real corpus contains one. Phase 0c-3b-2a found this in its own copy of the
/// walk, fixed it there and recorded the defect here as a live hole; its review
/// asked for the fix to be ported before any future structural sweep count is
/// treated as authoritative, and this is that port. No removal in either corpus
/// pairs the two shapes today, so no count moves — which is exactly why it had to
/// be fixed rather than waited for.
fn entry_hull_lines(
    source: &str,
    index: &SyntaxIndex,
    lines: ByteSpan,
    body_offset: usize,
) -> ByteSpan {
    let mut start = lines.start;
    while start > body_offset {
        let above = line_start(source, start - 1, body_offset);
        let line = &source[above..start];
        let text = line.trim_start_matches([' ', '\t']);
        let opener = above + (line.len() - text.len());
        let inside_a_leaf = index.nodes().iter().any(|node| {
            node.is_frontier_leaf() && node.span.start <= opener && opener < node.span.end
        });
        if !text.starts_with('#') || inside_a_leaf {
            return ByteSpan::new(start, lines.end);
        }
        start = above;
    } // End of the walk up over the entry's own leading comment block
    ByteSpan::new(start, lines.end)
} // End of function entry_hull_lines()

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
    /// Whether the bytes a removal would keep would join a block scalar above.
    block_absorbs: bool,
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
            block_absorbs: false,
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
                    let runs: Vec<ByteSpan> = patched
                        .replacements()
                        .iter()
                        .map(|replacement| {
                            assert_eq!(replacement.text, "", "{label}: a removal writes no bytes");
                            replacement.span
                        })
                        .collect();
                    check_removal_runs(&label, source, &index, &trivia, &runs, *key, *value);
                    check_removed(&label, &index, &mapping_path, *key, &before, &patched);
                    // The oracle finding 1 walked past: a comment the document
                    // gives to the file must still be in the candidate.
                    if let Some(at) = lost_file_comment(&owned_comments, patched.text()) {
                        panic!("{label}: the file-owned comment at byte {at} was deleted");
                    }
                    tally.removed += 1;
                }
                Err(error) => {
                    // The engine's envelope starts at the ownership hull, which
                    // covers the entry's leading comment block; the bytes it would
                    // keep are what the preservation rule protects inside it.
                    let hull = entry_hull_lines(source, &index, lines, body_offset);
                    let kept = preserved_by_the_rule(source, &trivia, hull, body_offset);
                    classify(
                        &label,
                        &error,
                        &Derived {
                            kept_block: kept_block_above(source, &index, lines),
                            file_comment: file_comment_in_entry(&trivia, lines),
                            block_absorbs: kept_bytes_would_join_a_block(
                                source, &index, &kept, hull.start,
                            ),
                            ..base(owns_its_line(*key))
                        },
                        &mut tally,
                    );
                }
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
        EditError::RemovalWouldExtendABlockScalar { .. } => {
            assert!(
                derived.block_absorbs,
                "{label}: nothing would be kept, or no block scalar's content ends above it"
            );
            tally.block_absorbs += 1;
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
const HEADINGS: &str =
    "   ins    rem  gate  flow  last  line   dup  keep  cmnt   blk   sib  ind  brk";

/// One tally's thirteen numbers, formatted under [`HEADINGS`].
fn columns(tally: &Tally) -> String {
    format!(
        "{:>6} {:>6} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>4} {:>4}",
        tally.inserted,
        tally.removed,
        tally.refused_by_the_gate,
        tally.flow,
        tally.last_entry,
        tally.shares_a_line,
        tally.key_present,
        tally.kept_block,
        tally.file_comment,
        tally.block_absorbs,
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
    // statement about nothing. Two the Phase 0c-3a review's fix round added are
    // here: an insertion after an entry that does not exist (every mapping), and
    // a document with no line break at all (`single-line-no-line-ending.yml`).
    assert!(total.refused_by_the_gate > 0);
    assert!(total.flow > 0);
    assert!(total.last_entry > 0);
    assert!(total.shares_a_line > 0);
    assert!(total.key_present > 0);
    assert!(
        total.no_such_sibling > 0,
        "the missing-sibling refusal is unreached"
    );
    assert!(
        total.no_line_ending > 0,
        "no fixture offers an insertion with no line ending to copy"
    );
    // Phase 0c-3b-1's own refusal: the residual shape a run-based envelope cannot
    // express, reached by `run-based-removal-envelope.yml`.
    assert!(
        total.block_absorbs > 0,
        "no fixture offers a removal whose kept bytes would join a block scalar"
    );
    // …and a removal that keeps a file-owned comment has to be **reached** as a
    // success, or R21's closure is a claim about nothing. Four fixtures offer one,
    // and the last two are the shapes the Phase 0c-3b-1 review's finding 2 named:
    // a preserved comment at column zero under a folded block, and an entry that
    // owns a leading comment block as well as holding a file-owned one.
    let multi_run = [
        ("file-comments-and-mixed-endings.yml", "matches[0].vars"),
        ("run-based-removal-envelope.yml", "matches[0].vars"),
        ("run-based-removal-boundaries.yml", "matches[0].vars"),
        ("run-based-removal-boundaries.yml", "matches[1].vars"),
    ];
    for (name, field) in multi_run {
        let file = fixture(name);
        let path = DocumentPath::parse(field).expect("the path parses");
        let patched = remove_field(&file.source, &path)
            .unwrap_or_else(|error| panic!("{name}: {field} must be removable: {error}"));
        assert!(
            patched.replacements().len() > 1,
            "{name}: {field} is the corpus's run-based envelope and it has one run"
        );
    } // End of the loop over the fixtures that offer a multi-run removal

    // The two categories that are unreachable rather than unreached, both pinned
    // at zero deliberately with the argument recorded on their `Tally` fields: a
    // valid block mapping cannot have keys at two columns, and the punch-out
    // cannot leave a file-owned comment inside a run.
    assert_eq!(
        total.inconsistent_indent, 0,
        "a valid block mapping cannot have keys at two columns"
    );
    assert_eq!(
        total.file_comment, 0,
        "a derived run can no longer cover a comment the file owns"
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
fn removing_a_collection_that_holds_a_file_comment_keeps_the_comment_byte_for_byte() {
    // **The D2o example, and the whole point of Phase 0c-3b-1 (R21).** The Phase
    // 0c-3a review's finding 1 was that this removal *applied* and returned
    // `b: 3\n`, deleting a comment the ownership rules give to the file. 0c-3a
    // answered by refusing the removal outright, which was the safe half of an
    // unfinished answer: one contiguous span cannot delete the entry and keep the
    // comment. The envelope is now the set of runs either side of it.
    let source = "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\nb: 3\n";
    let index = SyntaxIndex::parse(source).expect("the probe parses");
    let trivia = TriviaIndex::scan(source, &index);

    // Stated first as a fact about the document, so the assertions below are not
    // the only thing claiming it.
    let owned: Vec<_> = trivia.file_comments().collect();
    assert_eq!(owned.len(), 1, "the file owns exactly the one comment");
    assert_eq!(
        owned[0].span.slice(source),
        Some("# keep this file comment")
    );

    let path = DocumentPath::parse("a").expect("the path parses");
    let patched = remove_field(source, &path).expect("the removal applies");
    // Byte-exact, indentation and the blank line under the comment included.
    assert_eq!(patched.text(), "  # keep this file comment\n\nb: 3\n");
    assert_eq!(
        patched.replacements().len(),
        2,
        "the envelope is two runs, not one span"
    );
    check_removal_runs(
        "the D2o example",
        source,
        &index,
        &trivia,
        &patched
            .replacements()
            .iter()
            .map(|replacement| replacement.span)
            .collect::<Vec<ByteSpan>>(),
        espansoconfig_core::patch::resolve_full(&index, &path)
            .expect("resolves")
            .key
            .expect("a key"),
        espansoconfig_core::patch::resolve(&index, &path).expect("resolves"),
    );

    // …and the entries *inside* the collection are still removable, exactly as
    // they were while the whole entry was refused (`PROGRESS.md`, R12).
    for field in ["a.x", "a.y"] {
        remove_field(source, &DocumentPath::parse(field).expect("parses"))
            .unwrap_or_else(|error| panic!("{field} must still be removable: {error}"));
    }
} // End of function removing_a_collection_that_holds_a_file_comment_keeps_the_comment_byte_for_byte()

#[test]
fn the_one_shape_a_run_based_envelope_still_refuses_is_the_block_scalar_above() {
    // The residual shape, on corpus data. Keeping the file-owned comment inside
    // `vars` would leave it directly below the `replace: |` block's content, at
    // that block's own body column — where it is content of the block rather than
    // a comment, so `replace` would decode with an extra line although nothing
    // about it was edited. Refused by name rather than performed.
    let file = fixture("run-based-removal-envelope.yml");
    let refused = DocumentPath::parse("matches[1].vars").expect("the path parses");
    match remove_field(&file.source, &refused) {
        Err(EditError::RemovalWouldExtendABlockScalar { block, .. }) => {
            let index = SyntaxIndex::parse(&file.source).expect("the fixture parses");
            let node = index.node(block).expect("the named node exists");
            let presentation = &node.scalar.as_ref().expect("a scalar").presentation;
            assert!(
                presentation.style.is_block(),
                "the refusal must name a block scalar"
            );
        }
        Ok(patched) => panic!("the removal applied and produced {:?}", patched.text()),
        Err(other) => panic!("refused for the wrong reason: {other}"),
    }

    // Its own siblings, and the same shape without a block above it, are
    // unaffected: the refusal is scoped to the one hazard rather than to comments
    // or to block scalars in general.
    for field in [
        "matches[1].replace",
        "matches[1].vars.only",
        "matches[1].vars.last",
        "matches[0].vars",
    ] {
        remove_field(
            &file.source,
            &DocumentPath::parse(field).expect("the path parses"),
        )
        .unwrap_or_else(|error| panic!("{field} must be removable: {error}"));
    } // End of the loop over the removals the refusal must not touch
} // End of function the_one_shape_a_run_based_envelope_still_refuses_is_the_block_scalar_above()

#[test]
fn a_kept_file_comment_keeps_the_blank_lines_on_both_sides_of_it() {
    // The fixture's first match, and the reason `preserved_regions` grows over
    // the blank runs on **both** sides: the ownership layer groups both with this
    // comment's line. The one *below* is literally what rule 2 reads to give the
    // comment to the file, so deleting it would hand the surviving comment to
    // whatever ends up underneath; the one above is the rest of the neighbourhood
    // `blank_runs()` reports, and the gap layer does not arbitrate side by side.
    // **Neither survives as "layout"** — the Phase 0c-3b-1 review's finding 1
    // withdrew that wording, and
    // `a_blank_run_survives_only_where_it_touches_a_kept_comment` in
    // `src/patch/edit.rs` pins the other direction: a blank run touching no kept
    // comment is deleted with the entry.
    let file = fixture("run-based-removal-envelope.yml");
    let path = DocumentPath::parse("matches[0].vars").expect("the path parses");
    let patched = remove_field(&file.source, &path).expect("the removal applies");

    let kept = concat!(
        "\n",
        "      # A blank line above AND below, and blank_runs() groups both with this\n",
        "      # line: the one below is literally what gives this comment to the FILE.\n",
        "      # Not \"layout\" — a run touching no kept comment goes with the entry.\n",
        "\n"
    );
    assert!(
        file.source.contains(kept),
        "the fixture no longer holds the shape this test is about"
    );
    assert!(
        patched.text().contains(kept),
        "the kept comment and its blank lines are not byte-identical"
    );
    // The entry itself is gone, keys and values alike. `vars:` is counted rather
    // than searched for, because the fixture's second match has one too — and the
    // second match is what proves the removal was scoped to the first.
    assert_eq!(file.source.matches("vars:").count(), 2);
    assert_eq!(patched.text().matches("vars:").count(), 1);
    for gone in ["first: 'one'", "second: 'two'"] {
        assert!(
            !patched.text().contains(gone),
            "{gone} survived the removal"
        );
    }
    assert!(patched.text().contains("      only: 'one'"));
} // End of function a_kept_file_comment_keeps_the_blank_lines_on_both_sides_of_it()

// ---------------------------------------------------------------------------
// The Phase 0c-3b-1 review's findings, pinned
// ---------------------------------------------------------------------------

#[test]
fn a_kept_comment_shallower_than_the_folded_block_above_it_applies_byte_for_byte() {
    // **Finding 2, on corpus data.** The reviewer's case: a folded block whose
    // body is indented six columns, and a preserved comment block at column zero.
    // A line shallower than the body column *ends* the block exactly as the
    // removed `vars:` key already did, so nothing about `replace` can change and
    // the removal must apply. R23 refused it until this round because
    // `block_scalar_ending_above` compared no columns at all.
    let file = fixture("run-based-removal-boundaries.yml");
    let path = DocumentPath::parse("matches[0].vars").expect("the path parses");
    let patched = remove_field(&file.source, &path)
        .unwrap_or_else(|error| panic!("the reviewer's safe removal must apply: {error}"));

    // Byte-exact, and stated as the whole file rather than as a `contains`: the
    // point of the fix is that the bytes *outside* the two runs are untouched.
    let expected = concat!(
        "# Phase 0c-3b-1 review, finding 2: the two run-boundary shapes neither corpus\n",
        "# held. Nothing else is in this file, so every pinned count it moves is one of\n",
        "# its own.\n",
        "matches:\n",
        "  - trigger: ':folded-above-a-shallow-comment'\n",
        "    replace: >\n",
        "      the folded body of this block is indented six columns\n",
        "# These four comment lines sit at column zero, shallower than the folded\n",
        "# block's body column above them, so leaving them where they are cannot turn\n",
        "# them into that block's content: removing vars applies rather than being\n",
        "# refused for R23.\n",
        "\n",
        "  - trigger: ':leading-comment-block'\n",
        "    # This block leads vars with no blank line under it, so the ownership rules\n",
        "    # give it to the entry and it is deleted with the entry.\n",
        "    vars:\n",
        "      only: 'one'\n",
        "      # This comment has a blank line under it, so the file owns it and the\n",
        "      # removal keeps it. Pairing the two is the run-boundary construct neither\n",
        "      # corpus held: the hull starts above the entry's own first line.\n",
        "\n",
        "      last: 'two'\n",
        "    replace: 'the entry owns its leading comments and the file owns the interior one'\n",
    );
    assert_eq!(patched.text(), expected);
    assert_eq!(
        patched.replacements().len(),
        2,
        "the envelope is two runs either side of the kept comment block"
    );

    // And the folded block really does still decode to what it decoded to. The
    // sibling digest already says so inside the engine; saying it again from
    // outside is the point of an oracle.
    let before = SyntaxIndex::parse(&file.source).expect("the fixture parses");
    let after = SyntaxIndex::parse(patched.text()).expect("the candidate parses");
    let folded = |index: &SyntaxIndex| {
        index
            .nodes()
            .iter()
            .filter_map(|node| node.scalar.as_ref())
            .find(|scalar| scalar.presentation.style.is_block())
            .map(|scalar| scalar.value.clone())
            .expect("the fixture's one folded block")
    };
    assert_eq!(folded(&before), folded(&after));
} // End of function a_kept_comment_shallower_than_the_folded_block_above_it_applies_byte_for_byte()

#[test]
fn an_entry_owned_leading_comment_block_is_deleted_and_the_interior_file_one_is_kept() {
    // **The run-boundary construct neither corpus held**, and the one the Phase
    // 0c-3b-1 notes admitted to: an entry that owns a leading comment block *and*
    // holds a comment the file owns. The envelope therefore starts **above** the
    // entry's own first line — which is where the engine's ownership hull starts
    // and where `entry_hull_lines` now starts in this file too, so the sweep's own
    // R23 derivation measures from the same place the engine does.
    let file = fixture("run-based-removal-boundaries.yml");
    let path = DocumentPath::parse("matches[1].vars").expect("the path parses");
    let patched = remove_field(&file.source, &path).expect("the removal applies");

    // The entry's leading comments go with the entry: rule 1 gives contiguous
    // comments immediately above a node to that node.
    for owned in [
        "# This block leads vars with no blank line under it",
        "# give it to the entry and it is deleted with the entry.",
        "only: 'one'",
        "last: 'two'",
    ] {
        assert!(
            file.source.contains(owned),
            "the fixture no longer holds the shape this test is about"
        );
        assert!(
            !patched.text().contains(owned),
            "{owned} is the entry's own trivia and must go with it"
        );
    } // End of the loop over the bytes the entry owns

    // The interior comment, its indentation and the blank line that makes it
    // file-owned come out byte-identical.
    let kept = concat!(
        "      # This comment has a blank line under it, so the file owns it and the\n",
        "      # removal keeps it. Pairing the two is the run-boundary construct neither\n",
        "      # corpus held: the hull starts above the entry's own first line.\n",
        "\n"
    );
    assert!(file.source.contains(kept));
    assert!(
        patched.text().contains(kept),
        "the kept comment block and its blank line are not byte-identical"
    );
    // The envelope really did start above the entry's first line: the first run
    // begins at the leading comment block, not at `vars:`.
    let first = patched.replacements()[0].span;
    let at = first.slice(&file.source).expect("the run slices");
    assert!(
        at.trim_start().starts_with("# This block leads vars"),
        "the first run must begin at the entry's leading comment block"
    );
} // End of function an_entry_owned_leading_comment_block_is_deleted_and_the_interior_file_one_is_kept()

#[test]
fn the_preservation_rule_oracle_reports_a_disagreement_in_both_directions() {
    // **Finding 3 of the review's finding 1: an oracle that cannot fail for the
    // right reason is not an oracle.** The property this replaces asked only that
    // every gap hold a file-owned comment, which no under-preservation could ever
    // trip: delete the blank line that makes a kept comment file-owned and the gap
    // still holds a comment. `preserved_by_the_rule` states the rule instead, and
    // the two directions are driven here against run sets the planner cannot
    // produce, exactly as `the_oracle_catches_a_lost_file_comment...` drives the
    // comment scan against bytes no planner emits any more.
    let source = "a:\n  x: 1\n\n  # file\n\n  y: 2\nb: 3\n";
    let index = SyntaxIndex::parse(source).expect("the probe parses");
    let trivia = TriviaIndex::scan(source, &index);
    let hull = ByteSpan::new(0, source.len() - "b: 3\n".len());

    // What the rule protects: the comment's whole line and the blank run on each
    // side of it. Stated first as bytes, so the two experiments below are not the
    // only thing claiming it.
    let expected = preserved_by_the_rule(source, &trivia, hull, 0);
    assert_eq!(expected.len(), 1);
    assert_eq!(expected[0].slice(source), Some("\n  # file\n\n"));

    // Direction one — **under-preservation**, the case the old property was blind
    // to. These runs keep the comment line and delete the blank run below it, so
    // the surviving comment would be re-attributed to whatever ends up under it.
    let under = [
        ByteSpan::new(hull.start, expected[0].start + 1),
        ByteSpan::new(expected[0].end - 1, hull.end),
    ];
    let complaint = std::panic::catch_unwind(|| {
        check_removal_runs(
            "under",
            source,
            &index,
            &trivia,
            &under,
            key(&index),
            value(&index),
        );
    })
    .expect_err("the oracle must reject an envelope that deletes what the rule protects");
    assert!(
        message(&complaint).contains("which the preservation rule protects"),
        "the oracle must name the bytes it lost, not merely fail: {}",
        message(&complaint)
    );

    // Direction two — **over-preservation**. These runs keep a blank run the rule
    // does not protect, which is the behaviour the review asked for and this phase
    // declined. The oracle must report a disagreement about named bytes rather
    // than rejecting it as "a gap with no comment in it", so that a future round
    // that *does* adopt it has one function to change and a real message to read.
    let unowned = "a:\n  x: 1\n\n  y: 2\nb: 3\n";
    let plain = SyntaxIndex::parse(unowned).expect("the probe parses");
    let plain_trivia = TriviaIndex::scan(unowned, &plain);
    let blank = unowned.find("\n\n").expect("the blank line is there") + 1;
    let over = [
        ByteSpan::new(0, blank),
        ByteSpan::new(blank + 1, unowned.len() - "b: 3\n".len()),
    ];
    let complaint = std::panic::catch_unwind(|| {
        check_removal_runs(
            "over",
            unowned,
            &plain,
            &plain_trivia,
            &over,
            key(&plain),
            value(&plain),
        );
    })
    .expect_err("the oracle must reject an envelope that keeps what the rule does not protect");
    assert!(
        message(&complaint).contains("which the preservation rule does not protect"),
        "the oracle must name the bytes it kept: {}",
        message(&complaint)
    );
} // End of function the_preservation_rule_oracle_reports_a_disagreement_in_both_directions()

/// The key node of the entry `a` in the probe documents above.
fn key(index: &SyntaxIndex) -> NodeId {
    espansoconfig_core::patch::resolve_full(index, &DocumentPath::parse("a").expect("parses"))
        .expect("resolves")
        .key
        .expect("a key")
}

/// The value node of the entry `a` in the probe documents above.
fn value(index: &SyntaxIndex) -> NodeId {
    espansoconfig_core::patch::resolve(index, &DocumentPath::parse("a").expect("parses"))
        .expect("resolves")
}

/// The panic message of a caught assertion, whichever payload type it carried.
fn message(payload: &Box<dyn std::any::Any + Send>) -> &str {
    payload
        .downcast_ref::<String>()
        .map(String::as_str)
        .or_else(|| payload.downcast_ref::<&str>().copied())
        .unwrap_or("<non-string panic payload>")
} // End of function message()

#[test]
fn the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts() {
    // **The third of R21's three visibility layers, and the one that has to stay
    // live now that the planner performs the removal instead of refusing it.**
    // Finding 1 got through because *nothing could see it*: the candidate parsed,
    // `b` was unchanged, the entry count had dropped by one, and the digests hold
    // no comments. So this asserts the oracle itself, on the exact bytes the
    // hull-based engine produced — bytes no planner in the tree can produce any
    // more, which is precisely why the oracle has to be driven directly.
    // `docs/decisions/0c-3b-1-notes.md` records the disabling experiment that
    // confirms each of the three layers catches the class on its own.
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
