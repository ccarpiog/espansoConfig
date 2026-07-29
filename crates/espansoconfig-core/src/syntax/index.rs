//! The span-accurate syntax index and the builder that produces it.
//!
//! # Coordinate system
//!
//! **Every span this module publishes is a byte range into the original
//! document, exactly as it sits on disk, BOM included.** The substrate parses a
//! BOM-stripped body and reports Unicode-scalar-value offsets into it; both
//! adjustments happen here, once, on the way in. No character offset and no
//! body-relative offset ever escapes `crate::syntax`.
//!
//! # Division of labour
//!
//! `docs/parser-evaluation.md` records which fact comes from which side.
//! Briefly: the substrate gives the tree, the styles, the tags, the alias
//! spans, the exact flow-scalar spans and the block-scalar *start*; we own the
//! character-to-byte conversion, the BOM, the block-scalar header and chomping,
//! the block-scalar *end*, and the collection extents.

use saphyr_parser::{Event, Parser, Span};

use crate::syntax::block;
use crate::syntax::char_to_byte::CharToByte;
use crate::syntax::error::{InvariantViolation, ParseFailure, SyntaxError};
use crate::syntax::frontier::{self, FrontierEntry, Segment};
use crate::syntax::node::{
    AnchorId, CollectionStyle, DocumentMarkers, Node, NodeId, NodeKind, NodeRole, ScalarNode,
    TagSpelling,
};
use crate::syntax::preamble::DocumentPreamble;
use crate::syntax::{ByteSpan, Chomping, ScalarPresentation, ScalarStyle};

/// Parsed structure of a document paired with its byte spans.
///
/// Build one with [`SyntaxIndex::parse`]. The index does **not** hold the
/// source: it is a projection over bytes the caller owns, and every accessor
/// that needs text takes it as an argument.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SyntaxIndex {
    /// Length in bytes of the original document the spans refer to.
    source_len: usize,
    /// BOM and line-ending facts, recorded before parsing.
    preamble: DocumentPreamble,
    /// Every node, in the order the substrate emitted it. The arena index is
    /// the node's [`NodeId`].
    nodes: Vec<Node>,
    /// The documents of the stream, in source order.
    documents: Vec<NodeId>,
    /// The gap frontier: ordered, non-overlapping, zero-width leaves excluded.
    frontier: Vec<FrontierEntry>,
}

impl SyntaxIndex {
    /// Parses `source` — the **original** bytes, BOM included — into an index.
    ///
    /// # Errors
    ///
    /// Returns [`SyntaxError::Parse`] when the substrate rejects the document,
    /// [`SyntaxError::Offset`] when a reported offset falls outside the
    /// document, and [`SyntaxError::Invariant`] when the resulting index would
    /// violate one of its own guarantees.
    pub fn parse(source: &str) -> Result<SyntaxIndex, SyntaxError> {
        Builder::run(source)
    }

    /// Length in bytes of the document the spans refer to.
    pub fn source_len(&self) -> usize {
        self.source_len
    }

    /// BOM presence, line ending and the offset the parsed body started at.
    pub fn preamble(&self) -> DocumentPreamble {
        self.preamble
    }

    /// Every node, indexed by [`NodeId::get`].
    pub fn nodes(&self) -> &[Node] {
        &self.nodes
    }

    /// Resolves a node identifier.
    pub fn node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(id.get())
    }

    /// The documents of the stream, in source order.
    pub fn documents(&self) -> &[NodeId] {
        &self.documents
    }

    /// The gap frontier: `Scalar` and `Alias` spans, block-scalar ends trimmed,
    /// sorted, non-overlapping, zero-width leaves excluded (`PROGRESS.md`,
    /// D2b).
    pub fn frontier(&self) -> &[FrontierEntry] {
        &self.frontier
    }

    /// The byte ranges no frontier leaf claimed.
    ///
    /// This is the trivia scanner's entire input in Phase 0b-2: comments, blank
    /// lines, structural punctuation, anchor and tag spelling, block-scalar
    /// headers, and the BOM.
    pub fn gaps(&self) -> Vec<ByteSpan> {
        self.segments()
            .into_iter()
            .filter_map(|segment| match segment {
                Segment::Gap(span) => Some(span),
                Segment::Leaf(_) => None,
            })
            .collect()
    }

    /// The frontier and its complement interleaved, in source order.
    ///
    /// Concatenating every segment's slice reproduces the document byte for
    /// byte.
    pub fn segments(&self) -> Vec<Segment> {
        frontier::segments(&self.frontier, self.source_len)
    }

    /// The leaves that own no bytes at all.
    ///
    /// Implicit and empty nodes — `empty:`, a bare `- `, `? key` / `: value` —
    /// are reported as zero-width scalars (`PROGRESS.md`, R7). They are
    /// recorded but kept out of the frontier, because a zero-width member would
    /// only fragment a gap without claiming anything.
    pub fn zero_width_leaves(&self) -> impl Iterator<Item = &Node> {
        self.nodes
            .iter()
            .filter(|node| node.is_frontier_leaf() && node.is_zero_width())
    }

    /// Every block scalar whose reported end overshot its true content end.
    ///
    /// Kept as an observable so tests and diagnostics can measure risk R3
    /// without re-deriving it.
    pub fn trimmed_block_scalars(&self) -> impl Iterator<Item = &Node> {
        self.nodes.iter().filter(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.reported_span.end > node.span.end)
        })
    }
} // End of impl SyntaxIndex

/// Assembles a [`SyntaxIndex`] from the substrate's event stream.
struct Builder<'source> {
    /// The original document, BOM included.
    source: &'source str,
    /// Byte offset at which the parsed body begins: 0, or the BOM width.
    base: usize,
    /// Character-to-byte table over the body.
    table: CharToByte,
    /// The arena.
    nodes: Vec<Node>,
    /// Documents in source order.
    documents: Vec<NodeId>,
    /// Open documents and collections, innermost last.
    stack: Vec<Frame>,
    /// Index of the document currently being read.
    document_index: usize,
}

/// One open document or collection.
struct Frame {
    /// The node this frame is building.
    node: NodeId,
    /// What kind of container it is.
    kind: FrameKind,
    /// Number of children attached so far, which decides key/value alternation.
    children: usize,
    /// Byte span of the opening marker or bracket.
    opening: ByteSpan,
    /// `true` for a bracket-delimited collection.
    flow: bool,
}

/// The container kinds the builder tracks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FrameKind {
    /// A document of the stream.
    Document,
    /// A mapping; children alternate key, value.
    Mapping,
    /// A sequence; every child is an item.
    Sequence,
}

impl<'source> Builder<'source> {
    /// Parses `source` and returns the finished index.
    fn run(source: &'source str) -> Result<SyntaxIndex, SyntaxError> {
        let (preamble, body) = DocumentPreamble::detect(source);
        let mut builder = Builder {
            source,
            base: preamble.body_offset,
            table: CharToByte::new(body),
            nodes: Vec::new(),
            documents: Vec::new(),
            stack: Vec::new(),
            document_index: 0,
        };

        for item in Parser::new_from_str(body) {
            let (event, span) = match item {
                Ok(pair) => pair,
                Err(error) => return Err(builder.parse_failure(&error)),
            };
            builder.on_event(event, span)?;
        }

        if !builder.stack.is_empty() {
            return Err(InvariantViolation::UnbalancedEvents {
                depth: builder.stack.len(),
            }
            .into());
        }
        builder.finish(preamble)
    } // End of function run()

    /// Converts a substrate rejection into a located [`SyntaxError`].
    fn parse_failure(&self, error: &saphyr_parser::ScanError) -> SyntaxError {
        let marker = error.marker();
        SyntaxError::Parse(ParseFailure {
            char_index: marker.index(),
            byte_index: self
                .table
                .byte(marker.index())
                .ok()
                .map(|offset| offset + self.base),
            line: marker.line(),
            column: marker.col(),
            detail: error.info().to_owned(),
        })
    } // End of function parse_failure()

    /// Dispatches one substrate event.
    fn on_event(&mut self, event: Event<'_>, span: Span) -> Result<(), SyntaxError> {
        let byte_span = self
            .table
            .span(span.start.index(), span.end.index(), self.base)?;
        let column = span.start.col();

        match event {
            Event::Nothing | Event::StreamStart | Event::StreamEnd => {}
            Event::DocumentStart(explicit) => self.open_document(byte_span, explicit),
            Event::DocumentEnd => self.close_document(byte_span)?,
            Event::Scalar(value, style, anchor, tag) => {
                let tag = tag.map(|tag| TagSpelling {
                    handle: tag.handle.clone(),
                    suffix: tag.suffix.clone(),
                });
                self.push_scalar(&value, style, anchor, tag, byte_span, column)?;
            }
            Event::Alias(anchor) => self.push_alias(byte_span, anchor)?,
            Event::SequenceStart(anchor, tag) => {
                let tag = tag.map(|tag| TagSpelling {
                    handle: tag.handle.clone(),
                    suffix: tag.suffix.clone(),
                });
                self.open_collection(NodeKind::Sequence, byte_span, anchor, tag)?;
            }
            Event::SequenceEnd => self.close_collection(byte_span)?,
            Event::MappingStart(anchor, tag) => {
                let tag = tag.map(|tag| TagSpelling {
                    handle: tag.handle.clone(),
                    suffix: tag.suffix.clone(),
                });
                self.open_collection(NodeKind::Mapping, byte_span, anchor, tag)?;
            }
            Event::MappingEnd => self.close_collection(byte_span)?,
        }
        Ok(())
    } // End of function on_event()

    /// Starts a new document of the stream.
    fn open_document(&mut self, marker: ByteSpan, explicit: bool) {
        let start = if explicit { Some(marker) } else { None };
        let id = self.allocate(Node {
            id: NodeId::from_index(0),
            parent: None,
            children: Vec::new(),
            kind: NodeKind::Document,
            role: NodeRole::Document,
            span: marker,
            document_index: self.document_index,
            anchor: None,
            alias_target: None,
            tag: None,
            scalar: None,
            collection_style: None,
            document_markers: Some(DocumentMarkers { start, end: None }),
        });
        self.documents.push(id);
        self.stack.push(Frame {
            node: id,
            kind: FrameKind::Document,
            children: 0,
            opening: marker,
            flow: false,
        });
    } // End of function open_document()

    /// Closes the current document and computes its extent.
    ///
    /// The extent runs from the `---` directive, when there is one, or from the
    /// document's root node, to the `...` directive or the end of that root.
    /// The substrate's own `DocumentEnd` marker overshoots into trailing
    /// trivia exactly as a block collection's does, so it is used only when it
    /// really is the three bytes of `...`.
    fn close_document(&mut self, marker: ByteSpan) -> Result<(), SyntaxError> {
        let frame = self.pop_frame()?;
        let explicit_end = (marker.slice(self.source) == Some("...")).then_some(marker);
        let child_extent = self.children_extent(frame.node);

        let start = match (frame.opening, &child_extent) {
            (opening, _) if self.document_marker_is_explicit(frame.node) => opening.start,
            (opening, Some(child)) => opening.start.min(child.start),
            (opening, None) => opening.start,
        };
        let end = match (explicit_end, &child_extent) {
            (Some(marker), _) => marker.end,
            (None, Some(child)) => child.end.max(start),
            (None, None) => start,
        };

        let node = &mut self.nodes[frame.node.get()];
        node.span = ByteSpan::new(start, end);
        if let Some(markers) = node.document_markers.as_mut() {
            markers.end = explicit_end;
        }
        self.document_index += 1;
        Ok(())
    } // End of function close_document()

    /// Whether the document node was opened by an explicit `---`.
    fn document_marker_is_explicit(&self, id: NodeId) -> bool {
        self.nodes[id.get()]
            .document_markers
            .is_some_and(|markers| markers.start.is_some())
    }

    /// Opens a mapping or a sequence.
    fn open_collection(
        &mut self,
        kind: NodeKind,
        marker: ByteSpan,
        anchor: usize,
        tag: Option<TagSpelling>,
    ) -> Result<(), SyntaxError> {
        // A flow collection's start event covers exactly its opening bracket;
        // a block collection's is zero width. Checking the character as well
        // keeps the test honest when a block mapping's first key happens to be
        // a flow collection.
        let flow = marker.len() == 1 && matches!(marker.slice(self.source), Some("[") | Some("{"));
        let role = self.next_role()?;
        let id = self.allocate(Node {
            id: NodeId::from_index(0),
            parent: self.stack.last().map(|frame| frame.node),
            children: Vec::new(),
            kind,
            role,
            span: marker,
            document_index: self.document_index,
            anchor: (anchor > 0).then_some(AnchorId(anchor)),
            alias_target: None,
            tag,
            scalar: None,
            collection_style: Some(if flow {
                CollectionStyle::Flow
            } else {
                CollectionStyle::Block
            }),
            document_markers: None,
        });
        self.attach(id)?;
        self.stack.push(Frame {
            node: id,
            kind: match kind {
                NodeKind::Mapping => FrameKind::Mapping,
                _ => FrameKind::Sequence,
            },
            children: 0,
            opening: marker,
            flow,
        });
        Ok(())
    } // End of function open_collection()

    /// Closes a mapping or a sequence and computes its extent.
    ///
    /// A flow collection ends at its closing bracket, which the substrate
    /// reports exactly. A **block** collection's end marker overshoots into
    /// trailing trivia (risk R3) and cannot simply be trimmed backwards,
    /// because a comment may sit between the collection and the next token. So
    /// the extent is taken from the children, whose own ends are already
    /// trimmed.
    fn close_collection(&mut self, marker: ByteSpan) -> Result<(), SyntaxError> {
        let frame = self.pop_frame()?;
        let child_extent = self.children_extent(frame.node);
        let start = frame.opening.start;
        let end = if frame.flow {
            marker.end.max(start)
        } else {
            child_extent.map_or(start, |child| child.end.max(start))
        };
        self.nodes[frame.node.get()].span = ByteSpan::new(start, end);
        Ok(())
    } // End of function close_collection()

    /// Records a scalar, trimming a block scalar's overshooting end.
    fn push_scalar(
        &mut self,
        value: &str,
        style: saphyr_parser::ScalarStyle,
        anchor: usize,
        tag: Option<TagSpelling>,
        reported: ByteSpan,
        column: usize,
    ) -> Result<(), SyntaxError> {
        let style = map_style(style);
        let (span, presentation, header) = if style.is_block() {
            // No well-formed header behind the span means no correct span
            // exists: the reported one overshoots into trailing blank lines and
            // the next node's indentation, and publishing it would hand an
            // editor a replacement envelope that eats a following node. Reject
            // the index instead of quietly returning a known-bad span.
            let layout = block_layout(self.source, reported, style, column)?;
            (
                layout.content,
                ScalarPresentation {
                    style,
                    header_span: layout.header.span,
                    content_span: layout.content,
                    indent: column,
                    chomping: layout.header.chomping,
                    explicit_indent: layout.header.explicit_indent,
                    indicator_order: layout.header.indicator_order,
                },
                Some(layout.header),
            )
        } else {
            (
                reported,
                flow_presentation(self.source, reported, style, column),
                None,
            )
        };

        let role = self.next_role()?;
        let id = self.allocate(Node {
            id: NodeId::from_index(0),
            parent: self.stack.last().map(|frame| frame.node),
            children: Vec::new(),
            kind: NodeKind::Scalar,
            role,
            span,
            document_index: self.document_index,
            anchor: (anchor > 0).then_some(AnchorId(anchor)),
            alias_target: None,
            tag,
            scalar: Some(ScalarNode {
                value: value.to_owned(),
                presentation,
                reported_span: reported,
                header,
            }),
            collection_style: None,
            document_markers: None,
        });
        self.attach(id)
    } // End of function push_scalar()

    /// Records an alias reference. Alias spans are exact and never trimmed.
    fn push_alias(&mut self, span: ByteSpan, anchor: usize) -> Result<(), SyntaxError> {
        let role = self.next_role()?;
        let id = self.allocate(Node {
            id: NodeId::from_index(0),
            parent: self.stack.last().map(|frame| frame.node),
            children: Vec::new(),
            kind: NodeKind::Alias,
            role,
            span,
            document_index: self.document_index,
            anchor: None,
            alias_target: (anchor > 0).then_some(AnchorId(anchor)),
            tag: None,
            scalar: None,
            collection_style: None,
            document_markers: None,
        });
        self.attach(id)
    } // End of function push_alias()

    /// The role the next child of the innermost frame takes.
    fn next_role(&self) -> Result<NodeRole, SyntaxError> {
        let Some(frame) = self.stack.last() else {
            return Err(InvariantViolation::UnbalancedEvents { depth: 0 }.into());
        };
        Ok(match frame.kind {
            FrameKind::Document => NodeRole::DocumentRoot,
            FrameKind::Sequence => NodeRole::SequenceItem,
            FrameKind::Mapping if frame.children % 2 == 0 => NodeRole::MappingKey,
            FrameKind::Mapping => NodeRole::MappingValue,
        })
    } // End of function next_role()

    /// Pushes a node into the arena and stamps it with its own identifier.
    fn allocate(&mut self, mut node: Node) -> NodeId {
        let id = NodeId::from_index(self.nodes.len());
        node.id = id;
        self.nodes.push(node);
        id
    }

    /// Attaches `child` to the innermost open frame.
    fn attach(&mut self, child: NodeId) -> Result<(), SyntaxError> {
        let Some(frame) = self.stack.last_mut() else {
            return Err(InvariantViolation::UnbalancedEvents { depth: 0 }.into());
        };
        frame.children += 1;
        let parent = frame.node;
        self.nodes[parent.get()].children.push(child);
        self.nodes[child.get()].parent = Some(parent);
        Ok(())
    } // End of function attach()

    /// Pops the innermost frame, or reports an unbalanced event stream.
    fn pop_frame(&mut self) -> Result<Frame, SyntaxError> {
        self.stack
            .pop()
            .ok_or_else(|| InvariantViolation::UnbalancedEvents { depth: 0 }.into())
    }

    /// The span from the first child's start to the last child's end.
    fn children_extent(&self, parent: NodeId) -> Option<ByteSpan> {
        let children = &self.nodes[parent.get()].children;
        let start = children
            .iter()
            .map(|child| self.nodes[child.get()].span.start)
            .min()?;
        let end = children
            .iter()
            .map(|child| self.nodes[child.get()].span.end)
            .max()?;
        Some(ByteSpan::new(start, end.max(start)))
    } // End of function children_extent()

    /// Validates every span and assembles the frontier.
    fn finish(self, preamble: DocumentPreamble) -> Result<SyntaxIndex, SyntaxError> {
        let source_len = self.source.len();
        for node in &self.nodes {
            if node.span.slice(self.source).is_none() {
                return Err(InvariantViolation::SpanOutsideSource {
                    start: node.span.start,
                    end: node.span.end,
                    source_len,
                }
                .into());
            }
        }

        let mut frontier: Vec<FrontierEntry> = self
            .nodes
            .iter()
            .filter(|node| node.is_frontier_leaf() && !node.is_zero_width())
            .map(|node| FrontierEntry {
                node: node.id,
                span: node.span,
            })
            .collect();
        frontier.sort_by_key(|entry| (entry.span.start, entry.span.end));
        for pair in frontier.windows(2) {
            if pair[0].span.end > pair[1].span.start {
                return Err(InvariantViolation::FrontierOverlap {
                    previous_end: pair[0].span.end,
                    next_start: pair[1].span.start,
                }
                .into());
            }
        }

        Ok(SyntaxIndex {
            source_len,
            preamble,
            nodes: self.nodes,
            documents: self.documents,
            frontier,
        })
    } // End of function finish()
} // End of impl Builder

/// Derives a block scalar's layout, or rejects the whole index.
///
/// There is deliberately **no fallback to the reported span.** That span is
/// known to overshoot into trailing blank lines and the next node's indentation
/// (`PROGRESS.md`, R3), so publishing it when the header cannot be located
/// would hand an editor a replacement envelope that silently eats a following
/// node — the worst of the available outcomes. A typed error makes the index
/// unusable instead, which is loud and recoverable.
///
/// The R5 guard still applies inside [`block::layout`]: a truncated header
/// (`replace: |` with nothing after it) produces a span that *starts* with `|`
/// or `>`, is read forwards, and is not a lexer failure.
fn block_layout(
    source: &str,
    reported: ByteSpan,
    style: ScalarStyle,
    indent: usize,
) -> Result<block::BlockScalarLayout, SyntaxError> {
    block::layout(source, reported, style, indent).ok_or_else(|| {
        InvariantViolation::BlockHeaderNotFound {
            start: reported.start,
            end: reported.end,
        }
        .into()
    })
} // End of function block_layout()

/// Translates the substrate's scalar style into ours.
fn map_style(style: saphyr_parser::ScalarStyle) -> ScalarStyle {
    match style {
        saphyr_parser::ScalarStyle::Plain => ScalarStyle::Plain,
        saphyr_parser::ScalarStyle::SingleQuoted => ScalarStyle::SingleQuoted,
        saphyr_parser::ScalarStyle::DoubleQuoted => ScalarStyle::DoubleQuoted,
        saphyr_parser::ScalarStyle::Literal => ScalarStyle::Literal,
        saphyr_parser::ScalarStyle::Folded => ScalarStyle::Folded,
    }
}

/// Splits a flow scalar's token into its opening delimiter and its content.
///
/// A plain scalar has no delimiter, so its header span is zero width at the
/// token start. A quoted scalar's header span is the opening quote and its
/// content span excludes both quotes — the token as a whole stays the node's
/// span, which is what an in-place replacement rewrites.
fn flow_presentation(
    source: &str,
    span: ByteSpan,
    style: ScalarStyle,
    column: usize,
) -> ScalarPresentation {
    let quote = match style {
        ScalarStyle::SingleQuoted => Some('\''),
        ScalarStyle::DoubleQuoted => Some('"'),
        _ => None,
    };
    let text = span.slice(source).unwrap_or_default();
    let content = match quote {
        Some(quote) if text.len() >= 2 && text.starts_with(quote) && text.ends_with(quote) => {
            ByteSpan::new(span.start + 1, span.end - 1)
        }
        _ => span,
    };
    ScalarPresentation {
        style,
        header_span: ByteSpan::new(span.start, content.start),
        content_span: content,
        indent: column,
        chomping: Chomping::Clip,
        explicit_indent: None,
        indicator_order: crate::syntax::HeaderIndicatorOrder::IndentFirst,
    }
} // End of function flow_presentation()

#[cfg(test)]
mod tests {
    use super::*;

    /// Concatenates every segment and checks it reproduces the source.
    fn reconstructs(source: &str) -> bool {
        let index = SyntaxIndex::parse(source).expect("document parses");
        let mut rebuilt = String::with_capacity(source.len());
        for segment in index.segments() {
            rebuilt.push_str(segment.span().slice(source).expect("segment slices"));
        }
        rebuilt == source
    }

    #[test]
    fn a_simple_document_reconstructs_and_pairs_keys_with_values() {
        let source = "matches:\n  - trigger: :a\n    replace: alpha\n";
        assert!(reconstructs(source));
        let index = SyntaxIndex::parse(source).unwrap();
        let keys: Vec<&str> = index
            .nodes()
            .iter()
            .filter(|node| node.role == NodeRole::MappingKey)
            .map(|node| node.span.slice(source).unwrap())
            .collect();
        assert_eq!(keys, vec!["matches", "trigger", "replace"]);
    }

    #[test]
    fn spans_are_expressed_in_original_document_coordinates_including_the_bom() {
        let source = "\u{feff}matches: []\n";
        let index = SyntaxIndex::parse(source).expect("a stripped BOM lets the document parse");
        let first = index
            .nodes()
            .iter()
            .find(|node| node.kind == NodeKind::Scalar)
            .expect("a scalar");
        assert_eq!(first.span.start, 3, "the BOM occupies bytes 0..3");
        assert_eq!(first.span.slice(source), Some("matches"));
        assert!(index.preamble().bom);
        assert!(reconstructs(source));
    }

    #[test]
    fn a_block_scalar_span_excludes_the_header_and_the_overshoot() {
        let source = "matches:\n  - replace: |\n      body\n\n\n    label: x\n";
        let index = SyntaxIndex::parse(source).unwrap();
        let block = index
            .nodes()
            .iter()
            .find(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.style().is_block())
            })
            .expect("a block scalar");
        // The content span carries the body line's own indentation: it starts
        // just past the header line's break, which is the single convention on
        // `ScalarPresentation::content_span`.
        assert_eq!(block.span.slice(source), Some("      body\n"));
        let scalar = block.scalar.as_ref().unwrap();
        assert!(scalar.reported_span.end > block.span.end, "R3 overshoot");
        assert!(
            scalar.reported_span.start > block.span.start,
            "and the reported start is one line's indentation too late"
        );
        assert_eq!(scalar.presentation.header_span.slice(source), Some("|"));
        assert_eq!(scalar.presentation.indent, 6);
        assert!(reconstructs(source));
    } // End of function a_block_scalar_span_excludes_the_header_and_the_overshoot()

    #[test]
    fn flow_collections_span_bracket_to_bracket() {
        let source = "items: [one, two]\n";
        let index = SyntaxIndex::parse(source).unwrap();
        let sequence = index
            .nodes()
            .iter()
            .find(|node| node.kind == NodeKind::Sequence)
            .expect("a sequence");
        assert_eq!(sequence.collection_style, Some(CollectionStyle::Flow));
        assert_eq!(sequence.span.slice(source), Some("[one, two]"));
    }

    #[test]
    fn a_block_collection_ends_where_its_last_child_ends_not_at_the_next_token() {
        // The end marker of a block collection overshoots past a following
        // comment; taking the extent from the children avoids swallowing it.
        let source =
            "matches:\n  - trigger: :a\n\n  # a comment about the next one\n  - trigger: :b\n";
        let index = SyntaxIndex::parse(source).unwrap();
        let first_item = index
            .nodes()
            .iter()
            .find(|node| node.kind == NodeKind::Mapping && node.role == NodeRole::SequenceItem)
            .expect("the first sequence item");
        assert_eq!(first_item.span.slice(source), Some("trigger: :a"));
        assert!(reconstructs(source));
    }

    #[test]
    fn a_truncated_block_header_does_not_make_the_lexer_walk_backwards() {
        // R5: `replace: |` reports a span that includes its own header.
        for source in ["replace: |\n", "replace: |2-\n", "replace: >\n"] {
            let index = SyntaxIndex::parse(source).expect("the substrate accepts it");
            let block = index
                .nodes()
                .iter()
                .find_map(|node| node.scalar.as_ref())
                .filter(|scalar| scalar.style().is_block())
                .or_else(|| {
                    index
                        .nodes()
                        .iter()
                        .filter_map(|node| node.scalar.as_ref())
                        .find(|scalar| scalar.style().is_block())
                })
                .expect("a block scalar");
            assert!(
                block.header_inside_span(),
                "R5 must be flagged for {source:?}"
            );
            assert!(reconstructs(source));
        }
    } // End of function a_truncated_block_header_does_not_make_the_lexer_walk_backwards()

    #[test]
    fn zero_width_nodes_are_recorded_and_kept_out_of_the_frontier() {
        for (source, expected) in [("empty:\n", 1usize), ("-", 1), ("key:\n  :\n", 2)] {
            let index = SyntaxIndex::parse(source).expect("accepted");
            assert_eq!(
                index.zero_width_leaves().count(),
                expected,
                "zero-width leaves in {source:?}"
            );
            assert!(index.frontier().iter().all(|entry| !entry.span.is_empty()));
            assert!(reconstructs(source));
        }
    }

    #[test]
    fn a_rejected_document_reports_a_located_error() {
        let error = SyntaxIndex::parse("key: \"unfinished\n").expect_err("must be rejected");
        match error {
            SyntaxError::Parse(failure) => {
                assert_eq!(failure.byte_index, Some(failure.char_index));
                assert!(failure.line >= 1);
            }
            other => panic!("expected a parse failure, got {other:?}"),
        }
    }

    #[test]
    fn multi_byte_documents_slice_correctly() {
        let source = "a: '¡Hola! ¿Qué tal?'\nb: end\n";
        let index = SyntaxIndex::parse(source).unwrap();
        let quoted = index
            .nodes()
            .iter()
            .find(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.style() == ScalarStyle::SingleQuoted)
            })
            .expect("the quoted scalar");
        assert_eq!(quoted.span.slice(source), Some("'¡Hola! ¿Qué tal?'"));
        let presentation = &quoted.scalar.as_ref().unwrap().presentation;
        assert_eq!(
            presentation.content_span.slice(source),
            Some("¡Hola! ¿Qué tal?")
        );
        assert!(reconstructs(source));
    } // End of function multi_byte_documents_slice_correctly()

    #[test]
    fn a_block_scalar_whose_header_cannot_be_found_is_a_hard_error() {
        // F3. There is no fallback to the reported span, because the reported
        // span is the one thing we know is wrong: it runs into the trailing
        // blank lines and the next node's indentation. `next` below is not a
        // header, so no `|`/`>` precedes the span and the layout fails.
        let source = "next: 1\n  body\n";
        let reported = ByteSpan::new(source.find("body").unwrap(), source.len());
        assert_eq!(
            block::layout(source, reported, ScalarStyle::Literal, 2),
            None
        );
        assert_eq!(
            block_layout(source, reported, ScalarStyle::Literal, 2),
            Err(SyntaxError::Invariant(
                InvariantViolation::BlockHeaderNotFound {
                    start: reported.start,
                    end: reported.end
                }
            ))
        );

        // And the R5 shape is not a failure: a truncated header is read
        // forwards and still yields a layout.
        let truncated = "replace: |\n";
        assert!(block_layout(
            truncated,
            ByteSpan::new(9, truncated.len()),
            ScalarStyle::Literal,
            9
        )
        .is_ok());
    } // End of function a_block_scalar_whose_header_cannot_be_found_is_a_hard_error()

    #[test]
    fn a_multi_document_stream_records_every_document() {
        let source = "---\na: 1\n...\n---\nb: 2\n";
        let index = SyntaxIndex::parse(source).unwrap();
        assert_eq!(index.documents().len(), 2);
        assert!(reconstructs(source));
    }
}
