//! The scalar codec: source bytes ⇄ logical value, and style selection.
//!
//! **Phase 0c-1 scope.** This module is a *value-level* codec. It decodes one
//! scalar's source bytes into the string the user means, and encodes a string
//! the user means back into the bytes a scalar needs. It does **not** mutate
//! documents: no patch engine, no span surgery, no structural edits. Those are
//! Phase 0c-2 and 0c-3, and they consume this module rather than replacing it.
//!
//! # The two halves
//!
//! | Half | Entry point | What it does |
//! |---|---|---|
//! | decode | [`decode`], [`decode_content`] | source bytes → logical `String` |
//! | encode | [`choose_scalar`], [`preserve_scalar`], [`ScalarPlan`] | logical `String` → source bytes |
//!
//! Decoding is cross-checked against the substrate: `saphyr-parser` reports a
//! decoded value on every scalar event, and
//! `tests/scalar_codec.rs` asserts our decoder agrees with it for **every**
//! scalar in both corpora. Where the two disagreed during development the
//! substrate was right every time, which is why the folding rules in
//! [`decode`] are written as a table of measurements rather than as a
//! transcription of the grammar.
//!
//! # Emission is span-local, always
//!
//! [`ScalarPlan`] renders the bytes of one scalar and nothing else. It never
//! produces a whole document, never a surrounding mapping and never a trailing
//! newline it was not asked for — a whole-document serializer is precisely the
//! approach `IMPLEMENTATION_PLAN.md` section 6.2 rejects, and the split into
//! [`ScalarPlan::render_header`] / [`ScalarPlan::render_content`] exists so a
//! caller can rewrite a block scalar's body without touching its header, and
//! its header without touching its body.
//!
//! # The rules this module encodes (plan section 6.3)
//!
//! - Multi-line values become **literal blocks, never folded**: folding turns
//!   line breaks into spaces, which is catastrophic for shell commands, HTML,
//!   Markdown and espanso forms. `>` is decode-only here.
//! - Chomping comes from the actual trailing-newline count
//!   ([`crate::Chomping::for_value`]).
//! - An explicit indentation indicator is added **only** when leading white
//!   space would otherwise be ambiguous.
//! - Quoted means **single-quoted** by default: backslashes stay literal,
//!   which matters enormously for regex triggers.
//! - Double quotes appear only for values carrying control characters, and to
//!   preserve an existing double-quoted presentation.
//! - Raw UTF-8 is preserved — `\uXXXX` is never emitted gratuitously. The one
//!   exception is the set no YAML scalar can hold raw:
//!   [`requires_double_quoted_escape`] — control characters, `U+2028`/`U+2029`
//!   and the Unicode noncharacters — which are escaped rather than written out
//!   and which the decoder reads straight back.
//! - A scalar is emitted as a **key** or as a **value**
//!   ([`ScalarRole`]); a key is never a block scalar, and `<<` is never plain.
//!
//! # The tag-resolution oracle (Phase 0c-3b-2b, R16)
//!
//! [`resolve_plain_yaml_1_1`] and [`resolve_plain_yaml_1_2_core`] state, as a
//! table rather than as a second parser, what a **plain** scalar's text resolves
//! to under each schema. [`plain_scalar_is_ambiguous`] is the difference, and
//! [`is_conservatively_safe_plain_scalar`] consults it: a value the two schemas
//! read differently, or that 1.1 reads as anything but a string, is never
//! written plain. `crate::patch::edit`'s verification asserts the same thing
//! from the other side — no edit may leave the candidate holding a
//! 1.1-ambiguous plain scalar the source did not already hold.

mod choose;
mod decode;
mod plan;
mod tags;

pub use choose::{
    block_lines_are_canonical, choose_scalar, is_conservatively_safe_plain_scalar,
    literal_block_can_carry, preserve_scalar, reencode_in_place, single_quotes_can_carry,
    NotReencodable,
};
pub use decode::{decode, decode_content, DecodeError};
pub use plan::{
    escape_double_quoted, is_unicode_noncharacter, requires_double_quoted_escape, LiteralBlockPlan,
    ScalarContext, ScalarContextKind, ScalarPlan, ScalarRole,
};
pub use tags::{
    plain_scalar_is_ambiguous, resolve_plain_yaml_1_1, resolve_plain_yaml_1_2_core,
    PlainResolution, YamlTag,
};
