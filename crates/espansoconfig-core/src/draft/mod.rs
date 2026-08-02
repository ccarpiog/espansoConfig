//! The visual editor's draft of one match, and the minimal batch it derives.
//!
//! **Phase 2b-2b-1 responsibility:** turn *what the user wants this match to
//! say* into the **smallest** [`crate::patch::DocumentEdit`] batch that says it,
//! or refuse by name. It has no caller — no `#[tauri::command]` reaches it and
//! no screen shows it — which is 1b-1's and 2b-1's shape repeated on purpose:
//! the type and the engine ship first, and the wire and the window come after.
//!
//! # The surface is closed
//!
//! One match, and only the part of it espanso's schema fixes as a **string**:
//! `trigger` and `regex`; `replace`, `markdown`, `html`, `image_path` and
//! `form`; `label` and `comment`; the nine match options; and the *existing*
//! elements of `triggers` and `search_terms`, addressed by index — because
//! rewriting one of those is a scalar-node replacement, not a sequence
//! mutation.
//!
//! `vars` and `form_fields` are outside it. Their keys are the author's rather
//! than the schema's and their values may be collections, and the difference
//! between "a key espanso defined" and "a key this user wrote" is the whole
//! reason the projection treats them differently.
//!
//! # The invariant
//!
//! **This engine may modify or remove existing addressable nodes, and may insert
//! scalar-valued mapping entries. It may never change a sequence's cardinality
//! and never synthesize a collection node.**
//!
//! It is stated three times, and the third statement is over the derived batch
//! rather than over the draft:
//!
//! - in [`MatchDraft`], which carries `String`s, so a destination that *needs* a
//!   collection cannot be expressed at all;
//! - in [`plan_match_edits`], which refuses an element `triggers` does not have
//!   and refuses to take one away;
//! - in [`check_closed_surface`], which reads the derived batch back and refuses
//!   any edit that names something else. It reads paths, not nodes, and it
//!   shares the planner's vocabulary for what a surface key is — see
//!   `audit`'s own documentation for what that does and does not establish.
//!
//! **Neither direction of a shape change is available here**, and the reasons
//! differ. A scalar cannot become a collection because nothing in this crate
//! builds one. A collection cannot become a scalar either: no primitive replaces
//! a collection node with a scalar one, and *remove then insert* is not a
//! spelling of it, because an insertion is planned against the original index
//! where the key is still present. Removing such a key on its own **is**
//! expressible — a field removal deletes the whole subtree — and this phase
//! refuses it anyway, deliberately: the bytes it would discard are ones the
//! visual editor never displayed, and
//! [`DraftError::RemovalWouldDiscardUnshownStructure`] is that decision under
//! its own name.
//!
//! # The equality rule
//!
//! A drafted value is compared with the existing scalar's **decoded logical
//! value** and with nothing else — never with the source text, and never with
//! what the codec would re-emit. [`plan_match_edits`]'s own documentation gives
//! the reason and the table of consequences.
//!
//! # What this module never does
//!
//! It writes nothing. It has no `force` flag, no acknowledgement and no path to
//! a file: it produces a `Vec<DocumentEdit>` and stops. Everything a save has to
//! be — the per-path lock, the revision check, the reparse, the validation
//! verdict, the acknowledged subset and the backup — lives in
//! [`crate::persist::save_document`], which remains the only entry point in this
//! crate that may write a user's file.

mod audit;
mod error;
mod field;
mod match_draft;
mod plan;

pub use audit::{check_batch_independence, check_closed_surface};
pub use error::DraftError;
pub use field::DraftField;
pub use match_draft::{DraftTarget, ItemDraft, MatchDraft, MatchField, SequenceField};
pub use plan::plan_match_edits;
