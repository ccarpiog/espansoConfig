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
use serde::de::{Error as DeError, Unexpected};
use serde::{Deserialize, Deserializer, Serialize};

pub use trivia::{
    BlankRun, CommentAttachment, CommentOwner, Hazard, HazardKind, OwnershipRule, Punctuation,
    TriviaIndex, TriviaItem, TriviaKind,
};

/// A half-open byte range `[start, end)` into a document's UTF-8 source.
///
/// Byte offsets, not character offsets: the corpus contains Spanish accents and
/// `⌘`/`⌥`/`⇧` symbols, so a character-indexed span would silently disagree
/// with `&source[span]`.
///
/// # It arrives from outside, and the invariant survives the crossing
///
/// [`serde::Deserialize`] is **hand-written and routes through
/// [`ByteSpan::new`]**, because a derive fills the two fields directly and would
/// therefore admit `{"start":20,"end":10}` — a value [`ByteSpan::new`] refuses
/// and [`ByteSpan::len`] cannot survive. That shape is reachable: a span is an
/// operand of [`crate::validate::Finding`], and a finding travels *inwards*
/// inside a [`crate::persist::Acknowledgement`] since Phase 2b-2a. The impl is
/// the same arrangement [`crate::persist::Acknowledgement`]'s own hand-written
/// one has, for the same reason — the invariant is a property of every value of
/// the type, not a check one constructor happens to make.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub struct ByteSpan {
    /// First byte of the span.
    pub start: usize,
    /// One past the last byte of the span.
    pub end: usize,
}

impl<'de> Deserialize<'de> for ByteSpan {
    /// Reads `{ "start": …, "end": … }` and **refuses** an inverted span.
    ///
    /// # An error rather than a repair, deliberately
    ///
    /// Clamping, swapping or zeroing an inverted span would all produce a span
    /// this crate would then act on — and the acknowledgement it arrived in is
    /// compared against findings recomputed under the lock, so a repaired span
    /// would silently stop matching and refuse the save a second time with no
    /// statement of why. A caller that sent `20..10` is confused about something,
    /// and the honest answer is that this is not a value of this type.
    ///
    /// The refusal is a `serde` error, which for a command argument means Tauri's
    /// own English rejection rather than a [`crate::validate::FindingCode`] — the
    /// same thing every malformed argument on this boundary already produces, and
    /// the reason `set_menu_labels` takes an untyped envelope. It is not worth a
    /// code of its own: no interface this application ships can build one, because
    /// every span it hands back came out of a finding this application wrote.
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<ByteSpan, D::Error> {
        /// The two fields as they arrive, before the invariant is applied.
        #[derive(Deserialize)]
        struct Wire {
            /// First byte of the span, unchecked.
            start: usize,
            /// One past the last byte of the span, unchecked.
            end: usize,
        }
        let Wire { start, end } = Wire::deserialize(deserializer)?;
        if end < start {
            return Err(DeError::invalid_value(
                Unexpected::Unsigned(u64::try_from(end).unwrap_or(u64::MAX)),
                &"a ByteSpan end at or after its start",
            ));
        }
        // Through the constructor rather than beside it: one enforcement point,
        // and the assertion there can no longer be reached from this direction.
        Ok(ByteSpan::new(start, end))
    } // End of function deserialize() for ByteSpan
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

    /// A span that arrives inverted is refused rather than repaired.
    ///
    /// The invariant [`ByteSpan::new`] enforces, checked from the direction a
    /// derive would have left open: a finding travels inwards inside an
    /// acknowledgement, so `{"start":20,"end":10}` is a payload a caller can
    /// really send, and a value of this type carrying it would underflow the
    /// moment anything asked for its length. The empty span is asserted legal in
    /// the same test, because a refusal that also rejected `7..7` would be a
    /// different and wrong rule.
    #[test]
    fn a_deserialized_byte_span_cannot_be_inverted() {
        let ordinary: ByteSpan =
            serde_json::from_str(r#"{"start":10,"end":20}"#).expect("a well-ordered span reads");
        assert_eq!(ordinary, ByteSpan::new(10, 20));
        assert_eq!(ordinary.len(), 10);

        let empty: ByteSpan =
            serde_json::from_str(r#"{"start":7,"end":7}"#).expect("an empty span is legal");
        assert!(empty.is_empty());

        let inverted = serde_json::from_str::<ByteSpan>(r#"{"start":20,"end":10}"#);
        assert!(
            inverted.is_err(),
            "an inverted span must not exist as a value of this type: {inverted:?}"
        );
    } // End of function a_deserialized_byte_span_cannot_be_inverted()

    /// The round trip is the identity for every span this crate can build.
    #[test]
    fn a_byte_span_survives_the_round_trip() {
        for span in [
            ByteSpan::new(0, 0),
            ByteSpan::new(3, 3),
            ByteSpan::new(0, 97),
        ] {
            let json = serde_json::to_string(&span).expect("a span serializes");
            assert_eq!(
                serde_json::from_str::<ByteSpan>(&json).expect("and reads back"),
                span
            );
        }
    } // End of function a_byte_span_survives_the_round_trip()

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
