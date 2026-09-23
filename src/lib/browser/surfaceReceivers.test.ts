/**
 * The parent's binding record — Phase 2d-6-6b, widened to the operation panels at 2d-6-7a.
 *
 * **Model tests over a recording host**, so each case can read exactly which
 * registrations the roster made and returned. What they establish is identity
 * and bookkeeping: that a binding is instance-bound, that a surface naming no
 * file is registered over every eligible file, and that nothing outlives its
 * surface or its component. What they cannot establish is that a component
 * reports at all or withdraws at teardown — `DetailPane.test.ts` mounts the pane
 * for that.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import type { DocumentId } from '../ipc/types';
import { retainedDelivery } from './observationDelivery';
import type { ExternalConflictObservation } from './conflictSource';
import { makeDocument } from './fixtures';
import type { OpenWriteSurface, WriteSurfaceTarget } from './restore';
import { createReceiverRoster, type ReceivingSurfaceKind } from './surfaceReceivers';
import type { ObservationDelivery } from './observationDelivery';
import type { ObservationReceiver } from './workspace.svelte';

/** A host that records every registration and every reported target. */
interface RecordingHost {
  /** The roster's host. */
  readonly host: Parameters<typeof createReceiverRoster>[0];
  /**
   * The files registered right now, in registration order.
   *
   * @returns The files.
   */
  live(): readonly DocumentId[];
  /**
   * Hands one envelope to every live registration over one file.
   *
   * @param document - The file.
   * @param delivery - The envelope.
   */
  deliver(document: DocumentId, delivery: ObservationDelivery): void;
  /** Every target reported, in order. */
  readonly targets: [ReceivingSurfaceKind, WriteSurfaceTarget | null][];
}

/**
 * Builds a recording host.
 *
 * @returns The host and its readers.
 */
function recordingHost(): RecordingHost {
  const registrations: { document: DocumentId; receiver: ObservationReceiver; live: boolean }[] =
    [];
  const targets: [ReceivingSurfaceKind, WriteSurfaceTarget | null][] = [];
  return {
    host: {
      register: (document, receiver) => {
        const entry = { document, receiver, live: true };
        registrations.push(entry);
        return (): void => {
          entry.live = false;
        };
      },
      reportTarget: (kind, target) => {
        targets.push([kind, target]);
      }
    },
    live: () => registrations.filter((one) => one.live).map((one) => one.document),
    deliver: (document, delivery) => {
      for (const one of registrations.filter((entry) => entry.live && entry.document === document)) {
        one.receiver(delivery);
      } // End of the loop over the live registrations over the file
    },
    targets
  };
} // End of function recordingHost()

/**
 * A surface over one file.
 *
 * @param kind - The kind.
 * @param document - The file.
 * @returns The surface.
 */
function over(kind: 'matchEditor' | 'recovery', document: DocumentId): OpenWriteSurface {
  return { kind, target: { kind: 'document', document } };
} // End of function over()

/**
 * One envelope about one file.
 *
 * @param document - The file.
 * @returns A `retained` envelope.
 */
function envelope(document: DocumentId): ObservationDelivery {
  const observation: ExternalConflictObservation = {
    sequence: 1,
    document,
    previousRevision: 'a'.repeat(64),
    diskRevision: 'b'.repeat(64),
    diskText: '',
    disk: makeDocument({ id: document }),
    findings: [],
    correspondences: null
  };
  return retainedDelivery(observation);
} // End of function envelope()

describe('the receiver roster', () => {
  it('registers a bound receiver over its surface’s file and follows the file', () => {
    const recorded = recordingHost();
    const roster = createReceiverRoster(recorded.host);
    const told: ObservationDelivery[] = [];
    roster.bind('matchEditor', (delivery) => told.push(delivery));
    expect(recorded.live()).toEqual([]);
    roster.reconcile([over('matchEditor', 1)], []);
    expect(recorded.live()).toEqual([1]);
    const first = envelope(1);
    recorded.deliver(1, first);
    expect(told).toEqual([first]);
    roster.reconcile([over('matchEditor', 2)], []);
    expect(recorded.live()).toEqual([2]);
    roster.reconcile([], []);
    expect(recorded.live()).toEqual([]);
    expect(roster.receives('matchEditor')).toBe(true);
  });

  it('registers a surface naming no file over every eligible file, and only those', () => {
    const recorded = recordingHost();
    const roster = createReceiverRoster(recorded.host);
    roster.bind('matchCreator', () => undefined);
    roster.reconcile([{ kind: 'matchCreator', target: { kind: 'unknown' } }], [1, 3]);
    expect(recorded.live()).toEqual([1, 3]);
    roster.reconcile([{ kind: 'matchCreator', target: { kind: 'unknown' } }], [3, 4]);
    expect(recorded.live()).toEqual([3, 4]);
    roster.reconcile([{ kind: 'matchCreator', target: { kind: 'document', document: 4 } }], [3, 4]);
    expect(recorded.live()).toEqual([4]);
  });

  it('is instance-bound: a later bind displaces, and the displaced binding reaches nothing', () => {
    const recorded = recordingHost();
    const roster = createReceiverRoster(recorded.host);
    const old: ObservationDelivery[] = [];
    const replacement: ObservationDelivery[] = [];
    const first = roster.bind('recovery', (delivery) => old.push(delivery));
    roster.reconcile([over('recovery', 1)], []);
    const second = roster.bind('recovery', (delivery) => replacement.push(delivery));
    // Registered at once over what the last reconciliation wanted, and the old
    // registration returned at the displacement.
    expect(recorded.live()).toEqual([1]);
    recorded.deliver(1, envelope(1));
    expect(old).toEqual([]);
    expect(replacement).toHaveLength(1);
    // The displaced binding's two methods are inert.
    first.reportTarget({ kind: 'document', document: 9 });
    first.withdraw();
    expect(recorded.live()).toEqual([1]);
    expect(recorded.targets).toEqual([]);
    second.reportTarget({ kind: 'document', document: 1 });
    expect(recorded.targets).toEqual([['recovery', { kind: 'document', document: 1 }]]);
    second.withdraw();
    expect(recorded.live()).toEqual([]);
    expect(roster.receives('recovery')).toBe(false);
    expect(recorded.targets.at(-1)).toEqual(['recovery', null]);
    second.withdraw();
    expect(recorded.targets).toHaveLength(2);
  });

  it('never binds a kind this step does not receive, and disposes everything', () => {
    const recorded = recordingHost();
    const roster = createReceiverRoster(recorded.host);
    roster.bind('matchEditor', () => undefined);
    roster.bind('recovery', () => undefined);
    roster.reconcile(
      [over('matchEditor', 1), over('recovery', 2), { kind: 'rawEditor', target: { kind: 'document', document: 3 } }],
      []
    );
    expect(recorded.live()).toEqual([1, 2]);
    expect(roster.receives('rawEditor')).toBe(false);
    roster.dispose();
    expect(recorded.live()).toEqual([]);
    expect(roster.receives('matchEditor')).toBe(false);
  });

  it('receives the three operation panels since Phase 2d-6-7a, each over its own file, and still not raw or restore', () => {
    const recorded = recordingHost();
    const roster = createReceiverRoster(recorded.host);
    const operations = ['matchDeleter', 'matchMover', 'matchDuplicator'] as const;
    const told = new Map<ReceivingSurfaceKind, ObservationDelivery[]>();
    for (const kind of operations) {
      const mine: ObservationDelivery[] = [];
      told.set(kind, mine);
      roster.bind(kind, (delivery) => mine.push(delivery));
    } // End of the loop over the three operation kinds
    roster.reconcile(
      [
        { kind: 'matchDeleter', target: { kind: 'document', document: 1 } },
        { kind: 'matchMover', target: { kind: 'document', document: 2 } },
        { kind: 'matchDuplicator', target: { kind: 'document', document: 3 } },
        { kind: 'restore', target: { kind: 'document', document: 4 } }
      ],
      []
    );
    expect(recorded.live()).toEqual([1, 2, 3]);
    const second = envelope(2);
    recorded.deliver(2, second);
    expect(told.get('matchDeleter')).toEqual([]);
    expect(told.get('matchMover')).toEqual([second]);
    expect(told.get('matchDuplicator')).toEqual([]);
    for (const kind of operations) {
      expect(roster.receives(kind)).toBe(true);
    } // End of the loop over the three operation kinds
    expect(roster.receives('restore')).toBe(false);
    expect(roster.receives('rawEditor')).toBe(false);
  });
}); // End of the "receiver roster" suite
