//! From a draft to the smallest batch that realises it.

use crate::draft::audit::{check_batch_independence, check_closed_surface, NestedKeys};
use crate::draft::author_key::{author_key_fault, AuthorKeyFault, TYPED_SETTINGS};
use crate::draft::bulk::is_plain_source;
use crate::draft::error::DraftError;
use crate::draft::field::DraftField;
use crate::draft::form_definition::{FormOwner, FIELDS_KEY};
use crate::draft::form_plan::{
    check_form_intents, check_new_field_name, check_new_options, plan_form, FormAt,
};
use crate::draft::match_draft::{
    DraftTarget, EntryDraft, FieldSubstitution, ItemDraft, MatchDraft, MatchField, NewParamValue,
    SequenceField, VariableDraft, VariableField, FORM_FIELDS_KEY, PARAMS_KEY, VARS_KEY,
};
use crate::draft::new_variable::{NewVariable, VariableSetting, VarsIntent};
use crate::draft::sequence::{ListPlacement, MatchStructure, SequenceIntent, TriggerSwitch};
use crate::draft::variable_list::{
    ChoiceRecordField, NewListItems, VariableList, VariableListIntent, ID_KEY, LABEL_KEY,
};
use crate::model::{
    FieldView, MappingPresence, MatchView, ScalarView, SequencePresence, UnknownReason, ValueKind,
    ValueView, VariableView,
};
use crate::patch::{
    DocumentEdit, DocumentPath, EntryValue, FieldInsert, FieldInsertGroup, FieldRemoval,
    InsertItem, ItemFields, ItemMove, ItemPlacement, ItemValue, KeySubstitution, RemoveItem,
    ScalarEdit, ScalarItemInsert, ShapeSwitch,
};

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
/// | absent | `Set` | one insertion |
///
/// and the two it gives to a `Remove`: one [`FieldRemoval`] when the field is
/// there, and **nothing** when it is not, because the desired state is already
/// the actual state.
///
/// # The eight plain-source options compare source, not decoded text (Phase 4-1)
///
/// [`MatchField::PLAIN_SOURCE_OPTIONS`] — `word`, `left_word`, `right_word`,
/// `propagate_case`, `uppercase_style`, `force_mode`, `force_clipboard`,
/// `paragraph` — are the one exception to the rule above, because what a person
/// types into their controls is the **source text** the file should hold (D2u;
/// `docs/decisions/4-split-notes.md` §3 ruling 2). A `Set` of one of them is
/// written verbatim as a plain scalar ([`ScalarEdit::plain_source`], or an
/// [`EntryValue::PlainSource`] insertion), and it derives **nothing** only when
/// the field is already that plain scalar, byte for byte. So `word: 'true'`
/// drafted as `Set("true")` is rewritten to `word: true`, exactly as the bulk
/// edit does, while [`DraftField::Unchanged`] leaves `'true'` alone. A drafted
/// text that cannot be written as one plain scalar
/// ([`crate::draft::is_plain_source`]) is refused as
/// [`DraftError::OptionNotPlainSource`] at intent level, before any diffing.
/// `anchor` stays a logical string under the rule above.
///
/// # Every insertion of one draft is one edit (Phase 3-1)
///
/// Every absent field a draft sets is written after **one anchor**: the last
/// entry of the match mapping this planner can name that the batch neither
/// removes nor renames — so the anchor survives the batch by construction. One
/// such field becomes a [`FieldInsert`]; two or more become **one**
/// [`FieldInsertGroup`], in [`MatchField::ALL`] order, which is the only order
/// this module has. Two insertions sharing an anchor used to be refused
/// ([`DraftError::SharedInsertionAnchor`]); a group states its order, so a draft
/// that adds two absent options now saves in one batch.
///
/// **The third row of that table is the match mapping's alone.** Below it —
/// inside a variable, a `params` mapping or a `form_fields` entry — an absent
/// target is *refused*, never inserted (2b-2b-2's decision D1, and
/// [`DraftError::TargetDoesNotExist`] is where it is written down). The equality
/// rule itself is unchanged and is applied by the same [`plan_scalar`] at every
/// depth: **there is one comparison in this module and there will not be a
/// second.**
///
/// # The one insertion below the match mapping (Phase 4-3)
///
/// [`VariableDraft::insert_params`] is not a drafted *address* but an explicit
/// request for new **author-named** `params` entries, and it is the one lift of
/// D1 (ruling 7 of `docs/decisions/4-split-notes.md` §3). The key is decoded text
/// the engine spells in key context; it is refused, by position and never by
/// text, when it is empty, holds a line break or another control character, is
/// `<<`, or decodes to the same text as an existing entry (however quoted) or an
/// earlier insertion of the same draft. The variable's `params` must already be a
/// block mapping with entries ([`crate::model::MappingPresence`]), and the new
/// entries are one [`FieldInsertGroup`] written after the last entry the draft
/// leaves in place. A `Remove` of a `params` entry whose value is a flat list of
/// scalars is lifted in the same step — the list was shown in full — and a draft
/// that would leave `params:` with no entry is refused rather than turned into a
/// null ([`DraftError::ParamsWouldBeEmpty`], ruling 8).
///
/// # A variable's lists (Phase 4-5)
///
/// [`VariableDraft::lists`], [`VariableDraft::depends_on`] and
/// [`VariableDraft::records`] add, remove and rewrite items of an existing
/// variable's `depends_on`, `values`, `choices` and `args` — strings, and flat
/// `{label, id}` records in a `choice`'s `values`. They are planned per drafted
/// variable, after its scalars, by `plan_variable_lists`; their contradictions
/// are refused at intent level beside step 5's
/// ([`DraftError::VariableListIntentsConflict`]).
///
/// # Form field definitions (Phase 4-6)
///
/// [`MatchDraft::form_intents`] and [`MatchDraft::form_fields`] draft the
/// shorthand `form_fields`; [`VariableDraft::field_intents`] and
/// [`VariableDraft::fields`] draft a verbose form's `params.fields`. Both go
/// through the same functions (`crate::draft::form_plan`), so the two shapes
/// meet the same rules and neither is ever written into the other. Their
/// contradictions and every new definition's own description are refused at
/// intent level ([`DraftError::FormIntentsConflict`] and the key and option
/// refusals); a form with no definitions receives the whole entry as a
/// mapping-valued entry of the group of the mapping that holds it.
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
/// 5. no drafted entry says both "this scalar" and "these elements", and no
///    substitution contradicts another intent of the draft
///    ([`plan_match_edits_with_substitutions`]); a drafted
///    [`MatchDraft::content_switch`] is one more substitution here, since Phase
///    3-5-1, so `plan_match_edits` alone plans a switch of content kind; and,
///    since Phase 4-1, every `Set` of a plain-source option is plain source
///    ([`DraftError::OptionNotPlainSource`]); and, since Phase 4-3, every new
///    author-named key meets ruling 7's text rules and no two new keys of one
///    variable decode alike ([`check_new_keys_are_admissible`]);
/// 6. every drafted field is planned, in [`MatchField::ALL`] order, then every
///    drafted sequence element, then every drafted variable (a verbose form's
///    definitions among its parts), then the shorthand form's definitions, each
///    in the draft's own order, and last the absent fields — a new `vars:` or
///    `form_fields:` among them — as one insertion after a surviving anchor;
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
    plan_match_edits_with_substitutions(view, draft, &[])
} // End of function plan_match_edits()

/// [`plan_match_edits`], plus closed scalar-to-scalar **substitutions**
/// (Phase 3-1).
///
/// Each [`FieldSubstitution`] renames one key of the match mapping to another
/// form of the same family, **in place**, through one
/// [`crate::patch::KeySubstitution`]: the first entry of a compact
/// `- trigger: …` item changes form without its `-` moving, which a removal plus
/// an insertion cannot do. Every other rule of [`plan_match_edits`] applies
/// unchanged, in the same order, and a draft with no substitution derives
/// exactly the batch [`plan_match_edits`] derives.
///
/// # What the draft may say about the two keys
///
/// - the **source** key carries no intent of its own — it is being renamed;
/// - the **destination** key may be `Set`, and that value is the renamed entry's
///   new value. `Unchanged`, or a `Set` to the value the source already decodes
///   to, keeps the value's bytes exactly as written. A `Remove` contradicts the
///   substitution;
/// - no key is named by two substitutions.
///
/// Each of those is refused as [`DraftError::SubstitutionConflictsWithField`],
/// at intent level and before any diffing.
///
/// # What the match must hold
///
/// The source key, as a scalar ([`DraftError::SubstitutionSourceAbsent`] when it
/// is absent — the intent is stale — and
/// [`DraftError::FieldHasAnUnmodelledShape`] when it holds a collection), and
/// **not** the destination key ([`DraftError::SubstitutionTargetPresent`]).
///
/// # Errors
///
/// See [`DraftError`]. Every refusal discards the whole batch.
pub fn plan_match_edits_with_substitutions(
    view: &MatchView,
    draft: &MatchDraft,
    substitutions: &[FieldSubstitution],
) -> Result<Vec<DocumentEdit>, DraftError> {
    let structure = MatchStructure {
        substitutions: substitutions.to_vec(),
        ..MatchStructure::default()
    };
    plan_match_edits_with(view, draft, &structure)
} // End of function plan_match_edits_with_substitutions()

/// [`plan_match_edits_with_substitutions`], plus the **list intents** and the
/// **trigger switch** of Phase 3-2.
///
/// A [`MatchStructure`] carries three kinds of intent beside the draft: the 3-1
/// substitutions, [`SequenceIntent`]s about `triggers` and `search_terms`, and at
/// most one [`TriggerSwitch`]. Every rule of [`plan_match_edits`] applies
/// unchanged and in the same order; a default structure derives exactly the batch
/// [`plan_match_edits`] derives.
///
/// # What each list intent becomes
///
/// | Intent | Edit |
/// |---|---|
/// | [`SequenceIntent::InsertItems`] | one [`ScalarItemInsert`] into the existing list, block or flow |
/// | [`SequenceIntent::RemoveItem`] | one [`RemoveItem`], which takes the item's own comments with it |
/// | [`SequenceIntent::InsertField`] | a list entry of the one insertion group ([`EntryValue::ScalarList`]) |
/// | [`SequenceIntent::RemoveField`] | one [`FieldRemoval`] of the whole field |
/// | [`TriggerSwitch`] | one [`ShapeSwitch`] |
///
/// # What is refused, and in which order
///
/// First, **at intent level and before any diffing**, anything two intents say
/// about one list ([`DraftError::SequenceIntentsConflict`]), and a switch whose
/// scalar key or whose list carries another intent
/// ([`DraftError::SubstitutionConflictsWithField`],
/// [`DraftError::SequenceIntentsConflict`]). Then, per intent, the list's
/// presence: an absent list ([`DraftError::SequenceFieldAbsent`]), a present one
/// being added ([`DraftError::SequenceFieldPresent`]), a value that is not a list
/// ([`DraftError::SequenceHasAnUnsupportedShape`]) and a flow list a switch
/// would reshape ([`DraftError::SequenceIsAFlowList`]); then the items: an index
/// the list does not have ([`DraftError::SequenceItemDoesNotExist`]), an item
/// that is not a scalar ([`DraftError::NotAScalar`], because removing it would
/// discard structure the list editor never showed), every item removed
/// ([`DraftError::SequenceWouldBeEmpty`]) and a switch that would drop items
/// ([`DraftError::SwitchWouldDiscardItems`]).
///
/// # Errors
///
/// See [`DraftError`]. Every refusal discards the whole batch.
pub fn plan_match_edits_with(
    view: &MatchView,
    draft: &MatchDraft,
    structure: &MatchStructure,
) -> Result<Vec<DocumentEdit>, DraftError> {
    // A drafted content switch (Phase 3-5-1) is one more substitution beside the
    // structure's own, so every rule below — the source carries no other intent,
    // no key is named twice, the destination's value is its own field — applies
    // to it unchanged. A structure that already names the same substitution is
    // refused by `check_substitutions_are_coherent` as a key named twice.
    //
    // Since Phase 3-6-1 the draft's own trigger-form change and list intents are
    // merged the same way: a rename is one more substitution, a switch is the
    // structure's switch (a second one is two intents about `triggers`), and the
    // list intents are appended after the structure's own, so every coherence
    // rule below reads them together.
    let merged;
    let mut two_switches = false;
    let structure = if draft.content_switch.is_none()
        && draft.trigger_form.is_none()
        && draft.sequences.is_empty()
    {
        structure
    } else {
        let mut widened = structure.clone();
        if let Some(switch) = draft.content_switch {
            widened.substitutions.push(switch.substitution());
        }
        if let Some(change) = &draft.trigger_form {
            if let Some(substitution) = change.substitution() {
                widened.substitutions.push(substitution);
            }
            if let Some(switch) = change.switch() {
                two_switches = widened.switch.is_some();
                widened.switch = Some(switch.clone());
            }
        }
        widened.sequences.extend(draft.sequences.iter().cloned());
        merged = widened;
        &merged
    };
    let substitutions = structure.substitutions.as_slice();
    let path = editable_match_path(view)?;
    if two_switches {
        // The structure named a switch and the draft names another: two intents
        // about `triggers`, refused at intent level with the list's own code.
        return Err(DraftError::SequenceIntentsConflict {
            field: SequenceField::Triggers,
        });
    }
    check_no_index_is_drafted_twice(draft)?;
    check_no_entry_drafts_two_shapes(draft)?;
    check_substitutions_are_coherent(draft, substitutions)?;
    check_structure_is_coherent(view, draft, structure)?;
    check_options_are_plain_source(draft)?;
    check_new_keys_are_admissible(draft)?;
    check_vars_intents_are_coherent(view, draft)?;
    check_new_variables_are_admissible(view, draft)?;
    check_variable_lists_are_coherent(view, draft)?;
    let shorthand = FormAt::shorthand(view, path);
    check_form_intents(&shorthand, &draft.form_intents, &draft.form_fields)?;

    let entries = visible_entries(view);
    let mut edits: Vec<DocumentEdit> = Vec::new();
    let mut insertions: Vec<(Inserted, EntryValue)> = Vec::new();
    let mut nested: Vec<NestedKeys> = Vec::new();
    let switched = structure
        .switch
        .as_ref()
        .map(|switch| switch.form().field());
    for field in MatchField::ALL {
        let substituted = substitutions
            .iter()
            .any(|substitution| substitution.from() == field || substitution.to() == field);
        // The switch's scalar key is planned by `plan_switch`, once, as one edit;
        // `check_structure_is_coherent` has already refused a draft intent on it.
        if substituted || switched == Some(field) {
            // Both keys of a substitution are planned by `plan_substitution`,
            // once, as one edit: the source is renamed, and the destination's
            // drafted value is that renamed entry's new value.
            continue;
        }
        plan_field(view, draft, path, field, &mut edits, &mut insertions)?;
    } // End of the loop over the schema-known scalar fields
    for substitution in substitutions {
        plan_substitution(view, draft, path, *substitution, &mut edits)?;
    } // End of the loop over the drafted substitutions
    for sequence in SequenceField::ALL {
        plan_sequence(view, draft, path, sequence, &mut edits)?;
    } // End of the loop over the schema-known string sequences
    for intent in &structure.sequences {
        plan_sequence_intent(view, path, intent, &mut edits, &mut insertions)?;
    } // End of the loop over the drafted list intents
    check_no_list_is_emptied(view, &structure.sequences)?;
    if let Some(switch) = &structure.switch {
        plan_switch(view, path, switch, &mut edits)?;
    }
    plan_vars(view, draft, &mut edits, &mut nested)?;
    let new_vars = plan_vars_intents(view, draft, path, &mut edits)?;
    let new_form_fields = plan_form(
        &shorthand,
        &draft.form_intents,
        &draft.form_fields,
        &mut edits,
        &mut nested,
    )?
    .created;
    let created = Created {
        vars: new_vars,
        form_fields: new_form_fields,
    };
    plan_insertions(path, &entries, insertions, created, structure, &mut edits)?;

    check_closed_surface(path, &edits)?;
    check_batch_independence(path, &original_keys(&entries), &nested, &edits)?;
    Ok(edits)
} // End of function plan_match_edits_with()

/// The match's own path, when every question about the **match** — not about
/// any draft of it — allows editing it: it has a path, no key of its mapping is
/// written twice, and the hazard gate does not refuse it.
///
/// Steps 1 to 3 of [`plan_match_edits`], shared since Phase 4-4 with
/// [`plan_variable_move`] so the two planners cannot come to disagree about
/// which matches are editable.
fn editable_match_path(view: &MatchView) -> Result<&DocumentPath, DraftError> {
    let path = view.path.as_ref().ok_or(DraftError::MatchHasNoPath {})?;
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
    Ok(path)
} // End of function editable_match_path()

/// Derives the one move that reorders a match's local variables, or refuses it
/// by name (Phase 4-4).
///
/// # Alone in its batch, by construction (R25)
///
/// A reorder is **not** a draft intent. It has this planner of its own, and the
/// batch it returns holds **exactly one** [`crate::patch::ItemMove`] — so a
/// caller that wants to reorder and also edit must make two saves, which is
/// `PROGRESS.md` R25 and ruling 10 of `docs/decisions/4-split-notes.md` §3. A
/// batch that puts this move beside any other edit is refused by the engine as
/// [`crate::patch::EditError::MoveMustBeTheOnlyEditInItsBatch`]; that refusal is
/// the engine's, stated over every [`DocumentEdit`] category, and this planner
/// adds nothing that could weaken it.
///
/// # What it checks, in order
///
/// 1. the match is editable ([`editable_match_path`]: a path, no repeated key,
///    the hazard gate);
/// 2. `vars` is an existing **block** list: absent is
///    [`DraftError::TargetDoesNotExist`], flow (`[]` included) is
///    [`DraftError::VarsIsAFlowList`], anything else
///    [`DraftError::VarsHasAnUnsupportedShape`] (D2r: same sequence only, and
///    never a converted one);
/// 3. the variable and the destination exist
///    ([`DraftError::TargetDoesNotExist`], naming the variable or the anchor);
/// 4. the move changes something ([`DraftError::VariableMoveChangesNothing`]).
///
/// `to` is the wire's [`ListPlacement`]: `Front` writes the variable above the
/// first, `After { index }` after the variable at that index in the
/// **original** list, and `End` after the last. The engine derives every byte:
/// the moved item's owned runs travel verbatim, with the comments it owns, and a
/// comment the file owns stays where it is.
///
/// # Errors
///
/// See [`DraftError`]. The derived batch is checked by
/// [`crate::draft::check_variable_move`] before it is returned.
pub fn plan_variable_move(
    view: &MatchView,
    variable: usize,
    to: ListPlacement,
) -> Result<Vec<DocumentEdit>, DraftError> {
    let path = editable_match_path(view)?;
    let length = view.vars.len();
    let missing = |index: usize| DraftError::TargetDoesNotExist {
        target: DraftTarget::Variable { index },
        length,
    };
    require_block_vars(&view.vars_presence, || missing(variable))?;
    let item = view.vars.get(variable).ok_or(missing(variable))?;
    let at = item
        .path
        .clone()
        .ok_or(DraftError::VariableHasNoPath { index: variable })?;
    let movement = match to {
        ListPlacement::Front {} => ItemMove::to_front(at),
        ListPlacement::After { index } if index >= length => return Err(missing(index)),
        ListPlacement::After { index } => ItemMove::after(at, index),
        ListPlacement::End {} => ItemMove::after(at, length.saturating_sub(1)),
    };
    if movement.resulting_index(variable) == variable {
        return Err(DraftError::VariableMoveChangesNothing { variable });
    }
    let edits = vec![DocumentEdit::from(movement)];
    crate::draft::audit::check_variable_move(path, &edits)?;
    Ok(edits)
} // End of function plan_variable_move()

/// Refuses a `vars` that is not an existing **block** list (Phase 4-4).
///
/// `absent` builds the refusal for a match with no `vars`, which depends on what
/// was asked for; every other answer is fixed: a flow list, `[]` included, is
/// [`DraftError::VarsIsAFlowList`] and a value that is not a list is
/// [`DraftError::VarsHasAnUnsupportedShape`].
fn require_block_vars(
    presence: &SequencePresence,
    absent: impl FnOnce() -> DraftError,
) -> Result<(), DraftError> {
    match presence {
        SequencePresence::Absent {} => Err(absent()),
        SequencePresence::UnsupportedShape { found, .. } => {
            Err(DraftError::VarsHasAnUnsupportedShape { found: *found })
        }
        SequencePresence::Empty { .. } | SequencePresence::Items { flow: true, .. } => {
            Err(DraftError::VarsIsAFlowList {})
        }
        SequencePresence::Items { flow: false, .. } => Ok(()),
    }
} // End of function require_block_vars()

/// Refuses `vars` intents that contradict each other or another intent of the
/// draft (Phase 4-4).
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason. It reads the view for one fact
/// only — how many variables `vars` holds — so that two insertions landing at
/// one place are recognised however they were spelled (`After(last)` and `End`
/// are one place, and in a match with no `vars` so are `Front` and `End`).
///
/// The rules, each a [`DraftError::VarsIntentsConflict`] naming the intent at
/// which the conflict is found:
///
/// 1. [`VarsIntent::RemoveVars`] is the only `vars` intent, and no variable of
///    the match is drafted beside it;
/// 2. one variable is removed at most once, and a removed variable is not also
///    drafted ([`MatchDraft::vars`]);
/// 3. two new variables do not land at one place — so a match with no `vars`
///    receives at most one new variable per draft;
/// 4. a new variable does not land exactly where the same draft removes one —
///    the insertion point and the removal's first byte would coincide, and the
///    engine refuses two replacements that share a start.
fn check_vars_intents_are_coherent(view: &MatchView, draft: &MatchDraft) -> Result<(), DraftError> {
    let intents = &draft.var_intents;
    let length = view.vars.len();
    let landing = |at: &ListPlacement| ItemPlacement::from(*at).items_above(length);
    for (position, intent) in intents.iter().enumerate() {
        let conflict = DraftError::VarsIntentsConflict { intent: position };
        let before = &intents[..position];
        match intent {
            VarsIntent::RemoveVars {} => {
                if intents.len() > 1 || !draft.vars.is_empty() {
                    return Err(conflict);
                }
            }
            VarsIntent::RemoveVariable { index } => {
                let removed_twice = before.iter().any(|earlier| {
                    matches!(earlier, VarsIntent::RemoveVariable { index: held } if held == index)
                });
                let drafted = draft.vars.iter().any(|variable| variable.index == *index);
                if removed_twice || drafted {
                    return Err(conflict);
                }
            }
            VarsIntent::InsertVariable { at, .. } => {
                let lands = landing(at);
                let shares_a_landing = before.iter().any(|earlier| {
                    matches!(earlier, VarsIntent::InsertVariable { at: other, .. }
                        if landing(other) == lands)
                });
                let lands_on_a_removal = lands.is_some_and(|lands| {
                    intents.iter().any(|other| {
                        matches!(other, VarsIntent::RemoveVariable { index } if *index == lands)
                    })
                });
                if shares_a_landing || lands_on_a_removal {
                    return Err(conflict);
                }
            }
        } // End of the match over what this intent does
    } // End of the loop over the drafted `vars` intents
    Ok(())
} // End of function check_vars_intents_are_coherent()

/// Refuses a new variable whose own description breaks a rule no type can force
/// (Phase 4-4).
///
/// **Intent level, and before any diffing.** Every refusal names the new
/// variable by its position in `var_intents` ([`DraftTarget::NewVariable`]) or
/// an extra parameter by its position in that variable's list
/// ([`DraftTarget::NewVariableParam`]), never a name, a key or a value
/// (`CLAUDE.md` §1). In order, per new variable:
///
/// 1. the **name** is not empty and is one line
///    ([`DraftError::NewVariableNameIsEmpty`],
///    [`DraftError::NewVariableNameIsNotOneLine`]);
/// 2. the name repeats no existing variable's **decoded** name — an existing
///    name that did not decode cannot be compared and refuses — and no earlier
///    new variable's;
/// 3. every **typed setting** (`inject_vars`, `offset`, `trim`, `debug`) is
///    plain source ([`DraftError::NewVariableSettingNotPlainSource`], ruling 4);
/// 4. the **extra parameters** are at most [`NewVariable::MAX_EXTRA_PARAMS`], and
///    each key meets ruling 7, names none of ruling 4's typed settings, is not a
///    key the kind itself owns ([`DraftError::NewKeyIsAKindParameter`]) and is
///    not repeated among the extras.
fn check_new_variables_are_admissible(
    view: &MatchView,
    draft: &MatchDraft,
) -> Result<(), DraftError> {
    let mut seen: Vec<(usize, &str)> = Vec::new();
    for (insertion, intent) in draft.var_intents.iter().enumerate() {
        let VarsIntent::InsertVariable { variable, .. } = intent else {
            continue;
        };
        let target = DraftTarget::NewVariable { insertion };
        check_new_variable_name(view, variable, target, &seen)?;
        seen.push((insertion, variable.name.as_str()));
        for (setting, text) in variable.settings() {
            if !is_plain_source(text) {
                return Err(DraftError::NewVariableSettingNotPlainSource { target, setting });
            }
        } // End of the loop over the new variable's typed settings
        if variable.extra_params.len() > NewVariable::MAX_EXTRA_PARAMS {
            return Err(DraftError::NewVariableHasTooManyParams {
                target,
                limit: NewVariable::MAX_EXTRA_PARAMS,
            });
        }
        for (param, extra) in variable.extra_params.iter().enumerate() {
            let target = DraftTarget::NewVariableParam { insertion, param };
            if let Some(fault) = author_key_fault(&extra.key) {
                return Err(key_fault_refusal(fault, target));
            }
            if TYPED_SETTINGS.contains(&extra.key.as_str()) {
                return Err(DraftError::NewKeyIsATypedSetting { target });
            }
            if variable.params.owned_keys().contains(&extra.key.as_str()) {
                return Err(DraftError::NewKeyIsAKindParameter { target });
            }
            let earlier = variable.extra_params[..param]
                .iter()
                .position(|held| held.key == extra.key);
            if let Some(first) = earlier {
                return Err(DraftError::NewKeyDuplicatesAnInsertion { target, first });
            }
        } // End of the loop over the new variable's extra parameters
          // A new verbose form's definitions (Phase 4-6): the rules an insertion
          // into an existing form meets, against no existing definition.
        let form = FormOwner::NewVariable { insertion };
        let mut names: Vec<(usize, &str)> = Vec::new();
        for (field, definition) in variable.form_fields().iter().enumerate() {
            let target = DraftTarget::NewFormField { form, field };
            check_new_field_name(&[], definition, target, &names)?;
            names.push((field, definition.name.as_str()));
            check_new_options(&definition.options, target, |option| {
                DraftTarget::NewFormFieldOption {
                    form,
                    field,
                    option,
                }
            })?;
        } // End of the loop over the new variable's definitions
    } // End of the loop over the drafted new variables
    Ok(())
} // End of function check_new_variables_are_admissible()

/// Rules 1 and 2 of [`check_new_variables_are_admissible`] for one new
/// variable's name, against the existing variables and the earlier new ones in
/// `seen` (position in `var_intents`, name).
fn check_new_variable_name(
    view: &MatchView,
    variable: &NewVariable,
    target: DraftTarget,
    seen: &[(usize, &str)],
) -> Result<(), DraftError> {
    match author_key_fault(&variable.name) {
        Some(AuthorKeyFault::Empty) => return Err(DraftError::NewVariableNameIsEmpty { target }),
        Some(AuthorKeyFault::LineBreak | AuthorKeyFault::ControlCharacter) => {
            return Err(DraftError::NewVariableNameIsNotOneLine { target })
        }
        // `<<` is a key rule; as a value, a name may be any one-line text.
        Some(AuthorKeyFault::MergeKey) | None => {}
    }
    for (index, existing) in view.vars.iter().enumerate() {
        let Some(name) = &existing.name else {
            continue;
        };
        if !name.decoded {
            return Err(DraftError::NewVariableNameCannotBeCompared {
                target,
                variable: index,
            });
        }
        if name.text == variable.name {
            return Err(DraftError::NewVariableNameDuplicatesAVariable {
                target,
                variable: index,
            });
        }
    } // End of the loop over the existing variables
    if let Some((first, _)) = seen.iter().find(|(_, name)| *name == variable.name) {
        return Err(DraftError::NewVariableNameDuplicatesAnInsertion {
            target,
            first: *first,
        });
    }
    Ok(())
} // End of function check_new_variable_name()

/// Plans every drafted `vars` intent (Phase 4-4), appending to `edits`, and
/// answers the fields of the one new variable that becomes a whole new `vars:`
/// subtree when the match has none — which [`plan_insertions`] writes as the
/// match-level group's trailing item list.
///
/// | Intent | `vars` is | Edit |
/// |---|---|---|
/// | [`VarsIntent::InsertVariable`] | a block list | one [`InsertItem`] at the placement |
/// | [`VarsIntent::InsertVariable`] | absent | the new `vars:` subtree (`Front`/`End` only) |
/// | [`VarsIntent::RemoveVariable`] | a block list | one [`RemoveItem`], which takes the variable's own comments with it |
/// | [`VarsIntent::RemoveVars`] | a list of either style | one [`FieldRemoval`] of the whole entry |
/// | [`VarsIntent::RemoveVars`] | absent | nothing |
///
/// A flow `vars` (`[]` included) is refused for an insertion or a removal of a
/// variable ([`DraftError::VarsIsAFlowList`]); a `vars` that is not a list is
/// refused for every intent ([`DraftError::VarsHasAnUnsupportedShape`]); and a
/// draft whose removals would take every variable away is
/// [`DraftError::VarsWouldBeEmpty`]. Each item path is the projection's own
/// ([`crate::model::VariableView::path`]), as [`plan_vars`]'s are.
fn plan_vars_intents(
    view: &MatchView,
    draft: &MatchDraft,
    path: &DocumentPath,
    edits: &mut Vec<DocumentEdit>,
) -> Result<Option<Vec<(String, ItemValue)>>, DraftError> {
    let vars = path.clone().with_key(VARS_KEY);
    let length = view.vars.len();
    let missing = |index: usize| DraftError::TargetDoesNotExist {
        target: DraftTarget::Variable { index },
        length,
    };
    let mut subtree = None;
    let mut removals = 0usize;
    for intent in &draft.var_intents {
        match intent {
            VarsIntent::InsertVariable { at, variable } => {
                if let (SequencePresence::Absent {}, ListPlacement::After { index }) =
                    (&view.vars_presence, at)
                {
                    return Err(missing(*index));
                }
                if matches!(view.vars_presence, SequencePresence::Absent {}) {
                    // `check_vars_intents_are_coherent` has already refused a
                    // second insertion into a match with no `vars`.
                    subtree = Some(variable.fields());
                    continue;
                }
                require_block_vars(&view.vars_presence, || missing(0))?;
                if let ListPlacement::After { index } = at {
                    if *index >= length {
                        return Err(missing(*index));
                    }
                }
                let insert = InsertItem::nested(vars.clone(), (*at).into(), variable.fields());
                edits.push(insert.into());
            }
            VarsIntent::RemoveVariable { index } => {
                require_block_vars(&view.vars_presence, || missing(*index))?;
                let item = view.vars.get(*index).ok_or(missing(*index))?;
                let at = item
                    .path
                    .clone()
                    .ok_or(DraftError::VariableHasNoPath { index: *index })?;
                edits.push(RemoveItem::new(at).into());
                removals += 1;
            }
            VarsIntent::RemoveVars {} => match &view.vars_presence {
                SequencePresence::Absent {} => {}
                SequencePresence::UnsupportedShape { found, .. } => {
                    return Err(DraftError::VarsHasAnUnsupportedShape { found: *found })
                }
                SequencePresence::Empty { .. } | SequencePresence::Items { .. } => {
                    edits.push(FieldRemoval::new(vars.clone()).into());
                }
            },
        } // End of the match over what the intent asks for
    } // End of the loop over the drafted `vars` intents
      // Removing the last variable is explicit (ruling 8): the removals are
      // resolved and distinct by now, so counting them is counting variables.
    if removals > 0 && removals >= length {
        return Err(DraftError::VarsWouldBeEmpty {});
    }
    Ok(subtree)
} // End of function plan_vars_intents()

/// The whole subtrees a draft creates in the match's own mapping, for
/// [`plan_insertions`] to write in its one group.
struct Created {
    /// The one new variable of a match with no `vars` (Phase 4-4).
    vars: Option<Vec<(String, ItemValue)>>,
    /// The new definitions of a shorthand form with no `form_fields` (Phase 4-6).
    form_fields: Option<ItemFields>,
}

/// What one entry of the insertion group is, by name.
///
/// The group's entries are keyed by a schema-known name and nothing else: a
/// scalar field of the match, or one of its two lists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Inserted {
    /// A schema-known scalar field.
    Field(MatchField),
    /// A schema-known list.
    Sequence(SequenceField),
}

impl Inserted {
    /// The espanso key the entry is written under.
    fn key(self) -> &'static str {
        match self {
            Inserted::Field(field) => field.key(),
            Inserted::Sequence(sequence) => sequence.key(),
        }
    }

    /// The refusal when no anchor survives the batch.
    fn no_anchor(self) -> DraftError {
        match self {
            Inserted::Field(field) => DraftError::NoInsertionAnchor { field },
            Inserted::Sequence(field) => DraftError::NoSequenceInsertionAnchor { field },
        }
    }
} // End of impl Inserted

/// Refuses list intents and a trigger switch that contradict each other or
/// another intent of the draft (Phase 3-2).
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason. It reads the view for one fact
/// only — each list's current item count — so that two insertions landing at
/// one place are recognised however they were spelled (`After(last)` and `End`
/// are the same place).
///
/// The rules, each a [`DraftError::SequenceIntentsConflict`] naming the list:
///
/// 1. adding or removing a whole field is the only intent about that field —
///    no other list intent and no [`ItemDraft`] beside it;
/// 2. one item is removed at most once, and a removed item is not also
///    rewritten by an [`ItemDraft`];
/// 3. two insertions into one list do not land at one place;
/// 4. an insertion does not land exactly where the same batch removes an item —
///    the insertion point and the removal's first byte would coincide, and the
///    engine refuses two replacements that share a start;
/// 5. a trigger switch is the only intent about `triggers`, and its scalar key
///    carries no other intent ([`DraftError::SubstitutionConflictsWithField`]).
fn check_structure_is_coherent(
    view: &MatchView,
    draft: &MatchDraft,
    structure: &MatchStructure,
) -> Result<(), DraftError> {
    let intents = &structure.sequences;
    let drafts_items = |field: SequenceField| {
        draft
            .items(field)
            .iter()
            .any(|item| !item.value.is_unchanged())
    };
    for (position, intent) in intents.iter().enumerate() {
        let field = intent.field();
        let conflict = DraftError::SequenceIntentsConflict { field };
        let others = intents
            .iter()
            .enumerate()
            .filter(|(other, candidate)| *other != position && candidate.field() == field);
        if intent.is_whole_field() && (others.clone().next().is_some() || drafts_items(field)) {
            return Err(conflict);
        }
        let before = &intents[..position];
        match intent {
            SequenceIntent::RemoveItem { index, .. } => {
                let removed_twice = before.iter().any(|earlier| {
                    matches!(earlier, SequenceIntent::RemoveItem { field: held, index: at }
                        if *held == field && at == index)
                });
                let rewritten = draft
                    .items(field)
                    .iter()
                    .any(|item| item.index == *index && !item.value.is_unchanged());
                if removed_twice || rewritten {
                    return Err(conflict);
                }
            }
            SequenceIntent::InsertItems { at, .. } => {
                let length = items_of(view, field).len();
                let landing = at.items_above(length);
                let shares_a_landing = before.iter().any(|earlier| {
                    matches!(earlier, SequenceIntent::InsertItems { field: held, at: other, .. }
                        if *held == field && other.items_above(length) == landing)
                });
                let lands_on_a_removal = landing.is_some_and(|landing| {
                    intents.iter().any(|other| {
                        matches!(other, SequenceIntent::RemoveItem { field: held, index }
                            if *held == field && *index == landing)
                    })
                });
                if shares_a_landing || lands_on_a_removal {
                    return Err(conflict);
                }
            }
            SequenceIntent::InsertField { .. } | SequenceIntent::RemoveField { .. } => {}
        } // End of the match over what this intent does
    } // End of the loop over the drafted list intents

    if let Some(switch) = &structure.switch {
        let form = switch.form().field();
        let renamed = structure
            .substitutions
            .iter()
            .any(|substitution| substitution.from() == form || substitution.to() == form);
        if !draft.field(form).is_unchanged() || renamed {
            return Err(DraftError::SubstitutionConflictsWithField { field: form });
        }
        let lists = SequenceField::Triggers;
        if intents.iter().any(|intent| intent.field() == lists) || drafts_items(lists) {
            return Err(DraftError::SequenceIntentsConflict { field: lists });
        }
    }
    Ok(())
} // End of function check_structure_is_coherent()

/// Refuses a batch whose removals would take every item of a list away.
///
/// **Removing the last item is explicit** (ruling 6): a list with nothing left
/// would have to become `[]` or a bare, null `key:`, and neither is "remove an
/// item". [`SequenceIntent::RemoveField`] is the intent that means *no list*.
/// Stated over the intents, after each has been resolved against the view, so
/// every index counted is one the list has; insertions do not rescue it, because
/// a list whose every original item goes is a rewrite of the list rather than
/// an edit of it.
fn check_no_list_is_emptied(
    view: &MatchView,
    intents: &[SequenceIntent],
) -> Result<(), DraftError> {
    for field in SequenceField::ALL {
        let removals = intents
            .iter()
            .filter(|intent| {
                matches!(intent, SequenceIntent::RemoveItem { field: held, .. } if *held == field)
            })
            .count();
        let length = items_of(view, field).len();
        if removals > 0 && removals >= length {
            return Err(DraftError::SequenceWouldBeEmpty { field });
        }
    } // End of the loop over the two lists
    Ok(())
} // End of function check_no_list_is_emptied()

/// Refuses an intent about the items of a list that is not there or is not a
/// list (Phase 3-3).
///
/// A block list, a flow list and an empty `[]` all qualify: since Phase 3-3 the
/// engine inserts and removes a flow list's items between its brackets, never
/// converting it. The two answers, in order: the list is not there
/// ([`DraftError::SequenceFieldAbsent`]), or its value is not a list
/// ([`DraftError::SequenceHasAnUnsupportedShape`]).
fn require_list(presence: &SequencePresence, field: SequenceField) -> Result<(), DraftError> {
    match presence {
        SequencePresence::Absent {} => Err(DraftError::SequenceFieldAbsent { field }),
        SequencePresence::UnsupportedShape { found, .. } => {
            Err(DraftError::SequenceHasAnUnsupportedShape {
                field,
                found: *found,
            })
        }
        SequencePresence::Empty { .. } | SequencePresence::Items { .. } => Ok(()),
    }
} // End of function require_list()

/// Refuses a trigger switch from a list that is not an existing block list.
///
/// A switch stays block-only (`docs/decisions/3-2-notes.md` §3.4): reshaping a
/// flow list into a scalar is not an item edit.
///
/// The three answers, in order: the list is not there
/// ([`DraftError::SequenceFieldAbsent`]), its value is not a list
/// ([`DraftError::SequenceHasAnUnsupportedShape`]), or it is a flow list whose
/// delimiters this step does not edit ([`DraftError::SequenceIsAFlowList`]).
fn require_block_list(presence: &SequencePresence, field: SequenceField) -> Result<(), DraftError> {
    match presence {
        SequencePresence::Absent {} => Err(DraftError::SequenceFieldAbsent { field }),
        SequencePresence::UnsupportedShape { found, .. } => {
            Err(DraftError::SequenceHasAnUnsupportedShape {
                field,
                found: *found,
            })
        }
        SequencePresence::Empty { .. } | SequencePresence::Items { flow: true, .. } => {
            Err(DraftError::SequenceIsAFlowList { field })
        }
        SequencePresence::Items { flow: false, .. } => Ok(()),
    }
} // End of function require_block_list()

/// Refuses a list whose items include one this editor never showed as text.
///
/// An item the projection elided is a collection written where the schema says
/// a string goes; deleting it with the list would discard structure nobody saw.
fn require_scalar_items(items: &[ValueView], field: SequenceField) -> Result<(), DraftError> {
    match items.iter().position(|item| item.as_scalar().is_none()) {
        Some(index) => Err(DraftError::NotAScalar {
            target: DraftTarget::Item { field, index },
        }),
        None => Ok(()),
    }
} // End of function require_scalar_items()

/// Plans one list intent, appending to `edits` or, for a new field, to
/// `insertions`.
fn plan_sequence_intent(
    view: &MatchView,
    path: &DocumentPath,
    intent: &SequenceIntent,
    edits: &mut Vec<DocumentEdit>,
    insertions: &mut Vec<(Inserted, EntryValue)>,
) -> Result<(), DraftError> {
    let field = intent.field();
    let presence = presence_of(view, field);
    let items = items_of(view, field);
    let list = path.clone().with_key(field.key());
    match intent {
        SequenceIntent::InsertField { items: new, .. } => {
            if presence.is_present() {
                return Err(DraftError::SequenceFieldPresent { field });
            }
            insertions.push((
                Inserted::Sequence(field),
                EntryValue::ScalarList(new.clone()),
            ));
        }
        SequenceIntent::RemoveField { .. } => match presence {
            SequencePresence::Absent {} => {}
            SequencePresence::UnsupportedShape { found, .. } => {
                return Err(DraftError::SequenceHasAnUnsupportedShape {
                    field,
                    found: *found,
                })
            }
            SequencePresence::Empty { .. } | SequencePresence::Items { .. } => {
                require_scalar_items(items, field)?;
                edits.push(FieldRemoval::new(list).into());
            }
        },
        SequenceIntent::InsertItems { at, items: new, .. } => {
            require_list(presence, field)?;
            if let ItemPlacement::After(index) = at {
                if *index >= items.len() {
                    return Err(DraftError::SequenceItemDoesNotExist {
                        field,
                        index: *index,
                        length: items.len(),
                    });
                }
            }
            let insert = ScalarItemInsert::new(list, *at, new.to_vec())
                .ok_or(DraftError::SequenceIntentsConflict { field })?;
            edits.push(insert.into());
        }
        SequenceIntent::RemoveItem { index, .. } => {
            require_list(presence, field)?;
            let item = items
                .get(*index)
                .ok_or(DraftError::SequenceItemDoesNotExist {
                    field,
                    index: *index,
                    length: items.len(),
                })?;
            if item.as_scalar().is_none() {
                return Err(DraftError::NotAScalar {
                    target: DraftTarget::Item {
                        field,
                        index: *index,
                    },
                });
            }
            edits.push(RemoveItem::new(list.with_index(*index)).into());
        }
    } // End of the match over what the intent asks for
    Ok(())
} // End of function plan_sequence_intent()

/// Plans the trigger switch as one [`ShapeSwitch`].
fn plan_switch(
    view: &MatchView,
    path: &DocumentPath,
    switch: &TriggerSwitch,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let lists = SequenceField::Triggers;
    match switch {
        TriggerSwitch::ToList { from, items } => {
            let field = from.field();
            if scalar_of(view, field).is_none() {
                if let Some(found) = unmodelled_shape(view, field) {
                    return Err(DraftError::FieldHasAnUnmodelledShape { field, found });
                }
                return Err(DraftError::SubstitutionSourceAbsent { field });
            }
            if presence_of(view, lists).is_present() {
                return Err(DraftError::SequenceFieldPresent { field: lists });
            }
            let switch = ShapeSwitch::new(
                path.clone().with_key(field.key()),
                lists.key(),
                EntryValue::ScalarList(items.to_vec()),
            );
            edits.push(switch.into());
        }
        TriggerSwitch::FromList { to, value } => {
            require_block_list(presence_of(view, lists), lists)?;
            let items = items_of(view, lists);
            if items.len() > 1 {
                return Err(DraftError::SwitchWouldDiscardItems {
                    field: lists,
                    items: items.len(),
                });
            }
            require_scalar_items(items, lists)?;
            let field = to.field();
            if scalar_of(view, field).is_some() || unmodelled_shape(view, field).is_some() {
                return Err(DraftError::SubstitutionTargetPresent { field });
            }
            let switch = ShapeSwitch::new(
                path.clone().with_key(lists.key()),
                field.key(),
                EntryValue::Scalar(value.clone()),
            );
            edits.push(switch.into());
        }
    } // End of the match over the two directions
    Ok(())
} // End of function plan_switch()

/// Refuses substitutions that contradict each other or another intent of the
/// draft.
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason: a `Set` to the value already
/// there derives nothing, so a check after diffing could not see the intent.
fn check_substitutions_are_coherent(
    draft: &MatchDraft,
    substitutions: &[FieldSubstitution],
) -> Result<(), DraftError> {
    for (position, substitution) in substitutions.iter().enumerate() {
        let (from, to) = (substitution.from(), substitution.to());
        if !draft.field(from).is_unchanged() {
            return Err(DraftError::SubstitutionConflictsWithField { field: from });
        }
        if draft.field(to).is_remove() {
            return Err(DraftError::SubstitutionConflictsWithField { field: to });
        }
        // **A content switch removes no companion field** (ruling 8 of
        // `docs/decisions/3-split-notes.md`; Phase 3-5-1's review fix). Of the
        // companions a switch leaves in place, `paragraph` is the one a draft can
        // remove, and a batch that renames the content key and removes it would
        // take a companion out beside the switch; it is refused by name here.
        if matches!(substitution, FieldSubstitution::Content { .. })
            && draft.field(MatchField::Paragraph).is_remove()
        {
            return Err(DraftError::SubstitutionConflictsWithField {
                field: MatchField::Paragraph,
            });
        }
        for other in &substitutions[..position] {
            for field in [from, to] {
                if other.from() == field || other.to() == field {
                    return Err(DraftError::SubstitutionConflictsWithField { field });
                }
            }
        } // End of the loop over the substitutions before this one
    } // End of the loop over the drafted substitutions
    Ok(())
} // End of function check_substitutions_are_coherent()

/// Plans one substitution as one [`KeySubstitution`].
///
/// The value is compared by [`plan_scalar`], the one comparison this module
/// makes: a destination `Set` to the value the source already decodes to keeps
/// the value's bytes, and any other `Set` becomes the substitution's new value.
fn plan_substitution(
    view: &MatchView,
    draft: &MatchDraft,
    path: &DocumentPath,
    substitution: FieldSubstitution,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let (from, to) = (substitution.from(), substitution.to());
    let Some(scalar) = scalar_of(view, from) else {
        if let Some(found) = unmodelled_shape(view, from) {
            return Err(DraftError::FieldHasAnUnmodelledShape { field: from, found });
        }
        return Err(DraftError::SubstitutionSourceAbsent { field: from });
    };
    if scalar_of(view, to).is_some() || unmodelled_shape(view, to).is_some() {
        return Err(DraftError::SubstitutionTargetPresent { field: to });
    }
    let at = path.clone().with_key(from.key());
    let mut edit = KeySubstitution::new(at.clone(), to.key());
    if let DraftField::Set(value) = draft.field(to) {
        let target = DraftTarget::Field(from);
        if let Some(DocumentEdit::Scalar(rewrite)) = plan_scalar(scalar, value, at, target)? {
            edit = edit.with_value(rewrite.value());
        }
    }
    edits.push(edit.into());
    Ok(())
} // End of function plan_substitution()

/// Writes every absent field the draft sets as one insertion after one anchor.
///
/// The anchor is the last nameable entry the batch **leaves alone**: an entry
/// the batch removes or a substitution renames does not survive under the name
/// an anchor would give it, so it is skipped rather than refused.
///
/// One more entry is skipped: one whose **next visible entry the batch
/// removes**. The insertion point is the end of the anchor's line, which is
/// exactly where that removal's run begins, and [`crate::patch::apply_edits`]
/// refuses two replacements that share a start
/// ([`crate::patch::EditError::OverlappingEdits`], pinned by
/// `inserting_at_the_start_of_a_removed_item_is_an_overlap` in
/// `tests/patch_item.rs`). So a draft that removes the last entry and adds
/// another writes the new one after the last entry whose successor stays, rather
/// than being refused as it was before Phase 3-1. Since Phase 4-4 a draft can
/// take `vars` away ([`VarsIntent::RemoveVars`]), and since Phase 4-6
/// `form_fields` ([`crate::draft::FormFieldIntent::RemoveFields`]), so both are
/// visible entries for this rule — though never anchors themselves
/// ([`VisibleEntry::anchorable`]).
///
/// A new `vars:` subtree (Phase 4-4) is written as the group's trailing item
/// list ([`FieldInsertGroup::with_item_list`]) after the same anchor, and a new
/// `form_fields:` (Phase 4-6) as one of its mapping-valued entries
/// ([`FieldInsertGroup::with_mappings`]), after the scalar and list entries.
///
/// One field is a [`FieldInsert`]; two or more are one [`FieldInsertGroup`], in
/// the order they were collected — [`MatchField::ALL`] order.
fn plan_insertions(
    path: &DocumentPath,
    entries: &[VisibleEntry],
    insertions: Vec<(Inserted, EntryValue)>,
    created: Created,
    structure: &MatchStructure,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let Created {
        vars: new_vars,
        form_fields: new_form_fields,
    } = created;
    // The refusal when no anchor survives names the first thing to be written:
    // a field or list of the group, else the new `form_fields:` (Phase 4-6), else
    // the new `vars:` subtree (Phase 4-4).
    let no_anchor = match insertions.first() {
        Some((first, _)) => first.no_anchor(),
        None if new_form_fields.is_some() => DraftError::NoFormFieldInsertionAnchor {
            form: FormOwner::Shorthand {},
        },
        None if new_vars.is_some() => DraftError::NoVarsInsertionAnchor {},
        None => return Ok(()),
    };
    let mappings: Vec<(String, ItemFields)> = new_form_fields
        .map(|definitions| (FORM_FIELDS_KEY.to_owned(), definitions))
        .into_iter()
        .collect();
    let substitutions = structure.substitutions.as_slice();
    let removed = |key: &str| {
        edits.iter().any(|edit| match edit {
            DocumentEdit::RemoveField(removal) => removal.field() == &path.clone().with_key(key),
            _ => false,
        })
    };
    // A list whose items the batch changes is not an anchor either: an
    // insertion after its last item and an insertion after the whole entry are
    // the same offset, and a removal of its last item ends there (Phase 3-2).
    let items_change = |key: &str| {
        structure.sequences.iter().any(|intent| {
            matches!(
                intent,
                SequenceIntent::InsertItems { .. } | SequenceIntent::RemoveItem { .. }
            ) && intent.field().key() == key
        })
    };
    let switched = |key: &str| match &structure.switch {
        Some(TriggerSwitch::ToList { from, .. }) => from.field().key() == key,
        Some(TriggerSwitch::FromList { .. }) => SequenceField::Triggers.key() == key,
        None => false,
    };
    let leaves_alone = |key: &str| {
        let renamed = substitutions
            .iter()
            .any(|substitution| substitution.from().key() == key);
        !removed(key) && !renamed && !switched(key) && !items_change(key)
    };
    // A renamed successor does not matter: a substitution rewrites a key token,
    // which never starts at the beginning of a line in a match mapping.
    let successor_stays = |position: usize| {
        entries
            .get(position + 1)
            .and_then(|next| next.key.as_deref())
            .is_none_or(|key| !removed(key))
    };
    let anchor = entries
        .iter()
        .enumerate()
        .rev()
        .filter(|(_, entry)| entry.anchorable)
        .filter_map(|(position, entry)| Some((position, entry.key.as_deref()?)))
        .find(|(position, key)| leaves_alone(key) && successor_stays(*position))
        .map(|(_, key)| key.to_owned())
        .ok_or(no_anchor.clone())?;
    let mut fields: Vec<(String, EntryValue)> = insertions
        .into_iter()
        .map(|(field, value)| (field.key().to_owned(), value))
        .collect();
    // A new `vars:` subtree (Phase 4-4) is the group's trailing item list, so a
    // new variable beside a new match field is still one run after one anchor.
    if let Some(variable) = new_vars {
        let group = FieldInsertGroup::with_item_list(
            path.clone(),
            Some(anchor),
            fields,
            VARS_KEY,
            vec![variable],
        )
        .ok_or(no_anchor)?
        .with_mappings(mappings);
        edits.push(group.into());
        return Ok(());
    }
    // A new `form_fields:` (Phase 4-6) is a mapping-valued entry of the same
    // group, after the scalar and list entries.
    if !mappings.is_empty() {
        let group = match FieldInsertGroup::typed(path.clone(), Some(anchor.clone()), fields) {
            Some(group) => group.with_mappings(mappings),
            None => FieldInsertGroup::of_mappings(path.clone(), Some(anchor), mappings)
                .ok_or(no_anchor)?,
        };
        edits.push(group.into());
        return Ok(());
    }
    // One scalar field stays a `FieldInsert`, exactly as before Phase 3-1; a
    // list, or two entries or more, is one group.
    let edit: DocumentEdit = match fields.as_slice() {
        [(_, EntryValue::Scalar(_))] => {
            let (key, value) = fields.remove(0);
            let value = value.as_scalar().unwrap_or_default().to_owned();
            FieldInsert::after(path.clone(), anchor, key, value).into()
        }
        _ => FieldInsertGroup::typed(path.clone(), Some(anchor), fields)
            .ok_or(no_anchor)?
            .into(),
    };
    edits.push(edit);
    Ok(())
} // End of function plan_insertions()

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
        // Phase 4-5: a `depends_on` item and a `{label, id}` record are
        // addresses too, and a record saying nothing is not an intent.
        let target = |list: VariableList, item: usize| DraftTarget::VariableListItem {
            variable: variable.index,
            list,
            item,
        };
        if let Some((item, first, second)) = repeated_item_index(&variable.depends_on) {
            return Err(DraftError::TargetDraftedTwice {
                target: target(VariableList::DependsOn, item),
                first,
                second,
            });
        }
        let records: Vec<(usize, usize)> = variable
            .records
            .iter()
            .enumerate()
            .filter(|(_, record)| !record.is_unchanged())
            .map(|(position, record)| (position, record.index))
            .collect();
        let indices: Vec<usize> = records.iter().map(|(_, index)| *index).collect();
        if let Some((item, first, second)) = repeated_index(&indices) {
            return Err(DraftError::TargetDraftedTwice {
                target: target(VariableList::Values, item),
                first: records[first].0,
                second: records[second].0,
            });
        }
        // Phase 4-6: a verbose form's definitions, as the shorthand ones below.
        let fields: Vec<usize> = variable.fields.iter().map(|field| field.index).collect();
        if let Some((field, first, second)) = repeated_index(&fields) {
            return Err(DraftError::TargetDraftedTwice {
                target: DraftTarget::VariableFormField {
                    variable: variable.index,
                    field,
                },
                first,
                second,
            });
        }
        for field in &variable.fields {
            check_open_mapping_is_drafted_once(
                &field.options,
                OpenMapping::VariableFormField {
                    variable: variable.index,
                    field: field.index,
                },
            )?;
        } // End of the loop over the variable's drafted definitions
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
        for field in &variable.fields {
            let owner = OpenMapping::VariableFormField {
                variable: variable.index,
                field: field.index,
            };
            check_no_entry_of_one_mapping_drafts_two_shapes(&field.options, owner)?;
        } // End of the loop over the variable's drafted definitions
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
/// Insertions are collected rather than emitted because they are written as one
/// edit after one anchor, which cannot be chosen until every removal and every
/// substitution of the batch is known ([`plan_insertions`]).
fn plan_field(
    view: &MatchView,
    draft: &MatchDraft,
    path: &DocumentPath,
    field: MatchField,
    edits: &mut Vec<DocumentEdit>,
    insertions: &mut Vec<(Inserted, EntryValue)>,
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
        // One of the eight options (Phase 4-1): its text is inserted verbatim,
        // and `check_options_are_plain_source` has already refused one that
        // cannot be.
        (DraftField::Set(value), None) if field.writes_plain_source() => insertions.push((
            Inserted::Field(field),
            EntryValue::PlainSource(value.clone()),
        )),
        (DraftField::Set(value), None) => {
            insertions.push((Inserted::Field(field), EntryValue::Scalar(value.clone())))
        }
        (DraftField::Set(value), Some(scalar)) => {
            let target = DraftTarget::Field(field);
            let at = path.clone().with_key(field.key());
            let planned = if field.writes_plain_source() {
                plan_plain_source_scalar(scalar, value, at, target)?
            } else {
                plan_scalar(scalar, value, at, target)?
            };
            if let Some(edit) = planned {
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
pub(super) enum OpenMapping {
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
    /// One definition's option mapping in a verbose form's `params.fields`
    /// (Phase 4-6).
    VariableFormField {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// The definition's index in its projected `params.fields`.
        field: usize,
    },
}

impl OpenMapping {
    /// The address of one entry of this mapping.
    pub(super) fn entry(self, entry: usize) -> DraftTarget {
        match self {
            OpenMapping::Params { variable } => DraftTarget::Param { variable, entry },
            OpenMapping::FormField { field } => DraftTarget::FormFieldOption {
                field,
                option: entry,
            },
            OpenMapping::VariableFormField { variable, field } => {
                DraftTarget::VariableFormFieldOption {
                    variable,
                    field,
                    option: entry,
                }
            }
        }
    } // End of function entry() for OpenMapping

    /// The address of one element of one entry's sequence.
    pub(super) fn item(self, entry: usize, item: usize) -> DraftTarget {
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
            OpenMapping::VariableFormField { variable, field } => {
                DraftTarget::VariableFormFieldOptionItem {
                    variable,
                    field,
                    option: entry,
                    item,
                }
            }
        }
    } // End of function item() for OpenMapping

    /// The typed setting an entry of this mapping is **by its key**, or `None`
    /// for an entry whose value is a logical string (ruling 4).
    ///
    /// A variable's `params` has three — `offset`, `trim`, `debug`, the keys a
    /// new variable writes as plain source ([`VariableSetting::Offset`],
    /// [`VariableSetting::Trim`], [`VariableSetting::Debug`]); a form field
    /// definition's options have two — `multiline` and `trim_string_values`.
    /// Decided by the key alone, whatever the variable's `type` says: the key is
    /// what a new variable and the audit ([`check_closed_surface`]) both read, and
    /// a typed spelling of an unfamiliar key is never quoted into a string.
    pub(super) fn typed_setting(self, key: &str) -> Option<VariableSetting> {
        let settings: &[VariableSetting] = match self {
            OpenMapping::Params { .. } => &[
                VariableSetting::Offset,
                VariableSetting::Trim,
                VariableSetting::Debug,
            ],
            OpenMapping::FormField { .. } | OpenMapping::VariableFormField { .. } => &[
                VariableSetting::Multiline,
                VariableSetting::TrimStringValues,
            ],
        };
        settings
            .iter()
            .copied()
            .find(|setting| setting.key() == key)
    } // End of function typed_setting() for OpenMapping

    /// The refusal of a typed setting of this mapping whose drafted text is not
    /// plain source: [`DraftError::NewVariableSettingNotPlainSource`] for a
    /// variable's `params` (Phase 4-14-2), and
    /// [`DraftError::NewFormOptionNotPlainSource`] for a definition's options
    /// (Phase 4-6).
    fn not_plain_source(self, target: DraftTarget, setting: VariableSetting) -> DraftError {
        match self {
            OpenMapping::Params { .. } => {
                DraftError::NewVariableSettingNotPlainSource { target, setting }
            }
            OpenMapping::FormField { .. } | OpenMapping::VariableFormField { .. } => {
                DraftError::NewFormOptionNotPlainSource { target, setting }
            }
        }
    } // End of function not_plain_source() for OpenMapping
} // End of impl OpenMapping

/// Plans every drafted variable of `vars`.
///
/// The path each variable's edits hang off is the **projection's own**
/// ([`crate::model::VariableView::path`]), not one this function composes from
/// the match path: the projection is what told the caller the variable was at
/// that index, so it is what should say where the index points.
/// [`check_closed_surface`] reads the derived batch back and refuses anything
/// the two disagree about.
///
/// # The order of the checks, per variable
///
/// It mirrors [`plan_match_edits`]'s own first three steps, one level down and in
/// the same order: the index resolves ([`DraftError::TargetDoesNotExist`]), the
/// variable has a path ([`DraftError::VariableHasNoPath`]), and then **no key of
/// its own mapping is written twice** ([`check_no_key_of_the_variable_is_repeated`]).
/// The ambiguity check is last of the three because the two before it are about
/// whether the variable can be addressed at all, and first of everything else
/// because nothing inside an ambiguous mapping may be planned — not a scalar, not
/// a `params` entry, and not the intermediate `params:` segment a `params` path
/// travels through.
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
        check_no_key_of_the_variable_is_repeated(variable, index)?;
        for field in VariableField::ALL {
            plan_variable_scalar(variable, drafted, &at, field, edits)?;
        } // End of the loop over the variable's schema-known scalars
        plan_variable_lists(variable, drafted, &at, edits, nested)?;
        // A verbose form's definitions (Phase 4-6), planned by the functions the
        // shorthand `form_fields` goes through, at `params.fields`.
        let form = if drafted.drafts_form_fields() {
            let form = FormAt::verbose(variable, index, &at)?;
            check_form_intents(&form, &drafted.field_intents, &drafted.fields)?;
            let planned = plan_form(
                &form,
                &drafted.field_intents,
                &drafted.fields,
                edits,
                nested,
            )?;
            Some(FormParams {
                entry: fields_entry(variable),
                created: planned.created,
                removed: planned.removes_all,
            })
        } else {
            None
        };
        if drafted.params.is_empty() && drafted.insert_params.is_empty() && form.is_none() {
            continue;
        }
        let params = at.with_key(PARAMS_KEY);
        let owner = OpenMapping::Params { variable: index };
        plan_open_mapping(&variable.params, &drafted.params, &params, owner, edits)?;
        check_params_keep_an_entry(variable, drafted, form.as_ref())?;
        plan_new_params(variable, drafted, &params, form, edits)?;
        nested.push(NestedKeys::new(params, nameable_keys(&variable.params)));
    } // End of the loop over the drafted variables
    Ok(())
} // End of function plan_vars()

/// What a verbose form's planning tells the `params` planner (Phase 4-6).
struct FormParams {
    /// The index of the `params` entry holding `fields`, when there is one.
    entry: Option<usize>,
    /// The definitions of a form with no `fields`, to be written as a new
    /// `fields:` entry in the `params` group.
    created: Option<ItemFields>,
    /// Whether the whole `fields` entry is removed.
    removed: bool,
}

/// The index of the first `params` entry whose decoded key is `fields`.
fn fields_entry(variable: &VariableView) -> Option<usize> {
    variable.params.iter().position(|field| {
        field
            .key
            .as_ref()
            .is_some_and(|key| key.decoded && key.text == FIELDS_KEY)
    })
}

/// Refuses a draft that removes every entry of a variable's `params` and adds
/// none (Phase 4-3, ruling 8).
///
/// [`crate::patch::FieldRemoval`] would do it, and the file would be left with
/// `params:` holding nothing — a YAML null, not an empty mapping. A container is
/// removed only by an explicit container-removal intent, which a draft cannot
/// express yet, so the state is refused by name instead of arrived at silently.
/// The drafted removals are already resolved and distinct
/// ([`check_no_index_is_drafted_twice`]), so counting them is counting entries.
fn check_params_keep_an_entry(
    variable: &VariableView,
    drafted: &VariableDraft,
    form: Option<&FormParams>,
) -> Result<(), DraftError> {
    // A verbose form's `RemoveFields` (Phase 4-6) removes one entry too, and a
    // new `fields:` is one new entry.
    let removed = drafted
        .params
        .iter()
        .filter(|entry| entry.value == DraftField::Remove)
        .count()
        + usize::from(form.is_some_and(|form| form.removed));
    let inserts =
        !drafted.insert_params.is_empty() || form.is_some_and(|form| form.created.is_some());
    if !variable.params.is_empty() && removed == variable.params.len() && !inserts {
        return Err(DraftError::ParamsWouldBeEmpty {
            variable: drafted.index,
        });
    }
    Ok(())
} // End of function check_params_keep_an_entry()

/// Plans a variable's new author-named `params` entries as **one**
/// [`FieldInsertGroup`] (Phase 4-3).
///
/// Three things are decided here, each a refusal by name and never by key text:
///
/// 1. **the container.** `params` must be a block mapping with at least one
///    entry ([`MappingPresence::is_block_with_entries`]). Absent, flow (`{}`
///    included) and non-mapping shapes are three refusals: creating the
///    container is a later operation, and a flow mapping is never converted;
/// 2. **duplicates against the file.** Every existing key must be a decoded
///    scalar, so the comparison can be made at all
///    ([`DraftError::NewKeyCannotBeCompared`]), and no existing key may decode to
///    a new key's text ([`DraftError::NewKeyDuplicatesAnEntry`]) — whatever
///    either is quoted as, and whether or not the draft removes that entry;
/// 3. **the anchor.** The last entry the draft does not remove and whose
///    successor it does not remove either — the insertion point would otherwise
///    be the first byte of that successor's removal, which the engine refuses as
///    an overlap. It must be nameable ([`nameable_key`]).
///
/// The key text rules and duplicates among the draft's own insertions were
/// checked at intent level ([`check_new_keys_are_admissible`]).
fn plan_new_params(
    variable: &VariableView,
    drafted: &VariableDraft,
    params: &DocumentPath,
    form: Option<FormParams>,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let (created, fields_entry, fields_removed) = match form {
        Some(form) => (form.created, form.entry, form.removed),
        None => (None, None, false),
    };
    if drafted.insert_params.is_empty() && created.is_none() {
        return Ok(());
    }
    let index = drafted.index;
    match &variable.params_presence {
        MappingPresence::Absent {} => return Err(DraftError::ParamsAbsent { variable: index }),
        MappingPresence::UnsupportedShape { found, .. } => {
            return Err(DraftError::ParamsHasAnUnsupportedShape {
                variable: index,
                found: *found,
            })
        }
        MappingPresence::Empty { .. } | MappingPresence::Entries { flow: true, .. } => {
            return Err(DraftError::ParamsIsAFlowMapping { variable: index })
        }
        MappingPresence::Entries { flow: false, .. } => {}
    } // End of the match over the shape of `params`

    for (insertion, new) in drafted.insert_params.iter().enumerate() {
        let target = DraftTarget::NewParam {
            variable: index,
            insertion,
        };
        for (entry, field) in variable.params.iter().enumerate() {
            let Some(key) = field.key.as_ref().filter(|key| key.decoded) else {
                return Err(DraftError::NewKeyCannotBeCompared { target, entry });
            };
            if key.text == new.key {
                return Err(DraftError::NewKeyDuplicatesAnEntry { target, entry });
            }
        } // End of the loop over the existing entries
    } // End of the loop over the new entries

    let removed = |entry: usize| {
        (fields_removed && fields_entry == Some(entry))
            || drafted
                .params
                .iter()
                .any(|drafted| drafted.index == entry && drafted.value == DraftField::Remove)
    };
    // A kind list whose items the draft adds or removes is not an anchor either
    // (Phase 4-5), for `plan_insertions`' reason one level down: an insertion
    // after its last item and an insertion after the whole entry are the same
    // offset, and a removal of its last item ends there. A verbose form's
    // `fields` whose definitions the draft touches is not one either (Phase 4-6),
    // for the same reason.
    let items_change = |entry: usize| {
        let list = drafted.lists.iter().any(|intent| {
            intent.list().kind() == Some(variable.kind)
                && list_entry(variable, intent.list()) == Some(entry)
        });
        list || (drafted.drafts_form_fields() && fields_entry == Some(entry))
    };
    let anchor = (0..variable.params.len())
        .rev()
        .find(|&entry| !removed(entry) && !removed(entry + 1) && !items_change(entry))
        .ok_or(DraftError::NoParamInsertionAnchor { variable: index })?;
    let sibling = nameable_key(
        &variable.params,
        anchor,
        DraftTarget::Param {
            variable: index,
            entry: anchor,
        },
    )?
    .to_owned();
    let entries: Vec<(String, EntryValue)> = drafted
        .insert_params
        .iter()
        .map(|new| {
            let value = match &new.value {
                NewParamValue::Scalar(value) => EntryValue::Scalar(value.clone()),
                NewParamValue::List(items) => EntryValue::ScalarList(items.clone()),
            };
            (new.key.clone(), value)
        })
        .collect();
    // A new `fields:` (Phase 4-6) is a mapping-valued entry of the same group,
    // written after the new scalar and list entries.
    let mappings: Vec<(String, ItemFields)> = created
        .map(|definitions| (FIELDS_KEY.to_owned(), definitions))
        .into_iter()
        .collect();
    let group = match FieldInsertGroup::typed(params.clone(), Some(sibling.clone()), entries) {
        Some(group) => Some(group.with_mappings(mappings)),
        None => FieldInsertGroup::of_mappings(params.clone(), Some(sibling), mappings),
    };
    if let Some(group) = group {
        edits.push(group.into());
    }
    Ok(())
} // End of function plan_new_params()

/// One list of one existing variable, resolved against the projection (Phase
/// 4-5).
struct ResolvedList<'view> {
    /// The path of the sequence node itself.
    path: DocumentPath,
    /// Its projected items, in source order.
    items: &'view [ValueView],
    /// Whether it is written between brackets (`[]` included).
    flow: bool,
    /// The index of the `params` entry holding a kind list; `None` for
    /// `depends_on`.
    entry: Option<usize>,
}

/// The index of the `params` entry whose decoded key is `list`'s, when there
/// is one — the first such entry, which is the one the projection describes.
fn list_entry(variable: &VariableView, list: VariableList) -> Option<usize> {
    list.kind()?;
    variable.params.iter().position(|field| {
        field
            .key
            .as_ref()
            .is_some_and(|key| key.decoded && key.text == list.key())
    })
} // End of function list_entry()

/// Resolves one of a variable's four lists, or refuses by name (Phase 4-5).
///
/// In order: a kind list on a variable of another kind
/// ([`DraftError::VariableListIsNotOfItsKind`]); a kind list inside a `params`
/// written between braces ([`DraftError::ParamsIsAFlowMapping`] — the list is
/// then inside a flow collection, which this engine never edits by item); no
/// such list ([`DraftError::VariableListAbsent`], also when `params` is absent,
/// empty or not a mapping); a key two entries of `params` share
/// ([`DraftError::TargetKeyIsAmbiguous`], through [`nameable_key`]); and a key
/// holding something that is not a list
/// ([`DraftError::VariableListHasAnUnsupportedShape`]).
fn resolve_variable_list<'view>(
    variable: &'view VariableView,
    index: usize,
    at: &DocumentPath,
    list: VariableList,
) -> Result<ResolvedList<'view>, DraftError> {
    let absent = DraftError::VariableListAbsent {
        variable: index,
        list,
    };
    let (presence, items, path, entry) = match list.kind() {
        None => (
            &variable.depends_on_presence,
            variable.depends_on.as_slice(),
            at.clone().with_key(list.key()),
            None,
        ),
        Some(kind) => {
            if kind != variable.kind {
                return Err(DraftError::VariableListIsNotOfItsKind {
                    variable: index,
                    list,
                });
            }
            if let MappingPresence::Entries { flow: true, .. } = variable.params_presence {
                return Err(DraftError::ParamsIsAFlowMapping { variable: index });
            }
            let entry = list_entry(variable, list).ok_or(absent.clone())?;
            let target = DraftTarget::Param {
                variable: index,
                entry,
            };
            let key = nameable_key(&variable.params, entry, target)?;
            let presence = variable
                .list_param_presence
                .as_ref()
                .ok_or(absent.clone())?;
            let items = variable.params[entry]
                .value
                .as_sequence()
                .unwrap_or_default();
            let path = at.clone().with_key(PARAMS_KEY).with_key(key);
            (presence, items, path, Some(entry))
        }
    };
    let flow = match presence {
        SequencePresence::Absent {} => return Err(absent),
        SequencePresence::UnsupportedShape { found, .. } => {
            return Err(DraftError::VariableListHasAnUnsupportedShape {
                variable: index,
                list,
                found: *found,
            })
        }
        SequencePresence::Empty { .. } => true,
        SequencePresence::Items { flow, .. } => *flow,
    };
    Ok(ResolvedList {
        path,
        items,
        flow,
        entry,
    })
} // End of function resolve_variable_list()

/// The shapes a list's existing items have (Phase 4-5).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ItemShapes {
    /// No item at all.
    None,
    /// Every item is a scalar.
    Strings,
    /// Every item is a mapping — a `{label, id}` record, or something like one.
    Records,
    /// Anything else: shapes mixed, or an item that is neither.
    Mixed,
}

/// Classifies `items` ([`ItemShapes`]).
fn item_shapes(items: &[ValueView]) -> ItemShapes {
    if items.is_empty() {
        ItemShapes::None
    } else if items
        .iter()
        .all(|item| matches!(item, ValueView::Scalar(_)))
    {
        ItemShapes::Strings
    } else if items
        .iter()
        .all(|item| matches!(item, ValueView::Mapping(_)))
    {
        ItemShapes::Records
    } else {
        ItemShapes::Mixed
    }
} // End of function item_shapes()

/// Whether an item of `drafted`'s `list` at `item` is also **rewritten** by the
/// draft (Phase 4-5): a `depends_on` item through
/// [`VariableDraft::depends_on`], a record through [`VariableDraft::records`],
/// and a string of a kind list through its `params` entry's
/// [`EntryDraft::items`].
fn list_item_is_rewritten(
    drafted: &VariableDraft,
    list: VariableList,
    entry: Option<usize>,
    item: usize,
) -> bool {
    let by_item = |items: &[ItemDraft]| {
        items
            .iter()
            .any(|drafted| drafted.index == item && !drafted.value.is_unchanged())
    };
    let by_entry = entry.is_some_and(|entry| {
        drafted
            .params
            .iter()
            .any(|drafted| drafted.index == entry && by_item(&drafted.items))
    });
    let by_record = list.takes_records()
        && drafted
            .records
            .iter()
            .any(|record| record.index == item && !record.is_unchanged());
    match list {
        VariableList::DependsOn => by_item(&drafted.depends_on),
        _ => by_entry || by_record,
    }
} // End of function list_item_is_rewritten()

/// Refuses list intents of one drafted variable that contradict each other or
/// another intent of the draft (Phase 4-5).
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason. It reads the view for the list
/// lengths only, so that two insertions landing at one place are recognised
/// however they were spelled; a list the view cannot resolve is left to the
/// planner, which refuses it by name.
///
/// The rules, each a [`DraftError::VariableListIntentsConflict`] naming the
/// variable and the list:
///
/// 1. a kind list carries no list intent while its own `params` entry is `Set`
///    or removed;
/// 2. one item is removed at most once, and a removed item is not also
///    rewritten ([`list_item_is_rewritten`]);
/// 3. two insertions into one list do not land at one place;
/// 4. an insertion does not land exactly where the same draft removes an item.
fn check_variable_lists_are_coherent(
    view: &MatchView,
    draft: &MatchDraft,
) -> Result<(), DraftError> {
    for drafted in &draft.vars {
        let index = drafted.index;
        let (Some(variable), Some(at)) = (
            view.vars.get(index),
            view.vars
                .get(index)
                .and_then(|variable| variable.path.clone()),
        ) else {
            continue;
        };
        for (position, intent) in drafted.lists.iter().enumerate() {
            let list = intent.list();
            let conflict = DraftError::VariableListIntentsConflict {
                variable: index,
                list,
            };
            let Ok(resolved) = resolve_variable_list(variable, index, &at, list) else {
                continue;
            };
            if let Some(entry) = resolved.entry {
                let entry_drafted = drafted
                    .params
                    .iter()
                    .any(|held| held.index == entry && !held.value.is_unchanged());
                if entry_drafted {
                    return Err(conflict);
                }
            }
            let length = resolved.items.len();
            let before = &drafted.lists[..position];
            match intent {
                VariableListIntent::RemoveItem { index: item, .. } => {
                    let removed_twice = before.iter().any(|earlier| {
                        matches!(earlier, VariableListIntent::RemoveItem { list: held, index: at }
                            if *held == list && at == item)
                    });
                    if removed_twice || list_item_is_rewritten(drafted, list, resolved.entry, *item)
                    {
                        return Err(conflict);
                    }
                }
                VariableListIntent::InsertItems { at: placement, .. } => {
                    let landing = |at: &ListPlacement| ItemPlacement::from(*at).items_above(length);
                    let lands = landing(placement);
                    let shares_a_landing = before.iter().any(|earlier| {
                        matches!(earlier, VariableListIntent::InsertItems { list: held, at: other, .. }
                            if *held == list && landing(other) == lands)
                    });
                    let lands_on_a_removal = lands.is_some_and(|lands| {
                        drafted.lists.iter().any(|other| {
                            matches!(other, VariableListIntent::RemoveItem { list: held, index }
                                if *held == list && *index == lands)
                        })
                    });
                    if shares_a_landing || lands_on_a_removal {
                        return Err(conflict);
                    }
                }
            } // End of the match over what this intent does
        } // End of the loop over this variable's list intents
    } // End of the loop over the drafted variables
    Ok(())
} // End of function check_variable_lists_are_coherent()

/// Plans everything one drafted variable says about its four lists (Phase 4-5):
/// rewritten `depends_on` items, rewritten `{label, id}` records, and items
/// added or removed.
///
/// | Draft | Edit |
/// |---|---|
/// | a `depends_on` [`ItemDraft`] | one [`ScalarEdit`] when the value differs |
/// | a [`crate::draft::ChoiceRecordDraft`] | one [`ScalarEdit`] per entry that differs; every other entry of the record is untouched |
/// | [`VariableListIntent::InsertItems`] of strings | one [`ScalarItemInsert`] — block, or between a flow list's brackets |
/// | [`VariableListIntent::InsertItems`] of records | one [`InsertItem::several`], block lists only |
/// | [`VariableListIntent::RemoveItem`] | one [`RemoveItem`], which takes the item's own comments with it |
///
/// String and record shapes stay distinct: new items must have the shape every
/// existing item has, records only in a `choice`'s `values`
/// ([`DraftError::VariableListItemShapeMismatch`]); a record is never written
/// into or taken out of a flow list, and nothing is taken out of a flow list
/// holding anything but strings ([`DraftError::VariableListIsAFlowList`]); a
/// removed item is a string or a **flat** record, never one holding a
/// collection ([`DraftError::NestedRemovalWouldDiscardUnshownStructure`]); and
/// removing every item is [`DraftError::VariableListWouldBeEmpty`].
fn plan_variable_lists(
    variable: &VariableView,
    drafted: &VariableDraft,
    at: &DocumentPath,
    edits: &mut Vec<DocumentEdit>,
    nested: &mut Vec<NestedKeys>,
) -> Result<(), DraftError> {
    let index = drafted.index;
    let item_target = |list: VariableList, item: usize| DraftTarget::VariableListItem {
        variable: index,
        list,
        item,
    };
    // Rewritten `depends_on` items.
    for item in &drafted.depends_on {
        let target = item_target(VariableList::DependsOn, item.index);
        let value = match &item.value {
            DraftField::Unchanged => continue,
            DraftField::Remove => return Err(DraftError::NestedItemRemoval { target }),
            DraftField::Set(value) => value,
        };
        let resolved = resolve_variable_list(variable, index, at, VariableList::DependsOn)?;
        let existing = resolved
            .items
            .get(item.index)
            .ok_or(DraftError::TargetDoesNotExist {
                target,
                length: resolved.items.len(),
            })?;
        let scalar = existing
            .as_scalar()
            .ok_or(DraftError::NotAScalar { target })?;
        let path = resolved.path.with_index(item.index);
        if let Some(edit) = plan_scalar(scalar, value, path, target)? {
            edits.push(edit);
        }
    } // End of the loop over the drafted `depends_on` items

    // Rewritten `{label, id}` records.
    for record in drafted
        .records
        .iter()
        .filter(|record| !record.is_unchanged())
    {
        let list = VariableList::Values;
        let resolved = resolve_variable_list(variable, index, at, list)?;
        let target = item_target(list, record.index);
        let existing = resolved
            .items
            .get(record.index)
            .ok_or(DraftError::TargetDoesNotExist {
                target,
                length: resolved.items.len(),
            })?;
        let ValueView::Mapping(fields) = existing else {
            return Err(DraftError::NotAChoiceRecord {
                target,
                found: kind_of(existing),
            });
        };
        let record_path = resolved.path.clone().with_index(record.index);
        for field in ChoiceRecordField::ALL {
            let Some(value) = record.field(field) else {
                continue;
            };
            let target = DraftTarget::ChoiceRecordField {
                variable: index,
                record: record.index,
                field,
            };
            let entry = fields
                .iter()
                .position(|held| {
                    held.key
                        .as_ref()
                        .is_some_and(|key| key.decoded && key.text == field.key())
                })
                .ok_or(DraftError::ChoiceRecordFieldHasNoScalar { target })?;
            let key = nameable_key(fields, entry, target)?;
            let scalar = fields[entry]
                .value
                .as_scalar()
                .ok_or(DraftError::ChoiceRecordFieldHasNoScalar { target })?;
            let path = record_path.clone().with_key(key);
            if let Some(edit) = plan_scalar(scalar, value, path, target)? {
                edits.push(edit);
            }
        } // End of the loop over the record's two entries
        nested.push(NestedKeys::new(record_path, nameable_keys(fields)));
    } // End of the loop over the drafted records

    // Items added and removed.
    let mut removals: Vec<(VariableList, usize)> = Vec::new();
    for intent in &drafted.lists {
        let list = intent.list();
        let resolved = resolve_variable_list(variable, index, at, list)?;
        if resolved.entry.is_some() {
            let params = at.clone().with_key(PARAMS_KEY);
            nested.push(NestedKeys::new(params, nameable_keys(&variable.params)));
        }
        let length = resolved.items.len();
        match intent {
            VariableListIntent::InsertItems {
                at: placement,
                items,
                ..
            } => {
                if let ListPlacement::After { index: after } = placement {
                    if *after >= length {
                        return Err(DraftError::TargetDoesNotExist {
                            target: item_target(list, *after),
                            length,
                        });
                    }
                }
                let mismatch = DraftError::VariableListItemShapeMismatch {
                    variable: index,
                    list,
                };
                let shapes = item_shapes(resolved.items);
                let fits = match items {
                    NewListItems::Strings(_) => {
                        matches!(shapes, ItemShapes::None | ItemShapes::Strings)
                    }
                    NewListItems::Records(_) => {
                        list.takes_records()
                            && matches!(shapes, ItemShapes::None | ItemShapes::Records)
                    }
                };
                if !fits {
                    return Err(mismatch);
                }
                let placement = ItemPlacement::from(*placement);
                let edit: DocumentEdit = match items {
                    NewListItems::Strings(strings) => {
                        ScalarItemInsert::new(resolved.path, placement, strings.to_vec())
                            .ok_or(mismatch)?
                            .into()
                    }
                    NewListItems::Records(_) if resolved.flow => {
                        return Err(DraftError::VariableListIsAFlowList {
                            variable: index,
                            list,
                        })
                    }
                    NewListItems::Records(records) => {
                        let items = records
                            .to_vec()
                            .into_iter()
                            .map(|record| {
                                vec![
                                    (
                                        LABEL_KEY.to_owned(),
                                        ItemValue::Entry(EntryValue::Scalar(record.label)),
                                    ),
                                    (
                                        ID_KEY.to_owned(),
                                        ItemValue::Entry(EntryValue::Scalar(record.id)),
                                    ),
                                ]
                            })
                            .collect();
                        InsertItem::several(resolved.path, placement, items)
                            .ok_or(mismatch)?
                            .into()
                    }
                };
                edits.push(edit);
            }
            VariableListIntent::RemoveItem { index: item, .. } => {
                let target = item_target(list, *item);
                let existing = resolved
                    .items
                    .get(*item)
                    .ok_or(DraftError::TargetDoesNotExist { target, length })?;
                let flow_refusal = DraftError::VariableListIsAFlowList {
                    variable: index,
                    list,
                };
                // A flow list loses an item between its brackets only while
                // every item is a string (Phase 3-3's engine).
                if resolved.flow && item_shapes(resolved.items) != ItemShapes::Strings {
                    return Err(flow_refusal);
                }
                match existing {
                    ValueView::Scalar(_) => {}
                    ValueView::Mapping(fields) if list.takes_records() => {
                        let flat = fields
                            .iter()
                            .all(|field| field.key.is_some() && field.value.as_scalar().is_some());
                        if !flat {
                            return Err(DraftError::NestedRemovalWouldDiscardUnshownStructure {
                                target,
                                found: ValueKind::Mapping,
                            });
                        }
                    }
                    _ => return Err(DraftError::NotAScalar { target }),
                }
                edits.push(RemoveItem::new(resolved.path.with_index(*item)).into());
                removals.push((list, length));
            }
        } // End of the match over what the intent asks for
    } // End of the loop over the drafted list intents

    // Removing the last item is explicit (ruling 8): the removals are resolved
    // and distinct by now, so counting them is counting items.
    for list in VariableList::ALL {
        let taken: Vec<usize> = removals
            .iter()
            .filter(|(held, _)| *held == list)
            .map(|(_, length)| *length)
            .collect();
        if let Some(length) = taken.first() {
            if taken.len() >= *length {
                return Err(DraftError::VariableListWouldBeEmpty {
                    variable: index,
                    list,
                });
            }
        }
    } // End of the loop over the four lists
    Ok(())
} // End of function plan_variable_lists()

/// Refuses a new author-named key whose **text** breaks ruling 7 or names one of
/// ruling 4's typed settings, and two new keys of one variable draft that decode
/// alike (Phase 4-3).
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason: none of it depends on the file.
/// Every refusal names the insertion's position ([`DraftTarget::NewParam`]) and
/// never its text (`CLAUDE.md` §1).
fn check_new_keys_are_admissible(draft: &MatchDraft) -> Result<(), DraftError> {
    for drafted in &draft.vars {
        for (insertion, new) in drafted.insert_params.iter().enumerate() {
            let target = DraftTarget::NewParam {
                variable: drafted.index,
                insertion,
            };
            if let Some(fault) = author_key_fault(&new.key) {
                return Err(key_fault_refusal(fault, target));
            }
            if TYPED_SETTINGS.contains(&new.key.as_str()) {
                return Err(DraftError::NewKeyIsATypedSetting { target });
            }
            let earlier = drafted.insert_params[..insertion]
                .iter()
                .position(|seen| seen.key == new.key);
            if let Some(first) = earlier {
                return Err(DraftError::NewKeyDuplicatesAnInsertion { target, first });
            }
        } // End of the loop over one variable's new entries
    } // End of the loop over the drafted variables
    Ok(())
} // End of function check_new_keys_are_admissible()

/// The refusal that names one ruling-7 fault of a new author-named key.
pub(super) fn key_fault_refusal(fault: AuthorKeyFault, target: DraftTarget) -> DraftError {
    match fault {
        AuthorKeyFault::Empty => DraftError::NewKeyIsEmpty { target },
        AuthorKeyFault::LineBreak => DraftError::NewKeyHasALineBreak { target },
        AuthorKeyFault::ControlCharacter => DraftError::NewKeyHasAControlCharacter { target },
        AuthorKeyFault::MergeKey => DraftError::NewKeyIsAMergeKey { target },
    }
} // End of function key_fault_refusal()

/// Refuses a drafted variable whose own mapping writes a modelled key twice.
///
/// **The match mapping's policy, one level down.** [`plan_match_edits`] refuses a
/// match whose mapping repeats a key before it plans anything for it, and neither
/// of the two mechanisms that state that policy reaches a *variable's* mapping: a
/// variable's schema-known paths are composed from [`VariableField::key`], a
/// literal, so [`nameable_key`]'s duplicate gate is never consulted for them, and
/// `check_every_named_key_is_unique` only judges a mapping the planner recorded
/// a [`NestedKeys`] for — which is the `params` mapping, never the variable's own.
///
/// The two shapes this closes are one refusal because they have one cause. A
/// repeated `name:`, `type:` or `inject_vars:` makes that scalar's path ambiguous;
/// a repeated `params:` makes an **intermediate** segment ambiguous, which
/// `check_every_named_key_is_unique` could not have caught either way because it
/// reads a path's last named segment only.
///
/// The projection has already decided which is which:
/// [`UnknownReason::RepeatedKey`] is recorded only for a key
/// [`crate::model::VariableView`] models and an earlier entry already claimed. A
/// key it does not model, repeated, is [`UnknownReason::NotModelled`] twice and is
/// **not** refused here — those entries are carried through every edit untouched
/// and no path this engine composes goes near them.
///
/// **No projected document reaches this refusal today**, because the hazard gate in
/// [`plan_match_edits`]'s third step refuses the whole match first — the reason is
/// written out at [`DraftError::AmbiguousVariableKey`], and
/// `one_match_with_its_duplicate_admitted` in `tests/draft_plan.rs` asserts it still
/// holds. This is the nested answer standing behind that coarse one.
fn check_no_key_of_the_variable_is_repeated(
    variable: &crate::model::VariableView,
    index: usize,
) -> Result<(), DraftError> {
    let repeated = variable
        .unknown_entries
        .iter()
        .any(|entry| entry.reason == UnknownReason::RepeatedKey);
    if repeated {
        return Err(DraftError::AmbiguousVariableKey { variable: index });
    }
    Ok(())
} // End of function check_no_key_of_the_variable_is_repeated()

/// Plans one of a variable's three schema-known scalars.
///
/// **An absent one is refused, never inserted** (D1). The projection reports
/// `None` both for a key that is not there and for one holding a shape the
/// schema does not use, and neither can be honoured: a draft adds no variable
/// scalar (the Phase 4-3 lift covers new `params` entries only), and no
/// primitive replaces a collection node with a scalar one.
///
/// **`inject_vars` is a typed setting written as plain source** (ruling 4; the
/// Phase 4-9 review's blocker), exactly as a new variable writes it: a `Set` is
/// validated with [`is_plain_source`] before any comparison and refused by name
/// ([`DraftError::NewVariableSettingNotPlainSource`], the target naming the
/// existing variable's scalar), then compared and written by
/// `plan_plain_source_scalar` — so `false` becomes `true`, never `'true'`, and a
/// quoted `'true'` drafted as `true` is rewritten plain. `name` and `type` stay
/// logical strings spelled by the codec.
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
        DraftField::Set(value) if field == VariableField::InjectVars => {
            if !is_plain_source(value) {
                return Err(DraftError::NewVariableSettingNotPlainSource {
                    target,
                    setting: VariableSetting::InjectVars,
                });
            }
            if let Some(edit) = plan_plain_source_scalar(scalar, value, field_path, target)? {
                edits.push(edit);
            }
        }
        DraftField::Set(value) => {
            if let Some(edit) = plan_scalar(scalar, value, field_path, target)? {
                edits.push(edit);
            }
        }
    } // End of the match over what the draft says about this field
    Ok(())
} // End of function plan_variable_scalar()

/// Plans every drafted entry of one open mapping.
///
/// The one function `params` and a form field's options both go through, so the
/// answers this surface gives to an open key are stated once.
///
/// # Typed settings are plain source (ruling 4)
///
/// A `Set` of an entry that is one of the mapping's typed settings
/// ([`OpenMapping::typed_setting`]: a variable's `offset`, `trim` and `debug`
/// since Phase 4-14-2, a definition's `multiline` and `trim_string_values` since
/// the Phase 4-6 review) is validated with [`is_plain_source`] **before any
/// comparison** and refused by name otherwise
/// ([`OpenMapping::not_plain_source`]), then compared and written by
/// `plan_plain_source_scalar` — so `0` becomes `3600`, never `'3600'`, and a
/// quoted `'false'` drafted as `false` is rewritten plain. Only an entry whose
/// key decoded and whose value is a scalar is a typed setting here; any other is
/// left to the logical-string rule, which refuses a collection by name.
pub(super) fn plan_open_mapping(
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
        let setting = field
            .key
            .as_ref()
            .filter(|key| key.decoded && field.value.as_scalar().is_some())
            .and_then(|key| owner.typed_setting(&key.text));
        if let (Some(setting), DraftField::Set(text)) = (setting, &drafted.value) {
            if !is_plain_source(text) {
                return Err(owner.not_plain_source(target, setting));
            }
        }
        let at = mapping
            .clone()
            .with_key(nameable_key(fields, entry, target)?);
        let plain = setting.is_some();
        plan_entry_value(field, &drafted.value, &at, target, plain, edits)?;
        plan_entry_items(field, drafted, &at, owner, edits)?;
    } // End of the loop over this mapping's drafted entries
    Ok(())
} // End of function plan_open_mapping()

/// Plans one open entry's scalar value.
///
/// A `Remove` takes a scalar entry away, and an entry whose value is a **flat
/// list of scalars** ([`is_a_scalar_list`]) — in a variable's `params` since
/// Phase 4-3, and in a form field definition's options since Phase 4-6: every
/// byte of it was displayed as an item, so removing it discards nothing the
/// editor never showed. A mapping and a list holding a collection or an alias are
/// still refused as [`DraftError::NestedRemovalWouldDiscardUnshownStructure`].
///
/// `plain` says the entry is a typed setting whose drafted text has already
/// passed [`is_plain_source`] ([`plan_open_mapping`]): a `Set` is then compared
/// and written as source by `plan_plain_source_scalar`, never as a logical
/// string.
fn plan_entry_value(
    field: &FieldView,
    intent: &DraftField<String>,
    at: &DocumentPath,
    target: DraftTarget,
    plain: bool,
    edits: &mut Vec<DocumentEdit>,
) -> Result<(), DraftError> {
    let removable_list = is_a_scalar_list(&field.value);
    match (intent, field.value.as_scalar()) {
        (DraftField::Unchanged, _) => {}
        (DraftField::Remove, Some(_)) => edits.push(FieldRemoval::new(at.clone()).into()),
        (DraftField::Remove, None) if removable_list => {
            edits.push(FieldRemoval::new(at.clone()).into())
        }
        (DraftField::Remove, None) => {
            return Err(DraftError::NestedRemovalWouldDiscardUnshownStructure {
                target,
                found: kind_of(&field.value),
            })
        }
        (DraftField::Set(value), Some(scalar)) => {
            let planned = if plain {
                plan_plain_source_scalar(scalar, value, at.clone(), target)?
            } else {
                plan_scalar(scalar, value, at.clone(), target)?
            };
            if let Some(edit) = planned {
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
pub(super) fn nameable_key(
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
pub(super) fn nameable_keys(fields: &[FieldView]) -> Vec<String> {
    fields
        .iter()
        .filter_map(|field| field.key.as_ref())
        .filter(|key| key.decoded)
        .map(|key| key.text.clone())
        .collect()
} // End of function nameable_keys()

/// Whether a projected value is a sequence whose every item is a scalar — `[]`
/// included (Phase 4-3).
pub(super) fn is_a_scalar_list(value: &ValueView) -> bool {
    value
        .as_sequence()
        .is_some_and(|items| items.iter().all(|item| item.as_scalar().is_some()))
}

/// What kind of node a projected value is.
pub(super) fn kind_of(value: &ValueView) -> ValueKind {
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

/// One existing scalar of a plain-source option against one drafted **source
/// text** (Phase 4-1).
///
/// `Ok(None)` only when the scalar is already written as exactly `value`: plain,
/// decoding to `value`, and spanning exactly `value.len()` bytes. The three
/// together are the source comparison without the source text, which this
/// planner is not handed: a plain scalar's decoding differs from its bytes only
/// by folding a line break and the indentation after it, which always shortens
/// it, so a plain scalar that decodes to `value` in `value.len()` bytes *is*
/// `value`. That is an argument about YAML's plain-scalar grammar, not something
/// a type forces; the engine re-checks the written bytes on the candidate
/// ([`crate::patch::VerificationFailure::PlainSourceNotReadBack`]).
///
/// Every other answer is one [`ScalarEdit::plain_source`], so a quoted spelling
/// of the same text (`'true'` for `true`) is rewritten, exactly as the bulk edit
/// rewrites it. `value` has already passed [`is_plain_source`].
pub(super) fn plan_plain_source_scalar(
    scalar: &ScalarView,
    value: &str,
    at: DocumentPath,
    target: DraftTarget,
) -> Result<Option<DocumentEdit>, DraftError> {
    let written_as_is = scalar.decoded
        && scalar.style == crate::ScalarStyle::Plain
        && scalar.text == value
        && scalar.span.len() == value.len();
    if written_as_is {
        return Ok(None);
    }
    if scalar.span.start == scalar.span.end {
        return Err(DraftError::TargetOwnsNoBytes { target });
    }
    Ok(Some(ScalarEdit::plain_source(at, value).into()))
} // End of function plan_plain_source_scalar()

/// Refuses a `Set` of a plain-source option whose text cannot be written as one
/// plain scalar (Phase 4-1).
///
/// **Intent level, and before any diffing**, for
/// [`check_no_index_is_drafted_twice`]'s reason: a text refused here must be
/// refused whether or not the field already holds it, or a quoted `'a #b'`
/// drafted as `Set("a #b")` would slip through as "unchanged" on one file and be
/// refused on another. Only the eight [`MatchField::PLAIN_SOURCE_OPTIONS`] are
/// checked; `anchor` and every other field are logical strings.
fn check_options_are_plain_source(draft: &MatchDraft) -> Result<(), DraftError> {
    for field in MatchField::PLAIN_SOURCE_OPTIONS {
        if let DraftField::Set(text) = draft.field(field) {
            if !is_plain_source(text) {
                return Err(DraftError::OptionNotPlainSource { field });
            }
        }
    } // End of the loop over the eight plain-source options
    Ok(())
} // End of function check_options_are_plain_source()

/// One entry of the match's mapping that this planner can see.
///
/// "Can see" is a real limit and a deliberate one: `form_fields` is modelled as
/// its own projection and is not listed, so a match whose last entry is
/// `form_fields` is anchored *before* it. `vars` is listed since Phase 4-4,
/// through its presence's key span, but is never an anchor, so a match whose
/// last entry is `vars` is still anchored before it. That changes where a new
/// key lands and nothing else.
struct VisibleEntry {
    /// The entry's decoded key, or `None` for a key no path segment can name.
    key: Option<String>,
    /// Where it sits, for ordering only.
    at: usize,
    /// Whether an insertion may be written after it. `false` for `vars` (Phase
    /// 4-4) and `form_fields` (Phase 4-6): each is visible so that removing it
    /// keeps the entry before it from anchoring an insertion at its first byte,
    /// but an insertion after it would land where something appended to it
    /// lands, so it anchors nothing.
    anchorable: bool,
}

/// Every entry of the match's mapping this planner can see, in source order.
///
/// Ordered by byte offset rather than by declaration order, because the source
/// is the only thing that knows which entry is last. Modelled fields contribute
/// their **value** span and unknown entries their **key** span; the two mix
/// safely because a mapping's entries are disjoint and sequential, so both
/// offsets fall inside the same entry's own extent.
///
/// # A list is seen through its own key (Phase 3-2)
///
/// A list contributes its **key span**, read from the presence metadata the
/// projection carries ([`crate::model::SequencePresence`]). Until Phase 3-2 a
/// list was seen only through its first element, so `triggers: []` — present,
/// addressable, and with no element — contributed nothing, and a match whose
/// entries were all empty lists gave an insertion no anchor. That limit is
/// lifted: `an_empty_sequence_is_visible_as_an_insertion_anchor` in
/// `tests/draft_plan.rs` anchors a new entry on `triggers: []`.
fn visible_entries(view: &MatchView) -> Vec<VisibleEntry> {
    let mut entries: Vec<VisibleEntry> = Vec::new();
    for field in MatchField::ALL {
        if let Some(scalar) = scalar_of(view, field) {
            entries.push(VisibleEntry {
                key: Some(field.key().to_owned()),
                at: scalar.span.start,
                anchorable: true,
            });
        }
    } // End of the loop over the schema-known scalar fields
    for sequence in SequenceField::ALL {
        // The entry's own key span, from the presence metadata — so `[]` is
        // visible too (Phase 3-2). A list written with a shape that is not a
        // list is an unknown entry and is seen below, once.
        if let SequencePresence::Empty { location } | SequencePresence::Items { location, .. } =
            presence_of(view, sequence)
        {
            entries.push(VisibleEntry {
                key: Some(sequence.key().to_owned()),
                at: location.key_span.start,
                anchorable: true,
            });
        }
    } // End of the loop over the schema-known string sequences
      // `vars`, seen through its own key since Phase 4-4, but never an anchor. A
      // `vars` of a shape the projection does not model is an unknown entry and is
      // seen below, once, as before.
    if let SequencePresence::Empty { location } | SequencePresence::Items { location, .. } =
        &view.vars_presence
    {
        entries.push(VisibleEntry {
            key: Some(VARS_KEY.to_owned()),
            at: location.key_span.start,
            anchorable: false,
        });
    }
    // `form_fields`, likewise since Phase 4-6: a draft may remove it whole, and an
    // insertion after it would land where a definition appended to it lands. A
    // `form_fields` that is not a mapping is an unknown entry and is seen below.
    if let MappingPresence::Empty { location } | MappingPresence::Entries { location, .. } =
        &view.form_fields_presence
    {
        entries.push(VisibleEntry {
            key: Some(FORM_FIELDS_KEY.to_owned()),
            at: location.key_span.start,
            anchorable: false,
        });
    }
    for unknown in &view.unknown_entries {
        entries.push(VisibleEntry {
            key: unknown.key.clone(),
            at: unknown.key_span.start,
            anchorable: true,
        });
    } // End of the loop over the entries the projection did not model
    entries.sort_by_key(|entry| entry.at);
    entries
} // End of function visible_entries()

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

/// Whether one string sequence is written, and in what shape (Phase 3-2).
fn presence_of(view: &MatchView, sequence: SequenceField) -> &SequencePresence {
    match sequence {
        SequenceField::Triggers => &view.trigger.triggers_presence,
        SequenceField::SearchTerms => &view.search_terms_presence,
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
