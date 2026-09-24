/** @vitest-environment jsdom */

/**
 * Display names, ordering and the preferences control, mounted — Phase 3-13-2
 * (`docs/decisions/3-split-notes.md` §2 step 3-13, ruling 28).
 *
 * Every case runs over a **real `BrowserState`** built by `createBrowserState`
 * over scripted commands, so the sidebar's order and labels, the control's
 * requests and the creator's defaults are reached through the window's own
 * preference queue rather than through a value a test handed in.
 *
 * **The invoke guard.** `@tauri-apps/api/core` is replaced by a spy that rejects,
 * and the `afterEach` holds it to exact zero: every sidecar call here goes to the
 * scripted commands, and one reaching the real boundary would be the defect.
 *
 * **What this suite cannot show** is a window: a mounted test proves a node is in
 * the DOM, not what a WKWebView draws (`CLAUDE.md` §6). That is 3-13-3's reading.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConflictModel, DiskAdoptionOutcome } from '../browser/saveOutcome';
import { makeDocument, makeSummary, scriptedAcknowledgement } from '../browser/fixtures';
import type { CreationBuffers } from '../browser/matchCreation';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState,
  type MatchSaveAnswer
} from '../browser/workspace.svelte';
import {
  describeIpcFailure,
  describeSidecarStatus,
  describeSidecarUpdateOutcome
} from '../i18n/codes';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type {
  DocumentSummary,
  DocumentView,
  NewMatch,
  SidecarFilePreferences,
  SidecarState,
  SidecarStatus,
  SidecarUpdateRequest,
  SidecarUpdateResult,
  WorkspaceSummary
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import FilePreferences from './FilePreferences.svelte';
import MatchCreator from './MatchCreator.svelte';
import Sidebar from './Sidebar.svelte';
import SnippetList from './SnippetList.svelte';

/** The Tauri boundary, replaced and held at exact zero. */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

/** Every mount a case made; the `afterEach` stops them. */
const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop();
  }
  locale.setOverride(null);
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

/** Three snippet files and a profile, in the workspace's (path) order. */
const FILES: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
  makeSummary({ id: 2, relativePath: 'match/alpha.yml' }),
  makeSummary({ id: 3, relativePath: 'match/beta.yml' }),
  makeSummary({ id: 4, relativePath: 'match/gamma.yml' })
];

/** The profile, which has no defaults. */
const PROFILE = FILES[0] as DocumentSummary;

/** The first snippet file, the one the control is opened on. */
const ALPHA = FILES[1] as DocumentSummary;

/** What `open_workspace` answers. */
const SUMMARY = {
  root: '/tmp/espanso',
  documents: 4,
  match_files: 3,
  config_profiles: 1,
  packages: 0,
  disabled: 0
} as WorkspaceSummary;

/** The refusal every command this suite does not script answers. */
const REFUSED: CommandResult<never> = {
  ok: false,
  failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
};

/** A display name long enough to wrap, with its own spaces kept. */
const LONG_NAME = '  Customer replies for the support desk, second edition ';

/**
 * One file's projection.
 *
 * @param id - The file.
 * @returns The projection.
 */
function viewOf(id: number): DocumentView {
  const row = FILES.find((each) => each.id === id);
  return makeDocument({
    id,
    relativePath: row?.relative_path ?? 'match/x.yml',
    kind: row?.kind ?? 'MatchFile'
  });
} // End of function viewOf()

/**
 * A sidecar answer.
 *
 * @param files - The files with preferences.
 * @param status - How it was read.
 * @param writable - Whether an update may write.
 * @returns The answer.
 */
function sidecar(
  files: readonly SidecarFilePreferences[],
  status: SidecarStatus = { Loaded: {} },
  writable = true
): CommandResult<SidecarState> {
  return { ok: true, value: { status, writable, files, retained_orphans: 0 } };
} // End of function sidecar()

/** A promise and the function that settles it. */
interface Deferred<T> {
  /** The promise. */
  readonly promise: Promise<T>;
  /** Settles it. */
  readonly resolve: (value: T) => void;
}

/**
 * A promise a case settles by hand.
 *
 * @returns The promise and its resolver.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
} // End of function deferred()

/** What a case scripts about the sidecar. */
interface SidecarScript {
  /** Each successive `load_sidecar` answer, or a promise a case settles. */
  readonly loads: (CommandResult<SidecarState> | Promise<CommandResult<SidecarState>>)[];
  /** Each successive `update_sidecar` answer. */
  readonly updates: CommandResult<SidecarUpdateResult>[];
  /** Every update request sent, in order. */
  readonly sent: SidecarUpdateRequest[];
}

/**
 * The commands: the workspace reads, the scripted sidecar, and refusals.
 *
 * @param script - The sidecar script.
 * @returns The commands.
 */
function scripted(script: SidecarScript): BrowserCommands {
  return {
    openWorkspace: vi.fn(async () => ({ ok: true as const, value: SUMMARY })),
    listDocuments: vi.fn(async () => ({ ok: true as const, value: FILES })),
    getDocument: vi.fn(async (id: number) => ({ ok: true as const, value: viewOf(id) })),
    getMatch: vi.fn(async () => REFUSED),
    reloadDocument: vi.fn(async (id: number) => ({ ok: true as const, value: viewOf(id) })),
    documentText: vi.fn(async () => REFUSED),
    moveMatch: vi.fn(async () => REFUSED),
    saveMatch: vi.fn(async () => REFUSED),
    createMatch: vi.fn(async () => REFUSED),
    deleteMatch: vi.fn(async () => REFUSED),
    duplicateMatch: vi.fn(async () => REFUSED),
    saveRawDocument: vi.fn(async () => REFUSED),
    drainExternalChanges: vi.fn(async () => REFUSED),
    loadSidecar: vi.fn(async () => script.loads.shift() ?? sidecar([])),
    updateSidecar: vi.fn(async (request: SidecarUpdateRequest) => {
      script.sent.push(request);
      return script.updates.shift() ?? REFUSED;
    })
  } as unknown as BrowserCommands;
} // End of function scripted()

/** A backup surface that refuses; nothing here opens a restore. */
const BACKUP: BackupCommands = {
  listBackupBatches: vi.fn(async () => REFUSED),
  listBackupEntries: vi.fn(async () => REFUSED),
  readBackupText: vi.fn(async () => REFUSED)
};

/**
 * Lets pending work run, then flushes.
 */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) {
    await new Promise((done) => setTimeout(done, 0));
  }
  flushSync();
} // End of function settle()

/**
 * Opens a real state over the script.
 *
 * @param script - The sidecar script.
 * @returns The state, with its first preference read settled.
 */
async function openState(script: SidecarScript): Promise<BrowserState> {
  const state = createBrowserState(scripted(script), () => undefined, BACKUP);
  await state.open(null);
  await settle();
  stops.push(() => state.dispose());
  return state;
} // End of function openState()

/**
 * Mounts one component and registers its teardown.
 *
 * @param component - The component.
 * @param props - Its props.
 * @returns The element it was mounted into.
 */
function mountInto<P extends Record<string, unknown>>(component: Component<P>, props: P): HTMLElement {
  const target = window.document.createElement('div');
  window.document.body.append(target);
  const mounted = mount(component, { target, props });
  flushSync();
  stops.push(() => {
    void unmount(mounted);
    target.remove();
  });
  return target;
} // End of function mountInto()

/**
 * A new script.
 *
 * @param loads - The load answers.
 * @param updates - The update answers.
 * @returns The script.
 */
function scriptOf(
  loads: SidecarScript['loads'] = [],
  updates: SidecarScript['updates'] = []
): SidecarScript {
  return { loads, updates, sent: [] };
} // End of function scriptOf()

/**
 * One key's words in one locale.
 *
 * @param lang - The locale.
 * @param key - The key.
 * @returns The words.
 */
function words(lang: Locale, key: TranslationKey): string {
  return DICTIONARIES[lang][key];
} // End of function words()

/**
 * The button labelled by one key, insisted upon.
 *
 * @param target - Where to look.
 * @param lang - The locale it is drawn in.
 * @param key - The key holding its label.
 * @returns The button.
 */
function buttonOf(target: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement {
  const found = [...target.querySelectorAll('button')].find(
    (each) => each.textContent?.trim() === words(lang, key)
  );
  if (found === undefined) {
    throw new Error(`no control labelled ${words(lang, key)}`);
  }
  return found;
} // End of function buttonOf()

/**
 * Types into a box the way a person does.
 *
 * @param box - The box.
 * @param text - Its whole new value.
 */
function typeInto(box: Element | null, text: string): void {
  if (!(box instanceof HTMLInputElement)) {
    throw new Error('no box to type into');
  }
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function typeInto()

/**
 * The row of one default in the control.
 *
 * @param target - Where the control was mounted.
 * @param option - The option.
 * @returns Its row.
 */
function defaultRow(target: HTMLElement, option: string): HTMLElement {
  const found = target.querySelector(`li.option[data-option="${option}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no row for ${option}`);
  }
  return found;
} // End of function defaultRow()

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

describe.each(LOCALES)('the sidebar with preferences, in %s', (lang) => {
  it('draws a display name with the real path beside it, and a plain path otherwise', async () => {
    locale.setOverride(lang);
    const state = await openState(
      scriptOf([
        sidecar([{ document: 3, display_name: LONG_NAME, sort_order: null, defaults: [] }])
      ])
    );
    const target = mountInto(Sidebar, { browser: state });
    const rows = [...target.querySelectorAll('button.row')];
    const named = rows.find((row) => row.querySelector('.displayName') !== null);
    // The name exactly as stored, spaces included, never translated.
    expect(named?.querySelector('.displayName')?.textContent).toBe(LONG_NAME);
    expect(named?.querySelector('.path')?.textContent).toBe('match/beta.yml');
    // Every file's real path is on screen, named or not.
    const text = target.textContent ?? '';
    for (const file of FILES) {
      expect(text).toContain(file.relative_path);
    }
    expect(target.querySelectorAll('.displayName')).toHaveLength(1);
  });

  it('orders the rows by rank: ranked first, ascending, then the rest in workspace order', async () => {
    locale.setOverride(lang);
    const state = await openState(
      scriptOf([
        sidecar([
          { document: 4, display_name: null, sort_order: 0, defaults: [] },
          { document: 3, display_name: 'Beta', sort_order: 1, defaults: [] }
        ])
      ])
    );
    const target = mountInto(Sidebar, { browser: state });
    // The files group, in drawn order; each row's path is its last `.name` text.
    const group = [...target.querySelectorAll('ul.rows')][1];
    const paths = [...(group?.querySelectorAll('button.row') ?? [])].map(
      (row) => row.querySelector('.path')?.textContent ?? row.querySelector('.name')?.textContent?.trim()
    );
    expect(paths).toEqual(['match/gamma.yml', 'match/beta.yml', 'match/alpha.yml']);
  });

  it('keeps the workspace order and plain paths while the sidecar is corrupt', async () => {
    locale.setOverride(lang);
    const state = await openState(
      scriptOf([sidecar([], { Quarantined: { aside: 'prefs.corrupt.json' } })])
    );
    const target = mountInto(Sidebar, { browser: state });
    const group = [...target.querySelectorAll('ul.rows')][1];
    const paths = [...(group?.querySelectorAll('button.row .name') ?? [])].map((name) =>
      name.textContent?.trim()
    );
    expect(paths).toEqual(['match/alpha.yml', 'match/beta.yml', 'match/gamma.yml']);
  });
});

// ---------------------------------------------------------------------------
// The preferences control
// ---------------------------------------------------------------------------

describe('the preferences control', () => {
  it('starts collapsed and draws nothing but its button', async () => {
    const state = await openState(scriptOf());
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    expect(target.querySelectorAll('input')).toHaveLength(0);
    expect(buttonOf(target, 'en', 'browser.filePreferences.open').getAttribute('aria-expanded')).toBe(
      'false'
    );
  });

  it('sets a display name and the defaults in one request through the queue, behind a read still out', async () => {
    const later = deferred<CommandResult<SidecarState>>();
    const saved: CommandResult<SidecarUpdateResult> = {
      ok: true,
      value: {
        outcome: { Saved: {} },
        state: {
          status: { Loaded: {} },
          writable: true,
          retained_orphans: 0,
          files: [
            {
              document: 2,
              display_name: 'Alpha',
              sort_order: null,
              defaults: [
                { option: 'word', value: 'true' },
                { option: 'uppercase_style', value: '' }
              ]
            }
          ]
        }
      }
    };
    const script = scriptOf([sidecar([]), later.promise], [saved]);
    const state = await openState(script);
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();

    typeInto(target.querySelector('label input'), 'Alpha');
    buttonOf(defaultRow(target, 'word'), 'en', 'browser.filePreferences.addDefault').click();
    flushSync();
    typeInto(defaultRow(target, 'word').querySelector('input'), 'true');
    buttonOf(defaultRow(target, 'uppercase_style'), 'en', 'browser.filePreferences.addDefault').click();
    flushSync();
    // No checkbox anywhere: every default is text.
    expect(target.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    // A read goes out first; the save queues behind it and is not sent yet.
    void state.refreshPreferences();
    buttonOf(target, 'en', 'browser.filePreferences.save').click();
    await settle();
    expect(script.sent).toEqual([]);

    later.resolve(sidecar([]));
    await settle();
    expect(script.sent).toEqual([
      {
        document: 2,
        changes: [
          { SetDisplayName: { name: 'Alpha' } },
          { SetDefault: { option: 'word', value: 'true' } },
          { SetDefault: { option: 'uppercase_style', value: '' } }
        ]
      }
    ]);
    // The outcome, through the sidecar's own describer; the draft now starts from
    // what the save installed, so there is nothing left to save.
    expect(target.textContent).toContain(describeSidecarUpdateOutcome('en', { Saved: {} }));
    expect(buttonOf(target, 'en', 'browser.filePreferences.save').disabled).toBe(true);
    expect((target.querySelector('label input') as HTMLInputElement).value).toBe('Alpha');
    expect(state.creationDefaults().get(2)?.word).toBe('true');
  }); // End of the "one request through the queue" case

  it('clears a name emptied by the person, and removes a default as a clear', async () => {
    const script = scriptOf(
      [
        sidecar([
          {
            document: 2,
            display_name: 'Alpha',
            sort_order: null,
            defaults: [{ option: 'force_mode', value: 'keys' }]
          }
        ])
      ],
      [REFUSED]
    );
    const state = await openState(script);
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    expect((defaultRow(target, 'force_mode').querySelector('input') as HTMLInputElement).value).toBe(
      'keys'
    );
    typeInto(target.querySelector('label input'), '   ');
    buttonOf(defaultRow(target, 'force_mode'), 'en', 'browser.filePreferences.removeDefault').click();
    flushSync();
    buttonOf(target, 'en', 'browser.filePreferences.save').click();
    await settle();
    expect(script.sent[0]?.changes).toEqual([
      { ClearDisplayName: {} },
      { ClearDefault: { option: 'force_mode' } }
    ]);
    // A failed call is drawn through the IPC describer and keeps the draft.
    expect(target.textContent).toContain(
      describeIpcFailure('en', { kind: 'command', error: { code: 'noWorkspaceOpen' } })
    );
    expect(buttonOf(target, 'en', 'browser.filePreferences.save').disabled).toBe(false);
  }); // End of the "clears a name" case

  it('draws a stored value holding a line break read-only, and never sends it untouched', async () => {
    const script = scriptOf([
      sidecar([
        {
          document: 2,
          display_name: 'two\nlines',
          sort_order: null,
          defaults: [{ option: 'word', value: 'a\nb' }]
        }
      ])
    ]);
    const state = await openState(script);
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    expect(target.querySelector('label input')).toBeNull();
    expect(target.textContent).toContain(DICTIONARIES.en['browser.filePreferences.displayNameShown']);
    expect(defaultRow(target, 'word').querySelector('input')).toBeNull();
    expect(buttonOf(target, 'en', 'browser.filePreferences.save').disabled).toBe(true);
    buttonOf(target, 'en', 'browser.filePreferences.clearName').click();
    flushSync();
    expect((target.querySelector('label input') as HTMLInputElement).value).toBe('');
  });

  it.each([
    [{ Quarantined: { aside: 'prefs.corrupt.json' } }, true],
    [{ QuarantineFailed: {} }, false],
    [{ FutureSchema: { version: '9' } }, false],
    [{ Unreadable: {} }, false],
    [{ Fresh: {} }, true]
  ] as const)('says how the sidecar read (%j) and is editable only when writable', async (status, writable) => {
    const state = await openState(scriptOf([sidecar([], status, writable)]));
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    expect(target.textContent).toContain(describeSidecarStatus('en', status));
    expect((target.querySelector('label input') as HTMLInputElement).readOnly).toBe(!writable);
  });

  it('says a failed read and stays read-only', async () => {
    const state = await openState(scriptOf([REFUSED]));
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    expect(target.textContent).toContain(DICTIONARIES.en['browser.filePreferences.readFailed']);
    expect((target.querySelector('label input') as HTMLInputElement).readOnly).toBe(true);
  });

  it('draws a save refused as not writable with its reason', async () => {
    const quarantined: SidecarStatus = { QuarantineFailed: {} };
    const notWritable: CommandResult<SidecarUpdateResult> = {
      ok: true,
      value: {
        outcome: { NotWritable: {} },
        state: { status: quarantined, writable: false, files: [], retained_orphans: 0 }
      }
    };
    const script = scriptOf([sidecar([])], [notWritable]);
    const state = await openState(script);
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    typeInto(target.querySelector('label input'), 'Alpha');
    buttonOf(target, 'en', 'browser.filePreferences.save').click();
    await settle();
    expect(target.textContent).toContain(describeSidecarUpdateOutcome('en', { NotWritable: {} }));
    expect(target.textContent).toContain(describeSidecarStatus('en', quarantined));
  });

  it('offers no defaults for a configuration profile, only a display name', async () => {
    const state = await openState(scriptOf());
    const target = mountInto(FilePreferences, { browser: state, document: PROFILE });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    expect(target.querySelectorAll('li.option')).toHaveLength(0);
    expect(target.textContent).toContain(DICTIONARIES.en['browser.filePreferences.defaultsNotApplicable']);
  });

  it.each(LOCALES)('draws its words in %s', async (lang) => {
    locale.setOverride(lang);
    const state = await openState(scriptOf([sidecar([], { Fresh: {} })]));
    const target = mountInto(FilePreferences, { browser: state, document: ALPHA });
    buttonOf(target, lang, 'browser.filePreferences.open').click();
    flushSync();
    const text = target.textContent ?? '';
    expect(text).toContain(translate(lang, 'browser.filePreferences.label', { path: 'match/alpha.yml' }));
    expect(text).toContain(words(lang, 'browser.filePreferences.defaultsHeading'));
    expect(text).toContain(words(lang, 'browser.filePreferences.lineEndings'));
    expect(text).toContain(describeSidecarStatus(lang, { Fresh: {} }));
    buttonOf(target, lang, 'browser.filePreferences.close').click();
    flushSync();
    expect(target.querySelectorAll('input')).toHaveLength(0);
  });
}); // End of the "preferences control" suite

// ---------------------------------------------------------------------------
// Creation over an absent or corrupt sidecar
// ---------------------------------------------------------------------------

describe('creation over an absent or corrupt sidecar', () => {
  /** A reporter that binds nothing. */
  const inert = (): SurfaceBinding => ({ reportTarget: () => undefined, withdraw: () => undefined });

  /**
   * Mounts the creator over a real state's documents and defaults, recording
   * what it sends.
   *
   * @param state - The state.
   * @returns The element and the recorded snippets.
   */
  function mountCreatorOver(state: BrowserState): { target: HTMLElement; sent: NewMatch[] } {
    const sent: NewMatch[] = [];
    const target = mountInto(MatchCreator, {
      documents: () => state.documents,
      projections: () => state.views,
      held: () => null,
      defaults: () => state.creationDefaults(),
      clock: () => 0,
      create: (_document: number, newMatch: NewMatch): Promise<MatchSaveAnswer> => {
        sent.push(newMatch);
        return Promise.resolve({ kind: 'notAttempted' });
      },
      adoptDiskVersion: (_conflict: ConflictModel<CreationBuffers>): DiskAdoptionOutcome =>
        'installed',
      reportDestination: () => undefined,
      reportReceiver: inert,
      reportRecovery: inert,
      acknowledgement: scriptedAcknowledgement().port,
      standingConflictFor: () => null,
      close: () => undefined
    });
    return { target, sent };
  } // End of function mountCreatorOver()

  it.each([
    ['corrupt, set aside', sidecar([], { Quarantined: { aside: 'prefs.corrupt.json' } })],
    ['corrupt, left in place', sidecar([], { QuarantineFailed: {} }, false)],
    ['absent', sidecar([], { Fresh: {} })],
    ['unreachable', REFUSED]
  ] as const)('creates with no seeded option when the sidecar is %s', async (_name, load) => {
    const state = await openState(scriptOf([load]));
    const { target, sent } = mountCreatorOver(state);
    const alpha = [...target.querySelectorAll('.destinations button')].find(
      (each) => each.textContent?.trim() === 'match/alpha.yml'
    );
    (alpha as HTMLButtonElement).click();
    flushSync();
    typeInto(target.querySelector('input.text'), ':hi');
    const body = target.querySelector('textarea');
    (body as HTMLTextAreaElement).value = 'hello';
    body?.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(target.textContent).not.toContain(DICTIONARIES.en['browser.matchCreation.optionSeeded']);
    buttonOf(target, 'en', 'browser.matchCreation.create').click();
    await settle();
    expect(sent).toEqual([{ trigger: { Single: ':hi' }, content: { Replace: 'hello' } }]);
  });

  it('seeds the window’s live defaults into a form opened after they were read', async () => {
    const state = await openState(
      scriptOf([
        sidecar([
          {
            document: 2,
            display_name: null,
            sort_order: null,
            defaults: [{ option: 'force_clipboard', value: 'true' }]
          }
        ])
      ])
    );
    const { target } = mountCreatorOver(state);
    const alpha = [...target.querySelectorAll('.destinations button')].find(
      (each) => each.textContent?.trim() === 'match/alpha.yml'
    );
    (alpha as HTMLButtonElement).click();
    flushSync();
    const box = target.querySelector('li.option[data-option="force_clipboard"] input');
    expect((box as HTMLInputElement).value).toBe('true');
  });
}); // End of the "creation over an absent or corrupt sidecar" suite

// ---------------------------------------------------------------------------
// The review's finding: a draft through a whole-file save
// ---------------------------------------------------------------------------

describe('an unsaved preferences draft through a whole-file save', () => {
  it('survives the projection being retired and read again', async () => {
    const script = scriptOf([sidecar([])]);
    const base = scripted(script);
    // The re-read after the save is held until the case releases it, so the
    // window sits with the file's projection retired.
    let reread: Deferred<CommandResult<DocumentView>> | null = null;
    let reads = 0;
    const commands = {
      ...base,
      getDocument: vi.fn(async (id: number) => {
        reads += 1;
        if (reread !== null && id === 2) {
          return reread.promise;
        }
        return { ok: true as const, value: viewOf(id) };
      }),
      saveRawDocument: vi.fn(
        async (
          document: number,
          _base: string,
          _text: string,
          _acknowledgement: unknown,
          reload: (invalidation: { document: number; revision: string }) => Promise<void>
        ) => {
          await reload({ document, revision: 'b'.repeat(64) });
          return REFUSED;
        }
      )
    } as unknown as BrowserCommands;
    const state = createBrowserState(commands, () => undefined, BACKUP);
    await state.open(null);
    await settle();
    stops.push(() => state.dispose());
    state.show({ kind: 'document', id: 2 });
    await settle();
    const target = mountInto(SnippetList, { browser: state });
    buttonOf(target, 'en', 'browser.filePreferences.open').click();
    flushSync();
    typeInto(target.querySelector('.preferences label input'), 'Unsaved name');
    buttonOf(defaultRow(target, 'word'), 'en', 'browser.filePreferences.addDefault').click();
    flushSync();

    reread = deferred<CommandResult<DocumentView>>();
    const before = reads;
    const projection = state.views.find((view) => view.id === 2);
    const saving = state.saveRawDocument(2, projection?.revision ?? '', 'matches: []\n', {
      Suspicions: []
    } as never);
    await settle();
    // The projection is retired and its re-read is out.
    expect(reads).toBeGreaterThan(before);
    expect(state.scopedDocument).toBeNull();
    const nameBox = (): HTMLInputElement | null =>
      target.querySelector('.preferences label input');
    expect(nameBox()?.value).toBe('Unsaved name');
    expect(defaultRow(target, 'word').querySelector('input')).not.toBeNull();

    reread.resolve({ ok: true, value: viewOf(2) });
    await saving;
    await settle();
    expect(state.scopedDocument).not.toBeNull();
    expect(nameBox()?.value).toBe('Unsaved name');
    expect(defaultRow(target, 'word').querySelector('input')).not.toBeNull();
    expect(buttonOf(target, 'en', 'browser.filePreferences.save').disabled).toBe(false);
  }); // End of the "survives the projection being retired" case
}); // End of the "draft through a whole-file save" suite
