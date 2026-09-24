/**
 * The local raw editor's state machine: one snippet's owned text, drafted and
 * saved in place — Phase 3-8-1.
 *
 * The browser half of the 3-7 core edit (`ItemTextReplacement`). A session opens
 * over the text `match_item_text` answered, drafts it as one free-form text, and
 * sends it back through `save_match_item_text`, which re-derives the range in Rust
 * under the write lock and proves every byte outside it untouched, or refuses.
 * `src/lib/components/` draws nothing of it yet: the component is 3-8-2's.
 *
 * ## What this module does not do, said first
 *
 * **It never cuts a snippet out of a document's text.** A `ByteSpan` counts bytes
 * and a JavaScript string index counts UTF-16 code units (`CLAUDE.md` §6), so the
 * text is the command's answer, taken whole, and nothing here reads a span, an
 * offset or a document's text. `rawSnippet.test.ts` scans this module's own source
 * for the slicing methods; what that scan cannot see is a caller that cuts a text
 * elsewhere and hands it to {@link openRawSnippet} dressed as a command answer.
 *
 * **It does not restate the whole-document editor.** The rule about a carriage
 * return is `./rawEditor.ts`'s ({@link roundTripText} is the only producer of a
 * {@link RoundTripText}, and this module drafts that type); the draft, its history
 * and its consent are `./draft.ts`'s; the save's phase, its send failure, consent
 * and the reload steps are `./editorSave.ts`'s; the outcome's arms are
 * `./saveOutcome.ts`'s `describeEditSave`.
 *
 * ## The decisions this module makes
 *
 * 1. **A refusal to open is a value, never a session** ({@link openRawSnippet}).
 *    `ItemRangeNotContiguous` — the snippet's range has comments the file owns
 *    inside it (ruling 11) — becomes `rangeNotContiguous`, whose
 *    {@link fallbackOf} is the whole-document editor. A carriage return in the
 *    snippet's own text is refused at this door too, whether Rust refused it or
 *    the text somehow carries one (ruling 12).
 * 2. **A carriage return is refused at load, at edit and at send**, as the
 *    whole-document editor refuses it: {@link openRawSnippet}, {@link editText}
 *    and {@link beginSave}, the last on the submission's own candidate because a
 *    brand is a cast at bottom.
 * 3. **The draft is retained under every answer that is not a commit.** A save
 *    conflict or an external conflict freezes the box over the retained draft,
 *    which *Copy draft* copies exactly; a refusal for findings keeps the draft and
 *    offers the acknowledgement; an engine refusal (`saveFailed` carrying the
 *    core's `EditError`) keeps the draft and says why. The reload is
 *    `closesSurface`: there is no disk-side snippet text to reseed from without a
 *    fresh read, so a confirmed reload adopts the disk version and ends the
 *    session, taking the draft with it — which is what the confirmation is for.
 * 4. **A commit makes the old identity stale** ({@link applySave}): the session
 *    adopts `saved.moved` as the snippet's identity in the new revision and the
 *    draft is rebased on the text that was sent; with no `moved`, or with an
 *    adoption that failed, it records {@link RawSnippetSession.identityStale} and
 *    stops offering to save. A committed write is never reported as an error.
 * 5. **An uncertain write keeps the text and needs reconciliation**
 *    ({@link saveCouldNotBeSent}): a send that may have written leaves the draft
 *    untouched and refuses every further save until {@link reconcileWithDisk} is
 *    handed a fresh read of the snippet. It rebases the draft only when the fresh
 *    text is the one the session opened over or the one the send carried, and says
 *    which; any other text is another writer's and answers `diverged`, rebasing
 *    nothing.
 * 6. **CF-55's model half** (ruling 13): {@link canUndoEdit} and
 *    {@link canRedoEdit} answer `true` exactly when {@link undoEdit} and
 *    {@link redoEdit} would change the session, so under a held save neither is
 *    enabled and neither mutates.
 *
 * ## The external session
 *
 * `./rawEditor.ts`'s receiver shape, for this session: {@link applyObservation}
 * is the receiver as a value, one named action per verdict arm and a `never`
 * terminus; a delivery that arrives while this session's own save is in flight is
 * held and replayed, first to last, after the save's answer, through the required
 * {@link ReadTheInstalledSession}. **What no type forces**: that a component
 * registers the receiver or installs what it answers. The write-surface kind and
 * the registration are 3-8-2's, and until then no receiver of this kind exists.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  EditError,
  MatchId,
  OwnedItemText,
  PresentationNote,
  SaveResult
} from '../ipc/types';
import type { ExternalConflictObservation } from './conflictSource';
import {
  canRedo,
  canUndo,
  editDraft,
  isDirty,
  redoDraft,
  savedDraft,
  startDraft,
  submissionOf,
  textDraftRules,
  undoDraft,
  type Draft,
  type DraftSubmission,
  type DraftValueRules
} from './draft';
import {
  atTheReloadWarning,
  confirmationOf,
  conflictArm,
  consentForRefusal,
  offeredRefusalChoices,
  offeredReloadStep,
  refusedArm,
  reloadAsked,
  reloadConfirmed,
  reloadWasRefused,
  sendFailureOf,
  settledAnswer,
  submissionIsStale,
  NOT_RELOADING,
  RELOAD_REFUSED,
  type AdoptTheDiskVersion,
  type EditorPhase,
  type ReloadStep,
  type SendFailure
} from './editorSave';
import type { InvalidationStatus } from './invalidation';
import type { AcknowledgeTheUncertainty } from './matchEditor';
import type { ExternalConflictNotice, ObservationDelivery } from './observationDelivery';
import type { RawSaveChoice } from './rawSave';
import { rawEditorRefusal, roundTripText, type RoundTripText } from './rawEditor';
import {
  conflictChoicesFor,
  conflictDiskText,
  copyOfDraft,
  describeEditSave,
  describeExternalConflict,
  invalidationFailureMessage,
  supersedeConflict,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictMessage,
  type ConflictModel,
  type ExternalConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';

export type { RoundTripText } from './rawEditor';

/**
 * What this surface offers about a conflict — the declaration
 * `conflictChoicesFor` reads.
 *
 * The draft is authored text, so a clipboard preserves it and *Copy draft* is
 * offered. **The reload closes the surface**, for the match editor's reason: the
 * conflict's disk side is the whole file's text, and finding "the same" snippet's
 * range in it is a read only Rust can make, so a confirmed reload adopts the disk
 * version and ends this session rather than reseeding it. **The reapply is
 * unavailable, permanently**: re-applying a free-form text over a changed range
 * is a text merge, which the plan forbids for v1.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: true,
  offersReload: true,
  offersReapply: false,
  reapplySupport: 'unavailable'
};

/**
 * Why a snippet's text cannot be opened in this editor.
 *
 * A code, never a sentence; {@link rawSnippetRefusalKey} is the one place a
 * sentence is chosen for each arm, and the two arms carrying an operand have it
 * drawn beside the sentence through its own accessor (`tEditError`,
 * `tIpcFailure`).
 */
export type RawSnippetRefusal =
  | {
      /**
       * The snippet's owned range has comments the file owns inside it, so it is
       * not one contiguous run of the snippet's own lines (ruling 11). The
       * whole-document editor is the way to edit it ({@link fallbackOf}).
       */
      readonly kind: 'rangeNotContiguous';
    }
  | {
      /**
       * The snippet's own text holds a carriage return, which a text box cannot
       * give back (ruling 12; `CLAUDE.md` §6).
       */
      readonly kind: 'lineEndingsNotPreserved';
    }
  | {
      /** The core refused the range for another reason, carried whole. */
      readonly kind: 'notEditable';
      /** The core's refusal, for `tEditError`. */
      readonly error: EditError;
    }
  | {
      /**
       * The read did not answer: a stale identity, no workspace, an I/O failure.
       * Carried whole, for `tIpcFailure`.
       */
      readonly kind: 'unreadable';
      /** The classified failure. */
      readonly failure: IpcFailure;
    };

/** The editor offered instead of this one. One arm today. */
export type RawSnippetFallback = 'wholeDocumentEditor';

/**
 * The editor to offer instead, or `null` when none is.
 *
 * Only `rangeNotContiguous` offers one: its text cannot be edited as one run, and
 * the whole-document editor holds the whole file. A carriage return is refused
 * there too, so `lineEndingsNotPreserved` offers nothing; the other two arms say
 * nothing about the range.
 *
 * @param refusal - Why this editor will not open.
 * @returns The fallback, or `null`.
 */
export function fallbackOf(refusal: RawSnippetRefusal): RawSnippetFallback | null {
  return refusal.kind === 'rangeNotContiguous' ? 'wholeDocumentEditor' : null;
} // End of function fallbackOf()

/**
 * The dictionary key holding one refusal's sentence.
 *
 * A `switch` over literal keys, so a new arm with no sentence is a compile error.
 *
 * @param refusal - Why this editor will not open.
 * @returns The key holding that reason's sentence.
 */
export function rawSnippetRefusalKey(refusal: RawSnippetRefusal): TranslationKey {
  switch (refusal.kind) {
    case 'rangeNotContiguous':
      return 'browser.rawSnippet.refused.rangeNotContiguous';
    case 'lineEndingsNotPreserved':
      return 'browser.rawSnippet.refused.lineEndingsNotPreserved';
    case 'notEditable':
      return 'browser.rawSnippet.refused.notEditable';
    case 'unreadable':
      return 'browser.rawSnippet.refused.unreadable';
  }
} // End of function rawSnippetRefusalKey()

/**
 * The refusal one core `EditError` from the read stands for.
 *
 * The error's variant is read by its own key, once each, and nothing else of it:
 * the two variants a caller acts on are named, and every other one is carried
 * whole.
 *
 * @param error - What `itemTextRefused` carried.
 * @returns The refusal.
 */
function refusalOfEditError(error: EditError): RawSnippetRefusal {
  if ('ItemRangeNotContiguous' in error) {
    return { kind: 'rangeNotContiguous' };
  }
  if ('ItemTextHoldsCarriageReturn' in error) {
    return { kind: 'lineEndingsNotPreserved' };
  }
  return { kind: 'notEditable', error };
} // End of function refusalOfEditError()

/**
 * The core `EditError` a failed read or send carries, or `null`.
 *
 * Two carriers: `itemTextRefused` (the read, and a save whose path could not be
 * addressed) and `saveFailed` with a `Patch` (an engine refusal of the save).
 *
 * @param failure - The classified failure, or `null`.
 * @returns The core's refusal, or `null` when the failure carries none.
 */
export function editErrorOf(failure: IpcFailure | null): EditError | null {
  if (failure === null || failure.kind !== 'command') {
    return null;
  }
  const error = failure.error;
  if (error.code === 'itemTextRefused') {
    return error.error;
  }
  if (error.code === 'saveFailed' && 'Patch' in error.error) {
    return error.error.Patch;
  }
  return null;
} // End of function editErrorOf()

/**
 * `textDraftRules` at the narrower type this editor drafts — `./rawEditor.ts`'s
 * own construction, for the same reason: the equality is taken from `draft.ts`
 * and a string cannot change in place.
 */
const SNIPPET_RULES: DraftValueRules<RoundTripText> = {
  same: textDraftRules.same,
  snapshot: (value) => value
};

/**
 * Where the snippet's range sits in the file, for display only.
 *
 * `match_item_text`'s two line numbers, and nothing a caller may cut a text with.
 */
export interface RawSnippetLines {
  /** The physical line the range starts on, one-based. */
  readonly first: number;
  /** How many physical lines the range covers. */
  readonly count: number;
}

/**
 * One editing session over one snippet's owned text.
 *
 * **A value with pure transitions, never a store** — every function below returns
 * a new session and touches none of its arguments.
 */
export interface RawSnippetSession {
  /**
   * The snippet, by the identity the next save sends. Replaced by `saved.moved`
   * after a commit and by the fresh identity {@link reconcileWithDisk} is handed.
   */
  readonly match: MatchId;
  /** The range's display lines. */
  readonly lines: RawSnippetLines;
  /** The draft of the snippet's text. Its base revision is what a save sends. */
  readonly draft: Draft<RoundTripText>;
  /** Whether a save is in flight. */
  readonly phase: EditorPhase;
  /** The submission the last save sent, or `null`. */
  readonly submitted: DraftSubmission<RoundTripText> | null;
  /** How the last save ended, or `null`. */
  readonly outcome: SaveOutcomeModel<RoundTripText> | null;
  /** Lines beside the outcome: today only a committed save whose adoption failed. */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How far the conflict's reload has got. Reset by every new outcome. */
  readonly reload: ReloadStep;
  /** How the last save failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * Whether a commit left this session with no identity to save against — no
   * `moved`, or an adoption that failed. While `true` nothing can be saved or
   * edited; the text stays on screen and the old identity is never sent again.
   */
  readonly identityStale: boolean;
  /**
   * Whether the last send may have written, and this session has not been handed
   * a fresh read since. While `true` nothing can be saved: the file may hold the
   * submitted text under a revision this session never saw. The box stays
   * editable, because the text is the person's and a wait is a restriction on
   * sending. {@link reconcileWithDisk} is the only transition that clears it.
   */
  readonly needsReconciliation: boolean;
  /**
   * Whether a confirmed reload ended this session. A closed session accepts no
   * transition; what no type forces is that a panel reading it closes.
   */
  readonly closed: boolean;
  /** The conflict a watcher observation raised over this file, or `null`. */
  readonly externalConflict: ExternalConflictModel<RoundTripText> | null;
  /**
   * Whether {@link RawSnippetSession.externalConflict} was raised under an
   * unknown write outcome and this session has not been told the hold ended.
   * While `true` the reload is withheld.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations the window is holding undecided, keyed by file. Only this
   * snippet's file's entry blocks, and it blocks the save alone.
   */
  readonly awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>;
  /** Every delivery that arrived while this session's own save was in flight. */
  readonly heldDeliveries: readonly ObservationDelivery[];
}

/** What {@link openRawSnippet} answers. */
export type RawSnippetOpening =
  | {
      /** The discriminant: the text can be drafted. */
      readonly kind: 'opened';
      /** A clean session with no history and nothing said. */
      readonly session: RawSnippetSession;
    }
  | {
      /** The discriminant: no session, and why. */
      readonly kind: 'refused';
      /** The reason, as a code. */
      readonly refusal: RawSnippetRefusal;
      /** The editor to offer instead, or `null`. */
      readonly fallback: RawSnippetFallback | null;
    };

/**
 * The refusal a failed read stands for.
 *
 * @param failure - What the read rejected with.
 * @returns The refusal.
 */
function refusalOfFailure(failure: IpcFailure): RawSnippetRefusal {
  const error = failure.kind === 'command' && failure.error.code === 'itemTextRefused'
    ? failure.error.error
    : null;
  return error === null ? { kind: 'unreadable', failure } : refusalOfEditError(error);
} // End of function refusalOfFailure()

/**
 * A refused opening, with its fallback derived.
 *
 * @param refusal - Why.
 * @returns The opening.
 */
function refusedOpening(refusal: RawSnippetRefusal): RawSnippetOpening {
  return { kind: 'refused', refusal, fallback: fallbackOf(refusal) };
} // End of function refusedOpening()

/**
 * Starts an editing session over what `match_item_text` answered, or refuses.
 *
 * **The text is the command's, taken whole.** The session's draft is
 * `answer.value.text` exactly, and its base revision is the identity's own
 * revision: `match_item_text` resolves the identity against the session's cached
 * parse and refuses a stale one, so the text is that revision's. **The
 * carriage-return check is repeated here** although Rust refuses such a range: a
 * `RoundTripText` is minted only by `roundTripText`, and this door is where the
 * command's string becomes one. What no type forces is that `answer` came from
 * the command about `match`.
 *
 * @param match - The snippet, by the identity the read was made with.
 * @param answer - What `BrowserState.matchItemText(match)` answered.
 * @returns The opened session, or the refusal and the editor to offer instead.
 */
export function openRawSnippet(
  match: MatchId,
  answer: CommandResult<OwnedItemText>
): RawSnippetOpening {
  if (!answer.ok) {
    return refusedOpening(refusalOfFailure(answer.failure));
  }
  const owned = answer.value;
  const held = roundTripText(owned.text);
  if (held === null) {
    return refusedOpening({ kind: 'lineEndingsNotPreserved' });
  }
  return {
    kind: 'opened',
    session: {
      match,
      lines: { first: owned.first_line, count: owned.line_count },
      draft: startDraft(match.revision, held, SNIPPET_RULES),
      phase: 'editing',
      submitted: null,
      outcome: null,
      extraMessages: [],
      reload: NOT_RELOADING,
      sendFailure: null,
      identityStale: false,
      needsReconciliation: false,
      closed: false,
      externalConflict: null,
      uncertaintyUnresolved: false,
      awaitingReconciliation: new Map(),
      heldDeliveries: []
    }
  };
} // End of function openRawSnippet()

/**
 * The wait that restricts this session now, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The observation held for this snippet's file, or `null`.
 */
function awaitedFor(session: RawSnippetSession): ExternalConflictObservation | null {
  return session.awaitingReconciliation.get(session.match.document) ?? null;
} // End of function awaitedFor()

/**
 * The conflict the session is showing, of either origin, or `null`. The external
 * conflict first, then the outcome's conflict arm — `./rawEditor.ts`'s precedence.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null`.
 */
export function conflictOf(session: RawSnippetSession): ConflictModel<RoundTripText> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether the text box accepts changes right now.
 *
 * Not once closed, not while a save is in flight (the text is on its way to disk),
 * not while a conflict of either origin is showing (so *Copy draft* copies exactly
 * the bytes the conflict is about), and not after a commit left no identity. A
 * pending reconciliation and a held observation do **not** freeze the box: both
 * restrict sending, not drafting.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link editText}, {@link undoEdit} and {@link redoEdit}
 *   may do anything.
 */
export function isEditable(session: RawSnippetSession): boolean {
  return (
    !session.closed &&
    session.phase === 'editing' &&
    conflictOf(session) === null &&
    !session.identityStale
  );
} // End of function isEditable()

/**
 * Records whatever the text box now holds.
 *
 * **A text holding a carriage return leaves the session exactly as it was** — the
 * edit door of the refusal, `./rawEditor.ts`'s `editText` rule.
 *
 * @param session - The session being edited.
 * @param next - The text box's whole value.
 * @returns The session after the edit, or the same session.
 */
export function editText(session: RawSnippetSession, next: string): RawSnippetSession {
  if (!isEditable(session)) {
    return session;
  }
  const held = roundTripText(next);
  if (held === null) {
    return session;
  }
  const draft = editDraft(session.draft, held);
  return draft === session.draft ? session : { ...session, draft, sendFailure: keptFailure(session) };
} // End of function editText()

/**
 * The send failure an edit leaves standing.
 *
 * An edit clears a `notSent` notice — something happened since — but never a
 * `mayHaveWritten` one: that notice is the reason the save is refused, and it may
 * go only with the reconciliation that clears {@link RawSnippetSession.needsReconciliation}.
 *
 * @param session - The session being edited.
 * @returns The failure to keep, or `null`.
 */
function keptFailure(session: RawSnippetSession): SendFailure | null {
  return session.needsReconciliation ? session.sendFailure : null;
} // End of function keptFailure()

/**
 * Whether *Undo* would do anything — CF-55's model half (ruling 13).
 *
 * **The predicate agrees with the transition by construction**: it is
 * {@link isEditable} and the draft's own `canUndo`, which are exactly the two
 * checks {@link undoEdit} makes before it changes anything. So under a held save,
 * under a conflict and in a closed session it answers `false`, and 3-8-2 disables
 * the control from it. The suite pins `canUndoEdit(s) === (undoEdit(s) !== s)`
 * over every state it builds; nothing in TypeScript forces a renderer to read it.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link undoEdit} would change the session.
 */
export function canUndoEdit(session: RawSnippetSession): boolean {
  return isEditable(session) && canUndo(session.draft);
} // End of function canUndoEdit()

/**
 * Whether *Redo* would do anything — {@link canUndoEdit}'s twin.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link redoEdit} would change the session.
 */
export function canRedoEdit(session: RawSnippetSession): boolean {
  return isEditable(session) && canRedo(session.draft);
} // End of function canRedoEdit()

/**
 * Goes back one step.
 *
 * @param session - The session to undo.
 * @returns The session one step back, or the same session when
 *   {@link canUndoEdit} answers `false`.
 */
export function undoEdit(session: RawSnippetSession): RawSnippetSession {
  if (!canUndoEdit(session)) {
    return session;
  }
  const draft = undoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, sendFailure: keptFailure(session) };
} // End of function undoEdit()

/**
 * Goes forward one step, undoing an undo.
 *
 * @param session - The session to redo.
 * @returns The session one step forward, or the same session when
 *   {@link canRedoEdit} answers `false`.
 */
export function redoEdit(session: RawSnippetSession): RawSnippetSession {
  if (!canRedoEdit(session)) {
    return session;
  }
  const draft = redoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, sendFailure: keptFailure(session) };
} // End of function redoEdit()

/**
 * Whether a save may be started.
 *
 * Gated on dirty, on the box being editable, on no held observation for this
 * file, and on no pending reconciliation after an uncertain write.
 * {@link beginSave} asks this same function, so the control and the door cannot
 * disagree; what this cannot force is that the session asked about is the one
 * installed ({@link ReadTheInstalledSession}).
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link beginSave} would produce a submission.
 */
export function canSave(session: RawSnippetSession): boolean {
  return (
    isEditable(session) &&
    isDirty(session.draft) &&
    !session.needsReconciliation &&
    awaitedFor(session) === null
  );
} // End of function canSave()

/**
 * Reads the session a caller currently holds — `./rawEditor.ts`'s
 * `ReadTheInstalledSession`, for this session. Required at every door and every
 * settling transition; what no type can force is that the closure reads the
 * installed session rather than a capture.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => RawSnippetSession;

/** A save about to be sent: the waiting session, and what to send. */
export interface StartedRawSnippetSave {
  /** The session, now in flight, with the submission recorded on it. */
  readonly session: RawSnippetSession;
  /** The snippet to send, by identity. */
  readonly match: MatchId;
  /**
   * What to send: `candidate` is the text, `baseRevision` the revision it was read
   * at, `acknowledgement` whatever consent is bound to this exact candidate.
   */
  readonly submission: DraftSubmission<RoundTripText>;
}

/**
 * Starts a save of the draft as it stands.
 *
 * **The carriage-return check is repeated on the submission's own candidate** —
 * the send door of the refusal, and deliberately redundant: a brand is a cast at
 * bottom. Every caller-controlled read is taken first and the installed session is
 * read once, last, as in `./rawEditor.ts`'s `beginSave`.
 *
 * **A new submission retires the previous outcome** (the 3-8-1 review's second
 * finding). The outcome, its extra lines and the reload step all describe the
 * *previous* submission; keeping them beside the new `submitted` paired a refusal's
 * findings with a different candidate, so a later not-sent failure left
 * {@link acknowledgeFindings} able to bind candidate A's findings to candidate B.
 * The consent this send carries was already taken into `submission` by
 * `submissionOf`, so nothing the new attempt needs is lost.
 *
 * @param session - The session to save.
 * @param current - Reads the session the caller holds now. Required.
 * @returns The waiting session and what to send, or `null` when the session may not
 *   submit, is no longer installed, or its candidate holds a carriage return.
 */
export function beginSave(
  session: RawSnippetSession,
  current: ReadTheInstalledSession
): StartedRawSnippetSave | null {
  const submission = submissionOf(session.draft);
  const refused = rawEditorRefusal(submission.candidate) !== null;
  const eligible = canSave(session);
  const started: StartedRawSnippetSave = {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      outcome: null,
      extraMessages: [],
      reload: NOT_RELOADING,
      sendFailure: null
    },
    match: session.match,
    submission
  };
  const installed = current();
  if (installed !== session || refused || !eligible) {
    return null;
  }
  return started;
} // End of function beginSave()

/**
 * Records that the person accepted the findings of the refusal on screen, through
 * `consentForRefusal` — the only route to consent.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeFindings(session: RawSnippetSession): RawSnippetSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeFindings()

/**
 * How many physical lines a text covers: its line feeds, plus one for a final
 * line with no line feed. Counts characters, and cuts nothing.
 *
 * @param text - The text.
 * @returns The line count.
 */
function physicalLineCount(text: string): number {
  let count = 0;
  for (const character of text) {
    if (character === '\n') {
      count += 1;
    }
  } // End of the loop over the text's characters
  return text.length > 0 && !text.endsWith('\n') ? count + 1 : count;
} // End of function physicalLineCount()

/**
 * Takes a save's answer — `BrowserState.saveMatchItemText`'s `answered` arm.
 *
 * **Not sealed**: like a field save, this save has one identity to answer with,
 * and `BrowserState.saveMatchItemText` has already adopted the file (the old
 * identities are stale) before this runs. On `saved`:
 *
 * - **the old identity is retired**: `saved.moved` is the snippet in the new
 *   revision and becomes {@link RawSnippetSession.match}; a commit with no `moved`,
 *   or whose adoption failed, sets {@link RawSnippetSession.identityStale}, and the
 *   old identity is never sent again;
 * - **the draft is rebased on the text that was sent**, through `savedDraft`, at
 *   the revision the transaction ended on. Rust wrote exactly that text into
 *   exactly the range, so the text is what the range now holds;
 * - **a failed adoption is a line beside the outcome, never in place of it**
 *   (`PROGRESS.md` D2).
 *
 * A conflict retains the draft on the conflict arm and freezes the box; a refusal
 * keeps the draft and the submission a consent needs. A `saved` or `conflict`
 * answer retires an external conflict, a `refused` one leaves it; then every
 * delivery held during the save is replayed.
 *
 * @param session - The session waiting for an answer.
 * @param result - How the save ended.
 * @param adoption - What became of the adoption. Required: a default would invent
 *   `notOwed` for a caller that did not look.
 * @param current - Reads the session the caller holds now. Required.
 * @returns The session showing what the save ended as.
 */
export function applySave(
  session: RawSnippetSession,
  result: SaveResult,
  adoption: InvalidationStatus,
  current: ReadTheInstalledSession
): RawSnippetSession {
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
      match: result.moved ?? session.match,
      identityStale: result.committed && (result.moved === null || adoption.kind === 'failed'),
      lines: { first: session.lines.first, count: physicalLineCount(submission.candidate) },
      draft: savedDraft(session.draft, submission, result.revision),
      phase: 'editing',
      outcome,
      extraMessages,
      reload: NOT_RELOADING,
      sendFailure: null,
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    current
  );
} // End of function applySave()

/**
 * Records that the save produced no outcome.
 *
 * The draft is untouched either way. **A send that may have written needs
 * reconciliation**: {@link RawSnippetSession.needsReconciliation} is set, the
 * `mayHaveWritten` notice stays until {@link reconcileWithDisk} clears both, and no
 * save is offered meanwhile — the file may hold the submitted text under a
 * revision this session never saw. A `notSent` failure — an engine refusal among
 * them, whose `EditError` {@link editErrorOf} reads — keeps the draft and allows a
 * corrected retry.
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the submitted text.
 * @param reason - Why the command rejected, or `null` when nothing was sent.
 * @param current - Reads the session the caller holds now. Required.
 * @returns The session, back to editing, with the right notice raised.
 */
export function saveCouldNotBeSent(
  session: RawSnippetSession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null,
  current: ReadTheInstalledSession
): RawSnippetSession {
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      sendFailure: sendFailureOf(mayHaveWritten, reason),
      needsReconciliation: session.needsReconciliation || mayHaveWritten
    },
    current
  );
} // End of function saveCouldNotBeSent()

/** What {@link reconcileWithDisk} answers. */
export type RawSnippetReconciliation =
  | {
      /** The discriminant: the session is rebased on the fresh read. */
      readonly kind: 'reconciled';
      /** The session over the file as it is now, holding the retained draft. */
      readonly session: RawSnippetSession;
      /**
       * Whether the fresh read holds exactly the text the uncertain send carried —
       * that is, whether the write landed, or the file already held it.
       */
      readonly written: boolean;
    }
  | {
      /**
       * The discriminant: the fresh read holds neither the text this session was
       * opened over nor the text the uncertain send carried, so somebody else
       * changed the snippet. Nothing is rebased and the session is unchanged — the
       * draft is kept, every save stays refused, and the way on is the conflict
       * path (the watcher's external conflict: *Copy draft*, or a reload that
       * closes this editor). Never a silent rebase.
       */
      readonly kind: 'diverged';
    }
  | {
      /** The discriminant: nothing was reconciled and the session is unchanged. */
      readonly kind: 'notReconciled';
      /** Why the fresh read cannot seed this editor, or `null` when none was owed. */
      readonly refusal: RawSnippetRefusal | null;
    };

/**
 * Rebases a session whose last send may have written on a fresh read of the
 * snippet — the one way out of {@link RawSnippetSession.needsReconciliation}.
 *
 * The caller reads the snippet again, by the identity the window holds after it
 * re-read the file (`BrowserState.saveMatchItemText` re-reads on a failure that
 * may have written), and hands the answer here.
 *
 * **Only two fresh texts are reconciled automatically** (the 3-8-1 review's first
 * finding): the text the session was opened over (`draft.baseValue` — the write
 * did not land) and the text the uncertain send carried (it did). Either is a fact
 * this session already knows about, so the draft is restarted on the fresh text at
 * the fresh identity's revision and **the retained text is drafted on top of it**:
 * clean when the two are equal, dirty otherwise, with one undo step back. Any other
 * fresh text is another writer's, and rebasing onto it would authorize the next
 * save to overwrite an edit nobody on this screen has seen; that answers
 * `diverged` and changes nothing.
 *
 * Refused, with the session unchanged, when nothing is owed, when the session is
 * closed or in flight, when the identity names another file, or when the fresh
 * read is itself refused — its carriage-return check included. What no type
 * forces is that `answer` is the read of `match`.
 *
 * @param session - The session needing reconciliation.
 * @param match - The snippet's identity in the window's fresh projection.
 * @param answer - What `BrowserState.matchItemText(match)` answered.
 * @returns The reconciled session and whether the write landed, or why not.
 */
export function reconcileWithDisk(
  session: RawSnippetSession,
  match: MatchId,
  answer: CommandResult<OwnedItemText>
): RawSnippetReconciliation {
  if (
    !session.needsReconciliation ||
    session.closed ||
    session.phase !== 'editing' ||
    match.document !== session.match.document
  ) {
    return { kind: 'notReconciled', refusal: null };
  }
  const opening = openRawSnippet(match, answer);
  if (opening.kind === 'refused') {
    return { kind: 'notReconciled', refusal: opening.refusal };
  }
  const fresh = opening.session;
  const retained = session.draft.value;
  const sent = session.submitted?.candidate ?? null;
  const landed = sent !== null && fresh.draft.value === sent;
  if (!landed && fresh.draft.value !== session.draft.baseValue) {
    return { kind: 'diverged' };
  }
  return {
    kind: 'reconciled',
    session: {
      ...session,
      match,
      lines: fresh.lines,
      draft: editDraft(fresh.draft, retained),
      submitted: null,
      outcome: null,
      extraMessages: [],
      reload: NOT_RELOADING,
      sendFailure: null,
      identityStale: false,
      needsReconciliation: false
    },
    written: landed
  };
} // End of function reconcileWithDisk()

/**
 * Puts the outcome away. *Keep editing*, for every arm. The draft is untouched;
 * an external conflict, its uncertainty, a held observation and a pending
 * reconciliation all survive — a dismissal resolves none of them.
 *
 * **Refused while a save is in flight** (the 3-8-1 review's third finding): the
 * in-flight submission is what {@link applySave} settles against, and clearing it
 * mid-save lost a committed answer. {@link rawSnippetView} offers no dismissal
 * then either.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last save, or the same
 *   session while a save is in flight.
 */
export function keepEditing(session: RawSnippetSession): RawSnippetSession {
  if (session.phase === 'saving') {
    return session;
  }
  return {
    ...session,
    submitted: session.needsReconciliation ? session.submitted : null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: keptFailure(session)
  };
} // End of function keepEditing()

/**
 * The text *Copy draft* puts on the clipboard: the retained draft of the conflict
 * showing, or `null` when none is.
 *
 * @param session - The session to copy from.
 * @returns The retained text, or `null`.
 */
export function textToCopy(session: RawSnippetSession): RoundTripText | null {
  const conflict = conflictOf(session);
  return conflict === null ? null : copyOfDraft(conflict);
} // End of function textToCopy()

/**
 * The conflict a reload may be asked about: none under an unacknowledged write
 * uncertainty, and none in a closed session.
 *
 * @param session - The session to ask about.
 * @returns The conflict, or `null`.
 */
function reloadableConflictOf(session: RawSnippetSession): ConflictModel<RoundTripText> | null {
  return session.closed || session.phase === 'saving' || session.uncertaintyUnresolved
    ? null
    : conflictOf(session);
} // End of function reloadableConflictOf()

/**
 * Asks to load the version on disk — the step before confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session.
 */
export function askToReload(session: RawSnippetSession): RawSnippetSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReload()

/**
 * Confirms abandoning this draft for the version on disk.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmReload(session: RawSnippetSession): RawSnippetSession {
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmReload()

/**
 * Adopts the disk version into the window and ends this session — the
 * `closesSurface` reload, in `reloadTheDiskVersion`'s shape in `./matchEditor.ts`.
 *
 * Nothing is closed for an adoption the window refused: the session reaches the
 * terminal refused step instead. The installed session is read before the
 * adoption, after it, and last through `settledAnswer`, so a replacing verdict
 * delivered during the adoption is answered untouched.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @param current - Reads the session the caller holds now. Required.
 * @returns The closed session, the refused step, the same session, or the
 *   installed session when the one handed in is no longer it.
 */
export function reloadTheDiskVersion(
  session: RawSnippetSession,
  adopt: AdoptTheDiskVersion<RoundTripText>,
  current: ReadTheInstalledSession
): RawSnippetSession {
  const step = session.reload;
  const conflict = reloadableConflictOf(session);
  const confirmation = conflict === null ? null : confirmationOf(step);
  const installed = current();
  if (installed !== session) {
    return installed;
  }
  if (conflict === null || confirmation === null) {
    return session;
  }
  const spend = adopt(conflict, confirmation) === 'refused' ? 'refused' : 'satisfied';
  const settled = current();
  if (settled !== session && conflictOf(settled)?.source !== conflict.source) {
    return settledAnswer(settled, settled, current);
  }
  if (spend === 'refused') {
    return settledAnswer(settled, { ...settled, reload: RELOAD_REFUSED }, current);
  }
  return settledAnswer(
    settled,
    {
      ...settled,
      submitted: null,
      outcome: null,
      extraMessages: [],
      reload: NOT_RELOADING,
      sendFailure: null,
      externalConflict: null,
      uncertaintyUnresolved: false,
      closed: true
    },
    current
  );
} // End of function reloadTheDiskVersion()

/**
 * The waits with one file's entry replaced or removed.
 *
 * @param waits - The waits held.
 * @param document - The file.
 * @param observation - The observation now held for it, or `null` to remove it.
 * @returns A new map; the argument is untouched.
 */
function withWait(
  waits: ReadonlyMap<DocumentId, ExternalConflictObservation>,
  document: DocumentId,
  observation: ExternalConflictObservation | null
): ReadonlyMap<DocumentId, ExternalConflictObservation> {
  const next = new Map(waits);
  if (observation === null) {
    next.delete(document);
  } else {
    next.set(document, observation);
  }
  return next;
} // End of function withWait()

/**
 * Takes the window's decision about one watcher observation — the receiver as a
 * value, with `./rawEditor.ts`'s verdict table:
 *
 * | Verdict | What this does, for a delivery about this snippet's file |
 * |---|---|
 * | `raised` | builds the external model over the draft as it stands, and freezes the box |
 * | `raisedWithoutReload` | the same, and withholds the reload until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown, its draft kept |
 * | `coalesced` | keeps the model |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on saving |
 * | `writtenHere` | lifts the restriction recorded for that observation |
 *
 * A delivery about another file can only end a wait recorded for that very
 * observation. While this session's own save is in flight the envelope is held,
 * not applied; a closed session takes nothing. What no type forces is that a
 * component registers this or installs what it answers.
 *
 * @param session - The session.
 * @param delivery - What the window decided, sealed with the observation.
 * @returns The session after the decision, or the same session.
 */
export function applyObservation(
  session: RawSnippetSession,
  delivery: ObservationDelivery
): RawSnippetSession {
  const observation = delivery.observation;
  const kind = delivery.verdict.kind;
  const file = observation.document;
  if (session.closed) {
    return session;
  }
  if (session.phase === 'saving') {
    return { ...session, heldDeliveries: [...session.heldDeliveries, delivery] };
  }
  const waits = session.awaitingReconciliation;
  const stillWaiting = waits.get(file) === observation ? withWait(waits, file, null) : waits;
  const about = session.match.document === file;
  const lifted = stillWaiting === waits ? session : { ...session, awaitingReconciliation: stillWaiting };
  switch (kind) {
    case 'retained':
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
 * The session after a verdict that puts a new origin in front of it. The draft
 * retained is the session's own as it stands; a save conflict is retired with its
 * submission, and the reload step is reset so a confirmation collected for the
 * conflict that was on screen cannot be spent against this one.
 *
 * @param session - The session, not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The session showing the new conflict.
 */
function replacedBy(
  session: RawSnippetSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): RawSnippetSession {
  const shown = conflictOf(session);
  const externalConflict =
    shown === null
      ? describeExternalConflict(observation, session.draft, CONFLICT_CAPABILITIES)
      : supersedeConflict(shown, observation, CONFLICT_CAPABILITIES);
  const retiring = conflictArm(session.outcome) !== null;
  return {
    ...session,
    externalConflict,
    uncertaintyUnresolved,
    awaitingReconciliation,
    outcome: retiring ? null : session.outcome,
    submitted: retiring && !session.needsReconciliation ? null : session.submitted,
    extraMessages: retiring ? [] : session.extraMessages,
    reload: NOT_RELOADING
  };
} // End of function replacedBy()

/**
 * Whether one held list is the other with more appended, by identity.
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
 * Replays every delivery held during the save, in arrival order, once the save's
 * own answer is on the session — and then every delivery the receiver appended to
 * the installed session meanwhile, in rounds, `./rawEditor.ts`'s rule. What this
 * cannot force is that the reader is honest or that the rounds end for a getter
 * that manufactures a fresh reading on every read.
 *
 * @param settled - The session with its save's answer applied, back to `editing`.
 * @param current - Reads the session the caller holds now.
 * @returns The session with every held delivery applied.
 */
function consumingHeldDeliveries(
  settled: RawSnippetSession,
  current: ReadTheInstalledSession
): RawSnippetSession {
  let queue = settled.heldDeliveries;
  let replayed: RawSnippetSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyObservation(replayed, queue[at]!);
    } // End of the loop over the deliveries not yet replayed
    seen = queue.length;
    const installed = current();
    const arrived = installed.heldDeliveries;
    const extended = arrived.length > seen && extendsTheReplayed(arrived, queue);
    if (current() !== installed) {
      continue;
    }
    if (!extended) {
      return replayed;
    }
    queue = arrived;
  } // End of the loop over the rounds of replay
} // End of function consumingHeldDeliveries()

/**
 * Records that the window ended the uncertainty hold an external conflict was
 * raised under, through the window's own acknowledgement; the reload is offered
 * again from its idle step. A `refused` leaves the session unchanged.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload available again, or the same session.
 */
export function acknowledgeSnapshot(
  session: RawSnippetSession,
  acknowledge: AcknowledgeTheUncertainty
): RawSnippetSession {
  const conflict = session.externalConflict;
  if (conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeSnapshot()

/** Everything a screen needs about one session, derived on every read. */
export interface RawSnippetView {
  /** The text the box shows. */
  readonly text: RoundTripText;
  /** The range's display lines. */
  readonly lines: RawSnippetLines;
  /** Whether the draft differs from what it was started from. */
  readonly dirty: boolean;
  /** Whether *Undo* is enabled: {@link canUndoEdit}, never the history alone. */
  readonly canUndo: boolean;
  /** Whether *Redo* is enabled: {@link canRedoEdit}, never the history alone. */
  readonly canRedo: boolean;
  /** Whether a save is in flight. */
  readonly saving: boolean;
  /** Whether the box accepts changes. */
  readonly editable: boolean;
  /** Whether the save control does anything. */
  readonly canSave: boolean;
  /** Whether a confirmed reload ended the session. */
  readonly closed: boolean;
  /** Whether a commit left no identity to save against. */
  readonly identityStale: boolean;
  /** Whether an uncertain write is waiting for {@link reconcileWithDisk}. */
  readonly needsReconciliation: boolean;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * The editor to offer because the last send was refused as a range with holes,
   * or `null`. The core's `EditError` itself is in the send failure's reason.
   */
  readonly fallback: RawSnippetFallback | null;
  /** How the last save ended, or `null`. */
  readonly outcome: SaveOutcomeModel<RoundTripText> | null;
  /** The outcome's lines followed by anything said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /** The external conflict's own lines, or none. */
  readonly externalMessages: readonly ConflictMessage[];
  /** The notices owed while an observation cannot be acted on. */
  readonly externalNotices: readonly ExternalConflictNotice[];
  /** The presentation changes a saved arm disclosed. */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal for findings. */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about text that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<RoundTripText> | null;
  /** The disk side's whole file text, or `null` when no conflict is showing. */
  readonly diskText: ConflictDiskText | null;
  /** What to offer about the conflict, at whichever step it has reached. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether the reload warning is showing. */
  readonly awaitingReloadConfirmation: boolean;
  /** Whether a confirmed reload was spent and the window refused it. */
  readonly reloadUnavailable: boolean;
  /** Whether confirming the reload would do anything. */
  readonly canReload: boolean;
}

/**
 * The notices one session owes: the uncertainty first, the held observation second.
 *
 * @param session - The session to describe.
 * @returns The codes, possibly none.
 */
function externalNoticesOf(session: RawSnippetSession): readonly ExternalConflictNotice[] {
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
 * The capabilities to offer choices from now: the reload withheld under an
 * unacknowledged write uncertainty.
 *
 * @param session - The session to derive for.
 * @returns The capabilities.
 */
function effectiveCapabilitiesOf(session: RawSnippetSession): ConflictCapabilities {
  return session.uncertaintyUnresolved
    ? { ...CONFLICT_CAPABILITIES, offersReload: false }
    : CONFLICT_CAPABILITIES;
} // End of function effectiveCapabilitiesOf()

/**
 * Everything a screen needs about one session. Derived on every call, stored
 * nowhere.
 *
 * @param session - The session to describe.
 * @returns The view.
 */
export function rawSnippetView(session: RawSnippetSession): RawSnippetView {
  const outcome = session.outcome;
  const conflict = conflictOf(session);
  const stale = submissionIsStale(session.draft, session.submitted);
  const refused = refusedArm(outcome);
  const externallyBlocked = session.externalConflict !== null || awaitedFor(session) !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
  const sentError = editErrorOf(session.sendFailure?.reason ?? null);
  return {
    text: session.draft.value,
    lines: session.lines,
    dirty: isDirty(session.draft),
    canUndo: canUndoEdit(session),
    canRedo: canRedoEdit(session),
    saving: session.phase === 'saving',
    editable: isEditable(session),
    canSave: canSave(session),
    closed: session.closed,
    identityStale: session.identityStale,
    needsReconciliation: session.needsReconciliation,
    sendFailure: session.sendFailure,
    fallback: sentError === null ? null : fallbackOf(refusalOfEditError(sentError)),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: externalNoticesOf(session),
    notes: outcome !== null && outcome.kind === 'saved' ? outcome.notes : [],
    // Nothing is offered while a save is in flight: every choice is a dismissal or
    // a send, and `keepEditing` refuses then (the review's third finding).
    refusalChoices:
      session.phase === 'saving'
        ? []
        : externallyBlocked || session.needsReconciliation
          ? refusalChoices.filter((choice) => choice === 'keepEditing')
          : refusalChoices,
    findingsAreStale: refused !== null && stale,
    conflict,
    diskText: conflictDiskText(conflict),
    conflictChoices:
      conflict === null || session.phase === 'saving'
        ? []
        : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload)),
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    canReload: reloadableConflictOf(session) !== null
  };
} // End of function rawSnippetView()

/**
 * The acknowledgement one submission carries — a named read, so the one place a
 * screen hands consent to the boundary can be searched for.
 *
 * @param submission - What {@link beginSave} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(submission: DraftSubmission<RoundTripText>): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()

/**
 * The revision the draft was seeded from — the one a save sends.
 *
 * @param session - The session to ask about.
 * @returns The draft's base revision.
 */
export function baseRevisionOf(session: RawSnippetSession): ContentRevision {
  return session.draft.baseRevision;
} // End of function baseRevisionOf()
