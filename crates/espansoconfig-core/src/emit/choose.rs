//! Style selection: which presentation a value gets, and why.
//!
//! Three entry points, in increasing order of how much they are told:
//!
//! | Function | Question it answers |
//! |---|---|
//! | [`choose_scalar`] | a brand-new value, nothing to preserve |
//! | [`preserve_scalar`] | an existing scalar is being given a new value |
//! | [`reencode_in_place`] | can this scalar reproduce its own source bytes? |
//!
//! Every predicate here errs towards **quoting**. Over-quoting costs a pair of
//! apostrophes in a file the user rarely reads; under-quoting silently changes
//! the data — a bare `no` becoming `false` is the single corruption class this
//! project exists to prevent, and espanso's own parser is YAML 1.1-ish, so the
//! resemblance checks accept YAML 1.1 spellings (`yes`, `on`, `y`, `1_000`,
//! sexagesimals) that YAML 1.2 would happily leave alone.

use std::fmt;

use serde::Serialize;

use crate::emit::decode::{block_synthesises_a_final_break, decode, DecodeError};
use crate::emit::plan::{
    requires_double_quoted_escape, LiteralBlockPlan, ScalarContext, ScalarPlan,
};
use crate::emit::tags::plain_scalar_is_ambiguous;
#[cfg(test)]
use crate::syntax::Chomping;
use crate::syntax::{ScalarPresentation, ScalarStyle};
use crate::LineEnding;

/// The characters YAML treats as indicators when they open a plain scalar.
///
/// Some of them (`-`, `?`, `:`) are only indicators when a space follows, but
/// the check is deliberately unconditional: a leading `-` that turns out to be
/// harmless costs two apostrophes, and one that does not costs the user a
/// sequence item.
const LEADING_INDICATORS: [char; 19] = [
    '-', '?', ':', ',', '[', ']', '{', '}', '#', '&', '*', '!', '|', '>', '\'', '"', '%', '@', '`',
];

/// Characters that disqualify a plain scalar wherever they appear.
///
/// The five flow indicators terminate a plain scalar inside `[…]` and `{…}`,
/// so a value carrying one is only *conditionally* plain-safe; quoting it
/// unconditionally means a value never changes meaning when it is later moved
/// into a flow collection. The backslash is here for the reason plan section
/// 6.3 gives for preferring single quotes at all: regex triggers are full of
/// them, and `'\d'` states the intent that a bare `\d` only implies.
const INTERIOR_HAZARDS: [char; 6] = [',', '[', ']', '{', '}', '\\'];

/// Characters a value may contain and still *look* like a number, a timestamp
/// or a sexagesimal to a YAML 1.1 resolver.
const NUMERIC_ALPHABET: &str = "0123456789abcdefABCDEF_.:+-xXoObBeEtTzZ";

/// The plain scalar YAML reads as a merge key rather than as a string.
const MERGE_KEY: &str = "<<";

/// Chooses a presentation for a value that has none yet
/// (`IMPLEMENTATION_PLAN.md` section 6.3).
///
/// The order of the tests is the contract:
///
/// 1. A value containing a line feed becomes a **literal block, never folded**
///    — folding replaces line breaks with spaces, which is catastrophic for
///    shell commands, HTML, Markdown and espanso forms.
/// 2. A value carrying a control character, a carriage return, a line separator
///    or a line feed that no block can hold (flow context, key position)
///    becomes **double-quoted**: that is the only style with an escape grammar.
/// 3. A value that is conservatively safe unquoted stays **plain**.
/// 4. Everything else becomes **single-quoted**, because backslashes stay
///    literal there and regex triggers are full of them.
///
/// # Key and value position are both supported
///
/// [`ScalarContext::role`] says which, and it changes two answers: a mapping
/// key can never be a block scalar, and `<<` in key position is YAML's merge
/// key rather than a string. The second is handled unconditionally in
/// [`is_conservatively_safe_plain_scalar`], the first here.
pub fn choose_scalar(value: &str, context: ScalarContext) -> ScalarPlan {
    if value.contains('\n') && context.can_hold_a_block_scalar() && literal_block_can_carry(value) {
        return ScalarPlan::literal_block(value, context);
    }
    if requires_double_quotes(value) {
        return ScalarPlan::DoubleQuoted(value.to_owned());
    }
    if !context.is_flow() && is_conservatively_safe_plain_scalar(value) {
        return ScalarPlan::Plain(value.to_owned());
    }
    ScalarPlan::SingleQuoted(value.to_owned())
} // End of function choose_scalar()

/// Chooses a presentation for a **new value replacing an existing scalar**
/// (plan section 6.3, "when editing an existing scalar").
///
/// The rules, in order: keep the current style when the new value is safely
/// representable in it; keep the block indentation; derive chomping from the
/// actual trailing-newline count; otherwise fall back to [`choose_scalar`];
/// and never re-encode raw UTF-8 as escapes.
///
/// # The two policies a reader should challenge
///
/// - **A single-line value keeps its block scalar.** Replacing the body of a
///   `replace: |` with one line yields `|-` plus that line, not a plain
///   scalar. The user chose that presentation, a one-line `|` is idiomatic in
///   espanso match files, and silently collapsing it would be exactly the
///   unrequested reformatting this crate exists to avoid. Pinned by
///   `a_single_line_value_stays_inside_an_existing_block_scalar`.
/// - **A folded scalar is never preserved.** `>` is decode-only here, so
///   editing one falls through to [`choose_scalar`], which re-decides the style
///   from the new value alone: a **multi-line** replacement lands on `|`, and a
///   single-line one lands wherever [`choose_scalar`] would have put a fresh
///   value — plain, single-quoted or double-quoted, never a block. That *is* a
///   presentation change, and it is the deliberate one: re-emitting `>` would
///   require choosing where to fold, and every choice changes bytes the user
///   did not edit. Pinned by
///   `a_folded_scalar_is_rewritten_by_choose_scalar_not_preserved`.
pub fn preserve_scalar(
    value: &str,
    presentation: &ScalarPresentation,
    context: ScalarContext,
) -> ScalarPlan {
    match presentation.style {
        ScalarStyle::Plain
            if !context.is_flow()
                && !value.contains('\n')
                && is_conservatively_safe_plain_scalar(value) =>
        {
            ScalarPlan::Plain(value.to_owned())
        }
        ScalarStyle::SingleQuoted if single_quotes_can_carry(value) => {
            ScalarPlan::SingleQuoted(value.to_owned())
        }
        // Double quotes carry every value there is, so rule 1 always applies.
        ScalarStyle::DoubleQuoted => ScalarPlan::DoubleQuoted(value.to_owned()),
        ScalarStyle::Literal
            if context.can_hold_a_block_scalar() && literal_block_can_carry(value) =>
        {
            ScalarPlan::Literal(preserved_block(value, presentation, context))
        }
        _ => choose_scalar(value, context),
    }
} // End of function preserve_scalar()

/// Rebuilds a literal block that keeps `presentation`'s indentation.
///
/// The source's own indentation and indentation indicator are kept whenever
/// they are usable, so an edit moves no byte outside the value. Two guards:
///
/// - a reported indentation at or inside the parent's column belongs to an
///   empty block, whose indentation the substrate reports as the header's
///   column rather than a body column (measured: `a: |-` followed by another
///   key reports 0), so the context's indentation is used instead;
/// - a value that has newly become ambiguous — its first line now starts with
///   a space, or it now opens with an empty line — gains an indicator even
///   though the source had none, and the body then moves to the column that
///   indicator can actually spell.
///
/// # The indicator is recomputed, never copied
///
/// A source indicator is a **relative** column: `|2` means "two past my
/// parent". Copying the digit while writing the body at the source's absolute
/// column silently lengthens the value whenever the two disagree — the review's
/// finding 1, in its second hiding place. So the source only decides *whether*
/// an indicator is written; [`LiteralBlockPlan::compose`] decides which one,
/// and holds `indent == parent_indent + indicator` in every case. The source's
/// indicator **order** is copied, because that carries no arithmetic.
fn preserved_block(
    value: &str,
    presentation: &ScalarPresentation,
    context: ScalarContext,
) -> LiteralBlockPlan {
    let indent = if presentation.indent > context.parent_indent {
        presentation.indent
    } else {
        context.indent
    };
    let mut block = LiteralBlockPlan::compose(
        value,
        context.with_indent(indent),
        presentation.explicit_indent.is_some(),
    );
    block.indicator_order = presentation.indicator_order;
    block
} // End of function preserved_block()

/// Returns `true` when a `|` literal block can carry `value` losslessly.
///
/// A literal block preserves line feeds, trailing spaces on content lines and
/// tabs, so almost everything qualifies. What does not: an empty value (a block
/// with no content decodes to the empty string only by accident of what follows
/// it, and `''` says it unambiguously), a carriage return (YAML normalises every
/// line break inside a block to a line feed, so a `\r` would vanish), and
/// anything else in [`requires_double_quoted_escape`] — the remaining control
/// characters, `U+2028`/`U+2029`, and the Unicode noncharacters — none of which
/// can be spelled anywhere but inside a double-quoted escape.
pub fn literal_block_can_carry(value: &str) -> bool {
    !value.is_empty()
        && !value.chars().any(|character| {
            requires_double_quoted_escape(character) && character != '\n' && character != '\t'
        })
} // End of function literal_block_can_carry()

/// Returns `true` when a single-quoted scalar can carry `value` losslessly.
///
/// Single quotes have no escape grammar at all, so their reach is exactly
/// "one line of characters YAML can print raw": a line feed would be folded
/// into a space, a carriage return normalised away, and everything
/// [`requires_double_quoted_escape`] names has no raw spelling at all.
pub fn single_quotes_can_carry(value: &str) -> bool {
    !value.chars().any(requires_double_quoted_escape)
}

/// Returns `true` when only a double-quoted scalar can carry `value`.
///
/// Called after the block branch has already claimed every multi-line value it
/// can, so a line feed reaching this point means either flow context or a
/// value no block could hold.
fn requires_double_quotes(value: &str) -> bool {
    !single_quotes_can_carry(value)
}

/// Returns `true` when `value` is safe to write unquoted in block context.
///
/// Deliberately conservative — see the module documentation. The rejected
/// shapes, in order of the check:
///
/// - empty, or leading/trailing white space, which YAML strips;
/// - a leading YAML indicator, or a leading document marker (`---`, `...`);
/// - `: ` or a trailing `:`, either of which turns the value into a key;
/// - ` #`, which starts a comment;
/// - exactly `<<`, which is YAML's **merge key** when it is written plain in
///   key position (`PROGRESS.md`, R8). The check is unconditional rather than
///   key-only, in keeping with the module's bias: quoting a `<<` *value* costs
///   two apostrophes, while letting a `<<` key through costs the user a
///   mapping. A quoted `'<<'` is an ordinary two-character string and stays
///   one;
/// - any of the interior hazards — the four bracket characters, the comma and
///   the backslash;
/// - a tab anywhere, which is never legal YAML indentation and is hazardous
///   next to a line break;
/// - anything [`requires_double_quoted_escape`] names: control characters,
///   `U+2028`/`U+2029` and the Unicode noncharacters;
/// - anything that resembles a bool, null, number, timestamp, infinity or NaN
///   under YAML 1.1's generous resolver — a **shape** test, deliberately broader
///   than any resolver;
/// - anything the tag-resolution oracle calls ambiguous
///   ([`crate::emit::plain_scalar_is_ambiguous`]) — the **exact** YAML 1.1
///   productions, which catch what a shape test cannot.
///
/// # Why both, and what the second one caught
///
/// The shape test asks "does this open like a number and continue in the numeric
/// alphabet"; the oracle asks "what does YAML 1.1 actually resolve this to".
/// Neither contains the other. Phase 0c-3b-2b built the oracle and swept three
/// million generated values through both: the shape test alone let **33 distinct
/// 1.1-ambiguous values through**, in two families — `=`, which YAML 1.1 resolves
/// to `tag:yaml.org,2002:value`, and the `._7` / `.__2` / `._78E-8` family, whose
/// mantissa opens `.` then `_` so the shape test's "opens numerically" clause is
/// false while 1.1's `\.[0-9_]+` float production matches. A hand-built
/// counterexample added a **34th** in a third family: `2001-1-1 10:00:00`, a
/// timestamp with single-digit fields and a space where a `T` would be, whose
/// space is outside the numeric alphabet. **No scalar in either corpus exhibits
/// any of them**,
/// which is why three phases of corpus sweeps never saw it (`PROGRESS.md`, R20).
/// Pinned by `the_emitters_predicate_never_disagrees_with_the_oracle` in
/// `tests/gate_roundtrip.rs`.
///
/// A line feed is not listed because a multi-line value never reaches here:
/// [`choose_scalar`] sends it to a literal block or to double quotes first.
pub fn is_conservatively_safe_plain_scalar(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    if value.starts_with([' ', '\t']) || value.ends_with([' ', '\t']) {
        return false;
    }
    if value.starts_with(LEADING_INDICATORS) {
        return false;
    }
    if value.starts_with("---") || value.starts_with("...") {
        return false;
    }
    if value.contains(": ") || value.contains(":\t") || value.ends_with(':') {
        return false;
    }
    if value.contains(" #") || value.contains("\t#") {
        return false;
    }
    if value == MERGE_KEY {
        return false;
    }
    if value.contains(INTERIOR_HAZARDS) {
        return false;
    }
    if value.chars().any(requires_double_quoted_escape) {
        return false;
    }
    if resembles_a_typed_scalar(value) {
        return false;
    }
    if plain_scalar_is_ambiguous(value) {
        return false;
    }
    true
} // End of function is_conservatively_safe_plain_scalar()

/// Returns `true` when a YAML resolver might turn `value` into something other
/// than a string.
///
/// Generous on purpose. The bool and null tables carry every YAML 1.1
/// spelling, `y`/`n` included, because espanso's parser is YAML 1.1-ish and a
/// bare `no` silently becoming `false` is the exact corruption this crate
/// exists to prevent. The numeric test is a shape test rather than a grammar:
/// a value that starts like a number and continues in the numeric alphabet is
/// quoted even when no resolver would actually claim it, which costs nothing.
fn resembles_a_typed_scalar(value: &str) -> bool {
    let lowered = value.to_ascii_lowercase();
    if matches!(
        lowered.as_str(),
        "" | "~" | "null" | "true" | "false" | "yes" | "no" | "on" | "off" | "y" | "n"
    ) {
        return true;
    }
    let unsigned = lowered.strip_prefix(['-', '+']).unwrap_or(&lowered);
    if matches!(unsigned, ".inf" | ".nan" | "inf" | "nan") {
        return true;
    }
    if looks_like_a_date(value) {
        return true;
    }
    let mut characters = unsigned.chars();
    let opens_numerically = match characters.next() {
        Some(first) if first.is_ascii_digit() => true,
        Some('.') => characters
            .clone()
            .next()
            .is_some_and(|c| c.is_ascii_digit()),
        _ => false,
    };
    opens_numerically
        && unsigned
            .chars()
            .all(|character| NUMERIC_ALPHABET.contains(character))
} // End of function resembles_a_typed_scalar()

/// Returns `true` when `value` opens with an ISO-8601 style `YYYY-MM-DD`.
///
/// The numeric shape test above already catches a bare date; this catches the
/// full timestamp spellings that carry a `T`, a space and an offset.
fn looks_like_a_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 10
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(u8::is_ascii_digit)
} // End of function looks_like_a_date()

// ---------------------------------------------------------------------------
// Re-encoding a scalar in its own presentation
// ---------------------------------------------------------------------------

/// Why a scalar cannot reproduce its own source bytes through the codec.
///
/// These are **not** failures. Each names a presentation that is genuinely
/// lossy in the decode direction, so "decode then re-encode" cannot be the
/// identity no matter how the emitter is written. Naming them is what lets the
/// corpus property test assert byte-identity on everything else instead of
/// quietly excusing whatever happens not to match.
///
/// **On the wire since Phase 2b-2a**, because it is
/// [`crate::patch::PresentationNote::reason`] and a successful save carries its
/// notes out. Externally tagged like every other core wire enum, and every
/// variant owes a `code.notReencodable.*` entry in **both** dictionaries —
/// `src-tauri/src/dictionary_contract.rs` fails the build without one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum NotReencodable {
    /// A `>` folded scalar. Folding replaces line breaks with spaces, so the
    /// source layout is not recoverable from the value, and this crate never
    /// emits `>` anyway.
    FoldedStyle,
    /// A plain, single- or double-quoted scalar written across several lines.
    /// The line breaks were folded away; where they were is not recoverable.
    FoldedFlowScalar,
    /// A double-quoted scalar containing a backslash escape or a raw control
    /// character. Several source spellings decode to the same value —
    /// `é`, `\x41`, a raw tab — so re-encoding picks one and it need not
    /// be the one that was there.
    ///
    /// **TODO(0c-2): deliberately over-broad.** Any backslash at all triggers
    /// it, including the already-canonical `\\`, `\"`, `\n` and `\t`, which
    /// re-encode to themselves and could safely return `Ok`. Narrowing it means
    /// deciding which spelling of every escape is canonical and proving the
    /// encoder emits exactly that one, which belongs with the patch engine
    /// rather than here. Until then this refuses more than it must — the safe
    /// direction — and the cost is that editing an escaped double-quoted value
    /// goes through [`preserve_scalar`] instead of an in-place re-encode.
    NonCanonicalEscaping,
    /// A block scalar with a white-space-only line at or below the content
    /// indentation. YAML calls that an empty line, so the value cannot tell
    /// those columns from nothing at all.
    NonCanonicalBlankLine,
    /// A block scalar whose body mixes `\r\n` with bare `\n`. A single line
    /// ending cannot reproduce both.
    MixedLineBreaks,
    /// A block scalar whose body carries a **bare carriage return** as a
    /// physical line ending.
    ///
    /// YAML normalises `\r`, `\n` and `\r\n` alike to a line feed in the
    /// decoded value, so nothing in that value records which spelling the file
    /// used, and [`LineEnding`] has no bare-CR variant to carry it in either.
    /// Re-encoding such a body would rewrite every `\r` as `\n` — a real byte
    /// change, on lines the user never touched — so it is refused instead of
    /// quietly normalised. Distinct from [`NotReencodable::MixedLineBreaks`]
    /// because a body of nothing but bare CRs is perfectly consistent; it is
    /// still unrepresentable.
    BareCarriageReturn,
    /// A block scalar that ends a file with no final newline, under clip or
    /// keep chomping. The substrate reads end-of-input as the value's final
    /// line break, so the decoded value carries a byte the source never had
    /// and re-encoding it must add one.
    SynthesisedFinalBreak,
    /// The scalar could not be decoded at all.
    Undecodable(DecodeError),
}

impl fmt::Display for NotReencodable {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NotReencodable::FoldedStyle => write!(formatter, "folded scalars are decode-only"),
            NotReencodable::FoldedFlowScalar => {
                write!(formatter, "multi-line flow scalar: the folds are lossy")
            }
            NotReencodable::NonCanonicalEscaping => {
                write!(
                    formatter,
                    "double-quoted scalar with non-canonical escaping"
                )
            }
            NotReencodable::NonCanonicalBlankLine => {
                write!(formatter, "block scalar with a white-space-only blank line")
            }
            NotReencodable::MixedLineBreaks => {
                write!(formatter, "block scalar with mixed line endings")
            }
            NotReencodable::BareCarriageReturn => {
                write!(formatter, "block scalar with a bare carriage return")
            }
            NotReencodable::SynthesisedFinalBreak => {
                write!(
                    formatter,
                    "block scalar ending a file with no final newline"
                )
            }
            NotReencodable::Undecodable(error) => write!(formatter, "{error}"),
        }
    } // End of function fmt()
}

impl std::error::Error for NotReencodable {}

impl From<DecodeError> for NotReencodable {
    fn from(error: DecodeError) -> NotReencodable {
        NotReencodable::Undecodable(error)
    }
}

/// Decodes a scalar and re-encodes it in **its own** presentation.
///
/// This is the codec's self-check, and the subject of the corpus property test:
/// when it returns `Ok`, the plan's [`ScalarPlan::render_header`] and
/// [`ScalarPlan::render_content`] must equal the source bytes those spans cover,
/// byte for byte. When it returns `Err`, the presentation is one of the
/// genuinely lossy shapes [`NotReencodable`] enumerates.
///
/// The refusals are **structural predicates on the source text**, never "the
/// bytes came out different" — a self-fulfilling check would prove nothing.
///
/// # Errors
///
/// See [`NotReencodable`].
pub fn reencode_in_place(
    source: &str,
    presentation: &ScalarPresentation,
) -> Result<ScalarPlan, NotReencodable> {
    let content = presentation.content_span.slice(source).ok_or({
        NotReencodable::Undecodable(DecodeError::SpanOutsideSource {
            span: presentation.content_span,
            source_len: source.len(),
        })
    })?;

    if presentation.style == ScalarStyle::Folded {
        return Err(NotReencodable::FoldedStyle);
    }
    if !presentation.style.is_block() && content.contains(['\n', '\r']) {
        return Err(NotReencodable::FoldedFlowScalar);
    }
    if presentation.style == ScalarStyle::DoubleQuoted
        && content
            .chars()
            .any(|character| character == '\\' || character.is_control())
    {
        return Err(NotReencodable::NonCanonicalEscaping);
    }
    if block_synthesises_a_final_break(source, presentation) {
        return Err(NotReencodable::SynthesisedFinalBreak);
    }

    let value = decode(source, presentation)?;
    match presentation.style {
        ScalarStyle::Plain => Ok(ScalarPlan::Plain(value)),
        ScalarStyle::SingleQuoted => Ok(ScalarPlan::SingleQuoted(value)),
        ScalarStyle::DoubleQuoted => Ok(ScalarPlan::DoubleQuoted(value)),
        ScalarStyle::Literal => {
            if !block_lines_are_canonical(content, presentation.indent) {
                return Err(NotReencodable::NonCanonicalBlankLine);
            }
            Ok(ScalarPlan::Literal(LiteralBlockPlan {
                value,
                chomping: presentation.chomping,
                explicit_indent: presentation.explicit_indent,
                indent: presentation.indent,
                // `|+2` must come back as `|+2`, never as the canonical `|2+`.
                indicator_order: presentation.indicator_order,
                line_ending: block_line_ending(content)?,
            }))
        }
        // Rejected above; repeated here so the match stays total without a
        // catch-all that would swallow a future style.
        ScalarStyle::Folded => Err(NotReencodable::FoldedStyle),
    }
} // End of function reencode_in_place()

/// The single line ending a block scalar's body uses, or a refusal.
///
/// Derived from the body itself rather than from the document, because a file
/// may legitimately mix endings and only this block's own bytes decide what
/// re-encoding it must produce.
///
/// A **bare carriage return** is refused outright rather than classified.
/// [`LineEnding`] spells only `\n` and `\r\n`, so there is no value of it that
/// reproduces a `\r`-terminated body; the old code answered `LineEnding::Lf`
/// and returned `Ok`, which rewrote every physical line ending in the block
/// while claiming byte identity.
///
/// # Errors
///
/// Returns [`NotReencodable::BareCarriageReturn`] when any physical line ends
/// with a bare `\r`, and [`NotReencodable::MixedLineBreaks`] when the body
/// mixes `\r\n` with bare `\n`.
fn block_line_ending(content: &str) -> Result<LineEnding, NotReencodable> {
    let crlf = content.matches("\r\n").count();
    let lf = content.matches('\n').count() - crlf;
    let cr = content.matches('\r').count() - crlf;
    if cr > 0 {
        return Err(NotReencodable::BareCarriageReturn);
    }
    match (crlf, lf) {
        (0, _) => Ok(LineEnding::Lf),
        (_, 0) => Ok(LineEnding::Crlf),
        _ => Err(NotReencodable::MixedLineBreaks),
    }
} // End of function block_line_ending()

/// Returns `true` when every body line of a block scalar re-indents exactly.
///
/// A line qualifies when it is either genuinely empty or long enough to carry
/// the full `indent` columns as spaces. A line of white space that stops at or
/// before the indentation column decodes to nothing, so the codec cannot put
/// those columns back — that is [`NotReencodable::NonCanonicalBlankLine`].
pub fn block_lines_are_canonical(content: &str, indent: usize) -> bool {
    let normalised = content.replace("\r\n", "\n");
    for line in normalised.split(['\n', '\r']) {
        if line.is_empty() {
            continue;
        }
        let mut characters = line.chars();
        if !(0..indent).all(|_| characters.next() == Some(' ')) {
            return false;
        }
        if characters.next().is_none() {
            // Nothing but the indentation columns: YAML calls this an empty
            // line, so the value cannot remember the columns were there.
            return false;
        }
    } // End of the loop over the block scalar's physical lines
    true
} // End of function block_lines_are_canonical()

#[cfg(test)]
mod tests {
    use super::*;
    use crate::emit::plan::ScalarContextKind;

    /// The style [`choose_scalar`] picks for `value` in root block context.
    fn chosen(value: &str) -> ScalarPlan {
        choose_scalar(value, ScalarContext::block(0, LineEnding::Lf))
    }

    #[test]
    fn a_multi_line_value_becomes_a_literal_block_never_folded() {
        let plan = chosen("line one\nline two\n");
        assert_eq!(plan.style(), ScalarStyle::Literal);
        assert_eq!(plan.render(), "|\n  line one\n  line two\n");
    }

    #[test]
    fn a_regex_trigger_stays_single_quoted_with_literal_backslashes() {
        let plan = chosen(r"(?P<ticket>[A-Z]+-\d+)");
        assert_eq!(plan.style(), ScalarStyle::SingleQuoted);
        assert_eq!(plan.render(), r"'(?P<ticket>[A-Z]+-\d+)'");
    }

    #[test]
    fn yaml_one_one_bools_and_nulls_are_all_quoted() {
        for value in [
            "no", "No", "NO", "yes", "on", "off", "y", "n", "true", "FALSE", "null", "~", "NULL",
        ] {
            assert_eq!(
                chosen(value).style(),
                ScalarStyle::SingleQuoted,
                "{value} must not stay plain"
            );
        }
    } // End of function yaml_one_one_bools_and_nulls_are_all_quoted()

    #[test]
    fn number_and_timestamp_shapes_are_quoted() {
        for value in [
            "0",
            "1.5",
            "1e3",
            "0x1f",
            "0o17",
            ".inf",
            "-.Inf",
            ".nan",
            "12:30",
            "2024-01-01",
            "2024-01-01T10:00:00Z",
            "1_000",
        ] {
            assert_ne!(
                chosen(value).style(),
                ScalarStyle::Plain,
                "{value} must not stay plain"
            );
        }
    } // End of function number_and_timestamp_shapes_are_quoted()

    #[test]
    fn ordinary_words_stay_plain() {
        for value in ["hello", "Hola mundo", "a#b", "señor", "⌘⌥⇧", "1xyz"] {
            assert_eq!(chosen(value).style(), ScalarStyle::Plain, "{value}");
        }
    }

    #[test]
    fn control_characters_force_double_quotes() {
        assert_eq!(chosen("a\tb").style(), ScalarStyle::DoubleQuoted);
        assert_eq!(chosen("a\u{1b}b").style(), ScalarStyle::DoubleQuoted);
        assert_eq!(chosen("a\rb").style(), ScalarStyle::DoubleQuoted);
        // …but a tab inside a multi-line value keeps the literal block, where
        // a raw tab after the indentation is ordinary content.
        assert_eq!(chosen("a\tb\nc\n").style(), ScalarStyle::Literal);
    }

    #[test]
    fn flow_context_never_gets_a_plain_or_block_scalar() {
        let flow = ScalarContext::flow(0, LineEnding::Lf);
        assert_eq!(flow.kind, ScalarContextKind::Flow);
        assert_eq!(
            choose_scalar("hello", flow).style(),
            ScalarStyle::SingleQuoted
        );
        assert_eq!(
            choose_scalar("a\nb", flow).style(),
            ScalarStyle::DoubleQuoted
        );
    } // End of function flow_context_never_gets_a_plain_or_block_scalar()

    /// A presentation describing a scalar of `style` at `indent`.
    fn presentation(style: ScalarStyle, indent: usize) -> ScalarPresentation {
        ScalarPresentation {
            style,
            header_span: crate::ByteSpan::new(0, 0),
            content_span: crate::ByteSpan::new(0, 0),
            indent,
            chomping: Chomping::Clip,
            explicit_indent: None,
            indicator_order: crate::syntax::HeaderIndicatorOrder::IndentFirst,
        }
    } // End of function presentation()

    #[test]
    fn an_existing_style_survives_a_value_it_can_still_carry() {
        let context = ScalarContext::block(0, LineEnding::Lf);
        assert_eq!(
            preserve_scalar("world", &presentation(ScalarStyle::Plain, 0), context).style(),
            ScalarStyle::Plain
        );
        assert_eq!(
            preserve_scalar(
                "world",
                &presentation(ScalarStyle::SingleQuoted, 0),
                context
            )
            .style(),
            ScalarStyle::SingleQuoted
        );
        assert_eq!(
            preserve_scalar(
                "world",
                &presentation(ScalarStyle::DoubleQuoted, 0),
                context
            )
            .style(),
            ScalarStyle::DoubleQuoted
        );
    } // End of function an_existing_style_survives_a_value_it_can_still_carry()

    #[test]
    fn an_existing_style_is_abandoned_when_it_would_change_the_value() {
        let context = ScalarContext::block(0, LineEnding::Lf);
        // A plain scalar that gains a `: ` must be requoted.
        assert_eq!(
            preserve_scalar("a: b", &presentation(ScalarStyle::Plain, 0), context).style(),
            ScalarStyle::SingleQuoted
        );
        // A single-quoted scalar that gains a control character must become
        // double-quoted.
        assert_eq!(
            preserve_scalar(
                "a\u{7f}b",
                &presentation(ScalarStyle::SingleQuoted, 0),
                context
            )
            .style(),
            ScalarStyle::DoubleQuoted
        );
        // A block scalar that becomes empty cannot stay a block.
        assert_eq!(
            preserve_scalar("", &presentation(ScalarStyle::Literal, 2), context).style(),
            ScalarStyle::SingleQuoted
        );
    } // End of function an_existing_style_is_abandoned_when_it_would_change_the_value()

    #[test]
    fn a_single_line_value_stays_inside_an_existing_block_scalar() {
        // The documented policy: the user chose `|`, so `|` is kept and the
        // chomping follows the new value.
        let context = ScalarContext::block(0, LineEnding::Lf);
        let plan = preserve_scalar(
            "only one line",
            &presentation(ScalarStyle::Literal, 4),
            context,
        );
        assert_eq!(plan.style(), ScalarStyle::Literal);
        assert_eq!(plan.render(), "|-\n    only one line");
    } // End of function a_single_line_value_stays_inside_an_existing_block_scalar()

    #[test]
    fn a_folded_scalar_is_rewritten_by_choose_scalar_not_preserved() {
        // `>` is decode-only, so editing one falls through to `choose_scalar`,
        // which re-decides from the new value alone. A multi-line replacement
        // lands on `|`; a single-line one does **not** — it lands wherever a
        // brand-new value of that shape would. The doc comment used to claim
        // the block was universal.
        let context = ScalarContext::block(0, LineEnding::Lf);
        let folded = presentation(ScalarStyle::Folded, 2);
        assert_eq!(
            preserve_scalar("a\nb\n", &folded, context).style(),
            ScalarStyle::Literal
        );
        assert_eq!(
            preserve_scalar("one line", &folded, context).style(),
            ScalarStyle::Plain
        );
        assert_eq!(
            preserve_scalar("no", &folded, context).style(),
            ScalarStyle::SingleQuoted
        );
        assert_eq!(
            preserve_scalar("a\tb", &folded, context).style(),
            ScalarStyle::DoubleQuoted
        );
    } // End of function a_folded_scalar_is_rewritten_by_choose_scalar_not_preserved()

    #[test]
    fn a_bare_carriage_return_in_a_block_body_is_refused_not_normalised() {
        // Phase 0c-1 review, finding 4. `LineEnding` spells only `\n` and
        // `\r\n`, so a body whose physical lines end in bare `\r` has no
        // representation; the old classifier answered `Lf` and returned `Ok`,
        // rewriting every line ending in the block while claiming byte
        // identity. Synthesised rather than taken from a fixture: no corpus
        // file may carry a bare CR.
        assert_eq!(
            block_line_ending("  a\r  b\r"),
            Err(NotReencodable::BareCarriageReturn)
        );
        assert_eq!(
            block_line_ending("  a\r\n  b\r"),
            Err(NotReencodable::BareCarriageReturn),
            "a CRLF body with one bare CR is still refused"
        );
        assert_eq!(
            block_line_ending("  a\n  b\r"),
            Err(NotReencodable::BareCarriageReturn)
        );
        // The two representable bodies still classify.
        assert_eq!(block_line_ending("  a\n  b\n"), Ok(LineEnding::Lf));
        assert_eq!(block_line_ending("  a\r\n  b\r\n"), Ok(LineEnding::Crlf));
        assert_eq!(block_line_ending("  a"), Ok(LineEnding::Lf));
        assert_eq!(
            block_line_ending("  a\r\n  b\n"),
            Err(NotReencodable::MixedLineBreaks)
        );

        // And end to end: the whole scalar is refused rather than re-encoded.
        let source = "key: |\r  a\r  b\r";
        let index = crate::syntax::SyntaxIndex::parse(source).expect("parses");
        let block = index
            .nodes()
            .iter()
            .filter_map(|node| node.scalar.as_ref())
            .find(|scalar| scalar.presentation.style == ScalarStyle::Literal)
            .expect("a literal block");
        assert_eq!(
            reencode_in_place(source, &block.presentation),
            Err(NotReencodable::BareCarriageReturn)
        );
    } // End of function a_bare_carriage_return_in_a_block_body_is_refused_not_normalised()

    #[test]
    fn a_merge_key_is_never_written_plain() {
        // Phase 0c-1 review, finding 6. `<<` written plain in key position is
        // YAML's merge key, not the two-character string.
        assert!(!is_conservatively_safe_plain_scalar("<<"));
        assert_eq!(chosen("<<").style(), ScalarStyle::SingleQuoted);
        let key = ScalarContext::block(0, LineEnding::Lf).as_key();
        assert_eq!(choose_scalar("<<", key).style(), ScalarStyle::SingleQuoted);
        // Its neighbours are ordinary strings and stay plain.
        for value in ["<", "<<<", "a<<b", "<<a"] {
            assert_eq!(chosen(value).style(), ScalarStyle::Plain, "{value}");
        }
    } // End of function a_merge_key_is_never_written_plain()

    #[test]
    fn a_mapping_key_is_never_a_block_scalar() {
        // A block scalar cannot open a mapping key, so a multi-line key has to
        // be double-quoted however deep the context is.
        let key = ScalarContext::block(0, LineEnding::Lf).as_key();
        assert!(key.is_key());
        assert!(!key.can_hold_a_block_scalar());
        assert_eq!(
            choose_scalar("one\ntwo\n", key).style(),
            ScalarStyle::DoubleQuoted
        );
        assert_eq!(
            choose_scalar("one\ntwo\n", key).render(),
            "\"one\\ntwo\\n\""
        );
        // The same value in value position is a literal block, as before.
        let value = ScalarContext::block(0, LineEnding::Lf);
        assert_eq!(
            choose_scalar("one\ntwo\n", value).style(),
            ScalarStyle::Literal
        );
        // …and an existing block presentation is not preserved into a key.
        assert_eq!(
            preserve_scalar("one\ntwo\n", &presentation(ScalarStyle::Literal, 2), key).style(),
            ScalarStyle::DoubleQuoted
        );
    } // End of function a_mapping_key_is_never_a_block_scalar()

    #[test]
    fn the_unprintable_families_never_reach_a_raw_style() {
        // Findings 3 and 7 at the predicate level: neither the line separators
        // nor the noncharacters may stay plain, single-quoted or inside a
        // literal block, because none of those styles has an escape grammar.
        for value in ["\u{2028}", "\u{2029}", "\u{fffe}", "\u{ffff}", "\u{fdd0}"] {
            assert!(!is_conservatively_safe_plain_scalar(value), "{value:?}");
            assert!(!single_quotes_can_carry(value), "{value:?}");
            assert!(!literal_block_can_carry(value), "{value:?}");
            assert_eq!(
                chosen(value).style(),
                ScalarStyle::DoubleQuoted,
                "{value:?}"
            );
        }
        // A multi-line value carrying one cannot be a block either.
        assert_eq!(
            chosen("a\u{2028}b\nc\n").style(),
            ScalarStyle::DoubleQuoted,
            "a line separator forces the whole value out of the block style"
        );
        // The characters just outside each range are ordinary text.
        for value in ["\u{fffd}", "\u{fdcf}", "\u{fdf0}", "\u{2007}"] {
            assert!(single_quotes_can_carry(value), "{value:?}");
            assert!(literal_block_can_carry(value), "{value:?}");
        }
    } // End of function the_unprintable_families_never_reach_a_raw_style()

    #[test]
    fn preserving_a_block_keeps_its_indentation_and_updates_its_chomping() {
        let context = ScalarContext::block(2, LineEnding::Lf);
        let mut existing = presentation(ScalarStyle::Literal, 6);
        existing.chomping = Chomping::Keep;
        let plan = preserve_scalar("one\ntwo", &existing, context);
        assert_eq!(plan.render(), "|-\n      one\n      two");
    }

    #[test]
    fn a_preserved_block_recomputes_its_indicator_from_the_body_column() {
        // Finding 1's second hiding place. The indicator is relative to the
        // parent, so copying the source's digit while writing the body at the
        // source's absolute column puts the difference inside the value: a `|2`
        // whose body sits at column 6, re-parented at column 2, used to render
        // `|2-` with a six-column body and decode to "   " instead of " ".
        let context = ScalarContext::block(2, LineEnding::Lf);
        let mut existing = presentation(ScalarStyle::Literal, 6);
        existing.explicit_indent = Some(2);
        existing.chomping = Chomping::Strip;
        let plan = preserve_scalar(" x", &existing, context);
        let ScalarPlan::Literal(block) = &plan else {
            panic!("a block presentation is preserved");
        };
        assert_eq!(block.indent, 6);
        assert_eq!(
            block.explicit_indent,
            Some(4),
            "four columns past the parent at column 2"
        );
        assert_eq!(plan.render(), "|4-\n       x");

        // And the invariant across every combination the corpus can donate.
        for parent in 0..6 {
            for indent in 0..14 {
                let context = ScalarContext::block(parent, LineEnding::Lf);
                let mut existing = presentation(ScalarStyle::Literal, indent);
                existing.explicit_indent = Some(2);
                let ScalarPlan::Literal(block) = preserve_scalar(" x", &existing, context) else {
                    panic!("a block presentation is preserved");
                };
                let indicator = block.explicit_indent.expect("an ambiguous value needs one");
                assert!((1..=9).contains(&indicator), "{indicator} is not spellable");
                assert_eq!(
                    block.indent,
                    parent + indicator,
                    "body column and indicator must agree (parent {parent}, indent {indent})"
                );
            }
        } // End of the loop over parent and body columns
    } // End of function a_preserved_block_recomputes_its_indicator_from_the_body_column()

    #[test]
    fn block_line_canonicality_rejects_a_whitespace_only_line() {
        assert!(block_lines_are_canonical("  a\n\n  b\n", 2));
        assert!(block_lines_are_canonical("  a\n     \n", 2));
        assert!(!block_lines_are_canonical("  a\n  \n", 2));
        assert!(!block_lines_are_canonical("  a\n \n", 2));
    }
}
