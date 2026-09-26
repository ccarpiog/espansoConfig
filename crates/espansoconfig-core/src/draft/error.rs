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
    /// would be the one variant of ninety-eight that `serde` writes as a bare
    /// JSON string rather than as a one-key object, and the frontend's
    /// `COMMAND_ERROR_OPERANDS` table in `src/lib/ipc/errors.ts` can pin exactly
    /// one shape for the `error` operand of `CommandError::DraftRefused`. A
    /// refusal that did not match the pinned shape would be classified as an
    /// *unexpected* failure, losing its typed code and rendering a generic
    /// sentence instead of `code.draftError.matchHasNoPath`. As an empty struct
    /// variant it writes `{"MatchHasNoPath": {}}`, so "a `DraftError` is always
    /// an object" is true by construction rather than true of ninety-seven cases
    /// out of ninety-eight. `every_draft_error_variant_crosses_as_an_object` in
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
    /// An [`crate::draft::ItemDraft`] rewrites an element that is there; adding
    /// one is a [`crate::draft::SequenceIntent::InsertItems`] (Phase 3-2), a
    /// different intent. The same refusal answers a list intent whose index —
    /// an item to remove, an item to insert after — the list does not have.
    SequenceItemDoesNotExist {
        /// Which sequence.
        field: SequenceField,
        /// The index the draft named.
        index: usize,
        /// How many elements the sequence has.
        length: usize,
    },
    /// The draft asks, through an [`crate::draft::ItemDraft`], for an element
    /// of a sequence to be taken away.
    ///
    /// **Still refused on this path.** Since Phase 3-2 an item of `triggers` or
    /// `search_terms` can be removed, but only as a
    /// [`crate::draft::SequenceIntent::RemoveItem`] passed to
    /// [`crate::draft::plan_match_edits_with`]; `ItemDraft::value` keeps meaning
    /// *rewrite this element*, and its `Remove` stays a refusal so that the wire
    /// shape of [`crate::draft::MatchDraft`] does not change meaning before a UI
    /// step decides it.
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
    /// batch**. A batch that names such an anchor is refused rather than
    /// re-anchored, because re-anchoring would write the new key somewhere the
    /// batch did not say. Since Phase 3-1 [`crate::draft::plan_match_edits`]
    /// chooses a surviving anchor itself, so this is reached by a batch this
    /// engine did not build — and a key a substitution renames counts as
    /// removed.
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
    /// vocabulary. Several entries after one anchor are legal as **one**
    /// [`crate::patch::FieldInsertGroup`], which states their order; since Phase
    /// 3-1 the planner writes several absent fields that way, so this is reached
    /// by a batch this engine did not build.
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
    /// synthesize a collection node — except the scalar items and the presence
    /// of `triggers` and `search_terms`, which Phase 3-2 admits and nothing
    /// else's.
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
    /// shape** (2b-2b-2's D1). Below the match mapping a drafted *address* is
    /// never turned into an insertion. The one insertion there since Phase 4-3 —
    /// a new author-named `params` entry — is requested explicitly through
    /// [`crate::draft::VariableDraft::insert_params`] under its own rules, and
    /// is never inferred from an address that did not resolve. So a drafted
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
    /// entry rather than as a scalar. Neither can be honoured here — a draft
    /// inserts no variable scalar (D1; the Phase 4-3 lift covers new `params`
    /// entries only), and no primitive replaces a collection node with a scalar
    /// one.
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
    /// is still present — and the one insertion a draft may make below the match
    /// mapping (a new `params` entry, Phase 4-3) refuses a key the mapping
    /// already holds ([`DraftError::NewKeyDuplicatesAnEntry`]).
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
    /// A substitution names a key the match does not hold.
    ///
    /// A [`crate::draft::FieldSubstitution`] renames an entry that is there; it
    /// never creates one. The intent was made against a match that had this
    /// key, and the match in hand does not — so the intent is stale, and it is
    /// refused rather than turned into an insertion the caller did not ask for.
    SubstitutionSourceAbsent {
        /// The key the substitution was to rename.
        field: MatchField,
    },
    /// A substitution would rename a key to one the match already holds.
    ///
    /// Two entries sharing one key make every path through the mapping
    /// ambiguous and raise [`HazardKind::DuplicateMappingKey`]; the match would
    /// become uneditable the moment the save landed.
    SubstitutionTargetPresent {
        /// The key the substitution was to rename *to*.
        field: MatchField,
    },
    /// A substitution and another intent of the same draft say two things about
    /// one key.
    ///
    /// The source key of a substitution may carry no other intent (it is being
    /// renamed, so it has no value of its own to set or remove afterwards); the
    /// destination key may carry a `Set` — that is the renamed entry's new value
    /// — but not a `Remove`; no key may be named by two substitutions; and a
    /// content substitution may not travel with a `Remove` of `paragraph`, the
    /// companion a switch keeps (Phase 3-5-1).
    /// **Intent level, before any diffing**, for
    /// [`DraftError::SequenceItemDraftedTwice`]'s reason.
    SubstitutionConflictsWithField {
        /// The key both intents name.
        field: MatchField,
    },
    /// Two intents about one list of the match say two things about it (Phase
    /// 3-2).
    ///
    /// Refused **at intent level, before any diffing**, for
    /// [`DraftError::SequenceItemDraftedTwice`]'s reason. The shapes it covers:
    /// adding or removing the whole field beside any other intent about that
    /// field; one item removed twice, or removed and rewritten; two insertions
    /// landing at one place; an insertion landing exactly where the same batch
    /// removes an item (the two would share a byte offset and nothing would say
    /// which comes first); and a trigger switch beside any other intent about
    /// `triggers`.
    SequenceIntentsConflict {
        /// The list both intents name.
        field: SequenceField,
    },
    /// An intent about the items of a list names a list the match does not
    /// hold (Phase 3-2).
    ///
    /// Adding an item to an absent list is not a smaller version of adding the
    /// list: the caller asks for the whole field with its items instead, which
    /// is a different intent with a different edit behind it. A switch from
    /// `triggers` to a scalar form reaches this when `triggers` is absent.
    SequenceFieldAbsent {
        /// The list the intent named.
        field: SequenceField,
    },
    /// An intent to add a whole list names a key the match already holds
    /// (Phase 3-2).
    ///
    /// Present means **written at all**: `triggers: []` and `triggers: x` are
    /// both present, and adding a second `triggers` would make every path
    /// through the mapping ambiguous. A switch to `triggers` reaches this when
    /// the match already holds it.
    SequenceFieldPresent {
        /// The list the intent named.
        field: SequenceField,
    },
    /// The match writes the list's key with a value that is not a sequence
    /// (Phase 3-2).
    ///
    /// `triggers: x`, `triggers:` with nothing after it, a mapping or an alias:
    /// the projection could not model it as a list, so no item of it can be
    /// addressed, and removing it would discard a value the list editor never
    /// displayed.
    SequenceHasAnUnsupportedShape {
        /// The list the intent named.
        field: SequenceField,
        /// What its value actually is.
        found: ValueKind,
    },
    /// A trigger switch would reshape a bracket-delimited list into a scalar
    /// (Phase 3-2).
    ///
    /// `[a, b]` and `[]` are flow lists. Since Phase 3-3 their items are added
    /// and removed between the brackets, so an item intent no longer meets this
    /// refusal; [`crate::draft::TriggerSwitch::FromList`] still does, because a
    /// switch reshapes only a block list. Removing the whole field is not
    /// refused, because it touches no delimiter.
    SequenceIsAFlowList {
        /// The list the intent named.
        field: SequenceField,
    },
    /// The intents would remove every item of a list (Phase 3-2).
    ///
    /// **Removing the last item is explicit, never a side effect.** A list with
    /// no items left would have to become `[]` (a new presentation nobody asked
    /// for) or a bare `key:` (YAML null — a stranded value). Neither is "remove
    /// an item", so the intent is refused, and the caller that means *no list*
    /// asks for the whole field to be removed instead.
    SequenceWouldBeEmpty {
        /// The list the intent named.
        field: SequenceField,
    },
    /// A switch from a list to a single scalar would discard items (Phase 3-2).
    ///
    /// Converting `triggers` to `trigger` or `regex` keeps **one** value, so a
    /// list holding more than one item would lose the others. That is never
    /// done silently: the caller removes the other items first, as their own
    /// explicit intent.
    SwitchWouldDiscardItems {
        /// The list being switched from.
        field: SequenceField,
        /// How many items it holds.
        items: usize,
    },
    /// A new list has no original entry to be written after (Phase 3-2).
    ///
    /// [`DraftError::NoInsertionAnchor`]'s counterpart for a list field: every
    /// insertion is written after an existing entry the projection lets the
    /// planner name, and a match whose entries are all unnameable gives it none.
    NoSequenceInsertionAnchor {
        /// The list that was to be inserted.
        field: SequenceField,
    },
    /// The text drafted for one of the eight plain-source options cannot be
    /// written verbatim as one plain scalar holding exactly those bytes — it is
    /// empty, or holds a line break, a quote, a comment, a flow indicator, an
    /// alias, a tag or anything else [`crate::draft::is_plain_source`] refuses —
    /// so it is refused rather than quoted (Phase 4-1,
    /// `docs/decisions/4-split-notes.md` §3 ruling 2).
    ///
    /// Raised **before any transaction** on both writing paths that take an
    /// option: the single-match planner ([`crate::draft::plan_match_edits`]) and
    /// creation ([`crate::draft::NewMatch::entries`]). `field` is always one of
    /// [`MatchField::PLAIN_SOURCE_OPTIONS`]; the text itself is not carried.
    OptionNotPlainSource {
        /// The option whose text was refused.
        field: MatchField,
    },
    /// A new author-named key is the empty string (Phase 4-3, ruling 7).
    ///
    /// This and the thirteen variants after it are the refusals Phase 4-3 added
    /// for the one insertion a draft may make below the match mapping — a new
    /// `params` entry — and for the `params` removals lifted beside it, and
    /// **none of them carries the key's text** (every operand is a
    /// [`DraftTarget`], an index or a [`ValueKind`], none of which holds a
    /// string, so the types force it): a new key is named by its
    /// position in the draft ([`DraftTarget::NewParam`]), an existing entry by
    /// its index, a batch edit by its position (`CLAUDE.md` §1).
    NewKeyIsEmpty {
        /// The insertion, by position.
        target: DraftTarget,
    },
    /// A new author-named key holds a line break — `\n`, `\r`, NEL, LINE
    /// SEPARATOR or PARAGRAPH SEPARATOR (Phase 4-3, ruling 7).
    NewKeyHasALineBreak {
        /// The insertion, by position.
        target: DraftTarget,
    },
    /// A new author-named key holds a control character other than a line
    /// break — a tab included — or a byte-order mark (Phase 4-3, ruling 7).
    NewKeyHasAControlCharacter {
        /// The insertion, by position.
        target: DraftTarget,
    },
    /// A new author-named key is `<<`, the merge-key spelling, which is refused
    /// however it would be quoted (Phase 4-3, ruling 7).
    NewKeyIsAMergeKey {
        /// The insertion, by position.
        target: DraftTarget,
    },
    /// A new author-named key decodes to the same text as an existing entry of
    /// the mapping it would join — whatever either is quoted as (Phase 4-3).
    ///
    /// Compared against **decoded** keys, so `'alpha'`, `"alpha"` and `alpha`
    /// in the file all refuse a new `alpha`. An entry the same draft removes
    /// still counts: a removal and an insertion of one key in one batch would
    /// be two answers about one entry.
    NewKeyDuplicatesAnEntry {
        /// The insertion, by position.
        target: DraftTarget,
        /// The existing entry's index in the projected mapping.
        entry: usize,
    },
    /// Two new author-named keys of one draft decode to the same text
    /// (Phase 4-3). Checked at intent level, before any diffing.
    NewKeyDuplicatesAnInsertion {
        /// The later insertion, by position.
        target: DraftTarget,
        /// The earlier insertion's position in the same list.
        first: usize,
    },
    /// The mapping a new key would join holds an entry whose key is not a
    /// decoded scalar — an alias, a collection used as a key, or a scalar that
    /// did not decode — so no comparison can establish that the new key is not
    /// a duplicate of it (Phase 4-3). Refused rather than assumed.
    NewKeyCannotBeCompared {
        /// The insertion, by position.
        target: DraftTarget,
        /// The index of the entry whose key cannot be compared.
        entry: usize,
    },
    /// A new `params` entry was drafted for a variable that has no `params` key
    /// (Phase 4-3). Adding the `params:` container is a separate, later
    /// operation, and an empty projected list is no authority to create one.
    ParamsAbsent {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// A new `params` entry was drafted for a variable whose `params` is written
    /// between braces — `{}` or `{a: b}` (Phase 4-3). A flow mapping is never
    /// converted to block style, and structural edits inside one stay refused
    /// (ruling 8).
    ParamsIsAFlowMapping {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// A new `params` entry was drafted for a variable whose `params` holds
    /// something that is not a mapping (Phase 4-3).
    ParamsHasAnUnsupportedShape {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// What `params` actually holds.
        found: ValueKind,
    },
    /// The draft removes every entry of a variable's `params` and adds none, so
    /// the save would leave `params:` holding nothing — a null, not an empty
    /// mapping (Phase 4-3, ruling 8). A container is removed only by an explicit
    /// container-removal intent, which a draft cannot express yet.
    ParamsWouldBeEmpty {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// New `params` entries were drafted and no existing entry can serve as
    /// the one they are written after (Phase 4-3).
    ///
    /// An anchor must survive the batch, and so must the entry directly after it:
    /// the new run would begin exactly where that entry's removal begins, and the
    /// engine refuses two replacements that share a start. So a draft in which
    /// every surviving entry is directly followed by a removed one reaches this
    /// refusal — every entry removed, or `a`, `b` with `b` removed — while the
    /// same intentions saved as two saves do not.
    NoParamInsertionAnchor {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// A new author-named key is one of the known non-string settings of ruling
    /// 4 (`offset`, `trim`, `debug`, `multiline`, `trim_string_values`); a new
    /// author-named entry's value is a logical string, so writing one would
    /// quote a boolean or a number (Phase 4-3). Since Phase 4-4 a **new
    /// variable** writes `offset`, `trim` and `debug` as plain source through
    /// its kind's own fields ([`crate::draft::NewVariableParams`]), and since
    /// Phase 4-6 a form field definition writes `multiline` and
    /// `trim_string_values` through [`crate::draft::FormOptions`]; as a new
    /// `params` entry of an existing variable, a new variable's extra parameter
    /// or a definition's extra option, every one of the five stays refused.
    NewKeyIsATypedSetting {
        /// The insertion, by position.
        target: DraftTarget,
    },
    /// An insertion of the batch writes a key its nested mapping already holds,
    /// or one another insertion of the batch also writes there (Phase 4-3).
    ///
    /// The guard-level twin of [`DraftError::NewKeyDuplicatesAnEntry`] and
    /// [`DraftError::NewKeyDuplicatesAnInsertion`], stated over a batch by
    /// [`crate::draft::check_batch_independence`] and reachable by a batch this
    /// engine did not build. A position in the batch, never the key.
    InsertionKeyAlreadyPresent {
        /// Position of the edit in the batch.
        edit: usize,
    },
    /// Two `vars` intents of one draft contradict each other or another intent
    /// of the draft (Phase 4-4): the whole `vars` removed beside any other
    /// `vars` intent or any drafted variable; one variable removed twice, or
    /// removed and also drafted; two new variables landing at one place; or a
    /// new variable landing exactly where the same draft removes one. Checked
    /// at intent level, before any diffing.
    ///
    /// This and the fourteen variants after it are the refusals Phase 4-4 added
    /// for inserting, removing and reordering local variables, and **none of
    /// them carries a name, a key or a value**: every operand is a
    /// [`DraftTarget`], an index, a count, a [`ValueKind`] or a
    /// [`crate::draft::VariableSetting`], none of which holds a string, so the
    /// types force it (`CLAUDE.md` §1).
    VarsIntentsConflict {
        /// The later of the two intents, by its position in `var_intents`.
        intent: usize,
    },
    /// A `vars` intent or a variable move names a `vars` written between
    /// brackets — `[]` or `[{…}]` (Phase 4-4). A flow sequence is never
    /// converted to block style and its items are never inserted, removed or
    /// moved by this engine (ruling 8).
    VarsIsAFlowList {},
    /// A `vars` intent or a variable move names a `vars` holding something that
    /// is not a sequence (Phase 4-4). Removing it would discard bytes no screen
    /// showed as variables, and nothing can be inserted into it.
    VarsHasAnUnsupportedShape {
        /// What `vars` actually holds.
        found: ValueKind,
    },
    /// The draft removes every variable of `vars` (Phase 4-4, ruling 8). A
    /// sequence with nothing left would be `vars:` holding a null or a `[]` the
    /// person never asked for; the whole `vars` is removed only by
    /// [`crate::draft::VarsIntent::RemoveVars`], the explicit container removal.
    /// A new variable in the same draft does not rescue it, because a list whose
    /// every original item goes is a rewrite of the list.
    VarsWouldBeEmpty {},
    /// A new `vars:` subtree was drafted for a match none of whose entries can
    /// serve as the one it is written after (Phase 4-4) — the counterpart of
    /// [`DraftError::NoInsertionAnchor`] for the one collection a draft adds to
    /// the match mapping.
    NoVarsInsertionAnchor {},
    /// A new variable's name is the empty string (Phase 4-4).
    NewVariableNameIsEmpty {
        /// The new variable, by position.
        target: DraftTarget,
    },
    /// A new variable's name holds a line break or another control character
    /// (Phase 4-4). A name is referenced as `{{name}}` on one line; a name
    /// spanning two cannot be.
    NewVariableNameIsNotOneLine {
        /// The new variable, by position.
        target: DraftTarget,
    },
    /// A new variable's name decodes to the same text as an existing
    /// variable's name in the same `vars` (Phase 4-4). A variable the same
    /// draft removes, or renames, still counts, for
    /// [`DraftError::NewKeyDuplicatesAnEntry`]'s reason.
    NewVariableNameDuplicatesAVariable {
        /// The new variable, by position.
        target: DraftTarget,
        /// The existing variable's index in the projected `vars` list.
        variable: usize,
    },
    /// Two new variables of one draft have the same name (Phase 4-4).
    NewVariableNameDuplicatesAnInsertion {
        /// The later new variable, by position.
        target: DraftTarget,
        /// The earlier one's position in `var_intents`.
        first: usize,
    },
    /// An existing variable's name is not a decoded scalar, so no comparison can
    /// establish that a new variable's name does not repeat it (Phase 4-4).
    /// Refused rather than assumed.
    NewVariableNameCannotBeCompared {
        /// The new variable, by position.
        target: DraftTarget,
        /// The index of the existing variable whose name cannot be compared.
        variable: usize,
    },
    /// The text drafted for one of a new variable's typed settings cannot be
    /// written verbatim as one plain scalar (Phase 4-4, ruling 4): it is refused
    /// rather than quoted, exactly as [`DraftError::OptionNotPlainSource`] is for
    /// a match option. Since the Phase 4-9 review it also refuses a `Set` of an
    /// **existing** variable's `inject_vars`, whose target is then a
    /// [`DraftTarget::VariableScalar`].
    NewVariableSettingNotPlainSource {
        /// The new variable, by position, or the existing variable's scalar.
        target: DraftTarget,
        /// Which setting.
        setting: crate::draft::VariableSetting,
    },
    /// A new variable carries more extra author-named parameters than
    /// [`crate::draft::NewVariable::MAX_EXTRA_PARAMS`] (Phase 4-4).
    NewVariableHasTooManyParams {
        /// The new variable, by position.
        target: DraftTarget,
        /// The bound.
        limit: usize,
    },
    /// A new variable's extra author-named parameter uses a key the variable's
    /// own kind owns — `echo` on an `echo` variable, `fields` on a `form` one
    /// (Phase 4-4). The kind's field is the one route to that parameter.
    NewKeyIsAKindParameter {
        /// The extra parameter, by position.
        target: DraftTarget,
    },
    /// An insertion of the batch lands exactly where another edit of the same
    /// batch removes an item of the same sequence (Phase 4-4, stated for any
    /// sequence of new mapping items): the two replacements would share a
    /// start, and nothing in the batch says which comes first. The guard-level
    /// twin of [`DraftError::VarsIntentsConflict`], reachable by a batch this
    /// engine did not build.
    InsertionLandsOnARemoval {
        /// Position of the insertion in the batch.
        insertion: usize,
        /// Position of the removal in the batch.
        removal: usize,
    },
    /// A variable move would leave the variable where it is (Phase 4-4). Refused
    /// by name rather than written as a batch of nothing, as the engine's own
    /// [`crate::patch::EditError::MoveChangesNothing`] is.
    VariableMoveChangesNothing {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// Two intents about one list of one variable contradict each other
    /// (Phase 4-5): one item removed twice; an item removed and also rewritten
    /// (a `depends_on` item, a string through its `params` entry, or a record);
    /// two insertions landing at one place; an insertion landing exactly where
    /// the same draft removes an item; or a list intent beside a `Set` or a
    /// `Remove` of the kind list's own `params` entry. Checked at intent level,
    /// before any diffing.
    ///
    /// This and the eight variants after it are the refusals Phase 4-5 added for
    /// a variable's lists and labelled choices, and **none of them carries a
    /// name, a key or a value**: every operand is an index, a
    /// [`crate::draft::VariableList`], a [`DraftTarget`] or a [`ValueKind`],
    /// none of which holds a string, so the types force it (`CLAUDE.md` §1).
    VariableListIntentsConflict {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
    },
    /// The variable holds no such list (Phase 4-5). Nothing is inserted into a
    /// list that is not there; a kind list is added as a new `params` entry
    /// ([`crate::draft::VariableDraft::insert_params`]).
    VariableListAbsent {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
    },
    /// The key is there but holds something that is not a list (Phase 4-5).
    VariableListHasAnUnsupportedShape {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
        /// What the key actually holds.
        found: ValueKind,
    },
    /// The list is written between brackets and the request would need a
    /// record, or an item that is not a string, written into or taken out of it
    /// (Phase 4-5; Phase 3 ruling 5). A flow list is never converted to block
    /// style; strings are still added to and removed from a flow list of
    /// strings in place.
    VariableListIsAFlowList {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
    },
    /// A kind list was named on a variable of another kind — `values` on
    /// anything but a `choice`, `choices` on anything but a `random`, `args` on
    /// anything but a `script` (Phase 4-5).
    VariableListIsNotOfItsKind {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
    },
    /// The draft removes every item of the list (Phase 4-5, ruling 8). A list
    /// with nothing left would be a null or an unasked `[]`; insertions in the
    /// same draft do not rescue it, for [`DraftError::SequenceWouldBeEmpty`]'s
    /// reason.
    VariableListWouldBeEmpty {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
    },
    /// The new items are not of the shape the list holds (Phase 4-5): records
    /// into a list of strings, into a list that mixes shapes or into any list
    /// but a `choice`'s `values`; or strings into a list of records or a list
    /// that mixes shapes. String and record shapes stay distinct.
    VariableListItemShapeMismatch {
        /// The variable's index in the projected `vars` list.
        variable: usize,
        /// Which list.
        list: crate::draft::VariableList,
    },
    /// A record rewrite names an item of `values` that is not a mapping (Phase
    /// 4-5): a string, or an alias. A string of the list is rewritten through
    /// its `params` entry instead.
    NotAChoiceRecord {
        /// The item, by position.
        target: DraftTarget,
        /// What the item actually is.
        found: ValueKind,
    },
    /// A record rewrite names `label` or `id` of a record that holds no single
    /// value under that key — the key is absent, or holds a collection (Phase
    /// 4-5). Nothing is added inside a record.
    ChoiceRecordFieldHasNoScalar {
        /// The record's entry, by position.
        target: DraftTarget,
    },
    /// Two intents about one form's definitions contradict each other (Phase
    /// 4-6): `RemoveFields` beside any other intent or definition draft of that
    /// form; one definition removed twice, or removed and also drafted; or an
    /// insertion written after a definition the same draft removes. Checked at
    /// intent level, before any diffing.
    ///
    /// This and the fifteen variants after it are the refusals Phase 4-6 added
    /// for form field definitions, and **none of them carries a name, a key or a
    /// value**: every operand is a [`crate::draft::FormOwner`], an index, a
    /// count, a [`DraftTarget`], a [`ValueKind`] or a
    /// [`crate::draft::VariableSetting`], none of which holds a string, so the
    /// types force it (`CLAUDE.md` §1).
    FormIntentsConflict {
        /// Which form.
        form: crate::draft::FormOwner,
        /// The intent's position in the owner's intent list.
        intent: usize,
    },
    /// A verbose form's definitions were drafted on a variable that is not of
    /// `type: form` (Phase 4-6).
    VariableIsNotAForm {
        /// The variable's index in the projected `vars` list.
        variable: usize,
    },
    /// The form's definitions are written between braces — `{}` included — and
    /// a definition would have to be written into or taken out of them (Phase
    /// 4-6; ruling 8). A flow mapping is never converted.
    FormFieldsIsAFlowMapping {
        /// Which form.
        form: crate::draft::FormOwner,
    },
    /// `form_fields` (or `params.fields`) holds something that is not a mapping
    /// (Phase 4-6).
    FormFieldsHasAnUnsupportedShape {
        /// Which form.
        form: crate::draft::FormOwner,
        /// What the key actually holds.
        found: ValueKind,
    },
    /// The draft removes every definition of the form (Phase 4-6, ruling 8).
    /// Removing the whole entry is its own explicit intent, `RemoveFields`;
    /// insertions in the same draft do not rescue it.
    FormFieldsWouldBeEmpty {
        /// Which form.
        form: crate::draft::FormOwner,
    },
    /// No existing definition survives the draft to write the new ones after
    /// (Phase 4-6).
    NoFormFieldInsertionAnchor {
        /// Which form.
        form: crate::draft::FormOwner,
    },
    /// New options were asked of a definition whose value is not a block
    /// mapping with at least one option — a flow mapping (`{}` included), a
    /// scalar or an empty value (Phase 4-6). Nothing converts or creates it.
    FormFieldOptionsAreNotABlockMapping {
        /// The definition, by position.
        target: DraftTarget,
        /// What the definition's value actually is.
        found: ValueKind,
    },
    /// The draft removes every option of a definition (Phase 4-6, ruling 8). A
    /// definition with nothing left would be a null; removing the definition is
    /// its own intent.
    FormFieldWouldHaveNoOptions {
        /// The definition, by position.
        target: DraftTarget,
    },
    /// No existing option of the definition survives the draft to write the new
    /// ones after (Phase 4-6).
    NoFormOptionInsertionAnchor {
        /// The definition, by position.
        target: DraftTarget,
    },
    /// A typed form setting — `multiline` or `trim_string_values` — cannot be
    /// written as one plain scalar (Phase 4-6, ruling 4). It is never quoted into
    /// a string instead.
    NewFormOptionNotPlainSource {
        /// The new definition or the definition given new options, by position.
        target: DraftTarget,
        /// Which setting.
        setting: crate::draft::VariableSetting,
    },
    /// An extra option names one of the five options a definition writes by
    /// name — `type`, `default`, `multiline`, `values`, `trim_string_values`
    /// (Phase 4-6). The typed field is the only route to each.
    NewKeyIsAFormOption {
        /// The extra option, by position.
        target: DraftTarget,
    },
    /// A description carries more extra options than
    /// [`crate::draft::FormOptions::MAX_EXTRA_OPTIONS`] (Phase 4-6).
    NewFormFieldHasTooManyOptions {
        /// The new definition or the definition given new options, by position.
        target: DraftTarget,
        /// The bound.
        limit: usize,
    },
    /// A `values` intent names a definition with no `values` option (Phase 4-6).
    /// Nothing is inserted into a list that is not there; a new `values` is a new
    /// option.
    FormValuesAbsent {
        /// The definition, by position.
        target: DraftTarget,
    },
    /// A `values` intent names a `values` that is not a list — the multi-line
    /// text representation, or anything else (Phase 4-6, ruling 18). Text is
    /// never turned into a list.
    FormValuesIsNotAList {
        /// The `values` option, by position.
        target: DraftTarget,
        /// What it actually holds.
        found: ValueKind,
    },
    /// The draft removes every item of a definition's `values` list (Phase 4-6,
    /// ruling 8); insertions in the same draft do not rescue it.
    FormValuesWouldBeEmpty {
        /// The `values` option, by position.
        target: DraftTarget,
    },
    /// Two intents about one definition's `values` contradict each other (Phase
    /// 4-6): one item removed twice, or removed and also rewritten; two
    /// insertions landing at one place; an insertion landing where an item is
    /// removed; or an item intent beside a rewrite or a removal of the whole
    /// `values` option.
    FormValuesIntentsConflict {
        /// The `values` option, by position.
        target: DraftTarget,
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
            DraftError::SubstitutionSourceAbsent { field } => {
                write!(
                    formatter,
                    "the match holds no {} to substitute",
                    field.key()
                )
            }
            DraftError::SubstitutionTargetPresent { field } => {
                write!(formatter, "the match already holds {}", field.key())
            }
            DraftError::SubstitutionConflictsWithField { field } => {
                write!(
                    formatter,
                    "{} carries a substitution and another intent",
                    field.key()
                )
            }
            DraftError::SequenceIntentsConflict { field } => {
                write!(formatter, "two intents about {} conflict", field.key())
            }
            DraftError::SequenceFieldAbsent { field } => {
                write!(formatter, "the match holds no {}", field.key())
            }
            DraftError::SequenceFieldPresent { field } => {
                write!(formatter, "the match already holds {}", field.key())
            }
            DraftError::SequenceHasAnUnsupportedShape { field, found } => {
                write!(formatter, "{} holds a {found:?}", field.key())
            }
            DraftError::SequenceIsAFlowList { field } => {
                write!(formatter, "{} is a flow list", field.key())
            }
            DraftError::SequenceWouldBeEmpty { field } => {
                write!(formatter, "{} would be left with no items", field.key())
            }
            DraftError::SwitchWouldDiscardItems { field, items } => {
                write!(
                    formatter,
                    "switching {} would discard {items} items",
                    field.key()
                )
            }
            DraftError::NoSequenceInsertionAnchor { field } => {
                write!(formatter, "no insertion anchor for {}", field.key())
            }
            DraftError::OptionNotPlainSource { field } => {
                write!(
                    formatter,
                    "option {} is not writable as plain source",
                    field.key()
                )
            }
            DraftError::NewKeyIsEmpty { .. } => formatter.write_str("a new key is empty"),
            DraftError::NewKeyHasALineBreak { .. } => {
                formatter.write_str("a new key holds a line break")
            }
            DraftError::NewKeyHasAControlCharacter { .. } => {
                formatter.write_str("a new key holds a control character")
            }
            DraftError::NewKeyIsAMergeKey { .. } => formatter.write_str("a new key is a merge key"),
            DraftError::NewKeyDuplicatesAnEntry { entry, .. } => {
                write!(formatter, "a new key repeats entry {entry}")
            }
            DraftError::NewKeyDuplicatesAnInsertion { first, .. } => {
                write!(formatter, "a new key repeats insertion {first}")
            }
            DraftError::NewKeyCannotBeCompared { entry, .. } => {
                write!(formatter, "entry {entry}'s key cannot be compared")
            }
            DraftError::ParamsAbsent { variable } => {
                write!(formatter, "variable {variable} has no params")
            }
            DraftError::ParamsIsAFlowMapping { variable } => {
                write!(formatter, "variable {variable}'s params is a flow mapping")
            }
            DraftError::ParamsHasAnUnsupportedShape { variable, found } => {
                write!(formatter, "variable {variable}'s params holds a {found:?}")
            }
            DraftError::ParamsWouldBeEmpty { variable } => {
                write!(
                    formatter,
                    "variable {variable}'s params would be left empty"
                )
            }
            DraftError::NoParamInsertionAnchor { variable } => {
                write!(
                    formatter,
                    "variable {variable} has no surviving params entry"
                )
            }
            DraftError::NewKeyIsATypedSetting { .. } => {
                formatter.write_str("a new key names a typed setting")
            }
            DraftError::InsertionKeyAlreadyPresent { edit } => {
                write!(formatter, "edit {edit} inserts a key already there")
            }
            DraftError::VarsIntentsConflict { intent } => {
                write!(formatter, "vars intent {intent} conflicts with another")
            }
            DraftError::VarsIsAFlowList {} => formatter.write_str("vars is a flow list"),
            DraftError::VarsHasAnUnsupportedShape { found } => {
                write!(formatter, "vars holds a {found:?}")
            }
            DraftError::VarsWouldBeEmpty {} => {
                formatter.write_str("vars would be left with no variables")
            }
            DraftError::NoVarsInsertionAnchor {} => {
                formatter.write_str("no insertion anchor for vars")
            }
            DraftError::NewVariableNameIsEmpty { .. } => {
                formatter.write_str("a new variable's name is empty")
            }
            DraftError::NewVariableNameIsNotOneLine { .. } => {
                formatter.write_str("a new variable's name is not one line")
            }
            DraftError::NewVariableNameDuplicatesAVariable { variable, .. } => {
                write!(
                    formatter,
                    "a new variable repeats variable {variable}'s name"
                )
            }
            DraftError::NewVariableNameDuplicatesAnInsertion { first, .. } => {
                write!(formatter, "a new variable repeats intent {first}'s name")
            }
            DraftError::NewVariableNameCannotBeCompared { variable, .. } => {
                write!(formatter, "variable {variable}'s name cannot be compared")
            }
            DraftError::NewVariableSettingNotPlainSource { setting, .. } => {
                write!(
                    formatter,
                    "setting {} is not writable as plain source",
                    setting.key()
                )
            }
            DraftError::NewVariableHasTooManyParams { limit, .. } => {
                write!(
                    formatter,
                    "a new variable carries more than {limit} extra parameters"
                )
            }
            DraftError::NewKeyIsAKindParameter { .. } => {
                formatter.write_str("an extra parameter uses a key its kind owns")
            }
            DraftError::InsertionLandsOnARemoval { insertion, removal } => {
                write!(
                    formatter,
                    "insertion {insertion} lands on removal {removal}"
                )
            }
            DraftError::VariableMoveChangesNothing { variable } => {
                write!(formatter, "moving variable {variable} changes nothing")
            }
            DraftError::VariableListIntentsConflict { variable, list } => write!(
                formatter,
                "two intents about variable {variable}'s {} conflict",
                list.key()
            ),
            DraftError::VariableListAbsent { variable, list } => {
                write!(formatter, "variable {variable} has no {}", list.key())
            }
            DraftError::VariableListHasAnUnsupportedShape {
                variable,
                list,
                found,
            } => write!(
                formatter,
                "variable {variable}'s {} holds a {found:?}",
                list.key()
            ),
            DraftError::VariableListIsAFlowList { variable, list } => write!(
                formatter,
                "variable {variable}'s {} is a flow list",
                list.key()
            ),
            DraftError::VariableListIsNotOfItsKind { variable, list } => write!(
                formatter,
                "variable {variable} is not of the kind that holds {}",
                list.key()
            ),
            DraftError::VariableListWouldBeEmpty { variable, list } => write!(
                formatter,
                "variable {variable}'s {} would be left with no items",
                list.key()
            ),
            DraftError::VariableListItemShapeMismatch { variable, list } => write!(
                formatter,
                "the new items do not have the shape of variable {variable}'s {}",
                list.key()
            ),
            DraftError::NotAChoiceRecord { found, .. } => {
                write!(formatter, "the item is a {found:?}, not a record")
            }
            DraftError::ChoiceRecordFieldHasNoScalar { .. } => {
                formatter.write_str("the record holds no such single value")
            }
            DraftError::FormIntentsConflict { intent, .. } => {
                write!(formatter, "form intent {intent} conflicts with another")
            }
            DraftError::VariableIsNotAForm { variable } => {
                write!(formatter, "variable {variable} is not a form")
            }
            DraftError::FormFieldsIsAFlowMapping { .. } => {
                formatter.write_str("the form's definitions are a flow mapping")
            }
            DraftError::FormFieldsHasAnUnsupportedShape { found, .. } => {
                write!(formatter, "the form's definitions are a {found:?}")
            }
            DraftError::FormFieldsWouldBeEmpty { .. } => {
                formatter.write_str("the form would be left with no definitions")
            }
            DraftError::NoFormFieldInsertionAnchor { .. } => {
                formatter.write_str("no surviving definition to insert after")
            }
            DraftError::FormFieldOptionsAreNotABlockMapping { found, .. } => {
                write!(
                    formatter,
                    "the definition's options are a {found:?}, not a block mapping"
                )
            }
            DraftError::FormFieldWouldHaveNoOptions { .. } => {
                formatter.write_str("the definition would be left with no options")
            }
            DraftError::NoFormOptionInsertionAnchor { .. } => {
                formatter.write_str("no surviving option to insert after")
            }
            DraftError::NewFormOptionNotPlainSource { setting, .. } => {
                write!(
                    formatter,
                    "setting {} is not writable as plain source",
                    setting.key()
                )
            }
            DraftError::NewKeyIsAFormOption { .. } => {
                formatter.write_str("an extra option uses a schema-known option key")
            }
            DraftError::NewFormFieldHasTooManyOptions { limit, .. } => {
                write!(formatter, "more than {limit} extra options")
            }
            DraftError::FormValuesAbsent { .. } => {
                formatter.write_str("the definition has no values")
            }
            DraftError::FormValuesIsNotAList { found, .. } => {
                write!(formatter, "the definition's values are a {found:?}")
            }
            DraftError::FormValuesWouldBeEmpty { .. } => {
                formatter.write_str("the values would be left with no items")
            }
            DraftError::FormValuesIntentsConflict { .. } => {
                formatter.write_str("two intents about one values list conflict")
            }
        } // End of the match over every refusal
    } // End of function fmt() for DraftError
}

impl std::error::Error for DraftError {}
