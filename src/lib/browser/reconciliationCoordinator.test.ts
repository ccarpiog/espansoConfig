/**
 * The drain lifecycle: when a drain fires, and what one answer does to the next
 * question — Phase 2d-5-3.
 *
 * Every case here drives `createReconciliationCoordinator` directly, over a host
 * whose drains are promises this file settles and over two fake transports. That
 * is deliberate, and it is why the coordinator is a plain module with no runes in
 * it: an overlap — a wake during a drain, an `open()` during a drain, a disposal
 * during a registration — is three statements here, and would be a mounted
 * component and a flush in `workspace.test.ts`.
 *
 * **No timer is used anywhere in this file, and nothing waits on the
 * coordinator.** Overlaps are produced by holding a promise, exactly as
 * `workspace.test.ts`'s `deferred` does, and progress is made by letting the
 * microtask queue run. A case that left a drain unanswered and then waited for
 * the pump would hang rather than fail, which is why {@link flush} answers the
 * weaker question and the assertions read counts.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  ReconciliationEventSource,
  ReconciliationUnlisten,
  ReconciliationWakeHandler
} from '../ipc/events';
import type { ExternalObservation, ReconciliationBatch } from '../ipc/types';
import {
  createReconciliationCoordinator,
  INERT_FOREGROUND_EVENTS,
  INERT_RECONCILIATION_EVENTS,
  NO_RECONCILIATION_TRANSPORT,
  type ForegroundSource,
  type ReconciliationHost
} from './reconciliationCoordinator';

/** The epoch every batch below carries unless a case is about a mismatch. */
const EPOCH = 7;

/**
 * Lets every queued microtask run.
 *
 * The longest chain any case here produces is a registration continuation, a
 * pump yield, a drain answer and a follow-up call, so ten turns is margin rather
 * than a threshold. **It waits for the queue, never for the coordinator**: a
 * drain this file has not answered stays outstanding across it, which is what
 * turns "the follow-up was never made" into a failed assertion instead of a
 * timeout.
 *
 * @returns A promise that resolves once the queue has drained ten times.
 */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  } // End of the loop that lets the microtask queue run
} // End of function flush()

/**
 * A host whose every drain is a promise this file settles.
 *
 * The mutable `generation` is what makes "an `open()` landed while the drain was
 * in flight" one assignment.
 */
interface ControlledHost {
  /** What the coordinator is built over. */
  readonly host: ReconciliationHost;
  /** The `afterSequence` of every physical drain, in order. */
  readonly asked: number[];
  /** Every failure the coordinator reported. */
  readonly reported: IpcFailure[];
  /** The workspace-open generation the coordinator reads. */
  generation: number;
  /**
   * Settles the oldest unanswered drain.
   *
   * @param result - What the command answers.
   */
  answer(result: CommandResult<ReconciliationBatch>): void;
  /**
   * How many drains have been asked and not answered.
   *
   * @returns The count.
   */
  outstanding(): number;
}

/**
 * Builds a host whose drains this file controls.
 *
 * @returns The host and the handles that drive it.
 */
function controlledHost(): ControlledHost {
  const asked: number[] = [];
  const reported: IpcFailure[] = [];
  const waiting: ((result: CommandResult<ReconciliationBatch>) => void)[] = [];
  const control: ControlledHost = {
    host: {
      /**
       * Records the question and answers it only when this file says so.
       *
       * @param afterSequence - The coordinator's watermark.
       * @returns A promise settled by {@link ControlledHost.answer}.
       */
      drain(afterSequence: number): Promise<CommandResult<ReconciliationBatch>> {
        asked.push(afterSequence);
        return new Promise((resolve) => {
          waiting.push(resolve);
        });
      },
      /**
       * The generation the coordinator captures around its await.
       *
       * @returns Whatever this file last set.
       */
      openGeneration: (): number => control.generation,
      /**
       * Keeps every reported failure.
       *
       * @param failure - The refusal.
       */
      report: (failure: IpcFailure): void => {
        reported.push(failure);
      }
    },
    asked,
    reported,
    // One rather than zero: every case here is about a workspace that has been
    // opened, and zero is what a state that has never opened one holds.
    generation: 1,
    answer(result: CommandResult<ReconciliationBatch>): void {
      const settle = waiting.shift();
      if (settle === undefined) {
        throw new Error('no drain is waiting to be answered');
      }
      settle(result);
    },
    outstanding: (): number => waiting.length
  };
  return control;
} // End of function controlledHost()

/**
 * A wake transport whose registration this file settles.
 *
 * Both halves of the registration race need it: a `subscribe` that resolves
 * after disposal, and one that rejects.
 */
interface ControlledEvents {
  /** What the coordinator is built over. */
  readonly source: ReconciliationEventSource;
  /**
   * How many times `subscribe` was called — the idempotence evidence for
   * `start()`.
   *
   * @returns The count.
   */
  subscribes(): number;
  /**
   * How many times the unlisten this file handed out was called.
   *
   * **The exact count ruling 16 asks for, and the only evidence of it**: nothing
   * in TypeScript forces the coordinator's continuation to call it.
   *
   * @returns The count.
   */
  unlistens(): number;
  /** Resolves the pending registration. */
  settle(): void;
  /**
   * Rejects it.
   *
   * @param error - What it rejects with.
   */
  fail(error: unknown): void;
  /**
   * Delivers one wake to whatever handler was registered.
   *
   * @param epoch - The wake's `workspace_epoch`.
   * @param newest - The wake's `newest_sequence`.
   */
  wake(epoch: number, newest: number): void;
}

/**
 * Builds a wake transport this file controls.
 *
 * @param settleImmediately - When `true`, `subscribe` resolves on its own, which
 *   is what an ordinary lifecycle looks like.
 * @returns The source and the handles that drive it.
 */
function controlledEvents(settleImmediately = false): ControlledEvents {
  let subscribeCount = 0;
  let unlistenCount = 0;
  let handler: ReconciliationWakeHandler | null = null;
  let resolveSubscribe: ((unlisten: ReconciliationUnlisten) => void) | null = null;
  let rejectSubscribe: ((error: unknown) => void) | null = null;
  /**
   * The unlisten every registration here resolves with.
   *
   * One function for the whole transport, so the count is a count of calls
   * rather than of instances.
   */
  const unlisten = (): void => {
    unlistenCount += 1;
  };
  return {
    source: {
      /**
       * Registers, and resolves when this file says so.
       *
       * @param wakeHandler - Where a wake goes.
       * @returns The unlisten, eventually.
       */
      subscribe(wakeHandler: ReconciliationWakeHandler): Promise<ReconciliationUnlisten> {
        subscribeCount += 1;
        handler = wakeHandler;
        if (settleImmediately) {
          return Promise.resolve(unlisten);
        }
        return new Promise<ReconciliationUnlisten>((resolve, refuse) => {
          resolveSubscribe = resolve;
          rejectSubscribe = refuse;
        });
      }
    },
    subscribes: (): number => subscribeCount,
    unlistens: (): number => unlistenCount,
    settle: (): void => {
      resolveSubscribe?.(unlisten);
    },
    fail: (error: unknown): void => {
      rejectSubscribe?.(error);
    },
    wake: (epoch: number, newest: number): void => {
      handler?.({ workspace_epoch: epoch, newest_sequence: newest });
    }
  };
} // End of function controlledEvents()

/** A foreground transport this file can signal through. */
interface ControlledForeground {
  /** What the coordinator is built over. */
  readonly source: ForegroundSource;
  /** Signals a foreground or resume. */
  signal(): void;
  /**
   * How many times the unsubscribe was called.
   *
   * @returns The count.
   */
  unsubscribes(): number;
  /**
   * Whether a handler is still registered.
   *
   * @returns `true` while one is.
   */
  listening(): boolean;
}

/**
 * Builds a foreground transport this file controls.
 *
 * @returns The source and the handles that drive it.
 */
function controlledForeground(): ControlledForeground {
  let handler: (() => void) | null = null;
  let unsubscribeCount = 0;
  return {
    source: {
      /**
       * Registers synchronously, as every real foreground source does.
       *
       * @param onForeground - Where a signal goes.
       * @returns The unsubscribe.
       */
      subscribe(onForeground: () => void): () => void {
        handler = onForeground;
        return (): void => {
          unsubscribeCount += 1;
          handler = null;
        };
      }
    },
    signal: (): void => {
      handler?.();
    },
    unsubscribes: (): number => unsubscribeCount,
    listening: (): boolean => handler !== null
  };
} // End of function controlledForeground()

/**
 * One batch, with only what a case is about spelled out.
 *
 * @param overrides - Whatever the case cares about.
 * @returns A successful command answer carrying it.
 */
function batch(overrides: Partial<ReconciliationBatch> = {}): CommandResult<ReconciliationBatch> {
  return {
    ok: true,
    value: {
      epoch: EPOCH,
      newest_sequence: 0,
      observations: [],
      discarded: 0,
      ...overrides
    }
  };
} // End of function batch()

/**
 * One observation, of the cheapest arm that carries a sequence.
 *
 * Nothing in this step reads anything but the count, which is exactly the point:
 * 2d-5-4 is where an arm starts to matter.
 *
 * @param sequence - The sequence it was admitted under.
 * @returns The observation.
 */
function removal(sequence: number): ExternalObservation {
  return {
    Removed: {
      sequence,
      document: { Addressable: { document: 1, relative_path: 'match/base.yml' } },
      previous_revision: null
    }
  };
} // End of function removal()

/** What a refused drain answers. */
const REFUSAL: CommandResult<ReconciliationBatch> = {
  ok: false,
  failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
};

describe('the single-flight pump', () => {
  it('turns ten duplicate wakes before a drain into exactly one call', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch());
    await flush();
    expect(control.asked).toEqual([0]);
    expect(control.outstanding()).toBe(0);

    for (let wake = 0; wake < 10; wake += 1) {
      events.wake(EPOCH, wake + 1);
    } // End of the loop that delivers ten duplicate wakes
    await flush();

    // One physical call, and one drain outstanding rather than ten.
    expect(control.asked).toEqual([0, 0]);
    expect(control.outstanding()).toBe(1);
    coordinator.dispose();
  }); // End of the ten-wakes-before-a-drain case

  it('turns ten wakes during a drain into at most one follow-up', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    expect(control.outstanding()).toBe(1);

    for (let wake = 0; wake < 10; wake += 1) {
      events.wake(EPOCH, wake + 1);
    } // End of the loop that delivers ten wakes into an in-flight drain
    control.answer(batch({ newest_sequence: 4 }));
    await flush();

    // Two physical calls in all: the registration's, and one follow-up carrying
    // the watermark the first one established.
    expect(control.asked).toEqual([0, 4]);
    coordinator.dispose();
  }); // End of the ten-wakes-during-a-drain case

  it('asks each drain with the watermark the previous answer established', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 12 }));
    await flush();

    events.wake(EPOCH, 13);
    await flush();
    expect(control.asked).toEqual([0, 12]);
    control.answer(batch({ newest_sequence: 19 }));
    await flush();

    expect(coordinator.cursor()).toEqual({ epoch: EPOCH, watermark: 19, lastDiscarded: 0 });
    expect(coordinator.isPumping()).toBe(false);
    coordinator.dispose();
  }); // End of the watermark-as-afterSequence case

  it('records every trigger a physical drain answered for', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch());
    await flush();

    expect(coordinator.drains()).toEqual([
      { afterSequence: 0, reasons: ['registration'], outcome: 'accepted' }
    ]);
    coordinator.dispose();
  });
}); // End of the "single-flight pump" suite

describe('the four triggers', () => {
  it('drains when registration resolves, and only then', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();

    expect(control.asked).toEqual([]);
    expect(coordinator.registration().kind).toBe('registering');

    events.settle();
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.registration().kind).toBe('registered');
    coordinator.dispose();
  }); // End of the registration-trigger case

  it('drains when a workspace reaches ready', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    coordinator.workspaceOpened();
    coordinator.workspaceReady();
    await flush();

    expect(control.asked).toEqual([0]);
    control.answer(batch());
    await flush();
    expect(coordinator.drains()[0]?.reasons).toEqual(['workspaceOpened']);
    coordinator.dispose();
  }); // End of the open-trigger case

  it('drains on a foreground signal', async () => {
    const control = controlledHost();
    const activity = controlledForeground();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents().source,
      activity.source
    );
    coordinator.start();
    activity.signal();
    await flush();

    expect(control.asked).toEqual([0]);
    control.answer(batch());
    await flush();
    expect(coordinator.drains()[0]?.reasons).toEqual(['foreground']);
    coordinator.dispose();
  }); // End of the foreground-trigger case

  it('records a request made before start and flushes it there', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.workspaceReady();

    // Recorded, not dropped — and not drained, because the lifecycle has not
    // begun. Losing it would make one of the consult's two orders silently
    // produce no drain at all.
    expect(coordinator.pending()).toEqual(['workspaceOpened']);
    await flush();
    expect(control.asked).toEqual([]);

    coordinator.start();
    await flush();

    expect(control.asked).toEqual([0]);
    coordinator.dispose();
  }); // End of the request-before-start case

  it('drains twice when registration and open arrive in that order', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    events.settle();
    await flush();
    expect(control.outstanding()).toBe(1);

    coordinator.workspaceReady();
    control.answer(batch({ newest_sequence: 3 }));
    await flush();

    expect(control.asked).toEqual([0, 3]);
    expect(coordinator.drains().map((drain) => drain.reasons)).toEqual([['registration']]);
    expect(coordinator.pending()).toEqual([]);
    coordinator.dispose();
  }); // End of the registration-then-open case

  it('drains twice when open and registration arrive in that order', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    coordinator.workspaceReady();
    await flush();
    expect(control.outstanding()).toBe(1);

    events.settle();
    control.answer(batch({ newest_sequence: 5 }));
    await flush();

    expect(control.asked).toEqual([0, 5]);
    expect(coordinator.drains().map((drain) => drain.reasons)).toEqual([['workspaceOpened']]);
    control.answer(batch({ newest_sequence: 5 }));
    await flush();
    expect(coordinator.drains().map((drain) => drain.reasons)).toEqual([
      ['workspaceOpened'],
      ['registration']
    ]);
    coordinator.dispose();
  }); // End of the open-then-registration case

  it('lets one physical drain satisfy both when neither has started', async () => {
    const control = controlledHost();
    // A registration that resolves on its own, so its continuation lands in the
    // same microtask batch as the pump's own yield — which is the shape the
    // consult's "when neither has started" names.
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    coordinator.workspaceReady();
    await flush();

    expect(control.asked).toEqual([0]);
    control.answer(batch());
    await flush();

    expect(coordinator.drains()).toHaveLength(1);
    expect(coordinator.drains()[0]?.reasons).toEqual(['workspaceOpened', 'registration']);
    coordinator.dispose();
  }); // End of the one-drain-two-reasons case
}); // End of the "four triggers" suite

describe('the epoch', () => {
  it('is learned from the first successful post-open drain', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });

    coordinator.start();
    await flush();
    control.answer(batch({ epoch: 42, newest_sequence: 8 }));
    await flush();

    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: 42 });
    expect(coordinator.cursor()).toEqual({ epoch: 42, watermark: 8, lastDiscarded: 0 });
    coordinator.dispose();
  }); // End of the epoch-adoption case

  it('requests no drain for a wake naming another epoch', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch());
    await flush();
    expect(control.asked).toEqual([0]);

    events.wake(EPOCH + 1, 99);
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.pending()).toEqual([]);
    coordinator.dispose();
  }); // End of the stale-wake case

  it('lets a wake before any epoch ask, without letting it establish one', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();

    // The registration's drain is still in flight, so nothing is adopted. The
    // wake may ask, and it is the batch — never the wake — that says which epoch
    // this session is showing.
    events.wake(999, 1);
    control.answer(batch({ epoch: EPOCH, newest_sequence: 2 }));
    await flush();

    expect(control.asked).toEqual([0, 2]);
    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH });
    coordinator.dispose();
  }); // End of the non-authoritative-wake case

  it('moves neither sequence state for a batch naming another epoch', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 6, discarded: 2 }));
    await flush();
    expect(coordinator.cursor()).toEqual({ epoch: EPOCH, watermark: 6, lastDiscarded: 2 });

    events.wake(EPOCH, 7);
    await flush();
    control.answer(batch({ epoch: EPOCH + 1, newest_sequence: 400, discarded: 90 }));
    await flush();

    // Neither the watermark nor the loss count moved, and the epoch was not
    // replaced.
    expect(coordinator.cursor()).toEqual({ epoch: EPOCH, watermark: 6, lastDiscarded: 2 });
    expect(coordinator.discardedNotices()).toBe(1);
    expect(coordinator.drains()[1]?.outcome).toBe('staleEpoch');
    coordinator.dispose();
  }); // End of the stale-batch case

  it('keeps epoch zero as "watched by nothing" rather than as stale', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(batch({ epoch: 0, newest_sequence: 0 }));
    await flush();

    expect(coordinator.drains()[0]?.outcome).toBe('accepted');
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
    expect(coordinator.watchState()).toEqual({ kind: 'notWatched' });
    coordinator.dispose();
  }); // End of the epoch-zero case

  it('is cleared by an open, so the next batch establishes a new one', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 9, discarded: 3 }));
    await flush();

    control.generation += 1;
    coordinator.workspaceOpened();
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });
    expect(coordinator.discardedNotices()).toBe(0);
    expect(coordinator.observationsDropped()).toBe(0);

    coordinator.workspaceReady();
    await flush();
    expect(control.asked).toEqual([0, 0]);
    control.answer(batch({ epoch: EPOCH + 5, newest_sequence: 1 }));
    await flush();

    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH + 5 });
    coordinator.dispose();
  }); // End of the epoch-cleared-by-open case
}); // End of the "epoch" suite

describe('the watermark and the loss count', () => {
  it('advances the watermark for an empty batch', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 31, observations: [] }));
    await flush();

    expect(coordinator.cursor().watermark).toBe(31);
    expect(coordinator.observationsDropped()).toBe(0);
    coordinator.dispose();
  }); // End of the empty-batch case

  it('counts the observations it drops and installs nothing', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 2, observations: [removal(1), removal(2)] }));
    await flush();

    expect(coordinator.observationsDropped()).toBe(2);
    expect(coordinator.cursor().watermark).toBe(2);
    coordinator.dispose();
  }); // End of the observations-dropped case

  it('does not act twice on a repeated discarded value, and does on a larger one', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 4, discarded: 3 }));
    await flush();
    expect(coordinator.discardedNotices()).toBe(1);
    expect(coordinator.cursor().lastDiscarded).toBe(3);

    events.wake(EPOCH, 5);
    await flush();
    control.answer(batch({ newest_sequence: 5, discarded: 3 }));
    await flush();

    // The same cumulative value, seen again: nothing was acted on, and the
    // watermark still advanced.
    expect(coordinator.discardedNotices()).toBe(1);
    expect(coordinator.cursor()).toEqual({ epoch: EPOCH, watermark: 5, lastDiscarded: 3 });

    events.wake(EPOCH, 6);
    await flush();
    control.answer(batch({ newest_sequence: 6, discarded: 4 }));
    await flush();

    expect(coordinator.discardedNotices()).toBe(2);
    expect(coordinator.cursor().lastDiscarded).toBe(4);
    coordinator.dispose();
  }); // End of the cumulative-discarded case
}); // End of the "watermark and loss count" suite

describe('the four captures around the await', () => {
  it('installs nothing from a drain an open overtook', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    expect(control.outstanding()).toBe(1);

    // The workspace is replaced while the only drain is in flight.
    control.generation += 1;
    coordinator.workspaceOpened();
    control.answer(batch({ newest_sequence: 77, discarded: 5 }));
    await flush();

    expect(coordinator.drains()[0]?.outcome).toBe('staleOpen');
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });
    coordinator.dispose();
  }); // End of the open-during-a-drain case

  it('installs nothing from a drain that returns after disposal', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    expect(control.outstanding()).toBe(1);

    coordinator.dispose();
    control.answer(batch({ newest_sequence: 51 }));
    await flush();

    expect(coordinator.drains()[0]?.outcome).toBe('disposed');
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
  }); // End of the disposal-during-a-drain case

  it('changes nothing when the command refuses, and reports it', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(REFUSAL);
    await flush();

    expect(coordinator.drains()[0]?.outcome).toBe('refused');
    expect(control.reported).toHaveLength(1);
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });
    coordinator.dispose();
  }); // End of the refused-drain case
}); // End of the "four captures" suite

describe('the single-flight release window', () => {
  it('does not strand a request made while the pump gives its slot back', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    expect(control.asked).toEqual([0]);

    // **The window this pins.** `pump()`'s `while` exits synchronously the moment
    // `requested` is false, but the single-flight slot is given back one microtask
    // later, by the `.then` the pump's promise carries. A `requestDrain` landing
    // between those two sets its boolean, sees an occupied slot and returns — and
    // before the release re-entered the pump, the reason sat on `pendingReasons`
    // with nothing behind it until some later trigger happened to arrive. The
    // chain below puts the request at exactly that depth, which is the depth an
    // `open()`'s tail calling `workspaceReady()` arrives at.
    control.answer(batch({ newest_sequence: 6 }));
    void Promise.resolve()
      .then(() => undefined)
      .then(() => {
        coordinator.requestDrain('foreground');
      });
    await flush();

    // A second physical call, asking with the watermark the first one established
    // — not a reason parked on `pending()` with `isPumping()` answering `false`.
    expect(control.asked).toEqual([0, 6]);
    expect(coordinator.pending()).toEqual([]);
    expect(coordinator.isPumping()).toBe(true);
    control.answer(batch({ newest_sequence: 6 }));
    await flush();
    expect(coordinator.drains().map((drain) => drain.reasons)).toEqual([
      ['registration'],
      ['foreground']
    ]);
    coordinator.dispose();
  }); // End of the release-window case

  it('does not restart the pump when the release window holds no request', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 6 }));
    await flush();

    // The other half of the same rule: a restart happens only because a trigger
    // set `requested`, and the loop clears `requested` before each drain, so
    // nothing here can spin. One call, and the slot is free.
    expect(control.asked).toEqual([0]);
    expect(coordinator.isPumping()).toBe(false);
    expect(coordinator.pending()).toEqual([]);
    coordinator.dispose();
  }); // End of the no-spin case
}); // End of the "single-flight release window" suite

describe('the open gate', () => {
  it('issues no drain between an open and its ready, and adopts no epoch there', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 3 }));
    await flush();
    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH });

    // `open()`'s entry, in its order: the generation is taken first, then the
    // coordinator is told. Rust still holds the workspace being replaced from here
    // until the open succeeds.
    control.generation += 1;
    coordinator.workspaceOpened();

    coordinator.requestDrain('foreground');
    await flush();

    // **Nothing was asked**, so no batch of the workspace on its way out could be
    // accepted and no epoch of it adopted — and the reason is still waiting. The
    // call count is asserted before the accessor on purpose: the behaviour is the
    // finding, and a reading of the flag alone would pass over a coordinator that
    // reported the gate and drained anyway.
    expect(control.asked).toEqual([0]);
    expect(control.outstanding()).toBe(0);
    expect(coordinator.pending()).toEqual(['foreground']);
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });
    expect(coordinator.awaitingWorkspaceReady()).toBe(true);

    coordinator.workspaceReady();
    await flush();
    expect(control.asked).toEqual([0, 0]);
    control.answer(batch({ epoch: EPOCH + 4, newest_sequence: 2 }));
    await flush();

    // One drain answered both reasons, and the shown epoch is the post-`ready`
    // batch's — the only thing ruling 8 lets supply one.
    expect(coordinator.drains()[1]).toEqual({
      afterSequence: 0,
      reasons: ['foreground', 'workspaceOpened'],
      outcome: 'accepted'
    });
    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH + 4 });
    coordinator.dispose();
  }); // End of the drain-between-open-and-ready case

  it('records a wake between an open and its ready without draining for it', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 3 }));
    await flush();

    control.generation += 1;
    coordinator.workspaceOpened();
    // `workspaceOpened()` cleared `adopted`, so `onWake`'s epoch check passes
    // whatever epoch this names — which is why a wake, and not only a foreground
    // signal, could reach a drain in this window.
    events.wake(EPOCH, 12);
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.pending()).toEqual(['wake']);
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });

    coordinator.workspaceReady();
    await flush();
    control.answer(batch({ epoch: EPOCH + 9, newest_sequence: 5 }));
    await flush();

    expect(coordinator.drains()[1]?.reasons).toEqual(['wake', 'workspaceOpened']);
    expect(coordinator.drains()[1]?.outcome).toBe('accepted');
    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH + 9 });
    coordinator.dispose();
  }); // End of the wake-between-open-and-ready case

  it('installs nothing from a drain an open began under', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    expect(control.outstanding()).toBe(1);

    // The fourth capture on its own: the coordinator is told an open began while
    // the only drain is in flight, and the host's generation is left alone, so the
    // recheck that refuses this batch is the gate rather than the number.
    coordinator.workspaceOpened();
    control.answer(batch({ newest_sequence: 41, discarded: 2 }));
    await flush();

    expect(coordinator.drains()[0]?.outcome).toBe('staleOpen');
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
    expect(coordinator.watchState()).toEqual({ kind: 'notObserved' });
    coordinator.dispose();
  }); // End of the open-began-under-a-drain case

  it('stays closed after an open that never reaches ready, and the next ready opens it', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 4 }));
    await flush();

    // `open()`'s entry, then `open_workspace` refuses: `workspaceReady()` is never
    // called on that path, and this coordinator has no third door on purpose — a
    // failed open leaves the previous workspace in place on the Rust side while
    // the window shows nothing.
    control.generation += 1;
    coordinator.workspaceOpened();
    coordinator.requestDrain('foreground');
    events.wake(EPOCH, 2);
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.awaitingWorkspaceReady()).toBe(true);
    expect(coordinator.pending()).toEqual(['foreground', 'wake']);

    // The retry is the exit, and it is a real one: the gate is not stuck, it is
    // waiting for the only event that puts a workspace on screen.
    control.generation += 1;
    coordinator.workspaceOpened();
    coordinator.workspaceReady();
    await flush();

    expect(coordinator.awaitingWorkspaceReady()).toBe(false);
    expect(control.asked).toEqual([0, 0]);
    control.answer(batch({ epoch: EPOCH + 1, newest_sequence: 7 }));
    await flush();

    expect(coordinator.drains()[1]?.reasons).toEqual(['foreground', 'wake', 'workspaceOpened']);
    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH + 1 });
    coordinator.dispose();
  }); // End of the failed-open case

  it('is opened by the ready of the open that superseded another', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 1 }));
    await flush();

    // Two `open()` entries with no `ready` between them. The first is superseded
    // and returns at its own generation check, calling nothing — so the gate the
    // second one set is the only one left, and the second one's `ready` opens it.
    control.generation += 1;
    coordinator.workspaceOpened();
    control.generation += 1;
    coordinator.workspaceOpened();
    coordinator.requestDrain('foreground');
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.awaitingWorkspaceReady()).toBe(true);

    coordinator.workspaceReady();
    await flush();

    expect(coordinator.awaitingWorkspaceReady()).toBe(false);
    expect(control.asked).toEqual([0, 0]);
    control.answer(batch({ epoch: EPOCH + 2, newest_sequence: 8 }));
    await flush();

    expect(coordinator.drains()[1]?.reasons).toEqual(['foreground', 'workspaceOpened']);
    expect(coordinator.watchState()).toEqual({ kind: 'watching', epoch: EPOCH + 2 });
    coordinator.dispose();
  }); // End of the superseded-open case

  it('holds nothing for a coordinator that is never told about an open', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);

    // The gate is a fact about what the coordinator was told, so a host that opens
    // no workspace never closes it and the other three triggers go on working.
    expect(coordinator.awaitingWorkspaceReady()).toBe(false);
    coordinator.start();
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.awaitingWorkspaceReady()).toBe(false);
    coordinator.dispose();
  }); // End of the never-opened case
}); // End of the "open gate" suite

describe('start and dispose', () => {
  it('subscribes exactly once however often start is called', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const activity = controlledForeground();
    const coordinator = createReconciliationCoordinator(
      control.host,
      events.source,
      activity.source
    );
    coordinator.start();
    coordinator.start();
    coordinator.start();
    await flush();

    expect(events.subscribes()).toBe(1);
    expect(control.asked).toEqual([0]);
    coordinator.dispose();
    expect(activity.unsubscribes()).toBe(1);
  }); // End of the idempotent-start case

  it('calls a held unlisten exactly once, however often dispose is called', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    expect(coordinator.registration().kind).toBe('registered');

    coordinator.dispose();
    coordinator.dispose();
    coordinator.dispose();

    expect(events.unlistens()).toBe(1);
    expect(coordinator.isDisposed()).toBe(true);
    expect(control.outstanding()).toBe(1);
  }); // End of the dispose-after-registration case

  it('calls the unlisten exactly once when disposal beats the registration', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    coordinator.dispose();
    expect(events.unlistens()).toBe(0);

    // The registration resolves into a coordinator that is already gone.
    events.settle();
    await flush();

    expect(events.unlistens()).toBe(1);
    expect(coordinator.registration()).toEqual({ kind: 'abandoned' });
    expect(control.asked).toEqual([]);
  }); // End of the dispose-before-registration case

  it('removes the foreground listener synchronously', () => {
    const control = controlledHost();
    const activity = controlledForeground();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents().source,
      activity.source
    );
    coordinator.start();
    expect(activity.listening()).toBe(true);

    coordinator.dispose();

    // Read in the same synchronous block as the disposal, with no await between.
    expect(activity.listening()).toBe(false);
    expect(activity.unsubscribes()).toBe(1);
  }); // End of the synchronous-foreground-removal case

  it('requests nothing once disposed', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const activity = controlledForeground();
    const coordinator = createReconciliationCoordinator(
      control.host,
      events.source,
      activity.source
    );
    coordinator.start();
    await flush();
    control.answer(batch());
    await flush();
    coordinator.dispose();

    coordinator.requestDrain('wake');
    coordinator.workspaceReady();
    events.wake(EPOCH, 4);
    activity.signal();
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.pending()).toEqual([]);
  }); // End of the requests-after-disposal case

  it('does not start after disposal', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.dispose();
    coordinator.start();
    await flush();

    expect(events.subscribes()).toBe(0);
    expect(control.asked).toEqual([]);
    expect(coordinator.registration()).toEqual({ kind: 'idle' });
  }); // End of the start-after-disposal case
}); // End of the "start and dispose" suite

describe('a registration that fails', () => {
  it('is observable, and never a silent no-op unlisten', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    const refusal = new Error('the backend refused to record the listener');
    events.fail(refusal);
    await flush();

    expect(coordinator.registration()).toEqual({ kind: 'failed', error: refusal });
    // No drain was requested by a registration that never happened.
    expect(control.asked).toEqual([]);
    coordinator.dispose();
    expect(events.unlistens()).toBe(0);
  }); // End of the failed-registration case

  it('leaves the other three triggers working', async () => {
    const control = controlledHost();
    const events = controlledEvents();
    const activity = controlledForeground();
    const coordinator = createReconciliationCoordinator(
      control.host,
      events.source,
      activity.source
    );
    coordinator.start();
    events.fail(new Error('refused'));
    await flush();
    expect(coordinator.registration().kind).toBe('failed');

    coordinator.workspaceReady();
    await flush();
    control.answer(batch({ newest_sequence: 2 }));
    await flush();
    activity.signal();
    await flush();

    expect(control.asked).toEqual([0, 2]);
    coordinator.dispose();
  }); // End of the failed-registration-other-triggers case

  it('is what the inert default source produces', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      INERT_RECONCILIATION_EVENTS,
      INERT_FOREGROUND_EVENTS
    );
    coordinator.start();
    await flush();

    const registration = coordinator.registration();
    expect(registration.kind).toBe('failed');
    expect(registration.kind === 'failed' && (registration.error as Error).message).toBe(
      NO_RECONCILIATION_TRANSPORT
    );
    expect(control.asked).toEqual([]);
    coordinator.dispose();
  }); // End of the inert-default case
}); // End of the "registration that fails" suite
