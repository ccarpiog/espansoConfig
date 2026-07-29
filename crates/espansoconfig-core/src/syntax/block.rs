//! Block-scalar headers and the end-of-content trim.
//!
//! This module owns risk **R3**, the crux of Phase 0b: a `|`/`>` scalar's
//! reported end is *not* the end of the scalar. It is the position of the next
//! non-whitespace character, so the reported span swallows every trailing blank
//! line and the indentation of whatever follows — 30 of the 31 block scalars in
//! the synthetic corpus and 80 of 87 in the owner's real files overshoot
//! (`PROGRESS.md`, D2).
//!
//! Three inputs reconstruct the true end, and no more than three:
//!
//! 1. the reported span,
//! 2. the content indentation, from the start marker's column,
//! 3. the chomping indicator, which lives in the header and which **no parser
//!    exposes** — `saphyr_parser`'s `Chomping` enum sits in a private module.
//!
//! The header itself is lexed by us, one bounded line backwards from the span
//! start. That lexer is guarded against risk **R5**: an empty block scalar
//! (`replace: |` typed but not yet filled in) is the one measured case where
//! the reported span *includes* its own header, and running the backwards lexer
//! there would walk into the previous line.
//!
//! # The content-start convention
//!
//! **A block scalar's content span always begins immediately after the line
//! break that terminates its header line.** One rule, no exceptions: it holds
//! for an ordinary block, for a block that opens with empty lines, and for a
//! truncated header whose span swallowed itself. The span therefore contains
//! every body line's indentation, the first line's included, which makes
//! decoding uniformly "strip `indent` columns from each line" — YAML's own
//! model — and makes the span a safe replacement envelope: writing new,
//! correctly indented lines into it can never leave the header's own line break
//! behind or duplicate the first line's indentation.
//!
//! The alternative — starting at the first content *character* — was rejected
//! because it needs a second, different rule for a block that opens with empty
//! lines, and an emitter that cannot tell the two apart under- or
//! double-indents the first line, which changes YAML structure.

use crate::syntax::{ByteSpan, Chomping, HeaderIndicatorOrder, ScalarStyle};

/// The characters YAML treats as separation around a block-scalar header:
/// horizontal indentation and the two line-break bytes.
///
/// Deliberately **not** `char::is_whitespace`, which accepts non-breaking
/// spaces, `U+2028` and other Unicode whitespace that YAML treats as ordinary
/// scalar data. Absorbing one of those into trivia would delete a character
/// from the user's expansion.
const YAML_SEPARATION: [char; 4] = [' ', '\t', '\r', '\n'];

/// The characters YAML accepts as horizontal indentation. Tabs are never
/// *indentation* in YAML, but they are legal data after it, so both appear in
/// the trailing run a reported block-scalar span can overshoot into.
const YAML_HORIZONTAL: [char; 2] = [' ', '\t'];

/// The line-break characters. YAML normalises `\r\n`, `\n` and a bare `\r` to a
/// single line feed in a scalar's value, so all three must terminate a header
/// line here as well.
const YAML_LINE_BREAK: [char; 2] = ['\n', '\r'];

/// A block-scalar header as written in the source, e.g. `|`, `|-`, `>2+`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockHeader {
    /// Byte span of the indicator text alone: `|2-`, never the trailing
    /// comment and never the line break.
    pub span: ByteSpan,
    /// `|` for a literal block, `>` for a folded one.
    pub indicator: char,
    /// The explicit indentation indicator, when the header carries one.
    ///
    /// Nothing in any parser API reports this; the header text is its only
    /// source.
    pub explicit_indent: Option<usize>,
    /// The chomping indicator, which decides how many trailing line breaks
    /// belong to the value.
    pub chomping: Chomping,
    /// Which of the two indicators was written first, `|2+` or `|+2`.
    ///
    /// The pair (indentation, chomping) is the same for both spellings, so an
    /// emitter that does not carry this cannot reproduce the source bytes of a
    /// `|+2` header.
    pub indicator_order: HeaderIndicatorOrder,
    /// `true` when the header was found *inside* the reported span rather than
    /// on the line above it.
    ///
    /// This is risk R5: a truncated block scalar. It only happens on
    /// incomplete input, which a desktop editor sees on every keystroke.
    pub inside_span: bool,
}

/// The shape of a header, before it is placed in the document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct HeaderShape {
    /// Length of the indicator text in bytes.
    len: usize,
    /// `|` or `>`.
    indicator: char,
    /// Explicit indentation indicator, if any.
    explicit_indent: Option<usize>,
    /// Chomping indicator.
    chomping: Chomping,
    /// Which indicator came first in the source text.
    indicator_order: HeaderIndicatorOrder,
}

/// Matches a block-scalar header at the start of `text`.
///
/// `text` must begin with `|` or `>` and must not span more than one line. The
/// grammar is `[|>] [1-9]? [-+]?` in either indicator order, followed by
/// nothing but spaces, tabs and an optional `#` comment. Requiring the tail to
/// match is what lets a header be told apart from a `|` or `>` that merely
/// occurs inside a key or a comment on the same line.
fn match_header(text: &str) -> Option<HeaderShape> {
    let mut characters = text.char_indices();
    let (_, indicator) = characters.next()?;
    if indicator != '|' && indicator != '>' {
        return None;
    }

    let mut explicit_indent = None;
    let mut chomping = Chomping::Clip;
    // `|2+` and `|+2` are the same header; only the source records which.
    let mut chomping_came_first = false;
    let mut len = indicator.len_utf8();
    for (offset, character) in characters.by_ref() {
        match character {
            '1'..='9' if explicit_indent.is_none() => {
                explicit_indent = Some(character as usize - '0' as usize);
                len = offset + character.len_utf8();
            }
            '-' | '+' if chomping == Chomping::Clip => {
                chomping = if character == '-' {
                    Chomping::Strip
                } else {
                    Chomping::Keep
                };
                chomping_came_first = explicit_indent.is_none();
                len = offset + character.len_utf8();
            }
            _ => break,
        }
    } // End of the loop that reads the header's indicator characters

    // Everything after the indicators must be blank or a comment, otherwise
    // this `|` is not a header at all.
    let tail = text[len..].trim_start_matches(YAML_HORIZONTAL);
    if !tail.is_empty() && !tail.starts_with('#') {
        return None;
    }
    // The order only exists when both indicators do: `|-` and `|2` each have
    // exactly one spelling.
    let indicator_order = if chomping_came_first && explicit_indent.is_some() {
        HeaderIndicatorOrder::ChompingFirst
    } else {
        HeaderIndicatorOrder::IndentFirst
    };
    Some(HeaderShape {
        len,
        indicator,
        explicit_indent,
        chomping,
        indicator_order,
    })
} // End of function match_header()

/// Locates the header of a block scalar whose reported span starts at
/// `span_start`.
///
/// `source` is the whole original document and `span_start` a byte offset into
/// it. Two cases, and the distinction is the R5 guard:
///
/// - The span starts on the first content character, so the header is the tail
///   of the preceding line. It is read backwards, and this is tried **first**
///   (see the comment in the body: a body line may itself open with `|` or `>`
///   and read as a well-formed truncated header).
/// - The span starts with `|` or `>` and nothing precedes it on its own line:
///   the block is truncated and its header is *inside* the span. The header is
///   then read forwards from `span_start` and [`BlockHeader::inside_span`] is
///   set.
///
/// Returns `None` when no well-formed header is found, which on valid input
/// cannot happen.
pub fn locate_header(source: &str, span_start: usize) -> Option<BlockHeader> {
    // Backwards first, forwards only as the fallback. The two lexers can both
    // match, and the ambiguity is not hypothetical: a block scalar whose first
    // body line is `> ` or `|` — a Markdown table inside `replace: |`, or a
    // quoted-reply template — reports a span that starts on that character and
    // reads as a perfectly well-formed truncated header. Preferring the
    // backwards answer resolves every such case correctly, because a genuinely
    // truncated header has nothing but its own key on the line before it, so
    // the backwards lexer finds nothing and the forward path still fires.
    locate_header_backwards(source, span_start)
        .or_else(|| locate_header_inside_span(source, span_start))
} // End of function locate_header()

/// Reads a block-scalar header from the tail of the line preceding the span.
///
/// The span begins at the content indentation column, which may sit in the
/// middle of the first content line's leading white space when the header
/// carried an explicit indentation indicator. Trimming white space and line
/// breaks backwards therefore lands on the header line in every case.
fn locate_header_backwards(source: &str, span_start: usize) -> Option<BlockHeader> {
    let before = source.get(..span_start)?;
    let trimmed = before.trim_end_matches(YAML_SEPARATION);
    let line_start = trimmed.rfind(YAML_LINE_BREAK).map_or(0, |index| index + 1);
    let line = &trimmed[line_start..];

    for (offset, character) in line.char_indices() {
        if character != '|' && character != '>' {
            continue;
        }
        let Some(shape) = match_header(&line[offset..]) else {
            continue;
        };
        let start = line_start + offset;
        return Some(BlockHeader {
            span: ByteSpan::new(start, start + shape.len),
            indicator: shape.indicator,
            explicit_indent: shape.explicit_indent,
            chomping: shape.chomping,
            indicator_order: shape.indicator_order,
            inside_span: false,
        });
    } // End of the loop that scans the preceding line for an indicator
    None
} // End of function locate_header_backwards()

/// Reads a block-scalar header that the reported span swallowed (risk R5).
///
/// Only reachable from incomplete input such as a `replace: |` the user has not
/// finished typing, which a desktop editor sees on every keystroke.
fn locate_header_inside_span(source: &str, span_start: usize) -> Option<BlockHeader> {
    let rest = source.get(span_start..)?;
    if !rest.starts_with(['|', '>']) {
        return None;
    }
    let line = rest.split(YAML_LINE_BREAK).next().unwrap_or(rest);
    let shape = match_header(line)?;
    Some(BlockHeader {
        span: ByteSpan::new(span_start, span_start + shape.len),
        indicator: shape.indicator,
        explicit_indent: shape.explicit_indent,
        chomping: shape.chomping,
        indicator_order: shape.indicator_order,
        inside_span: true,
    })
} // End of function locate_header_inside_span()

/// Length, in bytes, of the genuine content prefix of a block scalar's span.
///
/// `span_text` runs from the content start — immediately after the header
/// line's break — to the end the substrate reported, and that end runs on past
/// the content: first over every trailing blank line, then over the indentation
/// of whatever token comes next. How many of the trailing line breaks are
/// content is decided by the chomping indicator, which only the header knows.
///
/// `at_end_of_source` says whether the reported end is the end of the document.
/// It exists because trailing spaces and tabs are ambiguous: mid-document they
/// are the *next* token's indentation and must be handed back as trivia, but at
/// EOF there is no next token, so horizontal whitespace that carries columns of
/// its own is genuine scalar data and discarding it would silently shorten the
/// user's value.
///
/// # Why the indentation column is needed
///
/// A terminal run of spaces at EOF is content in two different ways, and the
/// second one cannot be seen without knowing how wide the block's indentation
/// is:
///
/// 1. the run sits on a line that already has content before it — `  body  `;
/// 2. the run **is** the whole final line, but reaches past the indentation
///    column, so the surplus columns are scalar data — `|2` plus a final line
///    of three spaces holds one space of content.
///
/// Judging case 2 without `indent` is what made `key: |2-\n   \n   ` decode to
/// `" "` instead of `" \n "`: the final line was written off as trivia because
/// there was nothing to compare its width against. The rule is the substrate's
/// own, measured across spaces, tabs and mixtures of the two: a whitespace-only
/// final line is content exactly when it is **longer than `indent`
/// characters**. A line of `\t` under a two-column block is an empty line; a
/// line of `  \t` is two columns of indentation plus a tab of content.
///
/// This is the derivation `PROGRESS.md` D2 records, and every block scalar in
/// both corpora re-decodes byte-for-byte from its result.
pub fn content_len(
    span_text: &str,
    chomping: Chomping,
    at_end_of_source: bool,
    indent: usize,
) -> usize {
    let trimmed = span_text.trim_end_matches(YAML_HORIZONTAL);
    let without_spaces = if at_end_of_source && terminal_whitespace_is_content(span_text, indent) {
        span_text
    } else {
        trimmed
    };
    let without_breaks = without_spaces.trim_end_matches(YAML_LINE_BREAK);
    match chomping {
        // Keep: every trailing line break is content; only the next token's
        // indentation is trivia.
        Chomping::Keep => without_spaces.len(),
        // Strip: no trailing line break is content.
        Chomping::Strip => without_breaks.len(),
        // Clip: exactly one trailing line break is content, and on a CRLF
        // document that break is two bytes wide.
        Chomping::Clip => {
            let tail = &without_spaces[without_breaks.len()..];
            if tail.starts_with("\r\n") {
                without_breaks.len() + 2
            } else if tail.is_empty() {
                without_breaks.len()
            } else {
                without_breaks.len() + 1
            }
        }
    }
} // End of function content_len()

/// Returns `true` when the horizontal whitespace ending `span_text` at
/// end-of-source is scalar content rather than the next token's indentation.
///
/// Two shapes qualify, and both are measured against the substrate rather than
/// read off the grammar (see [`content_len`]):
///
/// - the final line has non-whitespace before the run, so the run is trailing
///   white space on a content line;
/// - the final line is whitespace only but longer than `indent` characters, so
///   everything past the indentation column is content.
fn terminal_whitespace_is_content(span_text: &str, indent: usize) -> bool {
    if !span_text.ends_with(YAML_HORIZONTAL) {
        return false;
    }
    let last_line = match span_text.rfind(YAML_LINE_BREAK) {
        Some(offset) => &span_text[offset + 1..],
        None => span_text,
    };
    let whitespace_only = last_line.chars().all(|c| YAML_HORIZONTAL.contains(&c));
    if !whitespace_only {
        return true;
    }
    last_line.chars().count() > indent
} // End of function terminal_whitespace_is_content()

/// Byte offset at which a block scalar's content begins.
///
/// This is the single content-start convention of the module documentation:
/// **immediately after the line break that terminates the header line**, so the
/// span carries every body line's indentation, including the first line's.
///
/// `header_end` is the byte just past the indicator text — the rest of the
/// header line may still hold spaces, tabs and a comment — and `limit` is the
/// reported span end, which the result never exceeds. All three line-break
/// spellings terminate the header line: `\r\n`, a bare `\n` and a bare `\r`,
/// matching what [`locate_header`] accepts as a line separator.
///
/// When the header line has no terminator at all — `replace: |` typed at the
/// very end of a file — the content region is empty and starts at `limit`.
fn content_start(source: &str, header_end: usize, limit: usize) -> usize {
    let Some(tail) = source.get(header_end..limit) else {
        return limit;
    };
    let Some(offset) = tail.find(YAML_LINE_BREAK) else {
        return limit;
    };
    // `\r\n` is one break, so step over the `\n` as well when it follows.
    let after_break = if tail[offset..].starts_with("\r\n") {
        offset + 2
    } else {
        offset + 1
    };
    (header_end + after_break).min(limit)
} // End of function content_start()

/// The content region of a block scalar, and the header that describes it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockScalarLayout {
    /// The header, wherever it was found.
    pub header: BlockHeader,
    /// The scalar's content, with the overshoot trimmed away. This is the span
    /// the node carries and the span the frontier publishes.
    pub content: ByteSpan,
    /// The untrimmed span the substrate reported, kept for diagnostics.
    pub reported: ByteSpan,
}

/// Derives a block scalar's true content region from its reported span.
///
/// `reported` is the substrate's span, already converted to byte offsets in
/// original-document coordinates. The content start follows the module's single
/// convention — just past the header line's break — for every shape, so an
/// ordinary block, a block that opens with empty lines and a truncated header
/// all produce spans a caller can treat identically.
///
/// `indent` is the block's content-indentation column — the substrate's own
/// start-marker column, which is the very number
/// [`crate::ScalarPresentation::indent`] carries and the decoder strips. It is
/// threaded in because the end of a block that closes the file cannot be found
/// without it: see [`content_len`].
///
/// Returns `None` when the header cannot be located or the span does not slice
/// the source. The caller must **reject the index** in that case: the reported
/// span is known to overshoot into trailing blank lines and the next node's
/// indentation, so publishing it would hand an editor a replacement envelope
/// that eats a following node.
pub fn layout(
    source: &str,
    reported: ByteSpan,
    style: ScalarStyle,
    indent: usize,
) -> Option<BlockScalarLayout> {
    debug_assert!(style.is_block(), "layout() is only for `|` and `>` scalars");
    let header = locate_header(source, reported.start)?;
    let start = content_start(source, header.span.end, reported.end);
    let span_text = source.get(start..reported.end)?;
    let at_end_of_source = reported.end == source.len();
    let content_end = start + content_len(span_text, header.chomping, at_end_of_source, indent);
    Some(BlockScalarLayout {
        header,
        content: ByteSpan::new(start, content_end),
        reported,
    })
} // End of function layout()

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_header_is_lexed_backwards_from_the_content() {
        let source = "replace: |\n  body\n";
        let content_start = source.find("body").unwrap();
        let header = locate_header(source, content_start).expect("header");
        assert_eq!(header.indicator, '|');
        assert_eq!(header.chomping, Chomping::Clip);
        assert_eq!(header.explicit_indent, None);
        assert!(!header.inside_span);
        assert_eq!(header.span.slice(source), Some("|"));
    }

    #[test]
    fn chomping_and_explicit_indent_are_read_out_of_the_header_text() {
        for (text, chomping, indent) in [
            ("|-", Chomping::Strip, None),
            ("|+", Chomping::Keep, None),
            ("|2-", Chomping::Strip, Some(2)),
            ("|2+", Chomping::Keep, Some(2)),
            (">-", Chomping::Strip, None),
            (">", Chomping::Clip, None),
        ] {
            let source = format!("replace: {text}\n  body\n");
            let content_start = source.find("body").unwrap();
            let header = locate_header(&source, content_start).expect("header");
            assert_eq!(header.chomping, chomping, "chomping of {text}");
            assert_eq!(header.explicit_indent, indent, "indent of {text}");
            assert_eq!(header.span.slice(&source), Some(text), "span of {text}");
        }
    } // End of function chomping_and_explicit_indent_are_read_out_of_the_header_text()

    #[test]
    fn a_pipe_inside_a_key_or_a_comment_is_not_mistaken_for_a_header() {
        // The first `|` belongs to a quoted key, the last one to a comment.
        let source = "\"a|b\": | # a | in a comment\n  body\n";
        let content_start = source.find("body").unwrap();
        let header = locate_header(source, content_start).expect("header");
        assert_eq!(header.span, ByteSpan::new(7, 8));
        assert_eq!(header.span.slice(source), Some("|"));
    }

    #[test]
    fn a_body_line_opening_with_a_block_indicator_is_not_a_truncated_header() {
        // A Markdown table inside `replace: |` starts its reported span on a
        // `|`, exactly like the R5 truncated header does. Before the guard was
        // narrowed to "and `match_header` agrees", every such document was
        // rejected outright with `BlockHeaderNotFound`.
        for body in ["|rest", "| a | b |", ">quoted", "> ", "|", ">"] {
            let source = format!("a: |-\n  {body}\n");
            let span_start = source.rfind(body).expect("body");
            let header = locate_header(&source, span_start).expect("the real header is found");
            assert!(!header.inside_span, "{body}");
            assert_eq!(header.span.slice(&source), Some("|-"), "{body}");
        }
    } // End of function a_body_line_opening_with_a_block_indicator_is_not_a_truncated_header()

    #[test]
    fn a_truncated_header_is_read_forwards_and_flagged() {
        // R5. `replace: |` reports a span that starts with the header itself.
        let source = "replace: |\n";
        let header = locate_header(source, 9).expect("header");
        assert!(header.inside_span, "R5 must be detected");
        assert_eq!(header.span, ByteSpan::new(9, 10));
    }

    #[test]
    fn a_unicode_space_on_the_header_line_is_not_treated_as_separation() {
        // F7. `char::is_whitespace` accepts U+00A0 and U+2028; YAML does not,
        // and absorbing one of them into trivia would delete a character from
        // the user's expansion. The backwards lexer trims only the four bytes
        // in YAML_SEPARATION, so a non-breaking space between the header and
        // the content leaves the `|` unreachable rather than silently eaten.
        for exotic in ['\u{00a0}', '\u{2028}', '\u{3000}'] {
            assert!(
                !YAML_SEPARATION.contains(&exotic),
                "{exotic:?} must not count as YAML separation"
            );
            assert!(
                exotic.is_whitespace(),
                "{exotic:?} fools char::is_whitespace"
            );
        }
    } // End of function a_unicode_space_on_the_header_line_is_not_treated_as_separation()

    #[test]
    fn the_trim_follows_the_chomping_table() {
        // The exact rows measured in Phase 0a on `block-scalars.yml`. None of
        // these ends the document, so the trailing indentation is the next
        // token's and is always trivia.
        assert_eq!(
            content_len(
                "      clip line one\n      clip line two\n\n\n    ",
                Chomping::Clip,
                false,
                6
            ),
            "      clip line one\n      clip line two\n".len()
        );
        assert_eq!(
            content_len("      stripped\n    ", Chomping::Strip, false, 6),
            "      stripped".len()
        );
        assert_eq!(
            content_len("      kept\n\n\n    ", Chomping::Keep, false, 6),
            "      kept\n\n\n".len()
        );
        assert_eq!(
            content_len("      folded clip\n    ", Chomping::Clip, false, 6),
            "      folded clip\n".len()
        );
    } // End of function the_trim_follows_the_chomping_table()

    #[test]
    fn terminal_spaces_and_tabs_at_end_of_source_are_content_not_indentation() {
        // F2 of the Phase 0b-1 review. Mid-document a trailing run of spaces is
        // the next token's indentation; at EOF there is no next token, so it is
        // scalar data. The substrate agrees: `a: |\n  body  ` decodes to
        // "body  \n".
        for chomping in [Chomping::Clip, Chomping::Strip, Chomping::Keep] {
            assert_eq!(
                content_len("  body  ", chomping, true, 2),
                "  body  ".len(),
                "terminal spaces at EOF are content under {chomping:?}"
            );
            assert_eq!(
                content_len("  body\t\t", chomping, true, 2),
                "  body\t\t".len(),
                "terminal tabs at EOF are content under {chomping:?}"
            );
            assert_eq!(
                content_len("  body  ", chomping, false, 2),
                "  body".len(),
                "the same run mid-document is the next token's indentation"
            );
        }
        // A trailing run that forms a whitespace-only line **at or inside** the
        // indentation column is still trivia at EOF: YAML calls that an empty
        // line, so the line break before it already ended the content.
        assert_eq!(
            content_len("  body\n  ", Chomping::Clip, true, 2),
            "  body\n".len()
        );
        assert_eq!(
            content_len("  body\n  ", Chomping::Strip, true, 2),
            "  body".len()
        );
    } // End of function terminal_spaces_and_tabs_at_end_of_source_are_content_not_indentation()

    #[test]
    fn a_whitespace_only_final_line_wider_than_the_indentation_is_content() {
        // Phase 0c-1 review, finding 2. A final line of nothing but white space
        // still carries content when it reaches past the indentation column,
        // and only the indentation column can tell. Every row is a measurement
        // against `saphyr-parser`: `key: |2-` plus a final line of three spaces
        // decodes to " \n ", not to " ".
        assert_eq!(
            content_len("  a\n   ", Chomping::Strip, true, 2),
            "  a\n   ".len(),
            "three columns under a two-column block: one of them is content"
        );
        assert_eq!(
            content_len("  a\n    ", Chomping::Strip, true, 2),
            "  a\n    ".len(),
            "four columns: two of them are content"
        );
        assert_eq!(
            content_len("  a\n  ", Chomping::Strip, true, 2),
            "  a".len(),
            "exactly the indentation is an empty line"
        );
        assert_eq!(
            content_len("  a\n\t", Chomping::Strip, true, 2),
            "  a".len(),
            "a single tab is narrower than the indentation, so it is empty"
        );
        assert_eq!(
            content_len("  a\n  \t", Chomping::Strip, true, 2),
            "  a\n  \t".len(),
            "two columns then a tab: the tab is content"
        );
        // The whole block can be one such line, with no earlier content at all.
        assert_eq!(content_len("   ", Chomping::Strip, true, 2), 3);
        assert_eq!(content_len("  ", Chomping::Strip, true, 2), 0);
        // And keep chomping still counts the trailing breaks as content.
        assert_eq!(
            content_len("  a\n   \n   ", Chomping::Keep, true, 2),
            "  a\n   \n   ".len()
        );
        // Mid-document the same bytes are the next token's indentation.
        assert_eq!(
            content_len("  a\n   ", Chomping::Strip, false, 2),
            "  a".len()
        );
    } // End of function a_whitespace_only_final_line_wider_than_the_indentation_is_content()

    #[test]
    fn a_crlf_clip_keeps_both_bytes_of_the_terminator() {
        assert_eq!(
            content_len("  body\r\n\r\n  ", Chomping::Clip, false, 2),
            "  body\r\n".len()
        );
        assert_eq!(
            content_len("  body\r\n\r\n  ", Chomping::Strip, false, 2),
            "  body".len()
        );
        assert_eq!(
            content_len("  body\r\n\r\n  ", Chomping::Keep, false, 2),
            "  body\r\n\r\n".len()
        );
        // The final-line width test must see the line after a `\r\n`, not the
        // `\n` alone.
        assert_eq!(
            content_len("  body\r\n   ", Chomping::Strip, true, 2),
            "  body\r\n   ".len()
        );
    } // End of function a_crlf_clip_keeps_both_bytes_of_the_terminator()

    #[test]
    fn both_header_indicator_orders_are_recorded() {
        // Phase 0c-1 review, finding 5. `|2+` and `|+2` are the same header to
        // YAML and to the decoded value; only this flag tells them apart, and
        // without it a `|+2` source re-encodes to `|2+`.
        for (text, order) in [
            ("|2+", HeaderIndicatorOrder::IndentFirst),
            ("|+2", HeaderIndicatorOrder::ChompingFirst),
            ("|2-", HeaderIndicatorOrder::IndentFirst),
            ("|-2", HeaderIndicatorOrder::ChompingFirst),
            (">3+", HeaderIndicatorOrder::IndentFirst),
            (">+3", HeaderIndicatorOrder::ChompingFirst),
            // A header with fewer than two indicators has only one spelling.
            ("|+", HeaderIndicatorOrder::IndentFirst),
            ("|-", HeaderIndicatorOrder::IndentFirst),
            ("|2", HeaderIndicatorOrder::IndentFirst),
            ("|", HeaderIndicatorOrder::IndentFirst),
        ] {
            let source = format!("replace: {text}\n  body\n");
            let content_start = source.find("body").unwrap();
            let header = locate_header(&source, content_start).expect("header");
            assert_eq!(header.indicator_order, order, "order of {text}");
            assert_eq!(header.span.slice(&source), Some(text), "span of {text}");
        }
    } // End of function both_header_indicator_orders_are_recorded()

    #[test]
    fn every_block_shape_starts_its_content_after_the_header_line_break() {
        // F1. One convention, three shapes: an ordinary block, a block that
        // opens with empty lines, and a truncated header. In all three the
        // content span begins just past the header line's break, so it carries
        // the first body line's indentation exactly like every later line's.
        let ordinary = "replace: |\n  body\n";
        let start = ordinary.find("body").unwrap();
        let ordinary_layout = layout(
            ordinary,
            ByteSpan::new(start, ordinary.len()),
            ScalarStyle::Literal,
            2,
        )
        .expect("layout");
        assert_eq!(ordinary_layout.content.slice(ordinary), Some("  body\n"));

        let leading = "replace: |\n\n\n  body\n";
        let leading_layout = layout(
            leading,
            ByteSpan::new(leading.find("body").unwrap(), leading.len()),
            ScalarStyle::Literal,
            2,
        )
        .expect("layout");
        assert_eq!(leading_layout.content.slice(leading), Some("\n\n  body\n"));
        assert!(!leading_layout.header.inside_span);

        // R5: the header is inside the span, and the content starts after that
        // header's own line break — never in the middle of the header line.
        let truncated = "replace: |\n";
        let truncated_layout = layout(
            truncated,
            ByteSpan::new(9, truncated.len()),
            ScalarStyle::Literal,
            9,
        )
        .expect("layout");
        assert!(truncated_layout.header.inside_span);
        assert_eq!(truncated_layout.content.slice(truncated), Some(""));
        assert_eq!(truncated_layout.content.start, truncated.len());
    } // End of function every_block_shape_starts_its_content_after_the_header_line_break()

    #[test]
    fn a_bare_cr_terminates_the_header_line_like_a_line_feed() {
        // F8. The header lexer has always accepted CR or LF as a separator; the
        // content start must agree, or a CR-only document puts the header's own
        // line break inside the content span.
        let source = "replace: |\r  body  \r";
        let reported = ByteSpan::new(source.find("body").unwrap(), source.len());
        let block = layout(source, reported, ScalarStyle::Literal, 2).expect("layout");
        assert_eq!(block.content.slice(source), Some("  body  \r"));
        // And CRLF still counts as one break rather than two.
        let crlf = "replace: |\r\n  body\r\n";
        let crlf_layout = layout(
            crlf,
            ByteSpan::new(crlf.find("body").unwrap(), crlf.len()),
            ScalarStyle::Literal,
            2,
        )
        .expect("layout");
        assert_eq!(crlf_layout.content.slice(crlf), Some("  body\r\n"));
    } // End of function a_bare_cr_terminates_the_header_line_like_a_line_feed()

    #[test]
    fn layout_trims_the_overshoot_and_keeps_the_reported_span() {
        let source = "replace: |\n  body\n\n\nnext: 1\n";
        let start = source.find("body").unwrap();
        let reported = ByteSpan::new(start, source.find("next").unwrap());
        let block = layout(source, reported, ScalarStyle::Literal, 2).expect("layout");
        assert_eq!(block.content.slice(source), Some("  body\n"));
        assert_eq!(block.reported, reported);
        assert_eq!(block.header.span.slice(source), Some("|"));
    } // End of function layout_trims_the_overshoot_and_keeps_the_reported_span()
}
