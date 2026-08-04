//! The two guards a drafted batch must pass, stated over the batch itself.
//!
//! Both functions take a `&[DocumentEdit]` and know nothing about the draft that
//! produced it, so a planner that emitted an edit into `vars`, or two insertions
//! at one point, is caught by its own output rather than by a reviewer
//! (`PROGRESS.md` R24, and the same shape as
//! `crate::patch::edit::StructuralGuard`). They are public because a check
//! nothing can call with a hand-built batch is a sentence rather than a rule.
//!
//! # What they are, and what they are not
//!
//! They are a **closed-surface check and a batch-dependency check over a derived
//! batch**. They are *not* an independent validation of the planner's intent,
//! and the difference is worth stating because the stronger claim is the easy one
//! to make:
//!
//! - they read **paths**, never nodes. Nothing here consults the document, so a
//!   scalar edit naming `triggers[999]` — an element no sequence has — passes
//!   both. Only [`crate::patch::apply_edits`] can answer that, and it does;
//! - they share the planner's **vocabulary**. [`MatchField::from_key`] and
//!   [`SequenceField::from_key`] decide what "inside the surface" means for both
//!   sides, so a defect in that vocabulary is not a defect these guards can see;
//! - they know nothing about **cardinality in the original**, nor about how many
//!   intents produced the batch. A draft that said two things about one element
//!   and had one of them erased as a no-op reaches them as a batch of one edit,
//!   which is why that check is at intent level in
//!   [`crate::draft::plan_match_edits`] and could not be here.
//!
//! What they do establish is worth having and is exactly this: **every edit of
//! the batch names something inside one match's closed scalar surface, and no
//! edit of the batch depends on another edit of the batch.**

use crate::draft::error::DraftError;
use crate::draft::match_draft::{
    MatchField, SequenceField, VariableField, FORM_FIELDS_KEY, PARAMS_KEY, VARS_KEY,
};
use crate::patch::{DocumentEdit, DocumentPath, PathSegment};

/// The keys one **nested** mapping a batch reaches into is known to hold.
///
/// The caller's account of one open mapping — a variable's `params`, or the
/// option mapping of one `form_fields` entry — in source order and **with
/// repetitions**, so that ambiguity is a fact about the list rather than a
/// promise about it. Exactly what `original_keys` is to
/// [`check_batch_independence`], one level down, and read the same way: this
/// module never consults a document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NestedKeys {
    /// The path of the nested mapping itself.
    mapping: DocumentPath,
    /// Its keys, in source order and with repetitions.
    keys: Vec<String>,
}

impl NestedKeys {
    /// Records the keys of one nested mapping.
    pub fn new(mapping: DocumentPath, keys: Vec<String>) -> NestedKeys {
        NestedKeys { mapping, keys }
    }

    /// The path of the nested mapping.
    pub fn mapping(&self) -> &DocumentPath {
        &self.mapping
    }

    /// Its keys, in source order and with repetitions.
    pub fn keys(&self) -> &[String] {
        &self.keys
    }
} // End of impl NestedKeys

/// Refuses a batch that reaches outside the closed scalar surface of one match.
///
/// **The invariant, stated in code:** a drafted batch may modify or remove
/// existing addressable nodes and may insert scalar-valued mapping entries into
/// the match's own mapping, and it may **never change a sequence's cardinality**
/// and **never synthesize a collection node**.
///
/// Each clause is checked as a shape rather than as an intention:
///
/// - a move is refused outright — it is the one primitive that relocates bytes,
///   and `PROGRESS.md` R25 forbids combining it with anything;
/// - a scalar edit may name one of seven shapes and nothing else, listed in
///   [`names_a_surface_scalar`]. Each is a scalar-node replacement at a position
///   that already exists, which is why none is a cardinality change;
/// - an insertion may only join the match's **own** mapping under a
///   schema-known scalar key. An insertion into `<match>.triggers` would be a
///   new sequence item and an insertion into `<match>.vars[0].params` a new
///   mapping entry under a key no schema fixes; both are refused here, and the
///   second is 2b-2b-2's D1 stated as a shape. That an insertion's *value* is
///   always a scalar needs no check — a [`crate::patch::FieldInsert`] carries a
///   `String` and renders it through [`crate::emit::choose_scalar`], so there is
///   no spelling of it that builds a collection;
/// - a removal may name one of four shapes, listed in
///   [`names_a_surface_field`]: the three that end in a key segment, plus the
///   match's own schema-known scalar keys. A path ending in an index is a
///   sequence element, and deleting one is a cardinality change.
///
/// **Nothing deeper than those shapes passes.** A path one segment longer than
/// the deepest legal one fails, and
/// `a_path_one_segment_deeper_than_the_surface_is_refused` is the test that says
/// so rather than the sentence.
///
/// `mapping` is the path of the match's own mapping.
pub fn check_closed_surface(
    mapping: &DocumentPath,
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    for (position, edit) in edits.iter().enumerate() {
        let within = match edit {
            DocumentEdit::MoveItem(_) => {
                return Err(DraftError::MoveIsNotADraftEdit { edit: position })
            }
            DocumentEdit::Scalar(scalar) => names_a_surface_scalar(mapping, scalar.path()),
            DocumentEdit::RemoveField(removal) => names_a_surface_field(mapping, removal.field()),
            DocumentEdit::InsertField(insert) => {
                insert.mapping() == mapping && MatchField::from_key(insert.key()).is_some()
            }
            // A sequence-item insert, remove or duplicate is a **cardinality
            // change to a sequence**, which is exactly what a closed surface
            // excludes: the draft diff describes one match's own scalar fields,
            // and adding, deleting or copying an item of `triggers`, `vars` or
            // `matches` is a different operation with a different primitive
            // behind it. Refused as outside the surface rather than by a name
            // of its own, because that is what it is — the surface has no shape
            // for it at all.
            DocumentEdit::InsertItem(_)
            | DocumentEdit::RemoveItem(_)
            | DocumentEdit::DuplicateItem(_) => false,
        };
        if !within {
            return Err(DraftError::OutsideTheClosedSurface { edit: position });
        }
    } // End of the loop over the batch's edits
    Ok(())
} // End of function check_closed_surface()

/// Refuses a batch whose edits depend on one another.
///
/// Ruling 5, in seven checks: **every dependency must resolve in the original
/// tree, and an insertion's anchor must survive the batch.** The batch is
/// planned against the document as it stands, so an edit that only makes sense
/// after another one has been applied has no meaning at all — and the order the
/// edits happen to arrive in is not one, because
/// [`crate::patch::apply_edits`] splices from the highest offset downwards.
///
/// `original_keys` is every key of the match's mapping this engine can see, in
/// source order and **with repetitions**, so that ambiguity is a fact about the
/// list rather than a promise about it. It is the **caller's** account of the
/// original mapping and this function does not check it against a document: what
/// is established is that the batch is consistent with the list it was given.
///
/// `nested` says the same about every **open** mapping the batch reaches into —
/// a variable's `params`, a `form_fields` entry's options — and is empty for a
/// batch that stays on the match's own mapping. A mapping the batch names and
/// `nested` does not describe is not checked for ambiguity: the caller said
/// nothing about it, and inventing a claim about a document this module never
/// reads would be worse than declining to make one.
///
/// The checks, in the order they run:
///
/// 1. two scalar edits naming one node;
/// 2. a removal whose subtree contains another edit;
/// 3. a key the batch names that its own mapping writes more than once — at the
///    match's level and at every nested level the caller described;
/// 4. an anchor the same batch inserts;
/// 5. an anchor the original mapping does not have;
/// 6. an anchor the same batch removes;
/// 7. two insertions sharing one anchor.
pub fn check_batch_independence(
    mapping: &DocumentPath,
    original_keys: &[String],
    nested: &[NestedKeys],
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    check_no_scalar_is_edited_twice(edits)?;
    check_no_removal_contains_another_edit(edits)?;
    check_every_named_key_is_unique(mapping, original_keys, nested, edits)?;
    check_every_anchor_survives(mapping, original_keys, edits)?;
    Ok(())
} // End of function check_batch_independence()

/// Check 1: no two scalar edits name one node.
fn check_no_scalar_is_edited_twice(edits: &[DocumentEdit]) -> Result<(), DraftError> {
    let scalars: Vec<(usize, &DocumentPath)> = edits
        .iter()
        .enumerate()
        .filter_map(|(position, edit)| match edit {
            DocumentEdit::Scalar(scalar) => Some((position, scalar.path())),
            _ => None,
        })
        .collect();
    for (offset, (first, path)) in scalars.iter().enumerate() {
        for (second, other) in scalars.iter().skip(offset + 1) {
            if path == other {
                return Err(DraftError::ScalarEditedTwice {
                    first: *first,
                    second: *second,
                });
            }
        }
    } // End of the loop over every pair of scalar edits
    Ok(())
} // End of function check_no_scalar_is_edited_twice()

/// Check 2: no removal's subtree contains another edit of the batch.
///
/// A removal deletes a whole entry — its key, its value and everything under
/// it — so an edit inside that value is a second answer about the same bytes.
/// The other removal's case is checked too: nesting is nesting whichever edit
/// does it.
///
/// # The invariant it rests on, stated because it is load-bearing
///
/// Containment is decided by **segment-wise path prefix**, and it stands in for
/// containment of *bytes*. The two agree only because a
/// [`crate::patch::DocumentPath`] addresses concrete syntax nodes of **one
/// immutable parse** and follows no semantic indirection: the resolver walks a
/// mapping's own children and a sequence's own children, and it never expands an
/// alias or a merge key ([`crate::model::ValueView::Alias`] is projected
/// unfollowed, and the hazard gate refuses every match near one). If a path
/// could traverse an alias, a semantic descendant could sit **outside** the
/// removed byte span and prefix containment would report a conflict that byte
/// containment does not — or, worse, the reverse.
///
/// Since Phase 2b-2b-2 a batch mixes depths freely — a removal in a variable's
/// `params` and an edit in one of its elements — so the invariant carries more
/// weight than it did when every path was two segments long. It is the reason
/// this function needed no change, and
/// `a_removal_in_an_outer_mapping_containing_a_nested_edit_is_caught` is the
/// test that says so rather than the sentence.
///
/// The one harmless disagreement is trivia: a removal's envelope may swallow
/// comments and blank lines that no path names at all. That is
/// [`crate::patch::FieldRemoval`]'s own contract, not a batch dependency.
fn check_no_removal_contains_another_edit(edits: &[DocumentEdit]) -> Result<(), DraftError> {
    let removals: Vec<(usize, &DocumentPath)> = edits
        .iter()
        .enumerate()
        .filter_map(|(position, edit)| match edit {
            DocumentEdit::RemoveField(removal) => Some((position, removal.field())),
            _ => None,
        })
        .collect();
    for (removal, field) in &removals {
        for (position, edit) in edits.iter().enumerate() {
            let other = match edit {
                DocumentEdit::Scalar(scalar) => scalar.path(),
                DocumentEdit::RemoveField(nested) => nested.field(),
                _ => continue,
            };
            if position != *removal && contains(field, other) {
                return Err(DraftError::RemovalContainsAnEdit {
                    removal: *removal,
                    edit: position,
                });
            }
        } // End of the loop over the edits this removal might contain
    } // End of the loop over the batch's removals
    Ok(())
} // End of function check_no_removal_contains_another_edit()

/// Check 3: every key the batch names is written once in the mapping that holds
/// it.
///
/// A path names the **first** entry with a given key
/// (`crate::patch::path::resolve`'s rule), so a batch that names a repeated key
/// addresses one occurrence and reads as though it addressed the other. That is
/// true at every depth, so since Phase 2b-2b-2 the check is stated at every
/// depth.
///
/// # The decomposition, and why it is this one
///
/// Each edit is reduced to **the mapping it names a key inside, and that key**
/// ([`named_key_in_parent`]), and the pair is then looked up in the one key list
/// that describes that mapping: `original_keys` for the match's own mapping, and
/// `nested` for anything below it. Grouping by parent path is the only
/// decomposition that stays true to what ambiguity *is* — a fact about one
/// mapping's own entries — and it needs no traversal of the batch's shape:
/// `matches[0].vars[0].params.values[2]` and `matches[0].vars[0].params.values`
/// reduce to the same pair, which is right, because they are the same entry seen
/// through two paths.
///
/// The refusals differ because their payloads must. A repeated key of the match
/// mapping is a key espanso's schema may fix, so [`DraftError::AmbiguousKey`]
/// can name it; a repeated key of an open mapping is the owner's own text, so
/// [`DraftError::AmbiguousNestedKey`] carries a position in the batch and
/// nothing else (`CLAUDE.md` section 1).
fn check_every_named_key_is_unique(
    mapping: &DocumentPath,
    original_keys: &[String],
    nested: &[NestedKeys],
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    for (position, edit) in edits.iter().enumerate() {
        let named = match edit {
            DocumentEdit::Scalar(scalar) => named_key_in_parent(scalar.path()),
            DocumentEdit::RemoveField(removal) => named_key_in_parent(removal.field()),
            DocumentEdit::InsertField(insert) => insert
                .sibling()
                .map(|key| (insert.mapping().clone(), key.to_owned())),
            // None of the four names a key in a parent mapping: a move, a
            // duplicate and the two sequence-item primitives address a
            // **position**, and `check_closed_surface` has already refused all
            // four.
            DocumentEdit::MoveItem(_)
            | DocumentEdit::InsertItem(_)
            | DocumentEdit::RemoveItem(_)
            | DocumentEdit::DuplicateItem(_) => None,
        };
        let Some((parent, key)) = named else {
            continue;
        };
        if &parent == mapping {
            if occurrences(original_keys, &key) > 1 {
                return Err(DraftError::AmbiguousKey {
                    field: MatchField::from_key(&key),
                });
            }
            continue;
        }
        // A mapping the caller did not describe is not judged: this module reads
        // paths, never documents, so it has nothing to judge it against.
        if let Some(known) = nested.iter().find(|entry| entry.mapping() == &parent) {
            if occurrences(known.keys(), &key) > 1 {
                return Err(DraftError::AmbiguousNestedKey { edit: position });
            }
        }
    } // End of the loop over the keys the batch names
    Ok(())
} // End of function check_every_named_key_is_unique()

/// Checks 4 to 7: every insertion's anchor is an original sibling the batch
/// leaves alone, and no two insertions share one.
///
/// **It is stated over the match's own mapping only, and Phase 2b-2b-2 did not
/// need to generalise it**, because that phase derives no insertion below the
/// match mapping at all (its decision D1). Every [`crate::patch::FieldInsert`] a
/// drafted batch can hold therefore still names `mapping`, which
/// [`check_closed_surface`] independently refuses otherwise, and `original_keys`
/// is still the one list an anchor has to be found in. A later phase that
/// inserts into an open mapping owes this function a nested key list of its own.
fn check_every_anchor_survives(
    mapping: &DocumentPath,
    original_keys: &[String],
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    let inserted: Vec<&str> = edits
        .iter()
        .filter_map(|edit| match edit {
            DocumentEdit::InsertField(insert) => Some(insert.key()),
            _ => None,
        })
        .collect();
    let removed: Vec<&str> = edits
        .iter()
        .filter_map(|edit| match edit {
            DocumentEdit::RemoveField(removal) => key_in(mapping, removal.field()),
            _ => None,
        })
        .collect();

    let mut anchors: Vec<(usize, &str)> = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let DocumentEdit::InsertField(insert) = edit else {
            continue;
        };
        // `None` means "the mapping's last entry", which is what
        // `crate::patch::edit::plan_insertion` resolves it to. Resolving it the
        // same way here is what lets this guard judge a batch it did not build.
        let anchor = match insert.sibling() {
            Some(key) => key,
            None => original_keys
                .last()
                .map(String::as_str)
                .ok_or(DraftError::InsertionAnchorNotInOriginal { edit: position })?,
        };
        if inserted.contains(&anchor) {
            return Err(DraftError::InsertionAnchorIsInserted { edit: position });
        }
        if occurrences(original_keys, anchor) == 0 {
            return Err(DraftError::InsertionAnchorNotInOriginal { edit: position });
        }
        if removed.contains(&anchor) {
            return Err(DraftError::InsertionAnchorRemoved { edit: position });
        }
        if let Some((first, _)) = anchors.iter().find(|(_, held)| *held == anchor) {
            return Err(DraftError::SharedInsertionAnchor {
                first: *first,
                second: position,
            });
        }
        anchors.push((position, anchor));
    } // End of the loop over the batch's insertions
    Ok(())
} // End of function check_every_anchor_survives()

/// How many times `key` occurs in `keys`.
fn occurrences(keys: &[String], key: &str) -> usize {
    keys.iter().filter(|held| held.as_str() == key).count()
}

/// Whether `outer` names `inner` or an ancestor of it.
///
/// Equality counts: removing exactly the entry another edit rewrites is the
/// same conflict as removing the entry above it.
fn contains(outer: &DocumentPath, inner: &DocumentPath) -> bool {
    outer.document_index() == inner.document_index()
        && inner.segments().len() >= outer.segments().len()
        && inner.segments()[..outer.segments().len()] == *outer.segments()
}

/// The key an edit names **directly inside** `mapping`, when it names one.
fn key_in<'a>(mapping: &DocumentPath, path: &'a DocumentPath) -> Option<&'a str> {
    suffix(mapping, path)?.first()?.as_key()
}

/// The segments of `path` that lie below `mapping`, or `None` when `path` is not
/// inside it.
///
/// `None` for `mapping` itself as much as for a path in another document: the
/// suffix of a path that names the mapping is empty, and an empty suffix names
/// no node the surface admits.
fn suffix<'a>(mapping: &DocumentPath, path: &'a DocumentPath) -> Option<&'a [PathSegment]> {
    let base = mapping.segments();
    let segments = path.segments();
    if path.document_index() != mapping.document_index()
        || segments.len() <= base.len()
        || segments[..base.len()] != *base
    {
        return None;
    }
    Some(&segments[base.len()..])
} // End of function suffix()

/// Whether `path` names a scalar of the closed surface.
///
/// The seven shapes, and nothing else:
///
/// | Shape | What it is |
/// |---|---|
/// | `<match>.<scalar key>` | a schema-known scalar field |
/// | `<match>.<triggers\|search_terms>[i]` | an existing element of a string sequence |
/// | `<match>.vars[i].<name\|type\|inject_vars>` | a variable's schema-known scalar |
/// | `<match>.vars[i].params.<key>` | one entry of a variable's open `params` mapping |
/// | `<match>.vars[i].params.<key>[j]` | one element of such an entry's sequence |
/// | `<match>.form_fields.<key>.<key>` | one option of one form field |
/// | `<match>.form_fields.<key>.<key>[j]` | one element of such an option's sequence |
///
/// Every one of them ends at an **existing** node: not one adds an entry or an
/// element, and none is deeper than the deepest row above.
fn names_a_surface_scalar(mapping: &DocumentPath, path: &DocumentPath) -> bool {
    let Some(tail) = suffix(mapping, path) else {
        return false;
    };
    match tail {
        [PathSegment::Key(key)] => MatchField::from_key(key).is_some(),
        [PathSegment::Key(key), PathSegment::Index(_)] => SequenceField::from_key(key).is_some(),
        [PathSegment::Key(vars), PathSegment::Index(_), PathSegment::Key(field)] => {
            vars == VARS_KEY && VariableField::from_key(field).is_some()
        }
        [PathSegment::Key(fields), PathSegment::Key(_), PathSegment::Key(_)] => {
            fields == FORM_FIELDS_KEY
        }
        [PathSegment::Key(vars), PathSegment::Index(_), PathSegment::Key(params), PathSegment::Key(_)] => {
            vars == VARS_KEY && params == PARAMS_KEY
        }
        [PathSegment::Key(fields), PathSegment::Key(_), PathSegment::Key(_), PathSegment::Index(_)] => {
            fields == FORM_FIELDS_KEY
        }
        [PathSegment::Key(vars), PathSegment::Index(_), PathSegment::Key(params), PathSegment::Key(_), PathSegment::Index(_)] => {
            vars == VARS_KEY && params == PARAMS_KEY
        }
        _ => false,
    } // End of the match over the seven shapes a surface scalar takes
} // End of function names_a_surface_scalar()

/// Whether `path` names a **mapping entry** the closed surface may remove.
///
/// The four shapes that end in a key segment: a schema-known scalar field of the
/// match, a variable's schema-known scalar, one entry of a variable's `params`,
/// and one option of one form field. A path ending in an index names a sequence
/// element instead, and deleting one of those is a cardinality change this
/// engine never makes.
fn names_a_surface_field(mapping: &DocumentPath, path: &DocumentPath) -> bool {
    let Some(tail) = suffix(mapping, path) else {
        return false;
    };
    match tail {
        [PathSegment::Key(key)] => MatchField::from_key(key).is_some(),
        [PathSegment::Key(vars), PathSegment::Index(_), PathSegment::Key(field)] => {
            vars == VARS_KEY && VariableField::from_key(field).is_some()
        }
        [PathSegment::Key(fields), PathSegment::Key(_), PathSegment::Key(_)] => {
            fields == FORM_FIELDS_KEY
        }
        [PathSegment::Key(vars), PathSegment::Index(_), PathSegment::Key(params), PathSegment::Key(_)] => {
            vars == VARS_KEY && params == PARAMS_KEY
        }
        _ => false,
    } // End of the match over the four shapes a removable entry takes
} // End of function names_a_surface_field()

/// The mapping an edit names a key **inside**, and that key.
///
/// Trailing index segments are stripped first: `…params.values[2]` names the key
/// `values` inside `…params`, because a sequence element is introduced by a `-`
/// rather than by a key of its own. `None` for a path that names no key at all —
/// a root path, or one that is nothing but indices.
fn named_key_in_parent(path: &DocumentPath) -> Option<(DocumentPath, String)> {
    let segments = path.segments();
    let mut end = segments.len();
    while end > 0 && matches!(segments[end - 1], PathSegment::Index(_)) {
        end -= 1;
    }
    let key = segments.get(end.checked_sub(1)?)?.as_key()?;
    let parent = DocumentPath::new(path.document_index(), segments[..end - 1].to_vec());
    Some((parent, key.to_owned()))
} // End of function named_key_in_parent()
