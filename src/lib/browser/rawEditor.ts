/**
 * The raw editor's state machine: one file's whole text, drafted and saved.
 *
 * **The first screen in this project that can write a user's file**, and this is
 * the half of it a test can reach. `src/lib/components/RawEditor.svelte` is the
 * walk over what this module decides, which is the standing arrangement of
 * `./detail.ts`, `./rawSave.ts` and `./saveOutcome.ts` (`docs/decisions/1c-1-notes.md`
 * hole 1): nothing in this repository renders a Svelte component in an automated
 * test, so a decision written in markup is a decision nothing can check.
 *
 * ## What it is made of, and what it deliberately does not restate
 *
 * Everything below stands on Phase 2c-1a and adds no second copy of any of it:
 *
 * - the draft, its history and its consent are `./draft.ts`'s — {@link Draft} of
 *   a {@link RoundTripText}, which is a `string` this editor has checked it can
 *   give back unchanged, with `isDirty`, `canUndo` and `canRedo` **derived** on
 *   every read and never stored;
 * - the save outcome's three arms are `./saveOutcome.ts`'s
 *   `describeWholeDocumentSave`, and the parse rejection inside a refusal is
 *   `./rawSave.ts`'s `describeRawSave`, reached through the refused arm's own
 *   `rawSave` field rather than called again here;
 * - the whole-document invalidation is `./invalidation.ts`'s seal, and this
 *   module is the caller that opens it;
 * - the five decisions about a save that are **not** about a text area — the
 *   phase, the send failure's two arms, staleness, the consent round trip and the
 *   choices a stale refusal may still offer — are `./editorSave.ts`'s since
 *   2c-2-1, because the small editor needs every one of them over a different
 *   drafted value and a second copy of a rule about consent is a second place for
 *   it to be relaxed.
 *
 * ## Three policy decisions this sub-phase owed, made here
 *
 * **1. The text is read-only while a save is in flight.** `2c-1a-notes.md`
 * section 4.6 left the question open — a person who edits during a save, or undoes
 * past it, leaves `savedDraft` drawing its boundary in an explainable but odd
 * place. The spine represents that state correctly; this editor simply does not
 * produce it, because there is nothing a person gains from typing into a box whose
 * contents are already on their way to disk.
 *
 * **2. The text is read-only while a conflict is showing.** The conflict state is
 * *terminal* (`docs/decisions/2c-split-notes.md` section 6), and the two ways out
 * are labelled: *Keep editing* dismisses it and gives the box back, untouched, and
 * *Reload disk version* discards the draft behind a confirmation. Freezing the box
 * in between is what makes two of the eight requirements true rather than likely:
 * *Copy draft* copies exactly the bytes the conflict is about, and a confirmation
 * issued for one conflict cannot be spent against text that changed after it was
 * given.
 *
 * **3. One keystroke is one history step.** {@link editText} records whatever the
 * text area now holds, so the bound `HISTORY_LIMIT` of `./draft.ts` is reached
 * after a hundred keystrokes and the oldest step is dropped first. Coalescing is
 * not attempted here: what a person means by "one edit" in a free-form text area
 * is a guess, and a wrong guess loses undo steps a person expected to have. The
 * cost is recorded in this phase's notes rather than hidden.
 *
 * ## The refusal's consent, and the one thing no type here can force
 *
 * A refused save comes back with findings. {@link acknowledgeFindings} records
 * consent through `acknowledgeRefusal`, which is the **only** producer of it, and
 * {@link beginSave} then reads it back through `submissionOf`. Editing or undoing
 * clears it, so a re-submission after a change carries `EMPTY_ACKNOWLEDGEMENT` —
 * and {@link rawEditorView} withdraws the *Save anyway* offer at the same moment,
 * so the control is not left standing beside findings that are about text no
 * longer on screen.
 *
 * What no type here forces is the pairing itself: a caller could take
 * `submission.acknowledgement` and send it beside different text
 * (`2c-1a-notes.md` section 4.1). This module never builds that pairing, and the
 * wire refuses it as a second refusal rather than writing it.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  PresentationNote
} from '../ipc/types';
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
  conflictArm,
  consentForRefusal,
  offeredReloadStep,
  offeredRefusalChoices,
  reloadAsked,
  reloadConfirmed,
  refusedArm,
  sendFailureOf,
  reloadWasRefused,
  spendTheConfirmedReload,
  submissionIsStale,
  NOT_RELOADING,
  RELOAD_REFUSED,
  type AdoptTheDiskVersion,
  type EditorPhase,
  type ReloadStep,
  type SendFailure
} from './editorSave';
import { openWholeDocumentSave, type SealedWholeDocumentSave } from './invalidation';
import { describeRawSave, type RawSaveChoice, type RawSaveModel } from './rawSave';
import {
  conflictChoicesFor,
  conflictDiskText,
  copyOfDraft,
  describeWholeDocumentSave,
  invalidationFailureMessage,
  reloadDiskVersion,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';

/**
 * What the editor is doing.
 *
 * `EditorPhase` under this module's own name, because it is not a property of a
 * text area: 2c-2-1 extracted it into `./editorSave.ts` when the small editor
 * needed the same two states over a different drafted value.
 */
export type RawEditorPhase = EditorPhase;

export type { SendFailure } from './editorSave';

/**
 * How far the conflict's reload has got.
 *
 * `./editorSave.ts`'s since 2c-4a-2, because the five match surfaces need the
 * identical three-step machine and a second copy of a rule about a destructive
 * confirmation is a second place for it to be relaxed. Re-exported under this
 * module's name, exactly as {@link RawEditorPhase} re-exports `EditorPhase`.
 */
export type { ReloadStep } from './editorSave';

/**
 * One editing session over one file's whole text.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1 applied
 * one layer up: a component holds one in a `$state.raw` and reassigns it, and
 * every function below returns a new session without touching its argument.
 */
export interface RawEditorSession {
  /** The file being edited, by the identity this window holds. */
  readonly document: DocumentId;
  /** The draft of its text. */
  readonly draft: Draft<RoundTripText>;
  /** Whether a save is in flight. */
  readonly phase: RawEditorPhase;
  /**
   * The submission the last save sent, or `null`.
   *
   * Kept after the answer arrives, because it is what
   * {@link acknowledgeFindings} needs and what tells a refusal apart from a
   * refusal about text the person has since changed.
   */
  readonly submitted: DraftSubmission<RoundTripText> | null;
  /** How the last save ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<RoundTripText> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed save whose invalidation threw
   * (`invalidationFailureMessage`). It is never a replacement for the saved arm —
   * the bytes are on disk (`PROGRESS.md` D2).
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How far the conflict's reload has got. */
  readonly reload: ReloadStep;
  /**
   * How the last save failed to produce an outcome at all, or `null`.
   *
   * Distinct from a refusal, which **is** an outcome: here the command failed, the
   * reason went to the workspace's own failure channel, and there are no findings
   * and no revision to show.
   */
  readonly sendFailure: SendFailure | null;
}

/**
 * What this mode always says about itself, before any save has been attempted.
 *
 * `describeRawSave(null)` rather than a literal, so the standing statement — *this
 * replaces the entire document* — comes from the module that owns it and cannot
 * drift from what a refusal says.
 */
const NOTHING_SAID_YET: RawSaveModel = describeRawSave(null);

/**
 * What this surface offers about a conflict.
 *
 * **The declaration `conflictChoicesFor` reads, and the only place this editor's
 * conflict capability is stated.** Its draft is the file's whole text, so a
 * clipboard preserves it exactly — which is the consult's Q3/Q4 rule and the
 * reason `copyDraft` is offered here and not to the mover, the deleter or the
 * duplicator. Both booleans are `true`, and since 2c-4a-3a so are the match
 * editor's and the creator's, whose drafts are authored text too. The mover, the
 * deleter and the duplicator have the same reload transition, built and called by
 * their components, and keep `offersReload: false` until 2c-4a-3b draws their
 * panels — a model that names a choice draws a control, and *offered* is a
 * different question from *implemented*.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'reseedsDraft',
  offersCopyDraft: true,
  offersReload: true
};

/**
 * Why this editor will not open a text at all.
 *
 * One arm today, and a union rather than a boolean so that a second reason is a
 * compile error in `rawEditorRefusalKey` rather than a sentence somebody forgets
 * to write.
 */
export type RawEditorRefusal = {
  /** The text carries a carriage return, which a text area cannot give back. */
  readonly kind: 'lineEndingsNotPreserved';
};

/**
 * Whether this editor may open one text at all, and why not when it may not.
 *
 * **A carriage return anywhere is a refusal, and this is the central promise of
 * the project defended at the one screen that can write.** A `<textarea>`'s *API
 * value* — what `event.currentTarget.value` answers, which is the only way this
 * editor learns what was typed — is defined by the HTML specification as the raw
 * value with **every line break normalized to LF**. So a CRLF document loses its
 * carriage returns on the first keystroke, the save writes the normalized text,
 * and the saved panel's *what is on disk now is exactly the text that was sent*
 * stays true while the file's line endings have been silently rewritten. The
 * 2c-1b window reading measured exactly that: three CRLF endings in, none out
 * (section 9.10.1).
 *
 * **The fix is a refusal, not a reconstruction**, and the alternative is named
 * here rather than left for somebody to rediscover. *Reconstruct-on-save* — diff
 * the candidate against the base and put the carriage returns back — is unsafe
 * for a file whose endings are **mixed**: the committed fixture
 * `file-comments-and-mixed-endings.yml` has exactly two CRLF lines among bare-LF
 * ones, so re-applying a dominant convention would rewrite line endings on lines
 * the person never touched. That is the same violation wearing a different hat,
 * and it would be harder to see. A refusal preserves the promise exactly and
 * forecloses nothing: a CRLF-capable editor — one that does not read its value
 * back through a text area — can be built later on top of it.
 *
 * The test is `\r` **anywhere**, not `\r\n`: a lone carriage return is normalized
 * to LF by the same rule, and a carriage return inside a block scalar is a byte of
 * the user's content that this editor equally cannot give back.
 *
 * @param text - A file's whole text, exactly as `document_text` answered it.
 * @returns The refusal, or `null` when this editor can hold the text unchanged.
 */
export function rawEditorRefusal(text: string): RawEditorRefusal | null {
  return text.includes('\r') ? { kind: 'lineEndingsNotPreserved' } : null;
} // End of function rawEditorRefusal()

/**
 * The brand that makes a checked text unforgeable. Declared, never exported.
 *
 * The same construct as `DraftConsent`, `ReloadConfirmation` and
 * `SealedWholeDocumentSave`: a property on a symbol this module does not export,
 * so no type outside it can name the key and no literal outside it can have it.
 */
declare const ROUND_TRIP: unique symbol;

/**
 * A text this editor can hold and give back **unchanged**.
 *
 * **The invariant as a type, not as a habit.** The first version of this module
 * checked for carriage returns at its two entry points and typed everything else
 * as `string`, and the second review pass was right that this is not the same
 * thing: `editText(session, 'a\rb')` type-checked and would have produced a save
 * candidate carrying a carriage return that no later read of the box could give
 * back. The current component path happens never to do it — a text area hands over
 * an already-normalized value — but *"happens never to"* is exactly the sentence
 * this project treats as a defect when it is written as a guarantee.
 *
 * So the drafted value is this type rather than `string`, and **{@link roundTripText}
 * is the only way to obtain one**. A `RoundTripText` is a `string` at run time and
 * assignable to one, so nothing downstream needs to know; a `string` is *not*
 * assignable to it, so every value that enters a session passes the check.
 *
 * **What that forces, and what it does not, in the same breath:** it forces that
 * no code path in this repository can put an unchecked string into a draft, a
 * submission or a candidate without writing a cast — and a cast is always
 * available in TypeScript, which is true of all four brands this project uses and
 * is why {@link beginSave} re-checks at the boundary that actually matters.
 */
export type RoundTripText = string & {
  /** The brand. Never present at run time, never nameable outside this module. */
  readonly [ROUND_TRIP]: typeof ROUND_TRIP;
};

/**
 * A text this editor can give back unchanged, or `null`.
 *
 * The one constructor of {@link RoundTripText}, and the only place the cast that
 * mints one is written.
 *
 * @param text - Any text.
 * @returns The same text at the narrower type, or `null` when
 *   {@link rawEditorRefusal} refuses it.
 */
export function roundTripText(text: string): RoundTripText | null {
  // The cast is the brand: the property it claims exists only in the type system,
  // and this is the one line in the repository that adds it.
  return rawEditorRefusal(text) === null ? (text as RoundTripText) : null;
} // End of function roundTripText()

/**
 * `textDraftRules` at the narrower type this editor drafts.
 *
 * The equality is taken from `draft.ts` rather than restated, so the two cannot
 * drift; only the snapshot needs narrowing, and it is the identity for the reason
 * `textDraftRules` gives — a string cannot be changed in place.
 */
const ROUND_TRIP_RULES: DraftValueRules<RoundTripText> = {
  same: textDraftRules.same,
  snapshot: (value) => value
};

/**
 * The dictionary key holding one refusal's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * arm of {@link RawEditorRefusal} with no sentence is one too.
 *
 * @param refusal - Why the editor will not open.
 * @returns The key holding that reason's sentence.
 */
export function rawEditorRefusalKey(refusal: RawEditorRefusal): TranslationKey {
  switch (refusal.kind) {
    case 'lineEndingsNotPreserved':
      return 'browser.rawEditor.lineEndingsNotPreserved';
  }
} // End of function rawEditorRefusalKey()

/**
 * Starts an editing session over one file's text, or refuses the text.
 *
 * **The refusal is in the return type, so there is no session to misuse.** A text
 * this editor cannot hold unchanged produces `null` rather than a session that
 * would quietly normalize it. What that forces is narrower than the first version
 * of this comment claimed and is worth stating exactly: the draft is a
 * `Draft<RoundTripText>`, so **the only value that can enter it is one
 * {@link roundTripText} minted**, here or at the two other doors ({@link editText}
 * and {@link loadDiskVersion}) — a plain `string` does not type-check anywhere on
 * that path. What it does **not** force is that a caller asks before drawing a
 * control, and `DetailPane` is the one caller, which withdraws *Edit this file's
 * text* and says why.
 *
 * @param document - The file to edit, by the identity this window holds.
 * @param baseRevision - The revision the text was read at. **The only thing
 *   standing between this session and silently overwriting whatever changed the
 *   file since**, so it is captured here and moved only at a boundary.
 * @param text - The file's whole text, exactly as `document_text` answered it.
 * @returns A clean session with no history, no consent and nothing said, or
 *   `null` when {@link rawEditorRefusal} refuses the text.
 */
export function startRawEditor(
  document: DocumentId,
  baseRevision: ContentRevision,
  text: string
): RawEditorSession | null {
  const held = roundTripText(text);
  if (held === null) {
    return null;
  }
  return {
    document,
    draft: startDraft(baseRevision, held, ROUND_TRIP_RULES),
    phase: 'editing',
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function startRawEditor()

/**
 * The conflict the session is showing, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: RawEditorSession): ConflictModel<RoundTripText> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether the text area accepts changes right now.
 *
 * The two policy decisions of this module's own note, in one predicate: not while
 * a save is in flight, and not while a conflict is showing.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link editText}, {@link undoEdit} and {@link redoEdit}
 *   would do anything.
 */
export function isEditable(session: RawEditorSession): boolean {
  return session.phase === 'editing' && conflictOf(session) === null;
} // End of function isEditable()

/**
 * Records whatever the text area now holds.
 *
 * **The carriage-return check is applied here too, and the second review pass is
 * why.** The first version took a `string` straight into the draft on the grounds
 * that a text area's API value never carries one — which is true of the component
 * path and is not a property of this function. `editText(session, 'a\rb')`
 * type-checked and produced a candidate this editor could never read back, which
 * is the same defect the constructor refuses, entered by a different door. A text
 * this editor cannot give back unchanged now leaves the session exactly as it was.
 *
 * @param session - The session being edited.
 * @param next - The text area's whole value.
 * @returns The session after the edit, or the same session when the editor is not
 *   accepting changes, the text carries a carriage return, or nothing changed.
 */
export function editText(session: RawEditorSession, next: string): RawEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const held = roundTripText(next);
  if (held === null) {
    return session;
  }
  const draft = editDraft(session.draft, held);
  // `editDraft` answers the same draft when the value did not change, and an edit
  // that changed nothing must not clear a `sendFailure` notice either: nothing has
  // happened.
  return draft === session.draft ? session : { ...session, draft, sendFailure: null };
} // End of function editText()

/**
 * Goes back one step.
 *
 * @param session - The session to undo.
 * @returns The session one step back, or the same session when there is nothing to
 *   undo or the editor is not accepting changes.
 */
export function undoEdit(session: RawEditorSession): RawEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = undoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, sendFailure: null };
} // End of function undoEdit()

/**
 * Goes forward one step, undoing an undo.
 *
 * @param session - The session to redo.
 * @returns The session one step forward, or the same session when there is nothing
 *   to redo or the editor is not accepting changes.
 */
export function redoEdit(session: RawEditorSession): RawEditorSession {
  if (!isEditable(session)) {
    return session;
  }
  const draft = redoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, sendFailure: null };
} // End of function redoEdit()

/**
 * Whether the findings on screen are about the text the draft still holds.
 *
 * The question the *Save anyway* offer hangs on. A refusal is about **one exact
 * candidate**: the gate matched that text's suspicions, and
 * `FindingCode::DocumentDoesNotParse` carries that text's own revision. Once the
 * person types, the findings describe something that is no longer on screen, and
 * offering to "save anyway" would be offering to save past findings nobody has
 * seen for the text that would actually be written.
 *
 * @param session - The session to ask about.
 * @returns `true` when a save has been answered and the draft has moved on since.
 */
export function outcomeIsStale(session: RawEditorSession): boolean {
  return submissionIsStale(session.draft, session.submitted);
} // End of function outcomeIsStale()

/**
 * Whether a save may be started.
 *
 * **Gated on dirty**, so the control cannot send a candidate byte-identical to
 * what the file holds. That would be a legal save — `committed: false` is a
 * documented success — and it would still take the lock, reparse the file and
 * write a backup batch marker for nothing.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link beginSave} would produce a submission.
 */
export function canSave(session: RawEditorSession): boolean {
  return session.phase === 'editing' && conflictOf(session) === null && isDirty(session.draft);
} // End of function canSave()

/** A save about to be sent: the session that is waiting, and what to send. */
export interface StartedSave {
  /** The session, now in flight, with the submission recorded on it. */
  readonly session: RawEditorSession;
  /**
   * What to hand `saveRawDocument`.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only
   * place the two are put together.
   */
  readonly submission: DraftSubmission<RoundTripText>;
}

/**
 * Starts a save of the draft as it stands.
 *
 * **The carriage-return check is repeated here, at the boundary that matters, and
 * it is deliberately redundant.** Every door into the draft mints a
 * {@link RoundTripText}, so a session holding one is a compile-time fact — but the
 * brand is a cast at bottom, exactly as `DraftConsent` and `SealedWholeDocumentSave`
 * are, and a cast written anywhere in this repository would put an unchecked string
 * into a candidate that goes on to **replace a user's file**. This is the last line
 * before the wire, so the check is cheap here and unrecoverable one step later.
 * What it cannot do is answer *why* to a screen: a caller that reaches this state
 * has already been refused at a door that could explain itself.
 *
 * @param session - The session to save.
 * @returns The waiting session and the submission, or `null` when there is
 *   nothing to save or the candidate is one this editor could not have produced.
 */
export function beginSave(session: RawEditorSession): StartedSave | null {
  if (!canSave(session)) {
    return null;
  }
  if (rawEditorRefusal(session.draft.value) !== null) {
    return null;
  }
  const submission = submissionOf(session.draft);
  return {
    session: { ...session, phase: 'saving', submitted: submission, sendFailure: null },
    submission
  };
} // End of function beginSave()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `acknowledgeRefusal`, which is the **only** producer of consent and
 * which checks the base revision, the candidate identity and whether an
 * acknowledgement could move the verdict at all. Every one of those answers with
 * the draft unchanged, so a session that could not consent is returned unchanged
 * and the save that follows is an ordinary first attempt rather than a forced one.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeFindings(session: RawEditorSession): RawEditorSession {
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeFindings()

/**
 * Takes a save's answer, discharging the invalidation on the way.
 *
 * **The one place this editor learns anything about a save.** The answer arrives
 * sealed, and `openWholeDocumentSave` is the only way to open it: a session that
 * did not discharge the invalidation would have no outcome to draw at all.
 *
 * The callback is this editor's own forgetting, and what it is worth is stated
 * rather than implied. The **workspace's** cache invalidation — the projections,
 * the selection, the raw viewer's snapshot — has already happened by the time this
 * runs: `createBrowserState`'s `saveRawDocument` passes its own invalidation to
 * the command, which calls it before the promise resolves, which is the only
 * moment early enough (`docs/decisions/2b-2c-3b-notes.md` section 3). What this
 * callback carries is the revision the file holds now, and the draft is rebased on
 * it. So the seal forces the **call**, and the body is this module's; no
 * TypeScript signature can require a body to act (`2c-1a-notes.md` section 4.3).
 *
 * Three properties this function keeps, each of which a first version of some
 * layer of this project got wrong at least once:
 *
 * - a committed save is **still a committed save** when the invalidation threw:
 *   the failure becomes an extra line and never replaces the arm (`PROGRESS.md`
 *   D2);
 * - the base moves to the **candidate that was sent**, never to what the editor
 *   holds now — they are the same here, because the box is read-only while a save
 *   is in flight, and `savedDraft` is given the submission anyway so that stays
 *   true if that policy ever changes;
 * - opening a seal twice is refused rather than served, and this answers by
 *   leaving the session alone: the outcome was delivered once already, and
 *   inventing a second one would be this editor claiming a save that did not
 *   happen.
 *
 * @param session - The session waiting for an answer.
 * @param sealed - What `BrowserState.saveRawDocument` answered.
 * @returns The session showing what the save ended as.
 */
export function applySave(
  session: RawEditorSession,
  sealed: SealedWholeDocumentSave
): RawEditorSession {
  const submission = session.submitted;
  if (submission === null) {
    return session;
  }
  // A holder rather than a bare `let`, because TypeScript's flow analysis assumes
  // a callback did not run and would narrow a `let` back to `null` here.
  const replaced: { revision: ContentRevision | null } = { revision: null };
  const opening = openWholeDocumentSave(sealed, (invalidation) => {
    replaced.revision = invalidation.revision;
  });
  if (opening.kind === 'alreadyOpened') {
    return { ...session, phase: 'editing' };
  }
  const outcome = opening.outcome;
  const draft =
    outcome.outcome === 'saved'
      ? savedDraft(session.draft, submission, replaced.revision ?? outcome.revision)
      : session.draft;
  // **Two invalidations, one sentence.** `invalidation` is what this module's own
  // callback did; `issuerInvalidation` is what the workspace's did, earlier, and
  // it is the one that can really fail on the running path — the 2c-1b review's
  // third finding, which was that its failure reached the developer console and
  // no screen. Either failing means the same thing to a person, so at most one
  // line is added.
  const failed =
    invalidationFailureMessage(opening.invalidation) ??
    invalidationFailureMessage(opening.issuerInvalidation);
  return {
    ...session,
    phase: 'editing',
    draft,
    // The conflict arm is given the draft as it was when the save was refused,
    // which is this one: nothing has changed it, because the box was read-only for
    // the whole of the save.
    outcome: describeWholeDocumentSave(outcome, session.draft, CONFLICT_CAPABILITIES),
    extraMessages: failed === null ? [] : [failed],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function applySave()

/**
 * Records that the save produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed and the reason went to the workspace's own
 * failure channel. Whether the file changed is a **second** question, and the only
 * honest answers are "no" and "this application cannot tell": a failure at or
 * after the rename may have left the candidate on disk, and a screen that says
 * nothing was written for one of those states the opposite of what the disk may
 * hold. The draft is untouched either way, so nothing the person wrote is lost.
 *
 * **The reason is `null` here, and that is a limit rather than a policy.**
 * `SendFailure` carries one since 2c-2-2, and the small editor draws it; the raw
 * editor cannot, because `RawSaveAnswer`'s failed arm carries only
 * `mayHaveWritten` and 2c-1b's sealed boundary is not this sub-phase's to widen.
 * So a raw save that never left still sends the person to the developer console
 * for the why. Written down rather than papered over, because a reader of this
 * function beside `matchEditor.saveCouldNotBeSent` would otherwise take the
 * difference for an oversight.
 *
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the submitted text.
 * @returns The session, back to editing, with the right notice raised.
 */
export function saveCouldNotBeSent(
  session: RawEditorSession,
  mayHaveWritten: boolean
): RawEditorSession {
  return {
    ...session,
    phase: 'editing',
    sendFailure: sendFailureOf(mayHaveWritten, null)
  };
} // End of function saveCouldNotBeSent()

/**
 * Puts the outcome away and gives the box back.
 *
 * *Keep editing*, for all three arms. The draft is untouched — this is a panel
 * being dismissed, not a state being resolved — and the submission goes with it,
 * because there is nothing left on screen to acknowledge.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last save.
 */
export function keepEditing(session: RawEditorSession): RawEditorSession {
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function keepEditing()

/**
 * The text *Copy draft* puts on the clipboard, or `null`.
 *
 * `copyOfDraft` rather than a field read, so the conflict state has one named way
 * to be copied out of. It is exactly the bytes the conflict is about, which is
 * only true because the box is read-only while the conflict is showing.
 *
 * @param session - The session to copy from.
 * @returns The retained text, or `null` when no conflict is showing.
 */
export function textToCopy(session: RawEditorSession): RoundTripText | null {
  const conflict = conflictOf(session);
  return conflict === null ? null : copyOfDraft(conflict);
} // End of function textToCopy()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing.
 */
export function askToReload(session: RawEditorSession): RawEditorSession {
  const next = reloadAsked(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReload()

/**
 * Confirms discarding the draft for the version on disk.
 *
 * Issues the token `reloadDiskVersion` checks, for **this** conflict. Reachable
 * only from the warning step, so a confirmation cannot be produced by a screen
 * that never showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmReload(session: RawEditorSession): RawEditorSession {
  const next = reloadConfirmed(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmReload()

/**
 * Adopts the disk version into the window and starts again from it.
 *
 * **The destructive transition, and since 2c-4a-2 it is one operation rather than
 * two.** It used to take a revision and a text the *caller* had obtained from
 * somewhere else, on the assumption that `BrowserState` had already installed the
 * disk projection before the answer arrived. The consult's Q2 removed that
 * assumption: a conflict now installs nothing, so this function performs the
 * workspace adoption itself, through the `adopt` callback, in the same call that
 * reseeds the draft. Neither half can happen without the other, and neither can
 * happen without a confirmation issued for **this** conflict.
 *
 * The text and the revision are the conflict's own — `diskText` and
 * `diskRevision`, paired by the command layer — rather than a second read's, which
 * is what makes the reseeded draft's base revision describe the bytes it holds.
 *
 * **It refuses a disk version this editor could not hold unchanged**, for
 * {@link rawEditorRefusal}'s reason and by the same test. This is the one path
 * that could otherwise put a text into a session without going through
 * {@link startRawEditor}, and a text with carriage returns arriving here would
 * reopen the defect the constructor closes. The screen disables the control and
 * says why; this is the guarantee behind that, and it is a guarantee about *this
 * function*, not about every way `reloadedDraft` can be reached — `draft.ts`
 * exports that too, which is `2c-1a-notes.md` section 4.8 and is unchanged.
 *
 * **Nothing is reseeded for an adoption the window refused.** The draft is
 * computed first because it is pure, `adopt` is called only once every check here
 * has passed, and a `refused` from it leaves both the window and the draft exactly
 * as they were — a confirmation issued for another conflict, one already spent, a
 * conflict this window did not produce, or a projection replaced since it arrived.
 * A carriage return in the disk text is refused one step earlier, here.
 * **`alreadyThere` reseeds**: the window already holds the bytes the draft would be
 * seeded from, so the request is satisfied and the draft follows it.
 *
 * **What no type here forces**: that `adopt`'s body does anything.
 * `() => 'installed'` type-checks, exactly as `openWholeDocumentSave`'s `forget`
 * does (`2c-1a-notes.md` section 4.3) — the type constrains the *answer* to a
 * {@link DiskAdoptionOutcome} and not the work behind it. What it forces is that
 * the caller cannot obtain the reseeded draft without this function having called
 * it and been told the window holds the disk version.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and only
 *   when this reload really happens.
 * @returns A clean session over the disk version, or the same session.
 */
export function loadDiskVersion(
  session: RawEditorSession,
  adopt: AdoptTheDiskVersion<RoundTripText>
): RawEditorSession {
  const conflict = conflictOf(session);
  if (conflict === null || session.reload.kind !== 'confirmed') {
    return session;
  }
  const held = roundTripText(conflict.diskText);
  if (held === null) {
    return session;
  }
  const reloaded = reloadDiskVersion(
    conflict,
    session.reload.confirmation,
    conflict.diskRevision,
    held
  );
  if (reloaded === null) {
    return session;
  }
  const spend = spendTheConfirmedReload(conflict, session.reload, adopt);
  if (spend === 'notAttempted') {
    return session;
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the 2c-4a-3a
    // review's finding 3: the confirmation is spent and the window said no for a
    // reason asking again cannot change, so the control stops being offered and the
    // panel says so. Nothing is reseeded, and *Keep editing* writes `NOT_RELOADING`
    // back for a fresh attempt.
    return { ...session, reload: RELOAD_REFUSED };
  }
  return {
    ...session,
    draft: reloaded,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function loadDiskVersion()

/** Everything a screen needs about one session, derived on every read. */
export interface RawEditorView {
  /** The text the box shows. */
  readonly text: RoundTripText;
  /** Whether the draft differs from what it was started from. Derived. */
  readonly dirty: boolean;
  /** Whether there is a step to go back to. Derived. */
  readonly canUndo: boolean;
  /** Whether there is an undone step to go forward to. Derived. */
  readonly canRedo: boolean;
  /** Whether a save is in flight. */
  readonly saving: boolean;
  /** Whether the box accepts changes. */
  readonly editable: boolean;
  /** Whether the save control does anything. */
  readonly canSave: boolean;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * What this mode says about itself, and about a parse rejection when there is
   * one.
   *
   * `describeRawSave`'s model: before any save it is the single standing
   * statement, and after a whole-document refusal it is that statement plus the
   * `willNotLoad` sentence and the parser's position. Taken from the refused arm's
   * own field rather than rebuilt, so `rawSave.ts` decides it once.
   */
  readonly rawSave: RawSaveModel;
  /** How the last save ended, or `null`. */
  readonly outcome: SaveOutcomeModel<RoundTripText> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /**
   * What to offer about a refusal.
   *
   * The refused arm's own choices while the findings are about the text on
   * screen, and *Keep editing* alone once they are not: an offer to save past
   * findings that describe different text is an offer this application would not
   * keep, because the gate matches the multiset of **the candidate's own**
   * suspicions.
   */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about text that has since changed. */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<RoundTripText> | null;
  /**
   * The disk side's **whole file text**, or `null` when no conflict is showing.
   *
   * The conflict payload's own `diskText`, paired with `conflict.diskRevision` by
   * the command layer. **There is no unavailable arm**, and that is 2c-4a-1's D1
   * rather than an omission here: a `SaveResult::Conflict` cannot exist without the
   * read that produced this text having succeeded, so a state saying *the version
   * on disk cannot be read* would be a sentence about something this application
   * cannot produce.
   *
   * **A `ConflictDiskText` since 2c-4a-3a, and no longer a `string`.** An empty
   * file is a fact about the file rather than an absence, and this component used
   * to say so by comparing the string to `''` in its own markup — as did the two
   * panels added by that step, which is why the decision moved to
   * `conflictDiskText` in `./saveOutcome.ts` and all three now walk it.
   */
  readonly diskText: ConflictDiskText | null;
  /**
   * Why the version on disk cannot be loaded into this editor, or `null`.
   *
   * Shown rather than hidden, because the disk version is still *drawn* —
   * `SourceText` names a carriage return rather than dropping it — and a control
   * that silently did nothing would read as a bug.
   */
  readonly diskRefusal: RawEditorRefusal | null;
  /** What to offer about the conflict, at whichever step it has reached. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * Whether a confirmed reload was spent and the window refused it.
   *
   * **The disclosure this panel owes for a control that has just gone.** The reload
   * is not offered again once a spend has been refused — asking again could only be
   * refused again — and a control that vanishes with nothing said in its place
   * reads as a bug (2c-4a-3a review, finding 3). Nothing was written, nothing was
   * discarded and nothing was reseeded; *Keep editing* resets the step.
   */
  readonly reloadUnavailable: boolean;
  /**
   * Whether confirming the reload would do anything.
   *
   * `false` for a disk version carrying a carriage return, which is the one thing
   * {@link loadDiskVersion} refuses on its own. The decision is here rather than in
   * markup for this directory's standing reason: a rule written into one renderer
   * is carried by that renderer's mounted suite alone.
   */
  readonly canReload: boolean;
}

/**
 * Everything a screen needs about one session.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up: a
 * `dirty` this module cached would be a second answer to a question the draft
 * already answers, and the two would eventually disagree.
 *
 * @param session - The session to describe.
 * @returns The view.
 */
export function rawEditorView(session: RawEditorSession): RawEditorView {
  const outcome = session.outcome;
  const conflict = conflictOf(session);
  const stale = outcomeIsStale(session);
  const refused = refusedArm(outcome);
  const diskRefusal = conflict === null ? null : rawEditorRefusal(conflict.diskText);
  return {
    text: session.draft.value,
    dirty: isDirty(session.draft),
    canUndo: canUndo(session.draft),
    canRedo: canRedo(session.draft),
    saving: session.phase === 'saving',
    editable: isEditable(session),
    canSave: canSave(session),
    sendFailure: session.sendFailure,
    rawSave: refused?.rawSave ?? NOTHING_SAID_YET,
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: outcome !== null && outcome.kind === 'saved' ? outcome.notes : [],
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    diskText: conflictDiskText(conflict),
    diskRefusal,
    conflictChoices:
      conflict === null
        ? []
        : conflictChoicesFor(
            CONFLICT_CAPABILITIES,
            offeredReloadStep(session.reload)
          ),
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    canReload: conflict !== null && diskRefusal === null
  };
} // End of function rawEditorView()

/**
 * The acknowledgement one submission carries, for a caller that only needs that.
 *
 * A named read rather than a property access at the call site, so the one place a
 * screen hands consent to the boundary is a place this module can be searched for.
 *
 * @param submission - What {@link beginSave} produced.
 * @returns The suspicions already shown to a person, for this exact candidate.
 */
export function acknowledgementOf(submission: DraftSubmission<RoundTripText>): Acknowledgement {
  return submission.acknowledgement;
} // End of function acknowledgementOf()
