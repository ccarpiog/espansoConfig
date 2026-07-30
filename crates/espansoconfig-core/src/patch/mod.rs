//! The edit engine — byte-span surgery.
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
//!
//! # Phase status
//!
//! **0c-2a — [`path`], the structural path resolver.** Rule 2 above is why this
//! exists before any mutation does: verifying an edit means re-finding the
//! edited node in a *freshly parsed* index, whose `NodeId`s bear no relation to
//! the ones the edit was planned against. A [`DocumentPath`] is the identity
//! that survives that reparse, and [`resolve`] / [`path_to`] are its two
//! directions.
//!
//! **0c-2b — [`edit`], the first code here that mutates a document.** One
//! scalar's value, replaced as a byte-span surgery, with the hazard gate
//! consulted by the entry point **itself** rather than by its callers, and the
//! whole candidate reparsed and verified before a [`PatchedDocument`] exists at
//! all.
//!
//! **0c-3a — structural edits, in the same engine.** [`FieldInsert`] and
//! [`FieldRemoval`] join [`ScalarEdit`] in one [`DocumentEdit`] batch, applied
//! by [`apply_edits`]; [`apply_scalar_edits`] is now a wrapper over it. Planning
//! against the original index, rejecting overlaps, splicing from the highest
//! offset downwards and reparsing to verify are the same steps whatever the edit
//! is, so there is one engine rather than two. Moving a whole match, the
//! multiset invariant a move needs, and the full round-trip property test are
//! step 0c-3b.

pub mod edit;
pub mod path;

pub use edit::{
    apply_edits, apply_scalar_edit, apply_scalar_edits, insert_field, remove_field, DocumentEdit,
    EditError, FieldInsert, FieldRemoval, PatchedDocument, PresentationNote, Replacement,
    ScalarEdit, VerificationFailure,
};
pub use path::{
    path_to, resolve, resolve_full, resolve_key, AddressError, DocumentPath, PathError,
    PathParseError, PathSegment, Resolved,
};
