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
 * given. **Since Phase 2d-6-5 the same freeze holds under a conflict the watcher
 * raised**, with one difference: *Keep editing* gives the box back only for a
 * save conflict — an external conflict is not a panel a dismissal resolves, so
 * the box stays read-only until the reload or the editor's close (the 2d-6
 * record's §3 entry 9).
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
 *
 * ## The external session — Phase 2d-6-5
 *
 * The shape `./matchEditor.ts` took at 2d-6-2 and the three operation sessions
 * at 2d-6-4, for this editor. {@link RawEditorSession.externalConflict} is the
 * conflict a watcher observation raised over the file this editor holds, a field
 * beside `outcome` and never an arm of it (the 2d-6 record's §3 entry 6);
 * {@link applyObservation} is the session's receiver as a value, one named action
 * per verdict arm and a `never` terminus (entry 11); {@link conflictOf} answers
 * the conflict shown whichever origin it has, so {@link isEditable},
 * {@link canSave} and {@link beginSave} refuse under both (entry 8 — a direct
 * call past a disabled control answers `null`). A held observation
 * ({@link RawEditorSession.awaitingReconciliation}) refuses the save alone; a
 * conflict raised under an unknown write outcome
 * ({@link RawEditorSession.uncertaintyUnresolved}) withholds the reload until
 * {@link acknowledgeSnapshot} is told the hold ended (entries 11, 15);
 * {@link keepEditing} erases none of the three (entry 9).
 *
 * **The reseed is the same door for both origins, and the carriage-return
 * refusal stands at it** (`CLAUDE.md` §6, *Text on the wire and on screen*):
 * {@link loadDiskVersion} reseeds from the conflict's own `diskText` — a save
 * refusal's or a watcher observation's alike — and a disk version carrying a
 * `\r` is refused there, never normalized, exactly as it was before this module
 * knew a second origin (entry 23's "reseed"). A replacing verdict resets the
 * reload step and retires a save conflict (entries 7, 12), so consent collected
 * for one draft is never spendable on a reseeded one.
 *
 * **The reapply stays `unavailable`** (entry 22): {@link reapplyToDiskVersion}
 * now enters through `enterReapply` in `./reapply.ts`, which reads this surface's
 * permanent declaration before it looks at the conflict, so an external
 * conflict answers exactly what a save conflict does — the declared unsupported
 * reapply, and never a supported one that always falls back.
 *
 * **Every door and every settling transition can read the installed session**
 * through a {@link ReadTheInstalledSession} (2d-6-4's review, its three
 * blockers): {@link beginSave} spends only against the session it was handed
 * while that is still installed; {@link applySave} and {@link saveCouldNotBeSent}
 * replay what the receiver appended during their own replay. The reader is
 * optional while `RawEditor.svelte` passes none, and its doc says what that
 * costs.
 *
 * **No component registers this receiver yet.** 2d-6-8 wires
 * `BrowserState.registerObservationReceiver` to it through `DetailPane` and
 * draws the result; until then every case that drives it is a model test, and
 * `RawEditor.svelte` draws neither the external conflict's own lines nor the
 * two notices.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  PresentationNote
} from '../ipc/types';
import type { ConflictSource, ExternalConflictObservation } from './conflictSource';
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
import type { AcknowledgeTheUncertainty } from './matchEditor';
import type { ExternalConflictNotice, ObservationDelivery } from './observationDelivery';
import {
  enterReapply,
  type ReapplyOutcome,
  type SharedReapplyObstacle,
  type StandingOriginGuard
} from './reapply';
import { describeRawSave, type RawSaveChoice, type RawSaveModel } from './rawSave';
import {
  conflictChoicesFor,
  conflictDiskText,
  copyOfDraft,
  describeExternalConflict,
  describeWholeDocumentSave,
  invalidationFailureMessage,
  reloadDiskVersion,
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
  /**
   * How far the conflict's reload has got.
   *
   * **Reset to `idle` by every new outcome, by every dismissal and by every
   * replacing verdict** ({@link applyObservation}, the 2d-6 record's §3 entry
   * 12), which is what stops a confirmation collected for one conflict from
   * being spendable while a later one is on screen. The window refuses a spent
   * confirmation too, but this is the guard that means the situation never
   * arises.
   */
  readonly reload: ReloadStep;
  /**
   * How the last save failed to produce an outcome at all, or `null`.
   *
   * Distinct from a refusal, which **is** an outcome: here the command failed, the
   * reason went to the workspace's own failure channel, and there are no findings
   * and no revision to show.
   */
  readonly sendFailure: SendFailure | null;
  /**
   * The conflict a watcher observation raised over the file this editor holds,
   * or `null` — Phase 2d-6-5, the 2d-6 record's §3 entry 6.
   *
   * **A field of its own beside {@link RawEditorSession.outcome}, never an arm of
   * it**, for `MatchEditorSession.externalConflict`'s reason: an outcome is how
   * *a save* ended, and a conflict the watcher raised is not that. {@link conflictOf}
   * is the one accessor that reads both and answers the conflict this editor is
   * showing, whichever origin it has. **Only one conflict is active at a time,
   * and the transitions are what keep it so** (entry 7): {@link applyObservation}
   * retires a save conflict's outcome when it sets this, and {@link applySave}
   * retires this when a save ends as a conflict or a success. The type admits
   * both populated, and a session built by hand with both gets
   * {@link conflictOf}'s stated precedence, not a guarantee.
   *
   * While it is non-null the box is read-only and nothing can be saved, exactly
   * as under a save conflict; {@link keepEditing} does not clear it (entry 9).
   * The way out is the reload, which reseeds from the observation's own disk
   * text through the same carriage-return refusal a save conflict's reload meets.
   */
  readonly externalConflict: ExternalConflictModel<RoundTripText> | null;
  /**
   * Whether {@link RawEditorSession.externalConflict} was raised while a write of
   * this window's own had an unknown outcome, and this session has not been told
   * the hold ended — Phase 2d-6-5, entry 11's `raisedWithoutReload` row.
   *
   * While `true` the reload is withheld, for the match editor's reason: a
   * confirmed reseed from bytes a write of this window may or may not have
   * produced would settle, silently, a question only the person can. It ends
   * when {@link acknowledgeSnapshot} is told the window ended the hold, or when a
   * later verdict replaces the conflict under no uncertainty. **It records what
   * this session was told and nothing more**: a hold the window ends by a later
   * definite write delivers nothing to a session, and this flag cannot see it.
   * This module never sets it without a conflict, so the save is blocked by the
   * conflict it qualifies.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations this session was told the window is holding and has not
   * decided about, keyed by the file each is about — Phase 2d-6-5, entry 11's
   * `retained` row, in the shape the other seven sessions share.
   *
   * **A restriction on saving, and nothing else**: while this editor's own file
   * has an entry, {@link canSave} answers `false` and {@link beginSave} answers
   * `null` (entry 8); the box stays editable, because a wait is a restriction on
   * sending and freezing the text for a decision the window has not made would
   * claim more than the fact supports. No disk comparison and no origin is
   * recorded. An entry is lifted by the delivery that decides **that**
   * observation, whatever the verdict — `writtenHere` included — compared by
   * identity, and replaced by a later `retained` about the same file.
   *
   * **What the map forces and what it does not, in the same sentence.** It forces
   * that a wait is always keyed by the file it is about and that only this
   * editor's file's wait blocks; through this module's own transitions it holds
   * at most that one entry, because a `retained` about another file records
   * nothing here — the map is the shape the sessions share since 2d-6-3's review,
   * so the field reads alike on every surface, not a claim that this editor can
   * change its file. It cannot force that the deciding delivery arrives — a
   * session whose receiver was unregistered before the window decided is never
   * told and stays blocked until closed — nor that a wait it was *not* told of,
   * because no receiver was registered when the window held the reading, is
   * recorded at all; both are facts about registration, which is 2d-6-8's. What
   * it cannot see is a reading the barrier coalesced away without announcing it.
   */
  readonly awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>;
  /**
   * Every delivery that arrived while this editor's own save was in flight, in
   * the order it arrived, kept until that save's answer has been applied — Phase
   * 2d-6-5, the 2d-6 record's §3 entry 5.
   *
   * `MatchEditorSession.heldDeliveries`'s rule, unchanged: the window publishes a
   * write's settlement from inside the writing wrapper, before the `await` that
   * started it resumes, so {@link applyObservation} appends here while the phase
   * is `saving` and {@link applySave} and {@link saveCouldNotBeSent} replay the
   * whole list through it, first to last, after their own answer — and, given a
   * {@link ReadTheInstalledSession}, whatever the receiver appended to the
   * installed session while they were doing so. **What the list forces** is that
   * no envelope delivered during the save is dropped and that first-to-last is
   * the order; **what it does not force** is that arrival order was decision
   * order — the window's own contract — nor that a caller passes the reader:
   * `RawEditor.svelte` settles its live `session` after its own `await` and
   * passes none today, and nothing in TypeScript stops a caller handing a
   * capture and no reader.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
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
 * deleter and the duplicator offer the reload as of 2c-4a-3b, over the same
 * transition their components had been calling since 2c-4a-2 — a model that names
 * a choice draws a control, and *offered* was a different question from
 * *implemented* for exactly one sub-phase. Their copy stays refused for ever.
 *
 * **This surface is the only one that reseeds**, and `reloadOutcome` is where that
 * is said: its draft is replaced by the disk text rather than the panel closing.
 *
 * **And it is one of the two that can never reapply — restore is the other, for
 * the same reason, since 2c-5-3.** `reapplySupport` is `unavailable` permanently,
 * by the consult's Q4: this candidate is a whole document, so there is no
 * target, no field intent and no operation to re-resolve, and "reapply" could
 * only mean overwriting the newly read disk text with a stale string or
 * inventing a text merge — the first forbidden by plan section 6.5 and the
 * second by the plan outright. {@link reapplyToDiskVersion} is what says so as a
 * value, for a conflict of either origin since Phase 2d-6-5 (the 2d-6 record's
 * §3 entry 22); 2c-4c owns the recovery fallback this surface is left with.
 *
 * **`offersReapply` is `false` here and it is the weaker of the two statements.**
 * The five match surfaces set it `true` at 2c-4b-3 and this one did not, but a
 * `true` here would change nothing on the screen: `conflictChoicesFor` requires the
 * permanent `reapplySupport` as well, so no control could be drawn for a transition
 * that answers `unavailable` before it looks at any evidence. The field is set
 * because it is required — a surface cannot inherit somebody else's answer — and
 * `saveOutcome.test.ts` pins both halves, including that setting this one alone
 * offers nothing.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'reseedsDraft',
  offersCopyDraft: true,
  offersReload: true,
  offersReapply: false,
  reapplySupport: 'unavailable'
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
 * The dictionary key holding one refusal's sentence **about a reload**.
 *
 * **The same refusal, a different door, and 2c-4a-3c's finding 10.5 is why there
 * are two functions.** {@link rawEditorRefusal} is asked twice for two different
 * texts: once about the file this editor is being asked to *open*, and once about
 * the version on disk a conflict is being asked to *load into an editor that is
 * already open* ({@link RawEditorView.diskRefusal}). Until this step both drew
 * `browser.rawEditor.lineEndingsNotPreserved`, which ends *"…it will not open this
 * file for editing"* — so the reason for a **disabled reload confirmation** was
 * carried by a sentence about a **different control**, beside an editor the person
 * was looking at with their own draft still in it. The window reading printed the
 * two side by side.
 *
 * **Two key functions over one union rather than a second union**, because the
 * refusal is genuinely the same fact — a carriage return this editor cannot give
 * back — and only the door differs. A new arm of {@link RawEditorRefusal} is a
 * compile error in **both** functions, which is what a `switch` over literal keys
 * buys and what a template would not.
 *
 * **What no type forces**: that a caller asks the right one. `RawEditorView`
 * separates `diskRefusal` from the opening refusal as two fields, and
 * `RawEditor.svelte` draws each with its own accessor; nothing stops a third
 * caller from drawing the opening sentence beside a reload.
 *
 * @param refusal - Why the version on disk will not be loaded.
 * @returns The key holding that reason's sentence.
 */
export function rawEditorDiskRefusalKey(refusal: RawEditorRefusal): TranslationKey {
  switch (refusal.kind) {
    case 'lineEndingsNotPreserved':
      return 'browser.rawEditor.diskLineEndingsNotPreserved';
  }
} // End of function rawEditorDiskRefusalKey()

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
    sendFailure: null,
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    heldDeliveries: []
  };
} // End of function startRawEditor()

/**
 * The wait that restricts this editor **now**, or `null` — its own file's entry
 * of {@link RawEditorSession.awaitingReconciliation}.
 *
 * @param session - The session to ask about.
 * @returns The observation the session is waiting on, or `null`.
 */
function awaitedFor(session: RawEditorSession): ExternalConflictObservation | null {
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
 * **Widened to the union at Phase 2d-6-5**, from the save arm alone. The external
 * conflict is answered first, then the outcome's conflict arm — a definite answer
 * for a session built by hand with both populated, and a decision about nothing
 * for one this module built, because {@link applyObservation} and
 * {@link applySave} keep the two exclusive (the 2d-6 record's §3 entry 7).
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: RawEditorSession): ConflictModel<RoundTripText> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Whether the text area accepts changes right now.
 *
 * The two policy decisions of this module's own note, in one predicate: not while
 * a save is in flight, and not while a conflict is showing — of either origin,
 * since Phase 2d-6-5, so *Copy draft* copies exactly the bytes an external
 * conflict is about too. A held observation does **not** freeze the box: it is a
 * restriction on sending ({@link canSave}), not on drafting.
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
 * **"Cannot submit" is a rule of this model and not of a disabled button** —
 * Phase 2d-6-5, the 2d-6 record's §3 entry 8. Two external restrictions refuse
 * here, and {@link beginSave} asks this same function so the two boundaries
 * cannot disagree: a conflict of either origin, through {@link conflictOf}, and
 * an observation the window is holding undecided about this file
 * ({@link RawEditorSession.awaitingReconciliation}), which is a restriction on
 * sending alone. An unresolved write uncertainty blocks through the conflict it
 * qualifies, which this module never sets it without. What this forces is
 * refusal for the session it is given; **it cannot force that session to be
 * current** (R37) — one synchronous decision over one snapshot is the whole of
 * the guarantee, and {@link beginSave}'s reader is what lets a caller ask about
 * the installed one.
 *
 * @param session - The session to ask about.
 * @returns `true` when {@link beginSave} would produce a submission.
 */
export function canSave(session: RawEditorSession): boolean {
  return (
    session.phase === 'editing' &&
    conflictOf(session) === null &&
    isDirty(session.draft) &&
    awaitedFor(session) === null
  );
} // End of function canSave()

/**
 * Reads the session a caller currently holds — the one its registered receiver
 * has been updating — for a door or a settling transition to check against.
 *
 * **`ReadTheInstalledSession` in `./matchDeletion.ts`, for this session**, and it
 * exists for the reason 2d-6-4's review gave (its first, second and third
 * findings, one class): a transition's caller-controlled operand — here the
 * draft's own value at {@link beginSave}, an observation being replayed at
 * {@link applySave}, the observation's projection the window copies inside
 * {@link loadDiskVersion}'s adoption — is read through property access, and a
 * property read runs arbitrary code; a getter there can call
 * `BrowserState.observeExternalChange`, whose registered receiver replaces the
 * *installed* session with one carrying an external conflict or a wait. A
 * transition that then checked the block on the session it was handed would
 * check a session no longer installed, and spend. So the spending door, both
 * settling transitions and the reload ask for the installed session through
 * this, once, after their last caller-controlled read — the reload once more
 * after its adoption — and refuse, or answer the installed session, when what
 * is installed is not what they were handed.
 *
 * **What it forces and what it does not, in the same sentence.** With one
 * supplied, {@link beginSave} spends only against the session it was handed while
 * that session is still the one installed, {@link loadDiskVersion} reseeds over
 * the installed session and answers it untouched when the adoption replaced the
 * conflict, and {@link applySave} /
 * {@link saveCouldNotBeSent} settle every delivery the receiver appended to the
 * installed session during the save and during their own replay. It cannot force
 * a caller to supply one: **the parameter is optional so that `RawEditor.svelte`,
 * which this phase may not touch and which registers no receiver today, keeps
 * compiling** — and a caller that registers a receiver and passes no reader gets
 * the displaced check and the lost delivery this closes. **2d-6-6, which makes
 * the reader required across the sessions, or 2d-6-8, which registers this
 * receiver — whichever comes first — must pass `() => session` at every one of
 * these calls, and either may make the parameter required.** Nor can it force
 * that the closure reads the installed session rather than a capture;
 * `() => session` over the component's `$state.raw` is the honest one.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => RawEditorSession;

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
 * **Every caller-controlled read comes first, the installed session is read
 * once and last, and nothing runs between that read and the answer** — Phase
 * 2d-6-5, the 2d-6 record's §3 entry 8 and R37, in the shape 2d-6-4's review
 * gave `confirmDelete`, and this phase's review sharpened (its first finding):
 * this door reads the draft's value more than once — the submission, the
 * dirtiness {@link canSave} derives — and spreads the session, and a getter that
 * is quiet on the first read and delivers on a later one, or on the spread, has
 * run after any check made earlier. So the submission is taken first, the
 * carriage-return check is made **on the submission's own candidate** — the
 * exact bytes that would reach the wire, never a separate read that a getter
 * could answer differently — the eligibility is asked and the waiting session
 * is built, all before the installed session is read through `current`, once;
 * and only a session that is still the one handed in, with the checks passed,
 * spends. A receiver run from any of those reads — which replaces the installed
 * session with one carrying an external conflict or a wait — is seen by the
 * identity check rather than overwritten by the spend, and a receiver replaces a
 * session and never mutates one, so a session still installed carries what it
 * carried when {@link canSave} was asked. An external conflict, a held reading
 * and the uncertainty the conflict carries each answer `null` here, exactly as
 * they disable the control. What that forces is refusal for the session
 * installed at the moment of the spend; it cannot force a caller to pass a
 * reader at all ({@link ReadTheInstalledSession} says what a missing one costs),
 * nor stop a caller redefining a property of the very session it handed in —
 * that caller's own session is what it defeats.
 *
 * @param session - The session to save.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   checks the block on the session handed in — honest only for a caller that
 *   registers no receiver, which is `RawEditor.svelte` today.
 * @returns The waiting session and the submission, or `null` when there is
 *   nothing to save, the session may not submit, or the candidate is one this
 *   editor could not have produced.
 */
export function beginSave(
  session: RawEditorSession,
  current: ReadTheInstalledSession | null = null
): StartedSave | null {
  // **Every caller-controlled read of this door, taken here, before the
  // installed session is read.** The draft is the session's own, but `readonly`
  // freezes nothing at run time and a getter installed on it runs on each of
  // these reads — the submission's, `canSave`'s, the spread's.
  const submission = submissionOf(session.draft);
  // The check is made on the bytes that would be sent, and on nothing else.
  const refused = rawEditorRefusal(submission.candidate) !== null;
  const eligible = canSave(session);
  const started: StartedSave = {
    session: { ...session, phase: 'saving', submitted: submission, sendFailure: null },
    submission
  };
  // **The installed session, read once, after the last of those reads.** A
  // receiver run from a getter above has replaced it; a session that is no
  // longer the one installed spends nothing. Nothing caller-controlled runs
  // between this read and the return.
  const installed = current === null ? session : current();
  if (installed !== session || refused || !eligible) {
    return null;
  }
  return started;
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
 * **What it does about an external conflict, and about a delivery held during
 * the save** — Phase 2d-6-5, `applySave`'s rule in `./matchEditor.ts`. A `saved`
 * or a `conflict` answer retires {@link RawEditorSession.externalConflict} (the
 * 2d-6 record's §3 entry 7: the save's own answer is the newer fact about the
 * file); a `refused` answer wrote nothing and leaves it standing. Neither is
 * reachable from {@link beginSave} while an external conflict stands, so this
 * keeps the invariant for a caller that drove the model directly. Then, whatever
 * the answer — a seal already opened included, because the save is over either
 * way — every delivery {@link applyObservation} held while the save was in flight
 * is replayed on top, in arrival order (entry 5), **and, with a reader supplied,
 * every delivery the receiver appended to the installed session during this
 * transition's own reads and replay** (2d-6-4's review, its second finding).
 * Without a reader the transition settles what it was handed and such a delivery
 * is lost when the caller installs the result; {@link ReadTheInstalledSession}
 * says who owes the reader.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param sealed - What `BrowserState.saveRawDocument` answered.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   replays only what the session handed in holds.
 * @returns The session showing what the save ended as.
 */
export function applySave(
  session: RawEditorSession,
  sealed: SealedWholeDocumentSave,
  current: ReadTheInstalledSession | null = null
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
    return consumingHeldDeliveries({ ...session, phase: 'editing' }, current);
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
  const refused = outcome.outcome === 'refused';
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      draft,
      // The conflict arm is given the draft as it was when the save was refused,
      // which is this one: nothing has changed it, because the box was read-only
      // for the whole of the save.
      outcome: describeWholeDocumentSave(outcome, session.draft, CONFLICT_CAPABILITIES),
      extraMessages: failed === null ? [] : [failed],
      reload: NOT_RELOADING,
      sendFailure: null,
      // The save ended on the file, so the disk side an earlier observation
      // showed is no longer the comparison to draw (entry 7); a refusal wrote
      // nothing and says nothing about the file.
      externalConflict: refused ? session.externalConflict : null,
      uncertaintyUnresolved: refused ? session.uncertaintyUnresolved : false
    },
    current
  );
} // End of function applySave()

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
 * Replays every delivery a session held during its save, in the order it
 * arrived, once the save's own answer is on it — the 2d-6 record's §3 entry 5 —
 * and then every delivery the receiver appended to the installed session while
 * that was happening (2d-6-4's review, its second finding).
 *
 * `consumingHeldDeliveries` in `./matchDeletion.ts`, for this session, rounds
 * included: the list is emptied before the first replay so a replay cannot see
 * itself in it, each envelope goes through {@link applyObservation} exactly as it
 * would have on arrival, and each is applied to the session the one before it
 * left. **Replaying an envelope reads its observation, and a read runs caller
 * code**: a getter there can tell the window of a reading, and the window
 * delivers it at once to the installed session — which is still `saving`, so
 * the receiver appends it there, to a list this transition was handed a copy of.
 * So after each round the installed session is read through `current`, once,
 * and the envelopes it holds beyond the ones replayed are replayed too, in the
 * order they arrived, until a read finds none. **What this forces** is that no
 * envelope delivered during the save, or during this settlement, is dropped when
 * a reader is supplied, and that first-to-last is the order; **what it cannot
 * force** is that the window delivered them in the order it decided them, that a
 * reader is supplied at all, or that the installed session is the one handed in
 * with more appended — a list that is not an extension of the one replayed is
 * left alone, since the transition cannot say what it is. Nor can it force the
 * rounds to end: a getter that tells the window of a fresh reading on every read
 * does not come to rest here, exactly as it does not at the window's own drain
 * (`registerObservationReceiver`'s doc), and one that re-tells a reading already
 * decided does, because the window hands each decision out once.
 *
 * @param settled - The session with its save's answer applied and its phase back
 *   to `editing`.
 * @param current - Reads the session the caller holds now, or `null`.
 * @returns The session with every held delivery applied, or the same session
 *   when none was held.
 */
function consumingHeldDeliveries(
  settled: RawEditorSession,
  current: ReadTheInstalledSession | null
): RawEditorSession {
  let queue = settled.heldDeliveries;
  let replayed: RawEditorSession = queue.length === 0 ? settled : { ...settled, heldDeliveries: [] };
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyObservation(replayed, queue[at]!);
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
 * The save is over, so a delivery held while it was out is applied now: the
 * settlement of an uncertain write arbitrates the held reading under that
 * uncertainty, and its `raisedWithoutReload` is what this applies (the 2d-6
 * record's §3 entry 5), and with a reader every delivery appended to the
 * installed session during the replay is applied too, for {@link applySave}'s
 * reason.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param mayHaveWritten - Whether the file may already hold the submitted text.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   replays only what the session handed in holds.
 * @returns The session, back to editing, with the right notice raised.
 */
export function saveCouldNotBeSent(
  session: RawEditorSession,
  mayHaveWritten: boolean,
  current: ReadTheInstalledSession | null = null
): RawEditorSession {
  return consumingHeldDeliveries(
    {
      ...session,
      phase: 'editing',
      sendFailure: sendFailureOf(mayHaveWritten, null)
    },
    current
  );
} // End of function saveCouldNotBeSent()

/**
 * Puts the outcome away and gives the box back.
 *
 * *Keep editing*, for all three arms. The draft is untouched — this is a panel
 * being dismissed, not a state being resolved — and the submission goes with it,
 * because there is nothing left on screen to acknowledge.
 *
 * **It gives the box back only when no conflict of either origin stands, and it
 * erases no external block** — Phase 2d-6-5, the 2d-6 record's §3 entry 9.
 * {@link RawEditorSession.externalConflict},
 * {@link RawEditorSession.uncertaintyUnresolved} and
 * {@link RawEditorSession.awaitingReconciliation} all survive this spread: what
 * this dismisses under an external conflict is the save outcome's panel and the
 * reload warning, and the conflict and both restrictions stand — the box stays
 * read-only through {@link isEditable} — until an explicit resolution, which is
 * the reload's confirmation or closing the editor. What the spread forces is
 * that the three fields are copied; what no type forces is that a later edit
 * keeps them out of the literal, and the suite's case is what would notice.
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
 * The conflict a reload may be asked about, or `null` when none may be — Phase
 * 2d-6-5, the reload gate of the 2d-6 record's §3 entry 11 as one rule for the
 * three reload steps below.
 *
 * Withheld under an unacknowledged write uncertainty, for the match editor's
 * reason: a confirmed reseed from bytes a write of this window may or may not
 * have produced would settle silently what only the person can. The view
 * withholds the control through the same fact, and the three transitions refuse
 * it, so a call made past the withheld control changes nothing (entry 8).
 *
 * @param session - The session to ask about.
 * @returns The conflict, or `null` when there is none or its reload is withheld.
 */
function reloadableConflictOf(session: RawEditorSession): ConflictModel<RoundTripText> | null {
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
export function askToReload(session: RawEditorSession): RawEditorSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
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
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
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
 * **Since Phase 2d-6-5 the conflict may be a watcher observation's** (the 2d-6
 * record's §3 entry 23): its `diskText` is the observation's own, the same
 * refusal is asked of it before anything is spent, and a reseed that goes
 * through resolves the external conflict and the uncertainty it carried — the
 * waits recorded for other observations stand, because an adoption decides
 * nothing about them. Under an unacknowledged write uncertainty the reload is
 * withheld through {@link reloadableConflictOf}, and this answers the same
 * session.
 *
 * **Nothing is reseeded for an adoption the window refused.** The draft is
 * computed first because it is pure, `adopt` is called only once every check here
 * has passed, and a `refused` from it leaves both the window and the draft exactly
 * as they were — a confirmation issued for another conflict, one already spent, a
 * conflict this window did not produce, an unprojected document, or a projection
 * replaced since the conflict arrived when the window does not already hold the
 * requested revision, which are `BrowserState.adoptDiskVersion`'s guards **in its
 * order** and not a set applied alike.
 * A carriage return in the disk text is refused one step earlier, here.
 * **`alreadyThere` reseeds**: a window already holding the requested revision is
 * answered so, and its confirmation spent, *before* the projection generation is
 * compared at all, so the request is satisfied and the draft follows it.
 *
 * **What no type here forces**: that `adopt`'s body does anything.
 * `() => 'installed'` type-checks, exactly as `openWholeDocumentSave`'s `forget`
 * does (`2c-1a-notes.md` section 4.3) — the type constrains the *answer* to a
 * {@link DiskAdoptionOutcome} and not the work behind it. What it forces is that
 * the caller cannot obtain the reseeded draft without this function having called
 * it and been told the window holds the disk version.
 *
 * **The installed session is read twice: once after the last read of this
 * function's own and immediately before the adoption, and once more after it**
 * (this phase's review, its third finding; 2d-6-4's pattern (c)). The adoption
 * is the window's, and `BrowserState.adoptDiskVersion` copies the observation's
 * projection before it decides — a read of caller data, and a getter there can
 * tell the window of a later reading, which the window decides and hands to the
 * registered receiver while this function is still inside `adopt`. So: a session
 * displaced before the adoption is not reloaded and the installed session is
 * answered, the window never asked — a caller that installs the answer keeps
 * what its receiver installed. After the adoption the installed session is read
 * again; when it now shows **another conflict** (by source identity) the person
 * must decide about that one, whether the window installed this snapshot or
 * refused it as outlived, so the installed session is answered untouched and
 * nothing is reseeded over it; when it shows the same conflict with more
 * recorded — a wait, most of all — the reseed and the refused step are built
 * over **it**, so what the receiver recorded during the adoption survives. What
 * that cannot force is that a caller passes a reader ({@link ReadTheInstalledSession}
 * says what a missing one costs): without one the transition reseeds what it was
 * handed, and a delivery the receiver made during the adoption is lost when the
 * caller installs the answer.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and only
 *   when this reload really happens.
 * @param current - Reads the session the caller holds now. `null`, the default,
 *   builds over the session handed in.
 * @returns A clean session over the disk version, the session at the refused
 *   step, the same session, or the installed session when the one handed in is
 *   no longer it.
 */
export function loadDiskVersion(
  session: RawEditorSession,
  adopt: AdoptTheDiskVersion<RoundTripText>,
  current: ReadTheInstalledSession | null = null
): RawEditorSession {
  // **Every read of this function's own, taken first.** The step, the
  // conflict, its disk text, its draft and its revision are all read here.
  const step = session.reload;
  const conflict = reloadableConflictOf(session);
  const held = conflict === null ? null : roundTripText(conflict.diskText);
  const reloaded =
    conflict === null || held === null || step.kind !== 'confirmed'
      ? null
      : reloadDiskVersion(conflict, step.confirmation, conflict.diskRevision, held);
  // **The installed session, read once, after those reads and immediately
  // before the adoption.** A session no longer installed is not reloaded, and
  // what is installed is answered so the caller keeps it.
  const installed = current === null ? session : current();
  if (installed !== session) {
    return installed;
  }
  if (conflict === null || reloaded === null) {
    return session;
  }
  const spend = spendTheConfirmedReload(conflict, step, adopt);
  if (spend === 'notAttempted') {
    return session;
  }
  // **Read once more, after the adoption**, which ran the window's own reads.
  const settled = current === null ? session : current();
  if (settled !== session && conflictOf(settled)?.source !== conflict.source) {
    // A replacing verdict landed during the adoption: the conflict the receiver
    // installed is the one to decide about now, and nothing is reseeded over it.
    return settled;
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the 2c-4a-3a
    // review's finding 3: the window said no without a word about which of
    // `adoptDiskVersion`'s ordered guards produced it, so the control stops being
    // offered and the panel says so. That is a decision about what to draw and
    // **not** a claim that a later ask would be refused too — a refusal spends
    // nothing. Nothing is reseeded, and *Keep editing* writes `NOT_RELOADING`
    // back for a fresh attempt.
    return { ...settled, reload: RELOAD_REFUSED };
  }
  return {
    ...settled,
    draft: reloaded,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null,
    // The conflict of either origin is resolved by the reseed, and with it the
    // uncertainty it was raised under; the waits are about other observations,
    // and those the receiver recorded during the adoption are carried too.
    externalConflict: null,
    uncertaintyUnresolved: false
  };
} // End of function loadDiskVersion()

/**
 * Takes the window's decision about one watcher observation — Phase 2d-6-5, the
 * 2d-6 record's §3 entries 6, 7, 11 and 12.
 *
 * **The session's receiver, as a value**, in the shape `applyObservation` in
 * `./matchEditor.ts` established: a component registers a function through
 * `BrowserState.registerObservationReceiver` that calls this with the envelope and
 * installs what comes back (the wiring is 2d-6-8's), and the decision is here so a
 * suite can drive every arm without a window. It never re-arbitrates and reads
 * none of the window's tables.
 *
 * **Every verdict has a named action, switched with a `never` terminus** (entry
 * 11, plus the seventh arm Phase 2d-6-1b added):
 *
 * | Verdict | What this does, for a delivery about this editor's file |
 * |---|---|
 * | `raised` | builds the external model from the observation and the draft as it stands, and freezes the box |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its draft kept, its disk side replaced |
 * | `coalesced` | keeps the model, its source identity and the reload step |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on saving; no disk comparison, no origin, the box still editable |
 * | `writtenHere` | lifts the restriction recorded for that observation, and changes nothing else |
 *
 * **Which deliveries are about this editor is decided by the observation's
 * file**, read once, for the three operation sessions' reason turned sharper: an
 * editor over one file told of another file's change must not raise a conflict
 * whose reload would *reseed its box with that other file's text*. A delivery
 * about another file can only end a wait recorded for that very observation, by
 * identity, under that file's key; a `retained` about another file records
 * nothing. The envelope's two fields and the verdict's `kind` are read once
 * each, before anything is decided.
 *
 * **Every replacing verdict resets the reload step and retires a save conflict**
 * (entries 7 and 12): the confirmation collected for the conflict that was on
 * screen must not be spendable against the one that replaced it, and a save
 * conflict's outcome is retired so that only one conflict is active — a
 * committed success or a refusal in `outcome` stays as history, with the
 * submission a refusal's consent needs. That consent is not spendable past
 * this: the box is frozen under the conflict and the reload reseeds a clean
 * draft with none. `supersedes` builds through `supersedeConflict` when a
 * conflict is shown and through `describeExternalConflict` over the session's
 * draft when none is; the `superseded` origin the verdict names is not compared
 * with the shown conflict's — the envelope is the window's decision about the
 * file, and a session that re-checked it would be arbitrating.
 *
 * **During this editor's own save the envelope is appended to the held list,
 * not applied** (entry 5): see {@link RawEditorSession.heldDeliveries}.
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
export function applyObservation(
  session: RawEditorSession,
  delivery: ObservationDelivery
): RawEditorSession {
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
} // End of function applyObservation()

/**
 * The session after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of {@link applyObservation}, which
 * documents what happens here; this is the one place the external model is built
 * for this surface from a delivery. The draft it retains is the session's own as
 * it stands — the box is about to be frozen under the conflict, so that is
 * exactly the text *Copy draft* will put on the clipboard.
 *
 * @param session - The session, not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The session showing the new conflict.
 */
function replacedBy(
  session: RawEditorSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): RawEditorSession {
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
    // Entry 12: the confirmation collected for the conflict that was on screen
    // is not spendable against this one, nor may its warning stay on screen
    // saying the wrong thing (the record's §5.7).
    reload: NOT_RELOADING
  };
} // End of function replacedBy()

/**
 * Records that the person has reviewed the disk snapshot and the window has ended
 * the uncertainty hold — Phase 2d-6-5, the 2d-6 record's §3 entries 14 and 15.
 *
 * `acknowledgeSnapshot` in `./matchEditor.ts`, for this session, taking the same
 * two-valued callback: it rebuilds the conflict's availability and nothing else —
 * the reload is offered again from its idle step — installing nothing, minting no
 * consent and re-observing nothing. Asked at most once per call and only when
 * there is something to end; a `refused` leaves the session unchanged. What it
 * cannot see is a hold the window ended without a delivery, stated on
 * {@link RawEditorSession.uncertaintyUnresolved}.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload available again, or the same session.
 */
export function acknowledgeSnapshot(
  session: RawEditorSession,
  acknowledge: AcknowledgeTheUncertainty
): RawEditorSession {
  const conflict = session.externalConflict;
  if (conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return { ...session, uncertaintyUnresolved: false, reload: NOT_RELOADING };
} // End of function acknowledgeSnapshot()

/**
 * Why a reapply of this editor's draft could not be carried out.
 *
 * **The shared obstacles and nothing else**, and neither of them is reachable from
 * this surface: {@link reapplyToDiskVersion} answers `unavailable` before it has
 * looked at any evidence. The alias exists so that
 * {@link RawEditorReapply}'s shape is the same one the five match surfaces answer
 * with, rather than a special case a caller has to know about.
 */
export type RawEditorReapplyObstacle = SharedReapplyObstacle;

/** What a reapply of this editor's draft became. Always `unavailable`. */
export type RawEditorReapply = ReapplyOutcome<RawEditorSession, RawEditorReapplyObstacle>;

/**
 * The guard {@link reapplyToDiskVersion} hands `enterReapply`, which never asks
 * it: the entry reads this surface's permanent `reapplySupport` before it looks
 * at the conflict, and `unavailable` returns before the guard could be reached.
 * Were it ever asked it would answer `null` — the conservative *superseded* —
 * rather than vouch for an origin it cannot see; that is a statement about this
 * closure and not a path any call takes.
 */
const NEVER_ASKED: StandingOriginGuard = (): ConflictSource | null => null;

/**
 * Refuses to reapply this editor's draft, permanently and by construction.
 *
 * **The consult's Q4 as a value.** A whole-document candidate has no target, no
 * field intent and no operation to re-resolve, so *reapply* could only mean
 * overwriting the newly read disk text with a stale string — which plan section 6.5
 * forbids — or inventing a text merge, which the plan forbids for v1 outright. This
 * editor's honest options stay 2c-4a's: keep editing, take an exact reference copy,
 * compare, or confirm a reload. The recovery fallback is 2c-4c's.
 *
 * **It takes no adoption function and cannot spend one.** Since Phase 2d-6-5 it
 * enters through `enterReapply` in `./reapply.ts` — the entry over **both**
 * origins (the 2d-6 record's §3 entry 22) — which answers `unavailable` from
 * this surface's own permanent `ConflictCapabilities.reapplySupport` **before**
 * it looks at the conflict, so a save conflict whose payload happened to carry
 * an identified subject and an external conflict whose observation carries a
 * correspondence table change nothing here — which is what makes this the
 * declared unsupported reapply rather than a supported one that always falls
 * back, and never an accident of which arms the wire produces.
 *
 * **What no type forces**: that a caller does not simply build a `reapplied` outcome
 * of its own. What is closed is that nothing in this module produces one, and that
 * no adoption of a disk snapshot can be reached from this surface's reapply path at
 * all.
 *
 * @param session - The session, showing a conflict of either origin or not. Read
 *   only to ask which conflict it holds, which does not change the answer.
 * @returns The `unavailable` arm, always.
 */
export function reapplyToDiskVersion(session: RawEditorSession): RawEditorReapply {
  const start = enterReapply(CONFLICT_CAPABILITIES, conflictOf(session), NEVER_ASKED);
  // **`start` is `unavailable` here, every time**: `enterReapply` reads this
  // surface's permanent `reapplySupport` before it looks at the conflict, so
  // neither `ready` nor `notAttempted` can come back. The narrowing exists because
  // `ReapplyEntry` has three arms whatever this surface declares, and answering
  // `unavailable` for a `ready` that cannot occur is the conservative direction.
  return start.kind === 'ready' ? { kind: 'unavailable' } : start;
} // End of function reapplyToDiskVersion()

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
  /**
   * The external conflict's own lines, or none — Phase 2d-6-5.
   *
   * Beside {@link RawEditorView.messages} and never merged into it, for
   * `MatchEditorView.externalMessages`'s reason: a panel drawing `view.conflict`
   * outside the save-outcome branch (the 2d-6 record's §3 entry 10) draws nothing
   * twice. Rendered through `tConflictMessage`. No component reads it yet;
   * 2d-6-8 does.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * The lines owed while an observation cannot be acted on — Phase 2d-6-5.
   *
   * `writeOutcomeUnknown` first, `observationRetained` second, from the session's
   * own fields. No component reads it yet; 2d-6-8 and 2d-6-9 do.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
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
   * is not offered again once a spend has been refused — the refusal came back with
   * no word about its cause, so this panel withholds the control rather than
   * claiming a later ask could only be refused too — and a control that vanishes
   * with nothing said in its place reads as a bug (2c-4a-3a review, finding 3). Nothing was written, nothing was
   * discarded and nothing was reseeded; *Keep editing* resets the step.
   */
  readonly reloadUnavailable: boolean;
  /**
   * Whether confirming the reload would do anything.
   *
   * `false` for a disk version carrying a carriage return, which is the one thing
   * {@link loadDiskVersion} refuses on its own — and, since Phase 2d-6-5, under
   * an unacknowledged write uncertainty, which withholds the reload through
   * {@link reloadableConflictOf}. The decision is here rather than in markup for
   * this directory's standing reason: a rule written into one renderer is
   * carried by that renderer's mounted suite alone.
   */
  readonly canReload: boolean;
}

/**
 * What this surface offers about the conflict it is showing **now**, derived from
 * the declaration and one fact about the session — Phase 2d-6-5, the 2d-6
 * record's §3 entry 11.
 *
 * The declaration {@link CONFLICT_CAPABILITIES} is permanent; this is the
 * "effective capabilities" the consult's Q3 names. The reload is withheld under
 * an unacknowledged write uncertainty, for the match editor's reason; the reapply
 * is never offered here, so a held reading withholds nothing this surface
 * declares. It feeds `conflictChoicesFor`, which stays the only producer of a
 * choice list; what this cannot force is that the transitions honour the same
 * fact, which is why each reload step asks {@link reloadableConflictOf}.
 *
 * @param session - The session to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: RawEditorSession): ConflictCapabilities {
  return session.uncertaintyUnresolved
    ? { ...CONFLICT_CAPABILITIES, offersReload: false }
    : CONFLICT_CAPABILITIES;
} // End of function effectiveCapabilitiesOf()

/**
 * The notices one session owes, in the order the stronger claim comes first.
 *
 * The uncertainty first, because it is the one state under which the conflict on
 * screen offers no way to the disk version, and the held observation second.
 * Each is answered from one session field and nothing is read twice.
 *
 * @param session - The session to describe.
 * @returns The codes, possibly none.
 */
function externalNoticesOf(session: RawEditorSession): readonly ExternalConflictNotice[] {
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
  const externallyBlocked = session.externalConflict !== null || awaitedFor(session) !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
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
    externalMessages: session.externalConflict === null ? [] : session.externalConflict.messages,
    externalNotices: externalNoticesOf(session),
    notes: outcome !== null && outcome.kind === 'saved' ? outcome.notes : [],
    // The one offer a refusal panel may keep under an external block is the
    // dismissal: *Save anyway* would reach `beginSave`, which answers `null` to
    // it, and a control that does nothing when pressed is the defect
    // `conflictChoicesFor` exists to stop (Phase 2d-6-5).
    refusalChoices: externallyBlocked
      ? refusalChoices.filter((choice) => choice === 'keepEditing')
      : refusalChoices,
    findingsAreStale: refused !== null && stale,
    conflict,
    diskText: conflictDiskText(conflict),
    diskRefusal,
    conflictChoices:
      conflict === null
        ? []
        : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload)),
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    canReload: conflict !== null && diskRefusal === null && !session.uncertaintyUnresolved
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
