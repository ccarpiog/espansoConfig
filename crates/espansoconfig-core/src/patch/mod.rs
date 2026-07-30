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
//! consulted by [`apply_scalar_edits`] **itself** rather than by its callers,
//! and the whole candidate reparsed and verified before a [`PatchedDocument`]
//! exists at all. Structural edits — insert or remove a field, move a match —
//! are step 0c-3, and the batch shape of [`apply_scalar_edits`] is where they
//! will land.

pub mod edit;
pub mod path;

pub use edit::{
    apply_scalar_edit, apply_scalar_edits, EditError, PatchedDocument, PresentationNote,
    Replacement, ScalarEdit, VerificationFailure,
};
pub use path::{
    path_to, resolve, resolve_full, resolve_key, AddressError, DocumentPath, PathError,
    PathParseError, PathSegment, Resolved,
};
