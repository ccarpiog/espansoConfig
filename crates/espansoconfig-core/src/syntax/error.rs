//! Structured failures produced by the span layer.
//!
//! These are **diagnostics, not user-facing prose.** Every string a user can
//! read goes through the frontend i18n layer (plan section 9), so nothing here
//! is ever displayed verbatim. The `Display` implementations exist because
//! `std::error::Error` requires them, and are meant for logs, panics and test
//! output.

use std::fmt;

use serde::Serialize;

/// Why a document could not be turned into a [`crate::syntax::SyntaxIndex`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum SyntaxError {
    /// The YAML substrate rejected the document.
    Parse(ParseFailure),
    /// A reported offset fell outside the document's character domain.
    ///
    /// This is never clamped or saturated: a silently truncated offset is the
    /// exact failure mode that corrupts a user's file (see `PROGRESS.md`, R2).
    Offset(OffsetOutOfDomain),
    /// The index violated one of its own invariants. Always a bug in this
    /// crate, never a property of the input.
    Invariant(InvariantViolation),
}

impl fmt::Display for SyntaxError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SyntaxError::Parse(failure) => write!(formatter, "{failure}"),
            SyntaxError::Offset(offset) => write!(formatter, "{offset}"),
            SyntaxError::Invariant(violation) => write!(formatter, "{violation}"),
        }
    }
}

impl std::error::Error for SyntaxError {}

impl From<OffsetOutOfDomain> for SyntaxError {
    fn from(error: OffsetOutOfDomain) -> SyntaxError {
        SyntaxError::Offset(error)
    }
}

impl From<InvariantViolation> for SyntaxError {
    fn from(error: InvariantViolation) -> SyntaxError {
        SyntaxError::Invariant(error)
    }
}

/// A parse rejection, located precisely enough to drive an editor gutter.
///
/// The substrate reports a character index; `byte_index` is that index after
/// conversion, and is `None` only when the reported index lies outside the
/// document — which would itself be a substrate bug.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ParseFailure {
    /// Offset in Unicode scalar values, as the substrate reported it, counted
    /// from the start of the parsed body (the BOM excluded).
    pub char_index: usize,
    /// The same position as a byte offset into the **original** document, BOM
    /// included, or `None` when the reported index is out of range.
    pub byte_index: Option<usize>,
    /// Line number, as the substrate reports it.
    pub line: usize,
    /// Column number, as the substrate reports it.
    pub column: usize,
    /// The substrate's own message. A developer diagnostic; never displayed.
    pub detail: String,
}

impl fmt::Display for ParseFailure {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "parse rejected at line {} column {} (char {}): {}",
            self.line, self.column, self.char_index, self.detail
        )
    }
}

/// A character offset that the document's conversion table cannot map.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct OffsetOutOfDomain {
    /// The offending character index.
    pub char_index: usize,
    /// Number of Unicode scalar values in the document; valid indices are
    /// `0..=char_len`, the last one being the one-past-the-end sentinel.
    pub char_len: usize,
}

impl fmt::Display for OffsetOutOfDomain {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "character offset {} is outside the document domain 0..={}",
            self.char_index, self.char_len
        )
    }
}

/// An internal consistency failure of the index.
///
/// Each of these is a bug in this crate. They are returned rather than
/// panicked so that a malformed document can never take a caller's process
/// down, and so that the tests can assert on them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum InvariantViolation {
    /// A span whose end precedes its start.
    InvertedSpan {
        /// Reported start byte.
        start: usize,
        /// Reported end byte.
        end: usize,
    },
    /// A span that leaves the document or lands off a UTF-8 boundary.
    SpanOutsideSource {
        /// Reported start byte.
        start: usize,
        /// Reported end byte.
        end: usize,
        /// Length of the document in bytes.
        source_len: usize,
    },
    /// A block scalar whose `|`/`>` header could not be located.
    ///
    /// The reported span of a block scalar is known to overshoot into trailing
    /// blank lines and the **next** node's indentation (`PROGRESS.md`, R3), and
    /// only the header's chomping indicator says where the content really ends.
    /// Without the header there is no correct span to publish, so the index is
    /// rejected rather than quietly handed an envelope that would eat the
    /// following node on the first edit.
    BlockHeaderNotFound {
        /// Start of the reported span, in original-document bytes.
        start: usize,
        /// End of the reported span, in original-document bytes.
        end: usize,
    },
    /// Two frontier spans overlap, or are out of order.
    FrontierOverlap {
        /// End of the earlier frontier span.
        previous_end: usize,
        /// Start of the later frontier span.
        next_start: usize,
    },
    /// The event stream closed a collection that was never opened, or ended
    /// with collections still open.
    UnbalancedEvents {
        /// Nesting depth at the point of failure.
        depth: usize,
    },
}

impl fmt::Display for InvariantViolation {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            InvariantViolation::InvertedSpan { start, end } => {
                write!(formatter, "inverted span {start}..{end}")
            }
            InvariantViolation::SpanOutsideSource {
                start,
                end,
                source_len,
            } => write!(
                formatter,
                "span {start}..{end} is not a valid slice of a {source_len}-byte document"
            ),
            InvariantViolation::BlockHeaderNotFound { start, end } => write!(
                formatter,
                "no block-scalar header found behind the span {start}..{end}"
            ),
            InvariantViolation::FrontierOverlap {
                previous_end,
                next_start,
            } => write!(
                formatter,
                "frontier is not monotonic: {previous_end} > {next_start}"
            ),
            InvariantViolation::UnbalancedEvents { depth } => {
                write!(formatter, "unbalanced collection events at depth {depth}")
            }
        }
    } // End of function fmt() for InvariantViolation
}
