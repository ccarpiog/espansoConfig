/**
 * *Keep my draft*, as the part of it every surface shares — Phase 2c-4b-2, drawn
 * at 2c-4b-3.
 *
 * **The transitions came first and the control came second**, which is the trade
 * 2c-4a-2 proved: at 2c-4b-2 every function below existed and was driven by tests
 * while `ConflictChoice` had no member a reapply control could be named by, and
 * 2c-4b-3 then added the member, the `offersReapply` boolean and the panels
 * together, inventing no machinery (`CLAUDE.md` section 6). What this module gained
 * at 2c-4b-3 is the presentation half and nothing else: {@link ReapplyOutcomeCode}
 * with its key function, {@link sharedReapplyObstacleKey}, and the
 * {@link ReapplyAttempt} pair a panel holds one attempt in. No transition changed.
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
 * 1. **The gate.** {@link beginReapply} and, since Phase 2d-6-2,
 *    {@link enterReapply} are the two places a surface's permanent
 *    {@link ConflictReapplySupport} is read, so the raw editor's and restore's
 *    *unavailable* is a declaration a transition honours rather than a fact about
 *    which functions happen to exist. `enterReapply` is the same gate over
 *    **both** origins, answering `reapplyEvidenceFor`'s four arms on its `ready`
 *    arm; since Phase 2d-6-5 all eight surfaces enter there — the six that can
 *    reapply, and the raw editor and restore, which it answers `unavailable`
 *    before it looks at the conflict — and `beginReapply` has no production
 *    caller left: it is kept as the save-only predecessor its doc names, driven
 *    by `reapply.test.ts` alone.
 * 2. **The evidence readers.** {@link subjectCorrespondence} and
 *    {@link anchorCorrespondence} turn `ConflictResult.reapply`'s two wire enums
 *    into the three answers a surface can act on. They are here rather than in five
 *    surfaces because a rule written once is a rule that cannot be relaxed in four
 *    places by somebody who read one of them — `./editorSave.ts`'s founding
 *    argument. Since Phase 2d-5-5a {@link reapplyEvidenceFor} sits above them and
 *    decides *which* evidence there is to read: a refused save's own
 *    `ReapplyEvidence`, or a watcher observation's whole-file correspondence table
 *    with its two revisions checked (rulings 23 and 24). Since Phase 2d-6-2
 *    {@link correspondenceRowFor} finds one snippet's row in that table by its
 *    **full** base identity — never by array index or arena node — and
 *    {@link subjectResolution} reads a row's answer with the same three-arm rule
 *    the refused save's subject gets (the 2d-6 record's §3 entry 20); since Phase
 *    2d-6-3 {@link anchorResolution} reads a row's `exact` tier as an **anchor**,
 *    with `notAnchored` as its third arm, for the creator's `after` placement and,
 *    since Phase 2d-6-4, the mover's — both from the same table the subject's row
 *    is read from.
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
 * and restore's having no adoption function at all — and each surface's own suite
 * is what keeps it that way. What is closed regardless of the route taken to that door — by a
 * run-time check inside it rather than by a type — is narrower: no adoption can be
 * had for a conflict the window never registered, because
 * `BrowserState.adoptDiskVersion` looks the conflict's wire value up in its own
 * origin map.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  CorrespondenceEntry,
  CorrespondenceTable,
  MatchId,
  MatchView,
  ReapplyEvidence,
  ReapplyRefusal,
  ReapplyResolution
} from '../ipc/types';
import type { ConflictSource, SaveConflictSource } from './conflictSource';
import type { AdoptTheDiskVersion } from './editorSave';
import {
  reapplyAuthorizationFor,
  type ConflictCapabilities,
  type ConflictModel,
  type DiskAdoptionOutcome,
  type SaveConflictModel
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
       * The window holds the disk snapshot and **nothing is left to write**. Not a
       * refusal and not a success of a save: no save was attempted. *Holds*, not
       * *was moved to*: the adoption answered `installed` or `alreadyThere`, and
       * the second means this attempt installed nothing because the window was
       * already there.
       */
      readonly kind: 'alreadySatisfied';
      /** The session to hold, over that snapshot, with nothing to send. */
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
       * An authorization issued for another conflict, one already spent, a
       * conflict this window never produced, an unprojected document, or a
       * projection replaced since the conflict arrived when the window does not
       * already hold the requested revision — `BrowserState.adoptDiskVersion`'s
       * guards **in its order**, not a set applied alike. A window that has passed
       * the four guards ahead of it and reprojected to those exact bytes is
       * answered `alreadyThere`, which is a success, and that arm is settled before
       * the projection generation is compared at all.
       * Nothing was rebased and the session must be left as it was — the same rule
       * `reloadTheDiskVersion` follows for a refused reload.
       *
       * **It does not encode a permanent cause.** The answer names no cause, so
       * this arm cannot say which guard refused. A refusal spends nothing, which
       * rules out only this attempt newly causing the spent-authorization refusal;
       * the other four guards are asked again from the top on a later attempt and
       * nothing here says they will pass. Nothing here promises that pressing again
       * is futile, and nothing promises it will help.
       */
      readonly kind: 'adoptionRefused';
    }
  | {
      /** This surface can never reapply. The raw editor and restore, and only they. */
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
 * **It takes a save-origin conflict, and the restriction is the parameter type
 * rather than an arm** — Phase 2d-5-5a. Every one of this type's arms is a sentence
 * about a save: `ready` hands back a {@link ReapplyEvidence}, which is the subject
 * and placement one refused *operation* was resolved for, and an external change
 * resolves no operation at all — it carries a whole-file
 * {@link CorrespondenceTable} instead, read through {@link reapplyEvidenceFor}.
 * Answering `unavailable` or `notAttempted` for an external conflict would each
 * have been a false sentence, so the compiler refuses one here instead.
 * **What that does not force**: nothing stops a later caller widening this
 * parameter back to the union and reintroducing the choice; what would then be
 * needed is a new arm, not a reused one.
 *
 * **The save-only predecessor of {@link enterReapply}, since Phase 2d-6-2.** The
 * match editor enters through that one, which takes either origin and answers
 * with `reapplyEvidenceFor`'s four distinct arms; since Phase 2d-6-3 so do the
 * new-snippet form and the recovery form, since Phase 2d-6-4 the deleter, the
 * mover and the duplicator, and since Phase 2d-6-5 the raw editor and restore,
 * whose `unavailable` it answers before it looks at the conflict. **No production
 * transition enters here any more**; `reapply.test.ts` still drives it, and it
 * stays because the save-origin gate is what `enterReapply` generalized and the
 * suite's cases about it are the record of that. Nothing in TypeScript stops a
 * surface entering here again; what it would forfeit is the external origin,
 * which this signature refuses at compile time.
 *
 * @typeParam T - The drafted value the conflict retained.
 * @param capabilities - The calling surface's own declaration.
 * @param conflict - The save conflict it is showing, or `null`.
 * @returns The conflict and its evidence, or the arm to answer with.
 */
export function beginReapply<T>(
  capabilities: ConflictCapabilities,
  conflict: SaveConflictModel<T> | null
): ReapplyStart<T> {
  if (capabilities.reapplySupport === 'unavailable') {
    return { kind: 'unavailable' };
  }
  if (conflict === null) {
    return { kind: 'notAttempted' };
  }
  return { kind: 'ready', conflict, evidence: saveReapplyEvidence(conflict.source) };
} // End of function beginReapply()

/**
 * What {@link enterReapply} answered — the reapply entry protocol over **both**
 * origins, Phase 2d-6-2 (the 2d-6 record's §3 entry 19).
 *
 * {@link ReapplyStart}'s shape with one difference that is the whole point: the
 * `ready` arm carries a {@link ReapplyEvidenceAccess} and not a `ReapplyEvidence`,
 * so a surface that enters here switches over the four distinct answers — save
 * evidence, external correspondence, a specific refusal, superseded evidence —
 * and cannot read a correspondence table as if it were a refused save's own
 * answers. **The type forces the four to stay apart; it cannot force a surface
 * to act on each honestly** — a surface that mapped every non-save arm to one
 * sentence would compile, and its own suite is what stops it.
 *
 * @typeParam T - The drafted value the conflict retained.
 */
export type ReapplyEntry<T> =
  | {
      /** There is a conflict of either origin and this surface may work from it. */
      readonly kind: 'ready';
      /** The conflict, carrying the disk snapshot and the retained draft. */
      readonly conflict: ConflictModel<T>;
      /**
       * Which evidence its origin offers, with the live supersession question
       * already asked — {@link reapplyEvidenceFor}'s answer, unchanged.
       */
      readonly evidence: ReapplyEvidenceAccess;
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
 * Whether a surface may attempt a reapply of a conflict of **either** origin, and
 * what it would work from — Phase 2d-6-2, the 2d-6 record's §3 entry 19.
 *
 * **{@link beginReapply} generalized, not widened.** The gate is the same — the
 * permanent {@link ConflictCapabilities.reapplySupport} is asked before the
 * conflict, for the reason stated there — and what differs is the evidence: it is
 * obtained through {@link reapplyEvidenceFor}, for the save origin and the
 * external one alike, with the standing-origin guard asked *last*, after every
 * caller-controlled operand has been read. The four answers that function keeps
 * distinct stay distinct on the `ready` arm, and the correspondence table is
 * never cast to a `ReapplyEvidence` — a surface that wants a snippet out of it
 * looks its row up through {@link correspondenceRowFor} by full base identity
 * (entry 20).
 *
 * **What it forces and what it does not, in the same sentence.** It forces that
 * an external conflict is entered with its table's two revisions checked and the
 * supersession question asked; it cannot force that the guard a caller hands in
 * answers the window's live standing origin rather than the conflict's own —
 * `StandingOriginGuard`'s doc says which closure is honest, and a `() =>
 * conflict.source` compiles and asks nothing. It reads nothing from the window,
 * installs nothing and spends no authorization.
 *
 * @typeParam T - The drafted value the conflict retained.
 * @param capabilities - The calling surface's own declaration.
 * @param conflict - The conflict it is showing, of either origin, or `null`.
 * @param standing - Asks what origin currently stands for that file. Called at
 *   most once, and only when there is a conflict to ask about.
 * @returns The conflict and its evidence access, or the arm to answer with.
 */
export function enterReapply<T>(
  capabilities: ConflictCapabilities,
  conflict: ConflictModel<T> | null,
  standing: StandingOriginGuard
): ReapplyEntry<T> {
  if (capabilities.reapplySupport === 'unavailable') {
    return { kind: 'unavailable' };
  }
  if (conflict === null) {
    return { kind: 'notAttempted' };
  }
  return { kind: 'ready', conflict, evidence: reapplyEvidenceFor(conflict, standing) };
} // End of function enterReapply()

/**
 * The correspondence answers one refusal carried, off its origin.
 *
 * **The one place `ConflictResult.reapply` is read** (ruling 23), so the save half
 * of the origin switch is written once: {@link beginReapply} reads it here and
 * {@link reapplyEvidenceFor}'s `save` arm reads it here, rather than each reaching
 * into the payload for itself.
 *
 * @param source - The `save` origin, carrying the refusal whole.
 * @returns The evidence, exactly as it arrived on that payload.
 */
export function saveReapplyEvidence(source: SaveConflictSource): ReapplyEvidence {
  return source.conflict.reapply;
} // End of function saveReapplyEvidence()

/**
 * Why one full base identity has no single row in a validated correspondence
 * table — Phase 2d-6-2, the 2d-6 record's §3 entry 20.
 *
 * **Two refusals about the rows, kept apart from the three about the table.**
 * A table whose two revisions match can still fail a surface for the one snippet
 * it is about: no row carries that identity, or more than one does. The second
 * is a shape no Rust writer produces — `CorrespondenceTable.entries` is one row
 * per base match — and it is refused rather than resolved by taking the first,
 * because which of two rows is *the* row is exactly the guess ruling 20 forbids.
 * Neither says the snippet is gone; both say the evidence does not name it once.
 */
export type CorrespondenceRowRefusal =
  /** No row of the table carries this full base identity. */
  | 'noRowForBase'
  /** More than one row does, which a correspondence never should. */
  | 'severalRowsForBase';

/**
 * Why an external observation's correspondence table may not be used as evidence.
 *
 * **Three refusals about the table and two about its rows.** The table carries
 * exactly two revisions and either can be the wrong one, and the wire allows the
 * absence of a table whenever either side had no projection; those are the first
 * three, answered by {@link reapplyEvidenceFor}. The two of
 * {@link CorrespondenceRowRefusal} are answered later and per snippet, by
 * {@link correspondenceRowFor}, once the table itself has passed — and they are
 * members of this union so that one accessor, `tExternalEvidenceRefusal`, renders
 * every way the external evidence can refuse (the record's §3 entry 22).
 */
export type ExternalEvidenceRefusal =
  /** The observation carried no correspondence table. */
  | 'noCorrespondence'
  /** Its rows were minted from a revision this draft was not made against. */
  | 'baseRevisionMoved'
  /** Its answers were resolved against a revision this conflict is not about. */
  | 'diskRevisionMoved'
  | CorrespondenceRowRefusal;

/**
 * Where one conflict's reapply evidence comes from, and whether it may be used.
 *
 * **Four arms for two origins.** The external origin can answer *no evidence* for
 * a reason the save origin cannot have — its table is snapshot-bound and the
 * snapshot may not be this conflict's — and since Phase 2d-5-5b **either** origin
 * can answer that the conflict it would come from no longer stands for its file.
 */
export type ReapplyEvidenceAccess =
  | {
      /** A refused save: the subject and placement the command resolved. */
      readonly kind: 'saveEvidence';
      /** The evidence, exactly as it arrived on the refusal's payload. */
      readonly evidence: ReapplyEvidence;
    }
  | {
      /**
       * A watcher observation whose table really is about this conflict.
       *
       * Both revisions were compared before this arm was built; what no type says
       * is that the rows inside describe the projection this conflict carries.
       */
      readonly kind: 'externalCorrespondence';
      /**
       * The validated table: {@link reapplyEvidenceFor}'s **own** frozen object,
       * carrying the two revisions it compared and a copy of the row array.
       *
       * **Not the observation's table by identity**, and deliberately so since this
       * phase's review: the observation's is a value a caller assembled, so reading
       * `base_revision` off it a second time can answer something the check never
       * saw. **What that forces is the two revisions and the set of rows, and
       * nothing further** — each row inside is still the object the observation
       * carried.
       */
      readonly correspondences: CorrespondenceTable;
    }
  | {
      /** The external table may not be used, and nothing is offered in its place. */
      readonly kind: 'refused';
      /** Which of the three negative claims about the table this is. */
      readonly reason: ExternalEvidenceRefusal;
    }
  | {
      /**
       * A strictly later observation replaced this conflict's disk side, so
       * nothing it carries is evidence about the file any more (ruling 26).
       *
       * **An arm of its own rather than a fourth {@link ExternalEvidenceRefusal}**,
       * because it is true of both origins: a refused save's `ConflictResult.reapply`
       * was resolved against a disk snapshot the file has moved on from exactly as
       * an observation's table can have been. It carries no operand, because the
       * only thing it could carry is a revision, and a content revision is a hex
       * digest that a person cannot compare against another (`2d-5-5a-notes.md` §3).
       */
      readonly kind: 'superseded';
    };

/**
 * The dictionary key holding the superseded-conflict sentence.
 *
 * **A constant rather than a key function**, because the arm it belongs to
 * carries no operand to switch on; the `TranslationKey` annotation is what makes
 * a renamed key a compile error here, which is the whole job the sibling key
 * functions do with a `switch`.
 */
export const SUPERSEDED_EVIDENCE_KEY: TranslationKey = 'browser.reapply.supersededConflict';

/**
 * Asks what origin stands for one file **now**.
 *
 * **A guard rather than a value, and the difference is the whole of what it buys**
 * (this phase's review, finding 4). A `ConflictSource | null` operand is read by
 * the caller before {@link reapplyEvidenceFor} runs, so every property read the
 * evidence costs — the observation's table, the draft's base, the conflict's disk
 * revision, the iteration of the row array — happens *after* the answer was taken,
 * and any one of them can run a getter or a `Proxy` trap that registers a strictly
 * later observation. A function is asked at the end instead, so the answer and the
 * return are the same instant.
 *
 * **What it still cannot force is who answers it.** It is an ordinary closure:
 * `() => state.standingConflictFor(document)` is the honest one,
 * `() => conflict.source` defeats the check, and nothing in TypeScript tells the
 * two apart.
 */
export type StandingOriginGuard = () => ConflictSource | null;

/**
 * Which evidence one conflict's reapply may work from, switched on its origin.
 *
 * **Rulings 23 and 24, as one function.** A save conflict's evidence is
 * `ConflictResult.reapply`, resolved by the command that was refused and about that
 * one operation. An external conflict's is the observation's whole-file
 * {@link CorrespondenceTable}, and it is usable **only** when its `base_revision`
 * equals the retained draft's base and its `disk_revision` equals the disk
 * observation this conflict is about. Both comparisons are made here, against the
 * conflict's own two fields, so no caller can supply a mismatched pair.
 *
 * **The accepted arm carries a snapshot this function owns, not the observation's
 * table** (this phase's review, finding 2). Every operand — the table's two
 * revisions and its rows, the draft's base and the conflict's disk revision — is
 * read **once, before** the comparisons, and the frozen object built from those
 * captured values is what goes back; a second read of a caller-controlled getter
 * can therefore not hand a consumer a pair this function never validated. What the
 * snapshot forces is those two revisions and that set of rows: it is shallow, and
 * a row's own fields are the observation's objects still.
 *
 * **Nothing in TypeScript expresses that pairing, and this comment is what carries
 * it.** A {@link CorrespondenceTable} is four ordinary fields; substituting a later
 * read's table for this one's type-checks perfectly and is wrong, and the wire says
 * so in its own words (`src/lib/ipc/types.ts:2891-2911`). What the equality of two
 * revisions establishes is that the table *names* the same two snapshots this
 * conflict names — never that one Rust call built both, which is the only thing
 * that would make the rows trustworthy, and which rests on
 * `externalConflictObservationOf` in `./observationTransitions.ts` having narrowed
 * one wire snapshot rather than on anything checkable here.
 *
 * **It is evidence access and not a transition.** It reads nothing from the window,
 * installs nothing, spends no authorization and offers no control:
 * `conflictChoicesFor` in `./saveOutcome.ts` remains the only producer of a choice
 * list and `BrowserState.adoptDiskVersion` the only confirmed-install door
 * (ruling 23).
 *
 * **The supersession check is last, and it is ruling 26's "old reapply evidence
 * invalidated" in code.** A conflict whose disk side a strictly later observation
 * replaced describes a state the file has moved on from, whichever origin it has,
 * so no arm of {@link evidenceOf} is answered for one. **Last rather than first,
 * and this phase's review is why**: every read that builds the evidence crosses
 * into a value a caller assembled, so a getter or a `Proxy` trap among them can
 * register a strictly later observation *after* a supersession check made first
 * had already passed. The evidence is therefore assembled whole — including the
 * row array, which is iterated into this function's own copy — and only then is
 * the live standing origin asked for; nothing caller-controlled runs between that
 * question and this function's return.
 *
 * **What that forces is only that two objects are the same object**, and the
 * operand is a *guard* rather than a value precisely so the question is asked at
 * the end rather than answered at the start: `BrowserState.standingConflictFor` in
 * `./workspace.svelte.ts` is what answers it honestly, a caller that hands back a
 * closure over `conflict.source` defeats the check without writing anything a type
 * could refuse, and `() => null` is the conservative direction — nothing stands,
 * so nothing is evidence.
 *
 * @typeParam T - The drafted value the conflict retained.
 * @param conflict - The conflict a reapply would work from, of either origin.
 * @param standing - Asks what origin currently stands for that file, or `null`.
 *   Called **once**, after every operand has been read.
 * @returns Which evidence is available, or why it is refused.
 */
export function reapplyEvidenceFor<T>(
  conflict: ConflictModel<T>,
  standing: StandingOriginGuard
): ReapplyEvidenceAccess {
  const source = conflict.source;
  // **Assembled before the live question is asked.** Every caller-controlled read
  // this function makes happens inside the call below; what comes back is built
  // from values already captured, so the guard's answer and this function's answer
  // are about the same instant.
  const access = evidenceOf(conflict, source);
  return standing() === source ? access : { kind: 'superseded' };
} // End of function reapplyEvidenceFor()

/**
 * Which evidence one conflict's origin carries, with no question of supersession.
 *
 * **Split out of {@link reapplyEvidenceFor} so that every caller-controlled read
 * is inside one call**, which is what lets the supersession question be asked
 * afterwards and answered against the same instant this returned at. It performs
 * no state lookup of its own and it cannot: it is handed the origin it must read.
 *
 * @typeParam T - The drafted value the conflict retained.
 * @param conflict - The conflict a reapply would work from.
 * @param source - That conflict's origin, read once by the caller.
 * @returns Which evidence its origin carries, never `superseded`.
 */
function evidenceOf<T>(
  conflict: ConflictModel<T>,
  source: ConflictSource
): Exclude<ReapplyEvidenceAccess, { readonly kind: 'superseded' }> {
  switch (source.kind) {
    case 'save':
      return { kind: 'saveEvidence', evidence: saveReapplyEvidence(source) };
    case 'externalChange': {
      const carried = source.observation.correspondences;
      if (carried === null) {
        return { kind: 'refused', reason: 'noCorrespondence' };
      }
      // **Every operand read exactly once, and before anything is compared**
      // (Phase 2d-5-5a's review, finding 2). All five reads below cross into a
      // value a caller assembled — three off the observation's table, two off the
      // conflict model — and a property read runs arbitrary code through a getter
      // or a `Proxy` trap: `readonly` is a compile-time word and freezes nothing at
      // runtime. Comparing `carried.base_revision` and then handing
      // `carried` on is therefore a check and a spend of two different values: the
      // second read can answer whatever it likes, and the consumer would work from
      // a table this function never validated.
      const tableBase = carried.base_revision;
      const tableDisk = carried.disk_revision;
      const rows = carried.entries;
      const draftBase = conflict.draft.baseRevision;
      const conflictDisk = conflict.diskRevision;
      if (tableBase !== draftBase) {
        // **The draft was made against other bytes than the rows were minted
        // from**, so every identity in the table belongs to a snapshot this draft
        // never saw. Hashes carry no order, so this says the two differ and never
        // which is older (ruling 26).
        return { kind: 'refused', reason: 'baseRevisionMoved' };
      }
      if (tableDisk !== conflictDisk) {
        // The answers were resolved against a disk snapshot that is not the one
        // this conflict is comparing against, which is the supersession case of
        // ruling 26 read from the evidence's side.
        return { kind: 'refused', reason: 'diskRevisionMoved' };
      }
      // **What is handed on is this function's own object**, built from the values
      // the two equalities above were made against, so no later read of the
      // observation's table can substitute anything for them. **It is a shallow
      // snapshot, and that is the whole of what it forces**: the array spine is
      // copied and frozen so a row cannot be added or removed after the check, and
      // each row inside is the object the observation carried — this function reads
      // no field of any row and can vouch for none of them.
      const correspondences: CorrespondenceTable = Object.freeze({
        base_revision: tableBase,
        disk_revision: tableDisk,
        entries: Object.freeze(Array.from(rows))
      });
      return { kind: 'externalCorrespondence', correspondences };
    }
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
} // End of function evidenceOf()

/**
 * The dictionary key holding one external-evidence refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom every describer in
 * `src/lib/browser/` follows: a renamed key is a compile error here, and a new
 * member of {@link ExternalEvidenceRefusal} with no sentence is one too.
 *
 * @param reason - Which negative claim about the table, or about its rows, this is.
 * @returns The key holding that reason's sentence.
 */
export function externalEvidenceRefusalKey(reason: ExternalEvidenceRefusal): TranslationKey {
  switch (reason) {
    case 'noCorrespondence':
      return 'browser.reapply.externalEvidence.noCorrespondence';
    case 'baseRevisionMoved':
      return 'browser.reapply.externalEvidence.baseRevisionMoved';
    case 'diskRevisionMoved':
      return 'browser.reapply.externalEvidence.diskRevisionMoved';
    case 'noRowForBase':
      return 'browser.reapply.externalEvidence.noRowForBase';
    case 'severalRowsForBase':
      return 'browser.reapply.externalEvidence.severalRowsForBase';
  }
} // End of function externalEvidenceRefusalKey()

/**
 * What the search of a validated table for one full base identity found —
 * Phase 2d-6-2, the 2d-6 record's §3 entry 20.
 *
 * Two arms and never a third: a row was found, and it is exactly one; or the
 * table is refused for that identity, with the reason typed so the surface
 * reaches manual resolution through `tExternalEvidenceRefusal` (entry 22).
 */
export type CorrespondenceRowLookup =
  | {
      /** Exactly one row carries the identity. */
      readonly kind: 'found';
      /**
       * That row, as the observation carried it.
       *
       * **The row object is the observation's, not a copy**: `reapplyEvidenceFor`
       * copies the array spine and nothing inside it, and this function reads the
       * row's `base` and nothing else. Its `exact` and `editor` resolutions are
       * read by the surface, once, through {@link subjectResolution}.
       */
      readonly entry: CorrespondenceEntry;
    }
  | {
      /** No row carries the identity, or more than one does. */
      readonly kind: 'refused';
      /** Which. */
      readonly reason: CorrespondenceRowRefusal;
    };

/**
 * Finds the one row of a validated table that is about one base snippet, by its
 * **full** identity — Phase 2d-6-2, the 2d-6 record's §3 entry 20.
 *
 * **Document, revision and node must all match, and nothing weaker is identity.**
 * A `MatchId` is scoped to the parse it was minted from: the same arena node
 * number names a different mapping after any reparse, and a position in the
 * `entries` array is a fact about the base projection's order, not about a
 * snippet. So neither `entries[i]` for the snippet's index nor a row whose
 * `base.node` alone agrees is ever taken — the row is found by comparing all
 * three fields, and a table whose `base_revision` differs from the identity's
 * revision therefore matches no row at all, whichever nodes it names.
 *
 * **Missing and duplicate both refuse, conservatively.** No row is *no evidence*
 * for this snippet; two rows is a table this application cannot read, because
 * choosing between them would be a guess about identity. Neither answer says
 * anything about the snippet on disk.
 *
 * **Every caller-controlled operand is read once, before the comparison it feeds.**
 * The three fields of the identity are captured before the loop; each row's
 * `base` is read once and its three fields once each. The table's spine is the
 * frozen copy `reapplyEvidenceFor` built, so the row count is fixed; what a getter
 * behind a row's `base` could still do is answer one identity to this function
 * and another to a later reader, which is why the found row is handed back whole
 * and the surface reads its resolution exactly once.
 *
 * **What it does not do.** It reads no resolution, decides no correspondence tier
 * and installs nothing: which of the row's two answers a surface may act on is
 * that surface's, by ruling 20 — the editor takes `editor`, a destructive
 * operation takes `exact`, an anchor takes `exact` from the same table.
 *
 * @param table - A table `reapplyEvidenceFor` answered `externalCorrespondence`
 *   with. Nothing here re-checks its revisions; a caller that hands in an
 *   unvalidated table gets rows about a snapshot the conflict may not be about.
 * @param base - The snippet's identity as this surface holds it, minted from the
 *   base snapshot the draft was made against.
 * @returns The one row, or why there is not exactly one.
 */
export function correspondenceRowFor(
  table: CorrespondenceTable,
  base: MatchId
): CorrespondenceRowLookup {
  const document = base.document;
  const revision = base.revision;
  const node = base.node;
  let found: CorrespondenceEntry | null = null;
  for (const entry of table.entries) {
    const row = entry.base;
    if (row.document !== document || row.revision !== revision || row.node !== node) {
      continue;
    }
    if (found !== null) {
      return { kind: 'refused', reason: 'severalRowsForBase' };
    }
    found = entry;
  } // End of the loop over the table's rows
  return found === null ? { kind: 'refused', reason: 'noRowForBase' } : { kind: 'found', entry: found };
} // End of function correspondenceRowFor()

/**
 * What {@link beginReapply} answered.
 *
 * @typeParam T - The drafted value the conflict retained.
 */
export type ReapplyStart<T> =
  | {
      /** There is a save conflict and this surface may work from it. */
      readonly kind: 'ready';
      /** The conflict, carrying the disk snapshot and the retained draft. */
      readonly conflict: SaveConflictModel<T>;
      /**
       * The correspondence answers, as they arrived on that conflict's payload.
       *
       * Read off `SaveConflictModel.source` — the origin wrapping the wire value —
       * rather than from a second call, which is consult Q9's second failure mode
       * designed out: a later `get_document` would answer a *different*
       * observation, and a perfectly correct algorithm would then resolve the wrong
       * one.
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
  return subjectResolution(evidence.subject);
} // End of function subjectCorrespondence()

/**
 * What one resolution leaves a surface to work with, wherever it came from.
 *
 * **Factored out of {@link subjectCorrespondence} at Phase 2d-6-2 so that a
 * correspondence table's row can be read without manufacturing a
 * `ReapplyEvidence` around it.** A refused save's `subject` and a table row's
 * `editor` or `exact` are the same wire enum answering the same question — which
 * snippet of the disk snapshot, if exactly one, carried the evidence — and the
 * three-arm collapse is the same: `Unsupported` and `Targetless` both leave a
 * surface that needs a target with none. Inventing a `placement` to reuse the
 * evidence reader would have been the cast ruling 19 forbids in another spelling.
 *
 * The resolution is read exactly once per arm test, in the order `Identified`,
 * `Refused`; it is caller data — a row of the observation's table — and the
 * `target` handed back is the object it carried.
 *
 * @param resolution - One resolution, off a refusal's evidence or a table row.
 * @returns The identified snippet, the refusal, or the fact that there is no
 *   snippet to find.
 */
export function subjectResolution(resolution: ReapplyResolution): SubjectCorrespondence {
  if ('Identified' in resolution) {
    return { kind: 'identified', target: resolution.Identified.target };
  }
  if ('Refused' in resolution) {
    return { kind: 'refused', reason: resolution.Refused.reason };
  }
  return { kind: 'noSubject' };
} // End of function subjectResolution()

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
 * What one table row's resolution leaves a surface to place **after**.
 *
 * **{@link subjectResolution}'s twin, added at Phase 2d-6-3 for the same reason
 * that one was factored out at 2d-6-2**: an anchored creation or move reads its
 * anchor's `exact` tier off a correspondence table's row (the 2d-6 record's §3
 * entry 20 — "the anchor's `exact` from the same table"), and that tier is a
 * `ReapplyResolution` — the wire enum a refused save's *subject* is, not the
 * `ReapplyPlacement` its *anchor* is. Reading it through {@link subjectResolution}
 * would have answered `noSubject` for a row that resolves to nothing, whose
 * sentence says *this change brings its own snippet*; the honest third arm for an
 * anchor is `notAnchored`, and it is answered here for **both** empty wire arms,
 * `Unsupported` and `Targetless` — neither names a snippet to place after, and
 * which of the two a row carries is a fact about the base match, not about the
 * position. Inventing a `ReapplyEvidence` around the row to reuse
 * {@link anchorCorrespondence} would have been the cast ruling 19 forbids in
 * another spelling.
 *
 * The resolution is read exactly once per arm test, in the order `Identified`,
 * `Refused`; it is caller data — a row of the observation's table — and the
 * `target` handed back is the object it carried.
 *
 * @param resolution - One resolution, off a table row's `exact` tier.
 * @returns The identified anchor, the refusal, or the fact that the row names no
 *   anchor.
 */
export function anchorResolution(resolution: ReapplyResolution): AnchorCorrespondence {
  if ('Identified' in resolution) {
    return { kind: 'identified', target: resolution.Identified.target };
  }
  if ('Refused' in resolution) {
    return { kind: 'refused', reason: resolution.Refused.reason };
  }
  return { kind: 'notAnchored' };
} // End of function anchorResolution()

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

/**
 * Which arm one attempt ended on, with the session and the obstacle taken off.
 *
 * Derived from {@link ReapplyOutcome} rather than written out, for
 * `OutcomeArm`'s reason one module along: a seventh arm is then a compile error in
 * {@link reapplyOutcomeKey} instead of a silent gap in what a panel says.
 */
export type ReapplyOutcomeCode = ReapplyOutcome<unknown, unknown>['kind'];

/**
 * The dictionary key holding the sentence one attempt's arm shows.
 *
 * A `switch` over literal keys rather than a template, the idiom every describer
 * in `src/lib/browser/` follows: a renamed key is a compile error here, and a new
 * arm of {@link ReapplyOutcome} with no sentence is one too.
 *
 * **`manualResolution`'s sentence says what happened and never why.** The *why* is
 * the surface's own obstacle, which has its own key function beside its own union,
 * and a panel draws the two as two lines. Folding the reason in here would need
 * this module to import six obstacle unions, and every one of those imports is a
 * cycle (`2c-4b-2-notes.md` D7).
 *
 * @param code - Which arm the attempt ended on.
 * @returns The key holding that arm's sentence.
 */
export function reapplyOutcomeKey(code: ReapplyOutcomeCode): TranslationKey {
  switch (code) {
    case 'reapplied':
      return 'browser.reapply.reapplied';
    case 'alreadySatisfied':
      return 'browser.reapply.alreadySatisfied';
    case 'manualResolution':
      return 'browser.reapply.manualResolution';
    case 'adoptionRefused':
      return 'browser.reapply.adoptionRefused';
    case 'unavailable':
      return 'browser.reapply.unavailable';
    case 'notAttempted':
      return 'browser.reapply.notAttempted';
  }
} // End of function reapplyOutcomeKey()

/**
 * The dictionary key holding one **shared** obstacle's sentence.
 *
 * Every surface's own key function delegates to this for the two arms that are
 * about the *evidence* rather than about that surface's value, so the sentence a
 * person reads for *espansoConfig could not establish correspondence* is one
 * sentence and not five that have to be kept in step.
 *
 * **The nested {@link ReapplyRefusal} is not folded in here**, and that is the same
 * split {@link reapplyOutcomeKey} makes: the wire code already has its own
 * sentences (`code.reapplyRefusal.*`, since 2c-4b-1) and its own accessor, so the
 * i18n layer composes the two rather than this module inventing a third string.
 *
 * @param obstacle - The shared obstacle to name.
 * @returns The key holding its sentence.
 */
export function sharedReapplyObstacleKey(obstacle: SharedReapplyObstacle): TranslationKey {
  switch (obstacle.kind) {
    case 'correspondence':
      return 'browser.reapply.obstacle.correspondence';
    case 'evidenceNotATarget':
      return 'browser.reapply.obstacle.evidenceNotATarget';
  }
} // End of function sharedReapplyObstacleKey()

/**
 * One attempt, tied to the session it left behind.
 *
 * **The pairing is what makes a stale report impossible rather than merely
 * unlikely.** A panel holds one of these and shows its outcome only while
 * {@link ReapplyAttempt.session} is still the session on screen
 * ({@link reapplyToShow}); every transition in this repository returns a *new*
 * session value, so the next thing the person does drops the report without any
 * component having to remember to clear it.
 *
 * **What that forces and what it does not, in the same sentence.** It forces that a
 * report cannot outlive the session it describes, because the comparison is
 * reference equality against the value the panel is drawing. It cannot force that a
 * panel installs {@link ReapplyAttempt.session} at all, nor that it asks
 * {@link reapplyToShow} rather than reading the field directly — both are ordinary
 * values, and each component's mounted suite is what drives its own handler.
 *
 * @typeParam S - The surface's own session type.
 * @typeParam O - The surface's own obstacle type.
 */
export interface ReapplyAttempt<S, O> {
  /** The session to hold after the attempt: the rebuilt one, or the one held. */
  readonly session: S;
  /** What the attempt became, whole. */
  readonly outcome: ReapplyOutcome<S, O>;
}

/**
 * Folds one attempt into the session to hold and the report to show.
 *
 * **The rule that decides which arms replace the session, in one place.** Two of
 * the six carry one — `reapplied` and `alreadySatisfied`, the two the window has
 * answered with `installed` or `alreadyThere`, so that it holds the disk snapshot
 * whether or not this attempt is what put it there — and the other four leave the
 * window exactly where it was. Five panels ask this question and a rule written
 * into one renderer
 * is carried by that renderer's mounted suite alone, which is the defect 2c-3c-3
 * named and this repository keeps re-finding.
 *
 * @typeParam S - The surface's own session type.
 * @typeParam O - The surface's own obstacle type.
 * @param held - The session the panel is showing now.
 * @param outcome - What {@link ReapplyOutcome} the surface's transition answered.
 * @returns The session to hold, paired with the outcome that produced it.
 */
export function attemptOfReapply<S, O>(
  held: S,
  outcome: ReapplyOutcome<S, O>
): ReapplyAttempt<S, O> {
  const session =
    outcome.kind === 'reapplied' || outcome.kind === 'alreadySatisfied' ? outcome.session : held;
  return { session, outcome };
} // End of function attemptOfReapply()

/**
 * The attempt a panel may still show something about, or `null`.
 *
 * @typeParam S - The surface's own session type.
 * @typeParam O - The surface's own obstacle type.
 * @param attempt - The last attempt this panel made, or `null` when it made none.
 * @param session - The session the panel is drawing **now**.
 * @returns The outcome to report, or `null` when there is nothing to report about
 *   this session.
 */
export function reapplyToShow<S, O>(
  attempt: ReapplyAttempt<S, O> | null,
  session: S
): ReapplyOutcome<S, O> | null {
  return attempt === null || attempt.session !== session ? null : attempt.outcome;
} // End of function reapplyToShow()

/**
 * What, if anything, to ask to have brought into view when a reapply report
 * changes.
 *
 * Two values, which is all this panel has: it is one block, it is either drawn
 * or it is not, and there is no second target inside it the way a conflict's
 * choices row is a second target inside an outcome panel.
 */
export type ReapplyReveal =
  /** No report is drawn, so nothing is scrolled. */
  | 'none'
  /** A report is drawn: ask for the block itself to be brought into view. */
  | 'reportPanel';

/**
 * What to ask to have brought into view for one state of one reapply report.
 *
 * **2c-4b-3c-2 §11.1, whose repair this completes and then widens.** In all 42
 * `manualResolution` launches of that reading — five surfaces, both languages —
 * the report block was drawn **entirely above the visible band** (`y` between −53
 * and −104 in a 728 px window whose scrollport starts at 44), the outcome panel
 * below it kept pixel-identical coordinates, and a second press reproduced the
 * identical invisible refusal. The report is a second `role="status"` panel drawn
 * immediately before the outcome panel in all five components, and the reveal
 * machinery knew only about the outcome panel: `outcomeReveal` in `./saveOutcome`
 * has no arm for a report and `revealOutcome` in `../components/reveal` is handed
 * only the outcome panel and its choices row. Nothing pointed a viewport at this
 * block, so pressing the control and being refused changed nothing a person could
 * see.
 *
 * **Every arm asks for its report to be brought into view, including the two that
 * succeed — and that goes past
 * §11.1's own evidence, deliberately.** The reading measured refusals only, so the
 * success arms are an **argued scope addition** and not part of what was asked
 * for; `docs/decisions/2c-4b-3d-1-notes.md` §3.6 is where it is argued and priced,
 * and 3d-2 reads its effect. The argument: a report is only ever drawn in answer to
 * a press, and the arm that is easiest to miss is the one that changes least on
 * screen, so restricting the cue to the refusal arms would leave the identical
 * unseen-report defect standing on `reapplied` and `alreadySatisfied` — the defect
 * class reintroduced in a different arm. Withholding it from `reapplied` would also
 * make the cue a second, quieter copy of the rule about which arms replace the
 * session, which {@link attemptOfReapply} already owns.
 *
 * **What the addition costs, and the cost is unknown rather than predicted.** The
 * controls a person is meant to use next after a *successful* reapply are drawn
 * **before** the report and not after it — the deleter's renewed confirmation at
 * `../components/MatchDeleter.svelte:464` against its report at `:516`, the mover's
 * rebuilt destination list at `../components/MatchMover.svelte:663` against its report
 * at `:779` — so the report's own height is not the quantity involved at all, and
 * nothing here pushes them down by it. Which way the page moves depends only on where
 * the rebuilt report is relative to the scrollport when the reveal fires, and
 * `'nearest'` has three answers: a report **below** it is aligned bottom-to-bottom,
 * which carries these controls **up** and can take them off the top; a report
 * **above** it is aligned top-to-top, which carries them **down**; a report already
 * fully inside is not scrolled to at all. **Which of the three happens on this path is
 * unmeasured** — 2c-4b-3c-2's geometry is 42 *refusal* launches, and a refusal leaves
 * the outcome panel standing while a success removes it, so that geometry establishes
 * nothing about this one in either direction. 3d-2 is what measures it, on **every**
 * match surface the widening changed and in both languages, because the argument above
 * is that no success report may go unseen and three of the five have no success
 * reading at all.
 *
 * **This lives in the model for 2c-3c-3's reason**, and the reason is narrower than
 * "markup cannot be tested": a rule written into one renderer is carried by that
 * renderer's mounted suite alone, and five renderers draw this block.
 *
 * **What no test in this repository can falsify.** Neither a model test nor a
 * mounted test has a **viewport** — jsdom lays nothing out and does not implement
 * `scrollIntoView` at all — so nothing here can fail because the block is off
 * screen, and nothing here can fail because a reveal put it somewhere useless. A
 * model test can pin this function's answers, a mounted test can pin that a
 * component binds the block and runs the effect, and only a window reading can say
 * that a person sees it. 3d-2 is that reading.
 *
 * @param code - Which arm the report on screen is showing, or `null` when no
 *   report is drawn.
 * @returns What to reveal.
 */
export function reapplyReveal(code: ReapplyOutcomeCode | null): ReapplyReveal {
  switch (code) {
    case null:
      return 'none';
    case 'reapplied':
    case 'alreadySatisfied':
    case 'manualResolution':
    case 'adoptionRefused':
    case 'unavailable':
    case 'notAttempted':
      // Written out rather than defaulted: a seventh arm of `ReapplyOutcome` is
      // then a compile error here, and whoever adds it decides whether their
      // report is asked for instead of inheriting an answer.
      return 'reportPanel';
  }
} // End of function reapplyReveal()
