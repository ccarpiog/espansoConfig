//! The gap frontier and its complement.
//!
//! # Definition of record (`PROGRESS.md`, D2b)
//!
//! > The frontier is **`Scalar` and `Alias` spans only, with every block-scalar
//! > end trimmed to its true content end.**
//!
//! Collection markers, document markers and flow brackets are *not* frontier
//! members; they fall in the gaps, where the trivia scanner already expects
//! structural punctuation.
//!
//! Two measured reasons, both in `docs/parser-evaluation.md`:
//!
//! - Untrimmed, the frontier loses 36 blank lines corpus-wide inside
//!   block-scalar spans — trivia by YAML's own chomping rules.
//! - Leaf-only rather than complement-of-all-spans because it stays correct if
//!   a future substrate release gives collections real enclosing extents.
//!   Today they are positional markers and the two definitions cover the same
//!   bytes; under that change, complement-of-all-spans would start silently
//!   dropping comments.
//!
//! Zero-width leaves are excluded from the frontier: they claim no bytes, and
//! including them would only fragment a gap at a mid-line position, which makes
//! a per-gap line scan over-count blank lines.

use crate::syntax::node::NodeId;
use crate::syntax::ByteSpan;

/// One member of the frontier: a leaf and the bytes it owns.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FrontierEntry {
    /// The leaf node that owns these bytes.
    pub node: NodeId,
    /// Its byte span, block-scalar ends already trimmed.
    pub span: ByteSpan,
}

/// One piece of a document, in source order.
///
/// Concatenating the slices of every segment of a document, in order,
/// reproduces the document byte for byte — BOM, CRLF, trailing spaces and a
/// missing final newline included. That is the Phase 0b acceptance property.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Segment {
    /// Bytes no leaf claimed. This is the trivia scanner's entire input in
    /// Phase 0b-2: comments, blank lines, structural punctuation, anchor and
    /// tag spelling, block-scalar headers and the BOM.
    Gap(ByteSpan),
    /// A frontier leaf.
    Leaf(FrontierEntry),
}

impl Segment {
    /// The bytes this segment covers.
    pub fn span(&self) -> ByteSpan {
        match self {
            Segment::Gap(span) => *span,
            Segment::Leaf(entry) => entry.span,
        }
    }

    /// Returns `true` when this segment is trivia rather than a node.
    pub fn is_gap(&self) -> bool {
        matches!(self, Segment::Gap(_))
    }
}

/// Interleaves `frontier` with the byte ranges it leaves uncovered.
///
/// `frontier` must already be sorted and non-overlapping; the index checks that
/// at build time and refuses to publish a frontier that is not.
pub(crate) fn segments(frontier: &[FrontierEntry], source_len: usize) -> Vec<Segment> {
    let mut out = Vec::with_capacity(frontier.len() * 2 + 1);
    let mut cursor = 0usize;
    for entry in frontier {
        if entry.span.start > cursor {
            out.push(Segment::Gap(ByteSpan::new(cursor, entry.span.start)));
        }
        out.push(Segment::Leaf(*entry));
        cursor = entry.span.end;
    }
    if cursor < source_len {
        out.push(Segment::Gap(ByteSpan::new(cursor, source_len)));
    }
    out
} // End of function segments()
