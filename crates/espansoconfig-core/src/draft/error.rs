//! Why a draft was refused, by name.

use std::fmt;

use serde::Serialize;

use crate::draft::match_draft::{DraftTarget, MatchField, SequenceField};
use crate::model::ValueKind;
use crate::syntax::HazardKind;

/// Why [`crate::draft::plan_match_edits`] would not derive a batch.
///
/// These are **diagnostics, not user-facing prose**, exactly as
/// [`crate::patch::EditError`] and [`crate::patch::PathError`] already are:
/// every string a user reads goes through the frontend i18n layer (plan
/// section 9), and no dictionary entry is added by the sub-phase that invents
/// the enum — it is added by the sub-phase that puts it on a screen.
///
/// **No variant carries a byte of the document.** A [`MatchField`] is a key
/// espanso's schema fixes and is safe to name; the text of a key the schema does
/// not fix, and the text of any value, is the owner's private configuration
/// (`CLAUDE.md` section 1) and is deliberately absent even where it would make a
/// message friendlier. Positions, indexes, counts and kinds only.
///
/// # It serializes; it does not deserialize
///
/// A refusal travels **out**. Nothing hands one back, so there is no
/// `Deserialize`, which also keeps this enum free of the question
/// [`crate::persist::Acknowledgement`] had to answer about payloads arriving
/// from outside. [`HazardKind`] serializes and does not deserialize either, so
/// the two agree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum DraftError {
    /// The match carries no [`crate::patch::DocumentPath`], so nothing in it can
    /// be addressed.
    ///
    /// Unreachable for a match reached through `matches`; refused rather than
    /// invented, because the alternative is a path that names something else.
    MatchHasNoPath,
    /// The hazard gate refuses this match.
    ///
    /// `hazard` is the hazard the projection named, and `None` means the
    /// projection said "not safely editable" without naming one — the two are
    /// one answer in [`crate::syntax::TriviaIndex::disqualifying_hazard`], and
    /// both are carried so that a view whose two fields disagree cannot be
    /// planned against.
    ///
    /// This is an **early** refusal. [`crate::patch::apply_edits`] consults the
    /// same gate at the mutation site, and that consultation is the one that
    /// keeps a file safe; this one exists so a caller learns before it builds a
    /// save transaction.
    MatchNotEditable {
        /// What the gate objected to, when it named something.
        hazard: Option<HazardKind>,
    },
    /// The match mapping writes one key more than once, so no path through it
    /// names one node.
    ///
    /// `field` is the repeated key when it is one this surface models, and
    /// `None` when it is not — the text of such a key is the owner's
    /// configuration and is not carried.
    ///
    /// Checked **before** the hazard gate, because this function's whole output
    /// is paths and a path that names two nodes is not a path. The gate refuses
    /// the same mapping a step later ([`HazardKind::DuplicateMappingKey`]), so
    /// the ordering decides the *name* of the refusal rather than whether there
    /// is one, and the specific name is the useful one.
    AmbiguousKey {
        /// The repeated key, when this surface models it.
        field: Option<MatchField>,
    },
    /// The existing scalar's projected text is a **raw source slice**, not a
    /// logical value, so the drafted value cannot be compared against it.
    ///
    /// [`crate::model::ScalarView::decoded`] is `false` when decoding failed;
    /// its `text` then holds the bytes as written. Comparing a logical value
    /// with those bytes would call an unchanged field changed — or, worse, a
    /// changed field unchanged — so the draft is refused rather than guessed at.
    NotDecodable {
        /// What the draft named.
        target: DraftTarget,
    },
    /// The drafted element exists but is not a scalar node.
    ///
    /// An element of `triggers` or `search_terms` that the file writes as a
    /// collection is projected as [`crate::model::ValueView::Elided`], in place.
    /// Replacing it with a scalar is a structural change, not a scalar-node
    /// replacement.
    NotAScalar {
        /// What the draft named.
        target: DraftTarget,
    },
    /// A [`crate::draft::DraftField::Set`] names a key the file already holds
    /// with a shape the schema does not use, so the projection did not model it.
    ///
    /// The trap this variant exists for: the view's field is `None` for such an
    /// entry, exactly as it is for an absent one, and treating that `None` as
    /// "absent" would derive an **insertion of a key the mapping already has**.
    ///
    /// Writing a scalar over it is not expressible either way: no primitive
    /// replaces a collection node with a scalar one, and *remove then insert* is
    /// not a spelling of it, because the insertion is planned against the
    /// original index, where the key is still there.
    ///
    /// A [`crate::draft::DraftField::Remove`] of the same key is refused by
    /// [`DraftError::RemovalWouldDiscardUnshownStructure`], which says why in its
    /// own name.
    FieldHasAnUnmodelledShape {
        /// The key.
        field: MatchField,
        /// What its value actually is.
        found: ValueKind,
    },
    /// A [`crate::draft::DraftField::Remove`] names a key whose value this
    /// editor never displayed.
    ///
    /// **The primitive could do it, and that is exactly the problem.**
    /// [`crate::patch::FieldRemoval`] deletes a whole entry — key, value and
    /// every byte of the subtree under it — so removing a `replace:` that holds
    /// a nested mapping would discard structure the visual editor never put on a
    /// screen. Deleting bytes the user was never shown is the class of silent
    /// destruction this application refuses on principle, so the refusal is a
    /// decision rather than a consequence of the shape check that finds it.
    ///
    /// It is **not** a statement that the shape is unmodellable, and it is not
    /// permanent: a phase that shows such a subtree, or that asks for it by name,
    /// may grant the power its own way. This one does not.
    RemovalWouldDiscardUnshownStructure {
        /// The key.
        field: MatchField,
        /// What its value actually is.
        found: ValueKind,
    },
    /// The drafted value would have to be written where the file has no bytes.
    ///
    /// An entry written `label:` has a **zero-width** value node positioned
    /// before its own colon (`PROGRESS.md` R7), so a span replacement there
    /// would splice the value onto the wrong side of the punctuation. Giving
    /// such an entry a value is a structural edit this surface does not make.
    TargetOwnsNoBytes {
        /// What the draft named.
        target: DraftTarget,
    },
    /// The draft names an element the sequence does not have.
    ///
    /// **A cardinality change.** Adding an element to `triggers` or
    /// `search_terms` needs a sequence-item insertion, and
    /// [`crate::patch::DocumentEdit`] has no such variant; forcing one into
    /// existence here is 2b-2c's problem, not this phase's.
    SequenceItemDoesNotExist {
        /// Which sequence.
        field: SequenceField,
        /// The index the draft named.
        index: usize,
        /// How many elements the sequence has.
        length: usize,
    },
    /// The draft asks for an element of a sequence to be taken away.
    ///
    /// **A cardinality change**, refused for the same reason as
    /// [`DraftError::SequenceItemDoesNotExist`]: a sequence item's removal is
    /// not one of the four primitives.
    SequenceItemRemoval {
        /// Which sequence.
        field: SequenceField,
        /// The index the draft named.
        index: usize,
    },
    /// Two drafted elements of one sequence name the same index.
    ///
    /// **Checked at intent level, before any diffing**, and that is the whole
    /// point of it. A draft is one intention, not a script: field order must not
    /// imply edit sequencing (`PROGRESS.md` R5, and
    /// [`crate::draft::MatchField::ALL`]'s own note). Two intents about one
    /// element are therefore not "the last one wins" — they are a draft that
    /// says two things and cannot be honoured.
    ///
    /// A batch-level check cannot state this. An intent that sets an element to
    /// the value it already holds derives **no edit**, so by the time
    /// [`crate::draft::check_batch_independence`] sees the batch, that intent has
    /// been erased and only the other one is left — a batch of one edit, which is
    /// indistinguishable from a draft that only ever said one thing. The
    /// erasure is correct; auditing after it is what would be too late.
    ///
    /// `first` and `second` are positions in the **draft's own list** for this
    /// sequence, not in any batch: there is no batch when this fires.
    SequenceItemDraftedTwice {
        /// Which sequence.
        field: SequenceField,
        /// The index both intents name.
        index: usize,
        /// Position of the first intent in the draft's list for this sequence.
        first: usize,
        /// Position of the second.
        second: usize,
    },
    /// A new entry has no original sibling to be written after.
    ///
    /// Every insertion is written after an existing entry (see
    /// [`crate::patch::FieldInsert`]), and this planner takes that entry from
    /// the ones the projection lets it see. A match whose only entries are ones
    /// this surface cannot name gives it none.
    NoInsertionAnchor {
        /// The field that was to be inserted.
        field: MatchField,
    },
    /// An insertion is anchored after an entry the same batch removes.
    ///
    /// Ruling 5: an anchor must be an original sibling **unaffected by the
    /// batch**. Re-anchoring would silently write the new key somewhere the
    /// caller cannot predict from the document it is looking at, so the batch is
    /// refused and a caller that wants both changes saves twice.
    InsertionAnchorRemoved {
        /// Position of the insertion in the batch.
        edit: usize,
    },
    /// An insertion is anchored after a key the same batch inserts.
    ///
    /// That key is not in the original index, and the batch is planned against
    /// the original index, so the anchor names nothing.
    InsertionAnchorIsInserted {
        /// Position of the insertion in the batch.
        edit: usize,
    },
    /// An insertion is anchored after a key the original mapping does not have.
    InsertionAnchorNotInOriginal {
        /// Position of the insertion in the batch.
        edit: usize,
    },
    /// Two insertions would be written after the same original entry.
    ///
    /// Both are zero-width replacements at one offset, so their order would
    /// decide the file and nothing in the batch states one.
    /// [`crate::patch::apply_edits`] refuses two replacements that share a start
    /// outright; this names the same refusal earlier, in the draft's own
    /// vocabulary.
    SharedInsertionAnchor {
        /// Position of the first insertion in the batch.
        first: usize,
        /// Position of the second.
        second: usize,
    },
    /// A removal and another edit name overlapping bytes.
    ///
    /// Removing an entry deletes its whole subtree, so editing a scalar inside
    /// that subtree — or removing something inside it — is two edits with one
    /// answer between them.
    RemovalContainsAnEdit {
        /// Position of the removal in the batch.
        removal: usize,
        /// Position of the edit it contains.
        edit: usize,
    },
    /// Two edits of a **batch** rewrite the same scalar.
    ///
    /// Stated over a batch, so it is reached by a batch this engine did not
    /// build. [`crate::draft::plan_match_edits`] cannot produce one any more:
    /// two schema-known fields name two keys, and two intents about one sequence
    /// element are refused earlier and by intent
    /// ([`DraftError::SequenceItemDraftedTwice`]).
    ScalarEditedTwice {
        /// Position of the first edit in the batch.
        first: usize,
        /// Position of the second.
        second: usize,
    },
    /// The batch names a node outside the closed scalar surface of this match.
    ///
    /// The guard that states ruling 3's invariant: this engine may modify or
    /// remove existing addressable nodes and may insert **scalar-valued**
    /// mapping entries, and it may never change a sequence's cardinality or
    /// synthesize a collection node.
    OutsideTheClosedSurface {
        /// Position of the edit in the batch.
        edit: usize,
    },
    /// The batch holds a move.
    ///
    /// A drafted batch never moves anything: `PROGRESS.md` R25 says a move may
    /// not be combined with any other edit, and this engine's whole output is a
    /// combination.
    MoveIsNotADraftEdit {
        /// Position of the edit in the batch.
        edit: usize,
    },
}

impl fmt::Display for DraftError {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DraftError::MatchHasNoPath => formatter.write_str("the match has no path"),
            DraftError::MatchNotEditable { .. } => {
                formatter.write_str("the gate refuses the match")
            }
            DraftError::AmbiguousKey { .. } => formatter.write_str("a key is written twice"),
            DraftError::NotDecodable { .. } => {
                formatter.write_str("the existing scalar did not decode")
            }
            DraftError::NotAScalar { .. } => formatter.write_str("the target is not a scalar"),
            DraftError::FieldHasAnUnmodelledShape { found, .. } => {
                write!(formatter, "the field holds a {found:?}")
            }
            DraftError::RemovalWouldDiscardUnshownStructure { found, .. } => {
                write!(formatter, "removing it would discard a {found:?}")
            }
            DraftError::TargetOwnsNoBytes { .. } => formatter.write_str("the target owns no bytes"),
            DraftError::SequenceItemDoesNotExist { index, length, .. } => {
                write!(formatter, "no element {index} of {length}")
            }
            DraftError::SequenceItemRemoval { index, .. } => {
                write!(formatter, "element {index} may not be deleted")
            }
            DraftError::SequenceItemDraftedTwice {
                index,
                first,
                second,
                ..
            } => write!(
                formatter,
                "intents {first} and {second} both name element {index}"
            ),
            DraftError::NoInsertionAnchor { .. } => formatter.write_str("no insertion anchor"),
            DraftError::InsertionAnchorRemoved { edit } => {
                write!(formatter, "edit {edit}'s anchor is removed")
            }
            DraftError::InsertionAnchorIsInserted { edit } => {
                write!(formatter, "edit {edit}'s anchor is inserted")
            }
            DraftError::InsertionAnchorNotInOriginal { edit } => {
                write!(formatter, "edit {edit}'s anchor is not original")
            }
            DraftError::SharedInsertionAnchor { first, second } => {
                write!(formatter, "edits {first} and {second} share an anchor")
            }
            DraftError::RemovalContainsAnEdit { removal, edit } => {
                write!(formatter, "removal {removal} contains edit {edit}")
            }
            DraftError::ScalarEditedTwice { first, second } => {
                write!(formatter, "edits {first} and {second} share a scalar")
            }
            DraftError::OutsideTheClosedSurface { edit } => {
                write!(formatter, "edit {edit} is outside the surface")
            }
            DraftError::MoveIsNotADraftEdit { edit } => write!(formatter, "edit {edit} is a move"),
        } // End of the match over every refusal
    } // End of function fmt() for DraftError
}

impl std::error::Error for DraftError {}
