/**
 * The reconciliation-status decisions, as values — Phase 2d-6-9a.
 *
 * Every decision in `./reconciliationStatus.ts` is called directly with facts built
 * by hand, so each case says which input moved and what the decision became. The
 * two adapters are exercised twice: over a hand-built reader, which pins which
 * `BrowserState` reader each fact comes from, and over a real `createBrowserState`
 * for the empty-workspace retention the record's §3 entry 31 and §5.2 require.
 *
 * **What these cases cannot show**: that anything draws the decisions (nothing
 * does until 2d-6-9b), or that a press is refused as predicted — the `BrowserState`
 * requests recheck their own guards and `workspace.test.ts` pins those.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandResult } from '../ipc/commands';
import type { DocumentId, DocumentSummary, DocumentView, WorkspaceSummary } from '../ipc/types';
import type { ExpectNever, Missing } from '../i18n/exhaustive';
import { makeDocument, makeSummary } from './fixtures';
import type { ExternalDocumentStatus } from './observationTransitions';
import type { OpenWriteSurface } from './restore';
import {
  acknowledgementRefusalOf,
  decideFileReconciliation,
  decideShellComposition,
  decideWorkspaceReconciliation,
  fileFactsOf,
  filesToDecide,
  reloadRefusalOf,
  rereadRefusalOf,
  retryRefusalOf,
  workspaceBannersDrawnIn,
  workspaceFactsOf,
  type ControlDecision,
  type FileReconciliationFacts,
  type ReconciliationControl,
  type ReconciliationStatusReader,
  type ShellComposition,
  type WorkspaceReconciliationFacts
} from './reconciliationStatus';
import { createBrowserState, type BrowserCommands } from './workspace.svelte';

/**
 * The Tauri boundary, replaced for the whole file, as `workspace.test.ts` does: a
 * call that reaches it is the defect, and the `afterEach` below holds it at zero.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

afterEach(() => {
  expect(invoked).not.toHaveBeenCalled();
  invoked.mockClear();
});

/** Every control, in declaration order; pinned to the union below. */
const CONTROLS = [
  'membershipReload',
  'lostHistoryRecovery',
  'staleFileReread',
  'retryRetainedObservation',
  'acknowledgeUncertainty'
] as const satisfies readonly ReconciliationControl[];

// `never` exactly when the table above names every control. See `../i18n/exhaustive`.
export type _ControlsAreComplete = ExpectNever<Missing<ReconciliationControl, typeof CONTROLS>>;

/**
 * Workspace facts with nothing to draw, overridden per case.
 *
 * @param overrides - The facts a case moves.
 * @returns The facts.
 */
function workspace(overrides: Partial<WorkspaceReconciliationFacts> = {}): WorkspaceReconciliationFacts {
  return {
    status: 'ready',
    failed: false,
    documentCount: 2,
    openSurfaces: [],
    writeInFlight: false,
    watch: { kind: 'watching', epoch: 3 },
    registration: { kind: 'registered' },
    block: { kind: 'running' },
    membershipReloadWanted: false,
    pathDrift: [],
    ...overrides
  };
} // End of function workspace()

/**
 * Per-file facts with nothing to draw, overridden per case.
 *
 * @param overrides - The facts a case moves.
 * @returns The facts.
 */
function file(overrides: Partial<FileReconciliationFacts> = {}): FileReconciliationFacts {
  return {
    hasRow: true,
    status: null,
    observationRetained: false,
    uncertaintyUnresolved: false,
    surfaceOpen: false,
    writeInFlight: false,
    acknowledgement: { kind: 'ineligible', reason: 'noStandingOrigin' },
    ...overrides
  };
} // End of function file()

/**
 * The one decision for a control in a list, or `undefined`.
 *
 * @param controls - The decided controls.
 * @param control - Which one.
 * @returns Its decision.
 */
function controlIn(
  controls: readonly ControlDecision[],
  control: ReconciliationControl
): ControlDecision | undefined {
  return controls.find((decision) => decision.control === control);
} // End of function controlIn()

/** An acknowledgement the mint's guards permit. */
const ELIGIBLE = { kind: 'eligible' } as const;

/** The blocked state, as the coordinator answers it. */
const BLOCKED = { kind: 'blockedByLostHistory', discarded: 4, epoch: 3 } as const;

describe('the workspace banners', () => {
  it('draw nothing for a watched, registered, running workspace', () => {
    expect(decideWorkspaceReconciliation(workspace())).toEqual({ states: [], controls: [] });
  });

  it('draw every flag at once, drift first, in a fixed order', () => {
    const decision = decideWorkspaceReconciliation(
      workspace({
        watch: { kind: 'notWatched' },
        registration: { kind: 'failed', reason: 'rejected' },
        block: BLOCKED,
        membershipReloadWanted: true,
        pathDrift: [
          { relativePath: 'match/a.yml', detail: { kind: 'changed' } },
          { relativePath: 'match/b.yml', detail: { kind: 'removed' } }
        ]
      })
    );
    expect(decision.states).toEqual([
      { kind: 'pathDrift', relativePath: 'match/a.yml', detail: { kind: 'changed' } },
      { kind: 'pathDrift', relativePath: 'match/b.yml', detail: { kind: 'removed' } },
      { kind: 'notWatched' },
      { kind: 'registrationFailed', reason: 'rejected' },
      { kind: 'lostHistory' },
      { kind: 'membershipReloadWanted' }
    ]);
  });

  it('never call a workspace not yet observed "not watched"', () => {
    // Before the first accepted batch the window knows nothing about coverage.
    expect(decideWorkspaceReconciliation(workspace({ watch: { kind: 'notObserved' } })).states).toEqual([]);
    expect(
      decideWorkspaceReconciliation(workspace({ watch: { kind: 'watching', epoch: 1 } })).states
    ).toEqual([]);
  });

  it('draw a failed registration with its sanitized reason, and no other registration state', () => {
    for (const reason of ['noTransport', 'rejected'] as const) {
      expect(
        decideWorkspaceReconciliation(workspace({ registration: { kind: 'failed', reason } })).states
      ).toEqual([{ kind: 'registrationFailed', reason }]);
    }
    for (const registration of [
      { kind: 'idle' },
      { kind: 'registering' },
      { kind: 'registered' },
      { kind: 'abandoned' }
    ] as const) {
      expect(decideWorkspaceReconciliation(workspace({ registration })).states).toEqual([]);
    } // End of the loop over the undrawn registration states
  });

  it('carry an unreadable drift entry’s reason through unchanged', () => {
    const detail = { kind: 'unreadable', reason: { NotUtf8: { offset: 7 } } } as const;
    expect(
      decideWorkspaceReconciliation(workspace({ pathDrift: [{ relativePath: 'x.yml', detail }] }))
        .states
    ).toEqual([{ kind: 'pathDrift', relativePath: 'x.yml', detail }]);
  });

  it('are frozen', () => {
    const decision = decideWorkspaceReconciliation(workspace({ block: BLOCKED }));
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.states)).toBe(true);
    expect(Object.isFrozen(decision.controls)).toBe(true);
  });
}); // End of the "workspace banners" suite

describe('the two workspace reload controls', () => {
  it('are separate intents, each offered only beside its own banner', () => {
    expect(decideWorkspaceReconciliation(workspace({ membershipReloadWanted: true })).controls).toEqual(
      [{ control: 'membershipReload', enabled: true }]
    );
    expect(decideWorkspaceReconciliation(workspace({ block: BLOCKED })).controls).toEqual([
      { control: 'lostHistoryRecovery', enabled: true }
    ]);
    expect(
      decideWorkspaceReconciliation(workspace({ membershipReloadWanted: true, block: BLOCKED }))
        .controls
    ).toEqual([
      { control: 'membershipReload', enabled: true },
      { control: 'lostHistoryRecovery', enabled: true }
    ]);
  });

  it('are disabled, never hidden, by the request’s refusals in its order', () => {
    const asked = { membershipReloadWanted: true, block: BLOCKED } as const;
    const reasons = (facts: WorkspaceReconciliationFacts): readonly unknown[] =>
      decideWorkspaceReconciliation(facts).controls.map((control) =>
        control.enabled ? 'enabled' : control.reason
      );
    // Not ready is asked first, over a write in flight and an open surface.
    expect(
      reasons(
        workspace({ ...asked, status: 'loading', writeInFlight: true, openSurfaces: ['rawEditor'] })
      )
    ).toEqual(['workspaceNotReady', 'workspaceNotReady']);
    expect(
      reasons(workspace({ ...asked, status: 'failed', failed: true }))
    ).toEqual(['workspaceNotReady', 'workspaceNotReady']);
    // Then a write in flight, over an open surface.
    expect(reasons(workspace({ ...asked, writeInFlight: true, openSurfaces: ['rawEditor'] }))).toEqual(
      ['writeInFlight', 'writeInFlight']
    );
    // Then an open surface, the one the person can act on.
    expect(reasons(workspace({ ...asked, openSurfaces: ['matchEditor', 'restore'] }))).toEqual([
      'surfaceOpen',
      'surfaceOpen'
    ]);
  });

  it('become enabled when the last surface closes, and nothing is pressed', () => {
    // *Closing the final surface permits without triggering*: the decision
    // re-derives; it has no way to call a request and holds no state to try.
    const open = decideWorkspaceReconciliation(
      workspace({ block: BLOCKED, openSurfaces: ['matchMover'] })
    );
    const closed = decideWorkspaceReconciliation(workspace({ block: BLOCKED, openSurfaces: [] }));
    expect(controlIn(open.controls, 'lostHistoryRecovery')).toEqual({
      control: 'lostHistoryRecovery',
      enabled: false,
      reason: 'surfaceOpen'
    });
    expect(controlIn(closed.controls, 'lostHistoryRecovery')).toEqual({
      control: 'lostHistoryRecovery',
      enabled: true
    });
  });
}); // End of the "two workspace reload controls" suite

describe('the per-file states and where they are drawn', () => {
  it('draw nothing for a file with nothing to say', () => {
    expect(decideFileReconciliation(workspace(), file())).toEqual({ states: [], controls: [] });
  });

  it('draw stale and unavailable in the row and the header, and only the header with no row', () => {
    const reason = { PermissionDenied: {} } as const;
    expect(decideFileReconciliation(workspace(), file({ status: { kind: 'stale' } })).states).toEqual([
      { state: { kind: 'stale' }, placements: ['sidebarRow', 'header'] }
    ]);
    expect(
      decideFileReconciliation(workspace(), file({ status: { kind: 'unavailable', reason } })).states
    ).toEqual([{ state: { kind: 'unavailable', reason }, placements: ['sidebarRow', 'header'] }]);
    expect(
      decideFileReconciliation(workspace(), file({ hasRow: false, status: { kind: 'stale' } })).states
    ).toEqual([{ state: { kind: 'stale' }, placements: ['header'] }]);
  });

  it('draw removed in the header and the selection notice, never in a row', () => {
    for (const hasRow of [true, false]) {
      expect(
        decideFileReconciliation(workspace(), file({ hasRow, status: { kind: 'removed' } })).states
      ).toEqual([{ state: { kind: 'removed' }, placements: ['header', 'selectionNotice'] }]);
    }
  });

  it('draw a held observation and an uncertain write on the surface, or on the route once it closes', () => {
    const facts = { observationRetained: true, uncertaintyUnresolved: true } as const;
    expect(decideFileReconciliation(workspace(), file({ ...facts, surfaceOpen: true })).states).toEqual([
      { state: { kind: 'observationRetained' }, placements: ['surface'] },
      { state: { kind: 'writeOutcomeUnknown' }, placements: ['surface'] }
    ]);
    // Entry 15: per file, never dependent on a mounted panel.
    expect(decideFileReconciliation(workspace(), file({ ...facts, surfaceOpen: false })).states).toEqual(
      [
        { state: { kind: 'observationRetained' }, placements: ['workspaceRoute'] },
        { state: { kind: 'writeOutcomeUnknown' }, placements: ['workspaceRoute'] }
      ]
    );
  });

  it('draw a status beside a hold, status first', () => {
    const decision = decideFileReconciliation(
      workspace(),
      file({ status: { kind: 'stale' }, uncertaintyUnresolved: true })
    );
    expect(decision.states.map((state) => state.state.kind)).toEqual(['stale', 'writeOutcomeUnknown']);
  });

  it('are frozen, down to each placement list', () => {
    const decision = decideFileReconciliation(workspace(), file({ status: { kind: 'removed' } }));
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.states)).toBe(true);
    expect(Object.isFrozen(decision.states[0])).toBe(true);
    expect(Object.isFrozen(decision.states[0]!.placements)).toBe(true);
  });
}); // End of the "per-file states" suite

describe('the stale-file reread', () => {
  const stale: ExternalDocumentStatus = { kind: 'stale' };

  it('is offered for a stale file whose surface has closed, and only then', () => {
    expect(decideFileReconciliation(workspace(), file({ status: stale })).controls).toEqual([
      { control: 'staleFileReread', enabled: true }
    ]);
    // With a surface open, the surface's own conflict is the route.
    expect(
      controlIn(
        decideFileReconciliation(workspace(), file({ status: stale, surfaceOpen: true })).controls,
        'staleFileReread'
      )
    ).toBeUndefined();
    for (const status of [
      { kind: 'removed' },
      { kind: 'unavailable', reason: { Other: {} } }
    ] as const) {
      expect(
        controlIn(decideFileReconciliation(workspace(), file({ status })).controls, 'staleFileReread')
      ).toBeUndefined();
    } // End of the loop over the statuses that offer no reread
  });

  it('is disabled by requestFileReread’s guards, in its order', () => {
    const reasonFor = (
      facts: Partial<WorkspaceReconciliationFacts>,
      perFile: Partial<FileReconciliationFacts>
    ): unknown => {
      const decision = controlIn(
        decideFileReconciliation(workspace(facts), file({ status: stale, ...perFile })).controls,
        'staleFileReread'
      );
      return decision === undefined ? 'absent' : decision.enabled ? 'enabled' : decision.reason;
    };
    const everything = {
      hasRow: false,
      uncertaintyUnresolved: true,
      observationRetained: true,
      writeInFlight: true
    } as const;
    expect(reasonFor({ status: 'loading', block: BLOCKED }, everything)).toBe('workspaceNotReady');
    expect(reasonFor({ block: BLOCKED }, everything)).toBe('notAddressable');
    expect(reasonFor({ block: BLOCKED }, { ...everything, hasRow: true })).toBe('blockedByLostHistory');
    expect(reasonFor({}, { ...everything, hasRow: true })).toBe('uncertaintyUnresolved');
    expect(reasonFor({}, { hasRow: true, observationRetained: true, writeInFlight: true })).toBe(
      'observationRetained'
    );
    expect(reasonFor({}, { writeInFlight: true })).toBe('writeInFlight');
    expect(reasonFor({}, {})).toBe('enabled');
  });
}); // End of the "stale-file reread" suite

describe('the retry of a held observation', () => {
  it('is offered wherever the held state is drawn, on a surface or on the route', () => {
    for (const surfaceOpen of [true, false]) {
      expect(
        decideFileReconciliation(workspace(), file({ observationRetained: true, surfaceOpen }))
          .controls
      ).toEqual([{ control: 'retryRetainedObservation', enabled: true }]);
    }
  });

  it('is disabled by a write in flight alone (entry 16)', () => {
    expect(
      decideFileReconciliation(workspace(), file({ observationRetained: true, writeInFlight: true }))
        .controls
    ).toEqual([{ control: 'retryRetainedObservation', enabled: false, reason: 'writeInFlight' }]);
    // Not by the lost-history block, nor by a workspace still loading: the retry
    // asks neither, and predicting a refusal it does not give would hide an exit.
    expect(
      decideFileReconciliation(
        workspace({ block: BLOCKED, status: 'loading' }),
        file({ observationRetained: true })
      ).controls
    ).toEqual([{ control: 'retryRetainedObservation', enabled: true }]);
  });

  it('is not offered with nothing held', () => {
    expect(
      controlIn(decideFileReconciliation(workspace(), file()).controls, 'retryRetainedObservation')
    ).toBeUndefined();
  });
}); // End of the "retry" suite

describe('the uncertainty acknowledgement', () => {
  it('is offered while the hold stands and a snapshot stands to acknowledge', () => {
    expect(
      decideFileReconciliation(
        workspace(),
        file({ uncertaintyUnresolved: true, acknowledgement: ELIGIBLE })
      ).controls
    ).toEqual([{ control: 'acknowledgeUncertainty', enabled: true }]);
  });

  it('is not offered without a standing snapshot — ruling (2): the operand is the reviewed source', () => {
    const decision = decideFileReconciliation(
      workspace(),
      file({ uncertaintyUnresolved: true, acknowledgement: { kind: 'ineligible', reason: 'noStandingOrigin' } })
    );
    expect(decision.states.map((state) => state.state.kind)).toEqual(['writeOutcomeUnknown']);
    expect(controlIn(decision.controls, 'acknowledgeUncertainty')).toBeUndefined();
  });

  it('is disabled by a write in flight, and is offered on the route as on a surface', () => {
    expect(
      decideFileReconciliation(
        workspace(),
        file({ uncertaintyUnresolved: true, acknowledgement: { kind: 'ineligible', reason: 'writeInFlight' }, writeInFlight: true })
      ).controls
    ).toEqual([{ control: 'acknowledgeUncertainty', enabled: false, reason: 'writeInFlight' }]);
    for (const surfaceOpen of [true, false]) {
      expect(
        controlIn(
          decideFileReconciliation(
            workspace(),
            file({ uncertaintyUnresolved: true, acknowledgement: ELIGIBLE, surfaceOpen })
          ).controls,
          'acknowledgeUncertainty'
        )
      ).toEqual({ control: 'acknowledgeUncertainty', enabled: true });
    } // End of the loop over both placements
  });

  it('is disabled with the mint’s projectionReplaced refusal, and absent for noHold (review finding 2)', () => {
    expect(
      decideFileReconciliation(
        workspace(),
        file({
          uncertaintyUnresolved: true,
          acknowledgement: { kind: 'ineligible', reason: 'projectionReplaced' }
        })
      ).controls
    ).toEqual([{ control: 'acknowledgeUncertainty', enabled: false, reason: 'projectionReplaced' }]);
    expect(
      decideFileReconciliation(
        workspace(),
        file({ uncertaintyUnresolved: true, acknowledgement: { kind: 'ineligible', reason: 'noHold' } })
      ).controls
    ).toEqual([]);
  });

  it('is not offered with no hold, whatever stands', () => {
    expect(
      decideFileReconciliation(workspace(), file({ acknowledgement: ELIGIBLE })).controls
    ).toEqual([]);
  });
}); // End of the "uncertainty acknowledgement" suite

describe('every control is reachable from some facts', () => {
  it('names each of the five exactly once across the decisions', () => {
    const seen = new Set<ReconciliationControl>();
    const workspaceDecision = decideWorkspaceReconciliation(
      workspace({ membershipReloadWanted: true, block: BLOCKED })
    );
    const fileDecision = decideFileReconciliation(
      workspace(),
      file({
        status: { kind: 'stale' },
        observationRetained: true,
        uncertaintyUnresolved: true,
        acknowledgement: ELIGIBLE
      })
    );
    for (const decision of [...workspaceDecision.controls, ...fileDecision.controls]) {
      expect(seen.has(decision.control), decision.control).toBe(false);
      seen.add(decision.control);
    }
    expect([...seen].sort()).toEqual([...CONTROLS].sort());
  });
}); // End of the "every control" suite

describe('what a press answered, as a refusal', () => {
  it('maps each request’s outcome to its refusal, and success to null', () => {
    expect(reloadRefusalOf({ kind: 'reloading' })).toBeNull();
    expect(reloadRefusalOf({ kind: 'refused', reason: 'notBlocked' })).toBe('notBlocked');
    expect(
      reloadRefusalOf({ kind: 'refused', reason: 'surfaceOpen', surfaces: ['rawEditor'] })
    ).toBe('surfaceOpen');
    expect(rereadRefusalOf({ kind: 'completed' })).toBeNull();
    expect(
      rereadRefusalOf({ kind: 'failed', failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } })
    ).toBeNull();
    expect(rereadRefusalOf({ kind: 'refused', reason: 'surfaceOpen', at: 'installation' })).toBe(
      'surfaceOpen'
    );
    expect(retryRefusalOf({ kind: 'nothingRetained' })).toBe('nothingRetained');
    expect(retryRefusalOf({ kind: 'writeInFlight' })).toBe('writeInFlight');
    expect(acknowledgementRefusalOf({ kind: 'acknowledged' })).toBeNull();
    expect(acknowledgementRefusalOf({ kind: 'refused', reason: 'projectionReplaced' })).toBe(
      'projectionReplaced'
    );
  });
}); // End of the "press answered" suite

describe('empty-workspace retention (§3 entry 31, §5.2)', () => {
  it('keeps the panes over an empty list while any surface is open', () => {
    const composition = (documentCount: number, openSurfaces: readonly never[] | readonly ['recovery']) =>
      decideShellComposition({ status: 'ready', failed: false, documentCount, openSurfaces });
    expect(composition(0, [])).toBe('empty');
    expect(composition(0, ['recovery'])).toBe('panes');
    expect(composition(1, [])).toBe('panes');
  });

  it('answers loading and failed before anything else, exactly as the shell does', () => {
    expect(
      decideShellComposition({ status: 'loading', failed: false, documentCount: 0, openSurfaces: [] })
    ).toBe('loading');
    expect(
      decideShellComposition({ status: 'failed', failed: true, documentCount: 3, openSurfaces: [] })
    ).toBe('failed');
    // A `failed` status with no failure held falls through, as `AppShell.svelte`'s
    // `browser.failure !== null` condition does.
    expect(
      decideShellComposition({ status: 'failed', failed: false, documentCount: 0, openSurfaces: [] })
    ).toBe('empty');
  });

  it('draws the workspace banners in the empty state as well as beside the panes', () => {
    const drawn: Record<ShellComposition, boolean> = {
      loading: false,
      failed: false,
      empty: true,
      panes: true
    };
    for (const composition of Object.keys(drawn) as ShellComposition[]) {
      expect(workspaceBannersDrawnIn(composition), composition).toBe(drawn[composition]);
    }
  });

  it('keeps a removed file reachable through its surface when its row is gone', () => {
    // The last row removed, a surface still over it: the panes stay, the file is
    // still decided, and its state is `removed` in the header — never a row.
    const surfaces: readonly OpenWriteSurface[] = [
      { kind: 'rawEditor', target: { kind: 'document', document: 9 } }
    ];
    expect(filesToDecide({ documents: [], openWriteSurfaces: () => surfaces })).toEqual([9]);
    expect(
      decideShellComposition({ status: 'ready', failed: false, documentCount: 0, openSurfaces: ['rawEditor'] })
    ).toBe('panes');
    expect(
      decideFileReconciliation(
        workspace({ documentCount: 0, openSurfaces: ['rawEditor'] }),
        file({ hasRow: false, status: { kind: 'removed' }, surfaceOpen: true })
      ).states
    ).toEqual([{ state: { kind: 'removed' }, placements: ['header', 'selectionNotice'] }]);
  });
}); // End of the "empty-workspace retention" suite

/**
 * A reader answering fixed values, recording which readers were asked.
 *
 * @param asked - Where each reader's name is recorded when it is asked.
 * @returns The reader.
 */
function fixedReader(asked: string[]): ReconciliationStatusReader {
  const rows: readonly DocumentSummary[] = [makeSummary({ id: 1 }), makeSummary({ id: 2 })];
  return {
    status: 'ready',
    failure: null,
    documents: rows,
    openWriteSurfaces: () => {
      asked.push('openWriteSurfaces');
      return [
        { kind: 'matchCreator', target: { kind: 'unknown' } },
        { kind: 'restore', target: { kind: 'document', document: 5 } },
        { kind: 'rawEditor', target: { kind: 'document', document: 2 } }
      ];
    },
    writeInFlight: (document: DocumentId) => {
      asked.push(`writeInFlight:${document}`);
      return document === 5;
    },
    reconciliationWatchState: () => {
      asked.push('watch');
      return { kind: 'notWatched' };
    },
    reconciliationRegistration: () => {
      asked.push('registration');
      return { kind: 'failed', reason: 'noTransport' };
    },
    reconciliationBlock: () => {
      asked.push('block');
      return { kind: 'running' };
    },
    membershipReloadWanted: () => {
      asked.push('membership');
      return true;
    },
    externalPathDrift: () => {
      asked.push('drift');
      return [];
    },
    externalDocumentStatus: (document: DocumentId) => {
      asked.push(`status:${document}`);
      return document === 5 ? { kind: 'removed' } : null;
    },
    automaticReloadGuardFor: (document: DocumentId) => {
      asked.push(`guard:${document}`);
      return { uncertaintyUnresolved: document === 5, observationRetained: false, surfaceOpen: true };
    },
    uncertaintyAcknowledgementEligibility: (document: DocumentId) => {
      asked.push(`eligibility:${document}`);
      return { kind: 'ineligible', reason: 'noStandingOrigin' };
    }
  } as unknown as ReconciliationStatusReader;
} // End of function fixedReader()

describe('the adapters over BrowserState', () => {
  it('list every row, then every surface target no row names, without repetition', () => {
    expect(filesToDecide(fixedReader([]))).toEqual([1, 2, 5]);
  });

  it('read the workspace facts from their readers, and a write in flight to a surface’s file', () => {
    const asked: string[] = [];
    expect(workspaceFactsOf(fixedReader(asked))).toEqual({
      status: 'ready',
      failed: false,
      documentCount: 2,
      openSurfaces: ['matchCreator', 'restore', 'rawEditor'],
      writeInFlight: true,
      watch: { kind: 'notWatched' },
      registration: { kind: 'failed', reason: 'noTransport' },
      block: { kind: 'running' },
      membershipReloadWanted: true,
      pathDrift: []
    });
    expect(asked).toEqual(
      expect.arrayContaining(['watch', 'registration', 'block', 'membership', 'drift', 'writeInFlight:5'])
    );
  });

  it('read one file’s facts from its readers', () => {
    const asked: string[] = [];
    expect(fileFactsOf(fixedReader(asked), 5)).toEqual({
      hasRow: false,
      status: { kind: 'removed' },
      observationRetained: false,
      uncertaintyUnresolved: true,
      surfaceOpen: true,
      writeInFlight: true,
      acknowledgement: { kind: 'ineligible', reason: 'noStandingOrigin' }
    });
    expect(asked).toEqual(['guard:5', 'status:5', 'writeInFlight:5', 'eligibility:5']);
  });
}); // End of the "adapters" suite

/**
 * Commands answering an open with the given rows and refusing everything else.
 *
 * @param rows - What `list_documents` answers.
 * @returns The commands.
 */
function commandsListing(rows: readonly DocumentSummary[]): BrowserCommands {
  const refused = async (): Promise<CommandResult<never>> => ({
    ok: false,
    failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
  });
  const summary: WorkspaceSummary = {
    root: '/config',
    documents: rows.length,
    match_files: rows.length,
    config_files: 0
  } as unknown as WorkspaceSummary;
  return {
    openWorkspace: async () => ({ ok: true, value: summary }),
    listDocuments: async () => ({ ok: true, value: rows }),
    getDocument: async (id: DocumentId): Promise<CommandResult<DocumentView>> => ({
      ok: true,
      value: makeDocument({ id })
    }),
    getMatch: refused,
    reloadDocument: refused,
    documentText: refused,
    moveMatch: refused,
    saveMatch: refused,
    createMatch: refused,
    deleteMatch: refused,
    duplicateMatch: refused,
    saveRawDocument: refused,
    drainExternalChanges: refused
  } as unknown as BrowserCommands;
} // End of function commandsListing()

describe('the adapters over a real BrowserState', () => {
  it('decide the empty state, then the panes while a surface is open, then the empty state again', async () => {
    const state = createBrowserState(commandsListing([]), () => undefined);
    await state.open(null);
    const composition = (): ShellComposition => decideShellComposition(workspaceFactsOf(state));
    expect(state.status).toBe('ready');
    expect(composition()).toBe('empty');
    const lease = state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 1 } },
      () => undefined
    );
    // Closing nothing and listing nothing: the surface alone keeps the panes.
    expect(composition()).toBe('panes');
    expect(filesToDecide(state)).toEqual([1]);
    expect(fileFactsOf(state, 1)).toEqual({
      hasRow: false,
      status: null,
      observationRetained: false,
      uncertaintyUnresolved: false,
      surfaceOpen: true,
      writeInFlight: false,
      acknowledgement: { kind: 'ineligible', reason: 'noHold' }
    });
    lease();
    expect(composition()).toBe('empty');
  });

  it('decide a state built with no wake transport as a registration that failed, once started', async () => {
    const state = createBrowserState(commandsListing([makeSummary({ id: 1 })]), () => undefined);
    await state.open(null);
    expect(decideWorkspaceReconciliation(workspaceFactsOf(state)).states).toEqual([]);
    state.start();
    // The inert default source refuses; the rejection settles in a microtask.
    await Promise.resolve();
    await Promise.resolve();
    expect(decideWorkspaceReconciliation(workspaceFactsOf(state)).states).toEqual([
      { kind: 'registrationFailed', reason: 'noTransport' }
    ]);
    state.dispose();
  });
}); // End of the "real BrowserState" suite
