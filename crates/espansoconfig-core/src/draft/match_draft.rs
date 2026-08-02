//! The draft itself: which fields it can name, and what it says about each.
//!
//! # The surface is closed, and it is closed by this type
//!
//! Every key [`MatchDraft`] can name is a key espanso's schema fixes and whose
//! value that schema says is a **string**: the two trigger spellings, the five
//! content spellings, `label`, `comment`, the nine match options, and the
//! *existing* elements of the two string sequences. Anything that would add or
//! delete a sequence element is deliberately absent.
//!
//! That is a claim the **type** makes, not a check some function performs: a
//! draft carries `String`s, so a destination that would need a new mapping or a
//! new sequence cannot be expressed at all. What a function still has to check
//! is the other direction — an existing value that is a collection — and
//! [`crate::draft::plan_match_edits`] refuses that by name.
//!
//! # The open half, since Phase 2b-2b-2
//!
//! `vars` and `form_fields` are now drafted too, and they are different in kind:
//! espanso fixes neither their keys nor the shape of their values. Three rules
//! keep them inside the same closed surface:
//!
//! - **Addressing is positional.** [`VariableDraft`], [`EntryDraft`] and
//!   [`FormFieldDraft`] name what they mean by its **index in the projection**,
//!   never by a key string. Rust reads the key text out of the projection to
//!   build the [`crate::patch::DocumentPath`], so a caller can only name what it
//!   was shown, and no refusal has to carry a byte of the owner's configuration
//!   (`CLAUDE.md` section 1).
//! - **Nothing is inserted below the match mapping.** A drafted entry the
//!   projection does not hold is refused by name rather than created (decision
//!   D1 of `docs/decisions/2b-2b-2-notes.md`): inserting an author-chosen key
//!   would be the first time this engine writes a key string that no schema
//!   fixes, and it needs its own anchor machinery and its own review.
//! - **A value is a scalar or a sequence of scalars.** [`EntryDraft`] carries
//!   both spellings and may use only one of them at a time; nothing here can
//!   express a nested mapping.

use serde::{Deserialize, Serialize};

use crate::draft::field::DraftField;

/// The key `vars` is written under.
///
/// The **one** place the spelling lives on the draft side, exactly as
/// [`MatchField::key`] is for a schema-known scalar: the planner builds a path
/// segment out of it and [`crate::draft::check_closed_surface`] reads the same
/// constant back, so the two cannot come to disagree.
pub(crate) const VARS_KEY: &str = "vars";

/// The key `form_fields` is written under.
pub(crate) const FORM_FIELDS_KEY: &str = "form_fields";

/// The key a variable's parameters are written under.
pub(crate) const PARAMS_KEY: &str = "params";

/// One schema-known scalar field of a match, by name.
///
/// The espanso key each names is [`MatchField::key`], and that function is the
/// **one** place the spelling lives: a path segment, an insertion's key and the
/// lookup that finds the existing value all go through it, so they cannot come
/// to disagree.
///
/// **It serializes as that key too.** `snake_case` is not a style choice here:
/// this enum owes no dictionary entry precisely because what a screen puts
/// beside a field is the espanso key itself, and that justification is only true
/// while the wire spells `UppercaseStyle` as `uppercase_style`. A refusal
/// interpolating a `MatchField` would otherwise show a Rust identifier to a user
/// in both languages. `every_match_field_serializes_as_its_espanso_key` in
/// `tests/draft_plan.rs` pins the two spellings against each other, variant by
/// variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchField {
    /// `trigger`.
    Trigger,
    /// `regex`.
    Regex,
    /// `replace`.
    Replace,
    /// `markdown`.
    Markdown,
    /// `html`.
    Html,
    /// `image_path`.
    ImagePath,
    /// `form`.
    Form,
    /// `label`.
    Label,
    /// `comment`.
    Comment,
    /// `word`.
    Word,
    /// `left_word`.
    LeftWord,
    /// `right_word`.
    RightWord,
    /// `propagate_case`.
    PropagateCase,
    /// `uppercase_style`.
    UppercaseStyle,
    /// `force_mode`.
    ForceMode,
    /// `force_clipboard`.
    ForceClipboard,
    /// `paragraph`.
    Paragraph,
    /// `anchor`.
    Anchor,
}

impl MatchField {
    /// Every field, in the order the planner considers them.
    ///
    /// The order decides the order of the derived batch and nothing else: the
    /// patch engine plans against the original index and splices from the
    /// highest offset downwards, so a batch means the same whatever order it
    /// arrives in. **Draft field order must not imply edit sequencing**, and
    /// this constant is the only ordering this module has.
    pub const ALL: [MatchField; 18] = [
        MatchField::Trigger,
        MatchField::Regex,
        MatchField::Replace,
        MatchField::Markdown,
        MatchField::Html,
        MatchField::ImagePath,
        MatchField::Form,
        MatchField::Label,
        MatchField::Comment,
        MatchField::Word,
        MatchField::LeftWord,
        MatchField::RightWord,
        MatchField::PropagateCase,
        MatchField::UppercaseStyle,
        MatchField::ForceMode,
        MatchField::ForceClipboard,
        MatchField::Paragraph,
        MatchField::Anchor,
    ];

    /// The espanso key this field is written under.
    pub fn key(self) -> &'static str {
        match self {
            MatchField::Trigger => "trigger",
            MatchField::Regex => "regex",
            MatchField::Replace => "replace",
            MatchField::Markdown => "markdown",
            MatchField::Html => "html",
            MatchField::ImagePath => "image_path",
            MatchField::Form => "form",
            MatchField::Label => "label",
            MatchField::Comment => "comment",
            MatchField::Word => "word",
            MatchField::LeftWord => "left_word",
            MatchField::RightWord => "right_word",
            MatchField::PropagateCase => "propagate_case",
            MatchField::UppercaseStyle => "uppercase_style",
            MatchField::ForceMode => "force_mode",
            MatchField::ForceClipboard => "force_clipboard",
            MatchField::Paragraph => "paragraph",
            MatchField::Anchor => "anchor",
        }
    } // End of function key() for MatchField

    /// The field a key names, or `None` when the key is outside the surface.
    ///
    /// `None` for `triggers`, `search_terms`, `vars` and `form_fields` as much
    /// as for a key espanso has never defined: this function answers *"is this
    /// a schema-known scalar field?"*, and those four are not.
    pub fn from_key(key: &str) -> Option<MatchField> {
        MatchField::ALL.into_iter().find(|field| field.key() == key)
    }
} // End of impl MatchField

/// One schema-known **sequence of strings** a match may hold.
///
/// A draft may edit an existing element of either. It may never add one or take
/// one away — see [`crate::draft::DraftError`].
///
/// It serializes as its espanso key, for [`MatchField`]'s reason and pinned by
/// `every_sequence_field_serializes_as_its_espanso_key`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SequenceField {
    /// `triggers`.
    Triggers,
    /// `search_terms`.
    SearchTerms,
}

impl SequenceField {
    /// Both sequences, in the order the planner considers them.
    pub const ALL: [SequenceField; 2] = [SequenceField::Triggers, SequenceField::SearchTerms];

    /// The espanso key this sequence is written under.
    pub fn key(self) -> &'static str {
        match self {
            SequenceField::Triggers => "triggers",
            SequenceField::SearchTerms => "search_terms",
        }
    }

    /// The sequence a key names, or `None` when the key names no sequence of
    /// the closed surface.
    pub fn from_key(key: &str) -> Option<SequenceField> {
        SequenceField::ALL
            .into_iter()
            .find(|sequence| sequence.key() == key)
    }
} // End of impl SequenceField

/// One schema-known scalar field of a **variable** of `vars`.
///
/// Espanso fixes these three names and says each holds a string, so they are
/// the only part of a variable this surface addresses by name rather than by
/// index. `params` is addressed positionally ([`EntryDraft`]) because its keys
/// differ per variable type, and `depends_on` is a sequence this phase does not
/// touch at all.
///
/// It serializes as its espanso key, for [`MatchField`]'s reason and pinned by
/// `every_variable_field_serializes_as_its_espanso_key`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VariableField {
    /// `name`.
    Name,
    /// `type`.
    Type,
    /// `inject_vars`.
    InjectVars,
}

impl VariableField {
    /// Every field, in the order the planner considers them.
    ///
    /// The order decides the order of the derived batch and nothing else, for
    /// [`MatchField::ALL`]'s reason.
    pub const ALL: [VariableField; 3] = [
        VariableField::Name,
        VariableField::Type,
        VariableField::InjectVars,
    ];

    /// The espanso key this field is written under.
    pub fn key(self) -> &'static str {
        match self {
            VariableField::Name => "name",
            VariableField::Type => "type",
            VariableField::InjectVars => "inject_vars",
        }
    }

    /// The field a key names, or `None` when the key names none of the three.
    ///
    /// `None` for `params` and `depends_on` as much as for a key espanso has
    /// never defined: this function answers *"is this a schema-known scalar
    /// field of a variable?"*, and those two are not.
    pub fn from_key(key: &str) -> Option<VariableField> {
        VariableField::ALL
            .into_iter()
            .find(|field| field.key() == key)
    }
} // End of impl VariableField

/// What a refusal is about, named by schema keys and by indices only.
///
/// Carried instead of a key string because a refusal crosses the process
/// boundary and the owner's configuration is private (`CLAUDE.md` section 1). A
/// [`MatchField`], a [`SequenceField`] and a [`VariableField`] are names
/// espanso's schema fixes, so they are safe to carry; the text of a key the
/// schema does not fix is not, and **no variant here holds one**. A variable, a
/// `params` entry, a `form_fields` entry and one of its options are therefore
/// each named by their **index in the projection** — the same address the draft
/// used to ask for them.
///
/// Everything it can name is rendered literally, and every spelling is stable on
/// the wire: the nested field identifiers serialize as their espanso keys, and
/// an index is an index.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum DraftTarget {
    /// A schema-known scalar field of the match.
    Field(MatchField),
    /// One element of a schema-known string sequence, by its index in the
    /// **original** document.
    Item {
        /// Which sequence.
        field: SequenceField,
        /// The element's index in the original document.
        index: usize,
    },
    /// One whole variable of `vars`, by its index in the projected list.
    Variable {
        /// The variable's index in the projected `vars` list.
        index: usize,
    },
    /// A schema-known scalar field of one variable of `vars`.
    VariableScalar {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which of the variable's three schema-known scalars.
        field: VariableField,
    },
    /// One entry of a variable's `params` mapping, by its index in the
    /// projected entry list.
    Param {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// The entry's index in that variable's projected `params` list.
        entry: usize,
    },
    /// One element of a `params` entry whose value is a sequence.
    ParamItem {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// The entry's index in that variable's projected `params` list.
        entry: usize,
        /// The element's index in that entry's sequence.
        item: usize,
    },
    /// One entry of `form_fields`, by its index in the projected entry list.
    FormField {
        /// The entry's index in the projected `form_fields` list.
        index: usize,
    },
    /// One option of one `form_fields` entry — an entry of that entry's own
    /// mapping — by its index in the projected entry list.
    FormFieldOption {
        /// The form field's index in the projected `form_fields` list.
        field: usize,
        /// The option's index in that form field's projected mapping.
        option: usize,
    },
    /// One element of a form-field option whose value is a sequence.
    FormFieldOptionItem {
        /// The form field's index in the projected `form_fields` list.
        field: usize,
        /// The option's index in that form field's projected mapping.
        option: usize,
        /// The element's index in that option's sequence.
        item: usize,
    },
}

/// One drafted element of a string sequence, addressed by index.
///
/// The index is a position in the **original** document, exactly as
/// [`crate::patch::ItemMove`]'s destination is: the batch is planned against the
/// file as it stands, so an index never means "wherever this ends up".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ItemDraft {
    /// The element's index in the original sequence.
    pub index: usize,
    /// What the caller wants that element to become.
    ///
    /// [`DraftField::Remove`] is refused: taking an element away is a change of
    /// the sequence's cardinality, and this phase does not make one.
    #[serde(default)]
    pub value: DraftField<String>,
}

/// One drafted entry of an **open** mapping, addressed by its index in the
/// projection.
///
/// An open mapping is one espanso does not fix the keys of: a variable's
/// `params`, and the option mapping under one `form_fields` entry. The index is
/// a position in the projected entry list, which is source order, so the caller
/// names an entry it was shown rather than a key it composed.
///
/// # Two spellings, one at a time
///
/// [`EntryDraft::value`] covers an entry whose value is a **scalar**;
/// [`EntryDraft::items`] covers one whose value is a **sequence of scalars** —
/// a `choice` variable's `values:`, most visibly. Drafting both on one entry is
/// two answers to one question and is refused at intent level, before any
/// diffing, with [`crate::draft::DraftError::EntryDraftsAScalarAndASequence`].
///
/// Nothing here expresses a nested mapping: an entry whose value is one may be
/// named, and every intent about it is refused rather than approximated.
///
/// `deny_unknown_fields` is deliberate, for [`MatchDraft`]'s reason.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntryDraft {
    /// The entry's index in the projected mapping.
    pub index: usize,
    /// What the caller wants the entry's scalar value to become.
    #[serde(default)]
    pub value: DraftField<String>,
    /// Drafted elements of the entry's sequence value, by index in the
    /// **original** document.
    #[serde(default)]
    pub items: Vec<ItemDraft>,
}

impl EntryDraft {
    /// An entry draft that says nothing about the entry at `index`.
    pub fn new(index: usize) -> EntryDraft {
        EntryDraft {
            index,
            value: DraftField::Unchanged,
            items: Vec::new(),
        }
    }

    /// Builder: sets the entry's scalar value to a logical value.
    pub fn set(mut self, value: impl Into<String>) -> EntryDraft {
        self.value = DraftField::Set(value.into());
        self
    }

    /// Builder: asks for the whole entry to be taken away.
    pub fn removed(mut self) -> EntryDraft {
        self.value = DraftField::Remove;
        self
    }

    /// Builder: sets one element of the entry's sequence to a logical value.
    pub fn with_item(mut self, index: usize, value: impl Into<String>) -> EntryDraft {
        self.items.push(ItemDraft {
            index,
            value: DraftField::Set(value.into()),
        });
        self
    }
} // End of impl EntryDraft

/// One drafted variable of `vars`, addressed by its index in the projection.
///
/// The three schema-known scalars are named ([`VariableField`]); everything else
/// a variable may hold is addressed positionally through
/// [`VariableDraft::params`]. `depends_on` is deliberately absent: it is a
/// sequence whose elements this phase does not draft.
///
/// **An absent field is refused, never inserted** (decision D1): this phase adds
/// no entry below the match mapping.
///
/// `deny_unknown_fields` is deliberate, for [`MatchDraft`]'s reason.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VariableDraft {
    /// The variable's index in the projected `vars` list.
    pub index: usize,
    /// `name`.
    #[serde(default)]
    pub name: DraftField<String>,
    /// `type`.
    #[serde(default, rename = "type")]
    pub declared_type: DraftField<String>,
    /// `inject_vars`.
    #[serde(default)]
    pub inject_vars: DraftField<String>,
    /// Drafted entries of the variable's `params` mapping.
    #[serde(default)]
    pub params: Vec<EntryDraft>,
}

impl VariableDraft {
    /// A variable draft that says nothing about the variable at `index`.
    pub fn new(index: usize) -> VariableDraft {
        VariableDraft {
            index,
            ..VariableDraft::default()
        }
    }

    /// What the draft says about one of the variable's schema-known scalars.
    ///
    /// The **one** place the enum and the struct field are matched up, for
    /// [`MatchDraft::field`]'s reason.
    pub fn field(&self, field: VariableField) -> &DraftField<String> {
        match field {
            VariableField::Name => &self.name,
            VariableField::Type => &self.declared_type,
            VariableField::InjectVars => &self.inject_vars,
        }
    }

    /// A mutable reference to what the draft says about one of them.
    pub fn field_mut(&mut self, field: VariableField) -> &mut DraftField<String> {
        match field {
            VariableField::Name => &mut self.name,
            VariableField::Type => &mut self.declared_type,
            VariableField::InjectVars => &mut self.inject_vars,
        }
    }

    /// Builder: sets one of the variable's schema-known scalars.
    pub fn with(mut self, field: VariableField, value: impl Into<String>) -> VariableDraft {
        *self.field_mut(field) = DraftField::Set(value.into());
        self
    }

    /// Builder: asks for one of the variable's schema-known scalars to be taken
    /// away.
    pub fn without(mut self, field: VariableField) -> VariableDraft {
        *self.field_mut(field) = DraftField::Remove;
        self
    }

    /// Builder: adds one drafted `params` entry.
    pub fn with_param(mut self, entry: EntryDraft) -> VariableDraft {
        self.params.push(entry);
        self
    }
} // End of impl VariableDraft

/// One drafted entry of `form_fields`, addressed by its index in the projection.
///
/// A `form_fields` entry's value is the option mapping espanso reads —
/// `type`, `values`, `default`, `multiline` and whatever else a release adds —
/// so the only thing this type drafts is [`FormFieldDraft::options`]. The entry
/// itself is never removed: its value is a mapping, and this engine replaces no
/// collection node and discards no subtree it never displayed.
///
/// `deny_unknown_fields` is deliberate, for [`MatchDraft`]'s reason.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FormFieldDraft {
    /// The form field's index in the projected `form_fields` list.
    pub index: usize,
    /// Drafted entries of that form field's own option mapping.
    #[serde(default)]
    pub options: Vec<EntryDraft>,
}

impl FormFieldDraft {
    /// A form-field draft that says nothing about the field at `index`.
    pub fn new(index: usize) -> FormFieldDraft {
        FormFieldDraft {
            index,
            options: Vec::new(),
        }
    }

    /// Builder: adds one drafted option.
    pub fn with_option(mut self, entry: EntryDraft) -> FormFieldDraft {
        self.options.push(entry);
        self
    }
} // End of impl FormFieldDraft

/// A caller's intent for one match, over the closed scalar surface.
///
/// Every field defaults to [`DraftField::Unchanged`], so a draft that mentions
/// one key means *change that key and nothing else*. The two sequences default
/// to empty, which means the same thing: no element was drafted.
///
/// `deny_unknown_fields` is deliberate. A key this type does not have is a
/// caller sending something this engine does not model — a typo, a stale field
/// name, a `vars` it hoped would work — and reading it as "everything
/// unchanged" would turn a request the caller believes it made into silence.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MatchDraft {
    /// `trigger`.
    #[serde(default)]
    pub trigger: DraftField<String>,
    /// `regex`.
    #[serde(default)]
    pub regex: DraftField<String>,
    /// `replace`.
    #[serde(default)]
    pub replace: DraftField<String>,
    /// `markdown`.
    #[serde(default)]
    pub markdown: DraftField<String>,
    /// `html`.
    #[serde(default)]
    pub html: DraftField<String>,
    /// `image_path`.
    #[serde(default)]
    pub image_path: DraftField<String>,
    /// `form`.
    #[serde(default)]
    pub form: DraftField<String>,
    /// `label`.
    #[serde(default)]
    pub label: DraftField<String>,
    /// `comment`.
    #[serde(default)]
    pub comment: DraftField<String>,
    /// `word`.
    #[serde(default)]
    pub word: DraftField<String>,
    /// `left_word`.
    #[serde(default)]
    pub left_word: DraftField<String>,
    /// `right_word`.
    #[serde(default)]
    pub right_word: DraftField<String>,
    /// `propagate_case`.
    #[serde(default)]
    pub propagate_case: DraftField<String>,
    /// `uppercase_style`.
    #[serde(default)]
    pub uppercase_style: DraftField<String>,
    /// `force_mode`.
    #[serde(default)]
    pub force_mode: DraftField<String>,
    /// `force_clipboard`.
    #[serde(default)]
    pub force_clipboard: DraftField<String>,
    /// `paragraph`.
    #[serde(default)]
    pub paragraph: DraftField<String>,
    /// `anchor`.
    #[serde(default)]
    pub anchor: DraftField<String>,
    /// Drafted elements of `triggers`, by index in the original document.
    #[serde(default)]
    pub triggers: Vec<ItemDraft>,
    /// Drafted elements of `search_terms`, by index in the original document.
    #[serde(default)]
    pub search_terms: Vec<ItemDraft>,
    /// Drafted variables of `vars`, by index in the projected list.
    #[serde(default)]
    pub vars: Vec<VariableDraft>,
    /// Drafted entries of `form_fields`, by index in the projected list.
    #[serde(default)]
    pub form_fields: Vec<FormFieldDraft>,
}

impl MatchDraft {
    /// A draft that changes nothing.
    pub fn new() -> MatchDraft {
        MatchDraft::default()
    }

    /// What the draft says about one field.
    ///
    /// The **one** place the enum and the struct field are matched up. Every
    /// reader goes through it, so a field added to [`MatchDraft`] and forgotten
    /// here is one visible omission rather than a silently unread value.
    pub fn field(&self, field: MatchField) -> &DraftField<String> {
        match field {
            MatchField::Trigger => &self.trigger,
            MatchField::Regex => &self.regex,
            MatchField::Replace => &self.replace,
            MatchField::Markdown => &self.markdown,
            MatchField::Html => &self.html,
            MatchField::ImagePath => &self.image_path,
            MatchField::Form => &self.form,
            MatchField::Label => &self.label,
            MatchField::Comment => &self.comment,
            MatchField::Word => &self.word,
            MatchField::LeftWord => &self.left_word,
            MatchField::RightWord => &self.right_word,
            MatchField::PropagateCase => &self.propagate_case,
            MatchField::UppercaseStyle => &self.uppercase_style,
            MatchField::ForceMode => &self.force_mode,
            MatchField::ForceClipboard => &self.force_clipboard,
            MatchField::Paragraph => &self.paragraph,
            MatchField::Anchor => &self.anchor,
        }
    } // End of function field() for MatchDraft

    /// A mutable reference to what the draft says about one field.
    pub fn field_mut(&mut self, field: MatchField) -> &mut DraftField<String> {
        match field {
            MatchField::Trigger => &mut self.trigger,
            MatchField::Regex => &mut self.regex,
            MatchField::Replace => &mut self.replace,
            MatchField::Markdown => &mut self.markdown,
            MatchField::Html => &mut self.html,
            MatchField::ImagePath => &mut self.image_path,
            MatchField::Form => &mut self.form,
            MatchField::Label => &mut self.label,
            MatchField::Comment => &mut self.comment,
            MatchField::Word => &mut self.word,
            MatchField::LeftWord => &mut self.left_word,
            MatchField::RightWord => &mut self.right_word,
            MatchField::PropagateCase => &mut self.propagate_case,
            MatchField::UppercaseStyle => &mut self.uppercase_style,
            MatchField::ForceMode => &mut self.force_mode,
            MatchField::ForceClipboard => &mut self.force_clipboard,
            MatchField::Paragraph => &mut self.paragraph,
            MatchField::Anchor => &mut self.anchor,
        }
    } // End of function field_mut() for MatchDraft

    /// The drafted elements of one sequence.
    pub fn items(&self, field: SequenceField) -> &[ItemDraft] {
        match field {
            SequenceField::Triggers => &self.triggers,
            SequenceField::SearchTerms => &self.search_terms,
        }
    }

    /// Builder: sets one field to a logical value.
    pub fn with(mut self, field: MatchField, value: impl Into<String>) -> MatchDraft {
        *self.field_mut(field) = DraftField::Set(value.into());
        self
    }

    /// Builder: asks for one field to be taken away.
    pub fn without(mut self, field: MatchField) -> MatchDraft {
        *self.field_mut(field) = DraftField::Remove;
        self
    }

    /// Builder: sets one element of a sequence to a logical value.
    pub fn with_item(
        mut self,
        field: SequenceField,
        index: usize,
        value: impl Into<String>,
    ) -> MatchDraft {
        let item = ItemDraft {
            index,
            value: DraftField::Set(value.into()),
        };
        match field {
            SequenceField::Triggers => self.triggers.push(item),
            SequenceField::SearchTerms => self.search_terms.push(item),
        }
        self
    } // End of function with_item()

    /// Builder: adds one drafted variable.
    pub fn with_variable(mut self, variable: VariableDraft) -> MatchDraft {
        self.vars.push(variable);
        self
    }

    /// Builder: adds one drafted `form_fields` entry.
    pub fn with_form_field(mut self, field: FormFieldDraft) -> MatchDraft {
        self.form_fields.push(field);
        self
    }
} // End of impl MatchDraft
