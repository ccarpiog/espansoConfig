/**
 * Duplicating one snippet in place: the whole operation as a value.
 *
 * **Every decision lives here and the component decides nothing.** This is the
 * same arrangement `./matchMove.ts`, `./matchCreation.ts` and
 * `./matchDeletion.ts` are in: the rules live where a test can drive them, and
 * `MatchDuplicator.svelte` — added in step 3 — is a rule-free walk over
 * {@link MatchDuplicationView}. The standing reason, and it is narrower than
 * "markup cannot be tested": a **model** test drives values and never markup, so
 * a rule written into one renderer is a rule that renderer's own mounted suite
 * has to carry alone, and a second renderer — or a harmless-looking refactor of
 * the first — can omit it while walking the model faithfully. That, not
 * untestability, is the architectural problem. `MatchDuplicator.test.ts` does
 * mount this panel and does check it; it opts into jsdom by its docblock, as
 * `docs/decisions/2c-split-notes.md` section 7 allows and the six components
 * before `RawEditor.svelte` deliberately do not. What the split buys is that the
 * decision is owned here, where every renderer shares it and this file's suite
 * drives it.
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
 * **every** `MatchId` in the file, so a draft held for *any* snippet of the
 * file — not only the source — would be stranded by the commit. The
 * coordinator supplies that fact as a boolean it computed from what it owns,
 * rather than this module trying to follow a `{document, node}` pair across a
 * reparse — the hole `moveEligibility`'s `unsavedDraft` arm records is not
 * repeated here, it is designed out by asking a wider question the caller can
 * answer honestly (consult Q6). {@link documentHasUnsavedDraft} is the producer
 * step 3 wired behind it, kept in this module for the same reason everything
 * else is. **Nothing in TypeScript can check the boolean was computed rather
 * than invented**; it is required and undefaulted so a caller that did not look
 * cannot compile silence into "there are none".
 *
 * **What that boolean measures is an *open* editor, never a *dirty* one**, and
 * the name is broader than the fact on purpose (R36). No coordinator can see
 * `isDirty`, because it is derived inside `MatchEditor.svelte`'s own session, so
 * the honest producer answers *a snippet of this file is open in the editor*.
 * The refusal's sentence says exactly that and claims no edits — a sentence
 * asserting unsaved changes would be false of every pristine editor, which is
 * the defect step 3's review found in it.
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
 * **The precedence is carried all the way into what a screen draws**, which is
 * step 3's Medium finding: ranking `outOfDate` above `notDuplicable` inside
 * `refusalGiven` suppresses nothing if the frozen reason is still handed to the
 * screen through a second field, and until this was fixed the only thing
 * keeping the two apart was a condition written in `MatchDuplicator.svelte`.
 * {@link MatchDuplicationView.notDuplicableToShow} is the presentation-ready
 * answer — a component renders it and asks nothing else — and the raw frozen
 * verdict stays on {@link MatchDuplicationSession.eligibility} for a caller
 * that wants the fact rather than the sentence.
 *
 * ## What spends a session, and what dismissal does not clear
 *
 * Four sticky facts, each or-ed into and cleared by **nothing**:
 * {@link MatchDuplicationSession.duplicated} — a commit happened through this
 * session; {@link MatchDuplicationSession.invalidated} — the projection these
 * identities came from has been replaced (a committed save, an adoption the
 * wrapper owed at all, or a recovery re-read that failed); and
 * {@link MatchDuplicationSession.mayHaveWritten} — a send this application
 * cannot account for. {@link dismissDuplicationOutcome} clears the panel, not
 * those facts. A `committed: false` whose adoption was not owed replaced
 * nothing and spends nothing — practically unreachable for an insertion, and
 * the arm is honest rather than hopeful.
 *
 * **A conflict is not one of them, and 2c-4a-2 is where that changed.** The
 * wrapper used to install the projection a conflict carries on `disk` while
 * reporting `adoption: notOwed`, so the arm was the evidence; the consult's Q2
 * ruled that install a defect and it installs nothing now, so the panel refuses
 * only **while the conflict is showing** and dismissing it hands the session
 * back. The file is what has not changed, so a resend carrying the frozen base
 * revision is **refused** — and 2c-4a-2's review is why that refusal is named
 * carefully: `conflict_after_the_lock` refreshed the Rust workspace cache when it
 * produced the conflict, so `duplicate_match`'s leading `view_at` answers
 * `identityStaleRevision` before the locked check is reached. Write-safe either
 * way; a different sentence on screen.
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
 * is what a caller uses *instead*, and a component must derive the view, the
 * eligibility and the submission identity from **one synchronous projection
 * read** — which `MatchDuplicator.svelte` does, exactly as `MatchMover.svelte`
 * does, and which nothing in this file can require. Nor can anything
 * here stop a component importing `duplicateMatch` from `../ipc/commands` and
 * calling it with no session at all — the hole every writing command has had
 * since 2b-2a.
 *
 * ## The external session — Phase 2d-6-4
 *
 * The shape `./matchEditor.ts` took at 2d-6-2 and `./matchDeletion.ts` takes in
 * the same phase, for a duplicate. {@link MatchDuplicationSession.externalConflict}
 * is the conflict a watcher observation raised over the file this session is
 * about, a field beside `outcome` and never an arm of it (the 2d-6 record's §3
 * entry 6); {@link applyDuplicationObservation} is the session's receiver as a
 * value, one named action per verdict arm and a `never` terminus (entry 11);
 * {@link conflictOf} answers the conflict shown whichever origin it has, and
 * `refusalGiven` — the one rule {@link duplicationSubmissionRefusal} and
 * {@link beginDuplicate} both ask — answers `externalConflict` for it and
 * `observationRetained` for a held reading
 * ({@link MatchDuplicationSession.awaitingReconciliation}), so a direct call past
 * a disabled control answers `null` (entry 8), asked after the live identity has
 * been read. A conflict raised under an unknown write outcome
 * ({@link MatchDuplicationSession.uncertaintyUnresolved}) withholds the reload and
 * refuses the reapply until {@link acknowledgeDuplicationSnapshot} is told the
 * hold ended (entries 11, 22); {@link dismissDuplicationOutcome} erases none of
 * the three (entry 9). A replacing verdict resets the reload step and, by
 * answering a new session, invalidates a displayed reapply result (entry 12); a
 * duplicate has no pending confirmation to withdraw, because it asks none
 * (consult Q7 for the move, applied here).
 *
 * **The reapply reads both origins through one entry** — `enterReapply` in
 * `./reapply.ts` — and takes the snippet from an external table by its **full**
 * base identity through `correspondenceRowFor`, reading the row's `exact` tier
 * through `subjectResolution` (entries 19, 20 and 22): the clone must be of the
 * newly adopted item's own bytes, so the flexible tier is never enough. A refused
 * table or row resolves to manual resolution with `tExternalEvidenceRefusal`'s
 * sentence, superseded evidence with `tSupersededEvidence`'s.
 *
 * **The door and every settling transition can read the installed session**
 * through a {@link ReadTheInstalledSession} (this phase's review): a
 * caller-controlled read — `projected`, a table row, the disk projection, an
 * observation being replayed — runs arbitrary code, and a receiver run from it
 * replaces the installed session behind the transition's back. {@link beginDuplicate}
 * spends only against the session it was handed while that is still installed;
 * {@link reapplyToDiskVersion} rechecks the installed session's blocks and
 * conflict immediately before adopting; {@link applyDuplication} and
 * {@link duplicationCouldNotBeSent} replay what the receiver appended during their own
 * replay. The reader is optional while no component passes one, and its doc says
 * what that costs.
 *
 * **The door and every settling transition can read the installed session**
 * through a {@link ReadTheInstalledSession} (this phase's review): a
 * caller-controlled read — `projected`, a table row, the disk projection, an
 * observation being replayed — runs arbitrary code, and a receiver run from it
 * replaces the installed session behind the transition's back. {@link beginDuplicate}
 * spends only against the session it was handed while that is still installed;
 * {@link reapplyToDiskVersion} rechecks the installed session's blocks and
 * conflict immediately before adopting; {@link applyDuplication} and
 * {@link duplicationCouldNotBeSent} replay what the receiver appended during their own
 * replay. The reader is optional while no component passes one, and its doc says
 * what that costs.
 *
 * **No component registers this receiver yet.** 2d-6-6 wires
 * `BrowserState.registerObservationReceiver` to it through `DetailPane`; until
 * then every case that drives it is a model test, and `MatchDuplicator.svelte`
 * draws neither the external conflict nor the two notices (2d-6-7's).
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
import { identityInProjection, plainIdentity } from './matchDeletion';
import type { AcknowledgeTheUncertainty } from './matchEditor';
import { sequenceOf, type SequenceAddress } from './matchMove';
import type { RawSaveChoice } from './rawSave';
import type { ConflictSource, ExternalConflictObservation } from './conflictSource';
import {
  externalConflictNoticeKey,
  type ExternalConflictNotice,
  type ObservationDelivery
} from './observationDelivery';
import {
  adoptForReapply,
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
   * A match editor is open over **some snippet of this file**.
   *
   * **The name is broader than what is measured, and deliberately so.** What
   * {@link documentHasUnsavedDraft} answers is that an editor is *open*, never
   * that it is *dirty* — no coordinator can see `isDirty` in `./draft.ts`,
   * because it is derived inside `MatchEditor.svelte`'s own session (R36). The
   * name is kept because the *risk* it names is the unsaved edits such an
   * editor may hold; the sentence
   * `browser.matchDuplication.refused.unsavedDraftInDocument` renders is
   * therefore written to claim an open editor and no more.
   *
   * Document-wide on purpose, and this application's workflow policy rather
   * than the core's rule: a committed duplicate invalidates every `MatchId` in
   * the file, so a draft for any snippet in it would be stranded, not only a
   * draft for the source. See this module's header.
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
 * Whether this window has a match editor open over any snippet of one file.
 *
 * **The producer of {@link duplicationEligibility}'s third argument**, which
 * step 2 deliberately left without one so the debt stayed visible
 * (`docs/decisions/2c-3c-2-notes.md` section 4, hole 3). It lives here rather
 * than in a component because a rule written into one renderer's markup is a
 * rule no model test can drive and a second renderer can omit — the mounted
 * suite of the renderer that has it is real cover, but it is cover for that one
 * file — and it takes the open drafts as an argument rather than reading them,
 * because the surfaces that hold them are Svelte components and this directory
 * is what a test can reach.
 *
 * **Only the file is compared, and that is the point.** A draft minted over an
 * *earlier* parse of the same file is stranded by a commit exactly as a current
 * one is — the new revision invalidates every `MatchId` in the file — so
 * comparing the whole identity would let the very draft this rule protects slip
 * through. That is also why the consult made the fact document-wide instead of
 * a `{document, node}` pair nothing can follow across a reparse (Q6).
 *
 * **It answers "a draft is open", not "a draft is dirty", and the difference is
 * a deliberate over-refusal.** `isDirty` in `./draft.ts` is derived inside the
 * editor's own session, which lives in `MatchEditor.svelte`, so no coordinator
 * can see it — the same R36 reasoning `DetailPane.svelte`'s `unsavedDraftFor`
 * records for a move. Over-refusing costs a person one closed editor;
 * under-refusing strands their edits. **`true` for a pristine editor is
 * therefore correct rather than a bug**, and the sentence the refusal renders
 * is written to be true of that case: it says a snippet of this file is open in
 * the editor and that this application cannot tell whether it has been edited,
 * never that unsaved edits exist. Step 3's review found the older sentence
 * claiming the latter, which no test can fail because a sentence is data.
 *
 * **What it does not cover, in the same sentence as what it does**: a
 * whole-document raw draft is not a match draft and is not counted here —
 * widening the rule to the raw editor would need its own sentence rather than a
 * silently broadened predicate. Nothing in TypeScript can check that a caller
 * passes every editor it holds open, either; the argument being required is what
 * stops silence compiling into "there are none".
 *
 * @param document - The file a duplicate would be written to.
 * @param drafts - The identity of every snippet this window has a match editor
 *   open over, in any order. Every one of them, dirty or not.
 * @returns `true` when at least one of those editors is open over that file.
 */
export function documentHasUnsavedDraft(
  document: DocumentId,
  drafts: readonly MatchId[]
): boolean {
  return drafts.some((draft) => draft.document === document);
} // End of function documentHasUnsavedDraft()

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
 * @param unsavedDraftInDocument - Whether this window has a match editor open
 *   over **any** snippet of that file, dirty or not — see
 *   {@link documentHasUnsavedDraft} for why the open editor and not the dirty
 *   one is what can honestly be measured. **Required and not defaulted**: a
 *   default would be this function inventing "there are none" for a caller that
 *   simply did not look — and only the coordinator that owns the open editors
 *   can answer it.
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
   * How far a confirmed reload of the disk version has got.
   *
   * **Reset to `idle` by every new outcome, by every dismissal and by every
   * replacing verdict** ({@link applyDuplicationObservation}, the 2d-6 record's
   * §3 entry 12), which is what stops a confirmation collected for one conflict
   * from being spendable while a later one is on screen. The window refuses a
   * spent confirmation too, but this is the guard that means the situation never
   * arises.
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
   * **A field of its own beside {@link MatchDuplicationSession.outcome}, never an
   * arm of it**, for `MatchEditorSession.externalConflict`'s reason: an outcome is
   * how *a duplicate* ended, and a conflict the watcher raised is not that.
   * {@link conflictOf} is the one accessor that reads both and answers the
   * conflict this session is showing, whichever origin it has. **Only one conflict
   * is active at a time, and the transitions are what keep it so** (entry 7):
   * {@link applyDuplicationObservation} retires a save conflict's outcome when it
   * sets this, and {@link applyDuplication} retires this when a duplicate ends as
   * a conflict or a success. The type admits both populated, and a session built
   * by hand with both gets {@link conflictOf}'s stated precedence, not a
   * guarantee.
   *
   * While it is non-null nothing can be sent — `refusalGiven` answers
   * `externalConflict` — and {@link dismissDuplicationOutcome} does not clear it
   * (entry 9). The ways out are the reload and the reapply. **It does not spend
   * the session**: the identities this session holds are still the ones the
   * window is projecting, exactly as they are under a save conflict.
   */
  readonly externalConflict: ExternalConflictModel<MatchId> | null;
  /**
   * Whether {@link MatchDuplicationSession.externalConflict} was raised while a
   * write of this window's own had an unknown outcome, and this session has not
   * been told the hold ended — Phase 2d-6-4, entry 11's `raisedWithoutReload` row.
   *
   * While `true` the ordinary reload is withheld and the reapply refused, for the
   * match editor's reason: a confirmed installation of bytes a write of this
   * window may or may not have produced would settle, silently, a question only
   * the person can. It ends when {@link acknowledgeDuplicationSnapshot} is told
   * the window ended the hold, or when a later verdict replaces the conflict
   * under no uncertainty. **It records what this session was told and nothing
   * more**: a hold the window ends by a later definite write delivers nothing to
   * a session, and this flag cannot see it. This module never sets it without a
   * conflict, so the send is blocked by the conflict it qualifies.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations this session was told the window is holding and has not
   * decided about, keyed by the file each is about — Phase 2d-6-4, entry 11's
   * `retained` row, in the shape 2d-6-3's review gave the creator.
   *
   * **A restriction on sending and nothing else**: while this session's own file
   * has an entry, `refusalGiven` answers `observationRetained` and
   * {@link beginDuplicate} answers `null` (entry 8); no disk comparison and no
   * origin is recorded. An entry is lifted by the delivery that decides **that**
   * observation, whatever the verdict — `writtenHere` included — compared by
   * identity, and replaced by a later `retained` about the same file.
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
   * recorded at all; both are facts about registration, which is 2d-6-6's. What
   * it cannot see is a reading the barrier coalesced away without announcing it.
   */
  readonly awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>;
  /**
   * Every delivery that arrived while this session's own duplicate was in flight,
   * in the order it arrived, kept until that duplicate's answer has been applied —
   * Phase 2d-6-4, the 2d-6 record's §3 entry 5.
   *
   * `MatchEditorSession.heldDeliveries`'s rule, unchanged: the window publishes a
   * write's settlement from inside the writing wrapper, before the `await` that
   * started it resumes, so {@link applyDuplicationObservation} appends here while
   * the phase is `saving` and {@link applyDuplication} and
   * {@link duplicationCouldNotBeSent} replay the whole list through it, first to
   * last, after their own answer — and, given a {@link ReadTheInstalledSession},
   * whatever the receiver appended to the installed session while they were
   * doing so. **What the list forces** is that no envelope delivered during the
   * duplicate is dropped and that first-to-last is the order; **what it does not
   * force** is that arrival order was decision order — the window's own contract
   * — nor that a caller passes the reader: this module has no send composition,
   * so the caller hands the settling transition the session it holds and the
   * reader that answers it, as 2d-6-6's `MatchDuplicator.svelte` must, and
   * nothing in TypeScript stops a caller handing it a capture and no reader.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
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
   * **A second fact, because it is a second fact.** Three producers:
   * {@link applyDuplication} sets it from a committed save and from an adoption
   * `BrowserState.duplicateMatch` owed at all — so it is set whenever that
   * wrapper re-read the file, whether or not the duplicate committed; and
   * {@link duplicationRecoveryFailed} sets it **without** a replacement, from
   * a recovery re-read that failed — there the projection is still installed
   * and what happened is that the command contradicted this session's identity
   * and the window then could not obtain a better one. Cleared by nothing.
   *
   * **A conflict was a fourth producer until 2c-4a-2**, because the wrapper
   * installed the projection the conflict carried while reporting
   * `adoption: notOwed`. It installs nothing now (consult Q2), so invalidation
   * follows actual projection adoption and a conflict is not one.
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
 * @param unsavedDraftInDocument - Whether this window has a match editor open
 *   over any snippet of that file, dirty or not. Required, for
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
    reload: NOT_RELOADING,
    closed: false,
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    heldDeliveries: [],
    duplicated: false,
    invalidated: false,
    mayHaveWritten: false,
    landed: null
  };
} // End of function startMatchDuplication()

/**
 * The wait that restricts this session **now**, or `null` — its own file's entry
 * of {@link MatchDuplicationSession.awaitingReconciliation}.
 *
 * @param session - The session to ask about.
 * @returns The observation the session is waiting on, or `null`.
 */
function awaitedFor(session: MatchDuplicationSession): ExternalConflictObservation | null {
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
 * for one this module built, because {@link applyDuplicationObservation} and
 * {@link applyDuplication} keep the two exclusive (the 2d-6 record's §3 entry 7).
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: MatchDuplicationSession): ConflictModel<MatchId> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
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
  /**
   * A watcher observation raised a conflict over the file, and it has not been
   * resolved — Phase 2d-6-4, the 2d-6 record's §3 entry 8.
   *
   * A code of its own rather than `conflict`, because that code's sentence says
   * the file changed *while this duplicate was being sent*, which is false of an
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
  if (session.externalConflict !== null) {
    return 'externalConflict';
  }
  if (conflictArm(session.outcome) !== null) {
    return 'conflict';
  }
  if (awaitedFor(session) !== null) {
    return 'observationRetained';
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
  return !session.closed && duplicationSubmissionRefusal(session, views) === null;
} // End of function canDuplicate()

/**
 * Reads the session a caller currently holds — the one its registered receiver
 * has been updating — for the door or a settling transition to check against.
 *
 * `ReadTheInstalledSession` in `./matchDeletion.ts`, for this session, and for
 * the reason stated there (this phase's review, its first, second and third
 * findings, one class): a caller-controlled operand is read through property
 * access, a property read runs arbitrary code, and a receiver run from it can
 * replace the installed session with one carrying a block that a check on the
 * session handed in would never see. {@link beginDuplicate} reads it once after
 * the last `projected` read and spends only against the session it was handed
 * while that is still the one installed; {@link reapplyToDiskVersion} rechecks it
 * once immediately before adopting; {@link applyDuplication} and
 * {@link duplicationCouldNotBeSent} replay whatever the receiver appended to it
 * during their own replay. **What it cannot force**: that a caller supplies one —
 * the parameter is optional so that `MatchDuplicator.svelte`, which this phase
 * may not touch and which registers no receiver today, keeps compiling, and a
 * caller that registers a receiver and passes no reader gets the displaced check
 * and the lost delivery this closes; 2d-6-6 must pass `() => session` at every
 * door and may make the parameter required. Nor that the closure reads the
 * installed session rather than a capture.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => MatchDuplicationSession;

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
 * **The submission block is asked after the last caller-controlled read, and
 * against the installed session** (Phase 2d-6-4, the 2d-6 record's §3 entry 8
 * and R37; this phase's review, its first finding): `projected` is read and
 * compared first; then the installed session is read through `current`, once;
 * and only a session that is still the one handed in and passes `refusalGiven` —
 * which answers `externalConflict` and `observationRetained` beside the ordinary
 * arms — spends, so a receiver run from a getter behind `projected` is seen by
 * the block rather than overwritten by the spend. A call made past a disabled
 * control answers `null` here, exactly as the view withholds it. What no type
 * forces is that a caller passes a reader ({@link ReadTheInstalledSession}).
 *
 * @param session - The session to send from.
 * @param projected - The identity the projection this window holds **now**
 *   gives the snippet, or `null` when it holds no such snippet any more.
 *   Required, and nullable rather than defaulted: a default would be this
 *   function inventing agreement for a caller that did not look.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   checks the block on the session handed in — honest only for a caller that
 *   registers no receiver, which is every caller today.
 * @returns The waiting session and what the command takes, or `null`.
 */
export function beginDuplicate(
  session: MatchDuplicationSession,
  projected: MatchId | null,
  current: ReadTheInstalledSession | null = null
): StartedDuplication | null {
  const live =
    projected !== null &&
    sameIdentity(projected, session.match) &&
    sameIdentity(projected, session.draft.value);
  // **The installed session, read once, after the last caller-controlled read.**
  // A receiver run from a getter above has replaced it; a session that is no
  // longer the one installed spends nothing.
  const installed = current === null ? session : current();
  // **A closed session sends nothing.** A confirmed reload adopted the disk
  // projection and ended this panel, so its identities describe a parse the window
  // has crossed away from. No refusal *code* is added for it, and that is
  // deliberate: a code is a sentence on a screen, and a closed panel is not on one.
  if (installed !== session || session.closed || refusalGiven(session, live) !== null) {
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
 * the session on its own. **A conflict does not, and 2c-4a-2 is where that
 * changed**, exactly as it is for a move: the wrapper used to install the
 * projection the conflict carries on `disk` while reporting
 * `adoption: notOwed`, so the arm was the only evidence there was. The
 * consult's Q2 ruled that eager install a defect — a conflict writes nothing
 * and now replaces nothing — so the identities this session holds are still
 * the ones the window is projecting, and invalidation follows **actual
 * projection adoption**. Nothing here can check that the caller really left
 * its projection alone, any more than it could check the opposite before.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.**
 * The clone really is in the file; telling the person the duplicate failed
 * would invite a retry of a write that already happened (`PROGRESS.md` D2).
 *
 * **What it does about an external conflict, and about a delivery held during
 * the duplicate** — Phase 2d-6-4, `applySave`'s rule in `./matchEditor.ts`. A
 * `saved` or a `conflict` answer retires
 * {@link MatchDuplicationSession.externalConflict} (the 2d-6 record's §3 entry
 * 7: the duplicate's own answer is the newer fact about the file); a `refused`
 * answer wrote nothing and leaves it standing. Neither is reachable from
 * {@link beginDuplicate} while an external conflict stands, so this keeps the
 * invariant for a caller that drove the model directly. Then, whatever the
 * answer, every delivery {@link applyDuplicationObservation} held while the
 * duplicate was in flight is replayed on top, in arrival order (entry 5) — **and,
 * with a reader supplied, every delivery the receiver appended to the installed
 * session during this transition's own reads and replay** (this phase's review,
 * its second finding; `applyDeletion` in `./matchDeletion.ts` says why a replay
 * runs caller code and what a missing reader costs). This module composes no
 * send, so `MatchDuplicator.svelte` settles its live `session` after its own
 * `await` and, from 2d-6-6, hands the reader beside it.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from
 *   `BrowserState.duplicateMatch`. Required and not defaulted: a default would
 *   be this function inventing a `notOwed` for a caller that simply did not
 *   look — and since a `notOwed` is what keeps the session usable, that
 *   invention would be the defect rather than a shortcut.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   replays only what the session handed in holds.
 * @returns The session showing what the duplicate ended as.
 */
export function applyDuplication(
  session: MatchDuplicationSession,
  result: SaveResult,
  adoption: InvalidationStatus,
  current: ReadTheInstalledSession | null = null
): MatchDuplicationSession {
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
  // second, and the second does not imply the first. Both are `session.<flag> ||`
  // and neither is a plain assignment, so "cleared by nothing" is what the code
  // does: a second answer handed to a session that has already committed cannot
  // take the commit back. **A conflict is not a third producer, and it was until
  // 2c-4a-2** — the wrapper installed the projection the conflict carried and
  // reported `notOwed` for it, so the arm was the only evidence; it installs
  // nothing now. See this function's JSDoc.
  const committed = result.outcome === 'saved' && result.committed;
  const duplicated = session.duplicated || committed;
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
      duplicated,
      invalidated,
      landed: result.moved,
      draft: savedDraft(session.draft, submission, result.revision),
      phase: 'editing',
      outcome,
      extraMessages,
      reload: NOT_RELOADING,
      sendFailure: null,
      // The duplicate ended on the file, so the disk side an earlier observation
      // showed is no longer the comparison to draw (entry 7).
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    current
  );
} // End of function applyDuplication()

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
 * Replays every delivery a session held during its duplicate, in the order it
 * arrived, once the duplicate's own answer is on it — the 2d-6 record's §3
 * entry 5 — and then every delivery the receiver appended to the installed
 * session while that was happening (this phase's review, its second finding).
 *
 * `consumingHeldDeliveries` in `./matchDeletion.ts`, for this session, which
 * says why a replay runs caller code and what the extra round forces and cannot:
 * each envelope goes through {@link applyDuplicationObservation} exactly as it
 * would have on arrival, applied to the session the one before it left; after
 * each round the installed session is read once and the envelopes it holds
 * beyond the ones replayed are replayed too, in arrival order, until a read finds
 * none; a list that is not an extension of the one replayed is left alone, and a
 * getter that manufactures a fresh reading on every read does not come to rest.
 *
 * @param settled - The session with its duplicate's answer applied and its
 *   phase back to `editing`.
 * @param current - Reads the session the caller holds now, or `null`.
 * @returns The session with every held delivery applied, or the same session
 *   when none was held.
 */
function consumingHeldDeliveries(
  settled: MatchDuplicationSession,
  current: ReadTheInstalledSession | null
): MatchDuplicationSession {
  let queue = settled.heldDeliveries;
  let replayed: MatchDuplicationSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyDuplicationObservation(replayed, queue[at]!);
    } // End of the loop over the deliveries not yet replayed
    seen = queue.length;
    if (current === null) {
      return replayed;
    }
    const arrived = current().heldDeliveries;
    if (arrived.length <= seen || !extendsTheReplayed(arrived, queue)) {
      return replayed;
    }
    queue = arrived;
  } // End of the loop over the rounds of replay
} // End of function consumingHeldDeliveries()

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
 * The duplicate is over, so a delivery held while it was out is applied now: the
 * settlement of an uncertain write arbitrates the held reading under that
 * uncertainty, and its `raisedWithoutReload` is what this applies (entry 5), and
 * with a reader every delivery appended to the installed session during the
 * replay is applied too, for {@link applyDuplication}'s reason.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param mayHaveWritten - Whether the file may already hold the clone.
 * @param reason - Why the command rejected, or `null` when nothing was sent
 *   and the boundary therefore has no rejection to hand on.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   replays only what the session handed in holds.
 * @returns The session, back to its resting state, with the right notice
 *   raised.
 */
export function duplicationCouldNotBeSent(
  session: MatchDuplicationSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null,
  current: ReadTheInstalledSession | null = null
): MatchDuplicationSession {
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      mayHaveWritten: session.mayHaveWritten || mayHaveWritten,
      sendFailure: sendFailureOf(mayHaveWritten, reason)
    },
    current
  );
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
 * **Nor does it erase an external block** — Phase 2d-6-4, the 2d-6 record's §3
 * entry 9. {@link MatchDuplicationSession.externalConflict},
 * {@link MatchDuplicationSession.uncertaintyUnresolved} and
 * {@link MatchDuplicationSession.awaitingReconciliation} all survive this
 * spread: what this dismisses under an external conflict is the save outcome's
 * panel and the reload warning, and the conflict and both restrictions stand
 * until an explicit resolution — the reload's confirmation, a reapply, or
 * closing. What the spread forces is that the three fields are copied; what no
 * type forces is that a later edit keeps them out of the literal, and the
 * suite's case is what would notice.
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
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function dismissDuplicationOutcome()

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
function reloadableConflictOf(session: MatchDuplicationSession): ConflictModel<MatchId> | null {
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
export function askToReloadDiskVersion(session: MatchDuplicationSession): MatchDuplicationSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReloadDiskVersion()

/**
 * Confirms abandoning this duplicate for the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmDiskReload(session: MatchDuplicationSession): MatchDuplicationSession {
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
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @returns The closed session, or the same session.
 */
export function reloadTheDiskVersion(
  session: MatchDuplicationSession,
  adopt: AdoptTheDiskVersion<MatchId>
): MatchDuplicationSession {
  const spend = spendTheConfirmedReload(reloadableConflictOf(session), session.reload, adopt);
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
    // The conflict of either origin is resolved by the reload that ends this
    // session, and a closed session says nothing about any file any more.
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    closed: true
  };
} // End of function reloadTheDiskVersion()

/**
 * Takes the window's decision about one watcher observation — Phase 2d-6-4, the
 * 2d-6 record's §3 entries 6, 7, 11 and 12.
 *
 * **The session's receiver, as a value**, in the shape `applyObservation` in
 * `./matchEditor.ts` established: a component registers a function through
 * `BrowserState.registerObservationReceiver` that calls this with the envelope and
 * installs what comes back (the wiring is 2d-6-6's), and the decision is here so a
 * suite can drive every arm without a window. It never re-arbitrates and reads
 * none of the window's tables.
 *
 * **Every verdict has a named action, switched with a `never` terminus** (entry
 * 11, plus the seventh arm Phase 2d-6-1b added):
 *
 * | Verdict | What this does, for a delivery about this session's file |
 * |---|---|
 * | `raised` | builds the external model from the observation and the retained draft |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its draft kept, its disk side replaced |
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
 * arm answers a new session. A duplicate holds no pending confirmation to
 * withdraw. `supersedes` builds through `supersedeConflict` when a conflict is
 * shown and through `describeExternalConflict` over the session's draft when
 * none is; the `superseded` origin the verdict names is not compared with the
 * shown conflict's — the envelope is the window's decision about the file, and
 * a session that re-checked it would be arbitrating.
 *
 * **During this session's own duplicate the envelope is appended to the held
 * list, not applied** (entry 5): see
 * {@link MatchDuplicationSession.heldDeliveries}. A closed session takes
 * nothing. **A spent session takes everything**: `duplicated`, `invalidated`
 * and `mayHaveWritten` are facts about this session's identities, not about
 * whether the file's state may be shown, so a conflict is recorded over a spent
 * session too and the view says both.
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
export function applyDuplicationObservation(
  session: MatchDuplicationSession,
  delivery: ObservationDelivery
): MatchDuplicationSession {
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
} // End of function applyDuplicationObservation()

/**
 * The session after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of
 * {@link applyDuplicationObservation}, which documents what happens here; this
 * is the one place the external model is built for this surface from a delivery.
 *
 * @param session - The session, not closed and not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The session showing the new conflict.
 */
function replacedBy(
  session: MatchDuplicationSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): MatchDuplicationSession {
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
 * {@link MatchDuplicationSession.uncertaintyUnresolved}.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload and reapply available again, or the same
 *   session.
 */
export function acknowledgeDuplicationSnapshot(
  session: MatchDuplicationSession,
  acknowledge: AcknowledgeTheUncertainty
): MatchDuplicationSession {
  const conflict = session.externalConflict;
  if (session.closed || conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeDuplicationSnapshot()

/**
 * Why a reapply of this duplication could not be carried out.
 *
 * **A code, never a sentence.** {@link duplicationReapplyObstacleKey} maps each
 * arm to a dictionary key and `tDuplicationReapplyObstacle` in `../i18n` renders
 * it.
 */
export type DuplicationReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /** The identified snippet is one this application will not duplicate. */
      readonly kind: 'notDuplicable';
      /** Which refusal the newly parsed projection gives, as a code. */
      readonly reason: DuplicationRefusal;
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

/** What a reapply of this duplication became. */
export type MatchDuplicationReapply = ReapplyOutcome<
  MatchDuplicationSession,
  DuplicationReapplyObstacle
>;

/** One reapply attempt this panel made, tied to the session it left behind. */
export type DuplicationReapplyAttempt = ReapplyAttempt<
  MatchDuplicationSession,
  DuplicationReapplyObstacle
>;

/**
 * The dictionary key holding one reapply obstacle's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link DuplicationReapplyObstacle} with no sentence is one too. The two
 * shared arms delegate to {@link sharedReapplyObstacleKey}, so one sentence serves
 * the five surfaces rather than five that have to be kept in step.
 *
 * **The nested reason is a second line and not part of this key.**
 * `notDuplicable` carries a {@link DuplicationRefusal}, which already has its own
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
export function duplicationReapplyObstacleKey(
  obstacle: DuplicationReapplyObstacle
): TranslationKey {
  switch (obstacle.kind) {
    case 'notDuplicable':
      return 'browser.matchDuplication.reapply.notDuplicable';
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
} // End of function duplicationReapplyObstacleKey()

/**
 * The guard {@link reapplyToDiskVersion} uses when its caller hands none in.
 *
 * `unaskedGuard` in `./matchEditor.ts`, for this session: it answers the shown
 * conflict's own origin, so the supersession question the entry asks last is
 * answered *yes, it stands* without the window being asked. It exists so that the
 * one component caller, which 2d-6-4 may not touch, keeps its save-origin reapply
 * exactly as it was; what it costs is stated on the caller.
 *
 * @param conflict - The conflict shown, or `null`.
 * @returns A guard that never asks the window.
 */
function unaskedGuard(conflict: ConflictModel<MatchId> | null): StandingOriginGuard {
  const source: ConflictSource | null = conflict === null ? null : conflict.source;
  return (): ConflictSource | null => source;
} // End of function unaskedGuard()

/**
 * The snippet one conflict's evidence names for this duplicate, or why it names
 * none — the origin switch of {@link reapplyToDiskVersion}, Phase 2d-6-4.
 *
 * **Four arms in, and each has its own answer** (the 2d-6 record's §3 entry 19).
 * Save evidence is read through `subjectCorrespondence`, as it always was. An
 * external table is searched through `correspondenceRowFor` for this session's
 * **full** base identity — document, base revision and node, never an array index
 * and never the node alone (entry 20) — and the found row's `exact` tier is read
 * through `subjectResolution`, exactly once: the clone must be of the newly
 * adopted item's own bytes, and the flexible `editor` tier is not looked at. A
 * refused table or row resolves to manual resolution with
 * `tExternalEvidenceRefusal`'s sentence, superseded evidence with
 * `tSupersededEvidence`'s (entry 22). Nothing here is cast: a row is a row and a
 * `ReapplyEvidence` is a `ReapplyEvidence`.
 *
 * @param evidence - What `enterReapply` found the conflict's origin to offer.
 * @param base - This session's snippet, by the identity the base snapshot minted.
 * @returns The subject to work from, or the manual resolution to answer with.
 */
function subjectOfEvidence(
  evidence: ReapplyEvidenceAccess,
  base: MatchId
): SubjectCorrespondence | Extract<MatchDuplicationReapply, { kind: 'manualResolution' }> {
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
      // not looked at for a duplicate.
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
 * Reissues this duplication against the newly parsed disk version.
 *
 * **Strict exact correspondence and nothing weaker**, which is the consult's Q4:
 * the clone must be of *the newly adopted item's own bytes*, so a snippet that
 * merely still spells its trigger the same way is not enough. The tier is
 * 2c-4b-1's and is chosen by `duplicate_match`, which asks for `ExactItem`. **The
 * external origin takes the same tier**, off the table's row for this session's
 * full base identity (the 2d-6 record's §3 entry 20), read through
 * {@link subjectOfEvidence}.
 *
 * **What is duplicated is the identified snippet as the file now writes it**, not a
 * stale copy and never a projection rendering: the session handed back names the
 * new identity at the new revision, and the core's `DuplicateItem` clones that
 * item's own runs when the save runs. That is what keeps *true duplicate* true
 * across a reapply.
 *
 * **The old acknowledgement does not cross, and this is where that is enforced.**
 * `DuplicateKeepsTriggerDefinition` is content-addressed to the candidate's own
 * `ContentRevision`, so consent collected before the conflict describes bytes that
 * are gone; {@link startMatchDuplication} builds a draft with no consent at all, so
 * the new candidate is refused and acknowledged again in the ordinary way.
 *
 * **There is no `alreadySatisfied` arm.** *A copy of this snippet already exists*
 * is not something correspondence can answer — an identical twin is precisely what
 * makes the evidence `AmbiguousExact` — so the honest answers are a rebuilt session
 * or a refusal.
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
 * blocked send would go through it). The view withholds the control through the
 * same facts; these are the rules for a call made past it.
 *
 * **The two blocks and the conflict's identity are asked again of the installed
 * session, once, immediately before the adoption** (this phase's review, its
 * third finding; `reapplyToDiskVersion` in `./matchDeletion.ts` says why every
 * read between the entry and the door is a read of caller data): refused
 * `observationRetained` or `writeOutcomeUnknown` when the installed session now
 * carries either, `supersededEvidence` when the conflict it shows is no longer
 * the one being reapplied; otherwise the rebuilt session carries the
 * **installed** session's waits forward, for `rebuiltOver`'s reason in
 * `./matchEditor.ts`. Without a reader the recheck is asked of the session handed
 * in ({@link ReadTheInstalledSession} says who owes the reader).
 *
 * **The standing-origin guard is a parameter, and it is optional for one stated
 * reason** — `reapplyToDiskVersion` in `./matchEditor.ts`'s:
 * `MatchDuplicator.svelte` calls this with three arguments and 2d-6-4 touches no
 * component. When no guard is handed in the supersession question is not asked
 * here; what still refuses a superseded origin on that path is
 * `adoptDiskVersion`'s fourth check, at the door, answered `adoptionRefused`
 * without the typed sentence. An omitted guard costs a sentence and some work,
 * never a wrong installation. 2d-6-6, which hands the live closure down, may make
 * the parameter required.
 *
 * @param session - The session showing the conflict.
 * @param unsavedDraftInDocument - Whether this window has a match editor open over
 *   **any** snippet of that file, dirty or not. Required for
 *   {@link duplicationEligibility}'s reason, and asked again here because the
 *   answer is about this window now rather than about the parse that was replaced.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never at
 *   all on a refusal.
 * @param standing - Asks what origin stands for the file **now**;
 *   `() => browser.standingConflictFor(document)` is the honest closure. `null`,
 *   the default, asks nothing — see above for what that costs.
 * @param current - Reads the session the caller holds now, for the recheck
 *   before the adoption. `null`, the default, rechecks the session handed in.
 * @returns What became of the attempt.
 */
export function reapplyToDiskVersion(
  session: MatchDuplicationSession,
  unsavedDraftInDocument: boolean,
  adopt: AdoptTheDiskVersion<MatchId>,
  standing: StandingOriginGuard | null = null,
  current: ReadTheInstalledSession | null = null
): MatchDuplicationReapply {
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
  const fresh = startMatchDuplication(entry.conflict.disk, subject.target, unsavedDraftInDocument);
  if (fresh.eligibility.kind !== 'duplicable') {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'notDuplicable', reason: fresh.eligibility.reason }
    };
  }
  // **The installed session, read once, after the last caller-controlled read
  // and immediately before the spend.** Nothing caller-controlled runs between
  // this read and the door.
  const installed = current === null ? session : current();
  if (installed.uncertaintyUnresolved) {
    return { kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } };
  }
  if (awaitedFor(installed) !== null) {
    return { kind: 'manualResolution', obstacle: { kind: 'observationRetained' } };
  }
  if (conflictOf(installed)?.source !== entry.conflict.source) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  if (adoptForReapply(entry.conflict, adopt) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  return {
    kind: 'reapplied',
    session: { ...fresh, awaitingReconciliation: installed.awaitingReconciliation }
  };
} // End of function reapplyToDiskVersion()

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
 * What this surface offers about a conflict.
 *
 * **`operationChoice` is permanent here, and it is the consult's Q4 ruling rather
 * than a limitation of this sub-phase.** The drafted value is a `MatchId`: an
 * opaque, revision-scoped protocol carrier, not user content. Copying its JSON
 * would expose an implementation token while preserving nothing, so *Copy draft*
 * is not merely unwired for this surface — it can never be offered, and
 * `conflictChoicesFor` refuses it even if `offersCopyDraft` were set.
 *
 * A confirmed reload — install the disk projection and **close** the duplicator —
 * is **offered as of 2c-4a-3b**: {@link askToReloadDiskVersion},
 * {@link confirmDiskReload} and {@link reloadTheDiskVersion} are the transition,
 * `MatchDuplicator.svelte`'s `conflictAction` calls them, and its panel now draws
 * the two labels `conflictChoicesFor` names. Flipping the boolean was the whole of
 * that step's model change here, because the machinery it turns on was built and
 * driven by this module's tests at 2c-4a-2.
 *
 * **`offersReapply` is the same trade one sub-phase later, and it is `true` as of
 * 2c-4b-3.** {@link reapplyToDiskVersion} was built and driven by this module's
 * tests at 2c-4b-2 with nothing naming it; flipping this boolean beside the
 * permanent `reapplySupport` is what makes `conflictChoicesFor` name `keepMyDraft`,
 * and `MatchDuplicator.svelte`'s `conflictAction` is what calls the transition.
 * **The consent does not cross**: the rebuilt session's draft carries none, so the
 * newly derived candidate is refused for `DuplicateKeepsTriggerDefinition` and
 * acknowledged again in the ordinary way.
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
 * hands back a session whose ordinary send is live; the reload is not, because
 * it closes the session and sends nothing. It feeds `conflictChoicesFor`, which
 * stays the only producer of a choice list; what this cannot force is that the
 * transitions honour the same facts, which is why each asks
 * {@link reloadableConflictOf} or the fields themselves.
 *
 * @param session - The session to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: MatchDuplicationSession): ConflictCapabilities {
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
function externalNoticesOf(session: MatchDuplicationSession): readonly ExternalConflictNotice[] {
  const notices: ExternalConflictNotice[] = [];
  if (session.externalConflict !== null && session.uncertaintyUnresolved) {
    notices.push({ kind: 'writeOutcomeUnknown' });
  }
  if (awaitedFor(session) !== null) {
    notices.push({ kind: 'observationRetained' });
  }
  return notices;
} // End of function externalNoticesOf()

/** Everything a screen needs about one duplication, derived on every read. */
export interface MatchDuplicationView {
  /** The snippet this is about. */
  readonly match: MatchId;
  /** The file it lives in. */
  readonly document: DocumentId;
  /** Whether the duplicate control does anything. */
  readonly canDuplicate: boolean;
  /**
   * The reason to draw beside the snippet, as a code, or `null`.
   *
   * **Presentation-ready, which is what makes it different from the session's
   * `eligibility`.** That verdict is frozen at {@link startMatchDuplication}
   * and no transition recomputes it, so after a reprojection it is a definite
   * claim about a snippet read off a parse this window has replaced;
   * {@link MatchDuplicationView.cannotDuplicate} is the live refusal, and
   * `refusalGiven` ranks `outOfDate` **above** `notDuplicable` precisely so
   * that the weaker live claim wins. This field carries that same precedence
   * into what is drawn: it is the frozen reason **only when
   * `cannotDuplicate` is `notDuplicable`** — that is, only when the frozen
   * verdict is what won — and `null` otherwise.
   *
   * **So a component renders this and asks nothing else.** Before step 3's
   * review the view handed out the frozen reason unconditionally and a
   * condition in `MatchDuplicator.svelte` was the only thing keeping the
   * suppressed certainty off the screen — a decision in markup, which no model
   * test can drive and any second renderer or markup refactor could drop.
   * `MatchDuplicator.test.ts` mounts that panel and asserts both rendered
   * halves, so this renderer is checked; what moved here is the decision
   * itself, which every renderer now inherits. A caller that wants the raw
   * frozen verdict rather than the sentence reads
   * {@link MatchDuplicationSession.eligibility}, which is unchanged and still
   * says everything.
   */
  readonly notDuplicableToShow: DuplicationRefusal | null;
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
   * The external conflict's own lines, or none — Phase 2d-6-4.
   *
   * Beside {@link MatchDuplicationView.messages} and never merged into it, for
   * `MatchEditorView.externalMessages`'s reason: a panel drawing `view.conflict`
   * outside the save-outcome branch (the 2d-6 record's §3 entry 10) draws nothing
   * twice. Rendered through `tConflictMessage`. No component reads it yet;
   * 2d-6-7 does.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * The lines owed while an observation cannot be acted on — Phase 2d-6-4.
   *
   * `writeOutcomeUnknown` first, `observationRetained` second, from the session's
   * own fields. No component reads it yet; 2d-6-7 and 2d-6-9 do.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
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
   * Whether the reapply control is among {@link MatchDuplicationView.conflictChoices}.
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
   * (2c-4a-3b). Nothing here was typed, so what goes beside the disk text is a
   * description of the operation — decided in this module rather than assembled in
   * markup, because a description written into one renderer is carried by that
   * renderer's mounted suite alone (2c-3c-3's Medium).
   *
   * Constant while a conflict is showing: a duplicate has no placement to choose,
   * because the clone lands immediately after its source (2c-3c-1).
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
 * **The precedence rule, expressed once and where a test can drive it.** The
 * frozen verdict is drawn exactly when the live refusal *is* the frozen one —
 * when `refusalGiven` answered `notDuplicable`, nothing weaker was true and the
 * definite claim about the snippet is the reason the control is disabled. Every
 * other live refusal outranks it, so the detail is withheld and the weaker
 * sentence stands alone: `outOfDate` is the reachable case (the session is
 * stale and the frozen claim was read off a parse that is gone), and the other
 * four are unreachable beside a refused eligibility only because such a session
 * can never send at all, which is a fact about today's transitions rather than
 * a guarantee worth relying on.
 *
 * A refused eligibility always makes `refusalGiven` answer something, so a
 * `null` live refusal never coexists with a frozen reason; the check is written
 * against `'notDuplicable'` rather than against `outOfDate` alone so that a
 * refusal added above it in the order suppresses the frozen detail by
 * construction instead of by a later edit here.
 *
 * @param session - The session the frozen verdict belongs to.
 * @param cannotDuplicate - The live refusal, as `refusalGiven` answered it for
 *   this same read of the projections.
 * @returns The frozen reason to draw, or `null` when a weaker live claim won.
 */
function notDuplicableToShow(
  session: MatchDuplicationSession,
  cannotDuplicate: DuplicationSubmissionRefusal | null
): DuplicationRefusal | null {
  if (cannotDuplicate !== 'notDuplicable' || session.eligibility.kind !== 'refused') {
    return null;
  }
  return session.eligibility.reason;
} // End of function notDuplicableToShow()

/**
 * Everything a screen needs about one duplication.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up.
 *
 * **It takes the live projections** for {@link duplicationSubmissionRefusal}'s
 * reason, and the refusal is computed **once** here with `canDuplicate` and
 * {@link MatchDuplicationView.notDuplicableToShow} both read off that one
 * answer, so the three fields of this view cannot contradict each other.
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
  const conflictChoices =
    conflict === null
      ? []
      : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload));
  const cannotDuplicate = duplicationSubmissionRefusal(session, views);
  const externallyBlocked = session.externalConflict !== null || awaitedFor(session) !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
  return {
    match: session.match,
    document: session.document,
    canDuplicate: cannotDuplicate === null,
    notDuplicableToShow: notDuplicableToShow(session, cannotDuplicate),
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
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: externalNoticesOf(session),
    notes: saved === null ? [] : saved.notes,
    // The one offer a refusal panel may keep under an external block is the
    // dismissal: `beginDuplicate` would answer `null` to the other, and a control
    // that does nothing when pressed is the defect `conflictChoicesFor` exists to
    // stop.
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
    conflictOperation: conflict === null ? null : 'duplicateSnippet',
    closed: session.closed
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
 * **The two external blocks reuse sentences that already exist** (Phase 2d-6-4):
 * the external origin's own first line for `externalConflict`, and the retained
 * notice's for `observationRetained`, each through its own key function so a
 * renamed key is a compile error there and here at once. No sentence of this
 * module's own was added for either.
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
    case 'externalConflict':
      return externalConflictMessageKey({ kind: 'fileChangedWhileOpen' });
    case 'conflict':
      return 'browser.matchDuplication.cannotDuplicate.conflict';
    case 'observationRetained':
      return externalConflictNoticeKey({ kind: 'observationRetained' });
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
