//! Phase 2c-4b-1 acceptance: which item of a **later** parse is the item an
//! operation named.
//!
//! `crate::reconcile` is the evidence half of *Keep my draft*, and this file is
//! the evidence that its answers are conservative. The cross-revision cases
//! below use explicit **R0 → R1** pairs — a base document, an external rewrite
//! of it, and the exact resolution an anchor captured from R0 gets against R1;
//! the corpus cases separately check self-resolution in one snapshot.
//!
//! # The eight named failures
//!
//! The Phase 2c-4b design consult (Q2 and Q8) names eight rewrites this module
//! must pin, and each has a section below: deletion, an edited trigger,
//! duplicate triggers, identical duplicates, a reordered sequence, a second
//! document, a comment that changes hands, and a whole-file rewrite. The two
//! confidence policies are crossed over all of them, because the asymmetry
//! between them is the phase's core decision: the editor may fall back, and a
//! delete, a move, a duplicate and every positional anchor may not.
//!
//! # The property
//!
//! Over **every eligible** match of both corpora — eligibility being decided by
//! this file, never by what the implementation happened to accept — an anchor
//! *can* be captured, and it resolves, in that same snapshot, to the item it was
//! captured from, or refuses as `AmbiguousExact`, which is only permitted when
//! another item of the same sequence really is written identically. A search that
//! could not find an item in the document it came from could not be trusted to
//! find it anywhere.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! The tests that read it print file names and counts only, and skip cleanly
//! when the corpus is absent.

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::reconcile::{
    reconcile, PlacementMode, ReapplyAnchor, ReapplyConfidence, ReapplyMode, ReapplyPlacement,
    ReapplyRefusal, ReapplyRequest, ReapplyResolution,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{DocumentId, SourceDocument};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Both confidence policies, so no case can be written for one and forgotten
/// for the other.
const BOTH: [ReapplyConfidence; 2] = [
    ReapplyConfidence::ExactItem,
    ReapplyConfidence::ExactItemOrUniqueTrigger,
];

/// Projects `source` as a detached snapshot of document `id`.
fn snapshot_of(id: u64, source: &str) -> SourceDocument {
    project_source(
        &DocumentContext::detached(DocumentId(id), "match/base.yml"),
        source,
    )
}

/// Projects `source` as a detached snapshot of document 1.
fn snapshot(source: &str) -> SourceDocument {
    snapshot_of(1, source)
}

/// The request an operation of `confidence` makes for the `index`-th match of
/// `base`, naming no positional anchor.
fn mode(base: &SourceDocument, index: usize, confidence: ReapplyConfidence) -> ReapplyRequest {
    ReapplyRequest {
        subject: ReapplyMode::anchored(base, &base.view.matches[index], confidence),
        placement: PlacementMode::NotAnchored,
    }
} // End of function mode()

/// The **subject** half of resolving `request` against `fresh`.
///
/// Every case below that names one identity reads this; the cases that name two
/// read the whole [`ReapplyEvidence`] and are grouped under their own heading.
fn subject_of(request: &ReapplyRequest, fresh: &SourceDocument) -> ReapplyResolution {
    reconcile(request, fresh).subject
} // End of function subject_of()

/// The request a move placed after `anchor` makes for the `subject`-th match of
/// `base`.
///
/// Both operands at [`ReapplyConfidence::ExactItem`], which is what a move takes
/// for its own item and what every positional anchor takes, always.
fn move_after(base: &SourceDocument, subject: usize, anchor: usize) -> ReapplyRequest {
    ReapplyRequest {
        subject: ReapplyMode::anchored(
            base,
            &base.view.matches[subject],
            ReapplyConfidence::ExactItem,
        ),
        placement: PlacementMode::anchored(base, &base.view.matches[anchor]),
    }
} // End of function move_after()

/// The primary trigger text of a placement that identified something.
fn placed_trigger(placement: &ReapplyPlacement) -> String {
    let ReapplyPlacement::Identified { target } = placement else {
        panic!("expected a placement identification, got {placement:?}");
    };
    target
        .trigger
        .primary()
        .map(|scalar| scalar.text.clone())
        .unwrap_or_default()
} // End of function placed_trigger()

/// The refusal of a placement that refused.
fn placement_refusal(placement: &ReapplyPlacement) -> ReapplyRefusal {
    let ReapplyPlacement::Refused { reason } = placement else {
        panic!("expected a placement refusal, got {placement:?}");
    };
    *reason
} // End of function placement_refusal()

/// The primary trigger text of a resolution that identified something.
///
/// Panics with the resolution when it identified nothing, so a failing case
/// names what it actually got.
fn identified_trigger(resolution: &ReapplyResolution) -> String {
    let ReapplyResolution::Identified { target } = resolution else {
        panic!("expected an identification, got {resolution:?}");
    };
    target
        .trigger
        .primary()
        .map(|scalar| scalar.text.clone())
        .unwrap_or_default()
} // End of function identified_trigger()

/// The refusal of a resolution that refused.
fn refusal(resolution: &ReapplyResolution) -> ReapplyRefusal {
    let ReapplyResolution::Refused { reason } = resolution else {
        panic!("expected a refusal, got {resolution:?}");
    };
    *reason
}

// ---------------------------------------------------------------------------
// The documents the cases are written over. All hand-authored and neutral.
// ---------------------------------------------------------------------------

/// Two snippets, the first carrying a leading comment block it owns.
const BASE: &str = "\
matches:
  # about the first
  - trigger: ':one'
    replace: alpha

  - trigger: ':two'
    replace: beta
";

// ---------------------------------------------------------------------------
// The positive cases
// ---------------------------------------------------------------------------

/// An external change that leaves the target's owned bytes alone identifies it,
/// at both confidences.
#[test]
fn an_unrelated_external_change_still_identifies_the_target() {
    let base = snapshot(BASE);
    // R1: a document-owned comment appended, and the *other* snippet rewritten.
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: ':one'
    replace: alpha

  - trigger: ':two'
    replace: BETA CHANGED

# a note the file owns
",
    );
    for confidence in BOTH {
        let resolution = subject_of(&mode(&base, 0, confidence), &disk);
        assert_eq!(
            identified_trigger(&resolution),
            ":one",
            "an untouched item must survive an edit to its neighbour ({confidence:?})"
        );
    } // End of the loop over both confidence policies
} // End of function an_unrelated_external_change_still_identifies_the_target()

/// A reordered sequence identifies the item, never the old index.
///
/// The anchor's `item_index` is 0 and the item is at 1 afterwards; an
/// implementation that consulted the index would answer with the *other*
/// snippet, which is exactly the failure this asserts against.
#[test]
fn a_reordered_sequence_identifies_the_item_and_not_its_former_index() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  - trigger: ':two'
    replace: beta

  # about the first
  - trigger: ':one'
    replace: alpha
",
    );
    for confidence in BOTH {
        let resolution = subject_of(&mode(&base, 0, confidence), &disk);
        assert_eq!(identified_trigger(&resolution), ":one", "{confidence:?}");
    } // End of the loop over both confidence policies
} // End of function a_reordered_sequence_identifies_the_item_and_not_its_former_index()

/// The editor's weaker tier survives an external edit to an **undrafted** field.
///
/// The item's bytes changed, so no exact tier can find it; its exact trigger
/// fingerprint is unchanged and unique on both sides, so the editor's tier does.
/// An operation that acts on the envelope gets `NoExactCorrespondence` from the
/// same pair, which is the asymmetry stated as a test.
#[test]
fn only_the_editor_falls_back_to_a_unique_unchanged_trigger() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: ':one'
    replace: alpha
    label: added by somebody else

  - trigger: ':two'
    replace: beta
",
    );
    assert_eq!(
        identified_trigger(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ":one"
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItem),
            &disk
        )),
        ReapplyRefusal::NoExactCorrespondence
    );
} // End of function only_the_editor_falls_back_to_a_unique_unchanged_trigger()

// ---------------------------------------------------------------------------
// The eight named failures
// ---------------------------------------------------------------------------

/// **Deleted externally.** No exact item and no old trigger: refuse.
#[test]
fn a_target_deleted_externally_is_refused() {
    let base = snapshot(BASE);
    let disk = snapshot("matches:\n  - trigger: ':two'\n    replace: beta\n");
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItem),
            &disk
        )),
        ReapplyRefusal::NoExactCorrespondence
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::TargetMissingOrTriggerChanged
    );
} // End of function a_target_deleted_externally_is_refused()

/// **Trigger edited externally**, at the same index. The index is not evidence,
/// so both policies refuse.
#[test]
fn a_trigger_edited_externally_is_refused_even_at_the_same_index() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: ':uno'
    replace: alpha

  - trigger: ':two'
    replace: beta
",
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItem),
            &disk
        )),
        ReapplyRefusal::NoExactCorrespondence
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::TargetMissingOrTriggerChanged
    );
} // End of function a_trigger_edited_externally_is_refused_even_at_the_same_index()

/// **A respelled trigger is a changed trigger.** The fingerprint is the source
/// spelling, so a formatter that rewrites `':one'` as `":one"` produces an
/// honest refusal rather than a confident wrong answer.
#[test]
fn a_respelled_trigger_is_not_the_same_trigger() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: \":one\"
    replace: alpha CHANGED

  - trigger: ':two'
    replace: beta
",
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::TargetMissingOrTriggerChanged
    );
} // End of function a_respelled_trigger_is_not_the_same_trigger()

/// **Two matches now share the trigger**, and the target's own bytes changed.
/// The weaker tier has two candidates and refuses rather than choosing the old
/// position.
#[test]
fn two_matches_sharing_a_trigger_refuse_the_weaker_tier() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: ':one'
    replace: alpha CHANGED

  - trigger: ':one'
    replace: beta
",
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::AmbiguousTrigger
    );
} // End of function two_matches_sharing_a_trigger_refuse_the_weaker_tier()

/// **A trigger that was already duplicated in the base** cannot identify
/// anything, even when the fresh snapshot holds exactly one of it.
///
/// Uniqueness is required on **both** sides: a base sequence that already held
/// two snippets spelled the same gives the editor no way to say which one it was
/// editing.
#[test]
fn a_trigger_that_was_not_unique_in_the_base_identifies_nothing() {
    let base = snapshot(
        "\
matches:
  - trigger: ':one'
    replace: alpha

  - trigger: ':one'
    replace: beta
",
    );
    let disk = snapshot(
        "\
matches:
  - trigger: ':one'
    replace: alpha CHANGED

  - trigger: ':other'
    replace: beta
",
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::AmbiguousTrigger
    );
} // End of function a_trigger_that_was_not_unique_in_the_base_identifies_nothing()

/// **Identical duplicates.** Two items written the same way carry the same
/// evidence at every tier, so the strongest tier already has two candidates and
/// no weaker one may break the tie.
#[test]
fn two_identically_written_items_refuse_at_the_strongest_tier() {
    let base = snapshot(
        "\
matches:
  - trigger: ':dup'
    replace: same

  - trigger: ':other'
    replace: different
",
    );
    let disk = snapshot(
        "\
matches:
  - trigger: ':dup'
    replace: same

  - trigger: ':dup'
    replace: same
",
    );
    for confidence in BOTH {
        assert_eq!(
            refusal(&subject_of(&mode(&base, 0, confidence), &disk)),
            ReapplyRefusal::AmbiguousExact,
            "{confidence:?}"
        );
    } // End of the loop over both confidence policies
} // End of function two_identically_written_items_refuse_at_the_strongest_tier()

/// **A second document.** The sequence address is `matches` in both files, so
/// the document identity is the only thing keeping the two apart — which is
/// exactly why the anchor carries it beside the path.
#[test]
fn a_snapshot_of_another_file_is_refused_even_at_the_same_path() {
    let base = snapshot_of(1, BASE);
    let elsewhere = snapshot_of(2, BASE);
    for confidence in BOTH {
        assert_eq!(
            refusal(&subject_of(&mode(&base, 0, confidence), &elsewhere)),
            ReapplyRefusal::WrongDocument,
            "{confidence:?}"
        );
    } // End of the loop over both confidence policies
} // End of function a_snapshot_of_another_file_is_refused_even_at_the_same_path()

/// **A comment that changes hands.** A blank line inserted **between** the
/// target's leading comment block and the target gives that comment to the
/// **file** (plan section 6.2's rule 2), so the item's ownership envelope loses
/// it — while the item's own mapping slice is unchanged, byte for byte.
///
/// The two tiers therefore answer differently, which is the whole reason there
/// are two: the editor identifies the item, and every operation that acts on the
/// envelope refuses.
#[test]
fn a_comment_changing_hands_separates_the_two_exact_tiers() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  # about the first

  - trigger: ':one'
    replace: alpha

  - trigger: ':two'
    replace: beta
",
    );
    assert_eq!(
        identified_trigger(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ":one",
        "the mapping slice is unchanged, so the editor's tier 3 finds it"
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItem),
            &disk
        )),
        ReapplyRefusal::NoExactCorrespondence,
        "the envelope changed, so an operation that acts on it must refuse"
    );
} // End of function a_comment_changing_hands_separates_the_two_exact_tiers()

/// **A whole-file rewrite** that respells every scalar is refused by both
/// policies, including the editor's weaker tier.
#[test]
fn a_wholesale_reformat_is_refused_by_both_policies() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
    -   trigger: \":one\"
        replace: \"alpha\"
    -   trigger: \":two\"
        replace: \"beta\"
",
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItem),
            &disk
        )),
        ReapplyRefusal::NoExactCorrespondence
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::TargetMissingOrTriggerChanged
    );
} // End of function a_wholesale_reformat_is_refused_by_both_policies()

// ---------------------------------------------------------------------------
// The refusals that are about the snapshot rather than about the item
// ---------------------------------------------------------------------------

/// A snapshot that did not parse produces no parsed sequence to search.
#[test]
fn a_snapshot_that_did_not_parse_is_refused_by_name() {
    let base = snapshot(BASE);
    let broken = snapshot("matches:\n  - trigger: ':one'\n   replace: [unclosed\n");
    assert!(
        !broken.parse.is_parsed(),
        "the fixture must really fail to parse, or this proves nothing"
    );
    for confidence in BOTH {
        assert_eq!(
            refusal(&subject_of(&mode(&base, 0, confidence), &broken)),
            ReapplyRefusal::DiskDoesNotParse,
            "{confidence:?}"
        );
    } // End of the loop over both confidence policies
} // End of function a_snapshot_that_did_not_parse_is_refused_by_name()

/// A snapshot that parses but holds no item at the anchor's sequence address.
#[test]
fn a_sequence_that_is_gone_is_refused_by_name() {
    let base = snapshot(BASE);
    let disk = snapshot("global_vars:\n  - name: who\n    type: echo\n");
    for confidence in BOTH {
        assert_eq!(
            refusal(&subject_of(&mode(&base, 0, confidence), &disk)),
            ReapplyRefusal::SequenceMissing,
            "{confidence:?}"
        );
    } // End of the loop over both confidence policies
} // End of function a_sequence_that_is_gone_is_refused_by_name()

/// An item that writes none of the three trigger keys has no fingerprint, and
/// the weaker tier says so rather than pretending the trigger changed.
#[test]
fn an_item_with_no_trigger_form_has_nothing_for_the_weaker_tier() {
    let base = snapshot(
        "\
matches:
  - replace: alpha

  - trigger: ':two'
    replace: beta
",
    );
    let disk = snapshot(
        "\
matches:
  - replace: alpha CHANGED

  - trigger: ':two'
    replace: beta
",
    );
    assert_eq!(
        refusal(&subject_of(
            &mode(&base, 0, ReapplyConfidence::ExactItemOrUniqueTrigger),
            &disk
        )),
        ReapplyRefusal::NoTriggerToMatch
    );
} // End of function an_item_with_no_trigger_form_has_nothing_for_the_weaker_tier()

/// A mode with no anchor answers without looking at the snapshot at all.
#[test]
fn the_three_anchorless_modes_answer_from_themselves() {
    let disk = snapshot(BASE);
    /// A request whose subject is `subject` and which names no anchor.
    fn only(subject: ReapplyMode) -> ReapplyRequest {
        ReapplyRequest {
            subject,
            placement: PlacementMode::NotAnchored,
        }
    }
    assert_eq!(
        subject_of(&only(ReapplyMode::Unsupported), &disk),
        ReapplyResolution::Unsupported {}
    );
    assert_eq!(
        subject_of(&only(ReapplyMode::Targetless), &disk),
        ReapplyResolution::Targetless {}
    );
    assert_eq!(
        subject_of(
            &only(ReapplyMode::Refused(ReapplyRefusal::NoAnchorInBase)),
            &disk
        ),
        ReapplyResolution::Refused {
            reason: ReapplyRefusal::NoAnchorInBase
        }
    );
    assert_eq!(
        reconcile(&only(ReapplyMode::Unsupported), &disk).placement,
        ReapplyPlacement::NotAnchored {},
        "an operation that names no anchor says so rather than leaving it unanswered"
    );
} // End of function the_three_anchorless_modes_answer_from_themselves()

// ---------------------------------------------------------------------------
// The second operand: a move placed after a named snippet
// ---------------------------------------------------------------------------
//
// A move sent `after` another snippet names **two** identities, and the review of
// this step's first round found only one of them answered. Every case here
// resolves both against the same R1 and asserts each half separately, because the
// failure that matters is the one where the subject is found and the destination
// is not.

/// Both operands survive an external change that touches neither.
#[test]
fn a_move_after_an_anchor_answers_both_of_its_operands() {
    let base = snapshot(BASE);
    // R1: a comment the *file* owns, appended below both snippets.
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: ':one'
    replace: alpha

  - trigger: ':two'
    replace: beta

# a note the file owns
",
    );
    let evidence = reconcile(&move_after(&base, 1, 0), &disk);
    assert_eq!(identified_trigger(&evidence.subject), ":two");
    assert_eq!(placed_trigger(&evidence.placement), ":one");
} // End of function a_move_after_an_anchor_answers_both_of_its_operands()

/// The subject survives and the **anchor is gone**.
///
/// This is the case the generic single-operand answer could not express: an
/// identification of the moved snippet beside no evidence at all that the
/// destination is still expressible.
#[test]
fn a_moves_anchor_can_be_missing_while_its_subject_is_found() {
    let base = snapshot(BASE);
    // R1: the anchor and the comment it owned are gone; the subject is untouched.
    let disk = snapshot(
        "\
matches:
  - trigger: ':two'
    replace: beta
",
    );
    let evidence = reconcile(&move_after(&base, 1, 0), &disk);
    assert_eq!(identified_trigger(&evidence.subject), ":two");
    assert_eq!(
        placement_refusal(&evidence.placement),
        ReapplyRefusal::NoExactCorrespondence
    );
} // End of function a_moves_anchor_can_be_missing_while_its_subject_is_found()

/// The subject survives and the anchor's **bytes changed**.
///
/// The anchor still spells its trigger exactly as it did, which is what the
/// editor's weaker tier would have accepted and what a placement may not.
#[test]
fn a_moves_anchor_can_change_while_its_subject_is_found() {
    let base = snapshot(BASE);
    let disk = snapshot(
        "\
matches:
  # about the first
  - trigger: ':one'
    replace: alpha CHANGED

  - trigger: ':two'
    replace: beta
",
    );
    let evidence = reconcile(&move_after(&base, 1, 0), &disk);
    assert_eq!(identified_trigger(&evidence.subject), ":two");
    assert_eq!(
        placement_refusal(&evidence.placement),
        ReapplyRefusal::NoExactCorrespondence
    );
} // End of function a_moves_anchor_can_change_while_its_subject_is_found()

/// The subject survives and the anchor is **ambiguous**.
///
/// A second snippet written exactly the way the anchor is leaves the strongest
/// tier with two candidates, and no weaker signal may break the tie for a
/// position.
#[test]
fn a_moves_anchor_can_be_ambiguous_while_its_subject_is_found() {
    let base = snapshot(
        "\
matches:
  - trigger: ':one'
    replace: alpha

  - trigger: ':two'
    replace: beta
",
    );
    let disk = snapshot(
        "\
matches:
  - trigger: ':one'
    replace: alpha

  - trigger: ':two'
    replace: beta

  - trigger: ':one'
    replace: alpha
",
    );
    let evidence = reconcile(&move_after(&base, 1, 0), &disk);
    assert_eq!(identified_trigger(&evidence.subject), ":two");
    assert_eq!(
        placement_refusal(&evidence.placement),
        ReapplyRefusal::AmbiguousExact
    );
} // End of function a_moves_anchor_can_be_ambiguous_while_its_subject_is_found()

/// The anchor **moved to another sequence**, and the placement refuses.
///
/// D2r makes a move same-sequence, so an anchor that is no longer an item of the
/// sequence the operation was planned in is not a destination this operation can
/// express. The projection exposes one match list per document, so the second
/// sequence is produced by re-addressing the candidate — which is all the
/// sequence comparison reads.
#[test]
fn a_moves_anchor_in_another_sequence_is_not_its_anchor() {
    let base = snapshot(BASE);
    let mut disk = snapshot(BASE);
    let elsewhere = espansoconfig_core::patch::DocumentPath::root(0)
        .with_key("another_list")
        .with_index(0);
    disk.view.matches[0].path = Some(elsewhere);
    let evidence = reconcile(&move_after(&base, 1, 0), &disk);
    assert_eq!(
        identified_trigger(&evidence.subject),
        ":two",
        "the moved item is still an item of its own sequence"
    );
    assert_eq!(
        placement_refusal(&evidence.placement),
        ReapplyRefusal::NoExactCorrespondence,
        "an anchor addressed in another sequence is not a candidate at all"
    );
} // End of function a_moves_anchor_in_another_sequence_is_not_its_anchor()

/// An anchor captured from a snapshot that did not parse refuses **before** the
/// disk is consulted, and the subject is answered all the same.
#[test]
fn a_placement_anchor_that_could_not_be_captured_refuses_in_the_base() {
    let base = snapshot(BASE);
    let elsewhere = snapshot_of(2, BASE);
    let request = ReapplyRequest {
        subject: ReapplyMode::anchored(&base, &base.view.matches[1], ReapplyConfidence::ExactItem),
        // A match of another parse: no anchor can be captured for it.
        placement: PlacementMode::anchored(&base, &elsewhere.view.matches[0]),
    };
    let evidence = reconcile(&request, &base);
    assert_eq!(identified_trigger(&evidence.subject), ":two");
    assert_eq!(
        placement_refusal(&evidence.placement),
        ReapplyRefusal::NoAnchorInBase
    );
} // End of function a_placement_anchor_that_could_not_be_captured_refuses_in_the_base()

/// An anchor cannot be captured from a snapshot that did not parse.
#[test]
fn no_anchor_is_captured_from_a_snapshot_that_did_not_parse() {
    let parsed = snapshot(BASE);
    let broken = snapshot("matches:\n  - trigger: ':one'\n   replace: [unclosed\n");
    let error = ReapplyAnchor::capture(&broken, &parsed.view.matches[0])
        .expect_err("a broken base captures nothing");
    assert_eq!(error, ReapplyRefusal::NoAnchorInBase);
} // End of function no_anchor_is_captured_from_a_snapshot_that_did_not_parse()

// ---------------------------------------------------------------------------
// The corpus property
// ---------------------------------------------------------------------------

/// What one sweep of a corpus counted.
///
/// Four counts rather than one, because *"how many did the implementation let me
/// look at"* and *"how many were there to look at"* have to be compared rather
/// than conflated. `eligible` is decided by [`is_eligible`], which never consults
/// the implementation; the other three are what the implementation then did.
#[derive(Default)]
struct Sweep {
    /// Anchor attempts this sweep was obliged to make.
    eligible: usize,
    /// Attempts for which an anchor really was captured.
    captured: usize,
    /// Resolutions that identified the item the anchor came from.
    identified: usize,
    /// Resolutions that refused because an identically written twin exists.
    ambiguous: usize,
} // End of struct Sweep

/// Whether `target` is a match this module can be asked about at all.
///
/// **Decided without asking [`ReapplyAnchor::capture`], and that is the whole
/// point.** A sweep that skipped whatever `capture` refused would let the
/// implementation choose its own audit: a change that newly refused a class of
/// matches would remove that class from the property rather than fail it. The
/// condition here is the module's own documented one, restated independently — a
/// parsed snapshot, and a projected match addressed as an item of a sequence.
fn is_eligible(document: &SourceDocument, target: &espansoconfig_core::model::MatchView) -> bool {
    document.parse.is_parsed()
        && target
            .path
            .as_ref()
            .and_then(|path| path.segments().last())
            .is_some_and(|segment| segment.as_index().is_some())
} // End of function is_eligible()

/// Runs the self-resolution property over `files` and returns what it counted.
///
/// The property: for **every eligible match**, an anchor can be captured, and
/// that anchor resolves — in the same snapshot it was captured from — to the item
/// it was captured from. A capture that refuses for an eligible target is a
/// failure naming the fixture, not a skip.
///
/// The one permitted alternative outcome is `AmbiguousExact`, and it is checked
/// rather than accepted: another item of the same file must really be written
/// identically, which is a necessary condition for two items to carry the same
/// ownership bytes.
fn every_anchor_finds_itself(files: &[CorpusFile]) -> Sweep {
    let mut sweep = Sweep::default();
    for (position, file) in files.iter().enumerate() {
        let document = snapshot_of(position as u64, &file.source);
        for target in &document.view.matches {
            if !is_eligible(&document, target) {
                continue;
            }
            for confidence in BOTH {
                sweep.eligible += 1;
                let anchor = ReapplyAnchor::capture(&document, target).unwrap_or_else(|reason| {
                    panic!(
                        "{}: an eligible match captured no anchor ({reason:?}), so the sweep \
                         would have audited one fewer",
                        file.name
                    )
                });
                sweep.captured += 1;
                let resolution = subject_of(
                    &ReapplyRequest {
                        subject: ReapplyMode::Anchored { anchor, confidence },
                        placement: PlacementMode::NotAnchored,
                    },
                    &document,
                );
                match &resolution {
                    ReapplyResolution::Identified { target: found } => {
                        assert_eq!(
                            found.id, target.id,
                            "{} resolved an item to a different one",
                            file.name
                        );
                        sweep.identified += 1;
                    }
                    ReapplyResolution::Refused {
                        reason: ReapplyRefusal::AmbiguousExact,
                    } => {
                        let twins = document
                            .view
                            .matches
                            .iter()
                            .filter(|other| other.source_text == target.source_text)
                            .count();
                        assert!(
                            twins > 1,
                            "{} refused as ambiguous with no identically written twin",
                            file.name
                        );
                        sweep.ambiguous += 1;
                    }
                    other => panic!("{} resolved to {other:?}", file.name),
                } // End of the match over the two permitted outcomes
            } // End of the loop over both confidence policies
        } // End of the loop over the file's matches
    } // End of the loop over the corpus files
    assert_eq!(
        sweep.eligible, sweep.captured,
        "an eligible match went unaudited: the sweep must not be able to shrink itself"
    );
    assert_eq!(
        sweep.identified + sweep.ambiguous,
        sweep.captured,
        "every captured anchor must end in one of the two permitted outcomes"
    );
    sweep
} // End of function every_anchor_finds_itself()

/// Every anchor of the synthetic corpus finds its own item.
#[test]
fn every_synthetic_anchor_finds_its_own_item() {
    let sweep = every_anchor_finds_itself(&synthetic_valid());
    assert!(
        sweep.eligible > 100,
        "the sweep found only {} eligible matches, so it is not reading the corpus",
        sweep.eligible
    );
} // End of function every_synthetic_anchor_finds_its_own_item()

/// Every anchor of the real corpus finds its own item.
///
/// Skips cleanly when the corpus is absent, and prints a count rather than any
/// content (`CLAUDE.md` section 1). **A present corpus that produced nothing to
/// audit is a failure**, not a pass: without that assertion this test was
/// vacuous exactly when it mattered most.
#[test]
fn every_real_anchor_finds_its_own_item() {
    let files = real_corpus();
    if skip_without_real_corpus("every_real_anchor_finds_its_own_item", &files) {
        return;
    }
    let sweep = every_anchor_finds_itself(&files);
    assert!(
        sweep.eligible > 0,
        "the real corpus is present and offered no eligible match, so this test proved nothing"
    );
    println!(
        "reconcile: {} real-corpus anchors captured, {} identified, {} ambiguous",
        sweep.captured, sweep.identified, sweep.ambiguous
    );
} // End of function every_real_anchor_finds_its_own_item()
