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
 *
 * ## The external session — Phase 2d-6-4
 *
 * The shape `./matchEditor.ts` took at 2d-6-2 and `./matchDeletion.ts` and
 * `./matchDuplication.ts` take in the same phase, for a move.
 * {@link MatchMoveSession.externalConflict} is the conflict a watcher observation
 * raised over the file this session is about, a field beside `outcome` and never
 * an arm of it (the 2d-6 record's §3 entry 6); {@link applyMoveObservation} is the
 * session's receiver as a value, one named action per verdict arm and a `never`
 * terminus (entry 11); {@link conflictOf} answers the conflict shown whichever
 * origin it has, so {@link canChoose} refuses under both and `refusalGiven` — the
 * one rule {@link moveSubmissionRefusal} and {@link beginMove} both ask — answers
 * `externalConflict` for it and `observationRetained` for a held reading
 * ({@link MatchMoveSession.awaitingReconciliation}), so a direct call past a
 * disabled control answers `null` (entry 8), asked after the live identity has
 * been read. A conflict raised under an unknown write outcome
 * ({@link MatchMoveSession.uncertaintyUnresolved}) withholds the reload and
 * refuses the reapply until {@link acknowledgeMoveSnapshot} is told the hold
 * ended (entries 11, 22); {@link dismissMoveOutcome} erases none of the three
 * (entry 9). A replacing verdict resets the reload step and, by answering a new
 * session, invalidates a displayed reapply result (entry 12); a move has no
 * pending confirmation to withdraw, because it asks none (consult Q7), and the
 * chosen destination is retained on the conflict exactly as it is under a save
 * conflict.
 *
 * **The reapply reads both origins through one entry** — `enterReapply` in
 * `./reapply.ts` — and takes two things from an external table, each by its
 * **full** base identity through `correspondenceRowFor` and each from the row's
 * `exact` tier (entries 19, 20 and 22): the moved snippet through
 * `subjectResolution`, and, for an `after` placement only, the anchor through
 * `anchorResolution`, **from the same table**. A `top` or `end` asks the table
 * nothing about an anchor, as it asks a refused save's anchor nothing. A refused
 * table or row resolves to manual resolution with `tExternalEvidenceRefusal`'s
 * sentence, superseded evidence with `tSupersededEvidence`'s.
 *
 * **D2r and R25 are unchanged by the external origin.** The identified subject
 * must still address the sequence this session was opened in
 * (`notTheSameSequence`), the identified anchor must still be one of that
 * sequence's own snippets on the disk revision (`anchorNotInSequence`), and what
 * a reapply hands back is a session whose ordinary {@link beginMove} produces one
 * move and nothing else — the same-sequence check over a disk version is decided
 * here, in the model, and the core decides it again.
 *
 * **The door and every settling transition can read the installed session**
 * through a {@link ReadTheInstalledSession} (this phase's review): a
 * caller-controlled read — `projected`, a table row, the disk projection, an
 * observation being replayed — runs arbitrary code, and a receiver run from it
 * replaces the installed session behind the transition's back. {@link beginMove}
 * spends only against the session it was handed while that is still installed;
 * {@link reapplyToDiskVersion} rechecks the installed session's blocks and
 * conflict immediately before adopting; {@link applyMove} and
 * {@link moveCouldNotBeSent} replay what the receiver appended during their own
 * replay. The reader is required at every one of them since Phase 2d-6-6a, and its
 * doc says what no type can force about it.
 *
 * **Registered since Phase 2d-6-7a.** `MatchMover.svelte` reports a receiver that
 * installs this module's observation transition over the session it holds, and
 * `DetailPane` registers it through `BrowserState.registerObservationReceiver`
 * (`./surfaceReceivers.ts`), as 2d-6-6b did for the editor, the new-snippet form
 * and the recovery form; `MatchMover.svelte` does not yet draw the external conflict
 * or the two notices (Phase 2d-6-7b's).
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
  ReapplyRefusal,
  SaveResult
} from '../ipc/types';
import {
  amendDraft,
  isDirty,
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
  confirmationOf,
  settledAnswer,
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
import type { AcknowledgeTheUncertainty } from './matchEditor';
import type { RawSaveChoice } from './rawSave';
import type { ConflictSource, ExternalConflictObservation } from './conflictSource';
import {
  externalConflictNoticeKey,
  noticesBesideRefusal,
  type ExternalConflictNotice,
  type ObservationDelivery
} from './observationDelivery';
import {
  anchorCorrespondence,
  anchorResolution,
  correspondenceRowFor,
  enterReapply,
  externalEvidenceRefusalKey,
  sharedReapplyObstacleKey,
  subjectCorrespondence,
  subjectResolution,
  SUPERSEDED_EVIDENCE_KEY,
  type AnchorCorrespondence,
  type ExternalEvidenceRefusal,
  type ReapplyAttempt,
  type ReapplyEvidenceAccess,
  type ReapplyOutcome,
  type SharedReapplyObstacle,
  type StandingOriginGuard,
  type SubjectCorrespondence
} from './reapply';
import {
  conflictChoicesFor,
  conflictDiskText,
  describeEditSave,
  describeExternalConflict,
  externalConflictMessageKey,
  invalidationFailureMessage,
  reapplyIsOffered,
  supersedeConflict,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictMessage,
  type ConflictOperation,
  type ConflictModel,
  type ExternalConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel,
  reapplyAuthorizationFor
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
   * **Reset to `idle` by every new outcome, by every dismissal and by every
   * replacing verdict** ({@link applyMoveObservation}, the 2d-6 record's §3 entry
   * 12), which is what stops a confirmation collected for one conflict from being
   * spendable while a later one is on screen. The window refuses a spent
   * confirmation too, but this is the guard that means the situation never arises.
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
   * The conflict a watcher observation raised over the file this session is
   * about, or `null` — Phase 2d-6-4, the 2d-6 record's §3 entry 6.
   *
   * **A field of its own beside {@link MatchMoveSession.outcome}, never an arm of
   * it**, for `MatchEditorSession.externalConflict`'s reason: an outcome is how
   * *a move* ended, and a conflict the watcher raised is not that.
   * {@link conflictOf} is the one accessor that reads both and answers the
   * conflict this session is showing, whichever origin it has. **Only one conflict
   * is active at a time, and the transitions are what keep it so** (entry 7):
   * {@link applyMoveObservation} retires a save conflict's outcome when it sets
   * this, and {@link applyMove} retires this when a move ends as a conflict or a
   * success. The type admits both populated, and a session built by hand with
   * both gets {@link conflictOf}'s stated precedence, not a guarantee.
   *
   * While it is non-null the destination controls refuse and nothing can be sent
   * — `refusalGiven` answers `externalConflict` — and {@link dismissMoveOutcome}
   * does not clear it (entry 9). The ways out are the reload and the reapply. **It
   * does not spend the session**: the identities this session holds are still the
   * ones the window is projecting, exactly as they are under a save conflict, and
   * the chosen destination is retained on the conflict.
   */
  readonly externalConflict: ExternalConflictModel<MovePlacement> | null;
  /**
   * Whether {@link MatchMoveSession.externalConflict} was raised while a write of
   * this window's own had an unknown outcome, and this session has not been told
   * the hold ended — Phase 2d-6-4, entry 11's `raisedWithoutReload` row.
   *
   * While `true` the ordinary reload is withheld and the reapply refused, for the
   * match editor's reason: a confirmed installation of bytes a write of this
   * window may or may not have produced would settle, silently, a question only
   * the person can. It ends when {@link acknowledgeMoveSnapshot} is told the
   * window ended the hold, or when a later verdict replaces the conflict under no
   * uncertainty. **It records what this session was told and nothing more**: a
   * hold the window ends by a later definite write delivers nothing to a session,
   * and this flag cannot see it. This module never sets it without a conflict, so
   * the send is blocked by the conflict it qualifies.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations this session was told the window is holding and has not
   * decided about, keyed by the file each is about — Phase 2d-6-4, entry 11's
   * `retained` row, in the shape 2d-6-3's review gave the creator.
   *
   * **A restriction on sending and nothing else**: while this session's own file
   * has an entry, `refusalGiven` answers `observationRetained` and
   * {@link beginMove} answers `null` (entry 8); the destination controls stay
   * live, and no disk comparison and no origin is recorded. An entry is lifted by
   * the delivery that decides **that** observation, whatever the verdict —
   * `writtenHere` included — compared by identity, and replaced by a later
   * `retained` about the same file.
   *
   * **What the map forces and what it does not, in the same sentence.** It
   * forces that a wait is always keyed by the file it is about and that only
   * this session's file's wait blocks; through this module's own transitions it
   * holds at most that one entry, because a `retained` about another file records
   * nothing here — the map is the shape the sessions share since 2d-6-3's review,
   * so the field reads alike on every surface, not a claim that this session can
   * change its file. It cannot force that the deciding delivery arrives — a
   * session whose receiver was unregistered before the window decided is never
   * told and stays blocked until closed — nor that a wait it was *not* told of,
   * because no receiver was registered when the window held the reading, is
   * recorded at all; both are facts about registration (wired since 2d-6-7a). What
   * it cannot see is a reading the barrier coalesced away without announcing it.
   */
  readonly awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>;
  /**
   * Every delivery that arrived while this session's own move was in flight, in
   * the order it arrived, kept until that move's answer has been applied — Phase
   * 2d-6-4, the 2d-6 record's §3 entry 5.
   *
   * `MatchEditorSession.heldDeliveries`'s rule, unchanged: the window publishes a
   * write's settlement from inside the writing wrapper, before the `await` that
   * started it resumes, so {@link applyMoveObservation} appends here while the
   * phase is `saving` and {@link applyMove} and {@link moveCouldNotBeSent} replay
   * the whole list through it, first to last, after their own answer — and,
   * given a {@link ReadTheInstalledSession}, whatever the receiver appended to
   * the installed session while they were doing so. **What the list forces** is
   * that no envelope delivered during the move is dropped and that first-to-last
   * is the order; **what it does not force** is that arrival order was decision
   * order — the window's own contract — nor that the required reader is honest: this
   * module has no send composition, so the caller hands the settling transition the
   * session it holds and the reader that answers it, as `MatchMover.svelte` does, and
   * nothing in TypeScript stops a caller handing it a capture and a reader that
   * answers the capture.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
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
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    heldDeliveries: [],
    moved: false,
    invalidated: false,
    mayHaveWritten: false,
    landed: null
  };
} // End of function startMatchMove()

/**
 * The wait that restricts this session **now**, or `null` — its own file's entry
 * of {@link MatchMoveSession.awaitingReconciliation}.
 *
 * @param session - The session to ask about.
 * @returns The observation the session is waiting on, or `null`.
 */
function awaitedFor(session: MatchMoveSession): ExternalConflictObservation | null {
  return session.awaitingReconciliation.get(session.document) ?? null;
} // End of function awaitedFor()

/**
 * The waits with one file's entry replaced.
 *
 * @param waits - The waits held.
 * @param document - The file the observation is about.
 * @param observation - The observation now held for it.
 * @returns A new map; the argument is untouched.
 */
function withWait(
  waits: ReadonlyMap<DocumentId, ExternalConflictObservation>,
  document: DocumentId,
  observation: ExternalConflictObservation
): ReadonlyMap<DocumentId, ExternalConflictObservation> {
  const next = new Map(waits);
  next.set(document, observation);
  return next;
} // End of function withWait()

/**
 * The waits with one file's entry removed.
 *
 * @param waits - The waits held.
 * @param document - The file whose wait ended.
 * @returns A new map; the argument is untouched.
 */
function withoutWait(
  waits: ReadonlyMap<DocumentId, ExternalConflictObservation>,
  document: DocumentId
): ReadonlyMap<DocumentId, ExternalConflictObservation> {
  const next = new Map(waits);
  next.delete(document);
  return next;
} // End of function withoutWait()

/**
 * The conflict the session is showing, of either origin, or `null`.
 *
 * **Widened to the union at Phase 2d-6-4**, from the save arm alone. The external
 * conflict is answered first, then the outcome's conflict arm — a definite answer
 * for a session built by hand with both populated, and a decision about nothing
 * for one this module built, because {@link applyMoveObservation} and
 * {@link applyMove} keep the two exclusive (the 2d-6 record's §3 entry 7).
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchMoveSession): ConflictModel<MovePlacement> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether the destination controls accept a choice right now.
 *
 * Five reasons they may not: a move is in flight, a conflict of either origin is
 * on screen, one has already committed, a send failed in a way that may already
 * have written the file, or this session has been told that the projection its
 * anchors were minted from has been replaced.
 *
 * **This one does not take the live projections**, and that is a deliberate line
 * rather than an omission: choosing is a change to what the panel is *showing*,
 * and a destination chosen over a projection that has since been replaced is
 * refused where it would matter — at {@link moveSubmissionRefusal}, which is the
 * one place that asks the live projections, and at {@link beginMove}, which asks
 * the same question of its own argument. So a stale session can still be clicked
 * about; it cannot send anything. **A held observation is deliberately not among
 * the five either** (Phase 2d-6-4): it is a restriction on sending, and freezing
 * the destination controls for a window decision that has not been made would
 * claim more than the fact supports.
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
  /**
   * A watcher observation raised a conflict over the file, and it has not been
   * resolved — Phase 2d-6-4, the 2d-6 record's §3 entry 8.
   *
   * A code of its own rather than `conflict`, because that code's sentence says
   * the file changed *while this move was being sent*, which is false of an
   * observation no save answered. Rendered through the external origin's own
   * first line (`browser.externalConflict.fileChangedWhileOpen`), which is the
   * reason exactly and adds no key.
   */
  | 'externalConflict'
  /** A save conflict is on screen and has not been dismissed. */
  | 'conflict'
  /**
   * The window holds a reading of the file it has not decided about, and this
   * session may not send until it has — entry 8's "unresolved retained
   * delivery". Rendered through the retained notice's own sentence.
   */
  | 'observationRetained'
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
 * session is doing, then what stands over the file, then whether this session
 * still describes the file the window is showing, then whether the snippet can
 * move at all, then what the destination panel is showing.
 *
 * **The three external blocks sit where the save conflict does** (Phase 2d-6-4,
 * entry 8): the external conflict first, in {@link conflictOf}'s precedence, then
 * the save conflict, then a reading the window holds undecided — each a claim
 * about what stands over the file rather than about this session, and each
 * rendered by a sentence that already exists. An unresolved write uncertainty
 * blocks through the external conflict it qualifies, which this module never
 * sets it without. **What this forces and what it does not**: it forces refusal
 * for the session it is handed; it cannot force that session to be current
 * (R37) — one snapshot, one synchronous decision.
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
  if (session.externalConflict !== null) {
    return 'externalConflict';
  }
  if (conflictArm(session.outcome) !== null) {
    return 'conflict';
  }
  if (awaitedFor(session) !== null) {
    return 'observationRetained';
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

/**
 * Reads the session a caller currently holds — the one its registered receiver
 * has been updating — for the door or a settling transition to check against.
 *
 * `ReadTheInstalledSession` in `./matchDeletion.ts`, for this session, and for
 * the reason stated there (this phase's review, its first, second and third
 * findings, one class): a caller-controlled operand is read through property
 * access, a property read runs arbitrary code, and a receiver run from it can
 * replace the installed session with one carrying a block that a check on the
 * session handed in would never see. {@link beginMove} reads it once after the
 * last `projected` read and spends only against the session it was handed while
 * that is still the one installed; {@link reapplyToDiskVersion} rechecks it once
 * immediately before adopting, after the subject's row, the anchor's row and the
 * disk projection have all been read; {@link applyMove} and
 * {@link moveCouldNotBeSent} replay whatever the receiver appended to it during
 * their own replay; since Phase 2d-6-6b {@link reloadTheDiskVersion} reads it
 * before its adoption and once more after it. **The parameter is required since
 * Phase 2d-6-6a**, so no call
 * compiles without one, and `MatchMover.svelte` passes `() => session` at every door
 * and settling transition. **What it cannot force** is that the closure reads the
 * installed session rather than a capture: a reader answering the session handed in
 * whatever is installed gets the displaced check and the lost delivery this closes.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => MatchMoveSession;

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
 * **Every caller-controlled read comes first, and the installed session is read
 * once, last** (Phase 2d-6-4, the 2d-6 record's §3 entry 8 and R37; Phase
 * 2d-6-6a, `confirmDelete`'s shape in `./matchDeletion.ts`): `projected` is read
 * and compared, `refusalGiven` — which answers `externalConflict` and
 * `observationRetained` beside the ordinary arms — is asked, the submission is
 * taken, the placement lowered and the waiting session spread; only then is the
 * installed session read through `current`, once, and only a session that is
 * still the one installed spends. A receiver run from a getter behind
 * `projected`, behind the draft's value or behind any own property the spread
 * reads is therefore seen by the identity check rather than overwritten by the
 * spend. A call made past a disabled control answers `null` here, exactly as the
 * view withholds it. What no type forces is that the reader a caller passes is
 * honest ({@link ReadTheInstalledSession}), nor anything about a caller that
 * redefines a property of the very session it handed in: a receiver replaces a
 * session and never mutates one.
 *
 * @param session - The session showing the destination.
 * @param projected - The identity the projection this window holds **now** gives
 *   the snippet, or `null` when it holds no such snippet any more. Required, and
 *   nullable rather than defaulted: a default would be this function inventing
 *   agreement for a caller that did not look.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The waiting session and what the command takes, or `null`.
 */
export function beginMove(
  session: MatchMoveSession,
  projected: MatchId | null,
  current: ReadTheInstalledSession
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
  const started: StartedMove = {
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
  // **The installed session, read once, after the last caller-controlled read**
  // — the submission, the lowering and the spread included (Phase 2d-6-6a). A
  // receiver run from a getter above has replaced it; a session that is no
  // longer the one installed spends nothing, and nothing caller-controlled runs
  // between this read and the answer.
  return current() === session ? started : null;
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
 * **What it does about an external conflict, and about a delivery held during
 * the move** — Phase 2d-6-4, `applySave`'s rule in `./matchEditor.ts`. A `saved`
 * or a `conflict` answer retires {@link MatchMoveSession.externalConflict} (the
 * 2d-6 record's §3 entry 7: the move's own answer is the newer fact about the
 * file); a `refused` answer wrote nothing and leaves it standing. Neither is
 * reachable from {@link beginMove} while an external conflict stands, so this
 * keeps the invariant for a caller that drove the model directly. Then, whatever
 * the answer, every delivery {@link applyMoveObservation} held while the move was
 * in flight is replayed on top, in arrival order (entry 5) — **and, through the
 * reader, every delivery the receiver appended to the installed session during
 * this transition's own reads and replay** (this phase's review, its second
 * finding; `applyDeletion` in `./matchDeletion.ts` says why a replay runs caller code
 * and what a dishonest reader costs). This module composes no send, so
 * `MatchMover.svelte` settles its live `session` after its own `await` and hands the
 * reader beside it.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.moveMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look — and since a `notOwed` is
 *   now what keeps the session usable, that invention would be the defect rather
 *   than a shortcut.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session showing what the move ended as.
 */
export function applyMove(
  session: MatchMoveSession,
  result: SaveResult,
  adoption: InvalidationStatus,
  current: ReadTheInstalledSession
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
    const refused = result.outcome === 'refused';
    return consumingHeldDeliveries(
      {
        ...session,
        phase: 'editing',
        invalidated,
        outcome,
        extraMessages,
        // **A new outcome resets the reload**, so a confirmation collected for an
        // earlier conflict cannot be spent while this one is on screen.
        reload: NOT_RELOADING,
        sendFailure: null,
        externalConflict: refused ? session.externalConflict : null,
        uncertaintyUnresolved: refused ? session.uncertaintyUnresolved : false
      },
      current
    );
  }
  return consumingHeldDeliveries(
    {
      ...session,
      moved,
      invalidated,
      landed: result.moved,
      draft: savedDraft(session.draft, submission, result.revision),
      phase: 'editing',
      outcome,
      extraMessages,
      reload: NOT_RELOADING,
      sendFailure: null,
      // The move ended on the file, so the disk side an earlier observation showed
      // is no longer the comparison to draw (entry 7).
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    current
  );
} // End of function applyMove()

/**
 * Whether one held list is the other with more appended: the same envelopes, by
 * identity, in the same positions.
 *
 * A receiver appends and never reorders, so the installed session's list is the
 * handed-in list with the deliveries that arrived since; a list that is not is
 * one this transition cannot reason about and leaves alone.
 *
 * @param arrived - The installed session's list.
 * @param replayed - The list already replayed.
 * @returns `true` when `arrived` begins with every entry of `replayed`.
 */
function extendsTheReplayed(
  arrived: readonly ObservationDelivery[],
  replayed: readonly ObservationDelivery[]
): boolean {
  return replayed.every((delivery, at) => arrived[at] === delivery);
} // End of function extendsTheReplayed()

/**
 * Replays every delivery a session held during its move, in the order it
 * arrived, once the move's own answer is on it — the 2d-6 record's §3 entry 5 —
 * and then every delivery the receiver appended to the installed session while
 * that was happening (this phase's review, its second finding).
 *
 * `consumingHeldDeliveries` in `./matchDeletion.ts`, for this session, which
 * says why a replay runs caller code and what the extra round forces and cannot:
 * each envelope goes through {@link applyMoveObservation} exactly as it would
 * have on arrival, applied to the session the one before it left; after each
 * round the installed session is read once and the envelopes it holds beyond the
 * ones replayed are replayed too, in arrival order, until a read finds none; a
 * list that is not an extension of the one replayed is left alone, and a getter
 * that manufactures a fresh reading on every read does not come to rest.
 *
 * @param settled - The session with its move's answer applied and its phase
 *   back to `editing`.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session with every held delivery applied, or the same session
 *   when none was held.
 */
function consumingHeldDeliveries(
  settled: MatchMoveSession,
  current: ReadTheInstalledSession
): MatchMoveSession {
  let queue = settled.heldDeliveries;
  let replayed: MatchMoveSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyMoveObservation(replayed, queue[at]!);
    } // End of the loop over the deliveries not yet replayed
    seen = queue.length;
    const arrived = current().heldDeliveries;
    if (arrived.length <= seen || !extendsTheReplayed(arrived, queue)) {
      return replayed;
    }
    queue = arrived;
  } // End of the loop over the rounds of replay
} // End of function consumingHeldDeliveries()

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
 * The move is over, so a delivery held while it was out is applied now: the
 * settlement of an uncertain write arbitrates the held reading under that
 * uncertainty, and its `raisedWithoutReload` is what this applies (entry 5), and
 * through the reader every delivery appended to the installed session during the
 * replay is applied too, for {@link applyMove}'s reason.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param mayHaveWritten - Whether the file may already hold the moved snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session, back to its resting state, with the right notice raised.
 */
export function moveCouldNotBeSent(
  session: MatchMoveSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null,
  current: ReadTheInstalledSession
): MatchMoveSession {
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      mayHaveWritten: session.mayHaveWritten || mayHaveWritten,
      sendFailure: sendFailureOf(mayHaveWritten, reason)
    },
    current
  );
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
 * **Nor does it erase an external block** — Phase 2d-6-4, the 2d-6 record's §3
 * entry 9. {@link MatchMoveSession.externalConflict},
 * {@link MatchMoveSession.uncertaintyUnresolved} and
 * {@link MatchMoveSession.awaitingReconciliation} all survive this spread: what
 * this dismisses under an external conflict is the save outcome's panel and the
 * reload warning, and the conflict and both restrictions stand until an explicit
 * resolution — the reload's confirmation, a reapply, or closing. What the spread
 * forces is that the three fields are copied; what no type forces is that a
 * later edit keeps them out of the literal, and the suite's case is what would
 * notice.
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
 * The conflict a reload may be asked about, or `null` when none may be — Phase
 * 2d-6-4, the reload gate of the 2d-6 record's §3 entry 11 as one rule for the
 * three reload steps below.
 *
 * Withheld under an unacknowledged write uncertainty, for the match editor's
 * reason: a confirmed installation of bytes a write of this window may or may
 * not have produced would settle silently what only the person can. The view
 * withholds the control through the same fact, and the three transitions refuse
 * it, so a call made past the withheld control changes nothing (entry 8).
 *
 * @param session - The session to ask about.
 * @returns The conflict, or `null` when there is none or its reload is withheld.
 */
function reloadableConflictOf(session: MatchMoveSession): ConflictModel<MovePlacement> | null {
  return session.uncertaintyUnresolved ? null : conflictOf(session);
} // End of function reloadableConflictOf()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing, one has already been asked about, or the reload is withheld
 *   ({@link reloadableConflictOf}).
 */
export function askToReloadDiskVersion(session: MatchMoveSession): MatchMoveSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
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
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
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
 * `adopt` — a confirmation issued for another conflict, one already spent, a
 * conflict this window did not produce, an unprojected document, or a projection
 * replaced since the conflict arrived when the window does not already hold the
 * requested revision — leaves the session exactly as it was, because closing over
 * a window that did not move would report a reload that did not happen. Those are
 * `BrowserState.adoptDiskVersion`'s guards **in its order**, not a set applied
 * alike. **`alreadyThere` is not a refusal**: a window already holding the
 * requested revision is answered so, and its confirmation spent, *before* the
 * projection generation is compared at all, so the request is satisfied and this
 * session ends.
 *
 * **What no type here forces**: that `adopt`'s body does anything, and that the
 * panel reading the view's `closed` really closes.
 *
 * **The installed session is read three times: once after this function's own
 * reads and immediately before the adoption, once more after it, and once last,
 * after the answer is built** (the last since 2d-6-6b's review: the confirmation
 * is snapshot through `confirmationOf` before the first read, and every read and
 * spread of the settled session happens before `settledAnswer` in `./editorSave.ts`
 * takes the last look, so a getter or `Proxy` trap that displaces it is answered
 * with what it installed and nothing caller-controlled runs after that look) (Phase 2d-6-6b —
 * 2d-6-5's review, its third finding, carried from raw's and restore's reloads).
 * The adoption is the window's, and `BrowserState.adoptDiskVersion` copies the
 * observation's projection before it decides — a read of caller data, and a getter
 * there can tell the window of a later reading, which the window decides and hands
 * to the registered receiver while this function is still inside `adopt`. So: a
 * session displaced before the adoption is not closed and the installed session is
 * answered, the window never asked. After the adoption the installed session is
 * read again; when it now shows **another conflict** (by source identity) the
 * person must decide about that one, whether the window installed this snapshot
 * or refused it as outlived, so the installed session is answered untouched and
 * nothing is closed over it; when it shows the same conflict with more recorded —
 * a wait, most of all — the refused step and the closed session are built over
 * **it**, so a wait the receiver recorded during a refused adoption survives. What
 * that cannot force is that the required reader is honest
 * ({@link ReadTheInstalledSession}): one answering a capture closes or refuses
 * what it was handed, and a delivery the receiver made during the adoption is lost
 * when the caller installs the answer.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The closed session, the session at the terminal refused step, the same
 *   session, or the installed session when the one handed in is no longer it or
 *   another conflict landed during the adoption.
 */
export function reloadTheDiskVersion(
  session: MatchMoveSession,
  adopt: AdoptTheDiskVersion<MovePlacement>,
  current: ReadTheInstalledSession
): MatchMoveSession {
  // **Every read of this function's own, taken first.**
  const step = session.reload;
  const conflict = reloadableConflictOf(session);
  // **The confirmation this spends, snapshot before the installed-session read**
  // (2d-6-6b's review, its one blocker): the step is caller data, and asking it
  // after that read would run a getter past the last look.
  const confirmation = conflict === null ? null : confirmationOf(step);
  // **The installed session, read once, after those reads and immediately
  // before the adoption.** A session no longer installed is not closed, and
  // what is installed is answered so the caller keeps it.
  const installed = current();
  if (installed !== session) {
    return installed;
  }
  if (conflict === null || confirmation === null) {
    return session;
  }
  const spend = adopt(conflict, confirmation) === 'refused' ? 'refused' : 'satisfied';
  // **Read once more, after the adoption**, which ran the window's own reads.
  const settled = current();
  if (settled !== session && conflictOf(settled)?.source !== conflict.source) {
    // A replacing verdict landed during the adoption: the conflict the receiver
    // installed is the one to decide about now, and nothing is closed over it.
    return settledAnswer(settled, settled, current);
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the
    // 2c-4a-3a review’s finding 3: the window said no without a word about which
    // of `adoptDiskVersion`'s ordered guards produced it, so the control stops
    // being offered and the panel says so. That is a decision about what to draw
    // and **not** a claim that a later ask would be refused too — a refusal spends
    // nothing. The `keepEditing` choice writes
    // NOT_RELOADING back; it is **labelled** *Leave this as it is* on this
    // surface, because nothing here is being edited (2c-4a-3c's finding 10.2).
    // Built over the settled session, so a wait recorded during the adoption
    // is carried forward.
    return settledAnswer(settled, { ...settled, reload: RELOAD_REFUSED }, current);
  }
  // **Built first, then the final installed-session read** (2d-6-6b's review):
  // the spread reads the settled session, and nothing caller-controlled may run
  // after the look `settledAnswer` takes.
  return settledAnswer(
    settled,
    {
      ...settled,
      submitted: null,
      outcome: null,
      extraMessages: [],
      reload: NOT_RELOADING,
      sendFailure: null,
      // The conflict of either origin is resolved by the reload that ends this
      // session, and a closed session says nothing about any file any more.
      externalConflict: null,
      uncertaintyUnresolved: false,
      awaitingReconciliation: new Map(),
      closed: true
    },
    current
  );
} // End of function reloadTheDiskVersion()

/**
 * Takes the window's decision about one watcher observation — Phase 2d-6-4, the
 * 2d-6 record's §3 entries 6, 7, 11 and 12.
 *
 * **The session's receiver, as a value**, in the shape `applyObservation` in
 * `./matchEditor.ts` established: a component registers a function through
 * `BrowserState.registerObservationReceiver` that calls this with the envelope and
 * installs what comes back (wired since Phase 2d-6-7a), and the decision is here so a
 * suite can drive every arm without a window. It never re-arbitrates and reads
 * none of the window's tables.
 *
 * **Every verdict has a named action, switched with a `never` terminus** (entry
 * 11, plus the seventh arm Phase 2d-6-1b added):
 *
 * | Verdict | What this does, for a delivery about this session's file |
 * |---|---|
 * | `raised` | builds the external model from the observation and the retained placement |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its placement kept, its disk side replaced |
 * | `coalesced` | keeps the model, its source identity and the reload step |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on sending; no disk comparison, no origin |
 * | `writtenHere` | lifts the restriction recorded for that observation, and changes nothing else |
 *
 * **Which deliveries are about this session is decided by the observation's
 * file**, read once: a session is opened over one file and a delivery about
 * another can only end a wait recorded for that very observation, by identity,
 * under that file's key — it raises nothing here, because a reload of it would
 * adopt a file the person never named. A `retained` about another file records
 * nothing. The envelope's two fields and the verdict's `kind` are read once
 * each, before anything is decided.
 *
 * **Every replacing verdict resets the reload step and retires a save conflict**
 * (entries 7 and 12): the confirmation collected for the conflict that was on
 * screen must not be spendable against the one that replaced it, and a save
 * conflict's outcome is retired so that only one conflict is active — a
 * committed success or a refusal in `outcome` stays as history. A displayed
 * reapply result is invalidated by the same transition, because `reapplyToShow`
 * in `./reapply.ts` pairs a report to a session by identity and every replacing
 * arm answers a new session. A move holds no pending confirmation to withdraw,
 * and the chosen destination is retained on the conflict rather than reset: it
 * is what the person asked for, and the reapply is what decides whether the
 * disk still has a place for it. `supersedes` builds through `supersedeConflict`
 * when a conflict is shown and through `describeExternalConflict` over the
 * session's draft when none is; the `superseded` origin the verdict names is not
 * compared with the shown conflict's — the envelope is the window's decision
 * about the file, and a session that re-checked it would be arbitrating.
 *
 * **During this session's own move the envelope is appended to the held list,
 * not applied** (entry 5): see {@link MatchMoveSession.heldDeliveries}. A closed
 * session takes nothing. **A spent session takes everything**: `moved`,
 * `invalidated` and `mayHaveWritten` are facts about this session's identities,
 * not about whether the file's state may be shown, so a conflict is recorded
 * over a spent session too and the view says both.
 *
 * **What it forces and what it does not, in the same sentence.** It forces that
 * every arm of `ObservationVerdict` has an action here — an eighth arm is a
 * compile error at the terminus — and that no arm installs, adopts, spends or
 * calls a command, which its signature cannot prove and the command spy at zero
 * in `workspace.test.ts` does. It cannot force that a component registers it,
 * over which files, or installs what it answers; nor that the envelope was sealed
 * by the window rather than assembled by hand.
 *
 * @param session - The session.
 * @param delivery - What the window decided, sealed with the observation.
 * @returns The session after the decision, or the same session when the verdict
 *   changes nothing about it.
 */
export function applyMoveObservation(
  session: MatchMoveSession,
  delivery: ObservationDelivery
): MatchMoveSession {
  if (session.closed) {
    return session;
  }
  // **The caller-controlled reads, taken once and first.**
  const observation = delivery.observation;
  const kind = delivery.verdict.kind;
  const file = observation.document;
  if (session.phase === 'saving') {
    return { ...session, heldDeliveries: [...session.heldDeliveries, delivery] };
  }
  // The decision about an awaited observation ends the wait for it, whatever
  // the decision is and whichever file it is about; any other observation leaves
  // every wait standing.
  const waits = session.awaitingReconciliation;
  const stillWaiting = waits.get(file) === observation ? withoutWait(waits, file) : waits;
  const about = session.document === file;
  const lifted = stillWaiting === waits ? session : { ...session, awaitingReconciliation: stillWaiting };
  switch (kind) {
    case 'retained':
      // A `retained` ends no wait: a re-held reading is still held.
      return about ? { ...session, awaitingReconciliation: withWait(waits, file, observation) } : session;
    case 'writtenHere':
    case 'coalesced':
    case 'notLater':
      return lifted;
    case 'raised':
    case 'supersedes':
      return about ? replacedBy(session, observation, false, stillWaiting) : lifted;
    case 'raisedWithoutReload':
      return about ? replacedBy(session, observation, true, stillWaiting) : lifted;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
} // End of function applyMoveObservation()

/**
 * The session after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of {@link applyMoveObservation},
 * which documents what happens here; this is the one place the external model
 * is built for this surface from a delivery.
 *
 * @param session - The session, not closed and not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The session showing the new conflict.
 */
function replacedBy(
  session: MatchMoveSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): MatchMoveSession {
  const shown = conflictOf(session);
  const externalConflict =
    shown === null
      ? describeExternalConflict(observation, session.draft, CONFLICT_CAPABILITIES)
      : supersedeConflict(shown, observation, CONFLICT_CAPABILITIES);
  // A save conflict is retired with its submission (entry 7); a refusal or a
  // success stays, as history, with the submission a refusal's consent needs.
  const retiring = conflictArm(session.outcome) !== null;
  return {
    ...session,
    externalConflict,
    uncertaintyUnresolved,
    awaitingReconciliation,
    outcome: retiring ? null : session.outcome,
    submitted: retiring ? null : session.submitted,
    extraMessages: retiring ? [] : session.extraMessages,
    // Entry 12: the confirmation collected for the conflict that was on screen is
    // not spendable against this one, and the warning it was collected under must
    // not stay on screen saying the wrong thing (the record's §5.7).
    reload: NOT_RELOADING
  };
} // End of function replacedBy()

/**
 * Records that the person has reviewed the disk snapshot and the window has ended
 * the uncertainty hold — Phase 2d-6-4, the 2d-6 record's §3 entries 14 and 15.
 *
 * `acknowledgeSnapshot` in `./matchEditor.ts`, for this session, taking the same
 * two-valued callback: it rebuilds the conflict's availability and nothing else —
 * the ordinary reload is offered again from its idle step and the reapply is no
 * longer refused for the uncertainty — installing nothing, minting no consent and
 * re-observing nothing. Asked at most once per call and only when there is
 * something to end; a `refused` leaves the session unchanged. What it cannot see
 * is a hold the window ended without a delivery, stated on
 * {@link MatchMoveSession.uncertaintyUnresolved}.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload and reapply available again, or the same
 *   session.
 */
export function acknowledgeMoveSnapshot(
  session: MatchMoveSession,
  acknowledge: AcknowledgeTheUncertainty
): MatchMoveSession {
  const conflict = session.externalConflict;
  if (session.closed || conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeMoveSnapshot()

/**
 * Why a reapply of this move could not be carried out.
 *
 * **A code, never a sentence.** {@link moveReapplyObstacleKey} maps each arm to a
 * dictionary key and `tMoveReapplyObstacle` in `../i18n` renders it.
 *
 * **The subject's refusal and the anchor's are two arms, not one**, because the
 * wire answers them with two enums and `tReapplyResolution` and
 * `tReapplyPlacement` have two sets of sentences: *the snippet you moved* and *the
 * snippet you moved it after* are different things to have lost.
 */
export type MoveReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /** The search for the snippet this move was placed **after** refused. */
      readonly kind: 'anchorCorrespondence';
      /** The wire's own code, which `tReapplyRefusal` already has sentences for. */
      readonly reason: ReapplyRefusal;
    }
  | {
      /**
       * The evidence answers no anchor although this move names one.
       *
       * **Unreachable from the running application for the save origin**:
       * `move_match` builds an anchored placement whenever it sends an `after`,
       * so a session holding an `after` meets `Identified` or `Refused`. For the
       * external origin it is the anchor's row answering an empty `exact` tier
       * (Phase 2d-6-4) — a base snippet the table resolved to nothing to place
       * after. A `ReapplyEvidence` and a table row are boundary values and nothing
       * in TypeScript proves what produced one; treating the disagreement as a
       * refusal writes nothing.
       */
      readonly kind: 'evidenceNotAnAnchor';
    }
  | {
      /**
       * The identified snippet is not in the sequence this move was about.
       *
       * **"Same sequence" is the invariant a move keeps, and "same file" is not
       * it** (D2r). Today's projection gives a snippet file exactly one snippet
       * list, so this cannot be reached by a real file — and encoding that
       * coincidence is what would make the model silently wrong the first time a
       * projection exposes a second list. A session that never had a sequence
       * address at all lands here too; it could never have sent a move.
       */
      readonly kind: 'notTheSameSequence';
    }
  | {
      /**
       * The identified anchor is not one this rebuilt move may name.
       *
       * The new sequence does not hold it, or it is the moved snippet itself — the
       * self-anchor exclusion. Checked rather than left to
       * {@link choosePlacement}, which answers *the session unchanged* for an
       * anchor it will not install: that answer is indistinguishable from *the
       * destination did not move*, and acting on it would silently reapply the
       * snippet's **current** position as though it were the person's choice.
       */
      readonly kind: 'anchorNotInSequence';
    }
  | {
      /**
       * The conflict retained no destination the person chose — Phase 2d-6-7b's
       * review, its first finding.
       *
       * A mover opened and left alone holds the snippet's own position as its
       * draft, and an external conflict can reach it. Rebuilding that position
       * against a disk version in which the snippet has moved would set up a move
       * nobody asked for, so there is nothing to keep: the reapply is withheld
       * from the choices ({@link effectiveCapabilitiesOf}) and refused here before
       * any evidence is read. The test is the draft's own dirtiness (`isDirty` in
       * `./draft.ts`), the same fact `MatchMoveView.conflictOperation` reads.
       */
      readonly kind: 'nothingRequested';
    }
  | {
      /**
       * The rebuilt move cannot be sent, for one of the ordinary reasons.
       *
       * {@link moveSubmissionRefusal}'s own verdict over the newly parsed
       * projection — `notMovable` for a snippet the new parse will not move,
       * `outOfDate` for a destination it can no longer express. One rule, asked
       * again, rather than a second copy of it here.
       */
      readonly kind: 'moveRefused';
      /** Which of that rule's codes, for the panel to render. */
      readonly reason: MoveSubmissionRefusal;
    }
  | {
      /**
       * The external observation's correspondence could not be used to find the
       * snippet or its anchor — Phase 2d-6-4, the 2d-6 record's §3 entries 20
       * and 22.
       *
       * Five reasons, all about the evidence and never about the file: the
       * reading carried no table, the table's base or disk revision is not this
       * conflict's, or the table names a full base identity — the moved
       * snippet's, or an `after` anchor's — in no row or in more than one. Rendered
       * through `tExternalEvidenceRefusal`.
       */
      readonly kind: 'externalEvidence';
      /** Which negative claim about the evidence this is. */
      readonly reason: ExternalEvidenceRefusal;
    }
  | {
      /**
       * Another accepted reading of the file has superseded the conflict's
       * evidence, whichever origin it had (entry 22). Answered by the live
       * standing-origin guard, asked last; rendered through `tSupersededEvidence`.
       */
      readonly kind: 'supersededEvidence';
    }
  | {
      /**
       * The conflict was raised while a write of this window's own had an unknown
       * outcome, and the person has not acknowledged that (entries 11 and 22).
       * Refused before any evidence is read; rendered through the uncertainty
       * notice's own sentence.
       */
      readonly kind: 'writeOutcomeUnknown';
    }
  | {
      /**
       * The window holds a reading of this file it has not decided about (entries
       * 8 and 11). A reapply hands back a session whose ordinary send is live, and
       * one rebuilt over the adopted snapshot would carry no record of the wait;
       * so it is refused before any evidence is read. Rendered through the
       * retained notice's own sentence.
       */
      readonly kind: 'observationRetained';
    };

/** What a reapply of this move became. */
export type MatchMoveReapply = ReapplyOutcome<MatchMoveSession, MoveReapplyObstacle>;

/** One reapply attempt this panel made, tied to the session it left behind. */
export type MoveReapplyAttempt = ReapplyAttempt<MatchMoveSession, MoveReapplyObstacle>;

/**
 * The dictionary key holding one reapply obstacle's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link MoveReapplyObstacle} with no sentence is one too. The two shared
 * arms delegate to {@link sharedReapplyObstacleKey}.
 *
 * **The subject's refusal and the anchor's have two keys**, for the reason the
 * union has two arms: *the snippet you moved* and *the snippet you moved it after*
 * are different things to have lost, and one sentence for both would be untrue of
 * one of them. `anchorCorrespondence` shares its key with the creator's arm of the
 * same name, because there the sentence really is the same claim about the same
 * kind of thing.
 *
 * **The nested reasons are second lines and not part of these keys.** Both
 * `anchorCorrespondence`'s {@link ReapplyRefusal} and `moveRefused`'s
 * {@link MoveSubmissionRefusal} already have their own sentences and accessors; the
 * i18n layer composes them.
 *
 * **The four external-origin arms reuse sentences that already exist** (Phase
 * 2d-6-4), each through its own key function so a renamed key is a compile error
 * there and here at once; the terminus is `never`, so an arm with no key is one
 * too. No sentence of this module's own was added.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The key holding that obstacle's sentence.
 */
export function moveReapplyObstacleKey(obstacle: MoveReapplyObstacle): TranslationKey {
  switch (obstacle.kind) {
    case 'anchorCorrespondence':
      return 'browser.reapply.obstacle.anchorCorrespondence';
    case 'evidenceNotAnAnchor':
      return 'browser.reapply.obstacle.evidenceNotAnAnchor';
    case 'notTheSameSequence':
      return 'browser.matchMove.reapply.notTheSameSequence';
    case 'anchorNotInSequence':
      return 'browser.matchMove.reapply.anchorNotInSequence';
    case 'moveRefused':
      return 'browser.matchMove.reapply.moveRefused';
    case 'nothingRequested':
      return 'browser.matchMove.reapply.nothingRequested';
    case 'correspondence':
    case 'evidenceNotATarget':
      return sharedReapplyObstacleKey(obstacle);
    case 'externalEvidence':
      return externalEvidenceRefusalKey(obstacle.reason);
    case 'supersededEvidence':
      return SUPERSEDED_EVIDENCE_KEY;
    case 'writeOutcomeUnknown':
      return externalConflictNoticeKey({ kind: 'writeOutcomeUnknown' });
    case 'observationRetained':
      return externalConflictNoticeKey({ kind: 'observationRetained' });
    default: {
      const unreachable: never = obstacle;
      return unreachable;
    }
  }
} // End of function moveReapplyObstacleKey()

/**
 * The evidence a move's reapply reads once the supersession question has been
 * answered — every arm of `ReapplyEvidenceAccess` but `superseded`.
 *
 * Named so that {@link subjectOfEvidence} and {@link anchorOfEvidence} share one
 * narrowing rather than each repeating the exclusion.
 */
type UsableEvidence = Exclude<ReapplyEvidenceAccess, { readonly kind: 'superseded' }>;

/**
 * The guard {@link reapplyToDiskVersion} uses when its caller hands none in.
 *
 * `unaskedGuard` in `./matchEditor.ts`, for this session: it answers the shown
 * conflict's own origin, so the supersession question the entry asks last is answered
 * *yes, it stands* without the window being asked. It exists for a caller that
 * passes `null`; since Phase 2d-6-6b no component does — each hands the live
 * `BrowserState.standingConflictFor` closure down — so only a model suite reaches
 * it, and what it costs is stated on the caller.
 *
 * @param conflict - The conflict shown, or `null`.
 * @returns A guard that never asks the window.
 */
function unaskedGuard(conflict: ConflictModel<MovePlacement> | null): StandingOriginGuard {
  const source: ConflictSource | null = conflict === null ? null : conflict.source;
  return (): ConflictSource | null => source;
} // End of function unaskedGuard()

/**
 * The snippet one conflict's evidence names for this move, or why it names none
 * — the subject half of {@link reapplyToDiskVersion}'s origin switch, Phase
 * 2d-6-4.
 *
 * **Three arms in, and each has its own answer** (the 2d-6 record's §3 entry 19;
 * the fourth, `superseded`, is answered by the caller before anything is read).
 * Save evidence is read through `subjectCorrespondence`, as it always was. An
 * external table is searched through `correspondenceRowFor` for this session's
 * **full** base identity — document, base revision and node, never an array index
 * and never the node alone (entry 20) — and the found row's `exact` tier is read
 * through `subjectResolution`, exactly once: a move takes the strict tier, and
 * the flexible `editor` tier is not looked at. A refused table or row resolves to
 * manual resolution with `tExternalEvidenceRefusal`'s sentence (entry 22).
 * Nothing here is cast: a row is a row and a `ReapplyEvidence` is a
 * `ReapplyEvidence`.
 *
 * @param evidence - What `enterReapply` found the conflict's origin to offer,
 *   never `superseded`.
 * @param base - This session's snippet, by the identity the base snapshot minted.
 * @returns The subject to work from, or the manual resolution to answer with.
 */
function subjectOfEvidence(
  evidence: UsableEvidence,
  base: MatchId
): SubjectCorrespondence | Extract<MatchMoveReapply, { kind: 'manualResolution' }> {
  switch (evidence.kind) {
    case 'saveEvidence':
      return subjectCorrespondence(evidence.evidence);
    case 'externalCorrespondence': {
      const row = correspondenceRowFor(evidence.correspondences, base);
      if (row.kind === 'refused') {
        return {
          kind: 'manualResolution',
          obstacle: { kind: 'externalEvidence', reason: row.reason }
        };
      }
      // **The row's exact tier, read once.** `exact` is the one field of the row
      // this surface reads; `editor` is the match editor's flexible tier and is
      // not looked at for a move.
      return subjectResolution(row.entry.exact);
    }
    case 'refused':
      return {
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: evidence.reason }
      };
    default: {
      const unreachable: never = evidence;
      return unreachable;
    }
  }
} // End of function subjectOfEvidence()

/**
 * The anchor one conflict's evidence names for this move's `after` placement, or
 * why it names none — the anchor half of {@link reapplyToDiskVersion}'s origin
 * switch, Phase 2d-6-4.
 *
 * **Three arms in, and each has its own answer** (the 2d-6 record's §3 entry 19;
 * `superseded` is answered by the caller before any placement is read). Save
 * evidence is read through `anchorCorrespondence`, as it always was. An external
 * table is searched through `correspondenceRowFor` for the anchor's **full** base
 * identity — the identity this session holds for it, minted from the parse the
 * placement was chosen against — and the found row's `exact` tier is read through
 * `anchorResolution` (entry 20: "an anchored … move by the anchor's `exact` from
 * the same table"), exactly once. A refused table or row resolves to manual
 * resolution with `tExternalEvidenceRefusal`'s sentence (entry 22). The subject
 * and the anchor are two rows of **one** validated table: `reapplyEvidenceFor`
 * checked its two revisions once, and both lookups read the object it answered.
 *
 * @param evidence - What `enterReapply` found the conflict's origin to offer,
 *   never `superseded`.
 * @param anchor - The snippet the move places the moved one after, by the
 *   identity the base parse minted.
 * @returns The anchor answer to work from, or the manual resolution to answer
 *   with.
 */
function anchorOfEvidence(
  evidence: UsableEvidence,
  anchor: MatchId
): AnchorCorrespondence | { readonly obstacle: MoveReapplyObstacle } {
  switch (evidence.kind) {
    case 'saveEvidence':
      return anchorCorrespondence(evidence.evidence);
    case 'externalCorrespondence': {
      const row = correspondenceRowFor(evidence.correspondences, anchor);
      if (row.kind === 'refused') {
        return { obstacle: { kind: 'externalEvidence', reason: row.reason } };
      }
      // **The row's exact tier, read once**, for the same reason the subject's is.
      return anchorResolution(row.entry.exact);
    }
    case 'refused':
      return { obstacle: { kind: 'externalEvidence', reason: evidence.reason } };
    default: {
      const unreachable: never = evidence;
      return unreachable;
    }
  }
} // End of function anchorOfEvidence()

/**
 * Reissues this move against the newly parsed disk version.
 *
 * **The consult's Q4 for a move, and every clause of it is a decision.**
 *
 * - **The moved snippet is resolved strictly.** `move_match` asks for `ExactItem`,
 *   so an identified subject is a snippet whose own owned lines are byte-for-byte
 *   what this session was about. A unique trigger is not enough to move somebody
 *   else's snippet. **The external origin takes the same tier**, off the table's
 *   row for this session's full base identity (the 2d-6 record's §3 entry 20),
 *   read through {@link subjectOfEvidence}.
 * - **Its `SequenceAddress` must equal the original one** — the same *sequence*,
 *   not merely the same file (D2r), decided over the disk projection the conflict
 *   carries, for either origin.
 * - **The destination is rebuilt from the new sequence, and the old numeric index
 *   is never carried.** `startMatchMove` derives the members and the anchors from
 *   the adopted projection; nothing here reads a position from the old one.
 * - **`top` and `end` survive because they are semantic and are lowered afresh.**
 *   The evidence's anchor is read **only** for an `after`: an `end` was lowered to
 *   *after the last other snippet* before it was sent, so its wire anchor is a
 *   snippet the person never named, and refusing the move because that snippet's
 *   bytes changed would refuse a request that has nothing to do with it. For the
 *   external origin the same rule means the table is asked nothing about an
 *   anchor.
 * - **An `after` survives only on exact anchor correspondence**, which is the one
 *   thing `ReapplyEvidence`'s second operand exists to answer — and, for the
 *   external origin, the anchor's own row of the same table, through
 *   {@link anchorOfEvidence}. The identified anchor must still be one of the
 *   rebuilt sequence's own on the disk revision (`anchorNotInSequence`), which is
 *   the same-sequence rule asked of the anchor.
 * - **A disk that already places the snippet where it was asked to go is
 *   `alreadySatisfied`**, and nothing is written. That verdict is
 *   {@link moveSubmissionRefusal}'s own `alreadyThere`, asked of the rebuilt
 *   session, so *already there* means the same thing here as it does beside the
 *   control.
 *
 * **R25 stays visible in what this hands back**: a rebuilt session whose ordinary
 * {@link beginMove} produces one move and nothing else. Nothing here batches, and
 * nothing here writes.
 *
 * **Both origins since Phase 2d-6-4, through one entry** (entries 19, 20 and 22):
 * `enterReapply` in `./reapply.ts` answers `reapplyEvidenceFor`'s four arms;
 * superseded evidence refuses whatever the placement, before the subject or the
 * anchor is read. **Two refusals come before the entry, so a blocked session
 * reads no evidence at all** (this phase's review, its fourth finding — the entry
 * reads the observation's table): an unacknowledged write uncertainty (entry 22 —
 * a reapply ends in an adoption, which the uncertainty withholds, so adoption may
 * not be obtained here indirectly) and a reading the window holds undecided
 * (entry 8 — a session rebuilt over the adopted snapshot would carry no record of
 * the wait, and the blocked send would go through it). The view withholds the
 * control through the same facts; these are the rules for a call made past it.
 *
 * **The two blocks and the conflict's identity are asked again of the installed
 * session, once, immediately before the adoption** (this phase's review, its
 * third finding): every read between the entry and the door — the subject's row,
 * the anchor's row, the disk projection `startMatchMove` walks, the rebuilt
 * session's own submission rule over that projection — is a read of caller data,
 * and a getter there can tell the window of a reading, whose receiver records a
 * wait, an uncertainty or a new conflict on the installed session. The session
 * handed in cannot see that; the one `current` reads can. So the adoption is
 * refused `observationRetained` or `writeOutcomeUnknown` when the installed
 * session now carries either, and `supersededEvidence` when the conflict it
 * shows is no longer the one being reapplied; otherwise the rebuilt session
 * carries the installed session's waits forward (the **settled** one's since 2d-6-7a, below), for `rebuiltOver`'s reason
 * in `./matchEditor.ts` — its own file's entry is absent, because the recheck
 * comes first, and the map is carried so a wait about another file survives the
 * rebuild. The reader is required (Phase 2d-6-6a); one answering a capture asks the
 * recheck of that capture ({@link ReadTheInstalledSession}).
 *
 * **Since Phase 2d-6-7a the looks bracket every caller-controlled read**
 * (2d-6-6b's review, its one blocker, which that phase's §7 item 2 left
 * unaudited here): the three facts are read off the installed session, the
 * authorization is minted, and one last look follows them — a session displaced
 * while they were read is answered `supersededEvidence` and the window is not
 * asked. **And once more after the adoption**, which reads the observation's
 * projection: a session that now shows another conflict is not rebuilt over
 * (`supersededEvidence`), the rebuilt session carries the **settled** session's
 * waits — so a wait recorded during the adoption keeps its ordinary send
 * refused — and the answer is built before a last look, so a session displaced
 * while the settled one was read is answered `supersededEvidence`. What no type
 * forces is that the reader is honest.
 *
 * **The standing-origin guard is a parameter, and `null` is accepted for one stated
 * reason** — `reapplyToDiskVersion` in `./matchEditor.ts`'s: `MatchMover.svelte` has handed the live
 * `BrowserState.standingConflictFor` closure down since Phase 2d-6-6b and passes
 * no `null`, and the parameter stays nullable; the parameter is nullable rather than defaulted since Phase 2d-6-6a, so
 * that the required reader can follow it. When no guard
 * is handed in the supersession question is not asked here; what still refuses a
 * superseded origin on that path is `adoptDiskVersion`'s fourth check, at the
 * door, answered `adoptionRefused` without the typed sentence. An omitted guard
 * costs a sentence and some work, never a wrong installation.
 *
 * @param session - The session showing the conflict.
 * @param unsavedDraftFor - The snippet this window is holding unsaved edits for,
 *   **by the identity the newly parsed projection gives it**, or `null`. Required
 *   for {@link moveEligibility}'s reason. An editor opened over the *replaced*
 *   parse carries an older revision and will not match — the limitation
 *   {@link moveEligibility} already states, unchanged by a reapply.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never at
 *   all on a refusal.
 * @param standing - Asks what origin stands for the file **now**;
 *   `() => browser.standingConflictFor(document)` is the honest closure. `null`
 *   asks nothing — see above for what that costs.
 * @param current - Reads the session the caller holds now, for the recheck before the
 *   adoption — `() => session` over the caller's state. Required.
 * @returns What became of the attempt.
 */
export function reapplyToDiskVersion(
  session: MatchMoveSession,
  unsavedDraftFor: MatchId | null,
  adopt: AdoptTheDiskVersion<MovePlacement>,
  standing: StandingOriginGuard | null,
  current: ReadTheInstalledSession
): MatchMoveReapply {
  const conflict = conflictOf(session);
  if (conflict !== null) {
    // **Before the entry, which reads the evidence.** A blocked session reads
    // none of it.
    if (session.uncertaintyUnresolved) {
      return { kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } };
    }
    if (awaitedFor(session) !== null) {
      return { kind: 'manualResolution', obstacle: { kind: 'observationRetained' } };
    }
    // Nothing chosen, nothing to keep (the 2d-6-7b review's first finding): the
    // retained draft is where the snippet already was, and rebuilding it would
    // manufacture a destination.
    if (!isDirty(conflict.draft)) {
      return { kind: 'manualResolution', obstacle: { kind: 'nothingRequested' } };
    }
  }
  const entry = enterReapply(CONFLICT_CAPABILITIES, conflict, standing ?? unaskedGuard(conflict));
  if (entry.kind !== 'ready') {
    return entry;
  }
  const evidence = entry.evidence;
  if (evidence.kind === 'superseded') {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  const subject = subjectOfEvidence(evidence, session.match);
  if (subject.kind === 'manualResolution') {
    return subject;
  }
  if (subject.kind === 'refused') {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'correspondence', reason: subject.reason }
    };
  }
  if (subject.kind === 'noSubject') {
    return { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } };
  }
  const held = session.sequence;
  const found = sequenceOf(subject.target);
  if (held === null || found === null || !sameSequence(held, found)) {
    return { kind: 'manualResolution', obstacle: { kind: 'notTheSameSequence' } };
  }
  const fresh = startMatchMove(entry.conflict.disk, subject.target, unsavedDraftFor);
  const wanted = rebuiltPlacement(session.draft.value, evidence, fresh);
  if ('obstacle' in wanted) {
    return { kind: 'manualResolution', obstacle: wanted.obstacle };
  }
  const chosen = choosePlacement(fresh, wanted.placement);
  const refusal = moveSubmissionRefusal(chosen, [entry.conflict.disk]);
  if (refusal !== null && refusal !== 'alreadyThere') {
    return { kind: 'manualResolution', obstacle: { kind: 'moveRefused', reason: refusal } };
  }
  // **The installed session, read after the last caller-controlled read of the
  // reapply's own**; its three facts below are read off it, and a last look
  // follows them, before the door (Phase 2d-6-7a — 2d-6-6b's review, its one
  // blocker, carried here by that phase's §7 item 2).
  const installed = current();
  if (installed.uncertaintyUnresolved) {
    return { kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } };
  }
  if (awaitedFor(installed) !== null) {
    return { kind: 'manualResolution', obstacle: { kind: 'observationRetained' } };
  }
  if (conflictOf(installed)?.source !== entry.conflict.source) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  // **Everything the spend needs, taken now, then one last look**: the three
  // reads above are of the installed session, which is caller data, and a getter
  // or `Proxy` trap among them can displace it. The authorization reads the
  // conflict's origin, so it is minted before the look too; after it nothing
  // caller-controlled runs before the door.
  const adopted = entry.conflict;
  const authorization = reapplyAuthorizationFor(adopted);
  if (current() !== installed) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  if (adopt(adopted, authorization) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  // **Read again after the adoption**, which read caller data of its own: a
  // session that now shows another conflict is not rebuilt over, and the same
  // conflict with a wait recorded during the adoption hands the rebuilt session
  // that wait, so its ordinary send stays refused.
  const settled = current();
  if (conflictOf(settled)?.source !== entry.conflict.source) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  const waiting = settled.awaitingReconciliation;
  const rebuilt: MatchMoveSession = { ...chosen, awaitingReconciliation: waiting };
  const result: MatchMoveReapply =
    refusal === 'alreadyThere'
      ? { kind: 'alreadySatisfied', session: rebuilt }
      : { kind: 'reapplied', session: rebuilt };
  // **Built first, then one last look at the installed session**: every read of
  // the settled session above is caller data, and a session displaced during
  // them is not rebuilt over; nothing caller-controlled runs after the look.
  if (current() !== settled) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  return result;
} // End of function reapplyToDiskVersion()

/**
 * The destination a reapply asks for, rebuilt against the new sequence.
 *
 * `top` and `end` are handed back untouched, because they are semantic choices the
 * rebuilt session lowers against its own members — **and they ask the evidence
 * nothing**, which is why the evidence is read only for an `after`. An `after` is
 * replaced by the anchor the evidence identified — never by the old one, whose
 * revision belongs to a parse that is gone — and the replacement is checked
 * against the rebuilt session's own anchors, because {@link choosePlacement}
 * answers *unchanged* for an anchor it will not install and that answer would
 * otherwise be read as *the destination did not move*.
 *
 * **Both origins since Phase 2d-6-4**, through {@link anchorOfEvidence}: a
 * refused save's anchor is read as before; an external table is searched for the
 * anchor's **full** base identity and the row's `exact` tier read as the anchor;
 * a refused table or row refuses the `after` it was asked about.
 *
 * @param placement - What the retained draft asked for.
 * @param evidence - Which evidence the conflict's origin offers, never
 *   `superseded`.
 * @param rebuilt - The session over the newly parsed projection, for its anchors.
 * @returns The placement to choose, or the obstacle that stops the reapply.
 */
function rebuiltPlacement(
  placement: MovePlacement,
  evidence: UsableEvidence,
  rebuilt: MatchMoveSession
): { readonly placement: MovePlacement } | { readonly obstacle: MoveReapplyObstacle } {
  if (placement.kind !== 'after') {
    return { placement };
  }
  const anchor = anchorOfEvidence(evidence, placement.anchor);
  if ('obstacle' in anchor) {
    return anchor;
  }
  if (anchor.kind === 'refused') {
    return { obstacle: { kind: 'anchorCorrespondence', reason: anchor.reason } };
  }
  if (anchor.kind === 'notAnchored') {
    return { obstacle: { kind: 'evidenceNotAnAnchor' } };
  }
  const identity = anchor.target.id;
  return rebuilt.anchors.some((one) => sameIdentity(one, identity))
    ? { placement: { kind: 'after', anchor: identity } }
    : { obstacle: { kind: 'anchorNotInSequence' } };
} // End of function rebuiltPlacement()

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
 * A confirmed reload — install the disk projection and **close** the mover — is
 * **offered as of 2c-4a-3b**: {@link askToReloadDiskVersion},
 * {@link confirmDiskReload} and {@link reloadTheDiskVersion} are the transition,
 * `MatchMover.svelte`'s `conflictAction` calls them, and its panel now draws the
 * two labels `conflictChoicesFor` names. Flipping the boolean was the whole of
 * that step's capability change here, because the machinery it turns on was built
 * and driven by this module's tests at 2c-4a-2.
 *
 * **`offersReapply` is the same trade one sub-phase later, and it is `true` as of
 * 2c-4b-3.** {@link reapplyToDiskVersion} was built and driven by this module's
 * tests at 2c-4b-2 with nothing naming it; flipping this boolean beside the
 * permanent `reapplySupport` is what makes `conflictChoicesFor` name `keepMyDraft`,
 * and `MatchMover.svelte`'s `conflictAction` is what calls the transition. **This is
 * the one surface whose reapply can end without anything left to send**: a disk
 * that already places the snippet where it was asked to go is `alreadySatisfied`,
 * which is {@link moveSubmissionRefusal}'s own `alreadyThere` asked of the rebuilt
 * session, and nothing is written.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'operationChoice',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: false,
  offersReload: true,
  offersReapply: true,
  reapplySupport: 'supported'
};

/**
 * What this surface offers about the conflict it is showing **now**, derived from
 * the declaration and three facts about the session — Phase 2d-6-4, the 2d-6
 * record's §3 entry 11, and the third since Phase 2d-6-7b's review.
 *
 * The declaration above is permanent; this is the "effective capabilities" the
 * consult's Q3 names. The reload and the reapply are both withheld under an
 * unacknowledged write uncertainty, for the match editor's reason. The reapply
 * alone is withheld while the window holds an undecided reading, because it
 * hands back a session whose ordinary send is live; the reload is not, because
 * it closes the session and sends nothing. The reapply alone is also withheld
 * when the conflict's retained draft is not dirty — a destination nobody chose —
 * because rebuilding it would manufacture a move ({@link reapplyToDiskVersion}
 * refuses it `nothingRequested`). It feeds `conflictChoicesFor`, which
 * stays the only producer of a choice list; what this cannot force is that the
 * transitions honour the same facts, which is why each asks
 * {@link reloadableConflictOf} or the fields themselves.
 *
 * @param session - The session to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: MatchMoveSession): ConflictCapabilities {
  const reloadWithheld = session.uncertaintyUnresolved;
  // The reapply is also withheld for a conflict whose retained draft asked for
  // nothing — a mover left at the snippet's own position (Phase 2d-6-7b's review,
  // its first finding); `reapplyToDiskVersion` refuses it `nothingRequested`.
  const conflict = conflictOf(session);
  const nothingRequested = conflict !== null && !isDirty(conflict.draft);
  const reapplyWithheld = reloadWithheld || awaitedFor(session) !== null || nothingRequested;
  if (!reloadWithheld && !reapplyWithheld) {
    return CONFLICT_CAPABILITIES;
  }
  return {
    ...CONFLICT_CAPABILITIES,
    offersReload: !reloadWithheld,
    offersReapply: !reapplyWithheld
  };
} // End of function effectiveCapabilitiesOf()

/**
 * The notices one session owes, in the order the stronger claim comes first.
 *
 * The uncertainty first, because it is the one state under which the conflict on
 * screen offers neither way to the disk version, and the held observation second.
 * Each is answered from one session field and nothing is read twice.
 *
 * @param session - The session to describe.
 * @returns The codes, possibly none.
 */
function externalNoticesOf(session: MatchMoveSession): readonly ExternalConflictNotice[] {
  const notices: ExternalConflictNotice[] = [];
  if (session.externalConflict !== null && session.uncertaintyUnresolved) {
    notices.push({ kind: 'writeOutcomeUnknown' });
  }
  if (awaitedFor(session) !== null) {
    notices.push({ kind: 'observationRetained' });
  }
  return notices;
} // End of function externalNoticesOf()

/**
 * What one retained placement asked for, as a summary code.
 *
 * **Read off the placement the *conflict* retained, never off the session's
 * current draft.** They are equal today — {@link canChoose} refuses while a
 * conflict is on screen — but that is a fact about today's transitions and not
 * about this summary, which describes the operation that was refused.
 *
 * **The `after` arm is chosen from what the panel is drawing now**, which is the
 * 2c-4a-3b review's finding 2. Its sentence sends the reader to the destination
 * the list above still marks; {@link movePlacementOptionsOf} stops offering an
 * anchor whose parse this window has replaced, so a reprojection arriving while
 * the conflict is displayed took that mark away and left the sentence pointing at
 * nothing. Asking the option list itself — rather than re-deriving the same
 * condition here — is what makes the two agree by construction.
 *
 * @param session - The session the conflict belongs to, for the option list.
 * @param placement - The placement the conflict is carrying.
 * @param views - Every projection this window holds **now**, the same list the
 *   panel's destinations are built from. Nothing here can check that it is.
 * @returns The summary to show beside the disk text.
 */
function operationOf(
  session: MatchMoveSession,
  placement: MovePlacement,
  views: readonly DocumentView[]
): ConflictOperation {
  switch (placement.kind) {
    case 'top':
      return 'moveToTop';
    case 'end':
      return 'moveToEnd';
    case 'after':
      return markedAmongTheDestinations(session, placement, views)
        ? 'moveAfterSnippet'
        : 'moveAfterSnippetNoLongerShown';
  }
} // End of function operationOf()

/**
 * Whether the destination list a screen is drawing marks this placement.
 *
 * **Both halves are asked of {@link movePlacementOptionsOf}'s own answer**, and
 * deliberately: the sentence this decides claims that a particular row of that
 * list carries the chosen mark, so anything short of reading the rows is a second
 * opinion about what the screen shows. An anchor the current projections cannot
 * resolve is not among them at all, and `chosen` is the very flag the panel draws
 * the mark from.
 *
 * @param session - The session whose options the panel draws.
 * @param placement - The placement the conflict retained.
 * @param views - Every projection this window holds now.
 * @returns Whether a drawn destination carries that placement and is marked.
 */
function markedAmongTheDestinations(
  session: MatchMoveSession,
  placement: MovePlacement,
  views: readonly DocumentView[]
): boolean {
  return movePlacementOptionsOf(session, views).some(
    (option) => option.chosen && samePlacement(option.placement, placement)
  );
} // End of function markedAmongTheDestinations()

/**
 * What a confirmed reload takes with it that only this surface can say.
 *
 * **Two arms rather than one sentence, and the 2c-4a-3b review's finding 1 is
 * why.** The single line this replaces said the destination *names snippets of the
 * version this window read* — true of an `after` and false of `top` and `end`,
 * which name a position and no snippet at all. A claim that holds for one arm of
 * {@link MovePlacement} may not be shown for the other two.
 *
 * **Neither arm restates the close/abandon guarantee.** That is
 * `saveOutcome.ts`'s `reloadWarningFor`, drawn once at the top of the same panel;
 * saying it here too is the duplication the same review's finding 3 named.
 */
export type MoveReloadWarning =
  /** The retained destination is a position: the mover's `top` or `end`. */
  | 'positionalDestination'
  /** The retained destination names another snippet: the mover's `after`. */
  | 'anchoredDestination';

/**
 * Which warning one retained placement earns.
 *
 * @param placement - The placement the conflict is carrying.
 * @returns The arm to show at the confirmation step.
 */
function reloadWarningOf(placement: MovePlacement): MoveReloadWarning {
  return placement.kind === 'after' ? 'anchoredDestination' : 'positionalDestination';
} // End of function reloadWarningOf()

/**
 * The dictionary key holding one reload warning's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this module: a renamed key is a compile error here, and a new
 * member of {@link MoveReloadWarning} with no sentence is one too.
 *
 * @param warning - What the confirmation step has to say about the destination.
 * @returns The key holding that warning's sentence.
 */
export function moveReloadWarningKey(warning: MoveReloadWarning): TranslationKey {
  switch (warning) {
    case 'positionalDestination':
      return 'browser.matchMove.reloadDropsPositionalDestination';
    case 'anchoredDestination':
      return 'browser.matchMove.reloadDropsAnchoredDestination';
  }
} // End of function moveReloadWarningKey()

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
   * The frozen refusal a screen may draw beside the snippet, as a code, or `null`.
   *
   * **Presentation-ready, which is what makes it different from the session's
   * `eligibility`.** That verdict is computed once at {@link startMatchMove} and no
   * transition recomputes it, so after a reprojection it is a definite claim about
   * a snippet read off a parse this window has replaced;
   * {@link MatchMoveView.cannotMove} is the live refusal, and `refusalGiven` ranks
   * `outOfDate` **above** `notMovable` precisely so that the weaker live claim
   * wins. This field carries that same precedence into what is drawn: it is the
   * frozen reason **only when `cannotMove` is `notMovable`** — only when the frozen
   * verdict is what won — and `null` otherwise.
   *
   * **So a component renders this and asks nothing else**, which is 2c-3c-3's
   * Medium applied here at 2c-4a-3b. Until then this field handed out the frozen
   * reason unconditionally and a condition in `MatchMover.svelte` was the only
   * thing keeping the suppressed certainty off the screen — a decision in markup,
   * which no model test can drive and a second renderer could omit while walking
   * this view faithfully. A caller that wants the raw frozen verdict rather than
   * the sentence reads {@link MatchMoveSession.eligibility}, which is unchanged.
   */
  readonly notMovableToShow: MoveRefusal | null;
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
   * The external conflict's own lines, or none — Phase 2d-6-4.
   *
   * Beside {@link MatchMoveView.messages} and never merged into it, for
   * `MatchEditorView.externalMessages`'s reason: a panel drawing `view.conflict`
   * outside the save-outcome branch (the 2d-6 record's §3 entry 10) draws nothing
   * twice. Rendered through `tConflictMessage`; `MatchMover.svelte` draws it
   * since Phase 2d-6-7b.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * The lines owed while an observation cannot be acted on — Phase 2d-6-4.
   *
   * `writeOutcomeUnknown` first, `observationRetained` second, from the session's
   * own fields. Since Phase 2d-6-9b-2 no renderer draws them as sentences: the pane's
   * `FileReconciliationStatus.svelte` block says both states once, above the panel,
   * and `MatchMover.svelte` reads this list only through `surfaceAcknowledgementOwed` in
   * `./reconciliationStatus.ts`, to decide whether to draw the acknowledgement.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
  /**
   * {@link MatchMoveView.externalNotices} less the one
   * {@link MatchMoveView.cannotMove} already says — Phase 2d-6-7b.
   *
   * `observationRetained` is rendered through the retained notice's own sentence
   * ({@link moveSubmissionRefusalKey}), so a panel drawing the refusal and every
   * notice would print it twice. `noticesBesideRefusal` in
   * `./observationDelivery.ts` is the rule.
   * **No renderer reads it since Phase 2d-6-9b-2**, when the panels stopped drawing
   * their notices; it is kept as a tested value and its removal is an open item of
   * that phase's record.
   */
  readonly noticesBesideRefusal: readonly ExternalConflictNotice[];
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
  /** The conflict being shown, of either origin, or `null`. */
  readonly conflict: ConflictModel<MovePlacement> | null;
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /**
   * Whether the reload's warning is showing and the destructive choice is one
   * click away — the boolean the other five surfaces carry.
   *
   * **A field of its own since Phase 2d-6-7b**, beside
   * {@link MatchMoveView.reloadWarning} rather than read off it: that field is
   * `null` at this step for a conflict whose retained destination was never
   * chosen, so it no longer says whether the step has been reached.
   */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * What the confirmation step warns about the chosen destination, or `null`.
   *
   * Non-`null` only at the warning step ({@link MatchMoveView.awaitingReloadConfirmation})
   * **and** only when the conflict retained a destination the person chose — a
   * retained draft that differs from where the snippet already was. An external
   * conflict can reach a mover whose person chose nothing (Phase 2d-6-7b): its
   * draft is the snippet's own position, and both arms of
   * {@link MoveReloadWarning} begin *the destination you chose*, which would be
   * false. The shared close/abandon line in the conflict's own messages still
   * says what the reload does.
   *
   * The arm is {@link MoveReloadWarning}, and the 2c-4a-3b review's finding 1 is
   * why there is an arm at all.
   */
  readonly reloadWarning: MoveReloadWarning | null;
  /**
   * Whether a confirmed reload was spent and the window refused it.
   *
   * **The disclosure the panel owes for a control that has just gone.** The
   * reload is not offered again once a spend has been refused — the refusal came
   * back with no word about its cause, so this panel withholds the control rather
   * than claiming a later ask could only be refused too — and a control that
   * vanishes with nothing said in its place reads as a bug (2c-4a-3a review,
   * finding 3). Nothing was written
   * and nothing was discarded; the `keepEditing` choice resets the step.
   */
  readonly reloadUnavailable: boolean;
  /**
   * Whether the reapply control is among {@link MatchMoveView.conflictChoices}.
   *
   * **Read from the produced list and never from the capability record**, through
   * `reapplyIsOffered`: the readiness sentence and the control it stands beside must
   * come from one authority, and a view that asked the declaration instead would be
   * expressing capability twice — the split that once let a button compile and do
   * nothing.
   */
  readonly reapplyOffered: boolean;
  /**
   * The disk side of that conflict, or `null` when none is showing.
   *
   * A union rather than a string, so *a file of zero characters is a fact about
   * the file rather than a failure to obtain it* is decided in this directory
   * once instead of in each renderer’s markup (2c-4a-3a review, finding 5).
   */
  readonly diskText: ConflictDiskText | null;
  /**
   * What the retained draft **asked for**, or `null` when no conflict is showing.
   *
   * **The `operationChoice` side of the comparison the consult's Q5 ruled**
   * (2c-4a-3b). A `MovePlacement` is a positional choice and not authored text, so
   * what goes beside the disk text is a description of the operation — decided
   * here rather than assembled in markup, because a description written into one
   * renderer is carried by that renderer's mounted suite alone (2c-3c-3's Medium).
   *
   * **It names the shape of the destination and not the anchor.** An `after`
   * placement carries a revision-scoped `MatchId`, and the panel's own destination
   * list — drawn from the projection this session opened over — is what marks
   * which one was chosen. Naming a snippet of the *disk* side would be the
   * cross-revision identification 2c-4b owns.
   *
   * **Which of the two `after` arms it is depends on the live projections**, which
   * is why this view takes them: the sentence that points at the marked
   * destination may be shown only while a marked destination is there. See
   * {@link operationOf}.
   *
   * **`null` for a conflict whose retained draft is not dirty** (Phase 2d-6-7b):
   * every arm begins *you asked to move this snippet*, and a draft still at the
   * snippet's own position asked for nothing. A save conflict never has one — a
   * send needs a destination that moves the snippet — but an external conflict
   * reaches a mover the person opened and left alone. What this reads is the
   * draft's own dirtiness (`isDirty` in `./draft.ts`), so a destination chosen and
   * then chosen back to the origin is the same fact.
   */
  readonly conflictOperation: ConflictOperation | null;
  /**
   * Whether a confirmed reload has ended this session.
   *
   * The panel that reads this calls its own `close`: a match-level reload adopts
   * the disk projection and closes, because there is no disk-side draft to seed.
   */
  readonly closed: boolean;
}

/**
 * The frozen refusal a screen may draw beside the snippet, or `null`.
 *
 * **The precedence rule, expressed once and where a test can drive it**, and
 * written against `'notMovable'` rather than against `outOfDate` alone so that a
 * refusal added above it in `refusalGiven`'s order suppresses the frozen detail by
 * construction instead of by a later edit here. `matchDuplication.ts` reached this
 * shape at 2c-3c-3 and this is the same rule for the same reason.
 *
 * A refused eligibility always makes `refusalGiven` answer something, so a `null`
 * live refusal never coexists with a frozen reason.
 *
 * @param session - The session the frozen verdict belongs to.
 * @param cannotMove - The live refusal, as `refusalGiven` answered it for this
 *   same read of the projections.
 * @returns The frozen reason to draw, or `null` when a weaker live claim won.
 */
function notMovableToShow(
  session: MatchMoveSession,
  cannotMove: MoveSubmissionRefusal | null
): MoveRefusal | null {
  if (cannotMove !== 'notMovable' || session.eligibility.kind !== 'refused') {
    return null;
  }
  return session.eligibility.reason;
} // End of function notMovableToShow()

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
 *   it is that list, or that it is current. Since 2c-4a-3b's fix round the conflict
 *   summary is derived from it too, so a caller that passed a stale list here and a
 *   fresh one to the options would get a sentence about a screen it is not drawing.
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
  const conflictChoices =
    conflict === null
      ? []
      : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload));
  const cannotMove = moveSubmissionRefusal(session, views);
  // What the conflict's retained draft asked for, or `null` when it asked for
  // nothing — a draft still at the snippet's own position (Phase 2d-6-7b).
  const asked = conflict !== null && isDirty(conflict.draft) ? conflict.draft.value : null;
  const warning = conflict !== null && atTheReloadWarning(session.reload);
  const notices = externalNoticesOf(session);
  const externallyBlocked = session.externalConflict !== null || awaitedFor(session) !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
  return {
    match: session.match,
    document: session.document,
    placement: session.draft.value,
    canMove: cannotMove === null,
    notMovableToShow: notMovableToShow(session, cannotMove),
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
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: notices,
    noticesBesideRefusal: noticesBesideRefusal(
      notices,
      cannotMove === 'observationRetained' ? 'observationRetained' : null
    ),
    notes: saved === null ? [] : saved.notes,
    // The one offer a refusal panel may keep under an external block is the
    // dismissal: `beginMove` would answer `null` to the other, and a control that
    // does nothing when pressed is the defect `conflictChoicesFor` exists to stop.
    refusalChoices: externallyBlocked
      ? refusalChoices.filter((choice) => choice === 'keepEditing')
      : refusalChoices,
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices,
    awaitingReloadConfirmation: warning,
    reloadWarning: warning && asked !== null ? reloadWarningOf(asked) : null,
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    reapplyOffered: reapplyIsOffered(conflictChoices),
    diskText: conflictDiskText(conflict),
    conflictOperation: asked === null ? null : operationOf(session, asked, views),
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
 * **The two external blocks reuse sentences that already exist** (Phase 2d-6-4):
 * the external origin's own first line for `externalConflict`, and the retained
 * notice's for `observationRetained`, each through its own key function so a
 * renamed key is a compile error there and here at once. No sentence of this
 * module's own was added for either.
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
    case 'externalConflict':
      return externalConflictMessageKey({ kind: 'fileChangedWhileOpen' });
    case 'conflict':
      return 'browser.matchMove.cannotMove.conflict';
    case 'observationRetained':
      return externalConflictNoticeKey({ kind: 'observationRetained' });
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
