/**
 * When a run of keystrokes in one field is **one** undo step.
 *
 * **Extracted at 2c-3a rather than copied into a second editor**, exactly as
 * `./editorSave.ts` was extracted at 2c-2-1 and for the same reason: this is a
 * policy, and a second copy of a policy is a second place for it to drift. The
 * small editor of 2c-2 wrote it for six fields; the creation form of 2c-3a needs
 * the identical rule over two, and the rule is not about which fields they are.
 *
 * ## What belongs here and what deliberately does not
 *
 * Here: the boundary itself — *the same field, within {@link TYPING_GROUP_IDLE_MS}
 * of the last keystroke recorded in the run* — and the choice between
 * `amendDraft` (replace the current step) and `editDraft` (push a new one) that
 * follows from it.
 *
 * Not here: **which** actions close a run. A blur, a change of focused field, a
 * removal, a save, an undo and a dismissal all end a run, and every one of them
 * is a transition of the editor rather than of a draft — an editor simply passes
 * `null` as the open run on the next change, or clears the run in its own
 * transition. `./draft.ts` still refuses to decide any of this, for the reason
 * `HISTORY_LIMIT` gives; what this module adds is that the two editors agree
 * about the one boundary they share.
 *
 * ## The clock is a parameter, everywhere, and always has been
 *
 * Never `Date.now` named inside a model and never a `setTimeout`: a boundary
 * decided by real time is a boundary a test would have to sleep through. The
 * reading is passed in, so the running application is the only thing that reads a
 * real clock.
 */

import { amendDraft, editDraft, type Draft } from './draft';

/**
 * A source of milliseconds, injected so a boundary is testable.
 *
 * The running application passes `() => Date.now()`; a test passes a counter it
 * advances by hand.
 *
 * @returns A reading in milliseconds, which must not go backwards within a
 *   session.
 */
export type Clock = () => number;

/**
 * How long a pause ends a run of typing in one field, in milliseconds.
 *
 * **A judgement, not a measurement.** Nothing has been profiled and no session
 * has been timed; seven hundred milliseconds is long enough that ordinary typing
 * in one field stays one undo step and short enough that stopping to think starts
 * a new one. The cost of it being wrong is undo granularity, which is recoverable
 * by pressing undo again — unlike the cost of not coalescing at all, which is
 * history entries the person cannot get back.
 */
export const TYPING_GROUP_IDLE_MS = 700;

/**
 * A run of typing in one field that later keystrokes may still join.
 *
 * @typeParam F - How an editor names its fields. Compared with `===`, so it must
 *   be a primitive: both editors use a union of string literals.
 */
export interface TypingRun<F> {
  /** The field being typed into. A different field is a different run. */
  readonly field: F;
  /** The clock reading of the last keystroke recorded in it. */
  readonly at: number;
}

/**
 * What one recorded keystroke leaves behind.
 *
 * @typeParam T - The drafted value.
 * @typeParam F - How an editor names its fields.
 */
export interface RecordedTyping<T, F> {
  /** The draft after the change. */
  readonly draft: Draft<T>;
  /** The run later keystrokes may join, or `null` when there is none open. */
  readonly group: TypingRun<F> | null;
}

/**
 * Records a change, joining the open run or starting a new one.
 *
 * **The whole of the coalescing policy, in one place.** A change joins the run
 * when it is in the same field and within {@link TYPING_GROUP_IDLE_MS} of the
 * last one recorded in it; otherwise it opens a step of its own. Joining uses
 * `amendDraft`, which replaces the current value without pushing history;
 * starting uses `editDraft`, which pushes.
 *
 * The live value moves either way, on every keystroke. What is coalesced is the
 * *snapshot*, and nothing else — so nothing about what is on screen, or about
 * what a save would send, depends on the grouping.
 *
 * **A burst that ends where it began leaves no step**, which was the 2c-2
 * review's fifth finding: type three characters and erase them again inside the
 * window, and the amendment restores the value the run started from while its
 * history entry stays — an undo the person could press that changes nothing on
 * screen and only spends a step. `amendDraft` drops the entry in that case, and
 * the run is closed here rather than left open, because a run whose step no
 * longer exists has nothing left to amend and the next keystroke must push one.
 *
 * @typeParam T - The drafted value.
 * @typeParam F - How the calling editor names its fields.
 * @param draft - The draft being edited.
 * @param group - The run later keystrokes may join, or `null`.
 * @param field - The field the change is in.
 * @param next - What the controls now hold.
 * @param now - The clock reading of this change.
 * @returns The draft and the run after the change, or `null` when nothing
 *   changed — in which case the run is **not** extended either, or a no-op
 *   keystroke would keep one alive across an arbitrary pause.
 */
export function recordTyping<T, F>(
  draft: Draft<T>,
  group: TypingRun<F> | null,
  field: F,
  next: T,
  now: number
): RecordedTyping<T, F> | null {
  const joins = group !== null && group.field === field && now - group.at <= TYPING_GROUP_IDLE_MS;
  const moved = joins ? amendDraft(draft, next) : editDraft(draft, next);
  if (moved === draft) {
    return null;
  }
  // The amendment collapsed its own step: the burst is back where it started, the
  // history entry is gone, and there is nothing for a later keystroke to amend.
  const collapsed = joins && moved.past.length < draft.past.length;
  return { draft: moved, group: collapsed ? null : { field, at: now } };
} // End of function recordTyping()
