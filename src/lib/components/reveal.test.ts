/**
 * @vitest-environment jsdom
 *
 * What `./reveal.ts` does to a document.
 *
 * **A jsdom file that mounts nothing**, which is a category this repository did
 * not have before 2c-4a-3c. The seven other docblocks in `src/lib/components/`
 * exist to render a Svelte component; this one exists because `revealOutcome`
 * takes `HTMLElement`s and calling it with a hand-made object cast to one would be
 * testing the cast.
 *
 * **The cue itself is no longer tested here**, because it is no longer decided
 * here: `outcomeReveal` moved to `../browser/saveOutcome` at 2c-4a-3c-4 — the
 * review's third finding — and its cases moved with it, to
 * `../browser/saveOutcome.test.ts`. What is left is the half a model may not do.
 *
 * **jsdom does not implement `Element.prototype.scrollIntoView`**, which is the
 * first thing asserted below: that absence is exactly the condition `scrollQuietly`
 * guards, so the guard is checked against the platform rather than against a
 * stub of it. Everything after that installs a spy, because a spy is the only way
 * to see *which* element was pointed at and *where*.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OutcomeReveal } from '../browser/saveOutcome';
import { revealOutcome, revealReapplyReport } from './reveal';

/** Puts `Element.prototype.scrollIntoView` back exactly as jsdom left it. */
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView'
);

/** The three cues that all ask for the panel's first line at the top. */
const PANEL_CUES = ['savedPanel', 'refusedPanel', 'conflictPanel'] as const satisfies
  readonly OutcomeReveal[];

afterEach(() => {
  if (originalScrollIntoView === undefined) {
    // jsdom leaves the property absent; a `vi.fn()` assigned to it must go, or the
    // next file's "the platform has no such method" case would see this one's spy.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    return;
  }
  Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoView);
});

/**
 * Installs a spy in place of `scrollIntoView` and answers what it recorded.
 *
 * @returns The spy, whose calls are `[element, options]` pairs.
 */
function spyOnScrolling(): ReturnType<typeof vi.fn> {
  const spy = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: spy
  });
  return spy;
} // End of function spyOnScrolling()

/**
 * A detached element to stand in for a panel or a row of controls.
 *
 * @param tag - Which element to make.
 * @returns The element.
 */
function element(tag: string): HTMLElement {
  return document.createElement(tag);
} // End of function element()

describe('doing it to a document', () => {
  it('is guarded against a platform with no scrollIntoView, which jsdom is', () => {
    // The condition itself, asserted before it is stubbed away: if jsdom ever
    // implements this, the guard below stops being exercised by the next case and
    // this one says so.
    expect(typeof element('div').scrollIntoView).not.toBe('function');
    expect(() => revealOutcome('conflictPanel', element('div'), null)).not.toThrow();
  });

  it('does nothing at all for "none"', () => {
    const spy = spyOnScrolling();
    revealOutcome('none', element('div'), element('p'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks for the panel’s first line for every arm that appears', () => {
    // **All three panel cues ask for identical scrolling, and they are still three
    // cues.**
    // What their being distinct buys is upstream of this function: a Svelte
    // `$effect` re-runs when one arm replaces another over the same bound element,
    // which one shared `'panel'` value did not (the 2c-4a-3c review's finding 2).
    // That half is a *mounted* claim and is in the six component suites.
    for (const cue of PANEL_CUES) {
      const spy = spyOnScrolling();
      const panel = element('div');
      revealOutcome(cue, panel, element('p'));
      expect(spy, cue).toHaveBeenCalledTimes(1);
      // `start`, not `end`: the first line of a conflict panel is *Nothing was
      // written*, and that is the sentence the window reading found unreachable.
      expect(spy.mock.instances[0], cue).toBe(panel);
      expect(spy.mock.calls[0]?.[0], cue).toMatchObject({ block: 'start' });
    } // End of the loop over the three panel cues
  });

  it('asks for the controls at the second step, and not the panel', () => {
    const spy = spyOnScrolling();
    const panel = element('div');
    const choices = element('p');
    revealOutcome('conflictChoices', panel, choices);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.instances[0]).toBe(choices);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ block: 'end' });
  });

  it('falls back to the panel when a surface binds no controls row', () => {
    const spy = spyOnScrolling();
    const panel = element('div');
    revealOutcome('conflictChoices', panel, null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.instances[0]).toBe(panel);
  });

  it('is silent rather than throwing when nothing is bound at all', () => {
    const spy = spyOnScrolling();
    expect(() => revealOutcome('conflictPanel', null, null)).not.toThrow();
    expect(() => revealOutcome('conflictChoices', null, null)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('survives a platform whose scrollIntoView throws', () => {
    // An embedded webview may refuse the call; the sentences are already on the
    // page and losing them to a scroll would be strictly worse than not scrolling.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('refused');
      }
    });
    expect(() => revealOutcome('conflictPanel', element('div'), null)).not.toThrow();
  });
}); // End of the "doing it to a document" suite

describe('doing it to a reapply report', () => {
  /*
   * **2c-4b-3c-2 §11.1.** The report is a second `role="status"` block, drawn
   * immediately before the outcome panel on the five match surfaces, and that
   * reading measured it entirely above the scrollport in all 42 of its refusal
   * launches because nothing pointed at it.
   *
   * **What this file cannot see, stated where the cases are.** jsdom has no
   * layout: `getBoundingClientRect` answers zeroes for everything and
   * `scrollIntoView` does not exist until a case installs a spy. So nothing below
   * fails if the block ends up somewhere useless, and `'nearest'` cannot be
   * *observed* here to scroll less than `'start'` — only asserted to be what is
   * asked for. 3d-2's window reading is what says where it landed.
   *
   * **And a spy is a platform that always accepts.** The real one need not:
   * `scrollQuietly` returns without scrolling when `scrollIntoView` is absent and
   * swallows the call's refusal when it throws — the last case below asserts both
   * silences. So no case here, and no contract in `./reveal.ts`, may claim that
   * the report moved; the claim is only ever that the movement was asked for.
   */

  it('does nothing at all for "none"', () => {
    const spy = spyOnScrolling();
    revealReapplyReport('none', element('div'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks for the minimum scroll that would show the report', () => {
    const spy = spyOnScrolling();
    const report = element('div');
    revealReapplyReport('reportPanel', report);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.instances[0]).toBe(report);
    // `nearest`, not `start`: an element already fully in the scrollport is not
    // scrolled to at all, and one above it is aligned top-to-top. On five of the
    // six surfaces the conflict panel's controls already begin below the fold
    // (§11.4), so a reveal that moved more than it had to would trade one
    // invisible sentence for another.
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ block: 'nearest' });
  }); // End of the "minimum scroll" case

  it('is silent rather than throwing when the block is not bound, or the platform refuses', () => {
    const spy = spyOnScrolling();
    expect(() => revealReapplyReport('reportPanel', null)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('refused');
      }
    });
    expect(() => revealReapplyReport('reportPanel', element('div'))).not.toThrow();
  }); // End of the "unbound or refused" case
}); // End of the "doing it to a reapply report" suite
