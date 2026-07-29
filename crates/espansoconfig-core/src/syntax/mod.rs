//! Span-aware parse and syntax index.
//!
//! **Phase 0a scope:** this module defines the vocabulary the rest of the crate
//! speaks — [`ByteSpan`], [`ScalarStyle`], [`Chomping`] and
//! [`ScalarPresentation`] — exactly as specified in `IMPLEMENTATION_PLAN.md`
//! section 6.2. The [`SyntaxIndex`] itself is a placeholder.
//!
//! **Phase 0b responsibility:** build the real index — every node in the
//! document paired with its byte span, its presentation, and the comment and
//! blank-line trivia attached to it under the ownership rules in section 6.2.
//! `docs/parser-evaluation.md` records which parser marks we build on and which
//! facts we must recover with our own lexical scanner.
//!
//! Nothing here re-serializes. Emission is [`crate::emit`]'s job, and it only
//! ever produces the bytes for the span being replaced.

/// A half-open byte range `[start, end)` into a document's UTF-8 source.
///
/// Byte offsets, not character offsets: the corpus contains Spanish accents and
/// `⌘`/`⌥`/`⇧` symbols, so a character-indexed span would silently disagree
/// with `&source[span]`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
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
}

/// How a scalar is written in the source, independent of its decoded value.
///
/// We read all five. We only ever *emit* the first four: folded scalars change
/// the data on round-trip and are never chosen for new content (section 6.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
    pub content_span: ByteSpan,
    /// Content indentation in columns, for block scalars.
    pub indent: usize,
    /// Trailing-newline behaviour, meaningful for block scalars only.
    pub chomping: Chomping,
}

/// Parsed structure of a document paired with its byte spans.
///
/// **Phase 0b will fill this in.** It is deliberately empty rather than
/// speculatively shaped: `docs/parser-evaluation.md` decides what the parser
/// hands us and what our own scanner must recover, and that decision drives the
/// index's design.
#[derive(Debug, Clone, Default)]
pub struct SyntaxIndex {
    /// Span covering the whole document, BOM excluded.
    pub document_span: ByteSpan,
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
