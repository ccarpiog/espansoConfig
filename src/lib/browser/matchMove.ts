/**
 * Moving one snippet inside the list it is in: the whole operation as a value.
 *
 * **No component and no screen.** This is step 1 of 2c-3b, and it is the same
 * arrangement `./matchCreation.ts` and `./matchDeletion.ts` are in: every
 * decision a move makes lives here, where a test can drive it, and step 2's
 * component is a rule-free walk over {@link MatchMoveView}. The standing reason
 * is `docs/decisions/1c-1-notes.md` hole 1 — nothing in this repository renders a
 * Svelte component in an automated test unless the file opts into jsdom, so a
 * decision written in markup is a decision nothing can check.
 *
 * The authority for what follows is `docs/reviews/phase-2c-3b-design.md`. Where
 * this module and that consult disagree, the consult is right and this is a bug.
 *
 * ## The invariant is "same sequence", never "same file" (consult correction 4)
 *
 * `ItemMove` is same-sequence only (`PROGRESS.md` D2r), and a *file* is not a
 * sequence. Today's projection happens to give a snippet file exactly one snippet
 * list, so the two coincide — and encoding that coincidence would make this model
 * silently wrong the first time a projection exposes a second sequence.
 *
 * So the sequence is **derived from the projection's own address**.
 * `MatchView.path` is a {@link DocumentPath}: a `document_index` and a list of
 * steps, and a movable snippet's steps end in an `{ Index: n }` — the position it
 * occupies. Everything before that index is the sequence, and
 * {@link sequenceOf} answers it. Two snippets are co-sequential when their file,
 * their `document_index` and that prefix all agree.
 *
 * **The file identity is part of the address and is not read off the path**, and
 * that is not redundancy: a `DocumentPath` addresses a node *within* one file and
 * carries nothing that names the file, so `matches[0]` of two different files is
 * one path and two sequences. What pins the *revision* is not this comparison but
 * {@link moveEligibility}'s `notInDocument` arm, which requires the snippet and
 * the file handed in to be a pair one projection describes.
 *
 * **This is the first consumer of `MatchView.path` in the frontend.** Nothing
 * else has read it, so a projection that stopped filling it in would make every
 * snippet `noSequencePosition` here and change nothing anywhere else.
 *
 * ## Placement is the UI's vocabulary, and `end` is the UI's lowering
 *
 * The consult's Q1: the destination panel offers **top**, **after ‹snippet›** and
 * **end**. The wire has only `after: MatchId | null` — `null` means the top —
 * so `end` is lowered here, to *after the last snippet of the sequence that is
 * not the one being moved*. **That lowering is this application's, not the
 * contract's**, and it is the reason {@link MoveTarget} exists as a separate type
 * from {@link MovePlacement}: one is what a person chose, the other is what
 * travels.
 *
 * The moving snippet is never offered as its own anchor. The anchor list is the
 * **complete, unfiltered** sequence (consult Q6): a search box filters what the
 * middle pane lists and says nothing about document order, so a destination list
 * built from a filtered list would let a query decide where a snippet lands.
 *
 * ## An explicit boundary, not a list of disabled foreign rows (consult Q4)
 *
 * Only co-sequential snippets are offered, and the pane says so in a sentence —
 * `browser.matchMove.withinThisFile`, which names the file
 * {@link MatchMoveView.document} identifies. `matchCreation.ts`'s rule that
 * **every** file is offered and the ineligible ones say why is about *files that
 * could receive a snippet*, and consult correction 8 rules that it does not
 * generalise: a snippet in another file is outside a move's destination domain
 * rather than a failed candidate that needs a row.
 *
 * ## R25 has no message here, and its absence is deliberate (consult Q9)
 *
 * A move may not be combined with any other edit in one batch (`PROGRESS.md`
 * R25). **Nothing in this UI can express a combined batch**: a move is one
 * command carrying one relocation, and no control anywhere can add a second edit
 * to it. A warning about a request nobody can make would describe something that
 * never happened, so there is none — and this paragraph is here so that a later
 * reader does not "fix" the omission.
 *
 * **A dirty draft is not R25** (consult correction 2). {@link MoveRefusal}
 * `unsavedDraft` is *this application's* workflow policy: a committed move gives
 * the snippet a new identity, which strands an unsaved draft addressed to the old
 * one, so the draft is saved or discarded first. It is **not** a claim that the
 * core forbids two sequential transactions — it does not — and the sentence in
 * both dictionaries says so.
 *
 * **That rule compares whole identities, revision included**, and what it
 * therefore does *not* protect against is written out at {@link moveEligibility}:
 * a draft held over an older parse than the one this eligibility is computed over
 * does not match, so the move is allowed and those edits are stranded. A
 * `MatchId` is session-local — after a reprojection the same arena node of the
 * same file can be an unrelated snippet — so recognising an older-revision
 * identity as "the same snippet" would refuse the move for a snippet nobody is
 * editing just as readily as it would catch the case it was written for.
 *
 * ## A command failure is not an acknowledgeable refusal (consult Q8)
 *
 * `moveNotWithinOneSequence` arrives as a **typed command failure**, on
 * {@link SendFailure}, and is rendered by the ordinary `tIpcFailure` accessor
 * over the existing `code.commandError.moveNotWithinOneSequence` sentence. It
 * carries no findings and no acknowledgement can move it, so presenting it beside
 * *Save anyway* would offer a button that can never work (consult correction 3).
 *
 * **A stale projection does not normally produce it** (consult correction 5):
 * `view_at` checks the base revision first, so a window that has moved on gets
 * `identityStaleRevision`. This code means the address could not be shown to be
 * an item of the list the move works in — an unsupported path, or an invariant
 * breach between this window and the core. {@link moveRecoveryChoices} is what
 * offers *read this file again* for it and for the three identity codes, and it
 * is an **offer**, never a diagnosis.
 *
 * ## What a commit leaves behind, and what an adoption leaves behind
 *
 * **"The move committed" and "this session's identities were invalidated" are two
 * facts, and reading the first as the second is the defect this section exists to
 * name.** A commit is one way this window's projection of a file is replaced; it
 * is not the only one. `BrowserState.moveMatch` re-reads and re-projects the file
 * whenever the transaction ended on a revision the window was not already
 * projecting — `committed || revision !== view.revision` — so a **`committed:
 * false`** answer can owe that adoption on its own. When it does, every `MatchId`
 * this session holds was minted from a parse that no longer exists, while nothing
 * was written.
 *
 * So {@link MatchMoveSession.moved} says *the file was rewritten through this
 * session*, and nothing else; {@link MatchMoveSession.invalidated} says *the
 * projection these identities came from has been replaced*. A commit sets both, an
 * adoption owed for any other reason sets only the second, and **either one spends
 * the session** — nothing here clears either.
 *
 * `SaveResult.moved` — the snippet's identity in the new revision — is kept as
 * {@link MatchMoveSession.landed}, and **`null` is legal on a committed move**:
 * the command answers no identity when the file changed again between the write
 * and the read that followed it.
 *
 * A `committed: false` whose adoption was **not** owed replaced nothing and spends
 * nothing: moving one of two byte-identical snippets produces a byte-identical
 * candidate, no revision moved, and the session goes on being usable.
 *
 * **A conflict does not spend the session, and 2c-4a-2 is where that changed.**
 * `BrowserState.moveMatch` used to install the projection a conflict carries on
 * its `disk` field — replacing this window's projection of the file while
 * reporting `adoption: notOwed` — so the adoption could not be the evidence and
 * {@link applyMove} derived the invalidation from the arm instead. The design
 * consult's Q2 ruled that install a defect: a conflict writes nothing, and a save
 * that wrote nothing must not re-order the list or move the selection before the
 * person has chosen. Nothing is replaced now, so these identities are still the
 * ones the window is projecting and the panel refuses only **while the conflict is
 * showing** ({@link MoveSubmissionRefusal} `conflict`). Dismissing it hands the
 * session back; the file is what has not changed, so a resend carries the frozen
 * base revision, which the command refuses — see {@link dismissMoveOutcome} for
 * why that refusal is an `identityStaleRevision` rather than a second conflict.
 *
 * ## A send that may already have written is terminal, and it outranks the rest
 *
 * The command layer answers `may_have_written` when a save failed at or after the
 * rename, and `BrowserState.moveMatch` hands it on. **This application then knows
 * neither that the move happened nor that it did not**, so
 * {@link MatchMoveSession.mayHaveWritten} spends the session exactly as a commit
 * does: {@link canChoose} refuses, {@link beginMove} produces nothing, and the
 * reason shown is {@link MoveSubmissionRefusal} `mayHaveWritten`. It is a flag
 * rather than a read of {@link MatchMoveSession.sendFailure} because
 * {@link dismissMoveOutcome} clears that field: putting the panel away must not
 * hand the session back. `PROGRESS.md` D2 seen from its mirror side — a write that
 * may have committed is never afterwards reported as *nothing happened*.
 *
 * **Two of these flags can be true at once, and the reason shown is then the one
 * that claims less.** `refusalGiven` holds that as a stated rule rather than as an
 * arrangement of `if`s, because the rule has been swapped once already: a refusal
 * renders one sentence, a sentence is read as a claim about the person's file, and
 * the weakest true claim is the honest one. `mayHaveWritten` says *this application
 * cannot tell what happened*, which is weaker than every other arm, so it comes
 * first — above `alreadyMoved`, whose definite *this snippet has been moved* would
 * otherwise sit beside a send failure disclaiming exactly that, and above the
 * liveness check, whose sentence says *nothing has been written*.
 *
 * ## What this session knows, and what only the live projections know
 *
 * A session is a snapshot. Its `match`, `members` and `anchors` were all minted at
 * {@link startMatchMove} from one projection, and nothing inside it can notice
 * that the window has read the file again since. Two different mechanisms close
 * that, and neither subsumes the other:
 *
 * - {@link MatchMoveSession.invalidated} — **identities this session can no longer
 *   vouch for**, which it was **told** about. It has **two** producers, and they
 *   differ in whether a projection was replaced at all:
 *   {@link applyMove} sets it from a replacement, on one kind of evidence — a
 *   committed save, or an adoption the wrapper owed at all, which is the same
 *   question asked of the wrapper's own report; and
 *   {@link moveRecoveryFailed} sets it **without** a replacement, from a recovery
 *   re-read that failed. There the projection is still installed and the parse is
 *   not gone — what happened is that the command **contradicted** the identity
 *   this session holds and the window then could not obtain a better one. Reading
 *   this field as *the projection was replaced* is therefore wrong for one of its
 *   two producers, which is why it is named for what the session can vouch for;
 * - the **live projections**, which {@link moveSubmissionRefusal},
 *   {@link canMove} and {@link matchMoveView} all take for exactly this reason. A
 *   reprojection nobody told this session about — the window re-reading the file
 *   for its own reasons while the panel is open — is visible nowhere else.
 *
 * Both produce {@link MoveSubmissionRefusal} `outOfDate`, which is the same fact
 * {@link beginMove} reads off its `projected` argument. **One private rule
 * computes the refusal and both sides call it, so the two agree whenever they are
 * handed consistent liveness** — which is what was missing when the refusal was
 * computed twice and only one copy looked.
 *
 * **What that is not, in the same sentence as what it is.** The liveness reaches
 * the two sides through two independent arguments: `matchMoveView(session, views)`
 * derives it from the list it is given, and `beginMove(session, projected)` from
 * the identity its caller read. `matchMoveView(session, R0Views)` answering
 * `canMove: true` while `beginMove(session, identityInProjection(R1Views, …))`
 * answers `null` is well-typed, and nothing here can refuse it. So the property is
 * *one rule over consistent inputs*, never *agreement by construction*, and what
 * closes the remaining half is a caller: **step 2's component must derive the view,
 * the destination options and the submission identity from one read of the current
 * projections**, in one synchronous block, rather than from three reads that can
 * fall between two parses.
 *
 * ## What no type here forces
 *
 * In the same sentence as what one does. {@link beginMove} takes the identity the
 * **live projection** gives the snippet and refuses to produce anything to send
 * unless it agrees with the session's own — but `MatchId` carries no brand and
 * nothing can say where an argument came from, so a caller that hands back
 * `session.match` defeats the check entirely. `identityInProjection` in
 * `./matchDeletion.ts` is what a caller uses *instead*, and it is a call somebody
 * can search for rather than an instruction in a comment.
 *
 * Nor can anything here stop a component importing `moveMatch` from
 * `../ipc/commands` and calling it with no session at all — the hole every
 * writing command has had since 2b-2a. What is closed is that *this module*
 * produces nothing to send without a live-identity check, a frozen base revision
 * and a placement that really moves the snippet.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentPath,
  DocumentView,
  MatchId,
  MatchView,
  PathSegment,
  PresentationNote,
  SaveResult
} from '../ipc/types';
import {
  amendDraft,
  savedDraft,
  startDraft,
  structuredDraftRules,
  submissionOf,
  type Draft,
  type DraftSubmission,
  type DraftValueRules
} from './draft';
import {
  atTheReloadWarning,
  conflictArm,
  consentForRefusal,
  offeredReloadStep,
  offeredRefusalChoices,
  reloadAsked,
  reloadConfirmed,
  refusedArm,
  sendFailureLines,
  sendFailureOf,
  reloadWasRefused,
  spendTheConfirmedReload,
  submissionIsStale,
  NOT_RELOADING,
  RELOAD_REFUSED,
  type AdoptTheDiskVersion,
  type EditorPhase,
  type ReloadStep,
  type SendFailure,
  type SendFailureLine
} from './editorSave';
import type { InvalidationStatus } from './invalidation';
import { identityInProjection, plainIdentity } from './matchDeletion';
import type { RawSaveChoice } from './rawSave';
import {
  conflictChoicesFor,
  conflictDiskText,
  describeEditSave,
  invalidationFailureMessage,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';

/**
 * How this session compares and snapshots the placement it drafts.
 *
 * `structuredDraftRules` because a {@link MovePlacement} has fields and its
 * `after` arm carries a whole {@link MatchId}: deep equality is what makes "the
 * same destination" mean *the same anchor*, and the frozen deep copy is what
 * stops a caller mutating the value consent was collected for.
 *
 * The snapshot is a `structuredClone`, which **throws on a reactive proxy**, so
 * every identity this module puts into a placement is a plain copy first — see
 * {@link startMatchMove}.
 */
const PLACEMENT_RULES: DraftValueRules<MovePlacement> = structuredDraftRules<MovePlacement>();

/**
 * Whether two match identities name the same snippet of the same parse.
 *
 * All three fields, because all three are the identity: the revision is part of
 * it precisely so that a value crossing a reparse is refused rather than resolved
 * to whatever now occupies that arena slot.
 *
 * @param one - One identity.
 * @param other - The other.
 * @returns `true` when they name the same snippet.
 */
function sameIdentity(one: MatchId, other: MatchId): boolean {
  return (
    one.document === other.document && one.revision === other.revision && one.node === other.node
  );
} // End of function sameIdentity()

/**
 * A copy of one path step, in an object nothing else can reach.
 *
 * {@link plainIdentity}'s argument applied to a segment: a session outlives the
 * projection it was opened over, and a session holding references into a
 * projection that has been replaced describes a parse that no longer exists.
 *
 * @param segment - The step to copy.
 * @returns The same step, in a fresh plain object.
 */
function plainSegment(segment: PathSegment): PathSegment {
  return 'Key' in segment ? { Key: segment.Key } : { Index: segment.Index };
} // End of function plainSegment()

/**
 * Whether two path steps are the same step.
 *
 * @param one - One step.
 * @param other - The other.
 * @returns `true` when both name the same key, or both the same index.
 */
function sameSegment(one: PathSegment, other: PathSegment): boolean {
  if ('Key' in one) {
    return 'Key' in other && one.Key === other.Key;
  }
  return 'Index' in other && one.Index === other.Index;
} // End of function sameSegment()

/**
 * One sequence of one file, as the address of the sequence itself.
 *
 * **Not a `DocumentPath`**, and the difference is the point: a `DocumentPath`
 * addresses a node inside one file and says nothing about which file, so this
 * carries the file's identity beside the steps. See this module's header.
 */
export interface SequenceAddress {
  /** The file the sequence is in, by the identity this window holds. */
  readonly document: DocumentId;
  /** Which YAML document of the stream it is in. Espanso loads the first. */
  readonly documentIndex: number;
  /**
   * The steps from that document's root **to the sequence**, index excluded.
   *
   * `[{ Key: 'matches' }]` for every snippet list this projection produces
   * today, which is exactly why it is derived rather than assumed.
   */
  readonly segments: readonly PathSegment[];
}

/**
 * The sequence one snippet is an item of, or `null` when it addresses none.
 *
 * `null` in two cases, and both are honest refusals rather than failures: the
 * projection gave the snippet no path at all, or it gave one that does not end in
 * a sequence index — which is a snippet this application cannot address as an
 * item of a list and therefore cannot move.
 *
 * @param match - The snippet's projection.
 * @returns Its sequence's address, or `null`.
 */
export function sequenceOf(match: MatchView): SequenceAddress | null {
  const path: DocumentPath | null = match.path;
  if (path === null || path.segments.length === 0) {
    return null;
  }
  const last = path.segments[path.segments.length - 1];
  if (last === undefined || !('Index' in last)) {
    return null;
  }
  return {
    document: match.id.document,
    documentIndex: path.document_index,
    segments: path.segments.slice(0, -1).map(plainSegment)
  };
} // End of function sequenceOf()

/**
 * Whether two sequence addresses name one sequence.
 *
 * @param one - One address.
 * @param other - The other.
 * @returns `true` when the file, the stream document and every step agree.
 */
export function sameSequence(one: SequenceAddress, other: SequenceAddress): boolean {
  return (
    one.document === other.document &&
    one.documentIndex === other.documentIndex &&
    one.segments.length === other.segments.length &&
    one.segments.every((segment, at) => {
      const twin = other.segments[at];
      return twin !== undefined && sameSegment(segment, twin);
    })
  );
} // End of function sameSequence()

/**
 * Every snippet of one file that is an item of one sequence, in file order.
 *
 * **The order is the projection's**, which is source order, and nothing here
 * sorts: where a snippet is written is what a move is about, and a list this
 * function reordered would be a different file's list.
 *
 * @param document - The file's projection.
 * @param sequence - The sequence to collect.
 * @returns The snippets, in the order the file writes them.
 */
export function membersOfSequence(
  document: DocumentView,
  sequence: SequenceAddress
): readonly MatchView[] {
  return document.matches.filter((held) => {
    const address = sequenceOf(held);
    return address !== null && sameSequence(address, sequence);
  });
} // End of function membersOfSequence()

/**
 * Why this application will not move one snippet at all.
 *
 * **A code, never a sentence** (CLAUDE.md section 2). {@link moveRefusalKey} maps
 * it to a dictionary key and `tMoveRefusal` in `../i18n` renders it; a component
 * never builds the key.
 */
export type MoveRefusal =
  /** The projection says this application must refuse to write the file. */
  | 'readOnly'
  /** The snippet and the file handed in are not a pair this projection describes. */
  | 'notInDocument'
  /** The projection gives it no address as an item of any sequence. */
  | 'noSequencePosition'
  /** It is the only snippet of its sequence, so there is nowhere to move it. */
  | 'onlySnippetInSequence'
  /**
   * This window is holding unsaved edits to it.
   *
   * **This application's workflow policy, not the core's rule** — see this
   * module's header, and consult correction 2.
   */
  | 'unsavedDraft';

/**
 * Whether one snippet may be moved, and why not when it may not.
 *
 * A discriminated union rather than a boolean with a nullable reason, so a
 * refused verdict with no reason is not representable — the shape every verdict
 * in this directory has.
 */
export type MoveEligibility =
  | {
      /** The snippet may be moved. */
      readonly kind: 'movable';
    }
  | {
      /** It may not, and the reason is shown. */
      readonly kind: 'refused';
      /** Why, as a code. */
      readonly reason: MoveRefusal;
    };

/** The one movable verdict, shared rather than rebuilt per snippet. */
const MOVABLE: MoveEligibility = Object.freeze({ kind: 'movable' as const });

/**
 * Whether one snippet of one projected file may be moved.
 *
 * **The first two arguments are checked against each other**, which is
 * `deletionEligibility`'s `notInDocument` arm for the same reason: a snippet and
 * its file are one fact, and a caller passing a second value straight from the
 * live selection type-checks perfectly and can be wrong.
 *
 * The order of the checks is a claim about which fact is the most fundamental
 * rather than about which is the most likely: whether the pair is real, then
 * whether this application may write the file at all, then whether the snippet
 * has an address a move can work from, then whether its sequence has anywhere to
 * move it to, and last the one rule that is about the person's workflow rather
 * than about the file.
 *
 * **Every arm is an affordance derived from current state, never
 * authorization**: if this projection and the file disagree, the command refuses
 * and that refusal is what reaches the screen. Drift can produce a surfaced
 * refusal and never an invalid write.
 *
 * **What the `unsavedDraft` arm protects against, and what it does not.** The
 * comparison is {@link sameIdentity} — all three fields — because a `MatchId` is
 * **session-local**: after a reprojection the same arena node of the same file can
 * be an unrelated snippet, so treating an older-revision `{document, node}` pair
 * as "the same snippet" would refuse the move for a snippet nobody is editing. The
 * price is stated rather than hidden: once the draft's identity is older than the
 * projection this eligibility is computed over, **the rule stops matching and the
 * move is allowed**, and a committed move then strands those edits exactly as the
 * dictionary sentence describes.
 *
 * **Nothing in this application closes that today, and `identityInProjection` is
 * not what closes it.** That function resolves a node against whatever projection
 * the window now holds and answers *that* projection's identity, and its own doc
 * comment says it must not be used to follow a snippet across a reparse: node 10 of
 * the new parse can be an unrelated snippet, so feeding its answer in here would
 * refuse **that** snippet for `unsavedDraft` — the very defect the whole-identity
 * comparison was written to remove. What would close it is a coordinator that
 * *owns* the relation between an open editor and the snippet it is editing and
 * re-points it when the file is re-read, or a rule that a stale draft must be saved
 * or discarded before a move is offered at all. Both are step 2's, and nothing in
 * TypeScript can say where this argument came from, which is why it is written
 * here.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @param match - The snippet's projection, from that same file.
 * @param unsavedDraftFor - The snippet this window is holding unsaved edits for,
 *   **by the identity this projection gives it**, or `null` when it holds none.
 *   **Required and nullable rather than defaulted**: a default would be this
 *   function inventing "there are none" for a caller that simply did not look.
 * @returns The verdict, with a reason code when it is a refusal.
 */
export function moveEligibility(
  document: DocumentView,
  match: MatchView,
  unsavedDraftFor: MatchId | null
): MoveEligibility {
  const belongs =
    match.id.document === document.id &&
    match.id.revision === document.revision &&
    document.matches.some((held) => held.id.node === match.id.node);
  if (!belongs) {
    return { kind: 'refused', reason: 'notInDocument' };
  }
  if (document.read_only) {
    return { kind: 'refused', reason: 'readOnly' };
  }
  const sequence = sequenceOf(match);
  if (sequence === null) {
    return { kind: 'refused', reason: 'noSequencePosition' };
  }
  if (membersOfSequence(document, sequence).length <= 1) {
    return { kind: 'refused', reason: 'onlySnippetInSequence' };
  }
  if (unsavedDraftFor !== null && sameIdentity(unsavedDraftFor, match.id)) {
    return { kind: 'refused', reason: 'unsavedDraft' };
  }
  return MOVABLE;
} // End of function moveEligibility()

/** Where the person has said the snippet should go. */
export type MovePlacement =
  | {
      /** At the top of the sequence. */
      readonly kind: 'top';
    }
  | {
      /** Directly after one named snippet. */
      readonly kind: 'after';
      /** The snippet it should follow, **by identity**. */
      readonly anchor: MatchId;
    }
  | {
      /** At the bottom of the sequence. */
      readonly kind: 'end';
    };

/** The top placement, shared rather than rebuilt. */
const AT_TOP: MovePlacement = Object.freeze({ kind: 'top' as const });

/** The end placement, shared rather than rebuilt. */
const AT_END: MovePlacement = Object.freeze({ kind: 'end' as const });

/**
 * What the wire actually takes: an anchor, or the front of the sequence.
 *
 * **A second type, because `end` is not on the wire.** `move_match` takes
 * `after: MatchId | null` and nothing else, so the panel's third option is
 * lowered to *after the last other snippet* before it can travel — see this
 * module's header. Keeping the two apart is what stops a lowering being mistaken
 * for a contract.
 */
export type MoveTarget =
  | {
      /** The wire's `after: null`. */
      readonly kind: 'front';
    }
  | {
      /** The wire's `after: <anchor>`. */
      readonly kind: 'after';
      /** The snippet the moved one is written after. */
      readonly anchor: MatchId;
    };

/** The front target, shared rather than rebuilt. */
const TO_THE_FRONT: MoveTarget = Object.freeze({ kind: 'front' as const });

/**
 * Whether two placements say the same thing.
 *
 * The idiom the whole of `./draft.ts` is built on: *a change that changes nothing
 * is not a change*. It matters here because a placement that really moves
 * withdraws the consent and the outcome on screen, so a control re-emitting the
 * value it already holds would otherwise clear a refusal panel nobody dismissed.
 *
 * @param one - One placement.
 * @param other - The other.
 * @returns `true` when they name the same position, anchor included.
 */
function samePlacement(one: MovePlacement, other: MovePlacement): boolean {
  if (one.kind !== other.kind) {
    return false;
  }
  return one.kind === 'after' && other.kind === 'after'
    ? sameIdentity(one.anchor, other.anchor)
    : true;
} // End of function samePlacement()

/**
 * One move, as a value.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1: a
 * component holds one in a `$state.raw` and reassigns it, and every function
 * below returns a new session without touching its argument.
 */
export interface MatchMoveSession {
  /** The snippet this is about, by the identity this window holds. */
  readonly match: MatchId;
  /** The file it lives in. */
  readonly document: DocumentId;
  /** The sequence it is an item of, or `null` when it addresses none. */
  readonly sequence: SequenceAddress | null;
  /** Whether it may be moved at all, and why not when it may not. */
  readonly eligibility: MoveEligibility;
  /**
   * Every snippet of that sequence, in file order, **this one included**.
   *
   * The moving snippet is in this list because *where it is now* is a fact about
   * the list rather than about the snippet: {@link MatchMoveView.placement}'s
   * "already there" question is answered by looking at what sits before it here.
   */
  readonly members: readonly MatchId[];
  /**
   * Those of {@link MatchMoveSession.members} an `after` may name.
   *
   * The complete sequence minus the snippet being moved — the self-anchor
   * exclusion, and the whole of it. Identities only: a screen that wants to
   * *name* one resolves it against the projection it already draws the snippet
   * list from, which is what {@link movePlacementOptionsOf} does.
   */
  readonly anchors: readonly MatchId[];
  /**
   * The base revision, the chosen placement and the consent, as one value.
   *
   * Its **base value** is where the snippet already is, so the draft's own
   * comparison is what says whether a destination has been chosen at all.
   */
  readonly draft: Draft<MovePlacement>;
  /** Whether a move is in flight. */
  readonly phase: EditorPhase;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<MovePlacement> | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<MovePlacement> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed move whose adoption failed. The
   * bytes are on disk (`PROGRESS.md` D2) and what failed is this window's attempt
   * to bring itself back into step.
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How the last attempt failed to produce an outcome at all, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * How far a confirmed reload of the disk version has got.
   *
   * **Reset to `idle` by every new outcome and by every dismissal**, which is what
   * stops a confirmation collected for one conflict from being spendable while a
   * later one is on screen. The window refuses a spent confirmation too, but this
   * is the guard that means the situation never arises.
   */
  readonly reload: ReloadStep;
  /**
   * Whether a confirmed reload has ended this session.
   *
   * **The match-level reload result the consult's Q3 ruled**: install the disk
   * projection and *close* this panel, never re-seed anything from a fresh
   * projection — identifying a match across revisions is 2c-4b. The panel that
   * reads this closes itself; everything here refuses once it is `true`.
   */
  readonly closed: boolean;
  /**
   * Whether a move has committed through this session.
   *
   * **The file was rewritten, and nothing else.** Set by a committed save and
   * cleared by **nothing** — {@link applyMove} only ever ors into it. It is not
   * the question "are this session's identities still good?" — that is
   * {@link MatchMoveSession.invalidated}, which a commit also sets and which a
   * `committed: false` can set on its own.
   */
  readonly moved: boolean;
  /**
   * Whether this session's identities can no longer be vouched for.
   *
   * **A second fact, because it is a second fact** — see this module's header.
   * {@link applyMove} sets it from a committed save and from an adoption
   * `BrowserState.moveMatch` owed at all — so it is set whenever that wrapper
   * re-read the file, whether or not the move committed. {@link moveRecoveryFailed}
   * is the third producer, and the only one where the projection was **not**
   * replaced: the recovery is offered precisely because the command said this
   * window's address does not describe the file it read, so a re-read that then
   * fails leaves a session whose identities are known to disagree with the file and
   * cannot be refreshed. Cleared by nothing: `match`, `members` and `anchors` were
   * all minted from a parse that is gone or from one the file has contradicted, and
   * no transition here can mint them again.
   *
   * **A conflict was a fourth producer until 2c-4a-2**, because the wrapper
   * installed the projection the conflict carried while reporting `notOwed`. It
   * installs nothing now (consult Q2), so invalidation follows actual projection
   * adoption and a conflict is not one.
   *
   * **It is what this session was told, never everything that is true.** A
   * reprojection the wrapper did not perform — the window re-reading the file for
   * its own reasons while this panel is open — leaves this `false`, and the live
   * projections {@link moveSubmissionRefusal} takes are the only thing that sees
   * it.
   */
  readonly invalidated: boolean;
  /**
   * Whether a send failed in a way that may already have written the file.
   *
   * **The third thing that spends a session, and the only one that spends it
   * without knowing what happened.** `may_have_written` on the wire means the save
   * failed at or after the rename, so the file may already hold the moved snippet
   * and this application cannot tell.
   *
   * **What spends the session is that uncertainty and the identity it leaves
   * stale, never a fear of writing twice.** A session resends its **frozen** base
   * revision, so if the first write did land, that base is stale and the resend
   * conflicts rather than duplicating. Saying otherwise is what both dictionaries
   * said until the third round, and what two comments here said until the fourth.
   * And the `outOfDate` sentence — *nothing has been written* — would be a claim
   * this session has just disclaimed.
   *
   * A flag of its own rather than a read of {@link MatchMoveSession.sendFailure},
   * because {@link dismissMoveOutcome} clears that field and putting a panel away
   * must not hand a spent session back. Set by {@link moveCouldNotBeSent} and
   * cleared by **nothing** — it is or-ed into, like `moved` and `invalidated`.
   */
  readonly mayHaveWritten: boolean;
  /**
   * The moved snippet's identity in the new revision, or `null`.
   *
   * `SaveResult.moved` for the arm that answered it. **`null` is legal on a
   * committed move** — the command answers no identity when the file changed
   * again between the write and the read that followed it — so a screen that
   * offers to point at the snippet has to be able to draw that case.
   */
  readonly landed: MatchId | null;
}

/**
 * Where the snippet already is, in the vocabulary the destination panel uses.
 *
 * The top of the list, or after whatever is written above it. Never `end`: `end`
 * and *after the last other snippet* are one request lowered two ways, and
 * choosing the second as the origin keeps the origin a single value rather than
 * a pair that has to be kept in step.
 *
 * @param members - Every snippet of the sequence, in file order.
 * @param match - The snippet being moved.
 * @returns Its current position as a placement; the top when the list does not
 *   hold it, which only an ineligible session can reach.
 */
function originOf(members: readonly MatchId[], match: MatchId): MovePlacement {
  const at = members.findIndex((one) => sameIdentity(one, match));
  const before = at <= 0 ? undefined : members[at - 1];
  return before === undefined ? AT_TOP : { kind: 'after', anchor: before };
} // End of function originOf()

/**
 * Opens a move over one snippet of one file.
 *
 * The base revision is the **document's**, not the identity's, and the two agree
 * whenever the pair is one this projection describes — which is exactly what
 * {@link moveEligibility}'s `notInDocument` arm checks, so a mismatch is a
 * refusal rather than a silently wrong base.
 *
 * **Every identity this session holds is a plain copy**, and that is load-bearing
 * rather than tidy: {@link PLACEMENT_RULES} snapshots through `structuredClone`,
 * which **throws** on a reactive proxy, and the projections a screen reads come
 * out of `BrowserState.views`, which is `$state` and therefore deeply proxied.
 * The mounted test of 2c-3a-2 is what found that class of defect; a model test
 * cannot, because model tests pass plain fixtures.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @param match - The snippet's projection, from that same file.
 * @param unsavedDraftFor - The snippet this window is holding unsaved edits for,
 *   or `null`. Required, for {@link moveEligibility}'s reason.
 * @returns A session showing where the snippet is, with nothing said.
 */
export function startMatchMove(
  document: DocumentView,
  match: MatchView,
  unsavedDraftFor: MatchId | null
): MatchMoveSession {
  const identity = plainIdentity(match.id);
  const sequence = sequenceOf(match);
  const members =
    sequence === null
      ? []
      : membersOfSequence(document, sequence).map((held) => plainIdentity(held.id));
  return {
    match: identity,
    document: document.id,
    sequence,
    eligibility: moveEligibility(document, match, unsavedDraftFor),
    members,
    anchors: members.filter((one) => !sameIdentity(one, identity)),
    draft: startDraft(document.revision, originOf(members, identity), PLACEMENT_RULES),
    phase: 'editing',
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    reload: NOT_RELOADING,
    closed: false,
    moved: false,
    invalidated: false,
    mayHaveWritten: false,
    landed: null
  };
} // End of function startMatchMove()

/**
 * The conflict the session is showing, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchMoveSession): ConflictModel<MovePlacement> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether the destination controls accept a choice right now.
 *
 * Five reasons they may not: a move is in flight, a conflict is on screen, one has
 * already committed, a send failed in a way that may already have written the file,
 * or this session has been told that the projection its anchors were minted from
 * has been replaced.
 *
 * **This one does not take the live projections**, and that is a deliberate line
 * rather than an omission: choosing is a change to what the panel is *showing*,
 * and a destination chosen over a projection that has since been replaced is
 * refused where it would matter — at {@link moveSubmissionRefusal}, which is the
 * one place that asks the live projections, and at {@link beginMove}, which asks
 * the same question of its own argument. So a stale session can still be clicked
 * about; it cannot send anything.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link choosePlacement} would do anything.
 */
export function canChoose(session: MatchMoveSession): boolean {
  return (
    !session.closed &&
    session.phase === 'editing' &&
    !session.moved &&
    !session.invalidated &&
    !session.mayHaveWritten &&
    conflictOf(session) === null
  );
} // End of function canChoose()

/**
 * The placement the session is holding.
 *
 * A named read rather than a walk into the draft at each call site.
 *
 * @param session - The session to ask about.
 * @returns Where the snippet would go.
 */
export function placementOf(session: MatchMoveSession): MovePlacement {
  return session.draft.value;
} // End of function placementOf()

/**
 * Chooses where in the sequence the snippet should go.
 *
 * An `after` naming a snippet that is not one of this session's own anchors is
 * **refused**, so neither a foreign snippet nor the moving snippet itself can be
 * installed as an anchor by a caller. The comparison is all three fields of the
 * identity, so an anchor from an older parse of the right file is refused too.
 *
 * **The anchor installed is this session's copy, never the argument's**, which is
 * the same `structuredClone` argument {@link startMatchMove} makes: a caller may
 * build a placement around an identity read straight out of a reactive
 * projection, and the draft would throw on it.
 *
 * A placement that really moves withdraws everything said about the last
 * attempt. `amendDraft` is what records it — a destination replaces the previous
 * destination rather than joining a history, so there is no undo stack over a
 * radio group, and it drops the consent because consent is content-addressed to
 * the candidate it was collected for.
 *
 * @param session - The session.
 * @param placement - Where the snippet should go.
 * @returns The session with that placement, or the same session when it is not
 *   accepting choices, the anchor is not one of its own, or nothing changed.
 */
export function choosePlacement(
  session: MatchMoveSession,
  placement: MovePlacement
): MatchMoveSession {
  if (!canChoose(session) || samePlacement(session.draft.value, placement)) {
    return session;
  }
  let chosen: MovePlacement = placement;
  if (placement.kind === 'after') {
    const held = session.anchors.find((one) => sameIdentity(one, placement.anchor));
    if (held === undefined) {
      return session;
    }
    chosen = { kind: 'after', anchor: held };
  } // End of the arm that checks an anchor against this session's own
  const draft = amendDraft(session.draft, chosen);
  if (draft === session.draft) {
    return session;
  }
  return {
    ...session,
    draft,
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null
  };
} // End of function choosePlacement()

/**
 * What one placement is, as the wire's `after`.
 *
 * The `end` lowering lives here and nowhere else: *after the last snippet of the
 * sequence that is not the one being moved*, which is what
 * {@link MatchMoveSession.anchors} already is. `null` when the placement cannot
 * be lowered at all — an `after` naming a snippet this session does not offer, or
 * an `end` in a sequence with no other snippet, which
 * {@link moveEligibility}'s `onlySnippetInSequence` arm has already refused.
 *
 * @param session - The session holding the anchors.
 * @param placement - The placement to lower.
 * @returns What the command takes, or `null`.
 */
export function lowerPlacement(
  session: MatchMoveSession,
  placement: MovePlacement
): MoveTarget | null {
  switch (placement.kind) {
    case 'top':
      return TO_THE_FRONT;
    case 'after': {
      const anchor = session.anchors.find((one) => sameIdentity(one, placement.anchor));
      return anchor === undefined ? null : { kind: 'after', anchor };
    }
    case 'end': {
      const last = session.anchors[session.anchors.length - 1];
      return last === undefined ? null : { kind: 'after', anchor: last };
    }
  }
} // End of function lowerPlacement()

/**
 * Whether one target would leave the snippet exactly where it already is.
 *
 * Asked of the **lowered** target rather than of the placement, and that is the
 * whole reason it takes one: for a snippet that is already last, *end* and *after
 * the snippet above it* are two placements and one request, and a comparison made
 * on the placement would call the first a move.
 *
 * @param members - Every snippet of the sequence, in file order.
 * @param match - The snippet being moved.
 * @param target - What would be sent.
 * @returns `true` when the file already writes the snippet there.
 */
function movesNothing(
  members: readonly MatchId[],
  match: MatchId,
  target: MoveTarget
): boolean {
  const at = members.findIndex((one) => sameIdentity(one, match));
  if (at === -1) {
    // The sequence does not hold it, so nothing can be said about where it sits
    // in one. `moveEligibility` has already refused such a session.
    return false;
  }
  if (target.kind === 'front') {
    return at === 0;
  }
  const before = at === 0 ? undefined : members[at - 1];
  return before !== undefined && sameIdentity(before, target.anchor);
} // End of function movesNothing()

/**
 * Why the move control does nothing as things stand.
 *
 * **A code, never a sentence.** {@link moveSubmissionRefusalKey} maps it to a
 * dictionary key and `tMoveSubmissionRefusal` in `../i18n` renders it.
 *
 * Separate from {@link MoveRefusal} because the two answer different questions: a
 * `MoveRefusal` says this snippet cannot be moved *at all*, and belongs beside the
 * snippet; this says the panel cannot send *what it is currently showing*, and
 * belongs beside the control.
 */
export type MoveSubmissionRefusal =
  /**
   * A move has already committed through this session, and nothing since is in
   * doubt.
   *
   * **The definite arm, and therefore the losing one wherever `mayHaveWritten` is
   * also true**: `refusalGiven` states that rule and says why.
   */
  | 'alreadyMoved'
  /**
   * A send failed in a way that may already have written the file.
   *
   * **Its own arm precisely because `outOfDate`'s sentence says *nothing has been
   * written*.** After a `may_have_written` rejection this application does not
   * know that, and saying it would be the mirror of `PROGRESS.md` D2: a write that
   * may have committed reported afterwards as though it had not. See
   * {@link MatchMoveSession.mayHaveWritten}.
   *
   * **The weakest claim of the seven, so it is the first one asked** — including
   * ahead of `alreadyMoved`, which is the third pass's first finding.
   */
  | 'mayHaveWritten'
  /** A move is in flight. */
  | 'saveInFlight'
  /** A conflict is on screen and has not been dismissed. */
  | 'conflict'
  /** The snippet may not be moved at all; {@link MoveRefusal} says why. */
  | 'notMovable'
  /**
   * This session describes a parse the window is not holding any more.
   *
   * **One code for one fact, and the fact really does have one shape.** A
   * session's `match` and every one of its `anchors` come out of a single
   * projection and therefore share a document and a revision, so the moment that
   * projection is replaced they *all* stop resolving together: "the anchor you
   * chose is gone" and "the snippet you are moving is gone" are the same event
   * seen through whichever destination happens to be selected. This arm was
   * written as `anchorUnavailable` first, covering the first half of that and
   * telling the person to choose another destination — advice that is wrong here,
   * because after a reprojection *every* destination this session offers is stale.
   *
   * Three things produce it, and all three are the same claim:
   * {@link MatchMoveSession.invalidated}; live projections that do not give this
   * session's snippet the identity it holds; and a placement
   * {@link lowerPlacement} cannot lower at all, which today only a hand-assembled
   * session reaches — `MatchMoveSession` is a structural interface with no brand.
   *
   * **Its sentence therefore says only that this window can no longer stand behind
   * the destinations it is offering**, and never *how* that came about. It used to
   * say the window had read the file again, which is true of the commonest producer
   * and false of {@link moveRecoveryFailed}'s — where the window tried to read the
   * file again and could not. One arm renders one sentence, so the sentence has to
   * be true of every way of reaching the arm; that is the same rule
   * {@link refusalGiven} states about which arm wins.
   */
  | 'outOfDate'
  /** The chosen destination is where the file already writes the snippet. */
  | 'alreadyThere';

/**
 * Why the move cannot be sent, given what the window is holding now.
 *
 * **The one rule, shared by the two callers that ask the question from different
 * sides**: {@link moveSubmissionRefusal} learns the liveness from the live
 * projections, {@link beginMove} learns it from the identity its caller read off
 * them. Computing it twice is what let a view answer `canMove: true` while
 * `beginMove` answered `null`, so there is one copy and both pass the fact in.
 * **What that gives is agreement over consistent inputs, not agreement by
 * construction**: the two `live` values are computed by two callers from two
 * arguments, and nothing here can require them to describe one parse — this
 * module's header says what closes the rest.
 *
 * **The order is a rule and not an arrangement, and the rule is: where two arms
 * are true at once, the one that claims *less* wins.** Each arm renders exactly
 * one sentence, and a sentence is read as a claim about the person's file, so the
 * weakest true claim is the honest one. That makes `mayHaveWritten` — *this
 * application cannot tell what happened* — the **first** question asked:
 *
 * - **above `alreadyMoved`.** Both are true of a session that committed a move and
 *   then met a send it could not account for, and answering the definite *this
 *   snippet has been moved* there draws a certainty beside a send failure whose own
 *   message disclaims it, with a dismissal that takes the uncertain half off the
 *   screen while the flag stays set. That is the third pass's first finding, and
 *   the round before it had these two the other way round;
 * - **above the liveness check.** `outOfDate`'s sentence says *nothing has been
 *   written*, which is the one claim a `may_have_written` rejection has disclaimed.
 *
 * **The same rule puts the liveness check above `notMovable`, and that pair is the
 * fourth pass's first finding.** {@link startMatchMove} freezes `eligibility` at
 * the session's first parse and no transition here recomputes it, so once this
 * session is invalidated or no longer live, *this snippet cannot be moved* is a
 * definite claim about the snippet read off a projection that has since been
 * replaced — while `outOfDate` claims only that this session is stale, which is
 * the half still known to be true. The round before had these two the other way
 * round, and the test that covered `notMovable` drove it only against its own
 * original projection, where the overlap cannot arise.
 *
 * Below those, the order is the order a person would resolve them in: what the
 * session is doing, then whether this session still describes the file the window
 * is showing, then whether the snippet can move at all, then what the destination
 * panel is showing.
 *
 * @param session - The session to ask about.
 * @param live - Whether the projection this window holds **now** still gives this
 *   session's snippet the identity the session holds.
 * @returns The reason, or `null` when the move may be sent.
 */
function refusalGiven(
  session: MatchMoveSession,
  live: boolean
): MoveSubmissionRefusal | null {
  // **First, by the rule above**: the least certain arm wins over every definite
  // one, so a session that is both spent by a commit and spent by a send it could
  // not account for says the second.
  if (session.mayHaveWritten) {
    return 'mayHaveWritten';
  }
  if (session.moved) {
    return 'alreadyMoved';
  }
  if (session.phase === 'saving') {
    return 'saveInFlight';
  }
  if (conflictOf(session) !== null) {
    return 'conflict';
  }
  // **By the same rule, one pair further down**: `eligibility` was frozen at this
  // session's first parse, so once the session is stale the definite claim about
  // the snippet is the one that may no longer be true, and the weaker `outOfDate`
  // wins over it.
  if (session.invalidated || !live) {
    return 'outOfDate';
  }
  if (session.eligibility.kind !== 'movable') {
    return 'notMovable';
  }
  const target = lowerPlacement(session, session.draft.value);
  if (target === null) {
    return 'outOfDate';
  }
  if (movesNothing(session.members, session.match, target)) {
    return 'alreadyThere';
  }
  return null;
} // End of function refusalGiven()

/**
 * Whether the projections handed in still describe this session.
 *
 * `identityInProjection` is the same call a screen makes to produce
 * {@link beginMove}'s argument, so the two sides of the question are asked of one
 * function rather than of two lookups that could drift apart.
 *
 * @param session - The session to ask about.
 * @param views - Every projection this window holds now, in any order.
 * @returns `true` when the current projection of that file still gives the snippet
 *   this session's identity for it.
 */
function sessionIsLive(session: MatchMoveSession, views: readonly DocumentView[]): boolean {
  const projected = identityInProjection(views, session.match);
  return projected !== null && sameIdentity(projected, session.match);
} // End of function sessionIsLive()

/**
 * Why the move cannot be sent, or `null` when it can.
 *
 * **It takes the live projections, and that is not ceremony.**
 * {@link movePlacementOptionsOf} builds the destination list from them, so a
 * refusal computed from the session's frozen snapshot alone could — and did —
 * report `canMove: true` about a destination the panel was no longer even
 * offering, with the control then producing nothing at all. Both read the same
 * projections now (the 2c-3b-1 review's third finding).
 *
 * @param session - The session to ask about.
 * @param views - Every projection this window holds **now**, in any order. The
 *   same list {@link movePlacementOptionsOf} is given; nothing here can check that
 *   a caller passes the same one, or a current one.
 * @returns The reason, or `null` when {@link beginMove} would produce something
 *   to send.
 */
export function moveSubmissionRefusal(
  session: MatchMoveSession,
  views: readonly DocumentView[]
): MoveSubmissionRefusal | null {
  return refusalGiven(session, sessionIsLive(session, views));
} // End of function moveSubmissionRefusal()

/**
 * Whether the move may be sent.
 *
 * @param session - The session to ask about.
 * @param views - Every projection this window holds now, in any order.
 * @returns `true` when {@link moveSubmissionRefusal} answers `null`.
 */
export function canMove(session: MatchMoveSession, views: readonly DocumentView[]): boolean {
  return !session.closed && moveSubmissionRefusal(session, views) === null;
} // End of function canMove()

/** A move about to be sent: the session that is waiting, and what to send. */
export interface StartedMove {
  /** The session, now in flight, with the submission recorded on it. */
  readonly session: MatchMoveSession;
  /**
   * What was sent, for the acknowledgement round trip.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only
   * place the two are put together. Its `baseRevision` is the one the session was
   * opened at, frozen there and never re-read.
   */
  readonly submission: DraftSubmission<MovePlacement>;
  /** The snippet to move, by identity. */
  readonly match: MatchId;
  /**
   * The snippet it should follow, or `null` for the top of the sequence.
   *
   * Already lowered: the panel's *end* has become an identity by the time it
   * reaches here, because the wire has no such anchor.
   */
  readonly after: MatchId | null;
}

/**
 * Starts a move of the destination the session is showing.
 *
 * **The only thing in this module that produces a {@link StartedMove}**, and it
 * refuses every way of arriving here without a real, current, moving
 * destination — through {@link moveSubmissionRefusal}'s own rule, run here with
 * the liveness taken from `projected` rather than from a projection list. **What
 * that gives is one rule rather than two**, so a screen and this function reach the
 * same verdict about the same parse; it does not give agreement about *different*
 * parses, because the liveness arrives here as an argument and there is no way to
 * require it to be the one the view was drawn from.
 *
 * **`projected` is the only argument that comes from outside the session**, and
 * it is therefore the only one that can notice a reprojection: everything else
 * was minted at {@link startMatchMove} and goes on agreeing with itself however
 * stale it all is. That is `confirmDelete`'s fourth-value rule applied to a move.
 *
 * **What no type forces**, in the same sentence as what one does: `projected` is
 * an ordinary `MatchId`, so a caller that hands back `session.match` rather than
 * reading the live projection gets no warning and no check. What is closed is
 * that a caller which *does* read it — `identityInProjection` in
 * `./matchDeletion.ts` is the one place that produces it — cannot spend a
 * destination chosen before a reparse on the parse that replaced it.
 *
 * **There is no separate confirmation** (consult Q7): choosing a destination and
 * pressing move is already a deliberate two-step interaction, and only a refused
 * outcome introduces the acknowledge-and-retry round.
 *
 * @param session - The session showing the destination.
 * @param projected - The identity the projection this window holds **now** gives
 *   the snippet, or `null` when it holds no such snippet any more. Required, and
 *   nullable rather than defaulted: a default would be this function inventing
 *   agreement for a caller that did not look.
 * @returns The waiting session and what the command takes, or `null`.
 */
export function beginMove(
  session: MatchMoveSession,
  projected: MatchId | null
): StartedMove | null {
  // **The same rule the view side runs**, with the liveness taken from the
  // argument instead of from a projection list. The refusal was a second
  // computation once, and it omitted the live check — so a screen reported
  // `canMove: true` about a session this function refuses.
  const live = projected !== null && sameIdentity(projected, session.match);
  // **A closed session sends nothing.** A confirmed reload adopted the disk
  // projection and ended this panel, so its identities describe a parse the window
  // has crossed away from. No refusal *code* is added for it, and that is
  // deliberate: a code is a sentence on a screen, and a closed panel is not on one.
  if (session.closed || refusalGiven(session, live) !== null) {
    return null;
  }
  const submission = submissionOf(session.draft);
  // Lowered from **the submission's own candidate**, so the three values that
  // travel together — the candidate, the consent bound to it and the anchor
  // derived from it — cannot describe two different destinations. The refusal
  // above has already established that this lowering succeeds; the `null` arm is
  // what makes this function total rather than a second check claiming to catch
  // something.
  const target = lowerPlacement(session, submission.candidate);
  if (target === null) {
    return null;
  }
  return {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      sendFailure: null
    },
    submission,
    match: session.match,
    after: target.kind === 'front' ? null : target.anchor
  };
} // End of function beginMove()

/**
 * Takes a move's answer.
 *
 * **Not sealed, and that is not an omission.** The seal of `./invalidation.ts`
 * exists because a whole-document replacement makes every identity in a file
 * stale with no single identity to answer with. A move has one —
 * `SaveResult.moved` — and `BrowserState.moveMatch` performs the adoption before
 * this can be called, and answers what became of it.
 *
 * On a `saved` arm the draft's base moves to the revision the transaction ended
 * on, through `savedDraft`, which spends the consent. A **committed** move
 * additionally sets `moved` and records the new identity in `landed`.
 *
 * **`adoption` is not only a message**, and reading it as one was the 2c-3b-1
 * review's first finding. An adoption that was *owed at all* — `done` or
 * `failed` — means
 * `BrowserState.moveMatch` re-read and re-projected the file, so every identity
 * this session holds is stale whatever the arm said about writing. That sets
 * `invalidated`, which spends the session on its own; `committed: false` with a
 * revision this window was not already projecting is exactly the answer that does
 * it without a byte being written. Nothing here clears either flag.
 *
 * **A conflict does not set `invalidated`, and 2c-4a-2 is where that changed.**
 * Until then `BrowserState.moveMatch` installed the projection the conflict
 * carries on `disk` — replacing this window's projection of the file, and
 * therefore every identity this session holds — while reporting
 * `adoption: notOwed`, so the arm was the only evidence there was and this
 * function derived staleness from it. The consult's Q2 ruled that eager install a
 * defect: a conflict writes nothing and now **replaces nothing**, so the
 * identities this session holds are still the ones the window is projecting, and
 * claiming otherwise would refuse a move that has become possible again for no
 * reason a person could see. Invalidation follows **actual projection adoption**,
 * which is `adoption.kind !== 'notOwed'` and, from 2c-4a-3, a confirmed reload
 * that closes this session outright.
 *
 * **What no type forces**, in the same sentence: nothing here can check that the
 * caller really left its projection alone, any more than it could check that the
 * caller installed one before. What keeps the two sides agreeing is that
 * `BrowserState.moveMatch` has exactly one conflict rule and it is written down at
 * both ends.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.** The
 * snippet really did move; telling the person the move failed would invite a
 * retry of a write that already happened (`PROGRESS.md` D2).
 *
 * @param session - The session waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.moveMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look — and since a `notOwed` is
 *   now what keeps the session usable, that invention would be the defect rather
 *   than a shortcut.
 * @returns The session showing what the move ended as.
 */
export function applyMove(
  session: MatchMoveSession,
  result: SaveResult,
  adoption: InvalidationStatus
): MatchMoveSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft, CONFLICT_CAPABILITIES);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  // **The two facts, kept apart.** `committed` says the file was rewritten; an
  // adoption that ran at all says this window replaced its projection of that
  // file, which is what makes these identities stale. A commit implies the
  // second, and the second does not imply the first.
  // Both are `session.<flag> ||` and neither is a plain assignment, so "cleared by
  // nothing" is what the code does and not only what the reachable call graph
  // happens to allow: a second answer handed to a session that has already
  // committed cannot take the commit back.
  // **A conflict is not a third producer, and it was until 2c-4a-2.** The wrapper
  // installed the projection the conflict carried and reported `notOwed` for it,
  // so the arm was the only evidence; it installs nothing now, so there is nothing
  // to be evidence of. See this function's JSDoc.
  const committed = result.outcome === 'saved' && result.committed;
  const moved = session.moved || committed;
  const invalidated = session.invalidated || committed || adoption.kind !== 'notOwed';
  if (result.outcome !== 'saved') {
    return {
      ...session,
      phase: 'editing',
      invalidated,
      outcome,
      extraMessages,
      // **A new outcome resets the reload**, so a confirmation collected for an
      // earlier conflict cannot be spent while this one is on screen.
      reload: NOT_RELOADING,
      sendFailure: null
    };
  }
  return {
    ...session,
    moved,
    invalidated,
    landed: result.moved,
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    outcome,
    extraMessages,
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function applyMove()

/**
 * Records that the move produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are "no" and "this application cannot
 * tell".
 *
 * **The second of those spends the session.** `mayHaveWritten` is or-ed into
 * {@link MatchMoveSession.mayHaveWritten}, which nothing clears, so the panel stops
 * accepting destinations and {@link beginMove} produces nothing until a new session
 * is opened over a fresh projection. Before the 2c-3b-1 confirmation pass this
 * answer was recorded on `sendFailure` alone: neither {@link canChoose} nor the
 * submission rule consulted it, so the same move was immediately offered for retry,
 * and once the wrapper's own re-read had landed the reason shown was `outOfDate` —
 * *nothing has been written* — beside a message telling the person to look at the
 * file first.
 *
 * A `notSent` is the other half and spends nothing: the command failed before the
 * rename, so the file really does still hold what it held.
 *
 * **The two arguments describe one failure, and nothing here can require it.** In
 * production `BrowserState.moveMatch` computes the flag with `mayHaveWritten` in
 * `../ipc/errors` from the very failure it hands on as `reason`, which is why
 * {@link moveRecoveryChoices} can say what a `mayHaveWritten` send is offered; a
 * caller pairing an unrelated reason with a set flag is well-typed.
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the moved snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @returns The session, back to its resting state, with the right notice raised.
 */
export function moveCouldNotBeSent(
  session: MatchMoveSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null
): MatchMoveSession {
  return {
    ...session,
    phase: 'editing',
    mayHaveWritten: session.mayHaveWritten || mayHaveWritten,
    sendFailure: sendFailureOf(mayHaveWritten, reason)
  };
} // End of function moveCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the session rather than from an argument, so a caller cannot pair one
 * destination's acknowledgement with another destination.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeMoveFindings(session: MatchMoveSession): MatchMoveSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeMoveFindings()

/**
 * Puts the outcome away.
 *
 * The draft is untouched — this is a panel being dismissed, not a state being
 * resolved — and the submission goes with it, because there is nothing left on
 * screen to acknowledge. It does **not** give a spent session back: `moved`,
 * `invalidated` and `mayHaveWritten` all survive this, so nobody can dismiss their
 * way into sending from a session whose identity and base revision may no longer
 * describe the file — the `mayHaveWritten` case included, where this application
 * does not know what the file now holds. **Not** because a resend would repeat a
 * write: it would carry the frozen base revision and conflict. The `sendFailure`
 * it clears is the *message*; the flag that spends the session is a separate field
 * for exactly this reason.
 *
 * **Dismissing a conflict gives the session back, and 2c-4a-2 is where that
 * changed.** A conflict wrote nothing and — since the consult's Q2 removed the
 * eager install — replaces nothing, so `moved` stays `false`, `invalidated` stays
 * whatever it was, and the identities this session holds are still the ones the
 * window is projecting. The panel goes away with the outcome and the move may be
 * decided again. What has *not* changed is the file, so a resend is **refused**
 * rather than allowed to overwrite the other writer's bytes — and the 2c-4a-2
 * review's third finding is that *which* refusal is not the conflict this panel
 * showed. `conflict_after_the_lock` refreshed the Rust workspace cache to the disk
 * revision when it produced that conflict, so `move_match`'s leading `view_at`
 * compares the frozen base against **that** and answers `identityStaleRevision`
 * before the locked save check is ever reached (`src-tauri/src/commands.rs`). The
 * write safety is the same; the sentence a person sees is not. Until 2c-4a-2 the wrapper installed the
 * disk projection here and {@link applyMove} therefore spent the session from the
 * conflict arm itself.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last attempt.
 */
export function dismissMoveOutcome(session: MatchMoveSession): MatchMoveSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function dismissMoveOutcome()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing or one has already been asked about.
 */
export function askToReloadDiskVersion(session: MatchMoveSession): MatchMoveSession {
  const next = reloadAsked(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReloadDiskVersion()

/**
 * Confirms abandoning this move for the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmDiskReload(session: MatchMoveSession): MatchMoveSession {
  const next = reloadConfirmed(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmDiskReload()

/**
 * Adopts the disk version into the window and ends this session.
 *
 * **The match-level reload the consult's Q3 ruled, and it is not a reseed.** There
 * is no disk-side `MovePlacement` to load: a destination is a position among identities minted from one parse, and the anchors this session holds name nothing in the revision on disk. So the window crosses to the disk
 * observation and this panel **closes**, which is what the confirmation was
 * collected for.
 *
 * **Nothing is closed for an adoption the window refused.** A `refused` from
 * `adopt` — a spent confirmation, a conflict this window did not produce, or a
 * projection replaced since it arrived — leaves the session exactly as it was,
 * because closing over a window that did not move would report a reload that did
 * not happen. **`alreadyThere` is not a refusal**: the window already holds the
 * bytes that were asked for, so the request is satisfied and this session ends.
 *
 * **What no type here forces**: that `adopt`'s body does anything, and that the
 * panel reading the view's `closed` really closes.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @returns The closed session, or the same session.
 */
export function reloadTheDiskVersion(
  session: MatchMoveSession,
  adopt: AdoptTheDiskVersion<MovePlacement>
): MatchMoveSession {
  const spend = spendTheConfirmedReload(conflictOf(session), session.reload, adopt);
  if (spend === 'notAttempted') {
    return session;
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the
    // 2c-4a-3a review’s finding 3: the confirmation is spent and the window said
    // no for a reason that asking again cannot change, so the control stops being
    // offered and the panel says so. *Keep editing* writes NOT_RELOADING back.
    return { ...session, reload: RELOAD_REFUSED };
  }
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null,
    closed: true
  };
} // End of function reloadTheDiskVersion()

/**
 * What the person may do about a command that produced no outcome.
 *
 * One arm today. It is an **offer**, never a diagnosis: nothing here knows
 * whether re-reading the file will change the answer, only that the failure is
 * one where the file and this window's reading of it disagree.
 */
export type MoveRecovery =
  /** Have this window read the file again, and start from what it finds. */
  'reloadFile';

/** The one recovery, shared rather than rebuilt. */
const RELOAD_ONLY: readonly MoveRecovery[] = Object.freeze(['reloadFile' as const]);

/**
 * What to offer beside a send that produced no outcome.
 *
 * **The consult's Q8, and it is deliberately narrow.** Four codes say that the
 * address this window sent does not describe the file the command read, and
 * re-reading the file is the only thing a person can do about that from this
 * pane:
 *
 * - `moveNotWithinOneSequence` — this application could not establish that the
 *   snippet is an item of the list the move works in. Consult correction 5:
 *   this is **not** what a stale projection normally produces, it is an
 *   unsupported address or an invariant breach between this window and the core;
 * - `identityStaleRevision` — which *is* what a stale projection produces;
 * - `identityNoSuchMatch` and `identityWrongDocument` — the identity names
 *   nothing, or names another file.
 *
 * Everything else is offered nothing, and that is the honest answer rather than a
 * missing one: a `saveFailed`, a `draftRefused` or a `noWorkspaceOpen` is not a
 * disagreement about what the file holds, so a re-read cannot help and offering
 * one would be a control that never works — the same argument
 * `DocumentHasNoMatchListError` makes about *acknowledge and retry*.
 *
 * **So nothing is offered beside a `mayHaveWritten` send, and that follows rather
 * than being decided here** (the third pass's third finding, which found the
 * decision record claiming the opposite). `mayHaveWritten` in `../ipc/errors` is
 * `true` for one code — `saveFailed` — and that code is not in the list above, so
 * in production the two never appear together: a failed sync of the file's
 * directory produces a spent session and an empty `recovery`. The repair there is
 * not a re-read this pane can perform — `BrowserState.moveMatch` has already
 * attempted one — but looking at the file and re-opening the panel over a fresh
 * projection. **What no type forces**, in the same sentence: the flag and the
 * reason are two arguments of {@link moveCouldNotBeSent}, so a caller that does not
 * take both from one failure can hand this an identity code beside a set flag, and
 * the offer would then appear.
 *
 * @param failure - Why the command rejected, or `null` when there is no reason to
 *   act on.
 * @returns The recoveries to offer, or an empty list.
 */
export function moveRecoveryChoices(failure: IpcFailure | null): readonly MoveRecovery[] {
  if (failure === null || failure.kind !== 'command') {
    return [];
  }
  switch (failure.error.code) {
    case 'moveNotWithinOneSequence':
    case 'identityStaleRevision':
    case 'identityNoSuchMatch':
    case 'identityWrongDocument':
      return RELOAD_ONLY;
    default:
      return [];
  }
} // End of function moveRecoveryChoices()

/**
 * Records that the one recovery this session offers did not reach the file.
 *
 * **The session stops being sendable, and the argument for that is the recovery's
 * own premise.** {@link moveRecoveryChoices} offers *read this file again* for four
 * codes and four only, and every one of them says the address this window sent does
 * not describe the file the command read. So by the time this is called the window
 * already **has evidence** that its reading of the file and the file disagree; a
 * read that then fails removes the only way it had of resolving that. Leaving the
 * session live there would let the same disputed identity be sent again, from a
 * panel whose destinations were built from the very reading the command rejected.
 *
 * **Not because a resend would write twice.** A session sends its frozen base
 * revision, so a first write that did land makes that base stale and the resend
 * conflicts rather than duplicating — the reason is the disagreement and the stale
 * identity, exactly as it is for {@link MatchMoveSession.mayHaveWritten}.
 *
 * **The flag it sets is `invalidated` rather than an arm of its own**, so the
 * sentence the panel draws is `outOfDate` — which says the window can no longer
 * stand behind the destinations it is offering, and says nothing about how that
 * came about. The panel goes on drawing `browser.matchMove.reloadFailed` beside the
 * send failure, which is where *why* is said.
 *
 * **What no type forces**, in the same sentence as what one does: nothing here can
 * check that the caller really attempted a read, or that the read really failed.
 * What is closed is that a session this is called on cannot send anything —
 * {@link canChoose}, {@link moveSubmissionRefusal} and {@link beginMove} all refuse
 * it, and no transition in this module clears the flag.
 *
 * @param session - The session whose recovery re-read failed.
 * @returns The session, unable to send anything more.
 */
export function moveRecoveryFailed(session: MatchMoveSession): MatchMoveSession {
  return { ...session, invalidated: true };
} // End of function moveRecoveryFailed()

/**
 * What this surface offers about a conflict.
 *
 * **`operationChoice` is permanent here, and it is the consult's Q4 ruling rather
 * than a limitation of this sub-phase.** The drafted value is a
 * {@link MovePlacement}: *top*, *end* or *after this session-local `MatchId`*. A
 * localized sentence describing it would be a description that cannot restore the
 * operation, so *Copy draft* is not merely unwired for this surface — it can never
 * be offered, and `conflictChoicesFor` refuses it even if `offersCopyDraft` were
 * set. The chosen placement is shown in the retained panel instead.
 *
 * A confirmed reload — install the disk projection and **close** the mover — is **built and wired**: {@link askToReloadDiskVersion},
 * {@link confirmDiskReload} and {@link reloadTheDiskVersion} are the transition,
 * and `MatchMover.svelte`'s `conflictAction` calls them. It is only *unoffered* —
 * `conflictChoicesFor` names nothing this boolean does not admit, so no control
 * that could reach the arm is drawn, which is why an unoffered arm is not a dead
 * control. **Phase 2c-4a-3 flips the boolean**, over machinery that already exists
 * and is already driven by this module's tests.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'operationChoice',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: false,
  offersReload: false
};

/**
 * One destination a screen may offer, with whatever it needs to name it.
 *
 * **The `after` arm carries a projection and not a piece of text.**
 * {@link MatchMoveSession.anchors} is identities only, deliberately — a model
 * holding display text would be holding a second copy of what the snippet list
 * already draws — so what this hands a screen is the *projection* the identity
 * resolves to, and the screen names it the way it names a row, through
 * `triggerLabel` and `labelText` in `./labels.ts`.
 */
export interface MovePlacementOption {
  /**
   * A stable key for a keyed `{#each}` and for a control's own value.
   *
   * Built from the identity's three fields for an `after`, so two anchors of the
   * same file cannot collide and an anchor from an older parse is a different
   * key. It is a rendering key and never a way to recognise a snippet across a
   * change to the file, exactly as `matchKey` in `./labels.ts` is.
   */
  readonly key: string;
  /** The placement this option would install. */
  readonly placement: MovePlacement;
  /** The snippet an `after` names, or `null` for the two empty arms. */
  readonly anchor: MatchView | null;
  /** Whether this is the placement the session currently holds. */
  readonly chosen: boolean;
  /**
   * Whether this option would leave the snippet exactly where it already is.
   *
   * **Two options can carry it at once**, and that is the aliasing this field
   * exists to expose rather than to hide: for a snippet that is already last,
   * *end* and *after the snippet above it* are one request. It is computed from
   * the lowered target, so it is right for both.
   */
  readonly current: boolean;
}

/**
 * Every destination the session can offer, in the order a screen shows them.
 *
 * The consult's Q1 order — **top**, then one option per anchor in the order the
 * file writes them, then **end** — over the complete, unfiltered sequence (Q6).
 *
 * **An anchor this window can no longer name is not offered**, and that is the
 * honest answer rather than a hidden one: the projections handed in are asked for
 * a snippet of the anchor's own document *and its own revision*, so a file
 * re-read since the session opened resolves none of its anchors and the `after`
 * options disappear. {@link moveSubmissionRefusal} is given the **same list** and
 * answers `outOfDate` in exactly that case — for every placement and not only for
 * the `after` ones, because the snippet being moved shares the document and the
 * revision its anchors do and stops resolving with them. The two used to be
 * computed from different sources, and a panel that had dropped every destination
 * still reported that the move could be sent.
 *
 * @param session - The session to describe.
 * @param views - Every projection this window holds, in any order.
 * @returns The options, in the order a screen shows them.
 */
export function movePlacementOptionsOf(
  session: MatchMoveSession,
  views: readonly DocumentView[]
): readonly MovePlacementOption[] {
  const options: MovePlacementOption[] = [optionFor(session, AT_TOP, 'top', null)];
  for (const anchor of session.anchors) {
    const view = views.find((one) => one.id === anchor.document && one.revision === anchor.revision);
    const match = view?.matches.find((one) => one.id.node === anchor.node);
    if (match === undefined) {
      continue;
    }
    options.push(
      optionFor(
        session,
        { kind: 'after', anchor },
        `after:${anchor.document}:${anchor.revision}:${anchor.node}`,
        match
      )
    );
  } // End of the loop over this session's anchors
  options.push(optionFor(session, AT_END, 'end', null));
  return options;
} // End of function movePlacementOptionsOf()

/**
 * One option of {@link movePlacementOptionsOf}, with its two flags derived.
 *
 * A named helper rather than the same four lines three times, so `chosen` and
 * `current` are computed one way for every arm.
 *
 * @param session - The session the flags are about.
 * @param placement - The placement the option would install.
 * @param key - Its rendering key.
 * @param anchor - The snippet an `after` names, or `null`.
 * @returns The option.
 */
function optionFor(
  session: MatchMoveSession,
  placement: MovePlacement,
  key: string,
  anchor: MatchView | null
): MovePlacementOption {
  const target = lowerPlacement(session, placement);
  return {
    key,
    placement,
    anchor,
    chosen: samePlacement(session.draft.value, placement),
    current: target !== null && movesNothing(session.members, session.match, target)
  };
} // End of function optionFor()

/** Everything a screen needs about one move, derived on every read. */
export interface MatchMoveView {
  /** The snippet this is about. */
  readonly match: MatchId;
  /**
   * The file its sequence is in.
   *
   * **The boundary statement's operand** (consult Q4): every destination this
   * view offers is a snippet of this file's list, and the pane says so in
   * `browser.matchMove.withinThisFile`, which names the file. A screen resolves
   * the identity to a path the way the sidebar does.
   */
  readonly document: DocumentId;
  /** Where the snippet would go. */
  readonly placement: MovePlacement;
  /** Whether the move control does anything. */
  readonly canMove: boolean;
  /**
   * Why this snippet cannot be moved at all, as a code, or `null`.
   *
   * **This is the session's frozen eligibility, and {@link cannotMove} is the live
   * refusal.** They are two fields because they answer at two times:
   * `eligibility` was computed once at {@link startMatchMove} and no transition
   * recomputes it, so after a reprojection this field can still name a reason that
   * was read off a parse the window has replaced. `refusalGiven` puts `outOfDate`
   * **above** `notMovable` for exactly that reason.
   *
   * **A screen must therefore not draw this beside a `cannotMove` of `outOfDate`**,
   * or the definite claim the precedence just suppressed comes back through the
   * other field. Nothing in TypeScript can enforce that; the rule is here because
   * the only place it can be broken is a component.
   */
  readonly notMovable: MoveRefusal | null;
  /** Why the control does nothing as things stand, as a code, or `null`. */
  readonly cannotMove: MoveSubmissionRefusal | null;
  /** Whether a move is in flight. */
  readonly moving: boolean;
  /** Whether one has committed. See {@link MatchMoveSession.moved}. */
  readonly moved: boolean;
  /**
   * Whether this session is spent, for any of the three reasons.
   *
   * `moved`, an invalidated projection, **or** a send that may already have
   * written — a screen that keeps the panel open for one has to keep it open for
   * the others, and a `committed: false` whose adoption was owed produces the
   * second without the first. The reason to show beside it is
   * {@link MatchMoveView.cannotMove}, which is `alreadyMoved` for a commit,
   * `mayHaveWritten` for a send this application could not account for, and
   * `outOfDate` for a replaced projection — **and where more than one of them
   * holds, the least certain**, which is the rule `refusalGiven` states.
   */
  readonly spent: boolean;
  /** The moved snippet's identity, or `null`. See the session's own field. */
  readonly landed: MatchId | null;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /** The reasons to show beside that failure, outermost first. */
  readonly failureLines: readonly SendFailureLine[];
  /** What to offer about that failure. See {@link moveRecoveryChoices}. */
  readonly recovery: readonly MoveRecovery[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<MovePlacement> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /**
   * The presentation changes a saved arm disclosed, in report order.
   *
   * **Always empty for a move, and that is read off the core rather than
   * assumed.** A batch containing an `ItemMove` may hold no other edit
   * (`MoveMustBeTheOnlyEditInItsBatch`), and `plan_move` in
   * `crates/espansoconfig-core/src/patch/edit.rs` sets `note: None`, so the only
   * note a relocation could carry is one nothing produces. The field is carried
   * anyway, so that a note the core learns to emit is drawn rather than dropped —
   * plan section 6.2 is *never silently normalise*.
   *
   * **What that leaves open is the core's, not this module's**: a move leaves the
   * doubled blank line at its source that a removal discloses, and says nothing
   * about it. `docs/decisions/2b-2c-2-notes.md` section 6.2 records that half as
   * open.
   */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal, withdrawn once its findings are stale. */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a destination that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<MovePlacement> | null;
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * Whether a confirmed reload was spent and the window refused it.
   *
   * **The disclosure the panel owes for a control that has just gone.** The
   * reload is not offered again once a spend has been refused — asking again
   * could only be refused again — and a control that vanishes with nothing said
   * in its place reads as a bug (2c-4a-3a review, finding 3). Nothing was written
   * and nothing was discarded; *Keep editing* resets the step.
   */
  readonly reloadUnavailable: boolean;
  /**
   * The disk side of that conflict, or `null` when none is showing.
   *
   * A union rather than a string, so *a file of zero characters is a fact about
   * the file rather than a failure to obtain it* is decided in this directory
   * once instead of in each renderer’s markup (2c-4a-3a review, finding 5).
   */
  readonly diskText: ConflictDiskText | null;
  /**
   * Whether a confirmed reload has ended this session.
   *
   * The panel that reads this calls its own `close`: a match-level reload adopts
   * the disk projection and closes, because there is no disk-side draft to seed.
   */
  readonly closed: boolean;
}

/**
 * Everything a screen needs about one move.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up.
 *
 * **It takes the live projections** for {@link moveSubmissionRefusal}'s reason: a
 * view derived from the session alone answered `canMove: true` after a
 * reprojection had emptied the destination list, and a person pressing the control
 * got nothing at all. The refusal is computed **once** here and `canMove` is read
 * off it, so the two fields of this view cannot contradict each other either.
 *
 * @param session - The session to describe.
 * @param views - Every projection this window holds **now**, in any order — the
 *   same list {@link movePlacementOptionsOf} is given. Nothing here can check that
 *   it is that list, or that it is current.
 * @returns The view.
 */
export function matchMoveView(
  session: MatchMoveSession,
  views: readonly DocumentView[]
): MatchMoveView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale = submissionIsStale(session.draft, session.submitted);
  const conflict = conflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  const cannotMove = moveSubmissionRefusal(session, views);
  return {
    match: session.match,
    document: session.document,
    placement: session.draft.value,
    canMove: cannotMove === null,
    notMovable: session.eligibility.kind === 'refused' ? session.eligibility.reason : null,
    cannotMove,
    moving: session.phase === 'saving',
    moved: session.moved,
    spent: session.moved || session.invalidated || session.mayHaveWritten,
    landed: session.landed,
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    recovery: moveRecoveryChoices(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices:
      conflict === null
        ? []
        : conflictChoicesFor(CONFLICT_CAPABILITIES, offeredReloadStep(session.reload)),
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    diskText: conflictDiskText(conflict),
    closed: session.closed
  };
} // End of function matchMoveView()

/**
 * The dictionary key holding one move refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link MoveRefusal} with no sentence is one too.
 *
 * @param reason - Why the snippet may not be moved.
 * @returns The key holding that reason's sentence.
 */
export function moveRefusalKey(reason: MoveRefusal): TranslationKey {
  switch (reason) {
    case 'readOnly':
      return 'browser.matchMove.refused.readOnly';
    case 'notInDocument':
      return 'browser.matchMove.refused.notInDocument';
    case 'noSequencePosition':
      return 'browser.matchMove.refused.noSequencePosition';
    case 'onlySnippetInSequence':
      return 'browser.matchMove.refused.onlySnippetInSequence';
    case 'unsavedDraft':
      return 'browser.matchMove.refused.unsavedDraft';
  }
} // End of function moveRefusalKey()

/**
 * The dictionary key holding one submission refusal's sentence.
 *
 * @param reason - Why the move cannot be sent as things stand.
 * @returns The key holding that reason's sentence.
 */
export function moveSubmissionRefusalKey(reason: MoveSubmissionRefusal): TranslationKey {
  switch (reason) {
    case 'alreadyMoved':
      return 'browser.matchMove.cannotMove.alreadyMoved';
    case 'mayHaveWritten':
      return 'browser.matchMove.cannotMove.mayHaveWritten';
    case 'saveInFlight':
      return 'browser.matchMove.cannotMove.saveInFlight';
    case 'conflict':
      return 'browser.matchMove.cannotMove.conflict';
    case 'notMovable':
      return 'browser.matchMove.cannotMove.notMovable';
    case 'outOfDate':
      return 'browser.matchMove.cannotMove.outOfDate';
    case 'alreadyThere':
      return 'browser.matchMove.cannotMove.alreadyThere';
  }
} // End of function moveSubmissionRefusalKey()

/**
 * The dictionary key holding one recovery's label.
 *
 * @param choice - What the person may do about a failed send.
 * @returns The key holding that choice's label.
 */
export function moveRecoveryKey(choice: MoveRecovery): TranslationKey {
  switch (choice) {
    case 'reloadFile':
      return 'browser.matchMove.recovery.reloadFile';
  }
} // End of function moveRecoveryKey()

/**
 * The acknowledgement one submission carries, for a caller that only needs that.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands consent to the boundary is a place this module can be searched
 * for.
 *
 * @param submission - What {@link beginMove} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(
  submission: DraftSubmission<MovePlacement>
): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

/**
 * The base revision this session would move against.
 *
 * **Frozen at {@link startMatchMove} and never re-read**, and it is what a caller
 * forwards: `BrowserState.moveMatch` takes a base revision and sends it unchanged
 * rather than reading its own projection's at the moment of the call. That is
 * what lets a session opened at one revision *conflict* against a file the window
 * has since re-read, instead of a move being resolved to positions in a parse the
 * person never saw.
 *
 * **What no type forces**, in the same sentence: that parameter is an ordinary
 * `ContentRevision`, so a caller may hand over the projection's current one
 * instead of this and get the old behaviour. What is closed is that the wrapper no
 * longer chooses for it.
 *
 * @param session - The session to ask about.
 * @returns The revision the session was opened at.
 */
export function baseRevisionOf(session: MatchMoveSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()
