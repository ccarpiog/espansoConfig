//! The two operation-specific dependency findings (Phase 4-7).
//!
//! [`crate::validate::FindingCode::VariableDependencyCycle`] and
//! [`crate::validate::FindingCode::DependencyHasNoDeclaration`] are
//! **`SuspiciousButPermitted`**, and they follow the 2c-3c precedent the module
//! documentation of [`crate::validate`] records: not a validator rule over
//! every candidate, but a suspicion the save transaction owes **one kind of
//! operation**, content-addressed by the candidate's own
//! [`ContentRevision`] (`docs/decisions/4-split-notes.md` §3 ruling 12).
//!
//! # Only for a variable operation, and only when it introduces or worsens
//!
//! A batch is a variable operation on a match when one of its edits addresses
//! something inside that match's `vars` (a scalar, a list item, an inserted or
//! removed variable, a reorder), inserts or removes the `vars` entry itself, or
//! replaces the match item's whole text (which rewrites its `vars` too). Every
//! other edit — a label, a trigger, a content field, an option, a creation, a
//! duplicate of a whole match — is not, and a batch holding only such edits
//! gets nothing here, however imperfect the graph it leaves untouched.
//!
//! For each operated match the analysis runs on the **original** and on the
//! **candidate**, and a finding is produced only for a condition the candidate
//! has and the original did not:
//!
//! - a cycle whose members (by name) are not all members of one cycle of the
//!   original — so a new cycle, a grown one or one merged with another is
//!   reported, and a cycle left alone, shrunk or reordered is not;
//! - a missing explicit dependency name whose number of occurrences grew, under
//!   a closed scope. An open scope (imports, an unreadable `vars` or
//!   `global_vars`, unknown regex captures) produces no such finding, before or
//!   after — the analysis never turns an open scope into a closed one.

use std::collections::{BTreeSet, HashMap};

use super::dependency::{analyze_match, MatchAnalysis};
use crate::model::{DocumentView, MatchView};
use crate::patch::{item_positions, DocumentEdit, DocumentPath, PathSegment};
use crate::validate::{Finding, FindingCode};
use crate::ContentRevision;

/// The top-level key under which espanso lists matches.
const MATCHES_KEY: &str = "matches";

/// The match-level key holding local variables.
const VARS_KEY: &str = "vars";

/// Whether `edits` holds a variable operation on some match.
///
/// Cheap, and asked first so that a batch with none never pays for a second
/// projection of the original text.
pub fn batch_operates_on_variables(edits: &[DocumentEdit]) -> bool {
    !operated_matches(edits).is_empty()
}

/// The dependency findings a batch's variable operations owe its candidate.
///
/// `original` is the projection of the text the batch was applied to, or
/// `None` when it could not be built — in which case the original is taken to
/// hold no condition, so everything the candidate holds in an operated match is
/// reported (the direction that asks rather than stays silent). `candidate` is
/// the candidate's projection and `revision` its [`ContentRevision`], which
/// every finding carries so that consent given for one candidate cannot be
/// spent on another.
pub fn variable_operation_findings(
    original: Option<&DocumentView>,
    candidate: &DocumentView,
    edits: &[DocumentEdit],
    revision: ContentRevision,
) -> Vec<Finding> {
    let mut findings = Vec::new();
    for path in operated_matches(edits) {
        let Some(landed) = candidate_path(original, &path, edits) else {
            continue;
        };
        let Some(after_match) = match_at(candidate, &landed) else {
            continue;
        };
        let before =
            original.and_then(|view| match_at(view, &path).map(|entry| analyze_match(view, entry)));
        let after = analyze_match(candidate, after_match);
        cycle_findings(
            before.as_ref(),
            &after,
            after_match,
            revision,
            &mut findings,
        );
        missing_findings(
            before.as_ref(),
            &after,
            after_match,
            revision,
            &mut findings,
        );
    } // End of the loop over the operated matches
    findings
} // End of function variable_operation_findings()

/// The match of `view` at `path`.
fn match_at<'a>(view: &'a DocumentView, path: &DocumentPath) -> Option<&'a MatchView> {
    view.matches
        .iter()
        .find(|entry| entry.path.as_ref() == Some(path))
}

/// Where the match at `path` in the original sits in the candidate.
///
/// The engine's own arithmetic ([`item_positions`]) over the whole batch, so a
/// removal or an insertion of another match above it is accounted for; `None`
/// when the batch removes it or the arithmetic cannot name a position.
fn candidate_path(
    original: Option<&DocumentView>,
    path: &DocumentPath,
    edits: &[DocumentEdit],
) -> Option<DocumentPath> {
    let Some(original) = original else {
        return Some(path.clone());
    };
    let (last, parent) = path.segments().split_last()?;
    let PathSegment::Index(index) = last else {
        return None;
    };
    let sequence = DocumentPath::new(path.document_index(), parent.to_vec());
    let items = original
        .matches
        .iter()
        .filter(|entry| {
            entry.path.as_ref().is_some_and(|candidate| {
                candidate.document_index() == sequence.document_index()
                    && candidate.segments().split_last().map(|(_, up)| up) == Some(parent)
            })
        })
        .count();
    let landed = (*item_positions(edits, &sequence, items)?.get(*index)?)?;
    Some(sequence.with_index(landed))
} // End of function candidate_path()

/// A finding for every candidate cycle no original cycle covers.
fn cycle_findings(
    before: Option<&MatchAnalysis>,
    after: &MatchAnalysis,
    entry: &MatchView,
    revision: ContentRevision,
    findings: &mut Vec<Finding>,
) {
    let names_of = |analysis: &MatchAnalysis, members: &[usize]| -> BTreeSet<String> {
        members
            .iter()
            .filter_map(|member| analysis.scope.declarations[*member].name.clone())
            .collect()
    };
    let covered: Vec<BTreeSet<String>> = before
        .map(|analysis| {
            analysis
                .scope
                .cycles
                .iter()
                .map(|cycle| names_of(analysis, &cycle.members))
                .collect()
        })
        .unwrap_or_default();
    for cycle in &after.scope.cycles {
        let members = names_of(after, &cycle.members);
        if covered.iter().any(|old| members.is_subset(old)) {
            continue;
        }
        let first = cycle.members[0];
        let Some(variable) = entry.vars.get(first) else {
            continue;
        };
        findings.push(Finding {
            code: FindingCode::VariableDependencyCycle {
                revision,
                name: after.scope.declarations[first]
                    .name
                    .clone()
                    .unwrap_or_default(),
                size: cycle.members.len(),
            },
            span: Some(variable.span),
            node: Some(variable.node),
            path: variable.path.clone(),
        });
    } // End of the loop over the candidate's cycles
} // End of function cycle_findings()

/// A finding for every missing explicit dependency whose occurrences grew.
///
/// Occurrences are counted per name; when a name gains `n` occurrences, the
/// last `n` in authored order carry the findings.
fn missing_findings(
    before: Option<&MatchAnalysis>,
    after: &MatchAnalysis,
    entry: &MatchView,
    revision: ContentRevision,
    findings: &mut Vec<Finding>,
) {
    let mut earlier: HashMap<&str, usize> = HashMap::new();
    for missing in before
        .map(|analysis| analysis.scope.missing_dependencies.as_slice())
        .unwrap_or_default()
    {
        *earlier.entry(missing.name.as_str()).or_default() += 1;
    }
    let mut later: HashMap<&str, usize> = HashMap::new();
    for missing in &after.scope.missing_dependencies {
        *later.entry(missing.name.as_str()).or_default() += 1;
    }
    let mut seen: HashMap<&str, usize> = HashMap::new();
    for missing in &after.scope.missing_dependencies {
        let name = missing.name.as_str();
        let position = seen.entry(name).or_default();
        *position += 1;
        let total = later[name];
        let gained = total.saturating_sub(earlier.get(name).copied().unwrap_or(0));
        // Only the last `gained` occurrences of this name are reported.
        if *position <= total - gained {
            continue;
        }
        let path = entry
            .vars
            .get(missing.consumer)
            .and_then(|variable| variable.path.clone())
            .map(|path| path.with_key("depends_on").with_index(missing.entry));
        findings.push(Finding {
            code: FindingCode::DependencyHasNoDeclaration {
                revision,
                name: missing.name.clone(),
            },
            span: Some(missing.span),
            node: Some(missing.node),
            path,
        });
    } // End of the loop over the candidate's missing dependencies
} // End of function missing_findings()

/// Every match a batch operates on the variables of, by its original path, in
/// first-mention order.
fn operated_matches(edits: &[DocumentEdit]) -> Vec<DocumentPath> {
    let mut operated: Vec<DocumentPath> = Vec::new();
    for edit in edits {
        let (addresses, whole_item) = addresses_of(edit);
        for address in addresses {
            if let Some(path) = operated_match(&address, whole_item) {
                if !operated.contains(&path) {
                    operated.push(path);
                }
            }
        }
    } // End of the loop over the batch's edits
    operated
} // End of function operated_matches()

/// The paths one edit addresses, and whether it replaces a whole item's text.
///
/// Exhaustive on purpose: a new kind of edit is a compile error here until
/// someone decides whether it can be a variable operation.
fn addresses_of(edit: &DocumentEdit) -> (Vec<DocumentPath>, bool) {
    let one = |path: &DocumentPath| vec![path.clone()];
    match edit {
        DocumentEdit::Scalar(edit) => (one(edit.path()), false),
        DocumentEdit::InsertField(insert) => {
            (vec![insert.mapping().clone().with_key(insert.key())], false)
        }
        DocumentEdit::InsertFields(group) => (
            group
                .keys()
                .into_iter()
                .map(|key| group.mapping().clone().with_key(key))
                .collect(),
            false,
        ),
        DocumentEdit::SubstituteKey(substitution) => (one(substitution.field()), false),
        DocumentEdit::RemoveField(removal) => (one(removal.field()), false),
        DocumentEdit::MoveItem(movement) => (one(movement.item()), false),
        DocumentEdit::InsertItem(insert) => (one(insert.sequence()), false),
        DocumentEdit::RemoveItem(removal) => (one(removal.item()), false),
        DocumentEdit::DuplicateItem(duplicate) => (one(duplicate.item()), false),
        DocumentEdit::InsertScalarItems(insert) => (one(insert.sequence()), false),
        DocumentEdit::SwitchShape(switch) => (one(switch.field()), false),
        DocumentEdit::ReplaceItemText(replacement) => (one(replacement.item()), true),
    }
} // End of function addresses_of()

/// The match an address operates on the variables of, by its path.
///
/// `matches[i].vars…` names match `i`; so does `matches[i]` itself when the
/// edit replaces the whole item's text.
fn operated_match(address: &DocumentPath, whole_item: bool) -> Option<DocumentPath> {
    let [PathSegment::Key(top), PathSegment::Index(index), rest @ ..] = address.segments() else {
        return None;
    };
    if top != MATCHES_KEY {
        return None;
    }
    let in_vars = matches!(rest.first(), Some(PathSegment::Key(key)) if key == VARS_KEY);
    (in_vars || (whole_item && rest.is_empty())).then(|| {
        DocumentPath::new(
            address.document_index(),
            vec![PathSegment::key(MATCHES_KEY), PathSegment::Index(*index)],
        )
    })
} // End of function operated_match()
