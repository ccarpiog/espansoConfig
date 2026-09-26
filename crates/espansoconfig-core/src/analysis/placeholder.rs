//! The **named supported placeholder subset** of a form layout (Phase 4-7).
//!
//! # What this parser is, and what it is not
//!
//! It recognises exactly one spelling: `[[identifier]]`, where the identifier is
//! ASCII `[A-Za-z_][A-Za-z0-9_]*` and nothing — no whitespace, no dot, no other
//! character — sits between it and the brackets. That subset is what this
//! repository establishes (`IMPLEMENTATION_PLAN.md` §8.6 and the synthetic
//! `form-layout-and-choice.yml`); it is **not** espanso's complete placeholder
//! grammar, its escaping or its advanced layout syntax, none of which this
//! repository has established. The parser is therefore never called
//! espanso-compatible (`docs/decisions/4-split-notes.md` §3 ruling 16).
//!
//! # Every character is kept
//!
//! [`PlaceholderLayout::parse`] answers an ordered list of [`LayoutSegment`]s
//! whose spans tile the input exactly: no byte is dropped, none is covered
//! twice, and concatenating the segments' slices reproduces the text. A region
//! that opens like a placeholder and is not one of the supported spelling is a
//! [`LayoutSegment::Malformed`] segment — **reported**, never repaired and
//! never silently treated as text — so a caller can tell "this layout is inside
//! the supported subset" ([`PlaceholderLayout::is_fully_supported`]) from "this
//! layout holds syntax the subset does not read".

use serde::Serialize;

use crate::syntax::ByteSpan;

/// Why a region that opens with `[[` is not a supported placeholder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum MalformedPlaceholder {
    /// `[[]]` — nothing between the brackets.
    Empty,
    /// Something is between the brackets, and it is not an identifier of the
    /// supported spelling (whitespace, a dot, a hyphen, a leading digit, a
    /// non-ASCII letter, a line break, a third bracket …).
    InvalidIdentifier,
    /// A `[[` with no `]]` after it before the next `[[`, or none at all.
    /// Only the two opening bytes are this segment; the text after them is
    /// scanned again.
    Unterminated,
}

/// One tile of a parsed layout. Spans are byte offsets into the text that was
/// parsed, never into a document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LayoutSegment {
    /// Text that is not a placeholder and does not open one.
    Text {
        /// The bytes of the text.
        span: ByteSpan,
    },
    /// A supported `[[identifier]]` placeholder.
    Placeholder {
        /// The whole `[[identifier]]`, brackets included.
        span: ByteSpan,
        /// The identifier between the brackets.
        name: String,
    },
    /// A region that opens with `[[` and is not a supported placeholder.
    Malformed {
        /// The region, from its `[[` through its `]]` when it has one.
        span: ByteSpan,
        /// Why it is not a supported placeholder.
        reason: MalformedPlaceholder,
    },
}

impl LayoutSegment {
    /// The bytes this segment covers.
    pub fn span(&self) -> ByteSpan {
        match self {
            LayoutSegment::Text { span }
            | LayoutSegment::Placeholder { span, .. }
            | LayoutSegment::Malformed { span, .. } => *span,
        }
    }
}

/// Every occurrence of one placeholder name, in layout order.
///
/// Repeated occurrences of one name are one displayed field row (the consult's
/// Q4); this is the grouping that row is built from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlaceholderGroup {
    /// The identifier.
    pub name: String,
    /// The span of every `[[name]]`, in layout order; never empty.
    pub occurrences: Vec<ByteSpan>,
}

/// A layout, parsed into the supported subset.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PlaceholderLayout {
    /// The tiles, in text order, covering the whole input exactly once.
    pub segments: Vec<LayoutSegment>,
}

impl PlaceholderLayout {
    /// Parses `text` into the supported placeholder subset.
    ///
    /// Total and linear: every input produces a layout, and each byte is
    /// examined a bounded number of times.
    pub fn parse(text: &str) -> PlaceholderLayout {
        let bytes = text.as_bytes();
        let mut segments = Vec::new();
        let mut text_start = 0;
        let mut at = 0;
        // The next `]]` and `[[` at or after a position, remembered across
        // iterations so that each search runs forward from where the last one
        // stopped rather than from each opener to the end (the 4-7 review's
        // fourth finding: repeated unterminated openers were quadratic).
        let mut closers = NextDelimiter::new("]]");
        let mut openers = NextDelimiter::new("[[");
        while at + 1 < bytes.len() {
            if !(bytes[at] == b'[' && bytes[at + 1] == b'[') {
                at += 1;
                continue;
            }
            push_text(&mut segments, text_start, at);
            let inner_start = at + 2;
            let close = closers.at_or_after(text, inner_start);
            let reopen = openers.at_or_after(text, inner_start);
            let end = match close {
                // A `]]` before any other `[[`: the region is closed.
                Some(close) if reopen.is_none_or(|reopen| close < reopen) => {
                    let inner = &text[inner_start..close];
                    let span = ByteSpan::new(at, close + 2);
                    segments.push(classify(inner, span));
                    span.end
                }
                // No `]]`, or another `[[` first: only the opener is reported,
                // and the scan resumes after it.
                _ => {
                    let span = ByteSpan::new(at, inner_start);
                    segments.push(LayoutSegment::Malformed {
                        span,
                        reason: MalformedPlaceholder::Unterminated,
                    });
                    span.end
                }
            };
            at = end;
            text_start = end;
        } // End of the loop over the layout's bytes
        push_text(&mut segments, text_start, bytes.len());
        PlaceholderLayout { segments }
    } // End of function parse()

    /// Every supported placeholder, in layout order, with its name.
    pub fn placeholders(&self) -> impl Iterator<Item = (ByteSpan, &str)> {
        self.segments.iter().filter_map(|segment| match segment {
            LayoutSegment::Placeholder { span, name } => Some((*span, name.as_str())),
            _ => None,
        })
    }

    /// Every malformed region, in layout order.
    pub fn malformed(&self) -> impl Iterator<Item = (ByteSpan, MalformedPlaceholder)> + '_ {
        self.segments.iter().filter_map(|segment| match segment {
            LayoutSegment::Malformed { span, reason } => Some((*span, *reason)),
            _ => None,
        })
    }

    /// Whether the layout holds nothing outside the supported subset.
    ///
    /// Only then may a caller say a field is *not* in the layout: a malformed
    /// region may be a spelling espanso reads and this parser does not.
    pub fn is_fully_supported(&self) -> bool {
        self.malformed().next().is_none()
    }

    /// The placeholders grouped by name, groups in order of first occurrence.
    pub fn groups(&self) -> Vec<PlaceholderGroup> {
        let mut groups: Vec<PlaceholderGroup> = Vec::new();
        for (span, name) in self.placeholders() {
            match groups.iter_mut().find(|group| group.name == name) {
                Some(group) => group.occurrences.push(span),
                None => groups.push(PlaceholderGroup {
                    name: name.to_owned(),
                    occurrences: vec![span],
                }),
            }
        } // End of the loop over the placeholders
        groups
    } // End of function groups()

    /// Whether some supported placeholder is named `name`.
    pub fn contains(&self, name: &str) -> bool {
        self.placeholders().any(|(_, found)| found == name)
    }
} // End of impl PlaceholderLayout

/// The next occurrence of one delimiter, cached across forward-moving queries.
struct NextDelimiter {
    /// The delimiter.
    pattern: &'static str,
    /// The last answer: `None` before the first search, `Some(None)` once no
    /// occurrence remains, `Some(Some(p))` for an occurrence at byte `p`.
    cached: Option<Option<usize>>,
}

impl NextDelimiter {
    /// A cache holding nothing yet.
    fn new(pattern: &'static str) -> NextDelimiter {
        NextDelimiter {
            pattern,
            cached: None,
        }
    }

    /// The first occurrence at or after `from`. Queries must not move
    /// backwards; each byte is then searched a bounded number of times.
    fn at_or_after(&mut self, text: &str, from: usize) -> Option<usize> {
        match self.cached {
            Some(None) => return None,
            Some(Some(found)) if found >= from => return Some(found),
            _ => {}
        }
        let found = text
            .get(from..)
            .and_then(|rest| rest.find(self.pattern))
            .map(|offset| from + offset);
        self.cached = Some(found);
        found
    }
} // End of impl NextDelimiter

/// Appends a text segment for `start..end`, unless it would be empty.
fn push_text(segments: &mut Vec<LayoutSegment>, start: usize, end: usize) {
    if start < end {
        segments.push(LayoutSegment::Text {
            span: ByteSpan::new(start, end),
        });
    }
}

/// The segment a closed `[[inner]]` region is.
fn classify(inner: &str, span: ByteSpan) -> LayoutSegment {
    if inner.is_empty() {
        LayoutSegment::Malformed {
            span,
            reason: MalformedPlaceholder::Empty,
        }
    } else if is_supported_identifier(inner) {
        LayoutSegment::Placeholder {
            span,
            name: inner.to_owned(),
        }
    } else {
        LayoutSegment::Malformed {
            span,
            reason: MalformedPlaceholder::InvalidIdentifier,
        }
    }
} // End of function classify()

/// Whether `text` is an identifier of the supported spelling,
/// `[A-Za-z_][A-Za-z0-9_]*`.
pub fn is_supported_identifier(text: &str) -> bool {
    let mut bytes = text.bytes();
    let Some(first) = bytes.next() else {
        return false;
    };
    (first.is_ascii_alphabetic() || first == b'_')
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

#[cfg(test)]
mod tests {
    use super::{is_supported_identifier, LayoutSegment, MalformedPlaceholder, PlaceholderLayout};

    /// The slices of every segment, concatenated.
    fn rebuilt(text: &str) -> String {
        PlaceholderLayout::parse(text)
            .segments
            .iter()
            .map(|segment| segment.span().slice(text).expect("in bounds"))
            .collect()
    }

    /// Every character survives, for well-formed and malformed layouts alike,
    /// and the segments tile the input with no gap and no overlap.
    #[test]
    fn every_character_is_kept() {
        for text in [
            "",
            "plain",
            "[[a]]",
            "Hi [[name]], [[name]] again",
            "[[ spaced ]] and [[1digit]] and [[]] and [[open",
            "[[[triple]]]",
            "[[a [[b]]",
            "é [[x]] 😀 [[é]]",
            "]] [[x]",
            "[",
            "[[",
        ] {
            assert_eq!(rebuilt(text), text, "{text:?} must round-trip");
            let layout = PlaceholderLayout::parse(text);
            let mut cursor = 0;
            for segment in &layout.segments {
                assert_eq!(segment.span().start, cursor, "{text:?}: a gap or overlap");
                assert!(!segment.span().is_empty(), "{text:?}: an empty segment");
                cursor = segment.span().end;
            }
            assert_eq!(cursor, text.len());
        } // End of the loop over the sample layouts
    } // End of function every_character_is_kept()

    /// Repeated placeholders group under one name, in order of first
    /// occurrence.
    #[test]
    fn repeated_placeholders_are_one_group() {
        let layout = PlaceholderLayout::parse("[[b]] [[a]] [[b]]");
        let groups = layout.groups();
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].name, "b");
        assert_eq!(groups[0].occurrences.len(), 2);
        assert_eq!(groups[1].name, "a");
        assert!(layout.is_fully_supported());
    }

    /// Each malformed spelling is reported with its reason, and makes the
    /// layout not fully supported.
    #[test]
    fn malformed_regions_are_reported_not_repaired() {
        let cases = [
            ("[[]]", MalformedPlaceholder::Empty),
            ("[[ name ]]", MalformedPlaceholder::InvalidIdentifier),
            ("[[1st]]", MalformedPlaceholder::InvalidIdentifier),
            ("[[a-b]]", MalformedPlaceholder::InvalidIdentifier),
            ("[[a.b]]", MalformedPlaceholder::InvalidIdentifier),
            ("[[é]]", MalformedPlaceholder::InvalidIdentifier),
            ("[[a\nb]]", MalformedPlaceholder::InvalidIdentifier),
            ("[[open", MalformedPlaceholder::Unterminated),
        ];
        for (text, reason) in cases {
            let layout = PlaceholderLayout::parse(text);
            let found: Vec<MalformedPlaceholder> = layout.malformed().map(|(_, r)| r).collect();
            assert_eq!(found, vec![reason], "{text:?}");
            assert!(!layout.is_fully_supported());
            assert_eq!(layout.placeholders().count(), 0, "{text:?}");
        }
    } // End of function malformed_regions_are_reported_not_repaired()

    /// An opener followed by another opener reports only the first, and the
    /// second still parses.
    #[test]
    fn a_reopened_region_reports_the_first_opener_only() {
        let layout = PlaceholderLayout::parse("[[a [[b]]");
        assert_eq!(
            layout.segments[0],
            LayoutSegment::Malformed {
                span: crate::syntax::ByteSpan::new(0, 2),
                reason: MalformedPlaceholder::Unterminated
            }
        );
        assert!(layout.contains("b"));
        assert!(!layout.contains("a"));
    } // End of function a_reopened_region_reports_the_first_opener_only()

    /// The identifier spelling is exactly `[A-Za-z_][A-Za-z0-9_]*`.
    #[test]
    fn the_identifier_spelling_is_the_named_subset() {
        for good in ["a", "_", "A_9", "_x1", "name"] {
            assert!(is_supported_identifier(good), "{good:?}");
        }
        for bad in ["", "9a", "a b", "a-b", "a.b", "é", " a"] {
            assert!(!is_supported_identifier(bad), "{bad:?}");
        }
    }
}
