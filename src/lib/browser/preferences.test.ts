/**
 * The preferences model, driven without a screen — Phase 3-13-1.
 *
 * Display names (the real filename always in the value, blank means none,
 * whitespace kept, one line), ordering (rank first, ties and newcomers in
 * workspace order, dense writes), the seven defaults as optional text, the
 * report a preference save becomes, and the two refusal codes' sentences in
 * both languages — the Rust contract sees none of these browser-model codes.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeDefaultRefusal,
  describeDisplayNameRefusal,
  describeWithdrawnPreferenceSave
} from '../i18n/codes';
import { LOCALES } from '../i18n/locale';
import type { DocumentSummary, SidecarFilePreferences, SidecarState } from '../ipc/types';
import { makeSummary } from './fixtures';
import {
  defaultChanges,
  defaultRefusal,
  displayNameChanges,
  fileDefaultsOf,
  fileLabelOf,
  filePreferencesOf,
  isSuggestedDefault,
  NO_FILE_DEFAULTS,
  NO_PREFERENCES,
  orderedDocuments,
  preferenceSaveReportOf,
  preferencesOf,
  reorderRequests,
  type WorkspacePreferences
} from './preferences';

/**
 * Preferences holding the given entries.
 *
 * @param files - The entries, as `load_sidecar` would answer them.
 * @returns The preferences in effect.
 */
function holding(files: readonly Partial<SidecarFilePreferences>[]): WorkspacePreferences {
  const state: SidecarState = {
    status: { Loaded: {} },
    writable: true,
    files: files.map((file) => ({
      document: file.document ?? 1,
      display_name: file.display_name ?? null,
      sort_order: file.sort_order ?? null,
      defaults: file.defaults ?? []
    })),
    retained_orphans: 0
  };
  return preferencesOf(state);
} // End of function holding()

/** Four files, in workspace (discovery) order. */
const FILES: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'match/a.yml' }),
  makeSummary({ id: 2, relativePath: 'match/b.yml' }),
  makeSummary({ id: 3, relativePath: 'match/c.yml' }),
  makeSummary({ id: 4, relativePath: 'match/d.yml' })
];

/**
 * The ids of some summaries.
 *
 * @param documents - The summaries.
 * @returns Their ids, in order.
 */
function ids(documents: readonly DocumentSummary[]): readonly number[] {
  return documents.map((document) => document.id);
} // End of function ids()

describe('display names', () => {
  it('always carries the real filename, with a name and without one', () => {
    const preferences = holding([{ document: 1, display_name: 'Everyday' }]);
    expect(fileLabelOf(preferences, FILES[0]!)).toEqual({
      kind: 'displayName',
      name: 'Everyday',
      path: 'match/a.yml'
    });
    expect(fileLabelOf(preferences, FILES[1]!)).toEqual({ kind: 'filename', path: 'match/b.yml' });
    expect(fileLabelOf(NO_PREFERENCES, FILES[0]!)).toEqual({ kind: 'filename', path: 'match/a.yml' });
  });

  it('reads a stored empty or whitespace-only name as no name', () => {
    const preferences = holding([
      { document: 1, display_name: '' },
      { document: 2, display_name: '   ' }
    ]);
    expect(fileLabelOf(preferences, FILES[0]!).kind).toBe('filename');
    expect(fileLabelOf(preferences, FILES[1]!).kind).toBe('filename');
  });

  it('keeps a name’s whitespace exactly as written', () => {
    const preferences = holding([{ document: 1, display_name: '  Work  notes ' }]);
    expect(fileLabelOf(preferences, FILES[0]!)).toMatchObject({ name: '  Work  notes ' });
    expect(displayNameChanges('  Work  notes ')).toEqual({
      kind: 'ready',
      changes: [{ SetDisplayName: { name: '  Work  notes ' } }]
    });
  });

  it('clears the name for an empty or whitespace-only draft, never storing an empty one', () => {
    for (const draft of ['', ' ', '\t  ']) {
      expect(displayNameChanges(draft)).toEqual({ kind: 'ready', changes: [{ ClearDisplayName: {} }] });
    } // End of the loop over the blank drafts
  });

  it('refuses a name with a line break, with a sentence in both languages', () => {
    expect(displayNameChanges('two\nlines')).toEqual({ kind: 'refused', reason: 'lineBreak' });
    expect(displayNameChanges('two\rlines')).toEqual({ kind: 'refused', reason: 'lineBreak' });
    for (const locale of LOCALES) {
      const sentence = describeDisplayNameRefusal(locale, 'lineBreak');
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence).not.toContain('browser.sidecar');
    } // End of the loop over the locales
  });

  it('is never translated: a name is carried byte for byte', () => {
    const name = 'Plantillas — café ☕';
    expect(fileLabelOf(holding([{ document: 1, display_name: name }]), FILES[0]!)).toMatchObject({ name });
  });
});

describe('ordering', () => {
  it('puts ranked files first in rank order, then the rest in workspace order', () => {
    const preferences = holding([
      { document: 3, sort_order: 0 },
      { document: 1, sort_order: 5 }
    ]);
    expect(ids(orderedDocuments(FILES, preferences))).toEqual([3, 1, 2, 4]);
  });

  it('breaks a tie by workspace order', () => {
    const preferences = holding([
      { document: 4, sort_order: 1 },
      { document: 2, sort_order: 1 }
    ]);
    expect(ids(orderedDocuments(FILES, preferences))).toEqual([2, 4, 1, 3]);
  });

  it('places a newly added file, which has no rank, after every ranked one', () => {
    const preferences = holding([
      { document: 1, sort_order: 0 },
      { document: 2, sort_order: 1 },
      { document: 3, sort_order: 2 },
      { document: 4, sort_order: 3 }
    ]);
    const added = [...FILES, makeSummary({ id: 5, relativePath: 'match/0-new.yml' })];
    expect(ids(orderedDocuments(added, preferences))).toEqual([1, 2, 3, 4, 5]);
  });

  it('leaves the workspace order alone with no preferences, and never loses or adds a file', () => {
    expect(ids(orderedDocuments(FILES, NO_PREFERENCES))).toEqual([1, 2, 3, 4]);
  });

  it('writes a dense order and asks only for the ranks that move', () => {
    const preferences = holding([
      { document: 1, sort_order: 0 },
      { document: 2, sort_order: 7 }
    ]);
    expect(reorderRequests([1, 3, 2], preferences)).toEqual([
      { document: 3, changes: [{ SetSortOrder: { order: 1 } }] },
      { document: 2, changes: [{ SetSortOrder: { order: 2 } }] }
    ]);
    expect(reorderRequests([1, 2], holding([{ document: 1, sort_order: 0 }, { document: 2, sort_order: 1 }]))).toEqual([]);
  });
});

describe('defaults', () => {
  it('keeps absent and empty apart at ingress, and ignores an option outside the seven', () => {
    const defaults = fileDefaultsOf([
      { option: 'word', value: '' },
      { option: 'force_mode', value: 'keys' },
      // A cast: Rust refuses such a file, and this is the second line only.
      { option: 'paragraph' as never, value: 'true' }
    ]);
    expect(defaults).toEqual({ ...NO_FILE_DEFAULTS, word: '', force_mode: 'keys' });
  });

  it('turns absent → empty into a set and empty → absent into a clear, and asks nothing for no change', () => {
    const current = { ...NO_FILE_DEFAULTS, word: '' };
    const next = { ...NO_FILE_DEFAULTS, left_word: '' };
    expect(defaultChanges(current, next)).toEqual({
      kind: 'ready',
      changes: [{ ClearDefault: { option: 'word' } }, { SetDefault: { option: 'left_word', value: '' } }]
    });
    expect(defaultChanges(current, current)).toEqual({ kind: 'ready', changes: [] });
  });

  it('refuses a default with a carriage return, with a sentence in both languages', () => {
    expect(defaultRefusal('a\rb')).toBe('carriageReturn');
    expect(defaultChanges(NO_FILE_DEFAULTS, { ...NO_FILE_DEFAULTS, word: 'a\rb' })).toEqual({
      kind: 'refused',
      option: 'word',
      reason: 'carriageReturn'
    });
    for (const locale of LOCALES) {
      expect(describeDefaultRefusal(locale, 'carriageReturn').length).toBeGreaterThan(0);
    } // End of the loop over the locales
  });

  it('compares a suggestion by === only and never reads a boolean', () => {
    expect(isSuggestedDefault('force_mode', 'keys')).toBe(true);
    expect(isSuggestedDefault('force_mode', 'Keys')).toBe(false);
    expect(isSuggestedDefault('force_mode', 'keys ')).toBe(false);
    expect(isSuggestedDefault('word', 'true')).toBe(false);
  });

  it('answers no preferences for a file with no entry', () => {
    expect(filePreferencesOf(NO_PREFERENCES, 9)).toEqual({
      displayName: null,
      sortOrder: null,
      defaults: NO_FILE_DEFAULTS
    });
  });
});

describe('how a preference save ends', () => {
  const state: SidecarState = {
    status: { FutureSchema: { version: '2' } },
    writable: false,
    files: [],
    retained_orphans: 0
  };

  it('maps every outcome to a report, carrying the refusing status for notWritable', () => {
    expect(preferenceSaveReportOf({ ok: true, value: { outcome: { Saved: {} }, state } })).toEqual({ kind: 'saved' });
    expect(preferenceSaveReportOf({ ok: true, value: { outcome: { Unchanged: {} }, state } })).toEqual({
      kind: 'unchanged'
    });
    expect(preferenceSaveReportOf({ ok: true, value: { outcome: { NotWritable: {} }, state } })).toEqual({
      kind: 'notWritable',
      status: { FutureSchema: { version: '2' } }
    });
    expect(preferenceSaveReportOf({ ok: true, value: { outcome: { WriteFailed: {} }, state } })).toEqual({
      kind: 'writeFailed'
    });
    const failure = { kind: 'command', error: { code: 'noWorkspaceOpen' } } as const;
    expect(preferenceSaveReportOf({ ok: false, failure })).toEqual({ kind: 'failed', failure });
  });

  it('has a sentence for a save that was never sent, in both languages', () => {
    for (const locale of LOCALES) {
      expect(describeWithdrawnPreferenceSave(locale).length).toBeGreaterThan(0);
    } // End of the loop over the locales
  });

  it('reads Rust’s writable flag and nothing else as permission', () => {
    expect(preferencesOf(state).writable).toBe(false);
    expect(NO_PREFERENCES.writable).toBe(false);
  });
});
