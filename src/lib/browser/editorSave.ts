/**
 * What every editor in Phase 2c does about **one save**, in one place.
 *
 * **Extracted at 2c-2-1 rather than copied into a second editor.** 2c-1b built
 * the raw editor's session and, with it, five decisions that are not specific to
 * a text area at all: what "the findings on screen are stale" means, how consent
 * is recorded from a refusal, which choices a refusal may offer once its findings
 * describe a value nobody is looking at any more, which arm of an outcome is the
 * conflict, and the fact that a send which never left is **not** an outcome. The
 * small editor of 2c-2 needs every one of them over a different drafted value.
 *
 * The 2c-2 checkpoint names copying as the mistake to avoid, and it is right for
 * a reason more specific than tidiness: each of these five is a *rule about
 * consent or about honesty*, and a second copy of a rule is a second place for it
 * to be relaxed by somebody who only reads one of them.
 *
 * ## What is here and what is deliberately not
 *
 * Here: everything that is a function of a {@link Draft}, a
 * {@link DraftSubmission} and a {@link SaveOutcomeModel}, and of nothing else.
 *
 * Not here: **when** a save may start, **what** is sent, and what a committed
 * save does to the value afterwards. Those differ per editor — the raw editor
 * sends a whole document and rebases on the text it sent; the small editor sends
 * a twenty-two-field draft and rebases its baselines on what was written — and a
 * generic function that took them as parameters would only be a longer way of
 * writing them out twice.
 *
 * Nothing below mutates its arguments and nothing below is a store: the same
 * arrangement as `./draft.ts`, one layer up.
 */

import type { IpcFailure } from '../ipc/errors';
import type { DraftError, EditError, SaveError } from '../ipc/types';
import type { Draft, DraftSubmission } from './draft';
import { acknowledgeRefusal } from './draft';
import type { RawSaveChoice } from './rawSave';
import { confirmReloadDiskVersion } from './saveOutcome';
import type {
  ConflictModel,
  ConflictReloadStep,
  DiskAdoptionOutcome,
  RefusedModel,
  ReloadConfirmation,
  SaveOutcomeModel
} from './saveOutcome';

/**
 * What an editor is doing.
 *
 * Two states rather than three: an outcome being on screen is not a phase, it is
 * a value, and treating it as a phase is how a screen ends up with a saved panel
 * it cannot dismiss. 2c-1b's `RawEditorPhase` was this type under another name.
 */
export type EditorPhase = 'editing' | 'saving';

/**
 * A save that produced no outcome, and what is known about the file afterwards.
 *
 * **Two arms, because "nothing was written" is a claim this application is often
 * not entitled to make.** A save that fails before its rename really did write
 * nothing. A save that fails *after* it — a directory sync, a read-back — may have
 * left the candidate on disk, and `may_have_written` is the wire saying so. The
 * 2c-1b review found both collapsed into one screen that said nothing was
 * written, which for the second is the opposite of what the disk may hold and is
 * `PROGRESS.md` D2 broken from the other side.
 */
export type SendFailure =
  | {
      /** The command failed before anything could have been written. */
      readonly kind: 'notSent';
      /** Why, when the boundary handed a reason back. */
      readonly reason: IpcFailure | null;
    }
  | {
      /** The write may have completed. This application cannot tell. */
      readonly kind: 'mayHaveWritten';
      /** Why, when the boundary handed a reason back. */
      readonly reason: IpcFailure | null;
    };

/**
 * The send failure one `mayHaveWritten` answer stands for.
 *
 * A named function rather than a ternary at each editor, so the mapping from the
 * boundary's question to the screen's two arms is written once.
 *
 * **The reason is a second, independent question and is required rather than
 * defaulted.** Whether the file may hold the candidate is what the person has to
 * act on; *why the command refused* is what tells them what to change, and until
 * 2c-2-2 it reached the developer console and no screen at all. A default of
 * `null` here would be this function inventing "nothing is known" for a caller
 * that simply did not look, which is the argument `applySave`'s required
 * `adoption` argument already makes one layer up.
 *
 * @param mayHaveWritten - What `mayHaveWritten` in `../ipc/errors` answered about
 *   the failure.
 * @param reason - The classified failure, or `null` when the caller's boundary
 *   does not carry one to hand on.
 * @returns The arm to raise.
 */
export function sendFailureOf(mayHaveWritten: boolean, reason: IpcFailure | null): SendFailure {
  return mayHaveWritten
    ? { kind: 'mayHaveWritten', reason }
    : { kind: 'notSent', reason };
} // End of function sendFailureOf()

/**
 * One line of the *why* beside a save that produced no outcome.
 *
 * **A code, never a sentence**, and four arms rather than one because the four
 * are four different enums with four accessors: `tIpcFailure`, `tDraftError`,
 * `tSaveError` and `tEditError`. A component walks this list and calls the
 * accessor its arm names, which is the rule that keeps a key from being built in
 * markup (CLAUDE.md section 2).
 */
export type SendFailureLine =
  | {
      /** The rejection itself, as the boundary classified it. */
      readonly kind: 'failure';
      /** What to hand `tIpcFailure`. */
      readonly failure: IpcFailure;
    }
  | {
      /** Why a draft could not be turned into an edit batch. */
      readonly kind: 'draft';
      /** What to hand `tDraftError`. */
      readonly error: DraftError;
    }
  | {
      /** Why a save that was attempted did not commit. */
      readonly kind: 'save';
      /** What to hand `tSaveError`. */
      readonly error: SaveError;
    }
  | {
      /** Why the patch the save was carrying could not be applied. */
      readonly kind: 'edit';
      /** What to hand `tEditError`. */
      readonly error: EditError;
    };

/**
 * The reasons to show beside a save that produced no outcome, outermost first.
 *
 * **The chain is walked here rather than in markup**, which is what makes it
 * checkable: `tSaveError`'s own note says how much of the chain a screen shows is
 * that screen's decision, and a decision written in a `.svelte` file is a decision
 * nothing in this repository can test.
 *
 * Two rejections carry a reason worth a second line, and both are `save_match`'s:
 * `draftRefused` carries the core's `DraftError` whole — thirty-two sentences that
 * had never reached a screen before 2c-2-2 — and `saveFailed` carries a
 * `SaveError` whose `Patch` arm carries an `EditError`, which is another
 * thirty-six. Every other code says all it has to say in one sentence, so it
 * produces one line.
 *
 * @param reason - The classified failure, or `null` when there is none to show.
 * @returns The lines, outermost first, or an empty list.
 */
export function sendFailureLines(reason: IpcFailure | null): readonly SendFailureLine[] {
  if (reason === null) {
    return [];
  }
  const lines: SendFailureLine[] = [{ kind: 'failure', failure: reason }];
  if (reason.kind !== 'command') {
    return lines;
  }
  if (reason.error.code === 'draftRefused') {
    lines.push({ kind: 'draft', error: reason.error.error });
    return lines;
  }
  if (reason.error.code === 'saveFailed') {
    const error = reason.error.error;
    lines.push({ kind: 'save', error });
    if ('Patch' in error) {
      lines.push({ kind: 'edit', error: error.Patch });
    }
  }
  return lines;
} // End of function sendFailureLines()

/**
 * Whether the findings on screen are about the value the draft still holds.
 *
 * The question the *Save anyway* offer hangs on. A refusal is about **one exact
 * candidate**: the gate matched that value's suspicions, and
 * `FindingCode::DocumentDoesNotParse` carries that text's own revision. Once the
 * person edits, the findings describe something that is no longer on screen, and
 * offering to "save anyway" would be offering to save past findings nobody has
 * seen for the value that would actually be written.
 *
 * The comparison is the **draft's own** (`draft.rules.same`), never a second one
 * chosen here: 2c-1a's rule 2 is that a caller cannot ask "is this dirty?" with
 * one rule and "did this change?" with another.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft as it stands.
 * @param submitted - What the last save sent, or `null` when none has been sent.
 * @returns `true` when a save has been answered and the draft has moved on since.
 */
export function submissionIsStale<T>(
  draft: Draft<T>,
  submitted: DraftSubmission<T> | null
): boolean {
  return submitted === null ? false : !draft.rules.same(submitted.candidate, draft.value);
} // End of function submissionIsStale()

/**
 * The refused arm of an outcome, or `null`.
 *
 * @typeParam T - The drafted value.
 * @param outcome - How the last save ended, or `null`.
 * @returns The refusal model, or `null` when the outcome is another arm.
 */
export function refusedArm<T>(outcome: SaveOutcomeModel<T> | null): RefusedModel | null {
  return outcome !== null && outcome.kind === 'refused' ? outcome : null;
} // End of function refusedArm()

/**
 * The conflict arm of an outcome, or `null`.
 *
 * @typeParam T - The drafted value.
 * @param outcome - How the last save ended, or `null`.
 * @returns The conflict model, which carries the retained draft, or `null`.
 */
export function conflictArm<T>(outcome: SaveOutcomeModel<T> | null): ConflictModel<T> | null {
  return outcome !== null && outcome.kind === 'conflict' ? outcome : null;
} // End of function conflictArm()

/**
 * How far one surface's confirmed reload has got.
 *
 * Three steps, because the middle one is the warning and — where the surface has
 * one — *Copy draft*: the destructive act is never one click away from the panel
 * that announces the conflict (`docs/decisions/2c-split-notes.md` section 6).
 *
 * **Shared at 2c-4a-2 rather than copied six times.** It was `rawEditor.ts`'s own
 * type until the five match surfaces needed the identical machine, and a second
 * copy of a rule about a destructive confirmation is a second place for it to be
 * relaxed — this module's founding argument.
 */
export type ReloadStep =
  | {
      /** Nothing has been asked for. */
      readonly kind: 'idle';
    }
  | {
      /** The person asked to load the disk version and has not confirmed yet. */
      readonly kind: 'confirming';
    }
  | {
      /** The person confirmed, and this is the proof, issued for that conflict. */
      readonly kind: 'confirmed';
      /** What `confirmReloadDiskVersion` issued. */
      readonly confirmation: ReloadConfirmation;
    };

/**
 * The step every session starts at, and returns to.
 *
 * A shared frozen value rather than a literal per call site, so "a new outcome
 * resets the reload" is one object in one place.
 */
export const NOT_RELOADING: ReloadStep = Object.freeze({ kind: 'idle' as const });

/**
 * What installs the disk observation a conflict carried, as a surface sees it.
 *
 * **The conflict and its confirmation travel together, and no value in between
 * does.** `BrowserState.adoptDiskVersion` authorizes and spends in one call, so
 * there is no adoption object for a surface to retain, replay or hand to another
 * window — which is what the 2c-4a-2 review's second finding was about.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict being resolved.
 * @param confirmation - What was issued for **that** conflict.
 * @returns What became of it. `refused` is a refusal, and a surface that gets one
 *   must not act as though the reload happened; `alreadyThere` is a **success**
 *   with nothing to install.
 */
export type AdoptTheDiskVersion<T> = (
  conflict: ConflictModel<T>,
  confirmation: ReloadConfirmation
) => DiskAdoptionOutcome;

/**
 * The step after *Reload disk version*, or `null` when there is no transition.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict the session is showing, or `null`.
 * @param step - Where the reload has got to.
 * @returns The next step, or `null` when the session must be returned unchanged.
 */
export function reloadAsked<T>(
  conflict: ConflictModel<T> | null,
  step: ReloadStep
): ReloadStep | null {
  return conflict === null || step.kind !== 'idle' ? null : { kind: 'confirming' };
} // End of function reloadAsked()

/**
 * The step after the warning is read, or `null` when there is no transition.
 *
 * **Reachable only from the warning step**, so a confirmation cannot be produced
 * by a screen that never showed it.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict the session is showing, or `null`.
 * @param step - Where the reload has got to.
 * @returns The next step, or `null` when the session must be returned unchanged.
 */
export function reloadConfirmed<T>(
  conflict: ConflictModel<T> | null,
  step: ReloadStep
): ReloadStep | null {
  return conflict === null || step.kind !== 'confirming'
    ? null
    : { kind: 'confirmed', confirmation: confirmReloadDiskVersion(conflict) };
} // End of function reloadConfirmed()

/**
 * Spends a confirmed reload against the window, and says whether it happened.
 *
 * **The one place a surface asks the window to cross to the disk side.** It
 * refuses without a conflict and without a confirmation, and otherwise hands the
 * decision to the window, which refuses a spent confirmation, a conflict it never
 * produced, and a projection replaced since that conflict arrived.
 *
 * **`alreadyThere` counts as done**, and the confirmation pass is why: a window
 * that has already reached the requested disk projection has satisfied the
 * request, and reporting that as a failure left a surface stuck on a confirm
 * control that could never succeed. What a surface must not do is act on
 * `refused`, which is the only value that means the window did not move.
 *
 * @typeParam T - The drafted value.
 * @param conflict - The conflict the session is showing, or `null`.
 * @param step - Where the reload has got to.
 * @param adopt - `BrowserState.adoptDiskVersion`.
 * @returns Whether the window now holds the disk observation, by either route.
 */
export function spendTheConfirmedReload<T>(
  conflict: ConflictModel<T> | null,
  step: ReloadStep,
  adopt: AdoptTheDiskVersion<T>
): boolean {
  if (conflict === null || step.kind !== 'confirmed') {
    return false;
  }
  return adopt(conflict, step.confirmation) !== 'refused';
} // End of function spendTheConfirmedReload()

/**
 * Which choices the conflict panel is at, for {@link conflictChoicesFor}.
 *
 * `confirmed` is spent in the same handler that reaches it, so it never draws a
 * list of its own; it collapses to `confirming`, which is what the panel showed
 * when the click happened.
 *
 * @param step - Where the reload has got to.
 * @returns The step the choices are chosen for.
 */
export function offeredReloadStep(step: ReloadStep): ConflictReloadStep {
  return step.kind === 'idle' ? 'idle' : 'confirming';
} // End of function offeredReloadStep()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * **The round trip goes through `acknowledgeRefusal` and through nothing else.**
 * It is the only producer of consent in this application, it derives the
 * acknowledgement from the refusal itself rather than from anything a caller
 * chose, and it checks the base revision and the candidate identity before
 * recording anything. Every one of those checks answers with the draft unchanged
 * rather than throwing, so a session that could not consent goes on as an
 * ordinary first attempt rather than a forced one.
 *
 * The three arguments are taken separately rather than as a session, because the
 * two editors' sessions are different shapes and this rule is about neither.
 *
 * @typeParam T - The drafted value.
 * @param draft - The draft the person is looking at.
 * @param submitted - What the save that was refused actually sent.
 * @param outcome - What came back.
 * @returns The draft carrying consent, or the same draft when there is no refusal
 *   on screen, nothing was submitted, or a check failed.
 */
export function consentForRefusal<T>(
  draft: Draft<T>,
  submitted: DraftSubmission<T> | null,
  outcome: SaveOutcomeModel<T> | null
): Draft<T> {
  const refused = refusedArm(outcome);
  if (refused === null || submitted === null) {
    return draft;
  }
  return acknowledgeRefusal(draft, submitted, refused.refusal);
} // End of function consentForRefusal()

/**
 * What to offer about a refusal, given whether its findings still describe the
 * value on screen.
 *
 * The refused arm's own choices while they do, and *Keep editing* alone once they
 * do not: an offer to save past findings that describe a different value is an
 * offer this application would not keep, because the gate matches the multiset of
 * **the candidate's own** suspicions.
 *
 * @param refused - The refusal model, or `null` when no refusal is showing.
 * @param stale - What {@link submissionIsStale} answered.
 * @returns The choices, in the order to offer them.
 */
export function offeredRefusalChoices(
  refused: RefusedModel | null,
  stale: boolean
): readonly RawSaveChoice[] {
  if (refused === null) {
    return [];
  }
  return stale ? ['keepEditing'] : refused.choices;
} // End of function offeredRefusalChoices()
