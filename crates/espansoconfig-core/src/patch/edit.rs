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
//! # What is *not* here
//!
//! Moving a whole match, the multiset invariant a move needs, and the full R9
//! round-trip property test are step 0c-3b-2.

use std::fmt;

use crate::emit::{
    choose_scalar, decode, preserve_scalar, reencode_in_place, DecodeError, NotReencodable,
    ScalarContext, ScalarPlan,
};
use crate::patch::path::{resolve, resolve_full, DocumentPath, PathError, PathSegment};
use crate::syntax::{
    ByteSpan, CollectionStyle, HazardKind, Node, NodeId, NodeKind, ScalarPresentation, ScalarStyle,
    SyntaxError, SyntaxIndex, TriviaIndex,
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
#[derive(Debug, Clone, PartialEq, Eq)]
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
#[derive(Debug, Clone, PartialEq, Eq)]
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
    /// The candidate document failed verification and was discarded.
    Verification(VerificationFailure),
}

/// Why a candidate document was rejected after being reparsed.
///
/// Local patching is never trusted on its own (plan section 6.2). Every variant
/// here means the splice produced something other than what was asked for, and
/// **every one of them discards the candidate**: there is no code path from a
/// verification failure to bytes a caller could write.
#[derive(Debug, Clone, PartialEq, Eq)]
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
    let mut guards = Vec::new();
    let mut rewritten = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let planned = match edit {
            DocumentEdit::Scalar(scalar) => plan_one(source, &index, &trivia, position, scalar)?,
            DocumentEdit::InsertField(insert) => {
                plan_insertion(source, &index, &trivia, position, insert)?
            }
            DocumentEdit::RemoveField(removal) => {
                plan_removal(source, &index, &trivia, position, removal)?
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
        if let Some(guard) = planned.guard {
            guards.push(guard);
        }
        if let Some(node) = planned.rewritten {
            rewritten.push(node);
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
        guard.check(&index)?;
    }
    let expectations = fold_expectations(&index, expectations, &rewritten)?;

    let candidate = splice(source, &replacements);
    verify(
        source,
        &candidate,
        &replacements,
        &permitted,
        edits,
        &expectations,
        &trivia,
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
    /// A check on the planned span, stated in terms of the **original** index.
    guard: Option<StructuralGuard>,
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
enum StructuralGuard {
    /// A removal envelope, with the entry's own subtree it is allowed to cover.
    Removal {
        /// The ordered, disjoint runs the removal deletes.
        runs: Vec<ByteSpan>,
        /// The key and value node of the entry being removed.
        entry: (NodeId, NodeId),
    },
    /// An insertion point, which must lie between nodes and not inside one.
    Insertion {
        /// The offset the new entry is spliced at.
        at: usize,
    },
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
    /// of one of the entry's own tokens behind; and
    /// [`VerificationFailure::InsertionPointInsideANode`] when an insertion
    /// point falls strictly inside a node's span.
    fn check(&self, index: &SyntaxIndex) -> Result<(), VerificationFailure> {
        match self {
            StructuralGuard::Removal { runs, entry } => {
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
        guard: None,
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
        guard: Some(StructuralGuard::Insertion { at: point }),
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
        guard: Some(StructuralGuard::Removal {
            runs,
            entry: (key, resolved.value),
        }),
        rewritten: None,
    })
} // End of function plan_removal()

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

/// The column of the first non-blank line among the regions a removal preserves.
///
/// `preserved` is [`preserved_regions`]'s answer, so it is ordered, disjoint and
/// made of whole lines. The first non-blank line it holds is the line that ends up
/// directly under whatever precedes the envelope, because every byte between the
/// two is deleted — which is why one column answers the question for the whole
/// preserved set: a line shallower than the block's body column ends the block,
/// and nothing after it can rejoin one.
///
/// `None` when every preserved byte is blank, which `preserved_regions` cannot
/// produce: a region exists only for a comment line.
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
/// What this still cannot catch is recorded in
/// `docs/decisions/0c-2b-notes.md` section 7 and
/// `docs/decisions/0c-3a-notes.md` section 7.4.
///
/// # Errors
///
/// See [`VerificationFailure`]. Every one of them discards the candidate.
fn verify(
    source: &str,
    candidate: &str,
    replacements: &[Replacement],
    permitted: &[ByteSpan],
    edits: &[DocumentEdit],
    expectations: &[FieldExpectation],
    trivia: &TriviaIndex,
) -> Result<(), VerificationFailure> {
    replacements_stay_inside_the_permitted_spans(replacements, permitted)?;
    bytes_outside_the_replacements_match(source, candidate, replacements)?;
    let index = SyntaxIndex::parse(candidate).map_err(VerificationFailure::DoesNotParse)?;
    file_comments_survive(source, candidate, &index, trivia)?;

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
                &edits,
                &[],
                &trivia
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
                &edits,
                &[],
                &trivia
            ),
            Err(VerificationFailure::DoesNotParse(_))
        ));

        // Valid YAML that holds the wrong value.
        let wrong = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "three".to_owned(),
        }];
        assert!(matches!(
            verify(source, "a: three\n", &wrong, &token, &edits, &[], &trivia),
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
                &edits,
                &[],
                &trivia
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
                entry
            }
            .check(&index),
            Ok(())
        );

        // One entry too long: the same span extended over `c: 3`.
        let greedy = ByteSpan::new(honest.start, source.len());
        assert!(matches!(
            StructuralGuard::Removal {
                runs: vec![greedy],
                entry
            }
            .check(&index),
            Err(VerificationFailure::EnvelopeCoversAnotherNode { .. })
        ));

        // And the two halves of the guard are independent, which is why the
        // second exists: a run set that touches nothing outside the entry can
        // still fail to cover it. The empty set is the extreme case; a set that
        // punched a token out is the reachable one.
        assert!(matches!(
            StructuralGuard::Removal {
                runs: Vec::new(),
                entry
            }
            .check(&index),
            Err(VerificationFailure::EnvelopeMissesTheEntry { .. })
        ));
        let clipped = ByteSpan::new(honest.start, honest.end - 2);
        assert!(matches!(
            StructuralGuard::Removal {
                runs: vec![clipped],
                entry
            }
            .check(&index),
            Err(VerificationFailure::EnvelopeMissesTheEntry { .. })
        ));
    } // End of function the_removal_guard_refuses_an_envelope_that_reaches_into_a_neighbour()

    #[test]
    fn the_insertion_guard_refuses_a_point_inside_a_node() {
        let source = "a: hello\nb: 2\n";
        let index = SyntaxIndex::parse(source).expect("parses");
        // Between the two lines: legal, although it is inside the root mapping
        // and inside the document, which is what "between two entries" means.
        assert_eq!(StructuralGuard::Insertion { at: 9 }.check(&index), Ok(()));
        // Inside the scalar `hello`: not.
        assert!(matches!(
            StructuralGuard::Insertion { at: 5 }.check(&index),
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
