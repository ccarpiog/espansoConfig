//! Planning one form's field **definitions** (Phase 4-6): the shorthand
//! `form_fields` of a match and the verbose `params.fields` of a form variable,
//! through one set of functions, so the two shapes are written by the same rules
//! and never into each other.
//!
//! [`FormAt`] is one form's definitions resolved against the projection; the
//! caller builds it for the shape it was asked about, and nothing here chooses
//! the other one. Every refusal names positions — a [`FormOwner`], an index, a
//! [`DraftTarget`] — and never a name, a key or a value (`CLAUDE.md` §1).

use crate::draft::audit::NestedKeys;
use crate::draft::author_key::{author_key_fault, TYPED_SETTINGS};
use crate::draft::bulk::is_plain_source;
use crate::draft::error::DraftError;
use crate::draft::field::DraftField;
use crate::draft::form_definition::{
    definitions, FormFieldIntent, FormOptions, FormOwner, FormValuesIntent, NewFormField,
    FIELDS_KEY, FORM_OPTION_KEYS, OPTION_MULTILINE_KEY, OPTION_TRIM_KEY, OPTION_VALUES_KEY,
};
use crate::draft::match_draft::{
    DraftTarget, EntryDraft, FormFieldDraft, FORM_FIELDS_KEY, PARAMS_KEY,
};
use crate::draft::new_variable::VariableSetting;
use crate::draft::plan::{
    is_a_scalar_list, key_fault_refusal, kind_of, nameable_key, nameable_keys, plan_open_mapping,
    plan_plain_source_scalar, OpenMapping,
};
use crate::draft::sequence::ListPlacement;
use crate::model::{
    FieldView, FormFieldShape, MappingPresence, MatchView, ValueKind, ValueView, VariableKind,
    VariableView,
};
use crate::patch::{
    DocumentEdit, DocumentPath, FieldInsertGroup, FieldRemoval, ItemFields, ItemPlacement,
    RemoveItem, ScalarItemInsert,
};

/// One form's definitions, resolved against the projection.
pub(super) struct FormAt<'view> {
    /// Which form.
    owner: FormOwner,
    /// Whether the definitions mapping is written, and in what shape.
    presence: MappingPresence,
    /// The projected definitions, in source order. Empty unless `presence` is a
    /// mapping with entries.
    fields: &'view [FieldView],
    /// One shape per definition, parallel to `fields`.
    shapes: &'view [FormFieldShape],
    /// The path of the definitions mapping itself — `<match>.form_fields` or
    /// `<match>.vars[i].params.fields`.
    path: DocumentPath,
}

impl<'view> FormAt<'view> {
    /// The match's own shorthand `form_fields`.
    pub(super) fn shorthand(view: &'view MatchView, path: &DocumentPath) -> FormAt<'view> {
        FormAt {
            owner: FormOwner::Shorthand {},
            presence: view.form_fields_presence.clone(),
            fields: &view.form_fields,
            shapes: &view.form_field_shapes,
            path: path.clone().with_key(FORM_FIELDS_KEY),
        }
    } // End of function shorthand()

    /// The verbose `params.fields` of the variable at `index`, whose own path is
    /// `at`, or a refusal when the variable is not a form, or when the `fields`
    /// entry of its `params` cannot be named.
    pub(super) fn verbose(
        variable: &'view VariableView,
        index: usize,
        at: &DocumentPath,
    ) -> Result<FormAt<'view>, DraftError> {
        let presence = match (&variable.kind, &variable.fields_presence) {
            (VariableKind::Form, Some(presence)) => presence.clone(),
            _ => return Err(DraftError::VariableIsNotAForm { variable: index }),
        };
        let params = at.clone().with_key(PARAMS_KEY);
        let entry = variable.params.iter().position(|field| {
            field
                .key
                .as_ref()
                .is_some_and(|key| key.decoded && key.text == FIELDS_KEY)
        });
        // The entry's key must name one node: a repeated `fields:` makes the
        // path ambiguous whichever occurrence the projection describes.
        let fields: &'view [FieldView] = match entry {
            Some(entry) => {
                nameable_key(
                    &variable.params,
                    entry,
                    DraftTarget::Param {
                        variable: index,
                        entry,
                    },
                )?;
                variable.params[entry]
                    .value
                    .as_mapping()
                    .unwrap_or_default()
            }
            None => &[],
        };
        Ok(FormAt {
            owner: FormOwner::Variable { variable: index },
            presence,
            fields,
            shapes: &variable.field_shapes,
            path: params.with_key(FIELDS_KEY),
        })
    } // End of function verbose()

    /// The address of one existing definition.
    fn definition(&self, field: usize) -> DraftTarget {
        match self.owner {
            FormOwner::Variable { variable } => DraftTarget::VariableFormField { variable, field },
            _ => DraftTarget::FormField { index: field },
        }
    }

    /// The open mapping one existing definition's options are.
    fn options_of(&self, field: usize) -> OpenMapping {
        match self.owner {
            FormOwner::Variable { variable } => OpenMapping::VariableFormField { variable, field },
            _ => OpenMapping::FormField { field },
        }
    }

    /// The address of one new definition.
    fn new_field(&self, field: usize) -> DraftTarget {
        DraftTarget::NewFormField {
            form: self.owner,
            field,
        }
    }
} // End of impl FormAt

/// Whether a definition draft changes the definition's **structure** — adds or
/// removes an option, or adds or removes a `values` item — so that its last byte
/// may move and it cannot anchor a new definition written after it.
fn changes_structure(draft: &FormFieldDraft) -> bool {
    !draft.insert_options.is_empty()
        || !draft.values.is_empty()
        || draft
            .options
            .iter()
            .any(|option| option.value == DraftField::Remove)
}

/// Refuses a form's intents that contradict each other or the definition drafts
/// beside them, and a new definition whose own description breaks a rule no type
/// can force (Phase 4-6).
///
/// **Intent level, before any diffing.** In order:
///
/// 1. `RemoveFields` is the form's only intent, and no definition is drafted
///    beside it ([`DraftError::FormIntentsConflict`]);
/// 2. one definition is removed at most once, and a removed definition is not
///    also drafted;
/// 3. an insertion written after a named definition does not name one the draft
///    removes, one whose successor it removes (the two would start at one byte)
///    or one whose structure it changes (the two would end at one byte);
/// 4. every new definition's name meets ruling 7 and repeats neither an existing
///    definition's decoded name — whether or not the draft removes it — nor an
///    earlier new one's; an existing name that did not decode cannot be compared
///    and refuses ([`DraftError::NewKeyCannotBeCompared`]);
/// 5. every new definition's options meet [`check_new_options`].
pub(super) fn check_form_intents(
    form: &FormAt<'_>,
    intents: &[FormFieldIntent],
    drafts: &[FormFieldDraft],
) -> Result<(), DraftError> {
    let conflict = |intent: usize| DraftError::FormIntentsConflict {
        form: form.owner,
        intent,
    };
    let removed = |index: usize| {
        intents
            .iter()
            .any(|intent| matches!(intent, FormFieldIntent::RemoveField { index: held } if *held == index))
    };
    let mut names: Vec<(usize, &str)> = Vec::new();
    for (position, intent) in intents.iter().enumerate() {
        let before = &intents[..position];
        match intent {
            FormFieldIntent::RemoveFields {} => {
                if intents.len() > 1 || !drafts.is_empty() {
                    return Err(conflict(position));
                }
            }
            FormFieldIntent::RemoveField { index } => {
                let twice = before.iter().any(|earlier| {
                    matches!(earlier, FormFieldIntent::RemoveField { index: held } if held == index)
                });
                let drafted = drafts.iter().any(|draft| draft.index == *index);
                if twice || drafted {
                    return Err(conflict(position));
                }
            }
            FormFieldIntent::InsertField { after, field } => {
                if let Some(anchor) = after {
                    let reshaped = drafts
                        .iter()
                        .any(|draft| draft.index == *anchor && changes_structure(draft));
                    // `checked_add`: an index off the wire may be `usize::MAX`.
                    let successor = anchor.checked_add(1).is_some_and(removed);
                    if removed(*anchor) || successor || reshaped {
                        return Err(conflict(position));
                    }
                }
                let target = form.new_field(position);
                check_new_field_name(form.fields, field, target, &names)?;
                names.push((position, field.name.as_str()));
                check_new_options(&field.options, target, |option| {
                    DraftTarget::NewFormFieldOption {
                        form: form.owner,
                        field: position,
                        option,
                    }
                })?;
            }
        } // End of the match over what this intent does
    } // End of the loop over the form's intents
    Ok(())
} // End of function check_form_intents()

/// Rule 4 of [`check_form_intents`] for one new definition's name, against the
/// existing definitions `existing` and the earlier new ones in `seen` (position,
/// name). Shared with a new variable's definitions, which have no existing ones.
pub(super) fn check_new_field_name(
    existing: &[FieldView],
    field: &NewFormField,
    target: DraftTarget,
    seen: &[(usize, &str)],
) -> Result<(), DraftError> {
    if let Some(fault) = author_key_fault(&field.name) {
        return Err(key_fault_refusal(fault, target));
    }
    for (entry, held) in existing.iter().enumerate() {
        let Some(key) = held.key.as_ref().filter(|key| key.decoded) else {
            return Err(DraftError::NewKeyCannotBeCompared { target, entry });
        };
        if key.text == field.name {
            return Err(DraftError::NewKeyDuplicatesAnEntry { target, entry });
        }
    } // End of the loop over the existing definitions
    if let Some((first, _)) = seen.iter().find(|(_, name)| *name == field.name) {
        return Err(DraftError::NewKeyDuplicatesAnInsertion {
            target,
            first: *first,
        });
    }
    Ok(())
} // End of function check_new_field_name()

/// Refuses options whose description breaks a rule no type can force (Phase
/// 4-6): every typed setting (`multiline`, `trim_string_values`) is plain source
/// ([`DraftError::NewFormOptionNotPlainSource`], ruling 4); the extras are at most
/// [`FormOptions::MAX_EXTRA_OPTIONS`]; and each extra key meets ruling 7, names
/// none of ruling 4's typed settings and none of the five schema-known options,
/// and is not repeated among the extras. `target` names the definition, and
/// `option` names one extra by its position.
pub(super) fn check_new_options(
    options: &FormOptions,
    target: DraftTarget,
    option: impl Fn(usize) -> DraftTarget,
) -> Result<(), DraftError> {
    for (setting, text) in options.settings() {
        if !is_plain_source(text) {
            return Err(DraftError::NewFormOptionNotPlainSource { target, setting });
        }
    } // End of the loop over the typed settings
    if options.extra.len() > FormOptions::MAX_EXTRA_OPTIONS {
        return Err(DraftError::NewFormFieldHasTooManyOptions {
            target,
            limit: FormOptions::MAX_EXTRA_OPTIONS,
        });
    }
    for (position, extra) in options.extra.iter().enumerate() {
        let target = option(position);
        if let Some(fault) = author_key_fault(&extra.key) {
            return Err(key_fault_refusal(fault, target));
        }
        if TYPED_SETTINGS.contains(&extra.key.as_str()) {
            return Err(DraftError::NewKeyIsATypedSetting { target });
        }
        if FORM_OPTION_KEYS.contains(&extra.key.as_str()) {
            return Err(DraftError::NewKeyIsAFormOption { target });
        }
        let earlier = options.extra[..position]
            .iter()
            .position(|held| held.key == extra.key);
        if let Some(first) = earlier {
            return Err(DraftError::NewKeyDuplicatesAnInsertion { target, first });
        }
    } // End of the loop over the extra options
    Ok(())
} // End of function check_new_options()

/// What planning one form produced beyond its edits.
pub(super) struct PlannedForm {
    /// The definitions of a form that holds none yet — the whole `form_fields:`
    /// or `fields:` entry, for the caller to write in its own mapping's group.
    pub(super) created: Option<ItemFields>,
    /// Whether the whole definitions entry is removed.
    pub(super) removes_all: bool,
}

/// Plans everything a draft says about one form's definitions (Phase 4-6),
/// appending to `edits` and recording every nested mapping it reaches in
/// `nested`.
///
/// | Draft | Edit |
/// |---|---|
/// | [`FormFieldIntent::InsertField`], definitions present | one [`FieldInsertGroup`] of mapping-valued entries per landing, in intent order |
/// | [`FormFieldIntent::InsertField`], no definitions | nothing here: [`PlannedForm::created`] for the caller's group |
/// | [`FormFieldIntent::RemoveField`] | one [`FieldRemoval`] of the definition |
/// | [`FormFieldIntent::RemoveFields`] | one [`FieldRemoval`] of the whole entry; nothing when absent |
/// | [`FormFieldDraft::options`] | a [`crate::patch::ScalarEdit`] or a [`FieldRemoval`] per option, as before |
/// | [`FormFieldDraft::insert_options`] | one [`FieldInsertGroup`] into the definition |
/// | [`FormFieldDraft::values`] | one [`ScalarItemInsert`] or [`RemoveItem`] per intent |
///
/// Refused by name: a definitions entry that is not a mapping, a flow mapping a
/// definition would be written into or taken out of, a definition holding a
/// collection the editor never showed, the last definition, the last option and
/// the last `values` item removed without an explicit container removal, and a
/// `values` written as text asked for items.
pub(super) fn plan_form(
    form: &FormAt<'_>,
    intents: &[FormFieldIntent],
    drafts: &[FormFieldDraft],
    edits: &mut Vec<DocumentEdit>,
    nested: &mut Vec<NestedKeys>,
) -> Result<PlannedForm, DraftError> {
    let mut planned = PlannedForm {
        created: None,
        removes_all: false,
    };
    if intents.is_empty() && drafts.is_empty() {
        return Ok(planned);
    }
    let length = form.fields.len();
    let missing = |index: usize| DraftError::TargetDoesNotExist {
        target: form.definition(index),
        length,
    };
    let new_fields: Vec<&NewFormField> = intents
        .iter()
        .filter_map(|intent| match intent {
            FormFieldIntent::InsertField { field, .. } => Some(field),
            _ => None,
        })
        .collect();
    match &form.presence {
        MappingPresence::Absent {} => {
            for intent in intents {
                match intent {
                    FormFieldIntent::RemoveField { index }
                    | FormFieldIntent::InsertField {
                        after: Some(index), ..
                    } => return Err(missing(*index)),
                    FormFieldIntent::InsertField { after: None, .. }
                    | FormFieldIntent::RemoveFields {} => {}
                }
            } // End of the loop over the intents of a form with no definitions
            if let Some(draft) = drafts.first() {
                return Err(missing(draft.index));
            }
            let fields: Vec<NewFormField> = new_fields.into_iter().cloned().collect();
            planned.created = (!fields.is_empty()).then(|| definitions(&fields));
            return Ok(planned);
        }
        MappingPresence::UnsupportedShape { found, .. } => {
            return Err(DraftError::FormFieldsHasAnUnsupportedShape {
                form: form.owner,
                found: *found,
            })
        }
        MappingPresence::Empty { .. } | MappingPresence::Entries { .. } => {}
    } // End of the match over the shape of the definitions entry

    if intents
        .iter()
        .any(|intent| matches!(intent, FormFieldIntent::RemoveFields {}))
    {
        // `check_form_intents` has made it the form's only intent.
        edits.push(FieldRemoval::new(form.path.clone()).into());
        planned.removes_all = true;
        return Ok(planned);
    }
    for draft in drafts {
        plan_definition(form, draft, edits, nested)?;
    } // End of the loop over the drafted definitions
    let changes_cardinality = intents.iter().any(|intent| {
        matches!(
            intent,
            FormFieldIntent::InsertField { .. } | FormFieldIntent::RemoveField { .. }
        )
    });
    if !changes_cardinality {
        return Ok(planned);
    }
    if form.presence.is_flow() {
        return Err(DraftError::FormFieldsIsAFlowMapping { form: form.owner });
    }
    plan_cardinality(form, intents, drafts, edits)?;
    nested.push(NestedKeys::new(
        form.path.clone(),
        nameable_keys(form.fields),
    ));
    Ok(planned)
} // End of function plan_form()

/// Plans the definitions a form's intents add and remove, in a block mapping with
/// entries (Phase 4-6).
fn plan_cardinality(
    form: &FormAt<'_>,
    intents: &[FormFieldIntent],
    drafts: &[FormFieldDraft],
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let length = form.fields.len();
    let missing = |index: usize| DraftError::TargetDoesNotExist {
        target: form.definition(index),
        length,
    };
    let removed = |index: usize| {
        intents
            .iter()
            .any(|intent| matches!(intent, FormFieldIntent::RemoveField { index: held } if *held == index))
    };
    let reshaped = |index: usize| {
        drafts
            .iter()
            .any(|draft| draft.index == index && changes_structure(draft))
    };
    // The definition a run of new ones is written after when none is named: the
    // last that survives, whose successor survives, and whose own end does not
    // move — the three offsets would otherwise coincide.
    let default_anchor = (0..length)
        .rev()
        .find(|&index| !removed(index) && !removed(index + 1) && !reshaped(index));
    let mut runs: Vec<(usize, Vec<(String, ItemFields)>)> = Vec::new();
    let mut removals = 0usize;
    for intent in intents {
        match intent {
            FormFieldIntent::RemoveField { index } => {
                let target = form.definition(*index);
                let field = form.fields.get(*index).ok_or(missing(*index))?;
                let key = nameable_key(form.fields, *index, target)?;
                check_definition_is_shown(field, target)?;
                edits.push(FieldRemoval::new(form.path.clone().with_key(key)).into());
                removals += 1;
            }
            FormFieldIntent::InsertField { after, field } => {
                let anchor = match after {
                    Some(index) if *index >= length => return Err(missing(*index)),
                    Some(index) => *index,
                    None => default_anchor
                        .ok_or(DraftError::NoFormFieldInsertionAnchor { form: form.owner })?,
                };
                let definition = vec![field.definition()];
                match runs.iter_mut().find(|(held, _)| *held == anchor) {
                    Some((_, run)) => run.extend(definition),
                    None => runs.push((anchor, definition)),
                }
            }
            FormFieldIntent::RemoveFields {} => {}
        } // End of the match over what the intent asks for
    } // End of the loop over the form's intents
    if removals > 0 && removals >= length {
        return Err(DraftError::FormFieldsWouldBeEmpty { form: form.owner });
    }
    for (anchor, run) in runs {
        let sibling = nameable_key(form.fields, anchor, form.definition(anchor))?.to_owned();
        let group = FieldInsertGroup::of_mappings(form.path.clone(), Some(sibling), run)
            .ok_or(DraftError::NoFormFieldInsertionAnchor { form: form.owner })?;
        edits.push(group.into());
    } // End of the loop over the runs of new definitions
    Ok(())
} // End of function plan_cardinality()

/// Refuses the removal of a definition that holds structure the editor never
/// showed: a definition may go when its value is a scalar (an empty value
/// included) or a mapping whose every key is a scalar and every value a scalar or
/// a flat list of scalars — which is everything a definition-row editor draws.
fn check_definition_is_shown(field: &FieldView, target: DraftTarget) -> Result<(), DraftError> {
    let shown = match &field.value {
        ValueView::Scalar(_) => true,
        ValueView::Mapping(options) => options.iter().all(|option| {
            option.key.is_some()
                && (option.value.as_scalar().is_some() || is_a_scalar_list(&option.value))
        }),
        _ => false,
    };
    if !shown {
        let found = match &field.value {
            ValueView::Mapping(_) => ValueKind::Mapping,
            other => kind_of(other),
        };
        return Err(DraftError::NestedRemovalWouldDiscardUnshownStructure { target, found });
    }
    Ok(())
} // End of function check_definition_is_shown()

/// Plans one drafted definition: its existing options, its new options and its
/// `values` items (Phase 4-6).
fn plan_definition(
    form: &FormAt<'_>,
    draft: &FormFieldDraft,
    edits: &mut Vec<DocumentEdit>,
    nested: &mut Vec<NestedKeys>,
) -> Result<(), DraftError> {
    let index = draft.index;
    let target = form.definition(index);
    let field = form
        .fields
        .get(index)
        .ok_or(DraftError::TargetDoesNotExist {
            target,
            length: form.fields.len(),
        })?;
    if draft.options.is_empty() && draft.insert_options.is_empty() && draft.values.is_empty() {
        return Ok(());
    }
    let key = nameable_key(form.fields, index, target)?;
    let at = form.path.clone().with_key(key);
    // A definition whose value is not a mapping has no options, so every drafted
    // one is refused by `plan_open_mapping` as an entry that is not there.
    let options = field.value.as_mapping().unwrap_or_default();
    let owner = form.options_of(index);
    let drafted = plan_typed_settings(options, &draft.options, &at, owner, edits)?;
    plan_open_mapping(options, &drafted, &at, owner, edits)?;
    let removed = |option: usize| {
        draft
            .options
            .iter()
            .any(|held| held.index == option && held.value == DraftField::Remove)
    };
    let removals = (0..options.len()).filter(|&option| removed(option)).count();
    if removals > 0 && removals == options.len() {
        return Err(DraftError::FormFieldWouldHaveNoOptions { target });
    }
    let values = plan_values(form, draft, options, &at, edits)?;
    plan_new_options(form, draft, options, &at, values, edits)?;
    nested.push(NestedKeys::new(at, nameable_keys(options)));
    Ok(())
} // End of function plan_definition()

/// Plans every `Set` of an existing `multiline` or `trim_string_values` option as
/// **plain source** (ruling 4; the Phase 4-6 review's first finding), and hands
/// back the option drafts with those `Set`s taken out, for
/// [`plan_open_mapping`] to plan the rest by the logical-string rule.
///
/// The drafted text is validated **before** any comparison
/// ([`DraftError::NewFormOptionNotPlainSource`], naming the option by position),
/// and the comparison is `plan_plain_source_scalar`'s: nothing when the option is
/// already written as exactly that plain text, otherwise one
/// [`crate::patch::ScalarEdit::plain_source`] — so `'true'` becomes `true`, and
/// `true` never becomes `'false'`. An option whose value is not a scalar, and an
/// option the draft addresses that does not exist, are left for
/// [`plan_open_mapping`] to refuse as before.
fn plan_typed_settings(
    options: &[FieldView],
    drafts: &[EntryDraft],
    at: &DocumentPath,
    owner: OpenMapping,
    edits: &mut Vec<DocumentEdit>,
) -> Result<Vec<EntryDraft>, DraftError> {
    let mut rest = Vec::with_capacity(drafts.len());
    for drafted in drafts {
        let DraftField::Set(text) = &drafted.value else {
            rest.push(drafted.clone());
            continue;
        };
        let option = options.get(drafted.index);
        let setting = option
            .and_then(|option| option.key.as_ref())
            .filter(|key| key.decoded)
            .and_then(|key| match key.text.as_str() {
                OPTION_MULTILINE_KEY => Some(VariableSetting::Multiline),
                OPTION_TRIM_KEY => Some(VariableSetting::TrimStringValues),
                _ => None,
            });
        let (Some(setting), Some(ValueView::Scalar(scalar))) =
            (setting, option.map(|option| &option.value))
        else {
            rest.push(drafted.clone());
            continue;
        };
        let target = owner.entry(drafted.index);
        if !is_plain_source(text) {
            return Err(DraftError::NewFormOptionNotPlainSource { target, setting });
        }
        let path = at
            .clone()
            .with_key(nameable_key(options, drafted.index, target)?);
        if let Some(edit) = plan_plain_source_scalar(scalar, text, path, target)? {
            edits.push(edit);
        }
        // The `Set` is planned; the entry stays an address with no scalar intent,
        // so its items (none, for a scalar) and its resolution are unchanged.
        rest.push(EntryDraft {
            value: DraftField::Unchanged,
            ..drafted.clone()
        });
    } // End of the loop over the drafted options
    Ok(rest)
} // End of function plan_typed_settings()

/// Plans one definition's new options as one [`FieldInsertGroup`] after the last
/// option the draft leaves in place (Phase 4-6). `values` is the index of the
/// `values` option when the draft changes its items, which then anchors nothing:
/// an item appended to it and an option written after it land at one byte.
fn plan_new_options(
    form: &FormAt<'_>,
    draft: &FormFieldDraft,
    options: &[FieldView],
    at: &DocumentPath,
    values: Option<usize>,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let new = &draft.insert_options;
    if new.is_empty() {
        return Ok(());
    }
    let index = draft.index;
    let target = form.definition(index);
    check_new_options(new, target, |option| DraftTarget::NewFormOption {
        form: form.owner,
        field: index,
        option,
    })?;
    let shape = form.shapes.get(index).map(|shape| &shape.options);
    if !shape.is_some_and(MappingPresence::is_block_with_entries) {
        let found = match shape {
            Some(MappingPresence::UnsupportedShape { found, .. }) => *found,
            _ => ValueKind::Mapping,
        };
        return Err(DraftError::FormFieldOptionsAreNotABlockMapping { target, found });
    }
    for key in new.keys() {
        for (entry, held) in options.iter().enumerate() {
            let Some(existing) = held.key.as_ref().filter(|existing| existing.decoded) else {
                return Err(DraftError::NewKeyCannotBeCompared { target, entry });
            };
            if existing.text == key {
                return Err(DraftError::NewKeyDuplicatesAnEntry { target, entry });
            }
        } // End of the loop over the existing options
    } // End of the loop over the new options' keys
    let removed = |option: usize| {
        draft
            .options
            .iter()
            .any(|held| held.index == option && held.value == DraftField::Remove)
    };
    let anchor = (0..options.len())
        .rev()
        .find(|&option| !removed(option) && !removed(option + 1) && values != Some(option))
        .ok_or(DraftError::NoFormOptionInsertionAnchor { target })?;
    let sibling = nameable_key(options, anchor, form.options_of(index).entry(anchor))?.to_owned();
    if let Some(group) = FieldInsertGroup::typed(at.clone(), Some(sibling), new.entries()) {
        edits.push(group.into());
    }
    Ok(())
} // End of function plan_new_options()

/// Plans one definition's `values` item intents (Phase 4-6), and answers the
/// index of the `values` option when there are any.
///
/// The `values` option must exist ([`DraftError::FormValuesAbsent`]) and be a
/// list ([`DraftError::FormValuesIsNotAList`] — a multi-line string stays text).
/// A flow list of strings takes and loses strings between its brackets (Phase
/// 3-3's engine), never converting. Contradictions are
/// [`DraftError::FormValuesIntentsConflict`]; removing every item is
/// [`DraftError::FormValuesWouldBeEmpty`].
fn plan_values(
    form: &FormAt<'_>,
    draft: &FormFieldDraft,
    options: &[FieldView],
    at: &DocumentPath,
    edits: &mut Vec<DocumentEdit>,
) -> Result<Option<usize>, DraftError> {
    if draft.values.is_empty() {
        return Ok(None);
    }
    let index = draft.index;
    let owner = form.options_of(index);
    let entry = options
        .iter()
        .position(|option| {
            option
                .key
                .as_ref()
                .is_some_and(|key| key.decoded && key.text == OPTION_VALUES_KEY)
        })
        .ok_or(DraftError::FormValuesAbsent {
            target: form.definition(index),
        })?;
    let target = owner.entry(entry);
    let key = nameable_key(options, entry, target)?;
    let items = match &options[entry].value {
        ValueView::Sequence(items) => items,
        other => {
            return Err(DraftError::FormValuesIsNotAList {
                target,
                found: kind_of(other),
            })
        }
    };
    let path = at.clone().with_key(key);
    let length = items.len();
    let conflict = DraftError::FormValuesIntentsConflict { target };
    let drafted = draft.options.iter().find(|option| option.index == entry);
    if drafted.is_some_and(|option| !option.value.is_unchanged()) {
        return Err(conflict);
    }
    let rewritten = |item: usize| {
        drafted.is_some_and(|option| {
            option
                .items
                .iter()
                .any(|held| held.index == item && !held.value.is_unchanged())
        })
    };
    let landing = |at: &ListPlacement| ItemPlacement::from(*at).items_above(length);
    let mut removals = 0usize;
    for (position, intent) in draft.values.iter().enumerate() {
        let before = &draft.values[..position];
        match intent {
            FormValuesIntent::InsertItems {
                at: placement,
                items: new,
            } => {
                if let ListPlacement::After { index: after } = placement {
                    if *after >= length {
                        return Err(DraftError::TargetDoesNotExist {
                            target: owner.item(entry, *after),
                            length,
                        });
                    }
                }
                let lands = landing(placement);
                let shares = before.iter().any(|earlier| {
                    matches!(earlier, FormValuesIntent::InsertItems { at: other, .. }
                        if landing(other) == lands)
                });
                let on_a_removal = lands.is_some_and(|lands| {
                    draft.values.iter().any(|other| {
                        matches!(other, FormValuesIntent::RemoveItem { index } if *index == lands)
                    })
                });
                if shares || on_a_removal {
                    return Err(conflict);
                }
                let insert = ScalarItemInsert::new(
                    path.clone(),
                    ItemPlacement::from(*placement),
                    new.to_vec(),
                )
                .ok_or(conflict.clone())?;
                edits.push(insert.into());
            }
            FormValuesIntent::RemoveItem { index: item } => {
                let twice = before.iter().any(|earlier| {
                    matches!(earlier, FormValuesIntent::RemoveItem { index } if index == item)
                });
                if twice || rewritten(*item) {
                    return Err(conflict);
                }
                let item_target = owner.item(entry, *item);
                let existing = items.get(*item).ok_or(DraftError::TargetDoesNotExist {
                    target: item_target,
                    length,
                })?;
                if existing.as_scalar().is_none() {
                    return Err(DraftError::NotAScalar {
                        target: item_target,
                    });
                }
                edits.push(RemoveItem::new(path.clone().with_index(*item)).into());
                removals += 1;
            }
        } // End of the match over what the intent asks for
    } // End of the loop over the definition's `values` intents
    if removals > 0 && removals >= length {
        return Err(DraftError::FormValuesWouldBeEmpty { target });
    }
    Ok(Some(entry))
} // End of function plan_values()
