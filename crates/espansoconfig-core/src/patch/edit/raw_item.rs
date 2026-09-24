//! The local raw-item edit: one sequence item's owned range, read and replaced
//! as exact text (Phase 3-7).
//!
//! # What it is, and what it is not
//!
//! The per-snippet escape hatch the Phase 3 design consult rules on (Q4,
//! `docs/decisions/3-split-notes.md` rulings 11 and 12). Rust derives the
//! snippet's **owned physical-line range** — its leading comment block, its
//! dash, every line of its subtree and each line's own terminator — and hands
//! that range out as text ([`item_owned_text`]). A caller sends back exact
//! replacement text for **the same range** ([`ItemTextReplacement`]), and the
//! engine writes it there and nowhere else.
//!
//! **It is not `SaveContent::ReplaceText` scrolled to the snippet**, and nothing
//! here borrows that mode's vocabulary. It is a [`DocumentEdit`] like every
//! other locality-preserving edit: planned against the original index, spliced,
//! reparsed and verified inside [`super::apply_edits`], so a `PatchedDocument`
//! holding one has passed every check below. The frontend never supplies an
//! offset: the range is re-derived from the document under the save lock, and
//! the base revision is what makes it the range the text was read from.
//!
//! # The range is the lift's range, and it must be one run
//!
//! The range is [`super::carve_envelope`] over the item's subtree extent — the
//! derivation a move's lift, a removal and a true duplicate already share — so
//! there is no second notion of what a snippet owns. When the ownership rules
//! give a comment **inside** that hull to the file, the envelope is several runs
//! with file-owned holes between them, and concatenating them into one text box
//! would invent a mapping between old and new text. That shape is refused by
//! name ([`EditError::ItemRangeNotContiguous`]) on the read and on the edit
//! alike, so a caller can offer the whole-document editor instead (ruling 11).
//!
//! # A carriage return in the range is refused, on both sides
//!
//! Ruling 12 applies the `\r` refusal to **the snippet's owned text only**: a
//! CR elsewhere in the document does not disqualify an LF-only snippet. Both
//! entry points refuse a range holding a `\r`
//! ([`EditError::ItemTextHoldsCarriageReturn`]) — the read, so no text box is
//! ever filled with one, and the edit, so a request built some other way cannot
//! write through one — and the edit refuses replacement text holding one too.
//! Nothing here normalizes, re-indents or reconstructs submitted text.
//!
//! # What is refused before a byte moves
//!
//! - a batch holding anything else ([`EditError::ItemTextMustBeTheOnlyEditInItsBatch`]);
//! - everything [`super::editable_sequence_item`] refuses — the move's own gate,
//!   hazards anywhere in the sequence and flow sequences included;
//! - a range with holes, and a `\r` on either side;
//! - text that drops the line break the range ends with, when bytes follow it
//!   ([`EditError::ItemTextLosesItsFinalLineBreak`]);
//! - a content line left of the item's dash column
//!   ([`EditError::ItemTextEscapesItsIndentation`]) — the escaped-indentation
//!   refusal, stated over the submitted text;
//! - the **opening seam**: the text's first non-blank line landing under a
//!   block scalar that ends directly above the range, deep enough to become its
//!   content ([`EditError::ItemTextWouldExtendABlockScalar`]).
//!
//! # What the candidate must satisfy
//!
//! Every property is read off the reparsed candidate or re-derived from the
//! original text, never taken from the planner:
//!
//! 1. the one replacement lies inside the permitted range, and every byte
//!    outside it is identical — the BOM included;
//! 2. the range equals, as a single run, what `entry_owned_runs` derives from the
//!    text independently of the envelope
//!    ([`VerificationFailure::ItemTextRangeNotOwned`]);
//! 3. the candidate parses ([`VerificationFailure::DoesNotParse`]) — a snippet
//!    whose result does not parse is **not** saved through this edit (ruling 12);
//!    the whole-document editor, with its content-addressed consent, stays the
//!    repair route;
//! 4. every file-owned comment survives;
//! 5. the sequence holds exactly as many items as before
//!    ([`VerificationFailure::ItemTextIsNotOneItem`] — zero items or two), and
//!    the one in the item's slot is a mapping
//!    ([`VerificationFailure::ItemTextIsNotAMapping`]);
//! 6. **no construct outside the item changed**: the two parses are walked in
//!    lockstep with the item's slot skipped, and kinds, decoded values and child
//!    counts must agree everywhere else
//!    ([`VerificationFailure::ConstructChangedOutsideTheItemText`]) — a changed
//!    sibling, whether another match or a key beside `matches`;
//! 7. the **closing seam** and the escape, stated as ownership: the new item's
//!    own lines end inside the written text and its owned runs start inside it
//!    ([`VerificationFailure::ItemTextExtendsPastItsRange`] — a block scalar at
//!    the end of the text that swallowed the line below it fails here), and the
//!    runs the new item owns are exactly the written text
//!    ([`VerificationFailure::ItemTextEscapesTheItem`] — a trailing blank line or
//!    a column-zero comment the file would own fails here);
//! 8. every comment outside the range keeps its place, its text and its owner's
//!    side of the item boundary ([`VerificationFailure::CommentOwnershipChanged`]);
//! 9. the candidate's sequence raises no hazard
//!    ([`VerificationFailure::ItemTextIntroducesAHazard`]) — an anchor written
//!    into the item could re-bind an alias elsewhere, which no value comparison
//!    of an alias node can see;
//! 10. no new YAML 1.1-ambiguous plain scalar **outside** the new item.
//!
//! # What may change, and what may not
//!
//! **Inside the range, anything the author writes**, unknown entries and
//! unsupported constructs included: the guarantee concerns the surrounding
//! document, not the fields of the authored replacement (the consult's Q4). No
//! field whitelist applies. The one exemption that follows from that is
//! property 10's: an ambiguous plain scalar the author wrote inside the item is
//! the author's text rather than an emitter's choice, so it is not charged — the
//! same stance the whole-document editor takes, and a narrower one, because
//! everything outside the item is still charged. Outside the range nothing
//! changes, and properties 1 and 6 are what say so.

use super::{
    block_absorbing_a_line, bytes_outside_the_replacements_match, carve_envelope, column_of,
    editable_sequence_item, entry_owned_runs, file_comment_inside, file_comments_survive,
    in_subtree, item_own_lines, no_ambiguous_plain_scalar_is_introduced,
    replacements_stay_inside_the_permitted_spans, resolve, splice, ByteSpan, DocumentPath,
    EditError, EnvelopeKind, NodeId, NodeKind, PatchedDocument, Replacement, StructuralGuard,
    SyntaxIndex, TriviaIndex, VerificationFailure,
};
use serde::Serialize;

/// Replace one sequence item's owned physical-line range with exact text.
///
/// The request carries **no offset**: the range is derived by the engine from
/// the document it is applied to, exactly as [`item_owned_text`] derived it for
/// the read. What makes the two derivations describe the same bytes is the
/// save transaction's base-revision check, not anything in this type.
///
/// It must be the only edit in its batch
/// ([`EditError::ItemTextMustBeTheOnlyEditInItsBatch`]): its verification is the
/// original document with one range replaced, and nothing else in a batch is
/// modelled by that.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemTextReplacement {
    /// The sequence item whose range is replaced, addressed as
    /// `sequence[index]` — the path shape [`super::RemoveItem`] takes.
    item: DocumentPath,
    /// The exact text the range is to hold afterwards.
    text: String,
}

impl ItemTextReplacement {
    /// Builds a replacement of the range of the item `item` names by `text`.
    pub fn new(item: DocumentPath, text: impl Into<String>) -> ItemTextReplacement {
        ItemTextReplacement {
            item,
            text: text.into(),
        }
    }

    /// The sequence item whose range is replaced.
    pub fn item(&self) -> &DocumentPath {
        &self.item
    }

    /// The exact replacement text.
    pub fn text(&self) -> &str {
        &self.text
    }
} // End of impl ItemTextReplacement

/// One snippet's owned range, cut in Rust and handed out as text.
///
/// **The only producer is [`item_owned_text`]**, so every value is a contiguous,
/// `\r`-free range of one parse. It carries no byte offset on purpose: a
/// position does not survive a revision boundary, and the edit re-derives the
/// range itself. The two line numbers are display data for a caller that wants
/// to say where the range sits; nothing reads them back.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OwnedItemText {
    /// The range's exact text: leading comment block, dash, every line of the
    /// item and each line's own terminator. Valid UTF-8 by construction, since
    /// it is sliced from a `&str` at line boundaries.
    pub text: String,
    /// The physical line the range starts on, one-based.
    pub first_line: usize,
    /// How many physical lines the range covers.
    pub line_count: usize,
}

/// The range one item owns, and what the planner needs to know about it.
struct OwnedRange {
    /// The block sequence, by its own path, for re-resolution in the candidate.
    sequence: DocumentPath,
    /// How many items the sequence held.
    items: usize,
    /// The item in the **original** index.
    item: NodeId,
    /// Its position in the sequence.
    index: usize,
    /// The contiguous owned range.
    span: ByteSpan,
    /// The column of the item's `-`.
    dash_column: usize,
}

/// Derives one item's owned range, or refuses it — the read and the edit share
/// this call, so they cannot disagree about which bytes a snippet owns.
///
/// The steps, in order:
///
/// 1. [`editable_sequence_item`] — the move's own gate, in the move's own order;
/// 2. [`carve_envelope`] over the item's subtree extent — the lift's range,
///    below the refusals whose premise is deletion (nothing is deleted here that
///    is not written back);
/// 3. one run, and no file-owned comment inside it — otherwise
///    [`EditError::ItemRangeNotContiguous`], naming the first hole;
/// 4. no `\r` in the range ([`EditError::ItemTextHoldsCarriageReturn`]);
/// 5. the dash column, read off the range's first line that is neither blank
///    nor a comment.
///
/// # Errors
///
/// Everything [`editable_sequence_item`] and [`carve_envelope`] refuse, plus the
/// two refusals above, and [`EditError::MalformedSpan`] for a range with no
/// content line, which a document the substrate accepted cannot produce.
fn owned_range(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    path: &DocumentPath,
) -> Result<OwnedRange, EditError> {
    let target = editable_sequence_item(index, trivia, position, path)?;
    let extent = trivia.subtree_extent(index, target.item);
    let envelope = carve_envelope(source, index, trivia, position, extent)?;
    if envelope.runs.len() != 1 {
        return Err(EditError::ItemRangeNotContiguous {
            edit: position,
            hole: ByteSpan::new(envelope.runs[0].end, envelope.runs[1].start),
        });
    }
    let span = envelope.runs[0];
    // The punch-out arithmetic is not its own witness: a file-owned comment
    // still inside the one run is a hole the carving missed, and it is refused
    // under the same name rather than handed to a text box.
    if let Some(comment) = file_comment_inside(trivia, span) {
        return Err(EditError::ItemRangeNotContiguous {
            edit: position,
            hole: comment,
        });
    }
    let text = span.slice(source).ok_or(EditError::MalformedSpan {
        edit: position,
        at: span,
    })?;
    if text.contains('\r') {
        return Err(EditError::ItemTextHoldsCarriageReturn { edit: position });
    }
    let body_offset = index.preamble().body_offset;
    let mut cursor = span.start;
    let mut dash_column = None;
    for line in text.split_inclusive('\n') {
        let body = line.trim_start_matches([' ', '\t']);
        if !body.trim_end().is_empty() && !body.starts_with('#') {
            dash_column = Some(column_of(
                source,
                cursor + (line.len() - body.len()),
                body_offset,
            ));
            break;
        }
        cursor += line.len();
    } // End of the loop that finds the range's first content line
    let dash_column = dash_column.ok_or(EditError::MalformedSpan {
        edit: position,
        at: span,
    })?;
    Ok(OwnedRange {
        sequence: target.path,
        items: target.sequence.children.len(),
        item: target.item,
        index: target.index,
        span,
        dash_column,
    })
} // End of function owned_range()

/// Cuts one snippet's owned range out of `source`, as text.
///
/// **The read half of the local raw edit.** The range is exactly the one an
/// [`ItemTextReplacement`] of the same item replaces in the same document, and
/// it is refused for exactly the same reasons: a range with file-owned holes is
/// [`EditError::ItemRangeNotContiguous`], which a caller answers by offering the
/// whole-document editor, and a range holding a `\r` is
/// [`EditError::ItemTextHoldsCarriageReturn`]. Every refusal carries `edit: 0`,
/// the position a one-edit batch would give it.
///
/// # Errors
///
/// [`EditError::SourceDoesNotParse`], and every refusal of the range derivation
/// described on the module.
pub fn item_owned_text(source: &str, item: &DocumentPath) -> Result<OwnedItemText, EditError> {
    let index = SyntaxIndex::parse(source).map_err(EditError::SourceDoesNotParse)?;
    let trivia = TriviaIndex::scan(source, &index);
    let range = owned_range(source, &index, &trivia, 0, item)?;
    let text = range.span.slice(source).ok_or(EditError::MalformedSpan {
        edit: 0,
        at: range.span,
    })?;
    let before = source.get(..range.span.start).unwrap_or_default();
    Ok(OwnedItemText {
        text: text.to_owned(),
        first_line: 1 + line_breaks(before),
        line_count: physical_line_count(text),
    })
} // End of function item_owned_text()

/// How many line breaks `text` holds, a `\r\n` counting once.
fn line_breaks(text: &str) -> usize {
    let bytes = text.as_bytes();
    let mut count = 0usize;
    for (at, byte) in bytes.iter().enumerate() {
        match byte {
            b'\n' => count += 1,
            b'\r' if bytes.get(at + 1) != Some(&b'\n') => count += 1,
            _ => {}
        }
    } // End of the loop over the bytes
    count
} // End of function line_breaks()

/// How many physical lines `text` covers: one per break, plus an unterminated
/// tail.
fn physical_line_count(text: &str) -> usize {
    let breaks = line_breaks(text);
    if text.is_empty() || text.ends_with(['\n', '\r']) {
        breaks
    } else {
        breaks + 1
    }
} // End of function physical_line_count()

/// What verification needs from the planner, beside the replacement itself.
struct ItemTextExpectation<'a> {
    /// Position of the edit in the batch.
    edit: usize,
    /// The planned range.
    range: &'a OwnedRange,
    /// The span the written text occupies in the **candidate**.
    written: ByteSpan,
}

/// Plans, splices and verifies one [`ItemTextReplacement`].
///
/// Called by [`super::apply_edits`] once it has established the replacement is
/// the only edit in its batch, with the index and trivia it already built for
/// `source`.
///
/// # Errors
///
/// The planning refusals and the verification failures listed on the module.
pub(super) fn apply_item_text(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &ItemTextReplacement,
) -> Result<PatchedDocument, EditError> {
    let range = owned_range(source, index, trivia, position, edit.item())?;
    let text = edit.text();
    check_the_submitted_text(source, index, &range, position, text)?;

    // The range is pinned against the original index's node spans exactly as a
    // duplicate's copied set is: it touches no node outside the item but its
    // ancestors, and it covers every token of the item. `CarriesTheItem`, because
    // the textual bound is stated by `verify_item_text` under this edit's own name.
    StructuralGuard::Removal {
        runs: vec![range.span],
        entry: (range.item, range.item),
        kind: EnvelopeKind::CarriesTheItem,
    }
    .check(source, index, trivia)?;

    let replacements = vec![Replacement {
        span: range.span,
        text: text.to_owned(),
    }];
    let candidate = splice(source, &replacements);
    let expectation = ItemTextExpectation {
        edit: position,
        range: &range,
        written: ByteSpan::new(range.span.start, range.span.start + text.len()),
    };
    verify_item_text(
        source,
        index,
        trivia,
        &candidate,
        &replacements,
        &expectation,
    )?;
    Ok(PatchedDocument {
        text: candidate,
        replacements,
        notes: Vec::new(),
    })
} // End of function apply_item_text()

/// The planning-time refusals of the submitted text, in order.
///
/// # Errors
///
/// [`EditError::ItemTextHoldsCarriageReturn`],
/// [`EditError::ItemTextLosesItsFinalLineBreak`],
/// [`EditError::ItemTextEscapesItsIndentation`] and
/// [`EditError::ItemTextWouldExtendABlockScalar`].
fn check_the_submitted_text(
    source: &str,
    index: &SyntaxIndex,
    range: &OwnedRange,
    position: usize,
    text: &str,
) -> Result<(), EditError> {
    if text.contains('\r') {
        return Err(EditError::ItemTextHoldsCarriageReturn { edit: position });
    }
    // An empty text is a request for zero items, and that is verification's to
    // name; a break it drops is a join with the next line, which is this one's.
    if !text.is_empty() && range.span.end < source.len() && !text.ends_with('\n') {
        return Err(EditError::ItemTextLosesItsFinalLineBreak { edit: position });
    }
    let mut first_column = None;
    for (line, content) in text.split_inclusive('\n').enumerate() {
        let body = content.trim_start_matches([' ', '\t']);
        if body.trim_end().is_empty() {
            continue;
        }
        let column = content.len() - body.len();
        first_column.get_or_insert(column);
        // A comment line is exempt here: whether the item or the file owns it is
        // the ownership layer's answer, asked of the candidate by verification.
        if !body.starts_with('#') && column < range.dash_column {
            return Err(EditError::ItemTextEscapesItsIndentation {
                edit: position,
                line,
            });
        }
    } // End of the loop over the submitted text's lines

    // The opening seam: what the text's first non-blank line comes to sit under.
    // The columns above count bytes of leading blanks, which is what
    // `column_of` counts for an ASCII indentation — the only indentation YAML has.
    if let Some(column) = first_column {
        if let Some(block) = block_absorbing_a_line(source, index, range.span.start, column) {
            return Err(EditError::ItemTextWouldExtendABlockScalar {
                edit: position,
                block,
            });
        }
    }
    Ok(())
} // End of function check_the_submitted_text()

/// Reparses the candidate and checks everything the module lists.
///
/// # Errors
///
/// See the module's *What the candidate must satisfy*.
fn verify_item_text(
    source: &str,
    original: &SyntaxIndex,
    trivia: &TriviaIndex,
    candidate: &str,
    replacements: &[Replacement],
    expectation: &ItemTextExpectation<'_>,
) -> Result<(), VerificationFailure> {
    let edit = expectation.edit;
    let range = expectation.range;

    // 1. Locality, stated over the replacement list rather than over `splice`.
    replacements_stay_inside_the_permitted_spans(replacements, &[range.span])?;
    bytes_outside_the_replacements_match(source, candidate, replacements)?;

    // 2. The range is what the text says the item owns, derived without the
    //    envelope.
    let (_, owned) = entry_owned_runs(source, original, trivia, range.item, range.item).ok_or(
        VerificationFailure::ItemTextRangeNotOwned {
            edit,
            at: range.span,
        },
    )?;
    if owned != [range.span] {
        let at = owned
            .iter()
            .find(|run| **run != range.span)
            .copied()
            .unwrap_or(range.span);
        return Err(VerificationFailure::ItemTextRangeNotOwned { edit, at });
    }

    // 3 and 4. It parses, and the file's own comments are all still there.
    let index = SyntaxIndex::parse(candidate).map_err(VerificationFailure::DoesNotParse)?;
    file_comments_survive(source, candidate, &index, trivia)?;

    // 5. Exactly one item in the slot, and a mapping.
    let sequence = resolve(&index, &range.sequence)
        .ok()
        .and_then(|id| index.node(id))
        .filter(|node| node.kind == NodeKind::Sequence);
    let found = sequence.map_or(0, |node| node.children.len());
    let Some(sequence) = sequence.filter(|_| found == range.items) else {
        return Err(VerificationFailure::ItemTextIsNotOneItem {
            edit,
            expected: range.items,
            found,
        });
    };
    let written_item = sequence.children[range.index];
    let kind = index
        .node(written_item)
        .map_or(NodeKind::Document, |node| node.kind);
    if kind != NodeKind::Mapping {
        return Err(VerificationFailure::ItemTextIsNotAMapping { edit, kind });
    }

    // 6. Nothing outside the item says anything else now.
    constructs_outside_the_item_are_unchanged(original, &index, range.item, written_item)
        .map_err(|node| VerificationFailure::ConstructChangedOutsideTheItemText { edit, node })?;

    // 7. The closing seam, and the escape: the new item owns exactly the text.
    //    The item's own lines may not end past the text — a block scalar that
    //    swallowed the line below does exactly that — and the runs it owns may
    //    not start above it. Its hull may legitimately start above the text when
    //    a file-owned comment sits directly over the range, because the runs
    //    punch that comment out again, exactly as they did in the original.
    let body_offset = index.preamble().body_offset;
    let lines = item_own_lines(candidate, &index, written_item, body_offset).ok_or(
        VerificationFailure::ItemTextEscapesTheItem {
            edit,
            at: expectation.written,
        },
    )?;
    if lines.end > expectation.written.end {
        return Err(VerificationFailure::ItemTextExtendsPastItsRange { edit, at: lines });
    }
    // Scanned once, and only here: the scan is quadratic (`PROGRESS.md`, R19).
    let candidate_trivia = TriviaIndex::scan(candidate, &index);
    let (_, written_runs) = entry_owned_runs(
        candidate,
        &index,
        &candidate_trivia,
        written_item,
        written_item,
    )
    .ok_or(VerificationFailure::ItemTextEscapesTheItem {
        edit,
        at: expectation.written,
    })?;
    if let Some(first) = written_runs.first() {
        if first.start < expectation.written.start {
            return Err(VerificationFailure::ItemTextExtendsPastItsRange { edit, at: *first });
        }
    }
    if written_runs != [expectation.written] {
        let at = written_runs
            .iter()
            .find(|run| **run != expectation.written)
            .copied()
            .unwrap_or(expectation.written);
        return Err(VerificationFailure::ItemTextEscapesTheItem { edit, at });
    }

    // 8. Every comment outside the range kept its place and its owner's side.
    comments_outside_the_item_keep_their_owners(
        source,
        candidate,
        (original, trivia, range.item),
        (&index, &candidate_trivia, written_item),
        expectation,
    )?;

    // 9. No hazard in the sequence the edit changed.
    if let Some(hazard) = candidate_trivia.disqualifying_hazard(&index, sequence.id) {
        return Err(VerificationFailure::ItemTextIntroducesAHazard {
            edit,
            hazard: hazard.kind,
        });
    }

    // 10. No new ambiguous plain scalar outside the author's own text.
    no_ambiguous_plain_scalar_is_introduced(original, &index, &[], &[written_item])?;
    Ok(())
} // End of function verify_item_text()

/// Walks the two parses in lockstep from every document root, skipping the
/// item's own slot.
///
/// The raw edit's form of [`super::lockstep_documents`]: kinds, collection
/// styles, decoded scalar values and child counts must agree at every node, positionally, except that
/// the original item and the candidate's item in the same slot are not
/// compared at all — their contents are the author's to change. Returns the
/// **candidate** node at which the two first disagree.
fn constructs_outside_the_item_are_unchanged(
    original: &SyntaxIndex,
    candidate: &SyntaxIndex,
    item: NodeId,
    written: NodeId,
) -> Result<(), NodeId> {
    let documents = original.documents();
    let others = candidate.documents();
    if documents.len() != others.len() {
        return Err(*others.first().unwrap_or(&written));
    }
    for (before, after) in documents.iter().zip(others) {
        compare_outside(original, *before, candidate, *after, item, written)?;
    } // End of the loop over the documents of the two parses
    Ok(())
} // End of function constructs_outside_the_item_are_unchanged()

/// Compares two subtrees node for node, positionally, skipping the item.
///
/// Returns the candidate node at which they first disagree.
fn compare_outside(
    original: &SyntaxIndex,
    before: NodeId,
    candidate: &SyntaxIndex,
    after: NodeId,
    item: NodeId,
    written: NodeId,
) -> Result<(), NodeId> {
    // The slot is the item's on both sides or on neither, and the sequence's
    // child count was compared before this walk ran.
    if before == item || after == written {
        return if before == item && after == written {
            Ok(())
        } else {
            Err(after)
        };
    }
    let (Some(was), Some(now)) = (original.node(before), candidate.node(after)) else {
        return Err(after);
    };
    // The collection style is compared too: rewriting the item as a flow
    // sequence keeps kinds, counts and values but restyles the parent.
    if was.kind != now.kind
        || was.collection_style != now.collection_style
        || was.children.len() != now.children.len()
    {
        return Err(after);
    }
    match (was.scalar.as_ref(), now.scalar.as_ref()) {
        (Some(was), Some(now)) if was.value != now.value => return Err(after),
        (Some(_), None) | (None, Some(_)) => return Err(after),
        _ => {}
    }
    for (child_before, child_after) in was.children.iter().zip(&now.children) {
        compare_outside(
            original,
            *child_before,
            candidate,
            *child_after,
            item,
            written,
        )?;
    } // End of the loop over the children, position for position
    Ok(())
} // End of function compare_outside()

/// Checks that every comment outside the range kept its offset, its text and
/// its owner's side of the item boundary.
///
/// Each side lists the comments **outside** its own range — the original's
/// replaced range, the candidate's written text — as `(offset, text, is the
/// file's, is the item's)`, with the candidate's offsets past the written text
/// shifted back by the length difference. The two lists must be equal. A
/// comment the new item took from above or below, or one a neighbour gained
/// from the file, differs in one of the two flags; one that appeared or
/// vanished differs in length.
///
/// # Errors
///
/// [`VerificationFailure::CommentOwnershipChanged`], carrying the original
/// offset of the first comment that disagrees — never its text.
fn comments_outside_the_item_keep_their_owners(
    source: &str,
    candidate: &str,
    (original, trivia, item): (&SyntaxIndex, &TriviaIndex, NodeId),
    (index, candidate_trivia, written): (&SyntaxIndex, &TriviaIndex, NodeId),
    expectation: &ItemTextExpectation<'_>,
) -> Result<(), VerificationFailure> {
    let range = expectation.range.span;
    let written_span = expectation.written;
    let outside = |at: ByteSpan, span: ByteSpan| at.end <= span.start || at.start >= span.end;
    let before: Vec<(usize, &str, bool, bool)> = trivia
        .comments()
        .iter()
        .filter(|comment| outside(comment.span, range))
        .map(|comment| {
            (
                comment.span.start,
                comment.span.slice(source).unwrap_or_default(),
                comment.owner.is_file(),
                comment
                    .owner
                    .node()
                    .is_some_and(|owner| in_subtree(original, item, owner)),
            )
        })
        .collect();
    let after: Vec<(usize, &str, bool, bool)> = candidate_trivia
        .comments()
        .iter()
        .filter(|comment| outside(comment.span, written_span))
        .map(|comment| {
            let start = if comment.span.start >= written_span.end {
                comment.span.start - written_span.end + range.end
            } else {
                comment.span.start
            };
            (
                start,
                comment.span.slice(candidate).unwrap_or_default(),
                comment.owner.is_file(),
                comment
                    .owner
                    .node()
                    .is_some_and(|owner| in_subtree(index, written, owner)),
            )
        })
        .collect();
    if before == after {
        return Ok(());
    }
    let at = before
        .iter()
        .zip(&after)
        .find(|(was, now)| was != now)
        .map_or_else(
            || before.get(after.len()).map_or(range.end, |was| was.0),
            |(was, _)| was.0,
        );
    Err(VerificationFailure::CommentOwnershipChanged {
        edit: expectation.edit,
        at,
    })
} // End of function comments_outside_the_item_keep_their_owners()
