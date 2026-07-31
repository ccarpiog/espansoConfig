/**
 * What the detail pane decides to show, and what it refuses to decide.
 *
 * The assertions with teeth are the ones about **absence** and about **not
 * collapsing**:
 *
 * - a field the file does not have produces no row at all, and a field it has
 *   with an empty value produces a row that says so. A model that mapped both to
 *   an empty string would pass a naive test and lose a real distinction;
 * - a match holding both a `trigger` and a `regex` produces **two** rows. The
 *   snippet list's `triggerLabel` deliberately answers one; a detail pane that
 *   reused it would show one of them, which is the defect the 1c-1 review found
 *   in the first attempt at this pane;
 * - nothing here reads a scalar's text to decide anything. `word: on` is a row
 *   whose value is the two characters `on` (D2u).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  describeMatch,
  describeUnknown,
  describeVariable,
  detailFieldKey,
  fieldLabel,
  flattenFields,
  flattenItems,
  flattenValue,
  hasDiscovery,
  indentClass,
  MAX_INDENT_DEPTH,
  optionGroupKey,
  scalarDisplay,
  scalarRow,
  styleWorthShowing,
  type DetailFieldName,
  type LineBlock,
  type MatchDetail,
  type OptionGroupName,
  type ScalarRow,
  type ValueLine
} from './detail';
import {
  aliasValue,
  elidedValue,
  field,
  makeMatch,
  makeVariable,
  scalar,
  scalarItem,
  styledScalar,
  unknownEntry
} from './fixtures';
import { DICTIONARIES } from '../i18n/dictionaries';
import type { ExpectNever, Missing } from '../i18n/exhaustive';

/**
 * Every member of {@link DetailFieldName}, written out once.
 *
 * Written out rather than collected from the model on purpose. **D2w — an audit
 * that iterates what the implementation emitted is vacuous** — is the rule this
 * list exists to obey: an expectation derived from `describeMatch`'s output can
 * never notice a field `describeMatch` forgot, because the forgotten field is
 * absent from both sides of the comparison. The expectation therefore comes
 * from the *union*, and the list is made to agree with the union at **compile
 * time**, in both directions: `satisfies` rejects a name that is not a member,
 * and {@link _DetailFieldsAreComplete} below rejects a member the list omits.
 */
const EVERY_DETAIL_FIELD = [
  'trigger',
  'triggers',
  'regex',
  'replace',
  'markdown',
  'html',
  'imagePath',
  'form',
  'label',
  'comment',
  'searchTerms',
  'word',
  'leftWord',
  'rightWord',
  'propagateCase',
  'uppercaseStyle',
  'forceMode',
  'forceClipboard',
  'paragraph',
  'anchor',
  'type',
  'params',
  'dependsOn',
  'injectVars'
] as const satisfies readonly DetailFieldName[];

/** Every option group name, written out once for the same reason. */
const EVERY_OPTION_GROUP = [
  'matching',
  'case',
  'injection',
  'other'
] as const satisfies readonly OptionGroupName[];

// `never` when the list above names every member of its union, and the member's
// own name when it does not — an `npm run check` failure in this file, naming
// what was forgotten, before any test runs. The other direction is the
// `satisfies` on each list. `../i18n/exhaustive.ts` is where the pair lives and
// says why a hand-written table needs it.
export type _DetailFieldsAreComplete = ExpectNever<
  Missing<DetailFieldName, typeof EVERY_DETAIL_FIELD>
>;
export type _OptionGroupsAreComplete = ExpectNever<
  Missing<OptionGroupName, typeof EVERY_OPTION_GROUP>
>;

describe('a row exists only for a field the file has', () => {
  it('answers null for an absent key', () => {
    expect(scalarRow('label', null)).toBeNull();
  });

  it('answers a row for a present key, and marks an empty value', () => {
    const row = scalarRow('label', scalar(''));
    expect(row?.field).toBe('label');
    expect(row?.scalar.text).toBe('');
    expect(row?.empty).toBe(true);
  });

  it('does not call a present, non-empty value empty', () => {
    expect(scalarRow('label', scalar('Signature'))?.empty).toBe(false);
  });

  it('keeps absent and empty apart on a whole match', () => {
    const absent = describeMatch(makeMatch({ label: null }));
    const present = describeMatch(makeMatch({ label: '' }));
    expect(absent.discovery).toEqual([]);
    expect(present.discovery).toHaveLength(1);
    expect(present.discovery[0]?.empty).toBe(true);
  });
}); // End of the "a row exists only for a field the file has" suite

describe('the trigger side is never collapsed', () => {
  it('shows a trigger and a regex as two rows when the file holds both', () => {
    // `TriggerKind::Several`, which the core really reports and which the
    // snippet list's `triggerLabel` deliberately answers with one value.
    const match = makeMatch({ trigger: ':sig', regex: 'gr[ae]y', triggerKind: 'Several' });
    const detail = describeMatch(match);
    expect(detail.trigger.kind).toBe('Several');
    expect(detail.trigger.rows.map((row) => row.field)).toEqual(['trigger', 'regex']);
    expect(detail.trigger.rows.map((row) => row.scalar.text)).toEqual([':sig', 'gr[ae]y']);
  });

  it('shows the triggers list beside a single trigger, not instead of it', () => {
    const match = makeMatch({ trigger: ':one', triggers: [':two', ':three'], triggerKind: 'Several' });
    const detail = describeMatch(match);
    expect(detail.trigger.rows.map((row) => row.field)).toEqual(['trigger']);
    expect(detail.trigger.triggers?.field).toBe('triggers');
    expect(detail.trigger.triggers?.lines).toHaveLength(2);
  });

  it('keeps the kind and shows no row when the file has no trigger at all', () => {
    const detail = describeMatch(makeMatch({ trigger: null, triggerKind: 'Absent' }));
    expect(detail.trigger.kind).toBe('Absent');
    expect(detail.trigger.rows).toEqual([]);
    expect(detail.trigger.triggers).toBeNull();
  });
}); // End of the "trigger side" suite

describe('the content side is never collapsed', () => {
  it('shows every content field the file holds, in the plan section 3.3 order', () => {
    const match = makeMatch({
      replace: 'plain',
      form: 'Hello [[name]]',
      markdown: '**bold**',
      html: '<b>bold</b>',
      imagePath: '$CONFIG/x.png',
      contentKind: 'Several'
    });
    const detail = describeMatch(match);
    expect(detail.content.kind).toBe('Several');
    expect(detail.content.rows.map((row) => row.field)).toEqual([
      'replace',
      'form',
      'markdown',
      'html',
      'imagePath'
    ]);
  });

  it('shows no row and reports the kind for a match with no content at all', () => {
    const detail = describeMatch(
      makeMatch({ replace: null, html: null, contentKind: 'Absent' })
    );
    expect(detail.content.rows).toEqual([]);
    expect(detail.content.kind).toBe('Absent');
  });
}); // End of the "content side" suite

describe('a scalar is source text, and what is said beside it', () => {
  it('never resolves a value that YAML 1.1 would read as a boolean (D2u)', () => {
    const detail = describeMatch(makeMatch({ options: { word: 'on' } }));
    const row = groupRows(detail, 'matching')[0];
    expect(row?.field).toBe('word');
    expect(row?.scalar.text).toBe('on');
    // The row carries no boolean of any kind: only text, and three facts about
    // how that text is written.
    expect(Object.keys(row ?? {}).sort()).toEqual(['ambiguous', 'empty', 'field', 'scalar', 'style']);
  });

  it('carries the core ambiguity flag through unchanged', () => {
    expect(scalarDisplay(styledScalar('on', 'Plain', true)).ambiguous).toBe(true);
    expect(scalarDisplay(scalar('on')).ambiguous).toBe(false);
  });

  it('hides the style of a plain scalar and shows every other one', () => {
    expect(styleWorthShowing('Plain')).toBeNull();
    expect(styleWorthShowing('SingleQuoted')).toBe('SingleQuoted');
    expect(styleWorthShowing('DoubleQuoted')).toBe('DoubleQuoted');
    expect(styleWorthShowing('Literal')).toBe('Literal');
    expect(styleWorthShowing('Folded')).toBe('Folded');
  });
}); // End of the "a scalar is source text" suite

describe('options are grouped by intent, not dumped flat', () => {
  it('puts each of the nine in the group plan section 8.5 names', () => {
    const detail = describeMatch(
      makeMatch({
        options: {
          word: 'true',
          left_word: 'true',
          right_word: 'false',
          propagate_case: 'true',
          uppercase_style: 'capitalize',
          force_mode: 'clipboard',
          force_clipboard: 'true',
          paragraph: 'true',
          anchor: 'base'
        }
      })
    );
    expect(detail.options.map((group) => group.name)).toEqual([...EVERY_OPTION_GROUP]);
    expect(groupRows(detail, 'matching').map((row) => row.field)).toEqual([
      'word',
      'leftWord',
      'rightWord'
    ]);
    expect(groupRows(detail, 'case').map((row) => row.field)).toEqual([
      'propagateCase',
      'uppercaseStyle'
    ]);
    expect(groupRows(detail, 'injection').map((row) => row.field)).toEqual([
      'forceMode',
      'forceClipboard'
    ]);
    expect(groupRows(detail, 'other').map((row) => row.field)).toEqual(['paragraph', 'anchor']);
  }); // End of the "each of the nine in its group" case

  it('has no group at all for a match that sets no option', () => {
    // The pane draws its options section when this list is non-empty, so an
    // empty group left in it would be a heading over nothing.
    expect(describeMatch(makeMatch()).options).toEqual([]);
  });

  it('drops the groups whose keys the file does not have, and keeps the rest in order', () => {
    // The decision that used to be four `{#if group.length > 0}` blocks in
    // markup, where nothing could reach it.
    const detail = describeMatch(makeMatch({ options: { anchor: 'base', left_word: 'true' } }));
    expect(detail.options.map((group) => group.name)).toEqual(['matching', 'other']);
    expect(detail.options.every((group) => group.rows.length > 0)).toBe(true);
  }); // End of the "drops the empty groups" case

  it('names a key that exists in both dictionaries, for every group', () => {
    for (const name of EVERY_OPTION_GROUP) {
      const key = optionGroupKey(name);
      expect(DICTIONARIES.en[key], key).toBeTruthy();
      expect(DICTIONARIES.es[key], key).toBeTruthy();
    } // End of the loop over every group the pane can head
  });

  it('keeps the two injection keys apart while grouping them together', () => {
    // Plan section 8.5 asks for one *control*, which is an editing decision.
    // Reading, both keys are in the file and both are shown.
    const detail = describeMatch(
      makeMatch({ options: { force_mode: 'keys', force_clipboard: 'true' } })
    );
    expect(groupRows(detail, 'injection').map((row) => row.scalar.text)).toEqual(['keys', 'true']);
  });
}); // End of the "options grouped by intent" suite

describe('a projected value flattens into lines', () => {
  it('turns a scalar into one line at the depth it was given', () => {
    const lines = flattenValue(scalarItem('alpha'), { kind: 'item' }, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.kind).toBe('scalar');
    expect(lines[0]?.depth).toBe(2);
  });

  it('says an alias is there rather than following it', () => {
    const lines = flattenValue(aliasValue(9));
    expect(lines[0]?.kind).toBe('alias');
    expect(lines).toHaveLength(1);
  });

  it('says the projection stopped, and at what, for an elided node', () => {
    // Rendering nothing here would tell the reader the file holds nothing.
    const lines = flattenValue(elidedValue('Mapping', 4));
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line?.kind).toBe('elided');
    expect(line?.kind === 'elided' ? line.elided.kind : null).toBe('Mapping');
  });

  it('keeps the elided node itself, not only what kind it was', () => {
    // The identity the wire carried. `AliasLine` keeps its whole `AliasView`;
    // an editing phase addresses a line in order to change it, and a projection
    // that dropped the node would have to go back to the wire for it.
    const lines = flattenValue(elidedValue('Sequence', 7));
    const line = lines[0];
    expect(line?.kind === 'elided' ? line.elided.node : null).toBe(7);
  }); // End of the "keeps the elided node" case

  it('opens a nested sequence and indents its items', () => {
    const lines = flattenValue({ Sequence: [scalarItem('a'), scalarItem('b')] });
    expect(lines.map((line) => [line.kind, line.depth])).toEqual([
      ['branch', 0],
      ['scalar', 1],
      ['scalar', 1]
    ]);
  });

  it('opens a nested mapping, labels each entry with its key and indents it', () => {
    const lines = flattenValue({
      Mapping: [field('format', scalarItem('%Y')), field('tz', scalarItem('UTC'))]
    });
    expect(lines.map((line) => line.kind)).toEqual(['branch', 'scalar', 'scalar']);
    expect(labelKeys(lines)).toEqual([null, 'format', 'tz']);
  });

  it('marks an empty collection rather than emitting a bare header', () => {
    const sequence = flattenValue({ Sequence: [] })[0];
    const mapping = flattenValue({ Mapping: [] })[0];
    expect(sequence?.kind === 'branch' ? sequence.empty : null).toBe(true);
    expect(mapping?.kind === 'branch' ? [mapping.empty, mapping.shape] : null).toEqual([
      true,
      'Mapping'
    ]);
  });

  it('nests to whatever depth the projection carried', () => {
    const lines = flattenValue({
      Mapping: [field('outer', { Sequence: [{ Mapping: [field('inner', scalarItem('x'))] }] })]
    });
    expect(lines.map((line) => [line.kind, line.depth])).toEqual([
      ['branch', 0],
      ['branch', 1],
      ['branch', 2],
      ['scalar', 3]
    ]);
  });

  it('says so when a mapping key is not a plain name', () => {
    const lines = flattenValue({ Mapping: [field(null, scalarItem('x'))] });
    expect(lines[1]?.label.kind).toBe('unnamed');
    expect(fieldLabel(field(null, scalarItem('x'))).kind).toBe('unnamed');
  });

  it('carries the key node of an entry it cannot name', () => {
    // Nothing can address such an entry *by name*, but `FieldView.key_node`
    // exists whether or not the key is a scalar, and dropping it would throw
    // away the only handle an editing phase would have on the line.
    const label = fieldLabel(field(null, scalarItem('x'), 12));
    expect(label.kind === 'unnamed' ? label.keyNode : null).toBe(12);
  }); // End of the "carries the key node" case
}); // End of the "a projected value flattens into lines" suite

describe('the sequence and mapping helpers', () => {
  it('flatten a sequence field without a header of its own', () => {
    // The block already carries the field's label, so a "a list" line above a
    // list the reader can see would say nothing.
    const lines = flattenItems([scalarItem('a'), scalarItem('b')]);
    expect(lines.map((line) => [line.kind, line.depth])).toEqual([
      ['scalar', 0],
      ['scalar', 0]
    ]);
  });

  it('flatten a shallow mapping in source order, never sorted', () => {
    const lines = flattenFields([
      field('zulu', scalarItem('1')),
      field('alpha', scalarItem('2')),
      field('mike', scalarItem('3'))
    ]);
    expect(labelKeys(lines)).toEqual(['zulu', 'alpha', 'mike']);
  });

  it('answer an empty list for an empty field, so the caller draws no heading', () => {
    expect(flattenItems([])).toEqual([]);
    expect(flattenFields([])).toEqual([]);
  });
}); // End of the "sequence and mapping helpers" suite

describe('a variable', () => {
  it('shows its declared type as written and the kind the core read separately', () => {
    const variable = makeVariable({ name: 'today', declaredType: 'date', kind: 'Date' });
    const detail = describeVariable(variable);
    expect(detail.name?.scalar.text).toBe('today');
    expect(detail.kind).toBe('Date');
    expect(detail.rows.map((row) => [row.field, row.scalar.text])).toEqual([['type', 'date']]);
  });

  it('has no type row when the file gives it no type', () => {
    // `VariableKind::Absent` with no `type` key: the kind still reports, and no
    // row invents a value the file does not hold.
    const detail = describeVariable(makeVariable({ name: 'x', declaredType: null }));
    expect(detail.rows).toEqual([]);
    expect(detail.kind).toBe('Absent');
  });

  it('keeps its parameters in source order', () => {
    const detail = describeVariable(
      makeVariable({
        params: [
          field('format', scalarItem('%Y')),
          field('offset', scalarItem('0')),
          field('tz', scalarItem('UTC'))
        ]
      })
    );
    expect(labelKeys(detail.params?.lines ?? [])).toEqual(['format', 'offset', 'tz']);
    expect(detail.params?.field).toBe('params');
  });

  it('renders a parameter whose value is elided, an alias, a mapping or a sequence', () => {
    const detail = describeVariable(
      makeVariable({
        params: [
          field('deep', elidedValue('Sequence')),
          field('shared', aliasValue()),
          field('fields', { Mapping: [field('name', scalarItem('text'))] }),
          field('values', { Sequence: [scalarItem('one'), scalarItem('two')] })
        ]
      })
    );
    expect((detail.params?.lines ?? []).map((line) => line.kind)).toEqual([
      'elided',
      'alias',
      'branch',
      'scalar',
      'branch',
      'scalar',
      'scalar'
    ]);
  });

  it('carries depends_on, inject_vars and the entries nobody modelled', () => {
    const detail = describeVariable(
      makeVariable({
        dependsOn: [scalarItem('other')],
        injectVars: 'false',
        unknownEntries: [unknownEntry('surprise')]
      })
    );
    expect(detail.dependsOn?.field).toBe('dependsOn');
    expect(detail.rows.map((row) => row.field)).toEqual(['injectVars']);
    expect(detail.unknown).toHaveLength(1);
  });
}); // End of the "a variable" suite

describe('a whole match', () => {
  it('carries its variables, form fields and unmodelled entries', () => {
    const match = makeMatch({
      vars: [makeVariable({ node: 20, name: 'today', declaredType: 'date', kind: 'Date' })],
      formFields: [field('body', { Mapping: [field('multiline', scalarItem('true'))] })],
      unknownEntries: [unknownEntry('unknown_key'), unknownEntry(null, 'NonScalarKey', 3)]
    });
    const detail = describeMatch(match);
    expect(detail.variables).toHaveLength(1);
    expect(detail.variables[0]?.node).toBe(20);
    expect(detail.formFields.map((line) => line.kind)).toEqual(['branch', 'scalar']);
    expect(detail.unknown.map((entry) => entry.key)).toEqual([
      { kind: 'named', text: 'unknown_key' },
      { kind: 'unnamed' }
    ]);
  });

  it('shows nothing for the blocks a plain snippet does not have', () => {
    const detail = describeMatch(makeMatch({ trigger: ':sig', replace: 'body' }));
    expect(detail.variables).toEqual([]);
    expect(detail.formFields).toEqual([]);
    expect(detail.unknown).toEqual([]);
    expect(detail.searchTerms).toBeNull();
  });

  it('puts label, comment and search terms in the discovery group', () => {
    const detail = describeMatch(
      makeMatch({ label: 'Signature', comment: 'the sign-off', searchTerms: ['sig', 'sign'] })
    );
    expect(detail.discovery.map((row) => row.field)).toEqual(['label', 'comment']);
    expect(detail.searchTerms?.lines).toHaveLength(2);
  });
}); // End of the "a whole match" suite

describe('the discovery section', () => {
  // A compound predicate — two lists feeding one heading — which is the shape
  // that has to stay out of markup, because markup is where nothing can reach
  // it.
  it('is there when either of its two parts is', () => {
    expect(hasDiscovery(describeMatch(makeMatch({ label: 'Signature' })))).toBe(true);
    expect(hasDiscovery(describeMatch(makeMatch({ comment: 'the sign-off' })))).toBe(true);
    expect(hasDiscovery(describeMatch(makeMatch({ searchTerms: ['sig'] })))).toBe(true);
  });

  it('is not there when neither is', () => {
    expect(hasDiscovery(describeMatch(makeMatch({ trigger: ':sig', replace: 'body' })))).toBe(false);
  });

  it('counts a label that is present and empty, which is not the same as absent', () => {
    expect(hasDiscovery(describeMatch(makeMatch({ label: '' })))).toBe(true);
  });
}); // End of the "discovery section" suite

describe('an entry the projection did not model', () => {
  it('carries a named key as a name', () => {
    const row = describeUnknown(unknownEntry('custom_setting', 'NotModelled', 4));
    expect(row.key).toEqual({ kind: 'named', text: 'custom_setting' });
    expect(row.node).toBe(4);
    expect(row.valueKind).toBe('Scalar');
    expect(row.reason).toBe('NotModelled');
  }); // End of the "named key" case

  it('marks a key that is present and empty rather than drawing nothing', () => {
    // The defect this arm closes: the pane printed `entry.key` raw, so an entry
    // whose key is the empty string rendered a blank `dt` — a row with nothing
    // in it, which is indistinguishable from a row that failed to render. It is
    // the same distinction `ScalarDisplay.empty` draws everywhere else here.
    expect(describeUnknown(unknownEntry('')).key).toEqual({ kind: 'empty' });
  }); // End of the "empty key" case

  it('says a key that is not a scalar cannot be named', () => {
    expect(describeUnknown(unknownEntry(null, 'NonScalarKey')).key).toEqual({ kind: 'unnamed' });
  });

  it('is the shape a variable and a match both hand the pane', () => {
    // Both used to hand it the raw wire entry, so the component reached into
    // `key_node`, `value_kind` and a `key === null` test of its own.
    const variable = describeVariable(makeVariable({ unknownEntries: [unknownEntry('')] }));
    const match = describeMatch(makeMatch({ unknownEntries: [unknownEntry('')] }));
    expect(variable.unknown[0]?.key).toEqual({ kind: 'empty' });
    expect(match.unknown[0]?.key).toEqual({ kind: 'empty' });
  }); // End of the "shape a variable and a match hand the pane" case
}); // End of the "entry the projection did not model" suite

describe('the field labels', () => {
  it('name a key that exists in both dictionaries, for every field', () => {
    // The compile-time half of this is `detailFieldKey`'s return type. This is
    // the runtime half, and it is what fails if `en.json` is edited without the
    // type being rebuilt.
    for (const name of EVERY_DETAIL_FIELD) {
      const key = detailFieldKey(name);
      expect(DICTIONARIES.en[key], key).toBeTruthy();
      expect(DICTIONARIES.es[key], key).toBeTruthy();
    } // End of the loop over every field the pane can label
  });

  it('are all of them emitted, for a match that sets every field there is', () => {
    // **This assertion is an equality, and that is the whole point.** The
    // expected side is `EVERY_DETAIL_FIELD`, which `satisfies` and
    // `_DetailFieldsAreComplete` above pin to `DetailFieldName` itself in both
    // directions at compile time; the actual side is what
    // `describeMatch` emitted. A member added to the union and never emitted
    // fails here, which is what an audit that merely counted the output could
    // not do (D2w: an audit that iterates what the implementation emitted is
    // vacuous).
    const match = makeMatch({
      trigger: ':t',
      triggers: ['a'],
      regex: 'r',
      replace: 'a',
      markdown: 'b',
      html: 'c',
      imagePath: 'd',
      form: 'e',
      label: 'f',
      comment: 'g',
      searchTerms: ['h'],
      options: {
        word: '1',
        left_word: '1',
        right_word: '1',
        propagate_case: '1',
        uppercase_style: '1',
        force_mode: '1',
        force_clipboard: '1',
        paragraph: '1',
        anchor: '1'
      },
      vars: [
        makeVariable({
          declaredType: 'date',
          injectVars: 'true',
          params: [field('format', scalarItem('%Y'))],
          dependsOn: [scalarItem('other')]
        })
      ]
    });
    const emitted = [...emittedFieldNames(describeMatch(match))].sort();
    expect(emitted).toEqual([...EVERY_DETAIL_FIELD].sort());
  });
}); // End of the "field labels" suite

describe('the indentation class', () => {
  it('names the depth', () => {
    expect(indentClass(0)).toBe('depth-0');
    expect(indentClass(3)).toBe('depth-3');
  });

  it('clamps rather than falling back to no indentation at all', () => {
    expect(indentClass(MAX_INDENT_DEPTH + 4)).toBe(`depth-${MAX_INDENT_DEPTH}`);
    expect(indentClass(-1)).toBe('depth-0');
  });
}); // End of the "indentation class" suite

describe('the pane that renders this model', () => {
  /*
   * A **text scan**, and worth being exact about what it is: nothing in this
   * repository renders a Svelte component in an automated test, so this cannot
   * say the pane draws anything. What it can say is that the component still
   * *names* the accessor for every code it has to turn into words — a code with
   * no accessor call is a Rust identifier on screen or a blank space, and a
   * refactor that drops one leaves no other trace in this repository.
   *
   * The evidence that the pane renders is the window reading in
   * `docs/decisions/1c-2a-notes.md`, taken by a human, not by this file.
   */
  const source = readFileSync(
    fileURLToPath(new URL('../components/DetailPane.svelte', import.meta.url)),
    'utf8'
  );

  it.each([
    'tTriggerKind',
    'tContentKind',
    'tVariableKind',
    'tScalarStyle',
    'tUnknownReason',
    'tValueKind',
    'tDetailField',
    'tOptionGroup',
    'tUnknownCount'
  ])('calls %s, so that code reaches the screen as words', (accessor) => {
    expect(source).toContain(`${accessor}(`);
  });

  // There is no "holds no built `t(` key" case here. `built-translation-keys.test.ts`
  // runs that scan over **every** `.svelte` file under `src/`, with a
  // non-vacuity guard on the file count and `formatBuiltKeyFindings` in the
  // failure message; a copy naming this one file is strictly weaker.

  it('handles the item branch, so a sequence item is not just another line', () => {
    // `flattenValue` labels every item of a sequence `item`, and the pane draws
    // a flat list with `list-style: none`. A component that handles only `key`
    // and `unnamed` therefore turns two search terms whose first scalar holds a
    // newline into **three unmarked lines**, and the reader cannot tell two
    // items from three. The marker is a glyph in the markup rather than a
    // `content:` rule so that it is part of the DOM's text, which is the one
    // thing the window reading can see (experiments N and P: neither
    // `svelte-check` nor `vite build` would notice a dead CSS rule).
    expect(source).toContain("line.label.kind === 'item'");
    expect(source).toContain('class="bullet"');
    expect(source).toContain('.bullet {');
  });

  it('says what shape an unmodelled entry holds, because it cannot show the value', () => {
    // `UnknownEntry` carries `value_span` and `value_kind` and no value text at
    // all, so the pane cannot print the value and must not claim to. What it
    // can do is name the shape; the strings say the entry was recorded and left
    // untouched, which is a claim about the file rather than about the screen.
    expect(source).toContain('browser.detail.unknownValue');
    expect(source).toContain('tValueKind(entry.valueKind)');
  });
}); // End of the "pane that renders this model" suite

describe('the global stylesheet', () => {
  /*
   * The `.depth-N` ladder is in `src/app.css` rather than in the pane's own
   * `<style>`, because Svelte scopes a component's rules: written there they
   * compile to `.depth-3.svelte-<hash>` and no second pane could use them. The
   * same blind spot as before applies and hole 6 says so — neither
   * `svelte-check` nor `vite build` reports a deleted selector, so this can say
   * the rule is written and never that it paints.
   */
  const stylesheet = readFileSync(fileURLToPath(new URL('../../app.css', import.meta.url)), 'utf8');

  it('has a rule for every indentation class the model can produce', () => {
    // `indentClass` clamps, so the deepest rule is the last one needed. A class
    // with no rule is a nesting level that silently renders flat.
    for (let depth = 0; depth <= MAX_INDENT_DEPTH; depth += 1) {
      expect(stylesheet, `depth ${depth}`).toContain(`.${indentClass(depth)} {`);
    }
  });

  it('states the monospaced face once, where three components can share it', () => {
    // The face carries meaning here — it is the "this is what the document
    // holds" signal — so it is a token rather than three copies of a font list.
    expect(stylesheet).toContain('--font-mono:');
  });
}); // End of the "global stylesheet" suite

/**
 * The key text of each line's label, or `null` when it opens no key.
 *
 * @param lines - The lines to read.
 * @returns One entry per line, in order.
 */
function labelKeys(lines: readonly ValueLine[]): readonly (string | null)[] {
  return lines.map((line) => (line.label.kind === 'key' ? line.label.key.text : null));
} // End of function labelKeys()

/**
 * The rows of one named option group, or none when the group was not built.
 *
 * @param detail - The model built for one match.
 * @param name - Which group to look for.
 * @returns Its rows, or an empty list.
 */
function groupRows(detail: MatchDetail, name: OptionGroupName): readonly ScalarRow[] {
  return detail.options.find((group) => group.name === name)?.rows ?? [];
} // End of function groupRows()

/**
 * Every field name one built model actually put on a row or on a block.
 *
 * The *actual* side of the coverage assertion, and nothing more: it must never
 * be used to derive the expectation, which is `EVERY_DETAIL_FIELD`.
 *
 * @param detail - The model built for one match.
 * @returns The distinct names it emitted, in no particular order.
 */
function emittedFieldNames(detail: MatchDetail): readonly DetailFieldName[] {
  const rows: readonly ScalarRow[] = [
    ...detail.trigger.rows,
    ...detail.content.rows,
    ...detail.discovery,
    ...detail.options.flatMap((group) => group.rows),
    ...detail.variables.flatMap((variable) => variable.rows)
  ];
  const blocks: readonly (LineBlock | null)[] = [
    detail.trigger.triggers,
    detail.searchTerms,
    ...detail.variables.flatMap((variable) => [variable.params, variable.dependsOn])
  ];
  const names = new Set<DetailFieldName>(rows.map((row) => row.field));
  for (const block of blocks) {
    if (block !== null) {
      names.add(block.field);
    }
  } // End of the loop over the blocks the model may or may not have built
  return [...names];
} // End of function emittedFieldNames()
