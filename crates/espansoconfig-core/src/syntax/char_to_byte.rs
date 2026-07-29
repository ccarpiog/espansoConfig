//! Character-index to byte-offset conversion.
//!
//! Every offset the YAML substrate reports is a count of **Unicode scalar
//! values** — exactly Rust's `char` — and not a byte offset, despite what
//! `saphyr_parser::Marker::index`'s own getter documentation claims. That was
//! measured, not assumed: `tests/parser_evaluation.rs` separates all four
//! plausible counting schemes on `corpus/synthetic/unicode-offsets.yml` and
//! asserts the other three are wrong (`PROGRESS.md`, D2).
//!
//! 29 of the 33 spans in the non-ASCII fixture truncate a multi-byte character
//! if the reported value is trusted as a byte index, so this table is the
//! single chokepoint every substrate offset must pass through. **No character
//! offset may escape `crate::syntax`.**

use crate::syntax::error::{InvariantViolation, OffsetOutOfDomain, SyntaxError};
use crate::syntax::ByteSpan;

/// Character-index to byte-offset table for one document.
///
/// Built once per document in O(n) with O(1) lookups. Defined only at Unicode
/// scalar boundaries; an index outside its domain is **rejected**, never
/// saturated, because a clamped offset silently corrupts a file rather than
/// failing loudly.
#[derive(Debug, Clone)]
pub struct CharToByte {
    /// Byte offset of every character, plus a one-past-the-end sentinel so an
    /// exclusive span end converts as well.
    offsets: Vec<usize>,
}

impl CharToByte {
    /// Builds the table for `source`.
    pub fn new(source: &str) -> CharToByte {
        let mut offsets: Vec<usize> = Vec::with_capacity(source.len() + 1);
        offsets.extend(source.char_indices().map(|(index, _)| index));
        offsets.push(source.len());
        CharToByte { offsets }
    }

    /// Number of Unicode scalar values in the document.
    ///
    /// Valid indices are `0..=char_len()`; the last is the sentinel that an
    /// exclusive end offset uses.
    pub fn char_len(&self) -> usize {
        self.offsets.len() - 1
    }

    /// Converts a character index to a byte offset.
    ///
    /// # Errors
    ///
    /// Returns [`OffsetOutOfDomain`] when `char_index` exceeds
    /// [`CharToByte::char_len`]. Callers must not fall back to a clamped value.
    pub fn byte(&self, char_index: usize) -> Result<usize, OffsetOutOfDomain> {
        self.offsets
            .get(char_index)
            .copied()
            .ok_or(OffsetOutOfDomain {
                char_index,
                char_len: self.char_len(),
            })
    }

    /// Converts a half-open character range to a byte span, shifted by `base`.
    ///
    /// `base` is the byte offset at which the parsed body begins inside the
    /// original document — zero, or the width of a stripped BOM — so the
    /// resulting span is always expressed in **original-document
    /// coordinates**.
    ///
    /// # Errors
    ///
    /// Returns [`SyntaxError::Offset`] when either endpoint is out of range and
    /// [`SyntaxError::Invariant`] with [`InvariantViolation::InvertedSpan`] when
    /// `char_end` precedes `char_start`.
    ///
    /// An inverted range is **rejected, never clamped**. Collapsing it to zero
    /// width would leave the index apparently valid at a fabricated coordinate,
    /// which is precisely the silent corruption this whole layer exists to
    /// prevent; and it would make [`InvariantViolation::InvertedSpan`]
    /// unreachable on the one path that can produce one.
    pub fn span(
        &self,
        char_start: usize,
        char_end: usize,
        base: usize,
    ) -> Result<ByteSpan, SyntaxError> {
        let start = base + self.byte(char_start)?;
        let end = base + self.byte(char_end)?;
        if end < start {
            return Err(InvariantViolation::InvertedSpan { start, end }.into());
        }
        Ok(ByteSpan::new(start, end))
    } // End of function span()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_offsets_are_the_identity() {
        let table = CharToByte::new("abc");
        assert_eq!(table.char_len(), 3);
        for index in 0..=3 {
            assert_eq!(table.byte(index), Ok(index));
        }
    }

    #[test]
    fn multibyte_characters_shift_every_later_offset() {
        // `⌘` is 3 bytes and 1 character, so `b` is byte 7 and character 5.
        let source = "a: ⌘\nb: end\n";
        let table = CharToByte::new(source);
        assert_eq!(table.byte(5), Ok(7));
        assert_eq!(&source[table.byte(5).unwrap()..], "b: end\n");
    }

    #[test]
    fn an_out_of_domain_offset_is_rejected_rather_than_saturated() {
        let table = CharToByte::new("ab");
        // The sentinel is in the domain; anything past it is not.
        assert_eq!(table.byte(2), Ok(2));
        assert_eq!(
            table.byte(3),
            Err(OffsetOutOfDomain {
                char_index: 3,
                char_len: 2
            })
        );
    }

    #[test]
    fn spans_are_shifted_into_original_document_coordinates() {
        // A document whose body starts after a 3-byte BOM.
        let table = CharToByte::new("ab");
        assert_eq!(table.span(0, 2, 3).unwrap(), ByteSpan::new(3, 5));
    }

    #[test]
    fn an_inverted_span_is_rejected_rather_than_collapsed_to_zero_width() {
        // F4. `end.max(start)` used to turn a malformed substrate span into a
        // valid-looking zero-width one at a fabricated coordinate, contradicting
        // the module's "rejected, never clamped" contract.
        let table = CharToByte::new("abcdef");
        assert_eq!(
            table.span(4, 1, 0),
            Err(SyntaxError::Invariant(InvariantViolation::InvertedSpan {
                start: 4,
                end: 1
            }))
        );
        // The base shift is applied before the report, so the offsets name real
        // bytes of the original document.
        assert_eq!(
            table.span(4, 1, 3),
            Err(SyntaxError::Invariant(InvariantViolation::InvertedSpan {
                start: 7,
                end: 4
            }))
        );
        // A well-formed empty span at the same coordinate is still accepted.
        assert_eq!(table.span(4, 4, 0), Ok(ByteSpan::new(4, 4)));
    } // End of function an_inverted_span_is_rejected_rather_than_collapsed_to_zero_width()

    #[test]
    fn an_out_of_domain_span_endpoint_is_reported_as_an_offset_error() {
        let table = CharToByte::new("ab");
        assert_eq!(
            table.span(0, 9, 0),
            Err(SyntaxError::Offset(OffsetOutOfDomain {
                char_index: 9,
                char_len: 2
            }))
        );
    } // End of function an_out_of_domain_span_endpoint_is_reported_as_an_offset_error()

    #[test]
    fn the_decomposed_and_precomposed_accents_convert_differently() {
        // Precomposed é is one character and two bytes; decomposed é is two
        // characters and three bytes. This is the distinction the corpus
        // fixture `unicode-offsets.yml` exists to pin.
        let precomposed = CharToByte::new("\u{00e9}x");
        assert_eq!(precomposed.byte(1), Ok(2));
        let decomposed = CharToByte::new("e\u{0301}x");
        assert_eq!(decomposed.byte(1), Ok(1));
        assert_eq!(decomposed.byte(2), Ok(3));
    }
}
