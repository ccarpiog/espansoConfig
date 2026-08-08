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
import { sequenceOf, type SequenceAddress } from './matchMove';
import type { RawSaveChoice } from './rawSave';
import {
  adoptForReapply,
  beginReapply,
  subjectCorrespondence,
  type ReapplyOutcome,
  type SharedReapplyObstacle
} from './reapply';
import {
  conflictChoicesFor,
  conflictDiskText,
  describeEditSave,
  invalidationFailureMessage,
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
  return !session.closed && duplicationSubmissionRefusal(session, views) === null;
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
  // **A closed session sends nothing.** A confirmed reload adopted the disk
  // projection and ended this panel, so its identities describe a parse the window
  // has crossed away from. No refusal *code* is added for it, and that is
  // deliberate: a code is a sentence on a screen, and a closed panel is not on one.
  if (session.closed || refusalGiven(session, live) !== null) {
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
    duplicated,
    invalidated,
    landed: result.moved,
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    outcome,
    extraMessages,
    reload: NOT_RELOADING,
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
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function dismissDuplicationOutcome()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing or one has already been asked about.
 */
export function askToReloadDiskVersion(session: MatchDuplicationSession): MatchDuplicationSession {
  const next = reloadAsked(conflictOf(session), session.reload);
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
  session: MatchDuplicationSession,
  adopt: AdoptTheDiskVersion<MatchId>
): MatchDuplicationSession {
  const spend = spendTheConfirmedReload(conflictOf(session), session.reload, adopt);
  if (spend === 'notAttempted') {
    return session;
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the
    // 2c-4a-3a review’s finding 3: the confirmation is spent and the window said
    // no for a reason that asking again cannot change, so the control stops being
    // offered and the panel says so. The `keepEditing` choice writes
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
 * Why a reapply of this duplication could not be carried out.
 *
 * **A code, never a sentence.** There is no key function for these yet, and that is
 * 2c-4b-2's boundary: nothing draws them, so 2c-4b-3 adds the accessors together
 * with the panel that renders them.
 */
export type DuplicationReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /** The identified snippet is one this application will not duplicate. */
      readonly kind: 'notDuplicable';
      /** Which refusal the newly parsed projection gives, as a code. */
      readonly reason: DuplicationRefusal;
    };

/** What a reapply of this duplication became. */
export type MatchDuplicationReapply = ReapplyOutcome<
  MatchDuplicationSession,
  DuplicationReapplyObstacle
>;

/**
 * Reissues this duplication against the newly parsed disk version.
 *
 * **Strict exact correspondence and nothing weaker**, which is the consult's Q4:
 * the clone must be of *the newly adopted item's own bytes*, so a snippet that
 * merely still spells its trigger the same way is not enough. The tier is
 * 2c-4b-1's and is chosen by `duplicate_match`, which asks for `ExactItem`.
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
 * @param session - The session showing the conflict.
 * @param unsavedDraftInDocument - Whether this window has a match editor open over
 *   **any** snippet of that file, dirty or not. Required for
 *   {@link duplicationEligibility}'s reason, and asked again here because the
 *   answer is about this window now rather than about the parse that was replaced.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never at
 *   all on a refusal.
 * @returns What became of the attempt.
 */
export function reapplyToDiskVersion(
  session: MatchDuplicationSession,
  unsavedDraftInDocument: boolean,
  adopt: AdoptTheDiskVersion<MatchId>
): MatchDuplicationReapply {
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
  const rebuilt = startMatchDuplication(
    start.conflict.disk,
    subject.target,
    unsavedDraftInDocument
  );
  if (rebuilt.eligibility.kind !== 'duplicable') {
    return {
      kind: 'manualResolution',
      obstacle: { kind: 'notDuplicable', reason: rebuilt.eligibility.reason }
    };
  }
  if (adoptForReapply(start.conflict, adopt) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  return { kind: 'reapplied', session: rebuilt };
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
 * **`reapplySupport` is the same trade one sub-phase later.** This surface *can*
 * reapply — {@link reapplyToDiskVersion} is the transition — and nothing draws it:
 * `ConflictChoice` has no member for one and `conflictChoicesFor` names none.
 * 2c-4b-3 draws it.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'operationChoice',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: false,
  offersReload: true,
  reapplySupport: 'supported'
};

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
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * Whether a confirmed reload was spent and the window refused it.
   *
   * **The disclosure the panel owes for a control that has just gone.** The
   * reload is not offered again once a spend has been refused — asking again
   * could only be refused again — and a control that vanishes with nothing said
   * in its place reads as a bug (2c-4a-3a review, finding 3). Nothing was written
   * and nothing was discarded; the `keepEditing` choice resets the step.
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
  const cannotDuplicate = duplicationSubmissionRefusal(session, views);
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
