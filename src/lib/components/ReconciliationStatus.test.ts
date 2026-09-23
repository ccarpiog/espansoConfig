/** @vitest-environment jsdom */

/**
 * The reconciliation status, mounted — Phase 2d-6-9b-1, the sidebar/status suite
 * the 2d-6 record's §3 entry 34 names and entry 37 requires to declare its guard.
 *
 * **What is mounted is the three drawings over one real `BrowserState`**:
 * `ReconciliationStatus.svelte` (the workspace banners and the workspace route,
 * which `AppShell.svelte` mounts), `Sidebar.svelte` (the row marks) and
 * `DetailPane.svelte` (the header block, through `FileReconciliationStatus.svelte`).
 * The state is built by `createBrowserState` over scripted commands and a scripted
 * wake transport, so every state below is reached through the real coordinator,
 * the real tables and the real requests — never through a prop a test handed in.
 * `AppShell.svelte` builds its own state over the real boundary, so the shell's own
 * composition (the banners drawn in the empty state) is `AppShell.test.ts`'s.
 *
 * **The invoke guard (entry 37).** `@tauri-apps/api/core` is replaced by a spy that
 * rejects, and the `afterEach` holds it to **exact zero** in every case (entry 36):
 * every command reaches a scripted `vi.fn`, whose counts the cases assert, and a
 * binding that reached the real boundary would be the defect. The backup surface is
 * injected for the reason `DetailPane.test.ts` gives: its default is real.
 *
 * **Bilingual (entry 35).** Every interaction case runs once per locale and asserts
 * the drawn sentences and labels in that locale's dictionary. One case switches the
 * locale on a mounted status panel and asserts the words changed and nothing else
 * did: no command, no drain, the same facts. **What this suite cannot show** is a
 * window: a mounted test proves a handler fires and a sentence is in the DOM, not
 * what a WKWebView draws (`CLAUDE.md` §6); that is 2d-6-9c's reading.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalConflictObservation } from '../browser/conflictSource';
import { makeDocument, makeSummary } from '../browser/fixtures';
import { conflictChoiceKey } from '../browser/saveOutcome';
import {
  decideWorkspaceReconciliation,
  fileFactsOf,
  workspaceFactsOf
} from '../browser/reconciliationStatus';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type { CommandResult, RawSaveOutcome } from '../ipc/commands';
import type {
  ReconciliationEventSource,
  ReconciliationUnlisten,
  ReconciliationWakeHandler
} from '../ipc/events';
import type {
  DocumentId,
  DocumentSummary,
  DocumentView,
  ExternalObservation,
  ReconciliationBatch,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import DetailPane from './DetailPane.svelte';
import ReconciliationStatus from './ReconciliationStatus.svelte';
import Sidebar from './Sidebar.svelte';

/** The Tauri boundary, replaced and held at exact zero (entries 36 and 37). */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

/** The two files every case opens. */
const FILES: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'match/a.yml' }),
  makeSummary({ id: 2, relativePath: 'match/b.yml' })
];

/** What `open_workspace` answers. */
const SUMMARY = {
  root: '/tmp/espanso',
  documents: 2,
  match_files: 2,
  config_profiles: 0,
  packages: 0,
  disabled: 0
} as WorkspaceSummary;

/** The refusal every unscripted command answers. */
const REFUSED: CommandResult<never> = {
  ok: false,
  failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
};

/** A raw save that failed after the rename may have happened (`workspace.test.ts`'s fixture). */
const WRITE_MAY_HAVE_HAPPENED = {
  ok: false,
  failure: {
    kind: 'command',
    error: {
      code: 'saveFailed',
      error: {
        Write: {
          Io: {
            step: 'SyncDirectory',
            path: '/tmp/espanso/match/b.yml',
            kind: 'Interrupted',
            raw_os_error: 4
          }
        }
      },
      may_have_written: true
    }
  }
} as unknown as RawSaveOutcome;

/** The disk text every observation and conflict in this file carries. */
const DISK_TEXT = 'matches:\n  - trigger: ":disk"\n    replace: ondisk\n';

/**
 * A raw save of file 2 refused as a conflict: another writer left `rev-c`.
 *
 * @returns The command's answer.
 */
function conflictOnB(): RawSaveOutcome {
  const disk = makeDocument({ id: 2, relativePath: 'match/b.yml', revision: 'rev-c', matches: [] });
  const value: SaveResult = {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected: 'rev-a',
    found: 'rev-c',
    disk_revision: 'rev-c',
    disk_text: DISK_TEXT,
    disk
  } as unknown as SaveResult;
  return { ok: true, value, reload: { kind: 'notOwed' } };
} // End of function conflictOnB()

/** What one case scripts. */
interface Script {
  /** The drains' answers, in order; past the end the drain refuses. */
  readonly batches?: CommandResult<ReconciliationBatch>[];
  /** The raw saves' answers, in order; past the end the save refuses. */
  readonly saves?: Promise<RawSaveOutcome>[];
}

/**
 * The commands, every one a `vi.fn` so a case can count it.
 *
 * @param script - What the drains and raw saves answer.
 * @returns The commands.
 */
function scripted(script: Script = {}): BrowserCommands {
  const batches = [...(script.batches ?? [])];
  const saves = [...(script.saves ?? [])];
  /**
   * One file's projection at one revision.
   *
   * @param id - The file.
   * @param revision - The revision.
   * @returns The projection.
   */
  const viewOf = (id: number, revision = 'rev-a'): DocumentView => {
    const row = FILES.find((each) => each.id === id);
    return makeDocument({ id, relativePath: row?.relative_path ?? 'match/x.yml', revision });
  };
  return {
    openWorkspace: vi.fn(async () => ({ ok: true as const, value: SUMMARY })),
    listDocuments: vi.fn(async () => ({ ok: true as const, value: FILES })),
    getDocument: vi.fn(async (id: number) => ({ ok: true as const, value: viewOf(id) })),
    getMatch: vi.fn(async () => REFUSED),
    reloadDocument: vi.fn(async (id: number) => ({ ok: true as const, value: viewOf(id, 'rev-r') })),
    documentText: vi.fn(async () => ({ ok: true as const, value: 'matches: []\n' })),
    moveMatch: vi.fn(async () => REFUSED),
    saveMatch: vi.fn(async () => REFUSED),
    createMatch: vi.fn(async () => REFUSED),
    deleteMatch: vi.fn(async () => REFUSED),
    duplicateMatch: vi.fn(async () => REFUSED),
    saveRawDocument: vi.fn(async () => (await saves.shift()) ?? REFUSED),
    drainExternalChanges: vi.fn(async () => batches.shift() ?? REFUSED)
  } as unknown as BrowserCommands;
} // End of function scripted()

/** A backup surface that refuses; no case here opens a restore. */
const BACKUP: BackupCommands = {
  listBackupBatches: vi.fn(async () => REFUSED),
  listBackupEntries: vi.fn(async () => REFUSED),
  readBackupText: vi.fn(async () => REFUSED)
};

/** A wake transport and the handle that wakes the window. */
interface Events {
  /** What `createBrowserState` is given. */
  readonly source: ReconciliationEventSource;
  /** Delivers one wake for epoch 5. */
  wake(newest: number): void;
}

/**
 * A wake transport whose registration resolves at once, or is rejected.
 *
 * @param rejected - Whether subscribing is refused.
 * @returns The transport.
 */
function events(rejected = false): Events {
  let handler: ReconciliationWakeHandler | null = null;
  /** Ends the subscription; nothing here counts it. */
  const unlisten: ReconciliationUnlisten = () => undefined;
  return {
    source: {
      /**
       * Registers the handler.
       *
       * @param wakeHandler - Where a wake goes.
       * @returns The unlisten, or a refusal.
       */
      subscribe(wakeHandler: ReconciliationWakeHandler): Promise<ReconciliationUnlisten> {
        handler = wakeHandler;
        return rejected ? Promise.reject(new Error('listen refused')) : Promise.resolve(unlisten);
      }
    },
    wake: (newest: number): void => {
      handler?.({ workspace_epoch: 5, newest_sequence: newest });
    }
  };
} // End of function events()

/**
 * One drained batch.
 *
 * @param newest - Its newest sequence.
 * @param observations - What it carries.
 * @param epoch - Its epoch.
 * @param discarded - How many observations the queue dropped this epoch.
 * @returns The command's answer.
 */
function batch(
  newest: number,
  observations: readonly ExternalObservation[] = [],
  epoch = 5,
  discarded = 0
): CommandResult<ReconciliationBatch> {
  return { ok: true, value: { epoch, newest_sequence: newest, observations: [...observations], discarded } };
} // End of function batch()

/**
 * A narrowed observation of file 2, as the window narrows one.
 *
 * @param sequence - Its sequence.
 * @returns The observation.
 */
function observationOfB(sequence: number): ExternalConflictObservation {
  return {
    sequence,
    document: 2,
    previousRevision: 'rev-a',
    diskRevision: 'rev-c',
    diskText: DISK_TEXT,
    disk: makeDocument({ id: 2, relativePath: 'match/b.yml', revision: 'rev-c' }),
    findings: [],
    correspondences: null
  } as ExternalConflictObservation;
} // End of function observationOfB()

/** The three drawings over one state, and the call that tears them down. */
interface Mounted {
  /** The state. */
  readonly state: BrowserState;
  /** Its commands. */
  readonly commands: BrowserCommands;
  /** Where the banners and the route are drawn. */
  readonly status: HTMLElement;
  /** Where the sidebar is drawn. */
  readonly sidebar: HTMLElement;
  /** Where the detail pane is drawn. */
  readonly pane: HTMLElement;
  /** Unmounts all three and disposes the state. */
  readonly stop: () => void;
}

/** Every mount a case made and has not stopped; the `afterEach` stops the rest. */
const live = new Set<Mounted>();

/**
 * Lets every pending microtask and one macrotask run, then flushes.
 */
async function settle(): Promise<void> {
  await new Promise((done) => setTimeout(done, 0));
  await new Promise((done) => setTimeout(done, 0));
  flushSync();
} // End of function settle()

/**
 * Builds the state, runs the lifecycle in `AppShell.svelte`'s order, and mounts the
 * three drawings over it.
 *
 * @param script - What the commands answer.
 * @param transport - The wake transport, or `null` for a state never started.
 * @returns The mounted drawings.
 */
async function mountAll(script: Script = {}, transport: Events | null = null): Promise<Mounted> {
  const commands = scripted(script);
  const state =
    transport === null
      ? createBrowserState(commands, () => undefined, BACKUP)
      : createBrowserState(commands, () => undefined, BACKUP, transport.source);
  if (transport !== null) {
    state.start();
    await settle();
  }
  await state.open(null);
  await settle();
  /**
   * One fresh element in the document.
   *
   * @returns It.
   */
  const fresh = (): HTMLElement => {
    const target = document.createElement('div');
    document.body.append(target);
    return target;
  };
  const status = fresh();
  const sidebar = fresh();
  const pane = fresh();
  const targets = [status, sidebar, pane];
  const components = [
    mount(ReconciliationStatus, { target: status, props: { browser: state } }),
    mount(Sidebar, { target: sidebar, props: { browser: state } }),
    mount(DetailPane, { target: pane, props: { browser: state } })
  ];
  flushSync();
  const mounted: Mounted = {
    state,
    commands,
    status,
    sidebar,
    pane,
    stop: () => {
      live.delete(mounted);
      for (const component of components) {
        void unmount(component);
      }
      for (const target of targets) {
        target.remove();
      }
      state.dispose();
    }
  };
  live.add(mounted);
  return mounted;
} // End of function mountAll()

/**
 * One key's sentence in one locale.
 *
 * @param lang - The locale.
 * @param key - The key.
 * @param params - Its operands.
 * @returns The sentence.
 */
function words(lang: Locale, key: TranslationKey, params?: Record<string, string>): string {
  return translate(lang, key, params);
} // End of function words()

/**
 * The button labelled with one key in one locale, or `null`.
 *
 * @param target - Where to look.
 * @param lang - The locale.
 * @param key - The label's key.
 * @returns The button, or `null`.
 */
function buttonIn(target: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement | null {
  const label = DICTIONARIES[lang][key];
  return (
    [...target.querySelectorAll('button')].find((each) => each.textContent?.trim() === label) ?? null
  );
} // End of function buttonIn()

/**
 * The button labelled with one key, which must be drawn.
 *
 * @param target - Where to look.
 * @param lang - The locale.
 * @param key - The label's key.
 * @returns The button.
 */
function button(target: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement {
  const found = buttonIn(target, lang, key);
  if (found === null) {
    throw new Error(`this case needs the control labelled ${DICTIONARIES[lang][key]}`);
  }
  return found;
} // End of function button()

/**
 * How many times every command was called, by name.
 *
 * @param commands - The scripted commands.
 * @returns The counts.
 */
function callCounts(commands: BrowserCommands): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [name, command] of Object.entries(commands)) {
    counts[name] = (command as ReturnType<typeof vi.fn>).mock.calls.length;
  }
  return counts;
} // End of function callCounts()

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const mounted of [...live]) {
    mounted.stop();
  }
  locale.setOverride(null);
  vi.restoreAllMocks();
  // The guard, file-wide: nothing reached the real boundary.
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

describe.each(LOCALES)('the workspace banners and their two controls, in %s', (lang) => {
  beforeEach(() => {
    locale.setOverride(lang);
  });

  it('draws a path drift and a wanted membership reload, and reloads on the press', async () => {
    const transport = events();
    const drifted: ExternalObservation = {
      Changed: {
        sequence: 1,
        document: { Unnamed: { relative_path: 'match/stranger.yml' } },
        previous_revision: null,
        disk_revision: 'rev-s',
        content: {
          Projected: {
            disk_text: DISK_TEXT,
            disk: makeDocument({ id: 9, relativePath: 'match/stranger.yml', revision: 'rev-s' }),
            findings: [],
            correspondences: null
          }
        }
      }
    } as unknown as ExternalObservation;
    const view = await mountAll({ batches: [batch(0), batch(0), batch(1, [drifted])] }, transport);
    transport.wake(1);
    await settle();

    const text = view.status.textContent ?? '';
    expect(text).toContain(
      words(lang, 'browser.externalDocument.pathDrift.changed', { path: 'match/stranger.yml' })
    );
    expect(text).toContain(words(lang, 'browser.reconciliation.membershipReloadWanted'));
    const reload = button(view.status, lang, 'browser.reconciliation.action.membershipReload');
    expect(reload.disabled).toBe(false);
    expect(view.commands.openWorkspace).toHaveBeenCalledTimes(1);

    reload.click();
    await settle();
    // One request, which reran the retained open and cleared the flag.
    expect(view.commands.openWorkspace).toHaveBeenCalledTimes(2);
    expect(view.status.textContent).not.toContain(
      words(lang, 'browser.reconciliation.membershipReloadWanted')
    );
  });

  it('disables the reload while a surface is open, and closing it permits without triggering', async () => {
    const transport = events();
    const drifted = {
      Removed: {
        sequence: 1,
        document: { Unnamed: { relative_path: 'match/gone.yml' } },
        previous_revision: null
      }
    } as unknown as ExternalObservation;
    const view = await mountAll({ batches: [batch(0), batch(0), batch(1, [drifted])] }, transport);
    const lease = view.state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 1 } },
      () => undefined
    );
    transport.wake(1);
    await settle();

    const reload = button(view.status, lang, 'browser.reconciliation.action.membershipReload');
    expect(reload.disabled).toBe(true);
    expect(view.status.textContent).toContain(words(lang, 'browser.reconciliation.refusal.surfaceOpen'));

    lease();
    flushSync();
    expect(button(view.status, lang, 'browser.reconciliation.action.membershipReload').disabled).toBe(
      false
    );
    await settle();
    // Permitted, and nothing pressed it: no second open.
    expect(view.commands.openWorkspace).toHaveBeenCalledTimes(1);
  });

  it('draws lost history with its recovery held by an open surface, then recovers on the press', async () => {
    const transport = events();
    const view = await mountAll({ batches: [batch(0), batch(0), batch(1, [], 5, 3)] }, transport);
    const lease = view.state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 1 } },
      () => undefined
    );
    transport.wake(1);
    await settle();

    expect(view.status.textContent).toContain(words(lang, 'browser.reconciliation.lostHistory'));
    expect(
      button(view.status, lang, 'browser.reconciliation.action.lostHistoryRecovery').disabled
    ).toBe(true);
    lease();
    flushSync();
    button(view.status, lang, 'browser.reconciliation.action.lostHistoryRecovery').click();
    await settle();
    expect(view.commands.openWorkspace).toHaveBeenCalledTimes(2);
    expect(view.status.textContent).not.toContain(words(lang, 'browser.reconciliation.lostHistory'));
  });

  it('draws an unwatched workspace and a refused subscription, each with no control', async () => {
    const unwatched = await mountAll({ batches: [batch(0, [], 0), batch(0, [], 0)] }, events());
    expect(unwatched.status.textContent).toContain(words(lang, 'browser.reconciliation.notWatched'));
    expect(unwatched.status.querySelectorAll('button')).toHaveLength(0);
    unwatched.stop();

    const refused = await mountAll({}, events(true));
    expect(refused.status.textContent).toContain(
      words(lang, 'browser.reconciliation.registrationFailed.rejected')
    );
    expect(refused.status.querySelectorAll('button')).toHaveLength(0);
  });
}); // End of the per-locale banner suite

describe.each(LOCALES)('the per-file states and their three controls, in %s', (lang) => {
  beforeEach(() => {
    locale.setOverride(lang);
  });

  it('marks a file stale after a refused save, and the reread clears the row and the header', async () => {
    // The orchestrator's ruling on `stale` (Phase 2d-6-9b-1), drawn.
    const view = await mountAll({ saves: [Promise.resolve(conflictOnB())] });
    view.state.show({ kind: 'document', id: 2 });
    await view.state.showFileText(true);
    await view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    await settle();

    expect(view.sidebar.textContent).toContain(words(lang, 'browser.externalDocument.row.stale'));
    expect(view.pane.textContent).toContain(words(lang, 'browser.externalDocument.stale'));
    const reread = button(view.pane, lang, 'browser.externalDocument.action.reread');
    expect(reread.disabled).toBe(false);
    const reloadsBefore = (view.commands.reloadDocument as ReturnType<typeof vi.fn>).mock.calls.length;

    reread.click();
    await settle();
    expect(view.commands.reloadDocument).toHaveBeenCalledTimes(reloadsBefore + 1);
    expect(view.state.externalDocumentStatus(2)).toBeNull();
    expect(view.sidebar.textContent).not.toContain(words(lang, 'browser.externalDocument.row.stale'));
    expect(view.pane.textContent).not.toContain(words(lang, 'browser.externalDocument.stale'));
  });

  it('reaches a stale file’s header and reread from its sidebar row alone, with no snippet or text shown', async () => {
    // The fix round (review finding 2): picking the marked row is enough.
    const view = await mountAll({ saves: [Promise.resolve(conflictOnB())] });
    await view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    await settle();
    expect(view.pane.textContent).not.toContain(words(lang, 'browser.externalDocument.stale'));

    const row = [...view.sidebar.querySelectorAll('button')].find((each) =>
      each.textContent?.includes('match/b.yml')
    );
    row?.click();
    flushSync();
    expect(view.state.selectedMatch).toBeNull();
    expect(view.state.fileTextShown).toBe(false);
    expect(view.pane.textContent).toContain(words(lang, 'browser.externalDocument.stale'));
    button(view.pane, lang, 'browser.externalDocument.action.reread').click();
    await settle();
    expect(view.state.externalDocumentStatus(2)).toBeNull();
  });

  it('draws an unreadable observation in the row and the header, with its reason', async () => {
    const transport = events();
    const unreadable = {
      Unreadable: {
        sequence: 1,
        document: { Addressable: { document: 1, relative_path: 'match/a.yml' } },
        reason: { PermissionDenied: {} }
      }
    } as unknown as ExternalObservation;
    const view = await mountAll({ batches: [batch(0), batch(0), batch(1, [unreadable])] }, transport);
    view.state.show({ kind: 'document', id: 1 });
    await view.state.showFileText(true);
    transport.wake(1);
    await settle();

    expect(view.state.externalDocumentStatus(1)?.kind).toBe('unavailable');
    expect(view.sidebar.textContent).toContain(words(lang, 'browser.externalDocument.row.unavailable'));
    expect(view.pane.textContent).toContain(words(lang, 'browser.externalDocument.unavailable'));
    expect(view.pane.textContent).toContain(
      words(lang, 'code.unreadableReason.permissionDenied')
    );
  });

  it('draws a removed file once in the header of the surface still over it, and invents no row', async () => {
    const transport = events();
    const removed = {
      Removed: {
        sequence: 1,
        document: { Addressable: { document: 1, relative_path: 'match/a.yml' } },
        previous_revision: null
      }
    } as unknown as ExternalObservation;
    const view = await mountAll({ batches: [batch(0), batch(0), batch(1, [removed])] }, transport);
    view.state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 1 } },
      () => undefined
    );
    transport.wake(1);
    await settle();

    expect(view.sidebar.textContent).not.toContain('match/a.yml');
    const sentence = words(lang, 'browser.externalDocument.removed');
    expect((view.pane.textContent ?? '').split(sentence)).toHaveLength(2);
  });

  it('draws an unknown outcome on the route beside the snapshot, and ends it on the acknowledgement', async () => {
    const view = await mountAll({ saves: [Promise.resolve(WRITE_MAY_HAVE_HAPPENED)] });
    await view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    expect(view.state.observeExternalChange(observationOfB(5)).verdict.kind).toBe('raisedWithoutReload');
    await settle();

    const route = view.status.textContent ?? '';
    expect(route).toContain('match/b.yml');
    expect(route).toContain(words(lang, 'browser.externalConflict.route.writeOutcomeUnknown'));
    expect(route).toContain(words(lang, 'browser.reconciliation.route.snapshot'));
    expect(route).toContain(':disk');
    const before = callCounts(view.commands);

    button(view.status, lang, 'browser.externalConflict.action.acknowledgeSnapshot').click();
    await settle();
    expect(view.state.writeOutcomeUncertain(2)).toBe(false);
    expect(view.status.textContent).not.toContain(
      words(lang, 'browser.externalConflict.route.writeOutcomeUnknown')
    );
    // The acknowledgement installs nothing and calls no command (entry 14).
    expect(callCounts(view.commands)).toEqual(before);
  });

  it('draws an outlived acknowledgement disabled, with its refusal and the route’s exits', async () => {
    // The 9a review's reproduction: an observation held during a write that then
    // answers `may_have_written`; the failed save's own re-read outlives its origin.
    let answer: (value: RawSaveOutcome) => void = () => undefined;
    const pending = new Promise<RawSaveOutcome>((resolve) => {
      answer = resolve;
    });
    const view = await mountAll({ saves: [pending] });
    const saving = view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    expect(view.state.observeExternalChange(observationOfB(5)).verdict.kind).toBe('retained');
    answer(WRITE_MAY_HAVE_HAPPENED);
    await saving;
    await settle();

    const acknowledge = button(view.status, lang, 'browser.externalConflict.action.acknowledgeSnapshot');
    expect(acknowledge.disabled).toBe(true);
    const route = view.status.textContent ?? '';
    expect(route).toContain(words(lang, 'browser.reconciliation.refusal.projectionReplaced'));
    expect(route).toContain(words(lang, 'browser.reconciliation.route.projectionReplacedExits'));
  });

  it('holds an observation behind a write in flight on the route, its retry disabled until it settles', async () => {
    let answer: (value: RawSaveOutcome) => void = () => undefined;
    const pending = new Promise<RawSaveOutcome>((resolve) => {
      answer = resolve;
    });
    const view = await mountAll({ saves: [pending] });
    const saving = view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    expect(view.state.observeExternalChange(observationOfB(5)).verdict.kind).toBe('retained');
    flushSync();

    expect(view.status.textContent).toContain(words(lang, 'browser.externalConflict.observationRetained'));
    expect(button(view.status, lang, 'browser.externalConflict.action.retry').disabled).toBe(true);
    expect(view.status.textContent).toContain(words(lang, 'browser.reconciliation.refusal.writeInFlight'));

    answer(conflictOnB());
    await saving;
    await settle();
    // The settlement released it; nothing is held and the route is gone.
    expect(view.state.retainedObservationFor(2)).toBeNull();
    expect(view.status.textContent).not.toContain(
      words(lang, 'browser.externalConflict.observationRetained')
    );
  });

  it('retries a held observation on the press, once, calling no command', async () => {
    const view = await mountAll();
    // A held observation with no write in flight: the arbitration's own table
    // moved under it (a getter that registers a newer origin on its first read),
    // so `arbitrateHere` retained it — the one path that holds without a barrier.
    let fired = false;
    const held = observationOfB(6);
    Object.defineProperty(held, 'diskRevision', {
      get: () => {
        if (!fired) {
          fired = true;
          view.state.rememberExternalConflict(observationOfB(4));
        }
        return 'rev-c';
      }
    });
    expect(view.state.observeExternalChange(held).verdict.kind).toBe('retained');
    flushSync();
    const retry = button(view.status, lang, 'browser.externalConflict.action.retry');
    expect(retry.disabled).toBe(false);
    const before = callCounts(view.commands);

    retry.click();
    await settle();
    expect(view.state.retainedObservationFor(2)).toBeNull();
    expect(view.status.textContent).not.toContain(
      words(lang, 'browser.externalConflict.observationRetained')
    );
    expect(callCounts(view.commands)).toEqual(before);
  });

  it('draws a held observation on the surface placement in the pane header, and not on the route', async () => {
    let answer: (value: RawSaveOutcome) => void = () => undefined;
    const pending = new Promise<RawSaveOutcome>((resolve) => {
      answer = resolve;
    });
    const view = await mountAll({ saves: [pending] });
    view.state.registerWriteSurface(
      { kind: 'rawEditor', target: { kind: 'document', document: 2 } },
      () => undefined
    );
    const saving = view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    view.state.observeExternalChange(observationOfB(5));
    flushSync();

    const sentence = words(lang, 'browser.externalConflict.observationRetained');
    expect(view.pane.textContent).toContain(sentence);
    expect(button(view.pane, lang, 'browser.externalConflict.action.retry').disabled).toBe(true);
    expect(view.status.textContent).not.toContain(sentence);
    answer(conflictOnB());
    await saving;
    await settle();
  });
}); // End of the per-locale per-file suite

describe.each(LOCALES)('a write panel’s own acknowledgement inside the pane, in %s — Phase 2d-6-9b-2', (lang) => {
  beforeEach(() => {
    locale.setOverride(lang);
  });

  /**
   * Opens the raw editor over file 2 through the pane, as a person does, and puts
   * the file under an unknown write outcome with a conflict raised on the editor.
   *
   * @returns The mounted drawings.
   */
  async function rawEditorUnderAnUnknownOutcome(): Promise<Mounted> {
    const view = await mountAll({ saves: [Promise.resolve(WRITE_MAY_HAVE_HAPPENED)] });
    view.state.show({ kind: 'document', id: 2 });
    await view.state.showFileText(true);
    await settle();
    button(view.pane, lang, 'browser.rawEditor.open').click();
    await settle();
    expect(view.state.openWriteSurfaces().map((each) => each.kind)).toEqual(['rawEditor']);
    await view.state.saveRawDocument(2, 'rev-r', 'matches: []\n', { accepted: [] });
    await settle();
    expect(view.state.writeOutcomeUncertain(2)).toBe(true);
    expect(view.state.observeExternalChange(observationOfB(5)).verdict.kind).toBe('raisedWithoutReload');
    await settle();
    return view;
  } // End of function rawEditorUnderAnUnknownOutcome()

  it('draws the unknown-outcome sentence once, above the panel, and the panel’s control under its snapshot', async () => {
    const view = await rawEditorUnderAnUnknownOutcome();
    const sentence = words(lang, 'browser.externalConflict.writeOutcomeUnknown');
    expect((view.pane.textContent ?? '').split(sentence)).toHaveLength(2);
    const panel = view.pane.querySelector<HTMLElement>('.panel.external');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).not.toContain(sentence);
    // One acknowledgement in the whole pane, and it is the panel's.
    const acknowledge = words(lang, 'browser.externalConflict.action.acknowledgeSnapshot');
    const all = [...view.pane.querySelectorAll('button')].filter((each) => each.textContent?.trim() === acknowledge);
    expect(all).toHaveLength(1);
    expect(panel?.contains(all[0] ?? null)).toBe(true);
    expect(all[0]?.disabled).toBe(false);
  });

  it('ends the window’s hold from the panel, minted from the panel’s own origin, and calls no command', async () => {
    const view = await rawEditorUnderAnUnknownOutcome();
    const standing = view.state.standingConflictFor(2);
    expect(standing?.kind).toBe('externalChange');
    const before = callCounts(view.commands);
    const panel = view.pane.querySelector<HTMLElement>('.panel.external') as HTMLElement;

    button(panel, lang, 'browser.externalConflict.action.acknowledgeSnapshot').click();
    await settle();
    expect(view.state.writeOutcomeUncertain(2)).toBe(false);
    expect(view.pane.textContent).not.toContain(words(lang, 'browser.externalConflict.writeOutcomeUnknown'));
    const after = view.pane.querySelector<HTMLElement>('.panel.external') as HTMLElement;
    expect(buttonIn(after, lang, 'browser.externalConflict.action.acknowledgeSnapshot')).toBeNull();
    // The reload is offered again from its idle step; nothing was installed or read.
    expect(
      buttonIn(after, lang, conflictChoiceKey('reloadDiskVersion', 'authoredText'))
    ).not.toBeNull();
    expect(view.state.standingConflictFor(2)).toBe(standing);
    expect(callCounts(view.commands)).toEqual(before);
  });
}); // End of the per-locale panel-acknowledgement suite

describe('a locale switch on a mounted status panel', () => {
  it('changes the words and nothing else: no command, no drain, the same facts', async () => {
    locale.setOverride('en');
    const view = await mountAll({ saves: [Promise.resolve(WRITE_MAY_HAVE_HAPPENED)] });
    await view.state.saveRawDocument(2, 'rev-a', 'matches: []\n', { accepted: [] });
    view.state.observeExternalChange(observationOfB(5));
    await settle();
    const workspaceBefore = workspaceFactsOf(view.state);
    const fileBefore = fileFactsOf(view.state, 2 as DocumentId);
    const selectionBefore = view.state.selection;
    const standingBefore = view.state.standingConflictFor(2);
    const calls = callCounts(view.commands);
    expect(view.status.textContent).toContain(
      DICTIONARIES.en['browser.externalConflict.route.writeOutcomeUnknown']
    );

    locale.setOverride('es');
    flushSync();

    expect(view.status.textContent).toContain(
      DICTIONARIES.es['browser.externalConflict.route.writeOutcomeUnknown']
    );
    expect(view.status.textContent).not.toContain(
      DICTIONARIES.en['browser.externalConflict.route.writeOutcomeUnknown']
    );
    expect(buttonIn(view.status, 'es', 'browser.externalConflict.action.acknowledgeSnapshot')).not.toBeNull();
    // Nothing moved but the words.
    await settle();
    expect(callCounts(view.commands)).toEqual(calls);
    expect(workspaceFactsOf(view.state)).toEqual(workspaceBefore);
    expect(fileFactsOf(view.state, 2 as DocumentId)).toEqual(fileBefore);
    expect(view.state.selection).toBe(selectionBefore);
    expect(view.state.standingConflictFor(2)).toBe(standingBefore);
    expect(decideWorkspaceReconciliation(workspaceFactsOf(view.state)).states).toEqual([]);
  });
}); // End of the locale-switch suite
