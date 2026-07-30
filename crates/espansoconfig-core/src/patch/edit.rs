//! Applying an edit — the first code in this crate that mutates a document.
//!
//! # The contract
//!
//! [`apply_scalar_edits`] is the **only** way to obtain a [`PatchedDocument`],
//! and a `PatchedDocument` only exists once the candidate text has been
//! reparsed and verified. There is deliberately no constructor, no `text`
//! field and no "unchecked" variant: a caller that holds one is holding bytes
//! that passed every check in `verify`, and a caller that holds an
//! [`EditError`] is holding no bytes at all.
//!
//! The four rules of `IMPLEMENTATION_PLAN.md` section 6.2, and where each one
//! lives:
//!
//! | Rule | Here |
//! |---|---|
//! | the smallest safe edit | one scalar's header and content spans, never its mapping |
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
//! [`apply_scalar_edits`] takes the *source text* rather than a pre-scanned
//! [`TriviaIndex`]: there is no argument a caller can get wrong, and no way to
//! pass an index that says something different from the document being edited.
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
//! # What is *not* here
//!
//! Structural edits — inserting or removing a field, moving a match — are step
//! 0c-3. The batch shape of [`apply_scalar_edits`] exists so that they can join
//! it without changing the entry point: the offset-ordering, overlap and
//! verification machinery is written once, for a list of replacements, rather
//! than once per edit kind.

use std::fmt;

use crate::emit::{
    decode, preserve_scalar, reencode_in_place, DecodeError, NotReencodable, ScalarContext,
    ScalarPlan,
};
use crate::patch::path::{resolve, resolve_full, DocumentPath, PathError};
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
    let index = SyntaxIndex::parse(source).map_err(EditError::SourceDoesNotParse)?;
    let trivia = TriviaIndex::scan(source, &index);

    let mut replacements = Vec::new();
    let mut permitted = Vec::new();
    let mut notes = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let planned = plan_one(source, &index, &trivia, position, edit)?;
        replacements.extend(planned.replacements);
        permitted.extend(planned.permitted);
        if let Some(note) = planned.note {
            notes.push(note);
        }
    } // End of the loop that plans every requested edit

    replacements.sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
    for pair in replacements.windows(2) {
        if pair[0].span.end > pair[1].span.start {
            return Err(EditError::OverlappingEdits {
                first: pair[0].span,
                second: pair[1].span,
            });
        }
    } // End of the loop that checks the replacements are disjoint

    let candidate = splice(source, &replacements);
    verify(source, &candidate, &replacements, &permitted, edits)?;
    Ok(PatchedDocument {
        text: candidate,
        replacements,
        notes,
    })
} // End of function apply_scalar_edits()

/// One edit resolved down to the bytes it writes.
struct PlannedEdit {
    /// The spans it replaces, and with what.
    replacements: Vec<Replacement>,
    /// The spans the edited scalar owns, from [`permitted_spans`]. Every
    /// replacement must lie wholly inside one of them.
    permitted: Vec<ByteSpan>,
    /// A presentation change worth telling the user about.
    note: Option<PresentationNote>,
}

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
    Ok(PlannedEdit {
        replacements,
        permitted: permitted_spans(node, presentation),
        note,
    })
} // End of function plan_one()

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
/// - **the line ending**, taken from the block's *own* body when its breaks are
///   consistent and from the document otherwise. A file may legitimately mix
///   endings, and rewriting a body's `\n` as `\r\n` because the rest of the
///   file uses CRLF would change bytes for no reason.
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
/// Four properties, all of them required by plan section 6.2 and none of them
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
///    from the replacement list, so an off-by-one in `splice` cannot hide.
///
/// What this still cannot catch is recorded in
/// `docs/decisions/0c-2b-notes.md` section 7.
///
/// # Errors
///
/// See [`VerificationFailure`]. Every one of them discards the candidate.
fn verify(
    source: &str,
    candidate: &str,
    replacements: &[Replacement],
    permitted: &[ByteSpan],
    edits: &[ScalarEdit],
) -> Result<(), VerificationFailure> {
    replacements_stay_inside_the_permitted_spans(replacements, permitted)?;
    bytes_outside_the_replacements_match(source, candidate, replacements)?;
    let index = SyntaxIndex::parse(candidate).map_err(VerificationFailure::DoesNotParse)?;

    for (position, edit) in edits.iter().enumerate() {
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

    Ok(())
} // End of function verify()

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
        let edits = [ScalarEdit::new(DocumentPath::parse("a").unwrap(), "two")];
        let token = [ByteSpan::new(3, 6)];
        let replacements = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "two".to_owned(),
        }];
        assert_eq!(
            verify(source, "a: two\n", &replacements, &token, &edits),
            Ok(())
        );

        // Invalid YAML.
        let broken = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "\"unclosed".to_owned(),
        }];
        assert!(matches!(
            verify(source, "a: \"unclosed\n", &broken, &token, &edits),
            Err(VerificationFailure::DoesNotParse(_))
        ));

        // Valid YAML that holds the wrong value.
        let wrong = vec![Replacement {
            span: ByteSpan::new(3, 6),
            text: "three".to_owned(),
        }];
        assert!(matches!(
            verify(source, "a: three\n", &wrong, &token, &edits),
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
            verify(source, "a: [one]\n", &restructured, &token, &edits),
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
