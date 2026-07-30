//! Phase 0c-3b-2a acceptance: moving a whole match.
//!
//! The sibling of `tests/patch_structure.rs`, and a separate file rather than a
//! fourteenth column in that one: a move has its own refusal families, its own
//! envelope (a source **and** a destination) and its own whole-document
//! invariant, and folding them into a 2 300-line sweep would hide every one of
//! them inside a total.
//!
//! For **every block sequence** of all 32 synthetic fixtures and of the real
//! corpus, every item is offered for relocation to every position in that
//! sequence — including its own, and including an index the sequence does not
//! have — and each attempt must end in one of exactly two ways:
//!
//! - a **typed refusal whose reason this file re-derives from the document
//!   itself**, by walking the tree and reading the source text rather than by
//!   asking the engine. An engine that refused every move would satisfy "no move
//!   ever corrupted a file" while being useless, and only an independent
//!   derivation of each reason catches that;
//! - a **successful move satisfying every verification property**, all of them
//!   re-checked here rather than trusted.
//!
//! # What an applied move has to prove, and why byte identity is not enough
//!
//! Phases 0c-2b and 0c-3a rested on "every byte outside the replaced spans is
//! identical". A move satisfies that by construction — its replacement list
//! *says* those bytes moved — so this file states the invariant the relocation
//! actually promises, in three independent forms:
//!
//! 1. **the bytes are relocated, not rewritten.** The text written at the
//!    destination is byte-for-byte the concatenation of the runs deleted at the
//!    source, with no transformation of any kind permitted. Phase 0c-3b-2a
//!    allowed one — the trailing break carried round to the front for a move to
//!    the end of a file with no final break — and its review showed that this
//!    rewrites an untouched line's terminator, so that destination is refused and
//!    the exception is gone. **`verify` now makes this check too**; it is kept
//!    here because two independent derivations of one property are the discipline,
//!    and a check that exists only inside the thing it checks is not one;
//! 2. **the document's lines are conserved**, as one multiset of physical lines
//!    each paired with its own terminator. Written here over the two texts,
//!    sharing no code with the engine's own check;
//! 3. **every construct the move did not name still decodes to what it decoded to
//!    before**, compared over this file's own `shape` rendering of the two trees
//!    with the intended permutation applied on the original's side.
//!
//! Plus everything a removal already had to prove about its envelope, which a
//! move's source half inherits whole: whole lines, ordered and disjoint runs
//! covering every token of the item and no node outside it, gaps that are exactly
//! what the preservation rule protects, and every comment the file owns still in
//! the candidate.
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
    apply_edits, move_item, path_to, DocumentEdit, DocumentPath, EditError, ItemMove, MoveSeam,
    PatchedDocument, ScalarEdit,
};
use espansoconfig_core::syntax::{CollectionStyle, Hazard, HazardKind, NodeKind, TriviaIndex};
use espansoconfig_core::{ByteSpan, NodeId, SyntaxIndex};

/// How many of a real sequence's items are offered for relocation.
///
/// `TriviaIndex::scan` is quadratic in (trivia items × nodes) — `PROGRESS.md`
/// R19 — and the safe entry point re-scans on every call by design, so a real
/// file with fifty matches would cost fifty times fifty scans at 20 ms each. Every
/// third item, against the five destinations [`destinations`] keeps for a thinned
/// sweep, exercises every code path at a fraction of the cost. The synthetic
/// corpus, which everyone runs, keeps the full cross product.
const REAL_CORPUS_STRIDE: usize = 3;

/// How every attempted move of one corpus ended.
///
/// The categories are exhaustive over the outcomes a sequence item can produce:
/// [`audit`] panics on anything else, so a new refusal family cannot slip in as
/// "some other error".
#[derive(Debug, Default, PartialEq, Eq)]
struct Tally {
    /// Moves that applied and satisfied every verification property.
    moved: usize,
    /// Moves the hazard gate refused, consulted on the **sequence**.
    refused_by_the_gate: usize,
    /// Moves refused because the sequence is, or is inside, a flow collection.
    flow: usize,
    /// Moves refused because they would leave the item where it already is.
    same_place: usize,
    /// Moves refused because the destination index is not in the sequence.
    no_such_item: usize,
    /// Moves refused because the item shares its line with something else.
    shares_a_line: usize,
    /// Moves refused because a keep-chomped block above the source would grow.
    kept_block: usize,
    /// Moves refused because a run of the source envelope covers a file-owned
    /// comment.
    ///
    /// Inherited from the removal, argued unreachable there and pinned at zero
    /// here for the same reason: the punch-out removes whole lines.
    file_comment: usize,
    /// Moves refused because the bytes the **source** keeps would join a block
    /// scalar — R23, inherited whole from the removal.
    source_keeps_a_block: usize,
    /// Moves refused because the keep-chomped block the item ends with would
    /// decode differently where the move puts it.
    moved_kept_block: usize,
    /// Moves refused at the [`MoveSeam::SourceCloses`] seam.
    seam_source_closes: usize,
    /// Moves refused at the [`MoveSeam::ArrivalLands`] seam.
    seam_arrival_lands: usize,
    /// Moves refused at the [`MoveSeam::ArrivalCloses`] seam.
    seam_arrival_closes: usize,
    /// Moves refused at a [`MoveSeam::CarriedRunsJoin`] seam — the internal one,
    /// which the Phase 0c-3b-2a review added and which exists once per adjacent
    /// pair of carried runs.
    seam_runs_join: usize,
    /// Moves refused because relocating the item would invent a line break.
    line_ending: usize,
    /// Moves refused because the destination is the unterminated end of the
    /// document, so an untouched line would gain a terminator.
    final_line: usize,
}

/// How many categories a [`Tally`] has. Every pinned row states all of them.
const CATEGORIES: usize = 16;

impl Tally {
    /// Builds a tally from a pinned row's numbers, in declaration order.
    fn from_row(row: [usize; CATEGORIES]) -> Tally {
        Tally {
            moved: row[0],
            refused_by_the_gate: row[1],
            flow: row[2],
            same_place: row[3],
            no_such_item: row[4],
            shares_a_line: row[5],
            kept_block: row[6],
            file_comment: row[7],
            source_keeps_a_block: row[8],
            moved_kept_block: row[9],
            seam_source_closes: row[10],
            seam_arrival_lands: row[11],
            seam_arrival_closes: row[12],
            seam_runs_join: row[13],
            line_ending: row[14],
            final_line: row[15],
        }
    } // End of function from_row()

    /// Every attempt this tally accounts for.
    fn total(&self) -> usize {
        self.moved
            + self.refused_by_the_gate
            + self.flow
            + self.same_place
            + self.no_such_item
            + self.shares_a_line
            + self.kept_block
            + self.file_comment
            + self.source_keeps_a_block
            + self.moved_kept_block
            + self.seam_source_closes
            + self.seam_arrival_lands
            + self.seam_arrival_closes
            + self.seam_runs_join
            + self.line_ending
            + self.final_line
    } // End of function total()

    /// Folds another file's tally into this one.
    fn add(&mut self, other: &Tally) {
        self.moved += other.moved;
        self.refused_by_the_gate += other.refused_by_the_gate;
        self.flow += other.flow;
        self.same_place += other.same_place;
        self.no_such_item += other.no_such_item;
        self.shares_a_line += other.shares_a_line;
        self.kept_block += other.kept_block;
        self.file_comment += other.file_comment;
        self.source_keeps_a_block += other.source_keeps_a_block;
        self.moved_kept_block += other.moved_kept_block;
        self.seam_source_closes += other.seam_source_closes;
        self.seam_arrival_lands += other.seam_arrival_lands;
        self.seam_arrival_closes += other.seam_arrival_closes;
        self.seam_runs_join += other.seam_runs_join;
        self.line_ending += other.line_ending;
        self.final_line += other.final_line;
    } // End of function add()
} // End of impl Tally

/// One fixture's pinned outcome row: its file name and its fourteen [`Tally`]
/// fields, in declaration order.
type OutcomeRow = (&'static str, [usize; CATEGORIES]);

/// Every synthetic fixture's complete move-outcome split, pinned exactly.
///
/// A complete row per fixture rather than one corpus-wide tally per category, for
/// the reason the Phase 0c-2b review's finding 4 gave: a total cannot tell two
/// fixtures that exchanged eligibility from two that did not. The list is also
/// asserted to cover the corpus exactly, so a new fixture must be given a row
/// rather than disappearing into a sum.
///
/// A fixture with no block sequence at all still gets a row of zeroes —
/// `single-line-no-line-ending.yml` is the one — because "this file offers no
/// move" is a fact worth pinning too.
const SYNTHETIC_MOVE_OUTCOMES: [OutcomeRow; 32] = [
    // Every move refused by the gate, consulted on the sequence: an anchor, an
    // alias, a tag or a merge key anywhere inside makes reordering a question
    // that cannot be answered locally.
    (
        "anchors-aliases-tags-merge.yml",
        [0, 54, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "blank-lines.yml",
        [12, 0, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "block-scalar-header-tails.yml",
        [6, 0, 0, 6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "block-scalar-leading-blank-lines.yml",
        [20, 0, 0, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    // **This file offers no relocation at all**, and its two refusals are the two
    // sides of an unterminated document: its second match ends the file without a
    // line break, so moving it would have to invent one, and moving the first
    // match past it would give that untouched last line a terminator. Phase
    // 0c-3b-2a applied the second of those by rotating a break; its review made it
    // a refusal, and this row is what that cost.
    (
        "block-scalar-terminal-spaces.yml",
        [0, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    ),
    (
        "block-scalars.yml",
        [110, 0, 0, 22, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "bom-utf8.yml",
        [2, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "comments-everywhere.yml",
        [6, 0, 0, 6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "config-profile.yml",
        [0, 0, 24, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "crlf-line-endings.yml",
        [6, 0, 0, 6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "duplicate-keys.yml",
        [2, 15, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "empty-entries-and-extents.yml",
        [14, 0, 0, 12, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    // Four of its moves are refused, in two pairs: its last match ends the
    // document with no terminator, so relocating it would invent one, and the two
    // moves *to* that unterminated end would terminate it. The second pair applied
    // in Phase 0c-3b-2a by rotating a break — a CRLF one, in a mostly-LF file,
    // which is the byte shape its review used.
    (
        "file-comments-and-mixed-endings.yml",
        [2, 0, 0, 6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
    ),
    (
        "flow-collections.yml",
        [0, 50, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "folded-more-indented.yml",
        [12, 0, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "form-layout-and-choice.yml",
        [24, 0, 0, 28, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "html-and-markdown.yml",
        [20, 0, 0, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "imports-and-global-vars.yml",
        [26, 0, 0, 24, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    // Phase 0c-3b-2a's own fixture. Every move it offers applies, which is the
    // point: a leading comment block and an inline comment travel, and a
    // file-owned comment inside a match does not.
    (
        "move-a-match.yml",
        [6, 0, 0, 6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    // Phase 0c-3b-2a's other fixture, and the only source of the three **external**
    // seam refusals in the sweep. Each is reached from both sides — 5 + 2 + 2
    // refusals against 21 moves that apply — and the safe twin of each refused case
    // differs from it only in a comment's column. The internal seam its review
    // added lives in `move-run-joins.yml`.
    (
        "move-block-scalar-seams.yml",
        [21, 0, 0, 12, 6, 0, 0, 0, 0, 0, 5, 2, 2, 0, 0, 0],
    ),
    // Added by the Phase 0c-3b-2a review's coverage hole 2, and the **only**
    // source of `RemovalWouldExtendABlockScalar` (R23) reached by a move in either
    // corpus. Its second match holds a file-owned comment at the body column of
    // the block directly above it, so carrying that match away feeds the comment
    // to the block; its fourth match is the same shape two columns shallower and
    // moves. Phase 0c-3b-2a pinned this refusal at zero and called the zero a
    // coverage hole rather than a proof.
    (
        "move-kept-comment-joins-a-block.yml",
        [9, 0, 0, 8, 4, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
    ),
    // Added by the Phase 0c-3b-2a review's finding 3, and the only source of the
    // **internal** seam: both matches have a two-run envelope split by a comment
    // the file owns, and concatenating those runs at the destination puts the
    // comment the second run begins with directly under the block the first run
    // ends with. Column seven is refused, column four moves.
    (
        "move-run-joins.yml",
        [4, 0, 0, 6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
    ),
    (
        "multi-document.yml",
        [0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "no-trailing-newline.yml",
        [0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "non-ascii.yml",
        [30, 0, 0, 14, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "plain-scalar-hazards.yml",
        [1332, 0, 0, 74, 37, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "run-based-removal-boundaries.yml",
        [2, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "run-based-removal-envelope.yml",
        [2, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    // The only source of `MoveWouldExtendAKeptBlock` (8) in the sweep, found
    // here rather than reasoned about in advance: its `:literal-keep` match ends
    // in a `|+` block whose value is the blank lines after it, and those belong
    // to whatever follows the block rather than to the match. Its 10
    // `RemovalWouldExtendAKeptBlock` refusals are the same `|+` block seen from
    // the other side, inherited whole from the removal.
    (
        "scalar-styles.yml",
        [92, 0, 0, 22, 11, 0, 10, 0, 0, 8, 0, 0, 0, 0, 0, 0],
    ),
    // A row of zeroes, deliberately: this document holds no sequence at all, and
    // "this file offers no move" is a fact worth pinning too.
    (
        "single-line-no-line-ending.yml",
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    // Its one sequence is a flow sequence, so every move into it is refused
    // outright — the same answer a structural edit gives.
    (
        "unicode-offsets.yml",
        [0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
    (
        "variable-chain.yml",
        [30, 0, 0, 34, 17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
];

// ---------------------------------------------------------------------------
// Independent re-derivations — none of these calls the production policy
// ---------------------------------------------------------------------------

/// Re-derives the hazard gate's answer from the hazard list and the tree.
///
/// Deliberately not a call to `is_safely_editable`: the point is to know that the
/// refusal the engine reported is one the document actually justifies. A hazard
/// disqualifies a node when it sits on that node, on an ancestor, on a
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

/// Whether `offset` begins its physical line, ignoring indentation.
///
/// The independent statement of `EditError::EntryDoesNotOwnItsLines`.
fn begins_its_line(source: &str, offset: usize, body_offset: usize) -> bool {
    source[line_start(source, offset, body_offset)..offset]
        .chars()
        .all(|character| character == ' ' || character == '\t')
} // End of function begins_its_line()

/// The offset of the `-` that introduces the item whose span starts at `at`.
///
/// A sequence item's **span** starts after its dash, and the dash is trivia the
/// item itself owns (`PROGRESS.md`, D2d), so the byte the engine's envelope
/// begins at is the dash rather than the span. `at` itself when the dash is on an
/// earlier line, which is the `-` on its own line shape.
fn dash_before(source: &str, at: usize, body_offset: usize) -> usize {
    let start = line_start(source, at, body_offset);
    match source[start..at].rfind('-') {
        Some(offset) => start + offset,
        None => at,
    }
} // End of function dash_before()

/// Whether one sequence item occupies whole lines of its own.
///
/// The independent statement of `EditError::EntryDoesNotOwnItsLines` for an item:
/// nothing but indentation stands before the byte its ownership envelope begins
/// at, which is its leading comment block when it owns one and its `-` otherwise.
/// The reachable failure is a nested compact item — `- - a`, whose inner dash has
/// the outer one before it.
fn item_owns_its_lines(
    source: &str,
    index: &SyntaxIndex,
    item: NodeId,
    hull: ByteSpan,
    lines: ByteSpan,
    body_offset: usize,
) -> bool {
    if hull.start < lines.start {
        // A leading comment block begins the envelope, and it begins a line.
        return true;
    }
    let span = index.node(item).expect("an item").span;
    begins_its_line(
        source,
        dash_before(source, span.start, body_offset),
        body_offset,
    )
} // End of function item_owns_its_lines()

/// The whole lines one sequence item occupies, found textually.
///
/// From the start of the item's own line to the start of the line after its last.
/// Derived from the node span and the source text, so it owes nothing to the
/// envelope the planner built.
fn item_lines(source: &str, index: &SyntaxIndex, item: NodeId, body_offset: usize) -> ByteSpan {
    let span = index.node(item).expect("an item").span;
    let start = line_start(source, span.start, body_offset);
    let mut end = span.end;
    // A block-scalar value already ends past its own final break (D2c), so the
    // item's lines are complete and there is nothing to walk.
    if !source[..end].ends_with(['\n', '\r']) {
        end = line_end(source, end);
    }
    ByteSpan::new(start, end)
} // End of function item_lines()

/// The whole lines a move of this item carries, leading comment block included.
///
/// [`item_lines`] starts at the item's own line; the engine's envelope starts at
/// the start of the **ownership hull**, which reaches further up whenever the item
/// owns a leading comment block (plan section 6.2's rule 1). Derived textually —
/// walk up over comment-only lines and stop at the first line that is blank or
/// holds anything else — rather than by asking `TriviaIndex::subtree_extent`,
/// which is the hull the engine used. The walk cannot pull a **file-owned**
/// comment in: a blank line above the block is what gives those comments to the
/// file, and the walk stops there.
fn hull_lines(source: &str, index: &SyntaxIndex, lines: ByteSpan, body_offset: usize) -> ByteSpan {
    let mut start = lines.start;
    while start > body_offset {
        let above = line_start(source, start - 1, body_offset);
        let text = source[above..start].trim_start_matches([' ', '\t']);
        // A `#` that lies **inside a frontier leaf** is a block scalar's own
        // content, not a comment — a line of shell or Python inside a
        // `replace: |` is the reachable case, and a walk that treats it as trivia
        // starts the envelope one line too high. The syntax index says where the
        // leaves are; nothing else can tell the two apart.
        let opener = above + (source[above..start].len() - text.len());
        let inside_a_leaf = index.nodes().iter().any(|node| {
            node.is_frontier_leaf() && node.span.start <= opener && opener < node.span.end
        });
        if !text.starts_with('#') || inside_a_leaf {
            return ByteSpan::new(start, lines.end);
        }
        start = above;
    } // End of the walk up over the item's own leading comment block
    ByteSpan::new(start, lines.end)
} // End of function hull_lines()

/// The bytes a move of this item **must leave behind**, from the document's own
/// trivia facts.
///
/// The preservation rule, written down once on this file's side, exactly as
/// `tests/patch_structure.rs` writes it for a removal — and it has to be the same
/// rule, because the source half of a move *is* a removal. The whole line each
/// file-owned comment inside `region` occupies survives, and so does every blank
/// run touching one of those lines; nothing else does.
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

/// The ordered, disjoint runs of `hull` that `preserved` does not cover.
fn runs_between(hull: ByteSpan, preserved: &[ByteSpan]) -> Vec<ByteSpan> {
    let mut runs = Vec::new();
    let mut cursor = hull.start;
    for region in preserved {
        if region.end <= cursor {
            continue;
        }
        if region.start > cursor {
            runs.push(ByteSpan::new(cursor, region.start));
        }
        cursor = region.end;
    } // End of the loop that emits the gap before each preserved region
    if cursor < hull.end {
        runs.push(ByteSpan::new(cursor, hull.end));
    }
    runs
} // End of function runs_between()

/// The column of the first non-blank line among a set of regions.
fn first_column_among(source: &str, regions: &[ByteSpan], body_offset: usize) -> Option<usize> {
    for region in regions {
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
    } // End of the loop over the regions, in ascending order
    None
} // End of function first_column_among()

/// The column of the first non-blank line at or after `at`.
fn first_column_from(source: &str, at: usize, body_offset: usize) -> Option<usize> {
    first_column_among(source, &[ByteSpan::new(at, source.len())], body_offset)
}

/// Whether a block scalar's content ends directly above `at` and would swallow a
/// line written there at `column`.
///
/// The independent statement of `EditError::MoveWouldExtendABlockScalar`, in the
/// shape `tests/patch_structure.rs` already uses for its removal twin: adjacency
/// is measured over byte ranges this file derived textually, and the body column
/// is `ScalarPresentation::indent`, the one the span layer published. There is one
/// body-column fact in the document and both sides read it rather than re-lexing
/// the block; what is independent is *where* the columns are measured.
///
/// A block whose content span is empty has no observed body column, and the
/// engine refuses whatever the comparison would say, so this answers the same.
fn block_would_absorb(source: &str, index: &SyntaxIndex, at: usize, column: usize) -> bool {
    index.nodes().iter().any(|node| {
        node.scalar.as_ref().is_some_and(|scalar| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                && presentation.content_span.end <= at
                && source[presentation.content_span.end..at].trim().is_empty()
                && (presentation.content_span.is_empty() || column >= presentation.indent)
        })
    })
} // End of function block_would_absorb()

/// Whether the block the moved item ends with would decode differently at its
/// destination.
///
/// The independent statement of `EditError::MoveWouldExtendAKeptBlock`, and it is
/// stated over the same two document facts the engine reads — a block's chomping
/// and its content span — measured against a hull and a destination this file
/// derived textually. A `|+` block gains a break when it lands above a blank line.
///
/// Phase 0c-3b-2a had a second clause here, for the rotation a move to the end of
/// an unterminated document used to perform: a `|` block loses its one kept break
/// when that break is carried round to the front. Its review made that destination
/// a refusal of its own, so nothing rotates and the clause describes nothing.
fn moved_block_would_change(
    source: &str,
    index: &SyntaxIndex,
    hull: ByteSpan,
    point: usize,
) -> bool {
    let lands_on_a_blank_line = {
        let after = &source[point..];
        !after.is_empty() && {
            let next = after.find(['\n', '\r']).unwrap_or(after.len());
            after[..next]
                .chars()
                .all(|character| character == ' ' || character == '\t')
        }
    };
    if !lands_on_a_blank_line {
        return false;
    }
    index.nodes().iter().any(|node| {
        node.scalar.as_ref().is_some_and(|scalar| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                && presentation.chomping == espansoconfig_core::Chomping::Keep
                && presentation.content_span.end <= hull.end
                && source[presentation.content_span.end..hull.end]
                    .trim()
                    .is_empty()
        })
    })
} // End of function moved_block_would_change()

/// Whether a keep-chomped block above these lines would grow if they went.
fn kept_block_above(source: &str, index: &SyntaxIndex, lines: ByteSpan) -> bool {
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
                && presentation.content_span.end <= lines.start
                && source[presentation.content_span.end..lines.start]
                    .trim()
                    .is_empty()
        })
    })
} // End of function kept_block_above()

/// A comment the **file** owns that sits inside these lines.
fn file_comment_in(trivia: &TriviaIndex, lines: ByteSpan) -> Option<ByteSpan> {
    trivia
        .file_comments()
        .map(|comment| comment.span)
        .find(|comment| comment.intersects(lines))
} // End of function file_comment_in()

/// A canonical rendering of everything a node's subtree decodes to, with one
/// sequence's children optionally taken in a different order.
///
/// Written independently of the engine's own digest, over the substrate's decoded
/// values, so that "every construct the move did not name still decodes to what
/// it decoded to before" is checked by something other than the code that claims
/// it. Never printed: it holds decoded values, and the real corpus is private.
fn shape(index: &SyntaxIndex, node: NodeId, permuted: Option<(NodeId, &[usize])>) -> String {
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
            let order: Vec<usize> = match permuted {
                Some((sequence, order)) if sequence == node => order.to_vec(),
                _ => (0..here.children.len()).collect(),
            };
            let inner: Vec<String> = order
                .iter()
                .map(|position| shape(index, here.children[*position], permuted))
                .collect();
            if here.kind == NodeKind::Mapping {
                format!("map({})", inner.join("|"))
            } else {
                format!("seq({})", inner.join("|"))
            }
        }
        NodeKind::Document => format!("doc({})", shape_of_children(index, here.id, permuted)),
    }
} // End of function shape()

/// The concatenated shapes of a node's children.
fn shape_of_children(
    index: &SyntaxIndex,
    node: NodeId,
    permuted: Option<(NodeId, &[usize])>,
) -> String {
    index
        .node(node)
        .map(|here| {
            here.children
                .iter()
                .map(|child| shape(index, *child, permuted))
                .collect::<Vec<String>>()
                .join("|")
        })
        .unwrap_or_default()
} // End of function shape_of_children()

/// The whole stream's shape: every document root, in order.
fn stream_shape(index: &SyntaxIndex, permuted: Option<(NodeId, &[usize])>) -> String {
    index
        .documents()
        .iter()
        .map(|document| shape(index, *document, permuted))
        .collect::<Vec<String>>()
        .join("\n")
} // End of function stream_shape()

/// The sequence order a move intends, as positions in the original sequence.
fn intended_order(items: usize, from: usize, to: usize) -> Vec<usize> {
    let mut positions: Vec<usize> = (0..items).collect();
    let moved = positions.remove(from);
    positions.insert(to.min(positions.len()), moved);
    positions
} // End of function intended_order()

/// Every physical line of `text`, as (offset, content, terminator).
fn physical_lines(text: &str) -> Vec<(usize, &str, &str)> {
    let mut lines = Vec::new();
    let mut at = 0usize;
    while at < text.len() {
        let rest = &text[at..];
        match rest.find(['\n', '\r']) {
            None => {
                lines.push((at, rest, ""));
                break;
            }
            Some(offset) => {
                let ending = if rest[offset..].starts_with("\r\n") {
                    "\r\n"
                } else {
                    &rest[offset..offset + 1]
                };
                lines.push((at, &rest[..offset], ending));
                at += offset + ending.len();
            }
        }
    } // End of the walk over the text's physical lines
    lines
} // End of function physical_lines()

/// Every comment of `source`, found **without asking the trivia scanner**.
///
/// A `#` is a comment when it opens a line or follows white space and does not lie
/// inside a frontier leaf — the only place a `#` can be data rather than a comment
/// is inside a scalar's own token, and the syntax index says where those are.
fn comment_texts(source: &str) -> Vec<&str> {
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
fn lost_file_comment(owned: &[(String, usize)], candidate: &str) -> Option<usize> {
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

// ---------------------------------------------------------------------------
// The properties an applied move must satisfy
// ---------------------------------------------------------------------------

/// Checks that the candidate is the source with exactly these replacements.
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

/// Checks the move's source envelope by its **properties**, not by how it was
/// built.
///
/// The same eight the removal sweep states, minus the two a move restates
/// elsewhere, and stated over the item rather than over a key/value pair:
///
/// 1. every run is non-empty, and the runs are ascending and disjoint;
/// 2. every run starts a line and ends a line or the file;
/// 3. no run reaches into the BOM;
/// 4. the runs together cover every **frontier leaf** of the item, so no token of
///    it stays behind;
/// 5. no run covers a node that is neither part of the item nor an ancestor of it;
/// 6. the runs and the bytes [`preserved_by_the_rule`] protects partition the
///    envelope's own byte range, in both directions;
/// 7. no run intersects a comment the file owns;
/// 8. every gap holds whole lines and holds nothing but comment and blank lines.
fn check_source_runs(
    label: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    runs: &[ByteSpan],
    item: NodeId,
) {
    let body_offset = index.preamble().body_offset;
    assert!(!runs.is_empty(), "{label}: the move deletes nothing");
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
            file_comment_in(trivia, *run).is_none(),
            "{label}: an envelope run covers a comment the file owns"
        );
    } // End of the loop over the envelope's runs

    let mut inside = vec![item];
    let mut pending = vec![item];
    while let Some(id) = pending.pop() {
        if let Some(node) = index.node(id) {
            for child in &node.children {
                inside.push(*child);
                pending.push(*child);
            }
        }
    } // End of the walk over the item's own subtree
    let mut ancestors = Vec::new();
    let mut current = index.node(item).and_then(|node| node.parent);
    while let Some(id) = current {
        ancestors.push(id);
        current = index.node(id).and_then(|node| node.parent);
    } // End of the walk over the item's ancestors

    for node in index.nodes() {
        if node.span.is_empty() {
            continue;
        }
        let of_the_item = inside.contains(&node.id);
        if of_the_item && node.is_frontier_leaf() {
            assert!(
                runs.iter().any(|run| run.contains(node.span)),
                "{label}: no run covers node {}, which the item owns",
                node.id.get()
            );
        }
        if of_the_item || ancestors.contains(&node.id) {
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
            "{label}: the move carries away {}..{}, which the preservation rule protects \
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
            "{label}: the move leaves {}..{} behind, which the preservation rule does not \
             protect",
            gap.start, gap.end
        );
        let text = gap.slice(source).expect("the gap slices");
        for line in text.split_inclusive(['\n', '\r']) {
            let content = line.trim_start_matches([' ', '\t']).trim_end();
            assert!(
                content.is_empty() || content.starts_with('#'),
                "{label}: the move leaves behind a line that is neither blank nor a comment"
            );
        } // End of the loop over the lines the move leaves in place
        assert!(
            text.ends_with(['\n', '\r']),
            "{label}: the move leaves part of a line behind"
        );
    } // End of the loop over the gaps between the runs
} // End of function check_source_runs()

/// Checks that the bytes written at the destination are the bytes deleted at the
/// source.
///
/// **The simplest statement of what a move is.** The engine renders nothing: the
/// arrival is the concatenation of the runs, verbatim, with no transformation of
/// any kind permitted.
///
/// Phase 0c-3b-2a allowed one — the trailing break carried round to the front for
/// a move to the end of a file with no final break — and its review showed that
/// this rewrites an untouched line's terminator, so the destination is now refused
/// and the exception is gone.
///
/// **This check is retained even though `verify` now makes it too.** The two
/// derivations are independent and either can be wrong; keeping both is the same
/// discipline `check_lines_are_conserved` follows beside
/// `document_lines_are_conserved`.
fn check_the_arrival_is_the_departure(
    label: &str,
    source: &str,
    runs: &[ByteSpan],
    arrival: &espansoconfig_core::patch::Replacement,
) {
    let carried: String = runs
        .iter()
        .map(|run| run.slice(source).expect("a run slices"))
        .collect();
    assert!(
        arrival.text == carried,
        "{label}: the bytes written at the destination are not the bytes taken from the source"
    );
} // End of function check_the_arrival_is_the_departure()

/// Checks that the move conserved the document's lines.
///
/// One multiset over physical lines, each paired with its own terminator, written
/// here over the two texts. It sees what a tree walk cannot — a uniform
/// re-indentation leaves every decoded value intact — and it is deliberately blind
/// to order, which is the one thing a move is allowed to change.
///
/// Phase 0c-3b-2a compared contents and terminators as two *separate* multisets so
/// that the rotation at an unterminated end of file could pass. That destination is
/// refused since its review, no move relocates a terminator away from its own line,
/// and the pairing — which also refuses two lines that exchanged their endings — is
/// restored.
fn check_lines_are_conserved(label: &str, source: &str, candidate: &str) {
    let before = physical_lines(source);
    let after = physical_lines(candidate);
    let mut lines: Vec<(&str, &str)> = after.iter().map(|line| (line.1, line.2)).collect();
    for (at, content, ending) in &before {
        match lines.iter().position(|seen| *seen == (*content, *ending)) {
            Some(found) => {
                lines.swap_remove(found);
            }
            None => panic!("{label}: the line at byte {at} is not in the candidate"),
        }
    } // End of the loop that claims one candidate line per original line
    assert!(
        lines.is_empty(),
        "{label}: the candidate holds {} lines the original did not",
        lines.len()
    );
} // End of function check_lines_are_conserved()

/// Checks the arrival point by its properties.
fn check_arrival_point(label: &str, source: &str, index: &SyntaxIndex, span: ByteSpan) {
    assert!(span.is_empty(), "{label}: an arrival replaces no bytes");
    let body_offset = index.preamble().body_offset;
    assert!(
        span.start == source.len() || line_start(source, span.start, body_offset) == span.start,
        "{label}: the arrival point does not begin a line"
    );
    assert!(
        span.start >= body_offset,
        "{label}: the arrival point reaches into the BOM"
    );
    for node in index.nodes() {
        assert!(
            !(node.is_frontier_leaf()
                && node.span.start < span.start
                && span.start < node.span.end),
            "{label}: the arrival point falls inside node {}",
            node.id.get()
        );
    } // End of the loop over the frontier leaves
} // End of function check_arrival_point()

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/// Facts about one attempted move, every one derived from the document.
struct Derived {
    /// The hazard that disqualifies the sequence, re-derived from the tree.
    blocked: Option<HazardKind>,
    /// Whether the sequence is, or is inside, a bracket-delimited collection.
    flow: bool,
    /// Whether the move would leave the item where it already is.
    same_place: bool,
    /// The index the item must occupy afterwards, counted in the sequence with
    /// the item taken out. Re-derived here from the request and the original
    /// order, never read off the candidate.
    to: usize,
    /// Whether the destination index is one the sequence has.
    destination_exists: bool,
    /// Whether the item, and the anchor the move measures from, begin their own
    /// lines.
    owns_its_lines: bool,
    /// Whether a keep-chomped block above the item would grow.
    kept_block: bool,
    /// A file-owned comment inside the item's own lines, if there is one.
    file_comment: Option<ByteSpan>,
    /// Whether the bytes the source keeps would join a block scalar (R23).
    source_keeps_a_block: bool,
    /// Whether the block the item ends with would decode differently at the
    /// destination.
    moved_kept_block: bool,
    /// Whether a block would swallow what rises when the source closes.
    seam_source_closes: bool,
    /// Whether a block would swallow the item's first line at the destination.
    seam_arrival_lands: bool,
    /// Whether a block inside the item would swallow what follows the
    /// destination.
    seam_arrival_closes: bool,
    /// Whether concatenating two carried runs would feed a block the line the
    /// second one begins with.
    seam_runs_join: bool,
    /// Whether relocating the item would have to invent a line break.
    line_ending: bool,
    /// Whether the destination is the unterminated end of the document, so an
    /// untouched line would gain a terminator.
    final_line: bool,
    /// The offset the moved bytes must be written at, derived textually.
    point: usize,
    /// The whole lines the item occupies, leading comment block included,
    /// derived textually rather than from `TriviaIndex::subtree_extent`.
    hull: ByteSpan,
}

/// The destinations one sequence's items are offered.
///
/// The front, every position in the sequence, and one index the sequence does not
/// have — the counterpart of `patch_structure.rs`'s missing-sibling attempt,
/// because a refusal nothing exercises is a refusal nothing knows the shape of.
/// A thinned sweep keeps the front, the two ends, the middle and the impossible
/// index, which reaches every branch at a fraction of the quadratic cost (R19).
fn destinations(items: usize, thinned: bool) -> Vec<Option<usize>> {
    let mut out = vec![None];
    if thinned {
        for candidate in [0, items / 2, items.saturating_sub(1)] {
            if candidate < items && !out.contains(&Some(candidate)) {
                out.push(Some(candidate));
            }
        }
    } else {
        out.extend((0..items).map(Some));
    }
    out.push(Some(items));
    out
} // End of function destinations()

/// Attempts every move on every block sequence of one file.
///
/// Returns the tally; any outcome this function cannot justify from the document
/// panics, verification failures included — a verification failure is a defect in
/// the engine, not an expected answer.
fn audit(name: &str, source: &str, stride: usize) -> Tally {
    let index = SyntaxIndex::parse(source).expect("the caller checked this parses");
    let trivia = TriviaIndex::scan(source, &index);
    let body_offset = index.preamble().body_offset;
    let mut tally = Tally::default();

    let owned_comments: Vec<(String, usize)> = trivia
        .file_comments()
        .filter_map(|comment| {
            comment
                .span
                .slice(source)
                .map(|text| (text.to_owned(), comment.span.start))
        })
        .collect();

    for sequence in index.nodes() {
        if sequence.kind != NodeKind::Sequence {
            continue;
        }
        let items = &sequence.children;
        if items.is_empty() {
            continue;
        }
        let blocked = hazard_that_blocks(&index, &trivia, sequence.id).map(|hazard| hazard.kind);
        let flow = inside_flow(&index, sequence.id);
        let before = stream_shape(&index, None);
        let lines: Vec<ByteSpan> = items
            .iter()
            .map(|item| item_lines(source, &index, *item, body_offset))
            .collect();
        let hulls: Vec<ByteSpan> = lines
            .iter()
            .map(|span| hull_lines(source, &index, *span, body_offset))
            .collect();

        for (from, item) in items.iter().enumerate() {
            if from % stride != 0 {
                continue;
            }
            let Ok(path) = path_to(&index, *item) else {
                continue;
            };
            for destination in destinations(items.len(), stride > 1) {
                let label = format!(
                    "{name} sequence {} item {from} -> {destination:?}",
                    sequence.id.get()
                );
                let derived = derive(
                    source,
                    &index,
                    &trivia,
                    items,
                    &lines,
                    &hulls,
                    from,
                    destination,
                    body_offset,
                );
                match move_item(source, &path, destination) {
                    Ok(patched) => {
                        assert!(
                            blocked.is_none() && !flow,
                            "{label}: applied although refused"
                        );
                        check_applied(
                            &label,
                            source,
                            &index,
                            &trivia,
                            &patched,
                            &before,
                            sequence.id,
                            items.len(),
                            from,
                            &derived,
                            &owned_comments,
                        );
                        tally.moved += 1;
                    }
                    Err(error) => classify(
                        &label,
                        &error,
                        &Derived {
                            blocked,
                            flow,
                            ..derived
                        },
                        &mut tally,
                    ),
                }
            } // End of the loop over this item's destinations
        } // End of the loop over the sequence's items
    } // End of the loop over every sequence of the document

    tally
} // End of function audit()

/// Re-derives every fact one attempted move could be refused for.
#[allow(clippy::too_many_arguments)]
fn derive(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    items: &[NodeId],
    lines: &[ByteSpan],
    hulls: &[ByteSpan],
    from: usize,
    destination: Option<usize>,
    body_offset: usize,
) -> Derived {
    let anchor = destination.unwrap_or(0);
    let destination_exists = anchor < items.len();
    let to = match destination {
        None => 0,
        Some(index) if index < from => index + 1,
        Some(index) => index,
    };
    let hull = hulls[from];
    let preserved = preserved_by_the_rule(source, trivia, hull, body_offset);
    let runs = runs_between(hull, &preserved);
    // The engine derives the destination from the anchor's ownership hull; this
    // file derives it from the anchor's own lines, found textually.
    let point = if destination.is_none() {
        hulls[0].start
    } else if destination_exists {
        lines[anchor].end
    } else {
        source.len()
    };
    let carried_ends_a_line = source[..hull.end].ends_with(['\n', '\r']);
    // The destination is the end of a document that does not end in a line break,
    // which is the one place a move would have to give an **untouched** line a
    // terminator. Derived from the document, never from `insertion_point`'s own
    // second answer.
    let destination_ends_the_file = destination.is_some()
        && destination_exists
        && point == source.len()
        && !source.ends_with(['\n', '\r']);

    Derived {
        blocked: None,
        flow: false,
        same_place: destination_exists && to == from,
        to,
        destination_exists,
        owns_its_lines: item_owns_its_lines(
            source,
            index,
            items[from],
            hulls[from],
            lines[from],
            body_offset,
        ) && (destination.is_some()
            || item_owns_its_lines(source, index, items[0], hulls[0], lines[0], body_offset)),
        kept_block: runs.iter().any(|run| kept_block_above(source, index, *run)),
        file_comment: runs.iter().find_map(|run| file_comment_in(trivia, *run)),
        moved_kept_block: moved_block_would_change(source, index, hull, point),
        source_keeps_a_block: !preserved.is_empty()
            && first_column_among(source, &preserved, body_offset)
                .is_some_and(|column| block_would_absorb(source, index, runs[0].start, column)),
        seam_source_closes: preserved.is_empty()
            && first_column_from(source, hull.end, body_offset)
                .is_some_and(|column| block_would_absorb(source, index, hull.start, column)),
        seam_arrival_lands: first_column_among(source, &runs, body_offset)
            .is_some_and(|column| block_would_absorb(source, index, point, column)),
        seam_arrival_closes: first_column_from(source, point, body_offset)
            .is_some_and(|column| block_would_absorb(source, index, hull.end, column)),
        // The internal seams, one per adjacent pair of runs. Derived here from
        // this file's own run set rather than from the engine's, so the "three
        // seams" claim the Phase 0c-3b-2a review disproved cannot be restated by
        // the oracle that is supposed to check it.
        seam_runs_join: (1..runs.len()).any(|after| {
            first_column_among(source, &runs[after..], body_offset).is_some_and(|column| {
                block_would_absorb(source, index, runs[after - 1].end, column)
            })
        }),
        line_ending: !carried_ends_a_line && !destination_ends_the_file,
        final_line: destination_ends_the_file,
        point,
        hull,
    }
} // End of function derive()

/// Files one refusal, asserting the document justifies it independently.
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
        EditError::MoveChangesNothing { .. } => {
            assert!(
                derived.same_place,
                "{label}: the move would change the sequence's order"
            );
            tally.same_place += 1;
        }
        EditError::NoSuchDestinationItem { .. } => {
            assert!(
                !derived.destination_exists,
                "{label}: the sequence does have that item"
            );
            tally.no_such_item += 1;
        }
        EditError::EntryDoesNotOwnItsLines { .. } => {
            assert!(
                !derived.owns_its_lines,
                "{label}: the item does begin its own line, so the refusal is unjustified"
            );
            tally.shares_a_line += 1;
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
                panic!("{label}: no file-owned comment lies in a run of the envelope")
            });
            assert_eq!(
                found, *comment,
                "{label}: the refusal names a different comment than the document does"
            );
            tally.file_comment += 1;
        }
        EditError::RemovalWouldExtendABlockScalar { .. } => {
            assert!(
                derived.source_keeps_a_block,
                "{label}: nothing is kept, or no block scalar's content ends above it"
            );
            tally.source_keeps_a_block += 1;
        }
        EditError::MoveWouldExtendAKeptBlock { .. } => {
            assert!(
                derived.moved_kept_block,
                "{label}: the item does not end in a block whose value the move could change"
            );
            tally.moved_kept_block += 1;
        }
        EditError::MoveWouldInventALineEnding { .. } => {
            assert!(
                derived.line_ending,
                "{label}: the item's bytes end with a line break, so nothing is invented"
            );
            tally.line_ending += 1;
        }
        EditError::MoveWouldTerminateTheFinalLine { .. } => {
            assert!(
                derived.final_line,
                "{label}: the destination is not the unterminated end of the document"
            );
            tally.final_line += 1;
        }
        EditError::MoveWouldExtendABlockScalar { seam, .. } => match seam {
            MoveSeam::SourceCloses => {
                assert!(
                    derived.seam_source_closes,
                    "{label}: nothing rises under a block when the source closes"
                );
                tally.seam_source_closes += 1;
            }
            MoveSeam::ArrivalLands => {
                assert!(
                    derived.seam_arrival_lands,
                    "{label}: the item's first line lands under no block"
                );
                tally.seam_arrival_lands += 1;
            }
            MoveSeam::ArrivalCloses => {
                assert!(
                    derived.seam_arrival_closes,
                    "{label}: nothing follows the destination that a block could take"
                );
                tally.seam_arrival_closes += 1;
            }
            MoveSeam::CarriedRunsJoin => {
                assert!(
                    derived.seam_runs_join,
                    "{label}: no two carried runs meet over a block that would take the join"
                );
                tally.seam_runs_join += 1;
            }
        },
        other => panic!("{label}: unexpected outcome {other}"),
    }
} // End of function classify()

/// Re-checks an applied move against the candidate, from the outside.
#[allow(clippy::too_many_arguments)]
fn check_applied(
    label: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    patched: &PatchedDocument,
    before: &str,
    sequence: NodeId,
    items: usize,
    from: usize,
    derived: &Derived,
    owned_comments: &[(String, usize)],
) {
    assert!(
        !derived.same_place && derived.destination_exists && derived.owns_its_lines,
        "{label}: applied although the document says it should have been refused"
    );
    check_candidate_is_the_splice(label, source, patched);

    let mut runs = Vec::new();
    let mut arrivals = Vec::new();
    for replacement in patched.replacements() {
        if replacement.text.is_empty() {
            runs.push(replacement.span);
        } else {
            arrivals.push(replacement);
        }
    } // End of the loop that splits the departure from the arrival
    assert_eq!(arrivals.len(), 1, "{label}: a move writes bytes once");
    let arrival = arrivals[0];
    assert_eq!(
        arrival.span.start, derived.point,
        "{label}: the move wrote its bytes somewhere other than where the document puts them"
    );
    assert!(
        !derived.kept_block
            && derived.file_comment.is_none()
            && !derived.source_keeps_a_block
            && !derived.moved_kept_block
            && !derived.seam_source_closes
            && !derived.seam_arrival_lands
            && !derived.seam_arrival_closes
            && !derived.seam_runs_join
            && !derived.line_ending
            && !derived.final_line,
        "{label}: applied although the document justifies a refusal \
         (keep {} file-comment {} r23 {} moved-keep {} seam1 {} seam2 {} seam3 {} seam4 {} \
          break {} eof {})",
        derived.kept_block,
        derived.file_comment.is_some(),
        derived.source_keeps_a_block,
        derived.moved_kept_block,
        derived.seam_source_closes,
        derived.seam_arrival_lands,
        derived.seam_arrival_closes,
        derived.seam_runs_join,
        derived.line_ending,
        derived.final_line
    );

    // **The envelope from the other side.** Property 5 of `check_source_runs`
    // only sees a run that reaches into a *node*; a run that carries away one
    // extra blank line reaches into nothing, conserves the document's lines and
    // changes no decoded value, so nothing else in this file would see it. The
    // item's own lines, found textually here, are what bound it.
    for run in &runs {
        assert!(
            derived.hull.contains(*run),
            "{label}: the envelope run {}..{} reaches outside the item's own lines {}..{}",
            run.start,
            run.end,
            derived.hull.start,
            derived.hull.end
        );
    } // End of the loop that bounds every run by the item's own lines
    check_source_runs(
        label,
        source,
        index,
        trivia,
        &runs,
        sequence_item(index, sequence, from),
    );
    check_arrival_point(label, source, index, arrival.span);
    check_the_arrival_is_the_departure(label, source, &runs, arrival);
    check_lines_are_conserved(label, source, patched.text());

    // The whole-document property: every construct the move did not name still
    // decodes to what it decoded to before, with the sequence permuted as asked.
    let candidate = SyntaxIndex::parse(patched.text())
        .unwrap_or_else(|error| panic!("{label}: the candidate does not parse: {error}"));
    let order = intended_order(items, from, derived.to);
    let expected = stream_shape(index, Some((sequence, &order)));
    assert!(
        expected == stream_shape(&candidate, None),
        "{label}: a construct the move did not name is not what it was"
    );
    assert!(
        before == stream_shape(index, None),
        "{label}: the original index changed under the sweep"
    );

    if let Some(at) = lost_file_comment(owned_comments, patched.text()) {
        panic!("{label}: the file-owned comment at byte {at} was deleted");
    }
} // End of function check_applied()

/// The identifier of the sequence's `position`-th item.
fn sequence_item(index: &SyntaxIndex, sequence: NodeId, position: usize) -> NodeId {
    index
        .node(sequence)
        .and_then(|node| node.children.get(position).copied())
        .expect("the sequence has that item")
} // End of function sequence_item()

// ---------------------------------------------------------------------------
// The corpus-wide tests
// ---------------------------------------------------------------------------

/// Column headings for the printed tables, in [`Tally`] declaration order.
const HEADINGS: &str = "   mov  gate  flow  same  none  line  keep  cmnt   r23  mkeep seam1 \
                        seam2 seam3 seam4   brk   eof";

/// One tally's sixteen numbers, formatted under [`HEADINGS`].
fn columns(tally: &Tally) -> String {
    format!(
        "{:>6} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>5} {:>6} {:>5} {:>5} {:>5} {:>5} \
         {:>5} {:>5}",
        tally.moved,
        tally.refused_by_the_gate,
        tally.flow,
        tally.same_place,
        tally.no_such_item,
        tally.shares_a_line,
        tally.kept_block,
        tally.file_comment,
        tally.source_keeps_a_block,
        tally.moved_kept_block,
        tally.seam_source_closes,
        tally.seam_arrival_lands,
        tally.seam_arrival_closes,
        tally.seam_runs_join,
        tally.line_ending,
        tally.final_line
    )
} // End of function columns()

#[test]
fn every_sequence_item_of_the_synthetic_corpus_moves_or_is_refused_for_a_derivable_reason() {
    let files = synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus must be present");
    assert_eq!(
        files.len(),
        SYNTHETIC_MOVE_OUTCOMES.len(),
        "every fixture needs a pinned move-outcome row"
    );

    println!("\n--- attempted moves per synthetic fixture ---");
    println!("{:<40} {:>6}  {}", "fixture", "total", HEADINGS);
    let mut total = Tally::default();
    for file in &files {
        let tally = audit(&file.name, &file.source, 1);
        println!(
            "{:<40} {:>6}  {}",
            file.name,
            tally.total(),
            columns(&tally)
        );
        let base = file.name.rsplit('/').next().unwrap_or(&file.name);
        let row = SYNTHETIC_MOVE_OUTCOMES
            .iter()
            .find(|row| row.0 == base)
            .unwrap_or_else(|| panic!("{} has no pinned move-outcome row", file.name));
        assert_eq!(
            tally,
            Tally::from_row(row.1),
            "{}: move-outcome split",
            file.name
        );
        total.add(&tally);
    } // End of the loop over the valid synthetic fixtures

    println!(
        "synthetic: {} attempted moves\n{}\n{}",
        total.total(),
        HEADINGS,
        columns(&total)
    );
    assert_eq!(
        total.total(),
        SYNTHETIC_MOVE_OUTCOMES
            .iter()
            .map(|row| row.1.iter().sum::<usize>())
            .sum::<usize>(),
        "the pinned rows must add up to the pinned total"
    );
    // An engine that refused every move satisfies every refusal assertion above
    // and fails here.
    assert!(total.moved > 500, "the move is not reaching the corpus");
    // Every refusal family must be reached by the corpus, or its assertion is a
    // statement about nothing.
    assert!(total.refused_by_the_gate > 0);
    assert!(total.same_place > 0);
    assert!(total.no_such_item > 0);
    assert!(
        total.line_ending > 0,
        "no fixture offers a move of an unterminated last line"
    );
    assert!(
        total.final_line > 0,
        "no fixture offers a move to the unterminated end of a document"
    );
    assert!(
        total.seam_source_closes > 0 && total.seam_arrival_lands > 0,
        "the move's block-scalar seams are unreached"
    );
    assert!(
        total.seam_arrival_closes > 0,
        "no fixture offers a move whose own tail would swallow what follows it"
    );
    assert!(
        total.seam_runs_join > 0,
        "no fixture offers a move whose carried runs meet over a block scalar"
    );
    // R23 reached by a move. Phase 0c-3b-2a pinned this at zero and said plainly
    // that the zero was a coverage hole rather than a proof; its review asked for
    // the fixture, on both sides of the condition, and this is it.
    assert!(
        total.source_keeps_a_block > 0,
        "R23 is unreached by any move, so its assertion is a statement about nothing"
    );
    assert!(
        total.kept_block > 0 && total.moved_kept_block > 0,
        "the keep-chomping refusals are unreached from both sides"
    );
    // Inherited from the removal, and inherited pinned at zero for the reason
    // recorded there: the punch-out removes whole lines, so a derived run cannot
    // cover a comment the file owns.
    assert_eq!(
        total.file_comment, 0,
        "a derived run can no longer cover a comment the file owns"
    );
    // **One pinned zero that is a coverage hole rather than a proof**, named as
    // such rather than left to look like a property. `shares_a_line` needs a
    // sequence item nested directly inside another sequence item, which neither
    // corpus contains — a **compact nested sequence**, `- - first`, whose inner
    // item has the outer dash before its own. The refusal is *inherited* from the
    // removal, where the corpus does reach it, and
    // `a_sequence_item_that_shares_its_line_is_refused` drives it here from a
    // hand-written document, pinning the safe side beside it. It is reachable and
    // reached by a unit test rather than by a fixture, which is weaker than corpus
    // coverage and is recorded as such.
    assert_eq!(total.shares_a_line, 0, "see the note above this assertion");
} // End of function every_sequence_item_of_the_synthetic_corpus_moves_or_is_refused_for_a_derivable_reason()

#[test]
fn every_sequence_item_of_the_real_corpus_moves_or_is_refused_for_a_derivable_reason() {
    let files = real_corpus();
    if skip_without_real_corpus("real corpus moves", &files) {
        return;
    }

    let mut total = Tally::default();
    for file in &files {
        SyntaxIndex::parse(&file.source)
            .unwrap_or_else(|error| panic!("{}: expected a valid file, got {error}", file.name));
        total.add(&audit(&file.name, &file.source, REAL_CORPUS_STRIDE));
    } // End of the loop over the real corpus

    // No count from private data is hard-coded (`PROGRESS.md`, D1). What is
    // asserted is the shape of the result: real matches can be reordered, and
    // every refusal was justified from the document by `audit` itself.
    println!(
        "real: {} files, {} attempted moves\n{}\n{}",
        files.len(),
        total.total(),
        HEADINGS,
        columns(&total)
    );
    assert!(total.moved > 0, "no real match could be moved");
} // End of function every_sequence_item_of_the_real_corpus_moves_or_is_refused_for_a_derivable_reason()

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

/// Moves one match of a fixture and returns the candidate text.
fn moved(name: &str, item: usize, after: Option<usize>) -> String {
    let file = fixture(name);
    let path = DocumentPath::parse(&format!("matches[{item}]")).expect("the path parses");
    move_item(&file.source, &path, after)
        .unwrap_or_else(|error| panic!("{name}: matches[{item}] must move: {error}"))
        .into_text()
} // End of function moved()

#[test]
fn a_move_carries_the_matchs_own_comments_and_leaves_the_files_where_they_are() {
    // The whole of `move-a-match.yml` in one assertion. The first match owns a
    // leading comment block and an inline comment, and both travel; the second
    // holds a comment the ownership rules give to the FILE, and it stays exactly
    // where it is while the match around it goes.
    let text = moved("move-a-match.yml", 0, Some(2));
    assert!(
        text.contains(
            "  - trigger: ':leading-comment'\n    replace: 'the block above travels with me'  \
             # and so does this inline comment\n"
        ),
        "the match must arrive with its inline comment"
    );
    assert!(
        text.contains(
            "  # This comment block introduces the match below and is not separated from it\n"
        ),
        "the leading comment block must travel with the match"
    );
    assert!(
        text.starts_with("# Phase 0c-3b-2a: what travels with a match when it moves"),
        "the file's own header comment must stay at the top"
    );
    assert_eq!(
        text.matches("# A blank line on either side makes this comment the FILE's")
            .count(),
        1,
        "the file-owned comment must still be there exactly once"
    );

    // …and now the match that *holds* the file's comment moves away from it.
    let text = moved("move-a-match.yml", 1, None);
    assert!(
        text.contains(
            "matches:\n  - trigger: ':interior-file-comment'\n    vars:\n      first: 'one'\n"
        ),
        "the match must arrive at the front without the comment it did not own"
    );
    assert!(
        text.contains(
            "      # A blank line on either side makes this comment the FILE's rather than\n"
        ),
        "the file's comment must survive the move"
    );
    assert!(
        !text.contains("first: 'one'\n\n      # A blank line on either side"),
        "the file's comment must NOT have travelled with the match"
    );
} // End of function a_move_carries_the_matchs_own_comments_and_leaves_the_files_where_they_are()

#[test]
fn a_move_in_a_crlf_document_writes_only_crlf() {
    let file = fixture("crlf-line-endings.yml");
    let text = moved("crlf-line-endings.yml", 2, None);
    let bare = text.matches('\n').count() - text.matches("\r\n").count();
    assert_eq!(bare, 0, "a move must not introduce a bare line feed");
    assert_eq!(
        text.matches("\r\n").count(),
        file.source.matches("\r\n").count(),
        "a move must neither create nor destroy a CRLF pair"
    );
    assert!(text.contains("matches:\r\n  - trigger: :crlf-quoted\r\n"));
} // End of function a_move_in_a_crlf_document_writes_only_crlf()

#[test]
fn a_move_in_a_bom_document_never_touches_the_bom() {
    let file = fixture("bom-utf8.yml");
    assert!(file.has_bom());
    let path = DocumentPath::parse("matches[1]").expect("the path parses");
    let patched = move_item(&file.source, &path, None).expect("the move applies");
    assert!(patched.text().starts_with('\u{feff}'));
    for replacement in patched.replacements() {
        assert!(replacement.span.start >= 3, "no move may touch the BOM");
    }
} // End of function a_move_in_a_bom_document_never_touches_the_bom()

#[test]
fn a_move_to_the_end_of_an_unterminated_document_is_refused_rather_than_rotated() {
    // `file-comments-and-mixed-endings.yml` ends without a line break, and it is
    // exactly the byte shape the Phase 0c-3b-2a review used: bare-LF lines, two
    // CRLF ones, and a final line with no terminator at all.
    //
    // Phase 0c-3b-2a answered this destination by carrying the moved match's own
    // trailing break round to the front, so that the document kept not ending in
    // one. Every whole-document property certified that — the byte count, the line
    // multisets, the tree and the permutation are all unchanged — and it is still
    // wrong: the break lands on the **destination's** previously unterminated last
    // line, which the move never named, and here that break is a CRLF in a file
    // that is mostly LF. D2p answers a destination with no local break by refusing.
    let file = fixture("file-comments-and-mixed-endings.yml");
    assert!(!file.source.ends_with(['\n', '\r']));
    let path = DocumentPath::parse("matches[1]").expect("the path parses");
    assert!(
        matches!(
            move_item(&file.source, &path, Some(2)),
            Err(EditError::MoveWouldTerminateTheFinalLine { .. })
        ),
        "the unterminated end of the file is not a destination a move may use"
    );
    // The same match moves to the front, where a break already ends the line the
    // bytes land on, so what is refused is the destination and not the match.
    let text = moved("file-comments-and-mixed-endings.yml", 1, None);
    assert!(
        !text.ends_with(['\n', '\r']),
        "the document must still end without a line break"
    );
    assert_eq!(
        text.matches("\r\n").count(),
        file.source.matches("\r\n").count(),
        "the two CRLF lines must survive as CRLF"
    );
    assert_eq!(
        text.len(),
        file.source.len(),
        "a move must not change the document's length"
    );
} // End of function a_move_to_the_end_of_an_unterminated_document_is_refused_rather_than_rotated()

#[test]
fn a_match_that_ends_an_unterminated_document_is_refused_rather_than_given_a_break() {
    // The other side of the same condition: the last match of a document with no
    // final break has no terminator of its own, so writing it anywhere but the end
    // would need one this crate never invents (D2p).
    for (name, item) in [
        ("file-comments-and-mixed-endings.yml", 2usize),
        ("block-scalar-terminal-spaces.yml", 1usize),
    ] {
        let file = fixture(name);
        let path = DocumentPath::parse(&format!("matches[{item}]")).expect("the path parses");
        assert!(
            matches!(
                move_item(&file.source, &path, None),
                Err(EditError::MoveWouldInventALineEnding { .. })
            ),
            "{name}: the unterminated last match must be refused"
        );
    } // End of the loop over the two documents that end without a line break
} // End of function a_match_that_ends_an_unterminated_document_is_refused_rather_than_given_a_break()

#[test]
fn the_terminal_spaces_fixture_offers_no_move_at_all_and_says_why() {
    // R11's fixture has exactly two matches and **no final line break**, so both
    // of its moves are refused and for two different reasons — which is the point
    // of counting the two refusals apart:
    //
    // - moving the first match past the second puts it at the unterminated end of
    //   the document, where writing it would terminate a line the move never
    //   named (`MoveWouldTerminateTheFinalLine`);
    // - moving the second match anywhere asks for a break it does not carry,
    //   because its own bytes end at end of source (`MoveWouldInventALineEnding`).
    //
    // Phase 0c-3b-2a applied the first of those by rotating the break, and this
    // test used to pin the resulting bytes. Its review showed the rotation
    // rewrites an untouched line's terminator; the cost of refusing it is that
    // this file now offers no relocation at all, recorded here rather than hidden.
    let file = fixture("block-scalar-terminal-spaces.yml");
    assert!(!file.source.ends_with(['\n', '\r']));
    let first = DocumentPath::parse("matches[0]").expect("the path parses");
    assert!(matches!(
        move_item(&file.source, &first, Some(1)),
        Err(EditError::MoveWouldTerminateTheFinalLine { .. })
    ));
    let second = DocumentPath::parse("matches[1]").expect("the path parses");
    assert!(matches!(
        move_item(&file.source, &second, None),
        Err(EditError::MoveWouldInventALineEnding { .. })
    ));
    assert!(
        file.source
            .contains("      two real spaces end this line  "),
        "the two terminal spaces are what the fixture exists for"
    );
} // End of function the_terminal_spaces_fixture_offers_no_move_at_all_and_says_why()

#[test]
fn the_internal_seam_is_refused_and_its_shallow_twin_applies() {
    // `move-run-joins.yml`, the Phase 0c-3b-2a review's finding 3. Both matches
    // have the same two-run envelope, split by the same file-owned comment; they
    // differ only in the column of the comment the second run begins with.
    let file = fixture("move-run-joins.yml");
    let path = DocumentPath::parse("matches[0]").expect("the path parses");
    match move_item(&file.source, &path, Some(1)) {
        Err(EditError::MoveWouldExtendABlockScalar { seam, .. }) => {
            assert_eq!(
                seam,
                MoveSeam::CarriedRunsJoin,
                "the join the runs create is not one of the three external seams"
            );
        }
        other => panic!("the column-seven join must be refused, got {other:?}"),
    }

    // The shallow twin moves, and the file-owned comment stays where it was while
    // the two runs around it travel.
    let text = moved("move-run-joins.yml", 1, Some(2));
    assert_eq!(
        text.matches(
            "    # A leading comment at column four, too shallow to become block content."
        )
        .count(),
        1,
        "the shallow leading comment must travel exactly once"
    );
    assert!(
        text.contains(
            "      # The same file-owned comment, splitting this envelope into the same two\n"
        ),
        "the file's comment must stay behind, byte for byte"
    );
} // End of function the_internal_seam_is_refused_and_its_shallow_twin_applies()

#[test]
fn a_kept_comment_that_would_join_the_block_above_refuses_the_move() {
    // `move-kept-comment-joins-a-block.yml`: R23 reached by a move, with the safe
    // side beside it. The two matches differ only in the column of the comment the
    // file owns inside them.
    let file = fixture("move-kept-comment-joins-a-block.yml");
    let deep = DocumentPath::parse("matches[1]").expect("the path parses");
    assert!(
        matches!(
            move_item(&file.source, &deep, Some(3)),
            Err(EditError::RemovalWouldExtendABlockScalar { .. })
        ),
        "a comment kept at the block's own body column must refuse the move"
    );
    let shallow = DocumentPath::parse("matches[3]").expect("the path parses");
    let text = move_item(&file.source, &shallow, Some(0))
        .expect("the column-two comment ends the block instead of joining it")
        .into_text();
    assert!(
        text.contains(
            "  # The same file-owned comment at column TWO, which ends the block above rather\n"
        ),
        "the file's comment must stay exactly where it was"
    );
    assert_eq!(
        text.len(),
        file.source.len(),
        "a move must not change the document's length"
    );
} // End of function a_kept_comment_that_would_join_the_block_above_refuses_the_move()

#[test]
fn the_three_seams_are_refused_and_their_safe_twins_apply() {
    // `move-block-scalar-seams.yml` pins each seam from both sides, and the two
    // cases of each pair differ only in a comment's column.
    let file = fixture("move-block-scalar-seams.yml");
    let seam_of = |item: usize, after: Option<usize>| {
        let path = DocumentPath::parse(&format!("matches[{item}]")).expect("the path parses");
        match move_item(&file.source, &path, after) {
            Err(EditError::MoveWouldExtendABlockScalar { seam, .. }) => Some(seam),
            Err(error) => panic!("matches[{item}] -> {after:?}: unexpected refusal {error}"),
            Ok(_) => None,
        }
    };

    // Seam 1: moving `:between-a` away lets the column-five comment below it rise
    // under the block above. Moving `:between-b` away lets the column-two comment
    // rise under the other block, which ends it instead.
    assert_eq!(seam_of(1, None), Some(MoveSeam::SourceCloses));
    assert_eq!(seam_of(4, None), None);
    // Seam 2: `:deep-lead` arrives under a block carrying its own column-five
    // comment; `:shallow-lead` arrives at the same place carrying a column-two
    // one.
    assert_eq!(seam_of(2, Some(0)), Some(MoveSeam::ArrivalLands));
    assert_eq!(seam_of(5, Some(0)), None);
    // Seam 3: `:block-tail-a` arrives above the column-five comment, which would
    // become its own block's content; `:block-tail-b` arrives above the
    // column-two one, which ends its block.
    assert_eq!(seam_of(0, Some(1)), Some(MoveSeam::ArrivalCloses));
    assert_eq!(seam_of(3, Some(4)), None);
} // End of function the_three_seams_are_refused_and_their_safe_twins_apply()

#[test]
fn a_move_may_not_share_a_batch_with_any_other_edit() {
    // The restriction that keeps the whole-document expectation an oracle: it is
    // the original document plus one permutation, and a second edit would have to
    // be modelled inside it.
    let file = fixture("move-a-match.yml");
    let move_only: DocumentEdit =
        ItemMove::after(DocumentPath::parse("matches[0]").unwrap(), 2).into();
    assert!(
        apply_edits(&file.source, std::slice::from_ref(&move_only)).is_ok(),
        "a batch of one move applies"
    );

    let scalar: DocumentEdit = ScalarEdit::new(
        DocumentPath::parse("matches[2].replace").unwrap(),
        "something else",
    )
    .into();
    assert!(
        matches!(
            apply_edits(&file.source, &[move_only.clone(), scalar.clone()]),
            Err(EditError::MoveMustBeTheOnlyEditInItsBatch { edits: 2, .. })
        ),
        "a move must not share a batch with a scalar edit"
    );
    assert!(
        matches!(
            apply_edits(&file.source, &[scalar, move_only.clone()]),
            Err(EditError::MoveMustBeTheOnlyEditInItsBatch { edits: 2, .. })
        ),
        "the order of the batch does not change the answer"
    );
    let second: DocumentEdit =
        ItemMove::after(DocumentPath::parse("matches[1]").unwrap(), 2).into();
    assert!(
        matches!(
            apply_edits(&file.source, &[move_only, second]),
            Err(EditError::MoveMustBeTheOnlyEditInItsBatch { edits: 2, .. })
        ),
        "two moves are two batches, because one permutation is what the invariant states"
    );
} // End of function a_move_may_not_share_a_batch_with_any_other_edit()

#[test]
fn a_sequence_item_that_shares_its_line_is_refused() {
    // The one refusal the move inherits that neither corpus reaches, driven from
    // a hand-written document rather than left as an unexplained zero: the inner
    // item of `- - a` has the outer dash before its own, so it owns no line of
    // its own and there is nothing to relocate without re-indenting a neighbour.
    let source = "outer:\n  - - first\n    - second\n  - - third\n    - fourth\n";
    let path = DocumentPath::parse("outer[0][1]").expect("the path parses");
    assert!(
        matches!(
            move_item(source, &path, None),
            Err(EditError::EntryDoesNotOwnItsLines { .. })
        ),
        "an item that shares its line with an outer dash must be refused"
    );
    // Its own outer item, which does begin its line, moves.
    let outer = DocumentPath::parse("outer[1]").expect("the path parses");
    assert!(
        move_item(source, &outer, None).is_ok(),
        "the outer item begins its own line and must move"
    );
} // End of function a_sequence_item_that_shares_its_line_is_refused()

#[test]
fn a_path_that_names_no_sequence_item_is_refused_by_name() {
    let file = fixture("move-a-match.yml");
    for path in ["matches", "matches[0].replace"] {
        let parsed = DocumentPath::parse(path).expect("the path parses");
        assert!(
            matches!(
                move_item(&file.source, &parsed, Some(0)),
                Err(EditError::NotASequenceItem { .. })
            ),
            "{path}: a move must name a sequence item"
        );
    } // End of the loop over the two paths that name no sequence item
    let root = DocumentPath::root(0);
    assert!(
        matches!(
            move_item(&file.source, &root, Some(0)),
            Err(EditError::NotASequenceItem { .. })
        ),
        "the document root is not a sequence item"
    );
} // End of function a_path_that_names_no_sequence_item_is_refused_by_name()
