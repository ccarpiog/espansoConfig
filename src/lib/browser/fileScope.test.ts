/**
 * The file-scope inspector's model and its accessors — Phase 3-9-1
 * (`docs/decisions/3-split-notes.md` §2 step 3-9, ruling 14).
 *
 * One `describe` per acceptance clause: every projected import is a row, in file
 * order; an unsupported entry stays visible with its reason; nothing resolves a
 * path; absent, empty, unsupported and unread are four states; a `_` file is
 * "not auto-loaded" and never "inactive". The accessors are called here in both
 * locales, because the Rust dictionary contract sees no `browser.*` key.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeImportsState,
  describeAutoLoadNote,
  describeUnsupportedImport,
  describeValueKind
} from '../i18n/codes';
import { DICTIONARIES, translate } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { DocumentView, SequencePresence, ValueView } from '../ipc/types';
import {
  autoLoadKey,
  autoLoadOf,
  describeFileScope,
  importsStateKey,
  importsStateOf,
  unsupportedImportKey,
  type ImportRow,
  type ImportsState,
  type ImportsStateName
} from './fileScope';
import {
  aliasValue,
  elidedValue,
  makeDocument,
  makeSummary,
  scalarItem,
  styledScalar
} from './fixtures';

/** A location every presence below can carry; nothing here slices by it. */
const LOCATION = {
  key_node: 0,
  key_span: { start: 0, end: 0 },
  value_node: 0,
  value_span: { start: 0, end: 0 },
  path: null
};

/**
 * A parsed snippet file writing `imports` as given.
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
 * An `Items` presence counting `count` entries.
 *
 * @param count - How many.
 * @returns The presence.
 */
function items(count: number): SequencePresence {
  return { Items: { location: LOCATION, flow: false, count } };
} // End of function items()

/**
 * One row of a listed state, which must exist.
 *
 * @param state - The state, which must be `listed`.
 * @param index - The 0-based index.
 * @returns The row.
 */
function rowAt(state: ImportsState, index: number): ImportRow {
  const row = state.kind === 'listed' ? state.rows[index] : undefined;
  if (row === undefined) {
    throw new Error(`expected a row at ${index}`);
  }
  return row;
} // End of function rowAt()

/**
 * The display facts of a row written as a scalar, which it must be.
 *
 * @param row - The row.
 * @returns Its display facts.
 */
function displayOf(row: ImportRow): Extract<ImportRow, { kind: 'asWritten' }>['display'] {
  if (row.kind !== 'asWritten') {
    throw new Error('expected an entry written as a scalar');
  }
  return row.display;
} // End of function displayOf()

describe('every projected import is a row, in file order', () => {
  it('keeps the file order and numbers each row by its position', () => {
    const view = withImports(
      [scalarItem('_zeta.yml'), scalarItem('alpha.yml'), scalarItem('../other/m.yml')],
      items(3)
    );
    const state = importsStateOf(view);
    expect(state.kind).toBe('listed');
    if (state.kind !== 'listed') return;
    expect(state.rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(
      state.rows.map((row) => (row.kind === 'asWritten' ? row.display.scalar.text : null))
    ).toEqual(['_zeta.yml', 'alpha.yml', '../other/m.yml']);
  });

  it('draws a row for an entry even when the presence disagrees', () => {
    const state = importsStateOf(withImports([scalarItem('a.yml')], { Absent: {} }));
    expect(state.kind).toBe('listed');
  });

  it('keeps an empty scalar, a quoted one and a YAML 1.1-ambiguous one as written', () => {
    const view = withImports(
      [
        scalarItem(''),
        { Scalar: styledScalar('b c.yml', 'DoubleQuoted') },
        { Scalar: styledScalar('yes', 'Plain', true) }
      ],
      items(3)
    );
    const state = importsStateOf(view);
    expect(displayOf(rowAt(state, 0)).empty).toBe(true);
    expect(displayOf(rowAt(state, 1)).style).toBe('DoubleQuoted');
    expect(displayOf(rowAt(state, 2)).ambiguous).toBe(true);
    expect(displayOf(rowAt(state, 2)).scalar.text).toBe('yes');
  });
});

describe('an unsupported entry stays visible, at its own position, with its reason', () => {
  it('turns an elided entry into an unsupported row without shifting the others', () => {
    const view = withImports(
      [scalarItem('a.yml'), elidedValue('Mapping', 7), scalarItem('c.yml'), aliasValue(9)],
      items(4)
    );
    const state = importsStateOf(view);
    if (state.kind !== 'listed') throw new Error('expected rows');
    expect(state.rows).toHaveLength(4);
    expect(rowAt(state, 1)).toEqual({ kind: 'unsupported', position: 2, found: 'Mapping', node: 7 });
    expect(rowAt(state, 2).kind).toBe('asWritten');
    expect(rowAt(state, 2).position).toBe(3);
    expect(rowAt(state, 3)).toEqual({ kind: 'unsupported', position: 4, found: 'Alias', node: 9 });
  });

  it('keeps a descended collection as an unsupported row with no node', () => {
    const view = withImports([{ Sequence: [scalarItem('x')] }, { Mapping: [] }], items(2));
    const state = importsStateOf(view);
    if (state.kind !== 'listed') throw new Error('expected rows');
    expect(state.rows).toEqual([
      { kind: 'unsupported', position: 1, found: 'Sequence', node: null },
      { kind: 'unsupported', position: 2, found: 'Mapping', node: null }
    ]);
  });

  it('names what the entry is written as, in both locales', () => {
    for (const lang of LOCALES) {
      const sentence = describeUnsupportedImport(lang, 'Mapping');
      expect(sentence).toBe(
        translate(lang, unsupportedImportKey(), { kind: describeValueKind(lang, 'Mapping') })
      );
      expect(sentence).toContain(describeValueKind(lang, 'Mapping'));
    }
  });
});

describe('no resolution is invented', () => {
  it('carries the scalar the projection carried, untouched', () => {
    const entry = scalarItem('~/elsewhere/../x.yml');
    const state = importsStateOf(withImports([entry], items(1)));
    expect(displayOf(rowAt(state, 0)).scalar).toBe('Scalar' in entry ? entry.Scalar : null);
  });

  it('holds no path, existence or missing claim in any row', () => {
    const state = importsStateOf(withImports([scalarItem('a.yml'), elidedValue('Sequence')], items(2)));
    if (state.kind !== 'listed') throw new Error('expected rows');
    for (const row of state.rows) {
      const keys = Object.keys(row).sort();
      expect(keys).toEqual(
        row.kind === 'asWritten' ? ['display', 'kind', 'position'] : ['found', 'kind', 'node', 'position']
      );
    }
  });

  it('says over the list, in both locales, that nothing is looked up', () => {
    const listed: ImportsState = { kind: 'listed', rows: [] };
    expect(describeImportsState('en', listed)).toMatch(/does not look up these files/);
    expect(describeImportsState('es', listed)).toMatch(/no busca estos archivos/);
  });
});

describe('absent, empty, unsupported shape and unread are four states', () => {
  it('reads absent from the presence', () => {
    expect(importsStateOf(withImports([], { Absent: {} }))).toEqual({ kind: 'absent' });
  });

  it('reads an empty list from the presence', () => {
    expect(importsStateOf(withImports([], { Empty: { location: LOCATION } }))).toEqual({
      kind: 'empty'
    });
  });

  it('draws an Items presence counting nothing as empty', () => {
    expect(importsStateOf(withImports([], items(0)))).toEqual({ kind: 'empty' });
  });

  it('reads an unsupported shape with what the file writes instead', () => {
    const presence: SequencePresence = {
      UnsupportedShape: { location: LOCATION, found: 'Scalar' }
    };
    expect(importsStateOf(withImports([], presence))).toEqual({
      kind: 'unsupportedShape',
      found: 'Scalar'
    });
  });

  it('says nothing about the imports of a file that was not read', () => {
    const view = withImports([], { Absent: {} }, { parsed: false });
    expect(importsStateOf(view)).toEqual({ kind: 'notRead' });
  });

  it('gives every state its own sentence, in both locales', () => {
    const names: readonly ImportsStateName[] = [
      'notRead',
      'absent',
      'empty',
      'unsupportedShape',
      'listed'
    ];
    for (const lang of LOCALES) {
      const sentences = names.map((name) => DICTIONARIES[lang][importsStateKey(name)]);
      expect(new Set(sentences).size).toBe(names.length);
      for (const sentence of sentences) {
        expect(sentence.length).toBeGreaterThan(0);
      }
    }
  });

  it('puts what the file writes into the unsupported-shape sentence', () => {
    for (const lang of LOCALES) {
      const sentence = describeImportsState(lang, { kind: 'unsupportedShape', found: 'Scalar' });
      expect(sentence).toContain(describeValueKind(lang, 'Scalar'));
      expect(sentence).not.toContain('{kind}');
    }
  });
});

describe('a `_` file is not auto-loaded, never inactive', () => {
  it('reads the core flag from a summary and from a projection alike', () => {
    expect(autoLoadOf(makeSummary({ disabled: true }))).toEqual({ kind: 'notAutoLoaded' });
    expect(autoLoadOf(makeDocument({ disabled: true }))).toEqual({ kind: 'notAutoLoaded' });
    expect(autoLoadOf(makeSummary())).toEqual({ kind: 'default' });
  });

  it('reads a `_` snippet file and a `_` package file as not auto-loaded', () => {
    const snippet = makeSummary({ relativePath: 'match/_scoped.yml', disabled: true });
    const packaged = makeSummary({
      relativePath: 'match/packages/p/_extra.yml',
      kind: 'Package',
      disabled: true
    });
    expect(autoLoadOf(snippet)).toEqual({ kind: 'notAutoLoaded' });
    expect(autoLoadOf(packaged)).toEqual({ kind: 'notAutoLoaded' });
  });

  it('reads a `_` configuration profile as its own state, and an ordinary one as default', () => {
    const profile = makeDocument({
      relativePath: 'config/_chrome.yml',
      kind: 'ConfigProfile',
      disabled: true
    });
    expect(autoLoadOf(profile)).toEqual({ kind: 'underscoreProfile' });
    expect(describeFileScope(profile).autoLoad).toEqual({ kind: 'underscoreProfile' });
    expect(autoLoadOf(makeSummary({ relativePath: 'config/chrome.yml', kind: 'ConfigProfile' })))
      .toEqual({ kind: 'default' });
  });

  it('describes the whole file scope', () => {
    const view = withImports([scalarItem('a.yml')], items(1), { disabled: true });
    const scope = describeFileScope(view);
    expect(scope.autoLoad.kind).toBe('notAutoLoaded');
    expect(scope.imports.kind).toBe('listed');
  });

  it('never says inactive, disabled or switched off, in either locale', () => {
    const forbidden = /inactiv|disabled|switched off|turned off|desactivad|apagad/i;
    for (const lang of LOCALES) {
      for (const note of ['notAutoLoaded', 'underscoreProfile'] as const) {
        for (const placement of ['mark', 'explanation'] as const) {
          const words = describeAutoLoadNote(lang, note, placement);
          expect(words).toBe(DICTIONARIES[lang][autoLoadKey(note, placement)]);
          expect(words).not.toMatch(forbidden);
        }
      }
    }
  });

  it('leaves no "inactive" wording anywhere in either dictionary', () => {
    for (const lang of LOCALES) {
      const offending = Object.values(DICTIONARIES[lang]).filter((value) => /inactiv/i.test(value));
      expect(offending).toEqual([]);
    }
  });

  it('explains a `_` snippet file through imports and includes, in both locales', () => {
    for (const lang of LOCALES) {
      const words = describeAutoLoadNote(lang, 'notAutoLoaded', 'explanation');
      expect(words).toMatch(lang === 'en' ? /starts with “_”/ : /empieza por «_»/);
      expect(words).toContain('imports');
      expect(words).toContain('includes');
      expect(words).toContain('extra_includes');
    }
  });

  it('says of a `_` profile only what is known: no loading claim, no import route', () => {
    for (const lang of LOCALES) {
      for (const placement of ['mark', 'explanation'] as const) {
        const words = describeAutoLoadNote(lang, 'underscoreProfile', placement);
        expect(words).toMatch(lang === 'en' ? /starts with “_”/ : /empieza por «_»/);
        expect(words).not.toMatch(/imports|includes|not loaded|no se carga/i);
        expect(words).not.toBe(describeAutoLoadNote(lang, 'notAutoLoaded', placement));
      }
    }
    expect(describeAutoLoadNote('en', 'underscoreProfile', 'explanation')).toMatch(
      /does not check/
    );
    expect(describeAutoLoadNote('es', 'underscoreProfile', 'explanation')).toMatch(
      /no comprueba/
    );
  });
});
