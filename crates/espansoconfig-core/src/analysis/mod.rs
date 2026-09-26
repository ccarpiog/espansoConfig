//! Placeholder, reference and dependency analysis (Phase 4-7).
//!
//! Pure functions over text and over a [`crate::model::DocumentView`]: no I/O,
//! no clock, no mutation of anything they are handed. Four parts:
//!
//! - [`placeholder`] — the named supported placeholder subset of a form
//!   layout, `[[identifier]]`, keeping every character and reporting malformed
//!   regions. Never called espanso-compatible;
//! - [`reference`] — the one `{{reference}}` scanner, over the validator's own
//!   transcribed pattern;
//! - [`dependency`] — per-scope declarations, the explicit and inferred
//!   dependency graph, cycles, missing explicit names, usage counts, form
//!   sub-reference and order advisories, and incomplete-analysis reasons;
//! - [`findings`] — the two `SuspiciousButPermitted` findings the save
//!   transaction owes a variable operation that introduces or worsens a cycle
//!   or a missing explicit dependency, bound to the candidate revision.
//!
//! Since Phase 4-8, [`crate::authoring`] summarises a match's analysis — of the
//! cached projection and of a candidate — into a Rust-cut, span-free wire shape;
//! the analysis types themselves carry byte spans and stay off the wire.

pub mod dependency;
pub mod findings;
pub mod placeholder;
pub mod reference;

pub use dependency::{
    analyze_document, analyze_match, Declaration, DependencyCycle, DependencyEdge,
    DocumentAnalysis, EdgeKind, FormLayoutAnalysis, FormSource, FormSubReferenceAdvisory,
    IncompleteReason, Injection, MatchAnalysis, MissingDependency, OrderAdvisory, ScopeAnalysis,
    Usage, SYNTHESIZED_FORM_NAME,
};
pub use findings::{batch_operates_on_variables, variable_operation_findings};
pub use placeholder::{
    is_supported_identifier, LayoutSegment, MalformedPlaceholder, PlaceholderGroup,
    PlaceholderLayout,
};
pub use reference::{scan_references, ReferenceToken};
