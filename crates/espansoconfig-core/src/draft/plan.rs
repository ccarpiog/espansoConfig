//! From a draft to the smallest batch that realises it.

use crate::draft::audit::{check_batch_independence, check_closed_surface};
use crate::draft::error::DraftError;
use crate::draft::field::DraftField;
use crate::draft::match_draft::{DraftTarget, MatchDraft, MatchField, SequenceField};
use crate::model::{MatchView, ScalarView, UnknownReason, ValueView};
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
/// # The order of the checks is the contract
///
/// 1. the match has a path;
/// 2. no key of its mapping is written twice — a path that names two nodes is
///    not a path, and paths are this function's whole output;
/// 3. the hazard gate does not refuse the match;
/// 4. no sequence index is drafted twice — checked **at intent level, before
///    any diffing**, because an intent that asks for the value already there
///    derives no edit and would be invisible to every later check;
/// 5. every drafted field is planned, in [`MatchField::ALL`] order, then every
///    drafted sequence element in the draft's own order;
/// 6. the derived batch passes [`check_closed_surface`];
/// 7. and [`check_batch_independence`].
///
/// Steps 1 to 3 are about the **match**, not about the batch, so a draft that
/// would change nothing is still refused for a match that cannot be edited. The
/// answer to *may I edit this match* is no whatever is asked of it. Step 4 is
/// about the **draft**, and it is the one check that cannot be moved later
/// without changing what it catches.
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

    let entries = visible_entries(view);
    let mut edits: Vec<DocumentEdit> = Vec::new();
    let mut insertions: Vec<(MatchField, String)> = Vec::new();
    for field in MatchField::ALL {
        plan_field(view, draft, path, field, &mut edits, &mut insertions)?;
    } // End of the loop over the schema-known scalar fields
    for sequence in SequenceField::ALL {
        plan_sequence(view, draft, path, sequence, &mut edits)?;
    } // End of the loop over the schema-known string sequences
    if !insertions.is_empty() {
        let anchor = last_nameable_key(&entries).ok_or(DraftError::NoInsertionAnchor {
            field: insertions[0].0,
        })?;
        for (field, value) in insertions {
            edits.push(FieldInsert::after(path.clone(), anchor, field.key(), value).into());
        }
    }

    check_closed_surface(path, &edits)?;
    check_batch_independence(path, &original_keys(&entries), &edits)?;
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
/// A [`MatchField`] cannot be drafted twice by construction — [`MatchDraft`] has
/// one struct field per key, and `serde` refuses a JSON object that writes one
/// of them more than once — so this check is only about the two sequences, which
/// are the only lists in the draft.
fn check_no_index_is_drafted_twice(draft: &MatchDraft) -> Result<(), DraftError> {
    for sequence in SequenceField::ALL {
        let items = draft.items(sequence);
        for (first, item) in items.iter().enumerate() {
            if item.value.is_unchanged() {
                continue;
            }
            let duplicate = items
                .iter()
                .enumerate()
                .skip(first + 1)
                .find(|(_, other)| !other.value.is_unchanged() && other.index == item.index);
            if let Some((second, _)) = duplicate {
                return Err(DraftError::SequenceItemDraftedTwice {
                    field: sequence,
                    index: item.index,
                    first,
                    second,
                });
            }
        } // End of the loop over this sequence's drafted elements
    } // End of the loop over the two string sequences
    Ok(())
} // End of function check_no_index_is_drafted_twice()

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
