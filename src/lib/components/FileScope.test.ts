/** @vitest-environment jsdom */

/**
 * The file-scope inspector, mounted — Phase 3-9-1 (`docs/decisions/3-split-notes.md`
 * §2 step 3-9, ruling 14).
 *
 * Two kinds of case. `FileScope.svelte` is mounted alone over hand-built
 * projections, one per state `../browser/fileScope.ts` decides, in each locale.
 * Then `Sidebar.svelte` and `SnippetList.svelte` are mounted over one real
 * `BrowserState` built by `createBrowserState` over scripted commands, so the
 * sidebar's mark and the list pane's placement are reached through the real
 * selection rather than through a prop a test handed in.
 *
 * **The invoke guard.** `@tauri-apps/api/core` is replaced by a spy that rejects,
 * and the `afterEach` holds it to exact zero: this display has no command of its
 * own, and one reaching the real boundary would be the defect.
 *
 * **What this suite cannot show** is a window: a mounted test proves a node is in
 * the DOM, not what a WKWebView draws (`CLAUDE.md` §6). That is 3-9-2's reading.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeDocument, makeSummary, scalarItem, elidedValue } from '../browser/fixtures';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { describeValueKind } from '../i18n/codes';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type {
  DocumentSummary,
  DocumentView,
  SequencePresence,
  ValueView,
  WorkspaceSummary
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import FileScope from './FileScope.svelte';
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

/** A location every presence below can carry; nothing slices by it. */
const LOCATION = {
  key_node: 0,
  key_span: { start: 0, end: 0 },
  value_node: 0,
  value_span: { start: 0, end: 0 },
  path: null
};

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

/**
 * A snippet file writing `imports` as given.
 *
 * @param imports - The projected entries.
 * @param presence - What `imports_presence` says.
 * @param overrides - Anything else the case changes.
 * @returns The projection.
 */
function withImports(
  imports: readonly ValueView[],
  presence: SequencePresence,
  overrides: Partial<DocumentView> = {}
): DocumentView {
  return { ...makeDocument(), imports, imports_presence: presence, ...overrides };
} // End of function withImports()

/**
 * Mounts the inspector alone over one projection.
 *
 * @param document - The file.
 * @returns The element it was mounted into.
 */
function mountScope(document: DocumentView): HTMLElement {
  const target = window.document.createElement('div');
  window.document.body.append(target);
  const component = mount(FileScope, { target, props: { document } });
  flushSync();
  stops.push(() => {
    void unmount(component);
    target.remove();
  });
  return target;
} // End of function mountScope()

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
 * The trimmed text of every element matching a selector.
 *
 * @param target - Where to look.
 * @param selector - What to match.
 * @returns The texts, in document order.
 */
function texts(target: HTMLElement, selector: string): string[] {
  return [...target.querySelectorAll(selector)].map((each) => each.textContent?.trim() ?? '');
} // End of function texts()

describe.each(LOCALES)('the inspector alone, in %s', (lang) => {
  it('draws every import in file order, the unsupported one in place with its reason', () => {
    locale.setOverride(lang);
    const target = mountScope(
      withImports(
        [scalarItem('_b.yml'), elidedValue('Mapping', 4), scalarItem('a.yml')],
        { Items: { location: LOCATION, flow: false, count: 3 } }
      )
    );
    const rows = [...target.querySelectorAll('ol.imports > li')];
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector('.sourceText')?.textContent).toBe('_b.yml');
    expect(rows[1]?.querySelector('.sourceText')).toBeNull();
    expect(rows[1]?.querySelector('.entry')?.textContent?.trim()).toBe(
      translate(lang, 'browser.fileScope.imports.entryNotAPath', {
        kind: describeValueKind(lang, 'Mapping')
      })
    );
    expect(rows[2]?.querySelector('.sourceText')?.textContent).toBe('a.yml');
    expect(texts(target, 'p.state')).toEqual([words(lang, 'browser.fileScope.imports.listed')]);
    expect(texts(target, 'h2')).toEqual([words(lang, 'browser.fileScope.imports.heading')]);
  });

  it('draws every row its own position, the rows drawn through SourceText included', () => {
    // The 3-9-2 window reading (`docs/decisions/3-9-2-notes.md` §5 item 1) saw
    // WebKit draw no `<ol>` marker beside a `SourceText` row, so the position is
    // an element of the row. jsdom does no layout: this proves each row carries
    // its number in the DOM, and the window reading proves it is drawn.
    locale.setOverride(lang);
    const target = mountScope(
      withImports(
        [
          scalarItem('first.yml'),
          elidedValue('Sequence', 4),
          scalarItem('third.yml'),
          elidedValue('Mapping', 8),
          scalarItem('fifth.yml')
        ],
        { Items: { location: LOCATION, flow: false, count: 5 } }
      )
    );
    const rows = [...target.querySelectorAll('ol.imports > li')];
    expect(rows.map((row) => row.querySelector(':scope > .position')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5'
    ]);
    expect(rows.map((row) => row.querySelector('.sourceText') !== null)).toEqual([
      true,
      false,
      true,
      false,
      true
    ]);
    expect(texts(target, 'ol.imports .sourceText')).toEqual(['first.yml', 'third.yml', 'fifth.yml']);
  });

  it('draws the absent, empty, unsupported-shape and unread states, each with no list', () => {
    locale.setOverride(lang);
    const cases: readonly [DocumentView, string][] = [
      [withImports([], { Absent: {} }), words(lang, 'browser.fileScope.imports.absent')],
      [
        withImports([], { Empty: { location: LOCATION } }),
        words(lang, 'browser.fileScope.imports.empty')
      ],
      [
        withImports([], { UnsupportedShape: { location: LOCATION, found: 'Scalar' } }),
        translate(lang, 'browser.fileScope.imports.unsupportedShape', {
          kind: describeValueKind(lang, 'Scalar')
        })
      ],
      [
        withImports([], { Absent: {} }, { parsed: false }),
        words(lang, 'browser.fileScope.imports.notRead')
      ]
    ];
    for (const [document, sentence] of cases) {
      const target = mountScope(document);
      expect(texts(target, 'p.state')).toEqual([sentence]);
      expect(target.querySelector('ol')).toBeNull();
    }
  });

  it('explains a `_` file as not loaded automatically, and says nothing for another file', () => {
    locale.setOverride(lang);
    const underscore = mountScope(withImports([], { Absent: {} }, { disabled: true }));
    expect(texts(underscore, 'p.autoLoad')).toEqual([
      words(lang, 'browser.fileScope.notAutoLoaded.explanation')
    ]);
    const plain = mountScope(withImports([], { Absent: {} }));
    expect(plain.querySelector('p.autoLoad')).toBeNull();
  });

  it('explains a `_` configuration profile with its own sentence, not the snippet one', () => {
    locale.setOverride(lang);
    const profile = mountScope(
      makeDocument({ relativePath: 'config/_chrome.yml', kind: 'ConfigProfile', disabled: true })
    );
    expect(texts(profile, 'p.autoLoad')).toEqual([
      words(lang, 'browser.fileScope.underscoreProfile.explanation')
    ]);
  });

  it('offers no control: nothing to press, type into or rename with', () => {
    locale.setOverride(lang);
    const target = mountScope(
      withImports([scalarItem('a.yml')], { Items: { location: LOCATION, flow: false, count: 1 } }, {
        disabled: true
      })
    );
    expect(target.querySelectorAll('button, input, textarea, select, a[href]')).toHaveLength(0);
  });
});

describe('a language switch redraws the words and nothing else', () => {
  it('changes the sentences and keeps the entries as written', () => {
    locale.setOverride('en');
    const target = mountScope(
      withImports([scalarItem('a.yml')], { Items: { location: LOCATION, flow: false, count: 1 } }, {
        disabled: true
      })
    );
    expect(texts(target, 'p.state')).toEqual([words('en', 'browser.fileScope.imports.listed')]);
    locale.setOverride('es');
    flushSync();
    expect(texts(target, 'p.state')).toEqual([words('es', 'browser.fileScope.imports.listed')]);
    expect(texts(target, 'p.autoLoad')).toEqual([
      words('es', 'browser.fileScope.notAutoLoaded.explanation')
    ]);
    expect(texts(target, '.sourceText')).toEqual(['a.yml']);
  });
});

// ---------------------------------------------------------------------------
// The sidebar and the list pane over one real state
// ---------------------------------------------------------------------------

/**
 * The three files the state opens: an ordinary one, a `_` one holding imports,
 * and a `_` configuration profile.
 */
const FILES: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'match/base.yml' }),
  makeSummary({ id: 2, relativePath: 'match/_scoped.yml', disabled: true }),
  makeSummary({ id: 3, relativePath: 'config/_chrome.yml', kind: 'ConfigProfile', disabled: true })
];

/** What `open_workspace` answers. */
const SUMMARY = {
  root: '/tmp/espanso',
  documents: 3,
  match_files: 2,
  config_profiles: 1,
  packages: 0,
  disabled: 2
} as WorkspaceSummary;

/** The refusal every other command answers. */
const REFUSED: CommandResult<never> = {
  ok: false,
  failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
};

/**
 * One file's projection: the `_` file writes two imports.
 *
 * @param id - The file.
 * @returns The projection.
 */
function viewOf(id: number): DocumentView {
  const row = FILES.find((each) => each.id === id);
  const base = makeDocument({
    id,
    relativePath: row?.relative_path ?? 'match/x.yml',
    kind: row?.kind ?? 'MatchFile',
    disabled: row?.disabled ?? false,
    topLevelKeys: id === 2 ? ['imports'] : id === 3 ? [] : ['matches']
  });
  return id === 2
    ? {
        ...base,
        imports: [scalarItem('other.yml'), scalarItem('_more.yml')],
        imports_presence: { Items: { location: LOCATION, flow: false, count: 2 } }
      }
    : base;
} // End of function viewOf()

/**
 * The commands, answering the reads and refusing everything else.
 *
 * @returns The commands.
 */
function scripted(): BrowserCommands {
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
    drainExternalChanges: vi.fn(async () => REFUSED)
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
  await new Promise((done) => setTimeout(done, 0));
  await new Promise((done) => setTimeout(done, 0));
  flushSync();
} // End of function settle()

/**
 * Opens the state and mounts the sidebar and the list pane over it.
 *
 * @returns The state and the two elements.
 */
async function mountPanes(): Promise<{
  state: BrowserState;
  sidebar: HTMLElement;
  list: HTMLElement;
}> {
  const state = createBrowserState(scripted(), () => undefined, BACKUP);
  await state.open(null);
  await settle();
  const sidebar = window.document.createElement('div');
  const list = window.document.createElement('div');
  window.document.body.append(sidebar, list);
  const components = [
    mount(Sidebar, { target: sidebar, props: { browser: state } }),
    mount(SnippetList, { target: list, props: { browser: state } })
  ];
  flushSync();
  stops.push(() => {
    for (const component of components) {
      void unmount(component);
    }
    sidebar.remove();
    list.remove();
    state.dispose();
  });
  return { state, sidebar, list };
} // End of function mountPanes()

describe.each(LOCALES)('the sidebar mark and the list pane, in %s', (lang) => {
  it('marks only the `_` file, with the whole explanation as its title', async () => {
    locale.setOverride(lang);
    const { sidebar } = await mountPanes();
    const marks = [...sidebar.querySelectorAll('.mark')].filter(
      (each) => each.textContent?.trim() === words(lang, 'browser.fileScope.notAutoLoaded.mark')
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest('button')?.textContent).toContain('match/_scoped.yml');
    expect(marks[0]?.getAttribute('title')).toBe(
      words(lang, 'browser.fileScope.notAutoLoaded.explanation')
    );
  });

  it('marks the `_` profile with its own words and title, never the snippet ones', async () => {
    locale.setOverride(lang);
    const { sidebar } = await mountPanes();
    const marks = [...sidebar.querySelectorAll('.mark')].filter(
      (each) =>
        each.textContent?.trim() === words(lang, 'browser.fileScope.underscoreProfile.mark')
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest('button')?.textContent).toContain('config/_chrome.yml');
    expect(marks[0]?.closest('button')?.textContent).not.toContain(
      words(lang, 'browser.fileScope.notAutoLoaded.mark')
    );
    expect(marks[0]?.getAttribute('title')).toBe(
      words(lang, 'browser.fileScope.underscoreProfile.explanation')
    );
  });

  it('draws the inspector for the file in scope, and none for "All"', async () => {
    locale.setOverride(lang);
    const { state, list } = await mountPanes();
    expect(list.querySelector('section.scope')).toBeNull();
    state.show({ kind: 'document', id: 2 });
    await settle();
    expect(texts(list, 'section.scope p.autoLoad')).toEqual([
      words(lang, 'browser.fileScope.notAutoLoaded.explanation')
    ]);
    expect(texts(list, 'section.scope ol.imports .sourceText')).toEqual(['other.yml', '_more.yml']);
    state.show({ kind: 'document', id: 1 });
    await settle();
    expect(list.querySelector('section.scope p.autoLoad')).toBeNull();
    expect(texts(list, 'section.scope p.state')).toEqual([
      words(lang, 'browser.fileScope.imports.absent')
    ]);
    state.show({ kind: 'document', id: 3 });
    await settle();
    expect(texts(list, 'section.scope p.autoLoad')).toEqual([
      words(lang, 'browser.fileScope.underscoreProfile.explanation')
    ]);
  });
});
