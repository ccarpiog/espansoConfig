//! Why a draft was refused, by name.

use std::fmt;

use serde::Serialize;

use crate::draft::match_draft::{DraftTarget, MatchField, SequenceField, VariableField};
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
    ///
    /// **The empty braces are load-bearing.** Written as a unit variant this
    /// would be the one variant of thirty-two that `serde` writes as a bare
    /// JSON string rather than as a one-key object, and the frontend's
    /// `COMMAND_ERROR_OPERANDS` table in `src/lib/ipc/errors.ts` can pin exactly
    /// one shape for the `error` operand of `CommandError::DraftRefused`. A
    /// refusal that did not match the pinned shape would be classified as an
    /// *unexpected* failure, losing its typed code and rendering a generic
    /// sentence instead of `code.draftError.matchHasNoPath`. As an empty struct
    /// variant it writes `{"MatchHasNoPath": {}}`, so "a `DraftError` is always
    /// an object" is true by construction rather than true of thirty-one cases
    /// out of thirty-two. `every_draft_error_variant_crosses_as_an_object` in
    /// `src-tauri/src/wire_contract.rs` fails the build if a unit variant is
    /// ever added here.
    MatchHasNoPath {},
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
    /// The draft names a variable, a `params` entry, a `form_fields` entry, one
    /// of its options or one element of a sequence that the projection does not
    /// hold.
    ///
    /// **The open half's cardinality refusal, and a decision as much as a
    /// shape** (2b-2b-2's D1). Below the match mapping this engine inserts
    /// nothing at all: writing an author-chosen key would be the first time it
    /// composes a key string that no schema fixes, which needs its own anchor
    /// machinery, its own emission checks and its own review. So a drafted
    /// address the projection cannot resolve is refused by name rather than
    /// created — and the address is an **index**, never a key text
    /// (`CLAUDE.md` section 1).
    ///
    /// `length` is how many entries or elements the container actually holds. A
    /// value whose shape is not the one the draft addressed reports `0`: an
    /// entry that is not a sequence has no elements to name, and a
    /// `form_fields` entry that is not a mapping has no options.
    TargetDoesNotExist {
        /// What the draft named.
        target: DraftTarget,
        /// How many the container holds.
        length: usize,
    },
    /// A drafted variable carries no [`crate::patch::DocumentPath`], so nothing
    /// inside it can be addressed.
    ///
    /// The nested twin of [`DraftError::MatchHasNoPath`], and unreachable for
    /// the same reason: a variable reached through a match reached through
    /// `matches` always has one. Refused rather than invented, because the
    /// alternative is a path that names something else.
    VariableHasNoPath {
        /// The variable's index in the projected `vars` list.
        index: usize,
    },
    /// A drafted variable's **own** mapping writes one of the keys it models more
    /// than once, so no path through that mapping names one node.
    ///
    /// The nested twin of [`DraftError::AmbiguousKey`], stated one level down and
    /// refused for the same reason: paths are this engine's whole output, and a
    /// path that names two nodes is not a path.
    ///
    /// **It is not a wrong-node write, and it is refused anyway.** The projection
    /// claims the *first* occurrence of a repeated key and
    /// `crate::patch::path::resolve` takes the first as well, so the bytes an edit
    /// would rewrite are the bytes the interface displayed. espanso's own loader
    /// reads the **last** occurrence, so the honest description of the state is
    /// *the user would edit a value their expansion never reads* — silently, while
    /// the identical shape one level up is refused by name. Naming it is the whole
    /// point.
    ///
    /// **The address is the variable's index and nothing else.** A
    /// [`crate::model::UnknownReason::RepeatedKey`] is only ever recorded for a key
    /// espanso's schema fixes, so this one variant *could* have carried the key
    /// text safely. It does not, because every address below the match mapping is
    /// an index (2b-2b-2's decision D1) and a privacy rule with one exception is a
    /// rule nobody can check (`CLAUDE.md` section 1).
    ///
    /// # No projected document reaches it today
    ///
    /// Stated here rather than only in the tests, because a later phase owes this
    /// variant a dictionary string and would otherwise be writing a sentence for a
    /// code no user can see. A repeated key raises
    /// [`HazardKind::DuplicateMappingKey`] on the mapping that holds
    /// it, and `TriviaIndex::disqualifying_hazard` counts a hazard on a
    /// **descendant**, so a duplicate inside a variable disqualifies the whole match
    /// and [`DraftError::MatchNotEditable`] is what a caller actually gets. This
    /// variant is the *nested* answer standing behind that coarse one, for the same
    /// reason `check_closed_surface` restates an invariant the planner already
    /// enforces: the gate in front of it is a gate a later phase may narrow, and on
    /// the day it does, the refusal has to already be here and already say which
    /// variable. `one_match_with_its_duplicate_admitted` in `tests/draft_plan.rs`
    /// **asserts** the gate still refuses first, so this paragraph cannot rot
    /// quietly.
    AmbiguousVariableKey {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// The draft names one of a variable's three schema-known scalars and the
    /// projection holds no scalar for it.
    ///
    /// Two facts reach this refusal and both are refusals for the same reason:
    /// the key is **absent**, or it is present holding a shape espanso's schema
    /// does not use, in which case the projection recorded it as an unknown
    /// entry rather than as a scalar. Neither can be honoured here — this phase
    /// inserts nothing below the match mapping (D1), and no primitive replaces a
    /// collection node with a scalar one.
    VariableFieldHasNoScalar {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which of the three.
        field: VariableField,
    },
    /// One [`crate::draft::EntryDraft`] drafts both a scalar and a sequence.
    ///
    /// **Two answers to one question**, refused at intent level and before any
    /// diffing for [`DraftError::SequenceItemDraftedTwice`]'s reason: an entry's
    /// value is one node, and a draft that describes it twice is not a smaller
    /// version of a draft that describes it once.
    EntryDraftsAScalarAndASequence {
        /// What the draft named.
        target: DraftTarget,
    },
    /// The entry the draft names is introduced by a key no path segment can
    /// spell.
    ///
    /// Two shapes reach it. A **non-scalar key** — an alias, or a collection
    /// used as a key — has [`crate::model::FieldView::key`] `None` and can never
    /// be matched by a [`crate::patch::PathSegment::Key`]. A key whose
    /// [`crate::model::ScalarView::decoded`] is `false` holds its raw source
    /// bytes rather than a decoded value, and the resolver compares decoded key
    /// values, so those bytes are not the key the path would look for.
    ///
    /// The entry is not lost — the projection carries it either way — it is
    /// simply not addressable, and inventing an address for it is what this
    /// refusal exists instead of.
    TargetIsNotNameable {
        /// What the draft named.
        target: DraftTarget,
    },
    /// Two entries of **one** open mapping decode to the same key text, so no
    /// path names one of them.
    ///
    /// The nested analogue of [`DraftError::AmbiguousKey`], and it carries
    /// indices rather than the key (`CLAUDE.md` section 1).
    /// `crate::patch::path::resolve` resolves a key to the **first** entry that
    /// carries it, so a batch naming a repeated key addresses one occurrence and
    /// reads as though it addressed the other.
    TargetKeyIsAmbiguous {
        /// What the draft named.
        target: DraftTarget,
        /// The index of the other entry of that mapping carrying the same key.
        other: usize,
    },
    /// A [`crate::draft::DraftField::Set`] names an entry whose existing value
    /// is a collection.
    ///
    /// The nested twin of [`DraftError::FieldHasAnUnmodelledShape`], and it is
    /// inexpressible for the same reason: no primitive replaces a collection
    /// node with a scalar one, and *remove then insert* is not a spelling of it,
    /// because an insertion is planned against the original index where the key
    /// is still present — and because this phase inserts nothing below the match
    /// mapping at all (D1).
    NestedValueIsACollection {
        /// What the draft named.
        target: DraftTarget,
        /// What its value actually is.
        found: crate::model::ValueKind,
    },
    /// A [`crate::draft::DraftField::Remove`] names an entry whose value this
    /// editor never displayed.
    ///
    /// The nested twin of
    /// [`DraftError::RemovalWouldDiscardUnshownStructure`], refused as the same
    /// **decision**: [`crate::patch::FieldRemoval`] could do it — it deletes the
    /// whole entry, subtree included — and deleting bytes the user was never
    /// shown is the class of silent destruction this application refuses on
    /// principle.
    NestedRemovalWouldDiscardUnshownStructure {
        /// What the draft named.
        target: DraftTarget,
        /// What its value actually is.
        found: crate::model::ValueKind,
    },
    /// The draft asks for one element of a nested sequence to be taken away.
    ///
    /// **A cardinality change**, refused for
    /// [`DraftError::SequenceItemRemoval`]'s reason: a sequence item's removal
    /// is not one of the four primitives.
    NestedItemRemoval {
        /// What the draft named.
        target: DraftTarget,
    },
    /// Two intents of the draft name one index of one nested list.
    ///
    /// **Checked at intent level, before any diffing**, and that is the whole
    /// point of it — see [`DraftError::SequenceItemDraftedTwice`], whose
    /// reasoning this variant inherits unchanged. It covers two drafted
    /// variables at one index, two `params` entries at one index within one
    /// variable, two `form_fields` entries at one index, two options at one index
    /// within one form field, and two elements at one index within one nested
    /// sequence.
    ///
    /// `first` and `second` are positions in the **draft's own list**, not in
    /// any batch: there is no batch when this fires.
    TargetDraftedTwice {
        /// What both intents name.
        target: DraftTarget,
        /// Position of the first intent in the draft's list.
        first: usize,
        /// Position of the second.
        second: usize,
    },
    /// The batch names a key that a **nested** mapping it reaches into writes
    /// more than once.
    ///
    /// The guard-level twin of [`DraftError::TargetKeyIsAmbiguous`], stated over
    /// a batch and reachable by a batch this engine did not build. It carries a
    /// position in the batch and nothing else, because the key that is repeated
    /// is one no schema fixes (`CLAUDE.md` section 1).
    AmbiguousNestedKey {
        /// Position of the edit in the batch.
        edit: usize,
    },
}

impl fmt::Display for DraftError {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DraftError::MatchHasNoPath {} => formatter.write_str("the match has no path"),
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
            DraftError::TargetDoesNotExist { length, .. } => {
                write!(formatter, "the target is not among the {length} there are")
            }
            DraftError::VariableHasNoPath { index } => {
                write!(formatter, "variable {index} has no path")
            }
            DraftError::AmbiguousVariableKey { variable } => {
                write!(formatter, "variable {variable} writes a key twice")
            }
            DraftError::VariableFieldHasNoScalar { variable, .. } => {
                write!(formatter, "variable {variable} holds no such scalar")
            }
            DraftError::EntryDraftsAScalarAndASequence { .. } => {
                formatter.write_str("one entry is drafted as a scalar and as a sequence")
            }
            DraftError::TargetIsNotNameable { .. } => {
                formatter.write_str("no path segment names the entry's key")
            }
            DraftError::TargetKeyIsAmbiguous { other, .. } => {
                write!(formatter, "entry {other} carries the same key")
            }
            DraftError::NestedValueIsACollection { found, .. } => {
                write!(formatter, "the entry holds a {found:?}")
            }
            DraftError::NestedRemovalWouldDiscardUnshownStructure { found, .. } => {
                write!(formatter, "removing it would discard a {found:?}")
            }
            DraftError::NestedItemRemoval { .. } => {
                formatter.write_str("a nested element may not be deleted")
            }
            DraftError::TargetDraftedTwice { first, second, .. } => {
                write!(formatter, "intents {first} and {second} name one target")
            }
            DraftError::AmbiguousNestedKey { edit } => {
                write!(formatter, "edit {edit} names a repeated nested key")
            }
        } // End of the match over every refusal
    } // End of function fmt() for DraftError
}

impl std::error::Error for DraftError {}
