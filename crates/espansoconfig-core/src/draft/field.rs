//! The tri-state one drafted value takes.
//!
//! # Why an explicit enum, and not `Option<Option<T>>`
//!
//! A draft has to say three different things about one field: *leave it alone*,
//! *make it this*, and *take it away*. `Option<Option<T>>` spells all three, and
//! that is exactly its problem: `undefined`, a missing key and `null` are
//! routinely collapsed into one another by TypeScript types, form libraries,
//! serializers and generated clients, and the value they collapse to is
//! `Some(None)` — a **removal**. A field the user never touched would delete
//! itself, silently, on a boundary nobody looks at.
//!
//! [`DraftField`] fails the other way. Its wire shape is externally tagged with
//! the Rust variant names verbatim (`"Unchanged"`, `{"Set": "…"}`, `"Remove"`),
//! so a casing slip or a `null` where a tag belongs is a **deserialization
//! error** rather than an unintended mutation. Refusing to read a malformed
//! draft is the desirable failure mode; performing a deletion nobody asked for
//! is not.
//!
//! A `touched_fields` list was the third candidate and is worse than both: the
//! values and the touch metadata live in different places, so a misspelling, a
//! stale name, a duplicate or a "touched" with no matching value produces the
//! wrong edit with nothing to catch it.
//!
//! # Omission
//!
//! A field **absent** from the JSON deserializes as [`DraftField::Unchanged`]
//! (every field of [`crate::draft::MatchDraft`] carries `#[serde(default)]`), so
//! a partial draft is legal and means what it looks like. Absence is the one
//! collapse that is safe, because it collapses towards *doing nothing*.

use serde::{Deserialize, Serialize};

/// What the caller wants one field of a match to become.
///
/// Three states, spelled out, with no encoding shared between two of them. See
/// the module documentation for the failure mode this shape exists to avoid.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DraftField<T> {
    /// The caller did not touch this field.
    ///
    /// It keeps whatever the file holds, **byte for byte**: no edit is derived
    /// for it, so its spelling, its quoting and its comments are outside every
    /// span the batch replaces.
    Unchanged,
    /// The caller wants this field to hold this **logical** value.
    ///
    /// A logical value, never source text: no quotes, no escapes, no block
    /// indentation. Whether it produces an edit at all is
    /// [`crate::draft::plan_match_edits`]'s decision, and it produces none when
    /// the field already decodes to exactly this string.
    Set(T),
    /// The caller wants this field gone.
    ///
    /// A field that is already absent produces no edit: the desired state is
    /// the actual state.
    Remove,
}

impl<T> Default for DraftField<T> {
    /// A field nobody mentioned is [`DraftField::Unchanged`] — never a removal.
    fn default() -> DraftField<T> {
        DraftField::Unchanged
    }
}

impl<T> DraftField<T> {
    /// Whether the caller left this field alone.
    pub fn is_unchanged(&self) -> bool {
        matches!(self, DraftField::Unchanged)
    }

    /// Whether the caller asked for this field to be taken away.
    pub fn is_remove(&self) -> bool {
        matches!(self, DraftField::Remove)
    }

    /// The drafted value, or `None` for the two states that carry none.
    pub fn as_set(&self) -> Option<&T> {
        match self {
            DraftField::Set(value) => Some(value),
            DraftField::Unchanged | DraftField::Remove => None,
        }
    }
} // End of impl DraftField
