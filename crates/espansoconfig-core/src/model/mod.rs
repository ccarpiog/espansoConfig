//! Semantic projection over the source document.
//!
//! **Phase 0a scope:** none. This module is a placeholder.
//!
//! **Later responsibility:** build the read-only typed view the editor renders
//! (`MatchView`, `Trigger`, `Content`, `MatchOptions`) as a *projection* over
//! [`crate::syntax`], never as an owning model. Two rules from
//! `IMPLEMENTATION_PLAN.md` section 6.2 govern this module and both are easy to
//! violate by accident:
//!
//! 1. **Unknown entries are never silently discarded.** Anything the projection
//!    does not understand is carried through to the source untouched.
//! 2. **A match identity is never an array index.** Indexes shift when entries
//!    are reordered; identity is derived from [`crate::DocumentId`] plus a
//!    source-node identity.
//!
//! Building this before the syntax index exists would mean guessing at the node
//! representation, so it stays empty until Phase 0c.
