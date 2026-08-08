/**
 * *Keep my draft*, as the part of it every surface shares — Phase 2c-4b-2.
 *
 * **No control, no choice and no sentence.** {@link ConflictChoice} has no member
 * for a reapply, `conflictChoicesFor` is byte-for-byte as 2c-4a-3 left it, and no
 * `.svelte` file was touched. What is here are the transitions, built and driven by
 * tests before anything draws them — the trade 2c-4a-2 proved, where the reload
 * transitions existed for one sub-phase before a boolean was flipped and a panel
 * drew them (`CLAUDE.md` section 6).
 *
 * ## What a reapply is, stated as the narrowest thing it does
 *
 * The design consult's Q1: **one honest path from a retained conflict to a new
 * ordinary save attempt.** Adopt the revision-bound disk snapshot 2c-4a already
 * captured, establish the correspondence 2c-4b-1's core primitive answered against
 * that exact snapshot, rebuild the pending edit or operation over the newly parsed
 * projection, withdraw the old consent, and hand the surface back a session its
 * **existing** submit path can send. It is not a merge, not a recovery system, and
 * not a retry: nothing here calls a command, nothing here writes, and an ambiguous
 * or missing target writes nothing and adopts nothing.
 *
 * ## The three things this module owns
 *
 * 1. **The gate.** {@link beginReapply} is the one place a surface's permanent
 *    {@link ConflictReapplySupport} is read, so the raw editor's *unavailable* is a
 *    declaration a transition honours rather than a fact about which functions
 *    happen to exist.
 * 2. **The evidence readers.** {@link subjectCorrespondence} and
 *    {@link anchorCorrespondence} turn `ConflictResult.reapply`'s two wire enums
 *    into the three answers a surface can act on. They are here rather than in five
 *    surfaces because a rule written once is a rule that cannot be relaxed in four
 *    places by somebody who read one of them — `./editorSave.ts`'s founding
 *    argument.
 * 3. **The adoption.** {@link adoptForReapply} spends the conflict's one
 *    authorization through the {@link AdoptTheDiskVersion} its caller passes,
 *    which on all five match surfaces is `BrowserState.adoptDiskVersion` — the
 *    existing door, whose existing authorization, spend, origin and
 *    projected-document checks precede every successful answer, whose
 *    `alreadyThere` arm is decided **and its token spent** before the projection
 *    generation is inspected at all, and whose existing projection-generation
 *    check therefore guards only the branch that installs — and answers the
 *    existing three-armed
 *    {@link DiskAdoptionOutcome}. A boolean could not carry `alreadyThere`, which
 *    the 2c-4a-2 confirmation pass proved by shipping one.
 *
 * ## The order every surface follows, and why it is that order
 *
 * **Decide first, adopt second.** Every transition computes its rebase from the
 * conflict's own disk snapshot *before* it asks the window to install anything, so
 * a refusal leaves the window exactly where it was: no projection replaced, no
 * selection repaired, no authorization spent. The alternative — adopt, then
 * discover a field collided — would move the snippet list under a person who is
 * about to be told nothing could be done.
 *
 * Nothing on this path awaits. {@link AdoptTheDiskVersion} is synchronous, so
 * consult Q9's third failure mode — *reprojection makes a correct model act on a
 * stale selection after an `await`* — has no interval to occur in here. That is a
 * property of today's signature and not a guarantee this module can enforce; a
 * later asynchronous adoption would need the guard `replaceSelection`'s callers
 * already carry.
 *
 * ## What no type here can force
 *
 * That a surface acts on the answer, that it stops on `adoptionRefused`, or that
 * the session it hands back is one this module built. Every transition is an
 * ordinary function returning an ordinary value.
 *
 * **Nor is {@link adoptForReapply} a route a caller is forced through.**
 * `reapplyAuthorizationFor`, `confirmReloadDiskVersion` and
 * `BrowserState.adoptDiskVersion` are all exported, so the two halves can be
 * composed directly and TypeScript will not object; what holds is the
 * implementation fact that **every reapply transition in this repository that
 * adopts anything takes this route** — the five match surfaces, the raw editor's
 * having no adoption function at all — and each surface's own suite is what keeps
 * it that way. What is closed regardless of the route taken to that door — by a
 * run-time check inside it rather than by a type — is narrower: no adoption can be
 * had for a conflict the window never registered, because
 * `BrowserState.adoptDiskVersion` looks the conflict's wire value up in its own
 * origin map.
 */

import type { MatchView, ReapplyEvidence, ReapplyRefusal } from '../ipc/types';
import type { AdoptTheDiskVersion } from './editorSave';
import {
  reapplyAuthorizationFor,
  type ConflictCapabilities,
  type ConflictModel,
  type DiskAdoptionOutcome
} from './saveOutcome';

/**
 * What the search for the operation's **own snippet** left a surface to work with.
 *
 * Three arms over the wire's four, and the collapse is deliberate: `Unsupported`
 * and `Targetless` are two different facts about why there is nothing to find, and
 * neither of them gives a surface a target — so a surface that needs one treats
 * both as {@link SubjectCorrespondence} `noSubject`, and the creator, which needs
 * none, reads the wire arm itself through {@link subjectIsTargetless}.
 */
export type SubjectCorrespondence =
  | {
      /** Exactly one snippet of the disk snapshot carried the evidence. */
      readonly kind: 'identified';
      /**
       * That snippet, **as the disk snapshot projects it**.
       *
       * Its `id.revision` is the conflict's `diskRevision`, because both come out
       * of one Rust read. Nothing in TypeScript expresses that pairing; what it
       * rests on is that one function in `src-tauri/src/commands.rs` builds them
       * (`docs/decisions/2c-4b-1-notes.md` D1).
       */
      readonly target: MatchView;
    }
  | {
      /** No snippet did, or more than one did. */
      readonly kind: 'refused';
      /** Which negative claim about the evidence, as the wire's own code. */
      readonly reason: ReapplyRefusal;
    }
  | {
      /** The evidence names no snippet to find: a creation, or a whole-document save. */
      readonly kind: 'noSubject';
    };

/**
 * What the search for the operation's **positional anchor** left a surface with.
 *
 * A second type rather than a reuse of {@link SubjectCorrespondence}, for the
 * reason `ReapplyPlacement` is a second wire enum: `noSubject` says *this change
 * brings its own snippet* and `notAnchored` says *this change is not placed after a
 * named one*, and one set of sentences for both would be untrue of one of them.
 */
export type AnchorCorrespondence =
  | {
      /** Exactly one snippet of the disk snapshot carried the anchor's evidence. */
      readonly kind: 'identified';
      /** That snippet, as the disk snapshot projects it. */
      readonly target: MatchView;
    }
  | {
      /** No snippet did, or more than one did, or the base recorded no anchor. */
      readonly kind: 'refused';
      /** Which negative claim about the evidence, as the wire's own code. */
      readonly reason: ReapplyRefusal;
    }
  | {
      /** The operation named no anchor, so there was no position to find again. */
      readonly kind: 'notAnchored';
    };

/**
 * Why a reapply refused, in terms every surface shares.
 *
 * Each surface unions its own arms onto this — the editor's field collisions, the
 * mover's sequence rule — because those obstacles are about that surface's own
 * value and belong beside it. What is shared is the two that are about the
 * *evidence* rather than about the operation.
 */
export type SharedReapplyObstacle =
  | {
      /** The search for the operation's own snippet refused. */
      readonly kind: 'correspondence';
      /** The wire's own code, which `tReapplyRefusal` already has sentences for. */
      readonly reason: ReapplyRefusal;
    }
  | {
      /**
       * The evidence answers a shape this surface cannot rebase onto.
       *
       * **Unreachable from the running application, and kept rather than
       * asserted away.** A `save_match`, a `delete_match`, a `duplicate_match` and
       * a `move_match` all send an anchored subject, so their conflicts answer
       * `Identified` or `Refused` and never the two empty arms — but a
       * `ReapplyEvidence` is a boundary value and nothing in TypeScript proves
       * which command produced one. Treating an empty arm as a refusal is the
       * conservative direction: it writes nothing.
       */
      readonly kind: 'evidenceNotATarget';
    };

/**
 * What became of one reapply attempt.
 *
 * **Six arms, and the two that carry a session are not one arm with a flag.**
 * `reapplied` hands back something to send; `alreadySatisfied` hands back a session
 * with nothing left to send, because the file already holds what the person asked
 * for. Collapsing them would make *the file now says what you wanted* and *press
 * save* one sentence, and the consult's Q9 names that exact false claim — *"all
 * changes reapplied" when some were merely already satisfied* — as the most likely
 * way this phase lies.
 *
 * @typeParam S - The surface's own session type.
 * @typeParam O - The surface's own obstacle type, which unions
 *   {@link SharedReapplyObstacle}.
 */
export type ReapplyOutcome<S, O> =
  | {
      /**
       * The retained intent was rebuilt over the newly parsed projection.
       *
       * **It says nothing about the save that follows.** The rebuilt session goes
       * through the surface's ordinary submit path and meets the ordinary gates:
       * it may be refused, and it may conflict again if the file moved a third
       * time. There is no retry loop here (consult Q5).
       */
      readonly kind: 'reapplied';
      /** The session to hold, rebased on the adopted snapshot. */
      readonly session: S;
    }
  | {
      /**
       * The file already holds what the retained intent asked for.
       *
       * The disk snapshot was adopted and **nothing is left to write**. Not a
       * refusal and not a success of a save: no save was attempted.
       */
      readonly kind: 'alreadySatisfied';
      /** The session to hold, over the adopted snapshot, with nothing to send. */
      readonly session: S;
    }
  | {
      /**
       * Nothing could be done automatically, and **nothing was adopted**.
       *
       * The window is exactly where it was: the projection was not replaced, the
       * selection was not repaired and the conflict's authorization was not spent.
       * Recovery from here is 2c-4c's, whole.
       */
      readonly kind: 'manualResolution';
      /** What stopped it, as a code. */
      readonly obstacle: O;
    }
  | {
      /**
       * The window refused to install the disk observation.
       *
       * A spent authorization, a conflict this window never produced, an
       * unprojected document, or a projection replaced since the conflict arrived.
       * Nothing was rebased and the session must be left as it was — the same rule
       * `reloadTheDiskVersion` follows for a refused reload.
       */
      readonly kind: 'adoptionRefused';
    }
  | {
      /** This surface can never reapply. The raw editor, and only it. */
      readonly kind: 'unavailable';
    }
  | {
      /** There was no conflict to reapply, so the window was never asked. */
      readonly kind: 'notAttempted';
    };

/**
 * Whether a surface may attempt a reapply at all, and what it would work from.
 *
 * **The one reader of {@link ConflictCapabilities.reapplySupport}.** Support is
 * checked **before** the conflict, so a surface that can never reapply says
 * `unavailable` whether or not one is showing: *this cannot be done here* is a
 * permanent fact and *there is nothing to do* is a state, and answering the second
 * for the raw editor would invite a caller to conclude the first was temporary.
 *
 * @typeParam T - The drafted value the conflict retained.
 * @param capabilities - The calling surface's own declaration.
 * @param conflict - The conflict it is showing, or `null`.
 * @returns The conflict and its evidence, or the arm to answer with.
 */
export function beginReapply<T>(
  capabilities: ConflictCapabilities,
  conflict: ConflictModel<T> | null
): ReapplyStart<T> {
  if (capabilities.reapplySupport === 'unavailable') {
    return { kind: 'unavailable' };
  }
  if (conflict === null) {
    return { kind: 'notAttempted' };
  }
  return { kind: 'ready', conflict, evidence: conflict.source.reapply };
} // End of function beginReapply()

/**
 * What {@link beginReapply} answered.
 *
 * @typeParam T - The drafted value the conflict retained.
 */
export type ReapplyStart<T> =
  | {
      /** There is a conflict and this surface may work from it. */
      readonly kind: 'ready';
      /** The conflict, carrying the disk snapshot and the retained draft. */
      readonly conflict: ConflictModel<T>;
      /**
       * The correspondence answers, as they arrived on that conflict's payload.
       *
       * Read off {@link ConflictModel.source} — the wire value itself — rather than
       * from a second call, which is consult Q9's second failure mode designed out:
       * a later `get_document` would answer a *different* observation, and a
       * perfectly correct algorithm would then resolve the wrong one.
       */
      readonly evidence: ReapplyEvidence;
    }
  | {
      /** This surface can never reapply. */
      readonly kind: 'unavailable';
    }
  | {
      /** It could, and there is no conflict showing. */
      readonly kind: 'notAttempted';
    };

/**
 * What the evidence's subject leaves a surface to work with.
 *
 * @param evidence - The correspondence answers from the conflict's payload.
 * @returns The identified snippet, the refusal, or the fact that there is no
 *   snippet to find.
 */
export function subjectCorrespondence(evidence: ReapplyEvidence): SubjectCorrespondence {
  const subject = evidence.subject;
  if ('Identified' in subject) {
    return { kind: 'identified', target: subject.Identified.target };
  }
  if ('Refused' in subject) {
    return { kind: 'refused', reason: subject.Refused.reason };
  }
  return { kind: 'noSubject' };
} // End of function subjectCorrespondence()

/**
 * Whether the evidence's subject is a creation's — *this change brings its own
 * snippet*.
 *
 * **The one place `Targetless` is told apart from `Unsupported`**, and the creator
 * is its only caller. The two are two facts (2c-4b-1's D7) and collapsing them is
 * what the consult's Q3 forbids: a creation legitimately has no target, and a
 * whole-document replacement has no target *and* no honest reapply.
 *
 * @param evidence - The correspondence answers from the conflict's payload.
 * @returns `true` only for the arm a creation's conflict carries.
 */
export function subjectIsTargetless(evidence: ReapplyEvidence): boolean {
  return 'Targetless' in evidence.subject;
} // End of function subjectIsTargetless()

/**
 * What the evidence's placement leaves a surface to work with.
 *
 * @param evidence - The correspondence answers from the conflict's payload.
 * @returns The identified anchor, the refusal, or the fact that the operation
 *   named no anchor.
 */
export function anchorCorrespondence(evidence: ReapplyEvidence): AnchorCorrespondence {
  const placement = evidence.placement;
  if ('Identified' in placement) {
    return { kind: 'identified', target: placement.Identified.target };
  }
  if ('Refused' in placement) {
    return { kind: 'refused', reason: placement.Refused.reason };
  }
  return { kind: 'notAnchored' };
} // End of function anchorCorrespondence()

/**
 * Installs the disk observation a conflict carried, for a reapply.
 *
 * **The one place a reapply asks the window to move**, and it is the existing door:
 * the authorization is {@link reapplyAuthorizationFor}'s memoized token and the
 * checks are `BrowserState.adoptDiskVersion`'s own, in that method's own order —
 * the confirmation was issued for this conflict, it has not been spent, this window
 * produced the conflict and about this file, and the document is still projected.
 * Those four precede **every** successful answer. The fifth does not: a window
 * already holding the requested revision is answered `alreadyThere`, and its token
 * spent, *before* the projection generation is inspected at all, so that last check
 * guards only the branch that would install the conflict's snapshot over a
 * projection replaced since it arrived. The answer is that method's own three arms.
 *
 * **`alreadyThere` is a success**, exactly as it is for a reload: the window holds
 * the requested bytes, so the rebase may proceed. Only `refused` stops a caller.
 *
 * **What this forces and what it does not, in the same sentence.** It forces that
 * every call for one wire conflict hands the callback the *same* token — because
 * {@link reapplyAuthorizationFor} memoizes it on `ConflictModel.source`, however
 * many {@link ConflictModel} values `describeEditSave` built over that conflict —
 * and it forces nothing whatever about what the callback then does with it, because
 * {@link AdoptTheDiskVersion} is an ordinary function type: one that ignores both
 * the token and the spend answers `installed` on every call. **At most one
 * successful adoption per wire conflict** is therefore an implementation fact about
 * the callback the five match transitions actually pass — with
 * `BrowserState.adoptDiskVersion`, the source-keyed memo and that method's
 * model-bound authorization and spent-confirmation guard together permit exactly
 * that, and no production caller passes anything else. It equally cannot force that
 * a caller checks the answer before using the session it computed, nor that a
 * caller comes through here at all: the authorization and the door are both
 * exported and composable directly (see this module's header).
 *
 * @typeParam T - The drafted value the conflict retained.
 * @param conflict - The conflict being resolved.
 * @param adopt - The window's adoption; `BrowserState.adoptDiskVersion` on every
 *   production path. Called exactly once, with this conflict's memoized token.
 * @returns What became of the request.
 */
export function adoptForReapply<T>(
  conflict: ConflictModel<T>,
  adopt: AdoptTheDiskVersion<T>
): DiskAdoptionOutcome {
  return adopt(conflict, reapplyAuthorizationFor(conflict));
} // End of function adoptForReapply()
