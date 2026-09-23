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
//! # The open half, since Phase 2b-2b-2
//!
//! `vars` and `form_fields` are inside the surface too, and they are inside it
//! on different terms, because espanso fixes neither their keys nor the shape of
//! their values. Three rules make them safe to draft:
//!
//! - **an address is an index, never a key text.** A variable, a `params` entry,
//!   a `form_fields` entry and one of its options are each named by their
//!   position in the projection; Rust reads the key out of the projection to
//!   build the path. A caller can only name what it was shown, and no refusal
//!   carries a byte of the owner's configuration (`CLAUDE.md` section 1);
//! - **nothing is inserted below the match mapping.** A drafted address the
//!   projection cannot resolve is refused by name. Writing an author-chosen key
//!   would be the first time this engine composes a key string that no schema
//!   fixes, and that needs its own anchor machinery, its own emission checks and
//!   its own review — `docs/decisions/2b-2b-2-notes.md` decision D1;
//! - **an open value is a scalar or a sequence of scalars.** Anything else is
//!   named and then refused, in both directions: a `Set` cannot replace a
//!   collection node with a scalar one, and a `Remove` would discard bytes this
//!   editor never displayed.
//!
//! # The invariant
//!
//! **This engine may modify or remove existing addressable nodes, may insert
//! scalar-valued mapping entries into the match's own mapping, and may rename a
//! scalar-valued key of that mapping to another key of the same schema family.
//! Since Phase 3-2 it may also change the cardinality of exactly two lists —
//! `triggers` and `search_terms` — by scalar items, add or remove either list as
//! a whole field of scalars, and switch between a scalar trigger form and a block
//! `triggers` list. It may never change any other sequence's cardinality and
//! never synthesize a collection other than a flat list of scalars under one of
//! those two keys.**
//!
//! It is stated three times, and the third statement is over the derived batch
//! rather than over the draft:
//!
//! - in [`MatchDraft`], which carries `String`s, so a destination that *needs* a
//!   collection cannot be expressed at all — and in [`SequenceIntent`] and
//!   [`TriggerSwitch`], which name a list only by [`SequenceField`] and an item
//!   only as a `String`;
//! - in [`plan_match_edits`], which refuses an element `triggers` does not have
//!   and refuses an [`ItemDraft`] that takes one away (a removal is a
//!   [`SequenceIntent`] instead);
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
//! # Composition and substitution, since Phase 3-1
//!
//! Several absent fields drafted at once are written as **one ordered group**
//! ([`crate::patch::FieldInsertGroup`]) after an anchor the batch leaves alone,
//! rather than refused as a shared anchor. A closed [`FieldSubstitution`] —
//! `trigger`↔`regex`, one content key↔another — renames a key in place through
//! [`plan_match_edits_with_substitutions`], so the first entry of a compact
//! `- trigger: …` item can change form without its `-` moving.
//!
//! # Lists and the trigger switch, since Phase 3-2
//!
//! [`plan_match_edits_with`] takes a [`MatchStructure`]: the 3-1 substitutions,
//! [`SequenceIntent`]s that add or remove items of `triggers`/`search_terms` or
//! the whole field, and one [`TriggerSwitch`] between `trigger`/`regex` and a
//! block `triggers` list. Removing the last item of a list is refused; removing
//! the whole field is its own explicit intent. A flow list's items are added
//! and removed between its brackets, never converting it (Phase 3-3); a switch
//! still needs a block list.
//!
//! # The match that does not exist yet, since Phase 2b-2c-2
//!
//! [`NewMatch`] is what a match is **born** holding, and it is a second type
//! rather than a mode of [`MatchDraft`] because the two answer different
//! questions: a draft's `Unchanged` means *leave these bytes alone*, which a
//! match with no bytes cannot mean. It is closed at **two required and four
//! optional schema-known scalar fields** — Phase 2c-4c-1 widened it from the two
//! it was born with — every key spelled from [`MatchField`] so the schema fixes
//! them, and it derives no batch of its own: [`crate::patch::InsertItem`] is the
//! primitive, and this only says what goes in it. An optional field that is
//! absent is a key the new item is not born holding at all, which is not the
//! same request as one written with an empty value.
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
mod new_match;
mod plan;
mod sequence;

pub use audit::{check_batch_independence, check_closed_surface, NestedKeys};
pub use error::DraftError;
pub use field::DraftField;
pub use match_draft::{
    ContentForm, DraftTarget, EntryDraft, FieldSubstitution, FormFieldDraft, ItemDraft, MatchDraft,
    MatchField, SequenceField, TriggerForm, VariableDraft, VariableField,
};
pub use new_match::NewMatch;
pub use plan::{plan_match_edits, plan_match_edits_with, plan_match_edits_with_substitutions};
pub use sequence::{MatchStructure, ScalarItems, SequenceIntent, TriggerSwitch};
