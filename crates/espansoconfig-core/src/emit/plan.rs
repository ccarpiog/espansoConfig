//! The write half of the scalar codec: a logical value plus a chosen
//! presentation, and the exact bytes they render to.
//!
//! A [`ScalarPlan`] is deliberately **span-local**. It renders the bytes for
//! one scalar and nothing else — never a whole document, never a surrounding
//! mapping, never a trailing newline it was not asked for. Whole-document
//! serialization is the approach `IMPLEMENTATION_PLAN.md` section 6.2 rejects,
//! and the type system should make it awkward to drift back towards it.
//!
//! # Deviation from the plan's sketch, and why
//!
//! Plan section 6.3 sketches `ScalarPlan::SingleQuoted(escape_single_quotes(value))`,
//! i.e. a variant holding *escaped* text. Every variant here holds the **logical
//! value** instead and escapes at render time. Storing escaped text makes
//! `ScalarPlan` unsafe to inspect, compare or re-target — asking "is this the
//! value the user typed?" would need an inverse escape — and it invites the
//! classic double-escaping bug the moment a plan is rebuilt from another plan.

use crate::syntax::{Chomping, HeaderIndicatorOrder, ScalarStyle};
use crate::LineEnding;

/// Whether a scalar is being written into block or flow context.
///
/// The distinction is not cosmetic: block scalars (`|`, `>`) are illegal inside
/// a flow collection, and a plain scalar in flow context has a far smaller
/// legal character set because `,`, `[`, `]`, `{`, `}` and `:` all terminate
/// it. We answer the second problem by never emitting a plain scalar into flow
/// context at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ScalarContextKind {
    /// Indentation-delimited context: `key: value`, `- item`.
    Block,
    /// Bracket-delimited context: `[a, b]`, `{a: 1}`.
    Flow,
}

/// Whether a scalar is being written as a mapping key or as a value.
///
/// The distinction changes what is legal and what is *safe*:
///
/// - a block scalar (`|`, `>`) cannot open a mapping key at all, so a
///   multi-line key must be double-quoted;
/// - `<<` written plain in key position is YAML's **merge key**, not the
///   two-character string (`PROGRESS.md`, R8).
///
/// [`ScalarContext::block`] and [`ScalarContext::flow`] both default to
/// [`ScalarRole::Value`]; [`ScalarContext::as_key`] switches the role over.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum ScalarRole {
    /// The scalar is a mapping value or a sequence item.
    #[default]
    Value,
    /// The scalar is a mapping key.
    Key,
}

/// Where a scalar is about to be written.
///
/// Carries everything the emitter cannot infer from the value itself: the
/// context kind, the role, the columns involved, and the document's line ending
/// — a CRLF document must get CRLF inside an emitted block scalar or the file
/// gains a mixed-ending block nobody asked for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ScalarContext {
    /// Block or flow.
    pub kind: ScalarContextKind,
    /// Key or value.
    pub role: ScalarRole,
    /// The column a block scalar's body lines will be written at.
    pub indent: usize,
    /// The column of the **enclosing node** — the mapping or sequence the
    /// scalar is a member of.
    ///
    /// This exists for one reason: YAML's explicit indentation indicator
    /// (`|2`) counts columns *relative to the parent node*, not from the left
    /// margin. Measured on the substrate: `a:` + `  b: |2` + `      x` decodes
    /// with a content indentation of 4, which is the inner mapping's column 2
    /// plus the indicator's 2.
    pub parent_indent: usize,
    /// The document's line ending, used inside emitted block scalars.
    pub line_ending: LineEnding,
}

impl ScalarContext {
    /// A scalar written as the value of a mapping key, or as a sequence item,
    /// whose enclosing node sits at column `parent_indent`.
    ///
    /// The body indentation defaults to the conventional two columns further
    /// in; use [`ScalarContext::with_indent`] when the caller knows better.
    pub fn block(parent_indent: usize, line_ending: LineEnding) -> ScalarContext {
        ScalarContext {
            kind: ScalarContextKind::Block,
            role: ScalarRole::Value,
            indent: parent_indent + 2,
            parent_indent,
            line_ending,
        }
    } // End of function block()

    /// A scalar written inside a flow collection at column `indent`.
    pub fn flow(indent: usize, line_ending: LineEnding) -> ScalarContext {
        ScalarContext {
            kind: ScalarContextKind::Flow,
            role: ScalarRole::Value,
            indent,
            parent_indent: indent,
            line_ending,
        }
    } // End of function flow()

    /// Returns the same context with a different block-body indentation.
    pub fn with_indent(self, indent: usize) -> ScalarContext {
        ScalarContext { indent, ..self }
    }

    /// Returns the same context in mapping-key position.
    pub fn as_key(self) -> ScalarContext {
        ScalarContext {
            role: ScalarRole::Key,
            ..self
        }
    }

    /// Returns `true` for flow context.
    pub fn is_flow(self) -> bool {
        self.kind == ScalarContextKind::Flow
    }

    /// Returns `true` when the scalar is a mapping key.
    pub fn is_key(self) -> bool {
        self.role == ScalarRole::Key
    }

    /// Returns `true` when a `|` block scalar is legal here at all.
    ///
    /// Only for a **value** in **block** context: a block scalar cannot appear
    /// inside a flow collection, and it cannot open a mapping key.
    pub fn can_hold_a_block_scalar(self) -> bool {
        self.kind == ScalarContextKind::Block && self.role == ScalarRole::Value
    }

    /// The body column a block scalar can actually be written at, together with
    /// the explicit indentation indicator that spells it.
    ///
    /// YAML's indentation indicator is a **single digit relative to the parent
    /// node**, so only `parent_indent + 1 ..= parent_indent + 9` can be
    /// announced. When an indicator is required — the first body line is empty
    /// or starts with a space, so the body column is otherwise unguessable —
    /// and the requested [`ScalarContext::indent`] falls outside that window,
    /// the requested column is **not representable**.
    ///
    /// # The decision, and why it is not a clamp and not a refusal
    ///
    /// The body moves to the deepest representable column and the indicator
    /// spells that column exactly. Clamping the indicator alone (what this
    /// function used to do) leaves the body where it was, so every surplus
    /// column is reparsed as *content*: `" x\n"` at `with_indent(10)` came back
    /// as `"  x\n"`, silently lengthening the user's value. Refusing instead
    /// would give [`super::choose_scalar`] a fallible signature for a case that
    /// has a perfectly good answer — the value survives byte for byte, only the
    /// body's column differs from the request, and no byte outside the scalar
    /// moves. A caller that needs the exact column can still detect the change:
    /// [`LiteralBlockPlan::indent`] reports where the body actually went.
    ///
    /// A block whose first line is unambiguous needs no indicator at all and is
    /// therefore left at whatever column was asked for, however deep.
    fn representable_body_indent(self) -> (usize, usize) {
        let relative = self
            .indent
            .saturating_sub(self.parent_indent)
            .clamp(1, MAX_INDENTATION_INDICATOR);
        (self.parent_indent + relative, relative)
    } // End of function representable_body_indent()
} // End of impl ScalarContext

/// The largest relative indentation a YAML block header can spell.
///
/// The indicator is one character of `[1-9]`, so ten columns past the parent
/// node has no spelling at all.
const MAX_INDENTATION_INDICATOR: usize = 9;

/// A `|` literal block, resolved down to the bytes it will occupy.
///
/// There is deliberately no folded (`>`) counterpart. Folding *changes the
/// data* — it turns line breaks into spaces — so plan section 6.3 forbids ever
/// emitting one, and [`ScalarStyle`]'s own documentation already records `>` as
/// "readable, never emitted". `>` is a decode-only style in this crate.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LiteralBlockPlan {
    /// The logical value, line feeds and all.
    pub value: String,
    /// Trailing-newline behaviour, derived from `value`.
    pub chomping: Chomping,
    /// The explicit indentation indicator to write in the header, if any.
    pub explicit_indent: Option<usize>,
    /// The column every body line is indented to.
    ///
    /// When [`LiteralBlockPlan::explicit_indent`] is `Some(n)` this is always
    /// the parent's column plus `n`, because the two must agree or the surplus
    /// columns become part of the value.
    pub indent: usize,
    /// Which of the two header indicators is written first.
    ///
    /// [`HeaderIndicatorOrder::IndentFirst`] for a block this crate composes;
    /// the source's own order when a block is being re-encoded in place, which
    /// is the only way a `|+2` header can come back as `|+2`.
    pub indicator_order: HeaderIndicatorOrder,
    /// The line ending used between body lines.
    pub line_ending: LineEnding,
}

impl LiteralBlockPlan {
    /// Builds a block for `value` whose header and body column always agree.
    ///
    /// The one invariant this function exists to hold:
    /// **`explicit_indent == Some(n)` implies `indent == parent_indent + n`.**
    /// Every column the body is written at beyond what the indicator announces
    /// is reparsed as scalar content, so a header and a body that disagree do
    /// not merely look odd — they lengthen the value.
    ///
    /// An indicator is written when the first body line is ambiguous (empty, or
    /// starting with a space), and additionally when `force_indicator` says the
    /// source already had one and dropping it would rewrite header bytes the
    /// user did not edit. When one is needed and the requested column is more
    /// than nine past the parent, the body moves to the deepest column YAML can
    /// spell — see [`ScalarContext::representable_body_indent`].
    pub(crate) fn compose(
        value: &str,
        context: ScalarContext,
        force_indicator: bool,
    ) -> LiteralBlockPlan {
        let first = value.split('\n').next().unwrap_or_default();
        let ambiguous = first.is_empty() || first.starts_with(' ');
        let (indent, explicit_indent) = if ambiguous || force_indicator {
            let (indent, indicator) = context.representable_body_indent();
            (indent, Some(indicator))
        } else {
            // No indicator is written, so any column past the parent's will do
            // and the caller's request is honoured however deep it is.
            (context.indent.max(context.parent_indent + 1), None)
        };
        LiteralBlockPlan {
            value: value.to_owned(),
            chomping: block_chomping(value),
            explicit_indent,
            indent,
            indicator_order: HeaderIndicatorOrder::IndentFirst,
            line_ending: context.line_ending,
        }
    } // End of function compose()
} // End of impl LiteralBlockPlan

/// A chosen presentation for one scalar value.
///
/// Every variant holds the **logical value**; escaping happens in
/// [`ScalarPlan::render_content`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScalarPlan {
    /// Unquoted.
    Plain(String),
    /// `'single quoted'` — backslashes stay literal, which is why it is the
    /// default quoted style for regex triggers.
    SingleQuoted(String),
    /// `"double quoted"` — the only style with an escape grammar.
    DoubleQuoted(String),
    /// `|` literal block.
    Literal(LiteralBlockPlan),
}

impl ScalarPlan {
    /// Builds a literal-block plan for `value` in `context`.
    ///
    /// Chomping comes from the trailing-newline count
    /// ([`Chomping::for_value`]), and an explicit indentation indicator is
    /// added **only** when the leading white space would otherwise be
    /// ambiguous: when the first line starts with a space (YAML would read
    /// those spaces as the block's indentation and then treat every later line
    /// as a dedent) or when the block opens with an empty line (there may be no
    /// non-empty line at all to measure the indentation from).
    ///
    /// When an indicator *is* required, the body column and the indicator are
    /// chosen together, which may move the body in from a column YAML cannot
    /// spell: the indicator is a single digit relative to the parent, so
    /// nothing beyond nine columns past it can be announced. An unambiguous
    /// value keeps [`ScalarContext::indent`] untouched at any depth.
    pub fn literal_block(value: &str, context: ScalarContext) -> ScalarPlan {
        ScalarPlan::Literal(LiteralBlockPlan::compose(value, context, false))
    } // End of function literal_block()

    /// The style this plan will be written in.
    pub fn style(&self) -> ScalarStyle {
        match self {
            ScalarPlan::Plain(_) => ScalarStyle::Plain,
            ScalarPlan::SingleQuoted(_) => ScalarStyle::SingleQuoted,
            ScalarPlan::DoubleQuoted(_) => ScalarStyle::DoubleQuoted,
            ScalarPlan::Literal(_) => ScalarStyle::Literal,
        }
    } // End of function style()

    /// The logical value this plan encodes.
    pub fn value(&self) -> &str {
        match self {
            ScalarPlan::Plain(value)
            | ScalarPlan::SingleQuoted(value)
            | ScalarPlan::DoubleQuoted(value) => value,
            ScalarPlan::Literal(block) => &block.value,
        }
    } // End of function value()

    /// The bytes that belong in [`crate::ScalarPresentation::header_span`].
    ///
    /// Empty for a plain scalar, the opening quote for a quoted one, and the
    /// full `|`, `|2`, `|-`, `|2+`, `|+2` indicator text for a literal block.
    ///
    /// Both indicator orders are reproducible: YAML accepts either, and a
    /// source that spells its header `|+2` must come back as `|+2`, not as the
    /// canonical `|2+` (see [`LiteralBlockPlan::indicator_order`]).
    pub fn render_header(&self) -> String {
        match self {
            ScalarPlan::Plain(_) => String::new(),
            ScalarPlan::SingleQuoted(_) => "'".to_owned(),
            ScalarPlan::DoubleQuoted(_) => "\"".to_owned(),
            ScalarPlan::Literal(block) => {
                let indent = block
                    .explicit_indent
                    .map(|indicator| indicator.to_string())
                    .unwrap_or_default();
                let chomp = block
                    .chomping
                    .indicator()
                    .map(String::from)
                    .unwrap_or_default();
                match block.indicator_order {
                    HeaderIndicatorOrder::IndentFirst => format!("|{indent}{chomp}"),
                    HeaderIndicatorOrder::ChompingFirst => format!("|{chomp}{indent}"),
                }
            }
        }
    } // End of function render_header()

    /// The bytes that belong in [`crate::ScalarPresentation::content_span`].
    ///
    /// For a block scalar this is every body line already indented to the
    /// target column, separated by the context's line ending — exactly the
    /// region the span layer's content-start convention delimits
    /// (`PROGRESS.md`, D2c), so it can be spliced in place with no adjustment.
    pub fn render_content(&self) -> String {
        match self {
            ScalarPlan::Plain(value) => value.clone(),
            ScalarPlan::SingleQuoted(value) => value.replace('\'', "''"),
            ScalarPlan::DoubleQuoted(value) => escape_double_quoted(value),
            ScalarPlan::Literal(block) => render_block_body(block),
        }
    } // End of function render_content()

    /// The closing delimiter, which only the two quoted styles have.
    pub fn render_closing(&self) -> String {
        match self {
            ScalarPlan::SingleQuoted(_) => "'".to_owned(),
            ScalarPlan::DoubleQuoted(_) => "\"".to_owned(),
            ScalarPlan::Plain(_) | ScalarPlan::Literal(_) => String::new(),
        }
    } // End of function render_closing()

    /// The complete scalar token, ready to splice in after `key: ` or `- `.
    ///
    /// A block scalar renders as its header, one line ending, then the body:
    /// the header's own break is part of the token, and the body's trailing
    /// breaks are whatever the chomping indicator promised. **No trailing
    /// newline is ever appended** — adding one to a `|+` block would silently
    /// lengthen the user's value.
    pub fn render(&self) -> String {
        match self {
            ScalarPlan::Literal(block) => {
                let mut out = self.render_header();
                out.push_str(block.line_ending.as_str());
                out.push_str(&self.render_content());
                out
            }
            _ => {
                let mut out = self.render_header();
                out.push_str(&self.render_content());
                out.push_str(&self.render_closing());
                out
            }
        }
    } // End of function render()
} // End of impl ScalarPlan

/// The chomping indicator a literal block must carry to reproduce `value`.
///
/// [`Chomping::for_value`] answers the plan's table — none / one / two-or-more
/// trailing newlines map to `-` / clip / `+` — and that is right for every
/// value with at least one non-empty line. It is **wrong for a value made only
/// of line breaks**: clip chomping keeps the final break only when there is a
/// non-empty line to keep it after, so `|` plus a single empty line decodes to
/// the empty string rather than to `"\n"`. Keep chomping is the only indicator
/// that reproduces those values, and it costs nothing anywhere else because a
/// value of pure line breaks always has "two or more" trailing newlines the
/// moment it has two.
pub(crate) fn block_chomping(value: &str) -> Chomping {
    if value.chars().all(|character| character == '\n') {
        Chomping::Keep
    } else {
        Chomping::for_value(value)
    }
} // End of function block_chomping()

/// Renders a literal block's body: every line indented, breaks in between.
///
/// The value is split on line feeds into parts `P0 … Pn`, so `value` is
/// `P0 + "\n" + … + "\n" + Pn` and the final part is empty exactly when the
/// value ends with a line feed. Each non-empty part gets `indent` spaces in
/// front; an **empty part gets nothing**, because a line of pure indentation
/// would decode back to an empty line anyway and writing it would leave
/// trailing white space in the user's file.
fn render_block_body(block: &LiteralBlockPlan) -> String {
    let padding = " ".repeat(block.indent);
    let mut out = String::with_capacity(block.value.len() + block.indent);
    let mut first = true;
    for part in block.value.split('\n') {
        if !first {
            out.push_str(block.line_ending.as_str());
        }
        first = false;
        if !part.is_empty() {
            out.push_str(&padding);
            out.push_str(part);
        }
    } // End of the loop over the value's line-feed-separated parts
    out
} // End of function render_block_body()

/// Returns `true` when a character is a Unicode **noncharacter**.
///
/// The 66 code points `U+FDD0..=U+FDEF` and the last two of every plane
/// (`U+xFFFE`, `U+xFFFF`). They are permanently reserved, guaranteed never to
/// be assigned, and explicitly *not intended for interchange* (Unicode 23.7).
/// `U+FFFE` and `U+FFFF` are additionally outside YAML's own `c-printable`
/// production, so a conforming parser may reject a document that carries one
/// raw even though `saphyr-parser` accepts it (measured).
pub fn is_unicode_noncharacter(character: char) -> bool {
    let code = character as u32;
    (0xfdd0..=0xfdef).contains(&code) || (code & 0xfffe) == 0xfffe
} // End of function is_unicode_noncharacter()

/// Returns `true` when a character must not be written raw into any YAML
/// scalar, and can only travel inside a double-quoted escape.
///
/// Three families, and every one of them is a measurement rather than a guess
/// about the destination parser:
///
/// - **control characters**, which are outside `c-printable` — except the tab
///   and the line feed, which a literal block carries natively and which this
///   predicate therefore still reports as needing an escape *in flow styles*.
///   Callers that can hold them raw check for them first;
/// - **`U+2028` and `U+2029`**, the line separator and paragraph separator.
///   Rust does not classify them as control characters, so they slip through
///   `char::is_control`, but espanso's parser stack is YAML **1.1**-ish, where
///   they are line breaks — a raw one may be folded into a space or rejected.
///   The decoder already understands their `\L` and `\P` spellings, so the
///   encoder emits those and the two halves stay exact inverses;
/// - **Unicode noncharacters**, see [`is_unicode_noncharacter`].
pub fn requires_double_quoted_escape(character: char) -> bool {
    character.is_control()
        || character == '\u{2028}'
        || character == '\u{2029}'
        || is_unicode_noncharacter(character)
} // End of function requires_double_quoted_escape()

/// Escapes `value` for a double-quoted scalar.
///
/// Only the families of [`requires_double_quoted_escape`] are escaped, plus the
/// backslash and the double quote themselves. **Everything else stays raw
/// UTF-8** — plan section 6.3 is explicit that `\uXXXX` must never be emitted
/// gratuitously, and the corpus contains Spanish accents, `⌘`/`⌥`/`⇧` and an
/// astral emoji that a normalising emitter would mangle.
///
/// Escapes use YAML's named spellings where one exists — `\t`, `\n`, `\N`,
/// `\L`, `\P` — `\xNN` for the remaining control characters, all of which are
/// below `U+0100`, and `\uNNNN`/`\UNNNNNNNN` for the noncharacters.
pub fn escape_double_quoted(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\0' => out.push_str("\\0"),
            '\u{07}' => out.push_str("\\a"),
            '\u{08}' => out.push_str("\\b"),
            '\t' => out.push_str("\\t"),
            '\n' => out.push_str("\\n"),
            '\u{0b}' => out.push_str("\\v"),
            '\u{0c}' => out.push_str("\\f"),
            '\r' => out.push_str("\\r"),
            '\u{1b}' => out.push_str("\\e"),
            '\u{85}' => out.push_str("\\N"),
            '\u{2028}' => out.push_str("\\L"),
            '\u{2029}' => out.push_str("\\P"),
            other if other.is_control() => {
                out.push_str(&format!("\\x{:02x}", other as u32));
            }
            other if is_unicode_noncharacter(other) => {
                let code = other as u32;
                if code <= 0xffff {
                    out.push_str(&format!("\\u{code:04x}"));
                } else {
                    out.push_str(&format!("\\U{code:08x}"));
                }
            }
            other => out.push(other),
        }
    } // End of the loop over the value's characters
    out
} // End of function escape_double_quoted()

#[cfg(test)]
mod tests {
    use super::*;

    /// A block context two columns in from a root-level mapping.
    fn root_block() -> ScalarContext {
        ScalarContext::block(0, LineEnding::Lf)
    }

    #[test]
    fn a_literal_block_renders_header_break_and_indented_body() {
        let plan = ScalarPlan::literal_block("one\ntwo\n", root_block());
        assert_eq!(plan.render_header(), "|");
        assert_eq!(plan.render_content(), "  one\n  two\n");
        assert_eq!(plan.render(), "|\n  one\n  two\n");
    }

    #[test]
    fn chomping_follows_the_trailing_newline_count() {
        assert_eq!(
            ScalarPlan::literal_block("a\nb", root_block()).render(),
            "|-\n  a\n  b"
        );
        assert_eq!(
            ScalarPlan::literal_block("a\nb\n", root_block()).render(),
            "|\n  a\n  b\n"
        );
        assert_eq!(
            ScalarPlan::literal_block("a\nb\n\n", root_block()).render(),
            "|+\n  a\n  b\n\n"
        );
    } // End of function chomping_follows_the_trailing_newline_count()

    #[test]
    fn an_indentation_indicator_appears_only_when_leading_space_is_ambiguous() {
        assert_eq!(
            ScalarPlan::literal_block("a\n  b\n", root_block()).render_header(),
            "|",
            "only a *leading* line needs the indicator"
        );
        assert_eq!(
            ScalarPlan::literal_block("  a\nb\n", root_block()).render(),
            "|2\n    a\n  b\n"
        );
        assert_eq!(
            ScalarPlan::literal_block("\na\n", root_block()).render(),
            "|2\n\n  a\n"
        );
        // Relative to the parent node, not to the left margin.
        let nested = ScalarContext::block(4, LineEnding::Lf);
        assert_eq!(
            ScalarPlan::literal_block("  a\n", nested).render(),
            "|2\n        a\n"
        );
    } // End of function an_indentation_indicator_appears_only_when_leading_space_is_ambiguous()

    #[test]
    fn an_empty_body_line_is_written_without_indentation() {
        // A line of pure indentation decodes back to an empty line, so writing
        // one would only leave trailing white space in the user's file.
        let plan = ScalarPlan::literal_block("a\n\nb\n", root_block());
        assert_eq!(plan.render_content(), "  a\n\n  b\n");
    }

    #[test]
    fn a_crlf_document_gets_crlf_inside_its_block_scalars() {
        let context = ScalarContext::block(0, LineEnding::Crlf);
        assert_eq!(
            ScalarPlan::literal_block("a\nb\n", context).render(),
            "|\r\n  a\r\n  b\r\n"
        );
    }

    #[test]
    fn single_quotes_double_and_nothing_else_changes() {
        let plan = ScalarPlan::SingleQuoted(r"(?P<t>[A-Z]+-\d+)".to_owned());
        assert_eq!(plan.render(), r"'(?P<t>[A-Z]+-\d+)'");
        assert_eq!(
            ScalarPlan::SingleQuoted("Don't".to_owned()).render(),
            "'Don''t'"
        );
    }

    #[test]
    fn double_quotes_escape_controls_and_leave_utf8_raw() {
        assert_eq!(escape_double_quoted("é😀⌘"), "é😀⌘");
        assert_eq!(escape_double_quoted("a\tb\nc"), r"a\tb\nc");
        assert_eq!(escape_double_quoted("\u{7f}\u{01}"), r"\x7f\x01");
        assert_eq!(escape_double_quoted("\u{85}\u{a0}"), "\\N\u{a0}");
        assert_eq!(
            escape_double_quoted(r#"back\slash "quoted""#),
            r#"back\\slash \"quoted\""#
        );
    } // End of function double_quotes_escape_controls_and_leave_utf8_raw()

    #[test]
    fn the_yaml_one_one_line_separators_are_escaped_never_written_raw() {
        // Phase 0c-1 review, finding 3. `char::is_control` is false for U+2028
        // and U+2029 (categories Zl and Zp), so they used to be emitted raw.
        // Under YAML 1.1 — which is what espanso's parser stack is — they are
        // line breaks, and a raw one may be folded into a space or rejected.
        // `\L` and `\P` are the spellings the decoder already understands.
        assert_eq!(escape_double_quoted("a\u{2028}b"), r"a\Lb");
        assert_eq!(escape_double_quoted("a\u{2029}b"), r"a\Pb");
        assert!(requires_double_quoted_escape('\u{2028}'));
        assert!(requires_double_quoted_escape('\u{2029}'));
        // …and the neighbouring separators that are *not* line breaks stay raw.
        assert_eq!(
            escape_double_quoted("\u{a0}\u{2007}\u{3000}"),
            "\u{a0}\u{2007}\u{3000}"
        );
    } // End of function the_yaml_one_one_line_separators_are_escaped_never_written_raw()

    #[test]
    fn unicode_noncharacters_are_escaped_never_written_raw() {
        // Phase 0c-1 review, finding 7. U+FFFE and U+FFFF are valid in a Rust
        // `String`, are not `char::is_control()`, and lie outside YAML's
        // `c-printable` production. `saphyr-parser` accepts them raw (measured)
        // but a conforming parser need not, so they are escaped.
        assert_eq!(escape_double_quoted("\u{fffe}\u{ffff}"), r"\ufffe\uffff");
        assert_eq!(escape_double_quoted("\u{fdd0}\u{fdef}"), r"\ufdd0\ufdef");
        assert_eq!(escape_double_quoted("\u{1fffe}"), r"\U0001fffe");
        for character in ['\u{fffe}', '\u{ffff}', '\u{fdd0}', '\u{fdef}', '\u{1ffff}'] {
            assert!(is_unicode_noncharacter(character), "{character:?}");
            assert!(!character.is_control(), "{character:?} fools is_control");
        }
        // The characters either side of each boundary are ordinary text.
        for character in ['\u{fffd}', '\u{fdcf}', '\u{fdf0}', '\u{1fffd}', '😀'] {
            assert!(!is_unicode_noncharacter(character), "{character:?}");
            assert_eq!(
                escape_double_quoted(&character.to_string()),
                character.to_string()
            );
        }
    } // End of function unicode_noncharacters_are_escaped_never_written_raw()

    #[test]
    fn a_relative_indentation_above_nine_moves_the_body_rather_than_clamping() {
        // Phase 0c-1 review, finding 1. The indicator can only spell 1..=9
        // columns past the parent. Clamping it while leaving the body at the
        // requested column pushed the surplus columns into the value: `" x\n"`
        // at `with_indent(10)` came back as `"  x\n"`.
        let deep = ScalarContext::block(0, LineEnding::Lf).with_indent(10);
        let ScalarPlan::Literal(block) = ScalarPlan::literal_block(" x\n", deep) else {
            panic!("a multi-line value is a literal block");
        };
        assert_eq!(block.explicit_indent, Some(9));
        assert_eq!(
            block.indent, 9,
            "the body follows the indicator, not the ask"
        );
        assert_eq!(
            ScalarPlan::Literal(block).render(),
            "|9\n          x\n",
            "nine structural columns, then the value's own leading space"
        );

        // Exactly nine is representable and is left alone.
        let nine = ScalarContext::block(0, LineEnding::Lf).with_indent(9);
        assert_eq!(
            ScalarPlan::literal_block(" x\n", nine).render(),
            "|9\n          x\n"
        );

        // An unambiguous value needs no indicator, so any depth is fine: this
        // must not over-refuse.
        let unambiguous = ScalarPlan::literal_block("x\n", deep);
        assert_eq!(unambiguous.render_header(), "|");
        assert_eq!(unambiguous.render(), "|\n          x\n");
    } // End of function a_relative_indentation_above_nine_moves_the_body_rather_than_clamping()

    #[test]
    fn both_header_indicator_orders_render() {
        // Phase 0c-1 review, finding 5. `|+2` is a legal spelling of `|2+`, and
        // a source that used it must get it back.
        let block = LiteralBlockPlan {
            value: " x\n".to_owned(),
            chomping: Chomping::Keep,
            explicit_indent: Some(2),
            indent: 2,
            indicator_order: HeaderIndicatorOrder::IndentFirst,
            line_ending: LineEnding::Lf,
        };
        assert_eq!(ScalarPlan::Literal(block.clone()).render_header(), "|2+");
        let reversed = LiteralBlockPlan {
            indicator_order: HeaderIndicatorOrder::ChompingFirst,
            ..block
        };
        assert_eq!(ScalarPlan::Literal(reversed).render_header(), "|+2");
    } // End of function both_header_indicator_orders_render()
}
