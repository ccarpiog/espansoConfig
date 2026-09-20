/**
 * The drain lifecycle: when a drain fires, and what one answer does to the next
 * question — Phase 2d-5-3, extended at 2d-5-4.
 *
 * **What Phase 2d-5-4 added here is the session half of an accepted batch**: the
 * per-document accepted sequences, the `discarded` recovery's two arms and the
 * blocked state's exit. The arms of an observation themselves are
 * `observationTransitions.test.ts`'s, and what they do to a window is
 * `workspace.test.ts`'s — this file's host records the calls and changes nothing,
 * which is exactly why an assertion here is about the coordinator's decision and
 * never about a window.
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
import type {
  DocumentId,
  DocumentSummary,
  ExternalObservation,
  ObservedDocument,
  ReconciliationBatch
} from '../ipc/types';
import {
  createReconciliationCoordinator,
  INERT_FOREGROUND_EVENTS,
  INERT_RECONCILIATION_EVENTS,
  NO_RECONCILIATION_TRANSPORT,
  type ForegroundSource,
  type ReconciliationHost
} from './reconciliationCoordinator';
import type {
  ExternalDocumentStatus,
  ExternalPathDrift
} from './observationTransitions';
import type { CreatorEligibility, OpenWriteSurface, OpenWriteSurfaceKind } from './restore';
import type { WriteSurfaceTransition } from './writeSurfaceRegistry';
import { makeDocument, makeSummary } from './fixtures';

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
  /** What the live registry answers. Assignable, so a case can open a surface. */
  surfaces: readonly OpenWriteSurface[];
  /** Every request a recovery re-ran, in order. `null` is a legitimate one. */
  readonly reopened: (string | null)[];
  /** Every file a guarded reread was started for, in order. */
  readonly reread: DocumentId[];
  /**
   * The guard of every one of those rereads, in the same order.
   *
   * **Retained rather than run**, exactly as `observationTransitions.test.ts` does
   * it: a guard is asked after a real command answers, which this file has none
   * of, so a case that is about what the guard decides calls it itself at the
   * moment it wants to ask. That is the only way to put the coordinator into a
   * state — blocked, or disposed — *between* the transition and the installation.
   */
  readonly guards: (() => boolean)[];
  /** Every row that was inserted or replaced, in order. */
  readonly added: DocumentSummary[];
  /** Every file that was removed, in order. */
  readonly removed: DocumentId[];
  /** Every status that was recorded, in order; `null` means one was cleared. */
  readonly statuses: { document: DocumentId; status: ExternalDocumentStatus | null }[];
  /** Every path drift that was recorded, in order. */
  readonly drift: ExternalPathDrift[];
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
  const reopened: (string | null)[] = [];
  const reread: DocumentId[] = [];
  const guards: (() => boolean)[] = [];
  const added: DocumentSummary[] = [];
  const removed: DocumentId[] = [];
  const statuses: { document: DocumentId; status: ExternalDocumentStatus | null }[] = [];
  const drift: ExternalPathDrift[] = [];
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
      },
      /**
       * Whatever this file last assigned.
       *
       * @returns The live set.
       */
      openWriteSurfaces: (): readonly OpenWriteSurface[] => control.surfaces,
      /**
       * A generation derived from the set, so that assigning it moves this too.
       *
       * **Length, not a counter**: a case that replaces the set with one of the
       * same size and expects the guard to refuse is testing the *registry's*
       * contract rather than the coordinator's, and the registry's own suite owns
       * that. What this file needs is that opening a surface moves it.
       *
       * @returns The number of live surfaces.
       */
      writeSurfaceGeneration: (): number => control.surfaces.length,
      /**
       * Every file is creator-eligible here.
       *
       * The widest answer, so that an unknown-target creator in `surfaces` really
       * does cover every document a case names. `restore.test.ts` owns the
       * eligibility rule itself.
       *
       * @returns `creatorEligible`.
       */
      creatorEligibility: (): CreatorEligibility => 'creatorEligible',
      /**
       * No surface here has a transition.
       *
       * **`null` rather than a spy on purpose**: what a surface is told is
       * `observationTransitions.test.ts`'s, and this file's subject is the
       * coordinator's decision to tell one at all — which it records as a `stale`
       * status either way.
       *
       * @returns `null`.
       */
      transitionFor: (_kind: OpenWriteSurfaceKind): WriteSurfaceTransition | null => null,
      /**
       * Whether a row was added in this session.
       *
       * @param document - The identity.
       * @returns Whether an `Added` observation inserted it and nothing removed it.
       */
      holdsDocument: (document: DocumentId): boolean =>
        added.some((summary) => summary.id === document) && !removed.includes(document),
      /**
       * Records that a guarded reread was started, and never runs one.
       *
       * The guard is deliberately **not** called here: what it decides is asked
       * after a real command answers, which this file has none of. It is kept
       * beside the file so a case can ask it at the moment it chooses.
       *
       * @param document - The file.
       * @param guard - Asked immediately before the installation.
       */
      rereadUnderGuard: (document: DocumentId, guard: () => boolean): void => {
        reread.push(document);
        guards.push(guard);
      },
      /**
       * Records a row.
       *
       * @param summary - The row.
       */
      addDocument: (summary: DocumentSummary): void => {
        added.push(summary);
      },
      /**
       * Records a removal.
       *
       * @param document - The file.
       */
      removeDocument: (document: DocumentId): void => {
        removed.push(document);
      },
      /**
       * Records a status.
       *
       * @param document - The file.
       * @param status - The code, or `null`.
       */
      noteDocumentStatus: (
        document: DocumentId,
        status: ExternalDocumentStatus | null
      ): void => {
        statuses.push({ document, status });
      },
      /**
       * Records a path drift.
       *
       * @param entry - The path and what was observed of it.
       */
      notePathDrift: (entry: ExternalPathDrift): void => {
        drift.push(entry);
      },
      /**
       * Records the request a recovery re-ran, and opens nothing.
       *
       * **It does not call `workspaceOpened()` back**, unlike the production host,
       * so the cursor this file reads after a recovery is the one the coordinator
       * left rather than the one a real open would have cleared. That is the
       * difference between this file's evidence and `workspace.test.ts`'s, and it
       * is why the recovery's *effect* is asserted there.
       *
       * @param request - Exactly what the retained open was called with.
       */
      reopenWorkspace: (request: string | null): void => {
        reopened.push(request);
      }
    },
    asked,
    reported,
    // One rather than zero: every case here is about a workspace that has been
    // opened, and zero is what a state that has never opened one holds.
    generation: 1,
    // Empty, so the `discarded` recovery's default arm is the reopen. A case that
    // wants the blocked arm assigns one.
    surfaces: [],
    reopened,
    reread,
    guards,
    added,
    removed,
    statuses,
    drift,
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

/** Document `1`, as the open workspace resolves it. */
const ADDRESSABLE_ONE: ObservedDocument = {
  Addressable: { document: 1, relative_path: 'match/base.yml' }
};

/** Document `2`, as the open workspace resolves it. */
const ADDRESSABLE_TWO: ObservedDocument = {
  Addressable: { document: 2, relative_path: 'match/other.yml' }
};

/**
 * One addition of a file this workspace did not hold — Phase 2d-5-4.
 *
 * @param sequence - The sequence it was admitted under.
 * @param id - The identity this process minted for the path.
 * @returns The observation.
 */
function addition(sequence: number, id: number): ExternalObservation {
  return {
    Added: {
      sequence,
      document_summary: makeSummary({ id, relativePath: `match/new-${id}.yml` }),
      content: { Unreadable: { reason: { PermissionDenied: {} } } }
    }
  };
} // End of function addition()

/**
 * One change of an addressable file whose bytes projected — Phase 2d-5-4.
 *
 * The only arm that starts a guarded reread, which is what the two
 * still-applying cases need: a read in flight when the session stops.
 *
 * @param sequence - The sequence it was admitted under.
 * @param document - Which addressable file.
 * @returns The observation.
 */
function projectedChange(sequence: number, document: ObservedDocument): ExternalObservation {
  return {
    Changed: {
      sequence,
      document,
      previous_revision: 'rev-before',
      disk_revision: 'rev-disk',
      content: {
        Projected: {
          disk_text: 'matches: []\n',
          disk: makeDocument({ id: 2, relativePath: 'match/other.yml' }),
          findings: [],
          correspondences: null
        }
      }
    }
  };
} // End of function projectedChange()

/**
 * One write surface over document `1`, so a case can take the blocked arm.
 *
 * The match editor rather than the creator, because the creator is the one kind
 * whose target may be unknown and this value is about a surface that names a file.
 */
const SURFACE_OVER_ONE: OpenWriteSurface = {
  kind: 'matchEditor',
  target: { kind: 'document', document: 1 }
};

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
    coordinator.workspaceOpened(null);
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
    // **A surface is open, so the loss below blocks rather than reopening.** That
    // is ruling 13's arm and the one this case needs: a blocked session still
    // advances its watermark, so there is a number here for the stale batch to
    // fail to move. With an empty registry the same `discarded` would re-run the
    // retained open instead, and a reopened session has no watermark to compare.
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    control.surfaces = [SURFACE_OVER_ONE];
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
    coordinator.workspaceOpened(null);
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

  it('applies the observations it used to drop, and drops none of them', async () => {
    /*
     * **The case Phase 2d-5-3 wrote as its dropping evidence, turned over.** It
     * asserted that two observations were counted and thrown away, which was that
     * step's whole boundary; 2d-5-4 is where a transition runs instead, and
     * `observationsDropped()` now counts only what a *blocked* session drops. Two
     * removals of one file, so the second is the newer and both are applied in
     * arrival order.
     */
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 2, observations: [removal(1), removal(2)] }));
    await flush();

    expect(coordinator.observationsDropped()).toBe(0);
    expect(coordinator.observationOutcomes()).toEqual(['removed', 'removed']);
    expect(control.removed).toEqual([1, 1]);
    expect(coordinator.acceptedSequence(1)).toBe(2);
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
    coordinator.workspaceOpened(null);
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
    coordinator.workspaceOpened(null);

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
    coordinator.workspaceOpened(null);
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
    coordinator.workspaceOpened(null);
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
    coordinator.workspaceOpened(null);
    coordinator.requestDrain('foreground');
    events.wake(EPOCH, 2);
    await flush();

    expect(control.asked).toEqual([0]);
    expect(coordinator.awaitingWorkspaceReady()).toBe(true);
    expect(coordinator.pending()).toEqual(['foreground', 'wake']);

    // The retry is the exit, and it is a real one: the gate is not stuck, it is
    // waiting for the only event that puts a workspace on screen.
    control.generation += 1;
    coordinator.workspaceOpened(null);
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
    coordinator.workspaceOpened(null);
    control.generation += 1;
    coordinator.workspaceOpened(null);
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

  it('refuses a reread already in flight at disposal', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(
      batch({ newest_sequence: 4, observations: [projectedChange(4, ADDRESSABLE_TWO)] })
    );
    await flush();
    expect(control.reread).toEqual([2]);

    // **Disposal moves nothing a guard compares.** The epoch is where it was, no
    // newer observation was admitted, the registry never changed and the host's own
    // three captures belong to a window this file does not have — so the read that
    // was already out would install after reconciliation was stopped.
    coordinator.dispose();
    expect(control.guards[0]?.()).toBe(false);
    expect(control.statuses).toEqual([{ document: 2, status: { kind: 'stale' } }]);
  }); // End of the disposed-reread case
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

describe('the per-document accepted sequences', () => {
  it('keeps one number per document, and two documents do not share one', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(
      batch({
        newest_sequence: 9,
        observations: [
          { Removed: { sequence: 4, document: ADDRESSABLE_ONE, previous_revision: null } },
          { Removed: { sequence: 9, document: ADDRESSABLE_TWO, previous_revision: null } }
        ]
      })
    );
    await flush();

    // **Two documents, never one.** A single-document case cannot tell a
    // per-document map from one global number, and this project has shipped that
    // confusion before — the selection machinery's two counters.
    expect(coordinator.acceptedSequence(1)).toBe(4);
    expect(coordinator.acceptedSequence(2)).toBe(9);
    expect(control.removed).toEqual([1, 2]);
    coordinator.dispose();
  }); // End of the two-document case

  it('refuses an older observation of one file and leaves the other alone', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(
      batch({
        newest_sequence: 12,
        observations: [
          { Removed: { sequence: 12, document: ADDRESSABLE_ONE, previous_revision: null } },
          // Older, for the same file: refused, and it is refused by the map rather
          // than by the order it arrived in.
          { Removed: { sequence: 3, document: ADDRESSABLE_ONE, previous_revision: null } },
          // Older than document 1's, and the newest this file has: applied.
          { Removed: { sequence: 3, document: ADDRESSABLE_TWO, previous_revision: null } }
        ]
      })
    );
    await flush();

    expect(coordinator.observationOutcomes()).toEqual(['removed', 'superseded', 'removed']);
    expect(control.removed).toEqual([1, 2]);
    expect(coordinator.acceptedSequence(1)).toBe(12);
    expect(coordinator.acceptedSequence(2)).toBe(3);
    coordinator.dispose();
  }); // End of the superseded case

  it('disagrees with the watermark, which is not a bug', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(
      batch({
        newest_sequence: 40,
        observations: [
          { Removed: { sequence: 7, document: ADDRESSABLE_ONE, previous_revision: null } }
        ]
      })
    );
    await flush();

    // Ruling 6 in one assertion: the cursor is the drain acknowledgement and the
    // map is the arbitration key, and the wire lets a batch carry a
    // `newest_sequence` above every observation in it.
    expect(coordinator.cursor().watermark).toBe(40);
    expect(coordinator.acceptedSequence(1)).toBe(7);
    coordinator.dispose();
  }); // End of the two-sequence-states case

  it('is cleared by an open, because the next epoch restarts its sequences', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(
      batch({
        newest_sequence: 7,
        observations: [
          { Removed: { sequence: 7, document: ADDRESSABLE_ONE, previous_revision: null } }
        ]
      })
    );
    await flush();
    expect(coordinator.acceptedSequence(1)).toBe(7);

    coordinator.workspaceOpened('/tmp/other');
    expect(coordinator.acceptedSequence(1)).toBe(0);
    expect(coordinator.observationOutcomes()).toEqual([]);
    coordinator.dispose();
  }); // End of the cleared-by-open case

  it('writes nothing when the batch’s own getter reopened the workspace', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();

    // **The lifecycle capture, from the one side only a coordinator case can drive**
    // — Phase 2d-5-4-E. `accept()` used to read the batch's own members *above* the
    // session it builds, so a getter that reopened the workspace from inside one of
    // those reads left `session.epoch` holding the **post-reset** value: every fence
    // in `observationTransitions.ts` then compared the replacement with itself and
    // passed.
    let sprung = false;
    const trap: ReconciliationBatch = {
      epoch: EPOCH,
      discarded: 0,
      observations: [addition(500, 42)],
      /**
       * Answers the watermark, and reopens the workspace on the way.
       *
       * Exactly what `BrowserState.open()` does synchronously before its first
       * await — and it is this coordinator's own door, so nothing is simulated.
       *
       * @returns The batch's newest sequence.
       */
      get newest_sequence(): number {
        if (!sprung) {
          sprung = true;
          coordinator.workspaceOpened('/tmp/other');
        }
        return 500;
      }
    };
    control.answer({ ok: true, value: trap });
    await flush();

    expect(sprung).toBe(true);
    // The closed lifecycle's row does not land in the workspace replacing it, and
    // its sequence does not land in that workspace's map — where it would refuse
    // the new epoch's first five hundred observations of this same path-stable
    // identity, each answering `superseded` with nothing recording the refusal.
    expect(control.added).toEqual([]);
    expect(coordinator.acceptedSequence(42)).toBe(0);
    // Nothing of the batch was written at all, the cursor included: the reads that
    // feed it now happen above the comparison rather than interleaved with it.
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
    expect(coordinator.drains()[0]?.outcome).toBe('staleOpen');
    // Nothing reached an arm, so nothing was recorded — and `workspaceOpened`
    // emptied the list in the same synchronous block as the map.
    expect(coordinator.observationOutcomes()).toEqual([]);
    coordinator.dispose();
  }); // End of the reopened-mid-read case

  it('writes nothing when the command answer’s own getter reopened the workspace', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();

    // **Where the capture is taken, which the case above cannot tell.** That one
    // passes with the lifecycle captured anywhere above the batch's own members —
    // including as `accept()`'s first statement. This one moves the lifecycle from
    // a getter on the **`CommandResult`**, which `runOneDrain` reads on the line
    // that calls `accept`, so only a capture taken before that line survives it.
    let sprung = false;
    const answer: CommandResult<ReconciliationBatch> = {
      ok: true,
      /**
       * Answers the batch, and reopens the workspace on the way.
       *
       * @returns The batch this drain is answering with.
       */
      get value(): ReconciliationBatch {
        if (!sprung) {
          sprung = true;
          coordinator.workspaceOpened('/tmp/other');
        }
        return {
          epoch: EPOCH,
          discarded: 0,
          newest_sequence: 500,
          observations: [addition(500, 42)]
        };
      }
    };
    control.answer(answer);
    await flush();

    expect(sprung).toBe(true);
    expect(control.added).toEqual([]);
    expect(coordinator.acceptedSequence(42)).toBe(0);
    expect(coordinator.cursor()).toEqual({ epoch: 0, watermark: 0, lastDiscarded: 0 });
    expect(coordinator.drains()[0]?.outcome).toBe('staleOpen');
    coordinator.dispose();
  }); // End of the reopened-by-the-answer case
}); // End of the "per-document accepted sequences" suite

describe('the discarded-history recovery', () => {
  it('re-runs the retained open request when nothing is registered', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 5, discarded: 1, observations: [removal(2)] }));
    await flush();

    // **The retained request, never `summary.root`** (ruling 11), and the whole
    // batch is refused rather than reconciled: the lost entry may have been the
    // only observation of an addition or a removal.
    expect(control.reopened).toEqual(['/tmp/espanso']);
    expect(control.removed).toEqual([]);
    expect(coordinator.observationOutcomes()).toEqual([]);
    expect(coordinator.discardedNotices()).toBe(1);
    // Nothing was written to the cursor after the recovery: a production `open()`
    // clears it synchronously, and this host does not, so what stands is what the
    // coordinator left.
    expect(coordinator.cursor().watermark).toBe(0);
    coordinator.dispose();
  }); // End of the empty-registry recovery case

  it('retains null, which is a request and not the absence of one', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.workspaceOpened(null);
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 1, discarded: 1 }));
    await flush();

    expect(control.reopened).toEqual([null]);
    coordinator.dispose();
  }); // End of the null-request case

  it('reopens nothing while a write surface is open, and drops what follows', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    control.surfaces = [SURFACE_OVER_ONE];
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 5, discarded: 1, observations: [removal(2)] }));
    await flush();

    // Ruling 12: no `open()`, no synthetic conflict, nothing reloaded — and ruling
    // 13: the watermark still advances, so the retained queue is not refetched and
    // those observations are gone.
    expect(control.reopened).toEqual([]);
    expect(control.removed).toEqual([]);
    expect(coordinator.block()).toEqual({
      kind: 'blockedByLostHistory',
      discarded: 1,
      epoch: EPOCH
    });
    expect(coordinator.cursor().watermark).toBe(5);
    expect(coordinator.observationsDropped()).toBe(1);

    // And the next batch is dropped too, without a second notice.
    events.wake(EPOCH, 6);
    await flush();
    control.answer(batch({ newest_sequence: 8, discarded: 1, observations: [removal(7)] }));
    await flush();
    expect(coordinator.discardedNotices()).toBe(1);
    expect(coordinator.observationsDropped()).toBe(2);
    expect(coordinator.cursor().watermark).toBe(8);
    coordinator.dispose();
  }); // End of the blocked case

  it('permits the reload once the last surface closes, at the next batch', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    control.surfaces = [SURFACE_OVER_ONE];
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 5, discarded: 1 }));
    await flush();
    expect(coordinator.block().kind).toBe('blockedByLostHistory');

    // **Closing the surface triggers nothing**, and that is the decision rather
    // than an omission: nothing in this application observes the registry
    // emptying, so the permission is taken at the next batch — an event that
    // already exists.
    control.surfaces = [];
    expect(control.reopened).toEqual([]);
    expect(coordinator.block().kind).toBe('blockedByLostHistory');

    events.wake(EPOCH, 6);
    await flush();
    control.answer(batch({ newest_sequence: 6 }));
    await flush();

    expect(control.reopened).toEqual(['/tmp/espanso']);
    expect(coordinator.block()).toEqual({ kind: 'running' });
    coordinator.dispose();
  }); // End of the blocked-exit case

  it('treats an unknown-target creator as open, so it blocks too', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    // Ruling 12's last sentence: an unknown-target creator counts as open and
    // therefore blocks the reload.
    control.surfaces = [{ kind: 'matchCreator', target: { kind: 'unknown' } }];
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 5, discarded: 4 }));
    await flush();

    expect(control.reopened).toEqual([]);
    expect(coordinator.block().kind).toBe('blockedByLostHistory');
    coordinator.dispose();
  }); // End of the unknown-creator case

  it('does not recover twice for one cumulative value', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 4, discarded: 3 }));
    await flush();
    expect(control.reopened).toEqual(['/tmp/espanso']);

    // The same cumulative value again. `discarded` is monotonic within the epoch,
    // so this is the loss already acted on and must not be acted on twice.
    events.wake(EPOCH, 5);
    await flush();
    control.answer(batch({ newest_sequence: 5, discarded: 3 }));
    await flush();
    expect(control.reopened).toEqual(['/tmp/espanso']);
    expect(coordinator.discardedNotices()).toBe(1);
    coordinator.dispose();
  }); // End of the repeated-discarded case

  it('refuses a reread already in flight when the block is entered', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    // **Open before anything, and over a file no observation below names.** It has
    // to be open when the loss arrives, so that the recovery is deferred rather
    // than run — and it has to target a *different* document, so that the change of
    // document 2 still takes the clean path and the registry generation this host
    // derives from the set never moves. Every other question the guard asks is
    // therefore unmoved when it is finally called.
    control.surfaces = [SURFACE_OVER_ONE];
    coordinator.workspaceOpened('/tmp/espanso');
    coordinator.workspaceReady();
    coordinator.start();
    await flush();
    control.answer(
      batch({ newest_sequence: 4, observations: [projectedChange(4, ADDRESSABLE_TWO)] })
    );
    await flush();
    expect(control.reread).toEqual([2]);
    expect(control.statuses).toEqual([]);

    // The loss lands while that read is out, and the recovery is deferred because
    // the surface is open. Nothing the guard compares has moved.
    events.wake(EPOCH, 5);
    await flush();
    control.answer(batch({ newest_sequence: 9, discarded: 1 }));
    await flush();
    expect(coordinator.block().kind).toBe('blockedByLostHistory');
    expect(control.reopened).toEqual([]);

    // Now the read comes back. Installing here would land a piecemeal answer
    // underneath the whole-reload obligation, and clearing the status would say
    // *reconciled* about a session that cannot describe its own membership.
    expect(control.guards[0]?.()).toBe(false);
    expect(control.statuses).toEqual([{ document: 2, status: { kind: 'stale' } }]);
    coordinator.dispose();
  }); // End of the blocked-reread case
}); // End of the "discarded-history recovery" suite

describe('the membership-reload request', () => {
  it('is raised by an unnamed change and acted on by nothing', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    expect(coordinator.membershipReloadWanted()).toBe(false);

    control.answer(
      batch({
        newest_sequence: 3,
        observations: [
          {
            Changed: {
              sequence: 3,
              document: { Unnamed: { relative_path: 'match/stranger.yml' } },
              previous_revision: null,
              disk_revision: 'rev-stranger',
              content: { Unreadable: { reason: { PermissionDenied: {} } } }
            }
          }
        ]
      })
    );
    await flush();

    expect(coordinator.membershipReloadWanted()).toBe(true);
    expect(control.drift).toEqual([
      { relativePath: 'match/stranger.yml', detail: { kind: 'changed' } }
    ]);
    // **Nothing acts on it**: no open, no command, no reread.
    expect(control.reopened).toEqual([]);
    expect(control.reread).toEqual([]);
    coordinator.dispose();
  }); // End of the membership-request case

  it('is cleared by an open', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(
      batch({
        newest_sequence: 2,
        observations: [
          {
            Removed: {
              sequence: 2,
              document: { Unnamed: { relative_path: 'match/stranger.yml' } },
              previous_revision: null
            }
          }
        ]
      })
    );
    await flush();
    expect(coordinator.membershipReloadWanted()).toBe(true);

    coordinator.workspaceOpened(null);
    expect(coordinator.membershipReloadWanted()).toBe(false);
    coordinator.dispose();
  }); // End of the cleared-request case
}); // End of the "membership-reload request" suite

describe('what no observation ever reaches', () => {
  it('routes an addition to no command at all', async () => {
    const control = controlledHost();
    const coordinator = createReconciliationCoordinator(
      control.host,
      controlledEvents(true).source
    );
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 6, observations: [addition(6, 42)] }));
    await flush();

    // Ruling 30: the row goes in, nothing goes into `views`, and `getDocument` is
    // not called — which here means no reread was started for it either.
    expect(control.added.map((summary) => summary.id)).toEqual([42]);
    expect(control.added[0]?.loaded).toBe(false);
    expect(control.reread).toEqual([]);
    expect(coordinator.observationOutcomes()).toEqual(['added']);
    coordinator.dispose();
  }); // End of the addition case

  it('never passes a Named identity anywhere but the row it minted', async () => {
    const control = controlledHost();
    const events = controlledEvents(true);
    const coordinator = createReconciliationCoordinator(control.host, events.source);
    coordinator.start();
    await flush();
    control.answer(batch({ newest_sequence: 6, observations: [addition(6, 42)] }));
    await flush();

    events.wake(EPOCH, 7);
    await flush();
    control.answer(
      batch({
        newest_sequence: 7,
        observations: [
          {
            Removed: {
              sequence: 7,
              document: { Named: { document: 42, relative_path: 'match/new-42.yml' } },
              previous_revision: null
            }
          }
        ]
      })
    );
    await flush();

    // The locally pending row goes, and no command was reached: ruling 28's
    // negative half, which only a spy can establish.
    expect(control.removed).toEqual([42]);
    expect(control.reread).toEqual([]);
    expect(control.reopened).toEqual([]);
    expect(coordinator.observationOutcomes()).toEqual(['added', 'pendingRow']);
    coordinator.dispose();
  }); // End of the named-row case
}); // End of the "what no observation ever reaches" suite
