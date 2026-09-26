//! Intents about the **lists of one existing variable**: `depends_on`, and the
//! kind's own list parameter — `choice`'s `values`, `random`'s `choices`,
//! `script`'s `args` (Phase 4-5).
//!
//! # Four lists, named by the schema
//!
//! [`VariableList`] names exactly the four lists espanso's schema fixes on a
//! variable, and it serializes as the espanso key, so a caller can name no other
//! list and a refusal can say which list it is about without carrying a byte of
//! the owner's configuration (`CLAUDE.md` section 1). A kind list is only
//! addressable on a variable of its own kind ([`VariableList::kind`]): `values`
//! on a `choice`, `choices` on a `random`, `args` on a `script`.
//!
//! # Two item shapes, and they stay distinct
//!
//! Every list holds **strings**, and `choice`'s `values` may instead hold
//! `{label, id}` **records**. [`NewListItems`] has one variant per shape and each
//! is non-empty by construction, so a request cannot mix them; the planner
//! refuses a shape the list does not already hold
//! ([`crate::draft::DraftError::VariableListItemShapeMismatch`]), so a string
//! list never gains a record and a record list never gains a string. An existing
//! record is edited through [`ChoiceRecordDraft`], which names `label` and `id`
//! and nothing else, so every other entry of the record — an unknown key a later
//! espanso release reads — survives byte for byte.
//!
//! # Flow lists stay flow, or are refused by type
//!
//! A flow list of strings (`[a, b]`, and `[]`) takes new strings between its
//! brackets and loses one with a separator, never converting (Phase 3 ruling 5,
//! Phase 3-3's engine). A record cannot be written into or taken out of a flow
//! list, so that request is refused by name
//! ([`crate::draft::DraftError::VariableListIsAFlowList`]); an existing record
//! inside a flow list can still have its `label` or `id` rewritten in place. A
//! flow list that holds a **comment** makes the whole match
//! [`crate::syntax::HazardKind::CommentInFlowCollection`] and every draft of it
//! is refused before any of this is consulted (C2, kept).
//!
//! # What the type does not force
//!
//! That the list exists, has the shape asked for, is not emptied by removals and
//! is not named twice for one place is checked by
//! [`crate::draft::plan_match_edits`]; a `usize` and a `String` cannot say any of
//! it. The audit ([`crate::draft::check_closed_surface`]) re-reads the derived
//! batch and admits exactly these lists' paths.

use serde::{Deserialize, Serialize};

use crate::draft::new_variable::DEPENDS_ON_KEY;
use crate::draft::sequence::{ListPlacement, ScalarItems};
use crate::model::VariableKind;

/// The key a `choice` record's shown text is written under.
pub(crate) const LABEL_KEY: &str = "label";
/// The key a `choice` record's inserted value is written under.
pub(crate) const ID_KEY: &str = "id";

/// One of the four lists of a variable this surface edits (Phase 4-5).
///
/// **It serializes as the espanso key**, for [`crate::draft::MatchField`]'s
/// reason: a refusal names it, and what a screen puts beside a list is that key,
/// spelled the same in every language.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VariableList {
    /// `depends_on`, on the variable itself.
    DependsOn,
    /// `params.values` of a `choice` variable — strings or `{label, id}` records.
    Values,
    /// `params.choices` of a `random` variable.
    Choices,
    /// `params.args` of a `script` variable.
    Args,
}

impl VariableList {
    /// All four, in the order the planner considers them.
    pub const ALL: [VariableList; 4] = [
        VariableList::DependsOn,
        VariableList::Values,
        VariableList::Choices,
        VariableList::Args,
    ];

    /// The espanso key this list is written under.
    pub fn key(self) -> &'static str {
        match self {
            VariableList::DependsOn => DEPENDS_ON_KEY,
            VariableList::Values => "values",
            VariableList::Choices => "choices",
            VariableList::Args => "args",
        }
    }

    /// The kind whose `params` holds this list, or `None` for `depends_on`,
    /// which every kind may carry on the variable itself.
    ///
    /// The inverse of [`VariableKind::list_param_key`], and pinned against it by
    /// `every_kind_list_is_its_kinds_list_parameter` in `tests/variable_lists.rs`.
    pub fn kind(self) -> Option<VariableKind> {
        match self {
            VariableList::DependsOn => None,
            VariableList::Values => Some(VariableKind::Choice),
            VariableList::Choices => Some(VariableKind::Random),
            VariableList::Args => Some(VariableKind::Script),
        }
    }

    /// The list a `params` key names as some kind's list parameter, or `None`.
    pub fn from_param_key(key: &str) -> Option<VariableList> {
        VariableList::ALL
            .into_iter()
            .find(|list| list.kind().is_some() && list.key() == key)
    }

    /// Whether this list may hold `{label, id}` records: `values` only.
    pub fn takes_records(self) -> bool {
        self == VariableList::Values
    }
} // End of impl VariableList

/// One of the two entries of a `choice` record this surface rewrites (Phase
/// 4-5). It serializes as the espanso key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChoiceRecordField {
    /// `label` — the text the choice dialog shows.
    Label,
    /// `id` — the text the variable expands to.
    Id,
}

impl ChoiceRecordField {
    /// Both, in the order a new record writes them.
    pub const ALL: [ChoiceRecordField; 2] = [ChoiceRecordField::Label, ChoiceRecordField::Id];

    /// The espanso key this entry is written under.
    pub fn key(self) -> &'static str {
        match self {
            ChoiceRecordField::Label => LABEL_KEY,
            ChoiceRecordField::Id => ID_KEY,
        }
    }
} // End of impl ChoiceRecordField

/// One new `{label, id}` record of a `choice` variable's `values` (Phase 4-5).
///
/// Both are **logical strings** spelled by the codec, and a new record is
/// written in block style holding exactly these two keys, `label` first.
/// `deny_unknown_fields` is deliberate, for [`crate::draft::MatchDraft`]'s
/// reason.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChoiceRecord {
    /// `label`.
    pub label: String,
    /// `id`.
    pub id: String,
}

impl ChoiceRecord {
    /// A record showing `label` and inserting `id`.
    pub fn new(label: impl Into<String>, id: impl Into<String>) -> ChoiceRecord {
        ChoiceRecord {
            label: label.into(),
            id: id.into(),
        }
    }
} // End of impl ChoiceRecord

/// One or more new records, in order. **Never empty**, by construction, and read
/// from the wire through a check that refuses an empty array, exactly as
/// [`ScalarItems`] is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "Vec<ChoiceRecord>", into = "Vec<ChoiceRecord>")]
pub struct ChoiceRecords {
    /// The first record.
    first: ChoiceRecord,
    /// Every further record, in order.
    rest: Vec<ChoiceRecord>,
}

impl ChoiceRecords {
    /// A list of one record.
    pub fn one(record: ChoiceRecord) -> ChoiceRecords {
        ChoiceRecords {
            first: record,
            rest: Vec::new(),
        }
    }

    /// The records of `records`, or `None` when it is empty.
    pub fn from_vec(mut records: Vec<ChoiceRecord>) -> Option<ChoiceRecords> {
        if records.is_empty() {
            return None;
        }
        let first = records.remove(0);
        Some(ChoiceRecords {
            first,
            rest: records,
        })
    }

    /// The records, in order.
    pub fn to_vec(&self) -> Vec<ChoiceRecord> {
        std::iter::once(self.first.clone())
            .chain(self.rest.iter().cloned())
            .collect()
    }

    /// How many records there are. Never zero.
    pub fn len(&self) -> usize {
        1 + self.rest.len()
    }

    /// Always `false`; present because a `len` without it is a lint.
    pub fn is_empty(&self) -> bool {
        false
    }
} // End of impl ChoiceRecords

impl TryFrom<Vec<ChoiceRecord>> for ChoiceRecords {
    type Error = String;

    fn try_from(records: Vec<ChoiceRecord>) -> Result<ChoiceRecords, String> {
        ChoiceRecords::from_vec(records)
            .ok_or_else(|| "a list of new records holds at least one".to_owned())
    }
}

impl From<ChoiceRecords> for Vec<ChoiceRecord> {
    fn from(records: ChoiceRecords) -> Vec<ChoiceRecord> {
        records.to_vec()
    }
}

/// The new items of one insertion: strings, or `{label, id}` records — **one
/// shape per insertion**, and never none (Phase 4-5).
///
/// On the wire it is externally tagged: `{"Strings": ["a"]}` or
/// `{"Records": [{"label": "A", "id": "a"}]}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NewListItems {
    /// One or more strings, each a logical string spelled by the codec.
    Strings(ScalarItems),
    /// One or more `choice` records.
    Records(ChoiceRecords),
}

impl NewListItems {
    /// How many items are to be written. Never zero.
    pub fn len(&self) -> usize {
        match self {
            NewListItems::Strings(items) => items.len(),
            NewListItems::Records(records) => records.len(),
        }
    }

    /// Always `false`; present because a `len` without it is a lint.
    pub fn is_empty(&self) -> bool {
        false
    }

    /// Whether these are records rather than strings.
    pub fn are_records(&self) -> bool {
        matches!(self, NewListItems::Records(_))
    }
} // End of impl NewListItems

/// One intent about the **cardinality** of one list of an existing variable
/// (Phase 4-5).
///
/// Every index is a position in the **original** list, as a
/// [`crate::draft::SequenceIntent`]'s is. Adding or removing a whole list is not
/// here: a kind list is a `params` entry and has the entry's own routes
/// ([`crate::draft::VariableDraft::insert_params`], a `Remove` of its
/// [`crate::draft::EntryDraft`]); `depends_on` has neither yet.
///
/// It crosses the wire as one entry of `VariableDraft::lists`, externally tagged,
/// each variant closed by `deny_unknown_fields`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum VariableListIntent {
    /// Add items to an existing list — block, flow or `[]` — at one place, in
    /// order. Several items at one place are one intent.
    InsertItems {
        /// Which list.
        list: VariableList,
        /// Where, in the original list.
        at: ListPlacement,
        /// The new items, all of one shape.
        items: NewListItems,
    },
    /// Take one item away, with the comments it owns — and, in a flow list of
    /// strings, with one of its separators.
    ///
    /// Removing every item this way is refused
    /// ([`crate::draft::DraftError::VariableListWouldBeEmpty`]).
    RemoveItem {
        /// Which list.
        list: VariableList,
        /// The item's index in the original list.
        index: usize,
    },
}

impl VariableListIntent {
    /// The list this intent is about.
    pub fn list(&self) -> VariableList {
        match self {
            VariableListIntent::InsertItems { list, .. }
            | VariableListIntent::RemoveItem { list, .. } => *list,
        }
    }

    /// The intent that inserts `items` into `list` at `at`.
    pub fn insert(
        list: VariableList,
        at: ListPlacement,
        items: NewListItems,
    ) -> VariableListIntent {
        VariableListIntent::InsertItems { list, at, items }
    }

    /// The intent that removes item `index` of `list`.
    pub fn remove(list: VariableList, index: usize) -> VariableListIntent {
        VariableListIntent::RemoveItem { list, index }
    }
} // End of impl VariableListIntent

/// A drafted rewrite of one **existing** `{label, id}` record of a `choice`
/// variable's `values`, addressed by its index in the original list (Phase 4-5).
///
/// `None` leaves that entry's bytes alone, and a `Some` equal to what the entry
/// already decodes to derives nothing (the one comparison of
/// [`crate::draft::plan_match_edits`]). There is no spelling of *remove*: a
/// record keeps both entries, and the record itself is removed by a
/// [`VariableListIntent::RemoveItem`]. Every other entry of the record is never
/// named, so it survives byte for byte.
///
/// `deny_unknown_fields` is deliberate, for [`crate::draft::MatchDraft`]'s
/// reason.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChoiceRecordDraft {
    /// The record's index in the original `values` list.
    pub index: usize,
    /// The new `label`, or `None` for unchanged.
    #[serde(default)]
    pub label: Option<String>,
    /// The new `id`, or `None` for unchanged.
    #[serde(default)]
    pub id: Option<String>,
}

impl ChoiceRecordDraft {
    /// A record draft that says nothing about the record at `index`.
    pub fn new(index: usize) -> ChoiceRecordDraft {
        ChoiceRecordDraft {
            index,
            label: None,
            id: None,
        }
    }

    /// Builder: sets one of the two entries.
    pub fn with(mut self, field: ChoiceRecordField, value: impl Into<String>) -> ChoiceRecordDraft {
        match field {
            ChoiceRecordField::Label => self.label = Some(value.into()),
            ChoiceRecordField::Id => self.id = Some(value.into()),
        }
        self
    }

    /// What the draft says about one of the two entries.
    pub fn field(&self, field: ChoiceRecordField) -> Option<&str> {
        match field {
            ChoiceRecordField::Label => self.label.as_deref(),
            ChoiceRecordField::Id => self.id.as_deref(),
        }
    }

    /// Whether the draft says anything at all.
    pub fn is_unchanged(&self) -> bool {
        self.label.is_none() && self.id.is_none()
    }
} // End of impl ChoiceRecordDraft
