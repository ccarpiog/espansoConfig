//! Cross-revision correspondence — which item of a *later* parse is the item an
//! operation was planned against.
//!
//! **Phase 2c-4b-1 scope: the evidence, and nothing that acts on it.** Nothing
//! here writes a file, plans an edit, renders YAML or decides what a window
//! draws. It answers one question — *does the fresh snapshot contain exactly one
//! candidate carrying the evidence this operation permits?* — and answers it
//! **conservatively**: an ambiguous or missing candidate is a refusal, never a
//! best guess. For the editor's trigger tier, that is **provisional
//! correspondence, not proof that the original item remains**: a deletion
//! followed by the creation of an indistinguishable replacement is
//! indistinguishable here too.
//!
//! # An operation has as many correspondence operands as it has identities
//!
//! One is the common case and it is not the only one. A move placed **after**
//! another snippet has two cross-revision identities to establish — the moved
//! item and the item it is placed after — and answering only the first would
//! describe an operation whose destination may no longer be expressible while
//! looking like a complete answer. So a question is a [`ReapplyRequest`], with a
//! subject and a placement, and an answer is a [`ReapplyEvidence`], with one
//! resolution for each. Both are resolved against the **same** fresh snapshot,
//! in one call.
//!
//! # Why an identity cannot be carried across the boundary
//!
//! [`crate::model::MatchId`] is a document, a [`ContentRevision`] and a parser
//! arena index, and the revision is there **so that a reparse refuses it**
//! (`crate::model::match_view`). A [`DocumentPath`] cannot stand in for one
//! either: `matches[3]` is an address inside one parse and shifts the moment an
//! item is inserted, deleted or reordered (`crate::patch::path`). So the thing
//! that crosses a revision boundary has to be **evidence about the bytes**, and
//! that is what [`ReapplyAnchor`] is.
//!
//! # Two confidence policies, and the asymmetry is deliberate
//!
//! [`ReapplyConfidence::ExactItem`] is what a delete, a move and a duplicate
//! select for their subject: the item's **owned physical-line runs** must hash
//! equal, and exactly one item of the original sequence may do so.
//! [`ReapplyConfidence::ExactItemOrUniqueTrigger`] is the match editor's alone,
//! and it adds two weaker tiers under the exact one — the complete mapping
//! slice, and then a trigger form that was unique in the base sequence *and* is
//! unique in the fresh one. **A placement takes no such parameter**: a
//! [`PlacementMode`] resolves at exact item correspondence and there is no way
//! to ask it for anything less.
//!
//! The word *select* is exact. [`ReapplyMode::anchored`] accepts either
//! confidence for any target, so the mapping from an operation to its policy is
//! enforced by the command layer and the tests over it, never by this type.
//!
//! The weaker tier is **a policy definition of sufficient confidence, not a
//! claim of identity**. An external delete followed by the creation of an
//! indistinguishable replacement cannot be detected by anything in this module,
//! which is exactly why the tier is restricted to non-destructive field intent:
//! being wrong there costs a rewritten field, and being wrong about a delete
//! costs somebody else's snippet.
//!
//! # What is never evidence
//!
//! The item's **index**. Not as a tier, not as a tie-break, not as a hint. The
//! old index is carried on [`ReapplyAnchor::item_index`] for diagnostics and is
//! read by nothing in this module's decision path. Neither is position, nearest
//! path, common fields, search text, label, content similarity or parser node
//! number. Once a tier has more than one candidate, a weaker signal may not
//! break the tie: the answer is [`ReapplyRefusal::AmbiguousExact`] or
//! [`ReapplyRefusal::AmbiguousTrigger`], and the caller writes nothing.
//!
//! # What this module does **not** do
//!
//! It does not adopt anything, rebuild any request, clear any consent or call
//! any command. It produces a [`ReapplyEvidence`] — evidence — and every
//! decision built on it lives one layer out.

use serde::Serialize;

use crate::model::{mapping_entries, MatchView, ScalarView};
use crate::patch::{item_owned_runs, DocumentPath};
use crate::syntax::{NodeId, SyntaxIndex, TriviaIndex};
use crate::{ContentRevision, DocumentId, SourceDocument};

/// The three keys that make up a match's trigger side, in the order this module
/// recognises them. Order here is **not** source order; source order is read off
/// the mapping's own entries.
const TRIGGER_KEYS: [&str; 3] = ["trigger", "triggers", "regex"];

/// Domain separator for the digest of a match's complete mapping slice.
const MAPPING_DOMAIN: &str = "espansoconfig/reapply/mapping\u{1e}";

/// Domain separator for the digest of a sequence item's owned runs.
const RUNS_DOMAIN: &str = "espansoconfig/reapply/runs\u{1e}";

/// Domain separator for the digest of a match's trigger-form fingerprint.
const TRIGGER_DOMAIN: &str = "espansoconfig/reapply/trigger\u{1e}";

/// A match's trigger side as an **exact** fingerprint.
///
/// The presence and the **source spelling** of `trigger`, `triggers` and
/// `regex`, in the order the file writes them — never a resolved YAML value and
/// never merely the trigger the snippet list shows first (D2u). A file that
/// writes `':hi'` and one that writes `":hi"` therefore have *different*
/// fingerprints, and a wholesale reformatter that respells every trigger
/// produces an honest refusal rather than a confident wrong answer.
///
/// The spelling is digested rather than kept, so an anchor never holds a copy of
/// the owner's configuration text (`CLAUDE.md` section 1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerFingerprint {
    /// The match writes none of the three keys. There is no fingerprint, and
    /// the weaker tier has nothing to offer — see
    /// [`ReapplyRefusal::NoTriggerToMatch`].
    Absent,
    /// The digest of the trigger forms the match writes, in source order.
    Present(ContentRevision),
}

/// Everything the base snapshot knows about one item, in a form a **later**
/// parse of the same file can be searched with.
///
/// Built **before** the save transaction, from the snapshot the command
/// validated its request against, and never afterwards: an anchor derived after
/// the session's cache refreshed would describe the bytes that *caused* the
/// conflict rather than the bytes the person was working on, and a perfectly
/// correct search would then resolve the wrong observation (Phase 2c-4b design
/// consult, Q9 item 2). [`ReapplyAnchor::capture`] refuses a target whose
/// identity was not minted from the snapshot it is handed, which is how that
/// rule is enforced rather than merely intended.
///
/// It never crosses the IPC boundary. What crosses is a
/// [`ReapplyResolution`] — the answer, not the question.
#[derive(Debug, Clone)]
pub struct ReapplyAnchor {
    /// The file the item lives in.
    ///
    /// **Carried beside [`ReapplyAnchor::sequence`], because a
    /// [`DocumentPath`] names no file.** `matches[0]` of two documents is one
    /// path and two sequences, and a correspondence that ignored this would
    /// happily identify a snippet in the wrong file.
    pub document: DocumentId,
    /// The revision of the bytes the anchor was captured from.
    pub base_revision: ContentRevision,
    /// The address of the **containing sequence**: the item's path with its
    /// final index segment dropped.
    ///
    /// The document index is part of it, because a stream may hold several
    /// documents and a path that could not say which one it meant would address
    /// the wrong file half.
    pub sequence: DocumentPath,
    /// The item's index in the base sequence.
    ///
    /// **Diagnostics only.** Nothing in [`reconcile`] reads it, and nothing may
    /// start to: an index is a position, and a position was never an identity.
    pub item_index: usize,
    /// Digest of the item's **owned physical-line runs**, the envelope a lift,
    /// a deletion and a true duplicate all act on.
    ///
    /// This is the strongest tier and the only one a destructive operation may
    /// use, because it is the only one that covers the bytes those operations
    /// move or copy — the leading comment block and the inline comment
    /// included.
    pub owned_runs_digest: ContentRevision,
    /// Digest of the item's complete mapping slice
    /// ([`MatchView::source_text`]).
    ///
    /// Weaker than the runs digest in one specific way: it excludes the trivia
    /// **above** the mapping, so a snippet whose leading comment changed keeps
    /// this digest and loses the other one.
    pub mapping_digest: ContentRevision,
    /// The item's exact trigger-form fingerprint.
    pub trigger: TriggerFingerprint,
    /// Whether that fingerprint was unique **in the base sequence**.
    ///
    /// Measured here because only the base snapshot can answer it, and the
    /// weaker tier requires uniqueness on *both* sides: a base sequence that
    /// already held two snippets with the same trigger spelling gives the
    /// editor no way to tell which one it was editing.
    pub trigger_unique_in_base: bool,
}

/// How confidently an operation must identify its target.
///
/// **The command layer must select this from what the operation would do; the
/// type does not prevent a caller from selecting the weaker policy for a
/// destructive operation.** [`ReapplyMode::anchored`] accepts either value for
/// any target, so what keeps a deletion off the trigger tier is the call site in
/// `src-tauri/src/commands.rs` and the tests over it, not this enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReapplyConfidence {
    /// Exact item correspondence, and nothing weaker.
    ///
    /// Delete, move, duplicate and every positional anchor. A unique trigger is
    /// **not** enough to delete or copy a snippet whose contents changed after
    /// the person reviewed them.
    ExactItem,
    /// Exact item correspondence, else the complete mapping slice, else a
    /// trigger form unique on both sides.
    ///
    /// The match editor alone, whose worst case is a rewritten field rather
    /// than a destroyed or duplicated snippet — and whose per-field collision
    /// checks run afterwards, one layer out.
    ExactItemOrUniqueTrigger,
}

/// What an operation needs from a correspondence, as its command layer selects
/// it.
///
/// Four modes rather than three, because *"no anchor could be captured"* is a
/// fact about the **base** snapshot and is known before the transaction runs.
/// Folding it into [`ReapplyMode::Refused`] there keeps [`reconcile`] a total
/// function of a mode and a snapshot, with no second failure channel.
#[derive(Debug, Clone)]
pub enum ReapplyMode {
    /// The operation has no honest reapply at all.
    ///
    /// A whole-document replacement: there is no target, no field intent and no
    /// operation to re-resolve, so the only things "reapply" could mean are
    /// overwriting the newly read disk text with a stale string or inventing a
    /// text merge. Both are forbidden, so this is a permanent answer rather
    /// than an unimplemented one.
    Unsupported,
    /// The operation needs no match correspondence.
    ///
    /// A creation placed at the front of the list or at its end: the placement
    /// is a **semantic** choice and is lowered afresh against whatever list the
    /// fresh snapshot holds. Deliberately not the same fact as
    /// [`ReapplyMode::Unsupported`].
    Targetless,
    /// The operation names an item, and it must be found again.
    Anchored {
        /// The evidence captured from the base snapshot.
        anchor: ReapplyAnchor,
        /// How confidently it must be found.
        confidence: ReapplyConfidence,
    },
    /// No anchor could be captured from the base snapshot, so the answer is
    /// already known and the fresh snapshot is not consulted at all.
    Refused(ReapplyRefusal),
}

impl ReapplyMode {
    /// The mode an identity-aware operation takes: the anchor captured from the
    /// snapshot it validated its request against, or the refusal saying why
    /// none could be.
    ///
    /// **One call per command, at the one point the base snapshot is still in
    /// hand.** The alternative — capturing lazily, later — is the mistake Q9
    /// item 2 names: by then the session's cache may have been refreshed and
    /// the "base" would be the disk.
    ///
    /// `base` is the snapshot the command resolved its identities against, and
    /// `target` must be a match **of that snapshot**; a target from any other
    /// parse yields [`ReapplyRefusal::NoAnchorInBase`].
    pub fn anchored(
        base: &SourceDocument,
        target: &MatchView,
        confidence: ReapplyConfidence,
    ) -> ReapplyMode {
        match ReapplyAnchor::capture(base, target) {
            Ok(anchor) => ReapplyMode::Anchored { anchor, confidence },
            Err(reason) => ReapplyMode::Refused(reason),
        }
    } // End of function anchored()
} // End of impl ReapplyMode

/// What an operation's **positional anchor** needs, as its command layer selects
/// it.
///
/// A second mode rather than a second [`ReapplyMode`], because a placement has
/// no confidence to choose: an operation that inserts, lifts or lands beside a
/// named item acts on that item's position in the file, and nothing weaker than
/// [`ReapplyConfidence::ExactItem`] may say where that is. There is therefore no
/// arm here for a trigger fallback and no parameter that could ask for one.
///
/// It is also deliberately **not** an `Option<ReapplyAnchor>`: *"this operation
/// names no anchor"* and *"it names one and none could be captured"* are two
/// different facts about the base snapshot, and a `None` would spell them the
/// same way.
#[derive(Debug, Clone)]
pub enum PlacementMode {
    /// The operation names no positional anchor.
    ///
    /// A deletion, a duplication and a drafted save have no placement at all; a
    /// move to the top or the end of a list and a creation at the front or the
    /// end have a **semantic** one, which is lowered afresh against whatever
    /// list the fresh snapshot holds and needs no correspondence.
    NotAnchored,
    /// The operation is placed after a named item, which must be found again at
    /// exact item correspondence.
    Anchored(ReapplyAnchor),
    /// An anchor was named and none could be captured from the base snapshot.
    Refused(ReapplyRefusal),
} // End of enum PlacementMode

impl PlacementMode {
    /// The mode an `after` placement takes: the anchor captured from the
    /// snapshot the command validated its request against, or the refusal saying
    /// why none could be.
    ///
    /// `base` is that snapshot and `anchor` must be a match **of it**; a match
    /// from any other parse yields [`ReapplyRefusal::NoAnchorInBase`], exactly as
    /// it does for a subject.
    pub fn anchored(base: &SourceDocument, anchor: &MatchView) -> PlacementMode {
        match ReapplyAnchor::capture(base, anchor) {
            Ok(anchor) => PlacementMode::Anchored(anchor),
            Err(reason) => PlacementMode::Refused(reason),
        }
    } // End of function anchored()
} // End of impl PlacementMode

/// One operation's whole correspondence question.
///
/// **Every operand the operation would have to find again, in one value**, so
/// that a caller cannot answer half of an operation and a later phase cannot
/// discover that the other half was never asked. The fields are named at the
/// call site for the reason `crate::` callers name `SaveRequest`'s: two modes of
/// similar shape passed positionally would compile in the wrong order.
#[derive(Debug, Clone)]
pub struct ReapplyRequest {
    /// The item the operation is **about** — the moved, deleted, duplicated or
    /// drafted snippet.
    ///
    /// [`ReapplyMode::Targetless`] for a creation, which brings its own snippet
    /// and has no existing one to find; [`ReapplyMode::Unsupported`] for a
    /// whole-document replacement.
    pub subject: ReapplyMode,
    /// The item the operation is placed **after**, when it names one.
    pub placement: PlacementMode,
} // End of struct ReapplyRequest

/// Why a correspondence could not be established.
///
/// Every variant is a **negative claim about evidence**, never a claim about
/// what a user did or about what espanso would accept. None of them says the
/// snippet is gone: the strongest thing this module can say is that no candidate
/// in the snapshot it was shown carried the evidence this operation permits, or
/// that more than one did.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum ReapplyRefusal {
    /// The **base** snapshot could not produce the evidence a correspondence
    /// needs: the target is not addressable as an item of a sequence, its
    /// ownership envelope could not be derived, or the identity handed in was
    /// not minted from that snapshot. The disk was never consulted.
    NoAnchorInBase,
    /// The snapshot offered is of a different file from the one the anchor
    /// names.
    WrongDocument,
    /// The snapshot on disk did not parse, so **no projection was produced** and
    /// there is no parsed sequence to search. It is a fact about what could be
    /// derived from the bytes, never a claim about what the bytes contain.
    DiskDoesNotParse,
    /// The snapshot on disk projects **no candidate** at the anchor's sequence
    /// address. That covers an addressed sequence that is gone and one that
    /// exists but holds nothing this projection carries as a match, an empty
    /// list included.
    SequenceMissing,
    /// More than one item of that sequence carries the anchor's exact evidence,
    /// and no weaker signal may break the tie.
    AmbiguousExact,
    /// No item of that sequence carries the anchor's exact evidence, and this
    /// operation admits no weaker tier.
    NoExactCorrespondence,
    /// The weaker tier ran and no item of the sequence carries the anchor's
    /// exact trigger fingerprint. The item may be absent, or its trigger may
    /// have been rewritten or respelled; this module cannot tell those apart and
    /// no string built on it may.
    TargetMissingOrTriggerChanged,
    /// The trigger fingerprint is not unique — in the base sequence, in the
    /// fresh one, or in both — so it identifies nothing.
    AmbiguousTrigger,
    /// The anchored item writes none of `trigger`, `triggers` and `regex`, so
    /// the weaker tier has no fingerprint to search with.
    NoTriggerToMatch,
}

/// What the search for an operation's **subject** found, as it crosses the IPC
/// boundary.
///
/// **Evidence, not an instruction.** `Identified` says exactly one item of the
/// fresh snapshot carries the anchor's evidence at a tier this operation
/// accepts; it does **not** say the operation will succeed, that the person's
/// fields still apply, that nothing else changed, or that the file cannot change
/// again — and where the tier that answered was the editor's trigger fallback,
/// it does not prove the item is the original one either.
///
/// Every variant is a struct variant, including the two with no operands, so the
/// enum crosses `serde`'s externally tagged representation as a **uniform
/// object** — `{"Targetless":{}}`, never the bare string a unit variant would
/// produce. That is the rule `crate::model` and `crate::draft` already follow,
/// and it is what lets a frontend type-guard it without a special case per
/// variant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ReapplyResolution {
    /// The operation has no honest reapply, whatever the disk holds.
    Unsupported {},
    /// The operation needs no correspondence.
    Targetless {},
    /// Exactly one item of the anchor's sequence carries its evidence, at a
    /// tier this operation accepts.
    Identified {
        /// That item, **projected from the fresh snapshot**, with the identity
        /// and the revision that snapshot mints. It is never the base
        /// snapshot's view of anything.
        ///
        /// Boxed for the reason `SaveResult::Conflict::disk` is: a
        /// [`MatchView`] is far larger than every other operand here, and
        /// `Box<T>` serializes as `T`, so the wire shape is unaffected.
        target: Box<MatchView>,
    },
    /// No correspondence this operation may act on.
    Refused {
        /// The narrowest true reason.
        reason: ReapplyRefusal,
    },
} // End of enum ReapplyResolution

/// What the search for an operation's **positional anchor** found.
///
/// A second enum rather than a reuse of [`ReapplyResolution`], because the two
/// slots answer two different questions and their empty arms are two different
/// facts. `Targetless` there says *this operation brings its own snippet*;
/// [`ReapplyPlacement::NotAnchored`] here says *this operation is not placed
/// after a named one*. One sentence for both would be untrue of one of them,
/// which is the same reason `Targetless` and `Unsupported` were never collapsed.
///
/// There is no `Unsupported` arm: a whole-document replacement names no anchor,
/// which is exactly `NotAnchored`, and the fact that it has no honest reapply at
/// all is already said once, by its subject.
///
/// Every arm is a struct variant, including the empty one, for
/// [`ReapplyResolution`]'s reason: one shape per wire enum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ReapplyPlacement {
    /// This operation names no positional anchor, so there was nothing to find.
    NotAnchored {},
    /// Exactly one item of the anchor's sequence carries its exact evidence.
    Identified {
        /// That item, **projected from the fresh snapshot**.
        ///
        /// Boxed for [`ReapplyResolution::Identified`]'s reason, and `Box<T>`
        /// serializes as `T`, so the wire shape is unaffected.
        target: Box<MatchView>,
    },
    /// Correspondence for the named anchor could not be established, so no
    /// destination may be derived from this evidence.
    Refused {
        /// The narrowest true reason.
        reason: ReapplyRefusal,
    },
} // End of enum ReapplyPlacement

/// Both correspondence operands of one refused operation, answered against one
/// snapshot.
///
/// **The whole answer, so that half an answer cannot be mistaken for one.** A
/// move placed after another snippet is expressible again only when *both* its
/// subject and its placement were found; a caller that read only
/// [`ReapplyEvidence::subject`] would have a correct identification of the moved
/// item and no evidence at all about where it was asked to go.
///
/// Both fields come out of one [`reconcile`] call against one `fresh`
/// `SourceDocument`. Rust ties no field of a struct to another, so what holds
/// that is the single production caller — the same thing that holds the
/// conflict payload's text to its revision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReapplyEvidence {
    /// What the search for the operation's own item found.
    pub subject: ReapplyResolution,
    /// What the search for the operation's positional anchor found.
    pub placement: ReapplyPlacement,
} // End of struct ReapplyEvidence

impl ReapplyAnchor {
    /// Captures the evidence describing `target` inside `base`.
    ///
    /// # What it refuses, and why each refusal is reachable
    ///
    /// [`ReapplyRefusal::NoAnchorInBase`] for all four of: an identity that was
    /// not minted from `base` (which is the guard against a lazily derived
    /// anchor), a document that did not parse, a match `base` carries no
    /// sequence-item path for — routine for `save_match`, which never required
    /// one — and an ownership envelope the text layer could not derive.
    ///
    /// # Errors
    ///
    /// [`ReapplyRefusal::NoAnchorInBase`], the only refusal a capture can
    /// produce. Every other variant is about a snapshot this function does not
    /// look at.
    pub fn capture(
        base: &SourceDocument,
        target: &MatchView,
    ) -> Result<ReapplyAnchor, ReapplyRefusal> {
        // The identity must have been minted from *this* snapshot. Without it a
        // caller could hand in a match from a refreshed cache and the anchor
        // would silently describe the disk rather than the base.
        if target.id.document != base.view.id || target.id.revision != base.view.revision {
            return Err(ReapplyRefusal::NoAnchorInBase);
        }
        let (Some(index), Some(trivia)) = (base.parse.syntax(), base.parse.trivia()) else {
            return Err(ReapplyRefusal::NoAnchorInBase);
        };
        let path = target.path.as_ref().ok_or(ReapplyRefusal::NoAnchorInBase)?;
        let (sequence, item_index) = split_sequence(path).ok_or(ReapplyRefusal::NoAnchorInBase)?;
        let owned_runs_digest = owned_runs_digest(base, index, trivia, target.source_node)
            .ok_or(ReapplyRefusal::NoAnchorInBase)?;
        let trigger = trigger_fingerprint(&base.source, index, target.source_node);
        let trigger_unique_in_base = match trigger {
            TriggerFingerprint::Absent => false,
            TriggerFingerprint::Present(digest) => {
                base.view
                    .matches
                    .iter()
                    .filter(|candidate| {
                        in_sequence(candidate, &sequence)
                            && trigger_fingerprint(&base.source, index, candidate.source_node)
                                == TriggerFingerprint::Present(digest)
                    })
                    .count()
                    == 1
            }
        };
        Ok(ReapplyAnchor {
            document: base.view.id,
            base_revision: base.view.revision,
            sequence,
            item_index,
            owned_runs_digest,
            mapping_digest: digest_of(MAPPING_DOMAIN, target.source_text.as_bytes()),
            trigger,
            trigger_unique_in_base,
        })
    } // End of function capture()
} // End of impl ReapplyAnchor

/// Resolves **both** of one operation's anchors against a **fresh** snapshot of
/// its file.
///
/// `fresh` must be the exact snapshot whose revision the caller is about to
/// report beside this answer. Handing in any other read makes a correct search
/// describe an observation nobody was shown, which is the failure Q9 item 2
/// names; `crate::` callers get that right by taking all of text, revision,
/// projection and this answer out of one `SourceDocument`.
///
/// **One call, one snapshot, two answers.** The subject and the placement are
/// resolved here rather than by two calls a caller could make against two reads:
/// a move whose subject was found in one observation and whose destination was
/// checked in another describes no file that ever existed.
///
/// The tiers, in order, and none of them may be reordered:
///
/// 1. document identity, a parsed snapshot, and at least one item at the
///    anchor's sequence address;
/// 2. the **owned-run** digest. Exactly one is an exact operation
///    correspondence; more than one is [`ReapplyRefusal::AmbiguousExact`]; none
///    continues — or refuses, for [`ReapplyConfidence::ExactItem`];
/// 3. the **mapping-slice** digest, for the editor only. Exactly one is an
///    exact match correspondence; more than one is
///    [`ReapplyRefusal::AmbiguousExact`]; none continues;
/// 4. the **trigger fingerprint**, for the editor only, and only when it was
///    unique in the base sequence and is unique here.
///
/// A placement takes tiers 1 and 2 and stops: it is always
/// [`ReapplyConfidence::ExactItem`].
pub fn reconcile(request: &ReapplyRequest, fresh: &SourceDocument) -> ReapplyEvidence {
    ReapplyEvidence {
        subject: reconcile_subject(&request.subject, fresh),
        placement: reconcile_placement(&request.placement, fresh),
    }
} // End of function reconcile()

/// The subject half of [`reconcile`].
///
/// Separate so that each half reads as its own modes, and so that neither can be
/// given a snapshot the other did not see: both are called from one expression,
/// with one `fresh`.
fn reconcile_subject(mode: &ReapplyMode, fresh: &SourceDocument) -> ReapplyResolution {
    match mode {
        ReapplyMode::Unsupported => ReapplyResolution::Unsupported {},
        ReapplyMode::Targetless => ReapplyResolution::Targetless {},
        ReapplyMode::Refused(reason) => ReapplyResolution::Refused { reason: *reason },
        ReapplyMode::Anchored { anchor, confidence } => match resolve(anchor, *confidence, fresh) {
            Ok(target) => ReapplyResolution::Identified {
                target: Box::new(target.clone()),
            },
            Err(reason) => ReapplyResolution::Refused { reason },
        },
    } // End of the match over the four modes a command can select
} // End of function reconcile_subject()

/// The placement half of [`reconcile`].
///
/// Always [`ReapplyConfidence::ExactItem`], and there is no parameter that could
/// ask for anything else: an anchor decides where bytes are inserted or landed,
/// and a snippet that merely still spells its trigger the same way is not
/// evidence of a position.
fn reconcile_placement(mode: &PlacementMode, fresh: &SourceDocument) -> ReapplyPlacement {
    match mode {
        PlacementMode::NotAnchored => ReapplyPlacement::NotAnchored {},
        PlacementMode::Refused(reason) => ReapplyPlacement::Refused { reason: *reason },
        PlacementMode::Anchored(anchor) => {
            match resolve(anchor, ReapplyConfidence::ExactItem, fresh) {
                Ok(target) => ReapplyPlacement::Identified {
                    target: Box::new(target.clone()),
                },
                Err(reason) => ReapplyPlacement::Refused { reason },
            }
        }
    } // End of the match over the three modes a placement can be in
} // End of function reconcile_placement()

/// The tier walk itself, over the candidates of one sequence.
///
/// Split out so that [`reconcile`] reads as the four modes and this reads as the
/// four tiers, and so that every refusal below is returned from one place.
fn resolve<'a>(
    anchor: &ReapplyAnchor,
    confidence: ReapplyConfidence,
    fresh: &'a SourceDocument,
) -> Result<&'a MatchView, ReapplyRefusal> {
    if anchor.document != fresh.view.id {
        return Err(ReapplyRefusal::WrongDocument);
    }
    let (Some(index), Some(trivia)) = (fresh.parse.syntax(), fresh.parse.trivia()) else {
        return Err(ReapplyRefusal::DiskDoesNotParse);
    };
    let candidates: Vec<&MatchView> = fresh
        .view
        .matches
        .iter()
        .filter(|candidate| in_sequence(candidate, &anchor.sequence))
        .collect();
    if candidates.is_empty() {
        return Err(ReapplyRefusal::SequenceMissing);
    }

    // Tier 2 — the ownership envelope. The only tier a destructive operation
    // may act on, because it is the only one that covers the bytes such an
    // operation moves, deletes or copies.
    let exact: Vec<&MatchView> = candidates
        .iter()
        .copied()
        .filter(|candidate| {
            owned_runs_digest(fresh, index, trivia, candidate.source_node)
                == Some(anchor.owned_runs_digest)
        })
        .collect();
    match exact.len() {
        1 => return Ok(exact[0]),
        0 => {}
        _ => return Err(ReapplyRefusal::AmbiguousExact),
    }
    if confidence == ReapplyConfidence::ExactItem {
        return Err(ReapplyRefusal::NoExactCorrespondence);
    }

    // Tier 3 — the complete mapping slice. It survives a change to the trivia
    // *above* the item, which is the one thing tier 2 cannot see past, and it is
    // deliberately not offered to an operation that acts on the envelope.
    let same_mapping: Vec<&MatchView> = candidates
        .iter()
        .copied()
        .filter(|candidate| {
            digest_of(MAPPING_DOMAIN, candidate.source_text.as_bytes()) == anchor.mapping_digest
        })
        .collect();
    match same_mapping.len() {
        1 => return Ok(same_mapping[0]),
        0 => {}
        _ => return Err(ReapplyRefusal::AmbiguousExact),
    }

    // Tier 4 — the exact trigger form, unique on both sides. A provisional
    // correspondence, and the field collision checks that follow it live one
    // layer out.
    let TriggerFingerprint::Present(_) = anchor.trigger else {
        return Err(ReapplyRefusal::NoTriggerToMatch);
    };
    if !anchor.trigger_unique_in_base {
        return Err(ReapplyRefusal::AmbiguousTrigger);
    }
    let same_trigger: Vec<&MatchView> = candidates
        .iter()
        .copied()
        .filter(|candidate| {
            trigger_fingerprint(&fresh.source, index, candidate.source_node) == anchor.trigger
        })
        .collect();
    match same_trigger.len() {
        1 => Ok(same_trigger[0]),
        0 => Err(ReapplyRefusal::TargetMissingOrTriggerChanged),
        _ => Err(ReapplyRefusal::AmbiguousTrigger),
    }
} // End of function resolve()

/// Whether `candidate` is an item of the sequence `sequence` addresses.
///
/// Compares the **path head**, never the final index: the index is what shifts,
/// and it is the one signal this module refuses to consult.
fn in_sequence(candidate: &MatchView, sequence: &DocumentPath) -> bool {
    candidate
        .path
        .as_ref()
        .and_then(split_sequence)
        .is_some_and(|(head, _)| &head == sequence)
} // End of function in_sequence()

/// The sequence a path's last segment indexes, and that index.
///
/// `None` when the path does not end in a sequence position, which is the only
/// shape this module can anchor: an item of a sequence.
fn split_sequence(path: &DocumentPath) -> Option<(DocumentPath, usize)> {
    let (last, head) = path.segments().split_last()?;
    let index = last.as_index()?;
    Some((
        DocumentPath::new(path.document_index(), head.to_vec()),
        index,
    ))
} // End of function split_sequence()

/// Digests one domain's bytes.
///
/// The domain separator is prepended so that two tiers can never accidentally
/// compare equal through a coincidence of their inputs: the runs digest of an
/// item and the mapping digest of another are different values even where the
/// bytes hashed happen to agree.
fn digest_of(domain: &str, bytes: &[u8]) -> ContentRevision {
    let mut buffer = Vec::with_capacity(domain.len() + bytes.len());
    buffer.extend_from_slice(domain.as_bytes());
    buffer.extend_from_slice(bytes);
    ContentRevision::of_bytes(&buffer)
} // End of function digest_of()

/// Digests the owned physical-line runs of the sequence item `item` names.
///
/// The runs come from `crate::patch`'s own textual derivation — the one a
/// removal is bounded by and a duplicate's clone is made of — so a change to
/// what an item owns changes this digest by construction rather than by
/// agreement between two copies of the rule.
///
/// **Each run is length-prefixed.** Concatenating the bytes alone would let two
/// different splittings of the same text hash equal, and the splitting is
/// exactly what a comment changing hands alters.
///
/// `None` when the ownership envelope could not be derived, or when a run does
/// not slice the source — both of which are defects in this crate rather than
/// documents a user can write, and both of which refuse rather than guess.
fn owned_runs_digest(
    document: &SourceDocument,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    item: NodeId,
) -> Option<ContentRevision> {
    let runs = item_owned_runs(&document.source, index, trivia, item)?;
    let mut buffer = String::new();
    for run in runs {
        let taken = run.slice(&document.source)?;
        buffer.push_str(&taken.len().to_string());
        buffer.push('\u{1f}');
        buffer.push_str(taken);
        buffer.push('\u{1e}');
    } // End of the loop that length-prefixes every owned run
    Some(digest_of(RUNS_DOMAIN, buffer.as_bytes()))
} // End of function owned_runs_digest()

/// The exact trigger-form fingerprint of the match mapping `item` names.
///
/// Walks the mapping's **own entries in source order** and records, for every
/// occurrence of `trigger`, `triggers` and `regex`, the decoded key and the
/// value node's source bytes verbatim. A duplicate key is recorded twice,
/// because the file writes it twice.
///
/// The key is decoded — so `'trigger':` and `trigger:` are the same key, which
/// is what the path resolver already decides — while the **value** is the source
/// slice and is never decoded, which is what makes this a fact about how the
/// file is written rather than about what it means (D2u).
fn trigger_fingerprint(source: &str, index: &SyntaxIndex, item: NodeId) -> TriggerFingerprint {
    let mut buffer = String::new();
    let mut present = false;
    for (key_node, value_node) in mapping_entries(index, item) {
        let Some(key) = index
            .node(key_node)
            .and_then(|node| ScalarView::project(source, node))
        else {
            continue;
        };
        if !TRIGGER_KEYS.contains(&key.text.as_str()) {
            continue;
        }
        let spelling = index
            .node(value_node)
            .and_then(|node| node.span.slice(source))
            .unwrap_or_default();
        present = true;
        buffer.push_str(&key.text);
        buffer.push('\u{1f}');
        buffer.push_str(&spelling.len().to_string());
        buffer.push('\u{1f}');
        buffer.push_str(spelling);
        buffer.push('\u{1e}');
    } // End of the loop over the match mapping's entries, in source order
    if !present {
        return TriggerFingerprint::Absent;
    }
    TriggerFingerprint::Present(digest_of(TRIGGER_DOMAIN, buffer.as_bytes()))
} // End of function trigger_fingerprint()

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::DocumentContext;
    use crate::workspace::project_source;

    /// A neutral, hand-authored document (CLAUDE.md section 1).
    const BASE: &str = "matches:\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha\n\n  - trigger: ':two'\n    replace: beta\n";

    /// Projects a source string as a detached snapshot.
    fn snapshot(source: &str) -> SourceDocument {
        project_source(
            &DocumentContext::detached(DocumentId(7), "match/a.yml"),
            source,
        )
    }

    /// The anchor of the `index`-th match of `document`.
    fn anchor_of(document: &SourceDocument, index: usize) -> ReapplyAnchor {
        ReapplyAnchor::capture(document, &document.view.matches[index]).expect("an anchor")
    }

    /// A request that asks only about a subject.
    fn subject_only(subject: ReapplyMode) -> ReapplyRequest {
        ReapplyRequest {
            subject,
            placement: PlacementMode::NotAnchored,
        }
    }

    /// The subject half of resolving `subject` against `fresh`.
    fn subject_of(subject: ReapplyMode, fresh: &SourceDocument) -> ReapplyResolution {
        reconcile(&subject_only(subject), fresh).subject
    }

    #[test]
    fn an_anchor_resolves_to_its_own_item_in_its_own_snapshot() {
        let base = snapshot(BASE);
        for confidence in [
            ReapplyConfidence::ExactItem,
            ReapplyConfidence::ExactItemOrUniqueTrigger,
        ] {
            let mode = ReapplyMode::anchored(&base, &base.view.matches[1], confidence);
            let resolution = subject_of(mode, &base);
            let ReapplyResolution::Identified { target } = resolution else {
                panic!("an item must resolve to itself: {resolution:?}");
            };
            assert_eq!(target.id, base.view.matches[1].id);
        }
    } // End of function an_anchor_resolves_to_its_own_item_in_its_own_snapshot()

    #[test]
    fn the_old_index_is_carried_but_never_consulted() {
        let base = snapshot(BASE);
        let anchor = anchor_of(&base, 1);
        assert_eq!(anchor.item_index, 1);
        // The same two snippets, in the other order.
        let reordered = snapshot("matches:\n  - trigger: ':two'\n    replace: beta\n\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha\n");
        let mode = ReapplyMode::Anchored {
            anchor,
            confidence: ReapplyConfidence::ExactItem,
        };
        let ReapplyResolution::Identified { target } = subject_of(mode, &reordered) else {
            panic!("a reordered sequence still holds the item");
        };
        assert_eq!(
            target.trigger.trigger.as_ref().map(|s| s.text.as_str()),
            Some(":two")
        );
    } // End of function the_old_index_is_carried_but_never_consulted()

    #[test]
    fn a_mode_with_no_anchor_answers_without_reading_the_disk() {
        let base = snapshot(BASE);
        assert_eq!(
            subject_of(ReapplyMode::Unsupported, &base),
            ReapplyResolution::Unsupported {}
        );
        assert_eq!(
            subject_of(ReapplyMode::Targetless, &base),
            ReapplyResolution::Targetless {}
        );
        assert_eq!(
            subject_of(ReapplyMode::Refused(ReapplyRefusal::NoAnchorInBase), &base),
            ReapplyResolution::Refused {
                reason: ReapplyRefusal::NoAnchorInBase
            }
        );
    } // End of function a_mode_with_no_anchor_answers_without_reading_the_disk()

    #[test]
    fn an_identity_from_another_parse_captures_no_anchor() {
        let base = snapshot(BASE);
        let later = snapshot(&format!("{BASE}\n# appended\n"));
        // The match belongs to `later`; the snapshot handed in is `base`.
        let error = ReapplyAnchor::capture(&base, &later.view.matches[0])
            .expect_err("a target from another parse is refused");
        assert_eq!(error, ReapplyRefusal::NoAnchorInBase);
    } // End of function an_identity_from_another_parse_captures_no_anchor()

    /// Two identically written items are told apart by the **sequence their
    /// paths name**, inside one document.
    ///
    /// The projection exposes exactly one match list per document today, so a
    /// second sequence cannot be produced by parsing a file; it is produced here
    /// by moving one candidate's public [`crate::patch::DocumentPath`] under a
    /// different head, which is all [`in_sequence`] reads.
    ///
    /// **The premise is asserted first.** With both items under `matches`, the
    /// anchor is `AmbiguousExact`: two items written the same way carry the same
    /// owned-run digest. Moving one of them to another sequence leaves exactly
    /// one candidate, so the answer becomes an identification — and an
    /// implementation that compared only the document, or only the final index,
    /// would still see two candidates and still refuse.
    #[test]
    fn two_sequences_of_one_document_are_two_sequences() {
        const TWINS: &str = "matches:\n  - trigger: ':dup'\n    replace: same\n\n  - trigger: ':dup'\n    replace: same\n";
        let base = snapshot(TWINS);
        let anchor = anchor_of(&base, 0);
        assert_eq!(
            subject_of(
                ReapplyMode::Anchored {
                    anchor: anchor.clone(),
                    confidence: ReapplyConfidence::ExactItem,
                },
                &base,
            ),
            ReapplyResolution::Refused {
                reason: ReapplyRefusal::AmbiguousExact
            },
            "the premise: both twins are candidates while both are in one sequence"
        );

        // The same document, with the second twin addressed as an item of a
        // *different* sequence. Nothing else about it changes: same bytes, same
        // node, same digests.
        let mut fresh = snapshot(TWINS);
        let elsewhere = DocumentPath::root(anchor.sequence.document_index())
            .with_key("another_list")
            .with_index(0);
        fresh.view.matches[1].path = Some(elsewhere);
        let ReapplyResolution::Identified { target } = subject_of(
            ReapplyMode::Anchored {
                anchor,
                confidence: ReapplyConfidence::ExactItem,
            },
            &fresh,
        ) else {
            panic!("one candidate remains in the anchor's own sequence");
        };
        assert_eq!(
            target.id, fresh.view.matches[0].id,
            "the candidate in the anchor's sequence is the one identified"
        );
    } // End of function two_sequences_of_one_document_are_two_sequences()

    #[test]
    fn a_placement_with_no_anchor_answers_without_reading_the_disk() {
        let base = snapshot(BASE);
        let evidence = reconcile(&subject_only(ReapplyMode::Unsupported), &base);
        assert_eq!(evidence.placement, ReapplyPlacement::NotAnchored {});
        let refused = reconcile(
            &ReapplyRequest {
                subject: ReapplyMode::Targetless,
                placement: PlacementMode::Refused(ReapplyRefusal::NoAnchorInBase),
            },
            &base,
        );
        assert_eq!(
            refused.placement,
            ReapplyPlacement::Refused {
                reason: ReapplyRefusal::NoAnchorInBase
            }
        );
    } // End of function a_placement_with_no_anchor_answers_without_reading_the_disk()

    /// A placement takes exact item correspondence and has no way to ask for
    /// less.
    ///
    /// The same pair that lets the editor's subject fall back to a unique
    /// unchanged trigger refuses as a placement, which is the asymmetry stated
    /// once more where the second operand can be got wrong.
    #[test]
    fn a_placement_never_falls_back_to_a_trigger() {
        let base = snapshot(BASE);
        // The anchor item keeps its trigger and loses its bytes.
        let disk = snapshot("matches:\n  # the first snippet\n  - trigger: ':one'\n    replace: alpha CHANGED\n\n  - trigger: ':two'\n    replace: beta\n");
        let evidence = reconcile(
            &ReapplyRequest {
                subject: ReapplyMode::Targetless,
                placement: PlacementMode::anchored(&base, &base.view.matches[0]),
            },
            &disk,
        );
        assert_eq!(evidence.subject, ReapplyResolution::Targetless {});
        assert_eq!(
            evidence.placement,
            ReapplyPlacement::Refused {
                reason: ReapplyRefusal::NoExactCorrespondence
            }
        );
    } // End of function a_placement_never_falls_back_to_a_trigger()
}
