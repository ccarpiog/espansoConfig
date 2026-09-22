/**
 * The new-snippet form: two required values, one destination and one position.
 *
 * **No component and no screen.** This is the whole protocol as a value, exactly
 * as `./matchEditor.ts` is for the small editor and `./rawEditor.ts` is for the
 * raw one, and for the same standing reason (`docs/decisions/1c-1-notes.md`
 * hole 1): nothing in this repository renders a Svelte component in an automated
 * test unless the file opts into jsdom, so a decision written in markup is a
 * decision nothing can check. A later step of 2c-3a draws what this module
 * decides.
 *
 * ## Why this is its own module and not a mode of the small editor
 *
 * The design consult's Q3 (`docs/reviews/phase-2c-3a-design.md`), and it is a
 * statement about *what creation is not*:
 *
 * - there is **no projection**, so there is no {@link MatchBaseline} to compare
 *   against and no `Unchanged`-versus-`Set("")` distinction to get right. Folding
 *   creation into `matchEditor.ts` would mean manufacturing an empty baseline,
 *   which is a projection of a snippet that does not exist — a value nothing read
 *   from a file, sitting in the one field whose whole purpose is to record what a
 *   file held;
 * - there is **no absent key in this form**. Its two values are the two `NewMatch`
 *   requires on the wire, and both are required here because a trigger with no
 *   body is not a usable espanso snippet. The four *optional* schema-known fields
 *   `NewMatch` has carried since 2c-4c-1 are simply not authored here — omitting
 *   one asks Rust to write no key for it, which is a different request from
 *   sending it empty — and the absent-key question arrives with the caller that
 *   does author them;
 * - there is **no reprojection debt** of the small editor's kind. A committed
 *   create does invalidate this form — see below — but the reason is that the
 *   *destinations* it holds are stale, not that a scalar's spelling has changed.
 *
 * What creation *does* share is the save protocol, and it shares it by calling
 * `./editorSave.ts` and `./saveOutcome.ts` rather than by copying them: the
 * findings round trip, the withdrawal of *Save anyway* once findings go stale,
 * the two arms of a send that produced no outcome, and the three arms of an
 * outcome. It shares the coalescing boundary the same way, through `./typing.ts`.
 *
 * ## The destination: every file is offered, and the ineligible ones say why
 *
 * The consult's Q5, in its literal reading: **every file the window lists** is in
 * {@link MatchCreationSession.destinations}, and one this application cannot write
 * a snippet into carries a typed {@link DestinationRefusal} instead of being
 * dropped, because a destination list silently shorter than the sidebar reads as
 * an incomplete list rather than as an explanation. The list is therefore built
 * from the **document summaries** — what the sidebar itself draws — and a
 * projection is what an eligibility is *refined* by, not what admits a file to the
 * list. A file this window holds no projection of is offered as `couldNotBeRead`,
 * which is the first review round's sixth finding: it used to be dropped, which is
 * exactly the silent filtering Q5 rejects.
 *
 * ## The submission's identity is not only its buffers
 *
 * The destination and the position are part of what would be sent, so
 * {@link chooseDestination} and {@link choosePlacement} **withdraw** the submitted
 * findings, the consent bound to them and the outcome on screen; a change of
 * destination additionally re-points the draft's base revision at the newly chosen
 * file's. That is the first review round's first finding, and the failure it
 * closes is precise: a create refused in file A could have its findings accepted,
 * be redirected to file B, and reuse that consent — because the *buffers* had not
 * changed and consent is addressed to the buffers alone.
 *
 * **The core stays authoritative.** `match_list_of` in `src-tauri/src/commands.rs`
 * is the one caller that can produce `documentHasNoMatchList`, and
 * {@link DestinationRefusal} `noMatchList` is the *same comparison* against the
 * same wire field — `DocumentView.top_level_keys` against the literal `matches` —
 * made a moment earlier. It is an affordance derived from the current projection,
 * never authorization: if the projection and the file disagree, the command
 * refuses and that refusal is what the person sees.
 *
 * ## The position: three arms, and the anchor is an identity
 *
 * The consult's Q4. All three of `NewMatchPosition` are offered. The default is
 * `After` **only** when the held selection belongs to the chosen destination *and*
 * to that document's current revision; otherwise it is `End`, because a default
 * that crossed documents would put a snippet somewhere nobody asked for.
 *
 * The `After` arm stores the anchor's **identity** and never an ordinal, which is
 * what the wire type is for. {@link chooseDestination} recomputes the placement
 * from scratch, so an anchor belonging to another file — or to a revision this
 * form no longer holds — cannot survive a change of destination; and
 * {@link choosePlacement} refuses an anchor that is not one of the chosen
 * destination's own, so one cannot be installed by a caller either.
 *
 * ## The carriage return, and what the gate is really for
 *
 * Measured in this application's own WKWebView
 * (`docs/decisions/2c-2-2-window-reading.md` section 6): a `<textarea>` assigned
 * `"x\ry\r\nz"` reads back `"x\ny\nz"`, and an `<input type="text">` assigned
 * `"p\rq"` reads back `"pq"` — it **deletes** the character. So no control this
 * form will ever have can produce a carriage return.
 *
 * The gate below therefore exists for **the caller TypeScript cannot stop**, not
 * for the control: {@link NewMatch} carries no brand, unlike `RoundTripText`, so
 * a well-typed caller can put a `\r` in one and hand it to `createMatch`. It is
 * checked on the **derived candidate** at submit time, and — unlike the small
 * editor's, which can only answer `null` — it has a reason code of its own, so a
 * screen can say why the button does nothing.
 *
 * ## What a commit leaves behind
 *
 * A committed create makes every {@link MatchId} in that file stale, including
 * every anchor in {@link CreationDestination.anchors} and the revision beside
 * them. So a commit **spends the form**: {@link MatchCreationSession.committed}
 * becomes `true`, nothing here clears it, and {@link canCreate} answers `false`
 * with the reason `alreadyCreated` for as long as it is set. Only
 * {@link startMatchCreation} over freshly projected documents produces a form that
 * can create again. That is `matchEditor.ts`'s `needsReprojection` in spirit: an
 * obligation the model refuses to let a caller edit past, rather than a request.
 *
 * **What no type here forces**, in the same sentence as what one does: nothing
 * makes a caller re-seed, and nothing stops a component importing `createMatch`
 * from `../ipc/commands` and skipping `BrowserState` altogether — the hole
 * `saveMatch`, `moveMatch` and `saveRawDocument` have had since 2b-2a. What the
 * model forces is that no submission is produced from a form that has committed.
 *
 * ## The external session — Phase 2d-6-3
 *
 * The shape `./matchEditor.ts` took at 2d-6-2, in this form's terms.
 * {@link MatchCreationSession.externalConflict} is the conflict a watcher
 * observation raised over the file this form writes into, a field beside
 * `outcome` and never an arm of it (the 2d-6 record's §3 entry 6);
 * {@link applyObservation} is the form's receiver as a value, one named action per
 * verdict arm and a `never` terminus (entry 11); {@link conflictOf} answers the
 * conflict shown whichever origin it has, so {@link isEditable},
 * {@link creationRefusal} and {@link beginCreate} refuse under both (entry 8). A
 * held observation ({@link MatchCreationSession.awaitingReconciliation}) refuses
 * the send and nothing else; a conflict raised under an unknown write outcome
 * ({@link MatchCreationSession.uncertaintyUnresolved}) withholds the reload and the
 * reapply until {@link acknowledgeSnapshot} is told the hold ended (entries 11, 22);
 * {@link keepDrafting} erases none of the three (entry 9).
 *
 * **What is this form's own is the file it is about, because the file can be
 * unknown.** Every other session is opened *over* a file; this one chooses its
 * destination, and until it has, `targetingSurfaceFor` in `./restore.ts`
 * attributes it to every creator-eligible file — its **wildcard protection**. So
 * a delivery is *about* this form when the form names no file yet, or when the
 * observation's file is the one chosen ({@link applyObservation} reads exactly one
 * property of an observation to decide that, `document`, once); a delivery about
 * another file can only end a wait this form recorded for that very observation,
 * and the waits are kept **per file**, so a change of destination neither drops
 * nor restores one.
 * **A destination-less form told of a change keeps its fields and its wildcard
 * protection, shows the affected file's state and requires an explicit
 * destination** (entry 21): the reload and the reapply are withheld, the
 * unknown-target reapply is refused, and the one way forward is
 * {@link chooseDestination} — the only transition open under an external conflict,
 * and open only while the form names no file. It never chooses the observed file
 * and never re-points the draft at the observed revision: what the person names is
 * what the form writes into, at the revision this window holds for it.
 *
 * **The reapply reads both origins through one entry** — `enterReapply` in
 * `./reapply.ts` — and consults the external table for one thing only, the anchor
 * of an `after` placement, found by its **full** base identity and read through
 * `anchorResolution` from its row's `exact` tier (entries 19 and 20); a `front` or
 * `end` placement asks the table nothing, as it asks a refused save's anchor
 * nothing.
 *
 * **Registered since Phase 2d-6-6b.** `MatchCreator.svelte` reports a receiver that
 * installs this module's `applyObservation` through the binding `DetailPane` hands
 * down, and the pane registers it over the chosen file — or, while none is chosen,
 * over every creator-eligible file (`./surfaceReceivers.ts`). The pane still builds
 * the form's target from the `DocumentId | null` `reportDestination` carries, so
 * {@link creationTargetOf} is a second home for that mapping, and nothing reads it
 * yet.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  FileKind,
  MatchId,
  MatchView,
  NewMatch,
  NewMatchPosition,
  PresentationNote,
  ReapplyRefusal,
  SaveResult
} from '../ipc/types';
import {
  canRedo,
  canUndo,
  isDirty,
  redoDraft,
  retargetedDraft,
  savedDraft,
  startDraft,
  structuredDraftRules,
  submissionOf,
  undoDraft,
  withdrawnConsent,
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
import { plainIdentity } from './matchDeletion';
import type { AcknowledgeTheUncertainty } from './matchEditor';
import type { RawSaveChoice } from './rawSave';
import type {
  ConflictSource,
  ExternalConflictObservation
} from './conflictSource';
import {
  externalConflictNoticeKey,
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
  subjectIsTargetless,
  SUPERSEDED_EVIDENCE_KEY,
  type AnchorCorrespondence,
  type ExternalEvidenceRefusal,
  type ReapplyAttempt,
  type ReapplyEvidenceAccess,
  type ReapplyOutcome,
  type SharedReapplyObstacle,
  type StandingOriginGuard
} from './reapply';
import type { WriteSurfaceTarget } from './restore';
import {
  conflictChoicesFor,
  conflictDiskText,
  copyOfDraft,
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
  type ConflictModel,
  type ExternalConflictModel,
  type RetainedDraftField,
  type SaveOutcomeMessage,
  type SaveOutcomeModel,
  reapplyAuthorizationFor
} from './saveOutcome';
import { holdsMatches } from './sidebar';
import { recordTyping, type Clock, type TypingRun } from './typing';

/**
 * The key a file's own snippet list is written under.
 *
 * The same literal `MATCH_LIST_KEY` in `src-tauri/src/commands.rs` holds, and the
 * duplication is deliberate rather than an oversight: nothing on this wire
 * carries the name, so the alternative to repeating it is not sharing it but
 * *not making the check at all* — which is the silent-filtering the consult's Q5
 * rejects. The comparison here is honest about being a copy, and the core's is
 * the one that decides.
 */
const MATCH_LIST_KEY = 'matches';

/** One value the form holds, spelled as its espanso key. */
export type CreationField = 'trigger' | 'replace';

/**
 * The two fields, in the order a screen shows them.
 *
 * Trigger first, because it is what fires the snippet; the body second.
 */
export const CREATION_FIELDS: readonly CreationField[] = ['trigger', 'replace'];

/** What the form's two controls hold. */
export interface CreationBuffers {
  /** The literal text that will fire the snippet — espanso's `trigger`. */
  readonly trigger: string;
  /** What the snippet will expand to — espanso's `replace`. */
  readonly replace: string;
}

/**
 * How this form compares and snapshots its drafted value.
 *
 * `structuredDraftRules` and nothing narrower, for `matchEditor.ts`'s reason:
 * {@link CreationBuffers} has fields, so the snapshot must be a deep copy and a
 * deep freeze, or the base, the current value, the history entry and the consent
 * candidate would all be one object and would all move together.
 */
const BUFFER_RULES: DraftValueRules<CreationBuffers> = structuredDraftRules<CreationBuffers>();

/**
 * Why this application will not write a new snippet into one file.
 *
 * **A code, never a sentence** (CLAUDE.md section 2): the prose lives in
 * `src/lib/i18n/{en,es}.json`, where the two languages are checked against each
 * other, and a component renders one by calling `tDestinationRefusal` — never by
 * building a key.
 *
 * The five are checked in the order they are listed, and the order is a claim
 * about which fact is the most fundamental rather than about which is the most
 * likely: where the file lives, then whether this application may write it at
 * all, then whether this window read it, then whether the substrate accepted it,
 * then what it holds. The first two are read off the **summary**, which is why
 * they are answerable for a file with no projection at all.
 */
export type DestinationRefusal =
  /** Espanso does not load snippets out of this file, wherever its keys say. */
  | 'notASnippetFile'
  /** The summary says this application must refuse to write the file. */
  | 'readOnly'
  /** This window holds no projection of the file, so it knows nothing else. */
  | 'couldNotBeRead'
  /** The substrate did not accept the file, so nothing is known about its shape. */
  | 'notParsed'
  /** The file has no top-level snippet list to add to. */
  | 'noMatchList';

/**
 * Whether one file may be written into, and why not when it may not.
 *
 * A discriminated union rather than a boolean with a nullable reason, so a
 * refused verdict with no reason is not representable — the shape every verdict
 * in this directory has.
 */
export type DestinationEligibility =
  | {
      /** A snippet may be created in this file. */
      readonly kind: 'eligible';
    }
  | {
      /** It may not, and the file is still shown. */
      readonly kind: 'ineligible';
      /** Why, as a code. */
      readonly reason: DestinationRefusal;
    };

/** The one eligible verdict, shared rather than rebuilt per file. */
const ELIGIBLE: DestinationEligibility = Object.freeze({ kind: 'eligible' as const });

/**
 * One file the form may offer as a destination.
 *
 * **The revision travels with the anchors**, in one value, which is 2c-2-2's
 * High finding restated for a list: a projection and the identities minted from
 * it are one fact, and passing a second value straight from somewhere else
 * type-checks perfectly and is wrong.
 */
export interface CreationDestination {
  /** The file, by the identity this window holds. */
  readonly document: DocumentId;
  /** Its path relative to the configuration root, for a screen to name it by. */
  readonly path: string;
  /**
   * The revision the projection this was derived from was of.
   *
   * **The empty revision when this window holds no projection of the file**, which
   * is the `couldNotBeRead` case. It cannot reach the wire: such a destination is
   * `ineligible`, and {@link canCreate} refuses a form whose chosen destination is
   * — see {@link revisionOf} for the same argument stated for the draft's base.
   */
  readonly revision: ContentRevision;
  /** Whether a snippet may be created here, and why not when it may not. */
  readonly eligibility: DestinationEligibility;
  /**
   * The snippets an `After` placement may name, in the order the file writes
   * them.
   *
   * Identities only. A screen that wants to *name* one looks it up in the
   * projection it already draws the snippet list from; carrying display text here
   * would be this model holding a second copy of it.
   */
  readonly anchors: readonly MatchId[];
}

/**
 * What one listed file is, as a destination.
 *
 * **Two values, because a file is two facts here**: the summary is what the
 * window lists and is always present, and the projection is what it managed to
 * read and may be absent. Everything that needs a parse — the revision the
 * anchors were minted from, and the anchors themselves — comes from the second
 * and is empty without it.
 *
 * @param summary - The file, as the window lists it.
 * @param view - The file's projection, exactly as this window holds it, or `null`
 *   when it holds none.
 * @returns The destination, eligible or with its reason.
 */
export function destinationOf(
  summary: DocumentSummary,
  view: DocumentView | null
): CreationDestination {
  return {
    document: summary.id,
    path: summary.relative_path,
    revision: view?.revision ?? '',
    eligibility: destinationEligibility(summary, view),
    anchors: view === null ? [] : view.matches.map((match) => match.id)
  };
} // End of function destinationOf()

/**
 * Whether a snippet may be created in one listed file.
 *
 * `holdsMatches` is asked of `kind`, which is what espanso treats the file as and
 * is a fact about **where it lives** — espanso does not load snippets out of
 * `config/`, whatever the file's keys say, so a snippet written there would never
 * fire. It and `read_only` are facts a *summary* carries, so they are decided
 * first and are decidable for a file this window never managed to read; the last
 * two are read off the projection and need one.
 *
 * @param summary - Anything carrying the file's kind and its read-only flag: a
 *   `DocumentSummary`, or a `DocumentView`, which carries both fields itself.
 * @param view - The file's projection, or `null` when this window holds none.
 * @returns The verdict, with a reason code when it is a refusal.
 */
export function destinationEligibility(
  summary: { readonly kind: FileKind; readonly read_only: boolean },
  view: DocumentView | null
): DestinationEligibility {
  if (!holdsMatches(summary)) {
    return { kind: 'ineligible', reason: 'notASnippetFile' };
  }
  if (summary.read_only) {
    return { kind: 'ineligible', reason: 'readOnly' };
  }
  if (view === null) {
    return { kind: 'ineligible', reason: 'couldNotBeRead' };
  }
  if (!view.parsed) {
    return { kind: 'ineligible', reason: 'notParsed' };
  }
  if (!view.top_level_keys.some((key) => key.text === MATCH_LIST_KEY)) {
    return { kind: 'ineligible', reason: 'noMatchList' };
  }
  return ELIGIBLE;
} // End of function destinationEligibility()

/**
 * Every file the window lists, as a destination, in the order it lists them.
 *
 * **The list is the summaries and not the projections**, which is the first
 * review round's sixth finding. The earlier version mapped the projections, so a
 * file whose `get_document` refused was absent from the destination list
 * altogether while the sidebar went on naming it — the silent filtering the
 * consult's Q5 rejects, arrived at by leaving a file out rather than by hiding a
 * row. A file with no projection is offered and refused with `couldNotBeRead`.
 *
 * **`couldNotBeRead` is "this window holds no projection", stated exactly.** In
 * this application the two are the same state: `BrowserState.open` projects every
 * file it lists, so a missing projection means the read refused and
 * `BrowserState.loadFailures` carries the reason the sidebar shows. The one other
 * way to reach it is a projection dropped after a committed save this window could
 * not re-read, which is also a read that failed. What no type here forces is that
 * the two lists come from one window: a caller may hand in projections of one
 * workspace and summaries of another, and every file would then read as unread.
 *
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds, in any order.
 * @returns One destination per listed file, in the same order.
 */
export function destinationsOf(
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[]
): readonly CreationDestination[] {
  return documents.map((summary) =>
    destinationOf(summary, views.find((view) => view.id === summary.id) ?? null)
  );
} // End of function destinationsOf()

/** Where a new snippet goes, as this form holds it. */
export type CreationPlacement =
  | {
      /** At the top of the file's snippet list. */
      readonly kind: 'front';
    }
  | {
      /** Directly after one named snippet. */
      readonly kind: 'after';
      /** The snippet it follows, **by identity**. */
      readonly anchor: MatchId;
    }
  | {
      /** At the bottom of the file's snippet list. */
      readonly kind: 'end';
    };

/** The end placement, shared rather than rebuilt. */
const AT_END: CreationPlacement = Object.freeze({ kind: 'end' as const });

/**
 * Whether two placements say the same thing.
 *
 * The idiom the whole of `./draft.ts` is built on: *a change that changes nothing
 * is not a change*. It matters more here than it looks, because since the first
 * review round a placement that really moves **withdraws the consent and the
 * outcome on screen** — so a control that re-emits the value it already holds
 * would otherwise clear a refusal panel nobody dismissed.
 *
 * @param one - One placement.
 * @param other - The other.
 * @returns `true` when they name the same position, anchor included.
 */
function samePlacement(one: CreationPlacement, other: CreationPlacement): boolean {
  if (one.kind !== other.kind) {
    return false;
  }
  return one.kind === 'after' && other.kind === 'after'
    ? sameIdentity(one.anchor, other.anchor)
    : true;
} // End of function samePlacement()

/**
 * The wire position one placement is.
 *
 * The two empty arms are objects rather than bare strings, which is what
 * {@link NewMatchPosition} documents and what the Rust side asserts: one shape
 * per wire enum is what lets a value be recognised without a special case per
 * variant.
 *
 * @param placement - Where the form says the snippet goes.
 * @returns The value `create_match` takes.
 */
export function wirePosition(placement: CreationPlacement): NewMatchPosition {
  switch (placement.kind) {
    case 'front':
      return { Front: {} };
    case 'after':
      return { After: { anchor: placement.anchor } };
    case 'end':
      return { End: {} };
  }
} // End of function wirePosition()

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
 * One new-snippet form.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1: a
 * component holds one in a `$state.raw` and reassigns it, and every function
 * below returns a new form without touching its argument.
 */
export interface MatchCreationSession {
  /** Every file the form offers, eligible or not, in window order. */
  readonly destinations: readonly CreationDestination[];
  /** The file chosen, or `null` when none has been. */
  readonly chosen: DocumentId | null;
  /** Where in that file's list the snippet goes. */
  readonly placement: CreationPlacement;
  /**
   * The snippet the window had selected when this form was opened, or `null`.
   *
   * Kept so that {@link chooseDestination} can recompute the default placement
   * for a *newly* chosen file, which is the consult's Q4: the anchor default is a
   * function of the destination and cannot be decided once at the start.
   */
  readonly held: MatchId | null;
  /** What the two controls hold. Drafted, with history and consent. */
  readonly draft: Draft<CreationBuffers>;
  /** Whether a save is in flight. */
  readonly phase: EditorPhase;
  /** Which field has the focus, as the screen last reported it. */
  readonly focus: CreationField | null;
  /** The run of typing later keystrokes may join, or `null`. */
  readonly group: TypingRun<CreationField> | null;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<CreationBuffers> | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<CreationBuffers> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed create whose adoption failed. The
   * bytes are on disk (`PROGRESS.md` D2) and what failed is this window's attempt
   * to bring itself back into step, so it is never a replacement for the saved
   * arm.
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
   * Whether a create has committed through this form.
   *
   * Set by a committed save and cleared by **nothing**. Every destination this
   * form holds was derived from a projection the commit replaced, so its
   * revisions and every anchor beside them are stale; {@link canCreate} is
   * `false` for as long as this is `true`, and only {@link startMatchCreation}
   * over freshly projected documents produces a form that can create again.
   */
  readonly committed: boolean;
  /**
   * The created snippet's identity in the new revision, or `null`.
   *
   * `SavedResult.moved` for the arm that answered it. **`null` is legal on a
   * committed create**: the wire says so — the command answers no identity when
   * the file changed again between the write and the read that followed it — so a
   * screen that offers *open the new snippet* has to be able to draw that case.
   */
  readonly created: MatchId | null;
  /**
   * The conflict a watcher observation raised over the file this form writes
   * into, or `null` — Phase 2d-6-3, the 2d-6 record's §3 entry 6.
   *
   * **A field of its own beside {@link MatchCreationSession.outcome}, never an
   * arm of it**, for `MatchEditorSession.externalConflict`'s reason: an outcome is
   * how *a save* ended, and a conflict the watcher raised is not that.
   * {@link conflictOf} is the one accessor that reads both and answers the
   * conflict this form is showing, whichever origin it has. **Only one conflict is
   * active at a time, and the transitions are what keep it so** (entry 7):
   * {@link applyObservation} retires a save conflict's outcome when it sets this,
   * and {@link applyCreate} retires this when a create ends as a conflict. The
   * type admits both populated, and a form built by hand with both gets
   * {@link conflictOf}'s stated precedence, not a guarantee.
   *
   * **Which file it is about is the form's own question.** While a destination is
   * chosen it is a conflict about that file; while none is, it is the state of an
   * *affected* file — one this form could have written into — shown so the person
   * can name where the snippet goes (entry 21). One slot either way: a
   * destination-less form told of a second affected file shows the later one, and
   * what protects the earlier is the command's own revision check, never this
   * field. While it is non-null the two boxes are frozen and nothing can be sent;
   * {@link keepDrafting} does not clear it (entry 9). The ways out are the reload
   * and the reapply for a form that names a file, and an explicit destination for
   * one that does not.
   */
  readonly externalConflict: ExternalConflictModel<CreationBuffers> | null;
  /**
   * Whether {@link MatchCreationSession.externalConflict} was raised while a
   * write of this window's own had an unknown outcome, and this form has not been
   * told the hold ended — Phase 2d-6-3, entry 11's `raisedWithoutReload` row.
   *
   * While `true` the ordinary reload is withheld and the reapply refused, for the
   * match editor's reason: a confirmed installation of bytes a write of this
   * window may or may not have produced would settle, silently, a question only
   * the person can. It ends when {@link acknowledgeSnapshot} is told the window
   * ended the hold, or when a later verdict replaces the conflict under no
   * uncertainty. **It records what this form was told and nothing more**: a hold
   * the window ends by a later definite write delivers nothing to a form, and
   * this flag cannot see it.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations this form was told the window is holding and has not
   * decided about, **one per file, keyed by the file** — Phase 2d-6-3, entry 11's
   * `retained` row, and the review of this phase (its second finding).
   *
   * **A restriction on sending and nothing else**: while the chosen file has an
   * entry, {@link creationRefusal} answers `observationRetained` and
   * {@link beginCreate} answers `null` (entry 8); the controls stay live, and no
   * disk comparison and no origin is recorded. An entry is lifted by the delivery
   * that decides **that** observation, whatever the verdict — `writtenHere`
   * included — compared by identity, and replaced by a later `retained` about the
   * same file. **A change of destination neither drops nor restores an entry**:
   * the phase first shipped a single slot that {@link chooseDestination} emptied
   * when the form left the file, so a form told `retained(A)` that visited B and
   * came back to A had lost the only record of A's wait and could send past a
   * block the window still held. Keyed by file, what the form knows about A
   * survives the detour and blocks nothing while the form is over B.
   *
   * **What the map forces and what it does not, in the same sentence.** It
   * forces that every wait this form was told of is kept until the delivery that
   * decides it arrives, and that only the chosen file's wait blocks the send; it
   * cannot force that such a delivery arrives — a form whose receiver was
   * unregistered from A while it was over B is never told A's decision and stays
   * blocked over A until it is closed — nor that a wait the form was *not* told of,
   * because it was not registered over A when the window held the reading, is
   * recorded at all. Both are facts about where a form's receiver is registered,
   * which `DetailPane` decides since Phase 2d-6-6b (`./surfaceReceivers.ts`);
   * `BrowserState.automaticReloadGuardFor(document)` answers
   * the window's own state for a caller that wants to reconcile the two. What the
   * map cannot see is a reading the barrier coalesced away without announcing it,
   * exactly as the editor's single slot cannot.
   */
  readonly awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>;
  /**
   * Every delivery that arrived while this form's own create was in flight, in
   * the order it arrived, kept until that create's answer has been applied — Phase
   * 2d-6-3, the 2d-6 record's §3 entry 5.
   *
   * `MatchEditorSession.heldDeliveries`'s rule, unchanged: the window publishes a
   * write's settlement from inside the writing wrapper, before the `await` that
   * started it resumes, so {@link applyObservation} appends here while the phase
   * is `saving` and {@link applyCreate} and {@link createCouldNotBeSent} replay the
   * whole list through it, first to last, after their own answer. **What the list
   * forces** is that no envelope delivered during the create is dropped and that
   * first-to-last is the order; **what it does not force** is that arrival order
   * was decision order — the window's own contract — nor that a component applies
   * a delivery through this module at all.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
  /** Where the typing run's boundary readings come from. */
  readonly clock: Clock;
}

/**
 * The placement a form defaults to for one destination.
 *
 * The consult's Q4, exactly: `After` the held selection when that selection
 * belongs to this destination **and to the revision this form holds for it**, and
 * `End` otherwise. The revision comparison is not decoration — an identity from
 * an older parse of the same file is precisely the value that would resolve to a
 * *different* snippet, and `create_match` refuses it rather than resolving it.
 *
 * @param destinations - Every file the form offers.
 * @param held - The window's selected snippet, or `null`.
 * @param document - The file being chosen, or `null`.
 * @returns Where the snippet should go by default.
 */
function defaultPlacement(
  destinations: readonly CreationDestination[],
  held: MatchId | null,
  document: DocumentId | null
): CreationPlacement {
  if (held === null || document === null || held.document !== document) {
    return AT_END;
  }
  const destination = destinations.find((one) => one.document === document);
  if (destination === undefined || destination.revision !== held.revision) {
    return AT_END;
  }
  return destination.anchors.some((anchor) => sameIdentity(anchor, held))
    ? { kind: 'after', anchor: held }
    : AT_END;
} // End of function defaultPlacement()

/**
 * Opens a new-snippet form over the files this window holds.
 *
 * The destination starts as the held selection's own file when there is one,
 * because that is the file the person is looking at; it is `null` otherwise, and
 * {@link canCreate} then answers `noDestination` rather than this function
 * guessing one. **An ineligible file is still chosen** when the selection is in
 * it: hiding the refusal by silently choosing somewhere else would move a
 * person's snippet to a file they did not name.
 *
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds.
 * @param held - The snippet the window has selected, or `null`.
 * @param clock - Where the typing run's boundary readings come from.
 *   **Required**: a default would be `Date.now`, which is the one thing a test
 *   cannot drive.
 * @returns A clean form with no history, no consent and nothing said.
 */
export function startMatchCreation(
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[],
  held: MatchId | null,
  clock: Clock
): MatchCreationSession {
  const destinations = destinationsOf(documents, views);
  const chosen =
    held !== null && destinations.some((one) => one.document === held.document)
      ? held.document
      : null;
  return {
    destinations,
    chosen,
    placement: defaultPlacement(destinations, held, chosen),
    held,
    // The base revision a creation is drafted from is the destination's, which is
    // not known until one is chosen and moves when it changes — `chooseDestination`
    // re-points it. What the draft needs a revision for is the acknowledgement
    // round trip, which binds consent to a candidate *and* a base. Since the first
    // review round's second finding it is also **what nothing downstream
    // substitutes**: `BrowserState.createMatch` forwards the base revision it is
    // handed rather than reading its own projection's, so a form opened at one
    // revision conflicts rather than commits against a file the window has since
    // re-read. What no type forces is that a caller hands it *this* revision;
    // `submission.baseRevision` is where it is.
    draft: startDraft(revisionOf(destinations, chosen), { trigger: '', replace: '' }, BUFFER_RULES),
    phase: 'editing',
    focus: null,
    group: null,
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    reload: NOT_RELOADING,
    closed: false,
    committed: false,
    created: null,
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    heldDeliveries: [],
    clock
  };
} // End of function startMatchCreation()

/**
 * The wait that restricts this form **now**, or `null` — the chosen file's entry
 * of {@link MatchCreationSession.awaitingReconciliation}, or, for a form naming no
 * file, the first entry it holds, since such a form is attributed to every file it
 * could write into.
 *
 * @param session - The form to ask about.
 * @returns The observation the form is waiting on, or `null`.
 */
function awaitedFor(session: MatchCreationSession): ExternalConflictObservation | null {
  const waits = session.awaitingReconciliation;
  if (session.chosen !== null) {
    return waits.get(session.chosen) ?? null;
  }
  const first = waits.values().next();
  return first.done === true ? null : first.value;
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
 * The revision one chosen destination was projected at, or the empty revision.
 *
 * **The empty string stands for "no file has been chosen, or the file chosen has
 * no projection"**, and it is safe for one reason worth stating exactly, because
 * the draft's base revision *is* what a caller sends: a form can only produce a
 * submission when {@link canCreate} answers `true`, which requires a chosen
 * destination whose eligibility is `eligible` — and an unprojected file is
 * `couldNotBeRead`, which is not. So the empty revision cannot reach the wire
 * unless a caller builds a submission some other way, which no function here does.
 *
 * @param destinations - Every file the form offers.
 * @param document - The file chosen, or `null`.
 * @returns The revision, or `''`.
 */
function revisionOf(
  destinations: readonly CreationDestination[],
  document: DocumentId | null
): ContentRevision {
  if (document === null) {
    return '';
  }
  return destinations.find((one) => one.document === document)?.revision ?? '';
} // End of function revisionOf()

/**
 * The chosen destination, or `null`.
 *
 * @param session - The form to ask about.
 * @returns The destination, or `null` when none is chosen or the chosen identity
 *   names no file this form holds.
 */
export function chosenDestination(session: MatchCreationSession): CreationDestination | null {
  const chosen = session.chosen;
  if (chosen === null) {
    return null;
  }
  return session.destinations.find((one) => one.document === chosen) ?? null;
} // End of function chosenDestination()

/**
 * The conflict the form is showing, of either origin, or `null`.
 *
 * **Widened to the union at Phase 2d-6-3**, from the save arm alone. The external
 * conflict is answered first, then the outcome's conflict arm — a definite answer
 * for a form built by hand with both populated, and a decision about nothing for
 * one this module built, because {@link applyObservation} and {@link applyCreate}
 * keep the two exclusive (the 2d-6 record's §3 entry 7).
 *
 * @param session - The form to ask about.
 * @returns The conflict model, or `null` when the form is not in one.
 */
export function conflictOf(session: MatchCreationSession): ConflictModel<CreationBuffers> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether this form accepts changes at all right now.
 *
 * Three reasons it may not, and each has its own refusal code below: not while a
 * save is in flight, not while a conflict of either origin is showing, and not
 * after a commit — because every destination this form holds was derived from a
 * projection that commit replaced.
 *
 * **A held observation is deliberately not among them** (Phase 2d-6-3): it is a
 * restriction on sending, and blocking keystrokes for a window decision that has
 * not been made would claim more than the fact supports. Nor is the one door a
 * destination-less form keeps open under an external conflict decided here — that
 * is {@link canChooseDestination}'s, and it is wider than this on purpose.
 *
 * @param session - The form to ask about.
 * @returns `true` when the controls may change anything.
 */
export function isEditable(session: MatchCreationSession): boolean {
  return (
    !session.closed &&
    session.phase === 'editing' &&
    !session.committed &&
    conflictOf(session) === null
  );
} // End of function isEditable()

/**
 * Whether this form is a destination-less one told of a change, whose only way
 * forward is an explicit destination — Phase 2d-6-3, the 2d-6 record's §3 entry 21.
 *
 * True exactly when the form is otherwise live, names no file, and an external
 * conflict stands over it. It reads the external field and never
 * {@link conflictOf}: a save conflict cannot arise on a form with no destination
 * through this module, and a hand-built one with both gets no destination door.
 *
 * @param session - The form to ask about.
 * @returns `true` when the form requires an explicit destination before anything
 *   else can happen to it.
 */
function requiresExplicitDestination(session: MatchCreationSession): boolean {
  return (
    !session.closed &&
    session.phase === 'editing' &&
    !session.committed &&
    session.chosen === null &&
    session.externalConflict !== null
  );
} // End of function requiresExplicitDestination()

/**
 * Whether the destination control does anything — Phase 2d-6-3.
 *
 * **Wider than {@link isEditable} by exactly one state**: a destination-less form
 * under an external conflict, for which naming a file is the resolution entry 21
 * requires and the one transition left open. Everywhere else the two agree. A
 * renderer that gated the destination control on `editable` alone would leave
 * that form with no way forward, so the view carries this as its own field.
 *
 * @param session - The form to ask about.
 * @returns `true` when {@link chooseDestination} may move the destination.
 */
export function canChooseDestination(session: MatchCreationSession): boolean {
  return isEditable(session) || requiresExplicitDestination(session);
} // End of function canChooseDestination()

/**
 * Everything the form must forget when the transaction it would send changes.
 *
 * **The submission's identity is the buffers *and* where they would go**, which
 * is the first review round's first finding. Consent is content-addressed to the
 * buffers alone — `draft.ts` cannot see a destination — so accepting the findings
 * of a refusal in file A, then retargeting to file B, left the acknowledgement
 * bound and `beginCreate` sent it: identical finding values authorising a
 * transaction nobody was shown.
 *
 * Three things go together here, and each on its own would be a half-fix: the
 * submission the consent was collected against, the outcome panel describing that
 * attempt, and the lines beside it. The typing run is closed too, so a keystroke
 * after a retarget opens a step of its own.
 *
 * **The consent itself is the caller's to drop**, because dropping it is a
 * transition on the *draft* and both callers already make one: `retargetedDraft`
 * for a change of destination, `withdrawnConsent` for a change of position. This
 * function installs whatever draft it is handed and cannot check that it carries
 * no consent — `Draft` exposes the field, so the check would be possible, but a
 * function that silently corrected its argument would hide the case where a caller
 * meant to keep it.
 *
 * @param session - The form.
 * @param draft - The draft to install, with its consent already withdrawn and its
 *   base already re-pointed if the destination moved.
 * @returns The form with nothing said about an attempt that no longer describes
 *   what would be sent.
 */
function withdrawnSubmission(
  session: MatchCreationSession,
  draft: Draft<CreationBuffers>
): MatchCreationSession {
  return {
    ...session,
    draft,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null
  };
} // End of function withdrawnSubmission()

/**
 * Chooses the file the snippet will be created in.
 *
 * **The placement is recomputed rather than kept**, which is the second half of
 * the consult's Q4: an anchor from another file, or from a revision this form no
 * longer holds, must not survive the change. Recomputing from scratch is what
 * makes that structural rather than a rule somebody has to remember to apply.
 *
 * **The draft is re-pointed at the newly chosen file's revision**, and everything
 * said about the last attempt is withdrawn ({@link withdrawnSubmission}). The
 * typed values are kept: they are what the person wrote, and they mean the same
 * thing in either file.
 *
 * **It is the one transition open to a destination-less form under an external
 * conflict, and it is that form's resolution** — Phase 2d-6-3, the 2d-6 record's
 * §3 entry 21. Such a form was told a file it *could* have written into changed;
 * what it is required to do is name the file it *does* write into, explicitly.
 * Naming the affected file keeps the conflict, rebuilt over the re-pointed draft,
 * so the form is then an ordinary destination conflict with the reload and the
 * reapply offered; naming any other file drops it, because the form no longer
 * writes into the file the observation was about. **The waits are left exactly as
 * they are** (the review of this phase, second finding): a wait about the file
 * left blocks nothing while the form is over another, and is there again, still
 * blocking, when the form comes back — see
 * {@link MatchCreationSession.awaitingReconciliation} for what that forces and
 * what it cannot. The draft's base becomes **the revision this window holds** for
 * the file named, never the observed disk revision: that is the retargeting entry
 * 21 forbids, and it is left to the reapply, which only a form naming the file may
 * reach. Nothing here adopts, installs or spends. Whether the form was told of
 * two affected files and shows the later one is stated on
 * {@link MatchCreationSession.externalConflict}; the command's own revision check
 * is what refuses a base this window was told is stale.
 *
 * @param session - The form.
 * @param document - The file to write into.
 * @returns The form with that destination, its default placement and a draft
 *   drafted from it, or the same form when it is not accepting a destination or
 *   the destination did not move.
 */
export function chooseDestination(
  session: MatchCreationSession,
  document: DocumentId
): MatchCreationSession {
  if (!canChooseDestination(session) || session.chosen === document) {
    return session;
  }
  const draft = retargetedDraft(session.draft, revisionOf(session.destinations, document));
  const chosen: MatchCreationSession = {
    ...withdrawnSubmission(session, draft),
    chosen: document,
    placement: defaultPlacement(session.destinations, session.held, document)
  };
  if (!requiresExplicitDestination(session)) {
    return chosen;
  }
  // **The explicit destination resolution.** The observation is read off this
  // module's own frozen model, and its `document` once.
  const conflict = session.externalConflict;
  const observation = conflict === null ? null : conflict.source.observation;
  const affected = observation !== null && observation.document === document;
  return {
    ...chosen,
    externalConflict:
      affected && observation !== null
        ? describeExternalConflict(observation, draft, CONFLICT_CAPABILITIES)
        : null,
    uncertaintyUnresolved: affected ? session.uncertaintyUnresolved : false,
    // A warning collected under the destination-less conflict, had one been
    // offered, is not spendable against the destination conflict (entry 12).
    reload: NOT_RELOADING
  };
} // End of function chooseDestination()

/**
 * Chooses where in the destination's list the snippet goes.
 *
 * An `after` naming a snippet that is not one of the chosen destination's own
 * anchors is **refused**, so an incompatible anchor cannot be installed by a
 * caller any more than it can survive a change of destination. The comparison is
 * all three fields of the identity, so an anchor from an older parse of the right
 * file is refused too.
 *
 * A placement that is accepted withdraws the last attempt, for
 * {@link chooseDestination}'s reason: *Front* and *After :sig* are two different
 * transactions, and findings accepted for one are not consent for the other. The
 * base revision does not move — the file has not changed.
 *
 * @param session - The form.
 * @param placement - Where the snippet should go.
 * @returns The form with that placement, or the same form when it is not
 *   accepting changes or the anchor does not belong to the chosen file.
 */
export function choosePlacement(
  session: MatchCreationSession,
  placement: CreationPlacement
): MatchCreationSession {
  if (!isEditable(session) || samePlacement(session.placement, placement)) {
    return session;
  }
  if (placement.kind === 'after') {
    const destination = chosenDestination(session);
    const anchor = placement.anchor;
    if (destination === null) {
      return session;
    }
    if (!destination.anchors.some((one) => sameIdentity(one, anchor))) {
      return session;
    }
  } // End of the arm that checks an anchor against the chosen file
  return { ...withdrawnSubmission(session, withdrawnConsent(session.draft)), placement };
} // End of function choosePlacement()

/**
 * The buffers with one field replaced.
 *
 * A named helper rather than a computed-key spread at the call site: the spread
 * widens the result's type, and this keeps the record exact.
 *
 * @param buffers - What the controls hold.
 * @param field - Which field to replace.
 * @param text - What it should hold.
 * @returns The new buffers.
 */
function withField(
  buffers: CreationBuffers,
  field: CreationField,
  text: string
): CreationBuffers {
  const next: Record<CreationField, string> = { ...buffers };
  next[field] = text;
  return next;
} // End of function withField()

/**
 * Records whatever one control now holds.
 *
 * **A value carrying a carriage return is refused here as well as at submit**,
 * and the redundancy is the same one `matchEditor.editField` documents: this is a
 * statement about *this function*, and the submit-time gate is a statement about
 * what reaches the wire. A control cannot produce one — its value has every line
 * break normalised, and an `<input>` deletes the character outright — so what this
 * closes is a caller that is not a control.
 *
 * @param session - The form.
 * @param field - Which field.
 * @param text - The control's whole value.
 * @returns The form after the edit, or the same form when it is not accepting
 *   changes, the text carries a carriage return, or nothing changed.
 */
export function editCreationField(
  session: MatchCreationSession,
  field: CreationField,
  text: string
): MatchCreationSession {
  if (!isEditable(session) || text.includes('\r')) {
    return session;
  }
  const recorded = recordTyping(
    session.draft,
    session.group,
    field,
    withField(session.draft.value, field, text),
    session.clock()
  );
  if (recorded === null) {
    return session;
  }
  return {
    ...session,
    draft: recorded.draft,
    focus: field,
    group: recorded.group,
    sendFailure: null
  };
} // End of function editCreationField()

/**
 * Records which control has the focus, ending the typing run when it moves.
 *
 * A blur is `focusCreationField(session, null)`; a change of focused field is a
 * call naming a different one. Focusing the field that already has the focus
 * changes nothing, so a spurious focus event does not split an undo step.
 *
 * @param session - The form.
 * @param field - The field that now has the focus, or `null` for a blur.
 * @returns The form with the focus recorded and the run closed when it moved.
 */
export function focusCreationField(
  session: MatchCreationSession,
  field: CreationField | null
): MatchCreationSession {
  if (session.focus === field) {
    return session;
  }
  return { ...session, focus: field, group: null };
} // End of function focusCreationField()

/**
 * Goes back one step.
 *
 * A structural action, so the typing run ends: a keystroke after an undo starts a
 * step of its own rather than amending the value the undo restored.
 *
 * @param session - The form to undo.
 * @returns The form one step back, or the same form when there is nothing to undo
 *   or it is not accepting changes.
 */
export function undoCreation(session: MatchCreationSession): MatchCreationSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = undoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function undoCreation()

/**
 * Goes forward one step, undoing an undo.
 *
 * @param session - The form to redo.
 * @returns The form one step forward, or the same form when there is nothing to
 *   redo or it is not accepting changes.
 */
export function redoCreation(session: MatchCreationSession): MatchCreationSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = redoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function redoCreation()

/**
 * Why this form cannot be submitted as it stands.
 *
 * **A code, never a sentence.** `creationRefusalKey` maps it to a dictionary key
 * and `tCreationRefusal` in `../i18n` renders it; a component never builds the
 * key.
 *
 * This is where creation differs from the small editor in a way worth naming:
 * `matchEditor.beginSave` answers a bare `null` and *cannot explain itself*,
 * because its own header says no signature there can carry a reason to a control
 * that was never drawn. Here every refusal has a code, so a screen can say why
 * the button does nothing.
 */
export type CreationRefusal =
  /** A create has already committed through this form. */
  | 'alreadyCreated'
  /** A save is in flight. */
  | 'saveInFlight'
  /** No file has been chosen. */
  | 'noDestination'
  /** A save conflict is on screen and has not been resolved. */
  | 'conflict'
  /**
   * A watcher observation raised a conflict over the chosen file, and it has not
   * been resolved — Phase 2d-6-3, the 2d-6 record's §3 entry 8.
   *
   * A code of its own rather than `conflict`, because that code's sentence says
   * the file changed *while this snippet was being written*, which is false of an
   * observation no save answered. Rendered through the external origin's own
   * first line (`browser.externalConflict.fileChangedWhileOpen`), which is the
   * reason exactly and adds no key.
   */
  | 'externalConflict'
  /**
   * The window holds a reading of the chosen file it has not decided about, and
   * this form may not send until it has — entry 8's "unresolved retained
   * delivery". Rendered through the retained notice's own sentence.
   */
  | 'observationRetained'
  /** The chosen file is one this application will not write a snippet into. */
  | 'destinationIneligible'
  /** The placement names a snippet the chosen file's projection does not hold. */
  | 'anchorUnavailable'
  /** The trigger is empty, and it is required. */
  | 'triggerEmpty'
  /** The body is empty, and it is required. */
  | 'replaceEmpty'
  /** A value carries a carriage return, which no control here could read back. */
  | 'carriageReturn';

/**
 * What one new snippet would say, derived from the buffers.
 *
 * Both values are **logical text**, never YAML: how each is spelled in the file —
 * plain, quoted, or a `|` block — is Rust's decision, made by the same encoder
 * every other value this application writes goes through.
 *
 * **This form authors two of {@link NewMatch}'s six fields, and that is a fact
 * about the form rather than about the type**: the four optional schema-known
 * fields are omitted here, which asks Rust to write no key for any of them. It is
 * not the same request as sending them empty.
 *
 * @param buffers - What the controls hold.
 * @returns The value `create_match` takes.
 */
export function newMatchOf(buffers: CreationBuffers): NewMatch {
  return { trigger: buffers.trigger, replace: buffers.replace };
} // End of function newMatchOf()

/**
 * Why the form cannot be submitted, or `null` when it can.
 *
 * The order of the checks is the order a person would fix them in: what the form
 * is doing, then where the snippet goes, then what stands over that file, then
 * what it says.
 *
 * **`noDestination` is asked before either conflict since Phase 2d-6-3**, because
 * for a destination-less form told of a change the destination *is* the
 * resolution (the 2d-6 record's §3 entry 21): the sentence a person needs first is
 * *choose the file*, and choosing one is what decides whether the conflict shown
 * is about the file this form writes into. A save conflict on a form with no
 * destination is a state this module never produces, so the move changes no
 * answer a save can reach. The conflicts come next in {@link conflictOf}'s
 * precedence — the external one, then the save one — and then a held reading
 * (entry 8), before the destination's eligibility: each a code, so a screen can
 * say why the button does nothing, and each rendered by a sentence that already
 * exists.
 *
 * **The carriage-return check reads the value that would be sent**, which is the
 * buffers here because both fields are always written — unlike the small editor,
 * where a field refused *for* carrying a carriage return legitimately holds one
 * in its buffer while sending `'Unchanged'`.
 *
 * **What this forces and what it does not**: it forces refusal for the form it is
 * handed; it cannot force that form to be current (R37) — one snapshot, one
 * synchronous decision.
 *
 * @param session - The form to ask about.
 * @returns The reason, or `null` when {@link beginCreate} would produce a
 *   submission.
 */
export function creationRefusal(session: MatchCreationSession): CreationRefusal | null {
  if (session.committed) {
    return 'alreadyCreated';
  }
  if (session.phase === 'saving') {
    return 'saveInFlight';
  }
  const destination = chosenDestination(session);
  if (destination === null) {
    return 'noDestination';
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
  if (destination.eligibility.kind !== 'eligible') {
    return 'destinationIneligible';
  }
  const placement = session.placement;
  if (
    placement.kind === 'after' &&
    !destination.anchors.some((anchor) => sameIdentity(anchor, placement.anchor))
  ) {
    return 'anchorUnavailable';
  }
  const buffers = session.draft.value;
  if (buffers.trigger === '') {
    return 'triggerEmpty';
  }
  if (buffers.replace === '') {
    return 'replaceEmpty';
  }
  if (buffers.trigger.includes('\r') || buffers.replace.includes('\r')) {
    return 'carriageReturn';
  }
  return null;
} // End of function creationRefusal()

/**
 * Whether the form may be submitted.
 *
 * @param session - The form to ask about.
 * @returns `true` when {@link creationRefusal} answers `null`.
 */
export function canCreate(session: MatchCreationSession): boolean {
  return creationRefusal(session) === null;
} // End of function canCreate()

/** A create about to be sent: the form that is waiting, and what to send. */
export interface StartedCreation {
  /** The form, now in flight, with the submission recorded on it. */
  readonly session: MatchCreationSession;
  /**
   * What was drafted, for the acknowledgement round trip and the history
   * boundary.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only
   * place the two are put together.
   */
  readonly submission: DraftSubmission<CreationBuffers>;
  /** The file to write into. */
  readonly document: DocumentId;
  /** What the new snippet says. */
  readonly newMatch: NewMatch;
  /** Where it goes in that file's list. */
  readonly position: NewMatchPosition;
}

/**
 * Reads the form a caller currently holds — the one its registered receiver has
 * been updating — for a door or a settling transition to check against.
 *
 * **The reader 2d-6-4 set on the three operation sessions, for this form**
 * (Phase 2d-6-6a; `ReadTheInstalledSession` in `./matchDeletion.ts` states the
 * class, and `ReadTheInstalledSession` in `./matchEditor.ts` is its twin):
 * {@link beginCreate} reads it once after its last caller-controlled read and
 * starts nothing for a form no longer installed; {@link reapplyToDiskVersion}
 * rechecks the installed form's blocks and conflict once, immediately before
 * adopting; {@link applyCreate} / {@link createCouldNotBeSent} replay whatever
 * the receiver appended to it during their own replay, round after round. Since
 * Phase 2d-6-6b {@link reloadTheDiskVersion} reads it too, before its adoption and
 * once more after it (raw's and restore's reload shape).
 *
 * **What it forces and what it does not, in the same sentence.** It is required,
 * so no call compiles without one, and `MatchCreator.svelte` passes one at every
 * call; what no type can force is that the closure reads the installed form
 * rather than a capture. `() => session` over the component's `$state.raw` is the
 * honest one, and for a door handed a form derived from the installed one in the
 * same synchronous block, the closure that answers the derived form while the
 * installed one is still the form it was derived from.
 *
 * @returns The form the caller holds now.
 */
export type ReadTheInstalledSession = () => MatchCreationSession;

/**
 * Starts a create of the form as it stands.
 *
 * The wire values are built from **the submission's own candidate** rather than
 * from the session, so the three values that travel together — the candidate, the
 * consent bound to it, and the `NewMatch` derived from it — cannot describe two
 * different things.
 *
 * **The carriage-return gate is repeated on the derived candidate**, and it is
 * not redundant: {@link creationRefusal} reads the live buffers, and this reads
 * what would actually be written. `NewMatch` carries **no brand**, unlike
 * `RoundTripText`, so a caller that builds one by hand type-checks — which is
 * exactly the caller this gate is for, since no control in this window can
 * produce the character at all.
 *
 * **Every caller-controlled read comes first, and the installed form is read
 * once, last** (Phase 2d-6-6a — 2d-6-5's `beginSave` shape in `./rawEditor.ts`):
 * {@link canCreate} is asked, the destination read, the submission taken, the
 * wire values derived and checked, and the waiting form spread; only then is the
 * installed form read through `current`, once. A form that is no longer the one
 * installed starts nothing, and nothing caller-controlled runs between that read
 * and the answer. What no type forces is that the reader is honest
 * ({@link ReadTheInstalledSession}), nor anything about a caller that redefines a
 * property of the very form it handed in: a receiver replaces a form and never
 * mutates one.
 *
 * @param session - The form to submit.
 * @param current - Reads the form the caller holds now. Required.
 * @returns The waiting form and everything the command takes, or `null` when
 *   {@link creationRefusal} names a reason or the form is no longer installed.
 */
export function beginCreate(
  session: MatchCreationSession,
  current: ReadTheInstalledSession
): StartedCreation | null {
  if (!canCreate(session)) {
    return null;
  }
  const destination = chosenDestination(session);
  if (destination === null) {
    return null;
  }
  const submission = submissionOf(session.draft);
  const newMatch = newMatchOf(submission.candidate);
  if (newMatch.trigger.includes('\r') || newMatch.replace.includes('\r')) {
    return null;
  }
  const started: StartedCreation = {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      group: null,
      sendFailure: null
    },
    submission,
    document: destination.document,
    newMatch,
    position: wirePosition(session.placement)
  };
  // **The installed form, read once, after the last caller-controlled read.**
  return current() === session ? started : null;
} // End of function beginCreate()

/**
 * Takes a create's answer.
 *
 * **Not sealed, and that is not an omission.** The seal of `./invalidation.ts`
 * exists because a whole-document replacement makes every identity in the file
 * stale with no single identity to answer with. A create has one:
 * `SavedResult.moved` is the snippet that was created, and
 * `BrowserState.createMatch` performs the adoption before this is ever called.
 *
 * On a `saved` arm the draft's base moves to the candidate that was sent, through
 * `savedDraft`, which is what makes the form clean rather than dirty against a
 * value that has been written. A **committed** save additionally spends the form:
 * `committed` is set, the created identity is recorded, and nothing here clears
 * either.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.** The
 * wrapper answers `adoption: { kind: 'failed' }` when the file was written and
 * this window could not read it back; telling the person the create failed would
 * invite a retry of a write that already happened (`PROGRESS.md` D2).
 *
 * **What it does about an external conflict, and about a delivery held during
 * the create** — Phase 2d-6-3, `applySave`'s rule in `./matchEditor.ts`. A
 * `saved` or a `conflict` answer retires {@link MatchCreationSession.externalConflict}
 * (the 2d-6 record's §3 entry 7: the create's own answer is the newer fact about
 * the file); a `refused` answer wrote nothing and leaves it standing. Neither is
 * reachable from {@link beginCreate} while an external conflict stands, so this
 * keeps the invariant for a caller that drove the model directly. Then, whatever
 * the answer, every delivery {@link applyObservation} held while the create was in
 * flight is replayed on top, in arrival order (entry 5) — and, through the
 * reader, every delivery the receiver appended to the installed form during this
 * transition's own replay (Phase 2d-6-6a, 2d-6-4's pattern (b);
 * {@link consumingHeldDeliveries}).
 *
 * @param session - The form waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.createMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @param current - Reads the form the caller holds now. Required.
 * @returns The form showing what the create ended as.
 */
export function applyCreate(
  session: MatchCreationSession,
  result: SaveResult,
  adoption: InvalidationStatus,
  current: ReadTheInstalledSession
): MatchCreationSession {
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
        group: null,
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
      // A commit replaced the bytes every destination here was derived from, so the
      // form stops accepting changes until it is seeded again. A `committed: false`
      // replaced nothing and spends nothing.
      committed: result.committed,
      created: result.moved,
      draft: savedDraft(session.draft, submission, result.revision),
      phase: 'editing',
      group: null,
      outcome,
      extraMessages,
      reload: NOT_RELOADING,
      sendFailure: null,
      // The create ended on the file, so the disk side an earlier observation
      // showed is no longer the comparison to draw (entry 7).
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    current
  );
} // End of function applyCreate()

/**
 * Replays every delivery a form held during its create, in the order it arrived,
 * once the create's own answer is on it — the 2d-6 record's §3 entry 5.
 *
 * `consumingHeldDeliveries` in `./matchEditor.ts`, for this form: the list is
 * emptied before the first replay so a replay cannot see itself in it, each
 * envelope goes through {@link applyObservation} exactly as it would have on
 * arrival, and each is applied to the form the one before it left — then, after
 * each round, the installed form is read through `current`, once, and the
 * envelopes it holds beyond the ones replayed are replayed too, in arrival order,
 * until a read finds none (Phase 2d-6-6a; `consumingHeldDeliveries` in
 * `./matchDeletion.ts` says why a replay runs caller code). **What this forces**
 * is that no envelope delivered during the create or during this settlement is
 * dropped when the reader answers the installed form, and that first-to-last is
 * the order; **what it cannot force** is that the window delivered them in the
 * order it decided them, that the reader is honest, that the installed list is
 * an extension of the one replayed — one that is not is left alone — or that the
 * rounds end for a getter that manufactures a fresh reading on every read.
 *
 * @param settled - The form with its create's answer applied and its phase back
 *   to `editing`.
 * @param current - Reads the form the caller holds now.
 * @returns The form with every held delivery applied, or the same form when none
 *   was held.
 */
function consumingHeldDeliveries(
  settled: MatchCreationSession,
  current: ReadTheInstalledSession
): MatchCreationSession {
  let queue = settled.heldDeliveries;
  let replayed: MatchCreationSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyObservation(replayed, queue[at]!);
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
 * Whether one held list is the other with more appended: the same envelopes, by
 * identity, in the same positions — `extendsTheReplayed` in `./matchDeletion.ts`,
 * for this form.
 *
 * @param arrived - The installed form's list.
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
 * Records that the create produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are "no" and "this application cannot
 * tell". The draft is untouched either way, so nothing the person typed is lost.
 *
 * @param session - The form waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the new snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent and
 *   the boundary therefore has no rejection to hand on.
 * @param current - Reads the form the caller holds now, for the replay's rounds
 *   ({@link applyCreate}'s reason). Required.
 * @returns The form, back to drafting, with the right notice raised.
 */
export function createCouldNotBeSent(
  session: MatchCreationSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null,
  current: ReadTheInstalledSession
): MatchCreationSession {
  // The create is over, so a delivery held while it was out is applied now — the
  // settlement of an uncertain write arbitrates the held reading under that
  // uncertainty, and its `raisedWithoutReload` is what this applies (entry 5).
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      group: null,
      sendFailure: sendFailureOf(mayHaveWritten, reason)
    },
    current
  );
} // End of function createCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the form rather than from an argument, so a caller cannot pair one candidate's
 * acknowledgement with another candidate.
 *
 * @param session - The form showing a refusal.
 * @returns The form carrying consent, or the same form.
 */
export function acknowledgeCreationFindings(
  session: MatchCreationSession
): MatchCreationSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeCreationFindings()

/**
 * Puts the outcome away and gives the controls back.
 *
 * *Keep editing*, for all three arms. The draft is untouched — this is a panel
 * being dismissed, not a state being resolved — and the submission goes with it,
 * because there is nothing left on screen to acknowledge.
 *
 * **It does not give the controls back after a commit**, and that is deliberate:
 * {@link MatchCreationSession.committed} lives on the form and survives this, so
 * a person cannot dismiss their way past the re-seed a commit owes.
 *
 * **Nor does it erase an external block** — Phase 2d-6-3, the 2d-6 record's §3
 * entry 9. {@link MatchCreationSession.externalConflict},
 * {@link MatchCreationSession.uncertaintyUnresolved} and
 * {@link MatchCreationSession.awaitingReconciliation} all survive this spread:
 * what this dismisses under an external conflict is the save outcome's panel and
 * the reload warning, and the conflict and both restrictions stand until an
 * explicit resolution — the reload's confirmation, a reapply, an explicit
 * destination, or closing. What the spread forces is that the three fields are
 * copied; what no type forces is that a later edit keeps them out of the literal,
 * and the suite's case is what would notice.
 *
 * @param session - The form showing an outcome.
 * @returns The form with nothing being said about the last attempt.
 */
export function keepDrafting(session: MatchCreationSession): MatchCreationSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function keepDrafting()

/**
 * The conflict a reload may be asked about, or `null` when none may be — Phase
 * 2d-6-3, the reload gate of the 2d-6 record's §3 entries 11 and 21 as one rule
 * for the three reload steps below.
 *
 * Withheld in two states. Under an unacknowledged write uncertainty, for the
 * match editor's reason: a confirmed installation of bytes a write of this window
 * may or may not have produced would settle silently what only the person can.
 * And for a destination-less form told of a change (entry 21): a reload adopts
 * the observed file into the window and closes this form, which is the adoption of
 * a file the person never named — the resolution such a form requires is an
 * explicit destination, after which the reload is offered for the file named. The
 * view withholds the control through the same facts, and the three transitions
 * refuse it, so a call made past the withheld control changes nothing (entry 8).
 *
 * @param session - The form to ask about.
 * @returns The conflict, or `null` when there is none or its reload is withheld.
 */
function reloadableConflictOf(session: MatchCreationSession): ConflictModel<CreationBuffers> | null {
  return session.uncertaintyUnresolved || requiresExplicitDestination(session)
    ? null
    : conflictOf(session);
} // End of function reloadableConflictOf()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing, one has already been asked about, or the reload is withheld
 *   ({@link reloadableConflictOf}).
 */
export function askToReloadDiskVersion(session: MatchCreationSession): MatchCreationSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReloadDiskVersion()

/**
 * Confirms abandoning this new snippet for the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmDiskReload(session: MatchCreationSession): MatchCreationSession {
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmDiskReload()

/**
 * Adopts the disk version into the window and ends this session.
 *
 * **The match-level reload the consult's Q3 ruled, and it is not a reseed.** There
 * is no disk-side `CreationBuffers` to load: a file on disk holds no half-written snippet, and inventing one would be this application making up content nobody typed. So the window crosses to the disk
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
  session: MatchCreationSession,
  adopt: AdoptTheDiskVersion<CreationBuffers>,
  current: ReadTheInstalledSession
): MatchCreationSession {
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
    // nothing. *Keep editing* writes NOT_RELOADING back.
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
      group: null,
      submitted: null,
      outcome: null,
      extraMessages: [],
      reload: NOT_RELOADING,
      sendFailure: null,
      // The conflict of either origin is resolved by the reload that ends this
      // form, and a closed form says nothing about any file any more.
      externalConflict: null,
      uncertaintyUnresolved: false,
      awaitingReconciliation: new Map(),
      closed: true
    },
    current
  );
} // End of function reloadTheDiskVersion()

/**
 * Takes the window's decision about one watcher observation — Phase 2d-6-3, the
 * 2d-6 record's §3 entries 6, 7, 11, 12 and 21.
 *
 * **The form's receiver, as a value**, in the shape `applyObservation` in
 * `./matchEditor.ts` established: a component registers a function through
 * `BrowserState.registerObservationReceiver` that calls this with the envelope and
 * installs what comes back (`MatchCreator.svelte`, since Phase 2d-6-6b), and the decision is here so a
 * suite can drive every arm without a window. It never re-arbitrates and reads
 * none of the window's tables.
 *
 * **Every verdict has a named action, switched with a `never` terminus** (entry
 * 11, plus the seventh arm Phase 2d-6-1b added):
 *
 * | Verdict | What this does, for a delivery about this form |
 * |---|---|
 * | `raised` | builds the external model from the observation and the retained draft |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its draft kept, its disk side replaced |
 * | `coalesced` | keeps the model, its source identity and the reload step |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on sending; no disk comparison, no origin |
 * | `writtenHere` | lifts the restriction recorded for that observation, and changes nothing else |
 *
 * **Which deliveries are about this form is this form's own question**, and the
 * answer is the module header's: every one while no destination is chosen — the
 * form is then attributed to every creator-eligible file, and a change to any of
 * them is the affected file's state it must show (entry 21) — and those about the
 * chosen file once one is. A delivery about another file can only end a wait
 * recorded for that very observation, by identity, under that file's key; a
 * `retained` about another file records nothing. To decide that, this reads
 * **one** property of the observation, `document`, once — the editor reads none —
 * and the envelope's two fields and the verdict's `kind`, once each, before
 * anything is decided.
 *
 * **Every replacing verdict resets the reload step and retires a save conflict**
 * (entries 7 and 12), and a displayed reapply result is invalidated by the same
 * transition because `reapplyToShow` in `./reapply.ts` pairs a report to a form by
 * identity. `supersedes` builds through `supersedeConflict` when a conflict is
 * shown and through `describeExternalConflict` over the form's draft when none
 * is; the `superseded` origin the verdict names is not compared with the shown
 * conflict's — the envelope is the window's decision about the file, and a form
 * that re-checked it would be arbitrating.
 *
 * **During this form's own create the envelope is appended to the held list, not
 * applied** (entry 5): see {@link MatchCreationSession.heldDeliveries}. A closed
 * form takes nothing.
 *
 * **What it forces and what it does not, in the same sentence.** It forces that
 * every arm of `ObservationVerdict` has an action here — an eighth arm is a
 * compile error at the terminus — and that no arm installs, adopts, spends or
 * calls a command, which its signature cannot prove and the command spy at zero
 * in `workspace.test.ts` does. It cannot force that a component registers it,
 * over which files, or installs what it answers; nor that the envelope was sealed
 * by the window rather than assembled by hand.
 *
 * @param session - The form.
 * @param delivery - What the window decided, sealed with the observation.
 * @returns The form after the decision, or the same form when the verdict
 *   changes nothing about it.
 */
export function applyObservation(
  session: MatchCreationSession,
  delivery: ObservationDelivery
): MatchCreationSession {
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
  const about = session.chosen === null || session.chosen === file;
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
} // End of function applyObservation()

/**
 * The form after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of {@link applyObservation}, which
 * documents what happens here; this is the one place the external model is built
 * for this surface from a delivery.
 *
 * @param session - The form, not closed and not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The form showing the new conflict.
 */
function replacedBy(
  session: MatchCreationSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): MatchCreationSession {
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
    group: null,
    // Entry 12: the confirmation collected for the conflict that was on screen is
    // not spendable against this one, and the warning it was collected under must
    // not stay on screen saying the wrong thing (the record's §5.7).
    reload: NOT_RELOADING
  };
} // End of function replacedBy()

/**
 * Records that the person has reviewed the disk snapshot and the window has ended
 * the uncertainty hold — Phase 2d-6-3, the 2d-6 record's §3 entries 14 and 15.
 *
 * `acknowledgeSnapshot` in `./matchEditor.ts`, for this form, taking the same
 * two-valued callback: it rebuilds the conflict's availability and nothing else —
 * the ordinary reload is offered again from its idle step and the reapply is no
 * longer refused for the uncertainty — installing nothing, minting no consent and
 * re-observing nothing. Asked at most once per call and only when there is
 * something to end; a `refused` leaves the form unchanged. What it cannot see is
 * a hold the window ended without a delivery, stated on
 * {@link MatchCreationSession.uncertaintyUnresolved}.
 *
 * @param session - The form showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The form with its reload and reapply available again, or the same
 *   form.
 */
export function acknowledgeSnapshot(
  session: MatchCreationSession,
  acknowledge: AcknowledgeTheUncertainty
): MatchCreationSession {
  const conflict = session.externalConflict;
  if (session.closed || conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeSnapshot()

/**
 * Why a reapply of this form could not be carried out.
 *
 * **A code, never a sentence.** There is no key function for these yet, and that is
 * 2c-4b-2's boundary: nothing draws them, so 2c-4b-3 adds the accessors together
 * with the panel that renders them.
 */
export type CreationReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /** The search for the snippet this form places the new one **after** refused. */
      readonly kind: 'anchorCorrespondence';
      /** The wire's own code, which `tReapplyRefusal` already has sentences for. */
      readonly reason: ReapplyRefusal;
    }
  | {
      /**
       * The evidence answers no anchor although this form names one.
       *
       * **Unreachable from the running application**: `create_match` builds an
       * anchored placement whenever it sends an `After`. A `ReapplyEvidence` is a
       * boundary value and nothing in TypeScript proves which command produced one,
       * and treating the disagreement as a refusal writes nothing.
       */
      readonly kind: 'evidenceNotAnAnchor';
    }
  | {
      /** The identified anchor is not one the newly parsed destination holds. */
      readonly kind: 'anchorNotInDestination';
    }
  | {
      /**
       * The conflict is about a file this form is not writing into.
       *
       * **Unreachable through this module's transitions**, and checked rather than
       * assumed because a rebase against the wrong file's projection would install
       * another file's anchors under this form's destination. For a form that
       * names a file, {@link isEditable} is `false` under a conflict and
       * {@link chooseDestination} refuses, so the destination cannot move between
       * the send and the reapply, and {@link applyObservation} records no conflict
       * about another file. The one form {@link chooseDestination} accepts under a
       * conflict names none (Phase 2d-6-3): its reapply is refused as
       * `destinationRequired` first, naming the affected file keeps a conflict
       * about that file, and naming another drops the conflict.
       */
      readonly kind: 'notTheDestination';
    }
  | {
      /**
       * The rebuilt form cannot be submitted, for one of the ordinary reasons.
       *
       * {@link creationRefusal}'s own verdict over the newly parsed projection —
       * the destination is no longer a writable snippet file, the anchor is gone,
       * a required field is empty. One rule, asked again, rather than a second copy
       * of it here.
       */
      readonly kind: 'creationRefused';
      /** Which of that rule's codes, for the panel to render. */
      readonly reason: CreationRefusal;
    }
  | {
      /**
       * The form names no file, so there is nothing to re-point at the observed
       * one — Phase 2d-6-3, the 2d-6 record's §3 entry 21.
       *
       * **The unknown-target reapply is a refusal, not a choice.** Re-pointing the
       * draft at the observed file's revision would be choosing that file for the
       * person, and the resolution such a form requires is an explicit
       * destination. Refused before any evidence is read and before the door;
       * rendered through `browser.matchCreation.cannotCreate.noDestination`,
       * which is the sentence exactly and adds no key.
       */
      readonly kind: 'destinationRequired';
    }
  | {
      /**
       * The external observation's correspondence could not be used to find the
       * anchor — Phase 2d-6-3, the record's §3 entries 20 and 22.
       *
       * Five reasons, all about the evidence and never about the file: the reading
       * carried no table, the table's base or disk revision is not this
       * conflict's, or the table names the anchor's base identity in no row or in
       * more than one. **Reachable only for an `after` placement**: a `front` or
       * `end` asks the table nothing, so a refused table refuses nothing it asked
       * for. Rendered through `tExternalEvidenceRefusal`.
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
       * 8 and 11). A reapply hands back a form whose ordinary *Add* is live, and
       * one rebuilt over the adopted snapshot would carry no record of the wait;
       * so it is refused before any evidence is read. Rendered through the retained
       * notice's own sentence.
       */
      readonly kind: 'observationRetained';
    };

/** What a reapply of this form became. */
export type MatchCreationReapply = ReapplyOutcome<MatchCreationSession, CreationReapplyObstacle>;

/** One reapply attempt this panel made, tied to the session it left behind. */
export type CreationReapplyAttempt = ReapplyAttempt<
  MatchCreationSession,
  CreationReapplyObstacle
>;

/**
 * The dictionary key holding one reapply obstacle's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link CreationReapplyObstacle} with no sentence is one too. The two
 * shared arms delegate to {@link sharedReapplyObstacleKey}, and the two anchor arms
 * share the mover's keys, because there the claim really is the same claim about
 * the same kind of thing.
 *
 * **The nested reasons are second lines and not part of these keys.** Both
 * `anchorCorrespondence`'s {@link ReapplyRefusal} and `creationRefused`'s
 * {@link CreationRefusal} already have their own sentences and accessors; the i18n
 * layer composes them.
 *
 * @param obstacle - What stopped the reapply.
 * @returns The key holding that obstacle's sentence.
 */
export function creationReapplyObstacleKey(obstacle: CreationReapplyObstacle): TranslationKey {
  switch (obstacle.kind) {
    case 'anchorCorrespondence':
      return 'browser.reapply.obstacle.anchorCorrespondence';
    case 'evidenceNotAnAnchor':
      return 'browser.reapply.obstacle.evidenceNotAnAnchor';
    case 'anchorNotInDestination':
      return 'browser.matchCreation.reapply.anchorNotInDestination';
    case 'notTheDestination':
      return 'browser.matchCreation.reapply.notTheDestination';
    case 'creationRefused':
      return 'browser.matchCreation.reapply.creationRefused';
    case 'correspondence':
    case 'evidenceNotATarget':
      return sharedReapplyObstacleKey(obstacle);
    case 'destinationRequired':
      // The refusal's own sentence, through its own key function: *choose the
      // file this snippet should be added to* is the reason exactly.
      return creationRefusalKey('noDestination');
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
} // End of function creationReapplyObstacleKey()

/**
 * The destination one file's newly parsed projection is, for a rebuilt form.
 *
 * `destinationOf` takes a `DocumentSummary` and this takes the projection, because
 * a reapply has the projection and not the summary: the conflict carries
 * `ConflictModel.disk`, and re-deriving the destination from a summary the form
 * captured earlier would mix an old read's facts into a new one's. Every field a
 * summary contributes — the identity, the relative path, the kind, the read-only
 * flag — a `DocumentView` carries itself.
 *
 * **The anchors are plain copies**, for `startMatchMove`'s reason: a projection a
 * screen holds comes out of `$state` and is deeply proxied, and the draft's
 * `structuredClone` snapshot throws on a proxy. `choosePlacement` here validates an
 * anchor and installs the **caller's** object rather than its own copy, unlike the
 * mover's, so the copy has to be made before it is offered.
 *
 * @param view - The file's newly parsed projection.
 * @returns The destination to put in the rebuilt form.
 */
function destinationOfProjection(view: DocumentView): CreationDestination {
  return {
    document: view.id,
    path: view.relative_path,
    revision: view.revision,
    eligibility: destinationEligibility(view, view),
    anchors: view.matches.map((match) => plainIdentity(match.id))
  };
} // End of function destinationOfProjection()

/**
 * The placement a reapply asks for, rebuilt against the newly parsed destination.
 *
 * `front` and `end` are handed back untouched: they are semantic choices and the
 * command lowers them against whatever list it finds, so a change to the file's
 * snippets does not change what they mean — **and they ask the evidence nothing**,
 * which is why the evidence is read only for an `after`. An `after` is replaced by
 * the anchor the evidence identified — never by the old one, whose revision
 * belongs to a parse that is gone — and the replacement is taken **from the
 * rebuilt destination's own anchors**, so what is installed is that list's plain
 * copy.
 *
 * **Both origins since Phase 2d-6-3** (the 2d-6 record's §3 entries 19, 20 and
 * 22), through {@link anchorOfEvidence}: a refused save's anchor is read as
 * before; an external table is searched for the anchor's **full** base identity
 * and the row's `exact` tier read as the anchor; a refused table refuses the
 * `after` it was asked about; superseded evidence refuses whatever the placement.
 *
 * @param placement - What the form asked for.
 * @param evidence - Which evidence the conflict's origin offers.
 * @param destination - The newly parsed destination, for its anchors.
 * @returns The placement to hold, or the obstacle that stops the reapply.
 */
function rebuiltPlacement(
  placement: CreationPlacement,
  evidence: ReapplyEvidenceAccess,
  destination: CreationDestination
): { readonly placement: CreationPlacement } | { readonly obstacle: CreationReapplyObstacle } {
  if (evidence.kind === 'superseded') {
    return { obstacle: { kind: 'supersededEvidence' } };
  }
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
  const held = destination.anchors.find((one) => sameIdentity(one, identity));
  return held === undefined
    ? { obstacle: { kind: 'anchorNotInDestination' } }
    : { placement: { kind: 'after', anchor: held } };
} // End of function rebuiltPlacement()

/**
 * The anchor one conflict's evidence names for this form's `after` placement, or
 * why it names none — the origin switch of {@link rebuiltPlacement}, Phase 2d-6-3.
 *
 * **Three arms in, and each has its own answer** (the 2d-6 record's §3 entry 19;
 * the fourth, `superseded`, is answered by the caller before any placement is
 * read). Save evidence is read through `anchorCorrespondence`, as it always was.
 * An external table is searched through `correspondenceRowFor` for the anchor's
 * **full** base identity — the identity this form holds for it, minted from the
 * parse the draft was placed against — and the found row's `exact` tier is read
 * through `anchorResolution` (entry 20: "the anchor's `exact` from the same
 * table"), exactly once. A refused table or row resolves to manual resolution
 * with `tExternalEvidenceRefusal`'s sentence (entry 22). Nothing here is cast: a
 * row is a row and a `ReapplyEvidence` is a `ReapplyEvidence`.
 *
 * @param evidence - What `enterReapply` found the conflict's origin to offer,
 *   never `superseded`.
 * @param anchor - The snippet the form places the new one after, by the identity
 *   the base parse minted.
 * @returns The anchor answer to work from, or the manual resolution to answer
 *   with.
 */
function anchorOfEvidence(
  evidence: Exclude<ReapplyEvidenceAccess, { readonly kind: 'superseded' }>,
  anchor: MatchId
): AnchorCorrespondence | { readonly obstacle: CreationReapplyObstacle } {
  switch (evidence.kind) {
    case 'saveEvidence':
      return anchorCorrespondence(evidence.evidence);
    case 'externalCorrespondence': {
      const row = correspondenceRowFor(evidence.correspondences, anchor);
      if (row.kind === 'refused') {
        return { obstacle: { kind: 'externalEvidence', reason: row.reason } };
      }
      // **The row's exact tier, read once.** `exact` is the one field of the row
      // this form reads; `editor` is the match editor's flexible tier and is not
      // looked at for a position.
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
 * The guard {@link reapplyToDiskVersion} uses when its caller hands none in.
 *
 * `unaskedGuard` in `./matchEditor.ts`, for this form: it answers the shown
 * conflict's own origin, so the supersession question the entry asks last is answered
 * *yes, it stands* without the window being asked. It exists for a caller that
 * passes `null`; since Phase 2d-6-6b no component does — each hands the live
 * `BrowserState.standingConflictFor` closure down — so only a model suite reaches
 * it, and what it costs is stated on the caller.
 *
 * @param conflict - The conflict shown, or `null`.
 * @returns A guard that never asks the window.
 */
function unaskedGuard(conflict: ConflictModel<CreationBuffers> | null): StandingOriginGuard {
  const source: ConflictSource | null = conflict === null ? null : conflict.source;
  return (): ConflictSource | null => source;
} // End of function unaskedGuard()

/**
 * Re-points this form at the newly parsed disk version and revalidates it.
 *
 * **The consult's Q4 for the creator, which is the targetless surface**: there is
 * no snippet to identify, because a creation brings its own. For the save origin
 * `subjectIsTargetless` is what says so, and it is the one place `Targetless` is
 * told apart from `Unsupported` — the two are two facts, and a whole-document
 * save's *there is nothing here to reapply at all* must not be read as a
 * creation's *there is nothing to find*. For the external origin there is no
 * subject to ask about at all: the table is consulted for the anchor of an `after`
 * placement and for nothing else (the 2d-6 record's §3 entry 20 — "creation
 * targetless with no invented `MatchId`").
 *
 * What is retained is the {@link CreationBuffers} the person typed. What is rebuilt
 * is everything around them:
 *
 * - the destination, from `ConflictModel.disk` — the projection paired with the
 *   revision the conflict reported;
 * - the draft's **base revision**, through `retargetedDraft`, which withdraws the
 *   consent in the same call: findings accepted for one revision's candidate say
 *   nothing about another's, and the acknowledgement round trip starts again;
 * - `front` and `end`, which keep their meaning and are lowered by the command
 *   against the new list; an `after`, which survives **only** on exact anchor
 *   correspondence;
 * - every ordinary creation check, through {@link creationRefusal}: the destination
 *   is still a parsed writable snippet file with a match list, the anchor is still
 *   one of its own, and the two fields are still non-empty and free of carriage
 *   returns.
 *
 * **There is no `alreadySatisfied` arm, and there must not be one.** *Somebody else
 * already added this snippet* would mean comparing the drafted trigger against the
 * file's — a duplicate-trigger precheck the consult's Q4 refuses to add, because
 * the candidate's own findings and the content-addressed acknowledgement protocol
 * are what decide that, at the command, for the newly derived candidate.
 *
 * **Both origins since Phase 2d-6-3, through one entry** (entries 19, 20 and 22):
 * `enterReapply` in `./reapply.ts` answers `reapplyEvidenceFor`'s four arms and
 * {@link rebuiltPlacement} switches over them. **Three refusals come before any
 * evidence is read**, in this order, whenever a conflict is shown: an
 * unacknowledged write uncertainty (entry 22 — a reapply ends in an adoption,
 * which the uncertainty withholds); a reading the window holds undecided (entry
 * 8 — a form rebuilt over the adopted snapshot would carry no record of the wait,
 * and the blocked send would go through it); and a form that names no file
 * (entry 21 — the unknown-target reapply is a refusal, not a choice: re-pointing
 * the draft at the observed file would choose that file for the person). Since
 * Phase 2d-6-6a they are asked **before** `enterReapply`, which reads the
 * observation's table (2d-6-4's finding 4); before that landing the entry came
 * first and this sentence claimed an order the code did not have. The view
 * withholds the control through the same facts; these are the rules for a call
 * made past it.
 *
 * **The two blocks and the conflict's identity are asked again of the installed
 * form, once, immediately before the adoption** (Phase 2d-6-6a — 2d-6-4's
 * pattern (c)): every read between the entry and the door — the anchor's row and
 * its `exact` tier, the disk projection the destination is rebuilt from, the
 * rebuilt form's own refusal rule over it — is a read of caller data, and a
 * getter there can tell the window of a reading whose receiver records a wait,
 * an uncertainty or a new conflict on the installed form. So the adoption is
 * refused `observationRetained` or `writeOutcomeUnknown` when the installed form
 * now carries either, and `supersededEvidence` when the conflict it shows is no
 * longer the one being reapplied; otherwise the rebuilt form carries the
 * **installed** form's waits forward, so a wait about another file recorded
 * during the reads survives the rebuild. The three facts are read off the
 * installed form and — since 2d-6-6b's review, its one blocker — one last look
 * follows them (a form displaced meanwhile is answered `supersededEvidence`), so
 * nothing caller-controlled runs between the last look and the adoption; after
 * the adoption the answer is likewise built before a last look. **The installed form is read once more after the
 * adoption** (the 2d-6-6a review, its first finding — 2d-6-5's reload shape):
 * `adoptDiskVersion` copies the observation's projection, and a getter there can
 * tell the window of a reading the receiver records while the door is still
 * inside `adopt`; a form now showing another conflict is not rebuilt over
 * (`supersededEvidence`, and the caller keeps the installed form), and the waits
 * the rebuilt form carries are the ones read then; what no type forces is that the reader is honest
 * ({@link ReadTheInstalledSession}).
 *
 * **The standing-origin guard is a parameter, and `null` is accepted for one
 * stated reason** — `reapplyToDiskVersion` in `./matchEditor.ts`'s:
 * `MatchCreator.svelte` has handed the live
 * `BrowserState.standingConflictFor` closure down since Phase 2d-6-6b and passes
 * no `null`, and the parameter stays nullable; the
 * parameter is nullable rather than defaulted since Phase 2d-6-6a, so that the
 * required reader can follow it. When no guard is handed in the supersession
 * question is not asked by the entry; what still refuses a
 * superseded origin on that path is `adoptDiskVersion`'s fourth check, at the
 * door, answered `adoptionRefused` without the typed sentence. An omitted guard
 * costs a sentence and some work, never a wrong installation.
 *
 * **What no type here forces**: that `adopt`'s body does anything, that a caller
 * stops on `adoptionRefused`, that the form handed back is installed, or that the
 * guard a caller passes asks the window rather than the conflict. What is closed
 * is that no path here writes, calls a command, or adopts anything before the
 * whole rebase has been decided.
 *
 * @param session - The form showing the conflict.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never at
 *   all on a refusal.
 * @param standing - Asks what origin stands for the file **now**;
 *   `() => browser.standingConflictFor(document)` is the honest closure. `null`
 *   asks nothing — see above for what that costs.
 * @param current - Reads the form the caller holds now, for the recheck before
 *   the adoption. Required.
 * @returns What became of the attempt.
 */
export function reapplyToDiskVersion(
  session: MatchCreationSession,
  adopt: AdoptTheDiskVersion<CreationBuffers>,
  standing: StandingOriginGuard | null,
  current: ReadTheInstalledSession
): MatchCreationReapply {
  const conflict = conflictOf(session);
  const held = chosenDestination(session);
  if (conflict !== null) {
    // **Before the entry, which reads the evidence.** A blocked form reads none
    // of it.
    if (session.uncertaintyUnresolved) {
      return { kind: 'manualResolution', obstacle: { kind: 'writeOutcomeUnknown' } };
    }
    if (awaitedFor(session) !== null) {
      return { kind: 'manualResolution', obstacle: { kind: 'observationRetained' } };
    }
    if (held === null) {
      return { kind: 'manualResolution', obstacle: { kind: 'destinationRequired' } };
    }
  }
  const entry = enterReapply(CONFLICT_CAPABILITIES, conflict, standing ?? unaskedGuard(conflict));
  if (entry.kind !== 'ready') {
    return entry;
  }
  if (held === null) {
    // Unreachable once a conflict is shown — refused above — and the entry
    // answers before this for a form showing none; kept so the narrowing below is
    // the type's rather than an argument about reachability.
    return { kind: 'manualResolution', obstacle: { kind: 'destinationRequired' } };
  }
  const evidence = entry.evidence;
  if (evidence.kind === 'saveEvidence' && !subjectIsTargetless(evidence.evidence)) {
    return { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } };
  }
  const disk = entry.conflict.disk;
  if (held.document !== disk.id) {
    return { kind: 'manualResolution', obstacle: { kind: 'notTheDestination' } };
  }
  const destination = destinationOfProjection(disk);
  const wanted = rebuiltPlacement(session.placement, evidence, destination);
  if ('obstacle' in wanted) {
    return { kind: 'manualResolution', obstacle: wanted.obstacle };
  }
  const rebuilt: MatchCreationSession = {
    ...session,
    destinations: session.destinations.map((one) =>
      one.document === disk.id ? destination : one
    ),
    placement: wanted.placement,
    // Re-pointed at the destination's new revision, with the consent withdrawn in
    // the same call. The typed values are untouched: they are what the person
    // wrote, and they mean the same thing against either parse.
    draft: retargetedDraft(session.draft, disk.revision),
    phase: 'editing',
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null,
    reload: NOT_RELOADING,
    // The conflict of either origin is what this resolves, and the uncertainty
    // with it; the waits are carried, for `rebuiltOver`'s reason in
    // `./matchEditor.ts` — the destination's is absent on every path this module
    // takes, because the refusal above comes first, and the map is carried so the
    // rebuild's honesty does not depend on that refusal's position, and so a wait
    // about another file survives the rebuild.
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: session.awaitingReconciliation
  };
  const refusal = creationRefusal(rebuilt);
  if (refusal !== null) {
    return { kind: 'manualResolution', obstacle: { kind: 'creationRefused', reason: refusal } };
  }
  // **The installed form, read after the last caller-controlled read of the
  // reapply's own**; its three facts below are read off it, and a last look
  // follows them, before the door (2d-6-6b's review).
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
  // **Everything the spend needs, taken now, then one last look** (2d-6-6b's
  // review, its one blocker): the three reads above are of the installed
  // session, which is caller data, and a getter or `Proxy` trap among them can
  // displace it. The authorization reads the conflict's origin, so it is minted
  // before the look too; after it nothing caller-controlled runs before the door.
  const adopted = entry.conflict;
  const authorization = reapplyAuthorizationFor(adopted);
  if (current() !== installed) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  if (adopt(adopted, authorization) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  // **Read again after the adoption**, which read caller data of its own (the
  // 2d-6-6a review, its first finding): another conflict is not rebuilt over, and
  // a wait recorded during the adoption is carried.
  const settled = current();
  if (conflictOf(settled)?.source !== entry.conflict.source) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  // **Built first, then one last look at the installed session** (2d-6-6b's
  // review): every read of the settled session above is caller data, and a
  // session displaced during them is not rebuilt over; nothing caller-controlled
  // runs after the look.
  const result: MatchCreationReapply = {
    kind: 'reapplied',
    session: { ...rebuilt, awaitingReconciliation: settled.awaitingReconciliation }
  };
  if (current() !== settled) {
    return { kind: 'manualResolution', obstacle: { kind: 'supersededEvidence' } };
  }
  return result;
} // End of function reapplyToDiskVersion()

/**
 * What this surface offers about a conflict.
 *
 * **`draftKind` is the permanent fact and the two booleans are not.**
 * {@link CreationBuffers} holds the trigger and the replacement a person typed, so
 * the consult's Q3/Q4 rule gives this surface *Copy draft* — labelled, never
 * YAML — and a confirmed reload that installs the disk projection and **closes**
 * the form, because there is no disk-side `CreationBuffers` to reload.
 *
 * **Both booleans were flipped at 2c-4a-3a, over machinery that already existed.**
 * {@link askToReloadDiskVersion}, {@link confirmDiskReload} and
 * {@link reloadTheDiskVersion} are the transition — built and wired at 2c-4a-2 and
 * driven by this module's own suite since then — and `MatchCreator.svelte`'s
 * `conflictAction` calls them from the two controls `conflictChoicesFor` now names.
 * The copy is {@link MatchCreationView.retainedDraft} put through `tDraftCopy`: the
 * two typed strings under their labels, **never YAML**.
 *
 * **The destination and the position are not in the copy**, and that is the
 * consult's Q4 read exactly: `Draft<CreationBuffers>` holds neither, so a copy
 * that named them would be describing something the retained draft does not
 * carry. They stay on screen in the form above the panel.
 *
 * **`offersReapply` is `true` as of 2c-4b-3**, over the transition 2c-4b-2 built
 * and this module's tests already drove. `MatchCreator.svelte`'s `conflictAction`
 * is what calls {@link reapplyToDiskVersion}, and what it hands back is a form
 * re-pointed at the newly parsed destination with the typed values retained, the
 * consent withdrawn and {@link creationRefusal} asked again in full. **A reapply
 * here is not a duplicate-trigger check**: whether the file already has a snippet
 * that fires the same way is decided by the newly derived candidate's own findings,
 * at the command (consult Q4).
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: true,
  offersReload: true,
  offersReapply: true,
  reapplySupport: 'supported'
};

/**
 * What this form offers about the conflict it is showing **now**, derived from
 * the declaration and two facts about the form — Phase 2d-6-3, the 2d-6 record's
 * §3 entries 11 and 21.
 *
 * The declaration above is permanent; this is the "effective capabilities" the
 * consult's Q3 names. The reload and the reapply are both withheld under an
 * unacknowledged write uncertainty, for the match editor's reason, and both
 * withheld for a destination-less form told of a change (entry 21) — the reload
 * because it adopts a file the person never named, the reapply because it would
 * choose that file for them; the resolution such a form requires is an explicit
 * destination, and the choice list says so by offering neither. The reapply alone
 * is withheld while the window holds an undecided reading, because it hands back
 * a form whose ordinary *Add* is live; the reload is not, because it closes the
 * form and sends nothing. The copy is untouched — a copy writes nothing. It feeds
 * `conflictChoicesFor`, which stays the only producer of a choice list; what this
 * cannot force is that the transitions honour the same facts, which is why each
 * asks {@link reloadableConflictOf} or the fields themselves.
 *
 * @param session - The form to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: MatchCreationSession): ConflictCapabilities {
  const reloadWithheld = session.uncertaintyUnresolved || requiresExplicitDestination(session);
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
 * The notices one form owes, in the order the stronger claim comes first.
 *
 * The uncertainty first, because it is the one state under which the conflict on
 * screen offers neither way to the disk version, and the held observation second.
 * Each is answered from one form field and nothing is read twice.
 *
 * @param session - The form to describe.
 * @returns The codes, possibly none.
 */
function externalNoticesOf(session: MatchCreationSession): readonly ExternalConflictNotice[] {
  const notices: ExternalConflictNotice[] = [];
  if (session.externalConflict !== null && session.uncertaintyUnresolved) {
    notices.push({ kind: 'writeOutcomeUnknown' });
  }
  if (awaitedFor(session) !== null) {
    notices.push({ kind: 'observationRetained' });
  }
  return notices;
} // End of function externalNoticesOf()

/** Everything a screen needs about one form, derived on every read. */
export interface MatchCreationView {
  /** Every file the form offers, eligible or not, in window order. */
  readonly destinations: readonly CreationDestination[];
  /** The file chosen, or `null`. */
  readonly chosen: CreationDestination | null;
  /** Where in that file's list the snippet goes. */
  readonly placement: CreationPlacement;
  /** What the trigger control shows. */
  readonly trigger: string;
  /** What the body control shows. */
  readonly replace: string;
  /** Whether anything has been typed. Derived. */
  readonly dirty: boolean;
  /** Whether there is a step to go back to. Derived. */
  readonly canUndo: boolean;
  /** Whether there is an undone step to go forward to. Derived. */
  readonly canRedo: boolean;
  /** Whether a save is in flight. */
  readonly saving: boolean;
  /** Whether the controls accept changes. */
  readonly editable: boolean;
  /** Whether the create control does anything. */
  readonly canCreate: boolean;
  /** Why it does not, as a code, or `null`. */
  readonly refusal: CreationRefusal | null;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * The reasons to show beside that failure, outermost first.
   *
   * `sendFailureLines` walks the chain in the model, so how deep a screen goes is
   * a decision a test can fail on rather than one written in markup.
   */
  readonly failureLines: readonly SendFailureLine[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<CreationBuffers> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /**
   * The external conflict's own lines, or none — Phase 2d-6-3.
   *
   * Beside {@link MatchCreationView.messages} and never merged into it, for
   * `MatchEditorView.externalMessages`'s reason: a panel drawing `view.conflict`
   * outside the save-outcome branch (the 2d-6 record's §3 entry 10) draws nothing
   * twice. Rendered through `tConflictMessage`; `MatchCreator.svelte` draws it in
   * its external conflict panel since Phase 2d-6-6c-1.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * The lines owed while an observation cannot be acted on — Phase 2d-6-3.
   *
   * `writeOutcomeUnknown` first, `observationRetained` second, from the form's
   * own fields. `MatchCreator.svelte` draws it beside the create control since
   * Phase 2d-6-6c-1; the acknowledgement control is 2d-6-9's.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
  /**
   * Whether this is a destination-less form told of a change, whose only way
   * forward is naming the file it writes into — Phase 2d-6-3, entry 21.
   *
   * While `true` the conflict is shown, the boxes are frozen, the reload and the
   * reapply are withheld, and {@link MatchCreationView.canChooseDestination} is
   * `true` although {@link MatchCreationView.editable} is not. The
   * `noDestination` refusal sentence, which {@link MatchCreationView.refusal}
   * already answers, says so beside the create control, and since Phase 2d-6-6c-1
   * `MatchCreator.svelte` reads this field to draw the external panel's own line
   * naming that one way forward.
   */
  readonly destinationRequired: boolean;
  /**
   * Whether the destination control does anything — Phase 2d-6-3.
   *
   * {@link canChooseDestination}: `editable`, widened by exactly the state above.
   * A renderer that gates the destination control on `editable` alone leaves a
   * destination-less form under an external conflict with no way forward, which
   * is why this is a field of its own rather than a rule in markup.
   * `MatchCreator.svelte` gates its destination buttons on it since Phase 2d-6-6b.
   */
  readonly canChooseDestination: boolean;
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal, withdrawn once its findings are stale. */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a draft that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, of either origin, or `null`. */
  readonly conflict: ConflictModel<CreationBuffers> | null;
  /**
   * The draft that conflict retained, labelled, in {@link CREATION_FIELDS} order.
   *
   * Empty whenever no conflict is showing. The panel draws this **and** the *Copy
   * draft* control builds its text from the same list, so what a person is told
   * they copied is what the panel showed them. Both entries are `setting`,
   * because a create writes both keys and there is no key here to leave alone or
   * to take out.
   */
  readonly retainedDraft: readonly RetainedDraftField[];
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
   * and nothing was discarded; *Keep editing* resets the step.
   */
  readonly reloadUnavailable: boolean;
  /**
   * Whether the reapply control is among {@link MatchCreationView.conflictChoices}.
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
   * Whether a confirmed reload has ended this session.
   *
   * The panel that reads this calls its own `close`: a match-level reload adopts
   * the disk projection and closes, because there is no disk-side draft to seed.
   */
  readonly closed: boolean;
  /**
   * Whether a create has committed and this form must be seeded again.
   *
   * **What no type here forces** is that a caller performs the re-seed: a
   * component that draws no way to do it leaves a person with a form that has
   * stopped accepting changes. What the model forces is that no submission is
   * produced from destinations a commit has invalidated.
   */
  readonly committed: boolean;
  /** The created snippet's identity, or `null`. See the session's own field. */
  readonly created: MatchId | null;
}

/**
 * The retained draft of one conflict, labelled, for the panel and for the copy.
 *
 * **Both fields, in {@link CREATION_FIELDS} order**, with the exact strings the
 * boxes held — the consult's Q4 for this surface: *copy the exact `trigger` and
 * `replace` strings under labels*. The status is `setting` for both because a
 * create writes both keys, and the labels are the detail pane's own so the panel
 * names them exactly as the form above it does.
 *
 * @param conflict - The conflict holding the retained draft.
 * @returns One entry per field, in the order the form shows them.
 */
function retainedDraftOf(
  conflict: ConflictModel<CreationBuffers>
): readonly RetainedDraftField[] {
  const buffers = copyOfDraft(conflict);
  return CREATION_FIELDS.map((field) => ({
    label: field,
    text: buffers[field],
    status: 'setting' as const
  }));
} // End of function retainedDraftOf()

/**
 * Everything a screen needs about one form.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up: a
 * `dirty` this module cached would be a second answer to a question the draft
 * already answers, and the two would eventually disagree.
 *
 * @param session - The form to describe.
 * @returns The view.
 */
export function matchCreationView(session: MatchCreationSession): MatchCreationView {
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
    destinations: session.destinations,
    chosen: chosenDestination(session),
    placement: session.placement,
    trigger: session.draft.value.trigger,
    replace: session.draft.value.replace,
    dirty: isDirty(session.draft),
    canUndo: canUndo(session.draft),
    canRedo: canRedo(session.draft),
    saving: session.phase === 'saving',
    editable: isEditable(session),
    canCreate: canCreate(session),
    refusal: creationRefusal(session),
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: externalNoticesOf(session),
    destinationRequired: requiresExplicitDestination(session),
    canChooseDestination: canChooseDestination(session),
    notes: saved === null ? [] : saved.notes,
    // The one offer a refusal panel may keep under an external block is the
    // dismissal: `beginCreate` would answer `null` to the other, and a control
    // that does nothing when pressed is the defect `conflictChoicesFor` exists to
    // stop.
    refusalChoices: externallyBlocked
      ? refusalChoices.filter((choice) => choice === 'keepEditing')
      : refusalChoices,
    findingsAreStale: refused !== null && stale,
    conflict,
    retainedDraft: conflict === null ? [] : retainedDraftOf(conflict),
    conflictChoices,
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    reapplyOffered: reapplyIsOffered(conflictChoices),
    diskText: conflictDiskText(conflict),
    closed: session.closed,
    committed: session.committed,
    created: session.created
  };
} // End of function matchCreationView()

/**
 * One position a screen may offer, with whatever it needs to name it.
 *
 * **The `after` arm carries a projection and not a piece of text.**
 * {@link CreationDestination.anchors} is identities only, deliberately — a model
 * holding display text would be holding a second copy of what the snippet list
 * already draws — so what this hands a screen is the *projection* the identity
 * resolves to, and the screen names it the way it names a row, through
 * `triggerLabel` and `labelText` in `./labels.ts`.
 */
export interface PlacementOption {
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
  readonly placement: CreationPlacement;
  /** The snippet an `after` names, or `null` for the two empty arms. */
  readonly anchor: MatchView | null;
  /** Whether this is the placement the form currently holds. */
  readonly chosen: boolean;
}

/**
 * Every position the form can offer for the destination it holds.
 *
 * The consult's Q4 order — `Front`, then one option per named snippet, then
 * `End` — with the anchors in the order the file writes them, which is the order
 * {@link CreationDestination.anchors} carries.
 *
 * **An anchor this window can no longer name is not offered**, and that is the
 * honest answer rather than a hidden one: the projections handed in are asked
 * for a snippet of the anchor's own document *and its own revision*, so a file
 * re-read since the form opened resolves none of its anchors and the `after`
 * options disappear. The form is not left claiming it can place a snippet after
 * something it cannot show; {@link creationRefusal} answers `anchorUnavailable`
 * for a placement that was installed before the re-read, which is the same fact
 * said the other way round.
 *
 * @param session - The form to describe.
 * @param views - Every projection this window holds, in any order.
 * @returns The options, in the order a screen shows them.
 */
export function placementOptionsOf(
  session: MatchCreationSession,
  views: readonly DocumentView[]
): readonly PlacementOption[] {
  const front: CreationPlacement = { kind: 'front' };
  const options: PlacementOption[] = [
    { key: 'front', placement: front, anchor: null, chosen: samePlacement(session.placement, front) }
  ];
  const destination = chosenDestination(session);
  for (const anchor of destination?.anchors ?? []) {
    const view = views.find((one) => one.id === anchor.document && one.revision === anchor.revision);
    const match = view?.matches.find((one) => one.id.node === anchor.node);
    if (match === undefined) {
      continue;
    }
    const placement: CreationPlacement = { kind: 'after', anchor };
    options.push({
      key: `after:${anchor.document}:${anchor.revision}:${anchor.node}`,
      placement,
      anchor: match,
      chosen: samePlacement(session.placement, placement)
    });
  } // End of the loop over the chosen destination's anchors
  options.push({
    key: 'end',
    placement: AT_END,
    anchor: null,
    chosen: samePlacement(session.placement, AT_END)
  });
  return options;
} // End of function placementOptionsOf()

/**
 * The dictionary key holding one destination refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link DestinationRefusal} with no sentence is one too.
 *
 * @param reason - Why the file may not be written into.
 * @returns The key holding that reason's sentence.
 */
export function destinationRefusalKey(reason: DestinationRefusal): TranslationKey {
  switch (reason) {
    case 'notASnippetFile':
      return 'browser.matchCreation.destination.notASnippetFile';
    case 'readOnly':
      return 'browser.matchCreation.destination.readOnly';
    case 'couldNotBeRead':
      return 'browser.matchCreation.destination.couldNotBeRead';
    case 'notParsed':
      return 'browser.matchCreation.destination.notParsed';
    case 'noMatchList':
      return 'browser.matchCreation.destination.noMatchList';
  }
} // End of function destinationRefusalKey()

/**
 * The dictionary key holding one submission refusal's sentence.
 *
 * **The two external blocks reuse sentences that already exist** (Phase 2d-6-3):
 * the external origin's own first line for `externalConflict`, and the retained
 * notice's for `observationRetained`, each through its own key function so a
 * renamed key is a compile error there and here at once. No sentence of this
 * module's own was added for either.
 *
 * @param reason - Why the form cannot be submitted.
 * @returns The key holding that reason's sentence.
 */
export function creationRefusalKey(reason: CreationRefusal): TranslationKey {
  switch (reason) {
    case 'alreadyCreated':
      return 'browser.matchCreation.cannotCreate.alreadyCreated';
    case 'saveInFlight':
      return 'browser.matchCreation.cannotCreate.saveInFlight';
    case 'conflict':
      return 'browser.matchCreation.cannotCreate.conflict';
    case 'externalConflict':
      return externalConflictMessageKey({ kind: 'fileChangedWhileOpen' });
    case 'observationRetained':
      return externalConflictNoticeKey({ kind: 'observationRetained' });
    case 'noDestination':
      return 'browser.matchCreation.cannotCreate.noDestination';
    case 'destinationIneligible':
      return 'browser.matchCreation.cannotCreate.destinationIneligible';
    case 'anchorUnavailable':
      return 'browser.matchCreation.cannotCreate.anchorUnavailable';
    case 'triggerEmpty':
      return 'browser.matchCreation.cannotCreate.triggerEmpty';
    case 'replaceEmpty':
      return 'browser.matchCreation.cannotCreate.replaceEmpty';
    case 'carriageReturn':
      return 'browser.matchCreation.cannotCreate.carriageReturn';
  }
} // End of function creationRefusalKey()

/**
 * The acknowledgement one submission carries, for a caller that only needs that.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands consent to the boundary is a place this module can be searched
 * for.
 *
 * @param submission - What {@link beginCreate} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(
  submission: DraftSubmission<CreationBuffers>
): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

/**
 * The base revision this form would create against.
 *
 * A named read rather than a property walk at the call site, so the one place a
 * screen hands a revision to the boundary is a place this module can be searched
 * for — the same read `matchEditor.baseRevisionOf` and
 * `matchDeletion.baseRevisionOf` are.
 *
 * It is the **chosen destination's** revision, re-pointed by
 * {@link chooseDestination} every time the destination moves, and since the first
 * review round's second finding nothing downstream substitutes another:
 * `BrowserState.createMatch` forwards the base revision it is handed rather than
 * reading its own projection's.
 *
 * **What no type forces**, in the same sentence: that parameter is an ordinary
 * `ContentRevision`, so a caller may hand the window's current projection over
 * instead of this and get the old behaviour. What is closed is that the wrapper no
 * longer chooses for it.
 *
 * @param session - The form to ask about.
 * @returns The revision the draft is drafted from.
 */
export function baseRevisionOf(session: MatchCreationSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()

/**
 * Which file this form would write, as the target it reports upward — Phase
 * 2d-6-3, the 2d-6 record's §3 entries 3 and 21.
 *
 * `unknown` while no file is chosen and the chosen file otherwise — the value
 * `DetailPane` builds today from the `DocumentId | null` `MatchCreator` reports,
 * answered here from the form so the mapping has one home. **It stays `unknown`
 * through an external conflict over a destination-less form**: the wildcard
 * protection entry 21 keeps is exactly that this answer does not change until the
 * person names a file, and nothing in this module writes `chosen` but
 * {@link chooseDestination}. Over which files an `unknown` target is registered as
 * a receiver is decided in `DetailPane` since Phase 2d-6-6b — every
 * creator-eligible file (`./surfaceReceivers.ts`); nothing reads this value yet,
 * because the pane builds the target from what `reportDestination` carries.
 *
 * @param session - The form to ask about.
 * @returns The target, by the identity this window holds.
 */
export function creationTargetOf(session: MatchCreationSession): WriteSurfaceTarget {
  const chosen = session.chosen;
  return chosen === null ? { kind: 'unknown' } : { kind: 'document', document: chosen };
} // End of function creationTargetOf()
