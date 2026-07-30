//! Trivia attribution — who owns a comment, a dash or an anchor.
//!
//! Classification says *what* a run of gap bytes is; this module says *whose*
//! it is. The rules are `IMPLEMENTATION_PLAN.md` section 6.2's four comment
//! ownership rules, plus an explicit, documented policy for each construct the
//! Phase 0b-1 review found the frontier could not attribute on its own.
//!
//! # The four normative rules (plan section 6.2)
//!
//! 1. Contiguous comments immediately above a sequence item, **with no blank
//!    line between**, belong to that item —
//!    [`OwnershipRule::LeadingBlock`].
//! 2. A comment separated by one or more blank lines belongs to the **file** —
//!    [`OwnershipRule::BlankLineSeparated`].
//! 3. Inline comments belong to their mapping entry —
//!    [`OwnershipRule::Inline`].
//! 4. **File-header comments before the first top-level key never belong to the
//!    first match** — [`OwnershipRule::FileHeader`]. This one is load-bearing:
//!    the owner's real files all open with a generated header comment, and
//!    attaching it to the first snippet would move it on every reorder.
//!
//! # Two places the implementation is broader than the text
//!
//! Stated rather than glossed over, because both are deliberate extensions and
//! a reader comparing code to plan will otherwise find them and distrust one of
//! the two:
//!
//! - **Rule 3 names a "mapping entry"; there is no mapping-entry node.** The
//!   index has separate [`NodeRole::MappingKey`] and [`NodeRole::MappingValue`]
//!   children, so an inline comment attaches to the nearest non-zero-width node
//!   instead — normally the value scalar, and the key when the value is empty
//!   or written on later lines. Two logically identical entries therefore get
//!   different owners depending on presentation. The envelope query
//!   [`crate::syntax::TriviaIndex::comments_owned_by_subtree`] exists precisely
//!   so that a consumer that means "the whole entry" gets the whole entry.
//! - **Rule 1 names sequence items; the code accepts any following node.** A
//!   non-header, non-blank-separated leading block is given to whatever node
//!   follows it, including a second top-level mapping key. Restricting it to
//!   sequence items would leave those comments owned by nobody, which is worse:
//!   they would not travel when their key does.
//!
//! # The rules overlap, and precedence resolves them
//!
//! More than one rule can be true of the same comment: a header followed by a
//! blank line satisfies both rule 4 and rule 2, and a header immediately above a
//! root sequence item satisfies both rule 4 and rule 1. Exactly one
//! [`OwnershipRule`] is ever emitted, decided by a fixed precedence —
//! **flow-interior → inline → file-header → blank-line-separated → leading
//! block**, with a trailing comment falling through to the file. The order is
//! chosen so the safest answer wins the overlaps: the file keeps anything a
//! reorder could otherwise carry away.
//!
//! # The ambiguous cases, and the policy chosen for each
//!
//! None of these has a right answer, so each has a **deterministic** one. In
//! every case predictability beats cleverness, and where a construct cannot be
//! reordered safely at all it raises a [`HazardKind`] so Phase 0c refuses
//! instead of guessing.
//!
//! | Construct | Policy |
//! |---|---|
//! | `empty:` followed by an inline comment | Both the `:` and the comment belong to the **key**. The zero-width value node is deliberately never an owner here: it owns no bytes, and the substrate reports it *before* the colon, so a rule that used it would attach a trailing comment to a node that sits on the wrong side of the punctuation it trails. The key is the entry's visible identity. No hazard — the entry stays safely editable. |
//! | A bare `- ` sequence item | The `-` belongs to the **item the dash introduces**, which for an empty item is the zero-width scalar. An inline comment on that line, having no node before it, belongs to the same item. |
//! | A compact `- key: value` mapping | The `-` belongs to the **item mapping**, never to its first key, so moving the item moves its dash. Leading comments attach to the item mapping too. |
//! | An explicit `? key` / `: value` mapping | The `?` belongs to the key it introduces and the line-leading `:` to the value it introduces; the enclosing mapping raises [`HazardKind::ExplicitKeyMapping`]. |
//! | A comment inside a flow collection (`PROGRESS.md`, R6) | It belongs to the **innermost enclosing flow collection**, and that collection raises [`HazardKind::CommentInFlowCollection`]. The collection is then refused **outright**, whole-collection replacement included: the gate cannot express "safe to replace, unsafe to reorder", and between the two answers refusal is the one that cannot lose a comment. |
//!
//! # How a node is chosen
//!
//! Two primitives decide everything:
//!
//! - **the node ending before a position, on the same line** — the deepest
//!   node whose span ends at or before it, which is what an inline comment
//!   trails and what a `:` terminates;
//! - **the node starting after a position** — the outermost node whose span
//!   begins at or after it, which is what a leading comment introduces and what
//!   a `-`, `?`, `&` or `!` decorates.
//!
//! Deepest for the first because `trigger: :a  # why` should attach to the
//! value, not to the mapping that happens to end in the same place; outermost
//! for the second because a comment above `- trigger: :a` introduces the whole
//! item, not merely its first key.

use crate::syntax::node::{NodeId, NodeKind, NodeRole};
use crate::syntax::trivia::{
    CommentAttachment, CommentOwner, Hazard, HazardKind, OwnershipRule, Punctuation, TriviaItem,
    TriviaKind,
};
use crate::syntax::{ByteSpan, CollectionStyle, ScalarStyle, SyntaxIndex};

/// Assigns an owner to every item that has one, and returns the comment
/// attachments and the hazards found along the way.
///
/// Runs in three passes so that each is independently readable: punctuation and
/// decoration first, then comments, then hazards. `items` is mutated only to
/// stamp [`TriviaItem::owner`]; no span is ever changed, so the tiling property
/// the scanner established still holds afterwards.
pub(crate) fn attribute(
    source: &str,
    index: &SyntaxIndex,
    items: &mut [TriviaItem],
) -> (Vec<CommentAttachment>, Vec<Hazard>) {
    let context = Context::new(index);
    let mut hazards = Vec::new();

    let decorations = decoration_owners(source, &context, items);
    for (position, owner) in decorations {
        items[position].owner = Some(owner);
    }

    let comments = attribute_comments(source, &context, items, &mut hazards);
    collect_hazards(source, &context, items, &mut hazards);
    hazards.sort_by_key(|hazard| (hazard.span.start, hazard.span.end));
    (comments, hazards)
} // End of function attribute()

/// One candidate node, ranked by the key one of the primitives orders on.
///
/// `arena` is the node's position in [`SyntaxIndex::nodes`], and it is carried
/// so the precomputed orders break ties **exactly** as the linear scans they
/// replaced did: `max_by_key` returns the last maximum in iteration order and
/// `min_by_key` the first minimum, and iteration order was arena order.
#[derive(Clone, Copy)]
struct Ranked {
    /// The endpoint the order is on — `span.end` in `by_end`, `span.start` in
    /// `by_start`.
    at: usize,
    /// The node's depth, which is the primitives' second key.
    depth: usize,
    /// Its arena position, the tie-breaker.
    arena: usize,
    /// The node itself.
    node: NodeId,
}

/// Precomputed facts about the tree that every rule consults.
///
/// # R19 — the primitives are answered from an order, not from a scan
///
/// [`Context::ending_before`], [`Context::starting_after`] and
/// [`Context::enclosing_flow`] used to scan **every** node of the document, and
/// each is called once per trivia item, so `TriviaIndex::scan` cost
/// O(items × nodes) — `PROGRESS.md`, R19, measured at 20 ms for the largest real
/// file. The answers are now read out of orders built once per scan:
///
/// - `by_end`, candidates with a non-empty span sorted by `(end, depth, arena)`;
/// - `by_start`, every candidate sorted by `(start, depth, arena)`;
/// - `flows`, the flow collections alone, which are a handful per document.
///
/// **No answer changes.** Each order's key is exactly the key the scan it
/// replaced maximised or minimised, tie-breaker included, so the same node wins
/// on the same input; the whole corpus's pinned attribution counts, ownership
/// rules and hazard tallies are the differential that says so.
///
/// [`Context::innermost_containing`] is deliberately left a scan: it is asked
/// only about [`TriviaKind::Unclassified`] bytes, which raise a hazard that
/// disqualifies the whole document, so it is never on a hot path.
struct Context<'index> {
    /// The index the trivia belongs to.
    index: &'index SyntaxIndex,
    /// Depth of every node, by arena position. A document is depth 0.
    depth: Vec<usize>,
    /// Candidates with a non-empty span, by `(end, depth, arena)` ascending.
    by_end: Vec<Ranked>,
    /// Every candidate, by `(start, depth, arena)` ascending.
    by_start: Vec<Ranked>,
    /// The flow collections, in arena order, with their spans.
    flows: Vec<(ByteSpan, Ranked)>,
}

impl<'index> Context<'index> {
    /// Precomputes node depths and the three primitive orders.
    ///
    /// The arena is filled in event order, so a node's parent always precedes
    /// it and one forward pass suffices for the depths.
    fn new(index: &'index SyntaxIndex) -> Context<'index> {
        let mut depth = vec![0usize; index.nodes().len()];
        for node in index.nodes() {
            if let Some(parent) = node.parent {
                depth[node.id.get()] = depth[parent.get()] + 1;
            }
        }

        let mut by_end: Vec<Ranked> = Vec::new();
        let mut by_start: Vec<Ranked> = Vec::new();
        let mut flows: Vec<(ByteSpan, Ranked)> = Vec::new();
        for (arena, node) in index.nodes().iter().enumerate() {
            // The same filter `candidates()` applies: a document node is the
            // stream's structure rather than a construct a user edits.
            if node.kind == NodeKind::Document {
                continue;
            }
            let ranked = Ranked {
                at: node.span.start,
                depth: depth[node.id.get()],
                arena,
                node: node.id,
            };
            by_start.push(ranked);
            if !node.span.is_empty() {
                by_end.push(Ranked {
                    at: node.span.end,
                    ..ranked
                });
            }
            if node.collection_style == Some(CollectionStyle::Flow) {
                flows.push((node.span, ranked));
            }
        } // End of the loop that ranks every candidate node

        by_end.sort_by_key(|ranked| (ranked.at, ranked.depth, ranked.arena));
        by_start.sort_by_key(|ranked| (ranked.at, ranked.depth, ranked.arena));
        Context {
            index,
            depth,
            by_end,
            by_start,
            flows,
        }
    } // End of function new()

    /// Every node that may own trivia: everything except the document nodes,
    /// which are the stream's structure rather than a construct a user edits.
    fn candidates(&self) -> impl Iterator<Item = &crate::syntax::Node> {
        self.index
            .nodes()
            .iter()
            .filter(|node| node.kind != NodeKind::Document)
    }

    /// The deepest node whose span ends at or before `position`, on the same
    /// physical line.
    ///
    /// This is what an inline comment trails and what a `:` terminates. Deepest
    /// wins because `trigger: :a  # why` must attach to the value scalar, not
    /// to the mapping and sequence item that end in the same place.
    ///
    /// **Zero-width nodes are excluded.** A node that owns no bytes cannot be
    /// the thing a reader sees the comment trailing, and in `empty: # why` the
    /// substrate reports the empty value at the byte *before* the colon — so
    /// including it would hand the colon and the comment to a node that is
    /// written nowhere and that sits on the wrong side of the punctuation. The
    /// key is the entry's visible identity and takes both.
    ///
    /// Answered from `by_end`: the last entry whose end is at or before
    /// `position` is the maximum by `(end, depth, arena)` among the candidates
    /// the scan considered. The same-line test is applied to that one alone
    /// because it is **monotone** — if a break lies between the largest such end
    /// and `position`, it lies between every smaller end and `position` too — so
    /// a failure there is a failure for all of them.
    fn ending_before(&self, source: &str, position: usize) -> Option<NodeId> {
        let upto = self.by_end.partition_point(|ranked| ranked.at <= position);
        let best = self.by_end.get(upto.checked_sub(1)?)?;
        same_line(source, best.at, position).then_some(best.node)
    } // End of function ending_before()

    /// The outermost node whose span begins at or after `position`.
    ///
    /// This is what a leading comment introduces and what a `-`, `?`, `&` or
    /// `!` decorates. Outermost wins because a comment above `- trigger: :a`
    /// introduces the whole item, not merely its first key.
    ///
    /// Answered from `by_start`: the first entry whose start is at or after
    /// `position` is the minimum by `(start, depth, arena)`.
    fn starting_after(&self, position: usize) -> Option<NodeId> {
        let from = self.by_start.partition_point(|ranked| ranked.at < position);
        self.by_start.get(from).map(|ranked| ranked.node)
    }

    /// The innermost flow collection whose span contains `span`.
    fn enclosing_flow(&self, span: ByteSpan) -> Option<NodeId> {
        self.flows
            .iter()
            .filter(|(flow, _)| flow.contains(span))
            .max_by_key(|(_, ranked)| (ranked.depth, ranked.arena))
            .map(|(_, ranked)| ranked.node)
    }

    /// The innermost node of any kind whose span contains `span`.
    fn innermost_containing(&self, span: ByteSpan) -> Option<NodeId> {
        self.candidates()
            .filter(|node| node.span.contains(span))
            .max_by_key(|node| self.depth[node.id.get()])
            .map(|node| node.id)
    }

    /// Walks a target down to the entry a leading comment really introduces.
    ///
    /// A comment above `- trigger: :a` first resolves to the enclosing
    /// sequence, because a block sequence's span starts at its first item's
    /// dash. Descending into the first child, as long as that child also starts
    /// after the comment, lands on the **item** — which is what plan section
    /// 6.2's rule 1 names. The walk stops at a sequence item, because an item
    /// is an entry and its own first key is not.
    fn descend_to_entry(&self, mut node: NodeId, after: usize) -> NodeId {
        loop {
            let Some(current) = self.index.node(node) else {
                return node;
            };
            if current.role == NodeRole::SequenceItem {
                return node;
            }
            if !matches!(current.kind, NodeKind::Mapping | NodeKind::Sequence) {
                return node;
            }
            let Some(first) = current.children.first().copied() else {
                return node;
            };
            match self.index.node(first) {
                Some(child) if child.span.start >= after => node = first,
                _ => return node,
            }
        } // End of the descent loop
    } // End of function descend_to_entry()

    /// Whether `node` is the document's root or the root's first child.
    ///
    /// That is exactly "the first top-level key" of plan section 6.2's rule 4,
    /// stated so it also covers a document whose root is a sequence.
    fn is_first_top_level(&self, node: NodeId) -> bool {
        let Some(target) = self.index.node(node) else {
            return false;
        };
        let Some(document) = self.index.documents().get(target.document_index) else {
            return false;
        };
        let Some(root) = self
            .index
            .node(*document)
            .and_then(|document| document.children.first().copied())
        else {
            return false;
        };
        if root == node {
            return true;
        }
        self.index
            .node(root)
            .is_some_and(|root| root.children.first() == Some(&node))
    } // End of function is_first_top_level()

    /// Index of the document a node belongs to.
    ///
    /// Preferred over [`Context::document_index_at`] whenever a rule has
    /// already identified the node the comment is about: a header comment
    /// written above the *next* document's `---` still sits, positionally,
    /// after the previous document's extent, so deriving the document from the
    /// comment's own offset files it under the wrong one.
    fn document_index_of(&self, node: NodeId) -> Option<usize> {
        self.index.node(node).map(|node| node.document_index)
    }

    /// Index of the document a byte offset falls in.
    fn document_index_at(&self, position: usize) -> usize {
        self.index
            .documents()
            .iter()
            .enumerate()
            .filter(|(_, id)| {
                self.index
                    .node(**id)
                    .is_some_and(|document| document.span.start <= position)
            })
            .map(|(position, _)| position)
            .next_back()
            .unwrap_or(0)
    } // End of function document_index_at()
} // End of impl Context

/// Assigns owners to punctuation, anchors, tags and block-scalar headers.
///
/// Returns `(item index, owner)` pairs rather than mutating, so the rules stay
/// readable as a table and the mutation happens in one place.
fn decoration_owners(
    source: &str,
    context: &Context<'_>,
    items: &[TriviaItem],
) -> Vec<(usize, NodeId)> {
    let mut out = Vec::new();
    for (position, item) in items.iter().enumerate() {
        let owner = match item.kind {
            // The dash belongs to the item it introduces — the item mapping of
            // a compact `- key: value`, or the zero-width scalar of a bare
            // `- `. Never the item's first key: moving the item must move the
            // dash with it.
            TriviaKind::Punctuation(Punctuation::SequenceDash) => {
                context.starting_after(item.span.end)
            }
            // A `key:` colon terminates the key on its own line. A line-leading
            // `:` is the explicit form's value indicator and introduces the
            // value instead.
            TriviaKind::Punctuation(Punctuation::Colon) => context
                .ending_before(source, item.span.start)
                .or_else(|| context.starting_after(item.span.end)),
            // `?` introduces the key that follows it.
            TriviaKind::Punctuation(Punctuation::ExplicitKey) => {
                context.starting_after(item.span.end)
            }
            // A flow collection's own brackets and separators belong to it.
            TriviaKind::Punctuation(
                Punctuation::Comma
                | Punctuation::FlowSequenceOpen
                | Punctuation::FlowSequenceClose
                | Punctuation::FlowMappingOpen
                | Punctuation::FlowMappingClose,
            ) => context.enclosing_flow(item.span),
            // An anchor or a tag decorates the node that follows it, which is
            // the only place its spelling is recorded at all.
            TriviaKind::Anchor | TriviaKind::Tag => context.starting_after(item.span.end),
            // A block-scalar header describes exactly one scalar.
            TriviaKind::BlockScalarHeader => context
                .index
                .nodes()
                .iter()
                .find(|node| {
                    node.scalar
                        .as_ref()
                        .and_then(|scalar| scalar.header)
                        .is_some_and(|header| header.span == item.span)
                })
                .map(|node| node.id),
            _ => None,
        };
        if let Some(owner) = owner {
            out.push((position, owner));
        }
    } // End of the loop over the trivia items
    out
} // End of function decoration_owners()

/// Applies the four ownership rules, plus the flow-interior policy, to every
/// comment.
fn attribute_comments(
    source: &str,
    context: &Context<'_>,
    items: &mut [TriviaItem],
    hazards: &mut Vec<Hazard>,
) -> Vec<CommentAttachment> {
    let blocks = comment_blocks(source, items);
    let mut attachments = Vec::new();

    for block in &blocks {
        let span = ByteSpan::new(
            items[block.members[0]].span.start,
            items[*block.members.last().expect("a block is never empty")]
                .span
                .end,
        );
        let (owner, rule) = decide(source, context, items, block, span, hazards);
        for member in &block.members {
            items[*member].owner = owner.node();
            attachments.push(CommentAttachment {
                span: items[*member].span,
                block: span,
                owner,
                rule,
            });
        } // End of the loop over the block's comments
    } // End of the loop over the comment blocks

    attachments.sort_by_key(|attachment| (attachment.span.start, attachment.span.end));
    attachments
} // End of function attribute_comments()

/// One contiguous group of comments that share an owner.
struct CommentBlock {
    /// Indices into the item list, in document order.
    members: Vec<usize>,
    /// `true` when the block is a single comment sitting after content on its
    /// own line.
    inline: bool,
}

/// Groups comment items into blocks.
///
/// Two comments join the same block when nothing but line breaks, indentation
/// and spacing lies between them — no blank line, no frontier leaf, no
/// punctuation. An inline comment is always a block of its own: it trails
/// content rather than introducing anything.
fn comment_blocks(source: &str, items: &[TriviaItem]) -> Vec<CommentBlock> {
    let mut blocks: Vec<CommentBlock> = Vec::new();
    let mut previous: Option<usize> = None;

    for (position, item) in items.iter().enumerate() {
        if item.kind != TriviaKind::Comment {
            continue;
        }
        let inline = is_inline(source, item.span.start);
        let joins = !inline
            && previous.is_some_and(|previous| {
                !blocks
                    .last()
                    .expect("a previous comment made a block")
                    .inline
                    && only_layout_between(items, previous, position)
            });
        if joins {
            blocks
                .last_mut()
                .expect("joining requires a block")
                .members
                .push(position);
        } else {
            blocks.push(CommentBlock {
                members: vec![position],
                inline,
            });
        }
        previous = Some(position);
    } // End of the loop over the trivia items
    blocks
} // End of function comment_blocks()

/// Whether items `from` and `to` are separated only by layout.
///
/// The items in between must be contiguous — a break in the chain means a
/// frontier leaf sat there — and each must be a line break, indentation or
/// spacing. A blank line, punctuation or anything else ends the block.
fn only_layout_between(items: &[TriviaItem], from: usize, to: usize) -> bool {
    let mut cursor = items[from].span.end;
    for item in &items[from + 1..to] {
        if item.span.start != cursor {
            return false;
        }
        if !matches!(
            item.kind,
            TriviaKind::LineBreak | TriviaKind::Indentation | TriviaKind::Spacing
        ) {
            return false;
        }
        cursor = item.span.end;
    } // End of the loop over the items between the two comments
    cursor == items[to].span.start
} // End of function only_layout_between()

/// Whether a comment at `start` follows content on its own line.
///
/// A pure text test, deliberately: what makes a comment inline is that a user
/// sees something before it on the line, which is true whether that something
/// is a scalar, a bracket or a `---` marker.
fn is_inline(source: &str, start: usize) -> bool {
    let line_start = source[..start]
        .rfind(['\n', '\r'])
        .map_or(0, |offset| offset + 1);
    source[line_start..start]
        .chars()
        .any(|character| character != ' ' && character != '\t' && character != '\u{feff}')
} // End of function is_inline()

/// Decides one comment block's owner, and records a hazard where the rules
/// cannot give a safe one.
fn decide(
    source: &str,
    context: &Context<'_>,
    items: &[TriviaItem],
    block: &CommentBlock,
    span: ByteSpan,
    hazards: &mut Vec<Hazard>,
) -> (CommentOwner, OwnershipRule) {
    // Policy, R6: a comment inside a flow collection belongs to no entry, so it
    // belongs to the collection and the collection is refused outright.
    if let Some(flow) = context.enclosing_flow(span) {
        hazards.push(Hazard {
            kind: HazardKind::CommentInFlowCollection,
            span,
            node: Some(flow),
        });
        return (CommentOwner::Node(flow), OwnershipRule::FlowInterior);
    }

    // Rule 3: an inline comment belongs to the entry whose line it is on. That
    // is the node it trails; failing that — a bare `- # why`, where the item is
    // zero width and sits *after* the comment — the node that starts on the
    // same line; failing both, the file.
    if block.inline {
        let owner = context
            .ending_before(source, span.start)
            .or_else(|| trailing_entry_on_line(source, context, span.end));
        return match owner {
            Some(node) => (CommentOwner::Node(node), OwnershipRule::Inline),
            None => (file_owner(context, span), OwnershipRule::Inline),
        };
    }

    let Some(target) = context.starting_after(span.end) else {
        // Policy: nothing follows, so nothing can carry it away.
        return (file_owner(context, span), OwnershipRule::TrailingFile);
    };
    let target = context.descend_to_entry(target, span.end);

    // Rule 4, the load-bearing one: a header comment before the first top-level
    // key belongs to the file and never to the first match. The document it is
    // filed under is the **target's**, not the comment's own position's: in a
    // multi-document stream a header written above the next document's `---`
    // lies past the previous document's extent, so the positional answer names
    // the document the comment is not about.
    if context.is_first_top_level(target) {
        let document_index = context
            .document_index_of(target)
            .unwrap_or_else(|| context.document_index_at(span.start));
        return (
            CommentOwner::File { document_index },
            OwnershipRule::FileHeader,
        );
    }

    // Rule 2: a blank line between the comments and what follows hands them to
    // the file.
    let start = context
        .index
        .node(target)
        .map_or(span.end, |node| node.span.start);
    if blank_line_between(items, span.end, start) {
        return (file_owner(context, span), OwnershipRule::BlankLineSeparated);
    }

    // Rule 1: contiguous comments immediately above an item belong to it.
    (CommentOwner::Node(target), OwnershipRule::LeadingBlock)
} // End of function decide()

/// The zero-width entry a bare `- # why` line introduces after its comment.
///
/// An empty sequence item owns no bytes and the substrate reports it at the end
/// of the line, past the comment. So when nothing ends before an inline comment
/// on its line, the entry that begins on it — still on the same line — is the
/// owner.
fn trailing_entry_on_line(source: &str, context: &Context<'_>, after: usize) -> Option<NodeId> {
    let node = context.starting_after(after)?;
    let start = context.index.node(node)?.span.start;
    same_line(source, after, start).then_some(node)
}

/// The file, as the owner of a comment at `span`.
fn file_owner(context: &Context<'_>, span: ByteSpan) -> CommentOwner {
    CommentOwner::File {
        document_index: context.document_index_at(span.start),
    }
}

/// Whether a blank line lies between two byte offsets.
fn blank_line_between(items: &[TriviaItem], from: usize, to: usize) -> bool {
    items.iter().any(|item| {
        item.kind == TriviaKind::BlankLine && item.span.start >= from && item.span.end <= to
    })
}

/// Whether two byte offsets sit on the same physical line.
fn same_line(source: &str, from: usize, to: usize) -> bool {
    let (from, to) = if from <= to { (from, to) } else { (to, from) };
    source
        .get(from..to)
        .is_some_and(|between| !between.contains(['\n', '\r']))
}

/// Records the hazards that do not arise from comment attribution.
///
/// Four families, in the order they are collected:
///
/// 1. **From the trivia stream** — an explicit `?` key mapping and any bytes
///    the scanner could not classify.
/// 2. **From the nodes** — a truncated block-scalar header (`PROGRESS.md`, R5),
///    an anchor definition, an alias reference, an explicit tag and a merge key
///    (`PROGRESS.md`, R8).
/// 3. **From each mapping** — duplicate keys (plan section 7, row 7).
/// 4. **From the stream** — more than one document.
///
/// The gate this feeds is pessimistic on purpose: families 2 to 4 are all
/// constructs plan section 13 defers out of v1, so refusing them is the
/// specified behaviour rather than a temporary shortfall.
fn collect_hazards(
    source: &str,
    context: &Context<'_>,
    items: &[TriviaItem],
    hazards: &mut Vec<Hazard>,
) {
    trivia_hazards(context, items, hazards);
    node_hazards(source, context, hazards);
    duplicate_key_hazards(context, hazards);
    multi_document_hazards(context, hazards);
} // End of function collect_hazards()

/// Hazards visible in the classified trivia itself.
fn trivia_hazards(context: &Context<'_>, items: &[TriviaItem], hazards: &mut Vec<Hazard>) {
    for item in items {
        match item.kind {
            TriviaKind::Punctuation(Punctuation::ExplicitKey) => {
                // The `?` owns the key it introduces; the construct that is
                // unsafe is the mapping that key belongs to.
                let mapping = item
                    .owner
                    .and_then(|key| context.index.node(key))
                    .and_then(|key| key.parent);
                hazards.push(Hazard {
                    kind: HazardKind::ExplicitKeyMapping,
                    span: item.span,
                    node: mapping,
                });
            }
            // `node` stays `None` when the bytes fall outside every node, and
            // that is not a shrug: a node-less hazard makes the entire document
            // unsafe in `TriviaIndex::is_safely_editable`.
            TriviaKind::Unclassified => hazards.push(Hazard {
                kind: HazardKind::UnclassifiedTrivia,
                span: item.span,
                node: context.innermost_containing(item.span),
            }),
            _ => {}
        }
    } // End of the loop over the trivia items
} // End of function trivia_hazards()

/// Hazards a single node raises on its own.
///
/// Anchors, aliases and tags come straight from the index — the substrate
/// records all three and the safety collector used to ignore them. A merge key
/// has no such flag and must be recognised syntactically, because the substrate
/// hands it over as an ordinary plain scalar key (`PROGRESS.md`, R8).
fn node_hazards(source: &str, context: &Context<'_>, hazards: &mut Vec<Hazard>) {
    for node in context.index.nodes() {
        if node
            .scalar
            .as_ref()
            .is_some_and(|scalar| scalar.header_inside_span())
        {
            hazards.push(Hazard {
                kind: HazardKind::TruncatedBlockScalarHeader,
                span: node.span,
                node: Some(node.id),
            });
        }
        if node.anchor.is_some() {
            hazards.push(Hazard {
                kind: HazardKind::AnchorDefinition,
                span: node.span,
                node: Some(node.id),
            });
        }
        if node.kind == NodeKind::Alias || node.alias_target.is_some() {
            hazards.push(Hazard {
                kind: HazardKind::AliasReference,
                span: node.span,
                node: Some(node.id),
            });
        }
        if node.tag.is_some() {
            hazards.push(Hazard {
                kind: HazardKind::ExplicitTag,
                span: node.span,
                node: Some(node.id),
            });
        }
        if is_merge_key(source, node) {
            // The unsafe construct is the mapping, not the key: a merge brings
            // in entries that are written nowhere inside it.
            hazards.push(Hazard {
                kind: HazardKind::MergeKey,
                span: node.span,
                node: node.parent,
            });
        }
    } // End of the loop over the index's nodes
} // End of function node_hazards()

/// Whether `node` is a merge key — the `<<` of `<<: *defaults`.
///
/// Recognised syntactically, not positionally: it must be a **plain** scalar in
/// key position spelled exactly `<<`. A quoted `'<<'` is an ordinary string key
/// by YAML's own rules and is deliberately not flagged.
fn is_merge_key(source: &str, node: &crate::syntax::Node) -> bool {
    node.role == NodeRole::MappingKey
        && node
            .scalar
            .as_ref()
            .is_some_and(|scalar| scalar.style() == ScalarStyle::Plain)
        && node.span.slice(source) == Some("<<")
} // End of function is_merge_key()

/// One hazard per repeated key of every mapping (plan section 7, row 7).
///
/// Keys are compared by **decoded value**, so `label` and `'label'` are one key
/// exactly as YAML says they are, and a style change cannot hide a duplicate.
/// Non-scalar keys are skipped: an alias or a collection used as a key already
/// raises its own hazard.
fn duplicate_key_hazards(context: &Context<'_>, hazards: &mut Vec<Hazard>) {
    for mapping in context
        .index
        .nodes()
        .iter()
        .filter(|node| node.kind == NodeKind::Mapping)
    {
        let mut seen: Vec<&str> = Vec::new();
        for child in &mapping.children {
            let Some(key) = context.index.node(*child) else {
                continue;
            };
            if key.role != NodeRole::MappingKey {
                continue;
            }
            let Some(value) = key.scalar.as_ref().map(|scalar| scalar.value.as_str()) else {
                continue;
            };
            if seen.contains(&value) {
                hazards.push(Hazard {
                    kind: HazardKind::DuplicateMappingKey,
                    span: key.span,
                    node: Some(mapping.id),
                });
            } else {
                seen.push(value);
            }
        } // End of the loop over one mapping's children
    } // End of the loop over the index's mappings
} // End of function duplicate_key_hazards()

/// One hazard per document when the stream holds more than one.
///
/// Attached to the document nodes themselves, so every node in the file has a
/// flagged ancestor and the whole stream is refused. Espanso reads only the
/// first document, but truncating the others on save would destroy data, and
/// the visual model has no document-scoped path yet.
fn multi_document_hazards(context: &Context<'_>, hazards: &mut Vec<Hazard>) {
    if context.index.documents().len() < 2 {
        return;
    }
    for document in context.index.documents() {
        let Some(node) = context.index.node(*document) else {
            continue;
        };
        hazards.push(Hazard {
            kind: HazardKind::MultiDocumentStream,
            span: node.span,
            node: Some(node.id),
        });
    } // End of the loop over the stream's documents
} // End of function multi_document_hazards()

#[cfg(test)]
mod tests {
    use super::*;

    /// [`Context::ending_before`] as it was written before R19's precomputation:
    /// a scan of every candidate node.
    fn ending_before_by_scan(
        context: &Context<'_>,
        source: &str,
        position: usize,
    ) -> Option<NodeId> {
        context
            .candidates()
            .filter(|node| !node.span.is_empty())
            .filter(|node| node.span.end <= position && same_line(source, node.span.end, position))
            .max_by_key(|node| (node.span.end, context.depth[node.id.get()]))
            .map(|node| node.id)
    } // End of function ending_before_by_scan()

    /// [`Context::starting_after`] as it was written before R19's precomputation.
    fn starting_after_by_scan(context: &Context<'_>, position: usize) -> Option<NodeId> {
        context
            .candidates()
            .filter(|node| node.span.start >= position)
            .min_by_key(|node| (node.span.start, context.depth[node.id.get()]))
            .map(|node| node.id)
    }

    /// [`Context::enclosing_flow`] as it was written before R19's precomputation.
    fn enclosing_flow_by_scan(context: &Context<'_>, span: ByteSpan) -> Option<NodeId> {
        context
            .candidates()
            .filter(|node| node.collection_style == Some(CollectionStyle::Flow))
            .filter(|node| node.span.contains(span))
            .max_by_key(|node| context.depth[node.id.get()])
            .map(|node| node.id)
    }

    #[test]
    fn the_precomputed_primitives_answer_exactly_as_the_scans_they_replaced() {
        // **R19's fix, checked against the code it replaced rather than against
        // the corpus counts alone.** Three primitives, every byte offset of six
        // documents, and — for `enclosing_flow` — every span between two offsets
        // of the flow-bearing ones. The documents are chosen for the shapes that
        // make the tie-breaking observable: nested collections that end at the
        // same byte, a compact `- key: value` whose item and first key start
        // together, an empty value that owns no bytes, and flow collections
        // nested inside one another.
        for source in [
            "matches:\n  - trigger: ':a'\n    replace: x\n  - trigger: ':b'\n",
            "a:\n  b:\n    c: 1\n",
            "outer:\n  - - first\n    - second\n",
            "empty:\n  key:\n  other: 1\n",
            "flow: [1, [2, 3], {k: v}]\nafter: 1\n",
            "# header\n\n# leading\nmatches:\n  - trigger: ':a'  # inline\n",
        ] {
            let index = SyntaxIndex::parse(source).expect("the fixture parses");
            let context = Context::new(&index);
            for position in 0..=source.len() {
                assert_eq!(
                    context.ending_before(source, position),
                    ending_before_by_scan(&context, source, position),
                    "ending_before disagrees at {position} of {source:?}"
                );
                assert_eq!(
                    context.starting_after(position),
                    starting_after_by_scan(&context, position),
                    "starting_after disagrees at {position} of {source:?}"
                );
            } // End of the loop over every byte offset of one document
            for start in 0..=source.len() {
                for end in start..=source.len() {
                    let span = ByteSpan::new(start, end);
                    assert_eq!(
                        context.enclosing_flow(span),
                        enclosing_flow_by_scan(&context, span),
                        "enclosing_flow disagrees on {start}..{end} of {source:?}"
                    );
                } // End of the loop over the spans ending at or after `start`
            } // End of the loop over every span of one document
        } // End of the loop over the documents the primitives are compared on
    } // End of function the_precomputed_primitives_answer_exactly_as_the_scans_they_replaced()

    #[test]
    fn trivia_outside_every_node_names_no_node_at_all() {
        // Proves the `node: None` hazard shape is reachable rather than
        // hypothetical. A document's leading gap lies outside every candidate
        // node — document nodes are deliberately not candidates — so
        // unclassified bytes there can only be attributed to the file, which is
        // why `TriviaIndex::is_safely_editable` has to treat them as global.
        let source = "# header\nmatches: []\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let context = Context::new(&index);
        assert_eq!(context.innermost_containing(ByteSpan::new(0, 8)), None);

        let key = index
            .nodes()
            .iter()
            .find(|node| node.role == NodeRole::MappingKey)
            .expect("a key");
        assert_eq!(context.innermost_containing(key.span), Some(key.id));
    } // End of function trivia_outside_every_node_names_no_node_at_all()

    #[test]
    fn a_merge_key_is_told_apart_from_a_quoted_key_of_the_same_spelling() {
        let source = "a:\n  <<: {x: 1}\n  '<<': plain\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let merges: Vec<&str> = index
            .nodes()
            .iter()
            .filter(|node| is_merge_key(source, node))
            .filter_map(|node| node.span.slice(source))
            .collect();
        assert_eq!(merges, vec!["<<"], "only the plain spelling is a merge key");
    } // End of function a_merge_key_is_told_apart_from_a_quoted_key_of_the_same_spelling()
}
