//! Item insertion and removal inside a **flow** list of scalars (Phase 3-3).
//!
//! `triggers: [":a", ":b"]` has no line per item to add or delete, so a
//! cardinality edit there is a question about commas, spacing and comments. This
//! module handles it in place, and **never by converting presentation**: a flow
//! list stays a flow list (ruling 5), and every byte outside the replacements
//! below — every retained item token included — comes out identical.
//!
//! # Which lists
//!
//! [`flow_scalar_list`] admits a bracket-delimited sequence that is not itself
//! inside a flow collection and whose items are all scalars (`[]` included).
//! Anything else keeps the refusals it had before this phase
//! ([`EditError::FlowCollection`] for a removal,
//! [`EditError::FlowSequenceInsertionUnsupported`] for an insertion).
//!
//! # The hazard gate, narrowed for exactly this edit
//!
//! A comment inside a flow collection raises
//! [`HazardKind::CommentInFlowCollection`] on that collection, and every other
//! edit keeps refusing it (`PROGRESS.md`, R6). These two edits consult the gate
//! **minus that one hazard on this one list** ([`flow_list_hazard`]) and replace
//! it with a narrower rule of their own, stated here and enforced by
//! [`analyse`]:
//!
//! - a comment on the **opening bracket's line**, before the first item,
//!   belongs to the list and is never touched;
//! - a comment on the line where an item ends, after that item's comma (or
//!   after the item itself, for the last one), belongs to **that item** —
//!   provided no other item shares the line;
//! - everything else is [`EditError::FlowListTriviaAmbiguous`]: a comment on a
//!   line of its own inside the brackets, a comment on a line two items share,
//!   and a comma that is not on the line of the item it follows (which is also
//!   how "a comment between an item and its comma" arrives, since a comment
//!   runs to the end of its line).
//!
//! The rule is global to the list: one ambiguous comment refuses every
//! cardinality edit of that list, whether or not the edit would touch it.
//!
//! # The two layouts
//!
//! A list whose every item **starts its own line** is laid out one item per
//! line, and an edit there adds or deletes whole lines, copying an existing
//! item's indentation and the line break that ends the anchor's line. Any other
//! list is laid out **inline**, and an edit adds or deletes a token together
//! with one separator, copying the list's own first single-line separator
//! (`, ` when the list has none to copy). New items are spelled by
//! [`choose_scalar`] in flow context, which always quotes — so `,`, `[`, `]`,
//! `{`, `}` and `#` can never end a new item early, and no YAML
//! 1.1-ambiguous plain scalar is ever written.
//!
//! # Removal, and why it reads the whole batch
//!
//! An item followed by a surviving item is removed **with the separator after
//! it**; an item with no survivor after it — the last item, and every item of a
//! run of removals reaching the end — **with the separator before it**, so the
//! list keeps or keeps lacking its trailing comma. Which of the two an item takes
//! depends on which other items the same batch removes, so the planner reads the
//! batch's other [`RemoveItem`]s of the same list ([`removed_indices`]); the
//! runs of adjacent removals then abut rather than overlap.

use super::{
    choose_scalar, containing_path, is_ancestor, is_inside_a_flow_collection, resolve_full,
    ByteSpan, CollectionStyle, DocumentEdit, EditError, HazardKind, ItemPlacement, NewItem, Node,
    NodeId, NodeKind, PendingItem, PlannedEdit, Punctuation, RemoveItem, Replacement,
    ScalarContext, ScalarItemInsert, StructuralGuard, SyntaxIndex, TriviaIndex, TriviaKind,
    VerificationFailure,
};
use crate::syntax::Hazard;

/// The separator written when the list has none of its own to copy.
const DEFAULT_SEPARATOR: &str = ", ";

/// The flow scalar list `node` names, when it is one these edits handle.
///
/// A bracket-delimited sequence, not inside another flow collection, whose
/// every item is a scalar. `None` for everything else, which keeps the
/// refusals it had before Phase 3-3.
pub(super) fn flow_scalar_list(index: &SyntaxIndex, node: NodeId) -> Option<&Node> {
    let sequence = index.node(node)?;
    let is_flow = sequence.kind == NodeKind::Sequence
        && sequence.collection_style == Some(CollectionStyle::Flow)
        && !is_inside_a_flow_collection(index, sequence);
    let scalars = sequence.children.iter().all(|child| {
        index
            .node(*child)
            .is_some_and(|item| item.kind == NodeKind::Scalar && item.scalar.is_some())
    });
    (is_flow && scalars).then_some(sequence)
} // End of function flow_scalar_list()

/// The flow scalar list that holds the item `path` names, when there is one.
pub(super) fn flow_list_of_item<'index>(
    index: &'index SyntaxIndex,
    edit: &RemoveItem,
) -> Option<&'index Node> {
    let resolved = resolve_full(index, edit.item()).ok()?;
    flow_scalar_list(index, resolved.parent?)
}

/// The hazard that refuses a cardinality edit of this flow list, or `None`.
///
/// [`TriviaIndex::disqualifying_hazard`] with **one** exception: a
/// [`HazardKind::CommentInFlowCollection`] raised on this very list, whose
/// comments [`analyse`] places by the module's own rule instead. A hazard with
/// no node still refuses the whole document first, and every other hazard on
/// the list, an ancestor or a descendant still refuses.
fn flow_list_hazard<'trivia>(
    index: &SyntaxIndex,
    trivia: &'trivia TriviaIndex,
    sequence: NodeId,
) -> Option<&'trivia Hazard> {
    let hazards = trivia.hazards();
    if let Some(orphan) = hazards.iter().find(|hazard| hazard.node.is_none()) {
        return Some(orphan);
    }
    hazards.iter().find(|hazard| {
        let own_comment =
            hazard.kind == HazardKind::CommentInFlowCollection && hazard.node == Some(sequence);
        !own_comment
            && hazard.node.is_some_and(|flagged| {
                flagged == sequence
                    || is_ancestor(index, flagged, sequence)
                    || is_ancestor(index, sequence, flagged)
            })
    })
} // End of function flow_list_hazard()

/// The gate, asked about the list, answered as an [`EditError::Refused`].
fn ask_the_gate(
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    sequence: NodeId,
) -> Result<(), EditError> {
    match flow_list_hazard(index, trivia, sequence) {
        Some(hazard) => Err(EditError::Refused {
            edit: position,
            node: sequence,
            hazard: hazard.kind,
            at: hazard.span,
        }),
        None => Ok(()),
    }
} // End of function ask_the_gate()

/// The bytes between two neighbours of a flow list, as the lexer classified them.
#[derive(Debug, Clone, Copy)]
struct Gap {
    /// The whole gap.
    span: ByteSpan,
    /// Its comma, when it has one.
    comma: Option<ByteSpan>,
    /// Its first line break, when it spans lines.
    first_break: Option<ByteSpan>,
    /// The comment on its first line, when there is one.
    comment: Option<ByteSpan>,
}

/// A flow list of scalars, taken apart into tokens and gaps.
///
/// `gaps[0]` lies between `[` and the first item, `gaps[i]` between item
/// `i - 1` and item `i`, and `gaps[n]` between the last item and `]`. An empty
/// list has one gap, the whole interior.
struct FlowList {
    /// The sequence node.
    sequence: NodeId,
    /// Offset of `[`.
    open: usize,
    /// Offset of `]`.
    close: usize,
    /// Every item's node and token span, in order.
    items: Vec<(NodeId, ByteSpan)>,
    /// `items.len() + 1` gaps, or one for an empty list.
    gaps: Vec<Gap>,
}

impl FlowList {
    /// How many items the list holds.
    fn len(&self) -> usize {
        self.items.len()
    }

    /// Item `at`'s token span.
    fn token(&self, at: usize) -> ByteSpan {
        self.items[at].1
    }

    /// The gap after item `at`.
    fn after(&self, at: usize) -> Gap {
        self.gaps[at + 1]
    }
} // End of impl FlowList

/// Start of the physical line holding `at`.
fn line_start(source: &str, at: usize) -> usize {
    source[..at]
        .rfind(['\n', '\r'])
        .map_or(0, |offset| offset + 1)
}

/// Whether item `at` begins its line: only spaces and tabs before it.
fn starts_its_line(source: &str, list: &FlowList, at: usize) -> bool {
    let start = list.token(at).start;
    source[line_start(source, start)..start]
        .chars()
        .all(|character| character == ' ' || character == '\t')
}

/// Whether item `at` is laid out on a line of its own: it starts its line and
/// the gap after it breaks the line.
fn owns_its_line(source: &str, list: &FlowList, at: usize) -> bool {
    starts_its_line(source, list, at) && list.after(at).first_break.is_some()
}

/// The whole physical line of an item that [`owns_its_line`]: from its line
/// start through the first line break after it, that break included.
fn item_line(source: &str, list: &FlowList, at: usize) -> Option<ByteSpan> {
    let first_break = list.after(at).first_break?;
    Some(ByteSpan::new(
        line_start(source, list.token(at).start),
        first_break.end,
    ))
}

/// Takes a flow list apart and checks it against the module's placement rule.
///
/// # Errors
///
/// [`EditError::FlowListLayoutUnsupported`] for brackets the span does not
/// frame, an item spanning lines, gap bytes the lexer did not classify as
/// spacing, breaks, comments or commas, a wrong number of commas, and an empty
/// list whose interior holds anything but spaces; and
/// [`EditError::FlowListTriviaAmbiguous`] for every comment or comma the rule
/// cannot place (the module documentation).
fn analyse(
    source: &str,
    trivia: &TriviaIndex,
    index: &SyntaxIndex,
    position: usize,
    sequence: &Node,
) -> Result<FlowList, EditError> {
    let unsupported = EditError::FlowListLayoutUnsupported {
        edit: position,
        sequence: sequence.id,
    };
    let (open, close) = (sequence.span.start, sequence.span.end.saturating_sub(1));
    if sequence.span.end <= sequence.span.start
        || source.as_bytes().get(open) != Some(&b'[')
        || source.as_bytes().get(close) != Some(&b']')
    {
        return Err(unsupported);
    }
    let mut items = Vec::new();
    for child in &sequence.children {
        let node = index.node(*child).ok_or(unsupported.clone())?;
        if source[node.span.start..node.span.end].contains(['\n', '\r']) {
            return Err(unsupported);
        }
        items.push((node.id, node.span));
    } // End of the loop over the list's items

    // The gaps, as spans: after `[`, between neighbours, and before `]`.
    let mut bounds = vec![open + 1];
    for (_, token) in &items {
        bounds.push(token.start);
        bounds.push(token.end);
    }
    bounds.push(close);
    let mut gaps = Vec::new();
    for pair in bounds.chunks(2) {
        let gap =
            classify_gap(trivia, ByteSpan::new(pair[0], pair[1])).map_err(
                |problem| match problem {
                    GapProblem::Unclassified => unsupported.clone(),
                    GapProblem::Ambiguous(at) => EditError::FlowListTriviaAmbiguous {
                        edit: position,
                        sequence: sequence.id,
                        at,
                    },
                },
            )?;
        gaps.push(gap);
    } // End of the loop that classifies every gap

    let list = FlowList {
        sequence: sequence.id,
        open,
        close,
        items,
        gaps,
    };
    check_placements(source, &list, position, &unsupported)?;
    Ok(list)
} // End of function analyse()

/// Why [`classify_gap`] could not describe a gap.
enum GapProblem {
    /// Bytes the lexer did not classify as spacing, breaks, comments or
    /// commas, or more than one comma.
    Unclassified,
    /// A comment on a line of its own, or a comma off its item's line.
    Ambiguous(ByteSpan),
}

/// Classifies one gap from the lexer's own items, which must tile it.
fn classify_gap(trivia: &TriviaIndex, span: ByteSpan) -> Result<Gap, GapProblem> {
    let mut gap = Gap {
        span,
        comma: None,
        first_break: None,
        comment: None,
    };
    let mut cursor = span.start;
    let mut commas = 0usize;
    let mut comments_after_the_break = None;
    for item in trivia
        .items()
        .iter()
        .filter(|item| item.span.start >= span.start && item.span.end <= span.end)
    {
        if item.span.start != cursor {
            return Err(GapProblem::Unclassified);
        }
        cursor = item.span.end;
        match item.kind {
            TriviaKind::Spacing | TriviaKind::Indentation => {}
            TriviaKind::LineBreak | TriviaKind::BlankLine => {
                if gap.first_break.is_none() {
                    gap.first_break = Some(item.span);
                }
            }
            TriviaKind::Comment if gap.first_break.is_none() => gap.comment = Some(item.span),
            TriviaKind::Comment => {
                comments_after_the_break.get_or_insert(item.span);
            }
            TriviaKind::Punctuation(Punctuation::Comma) => {
                commas += 1;
                // A comma after the gap's first break is not on the line of the
                // item it follows; a later one is caught by the count.
                if gap.first_break.is_some() {
                    return Err(GapProblem::Ambiguous(item.span));
                }
                gap.comma = Some(item.span);
            }
            _ => return Err(GapProblem::Unclassified),
        } // End of the match over what the lexer found
    } // End of the loop over the gap's trivia items
    if cursor != span.end || commas > 1 {
        return Err(GapProblem::Unclassified);
    }
    if let Some(comment) = comments_after_the_break {
        // A comment on a line of its own inside the brackets.
        return Err(GapProblem::Ambiguous(comment));
    }
    Ok(gap)
} // End of function classify_gap()

/// Checks commas and comments against the placement rule, across gaps.
fn check_placements(
    source: &str,
    list: &FlowList,
    position: usize,
    unsupported: &EditError,
) -> Result<(), EditError> {
    let ambiguous = |at: ByteSpan| EditError::FlowListTriviaAmbiguous {
        edit: position,
        sequence: list.sequence,
        at,
    };
    let count = list.len();
    if count == 0 {
        // An empty list is written on one line and holds only spaces.
        let interior = &source[list.open + 1..list.close];
        let only_spaces = interior
            .chars()
            .all(|character| character == ' ' || character == '\t');
        return if only_spaces {
            Ok(())
        } else {
            Err(unsupported.clone())
        };
    }
    for (at, gap) in list.gaps.iter().enumerate() {
        let wants_comma = at > 0 && at < count;
        if (at == 0 && gap.comma.is_some()) || (wants_comma && gap.comma.is_none()) {
            return Err(unsupported.clone());
        }
        // A comment on the first line of a gap after an item belongs to that
        // item, and only while no other item shares the item's line.
        if let Some(comment) = gap.comment {
            let shared = at >= 2 && list.gaps[at - 1].first_break.is_none();
            if at > 0 && shared {
                return Err(ambiguous(comment));
            }
        }
    } // End of the loop over the list's gaps
    Ok(())
} // End of function check_placements()

/// Takes the list apart after asking the gate, naming every refusal.
fn open_the_list(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    sequence: &Node,
) -> Result<FlowList, EditError> {
    ask_the_gate(index, trivia, position, sequence.id)?;
    analyse(source, trivia, index, position, sequence)
}

/// The original indices of every item of `sequence` the batch removes.
///
/// Read off the batch's [`RemoveItem`]s, each resolved against the original
/// index, so two spellings of one item's path count once. Sorted.
fn removed_indices(index: &SyntaxIndex, edits: &[DocumentEdit], sequence: &Node) -> Vec<usize> {
    let mut removed: Vec<usize> = edits
        .iter()
        .filter_map(|edit| match edit {
            DocumentEdit::RemoveItem(removal) => resolve_full(index, removal.item()).ok(),
            _ => None,
        })
        .filter(|resolved| resolved.parent == Some(sequence.id))
        .filter_map(|resolved| {
            sequence
                .children
                .iter()
                .position(|child| *child == resolved.value)
        })
        .collect();
    removed.sort_unstable();
    removed.dedup();
    removed
} // End of function removed_indices()

/// Plans the removal of one item of a flow scalar list, or refuses it.
///
/// The order is [`super::plan_item_removal`]'s: address the item, **ask the
/// gate** (narrowed as the module documentation states), establish that the list
/// has an item to spare ([`EditError::RemovalWouldEmptyTheSequence`]), take the
/// list apart, then derive the runs.
///
/// # The runs
///
/// With a surviving item after it, the item goes with the separator after it —
/// its whole line when it [`owns_its_line`], otherwise its token through the
/// next item's first byte (or that item's line start, when the next item is
/// itself removed by its line). With none, it goes with the separator before it:
/// by lines when every item of that trailing run owns its line — the first of
/// them then also deleting the comma it leaves dangling, unless the list keeps a
/// trailing comma — and otherwise from the previous item's last byte through its
/// own. An item's own comment goes with it; a comment the rule gives a survivor
/// never does ([`EditError::FlowListTriviaAmbiguous`] when a run would have to
/// take one).
pub(super) fn plan_flow_removal(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &RemoveItem,
    sequence: &Node,
    edits: &[DocumentEdit],
) -> Result<PlannedEdit, EditError> {
    let resolved = resolve_full(index, edit.item()).map_err(|error| EditError::Unresolvable {
        edit: position,
        error,
    })?;
    let not_an_item = EditError::NotASequenceItem {
        edit: position,
        node: resolved.value,
        kind: sequence.kind,
    };
    let at = sequence
        .children
        .iter()
        .position(|child| *child == resolved.value)
        .ok_or(not_an_item.clone())?;
    let sequence_path = containing_path(edit.item()).ok_or(not_an_item)?;
    ask_the_gate(index, trivia, position, sequence.id)?;
    if sequence.children.len() < 2 {
        return Err(EditError::RemovalWouldEmptyTheSequence {
            edit: position,
            sequence: sequence.id,
        });
    }
    let list = open_the_list(source, index, trivia, position, sequence)?;
    let removed = removed_indices(index, edits, sequence);
    let runs = removal_runs(source, &list, position, at, &removed)?;
    let deletions: Vec<Replacement> = runs
        .iter()
        .map(|run| Replacement {
            span: *run,
            text: String::new(),
        })
        .collect();
    check_comment_owners(source, &list, position, &deletions)?;

    let removed_items: Vec<NodeId> = removed.iter().map(|at| list.items[*at].0).collect();
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
            sequence: sequence_path,
            sequence_id: sequence.id,
            items: sequence.children.clone(),
            removed: Some(at),
            inserted: None,
        }),
        moved: None,
        duplicated: None,
        guards: vec![StructuralGuard::FlowRemoval {
            runs,
            sequence: sequence.id,
            item: list.items[at].0,
            removed: removed_items,
        }],
        rewritten: None,
    })
} // End of function plan_flow_removal()

/// The runs that delete item `at`, given every item the batch removes.
fn removal_runs(
    source: &str,
    list: &FlowList,
    position: usize,
    at: usize,
    removed: &[usize],
) -> Result<Vec<ByteSpan>, EditError> {
    let ambiguous = |span: ByteSpan| EditError::FlowListTriviaAmbiguous {
        edit: position,
        sequence: list.sequence,
        at: span,
    };
    let count = list.len();
    let is_removed = |item: usize| item == at || removed.contains(&item);
    // The last survivor. Removing every item is refused by the fold, which
    // sees the whole batch; here a list with no survivor has nothing to plan.
    let Some(survivor) = (0..count).rev().find(|item| !is_removed(*item)) else {
        return Err(EditError::RemovalWouldEmptyTheSequence {
            edit: position,
            sequence: list.sequence,
        });
    };
    let trailing = survivor + 1;
    // Whether the trailing run of removals, from `trailing` to the end, is
    // deleted line by line.
    let trailing_by_lines = (trailing..count).all(|item| owns_its_line(source, list, item));

    if at < survivor {
        // A survivor follows: the item goes with the separator after it.
        if let Some(line) =
            item_line(source, list, at).filter(|_| starts_its_line(source, list, at))
        {
            return Ok(vec![line]);
        }
        let next = at + 1;
        let next_by_lines = is_removed(next)
            && if next >= trailing {
                trailing_by_lines
            } else {
                owns_its_line(source, list, next)
            };
        let end = if next_by_lines {
            line_start(source, list.token(next).start)
        } else {
            list.token(next).start
        };
        return Ok(vec![ByteSpan::new(list.token(at).start, end)]);
    }

    // No survivor follows: the item goes with the separator before it.
    let before = list.gaps[at];
    if trailing_by_lines {
        let line = item_line(source, list, at).ok_or(EditError::FlowListLayoutUnsupported {
            edit: position,
            sequence: list.sequence,
        })?;
        let mut runs = Vec::new();
        let keeps_a_trailing_comma = list.gaps[count].comma.is_some();
        if at == trailing && !keeps_a_trailing_comma {
            let comma = before.comma.ok_or(EditError::FlowListLayoutUnsupported {
                edit: position,
                sequence: list.sequence,
            })?;
            runs.push(ByteSpan::new(list.token(at - 1).end, comma.end));
        }
        runs.push(line);
        return Ok(runs);
    }
    // Deleting from the previous item's end takes the gap before this item,
    // whose comment — if the previous item survives — is that survivor's.
    if at == trailing {
        if let Some(comment) = before.comment {
            return Err(ambiguous(comment));
        }
    }
    // The last item's own comment would be left behind on a survivor's line.
    if at == count - 1 {
        if let Some(comment) = list.gaps[count].comment {
            return Err(ambiguous(comment));
        }
    }
    Ok(vec![ByteSpan::new(
        list.token(at - 1).end,
        list.token(at).end,
    )])
} // End of function removal_runs()

/// Plans the insertion of scalar items into a flow scalar list, or refuses it.
///
/// The order is [`super::plan_scalar_item_insertion`]'s: the target is already
/// resolved to a flow scalar list; **ask the gate** (narrowed), take the list
/// apart, resolve the placement, then render. Every new item is spelled by
/// [`choose_scalar`] in flow context.
///
/// # Where the items land
///
/// - **An empty list** (`[]`, `[ ]`): before `]`, joined by `, `, followed by a
///   copy of the interior's spaces so `[ ]` becomes `[ 'x' ]`.
/// - **One item per line**: each new item on a line of its own, indented as the
///   anchor item is, ended by a copy of the anchor's line break — above the
///   first item for [`ItemPlacement::Front`], directly below the anchor's line
///   otherwise. At the end, a comma is added after the old last item unless the
///   list already carries a trailing comma, and the new last item carries one
///   exactly when the list did. When `]` shares the last item's line the new
///   lines are written before it.
/// - **Inline**: the items and the list's own separator, in front of the first
///   item for `Front` and directly after the anchor's token otherwise — never
///   onto a commented item's line ([`EditError::FlowListTriviaAmbiguous`]).
pub(super) fn plan_flow_insertion(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    position: usize,
    edit: &ScalarItemInsert,
    sequence: &Node,
) -> Result<PlannedEdit, EditError> {
    let list = open_the_list(source, index, trivia, position, sequence)?;
    let count = list.len();
    let no_such_item = EditError::NoSuchDestinationItem {
        edit: position,
        sequence: sequence.id,
        items: count,
    };
    if let ItemPlacement::After(anchor) = edit.placement() {
        if anchor >= count {
            return Err(no_such_item);
        }
    }
    let before = edit
        .placement()
        .items_above(count)
        .ok_or(no_such_item.clone())?;
    let tokens = render_tokens(source, &list, position, edit.values())?;
    let insertions: Vec<(usize, String)> = if count == 0 {
        let interior = &source[list.open + 1..list.close];
        vec![(list.close, format!("{}{interior}", tokens.join(", ")))]
    } else if (0..count).all(|item| starts_its_line(source, &list, item)) {
        by_lines(source, &list, position, before, &tokens)?
    } else {
        inline(source, &list, position, before, &tokens)?
    };
    let spliced: Vec<Replacement> = insertions
        .iter()
        .map(|(at, text)| Replacement {
            span: ByteSpan::new(*at, *at),
            text: text.clone(),
        })
        .collect();
    check_comment_owners(source, &list, position, &spliced)?;

    Ok(PlannedEdit {
        replacements: insertions
            .iter()
            .map(|(at, text)| Replacement {
                span: ByteSpan::new(*at, *at),
                text: text.clone(),
            })
            .collect(),
        permitted: insertions
            .iter()
            .map(|(at, _)| ByteSpan::new(*at, *at))
            .collect(),
        note: None,
        expectation: None,
        items: Some(PendingItem {
            edit: position,
            sequence: edit.sequence().clone(),
            sequence_id: sequence.id,
            items: sequence.children.clone(),
            removed: None,
            inserted: Some((
                before,
                edit.values()
                    .iter()
                    .map(|value| NewItem::Scalar(value.clone()))
                    .collect(),
            )),
        }),
        moved: None,
        duplicated: None,
        guards: insertions
            .iter()
            .map(|(at, _)| StructuralGuard::FlowInsertion {
                at: *at,
                sequence: sequence.id,
            })
            .collect(),
        rewritten: None,
    })
} // End of function plan_flow_insertion()

/// Spells every new value as a flow-context scalar token.
///
/// [`choose_scalar`] never writes a plain or a block scalar in flow context, so
/// every token is quoted and one line long; a token holding a line break would
/// be a defect of that promise and is refused rather than written.
fn render_tokens(
    source: &str,
    list: &FlowList,
    position: usize,
    values: &[String],
) -> Result<Vec<String>, EditError> {
    // The line ending only matters to a block scalar, which flow context never
    // produces, so the LF default here can never reach a byte; the one in
    // force before the list is passed when there is one.
    let line_ending = super::line_ending_before(source, list.open).unwrap_or_default();
    let column = source[line_start(source, list.open)..list.open]
        .chars()
        .count();
    let context = ScalarContext::flow(column, line_ending);
    let mut tokens = Vec::new();
    for value in values {
        let token = choose_scalar(value, context).render();
        if token.contains(['\n', '\r']) {
            return Err(EditError::FlowListLayoutUnsupported {
                edit: position,
                sequence: list.sequence,
            });
        }
        tokens.push(token);
    } // End of the loop over the new values
    Ok(tokens)
} // End of function render_tokens()

/// The insertions for a list laid out one item per line.
fn by_lines(
    source: &str,
    list: &FlowList,
    position: usize,
    before: usize,
    tokens: &[String],
) -> Result<Vec<(usize, String)>, EditError> {
    let count = list.len();
    let unsupported = EditError::FlowListLayoutUnsupported {
        edit: position,
        sequence: list.sequence,
    };
    let anchor = if before == 0 { 0 } else { before - 1 };
    let start = list.token(anchor).start;
    let indentation = &source[line_start(source, start)..start];
    // The break that ends the line above the first item, for `Front`, and the
    // break that ends the anchor's own line otherwise.
    let break_text = |span: ByteSpan| source[span.start..span.end].to_owned();
    let line = |token: &str, comma: bool, eol: &str| {
        format!("{indentation}{token}{}{eol}", if comma { "," } else { "" })
    };

    if before == 0 {
        let above = previous_break(source, line_start(source, start)).ok_or(unsupported)?;
        let eol = break_text(above);
        let text: String = tokens.iter().map(|token| line(token, true, &eol)).collect();
        return Ok(vec![(line_start(source, start), text)]);
    }
    if before < count {
        let first_break = list.after(anchor).first_break.ok_or(unsupported)?;
        let eol = break_text(first_break);
        let text: String = tokens.iter().map(|token| line(token, true, &eol)).collect();
        return Ok(vec![(first_break.end, text)]);
    }

    // At the end: the old last item gains a comma unless the list keeps a
    // trailing one, and the new last item carries one exactly when it did.
    let closing = list.gaps[count];
    let trailing_comma = closing.comma.is_some();
    let last = tokens.len() - 1;
    match closing.first_break {
        Some(first_break) => {
            let eol = break_text(first_break);
            let text: String = tokens
                .iter()
                .enumerate()
                .map(|(at, token)| line(token, at < last || trailing_comma, &eol))
                .collect();
            let mut insertions = Vec::new();
            if !trailing_comma {
                insertions.push((list.token(anchor).end, ",".to_owned()));
            }
            insertions.push((first_break.end, text));
            Ok(insertions)
        }
        None => {
            // `]` shares the last item's line: the new lines go before it.
            let above = previous_break(source, line_start(source, start)).ok_or(unsupported)?;
            let eol = break_text(above);
            let mut text = String::new();
            for (at, token) in tokens.iter().enumerate() {
                if at > 0 || !trailing_comma {
                    text.push(',');
                }
                text.push_str(&eol);
                text.push_str(indentation);
                text.push_str(token);
            } // End of the loop over the new tokens
            if trailing_comma {
                text.push(',');
            }
            let at = closing
                .comma
                .map_or(list.token(anchor).end, |comma| comma.end);
            Ok(vec![(at, text)])
        }
    } // End of the match over where `]` sits
} // End of function by_lines()

/// The line break that ends the line before `line_start`, when there is one.
fn previous_break(source: &str, line_start: usize) -> Option<ByteSpan> {
    let before = source.get(..line_start)?;
    if before.ends_with("\r\n") {
        Some(ByteSpan::new(line_start - 2, line_start))
    } else if before.ends_with(['\n', '\r']) {
        Some(ByteSpan::new(line_start - 1, line_start))
    } else {
        None
    }
} // End of function previous_break()

/// The insertions for a list laid out inline.
fn inline(
    source: &str,
    list: &FlowList,
    position: usize,
    before: usize,
    tokens: &[String],
) -> Result<Vec<(usize, String)>, EditError> {
    // The list's own separator: its first gap between two items that neither
    // breaks the line nor holds a comment.
    let separator = list.gaps[1..list.len()]
        .iter()
        .find(|gap| gap.first_break.is_none() && gap.comment.is_none())
        .map_or(DEFAULT_SEPARATOR, |gap| {
            &source[gap.span.start..gap.span.end]
        });
    if before == 0 {
        let text: String = tokens
            .iter()
            .map(|token| format!("{token}{separator}"))
            .collect();
        return Ok(vec![(list.token(0).start, text)]);
    }
    let anchor = before - 1;
    if let Some(comment) = list.after(anchor).comment {
        // The new items would come to share the anchor's commented line.
        return Err(EditError::FlowListTriviaAmbiguous {
            edit: position,
            sequence: list.sequence,
            at: comment,
        });
    }
    let text: String = tokens
        .iter()
        .map(|token| format!("{separator}{token}"))
        .collect();
    Ok(vec![(list.token(anchor).end, text)])
} // End of function inline()

/// Refuses an edit after which a retained comment of the list would share its
/// line with an item it did not trail, or trail a different item (the Phase
/// 3-3 review's finding 1).
///
/// **One check across every join**, insertion and removal alike, rather than a
/// rule per placement: the edit's own replacements are spliced, the result is
/// reparsed, and for every comment of the list that survives, the items ending
/// on its line before it are compared with its owner under the module's rule —
/// exactly its own item for an item's comment, none for the comment on `[`'s
/// line. A front insertion onto a commented first line, and a removal that
/// pulls a commented item up onto a line it did not end, both fail it. A
/// candidate that does not reparse is left to `verify`, which refuses it.
///
/// It sees this edit alone; other edits of the same batch are bounded by the
/// guards and by `verify`.
fn check_comment_owners(
    source: &str,
    list: &FlowList,
    position: usize,
    replacements: &[Replacement],
) -> Result<(), EditError> {
    let comments: Vec<(ByteSpan, Option<usize>)> = list
        .gaps
        .iter()
        .enumerate()
        .filter_map(|(at, gap)| gap.comment.map(|comment| (comment, at.checked_sub(1))))
        .collect();
    if comments.is_empty() {
        return Ok(());
    }
    let mut ordered = replacements.to_vec();
    ordered.sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
    let candidate = super::splice(source, &ordered);
    let Ok(index) = SyntaxIndex::parse(&candidate) else {
        return Ok(());
    };
    // Where an original offset outside every replacement lands in the candidate.
    let moved = |offset: usize| -> usize {
        let shift: isize = ordered
            .iter()
            .filter(|replacement| replacement.span.end <= offset)
            .map(|replacement| replacement.text.len() as isize - replacement.span.len() as isize)
            .sum();
        offset.saturating_add_signed(shift)
    };
    let open = moved(list.open);
    let Some(sequence) = index
        .nodes()
        .iter()
        .find(|node| node.kind == NodeKind::Sequence && node.span.start == open)
    else {
        return Ok(());
    };
    for (comment, owner) in comments {
        let deleted = ordered
            .iter()
            .any(|replacement| replacement.span.contains(comment));
        if deleted {
            continue;
        }
        let start = moved(comment.start);
        let line = line_start(&candidate, start);
        let on_its_line: Vec<usize> = sequence
            .children
            .iter()
            .filter_map(|child| index.node(*child))
            .filter(|item| line <= item.span.end && item.span.end <= start)
            .map(|item| item.span.start)
            .collect();
        let expected: Vec<usize> = owner
            .map(|item| moved(list.token(item).start))
            .into_iter()
            .collect();
        if on_its_line != expected {
            return Err(EditError::FlowListTriviaAmbiguous {
                edit: position,
                sequence: list.sequence,
                at: comment,
            });
        }
    } // End of the loop over the list's retained comments
    Ok(())
} // End of function check_comment_owners()

/// Checks a flow removal's runs against the original index (the guard's half).
///
/// Stated over syntax facts the planner cannot bend: every run lies strictly
/// inside the brackets; touches no node but the removed item and its ancestors;
/// covers the item's whole token; and cuts no comment in two nor takes one that
/// does not trail a removed item's line.
pub(super) fn check_removal(
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    runs: &[ByteSpan],
    sequence: NodeId,
    item: NodeId,
    removed: &[NodeId],
) -> Result<(), VerificationFailure> {
    let list = index
        .node(sequence)
        .ok_or(VerificationFailure::RemovalCarriesMoreThanTheEntry {
            at: ByteSpan::default(),
            lines: ByteSpan::default(),
        })?;
    let interior = ByteSpan::new(list.span.start + 1, list.span.end.saturating_sub(1));
    for run in runs {
        if !interior.contains(*run) {
            return Err(VerificationFailure::RemovalCarriesMoreThanTheEntry {
                at: *run,
                lines: list.span,
            });
        }
    } // End of the loop that keeps every run inside the brackets
    let mut covered = false;
    for node in index.nodes() {
        if node.kind == NodeKind::Document || node.span.is_empty() {
            continue;
        }
        let ancestor = is_ancestor(index, node.id, item);
        if let Some(run) = runs.iter().find(|run| run.intersects(node.span)) {
            if node.id != item && !ancestor {
                return Err(VerificationFailure::EnvelopeCoversAnotherNode {
                    at: *run,
                    node: node.id,
                });
            }
        }
        if node.id == item {
            covered = runs.iter().any(|run| run.contains(node.span));
            if !covered {
                return Err(VerificationFailure::EnvelopeMissesTheEntry {
                    at: node.span,
                    node: node.id,
                });
            }
        }
    } // End of the loop over every node a run might disturb
    if !covered {
        return Err(VerificationFailure::EnvelopeMissesTheEntry {
            at: ByteSpan::default(),
            node: item,
        });
    }
    let removed_ends: Vec<usize> = removed
        .iter()
        .filter_map(|id| index.node(*id).map(|node| node.span.end))
        .collect();
    for comment in trivia.items().iter().filter(|trivia| trivia.is_comment()) {
        let Some(run) = runs.iter().find(|run| run.intersects(comment.span)) else {
            continue;
        };
        let start = line_start(source, comment.span.start);
        let trails_a_removed_item = removed_ends
            .iter()
            .any(|end| start <= *end && *end <= comment.span.start);
        if !run.contains(comment.span) || !trails_a_removed_item {
            return Err(VerificationFailure::RemovalCarriesMoreThanTheEntry {
                at: *run,
                lines: comment.span,
            });
        }
    } // End of the loop over the comments a run reaches
    Ok(())
} // End of function check_removal()

/// Checks a flow insertion point against the original index (the guard's half).
///
/// The point lies inside the brackets — `]`'s own offset included, which is
/// where an empty list's items go — and inside no token and no comment.
pub(super) fn check_insertion(
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    at: usize,
    sequence: NodeId,
) -> Result<(), VerificationFailure> {
    let outside = VerificationFailure::InsertionPointInsideANode { at, node: sequence };
    let list = index.node(sequence).ok_or(outside.clone())?;
    if at <= list.span.start || at >= list.span.end {
        return Err(outside);
    }
    for node in index.nodes() {
        if node.is_frontier_leaf() && node.span.start < at && at < node.span.end {
            return Err(VerificationFailure::InsertionPointInsideANode { at, node: node.id });
        }
    } // End of the loop over every leaf the point might fall inside
    let in_a_comment = trivia
        .items()
        .iter()
        .any(|item| item.is_comment() && item.span.start < at && at < item.span.end);
    if in_a_comment {
        return Err(outside);
    }
    Ok(())
} // End of function check_insertion()
