//! Applying an edit — the first code in this crate that mutates a document.
//!
//! # The contract
//!
//! [`apply_edits`] is the **only** way to obtain a [`PatchedDocument`], and a
//! `PatchedDocument` only exists once the candidate text has been reparsed and
//! verified. There is deliberately no constructor, no `text` field and no
//! "unchecked" variant: a caller that holds one is holding bytes that passed
//! every check in `verify`, and a caller that holds an [`EditError`] is holding
//! no bytes at all. [`apply_scalar_edits`], [`apply_scalar_edit`],
//! [`insert_field`] and [`remove_field`] are all wrappers over it.
//!
//! The four rules of `IMPLEMENTATION_PLAN.md` section 6.2, and where each one
//! lives:
//!
//! | Rule | Here |
//! |---|---|
//! | the smallest safe edit | one scalar's header and content spans, or one entry's own lines — never its mapping |
//! | highest byte offset downwards | `splice` sorts descending before writing |
//! | reparse the whole candidate and verify | `verify`, on the way out |
//! | byte-identical outside the intended span | `bytes_outside_the_replacements_match` |
//! | the intended span is not self-declared | `permitted_spans`, checked by `verify` |
//!
//! # A block scalar is two spans, never one envelope
//!
//! `PROGRESS.md` D2c puts a block scalar's content span immediately after the
//! line break that terminates its header line, so the header's trailing spaces,
//! any comment on it and the break itself lie between the two spans and belong
//! to **neither**. Every edit to a block scalar therefore replaces the header
//! and the content *separately*, whatever style the new value takes. Replacing
//! one synthesized `header_span.start .. content_span.end` envelope instead —
//! which is what this module used to do for a block-to-flow change — rewrote
//! those in-between bytes: a CRLF header came back as LF, and three spaces after
//! a `|` disappeared. `permitted_spans` states the rule in terms the planner
//! cannot bend, and `verify` enforces it.
//!
//! # The hazard gate is consulted here, not by the caller
//!
//! [`crate::patch::path`] answers "which node does this path name" and
//! deliberately knows nothing about hazards (`PROGRESS.md`, D2j). The gate is
//! `TriviaIndex::is_safely_editable`, and **this module calls it itself**, on
//! every edit, before rendering a single byte. Making safety a caller
//! convention would mean one forgotten call costs a user their file, so
//! [`apply_edits`] takes the *source text* rather than a pre-scanned
//! [`TriviaIndex`]: there is no argument a caller can get wrong, and no way to
//! pass an index that says something different from the document being edited.
//!
//! A **structural** edit asks the gate about the whole **mapping** rather than
//! about the one entry, because it changes the mapping's own shape: a merge key,
//! a duplicate key or an anchor anywhere inside makes "one entry more or fewer"
//! a question that cannot be answered locally. That is strictly more pessimistic
//! than a scalar edit, deliberately.
//!
//! # Flow collections (`PROGRESS.md`, R17) — decided here
//!
//! The gate does **not** refuse an ordinary flow collection; only
//! `HazardKind::CommentInFlowCollection` exists. Since a block scalar is
//! illegal inside `{…}`/`[…]`, R17 required this step to choose between
//! refusing flow-interior edits outright and guaranteeing flow-legal bytes.
//!
//! **The decision is to guarantee flow-legal bytes.** `scalar_context` marks
//! the target's context [`crate::emit::ScalarContextKind::Flow`] whenever any
//! enclosing collection is bracket-delimited, and the emitter already refuses
//! to put a block *or* a plain scalar into flow context
//! ([`crate::emit::choose_scalar`], [`crate::emit::preserve_scalar`]): a
//! multi-line value inside a flow collection becomes a **double-quoted scalar
//! with `\n` escapes**, which is one physical line and cannot disturb the
//! collection's brackets. Refusing instead would cost real espanso configs —
//! `triggers: [":a", ":b"]` and inline `vars: [{name: …, type: …}]` are
//! idiomatic — while buying nothing, because the safety it would provide is
//! already provided by construction. `docs/decisions/0c-2b-notes.md` records
//! the reasoning; `tests/patch_edit.rs` pins it in both directions.
//!
//! # Structural edits — Phase 0c-3a
//!
//! [`FieldInsert`] and [`FieldRemoval`] join [`ScalarEdit`] in one
//! [`DocumentEdit`] batch. They did **not** get an engine of their own: the
//! offset-ordering, overlap, splice and verification machinery is written once,
//! for a list of replacements, and a second copy would be a second place for it
//! to drift. An insertion is a replacement of a zero-width span; a removal is a
//! replacement with empty text; both go through `splice`, `verify` and the
//! permitted-span check unchanged.
//!
//! Three things structural edits add, and each is a rule rather than a
//! convenience:
//!
//! - **[`EditError::OverlappingEdits`] becomes load-bearing.** For scalars it
//!   only ever caught the same path twice. Here a removal's envelope covers
//!   whole lines, so a scalar edit inside it, a second removal of the same entry
//!   and two insertions at the same point all collide — and the last of those is
//!   invisible to `end > start` alone, because both spans are zero width, so the
//!   test also rejects two replacements that share a start. Since 0c-3b-1 one
//!   removal contributes **several** replacements, so the check is over the whole
//!   batch's flat, sorted replacement list rather than over one span per edit.
//! - **Verification is more than byte identity.** A removal deliberately deletes
//!   bytes, so "every byte outside the replaced span is identical" is generalised
//!   to *the candidate is the source with exactly these replacements applied*,
//!   which `bytes_outside_the_replacements_match` already states, plus: the
//!   mapping is still there, the named entry is present or absent as asked, and
//!   **every sibling entry still decodes to exactly what it decoded to before**,
//!   nested collections included. That last one is what an oversized envelope
//!   fails.
//! - **The envelope is not self-declared.** `StructuralGuard` states the limit in
//!   terms of the **original index's node spans** and runs before a byte moves,
//!   which is the Phase 0c-2b review's finding 3 carried forward: an envelope one
//!   entry too long would otherwise confirm itself.
//!
//! # What the Phase 0c-3a review's fix round changed
//!
//! Three of its five findings land in this module, and each one is a case of a
//! check that was about *nodes* missing something that is not a node:
//!
//! - **A removal envelope may not cross a file-owned comment**
//!   ([`EditError::RemovalWouldDeleteAFileComment`]). An entry's envelope is the
//!   contiguous hull of what its subtree owns, so a comment the ownership rules
//!   give to the **file** can sit inside it between two descendants. Removing
//!   the entry deleted it, and every layer — the guard, the digests, the byte
//!   check, the external oracle — certified the result, because none of them can
//!   see a comment. `verify` now also requires every file-owned comment of the
//!   original to still be in the candidate
//!   ([`VerificationFailure::FileCommentLost`]), so the next envelope defect
//!   cannot hide the same way.
//! - **An insertion copies a line ending; it never picks one.** The break comes
//!   from the anchor's own terminated line, or at end of file from the last break
//!   before the insertion point. A document that supplies neither is refused
//!   ([`EditError::NoObservableLineEnding`]) rather than given the LF that
//!   `LineEnding::detect` defaults to.
//! - **A malformed batch answers rather than panicking.** Disjointness is checked
//!   before expectations are folded, and the fold's arithmetic is checked, so
//!   three removals of one entry return [`EditError::OverlappingEdits`] instead
//!   of underflowing an entry count.
//!
//! # Phase 0c-3b-1 — the envelope becomes a set of runs
//!
//! `PROGRESS.md` R21, and decision D2o's other half. A removal envelope used to
//! be one contiguous [`ByteSpan`], which cannot express "delete this entry but
//! keep the file-owned comment inside it": 0c-3a therefore refused such a
//! removal ([`EditError::RemovalWouldDeleteAFileComment`]). It is now an
//! **ordered, disjoint set of runs** — the hull with every whole line a
//! file-owned comment occupies, and every blank run touching one of those lines,
//! punched out — and each run is spliced as its own replacement. The D2o example
//! is a real edit again, and the comment, its indentation and the blank line
//! under it come out byte-identical.
//!
//! Nothing in the verification layer was weakened to accommodate that, and two
//! things were added because runs make them expressible:
//!
//! - `StructuralGuard::Removal` now carries the run list and checks **every**
//!   run against the original index's node spans, as the single span was checked;
//! - it additionally requires the runs to cover **every frontier leaf of the
//!   entry**. "The runs touch nothing outside the entry" and "the runs cover all
//!   of the entry" are duals, and together they say the run set covers **exactly
//!   the entry's nodes** — every token of it and no node outside it — which one
//!   span said by construction and a set does not.
//!
//! What the guard does **not** say is anything about trivia. Both halves are
//! stated over node spans, so trivia interior to the hull that no node owns is
//! invisible to them: an envelope can satisfy both and still delete a comment the
//! ownership rules give to the file. That is what the per-run
//! `file_comments()` assertion, `VerificationFailure::FileCommentLost` and the
//! sweep's preservation-rule property are for, and the Phase 0c-3b-1 review's
//! finding 1 is the record of the claim being overstated before this sentence
//! existed.
//!
//! One shape is still refused, and it is a different shape from the one 0c-3a
//! refused: bytes left behind at or past a block scalar's body column, directly
//! under that block's content, become part of it
//! ([`EditError::RemovalWouldExtendABlockScalar`]).
//!
//! # Phase 0c-3b-2a — the move, and the invariant it forces
//!
//! [`ItemMove`] relocates a whole sequence item inside its own sequence. It is
//! **a removal plus an insertion whose replacements do not overlap**, and it got
//! no engine of its own for the same reason the structural edits did not: the
//! source half is `removal_envelope`, the call [`FieldRemoval`] makes, and the
//! destination half is `insertion_point`, the call [`FieldInsert`] makes. The
//! bytes written are the bytes the source runs hold, **copied verbatim** — two
//! positions in one block sequence sit at the same column, so there is nothing to
//! re-indent and nothing to render.
//!
//! **What a move breaks is the sufficiency of property 4.** "Every byte outside
//! the replaced spans is identical" was doing more work than it looked: it held
//! for an insertion and a removal because neither relocates anything, so a
//! neighbour's meaning could only change through bytes the edit declared. A move
//! declares that its bytes moved, and the property then says nothing about the
//! seams the relocation opens. Five whole-document properties replace it — the
//! written bytes are the taken bytes, the lines are conserved, the sequence holds
//! the intended permutation, every construct the move did not name still decodes
//! to what it decoded to before, and no comment changed hands — and all five are
//! derived from the **original** document rather than from the edit.
//!
//! Four shapes are refused before a byte moves, each read off the document:
//! [`EditError::MoveChangesNothing`], [`EditError::MoveWouldInventALineEnding`],
//! [`EditError::MoveWouldTerminateTheFinalLine`] and
//! [`EditError::MoveWouldExtendABlockScalar`], the last of them at three external
//! seams plus one internal seam per adjacent pair of carried runs
//! ([`MoveSeam`]) — a removal creates one join, and a move creates all of those.
//!
//! # Phase 0c-3b-2b — the property the substrate cannot state
//!
//! Every property above is checked against a `saphyr-parser` reparse, and
//! `saphyr-parser` is YAML **1.2**. Espanso reads the same file with a YAML
//! **1.1**-ish stack, so a candidate can satisfy all of them and still mean
//! something else where it is actually read: a plain `no` that becomes `false`, a
//! plain `012` that becomes ten, a plain `12:30` that becomes 750
//! (`PROGRESS.md`, R16). `no_ambiguous_plain_scalar_is_introduced` states it
//! directly, from [`crate::emit`]'s hand-written tag-resolution table rather than
//! from a second parser, as a **differential** property: a document may already
//! hold such scalars — real espanso files do — but an edit may never leave the
//! candidate holding more of them than the source did
//! ([`VerificationFailure::AmbiguousPlainScalarIntroduced`]).
//!
//! It is deliberately a *second* statement of what
//! [`crate::emit::is_conservatively_safe_plain_scalar`] already promises. The
//! emitter decides what to write; this reads what the reparsed document holds,
//! and a defect in the first is exactly what the second exists to catch
//! (`PROGRESS.md`, R24).
//!
//! # Phase 2b-2c-1 — the sequence's own pair
//!
//! [`InsertItem`] and [`RemoveItem`]. Nothing about the engine changed: an
//! insertion is still a replacement of a zero-width span, a removal is still a
//! set of runs replaced by nothing, and both go through [`apply_edits`], the
//! disjointness check, `splice` and `verify` unchanged. What is new is what they
//! are *made of*.
//!
//! **[`RemoveItem`] is [`ItemMove`]'s lift half with no landing, as code.** The
//! four gates are [`editable_sequence_item`], the envelope is [`lift_item`] and
//! the join the deletion opens is [`block_the_source_close_would_feed`] — three
//! functions [`plan_move`] calls as well, factored out of it rather than
//! reimplemented beside it. A deletion that took a different set of bytes from the
//! ones a relocation takes would be a second answer to the question `PROGRESS.md`
//! D2o settled, and `a_removal_is_a_move_with_no_landing` in
//! `tests/patch_item.rs` compares the two outputs so the claim is checked rather
//! than asserted.
//!
//! **[`InsertItem`] is the one narrow exception to "no generic primitive may
//! synthesize a collection"**, stated as an exception rather than by weakening the
//! rule: exactly one new flat block-mapping sequence item with scalar fields, at a
//! sequence-item boundary, every value spelled by [`crate::emit::choose_scalar`].
//! It also promotes a bare `matches:` — an implicit null, and a zero-width scalar
//! to the substrate (`PROGRESS.md`, R7) — into its first item, without which that
//! key could never be targeted as a sequence at all. The marker column comes from
//! the sequence's own dashes and the promotion's indentation step from the
//! document's own block children; neither is ever a default while the document has
//! anything to say.
//!
//! A verification layer came with them, and it is [`verify_field`]'s shape:
//! [`verify_items`] re-resolves the sequence by its own path, requires the folded
//! item count, compares every untouched item's subtree digest with itself, and
//! requires an inserted item to be a flat mapping holding exactly the requested
//! decoded fields — decoded twice, by the substrate and by
//! [`crate::emit::decode`], exactly as an inserted entry is.
//!
//! One latent defect was found on the way and fixed:
//! [`leading_comment_block_start`] used to step back **one byte** from a line
//! start, which lands inside a `\r\n` and made the walk stop immediately, so no
//! CRLF document ever had its leading comment block counted as owned. It was
//! reachable by both [`item_own_lines`] and [`entry_owned_runs`], which is why the
//! walk is now written once.
//!
//! # What is *not* here
//!
//! Cross-**document** and cross-**file** moves (plan section 8.4, a UI-phase
//! concern). R16 is **not closed**: byte preservation and conservative emission
//! prevent edits from changing untouched bytes or introducing known YAML
//! 1.1-ambiguous plain scalars, but the UI projection of *pre-existing* plain
//! scalars is not yet proven to match espanso's resolver.

use std::collections::BTreeMap;
use std::fmt;

use serde::Serialize;

use crate::emit::{
    choose_scalar, decode, plain_scalar_is_ambiguous, preserve_scalar, reencode_in_place,
    DecodeError, NotReencodable, ScalarContext, ScalarPlan,
};
use crate::patch::path::{resolve, resolve_full, DocumentPath, PathError, PathSegment, Resolved};
use crate::syntax::{
    ByteSpan, CollectionStyle, HazardKind, Node, NodeId, NodeKind, Punctuation, ScalarPresentation,
    ScalarStyle, SyntaxError, SyntaxIndex, TriviaIndex, TriviaKind,
};
use crate::LineEnding;

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

/// One requested change: give the scalar at `path` this new logical value.
///
/// The value is the **decoded** string the user means — no quotes, no escapes,
/// no block indentation. Choosing how to spell it is
/// [`crate::emit::preserve_scalar`]'s job, and it keeps the scalar's existing
/// presentation wherever the new value still fits in it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScalarEdit {
    /// The value node to rewrite.
    path: DocumentPath,
    /// The new logical value.
    value: String,
}

impl ScalarEdit {
    /// Builds an edit that sets the scalar at `path` to `value`.
    pub fn new(path: DocumentPath, value: impl Into<String>) -> ScalarEdit {
        ScalarEdit {
            path,
            value: value.into(),
        }
    }

    /// The path of the value node this edit rewrites.
    pub fn path(&self) -> &DocumentPath {
        &self.path
    }

    /// The new logical value.
    pub fn value(&self) -> &str {
        &self.value
    }
}

/// One requested change: add a `key: value` entry to a **block** mapping.
///
/// # Where the entry goes, and where its indentation comes from
///
/// The entry is written on its own line, immediately after an **anchor entry**
/// — the mapping's last entry by default, or the entry named by
/// [`FieldInsert::after`]. Every insertion is therefore "after an existing
/// entry", which is what makes the insertion point a single well-defined offset
/// and the bytes written a single well-defined shape.
///
/// Inserting **before the first** entry is deliberately not offered. The first
/// entry of a mapping may share its line with the thing that introduces the
/// mapping — the `-` of a compact `- trigger: x` item — so there is no line to
/// insert before without either stranding that punctuation or re-indenting what
/// follows. `docs/decisions/0c-3a-notes.md` records the choice.
///
/// **The indentation comes from the mapping's own entries and never from a
/// default.** Every key of the mapping must already sit at one column, and the
/// new key is written at exactly that column; a mapping whose keys disagree is
/// refused with [`EditError::InconsistentEntryIndentation`] rather than guessed
/// at. A block mapping always has at least one entry to learn from — an empty
/// block mapping has no YAML spelling — so the "no siblings" case cannot arise
/// here. It can arise for a flow mapping (`{}`), which is refused outright: see
/// [`EditError::FlowCollection`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldInsert {
    /// The mapping to add the entry to.
    mapping: DocumentPath,
    /// The existing entry to write the new one after, by decoded key. `None`
    /// means the mapping's last entry.
    after: Option<String>,
    /// The new entry's key, as a decoded string.
    key: String,
    /// The new entry's value, as a decoded string.
    value: String,
}

impl FieldInsert {
    /// Builds an insertion that appends `key: value` after the mapping's last
    /// entry.
    pub fn new(
        mapping: DocumentPath,
        key: impl Into<String>,
        value: impl Into<String>,
    ) -> FieldInsert {
        FieldInsert {
            mapping,
            after: None,
            key: key.into(),
            value: value.into(),
        }
    } // End of function new()

    /// Builds an insertion that writes `key: value` after the entry whose
    /// decoded key is `sibling`.
    pub fn after(
        mapping: DocumentPath,
        sibling: impl Into<String>,
        key: impl Into<String>,
        value: impl Into<String>,
    ) -> FieldInsert {
        FieldInsert {
            mapping,
            after: Some(sibling.into()),
            key: key.into(),
            value: value.into(),
        }
    } // End of function after()

    /// The mapping the entry is added to.
    pub fn mapping(&self) -> &DocumentPath {
        &self.mapping
    }

    /// The entry the new one is written after, or `None` for the last entry.
    pub fn sibling(&self) -> Option<&str> {
        self.after.as_deref()
    }

    /// The new entry's key.
    pub fn key(&self) -> &str {
        &self.key
    }

    /// The new entry's value.
    pub fn value(&self) -> &str {
        &self.value
    }
} // End of impl FieldInsert

/// One requested change: delete a mapping entry, key, value and trivia
/// together.
///
/// The path names the entry's **value**, exactly as a [`ScalarEdit`]'s does, so
/// `matches[0].label` removes the whole `label:` entry from that match's
/// mapping. The value may be of any kind — a scalar, a nested collection, an
/// empty entry with no value at all.
///
/// # What travels with it
///
/// The envelope is built from `TriviaIndex::subtree_extent` over the entry's
/// **key** and its **value**, so it carries everything the ownership rules
/// (plan section 6.2) attribute to either subtree: the `:` that separates them,
/// the leading comment block immediately above the key, the inline comment
/// after the value, and every anchor, tag and dash inside. The direct queries
/// `items_owned_by` / `comments_owned_by` are **not** used, because trivia is
/// attributed to the deepest node a rule can name and an envelope built from
/// them strands the entry's final inline comment on the entry below
/// (`PROGRESS.md`, D2d).
///
/// The envelope is then widened to whole lines, so no fragment of a deleted
/// entry is left behind. A **blank line** above the entry is layout the file
/// owns rather than trivia the entry owns, and it stays: the user's visual
/// grouping is not ours to delete.
///
/// # The envelope is a set of runs, not one span (`PROGRESS.md`, R21 / D2o)
///
/// `subtree_extent` is a *hull*: the smallest contiguous span covering
/// everything the subtree owns. A comment the ownership rules give to the
/// **file** has no owning node, so it never widens that hull — but one lying
/// between two descendants is inside it anyway, and deleting the hull deleted
/// it. Phase 0c-3a refused such a removal outright; Phase 0c-3b-1 performs it,
/// by expressing the envelope as the **ordered, disjoint set of runs** left when
/// every whole line a file-owned comment occupies, and the blank runs touching
/// those lines, are punched out of the hull. Each run is spliced as its own
/// replacement, so
///
/// ```text
/// a:              →     # keep this file comment
///   x: 1
///   # keep this file comment
///                       b: 3
///   y: 2
/// b: 3
/// ```
///
/// removes `a` and leaves the comment, its indentation and the blank line under
/// it byte-identical. `docs/decisions/0c-3b-1-notes.md` records the derivation
/// and the one shape it still refuses
/// ([`EditError::RemovalWouldExtendABlockScalar`]).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldRemoval {
    /// The value node of the entry to remove.
    field: DocumentPath,
}

impl FieldRemoval {
    /// Builds a removal of the entry `field` names.
    pub fn new(field: DocumentPath) -> FieldRemoval {
        FieldRemoval { field }
    }

    /// The value node of the entry being removed.
    pub fn field(&self) -> &DocumentPath {
        &self.field
    }
} // End of impl FieldRemoval

/// One requested change: relocate a whole **sequence item** inside its own
/// sequence.
///
/// This is plan section 6.3's `MoveSourceBlock`, expressed the way every other
/// edit in this module is expressed — by [`DocumentPath`] rather than by a
/// [`ByteSpan`] the caller supplies. A caller that could name the source bytes
/// could name the wrong ones, and the whole point of `PROGRESS.md` D2j is that
/// the engine derives the bytes from the document.
///
/// # What a move is, mechanically
///
/// **A removal plus an insertion whose replacements do not overlap.** The source
/// half derives exactly the envelope [`FieldRemoval`] derives — the ownership
/// hull widened to whole lines, with the file's own comments and the blank runs
/// beside them punched out — and the destination half writes the bytes those
/// runs hold, verbatim, at a point derived exactly as an insertion's is. There is
/// no second engine and no rendering step: the moved bytes are the source's own.
///
/// # Where it goes
///
/// [`ItemMove::after`] names the item the moved one is written after **by its
/// index in the original sequence**, and [`ItemMove::to_front`] writes it above
/// the sequence's first item. "In the original sequence" matters: the batch is
/// planned against the document as it stands, so an index never means "after the
/// item that will be there afterwards".
///
/// Unlike [`FieldInsert`], a move *can* be asked to go to the front. A mapping's
/// first entry may share its line with the `-` that introduces a compact item, so
/// there is no line to write above it; a sequence item always begins its own line
/// (`removal_span` refuses it otherwise), and the front destination is the start
/// of the first item's own **hull**, so a leading comment block that belongs to
/// that first item stays with it rather than being adopted by the arrival.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemMove {
    /// The sequence item to relocate.
    item: DocumentPath,
    /// The item it is written after, by index in the **original** sequence.
    /// `None` writes it before the sequence's first item.
    after: Option<usize>,
}

impl ItemMove {
    /// Builds a move that writes the item after the sequence's `index`-th item,
    /// counted in the **original** document order.
    pub fn after(item: DocumentPath, index: usize) -> ItemMove {
        ItemMove {
            item,
            after: Some(index),
        }
    }

    /// Builds a move that writes the item above the sequence's first item.
    pub fn to_front(item: DocumentPath) -> ItemMove {
        ItemMove { item, after: None }
    }

    /// The sequence item being relocated.
    pub fn item(&self) -> &DocumentPath {
        &self.item
    }

    /// The index of the item the moved one is written after, or `None` for the
    /// front of the sequence.
    pub fn destination(&self) -> Option<usize> {
        self.after
    }

    /// Where the item ends up, counted in the sequence **after** it has been
    /// taken out, given that it started at `from`.
    ///
    /// **The one spelling of the arithmetic**, and it is public because a caller
    /// that has just committed a move needs to say *which item is the moved one
    /// now* — every identity minted from the previous revision is stale, so
    /// "wherever it was" is not an answer. [`plan_move`] calls this rather than
    /// repeating the two cases, so a caller and the engine cannot disagree about
    /// where the item went.
    ///
    /// An anchor **above** the item keeps its index, because removing the item
    /// does not move anything before it; an anchor **below** it loses one. The
    /// front is index 0 whatever `from` was.
    ///
    /// It is pure arithmetic and validates nothing: an anchor index the sequence
    /// does not have is [`EditError::NoSuchDestinationItem`], and an answer equal
    /// to `from` is [`EditError::MoveChangesNothing`]. Both are [`plan_move`]'s
    /// to make, against a document this function has never seen.
    pub fn resulting_index(&self, from: usize) -> usize {
        match self.after {
            None => 0,
            Some(anchor) if anchor < from => anchor + 1,
            Some(anchor) => anchor,
        }
    } // End of function resulting_index()
} // End of impl ItemMove

/// One requested change: add a whole new **item** to a block sequence.
///
/// # The narrow exception, stated rather than the rule weakened
///
/// > No generic primitive may synthesize a collection. `InsertItem` may
/// > synthesize exactly one new flat block-mapping sequence item with scalar
/// > fields, at a sequence-item boundary.
///
/// That sentence is the whole licence, and every word of it is load-bearing.
/// **One** item, so a caller cannot ask for a list. A **flat block mapping**, so
/// nesting is impossible by construction — [`InsertItem::fields`] is a list of
/// `(key, value)` pairs of decoded strings and there is no shape in which a value
/// can be a collection. **Scalar** fields, every one of them spelled by
/// [`crate::emit::choose_scalar`], the codec every other edit in this module
/// uses; there is deliberately no second speller here, because a second speller
/// is a second answer to "how is this value written". And **at a sequence-item
/// boundary**, which is where [`insertion_point`] puts it: between two items'
/// lines, never inside a node.
///
/// Caller-supplied YAML is not accepted, and that is the same decision the
/// frontend boundary already makes for a match draft: spelling, indentation,
/// structure and injection risk would move into the caller, which is exactly the
/// place this crate exists to take them away from.
///
/// # Where the item goes
///
/// [`InsertItem::after`] names the item the new one is written after, **by its
/// index in the original sequence**; [`InsertItem::new`] appends after the
/// sequence's last item. Every insertion is therefore "after an existing item",
/// which is what makes the insertion point a single well-defined offset — the
/// same reason [`FieldInsert`] does not offer "before the first entry".
///
/// # Where the indentation comes from
///
/// **From the sequence's own items, and never from a default.** Every item's `-`
/// marker must already sit at one column — the column the ownership layer
/// records for that item's own [`crate::syntax::Punctuation::SequenceDash`] — and
/// the new item is written at exactly that column, with its keys two columns
/// further in. A sequence whose items disagree is refused with
/// [`EditError::InconsistentSequenceIndentation`] rather than given a majority
/// spelling: a majority is this crate deciding how the user's file should look.
///
/// The line ending is copied, never chosen ([`line_ending_before`]), exactly as
/// [`FieldInsert`]'s is.
///
/// # The one collection this may bring into existence
///
/// A mapping entry written `matches:` with no value at all is an **implicit
/// null**, and the substrate reports it as a zero-width scalar (`PROGRESS.md`,
/// R7). Without an exception it could never be targeted as a sequence, so
/// `InsertItem` **promotes** it into its first block-sequence item. The
/// mapping-key indentation comes from the `matches:` line, the indentation step
/// from the block children of the same surrounding mapping, then from the
/// document's own dominant step, and only from the renderer's two-column default
/// when the document offers no evidence at all. Any inline comment on the
/// `matches:` line is preserved, because the insertion point is derived past it.
///
/// When the promotion would require deciding whether a **standalone comment**
/// under the `matches:` line belongs to the absent value or to the next mapping
/// entry, it is refused with
/// [`EditError::ImplicitNullSequenceHasAmbiguousTrivia`].
///
/// # What is refused outright
///
/// A **flow** sequence, empty (`matches: []`) or not
/// ([`EditError::FlowSequenceInsertionUnsupported`]). Converting flow to block
/// would rewrite an existing collection's presentation, which is a change to
/// bytes nobody asked about.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InsertItem {
    /// The sequence the item joins, or the implicit-null mapping value that is
    /// promoted into one.
    sequence: DocumentPath,
    /// The item it is written after, by index in the **original** sequence.
    /// `None` appends after the sequence's last item.
    after: Option<usize>,
    /// The new item's fields, as decoded key/value pairs, in write order.
    fields: Vec<(String, String)>,
}

impl InsertItem {
    /// Builds an insertion that appends the item after the sequence's last item.
    pub fn new(sequence: DocumentPath, fields: Vec<(String, String)>) -> InsertItem {
        InsertItem {
            sequence,
            after: None,
            fields,
        }
    } // End of function new()

    /// Builds an insertion that writes the item after the sequence's `index`-th
    /// item, counted in the **original** document order.
    pub fn after(
        sequence: DocumentPath,
        index: usize,
        fields: Vec<(String, String)>,
    ) -> InsertItem {
        InsertItem {
            sequence,
            after: Some(index),
            fields,
        }
    } // End of function after()

    /// The sequence the item joins.
    pub fn sequence(&self) -> &DocumentPath {
        &self.sequence
    }

    /// The index of the item the new one is written after, or `None` for the end
    /// of the sequence.
    pub fn destination(&self) -> Option<usize> {
        self.after
    }

    /// The new item's fields, as decoded key/value pairs, in write order.
    pub fn fields(&self) -> &[(String, String)] {
        &self.fields
    }
} // End of impl InsertItem

/// One requested change: delete a whole **sequence item**, trivia and all.
///
/// # It is [`ItemMove`]'s lift half, with no landing
///
/// Not "the same idea as", and not "an implementation that agrees with": the
/// envelope derivation is [`lift_item`] and the join the deletion opens is
/// [`block_the_source_close_would_feed`], and [`plan_move`] calls both of those
/// same functions. A removal that deleted a different set of bytes from the ones
/// a move lifts would be a second answer to a question `PROGRESS.md` D2o already
/// spent a whole phase on, and two answers are one more than the document has.
///
/// # What travels with it
///
/// Everything [`FieldRemoval`] takes for a mapping entry, derived by the same
/// call: the ownership hull widened to whole lines, with the **file's** own
/// comments and the blank runs beside them punched out. So the item's leading
/// comment block and its inline comment go with it — leaving them behind would
/// strand a comment describing something that is no longer there — while a
/// comment the blank-line rule gives to the file stays exactly where it is,
/// byte-identical, and so does every byte the surviving neighbours own.
///
/// # Removing the only item is refused, by name
///
/// [`EditError::RemovalWouldEmptyTheSequence`]. Writing `matches: []` in its
/// place would synthesize a collection *and* choose a presentation for it;
/// leaving `matches:` bare would turn a sequence into YAML null. Neither is
/// "remove one existing item", and picking either would be this crate deciding
/// what the user's file means.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoveItem {
    /// The sequence item to delete, addressed as `sequence[index]` — the same
    /// one path shape [`ItemMove::item`] takes, because this is that operation's
    /// lift half.
    item: DocumentPath,
}

impl RemoveItem {
    /// Builds a removal of the sequence item `item` names.
    pub fn new(item: DocumentPath) -> RemoveItem {
        RemoveItem { item }
    }

    /// The sequence item being deleted.
    pub fn item(&self) -> &DocumentPath {
        &self.item
    }
} // End of impl RemoveItem

/// One requested change of any kind, for [`apply_edits`].
///
/// The batch protocol is written once, over this enum, rather than once per
/// edit kind: planning against the original index, rejecting overlaps, splicing
/// from the highest offset downwards and reparsing to verify are the same steps
/// whatever the edit is, and a second engine would be a second place for them to
/// drift.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocumentEdit {
    /// Give an existing scalar a new value.
    Scalar(ScalarEdit),
    /// Add an entry to a mapping.
    InsertField(FieldInsert),
    /// Delete an entry from a mapping.
    RemoveField(FieldRemoval),
    /// Relocate a whole sequence item inside its own sequence.
    MoveItem(ItemMove),
    /// Add one new flat block-mapping item to a sequence.
    InsertItem(InsertItem),
    /// Delete one whole item from a sequence.
    RemoveItem(RemoveItem),
}

impl From<ScalarEdit> for DocumentEdit {
    fn from(edit: ScalarEdit) -> DocumentEdit {
        DocumentEdit::Scalar(edit)
    }
}

impl From<FieldInsert> for DocumentEdit {
    fn from(edit: FieldInsert) -> DocumentEdit {
        DocumentEdit::InsertField(edit)
    }
}

impl From<FieldRemoval> for DocumentEdit {
    fn from(edit: FieldRemoval) -> DocumentEdit {
        DocumentEdit::RemoveField(edit)
    }
}

impl From<ItemMove> for DocumentEdit {
    fn from(edit: ItemMove) -> DocumentEdit {
        DocumentEdit::MoveItem(edit)
    }
}

impl From<InsertItem> for DocumentEdit {
    fn from(edit: InsertItem) -> DocumentEdit {
        DocumentEdit::InsertItem(edit)
    }
}

impl From<RemoveItem> for DocumentEdit {
    fn from(edit: RemoveItem) -> DocumentEdit {
        DocumentEdit::RemoveItem(edit)
    }
}

// ---------------------------------------------------------------------------
// The outcome
// ---------------------------------------------------------------------------

/// One byte-span replacement that was applied.
///
/// [`Replacement::span`] is a span of the **original** document and
/// [`Replacement::text`] the bytes written in its place, so the pair is enough
/// to re-derive the candidate — and to check, independently of the code that
/// produced it, that nothing outside the span moved.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Replacement {
    /// The replaced range, in original-document coordinates.
    pub span: ByteSpan,
    /// The bytes written in its place.
    pub text: String,
}

/// A presentation change an edit had to make, surfaced rather than performed
/// silently (plan section 6.2: "never silently normalise").
///
/// A note is *not* a failure. It says that the scalar's spelling changed as
/// well as its value — a `>` folded block rewritten as `|`, an escaped
/// double-quoted scalar re-escaped canonically, a plain scalar requoted because
/// the new value is no longer plain-safe. Every note describes bytes **inside**
/// the edited scalar; bytes outside it are byte-identical either way.
///
/// **On the wire since Phase 2b-2a**, as the `notes` of a successful save
/// (`SaveResult::Saved` in `src-tauri/src/save.rs`). Plan section 6.2's rule —
/// never silently normalise — is only kept if the note reaches a person, and a
/// note that stops at the Rust boundary is a note nobody reads.
///
/// [`PresentationNote::edit`] is a **position in the requested batch**, not an
/// identifier: it indexes the `edits` slice the caller handed
/// [`apply_edits`], and it means nothing to a caller that did not send that
/// slice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PresentationNote {
    /// Position of the edit in the requested batch.
    pub edit: usize,
    /// The style the scalar was written in.
    pub from: ScalarStyle,
    /// The style it is written in now.
    pub to: ScalarStyle,
    /// Why the old presentation could not be reproduced byte for byte, when
    /// [`crate::emit::reencode_in_place`] could name a reason.
    pub reason: Option<NotReencodable>,
}

/// A candidate document that has been reparsed and verified.
///
/// The only way to build one is [`apply_scalar_edits`], and it only returns one
/// after `verify` has passed. That is the whole point of the type: there is
/// no path from a verification failure to bytes a caller could write to disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchedDocument {
    /// The candidate text.
    text: String,
    /// Every replacement that produced it, in ascending span order.
    replacements: Vec<Replacement>,
    /// Presentation changes the caller should tell the user about.
    notes: Vec<PresentationNote>,
}

impl PatchedDocument {
    /// The verified candidate text.
    pub fn text(&self) -> &str {
        &self.text
    }

    /// Every replacement that produced it, in ascending span order.
    pub fn replacements(&self) -> &[Replacement] {
        &self.replacements
    }

    /// Presentation changes the caller should surface to the user.
    pub fn notes(&self) -> &[PresentationNote] {
        &self.notes
    }

    /// Consumes the document and returns its text.
    pub fn into_text(self) -> String {
        self.text
    }
}

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

/// Why an edit was not applied.
///
/// These are **diagnostics, not user-facing prose** — every string a user reads
/// goes through the frontend i18n layer (plan section 9), exactly as
/// [`PathError`] already documents. No variant carries scalar text, because the
/// real-file corpus is private (`CLAUDE.md` section 1) and these errors are
/// printed by tests that run over it: spans, lengths and counts only.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum EditError {
    /// The document does not parse, so nothing in it can be addressed.
    SourceDoesNotParse(SyntaxError),
    /// The path names nothing in this document.
    Unresolvable {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// What the resolver said.
        error: PathError,
    },
    /// The path names a node that is not a scalar.
    ///
    /// A collection cannot be given a scalar value by a span replacement; that
    /// is a structural edit, and structural edits are step 0c-3.
    NotAScalar {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The node the path named.
        node: NodeId,
        /// What that node actually is.
        kind: NodeKind,
    },
    /// The path names an **empty or implicit** scalar, which owns no bytes.
    ///
    /// `empty:` and a bare `- ` are reported by the substrate as zero-width
    /// scalars (`PROGRESS.md`, R7), positioned before the punctuation that
    /// introduces them. Writing into a zero-width span would splice the value
    /// onto the wrong side of a `:` or a `-`, so giving such an entry a value
    /// is a structural edit — 0c-3's problem — rather than a span replacement.
    EmptyTarget {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The zero-width node.
        node: NodeId,
        /// Where it sits.
        at: ByteSpan,
    },
    /// The hazard gate refused the target.
    ///
    /// This is `TriviaIndex::is_safely_editable` answering no, consulted by
    /// this module rather than by its caller. The hazard may sit on the node,
    /// on an ancestor, on a descendant, or on no node at all — in which case it
    /// disqualifies the whole document.
    Refused {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The node that was to be edited.
        node: NodeId,
        /// What the gate objected to.
        hazard: HazardKind,
        /// The bytes that raised the hazard.
        at: ByteSpan,
    },
    /// Two edits in one batch would rewrite overlapping bytes.
    ///
    /// Their order would decide the result, so there is no answer to give.
    /// Requesting the same path twice lands here as well.
    OverlappingEdits {
        /// The earlier span.
        first: ByteSpan,
        /// The span that overlaps it.
        second: ByteSpan,
    },
    /// The value's trailing newlines cannot be spelled without rewriting bytes
    /// outside the scalar.
    ///
    /// A `|+` block's value ends in as many line breaks as the file physically
    /// holds after its last content line. When the document already holds more
    /// of them than the new value wants, the surplus cannot be removed without
    /// editing trivia this step does not own.
    TrailingNewlinesNotRepresentable {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// How many trailing newlines the new value has.
        wanted: usize,
        /// How many line breaks already follow the scalar's content.
        following: usize,
    },
    /// A span did not slice the source. Always a bug in this crate.
    MalformedSpan {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The span that failed to slice.
        at: ByteSpan,
    },
    /// A structural edit named something that is not a mapping.
    ///
    /// [`FieldInsert`] takes the mapping the entry joins, and [`FieldRemoval`]
    /// takes an entry of one; a sequence item is addressed by position and has
    /// no key to remove, so it is a different operation.
    NotAMapping {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The node the path named.
        node: NodeId,
        /// What that node actually is.
        kind: NodeKind,
    },
    /// A structural edit named a **flow** collection, or something inside one.
    ///
    /// This is a deliberate, documented refusal rather than an oversight, and it
    /// is where flow context parts company with `PROGRESS.md` D2k. D2k threads
    /// flow context into *rendering*, so a scalar edit inside `{…}`/`[…]` writes
    /// flow-legal bytes and is allowed. A **structural** edit is a different
    /// problem: `{a: 1, b: 2}` has no line of its own to add an entry to and no
    /// line to delete, so an insertion or a removal there is a question about
    /// commas and spacing rather than about lines, with no answer this phase has
    /// measured. An empty flow mapping `{}` additionally has no sibling entry to
    /// take an indentation from, which is the "no siblings to learn from" case.
    FlowCollection {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The flow collection, or the entry inside one.
        node: NodeId,
    },
    /// An insertion would give the mapping a key it already has.
    ///
    /// Two entries with the same key make every path through the mapping
    /// ambiguous (`PathError::DuplicateKey`) and raise
    /// [`HazardKind::DuplicateMappingKey`], so the mapping would become
    /// uneditable the moment the edit landed. Carries no key text: the real
    /// corpus is private (`CLAUDE.md` section 1).
    KeyAlreadyPresent {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The mapping that already has it.
        mapping: NodeId,
    },
    /// [`FieldInsert::after`] named an entry the mapping does not have.
    NoSuchSibling {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The mapping that was searched.
        mapping: NodeId,
    },
    /// The mapping's keys do not all start at one column.
    ///
    /// An inserted entry's indentation comes from its siblings and from nothing
    /// else, so a mapping that cannot agree with itself about where its keys go
    /// has no answer to give. Every block mapping in both corpora does agree;
    /// this exists so that the one that does not is refused rather than guessed
    /// at.
    InconsistentEntryIndentation {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The mapping whose keys disagree.
        mapping: NodeId,
        /// The column its first key sits at.
        expected: usize,
        /// The column that disagreed with it.
        found: usize,
    },
    /// The entry does not occupy whole lines of its own.
    ///
    /// A removal deletes lines, and an insertion writes one, so both need the
    /// entry they work from to begin its own line and end it. The reachable case
    /// is the **first entry of a compact `- key: value` mapping**, which shares
    /// its line with the `-` that introduces the mapping: deleting it either
    /// strands a bare dash or re-indents everything below, and neither is an
    /// edit the user asked for.
    EntryDoesNotOwnItsLines {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The bytes that share the entry's line.
        at: ByteSpan,
    },
    /// Removing this entry would lengthen a **keep-chomped block scalar** that
    /// sits above it.
    ///
    /// A `|+` block's value is every line break physically present after its
    /// last content line, so the bytes that terminate it are not its own. Delete
    /// the entry that terminates one and the blank line below moves up into the
    /// value: `a: |+` / `  x` / blank / `b: 1` / blank / `c: 2` becomes a
    /// document whose `a` decodes with one newline more. Nothing about the
    /// removal is wrong; the neighbour's value simply is not local, so this step
    /// refuses rather than silently changing a value nobody edited.
    ///
    /// Found by the sibling check, on corpus data, rather than reasoned about in
    /// advance — `block-scalar-leading-blank-lines.yml` has exactly this shape.
    RemovalWouldExtendAKeptBlock {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The block scalar whose value would grow.
        block: NodeId,
    },
    /// A run of the removal's envelope still covers a comment the **file** owns.
    ///
    /// # What this variant means since Phase 0c-3b-1, and what it no longer means
    ///
    /// It is **no longer a policy**. Phase 0c-3a refused every removal whose
    /// contiguous hull crossed a file-owned comment, because one [`ByteSpan`]
    /// cannot say "delete the entry but keep that comment". The envelope is now a
    /// set of runs with those comments punched out (see [`FieldRemoval`]), so the
    /// removal that used to be refused is performed.
    ///
    /// What is left is an **assertion on the derived run set**: after the runs
    /// have been computed, no run may intersect any comment
    /// `TriviaIndex::file_comments` gives to the file. It reads the document's own
    /// ownership answer, not the arithmetic that produced the runs, so an
    /// off-by-one in the punch-out is caught by it rather than by the user's file.
    ///
    /// It is argued unreachable — every file-owned comment occupies whole lines
    /// that lie strictly inside the hull, and the punch-out removes whole lines —
    /// and the sweep in `tests/patch_structure.rs` pins it at **0** over both
    /// corpora. The layer is nonetheless live rather than decorative: disabling
    /// the punch-out makes it fire on the D2o example, which
    /// `docs/decisions/0c-3b-1-notes.md` records as the first of the three
    /// visibility experiments.
    ///
    /// Carries the comment's span and never its text: the real corpus is private
    /// (`CLAUDE.md` section 1).
    RemovalWouldDeleteAFileComment {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Where the comment sits in the original document.
        comment: ByteSpan,
    },
    /// The bytes this removal would leave behind would join a **block scalar**.
    ///
    /// The residual shape a run-based envelope cannot express, and the reason
    /// [`EditError::RemovalWouldDeleteAFileComment`] did not simply disappear
    /// into it. A removal that keeps a file-owned comment leaves that comment's
    /// lines exactly where they are — and a comment line directly under a block
    /// scalar's content, indented to at least the block's own body column, is
    /// **content of that block** rather than a comment at all:
    ///
    /// ```text
    /// replace: |
    ///   body
    /// vars:
    ///   first: 'one'
    ///   # a comment the file owns
    ///
    ///   second: 'two'
    /// ```
    ///
    /// Removing `vars` while keeping the comment would put `# a comment the file
    /// owns` immediately below `body` at the same indentation, so `replace`
    /// decodes with an extra line although nothing about it was edited. That is
    /// the same class as [`EditError::RemovalWouldExtendAKeptBlock`] — a
    /// neighbour's value is not local — reached from the other direction: that one
    /// is about blank lines a *deletion* hands to a keep-chomped block, this one
    /// about bytes a *preservation* hands to any block.
    ///
    /// **The condition compares columns, and the Phase 0c-3b-1 review's finding 2
    /// is why.** It fires when the removal has something to preserve, *and* some
    /// block scalar's content ends at or before the envelope's first run with
    /// nothing but blank lines in between, *and* the first non-blank line the
    /// removal preserves sits at that block's own body column or deeper. Without
    /// the third clause the refusal was over-broad: the reviewer's `>` block above
    /// a **column-zero** comment was turned down although a line shallower than
    /// the body column ends the block instead of extending it, so nothing about
    /// the block's value could change. The body column is
    /// [`ScalarPresentation::indent`], read off the span layer rather than
    /// re-lexed; the one block with no observed body column — an empty content
    /// span — is still refused whatever the comment's column is. See
    /// `block_scalar_the_kept_bytes_would_join` in this module.
    ///
    /// It costs the synthetic corpus one attempt, in the fixture written for it,
    /// and the real corpus nothing.
    ///
    /// # A second condition since Phase 2b-2c-1, and why it is the same variant
    ///
    /// [`plan_item_removal`] also reports it for the **source-gap join** a lift
    /// opens: what followed the deleted item rises to sit under what preceded it,
    /// and a line that lands at or past a block's body column directly under that
    /// block's content becomes part of the value. The two conditions are the same
    /// sentence read from either side of the deletion — *the bytes this removal
    /// leaves behind would join a block scalar* — which is what this variant's own
    /// summary line already said, and [`block_absorbing_a_line`] is the one
    /// implementation both consult. A move reports the identical condition as
    /// [`EditError::MoveWouldExtendABlockScalar`] at [`MoveSeam::SourceCloses`],
    /// because a move has three other seams to tell it apart from.
    ///
    /// A **mapping entry's** removal does not ask it: its neighbours' keys all sit
    /// at one column, shallower than any block body inside the entry above, so the
    /// line that rises always ends the block instead of extending it. A sequence
    /// item's next-door neighbour can be a leading comment block at a column the
    /// user chose, and that is the case this reaches.
    RemovalWouldExtendABlockScalar {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The block scalar whose value would grow.
        block: NodeId,
    },
    /// An insertion found no line break it could copy.
    ///
    /// A new entry needs a line terminator, and this step **never invents one**.
    /// It copies the break that ends the anchor's own line, or — when the anchor
    /// ends the file — the last break before the insertion point, which is a
    /// nearby sibling's. Two documents supply neither: one with no line break at
    /// all (`a: 1` with no final newline), and one whose only breaks are bare
    /// carriage returns, which [`LineEnding`] cannot express.
    ///
    /// Defaulting to LF is what `LineEnding::detect` does for a single-line
    /// document, and writing that into a file is precisely the silent
    /// reformatting this crate exists to prevent, so the edit is refused
    /// instead.
    NoObservableLineEnding {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Where the new entry would have gone.
        at: usize,
    },
    /// Removing this entry would leave the mapping with none.
    ///
    /// `a:` with nothing under it is not the same document as `a: {…}` with one
    /// entry: the mapping becomes an implicit null, which changes what the file
    /// means rather than what it contains. Emptying a mapping is a decision
    /// about the *parent* entry — remove that instead — so this step refuses.
    ///
    /// A **batch** lands here too, and by the same reasoning: two removals that
    /// are individually legal can still take a two-entry mapping down to none,
    /// and a batch that asks for more removals than the mapping has entries is
    /// the degenerate case of that. Both are caught when the batch's claims are
    /// folded together, because only the folded claim knows how many removals
    /// one mapping received.
    LastEntryOfMapping {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The mapping that would be emptied.
        mapping: NodeId,
    },
    /// A move or a removal named something that is not an item of a **block
    /// sequence**.
    ///
    /// [`ItemMove`] relocates a sequence item and [`RemoveItem`] deletes one, so
    /// the path must end in an index segment whose parent is a sequence — both go
    /// through [`editable_sequence_item`], which is why they cannot disagree about
    /// what is addressable. A mapping entry is a different operation: it has a
    /// key, so removing it is [`FieldRemoval`] and moving it is a question about
    /// key order that no phase has measured.
    NotASequenceItem {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The node the path named.
        node: NodeId,
        /// What its parent actually is.
        kind: NodeKind,
    },
    /// [`ItemMove::after`] named an index the sequence does not have.
    NoSuchDestinationItem {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The sequence that was searched.
        sequence: NodeId,
        /// How many items it has.
        items: usize,
    },
    /// The move would leave the item exactly where it already is.
    ///
    /// Three requests land here, and they are the same request: moving the first
    /// item to the front, moving an item after itself, and moving an item after
    /// its immediate predecessor. All three leave the sequence in the order it
    /// was already in, so there is nothing to verify and nothing to undo.
    ///
    /// It is refused rather than answered with the document unchanged, because
    /// the bytes would **not** be unchanged: an item whose ownership hull is
    /// split by a comment the file owns would be lifted over that comment and
    /// written back below it, which is a real edit nobody asked for.
    MoveChangesNothing {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The item that is already where it was asked to go.
        item: NodeId,
    },
    /// A batch that contains a move contains something else as well.
    ///
    /// **A deliberate scope limit of Phase 0c-3b-2a, not an invariant.** It is
    /// recorded as a restriction because that is what it is: making move
    /// verification *compositional* is real work that this phase did not do, and
    /// the batch is refused rather than half-verified.
    ///
    /// The whole-document expectation a move is checked against is the original
    /// document plus one permutation of the sequence's child positions. A second
    /// edit in the same batch changes what the candidate must say, so the
    /// expectation would have to model it — and the reviewer of this phase is right
    /// that doing so is not circular in itself: verifying a caller-requested scalar
    /// value against the caller's intended value is exactly how a scalar edit is
    /// already verified, and a combined expectation could apply the permutation and
    /// exempt precisely the independently verified rewritten node, as
    /// `fold_expectations` already does for field batching. The earlier claim that
    /// a combined expectation would be "authorised by the very declaration it
    /// exists to check" was too strong and is withdrawn.
    ///
    /// # What the restriction costs
    ///
    /// - A safe, obvious request is refused: *move this match, and change its
    ///   `replace` value*. The caller must send two batches.
    /// - [`EditError::OverlappingEdits`] is consequently **never exercised against
    ///   a conflict between a move and another edit**, because this check rejects
    ///   such a batch before overlap analysis runs. Its coverage is the scalar and
    ///   structural cases only.
    ///
    /// Lifting it belongs to whichever phase makes the move expectation
    /// compositional; nothing here depends on it staying.
    MoveMustBeTheOnlyEditInItsBatch {
        /// Position of the move in the requested batch.
        edit: usize,
        /// How many edits the batch holds.
        edits: usize,
    },
    /// Relocating this item would invent or destroy a line break.
    ///
    /// The item is the document's **last line and that line has no terminator**,
    /// so the bytes it occupies end without a break. Writing them anywhere but the
    /// end of the file would need a break the move does not carry — inventing one
    /// is the silent reformatting `PROGRESS.md` D2p forbids — and taking one from
    /// the line above instead would delete a blank line the file holds.
    ///
    /// Two fixtures reach it, both of them files whose bytes are the test data:
    /// `no-trailing-newline.yml`'s family, and `block-scalar-terminal-spaces.yml`,
    /// whose last item ends in genuine trailing spaces at end of source (R11).
    MoveWouldInventALineEnding {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Where the item's bytes end, which is the end of the document.
        at: usize,
    },
    /// The destination is the end of a document whose last line has **no
    /// terminator**, so writing the item there would give that line one.
    ///
    /// **The twin of [`EditError::MoveWouldInventALineEnding`], and deliberately a
    /// separate variant rather than a second reason inside it.** That one is about
    /// the *moved* item's own last line; this one is about a line the move does not
    /// touch at all. Folding two distinct conditions into one measured figure is
    /// how the quoted-scalar overshoot hid for three phases (`PROGRESS.md`, R20),
    /// so they are named and counted apart.
    ///
    /// # Why this is refused rather than rotated
    ///
    /// Phase 0c-3b-2a first answered this case by taking the carried item's own
    /// trailing break and writing it **in front of** the item instead of behind
    /// it: the document still ends unterminated, the byte count is unchanged, and
    /// every whole-document property certifies the result. Its review demonstrated
    /// that the certification is worthless here, because the break now terminates
    /// the **previously unterminated destination line** — a line the edit never
    /// named — and that break may not even be the style its neighbours use. In a
    /// document whose last line is bare-LF-terminated elsewhere and whose moved
    /// item ends in CRLF, the untouched line acquires a CRLF the user never wrote.
    ///
    /// `PROGRESS.md` D2p is explicit: **copy the break already in use where the
    /// bytes land, or refuse when there is no such evidence.** At an unterminated
    /// end of file there is no such break, so this refuses. Overriding a recorded
    /// decision is not a phase's call to make, and the refusal costs one rare edit:
    /// moving a match to the very end of a file that has no final newline.
    MoveWouldTerminateTheFinalLine {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The end of the document, which is where the bytes would land.
        at: usize,
    },
    /// The **block scalar the moved item ends with** would decode differently
    /// where the move puts it.
    ///
    /// The mirror of [`EditError::RemovalWouldExtendAKeptBlock`], and the shape a
    /// removal cannot have: that one is about a keep-chomped block *above* the
    /// deleted lines gaining the blank lines below them, this one about a
    /// keep-chomped block *inside* the relocated lines meeting different bytes
    /// when it lands. A `|+` block's value is every line break physically present
    /// after its last content line, and those breaks belong to whatever follows
    /// the block rather than to the block itself, so they are not something a
    /// move can carry.
    ///
    /// One clause, about the block whose content ends the item's own bytes with
    /// nothing but blank lines between it and the end: the block is
    /// **keep-chomped** and the first line at the destination is **blank**, so the
    /// block would gain that break.
    ///
    /// A second clause used to sit beside it — the move *rotating* a line ending
    /// at an unterminated end of file, which a clip-chomped block also counts.
    /// [`EditError::MoveWouldTerminateTheFinalLine`] refuses that destination
    /// outright since the Phase 0c-3b-2a review, so no move rotates anything and
    /// the clause had nothing left to describe.
    ///
    /// Found on corpus data rather than reasoned about in advance:
    /// `scalar-styles.yml`'s `:literal-keep` match is exactly this shape, and the
    /// whole-document invariant caught it before this refusal existed.
    MoveWouldExtendAKeptBlock {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The block scalar whose value would change.
        block: NodeId,
    },
    /// A **block scalar** would swallow a line the move puts under it.
    ///
    /// The move's version of [`EditError::RemovalWouldExtendABlockScalar`], and
    /// it fires at several distinct seams because a move creates several joins
    /// where a removal creates one: three external ones, plus one internal join for
    /// every adjacent pair of carried runs. Each is the same condition — some block scalar's
    /// content ends directly above the line in question, with nothing but blank
    /// lines in between, and that line sits at the block's own body column or
    /// deeper — asked at a different place; see [`MoveSeam`].
    ///
    /// The body column is [`ScalarPresentation::indent`], read off the span layer
    /// and never re-lexed, exactly as the removal's twin reads it, and a block
    /// whose content span is **empty** is refused whatever the column is, for the
    /// same reason: `indent` then holds the header's column rather than any
    /// observed body's.
    ///
    /// **A move re-indents nothing**, which is why the condition is a column
    /// comparison and not a column *computation*: the source and the destination
    /// are two positions in one block sequence, so both sit at the same column by
    /// construction and the bytes travel verbatim. What varies is the column of the
    /// moved item's own leading comment block, which the user chose and the move
    /// preserves.
    MoveWouldExtendABlockScalar {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The block scalar whose value would grow.
        block: NodeId,
        /// Which of the joins the move creates would feed it.
        seam: MoveSeam,
    },
    /// An insertion or a removal named something that is not a **sequence**.
    ///
    /// [`InsertItem`] takes the sequence the item joins, so its path must name a
    /// block sequence — or the one thing this step may promote into one, a
    /// mapping value written with no value at all (`PROGRESS.md`, R7). A mapping,
    /// a scalar with bytes of its own, or a sequence item is a different
    /// operation.
    NotASequence {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The node the path named.
        node: NodeId,
        /// What that node actually is.
        kind: NodeKind,
    },
    /// The item to be inserted holds no fields at all.
    ///
    /// A block-mapping sequence item with no entries has no YAML spelling: `- `
    /// alone is a null item, which is a different document rather than a smaller
    /// one. The same reasoning [`EditError::LastEntryOfMapping`] makes about
    /// emptying a mapping, made before anything is written rather than after.
    InsertedItemHasNoFields {
        /// Position of the edit in the requested batch.
        edit: usize,
    },
    /// Two of the inserted item's fields share a key.
    ///
    /// The item would be born with a duplicate mapping key, which makes every
    /// path through it ambiguous (`PathError::DuplicateKey`) and raises
    /// [`HazardKind::DuplicateMappingKey`] — so the item would be uneditable the
    /// moment it landed. Carries the field's **position**, never its key text:
    /// the real corpus is private (`CLAUDE.md` section 1).
    DuplicateInsertedField {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Position of the offending field in the requested field list.
        field: usize,
    },
    /// One of the inserted item's keys is not a key this step will write.
    ///
    /// Two shapes are refused, and both would produce something no caller means:
    /// an **empty** key, which spells as `'': value` and reads as a mapping entry
    /// with no name; and a key holding a **line break**, which has no block
    /// spelling in key position ([`crate::emit::ScalarContext::can_hold_a_block_scalar`]
    /// is false for a key) and would come back as a double-quoted `"a\nb"`.
    ///
    /// Carries the field's position, never its key text (`CLAUDE.md` section 1).
    InvalidInsertedFieldKey {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Position of the offending field in the requested field list.
        field: usize,
    },
    /// The sequence is bracket-delimited, or sits inside something that is.
    ///
    /// **A deliberate, documented refusal.** `matches: []` and
    /// `triggers: [":a", ":b"]` have no line of their own to add an item to, so
    /// inserting there is a question about commas and spacing rather than about
    /// lines — and the tempting answer, rewriting the collection as a block one,
    /// changes the presentation of bytes the user never asked about. It is the
    /// same argument [`EditError::FlowCollection`] makes for a mapping entry,
    /// named separately because an *empty* flow sequence is the shape a caller
    /// most plausibly expects to be able to add to.
    FlowSequenceInsertionUnsupported {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The flow sequence, or the sequence inside one.
        sequence: NodeId,
    },
    /// The sequence's items do not all start at one column.
    ///
    /// An inserted item's indentation comes from its siblings and from nothing
    /// else, so a sequence that cannot agree with itself about where its `-`
    /// markers go has no answer to give. **Never a majority spelling**: a
    /// majority is this crate choosing how the user's file should look, which is
    /// the one thing it exists not to do. The twin of
    /// [`EditError::InconsistentEntryIndentation`], measured on the ownership
    /// layer's own dash positions rather than re-lexed.
    ///
    /// **Argued unreachable, and kept anyway.** YAML ends a block sequence at the
    /// first line shallower than its items and reads a deeper `-` as content of
    /// the item above it, so a document whose dashes disagree is not one sequence
    /// and the substrate refuses it before this engine sees a node —
    /// `a_sequence_cannot_disagree_with_itself_about_its_dash_column` in
    /// `tests/patch_item.rs` is the record of that. It stays because "the
    /// substrate always agrees" is a claim about a pre-1.0 dependency
    /// (`PROGRESS.md`, R1), and a named refusal costs nothing while the guess it
    /// replaces would cost a user their indentation.
    InconsistentSequenceIndentation {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The sequence whose items disagree.
        sequence: NodeId,
        /// The column its first item's dash sits at.
        expected: usize,
        /// The column that disagreed with it.
        found: usize,
    },
    /// Promoting this implicit null would have to decide who owns a comment.
    ///
    /// The one refusal the promotion carries. A mapping entry written `matches:`
    /// with a **standalone comment** on the line below it is genuinely ambiguous:
    /// under plan section 6.2's rule 1 that comment introduces whatever comes
    /// next, and materialising a sequence under the key changes what comes next.
    /// Deciding it either way would re-attribute a comment the user wrote, which
    /// is precisely the change [`VerificationFailure::CommentOwnershipChanged`]
    /// exists to catch after the fact — so it is refused before the fact instead.
    ///
    /// A comment separated by a **blank line** is not ambiguous: rule 2 gives it
    /// to the file, and the file keeps it wherever the insertion lands.
    ImplicitNullSequenceHasAmbiguousTrivia {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Where the new item would have gone.
        at: usize,
    },
    /// Removing this item would leave the sequence with none.
    ///
    /// The sequence's counterpart of [`EditError::LastEntryOfMapping`], and it is
    /// refused for the reason that one is: there is no way to spell the result
    /// that is still "remove one existing item". Writing `matches: []` would
    /// synthesize a collection **and** choose a presentation for it, which no
    /// generic primitive may do; leaving `matches:` bare would turn the sequence
    /// into YAML null, which changes what the file means rather than what it
    /// contains. Emptying a sequence is a decision about the *entry that holds
    /// it* — remove that instead.
    ///
    /// A **batch** lands here too, and by the same reasoning as
    /// [`EditError::LastEntryOfMapping`]: two removals that are individually
    /// legal can still take a two-item sequence down to none, and only the folded
    /// claim knows how many removals one sequence received.
    RemovalWouldEmptyTheSequence {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The sequence that would be emptied.
        sequence: NodeId,
    },
    /// The candidate document failed verification and was discarded.
    Verification(VerificationFailure),
}

/// Which join a [`EditError::MoveWouldExtendABlockScalar`] refusal is about.
///
/// A removal creates one seam — what follows the deleted lines rises to sit under
/// what preceded them. A move creates **three external ones plus one internal
/// seam for every adjacent pair of carried runs**, and they are counted separately
/// rather than folded into one figure (`PROGRESS.md`, R20): two distinct
/// overshoots inside one number is exactly how the quoted-scalar overshoot hid for
/// three phases.
///
/// # Why three is not the whole set
///
/// Phase 0c-3b-2a claimed three, and its review disproved the claim. Since D2o an
/// envelope is a **set of runs** with the file's own comments punched out of it,
/// and the runs are concatenated at the destination — so every hole in the
/// envelope becomes a *new* adjacency that exists nowhere in the original
/// document. A run ending in a block scalar's body followed by a run beginning
/// with a deeper-indented comment feeds that comment to the block, and none of the
/// three external seams looks there.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum MoveSeam {
    /// **The source closes.** What followed the item rises to sit under what
    /// preceded it. This is the seam a plain removal also creates.
    SourceCloses,
    /// **The moved bytes land.** The item's own first non-blank line comes to sit
    /// under whatever precedes the destination.
    ArrivalLands,
    /// **The moved bytes are left behind.** Whatever followed the destination
    /// comes to sit under the item's own last line.
    ArrivalCloses,
    /// **Two carried runs meet.** The envelope has a hole — a comment the file
    /// owns, and the blank runs beside it, stay at the source — so the run before
    /// the hole and the run after it become neighbours at the destination although
    /// they never were in the original document.
    ///
    /// Unlike the three above, this seam does not exist for every move: an
    /// envelope of one run has no internal join, and one of *n* runs has *n − 1*.
    CarriedRunsJoin,
}

/// Why a candidate document was rejected after being reparsed.
///
/// Local patching is never trusted on its own (plan section 6.2). Every variant
/// here means the splice produced something other than what was asked for, and
/// **every one of them discards the candidate**: there is no code path from a
/// verification failure to bytes a caller could write.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum VerificationFailure {
    /// The candidate is not valid YAML any more.
    DoesNotParse(SyntaxError),
    /// The edited node cannot be found in the reparsed candidate.
    ///
    /// The path is re-resolved against the **freshly parsed** index, which is
    /// why a path exists at all (`PROGRESS.md`, D2j): the reparse mints new
    /// `NodeId`s that bear no relation to the ones the edit was planned
    /// against.
    TargetLost {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// What the resolver said this time.
        error: PathError,
    },
    /// The path resolves in the candidate, but to something that is no longer a
    /// scalar — so the edit changed the document's structure.
    TargetKindChanged {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// What the path names now.
        kind: NodeKind,
    },
    /// The reparsed scalar does not decode to the value that was asked for.
    ///
    /// Carries lengths and the first differing byte offset **within the value**,
    /// never the value itself: this error is printed by tests that run over the
    /// private corpus.
    ValueMismatch {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Length in bytes of the intended value.
        wanted_len: usize,
        /// Length in bytes of the value the candidate holds.
        found_len: usize,
        /// Offset of the first differing byte inside the value.
        first_difference: usize,
    },
    /// Our decoder and the substrate's disagree about the reparsed value.
    ///
    /// A disagreement means one of the two is wrong about the bytes we just
    /// wrote, and there is no way to tell which, so the candidate is discarded.
    DecoderDisagreement {
        /// Position of the edit in the requested batch.
        edit: usize,
    },
    /// The reparsed scalar could not be decoded at all.
    Undecodable {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// What the decoder said.
        error: DecodeError,
    },
    /// A byte outside every replaced span is not what it was.
    ///
    /// This is the invariant the whole product rests on, checked from the
    /// replacement list rather than from the code that built the candidate.
    BytesOutsideTheSpanChanged {
        /// Offset in the original document of the first byte that moved.
        at: usize,
    },
    /// A replacement does not lie wholly inside a span the edited scalar
    /// actually owns.
    ///
    /// The permitted spans come from `permitted_spans`, which reads them off
    /// the syntax index and knows nothing about the presentation the planner
    /// chose. That independence is the point: without it an **oversized
    /// intended span** is authorised by the very declaration it should be
    /// checked against, and `bytes_outside_the_replacements_match` happily
    /// confirms that the bytes the planner claimed did indeed change.
    ///
    /// For a block scalar the permitted spans are its header and its content,
    /// and the gap between them — the header line's tail and its own line break
    /// (`PROGRESS.md`, D2c) — belongs to neither.
    SpanNotPermitted {
        /// The replacement span that is not owned by the edited scalar.
        at: ByteSpan,
    },
    /// The candidate's length does not match the replacements that produced it.
    LengthMismatch {
        /// The length the replacements account for.
        expected: usize,
        /// The candidate's actual length.
        found: usize,
    },
    /// The mapping a structural edit changed cannot be re-found.
    MappingLost {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// What the resolver said this time.
        error: PathError,
    },
    /// An inserted entry is not in the candidate, or does not hold its value.
    ///
    /// Carries lengths only, never the key or the value: this error is printed
    /// by tests that sweep the private corpus.
    FieldNotInserted {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Length in bytes of the key that should be there.
        key_len: usize,
    },
    /// A removed entry is still in the candidate.
    FieldNotRemoved {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Length in bytes of the key that should be gone.
        key_len: usize,
    },
    /// A **sibling** entry of the changed mapping is not what it was.
    ///
    /// The strongest thing a structural edit can be asked to prove locally:
    /// every entry the edit did not name still decodes, key and whole value
    /// subtree, to exactly what it decoded to before, and in the same order.
    /// Identified by position in the mapping, never by key text.
    SiblingChanged {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Which entry of the mapping differs, zero-based in source order.
        entry: usize,
    },
    /// The mapping holds a different number of entries than it should.
    EntryCountChanged {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// How many entries the edit intended.
        expected: usize,
        /// How many the candidate holds.
        found: usize,
    },
    /// A removal envelope reaches into a node it is not removing.
    ///
    /// Derived from immutable syntax facts — the spans of the nodes that are
    /// neither the entry's own subtree nor an ancestor of it — and therefore not
    /// authorised by the envelope's own declaration. That independence is the
    /// Phase 0c-2b review's finding 3 applied to a removal, where an oversized
    /// envelope deletes a neighbouring entry rather than merely rewriting it.
    ///
    /// Since Phase 0c-3b-1 an envelope is a set of runs, and **every** run is
    /// checked; `at` is the run that reaches too far, not the hull it came from.
    EnvelopeCoversAnotherNode {
        /// The envelope run that reaches too far.
        at: ByteSpan,
        /// The node it reaches into.
        node: NodeId,
    },
    /// A removal envelope leaves part of the entry it is removing behind.
    ///
    /// The dual of [`VerificationFailure::EnvelopeCoversAnotherNode`], and a
    /// property only Phase 0c-3b-1 had to state. A contiguous hull covered every
    /// byte of the entry by construction; a **set of runs** does not, so
    /// "the runs touch nothing outside the entry" is satisfied by the empty set
    /// and by any set that punched a token out. The two together say the runs are
    /// exactly the entry.
    ///
    /// Stated over the entry's **frontier leaves** rather than over every node:
    /// the span of a collection inside the entry legitimately straddles a
    /// preserved comment, because a collection's span is derived from its
    /// children and the children are on both sides of it. A token never can.
    EnvelopeMissesTheEntry {
        /// The leaf the runs fail to cover completely.
        at: ByteSpan,
        /// The node that leaf belongs to.
        node: NodeId,
    },
    /// An insertion point falls strictly inside a node's span.
    ///
    /// Splicing there would write bytes into the middle of a scalar rather than
    /// between two lines. Like [`VerificationFailure::EnvelopeCoversAnotherNode`]
    /// it is read off the syntax index and knows nothing about what the planner
    /// chose to write.
    InsertionPointInsideANode {
        /// The offset the insertion was planned at.
        at: usize,
        /// The node it falls inside.
        node: NodeId,
    },
    /// A comment the **document assigns to the file** is not in the candidate.
    ///
    /// The check every other verification property could not make. Node-level
    /// verification compares decoded values, and a digest holds no comments, so
    /// an envelope that deleted a file-owned comment satisfied *every* other
    /// assertion — that is the Phase 0c-3a review's finding 1, and it is the
    /// structural form of the 0c-2b review's finding 3: the edit's own
    /// declaration authorised the bytes it destroyed.
    ///
    /// Derived from **ownership**, not from the edit: the comments that must
    /// survive come from `TriviaIndex::file_comments` on the *original*
    /// document, and the comments that did survive from a fresh scan of the
    /// candidate. Neither list is anything the planner said.
    ///
    /// Carries the comment's offset in the original document and never its text
    /// (`CLAUDE.md` section 1).
    FileCommentLost {
        /// Where the missing comment sat in the original document.
        at: usize,
    },
    /// A move did not put the sequence in the order it was asked for.
    ///
    /// Compared over the items' **subtree digests** rather than over their spans,
    /// so an item that arrived at the right index carrying the wrong bytes is a
    /// failure too. Carries the position in the sequence at which the candidate
    /// first disagrees with the intended permutation, never any item's content.
    ItemsNotInTheIntendedOrder {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The first sequence position that holds something other than the item
        /// the move intended to put there.
        position: usize,
    },
    /// A construct the move did not name decodes to something else now.
    ///
    /// **The whole-document form of the sibling digest, and the invariant this
    /// phase exists to state.** For an insertion and a removal, "every byte
    /// outside the replaced spans is identical" carried the weight, because those
    /// edits never relocate anything: bytes are written where nothing was, or
    /// deleted where something was, and everything else stands still. A move
    /// relocates, so the byte statement is satisfied by definition — the
    /// replacement list *says* those bytes moved — and it can no longer see a
    /// neighbour whose meaning changed because of where the bytes landed.
    ///
    /// So the two documents are walked in lockstep, node for node, with the moved
    /// sequence's children taken in the intended order on the original's side.
    /// Kinds, decoded scalar values and child counts must agree everywhere. A
    /// block scalar that swallowed a comment, an entry that lost its value, a
    /// mapping that gained one, a scalar whose bytes were re-indented into a
    /// different value: all of them fail here, and none of them is anything the
    /// edit declared.
    ///
    /// Carries the identifier of the candidate node at which the two disagree,
    /// never a value (`CLAUDE.md` section 1).
    ConstructChangedOutsideTheMove {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The candidate node that is not what the original said.
        node: NodeId,
    },
    /// A move did not conserve the document's lines.
    ///
    /// The byte-level half of the same invariant, and the half that sees what a
    /// tree walk cannot: re-indenting a whole item uniformly leaves every decoded
    /// value intact, and a document that gained or lost a line break still parses.
    ///
    /// **Two multisets, both taken over physical lines and both required to be
    /// equal**: the lines' contents with their terminators stripped, and the
    /// terminators themselves. Stripping them apart is what lets the one legal
    /// relocation of a break through — a move to the end of a file that does not
    /// end in one carries its own trailing break to the front, so a line ending is
    /// *relocated* rather than invented — while still refusing a break the
    /// document never held.
    ///
    /// Carries the offset in the **original** document of the first line the
    /// candidate does not hold, never the line (`CLAUDE.md` section 1).
    DocumentLinesNotConserved {
        /// Where the unconserved line sat in the original document.
        at: usize,
    },
    /// A move's envelope run reaches outside the item's **own lines**.
    ///
    /// The bound that stops a move carrying away one line too many. Every other
    /// property is blind to it when the extra line is **blank**: a blank line holds
    /// no node, so `StructuralGuard::Removal` cannot see it; it conserves the
    /// document's lines when it travels; it changes no decoded value; and
    /// `bytes_outside_the_replacements_match` positively authorises it, because the
    /// envelope declared it. That was experiment C5 of
    /// `docs/decisions/0c-3b-2a-notes.md`, and until this phase's review it was
    /// caught only by the external sweep.
    ///
    /// The bound is derived **textually** — the item's own physical lines, plus the
    /// comment-only lines directly above it, walked from the source and the item's
    /// node span — and therefore owes nothing to the `TriviaIndex::subtree_extent`
    /// the planner used. A `#` inside a block scalar's body is not a comment, and
    /// the walk asks the syntax index rather than the text to tell the two apart.
    ///
    /// Carries the run that reaches too far, never any content.
    MoveCarriesMoreThanTheItem {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// The envelope run that reaches outside the item's own lines.
        at: ByteSpan,
        /// The item's own lines, as the bound derived them.
        lines: ByteSpan,
    },
    /// The bytes a move wrote at the destination are not the bytes it took.
    ///
    /// **The simplest statement of what a move is, and the property the Phase
    /// 0c-3b-2a review found missing from production.** A move renders nothing: the
    /// text written at the destination must be, byte for byte, the concatenation of
    /// the source runs the same edit deleted.
    ///
    /// Without it the three whole-document properties jointly certify presentation
    /// corruption. A planner that permuted two carried comment lines conserves the
    /// line multisets exactly, leaves every digest unchanged (a digest holds no
    /// comments), produces an identical tree, loses no file-owned comment, and is
    /// positively authorised by `bytes_outside_the_replacements_match`, which
    /// compares the candidate against the source with *the planner's own insertion
    /// text* applied. The same blind spot admitted exchanged LF/CRLF terminators,
    /// blank lines shuffled between strip-chomped block scalars, and comment lines
    /// swapped between columns.
    ///
    /// The comparison is an oracle rather than a restatement because the expected
    /// bytes are read **out of the original document** at runs that
    /// [`VerificationFailure::MoveCarriesMoreThanTheItem`] and
    /// `StructuralGuard::Removal` bound independently. Nothing in it comes from the
    /// insertion string being checked.
    ///
    /// Carries offsets only, never bytes (`CLAUDE.md` section 1).
    MovedBytesWereRewritten {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Where the bytes were written.
        at: usize,
        /// Offset inside the carried text of the first byte that differs, or the
        /// shorter of the two lengths when one is a prefix of the other.
        first_difference: usize,
    },
    /// A move changed **which construct owns a comment**.
    ///
    /// The re-attribution property, and the one the byte comparison above cannot
    /// make: an envelope that swallows the blank line *below* a file-owned comment
    /// still writes back every byte it took, so the arrival is the departure and
    /// the document's lines are conserved — but rule 2 of plan section 6.2 no
    /// longer applies to that comment, and it now belongs to whatever ended up
    /// underneath it. Its text survives, so
    /// [`VerificationFailure::FileCommentLost`] sees nothing either.
    ///
    /// Derived from the **ownership layer on both documents** — every comment of
    /// the original with the answer `TriviaIndex` gives for it, against every
    /// comment of the candidate with the answer `TriviaIndex` gives for that —
    /// so it is a fact about two parses rather than anything the planner declared.
    ///
    /// Carries the offset the comment had in the original document, never its text.
    CommentOwnershipChanged {
        /// Position of the edit in the requested batch.
        edit: usize,
        /// Where the re-attributed comment sat in the original document.
        at: usize,
    },
    /// The candidate holds a **plain** scalar that YAML 1.1 does not read as a
    /// string, and the source did not already hold it.
    ///
    /// **`PROGRESS.md`'s R16, asserted rather than argued.** The round-trip
    /// oracle reparses with `saphyr-parser`, which is YAML 1.2; espanso reads the
    /// same file with a 1.1-ish stack. So a candidate that satisfies every other
    /// property here can still mean something different where it is actually
    /// read — a written `no` that becomes `false`, a `012` that becomes ten, a
    /// `12:30` that becomes 750.
    ///
    /// [`crate::emit::is_conservatively_safe_plain_scalar`] is supposed to make
    /// this unreachable by never choosing the plain style for such a value. This
    /// is the second, independent statement of the same rule, and it is the one
    /// that survives a defect in the first: the emitter decides what to
    /// *write*, and this reads what the reparsed candidate actually *holds*.
    ///
    /// **Differential, not absolute.** A real espanso file legitimately contains
    /// `true`, `100` and the like already, and refusing to edit such a file would
    /// be wrong. The comparison is therefore a multiset containment: the
    /// candidate may hold no more occurrences of an ambiguous plain scalar than
    /// the source did. Deleting one is fine, relocating one is fine, and adding
    /// one is not.
    ///
    /// Carries the offset in the **candidate** and never the text
    /// (`CLAUDE.md` section 1).
    AmbiguousPlainScalarIntroduced {
        /// Where the new ambiguous plain scalar sits in the candidate.
        at: usize,
        /// Its length in bytes.
        len: usize,
    },
    /// A removal envelope run reaches outside the runs the entry **owns**.
    ///
    /// **The removal's counterpart of
    /// [`VerificationFailure::MoveCarriesMoreThanTheItem`], and the Phase
    /// 0c-3b-2b review's blocking finding.** Experiment E5 widened
    /// `removal_span` by one **blank** line, and every production layer accepted
    /// it: the extra line holds no node, so `StructuralGuard::Removal`'s
    /// node-crossing half is blind; the mapping still loses exactly one entry,
    /// so `verify_field` is blind; the line decodes to nothing, so every sibling
    /// digest is unchanged; and `bytes_outside_the_replacements_match`
    /// positively **authorises** the deleted byte, because the envelope declared
    /// it. Only the gate sweep's own line bound saw it — which is R24's exact
    /// pattern, a safety property living in a test file.
    ///
    /// The bound is derived **independently of the envelope**: the entry's own
    /// physical lines, walked from the source text and the key's and value's
    /// node spans, minus the whole lines of the file-owned comments inside them
    /// and the blank runs the ownership rules attach to those comments (D2o).
    /// It consults nothing `removal_envelope` produced, so an envelope that
    /// widened by a line cannot authorise itself.
    ///
    /// A move's source half is a removal envelope built by the same call, so it
    /// is bounded by this too — one document fact, one implementation of it.
    ///
    /// Carries offsets only, never content (`CLAUDE.md` section 1).
    RemovalCarriesMoreThanTheEntry {
        /// The envelope run that is not contained in what the entry owns.
        at: ByteSpan,
        /// The entry's own physical lines, as the independent bound derives them.
        lines: ByteSpan,
    },
}

impl fmt::Display for EditError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EditError::SourceDoesNotParse(error) => {
                write!(formatter, "the document does not parse: {error}")
            }
            EditError::Unresolvable { edit, error } => {
                write!(formatter, "edit {edit}: {error}")
            }
            EditError::NotAScalar { edit, kind, .. } => {
                write!(
                    formatter,
                    "edit {edit}: the path names a {kind:?}, not a scalar"
                )
            }
            EditError::EmptyTarget { edit, at, .. } => write!(
                formatter,
                "edit {edit}: the value at byte {} is empty and owns no bytes to replace",
                at.start
            ),
            EditError::Refused {
                edit, hazard, at, ..
            } => write!(
                formatter,
                "edit {edit}: refused by the hazard gate ({hazard:?} at bytes {}..{})",
                at.start, at.end
            ),
            EditError::OverlappingEdits { first, second } => write!(
                formatter,
                "two edits overlap: {}..{} and {}..{}",
                first.start, first.end, second.start, second.end
            ),
            EditError::TrailingNewlinesNotRepresentable {
                edit,
                wanted,
                following,
            } => write!(
                formatter,
                "edit {edit}: a value with {wanted} trailing newlines cannot be written where \
                 {following} line breaks already follow the scalar"
            ),
            EditError::MalformedSpan { edit, at } => write!(
                formatter,
                "edit {edit}: span {}..{} does not slice the document",
                at.start, at.end
            ),
            EditError::NotAMapping { edit, kind, .. } => write!(
                formatter,
                "edit {edit}: the path names a {kind:?}, not a mapping"
            ),
            EditError::FlowCollection { edit, node } => write!(
                formatter,
                "edit {edit}: node {} is a flow collection, or inside one; structural edits \
                 there are refused",
                node.get()
            ),
            EditError::KeyAlreadyPresent { edit, mapping } => write!(
                formatter,
                "edit {edit}: mapping {} already holds that key",
                mapping.get()
            ),
            EditError::NoSuchSibling { edit, mapping } => write!(
                formatter,
                "edit {edit}: mapping {} has no entry to insert after",
                mapping.get()
            ),
            EditError::InconsistentEntryIndentation {
                edit,
                mapping,
                expected,
                found,
            } => write!(
                formatter,
                "edit {edit}: mapping {} has keys at columns {expected} and {found}, so an \
                 inserted entry has no indentation to inherit",
                mapping.get()
            ),
            EditError::EntryDoesNotOwnItsLines { edit, at } => write!(
                formatter,
                "edit {edit}: bytes {}..{} share the entry's line",
                at.start, at.end
            ),
            EditError::RemovalWouldExtendAKeptBlock { edit, block } => write!(
                formatter,
                "edit {edit}: removing it would add a line break to the keep-chomped block \
                 scalar at node {}",
                block.get()
            ),
            EditError::RemovalWouldDeleteAFileComment { edit, comment } => write!(
                formatter,
                "edit {edit}: a run of the removal envelope still covers the file-owned comment \
                 at bytes {}..{}",
                comment.start, comment.end
            ),
            EditError::RemovalWouldExtendABlockScalar { edit, block } => write!(
                formatter,
                "edit {edit}: the bytes this removal keeps would become content of the block \
                 scalar at node {}",
                block.get()
            ),
            EditError::NoObservableLineEnding { edit, at } => write!(
                formatter,
                "edit {edit}: no line break before byte {at} can be copied, and this step never \
                 invents one"
            ),
            EditError::LastEntryOfMapping { edit, mapping } => write!(
                formatter,
                "edit {edit}: removing it would leave mapping {} with no entries",
                mapping.get()
            ),
            EditError::NotASequenceItem { edit, node, kind } => write!(
                formatter,
                "edit {edit}: node {} is not an item of a block sequence; its parent is a {kind:?}",
                node.get()
            ),
            EditError::NoSuchDestinationItem {
                edit,
                sequence,
                items,
            } => write!(
                formatter,
                "edit {edit}: sequence {} holds {items} items, so there is no such destination",
                sequence.get()
            ),
            EditError::MoveChangesNothing { edit, item } => write!(
                formatter,
                "edit {edit}: node {} is already where the move would put it",
                item.get()
            ),
            EditError::MoveMustBeTheOnlyEditInItsBatch { edit, edits } => write!(
                formatter,
                "edit {edit}: a move must be the only edit in its batch, and this batch holds \
                 {edits}"
            ),
            EditError::MoveWouldInventALineEnding { edit, at } => write!(
                formatter,
                "edit {edit}: the item ends the document at byte {at} without a line break, so \
                 relocating it would invent one or destroy one"
            ),
            EditError::MoveWouldTerminateTheFinalLine { edit, at } => write!(
                formatter,
                "edit {edit}: the document ends at byte {at} without a line break, so writing the \
                 item there would give an untouched line a terminator it never had"
            ),
            EditError::MoveWouldExtendAKeptBlock { edit, block } => write!(
                formatter,
                "edit {edit}: the move would change the value of the keep-chomped block scalar \
                 at node {} that ends the item",
                block.get()
            ),
            EditError::MoveWouldExtendABlockScalar { edit, block, seam } => write!(
                formatter,
                "edit {edit}: at the {seam:?} seam the move would make a line content of the \
                 block scalar at node {}",
                block.get()
            ),
            EditError::NotASequence { edit, node, kind } => write!(
                formatter,
                "edit {edit}: node {} is a {kind:?}, not a block sequence",
                node.get()
            ),
            EditError::InsertedItemHasNoFields { edit } => write!(
                formatter,
                "edit {edit}: a new sequence item must hold at least one field"
            ),
            EditError::DuplicateInsertedField { edit, field } => write!(
                formatter,
                "edit {edit}: field {field} of the new item repeats a key an earlier field holds"
            ),
            EditError::InvalidInsertedFieldKey { edit, field } => write!(
                formatter,
                "edit {edit}: field {field} of the new item has a key this step will not write"
            ),
            EditError::FlowSequenceInsertionUnsupported { edit, sequence } => write!(
                formatter,
                "edit {edit}: sequence {} is a flow collection, or inside one; inserting an item \
                 there is refused",
                sequence.get()
            ),
            EditError::InconsistentSequenceIndentation {
                edit,
                sequence,
                expected,
                found,
            } => write!(
                formatter,
                "edit {edit}: sequence {} has item dashes at columns {expected} and {found}, so a \
                 new item has no indentation to inherit",
                sequence.get()
            ),
            EditError::ImplicitNullSequenceHasAmbiguousTrivia { edit, at } => write!(
                formatter,
                "edit {edit}: a standalone comment follows byte {at}, so promoting the empty value \
                 there would have to decide who owns it"
            ),
            EditError::RemovalWouldEmptyTheSequence { edit, sequence } => write!(
                formatter,
                "edit {edit}: removing it would leave sequence {} with no items",
                sequence.get()
            ),
            EditError::Verification(failure) => write!(formatter, "{failure}"),
        }
    } // End of function fmt() for EditError
}

impl fmt::Display for VerificationFailure {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VerificationFailure::DoesNotParse(error) => {
                write!(formatter, "the candidate does not parse: {error}")
            }
            VerificationFailure::TargetLost { edit, error } => write!(
                formatter,
                "edit {edit}: the edited node cannot be re-found in the candidate: {error}"
            ),
            VerificationFailure::TargetKindChanged { edit, kind } => write!(
                formatter,
                "edit {edit}: the path now names a {kind:?} in the candidate"
            ),
            VerificationFailure::ValueMismatch {
                edit,
                wanted_len,
                found_len,
                first_difference,
            } => write!(
                formatter,
                "edit {edit}: the candidate holds a {found_len}-byte value where a \
                 {wanted_len}-byte one was intended; they first differ at byte \
                 {first_difference}"
            ),
            VerificationFailure::DecoderDisagreement { edit } => write!(
                formatter,
                "edit {edit}: our decoder and the substrate disagree about the candidate"
            ),
            VerificationFailure::Undecodable { edit, error } => {
                write!(
                    formatter,
                    "edit {edit}: the candidate does not decode: {error}"
                )
            }
            VerificationFailure::BytesOutsideTheSpanChanged { at } => write!(
                formatter,
                "byte {at} changed although it lies outside every replaced span"
            ),
            VerificationFailure::SpanNotPermitted { at } => write!(
                formatter,
                "the replacement at bytes {}..{} is not wholly inside a span the edited scalar \
                 owns",
                at.start, at.end
            ),
            VerificationFailure::LengthMismatch { expected, found } => write!(
                formatter,
                "the candidate is {found} bytes long; the replacements account for {expected}"
            ),
            VerificationFailure::MappingLost { edit, error } => write!(
                formatter,
                "edit {edit}: the changed mapping cannot be re-found in the candidate: {error}"
            ),
            VerificationFailure::FieldNotInserted { edit, key_len } => write!(
                formatter,
                "edit {edit}: the {key_len}-byte key is missing from the candidate, or does not \
                 hold the intended value"
            ),
            VerificationFailure::FieldNotRemoved { edit, key_len } => write!(
                formatter,
                "edit {edit}: the {key_len}-byte key is still in the candidate"
            ),
            VerificationFailure::SiblingChanged { edit, entry } => write!(
                formatter,
                "edit {edit}: entry {entry} of the mapping is not what it was"
            ),
            VerificationFailure::EntryCountChanged {
                edit,
                expected,
                found,
            } => write!(
                formatter,
                "edit {edit}: the mapping holds {found} entries where {expected} were intended"
            ),
            VerificationFailure::EnvelopeCoversAnotherNode { at, node } => write!(
                formatter,
                "the removal envelope run {}..{} reaches into node {}",
                at.start,
                at.end,
                node.get()
            ),
            VerificationFailure::EnvelopeMissesTheEntry { at, node } => write!(
                formatter,
                "no removal envelope run covers bytes {}..{} of node {}, which the entry owns",
                at.start,
                at.end,
                node.get()
            ),
            VerificationFailure::InsertionPointInsideANode { at, node } => write!(
                formatter,
                "the insertion point at byte {at} falls inside node {}",
                node.get()
            ),
            VerificationFailure::FileCommentLost { at } => write!(
                formatter,
                "the file-owned comment at byte {at} is not in the candidate"
            ),
            VerificationFailure::ItemsNotInTheIntendedOrder { edit, position } => write!(
                formatter,
                "edit {edit}: sequence position {position} does not hold the item the move \
                 intended to put there"
            ),
            VerificationFailure::ConstructChangedOutsideTheMove { edit, node } => write!(
                formatter,
                "edit {edit}: candidate node {} is not what the original document said, although \
                 the move did not name it",
                node.get()
            ),
            VerificationFailure::DocumentLinesNotConserved { at } => write!(
                formatter,
                "the line at byte {at} of the original document is not in the candidate; a move \
                 relocates lines and creates none"
            ),
            VerificationFailure::MoveCarriesMoreThanTheItem { edit, at, lines } => write!(
                formatter,
                "edit {edit}: the envelope run {}..{} reaches outside the item's own lines {}..{}",
                at.start, at.end, lines.start, lines.end
            ),
            VerificationFailure::MovedBytesWereRewritten {
                edit,
                at,
                first_difference,
            } => write!(
                formatter,
                "edit {edit}: the bytes written at byte {at} are not the bytes taken from the \
                 source; they first differ {first_difference} bytes in"
            ),
            VerificationFailure::CommentOwnershipChanged { edit, at } => write!(
                formatter,
                "edit {edit}: the comment at byte {at} of the original document is owned by \
                 something else in the candidate"
            ),
            VerificationFailure::AmbiguousPlainScalarIntroduced { at, len } => write!(
                formatter,
                "the candidate holds a {len}-byte plain scalar at byte {at} that YAML 1.1 does \
                 not read as a string and the source did not already hold"
            ),
            VerificationFailure::RemovalCarriesMoreThanTheEntry { at, lines } => write!(
                formatter,
                "the removal run {}..{} is not inside the runs the entry owns within its own \
                 lines {}..{}",
                at.start, at.end, lines.start, lines.end
            ),
        }
    } // End of function fmt() for VerificationFailure
}

impl std::error::Error for EditError {}
impl std::error::Error for VerificationFailure {}

impl From<VerificationFailure> for EditError {
    fn from(failure: VerificationFailure) -> EditError {
        EditError::Verification(failure)
    }
}

// ---------------------------------------------------------------------------
// The entry points
// ---------------------------------------------------------------------------

/// Sets one scalar's value, returning the verified candidate document.
///
/// A convenience over [`apply_scalar_edits`] with a single-element batch; every
/// rule and every check is the same.
///
/// # Errors
///
/// See [`EditError`].
pub fn apply_scalar_edit(
    source: &str,
    path: &DocumentPath,
    value: &str,
) -> Result<PatchedDocument, EditError> {
    apply_scalar_edits(source, &[ScalarEdit::new(path.clone(), value)])
} // End of function apply_scalar_edit()

/// Applies a batch of scalar edits to one document and verifies the result.
///
/// The steps, in order, and none of them is optional:
///
/// 1. parse `source`;
/// 2. for each edit, resolve its path, **consult the hazard gate**, render the
///    new value with [`crate::emit::preserve_scalar`], and work out which spans
///    it replaces;
/// 3. reject the batch if any two replacements overlap;
/// 4. splice **from the highest byte offset downwards**;
/// 5. check every replacement against the spans the edited scalar actually
///    owns, reparse the candidate, and `verify` it;
/// 6. only then hand back a [`PatchedDocument`].
///
/// `source` is the original bytes, BOM included. An empty batch is legal and
/// returns the document unchanged, verified.
///
/// # Errors
///
/// See [`EditError`]. Every failure discards the candidate text.
pub fn apply_scalar_edits(
    source: &str,
    edits: &[ScalarEdit],
) -> Result<PatchedDocument, EditError> {
    let batch: Vec<DocumentEdit> = edits.iter().cloned().map(DocumentEdit::Scalar).collect();
    apply_edits(source, &batch)
} // End of function apply_scalar_edits()

/// Adds one `key: value` entry to a mapping, returning the verified candidate.
///
/// A convenience over [`apply_edits`] with a single-element batch; every rule
/// and every check is the same. See [`FieldInsert`] for where the entry goes and
/// where its indentation comes from.
///
/// # Errors
///
/// See [`EditError`].
pub fn insert_field(
    source: &str,
    mapping: &DocumentPath,
    key: &str,
    value: &str,
) -> Result<PatchedDocument, EditError> {
    apply_edits(
        source,
        &[DocumentEdit::InsertField(FieldInsert::new(
            mapping.clone(),
            key,
            value,
        ))],
    )
} // End of function insert_field()

/// Deletes the mapping entry `field` names, returning the verified candidate.
///
/// A convenience over [`apply_edits`] with a single-element batch. See
/// [`FieldRemoval`] for what travels with the entry.
///
/// # Errors
///
/// See [`EditError`].
pub fn remove_field(source: &str, field: &DocumentPath) -> Result<PatchedDocument, EditError> {
    apply_edits(
        source,
        &[DocumentEdit::RemoveField(FieldRemoval::new(field.clone()))],
    )
} // End of function remove_field()

/// Relocates one sequence item inside its own sequence, and verifies the result.
///
/// `after` names the item the moved one is written after, **by its index in the
/// original sequence**; `None` writes it above the sequence's first item. See
/// [`ItemMove`] for what travels with it and
/// [`EditError::MoveMustBeTheOnlyEditInItsBatch`] for why it is always a batch of
/// one.
///
/// # Errors
///
/// See [`EditError`].
pub fn move_item(
    source: &str,
    item: &DocumentPath,
    after: Option<usize>,
) -> Result<PatchedDocument, EditError> {
    let edit = match after {
        None => ItemMove::to_front(item.clone()),
        Some(index) => ItemMove::after(item.clone(), index),
    };
    apply_edits(source, &[DocumentEdit::MoveItem(edit)])
} // End of function move_item()

/// Adds one new flat block-mapping item to a sequence, and verifies the result.
///
/// `after` names the item the new one is written after, **by its index in the
/// original sequence**; `None` appends after the last item. `fields` are decoded
/// key/value pairs, spelled by [`crate::emit::choose_scalar`]. See [`InsertItem`]
/// for the narrow exception this operation is, and for the one implicit-null
/// value it may promote into a sequence.
///
/// # Errors
///
/// See [`EditError`].
pub fn insert_item(
    source: &str,
    sequence: &DocumentPath,
    after: Option<usize>,
    fields: &[(String, String)],
) -> Result<PatchedDocument, EditError> {
    let edit = match after {
        None => InsertItem::new(sequence.clone(), fields.to_vec()),
        Some(index) => InsertItem::after(sequence.clone(), index, fields.to_vec()),
    };
    apply_edits(source, &[DocumentEdit::InsertItem(edit)])
} // End of function insert_item()

/// Deletes the sequence item `item` names, returning the verified candidate.
///
/// A convenience over [`apply_edits`] with a single-element batch. See
/// [`RemoveItem`] for what travels with the item and why it is [`ItemMove`]'s
/// lift half rather than a second implementation of one.
///
/// # Errors
///
/// See [`EditError`].
pub fn remove_item(source: &str, item: &DocumentPath) -> Result<PatchedDocument, EditError> {
    apply_edits(
        source,
        &[DocumentEdit::RemoveItem(RemoveItem::new(item.clone()))],
    )
} // End of function remove_item()

/// Applies a batch of edits of **any kind** to one document and verifies it.
///
/// This is the batch protocol itself, and [`apply_scalar_edits`] is a wrapper
/// over it. The steps are the ones plan section 6.2 lays down, and they are the
/// same for a scalar edit, an insertion and a removal — which is why structural
/// edits joined this function rather than getting an engine of their own:
///
/// 1. parse `source` and scan its trivia, **once**, against the original text;
/// 2. plan every edit **against that original index**, consulting the hazard
///    gate before anything is rendered;
/// 3. reject the batch if any two replacements overlap;
/// 4. splice **from the highest byte offset downwards**;
/// 5. check every replacement against spans derived from immutable syntax
///    facts, reparse the candidate, and `verify` it;
/// 6. only then hand back a [`PatchedDocument`].
///
/// `source` is the original bytes, BOM included. An empty batch is legal and
/// returns the document unchanged, verified.
///
/// # Errors
///
/// See [`EditError`]. Every failure discards the candidate text.
pub fn apply_edits(source: &str, edits: &[DocumentEdit]) -> Result<PatchedDocument, EditError> {
    let index = SyntaxIndex::parse(source).map_err(EditError::SourceDoesNotParse)?;
    let trivia = TriviaIndex::scan(source, &index);

    let mut replacements = Vec::new();
    let mut permitted = Vec::new();
    let mut notes = Vec::new();
    let mut expectations = Vec::new();
    let mut sequences = Vec::new();
    let mut guards = Vec::new();
    let mut rewritten = Vec::new();
    let mut moves = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let planned = match edit {
            DocumentEdit::Scalar(scalar) => plan_one(source, &index, &trivia, position, scalar)?,
            DocumentEdit::InsertField(insert) => {
                plan_insertion(source, &index, &trivia, position, insert)?
            }
            DocumentEdit::RemoveField(removal) => {
                plan_removal(source, &index, &trivia, position, removal)?
            }
            DocumentEdit::InsertItem(insert) => {
                plan_item_insertion(source, &index, &trivia, position, insert)?
            }
            DocumentEdit::RemoveItem(removal) => {
                plan_item_removal(source, &index, &trivia, position, removal)?
            }
            DocumentEdit::MoveItem(relocation) => {
                // A move is verified against the original document plus one
                // permutation, and nothing else in the batch is modelled by that
                // expectation. Checked here rather than inside `plan_move`
                // because it is a fact about the batch, not about the item.
                if edits.len() != 1 {
                    return Err(EditError::MoveMustBeTheOnlyEditInItsBatch {
                        edit: position,
                        edits: edits.len(),
                    });
                }
                plan_move(source, &index, &trivia, position, relocation)?
            }
        };
        replacements.extend(planned.replacements);
        permitted.extend(planned.permitted);
        if let Some(note) = planned.note {
            notes.push(note);
        }
        if let Some(expectation) = planned.expectation {
            expectations.push(expectation);
        }
        if let Some(expectation) = planned.items {
            sequences.push(expectation);
        }
        guards.extend(planned.guards);
        if let Some(node) = planned.rewritten {
            rewritten.push(node);
        }
        if let Some(relocation) = planned.moved {
            moves.push(relocation);
        }
    } // End of the loop that plans every requested edit

    // **Disjointness first.** A malformed batch — three removals of one entry,
    // say — is nonsense whatever else is true of it, and every later step
    // assumes it is not looking at one: folding three removals of the same entry
    // out of a two-entry mapping used to underflow its entry count and panic
    // (the Phase 0c-3a review's finding 3). A public entry point must answer a
    // bad request with a typed error, never with a panic.
    replacements.sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
    for pair in replacements.windows(2) {
        // Two spans that share a start are always ambiguous, and a zero-width
        // insertion point makes that reachable in a way it never was for
        // scalars: `pair[0].end > pair[1].start` alone would let two insertions
        // at the same offset through, and their order would decide the result.
        if pair[0].span.end > pair[1].span.start || pair[0].span.start == pair[1].span.start {
            return Err(EditError::OverlappingEdits {
                first: pair[0].span,
                second: pair[1].span,
            });
        }
    } // End of the loop that checks the replacements are disjoint

    // Against the **original** index, before a byte moves: an envelope that
    // reaches into a node it is not removing, or an insertion point inside one,
    // is a planning defect that the candidate-side checks cannot see.
    for guard in &guards {
        guard.check(source, &index, &trivia)?;
    }
    // The nodes a **kept** sequence item may legitimately differ at. A scalar
    // edit rewrites one; a structural edit rewrites a whole mapping. Collected
    // before the field claims are folded, because folding consumes them.
    let mut touched = rewritten.clone();
    touched.extend(expectations.iter().map(|claim| claim.mapping_id));
    let expectations = fold_expectations(&index, expectations, &rewritten)?;
    let sequences = fold_item_expectations(&index, sequences, &touched)?;

    let candidate = splice(source, &replacements);
    verify(
        source,
        &candidate,
        &replacements,
        &permitted,
        Expected {
            index: &index,
            trivia: &trivia,
            edits,
            fields: &expectations,
            items: &sequences,
            moves: &moves,
        },
    )?;
    Ok(PatchedDocument {
        text: candidate,
        replacements,
        notes,
    })
} // End of function apply_edits()

/// One edit resolved down to the bytes it writes.
struct PlannedEdit {
    /// The spans it replaces, and with what.
    replacements: Vec<Replacement>,
    /// The spans the edit is allowed to rewrite, from [`permitted_spans`] or
    /// from the structural planners. Every replacement must lie wholly inside
    /// one of them, and each is derived from syntax facts rather than from
    /// anything the planner chose to render.
    permitted: Vec<ByteSpan>,
    /// A presentation change worth telling the user about.
    note: Option<PresentationNote>,
    /// What `verify` must find in the candidate, for a structural edit.
    expectation: Option<PendingField>,
    /// What `verify` must find in the candidate, for a sequence-item edit.
    items: Option<PendingItem>,
    /// What `verify` must find in the candidate, for a move.
    moved: Option<MoveExpectation>,
    /// Checks on the planned spans, stated in terms of the **original** index.
    ///
    /// A list rather than one, because a move plans a removal envelope *and* an
    /// insertion point and both have to be pinned: the source half from both
    /// sides, exactly as a plain removal's is, and the destination against the
    /// nodes it must not land inside.
    guards: Vec<StructuralGuard>,
    /// The node a scalar edit rewrites, in the **original** index.
    ///
    /// A structural edit's sibling check compares each untouched entry with
    /// itself, and a scalar edit elsewhere in the same mapping legitimately
    /// changes one of those entries. This is how the two are told apart.
    rewritten: Option<NodeId>,
}

/// A structural edit's span, checked against the nodes it must not disturb.
///
/// This is the Phase 0c-2b review's finding 3 carried into structural edits.
/// `bytes_outside_the_replacements_match` compares the candidate against the
/// source with the *declared* replacements applied, so a removal envelope that
/// is one entry too long confirms itself: the bytes it claimed to delete did
/// indeed go. The guard states the limit in terms the planner cannot bend —
/// **the spans of the nodes in the original document** — and it runs before a
/// byte is spliced.
///
/// Since Phase 0c-3b-1 a removal envelope is a **set of runs**, and the guard
/// says two things about it rather than one. Every run must touch nothing outside
/// the entry, as the single span had to; and the runs together must cover every
/// frontier leaf of the entry. The second half is new because a set can omit
/// bytes a hull could not, so without it the empty run set would pass.
///
/// Phase 0c-3b-2b's review added a **third**: every run must lie inside the runs
/// the entry owns, as [`entry_owned_runs`] derives them from the text without
/// consulting the envelope at all. The first two halves are stated over *node
/// spans*, and a blank line holds no node — which is exactly how experiment E5's
/// one extra deleted blank line passed every production check
/// ([`VerificationFailure::RemovalCarriesMoreThanTheEntry`]).
enum StructuralGuard {
    /// A removal envelope, with the entry's own subtree it is allowed to cover.
    Removal {
        /// The ordered, disjoint runs the removal deletes.
        runs: Vec<ByteSpan>,
        /// The key and value node of the entry being removed.
        entry: (NodeId, NodeId),
        /// What the envelope is for, which decides who bounds its runs.
        kind: EnvelopeKind,
    },
    /// An insertion point, which must lie between nodes and not inside one.
    Insertion {
        /// The offset the new entry is spliced at.
        at: usize,
    },
}

/// What a removal envelope is for, and therefore which layer bounds its runs.
///
/// Both kinds are built by the same [`removal_envelope`] call and both are
/// checked against the original index's node spans here. They differ only in who
/// states the third bound — the one a blank line is visible to — because that
/// bound's failure has to name the operation the user asked for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EnvelopeKind {
    /// A removal: the runs are deleted, and this guard bounds them by the runs
    /// [`entry_owned_runs`] says the entry owns.
    RemovesTheEntry,
    /// A move's source half: the runs are relocated rather than deleted, and
    /// `verify` bounds them twice over with the same two arguments —
    /// [`VerificationFailure::MoveCarriesMoreThanTheItem`] for the item's own
    /// lines and [`VerificationFailure::CommentOwnershipChanged`] for the blank
    /// run a kept comment's ownership rests on. Bounding them a third time here
    /// would pre-empt both and report a removal's failure for a move.
    CarriesTheItem,
}

impl StructuralGuard {
    /// Checks the guard against the original index.
    ///
    /// # Errors
    ///
    /// [`VerificationFailure::EnvelopeCoversAnotherNode`] when a removal run
    /// reaches into a node that is neither part of the entry nor an ancestor of
    /// it — ancestors necessarily overlap, since they contain the entry;
    /// [`VerificationFailure::EnvelopeMissesTheEntry`] when the runs leave part
    /// of one of the entry's own tokens behind;
    /// [`VerificationFailure::RemovalCarriesMoreThanTheEntry`] when a run
    /// reaches outside what the entry owns, which is the only half that can see
    /// a deleted **blank** line; and
    /// [`VerificationFailure::InsertionPointInsideANode`] when an insertion
    /// point falls strictly inside a node's span.
    fn check(
        &self,
        source: &str,
        index: &SyntaxIndex,
        trivia: &TriviaIndex,
    ) -> Result<(), VerificationFailure> {
        match self {
            StructuralGuard::Removal { runs, entry, kind } => {
                for node in index.nodes() {
                    let of_the_entry =
                        in_subtree(index, entry.0, node.id) || in_subtree(index, entry.1, node.id);
                    if node.kind == NodeKind::Document || node.span.is_empty() {
                        continue;
                    }
                    // Nothing outside the entry may be touched by **any** run.
                    if let Some(run) = runs.iter().find(|run| run.intersects(node.span)) {
                        if !(of_the_entry || is_ancestor(index, node.id, entry.0)) {
                            return Err(VerificationFailure::EnvelopeCoversAnotherNode {
                                at: *run,
                                node: node.id,
                            });
                        }
                    }
                    // …and every token of the entry must be covered by one. A
                    // collection's span legitimately straddles a preserved
                    // comment, because it is derived from children on both sides
                    // of it; a token never can.
                    if of_the_entry
                        && node.is_frontier_leaf()
                        && !runs.iter().any(|run| run.contains(node.span))
                    {
                        return Err(VerificationFailure::EnvelopeMissesTheEntry {
                            at: node.span,
                            node: node.id,
                        });
                    }
                } // End of the loop over every node the envelope might disturb

                // **The third half, and the only one that can see a deleted
                // blank line.** Both loops above are stated over node spans, and
                // a blank line holds no node — so experiment E5's one extra
                // deleted line satisfies them exactly. This bound is derived
                // from the text and the entry's frontier, and knows nothing
                // about the envelope it is checking.
                if *kind == EnvelopeKind::CarriesTheItem {
                    return Ok(());
                }
                let (lines, owned) = entry_owned_runs(source, index, trivia, entry.0, entry.1)
                    .ok_or(VerificationFailure::RemovalCarriesMoreThanTheEntry {
                        at: ByteSpan::default(),
                        lines: ByteSpan::default(),
                    })?;
                for run in runs {
                    if !owned.iter().any(|allowed| allowed.contains(*run)) {
                        return Err(VerificationFailure::RemovalCarriesMoreThanTheEntry {
                            at: *run,
                            lines,
                        });
                    }
                } // End of the loop that bounds every run by what the entry owns
                Ok(())
            }
            StructuralGuard::Insertion { at } => {
                // **Frontier leaves only.** A point between two entries is
                // legitimately inside the enclosing mapping, its ancestors and
                // the document — that is what "between two entries" means. What
                // it must never be inside is a *token*, and the frontier leaves
                // are exactly the nodes whose interior bytes are one
                // (`PROGRESS.md`, D2b).
                for node in index.nodes() {
                    if node.is_frontier_leaf() && node.span.start < *at && *at < node.span.end {
                        return Err(VerificationFailure::InsertionPointInsideANode {
                            at: *at,
                            node: node.id,
                        });
                    }
                } // End of the loop over every leaf the point might fall inside
                Ok(())
            }
        }
    } // End of function check()
} // End of impl StructuralGuard

/// Whether `node` is `root` or a descendant of it.
fn in_subtree(index: &SyntaxIndex, root: NodeId, node: NodeId) -> bool {
    node == root || is_ancestor(index, root, node)
}

/// Whether `ancestor` is a strict ancestor of `node`.
fn is_ancestor(index: &SyntaxIndex, ancestor: NodeId, node: NodeId) -> bool {
    let mut current = index.node(node).and_then(|node| node.parent);
    while let Some(id) = current {
        if id == ancestor {
            return true;
        }
        current = index.node(id).and_then(|node| node.parent);
    }
    false
} // End of function is_ancestor()

/// Resolves one edit, checks it, and renders the bytes it replaces.
///
/// The order of the checks is the contract: address the node, **ask the gate**,
/// then look at the bytes. Nothing is rendered for a node the gate refuses.
fn plan_one(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &ScalarEdit,
) -> Result<PlannedEdit, EditError> {
    // R18: a scalar edit targets `Resolved::value`, never `Resolved::key`.
    // Renaming a key would invalidate the very path the verify step re-resolves.
    let resolved = resolve_full(index, edit.path()).map_err(|error| EditError::Unresolvable {
        edit: position,
        error,
    })?;
    let node = index.node(resolved.value).ok_or(EditError::MalformedSpan {
        edit: position,
        at: ByteSpan::default(),
    })?;

    if let Some(hazard) = trivia.disqualifying_hazard(index, resolved.value) {
        return Err(EditError::Refused {
            edit: position,
            node: resolved.value,
            hazard: hazard.kind,
            at: hazard.span,
        });
    }

    let Some(scalar) = node.scalar.as_ref() else {
        return Err(EditError::NotAScalar {
            edit: position,
            node: node.id,
            kind: node.kind,
        });
    };
    if node.is_zero_width() {
        return Err(EditError::EmptyTarget {
            edit: position,
            node: node.id,
            at: node.span,
        });
    }

    let presentation = &scalar.presentation;
    let (plan, context) = choose_plan(source, index, node, presentation, edit.value());
    let note = presentation_note(source, position, presentation, &plan);
    let replacements = render_replacements(source, position, node, presentation, &plan, context)?;

    // The Phase 0c-3a review's finding 2, in the one place it also reaches a
    // *scalar* edit. A multi-line value renders as a block, and a block writes
    // line breaks — so writing one into a document that contains none invents a
    // byte the file never held, and gives a file with no final newline one. The
    // condition is exactly that: bytes are being written that hold a break, and
    // the document offers no break to copy. A single-line value into the same
    // document is untouched by this, which is why the test is on the rendered
    // bytes rather than on the document alone.
    if replacements
        .iter()
        .any(|replacement| replacement.text.contains(['\n', '\r']))
        && line_ending_before(source, source.len()).is_none()
    {
        return Err(EditError::NoObservableLineEnding {
            edit: position,
            at: node.span.start,
        });
    }

    Ok(PlannedEdit {
        replacements,
        permitted: permitted_spans(node, presentation),
        note,
        expectation: None,
        items: None,
        moved: None,
        guards: Vec::new(),
        rewritten: Some(resolved.value),
    })
} // End of function plan_one()

// ---------------------------------------------------------------------------
// Structural edits: adding and removing one mapping entry
// ---------------------------------------------------------------------------

/// One structural edit's claim about the mapping it changes, before the splice.
///
/// Deliberately **not** the finished expectation: a batch may change one mapping
/// more than once, and two independently-built expectations would each demand
/// "one fewer entry than before" and contradict each other. [`fold_expectations`]
/// merges every claim about the same mapping into one.
struct PendingField {
    /// Position of the edit in the requested batch.
    edit: usize,
    /// The mapping the edit changes.
    mapping: DocumentPath,
    /// Its identifier in the **original** index, which is what groups claims.
    mapping_id: NodeId,
    /// Its entries in the original index, in source order.
    entries: Vec<Entry>,
    /// The value node of an entry being removed.
    removed: Option<NodeId>,
    /// The key and value an insertion must produce.
    inserted: Option<(String, String)>,
}

/// What [`verify`] must find in the candidate for one changed mapping.
///
/// Recorded **before** the splice, from the original index, because the whole
/// point is to compare the candidate against what the document said rather than
/// against what the planner believed.
struct FieldExpectation {
    /// Position of the first edit that changed this mapping.
    edit: usize,
    /// The mapping. Re-resolved against the candidate by its own path.
    mapping: DocumentPath,
    /// Every key an insertion must find, with the value it must decode to.
    inserted: Vec<(String, String)>,
    /// Every key a removal must not find.
    removed: Vec<String>,
    /// Every entry no structural edit named, as (decoded key, subtree digest),
    /// in source order.
    ///
    /// The digest is `None` for an entry a **scalar** edit in the same batch
    /// rewrites: its value legitimately changes, and that edit's own
    /// verification is what checks it. The key and its position are still
    /// compared, so a batch can never reorder or lose such an entry unnoticed.
    siblings: Vec<(String, Option<String>)>,
    /// How many entries the mapping must hold afterwards.
    entries: usize,
}

/// Merges every claim about one mapping into a single expectation.
///
/// Two removals from one mapping must ask for **two** fewer entries, not one
/// each; a removal and an insertion must ask for the same number back. Grouping
/// by the mapping's identifier in the original index is what makes that
/// possible, and it is also where two insertions of the same key are caught —
/// neither one alone is a duplicate, and together they are.
///
/// # Arithmetic is checked, because a malformed batch reaches here
///
/// Each claim moves the mapping's entry count by one, and a batch that removes
/// more entries than the mapping has would take an unsigned count below zero.
/// That is not a hypothetical: three removals of one entry were rejected as
/// overlapping only *after* this function ran, so `2 - 1 - 1 - 1` underflowed
/// and panicked in a debug build (the Phase 0c-3a review's finding 3).
/// [`apply_edits`] now rejects overlapping replacements first, and the
/// subtraction is checked as well — one fix would have sufficed, and a public
/// API that can panic on bad input deserves both.
///
/// # Errors
///
/// [`EditError::KeyAlreadyPresent`] when one batch would insert a key twice, and
/// [`EditError::LastEntryOfMapping`] when the folded claims would leave a
/// mapping with no entries — including the impossible case of taking away more
/// than it has.
fn fold_expectations(
    index: &SyntaxIndex,
    pending: Vec<PendingField>,
    rewritten: &[NodeId],
) -> Result<Vec<FieldExpectation>, EditError> {
    let mut folded: Vec<(NodeId, FieldExpectation, Vec<NodeId>, Vec<Entry>)> = Vec::new();
    for claim in pending {
        let slot = match folded
            .iter_mut()
            .find(|(id, _, _, _)| *id == claim.mapping_id)
        {
            Some(slot) => slot,
            None => {
                folded.push((
                    claim.mapping_id,
                    FieldExpectation {
                        edit: claim.edit,
                        mapping: claim.mapping,
                        inserted: Vec::new(),
                        removed: Vec::new(),
                        siblings: Vec::new(),
                        entries: claim.entries.len(),
                    },
                    Vec::new(),
                    claim.entries,
                ));
                folded.last_mut().expect("just pushed")
            }
        };
        if let Some(removed) = claim.removed {
            slot.2.push(removed);
            slot.1.entries =
                slot.1
                    .entries
                    .checked_sub(1)
                    .ok_or(EditError::LastEntryOfMapping {
                        edit: claim.edit,
                        mapping: claim.mapping_id,
                    })?;
            if let Some(key) = decoded_value(index, key_of(&slot.3, removed)) {
                slot.1.removed.push(key.to_owned());
            }
        }
        if let Some((key, value)) = claim.inserted {
            if slot.1.inserted.iter().any(|(seen, _)| *seen == key) {
                return Err(EditError::KeyAlreadyPresent {
                    edit: claim.edit,
                    mapping: claim.mapping_id,
                });
            }
            slot.1.inserted.push((key, value));
            slot.1.entries += 1;
        }
    } // End of the loop that groups every claim by the mapping it changes

    // Two removals that are individually legal can still empty a two-entry
    // mapping between them, and `a:` with nothing under it is an implicit null —
    // a different document, not a smaller one. Only the folded claim can see
    // this, because each removal was planned against the original entry count.
    for (mapping_id, expectation, _, _) in &folded {
        if expectation.entries == 0 {
            return Err(EditError::LastEntryOfMapping {
                edit: expectation.edit,
                mapping: *mapping_id,
            });
        }
    } // End of the loop that refuses a batch which would empty a mapping

    Ok(folded
        .into_iter()
        .map(|(_, mut expectation, removed, entries)| {
            for entry in &entries {
                if removed.contains(&entry.value) {
                    continue;
                }
                let key = decoded_value(index, entry.key)
                    .unwrap_or_default()
                    .to_owned();
                let touched = rewritten
                    .iter()
                    .any(|node| in_subtree(index, entry.value, *node));
                let digest = (!touched).then(|| digest(index, entry.value));
                expectation.siblings.push((key, digest));
            } // End of the loop over the mapping's surviving entries
            expectation
        })
        .collect())
} // End of function fold_expectations()

/// The key node of the entry whose value is `value`.
fn key_of(entries: &[Entry], value: NodeId) -> NodeId {
    entries
        .iter()
        .find(|entry| entry.value == value)
        .map_or(value, |entry| entry.key)
}

/// One mapping entry: the node that names it and the node that holds its value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Entry {
    /// The key node.
    key: NodeId,
    /// The value node, zero width for an entry written `label:`.
    value: NodeId,
}

/// Plans an insertion, or refuses it.
///
/// The order of the checks is the contract, exactly as in [`plan_one`]: address
/// the mapping, **ask the gate**, establish that the shape is one this step
/// understands, and only then render anything.
fn plan_insertion(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &FieldInsert,
) -> Result<PlannedEdit, EditError> {
    let (mapping, entries) = editable_mapping(index, trivia, position, edit.mapping())?;

    if entries
        .iter()
        .any(|entry| decoded_value(index, entry.key) == Some(edit.key()))
    {
        return Err(EditError::KeyAlreadyPresent {
            edit: position,
            mapping: mapping.id,
        });
    }
    let anchor = match edit.sibling() {
        None => *entries.last().ok_or(EditError::NoSuchSibling {
            edit: position,
            mapping: mapping.id,
        })?,
        Some(key) => *entries
            .iter()
            .find(|entry| decoded_value(index, entry.key) == Some(key))
            .ok_or(EditError::NoSuchSibling {
                edit: position,
                mapping: mapping.id,
            })?,
    };

    let indent = entry_column(source, index, position, mapping, &entries)?;
    // The **whole entry's** extent, not merely the value's: an entry written
    // `label:` has a zero-width value that the substrate reports *before* the
    // colon, so an insertion point taken from the value alone would land in the
    // middle of the entry's own punctuation.
    let (point, at_end_of_file) = insertion_point(
        source,
        entry_extent(index, trivia, anchor.key, anchor.value),
        position,
    )?;
    // Learned from the **anchor**, never from the document-wide preamble. The
    // preamble's answer is a majority vote that defaults to LF when a document
    // holds no break at all, so it invents a line ending for a single-line file
    // and writes LF after a CRLF sibling in a mixed one — the Phase 0c-3a
    // review's finding 2.
    let line_ending =
        line_ending_before(source, point).ok_or(EditError::NoObservableLineEnding {
            edit: position,
            at: point,
        })?;

    // Rendered in the mapping's own context: the parent indent is the column the
    // entry's key sits at, so a multi-line value becomes a `|` block two columns
    // further in. Flow context cannot arise — `editable_mapping` refuses a flow
    // mapping outright — but the context is still built through the same walk
    // D2k uses, so the two answers cannot drift apart.
    let context = ScalarContext::block(indent, line_ending);
    let key = choose_scalar(edit.key(), context.as_key());
    let value = choose_scalar(edit.value(), context);
    let mut entry = format!("{}: {}", key.render(), value.render());
    let text = if at_end_of_file {
        // Nothing terminates the previous line, so the break goes in front and
        // the file keeps not ending in one.
        format!("{}{}{entry}", line_ending.as_str(), " ".repeat(indent))
    } else {
        // A literal block's rendering already ends with the value's own trailing
        // breaks; only a value that ends without one needs the line terminated.
        if !entry.ends_with(['\n', '\r']) {
            entry.push_str(line_ending.as_str());
        }
        format!("{}{entry}", " ".repeat(indent))
    };

    let expectation = pending_field(
        position,
        edit.mapping().clone(),
        mapping,
        &entries,
        None,
        Some((edit.key().to_owned(), edit.value().to_owned())),
    );
    Ok(PlannedEdit {
        replacements: vec![Replacement {
            span: ByteSpan::new(point, point),
            text,
        }],
        // The insertion point, and nothing else. Derived from the anchor entry's
        // ownership extent and the line it ends, so it is a syntax fact rather
        // than a restatement of what is being written.
        permitted: vec![ByteSpan::new(point, point)],
        note: None,
        expectation: Some(expectation),
        items: None,
        moved: None,
        guards: vec![StructuralGuard::Insertion { at: point }],
        rewritten: None,
    })
} // End of function plan_insertion()

/// Plans a removal, or refuses it.
///
/// The envelope is a **set of runs**, not one span (`PROGRESS.md`, R21). The
/// order of the steps is the contract:
///
/// 1. address the entry, ask the gate, and establish the mapping has an entry to
///    spare — all unchanged from Phase 0c-3a;
/// 2. take the contiguous hull of what the entry's subtree owns
///    ([`entry_extent`]) and widen it to whole lines ([`removal_span`]);
/// 3. punch the file's own comments out of it ([`preserved_regions`]) and keep
///    what is left ([`runs_between`]);
/// 4. refuse the residual shapes, each by name and each read off the document
///    rather than off the arithmetic in step 3.
fn plan_removal(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &FieldRemoval,
) -> Result<PlannedEdit, EditError> {
    let resolved = resolve_full(index, edit.field()).map_err(|error| EditError::Unresolvable {
        edit: position,
        error,
    })?;
    let (Some(key), Some(parent)) = (resolved.key, resolved.parent) else {
        // A root path and a path ending in an index name no mapping entry.
        return Err(EditError::NotAMapping {
            edit: position,
            node: resolved.value,
            kind: index
                .node(resolved.value)
                .map_or(NodeKind::Document, |node| node.kind),
        });
    };
    let mapping_path = parent_path(edit.field()).ok_or(EditError::NotAMapping {
        edit: position,
        node: parent,
        kind: NodeKind::Document,
    })?;
    let (mapping, entries) = editable_mapping(index, trivia, position, &mapping_path)?;
    if mapping.id != parent {
        return Err(EditError::NotAMapping {
            edit: position,
            node: parent,
            kind: mapping.kind,
        });
    }
    if entries.len() < 2 {
        return Err(EditError::LastEntryOfMapping {
            edit: position,
            mapping: mapping.id,
        });
    }

    let extent = entry_extent(index, trivia, key, resolved.value);
    let runs = removal_envelope(source, index, trivia, position, extent)?.runs;

    let expectation = pending_field(
        position,
        mapping_path,
        mapping,
        &entries,
        Some(resolved.value),
        None,
    );
    Ok(PlannedEdit {
        replacements: runs
            .iter()
            .map(|run| Replacement {
                span: *run,
                text: String::new(),
            })
            .collect(),
        // The runs themselves: each is derived from the entry's key and value
        // node identifiers, the ownership rules and the source text, so the
        // permitted set is a syntax fact rather than a restatement of the
        // replacement list. `StructuralGuard::Removal` is what makes it more than
        // that, by stating what the runs may and must cover in terms of the
        // original index's node spans.
        permitted: runs.clone(),
        note: None,
        expectation: Some(expectation),
        items: None,
        moved: None,
        guards: vec![StructuralGuard::Removal {
            runs,
            entry: (key, resolved.value),
            kind: EnvelopeKind::RemovesTheEntry,
        }],
        rewritten: None,
    })
} // End of function plan_removal()

/// The envelope a removal deletes: the hull, the holes and the runs left over.
///
/// Factored out of [`plan_removal`] when Phase 0c-3b-2 gave the **source half of
/// a move** the same job. The two share this function rather than each deriving
/// an envelope, because a move that deleted a different set of bytes from the one
/// a removal deletes would be a second answer to a question that already has one
/// — and the run set is the answer `PROGRESS.md` D2o spent a whole phase on.
///
/// The steps are unchanged from Phase 0c-3b-1, in the order they must run:
///
/// 1. widen the ownership hull to whole lines ([`removal_span`]);
/// 2. punch the file's own comments, and the blank runs beside them, out of it
///    ([`preserved_regions`]);
/// 3. keep what is left ([`runs_between`]);
/// 4. refuse the three residual shapes, each read off the document rather than
///    off the arithmetic in steps 2 and 3.
///
/// # Errors
///
/// [`EditError::EntryDoesNotOwnItsLines`] from the widening,
/// [`EditError::RemovalWouldDeleteAFileComment`],
/// [`EditError::RemovalWouldExtendAKeptBlock`] and
/// [`EditError::RemovalWouldExtendABlockScalar`] from the refusals, and
/// [`EditError::MalformedSpan`] for an empty run set.
fn removal_envelope(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    extent: ByteSpan,
) -> Result<RemovalEnvelope, EditError> {
    let hull = removal_span(source, index, position, extent)?;
    // The file's comments punched out of the hull, and the runs that survive.
    // Both are derived after the hull has been widened to whole lines, because
    // widening is what can pull a comment in at either end.
    let preserved = preserved_regions(source, index, trivia, hull);
    let runs = runs_between(hull, &preserved);
    if runs.is_empty() {
        // Unreachable from a document the substrate accepted: the hull's first
        // line holds the entry's key and nothing else, so it is never preserved.
        // A hull with nothing left to delete would remove no entry, which
        // `verify_field` would report as `FieldNotRemoved` — a verification
        // failure for a planning mistake, which is the wrong layer.
        return Err(EditError::MalformedSpan {
            edit: position,
            at: hull,
        });
    }

    // Each of the three refusals below reads the document rather than the
    // arithmetic above it, so a defect in the punch-out is answered by name.
    for run in &runs {
        if let Some(comment) = file_comment_inside(trivia, *run) {
            return Err(EditError::RemovalWouldDeleteAFileComment {
                edit: position,
                comment,
            });
        }
        if let Some(block) = kept_block_the_removal_would_extend(source, index, *run) {
            return Err(EditError::RemovalWouldExtendAKeptBlock {
                edit: position,
                block,
            });
        }
    } // End of the loop over the runs the removal would delete
    if !preserved.is_empty() {
        if let Some(block) =
            block_scalar_the_kept_bytes_would_join(source, index, &preserved, runs[0].start)
        {
            return Err(EditError::RemovalWouldExtendABlockScalar {
                edit: position,
                block,
            });
        }
    }

    Ok(RemovalEnvelope {
        hull,
        preserved,
        runs,
    })
} // End of function removal_envelope()

/// What [`removal_envelope`] derived: the hull, the holes and the runs.
struct RemovalEnvelope {
    /// The ownership hull, widened to whole lines.
    hull: ByteSpan,
    /// The regions inside it the preservation rule protects.
    preserved: Vec<ByteSpan>,
    /// The ordered, disjoint runs the edit deletes.
    runs: Vec<ByteSpan>,
}

/// One sequence-item edit's claim about the sequence it changes, before the
/// splice.
///
/// Deliberately **not** the finished expectation, for the reason [`PendingField`]
/// is not one: a batch may change one sequence more than once, and two
/// independently-built expectations would each demand "one item more, or fewer,
/// than before" and contradict each other. [`fold_item_expectations`] merges every
/// claim about the same sequence into one ordered list of slots.
struct PendingItem {
    /// Position of the edit in the requested batch.
    edit: usize,
    /// The sequence the edit changes. Re-resolved against the candidate by its
    /// own path — which is also how a **promotion** is checked, because the path
    /// that named an implicit null in the original names the new sequence in the
    /// candidate.
    sequence: DocumentPath,
    /// Its identifier in the **original** index, which is what groups claims.
    /// For a promotion this is the zero-width scalar's, because there is no
    /// sequence yet.
    sequence_id: NodeId,
    /// Its items in the original index, in source order. Empty for a promotion.
    items: Vec<NodeId>,
    /// The original index of an item being removed.
    removed: Option<usize>,
    /// How many original items sit **above** an inserted one, and the fields it
    /// must hold.
    ///
    /// A count rather than an anchor index, because that is the number the fold
    /// needs and it is the same number for all three ways of asking: `after: Some(k)`
    /// gives `k + 1`, `after: None` gives the item count, and a promotion gives 0.
    inserted: Option<(usize, Vec<(String, String)>)>,
}

/// One position of a sequence, as the batch intends it.
enum ItemSlot {
    /// An item the batch did not name, with the digest it had in the original
    /// document — or `None` when another edit in the same batch legitimately
    /// rewrites something inside it, exactly as [`FieldExpectation::siblings`]
    /// records a sibling a scalar edit touches.
    Kept(Option<String>),
    /// The item an insertion writes: a flat mapping holding exactly these decoded
    /// key/value pairs, in this order.
    Inserted(Vec<(String, String)>),
}

/// What [`verify`] must find in the candidate for one changed sequence.
///
/// Recorded **before** the splice, from the original index, so the candidate is
/// compared against what the document said rather than against what the planner
/// believed.
struct ItemExpectation {
    /// Position of the first edit that changed this sequence.
    edit: usize,
    /// The sequence. Re-resolved against the candidate by its own path.
    sequence: DocumentPath,
    /// Every position the sequence must hold afterwards, in order.
    slots: Vec<ItemSlot>,
}

/// Merges every claim about one sequence into a single ordered expectation.
///
/// # The fold is the byte layout, stated as positions
///
/// One pass over the **original** item positions, emitting the insertions
/// anchored above each one and then the item itself unless a removal took it:
///
/// ```text
/// for i in 0..=items:
///     every insertion whose `before` count is i
///     item i, unless it was removed
/// ```
///
/// That is not an arbitrary convention — it is what the splice actually produces.
/// An insertion's point is just past the anchor item's line and a removal's runs
/// begin at the start of the removed item's first line, so an insertion anchored
/// after an item that is **itself** removed lands exactly where that item was, and
/// the loop gives that answer without a special case.
///
/// Two of the batches this arithmetic could describe never reach it, because
/// [`apply_edits`] rejects two spans that **share a start**
/// ([`EditError::OverlappingEdits`]): two insertions with the same `before` count,
/// and an insertion anchored after item *k* when item *k + 1* is also being
/// removed. The second is a real ambiguity rather than an over-strict rule — the
/// new text could land before or after the deleted region, and nothing in the
/// request says which.
///
/// # Errors
///
/// [`EditError::RemovalWouldEmptyTheSequence`] when the folded claims would leave
/// a sequence with no items. Each removal was planned against the original item
/// count, so only the folded claim can see two legal removals emptying a two-item
/// sequence between them.
fn fold_item_expectations(
    index: &SyntaxIndex,
    pending: Vec<PendingItem>,
    touched: &[NodeId],
) -> Result<Vec<ItemExpectation>, EditError> {
    let mut folded: Vec<(NodeId, PendingItem, Vec<PendingItem>)> = Vec::new();
    for claim in pending {
        match folded
            .iter_mut()
            .find(|(id, _, _)| *id == claim.sequence_id)
        {
            Some(slot) => slot.2.push(claim),
            None => folded.push((claim.sequence_id, claim, Vec::new())),
        }
    } // End of the loop that groups every claim by the sequence it changes

    let mut expectations = Vec::new();
    for (sequence_id, first, rest) in folded {
        let claims: Vec<&PendingItem> = std::iter::once(&first).chain(rest.iter()).collect();
        let items = first.items.clone();
        let mut slots = Vec::new();
        for at in 0..=items.len() {
            for claim in &claims {
                if let Some((before, fields)) = &claim.inserted {
                    if *before == at {
                        slots.push(ItemSlot::Inserted(fields.clone()));
                    }
                }
            } // End of the loop over the insertions anchored above this position
            let Some(item) = items.get(at) else {
                continue;
            };
            if claims.iter().any(|claim| claim.removed == Some(at)) {
                continue;
            }
            let inside = touched
                .iter()
                .any(|node| in_subtree(index, *item, *node) || *node == *item);
            slots.push(ItemSlot::Kept((!inside).then(|| digest(index, *item))));
        } // End of the loop that replays the batch over the original positions

        if slots.is_empty() {
            return Err(EditError::RemovalWouldEmptyTheSequence {
                edit: first.edit,
                sequence: sequence_id,
            });
        }
        expectations.push(ItemExpectation {
            edit: first.edit,
            sequence: first.sequence.clone(),
            slots,
        });
    } // End of the loop that turns each sequence's claims into one expectation
    Ok(expectations)
} // End of function fold_item_expectations()

/// What [`verify`] must find in the candidate after a move.
///
/// Recorded **before** the splice and derived from the original index, so the
/// candidate is compared against what the document said rather than against what
/// the planner believed. `from` and `to` are indices into the sequence's own child
/// list, which is what makes the expectation a permutation of facts rather than a
/// description of bytes.
struct MoveExpectation {
    /// Position of the edit in the requested batch.
    edit: usize,
    /// The sequence. Re-resolved against the candidate by its own path.
    sequence: DocumentPath,
    /// Its identifier in the **original** index.
    sequence_id: NodeId,
    /// The item being relocated, in the **original** index.
    ///
    /// Carried so that verification can bound the envelope runs by the item's own
    /// physical lines without asking the planner where it thought they were; see
    /// [`VerificationFailure::MoveCarriesMoreThanTheItem`].
    item: NodeId,
    /// The item's index in the original sequence.
    from: usize,
    /// The index it must occupy in the candidate.
    to: usize,
}

impl MoveExpectation {
    /// The sequence's child positions, in the order the move intends.
    ///
    /// Stated as a permutation of the original indices rather than as a list of
    /// node identifiers, because the candidate is a **fresh parse** whose
    /// identifiers bear no relation to the original's (`PROGRESS.md`, D2j). The
    /// comparison is then "candidate position *i* holds what original position
    /// `order[i]` held", which is checkable across two parses.
    fn order(&self, items: usize) -> Vec<usize> {
        let mut positions: Vec<usize> = (0..items).collect();
        if self.from >= positions.len() {
            return positions;
        }
        let moved = positions.remove(self.from);
        positions.insert(self.to.min(positions.len()), moved);
        positions
    } // End of function order()
} // End of impl MoveExpectation

/// Plans a move, or refuses it.
///
/// A move is **a removal plus an insertion whose replacements do not overlap**,
/// and this function is deliberately not an engine: the source half is
/// [`removal_envelope`], the same call [`plan_removal`] makes, and the
/// destination half is [`insertion_point`], the same call [`plan_insertion`]
/// makes. What is new is the join between them.
///
/// The order of the steps is the contract:
///
/// 1. address the item, establish that its parent is a **block sequence**, and
///    ask the gate about that whole sequence — a move changes the sequence's own
///    shape, so a hazard anywhere in it makes the change unreasonable locally,
///    exactly as `editable_mapping` argues for an entry's mapping;
/// 2. work out where the item ends up, and refuse a request that leaves it where
///    it is;
/// 3. derive the source envelope, which refuses everything a removal refuses;
/// 4. derive the destination point, and take the moved bytes **verbatim** from
///    the source runs;
/// 5. refuse every seam at which a block scalar could swallow a line — three
///    external ones and one per adjacent pair of carried runs ([`MoveSeam`]).
///
/// # Nothing is rendered, and nothing is re-indented
///
/// The bytes written at the destination are the bytes the runs hold, copied. Two
/// positions in one block sequence sit at the same column by construction, so
/// there is no indentation to recompute — and a leading comment block at a column
/// the user chose keeps that column. The only byte a move ever writes that it did
/// not carry is **none**: when the destination is the end of a file that does not
/// end in a line break, the item's own trailing break is written in front of it
/// instead of behind it, which relocates a break rather than inventing one
/// (`PROGRESS.md`, D2p).
fn plan_move(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &ItemMove,
) -> Result<PlannedEdit, EditError> {
    let target = editable_sequence_item(index, trivia, position, edit.item())?;
    let SequenceItem {
        sequence,
        path: sequence_path,
        item,
        index: from,
    } = target;

    let items = &sequence.children;
    // Where the item ends up, counted in the sequence **after** it has been taken
    // out. The arithmetic itself is `ItemMove::resulting_index`, so that a caller
    // asking "which item is the moved one now?" after the commit gets its answer
    // from this same expression rather than from a second copy of it.
    if let Some(anchor) = edit.destination() {
        if anchor >= items.len() {
            return Err(EditError::NoSuchDestinationItem {
                edit: position,
                sequence: sequence.id,
                items: items.len(),
            });
        }
    }
    let to = edit.resulting_index(from);
    if to == from {
        return Err(EditError::MoveChangesNothing {
            edit: position,
            item,
        });
    }

    // The source half. Every refusal a removal makes, made here by the same call
    // [`RemoveItem`] makes.
    let envelope = lift_item(source, index, trivia, position, item)?;

    // The destination half. The front of the sequence is the start of the first
    // item's own **hull**, so a leading comment block belonging to that item stays
    // above the arrival rather than being adopted by it.
    let anchor = items[edit.destination().unwrap_or(0)];
    let anchor_extent = trivia.subtree_extent(index, anchor);
    let (point, at_end_of_file) = match edit.destination() {
        None => (
            removal_span(source, index, position, anchor_extent)?.start,
            false,
        ),
        Some(_) => insertion_point(source, anchor_extent, position)?,
    };
    if point >= envelope.hull.start && point <= envelope.hull.end {
        // Unreachable: `to != from` puts the anchor's own lines strictly outside
        // the item's. A bug in this crate rather than a request to refuse.
        return Err(EditError::MalformedSpan {
            edit: position,
            at: ByteSpan::new(point, point),
        });
    }

    let mut carried = String::new();
    for run in &envelope.runs {
        carried.push_str(run.slice(source).ok_or(EditError::MalformedSpan {
            edit: position,
            at: *run,
        })?);
    } // End of the loop that collects the bytes the item's runs hold
    if at_end_of_file {
        // The document's last line has no terminator. Writing the item after it
        // gives that line one — and the only break available is the item's own,
        // which may not even be the style the destination's neighbours use.
        // D2p allows exactly one answer where there is no local break to copy, and
        // it is this one (the Phase 0c-3b-2a review's finding 2).
        return Err(EditError::MoveWouldTerminateTheFinalLine {
            edit: position,
            at: point,
        });
    }
    if !carried.ends_with(['\n', '\r']) {
        // The item is the document's unterminated last line and the destination is
        // not the end of the document. Terminating it there would invent a break;
        // taking one from the line above instead would delete a line the file
        // holds. Refused rather than either (`PROGRESS.md`, D2p).
        return Err(EditError::MoveWouldInventALineEnding {
            edit: position,
            at: envelope.hull.end,
        });
    }
    let text = carried.clone();

    // The block the item **ends with** is not carried whole: a keep-chomped
    // block's trailing breaks belong to whatever follows it, and what follows it
    // changes.
    if let Some(block) = kept_block_the_move_would_extend(source, index, envelope.hull, point) {
        return Err(EditError::MoveWouldExtendAKeptBlock {
            edit: position,
            block,
        });
    }

    let body_offset = index.preamble().body_offset;
    // Seam 1 — the source closes. What followed the item rises to sit under what
    // preceded it. This is the one seam a plain removal creates as well, so it is
    // the same call [`plan_item_removal`] makes rather than a second statement of
    // the condition.
    if let Some(block) = block_the_source_close_would_feed(source, index, &envelope, body_offset) {
        return Err(EditError::MoveWouldExtendABlockScalar {
            edit: position,
            block,
            seam: MoveSeam::SourceCloses,
        });
    }
    // Seam 2 — the arrival lands. The item's own first non-blank line comes to sit
    // under whatever precedes the destination.
    if let Some(column) = first_kept_column(source, &envelope.runs, body_offset) {
        if let Some(block) = block_absorbing_a_line(source, index, point, column) {
            return Err(EditError::MoveWouldExtendABlockScalar {
                edit: position,
                block,
                seam: MoveSeam::ArrivalLands,
            });
        }
    }
    // Seam 3 — the arrival closes. Whatever followed the destination comes to sit
    // under the item's own last line, which may be a block scalar's content.
    if let Some(column) = first_non_blank_column_from(source, point, body_offset) {
        if let Some(block) = block_absorbing_a_line(source, index, envelope.hull.end, column) {
            return Err(EditError::MoveWouldExtendABlockScalar {
                edit: position,
                block,
                seam: MoveSeam::ArrivalCloses,
            });
        }
    }
    // The **internal** seams, one per adjacent pair of carried runs. A hole in the
    // envelope is a comment the file owns staying behind, so the two runs on
    // either side of it become neighbours at the destination although they never
    // were in the document. The Phase 0c-3b-2a review's finding 3 is that the
    // three seams above are not the whole set.
    for after in 1..envelope.runs.len() {
        let before = envelope.runs[after - 1];
        let Some(column) = first_kept_column(source, &envelope.runs[after..], body_offset) else {
            continue;
        };
        if let Some(block) = block_absorbing_a_line(source, index, before.end, column) {
            return Err(EditError::MoveWouldExtendABlockScalar {
                edit: position,
                block,
                seam: MoveSeam::CarriedRunsJoin,
            });
        }
    } // End of the loop over the joins the concatenated runs create

    let arrival = ByteSpan::new(point, point);
    let mut replacements: Vec<Replacement> = envelope
        .runs
        .iter()
        .map(|run| Replacement {
            span: *run,
            text: String::new(),
        })
        .collect();
    replacements.push(Replacement {
        span: arrival,
        text,
    });
    let mut permitted = envelope.runs.clone();
    permitted.push(arrival);
    Ok(PlannedEdit {
        replacements,
        permitted,
        note: None,
        expectation: None,
        items: None,
        moved: Some(MoveExpectation {
            edit: position,
            sequence: sequence_path,
            sequence_id: sequence.id,
            item,
            from,
            to,
        }),
        // Both halves are pinned against the original index's node spans: the
        // source from both sides, exactly as a plain removal's is, and the
        // destination against the leaves it must not land inside.
        guards: vec![
            StructuralGuard::Removal {
                runs: envelope.runs,
                entry: (item, item),
                kind: EnvelopeKind::CarriesTheItem,
            },
            StructuralGuard::Insertion { at: point },
        ],
        rewritten: None,
    })
} // End of function plan_move()

// ---------------------------------------------------------------------------
// Sequence items: the lift both a move and a removal make, and the insert
// ---------------------------------------------------------------------------

/// A sequence item, resolved and checked exactly as a move checks one.
///
/// Factored out of [`plan_move`] when [`RemoveItem`] arrived, and factored out
/// **whole**: the four gates, their order and the errors they report are the
/// move's own, so a removal cannot come to a different conclusion about which
/// items are addressable. That is the same argument [`removal_envelope`] makes
/// for the envelope one step further down.
struct SequenceItem<'index> {
    /// The block sequence the item belongs to.
    sequence: &'index Node,
    /// The sequence's own path, for re-resolution against the candidate.
    path: DocumentPath,
    /// The item node in the **original** index.
    item: NodeId,
    /// Its position in the sequence's child list.
    index: usize,
}

/// Resolves a sequence item and checks it is one this engine may lift.
///
/// The gates, in the order [`plan_move`] has always asked them and for the
/// reasons it records:
///
/// 1. the path resolves, and names a node with a parent;
/// 2. that parent is a **sequence**;
/// 3. `TriviaIndex::disqualifying_hazard` says nothing about **the whole
///    sequence** — lifting an item changes the sequence's own shape, so a hazard
///    anywhere in it makes the change unreasonable locally, exactly as
///    [`editable_mapping`] argues for an entry's mapping;
/// 4. neither the sequence nor any ancestor is bracket-delimited;
/// 5. the item really is one of the sequence's children.
///
/// # Errors
///
/// [`EditError::Unresolvable`], [`EditError::NotASequenceItem`],
/// [`EditError::Refused`], [`EditError::FlowCollection`] and
/// [`EditError::MalformedSpan`].
fn editable_sequence_item<'index>(
    index: &'index SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    path: &DocumentPath,
) -> Result<SequenceItem<'index>, EditError> {
    let resolved = resolve_full(index, path).map_err(|error| EditError::Unresolvable {
        edit: position,
        error,
    })?;
    let item = resolved.value;
    let Some(parent) = resolved.parent else {
        return Err(EditError::NotASequenceItem {
            edit: position,
            node: item,
            kind: NodeKind::Document,
        });
    };
    let sequence = index.node(parent).ok_or(EditError::MalformedSpan {
        edit: position,
        at: ByteSpan::default(),
    })?;
    if sequence.kind != NodeKind::Sequence {
        return Err(EditError::NotASequenceItem {
            edit: position,
            node: item,
            kind: sequence.kind,
        });
    }
    // The gate, before anything is derived and before a byte is read.
    if let Some(hazard) = trivia.disqualifying_hazard(index, sequence.id) {
        return Err(EditError::Refused {
            edit: position,
            node: sequence.id,
            hazard: hazard.kind,
            at: hazard.span,
        });
    }
    if sequence.collection_style == Some(CollectionStyle::Flow)
        || is_inside_a_flow_collection(index, sequence)
    {
        return Err(EditError::FlowCollection {
            edit: position,
            node: sequence.id,
        });
    }
    let sequence_path = containing_path(path).ok_or(EditError::NotASequenceItem {
        edit: position,
        node: item,
        kind: sequence.kind,
    })?;
    let Some(at) = sequence.children.iter().position(|id| *id == item) else {
        return Err(EditError::NotASequenceItem {
            edit: position,
            node: item,
            kind: sequence.kind,
        });
    };
    Ok(SequenceItem {
        sequence,
        path: sequence_path,
        item,
        index: at,
    })
} // End of function editable_sequence_item()

/// The envelope a sequence item's **lift** takes.
///
/// **The one derivation, shared by [`plan_move`] and [`plan_item_removal`]**, and
/// the reason [`RemoveItem`] is documented as a move's lift half rather than as
/// something that happens to agree with one. A removal that deleted a different
/// set of bytes from the ones a move relocates would be a second answer to the
/// question `PROGRESS.md` D2o settled, and the whole point of a run-based
/// envelope is that there is one.
///
/// A sequence item has **no key half**: the `-` that introduces it is trivia the
/// item itself owns (`PROGRESS.md`, D2d), so one subtree extent is the whole of
/// it, and [`removal_envelope`] does the rest — whole lines, the file's own
/// comments and their blank runs punched out, and every residual shape refused by
/// name.
///
/// # Errors
///
/// Everything [`removal_envelope`] refuses.
fn lift_item(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    item: NodeId,
) -> Result<RemovalEnvelope, EditError> {
    removal_envelope(
        source,
        index,
        trivia,
        position,
        trivia.subtree_extent(index, item),
    )
} // End of function lift_item()

/// The block scalar the join a lift opens would feed, if there is one.
///
/// **The source-gap join, written once.** Lifting bytes out of a document makes
/// what followed them rise to sit under what preceded them, and a line that lands
/// at or past a block scalar's body column directly under that block's content
/// stops being a line and becomes part of the value — a value nobody edited. The
/// condition is [`block_absorbing_a_line`]'s, asked at the seam the lift creates.
///
/// Both callers ask it and each reports it in its own vocabulary:
/// [`plan_move`] as [`EditError::MoveWouldExtendABlockScalar`] at
/// [`MoveSeam::SourceCloses`], [`plan_item_removal`] as
/// [`EditError::RemovalWouldExtendABlockScalar`]. The *condition* is shared; only
/// the name of the operation that provoked it is not.
///
/// `None` when the envelope preserves something, because then the preserved lines
/// are what rises and [`removal_envelope`] has already refused that case by name
/// through [`block_scalar_the_kept_bytes_would_join`].
fn block_the_source_close_would_feed(
    source: &str,
    index: &SyntaxIndex,
    envelope: &RemovalEnvelope,
    body_offset: usize,
) -> Option<NodeId> {
    if !envelope.preserved.is_empty() {
        return None;
    }
    let column = first_non_blank_column_from(source, envelope.hull.end, body_offset)?;
    block_absorbing_a_line(source, index, envelope.hull.start, column)
} // End of function block_the_source_close_would_feed()

/// Plans a sequence-item removal, or refuses it.
///
/// **The lift half of [`plan_move`] with no landing**, and deliberately not one
/// line more than that. The order of the steps is the contract:
///
/// 1. address the item and ask the gate, through [`editable_sequence_item`] —
///    the move's own four checks, in the move's own order;
/// 2. establish that the sequence has an item to spare
///    ([`EditError::RemovalWouldEmptyTheSequence`]);
/// 3. derive the envelope, through [`lift_item`] — the move's own call;
/// 4. refuse the one join the deletion opens, through
///    [`block_the_source_close_would_feed`] — the move's own condition.
///
/// Each envelope run becomes its own replacement with empty text, exactly as
/// [`plan_removal`] emits a mapping entry's, so the comments and blank runs the
/// item's envelope owns go with it and everything the surviving neighbours own
/// comes out byte-identical.
fn plan_item_removal(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &RemoveItem,
) -> Result<PlannedEdit, EditError> {
    let target = editable_sequence_item(index, trivia, position, edit.item())?;
    if target.sequence.children.len() < 2 {
        return Err(EditError::RemovalWouldEmptyTheSequence {
            edit: position,
            sequence: target.sequence.id,
        });
    }

    let envelope = lift_item(source, index, trivia, position, target.item)?;
    let body_offset = index.preamble().body_offset;
    if let Some(block) = block_the_source_close_would_feed(source, index, &envelope, body_offset) {
        return Err(EditError::RemovalWouldExtendABlockScalar {
            edit: position,
            block,
        });
    }

    let runs = envelope.runs;
    Ok(PlannedEdit {
        replacements: runs
            .iter()
            .map(|run| Replacement {
                span: *run,
                text: String::new(),
            })
            .collect(),
        permitted: runs.clone(),
        note: None,
        expectation: None,
        items: Some(PendingItem {
            edit: position,
            sequence: target.path,
            sequence_id: target.sequence.id,
            items: target.sequence.children.clone(),
            removed: Some(target.index),
            inserted: None,
        }),
        moved: None,
        // The same guard a mapping entry's removal carries, with the item as both
        // halves of the entry: a sequence item has no key. `RemovesTheEntry` is
        // the kind that also bounds every run by [`entry_owned_runs`], which is
        // the only layer that can see a deleted **blank** line — a move is bounded
        // by `verify` instead, and a removal has no `verify`-side bound of its own.
        guards: vec![StructuralGuard::Removal {
            runs,
            entry: (target.item, target.item),
            kind: EnvelopeKind::RemovesTheEntry,
        }],
        rewritten: None,
    })
} // End of function plan_item_removal()

/// Plans a sequence-item insertion, or refuses it.
///
/// The order of the checks is the contract, exactly as in [`plan_one`] and
/// [`plan_insertion`]: address the target, **ask the gate**, establish that the
/// shape is one this step understands, validate the request, and only then render
/// anything.
///
/// 1. resolve the path and ask the gate about the node it names;
/// 2. decide which of the two shapes it is — an existing block sequence, or the
///    one implicit-null mapping value this step may promote into one — and refuse
///    everything else ([`EditError::NotASequence`],
///    [`EditError::FlowSequenceInsertionUnsupported`]);
/// 3. validate the requested fields ([`EditError::InsertedItemHasNoFields`],
///    [`EditError::DuplicateInsertedField`],
///    [`EditError::InvalidInsertedFieldKey`]);
/// 4. derive the marker column and the insertion point from the document;
/// 5. render one item with [`crate::emit::choose_scalar`], the codec every other
///    edit in this module uses.
fn plan_item_insertion(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &InsertItem,
) -> Result<PlannedEdit, EditError> {
    let resolved =
        resolve_full(index, edit.sequence()).map_err(|error| EditError::Unresolvable {
            edit: position,
            error,
        })?;
    let target = index.node(resolved.value).ok_or(EditError::MalformedSpan {
        edit: position,
        at: ByteSpan::default(),
    })?;
    // The gate, before the shape is examined and before a byte is read. Asked on
    // the target itself, which reaches its ancestors and its descendants
    // (`TriviaIndex::disqualifying_hazard`), so a hazard in the surrounding
    // mapping disqualifies a promotion too.
    if let Some(hazard) = trivia.disqualifying_hazard(index, resolved.value) {
        return Err(EditError::Refused {
            edit: position,
            node: resolved.value,
            hazard: hazard.kind,
            at: hazard.span,
        });
    }
    check_inserted_fields(position, edit.fields())?;

    let body_offset = index.preamble().body_offset;
    let (marker, point, at_end_of_file, items) = match target.kind {
        NodeKind::Sequence => {
            if target.collection_style == Some(CollectionStyle::Flow)
                || is_inside_a_flow_collection(index, target)
            {
                return Err(EditError::FlowSequenceInsertionUnsupported {
                    edit: position,
                    sequence: target.id,
                });
            }
            let marker = sequence_marker_column(source, index, trivia, position, target)?;
            let anchor = match edit.destination() {
                None => *target.children.last().ok_or(EditError::NotASequence {
                    edit: position,
                    node: target.id,
                    kind: target.kind,
                })?,
                Some(at) => *target.children.get(at).ok_or({
                    EditError::NoSuchDestinationItem {
                        edit: position,
                        sequence: target.id,
                        items: target.children.len(),
                    }
                })?,
            };
            let extent = trivia.subtree_extent(index, anchor);
            let (point, at_end_of_file) = insertion_point(source, extent, position)?;
            let before = edit
                .destination()
                .map_or(target.children.len(), |at| at + 1);
            (
                marker,
                point,
                at_end_of_file,
                (before, target.children.clone()),
            )
        }
        NodeKind::Scalar if target.is_zero_width() => {
            let (marker, point, at_end_of_file) =
                promote_implicit_null(source, index, trivia, position, &resolved, body_offset)?;
            (marker, point, at_end_of_file, (0usize, Vec::new()))
        }
        _ => {
            return Err(EditError::NotASequence {
                edit: position,
                node: target.id,
                kind: target.kind,
            })
        }
    };

    // Copied from the document, never chosen: `LineEnding::detect`'s LF default
    // is exactly the silent reformatting this crate exists to prevent (D2p).
    let line_ending =
        line_ending_before(source, point).ok_or(EditError::NoObservableLineEnding {
            edit: position,
            at: point,
        })?;
    let text = render_item(edit.fields(), marker, line_ending, at_end_of_file);

    Ok(PlannedEdit {
        replacements: vec![Replacement {
            span: ByteSpan::new(point, point),
            text,
        }],
        // The insertion point, and nothing else — derived from the anchor's
        // ownership extent and the line it ends, so it is a syntax fact rather
        // than a restatement of what is being written.
        permitted: vec![ByteSpan::new(point, point)],
        note: None,
        expectation: None,
        items: Some(PendingItem {
            edit: position,
            sequence: edit.sequence().clone(),
            sequence_id: target.id,
            items: items.1,
            removed: None,
            inserted: Some((items.0, edit.fields().to_vec())),
        }),
        moved: None,
        guards: vec![StructuralGuard::Insertion { at: point }],
        rewritten: None,
    })
} // End of function plan_item_insertion()

/// Checks the fields a new item is to be born with.
///
/// Three refusals, all of them about the **request** rather than about the
/// document, and all of them made before a column or an offset is derived. See
/// [`EditError::InsertedItemHasNoFields`], [`EditError::DuplicateInsertedField`]
/// and [`EditError::InvalidInsertedFieldKey`] for what each one costs.
///
/// # Errors
///
/// The three variants above, each carrying a **position** in the field list and
/// never a key (`CLAUDE.md` section 1).
fn check_inserted_fields(position: usize, fields: &[(String, String)]) -> Result<(), EditError> {
    if fields.is_empty() {
        return Err(EditError::InsertedItemHasNoFields { edit: position });
    }
    for (at, (key, _)) in fields.iter().enumerate() {
        if key.is_empty() || key.contains(['\n', '\r']) {
            return Err(EditError::InvalidInsertedFieldKey {
                edit: position,
                field: at,
            });
        }
        if fields[..at].iter().any(|(seen, _)| seen == key) {
            return Err(EditError::DuplicateInsertedField {
                edit: position,
                field: at,
            });
        }
    } // End of the loop that checks every requested field
    Ok(())
} // End of function check_inserted_fields()

/// The column every item of a block sequence puts its `-` at.
///
/// **Read off the ownership layer, never re-lexed.** Each item owns the
/// [`crate::syntax::Punctuation::SequenceDash`] that introduces it
/// (`PROGRESS.md`, D2d), so the column is a fact the trivia scanner already
/// published; scanning the text for a `-` would be a second answer to a question
/// that already has one, and it would get a compact `- - x` wrong.
///
/// # Errors
///
/// [`EditError::InconsistentSequenceIndentation`] when two items disagree, and
/// [`EditError::MalformedSpan`] for a block sequence item with no dash at all,
/// which is a bug in this crate rather than a document a user can write.
fn sequence_marker_column(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    sequence: &Node,
) -> Result<usize, EditError> {
    let body_offset = index.preamble().body_offset;
    let mut expected: Option<usize> = None;
    for item in &sequence.children {
        let dash = trivia
            .items_owned_by(*item)
            .find(|trivia| trivia.kind == TriviaKind::Punctuation(Punctuation::SequenceDash))
            .ok_or(EditError::MalformedSpan {
                edit: position,
                at: sequence.span,
            })?;
        let found = column_of(source, dash.span.start, body_offset);
        match expected {
            None => expected = Some(found),
            Some(column) if column != found => {
                return Err(EditError::InconsistentSequenceIndentation {
                    edit: position,
                    sequence: sequence.id,
                    expected: column,
                    found,
                })
            }
            Some(_) => {}
        }
    } // End of the loop over the sequence's item dashes
    expected.ok_or(EditError::MalformedSpan {
        edit: position,
        at: sequence.span,
    })
} // End of function sequence_marker_column()

/// Where the first item of a promoted implicit-null mapping value goes.
///
/// The one place this module brings a collection into existence, and every number
/// in it is read off the document rather than chosen. See [`InsertItem`] for the
/// licence and [`EditError::ImplicitNullSequenceHasAmbiguousTrivia`] for the one
/// shape it refuses.
///
/// Returns the `-` marker column, the offset to splice at, and whether that
/// offset is the unterminated end of the document.
///
/// # Errors
///
/// [`EditError::NotASequence`] when the implicit null is not a mapping value —
/// a bare `- ` sequence item is one too, and promoting *that* would nest a
/// sequence inside a sequence, which is not "add an item";
/// [`EditError::ImplicitNullSequenceHasAmbiguousTrivia`]; and everything
/// [`insertion_point`] refuses.
fn promote_implicit_null(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    resolved: &Resolved,
    body_offset: usize,
) -> Result<(usize, usize, bool), EditError> {
    let (Some(key), Some(parent)) = (resolved.key, resolved.parent) else {
        return Err(EditError::NotASequence {
            edit: position,
            node: resolved.value,
            kind: index
                .node(resolved.value)
                .map_or(NodeKind::Document, |node| node.kind),
        });
    };
    let key_node = index.node(key).ok_or(EditError::MalformedSpan {
        edit: position,
        at: ByteSpan::default(),
    })?;
    let key_column = column_of(source, key_node.span.start, body_offset);
    let step = indentation_step(source, index, trivia, parent, key);

    // Past the key, its colon and any inline comment on the same line, to just
    // after the break that terminates it — the same call an entry insertion makes.
    let extent = entry_extent(index, trivia, key, resolved.value);
    let (point, at_end_of_file) = insertion_point(source, extent, position)?;
    if !at_end_of_file && a_standalone_comment_starts_at(source, point) {
        return Err(EditError::ImplicitNullSequenceHasAmbiguousTrivia {
            edit: position,
            at: point,
        });
    }
    Ok((key_column + step, point, at_end_of_file))
} // End of function promote_implicit_null()

/// Whether the physical line starting at `at` holds nothing but a comment.
///
/// The condition [`EditError::ImplicitNullSequenceHasAmbiguousTrivia`] turns on.
/// A blank line is deliberately not one: a comment separated from what follows by
/// a blank line belongs to the **file** under plan section 6.2's rule 2, and the
/// file keeps it wherever the insertion lands.
fn a_standalone_comment_starts_at(source: &str, at: usize) -> bool {
    source
        .get(at..)
        .map(|rest| rest.trim_start_matches([' ', '\t']))
        .is_some_and(|text| text.starts_with('#'))
}

/// How many columns further in this document indents a block child.
///
/// The evidence is taken in three passes, narrowest first, and the number is
/// never invented until all three are exhausted:
///
/// 1. **the block children of the same surrounding mapping.** The closest thing
///    the document says about how *this* mapping indents;
/// 2. **every mapping entry in the document** whose value is a block collection.
///    The document's own dominant step;
/// 3. **two columns**, the renderer's documented default
///    ([`crate::emit::ScalarContext::block`]), and only when the document offers
///    no evidence at all — a single-entry file whose only collection is the one
///    being created.
///
/// A step of **zero** is real evidence, not a missing answer: `matches:` with its
/// items' dashes at the key's own column is idiomatic YAML and is what a document
/// that writes it that way is saying. Ties are broken by the smallest step, which
/// is what a `BTreeMap`'s ascending iteration gives for free.
fn indentation_step(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    mapping: NodeId,
    exclude: NodeId,
) -> usize {
    let local = observed_steps(source, index, trivia, Some(mapping), exclude);
    if let Some(step) = dominant(&local) {
        return step;
    }
    dominant(&observed_steps(source, index, trivia, None, exclude)).unwrap_or(2)
} // End of function indentation_step()

/// The most common step of a tally, smallest winning a tie.
fn dominant(steps: &BTreeMap<usize, usize>) -> Option<usize> {
    steps
        .iter()
        .max_by_key(|(step, count)| (**count, usize::MAX - **step))
        .map(|(step, _)| *step)
}

/// Every (key column → block child column) step the document actually shows.
///
/// `within` restricts the walk to one mapping's own entries; `None` walks every
/// mapping in the document. `exclude` is the key of the entry being promoted,
/// which has no block child to measure and must never be counted as evidence
/// about itself.
fn observed_steps(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    within: Option<NodeId>,
    exclude: NodeId,
) -> BTreeMap<usize, usize> {
    let body_offset = index.preamble().body_offset;
    let mut steps: BTreeMap<usize, usize> = BTreeMap::new();
    for node in index.nodes() {
        if node.kind != NodeKind::Mapping || within.is_some_and(|id| id != node.id) {
            continue;
        }
        for entry in mapping_entries(node) {
            if entry.key == exclude {
                continue;
            }
            let (Some(key), Some(value)) = (index.node(entry.key), index.node(entry.value)) else {
                continue;
            };
            let Some(child) = block_child_column(source, index, trivia, value, body_offset) else {
                continue;
            };
            if let Some(step) = child.checked_sub(column_of(source, key.span.start, body_offset)) {
                *steps.entry(step).or_insert(0) += 1;
            }
        } // End of the loop over this mapping's entries
    } // End of the loop over the document's mappings
    steps
} // End of function observed_steps()

/// The column a block collection's first child begins at, or `None`.
///
/// A sequence's answer is its first item's dash, read off the ownership layer as
/// [`sequence_marker_column`] reads it; a mapping's is its first key's own column.
/// A flow collection has no answer, because its children share a line with the
/// brackets that introduce them.
fn block_child_column(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    value: &Node,
    body_offset: usize,
) -> Option<usize> {
    if value.collection_style == Some(CollectionStyle::Flow) {
        return None;
    }
    let first = *value.children.first()?;
    match value.kind {
        NodeKind::Sequence => trivia
            .items_owned_by(first)
            .find(|item| item.kind == TriviaKind::Punctuation(Punctuation::SequenceDash))
            .map(|dash| column_of(source, dash.span.start, body_offset)),
        NodeKind::Mapping => index
            .node(first)
            .map(|key| column_of(source, key.span.start, body_offset)),
        _ => None,
    }
} // End of function block_child_column()

/// Renders one new block-mapping sequence item.
///
/// The first field's line carries the `- ` marker; every later field is indented
/// two columns further so that its key lines up under the first one's. Every
/// scalar — key and value alike — is spelled by [`crate::emit::choose_scalar`] in
/// a context whose parent indent is the item's own key column, so a multi-line
/// value becomes a `|` block indented two columns inside that.
///
/// `at_end_of_file` inverts where the line ending goes: the break is written in
/// **front** of the item and the last line is left unterminated, so a document
/// with no final newline keeps not having one. A last field whose value is a block
/// scalar terminates itself, and its own trailing break is never taken away —
/// removing one would silently shorten the user's value.
fn render_item(
    fields: &[(String, String)],
    marker: usize,
    line_ending: LineEnding,
    at_end_of_file: bool,
) -> String {
    let context = ScalarContext::block(marker + 2, line_ending);
    let mut text = String::new();
    if at_end_of_file {
        text.push_str(line_ending.as_str());
    }
    for (at, (key, value)) in fields.iter().enumerate() {
        let key = choose_scalar(key, context.as_key());
        let value = choose_scalar(value, context);
        let entry = format!("{}: {}", key.render(), value.render());
        text.push_str(&" ".repeat(marker));
        text.push_str(if at == 0 { "- " } else { "  " });
        text.push_str(&entry);
        let last = at + 1 == fields.len();
        if !entry.ends_with(['\n', '\r']) && !(last && at_end_of_file) {
            text.push_str(line_ending.as_str());
        }
    } // End of the loop that writes one line per requested field
    text
} // End of function render_item()

/// The block scalar the moved item ends with, when relocating it would change
/// that block's value.
///
/// See [`EditError::MoveWouldExtendAKeptBlock`] for the clause. The block is
/// identified the same way [`kept_block_the_removal_would_extend`] identifies its
/// own: content ending at or before a boundary with nothing but blank lines in
/// between. Here the boundary is the **end of the item's own hull**, so a block
/// anywhere else in the document has the item's remaining bytes between it and
/// that boundary and is excluded by construction.
fn kept_block_the_move_would_extend(
    source: &str,
    index: &SyntaxIndex,
    hull: ByteSpan,
    point: usize,
) -> Option<NodeId> {
    let lands_on_a_blank_line = source.get(point..).is_some_and(|after| {
        !after.is_empty() && {
            let next = after.find(['\n', '\r']).unwrap_or(after.len());
            after[..next]
                .chars()
                .all(|character| character == ' ' || character == '\t')
        }
    });
    if !lands_on_a_blank_line {
        return None;
    }
    index
        .nodes()
        .iter()
        .filter_map(|node| node.scalar.as_ref().map(|scalar| (node, scalar)))
        .find(|(_, scalar)| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                // A clip- or strip-chomped block does not count a blank line
                // after it either way, so only a keep-chomped one can grow.
                && presentation.chomping == crate::Chomping::Keep
                && presentation.content_span.end <= hull.end
                && source
                    .get(presentation.content_span.end..hull.end)
                    .is_some_and(|between| between.trim().is_empty())
        })
        .map(|(node, _)| node.id)
} // End of function kept_block_the_move_would_extend()

/// The column of the first non-blank line at or after `at`.
///
/// `at` must begin a physical line, which every caller's offset does: a run
/// boundary, a hull end and an insertion point are all line starts or end of
/// file. `None` when nothing but blank lines follows.
fn first_non_blank_column_from(source: &str, at: usize, body_offset: usize) -> Option<usize> {
    let rest = source.get(at..)?;
    let mut cursor = at;
    for line in rest.split_inclusive(['\n', '\r']) {
        let body = line.trim_start_matches([' ', '\t']);
        if !body.trim_end().is_empty() {
            return Some(column_of(
                source,
                cursor + (line.len() - body.len()),
                body_offset,
            ));
        }
        cursor += line.len();
    } // End of the loop over the lines that follow `at`
    None
} // End of function first_non_blank_column_from()

/// The block scalar whose content ends directly above `at` and would swallow a
/// line written there at `column`.
///
/// The one statement of the hazard `EditError::RemovalWouldExtendABlockScalar`
/// and [`EditError::MoveWouldExtendABlockScalar`] both report, so the removal and
/// the move cannot drift apart about what "directly above" and "deep enough"
/// mean. Two facts:
///
/// 1. **adjacency.** The block's content ends at or before `at` with nothing but
///    blank lines in between, so once the edit's runs are gone the line in
///    question sits immediately under that content.
/// 2. **indentation.** [`absorbs_a_line_at`] compares `column` against the block's
///    own body column, which the span layer published and which is read here
///    rather than re-lexed (`PROGRESS.md`, D2 / D2d).
///
/// A block whose content lies inside the bytes being relocated cannot satisfy
/// fact 1 for any of the move's **external** seams, so no subtree filter is needed
/// there: the item's own bytes stand between such a block and every one of them. At
/// an **internal** seam the block is deliberately one of the item's own — that is the
/// shape the seam exists for — and the boundary is the end of the run before the
/// join, so the same two facts still decide it.
fn block_absorbing_a_line(
    source: &str,
    index: &SyntaxIndex,
    at: usize,
    column: usize,
) -> Option<NodeId> {
    index
        .nodes()
        .iter()
        .filter_map(|node| node.scalar.as_ref().map(|scalar| (node, scalar)))
        .find(|(_, scalar)| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                && presentation.content_span.end <= at
                && source
                    .get(presentation.content_span.end..at)
                    .is_some_and(|between| between.trim().is_empty())
                && absorbs_a_line_at(presentation, column)
        })
        .map(|(node, _)| node.id)
} // End of function block_absorbing_a_line()

/// Resolves a mapping and checks it is one a structural edit may change.
///
/// Four gates in a fixed order, and the hazard gate is asked **before** the
/// shape is examined so that nothing about a refused mapping is inspected:
///
/// 1. the path resolves;
/// 2. the node is a mapping;
/// 3. `TriviaIndex::disqualifying_hazard` says nothing about **the mapping**,
///    not merely about the entry. A structural edit changes the mapping's own
///    shape, so a merge key, a duplicate key or an anchor anywhere in it makes
///    the change unreasonable locally. This is strictly more pessimistic than a
///    scalar edit, deliberately;
/// 4. neither the mapping nor any ancestor is bracket-delimited.
fn editable_mapping<'index>(
    index: &'index SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    path: &DocumentPath,
) -> Result<(&'index Node, Vec<Entry>), EditError> {
    let id = resolve(index, path).map_err(|error| EditError::Unresolvable {
        edit: position,
        error,
    })?;
    let mapping = index.node(id).ok_or(EditError::MalformedSpan {
        edit: position,
        at: ByteSpan::default(),
    })?;
    if mapping.kind != NodeKind::Mapping {
        return Err(EditError::NotAMapping {
            edit: position,
            node: id,
            kind: mapping.kind,
        });
    }
    if let Some(hazard) = trivia.disqualifying_hazard(index, id) {
        return Err(EditError::Refused {
            edit: position,
            node: id,
            hazard: hazard.kind,
            at: hazard.span,
        });
    }
    if mapping.collection_style == Some(CollectionStyle::Flow)
        || is_inside_a_flow_collection(index, mapping)
    {
        return Err(EditError::FlowCollection {
            edit: position,
            node: id,
        });
    }
    Ok((mapping, mapping_entries(mapping)))
} // End of function editable_mapping()

/// A mapping's entries, taken from the flat key/value child list.
fn mapping_entries(mapping: &Node) -> Vec<Entry> {
    mapping
        .children
        .chunks(2)
        .filter_map(|pair| match (pair.first(), pair.get(1)) {
            (Some(&key), Some(&value)) => Some(Entry { key, value }),
            _ => None,
        })
        .collect()
} // End of function mapping_entries()

/// The column every key of the mapping sits at.
///
/// An inserted entry's indentation comes from here and from nowhere else. A
/// mapping whose keys disagree is refused, because there is then no column the
/// document itself endorses and a default would be this crate deciding how the
/// user's file should look.
fn entry_column(
    source: &str,
    index: &SyntaxIndex,
    position: usize,
    mapping: &Node,
    entries: &[Entry],
) -> Result<usize, EditError> {
    let body_offset = index.preamble().body_offset;
    let mut columns = entries.iter().filter_map(|entry| {
        index
            .node(entry.key)
            .map(|key| column_of(source, key.span.start, body_offset))
    });
    let expected = columns.next().ok_or(EditError::NoSuchSibling {
        edit: position,
        mapping: mapping.id,
    })?;
    for found in columns {
        if found != expected {
            return Err(EditError::InconsistentEntryIndentation {
                edit: position,
                mapping: mapping.id,
                expected,
                found,
            });
        }
    } // End of the loop over the mapping's key columns
    Ok(expected)
} // End of function entry_column()

/// The bytes one mapping entry occupies: its key, its `:`, its value, and every
/// trivia item either subtree owns.
///
/// Built from `TriviaIndex::subtree_extent` on **both** halves of the entry.
/// The direct-ownership queries are deliberately not used: trivia is attributed
/// to the deepest node a rule can name, so the entry's inline comment belongs to
/// its *value scalar* and its colon to its *key*, and an envelope built from
/// either node alone leaves the other's trivia behind (`PROGRESS.md`, D2d).
fn entry_extent(index: &SyntaxIndex, trivia: &TriviaIndex, key: NodeId, value: NodeId) -> ByteSpan {
    let key_extent = trivia.subtree_extent(index, key);
    let value_extent = trivia.subtree_extent(index, value);
    ByteSpan::new(
        key_extent.start.min(value_extent.start),
        key_extent.end.max(value_extent.end),
    )
} // End of function entry_extent()

/// Widens an entry's extent to the whole lines a removal deletes.
///
/// Backwards to the start of the entry's first line, which must hold nothing but
/// indentation, and forwards past the break that terminates its last. Anything
/// else on either side means the entry shares a line with something that is not
/// part of it — the `-` of a compact `- key: value` item is the reachable case —
/// and the removal is refused rather than made to guess what happens to the
/// neighbour.
///
/// The BOM is never crossed: `body_offset` bounds the backwards walk, so
/// removing the first entry of a BOM-prefixed document cannot delete the BOM.
fn removal_span(
    source: &str,
    index: &SyntaxIndex,
    position: usize,
    extent: ByteSpan,
) -> Result<ByteSpan, EditError> {
    let body_offset = index.preamble().body_offset;
    let before = source.get(..extent.start).ok_or(EditError::MalformedSpan {
        edit: position,
        at: extent,
    })?;
    let line_start = before
        .rfind(['\n', '\r'])
        .map_or(body_offset, |offset| offset + 1)
        .max(body_offset);
    let head = source
        .get(line_start..extent.start)
        .ok_or(EditError::MalformedSpan {
            edit: position,
            at: extent,
        })?;
    if head
        .chars()
        .any(|character| character != ' ' && character != '\t')
    {
        return Err(EditError::EntryDoesNotOwnItsLines {
            edit: position,
            at: ByteSpan::new(line_start, extent.start),
        });
    }

    // A block scalar's content span already ends **past** the line break that
    // terminates its last body line (`PROGRESS.md`, D2c), so an entry whose
    // value is one already covers whole lines and there is no break left to
    // take. Skipping this check would walk into the next entry's indentation and
    // refuse a perfectly ordinary removal.
    if terminates_a_line(source, extent.end) {
        return Ok(ByteSpan::new(line_start, extent.end));
    }

    let bytes = source.as_bytes();
    let mut end = extent.end;
    while matches!(bytes.get(end), Some(b' ') | Some(b'\t')) {
        end += 1;
    }
    let tail = source.get(end..).ok_or(EditError::MalformedSpan {
        edit: position,
        at: extent,
    })?;
    if let Some(rest) = tail.strip_prefix("\r\n") {
        end += tail.len() - rest.len();
    } else if tail.starts_with('\n') || tail.starts_with('\r') {
        end += 1;
    } else if !tail.is_empty() {
        return Err(EditError::EntryDoesNotOwnItsLines {
            edit: position,
            at: ByteSpan::new(extent.end, end + tail.len().min(1)),
        });
    }
    Ok(ByteSpan::new(line_start, end))
} // End of function removal_span()

/// The bytes inside a removal's hull that must stay exactly where they are.
///
/// # Why the hull is not the envelope (`PROGRESS.md`, R21 / D2o)
///
/// `TriviaIndex::subtree_extent` is the smallest **contiguous** span covering
/// everything an entry's subtree owns. A comment the ownership rules give to the
/// *file* has no owning node, so it never widens that hull — but one lying
/// between two descendants is inside it anyway, and Phase 0c-3a deleted it. One
/// [`ByteSpan`] cannot say "delete the entry but keep that comment"; a set of
/// runs can, and this function is the half that decides where the holes go.
///
/// # What is preserved, and why exactly that
///
/// Two things, both read off the ownership layer rather than decided here:
///
/// - **the whole line each file-owned comment occupies**, indentation and
///   terminating break included, because the runs delete whole lines and half a
///   comment line is not a comment;
/// - **every blank run touching one of those lines.** A blank line is not
///   decoration here: rule 2 of plan section 6.2 reads the blank line *below* a
///   comment to give the comment to the file, so deleting that line would hand the
///   surviving comment to whatever ends up underneath — a re-attribution the edit
///   was never asked to make. `TriviaIndex::blank_runs` is the source of truth for
///   which lines those are, and it is a gap-only answer: a whitespace-only line
///   inside a block scalar's body is that scalar's content and is never a blank
///   run, so this can never preserve a fragment of a value.
///
/// # The blank-run rule, in both directions
///
/// **A blank run survives a removal exactly when it touches the line of a
/// file-owned comment the removal preserves. Every other blank run inside the hull
/// is deleted with the entry.** Both halves are pinned byte-exactly by
/// `a_blank_run_survives_only_where_it_touches_a_kept_comment`, and the Phase
/// 0c-3b-1 review's finding 1 is why they are written down rather than left
/// implicit.
///
/// The two halves rest on different arguments, and conflating them is the
/// overstatement that review found:
///
/// - **The run below a kept comment is ownership.** Delete it and rule 2 no longer
///   applies, so the comment stops being file-owned. This half is not a choice.
/// - **The run above a kept comment is adjacency, not ownership.** Deleting it
///   would leave the comment file-owned all the same. It survives because the unit
///   this function preserves is the neighbourhood `blank_runs()` groups with the
///   comment's line, and deciding *per side* which of the ownership layer's blank
///   runs "counts" is exactly the re-decision the gap layer is not allowed to make
///   (D2 / D2d). It is **not** claimed to be layout the user chose: that claim
///   would have to apply equally to a blank run touching no comment, and such a
///   run is deleted.
/// - **A blank run touching no kept comment is interior trivia of the entry the
///   user asked to remove.** It lies inside the requested span, and the premise
///   this crate defends is that every byte *outside* an intended span is
///   identical, not that bytes inside a deliberately removed entry survive.
///   Preserving it would also invent a leading blank line at document start where
///   the file had none, which is itself an infidelity.
///
/// The result is ordered, disjoint, non-empty and clamped to `hull`. The clamp is
/// defensive rather than load-bearing: a file-owned comment inside a hull is
/// always strictly interior, because the hull's first line holds the entry's key
/// (`removal_span` refuses otherwise) and its last line holds the entry's last
/// owned byte, and a comment sharing a line with either would be owned by the
/// node it trails (rule 3) rather than by the file.
fn preserved_regions(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    hull: ByteSpan,
) -> Vec<ByteSpan> {
    let body_offset = index.preamble().body_offset;
    let mut regions: Vec<ByteSpan> = Vec::new();
    for comment in trivia.file_comments() {
        if !comment.span.intersects(hull) {
            continue;
        }
        let mut start = line_start_of(source, comment.span.start, body_offset);
        let mut end = line_end_of(source, comment.span.end);
        for run in trivia.blank_runs() {
            if run.span.end == start {
                start = run.span.start.max(body_offset);
            }
            if run.span.start == end {
                end = run.span.end;
            }
        } // End of the loop that grows the region over the blank runs beside it
        let start = start.max(hull.start).min(hull.end);
        let end = end.min(hull.end).max(start);
        regions.push(ByteSpan::new(start, end));
    } // End of the loop over the comments the file owns

    regions.sort_by_key(|region| (region.start, region.end));
    let mut merged: Vec<ByteSpan> = Vec::new();
    for region in regions {
        if region.is_empty() {
            continue;
        }
        match merged.last_mut() {
            Some(last) if region.start <= last.end => last.end = last.end.max(region.end),
            _ => merged.push(region),
        }
    } // End of the loop that merges the regions into a disjoint, ordered set
    merged
} // End of function preserved_regions()

/// The ordered, disjoint runs of `hull` that `preserved` does not cover.
///
/// The set-difference half of the envelope. `preserved` must be ordered,
/// disjoint and inside `hull`, which [`preserved_regions`] guarantees. Every run
/// returned is non-empty, and the runs appear in ascending order, which is the
/// order [`apply_edits`] needs before it checks disjointness and splices from the
/// highest offset downwards.
fn runs_between(hull: ByteSpan, preserved: &[ByteSpan]) -> Vec<ByteSpan> {
    let mut runs = Vec::new();
    let mut cursor = hull.start;
    for region in preserved {
        if region.end <= cursor {
            continue;
        }
        if region.start > cursor {
            runs.push(ByteSpan::new(cursor, region.start));
        }
        cursor = region.end;
    } // End of the loop that emits the gap before each preserved region
    if cursor < hull.end {
        runs.push(ByteSpan::new(cursor, hull.end));
    }
    runs
} // End of function runs_between()

/// Start of the physical line holding `at`, never crossing the preamble.
fn line_start_of(source: &str, at: usize, body_offset: usize) -> usize {
    source
        .get(..at)
        .and_then(|before| before.rfind(['\n', '\r']))
        .map_or(body_offset, |offset| offset + 1)
        .max(body_offset)
}

/// End of the physical line holding `at`, its terminating break included.
fn line_end_of(source: &str, at: usize) -> usize {
    let Some(rest) = source.get(at..) else {
        return source.len();
    };
    match rest.find(['\n', '\r']) {
        None => source.len(),
        Some(offset) => {
            let at = at + offset;
            at + if source[at..].starts_with("\r\n") {
                2
            } else {
                1
            }
        }
    }
} // End of function line_end_of()

/// The block scalar the bytes a removal **preserves** would join, if there is one.
///
/// Consulted only when a removal has bytes to preserve, and the reason
/// [`EditError::RemovalWouldExtendABlockScalar`] exists: a comment line left in
/// place directly under a block scalar's content, at or past that block's own
/// body column, is content of the block rather than a comment, so the block's
/// decoded value changes although nothing about it was edited.
///
/// Two facts have to hold together, and the second is the Phase 0c-3b-1 review's
/// finding 2:
///
/// 1. **adjacency.** The block's content ends at or before `at` — the envelope's
///    first run, so every byte between the two is about to be deleted — with
///    nothing but blank lines in between. This is the same shape
///    [`kept_block_the_removal_would_extend`] tests.
/// 2. **indentation.** The first non-blank line the removal preserves sits at the
///    block's body column **or deeper**, so YAML would read it as one more body
///    line. A preserved line shallower than that column *ends* the block, exactly
///    as the sibling key on the next line already did, so the block's value is
///    untouched and the removal is legal. Without this half the refusal was
///    over-broad: it turned down the reviewer's `>` block with a column-zero
///    comment below it, which cannot become block content at all.
///
/// The body column is [`ScalarPresentation::indent`], which the span layer already
/// published — the substrate's own start-marker column, which for a block scalar
/// is the content-indentation column exactly. It is **read rather than
/// re-derived**: the gap layer never re-decides what the span layer decided
/// (`PROGRESS.md`, D2 / D2d), and re-lexing the block's body here would be a
/// second answer to a question that already has one.
///
/// [`absorbs_a_line_at`] carries the one case where the span layer observed no
/// body column at all, and refuses conservatively there.
fn block_scalar_the_kept_bytes_would_join(
    source: &str,
    index: &SyntaxIndex,
    preserved: &[ByteSpan],
    at: usize,
) -> Option<NodeId> {
    let body_offset = index.preamble().body_offset;
    // Nothing non-blank to place means nothing can be absorbed. Unreachable from
    // `preserved_regions`, whose every region exists for a comment line.
    let column = first_kept_column(source, preserved, body_offset)?;
    // The two facts are stated once, in `block_absorbing_a_line`, which the move's
    // move's seams ask as well: one document fact, one implementation of it.
    block_absorbing_a_line(source, index, at, column)
} // End of function block_scalar_the_kept_bytes_would_join()

/// Whether a line at `column` would become part of this block scalar's body.
///
/// YAML ends a block scalar at the first non-empty line shallower than its
/// content-indentation column, so a line at that column or deeper is absorbed and
/// a shallower one is not.
///
/// **An empty content span is refused whatever the column is.** A block whose
/// content span is empty — `replace: |` with the next sibling directly under it,
/// the R5 shape a desktop editor sees on every keystroke — never had a body line,
/// so [`ScalarPresentation::indent`] holds the column of the *header* rather than
/// of any observed body, and comparing against it would be comparing against a
/// number that means something else. Where the span layer observed no column, the
/// conservative answer is the only honest one.
fn absorbs_a_line_at(presentation: &ScalarPresentation, column: usize) -> bool {
    presentation.content_span.is_empty() || column >= presentation.indent
} // End of function absorbs_a_line_at()

/// The column of the first non-blank line among a set of regions that survive an
/// edit.
///
/// Two callers, and "kept" means the same thing to both: the bytes that are still
/// in the document afterwards. For a **removal** the regions are
/// [`preserved_regions`]'s answer, the lines left where they are; for a **move**
/// they are the envelope's own runs, the lines carried to the destination. Either
/// way they are ordered, disjoint and made of whole lines, and the first non-blank
/// line among them is the one that ends up directly under whatever precedes them —
/// which is why one column answers the question for the whole set: a line
/// shallower than a block's body column ends that block, and nothing after it can
/// rejoin one.
///
/// `None` when every byte in the set is blank. `preserved_regions` cannot produce
/// that, because a region exists only for a comment line, and neither can a
/// removal envelope, because an entry has a key.
fn first_kept_column(source: &str, preserved: &[ByteSpan], body_offset: usize) -> Option<usize> {
    for region in preserved {
        let Some(text) = region.slice(source) else {
            continue;
        };
        let mut at = region.start;
        for line in text.split_inclusive(['\n', '\r']) {
            let body = line.trim_start_matches([' ', '\t']);
            if !body.trim_end().is_empty() {
                return Some(column_of(
                    source,
                    at + (line.len() - body.len()),
                    body_offset,
                ));
            }
            at += line.len();
        } // End of the loop over this region's lines
    } // End of the loop over the preserved regions, in ascending order
    None
} // End of function first_kept_column()

/// The line ending of the last break at or before `at`, or `None`.
///
/// **The document's own evidence, taken as locally as possible.** For an
/// insertion whose anchor line is terminated, `at` sits immediately after that
/// terminator, so the answer is the anchor's *own* break. For an insertion at
/// end of file the anchor has no terminator, and the answer is the last break
/// before it — a nearby sibling's, which is the closest thing the document says
/// about how its lines end.
///
/// `None` has two causes and one meaning:
///
/// - the document holds **no break at all** — a single-line file with no final
///   newline, which `LineEnding::detect` answers by defaulting to LF;
/// - the last break is a **bare carriage return**, which [`LineEnding`] cannot
///   express, so copying it is not something this function can offer.
///
/// Either way the caller must refuse ([`EditError::NoObservableLineEnding`])
/// rather than pick one: inventing a line ending is exactly the unrequested
/// reformatting this crate exists to prevent.
fn line_ending_before(source: &str, at: usize) -> Option<LineEnding> {
    let before = source.get(..at)?;
    let last = before.rfind(['\n', '\r'])?;
    if !before[last..].starts_with('\n') {
        // A `\r` that is the last break character in `before` is not followed by
        // a `\n`, or that `\n` would have been found instead: a bare CR.
        return None;
    }
    if before[..last].ends_with('\r') {
        Some(LineEnding::Crlf)
    } else {
        Some(LineEnding::Lf)
    }
} // End of function line_ending_before()

/// The line ending of the first break at or after `at`, or `None`.
///
/// The forward counterpart of [`line_ending_before`], and the two answer
/// different questions because the two callers stand in different places. An
/// **insertion point** sits immediately after a terminator, so its evidence is
/// behind it. A **scalar** sits before the terminator of its own line, so its
/// evidence is ahead of it: in `a: 1\nb: 2\r\n` the break in force for `b`'s
/// value is the `\r\n` that follows it, and the `\n` behind it belongs to `a`.
/// Looking the wrong way is how a multi-line value on a CRLF line came out with
/// an LF-bodied block.
///
/// `None` when nothing follows, or when the next break is a bare carriage
/// return, which [`LineEnding`] cannot express.
fn line_ending_after(source: &str, at: usize) -> Option<LineEnding> {
    let after = source.get(at..)?;
    let next = after.find(['\n', '\r'])?;
    if after[next..].starts_with("\r\n") || after[next..].starts_with('\n') {
        Some(if after[next..].starts_with('\r') {
            LineEnding::Crlf
        } else {
            LineEnding::Lf
        })
    } else {
        None
    }
} // End of function line_ending_after()

/// The first file-owned comment the span would delete, if there is one.
///
/// Asked of every **run** of a removal envelope, after [`preserved_regions`] has
/// punched the file's comments out of the hull. It is therefore an assertion on
/// the derived run set rather than the policy it was in Phase 0c-3a: it reads
/// `TriviaIndex::file_comments`, which is the document's own ownership answer,
/// and knows nothing about the arithmetic that produced the runs. Deleting a
/// file-owned comment is byte loss the rest of verification cannot see, because
/// digests compare decoded nodes and a decoded node has no comments.
///
/// Intersection is tested rather than containment: a run that clips even one byte
/// off a comment has changed it.
fn file_comment_inside(trivia: &TriviaIndex, span: ByteSpan) -> Option<ByteSpan> {
    trivia
        .file_comments()
        .map(|comment| comment.span)
        .find(|comment| comment.intersects(span))
} // End of function file_comment_inside()

/// Whether `offset` sits immediately after a line break.
///
/// True exactly when everything before `offset` already forms whole lines, which
/// is the case for an entry whose value is a `|` or `>` block: D2c puts the end
/// of a block scalar's content span past its final break.
fn terminates_a_line(source: &str, offset: usize) -> bool {
    offset > 0
        && source
            .get(..offset)
            .is_some_and(|before| before.ends_with(['\n', '\r']))
}

/// The keep-chomped block scalar a removal would lengthen, if there is one.
///
/// A `|+` block's value runs to the next line that is not blank, so the bytes
/// that end it belong to whatever comes next rather than to the block. Deleting
/// the lines that terminate one hands it the blank lines below, and the block's
/// **decoded value** changes although nothing about it was edited.
///
/// The condition is stated exactly rather than conservatively, so that the
/// refusal costs only the shape it has to:
///
/// 1. a block scalar with [`crate::Chomping::Keep`] whose content ends at or
///    before the removal;
/// 2. nothing but blank lines between that content end and the removal, so the
///    removal really is what terminates the block's run;
/// 3. a blank line immediately **after** the removal, which is what would move
///    up into the value. End of file does not qualify: a block's run is bounded
///    by the end of the document either way.
fn kept_block_the_removal_would_extend(
    source: &str,
    index: &SyntaxIndex,
    span: ByteSpan,
) -> Option<NodeId> {
    let after = source.get(span.end..)?;
    if after.is_empty() {
        return None;
    }
    let next_line = after
        .find(['\n', '\r'])
        .map_or(after.len(), |offset| offset);
    if !after[..next_line]
        .chars()
        .all(|character| character == ' ' || character == '\t')
    {
        return None;
    }

    index
        .nodes()
        .iter()
        .filter_map(|node| node.scalar.as_ref().map(|scalar| (node, scalar)))
        .find(|(_, scalar)| {
            let presentation = &scalar.presentation;
            presentation.style.is_block()
                && presentation.chomping == crate::Chomping::Keep
                && presentation.content_span.end <= span.start
                && source
                    .get(presentation.content_span.end..span.start)
                    .is_some_and(|between| between.trim().is_empty())
        })
        .map(|(node, _)| node.id)
} // End of function kept_block_the_removal_would_extend()

/// Where a new entry is spliced in, and whether that place is end of file.
///
/// From the anchor entry's ownership extent, past any trailing spaces, to just
/// after the break that terminates its line. When there is no such break the
/// anchor ends the file, and the caller writes the break in front of the new
/// entry instead of behind it, so a file with no final newline keeps not having
/// one.
fn insertion_point(
    source: &str,
    anchor: ByteSpan,
    position: usize,
) -> Result<(usize, bool), EditError> {
    // As in `removal_span`: an entry whose value is a block scalar already ends
    // past its own final line break, so the new entry starts exactly there.
    if terminates_a_line(source, anchor.end) {
        return Ok((anchor.end, false));
    }

    let bytes = source.as_bytes();
    let mut cursor = anchor.end;
    while matches!(bytes.get(cursor), Some(b' ') | Some(b'\t')) {
        cursor += 1;
    }
    let tail = source.get(cursor..).ok_or(EditError::MalformedSpan {
        edit: position,
        at: anchor,
    })?;
    if let Some(rest) = tail.strip_prefix("\r\n") {
        return Ok((cursor + (tail.len() - rest.len()), false));
    }
    if tail.starts_with('\n') || tail.starts_with('\r') {
        return Ok((cursor + 1, false));
    }
    if tail.is_empty() {
        return Ok((cursor, true));
    }
    Err(EditError::EntryDoesNotOwnItsLines {
        edit: position,
        at: ByteSpan::new(anchor.end, cursor + 1),
    })
} // End of function insertion_point()

/// Records one structural edit's claim about the mapping it changes.
///
/// `omit` is the value node of an entry being removed; `inserted` is the key and
/// value an insertion must produce. The siblings this becomes carry a
/// **structural digest** of each entry's whole value subtree, so "every entry
/// the edit did not name still decodes to what it decoded to before" covers
/// nested collections and not merely scalars.
fn pending_field(
    position: usize,
    mapping_path: DocumentPath,
    mapping: &Node,
    entries: &[Entry],
    omit: Option<NodeId>,
    inserted: Option<(String, String)>,
) -> PendingField {
    PendingField {
        edit: position,
        mapping: mapping_path,
        mapping_id: mapping.id,
        entries: entries.to_vec(),
        removed: omit,
        inserted,
    }
} // End of function pending_field()

/// A canonical rendering of everything a node's subtree decodes to.
///
/// Kinds and lengths are written into the string as well as values, so two
/// different shapes cannot produce the same digest: `{a: "1"}` and `[a, 1]` do
/// not collide. Never printed — it holds decoded values, and the real corpus is
/// private (`CLAUDE.md` section 1) — only compared.
fn digest(index: &SyntaxIndex, node: NodeId) -> String {
    let mut out = String::new();
    write_digest(index, node, &mut out);
    out
}

/// Appends `node`'s digest to `out`.
fn write_digest(index: &SyntaxIndex, node: NodeId, out: &mut String) {
    let Some(current) = index.node(node) else {
        out.push('?');
        return;
    };
    match current.kind {
        NodeKind::Scalar => match current.scalar.as_ref() {
            Some(scalar) => {
                out.push_str(&format!("s{}:", scalar.value.len()));
                out.push_str(&scalar.value);
            }
            None => out.push('?'),
        },
        NodeKind::Alias => out.push_str(&format!("*{}", current.span.len())),
        NodeKind::Mapping | NodeKind::Sequence => {
            out.push(if current.kind == NodeKind::Mapping {
                '{'
            } else {
                '['
            });
            for child in &current.children {
                write_digest(index, *child, out);
                out.push(',');
            } // End of the loop over the node's children
            out.push(if current.kind == NodeKind::Mapping {
                '}'
            } else {
                ']'
            });
        }
        NodeKind::Document => out.push('@'),
    }
} // End of function write_digest()

/// The decoded value of a scalar node, or `None` when it is not a scalar.
fn decoded_value(index: &SyntaxIndex, node: NodeId) -> Option<&str> {
    let node = index.node(node)?;
    if node.kind != NodeKind::Scalar {
        return None;
    }
    Some(node.scalar.as_ref()?.value.as_str())
}

/// The path of the mapping that holds the entry `path` names.
///
/// `None` when the path names no mapping entry — a root path, or one whose last
/// step is a sequence index.
fn parent_path(path: &DocumentPath) -> Option<DocumentPath> {
    let segments = path.segments();
    if !matches!(segments.last(), Some(PathSegment::Key(_))) {
        return None;
    }
    Some(DocumentPath::new(
        path.document_index(),
        segments[..segments.len() - 1].to_vec(),
    ))
} // End of function parent_path()

/// The path of the **sequence** that holds the item `path` names.
///
/// The move's counterpart of [`parent_path`], and separate from it because the
/// two accept opposite last segments: an entry's path ends in a key and an item's
/// in an index. `None` when the path does not end in an index, which is a path
/// that names no sequence item.
fn containing_path(path: &DocumentPath) -> Option<DocumentPath> {
    let segments = path.segments();
    if !matches!(segments.last(), Some(PathSegment::Index(_))) {
        return None;
    }
    Some(DocumentPath::new(
        path.document_index(),
        segments[..segments.len() - 1].to_vec(),
    ))
} // End of function containing_path()

/// Chooses how the new value is spelled, and the context it is spelled for.
///
/// The first pass is simply [`preserve_scalar`] in the scalar's own context.
/// The second exists for exactly one shape, and it is a **re-render rather than
/// a refusal**: a scalar that is not already a block, whose new value the
/// emitter wants to write as a block, sitting on a line whose tail is not free.
/// A block scalar owns every line below its header, so `a: old # why` cannot
/// become
///
/// ```text
/// a: |    # why
///   one
/// ```
///
/// — the comment would land inside the body. The lossless answer is not to
/// refuse the edit but to spell the same value in **flow** context, where the
/// emitter never writes a block and never writes a plain scalar either:
/// `a: "one\ntwo\n" # why` holds the value on one physical line and leaves the
/// comment exactly where the user put it. `PresentationNote` reports the style
/// change, so nothing about it is silent.
///
/// This is why there is no `LineNotFreeForBlockScalar` error: after this
/// function a block plan implies a free line, by construction.
fn choose_plan(
    source: &str,
    index: &SyntaxIndex,
    node: &Node,
    presentation: &ScalarPresentation,
    value: &str,
) -> (ScalarPlan, ScalarContext) {
    let context = scalar_context(source, index, node, presentation);
    let plan = preserve_scalar(value, presentation, context);
    let wants_a_new_block =
        matches!(plan, ScalarPlan::Literal(_)) && !presentation.style.is_block();
    if wants_a_new_block && occupied_line_tail(source, node.span.end).is_some() {
        let column = column_of(source, node.span.start, index.preamble().body_offset);
        let flow = ScalarContext::flow(column, context.line_ending);
        return (preserve_scalar(value, presentation, flow), flow);
    }
    (plan, context)
} // End of function choose_plan()

/// The exact spans an edit to `node` is allowed to rewrite.
///
/// Read off the syntax index and **never** derived from the presentation the
/// planner chose, because this is what the planner is measured against
/// ([`VerificationFailure::SpanNotPermitted`]). A synthesized envelope cannot
/// authorise itself here.
///
/// A block scalar owns **two** spans, its header and its content, and the bytes
/// between them belong to neither: per `PROGRESS.md` D2c the content span begins
/// immediately after the line break that terminates the header line, so the gap
/// holds the header's tail — trailing spaces, an inline comment — and the line
/// break itself. Replacing across that gap is how a CRLF header silently
/// becomes LF and how a header comment silently disappears. A flow scalar owns
/// its token, delimiters included, and nothing else.
fn permitted_spans(node: &Node, presentation: &ScalarPresentation) -> Vec<ByteSpan> {
    if presentation.style.is_block() {
        vec![presentation.header_span, presentation.content_span]
    } else {
        vec![node.span]
    }
} // End of function permitted_spans()

/// Describes the presentation change an edit makes, when there is one.
///
/// Two things are worth reporting: the style changed, or the old presentation
/// could not have been reproduced byte for byte even without an edit — a `>`
/// block, an escaped double-quoted scalar. Both mean bytes inside the scalar
/// move for reasons the user did not ask for, and plan section 6.2 requires
/// that to be visible rather than silent.
fn presentation_note(
    source: &str,
    position: usize,
    presentation: &ScalarPresentation,
    plan: &ScalarPlan,
) -> Option<PresentationNote> {
    let reason = reencode_in_place(source, presentation).err();
    if plan.style() == presentation.style && reason.is_none() {
        return None;
    }
    Some(PresentationNote {
        edit: position,
        from: presentation.style,
        to: plan.style(),
        reason,
    })
} // End of function presentation_note()

// ---------------------------------------------------------------------------
// Rendering: which spans an edit replaces, and with what
// ---------------------------------------------------------------------------

/// The spans one scalar edit replaces, and the bytes for each.
///
/// A **block scalar is always replaced as two separate spans**, its header and
/// its content, whichever style the new value takes. That is the whole fix the
/// Phase 0c-2b review forced: the bytes between the two spans — the header
/// line's trailing spaces, an inline comment on it, and the line break that ends
/// it (`PROGRESS.md`, D2c) — belong to neither span, and one combined envelope
/// swallowed them. `k: |\r\n  body\n` edited to `""` regenerated the header's
/// CRLF from the body's line ending and turned a CRLF document into a mixed one;
/// `k: |   \n  body\n` lost three spaces the user had typed.
///
/// A **flow scalar** is one replacement over its token, delimiters included: a
/// token holds nothing but its own bytes, so there is no trivia inside it to
/// lose.
fn render_replacements(
    source: &str,
    position: usize,
    node: &Node,
    presentation: &ScalarPresentation,
    plan: &ScalarPlan,
    context: ScalarContext,
) -> Result<Vec<Replacement>, EditError> {
    if presentation.style.is_block() {
        return block_replacements(source, position, presentation, plan);
    }
    let existing = node.span.slice(source).ok_or(EditError::MalformedSpan {
        edit: position,
        at: node.span,
    })?;
    // A block plan here means `choose_plan` already found the rest of the line
    // free; an occupied line is re-rendered in flow context, never refused.
    let breaks = breaks_to_emit(
        position,
        plan,
        trailing_break_count(existing),
        leading_break_count(source, node.span.end),
        node.span.end == source.len(),
    )?;
    Ok(vec![Replacement {
        span: node.span,
        text: token(plan, breaks, context.line_ending),
    }])
} // End of function render_replacements()

/// The two replacements that rewrite a scalar which **is** a block scalar.
///
/// Staying a block means a new header and a new body. Becoming a flow scalar
/// means the header span carries the whole flow token and the content span is
/// deleted — and because the header line's own break is *between* the two spans,
/// it terminates the new token's line exactly as it terminated the header's,
/// byte for byte, with whatever the user had written after the indicator still
/// on it.
fn block_replacements(
    source: &str,
    position: usize,
    presentation: &ScalarPresentation,
    plan: &ScalarPlan,
) -> Result<Vec<Replacement>, EditError> {
    let content = presentation
        .content_span
        .slice(source)
        .ok_or(EditError::MalformedSpan {
            edit: position,
            at: presentation.content_span,
        })?;

    let ScalarPlan::Literal(block) = plan else {
        // Block to flow. No break is emitted at all: the header line's own one
        // is not ours to rewrite, and the breaks inside the content span were
        // the old value's bytes, which this edit replaces.
        let mut replacements = vec![Replacement {
            span: presentation.header_span,
            text: plan.render(),
        }];
        if !presentation.content_span.is_empty() {
            replacements.push(Replacement {
                span: presentation.content_span,
                text: String::new(),
            });
        }
        return Ok(replacements);
    };

    let breaks = breaks_to_emit(
        position,
        plan,
        trailing_break_count(content),
        leading_break_count(source, presentation.content_span.end),
        presentation.content_span.end == source.len(),
    )?;
    // The block's own line ending rather than the context's: they agree by
    // construction today, and depending on that agreement is how a body's `\n`
    // would silently become `\r\n` if they ever stopped agreeing.
    Ok(vec![
        Replacement {
            span: presentation.header_span,
            text: plan.render_header(),
        },
        Replacement {
            span: presentation.content_span,
            text: block_body(plan, breaks, block.line_ending),
        },
    ])
} // End of function block_replacements()

/// How many trailing line breaks the replacement text must carry.
///
/// # Why this is not simply "whatever the value has"
///
/// A block scalar's trailing line breaks are shared property: the chomping
/// indicator decides how many of the breaks *physically present* after the last
/// content line belong to the value, and the rest are blank-line trivia the
/// edit must leave alone. So the count to emit depends on three things — the
/// chomping the new value needs, how many breaks the replaced region held, and
/// how many breaks already sit immediately after it.
///
/// The default is **preserve the layout**: emit exactly as many breaks as the
/// replaced region held, so the document's line structure is unchanged and only
/// the header's chomping indicator reinterprets it. Two adjustments:
///
/// - clip and strip both need the last content line *terminated*. When neither
///   the region nor the source after it holds a break, one is written — except
///   at end of file, where a strip block legitimately ends a file that has no
///   final newline.
/// - keep chomping counts **every** physical break, so the number is exact:
///   emit `wanted - following`, and refuse when the document already holds more
///   breaks than the value wants
///   ([`EditError::TrailingNewlinesNotRepresentable`]).
///
/// A flow style has no chomping and no body, so it simply preserves the layout;
/// the breaks are written after the token.
fn breaks_to_emit(
    position: usize,
    plan: &ScalarPlan,
    layout: usize,
    following: usize,
    at_end_of_source: bool,
) -> Result<usize, EditError> {
    let ScalarPlan::Literal(block) = plan else {
        return Ok(layout);
    };
    let wanted = trailing_line_feeds(&block.value);
    match block.chomping {
        crate::Chomping::Keep => {
            wanted
                .checked_sub(following)
                .ok_or(EditError::TrailingNewlinesNotRepresentable {
                    edit: position,
                    wanted,
                    following,
                })
        }
        crate::Chomping::Strip => Ok(match (layout + following, at_end_of_source) {
            (0, true) => 0,
            (0, false) => 1,
            _ => layout,
        }),
        crate::Chomping::Clip => Ok(if layout + following == 0 { 1 } else { layout }),
    }
} // End of function breaks_to_emit()

/// A literal block's body, re-terminated with exactly `breaks` line breaks.
///
/// [`ScalarPlan::render_content`] ends with as many breaks as the *value* has;
/// this replaces that run with the count [`breaks_to_emit`] chose, because the
/// bytes after the replaced span contribute breaks of their own.
fn block_body(plan: &ScalarPlan, breaks: usize, line_ending: LineEnding) -> String {
    let rendered = plan.render_content();
    let mut body = trim_trailing_breaks(&rendered).to_owned();
    for _ in 0..breaks {
        body.push_str(line_ending.as_str());
    }
    body
} // End of function block_body()

/// A whole scalar token, re-terminated with exactly `breaks` line breaks.
///
/// For a literal block that is the header, one break, then the body; for a flow
/// style the token itself. The trailing breaks always go last, where the
/// replaced region's own trailing breaks were.
fn token(plan: &ScalarPlan, breaks: usize, line_ending: LineEnding) -> String {
    match plan {
        ScalarPlan::Literal(block) => {
            let mut out = plan.render_header();
            out.push_str(block.line_ending.as_str());
            out.push_str(&block_body(plan, breaks, block.line_ending));
            out
        }
        _ => {
            let mut out = plan.render();
            for _ in 0..breaks {
                out.push_str(line_ending.as_str());
            }
            out
        }
    }
} // End of function token()

/// The bytes standing between `at` and the end of its line, or `None` when only
/// spaces and tabs do.
///
/// What a block scalar needs: everything below its header line belongs to it,
/// so a comment or another token on the header line would be swallowed into the
/// body.
fn occupied_line_tail(source: &str, at: usize) -> Option<ByteSpan> {
    let rest = source.get(at..)?;
    let end = rest.find(['\n', '\r']).unwrap_or(rest.len());
    let line = &rest[..end];
    let content = line.trim_start_matches([' ', '\t']);
    if content.is_empty() {
        return None;
    }
    let start = at + (line.len() - content.len());
    Some(ByteSpan::new(start, at + end))
} // End of function occupied_line_tail()

// ---------------------------------------------------------------------------
// Context: where the replacement scalar is being written
// ---------------------------------------------------------------------------

/// Builds the [`ScalarContext`] a replacement value is rendered in.
///
/// Four facts, and each one changes the bytes:
///
/// - **flow or block.** Flow when any enclosing collection is bracketed. This
///   is the R17 decision: the emitter then refuses to write a block *or* a
///   plain scalar, so a multi-line value inside `{…}` becomes a double-quoted
///   one-liner rather than illegal YAML.
/// - **the parent's column**, because YAML's indentation indicator is relative
///   to the enclosing node, not to the left margin.
/// - **the block body's column**, kept from the scalar's own presentation when
///   it already is a block, so an edit moves no line sideways.
/// - **the line ending**, taken from the most local evidence there is and never
///   from a majority vote. In order: the block's *own* body when its breaks are
///   consistent, then the break that **terminates the scalar's own line**, then
///   the last break before it (for a scalar on an unterminated final line), and
///   only when the document offers none of those, the preamble's answer. A file
///   may legitimately mix endings, and rewriting a body's `\n` as `\r\n` because
///   the rest of the file uses CRLF would change bytes for no reason.
///
/// The middle step is the Phase 0c-3a review's finding 2 applied to the scalar
/// path. The review demonstrated it on [`plan_insertion`], but the root cause —
/// `LineEnding::detect`'s document-wide vote — was shared: rendering a
/// multi-line value on a CRLF-terminated line in an LF-dominant document used to
/// write an LF-bodied block, producing a scalar with mixed breaks that
/// `reencode_in_place` itself calls unrepresentable
/// ([`crate::emit::NotReencodable::MixedLineBreaks`]).
///
/// The role is always [`crate::emit::ScalarRole::Value`]: a scalar edit never
/// targets a key (`PROGRESS.md`, R18).
fn scalar_context(
    source: &str,
    index: &SyntaxIndex,
    node: &Node,
    presentation: &ScalarPresentation,
) -> ScalarContext {
    let body_offset = index.preamble().body_offset;
    let document_ending = index.preamble().line_ending;
    let line_ending = presentation
        .content_span
        .slice(source)
        .filter(|_| presentation.style.is_block())
        .and_then(consistent_line_ending)
        .or_else(|| line_ending_after(source, node.span.end))
        .or_else(|| line_ending_before(source, node.span.start))
        .unwrap_or(document_ending);

    if is_inside_a_flow_collection(index, node) {
        return ScalarContext::flow(column_of(source, node.span.start, body_offset), line_ending);
    }

    let parent_indent = node
        .parent
        .and_then(|parent| index.node(parent))
        .map_or(0, |parent| {
            column_of(source, parent.span.start, body_offset)
        });
    let context = ScalarContext::block(parent_indent, line_ending);
    if presentation.style.is_block() && presentation.indent > parent_indent {
        return context.with_indent(presentation.indent);
    }
    context
} // End of function scalar_context()

/// Returns `true` when any enclosing collection of `node` is bracket-delimited.
///
/// YAML forbids a block collection inside a flow one, so in practice the
/// immediate parent decides; the walk is written over every ancestor anyway,
/// because "no block collection nests inside a flow collection" is the
/// substrate's promise rather than ours.
fn is_inside_a_flow_collection(index: &SyntaxIndex, node: &Node) -> bool {
    let mut current = node.parent.and_then(|parent| index.node(parent));
    while let Some(ancestor) = current {
        if ancestor.collection_style == Some(CollectionStyle::Flow) {
            return true;
        }
        current = ancestor.parent.and_then(|parent| index.node(parent));
    }
    false
} // End of function is_inside_a_flow_collection()

/// The single line ending `text` uses, or `None` when it uses both or neither.
fn consistent_line_ending(text: &str) -> Option<LineEnding> {
    let crlf = text.matches("\r\n").count();
    let lf = text.matches('\n').count() - crlf;
    match (crlf, lf) {
        (0, 0) => None,
        (0, _) => Some(LineEnding::Lf),
        (_, 0) => Some(LineEnding::Crlf),
        _ => None,
    }
}

/// The column `offset` sits at, counted in characters from the start of its
/// line.
///
/// `body_offset` is the width of the document's BOM, which the substrate never
/// saw: counting it would report the first line of a BOM-prefixed file as
/// starting at column 1, and every indentation indicator derived from that
/// would be one column out.
fn column_of(source: &str, offset: usize, body_offset: usize) -> usize {
    let Some(before) = source.get(..offset) else {
        return 0;
    };
    let line_start = before
        .rfind(['\n', '\r'])
        .map_or(body_offset, |index| index + 1)
        .max(body_offset)
        .min(offset);
    source
        .get(line_start..offset)
        .map_or(0, |text| text.chars().count())
} // End of function column_of()

// ---------------------------------------------------------------------------
// Line-break arithmetic
// ---------------------------------------------------------------------------

/// How many line breaks the run at the start of `source[at..]` holds.
///
/// `\r\n` counts once: it is one break, and treating it as two would make every
/// chomping decision on a CRLF document wrong.
fn leading_break_count(source: &str, at: usize) -> usize {
    let Some(rest) = source.get(at..) else {
        return 0;
    };
    let bytes = rest.as_bytes();
    let mut cursor = 0;
    let mut count = 0;
    while cursor < bytes.len() {
        match bytes[cursor] {
            b'\r' => {
                cursor += if bytes.get(cursor + 1) == Some(&b'\n') {
                    2
                } else {
                    1
                };
                count += 1;
            }
            b'\n' => {
                cursor += 1;
                count += 1;
            }
            _ => break,
        }
    } // End of the loop over the leading line-break run
    count
} // End of function leading_break_count()

/// How many line breaks the run at the end of `text` holds, `\r\n` counting
/// once.
fn trailing_break_count(text: &str) -> usize {
    let bytes = text.as_bytes();
    let mut end = text.len();
    let mut count = 0;
    while end > 0 {
        match bytes[end - 1] {
            b'\n' => {
                end -= if end >= 2 && bytes[end - 2] == b'\r' {
                    2
                } else {
                    1
                };
                count += 1;
            }
            b'\r' => {
                end -= 1;
                count += 1;
            }
            _ => break,
        }
    } // End of the loop over the trailing line-break run
    count
} // End of function trailing_break_count()

/// `text` without its trailing run of line breaks.
fn trim_trailing_breaks(text: &str) -> &str {
    text.trim_end_matches(['\n', '\r'])
}

/// How many line feeds `value` ends with.
///
/// A decoded value never carries a `\r` as a line break — YAML normalises every
/// break to a line feed — so counting line feeds is exact.
fn trailing_line_feeds(value: &str) -> usize {
    value.len() - value.trim_end_matches('\n').len()
}

// ---------------------------------------------------------------------------
// Splicing and verification
// ---------------------------------------------------------------------------

/// Writes every replacement into `source`, **highest byte offset first**.
///
/// Plan section 6.2's rule, and the reason for it: a replacement changes the
/// length of the text after it, so applying the earliest one first would
/// invalidate every later span. `replacements` must be sorted ascending and
/// disjoint, which [`apply_scalar_edits`] guarantees before calling this.
fn splice(source: &str, replacements: &[Replacement]) -> String {
    let mut candidate = source.to_owned();
    for replacement in replacements.iter().rev() {
        candidate.replace_range(
            replacement.span.start..replacement.span.end,
            &replacement.text,
        );
    }
    candidate
} // End of function splice()

/// Everything the candidate is compared against, collected so the comparison has
/// one argument rather than five.
///
/// Every field is a fact about the **original** document or a claim recorded
/// before the splice, and that is the property which makes [`verify`] an oracle
/// rather than a restatement: nothing here is read off the candidate.
struct Expected<'a> {
    /// The original document's syntax index.
    index: &'a SyntaxIndex,
    /// Its trivia, scanned against the same text.
    trivia: &'a TriviaIndex,
    /// The edits as the caller requested them.
    edits: &'a [DocumentEdit],
    /// What each mapping a structural edit changed must hold afterwards.
    fields: &'a [FieldExpectation],
    /// What each sequence an item edit changed must hold afterwards.
    items: &'a [ItemExpectation],
    /// What the batch's move must have done. At most one (see
    /// [`EditError::MoveMustBeTheOnlyEditInItsBatch`]).
    moves: &'a [MoveExpectation],
} // End of struct Expected

/// Reparses `candidate` and checks it says exactly what the edits asked for.
///
/// Five properties, all of them required by plan section 6.2 and none of them
/// inferable from the code that built the candidate:
///
/// 1. **every replacement lies wholly inside a span the edited scalar owns** —
///    the spans come from [`permitted_spans`], which reads the syntax index and
///    knows nothing about the presentation the planner chose. Without this the
///    check below is circular: it confirms that the bytes the planner *declared*
///    replaced did change, so an **oversized intended span** authorises itself.
///    That is exactly how the review's byte-fidelity defect passed verification;
/// 2. **it still parses** — a span replacement can produce invalid YAML;
/// 3. **re-resolving each edit's path against the freshly parsed index decodes
///    to exactly the intended value** — checked with the substrate's own
///    decoded value *and* with our decoder, so a disagreement between the two
///    is a failure rather than a coin toss;
/// 4. **every byte outside the replaced spans is byte-identical** — re-derived
///    from the replacement list, so an off-by-one in `splice` cannot hide;
/// 5. **every comment the original document assigns to the file is still
///    there** — see [`file_comments_survive`]. Properties 1 to 4 are all about
///    nodes and about bytes the edit *declared*, and a file-owned comment is
///    neither: the Phase 0c-3a review's finding 1 destroyed one while passing
///    every other check on this list.
///
/// # And five more when the batch is a move (Phase 0c-3b-2)
///
/// Property 4 is the one a move breaks. "Every byte outside the replaced spans is
/// identical" survived Phases 0c-2b and 0c-3a because insert and remove never
/// relocate anything; a move does, so the statement is satisfied by construction
/// — the replacement list *says* those bytes moved — and it can no longer see a
/// neighbour whose meaning changed because of where they landed. Five properties
/// replace it, and none of them is derived from the edit:
///
/// 6. **the bytes written are the bytes taken, and nothing but the item was
///    taken** ([`the_arrival_is_the_departure`]). Added by this phase's review,
///    which demonstrated that properties 7 to 9 jointly certify a planner that
///    permutes the carried lines: line multisets, digests and the tree are all
///    blind to it, and property 4 authorises whatever insertion text the planner
///    supplied;
/// 7. **the document's lines are conserved**
///    ([`document_lines_are_conserved`]) — a multiset over physical lines, each
///    paired with its own terminator, taken from the two texts;
/// 8. **the sequence holds the intended permutation**
///    ([`items_are_in_the_intended_order`]), compared over subtree digests so an
///    item that arrived carrying the wrong bytes fails too;
/// 9. **every construct the move did not name decodes to what it decoded to
///    before** ([`constructs_outside_the_move_are_unchanged`]) — the whole-document
///    form of the sibling digest, walked in lockstep with the permutation applied;
/// 10. **no comment changed hands** ([`comment_ownership_survives`]) — the
///     re-attribution property, which is what a comment's *ownership* needs and
///     which none of the others can state.
///
/// What this still cannot catch is recorded in
/// `docs/decisions/0c-2b-notes.md` section 7,
/// `docs/decisions/0c-3a-notes.md` section 7.4 and
/// `docs/decisions/0c-3b-2a-notes.md` section 3.
///
/// # Errors
///
/// See [`VerificationFailure`]. Every one of them discards the candidate.
fn verify(
    source: &str,
    candidate: &str,
    replacements: &[Replacement],
    permitted: &[ByteSpan],
    expected: Expected<'_>,
) -> Result<(), VerificationFailure> {
    let Expected {
        index: original,
        trivia,
        edits,
        fields: expectations,
        items: sequences,
        moves,
    } = expected;
    replacements_stay_inside_the_permitted_spans(replacements, permitted)?;
    bytes_outside_the_replacements_match(source, candidate, replacements)?;
    let index = SyntaxIndex::parse(candidate).map_err(VerificationFailure::DoesNotParse)?;
    file_comments_survive(source, candidate, &index, trivia)?;
    no_ambiguous_plain_scalar_is_introduced(original, &index)?;
    for relocation in moves {
        the_arrival_is_the_departure(source, original, replacements, relocation)?;
        document_lines_are_conserved(source, candidate)?;
        items_are_in_the_intended_order(original, &index, relocation)?;
        constructs_outside_the_move_are_unchanged(original, &index, relocation)?;
        // The candidate's trivia is scanned only here, and only for a move: the
        // scan is quadratic (`PROGRESS.md`, R19) and no other edit can change
        // which construct owns a comment without also changing a byte one of the
        // properties above already reads.
        let candidate_trivia = TriviaIndex::scan(candidate, &index);
        comment_ownership_survives(source, candidate, trivia, &candidate_trivia, relocation)?;
    } // End of the loop over the batch's moves, which holds at most one

    for (position, edit) in edits.iter().enumerate() {
        let DocumentEdit::Scalar(edit) = edit else {
            continue;
        };
        let id = resolve(&index, edit.path()).map_err(|error| VerificationFailure::TargetLost {
            edit: position,
            error,
        })?;
        let node = index
            .node(id)
            .ok_or(VerificationFailure::TargetKindChanged {
                edit: position,
                kind: NodeKind::Document,
            })?;
        let Some(scalar) = node.scalar.as_ref() else {
            return Err(VerificationFailure::TargetKindChanged {
                edit: position,
                kind: node.kind,
            });
        };
        let ours = decode(candidate, &scalar.presentation).map_err(|error| {
            VerificationFailure::Undecodable {
                edit: position,
                error,
            }
        })?;
        if ours != scalar.value {
            return Err(VerificationFailure::DecoderDisagreement { edit: position });
        }
        if scalar.value != edit.value() {
            return Err(VerificationFailure::ValueMismatch {
                edit: position,
                wanted_len: edit.value().len(),
                found_len: scalar.value.len(),
                first_difference: first_difference(edit.value(), &scalar.value),
            });
        }
    } // End of the loop that re-resolves and re-decodes every edited value

    for expectation in expectations {
        verify_field(candidate, &index, expectation)?;
    }
    for expectation in sequences {
        verify_items(candidate, &index, expectation)?;
    }
    Ok(())
} // End of function verify()

/// Checks one structural edit against the reparsed candidate.
///
/// Four properties, and the third is the one that makes a removal safe:
///
/// 1. the **mapping** is still there, found by re-resolving its own path against
///    the freshly parsed index;
/// 2. the entry the edit named is **present with its intended value** (an
///    insertion) or **absent** (a removal), by the same re-resolution;
/// 3. **every other entry still decodes to exactly what it decoded to before**,
///    key and whole value subtree, in the same order. This is what stops an
///    oversized envelope: a removal that also swallowed the neighbouring entry
///    passes properties 1, 2 and 4 and fails only this one;
/// 4. the mapping holds exactly one entry more, or fewer, than it did.
fn verify_field(
    candidate: &str,
    index: &SyntaxIndex,
    expectation: &FieldExpectation,
) -> Result<(), VerificationFailure> {
    let edit = expectation.edit;
    let id = resolve(index, &expectation.mapping)
        .map_err(|error| VerificationFailure::MappingLost { edit, error })?;
    let mapping = index
        .node(id)
        .filter(|node| node.kind == NodeKind::Mapping)
        .ok_or(VerificationFailure::MappingLost {
            edit,
            error: PathError::MalformedIndex { node: id },
        })?;
    let entries = mapping_entries(mapping);
    if entries.len() != expectation.entries {
        return Err(VerificationFailure::EntryCountChanged {
            edit,
            expected: expectation.entries,
            found: entries.len(),
        });
    }

    let mut siblings = Vec::new();
    let mut inserted_seen = 0usize;
    for entry in &entries {
        let key = decoded_value(index, entry.key).unwrap_or_default();
        if let Some(removed) = expectation.removed.iter().find(|gone| *gone == key) {
            return Err(VerificationFailure::FieldNotRemoved {
                edit,
                key_len: removed.len(),
            });
        }
        if let Some((wanted_key, wanted_value)) = expectation
            .inserted
            .iter()
            .find(|(wanted, _)| wanted == key)
        {
            {
                // Checked with our decoder as well as the substrate's, exactly as
                // a scalar edit is: a disagreement means one of the two is wrong
                // about bytes we just wrote.
                let value = index
                    .node(entry.value)
                    .and_then(|node| node.scalar.as_ref())
                    .ok_or(VerificationFailure::FieldNotInserted {
                        edit,
                        key_len: wanted_key.len(),
                    })?;
                let ours = decode(candidate, &value.presentation)
                    .map_err(|error| VerificationFailure::Undecodable { edit, error })?;
                if ours != value.value {
                    return Err(VerificationFailure::DecoderDisagreement { edit });
                }
                if &value.value != wanted_value {
                    return Err(VerificationFailure::FieldNotInserted {
                        edit,
                        key_len: wanted_key.len(),
                    });
                }
                inserted_seen += 1;
                continue;
            }
        }
        siblings.push((key.to_owned(), entry.value));
    } // End of the loop over the candidate mapping's entries

    if inserted_seen != expectation.inserted.len() {
        return Err(VerificationFailure::FieldNotInserted {
            edit,
            key_len: expectation
                .inserted
                .iter()
                .map(|(key, _)| key.len())
                .next()
                .unwrap_or(0),
        });
    }
    for (position, ((key, before), (found, value))) in
        expectation.siblings.iter().zip(&siblings).enumerate()
    {
        let unchanged = key == found
            && match before {
                Some(before) => *before == digest(index, *value),
                // A scalar edit in the same batch rewrites this entry; its own
                // verification checks the value, and only the key and its
                // position are this check's business.
                None => true,
            };
        if !unchanged {
            return Err(VerificationFailure::SiblingChanged {
                edit,
                entry: position,
            });
        }
    } // End of the loop that compares every untouched entry with itself
    if siblings.len() != expectation.siblings.len() {
        return Err(VerificationFailure::SiblingChanged {
            edit,
            entry: siblings.len().min(expectation.siblings.len()),
        });
    }
    Ok(())
} // End of function verify_field()

/// Checks one sequence-item edit against the reparsed candidate.
///
/// The sequence's counterpart of [`verify_field`], and it makes the same four
/// claims in the same order:
///
/// 1. the **sequence** is still there, found by re-resolving its own path against
///    the freshly parsed index. For a promotion this is also what proves the
///    implicit null became a sequence at all, because the path that named a
///    zero-width scalar in the original must name a sequence here;
/// 2. it holds exactly as many items as the folded claims intended;
/// 3. **every item the batch did not name still decodes to exactly what it
///    decoded to before**, whole subtree, in the same order. This is what stops an
///    oversized envelope: a removal that also swallowed a neighbouring item passes
///    every other property and fails only this one;
/// 4. the item an insertion wrote is a **flat mapping holding exactly the
///    requested fields**, each decoded by the substrate *and* by our own decoder,
///    exactly as [`verify_field`] checks an inserted entry.
///
/// # Errors
///
/// [`VerificationFailure::MappingLost`] — the name the move's own sequence check
/// already reports a lost sequence under — [`VerificationFailure::EntryCountChanged`],
/// [`VerificationFailure::SiblingChanged`], [`VerificationFailure::FieldNotInserted`],
/// [`VerificationFailure::Undecodable`] and
/// [`VerificationFailure::DecoderDisagreement`].
fn verify_items(
    candidate: &str,
    index: &SyntaxIndex,
    expectation: &ItemExpectation,
) -> Result<(), VerificationFailure> {
    let edit = expectation.edit;
    let id = resolve(index, &expectation.sequence)
        .map_err(|error| VerificationFailure::MappingLost { edit, error })?;
    let sequence = index
        .node(id)
        .filter(|node| node.kind == NodeKind::Sequence)
        .ok_or(VerificationFailure::MappingLost {
            edit,
            error: PathError::MalformedIndex { node: id },
        })?;
    if sequence.children.len() != expectation.slots.len() {
        return Err(VerificationFailure::EntryCountChanged {
            edit,
            expected: expectation.slots.len(),
            found: sequence.children.len(),
        });
    }

    for (position, (slot, item)) in expectation.slots.iter().zip(&sequence.children).enumerate() {
        match slot {
            ItemSlot::Kept(Some(before)) if *before != digest(index, *item) => {
                return Err(VerificationFailure::SiblingChanged {
                    edit,
                    entry: position,
                })
            }
            ItemSlot::Kept(_) => {}
            ItemSlot::Inserted(fields) => {
                verify_inserted_item(candidate, index, edit, *item, fields)?
            }
        }
    } // End of the loop that compares every position with what was intended for it
    Ok(())
} // End of function verify_items()

/// Checks that one candidate node is the flat mapping an insertion asked for.
///
/// Every field is compared by **decoded value**, key and value alike, and every
/// value is decoded twice — once by the substrate's reparse and once by
/// [`crate::emit::decode`] — because a disagreement between the two means one of
/// them is wrong about bytes this edit has just written and there is no way to
/// tell which. That is [`verify_field`]'s rule, applied to a whole item.
///
/// The **flatness** claim is made by the shape of the comparison rather than
/// asserted separately: a value that reparsed as a collection has no
/// `Node::scalar`, so it fails as a missing field.
///
/// # Errors
///
/// [`VerificationFailure::FieldNotInserted`], carrying the length of a key and
/// never its text (`CLAUDE.md` section 1);
/// [`VerificationFailure::Undecodable`]; [`VerificationFailure::DecoderDisagreement`].
fn verify_inserted_item(
    candidate: &str,
    index: &SyntaxIndex,
    edit: usize,
    item: NodeId,
    fields: &[(String, String)],
) -> Result<(), VerificationFailure> {
    let first = fields.first().map_or(0, |(key, _)| key.len());
    let mapping = index
        .node(item)
        .filter(|node| node.kind == NodeKind::Mapping)
        .ok_or(VerificationFailure::FieldNotInserted {
            edit,
            key_len: first,
        })?;
    let entries = mapping_entries(mapping);
    if entries.len() != fields.len() {
        return Err(VerificationFailure::FieldNotInserted {
            edit,
            key_len: first,
        });
    }
    for (entry, (key, value)) in entries.iter().zip(fields) {
        let missing = VerificationFailure::FieldNotInserted {
            edit,
            key_len: key.len(),
        };
        if decoded_value(index, entry.key) != Some(key.as_str()) {
            return Err(missing);
        }
        let scalar = index
            .node(entry.value)
            .and_then(|node| node.scalar.as_ref())
            .ok_or(missing.clone())?;
        let ours = decode(candidate, &scalar.presentation)
            .map_err(|error| VerificationFailure::Undecodable { edit, error })?;
        if ours != scalar.value {
            return Err(VerificationFailure::DecoderDisagreement { edit });
        }
        if &scalar.value != value {
            return Err(missing);
        }
    } // End of the loop over the fields the insertion asked for
    Ok(())
} // End of function verify_inserted_item()

/// Checks that no comment the **file** owns was lost.
///
/// # Why this is not a restatement of anything above it
///
/// Every other property in [`verify`] is stated in terms the edit itself
/// supplied — the spans it declared, the paths it named, the values it intended.
/// A comment the ownership rules give to the *file* is named by none of them: it
/// has no owning node, so no digest holds it, no sibling comparison sees it, and
/// `bytes_outside_the_replacements_match` positively *authorises* its deletion,
/// because a removal envelope that crosses it declares those bytes replaced.
/// That is the Phase 0c-3a review's finding 1, and it is why this check reads
/// the two documents rather than the edit.
///
/// # The comparison
///
/// The comments that must survive come from `TriviaIndex::file_comments` on the
/// **original**, which is the document's own ownership answer. The comments that
/// did survive come from a fresh classification of the candidate — all of them,
/// whoever owns them there, because a legal edit may re-attribute a comment
/// (removing the entry above a leading block hands that block to whatever
/// follows) and re-attribution is not loss.
///
/// So the test is on **multisets of comment text**: every file-owned comment of
/// the original must appear in the candidate at least as many times as it
/// appeared among the original's file-owned comments. Comparing text rather than
/// offsets is what lets an edit above a comment move it without tripping this,
/// and comparing multisets is what stops two identical comments collapsing into
/// one unnoticed.
///
/// It is deliberately a **one-sided** test. A candidate with *more* comments is
/// not a failure: an inserted block scalar may legitimately contain a `#` line,
/// which is content rather than a comment in the original and a comment in
/// neither.
///
/// # Errors
///
/// [`VerificationFailure::FileCommentLost`], carrying the offset the comment had
/// in the original document — never its text (`CLAUDE.md` section 1).
fn file_comments_survive(
    source: &str,
    candidate: &str,
    candidate_index: &SyntaxIndex,
    trivia: &TriviaIndex,
) -> Result<(), VerificationFailure> {
    // Multiset containment by **greedy consumption**: each file-owned comment
    // claims one matching comment out of the candidate's, and the first that
    // finds none is the one that was lost. Counting instead would report the
    // first *occurrence* of the missing text rather than the missing occurrence
    // itself, and this failure's only payload is that offset.
    //
    // The candidate is not scanned at all until a file-owned comment is found,
    // which is most documents.
    let mut survivors: Option<Vec<&str>> = None;
    for comment in trivia.file_comments() {
        let Some(text) = comment.span.slice(source) else {
            continue;
        };
        let survivors = survivors.get_or_insert_with(|| {
            TriviaIndex::comment_spans(candidate, candidate_index)
                .iter()
                .filter_map(|span| span.slice(candidate))
                .collect()
        });
        match survivors.iter().position(|seen| *seen == text) {
            Some(at) => {
                survivors.swap_remove(at);
            }
            None => {
                return Err(VerificationFailure::FileCommentLost {
                    at: comment.span.start,
                })
            }
        }
    } // End of the loop that claims one surviving comment per file-owned one
    Ok(())
} // End of function file_comments_survive()

/// Checks that no edit left the candidate holding a **new** YAML 1.1-ambiguous
/// plain scalar.
///
/// **R16's production property, and the reason the tag-resolution oracle lives in
/// the library rather than only in the test suite** (`PROGRESS.md`, R24). Every
/// other property here is checked against a reparse by `saphyr-parser`, which
/// resolves under YAML **1.2**; espanso resolves under **1.1**. A candidate can
/// therefore satisfy all of them and still say something different where it is
/// read — `no` for `false`, `012` for ten, `12:30` for 750.
///
/// # It is differential on purpose
///
/// Real espanso files legitimately contain `true`, `100` and `on` already, and a
/// property demanding their absence would refuse to edit them. So the check is a
/// **multiset containment**: for every ambiguous plain scalar text, the candidate
/// may hold no more occurrences than the source did. A removal shrinks the
/// multiset, a move leaves it alone, and only writing a new one can fail.
///
/// # Why this is an oracle and not a restatement
///
/// It reads the reparsed candidate's own scalars. Nothing in it comes from the
/// planner, from the replacement list or from the style the emitter chose:
/// [`crate::emit::is_conservatively_safe_plain_scalar`] decides what to *write*,
/// and this reads what the document actually *holds*. A defect in the first is
/// exactly what the second exists to catch.
///
/// # Errors
///
/// [`VerificationFailure::AmbiguousPlainScalarIntroduced`], carrying the offset
/// and length in the candidate and never the text (`CLAUDE.md` section 1).
fn no_ambiguous_plain_scalar_is_introduced(
    original: &SyntaxIndex,
    candidate: &SyntaxIndex,
) -> Result<(), VerificationFailure> {
    let mut budget: BTreeMap<&str, usize> = BTreeMap::new();
    for node in original.nodes() {
        if let Some(text) = ambiguous_plain_scalar(node) {
            *budget.entry(text).or_insert(0) += 1;
        }
    }
    for node in candidate.nodes() {
        let Some(text) = ambiguous_plain_scalar(node) else {
            continue;
        };
        match budget.get_mut(text) {
            Some(remaining) if *remaining > 0 => *remaining -= 1,
            _ => {
                return Err(VerificationFailure::AmbiguousPlainScalarIntroduced {
                    at: node.span.start,
                    len: node.span.len(),
                })
            }
        }
    } // End of the loop that spends one budgeted occurrence per candidate scalar
    Ok(())
} // End of function no_ambiguous_plain_scalar_is_introduced()

/// The decoded text of `node` when it is a plain scalar YAML 1.1 and YAML 1.2
/// read differently, or that 1.1 reads as something other than a string.
///
/// Quoted and block scalars are excluded because quoting is precisely the act
/// that suppresses implicit resolution: `'no'` is a string in every version of
/// YAML, and so is a `|` block.
fn ambiguous_plain_scalar(node: &Node) -> Option<&str> {
    let scalar = node.scalar.as_ref()?;
    if scalar.presentation.style != ScalarStyle::Plain {
        return None;
    }
    plain_scalar_is_ambiguous(&scalar.value).then_some(scalar.value.as_str())
}

/// Checks that a move relocated the document's lines and created none.
///
/// # Why lines rather than bytes
///
/// `PROGRESS.md`'s scope item 3 offers "a multiset of bytes **or** of lines". A
/// multiset of bytes is too weak to be worth stating on its own — it cannot tell
/// `ab` from `ba`, so an engine that scrambled a line's characters would satisfy
/// it. A multiset of lines is what a move actually promises: the same lines, in a
/// different order.
///
/// # Why each line is paired with its own terminator
///
/// Phase 0c-3b-2a compared contents and terminators as **two separate multisets**,
/// because it allowed one relocation that moves a break from one line to another:
/// a move to the end of a file with no final break wrote the item's own trailing
/// break in front of it, so the previously final line gained a terminator. Its
/// review showed that this silently rewrites an untouched line's ending, and that
/// destination is now refused outright
/// ([`EditError::MoveWouldTerminateTheFinalLine`]).
///
/// With the rotation gone, no move relocates a terminator away from its own line,
/// so the pairing is restored and the check is strictly stronger: contents pin
/// that no line was invented, lost, truncated or re-indented, and the pairing pins
/// that no line ending was invented, lost, rewritten **or exchanged with another
/// line's** — a bare `\r` becoming `\r\n` fails, a CRLF document that came back
/// with one LF in it fails, and so does an engine that swapped an LF-terminated
/// carried line with a CRLF-terminated one.
///
/// # Errors
///
/// [`VerificationFailure::DocumentLinesNotConserved`], carrying the offset in the
/// **original** document of a line the candidate does not hold — never the line
/// (`CLAUDE.md` section 1).
fn document_lines_are_conserved(source: &str, candidate: &str) -> Result<(), VerificationFailure> {
    let before = physical_lines(source);
    let after = physical_lines(candidate);

    // Greedy consumption, as `file_comments_survive` does it and for the same
    // reason: the first line that finds no counterpart is the one that went, and
    // counting per distinct text would name some other occurrence of it.
    let mut lines: Vec<(&str, &str)> = after.iter().map(|line| (line.1, line.2)).collect();
    for (at, content, ending) in &before {
        match lines.iter().position(|seen| *seen == (*content, *ending)) {
            Some(found) => {
                lines.swap_remove(found);
            }
            None => return Err(VerificationFailure::DocumentLinesNotConserved { at: *at }),
        }
    } // End of the loop that claims one candidate line per original line
    if !lines.is_empty() {
        // The candidate holds more lines than the original. Reported against the
        // original's end, because there is no original line to name.
        return Err(VerificationFailure::DocumentLinesNotConserved { at: source.len() });
    }
    Ok(())
} // End of function document_lines_are_conserved()

/// Every physical line of `text`, as (offset, content, terminator).
///
/// The terminator is `""` for a final line that has none, which is what makes a
/// document with no final newline distinguishable from one with it. A `\r\n` is
/// one terminator, and a bare `\r` is its own, so no comparison over these can
/// silently accept a rewritten line ending.
fn physical_lines(text: &str) -> Vec<(usize, &str, &str)> {
    let mut lines = Vec::new();
    let mut at = 0usize;
    while at < text.len() {
        let rest = &text[at..];
        match rest.find(['\n', '\r']) {
            None => {
                lines.push((at, rest, ""));
                break;
            }
            Some(offset) => {
                let ending = if rest[offset..].starts_with("\r\n") {
                    "\r\n"
                } else {
                    &rest[offset..offset + 1]
                };
                lines.push((at, &rest[..offset], ending));
                at += offset + ending.len();
            }
        }
    } // End of the walk over the text's physical lines
    lines
} // End of function physical_lines()

/// The physical lines a move of `item` may take, derived **textually**.
///
/// From the start of the item's own first line to the end of its last, then up
/// over the contiguous comment-only lines directly above it — which plan section
/// 6.2's rule 1 gives to the item, and which its ownership hull therefore covers.
/// The walk stops at the first line that is blank or holds anything else, so it
/// can never pull in a comment the *file* owns: the blank line above such a block
/// is what gives it to the file, and the walk stops there.
///
/// **Written from the source text and the item's node span**, so it owes nothing
/// to the `TriviaIndex::subtree_extent` the planner used to build the envelope.
/// That is the whole point of it: two derivations of the same boundary that can
/// disagree.
///
/// # The one thing a textual walk gets wrong, and how this avoids it
///
/// A line whose first non-blank byte is `#` is a comment **only if it does not lie
/// inside a frontier leaf**. A line of shell or Python inside a `replace: |`
/// block's body looks exactly like a leading comment, and the real corpus contains
/// one. The syntax index says where the leaves are; nothing in the text can tell
/// the two apart.
///
/// `None` when the item is not in the index, which is a bug in this crate rather
/// than a document a user can write.
fn item_own_lines(
    source: &str,
    index: &SyntaxIndex,
    item: NodeId,
    body_offset: usize,
) -> Option<ByteSpan> {
    let span = index.node(item)?.span;
    // A block-scalar value already ends past its own final break (D2c), so the
    // item's lines are complete and there is nothing to walk.
    let mut end = span.end;
    if !source.get(..end)?.ends_with(['\n', '\r']) {
        end = line_end_of(source, end);
    }

    let start = leading_comment_block_start(
        source,
        index,
        line_start_of(source, span.start, body_offset),
        body_offset,
    );
    Some(ByteSpan::new(start, end))
} // End of function item_own_lines()

/// Walks up from a line start over the comment-only lines directly above it.
///
/// **One implementation, two callers** — [`item_own_lines`] and
/// [`entry_owned_runs`] — because the boundary they derive is the same boundary
/// read from two directions, and the moment the two walks differed one of them
/// would be wrong about a document the other accepted. They were written twice
/// and are now written once.
///
/// The walk is plan section 6.2's rule 1 stated over text: contiguous comment
/// lines immediately above an entry, with no blank line between, belong to that
/// entry. It stops at the first line that is blank or holds anything else, so it
/// can never climb over a blank line into a comment rule 2 gives to the **file**.
///
/// # Two things it gets right that a plainer walk does not
///
/// - **A `#` inside a frontier leaf is not a comment.** A line of shell or Python
///   inside a `replace: |` block's body looks exactly like a leading comment, and
///   the real corpus contains one. Only the syntax index can tell the two apart,
///   so the walk asks it rather than the text.
/// - **A CRLF line above is one terminator, not two lines.** Stepping back a
///   single byte from a line start lands on the `\n` of a `\r\n`, and asking for
///   *that* byte's line start answers with the offset one past the `\r` — the
///   same line, one byte in. The walk then reads a "line" that is just the
///   terminator, decides it is not a comment and stops, so **no CRLF document
///   ever had its leading comment block counted as owned**. Found by the Phase
///   2b-2c-1 removal table's CRLF twin, which is exactly the row an LF-only
///   fixture cannot produce.
fn leading_comment_block_start(
    source: &str,
    index: &SyntaxIndex,
    from: usize,
    body_offset: usize,
) -> usize {
    let mut start = from;
    while start > body_offset {
        let Some(before) = source.get(..start) else {
            break;
        };
        // Step back over the whole terminator that ends the line above, so that
        // the offset handed to `line_start_of` is that line's own last content
        // byte rather than the second half of its `\r\n`.
        let content_end = if before.ends_with("\r\n") {
            start - 2
        } else if before.ends_with(['\n', '\r']) {
            start - 1
        } else {
            start
        };
        let above = line_start_of(source, content_end, body_offset);
        let Some(line) = source.get(above..start) else {
            break;
        };
        let text = line.trim_start_matches([' ', '\t']);
        let opener = above + (line.len() - text.len());
        let inside_a_leaf = index.nodes().iter().any(|node| {
            node.is_frontier_leaf() && node.span.start <= opener && opener < node.span.end
        });
        if !text.starts_with('#') || inside_a_leaf || above == start {
            break;
        }
        start = above;
    } // End of the walk up over the entry's own leading comment block
    start
} // End of function leading_comment_block_start()

/// The first and last byte any node of the entry's two subtrees occupies.
///
/// Node spans only — no trivia, no ownership query, nothing the planner built.
/// The maximum is taken over the whole subtree rather than over the two roots
/// because a block collection's own span stops at its last *child*
/// (`crate::syntax::collection`) and a block scalar's content span ends past its
/// final break (`PROGRESS.md`, D2c), so neither root alone bounds the entry.
///
/// `None` when neither identifier is in the index, which is a bug in this crate
/// rather than a document a user can write.
fn entry_frontier(index: &SyntaxIndex, key: NodeId, value: NodeId) -> Option<(usize, usize)> {
    let mut first = usize::MAX;
    let mut last = 0usize;
    let mut seen = false;
    let mut pending = vec![key, value];
    while let Some(id) = pending.pop() {
        let Some(node) = index.node(id) else {
            continue;
        };
        seen = true;
        first = first.min(node.span.start);
        last = last.max(node.span.end);
        pending.extend(node.children.iter().copied());
    } // End of the walk over both halves of the entry
    seen.then_some((first, last))
} // End of function entry_frontier()

/// The physical-line runs a removal of one mapping entry may delete, derived
/// **textually and independently of the envelope**.
///
/// **The production bound the Phase 0c-3b-2b review's blocking finding asked
/// for**, and the removal's counterpart of [`item_own_lines`]. It answers in two
/// steps, and nothing in either comes from [`removal_envelope`], from
/// [`removal_span`] or from any span the planner declared:
///
/// 1. **the entry's own lines** — from the start of the line its frontier begins
///    on, up over the contiguous comment-only lines directly above it (plan
///    section 6.2's rule 1 gives those to the entry), down to just past the break
///    that ends its last line. The walk stops at the first line that is blank or
///    holds anything else, so it can never climb over a blank line into a
///    comment the *file* owns by rule 2. A `#` **inside a frontier leaf** is a
///    block scalar's own content and not a comment, and only the syntax index can
///    tell the two apart, so the upward walk asks it rather than the text;
/// 2. **minus what the ownership rules keep** — the whole line of every
///    file-owned comment inside those lines, grown over the blank runs that touch
///    it. That is D2o's rule read the other way round: *a blank run survives
///    exactly where it touches a kept file-owned comment's line*, so a blank run
///    that touches no such line is the entry's own interior trivia and may go.
///
/// # Why this duplicates [`preserved_regions`] rather than calling it
///
/// Deliberately, and for the same reason [`item_own_lines`] duplicates the move
/// envelope's boundary: [`preserved_regions`] punches its holes out of the hull
/// **the planner built**, so an envelope that widened by a line would have its
/// own widened hull handed back to it as the window to check against. This one
/// punches them out of a window derived from the node spans and the text. The two
/// consult the same ownership layer — there is one answer to "who owns this
/// comment" and re-deciding it in the edit layer is exactly what D2/D2d forbids —
/// but they disagree the moment the hull is wrong, which is the whole point.
///
/// Returns the entry's own lines and the ordered, disjoint runs inside them.
fn entry_owned_runs(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    key: NodeId,
    value: NodeId,
) -> Option<(ByteSpan, Vec<ByteSpan>)> {
    let body_offset = index.preamble().body_offset;
    let (first, last) = entry_frontier(index, key, value)?;
    let mut end = last;
    if !source.get(..end)?.ends_with(['\n', '\r']) {
        end = line_end_of(source, end);
    }
    let start = leading_comment_block_start(
        source,
        index,
        line_start_of(source, first, body_offset),
        body_offset,
    );
    let lines = ByteSpan::new(start, end.max(start));

    let mut kept: Vec<ByteSpan> = Vec::new();
    for comment in trivia.file_comments() {
        if !comment.span.intersects(lines) {
            continue;
        }
        let mut from = line_start_of(source, comment.span.start, body_offset);
        let mut to = line_end_of(source, comment.span.end);
        for run in trivia.blank_runs() {
            if run.span.end == from {
                from = run.span.start.max(body_offset);
            }
            if run.span.start == to {
                to = run.span.end;
            }
        } // End of the loop that grows the kept region over the blank runs beside it
        let from = from.max(lines.start).min(lines.end);
        let to = to.min(lines.end).max(from);
        if from < to {
            kept.push(ByteSpan::new(from, to));
        }
    } // End of the loop over the comments the file owns

    kept.sort_by_key(|region| (region.start, region.end));
    let mut merged: Vec<ByteSpan> = Vec::new();
    for region in kept {
        match merged.last_mut() {
            Some(previous) if region.start <= previous.end => {
                previous.end = previous.end.max(region.end)
            }
            _ => merged.push(region),
        }
    } // End of the loop that merges the kept regions into a disjoint, ordered set
    Some((lines, runs_between(lines, &merged)))
} // End of function entry_owned_runs()

/// Checks that a move wrote the bytes it took, and took nothing but the item.
///
/// **The property the Phase 0c-3b-2a review found missing from production**, in
/// two halves that have to run together, because either alone is satisfiable by a
/// defective planner:
///
/// 1. **every departure run lies inside the item's own lines**, as
///    [`item_own_lines`] derives them from the text. Without this the second half
///    is a comparison against whatever the planner chose to take, so an engine
///    that carried one extra blank line away and wrote it back at the destination
///    would satisfy it exactly (experiment C5 of
///    `docs/decisions/0c-3b-2a-notes.md`);
/// 2. **the text written at the destination is the concatenation of the source
///    bytes at those runs**, byte for byte. Nothing is rendered, nothing is
///    re-indented, nothing is re-terminated and no line is reordered.
///
/// The expected bytes are read out of the **original document**; the only thing
/// taken from the planner is the list of spans, and half 1 is what bounds those.
/// The insertion string itself is never an input to what it is compared against,
/// which is the difference between an oracle and a restatement.
///
/// # Shape
///
/// A move's replacement list is exactly *n* departures — non-empty spans replaced
/// by nothing — and one arrival: a zero-width span with text. Anything else is a
/// planning defect and is reported here rather than analysed further, since
/// [`EditError::MoveMustBeTheOnlyEditInItsBatch`] guarantees no other edit
/// contributed to the list.
///
/// # Errors
///
/// [`VerificationFailure::MoveCarriesMoreThanTheItem`] and
/// [`VerificationFailure::MovedBytesWereRewritten`], both carrying offsets only.
fn the_arrival_is_the_departure(
    source: &str,
    original: &SyntaxIndex,
    replacements: &[Replacement],
    relocation: &MoveExpectation,
) -> Result<(), VerificationFailure> {
    let edit = relocation.edit;
    let body_offset = original.preamble().body_offset;
    let lines = item_own_lines(source, original, relocation.item, body_offset).ok_or(
        VerificationFailure::MoveCarriesMoreThanTheItem {
            edit,
            at: ByteSpan::default(),
            lines: ByteSpan::default(),
        },
    )?;

    let mut carried = String::new();
    let mut arrival: Option<&Replacement> = None;
    for replacement in replacements {
        if replacement.text.is_empty() {
            if !lines.contains(replacement.span) {
                return Err(VerificationFailure::MoveCarriesMoreThanTheItem {
                    edit,
                    at: replacement.span,
                    lines,
                });
            }
            let taken = replacement.span.slice(source).ok_or(
                VerificationFailure::MoveCarriesMoreThanTheItem {
                    edit,
                    at: replacement.span,
                    lines,
                },
            )?;
            carried.push_str(taken);
            continue;
        }
        // A second arrival, or an arrival that replaces bytes rather than being
        // spliced between two lines, is not a move whatever else is true of it.
        if arrival.is_some() || !replacement.span.is_empty() {
            return Err(VerificationFailure::MovedBytesWereRewritten {
                edit,
                at: replacement.span.start,
                first_difference: 0,
            });
        }
        arrival = Some(replacement);
    } // End of the loop that splits the departures from the arrival

    let Some(arrival) = arrival else {
        return Err(VerificationFailure::MovedBytesWereRewritten {
            edit,
            at: lines.start,
            first_difference: 0,
        });
    };
    if arrival.text != carried {
        return Err(VerificationFailure::MovedBytesWereRewritten {
            edit,
            at: arrival.span.start,
            first_difference: first_difference(&carried, &arrival.text),
        });
    }
    Ok(())
} // End of function the_arrival_is_the_departure()

/// Checks that no comment changed hands.
///
/// The re-attribution property. A comment's owner is not a decoded value, is not a
/// physical line and is not a byte the edit declared, so every other check in
/// [`verify`] is blind to it — and an envelope that swallows the blank line *below*
/// a file-owned comment writes back every byte it took, conserves every line and
/// leaves the tree identical while handing that comment to whatever ends up
/// underneath it.
///
/// Stated as a **multiset of (comment text, is it the file's?) pairs**, taken over
/// the whole of both documents by the ownership layer, and compared by greedy
/// consumption exactly as [`file_comments_survive`] compares its own. Both sides
/// are facts about a parse; neither is anything the planner said.
///
/// Comparing texts rather than positions is deliberate: a move relocates comments
/// on purpose, so their offsets are expected to change and their attribution is
/// not.
///
/// # Errors
///
/// [`VerificationFailure::CommentOwnershipChanged`], carrying the offset the
/// comment had in the original document — never its text (`CLAUDE.md` section 1).
fn comment_ownership_survives(
    source: &str,
    candidate: &str,
    trivia: &TriviaIndex,
    candidate_trivia: &TriviaIndex,
    relocation: &MoveExpectation,
) -> Result<(), VerificationFailure> {
    let mut survivors: Vec<(&str, bool)> = candidate_trivia
        .comments()
        .iter()
        .filter_map(|comment| {
            comment
                .span
                .slice(candidate)
                .map(|text| (text, comment.owner.is_file()))
        })
        .collect();
    for comment in trivia.comments() {
        let Some(text) = comment.span.slice(source) else {
            continue;
        };
        let wanted = (text, comment.owner.is_file());
        match survivors.iter().position(|seen| *seen == wanted) {
            Some(at) => {
                survivors.swap_remove(at);
            }
            None => {
                return Err(VerificationFailure::CommentOwnershipChanged {
                    edit: relocation.edit,
                    at: comment.span.start,
                })
            }
        }
    } // End of the loop that claims one candidate comment per original one
    Ok(())
} // End of function comment_ownership_survives()

/// Checks that the moved item is where the move said it would be.
///
/// Compared over **subtree digests** rather than over positions alone: an item
/// that arrived at the right index carrying the wrong bytes is exactly as much a
/// failure as one that arrived at the wrong index. The digest holds decoded
/// values, so it is compared and never printed (`CLAUDE.md` section 1).
///
/// The permutation itself is [`MoveExpectation::order`], stated over the original
/// sequence's child positions, which is checkable across the reparse that mints
/// new identifiers.
///
/// # Errors
///
/// [`VerificationFailure::ItemsNotInTheIntendedOrder`], carrying the first
/// sequence position that disagrees; [`VerificationFailure::MappingLost`] when the
/// sequence cannot be re-found at all.
fn items_are_in_the_intended_order(
    original: &SyntaxIndex,
    candidate: &SyntaxIndex,
    relocation: &MoveExpectation,
) -> Result<(), VerificationFailure> {
    let edit = relocation.edit;
    let found = resolve(candidate, &relocation.sequence)
        .map_err(|error| VerificationFailure::MappingLost { edit, error })?;
    let sequence = candidate
        .node(found)
        .filter(|node| node.kind == NodeKind::Sequence)
        .ok_or(VerificationFailure::MappingLost {
            edit,
            error: PathError::MalformedIndex { node: found },
        })?;
    let before: Vec<NodeId> = original
        .node(relocation.sequence_id)
        .map(|node| node.children.clone())
        .unwrap_or_default();
    let order = relocation.order(before.len());
    if sequence.children.len() != order.len() {
        return Err(VerificationFailure::ItemsNotInTheIntendedOrder {
            edit,
            position: sequence.children.len().min(order.len()),
        });
    }
    for (position, wanted) in order.iter().enumerate() {
        let expected = digest(original, before[*wanted]);
        if expected != digest(candidate, sequence.children[position]) {
            return Err(VerificationFailure::ItemsNotInTheIntendedOrder { edit, position });
        }
    } // End of the loop that compares each position with the item intended for it
    Ok(())
} // End of function items_are_in_the_intended_order()

/// Checks that nothing the move did not name says something else now.
///
/// **This is the whole-document invariant, and it is what replaces "every byte
/// outside the replaced spans is identical" for an edit that relocates bytes.**
/// The two indexes are walked in lockstep from every document root, with the
/// moved sequence's children taken in the intended order on the original's side.
/// Kinds, decoded scalar values and child counts must agree at every node.
///
/// # What it can see, and what it cannot
///
/// It sees every construct whose **decoded value or shape** changed: a block
/// scalar that swallowed a comment line the move parked under it, an entry whose
/// value was clipped, a mapping that gained or lost a key, a scalar re-indented
/// into a different value. None of those is anything the edit declared, and the
/// expectation is the original document plus one permutation of positions, so this
/// is an oracle rather than a restatement.
///
/// It cannot see anything a **decoded value is blind to**: a comment, a blank
/// line, a change of scalar style, an indentation change that leaves every value
/// intact. Those are [`document_lines_are_conserved`]'s and
/// [`file_comments_survive`]'s job, which is why all three run and why none of
/// them is redundant.
///
/// # Errors
///
/// [`VerificationFailure::ConstructChangedOutsideTheMove`], carrying the candidate
/// node at which the two documents first disagree — never a value.
fn constructs_outside_the_move_are_unchanged(
    original: &SyntaxIndex,
    candidate: &SyntaxIndex,
    relocation: &MoveExpectation,
) -> Result<(), VerificationFailure> {
    let documents = original.documents();
    let others = candidate.documents();
    if documents.len() != others.len() {
        return Err(VerificationFailure::ConstructChangedOutsideTheMove {
            edit: relocation.edit,
            // No candidate document to name when the candidate has none; the
            // sequence the move was about is the next most useful pointer.
            node: *others.first().unwrap_or(&relocation.sequence_id),
        });
    }
    for (before, after) in documents.iter().zip(others) {
        compare_subtree(original, *before, candidate, *after, relocation).map_err(|node| {
            VerificationFailure::ConstructChangedOutsideTheMove {
                edit: relocation.edit,
                node,
            }
        })?;
    } // End of the loop over the documents of the two parses
    Ok(())
} // End of function constructs_outside_the_move_are_unchanged()

/// Compares two subtrees node for node, applying the move's permutation.
///
/// Returns the **candidate** node at which they first disagree, so the caller can
/// report a position without ever holding a value. The permutation is applied on
/// the original's side and only at the sequence the move names, which is
/// identified by its identifier in the original index rather than by anything the
/// candidate says.
fn compare_subtree(
    original: &SyntaxIndex,
    before: NodeId,
    candidate: &SyntaxIndex,
    after: NodeId,
    relocation: &MoveExpectation,
) -> Result<(), NodeId> {
    let (Some(was), Some(now)) = (original.node(before), candidate.node(after)) else {
        return Err(after);
    };
    if was.kind != now.kind {
        return Err(after);
    }
    match (was.scalar.as_ref(), now.scalar.as_ref()) {
        (Some(was), Some(now)) if was.value != now.value => return Err(after),
        (Some(_), None) | (None, Some(_)) => return Err(after),
        _ => {}
    }
    if was.children.len() != now.children.len() {
        return Err(after);
    }
    let order = if before == relocation.sequence_id {
        relocation.order(was.children.len())
    } else {
        (0..was.children.len()).collect()
    };
    for (position, child) in now.children.iter().enumerate() {
        compare_subtree(
            original,
            was.children[order[position]],
            candidate,
            *child,
            relocation,
        )?;
    } // End of the loop over the children, in the order the move intends
    Ok(())
} // End of function compare_subtree()

/// Checks every replacement against the spans the edited scalars own.
///
/// The list is the concatenation of every edit's [`permitted_spans`], and
/// containment is **exact**: a replacement that starts in one permitted span and
/// ends in another is rejected, which is what stops a block scalar's header and
/// content being rewritten as one envelope across the header line's tail and its
/// line break.
///
/// # Errors
///
/// [`VerificationFailure::SpanNotPermitted`], carrying the offending span.
fn replacements_stay_inside_the_permitted_spans(
    replacements: &[Replacement],
    permitted: &[ByteSpan],
) -> Result<(), VerificationFailure> {
    for replacement in replacements {
        if !permitted.iter().any(|span| span.contains(replacement.span)) {
            return Err(VerificationFailure::SpanNotPermitted {
                at: replacement.span,
            });
        }
    } // End of the loop that authorises every replacement span
    Ok(())
} // End of function replacements_stay_inside_the_permitted_spans()

/// Checks that `candidate` differs from `source` only inside `replacements`.
///
/// Walks the two texts together: before each replacement the bytes must match,
/// after the last one the tails must match, and the lengths must add up. This
/// is the invariant the product rests on, and it is checked against the
/// replacement list rather than against `splice`'s own arithmetic so that a
/// mistake in that arithmetic shows up here.
fn bytes_outside_the_replacements_match(
    source: &str,
    candidate: &str,
    replacements: &[Replacement],
) -> Result<(), VerificationFailure> {
    let mut old_cursor = 0usize;
    let mut new_cursor = 0usize;
    for replacement in replacements {
        let old = source
            .get(old_cursor..replacement.span.start)
            .ok_or(VerificationFailure::BytesOutsideTheSpanChanged { at: old_cursor })?;
        let new = candidate
            .get(new_cursor..new_cursor + old.len())
            .ok_or(VerificationFailure::BytesOutsideTheSpanChanged { at: old_cursor })?;
        if old != new {
            return Err(VerificationFailure::BytesOutsideTheSpanChanged {
                at: old_cursor + first_difference(old, new),
            });
        }
        old_cursor = replacement.span.end;
        new_cursor += old.len() + replacement.text.len();
    } // End of the loop over the replacements, in ascending order

    let old_tail = source
        .get(old_cursor..)
        .ok_or(VerificationFailure::BytesOutsideTheSpanChanged { at: old_cursor })?;
    if new_cursor + old_tail.len() != candidate.len() {
        return Err(VerificationFailure::LengthMismatch {
            expected: new_cursor + old_tail.len(),
            found: candidate.len(),
        });
    }
    let new_tail = candidate
        .get(new_cursor..)
        .ok_or(VerificationFailure::BytesOutsideTheSpanChanged { at: old_cursor })?;
    if old_tail != new_tail {
        return Err(VerificationFailure::BytesOutsideTheSpanChanged {
            at: old_cursor + first_difference(old_tail, new_tail),
        });
    }
    Ok(())
} // End of function bytes_outside_the_replacements_match()

/// Byte offset of the first difference between two strings, or their common
/// length when one is a prefix of the other.
///
/// Deliberately reports an *offset* and never the bytes: these numbers travel
/// into error messages that tests print while running over the private corpus.
fn first_difference(left: &str, right: &str) -> usize {
    left.as_bytes()
        .iter()
        .zip(right.as_bytes())
        .position(|(a, b)| a != b)
        .unwrap_or_else(|| left.len().min(right.len()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::NodeRole;

    /// The expectation for a batch of scalar edits, for tests that call `verify`
    /// directly.
    fn expected<'a>(
        index: &'a SyntaxIndex,
        trivia: &'a TriviaIndex,
        edits: &'a [DocumentEdit],
    ) -> Expected<'a> {
        Expected {
            index,
            trivia,
            edits,
            fields: &[],
            items: &[],
            moves: &[],
        }
    } // End of function expected()

    /// Scans `source`'s trivia, for the tests that call `verify` directly.
    fn trivia_of(source: &str) -> TriviaIndex {
        let index = SyntaxIndex::parse(source).expect("the probe parses");
        TriviaIndex::scan(source, &index)
    }

    /// Applies one edit to `source` and returns the candidate text.
    fn edited(source: &str, path: &str, value: &str) -> String {
        let path = DocumentPath::parse(path).expect("the path parses");
        apply_scalar_edit(source, &path, value)
            .expect("the edit applies")
            .into_text()
    }

    #[test]
    fn a_scalar_edit_rewrites_only_its_own_token() {
        let source = "matches:\n  - trigger: :hi   # keep me\n    replace: hello\n";
        let candidate = edited(source, "matches[0].replace", "goodbye");
        assert_eq!(
            candidate,
            "matches:\n  - trigger: :hi   # keep me\n    replace: goodbye\n"
        );
    }

    #[test]
    fn the_replacement_list_names_the_span_that_changed() {
        let source = "a: one\n";
        let path = DocumentPath::parse("a").unwrap();
        let patched = apply_scalar_edit(source, &path, "two").expect("applies");
        assert_eq!(patched.replacements().len(), 1);
        assert_eq!(patched.replacements()[0].span, ByteSpan::new(3, 6));
        assert_eq!(patched.replacements()[0].text, "two");
        assert_eq!(patched.text(), "a: two\n");
    }

    #[test]
    fn a_batch_is_applied_from_the_highest_offset_downwards() {
        // Requested in ascending order, so an implementation that applied them
        // in request order would invalidate the second span.
        let source = "a: one\nb: two\nc: three\n";
        let edits = [
            ScalarEdit::new(DocumentPath::parse("a").unwrap(), "first"),
            ScalarEdit::new(DocumentPath::parse("b").unwrap(), "second"),
            ScalarEdit::new(DocumentPath::parse("c").unwrap(), "third"),
        ];
        let patched = apply_scalar_edits(source, &edits).expect("applies");
        assert_eq!(patched.text(), "a: first\nb: second\nc: third\n");
        // And the same batch in descending order gives the same answer.
        let reversed: Vec<ScalarEdit> = edits.iter().rev().cloned().collect();
        assert_eq!(
            apply_scalar_edits(source, &reversed)
                .expect("applies")
                .text(),
            patched.text()
        );
    } // End of function a_batch_is_applied_from_the_highest_offset_downwards()

    #[test]
    fn two_edits_to_the_same_scalar_are_refused_rather_than_ordered() {
        let source = "a: one\n";
        let edits = [
            ScalarEdit::new(DocumentPath::parse("a").unwrap(), "x"),
            ScalarEdit::new(DocumentPath::parse("a").unwrap(), "y"),
        ];
        assert!(matches!(
            apply_scalar_edits(source, &edits),
            Err(EditError::OverlappingEdits { .. })
        ));
    }

    #[test]
    fn an_empty_batch_verifies_the_document_unchanged() {
        let source = "a: one\n";
        let patched = apply_scalar_edits(source, &[]).expect("an empty batch is legal");
        assert_eq!(patched.text(), source);
        assert!(patched.replacements().is_empty());
    }

    #[test]
    fn the_gate_is_consulted_by_the_entry_point_not_by_the_caller() {
        // The resolver deliberately knows nothing about hazards (D2j), so this
        // path resolves happily; the mutation entry point is what refuses.
        let source = "base: &shared\n  word: yes\nuse: *shared\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let path = DocumentPath::parse("base.word").unwrap();
        assert!(resolve(&index, &path).is_ok(), "the resolver resolves it");
        assert!(matches!(
            apply_scalar_edit(source, &path, "no"),
            Err(EditError::Refused {
                hazard: HazardKind::AnchorDefinition,
                ..
            })
        ));
    } // End of function the_gate_is_consulted_by_the_entry_point_not_by_the_caller()

    #[test]
    fn the_ambiguity_property_fires_on_a_candidate_no_emitter_would_produce() {
        // **The oracle must be able to disagree.** R16's production property is
        // pinned at zero over both corpora and is argued unreachable — the
        // emitter never writes a 1.1-ambiguous value plain — so the only way to
        // show it is load-bearing rather than dead is to hand it the candidate a
        // defective emitter would have made. That candidate is built here by
        // hand, which is the same discipline `RemovalWouldDeleteAFileComment`
        // gets in `docs/decisions/0c-3b-1-notes.md` section 6.
        let source = SyntaxIndex::parse("a: 'no'\nb: keep\n").expect("parses");
        let plain = SyntaxIndex::parse("a: no\nb: keep\n").expect("parses");
        assert!(matches!(
            no_ambiguous_plain_scalar_is_introduced(&source, &plain),
            Err(VerificationFailure::AmbiguousPlainScalarIntroduced { .. })
        ));

        // And it must **not** fire on the shapes a real file legitimately has.
        // The property is differential, not absolute: an edit may keep, relocate
        // or delete an ambiguous plain scalar the document already held.
        let held = SyntaxIndex::parse("a: no\nb: keep\n").expect("parses");
        assert_eq!(
            no_ambiguous_plain_scalar_is_introduced(&held, &held),
            Ok(())
        );
        let deleted = SyntaxIndex::parse("b: keep\n").expect("parses");
        assert_eq!(
            no_ambiguous_plain_scalar_is_introduced(&held, &deleted),
            Ok(())
        );
        // Two occurrences where the source had one is still an introduction, so
        // the comparison has to count rather than merely look up.
        let twice = SyntaxIndex::parse("a: no\nb: no\n").expect("parses");
        assert!(no_ambiguous_plain_scalar_is_introduced(&held, &twice).is_err());
    } // End of function the_ambiguity_property_fires_on_a_candidate_no_emitter_would_produce()

    #[test]
    fn an_empty_value_has_no_bytes_to_replace() {
        let source = "empty:\nnext: after\n";
        let path = DocumentPath::parse("empty").unwrap();
        assert!(matches!(
            apply_scalar_edit(source, &path, "x"),
            Err(EditError::EmptyTarget { .. })
        ));
        // Its neighbour is editable, so the refusal is about the empty value
        // rather than about the document.
        assert_eq!(edited(source, "next", "later"), "empty:\nnext: later\n");
    }

    #[test]
    fn a_collection_is_not_a_scalar_edit_target() {
        let source = "matches:\n  - trigger: :hi\n";
        let path = DocumentPath::parse("matches").unwrap();
        assert!(matches!(
            apply_scalar_edit(source, &path, "x"),
            Err(EditError::NotAScalar {
                kind: NodeKind::Sequence,
                ..
            })
        ));
    }

    #[test]
    fn a_path_that_names_nothing_is_refused_before_anything_is_rendered() {
        let source = "a: one\n";
        let path = DocumentPath::parse("nope").unwrap();
        assert!(matches!(
            apply_scalar_edit(source, &path, "x"),
            Err(EditError::Unresolvable {
                error: PathError::NoSuchKey { .. },
                ..
            })
        ));
    }

    #[test]
    fn a_key_is_never_the_target_and_a_value_equal_to_one_is_harmless() {
        // R18. Only `Resolved::value` is ever edited, so the path that found the
        // node still names it after the edit. A value that happens to equal
        // another entry's key string changes nothing about addressing.
        let source = "replace: old\nother: x\n";
        let candidate = edited(source, "other", "replace");
        assert_eq!(candidate, "replace: old\nother: replace\n");
        let index = SyntaxIndex::parse(&candidate).expect("parses");
        let keys: Vec<&str> = index
            .nodes()
            .iter()
            .filter(|node| node.role == NodeRole::MappingKey)
            .filter_map(|node| node.scalar.as_ref())
            .map(|scalar| scalar.value.as_str())
            .collect();
        assert_eq!(keys, vec!["replace", "other"]);
    } // End of function a_key_is_never_the_target_and_a_value_equal_to_one_is_harmless()

    // -----------------------------------------------------------------------
    // Style and shape changes
    // -----------------------------------------------------------------------

    #[test]
    fn a_plain_value_becoming_multi_line_becomes_a_literal_block() {
        let source = "matches:\n  - replace: hello\n";
        let candidate = edited(source, "matches[0].replace", "one\ntwo\n");
        assert_eq!(
            candidate,
            "matches:\n  - replace: |\n      one\n      two\n"
        );
    }

    #[test]
    fn a_single_line_value_stays_inside_an_existing_block() {
        // D2e's policy: the user chose `|`, so `|` is kept.
        let source = "replace: |\n  one\n  two\n";
        let candidate = edited(source, "replace", "only one line");
        assert_eq!(candidate, "replace: |-\n  only one line\n");
    }

    #[test]
    fn a_block_scalar_that_cannot_hold_the_value_becomes_a_quoted_scalar() {
        let source = "replace: |\n  body\nnext: 1\n";
        // An empty value cannot be a block at all.
        assert_eq!(edited(source, "replace", ""), "replace: ''\nnext: 1\n");
        // Nor can one carrying a control character.
        assert_eq!(
            edited(source, "replace", "a\u{7f}b"),
            "replace: \"a\\x7fb\"\nnext: 1\n"
        );
    }

    #[test]
    fn a_comment_on_a_block_header_survives_a_shape_change_and_a_body_edit() {
        // The Phase 0c-2b review's finding 2, first counterexample. The header
        // line is not part of either replaced span, so a block-to-flow change
        // rewrites the indicator and deletes the body while the comment stays
        // exactly where the user put it. This used to be refused with a
        // `CommentOnBlockHeader` error, which no longer exists because nothing
        // needs it.
        let source = "replace: | # why\n  body\nnext: 1\n";
        assert_eq!(
            edited(source, "replace", ""),
            "replace: '' # why\nnext: 1\n"
        );
        // The body may still be rewritten too.
        assert_eq!(
            edited(source, "replace", "other\n"),
            "replace: | # why\n  other\nnext: 1\n"
        );
        // And a folded header's comment survives the rewrite to a plain scalar.
        assert_eq!(
            edited("replace: > # why\n  body\nnext: 1\n", "replace", "there"),
            "replace: there # why\nnext: 1\n"
        );
    } // End of function a_comment_on_a_block_header_survives_a_shape_change_and_a_body_edit()

    #[test]
    fn a_block_header_tail_and_its_line_break_are_never_rewritten() {
        // The review's finding 1, both counterexamples. The header line's tail
        // and its own line break lie between `header_span` and `content_span`
        // (D2c), so neither is ours to write: a CRLF header stays CRLF even when
        // the body it introduces uses bare line feeds, and trailing spaces after
        // the indicator survive byte for byte.
        assert_eq!(
            edited("k: |\r\n  body\nnext: 1\n", "k", ""),
            "k: ''\r\nnext: 1\n",
            "the header's CRLF must not be regenerated from the body's ending"
        );
        assert_eq!(
            edited("k: |   \n  body\nnext: 1\n", "k", ""),
            "k: ''   \nnext: 1\n",
            "the three header-tail spaces must survive"
        );
        // The same two shapes when the block stays a block.
        assert_eq!(
            edited("k: |\r\n  body\nnext: 1\n", "k", "other\n"),
            "k: |\r\n  other\nnext: 1\n"
        );
        assert_eq!(
            edited("k: |   \n  body\nnext: 1\n", "k", "other\n"),
            "k: |   \n  other\nnext: 1\n"
        );
    } // End of function a_block_header_tail_and_its_line_break_are_never_rewritten()

    #[test]
    fn a_value_becoming_a_block_on_an_occupied_line_is_quoted_instead() {
        // The review's finding 2, second counterexample. A block scalar owns
        // every line below its header, so it cannot be written on a line that
        // already carries a comment — but the value is perfectly representable
        // there as a double-quoted flow scalar, which is what happens now. This
        // used to be refused with a `LineNotFreeForBlockScalar` error.
        let source = "replace: old # why\nnext: 1\n";
        assert_eq!(
            edited(source, "replace", "one\ntwo\n"),
            "replace: \"one\\ntwo\\n\" # why\nnext: 1\n"
        );
        // The style change is reported rather than performed silently.
        let path = DocumentPath::parse("replace").unwrap();
        let patched = apply_scalar_edit(source, &path, "one\ntwo\n").expect("applies");
        assert_eq!(patched.notes().len(), 1);
        assert_eq!(patched.notes()[0].from, ScalarStyle::Plain);
        assert_eq!(patched.notes()[0].to, ScalarStyle::DoubleQuoted);

        // A single-line replacement leaves the comment where it is and keeps the
        // plain style.
        assert_eq!(
            edited(source, "replace", "there"),
            "replace: there # why\nnext: 1\n"
        );
        // With the line free, the very same value becomes a literal block.
        assert_eq!(
            edited("replace: old\nnext: 1\n", "replace", "one\ntwo\n"),
            "replace: |\n  one\n  two\nnext: 1\n"
        );
    } // End of function a_value_becoming_a_block_on_an_occupied_line_is_quoted_instead()

    #[test]
    fn requoting_a_value_whose_line_carries_a_comment_keeps_the_comment() {
        // The regression test for the quoted-span fix this phase forced. A
        // quoted scalar's reported end swallows trailing spaces and a following
        // comment (see `SyntaxIndex`'s `quoted_span`), so before the trim the
        // edited span covered ` # c`, the value decoded as `'…' # c` and the
        // verify step refused a correct edit. Every one of these shapes is an
        // edit that *requotes*, which is what makes it reachable.
        // `no` is a YAML 1.1 boolean spelling, so a plain scalar that becomes
        // one has to be quoted (D2e). `Don't` is plain-safe and stays plain,
        // which is why it is not the value used for the plain case.
        assert_eq!(edited("a: hello # c\n", "a", "no"), "a: 'no' # c\n");
        assert_eq!(edited("a: hello # c\n", "a", "Don't"), "a: Don't # c\n");
        assert_eq!(edited("a: 'x'  # c\n", "a", "Don't"), "a: 'Don''t'  # c\n");
        assert_eq!(
            edited("a: \"x\" # c\n", "a", "one\ntwo\n"),
            "a: \"one\\ntwo\\n\" # c\n",
            "a multi-line value on a commented line cannot become a block"
        );
        assert_eq!(edited("a: ['x' , 'y']\n", "a[0]", "z"), "a: ['z' , 'y']\n");
    } // End of function requoting_a_value_whose_line_carries_a_comment_keeps_the_comment()

    #[test]
    fn a_document_root_and_a_sequence_item_are_edited_like_any_other_value() {
        // Neither has a mapping key above it, so the parent column comes from
        // the document or the sequence rather than from a mapping.
        assert_eq!(edited("hello\n", "#0", "bye"), "bye\n");
        assert_eq!(edited("hello\n", "#0", "one\ntwo\n"), "|\n  one\n  two\n");
        assert_eq!(
            edited("- one\n- two\n", "[0]", "one\ntwo\n"),
            "- |\n  one\n  two\n- two\n"
        );
        assert_eq!(
            edited("---\na: 1\n", "a", "one\ntwo\n"),
            "---\na: |\n  one\n  two\n"
        );
    } // End of function a_document_root_and_a_sequence_item_are_edited_like_any_other_value()

    #[test]
    fn a_folded_scalar_is_rewritten_as_a_literal_block_in_place() {
        let source = "replace: >\n  one\n  two\nnext: 1\n";
        let candidate = edited(source, "replace", "one two\nthree\n");
        assert_eq!(
            candidate, "replace: |\n  one two\n  three\nnext: 1\n",
            "the header changes with the style"
        );
    }

    // -----------------------------------------------------------------------
    // Trailing line breaks and chomping
    // -----------------------------------------------------------------------

    #[test]
    fn the_chomping_indicator_and_the_line_structure_are_chosen_together() {
        // The document's physical line structure is preserved and only the
        // indicator reinterprets it, so no blank line appears or disappears.
        for (source, value, expected) in [
            // clip -> strip: the terminating break stays, the indicator changes.
            ("k: |\n  a\nnext: 1\n", "a", "k: |-\n  a\nnext: 1\n"),
            // clip -> keep: the value gains a break, so the file does too.
            ("k: |\n  a\nnext: 1\n", "a\n\n", "k: |+\n  a\n\nnext: 1\n"),
            // strip -> clip: the break already after the content serves.
            ("k: |-\n  a\nnext: 1\n", "a\n", "k: |\n  a\nnext: 1\n"),
            // keep -> clip: the two surplus breaks stay as *blank lines*. They
            // were value bytes and are trivia now, and the clip indicator claims
            // exactly one of them, so the value is right and no line is deleted
            // from the user's file.
            (
                "k: |+\n  a\n\n\nnext: 1\n",
                "a\n",
                "k: |\n  a\n\n\nnext: 1\n",
            ),
            // A blank line that is trivia rather than value survives.
            ("k: |\n  a\n\nnext: 1\n", "b", "k: |-\n  b\n\nnext: 1\n"),
            // Keep chomping is the one indicator that cannot leave a trailing
            // break as trivia, so there the count is exact and a line does go.
            (
                "k: |+\n  a\n\n\nnext: 1\n",
                "a\n\n",
                "k: |+\n  a\n\nnext: 1\n",
            ),
        ] {
            assert_eq!(
                edited(source, "k", value),
                expected,
                "{source:?} -> {value:?}"
            );
        } // End of the loop over the chomping transitions
    } // End of function the_chomping_indicator_and_the_line_structure_are_chosen_together()

    #[test]
    fn a_keep_block_refuses_a_value_with_fewer_newlines_than_the_file_holds() {
        // `k: |-\n  a\n\n\nnext: 1\n` has three breaks after the content, none
        // of which the strip indicator claims. Asking for a value that ends in
        // two newlines needs keep chomping, which would claim all three.
        let source = "k: |-\n  a\n\n\nnext: 1\n";
        let path = DocumentPath::parse("k").unwrap();
        assert!(matches!(
            apply_scalar_edit(source, &path, "a\n\n"),
            Err(EditError::TrailingNewlinesNotRepresentable {
                wanted: 2,
                following: 3,
                ..
            })
        ));
    } // End of function a_keep_block_refuses_a_value_with_fewer_newlines_than_the_file_holds()

    #[test]
    fn a_file_without_a_final_newline_keeps_not_having_one() {
        let source = "k: |-\n  a";
        assert_eq!(edited(source, "k", "b"), "k: |-\n  b");
        // …unless the value itself now ends with a newline, which needs a byte.
        assert_eq!(edited(source, "k", "b\n"), "k: |\n  b\n");
    }

    #[test]
    fn a_crlf_document_keeps_crlf_inside_and_outside_the_edit() {
        let source = "k: |\r\n  a\r\nnext: 1\r\n";
        let candidate = edited(source, "k", "b\nc\n");
        assert_eq!(candidate, "k: |\r\n  b\r\n  c\r\nnext: 1\r\n");
    }

    #[test]
    fn a_bom_is_neither_counted_as_a_column_nor_disturbed() {
        let source = "\u{feff}matches:\n  - replace: hi\n";
        let candidate = edited(source, "matches[0].replace", "one\ntwo\n");
        assert_eq!(
            candidate,
            "\u{feff}matches:\n  - replace: |\n      one\n      two\n"
        );
    }

    // -----------------------------------------------------------------------
    // Flow context — the R17 decision, in both directions
    // -----------------------------------------------------------------------

    #[test]
    fn an_edit_inside_a_flow_collection_never_emits_a_block_scalar() {
        // R17. The hazard gate does not refuse a comment-free flow collection,
        // so flow-legality is this module's own responsibility: a multi-line
        // value becomes a double-quoted one-liner rather than a `|` block,
        // which would be illegal inside `{…}`.
        let source = "matches: [{trigger: \":a\", replace: old}]\n";
        let candidate = edited(source, "matches[0].replace", "one\ntwo\n");
        assert_eq!(
            candidate,
            "matches: [{trigger: \":a\", replace: \"one\\ntwo\\n\"}]\n"
        );
        assert!(!candidate.contains('|'));

        // The very same value in block context *is* a literal block.
        let block = "matches:\n  - replace: old\n";
        assert_eq!(
            edited(block, "matches[0].replace", "one\ntwo\n"),
            "matches:\n  - replace: |\n      one\n      two\n"
        );
    } // End of function an_edit_inside_a_flow_collection_never_emits_a_block_scalar()

    #[test]
    fn a_flow_scalar_is_quoted_even_when_the_value_would_be_plain_safe() {
        // A plain scalar inside a flow collection is terminated by `,`, `]` and
        // `}`, so the emitter never writes one there. The cost is two
        // apostrophes inside the edited token; nothing outside it moves.
        let source = "vars: [one, two]\n";
        assert_eq!(edited(source, "vars[1]", "three"), "vars: [one, 'three']\n");
    }

    #[test]
    fn a_comment_inside_a_flow_collection_still_refuses_the_whole_collection() {
        let source = "matches: [\n  {trigger: \":a\", # why\n   replace: old}]\n";
        let path = DocumentPath::parse("matches[0].replace").unwrap();
        assert!(matches!(
            apply_scalar_edit(source, &path, "new"),
            Err(EditError::Refused {
                hazard: HazardKind::CommentInFlowCollection,
                ..
            })
        ));
    }

    // -----------------------------------------------------------------------
    // Verification, driven directly
    // -----------------------------------------------------------------------

    #[test]
    fn verification_rejects_a_candidate_whose_untouched_bytes_moved() {
        // The three properties cannot be exercised through the entry point,
        // which by construction produces candidates that satisfy them. Driving
        // the checks directly is what proves they would catch a bad splice.
        let source = "a: one\nb: two\n";
        let replacements = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "ONE".to_owned(),
        }];
        assert_eq!(
            bytes_outside_the_replacements_match(source, "a: ONE\nb: two\n", &replacements),
            Ok(())
        );
        // A byte before the span moved.
        assert!(matches!(
            bytes_outside_the_replacements_match(source, "A: ONE\nb: two\n", &replacements),
            Err(VerificationFailure::BytesOutsideTheSpanChanged { at: 0 })
        ));
        // A byte after it moved.
        assert!(matches!(
            bytes_outside_the_replacements_match(source, "a: ONE\nb: TWO\n", &replacements),
            Err(VerificationFailure::BytesOutsideTheSpanChanged { at: 10 })
        ));
        // A byte was inserted outside every span.
        assert!(matches!(
            bytes_outside_the_replacements_match(source, "a: ONE\nb: two\n\n", &replacements),
            Err(VerificationFailure::LengthMismatch { .. })
        ));
    } // End of function verification_rejects_a_candidate_whose_untouched_bytes_moved()

    #[test]
    fn verification_rejects_a_candidate_that_does_not_parse_or_says_the_wrong_thing() {
        let source = "a: one\n";
        let edits = [DocumentEdit::Scalar(ScalarEdit::new(
            DocumentPath::parse("a").unwrap(),
            "two",
        ))];
        let token = [ByteSpan::new(3, 6)];
        let trivia = trivia_of(source);
        let index = SyntaxIndex::parse(source).expect("the probe parses");
        let replacements = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "two".to_owned(),
        }];
        assert_eq!(
            verify(
                source,
                "a: two\n",
                &replacements,
                &token,
                expected(&index, &trivia, &edits)
            ),
            Ok(())
        );

        // Invalid YAML.
        let broken = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "\"unclosed".to_owned(),
        }];
        assert!(matches!(
            verify(
                source,
                "a: \"unclosed\n",
                &broken,
                &token,
                expected(&index, &trivia, &edits)
            ),
            Err(VerificationFailure::DoesNotParse(_))
        ));

        // Valid YAML that holds the wrong value.
        let wrong = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "three".to_owned(),
        }];
        assert!(matches!(
            verify(
                source,
                "a: three\n",
                &wrong,
                &token,
                expected(&index, &trivia, &edits)
            ),
            Err(VerificationFailure::ValueMismatch {
                wanted_len: 3,
                found_len: 5,
                ..
            })
        ));

        // Valid YAML in which the path no longer names a scalar.
        let restructured = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "[one]".to_owned(),
        }];
        assert!(matches!(
            verify(
                source,
                "a: [one]\n",
                &restructured,
                &token,
                expected(&index, &trivia, &edits)
            ),
            Err(VerificationFailure::TargetKindChanged {
                kind: NodeKind::Sequence,
                ..
            })
        ));
    } // End of function verification_rejects_a_candidate_that_does_not_parse_or_says_the_wrong_thing()

    #[test]
    fn verification_rejects_a_replacement_that_is_not_wholly_inside_a_permitted_span() {
        // The review's finding 3: `bytes_outside_the_replacements_match` compares
        // the candidate against the source with the **declared** replacements
        // applied, so an oversized intended span authorises itself. This is the
        // check that is not circular, driven with the exact envelope the engine
        // used to synthesize.
        let source = "k: |\r\n  body\nnext: 1\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let node = index
            .nodes()
            .iter()
            .find(|node| {
                node.scalar
                    .as_ref()
                    .is_some_and(|scalar| scalar.presentation.style.is_block())
            })
            .expect("the fixture has a block scalar");
        let presentation = &node.scalar.as_ref().unwrap().presentation;
        let permitted = permitted_spans(node, presentation);
        assert_eq!(permitted.len(), 2, "a block scalar owns two spans");

        // The header and the content, separately: permitted.
        for span in &permitted {
            assert_eq!(
                replacements_stay_inside_the_permitted_spans(
                    &[Replacement {
                        span: *span,
                        text: String::new(),
                    }],
                    &permitted
                ),
                Ok(())
            );
        } // End of the loop over the two permitted spans

        // The combined envelope, which covers the header line's tail and its
        // CRLF: refused, although both of its endpoints are permitted.
        let envelope = ByteSpan::new(
            presentation.header_span.start,
            presentation.content_span.end,
        );
        assert!(!permitted.contains(&envelope));
        assert_eq!(
            replacements_stay_inside_the_permitted_spans(
                &[Replacement {
                    span: envelope,
                    text: "''\n".to_owned(),
                }],
                &permitted
            ),
            Err(VerificationFailure::SpanNotPermitted { at: envelope })
        );
    } // End of function verification_rejects_a_replacement_that_is_not_wholly_inside_a_permitted_span()

    #[test]
    fn a_flow_scalar_owns_exactly_its_token_and_a_block_scalar_owns_two_spans() {
        // `permitted_spans` is the independent statement of "the smallest safe
        // edit", so what it returns is pinned rather than merely used.
        let source = "a: 'x' # c\nb: |2-\n   body\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let mut quoted = None;
        let mut block = None;
        for node in index.nodes() {
            let Some(scalar) = node.scalar.as_ref() else {
                continue;
            };
            match scalar.presentation.style {
                ScalarStyle::SingleQuoted => quoted = Some((node, &scalar.presentation)),
                ScalarStyle::Literal => block = Some((node, &scalar.presentation)),
                _ => {}
            }
        } // End of the loop that finds one scalar of each shape
        let (node, presentation) = quoted.expect("a single-quoted scalar");
        let spans = permitted_spans(node, presentation);
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].slice(source), Some("'x'"));

        let (node, presentation) = block.expect("a literal block");
        let spans = permitted_spans(node, presentation);
        assert_eq!(spans.len(), 2);
        assert_eq!(spans[0].slice(source), Some("|2-"));
        assert_eq!(spans[1].slice(source), Some("   body"));
        // And the gap between them is owned by neither.
        assert_eq!(
            source.get(spans[0].end..spans[1].start),
            Some("\n"),
            "the header line's break lies between the two spans"
        );
    } // End of function a_flow_scalar_owns_exactly_its_token_and_a_block_scalar_owns_two_spans()

    #[test]
    fn a_presentation_change_is_reported_rather_than_performed_silently() {
        // A folded scalar cannot be reproduced by the codec at all, and editing
        // it rewrites it as `|`. Both facts reach the caller.
        let source = "replace: >\n  one\n  two\nnext: 1\n";
        let path = DocumentPath::parse("replace").unwrap();
        let patched = apply_scalar_edit(source, &path, "one two\nthree\n").expect("applies");
        assert_eq!(patched.notes().len(), 1);
        let note = &patched.notes()[0];
        assert_eq!(note.from, ScalarStyle::Folded);
        assert_eq!(note.to, ScalarStyle::Literal);
        assert_eq!(note.reason, Some(NotReencodable::FoldedStyle));

        // An edit that keeps the presentation reports nothing.
        let plain = "a: one\n";
        let patched =
            apply_scalar_edit(plain, &DocumentPath::parse("a").unwrap(), "two").expect("applies");
        assert!(patched.notes().is_empty());
    } // End of function a_presentation_change_is_reported_rather_than_performed_silently()

    // -----------------------------------------------------------------------
    // The arithmetic helpers
    // -----------------------------------------------------------------------

    #[test]
    fn line_break_runs_count_crlf_once() {
        assert_eq!(leading_break_count("\n\n\nx", 0), 3);
        assert_eq!(leading_break_count("\r\n\r\nx", 0), 2);
        assert_eq!(leading_break_count("\r\rx", 0), 2);
        assert_eq!(leading_break_count("  \nx", 0), 0);
        assert_eq!(leading_break_count("x", 1), 0);
        assert_eq!(trailing_break_count("x\n\n"), 2);
        assert_eq!(trailing_break_count("x\r\n\r\n"), 2);
        assert_eq!(trailing_break_count("x"), 0);
        assert_eq!(trailing_break_count(""), 0);
        assert_eq!(trim_trailing_breaks("  x\r\n\r\n"), "  x");
    }

    #[test]
    fn a_column_is_counted_in_characters_and_skips_the_bom() {
        assert_eq!(column_of("a: b\n  c", 7, 0), 2);
        assert_eq!(column_of("día: 1\n", 5, 0), 4, "í is two bytes, one column");
        assert_eq!(
            column_of("\u{feff}a: 1\n", 3, 3),
            0,
            "the BOM is not a column"
        );
        assert_eq!(column_of("\u{feff}a: 1\n", 6, 3), 3);
    }

    #[test]
    fn an_occupied_line_tail_is_located_and_a_blank_one_is_not() {
        assert_eq!(occupied_line_tail("a: b\n", 4), None);
        assert_eq!(occupied_line_tail("a: b  \n", 4), None);
        assert_eq!(occupied_line_tail("a: b", 4), None);
        assert_eq!(
            occupied_line_tail("a: b # why\n", 4),
            Some(ByteSpan::new(5, 10))
        );
    }
}

#[cfg(test)]
mod structural_tests {
    use super::*;

    /// The hand-written xorshift64\* generator the seeded batch sweep uses.
    ///
    /// Written out a third time rather than shared, because
    /// `tests/scalar_codec.rs` and `tests/patch_path.rs` are separate test
    /// binaries this module cannot reach. Kept **identical in shape** to those
    /// two so the three cannot quietly diverge, and hand-written so the crate
    /// gains no dependency.
    struct Prng(u64);

    impl Prng {
        /// Returns the next pseudo-random word.
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }

        /// Returns a value in `0..bound`.
        fn below(&mut self, bound: usize) -> usize {
            (self.next() % bound as u64) as usize
        }
    } // End of impl Prng

    /// Inserts one field and returns the candidate text.
    fn inserted(source: &str, mapping: &str, key: &str, value: &str) -> String {
        let path = DocumentPath::parse(mapping).expect("the path parses");
        insert_field(source, &path, key, value)
            .unwrap_or_else(|error| panic!("the insertion applies: {error}"))
            .into_text()
    }

    /// Removes one field and returns the candidate text.
    fn removed(source: &str, field: &str) -> String {
        let path = DocumentPath::parse(field).expect("the path parses");
        remove_field(source, &path)
            .unwrap_or_else(|error| panic!("the removal applies: {error}"))
            .into_text()
    }

    /// The outcome of a removal, for the refusal tests.
    fn removal_of(source: &str, field: &str) -> Result<PatchedDocument, EditError> {
        remove_field(
            source,
            &DocumentPath::parse(field).expect("the path parses"),
        )
    }

    // -----------------------------------------------------------------------
    // Inserting a field
    // -----------------------------------------------------------------------

    #[test]
    fn an_inserted_field_takes_its_indentation_from_its_siblings() {
        // Never from a default: the column comes from the mapping's own keys, so
        // a nested mapping is written at its own depth and not at two spaces.
        let source = "matches:\n  - trigger: ':a'\n    replace: b\n";
        assert_eq!(
            inserted(source, "matches[0]", "label", "hi"),
            "matches:\n  - trigger: ':a'\n    replace: b\n    label: hi\n"
        );
        // A root mapping's keys sit at column 0.
        assert_eq!(
            inserted("a: 1\nb: 2\n", "#0", "c", "x"),
            "a: 1\nb: 2\nc: x\n"
        );
        // And a deeply nested one at its own column.
        assert_eq!(
            inserted("a:\n  b:\n      c: 1\n", "a.b", "d", "x"),
            "a:\n  b:\n      c: 1\n      d: x\n"
        );
    } // End of function an_inserted_field_takes_its_indentation_from_its_siblings()

    #[test]
    fn an_inserted_value_is_rendered_by_the_scalar_emitter() {
        let source = "matches:\n  - trigger: ':a'\n    replace: b\n";
        // A multi-line value becomes a literal block, indented from the entry.
        assert_eq!(
            inserted(source, "matches[0]", "label", "one\ntwo\n"),
            "matches:\n  - trigger: ':a'\n    replace: b\n    label: |\n      one\n      two\n"
        );
        // A value that only looks like a number is quoted (D2e).
        assert_eq!(inserted("a: 1\n", "#0", "b", "3"), "a: 1\nb: '3'\n");
        // As is one YAML 1.1 would read as a boolean.
        assert_eq!(inserted("a: 1\n", "#0", "b", "no"), "a: 1\nb: 'no'\n");
        // A control character forces double quotes, the only style with escapes.
        assert_eq!(
            inserted("a: 1\n", "#0", "b", "x\u{7f}y"),
            "a: 1\nb: \"x\\x7fy\"\n"
        );
        // An awkward key is quoted too, and never written as a block scalar.
        assert_eq!(inserted("a: 1\n", "#0", "b: c", "x"), "a: 1\n'b: c': x\n");
    } // End of function an_inserted_value_is_rendered_by_the_scalar_emitter()

    #[test]
    fn a_field_can_be_inserted_after_a_named_sibling() {
        let source = "a: 1\nb: 2\nc: 3\n";
        assert_eq!(
            insert_field(source, &DocumentPath::root(0), "inserted", "x")
                .expect("appends")
                .text(),
            "a: 1\nb: 2\nc: 3\ninserted: x\n"
        );
        let after = apply_edits(
            source,
            &[FieldInsert::after(DocumentPath::root(0), "a", "inserted", "x").into()],
        )
        .expect("inserts after `a`");
        assert_eq!(after.text(), "a: 1\ninserted: x\nb: 2\nc: 3\n");
    } // End of function a_field_can_be_inserted_after_a_named_sibling()

    #[test]
    fn an_insertion_after_an_entry_with_an_inline_comment_goes_below_the_comment() {
        // The comment belongs to the entry (plan section 6.2 rule 3), so the new
        // line goes after it rather than between the value and its comment.
        let patched = apply_edits(
            "a: 1 # why\nb: 2\n",
            &[FieldInsert::after(DocumentPath::root(0), "a", "c", "x").into()],
        )
        .expect("applies");
        assert_eq!(patched.text(), "a: 1 # why\nc: x\nb: 2\n");
    } // End of function an_insertion_after_an_entry_with_an_inline_comment_goes_below_the_comment()

    #[test]
    fn an_insertion_after_a_block_scalar_starts_on_the_next_line() {
        // A block scalar's content span already ends past its final line break
        // (D2c), so the insertion point is that position exactly and no second
        // break is written.
        let patched = apply_edits(
            "a: |\n  body\nb: 2\n",
            &[FieldInsert::after(DocumentPath::root(0), "a", "c", "x").into()],
        )
        .expect("applies");
        assert_eq!(patched.text(), "a: |\n  body\nc: x\nb: 2\n");
        assert_eq!(
            inserted("a: |\n  body\n", "#0", "c", "x"),
            "a: |\n  body\nc: x\n"
        );
    }

    #[test]
    fn an_insertion_preserves_a_missing_final_newline_and_a_crlf_document() {
        // At end of file the break goes in **front** of the new entry, so a file
        // that did not end in a newline still does not.
        assert_eq!(inserted("a: 1\nb: 2", "#0", "c", "x"), "a: 1\nb: 2\nc: x");
        // And a CRLF document gets CRLF, inside the entry and after it.
        assert_eq!(
            inserted("a: 1\r\nb: 2\r\n", "#0", "c", "one\ntwo\n"),
            "a: 1\r\nb: 2\r\nc: |\r\n  one\r\n  two\r\n"
        );
        assert_eq!(
            inserted("a: 1\r\nb: 2", "#0", "c", "x"),
            "a: 1\r\nb: 2\r\nc: x"
        );
    } // End of function an_insertion_preserves_a_missing_final_newline_and_a_crlf_document()

    #[test]
    fn an_insertion_into_a_bom_document_never_touches_the_bom() {
        let source = "\u{feff}a: 1\n";
        let candidate = inserted(source, "#0", "b", "x");
        assert_eq!(candidate, "\u{feff}a: 1\nb: x\n");
        assert!(candidate.starts_with('\u{feff}'));
    }

    #[test]
    fn inserting_a_key_the_mapping_already_has_is_refused() {
        // Two entries with one key make every path through the mapping
        // ambiguous and raise `DuplicateMappingKey`, so the mapping would become
        // uneditable the moment the edit landed.
        let source = "a: 1\nb: 2\n";
        assert!(matches!(
            insert_field(source, &DocumentPath::root(0), "a", "x"),
            Err(EditError::KeyAlreadyPresent { .. })
        ));
        // The same key spelled differently is the same key (D2j).
        assert!(matches!(
            insert_field("'a': 1\n", &DocumentPath::root(0), "a", "x"),
            Err(EditError::KeyAlreadyPresent { .. })
        ));
    } // End of function inserting_a_key_the_mapping_already_has_is_refused()

    #[test]
    fn inserting_into_a_flow_mapping_is_refused_explicitly() {
        // D2k threads flow context into *rendering*, so a scalar edit inside
        // `{…}` is allowed. A structural edit is a different question — a flow
        // mapping has no line to add an entry to — and it is refused by name
        // rather than left undefined.
        let source = "vars: [{name: one, type: echo}]\n";
        assert!(matches!(
            insert_field(source, &DocumentPath::parse("vars[0]").unwrap(), "x", "y"),
            Err(EditError::FlowCollection { .. })
        ));
        assert!(matches!(
            removal_of(source, "vars[0].name"),
            Err(EditError::FlowCollection { .. })
        ));
    } // End of function inserting_into_a_flow_mapping_is_refused_explicitly()

    #[test]
    fn a_structural_edit_asks_the_gate_about_the_mapping_not_only_the_entry() {
        // Strictly more pessimistic than a scalar edit, deliberately: a
        // structural edit changes the mapping's own shape, so a merge key or an
        // anchor anywhere inside it makes the change unreasonable locally.
        let source = "defaults: &d\n  a: 1\nuse:\n  <<: *d\n  b: 2\n";
        assert!(matches!(
            insert_field(source, &DocumentPath::parse("use").unwrap(), "c", "x"),
            Err(EditError::Refused {
                hazard: HazardKind::MergeKey,
                ..
            })
        ));
        // The gate is consulted *before* anything about the shape is examined:
        // the same mapping refuses an insertion of a key it already holds with
        // the hazard, not with `KeyAlreadyPresent`.
        assert!(matches!(
            insert_field(source, &DocumentPath::parse("use").unwrap(), "b", "x"),
            Err(EditError::Refused { .. })
        ));
    } // End of function a_structural_edit_asks_the_gate_about_the_mapping_not_only_the_entry()

    #[test]
    fn a_path_that_is_not_a_mapping_is_refused() {
        let source = "matches:\n  - trigger: ':a'\n";
        assert!(matches!(
            insert_field(source, &DocumentPath::parse("matches").unwrap(), "x", "y"),
            Err(EditError::NotAMapping {
                kind: NodeKind::Sequence,
                ..
            })
        ));
        // A removal whose path ends in an index names a sequence item, which no
        // key introduces.
        assert!(matches!(
            removal_of(source, "matches[0]"),
            Err(EditError::NotAMapping { .. })
        ));
    } // End of function a_path_that_is_not_a_mapping_is_refused()

    // -----------------------------------------------------------------------
    // Removing a field
    // -----------------------------------------------------------------------

    #[test]
    fn a_removal_takes_the_whole_entry_and_leaves_its_neighbours_alone() {
        assert_eq!(removed("a: 1\nb: 2\nc: 3\n", "b"), "a: 1\nc: 3\n");
        assert_eq!(removed("a: 1\nb: 2\nc: 3\n", "a"), "b: 2\nc: 3\n");
        assert_eq!(removed("a: 1\nb: 2\nc: 3\n", "c"), "a: 1\nb: 2\n");
        // A nested collection value goes with its entry.
        assert_eq!(
            removed("a: 1\nb:\n  x: 1\n  y: 2\nc: 3\n", "b"),
            "a: 1\nc: 3\n"
        );
        // A block-scalar value, whose content span already ends a line.
        assert_eq!(
            removed(
                "matches:\n  - trigger: ':a'\n    replace: |\n      body\n    label: x\n",
                "matches[0].replace"
            ),
            "matches:\n  - trigger: ':a'\n    label: x\n"
        );
    } // End of function a_removal_takes_the_whole_entry_and_leaves_its_neighbours_alone()

    #[test]
    fn a_removal_takes_the_trivia_the_entrys_subtree_owns() {
        // The inline comment belongs to the value scalar and the colon to the
        // key, so an envelope built from *direct* ownership would leave one of
        // them behind. `subtree_extent` takes both (D2d).
        assert_eq!(removed("a: 1 # why\nb: 2\n", "a"), "b: 2\n");
        // A leading comment block immediately above the entry belongs to it…
        assert_eq!(
            removed("a: 1\n# about b\n# still about b\nb: 2\nc: 3\n", "b"),
            "a: 1\nc: 3\n"
        );
        // …but one separated **from what follows** by a blank line belongs to
        // the file and stays put, blank line and all. Rule 2 turns on the blank
        // line *below* the comment, not the one above it: a comment with a blank
        // line above and none below is still a leading block for what follows,
        // which is why the first shape here travels and the second does not.
        assert_eq!(
            removed("a: 1\n\n# about b\nb: 2\nc: 3\n", "b"),
            "a: 1\n\nc: 3\n"
        );
        assert_eq!(
            removed("a: 1\n# about the file\n\nb: 2\nc: 3\n", "b"),
            "a: 1\n# about the file\n\nc: 3\n"
        );
        // A file-header comment never travels with the first entry (rule 4).
        assert_eq!(removed("# header\na: 1\nb: 2\n", "a"), "# header\nb: 2\n");
    } // End of function a_removal_takes_the_trivia_the_entrys_subtree_owns()

    #[test]
    fn a_removal_leaves_the_blank_lines_around_it_where_they_are() {
        // A blank line is the file's layout rather than the entry's trivia, so
        // the user's visual grouping survives the removal.
        assert_eq!(removed("a: 1\n\nb: 2\n\nc: 3\n", "b"), "a: 1\n\n\nc: 3\n");
    }

    #[test]
    fn a_removal_preserves_a_missing_final_newline_and_a_crlf_document() {
        assert_eq!(removed("a: 1\nb: 2", "b"), "a: 1\n");
        assert_eq!(removed("a: 1\nb: 2", "a"), "b: 2");
        assert_eq!(removed("a: 1\r\nb: 2\r\nc: 3\r\n", "b"), "a: 1\r\nc: 3\r\n");
    }

    #[test]
    fn a_removal_from_a_bom_document_never_touches_the_bom() {
        let source = "\u{feff}a: 1\nb: 2\n";
        let candidate = removed(source, "a");
        assert_eq!(candidate, "\u{feff}b: 2\n");
        assert!(candidate.starts_with('\u{feff}'));
    }

    #[test]
    fn removing_the_last_entry_of_a_mapping_is_refused() {
        // `a:` with nothing under it is not the same document as `a:` with one
        // entry: the mapping becomes an implicit null. Emptying a mapping is a
        // decision about the parent entry, so this step refuses.
        assert!(matches!(
            removal_of("a:\n  b: 1\nc: 2\n", "a.b"),
            Err(EditError::LastEntryOfMapping { .. })
        ));
        assert!(matches!(
            removal_of("a: 1\n", "a"),
            Err(EditError::LastEntryOfMapping { .. })
        ));
        // Removing the parent entry instead is allowed.
        assert_eq!(removed("a:\n  b: 1\nc: 2\n", "a"), "c: 2\n");
    } // End of function removing_the_last_entry_of_a_mapping_is_refused()

    #[test]
    fn removing_the_first_entry_of_a_compact_item_is_refused() {
        // `- trigger: ':a'` puts the entry on the same line as the `-` that
        // introduces the mapping, and the dash belongs to the item rather than
        // to the entry. Deleting the line strands the dash; deleting only the
        // entry re-indents what follows. Both change bytes the user did not ask
        // about, so the removal is refused and the reason is named.
        let source = "matches:\n  - trigger: ':a'\n    replace: b\n";
        assert!(matches!(
            removal_of(source, "matches[0].trigger"),
            Err(EditError::EntryDoesNotOwnItsLines { .. })
        ));
        // Its sibling, which does own its line, is removable.
        assert_eq!(
            removed(source, "matches[0].replace"),
            "matches:\n  - trigger: ':a'\n"
        );
    } // End of function removing_the_first_entry_of_a_compact_item_is_refused()

    // -----------------------------------------------------------------------
    // The run-based envelope — Phase 0c-3b-1, closing R21
    // -----------------------------------------------------------------------

    /// The runs one removal deletes, as slices of the source.
    fn runs_of(source: &str, field: &str) -> Vec<String> {
        remove_field(source, &DocumentPath::parse(field).unwrap())
            .expect("the removal applies")
            .replacements()
            .iter()
            .map(|replacement| {
                replacement
                    .span
                    .slice(source)
                    .expect("a run slices")
                    .to_owned()
            })
            .collect()
    } // End of function runs_of()

    #[test]
    fn the_envelope_is_split_only_for_a_comment_the_file_owns() {
        // One run when there is nothing to preserve, however many lines and
        // descendants the entry has — the overwhelmingly common case, and the
        // proof that runs are not a change of behaviour for it.
        assert_eq!(
            runs_of("a:\n  x: 1\n  y: 2\nb: 3\n", "a"),
            vec!["a:\n  x: 1\n  y: 2\n"]
        );
        // …and two when a comment the file owns lies between two descendants.
        assert_eq!(
            runs_of("a:\n  x: 1\n  # file\n\n  y: 2\nb: 3\n", "a"),
            vec!["a:\n  x: 1\n", "  y: 2\n"]
        );
        // A comment the entry's own subtree owns is not a reason to split: it
        // travels with the entry, so it stays inside the single run.
        assert_eq!(
            runs_of("a:\n  x: 1\n  # leads y\n  y: 2\nb: 3\n", "a"),
            vec!["a:\n  x: 1\n  # leads y\n  y: 2\n"]
        );
    } // End of function the_envelope_is_split_only_for_a_comment_the_file_owns()

    #[test]
    fn a_kept_comment_keeps_the_blank_runs_on_both_sides_of_it() {
        // The blank line **below** is what rule 2 reads to give the comment to
        // the file, so deleting it would hand the surviving comment to whatever
        // ends up underneath. The one above is the layout the user chose. Both
        // are preserved, and both are checked here as bytes rather than as a
        // count of lines.
        let source = "a:\n  x: 1\n\n  # file\n\n  y: 2\nb: 3\n";
        assert_eq!(runs_of(source, "a"), vec!["a:\n  x: 1\n", "  y: 2\n"]);
        assert_eq!(removed(source, "a"), "\n  # file\n\nb: 3\n");
        // A run of several blank lines is preserved whole, because the ownership
        // rules treat the run and not the line as the unit (`BlankRun`).
        let source = "a:\n  x: 1\n\n\n  # file\n\n\n  y: 2\nb: 3\n";
        assert_eq!(removed(source, "a"), "\n\n  # file\n\n\nb: 3\n");
    } // End of function a_kept_comment_keeps_the_blank_runs_on_both_sides_of_it()

    #[test]
    fn two_kept_comment_blocks_produce_three_runs() {
        // Merging matters: each comment of a block is its own attachment, and two
        // separate blocks must not merge into one region across the entry's own
        // bytes between them.
        let source = "a:\n  x: 1\n  # one\n\n  y: 2\n  # two\n\n  z: 3\nb: 4\n";
        assert_eq!(
            runs_of(source, "a"),
            vec!["a:\n  x: 1\n", "  y: 2\n", "  z: 3\n"]
        );
        assert_eq!(removed(source, "a"), "  # one\n\n  # two\n\nb: 4\n");
    } // End of function two_kept_comment_blocks_produce_three_runs()

    #[test]
    fn a_kept_comment_in_a_crlf_document_keeps_its_crlf() {
        let source = "a:\r\n  x: 1\r\n  # file\r\n\r\n  y: 2\r\nb: 3\r\n";
        assert_eq!(removed(source, "a"), "  # file\r\n\r\nb: 3\r\n");
        // And a document with no final newline still has none: the last run ends
        // the file.
        let source = "a:\n  x: 1\n  # file\n\n  y: 2\nb: 3";
        assert_eq!(removed(source, "a"), "  # file\n\nb: 3");
    } // End of function a_kept_comment_in_a_crlf_document_keeps_its_crlf()

    #[test]
    fn a_bom_document_with_a_kept_comment_never_loses_the_bom() {
        let source = "\u{feff}a:\n  x: 1\n  # file\n\n  y: 2\nb: 3\n";
        let patched = remove_field(source, &DocumentPath::parse("a").unwrap()).expect("applies");
        assert_eq!(patched.text(), "\u{feff}  # file\n\nb: 3\n");
        for replacement in patched.replacements() {
            assert!(replacement.span.start >= 3, "no run may touch the BOM");
        }
    } // End of function a_bom_document_with_a_kept_comment_never_loses_the_bom()

    #[test]
    fn a_blank_run_survives_only_where_it_touches_a_kept_comment() {
        // **The blank-run rule, pinned in both directions** (the Phase 0c-3b-1
        // review's finding 1). The two documents differ by one comment line.
        //
        // Direction one: a blank run interior to the removed entry that no kept
        // comment touches is trivia of the entry the user asked to remove, and it
        // goes with it. Preserving it would invent a leading blank line at
        // document start that the file never held.
        assert_eq!(removed("a:\n  x: 1\n\n  y: 2\nb: 3\n", "a"), "b: 3\n");
        // Direction two: the same blank run, now touching a comment the file
        // owns, survives byte for byte — the one below because rule 2 reads it to
        // give the comment to the file, the one above because `blank_runs()`
        // groups it with that comment's line and the gap layer does not re-decide
        // per side.
        assert_eq!(
            removed("a:\n  x: 1\n\n  # file\n\n  y: 2\nb: 3\n", "a"),
            "\n  # file\n\nb: 3\n"
        );
        // And a blank run that touches nothing kept is still deleted when another
        // one, further down the same entry, is kept: the rule is per run, not per
        // entry.
        assert_eq!(
            removed("a:\n  x: 1\n\n  y: 2\n\n  # file\n\n  z: 3\nb: 4\n", "a"),
            "\n  # file\n\nb: 4\n"
        );
    } // End of function a_blank_run_survives_only_where_it_touches_a_kept_comment()

    #[test]
    fn a_kept_comment_under_a_block_scalar_is_refused_rather_than_absorbed() {
        // The one residual shape (`EditError::RemovalWouldExtendABlockScalar`).
        // Keeping the comment would put it directly under `k`'s content at the
        // block's own body column, where it is content rather than a comment.
        let source = "k: |\n  body\na:\n  x: 1\n  # file\n\n  y: 2\nb: 3\n";
        assert!(matches!(
            removal_of(source, "a"),
            Err(EditError::RemovalWouldExtendABlockScalar { .. })
        ));
        // Nothing near a block scalar is refused, only this shape: the same
        // document without the file-owned comment removes cleanly, and so does
        // the entry that holds the block itself.
        assert_eq!(
            removed("k: |\n  body\na:\n  x: 1\n  y: 2\nb: 3\n", "a"),
            "k: |\n  body\nb: 3\n"
        );
        assert_eq!(
            removed(source, "k"),
            "a:\n  x: 1\n  # file\n\n  y: 2\nb: 3\n"
        );
        // …and moving the block one entry further away, so a real line stands
        // between its content and the envelope, makes the removal legal again.
        assert_eq!(
            removed(
                "k: |\n  body\nc: 0\na:\n  x: 1\n  # file\n\n  y: 2\nb: 3\n",
                "a"
            ),
            "k: |\n  body\nc: 0\n  # file\n\nb: 3\n"
        );
    } // End of function a_kept_comment_under_a_block_scalar_is_refused_rather_than_absorbed()

    #[test]
    fn a_kept_comment_shallower_than_the_block_above_it_is_not_absorbed() {
        // **The Phase 0c-3b-1 review's finding 2, byte-exactly.** The reviewer's
        // own document: a folded block whose body is indented two columns, and a
        // preserved comment at column zero. A line shallower than the body column
        // *ends* the block exactly as `vars:` already did, so `replace` keeps its
        // value and the removal must apply.
        let source =
            "replace: >\n  body\nvars:\n  first: one\n# keep this file comment\n\n  second: two\ntail: 3\n";
        assert_eq!(
            removed(source, "vars"),
            "replace: >\n  body\n# keep this file comment\n\ntail: 3\n"
        );
        // …and `replace` really does still decode to what it decoded to: the run
        // set is checked against the original index by `StructuralGuard`, but the
        // whole point of the refusal is the *value*, so state it directly.
        let before = SyntaxIndex::parse(source).expect("parses");
        let after = SyntaxIndex::parse(&removed(source, "vars")).expect("the candidate parses");
        let folded = |index: &SyntaxIndex| {
            index
                .nodes()
                .iter()
                .filter_map(|node| node.scalar.as_ref())
                .find(|scalar| scalar.presentation.style.is_block())
                .map(|scalar| scalar.value.clone())
                .expect("the folded block is there")
        };
        assert_eq!(folded(&before), folded(&after));

        // The narrowing is a comparison, not a removal of the check. The same
        // document with the comment indented **to** the body column is still
        // refused, for `>` as well as for `|`.
        for header in ['>', '|'] {
            let indented = format!(
                "replace: {header}\n  body\nvars:\n  first: one\n  # keep this file comment\n\n  second: two\ntail: 3\n"
            );
            assert!(
                matches!(
                    removal_of(&indented, "vars"),
                    Err(EditError::RemovalWouldExtendABlockScalar { .. })
                ),
                "a comment at the body column must still be refused for {header}"
            );
        } // End of the loop over the two block styles
          // A comment one column shallower than the body is safe again, which is
          // the boundary the comparison is drawn at.
        assert_eq!(
            removed(
                "replace: |\n   body\nvars:\n  first: one\n  # keep\n\n  second: two\ntail: 3\n",
                "vars"
            ),
            "replace: |\n   body\n  # keep\n\ntail: 3\n"
        );
        // And a block that never had a body line has no observed column to
        // compare against, so it is refused whatever the comment's column is.
        assert!(matches!(
            removal_of(
                "replace: |\nvars:\n  first: one\n# keep\n\n  second: two\ntail: 3\n",
                "vars"
            ),
            Err(EditError::RemovalWouldExtendABlockScalar { .. })
        ));
    } // End of function a_kept_comment_shallower_than_the_block_above_it_is_not_absorbed()

    #[test]
    fn every_run_of_a_multi_run_envelope_takes_part_in_the_batch_protocol() {
        // A removal now contributes several replacements to one flat batch list,
        // so the disjointness check has to see all of them. A scalar edit inside
        // the **second** run is the case a per-edit check would miss.
        let source = "a:\n  x: 1\n  # file\n\n  y: 2\nb: 3\n";
        for inside in ["a.x", "a.y"] {
            assert!(
                matches!(
                    apply_edits(
                        source,
                        &[
                            FieldRemoval::new(DocumentPath::parse("a").unwrap()).into(),
                            ScalarEdit::new(DocumentPath::parse(inside).unwrap(), "9").into(),
                        ]
                    ),
                    Err(EditError::OverlappingEdits { .. })
                ),
                "a scalar edit inside the run set must collide with it"
            );
        } // End of the loop over the two runs of the envelope
          // An edit outside every run is fine, and the splice still runs from the
          // highest offset downwards across four replacements.
        let patched = apply_edits(
            source,
            &[
                FieldRemoval::new(DocumentPath::parse("a").unwrap()).into(),
                ScalarEdit::new(DocumentPath::parse("b").unwrap(), "changed").into(),
            ],
        )
        .expect("the batch applies");
        assert_eq!(patched.text(), "  # file\n\nb: changed\n");
        assert_eq!(patched.replacements().len(), 3);
    } // End of function every_run_of_a_multi_run_envelope_takes_part_in_the_batch_protocol()

    #[test]
    fn the_run_derivation_is_ordered_disjoint_and_covers_the_hull() {
        // The two halves of the derivation, driven directly: which regions are
        // preserved, and what is left. `runs_between` is a pure set difference, so
        // it is worth pinning independently of the ownership query that feeds it.
        let hull = ByteSpan::new(0, 100);
        assert_eq!(runs_between(hull, &[]), vec![hull]);
        assert_eq!(
            runs_between(hull, &[ByteSpan::new(10, 20), ByteSpan::new(40, 50)]),
            vec![
                ByteSpan::new(0, 10),
                ByteSpan::new(20, 40),
                ByteSpan::new(50, 100)
            ]
        );
        // A region flush against either end produces no empty run.
        assert_eq!(
            runs_between(hull, &[ByteSpan::new(0, 10)]),
            vec![ByteSpan::new(10, 100)]
        );
        assert_eq!(
            runs_between(hull, &[ByteSpan::new(90, 100)]),
            vec![ByteSpan::new(0, 90)]
        );
        assert_eq!(runs_between(hull, &[hull]), Vec::<ByteSpan>::new());

        // And the preserved side, on the D2o example: one region, whole lines,
        // covering the comment and the blank line under it.
        let source = "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\nb: 3\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let hull = ByteSpan::new(0, source.len() - "b: 3\n".len());
        let preserved = preserved_regions(source, &index, &trivia, hull);
        assert_eq!(preserved.len(), 1);
        assert_eq!(
            preserved[0].slice(source),
            Some("  # keep this file comment\n\n")
        );
        // Nothing is preserved out of a hull that holds no file-owned comment.
        let plain = ByteSpan::new(0, 10);
        assert!(preserved_regions(source, &index, &trivia, plain).is_empty());
    } // End of function the_run_derivation_is_ordered_disjoint_and_covers_the_hull()

    #[test]
    fn a_line_is_measured_from_its_start_to_past_its_break() {
        let source = "one\r\ntwo\nthree";
        assert_eq!(line_start_of(source, 2, 0), 0);
        assert_eq!(line_start_of(source, 6, 0), 5);
        // The preamble bounds the backwards walk, so a BOM is never crossed.
        assert_eq!(line_start_of("\u{feff}a: 1\n", 4, 3), 3);
        assert_eq!(
            line_end_of(source, 0),
            5,
            "a CRLF break counts as two bytes"
        );
        assert_eq!(line_end_of(source, 5), 9);
        assert_eq!(
            line_end_of(source, 9),
            source.len(),
            "an unterminated final line ends at end of file"
        );
    } // End of function a_line_is_measured_from_its_start_to_past_its_break()

    #[test]
    fn an_entry_with_no_value_is_removable_although_it_owns_no_bytes() {
        // The value is a zero-width scalar, so the envelope comes from the
        // key's subtree — which owns the colon — rather than from the value's.
        assert_eq!(removed("a: 1\nb:\nc: 3\n", "b"), "a: 1\nc: 3\n");
        assert_eq!(removed("a: 1\nb: # why\nc: 3\n", "b"), "a: 1\nc: 3\n");
        assert_eq!(removed("a: 1\nb:\n", "b"), "a: 1\n");
    }

    // -----------------------------------------------------------------------
    // The batch protocol, where `OverlappingEdits` becomes load-bearing
    // -----------------------------------------------------------------------

    #[test]
    fn two_structural_edits_to_the_same_entry_are_refused_rather_than_ordered() {
        let source = "a: 1\nb: 2\nc: 3\n";
        // Two removals of the same entry: identical spans.
        assert!(matches!(
            apply_edits(
                source,
                &[
                    FieldRemoval::new(DocumentPath::parse("b").unwrap()).into(),
                    FieldRemoval::new(DocumentPath::parse("b").unwrap()).into(),
                ]
            ),
            Err(EditError::OverlappingEdits { .. })
        ));
        // Two insertions at the same point: both spans are zero width and share
        // a start, which the plain `end > start` test cannot see.
        assert!(matches!(
            apply_edits(
                source,
                &[
                    FieldInsert::new(DocumentPath::root(0), "d", "x").into(),
                    FieldInsert::new(DocumentPath::root(0), "e", "y").into(),
                ]
            ),
            Err(EditError::OverlappingEdits { .. })
        ));
    } // End of function two_structural_edits_to_the_same_entry_are_refused_rather_than_ordered()

    #[test]
    fn a_malformed_batch_is_refused_by_name_and_never_panics() {
        // The Phase 0c-3a review's finding 3. Three removals of one entry each
        // planned successfully against the original mapping, and
        // `fold_expectations` then subtracted 1 from a count of 2 three times.
        // In a debug build that is not a wrong answer, it is a **panic** — from a
        // public entry point, on input a caller is entitled to hand it.
        let source = "a: 1\nb: 2\n";
        let path = DocumentPath::parse("a").expect("the path parses");
        let batch: Vec<DocumentEdit> = (0..3)
            .map(|_| DocumentEdit::RemoveField(FieldRemoval::new(path.clone())))
            .collect();
        assert!(matches!(
            apply_edits(source, &batch),
            Err(EditError::OverlappingEdits { .. })
        ));

        // The same shape one entry deeper, so the count reaches zero rather than
        // going below it, and with **distinct** entries so nothing overlaps:
        // individually legal, together they empty the mapping into an implicit
        // null, which is a different document rather than a smaller one.
        let source = "m:\n  a: 1\n  b: 2\nn: 3\n";
        assert!(matches!(
            apply_edits(
                source,
                &[
                    FieldRemoval::new(DocumentPath::parse("m.a").unwrap()).into(),
                    FieldRemoval::new(DocumentPath::parse("m.b").unwrap()).into(),
                ]
            ),
            Err(EditError::LastEntryOfMapping { .. })
        ));
        // …and removing one of the two is still fine, so the refusal is scoped to
        // the batch that empties the mapping rather than to the mapping.
        assert!(apply_edits(
            source,
            &[FieldRemoval::new(DocumentPath::parse("m.a").unwrap()).into()]
        )
        .is_ok());
    } // End of function a_malformed_batch_is_refused_by_name_and_never_panics()

    #[test]
    fn a_seeded_sweep_of_adversarial_batches_produces_typed_errors_and_no_panic() {
        // The generalisation of the test above, because the specific batch that
        // panicked was found by a reviewer rather than by the suite. Batches are
        // drawn from a small set of paths and edit kinds, so duplicates,
        // overlaps, nested targets and mixed kinds all occur often. The property
        // is the one `PROGRESS.md` D3b states for incomplete input and this file
        // owes for malformed input: **a public entry point answers, it never
        // panics**. Reaching that answer is the whole assertion; `apply_edits`
        // returns a typed `Result`, so any outcome at all is typed.
        let sources = [
            "a: 1\nb: 2\n",
            "m:\n  a: 1\n  b: 2\nn: 3\n",
            "m:\n  a: 1\n  # a file comment\n\n  b: 2\nn: 3\n",
            "matches:\n  - trigger: ':a'\n    replace: |\n      body\n    label: x\n",
            "a: 1",
        ];
        let paths = ["a", "b", "m", "m.a", "m.b", "n", "matches", "matches[0]"];
        let values = ["plain", "", "one\ntwo\n", "no"];

        // The same hand-written xorshift64* generator `tests/scalar_codec.rs`
        // and `tests/patch_path.rs` use, in the same shape, so the crate still
        // gains no dependency and the three cannot drift apart unnoticed.
        let mut prng = Prng(0x2545_f491_4f6c_dd1d);

        let mut applied = 0usize;
        for _ in 0..600 {
            let source = sources[prng.below(sources.len())];
            let mut batch: Vec<DocumentEdit> = Vec::new();
            for _ in 0..1 + prng.below(4) {
                let path = DocumentPath::parse(paths[prng.below(paths.len())])
                    .expect("the probe paths parse");
                let value = values[prng.below(values.len())];
                batch.push(match prng.below(3) {
                    0 => ScalarEdit::new(path, value).into(),
                    1 => FieldRemoval::new(path).into(),
                    _ => FieldInsert::new(path, "inserted", value).into(),
                });
            } // End of the loop that builds one batch
            if apply_edits(source, &batch).is_ok() {
                applied += 1;
            }
        } // End of the loop over the seeded batches

        // Reaching this line is the property: 600 batches were answered rather
        // than aborted. The one thing worth asserting beyond that is that the
        // sweep is not vacuous — some of those batches really applied.
        assert!(applied > 0, "no generated batch ever applied");
    } // End of function a_seeded_sweep_of_adversarial_batches_produces_typed_errors_and_no_panic()

    #[test]
    fn a_scalar_edit_inside_a_removed_entry_overlaps_it() {
        // The scalar's token lies inside the removal envelope, so which one wins
        // would depend on the order they were applied in. There is no answer.
        let source = "a:\n  x: 1\nb: 2\n";
        assert!(matches!(
            apply_edits(
                source,
                &[
                    FieldRemoval::new(DocumentPath::parse("a").unwrap()).into(),
                    ScalarEdit::new(DocumentPath::parse("a.x").unwrap(), "changed").into(),
                ]
            ),
            Err(EditError::OverlappingEdits { .. })
        ));
    } // End of function a_scalar_edit_inside_a_removed_entry_overlaps_it()

    #[test]
    fn adjacent_but_not_overlapping_structural_edits_are_applied_together() {
        // Two removals of neighbouring entries: their envelopes touch at a byte
        // but do not overlap, so both apply and the highest offset goes first.
        let source = "a: 1\nb: 2\nc: 3\nd: 4\n";
        let patched = apply_edits(
            source,
            &[
                FieldRemoval::new(DocumentPath::parse("b").unwrap()).into(),
                FieldRemoval::new(DocumentPath::parse("c").unwrap()).into(),
            ],
        )
        .expect("two adjacent removals apply");
        assert_eq!(patched.text(), "a: 1\nd: 4\n");
        assert_eq!(patched.replacements().len(), 2);
        assert_eq!(
            patched.replacements()[0].span.end,
            patched.replacements()[1].span.start,
            "the two envelopes are adjacent, which is exactly the boundary case"
        );

        // A removal and an insertion in the same batch, in one mapping.
        let patched = apply_edits(
            source,
            &[
                FieldRemoval::new(DocumentPath::parse("b").unwrap()).into(),
                FieldInsert::new(DocumentPath::root(0), "e", "5").into(),
            ],
        )
        .expect("a removal and an insertion apply together");
        assert_eq!(patched.text(), "a: 1\nc: 3\nd: 4\ne: '5'\n");

        // And a scalar edit alongside a structural one, in the same batch.
        let patched = apply_edits(
            source,
            &[
                ScalarEdit::new(DocumentPath::parse("a").unwrap(), "changed").into(),
                FieldRemoval::new(DocumentPath::parse("d").unwrap()).into(),
            ],
        )
        .expect("mixed kinds apply together");
        assert_eq!(patched.text(), "a: changed\nb: 2\nc: 3\n");
    } // End of function adjacent_but_not_overlapping_structural_edits_are_applied_together()

    // -----------------------------------------------------------------------
    // Verification, driven directly
    // -----------------------------------------------------------------------

    #[test]
    fn the_removal_guard_refuses_an_envelope_that_reaches_into_a_neighbour() {
        // The check that is **not** circular. `bytes_outside_the_replacements_match`
        // compares the candidate against the source with the *declared*
        // replacements applied, so an envelope one entry too long confirms
        // itself. The guard is stated in terms of the original index's node
        // spans, which the planner did not choose.
        let source = "a: 1\nb: 2\nc: 3\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let resolved = resolve_full(&index, &DocumentPath::parse("b").unwrap()).expect("resolves");
        let entry = (resolved.key.expect("a key"), resolved.value);

        let honest = removal_span(
            source,
            &index,
            0,
            entry_extent(&index, &trivia, entry.0, entry.1),
        )
        .expect("the entry owns its lines");
        assert_eq!(honest.slice(source), Some("b: 2\n"));
        assert_eq!(
            StructuralGuard::Removal {
                runs: vec![honest],
                entry,
                kind: EnvelopeKind::RemovesTheEntry,
            }
            .check(source, &index, &trivia),
            Ok(())
        );

        // One entry too long: the same span extended over `c: 3`.
        let greedy = ByteSpan::new(honest.start, source.len());
        assert!(matches!(
            StructuralGuard::Removal {
                runs: vec![greedy],
                entry,
                kind: EnvelopeKind::RemovesTheEntry,
            }
            .check(source, &index, &trivia),
            Err(VerificationFailure::EnvelopeCoversAnotherNode { .. })
        ));

        // And the two halves of the guard are independent, which is why the
        // second exists: a run set that touches nothing outside the entry can
        // still fail to cover it. The empty set is the extreme case; a set that
        // punched a token out is the reachable one.
        assert!(matches!(
            StructuralGuard::Removal {
                runs: Vec::new(),
                entry,
                kind: EnvelopeKind::RemovesTheEntry,
            }
            .check(source, &index, &trivia),
            Err(VerificationFailure::EnvelopeMissesTheEntry { .. })
        ));
        let clipped = ByteSpan::new(honest.start, honest.end - 2);
        assert!(matches!(
            StructuralGuard::Removal {
                runs: vec![clipped],
                entry,
                kind: EnvelopeKind::RemovesTheEntry,
            }
            .check(source, &index, &trivia),
            Err(VerificationFailure::EnvelopeMissesTheEntry { .. })
        ));
    } // End of function the_removal_guard_refuses_an_envelope_that_reaches_into_a_neighbour()

    /// Plans a removal, lets `tamper` rewrite the plan, and runs everything
    /// [`apply_edits`] runs afterwards.
    ///
    /// The removal's counterpart of `move_tests::tampered_move`, and deliberately
    /// not a wrapper over [`apply_edits`]: the point is to inject a plan no
    /// planner in this tree produces and subject it to the **whole** safety
    /// boundary — the disjointness check, the structural guard, the splice and
    /// every verification property — rather than to a chosen one.
    fn tampered_removal(
        source: &str,
        field: &str,
        tamper: impl FnOnce(&str, &mut PlannedEdit),
    ) -> Result<String, EditError> {
        let index = SyntaxIndex::parse(source).expect("the document parses");
        let trivia = TriviaIndex::scan(source, &index);
        let path = DocumentPath::parse(field).expect("the path parses");
        let request = FieldRemoval::new(path);
        let mut planned = plan_removal(source, &index, &trivia, 0, &request)?;
        tamper(source, &mut planned);
        planned
            .replacements
            .sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
        for pair in planned.replacements.windows(2) {
            if pair[0].span.end > pair[1].span.start || pair[0].span.start == pair[1].span.start {
                return Err(EditError::OverlappingEdits {
                    first: pair[0].span,
                    second: pair[1].span,
                });
            }
        } // End of the loop that checks the tampered replacements are disjoint
        for guard in &planned.guards {
            guard.check(source, &index, &trivia)?;
        }
        let expectations =
            fold_expectations(&index, planned.expectation.into_iter().collect(), &[])?;
        let candidate = splice(source, &planned.replacements);
        verify(
            source,
            &candidate,
            &planned.replacements,
            &planned.permitted,
            Expected {
                index: &index,
                trivia: &trivia,
                edits: &[],
                fields: &expectations,
                items: &[],
                moves: &[],
            },
        )?;
        Ok(candidate)
    } // End of function tampered_removal()

    /// Rewrites a planned removal as if its envelope had been `runs` all along.
    ///
    /// The replacements **and** the declared permitted spans **and** the guard's
    /// own run list are all replaced, so the only thing wrong with the plan is
    /// the run set itself. A mutation that left one of the three behind would be
    /// caught for the wrong reason and would prove nothing.
    fn recarve_removal(planned: &mut PlannedEdit, runs: Vec<ByteSpan>) {
        planned.replacements = runs
            .iter()
            .map(|run| Replacement {
                span: *run,
                text: String::new(),
            })
            .collect();
        planned.permitted = runs.clone();
        for guard in &mut planned.guards {
            if let StructuralGuard::Removal { runs: guarded, .. } = guard {
                *guarded = runs.clone();
            }
        } // End of the loop that tells the removal guard about the new runs
    } // End of function recarve_removal()

    #[test]
    fn experiment_e5_a_removal_that_swallows_a_following_blank_line_is_rejected() {
        // **Experiment E5, and the Phase 0c-3b-2b review's blocking finding.**
        // The review's exact shape: remove `matches[0].label`, with a blank line
        // directly below the entry that the entry does not own.
        //
        // Every other production check accepts the widened envelope. No node is
        // crossed, because a blank line holds none; the mapping still loses
        // exactly one entry; every sibling digest is unchanged; no comment moves;
        // and `bytes_outside_the_replacements_match` positively **authorises**
        // the deleted byte, because the envelope declared it. Before this phase
        // only the gate sweep's own line bound saw it, which is R24's exact
        // pattern one phase after R24 was written down.
        let source = "matches:\n  - trigger: ':a'\n    replace: x\n    label: remove-me\n\n  - trigger: ':b'\n    replace: y\n";
        let greedy = tampered_removal(source, "matches[0].label", |source, planned| {
            let mut runs: Vec<ByteSpan> = planned
                .replacements
                .iter()
                .map(|replacement| replacement.span)
                .collect();
            let last = runs.len() - 1;
            runs[last].end = line_end_of(source, runs[last].end);
            recarve_removal(planned, runs);
        });
        assert!(
            matches!(
                greedy,
                Err(EditError::Verification(
                    VerificationFailure::RemovalCarriesMoreThanTheEntry { .. }
                ))
            ),
            "deleting a blank line the entry does not own must be refused, got {greedy:?}"
        );

        // …and the honest plan applies, so the bound is not simply refusing the
        // request. The blank line is still there afterwards, which is the byte
        // the whole finding is about.
        let honest = tampered_removal(source, "matches[0].label", |_, _| {})
            .expect("the untampered removal applies");
        assert_eq!(
            honest,
            "matches:\n  - trigger: ':a'\n    replace: x\n\n  - trigger: ':b'\n    replace: y\n"
        );

        // The oracle can also **agree**: a blank line the entry genuinely owns is
        // inside the bound, so removing an entry whose own value spans it is
        // untouched by the new check. The distinction is ownership, not whether
        // the byte decodes to YAML data.
        let owns_its_blank = "matches:\n  - trigger: ':a'\n    replace: |\n      one\n\n      two\n    label: keep\n";
        assert!(
            tampered_removal(owns_its_blank, "matches[0].replace", |_, _| {}).is_ok(),
            "an entry whose own block scalar holds a blank line still removes"
        );
    } // End of function experiment_e5_a_removal_that_swallows_a_following_blank_line_is_rejected()

    #[test]
    fn the_entry_owned_runs_bound_keeps_the_blank_run_a_file_comment_rests_on() {
        // The second half of D2o, stated as a bound rather than as an envelope:
        // the blank run **below** a kept file-owned comment is what rule 2 reads
        // to give that comment to the file, so it is outside what the entry owns
        // and a run that swallowed it would re-attribute the comment. The
        // envelope already punches it out; this asserts that the *independent*
        // bound punches it out too, which is what makes the two able to disagree.
        let source = "m:\n  a: 1\n\n  # the file owns this\n\n  b: 2\nn: 3\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        let resolved =
            resolve_full(&index, &DocumentPath::parse("m.b").unwrap()).expect("resolves");
        let entry = (resolved.key.expect("a key"), resolved.value);
        let (lines, owned) = entry_owned_runs(source, &index, &trivia, entry.0, entry.1)
            .expect("the entry is in the index");
        assert_eq!(lines.slice(source), Some("  b: 2\n"));
        assert_eq!(
            owned.iter().filter_map(|run| run.slice(source)).count(),
            1,
            "the entry's own lines hold one run"
        );

        // …and a run reaching one line up, into the blank line the comment's
        // ownership rests on, is outside the bound.
        let greedy = ByteSpan::new(line_start_of(source, lines.start - 1, 0), lines.end);
        assert!(matches!(
            StructuralGuard::Removal {
                runs: vec![greedy],
                entry,
                kind: EnvelopeKind::RemovesTheEntry,
            }
            .check(source, &index, &trivia),
            Err(VerificationFailure::RemovalCarriesMoreThanTheEntry { .. })
        ));
    } // End of function the_entry_owned_runs_bound_keeps_the_blank_run_a_file_comment_rests_on()

    #[test]
    fn the_insertion_guard_refuses_a_point_inside_a_node() {
        let source = "a: hello\nb: 2\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        // Between the two lines: legal, although it is inside the root mapping
        // and inside the document, which is what "between two entries" means.
        assert_eq!(
            StructuralGuard::Insertion { at: 9 }.check(source, &index, &trivia),
            Ok(())
        );
        // Inside the scalar `hello`: not.
        assert!(matches!(
            StructuralGuard::Insertion { at: 5 }.check(source, &index, &trivia),
            Err(VerificationFailure::InsertionPointInsideANode { .. })
        ));
    }

    #[test]
    fn verification_rejects_a_candidate_that_lost_a_file_owned_comment() {
        // **The Phase 0c-3a review's finding 1, at the layer that let it
        // through.** The planner now performs this removal correctly, so the only
        // way to ask whether verification *could* have caught the hull-based
        // answer is to hand `verify` the candidate the old planner produced.
        // Everything else about that candidate is impeccable: it parses, `b` is
        // untouched, the mapping lost exactly the entry it was asked to lose, and
        // the bytes outside the declared replacement are identical — because the
        // declared replacement is precisely the span that ate the comment. This
        // is the second of the three visibility layers of R21, and it stays live
        // now that the planner no longer refuses: `docs/decisions/0c-3b-1-notes.md`
        // records the experiment that disables the other two.
        let source = "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\nb: 3\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &index);
        assert_eq!(
            trivia.file_comments().count(),
            1,
            "the document must give that comment to the file"
        );

        let envelope = ByteSpan::new(0, source.len() - "b: 3\n".len());
        let replacements = vec![Replacement {
            span: envelope,
            text: String::new(),
        }];
        let candidate = splice(source, &replacements);
        assert_eq!(candidate, "b: 3\n", "the bytes the old engine produced");

        // The two checks that ran before this fix both pass on it.
        assert_eq!(
            bytes_outside_the_replacements_match(source, &candidate, &replacements),
            Ok(())
        );
        assert_eq!(
            replacements_stay_inside_the_permitted_spans(&replacements, &[envelope]),
            Ok(())
        );

        // The new one does not.
        let candidate_index = SyntaxIndex::parse(&candidate).expect("the candidate parses");
        assert_eq!(
            file_comments_survive(source, &candidate, &candidate_index, &trivia),
            Err(VerificationFailure::FileCommentLost { at: 12 })
        );
        // And it is not simply "any removal fails": a candidate that keeps the
        // comment passes, even though the comment has moved and been
        // re-attributed.
        let kept = "a:\n  # keep this file comment\n\n  y: 2\nb: 3\n";
        let kept_index = SyntaxIndex::parse(kept).expect("parses");
        assert_eq!(
            file_comments_survive(source, kept, &kept_index, &trivia),
            Ok(())
        );
    } // End of function verification_rejects_a_candidate_that_lost_a_file_owned_comment()

    #[test]
    fn a_removal_whose_envelope_crosses_a_file_comment_keeps_the_comment() {
        // **The D2o example, and R21's closure.** Phase 0c-3a refused this
        // removal: the envelope was one contiguous hull, so the only way not to
        // delete the comment was not to delete the entry. The envelope is now the
        // two runs either side of the comment's own lines, and the removal is a
        // real edit whose kept bytes are byte-identical — indentation, `#`, text
        // and the blank line under it.
        let source = "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\nb: 3\n";
        assert_eq!(removed(source, "a"), "  # keep this file comment\n\nb: 3\n");
        // Two runs, both deleting and neither touching the comment.
        let patched = remove_field(source, &DocumentPath::parse("a").unwrap()).expect("applies");
        assert_eq!(patched.replacements().len(), 2);
        assert_eq!(
            patched.replacements()[0].span.slice(source),
            Some("a:\n  x: 1\n")
        );
        assert_eq!(
            patched.replacements()[1].span.slice(source),
            Some("  y: 2\n")
        );
        for replacement in patched.replacements() {
            assert_eq!(replacement.text, "");
        }

        // The entries inside the collection, and the neighbouring entry, are all
        // still removable, exactly as they were when the whole entry was refused.
        assert_eq!(
            removed(source, "a.x"),
            "a:\n  # keep this file comment\n\n  y: 2\nb: 3\n"
        );
        assert_eq!(
            removed(source, "b"),
            "a:\n  x: 1\n  # keep this file comment\n\n  y: 2\n"
        );
        // A comment the entry's own subtree owns is not the file's, and still
        // travels with the entry it belongs to.
        assert_eq!(removed("a: 1 # mine\nb: 2\n", "a"), "b: 2\n");
        assert_eq!(
            removed("a: 1\n# leads b\nb: 2\nc: 3\n", "b"),
            "a: 1\nc: 3\n"
        );
        // The file **header** is the opposite case and is why the two must not
        // be conflated: rule 4 outranks rule 1, so a comment above the first
        // top-level key belongs to the file — and it stays put without needing a
        // refusal, because it is above the envelope rather than inside it.
        assert_eq!(
            removed("# a header\na: 1\nb: 2\n", "a"),
            "# a header\nb: 2\n"
        );
    } // End of function a_removal_whose_envelope_crosses_a_file_comment_is_refused_by_name()

    #[test]
    fn an_insertion_copies_a_line_ending_and_refuses_when_there_is_none_to_copy() {
        // The review's finding 2. `LineEnding::detect` defaults a single-line
        // document to LF, so the document-wide answer is an invention here.
        assert!(matches!(
            insert_field("a: 1", &DocumentPath::root(0), "b", "x"),
            Err(EditError::NoObservableLineEnding { at: 4, .. })
        ));
        // A bare carriage return is a break `LineEnding` cannot write, so it is
        // refused rather than normalised to LF.
        assert!(matches!(
            insert_field("a: 1\rb: 2", &DocumentPath::root(0), "c", "x"),
            Err(EditError::NoObservableLineEnding { .. })
        ));

        // The anchor's own break, not the document's majority: this document is
        // LF-dominant and the anchor is CRLF-terminated.
        let mixed = "a: 1\nb: 2\r\nc: 3\n";
        let inserted = apply_edits(
            mixed,
            &[FieldInsert::after(DocumentPath::root(0), "b", "d", "x").into()],
        )
        .expect("the insertion applies");
        assert_eq!(inserted.text(), "a: 1\nb: 2\r\nd: x\r\nc: 3\n");
        // …and the LF-terminated anchor beside it still gets LF.
        let inserted = apply_edits(
            mixed,
            &[FieldInsert::after(DocumentPath::root(0), "a", "d", "x").into()],
        )
        .expect("the insertion applies");
        assert_eq!(inserted.text(), "a: 1\nd: x\nb: 2\r\nc: 3\n");

        // At end of file the anchor has no terminator, so the break comes from
        // the last one before it — a nearby sibling's — and the file still does
        // not end in one.
        let at_eof = apply_edits(
            "a: 1\r\nb: 2",
            &[FieldInsert::new(DocumentPath::root(0), "c", "x").into()],
        )
        .expect("the insertion applies");
        assert_eq!(at_eof.text(), "a: 1\r\nb: 2\r\nc: x");
    } // End of function an_insertion_copies_a_line_ending_and_refuses_when_there_is_none_to_copy()

    #[test]
    fn the_line_ending_before_a_point_is_the_last_one_written() {
        assert_eq!(line_ending_before("a\nb", 2), Some(LineEnding::Lf));
        assert_eq!(line_ending_before("a\r\nb", 3), Some(LineEnding::Crlf));
        // Taken from the *last* break before the point, not the first.
        assert_eq!(line_ending_before("a\r\nb\nc", 5), Some(LineEnding::Lf));
        assert_eq!(line_ending_before("a\nb\r\nc", 6), Some(LineEnding::Crlf));
        // No break at all, and a break that cannot be written.
        assert_eq!(line_ending_before("abc", 3), None);
        assert_eq!(line_ending_before("a\rb", 3), None);
        // A point before every break sees none.
        assert_eq!(line_ending_before("a\nb", 1), None);
    } // End of function the_line_ending_before_a_point_is_the_last_one_written()

    #[test]
    fn verification_rejects_a_candidate_in_which_a_sibling_changed() {
        // The property a removal rests on: every entry the edit did not name
        // still decodes, key and whole value subtree, to what it decoded to
        // before. Driven directly, because the entry point by construction
        // produces candidates that satisfy it.
        let source = "a: 1\nb: 2\nc:\n  x: 1\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        let mapping = resolve(&index, &DocumentPath::root(0)).expect("resolves");
        let node = index.node(mapping).expect("the root mapping");
        let entries = mapping_entries(node);
        let folded = fold_expectations(
            &index,
            vec![pending_field(
                0,
                DocumentPath::root(0),
                node,
                &entries,
                Some(entries[1].value),
                None,
            )],
            &[],
        )
        .expect("one claim folds");
        let expectation = &folded[0];
        assert_eq!(expectation.entries, 2);

        // The honest candidate.
        let good = SyntaxIndex::parse("a: 1\nc:\n  x: 1\n").expect("parses");
        assert_eq!(
            verify_field("a: 1\nc:\n  x: 1\n", &good, expectation),
            Ok(())
        );

        // A sibling's value changed as well.
        let text = "a: 9\nc:\n  x: 1\n";
        let changed = SyntaxIndex::parse(text).expect("parses");
        assert!(matches!(
            verify_field(text, &changed, expectation),
            Err(VerificationFailure::SiblingChanged { entry: 0, .. })
        ));

        // A sibling's *nested* value changed, which a scalar-only comparison
        // would miss.
        let text = "a: 1\nc:\n  x: 9\n";
        let nested = SyntaxIndex::parse(text).expect("parses");
        assert!(matches!(
            verify_field(text, &nested, expectation),
            Err(VerificationFailure::SiblingChanged { entry: 1, .. })
        ));

        // Two siblings went instead of one.
        let text = "a: 1\n";
        let short = SyntaxIndex::parse(text).expect("parses");
        assert!(matches!(
            verify_field(text, &short, expectation),
            Err(VerificationFailure::EntryCountChanged {
                expected: 2,
                found: 1,
                ..
            })
        ));

        // The entry that should be gone is still there.
        let sneaky = SyntaxIndex::parse(source).expect("parses");
        assert!(matches!(
            verify_field(source, &sneaky, expectation),
            Err(VerificationFailure::EntryCountChanged { .. })
        ));
    } // End of function verification_rejects_a_candidate_in_which_a_sibling_changed()

    #[test]
    fn the_subtree_digest_tells_shapes_apart() {
        // Two mappings that hold the same characters in a different structure
        // must not produce the same digest, or `SiblingChanged` would miss a
        // restructuring.
        let first = SyntaxIndex::parse("a:\n  b: 1\n").expect("parses");
        let second = SyntaxIndex::parse("a:\n  - b\n  - 1\n").expect("parses");
        let root =
            |index: &SyntaxIndex| resolve(index, &DocumentPath::parse("a").unwrap()).unwrap();
        assert_ne!(digest(&first, root(&first)), digest(&second, root(&second)));
        // And the same shape twice produces the same digest.
        let same = SyntaxIndex::parse("a:\n  b: 1\n").expect("parses");
        assert_eq!(digest(&first, root(&first)), digest(&same, root(&same)));
    } // End of function the_subtree_digest_tells_shapes_apart()

    #[test]
    fn a_removal_reports_the_span_it_deleted_and_nothing_else() {
        let source = "a: 1\nb: 2\nc: 3\n";
        let patched = remove_field(source, &DocumentPath::parse("b").unwrap()).expect("applies");
        assert_eq!(patched.replacements().len(), 1);
        assert_eq!(patched.replacements()[0].span.slice(source), Some("b: 2\n"));
        assert_eq!(patched.replacements()[0].text, "");
        // Nothing changed spelling, so nothing is reported.
        assert!(patched.notes().is_empty());
    }

    #[test]
    fn an_insertion_reports_a_zero_width_span_at_the_point_it_wrote() {
        let source = "a: 1\n";
        let patched = insert_field(source, &DocumentPath::root(0), "b", "x").expect("applies");
        assert_eq!(patched.replacements().len(), 1);
        assert!(patched.replacements()[0].span.is_empty());
        assert_eq!(patched.replacements()[0].span.start, source.len());
        assert_eq!(patched.replacements()[0].text, "b: x\n");
        assert!(patched.notes().is_empty());
    }

    #[test]
    fn a_parent_path_is_the_path_minus_its_last_key() {
        assert_eq!(
            parent_path(&DocumentPath::parse("matches[0].replace").unwrap()),
            Some(DocumentPath::parse("matches[0]").unwrap())
        );
        assert_eq!(
            parent_path(&DocumentPath::parse("a").unwrap()),
            Some(DocumentPath::root(0))
        );
        // A root path and one ending in an index name no mapping entry.
        assert_eq!(parent_path(&DocumentPath::root(0)), None);
        assert_eq!(
            parent_path(&DocumentPath::parse("matches[0]").unwrap()),
            None
        );
    }
}

#[cfg(test)]
mod move_tests {
    use super::*;

    /// The three-match document every byte-exact pin below works from.
    const THREE: &str = "matches:\n  - trigger: ':a'\n    replace: 'A'\n  - trigger: ':b'\n    replace: 'B'\n  - trigger: ':c'\n    replace: 'C'\n";

    /// Moves one item of `source` and returns the candidate text.
    fn moved(source: &str, item: usize, after: Option<usize>) -> String {
        let path = DocumentPath::parse(&format!("matches[{item}]")).expect("the path parses");
        move_item(source, &path, after)
            .expect("the move applies")
            .into_text()
    } // End of function moved()

    #[test]
    fn a_move_relocates_the_bytes_and_writes_none_of_its_own() {
        assert_eq!(
            moved(THREE, 2, None),
            "matches:\n  - trigger: ':c'\n    replace: 'C'\n  - trigger: ':a'\n    replace: 'A'\n  - trigger: ':b'\n    replace: 'B'\n"
        );
        assert_eq!(
            moved(THREE, 0, Some(2)),
            "matches:\n  - trigger: ':b'\n    replace: 'B'\n  - trigger: ':c'\n    replace: 'C'\n  - trigger: ':a'\n    replace: 'A'\n"
        );
        // The two replacements are the departure and the arrival, and nothing
        // else: one empty run and one zero-width span.
        let path = DocumentPath::parse("matches[0]").expect("the path parses");
        let patched = move_item(THREE, &path, Some(1)).expect("the move applies");
        assert_eq!(patched.replacements().len(), 2);
        assert!(patched.notes().is_empty(), "a move rewrites no scalar");
    } // End of function a_move_relocates_the_bytes_and_writes_none_of_its_own()

    #[test]
    fn a_move_to_the_front_goes_above_the_first_items_own_leading_comments() {
        // Plan section 6.2's rule 1 gives the comment to the match below it, so
        // the arrival must land above the comment rather than between the two.
        let source = "matches:\n  # about a\n  - trigger: ':a'\n  - trigger: ':b'\n";
        assert_eq!(
            moved(source, 1, None),
            "matches:\n  - trigger: ':b'\n  # about a\n  - trigger: ':a'\n"
        );
    } // End of function a_move_to_the_front_goes_above_the_first_items_own_leading_comments()

    #[test]
    fn a_move_carries_what_the_item_owns_and_leaves_what_the_file_owns() {
        // The inline comment belongs to the value scalar, which is inside the
        // item's subtree, so it travels. The blank-line-separated one belongs to
        // the file, so it stays — and so do the blank runs that give it to the
        // file.
        let source = "matches:\n  - trigger: ':a'\n    replace: 'A'  # inline\n\n  # the file owns this\n\n  - trigger: ':b'\n";
        assert_eq!(
            moved(source, 0, Some(1)),
            "matches:\n\n  # the file owns this\n\n  - trigger: ':b'\n  - trigger: ':a'\n    replace: 'A'  # inline\n"
        );
    } // End of function a_move_carries_what_the_item_owns_and_leaves_what_the_file_owns()

    #[test]
    fn a_move_into_a_crlf_document_writes_the_bytes_it_carried() {
        let source = "matches:\r\n  - trigger: \':a\'\r\n  - trigger: \':b\'\r\n";
        assert_eq!(
            moved(source, 1, None),
            "matches:\r\n  - trigger: \':b\'\r\n  - trigger: \':a\'\r\n"
        );
    } // End of function a_move_into_a_crlf_document_writes_the_bytes_it_carried()

    #[test]
    fn a_move_never_touches_the_bom() {
        let source = "\u{feff}matches:\n  - trigger: ':a'\n  - trigger: ':b'\n";
        let path = DocumentPath::parse("matches[1]").expect("the path parses");
        let patched = move_item(source, &path, None).expect("the move applies");
        assert!(patched.text().starts_with('\u{feff}'));
        for replacement in patched.replacements() {
            assert!(replacement.span.start >= 3, "no move may touch the BOM");
        }
    } // End of function a_move_never_touches_the_bom()

    #[test]
    fn a_move_to_the_end_of_an_unterminated_document_is_refused() {
        // Phase 0c-3b-2a rotated the item's own trailing break to the front here,
        // so that the document kept not ending in one and no byte was created.
        // Its review demonstrated what the byte count hides: the break now
        // terminates the **destination's** previously unterminated last line, a
        // line the move never named, and it may be a CRLF imposed on an LF file.
        // D2p answers this case with a refusal, and so does this crate.
        let source = "matches:\n  - trigger: ':a'\n  - trigger: ':b'";
        let path = DocumentPath::parse("matches[0]").expect("the path parses");
        assert!(matches!(
            move_item(source, &path, Some(1)),
            Err(EditError::MoveWouldTerminateTheFinalLine { .. })
        ));
        // The same document with a final break moves, so what is refused is the
        // missing terminator and nothing else about the request.
        assert_eq!(
            moved(
                "matches:\n  - trigger: ':a'\n  - trigger: ':b'\n",
                0,
                Some(1)
            ),
            "matches:\n  - trigger: ':b'\n  - trigger: ':a'\n"
        );
        // A CRLF item moving to the end of an LF document is the byte shape the
        // review gave, and it is the same refusal.
        let mixed = "matches:\n  - trigger: ':a'\r\n  - trigger: ':b'\n    replace: tail";
        let path = DocumentPath::parse("matches[0]").expect("the path parses");
        assert!(matches!(
            move_item(mixed, &path, Some(1)),
            Err(EditError::MoveWouldTerminateTheFinalLine { .. })
        ));
    } // End of function a_move_to_the_end_of_an_unterminated_document_is_refused()

    #[test]
    fn an_item_that_ends_an_unterminated_document_is_refused_rather_than_terminated() {
        let source = "matches:\n  - trigger: ':a'\n  - trigger: ':b'";
        let path = DocumentPath::parse("matches[1]").expect("the path parses");
        assert!(matches!(
            move_item(source, &path, None),
            Err(EditError::MoveWouldInventALineEnding { .. })
        ));
    } // End of function an_item_that_ends_an_unterminated_document_is_refused_rather_than_terminated()

    #[test]
    fn a_move_that_would_leave_the_item_where_it_is_is_refused() {
        for (item, after) in [(0usize, None), (1, Some(1)), (1, Some(0))] {
            let path = DocumentPath::parse(&format!("matches[{item}]")).expect("parses");
            assert!(
                matches!(
                    move_item(THREE, &path, after),
                    Err(EditError::MoveChangesNothing { .. })
                ),
                "matches[{item}] -> {after:?} leaves the order unchanged"
            );
        } // End of the loop over the three requests that change nothing
        let path = DocumentPath::parse("matches[0]").expect("parses");
        assert!(matches!(
            move_item(THREE, &path, Some(9)),
            Err(EditError::NoSuchDestinationItem { items: 3, .. })
        ));
    } // End of function a_move_that_would_leave_the_item_where_it_is_is_refused()

    #[test]
    fn the_intended_order_is_a_permutation_of_the_original_positions() {
        let expectation = |from: usize, to: usize| MoveExpectation {
            edit: 0,
            sequence: DocumentPath::root(0),
            sequence_id: NodeId::from_index(0),
            item: NodeId::from_index(0),
            from,
            to,
        };
        assert_eq!(expectation(2, 0).order(3), vec![2, 0, 1]);
        assert_eq!(expectation(0, 2).order(3), vec![1, 2, 0]);
        assert_eq!(expectation(1, 2).order(4), vec![0, 2, 1, 3]);
        // A `from` the sequence does not have leaves the order alone, which is
        // the only answer that cannot invent a position.
        assert_eq!(expectation(9, 0).order(3), vec![0, 1, 2]);
    } // End of function the_intended_order_is_a_permutation_of_the_original_positions()

    #[test]
    fn the_line_conservation_check_names_the_line_that_went() {
        // Driven directly, against candidates no planner in this tree produces,
        // for the reason `0c-3b-1-notes.md` gives for the file-comment oracle: a
        // check that has never been shown to fail is not known to be able to.
        let source = "a: 1\nb: 2\n";
        assert_eq!(document_lines_are_conserved(source, "b: 2\na: 1\n"), Ok(()));
        assert!(matches!(
            document_lines_are_conserved(source, "b: 2\na: 1\nc: 3\n"),
            Err(VerificationFailure::DocumentLinesNotConserved { .. })
        ));
        assert!(matches!(
            document_lines_are_conserved(source, "b: 2\n"),
            Err(VerificationFailure::DocumentLinesNotConserved { at: 0 })
        ));
        // A line ending rewritten in place.
        assert!(matches!(
            document_lines_are_conserved("a: 1\r\nb: 2\n", "a: 1\nb: 2\n"),
            Err(VerificationFailure::DocumentLinesNotConserved { .. })
        ));
        // Two line endings **exchanged** between two lines. Phase 0c-3b-2a
        // compared contents and terminators as separate multisets, which accepted
        // this; the pairing was restored when its review made the rotation that
        // needed the separation a refusal.
        assert!(matches!(
            document_lines_are_conserved("a: 1\r\nb: 2\n", "a: 1\nb: 2\r\n"),
            Err(VerificationFailure::DocumentLinesNotConserved { .. })
        ));
        // …and the rotation itself, which no planner performs any more and which
        // the paired comparison therefore refuses.
        assert!(matches!(
            document_lines_are_conserved("a: 1\nb: 2", "b: 2\na: 1"),
            Err(VerificationFailure::DocumentLinesNotConserved { .. })
        ));
    } // End of function the_line_conservation_check_names_the_line_that_went()

    #[test]
    fn the_whole_document_check_sees_a_value_the_move_did_not_name() {
        let source = "matches:\n  - trigger: ':a'\n  - trigger: ':b'\n";
        let original = SyntaxIndex::parse(source).expect("parses");
        let sequence = original
            .nodes()
            .iter()
            .find(|node| node.kind == NodeKind::Sequence)
            .expect("a sequence")
            .id;
        let item = original
            .node(sequence)
            .expect("the sequence")
            .children
            .get(1)
            .copied()
            .expect("a second item");
        let relocation = MoveExpectation {
            edit: 0,
            sequence: DocumentPath::parse("matches").expect("parses"),
            sequence_id: sequence,
            item,
            from: 1,
            to: 0,
        };
        let honest = "matches:\n  - trigger: ':b'\n  - trigger: ':a'\n";
        let candidate = SyntaxIndex::parse(honest).expect("parses");
        assert_eq!(
            constructs_outside_the_move_are_unchanged(&original, &candidate, &relocation),
            Ok(())
        );
        assert_eq!(
            items_are_in_the_intended_order(&original, &candidate, &relocation),
            Ok(())
        );

        // The same permutation with one untouched value changed.
        let tampered = "matches:\n  - trigger: ':b'\n  - trigger: ':A'\n";
        let candidate = SyntaxIndex::parse(tampered).expect("parses");
        assert!(matches!(
            constructs_outside_the_move_are_unchanged(&original, &candidate, &relocation),
            Err(VerificationFailure::ConstructChangedOutsideTheMove { .. })
        ));
        // …and the permutation not performed at all.
        let candidate = SyntaxIndex::parse(source).expect("parses");
        assert!(matches!(
            items_are_in_the_intended_order(&original, &candidate, &relocation),
            Err(VerificationFailure::ItemsNotInTheIntendedOrder { position: 0, .. })
        ));
    } // End of function the_whole_document_check_sees_a_value_the_move_did_not_name()

    #[test]
    fn a_move_must_be_the_only_edit_in_its_batch() {
        let relocation: DocumentEdit =
            ItemMove::after(DocumentPath::parse("matches[0]").unwrap(), 2).into();
        let scalar: DocumentEdit = ScalarEdit::new(
            DocumentPath::parse("matches[1].replace").unwrap(),
            "changed",
        )
        .into();
        assert!(apply_edits(THREE, std::slice::from_ref(&relocation)).is_ok());
        assert!(matches!(
            apply_edits(THREE, &[relocation, scalar]),
            Err(EditError::MoveMustBeTheOnlyEditInItsBatch { edits: 2, .. })
        ));
    } // End of function a_move_must_be_the_only_edit_in_its_batch()

    #[test]
    fn a_path_that_names_no_sequence_item_is_refused_by_name() {
        for path in ["matches", "matches[0].trigger"] {
            let parsed = DocumentPath::parse(path).expect("parses");
            assert!(
                matches!(
                    move_item(THREE, &parsed, Some(1)),
                    Err(EditError::NotASequenceItem { .. })
                ),
                "{path} names no sequence item"
            );
        } // End of the loop over the paths that name no sequence item
    } // End of function a_path_that_names_no_sequence_item_is_refused_by_name()

    // -----------------------------------------------------------------------
    // The engine broken on purpose, retained
    // -----------------------------------------------------------------------
    //
    // `docs/decisions/0c-3b-2a-notes.md` section 6.2 records five experiments in
    // which the **engine** was made to misbehave and every layer left in place, to
    // measure whether the layers can disagree with it at all. They were documented
    // history: the repository could not reproduce them, and the Phase 0c-3b-2a
    // review's finding 4 is that documented history is not a test.
    //
    // These are those experiments, retained. Each drives the **complete**
    // post-planning pipeline — disjointness, the structural guards, the splice and
    // `verify` in full — over a plan a defective planner could have produced, and
    // asserts the typed failure that catches it. The mutations the review added
    // are here too, and they are the important ones: a *permutation-preserving*
    // rewrite alters no multiset count, which is the case C1 and C2 do not cover.

    /// The runs a planned move deletes, in ascending order.
    fn runs_of(planned: &PlannedEdit) -> Vec<ByteSpan> {
        planned
            .replacements
            .iter()
            .filter(|replacement| replacement.text.is_empty())
            .map(|replacement| replacement.span)
            .collect()
    } // End of function runs_of()

    /// Rewrites a planned move as if its envelope had been `runs` all along.
    ///
    /// The arrival becomes the concatenation of the new runs and the guard is told
    /// about them, so the only thing wrong with the plan is the **run set itself**.
    /// A mutation that left the guard behind would be caught by the guard for the
    /// wrong reason and would prove nothing about the rest of the pipeline.
    fn recarve(source: &str, planned: &mut PlannedEdit, runs: Vec<ByteSpan>) {
        let carried: String = runs
            .iter()
            .map(|run| run.slice(source).expect("a run slices"))
            .collect();
        let arrival = planned
            .replacements
            .iter()
            .find(|replacement| !replacement.text.is_empty())
            .map(|replacement| replacement.span)
            .expect("a move writes its bytes once");
        planned.replacements = runs
            .iter()
            .map(|run| Replacement {
                span: *run,
                text: String::new(),
            })
            .collect();
        planned.replacements.push(Replacement {
            span: arrival,
            text: carried,
        });
        planned.permitted = runs.clone();
        planned.permitted.push(arrival);
        for guard in &mut planned.guards {
            if let StructuralGuard::Removal { runs: guarded, .. } = guard {
                *guarded = runs.clone();
            }
        } // End of the loop that tells the removal guard about the new runs
    } // End of function recarve()

    /// Plans a move, lets `tamper` rewrite the plan, and runs everything
    /// [`apply_edits`] runs afterwards.
    ///
    /// Deliberately not a wrapper over `apply_edits`: the point is to inject a
    /// plan no planner in this tree produces and then subject it to the **whole**
    /// safety boundary — the disjointness check, both structural guards, the
    /// splice and all ten verification properties — rather than to a chosen one.
    fn tampered_move(
        source: &str,
        item: usize,
        after: Option<usize>,
        tamper: impl FnOnce(&str, &mut PlannedEdit),
    ) -> Result<String, EditError> {
        let index = SyntaxIndex::parse(source).expect("the document parses");
        let trivia = TriviaIndex::scan(source, &index);
        let path = DocumentPath::parse(&format!("matches[{item}]")).expect("the path parses");
        let request = match after {
            None => ItemMove::to_front(path),
            Some(anchor) => ItemMove::after(path, anchor),
        };
        let mut planned = plan_move(source, &index, &trivia, 0, &request)?;
        tamper(source, &mut planned);
        planned
            .replacements
            .sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
        for pair in planned.replacements.windows(2) {
            if pair[0].span.end > pair[1].span.start || pair[0].span.start == pair[1].span.start {
                return Err(EditError::OverlappingEdits {
                    first: pair[0].span,
                    second: pair[1].span,
                });
            }
        } // End of the loop that checks the tampered replacements are disjoint
        for guard in &planned.guards {
            guard.check(source, &index, &trivia)?;
        }
        let candidate = splice(source, &planned.replacements);
        let moves: Vec<MoveExpectation> = planned.moved.into_iter().collect();
        verify(
            source,
            &candidate,
            &planned.replacements,
            &planned.permitted,
            Expected {
                index: &index,
                trivia: &trivia,
                edits: &[],
                fields: &[],
                items: &[],
                moves: &moves,
            },
        )?;
        Ok(candidate)
    } // End of function tampered_move()

    /// Rewrites the arrival's text with `rewrite`, leaving the runs alone.
    fn rewrite_arrival(planned: &mut PlannedEdit, rewrite: impl Fn(&str) -> String) {
        for replacement in &mut planned.replacements {
            if !replacement.text.is_empty() {
                replacement.text = rewrite(&replacement.text);
            }
        } // End of the loop that finds the one replacement a move writes
    } // End of function rewrite_arrival()

    /// The document the review's own counterexample uses: two carried comment
    /// lines that a defective planner can swap without changing anything a
    /// multiset, a digest or a tree can see.
    const TWO_COMMENTS: &str = "matches:\n  - trigger: ':a'\n    # first\n    # second\n    replace: x\n  - trigger: ':b'\n    replace: y\n";

    #[test]
    fn a_planner_that_permutes_the_carried_lines_is_rejected() {
        // **The Phase 0c-3b-2a review's headline counterexample.** Line contents
        // and terminators are the same multisets, the item digests are unchanged
        // because a digest holds no comments, the reparsed tree is identical,
        // neither comment is file-owned, and `bytes_outside_the_replacements_match`
        // authorises whatever insertion text the planner supplied. Before this
        // phase's fix round nothing in production said no.
        let swapped = tampered_move(TWO_COMMENTS, 0, Some(1), |_, planned| {
            rewrite_arrival(planned, |text| {
                text.replace("    # first\n    # second\n", "    # second\n    # first\n")
            });
        });
        assert!(
            matches!(
                swapped,
                Err(EditError::Verification(
                    VerificationFailure::MovedBytesWereRewritten { .. }
                ))
            ),
            "a swap of two carried comment lines must be refused, got {swapped:?}"
        );
        // The honest move applies, so what is refused is the swap and not the
        // request.
        assert!(tampered_move(TWO_COMMENTS, 0, Some(1), |_, _| {}).is_ok());
    } // End of function a_planner_that_permutes_the_carried_lines_is_rejected()

    #[test]
    fn every_other_move_property_certifies_the_permuted_candidate() {
        // Why the property above had to be added rather than argued for: the four
        // whole-document properties are run here **against the corrupted
        // candidate** and every one of them passes. An oracle that cannot disagree
        // is not an oracle, and this is the measurement rather than the claim.
        let source = TWO_COMMENTS;
        let original = SyntaxIndex::parse(source).expect("parses");
        let trivia = TriviaIndex::scan(source, &original);
        let sequence = original
            .nodes()
            .iter()
            .find(|node| node.kind == NodeKind::Sequence)
            .expect("a sequence");
        let relocation = MoveExpectation {
            edit: 0,
            sequence: DocumentPath::parse("matches").expect("parses"),
            sequence_id: sequence.id,
            item: sequence.children[0],
            from: 0,
            to: 1,
        };
        let corrupt = "matches:\n  - trigger: ':b'\n    replace: y\n  - trigger: ':a'\n    # second\n    # first\n    replace: x\n";
        let candidate = SyntaxIndex::parse(corrupt).expect("parses");
        let candidate_trivia = TriviaIndex::scan(corrupt, &candidate);
        assert_eq!(document_lines_are_conserved(source, corrupt), Ok(()));
        assert_eq!(
            items_are_in_the_intended_order(&original, &candidate, &relocation),
            Ok(())
        );
        assert_eq!(
            constructs_outside_the_move_are_unchanged(&original, &candidate, &relocation),
            Ok(())
        );
        assert_eq!(
            file_comments_survive(source, corrupt, &candidate, &trivia),
            Ok(())
        );
        assert_eq!(
            comment_ownership_survives(source, corrupt, &trivia, &candidate_trivia, &relocation),
            Ok(())
        );
    } // End of function every_other_move_property_certifies_the_permuted_candidate()

    #[test]
    fn experiment_c1_an_engine_that_tidies_the_bytes_it_carries_is_rejected() {
        // C1: trim trailing whitespace from each carried line, which is what an
        // editor does by default. The two real spaces after `':a'` are the
        // byte-fidelity shape of the Phase 0c-2b review's finding 1.
        let source = "matches:\n  - trigger: ':a'  \n  - trigger: ':b'\n";
        let tidied = tampered_move(source, 0, Some(1), |_, planned| {
            rewrite_arrival(planned, |text| text.replace("a'  \n", "a'\n"));
        });
        assert!(
            matches!(
                tidied,
                Err(EditError::Verification(
                    VerificationFailure::MovedBytesWereRewritten { .. }
                ))
            ),
            "a tidied carried line must be refused, got {tidied:?}"
        );
    } // End of function experiment_c1_an_engine_that_tidies_the_bytes_it_carries_is_rejected()

    #[test]
    fn experiment_c2_an_engine_that_votes_on_a_line_ending_is_rejected() {
        // C2: copy the destination's line ending onto every carried line, which is
        // precisely what D2p forbids. The carried CRLF becomes LF and the document
        // still parses, still holds the intended order and still decodes the same.
        let source = "matches:\n  - trigger: ':a'\r\n  - trigger: ':b'\n";
        let voted = tampered_move(source, 0, Some(1), |_, planned| {
            rewrite_arrival(planned, |text| text.replace("\r\n", "\n"));
        });
        assert!(
            matches!(
                voted,
                Err(EditError::Verification(
                    VerificationFailure::MovedBytesWereRewritten { .. }
                ))
            ),
            "a rewritten line ending must be refused, got {voted:?}"
        );
        // The review's second variant: the terminators are **exchanged** rather
        // than rewritten, so their multiset is unchanged. The paired line
        // comparison is what sees this one, and the byte comparison sees it first.
        let two = "matches:\n  - trigger: ':a'\r\n    replace: x\n  - trigger: ':b'\n";
        let exchanged = tampered_move(two, 0, Some(1), |_, planned| {
            rewrite_arrival(planned, |text| {
                text.replace("':a'\r\n", "':a'\n").replace("x\n", "x\r\n")
            });
        });
        assert!(
            matches!(
                exchanged,
                Err(EditError::Verification(
                    VerificationFailure::MovedBytesWereRewritten { .. }
                ))
            ),
            "exchanged terminators must be refused, got {exchanged:?}"
        );
    } // End of function experiment_c2_an_engine_that_votes_on_a_line_ending_is_rejected()

    #[test]
    fn a_blank_line_shuffled_between_two_strip_chomped_blocks_is_rejected() {
        // The review's third variant. Both blocks are `|-`, so the number of blank
        // lines after each is invisible to every decoded value; the blank lines are
        // byte-identical, so the line multiset is unchanged; and no comment is
        // involved, so ownership is unchanged. Only the byte comparison sees it.
        let source = "matches:\n  - trigger: ':a'\n    first: |-\n      one\n\n\n    second: |-\n      two\n\n    third: '3'\n  - trigger: ':b'\n    replace: 'y'\n";
        let shuffled = tampered_move(source, 0, Some(1), |_, planned| {
            rewrite_arrival(planned, |text| {
                text.replace("one\n\n\n", "one\n\n")
                    .replace("two\n\n", "two\n\n\n")
            });
        });
        assert!(
            matches!(
                shuffled,
                Err(EditError::Verification(
                    VerificationFailure::MovedBytesWereRewritten { .. }
                ))
            ),
            "a relocated blank line must be refused, got {shuffled:?}"
        );
    } // End of function a_blank_line_shuffled_between_two_strip_chomped_blocks_is_rejected()

    #[test]
    fn experiment_c4_an_engine_that_leaves_a_token_behind_is_rejected_by_the_guard() {
        // C4: shorten the first run so the item's first token stays where it was.
        // Caught before a byte is spliced, by the half of `StructuralGuard::Removal`
        // that Phase 0c-3b-1 added — the one a contiguous hull made unstatable.
        let source = "matches:\n  - trigger: ':a'\n  - trigger: ':b'\n";
        let clipped = tampered_move(source, 0, Some(1), |source, planned| {
            let mut runs = runs_of(planned);
            runs[0].start += 8;
            recarve(source, planned, runs);
        });
        assert!(
            matches!(
                clipped,
                Err(EditError::Verification(
                    VerificationFailure::EnvelopeMissesTheEntry { .. }
                ))
            ),
            "an envelope that leaves a token behind must be refused, got {clipped:?}"
        );
    } // End of function experiment_c4_an_engine_that_leaves_a_token_behind_is_rejected_by_the_guard()

    #[test]
    fn experiment_c5_an_engine_that_carries_one_blank_line_too_many_is_rejected() {
        // **C5, and the experiment that changed this crate twice.** An extra
        // *blank* line reaches no node, so the guard cannot see it; it is relocated
        // rather than created, so line conservation cannot; it holds no value, so
        // the tree walk cannot; and the arrival really is the departure, so the
        // byte comparison cannot either. Phase 0c-3b-2a caught it only in the
        // external sweep's hull bound, which its review named as a production hole.
        // `MoveCarriesMoreThanTheItem` is that bound, in production, derived
        // textually from the item's own lines.
        let source = "matches:\n  - trigger: ':a'\n\n  - trigger: ':b'\n  - trigger: ':c'\n";
        let greedy = tampered_move(source, 0, Some(2), |source, planned| {
            let mut runs = runs_of(planned);
            let last = runs.len() - 1;
            runs[last].end = line_end_of(source, runs[last].end);
            recarve(source, planned, runs);
        });
        assert!(
            matches!(
                greedy,
                Err(EditError::Verification(
                    VerificationFailure::MoveCarriesMoreThanTheItem { .. }
                ))
            ),
            "carrying one blank line too many must be refused, got {greedy:?}"
        );
        // …and the same plan without the extra line applies, so the bound is not
        // simply refusing the request.
        assert!(tampered_move(source, 0, Some(2), |_, _| {}).is_ok());
    } // End of function experiment_c5_an_engine_that_carries_one_blank_line_too_many_is_rejected()

    #[test]
    fn an_engine_that_relocates_a_comments_ownership_blank_line_is_rejected() {
        // The review's fourth variant, and the one the byte comparison cannot make:
        // the blank line **below** a file-owned comment is what rule 2 reads to give
        // that comment to the file. Swallow it into the envelope and write it back
        // at the destination and every byte is accounted for — the arrival is still
        // the departure, the lines are still conserved, the tree is still identical
        // and the comment's text is still in the candidate — but the comment now
        // leads the match that ended up underneath it.
        let source = "matches:\n  - trigger: ':a'\n    first: 1\n\n    # the file owns this\n\n    second: 2\n  - trigger: ':b'\n";
        let reattributed = tampered_move(source, 0, Some(1), |source, planned| {
            let mut runs = runs_of(planned);
            assert_eq!(runs.len(), 2, "the file comment must split the envelope");
            // The second run starts after the blank line under the comment. Start
            // it one line earlier, so that line travels with the match.
            runs[1].start = line_start_of(source, runs[1].start - 1, 0);
            recarve(source, planned, runs);
        });
        assert!(
            matches!(
                reattributed,
                Err(EditError::Verification(
                    VerificationFailure::CommentOwnershipChanged { .. }
                ))
            ),
            "a re-attributed comment must be refused, got {reattributed:?}"
        );
    } // End of function an_engine_that_relocates_a_comments_ownership_blank_line_is_rejected()

    #[test]
    fn a_document_is_split_into_physical_lines_with_their_own_terminators() {
        assert_eq!(
            physical_lines("a\r\nb\nc"),
            vec![(0, "a", "\r\n"), (3, "b", "\n"), (5, "c", "")]
        );
        assert_eq!(physical_lines(""), Vec::new());
        assert_eq!(physical_lines("\n"), vec![(0, "", "\n")]);
    } // End of function a_document_is_split_into_physical_lines_with_their_own_terminators()
}
