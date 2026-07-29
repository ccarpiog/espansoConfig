//! Scalar style selection and block emitter.
//!
//! **Phase 0a scope:** none. This module is a placeholder.
//!
//! **Phase 0c responsibility:** implement `choose_scalar()` per
//! `IMPLEMENTATION_PLAN.md` section 6.3. It emits *only* the bytes for the span
//! being replaced — it is never a whole-document serializer, because a
//! whole-document serializer is precisely the approach the plan rejects.
//!
//! The rules it must encode:
//!
//! - When editing an existing scalar, preserve its current style if the new
//!   value is safely representable in it, and preserve block indentation.
//! - Multiline values become literal blocks, **never folded (`>`)** — folding
//!   changes the data, which is catastrophic for shell commands, HTML and forms.
//! - Chomping is derived from the actual trailing-newline count
//!   ([`crate::Chomping::for_value`]).
//! - Prefer single quotes: backslashes stay literal, which matters enormously
//!   for regex triggers.
//! - Preserve raw UTF-8 — never gratuitously emit `\uXXXX` escapes.
