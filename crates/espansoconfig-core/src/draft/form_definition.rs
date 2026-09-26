//! Form field **definitions** — the option mappings a form's placeholders are
//! described by — as a closed description, and the intents that add and remove
//! them (Phase 4-6).
//!
//! # One description, two shapes, never a conversion
//!
//! A form keeps its definitions in one of two places, and espanso reads both:
//!
//! - **shorthand** — the match's own `form_fields`, beside a `form:` layout;
//! - **verbose** — `params.fields` of a variable of `type: form`, beside
//!   `params.layout`.
//!
//! [`FormOwner`] names which one an intent is about, and the intent itself is
//! the same type either way: a [`FormFieldIntent`] carried by
//! [`crate::draft::MatchDraft::form_intents`] writes `form_fields`, and the same
//! intent carried by [`crate::draft::VariableDraft::field_intents`] writes that
//! variable's `params.fields`. Nothing here moves a definition from one shape to
//! the other (ruling 17 of `docs/decisions/4-split-notes.md` §3): the caller
//! chooses where to send an intent, and the planner writes exactly there.
//!
//! # What a definition is born holding
//!
//! [`NewFormField`] is a name and a [`FormOptions`] — the schema-known options of
//! plan section 3.5 (`type`, `default`, `multiline`, `values`,
//! `trim_string_values`) plus a bounded list of extra author-named options, each
//! a scalar or a flat list of scalars. `values` is one of two representations,
//! [`FormValues::List`] or [`FormValues::Text`] — the scalar list and the
//! multi-line string of `form-layout-and-choice.yml` — and neither is ever turned
//! into the other (ruling 18).
//!
//! # Typed settings are plain source
//!
//! `multiline` and `trim_string_values` are two of ruling 4's typed settings, and
//! this is the step that first writes them, so this is where their policy lives:
//! **validated plain source**, written verbatim after
//! [`crate::draft::is_plain_source`] accepts it, never quoted into a string and
//! never interpreted (D2u). Every other value — `type`, `default`, `values`, the
//! extras — is a logical string spelled by the codec. An extra option named after
//! any typed setting, or after one of the five schema-known options, is refused,
//! so the typed field is the only route to each.
//!
//! # What the type does not force
//!
//! That a name is unique, that a setting is plain source, that an extra key meets
//! ruling 7 and that the extras stay within [`FormOptions::MAX_EXTRA_OPTIONS`] are
//! checked by [`crate::draft::plan_match_edits`]; a `String` cannot say any of
//! it. The audit ([`crate::draft::check_closed_surface`]) re-reads the derived
//! batch and admits exactly the shapes written here.

use serde::{Deserialize, Serialize};

use crate::draft::match_draft::{NewParam, NewParamValue};
use crate::draft::new_variable::VariableSetting;
use crate::draft::sequence::{ListPlacement, ScalarItems};
use crate::patch::{EntryValue, ItemFields, ItemValue};

/// The key a verbose form's definitions are written under, inside `params`.
pub(crate) const FIELDS_KEY: &str = "fields";
/// The key a definition's field type is written under.
pub(crate) const OPTION_TYPE_KEY: &str = "type";
/// The key a definition's default is written under.
pub(crate) const OPTION_DEFAULT_KEY: &str = "default";
/// The key a definition's multi-line switch is written under.
pub(crate) const OPTION_MULTILINE_KEY: &str = "multiline";
/// The key a `choice` or `list` definition's values are written under.
pub(crate) const OPTION_VALUES_KEY: &str = "values";
/// The key a `list` definition's trimming switch is written under.
pub(crate) const OPTION_TRIM_KEY: &str = "trim_string_values";

/// The five schema-known options of a definition, in the order a new one writes
/// them. An extra option may use none of them.
pub(crate) const FORM_OPTION_KEYS: [&str; 5] = [
    OPTION_TYPE_KEY,
    OPTION_DEFAULT_KEY,
    OPTION_MULTILINE_KEY,
    OPTION_VALUES_KEY,
    OPTION_TRIM_KEY,
];

/// The options a definition writes **verbatim as plain source** (ruling 4), and
/// no other. [`crate::draft::check_closed_surface`] reads the same list.
pub(crate) const FORM_PLAIN_SOURCE_OPTIONS: [&str; 2] = [OPTION_MULTILINE_KEY, OPTION_TRIM_KEY];

/// Which form's definitions an intent or a refusal is about (Phase 4-6).
///
/// Positions only, never a name: `CLAUDE.md` section 1 applies to a refusal that
/// carries this as much as to any other.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum FormOwner {
    /// The match's own `form_fields` (shorthand).
    Shorthand {},
    /// `params.fields` of an existing variable of `type: form` (verbose), by the
    /// variable's index in the projected `vars` list.
    Variable {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// `params.fields` of a **new** form variable, by the position of its
    /// [`crate::draft::VarsIntent::InsertVariable`] in `var_intents`.
    NewVariable {
        /// The intent's position in `var_intents`.
        insertion: usize,
    },
}

/// The `values` of a new `choice` or `list` definition, in one of the two
/// representations espanso reads (plan section 3.5). They stay distinct: nothing
/// turns a list into text or text into a list (ruling 18).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FormValues {
    /// A flat list of logical strings, written in block style, or `[]` when empty.
    List(Vec<String>),
    /// One logical string, one value per line — the codec writes a multi-line
    /// string as a literal block.
    Text(String),
}

/// The options a new definition is born holding, or that are added to an
/// existing one (Phase 4-6).
///
/// An option left `None` is one the definition is not given at all. The five
/// schema-known options are written first, in [`FORM_OPTION_KEYS`] order, then
/// the extras in their own order. `multiline` and `trim_string_values` are plain
/// source; everything else is a logical string. `deny_unknown_fields` is
/// deliberate, for [`crate::draft::MatchDraft`]'s reason.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FormOptions {
    /// `type` — `text`, `choice` or `list` in espanso's words; any text here,
    /// never interpreted.
    #[serde(default, rename = "type")]
    pub field_type: Option<String>,
    /// `default`.
    #[serde(default)]
    pub default: Option<String>,
    /// `multiline`, written as plain source.
    #[serde(default)]
    pub multiline: Option<String>,
    /// `values`, as a list or as text.
    #[serde(default)]
    pub values: Option<FormValues>,
    /// `trim_string_values`, written as plain source.
    #[serde(default)]
    pub trim_string_values: Option<String>,
    /// Extra author-named options, each a scalar or a flat list of scalars, at
    /// most [`FormOptions::MAX_EXTRA_OPTIONS`].
    #[serde(default)]
    pub extra: Vec<NewParam>,
}

impl FormOptions {
    /// How many extra author-named options one description may carry. A bound
    /// that keeps the description bounded, not a limit espanso states.
    pub const MAX_EXTRA_OPTIONS: usize = 16;

    /// Whether this asks for no option at all.
    pub fn is_empty(&self) -> bool {
        self.field_type.is_none()
            && self.default.is_none()
            && self.multiline.is_none()
            && self.values.is_none()
            && self.trim_string_values.is_none()
            && self.extra.is_empty()
    }

    /// Builder: sets `type`.
    pub fn with_type(mut self, text: impl Into<String>) -> FormOptions {
        self.field_type = Some(text.into());
        self
    }

    /// Builder: sets `default`.
    pub fn with_default(mut self, text: impl Into<String>) -> FormOptions {
        self.default = Some(text.into());
        self
    }

    /// Builder: sets `multiline` to a plain-source text.
    pub fn with_multiline(mut self, text: impl Into<String>) -> FormOptions {
        self.multiline = Some(text.into());
        self
    }

    /// Builder: sets `values`.
    pub fn with_values(mut self, values: FormValues) -> FormOptions {
        self.values = Some(values);
        self
    }

    /// Builder: sets `trim_string_values` to a plain-source text.
    pub fn with_trim_string_values(mut self, text: impl Into<String>) -> FormOptions {
        self.trim_string_values = Some(text.into());
        self
    }

    /// Builder: adds one extra author-named option.
    pub fn with_extra(mut self, option: NewParam) -> FormOptions {
        self.extra.push(option);
        self
    }

    /// The typed settings this sets, with their text, in writing order.
    pub fn settings(&self) -> Vec<(VariableSetting, &str)> {
        let multiline = self
            .multiline
            .as_deref()
            .map(|text| (VariableSetting::Multiline, text));
        let trim = self
            .trim_string_values
            .as_deref()
            .map(|text| (VariableSetting::TrimStringValues, text));
        multiline.into_iter().chain(trim).collect()
    } // End of function settings() for FormOptions

    /// Every key this writes, in writing order.
    pub fn keys(&self) -> Vec<&str> {
        self.entries_by_reference()
            .into_iter()
            .map(|(key, _)| key)
            .collect()
    }

    /// The options as the engine writes them, in writing order. Pure
    /// translation: nothing is validated here, which is the planner's job.
    pub(crate) fn entries(&self) -> Vec<(String, EntryValue)> {
        self.entries_by_reference()
            .into_iter()
            .map(|(key, value)| (key.to_owned(), value))
            .collect()
    }

    /// [`FormOptions::entries`] with borrowed keys.
    fn entries_by_reference(&self) -> Vec<(&str, EntryValue)> {
        let mut entries: Vec<(&str, EntryValue)> = Vec::new();
        let scalar = |text: &String| EntryValue::Scalar(text.clone());
        let plain = |text: &String| EntryValue::PlainSource(text.clone());
        if let Some(text) = &self.field_type {
            entries.push((OPTION_TYPE_KEY, scalar(text)));
        }
        if let Some(text) = &self.default {
            entries.push((OPTION_DEFAULT_KEY, scalar(text)));
        }
        if let Some(text) = &self.multiline {
            entries.push((OPTION_MULTILINE_KEY, plain(text)));
        }
        match &self.values {
            Some(FormValues::List(items)) => {
                entries.push((OPTION_VALUES_KEY, EntryValue::ScalarList(items.clone())))
            }
            Some(FormValues::Text(text)) => entries.push((OPTION_VALUES_KEY, scalar(text))),
            None => {}
        }
        if let Some(text) = &self.trim_string_values {
            entries.push((OPTION_TRIM_KEY, plain(text)));
        }
        for option in &self.extra {
            let value = match &option.value {
                NewParamValue::Scalar(text) => EntryValue::Scalar(text.clone()),
                NewParamValue::List(items) => EntryValue::ScalarList(items.clone()),
            };
            entries.push((option.key.as_str(), value));
        } // End of the loop over the extra options
        entries
    } // End of function entries_by_reference()
} // End of impl FormOptions

/// A new form field definition (Phase 4-6): the placeholder name it describes
/// and the options it is born holding.
///
/// A definition with no option is written `name: {}` — the one spelling an empty
/// mapping has (ruling 8) — which espanso reads as a plain text field.
/// `deny_unknown_fields` is deliberate, for [`crate::draft::MatchDraft`]'s reason.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewFormField {
    /// The field's name — the text between `[[` and `]]` in the layout — as
    /// decoded text, spelled by the codec in key context.
    pub name: String,
    /// The options it is born holding.
    #[serde(default)]
    pub options: FormOptions,
}

impl NewFormField {
    /// A definition of `name` holding `options`.
    pub fn new(name: impl Into<String>, options: FormOptions) -> NewFormField {
        NewFormField {
            name: name.into(),
            options,
        }
    }

    /// The definition as the engine writes it: the name, and the option
    /// mapping's entries.
    pub(crate) fn definition(&self) -> (String, ItemFields) {
        let options = self
            .options
            .entries()
            .into_iter()
            .map(|(key, value)| (key, ItemValue::Entry(value)))
            .collect();
        (self.name.clone(), options)
    }
} // End of impl NewFormField

/// The definitions of several new fields as one mapping's entries, in order.
pub(crate) fn definitions(fields: &[NewFormField]) -> ItemFields {
    fields
        .iter()
        .map(|field| {
            let (name, options) = field.definition();
            (name, ItemValue::Mapping(options))
        })
        .collect()
}

/// One intent about the **cardinality or the presence** of one form's
/// definitions (Phase 4-6).
///
/// Every index is a position in the **original** projected definition list. The
/// same intent writes the shorthand or the verbose shape according to where it
/// is carried, never converting (see the module documentation). It crosses the
/// wire externally tagged, each variant closed by `deny_unknown_fields`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum FormFieldIntent {
    /// Add one new definition after the definition at `after`, or after the last
    /// one the draft leaves in place when `after` is `None`. Several insertions
    /// landing at one place are written as one run, in intent order. When the form
    /// has no definitions at all, the whole `form_fields:` (or `fields:`) entry is
    /// written holding the new ones, and `after` must be `None`.
    InsertField {
        /// The definition to write after, by index, or `None` for the end.
        #[serde(default)]
        after: Option<usize>,
        /// The new definition.
        field: NewFormField,
    },
    /// Take one definition away, with the comments it owns. Refused when its
    /// options hold a collection the editor never showed, and when it would
    /// leave the form with no definition
    /// ([`crate::draft::DraftError::FormFieldsWouldBeEmpty`]).
    RemoveField {
        /// The definition's index in the projected list.
        index: usize,
    },
    /// Remove the whole `form_fields` (or `params.fields`) entry as a deliberate
    /// container removal (ruling 8). A form without definitions derives no edit.
    RemoveFields {},
}

impl FormFieldIntent {
    /// The intent that inserts `field` at the end.
    pub fn insert(field: NewFormField) -> FormFieldIntent {
        FormFieldIntent::InsertField { after: None, field }
    }

    /// The intent that inserts `field` after the definition at `index`.
    pub fn insert_after(index: usize, field: NewFormField) -> FormFieldIntent {
        FormFieldIntent::InsertField {
            after: Some(index),
            field,
        }
    }
} // End of impl FormFieldIntent

/// One intent about the **items** of an existing definition's `values` list
/// (Phase 4-6). An existing item is rewritten through the `values` option's
/// [`crate::draft::EntryDraft::items`], as before; these add and remove.
///
/// A `values` written as text is not a list and refuses both
/// ([`crate::draft::DraftError::FormValuesIsNotAList`]): its lines are edited as
/// the one string they are.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum FormValuesIntent {
    /// Add strings at one place, in order — block, flow or `[]`, never
    /// converting.
    InsertItems {
        /// Where, in the original list.
        at: ListPlacement,
        /// The new strings.
        items: ScalarItems,
    },
    /// Take one item away, with the comments it owns.
    RemoveItem {
        /// The item's index in the original list.
        index: usize,
    },
}
