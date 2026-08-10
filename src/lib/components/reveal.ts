/**
 * Asking for a save's outcome panel to be brought into view when it appears.
 *
 * **A visual failure, fixed visually, and 2c-4a-3c's findings 10.3 and 10.4 are
 * why the file exists.** The window reading measured all six write surfaces at
 * 1180 × 728: every one of them drew the conflict panel's controls below the fold
 * before any scroll, and on the match editor the *whole* panel was below it — top
 * at y = 720 in English and y = 771 in Spanish, 1 044 px tall, with
 * `section.detail`'s `scrollTop` at `0` and nothing moving it. So a person who
 * pressed *Save this snippet* and hit a conflict saw eight pixels of it in English
 * and none of it in Spanish; what was invisible was **the statement that nothing
 * was written**.
 *
 * The panel is `role="status"`, so a screen reader is told either way. **This was
 * never an accessibility failure and the fix is not an accessibility fix** — the
 * reading says so in the same words, and the two should not be confused.
 *
 * **This file is DOM machinery and nothing else**, exactly as `./clipboard.ts`
 * is. It decides nothing about what the panel says, what it offers, what any
 * control does — and, since 2c-4a-3c-4, nothing about *when* a reveal is owed
 * either. That last one is the review's third finding: `OutcomeArm`,
 * `OutcomeReveal` and `outcomeReveal` used to live here and decided from
 * save-model state what had to be revealed, restating the browser model's arm
 * union as three literals **specifically** to avoid importing from
 * `src/lib/browser/`. Avoiding the dependency is not what the architecture rule
 * asks for; it is the reverse of it. They are in `../browser/saveOutcome` now,
 * and what is left here is the one thing a model must not do: touch a document.
 *
 * What this is *not* is six copies of the same three lines in six `.svelte`
 * files: a rule written into one renderer is carried by that renderer's mounted
 * suite alone, and a second renderer can omit it while walking the model
 * faithfully (2c-3c-3's Medium). Every surface calls {@link revealOutcome}.
 *
 * **There are two panels to reveal and they are two calls, not one.** 2c-4b's
 * reapply report is a **second** `role="status"` block, drawn immediately before
 * the outcome panel on the five match surfaces, and 2c-4b-3c-2 §11.1 measured it
 * above the top of the scrollport in all 42 of that reading's refusal launches
 * because nothing in the application pointed at it. {@link revealReapplyReport} is
 * that pointer, and its cue is `reapplyReveal` in `../browser/reapply` — a
 * separate decision from `outcomeReveal`'s because the two panels appear on
 * different events: a refusal changes the report and leaves the outcome arm
 * exactly as it was. **Nothing in these types stops the two calls fighting over
 * the same scroller**; what keeps them apart today is that a refused reapply does
 * not touch the outcome arm and a successful one removes it, and that is an
 * implementation fact about six components rather than something enforced here.
 *
 * **Scrolling a panel into view is not an automatic reload and changes nothing
 * about what the panel does.** No draft is touched, no state transition is taken,
 * and nothing is adopted — the six surfaces' conflict machinery is untouched by
 * this file.
 */

import type { ReapplyReveal } from '../browser/reapply';
import type { OutcomeReveal } from '../browser/saveOutcome';

/**
 * Asks the platform to scroll one element into view, and never throws.
 *
 * **This is a request and not a movement, and nothing above it may say
 * otherwise.** `Element.prototype.scrollIntoView` is absent in jsdom and can be
 * absent or refused in an embedded webview, and a panel that fails to scroll must
 * not take the outcome down with it: the sentences are already drawn and are the
 * thing that matters. So this returns without scrolling when the method is missing
 * and swallows the refusal when the call throws — **both arms are silent, so no
 * caller can learn whether anything moved**, and every contract in this file is
 * written as what is asked for rather than as where anything landed. Instant
 * rather than smooth, deliberately — a moving target is worse to read and cannot
 * be measured by a window reading.
 *
 * @param element - What to ask to bring into view.
 * @param block - Where to ask for it in the scrollport.
 */
function scrollQuietly(element: HTMLElement, block: 'start' | 'end' | 'nearest'): void {
  if (typeof element.scrollIntoView !== 'function') {
    return;
  }
  try {
    element.scrollIntoView({ block, inline: 'nearest' });
  } catch {
    // A platform that will not scroll is not worth an error the person cannot act
    // on: everything the panel says is already on the page.
  }
} // End of function scrollQuietly()

/**
 * Asks for the right part of an outcome panel to be brought into view.
 *
 * **The three panel cues scroll identically, and they are still three cues.**
 * `savedPanel`, `refusedPanel` and `conflictPanel` all ask for the panel's first
 * line at the top of the scrollport, because that is where the sentence saying
 * what happened is. What their being distinct buys is upstream of this function
 * entirely: a Svelte `$effect` whose dependency is the cue re-runs when one arm
 * replaces another over the same bound element, which a single `'panel'` value
 * did not (the 2c-4a-3c review's second finding).
 *
 * **Asked for, not achieved**, and the distinction is {@link scrollQuietly}'s: a
 * platform with no `scrollIntoView`, or one that refuses the call, produces no
 * movement at all and no way for this function to know it. Where the panel ended
 * up is a window reading's answer and never this one's.
 *
 * **The choices row falls back to the panel and never to nothing.** A
 * `conflictChoices` reveal with no row bound is a component that changed its
 * markup, and asking for the panel is the previous behaviour rather than
 * silence.
 *
 * @param reveal - What `outcomeReveal` in `../browser/saveOutcome` decided.
 * @param panel - The outcome panel's own element, or `null` when it is not drawn.
 * @param choices - The conflict arm's row of controls, or `null` when that arm is
 *   not the one showing.
 */
export function revealOutcome(
  reveal: OutcomeReveal,
  panel: HTMLElement | null,
  choices: HTMLElement | null
): void {
  if (reveal === 'none') {
    return;
  }
  if (reveal === 'conflictChoices') {
    const target = choices ?? panel;
    if (target !== null) {
      scrollQuietly(target, 'end');
    }
    return;
  }
  if (panel !== null) {
    scrollQuietly(panel, 'start');
  }
} // End of function revealOutcome()

/**
 * Asks for a reapply report to be brought into view when one appears.
 *
 * **`'nearest'` and not `'start'`, and the difference is the acceptance
 * constraint 2c-4b-3c-2 §11.4 sets on this fix.** On five of the six write
 * surfaces the conflict panel's own controls already begin below the fold at
 * 1180 × 728, and a repair that asked for more scrolling than it needed would
 * trade one invisible sentence for another. Per the CSSOM-View rule, `'nearest'`
 * asks for the **minimum**: an element already fully in the scrollport is not
 * scrolled to at all, and one above the scrollport is aligned top-to-top, which is
 * `'start'`'s behaviour for exactly the case the reading measured. `'start'` would
 * additionally ask to move a report that was already visible, which is movement
 * bought for nothing.
 *
 * **What this guarantees — conditionally, in the same sentence — and what it does
 * not guarantee at all.** *On a platform that implements `scrollIntoView` and
 * honours the call*, and {@link scrollQuietly} requires neither, nothing scrolls
 * while the report is already fully visible and the page moves by exactly the
 * amount needed to show it when the report is above the scrollport; where the
 * platform is missing the method or refuses it, **nothing moves and nothing in
 * this file can tell that apart from a scroll that worked**. There is therefore no
 * visual postcondition here to rely on, and no test in this repository can force
 * one. What it does not ask for on any platform is that anything else on the
 * surface be visible afterwards: the report sits above the outcome panel, so
 * revealing it pushes that panel and its controls **down** by the report's own
 * height, and on the five match surfaces those controls were already below the
 * fold before this call existed. Nothing here can promise otherwise, because
 * nothing in this process has a viewport — only 3d-2's window reading can say
 * where anything landed.
 *
 * @param reveal - What `reapplyReveal` in `../browser/reapply` decided.
 * @param report - The report block's own element, or `null` when none is drawn.
 */
export function revealReapplyReport(reveal: ReapplyReveal, report: HTMLElement | null): void {
  if (reveal === 'none' || report === null) {
    return;
  }
  scrollQuietly(report, 'nearest');
} // End of function revealReapplyReport()
