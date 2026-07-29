//! Decoding a scalar's source bytes into its logical string value.
//!
//! This is the read half of the codec: source bytes in, logical `String` out.
//! [`super::plan`] is the write half, and the two are inverses wherever a
//! presentation is capable of being one (see [`super::reencode_in_place`]).
//!
//! # Why we decode at all, when the substrate already did
//!
//! `saphyr-parser` reports a decoded value on every scalar event, and
//! [`crate::syntax::ScalarNode::value`] keeps it. That value is the *oracle*
//! this module is tested against, not a replacement for it: the patch engine
//! must be able to decode a scalar it is about to rewrite from nothing but the
//! source text and a [`ScalarPresentation`], without re-running the parser over
//! the whole document, and it must round a value it wrote back to the value it
//! meant. Owning the decoder is also what makes
//! "did the presentation survive this edit?" a question we can answer.
//!
//! # The block-scalar shortcut
//!
//! Chomping is **already applied** by the span layer: `content_span` ends
//! exactly where the chomping indicator says the value ends (`PROGRESS.md`,
//! D2c). Decoding a block scalar is therefore uniformly "strip
//! [`ScalarPresentation::indent`] columns from each line", plus folding for `>`.
//! This module must not re-apply chomping, and does not.

use std::fmt;

use crate::syntax::{ByteSpan, ScalarPresentation, ScalarStyle};

/// Why a scalar's source bytes could not be decoded.
///
/// Diagnostics, not user-facing prose: every string a user reads goes through
/// the frontend i18n layer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodeError {
    /// The presentation's content span does not slice the source, or does not
    /// land on UTF-8 character boundaries.
    SpanOutsideSource {
        /// The span that failed to slice.
        span: ByteSpan,
        /// Length of the source it was applied to.
        source_len: usize,
    },
    /// A double-quoted scalar carries an escape YAML does not define.
    UnknownEscape {
        /// The character that followed the backslash.
        escape: char,
    },
    /// A `\x`, `\u` or `\U` escape is truncated or is not hexadecimal.
    MalformedNumericEscape {
        /// The escape introducer: `x`, `u` or `U`.
        introducer: char,
    },
    /// A `\u`/`\U` escape names a value that is not a Unicode scalar value —
    /// a surrogate, or a code point above `U+10FFFF`.
    InvalidCodePoint {
        /// The numeric value the escape named.
        value: u32,
    },
    /// A double-quoted scalar ends with a dangling backslash.
    TrailingBackslash,
}

impl fmt::Display for DecodeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DecodeError::SpanOutsideSource { span, source_len } => write!(
                formatter,
                "content span {}..{} does not slice a {source_len}-byte source",
                span.start, span.end
            ),
            DecodeError::UnknownEscape { escape } => {
                write!(formatter, "unknown escape sequence \\{escape}")
            }
            DecodeError::MalformedNumericEscape { introducer } => {
                write!(formatter, "malformed \\{introducer} escape")
            }
            DecodeError::InvalidCodePoint { value } => {
                write!(formatter, "escape names invalid code point U+{value:04X}")
            }
            DecodeError::TrailingBackslash => {
                write!(formatter, "double-quoted scalar ends with a backslash")
            }
        }
    } // End of function fmt()
}

impl std::error::Error for DecodeError {}

/// The characters YAML accepts as horizontal white space inside a scalar.
const HORIZONTAL: [char; 2] = [' ', '\t'];

/// Decodes the scalar `presentation` describes out of `source`.
///
/// `source` is the whole original document, BOM included — the same coordinate
/// system every span in [`crate::syntax`] uses.
///
/// # Errors
///
/// Returns [`DecodeError::SpanOutsideSource`] when the presentation does not
/// belong to this source, and one of the escape errors when a double-quoted
/// scalar is malformed. Plain, single-quoted and block scalars cannot fail
/// beyond the span check: they have no escape grammar.
pub fn decode(source: &str, presentation: &ScalarPresentation) -> Result<String, DecodeError> {
    let content = presentation.content_span.slice(source).ok_or({
        DecodeError::SpanOutsideSource {
            span: presentation.content_span,
            source_len: source.len(),
        }
    })?;
    let mut value = decode_content(content, presentation.style, presentation.indent)?;
    if block_synthesises_a_final_break(source, presentation) {
        value.push('\n');
    }
    Ok(value)
} // End of function decode()

/// Returns `true` when a block scalar ends the document without a final line
/// break and its chomping still promises one.
///
/// A file that does not end with a newline still ends a block scalar, and the
/// substrate treats that end-of-input as the value's final line break for clip
/// and keep chomping alike: measured, `a: |` + `  body  ` with no trailing
/// newline decodes to `body  \n`, and only `|-` decodes to `body  `. Our
/// decoder has to agree, because the substrate is the oracle the corpus test
/// compares against.
///
/// This is also why [`crate::emit::reencode_in_place`] refuses such a scalar:
/// the value gained a byte the source never had, so writing it back cannot be
/// byte-identical.
pub fn block_synthesises_a_final_break(source: &str, presentation: &ScalarPresentation) -> bool {
    presentation.style.is_block()
        && presentation.chomping != crate::syntax::Chomping::Strip
        && presentation.content_span.end == source.len()
        && presentation
            .content_span
            .slice(source)
            .is_some_and(|content| !content.is_empty() && !content.ends_with(['\n', '\r']))
} // End of function block_synthesises_a_final_break()

/// Decodes already-sliced scalar content.
///
/// Split out from [`decode`] so callers that have the text but not the document
/// — the emitter's own tests, and the patch engine working on a candidate
/// buffer — do not have to fabricate a span.
///
/// `indent` is the block-scalar content indentation in columns and is ignored
/// for the three flow styles.
///
/// # Errors
///
/// See [`decode`].
pub fn decode_content(
    content: &str,
    style: ScalarStyle,
    indent: usize,
) -> Result<String, DecodeError> {
    match style {
        ScalarStyle::Plain => Ok(fold_flow(content, FlowKind::Plain)?),
        ScalarStyle::SingleQuoted => Ok(fold_flow(content, FlowKind::SingleQuoted)?),
        ScalarStyle::DoubleQuoted => fold_flow(content, FlowKind::DoubleQuoted),
        ScalarStyle::Literal => Ok(decode_literal(content, indent)),
        ScalarStyle::Folded => Ok(decode_folded(content, indent)),
    }
} // End of function decode_content()

// ---------------------------------------------------------------------------
// Block scalars
// ---------------------------------------------------------------------------

/// Splits block-scalar content into de-indented lines.
///
/// A "line" here is a maximal run without a line break; the returned vector has
/// one more entry than the content has breaks, so the final entry is empty
/// exactly when the content ends with a break. `\r\n`, a bare `\n` and a bare
/// `\r` all count as one break, because YAML normalises all three to a line
/// feed inside a scalar's value.
///
/// De-indentation removes **at most** `indent` leading spaces. A line shorter
/// than the indentation is an empty line by YAML's own rules, which is why the
/// strip is bounded rather than asserted.
fn deindent_lines(content: &str, indent: usize) -> Vec<&str> {
    let mut lines = Vec::new();
    let mut rest = content;
    loop {
        let (line, tail) = match rest.find(['\n', '\r']) {
            Some(offset) => {
                let after = if rest[offset..].starts_with("\r\n") {
                    offset + 2
                } else {
                    offset + 1
                };
                (&rest[..offset], Some(&rest[after..]))
            }
            None => (rest, None),
        };
        lines.push(strip_indent(line, indent));
        match tail {
            Some(tail) => rest = tail,
            None => break,
        }
    }
    lines
} // End of function deindent_lines()

/// Removes up to `indent` leading space characters from `line`.
///
/// Only spaces: a tab is never YAML indentation, so a tab in the indentation
/// zone is scalar data and stops the strip.
fn strip_indent(line: &str, indent: usize) -> &str {
    let stripped = line
        .chars()
        .take(indent)
        .take_while(|character| *character == ' ')
        .count();
    &line[stripped..]
} // End of function strip_indent()

/// Decodes a `|` literal block: de-indent, then join with line feeds.
///
/// Nothing else happens. Chomping was applied when the content span was
/// trimmed, so the trailing breaks present in `content` are exactly the ones
/// that belong to the value.
fn decode_literal(content: &str, indent: usize) -> String {
    deindent_lines(content, indent).join("\n")
}

/// Returns `true` when a de-indented block line is *more indented* than the
/// block's own indentation, which suspends folding around it.
fn is_more_indented(line: &str) -> bool {
    line.starts_with(HORIZONTAL)
}

/// Decodes a `>` folded block.
///
/// The rules, all four of them measured against the substrate rather than read
/// off the grammar, for the break between two content lines with `empties`
/// blank lines between them:
///
/// | Situation | Result |
/// |---|---|
/// | either neighbour is more indented | `1 + empties` line feeds |
/// | `empties > 0` | `empties` line feeds |
/// | otherwise | one space |
///
/// Leading blank lines each contribute a line feed, and the trailing breaks —
/// everything after the last non-empty line, which chomping already trimmed to
/// the right number — are copied through verbatim.
fn decode_folded(content: &str, indent: usize) -> String {
    let lines = deindent_lines(content, indent);
    let breaks = lines.len() - 1;
    let Some(last) = lines.iter().rposition(|line| !line.is_empty()) else {
        // Nothing but blank lines: every break is a trailing break.
        return "\n".repeat(breaks);
    };
    let first = lines
        .iter()
        .position(|line| !line.is_empty())
        .unwrap_or(last);

    let mut out = "\n".repeat(first);
    out.push_str(lines[first]);
    let mut index = first + 1;
    while index <= last {
        let run_start = index;
        while lines[index].is_empty() {
            index += 1;
        }
        let empties = index - run_start;
        if is_more_indented(lines[index - empties - 1]) || is_more_indented(lines[index]) {
            out.push_str(&"\n".repeat(1 + empties));
        } else if empties > 0 {
            out.push_str(&"\n".repeat(empties));
        } else {
            out.push(' ');
        }
        out.push_str(lines[index]);
        index += 1;
    } // End of the loop that folds one break run at a time

    out.push_str(&"\n".repeat(breaks - last));
    out
} // End of function decode_folded()

// ---------------------------------------------------------------------------
// Flow scalars
// ---------------------------------------------------------------------------

/// Which flow style is being folded, and therefore which characters are special.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FlowKind {
    /// No escapes and no quote doubling.
    Plain,
    /// `''` is a literal apostrophe; nothing else is special.
    SingleQuoted,
    /// The full backslash escape grammar.
    DoubleQuoted,
}

/// Decodes one flow scalar, applying YAML's flow-folding rules.
///
/// Flow folding is the same for all three styles: white space before a line
/// break and the indentation after it are dropped, a lone break becomes a
/// space, and a run of `n` breaks becomes `n - 1` line feeds. Only what counts
/// as a *character* differs, which is what [`FlowKind`] selects.
///
/// # Errors
///
/// Only [`FlowKind::DoubleQuoted`] can fail, and only on a malformed escape.
fn fold_flow(content: &str, kind: FlowKind) -> Result<String, DecodeError> {
    let mut out = String::with_capacity(content.len());
    // Bytes below this offset were produced by an escape and must survive the
    // trailing-white-space trim: `\ ` at end of line exists precisely to
    // protect a space the fold would otherwise eat.
    let mut protected = 0usize;
    let mut cursor = 0usize;

    while cursor < content.len() {
        let rest = &content[cursor..];
        let character = rest.chars().next().expect("non-empty remainder");
        match character {
            '\'' if kind == FlowKind::SingleQuoted && rest.starts_with("''") => {
                out.push('\'');
                cursor += 2;
            }
            '\\' if kind == FlowKind::DoubleQuoted => {
                cursor += consume_escape(rest, &mut out, &mut protected)?;
            }
            '\n' | '\r' => {
                trim_to(&mut out, protected);
                let (consumed, breaks) = consume_break_run(rest);
                cursor += consumed;
                if cursor >= content.len() || breaks > 1 {
                    out.push_str(&"\n".repeat(breaks - 1));
                } else {
                    out.push(' ');
                }
            }
            _ => {
                out.push(character);
                cursor += character.len_utf8();
            }
        }
    } // End of the loop over the flow scalar's characters
    Ok(out)
} // End of function fold_flow()

/// Truncates `out` back to `floor`, removing only spaces and tabs.
fn trim_to(out: &mut String, floor: usize) {
    while out.len() > floor {
        match out.chars().next_back() {
            Some(' ' | '\t') => {
                out.pop();
            }
            _ => break,
        }
    }
}

/// Consumes a run of line breaks and the white space around them.
///
/// `rest` must start with `\n` or `\r`. Returns the number of bytes consumed
/// and how many line breaks were in the run. Indentation on each following line
/// is consumed as part of the run, because a folded line's leading white space
/// is never content.
fn consume_break_run(rest: &str) -> (usize, usize) {
    let mut offset = 0;
    let mut breaks = 0;
    loop {
        let tail = &rest[offset..];
        if tail.starts_with("\r\n") {
            offset += 2;
        } else if tail.starts_with(['\n', '\r']) {
            offset += 1;
        } else {
            break;
        }
        breaks += 1;
        let after_break = &rest[offset..];
        offset += after_break.len() - after_break.trim_start_matches(HORIZONTAL).len();
    } // End of the loop that walks one break plus its following indentation
    (offset, breaks)
} // End of function consume_break_run()

/// Consumes one backslash escape from the head of `rest`, appending its value
/// to `out`, and returns how many bytes it occupied.
///
/// An escaped line break produces nothing and swallows the following
/// indentation — that is its entire purpose. Every escape that produces white
/// space raises `protected` so the fold's trailing-white-space trim cannot
/// remove it again.
///
/// # Errors
///
/// Returns a [`DecodeError`] for an unknown, truncated or out-of-range escape.
fn consume_escape(
    rest: &str,
    out: &mut String,
    protected: &mut usize,
) -> Result<usize, DecodeError> {
    let mut characters = rest.char_indices();
    characters.next();
    let Some((offset, escape)) = characters.next() else {
        return Err(DecodeError::TrailingBackslash);
    };
    let consumed = offset + escape.len_utf8();

    let simple = match escape {
        '0' => Some('\0'),
        'a' => Some('\u{07}'),
        'b' => Some('\u{08}'),
        't' | '\t' => Some('\t'),
        'n' => Some('\n'),
        'v' => Some('\u{0b}'),
        'f' => Some('\u{0c}'),
        'r' => Some('\r'),
        'e' => Some('\u{1b}'),
        ' ' => Some(' '),
        '"' => Some('"'),
        '/' => Some('/'),
        '\\' => Some('\\'),
        'N' => Some('\u{85}'),
        '_' => Some('\u{a0}'),
        'L' => Some('\u{2028}'),
        'P' => Some('\u{2029}'),
        _ => None,
    };
    if let Some(decoded) = simple {
        out.push(decoded);
        if decoded == ' ' || decoded == '\t' {
            *protected = out.len();
        }
        return Ok(consumed);
    }

    match escape {
        'x' => numeric_escape(rest, consumed, 2, 'x', out),
        'u' => numeric_escape(rest, consumed, 4, 'u', out),
        'U' => numeric_escape(rest, consumed, 8, 'U', out),
        '\n' | '\r' => {
            // An escaped line break: the break itself vanishes, together with
            // the white space on either side of it. Any *further* empty lines
            // in the run still contribute a line feed each, which is what
            // `l-empty*` means in the escape's own production.
            trim_to(out, *protected);
            let start = consumed - escape.len_utf8();
            let (run, breaks) = consume_break_run(&rest[start..]);
            out.push_str(&"\n".repeat(breaks - 1));
            Ok(start + run)
        }
        _ => Err(DecodeError::UnknownEscape { escape }),
    }
} // End of function consume_escape()

/// Decodes a `\x`, `\u` or `\U` escape of exactly `digits` hexadecimal digits.
///
/// # Errors
///
/// Returns [`DecodeError::MalformedNumericEscape`] when the digits are missing
/// or not hexadecimal, and [`DecodeError::InvalidCodePoint`] when they name a
/// surrogate or a value above `U+10FFFF`.
fn numeric_escape(
    rest: &str,
    consumed: usize,
    digits: usize,
    introducer: char,
    out: &mut String,
) -> Result<usize, DecodeError> {
    let end = consumed + digits;
    let text = rest
        .get(consumed..end)
        .ok_or(DecodeError::MalformedNumericEscape { introducer })?;
    let value = u32::from_str_radix(text, 16)
        .map_err(|_| DecodeError::MalformedNumericEscape { introducer })?;
    let decoded = char::from_u32(value).ok_or(DecodeError::InvalidCodePoint { value })?;
    out.push(decoded);
    Ok(end)
} // End of function numeric_escape()

#[cfg(test)]
mod tests {
    use super::*;

    /// Decodes `content` in `style` at `indent`, panicking on failure.
    fn decoded(content: &str, style: ScalarStyle, indent: usize) -> String {
        decode_content(content, style, indent).expect("decodes")
    }

    #[test]
    fn a_literal_block_is_de_indented_and_nothing_else() {
        assert_eq!(decoded("  a\n  b\n", ScalarStyle::Literal, 2), "a\nb\n");
        assert_eq!(decoded("  a\n\n  b\n", ScalarStyle::Literal, 2), "a\n\nb\n");
        // Trailing spaces on a content line are data in a literal block.
        assert_eq!(decoded("  a  \n", ScalarStyle::Literal, 2), "a  \n");
        // More indentation than the block's own is data too.
        assert_eq!(decoded("      x\n", ScalarStyle::Literal, 4), "  x\n");
    } // End of function a_literal_block_is_de_indented_and_nothing_else()

    #[test]
    fn a_blank_line_shorter_than_the_indentation_decodes_to_nothing() {
        // YAML calls a line with fewer columns than the block indentation an
        // empty line; the stray space is not content.
        assert_eq!(
            decoded("  a\n \n  b\n", ScalarStyle::Literal, 2),
            "a\n\nb\n"
        );
    }

    #[test]
    fn a_folded_block_folds_a_lone_break_into_a_space() {
        assert_eq!(decoded("  a\n  b\n", ScalarStyle::Folded, 2), "a b\n");
        assert_eq!(decoded("  a\n\n  b\n", ScalarStyle::Folded, 2), "a\nb\n");
        assert_eq!(
            decoded("  a\n\n\n  b\n", ScalarStyle::Folded, 2),
            "a\n\nb\n"
        );
    }

    #[test]
    fn a_more_indented_folded_line_keeps_its_breaks() {
        // The `folded-more-indented.yml` fixture exists to pin exactly this.
        assert_eq!(
            decoded("  a\n    b\n  c\n", ScalarStyle::Folded, 2),
            "a\n  b\nc\n"
        );
        // A blank line next to a more-indented line adds a feed rather than
        // replacing one.
        assert_eq!(
            decoded("  a\n    b\n\n    c\n  d\n", ScalarStyle::Folded, 2),
            "a\n  b\n\n  c\nd\n"
        );
        assert_eq!(
            decoded("  a\n\n    b\n  c\n", ScalarStyle::Folded, 2),
            "a\n\n  b\nc\n"
        );
    } // End of function a_more_indented_folded_line_keeps_its_breaks()

    #[test]
    fn folded_leading_and_trailing_blank_lines_are_line_feeds() {
        assert_eq!(decoded("\n  x\n", ScalarStyle::Folded, 2), "\nx\n");
        assert_eq!(decoded("\n\n  x\n", ScalarStyle::Folded, 2), "\n\nx\n");
        assert_eq!(decoded("  x\n\n\n", ScalarStyle::Folded, 2), "x\n\n\n");
        assert_eq!(decoded("\n\n", ScalarStyle::Folded, 2), "\n\n");
    }

    #[test]
    fn single_quotes_double_an_apostrophe() {
        assert_eq!(decoded("a''b", ScalarStyle::SingleQuoted, 0), "a'b");
        assert_eq!(decoded("''", ScalarStyle::SingleQuoted, 0), "'");
        assert_eq!(
            decoded("  spaced  ", ScalarStyle::SingleQuoted, 0),
            "  spaced  "
        );
    }

    #[test]
    fn a_multi_line_flow_scalar_folds_like_a_folded_block() {
        assert_eq!(decoded("a\n  b", ScalarStyle::Plain, 0), "a b");
        assert_eq!(decoded("a\n\n  b", ScalarStyle::Plain, 0), "a\nb");
        assert_eq!(decoded("a  \n  b", ScalarStyle::DoubleQuoted, 0), "a b");
        // The line that carries the closing quote is not an empty line.
        assert_eq!(decoded("x\n\n  ", ScalarStyle::DoubleQuoted, 0), "x\n");
    }

    #[test]
    fn double_quoted_escapes_cover_the_whole_yaml_table() {
        assert_eq!(decoded(r"a\nb", ScalarStyle::DoubleQuoted, 0), "a\nb");
        assert_eq!(
            decoded(r"\t\r\0\a\b\v\f\e", ScalarStyle::DoubleQuoted, 0),
            "\t\r\0\u{07}\u{08}\u{0b}\u{0c}\u{1b}"
        );
        assert_eq!(
            decoded(r"\x41é\U0001F600", ScalarStyle::DoubleQuoted, 0),
            "Aé😀"
        );
        assert_eq!(
            decoded(r"\N\_\L\P", ScalarStyle::DoubleQuoted, 0),
            "\u{85}\u{a0}\u{2028}\u{2029}"
        );
        assert_eq!(
            decoded(r#"a\"b\\c\/d"#, ScalarStyle::DoubleQuoted, 0),
            "a\"b\\c/d"
        );
    } // End of function double_quoted_escapes_cover_the_whole_yaml_table()

    #[test]
    fn an_escaped_line_break_suppresses_the_fold() {
        assert_eq!(decoded("d\\\n  one", ScalarStyle::DoubleQuoted, 0), "done");
        // `\ ` is an escaped space: `a` + space + escaped space + space + `b`.
        assert_eq!(decoded("a \\  b", ScalarStyle::DoubleQuoted, 0), "a   b");
        // …and it protects a space the fold would otherwise trim away.
        assert_eq!(decoded("a\\ \n  b", ScalarStyle::DoubleQuoted, 0), "a  b");
    }

    #[test]
    fn malformed_escapes_are_reported_rather_than_guessed() {
        assert_eq!(
            decode_content(r"\q", ScalarStyle::DoubleQuoted, 0),
            Err(DecodeError::UnknownEscape { escape: 'q' })
        );
        assert_eq!(
            decode_content(r"\u00", ScalarStyle::DoubleQuoted, 0),
            Err(DecodeError::MalformedNumericEscape { introducer: 'u' })
        );
        assert_eq!(
            decode_content(r"\uD800", ScalarStyle::DoubleQuoted, 0),
            Err(DecodeError::InvalidCodePoint { value: 0xd800 })
        );
        assert_eq!(
            decode_content("\\", ScalarStyle::DoubleQuoted, 0),
            Err(DecodeError::TrailingBackslash)
        );
    } // End of function malformed_escapes_are_reported_rather_than_guessed()

    #[test]
    fn a_span_that_does_not_slice_its_source_is_an_error_not_a_panic() {
        let presentation = ScalarPresentation {
            style: ScalarStyle::Plain,
            header_span: ByteSpan::new(0, 0),
            content_span: ByteSpan::new(0, 99),
            indent: 0,
            chomping: crate::syntax::Chomping::Clip,
            explicit_indent: None,
            indicator_order: crate::syntax::HeaderIndicatorOrder::IndentFirst,
        };
        assert!(matches!(
            decode("short", &presentation),
            Err(DecodeError::SpanOutsideSource { .. })
        ));
    } // End of function a_span_that_does_not_slice_its_source_is_an_error_not_a_panic()
}
