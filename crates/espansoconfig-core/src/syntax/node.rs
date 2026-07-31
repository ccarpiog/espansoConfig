//! The nodes of a [`crate::syntax::SyntaxIndex`].
//!
//! Every node carries a byte span in **original-document coordinates** (byte 0
//! is the first byte on disk, BOM included), a stable identity, and its place
//! in the tree.

use serde::{Deserialize, Serialize};

use crate::syntax::block::BlockHeader;
use crate::syntax::collection::CollectionExtent;
use crate::syntax::{ByteSpan, ScalarPresentation, ScalarStyle};

/// Stable identity of a node inside one parsed document.
///
/// It is an arena index assigned at parse time and never reused, so it stays
/// valid for the lifetime of the index. It is deliberately **not** a positional
/// index into a `matches:` sequence: those shift when entries are reordered,
/// which plan section 6.2 forbids as a match identity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct NodeId(u32);

impl NodeId {
    /// Returns the raw arena index.
    pub fn get(self) -> usize {
        self.0 as usize
    }

    /// Builds an identifier from an arena index.
    ///
    /// Only [`crate::syntax::SyntaxIndex`] should mint these; a value that does
    /// not correspond to a node simply resolves to `None`.
    pub(crate) fn from_index(index: usize) -> NodeId {
        NodeId(u32::try_from(index).unwrap_or(u32::MAX))
    }
}

/// What kind of YAML construct a node is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum NodeKind {
    /// One document of the stream. A file may hold several.
    Document,
    /// A mapping, block or flow.
    Mapping,
    /// A sequence, block or flow.
    Sequence,
    /// A scalar of any of the five styles.
    Scalar,
    /// An alias reference, e.g. `*shared_defaults`.
    Alias,
}

/// Whether a collection is written in block or flow style.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CollectionStyle {
    /// Indentation-delimited: `- item` / `key: value`.
    Block,
    /// Bracket-delimited: `[a, b]` / `{a: 1}`.
    Flow,
}

/// The structural position a node occupies in its parent.
///
/// Recorded syntactically rather than positionally, because a path resolver
/// that assumes "key, then value, then key" is defeated by merge keys and
/// aliases (`PROGRESS.md`, R8): `<<` arrives as an ordinary scalar key and an
/// alias is not a scalar value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NodeRole {
    /// A whole document in the stream.
    Document,
    /// The single root node of a document.
    DocumentRoot,
    /// A key of the enclosing mapping.
    MappingKey,
    /// The value of the mapping key that precedes it.
    MappingValue,
    /// An item of the enclosing sequence.
    SequenceItem,
}

/// An anchor definition attached to a node (`&name`).
///
/// The substrate reports a numeric identity only; the **spelling** is never
/// exposed and always falls outside the node's span, so it is gap material for
/// the trivia scanner in Phase 0b-2.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AnchorId(pub usize);

/// An explicit tag as the substrate spells it, e.g. `!` + `custom`.
///
/// Like an anchor, a tag always sits outside its node's span.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TagSpelling {
    /// Tag handle, `!` included.
    pub handle: String,
    /// Tag suffix.
    pub suffix: String,
}

/// Everything a scalar node records beyond its span.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScalarNode {
    /// The decoded value, exactly as the substrate produced it. Escapes are
    /// resolved, block scalars are de-indented and folded, chomping applied.
    pub value: String,
    /// How the scalar is written, and where its parts live.
    pub presentation: ScalarPresentation,
    /// The span the substrate reported, before any trimming.
    ///
    /// For a **plain** scalar this equals the node's span. For a **block**
    /// scalar it overshoots into trailing blank lines and the next line's
    /// indentation, which is exactly risk R3; for a **quoted** scalar it
    /// overshoots trailing spaces and a following comment on the same line, a
    /// smaller version of the same problem that Phase 0c-2b measured and that
    /// `SyntaxIndex`'s own `quoted_span` trims.
    pub reported_span: ByteSpan,
    /// The block-scalar header, for `|` and `>` scalars only.
    pub header: Option<BlockHeader>,
}

impl ScalarNode {
    /// Returns `true` when the reported span swallowed the scalar's own header.
    ///
    /// This is risk R5, and is only reachable from incomplete input such as a
    /// `replace: |` the user has not finished typing.
    pub fn header_inside_span(&self) -> bool {
        self.header.is_some_and(|header| header.inside_span)
    }

    /// The style the scalar is written in.
    pub fn style(&self) -> ScalarStyle {
        self.presentation.style
    }
}

/// One node of the syntax index.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Node {
    /// Stable identity, an arena index assigned at parse time.
    pub id: NodeId,
    /// Enclosing node, or `None` for a document.
    pub parent: Option<NodeId>,
    /// Children in source order. A document has at most one.
    pub children: Vec<NodeId>,
    /// What kind of construct this is.
    pub kind: NodeKind,
    /// Where it sits in its parent.
    pub role: NodeRole,
    /// Byte span in **original-document coordinates**, BOM included.
    ///
    /// For a scalar this is the token as written: quotes included for a quoted
    /// style, the `|`/`>` header excluded and the trailing overshoot trimmed
    /// for a block style. For a collection it is the extent from its first byte
    /// to the end of its last child (or its closing bracket, in flow style) —
    /// deliberately **not** as far as [`Node::collection_extent`]'s
    /// `owned_end`, because a collection that out-ends its own deepest child
    /// takes that child's trailing `:` and inline comment away from it under
    /// the ownership rules.
    pub span: ByteSpan,
    /// Zero-based index of the document this node belongs to.
    pub document_index: usize,
    /// Anchor definition, when the node carries one.
    pub anchor: Option<AnchorId>,
    /// The anchor an alias refers to, for [`NodeKind::Alias`] nodes.
    pub alias_target: Option<AnchorId>,
    /// Explicit tag, when the node carries one.
    pub tag: Option<TagSpelling>,
    /// Scalar detail, present exactly when `kind` is [`NodeKind::Scalar`].
    pub scalar: Option<ScalarNode>,
    /// Collection style, present exactly for mappings and sequences.
    pub collection_style: Option<CollectionStyle>,
    /// Where the collection ends, present exactly for mappings and sequences.
    ///
    /// [`Node::span`] stops at the last child, which is what the trivia
    /// ownership rules need; [`CollectionExtent::owned_end`] answers one past
    /// the last byte the collection's subtree can claim, which is what a
    /// structural edit needs. The two differ whenever the last entry's
    /// punctuation or inline comment falls past the last child — see
    /// [`crate::syntax::collection`] for the measurement behind that split.
    /// `owned_end()` is deliberately fallible: `None` means the derivation gave
    /// up, and a consumer must refuse rather than substitute this span's end.
    pub collection_extent: Option<CollectionExtent>,
    /// Document markers, present exactly for [`NodeKind::Document`] nodes.
    pub document_markers: Option<DocumentMarkers>,
}

impl Node {
    /// Returns `true` for the two leaf kinds that make up the gap frontier.
    pub fn is_frontier_leaf(&self) -> bool {
        matches!(self.kind, NodeKind::Scalar | NodeKind::Alias)
    }

    /// Returns `true` when the node owns no bytes at all.
    ///
    /// Implicit and empty nodes — `empty:`, a bare `- `, an explicit `? key` /
    /// `: value` — are reported by the substrate as zero-width scalars
    /// (`PROGRESS.md`, R7). They are recorded faithfully; which bytes around
    /// them they may claim is an ownership question left to a later phase.
    pub fn is_zero_width(&self) -> bool {
        self.span.is_empty()
    }
}

/// The explicit `---` and `...` markers of one document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DocumentMarkers {
    /// Span of the `---` directive, when the document start is explicit.
    pub start: Option<ByteSpan>,
    /// Span of the `...` directive, when the document end is explicit.
    pub end: Option<ByteSpan>,
}
