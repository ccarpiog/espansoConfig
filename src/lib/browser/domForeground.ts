/**
 * The foreground fallback: a synchronous {@link ForegroundSource} over two DOM
 * signals — Phase 2d-6-10, the 2d-6 record's §3 entry 33 and §5.8.
 *
 * ## What it is
 *
 * The coordinator's third trigger, made real. `AppShell.svelte` used to pass
 * `INERT_FOREGROUND_EVENTS`, so in the shipped window the foreground and resume
 * trigger never asked for a drain. This module listens for two things and asks
 * for a drain on each:
 *
 * - **`visibilitychange` on the document, when `visibilityState` reads
 *   `'visible'` at dispatch.** A change *to* hidden asks for nothing: a window
 *   going away has nothing new to show, and the next change back is the signal.
 * - **`focus` on the window.** Registered without capture, so a focus event
 *   aimed at an element inside the page — which does not bubble — does not reach
 *   it; only the window's own focus does.
 *
 * Both handlers call the coordinator's handler and do nothing else. **No timer
 * and no debounce**: two signals delivered in the same synchronous turn — a
 * `visibilitychange` and a `focus` dispatched back to back — are coalesced by the
 * coordinator's pump (`requestDrain` sets one flag, and a pump already scheduled
 * absorbs the second request), not here. Nothing forces that coalescing across
 * turns: the pump waits one microtask and clears its flag before draining, so two
 * signals the host delivers as separate tasks cost a follow-up drain. Whether
 * WKWebView delivers the pair in one task or two has not been read in a window.
 *
 * ## Why the DOM and not Tauri
 *
 * `ForegroundSource.subscribe` is synchronous because ruling 16 needs a
 * foreground listener removed synchronously on disposal. `addEventListener` and
 * `removeEventListener` are synchronous; Tauri's `onFocusChanged` is `async` and
 * awaits two separate `listen` calls (`@tauri-apps/api/window.js`), so it cannot
 * return an unsubscribe from `subscribe`. The DOM route also needs no Tauri
 * capability entry, and this phase adds none.
 *
 * ## What it cannot establish
 *
 * A test here proves that a *dispatched* event reaches the handler and that
 * unsubscribing removes both listeners. **It cannot prove that WKWebView emits
 * either event when the application really comes to the foreground, nor that a
 * window whose timers were stopped while occluded is recovered by one** (entry
 * 33): those are claims about the host, and only a window reading can make them,
 * each one no further than what it saw. It is a *fallback* — the wake is still
 * the primary trigger.
 *
 * ## Why the targets are injected
 *
 * The two targets are parameters described by structural interfaces rather than
 * the globals `document` and `window`, so the module imports no DOM at load time,
 * does nothing at construction, and its suite runs in the default `node`
 * environment over Node's own `EventTarget`. The one production caller passes the
 * real `document` and `window`.
 */

import type {
  ForegroundHandler,
  ForegroundSource,
  ForegroundUnsubscribe
} from './reconciliationCoordinator';

/** A listener this module registers; it reads nothing from the event. */
type SignalListener = () => void;

/**
 * The part of a `Document` this source reads: its visibility, and the
 * `visibilitychange` listener pair.
 *
 * `visibilityState` is read **at dispatch**, never cached, so a target whose
 * state changes between two events is judged per event.
 */
export interface VisibilityTarget {
  /** The page's visibility; only the value `'visible'` asks for a drain. */
  readonly visibilityState: string;
  /**
   * Registers a listener.
   *
   * @param type - Always `'visibilitychange'`.
   * @param listener - The listener to call.
   */
  addEventListener(type: 'visibilitychange', listener: SignalListener): void;
  /**
   * Removes a listener registered by the call above.
   *
   * @param type - Always `'visibilitychange'`.
   * @param listener - The same function that was registered.
   */
  removeEventListener(type: 'visibilitychange', listener: SignalListener): void;
} // End of interface VisibilityTarget

/** The part of a `Window` this source reads: the `focus` listener pair. */
export interface FocusTarget {
  /**
   * Registers a listener.
   *
   * @param type - Always `'focus'`.
   * @param listener - The listener to call.
   */
  addEventListener(type: 'focus', listener: SignalListener): void;
  /**
   * Removes a listener registered by the call above.
   *
   * @param type - Always `'focus'`.
   * @param listener - The same function that was registered.
   */
  removeEventListener(type: 'focus', listener: SignalListener): void;
} // End of interface FocusTarget

/**
 * Builds the DOM foreground source over one document and one window.
 *
 * **Nothing is registered here.** Each `subscribe` call registers its own pair
 * of listeners — fresh functions, so two subscriptions never share one — and the
 * unsubscribe it returns removes exactly that pair, synchronously.
 *
 * **What it forces and what it does not.** The unsubscribe removes both
 * listeners and also turns off a flag each listener checks, so a signal that
 * reaches a listener after its unsubscribe — through a target that does not
 * honour removal during a dispatch in progress — calls nothing; a second
 * unsubscribe is a no-op. It cannot force a caller to call the unsubscribe; the
 * coordinator's `dispose()` does, and `AppShell.test.ts` counts it.
 *
 * @param page - Where `visibilitychange` is heard and `visibilityState` read;
 *   `document` in production.
 * @param view - Where `focus` is heard; `window` in production.
 * @returns A source whose subscription is synchronous in both directions.
 */
export function createDomForegroundSource(
  page: VisibilityTarget,
  view: FocusTarget
): ForegroundSource {
  return {
    /**
     * Registers the two listeners for one handler.
     *
     * @param handler - Called once per qualifying signal, synchronously inside
     *   the event's dispatch.
     * @returns The call that removes both listeners.
     */
    subscribe(handler: ForegroundHandler): ForegroundUnsubscribe {
      let live = true;
      /**
       * Asks for a drain when the page has become visible.
       *
       * @returns Nothing.
       */
      const onVisibilityChange = (): void => {
        if (live && page.visibilityState === 'visible') {
          handler();
        }
      };
      /**
       * Asks for a drain when the window receives focus.
       *
       * @returns Nothing.
       */
      const onFocus = (): void => {
        if (live) {
          handler();
        }
      };
      page.addEventListener('visibilitychange', onVisibilityChange);
      view.addEventListener('focus', onFocus);
      /**
       * Removes both listeners, once.
       *
       * @returns Nothing.
       */
      return function unsubscribe(): void {
        if (!live) {
          return;
        }
        live = false;
        page.removeEventListener('visibilitychange', onVisibilityChange);
        view.removeEventListener('focus', onFocus);
      };
    } // End of function subscribe()
  };
} // End of function createDomForegroundSource()
