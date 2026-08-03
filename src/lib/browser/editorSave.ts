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

import type { Draft, DraftSubmission } from './draft';
import { acknowledgeRefusal } from './draft';
import type { RawSaveChoice } from './rawSave';
import type { ConflictModel, RefusedModel, SaveOutcomeModel } from './saveOutcome';

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
    }
  | {
      /** The write may have completed. This application cannot tell. */
      readonly kind: 'mayHaveWritten';
    };

/**
 * The send failure one `mayHaveWritten` answer stands for.
 *
 * A named function rather than a ternary at each editor, so the mapping from the
 * boundary's question to the screen's two arms is written once.
 *
 * @param mayHaveWritten - What `mayHaveWritten` in `../ipc/errors` answered about
 *   the failure.
 * @returns The arm to raise.
 */
export function sendFailureOf(mayHaveWritten: boolean): SendFailure {
  return { kind: mayHaveWritten ? 'mayHaveWritten' : 'notSent' };
} // End of function sendFailureOf()

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
