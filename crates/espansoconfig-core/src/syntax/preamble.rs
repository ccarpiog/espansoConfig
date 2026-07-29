//! Document preamble: the UTF-8 BOM and the dominant line ending.
//!
//! No YAML parser strips a BOM, and a BOM immediately before a comment makes
//! the parse fail outright rather than merely mis-decode — `\u{feff}#…` scans
//! as a plain scalar, not a comment (`PROGRESS.md`, D3). So the BOM is removed
//! **before** the substrate ever sees the text, and recorded so the byte can be
//! written back verbatim.
//!
//! # Coordinate system
//!
//! The substrate parses the body — the document with the BOM removed — and
//! reports offsets relative to it. Everything this crate publishes is shifted
//! back into **original-document coordinates**: byte 0 is the first byte on
//! disk, so a document with a BOM has its first node span starting at 3 or
//! later. That is what makes "concatenate every span and gap in order" restore
//! the file exactly, BOM included.

use crate::{LineEnding, UTF8_BOM};

/// What precedes and shapes a document's bytes, recorded so a write-back can
/// reproduce them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DocumentPreamble {
    /// Whether the file on disk begins with a UTF-8 BOM.
    pub bom: bool,
    /// The document's dominant line ending.
    pub line_ending: LineEnding,
    /// Byte offset at which the parsed body begins inside the original
    /// document: `0`, or the width of the BOM.
    pub body_offset: usize,
}

impl DocumentPreamble {
    /// Splits `source` into its preamble and the body the substrate parses.
    ///
    /// The returned `&str` is a suffix of `source`, so
    /// `preamble.body_offset + body.len() == source.len()` always holds.
    pub fn detect(source: &str) -> (DocumentPreamble, &str) {
        match source.strip_prefix(UTF8_BOM) {
            Some(body) => (
                DocumentPreamble {
                    bom: true,
                    line_ending: LineEnding::detect(body),
                    body_offset: UTF8_BOM.len(),
                },
                body,
            ),
            None => (
                DocumentPreamble {
                    bom: false,
                    line_ending: LineEnding::detect(source),
                    body_offset: 0,
                },
                source,
            ),
        }
    } // End of function detect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bom_is_recorded_and_removed_from_the_body() {
        let source = "\u{feff}# header\nmatches: []\n";
        let (preamble, body) = DocumentPreamble::detect(source);
        assert!(preamble.bom);
        assert_eq!(preamble.body_offset, 3);
        assert_eq!(body, "# header\nmatches: []\n");
        assert_eq!(preamble.body_offset + body.len(), source.len());
    }

    #[test]
    fn a_document_without_a_bom_is_its_own_body() {
        let source = "matches: []\n";
        let (preamble, body) = DocumentPreamble::detect(source);
        assert!(!preamble.bom);
        assert_eq!(preamble.body_offset, 0);
        assert_eq!(body, source);
    }

    #[test]
    fn the_line_ending_is_detected_on_the_body_not_the_bom() {
        let (preamble, _) = DocumentPreamble::detect("\u{feff}a: 1\r\nb: 2\r\n");
        assert_eq!(preamble.line_ending, LineEnding::Crlf);
        let (preamble, _) = DocumentPreamble::detect("a: 1\nb: 2\n");
        assert_eq!(preamble.line_ending, LineEnding::Lf);
    }
}
