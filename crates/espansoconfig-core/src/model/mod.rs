//! The read-only semantic projection over a source document.
//!
//! **Phase 1a scope: all of it.** This module is what the read-only browser
//! renders and what the Phase 1b Tauri commands hand across the IPC boundary.
//!
//! # What this module is
//!
//! A **projection**, in the strict sense the crate's central invariant uses:
//! the file text on disk is the source of truth, and everything here is a
//! derived, read-only view of it. Every view holds byte spans and
//! [`crate::syntax::NodeId`]s pointing back into an index the caller owns; none
//! of them owns a value, and none of them can be written back. Reprojecting the
//! same bytes always gives the same answer, and reparsing after an edit gives a
//! new projection rather than a mutated one.
//!
//! # What this module is not
//!
//! - **Not a schema validator.** [`Diagnostic`]s report what a document looks
//!   like; nothing here refuses a document, and Phase 1 is read-only anyway.
//!   `crate::validate` is where validation will live.
//! - **Not a type resolver.** See D2u below.
//! - **Not an owner.** Deleting a view changes nothing; the bytes are elsewhere.
//!
//! # The five rules that govern this module
//!
//! 1. **D2u — every scalar is source text.** [`ScalarView::text`] is a `String`
//!    and there is no `bool`, no `i64` and no untagged value enum anywhere,
//!    schema-boolean fields such as `word` and `propagate_case` included.
//!    `PROGRESS.md` R16's open half means a plain scalar's YAML 1.1 resolution
//!    is not proven to match espanso's, so rendering `on` as a boolean would be
//!    a claim this project has not earned. Flagging one as 1.1-ambiguous *is*
//!    allowed — that is a claim about risk — and is
//!    [`ScalarView::ambiguous_yaml_1_1`], computed from `crate::emit::tags`,
//!    the one resolution table in the crate.
//! 2. **A match identity is never an array index** (plan section 6.2), and is
//!    **scoped to the parse it came from**. [`MatchId`] is a
//!    [`crate::DocumentId`], a [`crate::ContentRevision`] and a
//!    [`crate::syntax::NodeId`]. The sequence position lives in
//!    [`MatchView::path`], because the edit engine addresses by path. The
//!    revision is there because a node identifier is the parser's arena index
//!    and is therefore positional *across a reparse*: with it,
//!    [`DocumentView::match_by_id`] refuses a stale identity
//!    ([`IdentityError::StaleRevision`]) rather than resolving it to whatever
//!    now occupies that slot.
//! 3. **Unknown entries are never silently discarded** (plan section 6.2), in
//!    this precise form: **every key of the document is either named by the
//!    projection, or lies inside a span the projection recorded without
//!    descending into it.** Every key the projection does not model becomes an
//!    [`UnknownEntry`] with its name, its spans and — where one exists — its
//!    path; every mapping the projection walks leaves a [`MappingCoverage`]
//!    whose modelled and unknown key nodes must together be exactly that
//!    mapping's entries; and everything kept-but-not-descended-into leaves a
//!    span in [`DocumentView::undescended`]. The per-record half is checked by
//!    [`MappingCoverage::accounts_for`], the whole-document half by
//!    [`DocumentView::unaccounted_keys`], and the corpus sweep re-derives the
//!    document's keys from the syntax index so it can disagree with both.
//! 4. **No user-facing prose** (plan section 9). A [`DiagnosticCode`] is a
//!    variant plus operands. The `Display` impls are for logs and test output.
//! 5. **Never panic on any input.** Every entry point is total. A file that
//!    does not parse, a root that is a sequence, a `matches` holding a scalar,
//!    a value nested past [`MAX_VALUE_DEPTH`] — each yields a diagnostic and a
//!    view, and the caller still holds the raw text.
//!
//! # Where the schema stops and shallow projection starts
//!
//! Espanso's schema is closed where plan section 3 enumerates it — a match's
//! twenty-two fields, a variable's five — and open everywhere else: a
//! variable's `params` differ per type, a form's `fields` are keyed by the
//! author's field names, a profile carries about thirty-five options that grow
//! per release. The closed regions are modelled by name; the open ones are
//! projected shallowly and completely as [`ValueView`]s, so a key espanso adds
//! next year survives without this module knowing it exists.

mod diagnostic;
mod document;
mod match_view;
mod profile;
mod project;
mod scalar;
mod unknown;
mod value;
mod variable;

pub use diagnostic::{Diagnostic, DiagnosticCode};
pub use document::{context_of, DocumentContext, DocumentShape, DocumentView};
pub use match_view::{
    ContentKind, ContentSpec, IdentityError, MatchBadge, MatchId, MatchOptions, MatchView,
    TriggerKind, TriggerSpec,
};
pub use profile::{ConfigProfileView, FILTER_KEYS, SCOPING_KEYS};
pub use scalar::ScalarView;
pub use unknown::{MappingCoverage, UnknownEntry, UnknownReason};
pub use value::{
    mapping_entries, AliasView, FieldView, ValueKind, ValueProjection, ValueView, MAX_VALUE_DEPTH,
};
pub use variable::{VariableKind, VariableView};

pub(crate) use unknown::MappingScan;
