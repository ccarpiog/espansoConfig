//! From a draft to the smallest batch that realises it.

use crate::draft::audit::{check_batch_independence, check_closed_surface, NestedKeys};
use crate::draft::error::DraftError;
use crate::draft::field::DraftField;
use crate::draft::match_draft::{
    DraftTarget, EntryDraft, ItemDraft, MatchDraft, MatchField, SequenceField, VariableDraft,
    VariableField, FORM_FIELDS_KEY, PARAMS_KEY,
};
use crate::model::{FieldView, MatchView, ScalarView, UnknownReason, ValueKind, ValueView};
use crate::patch::{DocumentEdit, DocumentPath, FieldInsert, FieldRemoval, ScalarEdit};

/// Derives the batch a draft asks for, or refuses it by name.
///
/// # The rule the whole function exists for
///
/// **A field is unchanged when the drafted logical value equals the existing
/// scalar's decoded logical value.** Nothing else is the test.
///
/// Not the source text: a file may validly hold `'hello'` where the draft says
/// `hello`, and those are the same value written two ways. Not what the codec
/// would re-emit either: [`crate::emit::choose_scalar`] may canonically render
/// `"hello"` for a value the file spells `'hello'`, so comparing the codec's
/// output with the source text calls an untouched field changed — and rewriting
/// it is exactly the preservation bug this module exists to prevent. The
/// comparison is between two **logical values**, and
/// [`crate::model::ScalarView::text`] is already one:
/// [`crate::emit::decode`]'s output, with escapes resolved, a block scalar
/// de-indented, folded and chomped.
///
/// The corollary is the three answers this function gives to a `Set`:
///
/// | The field is | and the draft says | so the batch gets |
/// |---|---|---|
/// | present, decoding to the drafted value | `Set` | **nothing** |
/// | present, decoding to something else | `Set` | one [`ScalarEdit`] |
/// | absent | `Set` | one [`FieldInsert`] |
///
/// and the two it gives to a `Remove`: one [`FieldRemoval`] when the field is
/// there, and **nothing** when it is not, because the desired state is already
/// the actual state.
///
/// **The third row of that table is the match mapping's alone.** Below it —
/// inside a variable, a `params` mapping or a `form_fields` entry — an absent
/// target is *refused*, never inserted, because this engine writes no key string
/// that no schema fixes (2b-2b-2's decision D1, and
/// [`DraftError::TargetDoesNotExist`] is where it is written down). The equality
/// rule itself is unchanged and is applied by the same [`plan_scalar`] at every
/// depth: **there is one comparison in this module and there will not be a
/// second.**
///
/// # The order of the checks is the contract
///
/// 1. the match has a path;
/// 2. no key of its mapping is written twice — a path that names two nodes is
///    not a path, and paths are this function's whole output;
/// 3. the hazard gate does not refuse the match;
/// 4. no index is drafted twice — in either string sequence, in `vars`, in a
///    variable's `params`, in `form_fields`, in a form field's options or in any
///    nested sequence. Checked **at intent level, before any diffing**, because
///    an intent that asks for the value already there derives no edit and would
///    be invisible to every later check;
/// 5. no drafted entry says both "this scalar" and "these elements";
/// 6. every drafted field is planned, in [`MatchField::ALL`] order, then every
///    drafted sequence element, then every drafted variable, then every drafted
///    `form_fields` entry, each in the draft's own order;
/// 7. the derived batch passes [`check_closed_surface`];
/// 8. and [`check_batch_independence`], which is now given the keys of every
///    open mapping the batch reached into as well as the match's own.
///
/// Steps 1 to 3 are about the **match**, not about the batch, so a draft that
/// would change nothing is still refused for a match that cannot be edited. The
/// answer to *may I edit this match* is no whatever is asked of it. Steps 4 and
/// 5 are about the **draft**, and they are the checks that cannot be moved later
/// without changing what they catch.
///
/// # An address is resolved even when it carries no intent
///
/// A [`crate::draft::VariableDraft`], an [`crate::draft::EntryDraft`] and a
/// [`crate::draft::FormFieldDraft`] are **containers**: their index is an
/// address the caller asserts exists, so it is resolved and refused whether or
/// not anything inside them is `Set`. An [`ItemDraft`] holding
/// [`DraftField::Unchanged`] is not an address but a statement that there is no
/// intent, and it is skipped before resolution — which is 2b-2b-1's behaviour,
/// unchanged.
///
/// # What it is not
///
/// It writes nothing and reads no file. The result is a `Vec<DocumentEdit>` and
/// nothing else; putting it on disk is
/// [`crate::persist::save_document`]'s job, and that function is the only entry
/// point in this crate that may write a user's file.
///
/// # Errors
///
/// See [`DraftError`]. Every refusal discards the whole batch: a draft is one
/// intention, and half of one is not a smaller version of it.
pub fn plan_match_edits(
    view: &MatchView,
    draft: &MatchDraft,
) -> Result<Vec<DocumentEdit>, DraftError> {
    let path = view.path.as_ref().ok_or(DraftError::MatchHasNoPath)?;
    if let Some(repeated) = view
        .unknown_entries
        .iter()
        .find(|entry| entry.reason == UnknownReason::RepeatedKey)
    {
        return Err(DraftError::AmbiguousKey {
            field: repeated.key.as_deref().and_then(MatchField::from_key),
        });
    }
    if let Some(hazard) = view.blocking_hazard {
        return Err(DraftError::MatchNotEditable {
            hazard: Some(hazard),
        });
    }
    if !view.safely_editable {
        return Err(DraftError::MatchNotEditable { hazard: None });
    }
    check_no_index_is_drafted_twice(draft)?;
    check_no_entry_drafts_two_shapes(draft)?;

    let entries = visible_entries(view);
    let mut edits: Vec<DocumentEdit> = Vec::new();
    let mut insertions: Vec<(MatchField, String)> = Vec::new();
    let mut nested: Vec<NestedKeys> = Vec::new();
    for field in MatchField::ALL {
        plan_field(view, draft, path, field, &mut edits, &mut insertions)?;
    } // End of the loop over the schema-known scalar fields
    for sequence in SequenceField::ALL {
        plan_sequence(view, draft, path, sequence, &mut edits)?;
    } // End of the loop over the schema-known string sequences
    plan_vars(view, draft, &mut edits, &mut nested)?;
    plan_form_fields(view, draft, path, &mut edits, &mut nested)?;
    if !insertions.is_empty() {
        let anchor = last_nameable_key(&entries).ok_or(DraftError::NoInsertionAnchor {
            field: insertions[0].0,
        })?;
        for (field, value) in insertions {
            edits.push(FieldInsert::after(path.clone(), anchor, field.key(), value).into());
        }
    }

    check_closed_surface(path, &edits)?;
    check_batch_independence(path, &original_keys(&entries), &nested, &edits)?;
    Ok(edits)
} // End of function plan_match_edits()

/// Refuses a draft that says two things about one sequence element.
///
/// **Intent level, and before any diffing.** A [`DraftField::Set`] to the value
/// an element already holds derives no edit at all — correctly, because the
/// desired state is the actual state — so a draft holding *that* intent and a
/// second one at the same index arrives at the batch guards as a batch of one
/// edit. Nothing downstream can tell it apart from a draft that only ever said
/// one thing, and the file would then be written as though draft order meant
/// *last effective value wins*. It does not: draft field order must not imply
/// edit sequencing, and two intents about one element are two answers to one
/// question rather than a sequence of them.
///
/// [`DraftField::Unchanged`] is not an intent and is skipped: a list carrying
/// `Unchanged` twice at one index asks for nothing twice.
///
/// A [`MatchField`] and a [`VariableField`] cannot be drafted twice by
/// construction — [`MatchDraft`] and [`VariableDraft`] have one struct field per
/// key, and `serde` refuses a JSON object that writes one of them more than once
/// — so this check is only about the draft's **lists**, which since Phase
/// 2b-2b-2 are six kinds rather than one: the two string sequences, `vars`, a
/// variable's `params`, `form_fields`, a form field's options, and the nested
/// item list of any open entry.
fn check_no_index_is_drafted_twice(draft: &MatchDraft) -> Result<(), DraftError> {
    for sequence in SequenceField::ALL {
        if let Some((index, first, second)) = repeated_item_index(draft.items(sequence)) {
            return Err(DraftError::SequenceItemDraftedTwice {
                field: sequence,
                index,
                first,
                second,
            });
        }
    } // End of the loop over the two string sequences

    let variables: Vec<usize> = draft.vars.iter().map(|variable| variable.index).collect();
    if let Some((index, first, second)) = repeated_index(&variables) {
        return Err(DraftError::TargetDraftedTwice {
            target: DraftTarget::Variable { index },
            first,
            second,
        });
    }
    for variable in &draft.vars {
        check_open_mapping_is_drafted_once(
            &variable.params,
            OpenMapping::Params {
                variable: variable.index,
            },
        )?;
    } // End of the loop over the drafted variables

    let fields: Vec<usize> = draft.form_fields.iter().map(|field| field.index).collect();
    if let Some((index, first, second)) = repeated_index(&fields) {
        return Err(DraftError::TargetDraftedTwice {
            target: DraftTarget::FormField { index },
            first,
            second,
        });
    }
    for field in &draft.form_fields {
        check_open_mapping_is_drafted_once(
            &field.options,
            OpenMapping::FormField { field: field.index },
        )?;
    } // End of the loop over the drafted form fields
    Ok(())
} // End of function check_no_index_is_drafted_twice()

/// The same check over one open mapping's drafted entries and their elements.
fn check_open_mapping_is_drafted_once(
    drafts: &[EntryDraft],
    owner: OpenMapping,
) -> Result<(), DraftError> {
    let indices: Vec<usize> = drafts.iter().map(|entry| entry.index).collect();
    if let Some((entry, first, second)) = repeated_index(&indices) {
        return Err(DraftError::TargetDraftedTwice {
            target: owner.entry(entry),
            first,
            second,
        });
    }
    for entry in drafts {
        if let Some((item, first, second)) = repeated_item_index(&entry.items) {
            return Err(DraftError::TargetDraftedTwice {
                target: owner.item(entry.index, item),
                first,
                second,
            });
        }
    } // End of the loop over this mapping's drafted entries
    Ok(())
} // End of function check_open_mapping_is_drafted_once()

/// The first index two entries of `indices` share, with both their positions.
///
/// Stated over **every** entry rather than only over the ones carrying an
/// intent, because a container's index is an address the caller asserts (see
/// [`plan_match_edits`]'s note): writing the same address twice is a draft that
/// says two things about one entry whatever it then says about it.
fn repeated_index(indices: &[usize]) -> Option<(usize, usize, usize)> {
    for (first, index) in indices.iter().enumerate() {
        let found = indices
            .iter()
            .enumerate()
            .skip(first + 1)
            .find(|(_, other)| *other == index);
        if let Some((second, _)) = found {
            return Some((*index, first, second));
        }
    } // End of the loop over every pair of drafted indices
    None
} // End of function repeated_index()

/// The first index two **non-`Unchanged`** elements of `items` share, with both
/// their positions.
///
/// [`DraftField::Unchanged`] is not an intent and is skipped: a list carrying
/// `Unchanged` twice at one index asks for nothing twice.
fn repeated_item_index(items: &[ItemDraft]) -> Option<(usize, usize, usize)> {
    for (first, item) in items.iter().enumerate() {
        if item.value.is_unchanged() {
            continue;
        }
        let found = items
            .iter()
            .enumerate()
            .skip(first + 1)
            .find(|(_, other)| !other.value.is_unchanged() && other.index == item.index);
        if let Some((second, _)) = found {
            return Some((item.index, first, second));
        }
    } // End of the loop over this list's drafted elements
    None
} // End of function repeated_item_index()

/// Refuses a draft that describes one open entry's value twice.
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason: an entry's value is one node,
/// and an [`EntryDraft`] saying both *this scalar* and *these elements* asks two
/// questions of it. Either intent alone may derive nothing — a `Set` to the
/// value already there does — so a check after diffing would see one of them and
/// call the draft coherent.
fn check_no_entry_drafts_two_shapes(draft: &MatchDraft) -> Result<(), DraftError> {
    for variable in &draft.vars {
        let owner = OpenMapping::Params {
            variable: variable.index,
        };
        check_no_entry_of_one_mapping_drafts_two_shapes(&variable.params, owner)?;
    } // End of the loop over the drafted variables
    for field in &draft.form_fields {
        let owner = OpenMapping::FormField { field: field.index };
        check_no_entry_of_one_mapping_drafts_two_shapes(&field.options, owner)?;
    } // End of the loop over the drafted form fields
    Ok(())
} // End of function check_no_entry_drafts_two_shapes()

/// The same check over one open mapping's drafted entries.
fn check_no_entry_of_one_mapping_drafts_two_shapes(
    drafts: &[EntryDraft],
    owner: OpenMapping,
) -> Result<(), DraftError> {
    for entry in drafts {
        let drafts_the_items = entry.items.iter().any(|item| !item.value.is_unchanged());
        if !entry.value.is_unchanged() && drafts_the_items {
            return Err(DraftError::EntryDraftsAScalarAndASequence {
                target: owner.entry(entry.index),
            });
        }
    } // End of the loop over this mapping's drafted entries
    Ok(())
} // End of function check_no_entry_of_one_mapping_drafts_two_shapes()

/// Plans one schema-known scalar field, appending to `edits` or `insertions`.
///
/// Insertions are collected rather than emitted because they all share one
/// anchor, which cannot be chosen until every removal of the batch is known.
fn plan_field(
    view: &MatchView,
    draft: &MatchDraft,
    path: &DocumentPath,
    field: MatchField,
    edits: &mut Vec<DocumentEdit>,
    insertions: &mut Vec<(MatchField, String)>,
) -> Result<(), DraftError> {
    let drafted = draft.field(field);
    if drafted.is_unchanged() {
        return Ok(());
    }
    let existing = scalar_of(view, field);
    if existing.is_none() {
        // A key the file has but the projection did not model reads as `None`
        // here, exactly as an absent one does. Treating it as absent would
        // derive an insertion of a key the mapping already holds.
        //
        // The two refusals are two different decisions and are named
        // separately. A `Set` is not expressible: nothing replaces a collection
        // node with a scalar one. A `Remove` *is* expressible — a field removal
        // deletes the whole subtree — and is refused anyway, because those bytes
        // were never on a screen.
        if let Some(found) = unmodelled_shape(view, field) {
            return Err(if drafted.is_remove() {
                DraftError::RemovalWouldDiscardUnshownStructure { field, found }
            } else {
                DraftError::FieldHasAnUnmodelledShape { field, found }
            });
        }
    }
    match (drafted, existing) {
        (DraftField::Unchanged, _) => {}
        (DraftField::Remove, None) => {}
        (DraftField::Remove, Some(_)) => {
            edits.push(FieldRemoval::new(path.clone().with_key(field.key())).into());
        }
        (DraftField::Set(value), None) => insertions.push((field, value.clone())),
        (DraftField::Set(value), Some(scalar)) => {
            let target = DraftTarget::Field(field);
            if let Some(edit) =
                plan_scalar(scalar, value, path.clone().with_key(field.key()), target)?
            {
                edits.push(edit);
            }
        }
    } // End of the match over what the draft says about this field
    Ok(())
} // End of function plan_field()

/// Plans every drafted element of one string sequence.
fn plan_sequence(
    view: &MatchView,
    draft: &MatchDraft,
    path: &DocumentPath,
    sequence: SequenceField,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let items = items_of(view, sequence);
    for item in draft.items(sequence) {
        let index = item.index;
        let value = match &item.value {
            DraftField::Unchanged => continue,
            DraftField::Remove => {
                return Err(DraftError::SequenceItemRemoval {
                    field: sequence,
                    index,
                })
            }
            DraftField::Set(value) => value,
        };
        let existing = items
            .get(index)
            .ok_or(DraftError::SequenceItemDoesNotExist {
                field: sequence,
                index,
                length: items.len(),
            })?;
        let target = DraftTarget::Item {
            field: sequence,
            index,
        };
        let scalar = existing
            .as_scalar()
            .ok_or(DraftError::NotAScalar { target })?;
        let at = path.clone().with_key(sequence.key()).with_index(index);
        if let Some(edit) = plan_scalar(scalar, value, at, target)? {
            edits.push(edit);
        }
    } // End of the loop over the drafted elements of this sequence
    Ok(())
} // End of function plan_sequence()

/// Which open mapping a nested draft is about, so one planner can serve both.
///
/// It exists to name a [`DraftTarget`] and nothing else: `params` and a form
/// field's option mapping are the same shape — a mapping whose keys espanso does
/// not fix, holding scalars and sequences of scalars — so they are planned by
/// one function and told apart only where a refusal has to say which it was.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpenMapping {
    /// One variable's `params`.
    Params {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// One `form_fields` entry's own option mapping.
    FormField {
        /// The form field's index in the projected `form_fields` list.
        field: usize,
    },
}

impl OpenMapping {
    /// The address of one entry of this mapping.
    fn entry(self, entry: usize) -> DraftTarget {
        match self {
            OpenMapping::Params { variable } => DraftTarget::Param { variable, entry },
            OpenMapping::FormField { field } => DraftTarget::FormFieldOption {
                field,
                option: entry,
            },
        }
    }

    /// The address of one element of one entry's sequence.
    fn item(self, entry: usize, item: usize) -> DraftTarget {
        match self {
            OpenMapping::Params { variable } => DraftTarget::ParamItem {
                variable,
                entry,
                item,
            },
            OpenMapping::FormField { field } => DraftTarget::FormFieldOptionItem {
                field,
                option: entry,
                item,
            },
        }
    } // End of function item() for OpenMapping
} // End of impl OpenMapping

/// Plans every drafted variable of `vars`.
///
/// The path each variable's edits hang off is the **projection's own**
/// ([`crate::model::VariableView::path`]), not one this function composes from
/// the match path: the projection is what told the caller the variable was at
/// that index, so it is what should say where the index points.
/// [`check_closed_surface`] reads the derived batch back and refuses anything
/// the two disagree about.
fn plan_vars(
    view: &MatchView,
    draft: &MatchDraft,
    edits: &mut Vec<DocumentEdit>,
    nested: &mut Vec<NestedKeys>,
) -> Result<(), DraftError> {
    for drafted in &draft.vars {
        let index = drafted.index;
        let variable = view.vars.get(index).ok_or(DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index },
            length: view.vars.len(),
        })?;
        let at = variable
            .path
            .clone()
            .ok_or(DraftError::VariableHasNoPath { index })?;
        for field in VariableField::ALL {
            plan_variable_scalar(variable, drafted, &at, field, edits)?;
        } // End of the loop over the variable's schema-known scalars
        if drafted.params.is_empty() {
            continue;
        }
        let params = at.with_key(PARAMS_KEY);
        let owner = OpenMapping::Params { variable: index };
        plan_open_mapping(&variable.params, &drafted.params, &params, owner, edits)?;
        nested.push(NestedKeys::new(params, nameable_keys(&variable.params)));
    } // End of the loop over the drafted variables
    Ok(())
} // End of function plan_vars()

/// Plans one of a variable's three schema-known scalars.
///
/// **An absent one is refused, never inserted** (D1). The projection reports
/// `None` both for a key that is not there and for one holding a shape the
/// schema does not use, and neither can be honoured: this phase adds no entry
/// below the match mapping, and no primitive replaces a collection node with a
/// scalar one.
fn plan_variable_scalar(
    variable: &crate::model::VariableView,
    drafted: &VariableDraft,
    at: &DocumentPath,
    field: VariableField,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let intent = drafted.field(field);
    if intent.is_unchanged() {
        return Ok(());
    }
    let existing = match field {
        VariableField::Name => variable.name.as_ref(),
        VariableField::Type => variable.declared_type.as_ref(),
        VariableField::InjectVars => variable.inject_vars.as_ref(),
    };
    let Some(scalar) = existing else {
        return Err(DraftError::VariableFieldHasNoScalar {
            variable: drafted.index,
            field,
        });
    };
    let target = DraftTarget::VariableScalar {
        variable: drafted.index,
        field,
    };
    let field_path = at.clone().with_key(field.key());
    match intent {
        DraftField::Unchanged => {}
        DraftField::Remove => edits.push(FieldRemoval::new(field_path).into()),
        DraftField::Set(value) => {
            if let Some(edit) = plan_scalar(scalar, value, field_path, target)? {
                edits.push(edit);
            }
        }
    } // End of the match over what the draft says about this field
    Ok(())
} // End of function plan_variable_scalar()

/// Plans every drafted entry of `form_fields`.
fn plan_form_fields(
    view: &MatchView,
    draft: &MatchDraft,
    path: &DocumentPath,
    edits: &mut Vec<DocumentEdit>,
    nested: &mut Vec<NestedKeys>,
) -> Result<(), DraftError> {
    for drafted in &draft.form_fields {
        let index = drafted.index;
        let target = DraftTarget::FormField { index };
        let field = view
            .form_fields
            .get(index)
            .ok_or(DraftError::TargetDoesNotExist {
                target,
                length: view.form_fields.len(),
            })?;
        if drafted.options.is_empty() {
            continue;
        }
        let key = nameable_key(&view.form_fields, index, target)?;
        let at = path.clone().with_key(FORM_FIELDS_KEY).with_key(key);
        // A form field whose value is not a mapping has no options, so every
        // drafted one is refused by `plan_open_mapping` as an entry that is not
        // there — the same answer, arrived at once.
        let options = field.value.as_mapping().unwrap_or_default();
        let owner = OpenMapping::FormField { field: index };
        plan_open_mapping(options, &drafted.options, &at, owner, edits)?;
        nested.push(NestedKeys::new(at, nameable_keys(options)));
    } // End of the loop over the drafted form fields
    Ok(())
} // End of function plan_form_fields()

/// Plans every drafted entry of one open mapping.
///
/// The one function `params` and a form field's options both go through, so the
/// answers this surface gives to an open key are stated once.
fn plan_open_mapping(
    fields: &[FieldView],
    drafts: &[EntryDraft],
    mapping: &DocumentPath,
    owner: OpenMapping,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    for drafted in drafts {
        let entry = drafted.index;
        let target = owner.entry(entry);
        let field = fields.get(entry).ok_or(DraftError::TargetDoesNotExist {
            target,
            length: fields.len(),
        })?;
        let at = mapping
            .clone()
            .with_key(nameable_key(fields, entry, target)?);
        plan_entry_value(field, &drafted.value, &at, target, edits)?;
        plan_entry_items(field, drafted, &at, owner, edits)?;
    } // End of the loop over this mapping's drafted entries
    Ok(())
} // End of function plan_open_mapping()

/// Plans one open entry's scalar value.
fn plan_entry_value(
    field: &FieldView,
    intent: &DraftField<String>,
    at: &DocumentPath,
    target: DraftTarget,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    match (intent, field.value.as_scalar()) {
        (DraftField::Unchanged, _) => {}
        (DraftField::Remove, Some(_)) => edits.push(FieldRemoval::new(at.clone()).into()),
        (DraftField::Remove, None) => {
            return Err(DraftError::NestedRemovalWouldDiscardUnshownStructure {
                target,
                found: kind_of(&field.value),
            })
        }
        (DraftField::Set(value), Some(scalar)) => {
            if let Some(edit) = plan_scalar(scalar, value, at.clone(), target)? {
                edits.push(edit);
            }
        }
        (DraftField::Set(_), None) => {
            return Err(DraftError::NestedValueIsACollection {
                target,
                found: kind_of(&field.value),
            })
        }
    } // End of the match over what the draft says about this entry's value
    Ok(())
} // End of function plan_entry_value()

/// Plans every drafted element of one open entry's sequence value.
///
/// A value that is not a sequence has **no** elements, so a drafted one is
/// refused as an element that is not there rather than as a shape mismatch: the
/// draft named element `i` of a list of zero, which is what
/// [`DraftError::TargetDoesNotExist`] says.
fn plan_entry_items(
    field: &FieldView,
    drafted: &EntryDraft,
    at: &DocumentPath,
    owner: OpenMapping,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let items = field.value.as_sequence().unwrap_or_default();
    for item in &drafted.items {
        let target = owner.item(drafted.index, item.index);
        let value = match &item.value {
            DraftField::Unchanged => continue,
            DraftField::Remove => return Err(DraftError::NestedItemRemoval { target }),
            DraftField::Set(value) => value,
        };
        let existing = items
            .get(item.index)
            .ok_or(DraftError::TargetDoesNotExist {
                target,
                length: items.len(),
            })?;
        let scalar = existing
            .as_scalar()
            .ok_or(DraftError::NotAScalar { target })?;
        if let Some(edit) = plan_scalar(scalar, value, at.clone().with_index(item.index), target)? {
            edits.push(edit);
        }
    } // End of the loop over this entry's drafted elements
    Ok(())
} // End of function plan_entry_items()

/// The decoded key text of one entry of an open mapping, or a refusal.
///
/// Three things stop an entry being nameable, and all three are refusals rather
/// than approximations:
///
/// - the key is **not a scalar** — an alias, or a collection used as a key — so
///   [`crate::patch::PathSegment::Key`] can never match it;
/// - the key **did not decode**, so its projected text is a raw source slice
///   rather than the value the resolver compares against;
/// - **another entry of the same mapping carries the same key**, so
///   `crate::patch::path::resolve` would take the first one and the caller would
///   believe it had addressed the other.
///
/// The third is checked over the **whole** mapping and not over the entries the
/// draft happens to name: a duplicate the draft never mentions still makes the
/// path of the one it does mention ambiguous.
fn nameable_key(
    fields: &[FieldView],
    index: usize,
    target: DraftTarget,
) -> Result<&str, DraftError> {
    let key = fields
        .get(index)
        .and_then(|field| field.key.as_ref())
        .filter(|key| key.decoded)
        .ok_or(DraftError::TargetIsNotNameable { target })?;
    for (other, candidate) in fields.iter().enumerate() {
        if other == index {
            continue;
        }
        let shares_the_key = candidate
            .key
            .as_ref()
            .is_some_and(|held| held.decoded && held.text == key.text);
        if shares_the_key {
            return Err(DraftError::TargetKeyIsAmbiguous { target, other });
        }
    } // End of the loop over the mapping's other entries
    Ok(&key.text)
} // End of function nameable_key()

/// Every key of an open mapping a path segment could name, in source order and
/// **with repetitions**.
///
/// The whole mapping, not the part a batch touches — that is the point of it,
/// and [`check_batch_independence`]'s check 3 rests on it. An entry whose key is
/// not a scalar or did not decode contributes nothing, because no path segment
/// could ever collide with it.
fn nameable_keys(fields: &[FieldView]) -> Vec<String> {
    fields
        .iter()
        .filter_map(|field| field.key.as_ref())
        .filter(|key| key.decoded)
        .map(|key| key.text.clone())
        .collect()
} // End of function nameable_keys()

/// What kind of node a projected value is.
fn kind_of(value: &ValueView) -> ValueKind {
    match value {
        ValueView::Scalar(_) => ValueKind::Scalar,
        ValueView::Sequence(_) => ValueKind::Sequence,
        ValueView::Mapping(_) => ValueKind::Mapping,
        ValueView::Alias(_) => ValueKind::Alias,
        ValueView::Elided { kind, .. } => *kind,
    }
} // End of function kind_of()

/// One existing scalar against one drafted logical value.
///
/// `Ok(None)` is the interesting answer: the field already decodes to exactly
/// what the draft asks for, so the file keeps its own spelling and no byte of it
/// is touched.
fn plan_scalar(
    scalar: &ScalarView,
    value: &str,
    at: DocumentPath,
    target: DraftTarget,
) -> Result<Option<DocumentEdit>, DraftError> {
    if !scalar.decoded {
        // `text` is the raw source slice here, not a logical value, so the one
        // comparison this module is allowed to make cannot be made.
        return Err(DraftError::NotDecodable { target });
    }
    if scalar.text == value {
        return Ok(None);
    }
    if scalar.span.start == scalar.span.end {
        return Err(DraftError::TargetOwnsNoBytes { target });
    }
    Ok(Some(ScalarEdit::new(at, value.to_owned()).into()))
} // End of function plan_scalar()

/// One entry of the match's mapping that this planner can see.
///
/// "Can see" is a real limit and a deliberate one: `vars` and `form_fields` are
/// modelled as their own projections and carry no key span, so a match whose
/// last entry is one of those two is anchored *before* it. That changes where a
/// new key lands and nothing else — the entry itself is never named, never
/// moved and never rewritten.
struct VisibleEntry {
    /// The entry's decoded key, or `None` for a key no path segment can name.
    key: Option<String>,
    /// Where it sits, for ordering only.
    at: usize,
}

/// Every entry of the match's mapping this planner can see, in source order.
///
/// Ordered by byte offset rather than by declaration order, because the source
/// is the only thing that knows which entry is last. Modelled fields contribute
/// their **value** span and unknown entries their **key** span; the two mix
/// safely because a mapping's entries are disjoint and sequential, so both
/// offsets fall inside the same entry's own extent.
///
/// # A sequence is seen only through its first element
///
/// `triggers: []` is a present, addressable entry that contributes **nothing**
/// here, because a sequence's only offset in [`crate::model::MatchView`] is its
/// first element's and an empty sequence has none. A match whose entries are all
/// empty sequences therefore gives an insertion no anchor and is refused with
/// [`DraftError::NoInsertionAnchor`] — a real limit, pinned by
/// `an_empty_sequence_is_invisible_as_an_insertion_anchor` rather than assumed.
///
/// It is not fixable here. An empty `Vec<ValueView>` cannot say whether the key
/// was absent or present and empty, so the span this function would need is one
/// the read model does not carry; `docs/decisions/2b-2b-1-notes.md` addresses
/// that hole to [`crate::model::MatchView`]'s owner.
fn visible_entries(view: &MatchView) -> Vec<VisibleEntry> {
    let mut entries: Vec<VisibleEntry> = Vec::new();
    for field in MatchField::ALL {
        if let Some(scalar) = scalar_of(view, field) {
            entries.push(VisibleEntry {
                key: Some(field.key().to_owned()),
                at: scalar.span.start,
            });
        }
    } // End of the loop over the schema-known scalar fields
    for sequence in SequenceField::ALL {
        if let Some(first) = items_of(view, sequence).first() {
            entries.push(VisibleEntry {
                key: Some(sequence.key().to_owned()),
                at: first.span().start,
            });
        }
    } // End of the loop over the schema-known string sequences
    for unknown in &view.unknown_entries {
        entries.push(VisibleEntry {
            key: unknown.key.clone(),
            at: unknown.key_span.start,
        });
    } // End of the loop over the entries the projection did not model
    entries.sort_by_key(|entry| entry.at);
    entries
} // End of function visible_entries()

/// The key of the last visible entry that a path segment can name.
fn last_nameable_key(entries: &[VisibleEntry]) -> Option<&str> {
    entries.iter().rev().find_map(|entry| entry.key.as_deref())
}

/// Every visible key, in source order and with repetitions.
fn original_keys(entries: &[VisibleEntry]) -> Vec<String> {
    entries
        .iter()
        .filter_map(|entry| entry.key.clone())
        .collect()
}

/// The existing scalar of one schema-known field, or `None` when the projection
/// holds none.
///
/// `None` means either *the key is absent* or *the key is present with a shape
/// the schema does not use*; [`unmodelled_shape`] is what tells the two apart.
fn scalar_of(view: &MatchView, field: MatchField) -> Option<&ScalarView> {
    match field {
        MatchField::Trigger => view.trigger.trigger.as_ref(),
        MatchField::Regex => view.trigger.regex.as_ref(),
        MatchField::Replace => view.content.replace.as_ref(),
        MatchField::Markdown => view.content.markdown.as_ref(),
        MatchField::Html => view.content.html.as_ref(),
        MatchField::ImagePath => view.content.image_path.as_ref(),
        MatchField::Form => view.content.form.as_ref(),
        MatchField::Label => view.label.as_ref(),
        MatchField::Comment => view.comment.as_ref(),
        MatchField::Word => view.options.word.as_ref(),
        MatchField::LeftWord => view.options.left_word.as_ref(),
        MatchField::RightWord => view.options.right_word.as_ref(),
        MatchField::PropagateCase => view.options.propagate_case.as_ref(),
        MatchField::UppercaseStyle => view.options.uppercase_style.as_ref(),
        MatchField::ForceMode => view.options.force_mode.as_ref(),
        MatchField::ForceClipboard => view.options.force_clipboard.as_ref(),
        MatchField::Paragraph => view.options.paragraph.as_ref(),
        MatchField::Anchor => view.options.anchor.as_ref(),
    }
} // End of function scalar_of()

/// The projected elements of one string sequence.
fn items_of(view: &MatchView, sequence: SequenceField) -> &[ValueView] {
    match sequence {
        SequenceField::Triggers => &view.trigger.triggers,
        SequenceField::SearchTerms => &view.search_terms,
    }
}

/// What a schema-known key holds when the projection refused to model it.
///
/// `None` when the key is genuinely absent from the mapping.
fn unmodelled_shape(view: &MatchView, field: MatchField) -> Option<crate::model::ValueKind> {
    view.unknown_entries
        .iter()
        .find(|entry| entry.key.as_deref() == Some(field.key()))
        .map(|entry| entry.value_kind)
}
