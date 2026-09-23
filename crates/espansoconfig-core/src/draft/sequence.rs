//! Structural intents about a match's scalar lists (Phase 3-2).
//!
//! [`crate::draft::MatchDraft`] rewrites what is already there. The intents here
//! change **how many** items a list holds, or whether the list is there at all,
//! or which shape the trigger takes — and only for the two lists espanso's
//! schema fixes as lists of strings, `triggers` and `search_terms`
//! ([`SequenceField`]). They are closed by their types:
//!
//! - every list is named by a [`SequenceField`], so `vars`, `depends_on`, a
//!   `params` list or `matches` cannot be named at all;
//! - every item is a `String`, so no item can be a collection, and no intent
//!   carries a key string or a YAML fragment;
//! - an intent that must add at least one item carries a [`ScalarItems`], which
//!   has no empty spelling.
//!
//! They are an **argument** to [`crate::draft::plan_match_edits_with`], not a
//! field of [`crate::draft::MatchDraft`], for 3-1's reason
//! (`docs/decisions/3-1-notes.md` §4.4): `MatchDraft` crosses the wire with
//! `deny_unknown_fields`, and this core-first step commits no wire shape before
//! a UI step needs one. None of the types here serializes.

use crate::draft::match_draft::{FieldSubstitution, SequenceField, TriggerForm};
use crate::patch::ItemPlacement;

/// One or more scalar items, in order. **Never empty**, by construction.
///
/// The type an intent carries when it must add at least one item: a first item
/// and the rest, so "add no items" has no spelling and needs no refusal.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScalarItems {
    /// The first item.
    first: String,
    /// Every further item, in order.
    rest: Vec<String>,
}

impl ScalarItems {
    /// A list of one item.
    pub fn one(item: impl Into<String>) -> ScalarItems {
        ScalarItems {
            first: item.into(),
            rest: Vec::new(),
        }
    }

    /// The items of `items`, or `None` when it is empty.
    pub fn from_vec(mut items: Vec<String>) -> Option<ScalarItems> {
        if items.is_empty() {
            return None;
        }
        let first = items.remove(0);
        Some(ScalarItems { first, rest: items })
    }

    /// The items, in order.
    pub fn to_vec(&self) -> Vec<String> {
        std::iter::once(self.first.clone())
            .chain(self.rest.iter().cloned())
            .collect()
    }

    /// How many items there are. Never zero.
    pub fn len(&self) -> usize {
        1 + self.rest.len()
    }

    /// Always `false`; present because a `len` without it is a lint.
    pub fn is_empty(&self) -> bool {
        false
    }
} // End of impl ScalarItems

/// One intent about the cardinality or the presence of a scalar list.
///
/// Every index is a position in the **original** list, exactly as an
/// [`crate::draft::ItemDraft`]'s is: the batch is planned against the file as
/// it stands, so an index never means "wherever this ends up".
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SequenceIntent {
    /// Add items to an existing **block** list, at one place, in order.
    InsertItems {
        /// Which list.
        field: SequenceField,
        /// Where, in the original list.
        at: ItemPlacement,
        /// The new items.
        items: ScalarItems,
    },
    /// Take one item away, with the comments it owns.
    ///
    /// Removing every item this way is refused
    /// ([`crate::draft::DraftError::SequenceWouldBeEmpty`]):
    /// [`SequenceIntent::RemoveField`] is the explicit intent for "no list".
    RemoveItem {
        /// Which list.
        field: SequenceField,
        /// The item's index in the original list.
        index: usize,
    },
    /// Add the whole field, which the match does not hold, with these items.
    ///
    /// Written in block style when `items` is non-empty and as `[]` when it is
    /// empty — an explicitly requested empty list (ruling 5).
    InsertField {
        /// Which list.
        field: SequenceField,
        /// Its items, in order. Empty means `[]`.
        items: Vec<String>,
    },
    /// Remove the whole field — key, items and the comments they own — as a
    /// deliberate intent. A field that is already absent derives no edit.
    RemoveField {
        /// Which list.
        field: SequenceField,
    },
}

impl SequenceIntent {
    /// The list this intent is about.
    pub fn field(&self) -> SequenceField {
        match self {
            SequenceIntent::InsertItems { field, .. }
            | SequenceIntent::RemoveItem { field, .. }
            | SequenceIntent::InsertField { field, .. }
            | SequenceIntent::RemoveField { field } => *field,
        }
    }

    /// Whether this intent adds or removes the whole field.
    pub fn is_whole_field(&self) -> bool {
        matches!(
            self,
            SequenceIntent::InsertField { .. } | SequenceIntent::RemoveField { .. }
        )
    }
} // End of impl SequenceIntent

/// The switch between a scalar trigger form and the list `triggers`.
///
/// One compound intent, all or nothing (ruling 23): the key is renamed and the
/// value changes shape in one edit, [`crate::patch::ShapeSwitch`], in place — so
/// a compact `- trigger: x` keeps its `-`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TriggerSwitch {
    /// `trigger: x` (or `regex: x`) becomes a block `triggers:` list holding
    /// exactly `items`. The old value is not carried over implicitly: a caller
    /// that wants to keep it lists it.
    ToList {
        /// The scalar form the match holds now.
        from: TriggerForm,
        /// The new list's items, in order.
        items: ScalarItems,
    },
    /// A block `triggers:` list holding **one** item becomes `trigger: value`
    /// (or `regex: value`). A list of more than one item is refused
    /// ([`crate::draft::DraftError::SwitchWouldDiscardItems`]) rather than
    /// losing an alias silently.
    FromList {
        /// The scalar form the match is to hold.
        to: TriggerForm,
        /// Its value.
        value: String,
    },
}

impl TriggerSwitch {
    /// The scalar trigger form this switch renames from or to.
    pub fn form(&self) -> TriggerForm {
        match self {
            TriggerSwitch::ToList { from, .. } => *from,
            TriggerSwitch::FromList { to, .. } => *to,
        }
    }
} // End of impl TriggerSwitch

/// Everything a draft asks for beyond rewriting what is there.
///
/// The argument [`crate::draft::plan_match_edits_with`] takes: the 3-1
/// substitutions, the 3-2 list intents and at most one trigger switch. Empty by
/// default, and a default `MatchStructure` plans exactly what
/// [`crate::draft::plan_match_edits`] plans.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MatchStructure {
    /// Scalar-to-scalar key substitutions (Phase 3-1).
    pub substitutions: Vec<FieldSubstitution>,
    /// Item and field intents about `triggers` and `search_terms`.
    pub sequences: Vec<SequenceIntent>,
    /// A switch between a scalar trigger form and `triggers`.
    pub switch: Option<TriggerSwitch>,
}

impl MatchStructure {
    /// Structure that asks for nothing.
    pub fn new() -> MatchStructure {
        MatchStructure::default()
    }

    /// Builder: adds one list intent.
    pub fn with_sequence(mut self, intent: SequenceIntent) -> MatchStructure {
        self.sequences.push(intent);
        self
    }

    /// Builder: adds one substitution.
    pub fn with_substitution(mut self, substitution: FieldSubstitution) -> MatchStructure {
        self.substitutions.push(substitution);
        self
    }

    /// Builder: sets the trigger switch.
    pub fn with_switch(mut self, switch: TriggerSwitch) -> MatchStructure {
        self.switch = Some(switch);
        self
    }
} // End of impl MatchStructure
