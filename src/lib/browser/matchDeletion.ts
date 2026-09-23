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
 *
 * ## The external session — Phase 2d-6-4
 *
 * The shape `./matchEditor.ts` took at 2d-6-2 and `./matchCreation.ts` at
 * 2d-6-3, for a deletion. {@link MatchDeletionSession.externalConflict} is the
 * conflict a watcher observation raised over the file this session is about, a
 * field beside `outcome` and never an arm of it (the 2d-6 record's §3 entry 6);
 * {@link applyDeletionObservation} is the session's receiver as a value, one named
 * action per verdict arm and a `never` terminus (entry 11); {@link conflictOf}
 * answers the conflict shown whichever origin it has, so {@link canRequestDelete},
 * {@link requestDelete} and {@link confirmDelete} refuse under both (entry 8 —
 * the request **and** the confirmation, and a direct call past a disabled control
 * answers the same session or `null`). A held observation
 * ({@link MatchDeletionSession.awaitingReconciliation}) refuses the request and
 * the confirmation too; a conflict raised under an unknown write outcome
 * ({@link MatchDeletionSession.uncertaintyUnresolved}) withholds the reload and
 * refuses the reapply until {@link acknowledgeDeletionSnapshot} is told the hold
 * ended (entries 11, 22); {@link dismissDeletionOutcome} erases none of the three
 * (entry 9).
 *
 * **A replacing verdict withdraws a pending confirmation** (entry 12): a question
 * asked about the snippet as this window projected it is not an answer about the
 * file as another writer left it, so `raised`, `raisedWithoutReload` and
 * `supersedes` put {@link MatchDeletionSession.pending} back to `null` and reset
 * the reload step; `coalesced` and `notLater` leave both where they are.
 *
 * **The reapply reads both origins through one entry** — `enterReapply` in
 * `./reapply.ts` — and takes the snippet from an external table by its **full**
 * base identity through `correspondenceRowFor`, reading the row's `exact` tier
 * through `subjectResolution` (entries 19, 20 and 22): a destructive operation
 * never takes the flexible tier, never an array index and never a node number
 * alone. A refused table or row resolves to manual resolution with
 * `tExternalEvidenceRefusal`'s sentence, superseded evidence with
 * `tSupersededEvidence`'s.
 *
 * **Every door and every settling transition can read the installed session**
 * through a {@link ReadTheInstalledSession} (this phase's review): a
 * caller-controlled read — `projected`, a table row, the disk projection, an
 * observation being replayed — runs arbitrary code, and a receiver run from it
 * replaces the installed session behind the transition's back. {@link confirmDelete}
 * spends only against the session it was handed while that is still installed;
 * {@link reapplyToDiskVersion} rechecks the installed session's blocks and
 * conflict immediately before adopting; {@link applyDeletion} and
 * {@link deletionCouldNotBeSent} replay what the receiver appended during their
 * own replay. The reader is required at every one of them since Phase 2d-6-6a, and
 * its doc says what no type can force about it.
 *
 * **Registered since Phase 2d-6-7a.** `MatchDeleter.svelte` reports a receiver that
 * installs this module's observation transition over the session it holds, and
 * `DetailPane` registers it through `BrowserState.registerObservationReceiver`
 * (`./surfaceReceivers.ts`), as 2d-6-6b did for the editor, the new-snippet form
 * and the recovery form; `MatchDeleter.svelte` does not yet draw the external conflict
 * or the two notices (Phase 2d-6-7b's).
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
import type { AcknowledgeTheUncertainty } from './matchEditor';
import type { RawSaveChoice } from './rawSave';
import type { ConflictSource, ExternalConflictObservation } from './conflictSource';
import {
  externalConflictNoticeKey,
  type ExternalConflictNotice,
  type ObservationDelivery
} from './observationDelivery';
import {
  correspondenceRowFor,
  enterReapply,
  externalEvidenceRefusalKey,
  sharedReapplyObstacleKey,
  subjectCorrespondence,
  subjectResolution,
  SUPERSEDED_EVIDENCE_KEY,
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
   * **Reset to `idle` by every new outcome, by every dismissal and by every
   * replacing verdict** ({@link applyDeletionObservation}, the 2d-6 record's §3
   * entry 12), which is what stops a confirmation collected for one conflict from
   * being spendable while a later one is on screen. The window refuses a spent
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
   * Whether a deletion has committed through this session.
   *
   * Set by a committed save and cleared by **nothing**. Every `MatchId` held for
   * that file is stale afterwards, this session's own included, so the session
   * stops offering to delete and only a fresh projection can produce one that
   * does.
   */
  readonly deleted: boolean;
  /**
   * The conflict a watcher observation raised over the file this session is
   * about, or `null` — Phase 2d-6-4, the 2d-6 record's §3 entry 6.
   *
   * **A field of its own beside {@link MatchDeletionSession.outcome}, never an
   * arm of it**, for `MatchEditorSession.externalConflict`'s reason: an outcome is
   * how *a deletion* ended, and a conflict the watcher raised is not that.
   * {@link conflictOf} is the one accessor that reads both and answers the
   * conflict this session is showing, whichever origin it has. **Only one conflict
   * is active at a time, and the transitions are what keep it so** (entry 7):
   * {@link applyDeletionObservation} retires a save conflict's outcome when it
   * sets this, and {@link applyDeletion} retires this when a deletion ends as a
   * conflict or a success. The type admits both populated, and a session built by
   * hand with both gets {@link conflictOf}'s stated precedence, not a guarantee.
   *
   * While it is non-null nothing can be requested or confirmed and any pending
   * question has been withdrawn (entry 12); {@link dismissDeletionOutcome} does
   * not clear it (entry 9). The ways out are the reload and the reapply.
   */
  readonly externalConflict: ExternalConflictModel<MatchId> | null;
  /**
   * Whether {@link MatchDeletionSession.externalConflict} was raised while a
   * write of this window's own had an unknown outcome, and this session has not
   * been told the hold ended — Phase 2d-6-4, entry 11's `raisedWithoutReload` row.
   *
   * While `true` the ordinary reload is withheld and the reapply refused, for the
   * match editor's reason: a confirmed installation of bytes a write of this
   * window may or may not have produced would settle, silently, a question only
   * the person can. It ends when {@link acknowledgeDeletionSnapshot} is told the
   * window ended the hold, or when a later verdict replaces the conflict under no
   * uncertainty. **It records what this session was told and nothing more**: a
   * hold the window ends by a later definite write delivers nothing to a session,
   * and this flag cannot see it. This module never sets it without a conflict, so
   * the request and the confirmation are blocked by the conflict it qualifies.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations this session was told the window is holding and has not
   * decided about, keyed by the file each is about — Phase 2d-6-4, entry 11's
   * `retained` row, in the shape 2d-6-3's review gave the creator.
   *
   * **A restriction on asking and answering, and nothing else**: while this
   * session's own file has an entry, {@link canRequestDelete} answers `false`, so
   * {@link requestDelete} answers the same session and {@link confirmDelete}
   * answers `null` (entry 8); no disk comparison and no origin is recorded. An
   * entry is lifted by the delivery that decides **that** observation, whatever
   * the verdict — `writtenHere` included — compared by identity, and replaced by
   * a later `retained` about the same file.
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
   * Every delivery that arrived while this session's own deletion was in flight,
   * in the order it arrived, kept until that deletion's answer has been applied —
   * Phase 2d-6-4, the 2d-6 record's §3 entry 5.
   *
   * `MatchEditorSession.heldDeliveries`'s rule, unchanged: the window publishes a
   * write's settlement from inside the writing wrapper, before the `await` that
   * started it resumes, so {@link applyDeletionObservation} appends here while the
   * phase is `saving` and {@link applyDeletion} and {@link deletionCouldNotBeSent}
   * replay the whole list through it, first to last, after their own answer —
   * and, through the required {@link ReadTheInstalledSession}, whatever the
   * receiver appended to the installed session while they were doing so. **What
   * the list forces** is that no envelope delivered during the deletion is
   * dropped and that first-to-last is the order; **what it does not force** is
   * that arrival order was decision order — the window's own contract — nor that
   * the reader is honest: this module has no send composition, so the caller
   * hands the settling transition the session it holds and the reader that
   * answers it, as `MatchDeleter.svelte` does, and nothing in TypeScript stops a
   * caller handing it a capture and a reader that answers the capture.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
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
    deleted: false,
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    heldDeliveries: []
  };
} // End of function startMatchDeletion()

/**
 * The wait that restricts this session **now**, or `null` — its own file's entry
 * of {@link MatchDeletionSession.awaitingReconciliation}.
 *
 * @param session - The session to ask about.
 * @returns The observation the session is waiting on, or `null`.
 */
function awaitedFor(session: MatchDeletionSession): ExternalConflictObservation | null {
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
 * for one this module built, because {@link applyDeletionObservation} and
 * {@link applyDeletion} keep the two exclusive (the 2d-6 record's §3 entry 7).
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchDeletionSession): ConflictModel<MatchId> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether this session may be asked to delete right now.
 *
 * Five reasons it may not: the snippet is not deletable, a deletion is already in
 * flight, a conflict of either origin is on screen, one has already committed,
 * or the window holds a reading of this file it has not decided about (Phase
 * 2d-6-4, the 2d-6 record's §3 entry 8). An unresolved write uncertainty blocks
 * through the conflict it qualifies, which this module never sets it without.
 * **Both doors ask this**: {@link requestDelete} and {@link confirmDelete}, so a
 * call made past a disabled control answers the same session or `null`.
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
    conflictOf(session) === null &&
    awaitedFor(session) === null
  );
} // End of function canRequestDelete()

/**
 * Asks the person to confirm deleting this snippet.
 *
 * The first of the two phases. It records **which** snippet was asked about, so
 * the answer cannot be spent on another one.
 *
 * **It takes no {@link ReadTheInstalledSession}, and that is not an omission**:
 * its one operand is the session itself, whose fields this module built as plain
 * data, so no caller-controlled read runs between {@link canRequestDelete} and
 * the question being recorded, and nothing external is spent by recording it.
 * A caller that reads its live session, calls this and installs the answer in
 * one synchronous block gives a receiver no moment to run in between; nothing in
 * TypeScript forces that block.
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

/**
 * Reads the session a caller currently holds — the one its registered receiver
 * has been updating — for a door or a settling transition to check against.
 *
 * **The reader `ReadTheInstalledForm` in `./recovery.ts` is, for this session**,
 * and it exists for the reason this phase's review gave (its first, second and
 * third findings, one class): a door's caller-controlled operand — `projected`,
 * a correspondence row, the disk projection — is read through property access,
 * and a property read runs arbitrary code; a getter there can call
 * `BrowserState.observeExternalChange`, whose registered receiver replaces the
 * *installed* session with one carrying an external conflict or a wait. A
 * transition that then checked the block on the session it was handed would
 * check a session no longer installed, and spend. So every spending door and
 * every settling transition asks for the installed session through this, once,
 * after its last caller-controlled read and immediately before its spend, and
 * refuses when what is installed is not what it was handed or now carries a
 * block.
 *
 * **What it forces and what it does not, in the same sentence.** Through it, {@link
 * confirmDelete} spends only against the session it was handed
 * while that session is still the one installed, {@link reapplyToDiskVersion}
 * adopts only when the installed session's restrictions and conflict are what
 * they were, and {@link applyDeletion} / {@link deletionCouldNotBeSent} settle
 * every delivery the receiver appended to the installed session during the
 * flight and during their own replay; since Phase 2d-6-6b {@link
 * reloadTheDiskVersion} reads it before its adoption and once more after it.
 * **The parameter is required since Phase
 * 2d-6-6a**, so no call compiles without one, and `MatchDeleter.svelte` passes
 * `() => session` at every door and settling transition. What no type can force
 * is that the closure reads the installed session rather than a capture:
 * `() => session` over the component's `$state.raw` is the honest one, and a
 * reader answering the session handed in whatever is installed gets the
 * displaced check and the lost delivery this closes.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => MatchDeletionSession;

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
 * **Every caller-controlled read comes first, and the installed session is read
 * once, last** (Phase 2d-6-4, the 2d-6 record's §3 entry 8 and R37; Phase
 * 2d-6-6a, 2d-6-5's `beginSave` shape): the pending identity, the session's own,
 * the submission — whose candidate is the draft's value, read once and compared
 * — and `projected` are all read and compared; {@link canRequestDelete} is asked;
 * the waiting session is built by the spread, which reads every own property of
 * the session; and only then is the installed session read through `current`,
 * once. Only a session that is still the one installed spends, and nothing
 * caller-controlled runs between that read and the answer. A getter behind
 * `projected`, behind the draft's value or behind any own property the spread
 * reads therefore runs before the reader, and a receiver it runs — which
 * replaces the installed session with one carrying an external conflict or a
 * wait — is seen by the identity check rather than overwritten by the spend. An
 * external conflict, a held reading and the uncertainty the conflict carries each
 * answer `null` here, exactly as they disable the control. What that forces is
 * refusal for the inputs supplied and for the session installed at the moment of
 * the spend; it cannot force those inputs to be current — one projection
 * snapshot, one synchronous decision — nor that the reader a caller passes is
 * honest ({@link ReadTheInstalledSession}), nor anything about a caller that
 * redefines a property of the very session it handed in between the block and
 * the reader: a receiver replaces a session and never mutates one, so the
 * identity check is what carries the block across, and that caller's own
 * session is what it defeats.
 *
 * @param session - The session holding the person's answer.
 * @param projected - The identity the projection this window holds **now** gives
 *   the snippet, or `null` when it holds no such snippet any more. Required, and
 *   nullable rather than defaulted: a default would be this function inventing
 *   agreement for a caller that did not look.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The waiting session and what to send, or `null`.
 */
export function confirmDelete(
  session: MatchDeletionSession,
  projected: MatchId | null,
  current: ReadTheInstalledSession
): StartedDeletion | null {
  // **Every caller-controlled read, taken first.** The submission is taken
  // before the comparison, so the candidate compared is the one that is sent
  // rather than a second read of the draft's value.
  const pending = session.pending;
  const held = session.match;
  const submission = submissionOf(session.draft);
  if (pending === null || projected === null || !sameIdentity(pending.match, held)) {
    return null;
  }
  if (!sameIdentity(projected, held) || !sameIdentity(projected, submission.candidate)) {
    return null;
  }
  if (!canRequestDelete(session)) {
    return null;
  }
  const waiting: MatchDeletionSession = {
    ...session,
    phase: 'saving',
    pending: null,
    submitted: submission,
    sendFailure: null
  };
  // **The installed session, read once, after the last caller-controlled read.**
  // A receiver run from a getter above has replaced it; a session that is no
  // longer the one installed spends nothing, and nothing caller-controlled runs
  // between this read and the answer.
  if (current() !== session) {
    return null;
  }
  return { session: waiting, submission, match: held };
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
 * **What it does about an external conflict, and about a delivery held during
 * the deletion** — Phase 2d-6-4, `applySave`'s rule in `./matchEditor.ts`. A
 * `saved` or a `conflict` answer retires
 * {@link MatchDeletionSession.externalConflict} (the 2d-6 record's §3 entry 7:
 * the deletion's own answer is the newer fact about the file); a `refused` answer
 * wrote nothing and leaves it standing. Neither is reachable from
 * {@link confirmDelete} while an external conflict stands, so this keeps the
 * invariant for a caller that drove the model directly. Then, whatever the
 * answer, every delivery {@link applyDeletionObservation} held while the deletion
 * was in flight is replayed on top, in arrival order (entry 5) — **and, through the
 * reader, every delivery the receiver appended to the installed session
 * during this transition's own reads and replay** (this phase's review, its
 * second finding): the replay reads the observations it replays, a read runs
 * caller code, and a window told of a reading from there delivers it to the
 * installed session, still `saving`, where the receiver appends it; the reader
 * is required (Phase 2d-6-6a), and one that answers a capture rather than the
 * installed session loses such a delivery when the caller installs the result.
 * This module composes no send, so `MatchDeleter.svelte` settles its live
 * `session` after its own `await`; with an honest reader that session may even
 * be a capture, because the installed one's appended list is what is replayed.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.deleteMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session showing what the deletion ended as.
 */
export function applyDeletion(
  session: MatchDeletionSession,
  result: SaveResult,
  adoption: InvalidationStatus,
  current: ReadTheInstalledSession
): MatchDeletionSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft, CONFLICT_CAPABILITIES);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  if (result.outcome !== 'saved') {
    const refused = result.outcome === 'refused';
    return consumingHeldDeliveries(
      {
        ...session,
        phase: 'editing',
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
      deleted: result.committed,
      draft: savedDraft(session.draft, submission, result.revision),
      phase: 'editing',
      outcome,
      extraMessages,
      reload: NOT_RELOADING,
      sendFailure: null,
      // The deletion ended on the file, so the disk side an earlier observation
      // showed is no longer the comparison to draw (entry 7).
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    current
  );
} // End of function applyDeletion()

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
 * Replays every delivery a session held during its deletion, in the order it
 * arrived, once the deletion's own answer is on it — the 2d-6 record's §3 entry
 * 5 — and then every delivery the receiver appended to the installed session
 * while that was happening (this phase's review, its second finding).
 *
 * `consumingHeldDeliveries` in `./matchEditor.ts`, for this session, with one
 * more round: the list is emptied before the first replay so a replay cannot see
 * itself in it, each envelope goes through {@link applyDeletionObservation}
 * exactly as it would have on arrival, and each is applied to the session the
 * one before it left. **Replaying an envelope reads its observation, and a read
 * runs caller code**: a getter there can tell the window of a reading, and the
 * window delivers it at once to the installed session — which is still `saving`,
 * so the receiver appends it there, to a list this transition was handed a copy
 * of. So after each round the installed session is read through `current`, once,
 * and the envelopes it holds beyond the ones replayed are replayed too, in the
 * order they arrived, until a read finds none. **What this forces** is that no
 * envelope delivered during the deletion, or during this settlement, is dropped
 * when the reader answers the installed session, and that first-to-last is the
 * order; **what it cannot force** is that the window delivered them in the order
 * it decided them, that the reader is honest, or that the installed session is the one
 * handed in with more appended — a list that is not an extension of the one
 * replayed is left alone, since the transition cannot say what it is. Nor can it
 * force the rounds to end: a getter that tells the window of a fresh reading on
 * every read does not come to rest here, exactly as it does not at the window's
 * own drain (`registerObservationReceiver`'s doc), and one that re-tells a
 * reading already decided does, because the window hands each decision out once.
 *
 * @param settled - The session with its deletion's answer applied and its phase
 *   back to `editing`.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session with every held delivery applied, or the same session
 *   when none was held.
 */
function consumingHeldDeliveries(
  settled: MatchDeletionSession,
  current: ReadTheInstalledSession
): MatchDeletionSession {
  let queue = settled.heldDeliveries;
  let replayed: MatchDeletionSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyDeletionObservation(replayed, queue[at]!);
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
 * Records that the deletion produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are "no" and "this application cannot
 * tell".
 *
 * The deletion is over, so a delivery held while it was out is applied now: the
 * settlement of an uncertain write arbitrates the held reading under that
 * uncertainty, and its `raisedWithoutReload` is what this applies (entry 5), and
 * through the reader every delivery appended to the installed session during the
 * replay is applied too, for {@link applyDeletion}'s reason.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param mayHaveWritten - Whether the file may already have lost the snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session, back to its resting state, with the right notice raised.
 */
export function deletionCouldNotBeSent(
  session: MatchDeletionSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null,
  current: ReadTheInstalledSession
): MatchDeletionSession {
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      sendFailure: sendFailureOf(mayHaveWritten, reason)
    },
    current
  );
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
 * **Nor does it erase an external block** — Phase 2d-6-4, the 2d-6 record's §3
 * entry 9. {@link MatchDeletionSession.externalConflict},
 * {@link MatchDeletionSession.uncertaintyUnresolved} and
 * {@link MatchDeletionSession.awaitingReconciliation} all survive this spread:
 * what this dismisses under an external conflict is the save outcome's panel and
 * the reload warning, and the conflict and both restrictions stand until an
 * explicit resolution — the reload's confirmation, a reapply, or closing. What
 * the spread forces is that the three fields are copied; what no type forces is
 * that a later edit keeps them out of the literal, and the suite's case is what
 * would notice.
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
function reloadableConflictOf(session: MatchDeletionSession): ConflictModel<MatchId> | null {
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
export function askToReloadDiskVersion(session: MatchDeletionSession): MatchDeletionSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
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
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
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
  session: MatchDeletionSession,
  adopt: AdoptTheDiskVersion<MatchId>,
  current: ReadTheInstalledSession
): MatchDeletionSession {
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
 * | `raised` | builds the external model from the observation and the retained draft, and withdraws a pending question |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its draft kept, its disk side replaced — and withdraws a pending question |
 * | `coalesced` | keeps the model, its source identity, the reload step and the pending question |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on asking and answering; no disk comparison, no origin |
 * | `writtenHere` | lifts the restriction recorded for that observation, and changes nothing else |
 *
 * **Which deliveries are about this session is decided by the observation's
 * file**, read once: a session is opened over one file and a delivery about
 * another can only end a wait recorded for that very observation, by identity,
 * under that file's key — it raises nothing here, because a reload of it would
 * adopt a file the person never named. A `retained` about another file records
 * nothing. The creator reads the same one property for the same reason; the
 * editor reads none, and this session reads it so a mis-registered delivery
 * fails safe rather than raising a stranger's conflict. The envelope's two fields
 * and the verdict's `kind` are read once each, before anything is decided.
 *
 * **Every replacing verdict resets the reload step, withdraws a pending question
 * and retires a save conflict** (entries 7 and 12): the confirmation collected
 * for the conflict that was on screen must not be spendable against the one that
 * replaced it, the question asked about the snippet as this window projected it
 * is not an answer about the file as it now is, and a save conflict's outcome is
 * retired so that only one conflict is active — a committed success or a refusal
 * in `outcome` stays as history. A displayed reapply result is invalidated by
 * the same transition, because `reapplyToShow` in `./reapply.ts` pairs a report
 * to a session by identity and every replacing arm answers a new session.
 * `supersedes` builds through `supersedeConflict` when a conflict is shown and
 * through `describeExternalConflict` over the session's draft when none is; the
 * `superseded` origin the verdict names is not compared with the shown
 * conflict's — the envelope is the window's decision about the file, and a
 * session that re-checked it would be arbitrating.
 *
 * **During this session's own deletion the envelope is appended to the held
 * list, not applied** (entry 5): see {@link MatchDeletionSession.heldDeliveries}.
 * A closed session takes nothing.
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
export function applyDeletionObservation(
  session: MatchDeletionSession,
  delivery: ObservationDelivery
): MatchDeletionSession {
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
} // End of function applyDeletionObservation()

/**
 * The session after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of
 * {@link applyDeletionObservation}, which documents what happens here; this is
 * the one place the external model is built for this surface from a delivery,
 * and the one place a pending question is withdrawn by a fact about the file
 * rather than by the person (entry 12).
 *
 * @param session - The session, not closed and not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The session showing the new conflict, with nothing pending.
 */
function replacedBy(
  session: MatchDeletionSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): MatchDeletionSession {
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
    // Entry 12: the question asked about the snippet as this window projected it
    // is withdrawn — the person answers it again over the file as it now is, if
    // at all — and the confirmation collected for the conflict that was on
    // screen is not spendable against this one, nor may its warning stay on
    // screen saying the wrong thing (the record's §5.7).
    pending: null,
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
 * {@link MatchDeletionSession.uncertaintyUnresolved}.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload and reapply available again, or the same
 *   session.
 */
export function acknowledgeDeletionSnapshot(
  session: MatchDeletionSession,
  acknowledge: AcknowledgeTheUncertainty
): MatchDeletionSession {
  const conflict = session.externalConflict;
  if (session.closed || conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeDeletionSnapshot()

/**
 * Why a reapply of this deletion could not be carried out.
 *
 * **A code, never a sentence.** {@link deletionReapplyObstacleKey} maps each arm
 * to a dictionary key and `tDeletionReapplyObstacle` in `../i18n` renders it.
 */
export type DeletionReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /** The identified snippet is one this application will not delete. */
      readonly kind: 'notDeletable';
      /** Which refusal the newly parsed projection gives, as a code. */
      readonly reason: DeletionRefusal;
    }
  | {
      /**
       * The external observation's correspondence could not be used to find the
       * snippet — Phase 2d-6-4, the 2d-6 record's §3 entries 20 and 22.
       *
       * Five reasons, all about the evidence and never about the file: the
       * reading carried no table, the table's base or disk revision is not this
       * conflict's, or the table names this session's full base identity in no
       * row or in more than one. Rendered through `tExternalEvidenceRefusal`.
       */
      readonly kind: 'externalEvidence';
      /** Which negative claim about the evidence this is. */
      readonly reason: ExternalEvidenceRefusal;
    }
  | {
      /**
       * Another accepted reading of the file has superseded the conflict's
       * evidence, whichever origin it had (entry 22). Answered by the live
       * standing-origin guard, asked last; its obstacle key resolves to
       * `SUPERSEDED_EVIDENCE_KEY`, drawn by the component through this surface's
       * reapply-obstacle wrapper (`tSupersededEvidence` itself has no caller).
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
       * 8 and 11). A reapply hands back a session whose ordinary request is live,
       * and one rebuilt over the adopted snapshot would carry no record of the
       * wait; so it is refused before any evidence is read. Rendered through the
       * retained notice's own sentence.
       */
      readonly kind: 'observationRetained';
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
 * **The four external-origin arms reuse sentences that already exist** (Phase
 * 2d-6-4), each through its own key function so a renamed key is a compile error
 * there and here at once; the terminus is `never`, so an arm with no key is one
 * too. No sentence of this module's own was added.
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
} // End of function deletionReapplyObstacleKey()

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
function unaskedGuard(conflict: ConflictModel<MatchId> | null): StandingOriginGuard {
  const source: ConflictSource | null = conflict === null ? null : conflict.source;
  return (): ConflictSource | null => source;
} // End of function unaskedGuard()

/**
 * The snippet one conflict's evidence names for this deletion, or why it names
 * none — the origin switch of {@link reapplyToDiskVersion}, Phase 2d-6-4.
 *
 * **Four arms in, and each has its own answer** (the 2d-6 record's §3 entry 19).
 * Save evidence is read through `subjectCorrespondence`, as it always was. An
 * external table is searched through `correspondenceRowFor` for this session's
 * **full** base identity — document, base revision and node, never an array index
 * and never the node alone (entry 20) — and the found row's `exact` tier is read
 * through `subjectResolution`, exactly once: a destructive operation takes the
 * strict tier, and the flexible `editor` tier is not looked at. A refused table
 * or row resolves to manual resolution with `tExternalEvidenceRefusal`'s
 * sentence, superseded evidence with `tSupersededEvidence`'s (entry 22). Nothing
 * here is cast: a row is a row and a `ReapplyEvidence` is a `ReapplyEvidence`.
 *
 * @param evidence - What `enterReapply` found the conflict's origin to offer.
 * @param base - This session's snippet, by the identity the base snapshot minted.
 * @returns The subject to work from, or the manual resolution to answer with.
 */
function subjectOfEvidence(
  evidence: ReapplyEvidenceAccess,
  base: MatchId
): SubjectCorrespondence | Extract<MatchDeletionReapply, { kind: 'manualResolution' }> {
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
      // not looked at for a deletion.
      return subjectResolution(row.entry.exact);
    }
    case 'refused':
      return {
        kind: 'manualResolution',
        obstacle: { kind: 'externalEvidence', reason: evidence.reason }
      };
    case 'superseded':
      return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
    default: {
      const unreachable: never = evidence;
      return unreachable;
    }
  }
} // End of function subjectOfEvidence()

/**
 * Reissues this deletion against the newly parsed disk version.
 *
 * **Strict exact correspondence and nothing weaker**, which is the consult's Q4:
 * *a unique trigger is not enough to delete a snippet whose contents changed after
 * the person reviewed it*. The tier is 2c-4b-1's and is chosen by the command that
 * built the question — `delete_match` asks for `ExactItem` — so an identified
 * subject here is a snippet whose own owned lines are byte-for-byte what this
 * session was about. **The external origin takes the same tier**, off the table's
 * row for this session's full base identity (the 2d-6 record's §3 entry 20), read
 * through {@link subjectOfEvidence}.
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
 * **Both origins since Phase 2d-6-4, through one entry** (entries 19, 20 and 22):
 * `enterReapply` in `./reapply.ts` answers `reapplyEvidenceFor`'s four arms and
 * {@link subjectOfEvidence} switches over them. **Two refusals come before the
 * entry, so a blocked session reads no evidence at all** (this phase's review,
 * its fourth finding — the entry reads the observation's table): an
 * unacknowledged write uncertainty (entry 22 — a reapply ends in an adoption,
 * which the uncertainty withholds, so adoption may not be obtained here
 * indirectly) and a reading the window holds undecided (entry 8 — a session
 * rebuilt over the adopted snapshot would carry no record of the wait, and the
 * blocked request would go through it). The view withholds the control through
 * the same facts; these are the rules for a call made past it.
 *
 * **The two blocks and the conflict's identity are asked again of the installed
 * session, once, immediately before the adoption** (this phase's review, its
 * third finding): every read between the entry and the door — the table's rows,
 * the row's tier, the disk projection `startMatchDeletion` walks — is a read of
 * caller data, and a getter there can tell the window of a reading, whose
 * receiver records a wait, an uncertainty or a new conflict on the installed
 * session. The session handed in cannot see that; the one `current` reads can.
 * So the adoption is refused `observationRetained` or `writeOutcomeUnknown` when
 * the installed session now carries either, and `supersededEvidence` when the
 * conflict it shows is no longer the one being reapplied; otherwise the rebuilt
 * session carries the installed session's waits forward (the **settled** one's since 2d-6-7a, below), for `rebuiltOver`'s
 * reason in `./matchEditor.ts` — its own file's entry is absent, because the
 * recheck comes first, and the map is carried so a wait about another file
 * survives the rebuild. The reader is required (Phase 2d-6-6a); one that
 * answers a capture rather than the installed session asks the recheck of that
 * capture, and a wait recorded on the installed one during the reads is lost
 * with the rebuilt session ({@link ReadTheInstalledSession}).
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
 * **The standing-origin guard is a parameter, and `null` is accepted for one
 * stated reason** — `reapplyToDiskVersion` in `./matchEditor.ts`'s:
 * `MatchDeleter.svelte` has handed the live
 * `BrowserState.standingConflictFor` closure down since Phase 2d-6-6b and passes
 * no `null`, and the parameter stays nullable. It is
 * nullable rather than defaulted since Phase 2d-6-6a, so that the required reader
 * can follow it and a caller states that it asks nothing. When no guard is handed
 * in the supersession question is not asked here; what still refuses a
 * superseded origin on that path is `adoptDiskVersion`'s fourth check, at the
 * door, answered `adoptionRefused` without the typed sentence. An omitted guard
 * costs a sentence and some work, never a wrong installation.
 *
 * @param session - The session showing the conflict.
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
  session: MatchDeletionSession,
  adopt: AdoptTheDiskVersion<MatchId>,
  standing: StandingOriginGuard | null,
  current: ReadTheInstalledSession
): MatchDeletionReapply {
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
  }
  const entry = enterReapply(CONFLICT_CAPABILITIES, conflict, standing ?? unaskedGuard(conflict));
  if (entry.kind !== 'ready') {
    return entry;
  }
  const subject = subjectOfEvidence(entry.evidence, session.match);
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
  const fresh = startMatchDeletion(entry.conflict.disk, subject.target);
  if (fresh.eligibility.kind !== 'deletable') {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'notDeletable', reason: fresh.eligibility.reason }
    };
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
  const result: MatchDeletionReapply = {
    kind: 'reapplied',
    session: { ...fresh, awaitingReconciliation: waiting }
  };
  // **Built first, then one last look at the installed session**: every read of
  // the settled session above is caller data, and a session displaced during
  // them is not rebuilt over; nothing caller-controlled runs after the look.
  if (current() !== settled) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  return result;
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

/**
 * What this surface offers about the conflict it is showing **now**, derived from
 * the declaration and two facts about the session — Phase 2d-6-4, the 2d-6
 * record's §3 entry 11.
 *
 * The declaration above is permanent; this is the "effective capabilities" the
 * consult's Q3 names. The reload and the reapply are both withheld under an
 * unacknowledged write uncertainty, for the match editor's reason. The reapply
 * alone is withheld while the window holds an undecided reading, because it
 * hands back a session whose ordinary request is live; the reload is not,
 * because it closes the session and sends nothing. It feeds `conflictChoicesFor`,
 * which stays the only producer of a choice list; what this cannot force is that
 * the transitions honour the same facts, which is why each asks
 * {@link reloadableConflictOf} or the fields themselves.
 *
 * @param session - The session to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: MatchDeletionSession): ConflictCapabilities {
  const reloadWithheld = session.uncertaintyUnresolved;
  const reapplyWithheld = reloadWithheld || awaitedFor(session) !== null;
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
function externalNoticesOf(session: MatchDeletionSession): readonly ExternalConflictNotice[] {
  const notices: ExternalConflictNotice[] = [];
  if (session.externalConflict !== null && session.uncertaintyUnresolved) {
    notices.push({ kind: 'writeOutcomeUnknown' });
  }
  if (awaitedFor(session) !== null) {
    notices.push({ kind: 'observationRetained' });
  }
  return notices;
} // End of function externalNoticesOf()

/** Everything a screen needs about one deletion, derived on every read. */
export interface MatchDeletionView {
  /** The snippet this is about. */
  readonly match: MatchId;
  /**
   * Whether the delete control does anything.
   *
   * `false` under an external conflict and while the window holds an undecided
   * reading of the file too (Phase 2d-6-4), with no code of its own: this
   * surface's refusal codes are about the snippet, and why the control is off is
   * said by {@link MatchDeletionView.externalMessages} and
   * {@link MatchDeletionView.externalNotices}.
   */
  readonly canDelete: boolean;
  /** Why the snippet may not be deleted at all, as a code, or `null`. */
  readonly refusal: DeletionRefusal | null;
  /** Whether the person has been asked and has not answered. */
  readonly confirming: boolean;
  /**
   * Whether answering the question with *Delete it* can send anything — Phase
   * 2d-6-7b.
   *
   * `false` while no question is pending, and `false` while one is pending but
   * {@link canRequestDelete} refuses: a held reading of the file withdraws no
   * question (the 2d-6 record's §3 entry 11's `retained` row) and still blocks the
   * send (entry 8), so without this the panel offered a live control that
   * {@link confirmDelete} answered `null` to — drawn as the stale-reading
   * sentence, which is false of a reading nobody installed. Why it is off is said
   * by {@link MatchDeletionView.externalNotices}. **What this cannot force** is
   * that a panel reads it; `confirmDelete` refuses either way.
   */
  readonly canConfirm: boolean;
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
   * The external conflict's own lines, or none — Phase 2d-6-4.
   *
   * Beside {@link MatchDeletionView.messages} and never merged into it, for
   * `MatchEditorView.externalMessages`'s reason: a panel drawing `view.conflict`
   * outside the save-outcome branch (the 2d-6 record's §3 entry 10) draws nothing
   * twice. Rendered through `tConflictMessage`; `MatchDeleter.svelte` draws it
   * since Phase 2d-6-7b.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * The lines owed while an observation cannot be acted on — Phase 2d-6-4.
   *
   * `writeOutcomeUnknown` first, `observationRetained` second, from the session's
   * own fields. Since Phase 2d-6-9b-2 no renderer draws them as sentences: the pane's
   * `FileReconciliationStatus.svelte` block says both states once, above the panel,
   * and `MatchDeleter.svelte` reads this list only through `surfaceAcknowledgementOwed` in
   * `./reconciliationStatus.ts`, to decide whether to draw the acknowledgement.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
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
  /** The conflict being shown, of either origin, or `null`. */
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
      : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload));
  const externallyBlocked = session.externalConflict !== null || awaitedFor(session) !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
  return {
    match: session.match,
    canDelete: canRequestDelete(session),
    refusal: session.eligibility.kind === 'refused' ? session.eligibility.reason : null,
    confirming: session.pending !== null,
    canConfirm: session.pending !== null && canRequestDelete(session),
    deleting: session.phase === 'saving',
    deleted: session.deleted,
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: externalNoticesOf(session),
    notes: saved === null ? [] : saved.notes,
    // The one offer a refusal panel may keep under an external block is the
    // dismissal: *Save anyway* re-asks the question and `requestDelete` would
    // answer the same session to it, and a control that does nothing when
    // pressed is the defect `conflictChoicesFor` exists to stop.
    refusalChoices: externallyBlocked
      ? refusalChoices.filter((choice) => choice === 'keepEditing')
      : refusalChoices,
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
