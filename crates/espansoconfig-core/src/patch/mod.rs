//! The edit engine — byte-span surgery.
//!
//! **Phase 0c responsibility:** apply a `DocumentEdit` as the smallest safe
//! byte-span replacement (`IMPLEMENTATION_PLAN.md` section 6.2), under three
//! non-negotiable rules:
//!
//! 1. **Apply edits from the highest byte offset downwards**, so offsets
//!    earlier in the document stay valid while the batch is applied.
//! 2. **Reparse the entire candidate document and verify** before it is allowed
//!    anywhere near disk. Local patching is never trusted on its own.
//! 3. **Everything outside the intended span comes out byte-identical.** This is
//!    the invariant the whole product rests on, and the round-trip property test
//!    in section 11 exists to police it.
//!
//! A full-match rewrite is an acceptable fallback but destroys comments inside
//! that match, so it is surfaced to the user rather than performed silently.
//!
//! # Phase status
//!
//! **0c-2a — [`path`], the structural path resolver.** Rule 2 above is why this
//! exists before any mutation does: verifying an edit means re-finding the
//! edited node in a *freshly parsed* index, whose `NodeId`s bear no relation to
//! the ones the edit was planned against. A [`DocumentPath`] is the identity
//! that survives that reparse, and [`resolve`] / [`path_to`] are its two
//! directions.
//!
//! **0c-2b — [`edit`], the first code here that mutates a document.** One
//! scalar's value, replaced as a byte-span surgery, with the hazard gate
//! consulted by the entry point **itself** rather than by its callers, and the
//! whole candidate reparsed and verified before a [`PatchedDocument`] exists at
//! all.
//!
//! **0c-3a — structural edits, in the same engine.** [`FieldInsert`] and
//! [`FieldRemoval`] join [`ScalarEdit`] in one [`DocumentEdit`] batch, applied
//! by [`apply_edits`]; [`apply_scalar_edits`] is now a wrapper over it. Planning
//! against the original index, rejecting overlaps, splicing from the highest
//! offset downwards and reparsing to verify are the same steps whatever the edit
//! is, so there is one engine rather than two.
//!
//! **0c-3b-2a — [`ItemMove`], the first edit that relocates bytes.** A whole
//! sequence item moves inside its own sequence, as a removal plus an insertion in
//! one batch, through the same [`apply_edits`]. It is the edit that breaks "every
//! byte outside the replaced spans is identical" as a *sufficient* statement —
//! the replacement list says those bytes moved — so verification gains the
//! whole-document form: the bytes written are the bytes taken and nothing but the
//! item was taken, the document's lines are conserved, the sequence holds the
//! intended permutation, every construct the move did not name decodes to exactly
//! what it decoded to before, and no comment changed hands. The full round-trip
//! property test (R9) and the second YAML 1.1 oracle (R16) are step 0c-3b-2b.
//!
//! **2b-2c-1 — [`InsertItem`] and [`RemoveItem`], the sequence's own pair.**
//! [`DocumentEdit`] had four variants and three of Phase 2b's six commands had no
//! primitive behind them; two of the three now do. [`RemoveItem`] is
//! **[`ItemMove`]'s lift half with no landing**, sharing the envelope derivation
//! and the source-gap join as code rather than as an agreement, so a deletion can
//! never take a different set of bytes from the ones a relocation takes.
//! [`InsertItem`] was the first narrow exception to "no generic primitive may
//! synthesize a collection": exactly one new flat block-mapping item with scalar
//! fields, spelled by the existing codec, at a sequence-item boundary — plus the
//! promotion of a bare `matches:` into its first item, without which that key
//! could never be targeted as a sequence at all. Phase 3-2 adds the second, below,
//! and Phase 3-4 lets a field of the new item be a flat list of scalars.
//!
//! **2b-2c-2 — [`ItemPlacement`], the insertion's third destination.** An
//! insertion could go after a named item or after the last one, and had no
//! spelling at all for *above the first* — the destination `create_match` needs
//! to put a new snippet at the top of a file. It is a **planner** operation
//! rather than an append-then-move, and it reuses [`ItemMove`]'s own front
//! derivation: the start of the first item's hull, so that item's leading comment
//! block stays with it.
//!
//! **2c-3c-1 — [`DuplicateItem`], the byte-exact copy.** A whole sequence item's
//! owned runs — the same envelope a lift takes, carved below the removal-only
//! refusals — are inserted verbatim immediately after the source, in the same
//! sequence, with no destination argument and no rendering of any kind. It is
//! batch-only, its seams are the move's destination seams under duplicate names
//! ([`DuplicateSeam`] — there is no source close, because the source stays), and
//! its verification is its own class: the arrival must equal the concatenation
//! of the runs `entry_owned_runs` derives from the text, the sequence must be
//! the original plus the clone in its slot, and the candidate's comments must be
//! exactly the original's plus one owned copy of each comment the runs carry.
//!
//! **3-1 — [`FieldInsertGroup`] and [`KeySubstitution`], compositional mapping
//! edits.** A group writes several new entries as one run, in a stated order,
//! after one anchor — the answer to two insertions sharing an offset, which
//! stays refused. A substitution re-spells one entry's key token in place, so the
//! first entry of a compact `- key: value` item can change key without its `-`
//! moving. Both are verified through the same mapping fold as an insertion and a
//! removal, which gains one property: every key of the changed mapping is where
//! the batch intended it ([`VerificationFailure::EntriesNotInTheIntendedOrder`]).
//!
//! **3-2 — [`ScalarItemInsert`], [`ShapeSwitch`] and list-valued entries, the
//! scalar list's own edits.** One or more scalar items are written at one
//! sequence-item boundary of an existing block sequence, landing exactly where an
//! [`InsertItem`] would ([`RemoveItem`] already removes a scalar item). A
//! [`FieldInsertGroup`] entry may be an [`EntryValue::ScalarList`] — a new block
//! list of scalars, or `[]` — which is the second narrow exception to "no generic
//! primitive may synthesize a collection": a flat list of scalars and nothing
//! deeper. A [`ShapeSwitch`] renames an entry and turns its single-line scalar
//! into a block list of scalars, or a block list of scalars into a single-line
//! scalar, in place. Verification gains one property,
//! [`VerificationFailure::ItemNotInserted`], and one mechanism: every path an
//! expectation is re-resolved by is first carried through the batch's own item
//! position map ([`item_positions`]), so an edit of an item a removal shifted is
//! looked for where it now is.
//!
//! **3-3 — flow lists of scalars.** [`ScalarItemInsert`] and [`RemoveItem`] add
//! and remove items of a bracket-delimited list of scalars between its
//! brackets, delimiters and the list's own comments placed by a stated rule,
//! never converting it to block style; a comment or comma the rule cannot place
//! is [`EditError::FlowListTriviaAmbiguous`]. Verification gains
//! [`VerificationFailure::SequenceStyleChanged`] for every item edit.
//!
//! **3-7 — [`ItemTextReplacement`], the local raw-item edit.** One snippet's
//! owned physical-line range, cut in Rust by [`item_owned_text`] and replaced by
//! exact text as a [`DocumentEdit`], alone in its batch. The range must be one
//! contiguous run ([`EditError::ItemRangeNotContiguous`] otherwise) and hold no
//! `\r`; the candidate must hold exactly one mapping item in the slot, change
//! no construct outside it, keep both block-scalar seams and every comment's
//! owner, and parse — a result that does not parse is never saved this way.

pub mod edit;
pub mod path;

pub use edit::{
    apply_edits, apply_scalar_edit, apply_scalar_edits, duplicate_item, insert_field, insert_item,
    insertion_landings, item_owned_text, item_positions, move_item, remove_field, remove_item,
    replace_item_text, DocumentEdit, DuplicateItem, DuplicateSeam, EditError, EntryValue,
    FieldInsert, FieldInsertGroup, FieldRemoval, InsertItem, ItemFields, ItemMove, ItemPlacement,
    ItemTextReplacement, ItemValue, KeySubstitution, MoveSeam, OwnedItemText, PatchedDocument,
    PresentationNote, RemoveItem, Replacement, ScalarEdit, ScalarItemInsert, ShapeSwitch,
    VerificationFailure,
};
pub use path::{
    path_to, resolve, resolve_full, resolve_key, AddressError, DocumentPath, PathError,
    PathParseError, PathSegment, Resolved,
};

/// The item-ownership derivation `crate::reconcile` hashes.
///
/// Crate-visible on purpose: a run is a byte offset into one parse, and the
/// whole reason `crate::reconcile` exists is that positions do not cross a
/// revision boundary. What crosses is a digest.
pub(crate) use edit::item_owned_runs;
