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
//! the batch names something inside one match's closed surface, and no edit of
//! the batch depends on another edit of the batch.** Since Phase 3-2 that
//! surface includes the cardinality and the presence of two lists, `triggers`
//! and `search_terms`; since Phase 4-3 it also includes the cardinality of one
//! open mapping, a variable's `params`, by new author-named entries of a scalar
//! or a flat list of scalars; and since Phase 4-4 the cardinality and presence
//! of `vars`, by whole new variables of a closed shape and by removals — and
//! nothing else's. A variable **reorder** is judged by its own check,
//! [`check_variable_move`], because a move is never part of a draft's batch.

use crate::draft::author_key::{author_key_fault, TYPED_SETTINGS};
use crate::draft::error::DraftError;
use crate::draft::match_draft::{
    FieldSubstitution, MatchField, SequenceField, VariableField, FORM_FIELDS_KEY, PARAMS_KEY,
    VARS_KEY,
};
use crate::draft::new_variable::{
    DEPENDS_ON_KEY, INJECT_VARS_KEY, NAME_KEY, NEW_VARIABLE_KEYS, PLAIN_SOURCE_PARAMS, TYPE_KEY,
};
use crate::model::VariableKind;
use crate::patch::{DocumentEdit, DocumentPath, EntryValue, ItemPlacement, ItemValue, PathSegment};

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
/// existing addressable nodes, may insert scalar-valued mapping entries into
/// the match's own mapping and may rename one of that mapping's scalar-valued
/// keys to another form of the same family. Since Phase 3-2 it may also change
/// the cardinality of `triggers` and `search_terms` — and of **no other
/// sequence** — by scalar items, add or remove either as a whole list of
/// scalars, and switch a scalar trigger form to or from a `triggers` list. It
/// may **never synthesize any other collection node**.
///
/// Each clause is checked as a shape rather than as an intention:
///
/// - a move is refused outright — it is the one primitive that relocates bytes,
///   and `PROGRESS.md` R25 forbids combining it with anything;
/// - a scalar edit may name one of seven shapes and nothing else, listed in
///   [`names_a_surface_scalar`]. Each is a scalar-node replacement at a position
///   that already exists, which is why none is a cardinality change;
/// - an insertion — one entry or an ordered group of them — may join the
///   match's **own** mapping under schema-known scalar keys, and one open
///   mapping under the Phase 4-3 shape listed last. An insertion into
///   `<match>.triggers` would be a new sequence item and is refused here, and
///   so is every other insertion under a key no schema fixes — 2b-2b-2's D1
///   stated as a shape, lifted for that one shape only. That an insertion's *value* is
///   always a scalar needs no check — a [`crate::patch::FieldInsert`] carries a
///   `String` and renders it through [`crate::emit::choose_scalar`], so there is
///   no spelling of it that builds a collection;
/// - a key substitution may only rename a schema-known scalar key of the match's
///   own mapping to **another form of the same family**
///   ([`FieldSubstitution::between`]): `trigger`↔`regex`, or one content key to
///   another. Its optional new value is a `String`, as an insertion's is;
/// - a removal may name one of five shapes, listed in
///   [`names_a_surface_field`]: the three that end in a key segment, the
///   match's own schema-known scalar keys, and — since Phase 3-2 — the match's
///   two lists as whole fields;
/// - a list-valued insertion ([`EntryValue::ScalarList`] in a group) may only
///   name `triggers` or `search_terms` on the match's own mapping;
/// - a scalar-item insertion may only name `<match>.triggers` /
///   `<match>.search_terms`, and an item removal an item of one of those or —
///   since Phase 4-4 — one variable `<match>.vars[i]`. `depends_on`, a `params`
///   list, `form_fields` options and `matches` itself are refused here, whatever
///   the engine could do to them;
/// - a shape switch may only turn `trigger` or `regex` into a `triggers` list,
///   or a `triggers` list into `trigger` or `regex`;
/// - since Phase 4-3, one named shape more: an insertion **group** into
///   `<match>.vars[i].params` itself ([`names_a_params_insertion`]) — the one
///   open mapping a draft may add entries to — whose every entry is a scalar or
///   a flat list of scalars ([`EntryValue::Scalar`], [`EntryValue::ScalarList`];
///   never plain source) and whose every key passes the text rules of ruling 7
///   and is not one of ruling 4's typed settings (`crate::draft::author_key`). A single [`crate::patch::FieldInsert`] there,
///   and any insertion into a deeper or another open mapping, is still refused;
/// - since Phase 4-4, three shapes about `vars`: a mapping-item insertion into
///   `<match>.vars` whose item has a **new variable's shape**
///   ([`is_a_new_variable`]); the same shape as the trailing item list of a
///   group on the match's own mapping, under the key `vars` (the whole subtree,
///   when the match has none); and the removal of one item `<match>.vars[i]` or
///   of the whole entry `<match>.vars`.
///
/// **Nothing deeper than those shapes passes.** A path one segment longer than
/// the deepest legal one fails, and
/// `a_path_one_segment_deeper_than_the_surface_is_refused` is the test that says
/// so rather than the sentence, and
/// `an_insertion_one_segment_deeper_than_params_is_refused` says it for the
/// Phase 4-3 shape.
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
            DocumentEdit::InsertFields(group) => {
                // A trailing item list is `vars` on the match's own mapping,
                // every item a new variable (Phase 4-4), and nothing else.
                let items_fit = match group.item_list() {
                    None => true,
                    Some((key, items)) => {
                        key == VARS_KEY && items.iter().all(|item| is_a_new_variable(item))
                    }
                };
                let own = group.mapping() == mapping
                    && items_fit
                    && group.entries().iter().all(|(key, value)| match value {
                        EntryValue::Scalar(_) | EntryValue::PlainSource(_) => {
                            MatchField::from_key(key).is_some()
                        }
                        EntryValue::ScalarList(_) => SequenceField::from_key(key).is_some(),
                    });
                own || (group.item_list().is_none()
                    && names_a_params_insertion(mapping, group.mapping(), group.entries()))
            }
            DocumentEdit::SubstituteKey(substitution) => {
                names_a_substitution(mapping, substitution.field(), substitution.key())
            }
            DocumentEdit::InsertScalarItems(insert) => {
                names_a_surface_list(mapping, insert.sequence())
            }
            DocumentEdit::RemoveItem(removal) => {
                names_a_surface_list_item(mapping, removal.item())
                    || names_a_variable(mapping, removal.item())
            }
            DocumentEdit::SwitchShape(switch) => {
                names_a_trigger_switch(mapping, switch.field(), switch.key(), switch.value())
            }
            // A mapping-item insert is inside the surface in exactly one shape
            // (Phase 4-4): a new variable written into `<match>.vars`. Into
            // `matches` or any other sequence it is a different operation with
            // a different primitive behind it.
            DocumentEdit::InsertItem(insert) => {
                insert.sequence() == &mapping.clone().with_key(VARS_KEY)
                    && is_a_new_variable(insert.fields())
            }
            // A duplicate is a cardinality change the surface has no shape for.
            // Refused as outside the surface rather than by a name of its own,
            // because that is what it is.
            DocumentEdit::DuplicateItem(_) => false,
            // A local raw-item replacement writes a whole item as authored text
            // (Phase 3-7). It is its own command's edit, never a draft's, and a
            // draft batch holding one is outside the surface by construction.
            DocumentEdit::ReplaceItemText(_) => false,
        };
        if !within {
            return Err(DraftError::OutsideTheClosedSurface { edit: position });
        }
    } // End of the loop over the batch's edits
    Ok(())
} // End of function check_closed_surface()

/// Refuses a batch whose edits depend on one another.
///
/// Ruling 5, in eight checks: **every dependency must resolve in the original
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
/// 6. an anchor the same batch removes — or renames, since a substituted key
///    does not survive the batch under the name the anchor gives it;
/// 7. two insertion **edits** sharing one anchor. Several entries after one
///    anchor are legal as one [`crate::patch::FieldInsertGroup`], which states
///    their order (Phase 3-1); two separate edits state none;
/// 8. a substitution or a shape switch to a key the original mapping already
///    holds;
/// 9. an item insertion landing exactly where the same batch removes an item of
///    the same list (Phase 3-2) — the two replacements would share a start, and
///    nothing in the batch says which comes first;
/// 10. since Phase 4-3, checks 4 to 7 restated for an insertion into a **nested**
///     mapping against the key list `nested` gives for it — plus a key that
///     mapping already holds, or that two insertions of the batch both write
///     there ([`DraftError::InsertionKeyAlreadyPresent`]). A nested insertion
///     into a mapping `nested` does not describe is refused, because its anchor
///     cannot be shown to be original.
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
    check_every_nested_insertion_is_independent(mapping, nested, edits)?;
    check_no_substitution_duplicates_a_key(original_keys, edits)?;
    check_no_insertion_lands_on_a_removal(edits)?;
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
            // A substitution takes the old key away as surely as a removal does,
            // so an edit of the renamed entry's value, a removal of it or a
            // second substitution of it is a second answer about the same entry.
            DocumentEdit::SubstituteKey(substitution) => Some((position, substitution.field())),
            // A shape switch replaces the whole value, so every edit inside it is
            // a second answer too; and an item removal deletes the item's whole
            // subtree (Phase 3-2).
            DocumentEdit::SwitchShape(switch) => Some((position, switch.field())),
            DocumentEdit::RemoveItem(removal) => Some((position, removal.item())),
            _ => None,
        })
        .collect();
    for (removal, field) in &removals {
        for (position, edit) in edits.iter().enumerate() {
            let other = match edit {
                DocumentEdit::Scalar(scalar) => scalar.path(),
                DocumentEdit::RemoveField(nested) => nested.field(),
                DocumentEdit::SubstituteKey(nested) => nested.field(),
                DocumentEdit::SwitchShape(nested) => nested.field(),
                DocumentEdit::RemoveItem(nested) => nested.item(),
                DocumentEdit::InsertScalarItems(nested) => nested.sequence(),
                // A new variable written into a `vars` the batch removes whole
                // is a second answer about that sequence (Phase 4-4).
                DocumentEdit::InsertItem(nested) => nested.sequence(),
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
            DocumentEdit::InsertFields(group) => group
                .sibling()
                .map(|key| (group.mapping().clone(), key.to_owned())),
            DocumentEdit::SubstituteKey(substitution) => named_key_in_parent(substitution.field()),
            DocumentEdit::SwitchShape(switch) => named_key_in_parent(switch.field()),
            // An item edit names the **list's** key in the match mapping: the
            // path through a repeated `triggers:` is ambiguous whatever position
            // follows it.
            DocumentEdit::InsertScalarItems(insert) => named_key_in_parent(insert.sequence()),
            DocumentEdit::RemoveItem(removal) => named_key_in_parent(removal.item()),
            // None of the four names a key in a parent mapping that the surface
            // admits: a move, a duplicate, a mapping-item insertion and a raw
            // item replacement address a **position**, and
            // `check_closed_surface` has already refused all four.
            DocumentEdit::MoveItem(_)
            | DocumentEdit::InsertItem(_)
            | DocumentEdit::DuplicateItem(_)
            | DocumentEdit::ReplaceItemText(_) => None,
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
/// leaves alone, and no two insertion edits share one.
///
/// **It is stated over the match's own mapping only.** An insertion into any
/// other mapping — since Phase 4-3, a variable's `params` — is skipped here, both
/// as an anchor and as a key it inserts, and is judged instead by
/// [`check_every_nested_insertion_is_independent`] against the nested key list
/// the caller gave for that mapping. `original_keys` is the one list an anchor of
/// the match's own mapping has to be found in.
///
/// # A group is one edit, and states its order (Phase 3-1)
///
/// Several entries after one anchor are legal when they are **one**
/// [`crate::patch::FieldInsertGroup`]: its entries are written as one run in the
/// order the group lists them, so nothing but the request decides the file. Two
/// separate insertion edits after one anchor state no order between them and are
/// still [`DraftError::SharedInsertionAnchor`].
///
/// A key a [`crate::patch::KeySubstitution`] or a [`crate::patch::ShapeSwitch`]
/// renames counts as **removed** for an anchor (the key the anchor names is gone
/// after the batch), and the key it renames *to* counts as **inserted** (it is
/// not in the original).
fn check_every_anchor_survives(
    mapping: &DocumentPath,
    original_keys: &[String],
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    let mut inserted: Vec<&str> = Vec::new();
    let mut removed: Vec<&str> = Vec::new();
    for edit in edits {
        match edit {
            DocumentEdit::InsertField(insert) if insert.mapping() == mapping => {
                inserted.push(insert.key())
            }
            DocumentEdit::InsertFields(group) if group.mapping() == mapping => {
                inserted.extend(group.keys());
            }
            DocumentEdit::SubstituteKey(substitution) => {
                inserted.push(substitution.key());
                removed.extend(key_in(mapping, substitution.field()));
            }
            DocumentEdit::SwitchShape(switch) => {
                inserted.push(switch.key());
                removed.extend(key_in(mapping, switch.field()));
            }
            DocumentEdit::RemoveField(removal) => removed.extend(key_in(mapping, removal.field())),
            _ => {}
        }
    } // End of the loop that collects what the batch inserts and removes

    let mut anchors: Vec<(usize, &str)> = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let sibling = match edit {
            DocumentEdit::InsertField(insert) if insert.mapping() == mapping => insert.sibling(),
            DocumentEdit::InsertFields(group) if group.mapping() == mapping => group.sibling(),
            _ => continue,
        };
        // `None` means "the mapping's last entry", which is what
        // `crate::patch::edit::plan_insertion` resolves it to. Resolving it the
        // same way here is what lets this guard judge a batch it did not build.
        let anchor = match sibling {
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

/// One insertion edit of a batch, whichever primitive spells it: the mapping it
/// writes into, its anchor's key (`None` for the mapping's last entry) and the
/// keys it writes, in order.
fn insertion_of(edit: &DocumentEdit) -> Option<(&DocumentPath, Option<&str>, Vec<&str>)> {
    match edit {
        DocumentEdit::InsertField(insert) => {
            Some((insert.mapping(), insert.sibling(), vec![insert.key()]))
        }
        DocumentEdit::InsertFields(group) => Some((group.mapping(), group.sibling(), group.keys())),
        _ => None,
    }
} // End of function insertion_of()

/// Check 10: every insertion into a **nested** mapping is independent of the rest
/// of the batch (Phase 4-3).
///
/// Checks 4 to 7 restated one level down, against the key list `nested` holds for
/// the insertion's own mapping rather than against `original_keys`, plus the one
/// check an author-chosen key adds: the key is not one the mapping already holds,
/// and no two insertions of the batch write the same key into one mapping
/// ([`DraftError::InsertionKeyAlreadyPresent`]). Keys are compared as the decoded
/// texts the lists hold; `nested` is the caller's account, as everywhere here.
///
/// An anchor counts as **removed** when any removal-like edit of the batch names
/// it or an ancestor of it ([`contains`]) — exact where the match-level check
/// over-approximates by first segment, because a nested path has no first
/// segment of its own to stand for it.
fn check_every_nested_insertion_is_independent(
    mapping: &DocumentPath,
    nested: &[NestedKeys],
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    let removals: Vec<&DocumentPath> = edits
        .iter()
        .filter_map(|edit| match edit {
            DocumentEdit::RemoveField(removal) => Some(removal.field()),
            DocumentEdit::SubstituteKey(substitution) => Some(substitution.field()),
            DocumentEdit::SwitchShape(switch) => Some(switch.field()),
            DocumentEdit::RemoveItem(removal) => Some(removal.item()),
            _ => None,
        })
        .collect();
    let mut written: Vec<(&DocumentPath, &str)> = Vec::new();
    let mut anchors: Vec<(usize, &DocumentPath, &str)> = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let Some((target, sibling, keys)) = insertion_of(edit) else {
            continue;
        };
        if target == mapping {
            continue;
        }
        let known = nested
            .iter()
            .find(|entry| entry.mapping() == target)
            .ok_or(DraftError::InsertionAnchorNotInOriginal { edit: position })?;
        for key in keys {
            let repeated = written
                .iter()
                .any(|(held, seen)| *held == target && *seen == key);
            if occurrences(known.keys(), key) > 0 || repeated {
                return Err(DraftError::InsertionKeyAlreadyPresent { edit: position });
            }
            written.push((target, key));
        } // End of the loop over the keys this insertion writes
        let anchor = match sibling {
            Some(key) => key,
            None => known
                .keys()
                .last()
                .map(String::as_str)
                .ok_or(DraftError::InsertionAnchorNotInOriginal { edit: position })?,
        };
        anchors.push((position, target, anchor));
    } // End of the loop over the batch's nested insertions

    for &(position, target, anchor) in &anchors {
        let inserted = written
            .iter()
            .any(|(held, key)| *held == target && *key == anchor);
        if inserted {
            return Err(DraftError::InsertionAnchorIsInserted { edit: position });
        }
        let known = nested
            .iter()
            .find(|entry| entry.mapping() == target)
            .map_or(0, |entry| occurrences(entry.keys(), anchor));
        if known == 0 {
            return Err(DraftError::InsertionAnchorNotInOriginal { edit: position });
        }
        let anchor_path = target.clone().with_key(anchor);
        if removals
            .iter()
            .any(|removal| contains(removal, &anchor_path))
        {
            return Err(DraftError::InsertionAnchorRemoved { edit: position });
        }
        let shared = anchors
            .iter()
            .find(|&&(other, held, key)| other < position && held == target && key == anchor);
        if let Some(&(first, _, _)) = shared {
            return Err(DraftError::SharedInsertionAnchor {
                first,
                second: position,
            });
        }
    } // End of the loop over the nested insertions' anchors
    Ok(())
} // End of function check_every_nested_insertion_is_independent()

/// Check 8: no substitution renames a key to one the original mapping holds.
///
/// Stated over `original_keys`, the caller's account of the mapping, exactly as
/// checks 3 to 7 are; [`crate::patch::apply_edits`] refuses the same batch
/// against the document as [`crate::patch::EditError::KeyAlreadyPresent`].
fn check_no_substitution_duplicates_a_key(
    original_keys: &[String],
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    for edit in edits {
        let key = match edit {
            DocumentEdit::SubstituteKey(substitution) => substitution.key(),
            DocumentEdit::SwitchShape(switch) => switch.key(),
            _ => continue,
        };
        if occurrences(original_keys, key) == 0 {
            continue;
        }
        if let Some(field) = MatchField::from_key(key) {
            return Err(DraftError::SubstitutionTargetPresent { field });
        }
        if let Some(field) = SequenceField::from_key(key) {
            return Err(DraftError::SequenceFieldPresent { field });
        }
    } // End of the loop over the batch's substitutions and switches
    Ok(())
} // End of function check_no_substitution_duplicates_a_key()

/// Check 9: no item insertion lands exactly where the same batch removes an item
/// of the same list (Phase 3-2).
///
/// Read off the placement alone, because this module reads no document: an
/// insertion [`ItemPlacement::Front`] lands where item 0 begins, and one
/// [`ItemPlacement::After`] `k` lands where item `k + 1` begins. A removal of
/// that item starts at the same byte, so the two replacements share a start and
/// neither order is stated. [`ItemPlacement::End`] lands after every item and
/// can meet no removal's start.
fn check_no_insertion_lands_on_a_removal(edits: &[DocumentEdit]) -> Result<(), DraftError> {
    for (position, edit) in edits.iter().enumerate() {
        // A mapping-item insertion (Phase 4-4, a new variable) lands exactly as
        // a scalar-item insertion with the same placement does, and meets a
        // removal's start the same way. It has no list field to name, so it is
        // refused by the two edits' positions.
        if let DocumentEdit::InsertItem(insert) = edit {
            let landing = match insert.placement() {
                ItemPlacement::Front => Some(0),
                ItemPlacement::After(index) => index.checked_add(1),
                ItemPlacement::End => None,
            };
            let removal = landing.and_then(|landing| {
                edits.iter().position(|other| {
                    matches!(other, DocumentEdit::RemoveItem(removal)
                        if removes_item_at(removal.item(), insert.sequence(), landing))
                })
            });
            if let Some(removal) = removal {
                return Err(DraftError::InsertionLandsOnARemoval {
                    insertion: position,
                    removal,
                });
            }
            continue;
        }
        let DocumentEdit::InsertScalarItems(insert) = edit else {
            continue;
        };
        let landing = match insert.placement() {
            ItemPlacement::Front => Some(0),
            ItemPlacement::After(index) => index.checked_add(1),
            ItemPlacement::End => None,
        };
        let Some(landing) = landing else {
            continue;
        };
        let lands_on_a_removal = edits.iter().any(|other| match other {
            DocumentEdit::RemoveItem(removal) => {
                removes_item_at(removal.item(), insert.sequence(), landing)
            }
            _ => false,
        });
        if lands_on_a_removal {
            let field = insert
                .sequence()
                .segments()
                .last()
                .and_then(PathSegment::as_key)
                .and_then(SequenceField::from_key)
                .unwrap_or(SequenceField::Triggers);
            return Err(DraftError::SequenceIntentsConflict { field });
        }
    } // End of the loop over the batch's item insertions
    Ok(())
} // End of function check_no_insertion_lands_on_a_removal()

/// Whether `item` names the item at `landing` of `sequence` itself.
fn removes_item_at(item: &DocumentPath, sequence: &DocumentPath, landing: usize) -> bool {
    item.segments().split_last() == Some((&PathSegment::Index(landing), sequence.segments()))
        && item.document_index() == sequence.document_index()
}

/// Refuses a batch that is not exactly **one move of one local variable within
/// its own `vars`** (Phase 4-4).
///
/// The guard [`crate::draft::plan_variable_move`] passes its own output through,
/// and the one a later writer can pass a hand-built batch through: the batch
/// holds one edit, a [`crate::patch::ItemMove`] whose item is `<match>.vars[i]`.
/// Anything else is [`DraftError::OutsideTheClosedSurface`] at its position.
/// Same-sequence is not a separate claim: an [`crate::patch::ItemMove`] names
/// one item and a destination **index in that item's own sequence**, so it has
/// no spelling of another sequence (D2r). Whether the move combines with other
/// edits is the engine's question and answer
/// ([`crate::patch::EditError::MoveMustBeTheOnlyEditInItsBatch`], R25); a batch
/// of more than one edit fails here first, at the second edit's position.
pub fn check_variable_move(
    mapping: &DocumentPath,
    edits: &[DocumentEdit],
) -> Result<(), DraftError> {
    for (position, edit) in edits.iter().enumerate() {
        let within = position == 0
            && matches!(edit, DocumentEdit::MoveItem(movement)
                if names_a_variable(mapping, movement.item()));
        if !within {
            return Err(DraftError::OutsideTheClosedSurface { edit: position });
        }
    } // End of the loop over the batch's edits
    Ok(())
} // End of function check_variable_move()

/// Whether `path` names one variable of the match's own `vars`:
/// `<match>.vars[i]` (Phase 4-4).
fn names_a_variable(mapping: &DocumentPath, path: &DocumentPath) -> bool {
    matches!(suffix(mapping, path), Some([PathSegment::Key(vars), PathSegment::Index(_)])
        if vars == VARS_KEY)
}

/// Whether the fields of a new mapping item have the **shape of a new
/// variable** as [`crate::draft::NewVariable`] writes one (Phase 4-4).
///
/// Read off the fields alone, as every check here is:
///
/// - the keys are a subsequence of `name`, `type`, `depends_on`,
///   `inject_vars`, `params`, **in that order**, each at most once, and `name`
///   and `type` are both present;
/// - `name` is a logical-string scalar, and `type` a logical-string scalar
///   naming one of espanso's nine kinds ([`VariableKind::from_text`]);
/// - `depends_on` is a flat list of scalars and `inject_vars` a plain-source
///   scalar (ruling 4);
/// - `params` is one mapping with at least one entry, every key passing ruling
///   7's text rules, every value a scalar or a flat list of scalars, and a
///   plain-source value **only** — and always — under `offset`, `trim` or
///   `debug`; `multiline` and `trim_string_values` are refused outright, since
///   no new variable writes them.
fn is_a_new_variable(fields: &[(String, ItemValue)]) -> bool {
    let mut next = 0usize;
    for (key, _) in fields {
        match NEW_VARIABLE_KEYS[next..]
            .iter()
            .position(|held| held == key)
        {
            Some(offset) => next += offset + 1,
            None => return false,
        }
    } // End of the loop that checks the keys are in the written order
    let has = |wanted: &str| fields.iter().any(|(key, _)| key == wanted);
    if !has(NAME_KEY) || !has(TYPE_KEY) {
        return false;
    }
    fields
        .iter()
        .all(|(key, value)| match (key.as_str(), value) {
            (NAME_KEY, ItemValue::Entry(EntryValue::Scalar(_))) => true,
            (TYPE_KEY, ItemValue::Entry(EntryValue::Scalar(text))) => !matches!(
                VariableKind::from_text(text),
                VariableKind::Unrecognised | VariableKind::Absent
            ),
            (DEPENDS_ON_KEY, ItemValue::Entry(EntryValue::ScalarList(_))) => true,
            (INJECT_VARS_KEY, ItemValue::Entry(EntryValue::PlainSource(_))) => true,
            (PARAMS_KEY, ItemValue::Mapping(entries)) => {
                !entries.is_empty()
                    && entries.iter().all(|(key, value)| {
                        let plain_key = PLAIN_SOURCE_PARAMS.contains(&key.as_str());
                        author_key_fault(key).is_none()
                            && match value {
                                EntryValue::PlainSource(_) => plain_key,
                                EntryValue::Scalar(_) | EntryValue::ScalarList(_) => {
                                    !TYPED_SETTINGS.contains(&key.as_str())
                                }
                            }
                    })
            }
            _ => false,
        })
} // End of function is_a_new_variable()

/// Whether `path` names one of the match's two lists itself:
/// `<match>.<triggers|search_terms>`.
fn names_a_surface_list(mapping: &DocumentPath, path: &DocumentPath) -> bool {
    matches!(suffix(mapping, path), Some([PathSegment::Key(key)])
        if SequenceField::from_key(key).is_some())
}

/// Whether `path` names one item of the match's two lists:
/// `<match>.<triggers|search_terms>[i]`.
fn names_a_surface_list_item(mapping: &DocumentPath, path: &DocumentPath) -> bool {
    matches!(suffix(mapping, path), Some([PathSegment::Key(key), PathSegment::Index(_)])
        if SequenceField::from_key(key).is_some())
}

/// Whether a shape switch turns a scalar trigger form of `mapping` itself into a
/// `triggers` list, or a `triggers` list into a scalar trigger form.
fn names_a_trigger_switch(
    mapping: &DocumentPath,
    path: &DocumentPath,
    key: &str,
    value: &EntryValue,
) -> bool {
    let Some([PathSegment::Key(old)]) = suffix(mapping, path) else {
        return false;
    };
    let is_trigger_form = |key: &str| {
        matches!(
            MatchField::from_key(key),
            Some(MatchField::Trigger | MatchField::Regex)
        )
    };
    let is_triggers = |key: &str| SequenceField::from_key(key) == Some(SequenceField::Triggers);
    match value {
        EntryValue::ScalarList(_) => is_trigger_form(old) && is_triggers(key),
        // A shape switch refuses a plain-source value at planning, so naming
        // one here authorises nothing the engine would write.
        EntryValue::Scalar(_) | EntryValue::PlainSource(_) => {
            is_triggers(old) && is_trigger_form(key)
        }
    }
} // End of function names_a_trigger_switch()

/// Whether an insertion group names the one open mapping a draft may add entries
/// to — `<match>.vars[i].params` itself, never a path below it — with entries
/// this surface can write there (Phase 4-3).
///
/// Every entry must be an [`EntryValue::Scalar`] or an [`EntryValue::ScalarList`]
/// (an author-named parameter is a logical string or a list of them; plain
/// source is not offered there), every key must pass the text rules of ruling 7
/// (`crate::draft::author_key`), and no key may be one of ruling 4's typed
/// settings, whose policy is a later step's. Duplicates are a batch-dependency
/// question and are judged by [`check_batch_independence`].
fn names_a_params_insertion(
    mapping: &DocumentPath,
    target: &DocumentPath,
    entries: &[(String, EntryValue)],
) -> bool {
    let is_params = matches!(
        suffix(mapping, target),
        Some([PathSegment::Key(vars), PathSegment::Index(_), PathSegment::Key(params)])
            if vars == VARS_KEY && params == PARAMS_KEY
    );
    is_params
        && entries.iter().all(|(key, value)| {
            author_key_fault(key).is_none()
                && !TYPED_SETTINGS.contains(&key.as_str())
                && matches!(value, EntryValue::Scalar(_) | EntryValue::ScalarList(_))
        })
} // End of function names_a_params_insertion()

/// Whether a substitution renames a schema-known scalar key of `mapping` itself
/// to another form of the same family.
fn names_a_substitution(mapping: &DocumentPath, path: &DocumentPath, key: &str) -> bool {
    let Some([PathSegment::Key(old)]) = suffix(mapping, path) else {
        return false;
    };
    match (MatchField::from_key(old), MatchField::from_key(key)) {
        (Some(from), Some(to)) => FieldSubstitution::between(from, to).is_some(),
        _ => false,
    }
} // End of function names_a_substitution()

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
/// The shapes that end in a key segment: a schema-known scalar field of the
/// match, one of its two lists as a whole field (Phase 3-2), the whole `vars`
/// entry as an explicit container removal (Phase 4-4), a variable's
/// schema-known scalar, one entry of a variable's `params`, and one option of one
/// form field. A path ending in an index names a sequence element instead, and a
/// [`crate::patch::FieldRemoval`] of one is refused here; an item of the two
/// lists is removed by a [`crate::patch::RemoveItem`], which
/// [`check_closed_surface`] judges on its own.
fn names_a_surface_field(mapping: &DocumentPath, path: &DocumentPath) -> bool {
    let Some(tail) = suffix(mapping, path) else {
        return false;
    };
    match tail {
        [PathSegment::Key(key)] => {
            MatchField::from_key(key).is_some()
                || SequenceField::from_key(key).is_some()
                || key == VARS_KEY
        }
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
    } // End of the match over the six shapes a removable entry takes
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
