/**
 * The DOM foreground source — Phase 2d-6-10.
 *
 * Runs in the default `node` environment: the two targets are Node's own
 * `EventTarget`, which dispatches synchronously exactly as the DOM's does, and the
 * page's `visibilityState` is a field a case sets before it dispatches. What this
 * file proves is the adapter's contract — which dispatched events call the
 * handler, that the call happens inside the dispatch, and that the unsubscribe
 * removes both listeners. **It proves nothing about whether WKWebView emits these
 * events on a real foregrounding**; that is the window reading's
 * (`docs/decisions/2d-6-10-window-reading.md`).
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it, vi } from 'vitest';
import { createDomForegroundSource, type VisibilityTarget } from './domForeground';

/** A page whose visibility a case sets, over a real `EventTarget`. */
class FakePage extends EventTarget implements VisibilityTarget {
  /** What `document.visibilityState` would read. */
  visibilityState = 'visible';
}

/** The two targets, with every add and remove counted per event type. */
interface Targets {
  /** The page. */
  readonly page: FakePage;
  /** The window. */
  readonly view: EventTarget;
  /**
   * How many listeners of one type are registered on the two targets right now.
   *
   * @param type - `'visibilitychange'` or `'focus'`.
   * @returns Adds minus removes, counting only removals of a registered function.
   */
  registered(type: string): number;
}

/**
 * Builds two targets whose listener counts a case can read.
 *
 * @returns The targets.
 */
function targets(): Targets {
  const page = new FakePage();
  const view = new EventTarget();
  const held = new Map<string, Set<unknown>>();
  for (const target of [page, view]) {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null): void => {
      const set = held.get(type) ?? new Set<unknown>();
      set.add(listener);
      held.set(type, set);
      add(type, listener);
    };
    target.removeEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null
    ): void => {
      held.get(type)?.delete(listener);
      remove(type, listener);
    };
  } // End of the loop that instruments both targets
  return {
    page,
    view,
    registered: (type: string): number => held.get(type)?.size ?? 0
  };
} // End of function targets()

describe('createDomForegroundSource', () => {
  it('registers nothing at construction', () => {
    const { page, view, registered } = targets();
    createDomForegroundSource(page, view);
    expect(registered('visibilitychange')).toBe(0);
    expect(registered('focus')).toBe(0);
  });

  it('calls the handler on a visibilitychange while visible, synchronously inside the dispatch', () => {
    const { page, view } = targets();
    const handler = vi.fn();
    createDomForegroundSource(page, view).subscribe(handler);
    page.visibilityState = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    // No await between the dispatch and this read: the delivery is synchronous.
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith();
  });

  it('does not call the handler on a visibilitychange to hidden', () => {
    const { page, view } = targets();
    const handler = vi.fn();
    createDomForegroundSource(page, view).subscribe(handler);
    page.visibilityState = 'hidden';
    page.dispatchEvent(new Event('visibilitychange'));
    expect(handler).not.toHaveBeenCalled();
    // The state is read at dispatch, not at subscription: the next change back is heard.
    page.visibilityState = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls the handler on a window focus, synchronously inside the dispatch', () => {
    const { page, view } = targets();
    const handler = vi.fn();
    createDomForegroundSource(page, view).subscribe(handler);
    view.dispatchEvent(new Event('focus'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not hear a focus dispatched on the page, nor a visibilitychange on the window', () => {
    const { page, view } = targets();
    const handler = vi.fn();
    createDomForegroundSource(page, view).subscribe(handler);
    page.dispatchEvent(new Event('focus'));
    view.dispatchEvent(new Event('visibilitychange'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the handler once per signal and coalesces nothing itself', () => {
    const { page, view } = targets();
    const handler = vi.fn();
    createDomForegroundSource(page, view).subscribe(handler);
    page.dispatchEvent(new Event('visibilitychange'));
    view.dispatchEvent(new Event('focus'));
    view.dispatchEvent(new Event('focus'));
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('removes both listeners on unsubscribe, synchronously, and a second unsubscribe is a no-op', () => {
    const { page, view, registered } = targets();
    const handler = vi.fn();
    const off = createDomForegroundSource(page, view).subscribe(handler);
    expect(registered('visibilitychange')).toBe(1);
    expect(registered('focus')).toBe(1);
    off();
    expect(registered('visibilitychange')).toBe(0);
    expect(registered('focus')).toBe(0);
    off();
    expect(registered('visibilitychange')).toBe(0);
    page.dispatchEvent(new Event('visibilitychange'));
    view.dispatchEvent(new Event('focus'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls nothing when a listener is reached after its unsubscribe', () => {
    // A target that does not honour removal: its `removeEventListener` does
    // nothing, so the listeners stay attached and only the flag stops them.
    const page = new FakePage();
    const view = new EventTarget();
    page.removeEventListener = (): void => undefined;
    view.removeEventListener = (): void => undefined;
    const handler = vi.fn();
    const off = createDomForegroundSource(page, view).subscribe(handler);
    off();
    page.dispatchEvent(new Event('visibilitychange'));
    view.dispatchEvent(new Event('focus'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps two subscriptions independent', () => {
    const { page, view, registered } = targets();
    const source = createDomForegroundSource(page, view);
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = source.subscribe(first);
    source.subscribe(second);
    expect(registered('focus')).toBe(2);
    offFirst();
    view.dispatchEvent(new Event('focus'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
}); // End of the describe over the DOM foreground source
