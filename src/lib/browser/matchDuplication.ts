/**
 * Duplicating one snippet in place: the whole operation as a value.
 *
 * **No component and no screen.** This is step 2 of 2c-3c, and it is the same
 * arrangement `./matchMove.ts`, `./matchCreation.ts` and `./matchDeletion.ts`
 * are in: every decision a duplicate makes lives here, where a test can drive
 * it, and step 3's component is a rule-free walk over
 * {@link MatchDuplicationView}. The standing reason is
 * `docs/decisions/1c-1-notes.md` hole 1 — nothing in this repository renders a
 * Svelte component in an automated test unless the file opts into jsdom, so a
 * decision written in markup is a decision nothing can check.
 *
 * The authority for what follows is `docs/reviews/phase-2c-3c-design.md`, its
 * Q6 and Q8 above all. Where this module and that consult disagree, the consult
 * is right and this is a bug.
 *
 * ## There is nothing to draft, and the draft still carries the protocol
 *
 * A duplicate has exactly one candidate — *this snippet, at this revision,
 * copied in place* — so its stable candidate is `Draft<MatchId>`, exactly as a
 * deletion's is (`./matchDeletion.ts`'s header says why a session with nothing
 * typed holds a draft at all): the draft is the **carrier** for the base
 * revision, the submitted candidate and the refusal consent, which is the
 * triple the acknowledgement round trip is defined over. Reusing it keeps
 * `editorSave.ts`'s consent rule the only one in this application, and the
 * consent matters more here than for any sibling — the duplicate's ordinary
 * path is refuse-then-acknowledge, because a byte-exact copy keeps its
 * source's trigger definition and the transaction says so with
 * `DuplicateKeepsTriggerDefinition` on the first attempt.
 *
 * ## There is no placement, and its absence is a decision
 *
 * The clone lands immediately after its source, in the same sequence, with no
 * destination panel and no anchor that can go stale (consult Q4). What the
 * panel says instead is one static sentence,
 * `browser.matchDuplication.landsAfterSource`, and nothing in this session
 * holds a position a person chose. That is also why there is no
 * `alreadyThere` refusal arm: a duplicate always changes the document.
 *
 * ## The `unsavedDraftInDocument` eligibility is document-wide, on purpose
 *
 * A committed duplicate mints a new revision and therefore invalidates
 * **every** `MatchId` in the file, so a dirty draft held for *any* snippet of
 * the file — not only the source — would be stranded by the commit. The
 * coordinator supplies that fact as a boolean it computed from what it owns,
 * rather than this module trying to follow a `{document, node}` pair across a
 * reparse — the hole `moveEligibility`'s `unsavedDraft` arm records is not
 * repeated here, it is designed out by asking a wider question the caller can
 * answer honestly (consult Q6). **Nothing in TypeScript can check the boolean
 * was computed rather than invented**; it is required and undefaulted so a
 * caller that did not look cannot compile silence into "there are none".
 *
 * ## Where two refusal arms are true at once, the one that claims less wins
 *
 * The standing rule, applied through {@link refusalGiven} exactly as
 * `./matchMove.ts` applies it: `mayHaveWritten` — *this application cannot
 * tell what happened* — outranks every definite claim, `alreadyDuplicated`
 * included; and `outOfDate` outranks `notDuplicable`, because `eligibility`
 * was frozen at {@link startMatchDuplication} and a definite claim about the
 * snippet read off a replaced projection may no longer be true.
 *
 * ## What spends a session, and what dismissal does not clear
 *
 * Four sticky facts, each or-ed into and cleared by **nothing**:
 * {@link MatchDuplicationSession.duplicated} — a commit happened through this
 * session; {@link MatchDuplicationSession.invalidated} — the projection these
 * identities came from has been replaced (a committed save, an adoption the
 * wrapper owed at all, the conflict arm that installs a disk projection while
 * reporting `adoption: notOwed`, or a recovery re-read that failed); and
 * {@link MatchDuplicationSession.mayHaveWritten} — a send this application
 * cannot account for. {@link dismissDuplicationOutcome} clears the panel, not
 * those facts. A `committed: false` whose adoption was not owed replaced
 * nothing and spends nothing — practically unreachable for an insertion, and
 * the arm is honest rather than hopeful.
 *
 * **What spends the session is uncertainty and stale identity, never a fear of
 * writing twice**: a session resends its frozen base revision, so a successful
 * first write makes that base stale and the retry conflicts rather than
 * duplicating again.
 *
 * ## What no type here forces
 *
 * In the same sentence as what one does. {@link beginDuplicate} takes the
 * identity the **live projection** gives the snippet and refuses to produce
 * anything to send unless all three of its fields equal the session's own and
 * the draft's candidate — but `MatchId` carries no brand and nothing can say
 * where the argument came from, so a caller that hands back `session.match`
 * defeats the check entirely. `identityInProjection` in `./matchDeletion.ts`
 * is what a caller uses *instead*, and step 3's component must derive the
 * view, the eligibility and the submission identity from **one synchronous
 * projection read**, exactly as `MatchMover.svelte` does. Nor can anything
 * here stop a component importing `duplicateMatch` from `../ipc/commands` and
 * calling it with no session at all — the hole every writing command has had
 * since 2b-2a.
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
  conflictArm,
  consentForRefusal,
  offeredRefusalChoices,
  refusedArm,
  sendFailureLines,
  sendFailureOf,
  submissionIsStale,
  type EditorPhase,
  type SendFailure,
  type SendFailureLine
} from './editorSave';
import type { InvalidationStatus } from './invalidation';
import { identityInProjection, plainIdentity } from './matchDeletion';
import { sequenceOf, type SequenceAddress } from './matchMove';
import type { RawSaveChoice } from './rawSave';
import {
  describeEditSave,
  invalidationFailureMessage,
  type ConflictChoice,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';

/**
 * How this session compares and snapshots the identity it is about.
 *
 * `structuredDraftRules` because a {@link MatchId} has fields: deep equality is
 * what makes "still the same candidate" mean *the same three values*, and the
 * frozen deep copy is what stops a caller mutating the identity the consent was
 * bound to. The snapshot is a `structuredClone`, which **throws on a reactive
 * proxy** — see {@link startMatchDuplication}.
 */
const IDENTITY_RULES: DraftValueRules<MatchId> = structuredDraftRules<MatchId>();

/**
 * Whether two match identities name the same snippet of the same parse.
 *
 * All three fields, because all three are the identity: the revision is part of
 * it precisely so that a value crossing a reparse is refused rather than
 * resolved to whatever now occupies that arena slot.
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
 * Why this application will not duplicate one snippet at all.
 *
 * **A code, never a sentence** (CLAUDE.md section 2). {@link duplicationRefusalKey}
 * maps it to a dictionary key and `tDuplicationRefusal` in `../i18n` renders it;
 * a component never builds the key.
 */
export type DuplicationRefusal =
  /** The projection says this application must refuse to write the file. */
  | 'readOnly'
  /** The snippet and the file handed in are not a pair this projection describes. */
  | 'notInDocument'
  /** The projection gives it no address as an item of any sequence. */
  | 'noSequencePosition'
  /**
   * This window is holding unsaved edits to **some snippet of this file**.
   *
   * Document-wide on purpose, and this application's workflow policy rather
   * than the core's rule: a committed duplicate invalidates every `MatchId` in
   * the file, so a dirty draft for any snippet in it would be stranded, not
   * only a draft for the source. See this module's header.
   */
  | 'unsavedDraftInDocument';

/**
 * Whether one snippet may be duplicated, and why not when it may not.
 *
 * A discriminated union rather than a boolean with a nullable reason, so a
 * refused verdict with no reason is not representable — the shape every verdict
 * in this directory has.
 */
export type DuplicationEligibility =
  | {
      /** The snippet may be duplicated. */
      readonly kind: 'duplicable';
    }
  | {
      /** It may not, and the reason is shown. */
      readonly kind: 'refused';
      /** Why, as a code. */
      readonly reason: DuplicationRefusal;
    };

/** The one duplicable verdict, shared rather than rebuilt per snippet. */
const DUPLICABLE: DuplicationEligibility = Object.freeze({ kind: 'duplicable' as const });

/**
 * Whether one snippet of one projected file may be duplicated.
 *
 * **The first two arguments are checked against each other**, which is
 * `deletionEligibility`'s `notInDocument` arm for the same reason: a snippet
 * and its file are one fact, and a caller passing a second value straight from
 * the live selection type-checks perfectly and can be wrong.
 *
 * The order of the checks is the consult's (Q6), and it is a claim about which
 * fact is the most fundamental: whether the pair is real, then whether this
 * application may write the file at all, then whether the snippet has an
 * address a copy can be planned from, and last the one rule that is about the
 * person's workflow rather than about the file.
 *
 * **Every arm is an affordance derived from current state, never
 * authorization**: if this projection and the file disagree, the command
 * refuses and that refusal is what reaches the screen. Drift can produce a
 * surfaced refusal and never an invalid write. Core hazard and refusal remain
 * authoritative.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @param match - The snippet's projection, from that same file.
 * @param unsavedDraftInDocument - Whether this window is holding unsaved edits
 *   for **any** snippet of that file. **Required and not defaulted**: a default
 *   would be this function inventing "there are none" for a caller that simply
 *   did not look — and only the coordinator that owns the open editors can
 *   answer it.
 * @returns The verdict, with a reason code when it is a refusal.
 */
export function duplicationEligibility(
  document: DocumentView,
  match: MatchView,
  unsavedDraftInDocument: boolean
): DuplicationEligibility {
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
  if (sequenceOf(match) === null) {
    return { kind: 'refused', reason: 'noSequencePosition' };
  }
  if (unsavedDraftInDocument) {
    return { kind: 'refused', reason: 'unsavedDraftInDocument' };
  }
  return DUPLICABLE;
} // End of function duplicationEligibility()

/**
 * One duplication, as a value.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1: a
 * component holds one in a `$state.raw` and reassigns it, and every function
 * below returns a new session without touching its argument.
 */
export interface MatchDuplicationSession {
  /** The snippet this is about, by the identity this window holds. */
  readonly match: MatchId;
  /** The file it lives in. */
  readonly document: DocumentId;
  /**
   * The sequence it is an item of, or `null` when it addresses none.
   *
   * Provenance, kept because the consult asks for it: the clone joins this
   * sequence, and "same sequence" — never "same file" — is what a duplicate
   * keeps, exactly as a move does. Nothing here reads it back today, and a
   * later screen that names the list reads it rather than re-deriving one.
   */
  readonly sequence: SequenceAddress | null;
  /** Whether it may be duplicated at all, frozen at the session's first parse. */
  readonly eligibility: DuplicationEligibility;
  /**
   * The base revision, the candidate and the consent, as one value.
   *
   * Never edited: a duplicate has one candidate. See this module's header for
   * why a session with nothing typed holds a draft at all.
   */
  readonly draft: Draft<MatchId>;
  /** Whether a duplicate is in flight. */
  readonly phase: EditorPhase;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<MatchId> | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<MatchId> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed duplicate whose adoption failed.
   * The clone is in the file (`PROGRESS.md` D2) and what failed is this
   * window's attempt to bring itself back into step.
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How the last attempt failed to produce an outcome at all, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * Whether a duplicate has committed through this session.
   *
   * **The file was rewritten, and nothing else.** Set by a committed save and
   * cleared by **nothing** — {@link applyDuplication} only ever ors into it.
   * It is not the question "are this session's identities still good?" — that
   * is {@link MatchDuplicationSession.invalidated}, which a commit also sets.
   */
  readonly duplicated: boolean;
  /**
   * Whether this session's identities can no longer be vouched for.
   *
   * **A second fact, because it is a second fact.** Four producers:
   * {@link applyDuplication} sets it from a committed save, from an adoption
   * `BrowserState.duplicateMatch` owed at all — so it is set whenever that
   * wrapper re-read the file, whether or not the duplicate committed — **and**
   * from the conflict arm, which the wrapper reports `adoption: notOwed` for
   * while installing the projection the conflict carried; and
   * {@link duplicationRecoveryFailed} sets it **without** a replacement, from
   * a recovery re-read that failed — there the projection is still installed
   * and what happened is that the command contradicted this session's identity
   * and the window then could not obtain a better one. Cleared by nothing.
   *
   * **It is what this session was told, never everything that is true.** A
   * reprojection the wrapper did not perform is visible only to the live
   * projections {@link duplicationSubmissionRefusal} takes.
   */
  readonly invalidated: boolean;
  /**
   * Whether a send failed in a way that may already have written the file.
   *
   * **The third thing that spends a session, and the only one that spends it
   * without knowing what happened.** `may_have_written` on the wire means the
   * save failed at or after the rename, so the file may already hold the clone
   * and this application cannot tell.
   *
   * **What spends the session is that uncertainty and the identity it leaves
   * stale, never a fear of writing twice.** A session resends its **frozen**
   * base revision, so if the first write did land, that base is stale and the
   * resend conflicts rather than copying again.
   *
   * A flag of its own rather than a read of
   * {@link MatchDuplicationSession.sendFailure}, because
   * {@link dismissDuplicationOutcome} clears that field: putting the panel
   * away must not hand the session back. Set by
   * {@link duplicationCouldNotBeSent} and cleared by **nothing**.
   */
  readonly mayHaveWritten: boolean;
  /**
   * The clone's identity in the new revision, or `null`.
   *
   * `SaveResult.moved` for the arm that answered it — the identity minted at
   * the post-insertion path, which is the only safe continuation after a
   * commit (consult Q8). **`null` is legal on a committed duplicate**, and it
   * means only that **the clone could not be identified in the read that
   * followed the write** — never which of its causes occurred: the file may
   * have changed again, or the command's own post-commit read may have failed,
   * among others. A screen that offers to point at the clone has to be able to
   * draw that case, and nothing built on this field may assert a second
   * writer.
   */
  readonly landed: MatchId | null;
}

/**
 * Opens a duplication over one snippet of one file.
 *
 * The base revision is the **document's**, not the identity's, and the two
 * agree whenever the pair is one this projection describes — which is exactly
 * what {@link duplicationEligibility}'s `notInDocument` arm checks, so a
 * mismatch is a refusal rather than a silently wrong base.
 *
 * **Every identity this session holds is a plain copy**, and that is
 * load-bearing rather than tidy: {@link IDENTITY_RULES} snapshots through
 * `structuredClone`, which **throws** on a reactive proxy, and the projections
 * a screen reads come out of `BrowserState.views`, which is `$state` and
 * therefore deeply proxied. The mounted test of 2c-3a-2 is what found that
 * class of defect; a model test cannot, because model tests pass plain
 * fixtures.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @param match - The snippet's projection, from that same file.
 * @param unsavedDraftInDocument - Whether this window is holding unsaved edits
 *   for any snippet of that file. Required, for
 *   {@link duplicationEligibility}'s reason.
 * @returns A session with nothing sent and nothing said.
 */
export function startMatchDuplication(
  document: DocumentView,
  match: MatchView,
  unsavedDraftInDocument: boolean
): MatchDuplicationSession {
  const identity = plainIdentity(match.id);
  return {
    match: identity,
    document: document.id,
    sequence: sequenceOf(match),
    eligibility: duplicationEligibility(document, match, unsavedDraftInDocument),
    draft: startDraft(document.revision, identity, IDENTITY_RULES),
    phase: 'editing',
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    duplicated: false,
    invalidated: false,
    mayHaveWritten: false,
    landed: null
  };
} // End of function startMatchDuplication()

/**
 * The conflict the session is showing, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchDuplicationSession): ConflictModel<MatchId> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Why the duplicate control does nothing as things stand.
 *
 * **A code, never a sentence.** {@link duplicationSubmissionRefusalKey} maps it
 * to a dictionary key and `tDuplicationSubmissionRefusal` in `../i18n` renders
 * it.
 *
 * Separate from {@link DuplicationRefusal} because the two answer different
 * questions: a `DuplicationRefusal` says this snippet cannot be duplicated *at
 * all*, and belongs beside the snippet; this says the panel cannot send *what
 * it is showing*, and belongs beside the control.
 */
export type DuplicationSubmissionRefusal =
  /**
   * A send failed in a way that may already have written the file.
   *
   * **The weakest claim of the six, so it is the first one asked** — including
   * ahead of `alreadyDuplicated`, by the rule `./matchMove.ts`'s third review
   * pass earned: a definite *this snippet has been copied* beside a send
   * failure disclaiming exactly that is the arrangement the precedence
   * forbids. See {@link MatchDuplicationSession.mayHaveWritten}.
   */
  | 'mayHaveWritten'
  /**
   * A duplicate has already committed through this session, and nothing since
   * is in doubt. The definite arm, and therefore the losing one wherever
   * `mayHaveWritten` is also true.
   */
  | 'alreadyDuplicated'
  /** A duplicate is in flight. */
  | 'saveInFlight'
  /** A conflict is on screen and has not been dismissed. */
  | 'conflict'
  /**
   * This session describes a parse the window is not holding any more.
   *
   * Three things produce it, and all three are the same claim:
   * {@link MatchDuplicationSession.invalidated}; and live projections that do
   * not give this session's snippet the identity it holds; with
   * {@link duplicationRecoveryFailed} reaching it through the first. Its
   * sentence says only that this window can no longer stand behind this
   * reading of the file, never *how* that came about — one arm renders one
   * sentence, so the sentence has to be true of every way of reaching the arm.
   */
  | 'outOfDate'
  /** The snippet may not be duplicated at all; {@link DuplicationRefusal} says why. */
  | 'notDuplicable';

/**
 * Why the duplicate cannot be sent, given what the window is holding now.
 *
 * **The one rule, shared by the two callers that ask the question from
 * different sides**: {@link duplicationSubmissionRefusal} learns the liveness
 * from the live projections, {@link beginDuplicate} learns it from the
 * identity its caller read off them. One copy, so a view and the send cannot
 * reach different verdicts about the same parse — and **what that gives is
 * agreement over consistent inputs, not agreement by construction**: the two
 * `live` values are computed by two callers from two arguments, and nothing
 * here can require them to describe one parse. Step 3's component closes the
 * rest by deriving everything from one synchronous projection read.
 *
 * **The order is a rule and not an arrangement, and the rule is: where two
 * arms are true at once, the one that claims *less* wins** (consult Q6, and
 * the standing CLAUDE.md rule). `mayHaveWritten` — *this application cannot
 * tell what happened* — is the first question asked, above the definite
 * `alreadyDuplicated`; and `outOfDate` sits above `notDuplicable`, because
 * `eligibility` was frozen at {@link startMatchDuplication} and once the
 * session is stale the definite claim about the snippet is the one that may no
 * longer be true.
 *
 * @param session - The session to ask about.
 * @param live - Whether the projection this window holds **now** still gives
 *   this session's snippet the identity the session holds.
 * @returns The reason, or `null` when the duplicate may be sent.
 */
function refusalGiven(
  session: MatchDuplicationSession,
  live: boolean
): DuplicationSubmissionRefusal | null {
  // **First, by the rule above**: the least certain arm wins over every
  // definite one, so a session that is both spent by a commit and spent by a
  // send it could not account for says the second.
  if (session.mayHaveWritten) {
    return 'mayHaveWritten';
  }
  if (session.duplicated) {
    return 'alreadyDuplicated';
  }
  if (session.phase === 'saving') {
    return 'saveInFlight';
  }
  if (conflictOf(session) !== null) {
    return 'conflict';
  }
  // **By the same rule, one pair further down**: `eligibility` was frozen at
  // this session's first parse, so once the session is stale the definite
  // claim about the snippet is the one that may no longer be true, and the
  // weaker `outOfDate` wins over it.
  if (session.invalidated || !live) {
    return 'outOfDate';
  }
  if (session.eligibility.kind !== 'duplicable') {
    return 'notDuplicable';
  }
  return null;
} // End of function refusalGiven()

/**
 * Whether the projections handed in still describe this session.
 *
 * `identityInProjection` is the same call a screen makes to produce
 * {@link beginDuplicate}'s argument, so the two sides of the question are asked
 * of one function rather than of two lookups that could drift apart.
 *
 * @param session - The session to ask about.
 * @param views - Every projection this window holds now, in any order.
 * @returns `true` when the current projection of that file still gives the
 *   snippet this session's identity for it.
 */
function sessionIsLive(
  session: MatchDuplicationSession,
  views: readonly DocumentView[]
): boolean {
  const projected = identityInProjection(views, session.match);
  return projected !== null && sameIdentity(projected, session.match);
} // End of function sessionIsLive()

/**
 * Why the duplicate cannot be sent, or `null` when it can.
 *
 * **It takes the live projections, and that is not ceremony**: a refusal
 * computed from the session's frozen snapshot alone would report the control
 * usable after a reprojection this session was never told about — the exact
 * defect the move's first review round found, inherited here as a rule rather
 * than re-learned.
 *
 * @param session - The session to ask about.
 * @param views - Every projection this window holds **now**, in any order.
 *   Nothing here can check that a caller passes a current one.
 * @returns The reason, or `null` when {@link beginDuplicate} would produce
 *   something to send.
 */
export function duplicationSubmissionRefusal(
  session: MatchDuplicationSession,
  views: readonly DocumentView[]
): DuplicationSubmissionRefusal | null {
  return refusalGiven(session, sessionIsLive(session, views));
} // End of function duplicationSubmissionRefusal()

/**
 * Whether the duplicate may be sent.
 *
 * @param session - The session to ask about.
 * @param views - Every projection this window holds now, in any order.
 * @returns `true` when {@link duplicationSubmissionRefusal} answers `null`.
 */
export function canDuplicate(
  session: MatchDuplicationSession,
  views: readonly DocumentView[]
): boolean {
  return duplicationSubmissionRefusal(session, views) === null;
} // End of function canDuplicate()

/** A duplicate about to be sent: the session that is waiting, and what to send. */
export interface StartedDuplication {
  /** The session, now in flight, with the submission recorded on it. */
  readonly session: MatchDuplicationSession;
  /**
   * What was sent, for the acknowledgement round trip.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the
   * only place the two are put together. Its `baseRevision` is the one the
   * session was opened at, frozen there and never re-read.
   */
  readonly submission: DraftSubmission<MatchId>;
  /** The snippet to copy, by identity. */
  readonly match: MatchId;
}

/**
 * Starts a duplicate of the snippet the session is about.
 *
 * **The only thing in this module that produces a {@link StartedDuplication}**,
 * and it refuses every way of arriving here that {@link refusalGiven} names,
 * with the liveness taken from `projected` rather than from a projection list
 * — the same one-rule arrangement `beginMove` has, so a screen and this
 * function reach the same verdict about the same parse.
 *
 * **All three fields of `projected` must equal the session's identity and the
 * draft's candidate** (consult Q6). The session's `match` and its draft were
 * minted together and go on agreeing however stale they both are; `projected`
 * is the only argument that comes from outside the session, so it is the only
 * one that can notice a reprojection. That is `confirmDelete`'s rule, minus
 * the pending question — there is no destructive confirmation dialog here,
 * because a duplicate destroys nothing and the acknowledgement round trip is
 * the deliberate step its ordinary path already has.
 *
 * **What no type forces**, in the same sentence as what one does: `projected`
 * is an ordinary `MatchId`, so a caller that hands back `session.match` rather
 * than reading the live projection gets no warning and no check.
 * `identityInProjection` in `./matchDeletion.ts` is the one producer a caller
 * uses instead.
 *
 * @param session - The session to send from.
 * @param projected - The identity the projection this window holds **now**
 *   gives the snippet, or `null` when it holds no such snippet any more.
 *   Required, and nullable rather than defaulted: a default would be this
 *   function inventing agreement for a caller that did not look.
 * @returns The waiting session and what the command takes, or `null`.
 */
export function beginDuplicate(
  session: MatchDuplicationSession,
  projected: MatchId | null
): StartedDuplication | null {
  const live =
    projected !== null &&
    sameIdentity(projected, session.match) &&
    sameIdentity(projected, session.draft.value);
  if (refusalGiven(session, live) !== null) {
    return null;
  }
  const submission = submissionOf(session.draft);
  return {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      sendFailure: null
    },
    submission,
    match: session.match
  };
} // End of function beginDuplicate()

/**
 * Takes a duplicate's answer.
 *
 * **Not sealed, and that is not an omission.** The seal of `./invalidation.ts`
 * exists because a whole-document replacement makes every identity in a file
 * stale with no single identity to answer with. A duplicate has one —
 * `SaveResult.moved`, the clone — and `BrowserState.duplicateMatch` performs
 * the adoption before this can be called, and answers what became of it.
 *
 * On a `saved` arm the draft's base moves to the revision the transaction
 * ended on, through `savedDraft`, which spends the consent. A **committed**
 * duplicate additionally sets `duplicated` and records the clone's identity in
 * `landed`.
 *
 * **`adoption` is not only a message.** An adoption that was owed at all —
 * `done` or `failed` — means `BrowserState.duplicateMatch` re-read and
 * re-projected the file, so every identity this session holds is stale
 * whatever the arm said about writing. That sets `invalidated`, which spends
 * the session on its own. **A conflict sets `invalidated` from the arm rather
 * than from the adoption, and that asymmetry is deliberate**, exactly as it is
 * for a move: the wrapper installs the projection the conflict carries on
 * `disk` while reporting `adoption: notOwed`, because it re-read nothing and
 * wrote nothing — so the arm is the only evidence there is. Nothing here can
 * check that the caller really installed that projection; a caller that did
 * not gets a session refusing more than it has to, which is the direction this
 * application errs in.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.**
 * The clone really is in the file; telling the person the duplicate failed
 * would invite a retry of a write that already happened (`PROGRESS.md` D2).
 *
 * @param session - The session waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from
 *   `BrowserState.duplicateMatch`. Required and not defaulted: a default would
 *   be this function inventing a `notOwed` for a caller that simply did not
 *   look — and since a `notOwed` is what keeps the session usable, that
 *   invention would be the defect rather than a shortcut.
 * @returns The session showing what the duplicate ended as.
 */
export function applyDuplication(
  session: MatchDuplicationSession,
  result: SaveResult,
  adoption: InvalidationStatus
): MatchDuplicationSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  // **The two facts, kept apart.** `committed` says the file was rewritten; an
  // adoption that ran at all says this window replaced its projection of that
  // file, which is what makes these identities stale. A commit implies the
  // second, and the second does not imply the first. Both are `session.<flag> ||`
  // and neither is a plain assignment, so "cleared by nothing" is what the code
  // does: a second answer handed to a session that has already committed cannot
  // take the commit back. And a conflict is the third producer — the wrapper
  // installs the projection the conflict carried and reports `notOwed` for it,
  // so the arm is the only evidence. See this function's JSDoc.
  const committed = result.outcome === 'saved' && result.committed;
  const duplicated = session.duplicated || committed;
  const invalidated =
    session.invalidated ||
    committed ||
    adoption.kind !== 'notOwed' ||
    result.outcome === 'conflict';
  if (result.outcome !== 'saved') {
    return {
      ...session,
      phase: 'editing',
      invalidated,
      outcome,
      extraMessages,
      sendFailure: null
    };
  }
  return {
    ...session,
    duplicated,
    invalidated,
    landed: result.moved,
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    outcome,
    extraMessages,
    sendFailure: null
  };
} // End of function applyDuplication()

/**
 * Records that the duplicate produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a
 * **second** question, and the only honest answers are "no" and "this
 * application cannot tell".
 *
 * **The second of those spends the session.** `mayHaveWritten` is or-ed into
 * {@link MatchDuplicationSession.mayHaveWritten}, which nothing clears, so
 * {@link beginDuplicate} produces nothing until a new session is opened over a
 * fresh projection. A `notSent` is the other half and spends nothing: the
 * command failed before the rename, so the file really does still hold what it
 * held.
 *
 * **The two arguments describe one failure, and nothing here can require it.**
 * In production `BrowserState.duplicateMatch` computes the flag with
 * `mayHaveWritten` in `../ipc/errors` from the very failure it hands on as
 * `reason`; a caller pairing an unrelated reason with a set flag is well-typed.
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the clone.
 * @param reason - Why the command rejected, or `null` when nothing was sent
 *   and the boundary therefore has no rejection to hand on.
 * @returns The session, back to its resting state, with the right notice
 *   raised.
 */
export function duplicationCouldNotBeSent(
  session: MatchDuplicationSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null
): MatchDuplicationSession {
  return {
    ...session,
    phase: 'editing',
    mayHaveWritten: session.mayHaveWritten || mayHaveWritten,
    sendFailure: sendFailureOf(mayHaveWritten, reason)
  };
} // End of function duplicationCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` —
 * the **only** producer of consent in this application. The submission is
 * taken from the session rather than from an argument, so a caller cannot pair
 * one candidate's acknowledgement with another candidate. For a duplicate this
 * is the ordinary second step rather than an exceptional one: the transaction
 * interrupts the first attempt with the trigger suspicion by design.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeDuplicationFindings(
  session: MatchDuplicationSession
): MatchDuplicationSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeDuplicationFindings()

/**
 * Puts the outcome away.
 *
 * The draft is untouched — this is a panel being dismissed, not a state being
 * resolved — and the submission goes with it, because there is nothing left on
 * screen to acknowledge. It does **not** give a spent session back:
 * `duplicated`, `invalidated` and `mayHaveWritten` all survive this, so nobody
 * can dismiss their way into sending from a session whose identity and base
 * revision may no longer describe the file — the `mayHaveWritten` case
 * included, where this application does not know what the file now holds.
 * **Not** because a resend would copy twice: it would carry the frozen base
 * revision and conflict. The `sendFailure` it clears is the *message*; the
 * flags that spend the session are separate fields for exactly this reason.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last attempt.
 */
export function dismissDuplicationOutcome(
  session: MatchDuplicationSession
): MatchDuplicationSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null
  };
} // End of function dismissDuplicationOutcome()

/**
 * What the person may do about a command that produced no outcome.
 *
 * One arm today, `./matchMove.ts`'s. It is an **offer**, never a diagnosis:
 * nothing here knows whether re-reading the file will change the answer, only
 * that the failure is one where the file and this window's reading of it
 * disagree.
 */
export type DuplicationRecovery =
  /** Have this window read the file again, and start from what it finds. */
  'reloadFile';

/** The one recovery, shared rather than rebuilt. */
const RELOAD_ONLY: readonly DuplicationRecovery[] = Object.freeze(['reloadFile' as const]);

/**
 * What to offer beside a send that produced no outcome.
 *
 * The consult's Q8 rule as `./matchMove.ts` settled it, with the duplicate's
 * own command code in place of the move's: four codes say that the address
 * this window sent does not describe the file the command read, and re-reading
 * the file is the only thing a person can do about that from this pane.
 * Everything else is offered nothing, honestly — a `saveFailed` or a
 * `noWorkspaceOpen` is not a disagreement about what the file holds, so a
 * re-read cannot help and offering one would be a control that never works.
 * Nothing is offered beside a `mayHaveWritten` send for the move's measured
 * reason: `mayHaveWritten` is `true` only for `saveFailed`, which is not in
 * this list, so in production the two never appear together.
 *
 * @param failure - Why the command rejected, or `null` when there is no reason
 *   to act on.
 * @returns The recoveries to offer, or an empty list.
 */
export function duplicationRecoveryChoices(
  failure: IpcFailure | null
): readonly DuplicationRecovery[] {
  if (failure === null || failure.kind !== 'command') {
    return [];
  }
  switch (failure.error.code) {
    case 'duplicateSourceNotASequenceItem':
    case 'identityStaleRevision':
    case 'identityNoSuchMatch':
    case 'identityWrongDocument':
      return RELOAD_ONLY;
    default:
      return [];
  }
} // End of function duplicationRecoveryChoices()

/**
 * Records that the one recovery this session offers did not reach the file.
 *
 * **The session stops being sendable, and the argument is the recovery's own
 * premise** — `./matchMove.ts`'s `moveRecoveryFailed`, restated for a copy:
 * the recovery is offered only for codes that say this window's reading of the
 * file and the file disagree, so a read that then fails removes the only way
 * of resolving that, and leaving the session live would let the same disputed
 * identity be sent again. Not because a resend would copy twice — the frozen
 * base revision would conflict.
 *
 * **The flag it sets is `invalidated` rather than an arm of its own**, so the
 * sentence the panel draws is `outOfDate` — which says the window can no
 * longer stand behind this reading of the file, and says nothing about how
 * that came about. The panel goes on drawing
 * `browser.matchDuplication.reloadFailed` beside the send failure, which is
 * where *why* is said.
 *
 * **What no type forces**, in the same sentence as what one does: nothing here
 * can check that the caller really attempted a read, or that the read really
 * failed. What is closed is that a session this is called on cannot send
 * anything.
 *
 * @param session - The session whose recovery re-read failed.
 * @returns The session, unable to send anything more.
 */
export function duplicationRecoveryFailed(
  session: MatchDuplicationSession
): MatchDuplicationSession {
  return { ...session, invalidated: true };
} // End of function duplicationRecoveryFailed()

/**
 * The choices a conflict offers in this sub-phase.
 *
 * **One**, for `matchDeletion.ts`'s reason: *Copy draft* copies a text and
 * there is no text here, and *Load the version on disk* is conflict capture
 * and preservation — Phase 2c-4a. **None of these is "keep my draft"**, which
 * means something specific and belongs to 2c-4b.
 */
const CONFLICT_CHOICES: readonly ConflictChoice[] = ['keepEditing'];

/** Everything a screen needs about one duplication, derived on every read. */
export interface MatchDuplicationView {
  /** The snippet this is about. */
  readonly match: MatchId;
  /** The file it lives in. */
  readonly document: DocumentId;
  /** Whether the duplicate control does anything. */
  readonly canDuplicate: boolean;
  /**
   * Why this snippet cannot be duplicated at all, as a code, or `null`.
   *
   * **This is the session's frozen eligibility, and
   * {@link MatchDuplicationView.cannotDuplicate} is the live refusal.** They
   * are two fields because they answer at two times, and `refusalGiven` puts
   * `outOfDate` **above** `notDuplicable` for exactly that reason. **A screen
   * must therefore not draw this beside a `cannotDuplicate` of `outOfDate`**,
   * or the definite claim the precedence just suppressed comes back through
   * the other field. Nothing in TypeScript can enforce that; the rule is here
   * because the only place it can be broken is a component.
   */
  readonly notDuplicable: DuplicationRefusal | null;
  /** Why the control does nothing as things stand, as a code, or `null`. */
  readonly cannotDuplicate: DuplicationSubmissionRefusal | null;
  /** Whether a duplicate is in flight. */
  readonly duplicating: boolean;
  /** Whether one has committed. See {@link MatchDuplicationSession.duplicated}. */
  readonly duplicated: boolean;
  /**
   * Whether this session is spent, for any of the three reasons.
   *
   * `duplicated`, an invalidated projection, **or** a send that may already
   * have written — a screen that keeps the panel open for one has to keep it
   * open for the others. The reason to show beside it is
   * {@link MatchDuplicationView.cannotDuplicate}, and where more than one
   * holds, the least certain — the rule `refusalGiven` states.
   */
  readonly spent: boolean;
  /** The clone's identity, or `null`. See the session's own field. */
  readonly landed: MatchId | null;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /** The reasons to show beside that failure, outermost first. */
  readonly failureLines: readonly SendFailureLine[];
  /** What to offer about that failure. See {@link duplicationRecoveryChoices}. */
  readonly recovery: readonly DuplicationRecovery[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<MatchId> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /**
   * The presentation changes a saved arm disclosed, in report order.
   *
   * **Always empty for a duplicate, and that is read off the core rather than
   * assumed**: a duplicate copies the item's own bytes verbatim and re-encodes
   * no scalar, so there is no presentation to change, and the batch may hold
   * nothing else (`DuplicateMustBeTheOnlyEditInItsBatch`). The field is
   * carried anyway, so a note the core learns to emit is drawn rather than
   * dropped — plan section 6.2 is *never silently normalise*.
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
}

/**
 * Everything a screen needs about one duplication.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up.
 *
 * **It takes the live projections** for {@link duplicationSubmissionRefusal}'s
 * reason, and the refusal is computed **once** here with `canDuplicate` read
 * off it, so the two fields of this view cannot contradict each other.
 *
 * @param session - The session to describe.
 * @param views - Every projection this window holds **now**, in any order.
 *   Nothing here can check that it is current.
 * @returns The view.
 */
export function matchDuplicationView(
  session: MatchDuplicationSession,
  views: readonly DocumentView[]
): MatchDuplicationView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale = submissionIsStale(session.draft, session.submitted);
  const conflict = conflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  const cannotDuplicate = duplicationSubmissionRefusal(session, views);
  return {
    match: session.match,
    document: session.document,
    canDuplicate: cannotDuplicate === null,
    notDuplicable: session.eligibility.kind === 'refused' ? session.eligibility.reason : null,
    cannotDuplicate,
    duplicating: session.phase === 'saving',
    duplicated: session.duplicated,
    spent: session.duplicated || session.invalidated || session.mayHaveWritten,
    landed: session.landed,
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    recovery: duplicationRecoveryChoices(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices: conflict === null ? [] : CONFLICT_CHOICES
  };
} // End of function matchDuplicationView()

/**
 * The dictionary key holding one duplication refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every
 * other describer in this directory: a renamed key is a compile error here,
 * and a new member of {@link DuplicationRefusal} with no sentence is one too.
 *
 * @param reason - Why the snippet may not be duplicated.
 * @returns The key holding that reason's sentence.
 */
export function duplicationRefusalKey(reason: DuplicationRefusal): TranslationKey {
  switch (reason) {
    case 'readOnly':
      return 'browser.matchDuplication.refused.readOnly';
    case 'notInDocument':
      return 'browser.matchDuplication.refused.notInDocument';
    case 'noSequencePosition':
      return 'browser.matchDuplication.refused.noSequencePosition';
    case 'unsavedDraftInDocument':
      return 'browser.matchDuplication.refused.unsavedDraftInDocument';
  }
} // End of function duplicationRefusalKey()

/**
 * The dictionary key holding one submission refusal's sentence.
 *
 * @param reason - Why the duplicate cannot be sent as things stand.
 * @returns The key holding that reason's sentence.
 */
export function duplicationSubmissionRefusalKey(
  reason: DuplicationSubmissionRefusal
): TranslationKey {
  switch (reason) {
    case 'mayHaveWritten':
      return 'browser.matchDuplication.cannotDuplicate.mayHaveWritten';
    case 'alreadyDuplicated':
      return 'browser.matchDuplication.cannotDuplicate.alreadyDuplicated';
    case 'saveInFlight':
      return 'browser.matchDuplication.cannotDuplicate.saveInFlight';
    case 'conflict':
      return 'browser.matchDuplication.cannotDuplicate.conflict';
    case 'outOfDate':
      return 'browser.matchDuplication.cannotDuplicate.outOfDate';
    case 'notDuplicable':
      return 'browser.matchDuplication.cannotDuplicate.notDuplicable';
  }
} // End of function duplicationSubmissionRefusalKey()

/**
 * The dictionary key holding one recovery's label.
 *
 * @param choice - What the person may do about a failed send.
 * @returns The key holding that choice's label.
 */
export function duplicationRecoveryKey(choice: DuplicationRecovery): TranslationKey {
  switch (choice) {
    case 'reloadFile':
      return 'browser.matchDuplication.recovery.reloadFile';
  }
} // End of function duplicationRecoveryKey()

/**
 * The acknowledgement one submission carries, for a caller that only needs
 * that.
 *
 * A named read rather than a property walk at the call site, so the one place
 * a screen hands consent to the boundary is a place this module can be
 * searched for.
 *
 * @param submission - What {@link beginDuplicate} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(submission: DraftSubmission<MatchId>): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

/**
 * The base revision this session would duplicate against.
 *
 * **Frozen at {@link startMatchDuplication} and never re-read**, and it is
 * what a caller forwards: `BrowserState.duplicateMatch` takes a base revision
 * and sends it unchanged rather than reading its own projection's at the
 * moment of the call. That is what lets a session opened at one revision
 * *conflict* against a file the window has since re-read, instead of a copy
 * being resolved to a position in a parse the person never saw.
 *
 * **What no type forces**, in the same sentence: that parameter is an ordinary
 * `ContentRevision`, so a caller may hand over the projection's current one
 * instead of this and get the old behaviour. What is closed is that the
 * wrapper does not choose for it.
 *
 * @param session - The session to ask about.
 * @returns The revision the session was opened at.
 */
export function baseRevisionOf(session: MatchDuplicationSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()
