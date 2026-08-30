/**
 * The reconciliation event wrapper, against a fake raw listener.
 *
 * What is under test is the *boundary*: which event name is registered, that the
 * handler is given the payload and nothing else, that a registration failure
 * survives as a rejection rather than being swallowed, and that the unlisten
 * function comes back to the caller untouched.
 *
 * **What is deliberately not under test, because nothing here could test it.**
 * That a real wake arrives. `REAL_RECONCILIATION_EVENTS` registers through
 * Tauri's `listen`, which needs a running application and — as `events.ts` says
 * — a capability entry this repository has not added; every assertion below can
 * pass while a real window is never told anything. That observation belongs to
 * Phase 2d-7.
 *
 * Per `1b-2a-notes.md` §14, an `it` callback whose description is already its
 * sibling argument carries no JSDoc of its own; ordinary helpers do.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  RECONCILIATION_EVENT_NAMES,
  reconciliationEventSource,
  type RawReconciliationListener,
  type ReconciliationEventName,
  type ReconciliationUnlisten
} from './events';
import type { ReconciliationWake } from './types';
import type { ExpectNever } from '../i18n/exhaustive';

/** A wake, exactly as Rust would have emitted it. */
const WAKE: ReconciliationWake = { workspace_epoch: 7, newest_sequence: 12 };

/** One registration a fake listener recorded. */
interface Registration {
  /** The event name the wrapper chose. */
  readonly event: string;
  /** The callback it registered, so a test can deliver an envelope to it. */
  readonly deliver: (event: { event: string; id: number; payload: ReconciliationWake }) => void;
}

/**
 * A raw listener that records what it was asked to register.
 *
 * @param unlisten - What the registration should resolve with.
 * @returns The listener and the registrations it has seen, newest last.
 */
function recordingListener(unlisten: ReconciliationUnlisten): {
  raw: RawReconciliationListener;
  registrations: Registration[];
} {
  const registrations: Registration[] = [];
  const raw: RawReconciliationListener = async (event, handler) => {
    registrations.push({ event, deliver: handler });
    return unlisten;
  };
  return { raw, registrations };
} // End of function recordingListener()

describe('RECONCILIATION_EVENT_NAMES', () => {
  it('holds exactly the one name Rust emits', () => {
    // The value is what `src-tauri/src/wire_contract.rs` parses and compares
    // against `crate::events::RECONCILIATION_READY`. Spelling it out here as
    // well is deliberate duplication: this side fails when the constant is
    // edited, and that side fails when the two languages disagree.
    expect([...RECONCILIATION_EVENT_NAMES]).toEqual(['workspace://reconciliation-ready']);
  });

  it('is a `workspace://` name and not a URL a webview could navigate to', () => {
    const [name] = RECONCILIATION_EVENT_NAMES;
    // Tauri admits alphanumerics, `-`, `/`, `:` and `_` in an event name, which
    // is what makes this spelling legal. The prefix groups the event by what it
    // is about so a later watcher-status event can join the same family.
    expect(name.startsWith('workspace://')).toBe(true);
    expect(/^[A-Za-z0-9\-/:_]+$/.test(name)).toBe(true);
  });
});

describe('reconciliationEventSource()', () => {
  it('registers the one event name, and no other', async () => {
    const { raw, registrations } = recordingListener(() => undefined);
    await reconciliationEventSource(raw).subscribe(() => undefined);
    expect(registrations.map((registration) => registration.event)).toEqual([
      'workspace://reconciliation-ready'
    ]);
  });

  it('hands the handler the payload, and never the envelope', async () => {
    const { raw, registrations } = recordingListener(() => undefined);
    const seen: unknown[] = [];
    await reconciliationEventSource(raw).subscribe((wake) => seen.push(wake));

    registrations[0]?.deliver({
      event: 'workspace://reconciliation-ready',
      id: 44,
      payload: WAKE
    });

    // The envelope's `id` and `event` are Tauri's bookkeeping, and a consumer
    // that could see them would be able to depend on them. The payload alone
    // crosses, and it is the exact object — a wake carries an epoch and a
    // sequence and nothing else.
    expect(seen).toEqual([WAKE]);
    expect(seen[0]).toBe(WAKE);
  }); // End of the "payload, never the envelope" case

  it('returns the unlisten function it was given, unwrapped', async () => {
    const unlisten = vi.fn();
    const { raw } = recordingListener(unlisten);
    const returned = await reconciliationEventSource(raw).subscribe(() => undefined);

    expect(returned).toBe(unlisten);
    expect(unlisten).not.toHaveBeenCalled();

    returned();
    expect(unlisten).toHaveBeenCalledTimes(1);
  }); // End of the "returns the unlisten function" case

  it('does not call either subscription’s unlisten function, and does not confuse the two', async () => {
    // The lifetime rule as far as an assertion reaches: the coordinator owns
    // disposal, so neither function has been called when `subscribe` resolves,
    // and two subscriptions get their own two functions rather than one shared
    // one — a wrapper that returned the first registration's function to the
    // second caller would let one disposal end the other's subscription.
    //
    // **What this does not assert is the module doc's "keeps no copy".** A
    // reference held in a module-level array is not observable from outside the
    // module: this case would pass unchanged if `subscribe` pushed each function
    // somewhere before returning it. That claim is carried by `events.ts`'s body
    // being eight lines that store nothing, and by review of it — never by this
    // case, which is why the case is no longer named for it.
    const first = vi.fn();
    const second = vi.fn();
    const registrations: string[] = [];
    let call = 0;
    const raw: RawReconciliationListener = async (event) => {
      registrations.push(event);
      call += 1;
      return call === 1 ? first : second;
    };
    const source = reconciliationEventSource(raw);

    const endFirst = await source.subscribe(() => undefined);
    const endSecond = await source.subscribe(() => undefined);

    expect(registrations).toHaveLength(2);
    expect(endFirst).toBe(first);
    expect(endSecond).toBe(second);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  }); // End of the "does not call either unlisten function" case

  it('lets a registration failure reject, rather than reporting a subscription it does not have', async () => {
    const refusal = new Error('the event plugin refused this registration');
    const raw: RawReconciliationListener = async () => {
      throw refusal;
    };

    await expect(reconciliationEventSource(raw).subscribe(() => undefined)).rejects.toBe(refusal);
  }); // End of the "registration failure" case

  it('delivers every wake, because nothing here coalesces or counts them', async () => {
    // A wake is a hint and the drain is the authority, so this wrapper has no
    // business deciding that two hints are one. It forwards each.
    const { raw, registrations } = recordingListener(() => undefined);
    const seen: ReconciliationWake[] = [];
    await reconciliationEventSource(raw).subscribe((wake) => seen.push(wake));

    const second: ReconciliationWake = { workspace_epoch: 7, newest_sequence: 13 };
    registrations[0]?.deliver({ event: 'workspace://reconciliation-ready', id: 1, payload: WAKE });
    registrations[0]?.deliver({ event: 'workspace://reconciliation-ready', id: 2, payload: WAKE });
    registrations[0]?.deliver({ event: 'workspace://reconciliation-ready', id: 3, payload: second });

    expect(seen).toEqual([WAKE, WAKE, second]);
  }); // End of the "delivers every wake" case
});

/**
 * `never` while {@link ReconciliationEventName} is narrower than `string`.
 *
 * **The widening check, and it is a type rather than a case because no case
 * could be it.** Assigning the *declared* name to the type — which is what the
 * case below does — compiles identically whether the type is the one-member
 * union or `string`, so it detects nothing: a string literal is assignable to
 * both. What discriminates is the assignment in the other direction, and only a
 * type can ask for it. `string extends ReconciliationEventName` is false for the
 * union and true for `string` or `any`, so a widened type instantiates
 * `ExpectNever` with `'widened'` and fails `npm run check` at the alias below,
 * before any test runs.
 */
type WidenedEventName = string extends ReconciliationEventName ? 'widened' : never;

/** The assertion {@link WidenedEventName} exists to make. */
export type _EventNameIsNotWidened = ExpectNever<WidenedEventName>;

describe('the event name type', () => {
  it('admits the declared name', () => {
    // The runtime half, and all it claims: the one name the type admits is the
    // one the array holds, so the type and the constant cannot drift apart.
    // Whether the type still *refuses* anything else is `_EventNameIsNotWidened`
    // above, which is where that claim can actually be made.
    const name: ReconciliationEventName = 'workspace://reconciliation-ready';
    expect(RECONCILIATION_EVENT_NAMES).toContain(name);
  });
});
