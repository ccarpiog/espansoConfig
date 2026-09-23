/**
 * Runtime checks on the reconciliation-status accessors and the reviewed wording
 * behind them — Phase 2d-6-9a.
 *
 * The compile-time half is in `../browser/reconciliationStatus.ts`: every key
 * function returns a `TranslationKey` chosen by a `switch` with a `never` terminus,
 * so a state, control or refusal with no dictionary entry fails `svelte-check`
 * there. **The Rust half does not exist for these**: `dictionary_contract.rs`
 * compares the `code.` namespace alone, and `browser.reconciliation.*` and
 * `browser.externalDocument.*` are frontend state — which is why this file calls
 * every accessor in both locales rather than trusting parity.
 *
 * ## What the literal expectations are, and what they are not
 *
 * The record's §3 entry 40 asks for seven semantic bounds pinned in reviewed EN/ES
 * strings. The cases below pin the five this step's sentences carry — stale, not
 * watched, a failed registration, removed, the unknown outcome — literally, in both
 * languages, and the word scans pin them as *absences* (a sentence without
 * "deleted" cannot claim a deletion). **A literal fixture protects approved wording
 * and nothing else**: it cannot fail when the wording is wrong or — for the
 * Spanish — not Spanish. The Spanish was written by the implementer and has had no
 * bilingual review; the expectation pins that draft so a reviewer's correction is a
 * deliberate edit to two files rather than a silent one to one.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  fileReconciliationStateKey,
  reconciliationControlKey,
  reconciliationRefusalKey,
  routeControlNoteKey,
  workspaceReconciliationStateKey,
  type FileReconciliationState,
  type FileStatePlacement,
  type ReconciliationControl,
  type ReconciliationRefusal,
  type RouteControlNote,
  type WorkspaceReconciliationState
} from '../browser/reconciliationStatus';
import {
  describeReconciliationControl,
  describeReconciliationFileState,
  describeReconciliationRefusal,
  describeReconciliationRouteNote,
  describeReconciliationWorkspaceState
} from './codes';
import { DICTIONARIES, type TranslationKey } from './dictionaries';
import type { ExpectNever, Missing } from './exhaustive';
import {
  tReconciliationControl,
  tReconciliationFileState,
  tReconciliationRefusal,
  tReconciliationRouteNote,
  tReconciliationWorkspaceState
} from './index';
import { DEFAULT_LOCALE, LOCALES } from './locale';

/** One sample of every workspace banner, every detail and every reason covered. */
const WORKSPACE_STATES: readonly WorkspaceReconciliationState[] = [
  { kind: 'pathDrift', relativePath: 'match/drift.yml', detail: { kind: 'changed' } },
  { kind: 'pathDrift', relativePath: 'match/drift.yml', detail: { kind: 'removed' } },
  {
    kind: 'pathDrift',
    relativePath: 'match/drift.yml',
    detail: { kind: 'unreadable', reason: { PermissionDenied: {} } }
  },
  { kind: 'notWatched' },
  { kind: 'registrationFailed', reason: 'noTransport' },
  { kind: 'registrationFailed', reason: 'rejected' },
  { kind: 'lostHistory' },
  { kind: 'membershipReloadWanted' }
];

/** The banner kinds, pinned to the union. */
const WORKSPACE_KINDS = [
  'pathDrift',
  'notWatched',
  'registrationFailed',
  'lostHistory',
  'membershipReloadWanted'
] as const satisfies readonly WorkspaceReconciliationState['kind'][];

/** One sample of every per-file state. */
const FILE_STATES: readonly FileReconciliationState[] = [
  { kind: 'stale' },
  { kind: 'unavailable', reason: { NotUtf8: { offset: 3 } } },
  { kind: 'removed' },
  { kind: 'observationRetained' },
  { kind: 'writeOutcomeUnknown' }
];

/** The per-file kinds, pinned to the union. */
const FILE_KINDS = [
  'stale',
  'unavailable',
  'removed',
  'observationRetained',
  'writeOutcomeUnknown'
] as const satisfies readonly FileReconciliationState['kind'][];

/** Every placement, pinned to the union. */
const PLACEMENTS = [
  'sidebarRow',
  'header',
  'selectionNotice',
  'surface',
  'workspaceRoute'
] as const satisfies readonly FileStatePlacement[];

/** Every control, pinned to the union. */
const CONTROLS = [
  'membershipReload',
  'lostHistoryRecovery',
  'staleFileReread',
  'retryRetainedObservation',
  'acknowledgeUncertainty'
] as const satisfies readonly ReconciliationControl[];

/** Every refusal, pinned to the union. */
const REFUSALS = [
  'disposed',
  'workspaceNotReady',
  'writeInFlight',
  'surfaceOpen',
  'notBlocked',
  'notAddressable',
  'blockedByLostHistory',
  'uncertaintyUnresolved',
  'observationRetained',
  'nothingRetained',
  'unknown',
  'spent',
  'workspaceReplaced',
  'superseded',
  'projectionReplaced',
  'holdMoved'
] as const satisfies readonly ReconciliationRefusal[];

// `never` exactly when each table names every member of its union.
export type _WorkspaceKindsAreComplete = ExpectNever<
  Missing<WorkspaceReconciliationState['kind'], typeof WORKSPACE_KINDS>
>;
export type _FileKindsAreComplete = ExpectNever<
  Missing<FileReconciliationState['kind'], typeof FILE_KINDS>
>;
export type _PlacementsAreComplete = ExpectNever<Missing<FileStatePlacement, typeof PLACEMENTS>>;
export type _ControlsAreComplete = ExpectNever<Missing<ReconciliationControl, typeof CONTROLS>>;
export type _RefusalsAreComplete = ExpectNever<Missing<ReconciliationRefusal, typeof REFUSALS>>;

/** Every route note, pinned to the union (Phase 2d-6-9b-1). */
const ROUTE_NOTES = ['projectionReplacedExits'] as const satisfies readonly RouteControlNote[];

export type _RouteNotesAreComplete = ExpectNever<Missing<RouteControlNote, typeof ROUTE_NOTES>>;

/**
 * Every key this step's key functions can return.
 *
 * @returns The keys, without repetition.
 */
function everyKey(): readonly TranslationKey[] {
  const keys = new Set<TranslationKey>();
  for (const state of WORKSPACE_STATES) {
    keys.add(workspaceReconciliationStateKey(state));
  }
  for (const state of FILE_STATES) {
    for (const placement of PLACEMENTS) {
      keys.add(fileReconciliationStateKey(state, placement));
    }
  }
  for (const control of CONTROLS) {
    keys.add(reconciliationControlKey(control));
  }
  for (const refusal of REFUSALS) {
    keys.add(reconciliationRefusalKey(refusal));
  }
  for (const note of ROUTE_NOTES) {
    keys.add(routeControlNoteKey(note));
  }
  return [...keys];
} // End of function everyKey()

/**
 * Asserts one rendered sentence has no gap, no leaked placeholder and no raw code.
 *
 * @param rendered - The sentence.
 * @param label - What to name in a failure.
 */
function expectWhole(rendered: string, label: string): void {
  expect(rendered.trim(), label).not.toBe('');
  expect(rendered, label).not.toContain('undefined');
  expect(rendered, label).not.toContain('{');
  expect(rendered, label).not.toContain('browser.');
} // End of function expectWhole()

describe('the reconciliation-status accessors', () => {
  it.each(LOCALES)('render every banner in %s, with the display path as its only operand', (locale) => {
    for (const state of WORKSPACE_STATES) {
      const rendered = describeReconciliationWorkspaceState(locale, state);
      expectWhole(rendered, `${locale}:${state.kind}`);
      if (state.kind === 'pathDrift') {
        expect(rendered, `${locale}:${state.detail.kind}`).toContain('match/drift.yml');
      }
    } // End of the loop over the banners
  });

  it.each(LOCALES)('render every per-file state at every placement in %s', (locale) => {
    for (const state of FILE_STATES) {
      for (const placement of PLACEMENTS) {
        expectWhole(
          describeReconciliationFileState(locale, state, placement),
          `${locale}:${state.kind}@${placement}`
        );
      }
    } // End of the loop over the per-file states
  });

  it.each(LOCALES)('render every control and every refusal in %s', (locale) => {
    for (const control of CONTROLS) {
      expectWhole(describeReconciliationControl(locale, control), `${locale}:${control}`);
    }
    for (const refusal of REFUSALS) {
      expectWhole(describeReconciliationRefusal(locale, refusal), `${locale}:${refusal}`);
    }
    for (const note of ROUTE_NOTES) {
      expectWhole(describeReconciliationRouteNote(locale, note), `${locale}:${note}`);
    }
  });

  it('give a row its short mark for the two states placed there, and the header its sentence', () => {
    // Phase 2d-6-9b-1: a sidebar row is one line, so `stale` and `unavailable` read as
    // a short mark there and as the whole sentence everywhere else.
    expect(fileReconciliationStateKey({ kind: 'stale' }, 'sidebarRow')).toBe(
      'browser.externalDocument.row.stale'
    );
    expect(fileReconciliationStateKey({ kind: 'stale' }, 'header')).toBe(
      'browser.externalDocument.stale'
    );
    const unavailable: FileReconciliationState = {
      kind: 'unavailable',
      reason: { NotUtf8: { offset: 3 } }
    };
    expect(fileReconciliationStateKey(unavailable, 'sidebarRow')).toBe(
      'browser.externalDocument.row.unavailable'
    );
    expect(fileReconciliationStateKey(unavailable, 'header')).toBe(
      'browser.externalDocument.unavailable'
    );
    expect(DICTIONARIES.en['browser.externalDocument.row.stale']).toBe('Not reconciled');
    expect(DICTIONARIES.es['browser.externalDocument.row.stale']).toBe('Sin conciliar');
  });

  it('give every refusal and every control its own sentence', () => {
    const refusalKeys = REFUSALS.map(reconciliationRefusalKey);
    expect(new Set(refusalKeys).size).toBe(REFUSALS.length);
    const controlKeys = CONTROLS.map(reconciliationControlKey);
    expect(new Set(controlKeys).size).toBe(CONTROLS.length);
  });

  it('let a registration failure never leak what the subscription rejected with', () => {
    // The sanitized reason is a code; no operand exists to carry an `Error`.
    for (const locale of LOCALES) {
      for (const reason of ['noTransport', 'rejected'] as const) {
        const rendered = describeReconciliationWorkspaceState(locale, {
          kind: 'registrationFailed',
          reason
        });
        expect(rendered).not.toMatch(/error|Error|noTransport|rejected/);
      }
    } // End of the loop over the two locales
  });

  it('draw the uncertain write differently on the route, where no snapshot is drawn', () => {
    const state: FileReconciliationState = { kind: 'writeOutcomeUnknown' };
    expect(fileReconciliationStateKey(state, 'surface')).toBe(
      'browser.externalConflict.writeOutcomeUnknown'
    );
    expect(fileReconciliationStateKey(state, 'workspaceRoute')).toBe(
      'browser.externalConflict.route.writeOutcomeUnknown'
    );
    for (const locale of LOCALES) {
      const route = describeReconciliationFileState(locale, state, 'workspaceRoute');
      expect(route.toLowerCase()).not.toMatch(/snapshot|instantánea/);
    }
  });

  it('render through the reactive wrappers in the default locale', () => {
    expect(tReconciliationWorkspaceState({ kind: 'notWatched' })).toBe(
      describeReconciliationWorkspaceState(DEFAULT_LOCALE, { kind: 'notWatched' })
    );
    expect(tReconciliationFileState({ kind: 'stale' }, 'header')).toBe(
      describeReconciliationFileState(DEFAULT_LOCALE, { kind: 'stale' }, 'header')
    );
    expect(tReconciliationControl('staleFileReread')).toBe(
      describeReconciliationControl(DEFAULT_LOCALE, 'staleFileReread')
    );
    expect(tReconciliationRefusal('surfaceOpen')).toBe(
      describeReconciliationRefusal(DEFAULT_LOCALE, 'surfaceOpen')
    );
    expect(tReconciliationRouteNote('projectionReplacedExits')).toBe(
      describeReconciliationRouteNote(DEFAULT_LOCALE, 'projectionReplacedExits')
    );
  });
}); // End of the "reconciliation-status accessors" suite

describe('the seven semantic bounds, as literal reviewed wording (entry 40)', () => {
  it('pin the stale sentence: it needs reconciliation, and says nothing of what or who', () => {
    expect(DICTIONARIES.en['browser.externalDocument.stale']).toBe(
      'What this window shows of this file has not been reconciled with the file on disk.'
    );
    expect(DICTIONARIES.es['browser.externalDocument.stale']).toBe(
      'Lo que esta ventana muestra de este archivo no se ha conciliado con el archivo del disco.'
    );
  });

  it('pin the not-watched sentence: no coverage implied', () => {
    expect(DICTIONARIES.en['browser.reconciliation.notWatched']).toBe(
      'Automatic watching is unavailable for this workspace. Changes made to its files outside this app are not detected here.'
    );
    expect(DICTIONARIES.es['browser.reconciliation.notWatched']).toBe(
      'La vigilancia automática no está disponible para este espacio de trabajo. Los cambios que se hagan en sus archivos fuera de esta aplicación no se detectan aquí.'
    );
  });

  it('pin the failed-registration sentences: subscribing failed, never that observation stopped', () => {
    expect(DICTIONARIES.en['browser.reconciliation.registrationFailed.rejected']).toBe(
      'This window could not subscribe to change notifications, so it is not told when a file changes on disk.'
    );
    expect(DICTIONARIES.es['browser.reconciliation.registrationFailed.rejected']).toBe(
      'Esta ventana no pudo suscribirse a los avisos de cambios, así que no se le avisa cuando un archivo cambia en el disco.'
    );
    for (const key of [
      'browser.reconciliation.registrationFailed.rejected',
      'browser.reconciliation.registrationFailed.noTransport'
    ] as const) {
      expect(DICTIONARIES.en[key].toLowerCase()).not.toMatch(/stopped|dead|no longer watch/);
      expect(DICTIONARIES.es[key].toLowerCase()).not.toMatch(/detenid|muert|dejado de vigilar/);
    }
  });

  it('pin the removed sentence: no longer present in the observed workspace, never deleted', () => {
    expect(DICTIONARIES.en['browser.externalDocument.removed']).toBe(
      'This file is no longer present in the observed workspace.'
    );
    expect(DICTIONARIES.es['browser.externalDocument.removed']).toBe(
      'Este archivo ya no está presente en el espacio de trabajo observado.'
    );
  });

  it('pin the route’s unknown-outcome sentence: an unknown outcome, never a failure or a success', () => {
    expect(DICTIONARIES.en['browser.externalConflict.route.writeOutcomeUnknown']).toBe(
      'The outcome of an earlier write to this file is unknown, and the panel it was made from has closed.'
    );
    expect(DICTIONARIES.es['browser.externalConflict.route.writeOutcomeUnknown']).toBe(
      'Se desconoce el resultado de una escritura anterior en este archivo, y el panel desde el que se hizo se ha cerrado.'
    );
  });

  it('pin the supersession refusal: accepted evidence changed, not that the disk is newer', () => {
    expect(DICTIONARIES.en['browser.reconciliation.refusal.superseded']).toBe(
      'This panel’s evidence has been superseded by another accepted reading.'
    );
    expect(DICTIONARIES.es['browser.reconciliation.refusal.superseded']).toBe(
      'Las pruebas de este panel han quedado sustituidas por otra lectura aceptada.'
    );
  });

  it('never claim a deletion, a newer disk, a merge, a save or a failed or finished write', () => {
    // The absences entry 40 and the consult's Q5 list, over every sentence this
    // step's keys reach — the surface's reused sentences included. A write's
    // outcome is scanned as a claim only: *whether that write completed* asks, and
    // is allowed.
    const forbidden: Readonly<Record<(typeof LOCALES)[number], RegExp>> = {
      en: /\bdeleted\b|\bnewer\b|\bmerged\b|\bsaved\b|write (failed|succeeded)/,
      es: /\bborrad|\beliminad|más reciente|\bfusionad|\bguardad|escritura (falló|fracasó)/
    };
    for (const locale of LOCALES) {
      for (const key of everyKey()) {
        expect(DICTIONARIES[locale][key].toLowerCase(), `${locale}:${key}`).not.toMatch(
          forbidden[locale]
        );
      }
    } // End of the loop over the two locales
  });

  it('keep that word scan capable of firing', () => {
    expect('the file was deleted').toMatch(/\bdeleted\b/);
    expect('el archivo se ha borrado').toMatch(/\bborrad/);
  });
}); // End of the "seven semantic bounds" suite

describe('the route’s wording after Phase 2d-6-9b-1', () => {
  it('pin the exits note: the two exits the route really has, and no observation among them', () => {
    // Measured, not assumed: with no surface over the file, the coordinator's
    // automatic reread installs a later observation instead of registering it as an
    // origin, so on the route a new observation is not an exit.
    expect(DICTIONARIES.en['browser.reconciliation.route.projectionReplacedExits']).toBe(
      'Acknowledging stays unavailable here until a later write to this file from this window ends with a known outcome, or the workspace is reloaded.'
    );
    expect(DICTIONARIES.es['browser.reconciliation.route.projectionReplacedExits']).toBe(
      'Aquí el reconocimiento seguirá sin estar disponible hasta que una escritura posterior en este archivo desde esta ventana termine con un resultado conocido o hasta que se recargue el espacio de trabajo.'
    );
    for (const locale of LOCALES) {
      expect(
        DICTIONARIES[locale]['browser.reconciliation.route.projectionReplacedExits'].toLowerCase()
      ).not.toMatch(/observ/);
    }
  });

  it('never claim on the route that the window stops reading the file on its own', () => {
    // The 9a sentence said so and the automatic path does reread under an
    // uncertainty hold (`2d-6-9b-1-notes.md`); the claim is gone from both locales.
    expect(DICTIONARIES.en['browser.externalConflict.route.writeOutcomeUnknown']).not.toMatch(
      /on its own|again/
    );
    expect(DICTIONARIES.es['browser.externalConflict.route.writeOutcomeUnknown']).not.toMatch(
      /por su cuenta|vuelve a leer/
    );
  });
}); // End of the "route's wording" suite
