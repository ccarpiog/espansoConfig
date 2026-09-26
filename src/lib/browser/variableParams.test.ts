/**
 * Phase 4-14-2 — an existing variable's parameters, `depends_on` and list items,
 * as model values (`./variableParams.ts`, composed into `./variableEditor.ts`).
 *
 * What this file pins, clause by clause of the step
 * (`docs/decisions/4-split-notes.md` §2, the 2026-09-26 addendum under 4-14):
 *
 * - each drafted text reaches the wire exactly as typed, in the shape Rust's
 *   planner reads — `EntryDraft.value`, `EntryDraft.items`,
 *   `VariableDraft.depends_on`, `VariableDraft.lists` — and a text left as the
 *   file holds it sends nothing;
 * - the plain-source settings (`offset`, `trim`, `debug`) are one-line boxes
 *   sent as typed, which Rust writes plain (the Rust half:
 *   `an_existing_offset_and_trim_are_written_as_plain_source` in
 *   `crates/espansoconfig-core/tests/draft_plan.rs` reads this module's JSON);
 * - a carriage return is refused at load, at edit and at send;
 * - undo, the save conflict's retained rows, the whole-container reapply
 *   (`applicable`, `satisfied`, `collision`) and recovery's refusal;
 * - a verbose form's `layout` stays the form editor's, and both reach one
 *   `VariableDraft`.
 *
 * **Model evidence, never a screen**: the mounted half is suite 9 of
 * `../components/MatchEditorVariables.test.ts`; the window half is 4-16's.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { ContentRevision, DocumentView, MatchDraft, MatchView, VariableView } from '../ipc/types';
import { editDraft, isDirty } from './draft';
import { field, makeConflict, makeDocument, makeMatch, makeVariable, scalar, scalarItem, styledScalar } from './fixtures';
import type { InvalidationStatus } from './invalidation';
import {
  appendVariableListItems,
  applySave,
  baselineOf,
  beginSave,
  conflictOf,
  discardVariableListItem,
  editFormLayout,
  editVariableField,
  editVariableListItem,
  editVariableParam,
  matchEditorView,
  planMatchReapply,
  removeVariableListItem,
  restoreVariableListItem,
  startMatchEditor,
  undoEdit,
  type MatchEditorSession
} from './matchEditor';
import { copyOfDraft } from './saveOutcome';
import {
  carriesDefinitions,
  variableStructureGrantOf,
  variableStructureReadOf,
  type VariableStructureGrant
} from './variableEditor';
import {
  listItemsProblemKey,
  paramRefusalKey,
  paramsViewOf,
  type ListItemsProblem,
  type ParamRefusal
} from './variableParams';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a change. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** A block list presence of `count` items. */
function blockItems(count: number): { readonly Items: { readonly location: never; readonly flow: false; readonly count: number } } {
  const nowhere = {
    key_node: 0,
    key_span: { start: 0, end: 0 },
    value_node: 0,
    value_span: { start: 0, end: 0 },
    path: null
  } as never;
  return { Items: { location: nowhere, flow: false, count } };
} // End of function blockItems()

/**
 * The three variables most cases use:
 *
 * - 0 `stamp`, a `date`: `format` (a logical string), `offset` written plain,
 *   `depends_on: [pick]`;
 * - 1 `pick`, a `choice`: `values: [alpha, beta]`, the kind's own list;
 * - 2 `run`, a `shell`: `cmd`, `trim` written plain, `debug` written quoted.
 */
const VARS: readonly VariableView[] = [
  makeVariable({
    node: 20,
    name: 'stamp',
    declaredType: 'date',
    kind: 'Date',
    params: [field('format', scalarItem('%H')), field('offset', scalarItem('0'))],
    dependsOn: [scalarItem('pick')]
  }),
  makeVariable({
    node: 21,
    name: 'pick',
    declaredType: 'choice',
    kind: 'Choice',
    params: [field('values', { Sequence: [scalarItem('alpha'), scalarItem('beta')] })],
    listParamPresence: blockItems(2)
  }),
  makeVariable({
    node: 22,
    name: 'run',
    declaredType: 'shell',
    kind: 'Shell',
    params: [
      field('cmd', scalarItem('echo hi')),
      field('trim', scalarItem('true')),
      field('debug', { Scalar: styledScalar('false', 'SingleQuoted') })
    ]
  })
];

/**
 * A projection of the snippet.
 *
 * @param vars - Its variables.
 * @param revision - The revision it is minted from.
 * @returns The projection.
 */
function projection(vars: readonly VariableView[] = VARS, revision: ContentRevision = BASE): MatchView {
  return makeMatch({ revision, document: 1, node: revision === BASE ? 1 : 9, trigger: ':a', replace: 'b', vars });
} // End of function projection()

/**
 * A clean session over the projection.
 *
 * @param match - The projection.
 * @returns The session.
 */
function session(match: MatchView = projection()): MatchEditorSession {
  return startMatchEditor(match, () => 0);
} // End of function session()

/**
 * The file a projection lives in.
 *
 * @param matches - Its snippets.
 * @param revision - Its revision.
 * @returns The file.
 */
function file(matches: readonly MatchView[], revision: ContentRevision = BASE): DocumentView {
  return makeDocument({ id: 1, relativePath: 'match/base.yml', revision, matches });
} // End of function file()

/**
 * A structure grant over the session's own file.
 *
 * @param held - The session.
 * @returns The grant.
 */
function granted(held: MatchEditorSession): VariableStructureGrant {
  return variableStructureGrantOf(held.match, variableStructureReadOf([file([projection()])], 1, []));
} // End of function granted()

/**
 * The draft a save would send.
 *
 * @param held - The session.
 * @returns The wire draft.
 */
function sent(held: MatchEditorSession): MatchDraft {
  const started = beginSave(held, () => held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  return started.draft;
} // End of function sent()

/**
 * The wire `VariableDraft` of one variable, as JSON crosses the boundary.
 *
 * @param held - The session.
 * @param index - The variable's position.
 * @returns The draft, or `undefined`.
 */
function sentVariable(held: MatchEditorSession, index: number): unknown {
  return JSON.parse(JSON.stringify(sent(held).vars)).find((one: { index: number }) => one.index === index);
} // End of function sentVariable()

/**
 * A `VariableDraft` that drafts only what a case names.
 *
 * @param index - The variable's position.
 * @param parts - The drafted parts.
 * @returns The expected wire object.
 */
function drafted(index: number, parts: Record<string, unknown>): Record<string, unknown> {
  return {
    index,
    name: 'Unchanged',
    type: 'Unchanged',
    inject_vars: 'Unchanged',
    params: [],
    insert_params: [],
    depends_on: [],
    records: [],
    lists: [],
    fields: [],
    field_intents: [],
    ...parts
  };
} // End of function drafted()

/**
 * A session showing a save conflict over its draft.
 *
 * @param held - The edited session.
 * @returns The conflicted session.
 */
function conflicted(held: MatchEditorSession): MatchEditorSession {
  const started = beginSave(held, () => held);
  if (started === null) {
    throw new Error('this case needs a saveable session');
  }
  return applySave(
    started.session,
    makeConflict({ disk: file([], AFTER), expected: BASE, found: AFTER }),
    NOT_OWED,
    () => started.session
  );
} // End of function conflicted()

describe('the wire: every drafted text as typed, in the shape Rust plans', () => {
  it('sends an edited offset as the text typed, for Rust to write plain', () => {
    const edited = editVariableParam(session(), 0, 1, '3600');
    expect(sentVariable(edited, 0)).toEqual(drafted(0, { params: [{ index: 1, value: { Set: '3600' }, items: [] }] }));
  });

  it('sends trim and debug as typed, and leaves an untouched quoted debug alone', () => {
    const held = session();
    expect(sent(editVariableParam(held, 2, 1, 'false')).vars).toEqual([
      drafted(2, { params: [{ index: 1, value: { Set: 'false' }, items: [] }] })
    ]);
    const debug = editVariableParam(held, 2, 2, 'true');
    expect(sentVariable(debug, 2)).toEqual(drafted(2, { params: [{ index: 2, value: { Set: 'true' }, items: [] }] }));
    // Retyping the file's value is no edit.
    expect(isDirty(editVariableParam(debug, 2, 2, 'false').draft)).toBe(false);
  });

  it('keeps an unfamiliar text exactly as typed, spaces included', () => {
    const edited = editVariableParam(session(), 0, 1, ' 1d ');
    expect(sentVariable(edited, 0)).toEqual(drafted(0, { params: [{ index: 1, value: { Set: ' 1d ' }, items: [] }] }));
    const format = editVariableParam(session(), 0, 0, '%Y\n%m');
    expect(sentVariable(format, 0)).toEqual(drafted(0, { params: [{ index: 0, value: { Set: '%Y\n%m' }, items: [] }] }));
  });

  it('sends a list item rewrite as EntryDraft.items and a depends_on rewrite by index', () => {
    let held = editVariableListItem(session(), 1, { kind: 'param', position: 0 }, 1, 'gamma');
    held = editVariableListItem(held, 0, { kind: 'dependsOn' }, 0, 'run');
    expect(sentVariable(held, 1)).toEqual(
      drafted(1, { params: [{ index: 0, value: 'Unchanged', items: [{ index: 1, value: { Set: 'gamma' } }] }] })
    );
    expect(sentVariable(held, 0)).toEqual(drafted(0, { depends_on: [{ index: 0, value: { Set: 'run' } }] }));
  });

  it('sends a removal and an insertion at the end as list intents, and never the removed item’s rewrite', () => {
    let held = editVariableListItem(session(), 1, { kind: 'param', position: 0 }, 0, 'ALPHA');
    held = removeVariableListItem(held, granted(held), 1, { kind: 'param', position: 0 }, 0);
    const outcome = appendVariableListItems(held, granted(held), 1, { kind: 'param', position: 0 }, 'gamma\ndelta\n');
    expect(outcome.kind).toBe('added');
    held = outcome.session;
    expect(sentVariable(held, 1)).toEqual(
      drafted(1, {
        lists: [
          { RemoveItem: { list: 'values', index: 0 } },
          { InsertItems: { list: 'values', at: { End: {} }, items: { Strings: ['gamma', 'delta'] } } }
        ]
      })
    );
    // Kept again, the removed item's rewrite comes back with it.
    const kept = restoreVariableListItem(held, 1, { kind: 'param', position: 0 }, 0);
    expect(sentVariable(kept, 1)).toMatchObject({
      params: [{ index: 0, value: 'Unchanged', items: [{ index: 0, value: { Set: 'ALPHA' } }] }]
    });
    const dropped = discardVariableListItem(kept, 1, { kind: 'param', position: 0 }, 0);
    expect(sentVariable(dropped, 1)).toMatchObject({
      lists: [{ InsertItems: { list: 'values', at: { End: {} }, items: { Strings: ['delta'] } } }]
    });
  });

  it('never takes out the last item a list keeps, and adds to depends_on too', () => {
    const address = { kind: 'dependsOn' } as const;
    const held = session();
    expect(removeVariableListItem(held, granted(held), 0, address, 0)).toBe(held);
    const added = appendVariableListItems(held, granted(held), 0, address, 'run');
    expect(added.kind).toBe('added');
    // A new item does not make the only original one removable: Rust counts the
    // removals against the list's original length (`VariableListWouldBeEmpty`).
    expect(removeVariableListItem(added.session, granted(added.session), 0, address, 0)).toBe(added.session);
    expect(sentVariable(added.session, 0)).toEqual(
      drafted(0, { lists: [{ InsertItems: { list: 'depends_on', at: { End: {} }, items: { Strings: ['run'] } } }] })
    );
  });

  it('refuses a structural item action without a grant for the session, and says why an addition failed', () => {
    const held = session();
    const refused = variableStructureGrantOf(held.match, variableStructureReadOf([], 1, []));
    expect(removeVariableListItem(held, refused, 1, { kind: 'param', position: 0 }, 0)).toBe(held);
    expect(appendVariableListItems(held, refused, 1, { kind: 'param', position: 0 }, 'x')).toMatchObject({
      kind: 'refused',
      problem: 'structure'
    });
    const cases: readonly [string, ListItemsProblem][] = [
      ['', 'noItems'],
      ['a\n\nb', 'emptyItem'],
      ['a\rb', 'carriageReturn']
    ];
    for (const [text, problem] of cases) {
      expect(appendVariableListItems(held, granted(held), 1, { kind: 'param', position: 0 }, text)).toMatchObject({
        kind: 'refused',
        problem
      });
    } // End of the loop over the refused texts
    // A list that is not the kind's own takes no insertion.
    expect(appendVariableListItems(held, granted(held), 2, { kind: 'param', position: 0 }, 'x')).toMatchObject({
      kind: 'refused',
      problem: 'notAList'
    });
  });

  it('merges a verbose form’s layout with the variable’s own parameter drafts into one VariableDraft', () => {
    const form = makeVariable({
      node: 23,
      name: 'ask',
      declaredType: 'form',
      kind: 'Form',
      params: [field('layout', scalarItem('Name: [[n]]')), field('title', scalarItem('Hello'))]
    });
    const held = session(projection([form]));
    const view = paramsViewOf(held.baseline.variables.rows[0]!.boxes, held.draft.value.variables.rows[0]!.boxes, true, true);
    // The layout is the form editor's; only `title` is drafted here.
    expect(view.params.map((one) => one.key)).toEqual(['title']);
    let edited = editVariableParam(held, 0, 0, 'Hi');
    edited = editFormLayout(edited, 0, 'Name: [[n]]!');
    expect(sentVariable(edited, 0)).toEqual(
      drafted(0, {
        params: [
          { index: 1, value: { Set: 'Hi' }, items: [] },
          { index: 0, value: { Set: 'Name: [[n]]!' }, items: [] }
        ]
      })
    );
  });
}); // End of the wire suite

describe('what a box may hold', () => {
  it('makes a typed setting one line and every other text a text area, and says why a value is not a box', () => {
    const odd = makeVariable({
      node: 30,
      name: 'odd',
      declaredType: 'echo',
      kind: 'Echo',
      params: [
        field('echo', scalarItem('a\nb')),
        field('offset', scalarItem('1\n2')),
        field('nested', { Mapping: [field('x', scalarItem('y'))] }),
        field('cr', scalarItem('a\rb')),
        field(null, scalarItem('keyless'))
      ]
    });
    const held = session(projection([odd]));
    const view = paramsViewOf(held.baseline.variables.rows[0]!.boxes, held.draft.value.variables.rows[0]!.boxes, true, true);
    expect(view.params.map((one) => [one.key, one.text?.oneLine ?? null, one.text?.refusal ?? one.refusal])).toEqual([
      ['echo', false, null],
      ['offset', true, 'lineBreak'],
      ['nested', null, 'notText'],
      ['cr', false, 'carriageReturn'],
      ['', null, 'keyNotNameable']
    ]);
    // A read-only text takes no edit.
    expect(editVariableParam(held, 0, 3, 'x')).toBe(held);
    expect(editVariableParam(held, 0, 2, 'x')).toBe(held);
  });

  it('refuses a carriage return at edit in every box, and a line feed in every one-line box', () => {
    const held = session();
    expect(editVariableParam(held, 0, 0, 'a\rb')).toBe(held);
    expect(editVariableParam(held, 0, 1, '1\n2')).toBe(held);
    expect(editVariableListItem(held, 1, { kind: 'param', position: 0 }, 0, 'a\rb')).toBe(held);
    expect(editVariableListItem(held, 1, { kind: 'param', position: 0 }, 0, 'a\nb')).toBe(held);
    expect(editVariableListItem(held, 0, { kind: 'dependsOn' }, 0, 'a\nb')).toBe(held);
  });

  it('refuses a forged carriage return at send, for a parameter, an item and a new item', () => {
    const held = editVariableParam(session(), 0, 0, 'x');
    /**
     * The session with row 0's boxes replaced by hand.
     *
     * @param change - The forged boxes.
     * @returns The forged session.
     */
    const forge = (change: (boxes: MatchEditorSession['draft']['value']['variables']['rows'][number]['boxes']) => unknown): MatchEditorSession => {
      const rows = held.draft.value.variables.rows.map((row, index) =>
        index === 0 ? { ...row, boxes: change(row.boxes) as typeof row.boxes } : row
      );
      return { ...held, draft: editDraft(held.draft, { ...held.draft.value, variables: { ...held.draft.value.variables, rows } }) };
    }; // End of function forge()
    const param = forge((boxes) => ({ ...boxes, params: boxes.params.map((one, at) => (at === 0 ? { ...one, text: 'a\rb' } : one)) }));
    expect(beginSave(param, () => param)).toBeNull();
    const item = forge((boxes) => ({
      ...boxes,
      dependsOn: { items: [{ text: 'a\rb', removed: false }], added: [] }
    }));
    expect(beginSave(item, () => item)).toBeNull();
    const added = forge((boxes) => ({ ...boxes, dependsOn: { items: [{ text: 'pick', removed: false }], added: ['x\ry'] } }));
    expect(beginSave(added, () => added)).toBeNull();
    const lineFeed = forge((boxes) => ({ ...boxes, dependsOn: { items: [{ text: 'a\nb', removed: false }], added: [] } }));
    expect(beginSave(lineFeed, () => lineFeed)).toBeNull();
  });

  it('reads the buffer once: a getter answering a different text on a second read is not what is sent', () => {
    const held = editVariableParam(session(), 0, 0, 'valid');
    let reads = 0;
    const rows = held.draft.value.variables.rows.map((row, index) => {
      if (index !== 0) {
        return row;
      }
      const params = row.boxes.params.map((one, at) =>
        at === 0
          ? {
              get text(): string {
                reads += 1;
                return reads === 1 ? 'valid' : 'bad\rvalue';
              },
              list: one.list
            }
          : one
      );
      return { ...row, boxes: { ...row.boxes, params } };
    });
    const forged = { ...held, draft: editDraft(held.draft, { ...held.draft.value, variables: { ...held.draft.value.variables, rows } }) };
    const started = beginSave(forged, () => forged);
    const texts = JSON.stringify(started?.draft.vars ?? []);
    expect(texts).not.toContain('\\r');
  });
}); // End of the box suite

describe('the shared lifecycle: undo, conflict, reapply and recovery', () => {
  it('takes a parameter edit back with one undo, and a removal with another', () => {
    let held = editVariableParam(session(), 2, 0, 'echo bye');
    held = removeVariableListItem(held, granted(held), 1, { kind: 'param', position: 0 }, 1);
    held = undoEdit(held);
    expect(sentVariable(held, 1)).toBeUndefined();
    expect(sentVariable(held, 2)).toBeDefined();
    held = undoEdit(held);
    expect(isDirty(held.draft)).toBe(false);
  });

  it('retains every drafted parameter, item and dependency row by row under a save conflict', () => {
    let held = editVariableParam(session(), 0, 1, '3600');
    held = editVariableListItem(held, 0, { kind: 'dependsOn' }, 0, 'run');
    held = removeVariableListItem(held, granted(held), 1, { kind: 'param', position: 0 }, 0);
    const outcome = appendVariableListItems(held, granted(held), 1, { kind: 'param', position: 0 }, 'gamma');
    held = outcome.session;
    const stuck = conflicted(held);
    const conflict = conflictOf(stuck);
    expect(conflict).not.toBeNull();
    const rows = matchEditorView(stuck).retainedDraft;
    const texts = rows.map((row) => `${row.label}|${row.status}|${row.text}`);
    expect(texts).toEqual(
      expect.arrayContaining([
        'variableName|unchanged|stamp',
        'params|parameterName|offset',
        'params|parameterValue|3600',
        'dependsOn|setting|run',
        'variableName|unchanged|pick',
        'params|parameterName|values',
        'params|parameterValue|beta',
        'params|parameterValue|gamma'
      ])
    );
    expect(texts).not.toContain('params|parameterValue|alpha');
    // The retained draft still carries the boxes, for a reapply or a copy.
    expect(copyOfDraft(conflict!).variables.rows[1]?.boxes.params[0]?.list?.added).toEqual(['gamma']);
  });

  it('reapplies over an unchanged container, is satisfied by the intended result, and collides otherwise', () => {
    let held = editVariableParam(session(), 2, 1, 'false');
    held = editVariableListItem(held, 1, { kind: 'param', position: 0 }, 1, 'gamma');
    held = editVariableListItem(held, 0, { kind: 'dependsOn' }, 0, 'run');
    const plan = (vars: readonly VariableView[]): ReturnType<typeof planMatchReapply> =>
      planMatchReapply(held.baseline, held.draft.value, baselineOf(projection(vars, AFTER)));
    expect(plan(VARS).variables).toBe('applicable');
    const intended: readonly VariableView[] = [
      { ...VARS[0]!, depends_on: [scalarItem('run')] },
      { ...VARS[1]!, params: [field('values', { Sequence: [scalarItem('alpha'), scalarItem('gamma')] })] },
      {
        ...VARS[2]!,
        params: [VARS[2]!.params[0]!, field('trim', scalarItem('false')), VARS[2]!.params[2]!]
      }
    ];
    expect(plan(intended).variables).toBe('satisfied');
    // `trim` written as the string 'false' is not the setting drafted.
    const quoted = intended.map((one, index) =>
      index === 2
        ? { ...one, params: [one.params[0]!, field('trim', { Scalar: styledScalar('false', 'SingleQuoted') }), one.params[2]!] }
        : one
    );
    expect(plan(quoted).variables).toBe('collision');
    // A kept item that changed on disk is not the intended list.
    const other = intended.map((one, index) =>
      index === 1 ? { ...one, params: [field('values', { Sequence: [scalarItem('ALPHA'), scalarItem('gamma')] })] } : one
    );
    expect(plan(other).variables).toBe('collision');
    expect(plan(other).collisions).toEqual(['vars']);
  });

  it('is satisfied by removals and insertions already on disk, and collides on a missing one', () => {
    let held = removeVariableListItem(session(), granted(session()), 1, { kind: 'param', position: 0 }, 0);
    held = appendVariableListItems(held, granted(held), 1, { kind: 'param', position: 0 }, 'gamma').session;
    const plan = (values: readonly string[]): ReturnType<typeof planMatchReapply> =>
      planMatchReapply(
        held.baseline,
        held.draft.value,
        baselineOf(projection([VARS[0]!, { ...VARS[1]!, params: [field('values', { Sequence: values.map(scalarItem) })] }, VARS[2]!], AFTER))
      );
    expect(plan(['beta', 'gamma']).variables).toBe('satisfied');
    expect(plan(['beta']).variables).toBe('collision');
  });

  it('refuses recovery for a snippet whose variables carry definitions (ruling 21)', () => {
    const held = editVariableParam(session(), 0, 1, '60');
    const conflict = conflictOf(conflicted(held));
    const draft = copyOfDraft(conflict!);
    expect(carriesDefinitions(held.baseline.variables, draft.variables)).toBe(true);
  });

  it('marks a variable whose parameter is drafted as edited, and draws nothing editable once it is removed', () => {
    const held = editVariableParam(session(), 0, 1, '60');
    const row = held.baseline.variables.rows[0]!;
    const view = paramsViewOf(row.boxes, held.draft.value.variables.rows[0]!.boxes, false, true);
    expect(view.params.every((one) => one.text === null || !one.text.editable)).toBe(true);
    expect(view.dependsOn?.items.every((one) => !one.editable && !one.canRemove)).toBe(true);
    expect(view.dependsOn?.canAdd).toBe(false);
    // A name edit and a parameter edit of one variable are one VariableDraft.
    const both = editVariableField(held, 0, 'name', 'when');
    expect(sentVariable(both, 0)).toMatchObject({ name: { Set: 'when' }, params: [{ index: 1, value: { Set: '60' } }] });
  });
}); // End of the lifecycle suite

describe('sentences', () => {
  it('has every refusal and problem sentence in both languages', () => {
    const refusals: readonly ParamRefusal[] = [
      'notDecodable',
      'carriageReturn',
      'ownsNoBytes',
      'lineBreak',
      'keyNotNameable',
      'notText'
    ];
    const problems: readonly ListItemsProblem[] = ['noItems', 'emptyItem', 'carriageReturn', 'notAList', 'structure'];
    for (const lang of LOCALES) {
      for (const key of [...refusals.map(paramRefusalKey), ...problems.map(listItemsProblemKey)]) {
        expect(DICTIONARIES[lang][key], `${lang} ${key}`).toBeTruthy();
      } // End of the loop over the keys
    } // End of the loop over the languages
    expect(scalar('x').text).toBe('x');
  });
}); // End of the sentences suite
