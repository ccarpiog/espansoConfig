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
//! They are an **argument** to [`crate::draft::plan_match_edits_with`], and,
//! since Phase 3-6-1, a **field** of [`crate::draft::MatchDraft`] too: the match
//! editor's list controls are the UI step 3-1 §4.4 waited for, so
//! [`SequenceIntent`] now crosses the wire as `MatchDraft::sequences`, and a
//! trigger-form change crosses as `MatchDraft::trigger_form`
//! ([`TriggerFormChange`]). The wire forms are closed exactly as the types are:
//! [`ScalarItems`] is read through a check that refuses an empty list, a
//! placement is a [`ListPlacement`] and never a byte offset, and every item is a
//! `String`. [`MatchStructure`] itself still does not serialize.

use serde::{Deserialize, Serialize};

use crate::draft::match_draft::{FieldSubstitution, SequenceField, TriggerForm};
use crate::patch::ItemPlacement;

/// One or more scalar items, in order. **Never empty**, by construction.
///
/// The type an intent carries when it must add at least one item: a first item
/// and the rest, so "add no items" has no spelling and needs no refusal.
///
/// **On the wire it is a plain array of strings** (Phase 3-6-1), read through
/// [`ScalarItems::from_vec`]: an empty array is refused while a command's
/// arguments are read, so the non-empty guarantee survives the boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "Vec<String>", into = "Vec<String>")]
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

impl TryFrom<Vec<String>> for ScalarItems {
    type Error = String;

    fn try_from(items: Vec<String>) -> Result<ScalarItems, String> {
        ScalarItems::from_vec(items)
            .ok_or_else(|| "a list of new items holds at least one".to_owned())
    }
}

impl From<ScalarItems> for Vec<String> {
    fn from(items: ScalarItems) -> Vec<String> {
        items.to_vec()
    }
}

/// Where new items go in an existing list, as the wire spells it (Phase 3-6-1).
///
/// The wire twin of [`ItemPlacement`], which stays an engine type with no serde
/// of its own. Every variant is a one-key object — `{"Front": {}}`,
/// `{"After": {"index": 2}}`, `{"End": {}}` — the shape `NewMatchPosition` uses,
/// and an index is a position in the **original** list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ListPlacement {
    /// Above the list's first item.
    Front {},
    /// After the item at this index in the original list.
    After {
        /// The item's index in the original list.
        index: usize,
    },
    /// After the list's last item.
    End {},
}

impl From<ListPlacement> for ItemPlacement {
    fn from(placement: ListPlacement) -> ItemPlacement {
        match placement {
            ListPlacement::Front {} => ItemPlacement::Front,
            ListPlacement::After { index } => ItemPlacement::After(index),
            ListPlacement::End {} => ItemPlacement::End,
        }
    }
}

impl From<ItemPlacement> for ListPlacement {
    fn from(placement: ItemPlacement) -> ListPlacement {
        match placement {
            ItemPlacement::Front => ListPlacement::Front {},
            ItemPlacement::After(index) => ListPlacement::After { index },
            ItemPlacement::End => ListPlacement::End {},
        }
    }
}

/// Serde for an [`ItemPlacement`] field, through [`ListPlacement`].
mod placement_wire {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    use super::ListPlacement;
    use crate::patch::ItemPlacement;

    /// Writes a placement as its wire twin.
    pub fn serialize<S: Serializer>(
        placement: &ItemPlacement,
        serializer: S,
    ) -> Result<S::Ok, S::Error> {
        ListPlacement::from(*placement).serialize(serializer)
    }

    /// Reads a placement from its wire twin.
    pub fn deserialize<'de, D: Deserializer<'de>>(
        deserializer: D,
    ) -> Result<ItemPlacement, D::Error> {
        ListPlacement::deserialize(deserializer).map(ItemPlacement::from)
    }
} // End of mod placement_wire

/// One intent about the cardinality or the presence of a scalar list.
///
/// Every index is a position in the **original** list, exactly as an
/// [`crate::draft::ItemDraft`]'s is: the batch is planned against the file as
/// it stands, so an index never means "wherever this ends up".
///
/// **It crosses the wire since Phase 3-6-1**, as one entry of
/// `MatchDraft::sequences`, externally tagged (`{"RemoveItem": {"field":
/// "triggers", "index": 1}}`), each variant closed by `deny_unknown_fields`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum SequenceIntent {
    /// Add items to an existing list — block, flow or `[]` — at one place, in
    /// order. A flow list stays a flow list (Phase 3-3).
    InsertItems {
        /// Which list.
        field: SequenceField,
        /// Where, in the original list.
        #[serde(with = "placement_wire")]
        at: ItemPlacement,
        /// The new items.
        items: ScalarItems,
    },
    /// Take one item away, with the comments it owns — and, in a flow list,
    /// with one of its separators (Phase 3-3).
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
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

/// A drafted change of **trigger form**, as it crosses the wire inside a
/// [`crate::draft::MatchDraft`] (Phase 3-6-1).
///
/// The three changes the match editor can draft between `trigger`, `regex` and a
/// block `triggers` list, as one closed type:
///
/// - [`TriggerFormChange::Rename`] — `trigger`↔`regex`, one
///   [`FieldSubstitution::Trigger`]: the key token is re-spelled in place and the
///   value's bytes are kept unless the draft's own field for the destination key
///   is `Set` to something else (3-1's rule, unchanged);
/// - [`TriggerFormChange::Switch`] — a [`TriggerSwitch`] between a scalar form and
///   a block `triggers` list, one [`crate::patch::ShapeSwitch`].
///
/// **One compound intention, all or nothing** (ruling 23). A `Rename` names only
/// its source, because `trigger` and `regex` are the only two scalar forms and
/// the destination is the other one; so a rename to itself has no spelling.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum TriggerFormChange {
    /// `trigger` becomes `regex`, or `regex` becomes `trigger`, in place.
    Rename {
        /// The scalar form the match holds now; the destination is the other.
        from: TriggerForm,
    },
    /// A scalar form becomes a block `triggers` list, or a one-item block list
    /// becomes a scalar form.
    Switch {
        /// The switch.
        switch: TriggerSwitch,
    },
}

impl TriggerFormChange {
    /// The substitution a rename derives, or `None` for a switch.
    pub fn substitution(&self) -> Option<FieldSubstitution> {
        match self {
            TriggerFormChange::Rename { from } => Some(FieldSubstitution::Trigger {
                from: *from,
                to: from.other(),
            }),
            TriggerFormChange::Switch { .. } => None,
        }
    }

    /// The switch this change is, or `None` for a rename.
    pub fn switch(&self) -> Option<&TriggerSwitch> {
        match self {
            TriggerFormChange::Rename { .. } => None,
            TriggerFormChange::Switch { switch } => Some(switch),
        }
    }
} // End of impl TriggerFormChange

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
