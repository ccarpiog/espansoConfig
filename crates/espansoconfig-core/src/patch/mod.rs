//! The edit engine — byte-span surgery.
//!
//! **Phase 0a scope:** none. This module is a placeholder; the parser
//! evaluation in `docs/parser-evaluation.md` is what unblocks it.
//!
//! **Phase 0c responsibility:** apply a `DocumentEdit` as the smallest safe
//! byte-span replacement (`IMPLEMENTATION_PLAN.md` section 6.2), under three
//! non-negotiable rules:
//!
//! 1. **Apply edits from the highest byte offset downwards**, so offsets
//!    earlier in the document stay valid while the batch is applied.
//! 2. **Reparse the entire candidate document and verify** before it is allowed
//!    anywhere near disk. Local patching is never trusted on its own.
//! 3. **Everything outside the intended span comes out byte-identical.** This is
//!    the invariant the whole product rests on, and the round-trip property test
//!    in section 11 exists to police it.
//!
//! A full-match rewrite is an acceptable fallback but destroys comments inside
//! that match, so it is surfaced to the user rather than performed silently.
