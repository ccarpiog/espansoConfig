/**
 * Deleting one snippet: a two-phase transition, in a value a test can drive.
 *
 * **No component and no screen.** The design consult's Q2
 * (`docs/reviews/phase-2c-3a-design.md`) asked for exactly this, and the reason
 * is not tidiness: the save protocol's acknowledgement round trip only engages
 * when the transaction produces **findings**, so a clean deletion of an ordinary
 * snippet produces none and the protocol offers no consent step at all. Without
 * the two phases below, one click writes the user's file with no in-app undo —
 * restore-from-backup is Phase 2c-5 and does not exist.
 *
 * A dialog in a `.svelte` file would put that rule where nothing in this
 * repository can test it, which is the placement this project has rejected since
 * `docs/decisions/1c-1-notes.md` hole 1.
 *
 * ## The three transitions, and what makes them a protocol
 *
 * {@link requestDelete} asks, {@link cancelDelete} takes the question back, and
 * {@link confirmDelete} is the **only** thing that produces a
 * {@link StartedDeletion} — which is what a caller needs before it can reach
 * `BrowserState.deleteMatch` with anything to send. A caller holding no pending
 * request gets `null`.
 *
 * The pending consent is bound to the **exact** {@link MatchId}, all three fields
 * including the revision, and is issued by nothing but {@link requestDelete}
 * (`PENDING` is a `unique symbol` this module never exports, so no literal outside
 * it can have the type). That is `draft.ts`'s `DraftConsent` shape applied to a
 * different question.
 *
 * ## Why a confirmation names the identity the window is projecting **now**
 *
 * The first review round's fifth finding, and it is worth stating as the mistake
 * it corrects. This module used to compare the pending identity against the
 * session's own — two values minted together, both frozen at
 * {@link startMatchDeletion} — and its header claimed that a reload could
 * therefore not carry a stale confirmation. It could: a session is a value, a
 * caller may keep holding one while the workspace re-reads the file underneath,
 * and the two stale halves went on agreeing with each other. Nothing in the
 * comparison observed the world.
 *
 * So {@link confirmDelete} takes a second argument: the identity **the current
 * projection gives that snippet**, or `null` when the projection no longer holds
 * it. It must agree with the pending consent, with the session's own identity and
 * with the draft's candidate — four values, one comparison — and a re-projection
 * moves the first of them, so the confirmation is refused and has to be asked
 * again.
 *
 * **What no type here forces**, in the same sentence as what one does: `MatchId`
 * carries no brand and nothing checks where the argument came from, so a caller
 * that passes `session.match` back defeats this entirely, and nothing stops a
 * component importing `deleteMatch` from `../ipc/commands` and calling it with no
 * confirmation at all — the hole `saveMatch`, `moveMatch` and `saveRawDocument`
 * have had since 2b-2a. What is closed is that *this module* produces nothing to
 * send without a confirmation bound to the snippet being deleted, and that a
 * caller which reads the live projection — the only source of that argument a
 * screen has — cannot spend consent across a reprojection.
 *
 * ## The draft holds an identity, and nothing is drafted
 *
 * `Draft<MatchId>` looks odd until the question it answers is named. The
 * acknowledgement round trip is defined over a draft: `acknowledgeRefusal` checks
 * that the submission carries **this** draft's base revision and that the value
 * the draft holds is still the candidate that was sent, and derives the
 * acknowledgement from the refusal itself. A deletion has exactly one candidate —
 * *this snippet, at this revision* — so that is what the draft holds, and it never
 * changes: nothing is typed, the history stays empty and `isDirty` is always
 * `false`.
 *
 * So the draft here is the **carrier** for the base revision, the candidate and
 * the consent, which is the triple the protocol is defined over. Reusing it is
 * what keeps `editorSave.ts`'s consent rule the only one in this application; a
 * second, deletion-shaped acknowledgement path would be a second place for it to
 * be relaxed (D7).
 *
 * ## The last snippet of a file
 *
 * The consult's Q6. The core refuses to empty a file's snippet list — that would
 * mean either writing an empty list or leaving the list line with nothing under
 * it, and both are different files from the one the person has — and it answers
 * `saveFailed` carrying the engine's own reason.
 *
 * {@link deletionEligibility} says so **first**, from the projection, so nobody is
 * walked through a confirmation for an operation already known to fail. That is an
 * **affordance derived from current state, never authorization**: if the
 * projection and the file disagree, the command refuses and that refusal is what
 * reaches the screen. Drift can therefore only produce a surfaced refusal, never
 * an invalid write.
 *
 * ## What a committed deletion leaves behind
 *
 * `moved` is `null` permanently — the snippet that was deleted has no identity in
 * the new revision, and filling that field with a neighbour's would put a position
 * back into the one field that exists to replace positions with identities. Every
 * `MatchId` held for that file is stale afterwards, this session's included, so a
 * commit **spends** the session: {@link MatchDeletionSession.deleted} is set and
 * nothing here clears it. What the *window* does about its selection is
 * `BrowserState.deleteMatch`'s, and it is documented there.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentView,
  MatchId,
  MatchView,
  PresentationNote,
  SaveResult
} from '../ipc/types';
import {
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
import type { RawSaveChoice } from './rawSave';
import {
  adoptForReapply,
  beginReapply,
  sharedReapplyObstacleKey,
  subjectCorrespondence,
  type ReapplyAttempt,
  type ReapplyOutcome,
  type SharedReapplyObstacle
} from './reapply';
import {
  conflictChoicesFor,
  conflictDiskText,
  describeEditSave,
  invalidationFailureMessage,
  reapplyIsOffered,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictOperation,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';

/**
 * How this session compares and snapshots the identity it is about.
 *
 * `structuredDraftRules` because a {@link MatchId} has fields: deep equality is
 * what makes "still the same candidate" mean *the same three values* rather than
 * *the same object*, and the frozen deep copy is what stops a caller mutating the
 * identity the consent was bound to.
 */
const IDENTITY_RULES: DraftValueRules<MatchId> = structuredDraftRules<MatchId>();

/**
 * Whether two match identities name the same snippet of the same parse.
 *
 * All three fields, because all three are the identity: the revision is part of
 * it precisely so that a confirmation crossing a reparse is refused rather than
 * spent on whatever now occupies that arena slot.
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
 * Why this application will not delete one snippet.
 *
 * **A code, never a sentence** (CLAUDE.md section 2). `deletionRefusalKey` maps it
 * to a dictionary key and `tDeletionRefusal` in `../i18n` renders it; a component
 * never builds the key.
 */
export type DeletionRefusal =
  /** The projection says this application must refuse to write the file. */
  | 'readOnly'
  /** It is the only snippet the file's list holds, and the list may not be emptied. */
  | 'lastSnippet'
  /** The snippet and the file handed in are not a pair this projection describes. */
  | 'notInDocument';

/**
 * Whether one snippet may be deleted, and why not when it may not.
 *
 * A discriminated union rather than a boolean with a nullable reason, so a
 * refused verdict with no reason is not representable.
 */
export type DeletionEligibility =
  | {
      /** The snippet may be deleted. */
      readonly kind: 'deletable';
    }
  | {
      /** It may not, and the reason is shown. */
      readonly kind: 'refused';
      /** Why, as a code. */
      readonly reason: DeletionRefusal;
    };

/** The one deletable verdict, shared rather than rebuilt per snippet. */
const DELETABLE: DeletionEligibility = Object.freeze({ kind: 'deletable' as const });

/**
 * Whether one snippet of one projected file may be deleted.
 *
 * **The two arguments are checked against each other**, which is 2c-2-2's High
 * finding one level up: a snippet and its file are one fact, and a caller passing
 * a second value straight from the live selection type-checks perfectly and can
 * be wrong. `notInDocument` is that check — the identity must name this file, this
 * revision, and a snippet this projection actually holds.
 *
 * The last-snippet arm is the consult's Q6, and it is an affordance rather than
 * authorization: see this module's header.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @param match - The snippet's projection, from that same file.
 * @returns The verdict, with a reason code when it is a refusal.
 */
export function deletionEligibility(
  document: DocumentView,
  match: MatchView
): DeletionEligibility {
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
  if (document.matches.length <= 1) {
    return { kind: 'refused', reason: 'lastSnippet' };
  }
  return DELETABLE;
} // End of function deletionEligibility()

/**
 * The identity the projections handed in give the snippet at one arena node.
 *
 * **This exists to be {@link confirmDelete}'s second argument**, and it is the
 * one place in this application that reads it. The module header says a caller
 * that hands `session.match` straight back defeats the whole confirmation and
 * that no type can say where an argument came from; this function is what a
 * caller uses *instead*, so that "read it from the live projection" is a call
 * somebody can search for rather than an instruction in a comment.
 *
 * **It is not a way to follow a snippet across a reparse, and it must not be
 * used as one.** It looks the arena node up in whatever projection this window
 * now holds for the file and answers **that projection's** identity, revision
 * included. When the file has been re-read the revision differs, the four-way
 * comparison in {@link confirmDelete} fails, and the confirmation has to be
 * asked again — which is exactly the behaviour the first review round's fifth
 * finding asked for. A revision is a content hash, so an answer whose revision
 * matches the session's is an answer from the same bytes.
 *
 * @param views - Every projection this window holds **now**, in any order.
 * @param match - The identity the session is about.
 * @returns The identity the current projection gives that node, or `null` when
 *   this window holds no projection of the file or the file no longer holds the
 *   node.
 */
export function identityInProjection(
  views: readonly DocumentView[],
  match: MatchId
): MatchId | null {
  const view = views.find((one) => one.id === match.document);
  if (view === undefined) {
    return null;
  }
  return view.matches.find((one) => one.id.node === match.node)?.id ?? null;
} // End of function identityInProjection()

/**
 * The brand that makes a pending deletion unforgeable.
 *
 * Declared and never exported, so no object outside this module can have the
 * property and no type outside it can name the key: a caller cannot write a
 * {@link PendingDeletion} literal, and {@link requestDelete} is the only thing
 * that produces one. The same mechanism `draft.ts` uses for consent.
 */
declare const PENDING: unique symbol;

/**
 * A deletion the person has been asked about and has not yet confirmed.
 *
 * It carries the identity it was issued for, and {@link confirmDelete} compares
 * all three fields of that identity against the session's own **and against the
 * identity the current projection gives the snippet** before it will produce
 * anything to send. The last of those is the only one of the three that can
 * disagree, and why is this module's header.
 */
export interface PendingDeletion {
  /** The brand. Never present at runtime, never nameable outside this module. */
  readonly [PENDING]: typeof PENDING;
  /** The snippet the person was asked about. */
  readonly match: MatchId;
}

/**
 * One deletion, as a value.
 *
 * **A value with pure transitions, never a store**: a component holds one in a
 * `$state.raw` and reassigns it, and every function below returns a new session
 * without touching its argument.
 */
export interface MatchDeletionSession {
  /** The snippet this is about, by the identity this window holds. */
  readonly match: MatchId;
  /** The file it lives in. */
  readonly document: DocumentId;
  /** Whether it may be deleted at all, and why not when it may not. */
  readonly eligibility: DeletionEligibility;
  /**
   * The base revision, the candidate and the consent, as one value.
   *
   * Never edited. See this module's header for why a deletion holds a draft at
   * all.
   */
  readonly draft: Draft<MatchId>;
  /** The question that has been asked and not answered, or `null`. */
  readonly pending: PendingDeletion | null;
  /** Whether a deletion is in flight. */
  readonly phase: EditorPhase;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<MatchId> | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<MatchId> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed deletion whose adoption failed. The
   * bytes are gone from the file (`PROGRESS.md` D2) and what failed is this
   * window's attempt to bring itself back into step.
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
   * Whether a deletion has committed through this session.
   *
   * Set by a committed save and cleared by **nothing**. Every `MatchId` held for
   * that file is stale afterwards, this session's own included, so the session
   * stops offering to delete and only a fresh projection can produce one that
   * does.
   */
  readonly deleted: boolean;
}

/**
 * The three fields of one identity, in an object nothing else can reach.
 *
 * **A plain copy, and it is load-bearing rather than tidy.** {@link IDENTITY_RULES}
 * snapshots through `structuredClone`, which **throws** on a reactive proxy — and
 * the identity a screen hands in comes out of `BrowserState.views`, which is
 * `$state` and therefore deeply proxied. The mounted test of 2c-3a-2 is what found
 * that: every model test passes a plain fixture, so the whole of
 * `matchDeletion.test.ts` was green over a call that threw the moment a real
 * window made it.
 *
 * It also makes the session's own identity independent of a projection that may be
 * replaced under it, which is what the rest of this module assumes when it compares
 * four values across a reprojection.
 *
 * **Exported at 2c-3b-1, and shared rather than copied.** `./matchMove.ts` needs
 * the same copy for the same reason — its drafted placement carries a `MatchId`
 * through the same `structuredClone` — and the argument above is a *rule* about
 * what a reactive projection does to a snapshot, so a second copy of it is a second
 * place for it to be got wrong by somebody who only read one of them. That is the
 * argument that produced `./typing.ts` and `./editorSave.ts`. The right home for it
 * and for {@link identityInProjection} is a module that is about identities rather
 * than about deletion; `docs/decisions/2c-3b-1-notes.md` records that as a hole
 * rather than moving them while nothing but this file and one sibling need them.
 *
 * @param id - The identity to copy.
 * @returns The same three values, in a fresh plain object.
 */
export function plainIdentity(id: MatchId): MatchId {
  return { document: id.document, revision: id.revision, node: id.node };
} // End of function plainIdentity()

/**
 * Opens a deletion over one snippet of one file.
 *
 * The base revision is the **document's**, not the identity's, and the two agree
 * whenever the pair is one this projection describes — which is exactly what
 * {@link deletionEligibility}'s `notInDocument` arm checks, so a mismatch is a
 * refusal rather than a silently wrong base.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @param match - The snippet's projection, from that same file.
 * @returns A session with nothing pending and nothing said.
 */
export function startMatchDeletion(
  document: DocumentView,
  match: MatchView
): MatchDeletionSession {
  const identity = plainIdentity(match.id);
  return {
    match: identity,
    document: document.id,
    eligibility: deletionEligibility(document, match),
    draft: startDraft(document.revision, identity, IDENTITY_RULES),
    pending: null,
    phase: 'editing',
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    reload: NOT_RELOADING,
    closed: false,
    deleted: false
  };
} // End of function startMatchDeletion()

/**
 * The conflict the session is showing, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchDeletionSession): ConflictModel<MatchId> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether this session may be asked to delete right now.
 *
 * Four reasons it may not: the snippet is not deletable, a deletion is already in
 * flight, a conflict is on screen, or one has already committed.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link requestDelete} would do anything.
 */
export function canRequestDelete(session: MatchDeletionSession): boolean {
  return (
    !session.closed &&
    session.eligibility.kind === 'deletable' &&
    session.phase === 'editing' &&
    !session.deleted &&
    conflictOf(session) === null
  );
} // End of function canRequestDelete()

/**
 * Asks the person to confirm deleting this snippet.
 *
 * The first of the two phases. It records **which** snippet was asked about, so
 * the answer cannot be spent on another one.
 *
 * @param session - The session.
 * @returns The session with the question pending, or the same session when it may
 *   not be asked or one is already pending.
 */
export function requestDelete(session: MatchDeletionSession): MatchDeletionSession {
  if (!canRequestDelete(session) || session.pending !== null) {
    return session;
  }
  // The cast is the brand: `PendingDeletion` declares a property on a symbol this
  // module does not export, so no literal outside it can have the type and this is
  // the only place one is built.
  const pending = { match: session.match } as unknown as PendingDeletion;
  return { ...session, pending, sendFailure: null };
} // End of function requestDelete()

/**
 * Takes the question back.
 *
 * @param session - The session.
 * @returns The session with nothing pending, or the same session when nothing
 *   was.
 */
export function cancelDelete(session: MatchDeletionSession): MatchDeletionSession {
  return session.pending === null ? session : { ...session, pending: null };
} // End of function cancelDelete()

/** A deletion about to be sent: the session that is waiting, and what to send. */
export interface StartedDeletion {
  /** The session, now in flight, with the submission recorded on it. */
  readonly session: MatchDeletionSession;
  /**
   * What was sent, for the acknowledgement round trip.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only
   * place the two are put together.
   */
  readonly submission: DraftSubmission<MatchId>;
  /** The snippet to delete, by identity. */
  readonly match: MatchId;
}

/**
 * Confirms the deletion and produces what the command takes.
 *
 * **The only thing in this module that produces a {@link StartedDeletion}**, and
 * it refuses every way of arriving here without an answered question: no pending
 * request, a pending request issued for a different identity, an identity the
 * current projection no longer gives that snippet, a snippet that is not
 * deletable, a deletion already in flight, a conflict on screen, or a deletion
 * that has already committed.
 *
 * **Four values are compared, not two**, which is the first review round's fifth
 * finding: the pending consent, the session's own identity, the draft's candidate
 * and `projected`. The first three were minted together and therefore agree with
 * each other however stale they all are; `projected` is the only one that comes
 * from outside this value, so it is the only one that can notice a reprojection.
 * See this module's header for what that closes and what it cannot.
 *
 * **What the type does not force**, in the same sentence: `StartedDeletion` is a
 * structural interface with no brand, so a caller can write one by hand — as it
 * can call `deleteMatch` in `../ipc/commands` with no session at all — and
 * `projected` is an ordinary `MatchId`, so a caller that hands back
 * `session.match` rather than reading the live projection gets the old behaviour
 * and no warning. What is closed is that no transition here yields something to
 * send without a confirmation bound to this exact identity, and that a caller
 * reading the projection cannot spend one across a reparse.
 *
 * The pending request is **consumed**. Consent is for one attempt: a refusal that
 * comes back with findings is acknowledged and then confirmed again, which is the
 * same shape the acknowledgement round trip has everywhere else in this
 * application.
 *
 * @param session - The session holding the person's answer.
 * @param projected - The identity the projection this window holds **now** gives
 *   the snippet, or `null` when it holds no such snippet any more. Required, and
 *   nullable rather than defaulted: a default would be this function inventing
 *   agreement for a caller that did not look.
 * @returns The waiting session and what to send, or `null`.
 */
export function confirmDelete(
  session: MatchDeletionSession,
  projected: MatchId | null
): StartedDeletion | null {
  const pending = session.pending;
  if (pending === null || !canRequestDelete(session)) {
    return null;
  }
  if (projected === null || !sameIdentity(pending.match, session.match)) {
    return null;
  }
  if (!sameIdentity(projected, session.match) || !sameIdentity(projected, session.draft.value)) {
    return null;
  }
  const submission = submissionOf(session.draft);
  return {
    session: {
      ...session,
      phase: 'saving',
      pending: null,
      submitted: submission,
      sendFailure: null
    },
    submission,
    match: session.match
  };
} // End of function confirmDelete()

/**
 * Takes a deletion's answer.
 *
 * **Not sealed, and that is not an omission**, but the reason differs from a
 * field save's: a whole-document replacement is sealed because a caller must be
 * made to discharge an invalidation it has no identity for, and a deletion has no
 * identity to answer with *either*. What makes the seal unnecessary here is that
 * `BrowserState.deleteMatch` performs the whole invalidation — the re-read and the
 * selection repair — before this can be called, and answers what became of it.
 *
 * On a `saved` arm the draft's base moves to the revision the transaction ended
 * on, through `savedDraft`, which spends the consent. A **committed** deletion
 * additionally spends the session: `deleted` is set, and nothing here clears it.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.** The
 * snippet really is gone from the file; telling the person the deletion failed
 * would invite a retry of a write that already happened (`PROGRESS.md` D2).
 *
 * @param session - The session waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.deleteMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @returns The session showing what the deletion ended as.
 */
export function applyDeletion(
  session: MatchDeletionSession,
  result: SaveResult,
  adoption: InvalidationStatus
): MatchDeletionSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft, CONFLICT_CAPABILITIES);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  if (result.outcome !== 'saved') {
    return {
      ...session,
      phase: 'editing',
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
    deleted: result.committed,
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    outcome,
    extraMessages,
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function applyDeletion()

/**
 * Records that the deletion produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are "no" and "this application cannot
 * tell".
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already have lost the snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @returns The session, back to its resting state, with the right notice raised.
 */
export function deletionCouldNotBeSent(
  session: MatchDeletionSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null
): MatchDeletionSession {
  return {
    ...session,
    phase: 'editing',
    sendFailure: sendFailureOf(mayHaveWritten, reason)
  };
} // End of function deletionCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the session rather than from an argument, so a caller cannot pair one
 * candidate's acknowledgement with another candidate.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeDeletionFindings(
  session: MatchDeletionSession
): MatchDeletionSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeDeletionFindings()

/**
 * Puts the outcome away.
 *
 * The draft is untouched — this is a panel being dismissed, not a state being
 * resolved — and the submission goes with it, because there is nothing left on
 * screen to acknowledge. It does **not** give a committed session back: `deleted`
 * survives this, so nobody can dismiss their way into deleting a snippet that is
 * already gone.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last attempt.
 */
export function dismissDeletionOutcome(session: MatchDeletionSession): MatchDeletionSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function dismissDeletionOutcome()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing or one has already been asked about.
 */
export function askToReloadDiskVersion(session: MatchDeletionSession): MatchDeletionSession {
  const next = reloadAsked(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReloadDiskVersion()

/**
 * Confirms abandoning this deletion for the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmDiskReload(session: MatchDeletionSession): MatchDeletionSession {
  const next = reloadConfirmed(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmDiskReload()

/**
 * Adopts the disk version into the window and ends this session.
 *
 * **The match-level reload the consult's Q3 ruled, and it is not a reseed.** There
 * is no disk-side `MatchId` to load: an identity is minted from one parse, and finding "the same" snippet in another is cross-revision identity work — 2c-4b, and forbidden here. So the window crosses to the disk
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
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @returns The closed session, or the same session.
 */
export function reloadTheDiskVersion(
  session: MatchDeletionSession,
  adopt: AdoptTheDiskVersion<MatchId>
): MatchDeletionSession {
  const spend = spendTheConfirmedReload(conflictOf(session), session.reload, adopt);
  if (spend === 'notAttempted') {
    return session;
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
 * Why a reapply of this deletion could not be carried out.
 *
 * **A code, never a sentence.** There is no key function for these yet, and that is
 * 2c-4b-2's boundary: nothing draws them, so 2c-4b-3 adds the accessors together
 * with the panel that renders them.
 */
export type DeletionReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /** The identified snippet is one this application will not delete. */
      readonly kind: 'notDeletable';
      /** Which refusal the newly parsed projection gives, as a code. */
      readonly reason: DeletionRefusal;
    };

/** What a reapply of this deletion became. */
export type MatchDeletionReapply = ReapplyOutcome<MatchDeletionSession, DeletionReapplyObstacle>;

/** One reapply attempt this panel made, tied to the session it left behind. */
export type DeletionReapplyAttempt = ReapplyAttempt<
  MatchDeletionSession,
  DeletionReapplyObstacle
>;

/**
 * The dictionary key holding one reapply obstacle's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link DeletionReapplyObstacle} with no sentence is one too. The two
 * shared arms delegate to {@link sharedReapplyObstacleKey}, so *espansoConfig could
 * not establish correspondence* is one sentence across the five surfaces rather
 * than five that have to be kept in step.
 *
 * **The nested reason is a second line and not part of this key.**
 * `notDeletable` carries a {@link DeletionRefusal}, which already has its own
 * sentences and its own accessor; the i18n layer composes the two.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The key holding that obstacle's sentence.
 */
export function deletionReapplyObstacleKey(obstacle: DeletionReapplyObstacle): TranslationKey {
  switch (obstacle.kind) {
    case 'notDeletable':
      return 'browser.matchDeletion.reapply.notDeletable';
    case 'correspondence':
    case 'evidenceNotATarget':
      return sharedReapplyObstacleKey(obstacle);
  }
} // End of function deletionReapplyObstacleKey()

/**
 * Reissues this deletion against the newly parsed disk version.
 *
 * **Strict exact correspondence and nothing weaker**, which is the consult's Q4:
 * *a unique trigger is not enough to delete a snippet whose contents changed after
 * the person reviewed it*. The tier is 2c-4b-1's and is chosen by the command that
 * built the question — `delete_match` asks for `ExactItem` — so an identified
 * subject here is a snippet whose own owned lines are byte-for-byte what this
 * session was about.
 *
 * **The confirmation is asked again, and against the live projection.** The session
 * handed back has **nothing pending**: the person presses *Delete* again, and
 * {@link confirmDelete} then compares its own pending identity, the session's, the
 * draft's candidate and — the only one that comes from outside — the identity
 * {@link identityInProjection} reads from the projection this window now holds.
 * Comparing two values minted together proves nothing (`CLAUDE.md` section 6), and
 * carrying a pending confirmation across a reparse would be exactly that.
 *
 * **Eligibility is rechecked over the new projection**, including the refusal to
 * empty the sequence: a file that has lost its other snippets since this session
 * opened refuses `lastSnippet` here rather than at the command.
 *
 * **There is no `alreadySatisfied` arm and there cannot be one.** *The snippet is
 * already deleted* is not something this transition can observe: a snippet that is
 * gone has no exact correspondence, so it arrives as a refusal about evidence and
 * never as a satisfied request. Saying otherwise would claim the file was examined
 * and the snippet found absent, which is a stronger claim than the evidence carries.
 *
 * @param session - The session showing the conflict.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never at
 *   all on a refusal.
 * @returns What became of the attempt.
 */
export function reapplyToDiskVersion(
  session: MatchDeletionSession,
  adopt: AdoptTheDiskVersion<MatchId>
): MatchDeletionReapply {
  const start = beginReapply(CONFLICT_CAPABILITIES, conflictOf(session));
  if (start.kind !== 'ready') {
    return start;
  }
  const subject = subjectCorrespondence(start.evidence);
  if (subject.kind === 'refused') {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'correspondence', reason: subject.reason }
    };
  }
  if (subject.kind === 'noSubject') {
    return { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } };
  }
  const rebuilt = startMatchDeletion(start.conflict.disk, subject.target);
  if (rebuilt.eligibility.kind !== 'deletable') {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'notDeletable', reason: rebuilt.eligibility.reason }
    };
  }
  if (adoptForReapply(start.conflict, adopt) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  return { kind: 'reapplied', session: rebuilt };
} // End of function reapplyToDiskVersion()

/**
 * What this surface offers about a conflict.
 *
 * **`operationChoice` is permanent here, and it is the consult's Q4 ruling rather
 * than a limitation of this sub-phase.** The drafted value is a `MatchId`: an
 * opaque, revision-scoped protocol carrier, not user content. Copying its JSON
 * would expose an implementation token while preserving nothing, so *Copy draft*
 * is not merely unwired for this surface — it can never be offered, and
 * `conflictChoicesFor` refuses it even if `offersCopyDraft` were set.
 *
 * A confirmed reload — install the disk projection and **close** the deleter — is
 * **offered as of 2c-4a-3b**: {@link askToReloadDiskVersion},
 * {@link confirmDiskReload} and {@link reloadTheDiskVersion} are the transition,
 * `MatchDeleter.svelte`'s `conflictAction` calls them, and its panel now draws the
 * two labels `conflictChoicesFor` names. Flipping the boolean was the whole of
 * that step's model change here, because the machinery it turns on was built and
 * driven by this module's tests at 2c-4a-2 — which is the trade that split paid
 * for.
 *
 * **`offersReapply` is the same trade one sub-phase later, and it is `true` as of
 * 2c-4b-3.** {@link reapplyToDiskVersion} was built and driven by this module's
 * tests at 2c-4b-2 with nothing naming it; flipping this boolean beside the
 * permanent `reapplySupport` is what makes `conflictChoicesFor` name `keepMyDraft`,
 * and `MatchDeleter.svelte`'s `conflictAction` is what calls the transition. **A
 * reapply here re-asks this surface's own confirmation** — the rebuilt session has
 * nothing pending, so the person presses *Delete* again and `confirmDelete` compares
 * against the identity the live projection then gives that snippet. That is
 * confirmation of the deletion and not of the label.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'operationChoice',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: false,
  offersReload: true,
  offersReapply: true,
  reapplySupport: 'supported'
};

/** Everything a screen needs about one deletion, derived on every read. */
export interface MatchDeletionView {
  /** The snippet this is about. */
  readonly match: MatchId;
  /** Whether the delete control does anything. */
  readonly canDelete: boolean;
  /** Why it does not, as a code, or `null`. */
  readonly refusal: DeletionRefusal | null;
  /** Whether the person has been asked and has not answered. */
  readonly confirming: boolean;
  /** Whether a deletion is in flight. */
  readonly deleting: boolean;
  /** Whether one has committed, so this session is spent. */
  readonly deleted: boolean;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /** The reasons to show beside that failure, outermost first. */
  readonly failureLines: readonly SendFailureLine[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<MatchId> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /**
   * The presentation changes a saved arm disclosed, in report order.
   *
   * **A deletion is the one command that produces
   * `PresentationNote::DoubledSequenceSeparation`**, so this list is the reason
   * `SavedModel.notes` exists as far as this sub-phase is concerned: the blank
   * line a removed snippet leaves behind is a change to how the file is written,
   * and plan section 6.2 is *never silently normalise*.
   */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal, withdrawn once its findings are stale. */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a candidate that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<MatchId> | null;
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
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
   * Whether the reapply control is among {@link MatchDeletionView.conflictChoices}.
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
   * (2c-4a-3b). The two authored-text surfaces put `RetainedDraftField`s beside
   * the disk text; there is nothing here a person typed, so what goes there is a
   * description of the operation — decided in this module rather than assembled in
   * markup, because a description written into one renderer is carried by that
   * renderer's mounted suite alone (2c-3c-3's Medium).
   *
   * Constant while a conflict is showing, because a deletion drafts one thing.
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
 * Everything a screen needs about one deletion.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up.
 *
 * @param session - The session to describe.
 * @returns The view.
 */
export function matchDeletionView(session: MatchDeletionSession): MatchDeletionView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale = submissionIsStale(session.draft, session.submitted);
  const conflict = conflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  const conflictChoices =
    conflict === null
      ? []
      : conflictChoicesFor(CONFLICT_CAPABILITIES, offeredReloadStep(session.reload));
  return {
    match: session.match,
    canDelete: canRequestDelete(session),
    refusal: session.eligibility.kind === 'refused' ? session.eligibility.reason : null,
    confirming: session.pending !== null,
    deleting: session.phase === 'saving',
    deleted: session.deleted,
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices,
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    reapplyOffered: reapplyIsOffered(conflictChoices),
    diskText: conflictDiskText(conflict),
    conflictOperation: conflict === null ? null : 'deleteSnippet',
    closed: session.closed
  };
} // End of function matchDeletionView()

/**
 * The dictionary key holding one deletion refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link DeletionRefusal} with no sentence is one too.
 *
 * @param reason - Why the snippet may not be deleted.
 * @returns The key holding that reason's sentence.
 */
export function deletionRefusalKey(reason: DeletionRefusal): TranslationKey {
  switch (reason) {
    case 'readOnly':
      return 'browser.matchDeletion.refused.readOnly';
    case 'lastSnippet':
      return 'browser.matchDeletion.refused.lastSnippet';
    case 'notInDocument':
      return 'browser.matchDeletion.refused.notInDocument';
  }
} // End of function deletionRefusalKey()

/**
 * The acknowledgement one submission carries, for a caller that only needs that.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands consent to the boundary is a place this module can be searched
 * for.
 *
 * @param submission - What {@link confirmDelete} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(submission: DraftSubmission<MatchId>): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

/**
 * The base revision this session would delete against.
 *
 * A named read rather than a property walk at the call site, and **since the first
 * review round's second finding nothing downstream substitutes another**:
 * `BrowserState.deleteMatch` takes a base revision and forwards it unchanged
 * rather than reading its own projection's at the moment of the call. That is what
 * lets a session opened at one revision *conflict* against a file the window has
 * since re-read, instead of a deletion being resolved to a position in a parse the
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
export function baseRevisionOf(session: MatchDeletionSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()
