/**
 * Bringing a save's outcome panel into view when it appears.
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
 * **Scrolling a panel into view is not an automatic reload and changes nothing
 * about what the panel does.** No draft is touched, no state transition is taken,
 * and nothing is adopted — the six surfaces' conflict machinery is untouched by
 * this file.
 */

import type { OutcomeReveal } from '../browser/saveOutcome';

/**
 * Scrolls one element into view, and never throws.
 *
 * `Element.prototype.scrollIntoView` is absent in jsdom and can be absent or
 * refused in an embedded webview, and a panel that fails to scroll must not take
 * the outcome down with it: the sentences are already drawn and are the thing that
 * matters. Instant rather than smooth, deliberately — a moving target is worse to
 * read and cannot be measured by a window reading.
 *
 * @param element - What to bring into view.
 * @param block - Where to put it in the scrollport.
 */
function scrollQuietly(element: HTMLElement, block: 'start' | 'end'): void {
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
 * Brings the right part of an outcome panel into view.
 *
 * **The three panel cues scroll identically, and they are still three cues.**
 * `savedPanel`, `refusedPanel` and `conflictPanel` all put the panel's first line
 * at the top of the scrollport, because that is where the sentence saying what
 * happened is. What their being distinct buys is upstream of this function
 * entirely: a Svelte `$effect` whose dependency is the cue re-runs when one arm
 * replaces another over the same bound element, which a single `'panel'` value
 * did not (the 2c-4a-3c review's second finding).
 *
 * **The choices row falls back to the panel and never to nothing.** A
 * `conflictChoices` reveal with no row bound is a component that changed its
 * markup, and scrolling to the panel is the previous behaviour rather than
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
