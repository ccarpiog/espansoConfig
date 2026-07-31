//! Span-aware parse and syntax index.
//!
//! This module owns the whole relationship with the YAML substrate. **No other
//! module may import `saphyr_parser`** (`PROGRESS.md`, R1): confining it here is
//! what makes a pre-1.0 dependency tolerable, and the 31 pinned tests in
//! `tests/parser_evaluation.rs` fail loudly if its behaviour changes.
//!
//! # What is here
//!
//! - [`ByteSpan`], [`ScalarStyle`], [`Chomping`] and [`ScalarPresentation`] —
//!   the vocabulary `IMPLEMENTATION_PLAN.md` section 6.2 specifies.
//! - [`CollectionExtent`] — where a collection really ends, which the
//!   substrate's own end marker overstates for every block collection
//!   (`PROGRESS.md`, R3). See [`crate::syntax::collection`] for the measurement
//!   and the rule derived from it.
//! - [`CharToByte`] — the offset adapter. Substrate offsets count Unicode
//!   scalar values, not bytes, and 29 of the 33 spans in the non-ASCII fixture
//!   truncate a character if that is not corrected.
//! - [`DocumentPreamble`] — the BOM strip-and-record, plus line-ending
//!   detection.
//! - [`SyntaxIndex`] and [`Node`] — the tree, with a byte span on every node.
//! - [`FrontierEntry`] and [`Segment`] — the gap frontier and its complement.
//! - [`TriviaIndex`] — the classified contents of every gap, with the comment
//!   ownership rules of plan section 6.2 applied.
//!
//! # Coordinate system
//!
//! **Every published span is a byte range into the original document exactly as
//! it sits on disk, BOM included.** A document that starts with a BOM has its
//! first node span starting at byte 3 or later, and the BOM itself falls in the
//! first gap. That is what makes "concatenate every segment in order" restore
//! the file byte for byte.
//!
//! # Phase status
//!
//! Phase 0b-1 is the byte-accurate span layer: spans, the frontier, and the
//! gaps. **Phase 0b-2 completes Phase 0b**: [`TriviaIndex`] classifies what is
//! *inside* those gaps — comments, blank lines, anchor and tag spelling,
//! block-scalar headers, structural punctuation — and attaches each to a node
//! under the ownership rules in plan section 6.2. Together the two halves make
//! **every byte of a document belong to exactly one frontier leaf or exactly
//! one trivia item.**
//!
//! Nothing here re-serializes. Emission is [`crate::emit`]'s job, and it only
//! ever produces the bytes for the span being replaced.

pub mod block;
mod char_to_byte;
pub mod collection;
pub mod error;
mod frontier;
mod index;
mod node;
mod ownership;
mod preamble;
mod trivia;

pub use block::{BlockHeader, BlockScalarLayout};
pub use char_to_byte::CharToByte;
pub use collection::{CollectionExtent, ExtentDerivation};
pub use error::{InvariantViolation, OffsetOutOfDomain, ParseFailure, SyntaxError};
pub use frontier::{FrontierEntry, Segment};
pub use index::SyntaxIndex;
pub use node::{
    AnchorId, CollectionStyle, DocumentMarkers, Node, NodeId, NodeKind, NodeRole, ScalarNode,
    TagSpelling,
};
pub use preamble::DocumentPreamble;
use serde::{Deserialize, Serialize};

pub use trivia::{
    BlankRun, CommentAttachment, CommentOwner, Hazard, HazardKind, OwnershipRule, Punctuation,
    TriviaIndex, TriviaItem, TriviaKind,
};

/// A half-open byte range `[start, end)` into a document's UTF-8 source.
///
/// Byte offsets, not character offsets: the corpus contains Spanish accents and
/// `⌘`/`⌥`/`⇧` symbols, so a character-indexed span would silently disagree
/// with `&source[span]`.
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
pub struct ByteSpan {
    /// First byte of the span.
    pub start: usize,
    /// One past the last byte of the span.
    pub end: usize,
}

impl ByteSpan {
    /// Creates a span from `start` (inclusive) to `end` (exclusive).
    ///
    /// # Panics
    ///
    /// Panics when `end < start`. An inverted span is always a bug in the
    /// caller, and letting it through would corrupt a file.
    pub fn new(start: usize, end: usize) -> ByteSpan {
        assert!(end >= start, "inverted ByteSpan: {start}..{end}");
        ByteSpan { start, end }
    }

    /// Length of the span in bytes.
    pub fn len(&self) -> usize {
        self.end - self.start
    }

    /// Returns `true` when the span covers no bytes.
    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }

    /// Borrows the slice of `source` this span covers.
    ///
    /// Returns `None` when the span is out of bounds or does not land on UTF-8
    /// character boundaries, rather than panicking as `&source[span]` would.
    pub fn slice<'a>(&self, source: &'a str) -> Option<&'a str> {
        source.get(self.start..self.end)
    }

    /// Returns `true` when `other` lies entirely within this span.
    pub fn contains(&self, other: ByteSpan) -> bool {
        self.start <= other.start && other.end <= self.end
    }

    /// Returns `true` when the two spans share at least one byte.
    ///
    /// **A zero-width span intersects nothing, itself included.** That is the
    /// right answer for the question this method is asked — "would replacing
    /// these bytes disturb those?" — because an empty span has no bytes to
    /// disturb and none to lose. It is *not* the right answer to "may two
    /// replacements be applied in either order": two insertions at one offset
    /// are both empty and still ambiguous, which is why
    /// `crate::patch::edit::apply_edits` tests a shared start separately rather
    /// than calling this.
    pub fn intersects(&self, other: ByteSpan) -> bool {
        self.start < other.end && other.start < self.end
    }
} // End of impl ByteSpan

/// How a scalar is written in the source, independent of its decoded value.
///
/// We read all five. We only ever *emit* the first four: folded scalars change
/// the data on round-trip and are never chosen for new content (section 6.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum ScalarStyle {
    /// Unquoted, e.g. `trigger: :hello`.
    Plain,
    /// `'single quoted'` — backslashes stay literal, preferred for regex.
    SingleQuoted,
    /// `"double quoted"` — the only style with escape sequences.
    DoubleQuoted,
    /// `|` literal block — newlines preserved exactly.
    Literal,
    /// `>` folded block — readable, never emitted.
    Folded,
}

impl ScalarStyle {
    /// Returns `true` for the two block styles (`|` and `>`), which carry a
    /// header line, a content indentation and a chomping mode.
    pub fn is_block(self) -> bool {
        matches!(self, ScalarStyle::Literal | ScalarStyle::Folded)
    }
}

/// The trailing-newline behaviour of a block scalar.
///
/// Recovering this correctly is a hard requirement: getting it wrong silently
/// adds or removes a newline from the user's expansion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum Chomping {
    /// `|-` — strip every trailing newline.
    Strip,
    /// `|` — keep exactly one trailing newline.
    Clip,
    /// `|+` — keep every trailing newline.
    Keep,
}

impl Chomping {
    /// The indicator character, or `None` for the default clip mode.
    pub fn indicator(self) -> Option<char> {
        match self {
            Chomping::Strip => Some('-'),
            Chomping::Clip => None,
            Chomping::Keep => Some('+'),
        }
    }

    /// Chooses the chomping mode that reproduces `value`'s trailing newlines
    /// when written as a literal block (plan section 6.3).
    ///
    /// | Trailing newlines | Chomping |
    /// |---|---|
    /// | none | `-` |
    /// | exactly one | (clip) |
    /// | two or more | `+` |
    pub fn for_value(value: &str) -> Chomping {
        let trailing = value.len() - value.trim_end_matches('\n').len();
        match trailing {
            0 => Chomping::Strip,
            1 => Chomping::Clip,
            _ => Chomping::Keep,
        }
    }
}

/// The order a block header's two optional indicators were written in.
///
/// YAML's `c-b-block-header` production accepts **either** order — `|2+` and
/// `|+2` are the same header — and nothing in the decoded value or in the pair
/// (indentation, chomping) records which one the file actually holds. Without
/// this field a `|+2` header re-encodes to `|2+` and the emitter reports
/// success while the file changed, which is precisely the class of unrequested
/// reformatting this crate exists to prevent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum HeaderIndicatorOrder {
    /// `|2+`, `|2`, `|+`, `|` — the indentation indicator first, which is also
    /// the spelling chosen for a header this crate writes from scratch.
    #[default]
    IndentFirst,
    /// `|+2` — the chomping indicator first.
    ChompingFirst,
}

/// Everything needed to rewrite a scalar in place without disturbing its
/// presentation (plan section 6.2).
///
/// `header_span` and `content_span` are separate because a block scalar can be
/// edited two different ways: changing the value rewrites `content_span` only,
/// while changing the trailing-newline count rewrites `header_span` only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScalarPresentation {
    /// How the scalar is written.
    pub style: ScalarStyle,
    /// For block scalars, the `|`/`>` indicator line including its chomping and
    /// explicit-indent indicators. For flow scalars, the opening quote (empty
    /// for plain scalars).
    pub header_span: ByteSpan,
    /// The scalar's content bytes, quotes and block header excluded.
    ///
    /// # The block-scalar convention — one rule, no exceptions
    ///
    /// For a `|` or `>` scalar the content span begins **immediately after the
    /// line break that terminates the header line**, and therefore *includes*
    /// every body line's indentation, the first line's included. It ends where
    /// the chomping indicator says the value ends, with the trailing blank
    /// lines and the next token's indentation trimmed off.
    ///
    /// This holds identically for an ordinary block, for a block that opens
    /// with empty lines and for a truncated header (`replace: |` with nothing
    /// after it, which yields an empty content span just past the break). A
    /// consumer therefore never has to ask which shape it is looking at:
    ///
    /// - **decoding** is uniformly "strip [`ScalarPresentation::indent`]
    ///   columns from each line", which is YAML's own model;
    /// - **replacing** is uniformly "write whole, `indent`-indented lines",
    ///   which can neither leave the header's line break behind nor duplicate
    ///   the first line's indentation.
    ///
    /// For a flow scalar the content span is the token with its quotes removed,
    /// and for a plain scalar it is the token itself.
    pub content_span: ByteSpan,
    /// Content indentation in columns, for block scalars.
    ///
    /// Taken from the start marker's column, which for a block scalar is the
    /// content-indentation column exactly — the number of columns
    /// [`ScalarPresentation::content_span`] carries at the head of every body
    /// line. For a flow scalar it is simply the column the token starts at.
    pub indent: usize,
    /// Trailing-newline behaviour, meaningful for block scalars only.
    pub chomping: Chomping,
    /// The block header's explicit indentation indicator, e.g. the `2` of
    /// `|2-`.
    ///
    /// No parser API reports this; the header text is its only source. `None`
    /// for a flow scalar and for a block scalar without an indicator.
    pub explicit_indent: Option<usize>,
    /// Which of the two block-header indicators was written first.
    ///
    /// Meaningless — and always [`HeaderIndicatorOrder::IndentFirst`] — for a
    /// flow scalar and for a header carrying fewer than two indicators.
    pub indicator_order: HeaderIndicatorOrder,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn byte_span_slices_multibyte_source_correctly() {
        let source = "trigger: ⌘día";
        // `⌘` is 3 bytes, `í` is 2 bytes: a char-indexed span would be wrong.
        let span = ByteSpan::new(9, source.len());
        assert_eq!(span.slice(source), Some("⌘día"));
        // `⌘` is 3 bytes, `í` is 2, `d` and `a` are 1 each.
        assert_eq!(span.len(), 7);
        assert_eq!(span.slice(source).unwrap().chars().count(), 4);
    }

    #[test]
    fn byte_span_rejects_non_boundary_slices_instead_of_panicking() {
        let source = "⌘";
        assert_eq!(ByteSpan::new(0, 1).slice(source), None);
        assert_eq!(ByteSpan::new(0, 3).slice(source), Some("⌘"));
    }

    #[test]
    fn byte_span_containment() {
        let outer = ByteSpan::new(0, 10);
        assert!(outer.contains(ByteSpan::new(2, 5)));
        assert!(outer.contains(outer));
        assert!(!outer.contains(ByteSpan::new(5, 11)));
    }

    #[test]
    fn chomping_follows_the_trailing_newline_table() {
        assert_eq!(Chomping::for_value("hello"), Chomping::Strip);
        assert_eq!(Chomping::for_value("hello\n"), Chomping::Clip);
        assert_eq!(Chomping::for_value("hello\n\n"), Chomping::Keep);
        assert_eq!(Chomping::for_value("hello\n\n\n"), Chomping::Keep);
        assert_eq!(Chomping::for_value(""), Chomping::Strip);
    }

    #[test]
    fn only_block_styles_report_as_block() {
        assert!(ScalarStyle::Literal.is_block());
        assert!(ScalarStyle::Folded.is_block());
        assert!(!ScalarStyle::Plain.is_block());
        assert!(!ScalarStyle::SingleQuoted.is_block());
        assert!(!ScalarStyle::DoubleQuoted.is_block());
    }
}
