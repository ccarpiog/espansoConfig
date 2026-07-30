//! Gap classification — Phase 0b-2.
//!
//! Phase 0b-1 published a frontier of `Scalar` and `Alias` spans and defined
//! everything between them as an unclassified byte range. This module turns
//! those ranges into **typed trivia items**, each with its own [`ByteSpan`], so
//! that no byte of a document is merely "not a node" any more.
//!
//! # It is a gap lexer, not a YAML lexer (`PROGRESS.md`, D2)
//!
//! The scanner never decides what a scalar is, because the substrate already
//! said. It only classifies what the substrate does not report: comments, blank
//! lines, block-scalar headers, anchor and tag spelling, structural punctuation,
//! directives and the BOM. Two of those it does not even lex itself — the
//! block-scalar header span comes from [`crate::syntax::block`] and the
//! `---`/`...` marker spans from the document nodes, both of which Phase 0b-1
//! already established. Re-lexing either would be a second opinion that could
//! disagree with the first.
//!
//! # The tiling property
//!
//! For every gap, the items the scanner produces are contiguous, ordered and
//! disjoint, and together they cover the gap exactly. Combined with Phase
//! 0b-1's reconstruction property that means **every byte of a document belongs
//! to exactly one frontier leaf or exactly one trivia item**. Anything the
//! scanner cannot name becomes a [`TriviaKind::Unclassified`] item rather than
//! being silently absorbed into a neighbour, so a gap in our understanding is
//! visible, countable and testable instead of invisible.
//!
//! # Ownership
//!
//! Classification is only half the job. Which node a comment, a `-` or a `&`
//! belongs to is decided by the `ownership` module, under the rules in
//! `IMPLEMENTATION_PLAN.md` section 6.2, and the answer is recorded in
//! [`TriviaItem::owner`] and [`TriviaIndex::comments`].

use crate::syntax::node::NodeId;
use crate::syntax::ownership;
use crate::syntax::{ByteSpan, SyntaxIndex};

/// What a run of gap bytes is.
///
/// The list is deliberately closed and the fallback is explicit: anything the
/// scanner does not recognise becomes [`TriviaKind::Unclassified`], never a
/// silently widened neighbour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TriviaKind {
    /// The UTF-8 byte-order mark, which is always the first gap of a document
    /// that has one.
    Bom,
    /// A `#` comment, from the `#` to the end of its line. The terminating line
    /// break is a separate [`TriviaKind::LineBreak`] item, because a comment on
    /// the last line of a file may have none.
    Comment,
    /// A whole physical line that holds nothing but spaces and tabs, its line
    /// break included.
    ///
    /// Only a line that lies **entirely** inside one gap can be blank: a line
    /// that a frontier leaf shares cannot be, by definition. Consecutive blank
    /// lines are also grouped into [`BlankRun`]s, because the comment-ownership
    /// rules turn on "separated by a blank line".
    BlankLine,
    /// A line break — `\n`, `\r\n` or a bare `\r` — that terminates a line with
    /// content on it.
    LineBreak,
    /// Horizontal whitespace at the start of a line: YAML indentation.
    Indentation,
    /// Horizontal whitespace that is not at the start of a line, such as the
    /// space in `key: value`.
    Spacing,
    /// A block-scalar header as `crate::syntax::block` lexed it: `|`, `>-`,
    /// `|2+` and so on. The rest of the header line is ordinary spacing and
    /// comment trivia.
    BlockScalarHeader,
    /// An anchor definition, `&` included. The substrate reports only a numeric
    /// anchor identity, never the spelling, so this is the only place the name
    /// exists.
    Anchor,
    /// A tag shorthand or verbatim tag as written: `!!str`, `!custom`,
    /// `!<tag:example.com,2000:x>`.
    ///
    /// Both spellings are lexed as **one** item. A shorthand ends at the first
    /// character YAML forbids in a tag name — a space or a flow indicator — and
    /// a verbatim `!<…>` tag ends at its closing `>`, so the comma inside
    /// `!<tag:example.com,2000:x>` cannot split it into three pieces.
    Tag,
    /// A `%YAML` or `%TAG` directive line.
    Directive,
    /// A `---` or `...` document marker, taken from the document node rather
    /// than re-lexed.
    DocumentMarker,
    /// Structural punctuation.
    Punctuation(Punctuation),
    /// Bytes the scanner could not name.
    ///
    /// Recorded rather than dropped so the reconstruction property stays
    /// provable and the size of our ignorance stays measurable. Every one of
    /// these also raises [`HazardKind::UnclassifiedTrivia`], so Phase 0c
    /// refuses to edit around bytes we do not understand.
    Unclassified,
} // End of enum TriviaKind

/// The structural punctuation a gap can contain.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Punctuation {
    /// The `-` that introduces a block sequence item.
    SequenceDash,
    /// The `:` that separates a mapping key from its value.
    Colon,
    /// The `?` of an explicit key.
    ExplicitKey,
    /// The `,` between two entries of a flow collection.
    Comma,
    /// `[`
    FlowSequenceOpen,
    /// `]`
    FlowSequenceClose,
    /// `{`
    FlowMappingOpen,
    /// `}`
    FlowMappingClose,
}

/// One classified range of gap bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TriviaItem {
    /// Where the item lives, in original-document byte coordinates.
    pub span: ByteSpan,
    /// What it is.
    pub kind: TriviaKind,
    /// The node this item belongs to, when a rule assigns one.
    ///
    /// Whitespace, line breaks and the BOM belong to nobody: they are the
    /// document's layout, not any node's. Comments, punctuation, anchors and
    /// tags do get an owner, decided by the `ownership` module.
    pub owner: Option<NodeId>,
}

impl TriviaItem {
    /// Builds an unowned item. Ownership is assigned in a later pass.
    fn new(span: ByteSpan, kind: TriviaKind) -> TriviaItem {
        TriviaItem {
            span,
            kind,
            owner: None,
        }
    }

    /// Returns `true` when this item is a comment.
    pub fn is_comment(&self) -> bool {
        self.kind == TriviaKind::Comment
    }
}

/// A maximal run of consecutive blank lines.
///
/// The ownership rules speak of a comment being "separated by one or more blank
/// lines", so the run — not the individual line — is the unit that decides.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlankRun {
    /// The bytes the whole run covers, every line break included.
    pub span: ByteSpan,
    /// How many blank lines the run holds.
    pub lines: usize,
}

/// Which of the ownership rules decided a comment's owner.
///
/// Recorded so that each rule in `IMPLEMENTATION_PLAN.md` section 6.2 is
/// individually observable, and therefore individually testable, instead of
/// only its outcome being visible.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OwnershipRule {
    /// Rule 1 — contiguous comments immediately above an item, with no blank
    /// line between, belong to that item.
    LeadingBlock,
    /// Rule 2 — a comment separated from what follows by one or more blank
    /// lines belongs to the file.
    BlankLineSeparated,
    /// Rule 3 — a comment on the same line as content belongs to that entry.
    Inline,
    /// Rule 4 — comments before the first top-level key belong to the file and
    /// never to the first match.
    FileHeader,
    /// Policy — a comment with nothing after it in the document belongs to the
    /// file.
    TrailingFile,
    /// Policy — a comment inside a flow collection belongs to that collection,
    /// which is flagged as unsafe to edit structurally (`PROGRESS.md`, R6).
    FlowInterior,
} // End of enum OwnershipRule

/// Who owns a comment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CommentOwner {
    /// The document as a whole. Moving or deleting any node leaves it where it
    /// is.
    File {
        /// Zero-based index of the document in the stream.
        document_index: usize,
    },
    /// A specific node. Moving that node takes the comment with it.
    Node(NodeId),
}

impl CommentOwner {
    /// The node that owns this comment, or `None` when the file does.
    pub fn node(self) -> Option<NodeId> {
        match self {
            CommentOwner::Node(id) => Some(id),
            CommentOwner::File { .. } => None,
        }
    }

    /// Returns `true` when the file owns the comment.
    pub fn is_file(self) -> bool {
        matches!(self, CommentOwner::File { .. })
    }
}

/// One comment and the owner the rules assigned it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CommentAttachment {
    /// The comment text itself, `#` included, line break excluded.
    pub span: ByteSpan,
    /// The contiguous comment block this comment is part of.
    ///
    /// Every comment of a block shares one owner, which is what rule 1 means by
    /// "contiguous comments". A lone comment is a block of one.
    pub block: ByteSpan,
    /// Who owns it.
    pub owner: CommentOwner,
    /// Which rule decided.
    pub rule: OwnershipRule,
}

/// A construct Phase 0c must refuse to edit visually rather than guess about.
///
/// These are structured values, never prose: the frontend decides what to say
/// about them through its own i18n layer (plan section 9).
///
/// # What the set is for
///
/// A hazard is not "something odd happened". It is the answer to one question:
/// **could rewriting these bytes change what the document means somewhere
/// else, or change which construct a later path resolves to?** Every variant
/// below is one of plan section 7's corruption hazards (rows 6, 7, 8 and 13) or
/// one of `PROGRESS.md`'s open risks, and plan section 13 defers visual editing
/// of anchors, aliases, tags and merge keys out of v1 entirely — so the gate
/// refuses them rather than modelling them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HazardKind {
    /// A comment sits inside a flow collection, where it belongs to no entry
    /// (`PROGRESS.md`, R6).
    ///
    /// The collection is refused outright, entries included. An earlier
    /// write-up claimed whole-collection replacement stayed legal; the gate
    /// never agreed, and the gate is the conservative answer that wins.
    CommentInFlowCollection,
    /// A mapping written in the explicit `? key` / `: value` form. Espanso
    /// never produces it, and its punctuation does not sit where the compact
    /// form's does, so the visual editor refuses it.
    ExplicitKeyMapping,
    /// A block scalar whose reported span swallowed its own header
    /// (`PROGRESS.md`, R5). Only reachable from incomplete input.
    TruncatedBlockScalarHeader,
    /// The scanner could not classify some bytes near this node.
    ///
    /// When the bytes fall outside every node, [`Hazard::node`] is `None` and
    /// the **whole document** becomes unsafe — see
    /// [`TriviaIndex::is_safely_editable`].
    UnclassifiedTrivia,
    /// The node carries an anchor definition (`&name`).
    ///
    /// Plan section 7 row 8: editing an anchored node silently changes the
    /// effective value of every alias that points at it, and moving or deleting
    /// it can leave those aliases dangling. Refused until Phase 0c becomes
    /// dependency-aware, which plan section 13 defers past v1.
    AnchorDefinition,
    /// The node is an alias reference (`*name`).
    ///
    /// Its value lives somewhere else in the document, so what a user sees is
    /// not what the bytes say. Refused for the same reason as
    /// [`HazardKind::AnchorDefinition`].
    AliasReference,
    /// A mapping contains a merge key (`<<`), which imports another mapping's
    /// entries (`PROGRESS.md`, R8).
    ///
    /// It arrives from the substrate as an ordinary plain scalar key, so it is
    /// classified **syntactically** here. Entries the merge contributes are
    /// written nowhere in the mapping, so adding, removing or reordering that
    /// mapping's entries cannot be reasoned about locally.
    MergeKey,
    /// A mapping has two entries with the same key.
    ///
    /// Plan section 7 row 7: parse-valid, compose-ambiguous, and parsers differ
    /// on which one wins. A visual path such as `matches[0].trigger` cannot say
    /// which occurrence it means, so the mapping is refused. The hazard's span
    /// is the **second** (and each later) occurrence.
    DuplicateMappingKey,
    /// The node carries an explicit tag (`!!str`, `!custom`).
    ///
    /// A tag changes how a scalar resolves and what a collection means, and the
    /// visual model has no representation for it, so it must not be treated as
    /// movable decoration. Plan section 13 defers visual tag editing past v1.
    ExplicitTag,
    /// The file holds more than one YAML document.
    ///
    /// Every path the visual model resolves is document-relative and every
    /// document node raises this, so the whole stream is refused until Phase 0c
    /// supports document-scoped paths and patching.
    MultiDocumentStream,
} // End of enum HazardKind

/// One hazard, with the bytes that raised it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hazard {
    /// What is wrong.
    pub kind: HazardKind,
    /// The bytes that raised it.
    pub span: ByteSpan,
    /// The node the hazard attaches to, when one could be identified.
    pub node: Option<NodeId>,
}

/// The classified contents of every gap of one document, plus attribution.
///
/// Build one with [`TriviaIndex::scan`]. Like [`SyntaxIndex`] it does not hold
/// the source; every accessor that needs text takes it as an argument.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TriviaIndex {
    /// Every item, in document order, tiling every gap exactly.
    items: Vec<TriviaItem>,
    /// Comments with their owners.
    comments: Vec<CommentAttachment>,
    /// Maximal runs of blank lines.
    blank_runs: Vec<BlankRun>,
    /// Constructs Phase 0c must refuse.
    hazards: Vec<Hazard>,
}

impl TriviaIndex {
    /// Classifies and attributes every gap of `index` over `source`.
    ///
    /// `source` must be the same original document `index` was parsed from,
    /// BOM included. Scanning cannot fail: bytes that resist classification
    /// become [`TriviaKind::Unclassified`] items and raise a hazard, which is
    /// strictly more informative than an error that discards the rest.
    pub fn scan(source: &str, index: &SyntaxIndex) -> TriviaIndex {
        let known = known_spans(index);
        let body_offset = index.preamble().body_offset;
        let mut items = Vec::new();
        for gap in index.gaps() {
            scan_gap(source, gap, &known, body_offset, &mut items);
        }
        let blank_runs = blank_runs(&items);
        let (comments, hazards) = ownership::attribute(source, index, &mut items);
        TriviaIndex {
            items,
            comments,
            blank_runs,
            hazards,
        }
    } // End of function scan()

    /// Every trivia item, in document order.
    pub fn items(&self) -> &[TriviaItem] {
        &self.items
    }

    /// Every comment with the owner the rules assigned it.
    pub fn comments(&self) -> &[CommentAttachment] {
        &self.comments
    }

    /// Maximal runs of consecutive blank lines, in document order.
    pub fn blank_runs(&self) -> &[BlankRun] {
        &self.blank_runs
    }

    /// Constructs Phase 0c must refuse to edit visually.
    pub fn hazards(&self) -> &[Hazard] {
        &self.hazards
    }

    /// Number of items of a given kind.
    pub fn count(&self, kind: TriviaKind) -> usize {
        self.items.iter().filter(|item| item.kind == kind).count()
    }

    /// The bytes the scanner could not name.
    pub fn unclassified(&self) -> impl Iterator<Item = &TriviaItem> {
        self.items
            .iter()
            .filter(|item| item.kind == TriviaKind::Unclassified)
    }

    /// Every item **directly** owned by `node`, and by no descendant of it.
    ///
    /// This is the *diagnostic* query: "which dash, colon, anchor or tag does
    /// the ownership rules table hand to this exact node?" It is **not** a move
    /// or delete envelope — use [`TriviaIndex::items_owned_by_subtree`] for
    /// that. In `- trigger: :a  # why` the comment is owned by the value
    /// scalar, not by the sequence item, so an envelope built from this query
    /// would move the item and strand the comment on the snippet below.
    pub fn items_owned_by(&self, node: NodeId) -> impl Iterator<Item = &TriviaItem> {
        self.items
            .iter()
            .filter(move |item| item.owner == Some(node))
    }

    /// Every comment **directly** owned by `node`, and by no descendant of it.
    ///
    /// The diagnostic counterpart of [`TriviaIndex::items_owned_by`], with the
    /// same warning: an envelope needs
    /// [`TriviaIndex::comments_owned_by_subtree`].
    pub fn comments_owned_by(&self, node: NodeId) -> impl Iterator<Item = &CommentAttachment> {
        self.comments
            .iter()
            .filter(move |comment| comment.owner.node() == Some(node))
    }

    /// Every item owned by `node` **or by any of its descendants**.
    ///
    /// **This is the envelope query, and the one Phase 0c must use** whenever
    /// it moves or deletes a node. Ownership is assigned to the deepest node a
    /// rule can name, so a sequence item almost never owns the trivia that
    /// visually belongs to it: the inline comment after its last value is owned
    /// by that value, the colon after each of its keys by the key. Moving the
    /// item by its span plus only its *direct* trivia therefore leaves the
    /// comment behind, where it silently becomes a comment about the next
    /// snippet.
    ///
    /// Returned in document order.
    pub fn items_owned_by_subtree(&self, index: &SyntaxIndex, node: NodeId) -> Vec<&TriviaItem> {
        let subtree = subtree(index, node);
        self.items
            .iter()
            .filter(|item| item.owner.is_some_and(|owner| subtree.contains(&owner)))
            .collect()
    } // End of function items_owned_by_subtree()

    /// Every comment owned by `node` **or by any of its descendants**.
    ///
    /// The comment half of the envelope query — see
    /// [`TriviaIndex::items_owned_by_subtree`] for why direct ownership is not
    /// enough. Comments the *file* owns are deliberately excluded: they stay
    /// put, which is what [`TriviaIndex::file_comments`] enumerates.
    ///
    /// Returned in document order.
    pub fn comments_owned_by_subtree(
        &self,
        index: &SyntaxIndex,
        node: NodeId,
    ) -> Vec<&CommentAttachment> {
        let subtree = subtree(index, node);
        self.comments
            .iter()
            .filter(|comment| {
                comment
                    .owner
                    .node()
                    .is_some_and(|owner| subtree.contains(&owner))
            })
            .collect()
    } // End of function comments_owned_by_subtree()

    /// Every comment the file owns, in document order.
    pub fn file_comments(&self) -> impl Iterator<Item = &CommentAttachment> {
        self.comments
            .iter()
            .filter(|comment| comment.owner.is_file())
    }

    /// Whether `node` may be edited, moved or deleted visually.
    ///
    /// A hazard on the node itself, on any ancestor or on any descendant
    /// disqualifies it. Ancestors count because a comment stranded inside an
    /// enclosing flow collection is disturbed by moving anything within it;
    /// descendants count because an edit to a node rewrites the bytes of
    /// everything below it. The direction of the answer is deliberately
    /// pessimistic: refusing an edit that would in fact have been safe costs a
    /// user one fallback to the raw YAML editor, while accepting one that is
    /// not costs them their file.
    ///
    /// # A hazard with no node disqualifies the **whole document**
    ///
    /// [`Hazard::node`] is `None` when the bytes that raised the hazard sit
    /// outside every node — unclassified trivia in a leading or trailing gap,
    /// for instance. Discarding those, as an earlier version did, meant a
    /// document whose only hazard was "there are bytes here we do not
    /// understand" reported *every* node as safe, which is the exact inverse of
    /// "refuse rather than guess". A node-less hazard now refuses everything.
    pub fn is_safely_editable(&self, index: &SyntaxIndex, node: NodeId) -> bool {
        self.disqualifying_hazard(index, node).is_none()
    }

    /// The hazard that makes `node` unsafe to edit, or `None` when it is safe.
    ///
    /// [`TriviaIndex::is_safely_editable`] is exactly "this returned `None`";
    /// the two are one function so that the answer and the *reason* for it can
    /// never drift apart. The reason exists because the mutation entry point
    /// refuses by name (`crate::patch::edit::EditError::Refused`), and "the gate
    /// said no" is not a diagnostic a user can act on.
    ///
    /// The scan order is deliberate: a hazard with **no node** is reported
    /// first, because it disqualifies the whole document and any other answer
    /// would understate the problem. After that, the first flagged node that is
    /// `node`, an ancestor of it or a descendant of it wins.
    pub fn disqualifying_hazard(&self, index: &SyntaxIndex, node: NodeId) -> Option<&Hazard> {
        if let Some(orphan) = self.hazards.iter().find(|hazard| hazard.node.is_none()) {
            return Some(orphan);
        }
        self.hazards.iter().find(|hazard| {
            hazard.node.is_some_and(|flagged| {
                flagged == node
                    || is_ancestor(index, flagged, node)
                    || is_ancestor(index, node, flagged)
            })
        })
    } // End of function disqualifying_hazard()
} // End of impl TriviaIndex

/// `root` and every node beneath it, in no particular order.
///
/// Used by the envelope-shaped ownership queries: trivia is attributed to the
/// deepest node a rule can name, so "what travels with this node" always means
/// "what its whole subtree owns".
fn subtree(index: &SyntaxIndex, root: NodeId) -> Vec<NodeId> {
    let mut collected = Vec::new();
    let mut pending = vec![root];
    while let Some(id) = pending.pop() {
        if collected.contains(&id) {
            continue;
        }
        collected.push(id);
        if let Some(node) = index.node(id) {
            pending.extend(node.children.iter().copied());
        }
    } // End of the walk over the subtree
    collected
} // End of function subtree()

/// Whether `ancestor` is a strict ancestor of `node`.
fn is_ancestor(index: &SyntaxIndex, ancestor: NodeId, node: NodeId) -> bool {
    let mut current = index.node(node).and_then(|node| node.parent);
    while let Some(id) = current {
        if id == ancestor {
            return true;
        }
        current = index.node(id).and_then(|node| node.parent);
    }
    false
} // End of function is_ancestor()

/// The spans Phase 0b-1 already lexed, which the scanner adopts rather than
/// lexing a second time.
///
/// Two kinds: a block scalar's `|`/`>` header, from `crate::syntax::block`, and
/// a document's `---`/`...` markers, from its document node. A second opinion
/// on either could disagree with the first, and the first is the one the spans
/// were derived from.
fn known_spans(index: &SyntaxIndex) -> Vec<(ByteSpan, TriviaKind)> {
    let mut known: Vec<(ByteSpan, TriviaKind)> = Vec::new();
    for node in index.nodes() {
        if let Some(header) = node.scalar.as_ref().and_then(|scalar| scalar.header) {
            known.push((header.span, TriviaKind::BlockScalarHeader));
        }
        if let Some(markers) = node.document_markers {
            if let Some(start) = markers.start {
                known.push((start, TriviaKind::DocumentMarker));
            }
            if let Some(end) = markers.end {
                known.push((end, TriviaKind::DocumentMarker));
            }
        }
    } // End of the loop over the index's nodes
    known.sort_by_key(|(span, _)| (span.start, span.end));
    known.dedup();
    known
} // End of function known_spans()

/// The next pre-lexed span start strictly after `cursor` and before `limit`.
///
/// Every token the scanner emits is clipped to this, so a run of spacing or of
/// unclassified bytes can never swallow a block-scalar header.
fn next_known_start(known: &[(ByteSpan, TriviaKind)], cursor: usize, limit: usize) -> usize {
    known
        .iter()
        .map(|(span, _)| span.start)
        .filter(|start| *start > cursor && *start < limit)
        .min()
        .unwrap_or(limit)
}

/// Classifies one gap into contiguous items, appending them to `out`.
fn scan_gap(
    source: &str,
    gap: ByteSpan,
    known: &[(ByteSpan, TriviaKind)],
    body_offset: usize,
    out: &mut Vec<TriviaItem>,
) {
    let mut cursor = gap.start;
    while cursor < gap.end {
        // A span Phase 0b-1 already lexed and that begins exactly here.
        if let Some((span, kind)) = known.iter().find(|(span, _)| span.start == cursor) {
            let end = span.end.clamp(cursor, gap.end);
            if end > cursor {
                out.push(TriviaItem::new(ByteSpan::new(cursor, end), *kind));
                cursor = end;
                continue;
            }
        }
        let limit = next_known_start(known, cursor, gap.end);
        cursor = scan_token(source, cursor, limit, body_offset, out);
    } // End of the loop over the gap's bytes
} // End of function scan_gap()

/// Classifies one token starting at `cursor` and returns the new cursor.
///
/// `limit` is the first byte the token may not cross: the end of the gap, or
/// the start of the next pre-lexed span. The function always advances.
fn scan_token(
    source: &str,
    cursor: usize,
    limit: usize,
    body_offset: usize,
    out: &mut Vec<TriviaItem>,
) -> usize {
    // The BOM is the document's first bytes and never anything else.
    if cursor == 0 && body_offset > 0 {
        let end = body_offset.min(limit);
        out.push(TriviaItem::new(ByteSpan::new(cursor, end), TriviaKind::Bom));
        return end;
    }

    let at_start = at_line_start(source, cursor, body_offset);
    if at_start {
        if let Some(end) = blank_line_end(source, cursor, limit) {
            out.push(TriviaItem::new(
                ByteSpan::new(cursor, end),
                TriviaKind::BlankLine,
            ));
            return end;
        }
    }

    let character = source[cursor..].chars().next().unwrap_or('\u{0}');
    let (end, kind) = match character {
        '\r' | '\n' => (line_break_end(source, cursor, limit), TriviaKind::LineBreak),
        ' ' | '\t' => (
            run_of(source, cursor, limit, |c| c == ' ' || c == '\t'),
            if at_start {
                TriviaKind::Indentation
            } else {
                TriviaKind::Spacing
            },
        ),
        // A `#` only opens a comment at the start of a line or after
        // whitespace. Anywhere else it is an ordinary character, and since
        // every scalar is a frontier leaf, one that reaches the scanner is
        // something we do not understand rather than a comment.
        '#' if at_start || preceded_by_space(source, cursor) => (
            line_content_end(source, cursor).min(limit),
            TriviaKind::Comment,
        ),
        '&' => (
            run_of(source, cursor + 1, limit, is_name_char).max(cursor + 1),
            TriviaKind::Anchor,
        ),
        '!' => (tag_end(source, cursor, limit), TriviaKind::Tag),
        '%' if at_start => (
            line_content_end(source, cursor).min(limit),
            TriviaKind::Directive,
        ),
        '-' => (
            cursor + 1,
            TriviaKind::Punctuation(Punctuation::SequenceDash),
        ),
        ':' => (cursor + 1, TriviaKind::Punctuation(Punctuation::Colon)),
        '?' => (
            cursor + 1,
            TriviaKind::Punctuation(Punctuation::ExplicitKey),
        ),
        ',' => (cursor + 1, TriviaKind::Punctuation(Punctuation::Comma)),
        '[' => (
            cursor + 1,
            TriviaKind::Punctuation(Punctuation::FlowSequenceOpen),
        ),
        ']' => (
            cursor + 1,
            TriviaKind::Punctuation(Punctuation::FlowSequenceClose),
        ),
        '{' => (
            cursor + 1,
            TriviaKind::Punctuation(Punctuation::FlowMappingOpen),
        ),
        '}' => (
            cursor + 1,
            TriviaKind::Punctuation(Punctuation::FlowMappingClose),
        ),
        other => (
            unclassified_end(source, cursor + other.len_utf8(), limit),
            TriviaKind::Unclassified,
        ),
    };
    let end = end.clamp(cursor + character.len_utf8().min(limit - cursor), limit);
    out.push(TriviaItem::new(ByteSpan::new(cursor, end), kind));
    end
} // End of function scan_token()

/// Whether `position` begins a physical line.
///
/// A document that starts with a BOM has its first line start just past it: the
/// BOM is not a character of the first line, and treating it as one would make
/// a leading `# header` comment look like a mid-line `#`, which is not a
/// comment at all.
fn at_line_start(source: &str, position: usize, body_offset: usize) -> bool {
    if position == 0 || position == body_offset {
        return true;
    }
    let before = &source[..position];
    if before.ends_with('\n') {
        return true;
    }
    // A bare `\r` starts a new line only when an `\n` does not follow it, in
    // which case the `\r\n` pair is one break and this position is inside it.
    before.ends_with('\r') && !source[position..].starts_with('\n')
} // End of function at_line_start()

/// Whether the byte before `position` is a space or a tab.
fn preceded_by_space(source: &str, position: usize) -> bool {
    source[..position].ends_with([' ', '\t'])
}

/// End of a blank line beginning at `start`, or `None` when the line is not
/// blank or does not lie wholly inside the region ending at `limit`.
///
/// A line is blank when it holds nothing but spaces and tabs. The returned end
/// includes the terminating line break, so blank lines tile with the rest of
/// the gap. A whitespace-only run that reaches end-of-source is a blank line
/// with no terminator; one that runs past `limit` is not a blank line at all,
/// because the rest of it belongs to a frontier leaf or to a pre-lexed span.
fn blank_line_end(source: &str, start: usize, limit: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    let mut cursor = start;
    while cursor < limit && (bytes[cursor] == b' ' || bytes[cursor] == b'\t') {
        cursor += 1;
    }
    if cursor >= limit {
        // Only a run that ends the whole document is a terminator-less blank
        // line; one that merely ends the region is somebody else's indentation.
        return (cursor == source.len()).then_some(cursor);
    }
    match bytes[cursor] {
        b'\n' => Some(cursor + 1),
        b'\r' => {
            let end = if source[cursor..].starts_with("\r\n") {
                cursor + 2
            } else {
                cursor + 1
            };
            (end <= limit).then_some(end)
        }
        _ => None,
    }
} // End of function blank_line_end()

/// End of the line break at `cursor`, treating `\r\n` as one break.
fn line_break_end(source: &str, cursor: usize, limit: usize) -> usize {
    if source[cursor..].starts_with("\r\n") && cursor + 2 <= limit {
        cursor + 2
    } else {
        cursor + 1
    }
}

/// Offset of the first line-break byte at or after `position`, or the end of
/// the source.
fn line_content_end(source: &str, position: usize) -> usize {
    source[position..]
        .find(['\n', '\r'])
        .map_or(source.len(), |offset| position + offset)
}

/// End of a run of bytes satisfying `accept`, starting at `from`.
fn run_of(source: &str, from: usize, limit: usize, accept: impl Fn(char) -> bool) -> usize {
    let mut cursor = from.min(limit);
    while cursor < limit {
        let Some(character) = source[cursor..].chars().next() else {
            break;
        };
        if !accept(character) {
            break;
        }
        cursor += character.len_utf8();
    }
    cursor
} // End of function run_of()

/// End of a run of bytes none of which could start a recognised token.
fn unclassified_end(source: &str, from: usize, limit: usize) -> usize {
    run_of(source, from, limit, |character| !starts_a_token(character))
}

/// Whether `character` could begin a token the scanner recognises.
fn starts_a_token(character: char) -> bool {
    matches!(
        character,
        ' ' | '\t'
            | '\r'
            | '\n'
            | '#'
            | '&'
            | '!'
            | '%'
            | '-'
            | ':'
            | '?'
            | ','
            | '['
            | ']'
            | '{'
            | '}'
    )
}

/// Whether `character` may appear in an anchor name.
///
/// YAML's `ns-anchor-char` is any non-space character that is not a flow
/// indicator, so `:` and `#` are legal in a name and are not treated as
/// punctuation here.
fn is_name_char(character: char) -> bool {
    !character.is_whitespace() && !matches!(character, ',' | '[' | ']' | '{' | '}')
}

/// End of the tag token whose `!` sits at `cursor`.
///
/// The two spellings need different scanners, which is exactly the defect the
/// Phase 0b-2 review found: reusing the anchor-name predicate for both stops a
/// **verbatim** tag at the first comma, so `!<tag:example.com,2000:x>` split
/// into a `Tag`, a `Comma` and unclassified bytes.
///
/// - `!<…>` — everything up to and including the closing `>`, whatever it
///   contains. A `>` cannot appear inside a verbatim tag's URI, so the first
///   one always terminates it.
/// - `!`, `!!suffix`, `!handle!suffix` — a run of `ns-tag-char`, which stops at
///   a space or a flow indicator.
///
/// An unterminated `!<…` — which a desktop editor sees on every keystroke —
/// falls back to the shorthand scan rather than swallowing the rest of the gap,
/// so a half-typed tag stays one named item instead of becoming unclassified.
fn tag_end(source: &str, cursor: usize, limit: usize) -> usize {
    let after = cursor + 1;
    if after >= limit {
        return after;
    }
    if source[after..].starts_with('<') {
        if let Some(offset) = source[after..limit].find('>') {
            return after + offset + 1;
        }
    }
    run_of(source, after, limit, is_tag_shorthand_char).max(after)
} // End of function tag_end()

/// Whether `character` may appear in a tag **shorthand**.
///
/// YAML's `ns-tag-char` is a URI character that is not a flow indicator, which
/// for our purposes is the same set as an anchor name. A verbatim tag is not
/// scanned with this predicate — see [`tag_end`].
fn is_tag_shorthand_char(character: char) -> bool {
    is_name_char(character)
}

/// Groups adjacent [`TriviaKind::BlankLine`] items into maximal runs.
fn blank_runs(items: &[TriviaItem]) -> Vec<BlankRun> {
    let mut runs: Vec<BlankRun> = Vec::new();
    for item in items
        .iter()
        .filter(|item| item.kind == TriviaKind::BlankLine)
    {
        match runs.last_mut() {
            Some(run) if run.span.end == item.span.start => {
                run.span = ByteSpan::new(run.span.start, item.span.end);
                run.lines += 1;
            }
            _ => runs.push(BlankRun {
                span: item.span,
                lines: 1,
            }),
        }
    } // End of the loop over the blank-line items
    runs
} // End of function blank_runs()

#[cfg(test)]
mod tests {
    use super::*;

    /// Concatenates every frontier leaf and every trivia item, in order.
    fn rebuild(source: &str) -> String {
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let mut out = String::with_capacity(source.len());
        let mut items = trivia.items().iter().peekable();
        for segment in index.segments() {
            match segment {
                crate::syntax::Segment::Leaf(leaf) => {
                    out.push_str(leaf.span.slice(source).expect("leaf slices"));
                }
                crate::syntax::Segment::Gap(gap) => {
                    let mut cursor = gap.start;
                    while cursor < gap.end {
                        let item = items.next().expect("a gap is fully tiled");
                        assert_eq!(item.span.start, cursor, "items must be contiguous");
                        out.push_str(item.span.slice(source).expect("item slices"));
                        cursor = item.span.end;
                    }
                }
            }
        } // End of the loop over the document's segments
        assert!(items.next().is_none(), "no item may sit outside a gap");
        out
    } // End of function rebuild()

    #[test]
    fn every_gap_byte_is_classified_and_the_document_rebuilds() {
        for source in [
            "matches:\n  - trigger: :a\n    replace: x\n",
            "\u{feff}# header\nmatches: []\n",
            "a: 1\r\nb: 2\r\n",
            "%YAML 1.2\n---\na: 1\n...\n",
            "a: &anc\n  b: 1\nc: !!str x\nd: *anc\n",
            "items: [one, # why\n  two]\n",
            "replace: |\n  body\n\n\nnext: 1\n",
            "? key\n: value\n",
            "empty: # why\n",
            "matches:\n  - \n",
        ] {
            assert_eq!(rebuild(source), source, "{source:?} must rebuild");
        }
    } // End of function every_gap_byte_is_classified_and_the_document_rebuilds()

    #[test]
    fn the_bom_is_its_own_item_and_the_header_comment_is_still_a_comment() {
        let source = "\u{feff}# header\nmatches: []\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        assert_eq!(trivia.items()[0].kind, TriviaKind::Bom);
        assert_eq!(trivia.items()[0].span, ByteSpan::new(0, 3));
        assert_eq!(trivia.count(TriviaKind::Comment), 1);
        let comment = trivia
            .items()
            .iter()
            .find(|item| item.is_comment())
            .expect("a comment");
        assert_eq!(comment.span.slice(source), Some("# header"));
    } // End of function the_bom_is_its_own_item_and_the_header_comment_is_still_a_comment()

    #[test]
    fn blank_lines_are_whole_lines_and_group_into_runs() {
        let source = "a: 1\n\n\n\nb: 2\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        // The first `\n` terminates the line `a: 1`; the next three are blank
        // lines of their own.
        assert_eq!(trivia.count(TriviaKind::BlankLine), 3);
        assert_eq!(trivia.blank_runs().len(), 1);
        assert_eq!(trivia.blank_runs()[0].lines, 3);
        assert_eq!(trivia.blank_runs()[0].span.slice(source), Some("\n\n\n"));
    } // End of function blank_lines_are_whole_lines_and_group_into_runs()

    #[test]
    fn a_line_holding_only_spaces_is_blank_but_one_a_leaf_shares_is_not() {
        let source = "a: 1\n   \nb: 2\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        assert_eq!(trivia.count(TriviaKind::BlankLine), 1);
        assert_eq!(trivia.blank_runs()[0].span.slice(source), Some("   \n"));
        // `b: 2` is not blank, and its own indentation-free line produces none.
        let source = "a: 1\nb: 2\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        assert_eq!(
            TriviaIndex::scan(source, &index).count(TriviaKind::BlankLine),
            0
        );
    } // End of function a_line_holding_only_spaces_is_blank_but_one_a_leaf_shares_is_not()

    #[test]
    fn a_whitespace_only_final_line_without_a_terminator_is_still_a_blank_line() {
        // There is no next token at end-of-source, so a trailing run of spaces
        // on a line of its own cannot be anybody's indentation. It is the last,
        // unterminated blank line of the file, and it must come back verbatim.
        let source = "a: 1\n   ";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        assert_eq!(trivia.count(TriviaKind::BlankLine), 1);
        assert_eq!(trivia.blank_runs()[0].span.slice(source), Some("   "));
        assert_eq!(rebuild(source), source);

        // Mid-document the identical run is the next token's indentation.
        let source = "a: 1\n   \nb: 2\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        assert_eq!(trivia.blank_runs()[0].span.slice(source), Some("   \n"));
        let indentation = trivia.count(TriviaKind::Indentation);
        assert_eq!(indentation, 0, "`b` starts at column zero");
    } // End of function a_whitespace_only_final_line_without_a_terminator_is_still_a_blank_line()

    #[test]
    fn the_block_scalar_header_is_adopted_from_the_span_layer_not_relexed() {
        let source = "replace: |2-\n    body\nnext: 1\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let header = trivia
            .items()
            .iter()
            .find(|item| item.kind == TriviaKind::BlockScalarHeader)
            .expect("a header item");
        assert_eq!(header.span.slice(source), Some("|2-"));
        // And it is the very span `block::layout` published.
        let node = index
            .nodes()
            .iter()
            .find(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.style().is_block())
            })
            .expect("a block scalar");
        assert_eq!(
            header.span,
            node.scalar.as_ref().unwrap().header.unwrap().span
        );
    } // End of function the_block_scalar_header_is_adopted_from_the_span_layer_not_relexed()

    #[test]
    fn anchors_tags_directives_and_markers_are_named() {
        let source = "%YAML 1.2\n---\na: &anc\n  b: 1\nc: !!str x\n...\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let text = |kind: TriviaKind| -> Vec<&str> {
            trivia
                .items()
                .iter()
                .filter(|item| item.kind == kind)
                .filter_map(|item| item.span.slice(source))
                .collect()
        };
        assert_eq!(text(TriviaKind::Anchor), vec!["&anc"]);
        assert_eq!(text(TriviaKind::Tag), vec!["!!str"]);
        assert_eq!(text(TriviaKind::Directive), vec!["%YAML 1.2"]);
        assert_eq!(text(TriviaKind::DocumentMarker), vec!["---", "..."]);
        assert_eq!(trivia.unclassified().count(), 0);
    } // End of function anchors_tags_directives_and_markers_are_named()

    #[test]
    fn structural_punctuation_is_told_apart() {
        let source = "a: {x: 1, y: [2, 3]}\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let count = |punctuation: Punctuation| trivia.count(TriviaKind::Punctuation(punctuation));
        assert_eq!(count(Punctuation::FlowMappingOpen), 1);
        assert_eq!(count(Punctuation::FlowMappingClose), 1);
        assert_eq!(count(Punctuation::FlowSequenceOpen), 1);
        assert_eq!(count(Punctuation::FlowSequenceClose), 1);
        assert_eq!(count(Punctuation::Comma), 2);
        assert_eq!(count(Punctuation::Colon), 3);
        assert_eq!(trivia.unclassified().count(), 0);
    } // End of function structural_punctuation_is_told_apart()

    #[test]
    fn a_verbatim_tag_is_one_item_however_many_commas_it_holds() {
        // `TriviaKind::Tag` documents this spelling, and reusing the anchor-name
        // predicate for it broke the promise: the predicate stops at a comma,
        // so one tag became a `Tag`, a `Comma` and unclassified bytes.
        let source = "a: !<tag:example.com,2000:x> 1\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let tags: Vec<&str> = trivia
            .items()
            .iter()
            .filter(|item| item.kind == TriviaKind::Tag)
            .filter_map(|item| item.span.slice(source))
            .collect();
        assert_eq!(tags, vec!["!<tag:example.com,2000:x>"]);
        assert_eq!(trivia.count(TriviaKind::Punctuation(Punctuation::Comma)), 0);
        assert_eq!(trivia.unclassified().count(), 0);
        assert_eq!(rebuild(source), source);

        // The lexer itself, on the shapes an editor sees mid-keystroke.
        assert_eq!(tag_end("!<a,b>", 0, 6), 6);
        assert_eq!(tag_end("!<a,b> x", 0, 8), 6);
        assert_eq!(tag_end("!!str x", 0, 7), 5);
        assert_eq!(tag_end("!", 0, 1), 1);
        // Unterminated: the shorthand scan bounds it instead of swallowing the
        // rest of the gap, so a half-typed tag is still one named item.
        assert_eq!(tag_end("!<a x", 0, 5), 3);
    } // End of function a_verbatim_tag_is_one_item_however_many_commas_it_holds()

    #[test]
    fn a_hazard_with_no_node_disqualifies_every_node_in_the_document() {
        // A hazard whose bytes fall outside every node used to be discarded by
        // `is_safely_editable`, so a document whose only complaint was "there
        // are bytes here we cannot name" reported every node as safe — the
        // exact inverse of "refuse rather than guess".
        let source = "matches:\n  - trigger: :a\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let mut trivia = TriviaIndex::scan(source, &index);
        assert!(trivia.hazards().is_empty());
        assert!(index
            .nodes()
            .iter()
            .all(|node| trivia.is_safely_editable(&index, node.id)));

        // Exactly the shape `collect_hazards` produces when the unclassified
        // bytes lie outside every node.
        trivia.hazards.push(Hazard {
            kind: HazardKind::UnclassifiedTrivia,
            span: ByteSpan::new(0, 1),
            node: None,
        });
        assert!(
            index
                .nodes()
                .iter()
                .all(|node| !trivia.is_safely_editable(&index, node.id)),
            "an unnamed byte outside every node must refuse the whole document"
        );
    } // End of function a_hazard_with_no_node_disqualifies_every_node_in_the_document()

    #[test]
    fn a_hash_that_is_not_preceded_by_whitespace_is_not_called_a_comment() {
        // A `#` only opens a comment at a line start or after whitespace. The
        // scanner never widens a neighbour to absorb one that is not: it says
        // so, loudly, as unclassified bytes.
        assert!(!preceded_by_space("a]#b", 2));
        assert!(preceded_by_space("a #b", 2));
        assert!(at_line_start("a\n#b", 2, 0));
        assert!(at_line_start("\u{feff}#b", 3, 3));
        assert!(!at_line_start("ab", 1, 0));
    }
}
