//! The draft itself: which fields it can name, and what it says about each.
//!
//! # The surface is closed, and it is closed by this type
//!
//! Every key [`MatchDraft`] can name is a key espanso's schema fixes and whose
//! value that schema says is a **string**: the two trigger spellings, the five
//! content spellings, `label`, `comment`, the nine match options, and the
//! *existing* elements of the two string sequences. `vars` and `form_fields` are
//! deliberately absent — their keys are the author's rather than the schema's
//! and their values may be collections — and so is anything that would add or
//! delete a sequence element.
//!
//! That is a claim the **type** makes, not a check some function performs: a
//! draft carries `String`s, so a destination that would need a new mapping or a
//! new sequence cannot be expressed at all. What a function still has to check
//! is the other direction — an existing value that is a collection — and
//! [`crate::draft::plan_match_edits`] refuses that by name.

use serde::{Deserialize, Serialize};

use crate::draft::field::DraftField;

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

/// What a refusal is about: a field of the match, or one element of a sequence.
///
/// Carried instead of a key string because a refusal crosses the process
/// boundary and the owner's configuration is private (`CLAUDE.md` section 1). A
/// [`MatchField`] is a name espanso's schema fixes, so it is safe to carry; the
/// text of a key the schema does not fix is not, and no variant here holds one.
///
/// Both things it can name are rendered literally, and both spellings are now
/// stable on the wire: the nested [`MatchField`] and [`SequenceField`] serialize
/// as their espanso keys, and an index is an index.
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
} // End of impl MatchDraft
