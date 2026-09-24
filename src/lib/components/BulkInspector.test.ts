/** @vitest-environment jsdom */

/**
 * The bulk option inspector and the list's multi-select, mounted — Phase 3-11-2
 * (`docs/decisions/3-split-notes.md` §2 step 3-11; rulings 20–22).
 *
 * Two kinds of case. `BulkInspector.svelte` is mounted alone over hand-built
 * projections and scripted readers, one case per thing it draws: *Mixed* and a
 * shared spelling from the Rust-cut reads, an exclusion with its reason, the
 * draft's undo and redo, a partial outcome with exclusions and execution
 * outcomes counted apart, and the consent review whose grant the next request
 * carries. Then `SnippetList.svelte` and `DetailPane.svelte` are mounted over one
 * real `BrowserState` built by `createBrowserState` over scripted commands, so the
 * multi-select, the inspector and the apply are reached through the real state:
 * the spellings through `matchOptionSpellings` and the write through
 * `applyBulkOptions`.
 *
 * **The invoke guard.** `@tauri-apps/api/core` is replaced by a spy that
 * rejects, and the `afterEach` holds it to exact zero: every command here is a
 * scripted stub.
 *
 * **What this suite cannot show** is a window: a mounted test proves a node is
 * in the DOM and a handler fires, not what a WKWebView draws (`CLAUDE.md` §6).
 * That is 3-11-3's reading.
 *
 * Every fixture is synthetic and neutral (`CLAUDE.md` §1). Per `1b-2a-notes.md`
 * section 14, a `describe`/`it` callback whose sibling argument is already its
 * description carries no JSDoc of its own; ordinary helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_BULK_SELECTION, toggleInBulkSelection, type BulkApplyAnswer } from '../browser/bulkEdit';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import {
  createBrowserState,
  type BackupCommands,
  type BrowserCommands,
  type BrowserState
} from '../browser/workspace.svelte';
import { describeFindingCode, describeBulkFileOutcome } from '../i18n/codes';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type {
  BulkOption,
  BulkOptionSpellings,
  BulkOptionsRequest,
  BulkResult,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  OptionSpelling,
  WorkspaceSummary
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import BulkInspector from './BulkInspector.svelte';
import DetailPane from './DetailPane.svelte';
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

/** A refusal every unscripted command answers. */
const REFUSED: CommandResult<never> = {
  ok: false,
  failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
};

/** A neutral suspicion, as a refusal would carry it. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/**
 * Two snippet files: `match/base.yml` (2) with two snippets, the second of which
 * the visual editor may not write, and `match/other.yml` (3) with one.
 *
 * @param revisionOfBase - The revision file 2 is projected at.
 * @returns The projections.
 */
function viewsAt(revisionOfBase = 'rev-a'): DocumentView[] {
  return [
    makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: revisionOfBase,
      matches: [
        makeMatch({ node: 10, document: 2, revision: revisionOfBase, trigger: ':one' }),
        {
          ...makeMatch({ node: 11, document: 2, revision: revisionOfBase, trigger: ':two' }),
          safely_editable: false
        }
      ]
    }),
    makeDocument({
      id: 3,
      relativePath: 'match/other.yml',
      revision: 'rev-x',
      matches: [makeMatch({ node: 20, document: 3, revision: 'rev-x', trigger: ':three' })]
    })
  ];
} // End of function viewsAt()

/** The files as the window lists them. */
const FILES: readonly DocumentSummary[] = [
  makeSummary({ id: 2, relativePath: 'match/base.yml' }),
  makeSummary({ id: 3, relativePath: 'match/other.yml' })
];

/** The identity of snippet `node` of file `document` at its first revision. */
function idOf(document: number, node: number): MatchId {
  return { document, revision: document === 2 ? 'rev-a' : 'rev-x', node };
} // End of function idOf()

/** A selection of the given identities, in order. */
function selectionOf(...ids: MatchId[]): readonly MatchId[] {
  return ids.reduce((selection, id) => toggleInBulkSelection(selection, id), EMPTY_BULK_SELECTION);
} // End of function selectionOf()

/** Spellings with every option absent except those given. */
function spellings(written: Partial<Record<BulkOption, string>> = {}): BulkOptionSpellings {
  /** One option's spelling. */
  const of = (option: BulkOption): OptionSpelling => {
    const source = written[option];
    return source === undefined ? { Absent: {} } : { Written: { source } };
  };
  return {
    word: of('word'),
    left_word: of('left_word'),
    right_word: of('right_word'),
    propagate_case: of('propagate_case'),
    uppercase_style: of('uppercase_style'),
    force_mode: of('force_mode'),
    force_clipboard: of('force_clipboard')
  };
} // End of function spellings()

/**
 * The spelling reader: `word` spelled `true` in file 2 and `'true'` in file 3 —
 * one decoded text, two spellings — and `force_mode: clipboard` in both.
 *
 * @param id - The snippet.
 * @returns Its spellings.
 */
async function readSpellings(id: MatchId): Promise<CommandResult<BulkOptionSpellings>> {
  return {
    ok: true,
    value: spellings({
      word: id.document === 2 ? 'true' : "'true'",
      force_mode: 'clipboard'
    })
  };
} // End of function readSpellings()

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
 * Lets pending promises run, then flushes.
 */
async function settle(): Promise<void> {
  for (let round = 0; round < 4; round += 1) {
    await new Promise((done) => setTimeout(done, 0));
  } // End of the loop that lets queued work run
  flushSync();
} // End of function settle()

/**
 * The first button whose trimmed text is exactly the given words.
 *
 * @param target - Where to look.
 * @param text - The words.
 * @returns The button.
 */
function button(target: HTMLElement, text: string): HTMLButtonElement {
  const found = [...target.querySelectorAll('button')].find(
    (each) => each.textContent?.trim() === text
  );
  if (found === undefined) {
    throw new Error(`no button reads "${text}"`);
  }
  return found;
} // End of function button()

/**
 * Chooses one value in the `<select>` of one option's control.
 *
 * @param target - The inspector.
 * @param option - The option.
 * @param value - `untouched`, `set` or `remove`.
 */
function choose(target: HTMLElement, option: BulkOption, value: string): void {
  const select = target.querySelector<HTMLSelectElement>(`[data-option="${option}"] select`);
  if (select === null) {
    throw new Error(`no control for ${option}`);
  }
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
} // End of function choose()

/**
 * Types a whole text into one option's box.
 *
 * @param target - The inspector.
 * @param option - The option.
 * @param text - What the box holds afterwards.
 */
function type(target: HTMLElement, option: BulkOption, text: string): void {
  const box = target.querySelector<HTMLInputElement>(`[data-option="${option}"] input`);
  if (box === null) {
    throw new Error(`no box for ${option}`);
  }
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

/** What a mounted inspector was handed, for the case to read back. */
interface Mounted {
  /** The element it was mounted into. */
  readonly target: HTMLElement;
  /** The apply stub. */
  readonly apply: ReturnType<typeof vi.fn<(request: BulkOptionsRequest) => Promise<BulkApplyAnswer>>>;
  /** The selection-replacing stub. */
  readonly replaceSelection: ReturnType<typeof vi.fn<(next: readonly MatchId[]) => void>>;
}

/**
 * Mounts the inspector alone.
 *
 * @param selection - The selection.
 * @param answers - What each successive apply answers.
 * @returns What it was handed.
 */
async function mountInspector(
  selection: readonly MatchId[],
  answers: readonly BulkApplyAnswer[] = []
): Promise<Mounted> {
  const target = window.document.createElement('div');
  window.document.body.append(target);
  let call = 0;
  const apply = vi.fn(async (_request: BulkOptionsRequest): Promise<BulkApplyAnswer> => {
    const answer = answers[call] ?? { kind: 'notAttempted' };
    call += 1;
    return answer;
  });
  const replaceSelection = vi.fn((_next: readonly MatchId[]) => undefined);
  const component = mount(BulkInspector, {
    target,
    props: {
      selection,
      views: viewsAt(),
      documents: FILES,
      openDrafts: [],
      readSpellings,
      apply,
      replaceSelection,
      stop: () => undefined
    }
  });
  stops.push(() => {
    void unmount(component);
    target.remove();
  });
  await settle();
  return { target, apply, replaceSelection };
} // End of function mountInspector()

/** A result built from reports, with `nothing_written` derived as Rust does. */
function resultOf(preflight: boolean, files: BulkResult['files']): BulkResult {
  return {
    preflight_passed: preflight,
    nothing_written: files.every(
      (file) => file.outcome !== 'saved' && file.outcome !== 'writeOutcomeUnknown'
    ),
    files
  };
} // End of function resultOf()

describe.each(LOCALES)('the inspector alone, in %s', (lang) => {
  it('draws Mixed from two spellings of one text and the shared bytes of another, and sends nothing untouched', async () => {
    locale.setOverride(lang);
    const { target } = await mountInspector(selectionOf(idOf(2, 10), idOf(3, 20)));
    const word = target.querySelector('[data-option="word"]');
    expect(word?.querySelector('[data-summary]')?.getAttribute('data-summary')).toBe('mixed');
    expect(word?.querySelector('[data-summary]')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkEdit.option.mixed')
    );
    expect(word?.querySelector('.mixed')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkInspector.mixedLeft')
    );
    const force = target.querySelector('[data-option="force_mode"]');
    expect(force?.querySelector('.sourceText')?.textContent).toBe('clipboard');
    expect(force?.querySelector('.mixed')).toBeNull();
    // Nothing is touched, so nothing can be applied, and the reason is said.
    expect(button(target, words(lang, 'browser.bulkInspector.apply')).disabled).toBe(true);
    expect(target.querySelector('[data-blocker="noChanges"]')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkEdit.blocked.noChanges')
    );
    // Every control is a textual one: no checkbox anywhere.
    expect(target.querySelector('input[type="checkbox"]')).toBeNull();
    // Touching the mixed control stops showing Mixed beside it.
    choose(target, 'word', 'remove');
    expect(target.querySelector('[data-option="word"] .mixed')).toBeNull();
  });

  it('lists a read-only snippet as left out with its reason, apart from what is written', async () => {
    locale.setOverride(lang);
    const { target } = await mountInspector(selectionOf(idOf(2, 10), idOf(2, 11), idOf(3, 20)));
    const excluded = [...target.querySelectorAll('.exclusions li')];
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.getAttribute('data-reason')).toBe('readOnly');
    expect(excluded[0]?.textContent).toContain(':two');
    expect(excluded[0]?.textContent).toContain('match/base.yml');
    expect(excluded[0]?.textContent).toContain(words(lang, 'browser.bulkEdit.exclusion.readOnly'));
    const plan = target.querySelector('.apply')?.textContent ?? '';
    expect(plan).toContain(translate(lang, 'browser.bulkInspector.planFiles', { count: 2 }));
    expect(plan).toContain(translate(lang, 'browser.bulkInspector.planSnippets', { count: 2 }));
    expect(plan).toContain(words(lang, 'browser.bulkInspector.noDiskUndo'));
  });

  it('undoes and redoes the drafted intents, touching no file', async () => {
    locale.setOverride(lang);
    const { target, apply } = await mountInspector(selectionOf(idOf(2, 10)));
    const undo = (): HTMLButtonElement => button(target, words(lang, 'browser.bulkInspector.draftUndo'));
    const redo = (): HTMLButtonElement => button(target, words(lang, 'browser.bulkInspector.draftRedo'));
    expect(undo().disabled).toBe(true);
    choose(target, 'word', 'set');
    type(target, 'word', 'yes');
    expect(undo().disabled).toBe(false);
    undo().click();
    flushSync();
    expect(target.querySelector<HTMLInputElement>('[data-option="word"] input')?.value).toBe('');
    undo().click();
    flushSync();
    expect(target.querySelector('[data-option="word"] input')).toBeNull();
    expect(target.querySelector<HTMLSelectElement>('[data-option="word"] select')?.value).toBe(
      'untouched'
    );
    expect(redo().disabled).toBe(false);
    redo().click();
    redo().click();
    flushSync();
    expect(target.querySelector<HTMLInputElement>('[data-option="word"] input')?.value).toBe('yes');
    expect(target.textContent).toContain(words(lang, 'browser.bulkInspector.draftOnly'));
    expect(apply).not.toHaveBeenCalled();
  });

  it('draws a partial outcome with execution outcomes and exclusions counted apart', async () => {
    locale.setOverride(lang);
    const answer: BulkApplyAnswer = {
      kind: 'answered',
      result: resultOf(true, [
        { document: 2, outcome: 'saved', revision: 'rev-b', backup_taken: true, notes: [] },
        { document: 3, outcome: 'failed', error: { code: 'noWorkspaceOpen' } }
      ]),
      adoptions: [{ document: 2, adoption: { kind: 'done' } }]
    };
    const { target, apply, replaceSelection } = await mountInspector(
      selectionOf(idOf(2, 10), idOf(2, 11), idOf(3, 20)),
      [answer]
    );
    choose(target, 'word', 'set');
    type(target, 'word', 'true');
    button(target, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();

    expect(apply).toHaveBeenCalledTimes(1);
    const request = apply.mock.calls[0]?.[0];
    // Only the touched option travels; the untouched `force_mode` does not.
    expect(request?.changes).toEqual([{ option: 'word', value: { Set: 'true' } }]);
    expect(request?.files.map((file) => file.matches.map((id) => id.node))).toEqual([[10], [20]]);

    const outcome = target.querySelector('.outcome');
    expect(outcome?.querySelector('.headline')?.getAttribute('data-headline')).toBe('partial');
    expect(outcome?.querySelector('.headline')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkEdit.outcome.partial')
    );
    const execution = [...(outcome?.querySelectorAll('.execution li') ?? [])].map((li) =>
      li.getAttribute('data-count')
    );
    const excluded = [...(outcome?.querySelectorAll('.excluded li') ?? [])].map((li) =>
      li.getAttribute('data-count')
    );
    expect(execution).toEqual(['saved', 'notWritten']);
    expect(excluded).toEqual(['excludedSnippets']);
    expect(outcome?.querySelector('.excluded li')?.textContent?.trim()).toBe(
      translate(lang, 'browser.bulkInspector.count.excludedSnippets', { count: 1 })
    );
    const files = [...(outcome?.querySelectorAll('.files li') ?? [])];
    expect(files.map((li) => li.getAttribute('data-outcome'))).toEqual(['saved', 'failed']);
    expect(files[0]?.textContent).toContain(
      describeBulkFileOutcome(lang, { outcome: 'saved', revision: 'rev-b', backup_taken: true, notes: [] })
    );
    // Nothing offers to take a save back.
    expect(outcome?.textContent ?? '').not.toMatch(/undo|deshac/i);

    // The saved file's snippets are dropped; the one whose file wrote nothing stays.
    button(target, words(lang, 'browser.bulkInspector.keepRemaining')).click();
    expect(replaceSelection).toHaveBeenCalledWith([idOf(3, 20)]);
  });

  it('reviews a refused file’s findings, and the next request carries that file’s consent alone', async () => {
    locale.setOverride(lang);
    const refused: BulkApplyAnswer = {
      kind: 'answered',
      result: resultOf(false, [
        {
          document: 2,
          outcome: 'refused',
          verdict: 'RefusedForUnacknowledgedSuspicions',
          findings: [SUSPICION],
          candidate: 'cand-2',
          intent: 'intent-2'
        },
        { document: 3, outcome: 'notAttempted' }
      ]),
      adoptions: []
    };
    const { target, apply } = await mountInspector(selectionOf(idOf(2, 10), idOf(3, 20)), [refused]);
    choose(target, 'word', 'remove');
    button(target, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();

    const consent = target.querySelector('.consent');
    expect(consent?.querySelector('h3')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkInspector.consentHeading')
    );
    const item = consent?.querySelector('[data-document="2"]');
    expect(item?.textContent).toContain('match/base.yml');
    expect(item?.textContent).toContain(describeFindingCode(lang, SUSPICION.code));
    button(target, words(lang, 'browser.bulkInspector.consentGive')).click();
    flushSync();
    expect(item?.querySelector('.consented')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkInspector.consentHeld')
    );

    button(target, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();
    expect(apply).toHaveBeenCalledTimes(2);
    const second = apply.mock.calls[1]?.[0];
    const [base, other] = second?.files ?? [];
    expect(base?.consent).toEqual({
      document: 2,
      base_revision: 'rev-a',
      intent: 'intent-2',
      candidate: 'cand-2',
      acknowledgement: { accepted: [SUSPICION] }
    });
    expect(other?.consent).toBeNull();
  });

  it('blocks a selection whose spelling read answered a stale identity', async () => {
    locale.setOverride(lang);
    const target = window.document.createElement('div');
    window.document.body.append(target);
    const component = mount(BulkInspector, {
      target,
      props: {
        selection: selectionOf(idOf(2, 10)),
        views: viewsAt(),
        documents: FILES,
        openDrafts: [],
        readSpellings: async () => ({
          ok: false as const,
          failure: {
            kind: 'command' as const,
            error: { code: 'identityStaleRevision' as const, expected: 'rev-b', found: 'rev-a' }
          }
        }),
        apply: vi.fn(async (): Promise<BulkApplyAnswer> => ({ kind: 'notAttempted' })),
        replaceSelection: () => undefined,
        stop: () => undefined
      }
    });
    stops.push(() => {
      void unmount(component);
      target.remove();
    });
    await settle();
    choose(target, 'word', 'remove');
    expect(target.querySelector('[data-blocker="staleSelection"]')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkEdit.blocked.staleSelection')
    );
    expect(button(target, words(lang, 'browser.bulkInspector.apply')).disabled).toBe(true);
  });
}); // End of the per-locale inspector suite

// ---------------------------------------------------------------------------
// The list and the pane over one real state
// ---------------------------------------------------------------------------

/** The workspace summary the scripted open answers. */
const SUMMARY = {
  root: '/tmp/espanso',
  documents: 2,
  match_files: 2,
  config_profiles: 0,
  packages: 0,
  disabled: 0
} as WorkspaceSummary;

/** The backup surface, refusing; nothing here opens a restore. */
const BACKUP: BackupCommands = {
  listBackupBatches: vi.fn(async () => REFUSED),
  listBackupEntries: vi.fn(async () => REFUSED),
  readBackupText: vi.fn(async () => REFUSED)
};

/** A state with its scripted commands, and the two panes mounted over it. */
interface Panes {
  /** The state. */
  readonly state: BrowserState;
  /** Its commands. */
  readonly commands: BrowserCommands;
  /** The list pane. */
  readonly list: HTMLElement;
  /** The detail pane. */
  readonly detail: HTMLElement;
}

/**
 * Opens a state over scripted commands and mounts the list and detail panes.
 * After a bulk apply, file 2 is re-read at `rev-b`.
 *
 * @param gate - When given, the scripted apply answers only once it resolves.
 * @returns The state, its commands and the two elements.
 */
async function mountPanes(gate?: Promise<void>): Promise<Panes> {
  let baseRevision = 'rev-a';
  const viewOf = (id: number): DocumentView => {
    const found = viewsAt(baseRevision).find((view) => view.id === id);
    if (found === undefined) {
      throw new Error(`no fixture file ${id}`);
    }
    return found;
  };
  const commands = {
    openWorkspace: vi.fn(async () => ({ ok: true as const, value: SUMMARY })),
    listDocuments: vi.fn(async () => ({ ok: true as const, value: FILES })),
    getDocument: vi.fn(async (id: number) => ({ ok: true as const, value: viewOf(id) })),
    getMatch: vi.fn(async (id: MatchId) => {
      const match = viewOf(id.document).matches.find((each) => each.id.node === id.node);
      return match === undefined ? REFUSED : { ok: true as const, value: match };
    }),
    reloadDocument: vi.fn(async (id: number) => ({ ok: true as const, value: viewOf(id) })),
    documentText: vi.fn(async () => REFUSED),
    moveMatch: vi.fn(async () => REFUSED),
    saveMatch: vi.fn(async () => REFUSED),
    createMatch: vi.fn(async () => REFUSED),
    deleteMatch: vi.fn(async () => REFUSED),
    duplicateMatch: vi.fn(async () => REFUSED),
    saveRawDocument: vi.fn(async () => REFUSED),
    matchItemText: vi.fn(async () => REFUSED),
    saveMatchItemText: vi.fn(async () => REFUSED),
    matchOptionSpellings: vi.fn(readSpellings),
    applyBulkOptions: vi.fn(async (request: BulkOptionsRequest) => {
      if (gate !== undefined) {
        await gate;
      }
      baseRevision = 'rev-b';
      return {
        ok: true as const,
        value: resultOf(
          true,
          request.files.map((file) =>
            file.document === 2
              ? {
                  document: 2,
                  outcome: 'saved' as const,
                  revision: 'rev-b',
                  backup_taken: true,
                  notes: []
                }
              : { document: file.document, outcome: 'alreadyUnchanged' as const, revision: 'rev-x' }
          )
        )
      };
    }), // End of the scripted applyBulkOptions
    drainExternalChanges: vi.fn(async () => REFUSED)
  } as unknown as BrowserCommands;
  const state = createBrowserState(commands, () => undefined, BACKUP);
  await state.open(null);
  await settle();
  const list = window.document.createElement('div');
  const detail = window.document.createElement('div');
  window.document.body.append(list, detail);
  const components = [
    mount(SnippetList, { target: list, props: { browser: state } }),
    mount(DetailPane, { target: detail, props: { browser: state } })
  ];
  flushSync();
  stops.push(() => {
    for (const component of components) {
      void unmount(component);
    }
    list.remove();
    detail.remove();
    state.dispose();
  });
  return { state, commands, list, detail };
} // End of function mountPanes()

/**
 * The list's row for one trigger.
 *
 * @param list - The list pane.
 * @param trigger - The trigger text.
 * @returns The row's button.
 */
function row(list: HTMLElement, trigger: string): HTMLButtonElement {
  const found = [...list.querySelectorAll<HTMLButtonElement>('button.row')].find(
    (each) => each.querySelector('.trigger')?.textContent?.trim() === trigger
  );
  if (found === undefined) {
    throw new Error(`no row for ${trigger}`);
  }
  return found;
} // End of function row()

describe.each(LOCALES)('selecting several through the real state, in %s', (lang) => {
  it('keeps a row press a single selection until several are being selected', async () => {
    locale.setOverride(lang);
    const { state, list, detail } = await mountPanes();
    row(list, ':one').click();
    await settle();
    expect(row(list, ':one').getAttribute('aria-current')).toBe('true');
    expect(row(list, ':one').hasAttribute('aria-pressed')).toBe(false);
    expect(state.bulkSelecting).toBe(false);
    expect(detail.querySelector(`[aria-label="${words(lang, 'browser.bulkInspector.label')}"]`)).toBeNull();
  });

  it('toggles rows into the bulk selection, draws the inspector and applies through the state', async () => {
    locale.setOverride(lang);
    const { state, commands, list, detail } = await mountPanes();
    button(list, words(lang, 'browser.list.bulk.start')).click();
    flushSync();
    expect(state.bulkSelecting).toBe(true);
    // The new-snippet opener is withdrawn while the inspector holds the pane.
    expect(detail.textContent).not.toContain(words(lang, 'browser.matchCreation.open'));

    row(list, ':one').click();
    row(list, ':three').click();
    flushSync();
    expect(row(list, ':one').getAttribute('aria-pressed')).toBe('true');
    expect(row(list, ':two').getAttribute('aria-pressed')).toBe('false');
    expect(state.bulkSelection.map((id) => id.node)).toEqual([10, 20]);
    expect(list.textContent).toContain(translate(lang, 'browser.list.bulk.count', { count: 2 }));
    // A second press takes a snippet out again.
    row(list, ':three').click();
    row(list, ':three').click();
    flushSync();
    expect(state.bulkSelection.map((id) => id.node)).toEqual([10, 20]);

    await settle();
    expect(commands.matchOptionSpellings).toHaveBeenCalledTimes(2);
    const inspector = detail.querySelector<HTMLElement>(
      `[aria-label="${words(lang, 'browser.bulkInspector.label')}"]`
    );
    if (inspector === null) {
      throw new Error('the inspector is not drawn');
    }
    expect(inspector.querySelector('[data-option="word"] [data-summary]')?.getAttribute('data-summary')).toBe(
      'mixed'
    );

    choose(inspector, 'force_mode', 'set');
    type(inspector, 'force_mode', 'keys');
    button(inspector, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();
    expect(commands.applyBulkOptions).toHaveBeenCalledTimes(1);
    expect(inspector.querySelector('.headline')?.getAttribute('data-headline')).toBe('complete');
    // File 2 was rewritten, so the identity selected from its earlier parse is
    // stale now, and the inspector blocks rather than re-resolving it.
    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-b');
    expect(inspector.querySelector('[data-blocker="staleSelection"]')).not.toBeNull();

    // Stopping empties the selection and gives the pane back.
    button(list, words(lang, 'browser.list.bulk.stop')).click();
    flushSync();
    expect(state.bulkSelection).toEqual([]);
    expect(detail.querySelector(`[aria-label="${words(lang, 'browser.bulkInspector.label')}"]`)).toBeNull();
  });

  it('refuses to start selecting several while a write surface is open, and says why', async () => {
    locale.setOverride(lang);
    const { state, list } = await mountPanes();
    const lease = state.registerWriteSurface(
      { kind: 'matchEditor', target: { kind: 'document', document: 2 } },
      () => undefined
    );
    flushSync();
    expect(button(list, words(lang, 'browser.list.bulk.start')).disabled).toBe(true);
    expect(list.textContent).toContain(words(lang, 'browser.list.bulk.unavailable'));
    lease();
    flushSync();
    expect(button(list, words(lang, 'browser.list.bulk.start')).disabled).toBe(false);
  });
}); // End of the per-locale real-state suite

describe('the selection is the window’s, not the list’s', () => {
  it('drops the bulk selection when a workspace is opened again', async () => {
    const { state, list } = await mountPanes();
    button(list, DICTIONARIES[locale.current]['browser.list.bulk.start']).click();
    flushSync();
    row(list, ':one').click();
    flushSync();
    expect(state.bulkSelection).toHaveLength(1);
    await state.open(null);
    await settle();
    expect(state.bulkSelecting).toBe(false);
    expect(state.bulkSelection).toEqual([]);
  });

  it('ignores a toggle while not selecting several', async () => {
    const { state } = await mountPanes();
    state.toggleBulkSelection(idOf(2, 10));
    expect(state.bulkSelection).toEqual([]);
  });
}); // End of the "window's selection" suite

// ---------------------------------------------------------------------------
// The review's three findings, reproduced (Phase 3-11-2 review fixes)
// ---------------------------------------------------------------------------

describe.each(LOCALES)('the review fixes, in %s', (lang) => {
  it('keeps the selection session and every other writer closed while an apply is out (fix 1)', async () => {
    locale.setOverride(lang);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const { state, list, detail } = await mountPanes(gate);
    button(list, words(lang, 'browser.list.bulk.start')).click();
    flushSync();
    row(list, ':one').click();
    flushSync();
    await settle();
    const label = `[aria-label="${words(lang, 'browser.bulkInspector.label')}"]`;
    const inspector = detail.querySelector<HTMLElement>(label);
    if (inspector === null) {
      throw new Error('the inspector is not drawn');
    }
    choose(inspector, 'word', 'remove');
    button(inspector, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();

    expect(state.bulkApplyPending).toBe(true);
    const stop = button(list, words(lang, 'browser.list.bulk.stop'));
    expect(stop.disabled).toBe(true);
    expect(row(list, ':three').disabled).toBe(true);
    // The door refuses as well as the control: a press that got through ends nothing.
    state.setBulkSelecting(false);
    state.replaceBulkSelection([]);
    state.toggleBulkSelection(idOf(3, 20));
    flushSync();
    expect(state.bulkSelecting).toBe(true);
    expect(state.bulkSelection.map((id) => id.node)).toEqual([10]);
    expect(detail.querySelector(label)).not.toBeNull();
    expect(detail.textContent).not.toContain(words(lang, 'browser.matchCreation.open'));

    release();
    await settle();
    expect(state.bulkApplyPending).toBe(false);
    expect(button(list, words(lang, 'browser.list.bulk.stop')).disabled).toBe(false);
    button(list, words(lang, 'browser.list.bulk.stop')).click();
    flushSync();
    expect(state.bulkSelecting).toBe(false);
  });

  it('withdraws a confirmation once the options differ from the ones reviewed (fix 2)', async () => {
    locale.setOverride(lang);
    const refused: BulkApplyAnswer = {
      kind: 'answered',
      result: resultOf(false, [
        {
          document: 2,
          outcome: 'refused',
          verdict: 'RefusedForUnacknowledgedSuspicions',
          findings: [SUSPICION],
          candidate: 'cand-2',
          intent: 'intent-2'
        },
        { document: 3, outcome: 'notAttempted' }
      ]),
      adoptions: []
    };
    const { target, apply } = await mountInspector(selectionOf(idOf(2, 10), idOf(3, 20)), [refused]);
    choose(target, 'word', 'remove');
    button(target, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();
    const confirm = words(lang, 'browser.bulkInspector.consentGive');
    const item = (): Element | null => target.querySelector('.consent [data-document="2"]');
    expect(() => button(target, confirm)).not.toThrow();

    // Another option drafted after the review: nothing may be confirmed.
    choose(target, 'force_mode', 'remove');
    expect(() => button(target, confirm)).toThrow();
    expect(item()?.querySelector('.outdated')?.textContent?.trim()).toBe(
      words(lang, 'browser.bulkInspector.consentOutdated')
    );

    // Back to exactly what was reviewed: confirm, then change again — the
    // recorded consent is no longer shown as confirmed, and is not sent.
    choose(target, 'force_mode', 'untouched');
    button(target, confirm).click();
    flushSync();
    expect(item()?.querySelector('.consented')).not.toBeNull();
    choose(target, 'force_mode', 'remove');
    expect(item()?.querySelector('.consented')).toBeNull();
    expect(item()?.querySelector('.outdated')).not.toBeNull();
    button(target, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();
    expect(apply.mock.calls[1]?.[0].files.every((file) => file.consent === null)).toBe(true);
  });

  it('keeps a snippet selected after the apply when narrowing to what was not written (fix 3)', async () => {
    locale.setOverride(lang);
    const { state, list, detail } = await mountPanes();
    button(list, words(lang, 'browser.list.bulk.start')).click();
    flushSync();
    row(list, ':one').click();
    flushSync();
    await settle();
    const inspector = detail.querySelector<HTMLElement>(
      `[aria-label="${words(lang, 'browser.bulkInspector.label')}"]`
    );
    if (inspector === null) {
      throw new Error('the inspector is not drawn');
    }
    choose(inspector, 'word', 'remove');
    button(inspector, words(lang, 'browser.bulkInspector.apply')).click();
    await settle();
    // File 2 was saved. File 3 is selected only now, after that submission.
    row(list, ':three').click();
    flushSync();
    await settle();
    expect(state.bulkSelection.map((id) => id.node)).toEqual([10, 20]);
    button(inspector, words(lang, 'browser.bulkInspector.keepRemaining')).click();
    flushSync();
    expect(state.bulkSelection).toEqual([idOf(3, 20)]);
  });
}); // End of the per-locale review-fix suite
