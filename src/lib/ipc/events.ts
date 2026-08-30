/**
 * The one event Rust emits, as an injectable subscription.
 *
 * `src/lib/ipc/commands.ts` is the boundary a caller *asks* across; this is the
 * boundary Rust *pushes* across, and it carries exactly one event.
 * `workspace://reconciliation-ready` says *there is something to drain* and
 * nothing else: it names no document, carries no observation, and nothing is
 * ever installed from it. The authority is `drainExternalChanges`, and a wake
 * this application never receives costs a later drain and nothing more.
 *
 * ## Why a factory, and not a module-level setter
 *
 * The subscription is built by {@link reconciliationEventSource} from a raw
 * listener, so a test drives it by passing a fake and the running application
 * passes Tauri's `listen`. A mutable module-level setter would be the same
 * capability with two extra failure modes — a test that forgets to restore it
 * leaks into the next one, and production code could replace the transport at
 * any time — and this repository already injects at the boundary rather than
 * mutating it (`BrowserCommands` in `src/lib/browser/workspace.svelte.ts`).
 *
 * ## Lifetime: the wrapper stores no unlisten function
 *
 * {@link ReconciliationEventSource.subscribe} *returns* the unlisten function
 * and forgets it. The Phase 2d-5 coordinator owns it for its own lifetime and
 * calls it on disposal, and a **workspace replacement does not unsubscribe or
 * resubscribe**: one listener stays live while the epoch changes, and a stale
 * wake is rejected by that coordinator's epoch comparison. Re-registering on
 * every open would open a delivery gap for no benefit.
 *
 * Two obligations this module deliberately does not discharge, both Phase
 * 2d-5's: **when** a drain fires — after registration, after an open completes,
 * on foreground or resume, and on a current-epoch wake — and what to do when
 * disposal races registration, since `listen` resolves asynchronously and a
 * coordinator disposed first must still call the unlisten function it
 * eventually receives.
 *
 * ## What no test in this repository can establish
 *
 * That the **real** adapter receives a real wake. A fake raw listener proves
 * this module forwards a payload and returns an unlisten function; it cannot
 * prove that WKWebView delivers `workspace://reconciliation-ready` to
 * {@link REAL_RECONCILIATION_EVENTS}. That observation is a running window's,
 * and Phase 2d-7 owns it. Nothing here may be read as a claim that anything is
 * listening — the Rust emitter's own doc says it cannot establish that either.
 *
 * ## Two known reasons the real adapter would be refused today
 *
 * Tauri's `listen` is a **plugin** command — it invokes `plugin:event|listen` —
 * and `src-tauri/capabilities/default.json` is deliberately `"permissions": []`,
 * narrowed by Phase 1b-1's review. Application commands are dispatched without
 * consulting that list; a plugin command is not. So a real registration through
 * {@link REAL_RECONCILIATION_EVENTS} needs `core:event:allow-listen` — the
 * narrowest entry that grants it — added to that file first.
 *
 * **That entry buys the registration only, and this module's lifetime contract
 * needs both halves.** The unlisten function `listen` resolves with invokes a
 * *second* plugin command, `plugin:event|unlisten`, gated by the separate
 * `core:event:allow-unlisten`. So `core:event:allow-listen` grants the
 * subscription the section above describes, and `core:event:allow-unlisten`
 * grants the disposal the section on lifetime hands to Phase 2d-5. Widening by
 * the first alone yields a listener that cannot be disposed rather than a
 * failure at registration: the JS-side listener is unregistered locally, the
 * `invoke` behind it rejects with nothing awaiting it, and the Rust-side
 * listener is never removed. Both identifiers exist in
 * `src-tauri/gen/schemas/desktop-schema.json`.
 *
 * **Phase 2d-4b deliberately adds neither, and nothing in this phase
 * registers a listener**: no production module imports this one yet, so the call
 * below never runs in the shipped window. The phase that first registers the
 * listener is the phase that has to widen the capability and re-run
 * `src-tauri/src/dispatch_check.rs` over the widened file, because that widening
 * is a change to what a compromised renderer may reach and belongs beside the
 * evidence that it was needed.
 */

import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';

import type { ReconciliationWake } from './types';

/**
 * The exact name of every event this application subscribes to.
 *
 * A one-element array rather than a bare constant so that
 * `src-tauri/src/wire_contract.rs` can parse it with the same scanner it uses
 * for `COMMAND_NAMES` and `MENU_COMMAND_NAMES`, and compare it against
 * `crate::events::RECONCILIATION_READY`. Without that comparison a fake-driven
 * frontend test and the Rust emitter test can both be green while spelling two
 * different names.
 *
 * **No comment may go inside these brackets.** That scanner reads this file
 * whole, because the name holds a `//` and the comment stripper it normally uses
 * has no notion of a string literal; a quoted word between the brackets would be
 * read as a second event name.
 */
export const RECONCILIATION_EVENT_NAMES = [
  'workspace://reconciliation-ready'
] as const;

/** One of {@link RECONCILIATION_EVENT_NAMES}. */
export type ReconciliationEventName = (typeof RECONCILIATION_EVENT_NAMES)[number];

const [RECONCILIATION_READY] = RECONCILIATION_EVENT_NAMES;

/**
 * What a subscriber hands back: the call that ends the subscription.
 *
 * Tauri's own `UnlistenFn`, re-exported under this file's name so that a
 * consumer never has to import from `@tauri-apps/api` to describe one. Calling
 * it more than once is Tauri's business, not this module's, and nothing here
 * promises anything about that.
 */
export type ReconciliationUnlisten = UnlistenFn;

/** What a wake is handed to. */
export type ReconciliationWakeHandler = (wake: ReconciliationWake) => void;

/**
 * The narrow transport a coordinator needs, with no Tauri in its type.
 *
 * One method, so a fake is one function. It is asynchronous because Tauri's
 * registration is: `listen` resolves only once the backend has recorded the
 * listener, and a synchronous shape would have to pretend otherwise.
 *
 * **Registration failure stays observable.** A `subscribe` whose underlying
 * registration rejects rejects too; it never resolves with a no-op unlisten
 * function, because that would report a subscription this application does not
 * have.
 */
export interface ReconciliationEventSource {
  /**
   * Subscribes to `workspace://reconciliation-ready`.
   *
   * @param handler - Called with each wake's payload, and with nothing else.
   * @returns The call that ends the subscription. The caller owns it; this
   *   module keeps no copy and will not call it.
   */
  subscribe(handler: ReconciliationWakeHandler): Promise<ReconciliationUnlisten>;
} // End of interface ReconciliationEventSource

/**
 * The shape of the raw listener this module wraps.
 *
 * Structurally Tauri's `listen` narrowed to the one payload and the one name
 * this application uses, so {@link reconciliationEventSource} can be handed a
 * fake without a Tauri process anywhere. It is deliberately not Tauri's own
 * generic type: a test writing one should not have to satisfy an overload set it
 * never exercises.
 */
export type RawReconciliationListener = (
  event: ReconciliationEventName,
  handler: (event: Event<ReconciliationWake>) => void
) => Promise<ReconciliationUnlisten>;

/**
 * Builds a source over one raw listener.
 *
 * The wrapper does exactly three things: it supplies the event name, so no
 * caller spells it; it passes the handler **only** `event.payload`, so nothing
 * downstream depends on Tauri's envelope; and it hands the unlisten function
 * back untouched.
 *
 * **What it does not do is remember anything.** It stores no unlisten function,
 * counts no subscriptions and holds no wake. Two calls to `subscribe` are two
 * independent subscriptions, and ending one says nothing about the other —
 * nothing in TypeScript prevents a caller from making two, and this module would
 * not know if one did.
 *
 * @param raw - The listener to register through, normally Tauri's `listen`.
 * @returns A source that registers through `raw`.
 */
export function reconciliationEventSource(
  raw: RawReconciliationListener
): ReconciliationEventSource {
  return {
    async subscribe(handler: ReconciliationWakeHandler): Promise<ReconciliationUnlisten> {
      return raw(RECONCILIATION_READY, (event: Event<ReconciliationWake>) => {
        handler(event.payload);
      });
    } // End of method subscribe()
  };
} // End of function reconciliationEventSource()

/**
 * The real source, for the running application.
 *
 * `REAL_COMMANDS`'s twin for the push half of the boundary. Tauri's `listen` is
 * called in exactly one place because of it, and — as Q8 of this phase's design
 * consult says — this object is the one part of the module no automated test in
 * this repository can exercise: every gate can be green while a real wake never
 * arrives here.
 */
export const REAL_RECONCILIATION_EVENTS: ReconciliationEventSource =
  reconciliationEventSource(listen);
