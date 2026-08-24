//! Snapshot-bound correspondence tables — the evidence a `Changed` observation
//! carries about where the base snapshot's items sit in the stabilized one.
//!
//! **Phase 2d-1 scope: the table, and nothing that acts on it.** Nothing here
//! decides what a surface does with a row — that is the frontend coordinator's
//! (2d-5) — and nothing here invents evidence: every answer is
//! [`crate::reconcile`]'s own conservative tier walk, so an ambiguous or
//! missing candidate is a refusal, never a best guess.
//!
//! # Why a table rather than one answer
//!
//! A save conflict resolves the one operation that was refused, so it asks one
//! [`crate::reconcile::ReapplyRequest`]. An external change has no operation
//! yet: whichever surface turns out to be open over the file will need its own
//! kind of correspondence, and by the time it asks, the disk may hold a third
//! state. So the table is built **once, from the pair of snapshots the
//! observation is about**, one row per match of the base snapshot, and each
//! row answers at both confidence policies:
//!
//! - [`CorrespondenceEntry::exact`] — [`ReapplyConfidence::ExactItem`], the
//!   only tier a delete, a move or a duplicate may act on, **and** the tier a
//!   positional placement resolves at. One tier, one answer, two uses: a
//!   placement is exact-item correspondence by definition
//!   (`crate::reconcile::PlacementMode` has no confidence parameter), so a
//!   separate placement column would be a second copy of the same value.
//! - [`CorrespondenceEntry::editor`] —
//!   [`ReapplyConfidence::ExactItemOrUniqueTrigger`], the match editor's
//!   flexible tier, whose worst case is a rewritten field rather than a
//!   destroyed snippet.
//!
//! # Snapshot-bound, in both directions
//!
//! Both resolutions of every row are answered against the **same** fresh
//! [`SourceDocument`] — one `fresh` reference through the whole build — and the
//! table records the two revisions it was built from, so a consumer can refuse
//! a table that does not describe the observation in hand (the 2d design
//! consult's Q5: evidence from an older observation resolves to manual
//! resolution). What Rust does not force is that a *caller* keeps the table
//! beside the observation it was built for; the engine gets it right by
//! building both in one place, and every other producer would have to say the
//! same thing about itself.
//!
//! # What never crosses here
//!
//! [`crate::reconcile::ReapplyAnchor`] is captured inside the build and
//! dropped there. The anchor is the question and is forbidden from crossing
//! the IPC boundary; a [`ReapplyResolution`] is the answer, and the table
//! holds only answers.

use serde::Serialize;

use crate::model::MatchId;
use crate::reconcile::{
    reconcile, PlacementMode, ReapplyConfidence, ReapplyMode, ReapplyRequest, ReapplyResolution,
};
use crate::{ContentRevision, SourceDocument};

/// Where one base-snapshot match sits in the stabilized snapshot, at both
/// confidence policies.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CorrespondenceEntry {
    /// The match this row is about, as the **base** snapshot minted it. Stale
    /// by construction — after the change, this identity resolves to nothing —
    /// which is exactly what lets an open surface holding it find its row.
    pub base: MatchId,
    /// The exact-item answer: the only tier a destructive operation may act
    /// on, and the exact placement correspondence — a placement resolves at
    /// this tier and no other.
    pub exact: ReapplyResolution,
    /// The match editor's answer: exact item, else the complete mapping slice,
    /// else a trigger form unique on both sides. Where this tier answered
    /// below the exact one, it is provisional correspondence, not proof the
    /// original item remains.
    pub editor: ReapplyResolution,
}

/// Every base-snapshot match's correspondence into one stabilized snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CorrespondenceTable {
    /// The revision of the snapshot the rows' identities were minted from.
    pub base_revision: ContentRevision,
    /// The revision of the snapshot every answer was resolved against. A
    /// consumer holding an observation with a different disk revision must
    /// treat this table as evidence about a state it was not shown.
    pub disk_revision: ContentRevision,
    /// One row per match of the base snapshot, in the base projection's own
    /// order. Empty when the base snapshot projected no matches — a failed
    /// parse included, because a projection that failed carries nothing to
    /// find again.
    pub entries: Vec<CorrespondenceEntry>,
}

/// Builds the whole table from one base snapshot into one fresh snapshot.
///
/// Both resolutions of every row come from the same `fresh` reference, which
/// is what "snapshot-bound" means here; the anchors are captured from `base`
/// inside this function and dropped before it returns. A base match whose
/// anchor cannot be captured — routine for an item outside a sequence — gets
/// two `Refused` answers rather than being silently skipped, so the table's
/// row count always equals the base projection's match count.
pub fn correspondences_between(
    base: &SourceDocument,
    fresh: &SourceDocument,
) -> CorrespondenceTable {
    let entries = base
        .view
        .matches
        .iter()
        .map(|target| CorrespondenceEntry {
            base: target.id,
            exact: resolve_at(base, target, ReapplyConfidence::ExactItem, fresh),
            editor: resolve_at(
                base,
                target,
                ReapplyConfidence::ExactItemOrUniqueTrigger,
                fresh,
            ),
        })
        .collect();
    CorrespondenceTable {
        base_revision: base.revision,
        disk_revision: fresh.revision,
        entries,
    }
} // End of function correspondences_between()

/// One subject's answer at one confidence, against one fresh snapshot.
fn resolve_at(
    base: &SourceDocument,
    target: &crate::model::MatchView,
    confidence: ReapplyConfidence,
    fresh: &SourceDocument,
) -> ReapplyResolution {
    let request = ReapplyRequest {
        subject: ReapplyMode::anchored(base, target, confidence),
        placement: PlacementMode::NotAnchored,
    };
    reconcile(&request, fresh).subject
} // End of function resolve_at()

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::DocumentContext;
    use crate::reconcile::ReapplyRefusal;
    use crate::workspace::project_source;
    use crate::DocumentId;

    /// A neutral, hand-authored document (CLAUDE.md section 1).
    const BASE: &str = "matches:\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha\n\n  - trigger: ':two'\n    replace: beta\n";

    /// Projects a source string as a detached snapshot.
    fn snapshot(source: &str) -> SourceDocument {
        project_source(
            &DocumentContext::detached(DocumentId(11), "match/a.yml"),
            source,
        )
    }

    #[test]
    fn the_table_is_bound_to_both_revisions_and_has_one_row_per_base_match() {
        let base = snapshot(BASE);
        let fresh = snapshot("matches:\n  - trigger: ':two'\n    replace: beta\n\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha\n");
        let table = correspondences_between(&base, &fresh);
        assert_eq!(table.base_revision, base.revision);
        assert_eq!(table.disk_revision, fresh.revision);
        assert_eq!(table.entries.len(), base.view.matches.len());
        // Every identified target is minted from the fresh snapshot, never
        // from the base one.
        for entry in &table.entries {
            let ReapplyResolution::Identified { target } = &entry.exact else {
                panic!("a pure reorder keeps every item findable: {entry:?}");
            };
            assert_eq!(target.id.revision, fresh.revision);
        }
    } // End of function the_table_is_bound_to_both_revisions_and_has_one_row_per_base_match()

    #[test]
    fn the_editor_tier_survives_a_leading_comment_change_the_exact_tier_refuses() {
        let base = snapshot(BASE);
        // The first snippet's leading comment is rewritten: its owned runs
        // change, its mapping slice does not.
        let fresh = snapshot("matches:\n  # a rewritten comment\n  - trigger: ':one'\n    replace: alpha\n\n  - trigger: ':two'\n    replace: beta\n");
        let table = correspondences_between(&base, &fresh);
        let row = &table.entries[0];
        assert_eq!(
            row.exact,
            ReapplyResolution::Refused {
                reason: ReapplyRefusal::NoExactCorrespondence
            },
            "a destructive operation may not act across a changed envelope"
        );
        assert!(
            matches!(row.editor, ReapplyResolution::Identified { .. }),
            "the mapping slice is unchanged, so the editor tier answers"
        );
    } // End of function the_editor_tier_survives_a_leading_comment_change_the_exact_tier_refuses()

    #[test]
    fn a_base_that_did_not_parse_yields_an_empty_table_not_a_missing_one() {
        let base = snapshot("matches: [\n");
        let fresh = snapshot(BASE);
        let table = correspondences_between(&base, &fresh);
        assert_eq!(table.base_revision, base.revision);
        assert!(table.entries.is_empty());
    }

    #[test]
    fn the_table_serializes_without_carrying_an_anchor() {
        let base = snapshot(BASE);
        let fresh = snapshot(BASE);
        let json = serde_json::to_value(correspondences_between(&base, &fresh))
            .expect("a correspondence table must serialize");
        // The answer crosses; the question never does.
        assert!(json.get("entries").is_some());
        assert!(!json.to_string().contains("owned_runs_digest"));
    }
}
